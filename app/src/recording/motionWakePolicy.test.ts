/**
 * Tests for when the motion wake looks for a position (D-106).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideStillCheck,
  LAUNCH_FRESH_FIX_MS,
  launchProfile,
  nextWakeCheck,
  STILL_CHECK_LATE_MS,
  STILL_CHECK_WAIT_MS,
  WAKE_CHECK_WAITS_MS,
} from './motionWakePolicy.ts';
import type { MovementSample } from './movementPolicy.ts';

test('a wake looks at once, then twice more 90 s apart, then stops', () => {
  const waits = [0, 1, 2, 3].map((index) => nextWakeCheck(index, 'stationary'));
  assert.deepEqual(waits, [0, 90_000, 90_000, null]);
  assert.equal(WAKE_CHECK_WAITS_MS.length, 3);
});

test('a wake stops as soon as the recorder has left the stationary profile', () => {
  for (const profile of ['walking', 'driving'] as const) {
    assert.equal(nextWakeCheck(0, profile), null, profile);
    assert.equal(nextWakeCheck(1, profile), null, profile);
  }
});

// T-286: a stop that begins on driving. The 26 Oct 2026 sit-down, 17:49.
const T0 = Date.UTC(2026, 9, 26, 17, 49);
/** A fix `metresNorth` from the first, `minutes` after it. */
function at(minutes: number, metresNorth = 0, accuracyM: number | null = 15): MovementSample {
  return { lat: 32.65 + metresNorth / 111_320, lon: -16.95, ts: T0 + minutes * 60_000, accuracyM };
}

/** The check as `runStillCheck` calls it: woken at T0, deciding `waitedMin` later. */
function check(
  current: Parameters<typeof decideStillCheck>[0],
  first: MovementSample | null,
  second: MovementSample | null,
  movingMs: number | null,
  waitedMin = 5
) {
  return decideStillCheck(current, first, second, movingMs, T0, T0 + waitedMin * 60_000);
}

test('still check: a phone still on driving for five minutes sleeps', () => {
  const result = check('driving', at(0), at(5, 20), null);
  assert.equal(result.sleep, true);
  assert.match(result.reason, /within 20 m for 5 min/);
  assert.equal(check('walking', at(0), at(5), null).sleep, true);
});

test('still check: it waits as long as the still rule in the gate', () => {
  assert.equal(STILL_CHECK_WAIT_MS, 5 * 60_000);
  assert.equal(check('driving', at(0), at(4.9), null).sleep, false);
});

test('still check: doubt about the positions keeps the profile', () => {
  const cases: [string, ReturnType<typeof decideStillCheck>][] = [
    ['moved', check('driving', at(0), at(5, 150), null)],
    ['rough', check('driving', at(0), at(5, 0, 250), null)],
    ['moving since', check('driving', at(0), at(5), T0 + 60_000)],
    ['stationary', check('stationary', at(0), at(5), null)],
  ];
  for (const [name, result] of cases) assert.equal(result.sleep, false, name);
});

test('still check: no position indoors after the sensors said still counts as still (N15)', () => {
  // The P30, 27 Oct 2026: indoors, no GPS position within the wait, twice.
  for (const [name, first, second] of [
    ['neither', null, null],
    ['no first', null, at(5)],
    ['no second', at(0), null],
  ] as const) {
    const result = check('driving', first, second, null);
    assert.equal(result.sleep, true, name);
    assert.match(result.reason, /no position/, name);
  }
});

test('still check: no position still waits the five minutes, and a moving label keeps it', () => {
  assert.equal(check('driving', null, null, null, 4).sleep, false);
  assert.equal(check('driving', null, null, T0 + 60_000).sleep, false);
  assert.equal(check('stationary', null, null, null).sleep, false);
});

test('still check: a moving label before the wake does not count', () => {
  assert.equal(check('driving', at(0), at(5), T0 - 60_000).sleep, true);
  assert.equal(check('driving', null, null, T0 - 60_000).sleep, true);
});

test('still check: a fix with no accuracy is trusted, as in the gate', () => {
  assert.equal(check('driving', at(0, 0, null), at(5, 0, null), null).sleep, true);
});

// N15: the profile a launch restarts the recorder on.
const NOW = Date.UTC(2026, 9, 26, 20, 41);

test('a restart at home after a drive begins on stationary (N15)', () => {
  // The P30: installed at 20:37 on stored *driving*, last fix at 18:53.
  const lastFix = Date.UTC(2026, 9, 26, 18, 53);
  const result = launchProfile('driving', lastFix, NOW);
  assert.equal(result.profile, 'stationary');
  assert.match(result.reason, /108 min ago/);
  assert.equal(launchProfile('walking', lastFix, NOW).profile, 'stationary');
  assert.equal(launchProfile('driving', null, NOW).profile, 'stationary');
});

test('an app opened mid-drive keeps its moving profile', () => {
  assert.equal(launchProfile('driving', NOW - 20_000, NOW).profile, null);
  assert.equal(launchProfile('driving', NOW - LAUNCH_FRESH_FIX_MS, NOW).profile, null);
  assert.equal(launchProfile('driving', NOW - LAUNCH_FRESH_FIX_MS - 1, NOW).profile, 'stationary');
});

test('a stationary or a fresh install is left as it is', () => {
  assert.equal(launchProfile('stationary', null, NOW).profile, null);
  // Nothing stored: somebody who has just landed (samplingGate's default).
  assert.equal(launchProfile(null, null, NOW).profile, null);
});

