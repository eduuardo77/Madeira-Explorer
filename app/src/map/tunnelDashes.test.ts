import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runPolylines, type LatLng } from './tunnelDashes.ts';

const line: LatLng[] = [
  { latitude: 32.65, longitude: -16.92 },
  { latitude: 32.65, longitude: -16.9186 },
  { latitude: 32.651, longitude: -16.9186 },
];

test('a tunnel or a cable car is one polyline, dashed by the map: never one per dash (17 Oct)', () => {
  const dashed = runPolylines('a', line, true, '#00f', 4);
  assert.equal(dashed.length, 1);
  assert.equal(dashed[0].dashed, true);
  assert.deepEqual(dashed[0].coordinates, line, 'the run keeps every point, so it follows the road');
  assert.equal(dashed[0].color, '#00f');
});

test('a road, and a line too short to dash, stay whole and solid', () => {
  const road = runPolylines('a', line, false, '#00f', 4);
  assert.equal(road.length, 1);
  assert.equal(road[0].dashed, undefined);
  assert.equal(runPolylines('a', [line[0]], true, '#00f', 4)[0].dashed, undefined);
});
