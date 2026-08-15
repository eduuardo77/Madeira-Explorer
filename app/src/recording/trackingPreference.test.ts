/**
 * Tests for the tracking preferences (T-146).
 *
 *     cd app && npm test
 *
 * Two things are pinned here that are easy to break by accident: an
 * unrecognised stored value must never leave the recorder in a worse state than
 * a fresh install, and the three tiers must stay *ordered*. A settings screen
 * offering three choices where two behave the same is worse than offering one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SAMPLING_PROFILES } from './samplingPolicy.ts';
import {
  DEFAULT_BACKGROUND_TRACKING,
  DEFAULT_TRACKING_QUALITY,
  parseBackgroundTracking,
  parseTrackingQuality,
  scaleForQuality,
  TRACKING_QUALITIES,
} from './trackingPreference.ts';

test('a stored tier round-trips', () => {
  for (const quality of TRACKING_QUALITIES) {
    assert.equal(parseTrackingQuality(quality), quality);
  }
});

test('rubbish falls back to the default rather than throwing', () => {
  for (const raw of [null, '', '   ', 'HIGH', 'best', 'undefined', '3%']) {
    assert.equal(parseTrackingQuality(raw), DEFAULT_TRACKING_QUALITY);
  }
});

test('the default tier is the one that works, not the cheapest', () => {
  // ⚠ If this ever becomes `saver`, read the reasoning in the module first: a
  // user who never opens settings would get the app's only promise delivered
  // at its coarsest.
  assert.equal(DEFAULT_TRACKING_QUALITY, 'balanced');
});

test('background recording is off only when it says so explicitly', () => {
  assert.equal(parseBackgroundTracking('false'), false);
  assert.equal(parseBackgroundTracking('0'), false);

  // ⚠ Everything else, including unreadable values, is the default. A
  // preference the app cannot parse must not silently opt the user out of the
  // feature they installed it for.
  for (const raw of [null, '', 'true', 'yes', 'nonsense']) {
    assert.equal(parseBackgroundTracking(raw), DEFAULT_BACKGROUND_TRACKING);
  }
});

test('balanced changes nothing at all', () => {
  // The middle tier is the profile table as authored. If this drifts, every
  // number in `samplingPolicy` quietly means something else.
  for (const profile of Object.values(SAMPLING_PROFILES)) {
    assert.deepEqual(scaleForQuality(profile, 'balanced'), profile);
  }
});

test('⚠ the tiers are strictly ordered, or the setting is a lie', () => {
  for (const profile of Object.values(SAMPLING_PROFILES)) {
    const saver = scaleForQuality(profile, 'saver');
    const balanced = scaleForQuality(profile, 'balanced');
    const precise = scaleForQuality(profile, 'precise');

    // Longer gaps mean fewer fixes mean less battery. Every gap moves the same
    // way, so no tier is cheaper in one dimension and dearer in another.
    assert.ok(saver.minTimeMs > balanced.minTimeMs);
    assert.ok(balanced.minTimeMs > precise.minTimeMs);
    assert.ok(saver.minDistanceM > balanced.minDistanceM);
    assert.ok(balanced.minDistanceM > precise.minDistanceM);
    assert.ok(saver.deferredIntervalMs > balanced.deferredIntervalMs);
    assert.ok(balanced.deferredIntervalMs > precise.deferredIntervalMs);
  }
});

test('the cheap tier asks the GPS chip for as little as possible', () => {
  const walking = SAMPLING_PROFILES.walking;

  assert.equal(scaleForQuality(walking, 'saver').desiredAccuracy, 'coarse');
  assert.equal(scaleForQuality(walking, 'saver').pauseWhenStationary, true);

  // And the expensive one keeps the line unbroken through a long stop, which
  // is most of why it costs what it costs.
  assert.equal(scaleForQuality(walking, 'precise').desiredAccuracy, 'high');
  assert.equal(scaleForQuality(walking, 'precise').pauseWhenStationary, false);
});

test('no tier can ask for a busy loop', () => {
  // A future profile with smaller values must not multiply down to zero.
  const tiny = {
    minTimeMs: 1000,
    minDistanceM: 1,
    desiredAccuracy: 'high' as const,
    deferredIntervalMs: 1000,
    deferredDistanceM: 1,
    pauseWhenStationary: false,
  };

  const precise = scaleForQuality(tiny, 'precise');
  assert.ok(precise.minTimeMs >= 10_000);
  assert.ok(precise.minDistanceM >= 5);
  assert.ok(precise.deferredIntervalMs >= 30_000);
});

test('the profile table is never mutated', () => {
  const before = JSON.stringify(SAMPLING_PROFILES.driving);
  scaleForQuality(SAMPLING_PROFILES.driving, 'saver');
  assert.equal(JSON.stringify(SAMPLING_PROFILES.driving), before);
});
