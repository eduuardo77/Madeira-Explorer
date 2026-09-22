/**
 * Starting and stopping a trip — the two halves, kept together (T-145).
 *
 * ⚠ WHY THIS MODULE EXISTS: FOR MONTHS, NO STAMP COULD EVER BE AWARDED
 * -------------------------------------------------------------------
 * Recording locations and monitoring geofences are two separate subsystems, and
 * until 2026-08-14 **nothing in the app ever started the second one.** The only
 * caller of `refreshGeofences` was the debug screen. So on a real phone the
 * sequence was: install, grant permission, press record, walk to a miradouro,
 * and collect nothing — for ever, silently, with a diary full of healthy-looking
 * location batches.
 *
 * Nothing caught it. `geofenceManager` is tested, `geofenceSelection` is tested,
 * the stamp rules are tested, the content pack is tested and `index.ts` really
 * does register the catalogue. Every piece worked; the seam between two of them
 * was never joined. It was invisible on the emulator too, because every session
 * that ever saw a geofence fire had started monitoring by hand from the debug
 * screen — which registers a synthetic fixture, so even then the events carried
 * `dev-near-*` ids rather than real places.
 *
 * The lesson is the one CONTEXT §6.6 keeps making in a different costume: a
 * feature is not finished when its parts pass, it is finished when somebody
 * watches the whole chain run.
 *
 * ⚠ AND WHY IT IS ALSO CALLED ON LAUNCH
 * -------------------------------------
 * **Android drops every registered geofence when the device reboots.** An app
 * that registers once and trusts the OS to remember stops awarding stamps the
 * first time the user restarts their phone, and says nothing about it. Since
 * `startGeofencingAsync` replaces the region set rather than adding to it,
 * re-registering on launch is free of consequence and repairs that case, plus
 * any other way the set can be lost.
 *
 * ⚠ It cannot be repaired by the backstop in `geofenceManager`. That path reads
 * the stored monitoring state and returns immediately when nothing is
 * monitored — correctly, because it exists to notice a *stale* window, not to
 * create the first one.
 *
 * This module is deliberately thin and has no logic of its own to test. What it
 * has is an ordering that must not be split up again, which is why both halves
 * live behind one call.
 */

import { locationProvider } from './ExpoLocationProvider';
import type { SamplingProfile } from './LocationProvider';
import { refreshGeofences, stopGeofences } from './geofenceManager';
import { isBackgroundTrackingAllowed } from './trackingSettings';
import {
  recordingAction,
  shouldRefreshGeofences,
  type Visibility,
} from './recordingAdmission';
import * as recordingEventDao from '../storage/dao/recordingEventDao';

/**
 * Begin recording, and monitor the places around the user.
 *
 * Geofences second: registering regions for a trip that failed to start would
 * award stamps against no trip at all.
 */
export async function startTrip(profile: SamplingProfile): Promise<void> {
  await locationProvider.startRecording(profile);
  await refreshGeofences('recording started');
}

/**
 * Stop both.
 *
 * ⚠ Geofences go too, and that is not tidiness. A crossing delivered while
 * recording is off would be judged against a trip the user believes is not
 * running — a stamp appearing from a walk they chose not to record is a
 * betrayal of the one promise this app makes about its data (D-010).
 */
export async function stopTrip(): Promise<void> {
  await locationProvider.stopRecording();
  await stopGeofences();
}

