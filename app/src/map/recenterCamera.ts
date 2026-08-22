/**
 * Where the camera goes when the user asks to be found (T-167).
 *
 * WHY THIS IS A MODULE AND NOT THREE LINES IN THE SCREEN
 * -----------------------------------------------------
 * Re-centring looks like `setCamera({ coordinates: position, zoom: 16 })` and
 * it is not, because of the one decision inside it: **what happens to the zoom
 * the user chose themselves.** A control that yanks the map to a fixed zoom
 * throws away a deliberate pinch every time it is pressed, and a control that
 * keeps whatever zoom is current is useless from the island view, which is
 * exactly where somebody presses it first (the app opens framing all of
 * Madeira, D-053).
 *
 * So: **zoom in to the street floor if the map is wider than that, and
 * otherwise leave the user's zoom alone.** Pressing it twice from a pinched-in
 * view moves the map and changes nothing else, which is what a re-center
 * button is supposed to feel like.
 *
 * WHY THE POSITION MAY BE MISSING, AND WHY THAT IS NOT AN ERROR
 * -------------------------------------------------------------
 * The app does not require a position to exist. On While-Using with the walk
 * not started, or in the first seconds after a cold launch under canopy, there
 * simply is not one — and the honest answer is to do nothing rather than to
 * fly the camera to a stale fix from yesterday's walk or to `0, 0`. `null` in,
 * `null` out; the caller decides what to say.
 *
 * ⚠ **`RECENTER_MAX_AGE_MS` is a staleness bound, not a timeout.** It is what
 * the screen passes to `getLastKnownPosition`, which answers from the OS cache.
 * Two minutes is long enough that a phone which has been in a pocket still has
 * an answer, and short enough that the answer is somewhere the user can see
 * from where they stand. It is a **guess** — no GPS in this project has ever
 * met a laurel forest (HANDOFF), and this is one of the numbers a real walk
 * should correct.
 *
 * Pure: no expo-location, no React, no clock of its own. Tested in
 * `recenterCamera.test.ts`.
 */

import type { CameraFit } from './cameraFit.ts';

/**
 * The zoom a re-center lands at when the map is currently wider than this.
 *
 * Street level: individual roads named, a levada distinguishable from the
 * track beside it. Zoom 16 is roughly 2 m per point at Madeira's latitude.
 */
export const RECENTER_ZOOM = 16;

/** How old a cached fix may be and still answer "where am I". See the header. */
export const RECENTER_MAX_AGE_MS = 120_000;

/** Just enough of a fix to point a camera at. Structural, so a raw fix fits too. */
export type Located = {
  lat: number;
  lon: number;
};

/**
 * The camera that answers "where am I", or `null` when nothing is known.
 *
 * @param position    the most recent fix the caller could find, or `null`
 * @param currentZoom the zoom on screen now, or `null` before the first move
 */
export function recenterCamera(
  position: Located | null,
  currentZoom: number | null
): CameraFit | null {
  if (position === null) {
    return null;
  }

  return {
    coordinates: { latitude: position.lat, longitude: position.lon },
    // ⚠ `Math.max`, not an assignment. Keeping the user's zoom when they are
    // already closer in is the whole difference between "find me" and "reset
    // my map".
    zoom: currentZoom === null ? RECENTER_ZOOM : Math.max(currentZoom, RECENTER_ZOOM),
  };
}
