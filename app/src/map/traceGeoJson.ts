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
