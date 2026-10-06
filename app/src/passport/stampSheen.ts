/**
 * The band of light on a collected stamp (T-236, D-089 rule 7).
 *
 * One still, faint band of white across the stamp's diagonal, as light falls
 * on glossy paper. Shown only where one collected stamp is shown large, the
 * trophy card (OQ-4, amended 2026-10-06). At passport size it cannot be seen,
 * so the grid has none.
 *
 * ⚠ **Still, by the project lead's choice (2026-10-06).** D-089 rule 7 asked
 * for tilt as well; a tilting version was built and set aside in favour of
 * this, as time is better spent on the release. No sensor, nothing running.
 *
 * Two renderers draw it, as with the stamps: `ui/StampSheen.tsx` on the phone
 * and `tools/lib/svg-render.mjs` for the preview page. Both take `sheenStops`.
 *
 * Pure. Tested in `stampSheen.test.ts`.
 */

/** Where the band sits across the stamp, from -1 to 1: a little up and to the left, where light falls on a desk. */
export const SHEEN_PLACE = -0.35;
/** The band's peak brightness. Faint on purpose: it is gloss, not a highlight. */
export const SHEEN_OPACITY = 0.4;
/** Half the band's width, as a share of the stamp's diagonal. */
const SHEEN_HALF_WIDTH = 0.11;

/** One stop of the band's gradient: where along the diagonal, and how bright. */
export type SheenStop = { offset: number; opacity: number };

/**
 * The band as gradient stops along the stamp's diagonal, top left to bottom
 * right: clear, then bright at `place`, then clear again. Offsets stay within
 * 0 to 1, so the band fades out at the corners rather than clipping.
 */
export function sheenStops(place: number = SHEEN_PLACE): SheenStop[] {
  const centre = 0.5 + Math.max(-1, Math.min(1, place)) * 0.5;
  const at = (offset: number) => Math.min(1, Math.max(0, offset));
  return [
    { offset: 0, opacity: 0 },
    { offset: at(centre - SHEEN_HALF_WIDTH), opacity: 0 },
    { offset: at(centre), opacity: SHEEN_OPACITY },
    { offset: at(centre + SHEEN_HALF_WIDTH), opacity: 0 },
    { offset: 1, opacity: 0 },
  ];
}
