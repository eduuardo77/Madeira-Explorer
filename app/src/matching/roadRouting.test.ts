/**
 * Distances and routes along the network (D-093).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createScratch, distancesFrom, MinHeap, routeBetween } from './roadRouting.ts';
import { grid, network } from './testNetwork.ts';

test('the heap pops in key order', () => {
  const heap = new MinHeap();
  const keys = [5, 1, 9, 3, 3, 7, 0, 12, 4];
  keys.forEach((key, node) => heap.push(node, key));
  const out: number[] = [];
  while (heap.size > 0) {
    out.push(heap.peekKey());
    heap.pop();
  }
  assert.deepEqual(out, [...keys].sort((a, b) => a - b));
});

test('distance along one edge is the difference of offsets', () => {
  const net = network({ a: [0, 0], b: [100, 0] }, [{ from: 'a', to: 'b' }]);
  const scratch = createScratch(net.graph);
  const [d] = distancesFrom(net.graph, scratch, { edge: 0, offset: 20 }, [{ edge: 0, offset: 65 }], 1000);
  assert.ok(Math.abs(d - 45) < 0.01);
});

test('around a corner: to the junction, then along the next street', () => {
  const g = grid(2, 100);
  const scratch = createScratch(g.graph);
  const east = g.edge('0,0', '1,0');
  const north = g.edge('1,0', '1,1');
  const [d] = distancesFrom(
    g.graph,
    scratch,
    { edge: east, offset: 30 },
    [{ edge: north, offset: 40 }],
    1000
  );
  assert.ok(Math.abs(d - (70 + 40)) < 0.5, `${d}`);
});

test('the street behind the houses is far by road, however near as the crow flies', () => {
  // Two parallel streets 20 m apart, joined only at the west end.
  const net = network(
    { a: [0, 0], b: [200, 0], c: [0, 20], d: [200, 20] },
    [
      { from: 'a', to: 'b' },
      { from: 'c', to: 'd' },
      { from: 'a', to: 'c' },
    ]
  );
  const scratch = createScratch(net.graph);
  const [d] = distancesFrom(net.graph, scratch, { edge: 0, offset: 150 }, [{ edge: 1, offset: 150 }], 1000);
  assert.ok(Math.abs(d - 320) < 1, `${d}: back 150, across 20, out 150`);
});

test('beyond the limit is Infinity', () => {
  const g = grid(3, 100);
  const scratch = createScratch(g.graph);
  const [d] = distancesFrom(
    g.graph,
    scratch,
    { edge: g.edge('0,0', '1,0'), offset: 0 },
    [{ edge: g.edge('2,3', '3,3'), offset: 50 }],
    200
  );
  assert.equal(d, Infinity);
});

test('a route is the pieces travelled, in order, summing to the distance', () => {
  const g = grid(2, 100);
  const scratch = createScratch(g.graph);
  const start = { edge: g.edge('0,0', '1,0'), offset: 30 };
  const end = { edge: g.edge('1,1', '2,1'), offset: 60 };
  const route = routeBetween(g.graph, scratch, start, end, 1000);
  assert.ok(route !== null);
  assert.deepEqual(
    route.map((p) => p.edge),
    [g.edge('0,0', '1,0'), g.edge('1,0', '1,1'), g.edge('1,1', '2,1')]
  );
  const length = route.reduce((sum, p) => sum + Math.abs(p.to - p.from), 0);
  const [d] = distancesFrom(g.graph, scratch, start, [end], 1000);
  assert.ok(Math.abs(length - d) < 0.01);
  // Travelled, not just touched: the first piece leaves at the far end.
  assert.equal(route[0].from, 30);
  assert.ok(Math.abs(route[0].to - 100) < 0.5);
});

test('a route within one edge is one piece, in either direction', () => {
  const net = network({ a: [0, 0], b: [100, 0] }, [{ from: 'a', to: 'b' }]);
  const scratch = createScratch(net.graph);
  const route = routeBetween(net.graph, scratch, { edge: 0, offset: 70 }, { edge: 0, offset: 20 }, 1000);
  assert.deepEqual(route, [{ edge: 0, from: 70, to: 20 }]);
});

test('no route within the limit is null, not a straight line', () => {
  const net = network(
    { a: [0, 0], b: [100, 0], c: [0, 50], d: [100, 50] },
    [
      { from: 'a', to: 'b' },
      { from: 'c', to: 'd' },
    ]
  );
  const scratch = createScratch(net.graph);
  assert.equal(
    routeBetween(net.graph, scratch, { edge: 0, offset: 50 }, { edge: 1, offset: 50 }, 10_000),
    null
  );
});

test('a one-way carriageway is not driven backwards', () => {
  // Two carriageways side by side, each one-way, joined at both ends: the
  // VR1's shape. Going west on the eastbound one is not a route.
  const net = network(
    { w: [0, 0], e: [1000, 0], w2: [0, 20], e2: [1000, 20] },
    [
      { from: 'w', to: 'e', kind: 'm', oneway: 'f' },
      { from: 'e2', to: 'w2', kind: 'm', oneway: 'f' },
      { from: 'w', to: 'w2', kind: 'm' },
      { from: 'e', to: 'e2', kind: 'm' },
    ]
  );
  const scratch = createScratch(net.graph);
  const eastbound = 0;
  // Along the eastbound carriageway, eastwards: direct.
  const [ahead] = distancesFrom(net.graph, scratch, { edge: eastbound, offset: 100 }, [{ edge: eastbound, offset: 400 }], 5000);
  assert.ok(Math.abs(ahead - 300) < 0.5);
  // Westwards on it: only round the loop, 600 + 20 + 1000 + 20 + 100 m.
  const [behind] = distancesFrom(net.graph, scratch, { edge: eastbound, offset: 400 }, [{ edge: eastbound, offset: 100 }], 5000);
  assert.ok(Math.abs(behind - 1740) < 1, `${behind}`);
});

test('GPS jitter backwards along a one-way road is tolerated', () => {
  const net = network({ w: [0, 0], e: [1000, 0] }, [{ from: 'w', to: 'e', kind: 'm', oneway: 'f' }]);
  const scratch = createScratch(net.graph);
  const [d] = distancesFrom(net.graph, scratch, { edge: 0, offset: 400 }, [{ edge: 0, offset: 390 }], 5000);
  assert.ok(Math.abs(d - 10) < 0.5);
});
