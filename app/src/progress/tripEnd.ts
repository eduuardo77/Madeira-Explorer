/**
 * Has the holiday ended? (T-099, T-100, implementing D-012)
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS
 * -----------------------------------
 * D-012 calls the departure lounge "the best moment in the entire product":
 * the user is sitting with nothing to do and a head full of the trip they just
 * had, which is the ideal context for both the payoff and the share that is
 * the whole distribution strategy (D-013). This module decides when that
 * moment has arrived.
 *
 * The costs of being wrong are asymmetric and both are real:
 *
 *   - **Too late, or never.** The user flies home without their souvenir and
 *     the distribution strategy produces nothing.
 *   - **Too early.** The reveal fires mid-holiday, spending one of exactly two
 *     permitted notifications (D-011) on a trip that is not over, and the real
 *     moment then passes in silence.
 *
 * THE TRAP D-012 DOES NOT MENTION
 * -------------------------------
 * **The user crosses the airport geofence on the way IN.** They land, collect
 * a bag, pick up a rental car and drive off — through the exact geofence that
 * is supposed to mean "going home". Naively implemented, every trip ends about
 * forty minutes after it starts.
 *
 * Two conditions separate arrival from departure, and both are required:
 *
 *   1. **The trip has to be old enough.** An airport crossing in the first
 *      hours belongs to the arrival.
 *   2. **They have to have been somewhere else first.** A departure is a
 *      *return* to the airport after a holiday happened. This is the stronger
 *      of the two and the one that carries the rule.
 *
 * A dwell requirement then separates flying out from dropping someone off.
 *
 * Pure: no database, no clock, no Expo. Tested in `tripEnd.test.ts`.
 */

import type { EndDetectionMethod } from '../storage/types.ts';
import type { Visit } from './stampRules.ts';

/**
 * ⚠ NONE OF THESE IS TUNED. T-131 retunes against real trips; every ending is
 * stored with the method that produced it, so they can be judged in hindsight.
 */

/**
 * How old a trip must be before an airport crossing can end it.
 *
 * Twenty hours covers the arrival day comfortably. It does exclude somebody
 * flying in and out inside a day — which is correct: OD-5 records that
 * day-trippers are explicitly not a designed-for segment, and a trip with no
 * overnight has nothing worth revealing.
 */
export const MIN_TRIP_AGE_FOR_DEPARTURE_MS = 20 * 60 * 60 * 1000;

/**
 * How long inside the airport counts as flying, rather than dropping someone
 * off or driving past on the coast road.
 *
 * Forty-five minutes is shorter than any real check-in-and-security, and
 * longer than any errand.
 */
export const MIN_DEPARTURE_DWELL_SECONDS = 45 * 60;

/**
 * Silence long enough to conclude the trip is over.
 *
 * ⚠ **D-012 says "24h+"; this is deliberately three days.** Silence is
 * ambiguous in a way the other two signals are not — it means "the user left"
 * *or* "an OEM killed the recorder" (ARCHITECTURE §6.2), and those want
 * opposite responses. Ending a live holiday because the recorder died would
 * fire the reveal on a half-recorded trip and spend the notification budget on
 * it. Three days makes the mistake much rarer, and costs a late reveal in the
 * cases where it is wrong — which is the cheaper error.
 */
export const INACTIVITY_END_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * How far outside the archipelago's bounds a fix must be, in degrees, before
 * it counts as having left.
 *
 * The bounds already have slack around both islands, so this is only guarding
 * against a wild fix on the edge. Roughly 11 km at this latitude.
 */
export const BOUNDS_MARGIN_DEG = 0.1;

export type Bounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/**
 * Is this position outside the archipelago?
 *
 * ⚠ **Madeira and Porto Santo are ONE region** (D-021). The bounds cover both,
 * so a ferry or a short flight to Porto Santo stays inside them. Treating them
 * separately would end a holiday the moment somebody took a day trip — which
 * is exactly the failure TASKS calls out on T-100, and it would be a *Madeira*
 * bug rather than a Porto Santo feature.
 */
export function isOutsideBounds(
  position: { lat: number; lon: number },
  bounds: Bounds,
  marginDeg: number = BOUNDS_MARGIN_DEG
): boolean {
  return (
    position.lat < bounds.south - marginDeg ||
    position.lat > bounds.north + marginDeg ||
    position.lon < bounds.west - marginDeg ||
    position.lon > bounds.east + marginDeg
  );
}

