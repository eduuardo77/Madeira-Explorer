/**
 * Tests for keeping the home map on the islands (T-223, review N8).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { fitBounds } from './cameraFit.ts';
import { isOffArchipelago, recentreTarget, zoomFloor, ZOOM_OUT_MARGIN } from './mapFence.ts';

/** Invented, the shape of the shipped metadata's box (D-017: no Madeira here). */
const BOX = { west: -17.3, south: 32.4, east: -16.2, north: 33.2 };
const PHONE = { width: 360, height: 780 };

test('the floor lets the whole archipelago fit, and a little more, and no more', () => {
  const floor = zoomFloor(BOX, PHONE);
  const fit = fitBounds([BOX.west, BOX.south, BOX.east, BOX.north], PHONE);
  assert.ok(floor !== null && fit !== null);
  assert.equal(floor, fit.zoom - ZOOM_OUT_MARGIN);
  // Far above expo-maps' default of 3, which is half the planet.
  assert.ok(floor > 6, `floor ${floor}`);
});

test('a viewport with no room gives no floor, so the map keeps its default', () => {
  assert.equal(zoomFloor(BOX, { width: 0, height: 780 }), null);
});

test('open sea on every side is off the archipelago; the middle is not', () => {
  const middle = { latitude: 32.8, longitude: -16.8 };
  assert.equal(isOffArchipelago(middle, BOX), false);
  for (const point of [
    { latitude: 31.9, longitude: -16.8 },
    { latitude: 33.6, longitude: -16.8 },
    { latitude: 32.8, longitude: -17.9 },
    { latitude: 32.8, longitude: -15.6 },
  ]) {
    assert.equal(isOffArchipelago(point, BOX), true, JSON.stringify(point));
  }
});

test('Centrar goes to the user on the islands, and to the islands otherwise', () => {
  assert.equal(recentreTarget({ latitude: 32.7, longitude: -16.9 }, BOX), 'user');
  assert.equal(recentreTarget(null, BOX), 'islands');
  // A user planning from Lisbon must not be sent back to the ocean's far side.
  assert.equal(recentreTarget({ latitude: 38.7, longitude: -9.1 }, BOX), 'islands');
});
