/**
 * The souvenir video, as a plan (T-105a, D-013).
 *
 * WHY THIS IS A SEPARATE MODULE FROM THE RENDERER
 * -----------------------------------------------
 * D-013 calls the end-of-trip video the entire distribution strategy, which
 * makes it the largest remaining piece of v1 — and the half of it that encodes
 * frames cannot be verified without a device this project does not have. So it
 * is split the way `stampRules` is split from `stampAwards`: *what happens,
 * when, and where the camera is pointing* is arithmetic and lives here, tested
 * on Node today. *Turning that into an MP4* is T-105b and needs hardware.
 *
 * This module answers one question — given a trip, what is the film? — and
 * returns a **storyboard**: absolute millisecond times from the start of the
 * video, a camera path, the strokes to draw, and the moment each stamp lands.
 * A renderer consuming it needs no judgement of its own.
 *
 * THE PRIVACY GUARD IS THE FIRST THING IT DOES
 * --------------------------------------------
 * The input is an `ExportableTrace` (T-104), which is the only door a trace
 * leaves this app by, and **an unsafe trace produces no film at all**. There is
 * no parameter to override that. If a future caller ever hands this raw fixes
 * out of `rawFixDao`, the app publishes where its users sleep — D-040 says
 * plainly there is no second safety net, so the type here asks for the flag
 * rather than the fixes alone, and refuses without it.
 *
 * TIME IS SPENT ON MOVEMENT, NOT ON HOURS
 * ---------------------------------------
 * The draw-on advances **one recorded fix at a time**, not one minute at a
 * time. Elapsed-time pacing would spend a third of the video sitting outside a
 * restaurant, because the recorder samples a stationary phone rarely but for a
 * long while (D-028). Per-fix pacing spends the video roughly in proportion to
 * how much was actually recorded, which is what people want to watch.
 *
 * That has a second, free consequence: the pen-lift over a blackout consumes
 * exactly one step of time. A gap is a visible beat in the film rather than a
 * line drawn across a road nobody proved was taken (ARCHITECTURE §10).
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 *   - **It never drops a stamp.** Stamps are the reward (D-002). When they are
 *     crowded, spacing shrinks and the draw lengthens; nothing is omitted.
 *   - **It names no place and no island.** Every string comes from the content
 *     pack via the caller (D-017 is called absolute). If the video should ever
 *     open on a title card reading a destination name, that name is a field in
 *     `content/pois.json`, not a literal in `app/`.
 *   - **It has no clock and no randomness.** The same trip composes to the same
 *     film every time, which is what makes it testable and what stops a re-run
 *     producing a different souvenir than the one the user already watched.
 *
 * Pure: no database, no Expo, no clock. Tested in `composition.test.ts`.
 */

import type { Category } from '../content/contentPack.ts';
import type { TraceFix, TraceSegment } from '../map/traceGeoJson.ts';
import { splitIntoSegments } from '../map/traceGeoJson.ts';
import { distanceM } from '../recording/distance.ts';

/**
 * 9:16, which is the whole point (D-013) — the video is made to be posted to a
 * phone-shaped feed, not watched on a laptop.
 */
export const WIDTH_PX = 1080;
export const HEIGHT_PX = 1920;
export const FRAME_RATE = 30;

/**
 * A beat on the finished island before anything is drawn.
 *
 * ⚠ NOT TUNED. Nothing about this file's timings has been watched by anybody;
 * they are reasoned guesses and the first person to see the video will have
 * better ones. They are named constants precisely so that changing them is a
 * one-line edit and not an archaeology exercise.
 */
export const ESTABLISH_MS = 1_200;

/** The hero number and the dates, held long enough to read and screenshot. */
export const FINALE_MS = 3_000;

/**
 * How long the trace takes to draw: a floor, plus time bought by distance
 * travelled, capped.
 *
 * ⚠ NOT TUNED. The floor exists so a single-day trip is still a film rather
 * than a flicker; the cap exists because attention is the scarce resource in a
 * feed and a two-week road trip must not earn a minute of drawing.
 */
export const MIN_DRAW_MS = 6_000;
export const MAX_DRAW_MS = 14_000;
export const DRAW_MS_PER_KM = 30;

/**
 * The shortest readable gap between two stamps landing.
 *
 * ⚠ NOT TUNED, and the one constant here most likely to be wrong — it is a
 * legibility figure, and legibility is measured by watching, not by reasoning.
 * Below roughly a third of a second two badges read as one event.
 */
export const MIN_CUE_GAP_MS = 350;

/**
 * Time kept clear at the end of the draw so the last stamp is on screen for a
 * moment before the scene changes. Earning the final stamp and immediately
 * cutting away is the one beat the film cannot afford to fumble.
 */
