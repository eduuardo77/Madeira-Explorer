import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distanceM } from '../recording/distance.ts';
import { DASH_M, dashes, GAP_M, runPolylines, type LatLng } from './tunnelDashes.ts';

const length = (line: LatLng[]) =>
  line.slice(1).reduce(
    (sum, point, i) =>
      sum + distanceM({ lat: line[i].latitude, lon: line[i].longitude }, { lat: point.latitude, lon: point.longitude }),
    0
  );

/**
 * A bent line: 130 m east, then 120 m north. The bend falls inside a dash
 * (130 m is 10 m into the sixth 24 m cycle), so a dash must turn the corner.
 */
const corner: LatLng[] = [
  { latitude: 32.65, longitude: -16.92 },
  { latitude: 32.65, longitude: -16.92 + 0.0013871 },
  { latitude: 32.65 + 0.0010808, longitude: -16.92 + 0.0013871 },
];

test('dashes are the set length, the gaps between them too, and the first starts at the start', () => {
  const cut = dashes(corner);
  assert.deepEqual(cut[0][0], corner[0]);
  for (const dash of cut.slice(0, -1)) assert.ok(Math.abs(length(dash) - DASH_M) < 0.01, `${length(dash)}`);
  for (let i = 1; i < cut.length; i += 1) {
    const end = cut[i - 1][cut[i - 1].length - 1];
    const gap = distanceM({ lat: end.latitude, lon: end.longitude }, { lat: cut[i][0].latitude, lon: cut[i][0].longitude });
    // Straight-line gap; around the corner it is a little shorter than along the road.
    assert.ok(gap <= GAP_M + 0.01 && gap > GAP_M * 0.7, `${gap}`);
  }
  // About 250 m in dashes of 14 and gaps of 10.
  assert.equal(cut.length, Math.ceil(length(corner) / (DASH_M + GAP_M)));
});

test('a dash that spans the bend keeps the bend: dashes follow the road, never cut across it', () => {
  const bent = dashes(corner).find((dash) => dash.some((point) => point === corner[1]));
  assert.ok(bent !== undefined, 'one dash holds the corner point itself');
});

test('only a tunnel or a cable car is dashed; a road, and a line too short to cut, stay whole', () => {
  assert.equal(runPolylines('a', corner, false, '#00f', 4).length, 1);
  const dashed = runPolylines('a', corner, true, '#00f', 4);
  assert.ok(dashed.length > 1);
  assert.ok(dashed.every((line) => line.color === '#00f' && line.id.startsWith('a-')));
  assert.equal(runPolylines('a', [corner[0]], true, '#00f', 4).length, 1);
});
