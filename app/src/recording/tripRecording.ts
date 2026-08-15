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
 * On launch: if the recorder is running, make sure the OS is still monitoring.
 *
 * Silent when recording is off — there is nothing to repair, and registering
 * regions for a user who has not started would collect stamps behind their
 * back. Failures are written to the diary rather than raised: this runs beside
 * the health check on a screen that has other things to do, and a phone that
 * cannot register regions is a fact to be recorded, not a modal.
 */
export async function ensureGeofencesIfRecording(): Promise<void> {
  try {
    if (!(await locationProvider.isRecording())) {
      return;
    }
    await refreshGeofences('app launch');
  } catch (error) {
    await recordingEventDao.logError('geofence launch check', error);
  }
}
