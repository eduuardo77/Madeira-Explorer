/**
 * The film, as instructions for the **real map** (D-076).
 *
 * ⚠⚠ **THIS REPLACED A BESPOKE FILM, ON THE PROJECT LEAD'S INSTRUCTION.**
 * The first replay drew the trace as white lines on a black rectangle, and they
 * looked at it and said what it was: *"Some lines on a black screen? It is
 * supposed to have a map behind it to know where you've been. It should be a
 * video of the already existing map, as if someone was screen-recording while
 * you were walking, but adding some motion."*
 *
 * They are right, and the reason is D-057 and D-032 in one sentence: **the map
 * is the product.** A souvenir that throws the basemap away throws away the one
 * thing that says *where* — a line with no coastline under it could be any
 * walk anywhere, and Madeira is the entire subject.
 *
 * WHAT THIS MODULE IS
 * -------------------
 * `frame.ts` already answers *what is on screen at time t* — the camera box,
 * the trace drawn so far, the stamps landed and how long ago. That survived the
 * change completely, which is the payoff for having made it about the film
 * rather than about the drawing. This turns one of those frames into the three
 * things `GoogleMaps.View` takes: a **camera**, some **polylines**, some
 * **circles**.
 *
 * ⚠ It composes the map's own modules — `cameraFit`, `traceStyle`,
 * `collectedMarks` — rather than restating them. The replay's trace is
 * therefore the *same blue* as the everyday map's, at the same width, and a
 * change to either follows into both.
 *
 * Pure: no React, no Expo, no clock, no `PixelRatio` (it is passed in). Tested
 * in `replayMap.test.ts`.
 */

import { fitBounds, type CameraFit, type Viewport } from '../map/cameraFit.ts';
import { metresPerPoint } from '../map/collectedMarks.ts';
import type { MapStyleName } from '../map/mapStyle.ts';
import { TRACE_PAINT } from '../map/traceStyle.ts';
import { CATEGORY_COLOUR, stampMarkPoints } from './filmPaint.ts';
import type { Frame } from './frame.ts';

/** Mirrors `GoogleMapsPolyline`, without importing the native module. */
export type ReplayPolyline = {
  id: string;
  coordinates: { latitude: number; longitude: number }[];
  color: string;
  width: number;
};

/** Mirrors `GoogleMapsCircle`, as `collectedMarks.ts` does. */
export type ReplayCircle = {
  id: string;
  center: { latitude: number; longitude: number };
  /** Ground metres, so the mark holds a constant size on screen. */
  radius: number;
  color: string;
  lineColor: string;
  lineWidth: number;
};

export type ReplayMapFrame = {
  /** Null when the box is degenerate — the caller keeps the camera it had. */
  camera: CameraFit | null;
  polylines: ReplayPolyline[];
  circles: ReplayCircle[];
};

export type ReplayMapOptions = {
  style: MapStyleName;
  viewport: Viewport;
  /**
   * `PixelRatio.get()`, passed in.
   *
   * ⚠ Not read from React Native here, and it is not fussiness: the native
   * polyline width is in **pixels** while every other size in this app is in
   * points, and a trace drawn at point-width on a 3× screen is the hairline the
   * first build actually shipped.
   */
  pixelRatio: number;
};

/**
 * Turn one frame of the film into what the map should be showing.
 *
 * ⚠ **One polyline per stroke, never joined.** A gap between two strokes is a
 * recording blackout, and a line across it is a road nobody proved was taken
 * (ARCHITECTURE §10). `frame.ts` keeps them apart and this must not undo it —
 * which is exactly what concatenating the coordinates into one polyline for
 * "efficiency" would do, silently.
 */
export function replayMapFrame(
  frame: Frame,
  options: ReplayMapOptions
): ReplayMapFrame {
  const paint = TRACE_PAINT[options.style];

  const camera = fitBounds(
    [frame.bounds.west, frame.bounds.south, frame.bounds.east, frame.bounds.north],
    options.viewport
  );

  const polylines = frame.strokes.map((stroke, index) => ({
    id: `replay-trace-${index}`,
    coordinates: stroke.map(([longitude, latitude]) => ({ latitude, longitude })),
    color: paint.coreColor,
    width: paint.coreWidth * options.pixelRatio,
  }));

  // Without a camera there is no zoom, and without a zoom a ground radius
  // cannot be computed. Better no marks for a frame than marks the size of the
  // island — which is what a zoom of zero produces.
  const circles =
    camera === null
      ? []
      : frame.stamps.map((stamp) => ({
          id: `replay-stamp-${stamp.placeId}`,
          center: { latitude: stamp.lat, longitude: stamp.lon },
          radius: stampMarkPoints(stamp.ageMs) * metresPerPoint(camera.zoom, stamp.lat),
          color: CATEGORY_COLOUR[stamp.category],
          lineColor: paint.casingColor,
          lineWidth: 2,
        }));

  return { camera, polylines, circles };
}

/**
 * Has the camera moved enough to be worth telling the map about?
 *
 * ⚠ **This exists because the film runs at 30 fps and a native map camera does
 * not want to be reset thirty times a second.** Each assignment starts the
 * map's own animation, and restarting an animation every 33 ms is how a smooth
 * pan becomes a stutter. The trace and the marks still update every frame —
 * they are cheap and they are what the eye is following.
 *
 * ⚠⚠ **The threshold is a guess and it is the single most likely thing on this
 * screen to be wrong.** It cannot be judged without a device: too large and the
 * camera lags behind the pen, too small and the map fights itself. Whoever runs
 * this on real hardware first should tune it, and should not trust it because a
 * test passes.
 */
export const CAMERA_STEP_ZOOM = 0.02;

export function cameraMovedEnough(
  previous: CameraFit | null,
  next: CameraFit | null
): boolean {
  if (next === null) {
    return false;
  }
  if (previous === null) {
    return true;
  }

  if (Math.abs(previous.zoom - next.zoom) >= CAMERA_STEP_ZOOM) {
    return true;
  }

  // A degree of latitude is ~111 km, so this is a distance test in disguise.
  // The tolerance shrinks as the map zooms in, which is what keeps a close pan
  // responsive without making an island-wide shot twitch.
  const degreeStep = CAMERA_STEP_ZOOM / Math.pow(2, Math.max(0, next.zoom - 8));

  return (
    Math.abs(previous.coordinates.latitude - next.coordinates.latitude) >= degreeStep ||
    Math.abs(previous.coordinates.longitude - next.coordinates.longitude) >= degreeStep
  );
}
