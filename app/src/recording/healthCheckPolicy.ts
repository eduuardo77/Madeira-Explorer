/**
 * The day-1 health check: should we say something, and what? (T-049, D-011)
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * The product promise is a ghost app you install and forget. The catastrophic
 * failure of a ghost is silence: recording dies on day 2, the user opens the
 * app on day 7, and three-quarters of their holiday is missing. D-011 is blunt
 * that this is *worse than never having installed it*, and D-032 lists silent
 * failure as one of the three things that must not be cut.
 *
 * So the app spends one of its two permitted notifications (D-011) on a single
 * question asked 12–24 hours after install: **is this actually working?** At
 * that point six days remain to fix it. On day 7 nothing can be fixed.
 *
 * WHAT MAKES THIS DELICATE
 * ------------------------
 * A false alarm is expensive. Telling a tourist their tracking is broken when
 * it is fine teaches them to distrust the app, and the fix they will reach for
 * — reinstalling, or revoking permissions in confusion — makes things worse.
 * So the checks below are deliberately asymmetric: an alarm needs positive
 * evidence that something is wrong, and anything ambiguous stays quiet.
 *
 * A stationary phone is the case that catches people out. Somebody who
 * installs the app and spends their first evening in the hotel has *no fixes*
 * and nothing is broken. That is why "no fixes" alone is not an alarm — the
 * permission state is what separates "nothing happened" from "we were never
 * allowed to look".
 *
 * Pure: no notifications, no database, no clock. Tested in
 * `healthCheckPolicy.test.ts`.
 */

import { APP_NAME } from '../brand.ts';
import type { PermissionLevel } from './LocationProvider';

/**
 * How long after install to ask. D-011 says 12–24 hours; the low end of that
 * is used because it leaves the most time to act, and because a tourist's
 * first full day is when a broken recorder is most recoverable.
 */
export const HEALTH_CHECK_DELAY_MS = 14 * 60 * 60 * 1000;

/**
 * Fewer fixes than this in the first day, with permission granted and
 * recording started, means something is wrong.
 *
 * ⚠ NOT TUNED. Even the stationary profile defers for at most 15 minutes, so a
 * working recorder should produce dozens of fixes in fourteen hours. Ten is a
 * floor low enough that a genuinely idle phone in a hotel safe still clears
 * it.
 */
export const MIN_HEALTHY_FIX_COUNT = 10;

export type HealthCheckInput = {
  /** When the app first ran. */
  installedTs: number;
  now: number;
  /** Whether this check has already been sent — it fires at most once. */
  alreadySent: boolean;
  permission: PermissionLevel;
  isRecording: boolean;
  fixCount: number;
  /** Null when nothing has ever been recorded. */
  lastFixTs: number | null;
};

/**
 * What to do. `notify: false` is by far the most common outcome and is not a
 * failure — it means either "too early" or "everything is fine".
 */
export type HealthCheckDecision = {
  notify: boolean;
  /** Diagnostic, always present, whether or not anything is sent. */
  reason: string;
  /** User-facing. Null when nothing is being sent. */
  title: string | null;
  body: string | null;
};

const SILENT = (reason: string): HealthCheckDecision => ({
  notify: false,
  reason,
  title: null,
  body: null,
});

/**
 * Decide whether the day-1 check should fire.
 *
 * The copy is written to D-015's audience — an eighty-year-old with no app
 * fluency — so it says what happened and what to do, in one sentence each, and
 * never uses the word "permission" as a noun the user has to decode.
 */
export function decideHealthCheck(
  input: HealthCheckInput
): HealthCheckDecision {
  if (input.alreadySent) {
    return SILENT('already sent');
  }

  const age = input.now - input.installedTs;
  if (age < HEALTH_CHECK_DELAY_MS) {
    return SILENT(
      `too early — ${Math.round(age / 3600000)}h since install, needs ${
        HEALTH_CHECK_DELAY_MS / 3600000
      }h`
    );
  }

  // The unambiguous failures first, most actionable one first. Each of these
  // is positive evidence that the app cannot do its job.
  if (input.permission === 'denied') {
    return {
      notify: true,
      reason: 'permission denied',
      title: 'Your trip is not being recorded',
      body: `${APP_NAME} cannot see where you go, so your map will stay empty. Open the app to turn location back on — there is still plenty of your trip left.`,
    };
  }

  if (input.permission === 'undetermined') {
    return {
      notify: true,
      reason: 'permission never granted',
      title: 'One tap to start your map',
      body: `${APP_NAME} has not started recording yet. Open the app and allow location, and it will fill in the rest of your trip by itself.`,
    };
  }

  if (!input.isRecording) {
    return {
      notify: true,
      reason: 'not recording',
      title: 'Your trip is not being recorded',
      body: 'Recording has stopped. Open the app to start it again — the rest of your trip can still be saved.',
    };
  }

  // Permission is granted and recording is on, but nothing has arrived. This
  // is the OEM-battery-killer case and the one the whole check exists for
  // (ARCHITECTURE §6.2): the app believes it is working and is not.
  if (input.fixCount < MIN_HEALTHY_FIX_COUNT || input.lastFixTs === null) {
    return {
      notify: true,
      reason: `only ${input.fixCount} fixes since install`,
      title: 'Your map is not filling in',
      body: `${APP_NAME} is running, but your phone is not letting it record. Open the app — it will show you the one setting to change.`,
    };
  }

  // A long silence from a recorder that is otherwise healthy. Judged against
  // the check window rather than a fixed gap, because a quiet evening is
  // normal and half a day is not.
  const silence = input.now - input.lastFixTs;
  if (silence > HEALTH_CHECK_DELAY_MS / 2) {
    return {
      notify: true,
      reason: `last fix ${Math.round(silence / 3600000)}h ago`,
      title: 'Your map is not filling in',
      body: `${APP_NAME} has not recorded anything for several hours. Open the app to check it — the rest of your trip can still be saved.`,
    };
  }

  // Everything is fine. D-011 promises confirmation as well as warning: the
  // user was told at onboarding that this would happen, and a check that only
  // ever appears when something is broken trains people to dread it.
  return {
    notify: true,
    reason: `healthy — ${input.fixCount} fixes`,
    title: 'Your map is filling in nicely',
    body: `${APP_NAME} is recording your trip in the background. You will not hear from it again until you are heading home.`,
  };
}
