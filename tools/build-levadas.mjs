/**
 * Extract the course of every curated levada into `content/levadas.json`.
 *
 *     node tools/build-levadas.mjs
 *
 * WHY THIS EXISTS — AND WHY THE TILE PACK COULD NOT DO IT
 * -------------------------------------------------------
 * The project lead asked (2026-08-13) for *"show on map"* to highlight **the
 * path / course of the levada**, not a dot at its trailhead. The obvious cheap
 * answer was to filter the shipped basemap by name: `tiles/pipeline/build.sh`
 * states that the Protomaps schema "keeps names on road/path features, so
 * levadas stay identifiable", and if that were true of the pack we ship, this
 * file would not need to exist.
 *
 * ⚠ **It is not true, and it was measured, not assumed.** On the emulator, a
 * highlight layer over the pack's own `roads` layer:
 *
 *   - `["has", "name"]`                → highlights plenty (roads: ER-103 and
 *                                        friends). So the layer plumbing works.
 *   - `["in", "Levada", ["get","name"]]` → highlights **nothing, anywhere**.
 *
 * So the pack carries names for roads and not for the levada paths. The claim
 * in the pipeline is aspirational; `docs/tile-pipeline.md` has been corrected.
 *
 * WHAT THIS PRODUCES
 * ------------------
 * One feature per curated levada, keyed by its **place id** — not by name, so
 * the app never has to match strings at runtime and a rename in `pois.json`
 * cannot silently unlink the geometry.
 *
 * D-029's selection rule is applied here rather than trusted to a tag: a levada
 * is **two parallel ways sharing one name** — the channel (`waterway=drain`,
 * 2,357 of them) and the footpath beside it (`highway=path`, 922). The walkable
 * ways win; the channel is the fallback where no path is mapped. Selecting on
 * any single tag gets a fraction of the network (`docs/osm-coverage.md`).
 *
 * ⚠ **Build-time only.** It talks to Overpass, which the app never does — the
 * app ships the file (D-001). Re-run it when `pois.json` changes; OSM moves
 * under you, so the output is regenerated, never hand-edited.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { simplify } from './lib/geo.mjs';
import { overpass } from './lib/overpass.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/** Madeira + Porto Santo + Desertas, as south,west,north,east (D-021). */
const BBOX = '32.40,-17.32,33.20,-16.20';

/**
 * Simplification tolerance, in degrees (~8 m at this latitude).
 *
 * The course is drawn between roughly z11 and z15, where 8 m is well under a
 * pixel — so this throws away nothing the eye can see and takes the file from
 * megabytes to hundreds of kilobytes. It is a *drawing* simplification: no
 * matching is ever run against this geometry (D-010 keeps the raw trace for
 * that), so there is nothing downstream to degrade.
 */
const TOLERANCE_DEG = 0.00008;

/**
 * Every walkable levada on the island, and every channel, in two requests.
 *
 * ⚠ **This used to be one request per levada, and it did not survive contact
 * with fifteen of them.** Overpass is a shared free service that is busy more
 * often than not; at two queries each plus backoff, a fifteen-levada pack meant
 * up to thirty requests and the run simply never finished. Fetching the whole
 * island once and matching locally is one request for any number of levadas,
 * and it is the polite version too.
 *
 * The name matching that used to be Overpass's job now happens here, and keeps
 * the same rule: **exact first, prefix as a fallback.** A loose match once
 * pulled in a levada 30 km away and the camera — which frames the course —
 * zoomed out to the whole island to fit it.
 */
async function fetchAllLevadas() {
  const geometry = async (selector) => {
    const result = await overpass(
      `[out:json][timeout:180];way[${selector}]["name"~"^Levada",i](${BBOX});out geom;`,
      { tool: 'build-levadas' }
    );
    const byName = new Map();
    for (const way of result.elements ?? []) {
      const name = way.tags?.name;
      if (typeof name !== 'string' || !Array.isArray(way.geometry)) {
        continue;
      }
      const list = byName.get(name) ?? [];
      list.push(way);
      byName.set(name, list);
    }
    return byName;
  };

  process.stdout.write('fetching every levada on the island … ');
  const walkable = await geometry('"highway"');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const channels = await geometry('"waterway"');
  console.log(`${walkable.size} walkable, ${channels.size} channels`);

  return { walkable, channels };
}

/**
 * The ways for one curated name: exact match first, then prefix.
 *
 * The prefix fallback is for OSM's route codes — `Levada do Furado (PR10)` is
 * the same levada — and is anchored at the start so `Levada Nova do Furado` is
 * not.
 */
