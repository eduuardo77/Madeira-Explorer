/**
 * The film, as instructions for the **real map** (D-076).
 *
 * The replay renders Google's own map, the same basemap as the everyday map,
 * with the camera following the pen and the trace growing behind it. The
 * lead's words that set this (2026-08-18): *"It should be a video of the
 * already existing map, as if someone was screen-recording while you were
 * walking, but adding some motion."* Nothing here draws a basemap.
 *
 * This turns the plan into what `GoogleMaps.View` takes: **lines** for the
 * trace drawn so far (`replayMapFrame`), and one **camera path** for the whole
 * film (`cameraPath`), which the map plays itself, frame by frame (T-279).
 *
 * ⚠ It composes the map's own modules, `cameraFit` and `traceStyle`, rather
 * than restating them: the replay's trace is the everyday map's colour and
 * width, and a change to either follows into both.
 *
 * Pure: no React, no Expo, no clock, no `PixelRatio` (it is passed in). Tested
 * in `replayMap.test.ts`.
 */

import { fitBounds, type CameraFit, type Viewport } from '../map/cameraFit.ts';
import type { MapStyleName } from '../map/mapStyle.ts';
import { mergeTrace } from '../map/mergedTrace.ts';
import { TRACE_PAINT } from '../map/traceStyle.ts';
import type { Bounds } from './composition.ts';
import { CAMERA_STEP_MS } from './filmCamera.ts';
import type { Film, Frame } from './frame.ts';

/** Mirrors `GoogleMapsPolyline`, without importing the native module. */
export type ReplayPolyline = {
  id: string;
  coordinates: { latitude: number; longitude: number }[];
  /** Segments not drawn, by index (`mergedTrace.ts`). */
  gaps: number[];
  color: string;
  width: number;
};

/**
 * One line of the film: its id, a version that changes whenever its strokes
 * do, and the polyline, built only when asked for. A finished line is asked
 * for once; building every line on every frame was most of the replay's work.
 */
export type ReplayLine = {
  id: string;
  version: string;
  polyline: () => ReplayPolyline;
};

/**
 * Strokes per line of the film (T-278). A line whose strokes are all drawn
 * never changes again, so the screen sends the map only the line still
 * growing. One polyline per stroke, all resent ten times a second, held the
 * lead's whole-trip film to 28 fps with 27 freezes over 100 ms in 25 seconds.
 */
export const STROKES_PER_LINE = 8;

export type ReplayMapOptions = {
  style: MapStyleName;
  /**
   * `PixelRatio.get()`, passed in. ⚠ The native polyline width is in
   * **pixels** while every other size in this app is in points: a trace drawn
   * at point width on a 3x screen is the hairline the first build shipped.
   */
  pixelRatio: number;
};

/**
 * The film's lines at one frame.
 *
 * ⚠ **Strokes are never drawn joined.** Strokes share a polyline, but the
 * segment from one to the next is a **gap**, drawn transparent
 * (`mergedTrace.ts`); concatenating the coordinates without the gaps would
 * draw a road nobody proved was taken, silently. `replayMap.test.ts` checks
 * every hole. Tunnels and cable cars plain, as on the map (the lead, 17 Oct 2026).
 */
export function replayMapFrame(frame: Frame, options: ReplayMapOptions): ReplayLine[] {
  const paint = TRACE_PAINT[options.style];
  const lines: ReplayLine[] = [];
  for (let start = 0; start < frame.strokes.length; start += STROKES_PER_LINE) {
    const strokes = frame.strokes.slice(start, start + STROKES_PER_LINE);
    const last = strokes[strokes.length - 1];
    const id = `replay-trace-${start / STROKES_PER_LINE}`;
    lines.push({
      id,
      // The last stroke is the only one that can still be growing, and a
      // growing stroke can keep its length while its tip moves.
      version: `${options.style}:${strokes.length}:${last.length}:${last[last.length - 1].join(',')}`,
      polyline: () => {
        const { coordinates, gaps } = mergeTrace(
          strokes.map((stroke) => stroke.map(([longitude, latitude]) => ({ latitude, longitude })))
        );
        return { id, coordinates, gaps, color: paint.coreColor, width: paint.coreWidth * options.pixelRatio };
      },
    });
  }
  return lines;
}

/**
 * The shortest duration the map will take for a camera move: 1 ms, a snap to
 * the eye. ⚠ Never 0: Google's `animateCamera` throws on a zero duration, and
 * `expo-maps` reaches it whenever a move is sent before the map has loaded.
 * The P30 crashed on the timelapse that way (2026-10-08).
 */
