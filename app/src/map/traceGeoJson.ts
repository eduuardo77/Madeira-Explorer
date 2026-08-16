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
 *   4. **What is left is cleaned before it is drawn** (2026-08-16, D-066).
 *      Spikes the accuracy filter cannot see, scribble where somebody stood
 *      still, and vertices too close together to be worth drawing all go —
 *      `traceCleanup.ts` has the rules and the one they all obey: **every point
 *      that survives is a position the device actually reported.** Nothing is
 *      averaged, snapped or invented.
 *
 *   3. **A jump nobody could have made becomes a break too** (2026-08-14).
 *      Rule 1 only ever asked *how long was the silence*, so two fixes a second
 *      apart and 500 km apart were drawn as one confident straight line. That
 *      is the same fabricated continuity as bridging a blackout, arriving
 *      through the other door, and it is what the project lead was looking at
 *      when they said the highlighted line was wrong: the diary's own database
 *      held the seafront walk, a dozen island-wide geofence test positions and
 *      one fix in Lisbon, and the map joined all of them up.
 *
 *      It is not only a test artefact. Android's fused provider emits the
 *      occasional wild fix with a *good* reported accuracy — which is exactly
 *      the case rule 2 cannot catch — and a user who flies home mid-trip
 *      produces a real one.
 *
 * Pure: no database, no Expo. `raw_fix` rows in, GeoJSON out. Tested in
 * `traceGeoJson.test.ts`.
 */

// Explicit `.ts`: this module is under unit test and Node's resolver will
// not guess the extension (CLAUDE.md). Metro does not mind.
import { distanceM } from '../recording/distance.ts';
import { cleanTrace } from './traceCleanup.ts';

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

/**
 * Worse than this and a fix is not evidence of being anywhere, at any price.
 *
 * ⚠ **The 120 m above is a preference; this is the veto.** They are different
 * numbers because "poor" and "useless" are different questions, and conflating
 * them is what made a canopy stretch disappear: see `drawableFixes`.
 */
export const NEVER_DRAWN_ACCURACY_M = 500;

/**
 * How long a stretch of trace has to keep at least one point, whatever its
 * quality.
 *
 * Two minutes: short enough that a poor fix is never preferred to a good one
 * nearby, long enough that a walk under canopy keeps a shape.
 */
export const ACCURACY_RESCUE_WINDOW_MS = 2 * 60 * 1000;

/**
 * ⚠ **A LONG, SPARSE BRIDGE IS DRAWN STRAIGHT, AND THAT IS A DECISION RATHER
 * THAN AN OVERSIGHT — 2026-08-16.**
 *
 * A rule was written here that broke the line when a silence *under* the gap
 * threshold covered more than a kilometre: twenty quiet minutes between Funchal
 * and Santana are drawn as a straight stroke over mountains the user did not
 * cross, which reads as the same fabricated continuity the other rules exist to
 * prevent.
 *
 * **It was removed, because two tests already state the opposite on purpose**:
 * *"a drive between two levadas is still one line"* (12 km of VR1 in ten
 * minutes) and the bounds test's *"at 20 minutes it is a drive, which is a
 * stroke this app is glad to draw"*. Both ends of such a bridge are observed;
 * only its shape is unknown. Deleting it deletes real movement, and D-032's
 * whole position is that the trace is the raw record.
 *
 * **The tension is real and belongs to the project lead**: the alternative is
 * to draw such bridges *dashed* — honest about the shape without deleting the
 * journey — which is a design change, not a threshold.
 */

/**
 * The fastest travel the line will be drawn through, in metres per second.
 *
 * 55 m/s is about 200 km/h. Madeira's fastest road is the VR1 at 100 km/h, so
 * this is double anything achievable on the island and the line survives a
 * sparse motorway drive where two fixes are minutes apart. A plane is roughly
 * 250 m/s and does not survive it, which is the point: flying home is a real
 * discontinuity and drawing a stroke across the Atlantic claims the user
 * boated it.
 *
 * ⚠ **Deliberately far above walking speed, not near it.** The temptation is to
 * set this to something like 5 m/s and smooth the trace into a tidy line. That
 * would delete the drive between two levadas — real movement the user made —
 * and D-032 says the trace is the souvenir. This gate exists to remove strokes
 * that are *impossible*, never strokes that are merely fast.
 *
 * ⚠ NOT TUNED against field data, like `MAX_DRAWN_ACCURACY_M` above it. The
 * number is an argument from the island's speed limits, not a measurement.
 */
export const MAX_DRAWN_SPEED_MPS = 55;

/**
 * The shortest jump this rule will judge, in metres.
 *
 * Two fixes 40 ms apart — which a burst delivery produces — turn 3 m of GPS
 * jitter into 75 m/s and would break the line in the middle of a walk. Below
 * this distance nothing is impossible enough to be worth breaking for; above
 * it, the speed is what decides.
 */
