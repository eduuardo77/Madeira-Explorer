/**
 * The rank rim around the passport button's stamp (D-083).
 *
 * WHAT IT IS
 * ----------
 * The passport button is a real stamp now — the most recent one you can see —
 * and the rank (D-078) that used to be the pill's fill is a **metal rim on the
 * stamp's own die-cut edge**, with a dark hairline outside it. The project lead
 * chose this from five drawn options on 2026-09-22.
 *
 * WHY THE HAIRLINE IS NOT DECORATION
 * ----------------------------------
 * Silver `#C6CBD2` and platinum `#DCE8F2` are pale by nature, and on Google's
 * light land (~`#F2EFE9`) a bare metal rim all but vanished — option 2 of the
 * five, drawn and looked at. The hairline is what lets the two pale metals be
 * told apart from the map *and* from each other. Take it away and the rank
 * only reads on the night map.
 *
 * HOW IT IS DRAWN
 * ---------------
 * Two strokes on `design.cutOutline`, drawn **under** the stamp, so only their
 * outer half shows: the hairline, a little wider, then the metal. That makes
 * the rim follow every scallop and zigzag of the cut without any offsetting
 * geometry, and it means both renderers draw it with the one primitive they
 * already share (`StampArt.tsx` and `tools/lib/svg-render.mjs`).
 *
 * Round joins, because a `zigzag` or `torn` edge has sharp inward corners and a
 * mitred stroke spikes out of every one of them.
 */

import { toPolygon, type StampDesign, type StampElement } from './stampArt.ts';
import { TIER_METAL, type Tier } from './stampTier.ts';

/** How much metal shows outside the cut edge, in canvas units (of 100). */
export const RIM_METAL_UNITS = 4;

/** How much hairline shows outside the metal. */
export const RIM_HAIRLINE_UNITS = 1.5;

/** Not solid black: at full strength it read as a cartoon outline. */
export const RIM_HAIRLINE_OPACITY = 0.55;

/**
 * How far the rim reaches past the canvas, so a renderer can grow its viewBox.
 *
 * ⚠ Without this the rim is clipped wherever the cut edge touches the canvas
 * edge — which the scalloped silhouettes do.
 */
export const RIM_PAD_UNITS = RIM_METAL_UNITS + RIM_HAIRLINE_UNITS;

export type Rim = { metal: string; hairline: string };

/**
 * The rim for a rank, or null for none.
 *
 * `none` has no rim: before the first stamp the button shows the grey passport
 * placeholder, and a metal rim round a stamp nobody has earned would be a rank
 * nobody has either.
 */
export function rimFor(tier: Tier): Rim | null {
  if (tier === 'none') {
    return null;
  }
  return { metal: TIER_METAL[tier].fill, hairline: TIER_METAL[tier].ink };
}

/** The rim's two strokes, bottom first. Draw them before the stamp's own elements. */
export function rimElements(design: StampDesign, rim: Rim): StampElement[] {
  const points = toPolygon(design.cutOutline);
  // A stroke is centred on the line, so twice the visible width; the stamp on
  // top covers the inner half.
  return [
    {
      kind: 'polygon',
      points,
      fill: 'none',
      stroke: rim.hairline,
      strokeWidth: 2 * RIM_PAD_UNITS,
      strokeLinejoin: 'round',
      opacity: RIM_HAIRLINE_OPACITY,
    },
    {
      kind: 'polygon',
      points,
      fill: 'none',
      stroke: rim.metal,
      strokeWidth: 2 * RIM_METAL_UNITS,
      strokeLinejoin: 'round',
    },
  ];
}
