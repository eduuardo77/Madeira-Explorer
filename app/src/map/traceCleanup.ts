/**
 * Making the drawn trace look like the walk that happened (T-059, D-066).
 *
 * THE ONE RULE THIS FILE OBEYS
 * ----------------------------
 * **Every point that survives is a position the device actually reported.**
 * Nothing here averages, snaps, interpolates or invents a coordinate. It only
 * ever *removes* — and removing is honest in a way that moving is not, because
 * a smoothed line claims the user was somewhere no instrument ever said they
 * were. D-010 keeps the raw rows regardless, so this changes the picture and
 * never the record.
 *
 * WHAT THE PICTURE LOOKS LIKE WITHOUT IT
 * --------------------------------------
 * `traceGeoJson.ts` already refuses fixes worse than 120 m and breaks the line
 * where movement was impossible (D-059). Three things get through all of that
 * and they are what the trace actually looks wrong from:
 *
 *   1. **Spikes.** One fix 150 m off the path, between two good ones, reported
 *      with a perfectly respectable accuracy. It draws as a V — out and back —
 *      and it is the artefact a user recognises instantly as false, because
 *      they know they did not run into a ravine and return.
 *      ⚠ The existing jump rule cannot catch it: it only judges jumps over
 *      250 m, and only as *breaks*, so a 150 m spike is drawn in full.
 *   2. **Standing still.** Forty minutes over a coffee is forty fixes scattered
 *      across a 30 m circle, drawn as a scribble the size of a building. The
 *      trace should say *you were here*, and a knot of line says *something
 *      went wrong here*.
 *   3. **Jitter.** A straight seafront walk arrives as a fuzzy zigzag that is
 *      measurably longer than the walk. It reads as sloppiness, and on a phone
 *      it is thousands of vertices for a line that needs hundreds.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * ⚠ **No snapping to roads or paths.** That is map matching, cut from v1 by
 * D-032, and the reason is not only cost: a trace snapped to the wrong path is
 * confidently wrong, where a wobbly trace is visibly approximate. The wobble is
 * a form of honesty.
 *
 * ⚠ **No smoothing that moves a point.** See the rule at the top.
 *
 * ⚠ **Every threshold here is a guess** and there is no field data to set it
 * from (`tools/fixtures/` is empty until T-018). `tools/preview-trace.mjs`
 * draws the before and after so they can at least be judged by eye, which is
 * how the stamp artwork was settled.
 *
 * Pure: no database, no Expo. Tested in `traceCleanup.test.ts`.
 */

import { distanceM } from '../recording/distance.ts';
import type { TraceFix } from './traceGeoJson.ts';

/**
 * How far from where it should be a fix must sit before it can be called an
 * outlier, in metres.
 *
 * ⚠ NOT TUNED. Below this, a departure is ordinary GPS wobble and removing it
 * would be tidying rather than correcting. The test also scales with the fix's
 * own reported accuracy: a fix admitting ±60 m has earned 60 m of doubt, and
 * calling that an outlier would delete the honest fixes first.
 */
export const SPIKE_MIN_OFFSET_M = 50;

/**
 * How fast the departure and return must imply, in metres per second.
 *
 * ⚠ **This is what protects a hairpin, and it is why the rule is about time
 * rather than shape.** Madeira's roads and levada paths switch back on
 * themselves constantly, and a switchback is geometrically identical to a
 * spike: out, and back to where you started. What separates them is that a real
 * switchback takes minutes to walk and a spike happens between two consecutive
 * fixes. Stepping 60 m off the path to a viewpoint over three minutes implies
 * 0.7 m/s and is kept; 150 m off and back in twenty seconds implies 15 m/s and
 * is not.
 */
export const SPIKE_MIN_IMPLIED_MPS = 2.5;

/**
 * How many fixes either side vote on where a fix *should* be.
 *
 * ⚠ **TWO EARLIER VERSIONS OF THIS RULE WERE WRONG, AND BOTH FAILURES ARE THE
 * REASON IT IS WRITTEN THIS WAY.** The obvious rule — compare each fix to the
 * one before and the one after — breaks twice over:
 *
 *   1. **Bad fixes arrive in bursts.** Two wild fixes in a row vouch for each
 *      other: the second is the first's neighbour, both sit 150 m off the path,
 *      and the line between them looks perfectly straight. Under canopy this is
 *      the common case, not the exception — a phone that loses the sky loses it
 *      for several fixes at a time.
 *   2. **A good fix beside a spike gets deleted.** Judged against a neighbour
 *      that is itself 150 m out, an honest fix sitting on the path looks like
 *      the departure. The first fix of the pass removed three points where one
 *      was wrong.
 *
 * The answer is not to look at neighbours but to take a **vote**: the median of
 * the surrounding fixes is where the path was, and a median survives a minority
 * of liars. Four either side means up to three bad fixes in a row are outvoted,
 * and a fix beside a spike is compared against seven honest ones rather than
 * one dishonest one.
 */
export const OUTLIER_WINDOW = 4;

