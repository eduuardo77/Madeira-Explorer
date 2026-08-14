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

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

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
 * One Overpass query, with the backoff a shared free service deserves.
 *
 * ⚠ Two failure modes, both routine and neither a bug in the query:
 *   - **406** to Node's default user agent. It identifies itself below; an
 *     anonymous scraper is exactly what they are blocking.
 *   - **429 / 504** when the service is busy, which it often is. `osm-survey.py`
 *     takes the same approach and for the same reason: back off rather than
 *     fail the run.
 */
async function overpass(query, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'madeira-explorer build-levadas (contact via repository)',
      },
      body: new URLSearchParams({ data: query }),
    });

    const body = await response.text();
    // A 200 can still carry a runtime error in its body — Overpass reports
    // "server is probably too busy" that way as often as it uses a status code.
    const busy =
      response.status === 429 ||
      response.status === 504 ||
      body.includes('too busy');

    if (response.ok && !busy) {
      return JSON.parse(body);
    }
    if (!busy) {
      throw new Error(`Overpass ${response.status}: ${body.slice(0, 300)}`);
    }
    if (attempt === attempts) {
      throw new Error(`Overpass stayed busy after ${attempts} attempts.`);
    }

    const waitMs = attempt * 8000;
    process.stdout.write(`(busy, retrying in ${waitMs / 1000}s) `);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  throw new Error('unreachable');
}

/** Overpass regex-escaping. A levada name can contain `(` and `)`. */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every way carrying this name, with its geometry.
 *
 * ⚠ **Exact match first, and that is not fussiness.** A loose regex was tried
 * and the emulator showed what it costs: `~"Levada do Furado"` also matched a
 * differently-named levada 30 km west, so the course spanned the island and
 * the camera — which frames the course — zoomed out to the whole of Madeira to
 * fit it. A wrong highlight is visible; a wrong *bounding box* just looks like
 * the feature does not work.
 *
 * The prefix fallback exists because OSM often appends a route code —
 * `Levada do Furado (PR10)` — and that is a real levada with the right name,
 * not a different one.
 *
 * `out geom` rather than resolving node ids ourselves: one request instead of
 * two, and the response is already coordinates.
 */
async function waysNamed(name) {
  const exact = `[out:json][timeout:120];way["name"="${name.replace(/"/g, '\\"')}"](${BBOX});out geom;`;
  const found = (await overpass(exact)).elements ?? [];
  if (found.length > 0) {
    return { ways: found, match: 'exact' };
  }

  // Anchored at the start, so `Levada do Furado (PR10)` matches and
  // `Levada Nova do Furado` does not.
  const prefix = `[out:json][timeout:120];way["name"~"^${escapeRegex(name)}",i](${BBOX});out geom;`;
  return { ways: (await overpass(prefix)).elements ?? [], match: 'prefix' };
}

/**
 * The two ends of the walk, found from the geometry rather than guessed.
 *
 * ⚠ **This is what a levada's `start` and `end` geofences should be, and the
 * difference matters more than it looks.** A levada earns its stamp only when
 * both ends are crossed (D-009) — that is what stops somebody who parked at the
 * trailhead and turned around from collecting a 10 km walk. Endpoints taken
 * from an arbitrary OSM way, which is what the first ten places shipped with,
 * are usually somewhere in the middle of the route: the stamp then either
 * cannot be earned or can be earned without walking it.
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

  // Furthest-apart pair. The lists here are tens of points, so the obvious
  // quadratic scan is the right one.
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

/** Perpendicular distance from `p` to the segment `a`–`b`, in degrees. */
function perpendicular(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  );
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Douglas-Peucker. Iterative, because a levada can be thousands of points. */
function simplify(points, tolerance) {
  if (points.length < 3) {
    return points;
  }

  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let worst = 0;
    let index = -1;

    for (let i = first + 1; i < last; i += 1) {
      const distance = perpendicular(points[i], points[first], points[last]);
      if (distance > worst) {
        worst = distance;
        index = i;
      }
    }

    if (index !== -1 && worst > tolerance) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

function isWalkable(way) {
  return typeof way.tags?.highway === 'string';
}

function isChannel(way) {
  return typeof way.tags?.waterway === 'string';
}

async function courseFor(place) {
  const { ways, match } = await waysNamed(place.name);

  // D-029: the user walks the path, not the channel. Fall back to the channel
  // only where no walkable way carries the name at all.
  const walkable = ways.filter(isWalkable);
  const chosen = walkable.length > 0 ? walkable : ways.filter(isChannel);
  const source = walkable.length > 0 ? 'highway' : 'waterway';

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
 * Printed for every levada because it is the cheap way to catch a bad name
 * match: the longest levada on the island is around 25 km, so a course
 * "60 km across" is two different levadas that happen to share a word.
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

async function main() {
  const packPath = path.join(root, 'content', 'pois.json');
  const pack = JSON.parse(readFileSync(packPath, 'utf8'));
  const levadas = (pack.places ?? []).filter((place) => place.category === 'levada');

  if (levadas.length === 0) {
    console.log('No levadas in content/pois.json, so there is no course to build.');
    console.log('This is expected until T-066 is curated — the app draws nothing.');
  }

  const features = [];
  let simplifiedPoints = 0;
  let rawPoints = 0;

  for (const place of levadas) {
    process.stdout.write(`${place.name} … `);
    const course = await courseFor(place);

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

    // Overpass is a shared free service. Space the requests out.
    await new Promise((resolve) => setTimeout(resolve, 1200));
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
}

await main();
