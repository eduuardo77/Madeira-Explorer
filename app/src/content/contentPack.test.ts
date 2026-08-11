/**
 * Tests for content pack parsing (T-040).
 *
 *     cd app && npm test
 *
 * The point of these is not that JSON parsing works. It is that a hand-edited
 * file of 200 rows fails in the *right way*: one bad row costs one place, and
 * only a structurally broken file stops the app. Curation is weeks of manual
 * work by one person (T-066), so being wrong somewhere in it is the expected
 * state, not the exceptional one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countByCategory,
  MAX_GEOFENCE_RADIUS_M,
  MIN_GEOFENCE_RADIUS_M,
  parseContentPack,
  toGeofencePlaces,
} from './contentPack.ts';

/** A minimal valid place. Coordinates are synthetic; no content lives here. */
function placeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'a-place',
    name: 'A Place',
    category: 'viewpoint',
    regionId: 'a-region',
    geofences: [{ id: 'a-place', lat: 32.65, lon: -16.9, radiusM: 200 }],
    ...overrides,
  };
}

function pack(places: unknown[]): unknown {
  return { formatVersion: 1, places };
}

function departurePoint(overrides: Record<string, unknown> = {}) {
  return {
    id: 'an-airport',
    name: 'An Airport',
    lat: 32.69,
    lon: -16.77,
    radiusM: 1200,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// structural failures throw
// ---------------------------------------------------------------------------

test('a pack that is not an object throws', () => {
  assert.throws(() => parseContentPack(null));
  assert.throws(() => parseContentPack([]));
  assert.throws(() => parseContentPack('places'));
});

test('an unsupported formatVersion throws rather than guessing', () => {
  assert.throws(() => parseContentPack({ formatVersion: 2, places: [] }));
  assert.throws(() => parseContentPack({ places: [] }));
});

test('a missing places array throws', () => {
  assert.throws(() => parseContentPack({ formatVersion: 1 }));
});

test('an empty pack is valid — it is the state T-066 starts from', () => {
  const result = parseContentPack(pack([]));
  assert.equal(result.pack.places.length, 0);
  assert.equal(result.problems.length, 0);
});

// ---------------------------------------------------------------------------
// bad rows are dropped, not fatal
// ---------------------------------------------------------------------------

test('one bad row costs one place and nothing else', () => {
  const result = parseContentPack(
    pack([
      placeRow({ id: 'good-one', geofences: [{ id: 'g1', lat: 32.6, lon: -16.9, radiusM: 200 }] }),
      placeRow({ id: 'bad-one', category: 'restaurant' }),
      placeRow({ id: 'good-two', geofences: [{ id: 'g2', lat: 32.7, lon: -17.0, radiusM: 200 }] }),
    ])
  );

  assert.deepEqual(
    result.pack.places.map((place) => place.id),
    ['good-one', 'good-two']
  );
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0].problem, /restaurant/);
});

test('the reserved `__` prefix is rejected on places and on geofences', () => {
  const places = parseContentPack(pack([placeRow({ id: '__anchor__' })]));
  assert.equal(places.pack.places.length, 0);

  const geofences = parseContentPack(
    pack([placeRow({ geofences: [{ id: '__anchor__', lat: 32.6, lon: -16.9, radiusM: 200 }] })])
  );
  assert.equal(geofences.pack.places.length, 0);
});

test('duplicate ids are rejected — the second one loses', () => {
  const result = parseContentPack(
    pack([
      placeRow({ id: 'twice', geofences: [{ id: 'g1', lat: 32.6, lon: -16.9, radiusM: 200 }] }),
      placeRow({ id: 'twice', geofences: [{ id: 'g2', lat: 32.7, lon: -17.0, radiusM: 200 }] }),
    ])
  );

  assert.equal(result.pack.places.length, 1);
  assert.match(result.problems[0].problem, /duplicate place id/);
});