/** Within this radius of each other, fixes are the same place. */
export const STATIONARY_RADIUS_M = 25;

/**
 * How long a cluster must last before it is drawn as one point.
 *
 * ⚠ NOT TUNED. Two minutes is longer than a pause at a junction and shorter
 * than any real stop, so a walk keeps its shape while a coffee stops being a
 * scribble.
 */
export const STATIONARY_MIN_SECONDS = 120;

/**
 * How far a vertex may sit from the line it would be removed from, in metres.
 *
 * Douglas-Peucker, in metres rather than degrees: what goes is the vertex
 * count, and with it the fuzz that made a straight walk look like a scribble.
 *
 * ⚠ **16 m was chosen by looking, and the sweep that informed it cannot see
 * what it costs.** `node tools/preview-trace.mjs --sweep` walks this number
 * from 8 m to 40 m against a modelled trace. Two things came out of it:
 *
 *   - **Accuracy barely moves.** Mean deviation from the true path stays
 *     between 5 and 8 m across the whole range, while the drawn length falls
 *     from 2.87 km to 2.23 km on a 2.23 km walk. The tolerance buys tidiness,
 *     not correctness.
 *   - **At 12 m the line still visibly zigzags** — jitter with 20 m peaks
 *     survives a 12 m tolerance by definition — and at 20 m it tracks the path
 *     cleanly.
 *
 * ⚠ **So why not 20 m?** Because the ground truth in that sweep is straight
 * lines between waypoints, which is precisely the shape that flatters a large
 * tolerance. The thing at risk is a real switchback — Madeira's paths are full
 * of them, and one 20 m across would be flattened by a 20 m tolerance without
 * any of these numbers noticing. 16 m is the compromise: most of the tidying,
 * under the width of the corners that matter.
 *
 * ⚠ NOT TUNED against real GPS. `tools/fixtures/` is empty until T-018, and
 * this is the first number to revisit when it is not.
 */
export const SIMPLIFY_TOLERANCE_M = 16;

export type CleanupStats = {
  /** Fixes in, after `traceGeoJson`'s own accuracy filter. */
  pointsIn: number;
  pointsOut: number;
  spikesRemoved: number;
  stationaryCollapsed: number;
  simplifiedAway: number;
  /** Drawn path length before and after, in metres. */
  lengthInM: number;
  lengthOutM: number;
};

const EMPTY_STATS: CleanupStats = {
  pointsIn: 0,
  pointsOut: 0,
  spikesRemoved: 0,
  stationaryCollapsed: 0,
  simplifiedAway: 0,
  lengthInM: 0,
  lengthOutM: 0,
};

/** Total length of a run of fixes, in metres. */
export function pathLengthM(fixes: readonly TraceFix[]): number {
  let metres = 0;
  for (let i = 1; i < fixes.length; i += 1) {
    metres += distanceM(fixes[i - 1], fixes[i]);
  }
  return metres;
}

/**
 * Drop fixes that are nowhere near where the surrounding fixes say the path
 * was, and could not have been reached and left in the time available.
 *
 * Runs before the trace is broken into strokes: an outlier straddling a break
 * has fewer neighbours to be judged against, and would survive.
 */
export function rejectSpikes(fixes: readonly TraceFix[]): {
  kept: TraceFix[];
  removed: number;
} {
  if (fixes.length < 3) {
    return { kept: [...fixes], removed: 0 };
  }

  const kept: TraceFix[] = [];
  let removed = 0;

  for (let i = 0; i < fixes.length; i += 1) {
    // The ends have no vote either side of them and are never dropped: the
    // trace has to start and finish where the user did.
    if (i === 0 || i === fixes.length - 1 || !isOutlier(fixes, i)) {
      kept.push(fixes[i]);
      continue;
    }
    removed += 1;
  }

  return { kept, removed };
}

