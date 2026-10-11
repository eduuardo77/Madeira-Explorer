/**
 * Tests for the profiles as Android runs them (F1, 2026-10-11).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { forPlatform, getSamplingParameters } from './samplingPolicy.ts';
import { scaleForQuality } from './trackingPreference.ts';

test('on Android the stationary profile hands over every fix and asks for the GPS (F1)', () => {
  const adjusted = forPlatform('android', 'stationary', getSamplingParameters('stationary'));
  assert.equal(adjusted.deferredIntervalMs, 0);
  assert.equal(adjusted.deferredDistanceM, 0);
  assert.equal(adjusted.desiredAccuracy, 'high');
  // Its interval and distance are its own: still a fix at most every 5 min and 100 m.
  assert.equal(adjusted.minTimeMs, getSamplingParameters('stationary').minTimeMs);
});

test('every tier, the cheapest included, gets the GPS while stationary on Android', () => {
  for (const tier of ['saver', 'balanced', 'precise'] as const) {
    const scaled = scaleForQuality(getSamplingParameters('stationary'), tier);
    assert.equal(forPlatform('android', 'stationary', scaled).desiredAccuracy, 'high', tier);
  }
});

test('on Android the moving profiles ask for the GPS in every tier and keep their hold', () => {
  for (const profile of ['walking', 'driving'] as const) {
    for (const tier of ['saver', 'balanced', 'precise'] as const) {
      const scaled = scaleForQuality(getSamplingParameters(profile), tier);
      assert.deepEqual(forPlatform('android', profile, scaled), { ...scaled, desiredAccuracy: 'high' }, `${profile} ${tier}`);
    }
  }
});

test('iOS is left as it is', () => {
  for (const profile of ['stationary', 'walking', 'driving'] as const) {
    const parameters = getSamplingParameters(profile);
    assert.deepEqual(forPlatform('ios', profile, parameters), parameters);
  }
});