export const CUE_TAIL_MS = 600;

/**
 * How many camera targets the draw scene carries. The renderer interpolates
 * between them; more would be smoother and also more work to no visible end,
 * since the underlying path is a slow pan.
 */
export const CAMERA_KEYFRAMES = 6;

/**
 * How much of the trace the camera holds in frame, as a fraction of all drawn
 * fixes either side of the drawing head.
 *
 * ⚠ NOT TUNED. Large enough that the viewer can see where the line is heading;
 * small enough that the island is not permanently in wide shot.
 */
export const CAMERA_WINDOW_FRACTION = 0.15;

/** A window narrower than this many fixes frames nothing useful. */
export const MIN_CAMERA_WINDOW_FIXES = 8;

/**
 * The smallest span the camera will ever frame, in degrees.
 *
 * ⚠ NOT TUNED. Without a floor, an afternoon spent in one café would fit the
 * camera to twenty metres of GPS noise and the film would open on a jitter.
 * Roughly two kilometres of latitude; longitude is treated the same, which is
 * marginally wider on the ground at these latitudes and does no harm.
 */
export const MIN_SPAN_DEG = 0.02;

/** A geographic box, in the order `fitBounds` implementations want it. */
export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

/** A camera target. The renderer eases from one to the next. */
export type CameraKeyframe = {
  atMs: number;
  bounds: Bounds;
};

/** A stamp landing on the map. */
export type StampCue = {
  atMs: number;
  placeId: string;
  name: string;
  category: Category;
  lat: number;
  lon: number;
};

/**
 * One stroke of the draw-on.
 *
 * `endMs` of one segment is deliberately *earlier* than `startMs` of the next:
 * the difference is the pen-lift over a recording gap, and it is time in which
 * the renderer must draw nothing new. Closing that hole would mean drawing a
 * line across a blackout.
 */
export type DrawnSegment = {
  startMs: number;
  endMs: number;
  /** [lon, lat] pairs — GeoJSON's order, the reverse of ours. */
  coordinates: [number, number][];
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
  camera: CameraKeyframe[];
  /** In collection order (D-013's "stamps popping in collection order"). */
  cues: StampCue[];
};

export type FinaleScene = {
  kind: 'finale';
  startMs: number;
  durationMs: number;
  bounds: Bounds;
  /**
   * The hero number. `total` is the unlocked-region denominator (D-024) and is
   * carried here rather than assumed — whether the video *shows* a denominator
   * is a design question for T-105b, and "23 stamps" may well beat "23 / 180"
   * in a feed. The storyboard should not make that choice by withholding data.
   */
  collected: number;
  total: number;
  /** Raw milliseconds. Formatting a date needs a locale, which is not pure. */
  firstFixTs: number;
  lastFixTs: number;
};

export type Scene = EstablishScene | DrawScene | FinaleScene;

/**
 * A film, or an explained refusal.
 *
 * A discriminated union rather than an `isRenderable` flag beside optional
 * fields, so that a caller cannot reach the scenes of a composition that
 * declined to exist.
 */
export type Composition =
  | { renderable: false; reason: string }
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

/** A stamp, reduced to what a film needs of it. */
export type SouvenirStamp = {
  placeId: string;
  name: string;
  category: Category;
  awardedTs: number;
  lat: number;
  lon: number;
};

/**
 * What the composition is allowed to know.
 *
 * `trace` is shaped as the relevant part of `ExportableTrace` on purpose: the
 * `safeToShare` flag is not optional and not defaulted, so there is no way to
 * pass a trace through here without having answered the masking question.
 */
export type SouvenirInput = {
  trace: {
    fixes: TraceFix[];
    safeToShare: boolean;
    reason: string;
  };
  /** Any order; sorted here by the moment each was earned. */
  stamps: SouvenirStamp[];
  /** The hero number's denominator, unlocked regions only (D-024). */
  totalPlaces: number;
  /** Where the recorder considers a silence a genuine break. */
  gapThresholdMs: number;
};

/**
 * Plan the film.
 *
 * Returns `renderable: false` — never a partial or empty film — when the trace
 * was withheld by masking, or when there is nothing that can honestly be drawn.
 * An empty map with a triumphant number on it is worse than no souvenir.
 */
