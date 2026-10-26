/**
 * Tests for when the motion wake looks for a position (D-106).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideStillCheck,
  nextWakeCheck,
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

test('still check: a phone still on driving for five minutes sleeps', () => {
  const check = decideStillCheck('driving', at(0), at(5, 20), null);
  assert.equal(check.sleep, true);
  assert.match(check.reason, /within 20 m for 5 min/);
  assert.equal(decideStillCheck('walking', at(0), at(5), null).sleep, true);
});

test('still check: it waits as long as the still rule in the gate', () => {
  assert.equal(STILL_CHECK_WAIT_MS, 5 * 60_000);
  assert.equal(decideStillCheck('driving', at(0), at(4.9), null).sleep, false);
});

test('still check: any doubt keeps the profile', () => {
  const cases: [string, ReturnType<typeof decideStillCheck>][] = [
    ['moved', decideStillCheck('driving', at(0), at(5, 150), null)],
    ['no first', decideStillCheck('driving', null, at(5), null)],
    ['no second', decideStillCheck('driving', at(0), null, null)],
    ['rough', decideStillCheck('driving', at(0), at(5, 0, 250), null)],
    ['moving since', decideStillCheck('driving', at(0), at(5), T0 + 60_000)],
    ['stationary', decideStillCheck('stationary', at(0), at(5), null)],
  ];
  for (const [name, check] of cases) assert.equal(check.sleep, false, name);
});

test('still check: a moving label before the first position does not count', () => {
  assert.equal(decideStillCheck('driving', at(0), at(5), T0 - 60_000).sleep, true);
});

test('still check: a fix with no accuracy is trusted, as in the gate', () => {
  assert.equal(decideStillCheck('driving', at(0, 0, null), at(5, 0, null), null).sleep, true);
});
