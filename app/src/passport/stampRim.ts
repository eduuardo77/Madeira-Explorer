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
 *
 * THE PLACEHOLDER'S EDGE ON THE NIGHT MAP
 * ---------------------------------------
 * Before the first stamp there is no rank and so no metal — but the grey
 * placeholder's own border measured **2.63:1** on the night land, under the
 * 3:1 floor for a control. So on the night map, and only there, it gets a thin
 * light edge: `mapChrome.dark.border`, the edge every other night-map control
 * already wears (4.10:1). On the light map its border is 4.42:1 and it needs
 * nothing. The project lead asked for it, 2026-09-22.
 */

import { toPolygon, type StampDesign, type StampElement } from './stampArt.ts';
import { TIER_METAL, type Tier } from './stampTier.ts';
import { mapChrome } from '../ui/theme.ts';

/** How much metal shows outside the cut edge, in canvas units (of 100). */
export const RIM_METAL_UNITS = 4;

/** How much of the placeholder's night edge shows — thinner: it is an edge, not a rank. */
export const PLACEHOLDER_EDGE_UNITS = 2;

/** How much hairline shows outside the metal. */
export const RIM_HAIRLINE_UNITS = 1.5;

/** Not solid black: at full strength it read as a cartoon outline. */
export const RIM_HAIRLINE_OPACITY = 0.55;

/**
 * How far the rim reaches past the canvas, so a renderer can grow its viewBox.
 *
 * ⚠ Without this the rim is clipped wherever the cut edge touches the canvas
 * edge — which the scalloped silhouettes do. One pad for every rim, sized for
 * the widest (metal plus hairline).
 */
export const RIM_PAD_UNITS = RIM_METAL_UNITS + RIM_HAIRLINE_UNITS;

/** `metal` is whatever the outer stroke is; `hairline` is null where there is none. */
export type Rim = { metal: string; metalUnits: number; hairline: string | null };

/**
 * The rim for a rank on a given map, or null for none.
 *
 * `none` never gets metal: before the first stamp the button shows the grey
 * placeholder, and a metal rim round a stamp nobody has earned would be a rank
 * nobody has either. On the night map it gets the light edge instead — see
 * the header.
 */
export function rimFor(tier: Tier, mapStyle: 'light' | 'dark'): Rim | null {
  if (tier === 'none') {
    return mapStyle === 'dark'
      ? { metal: mapChrome.dark.border, metalUnits: PLACEHOLDER_EDGE_UNITS, hairline: null }
      : null;
  }
  return {
    metal: TIER_METAL[tier].fill,
    metalUnits: RIM_METAL_UNITS,
    hairline: TIER_METAL[tier].ink,
  };
}

/** The rim's strokes, bottom first. Draw them before the stamp's own elements. */
export function rimElements(design: StampDesign, rim: Rim): StampElement[] {
  const points = toPolygon(design.cutOutline);
  // A stroke is centred on the line, so twice the visible width; the stamp on
  // top covers the inner half.
  const metal: StampElement = {
    kind: 'polygon',
    points,
    fill: 'none',
    stroke: rim.metal,
    strokeWidth: 2 * rim.metalUnits,
    strokeLinejoin: 'round',
  };
  if (rim.hairline === null) {
    return [metal];
  }
  return [
    {
      kind: 'polygon',
      points,
      fill: 'none',
      stroke: rim.hairline,
      strokeWidth: 2 * (rim.metalUnits + RIM_HAIRLINE_UNITS),
      strokeLinejoin: 'round',
      opacity: RIM_HAIRLINE_OPACITY,
    },
    metal,
  ];
}
