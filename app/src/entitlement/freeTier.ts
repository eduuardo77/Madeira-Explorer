/**
 * Who may see which stamp, before anybody has paid (T-155, D-072, D-089).
 *
 * ⚠⚠ THIS MODULE GATES A DISPLAY. IT MUST NEVER GATE AN AWARD.
 * ------------------------------------------------------------
 * The promise is that a user who buys in month three receives every stamp they
 * earned in months one and two. That promise is only true if the app keeps
 * monitoring **every** geofence and keeps **writing** awards the whole time
 * they are unpaid. The obvious optimisation (*why watch every place for a user
 * who can see six?*) breaks it **silently**: no crash, no failing test, no error
 * in the log, and the user simply receives less than they paid for.
 *
 * That is the T-145 shape, which cost this project a session: 399 passing tests
 * could not see that nothing had ever started geofence monitoring. So the rule
 * is enforced by the build rather than by memory: `freeTier.test.ts` fails if
 * `geofenceSelection`, `geofenceManager`, `stampAwards`, `stampRules` or
 * `tripProgress` so much as imports this file.
 *
 * THE RULES, WHICH ARE EXACT (D-089 rules 2 and 3)
 * ------------------------------------------------
 * - Recording, the trace and the souvenir are free forever and are not this
 *   module's business.
 * - **Five stamps are free.** Which five is the *user's* choice in the only
 *   sense that matters: they chose by going there. The app never picks a
 *   favoured five places, and it never asks the user to nominate five out of
 *   their own holiday; being asked which memories to keep is a worse screen
 *   than a paywall. So the free five are simply the first five earned.
 * - **The first levada stamp is always shown, in addition to the five**,
 *   whenever it is earned, even if it arrives at 5/5. So the free tier is at
 *   most **six** visible stamps, one of them guaranteed to be a levada.
 *
 * **Why the levada is guaranteed:** 19 of the 80 places are viewpoints and many
 * of those are roadside, so a visitor can collect five in one driving morning
 * and meet the lock **having never walked a levada**. They would be paying under
 * pressure rather than out of delight, and judging a hiking app they never hiked
 * with. At five that is more likely than it was at ten, not less.
 *
 * ⚠ **Five is a judgement, and so is the price.** D-089 set both by argument
 * after a study without field data; tunable against real trips, never to be
 * defended as measured. ⚠ **After the public release the allowance may go up and
 * never down** (D-089 rule 9): lowering it would take something from people who
 * already had it. The price is a Play Console setting and appears nowhere here.
 *
 * Pure: no database, no clock, no i18n (CONTEXT §6). `entitlementStore.ts` is
 * the impure half.
 */

import type { Category } from '../content/contentPack.ts';

/** How many stamps a user who has not paid may see. ⚠ A judgement (above). */
export const FREE_STAMP_ALLOWANCE = 5;

/**
 * The one category the free tier will not let a user miss.
 *
 * A constant rather than a literal sprinkled through the arithmetic, because the
 * reason it is `levada` is an argument about what this app is for, and an
 * argument deserves one place to be read.
 */
export const GUARANTEED_CATEGORY: Category = 'levada';

/** A stamp the user has earned. Ordering comes from `awardedTs`. */
export type EarnedStamp = {
  placeId: string;
  category: Category;
  /** Epoch ms, from `stamp_award.awarded_ts`. */
  awardedTs: number;
};

export type StampVisibility = {
  /** Place ids whose stamp may be drawn, earliest earned first. */
  visible: string[];
  /**
   * Earned, kept forever, and not drawn yet: the ones the unlock reveals.
   *
   * ⚠ **Never call this "not collected".** The user stood there. What is
   * withheld is the artwork, not the fact of the visit, and the passport must
   * say so (T-157).
   */
  locked: string[];
  /** How many stamps have actually been earned, paid or not. */
  earnedCount: number;
};

/**
 * Earliest first, ties broken by id.
 *
 * The tie-break is not cosmetic. Two stamps can share a timestamp — the award
 * pass writes a whole trip's worth in one go, and `Date.now()` is coarser than
 * that loop is fast — and without a deterministic order the fifth and sixth
 * stamps could swap on every render, so a stamp would appear and disappear as
 * the user watched.
 */
function inEarnedOrder(earned: readonly EarnedStamp[]): EarnedStamp[] {
  return [...earned].sort(
    (a, b) =>
      a.awardedTs - b.awardedTs || (a.placeId < b.placeId ? -1 : a.placeId > b.placeId ? 1 : 0)
  );
}

/**
 * Which of the earned stamps may be shown.
 *
 * `unlocked` is the whole of the entitlement: one non-consumable product, no
 * tiers, no subscription (D-089 rule 5).
 */
export function visibleStamps(
  earned: readonly EarnedStamp[],
  unlocked: boolean
): StampVisibility {
  const ordered = inEarnedOrder(earned);
  const earnedCount = ordered.length;

  if (unlocked) {
    return { visible: ordered.map((stamp) => stamp.placeId), locked: [], earnedCount };
  }

  const free = ordered.slice(0, FREE_STAMP_ALLOWANCE);
  const beyond = ordered.slice(FREE_STAMP_ALLOWANCE);

  const shown = new Set(free.map((stamp) => stamp.placeId));

  // The guarantee only ever *adds*. If a levada is already among the free five
  // the user has had the experience the exemption exists to protect, and a
  // sixth stamp would be a reward for having walked one early.
  if (!free.some((stamp) => stamp.category === GUARANTEED_CATEGORY)) {
    const firstLevada = beyond.find((stamp) => stamp.category === GUARANTEED_CATEGORY);
    if (firstLevada !== undefined) {
      shown.add(firstLevada.placeId);
    }
  }

  return {
    visible: ordered.filter((s) => shown.has(s.placeId)).map((s) => s.placeId),
    locked: ordered.filter((s) => !shown.has(s.placeId)).map((s) => s.placeId),
    earnedCount,
  };
}