const MIN_JUMP_FOR_SPEED_CHECK_M = 250;

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
  const drawable = drawableFixes(fixes);

  const segments: TraceSegment[] = [];
  let current: TraceFix[] = [];
  let previous: TraceFix | null = null;

  const flush = () => {
    // The dropped point is not lost — it is still in the database — it just
    // cannot be drawn as a stroke.
    if (current.length >= 2) {
      segments.push({ fixes: current });
    }
    current = [];
  };

  for (const fix of drawable) {
    if (previous !== null && breaksHere(previous, fix, gapThresholdMs)) {
      flush();
    }
    current.push(fix);
    previous = fix;
  }
  flush();

  return segments;
}

/**
 * Which fixes are worth drawing, in time order.
 *
 * ⚠ **A poor fix is dropped only when a better one covers the same minutes.**
 * The rule used to be a flat cut at `MAX_DRAWN_ACCURACY_M`, and it has a
 * failure mode this project cares about more than tidiness: under laurel canopy
 * *every* fix can be worse than 120 m, so the flat rule drew **nothing at all**
 * for the stretch — and a levada walk that appears as a gap is the exact
 * outcome D-009's generosity rule exists to prevent. The walk must still appear.
 *
 * So the cut becomes a preference, applied within a window: if any fix in those
 * two minutes is good, the poor ones go; if none is, the best available one
 * stays. Past `NEVER_DRAWN_ACCURACY_M` nothing is drawn, because a fix that
 * vague is not evidence of a position.
 */
export function drawableFixes(fixes: TraceFix[]): TraceFix[] {
  const ordered = fixes
    .filter(
      (fix) =>
        Number.isFinite(fix.lat) &&
        Number.isFinite(fix.lon) &&
        (fix.accuracy_m === null || fix.accuracy_m <= NEVER_DRAWN_ACCURACY_M)
    )
    .sort((a, b) => a.ts - b.ts);

  const kept: TraceFix[] = [];
  let index = 0;

  while (index < ordered.length) {
    // Everything reported within one window of the first fix in it.
    const from = ordered[index].ts;
    let end = index;
    while (end + 1 < ordered.length && ordered[end + 1].ts - from < ACCURACY_RESCUE_WINDOW_MS) {
      end += 1;
    }

    const window = ordered.slice(index, end + 1);
    const good = window.filter(
      (fix) => fix.accuracy_m === null || fix.accuracy_m <= MAX_DRAWN_ACCURACY_M
    );

    if (good.length > 0) {
      kept.push(...good);
    } else {
      // Nothing good happened here. Keep the least bad, so the stretch exists.
      kept.push(
        window.reduce((a, b) => ((b.accuracy_m ?? 0) < (a.accuracy_m ?? 0) ? b : a))
      );
    }
    index = end + 1;
  }

  return kept;
}

/**
 * Should the line break between these two fixes?
 *
 * The two rules are one question — *can this stroke be drawn honestly* — so
 * they are answered in one place rather than as two conditions in the loop.
 */
function breaksHere(
  previous: TraceFix,
  fix: TraceFix,
  gapThresholdMs: number
): boolean {
  const elapsedMs = fix.ts - previous.ts;

  // Rule 1: the recorder was silent for longer than it admits to.
  if (elapsedMs > gapThresholdMs) {
    return true;
  }

  // Rule 3: the movement is impossible.
  const jumpM = distanceM(
    { lat: previous.lat, lon: previous.lon },
    { lat: fix.lat, lon: fix.lon }
  );
  if (jumpM < MIN_JUMP_FOR_SPEED_CHECK_M) {
    return false;
  }

  // ⚠ Two fixes at the same instant that are far apart cannot be reconciled —
  // the speed is infinite, and dividing by zero would quietly say `Infinity >
  // limit` and get the right answer for the wrong reason. Say it outright.
  if (elapsedMs <= 0) {
    return true;
  }

  return jumpM / (elapsedMs / 1000) > MAX_DRAWN_SPEED_MPS;
}

/**
 * The strokes, cleaned for drawing (D-066).
 *
 * ⚠ **Why this is separate from `splitIntoSegments` rather than folded into
 * it.** Two callers want different things from the same trace. The **map** wants
 * the tidied line — no spikes, no scribble where somebody stood still, no
 * vertices too close together to see. The **souvenir composition** (T-105a)
 * wants every timestamp, because it paces the animation by them and a stamp cue
 * lands where the drawn line reaches that place; folding cleanup into the shared
 * function coarsened that timing until a cue landed at the very start of the
 * draw. Its tests caught it.
 *
 * ⚠ **And cleaning happens per stroke, after the breaks are cut — which was a
 * bug before it was a decision.** Cleaning the whole trace first let a fix's
 * "neighbourhood" span a 45-minute silence: the fixes voting on where it should
 * be were 15 km away on the other side of the gap, so the last fix before
 * dinner was deleted as an outlier from a place it had nothing to do with. A
 * neighbourhood cannot cross a discontinuity, and a stroke is exactly that.
 */
export function drawableSegments(
  fixes: TraceFix[],
  gapThresholdMs: number
): TraceSegment[] {
  return splitIntoSegments(fixes, gapThresholdMs)
    .map((segment) => ({ fixes: cleanTrace(segment.fixes).fixes }))
    .filter((segment) => segment.fixes.length >= 2);
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
    features: drawableSegments(fixes, gapThresholdMs).map((segment) => ({
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
