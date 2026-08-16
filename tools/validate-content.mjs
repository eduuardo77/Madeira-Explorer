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

import { degreesToRing, pointInPolygon } from './lib/geo.mjs';

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

/**
 * The curated canvas: **60–100 places, aiming at 80** (D-049).
 *
 * ⚠ This was 150–250 (D-002, CONTEXT §4.1) until 2026-08-12. It was cut because
 * of arithmetic nobody had done: a busy 7-day trip takes in perhaps 25–45
 * places, so against 250 a visitor finished around a tenth full and the
 * souvenir read `31 / 250`. That is the *same* failure CONTEXT §4.1 used to
 * reject island-wide road coverage — "the map would stay ~95% dark" — at a
 * smaller scale. At 80 the same trip finishes a third to half full, and the
 * headline reads `31 / 80`.
 */
const TARGET_MIN_PLACES = 60;
const TARGET_MAX_PLACES = 100;

/** Below this, two places are probably one place entered twice. */
const SUSPICIOUSLY_CLOSE_M = 100;

/**
 * How far outside its region a place may sit before it is the coordinate's
 * fault rather than the file's (T-067).
 *
 * `content/regions.json` is simplified at ~22 m, and a municipality boundary is
 * the shoreline, so a clifftop viewpoint can legitimately measure a few tens of
 * metres out to sea. Twice the tolerance is the slack; past it, the place is
 * genuinely in the water — and a geofence in the water is a stamp that cannot
 * be earned by standing at the place, which is the whole mechanic.
 */
const OFFSHORE_SLACK_M = 50;

const errors = [];
const warnings = [];

/**
 * The region boundaries, as `{ id, name, polygons }`.
 *
 * Missing is a warning rather than an error: the boundaries are derived from
 * OSM and can be rebuilt in a minute, and a curator checking a draft list
 * should not be blocked by a file they did not touch.
 */
async function readRegions() {
  const regionPath = path.resolve(repositoryRoot, 'content', 'regions.json');
  let raw;
  try {
    raw = JSON.parse(await readFile(regionPath, 'utf8'));
  } catch {
    warn('regions.json', 'missing or unreadable - run: node tools/build-regions.mjs');
    return [];
  }

  return (raw.features ?? []).flatMap((feature) => {
    const { id, name } = feature?.properties ?? {};
    const geometry = feature?.geometry;
    if (typeof id !== 'string' || typeof name !== 'string') {
      return [];
    }
    // One feature per region, whether the region is one island or several.
    const polygons =
      geometry?.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry?.type === 'MultiPolygon'
          ? geometry.coordinates
          : [];
    return polygons.length === 0 ? [] : [{ id, name, polygons }];
  });
}

/** A `[lon, lat]` for a place: its first geofence. */
function pointOf(place) {
  const first = place.geofences[0];
  return first === undefined ? null : [first.lon, first.lat];
}

