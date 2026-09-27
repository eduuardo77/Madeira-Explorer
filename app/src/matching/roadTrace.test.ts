/**
 * Timed road lines, and the privacy clip every export needs (D-093, D-016).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { matchTrace } from './mapMatch.ts';
import { chainTimedPath, chainTimedRuns, clipOutsideCircle, type TimedPoint } from './roadTrace.ts';
import { at, fixAt, network } from './testNetwork.ts';

function metresFrom(point: { lat: number; lon: number }, centre: { lat: number; lon: number }): number {
  const x = (point.lon - centre.lon) * 111_320 * Math.cos((centre.lat * Math.PI) / 180);
  const y = (point.lat - centre.lat) * 110_540;
  return Math.hypot(x, y);
}

function line(points: [number, number, number][]): TimedPoint[] {
  return points.map(([east, north, ts]) => {
    const [lat, lon] = at(east, north);
    return { lat, lon, ts };
  });
}

test('a line crossing the circle is cut in two, exactly at its edge, with times', () => {
  const [lat, lon] = at(500, 0);
  const centre = { lat, lon };
  const pieces = clipOutsideCircle(line([[0, 0, 0], [1000, 0, 1000]]), centre, 300);
  assert.equal(pieces.length, 2);
  const leaving = pieces[0][pieces[0].length - 1];
  const returning = pieces[1][0];
  assert.ok(Math.abs(metresFrom(leaving, centre) - 300) < 0.5);
  assert.ok(Math.abs(metresFrom(returning, centre) - 300) < 0.5);
  assert.ok(Math.abs(leaving.ts - 200) < 1, 'time interpolated to the crossing');
  assert.ok(Math.abs(returning.ts - 800) < 1);
});

test('a line wholly inside is gone; wholly outside is untouched', () => {
  const [lat, lon] = at(0, 0);
  const centre = { lat, lon };
  assert.deepEqual(clipOutsideCircle(line([[-50, 0, 0], [50, 0, 1]]), centre, 300), []);
  const outside = line([[400, 0, 0], [900, 0, 1]]);
  assert.deepEqual(clipOutsideCircle(outside, centre, 300), [outside]);
});

test('a line starting inside the circle starts at its edge', () => {
  const [lat, lon] = at(0, 0);
  const centre = { lat, lon };
  const pieces = clipOutsideCircle(line([[0, 0, 0], [600, 0, 600]]), centre, 300);
  assert.equal(pieces.length, 1);
  assert.ok(Math.abs(metresFrom(pieces[0][0], centre) - 300) < 0.5);
});

test('the timed path carries each fix\'s time along the road between them', () => {
  const net = network({ a: [0, 0], b: [400, 0] }, [{ from: 'a', to: 'b' }]);
  const fixes = Array.from({ length: 10 }, (_, i) => fixAt(i * 10, 20 + i * 14, 1));
  const { chains } = matchTrace(net.graph, fixes);
  assert.equal(chains.length, 1);
  const path = chainTimedPath(net.graph, chains[0]);
  assert.ok(path.length >= 2);
  assert.ok(Math.abs(path[0].ts - fixes[0].ts) < 1);
  assert.ok(Math.abs(path[path.length - 1].ts - fixes[fixes.length - 1].ts) < 1);
  for (let i = 1; i < path.length; i += 1) {
    assert.ok(path[i].ts >= path[i - 1].ts, 'time never runs backwards');
  }
});

/**
 * ⚠⚠ THE PRIVACY CASE. Masking removes the fixes near where the user sleeps;
 * the matcher then bridges the gap along the streets, which would draw the
 * very street the mask hides. The clip is what stops it.
 */
test('a route bridged through the mask leaves nothing inside the circle once clipped', () => {
  // One street through "home" at 500 m, driven at 10 m/s. The fixes within
  // 300 m of home were masked away, leaving a 64 s gap, which is bridged.
  const net = network({ a: [0, 0], b: [1000, 0] }, [{ from: 'a', to: 'b' }]);
  const before = Array.from({ length: 7 }, (_, i) => fixAt(i * 3, i * 30, 1, 10));
  const after = Array.from({ length: 6 }, (_, i) => fixAt(82 + i * 3, 820 + i * 30, 1, 10));
  const { chains } = matchTrace(net.graph, [...before, ...after]);
  const [lat, lon] = at(500, 0);
  const home = { lat, lon };

  const bridged = chains.flatMap((c) => densify(chainTimedPath(net.graph, c)));
  assert.ok(
    bridged.some((p) => metresFrom(p, home) < 300),
    'the unclipped route does cross the mask: this test is not guarding a no-op'
  );

  const exported = chains.flatMap((c) => clipOutsideCircle(chainTimedPath(net.graph, c), home, 300));
  assert.ok(exported.length > 0, 'the drive either side of the mask is still drawn');
  for (const piece of exported) {
    // Every point along every segment, not only the vertices: a straight
    // street has no vertex inside the circle and still runs through it.
    for (const point of densify(piece)) {
      assert.ok(metresFrom(point, home) >= 299.5, `a point ${metresFrom(point, home)} m from home`);
    }
  }
});

/** Points every metre or so along a line. */
function densify(line: TimedPoint[]): TimedPoint[] {
  const out: TimedPoint[] = [];
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1];
    const b = line[i];
    const steps = Math.max(1, Math.ceil(metresFrom(a, b)));
    for (let k = 0; k <= steps; k += 1) {
      const t = k / steps;
      out.push({ lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon), ts: a.ts + t * (b.ts - a.ts) });
    }
  }
  return out;
}

test('timed runs split where the route goes underground, sharing the portal point', () => {
  const net = network(
    { w: [0, 0], p1: [300, 0], p2: [700, 0], e: [1000, 0] },
    [
      { from: 'w', to: 'p1', kind: 'm' },
      { from: 'p1', to: 'p2', kind: 'M' },
      { from: 'p2', to: 'e', kind: 'm' },
    ]
  );
  const fixes = [];
  for (let t = 0; t <= 45; t += 5) {
    const east = 20 + t * 20;
    if (east > 320 && east < 680) continue; // no fixes underground
    fixes.push(fixAt(t, east, 2, 20));
  }
  const { chains } = matchTrace(net.graph, fixes);
  assert.equal(chains.length, 1);
  const runs = chainTimedRuns(net.graph, chains[0]);
  assert.deepEqual(runs.map((run) => run.faded), [false, true, false]);
  for (let i = 1; i < runs.length; i += 1) {
    const end = runs[i - 1].points[runs[i - 1].points.length - 1];
    assert.deepEqual(runs[i].points[0], end, 'the next run starts where the last ended');
  }
  const all = runs.flatMap((run) => run.points);
  for (let i = 1; i < all.length; i += 1) {
    assert.ok(all[i].ts >= all[i - 1].ts, 'time never runs backwards across a portal');
  }
});
