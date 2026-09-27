/**
 * The road network: decoding, the spatial query, and the shipped file (D-093).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  decodeRoadGraph,
  edgeKind,
  edgeSlice,
  isTunnel,
  metresBetween,
  nearbyEdges,
  pointAt,
  type RoadFile,
} from './roadGraph.ts';
import { at, network } from './testNetwork.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('an edge decodes to the points it was drawn with, and its length', () => {
  const net = network(
    { a: [0, 0], b: [100, 0] },
    [{ from: 'a', to: 'b', via: [[50, 30]] }]
  );
  const g = net.graph;
  assert.equal(g.edgeCount, 1);
  assert.equal(g.pointStart[1] - g.pointStart[0], 3);
  // Two legs of sqrt(50² + 30²).
  assert.ok(Math.abs(g.edgeLength[0] - 2 * Math.hypot(50, 30)) < 0.5);
  const [lat, lon] = at(50, 30);
  assert.ok(metresBetween(g.lat[1], g.lon[1], lat, lon) < 0.2);
});

test('junctions know their edges', () => {
  const net = network(
    { a: [0, 0], b: [100, 0], c: [100, 100], d: [200, 0] },
    [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'b', to: 'd' },
    ]
  );
  const g = net.graph;
  const b = 1;
  const incident = [...g.adjEdge.slice(g.adjStart[b], g.adjStart[b + 1])].sort();
  assert.deepEqual(incident, [0, 1, 2]);
});

test('nearbyEdges finds the closest point on each edge within the radius, nearest first', () => {
  const net = network(
    { a: [0, 0], b: [200, 0], c: [0, 30], d: [200, 30], e: [0, 300], f: [200, 300] },
    [
      { from: 'a', to: 'b' },
      { from: 'c', to: 'd' },
      { from: 'e', to: 'f' },
    ]
  );
  const [lat, lon] = at(80, 10);
  const found = nearbyEdges(net.graph, lat, lon, 50, 8);
  assert.deepEqual(found.map((c) => c.edge), [0, 1], 'the far street is outside 50 m');
  assert.ok(Math.abs(found[0].distance - 10) < 0.5);
  assert.ok(Math.abs(found[0].offset - 80) < 0.5, 'offset is metres along the edge');
  assert.ok(Math.abs(found[1].distance - 20) < 0.5);
});

test('a winding edge gives one candidate, at its closest pass', () => {
  // A hairpin: out 100 m east, back west 20 m north of itself.
  const net = network(
    { a: [0, 0], b: [0, 20] },
    [{ from: 'a', to: 'b', via: [[100, 0], [100, 20]] }]
  );
  const [lat, lon] = at(50, 4);
  const found = nearbyEdges(net.graph, lat, lon, 50, 8);
  assert.equal(found.length, 1);
  assert.ok(Math.abs(found[0].distance - 4) < 0.5, 'the nearer leg, not the far one');
});

test('the candidate limit keeps the nearest', () => {
  const junctions: Record<string, [number, number]> = {};
  const edges = [];
  for (let i = 0; i < 12; i += 1) {
    junctions[`w${i}`] = [0, i * 3];
    junctions[`e${i}`] = [100, i * 3];
    edges.push({ from: `w${i}`, to: `e${i}` });
  }
  const net = network(junctions, edges);
  const [lat, lon] = at(50, 0);
  const found = nearbyEdges(net.graph, lat, lon, 60, 5);
  assert.deepEqual(found.map((c) => c.edge), [0, 1, 2, 3, 4]);
});

test('edgeSlice and pointAt walk the geometry in either direction', () => {
  const net = network({ a: [0, 0], b: [100, 0] }, [{ from: 'a', to: 'b', via: [[50, 0]] }]);
  const g = net.graph;
  const forward = edgeSlice(g, 0, 20, 70);
  assert.equal(forward.length, 3, 'start, the bend at 50 m, end');
  const backward = edgeSlice(g, 0, 70, 20);
  assert.deepEqual(backward, [...forward].reverse());
  const [lat, lon] = pointAt(g, 0, 20);
  const [eLat, eLon] = at(20, 0);
  assert.ok(metresBetween(lat, lon, eLat, eLon) < 0.3);
});

test('kinds and tunnels read from one character per edge', () => {
  const net = network(
    { a: [0, 0], b: [100, 0], c: [200, 0] },
    [
      { from: 'a', to: 'b', kind: 'M' },
      { from: 'b', to: 'c', kind: 'f' },
    ]
  );
  assert.equal(edgeKind(net.graph, 0), 'm');
  assert.equal(isTunnel(net.graph, 0), true);
  assert.equal(isTunnel(net.graph, 1), false);
});

test('an older file without one-way flags still loads, as two-way', () => {
  const net = network({ a: [0, 0], b: [100, 0] }, [{ from: 'a', to: 'b' }]);
  const { edgeOneway: _dropped, ...older } = net.file;
  const graph = decodeRoadGraph(older as RoadFile);
  assert.equal(graph.edgeOneway, '0');
});

test('an inconsistent file is refused rather than half-read', () => {
  const net = network({ a: [0, 0], b: [100, 0] }, [{ from: 'a', to: 'b' }]);
  assert.throws(() => decodeRoadGraph({ ...net.file, edgeKind: 'rr' }));
});

/**
 * The shipped file. It is built by `tools/build-roads.mjs`, never by hand;
 * these check that what ships is the archipelago and is a usable graph.
 */
test('content/roads.json: the archipelago, connected, every edge real', () => {
  const file = JSON.parse(
    readFileSync(path.join(repoRoot, 'content/roads.json'), 'utf8')
  ) as RoadFile;
  const g = decodeRoadGraph(file);

  assert.ok(g.edgeCount > 40_000, `${g.edgeCount} edges: the whole island, not a sample`);
  let total = 0;
  for (let e = 0; e < g.edgeCount; e += 1) {
    assert.ok(g.edgeLength[e] > 0, `edge ${e} has no length`);
    total += g.edgeLength[e];
  }
  assert.ok(total > 5_000_000 && total < 9_000_000, `${Math.round(total / 1000)} km`);

  // D-021's bounds: Madeira, Porto Santo, the Desertas.
  for (let p = 0; p < g.lat.length; p += 1) {
    assert.ok(g.lat[p] > 32.4 && g.lat[p] < 33.2 && g.lon[p] > -17.32 && g.lon[p] < -16.2);
  }

  // One-way flags only on motorways and trunk roads (build-roads.mjs says why).
  for (let e = 0; e < g.edgeCount; e += 1) {
    if (g.edgeOneway[e] !== '0') {
      assert.equal(edgeKind(g, e), 'm', `edge ${e} is one-way but kind ${g.edgeKindCodes[e]}`);
    }
  }

  // A street in the middle of Funchal is found (Avenida Arriaga).
  const found = nearbyEdges(g, 32.6484, -16.9097, 30, 8);
  assert.ok(found.length > 0, 'no road near the centre of Funchal');
});
