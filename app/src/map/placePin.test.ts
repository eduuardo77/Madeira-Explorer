/**
 * Tests for the map's place pin (N12).
 *
 *     cd app && npm test
 *
 * The PNG the map shows is rendered from `placePinSvg` by
 * `tools/build-place-pin.mjs`. These keep the two in step and check the PNG
 * is the size the native side expects.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { PIN_HEIGHT_DP, PIN_PNG_SCALE, PIN_WIDTH_DP, placePinFingerprint, placePinSvg } from './placePin.ts';
import { PLACE_PIN_FINGERPRINT, PLACE_PIN_PNG_BASE64 } from './placePinPng.ts';
import { reward } from '../ui/theme.ts';

test('the shipped PNG was rendered from the current drawing (rerun tools/build-place-pin.mjs)', () => {
  assert.equal(PLACE_PIN_FINGERPRINT, placePinFingerprint());
});

test('the PNG is the pin at 3 px per dp', () => {
  const png = Buffer.from(PLACE_PIN_PNG_BASE64, 'base64');
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  // IHDR: width and height, big-endian, at bytes 16 and 20.
  assert.equal(png.readUInt32BE(16), PIN_WIDTH_DP * PIN_PNG_SCALE);
  assert.equal(png.readUInt32BE(20), PIN_HEIGHT_DP * PIN_PNG_SCALE);
});

test('the pin is the gold of an earned stamp, not a hard-coded colour', () => {
  const svg = placePinSvg();
  assert.ok(svg.includes(reward.gold));
  assert.ok(svg.includes(reward.goldDeep));
});

test('the fingerprint notices an edit', () => {
  assert.notEqual(placePinFingerprint('<svg/>'), placePinFingerprint('<svg />'));
});
