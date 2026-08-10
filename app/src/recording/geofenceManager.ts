/**
 * The dynamic geofence manager (T-039) — the moving half of the backbone.
 *
 * WHY THIS IS THE MOST IMPORTANT FILE IN PHASE 1
 * ---------------------------------------------
 * Stamps are the score (D-002), stamps come from geofences (D-005), and after
 * the v1 scope cut (D-032) that is very nearly the whole product. Geofences are
 * also the only mechanism that survives the user force-quitting the app on iOS,
 * which is the normal case for us rather than the exception. If this file is
 * wrong, the user walks a famous levada and gets nothing — the failure D-032
 * names as an uninstall trigger.
 *
 * WHAT IT DOES
 * ------------
 * The OS will monitor 20 regions at a time on iOS; the content pack holds
 * 150–250 places (T-066). So this module keeps a *window* over the catalogue:
 * the nearest 19 places, plus an anchor region that fires when the user has
 * travelled far enough for that window to be stale. `geofenceSelection.ts`
 * decides what is in the window and is pure; this file is the part that talks
 * to the OS, the database and the clock.
 *
 * IT HAS TO WORK WITH NO UI ALIVE
 * -------------------------------
 * A rebuild is usually triggered by a geofence event delivered to a headless
 * process — no React tree, no screen, possibly no user-visible app at all since
 * the day they installed it. Everything here is therefore module-level state
 * plus SQLite, and the catalogue is registered at module scope by `index.ts`.
 * Nothing may depend on a component having mounted.
 *
 * IT MUST NOT THROW
 * -----------------
 * Same rule as `recordingSink.ts`: this is called from OS callbacks. Failures
 * are written to the recording diary and swallowed. In particular, a failure
 * NEVER clears the regions already being monitored — a stale monitored set
 * still awards stamps, an empty one awards nothing.
 */

import * as appStateDao from '../storage/dao/appStateDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as tripDao from '../storage/dao/tripDao';
import type { Coordinate } from './distance';
import { distanceM } from './distance';
import { locationProvider } from './ExpoLocationProvider';
import type { Anchor, GeofencePlace } from './geofenceSelection';
import {
  selectionOptionsFor,
  selectWorkingSet,
  shouldRebuild,
} from './geofenceSelection';

/**
 * Where the catalogue of places comes from.
 *
 * A function rather than a value because the content pack is loaded lazily, and
 * an interface seam rather than a direct import because no Madeira knowledge is
 * allowed inside `app/` (D-017). Today `index.ts` registers the development
 * fixture; T-040 replaces that one line with the real content pack.
 *
 * ⚠ It must THROW on failure, never return an empty array. An empty catalogue
 * is taken at face value and stops geofencing — which is right for "there is
 * nothing to monitor" and catastrophic for "the file failed to load".
 */
export type PoiCatalogueSource = () => Promise<GeofencePlace[]>;

let catalogueSource: PoiCatalogueSource | null = null;

export function setPoiCatalogue(source: PoiCatalogueSource): void {
  catalogueSource = source;
}

/**
 * How stale the OS's cached position may be before we stop trusting it to
 * choose which places to monitor.
 *
 * Ten minutes is generous, and deliberately so: at worst we build the window
 * around where the user was ten minutes ago, and the anchor margin
 * (`ANCHOR_MARGIN_M`) already exists to absorb exactly that kind of lag. The
 * alternative — requesting a fresh fix — would turn housekeeping into a GNSS
 * acquisition, which the battery budget does not allow (CONTEXT §6.3).
 */
const MAX_CACHED_POSITION_AGE_MS = 10 * 60 * 1000;

/**
 * Floor on how often the *backstop* may rebuild the set. The anchor's own exit
 * event ignores this — that one is the real signal and is always acted on.
 */
const MIN_BACKSTOP_INTERVAL_MS = 60 * 1000;

/** What we remember about the current window, across headless relaunches. */
type StoredState = {
  anchor: Anchor | null;
  monitoredPoiIds: string[];
  unmonitoredCount: number;
  anchorCoversUnmonitored: boolean;
  updatedTs: number;
};

let cachedState: StoredState | null = null;
let stateLoaded = false;

async function readState(): Promise<StoredState | null> {
  if (stateLoaded) {
    return cachedState;
  }

  const raw = await appStateDao.get(appStateDao.AppStateKey.GeofenceWorkingSet);
  cachedState = raw === null ? null : parseState(raw);
  stateLoaded = true;
  return cachedState;
}

