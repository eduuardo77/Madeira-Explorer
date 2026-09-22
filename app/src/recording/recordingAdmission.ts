/**
 * What the recorder is allowed to *act* on (T-171, T-172, T-173).
 *
 * WHY THIS MODULE EXISTS — AND IT IS NOT A TIDY-UP
 * -----------------------------------------------
 * Every rule here was written against real recorded data. A Huawei P30 came
 * back from the August loan with 831 fixes on it, and the first thing the
 * database said was that the recorder had spent six days in a loop:
 *
 *     trip 20  17:00:32  lasted 0s
 *     trip 21  17:00:33  lasted 0s
 *     trip 23  17:57:43  lasted 0s
 *
 * **Thirty trips in six days, eighteen of them under a minute.** The mechanism
 * is a cycle nobody could see from either end alone:
 *
 *   1. A fix arrives from mainland Portugal. `onLocations` has no active trip,
 *      so it **creates one** and stores the fix in it.
 *   2. `checkTripEnd` scans that trip, finds a fix outside the archipelago and
 *      ends it — **correctly**; `tripEnd.ts` is not wrong.
 *   3. The next fix arrives. Still no active trip. Go to 1.
 *
 * Neither half is a bug. The bug is that **nothing said a fix outside Madeira
 * has no business starting a Madeira holiday.** That sentence is this file.
 *
 * ⚠ **THE COST WAS NOT THE TRIP ROWS.** D-011 allows two notifications per
 * trip, and the budget is re-armed when a trip is created — deliberately, so a
 * repeat visitor is not silently muted on their second holiday (CONTEXT §4.10).
 * Twenty-five trips re-armed it twenty-five times:
 *
 *     x25  reveal: 1 of 2 (D-011)
 *     x 1  reveal: 2 of 2 (D-011)
 *     x41  reveal already sent for this trip
 *
 * **Twenty-six "your trip has ended" notifications.** The cap worked exactly as
 * specified and the churn underneath it made the specification meaningless —
 * and it fires when a visitor flies home with the app still installed, which is
 * every user, at the end of every trip, immediately before they decide whether
 * to keep it.
 *
 * THE SHAPE ALL OF THESE RULES SHARE
 * ----------------------------------
 * **Extending a trip and starting one are different privileges.** An
 * out-of-bounds fix must still be *stored* when a trip is open — it is the
 * evidence `tripEnd` needs to end that trip honestly, and D-010 says the raw
 * record is the one thing that cannot be recreated. It just may not *open* one.
 * Every rule below is that distinction.
 *
 * Pure: no database, no Expo, no clock of its own. Tested in
 * `recordingAdmission.test.ts`.
 */

import { isOutsideBounds, type Bounds } from '../progress/tripEnd.ts';
import type { GeofenceEventType } from '../storage/types.ts';

/**
 * How long after a trip ends the notification budget stays spent.
 *
 * ⚠ **NOT TUNED, and it is a guard rather than a threshold.** The two cases it
 * separates are nowhere near each other: churn re-creates a trip in *under a
 * second*, and a real repeat visit to Madeira is *months* later. Twelve hours
 * sits in the empty middle, so the number would have to be wrong by two orders
 * of magnitude to matter.
 *
 * It also covers a subtler case honestly. If `INACTIVITY_END_MS` ends a live
 * holiday because an OEM killed the recorder (ARCHITECTURE §6.2), the trip that
 * opens when the app is next launched is the *same* holiday continuing — and
 * re-arming there would spend a second reveal on it.
 */
export const NOTIFICATION_REARM_AFTER_MS = 12 * 60 * 60 * 1000;

/**
 * May a fix at this position open a new trip?
 *
 * ⚠ **This is not the same question as "should it be recorded".** It always
 * should be. See the header: an out-of-bounds fix is exactly the evidence that
 * ends a trip, so refusing to *store* it would replace a loop with a holiday
 * that never ends.
 *
 * ⚠ **A wild fix must not be able to suppress a trip either**, which is the
 * mirror of the rule `tripEndDetection` already applies in the other direction:
 * it ignores fixes worse than 200 m when deciding somebody left. A fix too
 * vague to end a holiday is too vague to refuse to start one, so it abstains —
 * `null` accuracy included, because a platform that omits the field must not
 * silently stop the recorder.
 */
export function fixMayStartTrip(
  fix: { lat: number; lon: number; accuracy_m?: number | null },
  bounds: Bounds,
  maxTrustedAccuracyM = 200
): boolean {
  const accuracy = fix.accuracy_m;
  if (accuracy !== null && accuracy !== undefined && accuracy > maxTrustedAccuracyM) {
    return true;
  }
  return !isOutsideBounds(fix, bounds);
}

