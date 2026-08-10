/**
 * Where the app actually gets its places from (T-040).
 *
 * This is the one file in `app/` that reaches into `content/`. Everything else
 * receives already-parsed values, which is what keeps D-017 true: if this
 * project ever ships for the Azores, the change is a different `content/`
 * directory, not a different app.
 *
 * ⚠ THE RELATIVE PATH BELOW IS LOAD-BEARING, AND SO IS `metro.config.js`.
 * `content/` sits outside `app/`, and a bundler will not look outside its own
 * project root unless told to. `app/metro.config.js` adds it to `watchFolders`
 * for exactly this import. If the bundle suddenly cannot resolve `pois.json`,
 * that file is what to check.
 */

import rawPack from '../../../content/pois.json';
import type { PoiCatalogueSource } from '../recording/geofenceManager';
import type { GeofencePlace } from '../recording/geofenceSelection';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import type { ContentPack, Place, PlaceGeofence } from './contentPack';
import {
  countByCategory,
  indexGeofencesByPlace,
  parseContentPack,
  toGeofencePlaces,
} from './contentPack';

/**
 * Parsed once, on first use, and kept.
 *
 * The pack is a compiled-in constant, so re-parsing it would be pure waste —
 * and this is read on a headless relaunch, where every millisecond is spent
 * against a background execution budget the OS is timing.
 */
let parsed: {
  pack: ContentPack;
  geofencePlaces: GeofencePlace[];
  byGeofenceId: Map<string, { place: Place; geofence: PlaceGeofence }>;
  problemCount: number;
} | null = null;

function load(): NonNullable<typeof parsed> {
  if (parsed !== null) {
    return parsed;
  }

  // Throws on a structurally broken pack, which is correct: the caller must not
  // mistake "the file is wrong" for "there is nothing to monitor" (D-033).
  const result = parseContentPack(rawPack as unknown);

  parsed = {
    pack: result.pack,
    geofencePlaces: toGeofencePlaces(result.pack),
    byGeofenceId: indexGeofencesByPlace(result.pack),
    problemCount: result.problems.length,
  };

  if (result.problems.length > 0) {
    // Written to the diary rather than thrown. A curation mistake must cost the
    // user one missing stamp, never a recorder that will not start (D-010).
    // `tools/validate-content.mjs` is where these are meant to be caught.
    for (const problem of result.problems.slice(0, 10)) {
      void recordingEventDao
        .log('error', `content pack: ${problem.where}: ${problem.problem}`)
        .catch(() => undefined);
    }
  }

  return parsed;
}

/** The whole parsed pack, for the passport and the map screen later. */
export function getContentPack(): ContentPack {
  return load().pack;
}

/** Which place a `geofence_event.poi_id` belongs to. Used by the stamp rules (T-071). */
export function findPlaceByGeofenceId(
  geofenceId: string
): { place: Place; geofence: PlaceGeofence } | null {
  return load().byGeofenceId.get(geofenceId) ?? null;
}

export function getContentPackSummary(): {
  placeCount: number;
  geofenceCount: number;
  problemCount: number;
  byCategory: Record<string, number>;
} {
  const loaded = load();
  return {
    placeCount: loaded.pack.places.length,
    geofenceCount: loaded.geofencePlaces.length,
    problemCount: loaded.problemCount,
    byCategory: countByCategory(loaded.pack),
  };
}

/**
 * The catalogue the geofence manager monitors.
 *
 * Async to match the seam, though nothing here awaits: T-040's contract allows
 * a future pack that is read from disk rather than compiled in, and the manager
 * should not have to change if that happens.
 */
export const contentPoiCatalogue: PoiCatalogueSource = async () => {
  return load().geofencePlaces;
};
