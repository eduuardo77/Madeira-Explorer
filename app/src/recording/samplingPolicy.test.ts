/**
 * Tests for how long fixes may be held before the app sees them (F1, 2026-10-11).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { deferralFor, getSamplingParameters } from './samplingPolicy.ts';

test('on Android the stationary profile hands over every fix: the hold hid a drive (F1)', () => {
  assert.deepEqual(deferralFor('android', 'stationary', getSamplingParameters('stationary')), {
    intervalMs: 0,
    distanceM: 0,
  });
});

test('the moving profiles keep their hold, and iOS keeps every hold', () => {
  for (const profile of ['walking', 'driving'] as const) {
    const parameters = getSamplingParameters(profile);
    assert.deepEqual(deferralFor('android', profile, parameters), {
      intervalMs: parameters.deferredIntervalMs,
      distanceM: parameters.deferredDistanceM,
    });
  }
  const stationary = getSamplingParameters('stationary');
  assert.equal(deferralFor('ios', 'stationary', stationary).intervalMs, stationary.deferredIntervalMs);
});
