/**
 * *Start walk* — a walk the **user** began, which is not the same thing as the
 * recorder running (2026-08-28).
 *
 * ⚠ WHY THIS DISTINCTION HAD TO EXIST BEFORE THE BUTTON COULD BE SHOWN TO
 * EVERYBODY
 * ---------------------------------------------------------------------------
 * The button used to appear only for people **without** background recording,
 * and it read its state straight off `locationProvider.isRecording()`. That was
 * fine while it was a fallback: if you had no background recording, the recorder
 * was running only because you had pressed the button.
 *
 * The project lead asked for the button for everyone. Shown to somebody who
 * *does* have background recording, that same wiring means the app launches,
 * `syncRecordingWithPreferences` starts the recorder automatically (D-002 — the
 * map fills in by itself), and the button is already sitting on **Stop walk**
 * for a walk the user never started. Their instruction was explicit that opening
 * the app must not do that.
 *
 * So there are two independent facts and the app had been conflating them:
 *
 *   1. **Is the recorder running?** Often yes, automatically, and none of the
 *      user's business — that is the promise the app makes.
 *   2. **Has the user said "I am on a walk now"?** Only ever true because
 *      somebody pressed a button.
 *
 * The button shows (2). It is stored, so it survives the app being closed
 * mid-walk — a walk you started is still running when you come back — and it
 * starts life `false`, which is what makes a fresh launch show *Start walk*.
 *
 * ⚠ **STOPPING A WALK DOES NOT ALWAYS STOP THE RECORDER, AND MUST NOT.** For
 * somebody with background recording on, the recorder belongs to D-002 rather
 * than to this button; ending their walk and silently turning off the thing that
 * fills the map in would break the app's one promise from a control that does
 * not claim to touch it. For everybody else this button *is* the recorder, and
 * stopping means stopping. That is the whole of `actionForStopWalk`.
 *
 * Pure: no storage, no Expo. `manualWalk.test.ts` holds the table.
 */

/**
 * Everything the two decisions below need, and nothing else.
 *
 * `backgroundRecording` is the **combined** answer — the user allowed it *and*
 * the OS granted Always. Two separate flags here would let a caller pass the
 * user's preference alone, which is the state that looks enabled and records
 * nothing (T-146).
 */
export type WalkState = {
  /** The user pressed *Start walk* and has not pressed *Stop*. Persisted. */
  startedByUser: boolean;
  /** Whether the recorder is actually running at this moment. */
  recorderRunning: boolean;
  /** Allowed by the user **and** granted by the OS. */
  backgroundRecording: boolean;
};

/** What the recorder should do. `leave-running` also covers "leave stopped". */
export type RecorderAction = 'start' | 'stop' | 'leave-alone';

/**
 * ⚠ Anything unreadable is **false**, and this is the opposite of
 * `parseBackgroundTracking`, deliberately.
 *
 * There, an unreadable value means the app's normal behaviour, because the
 * user's answer to a broken row should be the thing they came for. Here, a
 * broken row that read as `true` would show *Stop walk* for a walk nobody
 * started, and the first thing the user does is press it — which, for somebody
 * without background recording, stops a recorder that was their only way of
 * capturing the walk they are actually on.
 */
export function parseWalkStarted(raw: string | null): boolean {
  const value = (raw ?? '').trim().toLowerCase();
  return value === 'true' || value === '1';
}

/**
 * What the button says, and it reads exactly one field.
 *
 * ⚠ Not `recorderRunning`. That is the entire point of this module — see the
 * header. If this ever starts consulting the recorder, the button will light up
 * on its own at launch again.
 */
export function isWalkInProgress(state: WalkState): boolean {
  return state.startedByUser;
}

/**
 * The user pressed *Start walk*.
 *
 * If the recorder is already going — because background recording is on, or
 * because a previous walk is still open — starting it again would end that trip
 * and open a new one, splitting one walk into two in the database (D-010).
 */
export function actionForStartWalk(state: WalkState): RecorderAction {
  return state.recorderRunning ? 'leave-alone' : 'start';
}

/**
 * The user pressed *Stop walk*.
 *
 * ⚠ The `backgroundRecording` branch is the one that matters and it is checked
 * first: their recorder is not this button's to switch off. See the header.
 */
export function actionForStopWalk(state: WalkState): RecorderAction {
  if (state.backgroundRecording) {
    return 'leave-alone';
  }
  return state.recorderRunning ? 'stop' : 'leave-alone';
}
