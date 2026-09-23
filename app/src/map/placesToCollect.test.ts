/**
 * The places still to collect, on the home map (D-085, T-199).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { Place } from '../content/contentPack.ts';
import { buildCollectedMarks } from './collectedMarks.ts';
import {
  buildToCollectMarks,
  MIN_TO_COLLECT_ZOOM,
  NEAREST_COUNT,
  nearestPaint,
  nearestToCollect,
} from './placesToCollect.ts';
import { PLACE_MARKER_PAINT } from './placeStyle.ts';

const place = (id: string, lat: number, lon = -16.91): Place =>
  ({
    id,
    name: id,
    category: 'viewpoint',
    regionId: 'funchal',
    geofences: [{ id: `${id}-main`, role: 'main', lat, lon, radiusM: 250 }],
  }) as Place;

// Five places strung north of a user standing at 32.60, 1.1 km apart.
const PLACES = [0.01, 0.02, 0.03, 0.04, 0.05].map((step, index) =>
  place(`p${index + 1}`, 32.6 + step)
);
const USER = { lat: 32.6, lon: -16.91 };
const LIGHT = PLACE_MARKER_PAINT.light;

function marks(overrides: Partial<Parameters<typeof buildToCollectMarks>[0]> = {}) {
  return buildToCollectMarks({
    places: PLACES,
    collectedIds: new Set(),
    zoom: 12,
    position: USER,
    faint: LIGHT.uncollected,
    collected: LIGHT.collected,
    ...overrides,
  });
}

test('every place not yet collected is drawn, and a collected one is not drawn twice', () => {
  const drawn = marks({ collectedIds: new Set(['p2']) });
  assert.deepEqual(
    drawn.map((mark) => mark.id).sort(),
    ['p1', 'p3', 'p4', 'p5']
  );
});

test('the nearest three are called out, and only they', () => {
  assert.equal(NEAREST_COUNT, 3);
  const called = marks().filter((mark) => mark.nearest).map((mark) => mark.id);
  assert.deepEqual(called.sort(), ['p1', 'p2', 'p3']);
});

test('collecting the nearest moves the call-out to the next one along', () => {
  const called = marks({ collectedIds: new Set(['p1']) })
    .filter((mark) => mark.nearest)
    .map((mark) => mark.id);
  assert.deepEqual(called.sort(), ['p2', 'p3', 'p4']);
});

test('no position, no "nearest": a guess would point somebody the wrong way', () => {
  const drawn = marks({ position: null });
  assert.equal(drawn.length, PLACES.length);
  assert.equal(drawn.filter((mark) => mark.nearest).length, 0);
});

test('⚠⚠ D-085 — a ring still to collect can never look like a collected place', () => {
  // The hard rule, checked on both maps: collected is a FILLED disc (fill =
  // the signal colour); to-collect is HOLLOW (fill = near-ground), called out
  // or not. Same-looking marks would quietly deny or invent visits.
  for (const style of ['light', 'dark'] as const) {
    const paint = PLACE_MARKER_PAINT[style];
    const collected = buildCollectedMarks(PLACES, new Set(['p5']), 12, paint.collected)[0];
    const toCollect = buildToCollectMarks({
      places: PLACES,
      collectedIds: new Set(['p5']),
      zoom: 12,
      position: USER,
      faint: paint.uncollected,
      collected: paint.collected,
    });
    for (const ring of toCollect) {
      assert.notEqual(ring.color, collected.color, `${style}: ${ring.id} is filled like a collected place`);
      assert.equal(ring.color, paint.uncollected.fillColor, `${style}: ${ring.id} is not hollow`);
    }
    // And a called-out ring is larger than a faint one, but still hollow.
    const called = nearestPaint(paint.uncollected, paint.collected);
    assert.ok(called.radius > paint.uncollected.radius);
    assert.equal(called.fillColor, paint.uncollected.fillColor);
  }
});

test('the call-out reuses a measured colour, never blue or green', () => {
  // Blue is the user's own location dot; green is Google's parks and trails.
  for (const style of ['light', 'dark'] as const) {
    const paint = PLACE_MARKER_PAINT[style];
    const ring = nearestPaint(paint.uncollected, paint.collected).strokeColor;
    assert.equal(ring, paint.collected.fillColor);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(ring.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) < 40, `${style}: ${ring} is not a grey`);
  }
});

test('shown from island zoom, where the first screen is framed; not below it', () => {
  assert.ok(MIN_TO_COLLECT_ZOOM <= 9, 'the island view (about z9) must show them');
  assert.equal(marks({ zoom: MIN_TO_COLLECT_ZOOM - 0.5 }).length, 0);
  assert.equal(marks({ zoom: MIN_TO_COLLECT_ZOOM }).length, PLACES.length);
});

test('rings hold a constant size on screen as the map zooms', () => {
  const near = marks({ zoom: 13 })[0];
  const far = marks({ zoom: 12 })[0];
  assert.ok(Math.abs(far.radius / near.radius - 2) < 1e-9);
});

test('the chip names the nearest place still to collect, and nothing without a position', () => {
  assert.equal(nearestToCollect(PLACES, new Set(), USER)?.id, 'p1');
  assert.equal(nearestToCollect(PLACES, new Set(['p1', 'p2']), USER)?.id, 'p3');
  assert.equal(nearestToCollect(PLACES, new Set(), null), null);
  const all = new Set(PLACES.map((p) => p.id));
  assert.equal(nearestToCollect(PLACES, all, USER), null, 'everything collected: nothing to point at');
});

