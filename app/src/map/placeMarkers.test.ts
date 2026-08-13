/**
 * Tests for the place marker layer (T-115).
 *
 *     cd app && npm test
 *
 * What is being pinned down: one marker per place rather than per geofence, a
 * levada marked at its trailhead rather than its exit, and departure points
 * never drawn. The first two are what stop the map growing a second
 * unexplained dot in the mountains; the third is what stops the airport
 * looking like something to collect.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ContentPack, Place } from '../content/contentPack.ts';
import { buildPlaceMarkers, representativeGeofence } from './placeMarkers.ts';

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

function pack(places: Place[], departurePoints: ContentPack['departurePoints'] = []): ContentPack {
  return { formatVersion: 1, destination: null, places, departurePoints };
}

test('one marker per place, in [lon, lat] order', () => {
  const markers = buildPlaceMarkers(
    pack([
      place({ id: 'a' }),
      place({
        id: 'b',
        geofences: [
          { id: 'b-g', role: 'main', lat: 32.7, lon: -17.1, radiusM: 200 },
        ],
      }),
    ]),
    new Set()
  );

  assert.equal(markers.features.length, 2);
  assert.deepEqual(markers.features[1].geometry.coordinates, [-17.1, 32.7]);
});

test('a levada is one marker, at the trailhead', () => {
  // Two geofences, hours and kilometres apart. The card sends the user to the
  // start — nobody drives to the exit.
  const levada = place({
    id: 'lev',
    category: 'levada',
    geofences: [
      { id: 'lev-end', role: 'end', lat: 32.78, lon: -17.05, radiusM: 200 },
      { id: 'lev-start', role: 'start', lat: 32.75, lon: -16.95, radiusM: 200 },
    ],
  });

  const markers = buildPlaceMarkers(pack([levada]), new Set());

  assert.equal(markers.features.length, 1);
  assert.deepEqual(markers.features[0].geometry.coordinates, [-16.95, 32.75]);
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

test('a place with only an end still draws — a marker at the wrong end beats none', () => {
  const odd = place({
    id: 'odd',
    geofences: [{ id: 'odd-end', role: 'end', lat: 32.7, lon: -17.0, radiusM: 100 }],
  });
  assert.equal(buildPlaceMarkers(pack([odd]), new Set()).features.length, 1);
});

test('departure points are never drawn', () => {
  const markers = buildPlaceMarkers(
    pack(
      [place({ id: 'a' })],
      [{ id: 'airport', name: 'Airport', lat: 32.69, lon: -16.77, radiusM: 1500 }]
    ),
    new Set()
  );

  assert.equal(markers.features.length, 1);
  assert.equal(markers.features[0].properties.placeId, 'a');
});

test('collected is set from awarded PLACE ids, not geofence ids', () => {
  const levada = place({
    id: 'lev',
    category: 'levada',
    geofences: [
      { id: 'lev-start', role: 'start', lat: 32.75, lon: -16.95, radiusM: 200 },
      { id: 'lev-end', role: 'end', lat: 32.78, lon: -17.05, radiusM: 200 },
    ],
  });

  const markers = buildPlaceMarkers(pack([place({ id: 'a' }), levada]), new Set(['lev']));

  assert.equal(markers.features[0].properties.collected, false);
  assert.equal(markers.features[1].properties.collected, true);

  // The geofence id is not the place id, and using one for the other would
  // mark every levada uncollected forever.
  const wrong = buildPlaceMarkers(pack([levada]), new Set(['lev-start']));
  assert.equal(wrong.features[0].properties.collected, false);
});

test('properties stay flat — they cross into native and come back as JSON', () => {
  const markers = buildPlaceMarkers(pack([place({ id: 'a', name: 'Somewhere' })]), new Set());
  for (const value of Object.values(markers.features[0].properties)) {
    assert.ok(
      ['string', 'number', 'boolean'].includes(typeof value),
      `property ${String(value)} is not a primitive`
    );
  }
  assert.equal(markers.features[0].properties.name, 'Somewhere');
});

test('an unusable coordinate is skipped rather than drawn at 0,0', () => {
  const broken = place({
    id: 'broken',
    geofences: [
      { id: 'broken-g', role: 'main', lat: Number.NaN, lon: -17, radiusM: 100 },
    ],
  });
  assert.equal(buildPlaceMarkers(pack([broken]), new Set()).features.length, 0);
});

test('an empty pack is an empty layer, not a crash', () => {
  assert.deepEqual(buildPlaceMarkers(pack([]), new Set()), {
    type: 'FeatureCollection',
    features: [],
  });
});
