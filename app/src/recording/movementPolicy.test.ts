/**
 * Tests for stationary-vs-moving gating (T-034).
 *
 *     cd app && npm test
 *
 * The asymmetry is the thing being pinned down here: one fix is enough to start
 * sampling properly, ten minutes of evidence are needed to stop. Getting that
 * backwards would lose the start of walks, which is trace nothing can recover.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { offsetByMetres } from './distance.ts';
import {
  decideProfile,
  MAX_TRUSTED_ACCURACY_M,
  MOVING_THRESHOLD_M,
  STATIONARY_WINDOW_MS,
  type MovementSample,
} from './movementPolicy.ts';

const ORIGIN = { lat: 32.65, lon: -16.9 };
const NOW = 1_800_000_000_000;

/** A fix `metres` north of the origin, `minutesAgo` before `NOW`. */
function fix(
  minutesAgo: number,
  metres: number,
  accuracyM: number | null = 10
): MovementSample {
  // These tests are about the decision, not about geometry, so they use the
  // app's own offset helper rather than an independent one. (The geofence
  // selection tests deliberately do the opposite — there the helper is the
  // oracle for the distance code under test, so it must not share an
  // implementation with it.)
  return { ...offsetByMetres(ORIGIN, metres, 0), ts: NOW - minutesAgo * 60_000, accuracyM };
}

/** A still phone reporting every minute for `minutes`, with GPS scatter. */
function stillFor(minutes: number): MovementSample[] {
  const samples: MovementSample[] = [];
  for (let i = 0; i <= minutes; i += 1) {
    // ±8 m of jitter, deterministic so the test cannot flake.
    samples.push(fix(i, (i % 3) * 8 - 8));
  }
  return samples;
}

// ---------------------------------------------------------------------------
// becoming moving — fast
// ---------------------------------------------------------------------------

test('one fix beyond the threshold is enough to start sampling properly', () => {
  const decision = decideProfile('stationary', [fix(1, 0), fix(0, 250)], NOW);

  assert.equal(decision.profile, 'walking');
  assert.equal(decision.changed, true);
  assert.match(decision.reason, /moved 2\d\d m/);
});

test('movement is detected without waiting for the full window', () => {
  // Two minutes of history. Nowhere near ten, and it does not matter.
  const decision = decideProfile('stationary', [fix(2, 0), fix(1, 90), fix(0, 400)], NOW);
  assert.equal(decision.profile, 'walking');
});

test('a walk out and back still reads as moving', () => {
  // Measured against the newest fix, so returning to the start does not look
  // like having never left.
  const decision = decideProfile(
    'stationary',
    [fix(20, 0), fix(10, 3000), fix(0, 0)],
    NOW
  );
  assert.equal(decision.profile, 'walking');
});

test('movement just under the threshold does not flip the profile', () => {
  const decision = decideProfile(
    'stationary',
    [fix(1, 0), fix(0, MOVING_THRESHOLD_M - 5)],
    NOW
  );
  assert.equal(decision.profile, 'stationary');
  assert.equal(decision.changed, false);
});

// ---------------------------------------------------------------------------
// becoming stationary — slow, and only on real evidence
// ---------------------------------------------------------------------------

test('ten minutes of stillness drops to the cheap profile', () => {
  const decision = decideProfile('walking', stillFor(12), NOW);

  assert.equal(decision.profile, 'stationary');
  assert.equal(decision.changed, true);
  // 10, not 12: only fixes inside the window are considered, so that is the
  // most history the reason can ever claim.
  assert.match(decision.reason, /within \d+ m for 10 min/);
});

test('a short pause does NOT drop to the cheap profile', () => {
  // Standing at a viewpoint for four minutes is not the same as having stopped
  // for the evening, and the walk usually continues.
  const decision = decideProfile('walking', stillFor(4), NOW);

  assert.equal(decision.profile, 'walking');
  assert.equal(decision.changed, false);
  assert.match(decision.reason, /need 10/);
});

test('the window must be exactly covered, not nearly', () => {
  const justShort = decideProfile('walking', stillFor(9), NOW);
  assert.equal(justShort.profile, 'walking');

  const justEnough = decideProfile('walking', stillFor(10), NOW);
  assert.equal(justEnough.profile, 'stationary');
});

test('fixes older than the window do not count towards covering it', () => {
  // One fix this morning and one now is not ten minutes of evidence, even
  // though the pair spans hours.
  const decision = decideProfile('walking', [fix(600, 0), fix(0, 5)], NOW);

  assert.equal(decision.profile, 'walking');
  assert.match(decision.reason, /history/);
});

test('silence is not stillness — a stale window keeps the current profile', () => {
  // Every fix is old. The service may be dead, and dropping to the cheap
  // profile would make that worse rather than better.
  const stale = stillFor(12).map((sample) => ({
    ...sample,
    ts: sample.ts - 3 * STATIONARY_WINDOW_MS,
  }));

  const decision = decideProfile('walking', stale, NOW);
  assert.equal(decision.profile, 'walking');
  assert.match(decision.reason, /min old/);
});

// ---------------------------------------------------------------------------
// noise
// ---------------------------------------------------------------------------

test('a wildly inaccurate fix cannot fake movement', () => {
  // Under canopy a fix can land 300 m away with a 500 m accuracy radius. It
  // says nothing about a 100 m question, so it is ignored.
  const decision = decideProfile(
    'stationary',
    [...stillFor(12), fix(0, 300, MAX_TRUSTED_ACCURACY_M + 400)],
    NOW
  );

  assert.equal(decision.profile, 'stationary');
});

test('fixes with no accuracy reported are trusted', () => {
  // Refusing them would mean ignoring every fix on a platform that omits the
  // field, which is worse than trusting them.
  const decision = decideProfile('stationary', [fix(1, 0, null), fix(0, 250, null)], NOW);
  assert.equal(decision.profile, 'walking');
});

test('an empty or unusable window changes nothing', () => {
  assert.equal(decideProfile('walking', [], NOW).profile, 'walking');
  assert.equal(decideProfile('stationary', [], NOW).profile, 'stationary');

  const allNoise = [fix(1, 0, 5000), fix(0, 400, 5000)];
  assert.equal(decideProfile('walking', allNoise, NOW).profile, 'walking');
  assert.equal(decideProfile('walking', allNoise, NOW).changed, false);
});

test('the driving profile is left alone by the gate, not silently corrected', () => {
  // The gate only ever chooses between stationary and the single moving
  // profile (D-028). A manually selected `driving` gives way the moment there
  // is real evidence either way, which is the honest behaviour: the gate owns
  // the profile, and T-034a is where driving comes back.
  const moving = decideProfile('driving', [fix(1, 0), fix(0, 400)], NOW);
  assert.equal(moving.profile, 'walking');
  assert.equal(moving.changed, true);

  const noEvidence = decideProfile('driving', [], NOW);
  assert.equal(noEvidence.profile, 'driving');
});
