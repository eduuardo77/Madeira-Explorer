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
 * AND THE MOTION SENSORS, WHEN THEY ARE ALLOWED (D-094)
 * ----------------------------------------------------
 * Android's activity label (`recording/activityTimeline.ts`) is a second,
 * independent witness: it knows *still* without GPS. It vetoes a slow median
 * speed, and decides alone when a fix has no speed at all, which is common on
 * automatic recording's balanced accuracy. It never overrules a speed the
 * receiver clearly measures, because the label lags.
 *
 * AND A SPEED THE PHONE ONLY REPEATED (2026-10-06)
 * -------------------------------------------------
 * After a ride the P30 copied its last speed onto every fix for half an hour
 * while it lay still (`recording/staleSpeed.ts`). Copies do not vote. And a
 * window that has them skips the motion label too, straight to the positions:
 * the label lagged the same way that afternoon (*driving* for 13 minutes after
 * the ride), and a provider stuck on old values is no witness either way.
 * *Still* keeps its veto, which only ever removes lines.
 *
 * ⚠ **Every threshold here is set from one phone on one desk and has not seen
 * a real walk** (the lead's outing, T-245, tunes them). Pure. Tested in
 * `motionGate.test.ts`.
 */

import { distanceM } from '../recording/distance.ts';
import type { Activity } from '../recording/activityTimeline.ts';
import { staleSpeedMask } from '../recording/staleSpeed.ts';

/** What the gate needs of a fix. */
export type GateFix = {
  ts: number;
  lat: number;
  lon: number;
  speed_mps?: number | null;
  /**
   * What the phone's motion sensors said the user was doing (D-094), when the
   * permission was given. `unknown` or absent otherwise.
   */
  activity?: Activity | null;
};

/**
 * With the motion sensors saying *still*, the receiver's median speed must
 * reach this for the fix to count as moving anyway, m/s.
 *
 * ⚠ NOT TUNED, and the case it exists for is untested: on 9 Oct 2026 *driving*
 * arrived at 11:00:29 UTC, ten seconds before the wheels turned, so no lagging
 * label had to be overridden. Android's label lags a change by up to a minute or so: a car
 * pulling away from a light is still labelled *still* for a while, and the
 * receiver's Doppler speed is the faster witness there. 2 m/s is above
 * anything the desk's drift produced as a median and below any car in motion.
 */
export const STILL_OVERRIDE_MPS = 2;

const MOVING_ACTIVITIES = new Set<Activity>(['walking', 'running', 'cycling', 'driving']);

/**
 * Median reported speed at or above which the phone is moving, m/s.
 *
 * ⚠ NOT TUNED, but checked: overnight 7 to 8 Oct 2026 the P30 lay still and
 * 2 of 4,816 fixes counted as moving, and no road was lit; on both rides nothing
 * was lit off the route. A slow levada walk, the other edge, is untested. Between the desk's drift (median 0.14 m/s, 90th percentile
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
 * ⚠ NOT TUNED, and seldom used: every one of the P30's 22,882 fixes on its
 * trip of Sept to Oct 2026 carries a speed, so the speed vote decides. Weaker than the speed vote by nature: desk drift reached
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
  const stale = staleSpeedMask(fixes);
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
    let copies = 0;
    for (let j = low; j <= high; j += 1) {
      if (stale[j]) {
        copies += 1;
        continue;
      }
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

    const activity = fixes[i].activity ?? 'unknown';

    if (speeds.length >= MIN_SPEED_VOTES) {
      const typical = median(speeds);
      // D-094: the motion sensors are a second witness. *Still* vetoes a slow
      // median, which is where drift lives; it cannot veto a car the receiver
      // clearly measures moving.
      mask[i] =
        activity === 'still' ? typical >= STILL_OVERRIDE_MPS : typical >= MOVING_MIN_MPS;
      continue;
    }

    // No speeds to vote. The motion sensors decide when they have an answer;
    // only without one do the positions judge themselves.
    if (activity === 'still') {
      mask[i] = false;
      continue;
    }
    if (MOVING_ACTIVITIES.has(activity) && copies === 0) {
      mask[i] = true;
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
  // A copied speed is no evidence of how fast the phone went (staleSpeed.ts).
  const stale = staleSpeedMask(fixes);
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
      if (stale[j]) {
        continue;
      }
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
