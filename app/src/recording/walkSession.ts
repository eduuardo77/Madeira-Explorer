/**
 * An outing, a pause and the recorder's state, as the home screen uses them
 * (D-087, T-198).
 *
 * The impure half of `recorderControls.ts`, which holds every decision and is
 * tested without a device. This file reads the world, calls those decisions,
 * and acts, and nothing else. The split is the project's convention
 * (`stampRules`/`stampAwards`, `movementPolicy`/`samplingGate`).
 *
 * ⚠ **A walk changes the recorder by re-applying its options in place.**
 * `setSamplingProfile` with the current profile replaces the options without
 * dropping fixes (ExpoLocationProvider), and `buildOptions` reads the walk
 * flag. It never stops and restarts a running recorder: that would close the
 * open trip and open another, splitting one outing into two rows (D-010).
 */

import { getContentPack } from '../content/poiCatalogue';
import { deviceLanguage } from '../i18n';
import { MAX_DRAWN_ACCURACY_M } from '../map/traceGeoJson';
import { runAwardPass } from '../progress/stampAwards';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import { locationProvider } from './ExpoLocationProvider';
import { actionForStartWalk, actionForStopWalk, type WalkState } from './manualWalk';
import {
  describeWalkSummary,
  walkSummary,
  type ControlInput,
} from './recorderControls';
import { assessSilence } from './recorderSilence';
import { getCurrentSamplingProfile } from './samplingGate';
import {
  getPausedUntil,
  getWalkInProgress,
  getWalkStartedTs,
  isBackgroundTrackingAllowed,
  setPausedUntil,
  setWalkInProgress,
} from './trackingSettings';
import { startTrip, stopTrip, syncRecordingWithPreferences } from './tripRecording';

/** How long "Pause for an hour" pauses. ⚠ Provisional (D-087 left the lengths open). */
export const PAUSE_MS = 60 * 60 * 1000;

/**
 * Everything `recorderControls` needs, read from evidence (T-174).
 *
 * Cheap on purpose: the map asks every few seconds, so this is five small reads
 * and not `getRecorderHealth`, which runs a dozen queries for the debug screen.
 */
export async function readControlInput(
  nowMs: number
): Promise<{ input: ControlInput; silentForMs: number | null }> {
  const [permission, automaticAllowed, walkInProgress, pausedUntilTs, isRecording, profile, lastStart, trip] =
    await Promise.all([
      locationProvider.getPermissionLevel(),
      isBackgroundTrackingAllowed(),
      getWalkInProgress(),
      getPausedUntil(),
      locationProvider.isRecording(),
      getCurrentSamplingProfile(),
      recordingEventDao.getLastOfKind('start'),
      tripDao.getActiveTrip(),
    ]);
  const lastFix = trip === null ? null : await rawFixDao.getLastFix(trip.id);

  const silence = assessSilence({
    isRecording,
    permission,
    profile,
    recordingSinceTs: lastStart?.ts ?? null,
    lastFixTs: lastFix?.ts ?? null,
    now: nowMs,
  });
  return {
    input: {
      permission,
      automaticAllowed,
      walkInProgress,
      pausedUntilTs,
      silence: silence.state,
      nowMs,
    },
    silentForMs: silence.silentForMs,
  };
}

/** Is automatic recording actually live: allowed **and** granted (T-146)? */
async function isBackgroundRecordingLive(): Promise<boolean> {
  const [allowed, permission] = await Promise.all([
    isBackgroundTrackingAllowed(),
    locationProvider.getPermissionLevel(),
  ]);
  return allowed && permission === 'always';
}

async function walkState(startedByUser: boolean): Promise<WalkState> {
  return {
    startedByUser,
    recorderRunning: await locationProvider.isRecording(),
    backgroundRecording: await isBackgroundRecordingLive(),
  };
}

/** Re-apply the recorder's options in place, so the walk flag takes effect. */
async function retune(): Promise<void> {
  await locationProvider.setSamplingProfile(await getCurrentSamplingProfile());
}

/** The user pressed *Começar passeio*. */
export async function startOuting(nowMs: number): Promise<void> {
  const action = actionForStartWalk(await walkState(false));
  // The flag first: `buildOptions` reads it, whichever branch runs below.
  await setWalkInProgress(true, nowMs);
  if (action === 'start') {
    // `startTrip`, never the provider directly: the geofences have to be
    // registered in the same breath, and for months they were not (T-145).
    await startTrip('walking');
  } else if (action === 'retune') {
    await retune();
  }
  await recordingEventDao.log('outing', `outing started (${action})`);
}

/**
 * The user pressed *Terminar passeio*. Returns the summary, in words.
 *
 * ⚠ The award pass runs first, so a stamp earned on the way is in the summary
 * rather than turning up in the passport later. The reveal does the same (T-101).
 */
export async function endOuting(nowMs: number): Promise<{ title: string; lines: string[] }> {
  const startedTs = (await getWalkStartedTs()) ?? nowMs;
  await runAwardPass(nowMs);

  const trip = (await tripDao.getActiveTrip()) ?? (await tripDao.getMostRecentTrip());
  const fixes = trip === null ? [] : await rawFixDao.getTraceFixes(trip.id);
  const awards = trip === null ? [] : await stampAwardDao.getAwards(trip.id);
  const summary = walkSummary({
    startTs: startedTs,
    endTs: nowMs,
    fixes,
    awards: awards.map((award) => ({ placeId: award.place_id, awardedTs: award.awarded_ts })),
    maxAccuracyM: MAX_DRAWN_ACCURACY_M,
  });

  const action = actionForStopWalk(await walkState(true));
  await setWalkInProgress(false, nowMs);
  if (action === 'stop') {
    await stopTrip();
  } else if (action === 'retune') {
    // Automatic recording carries on at the user's own tier (D-087 §2).
    await retune();
  }
  await recordingEventDao.log('outing', `outing ended (${action})`);

  const names = new Map(getContentPack().places.map((place) => [place.id, place.name]));
  return describeWalkSummary(summary, names, deviceLanguage());
}

/** Pause automatic recording for `PAUSE_MS` from now. Nothing is stored meanwhile. */
export async function pauseRecording(nowMs: number): Promise<number> {
  const until = nowMs + PAUSE_MS;
  await setPausedUntil(until);
  await recordingEventDao.log('outing', `paused until ${new Date(until).toISOString()}`);
  return until;
}

export async function resumeRecording(): Promise<void> {
  await setPausedUntil(null);
  await recordingEventDao.log('outing', 'pause ended by the user');
}

/**
 * *Reiniciar o registo* on the silence notice (T-174).
 *
 * Re-asserting is cheap when the service is alive and is the whole repair when
 * it is not: the same call the app makes on every launch.
 */
export async function restartRecording(): Promise<void> {
  await syncRecordingWithPreferences('active');
  await recordingEventDao.log('outing', 'restarted from the silence notice');
}
