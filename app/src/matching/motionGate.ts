/**
 * Which fixes were taken while the phone was actually moving (D-093).
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * Measured on the P30 (`docs/field-notes.md`, 2026-09-26 and 2026-09-27): a
 * phone lying on a desk reports positions that drift **smoothly** 20 to 110 m
 * away over several minutes and come back, at a reported accuracy of about
 * ±5 m. By position that is exactly what walking slowly looks like, which is
 * why no rule over positions could remove it, and it is where most of the
 * *"lines in random places"* came from.
 *
 * WHAT SEPARATES THEM
 * -------------------
 * **The speed the phone reports is not derived from those positions.** A GNSS
 * receiver measures velocity from the Doppler shift of the satellite signals,
 * which multipath (the cause of the drift) barely touches. On the desk, while
 * the position wandered 20 to 40 m out, the reported speed had a median of
 * 0.14 m/s; the positions implied up to 6 m/s. Walking reports well over
 * 1 m/s.
 *
 * It is not perfect: a few drift fixes reported 1 to 9 m/s, one at a time. So a
 * fix is judged by the **median** reported speed of the fixes around it in
 * time, which a lone wild value cannot move.
 *
 * WHEN THERE IS NO SPEED
 * ----------------------
 * Some fixes carry none (another platform, a network-only fix; Android writes
 * those as exactly 0, see below). Where a window
 * has too few speeds to vote, the fix is judged by how far the phone got in
 * that window instead. That is weaker, since it is the positions judging
 * themselves, and it is the fallback, not the rule.
 *
 * ⚠ **Every threshold here is set from one phone on one desk and has not seen
 * a real walk** (the lead's outing, T-245, tunes them). Pure. Tested in
 * `motionGate.test.ts`.
 */

import { distanceM } from '../recording/distance.ts';

/** What the gate needs of a fix. */
export type GateFix = {
  ts: number;
  lat: number;
  lon: number;
  speed_mps?: number | null;
};

/**
 * Median reported speed at or above which the phone is moving, m/s.
 *
 * ⚠ NOT TUNED. Between the desk's drift (median 0.14 m/s, 90th percentile
 * 0.37 at 20 to 40 m out) and a slow walk (about 1 m/s, less on steep levada
 * steps). 0.5 sits nearer the drift on purpose: a missed slow stretch is
 * bridged by the route either side of it, and a drift let through lights a
 * street the user never walked.
 */
export const MOVING_MIN_MPS = 0.5;

/** Fixes within this many seconds either side vote on each fix. */
export const MOTION_WINDOW_S = 30;

/** Fewer reported speeds than this in a window, and displacement decides. */
export const MIN_SPEED_VOTES = 3;

/**
 * Without speeds: the phone is moving if the window's first and last fixes
 * are at least this far apart for the time between them, m/s.
 *
 * ⚠ NOT TUNED, and weaker than the speed vote by nature: desk drift reached
 * 20 m in a minute (0.33 m/s), so this sits above it.
 */
export const DISPLACEMENT_MIN_MPS = 0.6;

/**
 * For each fix, whether the phone was moving when it was taken.
 *
 * `fixes` must be in time order.
 */
export function movingMask(fixes: readonly GateFix[]): boolean[] {
  const mask = new Array<boolean>(fixes.length).fill(false);
  const windowMs = MOTION_WINDOW_S * 1000;
  let low = 0;
  let high = 0;

  for (let i = 0; i < fixes.length; i += 1) {
    const ts = fixes[i].ts;
    while (fixes[low].ts < ts - windowMs) {
      low += 1;
    }
    while (high + 1 < fixes.length && fixes[high + 1].ts <= ts + windowMs) {
      high += 1;
    }

    const speeds: number[] = [];
    for (let j = low; j <= high; j += 1) {
      const speed = fixes[j].speed_mps;
      // ⚠ **Exactly zero is "no speed", not "still"** (measured on the P30,
      // 2026-09-27). Android reports 0 when a fix has no speed at all: all 243
      // such fixes had bearing 0 and came from the network, at ±12 m or worse
      // (±43 m on average). A GNSS fix on a desk reports a small non-zero
      // speed, 0.04 m/s typically. Counted as votes, those zeros would call a
      // walk recorded on wifi fixes standing still.
      if (speed !== null && speed !== undefined && Number.isFinite(speed) && speed > 0) {
        speeds.push(speed);
      }
    }

    if (speeds.length >= MIN_SPEED_VOTES) {
      mask[i] = median(speeds) >= MOVING_MIN_MPS;
      continue;
    }

    const seconds = (fixes[high].ts - fixes[low].ts) / 1000;
    if (seconds <= 0) {
      mask[i] = false;
      continue;
    }
    const metres = distanceM(fixes[low], fixes[high]);
    mask[i] = metres / seconds >= DISPLACEMENT_MIN_MPS;
  }

  return mask;
}

/**
 * For each fix, the fastest speed the phone reported within
 * `MOTION_WINDOW_S` of it, or null where it reported none.
 *
 * The matcher uses it to bound how far a route between two fixes may go
 * (`mapMatch.ts`): a wild fix 150 m off a walk would otherwise be reached by a
 * detour out along a side street and back, which fits the distances perfectly
 * and is impossible at the 1.4 m/s the phone said it was doing. The maximum
 * rather than the median, because a bound must not be tighter than the truth:
 * a car pulling away from a light was slow at one fix and fast by the next.
 *
 * `fixes` must be in time order.
 */
export function speedCeiling(fixes: readonly GateFix[]): (number | null)[] {
  const out = new Array<number | null>(fixes.length).fill(null);
  const windowMs = MOTION_WINDOW_S * 1000;
  let low = 0;
  let high = 0;
  for (let i = 0; i < fixes.length; i += 1) {
    const ts = fixes[i].ts;
    while (fixes[low].ts < ts - windowMs) {
      low += 1;
    }
    while (high + 1 < fixes.length && fixes[high + 1].ts <= ts + windowMs) {
      high += 1;
    }
    let fastest: number | null = null;
    for (let j = low; j <= high; j += 1) {
      const speed = fixes[j].speed_mps;
      if (speed !== null && speed !== undefined && Number.isFinite(speed) && speed > 0) {
        fastest = fastest === null ? speed : Math.max(fastest, speed);
      }
    }
    out[i] = fastest;
  }
  return out;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
