/**
 * Tests for accommodation detection and masking (T-103, T-104, D-016).
 *
 *     cd app && npm test
 *
 * This is the module where a bug publishes somebody's address to a public
 * feed, so the tests are written around that rather than around the happy
 * path. The one that matters most is the last section: **an export the app
 * could not check must be refused, not shipped unmasked.**
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { offsetByMetres } from '../recording/distance.ts';
import {
  CLUSTER_RADIUS_M,
  detectAccommodation,
  isMasked,
  MASK_RADIUS_M,
  maskTrace,
  MIN_CLUSTER_FIXES,
  type OvernightFix,
} from './accommodation.ts';

const HOTEL = { lat: 32.6485, lon: -16.9095 };

/**
 * A fix at a given local hour on a given day, optionally offset from the
 * hotel. Local time on purpose — the overnight window is defined in the user's
 * own night, and Madeira sits in the machine's timezone for these tests.
 */
function fixAt(
  day: number,
  hour: number,
  offsetM = 0,
  accuracy_m: number | null = 20
): OvernightFix {
  const date = new Date(2026, 7, day, hour, 0, 0);
  const at =
    offsetM === 0 ? HOTEL : offsetByMetres(HOTEL, offsetM, 0);
  return { ts: date.getTime(), lat: at.lat, lon: at.lon, accuracy_m };
}

/** Three nights asleep in the same place. */
function threeNights(): OvernightFix[] {
  return [
    fixAt(11, 2, 10),
    fixAt(12, 3, -15),
    fixAt(13, 2, 25),
  ];
}

// ---------------------------------------------------------------------------
// finding the place
// ---------------------------------------------------------------------------

test('three nights in the same place is an accommodation', () => {
  const found = detectAccommodation(threeNights());

  assert.notEqual(found, null);
  assert.equal(found?.fixCount, 3);
  assert.equal(found?.nightCount, 3);
  // The centroid should land essentially on the hotel.
  assert.ok(isMasked(HOTEL, found!));
});

test('daytime fixes are ignored, however many there are', () => {
  // A café visited every afternoon is not where they sleep.
  const cafe: OvernightFix[] = [];
  for (let day = 11; day <= 17; day += 1) {
    cafe.push(fixAt(day, 14, 400));
    cafe.push(fixAt(day, 15, 400));
  }

  assert.equal(detectAccommodation(cafe), null);
});

test('too few overnight fixes is not enough evidence', () => {
  const found = detectAccommodation([
    fixAt(11, 2),
    fixAt(12, 2),
  ]);
  assert.equal(found, null, `needs ${MIN_CLUSTER_FIXES}`);
});

test('one wild fix does not become home', () => {
  // Two real nights plus a single 3am fix from a taxi across town.
  const found = detectAccommodation([
    fixAt(11, 2, 10),
    fixAt(12, 2, -10),
    fixAt(13, 2, 5),
    fixAt(14, 3, 4000),
  ]);

  assert.notEqual(found, null);
  assert.ok(isMasked(HOTEL, found!), 'the cluster, not the outlier, wins');
});

test('an inaccurate overnight fix cannot drag the centre', () => {
  const found = detectAccommodation([
    ...threeNights(),
    fixAt(14, 2, 2000, CLUSTER_RADIUS_M + 500),
  ]);

  assert.ok(isMasked(HOTEL, found!));
});

test('one restless night at 02:00 and 03:00 counts as one night', () => {
  // Otherwise a single bad night looks like a pattern.
  const found = detectAccommodation([
    fixAt(11, 2, 5),
    fixAt(11, 3, -5),
    fixAt(11, 4, 10),
  ]);

  assert.equal(found?.fixCount, 3);
  assert.equal(found?.nightCount, 1);
});

test('a fix just after midnight belongs to the night before', () => {
  const found = detectAccommodation([
    fixAt(11, 2, 0),
    fixAt(12, 2, 0),
    fixAt(13, 2, 0),
  ]);
  assert.equal(found?.nightCount, 3);
});

test('no fixes at all is null, not a crash', () => {
  assert.equal(detectAccommodation([]), null);
});

// ---------------------------------------------------------------------------
// masking
// ---------------------------------------------------------------------------

test('the mask hides a generous radius, not just the building', () => {
  const found = detectAccommodation(threeNights());

  // 250 m away is still hidden: the point is to make the building
  // unidentifiable, not merely to cover the GPS error.
  assert.equal(isMasked(offsetByMetres(HOTEL, 250, 0), found!), true);
  // Well beyond the radius is kept.
  assert.equal(isMasked(offsetByMetres(HOTEL, MASK_RADIUS_M + 200, 0), found!), false);
});

test('masking removes the fixes near home and keeps the rest of the trip', () => {
  const found = detectAccommodation(threeNights());
  const trace: OvernightFix[] = [
    fixAt(11, 2, 0), // in bed
    fixAt(11, 9, 50), // leaving the hotel
    fixAt(11, 11, 5000), // out for the day
    fixAt(11, 16, 8000),
    fixAt(11, 23, 30), // home again
  ];

  const result = maskTrace(trace, found, true);

  assert.equal(result.removedCount, 3);
  assert.equal(result.fixes.length, 2);
  for (const fix of result.fixes) {
    assert.equal(isMasked(fix, found!), false);
  }
});

// ---------------------------------------------------------------------------
// the safety property — an unchecked export must be refused
// ---------------------------------------------------------------------------

test('WITHHOLD: overnight data exists but no accommodation was identified', () => {
  // Something is in there and the app cannot see what. Exporting anyway is
  // exactly the failure D-016 exists to prevent.
  const trace = [fixAt(11, 2), fixAt(11, 14, 5000)];
  const result = maskTrace(trace, null, true);

  assert.equal(result.fixes.length, 0);
  assert.equal(result.removedCount, trace.length);
  assert.match(result.reason, /withheld/);
});

test('a trace with no overnight data at all is safe to export whole', () => {
  // A day tripper has no home in this trace to reveal.
  const trace = [fixAt(11, 11, 3000), fixAt(11, 15, 6000)];
  const result = maskTrace(trace, null, false);

  assert.equal(result.fixes.length, 2);
  assert.equal(result.removedCount, 0);
});

test('masking is never silently skipped — every result explains itself', () => {
  const found = detectAccommodation(threeNights());
  const cases: [ReturnType<typeof detectAccommodation>, boolean][] = [
    [found, true],
    [null, true],
    [null, false],
  ];

  for (const [accommodation, hadOvernight] of cases) {
    const result = maskTrace([fixAt(11, 2)], accommodation, hadOvernight);
    assert.ok(result.reason.length > 0);
  }
});
