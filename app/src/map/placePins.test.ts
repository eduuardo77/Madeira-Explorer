/**
 * The faint place pins (A6, the lead's Q1 c).
 *
 *     cd app && npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseContentPack } from '../content/contentPack.ts';
import { representativeGeofence } from './placeMarkers.ts';
import { PIN_ID_PREFIX, PINS_HIDE_ZOOM, PINS_SHOW_ZOOM, placeIdFromPin, placePins, pinsVisible } from './placePins.ts';
import { FAINT_PIN_HEIGHT_DP, FAINT_PIN_WIDTH_DP, faintPinSvg, PIN_PNG_SCALE, placePinFingerprint } from './placePin.ts';
import { FAINT_PIN_FINGERPRINT, FAINT_PIN_PNG_BASE64 } from './placePinPng.ts';

const places = parseContentPack(
  JSON.parse(readFileSync(new URL('../../../content/pois.json', import.meta.url), 'utf8'))
).pack.places;

test('the island view stays quiet: no pins until zoomed in to a town', () => {
  assert.equal(pinsVisible(10, false), false, 'the whole island');
  assert.equal(pinsVisible(12.9, false), false);
  assert.equal(pinsVisible(PINS_SHOW_ZOOM, false), true);
  assert.equal(pinsVisible(15, false), true);
});

test('pins do not flicker at the threshold: they hide only below a lower zoom', () => {
  assert.ok(PINS_HIDE_ZOOM < PINS_SHOW_ZOOM);
  assert.equal(pinsVisible(12.8, true), true, 'shown, and zoomed out a little');
  assert.equal(pinsVisible(PINS_HIDE_ZOOM, true), true);
  assert.equal(pinsVisible(12.4, true), false);
  assert.equal(pinsVisible(12.8, false), false, 'hidden, and zoomed in a little');
  assert.equal(pinsVisible(Number.NaN, true), true, 'an unreadable zoom changes nothing');
});

test('one pin for every place, at the point its card frames, named for a screen reader', () => {
  const pins = placePins(places, null);
  assert.equal(pins.length, places.length);
  assert.equal(new Set(pins.map((pin) => pin.id)).size, pins.length, 'ids are unique');
  for (const [index, place] of places.entries()) {
    const point = representativeGeofence(place);
    assert.deepEqual(pins[index].coordinates, { latitude: point.lat, longitude: point.lon });
    assert.equal(pins[index].title, place.name);
  }
});

test('the place with the gold pin gets no faint pin under it', () => {
  const focused = places[3].id;
  const pins = placePins(places, focused);
  assert.equal(pins.length, places.length - 1);
  assert.ok(!pins.some((pin) => pin.id === `${PIN_ID_PREFIX}${focused}`));
});

test('a tap finds its place, and any other marker finds none', () => {
  for (const pin of placePins(places, null).slice(0, 5)) {
    assert.ok(places.some((place) => place.id === placeIdFromPin(pin.id)));
  }
  assert.equal(placeIdFromPin(undefined), null);
  assert.equal(placeIdFromPin('9f3c-uuid-of-the-gold-pin'), null);
  assert.equal(placeIdFromPin(PIN_ID_PREFIX), null);
});

test('the faint PNG was rendered from the current drawing (rerun tools/build-place-pin.mjs)', () => {
  assert.equal(FAINT_PIN_FINGERPRINT, placePinFingerprint(faintPinSvg()));
  const png = Buffer.from(FAINT_PIN_PNG_BASE64, 'base64');
  assert.equal(png.readUInt32BE(16), FAINT_PIN_WIDTH_DP * PIN_PNG_SCALE);
  assert.equal(png.readUInt32BE(20), FAINT_PIN_HEIGHT_DP * PIN_PNG_SCALE);
});
