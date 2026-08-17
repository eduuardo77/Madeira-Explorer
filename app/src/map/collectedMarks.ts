/**
 * Marking the places you have actually collected, on the map (T-112, D-058).
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT THE THING THE PROJECT LEAD DELETED
 * --------------------------------------------------------------------
 * ⚠ **`placeMarkers.ts` records an explicit instruction to remove place markers**
 * (2026-08-13, D-052 revised): *"I would like to delete them."* That was about
 * drawing **all ~80 curated places** — eighty dots competing with the one line
 * D-032 makes the entire visual product. It was right, and this does not undo it.
 *
 * This draws **only what has been earned**, which is a different set and a
 * different job:
 *
 *   - it is small — 1 at the start of a trip, maybe 20 at the end, never 60;
 *   - it is not a directory of where to go, so it does not compete with the
 *     passport for that job (D-058 gave it to the passport, and it keeps it);
 *   - it is the **reward**, on the screen whose purpose is showing what you did.
 *
 * ⚠ The failure this fixes was found by looking, 2026-08-17: the hero number said
 * `1 / 60` while nothing on the map marked that one place — and Google's own POI
 * layer *was* drawing it, identically to five places the user had never been to.
 * The app's achievement was indistinguishable from basemap clutter. `mapClutter.ts`
 * removed the clutter; this supplies what should have been there instead.
 *
 * THE PAINT IS NOT NEW, AND THAT IS THE POINT
 * -------------------------------------------
 * `placeStyle.ts` already carries a designed, contrast-measured `collected`
 * state — filled disc, heavier casing, half again the size of uncollected, every
 * colour measured **below** the trace so the line stays the brightest thing
 * (design brief §2.3). It was written for MapLibre's circle layers, which size
 * in points, and then never wired to anything. Nothing here invents a colour.
 *
 * WHY CIRCLES RATHER THAN MARKERS
 * -------------------------------
 * `expo-maps` markers take `icon?: SharedRefType<'image'>`, which in practice
 * means the `useImage` hook from **`expo-image` — a dependency this app does not
 * have**. Adding an image library to draw one dot would need a network audit
 * (D-043) on an app whose whole claim is that nothing leaves the device, and
 * without an icon a marker is Google's default red pin, which is louder than the
 * trace and looks like somebody else's app.
 *
 * `circles` take a colour, a line and a radius, so the mark is *ours*. The catch
 * is that the radius is in **metres on the ground** while the design is in
 * points on the screen, which is what `metresPerPoint` is for.
 *
 * Pure: no Expo, no database, no React. Tested in `collectedMarks.test.ts`.
 */

import type { Place } from '../content/contentPack.ts';
import { representativeGeofence } from './placeMarkers.ts';
import type { MarkerPaint } from './placeStyle.ts';

/**
 * Metres per point at zoom 0 on the equator — the Web Mercator constant, the
 * earth's circumference divided by one 256-point tile.
 *
 * ⚠ **Points, not physical pixels.** The Maps SDK's projection is defined in
 * density-independent units: at zoom *z* the world is 256 × 2^z points wide, on
 * every screen. So this must NOT be multiplied by `PixelRatio` — doing so shrinks
 * every mark by the device's density, which on a 2.75× screen is a mark a third
 * of its designed size. `px()` in `NativeMapScreen` converts *stroke widths*
 * because the SDK takes those in pixels; radii in metres go through here instead.
 */
export const METRES_PER_POINT_AT_ZOOM_0 = 156_543.033_928_040_97;

/**
 * How many ground metres one screen point covers, here and at this zoom.
 *
 * Mercator stretches east-west away from the equator, so the scale depends on
 * latitude. At Madeira's ~32.7° that is a ~16% correction — small, and free to
 * get right, and the sort of thing that is invisible until a mark is measured
 * against something.
 */
export function metresPerPoint(zoom: number, latitude: number): number {
  const shrink = Math.cos((latitude * Math.PI) / 180);
  return (METRES_PER_POINT_AT_ZOOM_0 * shrink) / 2 ** zoom;
}

/** `#rrggbb` plus an alpha byte, which is how React Native takes translucency. */
export function withOpacity(hex: string, opacity: number): string {
  const clamped = Math.max(0, Math.min(1, opacity));
  if (clamped >= 1) {
    return hex;
  }
  const alpha = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${alpha}`;
}

/** What the map is handed. Mirrors `GoogleMapsCircle`, without importing it. */
export type CollectedMark = {
  /** Carries the place id, so `onCircleClick` can open the right card. */
  id: string;
  center: { latitude: number; longitude: number };
  /** Ground metres, computed so the mark holds a constant size on screen. */
  radius: number;
  color: string;
  lineColor: string;
  lineWidth: number;
};

/**
 * ⚠ Below this zoom, no marks at all.
 *
 * Zoomed out to the whole island the collected places are a handful of dots a
 * few points across, close enough together to read as speckle on the map rather
 * than as anything meaningful — and speckle over the trace is precisely what
 * D-032 refuses. The island view is for seeing the *shape of the trip*; the
 * marks appear once the map is close enough for them to mean a place.
 *
 * ⚠ NOT TUNED, and it is a judgement about appearance that no test can settle
 * (T-065, outdoors). z9 shows all of Madeira on a phone; this is a little past
 * that.
 */
export const MIN_MARK_ZOOM = 10;

/**
 * The marks for one trip.
 *
 * `collectedIds` is the set from `stampAwardDao.getAwardedPlaceIds`, so a place
 * is marked when the app actually awarded it — never when it merely looks nearby.
 */
export function buildCollectedMarks(
  places: readonly Place[],
  collectedIds: ReadonlySet<string>,
  zoom: number,
  paint: MarkerPaint
): CollectedMark[] {
  if (!Number.isFinite(zoom) || zoom < MIN_MARK_ZOOM) {
    return [];
  }

  const marks: CollectedMark[] = [];
  for (const place of places) {
    if (!collectedIds.has(place.id)) {
      continue;
    }
    const geofence = representativeGeofence(place);
    if (geofence === undefined) {
      continue;
    }
    marks.push({
      id: place.id,
      center: { latitude: geofence.lat, longitude: geofence.lon },
      radius: paint.radius * metresPerPoint(zoom, geofence.lat),
      color: paint.fillColor,
      lineColor: withOpacity(paint.strokeColor, paint.strokeOpacity),
      lineWidth: paint.strokeWidth,
    });
  }
  return marks;
}
