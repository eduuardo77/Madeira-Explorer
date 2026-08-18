/**
 * The film at one instant (T-105b, D-013).
 *
 * `composition.ts` answers *what is the film* — scenes, camera path, strokes,
 * the moment each stamp lands, all in absolute milliseconds. It stops there.
 * This answers the next question, which nothing did until now: **given that
 * plan and a time `t`, what is on screen?**
 *
 * WHY THIS IS WORTH ITS OWN MODULE, AND WHY IT IS NOT A BET
 * --------------------------------------------------------
 * ⚠ The project lead is undecided between a **timelapse video** to post and an
 * **in-app replay** to watch (the reference app has the replay and no video —
 * `docs/competitors.md`). This module is the half both need, and it does not
 * choose between them:
 *
 *   - a **replay** drives `frameAt` from a wall clock into the on-screen view;
 *   - a **video** drives the same `frameAt` from `frameTimes` into an encoder.
 *
 * Same arithmetic, two consumers. Building it now is not a wager on either —
 * and the replay is reachable with no device and no native code, while the
 * video needs both (`docs/video-encoder-research.md`).
 *
 * DETERMINISTIC, LIKE THE STORYBOARD ABOVE IT
 * -------------------------------------------
 * No clock and no randomness. `frameAt(film, 3000)` is the same picture today
 * and next year, which is what lets it be tested on Node and what stops a
 * re-render producing a different souvenir than the one already watched.
 *
 * ⚠ **It is sampled, not stepped.** `frameAt` takes a time, not a frame index,
 * and holds no state between calls. A renderer that dropped a frame cannot
 * drift out of sync with the plan, and the encoder and the preview tool cannot
 * disagree about what frame 47 contains.
 *
 * Pure: no database, no Expo, no clock. Tested in `frame.test.ts`.
 */

import type { Category } from '../content/contentPack.ts';
import type {
  Bounds,
  CameraKeyframe,
  Composition,
  DrawnSegment,
  Scene,
  StampCue,
} from './composition.ts';

/** A composition that exists. The refusal case has no frames by construction. */
export type Film = Extract<Composition, { renderable: true }>;

/** A stamp that has already landed, and how long ago. */
export type LandedStamp = {
  placeId: string;
  name: string;
  category: Category;
  lat: number;
  lon: number;
  /**
   * Milliseconds since it landed — 0 on the exact frame it appears.
   *
   * Carried rather than a `justLanded` boolean because the renderer owns the
   * animation: a pop, a fade, a ring, or nothing at all. A boolean would put
   * that choice here, where it cannot be looked at.
   */
  ageMs: number;
};

/** The closing card's numbers. Present only during the finale. */
export type Hero = {
  collected: number;
  total: number;
  firstFixTs: number;
  lastFixTs: number;
};

