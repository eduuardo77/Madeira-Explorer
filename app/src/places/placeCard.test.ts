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
  MAX_SHOWN_DISTANCE_M,
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
    regionName: 'Machico',
    lat: 32.66,
    lon: -16.91,
    position: position(),
    nowMs: NOW,
    language: 'en',
    ...overrides,
  };
}

test('formatting drops precision as the number grows', () => {
  assert.equal(formatDistance(0, 'en'), '10 m');
  assert.equal(formatDistance(3, 'en'), '10 m');
  assert.equal(formatDistance(447, 'en'), '450 m');
  assert.equal(formatDistance(999, 'en'), '1000 m');
  assert.equal(formatDistance(1000, 'en'), '1.0 km');
  assert.equal(formatDistance(1243, 'en'), '1.2 km');
  assert.equal(formatDistance(9949, 'en'), '9.9 km');
  assert.equal(formatDistance(23_400, 'en'), '23 km');
});

test('a distance is never reported as zero', () => {
  // `0 m` reads as a bug, not as "you are standing on it".
  assert.equal(formatDistance(0, 'en'), '10 m');
  assert.ok(!formatDistance(4, 'en').startsWith('0'));
});

test('formatting refuses nonsense rather than printing NaN', () => {
  assert.throws(() => formatDistance(Number.NaN, 'en'));
  assert.throws(() => formatDistance(-1, 'en'));
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

test('the region is a word too, or nothing at all (T-067)', () => {
  assert.equal(buildPlaceCard(input()).regionLabel, 'Machico');
  // A pack built before the boundaries existed, or a place filed under a
  // region that has since been renamed. The card drops the word rather than
  // showing a slug or an empty separator.
  assert.equal(buildPlaceCard(input({ regionName: null })).regionLabel, null);
  assert.equal(buildPlaceCard(input({ regionName: '  ' })).regionLabel, null);
  assert.equal(buildPlaceCard(input({ regionName: ' Machico ' })).regionLabel, 'Machico');
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

// ── T-190: the card speaks the phone's language ──

test('⚠ T-190 — on a Portuguese phone the card has no English in it', () => {
  // Review P1-4, seen on the P30: "VIEWPOINT" and "13 km away, in a straight line".
  const card = buildPlaceCard(input({ category: 'viewpoint', collected: true, language: 'pt' }));
  assert.equal(card.categoryLabel, 'Miradouro');
  assert.equal(card.metaLabel, 'Miradouro · Já lá esteve');
  assert.equal(card.distanceSentence, 'A 1,1 km, em linha reta');
});

test('T-190 — German writes the decimal with a comma too', () => {
  assert.equal(formatDistance(1243, 'de'), '1,2 km');
  assert.equal(formatDistance(1243, 'pt'), '1,2 km');
  assert.equal(formatDistance(1243, 'en'), '1.2 km');
  // Whole numbers have no separator to get wrong.
  assert.equal(formatDistance(23_400, 'pt'), '23 km');
  assert.equal(formatDistance(447, 'de'), '450 m');
});

test('T-190 — the qualification travels with the number, in every language', () => {
  for (const language of ['en', 'pt', 'de'] as const) {
    const card = buildPlaceCard(input({ language }));
    assert.ok(card.distanceSentence !== null);
    assert.ok(card.distanceSentence.includes(card.distanceLabel!), language);
  }
  const noFix = buildPlaceCard(input({ position: null, language: 'pt' }));
  assert.equal(noFix.distanceSentence, null);
});

test('T-190 — an uncollected place shows only its category', () => {
  assert.equal(buildPlaceCard(input({ collected: false, language: 'de' })).metaLabel, 'Aussichtspunkt');
});

test('T-201: the card carries the "why go" line in its own language', () => {
  const why = { en: 'The view.', pt: 'A vista.', de: 'Die Aussicht.' };
  assert.equal(buildPlaceCard(input({ why, language: 'pt' })).whyLine, 'A vista.');
  assert.equal(buildPlaceCard(input({ why, language: 'de' })).whyLine, 'Die Aussicht.');
});

test('⚠ T-201: a line missing in this language is no line — never another language', () => {
  const card = buildPlaceCard(input({ why: { en: 'The view.' }, language: 'pt' }));
  assert.equal(card.whyLine, null);
  assert.equal(buildPlaceCard(input()).whyLine, null);
});

test('⚠ rule 3: across the island there is no distance, only near by (2026-09-25)', () => {
  // The P30 showed "A 39 km em linha reta" for Pico do Areeiro: true, and of
  // no use on a road that doubles back on itself for most of those 39 km.
  const far = buildPlaceCard(input({ lat: 32.65, lon: -16.5, language: 'pt' }));
  assert.equal(far.distanceM, null);
  assert.equal(far.distanceSentence, null);

  // Just inside the limit it still shows, with its qualifier (rule 2).
  const near = buildPlaceCard(input({ lat: HERE.lat + (MAX_SHOWN_DISTANCE_M - 100) / 111_000 }));
  assert.ok(near.distanceM !== null && near.distanceM <= MAX_SHOWN_DISTANCE_M);
  assert.match(near.distanceSentence ?? '', /straight line/);

  const justOver = buildPlaceCard(input({ lat: HERE.lat + (MAX_SHOWN_DISTANCE_M + 100) / 111_000 }));
  assert.equal(justOver.distanceSentence, null);
});

test('the status line says where the user stands, and never un-collects a stamp', () => {
  // The project lead's option B, 2026-09-25: under the name on the passport's card.
  assert.equal(buildPlaceCard(input({ collected: false, language: 'pt' })).statusLine, 'Ainda por visitar');
  assert.equal(
    buildPlaceCard(input({ collected: true, visitedOn: '20 de setembro', language: 'pt' })).statusLine,
    'Visitou a 20 de setembro'
  );
  // Collected with no date known still says visited (D-075: never "not yet").
  assert.equal(buildPlaceCard(input({ collected: true, language: 'pt' })).statusLine, 'Já lá esteve');
  // A date handed in for a place not collected is ignored rather than shown.
  assert.equal(
    buildPlaceCard(input({ collected: false, visitedOn: '20 September' })).statusLine,
    'Not visited yet'
  );
});