/**
 * Bring the recorder into line with what the user has allowed. Runs on launch.
 *
 * ⚠ **This is also the fix for a second missing seam.** Onboarding set a flag
 * and stopped; nothing ever started recording for a user who granted Always,
 * and those users are shown no start button at all (design brief §3.3) because
 * the app is supposed to do it for them. So the app's one promise — *your map
 * fills in by itself* (D-002) — was kept by nobody. Same family as T-145, found
 * the same way, one screen along.
 *
 * The three cases, and none of them may be merged:
 *
 *   - **Allowed, granted.** (Re-)assert the recorder. See the warning below for
 *     why this is not conditional on whether it thinks it is already running.
 *   - **Running but not allowed.** Re-register the regions, because Android
 *     drops every geofence when the phone reboots and says nothing.
 *   - **Not allowed, or not granted.** Do nothing at all, and in particular do
 *     not stop anything: the user may be part-way through a walk they started
 *     by hand, and silently ending it would lose the one thing that cannot be
 *     recreated (D-010).
 *
 * ⚠⚠ **T-174 — `isRecording()` IS NOT EVIDENCE THAT ANYTHING IS RUNNING, AND
 * TRUSTING IT LEFT THIS PHONE DEAD FOR THREE WEEKS.** Found on the P30,
 * 2026-09-22, and it is the worst failure this project has had:
 *
 *   - the settings screen said *"A registar a sua viagem"*, switch **on**;
 *   - `dumpsys activity services` had **no foreground service**;
 *   - `dumpsys location` had **no request** from this package;
 *   - the database had not been written to in minutes of being backgrounded.
 *
 * `isRecording()` is `Location.hasStartedLocationUpdatesAsync`, which reports
 * that the **task is registered** — a flag that outlives the service it stands
 * for. When the service dies (an OEM kills it, or T-173's foreground-service
 * refusal fires *after* the task was registered) the flag stays true, this
 * function takes the "already running" branch, and **the recorder is never
 * restarted for the life of the install.** The app then reports itself healthy
 * while recording nothing, which is worse than failing loudly.
 *
 * The repair is to stop asking. `setSamplingProfile` already documents that
 * calling `startLocationUpdatesAsync` again with the same task name **replaces
 * the options in place and does not drop fixes** — so re-asserting is cheap
 * when the service is alive and is the whole fix when it is not.
 *
 * ⚠ Only a manual off-and-on through Settings recovered it, which no user
 * would think to do — nothing tells them anything is wrong except T-049's
 * day-1 check, and that fires once.
 */
export async function syncRecordingWithPreferences(
  visibility: Visibility = 'unknown'
): Promise<void> {
  try {
    const [allowed, permission, recording] = await Promise.all([
      isBackgroundTrackingAllowed(),
      locationProvider.getPermissionLevel(),
      locationProvider.isRecording(),
    ]);

    const action = recordingAction({
      backgroundTrackingAllowed: allowed,
      permission,
      taskRegistered: recording,
      visibility,
    });

    // ⚠ Regions first, and for every action but `none` — including `defer`.
    // Geofencing needs no foreground service, so a launch that cannot start
    // recording can still re-register; not doing so was the first version of
    // this fix and it would have stopped a rebooted phone collecting stamps.
    if (shouldRefreshGeofences(action)) {
      await refreshGeofences('app launch');
    }

    if (action === 'defer') {
      await recordingEventDao.log(
        'start',
        `recording deferred: app is ${visibility}, cannot start a foreground service`
      );
      return;
    }

    if (action === 'assert') {
      // ⚠⚠ T-173 — MEASURED ON REAL HARDWARE, 2026-08-28. This call failed on
      // the P30 with *"Foreground service cannot be started when the
      // application is in the background"*, and **the recorder did not start**
      // — which CONTEXT §2.4 calls the one loss that cannot be recovered.
      //
      // `expo-location`'s background updates need a foreground service, and
      // Android refuses to start one from the background. The app can be woken
      // with no UI at all, so "we are in `useEffect`" is not the same as "we
      // are on screen". Asking is the fix; retrying on the next resume costs a
      // second and never costs a trace.
      // ⚠ T-174: asserted, not conditional. `recording` is only used to say
      // what happened, never to decide whether to act — see above.
      await startTrip('walking');
      await recordingEventDao.log(
        'start',
        recording
          ? 'recording re-asserted on launch: the task was registered'
          : 'recording started automatically: background tracking is on'
      );
    }
  } catch (error) {
    await recordingEventDao.logError('recording launch sync', error);
  }
}

/**
 * The user just moved the background-tracking switch.
 *
 * ⚠ Turning it **off stops recording**, and that is the whole meaning of the
 * switch — leaving the recorder running after the user said "not when the app
 * is closed" would make the setting a decoration. Turning it back on starts
 * again only if the OS permission is there to support it; without Always, the
 * switch cannot deliver what it promises, and the map screen's *Start walk*
 * button is what the user gets instead.
 */
export async function applyBackgroundTrackingChange(
  allowed: boolean
): Promise<void> {
  if (!allowed) {
    await stopTrip();
    await recordingEventDao.log(
      'stop',
      'recording stopped: background tracking turned off'
    );
    return;
  }

  // The user just moved a switch, so the app is unambiguously on screen — which
  // is what T-173's foreground-service gate needs to hear.
  await syncRecordingWithPreferences('active');
}
