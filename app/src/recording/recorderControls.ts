/**
 * What the home screen says about recording, and what a walk changes (D-087,
 * T-198).
 *
 * WHY THIS EXISTS
 * ---------------
 * The review of 2026-09-22 (P1-2) found the app contradicting itself about
 * recording: Settings said *"A registar a sua viagem"*, the OS had the
 * foreground service running, and the home button said *"Começar a registar"*.
 * Pressing it did nothing: `manualWalk.actionForStartWalk` returned
 * `leave-alone`, so only a flag, a colour and a word changed.
 *
 * D-087 separates the two ideas the way WalkNYC does (reference-app-teardown
 * item 16):
 *
 *   - **Automatic recording** is the background recorder. It lives in Settings,
 *     and the home screen speaks about it only when something is wrong.
 *   - **A walk** is started from the main button and **changes the recorder**:
 *     for its duration it samples at the finest setting the app has. Stamps are
 *     awarded the same with or without one; a walk buys a finer trace.
 *
 * And two things the project lead added: **a pause**, during which nothing is
 * stored, and **a short summary** when a walk stops.
 *
 * ⚠ **The recorder's state is read from evidence, never from
 * `isRecording()`** (T-174: that flag outlived a dead service for three weeks).
 * Here the evidence is `recorderSilence`'s verdict.
 *
 * Pure: no storage, no Expo, no clock of its own. `recorderControls.test.ts`.
 */

import type { PermissionLevel } from './LocationProvider.ts';
import type { SilenceState } from './recorderSilence.ts';
import type { TrackingQuality } from './trackingPreference.ts';
import { distanceM } from './distance.ts';

/** The main button, in each of its three states (D-087 §3). */
export type PrimaryControl = 'grant-location' | 'start-walk' | 'stop-walk';

/**
 * The one thing the home screen may say about automatic recording, or null.
 *
 * Only ever about something wrong, or about a pause the user chose (D-087 §4).
 * When recording works, the map says nothing about it, as WalkNYC's does.
 */
export type RecorderNotice = 'paused' | 'recorder-stopped' | 'needs-always' | null;

export type ControlInput = {
  permission: PermissionLevel;
  /** The user's Settings switch for automatic recording. */
  automaticAllowed: boolean;
  /** The user pressed *Começar passeio* and has not pressed *Terminar*. */
  walkInProgress: boolean;
  /** Null when not paused. A pause in the past is no pause. */
  pausedUntilTs: number | null;
  /** From `recorderSilence`: evidence, not the registration flag (T-174). */
  silence: SilenceState;
  nowMs: number;
};

export function isPaused(pausedUntilTs: number | null, nowMs: number): boolean {
  return pausedUntilTs !== null && nowMs < pausedUntilTs;
}

/**
 * The main button.
 *
 * ⚠ **No location at all is the one state that takes the button over.**
 * WalkNYC does the same (teardown item 4): there is nothing else the button
 * could usefully do, and a walk that cannot record is a promise the app breaks
 * the moment it is pressed. Missing *background* permission does not take it
 * over: a walk records with the app open, which is exactly what D-008 keeps for
 * people who refuse background location.
 */
export function primaryControl(input: ControlInput): PrimaryControl {
  if (input.permission === 'denied' || input.permission === 'undetermined') {
    return 'grant-location';
  }
  return input.walkInProgress ? 'stop-walk' : 'start-walk';
}

/**
 * What to tell the user about automatic recording, most important first.
 *
 * `dismissed` holds the notices the user has closed. A dismissible notice is an
 * offer rather than a nag (teardown item 4, D-008). ⚠ **`recorder-stopped` cannot be
 * dismissed**: it is the T-174 state, a recorder the user believes is running,
 * and hiding it is how three weeks went by unnoticed.
 */
export function recorderNotice(
  input: ControlInput,
  dismissed: ReadonlySet<Exclude<RecorderNotice, null>> = new Set()
): RecorderNotice {
  if (isPaused(input.pausedUntilTs, input.nowMs)) {
    return 'paused';
  }
  if (!input.automaticAllowed) {
    // Switched off on purpose. Nothing is wrong, so nothing is said.
    return null;
  }
  if (input.permission !== 'always') {
    return dismissed.has('needs-always') ? null : 'needs-always';
  }
  if (input.silence === 'silent') {
    return 'recorder-stopped';
  }
  return null;
}

/**
 * The quality the recorder should run at right now (D-087 §2).
 *
 * A walk takes the finest setting the app has, whatever the user chose for
 * automatic recording, and gives it back when the walk ends. ⚠ The finest
 * setting is still bounded by `trackingPreference`'s floor. Whether a walk
 * should go *below* that floor, as WalkNYC's 1 s does, is a battery cost nobody
 * has measured (T-054), so it waits for the measurement.
 */
export function effectiveQuality(
  userQuality: TrackingQuality,
  walkInProgress: boolean
): TrackingQuality {
  return walkInProgress ? 'precise' : userQuality;
}

/**
 * Stored while paused? No: nothing is (D-087 §6).
 *
 * The recorder keeps running and the sink drops what arrives. A stopped
 * recorder would need something to restart it when the pause ends, and nothing
 * in this app can reliably wake itself in the background at a given time. A
 * recorder that is never stopped needs nothing to resume.
 */
export function shouldStore(pausedUntilTs: number | null, sampleTs: number): boolean {
  return !isPaused(pausedUntilTs, sampleTs);
}

/** What the short summary shows when a walk stops (D-087 §7). */
export type WalkSummary = {
  durationMs: number;
  /** Along the recorded fixes, in metres. Null when fewer than two were usable. */
  distanceM: number | null;
  /** Stamps awarded between the walk's start and its end, oldest first. */
  placeIds: string[];
};

/**
 * The walk's own numbers, from what was actually recorded.
 *
 * ⚠ **The distance is the recorded path, not the walk.** Under canopy GPS
 * wanders and drops (T-018 is still unmeasured), so the number can be longer
 * or shorter than the ground covered. Fixes worse than `maxAccuracyM` are left
 * out, the same cut the drawing makes (`MAX_DRAWN_ACCURACY_M`), so the summary
 * never counts a jump the map would not draw.
 */
export function walkSummary(input: {
  startTs: number;
  endTs: number;
  fixes: readonly { ts: number; lat: number; lon: number; accuracy_m: number | null }[];
  awards: readonly { placeId: string; awardedTs: number }[];
  maxAccuracyM: number;
}): WalkSummary {
  const inWalk = input.fixes
    .filter((fix) => fix.ts >= input.startTs && fix.ts <= input.endTs)
    .filter((fix) => fix.accuracy_m === null || fix.accuracy_m <= input.maxAccuracyM)
    .sort((a, b) => a.ts - b.ts);

  let metres = 0;
  for (let i = 1; i < inWalk.length; i += 1) {
    metres += distanceM(inWalk[i - 1], inWalk[i]);
  }

  return {
    durationMs: Math.max(0, input.endTs - input.startTs),
    distanceM: inWalk.length < 2 ? null : metres,
    placeIds: input.awards
      .filter((award) => award.awardedTs >= input.startTs && award.awardedTs <= input.endTs)
      .sort((a, b) => a.awardedTs - b.awardedTs)
      .map((award) => award.placeId),
  };
}
