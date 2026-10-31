/**
 * When the motion wake looks for a position (D-106), pure, so it is tested in
 * Node (`motionWakePolicy.test.ts`); `backgroundTasks.ts` runs it.
 *
 * The phone's motion sensor fires as a trip starts, often while the phone is
 * still at the door: on 12 Oct 2026 it fired at 21:39:40 and the drive began
 * minutes later. A single position then would read "not moved" and the wake
 * would be wasted. So it looks three times over three minutes, and stops as
 * soon as the sampling gate has left the stationary profile, which means the
 * recorder has taken over.
 *
 * Each look is one GPS position, and the gate decides from it exactly as from
 * any batch: 100 m from the last fix, or a fast move, switches (D-106). A
 * false alarm (the phone picked up at home) costs three positions.
 */

import { distanceM } from './distance.ts';
import type { SamplingProfile } from './LocationProvider';
import type { MovementSample } from './movementPolicy.ts';
import { MAX_TRUSTED_ACCURACY_M, MOVING_THRESHOLD_M, STILL_CONFIRM_MS } from './movementPolicy.ts';

/** The wait before each look, in ms: at once, then 90 s, then another 90 s. */
export const WAKE_CHECK_WAITS_MS: readonly number[] = [0, 90_000, 90_000];

/** How long one look may wait for a GPS position before giving up on it. */
export const WAKE_FIX_TIMEOUT_MS = 45_000;

/**
 * The wait before look `index` (from 0), or null when the wake is over: the
 * looks are used up, or the recorder is no longer stationary.
 */
export function nextWakeCheck(index: number, profile: SamplingProfile): number | null {
  if (profile !== 'stationary') return null;
  return index < WAKE_CHECK_WAITS_MS.length ? WAKE_CHECK_WAITS_MS[index] : null;
}

// ---------------------------------------------------------------------------
// The still check (T-286)
// ---------------------------------------------------------------------------
//
// On *driving* the 50 m distance filter lets no fix through while the phone
// sits still, and the sampling gate runs only when a fix arrives, so a stop
// that begins on driving never sleeps. On 26 Oct 2026 a 29 minute sit-down in
// a shopping centre kept the GPS on high accuracy throughout; the sensors'
// *still* at 17:49 was there and nothing acted on it. So the motion sensors'
// still now wakes the app too, and this decides from two fresh positions.

/** How long the check waits between its two positions: as long as the gate's own still rule. */
export const STILL_CHECK_WAIT_MS = STILL_CONFIRM_MS;

export type StillCheck = { sleep: boolean; reason: string };

/**
 * Longer than this between the wake and the verdict and the check overslept:
 * its timer was frozen with the process, and what it saw is history (T-294).
 * The wait plus both position timeouts, with room to spare.
 */
export const STILL_CHECK_LATE_MS = 2 * STILL_CHECK_WAIT_MS;

/**
 * Whether a moving profile may drop to stationary after the sensors said
 * still at `wakeMs`. `first` is taken at the wake, `second` after
 * `STILL_CHECK_WAIT_MS`; `lastMovingSignalMs` is the newest moving label from
 * the sensors, if any. Doubt about the positions keeps the profile, because a
 * wrong sleep loses trace and a wrong stay costs only battery.
 *
 * ⚠ N15 (2026-10-27): **no position is not doubt.** Indoors the GPS finds
 * nothing within the wait, and on the P30 the check ended "stay, no position"
 * twice at home, leaving fine GPS on all night with nothing to record. When
 * the sensors said still and nothing since said moving, a missing position
 * counts as still: the motion wake (D-106) lifts the profile again on the
 * first sign of a move, so a wrong sleep here is short.
 */
export function decideStillCheck(
  current: SamplingProfile,
  first: MovementSample | null,
  second: MovementSample | null,
  lastMovingSignalMs: number | null,
  wakeMs: number,
  nowMs: number
): StillCheck {
  const stay = (reason: string): StillCheck => ({ sleep: false, reason });
  if (current === 'stationary') return stay('already stationary');
  // ⚠ T-294 (30 Oct 2026, the P30): a check begun at 16:10 on a five-minute
  // timer ended at 17:42, when the app was next opened, "still for 91 min, no
  // position", and slept a walk. A frozen timer is not five still minutes.
  if (nowMs - wakeMs > STILL_CHECK_LATE_MS) {
    return stay(`the check ran ${Math.round((nowMs - wakeMs) / 60000)} min after the wake`);
  }
  if (lastMovingSignalMs !== null && lastMovingSignalMs > wakeMs) {
    return stay('the motion sensors said moving since');
  }
  if (first === null || second === null) {
    const waitedMs = nowMs - wakeMs;
    if (waitedMs < STILL_CHECK_WAIT_MS) return stay(`only ${Math.round(waitedMs / 60000)} min since the wake`);
    return {
      sleep: true,
      reason: `still by the motion sensors for ${Math.round(waitedMs / 60000)} min, no position (indoors)`,
    };
  }
  const untrusted = (sample: MovementSample) =>
    sample.accuracyM !== null && sample.accuracyM > MAX_TRUSTED_ACCURACY_M;
  if (untrusted(first) || untrusted(second)) return stay('position too rough');
  const spanMs = second.ts - first.ts;
  if (spanMs < STILL_CHECK_WAIT_MS) return stay(`only ${Math.round(spanMs / 60000)} min apart`);
  const metres = distanceM(first, second);
  if (metres > MOVING_THRESHOLD_M) return stay(`moved ${Math.round(metres)} m`);
  return {
    sleep: true,
    reason: `still by the motion sensors, within ${Math.round(metres)} m for ${Math.round(spanMs / 60000)} min`,
  };
}

