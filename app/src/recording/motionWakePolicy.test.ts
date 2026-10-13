/**
 * Tests for when the motion wake looks for a position (D-106).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { nextWakeCheck, WAKE_CHECK_WAITS_MS } from './motionWakePolicy.ts';

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
