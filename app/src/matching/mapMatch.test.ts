/**
 * The matcher (D-093): which streets a trace travelled.
 *
 *     cd app && npm test
 *
 * Two halves. Small hand-drawn networks pin each rule to the case it exists
 * for. Then **the shipped network**, with synthetic trips over real Funchal
 * streets and the VR1, holds the matcher to the quality `tools/eval-matching.mjs`
 * measured when it was built: those are regression floors, not claims about
 * real GPS (no real walk on Madeira had been recorded then).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { effectiveActivity, matchTrace, MIN_CHAIN_FIXES, stepCosts } from './mapMatch.ts';
import { decodeRoadGraph, pointAt, type RoadFile } from './roadGraph.ts';
import * as routing from './roadRouting.ts';
import { fixAt, grid, litOn, litTotal, network } from './testNetwork.ts';
import { visitedEdges } from './visitedRoads.ts';
// The evaluation tool's own trip generator, so the floors below are the
// numbers it prints, not a second model of GPS.
import { drivenRoute, randomRoute, rng, sampleTrip, score } from '../../../tools/lib/syntheticTrips.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** A walk east along y = `north`, a fix every 10 s at 1.4 m/s, with an offset. */
function walkEast(fromEast: number, toEast: number, north: number, offset: (i: number) => number) {
  const fixes = [];
  for (let i = 0, e = fromEast; e <= toEast; i += 1, e += 14) {
    fixes.push(fixAt(i * 10, e, north + offset(i)));
  }
  return fixes;
}

test('a walk along a street lights that street and not the one behind the houses', () => {
  // Two parallel streets 30 m apart. The walk is on the south one, its fixes
  // wandering up to 12 m towards the north one.
  const net = network(
    { a: [0, 0], b: [300, 0], c: [0, 30], d: [300, 30] },
    [
      { from: 'a', to: 'b' },
      { from: 'c', to: 'd' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
    ]
  );
  const fixes = walkEast(20, 280, 0, (i) => (i % 3) * 6);
  const { chains } = matchTrace(net.graph, fixes);
  const visited = visitedEdges(net.graph, chains);
  assert.ok(litOn(visited, [net.edge('a', 'b')]) > 230, 'the street walked');
  assert.equal(litOn(visited, [net.edge('c', 'd')]), 0, 'not the parallel one');
});

test('a phone at rest lights nothing, however its position drifts', () => {
  const g = grid(3, 80);
  // Drift out along a street and back, at the desk's reported speeds.
  const out = [0, 5, 23, 29, 34, 39, 44, 38, 27, 20, 12, 3, 0, 8, 26, 41, 52, 40, 22, 6];
  const fixes = out.map((m, i) => fixAt(i * 10, 80 + m, 80 + 2, 0.1 + (i % 3) * 0.1));
  const { chains, stats } = matchTrace(g.graph, fixes);
  assert.equal(stats.fixesMoving, 0);
  assert.equal(litTotal(visitedEdges(g.graph, chains)), 0);
});

test('fewer fixes than a chain needs light nothing', () => {
  const g = grid(2, 100);
  const fixes = walkEast(10, 10 + 14 * (MIN_CHAIN_FIXES - 2), 0, () => 2);
  const { chains } = matchTrace(g.graph, fixes);
  assert.equal(chains.length, 0);
});

test('a wild fix is not reached by a detour up a side street', () => {
  // A walk along a street with a side street off it; one fix 90 m up the side
  // street, reported at ±5 m. Its neighbours are 14 m apart.
  const net = network(
    { a: [0, 0], b: [150, 0], c: [300, 0], s: [150, 120] },
    [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'b', to: 's' },
    ]
  );
  const fixes = walkEast(10, 290, 0, () => 1);
  const wild = Math.floor(fixes.length / 2);
  fixes[wild] = { ...fixes[wild], ...fixAt(wild * 10, 152, 90) };
  const { chains } = matchTrace(net.graph, fixes);
  const visited = visitedEdges(net.graph, chains);
  assert.ok(litOn(visited, [net.edge('b', 's')]) < 5, 'the side street stays dark');
  assert.ok(litOn(visited, [net.edge('a', 'b'), net.edge('b', 'c')]) > 250);
});