/** How far outside every region a point is, in metres. */
function metresOutside(point, regions) {
  let degrees = Infinity;
  for (const region of regions) {
    for (const polygon of region.polygons) {
      for (const ring of polygon) {
        degrees = Math.min(degrees, degreesToRing(point, ring));
      }
    }
  }
  return Math.round(degrees * 111000);
}

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

  // Departure points (T-099): monitored, never stampable. A pack with none
  // simply never ends a trip at an airport, which is worth saying out loud
  // rather than leaving as a silent gap.
  for (const point of parsed.pack.departurePoints) {
    if (
      point.lat < BOUNDS.south ||
      point.lat > BOUNDS.north ||
      point.lon < BOUNDS.west ||
      point.lon > BOUNDS.east
    ) {
      error(point.id, 'departure point is outside the Madeira archipelago');
    }
  }
  if (parsed.pack.departurePoints.length === 0) {
    warn(
      'departurePoints',
      'none defined - no trip will ever end at an airport (D-012, T-099)'
    );
  }

  // The pack's own name for where it covers (T-116a). Absent is legal and the
  // app falls back to generic copy, but it is almost certainly an oversight —
  // the reveal notification is the best moment in the product (D-012) and
  // "Your map is ready" is a colder sentence than it needs to be.
  if (parsed.pack.destination === null) {
    warn(
      'destination',
      'not set - the reveal will say "Your map is ready" rather than naming the place'
    );
  }

  // Every levada should have a course to draw (D-055). A missing one is not a
  // broken pack — the card still works, it just shows a marker and no walk —
  // but it is invisible in the app and obvious here, which is the right place
  // for it to be noticed. Almost always a spelling difference against OSM.
  const levadas = places.filter((place) => place.category === 'levada');
  if (levadas.length > 0) {
    const coursePath = path.resolve(repositoryRoot, 'content', 'levadas.json');
    let courses = new Set();
    try {
      const raw = JSON.parse(await readFile(coursePath, 'utf8'));
      for (const feature of raw.features ?? []) {
        const id = feature?.properties?.placeId;
        if (typeof id === 'string') {
          courses.add(id);
        }
      }
    } catch {
      warn(
        'levadas.json',
        'missing or unreadable - run: node tools/build-levadas.mjs'
      );
    }

    for (const levada of levadas) {
      if (!courses.has(levada.id)) {
        warn(
          levada.id,
          `no course in levadas.json, so "Show on map" draws a marker and no walk. ` +
            `Check the name against OSM, then re-run: node tools/build-levadas.mjs`
        );
      }
    }
  }

  // Every place should be in the region it claims, and every region should
  // exist (T-067). `regionId` is derived from the boundaries rather than typed,
  // so a mismatch means the boundaries or the coordinates moved since the last
  // build — not that somebody made a judgement call.
  const regions = await readRegions();
  const regionNames = new Map(regions.map((region) => [region.id, region.name]));

  for (const place of places) {
    if (regions.length === 0) {
      break;
    }
    if (!regionNames.has(place.regionId)) {
      error(
        place.id,
        `region "${place.regionId}" is not in regions.json — run: node tools/build-regions.mjs --assign`
      );
    }

    const point = pointOf(place);
    if (point === null) {
      continue;
    }

    const containing = regions.find((region) =>
      region.polygons.some((polygon) => pointInPolygon(point, polygon))
    );
    if (containing !== undefined) {
      if (containing.id !== place.regionId) {
        error(
          place.id,
          `sits in ${containing.name} but is filed under "${place.regionId}" — run: node tools/build-regions.mjs --assign`
        );
      }
      continue;
    }

    // Outside every boundary. Distance decides whether that is the simplified
    // shoreline or a coordinate in the sea.
    const metres = metresOutside(point, regions);
    if (metres > OFFSHORE_SLACK_M) {
      warn(
        place.id,
        `${metres} m out to sea — no geofence there can be reached on foot. Check the coordinate against OSM.`
      );
    }
  }

  const byCategory = countByCategory(parsed.pack);
  const byRegion = new Map();
  for (const place of places) {
    byRegion.set(place.regionId, (byRegion.get(place.regionId) ?? 0) + 1);
  }

  const shownPath = path.relative(repositoryRoot, packPath).replace(/\\/g, '/');
  console.log(`${shownPath} — ${places.length} places, ${allGeofences.length} geofences, ${parsed.pack.departurePoints.length} departure points\n`);

  console.log('By category (D-027 — the passport has exactly these five rows):');
  for (const [category, count] of Object.entries(byCategory)) {
    const bar = '█'.repeat(Math.min(40, count));
    console.log(`  ${category.padEnd(10)} ${String(count).padStart(4)}  ${bar}`);
  }

  if (byRegion.size > 0) {
    // Named, because a slug is not what the user will read and a region with
    // no name here is a region that does not exist (D-027, T-067).
    console.log('\nBy region (the map screen’s "where next", D-027):');
    const sorted = [...byRegion.entries()].sort((a, b) => b[1] - a[1]);
    for (const [regionId, count] of sorted) {
      const name = regionNames.get(regionId) ?? `${regionId} — UNKNOWN REGION`;
      console.log(`  ${name.padEnd(24)} ${String(count).padStart(4)}`);
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
