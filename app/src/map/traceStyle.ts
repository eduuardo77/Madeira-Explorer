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
  /**
   * The rest of the trip, behind the day the trip viewer is showing (T-253):
   * the core colour at a fifth opacity. A tunnel or a cable car is not paler
   * but dashed, at full strength (`tunnelDashes.ts`, 2026-10-08).
   */
  otherDayColor: string;
};

export const TRACE_PAINT: Record<MapStyleName, TracePaint> = {
  /**
   * ⚠ **DEEP ORANGE, NOT BLUE, SINCE 2026-10-10 (D-104, supersedes D-056).**
   * Red was dropped on 2026-08-13 because it read as a warning; blue replaced
   * it as *"what every maps app draws your path in"*. That reason went with
   * D-093: the lines are no longer a path but the roads you have covered, and
   * on Google's map blue then collided with three things, measured from the
   * P30's own screenshots:
   *
   *   - **Google's location dot**, about the same blue (colour difference 15
   *     where 50 reads as clearly different): the dot vanished inside a knot of
   *     lit streets;
   *   - **Google's route blue**: a heavy blue line on Google's map reads as
   *     directions somebody suggested;
   *   - **the sea and the motorways**, blue and slate blue on Google's palette.
   *
   * Rejected on the way: the brighter `#DE6E0A` (2.9:1 on forest, 2.1:1 over the
   * sea), `#C2410C` (2.97:1 over the kept MapLibre style's water, and quieter
   * than a collected place marker there), magenta and crimson (red-green colour
   * blindness collapses both into the green levada course), purple (Google's
   * transit and place colour, and close to the dot for the same readers), green
   * (the island is green, and so are the levada course and the start button).
   *
   * Core 5.56:1 on Google's land, 3.81:1 over its sea; 5.00:1 and 3.42:1 on the
   * MapLibre style, the blue's own margins. Its weak case: for protanopes it
   * comes nearer the green start button and levada course, where lightness and
   * shape still tell them apart.
   *
   * ⚠ Judged in drawings over the P30's screenshots, never outdoors.
   */
  light: {
    casingColor: '#ffffff',
    casingOpacity: 0.9,
    casingWidth: 8,
    coreColor: '#B33A0A',
    coreWidth: 4,
    otherDayColor: '#B33A0A33',
  },

  /**
   * The light style's orange, lifted to glow on the night ground: 6.32:1 on
   * land, 7.23:1 over water, and still the brightest colour on the map, which
   * `googleNightStyle.test.ts` holds it to. More orange than amber on purpose,
   * so the film's yellow village dots stay a different colour. The casing is
   * **darker** than the ground on purpose: it separates a glowing line from
   * mid-tone hillshade, which a white one cannot do without outshining the line.
   */
  dark: {
    casingColor: '#0d1319',
    casingOpacity: 0.7,
    casingWidth: 8,
    coreColor: '#FF9A3C',
    coreWidth: 4,
    otherDayColor: '#FF9A3C33',
  },
};
