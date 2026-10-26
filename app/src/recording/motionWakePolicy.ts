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
 * Whether a moving profile may drop to stationary after the sensors said
 * still. `first` is taken at the wake, `second` after `STILL_CHECK_WAIT_MS`;
 * `lastMovingSignalMs` is the newest moving label from the sensors, if any.
 * Any doubt keeps the profile, because a wrong sleep loses trace that cannot
 * be recovered and a wrong stay costs only battery.
 */
export function decideStillCheck(
  current: SamplingProfile,
  first: MovementSample | null,
  second: MovementSample | null,
  lastMovingSignalMs: number | null
): StillCheck {
  const stay = (reason: string): StillCheck => ({ sleep: false, reason });
  if (current === 'stationary') return stay('already stationary');
  if (first === null || second === null) return stay('no position');
  const untrusted = (sample: MovementSample) =>
    sample.accuracyM !== null && sample.accuracyM > MAX_TRUSTED_ACCURACY_M;
  if (untrusted(first) || untrusted(second)) return stay('position too rough');
  const spanMs = second.ts - first.ts;
  if (spanMs < STILL_CHECK_WAIT_MS) return stay(`only ${Math.round(spanMs / 60000)} min apart`);
  if (lastMovingSignalMs !== null && lastMovingSignalMs > first.ts) {
    return stay('the motion sensors said moving since');
  }
  const metres = distanceM(first, second);
  if (metres > MOVING_THRESHOLD_M) return stay(`moved ${Math.round(metres)} m`);
  return {
    sleep: true,
    reason: `still by the motion sensors, within ${Math.round(metres)} m for ${Math.round(spanMs / 60000)} min`,
  };
}
