/**
 * Tests for the home map's progress strip (D-090).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { homeProgress } from './homeProgress.ts';

test('the strip shows at zero, because that is who it is for', () => {
  // The second review's N1: a new visitor at 0 stamps saw nothing to collect.
  assert.deepEqual(homeProgress({ collected: 0, total: 80 }), {
    collected: 0,
    total: 80,
    fraction: 0,
  });
});

test('the bar fills in proportion to the count', () => {
  assert.equal(homeProgress({ collected: 20, total: 80 })?.fraction, 0.25);
  assert.equal(homeProgress({ collected: 80, total: 80 })?.fraction, 1);
});

test('no strip when there is nothing to count', () => {
  // `0 / 0` reads as an error, not as a start.
  assert.equal(homeProgress({ collected: 0, total: 0 }), null);
  assert.equal(homeProgress({ collected: 3, total: -1 }), null);
  assert.equal(homeProgress({ collected: 3, total: Number.NaN }), null);
});

test('the bar never runs past its track, and never goes negative', () => {
  // A place cut from the pack stays collected (D-075), so for a moment the
  // count can exceed the total.
  assert.deepEqual(homeProgress({ collected: 83, total: 80 }), {
    collected: 80,
    total: 80,
    fraction: 1,
  });
  assert.equal(homeProgress({ collected: -2, total: 80 })?.fraction, 0);
  assert.equal(homeProgress({ collected: Number.NaN, total: 80 })?.collected, 0);
});
