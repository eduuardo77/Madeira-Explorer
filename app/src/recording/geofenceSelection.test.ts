/**
 * Tests for the geofence selection arithmetic (T-039).
 *
 * HOW TO RUN THESE — no phone, no development build, no dependencies:
 *
 *     cd app && npm test
 *
 * They use Node's own test runner and Node's own TypeScript support (Node 22+
 * strips types on the fly), so there is no Jest, no Babel and nothing added to
 * `package.json` beyond a script. That matters right now: the app has no
 * development build yet, so this file is the only executable evidence in the
 * project that any of this logic is correct.
 *
 * Everything here is synthetic. The places are generated from offsets in
 * metres, not taken from Madeira — the selection code must not know or care
 * where it is (D-017).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { distanceM } from './distance.ts';
import {
  ANCHOR_REGION_ID,
  edgeDistanceM,
  selectionOptionsFor,
  selectWorkingSet,
  shouldRebuild,
  type GeofencePlace,
} from './geofenceSelection.ts';

const ORIGIN = { lat: 32.65, lon: -16.9 };

/**
 * ⚠ Deliberately NOT `offsetByMetres` from `distance.ts`.
 *
 * This helper is the independent oracle for the code under test — the two tests
 * immediately below assert that `distanceM` and this formula agree about how
 * far 111 km and 1000 m are. Sharing an implementation with the code being
 * checked would make that assertion circular and it would pass no matter what.
 */
const METRES_PER_DEGREE_LAT = 111195;

/** A place `northM` north and `eastM` east of the origin. */
function placeAt(
  poiId: string,
  northM: number,
  eastM: number,
  radiusM = 100
): GeofencePlace {
  const lat = ORIGIN.lat + northM / METRES_PER_DEGREE_LAT;
  const lon =
    ORIGIN.lon +
    eastM / (METRES_PER_DEGREE_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180));
  return { poiId, lat, lon, radiusM };
}

/** A ring of `count` places at `metres` from the origin. */
function ringOf(count: number, metres: number, radiusM = 100): GeofencePlace[] {
  const places: GeofencePlace[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (2 * Math.PI * i) / count;
    places.push(
      placeAt(
        `ring-${metres}-${i}`,
        Math.cos(angle) * metres,
        Math.sin(angle) * metres,
        radiusM
      )
    );
  }
  return places;
}

// ---------------------------------------------------------------------------
// distance
// ---------------------------------------------------------------------------

