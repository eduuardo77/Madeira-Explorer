/**
 * The film's camera: a box that follows the pen, ten times a second (T-279).
 *
 * WHY DENSE, AND WHY SMOOTHED HERE
 * --------------------------------
 * The camera was six targets for the whole film, each handed to Google's map
 * to ease towards. Two things went wrong on the lead's phone: each target
 * started and stopped on its own curve, so the pan pulsed six times, and
 * between targets Google's path was not the one the film had planned, so the
 * pen left the frame. Now the camera is a target every `CAMERA_STEP_MS`,
 * smoothed here, and the map plays them as one path (`replayMap.cameraPath`).
 * Nothing between two targets is the map's guess.
 *
 * Each target frames the road either side of the pen's position on the
 * ground, so the viewer sees where the line is heading. Smoothing averages
 * the box's centre and the logarithm of its size over `CAMERA_SMOOTH_MS`, so
 * the zoom breathes rather than pumps. Smoothing can let the pen drift towards
 * an edge, so last of all each box is widened, if it must be, until the pen
 * sits inside it with a margin, at its own instant and at both neighbours.
 *
 * Pure: no database, no Expo, no clock. Tested in `composition.test.ts`.
 */

/** A geographic box. */
export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

/** A camera target. The map moves through them in a straight line. */
export type CameraKeyframe = {
  atMs: number;
  bounds: Bounds;
};

/** A point on the pen's path and the moment the pen reaches it. */
export type TimedPoint = { atMs: number; lat: number; lon: number; alongM: number };

/** How often the camera has a target, ms. */
export const CAMERA_STEP_MS = 100;
/** How long a stretch of camera the smoothing averages over, ms. */
export const CAMERA_SMOOTH_MS = 700;
/** How far inside the box the pen must stay, as a share of the box's half size. */
export const PEN_MARGIN = 0.2;

/**
 * How much of the road the camera holds in frame, either side of the pen, as a
 * share of the film's ground length.
 *
 * ⚠ A share of **ground length**, not of vertices: a simplified straight walk
 * arrives as five vertices, and a window counted in vertices once covered the
 * whole walk at every target, so the camera never moved (2026-08-18).
 * ⚠ NOT TUNED: wide enough to see where the line goes, narrow enough not to
 * sit in a wide shot.
 */
export const CAMERA_WINDOW_FRACTION = 0.15;

/** The narrowest that window gets, metres: below it the camera follows GPS noise. */
export const MIN_CAMERA_WINDOW_M = 300;

/**
 * The smallest span a box is given, in degrees, about two kilometres. Without
 * a floor an afternoon in one café would frame twenty metres of GPS noise.
 */
export const MIN_SPAN_DEG = 0.02;

/** The camera's targets across `[startMs, startMs + durationMs]`, following `timeline`. */
export function followCamera(timeline: readonly TimedPoint[], startMs: number, durationMs: number): CameraKeyframe[] {
  const endMs = startMs + durationMs;
  const totalM = timeline[timeline.length - 1].alongM;
  const halfWindowM = Math.max(MIN_CAMERA_WINDOW_M, totalM * CAMERA_WINDOW_FRACTION);

  const times: number[] = [];
  for (let at = startMs; at < endMs; at += CAMERA_STEP_MS) times.push(at);
  times.push(endMs);

  const raw = times.map((at) => {
    const pen = penAt(timeline, at);
    const from = firstAlong(timeline, pen.alongM - halfWindowM);
    const to = firstAlong(timeline, pen.alongM + halfWindowM);
    return extend(boundsOf(timeline.slice(from, to + 1)), pen);
  });

  const smoothed = smooth(raw, Math.round(CAMERA_SMOOTH_MS / CAMERA_STEP_MS / 2));

  return times.map((at, i) => {
    let bounds = expandToMinimumSpan(smoothed[i]);
    for (const near of [times[i - 1], at, times[i + 1]]) {
      if (near !== undefined) bounds = holdInside(bounds, penAt(timeline, near));
    }
    return { atMs: at, bounds };
  });
}

