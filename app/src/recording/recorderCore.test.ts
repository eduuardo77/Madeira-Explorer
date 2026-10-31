/**
 * The recorder's profile switching, replayed (E3, A3 of the 30 Oct fix plan).
 *
 *     cd app && npm test
 *
 * The first three cases are the October faults, replayed from the P30's own
 * batches (`fixtures/`, cut by `tools/extract-recorder-fixture.mjs`, every
 * position moved 2° west, times and distances kept: the lead's answer to Q4).
 * Each was checked by reverting its fix and watching it fail (T-300 in TASKS).
 * The rest are the glue's own rules, on invented positions in the ocean.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { LocationSample, SamplingProfile } from './LocationProvider';
import { offsetByMetres } from './distance.ts';
import { STILL_CHECK_WAIT_MS, WAKE_FIX_TIMEOUT_MS } from './motionWakePolicy.ts';
import { createRecorder, type RecorderDeps } from './recorderCore.ts';
import { createReplay, type ReplayEvent } from './recorderReplay.ts';

type Fixture = {
  profileBefore: { profile: SamplingProfile; ts: number } | null;
  history: LocationSample[];
  batches: { at: number; fixes: LocationSample[] }[];
  labels: { ts: number; activity: string; transition: string }[];
  diary: { ts: number; kind: string; detail: string }[];
};

const fixture = (name: string): Fixture =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as Fixture;

const utc = (iso: string) => Date.parse(`${iso}Z`);
const at = (ms: number) => new Date(ms).toISOString().slice(11, 19);

/** The batches and the sensors' labels, as the replay's events. */
function events(f: Fixture): ReplayEvent[] {
  return [
    ...f.batches.map((batch): ReplayEvent => ({ kind: 'batch', at: batch.at, fixes: batch.fixes })),
    ...f.labels
      .filter((label) => label.transition === 'enter')
      .map((label): ReplayEvent => ({ kind: 'label', at: label.ts, activity: label.activity })),
  ];
}

/**
 * A GPS position asked for at `t`: the phone's own fix in the next
 * `WAKE_FIX_TIMEOUT_MS`, else none. A stand-in: the recorded fixes passed the
 * profile's distance filter and a fresh request would not have, so this can
 * only miss positions, never invent one.
 */
function positionsFrom(f: Fixture): (t: number) => LocationSample | null {
  const all = [...f.history, ...f.batches.flatMap((batch) => batch.fixes)].sort((a, b) => a.ts - b.ts);
  return (t) => all.find((fix) => fix.ts >= t && fix.ts <= t + WAKE_FIX_TIMEOUT_MS) ?? null;
}

// ---------------------------------------------------------------------------
// 26 Oct, 17:45 to 18:20: a stop that began on driving (T-286, N15, T-295)
// ---------------------------------------------------------------------------
//
// The lead sat down in a shopping centre at 17:49. The sensors said still at
// 17:49:15; at 17:52:12 the gate raised walking to driving ("moved 120 m, in a
// vehicle by the motion sensors"); from 17:53:50 to 18:16 no fix passed the
// driving profile's 50 m filter, so nothing could lower it, and the P30 held
// fine GPS for 29 minutes.

const STILL_AT = utc('2026-10-26T17:49:15');

async function replayStop(options: { alarms: boolean }) {
  const f = fixture('stop-on-driving-2026-10-26');
  const replay = createReplay({
    storedProfile: f.profileBefore?.profile,
    storedProfileTs: f.profileBefore?.ts,
    history: f.history,
    positionAt: positionsFrom(f),
    alarms: options.alarms,
    timersRunInBackground: false,
  });
  await replay.run(events(f), utc('2026-10-26T18:20:40'));
  return replay;
}

test('⚠ 26 Oct: a stop that begins on driving sleeps five minutes after the sensors say still (T-286)', async () => {
  const replay = await replayStop({ alarms: true });
  assert.ok(
    replay.diary.includes(`${at(STILL_AT)} activity: still check: started on walking`),
    replay.diary.join('\n')
  );
  // The gate raised to driving after the check began, as on the P30.
  assert.ok(replay.changes.some((change) => change.profile === 'driving' && at(change.at) === '17:52:12'));
  const sleep = replay.changes.find((change) => change.profile === 'stationary');
  assert.ok(sleep, `never slept:\n${replay.diary.join('\n')}`);
  assert.equal(at(sleep.at), at(STILL_AT + STILL_CHECK_WAIT_MS), 'by the alarm, five minutes on');
  // N15: no position at the second look (indoors) counts as still.
  assert.ok(replay.diary.some((line) => line.includes('no position (indoors)')));
});

