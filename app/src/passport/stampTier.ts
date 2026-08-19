/**
 * How far into the collection you are, as a rank (T-158, D-078).
 *
 * ⚠ **THE RANK COMES FROM HOW MANY YOU HAVE, NOT FROM WHICH ONES.**
 * The first design put the rarity on the *place* — Cabo Girão bronze because
 * there is a lift, Pico Ruivo gold because it is hours of legs. The project
 * lead replaced it with this, and it is better for a reason worth keeping:
 * **ranking places is exactly what killed the "stars" proposal** in the
 * decision that chose stamps in the first place — *"stars imply a rating
 * scale, which implies places are ranked"*. A rank earned by **quantity**
 * ranks the collector's journey and leaves every place worth the same.
 *
 * It is also the PlayStation shape, which is the one the project lead named:
 * bronze, silver, gold along the way, and **one platinum for finishing**.
 *
 * ⚠ **A rank is not a currency.** That is the other half of why the original
 * decision rejected stars: a points balance invites *"what do I spend these
 * on?"*, and the answer is nothing. A platinum trophy is not spent either, and
 * loses nothing by it.
 *
 * WHERE IT IS SEEN
 * ----------------
 * On the passport button on the map screen, which has always been drawn as a
 * stamp (`StampMark`). It now takes the rank's metal. The project lead:
 * *"eu sempre quis que o botão para abrir o passaporte com os carimbos fosse
 * um carimbo também."* The one control you look at most becomes the rank.
 *
 * Pure: no database, no clock, no i18n. Tested in `stampTier.test.ts`.
 */

/** In ascending order. `none` is *before* the first stamp, not a failure. */
export const TIERS = ['none', 'bronze', 'silver', 'gold', 'platinum'] as const;

export type Tier = (typeof TIERS)[number];

/**
 * How many collected places each rank asks for.
 *
 * ⚠⚠ **THESE ARE SET BY ARGUMENT, NOT MEASURED** — the same class of number as
 * D-072's ten stamps and D-068's forty-five minutes. Tunable against real trips
 * (T-134); never to be defended as anything but a judgement.
 *
 * **Why ten for silver, specifically.** It is exactly where the free tier ends
 * (D-072). A visitor who never pays reaches **silver** and can see gold above
 * them — which is honest about what buying gets you, rather than a rank
 * invented to sit just out of reach. ⚠ If the free allowance ever moves, this
 * should move with it and the reason should move too.
 *
 * ⚠ **Bronze is the first stamp, deliberately.** The rank appears the moment you
 * have been anywhere, because the button's job on day one is to say *"there is
 * something in here now"*.
 */
export const TIER_THRESHOLDS: Readonly<Record<Exclude<Tier, 'none' | 'platinum'>, number>> = {
  bronze: 1,
  silver: 10,
  gold: 25,
};

/**
 * The rank for a collection.
 *
 * `total` is the **unlocked** denominator (D-024) — the same one the passport's
 * hero counts against, so a locked Porto Santo cannot make platinum impossible
 * for somebody who has genuinely finished what they can reach.
 *
 * ⚠ **Platinum is everything, and only everything.** That is what the word
 * means everywhere it is used, and a platinum handed out at 90% is a platinum
 * nobody believes. It follows that platinum is **rare and may never be earned**,
 * which is the point of it existing.
 */
export function tierFor(collected: number, total: number): Tier {
  const has = Math.max(0, Math.floor(collected));

  if (has <= 0) {
    return 'none';
  }

  // ⚠ Before the thresholds, not after: a pack smaller than `gold`'s threshold
  // must still be able to reach platinum by being finished. A five-place pack
  // completed is a completed pack.
  if (total > 0 && has >= total) {
    return 'platinum';
  }

  if (has >= TIER_THRESHOLDS.gold) {
    return 'gold';
  }
  if (has >= TIER_THRESHOLDS.silver) {
    return 'silver';
  }
  return 'bronze';
}

/**
 * How many more places the next rank needs, or null at platinum.
 *
 * ⚠ **Offered, not displayed by default.** *"3 more for gold"* is a nudge, and
 * D-011's whole posture is that this app does not nag. It exists because a
 * caller might want it on the passport itself — where the user has *chosen* to
 * look at their collection — and must not end up on the map screen, which is
 * for walking.
 */
export function toNextTier(collected: number, total: number): number | null {
  const has = Math.max(0, Math.floor(collected));
  const current = tierFor(has, total);

  if (current === 'platinum') {
    return null;
  }

  const next =
    current === 'none'
      ? TIER_THRESHOLDS.bronze
      : current === 'bronze'
        ? TIER_THRESHOLDS.silver
        : current === 'silver'
          ? TIER_THRESHOLDS.gold
          : total;

  // A pack small enough that the next threshold is past its own end: the only
  // rank left is platinum, and finishing is what gets you there.
  return Math.max(1, Math.min(next, total > 0 ? total : next) - has);
}

/**
 * The metals — and they are the **button's fill**, not the mark inside it.
 *
 * ⚠ **Found by a failing test, and it changed the design for the better.** The
 * first attempt painted the *mark* in metal and left the button its blue. Every
 * metal failed contrast against that blue: silver scored **1.29:1**, platinum
 * **1.15:1**. Metals are pale and mid-toned by nature; there is no bronze that
 * shows up on `#5AA9FF`.
 *
 * The button *is* the stamp (the project lead's own words), so the metal
 * belongs to the whole thing. A bronze pill, a silver pill, a gold pill. The
 * mark and the count stay `colors.actionText`, which is near-black and reads on
 * every one of them.
 *
 * ⚠ `none` keeps the app's ordinary action blue: before the first stamp the
 * button is a **control**, not a trophy, and dressing it as one would be the
 * app congratulating somebody for nothing.
 *
 * ⚠ **`sheen` is unused by any renderer yet.** It is where a highlight would
 * fall, and it is here because the project lead wants these in 3D one day —
 * *"no futuro algo 3D agrada-me"* — and a flat fill is the one thing that
 * cannot be lifted later. A renderer that ignores it loses nothing today.
 *
 * ⚠ **Nobody has looked at these.** Contrast is asserted below; whether bronze
 * reads as bronze rather than as brown needs `preview-stamps.mjs` and eyes.
 */
export type TierMetal = { fill: string; sheen: string };

export const TIER_METAL: Readonly<Record<Tier, TierMetal>> = {
  none: { fill: '#5AA9FF', sheen: '#5AA9FF' },
  bronze: { fill: '#C8874A', sheen: '#E8B383' },
  silver: { fill: '#C6CBD2', sheen: '#EFF2F6' },
  gold: { fill: '#E3B84A', sheen: '#F6DC90' },
  // ⚠ Platinum is not "brighter gold" — it is the one that reads as *cold*.
  // Warm metals sit beside each other and the eye stops separating them.
  platinum: { fill: '#DCE8F2', sheen: '#FFFFFF' },
};
