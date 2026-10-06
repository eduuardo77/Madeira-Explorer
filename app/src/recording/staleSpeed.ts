/**
 * Speeds the phone copied from an earlier fix rather than measured.
 *
 * Measured on the P30 (`docs/field-notes.md`, 2026-10-06): after a motorbike
 * ride, with the phone lying still at home, **every fix for half an hour
 * carried exactly 8.589351654052734 m/s and bearing 269**, a riding speed,
 * while the positions moved by a few metres. The map's motion gate trusts the
 * reported speed (D-093) and drew a road where nobody moved, and the stamp
 * rules would have refused any place visited that way as a drive-by.
 *
 * It is not only straight after a ride. The same history has 1.2663035392 m/s,
 * bearing exactly 142.0 at ±100 m, turning up 21 times at home on 4 October
 * with real readings in between; and on 22 August a motorway speed
 * (31.748403549 m/s) came back six hours later on a fix taken at a standstill.
 * The fused provider attaches an old velocity to a new position.
 *
 * So the rule is: **a non-zero speed exactly equal to one an earlier fix
 * reported, at a different timestamp, is a copy.** The first appearance stays,
 * because that one was measured. Two Doppler measurements agreeing to the last
 * bit by chance is rare enough at moving speeds to ignore; at desk speeds it
 * happens a few times in 20,000 fixes, and losing one desk vote changes nothing.
 *
 * A fix at the *same* timestamp is one fix stored twice, which the P30's
 * history has; it is not a copy. Zero is left alone: Android writes exactly 0
 * for "no speed", and the callers already treat it as such.
 *
 * Read-time, not write-time, on purpose: the raw table keeps what the phone
 * said, and the trips already recorded are covered too. Pure. Tested in
 * `staleSpeed.test.ts`.
 */

export type SpeedFix = { ts: number; speed_mps?: number | null };

/**
 * For each fix, whether its speed is a copy of an earlier one. `fixes` in time
 * order. `seenBefore` holds speeds reported before the first of `fixes`, for a
 * caller that reads only a window of the trip.
 */
export function staleSpeedMask(
  fixes: readonly SpeedFix[],
  seenBefore: ReadonlySet<number> = new Set()
): boolean[] {
  const firstSeenTs = new Map<number, number>();
  return fixes.map((fix) => {
    const speed = fix.speed_mps;
    if (!isReported(speed)) {
      return false;
    }
    if (seenBefore.has(speed)) {
      return true;
    }
    const firstTs = firstSeenTs.get(speed);
    if (firstTs === undefined) {
      firstSeenTs.set(speed, fix.ts);
      return false;
    }
    return firstTs !== fix.ts;
  });
}

/**
 * The mean reported speed of `fixes`, leaving out copies. `seenBefore` as for
 * `staleSpeedMask`.
 *
 * Zero still counts as a speed here, as it did in the SQL average this
 * replaces (`rawFixDao.getSpeedBetween`); only the copies are new.
 */
export function meanFreshSpeed(
  fixes: readonly SpeedFix[],
  seenBefore: ReadonlySet<number> = new Set()
): { meanSpeedMps: number | null; fixCount: number } {
  const stale = staleSpeedMask(fixes, seenBefore);
  let sum = 0;
  let count = 0;
  fixes.forEach((fix, i) => {
    const speed = fix.speed_mps;
    if (stale[i] || speed === null || speed === undefined || !Number.isFinite(speed)) {
      return;
    }
    sum += speed;
    count += 1;
  });
  return { meanSpeedMps: count > 0 ? sum / count : null, fixCount: count };
}

function isReported(speed: number | null | undefined): speed is number {
  return speed !== null && speed !== undefined && Number.isFinite(speed) && speed > 0;
}
