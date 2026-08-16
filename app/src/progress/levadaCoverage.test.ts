/**
 * Tests for coverage crediting (D-065, T-068).
 *
 *     cd app && npm test
 *
 * What is being pinned down is the *shape of the generosity*: which honest
 * walks get credited that the two-endpoint rule would have refused, and which
 * dishonest ones still fail. The four cases in the module header — out and
 * back, a lost crossing, a skipped section, a levada that is really a network
 * — each have a test here, because each is somebody's afternoon.
 *
 * Coordinates are synthetic and deliberately not Madeira: no island knowledge
 * belongs in `app/` (D-017), and a straight line at a known latitude is easier
 * to reason about in metres.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CORRIDOR_M,
  computeCoverage,
  judgeCoverage,
  MAX_USABLE_ACCURACY_M,
  WALKED_ABSOLUTE_M,
  type CoursePoint,
  type TraceFix,
} from './levadaCoverage.ts';

/** Degrees of longitude per metre at latitude 32.7, near enough. */
const LON_PER_M = 1 / (111_320 * Math.cos((32.7 * Math.PI) / 180));
const LAT_PER_M = 1 / 110_540;

/** A course running due east from the origin, `metres` long, as one line. */
function straightCourse(metres: number, step = 50): CoursePoint[] {
  const points: CoursePoint[] = [];
  for (let d = 0; d <= metres; d += step) {
    points.push([-17 + d * LON_PER_M, 32.7]);
  }
  return points;
}

/**
 * Someone walking that course from `fromM` to `toM` at 1 m/s, one fix every
 * 20 seconds, `offsetM` to the side of the line.
 */
function walk(
  fromM: number,
  toM: number,
  { offsetM = 0, paceMps = 1, startTs = 1_800_000_000_000, accuracy = 10 } = {}
): TraceFix[] {
  const fixes: TraceFix[] = [];
  const stepM = paceMps * 20;
  for (let d = fromM; d <= toM; d += stepM) {
    fixes.push({
      ts: startTs + ((d - fromM) / paceMps) * 1000,
      lat: 32.7 + offsetM * LAT_PER_M,
      lon: -17 + d * LON_PER_M,
      accuracy_m: accuracy,
    });
  }
  return fixes;
}

test('walking the whole course credits it', () => {
  const coverage = computeCoverage([straightCourse(2000)], walk(0, 2000));
  assert.ok(coverage.fraction > 0.95, `fraction ${coverage.fraction}`);
  assert.equal(judgeCoverage(coverage).credited, true);
});

test('out and back credits it — the case the two-endpoint rule cannot see', () => {
  // Park at one end, walk 1.2 km of a 2 km levada, come back the same way.
  // The far trailhead is never reached, so `stampRules` would refuse this.
  const there = walk(0, 1200);
  const back = walk(0, 1200, { startTs: 1_800_000_000_000 + 1_300_000 }).reverse();
  const coverage = computeCoverage([straightCourse(2000)], [...there, ...back]);

  assert.ok(coverage.fraction >= 0.6, `fraction ${coverage.fraction}`);
  assert.equal(judgeCoverage(coverage).credited, true);
});

test('a skipped section still credits — walkers detour', () => {
  // 700 m missing in the middle: a closure, a shuttle, a stretch on the road.
  const coverage = computeCoverage(
    [straightCourse(3000)],
    [...walk(0, 1200), ...walk(1900, 3000, { startTs: 1_800_000_000_000 + 2_000_000 })]
  );
  assert.ok(coverage.fraction >= 0.6, `fraction ${coverage.fraction}`);
  assert.equal(judgeCoverage(coverage).credited, true);
});

test('a levada that is really a network credits on absolute distance', () => {
  // 30 km of drawn ways sharing one name; the user walks 3.5 km of it. A
  // fraction gate would make this stamp unearnable — which is what Levada do
  // Norte (40 km) and Levada dos Tornos (36 km) actually are.
  const coverage = computeCoverage([straightCourse(30_000, 100)], walk(0, 3500));
  assert.ok(coverage.fraction < 0.2, `fraction ${coverage.fraction}`);
  assert.ok(coverage.coveredM >= 3000, `covered ${coverage.coveredM}`);
  assert.equal(judgeCoverage(coverage).credited, true);
});

test('driving the road beside the levada does not credit it', () => {
  // Same ground, forty times the speed. This is the ordinary case on this
  // island, not an exotic one — the road runs above the channel for kilometres.
  const coverage = computeCoverage(
    [straightCourse(3000)],
    walk(0, 3000, { paceMps: 14, offsetM: 25 })
  );
  const verdict = judgeCoverage(coverage);
  assert.equal(verdict.credited, false);
  assert.equal(verdict.offerConfirmation, false);
  assert.match(verdict.reason, /too fast/);
});

test('a walk in the next valley covers nothing', () => {
  const coverage = computeCoverage([straightCourse(2000)], walk(0, 2000, { offsetM: 800 }));
  assert.equal(coverage.coveredM, 0);
  assert.equal(coverage.fixesOnCourse, 0);
  assert.equal(judgeCoverage(coverage).credited, false);
});

