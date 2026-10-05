/**
 * What a collected stamp's trophy says (T-251, T1 layout A, picked
 * 2026-10-05 from `tools/preview-trophy-options.mjs`).
 *
 * The project lead: a stamp already collected should "feel like a trophy",
 * and minutes spent at a place are not worth saying. What is worth saying is
 * what the stamp means:
 *
 * - **its place in the trip**: the 2nd stamp of this trip;
 * - **the municipality's medal** it counts towards (D-089, OQ-3: a set for each
 *   municipality with at least three places), with which of them are collected;
 * - **the next stamp**: the nearest place not collected yet, in a straight
 *   line, and whether it counts for the same medal.
 *
 * Pure: the places, and the trip's award order, come in.
 */

import type { Category } from '../content/contentPack.ts';
import { distanceM } from '../recording/distance.ts';

/** OQ-3: a municipality with fewer places than this has no medal. */
export const MEDAL_MINIMUM = 3;

/** The parts of a content place a trophy reads. */
export interface TrophyPlace {
  id: string;
  name: string;
  category: Category;
  regionId: string | null;
  geofences: ReadonlyArray<{ lat: number; lon: number }>;
}

export interface TrophyFacts {
  /** 1 for the trip's first stamp; null if this stamp is not in the trip. */
  orderInTrip: number | null;
  medal: {
    regionId: string;
    /** The municipality's places, in content order. */
    placeIds: string[];
    collected: number;
    total: number;
  } | null;
  next: {
    placeId: string;
    name: string;
    category: Category;
    distanceM: number;
    countsForMedal: boolean;
  } | null;
}

/**
 * @param placeId the trophy's stamp
 * @param places every place in the pack
 * @param tripOrder the trip's collected place ids, in the order they were earned
 */
export function trophyFacts(
  placeId: string,
  places: readonly TrophyPlace[],
  tripOrder: readonly string[]
): TrophyFacts {
  const collected = new Set(tripOrder);
  const self = places.find((each) => each.id === placeId);
  const index = tripOrder.indexOf(placeId);

  const sameRegion =
    self === undefined || self.regionId === null
      ? []
      : places.filter((each) => each.regionId === self.regionId);
  const medal =
    self !== undefined && self.regionId !== null && sameRegion.length >= MEDAL_MINIMUM
      ? {
          regionId: self.regionId,
          placeIds: sameRegion.map((each) => each.id),
          collected: sameRegion.filter((each) => collected.has(each.id)).length,
          total: sameRegion.length,
        }
      : null;

  let next: TrophyFacts['next'] = null;
  const here = self?.geofences[0];
  if (self !== undefined && here !== undefined) {
    for (const candidate of places) {
      const there = candidate.geofences[0];
      if (collected.has(candidate.id) || candidate.id === placeId || there === undefined) continue;
      const metres = distanceM(here, there);
      if (next === null || metres < next.distanceM) {
        next = {
          placeId: candidate.id,
          name: candidate.name,
          category: candidate.category,
          distanceM: metres,
          countsForMedal: medal !== null && candidate.regionId === self.regionId,
        };
      }
    }
  }

  return { orderInTrip: index < 0 ? null : index + 1, medal, next };
}