test('⚠ 26 Oct: the stop wakes again when the drive resumes', async () => {
  const replay = await replayStop({ alarms: true });
  const last = replay.changes[replay.changes.length - 1];
  assert.notEqual(last.profile, 'stationary', replay.diary.join('\n'));
  assert.ok(last.at >= utc('2026-10-26T18:18:10') && last.at <= utc('2026-10-26T18:20:33'), at(last.at));
});

test('⚠ T-295: without alarms, a still check waiting on a timer never ends in the background', async () => {
  // What the P30 did on 31 Oct at 09:00, here on 26 Oct's batches: the timer
  // is frozen with the process, so the stop never sleeps.
  const replay = await replayStop({ alarms: false });
  assert.equal(replay.changes.some((change) => change.profile === 'stationary'), false, replay.diary.join('\n'));
});

// ---------------------------------------------------------------------------
// 27 Oct, 12:11: an install at home after a drive (N15)
// ---------------------------------------------------------------------------
//
// No positions needed: the stored profile was driving and the last fix 1,037
// minutes old (the diary's own words). The launch must start on stationary,
// and the motion wake's read of the stale profile, begun before the launch
// wrote and finished after, must not put driving back. On the P30 it did: the
// diary said stationary at 12:11:15 and the recorder ran on driving at 12:11:16.

const LAUNCH_AT = utc('2026-10-27T12:11:15');
const NOWHERE = { lat: 32, lon: -19 }; // invented, in the ocean
const oldFix = (ts: number): LocationSample => ({
  ts,
  ...NOWHERE,
  accuracyM: 5,
  speedMps: 0,
  bearingDeg: null,
  altitudeM: null,
  activityType: 'unknown',
  source: 'fused',
});

test('⚠ 27 Oct: a launch with driving stored and no recent fix starts on stationary (N15)', async () => {
  const replay = createReplay({
    storedProfile: 'driving',
    storedProfileTs: LAUNCH_AT - 1037 * 60_000,
    history: [oldFix(LAUNCH_AT - 1037 * 60_000)],
  });
  await replay.run([{ kind: 'launch', at: LAUNCH_AT }]);
  assert.deepEqual(replay.changes, [{ at: LAUNCH_AT, profile: 'stationary' }]);
  assert.equal(replay.storedProfile(), 'stationary');
  assert.ok(replay.diary.includes('12:11:15 start: profile driving -> stationary: restart with no recent fix (last fix 1037 min ago)'));
});

