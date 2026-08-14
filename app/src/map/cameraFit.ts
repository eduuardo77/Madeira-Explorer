/**
 * Turning a bounding box into a camera position (D-057).
 *
 * WHY THIS EXISTS
 * ---------------
 * MapLibre had `fitBounds`, and D-053 leaned on it: the map frames **what you
 * walked**, and a levada card frames **the whole course** (D-055). `expo-maps`
 * has no such call — its camera is a centre and a zoom, and nothing else. So
 * the arithmetic that MapLibre did natively has to happen here.
 *
 * Losing `fitBounds` is a real cost of moving to the platform maps, and it is
 * the sort of cost that is invisible until the feature that depended on it
 * quietly stops working. Writing it down as a tested pure module is the cheap
 * insurance: this is the one piece of the migration that can be wrong by a
 * factor of two and still look plausible.
 *
 * HOW THE ZOOM IS DERIVED
 * -----------------------
 * Web Mercator, which is what every one of these maps uses. At zoom `z` the
 * world is `256 · 2^z` points wide, so the zoom that makes a span of `d`
 * degrees of longitude fit a viewport `w` points wide is:
 *
 *     z = log2( w / 256 · 360 / d )
 *
 * Latitude needs the Mercator projection applied first, because degrees of
 * latitude are not evenly spaced on the map — a degree near the pole occupies
 * far more of the image than one at the equator. Madeira sits at 32–33°N where
 * the distortion is about 19%, which is not enough to notice in a screenshot
 * and quite enough to cut the end off a levada.
 *
 * Pure: no React, no expo-maps, no viewport of its own. Tested in
 * `cameraFit.test.ts`.
 */

/** [west, south, east, north] — the order both MapLibre and the tools use. */
export type Bounds = [
  west: number,
  south: number,
  east: number,
  north: number,
];

export type Coordinates = { latitude: number; longitude: number };

export type CameraFit = {
  coordinates: Coordinates;
  zoom: number;
};

/**
 * The viewport to fit into, in points, and how much of it is spoken for.
 *
 * The card and the bottom controls cover the lower part of the screen, so the
 * *usable* box is smaller than the screen and is not centred on it. Ignoring
 * that is what puts the end of a walk behind a button.
 */
export type Viewport = {
  width: number;
  height: number;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
};

/** The tile size every Web Mercator map is defined against. */
const TILE_SIZE = 256;

/**
 * Zoom is clamped to something a map can actually show.
 *
 * ⚠ The floor matters more than it looks. A degenerate box — a trace that has
 * not moved, a course of one point — produces a span of zero and therefore an
 * infinite zoom, and `Infinity` handed to a native camera is not a zoom, it is
 * a crash or a blank screen depending on the platform.
 */
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 17;

function mercatorY(latitudeDegrees: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, latitudeDegrees));
  const radians = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

/**
 * The centre and zoom that fit `bounds` inside `viewport`.
 *
 * Returns null for a box that cannot be fitted — a viewport with no room left
 * after padding, or bounds that are not finite. The caller leaves the camera
 * where it is, which is always better than sending it somewhere arbitrary.
 */
export function fitBounds(
  bounds: Bounds,
  viewport: Viewport
): CameraFit | null {
  const [west, south, east, north] = bounds;

  if (![west, south, east, north].every((value) => Number.isFinite(value))) {
    return null;
  }

  const padding = viewport.padding ?? {};
  const top = padding.top ?? 0;
  const right = padding.right ?? 0;
  const bottom = padding.bottom ?? 0;
  const left = padding.left ?? 0;

  const usableWidth = viewport.width - left - right;
  const usableHeight = viewport.height - top - bottom;

  if (usableWidth <= 0 || usableHeight <= 0) {
    return null;
  }

  // The centre is the middle of the box, shifted to sit in the middle of the
  // *usable* area rather than of the screen. A card covering the bottom third
  // means the camera has to look further down than the box's own centre.
  const longitudeCentre = (west + east) / 2;

  const yNorth = mercatorY(north);
  const ySouth = mercatorY(south);
  const yCentre = (yNorth + ySouth) / 2;

  const longitudeSpan = Math.abs(east - west);
  const ySpan = Math.abs(yNorth - ySouth);

  // World width in Mercator y units is 2π; in degrees of longitude it is 360.
  const zoomForWidth =
    longitudeSpan === 0
      ? MAX_ZOOM
      : Math.log2((usableWidth / TILE_SIZE) * (360 / longitudeSpan));
  const zoomForHeight =
    ySpan === 0
      ? MAX_ZOOM
      : Math.log2((usableHeight / TILE_SIZE) * ((2 * Math.PI) / ySpan));

  // The smaller zoom is the one where *both* dimensions fit.
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomForWidth, zoomForHeight)));

  // Undo the Mercator to get a latitude back, then shift for the padding: the
  // offset is in points, converted to Mercator units at the chosen zoom.
  const worldPoints = TILE_SIZE * Math.pow(2, zoom);
  const verticalOffsetPoints = (top - bottom) / 2;
  const yCentreShifted =
    yCentre + (verticalOffsetPoints * (2 * Math.PI)) / worldPoints;
  const horizontalOffsetPoints = (left - right) / 2;
  const longitudeShifted =
    longitudeCentre - (horizontalOffsetPoints * 360) / worldPoints;

  const latitude =
    (2 * Math.atan(Math.exp(yCentreShifted)) - Math.PI / 2) * (180 / Math.PI);

  return {
    coordinates: { latitude, longitude: longitudeShifted },
    zoom,
  };
}
