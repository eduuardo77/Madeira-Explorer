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
  STATIONARY_WINDOW_MS,
} from './movementPolicy';
import { SAMPLING_PROFILES } from './samplingPolicy';

/**
 * How many recent fixes to look at.
 *
 * The window is ten minutes. On the moving profile that is at most ~20 fixes;
 * on the stationary profile, two or three. Forty is comfortably more than
 * enough and bounds the query, which matters because this runs on every wake-up
 * and the OS is timing us.
 */
const WINDOW_FIX_LIMIT = 40;

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
export async function applySamplingGate(now: number): Promise<void> {
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
    const samples: MovementSample[] = await rawFixDao.getMovementWindow(
      trip.id,
      now - STATIONARY_WINDOW_MS,
      WINDOW_FIX_LIMIT
    );

    const decision = decideProfile(current, samples, now);

    if (!decision.changed) {
      return;
    }

    // Write the intent before acting on it. If the process dies between the
    // two, the next wake-up re-derives the same decision from the same fixes
    // and applies it again — harmless. The other order could leave the stored
    // profile permanently disagreeing with the OS.
    await writeCurrentProfile(decision.profile);
    await locationProvider.setSamplingProfile(decision.profile);

    await recordingEventDao.log(
      'start',
      `profile ${current} -> ${decision.profile}: ${decision.reason}`
    );
  } catch (error) {
    await recordingEventDao.logError('sampling gate', error);
  }
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
