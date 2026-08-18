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
import type { Bounds } from './composition.ts';
import type { Film, Frame } from './frame.ts';

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
 * One instruction for the map's camera: *be here, taking this long to arrive*.
 *
 * The `durationMs` is handed straight to `setCameraPosition`, which is what
 * makes this work — **the map animates itself**, on the platform's own timing
 * and with the platform's own curve.
 */
export type CameraMove = {
  /** When the instruction should be issued, ms from the start of the film. */
  atMs: number;
  camera: CameraFit;
  /** How long the map should take to get there. 0 snaps. */
  durationMs: number;
};

/**
 * The camera, as a handful of instructions rather than a value per frame.
 *
 * ⚠⚠ **THIS REPLACED A THRESHOLD, AND THE THRESHOLD WAS THE WRONG IDEA.**
 * The first version recomputed the camera every frame, discovered that
 * reassigning a native map camera 30 times a second restarts its animation and
 * stutters, and then throttled its own interpolation with a tuned constant —
 * `CAMERA_STEP_ZOOM`, a guess that could only be judged on hardware nobody has.
 *
 * The mistake was interpolating at all. `expo-maps` exposes
 * `setCameraPosition({ ..., duration })`: the map will ease from where it is to
 * where you say, over as long as you say. And `composition.ts` has emitted
 * **camera keyframes** since T-105a, described in its own words as *"a camera
 * target — the renderer eases from one to the next"*.
 *
 * So the renderer stops easing. It hands the map each keyframe as a target and
 * the gap to the next one as a duration, and the platform does the work it is
 * good at. **Six instructions for a ten-second film instead of three hundred,
 * and not one tunable number anywhere.**
 *
 * ⚠ The easing curve is now the platform's, not `frame.ts`'s smoothstep. The
 * preview tools still project through `frame.bounds`, so a preview frame and
 * the real map can differ slightly *in the middle of a pan*. They agree at
 * every keyframe, which is what those previews are for.
 */
export function cameraPlan(film: Film, viewport: Viewport): CameraMove[] {
  const moves: CameraMove[] = [];

  const fit = (bounds: Bounds): CameraFit | null =>
    fitBounds([bounds.west, bounds.south, bounds.east, bounds.north], viewport);

  for (const scene of film.scenes) {
    if (scene.kind !== 'draw') {
      // The establish and finale shots hold one box. Arriving at the finale is
      // worth animating — it is the pull-back to the whole trip — but the
      // opening shot must be *there* when the film starts, not gliding into
      // place from wherever the map happened to be.
      const camera = fit(scene.bounds);
      if (camera !== null) {
        moves.push({
          atMs: scene.startMs,
          camera,
          durationMs: scene.kind === 'establish' ? 0 : scene.durationMs,
        });
      }
      continue;
    }

    scene.camera.forEach((keyframe, index) => {
      const camera = fit(keyframe.bounds);
      if (camera === null) {
        return;
      }
      const next = scene.camera[index + 1];
      // The last keyframe of the draw runs until the scene ends; the finale
      // issues its own instruction immediately afterwards.
      const until = next?.atMs ?? scene.startMs + scene.durationMs;
      moves.push({
        atMs: keyframe.atMs,
        camera,
        // ⚠ The first keyframe snaps. The establish shot has just placed the
        // camera on the whole walk, and a keyframe that eased in from there
        // would spend its whole duration travelling instead of following.
        durationMs: index === 0 ? 0 : Math.max(0, until - keyframe.atMs),
      });
    });
  }

  const ordered = moves.sort((a, b) => a.atMs - b.atMs);

  // ⚠ Two instructions at the same instant, and only the last one is ever seen.
  // Found by a test: the draw's final keyframe lands exactly when the finale
  // starts, so the camera snapped to a close-up and then eased out to the whole
  // trip — a jump, immediately undone, on the last second of the film. The
  // earlier one is not merely redundant, it is visible as a flinch.
  return ordered.filter(
    (move, index) => ordered[index + 1]?.atMs !== move.atMs
  );
}

/**
 * Which instruction should have been issued by now.
 *
 * Returns an index into `cameraPlan`'s result, or -1 before the first. The
 * caller keeps track of what it has already sent — sending the same instruction
 * twice would restart an animation that is halfway through, which is the
 * stutter this whole approach exists to avoid.
 */
export function cameraMoveDue(moves: readonly CameraMove[], atMs: number): number {
  let due = -1;
  for (let i = 0; i < moves.length; i += 1) {
    if (moves[i].atMs <= atMs) {
      due = i;
    }
  }
  return due;
}
