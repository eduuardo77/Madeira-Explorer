/**
 * The places still to collect, on the home map (D-085, T-199).
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A REVERSAL NOBODY ASKED FOR
 * -------------------------------------------------------------
 * ⚠ The project lead once asked for every place marker to go — *"I would like
 * to delete them"* (2026-08-13, D-052 revised) — and `collectedMarks.ts` was
 * written to respect that: it draws only what has been earned. **On 2026-09-23
 * they reversed it themselves (D-085)**, after the review (P1-1) found that a
 * new user at 0 stamps sees Google's map, Google's pins and a button, and
 * nothing of the 80 places the product sells.
 *
 * D-085's one hard rule: **a mark for a place still to collect must never be
 * mistakable for a collected one, or for a Google pin.** It is kept by
 * construction rather than by colour judgement:
 *
 *   - **Shape.** Still to collect is a *hollow ring*; collected is a *filled
 *     disc* (`placeStyle.ts`, both already contrast-measured). Google's pins
 *     are teardrops with a glyph. Nothing here is filled, and nothing is a pin.
 *   - **Size.** Faint rings are smaller than a collected disc; only the nearest
 *     one to three are larger, and they are still hollow.
 *   - **Colour.** The nearest take the collected disc's grey as their ring —
 *     never blue, which is the user's own location dot, and never green, which
 *     is Google's parks and trails.
 *
 * ⚠ **Judged by eye as well as measured** (CLAUDE.md: a mark that passed every
 * geometry test still rendered as a crosshair). The device screenshot is the
 * verdict, and T-065 outdoors is the final one.
 *
 * Pure: no Expo, no database, no React. Tested in `placesToCollect.test.ts`.
 */

import type { Place } from '../content/contentPack.ts';
import { distanceM } from '../recording/distance.ts';
import { metresPerPoint, withOpacity, type CollectedMark } from './collectedMarks.ts';
import { representativeGeofence } from './placeMarkers.ts';
import type { MarkerPaint } from './placeStyle.ts';

/** How many of the nearest places are called out (D-085: "one to three"). */
export const NEAREST_COUNT = 3;

/**
 * Below this zoom, the faint rings are not drawn.
 *
 * ⚠ Lower than `MIN_MARK_ZOOM` (10) on purpose: the first screen a new user
 * sees frames the whole island (D-053, about z9), and that is exactly where
 * D-085 wants the collection visible. Below z8 the island is a thumbnail and
 * eighty rings would be speckle. ⚠ NOT TUNED — a judgement about appearance.
 */
export const MIN_TO_COLLECT_ZOOM = 8;

/** A ring still to collect. `nearest` says whether it is called out. */
export type ToCollectMark = CollectedMark & { nearest: boolean };

/**
 * The paint for the called-out rings, derived from the two measured paints so
 * nothing here invents a colour: the faint ring's shape, larger, in the
 * collected disc's colour, which already clears 3:1 on this map (placeStyle.ts).
 */
export function nearestPaint(faint: MarkerPaint, collected: MarkerPaint): MarkerPaint {
  return {
    fillColor: faint.fillColor,
    radius: collected.radius + 1,
    strokeColor: collected.fillColor,
    strokeWidth: faint.strokeWidth + 1,
    strokeOpacity: 1,
  };
}

/**
 * The rings for every place not yet collected, the nearest called out.
 *
 * `position` is the user's last known position, or null. With no position
 * nothing is called out: "nearest" to a guess would send somebody the wrong
 * way, and the faint rings alone still show what there is.
 */
export function buildToCollectMarks(input: {
  places: readonly Place[];
  collectedIds: ReadonlySet<string>;
  zoom: number;
  position: { lat: number; lon: number } | null;
  faint: MarkerPaint;
  collected: MarkerPaint;
}): ToCollectMark[] {
  const { places, collectedIds, zoom, position, faint, collected } = input;
  if (!Number.isFinite(zoom) || zoom < MIN_TO_COLLECT_ZOOM) {
    return [];
  }

  const candidates = places.flatMap((place) => {
    if (collectedIds.has(place.id)) {
      return [];
    }
    const geofence = representativeGeofence(place);
    if (geofence === undefined) {
      return [];
    }
    return [
      {
        place,
        lat: geofence.lat,
        lon: geofence.lon,
        away: position === null ? Infinity : distanceM(position, geofence),
      },
    ];
  });

  const nearestIds = new Set(
    position === null
      ? []
      : [...candidates]
          .sort((a, b) => a.away - b.away)
          .slice(0, NEAREST_COUNT)
          .map((candidate) => candidate.place.id)
  );
  const called = nearestPaint(faint, collected);

  return candidates.map(({ place, lat, lon }) => {
    const nearest = nearestIds.has(place.id);
    const paint = nearest ? called : faint;
    return {
      id: place.id,
      center: { latitude: lat, longitude: lon },
      radius: paint.radius * metresPerPoint(zoom, lat),
      color: paint.fillColor,
      lineColor: withOpacity(paint.strokeColor, paint.strokeOpacity),
      lineWidth: paint.strokeWidth,
      nearest,
    };
  });
}

