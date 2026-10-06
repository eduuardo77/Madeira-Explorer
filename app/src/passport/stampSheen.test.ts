/**
 * The band of light on a collected stamp (T-236).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SHEEN_OPACITY, SHEEN_PLACE, sheenStops } from './stampSheen.ts';

test('T-236: the band is clear at both ends and peaks, faintly, where the light falls', () => {
  for (const place of [-1, SHEEN_PLACE, 0, 1]) {
    const stops = sheenStops(place);
    assert.equal(stops[0].opacity, 0);
    assert.equal(stops[stops.length - 1].opacity, 0);
    assert.equal(Math.max(...stops.map((stop) => stop.opacity)), SHEEN_OPACITY);
    for (let i = 1; i < stops.length; i += 1) assert.ok(stops[i].offset >= stops[i - 1].offset, `${place}: in order`);
    for (const stop of stops) assert.ok(stop.offset >= 0 && stop.offset <= 1, `${place}: on the stamp`);
  }
});

test('T-236: by default the band sits where it was approved, up and to the left of centre', () => {
  const peak = sheenStops().find((stop) => stop.opacity === SHEEN_OPACITY);
  assert.ok(peak !== undefined && peak.offset < 0.5, `${peak?.offset}`);
});
