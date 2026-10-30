/**
 * Applying the stationary-vs-moving decision (T-034).
 *
 * The arithmetic is in `movementPolicy.ts` and is pure. This is the part that
 * reads the database, talks to the provider and writes the diary — the same
 * split as `geofenceSelection` / `geofenceManager`, and for the same reason: it
 * is what lets the interesting half be tested on a laptop.
 *
 * Called once per batch of fixes, from the background task. Never throws — it
 * runs inside an OS callback, and a failure here must cost a profile change,
 * never a batch of fixes (D-010).
 */

import * as appStateDao from '../storage/dao/appStateDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as tripDao from '../storage/dao/tripDao';
import { locationProvider } from './ExpoLocationProvider';
import type { SamplingProfile } from './LocationProvider';
import type { MovementSample } from './movementPolicy';
import {
  decideProfile,
  MOVING_PROFILE,
  STATIONARY_EDGE_MS,
  STATIONARY_WINDOW_MS,
} from './movementPolicy';
import { SAMPLING_PROFILES } from './samplingPolicy';
import { launchProfile } from './motionWakePolicy';
import { outingAwakeOver } from './recorderControls';
import { getOutingAwakeApplied, readOutingClock } from './trackingSettings';

/**
 * How many recent fixes to look at: enough to span the window and its edge
 * (twelve minutes) at a fix every two seconds, and still a bounded query.
 *
 * ⚠ It was forty, on the belief that the moving profile gives ~20 fixes in ten
 * minutes. The P30 delivers one every ten seconds on the precise tier, so forty
 * reached back under seven minutes and the window could never be covered
 * (2026-10-04). Four short columns a row: a few hundred rows cost nothing.
 */
const WINDOW_FIX_LIMIT = 400;
/** While stationary: the newest few, enough for the window and the fix before it. */
const STATIONARY_FIX_LIMIT = 40;

/**
 * The profile we believe the provider is currently using.
 *
 * Persisted because the process is killed and relaunched constantly, and
 * memoised because this module is its only writer — after the first read of a
 * process, the database cannot know anything we do not. Getting it wrong is
 * cheap in one direction (a redundant `setSamplingProfile` call) and expensive
 * in the other (thinking we are on the moving profile when the OS has us on the
 * cheap one), so it is written before it is trusted.
 */
let cachedProfile: SamplingProfile | null = null;

async function readCurrentProfile(): Promise<SamplingProfile> {
  if (cachedProfile !== null) {
    return cachedProfile;
  }

  const stored = await appStateDao.get(appStateDao.AppStateKey.SamplingProfile);
  // Membership is checked against the profile table rather than a list of
  // string literals, so adding a fourth profile cannot leave this line quietly
  // refusing to read it back and resetting every relaunch to the default.
  // ⚠ N15, found on the P30 2026-10-27: a read begun before a write and
  // finished after it must not undo the write. At launch the motion wake
  // started this read on an empty cache, the launch then wrote *stationary*,
  // and the late read put the stale *driving* back: the recorder was
  // re-asserted on driving one second after the diary said stationary.
  if (cachedProfile !== null) {
    return cachedProfile;
  }
  cachedProfile =
    stored !== null && stored in SAMPLING_PROFILES
      ? (stored as SamplingProfile)
      : // Nothing recorded yet: assume moving. Assuming stationary would start
        // every fresh install on the cheap profile, which is exactly wrong —
        // a fresh install is somebody who has just landed.
        MOVING_PROFILE;
  return cachedProfile;
}

async function writeCurrentProfile(profile: SamplingProfile): Promise<void> {
  cachedProfile = profile;
  await appStateDao.set(appStateDao.AppStateKey.SamplingProfile, profile);
}

/**
 * Look at the last few minutes of fixes and adjust the sampling profile.
 *
 * `now` is injected so the caller can pass the batch's own timestamp rather
 * than wall-clock, which matters when the OS hands us a batch it has been
 * sitting on for several minutes.
 */
export async function applySamplingGate(now: number, wallNowMs: number = Date.now()): Promise<void> {
  try {
    // Three independent questions, so three round-trips in parallel rather than
    // in series. One of them crosses the native bridge, which is the expensive
    // one, and this runs on every OS wake-up for a week.
    const [recording, trip, current] = await Promise.all([
      locationProvider.isRecording(),
      tripDao.getActiveTrip(),
      readCurrentProfile(),
    ]);

    if (!recording) {
      // Not recording at all. Changing the profile would restart location
      // updates behind the user's back — on While-Using that would be a
      // straightforward bug (D-008).
      return;
    }
    if (trip === null) {
      return;
    }

    // Only the window the policy will actually consider, and only the four
    // columns it reads. `getRecentFixes` would return every column of the last
    // forty rows, most of which fall outside the window on the cheap profile
    // and are discarded in JavaScript.
    // While stationary, the newest fixes whatever their age: the last one at
    // home is usually older than the window, and it is the one that shows the
    // phone has left (`decideProfile`, F1).
    const samples: MovementSample[] = await rawFixDao.getMovementWindow(
      trip.id,
      current === 'stationary' ? 0 : now - STATIONARY_WINDOW_MS - STATIONARY_EDGE_MS,
      current === 'stationary' ? STATIONARY_FIX_LIMIT : WINDOW_FIX_LIMIT
    );

    // When the current profile was entered: out of stationary, stillness only
    // counts from then (`decideProfile`, D-106).
    const since = await appStateDao.getUpdatedTs(appStateDao.AppStateKey.SamplingProfile);
    const decision = decideProfile(current, samples, now, since ?? undefined, wallNowMs);

    if (!decision.changed) {
      // T-285: an outing started standing still keeps the gate on
      // `stationary` throughout, so its awake window has to be closed here,
      // by re-applying the same profile, or the GPS would stay on.
      if (
        outingAwakeOver(current, await readOutingClock(Date.now()), await getOutingAwakeApplied())
      ) {
        await locationProvider.setSamplingProfile(current);
        await recordingEventDao.log('outing', 'outing awake window over: sleeping at stops again');
      }
      return;
    }

    // Write the intent before acting on it. If the process dies between the
    // two, the next wake-up re-derives the same decision from the same fixes
    // and applies it again — harmless. The other order could leave the stored
    // profile permanently disagreeing with the OS.
    await writeCurrentProfile(decision.profile);
    try {
      await locationProvider.setSamplingProfile(decision.profile);
    } catch (error) {
      // ⚠ Refused, so the OS is still on `current`: say so, or the gate sees
      // "no change" from now on and never retries. Found 2026-10-04: a refusal
      // at 12:13 on a ride left the stored profile disagreeing with the OS
      // until the app was next opened.
      await writeCurrentProfile(current);
      throw error;
    }

    await recordingEventDao.log(
      'start',
      `profile ${current} -> ${decision.profile}: ${decision.reason}`
    );
  } catch (error) {
    await recordingEventDao.logError('sampling gate', error);
  }
}

