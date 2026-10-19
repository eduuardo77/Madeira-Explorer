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
 * rather than about the drawing. This turns one of those frames into what
 * `GoogleMaps.View` takes: a **camera** and some **polylines**. (Stamps were
 * drawn as circles too until 17 Oct 2026, when the lead asked for the film
 * without them.)
 *
 * ⚠ It composes the map's own modules — `cameraFit`, `traceStyle` — rather
 * than restating them. The replay's trace is
 * therefore the *same blue* as the everyday map's, at the same width, and a
 * change to either follows into both.
 *
 * Pure: no React, no Expo, no clock, no `PixelRatio` (it is passed in). Tested
 * in `replayMap.test.ts`.
 */

import { fitBounds, type CameraFit, type Viewport } from '../map/cameraFit.ts';
import type { MapStyleName } from '../map/mapStyle.ts';
import { mergeTrace } from '../map/mergedTrace.ts';
import { TRACE_PAINT } from '../map/traceStyle.ts';
import type { Bounds } from './composition.ts';
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

/** One line of the film, with what it takes to tell whether it changed. */
export type ReplayLine = {
  polyline: ReplayPolyline;
  /** Changes whenever the line's strokes do, and only then. */
  version: string;
};

export type ReplayMapFrame = {
  /** Null when the box is degenerate — the caller keeps the camera it had. */
  camera: CameraFit | null;
  lines: ReplayLine[];
};

/**
 * Strokes per line of the film (T-278). The strokes so far, a fixed run of
 * them to a line: a line whose strokes are all drawn never changes again, so
 * the screen sends the map only the line still growing. One polyline per
 * stroke, all resent ten times a second, held the lead's whole-trip film to
 * 28 fps with 27 freezes over 100 ms in 25 seconds.
 */
export const STROKES_PER_LINE = 8;

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
 * ⚠ **Strokes are never drawn joined.** A gap between two strokes is a
 * recording blackout, and a line across it is a road nobody proved was taken
 * (ARCHITECTURE §10). Strokes share a polyline (`STROKES_PER_LINE`), but the
 * segment from one to the next is a **gap**, drawn transparent
 * (`mergedTrace.ts`); concatenating the coordinates without the gaps would
 * draw that road, silently. `replayMap.test.ts` checks every blackout.
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

  // Tunnels and cable cars plain, as on the map (the lead, 17 Oct 2026).
  const lines: ReplayLine[] = [];
  for (let start = 0; start < frame.strokes.length; start += STROKES_PER_LINE) {
    const strokes = frame.strokes.slice(start, start + STROKES_PER_LINE);
    const last = strokes[strokes.length - 1];
    const { coordinates, gaps } = mergeTrace(
      strokes.map((stroke) => stroke.map(([longitude, latitude]) => ({ latitude, longitude })))
    );
    lines.push({
      polyline: {
        id: `replay-trace-${start / STROKES_PER_LINE}`,
        coordinates,
        gaps,
        color: paint.coreColor,
        width: paint.coreWidth * options.pixelRatio,
      },
      // The last stroke is the only one that can still be growing, and a
      // growing stroke can keep its length while its tip moves.
      version: `${options.style}:${strokes.length}:${last.length}:${last[last.length - 1].join(',')}`,
    });
  }

  // No stamp marks: the lead, 17 Oct 2026, "remove stamp icon" from the film.
  return { camera, lines };
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
 * The shortest duration the map will take: 1 ms, which is a snap to the eye.
 *
 * ⚠ Never 0. Google's `animateCamera` throws on a zero duration ("durationMs
 * must be positive"), and `expo-maps` reaches it whenever a move is sent before
 * the map has loaded: the move waits and is then played as an animation. The
 * P30 crashed on the timelapse that way (2026-10-08), only when it was sent
 * early enough, which is why the smoke test had passed twice that morning.
 */
export const SNAP_MS = 1;

/** A plan's duration as the map must be given it: whole ms, at least `SNAP_MS`. */
export function mapDuration(durationMs: number): number {
  return Math.max(SNAP_MS, Math.round(durationMs));
}

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

  // T-253: the finale's caption sits at the foot of the screen, so the whole
  // trip rests on it rather than floating mid-screen with sea between them.
  // Only the finale: during the draw nothing is at the foot to rest on.
  const fitFinale = (bounds: Bounds): CameraFit | null =>
    fitBounds([bounds.west, bounds.south, bounds.east, bounds.north], {
      ...viewport,
      align: 'bottom',
    });

  for (const scene of film.scenes) {
    if (scene.kind !== 'draw') {
      // The establish and finale shots hold one box. Arriving at the finale is
      // worth animating — it is the pull-back to the whole trip — but the
      // opening shot must be *there* when the film starts, not gliding into
      // place from wherever the map happened to be.
      const camera = scene.kind === 'finale' ? fitFinale(scene.bounds) : fit(scene.bounds);
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
 * Where the map must already be looking when it first appears (T-253).
 *
 * ⚠ The replay once mounted its map with no camera at all, and the native map's
 * default is 0°, 0° at zoom 10: the coast of Côte d'Ivoire, which is what the
 * third review saw for several seconds before the first instruction landed.
 * The screen hands this to the map as its *initial* camera, so the first tile
 * the map asks for is already Madeira.
 *
 * Null for an empty plan; the screen then has no film to show anyway.
 */
export function openingCamera(moves: readonly CameraMove[]): CameraFit | null {
  return moves[0]?.camera ?? null;
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
