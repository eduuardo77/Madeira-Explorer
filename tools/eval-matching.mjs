/**
 * How well the road matcher does, on the real network (D-093).
 *
 *     node tools/eval-matching.mjs                       # synthetic scenarios on content/roads.json
 *     node tools/eval-matching.mjs --db <madeira.db>     # also: a real database, trip by trip
 *     node tools/eval-matching.mjs --db <db> --roads <roads.json> --since 2026-08-01 --until 2026-09-01
 *
 * Two kinds of evidence, kept apart because they answer different questions:
 *
 *   - **Synthetic trips** (`tools/lib/syntheticTrips.mjs`) have ground truth,
 *     so they give recall (how much of the true route lit up) and precision
 *     (how much of what lit up is right). They say whether the matcher does
 *     what it was built to do, on a model of GPS error.
 *   - **A real database** has no ground truth. What it gives is the lit
 *     length, chain by chain, and a picture (`--svg`), which is how the desk's
 *     drift and the August drives were judged.
 *
 * ⚠ Real databases are unmasked movement: keep them and anything drawn from
 * them outside the repository (D-016, D-040). `--svg` refuses to write inside it.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { drivenRoute, randomRoute, rng, sampleTrip, score } from './lib/syntheticTrips.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const load = (p) => import(pathToFileURL(path.join(root, 'app/src/matching', p)).href);

const { decodeRoadGraph, nearbyEdges, pointAt } = await load('roadGraph.ts');

const { matchTrace } = await load('mapMatch.ts');
const routing = await load('roadRouting.ts');
const { visitedEdges, visitedLengthM, visitedLines } = await load('visitedRoads.ts');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

const roadsPath = path.resolve(arg('--roads', path.join(root, 'content/roads.json')));
let started = Date.now();
const graph = decodeRoadGraph(JSON.parse(readFileSync(roadsPath, 'utf8')));
console.log(
  `graph: ${graph.edgeCount} edges, decoded and indexed in ${Date.now() - started} ms`
);

function nearestEdge(lat, lon, kinds) {
  const found = nearbyEdges(graph, lat, lon, 3000, 5000).filter((c) =>
    kinds.includes(graph.edgeKindCodes[c.edge].toLowerCase())
  );
  if (found.length === 0) {
    throw new Error(`no ${kinds} edge near ${lat},${lon}`);
  }
  return found[0].edge;
}

const SCENARIOS = [
  // An outing in Funchal: the precise tier, a fix every 10 s at ±5 m.
  { name: 'walk, Funchal, outing (10 s)', at: [32.6496, -16.9086], kinds: 'rfp', lengthM: 2500,
    speedMps: 1.4, intervalS: 10, sigmaM: 5, correlationS: 60, outlierRate: 0.01, accuracyM: 6 },
  // Automatic recording: the walking profile, 30 s, balanced accuracy.
  { name: 'walk, Funchal, automatic (30 s)', at: [32.6496, -16.9086], kinds: 'rfp', lengthM: 2500,
    speedMps: 1.4, intervalS: 30, sigmaM: 10, correlationS: 90, outlierRate: 0.02, accuracyM: 15 },
  { name: 'walk, Funchal old town, noisy (10 s)', at: [32.6480, -16.9020], kinds: 'rf', lengthM: 2000,
    speedMps: 1.2, intervalS: 10, sigmaM: 10, correlationS: 60, outlierRate: 0.03, accuracyM: 12 },
  { name: 'drive, town and main roads (15 s)', driven: true, at: [32.6560, -16.9200], kinds: 'mpr', lengthM: 12000,
    speedMps: 12, intervalS: 15, sigmaM: 5, correlationS: 60, outlierRate: 0.01, accuracyM: 5 },
  { name: 'drive, automatic (30 s)', driven: true, at: [32.6560, -16.9200], kinds: 'mpr', lengthM: 12000,
    speedMps: 12, intervalS: 30, sigmaM: 8, correlationS: 90, outlierRate: 0.01, accuracyM: 10 },
  { name: 'drive, VR1 with tunnels, no fixes inside', driven: true, at: [32.6468, -16.8790], kinds: 'm', lengthM: 15000,
    speedMps: 24, intervalS: 15, sigmaM: 5, correlationS: 60, outlierRate: 0, accuracyM: 5, dropTunnels: true },
  { name: 'levada and trail walk, canopy (15 s)', at: [32.7836, -16.9023], kinds: 'fl', lengthM: 3000,
    speedMps: 1.0, intervalS: 15, sigmaM: 15, correlationS: 90, outlierRate: 0.03, accuracyM: 25 },
];

const SEEDS = Number(arg('--seeds', '8'));
// `--draw <scenario number> --out <dir>`: one SVG per seed, truth in green.
const DRAW = arg('--draw', null);
const DRAW_DIR = arg('--out', null);

console.log('\nSYNTHETIC (recall = true route lit; precision = lit road that is right)');
for (const scenario of SCENARIOS) {
  const startEdge = nearestEdge(scenario.at[0], scenario.at[1], scenario.kinds);
  let recall = 0;
  let precision = 0;
  let wrongM = 0;
  let truthM = 0;
  let fixes = 0;
  let ms = 0;
  let worstPrecision = 1;
  let runs = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const random = rng(seed * 7919);
    const steps = scenario.driven
      ? drivenRoute(graph, routing, startEdge, scenario.lengthM, random, scenario.kinds)
      : randomRoute(graph, startEdge, scenario.lengthM, random, scenario.kinds);
    const trip = sampleTrip(graph, pointAt, steps, random, scenario);
    if (trip.fixes.length < 10) {
      // The generator gave up early (a dead-end start). Not a matching result.
      continue;
    }
    runs += 1;
    started = performance.now();
    const { chains } = matchTrace(graph, trip.fixes);
    const visited = visitedEdges(graph, chains);
    ms += performance.now() - started;
    const s = score(graph, steps, visited);
    if (DRAW !== null && Number(DRAW) === SCENARIOS.indexOf(scenario) && DRAW_DIR !== null) {
      const truth = steps.map((step) => edgeSliceAll(step.edge));
      writeFileSync(
        path.join(DRAW_DIR, `scenario${DRAW}-seed${seed}.svg`),
        drawSvg([{ fixes: trip.fixes, lines: visitedLines(graph, visited), truth }])
      );
      console.log(`  seed ${seed}: recall ${(100 * s.recall).toFixed(0)}% precision ${(100 * s.precision).toFixed(0)}%`);
    }
    recall += s.recall;
    precision += s.precision;
    worstPrecision = Math.min(worstPrecision, s.precision);
    wrongM += s.wrongM;
    truthM += s.truthM;
    fixes += trip.fixes.length;
  }
  console.log(
    `${scenario.name.padEnd(42)} recall ${(100 * recall / runs).toFixed(1)}%  ` +
      `precision ${(100 * precision / runs).toFixed(1)}% (worst ${(100 * worstPrecision).toFixed(0)}%)  ` +
      `wrong ${(wrongM / runs).toFixed(0)} m per ${(truthM / runs / 1000).toFixed(1)} km  ` +
      `${(ms / fixes).toFixed(2)} ms/fix`
  );
}

const dbPath = arg('--db', null);
if (dbPath !== null) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const since = Date.parse(arg('--since', '2000-01-01'));
  const until = Date.parse(arg('--until', '2100-01-01'));
  const rows = db
    .prepare(
      `SELECT trip_id, ts, lat, lon, accuracy_m, speed_mps FROM raw_fix
        WHERE ts >= ? AND ts < ? ORDER BY ts`
    )
    .all(since, until);
  const byTrip = new Map();
  for (const row of rows) {
    if (!byTrip.has(row.trip_id)) byTrip.set(row.trip_id, []);
    byTrip.get(row.trip_id).push(row);
  }
  console.log(`\nREAL: ${path.basename(path.dirname(dbPath))}, ${rows.length} fixes`);
  const allLines = [];
  for (const [trip, fixes] of byTrip) {
    started = performance.now();
    const { chains, stats } = matchTrace(graph, fixes);
    const visited = visitedEdges(graph, chains);
    const ms = performance.now() - started;
    const lines = visitedLines(graph, visited);
    allLines.push({ trip, fixes, lines });
    console.log(
      `trip ${trip}: ${stats.fixesIn} fixes, ${stats.fixesMoving} moving, ${stats.fixesMatched} matched, ` +
        `${stats.chains} chains (${stats.chainsDropped} dropped), lit ${visitedLengthM(visited).toFixed(0)} m, ` +
        `${lines.length} lines, ${ms.toFixed(0)} ms` +
        chains.map((c) => ` [${c.anchors.length} fixes, conf ${c.confidence.toFixed(2)}]`).join('')
    );
  }
  const svg = arg('--svg', null);
  if (svg !== null) {
    const out = path.resolve(svg);
    if (out.startsWith(root + path.sep)) {
      throw new Error('refusing to draw real movement inside the repository (D-016, D-040)');
    }
    writeFileSync(out, drawSvg(allLines));
    console.log(`→ ${out}`);
  }
}

function edgeSliceAll(edge) {
  const out = [];
  for (let p = graph.pointStart[edge]; p < graph.pointStart[edge + 1]; p += 1) {
    out.push([graph.lat[p], graph.lon[p]]);
  }
  return out;
}

/** Roads near the data in grey, truth in green, lit roads in blue, fixes as dots. */
function drawSvg(trips) {
  const fixes = trips.flatMap((t) => t.fixes);
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  for (const f of fixes) {
    south = Math.min(south, f.lat); north = Math.max(north, f.lat);
    west = Math.min(west, f.lon); east = Math.max(east, f.lon);
  }
  const pad = 0.002;
  south -= pad; north += pad; west -= pad; east += pad;
  const scaleX = Math.cos(((south + north) / 2) * Math.PI / 180);
  const width = 1400;
  const height = Math.round(width * (north - south) / ((east - west) * scaleX));
  const x = (lon) => ((lon - west) / (east - west) * width).toFixed(1);
  const y = (lat) => ((north - lat) / (north - south) * height).toFixed(1);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:#f4f1ea">`];
  for (let e = 0; e < graph.edgeCount; e += 1) {
    const p0 = graph.pointStart[e];
    if (graph.lat[p0] < south || graph.lat[p0] > north || graph.lon[p0] < west || graph.lon[p0] > east) continue;
    let d = '';
    for (let p = p0; p < graph.pointStart[e + 1]; p += 1) d += `${p === p0 ? 'M' : 'L'}${x(graph.lon[p])},${y(graph.lat[p])}`;
    parts.push(`<path d="${d}" fill="none" stroke="#b8b2a6" stroke-width="1.5"/>`);
  }
  for (const t of trips) {
    for (const line of t.truth ?? []) {
      const d = line.map(([la, lo], i) => `${i === 0 ? 'M' : 'L'}${x(lo)},${y(la)}`).join('');
      parts.push(`<path d="${d}" fill="none" stroke="#2a2" stroke-width="11" stroke-linecap="round" opacity="0.35"/>`);
    }
  }
  for (const t of trips) {
    for (const line of t.lines) {
      const d = line.points.map(([la, lo], i) => `${i === 0 ? 'M' : 'L'}${x(lo)},${y(la)}`).join('');
      parts.push(`<path d="${d}" fill="none" stroke="#0A5FCC" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" opacity="${line.tunnel ? 0.35 : 0.85}"/>`);
    }
    for (const f of t.fixes) {
      parts.push(`<circle cx="${x(f.lon)}" cy="${y(f.lat)}" r="2.2" fill="${f.speed_mps > 0.5 ? '#d33' : '#999'}"/>`);
    }
  }
  parts.push('</svg>');
  return parts.join('\n');
}