/** Where the pen is at `atMs`: on a point, between two, or across a jump. */
export function penAt(timeline: readonly TimedPoint[], atMs: number): TimedPoint {
  if (atMs <= timeline[0].atMs) return timeline[0];
  const last = timeline[timeline.length - 1];
  if (atMs >= last.atMs) return last;
  let low = 0;
  let high = timeline.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (timeline[middle].atMs <= atMs) low = middle;
    else high = middle;
  }
  const a = timeline[low];
  const b = timeline[high];
  const u = b.atMs === a.atMs ? 1 : (atMs - a.atMs) / (b.atMs - a.atMs);
  return {
    atMs,
    lat: a.lat + u * (b.lat - a.lat),
    lon: a.lon + u * (b.lon - a.lon),
    alongM: a.alongM + u * (b.alongM - a.alongM),
  };
}

/** The first index at or past `metres` along, or the last. */
function firstAlong(timeline: readonly TimedPoint[], metres: number): number {
  let low = 0;
  let high = timeline.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (timeline[middle].alongM < metres) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Centres averaged, sizes averaged as logarithms, over `reach` targets either side. */
function smooth(boxes: readonly Bounds[], reach: number): Bounds[] {
  const shape = boxes.map((box) => ({
    lat: (box.north + box.south) / 2,
    lon: (box.east + box.west) / 2,
    // Never log(0): a box of one point has a size of a millimetre.
    logLat: Math.log(Math.max(1e-8, (box.north - box.south) / 2)),
    logLon: Math.log(Math.max(1e-8, (box.east - box.west) / 2)),
  }));
  return shape.map((_, i) => {
    const near = shape.slice(Math.max(0, i - reach), i + reach + 1);
    const mean = (pick: (one: (typeof shape)[number]) => number) =>
      near.reduce((sum, one) => sum + pick(one), 0) / near.length;
    const halfLat = Math.exp(mean((one) => one.logLat));
    const halfLon = Math.exp(mean((one) => one.logLon));
    const lat = mean((one) => one.lat);
    const lon = mean((one) => one.lon);
    return { north: lat + halfLat, south: lat - halfLat, east: lon + halfLon, west: lon - halfLon };
  });
}

/** `bounds`, widened where it must be so `pen` is `PEN_MARGIN` inside it. */
function holdInside(bounds: Bounds, pen: { lat: number; lon: number }): Bounds {
  const marginLat = ((bounds.north - bounds.south) / 2) * PEN_MARGIN;
  const marginLon = ((bounds.east - bounds.west) / 2) * PEN_MARGIN;
  return {
    north: Math.max(bounds.north, pen.lat + marginLat),
    south: Math.min(bounds.south, pen.lat - marginLat),
    east: Math.max(bounds.east, pen.lon + marginLon),
    west: Math.min(bounds.west, pen.lon - marginLon),
  };
}

function extend(bounds: Bounds, point: { lat: number; lon: number }): Bounds {
  return {
    north: Math.max(bounds.north, point.lat),
    south: Math.min(bounds.south, point.lat),
    east: Math.max(bounds.east, point.lon),
    west: Math.min(bounds.west, point.lon),
  };
}

/** The box containing every point. `points` must not be empty. */
export function boundsOf(points: readonly { lat: number; lon: number }[]): Bounds {
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
 * Padding rather than recomputing from the centre: recomputing loses the last
 * digit of a float and can hand back a box very slightly *inside* the points
 * it came from, which quietly clips the end of the trace.
 */
export function expandToMinimumSpan(bounds: Bounds): Bounds {
  const latPad = Math.max(0, MIN_SPAN_DEG - (bounds.north - bounds.south)) / 2;
  const lonPad = Math.max(0, MIN_SPAN_DEG - (bounds.east - bounds.west)) / 2;
  if (latPad === 0 && lonPad === 0) {
    return bounds;
  }
  return {
    north: bounds.north + latPad,
    south: bounds.south - latPad,
    east: bounds.east + lonPad,
    west: bounds.west - lonPad,
  };
}