export const SNAP_MS = 1;

/** Where the map's camera is at `atMs`. The map moves in a straight line between two. */
export type CameraPoint = { atMs: number; camera: CameraFit };

/** How long the camera takes to come in from the whole trip to the pen, ms. */
export const CAMERA_IN_MS = 1_000;
/** How long the finale's pull-back to the whole trip takes, ms. */
export const CAMERA_OUT_MS = 1_500;
/** How long before the last stroke ends the pull-back begins, ms. */
export const CAMERA_OUT_LEAD_MS = 600;
/** How far apart the points of the path the map plays are, ms: one a frame at 60 fps. */
export const PATH_STEP_MS = 1000 / 60;

/**
 * The whole film's camera, as points the map moves through in straight lines:
 * the whole trip held for the opening, an eased move in to the pen as it
 * starts, the pen followed (`filmCamera.ts`), and an eased pull-back to the
 * whole trip resting on the closing card.
 *
 * ⚠⚠ **ONE PATH, PLAYED BY THE MAP, AND IT REPLACED SIX EASED MOVES.** Each of
 * the six was its own Google animation, starting and stopping on its own
 * curve, so the pan pulsed, and between them the map took a path the film had
 * not planned, which on the lead's phone left the pen out of frame (T-279).
 * Moving the camera from JavaScript every frame was tried first and stuttered
 * (2026-08-18). Now the expo-maps patch plays this path on the map's own frame
 * clock (`playCameraPath`).
 *
 * ⚠ **A curve through the targets, sampled every frame.** Played as straight
 * lines between targets a tenth of a second apart, the camera's speed changed
 * in a step at every target, a judder ten times a second (`tools/film-check`
 * measured up to 5 dp per frame per frame on the lead's trip). A monotone
 * cubic changes speed smoothly, never overshoots a target, and holds still
 * where the targets do; sampled `PATH_STEP_MS` apart, the map's straight
 * lines between samples are too short to see.
 */
export function cameraPath(film: Film, viewport: Viewport): CameraPoint[] {
  const fit = (bounds: Bounds, align?: Viewport['align']): CameraFit | null =>
    fitBounds([bounds.west, bounds.south, bounds.east, bounds.north], { ...viewport, align });

  const whole = fit(film.bounds);
  const draw = film.scenes.find((scene) => scene.kind === 'draw');
  const finale = film.scenes.find((scene) => scene.kind === 'finale');
  if (whole === null) {
    return [];
  }
  if (draw === undefined || finale === undefined) {
    return [{ atMs: 0, camera: whole }];
  }
  // T-253: the closing caption sits at the foot of the screen, so the whole
  // trip rests on it rather than floating mid-screen with sea between them.
  const resting = fit(finale.bounds, 'bottom') ?? whole;

  // ⚠ The moves in and out blend **boxes**, not cameras. A box between two
  // boxes that both hold the pen holds it too; a camera mixed by zoom and
  // centre does not, and in the first version the end of the line swung out
  // of frame during the pull-back and back in.
  // The pull-back starts before the last stroke ends, from the moving camera,
  // so the motion runs on into it: begun at the end, from a standstill, it
  // was the film's worst jolt (T-279).
  const outStartMs = finale.startMs - CAMERA_OUT_LEAD_MS;
  /** The camera for `box`, pulled back by `u`: centred, sliding down to rest on the card. */
  const framed = (box: Bounds, atMs: number): CameraFit | null => {
    const u = ease((atMs - outStartMs) / CAMERA_OUT_MS);
    const pulled = lerpBounds(box, finale.bounds, u);
    // One box at one zoom placed two ways, so mixing them only slides it.
    const centred = fit(pulled);
    const low = fit(pulled, 'bottom');
    return centred === null || low === null ? null : u > 0 ? mix(centred, low, u) : centred;
  };

  const path: CameraPoint[] = [{ atMs: 0, camera: whole }];
  let lastBox = film.bounds;
  for (const keyframe of draw.camera) {
    const u = (keyframe.atMs - draw.startMs) / CAMERA_IN_MS;
    const box = u < 1 ? lerpBounds(film.bounds, keyframe.bounds, ease(u)) : keyframe.bounds;
    const camera = framed(box, keyframe.atMs);
    if (camera === null) continue;
    lastBox = box;
    path.push({ atMs: keyframe.atMs, camera });
  }
  for (let at = finale.startMs + CAMERA_STEP_MS; at < outStartMs + CAMERA_OUT_MS; at += CAMERA_STEP_MS) {
    const camera = framed(lastBox, at);
    if (camera !== null) path.push({ atMs: at, camera });
  }
  path.push({ atMs: outStartMs + CAMERA_OUT_MS, camera: resting });
  path.push({ atMs: film.durationMs, camera: resting });
  return sampled(path);
}
/** `stops` joined by a monotone cubic in centre and zoom, a point every `PATH_STEP_MS`. */
function sampled(stops: readonly CameraPoint[]): CameraPoint[] {
  const times = stops.map((stop) => stop.atMs);
  const curves = [
    monotoneCubic(times, stops.map((stop) => stop.camera.coordinates.latitude)),
    monotoneCubic(times, stops.map((stop) => stop.camera.coordinates.longitude)),
    monotoneCubic(times, stops.map((stop) => stop.camera.zoom)),
  ];
  const end = times[times.length - 1];
  const out: CameraPoint[] = [];
  for (let step = 0; step * PATH_STEP_MS < end; step += 1) {
    out.push(pointOn(curves, step * PATH_STEP_MS));
  }
  out.push(pointOn(curves, end));
  return out;
}

