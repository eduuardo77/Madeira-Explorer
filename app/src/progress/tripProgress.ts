/**
 * How much of Madeira have you collected? (T-072a, T-073)
 *
 * Produces the three numbers the interface is built from:
 *
 *   - **The hero number** — `23 / 180`, carried by the stamp button on the
 *     primary screen (T-075, design brief §3.1). One number, and it must be
 *     stamps rather than road coverage (D-002).
 *   - **Five category rows** — the passport's primary axis (D-027).
 *   - **Per-region rows** — which D-027 gave to the *map* screen, and which
 *     **v1 does not show at all** (D-062). See the field for why they are
 *     still computed.
 *
 * THE DENOMINATOR IS THE DANGEROUS PART
 * -------------------------------------
 * D-024 hides Porto Santo until the user actually goes there, and HANDOFF
 * states the consequence bluntly: **the stamp denominator must count unlocked
 * regions only**, or the headline number breaks in exactly the way D-024
 * exists to prevent. A tourist who never leaves Madeira would otherwise see
 * `23 / 205` with twenty-five stamps permanently unreachable, and a number you
 * cannot finish is worse than no number.
 *
 * So locked regions are removed from *both* halves of every count here, and
 * the caller passes in which ones are locked — this module does not know that
 * Porto Santo exists, and must not learn (D-017).
 *
 * Pure: no database, no clock, no Expo. Tested in `tripProgress.test.ts`.
 */

import { CATEGORIES, type Category, type ContentPack } from '../content/contentPack.ts';

export type CategoryProgress = {
  category: Category;
  collected: number;
  total: number;
};

export type RegionProgress = {
  regionId: string;
  collected: number;
  total: number;
};

export type TripProgress = {
  /** The hero number's numerator. */
  collected: number;
  /** Its denominator. Unlocked regions only (D-024). */
  total: number;
  /**
   * All five categories, always, in the order D-027 names them — including
   * empty ones. A passport row that vanishes when you have collected nothing
   * in it is a passport that changes shape as you travel, and the whole point
   * of the metaphor is a fixed set of pages to fill.
   */
  byCategory: CategoryProgress[];
  /**
   * Unlocked regions only, most-collected first.
   *
   * ⚠ **Nothing renders this in v1, on purpose (D-062).** D-027 gave it the
   * map screen and the "where should I go next" job; D-058 then made the
   * passport show every place, collected or not, which answers the same
   * question without spending the map screen's third control on it.
   *
   * It is computed anyway because the denominator rule below depends on the
   * same walk, and because a lock gate (T-067a) needs these rows. **But do not
   * mistake it for a tested surface** — a number nobody displays is a number
   * nobody checks, which is exactly how a third of the pack sat in the wrong
   * region for three weeks (T-067).
   */
  byRegion: RegionProgress[];
  /**
   * How many regions are hidden. Shown to nobody — it exists so the debug
   * screen can prove the gate is working before a user ever meets it.
   */
  lockedRegionCount: number;
};

/**
 * Compute progress.
 *
 * `awardedPlaceIds` comes from `stamp_award` (T-071); `lockedRegionIds` from
 * whatever governs region unlocking (T-067a). An award for a place in a locked
 * region is counted in neither half — if it were counted in the numerator only,
 * the hero number could read `24 / 180` after visiting a place that is not in
 * the 180, which is arithmetic nobody should have to explain.
 */
export function computeTripProgress(
  pack: ContentPack,
  awardedPlaceIds: ReadonlySet<string>,
  lockedRegionIds: ReadonlySet<string> = new Set()
): TripProgress {
  const byCategory = new Map<Category, CategoryProgress>();
  for (const category of CATEGORIES) {
    byCategory.set(category, { category, collected: 0, total: 0 });
  }

  const byRegion = new Map<string, RegionProgress>();
  const lockedSeen = new Set<string>();
  let collected = 0;
  let total = 0;

  for (const place of pack.places) {
    if (lockedRegionIds.has(place.regionId)) {
      lockedSeen.add(place.regionId);
      continue;
    }

    const isCollected = awardedPlaceIds.has(place.id);

    total += 1;
    if (isCollected) {
      collected += 1;
    }

    // `get` cannot miss: the parser rejects any place whose category is not
    // one of the five (D-034), so every surviving place has a row here.
    const categoryRow = byCategory.get(place.category);
    if (categoryRow !== undefined) {
      categoryRow.total += 1;
      if (isCollected) {
        categoryRow.collected += 1;
      }
    }

    const regionRow = byRegion.get(place.regionId);
    if (regionRow === undefined) {
      byRegion.set(place.regionId, {
        regionId: place.regionId,
        collected: isCollected ? 1 : 0,
        total: 1,
      });
    } else {
      regionRow.total += 1;
      if (isCollected) {
        regionRow.collected += 1;
      }
    }
  }

  return {
    collected,
    total,
    byCategory: CATEGORIES.map(
      (category) =>
        byCategory.get(category) ?? { category, collected: 0, total: 0 }
    ),
    // Most-collected first, ties broken by name so the order is stable between
    // renders — a list that reshuffles itself as you travel is unreadable.
    byRegion: [...byRegion.values()].sort((a, b) => {
      const byCollected = b.collected - a.collected;
      return byCollected !== 0
        ? byCollected
        : a.regionId.localeCompare(b.regionId);
    }),
    lockedRegionCount: lockedSeen.size,
  };
}

/**
 * The region worth nudging the user towards next.
 *
 * D-002's claim is that the uncollected places *are* the recommendation, and
 * D-027 moves region progress to the map screen to do that job. The most
 * useful nudge is the region they have *started* but not finished — somewhere
 * they have already chosen to go and can most cheaply add to — rather than the
 * emptiest one, which is usually the furthest away.
 *
 * Returns null when there is nothing sensible to suggest: no content, nothing
 * started, or everything finished.
 */
export function suggestNextRegion(progress: TripProgress): RegionProgress | null {
  const started = progress.byRegion.filter(
    (region) => region.collected > 0 && region.collected < region.total
  );
  if (started.length === 0) {
    return null;
  }

  // Nearest to completion, so the nudge is the one most likely to be acted on.
  return started.reduce((best, region) =>
    region.total - region.collected < best.total - best.collected ? region : best
  );
}
