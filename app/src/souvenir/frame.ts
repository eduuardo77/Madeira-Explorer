/**
 * The film at one instant (T-105b, D-013).
 *
 * `composition.ts` answers *what is the film*: scenes, camera targets and
 * strokes, in absolute milliseconds. This answers the next question: **given
 * that plan and a time `t`, what is on screen?** The replay drives it from a
 * wall clock; the preview tools from `frameTimes`.
 *
 * ⚠ **Sampled, not stepped.** `frameAt` takes a time, not a frame index, and
 * holds no state between calls, so a renderer that dropped a frame cannot
 * drift out of sync with the plan. No clock and no randomness: `frameAt(film,
 * 3000)` is the same picture every time.
 *
 * Pure: no database, no Expo, no clock. Tested in `frame.test.ts`.
 */

import type { Bounds, CameraKeyframe, Composition, DrawnSegment, Scene } from './composition.ts';

/** A composition that exists. The refusal case has no frames by construction. */
export type Film = Extract<Composition, { renderable: true }>;

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
  /** What the camera sees now, between the storyboard's targets. */
  bounds: Bounds;
  /**
   * The trace drawn so far, `[lon, lat]`, GeoJSON's order, as everywhere else.
   *
   * ⚠ **One entry per stroke, and never joined.** A gap between two strokes is
   * a pen-up over a hole (`composition.ts`), and concatenating them would draw
   * a straight line across a road nobody proved was taken, the thing
   * ARCHITECTURE §10 forbids the app to draw.
   */
  strokes: [number, number][][];
  hero: Hero | null;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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

/**
 * The camera between two targets, in a straight line. The targets are dense
 * and already smoothed (`filmCamera.ts`), and the map plays them the same way
 * (`replayMap.cameraAt`), so a preview frame and the phone agree.
 */
function cameraAt(keyframes: CameraKeyframe[], fallback: Bounds, atMs: number): Bounds {
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
      return lerpBounds(from.bounds, to.bounds, span <= 0 ? 1 : (atMs - from.atMs) / span);
    }
  }
  return keyframes[keyframes.length - 1].bounds;
}

/**
 * How much of one stroke has been drawn: every point the pen has reached, and
 * the tip interpolated along the edge in progress, so the line grows
 * continuously rather than a point at a time.
 */
function partialStroke(segment: DrawnSegment, atMs: number): [number, number][] | null {
  if (atMs >= segment.endMs) {
    return segment.coordinates;
  }
  if (atMs <= segment.startMs) {
    return null;
  }
  const times = segment.timesMs;
  // The last point already reached; the pen is somewhere on the edge after it.
  let reached = 0;
  while (reached + 1 < times.length && times[reached + 1] <= atMs) reached += 1;
  const drawn = segment.coordinates.slice(0, reached + 1);
  if (reached + 1 < times.length) {
    const span = times[reached + 1] - times[reached];
    const u = span <= 0 ? 1 : (atMs - times[reached]) / span;
    const [fromLon, fromLat] = segment.coordinates[reached];
    const [toLon, toLat] = segment.coordinates[reached + 1];
    drawn.push([lerp(fromLon, toLon, u), lerp(fromLat, toLat, u)]);
  }
  // A single point is not a line.
  return drawn.length >= 2 ? drawn : null;
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

  // ⚠ Strokes come from every draw scene, not only the current one: during the
  // finale the whole trace stays on screen, which is the picture being framed.
  const strokes: [number, number][][] = [];
  for (const segment of film.scenes.flatMap((each) => (each.kind === 'draw' ? each.segments : []))) {
    const stroke = partialStroke(segment, at);
    if (stroke !== null) {
      strokes.push(stroke);
    }
  }

  return {
    atMs: at,
    kind: scene.kind,
    sceneProgress,
    bounds,
    strokes,
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
