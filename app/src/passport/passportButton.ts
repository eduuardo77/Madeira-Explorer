/**
 * Which stamp the passport button shows (D-083).
 *
 * The button used to be the seal mark and `23 / 80` on a pill. The project lead
 * asked for *"just a stamp figure on it"* and picked, from three drawn options,
 * **a real passport stamp**: the most recent one you have earned *and can see*.
 * Before the first, a grey placeholder stamp reading "Passport".
 *
 * ⚠⚠ "CAN SEE" IS THE WHOLE POINT OF THIS FILE
 * --------------------------------------------
 * The eleventh stamp onwards is locked until the user pays (D-072, D-075): the
 * passport draws it muted, with a padlock, and withholds the artwork. If the
 * button simply showed the latest *earned* stamp, the map screen would hand
 * over, full colour, exactly the artwork €4.99 is for — on the one screen the
 * user looks at most. So the latest stamp is taken from `visibleStamps`, the
 * same arithmetic the passport uses, and never from the award table directly.
 *
 * The count left the button with this change. It is still said to a screen
 * reader on the button, and still shown in the passport.
 *
 * Pure: no database, no i18n. The placeholder's name comes in as a parameter,
 * the way `nowMs` does elsewhere (CLAUDE.md).
 */

import type { Category } from '../content/contentPack.ts';
import { visibleStamps } from '../entitlement/freeTier.ts';

/** What the button draws. The same fields the passport hands `StampArt`. */
export type ButtonStamp = {
  placeId: string;
  name: string;
  category: Category;
  collected: boolean;
};

/**
 * The placeholder's id, which seeds its design.
 *
 * ⚠ Starts with `__`, which `contentPack.ts` forbids for a place id — so the
 * placeholder can never share a design, or a clip-path id, with a real place.
 */
export const PLACEHOLDER_ID = '__passport';

/**
 * The passport button's box, in dp. Well over the 60 dp target (D-015).
 *
 * The stamp is drawn at `TILT_FIT` of it, because a tilted square is wider
 * than its own side, and the rim's pad comes out of the same square — so the
 * stamp itself is ~84 dp. It was 84 (a ~70 dp stamp, the size approved in the
 * drawn options) until the project lead asked for it 20% bigger on 2026-09-24.
 * Here rather than in `PrimaryOverlay.tsx` so the preview draws the same size.
 */
export const STAMP_BUTTON_SIZE = 101;

/** The placeholder's emblem. A levada, because that is what the app is for (D-072). */
export const PLACEHOLDER_CATEGORY: Category = 'levada';

export function buttonStamp(
  awards: readonly { placeId: string; awardedTs: number }[],
  places: readonly { id: string; name: string; category: Category }[],
  unlocked: boolean,
  placeholderName: string
): ButtonStamp {
  const byId = new Map(places.map((place) => [place.id, place]));

  // A stamp for a place that has left the pack cannot be drawn — its name and
  // category lived in the pack — so it is dropped, as the passport drops it.
  const earned = awards.flatMap((award) => {
    const place = byId.get(award.placeId);
    return place === undefined
      ? []
      : [{ placeId: award.placeId, category: place.category, awardedTs: award.awardedTs }];
  });

  const { visible } = visibleStamps(earned, unlocked);
  // Earliest first, so the latest is the last.
  const latest = visible.length === 0 ? undefined : byId.get(visible[visible.length - 1]);

  if (latest === undefined) {
    return {
      placeId: PLACEHOLDER_ID,
      name: placeholderName,
      category: PLACEHOLDER_CATEGORY,
      collected: false,
    };
  }

  return { placeId: latest.id, name: latest.name, category: latest.category, collected: true };
}