/** Where the fixes around `index` say the path was. */
function localMedian(
  fixes: readonly TraceFix[],
  index: number
): { lat: number; lon: number } {
  const from = Math.max(0, index - OUTLIER_WINDOW);
  const to = Math.min(fixes.length - 1, index + OUTLIER_WINDOW);

  const lats: number[] = [];
  const lons: number[] = [];
  for (let i = from; i <= to; i += 1) {
    if (i === index) {
      continue;
    }
    lats.push(fixes[i].lat);
    lons.push(fixes[i].lon);
  }

  return { lat: median(lats), lon: median(lons) };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * Is this fix somewhere nobody could have been?
 *
 * Two conditions, and both are needed. **Far from where the surrounding fixes
 * say the path was** — which a spike is and a hairpin's apex is not, because a
 * hairpin drags its whole neighbourhood with it. And **too fast to have gone
 * there and come back**, measured over the gap between the fixes either side,
 * which is what keeps a genuine detour that took minutes.
 */
function isOutlier(fixes: readonly TraceFix[], index: number): boolean {
  const fix = fixes[index];
  const away = distanceM(fix, localMedian(fixes, index));

  const allowance = Math.max(SPIKE_MIN_OFFSET_M, 2 * (fix.accuracy_m ?? 0));
  if (away < allowance) {
    return false;
  }

  const seconds = (fixes[index + 1].ts - fixes[index - 1].ts) / 1000;
  if (seconds <= 0) {
    // Two fixes at the same instant, far apart, cannot both be true — and the
    // existing jump rule in `traceGeoJson` is what breaks the line there.
    return true;
  }

  // Out to the fix and back again, over the time that was available.
  return (2 * away) / seconds > SPIKE_MIN_IMPLIED_MPS;
}

/**
 * Replace each cluster of standing-still fixes with one of its own members.
 *
 * ⚠ **One of its members, not their average.** The mean of a scattered cluster
 * is a coordinate no instrument ever reported, and this file does not invent
 * positions. The fix with the best reported accuracy is the device's own best
 * answer to *where were you*, so that is the one kept.
 */
export function collapseStationary(fixes: readonly TraceFix[]): {
  kept: TraceFix[];
  collapsed: number;
} {
  const kept: TraceFix[] = [];
  let collapsed = 0;
  let index = 0;

  while (index < fixes.length) {
    const anchor = fixes[index];
    let end = index;
    while (
      end + 1 < fixes.length &&
      distanceM(anchor, fixes[end + 1]) <= STATIONARY_RADIUS_M
    ) {
      end += 1;
    }

    const runLength = end - index + 1;
    const seconds = (fixes[end].ts - anchor.ts) / 1000;

    if (runLength >= 3 && seconds >= STATIONARY_MIN_SECONDS) {
      const best = fixes
        .slice(index, end + 1)
        .reduce((a, b) =>
          (b.accuracy_m ?? Infinity) < (a.accuracy_m ?? Infinity) ? b : a
        );
      kept.push(best);
      collapsed += runLength - 1;
    } else {
      for (let i = index; i <= end; i += 1) {
        kept.push(fixes[i]);
      }
    }
    index = end + 1;
  }

  return { kept, collapsed };
}

/** Perpendicular distance from a fix to the segment a–b, in metres. */
function metresToSegment(fix: TraceFix, a: TraceFix, b: TraceFix): number {
  // Local flat projection: these distances are metres, not kilometres.
  const scaleX = 111_320 * Math.cos((a.lat * Math.PI) / 180);
  const scaleY = 110_540;
  const px = (fix.lon - a.lon) * scaleX;
  const py = (fix.lat - a.lat) * scaleY;
  const bx = (b.lon - a.lon) * scaleX;
  const by = (b.lat - a.lat) * scaleY;

  const lengthSquared = bx * bx + by * by;
  if (lengthSquared === 0) {
    return Math.hypot(px, py);
  }
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared));
  return Math.hypot(px - t * bx, py - t * by);
}

/**
 * Douglas-Peucker, in metres, keeping only original fixes.
 *
 * Iterative rather than recursive: a day's driving is thousands of points and
 * the recursive form is a stack overflow waiting for a long trip.
 */
export function simplify(
  fixes: readonly TraceFix[],
  toleranceM: number = SIMPLIFY_TOLERANCE_M
): TraceFix[] {
  if (fixes.length < 3) {
    return [...fixes];
  }

  const keep = new Array(fixes.length).fill(false);
  keep[0] = true;
  keep[fixes.length - 1] = true;

  const stack: [number, number][] = [[0, fixes.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let worst = 0;
    let index = -1;

    for (let i = first + 1; i < last; i += 1) {
      const metres = metresToSegment(fixes[i], fixes[first], fixes[last]);
      if (metres > worst) {
        worst = metres;
        index = i;
      }
    }

    if (index !== -1 && worst > toleranceM) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }

  return fixes.filter((_, i) => keep[i]);
}

/**
 * The whole cleanup, in the order the steps have to run.
 *
 * **Spikes first**, because a spike inflates the apparent movement and would
 * otherwise stop a stationary cluster from looking stationary. **Stationary
 * next**, because collapsing a hundred fixes to one leaves far less for the
 * simplifier to consider. **Simplify last**, on what is left.
 */
export function cleanTrace(
  fixes: readonly TraceFix[],
  toleranceM: number = SIMPLIFY_TOLERANCE_M
): {
  fixes: TraceFix[];
  stats: CleanupStats;
} {
  if (fixes.length === 0) {
    return { fixes: [], stats: EMPTY_STATS };
  }

  const lengthInM = pathLengthM(fixes);
  const despiked = rejectSpikes(fixes);
  const settled = collapseStationary(despiked.kept);
  const simplified = simplify(settled.kept, toleranceM);

  return {
    fixes: simplified,
    stats: {
      pointsIn: fixes.length,
      pointsOut: simplified.length,
      spikesRemoved: despiked.removed,
      stationaryCollapsed: settled.collapsed,
      simplifiedAway: settled.kept.length - simplified.length,
      lengthInM: Math.round(lengthInM),
      lengthOutM: Math.round(pathLengthM(simplified)),
    },
  };
}
