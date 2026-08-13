/**
 * The recorded trace, as something a map can draw (T-059, D-032).
 *
 * v1 draws the raw GPS trace — no matching, no snapping, no road graph. This
 * module turns rows from `raw_fix` into GeoJSON line features, and the two
 * rules it applies are both about honesty rather than beauty:
 *
 *   1. **A silence becomes a break in the line, not a straight bridge.**
 *      Drawing one line across a 40-minute blackout would invent a route the
 *      user may not have taken — exactly the fabricated continuity
 *      ARCHITECTURE §10 forbids. The threshold is the caller's, so it stays
 *      consistent with the recorder's own gap rule.
 *
 *   2. **Wildly inaccurate fixes are left out of the drawing.** Under canopy
 *      a fix can land hundreds of metres off; drawn, it becomes a spike the
 *      user knows is false. Skipping it changes only the picture — the stored
 *      row is untouched (D-010), and v2's matching will read the full data.
 *
 * Pure: no database, no Expo. `raw_fix` rows in, GeoJSON out. Tested in
 * `traceGeoJson.test.ts`.
 */

/** What this module needs of a fix — a subset of the `raw_fix` row. */
export type TraceFix = {
  ts: number;
  lat: number;
  lon: number;
  accuracy_m: number | null;
};

/**
 * Fixes with a reported accuracy worse than this are not drawn.
 *
 * ⚠ NOT TUNED. 120 m is loose enough to keep canopy-degraded levada fixes —
 * the walk must still appear (D-009) — while dropping the few-hundred-metre
 * outliers that draw as obvious spikes. Fixes with no reported accuracy are
 * drawn: refusing them would blank the trace on any platform that omits the
 * field.
 */
export const MAX_DRAWN_ACCURACY_M = 120;

export type TraceFeature = {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: {
    type: 'LineString';
    /** [lon, lat] pairs — GeoJSON's order, the reverse of ours. */
    coordinates: [number, number][];
  };
};

export type TraceCollection = {
  type: 'FeatureCollection';
  features: TraceFeature[];
};

/**
 * One unbroken stroke: fixes in time order, with no silence inside it longer
 * than the caller's threshold. Always at least two fixes — one point is not a
 * line.
 */
export type TraceSegment = {
  fixes: TraceFix[];
};

/**
 * Split a trace into the strokes it can honestly be drawn as.
 *
 * This is where both rules in the file header live, and it is separate from
 * `buildTrace` because the souvenir composition (T-105a) needs the same
 * segmentation *with timestamps attached* — GeoJSON drops them. Two callers
 * deciding independently where a line breaks is two chances to invent a route
 * across a blackout, so they share one function.
 */
export function splitIntoSegments(
  fixes: TraceFix[],
  gapThresholdMs: number
): TraceSegment[] {
  const drawable = fixes
    .filter(
      (fix) =>
        Number.isFinite(fix.lat) &&
        Number.isFinite(fix.lon) &&
        (fix.accuracy_m === null || fix.accuracy_m <= MAX_DRAWN_ACCURACY_M)
    )
    .sort((a, b) => a.ts - b.ts);

  const segments: TraceSegment[] = [];
  let current: TraceFix[] = [];
  let previousTs: number | null = null;

  const flush = () => {
    // The dropped point is not lost — it is still in the database — it just
    // cannot be drawn as a stroke.
    if (current.length >= 2) {
      segments.push({ fixes: current });
    }
    current = [];
  };

  for (const fix of drawable) {
    if (previousTs !== null && fix.ts - previousTs > gapThresholdMs) {
      flush();
    }
    current.push(fix);
    previousTs = fix.ts;
  }
  flush();

  return segments;
}

/**
 * Build the trace. `fixes` in any order; `gapThresholdMs` decides where the
 * line honestly breaks.
 */
export function buildTrace(
  fixes: TraceFix[],
  gapThresholdMs: number
): TraceCollection {
  return {
    type: 'FeatureCollection',
    features: splitIntoSegments(fixes, gapThresholdMs).map((segment) => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: segment.fixes.map(
          (fix): [number, number] => [fix.lon, fix.lat]
        ),
      },
    })),
  };
}

/**
 * A rectangle, in the order MapLibre's `fitBounds` wants it.
 */
export type TraceBounds = [west: number, south: number, east: number, north: number];

/**
 * The smallest span the camera will frame, in degrees.
 *
 * ⚠ Without a floor this zooms to the maximum on day one: a trace recorded
 * over a coffee is fifty fixes in a 30 m circle, and framing *that* puts the
 * user at rooftop level with no idea where they are. 0.02° is roughly 2.2 km
 * north-south — a neighbourhood, which is the smallest thing worth calling a
 * view. Longitude gets the same number, which is generous rather than exact at
 * this latitude, and generous is the right direction for a floor.
 */
export const MIN_FRAME_SPAN_DEG = 0.02;

/**
 * The box around everything drawn, or null when nothing is.
 *
 * WHY THE CAMERA PREFERS THIS TO THE ISLAND
 * -----------------------------------------
 * Fitting the whole island on a tall phone puts a wide, thin object across the
 * middle of the frame and fills the rest with flat blue — most of the screen is
 * then sea the user will never go to. This app is a souvenir of where somebody
 * went (D-032), so the answer to *what should the camera look at* is **what
 * they did**, and the island only when they have not done anything yet.
 */
export function traceBounds(trace: TraceCollection): TraceBounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const feature of trace.features) {
    for (const [lon, lat] of feature.geometry.coordinates) {
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }

  if (!Number.isFinite(west) || !Number.isFinite(south)) {
    return null;
  }

  const [left, right] = expand(west, east, MIN_FRAME_SPAN_DEG);
  const [bottom, top] = expand(south, north, MIN_FRAME_SPAN_DEG);

  return [left, bottom, right, top];
}

/** Widen a span to the floor, keeping its centre. */
function expand(low: number, high: number, minimum: number): [number, number] {
  const span = high - low;
  if (span >= minimum) {
    return [low, high];
  }
  const grow = (minimum - span) / 2;
  return [low - grow, high + grow];
}