/**
 * Raise the profile on the motion sensors' word alone (D-106): walking to
 * driving when Google says in a vehicle, without waiting for the walking
 * profile's next batch. On 17 Oct 2026 a five-minute drive at up to 76 km/h
 * was sampled at the walking rate throughout, because the batch that showed
 * the speed came after it. Only ever to a denser profile, as everywhere the
 * label is used (D-094).
 */
export async function raiseProfile(to: SamplingProfile, reason: string): Promise<void> {
  try {
    const current = await readCurrentProfile();
    if (current === to || current === 'stationary' || to !== 'driving') {
      return;
    }
    await writeCurrentProfile(to);
    try {
      await locationProvider.setSamplingProfile(to);
    } catch (error) {
      await writeCurrentProfile(current);
      throw error;
    }
    await recordingEventDao.log('start', `profile ${current} -> ${to}: ${reason}`);
  } catch (error) {
    await recordingEventDao.logError('sampling gate', error);
  }
}

/**
 * Drop a moving profile to stationary on the still check's word (T-286),
 * for the stop the gate cannot see: on *driving* no fix passes the 50 m filter
 * while still, so `applySamplingGate` never runs. An outing's awake window
 * still holds, because the provider applies it to every profile (T-285).
 */
export async function lowerProfile(reason: string): Promise<void> {
  try {
    const current = await readCurrentProfile();
    if (current === 'stationary') {
      return;
    }
    await writeCurrentProfile('stationary');
    try {
      await locationProvider.setSamplingProfile('stationary');
    } catch (error) {
      await writeCurrentProfile(current);
      throw error;
    }
    await recordingEventDao.log('start', `profile ${current} -> stationary: ${reason}`);
  } catch (error) {
    await recordingEventDao.logError('sampling gate', error);
  }
}

/**
 * N15: before the launch re-asserts the recorder, drop a stored moving
 * profile to stationary unless a fix in the last five minutes says the phone
 * is moving now (`launchProfile`). Returns the profile to start on.
 */
export async function settleLaunchProfile(nowMs: number): Promise<SamplingProfile> {
  try {
    const raw = await appStateDao.get(appStateDao.AppStateKey.SamplingProfile);
    const stored = raw !== null && raw in SAMPLING_PROFILES ? (raw as SamplingProfile) : null;
    const trip = await tripDao.getActiveTrip();
    const lastFix = trip === null ? null : await rawFixDao.getLastFix(trip.id);
    const decision = launchProfile(stored, lastFix?.ts ?? null, nowMs);
    if (stored !== null && decision.profile !== null) {
      await writeCurrentProfile(decision.profile);
      await recordingEventDao.log('start', `profile ${stored} -> ${decision.profile}: ${decision.reason}`);
    }
  } catch (error) {
    await recordingEventDao.logError('sampling gate', error);
  }
  return getCurrentSamplingProfile();
}

/** For the debug screen: what the gate thinks it has set. */
export async function getCurrentSamplingProfile(): Promise<SamplingProfile> {
  try {
    return await readCurrentProfile();
  } catch {
    return MOVING_PROFILE;
  }
}

// ---------------------------------------------------------------------------
// ⚠ THE KNOWN HOLE IN ALL OF THIS, and it is not fixable from this file.
//
// The stationary profile sets `pausesUpdatesAutomatically`, so iOS may stop
// location updates entirely once it agrees the user has stopped — and
// historically it does not resume until a significant location change. If that
// happens: no fix arrives, so this gate never runs, so the profile never leaves
// `stationary`. The gate can put the recorder to sleep and cannot wake it.
//
// The recovery paths are the ones the architecture already leans on: region
// monitoring and significant-location-change relaunch (D-005, T-047), and the
// day-1 health check (T-049). None of them has been tested.
//
// This is the specific thing to watch in the 72-hour soak (T-051). It is noted
// here as well as in `ExpoLocationProvider.ts` because this file is what makes
// the stationary profile reachable automatically for the first time — before
// T-034, nothing ever selected it.
// ---------------------------------------------------------------------------
