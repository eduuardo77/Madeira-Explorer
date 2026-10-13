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

import type { SamplingProfile } from './LocationProvider';

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