function waysFor(name, index) {
  const exact = index.get(name);
  if (exact !== undefined) {
    return { ways: exact, match: 'exact' };
  }

  const lower = name.toLowerCase();
  const ways = [];
  for (const [candidate, list] of index) {
    if (candidate.toLowerCase().startsWith(lower)) {
      ways.push(...list);
    }
  }
  return { ways, match: 'prefix' };
}

/**
 * The two ends of the walk, found from the geometry rather than guessed.
 *
 * ⚠ **This is what a levada's `start` and `end` geofences should be.** A levada
 * earns its stamp only when both ends are crossed (D-009) — that is what stops
 * somebody who parked at the trailhead and turned around from collecting a
 * 10 km walk. Endpoints taken from an arbitrary OSM way, which is what the
 * first ten places shipped with, are usually somewhere in the middle of the
 * route: the stamp then either cannot be earned or can be earned without
 * walking it.
 *
 * The method is mechanical. Every way contributes two endpoints; an endpoint
 * shared by two ways is a **join**, and one that appears exactly once is a
 * **free end** of the network. The walk runs between the two free ends that are
 * furthest apart. Junctions and side spurs — a levada often has both — produce
 * extra free ends, and taking the furthest-apart pair ignores them.
 *
 * ⚠ It is still not local knowledge. It finds the ends of the *mapped* way,
 * which is where OSM stopped drawing, not necessarily where a walker parks.
 * Treat it as a strong suggestion for T-066, not an answer.
 */
