/**
 * Build `content/regions.json` — the region boundaries (T-067) — and check
 * every curated place against them.
 *
 *     node tools/build-regions.mjs            # build and report
 *     node tools/build-regions.mjs --assign   # …and write the region ids back
 *
 * WHAT A REGION IS, AND WHY IT IS NOT A GUESS ANY MORE
 * ----------------------------------------------------
 * D-027 gives region one job: the "where should I go next" half of the product,
 * on the map screen. That needs regions a visitor already believes in — the
 * eleven **concelhos** (municipalities), which is how the island signs itself,
 * how every tourist map is drawn, and what a local means by "Machico".
 *
 * ⚠ **What it replaces was measurably wrong.** `poi-candidates.mjs` assigns a
 * region by *nearest sizeable settlement*, and the settlement list contains the
 * island itself. So 27 of the 80 curated places — a third of the pack — landed
 * in a region called `madeira`, which is not a place you can go to and finish.
 * Nothing displayed it, so nothing complained.
 *
 * A boundary is not a heuristic: a place is in Machico or it is not.
 *
 * WHY `.json` WHEN THE TASK SAYS `.geojson`
 * -----------------------------------------
 * The contents are GeoJSON either way. The extension is `.json` for the reason
 * `levadaCourses.ts` already records: Metro and TypeScript both resolve `.json`
 * out of the box, and a custom extension buys a bundler config and a
 * declaration file for nothing.
 *
 * ⚠ **Build-time only.** It talks to Overpass, which the app never does — the
 * app ships the file (D-001). OSM moves under you, so the output is
 * regenerated, never hand-edited.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  degreesToRing,
  metresBetween,
  pointInPolygon,
  simplify,
  slug,
} from './lib/geo.mjs';
import { overpass } from './lib/overpass.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/** Madeira + Porto Santo + Desertas (D-021). */
const ARCHIPELAGO = { south: 32.4, west: -17.32, north: 33.2, east: -16.2 };

const BBOX = `${ARCHIPELAGO.south},${ARCHIPELAGO.west},${ARCHIPELAGO.north},${ARCHIPELAGO.east}`;

/**
 * Simplification tolerance, in degrees (~20 m at this latitude).
 *
 * Coarser than the levadas' 8 m, because these are used at a different scale:
 * a region is either drawn at island zoom, where 20 m is a fraction of a pixel,
 * or asked "is this place inside you", where 20 m of coastline wobble cannot
 * move a curated place from one municipality to another — the boundaries run
 * along ridges, kilometres from anything.
 *
 * ⚠ The one case it *could* matter is a place on the coast, where the boundary
 * is the shoreline and a simplified shoreline can cut a headland off. That is
 * why every place that lands outside all boundaries is reported below rather
 * than quietly assigned.
 */
const TOLERANCE_DEG = 0.0002;

/**
 * The same tolerance in metres, which is the useful form when reading the
 * report below: Douglas-Peucker's guarantee is that no point of the original
 * shoreline is further than this from the simplified one, so it is the exact
 * budget for "this place looks offshore but might just be the file".
 */
const SIMPLIFICATION_METRES = Math.round(TOLERANCE_DEG * 111000);

/**
 * The smallest part of a region worth keeping, across its bounding box.
 *
 * ⚠ **A municipality here is not one polygon, and the surprise is the count.**
 * CAOP's boundaries follow the coastline, and every offshore rock is its own
 * ring: Machico arrives as **102** parts, Porto Santo as 60. Funchal is worse —
 * it owns the **Ilhas Selvagens**, 250 km to the south, which Overpass returns
 * in full because the *relation* matched the bounding box even though most of
 * its geometry does not. Kept whole, the file is 291 kB of rocks.
 *
 * So a part is dropped when it is smaller than this, or when it lies outside
 * the archipelago. Neither can lose a place: nothing curated stands on a 500 m
 * rock, and any place that ends up outside every boundary is reported below
 * with the distance, so a bad drop would be visible rather than silent.
 */
const MIN_PART_METRES = 500;

/**
 * Which island each region belongs to, needed by D-024's lock gate (T-067a):
 * Porto Santo stays hidden until the user goes there, and "there" is an island,
 * not a municipality.
 *
 * Taken from OSM's own island relations rather than written down here, so the
 * tool has no more Madeira knowledge than the query it sends.
 */
async function fetchIslands() {
  const result = await overpass(
    `[out:json][timeout:180];relation["place"="island"](${BBOX});out center tags;`,
    { tool: 'build-regions' }
  );

  const islands = [];
  for (const element of result.elements ?? []) {
    const name = element.tags?.name;
    const centre = element.center;
    if (typeof name === 'string' && centre !== undefined) {
      islands.push({ id: slug(name), name, lat: centre.lat, lon: centre.lon });
    }
  }
  return islands;
}