function parseState(raw: string): StoredState | null {
  try {
    // Written by us, one version of us ago. Treat it as untrusted anyway: a
    // parse failure here must degrade to "rebuild from scratch", not crash the
    // recorder on launch.
    return JSON.parse(raw) as StoredState;
  } catch {
    return null;
  }
}

async function writeState(state: StoredState): Promise<void> {
  cachedState = state;
  stateLoaded = true;
  await appStateDao.set(
    appStateDao.AppStateKey.GeofenceWorkingSet,
    JSON.stringify(state)
  );
}

/**
 * Geofence work runs one piece at a time.
 *
 * Two rebuilds can genuinely be in flight at once — the OS delivers an anchor
 * exit while a location batch is already being processed — and both end in
 * `startGeofencing`, which replaces the whole region set. Interleaved, the
 * older one could win. Chaining them is cruder than a lock and needs no
 * lock: there is never enough of this work to queue up.
 */
let pending: Promise<void> = Promise.resolve();

function serialise(work: () => Promise<void>): Promise<void> {
  const next = pending.then(work);
  // A failure must not poison the chain for the rest of the process's life.
  pending = next.catch(() => undefined);
  return pending;
}

/**
 * Where are we, cheaply?
 *
 * Two sources, both free. The OS's cache first; our own last recorded fix
 * second, which covers the case where the OS has nothing but we have been
 * recording all afternoon. If neither answers we give up for now rather than
 * powering up the GNSS chip — the next batch of fixes will trigger the backstop
 * and repair it.
 */
async function currentPosition(): Promise<Coordinate | null> {
  try {
    const cached = await locationProvider.getLastKnownPosition(
      MAX_CACHED_POSITION_AGE_MS
    );
    if (cached !== null) {
      return { lat: cached.lat, lon: cached.lon };
    }
  } catch (error) {
    await logError('getLastKnownPosition', error);
  }

  try {
    const trip = await tripDao.getActiveTrip();
    if (trip === null) {
      return null;
    }
    const fix = await rawFixDao.getLastFix(trip.id);
    return fix === null ? null : { lat: fix.lat, lon: fix.lon };
  } catch (error) {
    await logError('last recorded fix', error);
    return null;
  }
}

/**
 * Rebuild the monitored set around `from`.
 *
 * The only place that calls `startGeofencing`. Never throws.
 */
async function rebuildAround(from: Coordinate, reason: string): Promise<void> {
  if (catalogueSource === null) {
    // Registered at module scope by index.ts, so this means the bundle did not
    // finish loading before an event arrived — or somebody removed that import.
    await recordingEventDao.log(
      'error',
      'geofence rebuild skipped: no POI catalogue registered (T-040)'
    );
    return;
  }

  try {
    const catalogue = await catalogueSource();

    if (catalogue.length === 0) {
      await locationProvider.stopGeofencing();
      await writeState({
        anchor: null,
        monitoredPoiIds: [],
        unmonitoredCount: 0,
        anchorCoversUnmonitored: true,
        updatedTs: Date.now(),
      });
      await recordingEventDao.log(
        'geofence',
        `no places in the catalogue; monitoring nothing (${reason})`
      );
      return;
    }

    const set = selectWorkingSet(
      catalogue,
      from,
      selectionOptionsFor(locationProvider.maxSimultaneousRegions)
    );

    // Warn, but still try. iOS will not monitor regions in the background
    // without Always, and a field test run on While-Using would otherwise fail
    // with an opaque platform error and cost somebody an afternoon. Android
    // does monitor while the app is in the foreground, which is worth having,
    // and D-008 forbids treating While-Using as broken.
    const permission = await locationProvider.getPermissionLevel();
    if (permission !== 'always') {
      await recordingEventDao.log(
        'geofence',
        `permission is "${permission}" — iOS monitors regions in the background only with Always (D-008, T-043)`
      );
    }

    await locationProvider.startGeofencing(set.regions);

    await writeState({
      anchor: set.anchor,
      monitoredPoiIds: set.monitored.map((place) => place.poiId),
      unmonitoredCount: set.unmonitoredCount,
      anchorCoversUnmonitored: set.anchorCoversUnmonitored,
      updatedTs: Date.now(),
    });

    const anchorNote =
      set.anchor === null
        ? 'whole catalogue fits, no anchor'
        : `anchor ${Math.round(set.anchor.radiusM)}m`;

    await recordingEventDao.log(
      'geofence',
      `watching ${set.monitored.length}, ${set.unmonitoredCount} out of range, ${anchorNote} (${reason})`
    );

    // Both of these are quiet correctness problems that would otherwise only
    // surface as a stamp that never arrived, weeks later, on someone's holiday.
    if (!set.anchorCoversUnmonitored) {
      await recordingEventDao.log(
        'geofence',
        'anchor clamped to its minimum: denser cluster than the region cap allows'
      );
    }
    if (set.invalidCount > 0) {
      await recordingEventDao.log(
        'error',
        `${set.invalidCount} catalogue entries have unusable coordinates`
      );
    }
  } catch (error) {
    // Note what is NOT here: any attempt to clear the regions. Whatever the OS
    // is monitoring from the last successful rebuild stays monitored.
    await logError(`rebuild (${reason})`, error);
  }
}

