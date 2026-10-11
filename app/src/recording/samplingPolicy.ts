/**
 * How hard to sample, per activity.
 *
 * ⚠ THESE NUMBERS ARE NOT TUNED. ⚠
 *
 * They are plausible starting values, not measured ones. T-038 tunes them
 * against the Phase 0 field data (T-020), which does not exist yet. Do not
 * treat any figure here as validated, and do not quote them as the app's
 * battery characteristics until T-054 has actually measured a 12-hour day.
 *
 * The strategy they implement (ARCHITECTURE §7): we do not need real-time
 * position, we need the trace. So the chip buffers fixes and wakes us every few
 * minutes instead of every second. That deferral is the single largest battery
 * win available, and it is the reason the targets are per-day rather than
 * per-hour.
 */

import type { SamplingProfile } from './LocationProvider';

export type SamplingParameters = {
  /** Minimum time between fixes handed to us. */
  minTimeMs: number;
  /** Minimum movement between fixes handed to us. */
  minDistanceM: number;
  /**
   * Requested accuracy class. Backend-neutral on purpose — each provider maps
   * these onto its own enum.
   */
  desiredAccuracy: 'coarse' | 'balanced' | 'high';
  /**
   * How long the OS may buffer fixes before waking us. This is the batching
   * knob (iOS deferred updates, Android setMaxWaitTime). Higher is cheaper.
   */
  deferredIntervalMs: number;
  /** How far the user may travel before the OS must wake us regardless. */
  deferredDistanceM: number;
  /** Let the OS stop the GPS entirely when it decides we are not moving. */
  pauseWhenStationary: boolean;
};

const MINUTE = 60 * 1000;

export const SAMPLING_PROFILES: Record<SamplingProfile, SamplingParameters> = {
  /**
   * Phone on a bedside table, or its owner at dinner. This should be as close
   * to free as the OS will let us get. We still want the occasional fix so that
   * a gap can be told apart from a dead service (see recording_event).
   */
  stationary: {
    minTimeMs: 5 * MINUTE,
    minDistanceM: 100,
    desiredAccuracy: 'coarse',
    deferredIntervalMs: 15 * MINUTE,
    deferredDistanceM: 500,
    pauseWhenStationary: true,
  },

  /**
   * Walking a levada. Denser than driving in *distance* terms because the
   * interesting geometry is tighter, but the canopy means many of these fixes
   * will be poor or absent anyway — which is what the barometer and pedometer
   * are for. Corridor crediting (D-009) means we do not need every point.
   */
  walking: {
    minTimeMs: 30 * 1000,
    minDistanceM: 20,
    desiredAccuracy: 'balanced',
    deferredIntervalMs: 5 * MINUTE,
    deferredDistanceM: 150,
    pauseWhenStationary: true,
  },

  /**
   * Driving the VR1. Highest rate of the three, and the least costly in
   * practice — Madeira tourism runs on rental cars and the phone is usually on
   * a charger. Tunnel inference (D-009) fills what GPS loses underground, but
   * it needs a clean fix at each portal, so we want fixes close together here.
   */
  driving: {
    minTimeMs: 15 * 1000,
    minDistanceM: 50,
    desiredAccuracy: 'high',
    deferredIntervalMs: 3 * MINUTE,
    deferredDistanceM: 1000,
    pauseWhenStationary: false,
  },
};

export function getSamplingParameters(
  profile: SamplingProfile
): SamplingParameters {
  return SAMPLING_PROFILES[profile];
}

/**
 * How long the fixes may be held before the app sees them, on this platform.
 *
 * ⚠ **On Android the hold is Expo's, not the chip's**, and it blinded the
 * stationary profile (F1, the P30, 2026-10-11). With the app off screen,
 * `expo-location`'s `LocationTaskConsumer` keeps every fix in memory until
 * *both* the interval and the distance since the last delivery are reached.
 * The lead swiped Bruma away at home and drove off: fixes at 15:40, 15:44 (at
 * 42 km/h) and 15:49 were held, 8 s short of the 15 minutes, until 17:10. The
 * gate (`samplingGate.ts`) only runs on a delivery, so it never saw the drive,
 * and the whole outing was recorded as 10 fixes.
 *
 * So on Android the stationary profile delivers every fix. It takes one at
 * most every 5 minutes and 100 m, so the cost is a wake that rare, and it is
 * the profile whose one job is to notice the user has started moving. The
 * moving profiles keep their hold: it only delays what they record, and their
 * battery was measured with it (field log, 8 and 9 Oct). ⚠ A held fix lives
 * in memory only, so a process killed while holding loses it.
 */
export function deferralFor(
  platform: 'ios' | 'android',
  profile: SamplingProfile,
  parameters: Pick<SamplingParameters, 'deferredIntervalMs' | 'deferredDistanceM'>
): { intervalMs: number; distanceM: number } {
  return platform === 'android' && profile === 'stationary'
    ? { intervalMs: 0, distanceM: 0 }
    : { intervalMs: parameters.deferredIntervalMs, distanceM: parameters.deferredDistanceM };
}
