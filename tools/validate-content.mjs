/**
 * Check content/pois.json before it reaches a phone (T-040, supports T-066).
 *
 *     node tools/validate-content.mjs
 *
 * Curating 150–250 places by hand is weeks of work, and the mistakes it
 * produces are the quiet kind: a category typo, a copy-pasted id, a longitude
 * missing its minus sign. On a phone each of those costs one stamp that never
 * fires, discovered — if ever — by a tourist on holiday. This catches them on a
 * laptop in under a second.
 *
 * It reuses the app's own parser rather than reimplementing the rules, so the
 * two can never drift apart. Node strips the TypeScript types as it loads it;
 * nothing needs building.
 *
 * On top of the app's rules it adds the checks that only matter to a human
 * curating the list — island bounds, levadas missing an end, places suspiciously
 * close together — plus a progress report against the 150–250 target.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Node grumbles once about `app/package.json` not declaring `"type": "module"`
// when it loads a TypeScript file from there. It cannot declare it — Expo's own
// config files are CommonJS — and the warning says nothing useful to anybody
// running this tool, so it is swallowed. That is also why the parser is
// imported dynamically below: a static import would run before this line.
process.removeAllListeners('warning');

const { countByCategory, parseContentPack } = await import(
  '../app/src/content/contentPack.ts'
);
// The app's own haversine, for the same reason as the parser: two definitions
// of "how far apart are two points" would let a curator's duplicate check
// disagree with what the phone actually does.
const { distanceM } = await import('../app/src/recording/distance.ts');

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

// Takes an optional path, so a work-in-progress list can be checked without
// touching the real one: `node tools/validate-content.mjs draft.json`
const packPath =
  process.argv[2] === undefined
    ? path.join(repositoryRoot, 'content', 'pois.json')
    : path.resolve(process.argv[2]);

/**
 * The archipelago, with room to spare. Same box the OSM survey uses
 * (tools/osm-survey.py) so the two agree about what "in Madeira" means.
 * Island knowledge belongs here in `tools/`, never in `app/` (D-017).
 */
const BOUNDS = { south: 32.4, west: -17.32, north: 33.2, east: -16.2 };

/** D-002 and CONTEXT §4.1: the curated canvas is 150–250 places. */
const TARGET_MIN_PLACES = 150;
const TARGET_MAX_PLACES = 250;

/** Below this, two places are probably one place entered twice. */
const SUSPICIOUSLY_CLOSE_M = 100;

const errors = [];
const warnings = [];

function error(where, message) {
  errors.push(`${where}: ${message}`);
}

function warn(where, message) {
  warnings.push(`${where}: ${message}`);
}

async function main() {
  let raw;
  try {
    raw = JSON.parse(await readFile(packPath, 'utf8'));
  } catch (cause) {
    console.error(`Could not read ${packPath}\n  ${cause.message}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = parseContentPack(raw);
  } catch (cause) {
    // Structural failure. The app would refuse to start on this.
    console.error(`content/pois.json is not a usable content pack:\n  ${cause.message}`);
    process.exit(1);
  }

  // Everything the app itself would drop.
  for (const problem of parsed.problems) {
    error(problem.where, problem.problem);
  }

  const places = parsed.pack.places;

  // --- checks the app does not make, because only a curator can act on them ---

  const allGeofences = [];
  for (const place of places) {
    for (const geofence of place.geofences) {
      allGeofences.push({ place, geofence });
    }

    if (
      !place.geofences.some(
        (geofence) =>
          geofence.lat >= BOUNDS.south &&
          geofence.lat <= BOUNDS.north &&
          geofence.lon >= BOUNDS.west &&
          geofence.lon <= BOUNDS.east
      )
    ) {
      error(place.id, 'no geofence is inside the Madeira archipelago — check the signs');
    }

    if (place.category === 'levada') {
      const roles = place.geofences.map((geofence) => geofence.role);
      if (!roles.includes('start') || !roles.includes('end')) {
        // A levada stamp means "you walked the whole thing" (D-009). One
        // geofence would award it to somebody who parked at the trailhead.
        warn(
          place.id,
          'a levada should have a `start` and an `end` geofence — one alone awards the stamp for arriving'
        );
      }
    } else if (place.geofences.length > 1) {
      warn(place.id, `${place.geofences.length} geofences on a ${place.category}; is that intended?`);
    }
  }

  // Two places on top of each other is nearly always the same place twice.
  for (let i = 0; i < allGeofences.length; i += 1) {
    for (let j = i + 1; j < allGeofences.length; j += 1) {
      const a = allGeofences[i];
      const b = allGeofences[j];
      if (a.place.id === b.place.id) {
        continue;
      }
      const metres = distanceM(a.geofence, b.geofence);
      if (metres < SUSPICIOUSLY_CLOSE_M) {
        warn(
          `${a.geofence.id} / ${b.geofence.id}`,
          `${Math.round(metres)} m apart — duplicate, or two stamps for one arrival?`
        );
      }
    }
  }

  // --- report ---

  const byCategory = countByCategory(parsed.pack);
  const byRegion = new Map();
  for (const place of places) {
    byRegion.set(place.regionId, (byRegion.get(place.regionId) ?? 0) + 1);
  }

  const shownPath = path.relative(repositoryRoot, packPath).replace(/\\/g, '/');
  console.log(`${shownPath} — ${places.length} places, ${allGeofences.length} geofences\n`);

  console.log('By category (D-027 — the passport has exactly these five rows):');
  for (const [category, count] of Object.entries(byCategory)) {
    const bar = '█'.repeat(Math.min(40, count));
    console.log(`  ${category.padEnd(10)} ${String(count).padStart(4)}  ${bar}`);
  }

  if (byRegion.size > 0) {
    console.log('\nBy region:');
    const sorted = [...byRegion.entries()].sort((a, b) => b[1] - a[1]);
    for (const [regionId, count] of sorted) {
      console.log(`  ${regionId.padEnd(20)} ${String(count).padStart(4)}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const warning of warnings) {
      console.log(`  ? ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.log(`\n${errors.length} error(s) — these places will NOT reach the app:`);
    for (const message of errors) {
      console.log(`  ✗ ${message}`);
    }
  }

  console.log('');
  if (errors.length > 0) {
    console.log('FAILED.');
    process.exit(1);
  }

  if (places.length === 0) {
    console.log('Valid, and empty. T-066 is where the places come from.');
  } else if (places.length < TARGET_MIN_PLACES) {
    console.log(
      `Valid. ${places.length} of the ${TARGET_MIN_PLACES}–${TARGET_MAX_PLACES} target (D-002) — ${TARGET_MIN_PLACES - places.length} to go.`
    );
  } else if (places.length > TARGET_MAX_PLACES) {
    console.log(
      `Valid, but ${places.length} is past the ${TARGET_MAX_PLACES} ceiling. A canvas that never fills is the risk D-002 exists to avoid.`
    );
  } else {
    console.log(`Valid, and within the ${TARGET_MIN_PLACES}–${TARGET_MAX_PLACES} target.`);
  }
}

await main();
