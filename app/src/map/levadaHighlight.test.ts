/**
 * Tests for the levada course (D-055).
 *
 *     cd app && npm test
 *
 * ⚠ These once covered a filter over the basemap's own names. That approach
 * was measured on the emulator and does not work — the shipped pack carries
 * names for roads and not for levada paths — so the geometry now ships in
 * `content/levadas.geojson` and what is left here is the framing arithmetic.
 * The header of `levadaHighlight.ts` has the measurement.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { courseBounds, hasCourse } from './levadaHighlight.ts';

test('only a levada has a course', () => {
  assert.equal(hasCourse('levada'), true);
  for (const category of ['viewpoint', 'village', 'beach', 'landmark'] as const) {
    assert.equal(hasCourse(category), false);
  }
});

test('the box covers every segment, not just the first', () => {
  // A levada arrives as dozens of OSM ways, and framing only the first one
  // would show the user the first 200 m of a 10 km walk.
  const bounds = courseBounds([
    [
      [-16.89, 32.73],
      [-16.87, 32.74],
    ],
    [
      [-16.83, 32.75],
      [-16.8, 32.758],
    ],
  ]);

  assert.deepEqual(bounds, [-16.89, 32.73, -16.8, 32.758]);
});

test('the bounds are west, south, east, north — MapLibre’s order', () => {
  const [west, south, east, north] = courseBounds([
    [
      [-17.2, 32.6],
      [-16.7, 32.8],
    ],
  ])!;

  assert.ok(west < east, 'west is not west of east');
  assert.ok(south < north, 'south is not south of north');
  assert.ok(west < 0 && east < 0, 'Madeira is west of Greenwich; a sign flipped');
});

test('a broken coordinate is skipped rather than swallowing the box', () => {
  // One NaN in a MultiLineString would otherwise make every bound NaN, and
  // `fitBounds` on NaN is a camera that goes somewhere unrepeatable.
  const bounds = courseBounds([
    [
      [-16.89, 32.73],
      [Number.NaN, 32.74],
      [-16.85, 32.75],
    ],
  ]);

  assert.deepEqual(bounds, [-16.89, 32.73, -16.85, 32.75]);
});

test('nothing to frame is null, not a box at zero', () => {
  // The caller reads null as "leave the camera alone" — a levada whose name
  // did not match OSM has a card and a marker but no course.
  assert.equal(courseBounds([]), null);
  assert.equal(courseBounds([[]]), null);
  assert.equal(courseBounds([[[Number.NaN, Number.NaN]]]), null);
});