function freeEnds(lines) {
  const key = (point) => `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
  const seen = new Map();

  for (const line of lines) {
    for (const point of [line[0], line[line.length - 1]]) {
      const id = key(point);
      const entry = seen.get(id);
      if (entry === undefined) {
        seen.set(id, { point, count: 1 });
      } else {
        entry.count += 1;
      }
    }
  }

  const ends = [...seen.values()].filter((entry) => entry.count === 1);
  if (ends.length < 2) {
    return null;
  }

  let best = null;
  for (let i = 0; i < ends.length; i += 1) {
    for (let j = i + 1; j < ends.length; j += 1) {
      const [ax, ay] = ends[i].point;
      const [bx, by] = ends[j].point;
      const span = Math.hypot(bx - ax, by - ay);
      if (best === null || span > best.span) {
        best = { span, a: ends[i].point, b: ends[j].point };
      }
    }
  }

  return best === null
    ? null
    : {
        start: { lat: best.a[1], lon: best.a[0] },
        end: { lat: best.b[1], lon: best.b[0] },
        freeEndCount: ends.length,
      };
}

function courseFor(place, index) {
  // D-029: the user walks the path, not the channel. Fall back to the channel
  // only where no walkable way carries the name at all.
  const onFoot = waysFor(place.name, index.walkable);
  const byWater = onFoot.ways.length > 0
    ? { ways: [], match: onFoot.match }
    : waysFor(place.name, index.channels);

  const chosen = onFoot.ways.length > 0 ? onFoot.ways : byWater.ways;
  const source = onFoot.ways.length > 0 ? 'highway' : 'waterway';
  const match = onFoot.ways.length > 0 ? onFoot.match : byWater.match;
  const ways = chosen;

  const lines = [];
  let rawPoints = 0;
  for (const way of chosen) {
    const points = (way.geometry ?? [])
      .filter((node) => node !== null)
      .map((node) => [Number(node.lon.toFixed(6)), Number(node.lat.toFixed(6))]);
    rawPoints += points.length;
    const simplified = simplify(points, TOLERANCE_DEG);
    // A single point is not a line and MapLibre will not draw it.
    if (simplified.length >= 2) {
      lines.push(simplified);
    }
  }

  return {
    lines,
    rawPoints,
    source,
    match,
    ends: freeEnds(lines),
    wayCount: chosen.length,
    totalNamed: ways.length,
  };
}

/**
 * How far apart the ends of a course are, in kilometres.
 *
 * Printed for every levada, and compared against the path's own length by
 * `looksLikeTwoLevadas` below.
 */
function span(lines) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const line of lines) {
    for (const [lon, lat] of line) {
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  // Rough, and rough is the point — it is a smell test, not a measurement.
  const kmPerDegreeLat = 111;
  const dx = (east - west) * kmPerDegreeLat * Math.cos((north * Math.PI) / 180);
  const dy = (north - south) * kmPerDegreeLat;
  return Math.hypot(dx, dy).toFixed(1);
}

/**
 * Total walked length of a course, in kilometres.
 */
function pathLength(lines) {
  let km = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const [ax, ay] = line[i - 1];
      const [bx, by] = line[i];
      km += Math.hypot((bx - ax) * 93, (by - ay) * 111);
    }
  }
  return km;
}

/**
 * True when the name has matched more than one levada.
 *
 * ⚠ **An invariant, not a threshold, which is why it is worth having.** A
 * connected path can never be further across than it is long — walk every
 * metre of it and you cannot end up further from the start than the distance
 * you walked. So a course whose bounding box is *wider* than its own length is
 * two or more separate things that happen to share a name.
 *
 * Found by exactly this: `Levada do Moinho` is 11.9 km of ways and came out
 * **21.4 km across**. There are two of them on the island — "mill levada" is
 * not a distinctive name — and the geofences would have been one levada's
 * start and another's end, 20 km apart. A stamp nobody could ever earn.
 *
 * The margin is generous (1.05) because simplification shortens the path very
 * slightly, and because a genuinely straight levada sits near the bound.
 */
function looksLikeTwoLevadas(lines) {
  const across = Number(span(lines));
  const along = pathLength(lines);
  return along > 0 && across > along * 1.05;
}

async function main() {
  const packPath = path.join(root, 'content', 'pois.json');
  const pack = JSON.parse(readFileSync(packPath, 'utf8'));
  const levadas = (pack.places ?? []).filter((place) => place.category === 'levada');

  if (levadas.length === 0) {
    console.log('No levadas in content/pois.json, so there is no course to build.');
    console.log('This is expected until T-066 is curated — the app draws nothing.');
  }

  const features = [];
  const suspicious = [];
  let simplifiedPoints = 0;
  let rawPoints = 0;

  const index = levadas.length > 0 ? await fetchAllLevadas() : null;

  for (const place of levadas) {
    process.stdout.write(`${place.name} … `);
    const course = courseFor(place, index);

    if (course.lines.length === 0) {
      // Loud, because a levada with no course is a "Show on map" that does
      // half of what it says. Almost always a name mismatch: OSM's spelling,
      // accents included, has to match the curated one.
      console.log(
        `NOTHING FOUND (${course.totalNamed} ways carry a matching name). ` +
          `Check the spelling against OSM.`
      );
      continue;
    }

    const points = course.lines.reduce((sum, line) => sum + line.length, 0);
    rawPoints += course.rawPoints;
    simplifiedPoints += points;

    console.log(
      `${course.wayCount} ${course.source} ways (${course.match} name match), ` +
        `${course.rawPoints} → ${points} points, ` +
        `${span(course.lines)} km across`
    );

    if (looksLikeTwoLevadas(course.lines)) {
      suspicious.push(place.name);
      console.log(
        `    ⚠ WIDER THAN IT IS LONG — this name has matched more than one ` +
          `levada. Its start and end belong to different walks, so the stamp ` +
          `cannot be earned. Rename it or drop it.`
      );
    }

    // Printed rather than written into pois.json: the geofences are content,
    // and content is the project lead's (T-066). This is the suggestion.
    if (course.ends !== null) {
      const { start, end, freeEndCount } = course.ends;
      console.log(
        `    ends: start ${start.lat.toFixed(4)},${start.lon.toFixed(4)}  ` +
          `end ${end.lat.toFixed(4)},${end.lon.toFixed(4)}` +
          (freeEndCount > 2 ? `   (${freeEndCount} free ends — spurs ignored)` : '')
      );
    } else {
      console.log('    ends: could not be found — the ways form a loop or a single line');
    }

    features.push({
      type: 'Feature',
      // Keyed by place id, never by name: a rename in pois.json must not
      // silently unlink the geometry.
      properties: { placeId: place.id, source: course.source },
      geometry: { type: 'MultiLineString', coordinates: course.lines },
    });
  }

  const out = path.join(root, 'content', 'levadas.json');
  const json = JSON.stringify({ type: 'FeatureCollection', features });
  writeFileSync(out, `${json}\n`);

  console.log();
  console.log(`Wrote ${features.length} of ${levadas.length} courses to content/levadas.json`);
  console.log(
    `  ${(json.length / 1024).toFixed(0)} kB, ${simplifiedPoints} points ` +
      `(${rawPoints} before simplification)`
  );
  if (features.length < levadas.length) {
    console.log();
    console.log('⚠ Some levadas have no course. Those cards will show a marker only.');
  }
  if (suspicious.length > 0) {
    console.log();
    console.log(
      `⚠ ${suspicious.length} course(s) span further than they are long, which ` +
        `is impossible for one path: ${suspicious.join(', ')}`
    );
  }
}

await main();
