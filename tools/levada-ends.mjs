/**
 * Propose where each levada walk actually starts and ends (T-068, D-009).
 *
 *     node tools/levada-ends.mjs
 *     → tools/out/levada-ends.md
 *
 * THE PROBLEM THIS EXISTS FOR
 * ---------------------------
 * A levada stamp means *you walked the whole thing*, which is two crossings
 * (D-009). The pairs currently in `content/pois.json` are the **free ends of
 * the mapped way** — where OpenStreetMap stopped drawing — and `build-levadas.mjs`
 * says so in its own comments. That is usually not where a walker starts:
 *
 *   - The drawn way often continues past the trailhead into a channel nobody
 *     walks, so the "start" is somewhere up a mountain with no access.
 *   - Or it stops short of the car park, so the geofence sits 400 m along the
 *     path and a walker crosses it either way.
 *   - Or the two furthest-apart free ends belong to two different sections.
 *
 * A wrong pair fails in one of two directions, and both are bad: **a stamp
 * nobody can earn**, or **a stamp earned by parking and turning round**.
 *
 * WHAT THIS PROPOSES INSTEAD
 * --------------------------
 * The end of a path is a *place* when somebody built something there. So for
 * every free end of every course, this asks OSM what is within
 * `ACCESS_RADIUS_M`:
 *
 *   - **parking** — the strongest single signal that walkers start here
 *   - **a guidepost or information board** — the regional government signs its
 *     PR routes at their trailheads
 *   - **a bus stop** — how a walker gets to a one-way levada
 *   - **a road** the path meets — necessary, not sufficient, since a levada
 *     crosses roads mid-route
 *   - **a café, restaurant or viewpoint** — where there is a trailhead there is
 *     usually something selling coffee
 *
 * Ends are then ranked by that evidence, and the two best-served are proposed.
 *
 * ⚠ **IT PROPOSES. IT DOES NOT WRITE.** Which two points a stamp turns on is
 * exactly the local knowledge this project keeps saying it cannot buy
 * (T-066, D-064's veto arrangement). The output is a review sheet.
 *
 * ⚠ **And after D-065 the endpoints matter less than they did.** Crediting is
 * moving to coverage of the course rather than two crossings, precisely because
 * this file cannot be got right from a laptop. Good endpoints remain the
 * fastest, cheapest path to a stamp; they are no longer the only one.
 *
 * ⚠ **Build-time only** — talks to Overpass, which the app never does (D-001).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { metresBetween } from './lib/geo.mjs';
import { overpass } from './lib/overpass.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/** How far from a path end to look for signs that walkers start there. */
const ACCESS_RADIUS_M = 300;

/**
 * What counts as access, and how much each is worth when ranking an end.
 *
 * ⚠ **PARKING WAS WEIGHTED HIGHEST AND THE PROJECT LEAD SAYS IT SHOULD NOT BE
 * (2026-08-16).** The reasoning here was that a car park is where walkers
 * start. On Madeira: *"where you park the car is not part of the levada.
 * Moreover, most of the time those parks are full and you need to find another
 * irregular place to park — most of the time people leave in the middle of the
 * road, illegally parked."*
 *
 * So a mapped car park is evidence that somebody expected walkers here, and
 * **not** evidence of where they actually begin. What survives as a real signal
 * is the **signed guidepost** — the regional government marks its PR routes at
 * the entrance — and the point where the path meets a road at all.
 */
const ACCESS_SIGNALS = [
  { score: 2, label: 'parking', match: (t) => t.amenity === 'parking' },
  {
    score: 5,
    label: 'trail sign',
    match: (t) => t.information === 'guidepost' || t.information === 'board',
  },
  { score: 3, label: 'bus stop', match: (t) => t.highway === 'bus_stop' || t.public_transport === 'platform' },
  { score: 2, label: 'café/restaurant', match: (t) => t.amenity === 'cafe' || t.amenity === 'restaurant' },
  { score: 2, label: 'viewpoint', match: (t) => t.tourism === 'viewpoint' },
  { score: 3, label: 'road', match: (t) => typeof t.highway === 'string' && DRIVEABLE.has(t.highway) },
];

const DRIVEABLE = new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
  'unclassified', 'residential', 'service', 'track',
]);

/**
 * The free ends of a course: a coordinate that exactly one drawn line touches.
 *
 * The same rule `build-levadas.mjs` uses, and for the same reason — an endpoint
 * shared by two lines is a join in the middle of the network, not an end of it.
 * A levada with side spurs has more than two, which is why they are ranked
 * below rather than assumed to be a pair.
 */
