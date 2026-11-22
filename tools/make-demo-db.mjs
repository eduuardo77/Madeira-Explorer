/**
 * A modelled month on the island, written into a copy of the app's database,
 * for store screenshots and the site (T-317). Nobody drove any of it (D-016).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/make-demo-db.mjs <in.db> <out.db>
 *
 * `<in.db>` is a database the current app has opened (so its schema is
 * current); every recorded row is removed and replaced by day drives routed
 * on `content/roads.json` through the places listed in DAYS, sampled like a
 * phone in a car (`sampleTrip`). A place earns its stamp when a drive passes
 * inside its geofence. The app matches the fixes itself when it opens.
 *
 * ⚠ For pictures only. It is a model, not a trip, and no threshold may be
 * tuned against it (CONTEXT §6.6).
 */

import { copyFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rng } from './lib/syntheticTrips.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const load = (p) => import(pathToFileURL(path.join(root, 'app/src/matching', p)).href);
const { decodeRoadGraph, nearbyEdges, pointAt } = await load('roadGraph.ts');
const routing = await load('roadRouting.ts');

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: make-demo-db.mjs <in.db> <out.db>');

/** One drive a day, through these places in order. */
const DAYS = [
  { date: '2026-10-24', via: ['forte-de-sao-tiago', 'mercado-dos-lavradores', 'se-do-funchal', 'teatro-municipal-baltazar-dias', 'quinta-da-boa-vista'] },
  { date: '2026-10-26', via: ['se-do-funchal', 'camara-de-lobos', 'cabo-girao', 'ribeira-brava', 'ponta-do-sol', 'calheta', 'praia-da-calheta', 'jardim-do-mar', 'paul-do-mar'] },
  { date: '2026-10-28', via: ['quinta-da-boa-vista', 'jardim-botanico-da-madeira', 'monte', 'jardim-tropical-monte-palace', 'camacha'] },
  { date: '2026-10-31', via: ['ribeira-brava', 'boca-da-encumeada', 'sao-vicente', 'grutas-e-centro-do-vulcanismo', 'seixal', 'praia-do-porto-do-seixal', 'porto-moniz', 'piscinas-naturais-do-porto-moniz', 'forte-de-sao-joao-baptista'] },
  { date: '2026-11-03', via: ['ponta-do-garajau', 'santa-cruz', 'machico', 'pico-do-facho', 'canical', 'prainha', 'ponta-de-sao-lourenco'] },
  { date: '2026-11-07', via: ['camacha', 'miradouro-da-portela', 'porto-da-cruz', 'santana', 'parque-tematico-da-madeira'] },
  { date: '2026-11-10', via: ['pico-dos-barcelos', 'eira-do-serrado', 'curral-das-freiras'] },
  { date: '2026-11-14', via: ['monte', 'pico-do-areeiro'] },
  { date: '2026-11-17', via: ['quinta-da-boa-vista', 'se-do-funchal', 'praia-formosa', 'camara-de-lobos'] },
  { date: '2026-11-19', via: ['praia-formosa', 'pico-dos-barcelos', 'jardim-botanico-da-madeira', 'ponta-do-garajau', 'santa-cruz'] },
  { date: '2026-11-22', via: ['calheta', 'farol-da-ponta-do-pargo', 'teleferico-das-achadas-da-cruz', 'porto-moniz'] },
];
const DRIVE = 'mpr'; // motorway, primary, residential, and their tunnels

const pois = JSON.parse(readFileSync(path.join(root, 'content/pois.json'), 'utf8'));
const places = new Map(pois.places.map((place) => [place.id, place]));
const graph = decodeRoadGraph(JSON.parse(readFileSync(path.join(root, 'content/roads.json'), 'utf8')));
const allowed = (e) => DRIVE.includes(graph.edgeKindCodes[e].toLowerCase());
const scratch = routing.createScratch(graph);
const random = rng(11);

const metres = (a, b) =>
  Math.hypot((a.lat - b.lat) * 110_540, (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180));

function roadNear(id) {
  const fence = places.get(id)?.geofences[0];
  if (fence === undefined) throw new Error(`no place ${id}`);
  // Several candidates, nearest first, each at its nearest point to the place:
  // the nearest piece of road can be cut off from the network or reached only
  // the long way round, and the route then tries the next.
  const near = nearbyEdges(graph, fence.lat, fence.lon, 3000, 2000).filter((c) => allowed(c.edge)).slice(0, 12);
  if (near.length === 0) throw new Error(`no road near ${id}`);
  return near;
}

/** Routed pieces through the stops: { edge, from, to } in metres along each edge. */
function route(stops) {
  const pieces = [];
  let sources = stops[0];
  for (let i = 1; i < stops.length; i += 1) {
    let leg = null;
    search: for (const from of sources) {
      for (const to of stops[i]) {
        leg = routing.routeBetween(graph, scratch, from, to, 80_000, allowed);
        const roadM = leg?.reduce((sum, p) => sum + Math.abs(p.to - p.from), 0) ?? Infinity;
        if (roadM > 2.5 * metres(from, to) + 3000) leg = null; // the long way round
        if (leg !== null) {
          sources = [to];
          break search;
        }
      }
    }
    // A place on a piece of road the graph does not connect (Portela): skipped.
    if (leg === null) {
      console.warn(`  no route to ${i}, skipped`);
      continue;
    }
    pieces.push(...leg.filter((p) => p.to !== p.from));
  }
  return pieces;
}

