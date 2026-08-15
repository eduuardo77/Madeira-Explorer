/**
 * Reading and writing the tracking preferences (T-146).
 *
 * The impure half of `trackingPreference.ts`, which holds the parsing and the
 * tier arithmetic and is tested without a device. This file is the seam to
 * `app_state` and has no decisions in it, deliberately — everything here is a
 * read, a parse, or a write.
 *
 * ⚠ The tier is memoised. `buildOptions` needs it on the path that starts
 * location updates, which runs inside an OS callback, and a database read there
 * costs part of an execution budget that `samplingGate` already documents as
 * tight. This module is the only writer, so the cache cannot go stale behind
 * its own back — the same argument, and the same shape, as the profile cache in
 * `samplingGate.ts`.
 */

import * as appStateDao from '../storage/dao/appStateDao';
import {
  DEFAULT_BACKGROUND_TRACKING,
  DEFAULT_TRACKING_QUALITY,
  parseBackgroundTracking,
  parseTrackingQuality,
  type TrackingQuality,
} from './trackingPreference';

let cachedQuality: TrackingQuality | null = null;

export async function getTrackingQuality(): Promise<TrackingQuality> {
  if (cachedQuality !== null) {
    return cachedQuality;
  }

  try {
    cachedQuality = parseTrackingQuality(
      await appStateDao.get(appStateDao.AppStateKey.TrackingQuality)
    );
  } catch {
    // ⚠ Never fail the caller. This is read while starting location updates,
    // and a database hiccup must cost the user their preference for one
    // session, never the recording itself (D-010).
    return DEFAULT_TRACKING_QUALITY;
  }

  return cachedQuality;
}

export async function setTrackingQuality(quality: TrackingQuality): Promise<void> {
  cachedQuality = quality;
  await appStateDao.set(appStateDao.AppStateKey.TrackingQuality, quality);
}

export async function isBackgroundTrackingAllowed(): Promise<boolean> {
  try {
    return parseBackgroundTracking(
      await appStateDao.get(appStateDao.AppStateKey.BackgroundTracking)
    );
  } catch {
    return DEFAULT_BACKGROUND_TRACKING;
  }
}

export async function setBackgroundTrackingAllowed(
  allowed: boolean
): Promise<void> {
  // Written as an explicit `true`/`false` string rather than by omission, so
  // that "the user turned this off" is distinguishable from "nobody has ever
  // answered" — `parseBackgroundTracking` relies on exactly that difference.
  await appStateDao.set(
    appStateDao.AppStateKey.BackgroundTracking,
    allowed ? 'true' : 'false'
  );
}
