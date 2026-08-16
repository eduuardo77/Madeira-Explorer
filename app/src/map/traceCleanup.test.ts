/**
 * Tests for the drawn trace's cleanup (D-066, T-059).
 *
 *     cd app && npm test
 *
 * ⚠ **These fixtures are synthetic, and that is a limitation, not a choice.**
 * `tools/fixtures/` is empty until somebody walks a levada with a logger
 * (T-018), so the noise here is modelled rather than measured. What the tests
 * can prove is the *shape* of each rule — that a spike goes, a hairpin stays, a
 * coffee stop becomes a point, and no coordinate is ever invented. What they
 * cannot prove is that the thresholds are right, which is why every one of them
 * is marked NOT TUNED in the module.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanTrace,
  collapseStationary,
  pathLengthM,
  rejectSpikes,
  simplify,
  STATIONARY_MIN_SECONDS,
} from './traceCleanup.ts';
import type { TraceFix } from './traceGeoJson.ts';

const START = 1_800_000_000_000;
const LAT_PER_M = 1 / 110_540;
const LON_PER_M = 1 / (111_320 * Math.cos((32.65 * Math.PI) / 180));

/** A fix `east` metres east and `north` metres north of the origin. */
function at(east: number, north: number, seconds: number, accuracy = 10): TraceFix {
  return {
    ts: START + seconds * 1000,
    lat: 32.65 + north * LAT_PER_M,
    lon: -16.91 + east * LON_PER_M,
    accuracy_m: accuracy,
  };
}

/** A straight walk east at 1.2 m/s, one fix every 10 s. */
function straightWalk(count: number): TraceFix[] {
  return Array.from({ length: count }, (_, i) => at(i * 12, 0, i * 10));
}

test('a spike is removed and the walk keeps its shape', () => {
  const walk = straightWalk(9);
  // One fix 150 m off the path, reported with a respectable accuracy — the
  // case the 120 m accuracy filter and the 250 m jump rule both let through.
  walk[4] = at(48, 150, 40, 15);

  const { kept, removed } = rejectSpikes(walk);
  assert.equal(removed, 1);
  assert.equal(kept.length, 8);
  assert.ok(!kept.some((fix) => fix.ts === walk[4].ts));
});

test('a hairpin is not a spike, however much it looks like one', () => {
  // Out 100 m and back to within 20 m over four minutes: geometrically the same
  // as a spike, and a real switchback. Time is what separates them.
  const hairpin: TraceFix[] = [
    at(0, 0, 0),
    at(20, 40, 60),
    at(35, 80, 120),
    at(30, 40, 180),
    at(20, 5, 240),
    at(40, 0, 300),
  ];
  assert.equal(rejectSpikes(hairpin).removed, 0);
});

test('a good fix beside a spike survives — the second bug this rule had', () => {
  // Judged against its immediate neighbours, an honest fix sitting on the path
  // next to a 150 m spike looks like the departure itself, and the first
  // version of this pass deleted three points where one was wrong.
  const walk = straightWalk(11);
  const spike = at(60, 150, 50, 10);
  walk[5] = spike;

  const { kept, removed } = rejectSpikes(walk);
  assert.equal(removed, 1);
  assert.ok(kept.includes(walk[4]), 'the fix before the spike is not the spike');
  assert.ok(kept.includes(walk[6]), 'nor is the fix after it');
  assert.ok(!kept.includes(spike));
});

test('a fix admitting its own imprecision is not called a spike', () => {
  const walk = straightWalk(7);
  // 60 m off, and saying ±40 m. That is inside its own doubt, so removing it
  // would delete the honest fixes and keep the overconfident ones.
  walk[3] = at(36, 60, 30, 40);
  assert.equal(rejectSpikes(walk).removed, 0);
});

test('two spikes in a row cannot vouch for each other', () => {
  const walk = straightWalk(9);
  walk[4] = at(48, 150, 40, 10);
  walk[5] = at(60, 155, 50, 10);
  assert.equal(rejectSpikes(walk).removed, 2);
});

