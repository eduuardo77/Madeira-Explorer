/**
 * Reading and writing the tracking preferences (T-146).
 *
 * The impure half of `trackingPreference.ts`, which holds the parsing and is
 * tested without a device. This file is the seam to
 * `app_state` and has no decisions in it, deliberately — everything here is a
 * read, a parse, or a write.
 *
 * The recording tier that was cached here went with D-108 (one way of recording).
 */

import * as appStateDao from '../storage/dao/appStateDao';
import { parseWalkStarted } from './manualWalk';
import type { OutingClock } from './recorderControls';
import { DEFAULT_BACKGROUND_TRACKING, parseBackgroundTracking } from './trackingPreference';

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

/** The outing as `effectiveProfile` reads it (T-285). */
export async function readOutingClock(nowMs: number): Promise<OutingClock> {
  const inProgress = await getWalkInProgress();
  return { inProgress, startedTs: inProgress ? await getWalkStartedTs() : null, nowMs };
}

/**
 * Whether the options last applied were the outing's awake ones (T-285).
 * Stored, because the process that applied them is often not the one whose
 * batch finds the window closed. Unreadable is `true`: the cost of that is
 * one redundant re-apply, and the cost of `false` is the GPS left on.
 */
export async function getOutingAwakeApplied(): Promise<boolean> {
  try {
    return (await appStateDao.get(appStateDao.AppStateKey.OutingAwakeApplied)) !== 'false';
  } catch {
    return true;
  }
}

export async function setOutingAwakeApplied(applied: boolean): Promise<void> {
  await appStateDao.set(appStateDao.AppStateKey.OutingAwakeApplied, applied ? 'true' : 'false');
}

function parseTimestamp(raw: string | null): number | null {
  const value = Number((raw ?? '').trim());
  return raw !== null && raw.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Forget everything cached here (T-198). Called after erase-all, which deletes
 * `app_state` underneath these caches.
 */
export function forgetCachedTrackingSettings(): void {
  cachedWalk = null;
}