test('a tunnel is lit from a fix at each portal', () => {
  // 800 m of tunnel with no fix inside, driven at 20 m/s.
  const net = network(
    { w: [0, 0], p1: [300, 0], p2: [1100, 0], e: [1400, 0] },
    [
      { from: 'w', to: 'p1', kind: 'm' },
      { from: 'p1', to: 'p2', kind: 'M' },
      { from: 'p2', to: 'e', kind: 'm' },
    ]
  );
  const fixes = [];
  for (let t = 0; t <= 70; t += 5) {
    const east = t * 20;
    if (east > 320 && east < 1080) continue; // underground
    fixes.push(fixAt(t, east, 2, 20));
  }
  const { chains } = matchTrace(net.graph, fixes);
  const visited = visitedEdges(net.graph, chains);
  assert.ok(litOn(visited, [net.edge('p1', 'p2')]) > 790, 'the whole tunnel');
});

test('a long silence is not bridged, even along a road', () => {
  const net = network({ w: [0, 0], e: [3000, 0] }, [{ from: 'w', to: 'e' }]);
  const fixes = [
    ...Array.from({ length: 5 }, (_, i) => fixAt(i * 10, i * 14, 1)),
    // Ten minutes later, 2 km on.
    ...Array.from({ length: 5 }, (_, i) => fixAt(640 + i * 10, 2000 + i * 14, 1)),
  ];
  const { chains } = matchTrace(net.graph, fixes);
  const visited = visitedEdges(net.graph, chains);
  assert.equal(chains.length, 2);
  assert.ok(litTotal(visited) < 200, `${litTotal(visited)} m: two short stretches, no bridge`);
});

test('fixes far from any road end the chain: nothing is drawn across a beach', () => {
  const net = network(
    { a: [0, 0], b: [200, 0], c: [600, 0], d: [800, 0] },
    [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c', kind: 'f' },
      { from: 'c', to: 'd' },
    ]
  );
  // Walk the first road, then two minutes 200 m south of everything, then the
  // last road. The footway between is never walked.
  const fixes = [
    ...walkEast(10, 190, 0, () => 1),
    ...Array.from({ length: 12 }, (_, i) => fixAt(200 + i * 10, 250 + i * 25, -200)),
    ...Array.from({ length: 12 }, (_, i) => fixAt(330 + i * 10, 610 + i * 14, 1)),
  ];
  const { chains } = matchTrace(net.graph, fixes);
  const visited = visitedEdges(net.graph, chains);
  assert.equal(litOn(visited, [net.edge('b', 'c')]), 0);
});

/** The shipped network, decoded once for the tests below. */
const graph = decodeRoadGraph(
  JSON.parse(readFileSync(path.join(repoRoot, 'content/roads.json'), 'utf8')) as RoadFile
);

function startEdge(lat: number, lon: number, kinds: string): number {
  for (let radius = 100; radius < 5000; radius *= 2) {
    for (let e = 0; e < graph.edgeCount; e += 1) {
      const p = graph.pointStart[e];
      if (!kinds.includes(graph.edgeKindCodes[e].toLowerCase())) continue;
      const dy = (graph.lat[p] - lat) * 110_540;
      const dx = (graph.lon[p] - lon) * 93_800;
      if (Math.hypot(dx, dy) < radius) return e;
    }
  }
  throw new Error('no start edge');
}

function average(runs: { recall: number; precision: number }[]) {
  return {
    recall: runs.reduce((s, r) => s + r.recall, 0) / runs.length,
    precision: runs.reduce((s, r) => s + r.precision, 0) / runs.length,
  };
}

test('Funchal on foot, an outing: nearly all of the walk lit, almost nothing wrong', () => {
  const start = startEdge(32.6496, -16.9086, 'rfp');
  const runs = [];
  for (let seed = 1; seed <= 6; seed += 1) {
    const random = rng(seed * 7919);
    const steps = randomRoute(graph, start, 2500, random, 'rfp');
    const trip = sampleTrip(graph, pointAt, steps, random, {
      speedMps: 1.4, intervalS: 10, sigmaM: 5, correlationS: 60, outlierRate: 0.01, accuracyM: 6,
    });
    const { chains } = matchTrace(graph, trip.fixes);
    runs.push(score(graph, steps, visitedEdges(graph, chains)));
  }
  const { recall, precision } = average(runs);
  // Measured when built: 97% and 99.5%.
  assert.ok(recall > 0.93, `recall ${recall}`);
  assert.ok(precision > 0.97, `precision ${precision}`);
});