/** Every municipality in the archipelago, with the geometry of its members. */
async function fetchMunicipalities() {
  const result = await overpass(
    `[out:json][timeout:180];` +
      `relation["boundary"="administrative"]["admin_level"="7"](${BBOX});out geom;`,
    { tool: 'build-regions' }
  );
  return (result.elements ?? []).filter(
    (element) => element.type === 'relation' && typeof element.tags?.name === 'string'
  );
}

/**
 * Stitch a relation's member ways into closed rings.
 *
 * ⚠ **A boundary relation is a bag of fragments, not a ring.** Its ways arrive
 * in no particular order and in no particular direction — a shared coastal way
 * belongs to one municipality forwards and its neighbour backwards. Drawing
 * them as they come produces a polygon that zig-zags across the island, and the
 * inside/outside test on it is nonsense rather than an error.
 *
 * So: take a fragment, and keep extending the open end with whichever unused
 * fragment starts or ends exactly there, reversing it if that is what fits.
 * Endpoints match *exactly* because OSM ways share node identity, so the
 * comparison is on the rounded coordinate rather than on a tolerance.
 */
function ringsFrom(ways) {
  const key = (point) => `${point[0].toFixed(7)},${point[1].toFixed(7)}`;

  // Every open end, mapped to the fragments that touch it.
  const byEnd = new Map();
  const remaining = new Set(ways.keys());
  for (const [index, line] of ways.entries()) {
    for (const end of [key(line[0]), key(line[line.length - 1])]) {
      const list = byEnd.get(end) ?? [];
      list.push(index);
      byEnd.set(end, list);
    }
  }

  const rings = [];
  const unclosed = [];

  while (remaining.size > 0) {
    const first = remaining.values().next().value;
    remaining.delete(first);
    const ring = [...ways[first]];

    // Grow the tail, then the head, until nothing fits either end.
    for (const atTail of [true, false]) {
      for (;;) {
        const open = atTail ? ring[ring.length - 1] : ring[0];
        const next = (byEnd.get(key(open)) ?? []).find((index) =>
          remaining.has(index)
        );
        if (next === undefined) {
          break;
        }
        remaining.delete(next);

        const line = ways[next];
        const forwards = key(line[0]) === key(open);
        const rest = forwards ? line.slice(1) : line.slice(0, -1).reverse();
        if (atTail) {
          ring.push(...rest);
        } else {
          ring.unshift(...rest.reverse());
        }
      }
    }

    if (ring.length >= 4 && key(ring[0]) === key(ring[ring.length - 1])) {
      rings.push(ring);
    } else {
      unclosed.push(ring);
    }
  }

  return { rings, unclosed };
}

/** Simplify a closed ring, keeping it closed and keeping it a ring. */
function simplifyRing(ring) {
  const simplified = simplify(ring, TOLERANCE_DEG);
  // Fewer than four points is a degenerate ring — a municipality that
  // simplified into a line. Keep the detail rather than the nonsense.
  if (simplified.length < 4) {
    return ring;
  }
  simplified[simplified.length - 1] = simplified[0];
  return simplified;
}

/**
 * Turn stitched rings into GeoJSON polygons.
 *
 * Each `outer` ring becomes a polygon; each `inner` ring becomes a hole in
 * whichever polygon contains it. No Madeira municipality has a hole today —
 * this exists so that one appearing does not silently become a second island.
 */
function polygonsFrom(outerRings, innerRings) {
  const polygons = outerRings.map((ring) => [ring]);

  for (const hole of innerRings) {
    const host = polygons.find((polygon) => pointInPolygon(hole[0], [polygon[0]]));
    if (host !== undefined) {
      host.push(hole);
    }
  }

  return polygons;
}

/** A `[lon, lat]` for a place: its `main` geofence, else its first. */
function pointOf(place) {
  const geofences = place.geofences ?? [];
  const primary = geofences.find((fence) => fence.role !== 'end') ?? geofences[0];
  return primary === undefined ? null : [primary.lon, primary.lat];
}

/** Bounding box of a ring. */
function boundsOf(ring) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of ring) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return { west, south, east, north };
}

/** Bounding-box centre, as `{lat, lon}`. */
function centreOf(bounds) {
  return {
    lat: (bounds.south + bounds.north) / 2,
    lon: (bounds.west + bounds.east) / 2,
  };
}

/** How big a part is: the diagonal of its bounding box, in metres. */
function spanMetres(bounds) {
  return metresBetween(
    { lat: bounds.south, lon: bounds.west },
    { lat: bounds.north, lon: bounds.east }
  );
}

