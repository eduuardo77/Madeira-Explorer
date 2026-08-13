/**
 * How the curated places are painted, per map style (T-115, D-015, D-026).
 *
 * The sibling of `traceStyle.ts`, and it exists for the same reason: the two
 * styles need **opposite** treatments, so a single palette cannot serve both.
 *
 * THE RULE THESE NUMBERS ARE HELD TO
 * ----------------------------------
 * **A place marker is never louder than the trace.** Design brief §2.3 states
 * it as a quality bar — *the visited trace is unambiguously the brightest thing
 * on screen* — and D-032 made the trace the entire visual product of v1. Eighty
 * markers competing with one line is exactly how that gets lost, so every
 * colour here measures **below** the trace core against the same ground, and
 * `lightStyle.test.ts` / `darkStyle.test.ts` fail the build if that stops being
 * true.
 *
 * The floor is the usual 3:1 for a meaningful UI mark (D-015). Between the two
 * bounds there is very little room, which is the point — the markers are meant
 * to be quiet.
 *
 * ⚠ **Measured against the ground, not against water.** The trace has to clear
 * both because a coastal road or the Porto Santo ferry puts it on the sea. A
 * marker does not: every curated place is somewhere you can stand. If a pack
 * ever puts a marker offshore — a sea arch, a dive site — that assumption is
 * what to revisit.
 *
 * COLLECTED VS NOT, WITHOUT RELYING ON COLOUR
 * -------------------------------------------
 * D-015 forbids carrying meaning in hue alone, and here the two states are
 * nearly the same hue by necessity (the band between the 3:1 floor and the
 * trace's contrast is narrow). So the signal is carried three ways at once:
 *
 *   - **shape** — uncollected is a hollow ring, collected is filled;
 *   - **size** — collected is half again as large;
 *   - **weight** — collected carries the heavier casing.
 *
 * That is the design brief §2.4 rule applied to a point instead of a line:
 * visited is heavier in both styles, and darker or brighter depending on which
 * ground it sits on.
 *
 * ⚠ **Contrast is a floor, not a verdict** — the same warning as `traceStyle`.
 * No test says these read as places rather than as dust on the screen. T-065,
 * outdoors, is the judge. `tools/preview-stamps.mjs` exists because a mark that
 * passed every geometry test still rendered as a crosshair.
 *
 * Pure data. Tested in `lightStyle.test.ts` and `darkStyle.test.ts`.
 */

import type { MapStyleName } from './mapStyle';

export type MarkerPaint = {
  /** The disc. Near-ground in the uncollected state — that is the hollow. */
  fillColor: string;
  /** Radius in points, at any zoom. */
  radius: number;
  /** The casing: what lifts the mark off terrain shading. */
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
};

export type PlaceMarkerPaint = {
  uncollected: MarkerPaint;
  collected: MarkerPaint;
};

/**
 * The colour that has to clear 3:1 against the ground in each state — the ring
 * for a hollow marker, the disc for a filled one. Exported so the style tests
 * measure the same thing the eye reads, rather than whichever field happens to
 * be named `fillColor`.
 */
export function signalColor(paint: MarkerPaint, state: keyof PlaceMarkerPaint): string {
  return state === 'collected' ? paint.fillColor : paint.strokeColor;
}

export const PLACE_MARKER_PAINT: Record<MapStyleName, PlaceMarkerPaint> = {
  /**
   * Light — the everyday map (D-026). Visited is **darker and heavier** here,
   * per design brief §2.4, and the casing is pale so the mark survives being
   * drawn over hillshade.
   *
   * Ring 3.99:1, disc 4.62:1, against a trace core at 4.80:1.
   */
  light: {
    uncollected: {
      fillColor: '#f6f4ef',
      radius: 4,
      strokeColor: '#66757f',
      strokeWidth: 2,
      strokeOpacity: 1,
    },
    collected: {
      fillColor: '#5c6b76',
      radius: 6,
      strokeColor: '#ffffff',
      strokeWidth: 2.5,
      strokeOpacity: 0.9,
    },
  },

  /**
   * Dark — the fog-of-war ground. Visited is **brighter and heavier**, and the
   * casing is *darker* than the ground rather than lighter, the same inversion
   * the trace makes on this style and for the same reason.
   *
   * Ring 3.96:1, disc 4.74:1, against a trace core at 4.96:1.
   */
  dark: {
    uncollected: {
      fillColor: '#1a232b',
      radius: 4,
      strokeColor: '#7d8a95',
      strokeWidth: 2,
      strokeOpacity: 1,
    },
    collected: {
      fillColor: '#8b98a3',
      radius: 6,
      strokeColor: '#0d1319',
      strokeWidth: 2.5,
      strokeOpacity: 0.7,
    },
  },
};