test('the VR1 with its tunnels, no fix underground: lit end to end, on the right carriageway', () => {
  const start = startEdge(32.6468, -16.879, 'm');
  const runs = [];
  for (let seed = 3; seed <= 8; seed += 1) {
    const random = rng(seed * 7919);
    const steps = drivenRoute(graph, routing, start, 15000, random, 'm');
    const trip = sampleTrip(graph, pointAt, steps, random, {
      speedMps: 24, intervalS: 15, sigmaM: 5, correlationS: 60, outlierRate: 0, accuracyM: 5, dropTunnels: true,
    });
    if (trip.fixes.length < 10) continue;
    const { chains } = matchTrace(graph, trip.fixes);
    runs.push(score(graph, steps, visitedEdges(graph, chains)));
  }
  assert.ok(runs.length >= 4);
  const { recall, precision } = average(runs);
  // Measured when built: 98% and 99.8%. Precision is what the one-way
  // carriageways bought: 92% without them.
  assert.ok(recall > 0.93, `recall ${recall}`);
  assert.ok(precision > 0.97, `precision ${precision}`);
});

/**
 * ⚠ A Madeira quirk (D-094). The Monte cable car crosses Funchal at about
 * 5 m/s, a smooth ride the motion sensors may call *still*. Before aerial lifts
 * were in the network the ride matched the streets underneath it.
 */
test('the Monte cable car lights the cable, not the streets under it', () => {
  const cable = [189, 190];
  for (const edge of cable) {
    assert.equal(graph.edgeKindCodes[edge], 'a', 'edges 189 and 190 are the Funchal to Monte cable car');
  }
  const steps = cable.map((edge) => ({ edge, forward: true }));
  const random = rng(31);
  const trip = sampleTrip(graph, pointAt, steps, random, {
    speedMps: 4.5, intervalS: 10, sigmaM: 6, correlationS: 60, outlierRate: 0, accuracyM: 6, activity: 'still',
  });
  const { chains } = matchTrace(graph, trip.fixes);
  const visited = visitedEdges(graph, chains);
  const onCable = litOn(visited, cable);
  const total = litTotal(visited);
  assert.ok(onCable > 2500, `${Math.round(onCable)} m of the 3.1 km cable lit`);
  assert.ok(total - onCable < 100, `${Math.round(total - onCable)} m of street lit under the cable`);
});

/**
 * D-094: the activity makes a way dear, never impossible. A road with a
 * footway 12 m beside it, the promenade's shape.
 */
function promenade() {
  return network(
    { a: [0, 0], b: [400, 0], c: [0, 12], d: [400, 12], e: [-50, 6], f: [450, 6] },
    [
      { from: 'a', to: 'b' },
      { from: 'c', to: 'd', kind: 'f' },
      { from: 'e', to: 'a' },
      { from: 'e', to: 'c', kind: 'f' },
      { from: 'b', to: 'f' },
      { from: 'd', to: 'f', kind: 'f' },
    ]
  );
}

test('in a car, fixes between a road and a footway light the road', () => {
  const net = promenade();
  // 8 m from the road, 4 m from the footway: by position alone, the footway.
  const fixes = Array.from({ length: 12 }, (_, i) => ({ ...fixAt(i * 3, 20 + i * 30, 8, 10), activity: 'driving' as const }));
  const visited = visitedEdges(net.graph, matchTrace(net.graph, fixes).chains);
  assert.ok(litOn(visited, [net.edge('a', 'b')]) > 300, 'the road');
  assert.ok(litOn(visited, [net.edge('c', 'd')]) < 20, 'not the footway');
});

test('a wrong driving label on a walk along the footway still lights the footway', () => {
  // The fixes sit on the footway, well away from the road: the label is wrong
  // (a missed transition) and the evidence must win.
  const net = network(
    { a: [0, 0], b: [400, 0], c: [0, 60], d: [400, 60] },
    [
      { from: 'a', to: 'b' },
      { from: 'c', to: 'd', kind: 'f' },
    ]
  );
  const fixes = Array.from({ length: 25 }, (_, i) => ({ ...fixAt(i * 10, 20 + i * 14, 60, 1.4), activity: 'driving' as const }));
  const visited = visitedEdges(net.graph, matchTrace(net.graph, fixes).chains);
  assert.ok(litOn(visited, [net.edge('c', 'd')]) > 300, 'the footway, despite the label');
});

test('a walking label at driving speed is not trusted', () => {
  assert.equal(effectiveActivity('walking', 20), 'unknown');
  assert.equal(effectiveActivity('walking', 1.5), 'walking');
  assert.equal(effectiveActivity('driving', 1.5), 'driving', 'a car can crawl');
  assert.equal(stepCosts('driving', 'walking'), null, 'the car park: nothing dear');
  assert.equal(stepCosts('driving', 'unknown'), stepCosts('driving', 'driving'));
});