function gaussian() {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

/** Fixes every `intervalS` at `speedMps` along the pieces, with a wandering error; none in tunnels. */
function drive(pieces, startMs, speedMps = 11, intervalS = 2, sigmaM = 4, correlationS = 60) {
  const keep = Math.exp(-intervalS / correlationS);
  const kick = sigmaM * Math.sqrt(1 - keep * keep);
  const out = [];
  let ox = 0;
  let oy = 0;
  let t = 0;
  let carry = 0;
  for (const piece of pieces) {
    const length = Math.abs(piece.to - piece.from);
    const sign = piece.to >= piece.from ? 1 : -1;
    const code = graph.edgeKindCodes[piece.edge];
    for (let d = carry; d < length; d += speedMps * intervalS) {
      ox = keep * ox + kick * gaussian();
      oy = keep * oy + kick * gaussian();
      t += intervalS;
      if (code !== code.toLowerCase()) continue; // no GPS in a tunnel
      const [lat, lon] = pointAt(graph, piece.edge, piece.from + sign * d);
      out.push({
        ts: startMs + t * 1000,
        lat: lat + oy / 110_540,
        lon: lon + ox / (111_320 * Math.cos((lat * Math.PI) / 180)),
        accuracy_m: 8,
        speed_mps: Math.max(0.5, speedMps + 0.4 * gaussian()),
        activity: 'driving',
      });
      carry = d + speedMps * intervalS - length;
    }
  }
  return out;
}

const metresOf = (pieces) => pieces.reduce((sum, p) => sum + Math.abs(p.to - p.from), 0);

const fixes = [];
const awards = new Map();
for (const day of DAYS) {
  const pieces = route(day.via.map(roadNear));
  const day_fixes = drive(pieces, Date.parse(`${day.date}T09:40:00Z`));
  fixes.push(...day_fixes);
  for (const place of pois.places) {
    if (awards.has(place.id) || place.geofences[0].lat > 32.95) continue; // Porto Santo: no drives there
    const fence = place.geofences[0];
    const inside = day_fixes.find((fix) => metres(fix, fence) <= fence.radiusM + 60);
    if (inside !== undefined) awards.set(place.id, inside.ts);
  }
  console.log(`${day.date}: ${Math.round(metresOf(pieces) / 1000)} km, ${day_fixes.length} fixes`);
}

copyFileSync(input, output);
const db = new DatabaseSync(output);
db.exec('PRAGMA journal_mode = DELETE');
db.exec('PRAGMA foreign_keys = OFF');
for (const table of ['trip', 'raw_fix', 'sensor_sample', 'geofence_event', 'recording_event', 'stamp_award', 'matched_chain', 'match_progress', 'activity_event']) {
  db.exec(`DELETE FROM ${table}`);
}
db.exec("DELETE FROM sqlite_sequence");
for (const key of ['map_snapshot', 'passport_summary', 'stamps_shown', 'stamps_notified', 'map_seen_until_ts', 'dev_poi_fixture', 'geofence_working_set', 'notifications_sent', 'paused_until', 'walk_started_ts']) {
  db.prepare('DELETE FROM app_state WHERE key = ?').run(key);
}
db.prepare('INSERT INTO trip (id, started_ts, ended_ts, end_detection_method) VALUES (1, ?, NULL, NULL)').run(fixes[0].ts - 60_000);
const insertFix = db.prepare(
  "INSERT INTO raw_fix (trip_id, ts, lat, lon, accuracy_m, speed_mps, bearing_deg, altitude_m, activity_type, source) VALUES (1, ?, ?, ?, ?, ?, NULL, NULL, ?, 'fused')"
);
db.exec('BEGIN');
for (const f of fixes) insertFix.run(f.ts, f.lat, f.lon, f.accuracy_m, f.speed_mps, f.activity);
const insertAward = db.prepare(
  "INSERT INTO stamp_award (trip_id, place_id, awarded_ts, dwell_seconds, mean_speed_mps, confidence, reason) VALUES (1, ?, ?, 900, NULL, 0.6, 'modelled demo, not a visit')"
);
for (const [id, ts] of [...awards].sort((a, b) => a[1] - b[1])) insertAward.run(id, ts);
// Every stamp already shown and announced, so no pop-up waits on the first open.
const seen = JSON.stringify([...awards.keys()]);
for (const key of ['stamps_shown', 'stamps_notified']) {
  db.prepare('INSERT OR REPLACE INTO app_state (key, value, updated_ts) VALUES (?, ?, ?)').run(key, seen, Date.now());
}
// Shown as a buyer sees it: the stamps in colour, no offer in the way.
db.prepare("INSERT OR REPLACE INTO app_state (key, value, updated_ts) VALUES ('stamps_unlocked', 'true', ?)").run(Date.now());
db.exec('COMMIT');
db.close();
console.log(`${output}: ${fixes.length} fixes, ${awards.size} stamps: ${[...awards.keys()].join(' ')}`);
