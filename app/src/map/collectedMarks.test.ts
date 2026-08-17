/**
 * Tests for the collected-place marks (T-112).
 *
 *     cd app && npm test
 *
 * The one that matters is the scale test. The design is in points and the SDK
 * takes metres, so the whole module is a unit conversion — and a unit conversion
 * that is wrong by the device's pixel density looks like a *design* problem
 * ("the dots are too small"), which is the wrong place to go looking.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Place } from '../content/contentPack.ts';
import {
  buildCollectedMarks,
  METRES_PER_POINT_AT_ZOOM_0,
  MIN_MARK_ZOOM,
  metresPerPoint,
  withOpacity,
} from './collectedMarks.ts';
import { PLACE_MARKER_PAINT } from './placeStyle.ts';

const FUNCHAL_LAT = 32.65;

const place = (id: string, lat = FUNCHAL_LAT, lon = -16.91): Place =>
  ({
    id,
    name: id,
    category: 'viewpoint',
    regionId: 'funchal',
    geofences: [{ id: `${id}-main`, role: 'main', lat, lon, radiusM: 250 }],
  }) as Place;

const paint = PLACE_MARKER_PAINT.light.collected;

test('one point covers fewer metres the closer you zoom, halving each level', () => {
  const near = metresPerPoint(12, FUNCHAL_LAT);
  const nearer = metresPerPoint(13, FUNCHAL_LAT);
  assert.ok(Math.abs(near / nearer - 2) < 1e-9, 'each zoom level should halve the scale');
});

test('⚠ Mercator shrinks with latitude, and Madeira is not the equator', () => {
  const atMadeira = metresPerPoint(12, FUNCHAL_LAT);
  const atEquator = metresPerPoint(12, 0);
  assert.ok(atMadeira < atEquator, 'the correction must reduce the scale, not raise it');
  // cos(32.65°) ≈ 0.8418 — a 16% correction, which is worth getting right.
  assert.ok(Math.abs(atMadeira / atEquator - Math.cos((FUNCHAL_LAT * Math.PI) / 180)) < 1e-12);
});

test('the zoom-0 constant is the equatorial circumference over one 256-point tile', () => {
  // 2πR / 256 with R = 6378137 m. Stated independently of the constant so a typo
  // in it fails here rather than scaling every mark on every screen.
  const expected = (2 * Math.PI * 6_378_137) / 256;
  assert.ok(Math.abs(METRES_PER_POINT_AT_ZOOM_0 - expected) < 0.01);
});

test('⚠ a mark holds its screen size, so its ground radius grows as you zoom out', () => {
  const [close] = buildCollectedMarks([place('a')], new Set(['a']), 16, paint);
  const [far] = buildCollectedMarks([place('a')], new Set(['a']), 12, paint);
  assert.ok(close !== undefined && far !== undefined);
  // Four zoom levels out is sixteen times the ground radius for the same dot.
  assert.ok(Math.abs(far.radius / close.radius - 16) < 1e-6);
});

test('the radius is the designed point radius, converted — not a new number', () => {
  const [mark] = buildCollectedMarks([place('a')], new Set(['a']), 14, paint);
  assert.ok(mark !== undefined);
  assert.ok(
    Math.abs(mark.radius - paint.radius * metresPerPoint(14, FUNCHAL_LAT)) < 1e-9
  );
});

test('only collected places are marked', () => {
  const marks = buildCollectedMarks(
    [place('collected'), place('not-collected', 32.7, -17.0)],
    new Set(['collected']),
    14,
    paint
  );
  assert.deepEqual(
    marks.map((m) => m.id),
    ['collected']
  );
});

test('⚠ nothing is marked at island zoom, where the dots would read as speckle', () => {
  const marks = buildCollectedMarks(
    [place('a')],
    new Set(['a']),
    MIN_MARK_ZOOM - 0.5,
    paint
  );
  assert.deepEqual(marks, []);
});

test('a nonsense zoom draws nothing rather than a mark the size of the Atlantic', () => {
  for (const zoom of [Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(buildCollectedMarks([place('a')], new Set(['a']), zoom, paint), []);
  }
});

test('the mark id is the place id, so a tap can open the right card', () => {
  const [mark] = buildCollectedMarks([place('pico-do-arieiro')], new Set(['pico-do-arieiro']), 14, paint);
  assert.equal(mark?.id, 'pico-do-arieiro');
});

test('opacity becomes an alpha byte, and a fully opaque colour is left alone', () => {
  assert.equal(withOpacity('#0d1319', 0.7), '#0d1319b3');
  assert.equal(withOpacity('#ffffff', 1), '#ffffff');
  assert.equal(withOpacity('#ffffff', 0), '#ffffff00');
});

test('⚠ the mark stays quieter than the trace, in both styles', () => {
  // The rule placeStyle.ts is held to (design brief §2.3): a place marker is
  // never louder than the trace. Asserted here too because this module is the
  // first thing that actually *draws* the collected paint, and a future tweak
  // to make the dots "pop" would be the exact regression.
  for (const style of ['light', 'dark'] as const) {
    const collected = PLACE_MARKER_PAINT[style].collected;
    assert.ok(collected.radius <= 8, `${style} collected dot is getting large`);
    assert.ok(collected.strokeWidth <= 3, `${style} collected casing is getting heavy`);
  }
});