test('a geofence id duplicated across two places is rejected', () => {
  // This one matters more than it looks: the id is all the OS hands back, so a
  // collision would credit a stamp to the wrong place, silently.
  const result = parseContentPack(
    pack([
      placeRow({ id: 'first', geofences: [{ id: 'shared', lat: 32.6, lon: -16.9, radiusM: 200 }] }),
      placeRow({ id: 'second', geofences: [{ id: 'shared', lat: 32.7, lon: -17.0, radiusM: 200 }] }),
    ])
  );

  assert.deepEqual(
    result.pack.places.map((place) => place.id),
    ['first']
  );
  assert.match(result.problems[0].problem, /duplicate geofence id/);
});

test('radii outside the usable band are rejected at both ends', () => {
  const tooSmall = parseContentPack(
    pack([
      placeRow({
        geofences: [
          { id: 'g', lat: 32.6, lon: -16.9, radiusM: MIN_GEOFENCE_RADIUS_M - 1 },
        ],
      }),
    ])
  );
  assert.equal(tooSmall.pack.places.length, 0);

  const tooBig = parseContentPack(
    pack([
      placeRow({
        geofences: [
          { id: 'g', lat: 32.6, lon: -16.9, radiusM: MAX_GEOFENCE_RADIUS_M + 1 },
        ],
      }),
    ])
  );
  assert.equal(tooBig.pack.places.length, 0);
});

test('an unusable coordinate is rejected', () => {
  const result = parseContentPack(
    pack([placeRow({ geofences: [{ id: 'g', lat: 'north', lon: -16.9, radiusM: 200 }] })])
  );
  assert.equal(result.pack.places.length, 0);
});

test('a place is all or nothing — one bad geofence drops the whole place', () => {
  // Half a levada would credit a walk the user did not finish.
  const result = parseContentPack(
    pack([
      placeRow({
        id: 'levada-x',
        category: 'levada',
        geofences: [
          { id: 'levada-x/start', role: 'start', lat: 32.6, lon: -16.9, radiusM: 400 },
          { id: 'levada-x/end', role: 'end', lat: 32.7, lon: -17.0, radiusM: -5 },
        ],
      }),
    ])
  );

  assert.equal(result.pack.places.length, 0);
});

test('a place with no geofences is rejected', () => {
  assert.equal(parseContentPack(pack([placeRow({ geofences: [] })])).pack.places.length, 0);
});

// ---------------------------------------------------------------------------
// shapes the rest of the app depends on
// ---------------------------------------------------------------------------

test('role defaults to main and levadas can carry start and end', () => {
  const result = parseContentPack(
    pack([
      placeRow({ id: 'ordinary', geofences: [{ id: 'g1', lat: 32.6, lon: -16.9, radiusM: 200 }] }),
      placeRow({
        id: 'levada-x',
        category: 'levada',
        geofences: [
          { id: 'levada-x/start', role: 'start', lat: 32.6, lon: -16.9, radiusM: 400 },
          { id: 'levada-x/end', role: 'end', lat: 32.7, lon: -17.0, radiusM: 400 },
        ],
      }),
    ])
  );

  assert.equal(result.problems.length, 0);
  assert.equal(result.pack.places[0].geofences[0].role, 'main');
  assert.deepEqual(
    result.pack.places[1].geofences.map((geofence) => geofence.role),
    ['start', 'end']
  );
});

test('a levada flattens to two independently monitored regions', () => {
  const result = parseContentPack(
    pack([
      placeRow({
        id: 'levada-x',
        category: 'levada',
        geofences: [
          { id: 'levada-x/start', role: 'start', lat: 32.6, lon: -16.9, radiusM: 400 },
          { id: 'levada-x/end', role: 'end', lat: 32.7, lon: -17.0, radiusM: 400 },
        ],
      }),
    ])
  );

  const monitored = toGeofencePlaces(result.pack);
  assert.deepEqual(
    monitored.map((place) => place.poiId),
    ['levada-x/start', 'levada-x/end']
  );
  assert.equal(monitored[0].radiusM, 400);
});

test('category counts cover all five rows, including the empty ones', () => {
  const result = parseContentPack(
    pack([
      placeRow({ id: 'v1', geofences: [{ id: 'v1', lat: 32.6, lon: -16.9, radiusM: 200 }] }),
      placeRow({
        id: 'v2',
        geofences: [{ id: 'v2', lat: 32.61, lon: -16.91, radiusM: 200 }],
      }),
      placeRow({
        id: 'b1',
        category: 'beach',
        geofences: [{ id: 'b1', lat: 32.62, lon: -16.92, radiusM: 200 }],
      }),
    ])
  );

  const counts = countByCategory(result.pack);
  assert.equal(counts.viewpoint, 2);
  assert.equal(counts.beach, 1);
  assert.equal(counts.levada, 0, 'the passport has five rows even when one is empty');
});