export type Frame = {
  /** Where in the film this is, clamped into it. */
  atMs: number;
  kind: Scene['kind'];
  /** 0 to 1 through the current scene, for fades the renderer decides on. */
  sceneProgress: number;
  /** What the camera sees now, eased between the storyboard's keyframes. */
  bounds: Bounds;
  /**
   * The trace drawn so far, `[lon, lat]` — GeoJSON's order, as everywhere else.
   *
   * ⚠ **One entry per stroke, and never joined.** A gap between two segments is
   * a pen-lift over a recording blackout (`composition.ts`), and concatenating
   * them would draw a straight line across a road nobody proved was taken —
   * the thing ARCHITECTURE §10 forbids the app to draw.
   */
  strokes: [number, number][][];
  /** Landed, in the order they were collected. */
  stamps: LandedStamp[];
  hero: Hero | null;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Smoothstep.
 *
 * Linear easing between camera keyframes reads as a machine panning: the map
 * starts and stops dead, six times, and the eye catches every corner. This is
 * the cheapest curve with zero velocity at both ends, and it needs no library.
 */
function ease(u: number): number {
  const clamped = clamp01(u);
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(from: number, to: number, u: number): number {
  return from + (to - from) * u;
}

function lerpBounds(from: Bounds, to: Bounds, u: number): Bounds {
  return {
    north: lerp(from.north, to.north, u),
    south: lerp(from.south, to.south, u),
    east: lerp(from.east, to.east, u),
    west: lerp(from.west, to.west, u),
  };
}

/** How many frames the encoder will ask for. At least one, always. */
export function frameCount(film: Film): number {
  return Math.max(1, Math.ceil((film.durationMs / 1000) * film.frameRate));
}

/**
 * Every instant the encoder should sample, in order.
 *
 * ⚠ **The times come from the frame rate, not from the scenes.** The storyboard
 * is written in milliseconds and knows nothing about 30 fps; deriving the
 * schedule here is what keeps a scene boundary from silently becoming a frame
 * boundary, and what lets the same film be re-encoded at another rate.
 */
export function frameTimes(film: Film): number[] {
  const count = frameCount(film);
  const times: number[] = [];
  for (let i = 0; i < count; i += 1) {
    times.push(Math.min((i * 1000) / film.frameRate, film.durationMs));
  }
  return times;
}

function sceneAt(film: Film, atMs: number): Scene {
  // Later scenes win a tie, so a frame landing exactly on a boundary belongs to
  // the scene starting there rather than to the last instant of the one ending.
  let found = film.scenes[0];
  for (const scene of film.scenes) {
    if (atMs >= scene.startMs) {
      found = scene;
    }
  }
  return found;
}

function cameraAt(
  keyframes: CameraKeyframe[],
  fallback: Bounds,
  atMs: number
): Bounds {
  if (keyframes.length === 0) {
    return fallback;
  }
  if (atMs <= keyframes[0].atMs) {
    return keyframes[0].bounds;
  }

  for (let i = 0; i < keyframes.length - 1; i += 1) {
    const from = keyframes[i];
    const to = keyframes[i + 1];
    if (atMs <= to.atMs) {
      const span = to.atMs - from.atMs;
      // Two keyframes at the same instant would divide by zero; the later one
      // is the answer, which is also what a zero-length ease would produce.
      const u = span <= 0 ? 1 : ease((atMs - from.atMs) / span);
      return lerpBounds(from.bounds, to.bounds, u);
    }
  }

  return keyframes[keyframes.length - 1].bounds;
}

/**
 * How much of one stroke has been drawn.
 *
 * The pen advances **one recorded fix per step**, which is the pacing
 * `composition.ts` chose deliberately — elapsed-time pacing would spend a third
 * of the film parked outside a restaurant. The final point is interpolated
 * along the edge in progress rather than snapped to the next fix: the pacing
 * stays per-fix, but the line grows continuously instead of ticking, which at
 * eight fixes a segment is the difference between a drawn line and a stutter.
 */
function partialStroke(
  segment: DrawnSegment,
  atMs: number
): [number, number][] | null {
  if (atMs >= segment.endMs) {
    return segment.coordinates.length >= 2 ? segment.coordinates : null;
  }
  if (atMs <= segment.startMs) {
    return null;
  }

  const span = segment.endMs - segment.startMs;
  const u = span <= 0 ? 1 : (atMs - segment.startMs) / span;

  const edges = segment.coordinates.length - 1;
  const travelled = clamp01(u) * edges;
  const whole = Math.min(Math.floor(travelled), edges);
  const fraction = travelled - whole;

  const drawn: [number, number][] = segment.coordinates.slice(0, whole + 1);

  if (whole < edges && fraction > 0) {
    const [fromLon, fromLat] = segment.coordinates[whole];
    const [toLon, toLat] = segment.coordinates[whole + 1];
    drawn.push([lerp(fromLon, toLon, fraction), lerp(fromLat, toLat, fraction)]);
  }

  // A single point is not a line. Better to show nothing for one frame than to
  // ask every renderer to guess what a one-point stroke means.
  return drawn.length >= 2 ? drawn : null;
}

/** Every stamp cue in the film, in the order they land. */
function allCues(film: Film): StampCue[] {
  return film.scenes.flatMap((scene) =>
    scene.kind === 'draw' ? scene.cues : []
  );
}

/**
 * What is on screen at `atMs`.
 *
 * Times outside the film are clamped into it rather than refused: a renderer
 * running a frame late at the end must show the last frame, not throw.
 */
export function frameAt(film: Film, atMs: number): Frame {
  const at = Math.min(Math.max(atMs, 0), film.durationMs);
  const scene = sceneAt(film, at);

  const sceneProgress =
    scene.durationMs <= 0 ? 1 : clamp01((at - scene.startMs) / scene.durationMs);

  const bounds =
    scene.kind === 'draw'
      ? cameraAt(scene.camera, film.bounds, at)
      : scene.bounds;

  // ⚠ Strokes come from every draw scene, not only the current one. During the
  // finale the whole trace stays on screen — that is the picture being framed —
  // and reading only the active scene would blank the map for the closing shot.
  const strokes = film.scenes
    .flatMap((each) => (each.kind === 'draw' ? each.segments : []))
    .map((segment) => partialStroke(segment, at))
    .filter((stroke): stroke is [number, number][] => stroke !== null);

  const stamps: LandedStamp[] = allCues(film)
    .filter((cue) => cue.atMs <= at)
    .map((cue) => ({
      placeId: cue.placeId,
      name: cue.name,
      category: cue.category,
      lat: cue.lat,
      lon: cue.lon,
      ageMs: at - cue.atMs,
    }));

  return {
    atMs: at,
    kind: scene.kind,
    sceneProgress,
    bounds,
    strokes,
    stamps,
    hero:
      scene.kind === 'finale'
        ? {
            collected: scene.collected,
            total: scene.total,
            firstFixTs: scene.firstFixTs,
            lastFixTs: scene.lastFixTs,
          }
        : null,
  };
}

/**
 * Turn a camera box into pixels.
 *
 * ⚠ **Fit, never fill.** The visible box and a 9:16 frame will not share an
 * aspect ratio, so something has to give: either the trace is scaled to cover
 * the frame and its corners are cropped away, or it is fitted and there is
 * spare room. **Fitted.** A souvenir with the end of the walk cropped off the
 * edge is a worse picture than one with space around it — and the card design
 * puts words in that space anyway.
 *
 * Longitude is compressed by `cos(latitude)`; at Madeira's 32.7° that is a 16%
 * correction, and skipping it squashes the drawing east-to-west by about a
 * sixth. `shareCard.ts` applies the same correction for the still card, and
 * `map/cameraFit.ts` uses true Mercator where a real map projection is needed.
 * Over a box this small the difference is far below one pixel.
 */
export function projector(
  bounds: Bounds,
  widthPx: number,
  heightPx: number
): (lon: number, lat: number) => [number, number] {
  const latitudeScale = Math.cos(
    ((bounds.north + bounds.south) / 2) * (Math.PI / 180)
  );

  const spanX = Math.max((bounds.east - bounds.west) * latitudeScale, 1e-9);
  const spanY = Math.max(bounds.north - bounds.south, 1e-9);

  const scale = Math.min(widthPx / spanX, heightPx / spanY);

  const offsetX = (widthPx - spanX * scale) / 2;
  const offsetY = (heightPx - spanY * scale) / 2;

  return (lon, lat) => [
    offsetX + (lon - bounds.west) * latitudeScale * scale,
    // Latitude grows north; the frame grows down.
    offsetY + (bounds.north - lat) * scale,
  ];
}
