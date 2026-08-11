/**
 * Tests for trip-end detection (T-099, T-100).
 *
 *     cd app && npm test
 *
 * Three of these guard failures that would each break the product in a
 * different way:
 *
 *   - **The arrival crossing must not end the trip.** Every user walks through
 *     the airport on the way in. Naively, every holiday ends forty minutes
 *     after it starts.
 *   - **A Porto Santo day trip must not end the trip.** Madeira and Porto
 *     Santo are one region (D-021); TASKS names this on T-100 as a *Madeira*
 *     bug, not a Porto Santo feature.
 *   - **Silence must not end a live holiday too eagerly.** A dead recorder and
 *     a departed user look identical, and firing the reveal on the first
 *     spends a notification budget of exactly two (D-011).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Visit } from './stampRules.ts';
import {
  detectTripEnd,
  INACTIVITY_END_MS,
  isOutsideBounds,
  MIN_DEPARTURE_DWELL_SECONDS,
  MIN_TRIP_AGE_FOR_DEPARTURE_MS,
  type TripEndInput,
  revealTitle,
} from './tripEnd.ts';

const START = 1_800_000_000_000;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** The archipelago, as `tiles/pipeline/build.sh` defines it. */
const BOUNDS = { west: -17.32, south: 32.4, east: -16.2, north: 33.2 };

function visit(hoursIn: number, dwellSeconds: number): Visit {
  const enteredTs = START + hoursIn * HOUR;
  return {
    geofenceId: 'airport',
    enteredTs,
    exitedTs: enteredTs + dwellSeconds * 1000,
    dwellSeconds,
  };
}

