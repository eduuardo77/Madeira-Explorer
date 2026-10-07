/**
 * The only way a trace leaves this app (T-104, D-016).
 *
 * **Everything shareable must come through here.** The souvenir renderer
 * (T-105), the still image, and any future export all read from this function
 * and never from `rawFixDao` directly. That is the entire enforcement
 * mechanism for D-016: masking is not a step somebody remembers to apply, it
 * is the only door.
 *
 * If a future export bypasses this and reads the trace itself, the app
 * publishes where its users sleep. There is no second safety net.
 */

import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as tripDao from '../storage/dao/tripDao';
import type { Trip } from '../storage/types';
import type { Accommodation, OvernightFix } from './accommodation';
import { detectAccommodation, maskTrace } from './accommodation';

/**
 * Why nothing can be exported, as a code a screen can translate (T-190).
 *
 * `reason` stays the diary's English sentence. Screens show this instead: until
 * 2026-09-23 they showed `reason` itself, so a Portuguese phone read
 * *"nothing recorded"* inside a translated alert.
 */
export type ExportRefusal = 'nothing' | 'withheld' | 'hidden' | 'failed';

export type ExportableTrace = {
  /** Safe to render, safe to share. */
  fixes: OvernightFix[];
  /** Null when none was found — which does not mean none exists. */
  accommodation: Accommodation | null;
  removedCount: number;
  reason: string;
  /**
   * False when the app declined to export because it could not verify what
   * needed hiding. The caller must show something honest rather than an empty
   * map (ARCHITECTURE §10).
   */
  safeToShare: boolean;
  /** Null exactly when `safeToShare` is true. */
  refusal: ExportRefusal | null;
};

const NOTHING: ExportableTrace = {
  fixes: [],
  accommodation: null,
  removedCount: 0,
  reason: 'no trip to export',
  safeToShare: false,
  refusal: 'nothing',
};

/**
 * The trip's trace, with the user's accommodation removed: `tripId`'s, or
 * else the open trip's, or else the latest (T-275: the passport's list plays
 * and shares any trip, through this and nothing else).
 *
 * Masking is applied unconditionally — D-016 requires it **on by default**,
 * and there is deliberately no parameter to turn it off. When a setting to
 * reveal the full trace eventually exists (it should be possible; it is the
 * user's own data), it belongs at the call site with its own confirmation, not
 * as a flag threaded through here where it could default wrong.
 *
 * `quiet` skips the diary line for a caller that only asks whether there is
 * anything to show (the passport's *Watch* offer, T-217), which would
 * otherwise write one on every visit. Masking is the same either way.
 */
export async function getExportableTrace({
  quiet = false,
  tripId,
}: { quiet?: boolean; tripId?: number } = {}): Promise<ExportableTrace> {
  try {
    const target = await exportedTrip(tripId);
    if (target === null) {
      return NOTHING;
    }

    const fixes = await rawFixDao.getTraceFixes(target.id);
    if (fixes.length === 0) {
      return { ...NOTHING, reason: 'nothing recorded' };
    }

    const accommodation = detectAccommodation(fixes);
    const hadOvernightData = hasOvernightFixes(fixes);
    const masked = maskTrace(fixes, accommodation, hadOvernightData);

    if (!quiet) {
      await recordingEventDao.log(
        'export',
        `${masked.fixes.length} of ${fixes.length} fixes: ${masked.reason}`
      );
    }

    return {
      fixes: masked.fixes,
      accommodation,
      removedCount: masked.removedCount,
      reason: masked.reason,
      safeToShare: masked.fixes.length > 0,
      // T-275: two different answers to the user. `withheld`: the night was
      // recorded but where it was spent could not be found, so nothing can be
      // hidden safely. `hidden`: it was found, and the whole trip is near it,
      // as a trip spent around the house is (the P30's trip 30).
      refusal: masked.fixes.length > 0 ? null : accommodation === null ? 'withheld' : 'hidden',
    };
  } catch (error) {
    await recordingEventDao.logError('export trace', error);
    // A failure here must never fall through to an unmasked export.
    return { ...NOTHING, reason: 'export failed', refusal: 'failed' };
  }
}

/**
 * The trip an export is of: `tripId`'s when given. Otherwise the open one,
 * and at export time that is usually already ended (T-099), so the most recent
 * rather than requiring an open trip.
 */
export async function exportedTrip(tripId?: number): Promise<Trip | null> {
  if (tripId !== undefined) {
    return tripDao.getTrip(tripId);
  }
  return (await tripDao.getActiveTrip()) ?? (await tripDao.getMostRecentTrip());
}

/**
 * Whether the trace contains anything recorded overnight.
 *
 * Separate from detection because the two answer different questions, and
 * `maskTrace` needs both: "is there a home in here" versus "did we find it".
 * Conflating them is what would let an unverified trace out.
 */
function hasOvernightFixes(fixes: { ts: number }[]): boolean {
  for (const fix of fixes) {
    const hour = new Date(fix.ts).getHours();
    if (hour >= 1 && hour < 5) {
      return true;
    }
  }
  return false;
}
