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
import { STRINGS } from '../i18n/strings.ts';
import { translate } from '../i18n/translate.ts';
import type { Language } from '../i18n/languages.ts';
import type { PermissionLevel } from './LocationProvider';
import { MOVED_WITHOUT_RECORDING_M } from './recorderSilence.ts';

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
 * ⚠ **Measured wrong, 2026-10-09: a still phone does not clear it.** The note
 * here said the stationary profile defers at most 15 minutes, so a working
 * recorder makes dozens of fixes in fourteen hours. On the P30 overnight, 7 to
 * 8 Oct 2026, a healthy recorder lying still made **2 fixes in 16 hours**: the
 * OS sends nothing to a phone that does not move. So a count under this, or a
 * long silence, is an alarm only with `MOVED_WITHOUT_RECORDING_M` of evidence
 * that the phone went somewhere. Below it, the count only withholds the
 * "filling in nicely" confirmation. Ten stays a guess.
 */
export const MIN_HEALTHY_FIX_COUNT = 10;

export { MOVED_WITHOUT_RECORDING_M } from './recorderSilence.ts';

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
  /**
   * Metres between Bruma's last stored fix and the position Android last knew
   * (from any app, at most an hour old, read without powering the GPS). Null
   * when either is missing: no evidence either way.
   */
  movedSinceLastFixM: number | null;
  /**
   * Which language to write the notification in (T-160).
   *
   * ⚠ **Passed in rather than read from the device**, because this module is
   * pure and runs under Node's test runner. Importing `i18n/index.ts` would drag
   * in `expo-localization` and break every test here — the same reason `now` is a
   * parameter instead of a call to the clock.
   */
  language: Language;
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

/** Bound per call, so every string in one decision speaks the same language. */
const sayIn =
  (language: Language) =>
  (key: keyof typeof STRINGS): string =>
    translate(STRINGS[key], language, { app: APP_NAME });

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
  const say = sayIn(input.language);
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
      title: say('notify.title.notRecorded'),
      body: say('notify.locationOff.body'),
    };
  }

  if (input.permission === 'undetermined') {
    return {
      notify: true,
      reason: 'permission never granted',
      title: say('notify.title.oneTap'),
      body: say('notify.notStarted.body'),
    };
  }

  if (!input.isRecording) {
    return {
      notify: true,
      reason: 'not recording',
      title: say('notify.title.notRecorded'),
      body: say('notify.stopped.body'),
    };
  }

  // Permission is granted and recording is on, but not a single fix ever
  // arrived. Recording starts at onboarding and stores its first fix then, so
  // none in fourteen hours is the OEM battery killer (ARCHITECTURE §6.2): the
  // app believes it is working and is not.
  if (input.lastFixTs === null) {
    return {
      notify: true,
      reason: 'no fix since install',
      title: say('notify.title.notFilling'),
      body: say('notify.blocked.body'),
    };
  }

  // Few fixes, or a long silence: a fault only if the phone went somewhere
  // meanwhile. A phone at rest overnight looks exactly like this (2 fixes in
  // 16 hours on the P30) and is not broken.
  const moved =
    input.movedSinceLastFixM !== null && input.movedSinceLastFixM >= MOVED_WITHOUT_RECORDING_M;
  const silence = input.now - input.lastFixTs;
  if (moved && silence > HEALTH_CHECK_DELAY_MS / 2) {
    return {
      notify: true,
      reason: `last fix ${Math.round(silence / 3600000)}h ago, phone ${Math.round(input.movedSinceLastFixM ?? 0)} m away`,
      title: say('notify.title.notFilling'),
      body: say('notify.silent.body'),
    };
  }
  if (moved && input.fixCount < MIN_HEALTHY_FIX_COUNT) {
    return {
      notify: true,
      reason: `only ${input.fixCount} fixes since install, phone ${Math.round(input.movedSinceLastFixM ?? 0)} m away`,
      title: say('notify.title.notFilling'),
      body: say('notify.blocked.body'),
    };
  }
  if (input.fixCount < MIN_HEALTHY_FIX_COUNT || silence > HEALTH_CHECK_DELAY_MS / 2) {
    // Not proof of a fault, and not enough to say it is filling in nicely.
    return SILENT(`quiet: ${input.fixCount} fixes, last ${Math.round(silence / 3600000)}h ago, no sign the phone moved`);
  }

  // Everything is fine. D-011 promises confirmation as well as warning: the
  // user was told at onboarding that this would happen, and a check that only
  // ever appears when something is broken trains people to dread it.
  return {
    notify: true,
    reason: `healthy — ${input.fixCount} fixes`,
    title: say('notify.title.fillingNicely'),
    body: say('notify.background.body'),
  };
}
