/**
 * How the recorded trace is painted, per map style (T-060, D-015, D-026).
 *
 * WHY THIS IS TWO PALETTES AND NOT ONE COLOUR
 * -------------------------------------------
 * The trace used one hardcoded red and one white casing for **both** styles.
 * Measured against the grounds they actually sit on, that was wrong in the
 * dark style in two ways at once:
 *
 *   - the red scored **2.70** against the dark ground — under the 3:1 floor,
 *     for the single most important mark on the screen;
 *   - the white casing scored **13.98**, so the halo was five times brighter
 *     than the line it was supposed to outline. The eye follows the brightest
 *     thing, and that was the outline.
 *
 * D-026 predicted this and it was not applied here: *"visited is brighter"*
 * holds only in the dark style — in the light style visited is **darker and
 * heavier**. A single colour cannot satisfy both, because the requirements are
 * opposite. So each style gets a trace tuned to its own ground.
 *
 * WHAT EACH PALETTE IS SOLVING
 * ----------------------------
 * **Light** — the everyday map, read outdoors in sunlight (D-026). The trace
 * must be the darkest, heaviest thing on a pale ground, and it must survive
 * being drawn over **water**: a coastal road, or the Porto Santo ferry, puts
 * the trace on the sea, and that was the weakest case at 2.97. The core is
 * darkened just enough to clear 3:1 there while staying unmistakably the same
 * red. A pale casing separates it from dark terrain shading.
 *
 * **Dark** — the souvenir look, where the fog-of-war metaphor lives. The trace
 * must glow, so the core is bright and the casing is *darker* than the ground
 * rather than lighter — the opposite construction, for the opposite reason.
 *
 * ⚠ **Contrast is a floor, not a verdict.** None of this says the trace looks
 * right; no test can. T-065 — outdoors, in Funchal, at midday — is the only
 * judge that counts. These numbers exist so that what it judges is at least
 * legible, and so a regenerated style cannot quietly drop below it.
 *
 * Pure data. Held to its grounds by `lightStyle.test.ts` and `darkStyle.test.ts`.
 */

import type { MapStyleName } from './mapStyle';

export type TracePaint = {
  /** Drawn under the core, to lift the line off terrain shading. */
  casingColor: string;
  casingOpacity: number;
  casingWidth: number;
  /** The trace itself — the one saturated, heavy thing on the map (D-032). */
  coreColor: string;
  coreWidth: number;
};

export const TRACE_PAINT: Record<MapStyleName, TracePaint> = {
  /**
   * ⚠ **BLUE, NOT RED, SINCE 2026-08-13.** The project lead looked at the
   * running app and said the red line was *"all wrong"*, and they were right
   * for a reason worth writing down: on a pale beige-and-green ground a
   * saturated red reads as a **warning**, not as a route. It is the colour of
   * a closed road, and it was drawn over the user's holiday.
   *
   * Blue is what every maps app on both platforms draws *your* path in, which
   * is the association to borrow rather than fight (D-054). It also frees red
   * entirely, and it separates the trace from the levada course, which is
   * green (`levadaHighlight.ts`).
   *
   * Core 5.01:1 on land, 3.42:1 over water — better than the red it replaced
   * on both grounds, and the water case is the one a ferry crossing exposes.
   * The casing is opaque white and wider than before: on the light ground the
   * line needs separating from hillshade, and at street zoom the old 55%
   * casing was doing almost nothing.
   */
  light: {
    casingColor: '#ffffff',
    casingOpacity: 0.9,
    casingWidth: 8,
    coreColor: '#0A5FCC',
    coreWidth: 4,
  },

  /**
   * Core 4.96:1 on land, 7.00:1 over water — bright, because on this ground
   * brightness is what reads. The casing is **darker** than the ground on
   * purpose: it separates a glowing line from mid-tone hillshade, which a
   * white one cannot do without outshining the line.
   */
  dark: {
    casingColor: '#0d1319',
    casingOpacity: 0.7,
    casingWidth: 8,
    // 6.31:1 on land, 8.91:1 over water. Bright rather than deep, because on
    // this ground brightness is what reads — the same hue as the light style's
    // trace, lifted for the opposite background.
    coreColor: '#64B5F6',
    coreWidth: 4,
  },
};
