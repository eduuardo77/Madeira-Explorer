/**
 * Finding where the user sleeps, so it can be hidden (T-103, T-104, D-016).
 *
 * THE ONE GENUINE PRIVACY HOLE, AND IT IS IN THE BEST FEATURE
 * ----------------------------------------------------------
 * Everything else about this app is airtight: no backend, no account, no
 * analytics, no network (D-001). Then the souvenir video — the entire
 * distribution strategy (D-013) — takes the location history and posts it to a
 * public feed. A trace that returns to the same building every night publishes
 * where the user is staying **and when it is empty**, to an audience of
 * strangers, on the app's own encouragement.
 *
 * D-016 calls this the single real privacy risk in the design and requires the
 * fix to be **on by default**. Not a setting, not a prompt: the export is
 * masked unless the user goes looking for a way to turn it off.
 *
 * HOW IT FINDS THE PLACE
 * ----------------------
 * Overnight fixes only, clustered by proximity. Overnight because that is what
 * makes a place *accommodation* rather than a café you like — the definition is
 * "where they were at 3am", and it needs no map, no address lookup and no
 * network to answer.
 *
 * WHY IT IS DELIBERATELY BLUNT
 * ----------------------------
 * The mask radius is generous and the cluster test is crude, because the two
 * failure modes are not symmetric:
 *
 *   - **Masking too much** costs a little of the trace near the hotel. Nobody
 *     notices, and nobody is harmed.
 *   - **Masking too little** publishes somebody's address.
 *
 * So when in doubt, mask. That is the opposite of the generosity rule for
 * stamps (D-009), and for the same underlying reason: err toward the outcome
 * whose failure is cheap.
 *
 * Pure: no database, no clock. Tested in `accommodation.test.ts`.
 */

import type { Coordinate } from '../recording/distance.ts';
import { distanceM, isUsableCoordinate } from '../recording/distance.ts';

/** A fix, reduced to what this needs. */
export type OvernightFix = {
  ts: number;
  lat: number;
  lon: number;
  accuracy_m: number | null;
};

/**
 * The hours that count as "overnight", in local time.
 *
 * 01:00–05:00. Narrow on purpose: it excludes late dinners and early starts,
 * both of which happen away from the accommodation, and it is comfortably
 * inside the window even for somebody out until midnight.
 */
export const OVERNIGHT_START_HOUR = 1;
export const OVERNIGHT_END_HOUR = 5;

/**
 * How close two overnight fixes must be to count as the same place.
 *
 * 150 m absorbs GPS drift indoors — which is severe, because the phone is on a
 * bedside table behind a wall — without merging two hotels on the same street.
 */
export const CLUSTER_RADIUS_M = 150;

/**
 * How many overnight fixes a cluster needs before it is believed.
 *
 * Guards against a single stray night — a friend's sofa, a delayed flight — or
 * one wild fix becoming "home".
 */
export const MIN_CLUSTER_FIXES = 3;

/**
 * The radius hidden around the detected accommodation.
 *
 * ⚠ **Deliberately much larger than the cluster radius.** The point is not to
 * hide the building; it is to make the building unidentifiable. 300 m in a
 * dense part of Funchal covers hundreds of dwellings, which is what turns "his
 * flat" into "somewhere in this neighbourhood". A radius that merely covered
 * the GPS error would still point at one front door.
 */
export const MASK_RADIUS_M = 300;

export type Accommodation = {
  lat: number;
  lon: number;
  /** How many overnight fixes support it. More is more certain. */
  fixCount: number;
  /** How many separate nights. Two or more is a real stay, not one bad night. */
  nightCount: number;
};

function isOvernight(ts: number): boolean {
  const hour = new Date(ts).getHours();
  return hour >= OVERNIGHT_START_HOUR && hour < OVERNIGHT_END_HOUR;
}

/**
 * Which night a timestamp belongs to.
 *
 * An overnight fix at 02:00 on Tuesday belongs to Monday night. Without this,
 * one stay would count as two nights and a single restless night could look
 * like a pattern.
 */
