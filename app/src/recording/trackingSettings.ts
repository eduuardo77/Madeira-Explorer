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
import { parseWalkStarted } from './manualWalk';
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

// ── D-087: a walk, and a pause (T-198) ─────────────────────────────────────
//
// Both are read on the recorder's own paths — `buildOptions` when location
// updates are (re)started, `recordingSink` on every batch — so both are cached
// the way the tier is, and this module is their only writer.

let cachedWalk: boolean | null = null;
let cachedPausedUntil: number | null | undefined;

/** Whether the user has a walk running. Unreadable is `false` (manualWalk.ts). */
export async function getWalkInProgress(): Promise<boolean> {
  if (cachedWalk !== null) {
    return cachedWalk;
  }
  try {
    cachedWalk = parseWalkStarted(
      await appStateDao.get(appStateDao.AppStateKey.WalkStartedByUser)
    );
  } catch {
    return false;
  }
  return cachedWalk;
}

/** When the running walk began, or null. */
export async function getWalkStartedTs(): Promise<number | null> {
  try {
    return parseTimestamp(await appStateDao.get(appStateDao.AppStateKey.WalkStartedTs));
  } catch {
    return null;
  }
}

export async function setWalkInProgress(inProgress: boolean, nowMs: number): Promise<void> {
  cachedWalk = inProgress;
  await appStateDao.set(appStateDao.AppStateKey.WalkStartedByUser, inProgress ? 'true' : 'false');
  await appStateDao.set(appStateDao.AppStateKey.WalkStartedTs, inProgress ? String(nowMs) : '');
}

/** The end of the current pause, or null. A past moment is returned as is; `isPaused` judges it. */
export async function getPausedUntil(): Promise<number | null> {
  if (cachedPausedUntil !== undefined) {
    return cachedPausedUntil;
  }
  try {
    cachedPausedUntil = parseTimestamp(
      await appStateDao.get(appStateDao.AppStateKey.PausedUntil)
    );
  } catch {
    // ⚠ Unreadable is *not paused*. A broken row must never silently stop the
    // recorder storing anything (D-010).
    return null;
  }
  return cachedPausedUntil;
}

export async function setPausedUntil(untilTs: number | null): Promise<void> {
  cachedPausedUntil = untilTs;
  await appStateDao.set(appStateDao.AppStateKey.PausedUntil, untilTs === null ? '' : String(untilTs));
}

function parseTimestamp(raw: string | null): number | null {
  const value = Number((raw ?? '').trim());
  return raw !== null && raw.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Forget everything cached here (T-198). Called after erase-all, which deletes
 * `app_state` underneath these caches.
 *
 * ⚠ Found while adding the walk and pause caches: the tier cache has had this
 * gap since T-146, so an erase kept the user's old tier in memory until the
 * next launch.
 */
export function forgetCachedTrackingSettings(): void {
  cachedQuality = null;
  cachedWalk = null;
  cachedPausedUntil = undefined;
}

