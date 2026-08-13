/**
 * Tests for the place card's arithmetic and wording (T-115, D-018).
 *
 *     cd app && npm test
 *
 * What is being pinned down is one rule, in four shapes: **the card never
 * shows a distance it cannot vouch for.** An old fix, a wild fix, a fix from a
 * clock that jumped, or no fix at all all end the same way — the place, and no
 * number. That is D-041's reflex applied to a second figure.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPlaceCard,
  formatDistance,
  isPositionUsable,
  MAX_POSITION_AGE_MS,
  type LastKnownPosition,
  type PlaceCardInput,
} from './placeCard.ts';

const NOW = 1_800_000_000_000;

/** Funchal-ish, and a point a known distance from it. */
const HERE = { lat: 32.65, lon: -16.91 };

function position(overrides: Partial<LastKnownPosition> = {}): LastKnownPosition {
  return { ts: NOW - 60_000, ...HERE, accuracy_m: 12, ...overrides };
}

function input(overrides: Partial<PlaceCardInput> = {}): PlaceCardInput {
  return {
    placeId: 'p1',
    name: 'A place',
    category: 'viewpoint',
    collected: false,
    lat: 32.66,
    lon: -16.91,
    position: position(),
    nowMs: NOW,
    ...overrides,
  };
}

test('formatting drops precision as the number grows', () => {
  assert.equal(formatDistance(0), '10 m');
  assert.equal(formatDistance(3), '10 m');
  assert.equal(formatDistance(447), '450 m');
  assert.equal(formatDistance(999), '1000 m');
  assert.equal(formatDistance(1000), '1.0 km');
  assert.equal(formatDistance(1243), '1.2 km');
  assert.equal(formatDistance(9949), '9.9 km');
  assert.equal(formatDistance(23_400), '23 km');
});

test('a distance is never reported as zero', () => {
  // `0 m` reads as a bug, not as "you are standing on it".
  assert.equal(formatDistance(0), '10 m');
  assert.ok(!formatDistance(4).startsWith('0'));
});

test('formatting refuses nonsense rather than printing NaN', () => {
  assert.throws(() => formatDistance(Number.NaN));
  assert.throws(() => formatDistance(-1));
});

test('a fresh, precise fix gives a distance', () => {
  const card = buildPlaceCard(input());
  assert.ok(card.distanceM !== null);
  // 0.01° of latitude, ~1.1 km.
  assert.ok(card.distanceM! > 1050 && card.distanceM! < 1150, String(card.distanceM));
  assert.equal(card.distanceLabel, '1.1 km');
});

test('no position at all: the place, and no number', () => {
  const card = buildPlaceCard(input({ position: null }));
  assert.equal(card.distanceM, null);
  assert.equal(card.distanceLabel, null);
  assert.equal(card.name, 'A place');
});

test('a stale fix is not a position', () => {
  const justInside = buildPlaceCard(
    input({ position: position({ ts: NOW - MAX_POSITION_AGE_MS + 1000 }) })
  );
  assert.ok(justInside.distanceLabel !== null);

  const justOutside = buildPlaceCard(
    input({ position: position({ ts: NOW - MAX_POSITION_AGE_MS - 1000 }) })
  );
  assert.equal(justOutside.distanceLabel, null);
});

test('a fix from the future is refused, not treated as fresh', () => {
  // A clock that moved — a phone crossing a timezone, or an NTP correction —
  // must not read as an age of minus ten minutes.
  assert.equal(
    isPositionUsable(position({ ts: NOW + 60_000 }), NOW),
    false
  );
});

test('a fix too wild to draw is too wild to measure from', () => {
  // The same 120 m cut the trace drawing makes. Under canopy a fix can land
  // hundreds of metres out; a distance built on it is fiction.
  assert.equal(isPositionUsable(position({ accuracy_m: 119 }), NOW), true);
  assert.equal(isPositionUsable(position({ accuracy_m: 500 }), NOW), false);
  // A platform that reports no accuracy at all is still believed — refusing it
  // would blank the distance permanently there.
  assert.equal(isPositionUsable(position({ accuracy_m: null }), NOW), true);
});

test('an unusable coordinate on either side yields no distance', () => {
  assert.equal(buildPlaceCard(input({ lat: Number.NaN })).distanceLabel, null);
  assert.equal(
    buildPlaceCard(input({ position: position({ lat: 999 }) })).distanceLabel,
    null
  );
});

test('the category is a word, not a slug', () => {
  assert.equal(buildPlaceCard(input({ category: 'levada' })).categoryLabel, 'Levada walk');
  assert.equal(buildPlaceCard(input({ category: 'beach' })).categoryLabel, 'Beach');
});

test('collected is carried through untouched — the card states it, it does not decide it', () => {
  assert.equal(buildPlaceCard(input({ collected: true })).collected, true);
  assert.equal(buildPlaceCard(input({ collected: false })).collected, false);
});

test('the coordinate the Directions button will use is the one on the card', () => {
  // Not a tautology: it is the *representative geofence's* coordinate, and a
  // levada card that handed over its exit instead of its trailhead would send
  // the user up the wrong valley.
  const card = buildPlaceCard(input({ lat: 32.75, lon: -16.95 }));
  assert.equal(card.lat, 32.75);
  assert.equal(card.lon, -16.95);
});