function nightKey(ts: number): string {
  const date = new Date(ts);
  date.setHours(date.getHours() - OVERNIGHT_END_HOUR);
  return date.toDateString();
}

/**
 * Find where the user slept most often.
 *
 * Returns null when there is not enough evidence — which is the correct answer
 * for a day tripper, a first night, or a trip recorded too sparsely. **A null
 * must never be read as "nothing to hide"**; see `maskTrace`, which refuses to
 * export anything it could not check.
 */
export function detectAccommodation(
  fixes: OvernightFix[]
): Accommodation | null {
  const overnight = fixes.filter(
    (fix) =>
      isUsableCoordinate(fix) &&
      isOvernight(fix.ts) &&
      // A ±500 m fix would drag a cluster centre across a neighbourhood.
      (fix.accuracy_m === null || fix.accuracy_m <= CLUSTER_RADIUS_M)
  );

  if (overnight.length === 0) {
    return null;
  }

  // Greedy clustering: every fix seeds a candidate, and the candidate with the
  // most members wins. O(n²) over overnight fixes only — a week of them is a
  // few hundred at most, and this runs once, at export.
  let best: { members: OvernightFix[] } | null = null;

  for (const seed of overnight) {
    const members = overnight.filter(
      (other) => distanceM(seed, other) <= CLUSTER_RADIUS_M
    );
    if (best === null || members.length > best.members.length) {
      best = { members };
    }
  }

  if (best === null || best.members.length < MIN_CLUSTER_FIXES) {
    return null;
  }

  // The centroid, not the seed: the seed is an arbitrary member and could sit
  // at the edge of the cluster.
  let latSum = 0;
  let lonSum = 0;
  const nights = new Set<string>();
  for (const member of best.members) {
    latSum += member.lat;
    lonSum += member.lon;
    nights.add(nightKey(member.ts));
  }

  return {
    lat: latSum / best.members.length,
    lon: lonSum / best.members.length,
    fixCount: best.members.length,
    nightCount: nights.size,
  };
}

export type MaskResult = {
  /** The fixes safe to export. */
  fixes: OvernightFix[];
  /** How many were withheld. */
  removedCount: number;
  /** Always present. Goes in the diary, and explains a suspiciously short trace. */
  reason: string;
};

/**
 * Remove everything within the mask radius of the accommodation.
 *
 * ⚠ **A null accommodation does not mean "export everything".** It means the
 * app could not work out what to hide, and exporting an unchecked trace is
 * precisely the failure D-016 exists to prevent. The caller gets an empty
 * result and a reason — the export is refused, not silently unmasked.
 *
 * That is the whole safety property of this module, and it is the one thing
 * here that must never be "simplified".
 */
export function maskTrace(
  fixes: OvernightFix[],
  accommodation: Accommodation | null,
  hadOvernightData: boolean
): MaskResult {
  if (accommodation === null) {
    if (!hadOvernightData) {
      // Nothing was ever recorded overnight, so there is no home in this
      // trace to reveal. Safe to export whole.
      return {
        fixes,
        removedCount: 0,
        reason: 'no overnight data — nothing to mask',
      };
    }
    // Overnight fixes exist but did not resolve to a place. Something is
    // there and we cannot see it; refuse rather than guess.
    return {
      fixes: [],
      removedCount: fixes.length,
      reason: 'overnight data present but no accommodation identified — export withheld',
    };
  }

  const kept = fixes.filter(
    (fix) => distanceM(fix, accommodation) > MASK_RADIUS_M
  );

  return {
    fixes: kept,
    removedCount: fixes.length - kept.length,
    reason: `masked ${MASK_RADIUS_M} m around the accommodation`,
  };
}

/** True when this position would be hidden. For tests and for T-110. */
export function isMasked(
  position: Coordinate,
  accommodation: Accommodation
): boolean {
  return distanceM(position, accommodation) <= MASK_RADIUS_M;
}