/** A seven-day holiday in progress, nothing suggesting it is over. */
function midTrip(overrides: Partial<TripEndInput> = {}): TripEndInput {
  return {
    tripStartedTs: START,
    now: START + 5 * DAY,
    departureVisits: [],
    hasTravelledElsewhere: true,
    leftBoundsTs: null,
    lastFixTs: START + 5 * DAY - HOUR,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// the departure lounge — the moment the product is aimed at
// ---------------------------------------------------------------------------

test('a long airport dwell at the end of a holiday ends the trip', () => {
  const decision = detectTripEnd(
    midTrip({ departureVisits: [visit(5 * 24, 2 * 3600)] })
  );

  assert.equal(decision.ended, true);
  assert.equal(decision.method, 'airport_geofence');
  assert.equal(decision.endedTs, START + 5 * DAY);
});

test('THE ARRIVAL CROSSING MUST NOT END THE TRIP', () => {
  // Landing: a long airport dwell (baggage, car hire) with nothing recorded
  // anywhere else yet, two hours into the trip. Both guards should hold.
  const decision = detectTripEnd({
    tripStartedTs: START,
    now: START + 2 * HOUR,
    departureVisits: [visit(0, 90 * 60)],
    hasTravelledElsewhere: false,
    leftBoundsTs: null,
    lastFixTs: START + 2 * HOUR,
  });

  assert.equal(decision.ended, false);
  assert.match(decision.reason, /away from the airport/);
});

test('a slow arrival on a long first day still does not end the trip', () => {
  // The trip-age guard alone would let this through once 20h have passed, so
  // the "been elsewhere" guard is what actually carries it.
  const decision = detectTripEnd({
    tripStartedTs: START,
    now: START + 22 * HOUR,
    departureVisits: [visit(0, 3 * 3600)],
    hasTravelledElsewhere: false,
    leftBoundsTs: null,
    lastFixTs: START + 22 * HOUR,
  });

  assert.equal(decision.ended, false);
});

test('a same-day in-and-out is not a trip worth revealing', () => {
  // OD-5: day-trippers are explicitly not designed for, and there is nothing
  // to reveal without an overnight.
  const decision = detectTripEnd({
    tripStartedTs: START,
    now: START + 8 * HOUR,
    departureVisits: [visit(6, 2 * 3600)],
    hasTravelledElsewhere: true,
    leftBoundsTs: null,
    lastFixTs: START + 8 * HOUR,
  });

  assert.equal(decision.ended, false);
  assert.match(decision.reason, /too early to end/);
});

test('dropping somebody off does not end the trip', () => {
  const decision = detectTripEnd(
    midTrip({
      departureVisits: [visit(5 * 24, MIN_DEPARTURE_DWELL_SECONDS - 60)],
    })
  );

  assert.equal(decision.ended, false);
  assert.match(decision.reason, /still travelling/);
});

test('the trip is dated to arriving at the airport, not to noticing', () => {
  const arrivedAt = START + 6 * DAY;
  const decision = detectTripEnd({
    ...midTrip(),
    now: arrivedAt + 3 * HOUR,
    departureVisits: [
      {
        geofenceId: 'airport',
        enteredTs: arrivedAt,
        exitedTs: null,
        dwellSeconds: 3 * 3600,
      },
    ],
  });

  assert.equal(decision.endedTs, arrivedAt);
});

// ---------------------------------------------------------------------------
// leaving the archipelago — and the Porto Santo trap
// ---------------------------------------------------------------------------

test('Madeira and Porto Santo are one region (D-021)', () => {
  // A ferry day trip must not read as leaving. Porto Santo sits inside the
  // same bounds by design.
  const portoSanto = { lat: 33.06, lon: -16.34 };
  assert.equal(isOutsideBounds(portoSanto, BOUNDS), false);

  const funchal = { lat: 32.65, lon: -16.91 };
  assert.equal(isOutsideBounds(funchal, BOUNDS), false);
});

test('the mainland is outside', () => {
  assert.equal(isOutsideBounds({ lat: 38.72, lon: -9.14 }, BOUNDS), true);
});

test('a fix just past the edge is inside the margin, not outside', () => {
  // Guards against a single wild fix on the boundary ending a holiday.
  const justOutside = { lat: BOUNDS.north + 0.05, lon: -16.9 };
  assert.equal(isOutsideBounds(justOutside, BOUNDS), false);
});

test('leaving the archipelago ends the trip', () => {
  const leftAt = START + 6 * DAY;
  const decision = detectTripEnd(midTrip({ leftBoundsTs: leftAt }));

  assert.equal(decision.ended, true);
  assert.equal(decision.method, 'left_bbox');
  assert.equal(decision.endedTs, leftAt);
});

test('the airport wins over the bounding box when both fire', () => {
  // Both are true on the way home. The airport is the better moment and the
  // earlier timestamp.
  const decision = detectTripEnd(
    midTrip({
      departureVisits: [visit(5 * 24, 2 * 3600)],
      leftBoundsTs: START + 5 * DAY + 3 * HOUR,
    })
  );

  assert.equal(decision.method, 'airport_geofence');
});

// ---------------------------------------------------------------------------
// silence — the ambiguous signal
// ---------------------------------------------------------------------------

test('a day of silence does NOT end the trip', () => {
  // D-012 offers 24h; that is too eager, because a dead recorder looks exactly
  // like this and the reveal cannot be un-sent.
  const decision = detectTripEnd(
    midTrip({ now: START + 5 * DAY, lastFixTs: START + 4 * DAY })
  );

  assert.equal(decision.ended, false);
});

test('three days of silence does end the trip', () => {
  const lastFix = START + 4 * DAY;
  const decision = detectTripEnd(
    midTrip({ now: lastFix + INACTIVITY_END_MS, lastFixTs: lastFix })
  );

  assert.equal(decision.ended, true);
  assert.equal(decision.method, 'inactivity');
  assert.equal(decision.endedTs, lastFix, 'dated to the last real evidence');
});

test('a trip that never recorded anything can still time out', () => {
  const decision = detectTripEnd({
    tripStartedTs: START,
    now: START + INACTIVITY_END_MS + HOUR,
    departureVisits: [],
    hasTravelledElsewhere: false,
    leftBoundsTs: null,
    lastFixTs: null,
  });

  assert.equal(decision.ended, true);
  assert.equal(decision.method, 'inactivity');
});

test('a live holiday keeps going', () => {
  const decision = detectTripEnd(midTrip());

  assert.equal(decision.ended, false);
  assert.equal(decision.method, null);
  assert.ok(decision.reason.length > 0);
});

test('the trip-age gate uses the constant it advertises', () => {
  const justUnder = detectTripEnd({
    ...midTrip(),
    now: START + MIN_TRIP_AGE_FOR_DEPARTURE_MS - HOUR,
    departureVisits: [visit(1, 2 * 3600)],
  });
  const justOver = detectTripEnd({
    ...midTrip(),
    now: START + MIN_TRIP_AGE_FOR_DEPARTURE_MS + HOUR,
    departureVisits: [visit(1, 2 * 3600)],
  });

  assert.equal(justUnder.ended, false);
  assert.equal(justOver.ended, true);
});

// ---------------------------------------------------------------------------
// The reveal's title (T-102, T-116a)
// ---------------------------------------------------------------------------

test('the reveal names the place, from the content pack', () => {
  assert.equal(revealTitle('Madeira'), 'Your Madeira map is ready');
  assert.equal(revealTitle('Porto Santo'), 'Your Porto Santo map is ready');
});

test('a pack that does not name itself still gets a sentence', () => {
  // ⚠ The fallback matters more than it looks. This is the copy on the moment
  // D-012 calls the best in the product, and D-013 gives it one job — get
  // somebody in a departure lounge to open the app. A missing content field
  // must cost warmth, never the notification.
  assert.equal(revealTitle(null), 'Your map is ready');
  assert.equal(revealTitle(''), 'Your map is ready');
  assert.equal(revealTitle('   '), 'Your map is ready');
});

test('no island is named anywhere in `app/` for this notification', () => {
  // ⚠ THE POINT OF T-116a. D-017 is called absolute in CONTEXT §6.1, and the
  // title used to be the one string in `app/` that broke it. This is what
  // stops it coming back the next time somebody wants warmer copy.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(path.join(here, 'tripEndDetection.ts'), 'utf8');

  assert.ok(
    !/Madeira/.test(source),
    'tripEndDetection.ts names the island — it belongs in content/, not app/'
  );
  assert.match(source, /revealTitle/);
});
