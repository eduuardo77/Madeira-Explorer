/**
 * The souvenir film, as a plan (T-105a, D-013).
 *
 * WHY THIS IS A SEPARATE MODULE FROM THE RENDERER
 * -----------------------------------------------
 * *What happens, when, and where the camera is pointing* is arithmetic and
 * lives here, tested on Node. Drawing it is `replayMap.ts` and the replay
 * screen. This module answers one question, given a trip, what is the film,
 * and returns a **storyboard**: absolute millisecond times from the start, a
 * camera path, and the strokes to draw with the moment the pen reaches each
 * of their points. A renderer needs no judgement of its own.
 *
 * THE PRIVACY GUARD IS THE FIRST THING IT DOES
 * --------------------------------------------
 * The input is an `ExportableTrace` (T-104), the only door a trace leaves this
 * app by, and **an unsafe trace produces no film at all**. There is no
 * parameter to override that: D-040 says there is no second safety net, so the
 * type asks for the flag rather than the fixes alone, and refuses without it.
 *
 * TIME IS SPENT ON GROUND, NOT ON HOURS OR POINTS
 * -----------------------------------------------
 * The pen moves at one speed along the road, whatever the hours spent there
 * or the points the road is drawn with (`penPath.ts`, T-279): road already
 * drawn hurries, a short hole another pass covers is filled from it, and the
 * camera follows the pen on the same clock (`filmCamera.ts`).
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 *   - **It names no place and no island** (D-017). Every string comes from
 *     the content pack via the caller.
 *   - **It has no clock and no randomness.** The same trip composes to the
 *     same film every time, which is what makes it testable.
 *   - **It shows no stamp on the way.** The lead asked for the film without
 *     them (17 Oct 2026); the finale still counts them.
 *
 * Pure: no database, no Expo, no clock. Tested in `composition.test.ts`.
 */

import type { TraceFix } from '../map/traceGeoJson.ts';
import { splitIntoSegments, type TraceSegment } from '../map/traceGeoJson.ts';
import type { ExportRefusal } from './exportTrace.ts';
import {
  boundsOf,
  expandToMinimumSpan,
  followCamera,
  type Bounds,
  type CameraKeyframe,
  type TimedPoint,
} from './filmCamera.ts';
import { bridgeHoles, pacePen } from './penPath.ts';

export type { Bounds, CameraKeyframe } from './filmCamera.ts';
export { MIN_SPAN_DEG } from './filmCamera.ts';

/** 9:16, the whole point (D-013): made for a phone-shaped feed. */
export const WIDTH_PX = 1080;
export const HEIGHT_PX = 1920;
export const FRAME_RATE = 30;

/**
 * A beat on the finished island before anything is drawn, and the closing
 * card held long enough to read and screenshot.
 *
 * ⚠ NOT TUNED, but watched: the lead has played the film on the P30 on real
 * trips since T-253 and singled out no timing. Named so a change is one line.
 */
export const ESTABLISH_MS = 1_200;
export const FINALE_MS = 3_000;

/**
 * How long the trace takes to draw: a floor, plus time bought by road drawn
 * (repeats discounted), capped. ⚠ NOT TUNED. The floor keeps a short day a
 * film rather than a flicker; the cap is attention, scarce in a feed.
 */
export const MIN_DRAW_MS = 6_000;
export const MAX_DRAW_MS = 14_000;
export const DRAW_MS_PER_KM = 30;

/**
 * One stroke of the draw-on, its points reached at `timesMs`.
 *
 * `endMs` of one stroke can be *earlier* than `startMs` of the next: the
 * difference is the pen-up over a hole, time in which nothing new is drawn.
 * Closing that hole would mean drawing a line nobody proved was taken.
 */
export type DrawnSegment = {
  startMs: number;
  endMs: number;
  /** [lon, lat] pairs, GeoJSON's order, the reverse of ours. */
  coordinates: [number, number][];
  /** When the pen reaches each coordinate, ms from the film's start; never decreasing. */
  timesMs: number[];
};

export type EstablishScene = {
  kind: 'establish';
  startMs: number;
  durationMs: number;
  bounds: Bounds;
};

export type DrawScene = {
  kind: 'draw';
  startMs: number;
  durationMs: number;
  segments: DrawnSegment[];
  /** A target every `CAMERA_STEP_MS`, from the scene's first moment to its last. */
  camera: CameraKeyframe[];
};

export type FinaleScene = {
  kind: 'finale';
  startMs: number;
  durationMs: number;
  bounds: Bounds;
  /** The hero number, and its unlocked-region denominator (D-024). */
  collected: number;
  total: number;
  /** Raw milliseconds. Formatting a date needs a locale, which is not pure. */
  firstFixTs: number;
  lastFixTs: number;
};

export type Scene = EstablishScene | DrawScene | FinaleScene;

/**
 * A film, or an explained refusal. A discriminated union so a caller cannot
 * reach the scenes of a composition that declined to exist.
 */
