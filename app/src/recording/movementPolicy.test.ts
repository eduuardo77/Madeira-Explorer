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
  MAX_TRUSTED_ACCURACY_M,
  MOVING_THRESHOLD_M,
  STATIONARY_WINDOW_MS,
  VEHICLE_SPEED_MPS,
  decideProfile,
  fastestSustainedSpeedMps,
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

test('a drive samples at the driving rate, a walk never does', () => {
  // ⚠ THE ASYMMETRY THAT MAKES THIS SAFE WITHOUT FIELD DATA. 7 m/s is 25 km/h.
  // A tourist walking a levada cannot sustain that for a minute, so a pedestrian
  // can never be mistaken for a car — only a car can be mistaken for a walker,
  // and that costs a coarser trace, which is exactly what we have today.

  // Two minutes, 1.2 km apart: 10 m/s, 36 km/h. A car on the ER101.
  const driving = decideProfile('walking', [fix(0, 0), fix(2, 1200)], NOW);
  assert.equal(driving.profile, 'driving');
  assert.match(driving.reason, /km\/h/);

  // Ten minutes, 700 m: 1.2 m/s. A brisk walk, and it stays on the walking
  // profile even though it comfortably clears the moving threshold.
  const walking = decideProfile('walking', [fix(0, 0), fix(10, 700)], NOW);
  assert.equal(walking.profile, 'walking');
});

test('slow town driving falls through to the walking profile, deliberately', () => {
  // D-028's point, unchanged: Funchal traffic and Madeira's gradients compress
  // driving into walking speeds. This does not try to catch that case — it
  // catches the one where the *trace* would be visibly under-sampled, and slow
  // driving is not that case. Five minutes for 900 m is 3 m/s, 10.8 km/h.
  assert.equal(
    decideProfile('walking', [fix(0, 0), fix(5, 900)], NOW).profile,
    'walking'
  );
});

test('two noisy fixes close together cannot invent a car', () => {
  // ⚠ The failure this exists to stop. The accuracy filter admits fixes up to
  // 100 m, and two of those a few seconds apart can show a speed nobody
  // travelled — which would put a standing user on the most expensive profile
  // and be very hard to find later. Pairs closer than a minute are not used.
  const noise: MovementSample[] = [
    { ...offsetByMetres(ORIGIN, 0, 0), ts: NOW, accuracyM: 90 },
    { ...offsetByMetres(ORIGIN, 300, 0), ts: NOW - 10_000, accuracyM: 90 },
  ];
  // 300 m in 10 s is 30 m/s, and it is ignored: the gap is under a minute. The
  // displacement still counts as movement, so the profile is the walking one.
  assert.equal(fastestSustainedSpeedMps(noise), 0);
  assert.equal(decideProfile('walking', noise, NOW).profile, 'walking');
});

test('a stop in the middle does not hide the drive that surrounds it', () => {
  // Pairwise rather than window-average, and this is why: a drive with a stop
  // at a miradouro averages out to walking pace over the window, and the drive
  // still happened.
  // Parked at the origin until 8 minutes ago, drove 2 km over the next two
  // minutes (16.7 m/s), parked again. Averaged over the window that is under
  // 4 m/s and reads as a walk; pairwise it is plainly a car.
  const droveThenStopped = [fix(10, 0), fix(8, 0), fix(6, 2000), fix(0, 2000)];
  assert.ok(fastestSustainedSpeedMps(droveThenStopped) >= VEHICLE_SPEED_MPS);
});