// ---------------------------------------------------------------------------
// The profile a restart begins on (N15)
// ---------------------------------------------------------------------------

/** A fix newer than this at launch is evidence the phone is moving now. */
export const LAUNCH_FRESH_FIX_MS = STILL_CONFIRM_MS;

/**
 * The profile the recorder is (re)started on at launch, from evidence.
 *
 * ⚠ N15 (2026-10-27): it used to resume whatever was stored. An install at
 * home after a drive restarted the P30 on *driving*, whose 50 m filter lets no
 * fix through while still, so nothing lowered it and the GPS stayed on all
 * night. Now a moving profile is kept only when a fix arrived in the last
 * five minutes (the app opened mid-drive); otherwise the restart begins on
 * stationary and the first moving fix or motion wake raises it (D-106).
 * Nothing stored at all is a fresh install, somebody who has just landed:
 * that case stays moving, as `samplingGate` has always assumed.
 */
export function launchProfile(
  stored: SamplingProfile | null,
  lastFixTs: number | null,
  nowMs: number
): { profile: SamplingProfile | null; reason: string } {
  if (stored === null || stored === 'stationary') return { profile: null, reason: 'unchanged' };
  if (lastFixTs !== null && nowMs - lastFixTs <= LAUNCH_FRESH_FIX_MS) {
    return { profile: null, reason: 'a fix in the last five minutes' };
  }
  const age = lastFixTs === null ? 'no fix stored' : `last fix ${Math.round((nowMs - lastFixTs) / 60000)} min ago`;
  return { profile: 'stationary', reason: `restart with no recent fix (${age})` };
}

// ---------------------------------------------------------------------------
// Waits kept by an alarm, not a JavaScript timer (T-295)
// ---------------------------------------------------------------------------
//
// ⚠ 31 Oct 2026, the P30: a still check begun at 09:00 waited on a five
// minute `setTimeout` that never fired in the 2 h 40 that followed. React
// Native stops its timers while the app is in the background unless a
// headless task is running (`JavaTimerManager`), and Expo's background tasks
// are not one. So every wait in a background task now asks Android for an
// alarm, which runs the task again with a step: the next wake look, or the
// still check's second position. What the still check saw first is kept in
// `app_state`, not in memory, so a check that never finishes cannot block the
// next one.

/** What an alarm comes back to do. */
export type FollowUp = { kind: 'look'; index: number } | { kind: 'still' };

/** The step as the native side carries it: `look:1`, `look:2`, `still`. */
export function followUpStep(followUp: FollowUp): string {
  return followUp.kind === 'look' ? `look:${followUp.index}` : 'still';
}

/** The step back from the native side, or null for anything unexpected. */
export function parseFollowUp(step: unknown): FollowUp | null {
  if (step === 'still') return { kind: 'still' };
  if (typeof step !== 'string') return null;
  const match = /^look:(\d+)$/.exec(step);
  if (match === null) return null;
  const index = Number(match[1]);
  return index >= 1 && index < WAKE_CHECK_WAITS_MS.length ? { kind: 'look', index } : null;
}

/** A still check under way: when it began, and its first position if one came. */
export type PendingStillCheck = { wakeMs: number; first: MovementSample | null };

/** The stored check, or null when there is none or the row cannot be read. */
export function parsePendingStillCheck(raw: unknown): PendingStillCheck | null {
  if (raw === null || typeof raw !== 'object') return null;
  const { wakeMs, first } = raw as { wakeMs?: unknown; first?: unknown };
  if (typeof wakeMs !== 'number' || !Number.isFinite(wakeMs)) return null;
  if (first === null || first === undefined) return { wakeMs, first: null };
  const f = first as Record<string, unknown>;
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
  if (!finite(f.ts) || !finite(f.lat) || !finite(f.lon)) return { wakeMs, first: null };
  return {
    wakeMs,
    first: {
      ts: f.ts as number,
      lat: f.lat as number,
      lon: f.lon as number,
      accuracyM: finite(f.accuracyM) ? (f.accuracyM as number) : null,
    },
  };
}

/**
 * Whether a still label may begin a check. Not while one is under way; but a
 * check older than `STILL_CHECK_LATE_MS` is abandoned (its alarm never came,
 * the process died), and a new one replaces it rather than waiting forever,
 * which is what the in-memory flag did on 31 Oct.
 */
export function canStartStillCheck(pending: PendingStillCheck | null, nowMs: number): boolean {
  return pending === null || nowMs - pending.wakeMs > STILL_CHECK_LATE_MS;
}
