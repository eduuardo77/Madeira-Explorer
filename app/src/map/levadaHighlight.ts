/**
 * Drawing a levada's actual course on the map (T-115, T-068, D-055).
 *
 * WHAT THE PROJECT LEAD ASKED FOR
 * -------------------------------
 * 2026-08-13: *"Just have the 'show on map' which will highlight on the map the
 * path / course of the levada."* A dot at the trailhead says where to park; it
 * does not say **where the walk goes**, which is the only thing anybody wants
 * to know about a levada.
 *
 * ⚠ THE CHEAP ANSWER WAS TRIED FIRST, AND IT DOES NOT WORK
 * --------------------------------------------------------
 * The obvious approach was to filter the shipped basemap by name — no new
 * data, no bytes, no content step. `tiles/pipeline/build.sh` states that the
 * Protomaps schema "keeps names on road/path features, so levadas stay
 * identifiable", which would have made that a five-line feature.
 *
 * **Measured on the emulator, that claim is false for the pack we ship:**
 *
 *   - `["has", "name"]` over the pack's `roads` layer → highlights plenty
 *     (ER-103 and friends), so the layer plumbing is sound;
 *   - `["in", "Levada", ["get", "name"]]` → highlights **nothing, anywhere**.
 *
 * The pack carries names for roads and not for levada paths. So the course
 * ships as its own geometry, extracted from OSM by `tools/build-levadas.mjs`
 * into `content/levadas.geojson` and read by `content/levadaCourses.ts`.
 * `docs/tile-pipeline.md` carries the correction.
 *
 * This module is what is left over once the geometry is somebody else's job:
 * which categories have a course at all, how one is painted, and the box the
 * camera should frame to show the whole walk.
 *
 * Pure: no MapLibre import, no React, no content. Tested in
 * `levadaHighlight.test.ts`.
 */

import type { Category } from '../content/contentPack.ts';
import type { MapStyleName } from './mapStyle.ts';

/**
 * Which categories have a course worth drawing.
 *
 * Only levadas. A viewpoint is a point — "the course of a miradouro" is not a
 * thing — and a village would light up every street in it.
 */
export function hasCourse(category: Category): boolean {
  return category === 'levada';
}

/** [west, south, east, north] — MapLibre's order. */
export type CourseBounds = [
  west: number,
  south: number,
  east: number,
  north: number,
];

/**
 * The box around a course, or null when there is nothing to frame.
 *
 * The camera fits **the whole walk**, not the trailhead: a levada is 6 to 12 km
 * of contour and the question the user is asking is *where does this go*. A
 * marker centred at the start answers a different, smaller question.
 */
export function courseBounds(
  lines: readonly (readonly (readonly [number, number])[])[]
): CourseBounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const line of lines) {
    for (const [lon, lat] of line) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        continue;
      }
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }

  if (!Number.isFinite(west) || !Number.isFinite(south)) {
    return null;
  }

  return [west, south, east, north];
}

export type CoursePaint = {
  casingColor: string;
  casingWidth: number;
  casingOpacity: number;
  color: string;
  width: number;
};

/**
 * How the highlighted course is painted, per style.
 *
 * ⚠ **Heavier than the trace, and that is deliberate.** Everywhere else the
 * trace is the loudest thing on the map (D-032) — but a course is only ever on
 * screen while its card is open, in answer to a direct question, and for those
 * few seconds it *is* the answer. It goes away when the card does.
 *
 * Green, because the trace is now blue (`traceStyle.ts`): the two lines mean
 * different things — *where you went* and *where this walk goes* — and they
 * can be on screen together. Hue is not carrying that alone, though: the
 * course is wider and casing-heavy, which is the D-015 rule.
 */
export const COURSE_PAINT: Record<MapStyleName, CoursePaint> = {
  /** On the pale ground: saturated and heavy, with a white casing under it. */
  light: {
    casingColor: '#ffffff',
    casingWidth: 11,
    casingOpacity: 0.9,
    color: '#00875A',
    width: 5,
  },
  /**
   * On the dark ground: bright, with a dark casing — the same inversion the
   * trace makes (D-026).
   */
  dark: {
    casingColor: '#0d1319',
    casingWidth: 11,
    casingOpacity: 0.8,
    color: '#3DDC97',
    width: 5,
  },
};
