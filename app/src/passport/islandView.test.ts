/**
 * The passport's island, the pure half (T-325).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bubblePlacement,
  dotState,
  fitView,
  freshSince,
  fullView,
  groupCircle,
  hitTest,
  isZoomed,
  lightingOrder,
  MAX_ZOOM,
  stateCounts,
  toMap,
  toScreen,
  zoomAround,
} from './islandView.ts';
import { islandRoads } from './islandRoads.ts';
import { islandMap } from './islandMapArt.ts';

const W = 328;
const H = 166;

test('a stamp in colour, a locked one and a place not visited are three states', () => {
  assert.equal(dotState({ collected: true }), 'open');
  assert.equal(dotState({ collected: true, locked: false }), 'open');
  assert.equal(dotState({ collected: true, locked: true }), 'waiting');
  assert.equal(dotState({ collected: false }), 'new');
  assert.equal(dotState(undefined), 'new');
});

test('screen and map coordinates agree, whole and zoomed', () => {
  for (const view of [fullView(W), zoomAround(200, 100, 4, W, H)]) {
    const [sx, sy] = toScreen(view, W, 123.4, 56.7);
    const [x, y] = toMap(view, W, sx, sy);
    assert.ok(Math.abs(x - 123.4) < 1e-9 && Math.abs(y - 56.7) < 1e-9);
  }
});

test('a view stays on the map and no closer than eight times', () => {
  const deep = fitView({ x: -50, y: -50, w: 1 }, W, H);
  assert.equal(deep.w, W / MAX_ZOOM);
  assert.equal(deep.x, 0);
  assert.equal(deep.y, 0);
  const far = fitView({ x: 300, y: 300, w: 100 }, W, H);
  assert.equal(far.x, W - 100);
  assert.ok(Math.abs(far.y - (H - (100 * H) / W)) < 1e-9);
  assert.equal(fitView({ x: 10, y: 10, w: 5000 }, W, H).w, W);
  assert.equal(isZoomed(fullView(W), W), false);
  assert.equal(isZoomed(zoomAround(100, 80, 2, W, H), W), true);
});

test('a tap squarely on a dot opens it even with a neighbour close by', () => {
  const dots = [
    { id: 'areeiro', x: 187.4, y: 93.4 },
    { id: 'barreiro', x: 180, y: 99 },
  ];
  assert.deepEqual(hitTest(dots, fullView(W), W, 187.4, 93.4), { kind: 'one', id: 'areeiro' });
});

test('a tap that cannot tell dots apart lists them, at most four, nearest first', () => {
  const dots = [0, 1, 2, 3, 4].map((i) => ({ id: `p${i}`, x: 100 + i * 1.5, y: 100 }));
  const hit = hitTest(dots, fullView(W), W, 103, 104);
  assert.equal(hit?.kind, 'group');
  assert.equal(hit?.kind === 'group' ? hit.ids.length : 0, 4);
});

test('zoomed in, the same crowd splits into single taps', () => {
  const dots = [
    { id: 'se', x: 200, y: 140 },
    { id: 'mercado', x: 202, y: 139 },
  ];
  assert.equal(hitTest(dots, fullView(W), W, 201, 140)?.kind, 'group');
  const view = zoomAround(201, 139.5, 7, W, H);
  const [sx, sy] = toScreen(view, W, 200, 140);
  assert.deepEqual(hitTest(dots, view, W, sx, sy), { kind: 'one', id: 'se' });
});

test('a tap in the sea hits nothing', () => {
  assert.equal(hitTest([{ id: 'a', x: 10, y: 10 }], fullView(W), W, 200, 150), null);
});

test('a group is ringed once, round its farthest dot', () => {
  const ring = groupCircle([
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 10, y: 0 },
  ]);
  assert.deepEqual(ring, { x: 5, y: 0, r: 5 });
  assert.equal(groupCircle([{ id: 'a', x: 3, y: 4 }]).r, 0);
});

test('a bubble sits above its dot, flips below near the top, and never leaves the sides', () => {
  const mid = bubblePlacement(164, 120, 256, 66, W);
  assert.equal(mid.below, false);
  assert.equal(mid.top, 120 - 66 - 15);
  const high = bubblePlacement(164, 30, 256, 66, W);
  assert.equal(high.below, true);
  assert.equal(high.top, 45);
  const left = bubblePlacement(5, 120, 256, 66, W);
  assert.equal(left.left, -4);
  assert.equal(left.tip, 18);
  const right = bubblePlacement(325, 120, 256, 66, W);
  assert.equal(right.left, W + 4 - 256);
});

test('what is new since the island was last opened lights last; nothing is new the first time', () => {
  const awards = [
    { place_id: 'a', awarded_ts: 100 },
    { place_id: 'c', awarded_ts: 300 },
    { place_id: 'b', awarded_ts: 200 },
    { place_id: 'ps', awarded_ts: 400 },
  ];
  const shown = new Set(['a', 'b', 'c']);
  assert.deepEqual(freshSince(awards, null, shown), []);
  assert.deepEqual(freshSince(awards, 150, shown), ['b', 'c']);
  assert.deepEqual(lightingOrder(awards, shown, ['b']), ['a', 'c', 'b']);
});

test('the legend counts each state', () => {
  assert.deepEqual(stateCounts(['open', 'new', 'new', 'waiting']), { open: 1, waiting: 1, new: 2 });
});

test('lit roads draw in the island\'s own box, thinned, and a line off the island is left out', () => {
  const square = { id: 'a', outline: [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]] as Array<[number, number]> };
  const line: Array<[number, number]> = [[0, 0.05], [0.00001, 0.05], [0.1, 0.05]];
  const d = islandRoads([square], [line], 200);
  // The middle point is a fraction of a pixel from the first: dropped.
  assert.equal(d, 'M8 100L192 100');
  assert.equal(islandRoads([square], [[[5, 5], [5.1, 5]]], 200), '');
  assert.equal(islandRoads([], [line], 200), '');
});

test('a road through a place passes through its dot: the two drawings share one box', () => {
  const regions = [{ id: 'a', outline: [[-17.2, 32.6], [-16.7, 32.6], [-16.7, 32.9], [-17.2, 32.9]] as Array<[number, number]> }];
  const place = { id: 'p', regionId: 'a', lat: 32.71, lon: -16.93 };
  const map = islandMap(regions, [place], new Set(), 328);
  const d = islandRoads(regions, [[[place.lon, place.lat], [place.lon + 0.05, place.lat]]], 328);
  assert.ok(map);
  assert.equal(d.split('L')[0], `M${map.dots[0].x} ${map.dots[0].y}`);
});