export function composeSouvenir(input: SouvenirInput): Composition {
  if (!input.trace.safeToShare) {
    // D-040: a trace the app could not verify is withheld, not shipped
    // unmasked. That judgement was made upstream and is not revisited here.
    return { renderable: false, reason: input.trace.reason };
  }

  const segments = splitIntoSegments(input.trace.fixes, input.gapThresholdMs);
  if (segments.length === 0) {
    return { renderable: false, reason: 'nothing drawable in the trace' };
  }

  // Time order across the whole trip, which is also draw order.
  const drawn: TraceFix[] = [];
  for (const segment of segments) {
    for (const fix of segment.fixes) {
      drawn.push(fix);
    }
  }

  const bounds = expandToMinimumSpan(boundsOf(drawn));
  const stamps = [...input.stamps].sort((a, b) => a.awardedTs - b.awardedTs);

  const drawMs = drawDurationMs(segments, stamps.length);
  const drawStartMs = ESTABLISH_MS;

  const establish: EstablishScene = {
    kind: 'establish',
    startMs: 0,
    durationMs: ESTABLISH_MS,
    bounds,
  };

  const draw: DrawScene = {
    kind: 'draw',
    startMs: drawStartMs,
    durationMs: drawMs,
    segments: timeSegments(segments, drawStartMs, drawMs, drawn.length),
    camera: cameraPath(drawn, drawStartMs, drawMs),
    cues: cuePath(stamps, drawn, drawStartMs, drawMs),
  };

  const finale: FinaleScene = {
    kind: 'finale',
    startMs: drawStartMs + drawMs,
    durationMs: FINALE_MS,
    bounds,
    collected: stamps.length,
    total: input.totalPlaces,
    firstFixTs: drawn[0].ts,
    lastFixTs: drawn[drawn.length - 1].ts,
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
      `${drawn.length} fixes in ${segments.length} stroke(s), ` +
      `${stamps.length} stamp(s)`,
  };
}

/**
 * How long the draw-on runs.
 *
 * Two independent pressures, and the larger wins: distance travelled buys
 * screen time, and a crowded stamp list needs room to land one badge at a
 * time. Both are capped by `MAX_DRAW_MS` — beyond that the stamps compress
 * instead, because a stamp that appears too fast is still better than a stamp
 * that does not appear.
 */
function drawDurationMs(segments: TraceSegment[], stampCount: number): number {
  let metres = 0;
  for (const segment of segments) {
    for (let i = 1; i < segment.fixes.length; i += 1) {
      // Within a segment only. Measuring across a pen-lift would charge the
      // film for a straight line nobody recorded.
      metres += distanceM(segment.fixes[i - 1], segment.fixes[i]);
    }
  }

  const forDistance = MIN_DRAW_MS + (metres / 1000) * DRAW_MS_PER_KM;
  const forStamps =
    stampCount > 1
      ? (stampCount - 1) * MIN_CUE_GAP_MS + CUE_TAIL_MS
      : MIN_DRAW_MS;

  return clamp(Math.max(forDistance, forStamps), MIN_DRAW_MS, MAX_DRAW_MS);
}

/**
 * Give every stroke its slice of the draw scene.
 *
 * Fix `i` of the whole trip is reached at `i / (total - 1)` of the scene, so a
 * stroke ends where its last fix falls and the next begins one step later. The
 * step between them is the pen-lift; see `DrawnSegment`.
 */
function timeSegments(
  segments: TraceSegment[],
  startMs: number,
  durationMs: number,
  totalFixes: number
): DrawnSegment[] {
  const steps = Math.max(1, totalFixes - 1);
  const timed: DrawnSegment[] = [];
  let index = 0;

  for (const segment of segments) {
    const firstIndex = index;
    const lastIndex = index + segment.fixes.length - 1;
    timed.push({
      startMs: startMs + (durationMs * firstIndex) / steps,
      endMs: startMs + (durationMs * lastIndex) / steps,
      coordinates: segment.fixes.map(
        (fix): [number, number] => [fix.lon, fix.lat]
      ),
    });
    index = lastIndex + 1;
  }

  return timed;
}

/**
 * The camera path: a window that travels with the drawing head.
 *
 * The window looks slightly ahead as well as behind, which is what makes a pan
 * feel deliberate rather than reactive — the viewer sees where the line is
 * going before it gets there.
 */
function cameraPath(
  drawn: TraceFix[],
  startMs: number,
  durationMs: number
): CameraKeyframe[] {
  const lastIndex = drawn.length - 1;
  const halfWindow = Math.max(
    MIN_CAMERA_WINDOW_FIXES,
    Math.round(drawn.length * CAMERA_WINDOW_FRACTION)
  );

  const keyframes: CameraKeyframe[] = [];
  for (let k = 0; k < CAMERA_KEYFRAMES; k += 1) {
    const fraction = k / (CAMERA_KEYFRAMES - 1);
    const head = Math.round(fraction * lastIndex);
    const from = Math.max(0, head - halfWindow);
    const to = Math.min(lastIndex, head + halfWindow);
    keyframes.push({
      atMs: startMs + durationMs * fraction,
      bounds: expandToMinimumSpan(boundsOf(drawn.slice(from, to + 1))),
    });
  }

  return keyframes;
}