export type Composition =
  | {
      renderable: false;
      reason: string;
      /** Why the export refused, when it did: what the screen tells the user (T-275). */
      refusal?: ExportRefusal;
    }
  | {
      renderable: true;
      widthPx: number;
      heightPx: number;
      frameRate: number;
      durationMs: number;
      /** Everything drawn, framed. The establish and finale shot. */
      bounds: Bounds;
      scenes: Scene[];
      /** For the recorder's diary, not for the user. */
      reason: string;
    };

/** A stamp, reduced to what a film needs of it: the finale counts them. */
export type SouvenirStamp = {
  placeId: string;
  awardedTs: number;
};

/**
 * What the composition is allowed to know. `trace` is shaped as the relevant
 * part of `ExportableTrace` on purpose: `safeToShare` is not optional, so no
 * trace passes through here without the masking question answered.
 */
export type SouvenirInput = {
  trace: {
    fixes: TraceFix[];
    safeToShare: boolean;
    reason: string;
  };
  stamps: SouvenirStamp[];
  /** The hero number's denominator, unlocked regions only (D-024). */
  totalPlaces: number;
  /** Where the recorder considers a silence a genuine break. */
  gapThresholdMs: number;
  /**
   * The roads travelled, timed and already masked (D-093,
   * `matching/roadNetwork.ts#exportRoadSegments`). When given, the film draws
   * these instead of the fixes joined by straight lines; the fixes are still
   * what `safeToShare` vouches for, and these were built from them.
   */
  roads?: TraceSegment[];
};

/**
 * Plan the film.
 *
 * Returns `renderable: false`, never a partial or empty film, when the trace
 * was withheld by masking or nothing can honestly be drawn. An empty map with
 * a triumphant number on it is worse than no souvenir.
 */
export function composeSouvenir(input: SouvenirInput): Composition {
  if (!input.trace.safeToShare) {
    // D-040: a trace the app could not verify is withheld, not shipped
    // unmasked. That judgement was made upstream and is not revisited here.
    return { renderable: false, reason: input.trace.reason };
  }

  const segments = (input.roads ?? splitIntoSegments(input.trace.fixes, input.gapThresholdMs)).filter(
    (segment) => segment.fixes.length >= 2
  );
  if (segments.length === 0) {
    return { renderable: false, reason: 'nothing drawable in the trace' };
  }

  const fixes = segments.flatMap((segment) => segment.fixes);
  const bounds = expandToMinimumSpan(boundsOf(fixes));

  const pen = pacePen(bridgeHoles(segments.map((segment) => segment.fixes)));
  const drawMs = clamp(MIN_DRAW_MS + (pen.totalCost / 1000) * DRAW_MS_PER_KM, MIN_DRAW_MS, MAX_DRAW_MS);
  const drawStartMs = ESTABLISH_MS;
  // The pace clock, read as film time. A film of one point has no length to share out.
  const timeOf = (cost: number): number =>
    drawStartMs + (pen.totalCost > 0 ? (drawMs * cost) / pen.totalCost : 0);

  const drawn: DrawnSegment[] = pen.strokes.map((stroke) => {
    const timesMs = stroke.map((point) => timeOf(point.cost));
    return {
      startMs: timesMs[0],
      endMs: timesMs[timesMs.length - 1],
      coordinates: stroke.map((point): [number, number] => [point.lon, point.lat]),
      timesMs,
    };
  });

  const timeline: TimedPoint[] = pen.strokes.flat().map((point) => ({
    atMs: timeOf(point.cost),
    lat: point.lat,
    lon: point.lon,
    alongM: point.alongM,
  }));

  const establish: EstablishScene = { kind: 'establish', startMs: 0, durationMs: ESTABLISH_MS, bounds };
  const draw: DrawScene = {
    kind: 'draw',
    startMs: drawStartMs,
    durationMs: drawMs,
    segments: drawn,
    camera: followCamera(timeline, drawStartMs, drawMs),
  };
  const finale: FinaleScene = {
    kind: 'finale',
    startMs: drawStartMs + drawMs,
    durationMs: FINALE_MS,
    bounds,
    collected: input.stamps.length,
    total: input.totalPlaces,
    // Strokes are in time order, so the first and last points are the first and last moments.
    firstFixTs: fixes[0].ts,
    lastFixTs: fixes[fixes.length - 1].ts,
  };

  return {
    renderable: true,
    widthPx: WIDTH_PX,
    heightPx: HEIGHT_PX,
    frameRate: FRAME_RATE,
    durationMs: ESTABLISH_MS + drawMs + FINALE_MS,
    bounds,
    scenes: [establish, draw, finale],
    reason:
      `${fixes.length} points in ${segments.length} stroke(s), ` +
      `${(pen.drawnM / 1000).toFixed(1)} km drawn, ${input.stamps.length} stamp(s)`, // i18n-exempt: a diary reason, never rendered (T-190)
  };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
