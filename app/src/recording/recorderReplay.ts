/**
 * A replay harness for `recorderCore` (E3, A3 of the 30 Oct fix plan).
 *
 * Feeds a sequence of batches, motion labels and launches through the real
 * recorder logic with a fake clock, an in-memory `app_state` and trace, a fake
 * provider and Android's alarms, and records every profile the provider is
 * asked for. `recorderCore.test.ts` uses it for the October faults, replayed
 * from the P30's own batches (moved by one fixed offset, Q4 of the plan).
 *
 * What it copies from the real thing, and where from:
 * - `app_state` writes stamp `updated_ts` with the clock (`appStateDao.set`),
 *   and `getJson` reads an unparsable value (the cleared still check, '') as null.
 * - The movement window is newest first, `ts >= since`, at most `limit`
 *   (`rawFixDao.getMovementWindow`).
 * - The native consumer's two gaps (`MotionWakeTaskConsumer.kt`): a moving
 *   label at most every 4 min unless the last one passed on was still; a still
 *   label at most every 10 min.
 * - A launch is a new process (the profile cache, the labels and the timers in
 *   memory are gone; `app_state` and Android's alarms stay), then
 *   `settleLaunchProfile` and the recorder started on its answer
 *   (`tripRecording.syncRecordingWithPreferences`). A foreground is the same
 *   process coming to the front: the same re-assert, nothing forgotten, and
 *   overdue timers fire, as React Native's do on resume.
 * - `timersRunInBackground: false` is what T-295 found on the P30: a
 *   JavaScript timer never fires while the app is in the background.
 * - A fix is stored once, by its time, as the sink does (`unstoredFixes`).
 *
 * What it does not model: which fixes the OS would have delivered on a
 * different profile. A case feeds the batches the phone really recorded, so
 * it is only exact up to the first moment the replay's profile differs from
 * the phone's; the cases assert at those moments.
 */

import type { LocationSample, SamplingProfile } from './LocationProvider';
import type { MovementSample } from './movementPolicy.ts';
import type { FollowUp } from './motionWakePolicy.ts';
import { followUpStep } from './motionWakePolicy.ts';
import type { OutingClock } from './recorderControls.ts';
import { createRecorder, type Recorder, type RecorderDeps } from './recorderCore.ts';

export type ReplayEvent =
  /** The OS hands over a batch at `at`; its fixes keep their own times. */
  | { kind: 'batch'; at: number; fixes: LocationSample[] }
  /** Google's activity updates say `activity` (walking, driving, still...). */
  | { kind: 'label'; at: number; activity: string }
  /** The phone's significant-motion sensor fires. */
  | { kind: 'significant_motion'; at: number }
  /** A new app process starts and re-asserts the recorder. */
  | { kind: 'launch'; at: number }
  /** The running app comes to the front and re-asserts the recorder. */
  | { kind: 'foreground'; at: number };

export type ProfileChange = { at: number; profile: SamplingProfile };

export type ReplayOptions = {
  /** What `app_state` holds when the replay begins. */
  storedProfile?: SamplingProfile | null;
  /** When that profile was written (its `updated_ts`). */
  storedProfileTs?: number;
  /** Fixes already in the trip before the replay begins. */
  history?: LocationSample[];
  /** One GPS position asked for at `at`, or null (indoors, or no fix in time). */
  positionAt?: (at: number) => LocationSample | null;
  /** Android alarms exist (T-295). False: every wait is a JavaScript timer. */
  alarms?: boolean;
  /** Whether a JavaScript timer fires with the app in the background. */
  timersRunInBackground?: boolean;
  /** An outing under way. */
  outing?: { startedTs: number };
  /** Whether the location task is registered (default true). */
  recording?: boolean;
  /** The provider refuses this change (T-173's foreground-service refusal). */
  refuse?: (profile: SamplingProfile, at: number) => boolean;
};

export type Replay = {
  /** Every profile the provider was asked for, in order. */
  changes: ProfileChange[];
  /** The diary, as `HH:MM:SS kind: detail` in UTC. */
  diary: string[];
  /** The profile `app_state` holds now. */
  storedProfile(): string | null;
  /** The profile the provider is on now. */
  providerProfile(): SamplingProfile | null;
  /** Run every event, and every alarm due before `until`. */
  run(events: ReplayEvent[], until?: number): Promise<void>;
  /** The recorder of the current process, for a test that drives it directly. */
  recorder(): Recorder;
  /** Set the clock (for a test that drives the recorder directly). */
  setNow(ms: number): void;
};

const clock = (ms: number) => new Date(ms).toISOString().slice(11, 19);