/**
 * When each stamp lands.
 *
 * The honest moment is the one where the drawing head reaches the place — so a
 * stamp is cued at the fix that was current when it was earned, not at a share
 * of the running time. Then spacing is enforced, because Funchal will hand
 * somebody six stamps inside an hour and six badges in one frame is a mess.
 *
 * Nothing is ever dropped. If the stamps genuinely cannot be spaced within the
 * scene, they are spread evenly across it instead and every one still appears.
 */
function cuePath(
  stamps: SouvenirStamp[],
  drawn: TraceFix[],
  startMs: number,
  durationMs: number
): StampCue[] {
  if (stamps.length === 0) {
    return [];
  }

  const steps = Math.max(1, drawn.length - 1);
  const lastAllowedMs = startMs + Math.max(0, durationMs - CUE_TAIL_MS);

  const cues: StampCue[] = stamps.map((stamp) => ({
    atMs: startMs + (durationMs * headIndexAt(drawn, stamp.awardedTs)) / steps,
    placeId: stamp.placeId,
    name: stamp.name,
    category: stamp.category,
    lat: stamp.lat,
    lon: stamp.lon,
  }));

  // The widest spacing that still fits. Usually `MIN_CUE_GAP_MS`; less only
  // when the collection is dense enough that the scene cannot hold it.
  const gapMs =
    cues.length > 1
      ? Math.min(MIN_CUE_GAP_MS, (lastAllowedMs - startMs) / (cues.length - 1))
      : 0;

  // Forward: push each cue clear of the one before it.
  for (let i = 1; i < cues.length; i += 1) {
    cues[i].atMs = Math.max(cues[i].atMs, cues[i - 1].atMs + gapMs);
  }
  // Backward: pull the tail back inside the scene. `gapMs` was chosen so that
  // the whole run fits between `startMs` and `lastAllowedMs`, which is what
  // makes this pass safe to apply without re-checking the forward one.
  cues[cues.length - 1].atMs = Math.min(
    cues[cues.length - 1].atMs,
    lastAllowedMs
  );
  for (let i = cues.length - 2; i >= 0; i -= 1) {
    cues[i].atMs = Math.min(cues[i].atMs, cues[i + 1].atMs - gapMs);
  }

  return cues;
}

/**
 * Which fix the draw head is on at a given moment.
 *
 * A stamp earned before the first drawn fix — plausible, since masking removes
 * fixes but never a stamp — lands at the start rather than off the timeline.
 */
function headIndexAt(drawn: TraceFix[], ts: number): number {
  let index = 0;
  for (let i = 0; i < drawn.length; i += 1) {
    if (drawn[i].ts <= ts) {
      index = i;
    } else {
      break;
    }
  }
  return index;
}

/** The box containing every point. `points` must not be empty. */
function boundsOf(points: { lat: number; lon: number }[]): Bounds {
  let north = points[0].lat;
  let south = points[0].lat;
  let east = points[0].lon;
  let west = points[0].lon;

  for (const point of points) {
    if (point.lat > north) north = point.lat;
    if (point.lat < south) south = point.lat;
    if (point.lon > east) east = point.lon;
    if (point.lon < west) west = point.lon;
  }

  return { north, south, east, west };
}

/**
 * Widen a box that is too small to frame, by padding each side equally.
 *
 * Padding rather than recomputing the box from its centre, because recomputing
 * loses the last digit or two of a float and can hand back a box very slightly
 * *inside* the points it was built from — which then quietly clips the end of
 * the trace. Padding can only ever grow it.
 *
 * Assumes a trip that does not cross the antimeridian, which is true of any
 * trip a single content pack describes.
 */
function expandToMinimumSpan(bounds: Bounds): Bounds {
  const latShortfall = MIN_SPAN_DEG - (bounds.north - bounds.south);
  const lonShortfall = MIN_SPAN_DEG - (bounds.east - bounds.west);
  if (latShortfall <= 0 && lonShortfall <= 0) {
    return bounds;
  }

  const latPad = latShortfall > 0 ? latShortfall / 2 : 0;
  const lonPad = lonShortfall > 0 ? lonShortfall / 2 : 0;

  return {
    north: bounds.north + latPad,
    south: bounds.south - latPad,
    east: bounds.east + lonPad,
    west: bounds.west - lonPad,
  };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
