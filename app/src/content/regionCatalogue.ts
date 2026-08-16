/**
 * Where the app gets its region names from (T-067).
 *
 * The third file in `app/` that reaches into `content/`, and for the same
 * reason as `poiCatalogue.ts` and `levadaCourses.ts`: Madeira knowledge lives
 * there, never here (D-017). `tools/build-regions.mjs` produces the file from
 * OSM at build time; this reads it at runtime and never touches a network
 * (D-001).
 *
 * ⚠ THE RELATIVE PATH BELOW IS LOAD-BEARING, AND SO IS `metro.config.js`.
 * `content/` sits outside `app/`, and a bundler will not look outside its own
 * project root unless told to.
 */

// `.json`, not `.geojson`, for the reason `levadaCourses.ts` records: Metro and
// TypeScript both resolve JSON out of the box. The contents are GeoJSON.
import rawRegions from '../../../content/regions.json';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import type { Region } from './regionPack';
import { indexRegions, parseRegionPack } from './regionPack';

/**
 * Parsed once, on first use, and kept — the file is a compiled-in constant, so
 * re-parsing it would be pure waste.
 */
let index: Map<string, Region> | null = null;

function load(): Map<string, Region> {
  if (index !== null) {
    return index;
  }

  const parsed = parseRegionPack(rawRegions as unknown);
  index = indexRegions(parsed.regions);

  if (parsed.problems.length > 0) {
    // Logged, never thrown: a region that will not parse costs a label on a
    // card, and the diary is where a build-time mistake should surface.
    for (const problem of parsed.problems.slice(0, 10)) {
      void recordingEventDao.logError(
        'region pack',
        `${problem.where}: ${problem.problem}`
      );
    }
  }

  return index;
}

/**
 * What to call this region — `"Machico"` — or null when the id names no region
 * we shipped.
 *
 * Null rather than the raw id: a slug on a card looks like a bug to a user and
 * like a placeholder to a reviewer, and every caller here can simply show one
 * fewer word.
 */
export function getRegionName(regionId: string): string | null {
  return load().get(regionId)?.name ?? null;
}

/** How many regions shipped. For the debug screen and the validator. */
export function getRegionCount(): number {
  return load().size;
}