function pointOn(curves: ((atMs: number) => number)[], atMs: number): CameraPoint {
  const [latitude, longitude, zoom] = curves.map((curve) => curve(atMs));
  return { atMs, camera: { coordinates: { latitude, longitude }, zoom } };
}

/**
 * The monotone cubic through (`times`, `values`) (Fritsch and Carlson): no
 * value between two points leaves their range, a flat stretch stays flat, and
 * it starts and ends at rest. `times` ascending.
 */
function monotoneCubic(times: readonly number[], values: readonly number[]): (atMs: number) => number {
  const n = times.length;
  const slopes: number[] = [];
  for (let i = 0; i + 1 < n; i += 1) {
    const span = times[i + 1] - times[i];
    slopes.push(span > 0 ? (values[i + 1] - values[i]) / span : 0);
  }
  const tangents = times.map((_, i) => {
    if (i === 0 || i === n - 1) return 0;
    const [before, after] = [slopes[i - 1], slopes[i]];
    if (before * after <= 0) return 0;
    const [h0, h1] = [times[i] - times[i - 1], times[i + 1] - times[i]];
    const [w0, w1] = [2 * h1 + h0, h1 + 2 * h0];
    return (w0 + w1) / (w0 / before + w1 / after);
  });
  return (atMs) => {
    if (atMs <= times[0]) return values[0];
    if (atMs >= times[n - 1]) return values[n - 1];
    let low = 0;
    let high = n - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (times[middle] <= atMs) low = middle;
      else high = middle;
    }
    const span = times[high] - times[low];
    if (span <= 0) return values[high];
    const t = (atMs - times[low]) / span;
    const [t2, t3] = [t * t, t * t * t];
    return (
      (2 * t3 - 3 * t2 + 1) * values[low] +
      (t3 - 2 * t2 + t) * span * tangents[low] +
      (-2 * t3 + 3 * t2) * values[high] +
      (t3 - t2) * span * tangents[high]
    );
  };
}

/** Where the camera is at `atMs`, exactly as the map's player computes it. */
export function cameraAt(path: readonly CameraPoint[], atMs: number): CameraFit {
  const last = path.length - 1;
  if (atMs <= path[0].atMs) return path[0].camera;
  if (atMs >= path[last].atMs) return path[last].camera;
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (path[middle].atMs < atMs) low = middle;
    else high = middle;
  }
  const span = path[high].atMs - path[low].atMs;
  return mix(path[low].camera, path[high].camera, span <= 0 ? 1 : (atMs - path[low].atMs) / span);
}

/** Smoothstep: a move that starts and ends at rest. */
function ease(u: number): number {
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
}

function lerpBounds(a: Bounds, b: Bounds, u: number): Bounds {
  return {
    north: a.north + u * (b.north - a.north),
    south: a.south + u * (b.south - a.south),
    east: a.east + u * (b.east - a.east),
    west: a.west + u * (b.west - a.west),
  };
}

/** In a straight line from `a` to `b`: centre in degrees, zoom in levels. */
function mix(a: CameraFit, b: CameraFit, u: number): CameraFit {
  return {
    coordinates: {
      latitude: a.coordinates.latitude + u * (b.coordinates.latitude - a.coordinates.latitude),
      longitude: a.coordinates.longitude + u * (b.coordinates.longitude - a.coordinates.longitude),
    },
    zoom: a.zoom + u * (b.zoom - a.zoom),
  };
}
