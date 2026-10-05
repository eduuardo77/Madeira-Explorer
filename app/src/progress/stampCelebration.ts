/**
 * The numbers a new stamp's celebration shows (T-249, E2 revised, D-097).
 *
 * The counter that ticks up, the set's bar, and the rank-up frame. Each says
 * what was true **when this stamp was earned**: pop-ups can queue, and the
 * third of three shown at once must not claim the count the first one reached.
 *
 * ⚠ **A rank-up only when this stamp crossed the line.** The frame is a
 * promise that something changed; drawing it on every stamp would make it noise
 * and, worse, untrue (D-097: nothing false).
 *
 * Pure: the earned list and the pack's counts come in; no database, no clock.
 */

import type { Category } from '../content/contentPack.ts';
import { tierFor, type Tier } from '../passport/stampTier.ts';

export interface EarnedForCelebration {
  placeId: string;
  category: Category;
  awardedTs: number;
}

export interface Celebration {
  /** The passport's count before this stamp, and with it. */
  collectedBefore: number;
  collectedAfter: number;
  /** Places in the pack. */
  total: number;
  category: Category;
  /** This stamp and the earlier ones of its category. */
  inCategory: number;
  categoryTotal: number;
  /** The rank this stamp lifted the passport to, or null if it did not. */
  rankUp: Tier | null;
}

export function celebrationFor(
  placeId: string,
  earned: readonly EarnedForCelebration[],
  total: number,
  categoryTotals: Readonly<Record<Category, number>>
): Celebration | null {
  // In the order they were earned; the id breaks a tie so the order is stable.
  const ordered = [...earned].sort(
    (a, b) => a.awardedTs - b.awardedTs || a.placeId.localeCompare(b.placeId)
  );
  const index = ordered.findIndex((stamp) => stamp.placeId === placeId);
  if (index < 0) return null;

  const upTo = ordered.slice(0, index + 1);
  const stamp = ordered[index];
  const after = upTo.length;
  const before = after - 1;
  const rankBefore = tierFor(before, total);
  const rankAfter = tierFor(after, total);

  return {
    collectedBefore: before,
    collectedAfter: after,
    total,
    category: stamp.category,
    inCategory: upTo.filter((each) => each.category === stamp.category).length,
    categoryTotal: categoryTotals[stamp.category],
    rankUp: rankAfter !== rankBefore ? rankAfter : null,
  };
}
