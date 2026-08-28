/**
 * What to ask the user for, and when (T-042, T-043, T-044).
 *
 * THE HARDEST PERMISSION ON MOBILE, AND IT IS GETTING HARDER
 * ---------------------------------------------------------
 * CONTEXT §4.3 is blunt that this alone could sink the app. iOS cannot request
 * "Always" up front, and then periodically shows the user a map of everywhere
 * they have been and asks whether to continue — which reads as a security
 * warning to a non-technical eighty-year-old, who taps Deny. Android 11+
 * cannot request it inline at all: the user must be sent to a settings screen,
 * after a prominent-disclosure screen, and Google Play reviews these apps by
 * hand and rejects many.
 *
 * D-008's answer is the one this file implements: **the app is fully
 * functional on While-Using, and Always is an upgrade that is never a gate.**
 * Nothing here may block the user from using the app.
 *
 * THE SEQUENCE
 * ------------
 *   1. Welcome — what this does, in one sentence.
 *   2. Location — why, then the system dialog. While-Using only.
 *   3. Notifications — explained separately, because D-011 spends exactly two
 *      of them and the day-1 check (T-049) is useless without permission.
 *   4. Done. The map appears and the app goes quiet.
 *
 * Then, days later and outside onboarding entirely, the Always upgrade
 * (T-043) and downgrade recovery (T-044).
 *
 * WHY NOTIFICATIONS ARE A SEPARATE STEP WITH A SCREEN IN FRONT OF IT
 * -----------------------------------------------------------------
 * Two system dialogs back to back get both refused — the second is dismissed
 * on reflex before it is read. An explanation screen between them turns a
 * stack into a sequence. It is also the honest place to promise how few
 * messages there will be, which is the actual objection.
 *
 * Pure: no Expo, no database, no clock. Tested in `permissionPolicy.test.ts`.
 */

import type { PermissionLevel } from '../recording/LocationProvider.ts';

/** Whether the OS will show our notifications. */
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export type OnboardingStep =
  | 'welcome'
  | 'location'
  | 'notifications'
  | 'keep-running'
  | 'complete';

/**
 * ⚠ **THE MEASURED BATTERY FIGURE. LEAVE THIS NULL UNTIL T-054 HAS RUN.**
 *
 * T-042 requires the battery cost stated in the copy next to the control that
 * turns tracking on — and requires it to be the **measured** number, never an
 * invented one. This is null because nothing has been measured: the app has
 * never run on a phone.
 *
 * Null is not a placeholder to be filled with something plausible. A guessed
 * percentage is worse than no percentage: it is a promise the app has not
 * earned, made to somebody deciding whether to trust it with their location
 * all week, and it would be discovered wrong on their holiday. The copy below
 * omits the sentence entirely rather than estimate.
 *
 * When T-054 produces a real 12-hour figure, put it here and the sentence
 * appears everywhere it belongs, at once.
 */
export const MEASURED_BATTERY_PERCENT_PER_DAY: number | null = null;

/**
 * The honest battery sentence, or nothing at all.
 *
 * Returning null is a supported, expected outcome — see above. Callers must
 * render nothing rather than substitute their own wording.
 */
/**
 * ⚠ **NOT LOCALISED, and that is safe only while it returns null** (T-160).
 *
 * D-041 keeps `MEASURED_BATTERY_PERCENT_PER_DAY` at `null` until somebody
 * measures it on real hardware, so this sentence cannot currently render in any
 * language. **The day that figure is measured, this needs the same `Language`
 * parameter as `decideHealthCheck`** — it is a pure module under Node's test
 * runner, so it cannot import `i18n/index.ts`.
 */
export function batterySentence(): string | null {
  if (MEASURED_BATTERY_PERCENT_PER_DAY === null) {
    return null;
  }
  return `Recording uses about ${MEASURED_BATTERY_PERCENT_PER_DAY}% of your battery per day.`;
}

export type OnboardingState = {
  location: PermissionLevel;
  notifications: NotificationPermission;
  /** Set once the user has been through the sequence, however it went. */
  completed: boolean;
  /**
   * Android only — passed in rather than read here, the same way this module
   * takes every other fact about the world. A pure module that imports
   * `Platform` cannot be unit tested, which is the rule in CLAUDE.md.
   */
  android: boolean;
  /** Whether the keep-running screen has already been shown once. */
  keepRunningSeen: boolean;
};

/**
 * The next screen to show, or `complete` when onboarding is done.
 *
 * Note what cannot happen: there is no step that requires a grant to move on.
 * A user who denies everything reaches `complete` and gets a working app with
 * a start/stop button (D-008). Refusing is a supported configuration, not an
 * error state.
 */