/**
 * May a batch open a new trip? Yes if any fix in it could.
 *
 * Generous on purpose (D-009): one credible in-bounds fix is enough. A batch
 * delivered as the plane lands should start the holiday, not wait for the next
 * wake-up.
 */
export function batchMayStartTrip(
  fixes: readonly { lat: number; lon: number; accuracy_m?: number | null }[],
  bounds: Bounds
): boolean {
  return fixes.some((fix) => fixMayStartTrip(fix, bounds));
}

/**
 * May a geofence crossing open a new trip?
 *
 * **Anything but an exit.** An enter and a dwell are both evidence of being
 * somewhere; an exit is not — and on real hardware it is usually not evidence
 * of anything at all: see `isCredibleExit` below, which is the same finding
 * from the other side.
 *
 * ⚠ `dwell` is written as its own case rather than folded into "not exit",
 * because `GeofenceEventType` has three members and a reader should not have to
 * work out which side the third one falls on. Nothing emits it today —
 * `backgroundTasks.ts` maps only enter and exit — and that is precisely why it
 * needs stating rather than leaving to a default.
 */
export function transitionMayStartTrip(eventType: GeofenceEventType): boolean {
  return eventType === 'enter' || eventType === 'dwell';
}

/**
 * Is this exit a real crossing, or the registration artefact?
 *
 * ⚠⚠ **T-172 — EVERY ONE OF THE 2,699 GEOFENCE EVENTS ON THE P30 WAS AN EXIT.
 * NOT ONE WAS AN ENTER.** And they did not trickle in; they arrived together:
 * **83 sharing a single timestamp**, then 81, then 74. Nobody leaves 83 places
 * in one second. That is every monitored region reporting EXIT at the moment
 * the set is registered, because the device is not inside any of them — and
 * the set is rebuilt on every launch, every anchor exit and every reboot.
 *
 * `backgroundTasks.ts` maps the transition correctly, so the handler is not
 * where this comes from. It cannot be fixed by refusing exits either: a real
 * one is half of a dwell, which is what `reconstructVisits` measures departure
 * from and what `stampRules` needs.
 *
 * **What separates them is memory.** You cannot leave somewhere you were never
 * recorded entering. An exit with no matching enter in the same trip is not a
 * crossing, and dropping it costs nothing real — `stampRules` pairs an exit
 * with its enter, so an unpaired one was never going to award anything.
 */
export function isCredibleExit(hasPriorEnterInTrip: boolean): boolean {
  return hasPriorEnterInTrip;
}

/** Should this crossing be written to `geofence_event` at all? */
export function shouldRecordTransition(
  eventType: GeofenceEventType,
  hasPriorEnterInTrip: boolean
): boolean {
  if (eventType === 'exit') {
    return isCredibleExit(hasPriorEnterInTrip);
  }
  return true;
}

/**
 * May the notification budget be re-armed for a newly created trip?
 *
 * D-011's two-per-trip cap is right and stays. What was missing is that
 * *creating a trip row* and *a new holiday starting* are not the same event —
 * see the header for what twenty-five of the former in one afternoon did.
 *
 * `previousTripEndedTs` is `null` when there is no earlier trip at all, which
 * is a first install and unambiguously a new holiday.
 */
export function mayRearmNotifications(
  previousTripEndedTs: number | null,
  now: number,
  rearmAfterMs = NOTIFICATION_REARM_AFTER_MS
): boolean {
  if (previousTripEndedTs === null) {
    return true;
  }
  return now - previousTripEndedTs >= rearmAfterMs;
}

/**
 * What the OS told us about the app's visibility, narrowed to what matters.
 *
 * `unknown` exists because the recorder can be woken with no UI at all, and
 * guessing "active" there is what T-173 is.
 */
export type Visibility = 'active' | 'background' | 'inactive' | 'unknown';

/**
 * May a foreground service be started right now?
 *
 * ⚠ **T-173 — MEASURED, NOT ANTICIPATED.** The P30 logged this at launch:
 *
 *     recording launch sync: Call to function
 *     'ExpoLocation.startLocationUpdatesAsync' has been rejected.
 *     → Caused by: Couldn't start the foreground service. Foreground service
 *       cannot be started when the application is in the background
 *
 * **The recorder did not start**, and CONTEXT §2.4 calls a week of missed
 * recording the one loss that can never be recovered. Android refuses a
 * foreground service started from the background, and `expo-location`'s
 * background updates need one — so the call must not be made unless the app is
 * genuinely on screen.
 *
 * ⚠ `inactive` is refused with `background`. It is the state during a phone
 * call, the app switcher or a permission dialog, and Android's restriction does
 * not care that it looks transient. The recorder simply tries again on the next
 * resume, which costs a second and never costs a trace.
 */
export function mayStartForegroundService(visibility: Visibility): boolean {
  return visibility === 'active';
}
