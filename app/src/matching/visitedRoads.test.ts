/**
 * From matched chains to lines on the map (D-093).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { MatchedChain } from './mapMatch.ts';
import { grid, network } from './testNetwork.ts';
import { trimSpurs, visitedEdges, visitedLengthM, visitedLines } from './visitedRoads.ts';

function chain(pieces: MatchedChain['pieces']): MatchedChain {
  return { pieces, anchors: [{ ts: 0, atM: 0 }], confidence: 1 };
}

test('a short stub into a side street and straight back is trimmed', () => {
  const net = network(
    { a: [0, 0], b: [100, 0], c: [200, 0], s: [100, 80] },
    [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'b', to: 's' },
    ]
  );
  const side = net.edge('b', 's');
  const trimmed = trimSpurs(net.graph, [
    { edge: net.edge('a', 'b'), from: 10, to: 100 },
    { edge: side, from: 0, to: 8 },
    { edge: side, from: 8, to: 0 },
    { edge: net.edge('b', 'c'), from: 0, to: 90 },
  ]);
  assert.deepEqual(trimmed.map((p) => p.edge), [net.edge('a', 'b'), net.edge('b', 'c')]);
});

test('a real out-and-back, longer than a stub, is kept', () => {
  const net = network(
    { a: [0, 0], b: [100, 0], c: [200, 0], s: [100, 80] },
    [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'b', to: 's' },
    ]
  );
  const side = net.edge('b', 's');
  const trimmed = trimSpurs(net.graph, [
    { edge: net.edge('a', 'b'), from: 10, to: 100 },
    { edge: side, from: 0, to: 75 },
    { edge: side, from: 75, to: 0 },
    { edge: net.edge('b', 'c'), from: 0, to: 90 },
  ]);
  assert.equal(trimmed.length, 4);
});

test('a stub at the start of a chain is trimmed; a real start mid-street is not', () => {
  const g = grid(2, 100);
  const stubbed = trimSpurs(g.graph, [
    { edge: g.edge('1,0', '1,1'), from: 6, to: 0 },
    { edge: g.edge('0,0', '1,0'), from: 100, to: 0 },
  ]);
  assert.equal(stubbed.length, 1);
  const real = trimSpurs(g.graph, [
    { edge: g.edge('1,0', '1,1'), from: 60, to: 0 },
    { edge: g.edge('0,0', '1,0'), from: 100, to: 0 },
  ]);
  assert.equal(real.length, 2);
});

test('the same street travelled twice is lit once', () => {
  const g = grid(1, 100);
  const e = g.edge('0,0', '1,0');
  const visited = visitedEdges(g.graph, [
    chain([{ edge: e, from: 10, to: 60 }]),
    chain([{ edge: e, from: 40, to: 90 }]),
    chain([{ edge: e, from: 70, to: 20 }]),
  ]);
  assert.deepEqual(visited.get(e), [[10, 90]]);
  assert.equal(visitedLengthM(visited), 80);
});

test('streets meeting end to end become one line; a lit crossroads ends lines there', () => {
  const g = grid(2, 100);
  // An L: 0,0 → 1,0 → 1,1, whole edges. Two edges meet at 1,0, nothing else lit.
  const l = visitedEdges(g.graph, [
    chain([
      { edge: g.edge('0,0', '1,0'), from: 0, to: 100 },
      { edge: g.edge('1,0', '1,1'), from: 0, to: 100 },
    ]),
  ]);
  const lLines = visitedLines(g.graph, l);
  assert.equal(lLines.length, 1, 'one line round the corner');
  assert.equal(lLines[0].points.length, 3);

  // A cross at 1,1: four lit streets meet, so four lines.
  const cross = visitedEdges(g.graph, [
    chain([
      { edge: g.edge('0,1', '1,1'), from: 0, to: 100 },
      { edge: g.edge('1,1', '2,1'), from: 0, to: 100 },
    ]),
    chain([
      { edge: g.edge('1,0', '1,1'), from: 0, to: 100 },
      { edge: g.edge('1,1', '1,2'), from: 0, to: 100 },
    ]),
  ]);
  assert.equal(visitedLines(g.graph, cross).length, 4);
});

test('a lit loop round a block is one closed line', () => {
  const g = grid(1, 100);
  const visited = visitedEdges(g.graph, [
    chain([
      { edge: g.edge('0,0', '1,0'), from: 0, to: 100 },
      { edge: g.edge('1,0', '1,1'), from: 0, to: 100 },
      { edge: g.edge('0,1', '1,1'), from: 100, to: 0 },
      { edge: g.edge('0,0', '0,1'), from: 100, to: 0 },
    ]),
  ]);
  const lines = visitedLines(g.graph, visited);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].points.length, 5, 'four corners, back to the first');
});

test('a partly travelled street draws only the part travelled', () => {
  const g = grid(1, 100);
  const e = g.edge('0,0', '1,0');
  const lines = visitedLines(g.graph, visitedEdges(g.graph, [chain([{ edge: e, from: 25, to: 75 }])]));
  assert.equal(lines.length, 1);
  const [a, b] = [lines[0].points[0], lines[0].points[lines[0].points.length - 1]];
  const metres = Math.abs(b[1] - a[1]) * 111_320 * Math.cos((32.65 * Math.PI) / 180);
  assert.ok(Math.abs(metres - 50) < 0.5, `${metres}`);
});

test('a tunnel is its own line, marked, even where it meets the road end to end', () => {
  const net = network(
    { w: [0, 0], p1: [300, 0], p2: [700, 0], e: [1000, 0] },
    [
      { from: 'w', to: 'p1', kind: 'm' },
      { from: 'p1', to: 'p2', kind: 'M' },
      { from: 'p2', to: 'e', kind: 'm' },
    ]
  );
  const visited = visitedEdges(net.graph, [
    chain([
      { edge: 0, from: 0, to: 300 },
      { edge: 1, from: 0, to: 400 },
      { edge: 2, from: 0, to: 300 },
    ]),
  ]);
  const lines = visitedLines(net.graph, visited);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map((l) => l.tunnel).sort(), [false, false, true]);
});
