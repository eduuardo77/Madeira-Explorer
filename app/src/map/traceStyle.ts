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
   * Core 4.80:1 on land, 3.28:1 over water. Was `#c2402a`, which measured
   * 2.97:1 over water — the case a ferry crossing would have exposed.
   */
  light: {
    casingColor: '#ffffff',
    casingOpacity: 0.55,
    casingWidth: 7,
    coreColor: '#b83a26',
    coreWidth: 3.5,
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
    casingWidth: 7,
    coreColor: '#ff6b4a',
    coreWidth: 3.5,
  },
};
