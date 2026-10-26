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
import { getLockedRegionIds as lockedFromGate } from './islandGateStore';

/**
 * Which regions are hidden from the user right now: those on a hidden island
 * (`hiddenIslands` in the content pack) the user has not been to (T-067a,
 * D-024). One function feeds trip progress, the medals and the stamp tiers, so
 * a locked region leaves both halves of every count.
 *
 * ⚠ **Been there alone opens it, paid or not** (D-107, answered 26 Oct 2026):
 * a free user sees the island with its stamps padlocked. Payment is
 * `freeTier.ts`'s business, through `getPaidOnlyPlaceIds`.
 */
export async function getLockedRegionIds(): Promise<Set<string>> {
  return lockedFromGate();
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
  // T-204: after a trip ends, keep showing it (tripDao.getTripOnShow).
  const trip = await tripDao.getTripOnShow();

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
