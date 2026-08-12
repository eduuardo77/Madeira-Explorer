/**
 * "Recording is on. Is anything actually arriving?" (T-052b, D-047)
 *
 * WHY THIS EXISTS, AND IT IS NOT A HYPOTHETICAL
 * ---------------------------------------------
 * On 2026-08-11 the recorder was declared broken. For a day the app reported
 * `Recording: yes`, held a foreground-service notification, and received
 * nothing whatsoever. On 2026-08-12 the cause turned out to be the emulator
 * (D-047) — but the app could not tell the difference, and neither could the
 * person reading its debug screen, which showed `Recording  yes` and
 * `Fixes  0` as two unrelated rows and left a human to notice they contradicted
 * each other.
 *
 * That is the silent failure CONTEXT §4.5 calls worse than never installing the
 * app, seen from the inside. On a phone it is the OEM battery killer
 * (ARCHITECTURE §6.2); on the emulator it was an unservable accuracy request. In
 * both cases the observable is identical and the app should say it out loud.
 *
 * HOW IT DIFFERS FROM THE DAY-1 HEALTH CHECK (T-049, D-011)
 * ---------------------------------------------------------
 * That check asks once, fourteen hours after install, and spends a
 * notification. This is a *continuous* read with no user-facing cost, and it
 * answers within minutes rather than within a day. They overlap deliberately:
 * the day-1 check is what reaches a user who is not looking, and this is what
 * the debug screen, the field tester and the diary can see at any moment. The
 * fourteen-hour blind window at the start of a trip is exactly where a
 * misconfigured recorder does its damage.
 *
 * WHY THE THRESHOLD IS DERIVED AND NOT ANOTHER GUESSED CONSTANT
 * -------------------------------------------------------------
 * Each profile already declares how long the OS may sit on a batch before
 * waking us — `deferredIntervalMs` — and how far apart fixes may be inside one.
 * Those are D-028's battery decisions and they are the *only* honest statement
 * anywhere of how long silence is normal. So the expectation is computed from
 * them rather than invented next to them, which means retuning the battery
 * constants retunes this automatically and the two cannot drift apart.
 *
 * ⚠ `SILENCE_TOLERANCE` is the one number here that is a guess, and it is
 * flagged as such. T-051's soak is what sets it.
 *
 * Pure: no clock, no database, no notifications. Tested in
 * `recorderSilence.test.ts`.
 */

import type { PermissionLevel, SamplingProfile } from './LocationProvider';
import { getSamplingParameters } from './samplingPolicy.ts';

/**
 * How many times the profile's own expected wake-up interval may pass with
 * nothing arriving before we call it silence.
 *
 * ⚠ NOT TUNED. It trades how fast a real failure is noticed against how often a
 * healthy recorder is libelled, and a false alarm is expensive — the
 * `healthCheckPolicy` header explains why at length. Three is deliberately
 * generous: it is long enough that one missed batch, a tunnel, or an OS that
 * batches lazily says nothing at all.
 *
 * T-051's 72-hour soak produces the distribution of real inter-fix gaps, which
 * is what should replace this.
 */
export const SILENCE_TOLERANCE = 3;

/**
 * A floor, so the `driving` profile does not raise an alarm within seconds of a
 * cold start. Acquiring a first GPS fix outdoors routinely takes tens of
 * seconds and indoors may never happen at all — neither is a fault.
 */
export const MIN_SILENCE_BEFORE_ALARM_MS = 2 * 60 * 1000;

export type SilenceInput = {
  isRecording: boolean;
  permission: PermissionLevel;
  /** What the sampling gate has selected (T-034). */
  profile: SamplingProfile;
  /** When recording last started. Null if it never has. */
  recordingSinceTs: number | null;
  /** The most recent fix, of any age. Null if nothing was ever recorded. */
  lastFixTs: number | null;
  now: number;
};

export type SilenceState =
  /** Not running, so silence means nothing. */
  | 'not_recording'
  /** Running, but not yet long enough for silence to be evidence. */
  | 'warming_up'
  /** Fixes are arriving about as often as the profile leads us to expect. */
  | 'receiving'
  /** Running, allowed, and nothing is coming. This is the one that matters. */
  | 'silent';

export type SilenceVerdict = {
  state: SilenceState;
  /**
   * How long since the last fix — or since recording started, when there has
   * never been one. Null when not recording.
   */
  silentForMs: number | null;
  /** How long silence may last in this profile before it counts as evidence. */
  toleratedMs: number;
  /** One line, for the debug screen and the event diary. Never null. */
  detail: string;
};

/**
 * The longest silence that is normal for a profile.
 *
 * The OS may hold a batch for `deferredIntervalMs` and the fixes inside it are
 * at least `minTimeMs` apart, so one wake-up cycle is the sum. Anything shorter
 * than the floor is raised to it.
 */
export function toleratedSilenceMs(profile: SamplingProfile): number {
  const parameters = getSamplingParameters(profile);
  const oneCycle = parameters.deferredIntervalMs + parameters.minTimeMs;
  return Math.max(MIN_SILENCE_BEFORE_ALARM_MS, oneCycle * SILENCE_TOLERANCE);
}

function describe(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) {
    return `${Math.round(ms / 1000)}s`;
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/**
 * Is the recorder running and receiving nothing?
 *
 * Deliberately asymmetric, the same way `healthCheckPolicy` is: `silent`
 * requires positive evidence — running, permitted, and past the tolerated
 * window — and everything ambiguous resolves to something quieter.
 *
 * Note what is *not* checked here: whether the OS ever accepted our location
 * request. There is no Android API that answers it (`dumpsys location` does,
 * and it is not available to an app). Measuring the silence is the closest an
 * app can get to that question from the inside, which is the whole design.
 */
export function assessSilence(input: SilenceInput): SilenceVerdict {
  const tolerated = toleratedSilenceMs(input.profile);

  if (!input.isRecording || input.recordingSinceTs === null) {
    return {
      state: 'not_recording',
      silentForMs: null,
      toleratedMs: tolerated,
      detail: 'not recording',
    };
  }

  // Without permission the silence is explained, and the day-1 check already
  // has better words for it. Saying "receiving nothing" here as well would
  // point at the wrong cause.
  if (input.permission === 'denied' || input.permission === 'undetermined') {
    return {
      state: 'not_recording',
      silentForMs: null,
      toleratedMs: tolerated,
      detail: `not allowed to record (${input.permission})`,
    };
  }

  // Silence is measured from the last fix, or from the start of recording when
  // there has never been one — which is the case that had gone unnoticed.
  const since = input.lastFixTs ?? input.recordingSinceTs;
  const silentFor = Math.max(0, input.now - since);

  if (silentFor <= tolerated) {
    return {
      state: input.lastFixTs === null ? 'warming_up' : 'receiving',
      silentForMs: silentFor,
      toleratedMs: tolerated,
      detail:
        input.lastFixTs === null
          ? `waiting for a first fix, ${describe(silentFor)} so far`
          : `last fix ${describe(silentFor)} ago`,
    };
  }

  return {
    state: 'silent',
    silentForMs: silentFor,
    toleratedMs: tolerated,
    detail:
      input.lastFixTs === null
        ? `recording for ${describe(silentFor)} on the ${input.profile} profile and no fix has EVER arrived`
        : `recording, but nothing for ${describe(silentFor)} — over the ${describe(tolerated)} expected on the ${input.profile} profile`,
  };
}
