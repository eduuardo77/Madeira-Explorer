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
 * The profiles as Android must run them (F1, the P30, 2026-10-11 and 12).
 * Three rules: the first two found on 11 Oct, where the lead swiped Bruma away
 * at home, drove off, and the app recorded 10 fixes in two hours and lit
 * nothing; the third from Huawei's warning the next morning.
 *
 * **1. No hold.** ⚠ On Android the hold is Expo's, not the chip's. With the app off screen,
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
 *
 * **2. The GPS, not the low-power provider.** `coarse` and `balanced` are Android's
 * low-power and balanced priorities, Wi-Fi and cell towers first, and with the
 * screen off on the P30 they give next to nothing. On F1 the battery history
 * shows the GPS on for 2 minutes at 15:44 and 5 at 17:10, and no fix between
 * 15:49 and 17:10 while the lead drove. Every trip agrees: the ones recorded
 * at `high` (the outings, which force Preciso: 4, 8, 9, 10 Oct) lit 94 to
 * 99.6% of the route; the ones that were not (6 Oct on Poupança, 29 fixes; the
 * way back from the gym on 6 Oct on Equilibrado, nothing; F1) failed. A levada
 * has no Wi-Fi at all. So on Android the moving profiles ask for the GPS, in every
 * tier; the tiers still differ by interval and distance. ⚠ Poupança's battery
 * is no longer what was measured with it.
 *
 * **3. But not the stationary profile: the balanced provider, no GPS.** For a
 * day it had the GPS too, and the ride passed (12 Oct), but before it Huawei's
 * phone manager warned *"A aplicação Bruma está a drenar a bateria ao verificar
 * a localização frequentemente"*, with *Forçar paragem*: the GPS had started
 * 38 times overnight, every 5 minutes the phone was not in deep idle. A user
 * who taps that stops the recorder. The lead chose Wi-Fi and cell positions at
 * home: the first-fix rules (`movementPolicy.decideProfile`) need one fix 100 m
 * away, or a moving label from the motion sensors, to wake the GPS, and the
 * low-power provider gave three such fixes in the first 15 minutes of the
 * failed F1 drive. ⚠ Unproven until a ride with it, and a day without the
 * warning.
 */
export function forPlatform(
  platform: 'ios' | 'android',
  profile: SamplingProfile,
  parameters: SamplingParameters
): SamplingParameters {
  if (platform !== 'android') return parameters;
  return profile === 'stationary'
    ? { ...parameters, deferredIntervalMs: 0, deferredDistanceM: 0, desiredAccuracy: 'balanced' }
    : { ...parameters, desiredAccuracy: 'high' };
}
