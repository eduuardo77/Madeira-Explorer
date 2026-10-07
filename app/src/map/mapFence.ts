/**
 * Keeping the home map on the islands (T-223, review N8).
 *
 * The second review panned the map into open ocean (r3-07) and found nothing on
 * screen to say where the islands were, or a way back when the app had no
 * position for the user. The native map has a camera fence, and `expo-maps` does
 * not expose it: `latLngBoundsForCameraTarget` is commented out in its
 * `Records.kt`. What it does expose is a minimum zoom, which it defaults to 3,
 * half the planet.
 *
 * So the fence is two softer things, decided here:
 *
 *   1. **A zoom floor at the archipelago.** You can zoom out until Madeira and
 *      Porto Santo both fit, and a little further, and no further.
 *   2. **A way back from the ocean.** When the map's centre leaves the
 *      archipelago, *Centrar* is offered even with no position to centre on,
 *      and it brings back the islands rather than the user.
 *
 * ⚠ Nothing snaps the camera back by itself. A map that moves when you did not
 * ask it to is worse than one you can pan away; the button is the fence.
 *
 * Pure: bounds and a viewport in, answers out. The bounds come from the shipped
 * style's metadata (`content/archipelagoBounds.ts`, D-017).
 */

import type { Bounds as Box } from '../progress/tripEnd.ts';
import { fitBounds, type Coordinates, type Viewport } from './cameraFit.ts';

/**
 * How far past "the archipelago fits" the zoom may go, in zoom levels. Half a
 * level is about 40% more ground each way: enough to see the islands as islands
 * in the sea, not enough to lose them.
 */
export const ZOOM_OUT_MARGIN = 0.5;

/** The lowest zoom the home map may show, or null when it cannot be fitted. */
export function zoomFloor(archipelago: Box, viewport: Viewport): number | null {
  const fit = fitBounds(
    [archipelago.west, archipelago.south, archipelago.east, archipelago.north],
    viewport
  );
  return fit === null ? null : fit.zoom - ZOOM_OUT_MARGIN;
}

/** Whether a point lies outside the archipelago's box, which is open sea. */
export function isOffArchipelago(point: Coordinates, archipelago: Box): boolean {
  return (
    point.latitude < archipelago.south ||
    point.latitude > archipelago.north ||
    point.longitude < archipelago.west ||
    point.longitude > archipelago.east
  );
}

/**
 * Where *Centrar* goes: to the user when they are on the islands, and otherwise
 * to the islands. A user at home in Lisbon planning a trip would otherwise be
 * sent to Lisbon, which is off the archipelago, which offers *Centrar* again.
 */
export function recentreTarget(
  user: Coordinates | null,
  archipelago: Box
): 'user' | 'islands' {
  return user !== null && !isOffArchipelago(user, archipelago) ? 'user' : 'islands';
}

/**
 * How far the camera may drift before *Re-centre* is worth offering, in degrees
 * of latitude. ~0.002° is roughly 200 m, which is about a screen at the
 * re-centre zoom: below that the button would be offering to do nothing.
 */
export const RECENTRE_SHOW_DEGREES = 0.002;

/**
 * Whether *Centrar* is worth showing, for a camera looking at `centre`.
 *
 * ⚠ Offered only when it would actually move the map. WalkNYC shows the same
 * control the same way, and a re-centre button that is always lit is a button
 * that does nothing most of the times it is pressed. Degrees, not metres: this
 * is a "has the map wandered off" test, not a distance.
 *
 * T-223 (review N8): out at sea it is offered with or without a position,
 * because it is the only way back and nothing else on screen says where the
 * islands went.
 *
 * T-254: a pure answer the screen keeps as a boolean, so a pan re-renders the
 * screen only when this changes, not on every camera move.
 */
export function offerRecentre(
  centre: Coordinates | null,
  user: Coordinates | null,
  archipelago: Box
): boolean {
  if (centre === null) {
    return false;
  }
  const wanderedOffUser =
    user !== null &&
    (Math.abs(centre.latitude - user.latitude) > RECENTRE_SHOW_DEGREES ||
      Math.abs(centre.longitude - user.longitude) > RECENTRE_SHOW_DEGREES);
  return wanderedOffUser || isOffArchipelago(centre, archipelago);
}
