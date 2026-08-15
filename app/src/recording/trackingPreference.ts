/**
 * What the user has decided about tracking (T-146).
 *
 * Two independent choices, and keeping them independent is the point:
 *
 *   1. **May the app record when it is not open?** A yes/no about *consent*.
 *   2. **How closely?** A three-way about *cost*, which only means anything
 *      once the answer to the first is yes.
 *
 * They are stored separately, parsed here, and nothing else in the app is
 * allowed to interpret the raw strings — the same rule `mapStylePreference`
 * follows, and for the same reason: a text column will eventually contain
 * something nobody expected, and the cost of that must be a lost preference
 * rather than a broken recorder (D-010).
 *
 * ⚠ WHY THERE ARE NO PERCENTAGES IN HERE
 * --------------------------------------
 * The obvious labels are "3% a day", "medium", "15–20%". This app is not
 * allowed to say that, and the rule is not pedantry: **no battery figure in
 * this project has ever been measured.** D-041 keeps the reported figure `null`
 * on purpose and a test holds it there, because a plausible guess printed in a
 * settings screen is a promise the app has not earned — and the one number a
 * tracking app gets judged on is exactly this one.
 *
 * What the tiers *can* honestly say is what they do: how often the phone is
 * asked where it is, and what that costs you in detail. Direction is knowable
 * without a device; magnitude is not. T-054 measures a real 12-hour day on real
 * hardware, and the day it does, this is where the numbers go.
 *
 * Pure: no storage, no Expo. Tested in `trackingPreference.test.ts`.
 */

import type { SamplingParameters } from './samplingPolicy.ts';

/**
 * How closely to follow the user, when they have allowed background recording.
 *
 * ⚠ This is a **separate axis** from `SamplingProfile`. That one answers "what
 * is the user doing right now" and the app decides it (`movementPolicy`); this
 * one answers "how much of my battery may you spend on that" and only the user
 * decides it. Collapsing the two would mean either the app overriding a
 * deliberate choice, or the user having to pick a profile per activity.
 */
export type TrackingQuality = 'saver' | 'balanced' | 'precise';

export const TRACKING_QUALITIES: readonly TrackingQuality[] = [
  'saver',
  'balanced',
  'precise',
];

/**
 * ⚠ `balanced`, and not `saver`.
 *
 * The tempting default is the cheapest one — it looks considerate. It is the
 * wrong default here, because a user who never opens settings gets the app's
 * only real promise (D-002: the map fills in by itself) delivered at its
 * coarsest, decides the app is inaccurate, and deletes it. The considerate
 * default is the one that works.
 */
export const DEFAULT_TRACKING_QUALITY: TrackingQuality = 'balanced';

/**
 * ⚠ Background recording defaults to **on**, and that deserves justifying.
 *
 * It is not a licence the app grants itself: the OS permission is the real
 * gate, the user has already been asked for it in plain words during onboarding
 * (T-114), and this switch cannot record anything without it. What it does is
 * decide whether the app *uses* what it was given. Defaulting it off would mean
 * a user who granted Always, and said yes on purpose, gets an app that does
 * nothing until they find a setting — which is the failure D-008 describes.
 */
export const DEFAULT_BACKGROUND_TRACKING = true;

export function parseTrackingQuality(raw: string | null): TrackingQuality {
  const value = (raw ?? '').trim().toLowerCase();
  return TRACKING_QUALITIES.includes(value as TrackingQuality)
    ? (value as TrackingQuality)
    : DEFAULT_TRACKING_QUALITY;
}

/**
 * Parse the background-recording switch.
 *
 * ⚠ Anything unrecognised is **true**, matching the default. A stored value
 * this cannot read is a bug in the app, and the user's answer to it must be the
 * app's normal behaviour rather than a silent opt-out of the thing they came
 * for. An explicit `false` is the only way to be off, which is what makes the
 * off state a decision somebody made rather than a value that got lost.
 */
export function parseBackgroundTracking(raw: string | null): boolean {
  const value = (raw ?? '').trim().toLowerCase();
  return value === 'false' || value === '0' ? false : DEFAULT_BACKGROUND_TRACKING;
}

/**
 * How each tier bends the activity profile it is handed.
 *
 * A table rather than three branches, because the only thing worth reading here
 * is the *relationship* between the tiers — every number in `saver` is a
 * loosening and every number in `precise` is a tightening, and that has to stay
 * true at a glance when somebody tunes them against real data (T-038).
 *
 * ⚠ NOT TUNED, like everything downstream of them in `samplingPolicy`. These
 * are ratios chosen to be clearly distinguishable, not measured ones.
 */
const QUALITY_FACTORS: Record<
  TrackingQuality,
  {
    /** Multiplies the gaps: >1 means fewer fixes. */
    interval: number;
    /** Multiplies the distances: >1 means fewer fixes. */
    distance: number;
    /** Multiplies how long the OS may batch before waking us. */
    deferral: number;
    accuracy: SamplingParameters['desiredAccuracy'] | null;
    /** Null keeps whatever the activity profile asked for. */
    pauseWhenStationary: boolean | null;
  }
> = {
  saver: {
    interval: 4,
    distance: 3,
    deferral: 3,
    // Coarse accuracy is the single biggest saving available: it lets the OS
    // answer from cell and wifi rather than waking the GPS chip at all.
    accuracy: 'coarse',
    pauseWhenStationary: true,
  },
  balanced: {
    interval: 1,
    distance: 1,
    deferral: 1,
    accuracy: null,
    pauseWhenStationary: null,
  },
  precise: {
    interval: 1 / 3,
    distance: 1 / 4,
    deferral: 1 / 5,
    accuracy: 'high',
    // ⚠ Never letting the OS pause is most of what makes this tier expensive,
    // and it is also the only way to keep a trace through a long stop — a
    // picnic at a miradouro should not read as a gap in the line.
    pauseWhenStationary: false,
  },
};

/**
 * Floors, so that `precise` cannot ask for something absurd.
 *
 * Ten seconds and five metres are below anything a walking trace needs and
 * comfortably above what would turn the recorder into a busy loop. They exist
 * because a multiplier applied to a future, smaller profile value would
 * otherwise silently produce one.
 */
const MIN_INTERVAL_MS = 10 * 1000;
const MIN_DISTANCE_M = 5;
const MIN_DEFERRAL_MS = 30 * 1000;

/**
 * Apply the user's tier to an activity profile.
 *
 * Returns a new object; the profile table is shared and must not be mutated.
 */
export function scaleForQuality(
  parameters: SamplingParameters,
  quality: TrackingQuality
): SamplingParameters {
  const factor = QUALITY_FACTORS[quality];

  return {
    minTimeMs: atLeast(parameters.minTimeMs * factor.interval, MIN_INTERVAL_MS),
    minDistanceM: atLeast(
      parameters.minDistanceM * factor.distance,
      MIN_DISTANCE_M
    ),
    desiredAccuracy: factor.accuracy ?? parameters.desiredAccuracy,
    deferredIntervalMs: atLeast(
      parameters.deferredIntervalMs * factor.deferral,
      MIN_DEFERRAL_MS
    ),
    deferredDistanceM: atLeast(
      parameters.deferredDistanceM * factor.distance,
      MIN_DISTANCE_M
    ),
    pauseWhenStationary:
      factor.pauseWhenStationary ?? parameters.pauseWhenStationary,
  };
}

function atLeast(value: number, floor: number): number {
  return Math.max(floor, Math.round(value));
}
