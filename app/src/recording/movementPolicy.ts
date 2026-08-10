/**
 * Stationary or moving? (T-034, implementing D-028)
 *
 * WHY THIS EXISTS
 * ---------------
 * A phone on a bedside table should cost approximately nothing. The sampling
 * profiles for that case already exist (`samplingPolicy.ts`); until now nothing
 * chose between them, so the recorder sampled as if the user were walking all
 * night. Activity gating is one of the five battery rules in CONTEXT §6.3, and
 * this is the cheapest of them to implement.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It never distinguishes walking from driving. D-028 deferred that (T-034a) and
 * the reasoning is worth keeping in view: on this island speed cannot separate
 * them. Madeira's gradients and Funchal's traffic compress driving into walking
 * speeds, so a speed threshold would mislabel constantly. The Android answer
 * would cost a new dependency and an `ACTIVITY_RECOGNITION` permission
 * (CONTEXT §6.4), which is not a price to pay on a guess.
 *
 * It also **never gates on the pedometer**. That is tempting, the reference app
 * does exactly it, and it is wrong here: this is not a walking app on a
 * rental-car island. Gating on steps would blind the recorder to every tunnel
 * drive and the whole VR1 (D-028). The pedometer classifies; it never gates.
 *
 * THE ASYMMETRY IS THE DESIGN
 * ---------------------------
 * Going *moving* takes one fix. Going *stationary* takes ten minutes of
 * evidence. That is deliberate and it is not a tuning accident: being slow to
 * notice someone has stopped costs a few minutes of unnecessary sampling, while
 * being slow to notice they have started costs the beginning of a walk, which is
 * trace we can never get back (CONTEXT §2.4).
 *
 * Pure: no Expo, no database, no clock of its own. Unit-tested in
 * `movementPolicy.test.ts`.
 */

import type { Coordinate } from './distance.ts';
import { distanceM } from './distance.ts';
import type { SamplingProfile } from './LocationProvider';

/**
 * The single "moving" profile, until T-034a says otherwise.
 *
 * `walking` rather than `driving` because it is the cheaper of the two and v1
 * no longer needs the expensive one: the argument for `driving`'s tighter
 * sampling was catching a clean fix at each tunnel portal, and tunnel inference
 * moved to v2 with the rest of Phase 4 (D-032). The `driving` profile stays in
 * `samplingPolicy.ts` for manual use and for when T-034a revisits this.
 */
export const MOVING_PROFILE: SamplingProfile = 'walking';
export const STATIONARY_PROFILE: SamplingProfile = 'stationary';

/**
 * How far the user must be from where they were to count as moving.
 *
 * ⚠ A GUESS (D-028 says so explicitly; T-038 tunes it). 100 m is comfortably
 * outside consumer GPS scatter while standing still, and comfortably inside
 * "walked to the end of the street".
 */
export const MOVING_THRESHOLD_M = 100;

/**
 * How long the user must stay inside that radius before we believe they have
 * stopped.
 *
 * ⚠ A GUESS. Ten minutes is long enough that a coffee stop does not flip the
 * profile twice, and short enough that an evening in a restaurant is mostly
 * spent on the cheap profile.
 */
export const STATIONARY_WINDOW_MS = 10 * 60 * 1000;

/**
 * Fixes less accurate than this are ignored when measuring displacement.
 *
 * A fix with a ±150 m accuracy radius cannot answer a question about a 100 m
 * threshold — under canopy or between buildings it will happily report a jump
 * the user did not make, and flipping to the expensive profile because of noise
 * is a battery leak that would be very hard to find later. Fixes with no
 * accuracy reported at all are trusted, because refusing them would mean
 * ignoring every fix on a platform that omits the field.
 */
export const MAX_TRUSTED_ACCURACY_M = 100;

/** The minimum a caller has to know about a fix for this to work. */
export type MovementSample = Coordinate & {
  ts: number;
  accuracyM: number | null;
};

export type MovementDecision = {
  profile: SamplingProfile;
  /** Written to the recording diary, so a profile change is explicable later. */
  reason: string;
  /** True when the profile differs from what was passed in. */
  changed: boolean;
};

/**
 * Decide which sampling profile the recorder should be using.
 *
 * `recent` is a window of fixes in any order; only those within
 * `STATIONARY_WINDOW_MS` of the newest one are considered. Returns `current`
 * unchanged whenever the evidence is insufficient — never guesses, because a
 * wrong guess towards `stationary` silently stops recording a walk.
 */
export function decideProfile(
  current: SamplingProfile,
  recent: MovementSample[],
  now: number
): MovementDecision {
  const keep = (reason: string): MovementDecision => ({
    profile: current,
    reason,
    changed: false,
  });

  const trusted = recent.filter(
    (sample) =>
      Number.isFinite(sample.ts) &&
      (sample.accuracyM === null || sample.accuracyM <= MAX_TRUSTED_ACCURACY_M)
  );

  if (trusted.length === 0) {
    return keep('no usable fixes');
  }

  // The newest fix is "where the user is". Everything is measured against it
  // rather than against the window's midpoint, so a user who has walked away
  // and come back still reads as moving.
  let newest = trusted[0];
  for (const sample of trusted) {
    if (sample.ts > newest.ts) {
      newest = sample;
    }
  }

  const windowStart = newest.ts - STATIONARY_WINDOW_MS;
  const inWindow = trusted.filter((sample) => sample.ts >= windowStart);

  let maxDisplacementM = 0;
  let oldestTs = newest.ts;
  for (const sample of inWindow) {
    const metres = distanceM(newest, sample);
    if (metres > maxDisplacementM) {
      maxDisplacementM = metres;
    }
    if (sample.ts < oldestTs) {
      oldestTs = sample.ts;
    }
  }

  // Moving wins immediately — see the asymmetry note at the top of the file.
  if (maxDisplacementM > MOVING_THRESHOLD_M) {
    return {
      profile: MOVING_PROFILE,
      reason: `moved ${Math.round(maxDisplacementM)} m`,
      changed: current !== MOVING_PROFILE,
    };
  }

  // Going stationary needs a full window of evidence. Two fixes a minute apart
  // prove nothing about the next nine minutes.
  const covered = newest.ts - oldestTs;
  if (covered < STATIONARY_WINDOW_MS) {
    return keep(
      `only ${Math.round(covered / 60000)} min of history; need ${STATIONARY_WINDOW_MS / 60000}`
    );
  }

  // A stale window is not evidence of stillness — it is evidence of silence,
  // which is a different thing and is what `recording_event` exists to record
  // (ARCHITECTURE §10). Dropping to the cheap profile because the service died
  // would make the silence worse.
  const ageOfNewest = now - newest.ts;
  if (ageOfNewest > STATIONARY_WINDOW_MS) {
    return keep(`newest fix is ${Math.round(ageOfNewest / 60000)} min old`);
  }

  return {
    profile: STATIONARY_PROFILE,
    reason: `within ${Math.round(maxDisplacementM)} m for ${Math.round(covered / 60000)} min`,
    changed: current !== STATIONARY_PROFILE,
  };
}
