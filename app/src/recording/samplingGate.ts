/**
 * Applying the stationary-vs-moving decision (T-034).
 *
 * The arithmetic is in `movementPolicy.ts` and is pure. This is the part that
 * reads the database, talks to the provider and writes the diary — the same
 * split as `geofenceSelection` / `geofenceManager`, and for the same reason: it
 * is what lets the interesting half be tested on a laptop.
 *
 * Called once per batch of fixes, from the background task. Never throws: it
 * runs inside an OS callback, and a failure here must cost a profile change,
 * never a batch of fixes (D-010).
 */

import type { SamplingProfile } from './LocationProvider';
import { recorder } from './recorder';

// ⚠ E3, 2026-10-31: the logic that was here is in `recorderCore.ts`, unchanged,
// with the database and provider passed in, so `recorderCore.test.ts` can
// replay real batches through it. These keep the names every caller used.

/**
 * Look at the last few minutes of fixes and adjust the sampling profile.
 * `now` is the batch's own timestamp (see `recorderCore.applySamplingGate`).
 */
export function applySamplingGate(now: number, wallNowMs: number = Date.now()): Promise<void> {
  return recorder.applySamplingGate(now, wallNowMs);
}

/** Raise the profile on the motion sensors' word alone (D-106). */
export function raiseProfile(to: SamplingProfile, reason: string): Promise<void> {
  return recorder.raiseProfile(to, reason);
}

/** Drop a moving profile to stationary on the still check's word (T-286). */
export function lowerProfile(reason: string): Promise<void> {
  return recorder.lowerProfile(reason);
}

/** N15: the profile a launch re-asserts the recorder on (`launchProfile`). */
export function settleLaunchProfile(nowMs: number): Promise<SamplingProfile> {
  return recorder.settleLaunchProfile(nowMs);
}

/** For the debug screen and the map: what the gate thinks it has set. */
export function getCurrentSamplingProfile(): Promise<SamplingProfile> {
  return recorder.getCurrentSamplingProfile();
}

// ---------------------------------------------------------------------------
// ⚠ THE KNOWN HOLE IN ALL OF THIS, and it is not fixable from this file.
//
// The stationary profile sets `pausesUpdatesAutomatically`, so iOS may stop
// location updates entirely once it agrees the user has stopped — and
// historically it does not resume until a significant location change. If that
// happens: no fix arrives, so this gate never runs, so the profile never leaves
// `stationary`. The gate can put the recorder to sleep and cannot wake it.
//
// The recovery paths are the ones the architecture already leans on: region
// monitoring and significant-location-change relaunch (D-005, T-047), and the
// day-1 health check (T-049). None of them has been tested.
//
// This is the specific thing to watch in the 72-hour soak (T-051). It is noted
// here as well as in `ExpoLocationProvider.ts` because this file is what makes
// the stationary profile reachable automatically for the first time — before
// T-034, nothing ever selected it.
// ---------------------------------------------------------------------------
