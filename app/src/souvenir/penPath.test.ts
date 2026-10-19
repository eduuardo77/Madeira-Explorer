/**
 * Tests for the pen's path (T-279).
 *
 *     cd app && npm test
 *
 * What is being pinned down: a short hole is filled only from road another
 * pass actually drew, and never by a straight line or a long way round; road
 * drawn again costs less; a jump between days cannot eat the film.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { distanceM } from '../recording/distance.ts';
import { BRIDGE_REACH_M, MAX_JUMP_SHARE, REPEAT_PACE, bridgeHoles, pacePen, type LatLon } from './penPath.ts';

/** A straight road east along `lat`, `points` evenly spaced. */
function road(fromLon: number, toLon: number, points = 5, lat = 32.65): LatLon[] {
  return Array.from({ length: points }, (_, i) => ({ lat, lon: fromLon + ((toLon - fromLon) * i) / (points - 1) }));
}

test('a hole another pass drove through is filled from that pass', () => {
  // Out with a 375 m hole (GPS lost in a tunnel), then back the whole way.
  const out = [road(-16.9, -16.894), road(-16.89, -16.88)];
  const back = road(-16.88, -16.9, 9);
  const filled = bridgeHoles([...out, back]);

  assert.equal(filled.length, 4, 'one stroke inserted');
  const bridge = filled[1];
  assert.ok(distanceM(bridge[0], out[0][out[0].length - 1]) < 1, 'the filling starts where the pen stopped');
  assert.ok(distanceM(bridge[bridge.length - 1], out[1][0]) < 1, 'and ends where it starts again');
  // Every point of the filling is on the pass it came from.
  for (const point of bridge) {
    assert.ok(Math.abs(point.lat - 32.65) < 1e-9 && point.lon >= -16.894 - 1e-9 && point.lon <= -16.89 + 1e-9);
  }
});

test('a hole on every pass stays a hole', () => {
  const strokes = [road(-16.9, -16.894), road(-16.89, -16.88)];
  assert.deepEqual(bridgeHoles(strokes), strokes);
});

test('a pass that only comes near one end of the hole fills nothing', () => {
  const strokes = [road(-16.9, -16.894), road(-16.89, -16.88), road(-16.895, -16.892)];
  assert.equal(bridgeHoles(strokes).length, 3);
});

test('a road beside the hole but further than the reach fills nothing', () => {
  // The same road 200 m north: another street, not this one.
  const offset = (BRIDGE_REACH_M * 3) / 111_000;
  const strokes = [road(-16.9, -16.894), road(-16.89, -16.88), road(-16.88, -16.9, 9, 32.65 + offset)];
  assert.equal(bridgeHoles(strokes).length, 3);
});

test('road the film already drew costs less on the pace clock', () => {
  const there = road(-16.92, -16.88, 20);
  const pen = pacePen([there, [...there].reverse()]);
  const firstCost = pen.strokes[0][pen.strokes[0].length - 1].cost;
  const againCost = pen.totalCost - pen.strokes[1][0].cost;
  assert.ok(againCost < firstCost * (REPEAT_PACE + 0.05), `${againCost.toFixed(0)} against ${firstCost.toFixed(0)}`);
  assert.ok(againCost > firstCost * REPEAT_PACE * 0.5, 'still drawn, not skipped');
});

test('a long jump between two days costs at most a small share of the film', () => {
  // Two short roads 30 km apart.
  const pen = pacePen([road(-17.2, -17.19), road(-16.9, -16.89)]);
  const jump = pen.strokes[1][0].cost - pen.strokes[0][pen.strokes[0].length - 1].cost;
  const drawn = pen.totalCost - jump;
  assert.ok(jump <= MAX_JUMP_SHARE * drawn + 1e-6, `the jump cost ${jump.toFixed(0)} of ${drawn.toFixed(0)}`);
  assert.ok(jump > 0, 'the pen is up for a moment, not teleported');
});

test('along counts the jump, so the camera travels with the pen', () => {
  const pen = pacePen([road(-17.2, -17.19), road(-16.9, -16.89)]);
  const end = pen.strokes[0][pen.strokes[0].length - 1];
  const start = pen.strokes[1][0];
  assert.ok(Math.abs(start.alongM - end.alongM - distanceM(end, start)) < 1);
});
