/**
 * Tests for the profiles as Android runs them (F1, 2026-10-11).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ANDROID_STATIONARY_INTERVAL_MS, forPlatform, getSamplingParameters } from './samplingPolicy.ts';

test('on Android the stationary profile hands over every fix, from the GPS at most every 10 minutes (F1)', () => {
  const adjusted = forPlatform('android', 'stationary', getSamplingParameters('stationary'));
  assert.equal(adjusted.deferredIntervalMs, 0);
  assert.equal(adjusted.deferredDistanceM, 0);
  // The GPS: Wi-Fi and cell missed a whole drive (12 Oct). Every 10 minutes, not 5:
  // 38 GPS starts in a night drew Huawei's battery warning.
  assert.equal(adjusted.desiredAccuracy, 'high');
  assert.equal(adjusted.minTimeMs, ANDROID_STATIONARY_INTERVAL_MS);
});

test('on Android the moving profiles ask for the GPS and keep their hold', () => {
  for (const profile of ['walking', 'driving'] as const) {
    const parameters = getSamplingParameters(profile);
    assert.deepEqual(forPlatform('android', profile, parameters), { ...parameters, desiredAccuracy: 'high' }, profile);
  }
});

test('iOS is left as it is', () => {
  for (const profile of ['stationary', 'walking', 'driving'] as const) {
    const parameters = getSamplingParameters(profile);
    assert.deepEqual(forPlatform('ios', profile, parameters), parameters);
  }
});

test('with a motion wake, the stationary profile asks for Wi-Fi and cell only, no GPS (rule 4)', () => {
  const parameters = getSamplingParameters('stationary');
  const adjusted = forPlatform('android', 'stationary', parameters, true);
  assert.equal(adjusted.desiredAccuracy, 'balanced');
  assert.equal(adjusted.deferredIntervalMs, 0);
  assert.equal(adjusted.minTimeMs, parameters.minTimeMs);
});

test('the motion wake changes nothing while moving, and nothing on iOS', () => {
  for (const profile of ['walking', 'driving'] as const) {
    const parameters = getSamplingParameters(profile);
    assert.deepEqual(forPlatform('android', profile, parameters, true), forPlatform('android', profile, parameters, false));
  }
  const stationary = getSamplingParameters('stationary');
  assert.deepEqual(forPlatform('ios', 'stationary', stationary, true), stationary);
});