test('⚠⚠ 27 Oct: a profile read begun before the launch wrote cannot undo the write (N15)', { timeout: 5000 }, async () => {
  let stored: string | null = 'driving';
  let releaseHeld: (() => void) | null = null;
  let reads = 0;
  const diary: string[] = [];
  const applied: SamplingProfile[] = [];
  const deps: RecorderDeps = {
    now: () => LAUNCH_AT,
    state: {
      // The first read is the motion wake's: it is held until the launch writes.
      getProfile: () => {
        reads += 1;
        const value = stored;
        if (reads === 1) return new Promise((resolve) => (releaseHeld = () => resolve(value)));
        return Promise.resolve(value);
      },
      setProfile: async (profile) => {
        stored = profile;
        const release = releaseHeld;
        releaseHeld = null;
        if (release) {
          release();
          // Let the late read finish before this write returns, as it did.
          await new Promise((resolve) => setImmediate(resolve));
        }
      },
      getProfileUpdatedTs: async () => null,
      getStillCheck: async () => null,
      setStillCheck: async () => {},
      clearStillCheck: async () => {},
    },
    trace: {
      getActiveTripId: async () => 1,
      getMovementWindow: async () => [],
      getLastFixTs: async () => LAUNCH_AT - 1037 * 60_000,
    },
    provider: {
      isRecording: async () => true,
      setSamplingProfile: async (profile) => {
        applied.push(profile);
      },
      currentPosition: async () => null,
    },
    outing: {
      readClock: async (nowMs) => ({ inProgress: false, startedTs: null, nowMs }),
      getAwakeApplied: async () => false,
    },
    scheduleAlarm: () => true,
    setTimer: () => {},
    batch: { store: async () => {}, noteLatest: async () => {}, afterGate: async () => {} },
    diary: {
      log: async (kind, detail) => {
        diary.push(`${kind}: ${detail}`);
      },
      logError: async (where) => {
        diary.push(`error: ${where}`);
      },
    },
  };
  const recorder = createRecorder(deps);
  // The motion wake's still label arrives first and starts reading the profile.
  const wake = recorder.onMotionWake({ source: 'activity', activity: 'still' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 1, 'the wake is waiting on its read');
  const launched = await recorder.settleLaunchProfile(LAUNCH_AT);
  await wake;
  assert.equal(launched, 'stationary', 'the launch asserts stationary');
  assert.equal(await recorder.getCurrentSamplingProfile(), 'stationary');
  assert.equal(stored, 'stationary');
  assert.ok(!diary.some((line) => line.includes('still check: started on driving')), diary.join('\n'));
});

// ---------------------------------------------------------------------------
// 30 Oct, 16:15: the drive's last batch, delivered 7 min late (T-294)
// ---------------------------------------------------------------------------
//
// The app came back to the front at 16:15:54 in a car park; the re-assert
// dropped driving to stationary (last fix 8 min old). A second later the
// drive's last fix, from 16:08:33, arrived, and the gate read it as a drive
// now: "stationary -> driving: moved 7352 m at up to 86 km/h". The lead was
// walking. The history holds only fixes 2.6 km or more from home: the gate's
// window is the 12 minutes before the newest fix, which starts later still.

async function replayLeftover() {
  const f = fixture('leftover-batch-2026-10-30');
  const replay = createReplay({
    storedProfile: f.profileBefore?.profile,
    storedProfileTs: f.profileBefore?.ts,
    history: f.history,
  });
  await replay.run(
    [
      ...events(f),
      // The diary's "still check: started on driving" is the sensors' still.
      { kind: 'label', at: utc('2026-10-30T16:10:36'), activity: 'still' },
      // No app_launch line: the same process, back in front.
      { kind: 'foreground', at: utc('2026-10-30T16:15:54') },
    ],
    utc('2026-10-30T16:16:30')
  );
  return replay;
}

test('⚠ 30 Oct: the drive’s last batch, 7 min late, does not raise a stationary phone (T-294)', async () => {
  const replay = await replayLeftover();
  const sinceForeground = replay.changes.filter((change) => change.at >= utc('2026-10-30T16:15:54'));
  assert.deepEqual(
    sinceForeground.map((change) => change.profile),
    ['stationary'],
    replay.diary.join('\n')
  );
  assert.equal(replay.providerProfile(), 'stationary');
  assert.ok(replay.diary.some((line) => line.startsWith('16:15:54 start: profile driving -> stationary')));
});

test('30 Oct: the still check begun at 16:10 stays, because the sensors said walking since', async () => {
  const replay = await replayLeftover();
  assert.ok(
    replay.diary.includes('16:15:36 activity: still check: stay after 5 min, the motion sensors said moving since'),
    replay.diary.join('\n')
  );
});

// ---------------------------------------------------------------------------
// The glue's own rules, on invented positions
// ---------------------------------------------------------------------------

const T0 = utc('2026-01-01T10:00:00');
const MIN = 60_000;
const fixAt = (minute: number, eastM: number, activity = 'unknown'): LocationSample => ({
  ts: T0 + minute * MIN,
  ...offsetByMetres(NOWHERE, 0, eastM),
  accuracyM: 5,
  speedMps: null,
  bearingDeg: null,
  altitudeM: null,
  activityType: activity as LocationSample['activityType'],
  source: 'fused',
});

test('a refused profile change is taken back, and the next batch tries again (2026-10-04)', async () => {
  let refusals = 1;
  const replay = createReplay({
    storedProfile: 'stationary',
    history: [fixAt(0, 0)],
    refuse: () => refusals-- > 0,
  });
  await replay.run([
    { kind: 'batch', at: T0 + 10 * MIN, fixes: [fixAt(10, 400)] },
    { kind: 'batch', at: T0 + 11 * MIN, fixes: [fixAt(11, 800)] },
  ]);
  assert.ok(replay.diary.some((line) => line.includes('error: sampling gate: refused walking')), replay.diary.join('\n'));
  assert.deepEqual(replay.changes.map((change) => change.profile), ['walking']);
  assert.equal(replay.changes[0].at, T0 + 11 * MIN, 'retried on the next batch');
  assert.equal(replay.storedProfile(), 'walking');
});

test('not recording: the gate changes nothing, whatever the fixes say (D-008)', async () => {
  const replay = createReplay({ storedProfile: 'stationary', history: [fixAt(0, 0)], recording: false });
  await replay.run([{ kind: 'batch', at: T0 + 10 * MIN, fixes: [fixAt(10, 2000)] }]);
  assert.deepEqual(replay.changes, []);
  assert.equal(replay.storedProfile(), 'stationary');
});

test('an outing past its awake window re-applies stationary, once the gate sees no change (T-285)', async () => {
  const replay = createReplay({
    storedProfile: 'stationary',
    history: [fixAt(0, 0)],
    outing: { startedTs: T0 - 20 * MIN },
  });
  await replay.run([{ kind: 'batch', at: T0 + 6 * MIN, fixes: [fixAt(6, 10)] }]);
  assert.deepEqual(replay.changes.map((change) => change.profile), ['stationary']);
  assert.ok(replay.diary.some((line) => line.includes('outing awake window over')));
});

test('a motion wake looks up to three times, and stops once the gate has left stationary (D-106)', async () => {
  const positions = new Map([
    [T0 + 10 * MIN, fixAt(10, 20)], // still at the door
    [T0 + 10 * MIN + 90_000, fixAt(11.5, 600)], // gone
  ]);
  const replay = createReplay({
    storedProfile: 'stationary',
    history: [fixAt(0, 0)],
    positionAt: (t) => positions.get(t) ?? null,
  });
  await replay.run([{ kind: 'significant_motion', at: T0 + 10 * MIN }], T0 + 20 * MIN);
  assert.deepEqual(replay.changes.map((change) => change.profile), ['walking']);
  assert.equal(replay.changes[0].at, T0 + 10 * MIN + 90_000, 'the second look');
  assert.equal(replay.diary.filter((line) => line.includes('motion wake: look')).length, 1, 'no third look');
});

test('walking rises to driving on two in-vehicle labels within 9 min, not on one (T-296)', async () => {
  const once = createReplay({ storedProfile: 'walking', history: [fixAt(0, 0)] });
  await once.run([{ kind: 'label', at: T0 + MIN, activity: 'driving' }]);
  assert.deepEqual(once.changes, []);
  assert.ok(once.diary.some((line) => line.includes('driving once, waiting for a second')));

  const twice = createReplay({ storedProfile: 'walking', history: [fixAt(0, 0)] });
  await twice.run([
    { kind: 'label', at: T0 + MIN, activity: 'driving' },
    { kind: 'label', at: T0 + 6 * MIN, activity: 'driving' },
  ]);
  assert.deepEqual(twice.changes.map((change) => change.profile), ['driving']);
});

test('a still check whose stop the gate already caught ends quietly (T-286)', async () => {
  const replay = createReplay({
    storedProfile: 'walking',
    storedProfileTs: T0,
    history: [fixAt(0, 0)],
    positionAt: () => null,
  });
  await replay.run(
    [
      { kind: 'label', at: T0 + MIN, activity: 'still' },
      // Six still minutes reach the gate before the check's alarm.
      { kind: 'batch', at: T0 + 5.5 * MIN, fixes: [1, 2, 3, 4, 5, 5.5].map((m) => fixAt(m, 3)) },
    ],
    T0 + 10 * MIN
  );
  assert.deepEqual(replay.changes.map((change) => change.profile), ['stationary']);
  assert.ok(!replay.diary.some((line) => line.includes('still check: stay')), replay.diary.join('\n'));
});
