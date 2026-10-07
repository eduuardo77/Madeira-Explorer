/**
 * Which trips the passport lists (T-261): WalkNYC's *Show Walks*, done our way.
 *
 * ⚠ **Not every row in `trip` is a trip a person would recognise.** On the
 * P30 (2026-10-07) there were 31: two holidays' worth of real recording (6,509
 * and 14,475 positions), a day in August (128), and 28 restarts from the first
 * days of testing with 1 to 48 positions each. A list of 31 with 28 of them
 * empty would bury the two that matter. So a trip is listed when it earned a
 * stamp, or recorded at least `MIN_FIXES_TO_LIST` positions.
 *
 * Pure. Tested in `tripList.test.ts`.
 */

import type { TripSummary } from '../storage/types.ts';

/**
 * Enough positions to be an outing rather than a restart. ⚠ Chosen from the
 * P30's own trips, where nothing real had fewer than 128 and nothing spurious
 * more than 48; not a measured threshold beyond that.
 */
export const MIN_FIXES_TO_LIST = 100;

/** The trips worth listing, newest first. */
export function listedTrips(trips: readonly TripSummary[]): TripSummary[] {
  return trips
    .filter((trip) => trip.stamp_count > 0 || trip.fix_count >= MIN_FIXES_TO_LIST)
    .sort((a, b) => b.started_ts - a.started_ts);
}