function freeEnds(lines) {
  const key = (point) => `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
  const seen = new Map();

  for (const line of lines) {
    for (const point of [line[0], line[line.length - 1]]) {
      const id = key(point);
      const entry = seen.get(id);
      if (entry === undefined) {
        seen.set(id, { lon: point[0], lat: point[1], count: 1 });
      } else {
        entry.count += 1;
      }
    }
  }

  return [...seen.values()].filter((end) => end.count === 1);
}

/** Total drawn length of a course, in kilometres. */
function courseKm(lines) {
  let metres = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      metres += metresBetween(
        { lat: line[i - 1][1], lon: line[i - 1][0] },
        { lat: line[i][1], lon: line[i][0] }
      );
    }
  }
  return metres / 1000;
}

/** Everything that might indicate access, near every end, in one request. */
async function fetchAccess(ends) {
  const clauses = ends
    .map((end) => `nwr(around:${ACCESS_RADIUS_M},${end.lat},${end.lon});`)
    .join('\n  ');

  const result = await overpass(
    `[out:json][timeout:300];\n(\n  ${clauses}\n);\nout center tags;`,
    { tool: 'levada-ends' }
  );

  return (result.elements ?? []).flatMap((element) => {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat === undefined || lon === undefined) {
      return [];
    }
    return [{ lat, lon, tags: element.tags ?? {} }];
  });
}

/** What is near this end, and how strongly it says "walkers start here". */
function accessFor(end, features) {
  const found = new Map();

  for (const feature of features) {
    const metres = metresBetween(end, feature);
    if (metres > ACCESS_RADIUS_M) {
      continue;
    }
    for (const signal of ACCESS_SIGNALS) {
      if (!signal.match(feature.tags)) {
        continue;
      }
      const existing = found.get(signal.label);
      const name = typeof feature.tags.name === 'string' ? feature.tags.name : null;
      if (existing === undefined || metres < existing.metres) {
        found.set(signal.label, { score: signal.score, metres: Math.round(metres), name });
      }
    }
  }

  const score = [...found.values()].reduce((sum, item) => sum + item.score, 0);
  return { score, found };
}

/**
 * The two ends that make a *walk*: well-served, and far apart.
 *
 * ⚠ **Ranking by access alone was wrong, and the output said so.** For Levada
 * das 25 Fontes it proposed two ends **450 m apart**, both beside the Rabaçal
 * trail sign — a perfectly-evidenced pair that a walker crosses in six minutes
 * without walking the levada at all. The far end, which is the actual
 * destination, scored lower because there is nothing built out there.
 *
 * So: keep only pairs that span at least `MIN_SPAN_FRACTION` of the widest
 * separation available, and rank those by evidence. Access decides *which*
 * trailhead; distance decides that it is a trailhead pair at all.
 */
const MIN_SPAN_FRACTION = 0.6;

function bestPair(ranked) {
  if (ranked.length < 2) {
    return ranked;
  }

  let widest = 0;
  for (let i = 0; i < ranked.length; i += 1) {
    for (let j = i + 1; j < ranked.length; j += 1) {
      widest = Math.max(widest, metresBetween(ranked[i].end, ranked[j].end));
    }
  }

  let best = null;
  for (let i = 0; i < ranked.length; i += 1) {
    for (let j = i + 1; j < ranked.length; j += 1) {
      const span = metresBetween(ranked[i].end, ranked[j].end);
      if (span < widest * MIN_SPAN_FRACTION) {
        continue;
      }
      const score = ranked[i].access.score + ranked[j].access.score;
      if (best === null || score > best.score) {
        best = { score, pair: [ranked[i], ranked[j]] };
      }
    }
  }

  return best === null ? ranked.slice(0, 2) : best.pair;
}

function describe(access) {
  if (access.found.size === 0) {
    return 'nothing — the way simply stops here';
  }
  return [...access.found.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .map(([label, item]) => `${label}${item.name === null ? '' : ` (${item.name})`} ${item.metres} m`)
    .join(', ');
}

async function main() {
  const pack = JSON.parse(readFileSync(path.join(root, 'content', 'pois.json'), 'utf8'));
  const courses = JSON.parse(readFileSync(path.join(root, 'content', 'levadas.json'), 'utf8'));

  const levadas = [];
  for (const feature of courses.features ?? []) {
    const place = (pack.places ?? []).find((p) => p.id === feature.properties?.placeId);
    if (place === undefined) {
      continue;
    }
    const lines = feature.geometry.coordinates;
    levadas.push({ place, lines, ends: freeEnds(lines), km: courseKm(lines) });
  }

  if (levadas.length === 0) {
    console.log('No levada has a course. Run: node tools/build-levadas.mjs');
    return;
  }

  const allEnds = levadas.flatMap((levada) => levada.ends);
  process.stdout.write(`asking OSM what is at ${allEnds.length} path ends … `);
  const features = await fetchAccess(allEnds);
  console.log(`${features.length} features`);

  const report = [];
  report.push('# Levada endpoints — proposed, for you to correct');
  report.push('');
  report.push(`**Generated:** \`node tools/levada-ends.mjs\`. **Rule:** an end of a drawn path is`);
  report.push('a *trailhead* when somebody built something there — parking, a signed guidepost, a');
  report.push('bus stop, a café. Ends are ranked by that and the two best-served are proposed.');
  report.push('');
  report.push('⚠ **This is a machine looking at what is mapped near a point.** It cannot know that');
  report.push('the gate is locked, that the parking fills by nine, or that everybody actually starts');
  report.push('from the other side. Correct it.');
  report.push('');

  for (const levada of levadas.sort((a, b) => a.place.name.localeCompare(b.place.name))) {
    const ranked = levada.ends
      .map((end) => ({ end, access: accessFor(end, features) }))
      .sort((a, b) => b.access.score - a.access.score);

    const proposed = bestPair(ranked);
    const current = levada.place.geofences;

    report.push(`## ${levada.place.name}`);
    report.push('');
    report.push(
      `${levada.km.toFixed(1)} km drawn · ${levada.ends.length} free end(s) · ` +
        `${levada.lines.length} way segments`
    );
    report.push('');

    if (proposed.length < 2) {
      report.push('⚠ **Fewer than two free ends** — the course is a loop, or one continuous line.');
      report.push('These need your two points outright; there is nothing to rank.');
      report.push('');
    }

    report.push('| | lat, lon | what is there | score |');
    report.push('|---|---|---|---|');
    const shown = [
      ...proposed,
      ...ranked.filter((item) => !proposed.includes(item)).slice(0, 2),
    ];
    for (const [index, item] of shown.entries()) {
      const role = index === 0 ? '**proposed start**' : index === 1 ? '**proposed end**' : 'also';
      report.push(
        `| ${role} | \`${item.end.lat.toFixed(5)}, ${item.end.lon.toFixed(5)}\` | ` +
          `${describe(item.access)} | ${item.access.score} |`
      );
    }
    report.push('');

    const moved = proposed.map((item, index) => {
      const existing = current[index];
      if (existing === undefined) {
        return null;
      }
      return Math.round(metresBetween(existing, item.end));
    });
    report.push(
      `Currently curated: ${current
        .map((g) => `\`${g.lat}, ${g.lon}\`${g.role === undefined ? '' : ` (${g.role})`}`)
        .join(' and ')} — ` +
        `moved by ${moved.filter((m) => m !== null).map((m) => `${m} m`).join(' / ')}`
    );
    report.push('');

    if (proposed.every((item) => item.access.score === 0)) {
      report.push('⚠ **No access evidence at either end.** OSM knows nothing about how anyone');
      report.push('reaches this levada, so both points are guesses. **This is a levada where');
      report.push('coverage crediting (D-065) will be doing all the work.**');
      report.push('');
    }
  }

  const outDir = path.join(root, 'tools', 'out');
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'levada-ends.md');
  writeFileSync(out, `${report.join('\n')}\n`);

  console.log();
  for (const levada of levadas) {
    const ranked = levada.ends
      .map((end) => ({ end, access: accessFor(end, features) }))
      .sort((a, b) => b.access.score - a.access.score);
    const pair = bestPair(ranked);
    const best = pair[0]?.access.score ?? 0;
    const second = pair[1]?.access.score ?? 0;
    const span = pair.length === 2 ? metresBetween(pair[0].end, pair[1].end) / 1000 : 0;
    const flag = best === 0 ? '⚠ no access evidence' : second === 0 ? '⚠ one end unserved' : '';
    console.log(
      `  ${levada.place.name.padEnd(30)} ${levada.km.toFixed(1).padStart(5)} km · ` +
        `${String(levada.ends.length).padStart(2)} ends · pair ${best}/${second} · ` +
        `${span.toFixed(1)} km apart ${flag}`
    );
  }
  console.log();
  console.log('Wrote tools/out/levada-ends.md');
}

await main();