export function createReplay(options: ReplayOptions = {}): Replay {
  let now = 0;
  const state = new Map<string, { value: string; updatedTs: number }>();
  if (options.storedProfile) {
    state.set('profile', { value: options.storedProfile, updatedTs: options.storedProfileTs ?? 0 });
  }
  const fixes: LocationSample[] = [...(options.history ?? [])];
  const changes: ProfileChange[] = [];
  const diary: string[] = [];
  let providerProfile: SamplingProfile | null = options.storedProfile ?? null;
  type Pending = { due: number; run: () => Promise<void>; timer: boolean };
  const pending: Pending[] = [];
  const alarms = options.alarms ?? true;
  const timersRun = options.timersRunInBackground ?? false;

  // MotionWakeTaskConsumer.kt, its two gaps.
  const MIN_GAP_MS = 4 * 60_000;
  const STILL_GAP_MS = 10 * 60_000;
  let lastWakeMs = -Infinity;
  let lastStillWakeMs = -Infinity;
  let lastWasStill = false;

  const set = (key: string, value: string): void => {
    state.set(key, { value, updatedTs: now });
  };

  const deps: RecorderDeps = {
    now: () => now,
    state: {
      getProfile: async () => state.get('profile')?.value ?? null,
      setProfile: async (profile) => set('profile', profile),
      getProfileUpdatedTs: async () => state.get('profile')?.updatedTs ?? null,
      getStillCheck: async () => {
        const raw = state.get('still')?.value;
        if (raw === undefined) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      },
      setStillCheck: async (value) => set('still', JSON.stringify(value)),
      clearStillCheck: async () => set('still', ''),
    },
    trace: {
      getActiveTripId: async () => 1,
      getMovementWindow: async (_tripId, sinceTs, limit): Promise<MovementSample[]> =>
        fixes
          .filter((fix) => fix.ts >= sinceTs)
          .sort((a, b) => b.ts - a.ts)
          .slice(0, limit)
          .map((fix) => ({
            ts: fix.ts,
            lat: fix.lat,
            lon: fix.lon,
            accuracyM: fix.accuracyM,
            activity: fix.activityType,
          })),
      getLastFixTs: async () => (fixes.length === 0 ? null : Math.max(...fixes.map((fix) => fix.ts))),
    },
    provider: {
      isRecording: async () => options.recording ?? true,
      setSamplingProfile: async (profile) => {
        if (options.refuse?.(profile, now)) {
          throw new Error(`refused ${profile}`);
        }
        providerProfile = profile;
        changes.push({ at: now, profile });
      },
      currentPosition: async () => options.positionAt?.(now) ?? null,
    },
    outing: {
      readClock: async (nowMs): Promise<OutingClock> => ({
        inProgress: options.outing !== undefined,
        startedTs: options.outing?.startedTs ?? null,
        nowMs,
      }),
      getAwakeApplied: async () => options.outing !== undefined,
    },
    scheduleAlarm: (delayMs, followUp: FollowUp) => {
      if (!alarms) return false;
      // The alarm runs the motion task again, as the native side does.
      const step = followUpStep(followUp);
      pending.push({
        due: now + delayMs,
        run: () => current.onMotionWake({ source: 'follow_up', step }),
        timer: false,
      });
      return true;
    },
    setTimer: (delayMs, run) => {
      pending.push({ due: now + delayMs, run: async () => run(), timer: true });
    },
    batch: {
      store: async (samples) => {
        for (const sample of samples) {
          if (!fixes.some((fix) => fix.ts === sample.ts)) fixes.push(sample);
        }
      },
      noteLatest: async () => {},
      afterGate: async () => {},
    },
    diary: {
      log: async (kind, detail) => {
        diary.push(`${clock(now)} ${kind}: ${detail}`);
      },
      logError: async (where, error) => {
        diary.push(`${clock(now)} error: ${where}: ${error instanceof Error ? error.message : String(error)}`);
      },
    },
  };

  let current = createRecorder(deps);

  /** Alarms due by `until`; timers too when they run in the background. */
  async function runDue(until: number): Promise<void> {
    for (;;) {
      pending.sort((a, b) => a.due - b.due);
      const next = pending.find((item) => item.due <= until && (!item.timer || timersRun));
      if (next === undefined) return;
      pending.splice(pending.indexOf(next), 1);
      now = next.due;
      await next.run();
    }
  }

  /** The app comes to the front: overdue timers fire now, in order (React Native's resume). */
  async function runOverdueTimers(): Promise<void> {
    for (;;) {
      pending.sort((a, b) => a.due - b.due);
      const next = pending.find((item) => item.timer && item.due <= now);
      if (next === undefined) return;
      pending.splice(pending.indexOf(next), 1);
      await next.run();
    }
  }

  async function reassert(): Promise<void> {
    const profile = await current.settleLaunchProfile(now);
    providerProfile = profile;
    changes.push({ at: now, profile });
  }

  async function handle(event: ReplayEvent): Promise<void> {
    now = event.at;
    if (event.kind === 'batch') {
      await current.recordSamples(event.fixes);
    } else if (event.kind === 'significant_motion') {
      if (now - lastWakeMs < MIN_GAP_MS && !lastWasStill) return;
      lastWakeMs = now;
      lastWasStill = false;
      await current.onMotionWake({ source: 'significant_motion' });
    } else if (event.kind === 'label') {
      if (event.activity === 'still') {
        if (now - lastStillWakeMs < STILL_GAP_MS) return;
        lastStillWakeMs = now;
        lastWasStill = true;
        await current.onMotionWake({ source: 'activity', activity: 'still' });
        return;
      }
      if (now - lastWakeMs < MIN_GAP_MS && !lastWasStill) return;
      lastWakeMs = now;
      lastWasStill = false;
      await current.onMotionWake({ source: 'activity', activity: event.activity });
    } else if (event.kind === 'launch') {
      // A new process: what was in memory is gone, `app_state` and alarms stay.
      current = createRecorder(deps);
      for (let i = pending.length - 1; i >= 0; i -= 1) {
        if (pending[i].timer) pending.splice(i, 1);
      }
      await reassert();
    } else {
      // The same process: the re-assert runs on resume, and timers wake up.
      await reassert();
      await runOverdueTimers();
    }
  }

  return {
    changes,
    diary,
    storedProfile: () => state.get('profile')?.value ?? null,
    providerProfile: () => providerProfile,
    async run(events, until) {
      const ordered = [...events].sort((a, b) => a.at - b.at);
      for (const event of ordered) {
        await runDue(event.at);
        await handle(event);
      }
      await runDue(until ?? (ordered.length > 0 ? ordered[ordered.length - 1].at : now));
    },
    recorder: () => current,
    setNow: (ms) => {
      now = ms;
    },
  };
}