/**
 * Is this part of a region worth shipping? See `MIN_PART_METRES`.
 *
 * The bounding-box test is on the centre rather than on containment, because a
 * part straddling the edge of the archipelago box is still part of the island.
 */
function isPartWorthKeeping(polygon) {
  const bounds = boundsOf(polygon[0]);
  const centre = centreOf(bounds);
  const inArchipelago =
    centre.lat >= ARCHIPELAGO.south &&
    centre.lat <= ARCHIPELAGO.north &&
    centre.lon >= ARCHIPELAGO.west &&
    centre.lon <= ARCHIPELAGO.east;
  return inArchipelago && spanMetres(bounds) >= MIN_PART_METRES;
}

/**
 * The mainland part of a region: the biggest one.
 *
 * ⚠ **Not the centre of all of them.** Funchal's parts averaged out to a point
 * in the open Atlantic, 200 km south of Funchal, which made its nearest island
 * the Bugio — and the island is what D-024's lock gate keys on. The largest
 * part is the municipality; the rest are its rocks.
 */
function mainPartOf(polygons) {
  return polygons.reduce((best, polygon) =>
    spanMetres(boundsOf(polygon[0])) > spanMetres(boundsOf(best[0])) ? polygon : best
  );
}

/** The region containing this point, or null. */
function regionContaining(point, regions) {
  return (
    regions.find((region) =>
      region.polygons.some((polygon) => pointInPolygon(point, polygon))
    ) ?? null
  );
}

/**
 * The nearest region to a point that no region contains.
 *
 * ⚠ Distance to the *boundary*, which is what "nearest" has to mean here: a
 * viewpoint 40 m offshore is metres from its own municipality's coastline and
 * kilometres from the centre of it.
 */
function nearestRegion(point, regions) {
  let best = null;
  for (const region of regions) {
    for (const polygon of region.polygons) {
      for (const ring of polygon) {
        const degrees = degreesToRing(point, ring);
        if (best === null || degrees < best.degrees) {
          best = { region, degrees };
        }
      }
    }
  }
  if (best === null) {
    return null;
  }
  // Rough metres, for a message. 111 km per degree of latitude; the longitude
  // component is already small by the time this matters.
  return { region: best.region, metres: Math.round(best.degrees * 111000) };
}

function buildRegions(municipalities, islands) {
  const regions = [];

  for (const relation of municipalities) {
    const byRole = { outer: [], inner: [] };
    for (const member of relation.members ?? []) {
      if (member.type !== 'way' || !Array.isArray(member.geometry)) {
        continue;
      }
      // An empty role means outer: the tagging is optional and plenty of
      // relations leave it off.
      const role = member.role === 'inner' ? 'inner' : 'outer';
      const line = member.geometry
        .filter((node) => node !== null)
        .map((node) => [Number(node.lon.toFixed(7)), Number(node.lat.toFixed(7))]);
      if (line.length >= 2) {
        byRole[role].push(line);
      }
    }

    const outer = ringsFrom(byRole.outer);
    const inner = ringsFrom(byRole.inner);
    const allParts = polygonsFrom(
      outer.rings.map(simplifyRing),
      inner.rings.map(simplifyRing)
    );
    const polygons = allParts.filter(isPartWorthKeeping);

    const name = relation.tags.name;
    if (polygons.length === 0) {
      console.log(`${name} … NOTHING LEFT TO SHIP — skipped`);
      continue;
    }

    const centre = centreOf(boundsOf(mainPartOf(polygons)[0]));
    const island = islands.reduce(
      (best, candidate) =>
        best === null || metresBetween(centre, candidate) < metresBetween(centre, best)
          ? candidate
          : best,
      null
    );

    const points = polygons.reduce(
      (sum, polygon) => sum + polygon.reduce((n, ring) => n + ring.length, 0),
      0
    );

    console.log(
      `${name} … ${polygons.length} part(s), ${points} points` +
        (allParts.length > polygons.length
          ? `, ${allParts.length - polygons.length} rock(s) dropped`
          : '') +
        (outer.unclosed.length > 0
          ? `, ⚠ ${outer.unclosed.length} fragment(s) would not close`
          : '')
    );

    regions.push({
      id: slug(name),
      name,
      islandId: island === null ? null : island.id,
      islandName: island === null ? null : island.name,
      osmRelationId: relation.id,
      polygons,
    });
  }

  return regions.sort((a, b) => a.id.localeCompare(b.id));
}