/**
 * Start monitoring, or rebuild the window around wherever we are now.
 *
 * Safe to call repeatedly — `startGeofencingAsync` replaces the region set
 * rather than adding to it, so this is idempotent by construction.
 */
export function refreshGeofences(reason: string): Promise<void> {
  return serialise(async () => {
    const from = await currentPosition();
    if (from === null) {
      await recordingEventDao.log(
        'geofence',
        `rebuild deferred: no position available yet (${reason})`
      );
      return;
    }
    await rebuildAround(from, reason);
  });
}

/** Stop monitoring entirely. Used by the debug screen and by trip end (T-099). */
export function stopGeofences(): Promise<void> {
  return serialise(async () => {
    try {
      await locationProvider.stopGeofencing();
      await writeState({
        anchor: null,
        monitoredPoiIds: [],
        unmonitoredCount: 0,
        anchorCoversUnmonitored: true,
        updatedTs: Date.now(),
      });
      await recordingEventDao.log('geofence', 'stopped');
    } catch (error) {
      await logError('stopGeofences', error);
    }
  });
}

/**
 * The anchor was crossed: the window is stale, rebuild it.
 *
 * Called from the geofence background task, which has already established that
 * the crossing belongs to the anchor and not to a place.
 */
export function handleAnchorExit(): Promise<void> {
  return refreshGeofences('anchor exit');
}

/**
 * The backstop, fed by recorded fixes.
 *
 * A missed anchor exit — process killed, event dropped, tunnel — would freeze
 * the monitored set for the rest of the trip, silently. Since location batches
 * arrive anyway, checking one number against them costs nothing and repairs
 * that case before the user notices it.
 */
export function noteRecordedPosition(at: Coordinate): Promise<void> {
  return serialise(async () => {
    try {
      const state = await readState();
      if (state === null || state.anchor === null) {
        // Not monitoring, or the whole catalogue fits and nothing can go stale.
        return;
      }
      if (Date.now() - state.updatedTs < MIN_BACKSTOP_INTERVAL_MS) {
        return;
      }
      if (!shouldRebuild(state.anchor, at)) {
        return;
      }
      await rebuildAround(at, 'moved away from the anchor');
    } catch (error) {
      await logError('noteRecordedPosition', error);
    }
  });
}

/** What the debug screen shows, and what T-076 is checked against in the field. */
export type GeofenceStatus = {
  /** Is the OS monitoring anything for us at all? */
  active: boolean;
  catalogueRegistered: boolean;
  monitoredCount: number;
  unmonitoredCount: number;
  anchorRadiusM: number | null;
  /** False when the window provably has a hole in it. See `selectWorkingSet`. */
  anchorCoversUnmonitored: boolean;
  /** How far the user has drifted from the anchor's centre, if we can tell. */
  distanceFromAnchorM: number | null;
  updatedTs: number | null;
};

export async function getGeofenceStatus(): Promise<GeofenceStatus> {
  const [active, state] = await Promise.all([
    locationProvider.isGeofencing(),
    readState(),
  ]);

  let distanceFromAnchorM: number | null = null;
  if (state?.anchor != null) {
    const from = await currentPosition();
    if (from !== null) {
      distanceFromAnchorM = distanceM(state.anchor, from);
    }
  }

  return {
    active,
    catalogueRegistered: catalogueSource !== null,
    monitoredCount: state?.monitoredPoiIds.length ?? 0,
    unmonitoredCount: state?.unmonitoredCount ?? 0,
    anchorRadiusM: state?.anchor?.radiusM ?? null,
    anchorCoversUnmonitored: state?.anchorCoversUnmonitored ?? true,
    distanceFromAnchorM,
    updatedTs: state?.updatedTs ?? null,
  };
}

async function logError(where: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  try {
    await recordingEventDao.log('error', `geofence ${where}: ${message}`);
  } catch {
    // The database itself is the problem. Nothing useful is left to do, and
    // throwing out of an OS callback is worse than silence.
  }
}
