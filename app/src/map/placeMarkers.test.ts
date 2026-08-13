/**
 * Tests for the focused place marker (T-115).
 *
 *     cd app && npm test
 *
 * ⚠ These used to cover a layer of every curated place. The project lead
 * deleted that on 2026-08-13 — the route to a place is now the passport, not a
 * field of dots over the trace (D-052 revised). What survives is the part that
 * was always the interesting bit: **which end of a place the app points at**,
 * because a levada has two and only one of them is where you park.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Place } from '../content/contentPack.ts';
import { buildFocusMarker, representativeGeofence } from './placeMarkers.ts';

function place(overrides: Partial<Place> & Pick<Place, 'id'>): Place {
  return {
    name: `Place ${overrides.id}`,
    category: 'viewpoint',
    regionId: 'r1',
    geofences: [
      { id: `${overrides.id}-g`, role: 'main', lat: 32.65, lon: -16.9, radiusM: 150 },
    ],
    ...overrides,
  };
}

test('one place, one marker, in [lon, lat] order', () => {
  const markers = buildFocusMarker(place({ id: 'a' }), false);

  assert.equal(markers.features.length, 1);
  assert.deepEqual(markers.features[0].geometry.coordinates, [-16.9, 32.65]);
  assert.equal(markers.features[0].properties.placeId, 'a');
});

test('a levada is marked at its trailhead, not its exit', () => {
  const levada = place({
    id: 'lev',
    category: 'levada',
    geofences: [
      { id: 'lev-end', role: 'end', lat: 32.78, lon: -17.05, radiusM: 200 },
      { id: 'lev-start', role: 'start', lat: 32.75, lon: -16.95, radiusM: 200 },
    ],
  });

  assert.deepEqual(buildFocusMarker(levada, true).features[0].geometry.coordinates, [
    -16.95, 32.75,
  ]);
  assert.equal(representativeGeofence(levada).id, 'lev-start');
});

test('a main geofence wins over a start, whatever the order', () => {
  const both = place({
    id: 'both',
    geofences: [
      { id: 'both-start', role: 'start', lat: 32.7, lon: -17.0, radiusM: 100 },
      { id: 'both-main', role: 'main', lat: 32.6, lon: -16.8, radiusM: 100 },
    ],
  });
  assert.equal(representativeGeofence(both).id, 'both-main');
});

test('a place with only an end is still findable — the wrong end beats nowhere', () => {
  const odd = place({
    id: 'odd',
    geofences: [{ id: 'odd-end', role: 'end', lat: 32.7, lon: -17.0, radiusM: 100 }],
  });
  assert.equal(buildFocusMarker(odd, false).features.length, 1);
});

test('collected is carried through, because the marker is painted from it', () => {
  assert.equal(buildFocusMarker(place({ id: 'a' }), true).features[0].properties.collected, true);
  assert.equal(buildFocusMarker(place({ id: 'a' }), false).features[0].properties.collected, false);
});

test('properties stay flat — they cross into native and come back as JSON', () => {
  const markers = buildFocusMarker(place({ id: 'a', name: 'Somewhere' }), false);
  for (const value of Object.values(markers.features[0].properties)) {
    assert.ok(
      ['string', 'number', 'boolean'].includes(typeof value),
      `property ${String(value)} is not a primitive`
    );
  }
  assert.equal(markers.features[0].properties.name, 'Somewhere');
});

test('an unusable coordinate draws nothing rather than a marker at 0,0', () => {
  const broken = place({
    id: 'broken',
    geofences: [
      { id: 'broken-g', role: 'main', lat: Number.NaN, lon: -17, radiusM: 100 },
    ],
  });
  assert.deepEqual(buildFocusMarker(broken, false).features, []);
});