/** GeoJSON, one feature per region. Multi-part regions stay one feature. */
function toFeatureCollection(regions) {
  return {
    type: 'FeatureCollection',
    features: regions.map((region) => ({
      type: 'Feature',
      properties: {
        id: region.id,
        name: region.name,
        islandId: region.islandId,
        islandName: region.islandName,
        osmRelationId: region.osmRelationId,
      },
      geometry:
        region.polygons.length === 1
          ? { type: 'Polygon', coordinates: region.polygons[0] }
          : { type: 'MultiPolygon', coordinates: region.polygons },
    })),
  };
}

/**
 * Which region each curated place falls in, and how sure we are.
 *
 * `outside` is not an error on its own — a coastal viewpoint sits a few metres
 * out to sea often enough — but a place hundreds of metres from any boundary is
 * a coordinate worth re-reading.
 */
function assignPlaces(places, regions) {
  return places.map((place) => {
    const point = pointOf(place);
    if (point === null) {
      return { place, regionId: place.regionId, how: 'no coordinate' };
    }

    const inside = regionContaining(point, regions);
    if (inside !== null) {
      return { place, regionId: inside.id, how: 'inside' };
    }

    const nearest = nearestRegion(point, regions);
    return nearest === null
      ? { place, regionId: place.regionId, how: 'no regions' }
      : { place, regionId: nearest.region.id, how: 'outside', metres: nearest.metres };
  });
}

async function main() {
  const assign = process.argv.includes('--assign');
  const packPath = path.join(root, 'content', 'pois.json');
  const pack = JSON.parse(readFileSync(packPath, 'utf8'));

  process.stdout.write('fetching islands … ');
  const islands = await fetchIslands();
  console.log(islands.map((island) => island.name).join(', ') || 'none');

  process.stdout.write('fetching municipalities … ');
  const municipalities = await fetchMunicipalities();
  console.log(`${municipalities.length} found`);
  console.log();

  const regions = buildRegions(municipalities, islands);
  if (regions.length === 0) {
    throw new Error('No region survived. Nothing was written.');
  }

  const out = path.join(root, 'content', 'regions.json');
  const json = JSON.stringify(toFeatureCollection(regions));
  writeFileSync(out, `${json}\n`);

  console.log();
  console.log(
    `Wrote ${regions.length} regions to content/regions.json ` +
      `(${(json.length / 1024).toFixed(0)} kB)`
  );

  const byIsland = new Map();
  for (const region of regions) {
    const list = byIsland.get(region.islandName) ?? [];
    list.push(region.name);
    byIsland.set(region.islandName, list);
  }
  for (const [island, names] of byIsland) {
    console.log(`  ${island ?? 'no island'}: ${names.join(', ')}`);
  }

  /* ------------------------------------------------ the places, against them */

  const places = pack.places ?? [];
  const assignments = assignPlaces(places, regions);
  const changed = assignments.filter((row) => row.regionId !== row.place.regionId);
  const outside = assignments.filter((row) => row.how === 'outside');

  console.log();
  const counts = new Map();
  for (const row of assignments) {
    counts.set(row.regionId, (counts.get(row.regionId) ?? 0) + 1);
  }
  console.log('Places per region:');
  for (const region of regions) {
    console.log(
      `  ${region.name.padEnd(24)} ${String(counts.get(region.id) ?? 0).padStart(3)}`
    );
  }

  if (outside.length > 0) {
    console.log();
    console.log(`${outside.length} place(s) fall outside every boundary:`);
    for (const row of outside) {
      console.log(
        `  ${row.place.name.padEnd(32)} ${row.metres} m from ${row.regionId}`
      );
    }
    console.log(
      `  Up to ~${SIMPLIFICATION_METRES} m is this file: Douglas-Peucker moves ` +
        `a shoreline by at most the tolerance, and the boundary here is the ` +
        `shore. Beyond that the coordinate is in the sea, and a geofence in the ` +
        `sea is a stamp nobody standing at the place can earn.`
    );
  }

  console.log();
  if (changed.length === 0) {
    console.log('Every place already carries the right region id.');
    return;
  }

  console.log(`${changed.length} of ${places.length} places have the wrong region id:`);
  for (const row of changed) {
    console.log(
      `  ${row.place.name.padEnd(32)} ${row.place.regionId} → ${row.regionId}`
    );
  }

  if (!assign) {
    console.log();
    console.log('Nothing was written to pois.json. Re-run with --assign to apply.');
    return;
  }

  // `regionId` is derived, not curated: it is the answer to "which polygon is
  // this in", which no human should be typing. The rest of the pack is the
  // project lead's (T-066) and is not touched here.
  for (const row of changed) {
    row.place.regionId = row.regionId;
  }
  writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`);
  console.log();
  console.log(`Wrote ${changed.length} region ids into content/pois.json.`);
}

await main();
