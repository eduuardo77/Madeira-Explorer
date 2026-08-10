/**
 * Trip progress, from the database (T-072a, T-073).
 *
 * The arithmetic is in `tripProgress.ts` and is pure. This assembles its three
 * inputs: the content pack, the stamps already awarded, and which regions are
 * hidden from the user.
 */

import { getContentPack } from '../content/poiCatalogue';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import type { TripProgress } from './tripProgress';
import { computeTripProgress } from './tripProgress';

/**
 * Which regions are hidden from the user right now.
 *
 * ⚠ **Empty, and correctly so — for now.** D-024 hides Porto Santo until the
 * user goes there, and D-021 defers curating any Porto Santo places at all, so
 * today there is nothing to hide. The set is threaded through anyway rather
 * than hardcoded to empty inside the arithmetic, because the moment a locked
 * region does exist the denominator must already be built to exclude it —
 * HANDOFF is explicit that getting this wrong breaks the headline number in
 * exactly the way D-024 exists to prevent.
 *
 * **T-067a fills this in**, from an island-level geofence and the permanent
 * unlock flag already reserved in `app_state`.
 */
async function getLockedRegionIds(): Promise<Set<string>> {
  return new Set();
}

const EMPTY: TripProgress = {
  collected: 0,
  total: 0,
  byCategory: [],
  byRegion: [],
  lockedRegionCount: 0,
};

export async function getCurrentProgress(): Promise<TripProgress> {
  const pack = getContentPack();
  const trip = await tripDao.getActiveTrip();

  // No trip yet: still report the shape of what is collectable, so the
  // primary screen can show `0 / 180` on day one rather than nothing at all.
  const awarded =
    trip === null
      ? new Set<string>()
      : await stampAwardDao.getAwardedPlaceIds(trip.id);

  if (pack.places.length === 0) {
    return EMPTY;
  }

  return computeTripProgress(pack, awarded, await getLockedRegionIds());
}
