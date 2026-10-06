/**
 * What a collected stamp's trophy says (T-251, T1 layout A, picked
 * 2026-10-05 from `tools/preview-trophy-options.mjs`).
 *
 * The project lead: a stamp already collected should "feel like a trophy",
 * and minutes spent at a place are not worth saying. What is worth saying is
 * what the stamp means:
 *
 * - **its place in the trip**: the 2nd stamp of this trip;
 * - **the municipality's medal** it counts towards (D-089, OQ-3), with which of
 *   its places are collected. The sets are `content/medals.json`'s, the same
 *   ones the passport shows (T-234), so the two can never disagree;
 * - **the next stamp**: the nearest place not collected yet, in a straight
 *   line, and whether it counts for the same medal.
 *
 * Pure: the places, the medal sets and the trip's award order come in.
 */

import type { Category } from '../content/contentPack.ts';
import { inSet, type MedalDefinition } from '../content/medalPack.ts';
import { distanceM } from '../recording/distance.ts';

/** The parts of a content place a trophy reads. */
export interface TrophyPlace {
  id: string;
  name: string;
  category: Category;
  regionId: string;
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
 * @param medals the medal sets (`content/medals.json`)
 */
export function trophyFacts(
  placeId: string,
  places: readonly TrophyPlace[],
  tripOrder: readonly string[],
  medals: readonly MedalDefinition[]
): TrophyFacts {
  const collected = new Set(tripOrder);
  const self = places.find((each) => each.id === placeId);
  const index = tripOrder.indexOf(placeId);

  // The municipality's set this place belongs to, if content defines one.
  const set =
    self === undefined
      ? undefined
      : medals.find((each) => 'region' in each.rule && inSet(each.rule, self));
  const members = set === undefined ? [] : places.filter((each) => inSet(set.rule, each));
  const medal =
    self === undefined || set === undefined
      ? null
      : {
          regionId: self.regionId,
          placeIds: members.map((each) => each.id),
          collected: members.filter((each) => collected.has(each.id)).length,
          total: members.length,
        };

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