test('still check: a check whose timer froze with the process stays (T-294)', () => {
  // 30 Oct 2026: begun at 16:10 on driving, decided at 17:42 when the app opened.
  const late = check('driving', null, null, null, 91);
  assert.equal(late.sleep, false);
  assert.match(late.reason, /91 min after the wake/);
  assert.equal(check('driving', at(0), at(91), null, 91).sleep, false);
  // Up to the limit it still decides as before.
  assert.equal(STILL_CHECK_LATE_MS, 10 * 60_000);
  assert.equal(check('driving', null, null, null, 9).sleep, true);
});

// --- T-295: waits kept by an alarm

import {
  canStartStillCheck,
  followUpStep,
  parseFollowUp,
  parsePendingStillCheck,
} from './motionWakePolicy.ts';

test('a follow-up step survives the trip through the native side', () => {
  for (const followUp of [{ kind: 'look', index: 1 }, { kind: 'look', index: 2 }, { kind: 'still' }] as const) {
    assert.deepEqual(parseFollowUp(followUpStep(followUp)), followUp);
  }
});

test('an unexpected step is ignored, not guessed', () => {
  for (const step of [undefined, null, '', 'look', 'look:0', 'look:3', 'look:x', 'still ', 7]) {
    assert.equal(parseFollowUp(step), null, String(step));
  }
});

test('every wake look after the first has a step', () => {
  for (let index = 1; index < WAKE_CHECK_WAITS_MS.length; index += 1) {
    assert.deepEqual(parseFollowUp(`look:${index}`), { kind: 'look', index });
  }
});

test('a stored still check reads back, first position included', () => {
  const first = { ts: 1000, lat: 32.6, lon: -16.9, accuracyM: 12 };
  assert.deepEqual(parsePendingStillCheck({ wakeMs: 900, first }), { wakeMs: 900, first });
  assert.deepEqual(parsePendingStillCheck({ wakeMs: 900, first: null }), { wakeMs: 900, first: null });
  assert.deepEqual(parsePendingStillCheck({ wakeMs: 900 }), { wakeMs: 900, first: null });
  assert.deepEqual(
    parsePendingStillCheck({ wakeMs: 900, first: { ts: 1000, lat: 32.6, lon: -16.9 } }),
    { wakeMs: 900, first: { ts: 1000, lat: 32.6, lon: -16.9, accuracyM: null } }
  );
});

test('a broken or cleared row is no check at all', () => {
  for (const raw of [null, '', 'x', 5, {}, { wakeMs: 'soon' }, { wakeMs: Number.NaN }]) {
    assert.equal(parsePendingStillCheck(raw), null, JSON.stringify(raw));
  }
  // A first position without coordinates is no first position.
  assert.deepEqual(parsePendingStillCheck({ wakeMs: 1, first: { ts: 2 } }), { wakeMs: 1, first: null });
});

test('a still check under way blocks another, but not forever (31 Oct)', () => {
  const wakeMs = 1_000_000;
  assert.equal(canStartStillCheck(null, wakeMs), true);
  const pending = { wakeMs, first: null };
  assert.equal(canStartStillCheck(pending, wakeMs + 60_000), false);
  assert.equal(canStartStillCheck(pending, wakeMs + STILL_CHECK_LATE_MS), false);
  assert.equal(canStartStillCheck(pending, wakeMs + STILL_CHECK_LATE_MS + 1), true);
  // 09:00 to 11:42 on the P30: the morning's only check would now be replaced.
  assert.equal(canStartStillCheck(pending, wakeMs + 162 * 60_000), true);
});

// --- T-296: one "in a vehicle" guess is not a drive

import { confirmsDriving, DRIVING_CONFIRM_WINDOW_MS } from './motionWakePolicy.ts';

test('one driving label alone does not raise a walk (31 Oct, floor -1)', () => {
  const now = 10_000_000;
  assert.equal(confirmsDriving(null, 'driving', now), false);
  assert.equal(confirmsDriving({ activity: 'walking', ts: now - 4 * 60_000 }, 'driving', now), false);
  assert.equal(confirmsDriving({ activity: 'still', ts: now - 4 * 60_000 }, 'driving', now), false);
});

test('a second driving label within the window raises it', () => {
  const now = 10_000_000;
  assert.equal(confirmsDriving({ activity: 'driving', ts: now - 4 * 60_000 }, 'driving', now), true);
  assert.equal(confirmsDriving({ activity: 'driving', ts: now - DRIVING_CONFIRM_WINDOW_MS }, 'driving', now), true);
});

test('an old driving label, or one from the future, confirms nothing', () => {
  const now = 10_000_000;
  assert.equal(confirmsDriving({ activity: 'driving', ts: now - DRIVING_CONFIRM_WINDOW_MS - 1 }, 'driving', now), false);
  assert.equal(confirmsDriving({ activity: 'driving', ts: now + 1 }, 'driving', now), false);
});

test('the window holds the next label the native side can pass', () => {
  // MIN_GAP_MS in MotionWakeTaskConsumer.kt is 4 min, labels come every 30 s.
  assert.ok(DRIVING_CONFIRM_WINDOW_MS >= 4 * 60_000 + 30_000);
});

test('only a driving label is raised', () => {
  const now = 10_000_000;
  for (const activity of ['walking', 'running', 'cycling', 'still']) {
    assert.equal(confirmsDriving({ activity: 'driving', ts: now - 60_000 }, activity, now), false, activity);
  }
});
