/**
 * The hidden island's gate, from the database (T-067a, D-024, D-107).
 *
 * The rules are `islandGate.ts`, pure and tested. This keeps the permanent flag
 * in `app_state`, sets it from recorded fixes, and answers the screens.
 *
 * Two ways in, so arrival is never missed:
 *   1. `noteFixes`, from the recorder, on every batch it stores.
 *   2. A one-off scan of the fixes already stored, the first time anything asks
 *      while an island is still hidden. It covers fixes stored before this
 *      code existed, and any batch whose check failed.
 *
 * ⚠ Never throws into the recorder. A failed check costs the island one more
 * batch's wait; a thrown error would cost the batch.
 */

import { getContentPack } from '../content/poiCatalogue';
import { getRegions } from '../content/regionCatalogue';
import * as appStateDao from '../storage/dao/appStateDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import {
  ARRIVAL_ACCURACY_M,
  islandOutlines,
  islandsReached,
  lockedRegionIds,
  outlinesBox,
  paidOnlyPlaceIds,
  parseVisited,
  pendingIslands,
  serialiseVisited,
  visiblePlaces,
  visitedIslandNames,
  type GateFix,
} from './islandGate';

/** Held after the first read: the flag only ever grows, and only here. */
let visited: Set<string> | null = null;
/** The stored-fix scan runs once per process. */
let scanned = false;

function hiddenIslands(): string[] {
  return getContentPack().hiddenIslands;
}

async function readVisited(): Promise<Set<string>> {
  if (visited === null) {
    visited = parseVisited(await appStateDao.get(appStateDao.AppStateKey.PortoSantoUnlocked));
  }
  return visited;
}

async function markVisited(islandIds: readonly string[]): Promise<void> {
  const next = new Set(await readVisited());
  for (const id of islandIds) next.add(id);
  await appStateDao.set(appStateDao.AppStateKey.PortoSantoUnlocked, serialiseVisited(next));
  visited = next;
}

/** The one-off scan of stored fixes, for every island still hidden. */
async function scanStoredFixes(): Promise<void> {
  if (scanned) return;
  scanned = true;
  const pending = pendingIslands(hiddenIslands(), await readVisited());
  if (pending.length === 0) return;
  const regions = getRegions();
  const reached: string[] = [];
  for (const islandId of pending) {
    const box = outlinesBox(islandOutlines(regions, islandId));
    if (box === null) continue;
    const fixes = await rawFixDao.getFixesInBox(box, ARRIVAL_ACCURACY_M);
    if (islandsReached(fixes, regions, [islandId]).length > 0) reached.push(islandId);
  }
  if (reached.length > 0) {
    await markVisited(reached);
    await recordingEventDao.log('island', `${reached.join(', ')} opened from stored fixes`);
  }
}

/** The hidden islands the user has been to, after the stored-fix scan. */
export async function getVisitedIslands(): Promise<Set<string>> {
  try {
    await scanStoredFixes();
  } catch (error) {
    // Let the next process try again.
    scanned = false;
    await recordingEventDao.logError('island scan', error);
  }
  return readVisited();
}

/**
 * The recorder's check, on each batch it stored. Cheap when nothing is hidden
 * or everything has been visited: no geometry is touched.
 */
export async function noteFixes(fixes: readonly GateFix[]): Promise<void> {
  try {
    const pending = pendingIslands(hiddenIslands(), await readVisited());
    if (pending.length === 0) return;
    const reached = islandsReached(fixes, getRegions(), pending);
    if (reached.length > 0) {
      await markVisited(reached);
      await recordingEventDao.log('island', `${reached.join(', ')} opened from a recorded fix`);
    }
  } catch (error) {
    await recordingEventDao.logError('island arrival', error);
  }
}

/** The regions hidden right now (D-024): those on a hidden island not yet visited. */
export async function getLockedRegionIds(): Promise<Set<string>> {
  return lockedRegionIds(getRegions(), hiddenIslands(), await getVisitedIslands());
}

/**
 * The same, from what has been read so far, for a screen that must answer at
 * once. Before the first read it hides every hidden island: showing one the
 * user has not been to cannot be taken back, a moment's delay can.
 */
export function lockedRegionIdsNow(): Set<string> {
  return lockedRegionIds(getRegions(), hiddenIslands(), visited ?? new Set());
}

/** The pack's places outside locked regions, from what has been read so far. */
export function visiblePlacesNow() {
  return visiblePlaces(getContentPack().places, lockedRegionIdsNow());
}

/** Places whose stamps are paid only (D-107 point 3). Content alone decides. */
export function getPaidOnlyPlaceIds(): Set<string> {
  return paidOnlyPlaceIds(getContentPack().places, getRegions(), hiddenIslands());
}

/** The hidden islands the user has been to, by name, for the paywall (D-107 point 4). */
export async function getVisitedIslandNames(): Promise<string[]> {
  return visitedIslandNames(getRegions(), hiddenIslands(), await getVisitedIslands());
}