export function nextOnboardingStep(state: OnboardingState): OnboardingStep {
  if (state.completed) {
    return 'complete';
  }
  if (state.location === 'undetermined') {
    return 'welcome';
  }
  // Location has been answered — either way. Notifications are asked next,
  // and only if the OS has not already decided.
  if (state.notifications === 'undetermined') {
    return 'notifications';
  }
  // ⚠ Last, and Android only (2026-08-28). Some OEMs — EMUI, MIUI, ColorOS —
  // pause an app the moment it leaves the screen, and then the map does not
  // fill in and nothing in the app can say why. The reference app puts this in
  // front of the user on first run and it is the single most useful thing it
  // does on those phones.
  //
  // ⚠ It is a screen, not a gate (D-008): both actions move on, and it is shown
  // once. It is deliberately after notifications rather than before, because two
  // system dialogs back to back get both refused and this one opens a third.
  if (state.android && !state.keepRunningSeen) {
    return 'keep-running';
  }
  return 'complete';
}

/**
 * How long after install to offer the Always upgrade.
 *
 * ⚠ **TWELVE HOURS SINCE 2026-08-28. IT WAS FORTY.** T-043 said "~day 2" and
 * forty hours delivered that, deliberately: it sits comfortably after the day-1
 * health check at fourteen hours, because two prompts in one morning is how you
 * lose both.
 *
 * ⚠ **What changed is what the app is for.** Forty hours was set while this was
 * read as a walking app, where the While-Using fallback is tolerable — a walker
 * is holding the phone anyway and presses the button at the trailhead. The
 * project lead's point of 2026-08-28: a great deal of Madeira is seen **from a
 * car**, and that user has the phone in a cradle or a pocket for six hours and
 * will never press anything. On While-Using they record nothing, all day, while
 * D-002 promises them the opposite. On a seven-day holiday forty hours is the
 * first day and a half — usually the day people drive furthest.
 *
 * ⚠ **Twelve rather than "at the end of onboarding", which the reference app
 * does.** The argument for asking *after* the app has visibly done something is
 * the strong one and it survives: somebody who has watched a place fill in has a
 * reason to say yes. Twelve hours means install in the afternoon, asked the next
 * morning before setting off. It also keeps the ask away from onboarding's two
 * system dialogs, which is the reason this delay exists at all.
 *
 * ⚠ **It now lands BEFORE the day-1 health check at fourteen hours**, which is
 * the collision the forty was avoiding. Accepted, because the two are different
 * in kind — one is a notification the user reads, the other is a screen they act
 * on — and two hours apart is not "one morning". ⚠ If the health check ever
 * starts arriving as a full-screen prompt, this ordering has to be revisited.
 *
 * ⚠ **Revisit after the first real trip.** The project lead is doing real-world
 * testing on the P30 and said they would come back to this. Twelve is reasoned,
 * not measured.
 */
export const ALWAYS_UPGRADE_DELAY_MS = 12 * 60 * 60 * 1000;

export type AlwaysUpgradeState = {
  location: PermissionLevel;
  installedTs: number;
  now: number;
  /** When the upgrade was last offered, if ever. */
  offeredTs: number | null;
  /** Has the user recorded anything worth upgrading for? */
  hasRecordedAnything: boolean;
};

export type UpgradeDecision = {
  offer: boolean;
  reason: string;
};

/**
 * Should the Always upgrade be offered now?
 *
 * **Asked at most once, ever.** D-008 makes Always an upgrade and never a
 * gate, and a second ask is nagging — it converts an optional benefit into
 * pressure, which is exactly the dynamic that gets permissions revoked and
 * apps deleted. Settings keeps a way to enable it later (T-141) for anybody
 * who changes their mind.
 */
export function shouldOfferAlwaysUpgrade(
  state: AlwaysUpgradeState
): UpgradeDecision {
  if (state.location === 'always') {
    return { offer: false, reason: 'already granted' };
  }
  if (state.location !== 'while_using') {
    // Denied or undetermined. Somebody who refused location entirely does not
    // want a bigger version of the same question.
    return { offer: false, reason: `location is ${state.location}` };
  }
  if (state.offeredTs !== null) {
    return { offer: false, reason: 'already offered once' };
  }
  if (state.now - state.installedTs < ALWAYS_UPGRADE_DELAY_MS) {
    return { offer: false, reason: 'too early' };
  }
  if (!state.hasRecordedAnything) {
    // The upgrade is worth explaining in terms of what they have already got.
    // With an empty map there is nothing to point at, and the ask is abstract.
    return { offer: false, reason: 'nothing recorded to build the case on' };
  }
  return { offer: true, reason: 'day 2, recording, on While-Using' };
}

/**
 * Did iOS quietly drop us from Always back to While-Using? (T-044)
 *
 * This happens when the user answers "Change to While Using" on the periodic
 * iOS prompt that shows them a map of everywhere the app tracked them. They
 * are rarely aware it changed anything, and the app silently stops recording
 * in the background for the rest of the trip.
 *
 * `previous` is what was last observed; null when nothing has been recorded
 * yet, which is not a downgrade.
 */
export function detectDowngrade(
  previous: PermissionLevel | null,
  current: PermissionLevel
): boolean {
  return previous === 'always' && current === 'while_using';
}