test('one degree of latitude is about 111 km', () => {
  const metres = distanceM({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
  assert.ok(Math.abs(metres - 111195) < 5, `got ${metres}`);
});

test('the test helper places points where it says it does', () => {
  const metres = distanceM(ORIGIN, placeAt('p', 0, 1000));
  assert.ok(Math.abs(metres - 1000) < 2, `got ${metres}`);
});

// ---------------------------------------------------------------------------
// selection
// ---------------------------------------------------------------------------

test('a catalogue smaller than the cap is monitored whole, with no anchor', () => {
  const catalogue = ringOf(5, 1000);
  const set = selectWorkingSet(catalogue, ORIGIN, selectionOptionsFor(20));

  assert.equal(set.monitored.length, 5);
  assert.equal(set.regions.length, 5);
  assert.equal(set.unmonitoredCount, 0);
  assert.equal(set.anchor, null);
  assert.ok(!set.regions.some((region) => region.poiId === ANCHOR_REGION_ID));
});

test('a catalogue larger than the cap fills the cap exactly, anchor included', () => {
  const catalogue = [...ringOf(10, 500), ...ringOf(10, 2000), ...ringOf(10, 9000)];
  const set = selectWorkingSet(catalogue, ORIGIN, selectionOptionsFor(20));

  assert.equal(set.regions.length, 20, 'never hand the OS more than it allows');
  assert.equal(set.monitored.length, 19);
  assert.equal(set.unmonitoredCount, 11);
  assert.notEqual(set.anchor, null);

  const anchors = set.regions.filter((region) => region.poiId === ANCHOR_REGION_ID);
  assert.equal(anchors.length, 1);
});

test('the nearest places are the ones monitored', () => {
  const catalogue = [...ringOf(10, 500), ...ringOf(10, 2000), ...ringOf(10, 9000)];
  const set = selectWorkingSet(catalogue, ORIGIN, selectionOptionsFor(20));

  const monitoredIds = new Set(set.monitored.map((place) => place.poiId));
  for (const place of ringOf(10, 500)) {
    assert.ok(monitoredIds.has(place.poiId), `${place.poiId} should be monitored`);
  }
  for (const place of ringOf(10, 9000)) {
    assert.ok(!monitoredIds.has(place.poiId), `${place.poiId} should not be`);
  }
});

test('a catalogue exactly the size of the cap still needs no anchor', () => {
  const catalogue = ringOf(20, 1000);
  const set = selectWorkingSet(catalogue, ORIGIN, selectionOptionsFor(20));

  assert.equal(set.monitored.length, 20, 'the anchor slot is only reserved when it is needed');
  assert.equal(set.anchor, null);
});

test('the anchor stops short of the nearest unmonitored place', () => {
  // Cap of 3 leaves room for 2 places plus the anchor, so the 5 km place is the
  // nearest one left out — and it is the one that binds the radius.
  const catalogue = [
    placeAt('near-a', 100, 0),
    placeAt('near-b', 0, 200),
    placeAt('far', 5000, 0, 250),
    placeAt('further', 9000, 0),
  ];
  const options = selectionOptionsFor(3);
  const set = selectWorkingSet(catalogue, ORIGIN, options);

  assert.deepEqual(
    set.monitored.map((place) => place.poiId),
    ['near-a', 'near-b']
  );
  assert.equal(set.unmonitoredCount, 2);
  assert.notEqual(set.anchor, null);

  const expected = 5000 - 250 - options.anchorMarginM;
  assert.ok(
    Math.abs((set.anchor?.radiusM ?? 0) - expected) < 5,
    `expected about ${expected}, got ${set.anchor?.radiusM}`
  );
  assert.ok(set.anchorCoversUnmonitored);
});

test('inside the anchor, no unmonitored place can have been reached', () => {
  // The property the whole design rests on, asserted directly: walk outwards in
  // every direction, and as long as we are still inside the anchor, every
  // unmonitored place is still further away than its own radius.
  const catalogue = [
    ...ringOf(15, 800),
    ...ringOf(15, 4000, 300),
    ...ringOf(10, 12000, 500),
  ];
  const set = selectWorkingSet(catalogue, ORIGIN, selectionOptionsFor(20));
  const anchor = set.anchor;
  assert.notEqual(anchor, null);
  if (anchor === null) {
    return;
  }

  const monitoredIds = new Set(set.monitored.map((place) => place.poiId));
  const unmonitored = catalogue.filter((place) => !monitoredIds.has(place.poiId));

  for (let bearing = 0; bearing < 360; bearing += 15) {
    const angle = (bearing * Math.PI) / 180;
    // Just inside the anchor boundary — the worst case for the property.
    const reach = anchor.radiusM - 1;
    const at = placeAt('probe', Math.cos(angle) * reach, Math.sin(angle) * reach);

    for (const place of unmonitored) {
      assert.ok(
        edgeDistanceM(at, place) > 0,
        `at bearing ${bearing} we could already be inside ${place.poiId}`
      );
    }
  }
});

test('a place with a generous radius outranks a closer one with a tight radius', () => {
  // A levada trailhead deliberately gets a big radius (D-032). Ranking by
  // centre distance would drop it in favour of a viewpoint you cannot yet be
  // standing in, which is exactly the "walked a famous levada, got nothing"
  // failure.
  const catalogue = [
    placeAt('tight-viewpoint', 600, 0, 50),
    placeAt('wide-trailhead', 900, 0, 600),
  ];
  const set = selectWorkingSet(catalogue, ORIGIN, selectionOptionsFor(2));

  assert.equal(set.monitored[0].poiId, 'wide-trailhead');
});

test('a cluster denser than the cap clamps the anchor and says so', () => {
  const catalogue = ringOf(30, 250, 40);
  const options = selectionOptionsFor(20);
  const set = selectWorkingSet(catalogue, ORIGIN, options);

  assert.equal(set.anchor?.radiusM, options.minAnchorRadiusM);
  assert.equal(
    set.anchorCoversUnmonitored,
    false,
    'the honest answer is that this set has a hole in it'
  );
});

test('the anchor never exceeds its ceiling', () => {
  const catalogue = [
    ...ringOf(19, 300),
    placeAt('another-island-a', 200000, 0),
    placeAt('another-island-b', 210000, 0),
  ];
  const options = selectionOptionsFor(20);
  const set = selectWorkingSet(catalogue, ORIGIN, options);

  assert.equal(set.monitored.length, 19);
  assert.equal(set.anchor?.radiusM, options.maxAnchorRadiusM);
  assert.ok(set.anchorCoversUnmonitored);
});

test('the anchor is exit-only and carries the reserved id', () => {
  const catalogue = ringOf(30, 1000);
  const set = selectWorkingSet(catalogue, ORIGIN, selectionOptionsFor(20));
  const anchor = set.regions.find((region) => region.poiId === ANCHOR_REGION_ID);

  assert.notEqual(anchor, undefined);
  assert.equal(anchor?.notifyOnEnter, false);
  assert.equal(anchor?.notifyOnExit, true);
});

test('unusable catalogue rows are dropped and counted, not thrown', () => {
  const catalogue: GeofencePlace[] = [
    placeAt('good', 100, 0),
    { poiId: 'no-coords', lat: Number.NaN, lon: 0, radiusM: 100 },
    { poiId: 'off-planet', lat: 91, lon: 0, radiusM: 100 },
    { poiId: 'no-radius', lat: ORIGIN.lat, lon: ORIGIN.lon, radiusM: 0 },
  ];
  const set = selectWorkingSet(catalogue, ORIGIN, selectionOptionsFor(20));

  assert.equal(set.invalidCount, 3);
  assert.equal(set.monitored.length, 1);
  assert.equal(set.monitored[0].poiId, 'good');
});

test('the result does not depend on catalogue order', () => {
  const catalogue = [...ringOf(12, 700), ...ringOf(12, 3000)];
  const reversed = catalogue.slice().reverse();

  const a = selectWorkingSet(catalogue, ORIGIN, selectionOptionsFor(20));
  const b = selectWorkingSet(reversed, ORIGIN, selectionOptionsFor(20));

  assert.deepEqual(
    a.monitored.map((place) => place.poiId),
    b.monitored.map((place) => place.poiId)
  );
  assert.equal(a.anchor?.radiusM, b.anchor?.radiusM);
});

test('an empty catalogue and a zero cap are handled, not crashed', () => {
  assert.equal(selectWorkingSet([], ORIGIN, selectionOptionsFor(20)).regions.length, 0);

  const noSlots = selectWorkingSet(ringOf(5, 500), ORIGIN, selectionOptionsFor(0));
  assert.equal(noSlots.regions.length, 0);
  assert.equal(noSlots.unmonitoredCount, 5);
});

test('an unusable current position yields no regions rather than nonsense', () => {
  const set = selectWorkingSet(
    ringOf(5, 500),
    { lat: Number.NaN, lon: Number.NaN },
    selectionOptionsFor(20)
  );
  assert.equal(set.regions.length, 0);
});

// ---------------------------------------------------------------------------
// the backstop rebuild trigger
// ---------------------------------------------------------------------------

test('no anchor means nothing to rebuild', () => {
  assert.equal(shouldRebuild(null, ORIGIN), false);
});

test('rebuilding happens before the anchor boundary is reached', () => {
  const anchor = { lat: ORIGIN.lat, lon: ORIGIN.lon, radiusM: 4000 };

  assert.equal(shouldRebuild(anchor, placeAt('at', 1000, 0)), false);
  assert.equal(shouldRebuild(anchor, placeAt('at', 2500, 0)), false);
  assert.equal(shouldRebuild(anchor, placeAt('at', 3200, 0)), true);
  assert.equal(shouldRebuild(anchor, placeAt('at', 6000, 0)), true);
});