test('standing still becomes one point, and it is a real fix', () => {
  const stop: TraceFix[] = [];
  for (let i = 0; i < 20; i += 1) {
    // Scattered in a 20 m circle for ten minutes, as a coffee stop looks.
    const angle = (i / 20) * Math.PI * 2;
    stop.push(at(10 * Math.cos(angle), 10 * Math.sin(angle), i * 30, i === 7 ? 4 : 12));
  }

  const { kept, collapsed } = collapseStationary(stop);
  assert.equal(kept.length, 1);
  assert.equal(collapsed, 19);
  // The device's own best answer, not an average of its worst ones.
  assert.equal(kept[0].accuracy_m, 4);
  assert.ok(stop.includes(kept[0]), 'the kept point must be one of the recorded fixes');
});

test('a brief pause is not a stop', () => {
  const pause: TraceFix[] = [
    at(0, 0, 0),
    at(2, 0, 20),
    at(3, 1, 40),
    at(60, 0, 100),
  ];
  // Well under the two-minute floor, so the walk keeps every point.
  assert.equal(collapseStationary(pause).collapsed, 0);
  assert.ok(STATIONARY_MIN_SECONDS > 60);
});

test('simplification removes vertices and moves none', () => {
  // A straight walk with 4 m of jitter: nothing worth drawing, hundreds of
  // points to draw it with.
  const jittery = Array.from({ length: 60 }, (_, i) =>
    at(i * 10, (i % 2 === 0 ? 1 : -1) * 4, i * 8)
  );
  const simplified = simplify(jittery);

  assert.ok(simplified.length < 10, `kept ${simplified.length}`);
  for (const fix of simplified) {
    assert.ok(jittery.includes(fix), 'every drawn point must be a recorded fix');
  }
  // The ends are never dropped: the trace must still start and finish where the
  // user did.
  assert.equal(simplified[0], jittery[0]);
  assert.equal(simplified[simplified.length - 1], jittery[jittery.length - 1]);
});

test('a corner is kept — simplification is not straightening', () => {
  const corner: TraceFix[] = [
    at(0, 0, 0),
    at(50, 0, 40),
    at(100, 0, 80),
    at(100, 50, 120),
    at(100, 100, 160),
  ];
  const simplified = simplify(corner);
  assert.equal(simplified.length, 3, 'start, corner, end');
  assert.equal(simplified[1], corner[2]);
});

test('jitter inflates the drawn distance, and cleanup gives it back', () => {
  const jittery = Array.from({ length: 60 }, (_, i) =>
    at(i * 10, (i % 2 === 0 ? 1 : -1) * 6, i * 8)
  );
  // 590 m of walk drawn as noticeably more, which is what makes a straight
  // seafront look like a scribble.
  const before = pathLengthM(jittery);
  assert.ok(before > 700, `${before} m`);

  const { stats } = cleanTrace(jittery);
  assert.ok(stats.lengthOutM < 620, `${stats.lengthOutM} m`);
  assert.ok(stats.lengthOutM > 550, `${stats.lengthOutM} m — the walk must survive`);
});

test('the whole cleanup reports what it did', () => {
  const walk = straightWalk(40);
  walk[10] = at(120, 200, 100, 8);
  const { fixes, stats } = cleanTrace(walk);

  assert.equal(stats.pointsIn, 40);
  assert.equal(stats.pointsOut, fixes.length);
  assert.equal(stats.spikesRemoved, 1);
  assert.ok(stats.pointsOut < stats.pointsIn);
});

test('nothing at all survives being cleaned', () => {
  const { fixes, stats } = cleanTrace([]);
  assert.deepEqual(fixes, []);
  assert.equal(stats.pointsIn, 0);
});

test('two fixes are left alone — there is nothing to judge them against', () => {
  const pair = [at(0, 0, 0), at(1000, 0, 600)];
  const { fixes } = cleanTrace(pair);
  assert.deepEqual(fixes, pair);
});