test('a fix admitting 50 m of doubt is still placed on the path', () => {
  // Under canopy this is what the fixes look like, and holding them to the
  // bare corridor would refuse the walks this module exists for.
  const wide = computeCoverage(
    [straightCourse(2000)],
    walk(0, 2000, { offsetM: CORRIDOR_M + 30, accuracy: 50 })
  );
  assert.ok(wide.fraction > 0.9, `fraction ${wide.fraction}`);

  // …but the same offset with a fix claiming to be precise is not on the path.
  const precise = computeCoverage(
    [straightCourse(2000)],
    walk(0, 2000, { offsetM: CORRIDOR_M + 30, accuracy: 5 })
  );
  assert.equal(precise.coveredM, 0);
});

test('a fix too vague to place is not evidence of anything', () => {
  const coverage = computeCoverage(
    [straightCourse(2000)],
    walk(0, 2000, { accuracy: MAX_USABLE_ACCURACY_M + 1 })
  );
  assert.equal(coverage.fixesOnCourse, 0);
});

test('standing still all day covers no more ground than passing does', () => {
  const still: TraceFix[] = [];
  for (let i = 0; i < 500; i += 1) {
    still.push({ ts: 1_800_000_000_000 + i * 60_000, lat: 32.7, lon: -17, accuracy_m: 8 });
  }
  const coverage = computeCoverage([straightCourse(2000)], still);
  assert.ok(coverage.coveredM <= 100, `covered ${coverage.coveredM}`);
  assert.equal(judgeCoverage(coverage).credited, false);
});

test('a third of the walk is offered for confirmation, not awarded', () => {
  const coverage = computeCoverage([straightCourse(3000)], walk(0, 1100));
  const verdict = judgeCoverage(coverage);
  assert.equal(verdict.credited, false);
  assert.equal(verdict.offerConfirmation, true);
  assert.match(verdict.reason, /enough to ask/);
});

test('a few metres at the trailhead is neither awarded nor asked about', () => {
  const coverage = computeCoverage([straightCourse(3000)], walk(0, 120));
  const verdict = judgeCoverage(coverage);
  assert.equal(verdict.credited, false);
  assert.equal(verdict.offerConfirmation, false);
});

test('every refusal explains itself in words a person could be shown', () => {
  const cases = [
    computeCoverage([straightCourse(2000)], []),
    computeCoverage([straightCourse(2000)], walk(0, 120)),
    computeCoverage([straightCourse(2000)], walk(0, 2000, { paceMps: 14 })),
  ];
  for (const coverage of cases) {
    const verdict = judgeCoverage(coverage);
    assert.ok(verdict.reason.length > 10, verdict.reason);
    assert.doesNotMatch(verdict.reason, /undefined|NaN/);
  }
});

test('the course is measured, not assumed — an empty course credits nothing', () => {
  const coverage = computeCoverage([], walk(0, 2000));
  assert.equal(coverage.courseM, 0);
  assert.equal(coverage.fraction, 0);
  assert.equal(judgeCoverage(coverage).credited, false);
});

test('a there-and-back that turns round at the waterfall counts (PR18)', () => {
  // ⚠ The first real walk this project has field data from. Levada do Rei,
  // 2026-08-16: the project lead walked out to a waterfall, decided that was
  // the good bit, and came back. They never reached the far end of the mapped
  // course — and the 60% bar would have refused a two-hour levada walk.
  const course = [straightCourse(5000, 100)];
  const out = walk(0, 2000, { paceMps: 0.9 });
  const back = walk(0, 2000, {
    paceMps: 0.9,
    startTs: 1_800_000_000_000 + 2_300_000,
  }).reverse();

  const coverage = computeCoverage(course, [...out, ...back]);
  assert.ok(coverage.fraction < 0.6, `fraction ${coverage.fraction}`);
  assert.ok(coverage.coveredM < 3000, `covered ${coverage.coveredM}`);
  assert.ok(coverage.secondsOnCourse / 60 >= 45, `${coverage.secondsOnCourse / 60} min`);

  const verdict = judgeCoverage(coverage);
  assert.equal(verdict.credited, true, verdict.reason);
  assert.match(verdict.reason, /min/);
});

test('an hour in a café beside the levada is not a levada walk', () => {
  // The time rule needs a distance floor, or the channel that runs behind a
  // restaurant hands out stamps to people having lunch.
  const still = Array.from({ length: 80 }, (_, i) => ({
    ts: 1_800_000_000_000 + i * 60_000,
    lat: 32.7,
    lon: -17 + 20 * LON_PER_M,
    accuracy_m: 8,
  }));

  const coverage = computeCoverage([straightCourse(4000)], still);
  assert.ok(coverage.secondsOnCourse / 60 >= 45);
  assert.equal(judgeCoverage(coverage).credited, false);
});

test('a levada that runs on forever is not measured against its whole length', () => {
  // Some levadas continue past any sensible turning point. Measuring a good
  // walk against 30 km of drawn channel would refuse every honest walker.
  // Fifty minutes and 1.8 km of a thirty-kilometre channel: 6% of the mapped
  // course, and unmistakably a levada walk.
  const coverage = computeCoverage([straightCourse(30_000, 100)], walk(0, 1800, { paceMps: 0.6 }));
  assert.ok(coverage.fraction < 0.07, `fraction ${coverage.fraction}`);
  assert.ok(coverage.coveredM < WALKED_ABSOLUTE_M, `covered ${coverage.coveredM}`);
  assert.equal(judgeCoverage(coverage).credited, true);
});