// ---------------------------------------------------------------------------
// departure points (T-099) — monitored, never stampable
// ---------------------------------------------------------------------------

test('a pack with no departurePoints is valid', () => {
  const result = parseContentPack(pack([placeRow()]));
  assert.deepEqual(result.pack.departurePoints, []);
});

test('departure points parse and are monitored alongside places', () => {
  const result = parseContentPack({
    formatVersion: 1,
    places: [placeRow({ id: 'p', geofences: [{ id: 'p', lat: 32.6, lon: -16.9, radiusM: 200 }] })],
    departurePoints: [departurePoint()],
  });

  assert.equal(result.problems.length, 0);
  assert.equal(result.pack.departurePoints[0].name, 'An Airport');
  assert.deepEqual(
    toGeofencePlaces(result.pack).map((g) => g.poiId),
    ['p', 'an-airport']
  );
});

test('a departure point is NOT a place, so it can never earn a stamp', () => {
  const result = parseContentPack({
    formatVersion: 1,
    places: [],
    departurePoints: [departurePoint()],
  });

  assert.equal(result.pack.places.length, 0);
  assert.equal(result.pack.departurePoints.length, 1);
});

test('a departure point sharing a geofence id with a place is rejected', () => {
  // One namespace: the OS hands back one string, and a collision would make
  // an airport crossing indistinguishable from arriving somewhere.
  const result = parseContentPack({
    formatVersion: 1,
    places: [placeRow({ id: 'shared', geofences: [{ id: 'shared', lat: 32.6, lon: -16.9, radiusM: 200 }] })],
    departurePoints: [departurePoint({ id: 'shared' })],
  });

  assert.equal(result.pack.departurePoints.length, 0);
  assert.match(result.problems[0].problem, /duplicate geofence id/);
});

test('a departurePoints value that is not an array throws', () => {
  assert.throws(() =>
    parseContentPack({ formatVersion: 1, places: [], departurePoints: 'lisbon' })
  );
});

// ---------------------------------------------------------------------------
// The pack names the place it covers (T-116a, D-017)
// ---------------------------------------------------------------------------

test('the pack can name the place it covers', () => {
  // ⚠ This field is why D-017 can stay absolute. The reveal notification wants
  // to say "Your Madeira map is ready", and hardcoding that in `app/` meant
  // shipping for anywhere else required editing code rather than swapping a
  // `content/` directory.
  const { pack } = parseContentPack({
    formatVersion: 1,
    destination: 'Madeira',
    places: [],
  });

  assert.equal(pack.destination, 'Madeira');
});

test('a pack that does not name itself is still valid', () => {
  // Absent is legal — the app falls back to generic copy rather than refusing
  // to start over a cosmetic field.
  assert.equal(parseContentPack({ formatVersion: 1, places: [] }).pack.destination, null);
  assert.equal(
    parseContentPack({ formatVersion: 1, destination: null, places: [] }).pack.destination,
    null
  );
});

test('a destination that is present but wrong is reported, not silently dropped', () => {
  // Absent means nobody tried. Present-and-wrong means somebody did, and the
  // app is about to ignore them — which is worth a line in the validator.
  for (const bad of [123, '', '   ', {}, []]) {
    const result = parseContentPack({
      formatVersion: 1,
      destination: bad,
      places: [],
    });
    assert.equal(result.pack.destination, null, `${JSON.stringify(bad)} leaked through`);
    assert.ok(
      result.problems.some((problem) => problem.where === 'destination'),
      `${JSON.stringify(bad)} was dropped without a word`
    );
  }
});

test('a destination is trimmed, so stray whitespace never reaches the copy', () => {
  const { pack } = parseContentPack({
    formatVersion: 1,
    destination: '  Madeira  ',
    places: [],
  });
  assert.equal(pack.destination, 'Madeira');
});
