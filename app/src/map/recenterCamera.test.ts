/**
 * The re-center rule (T-167).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  recenterCamera,
  RECENTER_MAX_AGE_MS,
  RECENTER_ZOOM,
} from './recenterCamera.ts';

const FUNCHAL = { lat: 32.6669, lon: -16.9241 };

test('no position is not an error — the camera simply does not move', () => {
  // The screen has no answer to give on While-Using before the walk starts,
  // and flying to a stale fix or to 0,0 would both be worse than nothing.
  assert.equal(recenterCamera(null, 12), null);
  assert.equal(recenterCamera(null, null), null);
});

test('it centres on the fix', () => {
  const camera = recenterCamera(FUNCHAL, null);
  assert.deepEqual(camera?.coordinates, {
    latitude: FUNCHAL.lat,
    longitude: FUNCHAL.lon,
  });
});

test('from the island view it zooms in to the street', () => {
  // The app opens framing all of Madeira (D-053), which is where the button
  // gets pressed first. Landing there and staying there would be a no-op the
  // user reads as a broken control.
  const camera = recenterCamera(FUNCHAL, 9);
  assert.equal(camera?.zoom, RECENTER_ZOOM);
});

test('a zoom the user chose themselves survives being re-centred', () => {
  // ⚠ The decision this module exists for. Somebody pinched in to read a
  // street name; pressing re-center must move the map under them, not undo it.
  const camera = recenterCamera(FUNCHAL, 18.5);
  assert.equal(camera?.zoom, 18.5);
});

test('with no zoom yet it uses the street floor', () => {
  // `onCameraMove` has not fired before the first press on a cold launch.
  assert.equal(recenterCamera(FUNCHAL, null)?.zoom, RECENTER_ZOOM);
});

test('pressing it twice from a pinched view changes nothing but the centre', () => {
  const first = recenterCamera(FUNCHAL, 17.2);
  const second = recenterCamera(FUNCHAL, first?.zoom ?? null);
  assert.deepEqual(second, first);
});

test('the staleness bound is minutes, not hours', () => {
  // A cached fix from yesterday's walk is not an answer to "where am I".
  // This holds the guess in place until a real walk corrects it.
  assert.ok(RECENTER_MAX_AGE_MS >= 30_000);
  assert.ok(RECENTER_MAX_AGE_MS <= 300_000);
});

test('the street floor is a street floor', () => {
  // Below ~14 individual roads stop being named; above ~18 the map is a
  // pavement. Either end would make the control answer a different question.
  assert.ok(RECENTER_ZOOM >= 14 && RECENTER_ZOOM <= 18);
});