export type TripEndInput = {
  tripStartedTs: number;
  now: number;
  /**
   * Visits to departure-point geofences (airports, cruise terminal), in any
   * order. Reconstructed with the same function the stamp rules use.
   */
  departureVisits: Visit[];
  /**
   * Has the user been recorded meaningfully away from the departure points?
   * The caller decides what "away" means — typically any geofence crossing at
   * a curated place, or fixes well outside the airport.
   *
   * This is what separates a departure from an arrival.
   */
  hasTravelledElsewhere: boolean;
  /** When a fix was first seen outside the archipelago, if ever. */
  leftBoundsTs: number | null;
  /** Most recent recorded fix, if any. */
  lastFixTs: number | null;
};

export type TripEndDecision = {
  ended: boolean;
  method: EndDetectionMethod | null;
  /** When the trip should be recorded as having ended. */
  endedTs: number | null;
  /** Always present, whether ended or not. Goes into the diary. */
  reason: string;
};

const CONTINUES = (reason: string): TripEndDecision => ({
  ended: false,
  method: null,
  endedTs: null,
  reason,
});

/**
 * Decide whether the trip is over, and by which signal.
 *
 * Signals are checked most-precise first. The airport is the one D-012 wants,
 * because it is the only one that fires at the right *moment* rather than
 * merely the right day.
 */
export function detectTripEnd(input: TripEndInput): TripEndDecision {
  const tripAge = input.now - input.tripStartedTs;

  // 1. The departure lounge. The moment the whole product is aimed at.
  if (input.hasTravelledElsewhere && tripAge >= MIN_TRIP_AGE_FOR_DEPARTURE_MS) {
    for (const visit of input.departureVisits) {
      // Only crossings after the trip has become a trip. An arrival-day
      // crossing is excluded by the trip-age gate above, but a second airport
      // visit mid-trip (picking somebody up) is excluded here by dwell.
      if (visit.dwellSeconds >= MIN_DEPARTURE_DWELL_SECONDS) {
        return {
          ended: true,
          method: 'airport_geofence',
          // The moment they arrived at the airport, not the moment we noticed:
          // that is when the holiday actually ended.
          endedTs: visit.enteredTs,
          reason: `at a departure point for ${Math.round(visit.dwellSeconds / 60)} min`,
        };
      }
    }
  }

  // 2. They physically left the archipelago. Precise, but late — by the time
  // this fires they are usually in the air or already home.
  if (input.leftBoundsTs !== null) {
    return {
      ended: true,
      method: 'left_bbox',
      endedTs: input.leftBoundsTs,
      reason: 'recorded outside the archipelago',
    };
  }

  // 3. Silence. The ambiguous one — see INACTIVITY_END_MS.
  const lastActivity = input.lastFixTs ?? input.tripStartedTs;
  const silence = input.now - lastActivity;
  if (silence >= INACTIVITY_END_MS) {
    return {
      ended: true,
      method: 'inactivity',
      // Dated to the last thing actually recorded, not to now. The trip ended
      // when the evidence stopped; claiming otherwise would put three empty
      // days on the souvenir (ARCHITECTURE §10).
      endedTs: lastActivity,
      reason: `no data for ${Math.round(silence / 86400000)} days`,
    };
  }

  if (!input.hasTravelledElsewhere) {
    return CONTINUES('nothing recorded away from the airport yet');
  }
  if (tripAge < MIN_TRIP_AGE_FOR_DEPARTURE_MS) {
    return CONTINUES(
      `trip is ${Math.round(tripAge / 3600000)}h old; too early to end`
    );
  }
  return CONTINUES('still travelling');
}

/**
 * The title on the reveal notification (T-102, T-116a).
 *
 * ⚠ **The island's name is an argument, not a literal.** It used to be
 * hardcoded as "Your Madeira map is ready", which read well and quietly broke
 * D-017 — the rule CONTEXT §6.1 calls absolute, that no Madeira knowledge
 * lives in `app/`. Every other island-specific string already comes from
 * `content/` or the shipped style's metadata; this one did not, so shipping
 * for anywhere else meant editing code rather than swapping a directory.
 *
 * The warmth is kept rather than traded away: the name now comes from the
 * content pack's `destination` field, and only the fallback is generic. This
 * is the copy on the moment D-012 calls the best in the product, and D-013
 * gives it one job — get somebody in a departure lounge to open the app.
 */
export function revealTitle(destination: string | null): string {
  if (destination === null || destination.trim() === '') {
    return 'Your map is ready';
  }
  return `Your ${destination.trim()} map is ready`;
}
