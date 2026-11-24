/**
 * The film as a video someone can keep, drawn on Bruma's own island (sketch, 24 Nov 2026).
 *
 *     node tools/preview-video-options.mjs --db <madeira.db> [--trip 31] [--day 2026-11-21]
 *     → tools/out/video-options.html   (open it in a browser; it plays)
 *
 * ⚠ WHY NOT GOOGLE'S MAP. The in-app film is Google's map played back (D-076).
 * A video that leaves the phone cannot be: the Maps SDK's `snapshot()` docs say
 * images of the map must not be "used outside of the application", and the
 * Maps Platform terms (3.2.3 a, No Scraping) forbid exporting or resharing
 * Google Maps Content outside the Services. So the exported video draws only
 * what Bruma ships itself, from OpenStreetMap (ODbL): the municipalities
 * (`content/regions.json`) and every road (`content/roads.json`).
 *
 * The film's plan is the app's own: the trip is matched with `matchTrace`,
 * masked around the accommodation as every export is (D-040, 300 m), composed by
 * `composeSouvenir`, and framed by `frameAt`. Only the pixels are this file's.
 * Stamps landing are placed where the pen first passes within 250 m of the
 * place, a sketch's stand-in for the award time.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.removeAllListeners('warning');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(pathToFileURL(path.join(root, 'app/src', p)).href);

const { decodeRoadGraph } = await load('matching/roadGraph.ts');
const { matchTrace } = await load('matching/mapMatch.ts');
const { chainTimedRuns, clipOutsideCircle } = await load('matching/roadTrace.ts');
const { activitiesAt } = await load('recording/activityTimeline.ts');
const { keepSimplified } = await load('map/simplifyLine.ts');
const { distanceM } = await load('recording/distance.ts');
const { composeSouvenir } = await load('souvenir/composition.ts');
const { frameAt, frameTimes } = await load('souvenir/frame.ts');
const { cameraPath } = await load('souvenir/replayMap.ts');
const { detectAccommodation, maskTrace, MASK_RADIUS_M } = await load('souvenir/accommodation.ts');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const dbPath = arg('db', null);
if (dbPath === null) throw new Error('--db <madeira.db> is required');
const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync(dbPath, { readOnly: true });
const tripId = Number(arg('trip', db.prepare('SELECT max(id) AS id FROM trip').get().id));
const trip = db.prepare('SELECT * FROM trip WHERE id = ?').get(tripId);
const day = arg('day', null);
const fromTs = day === null ? -Infinity : new Date(`${day}T00:00:00`).getTime();
const toTs = day === null ? Infinity : fromTs + 24 * 3600_000;
const inRange = (ts) => ts >= fromTs && ts < toTs;

// --- the trip, masked as an export is ---------------------------------------

const allFixes = db
  .prepare('SELECT ts, lat, lon, accuracy_m, speed_mps FROM raw_fix WHERE trip_id = ? ORDER BY ts')
  .all(tripId);
const accommodation = detectAccommodation(allFixes);
const hadOvernight = allFixes.some((fix) => {
  const hour = new Date(fix.ts).getHours();
  return hour >= 1 && hour < 5;
});
const masked = maskTrace(allFixes, accommodation, hadOvernight);
if (masked.fixes.length === 0) throw new Error(`nothing safe to show: ${masked.reason}`);
console.log(`mask: ${masked.reason}`);

const events = db.prepare('SELECT ts, activity, transition FROM activity_event ORDER BY ts').all();
const labels = activitiesAt(events, masked.fixes.map((fix) => fix.ts));
const graph = decodeRoadGraph(JSON.parse(readFileSync(path.join(root, 'content/roads.json'), 'utf8')));
const { chains } = matchTrace(graph, masked.fixes.map((fix, i) => ({ ...fix, activity: labels[i] })));

const roads = [];
for (const chain of chains) {
  for (const run of chainTimedRuns(graph, chain)) {
    const pieces = accommodation === null ? [run.points] : clipOutsideCircle(run.points, accommodation, MASK_RADIUS_M);
    for (const piece of pieces) {
      const fixes = keepSimplified(piece.filter((p) => inRange(p.ts)).map((p) => ({ ...p, accuracy_m: null })));
      if (fixes.length >= 2) roads.push({ faded: run.faded, fixes });
    }
  }
}

const awards = db
  .prepare('SELECT place_id, awarded_ts FROM stamp_award WHERE trip_id = ? ORDER BY awarded_ts')
  .all(tripId)
  .filter((award) => inRange(award.awarded_ts));
const pack = JSON.parse(readFileSync(path.join(root, 'content/pois.json'), 'utf8'));
const regionIsland = new Map(
  JSON.parse(readFileSync(path.join(root, 'content/regions.json'), 'utf8')).features.map((f) => [f.properties.id, f.properties.islandId])
);
const madeiraPlaces = pack.places.filter((place) => regionIsland.get(place.regionId) === 'ilha-da-madeira');
const places = new Map(madeiraPlaces.map((place) => [place.id, { ...place, lat: place.geofences[0].lat, lon: place.geofences[0].lon }]));
const madeiraTotal = madeiraPlaces.length;

const film = composeSouvenir({
  trace: { fixes: masked.fixes.filter((fix) => inRange(fix.ts)), safeToShare: true, reason: 'video sketch' },
  stamps: awards.filter((a) => places.has(a.place_id)).map((a) => ({ placeId: a.place_id, awardedTs: a.awarded_ts })),
  totalPlaces: madeiraTotal,
  gapThresholdMs: 30 * 60_000,
  roads,
});
if (!film.renderable) throw new Error(`no film: ${film.reason}`);

// --- what the browser needs -------------------------------------------------

const q = (v) => Math.round(v * 1e5);
const segments = film.scenes
  .filter((scene) => scene.kind === 'draw')
  .flatMap((scene) => scene.segments)
  .map((segment) => ({
    c: segment.coordinates.map(([lon, lat]) => [q(lon), q(lat)]),
    t: segment.timesMs.map(Math.round),
  }));

// Road lit so far, each 40 m cell once: an approximation of the app's
// `onceEachStretch` that survives simplification. Labelled as such on the page.
const cellOf = (lat, lon) => `${Math.round(lat / 0.00036)},${Math.round(lon / 0.00043)}`;
const seen = new Set();
let litM = 0;
const kmSteps = []; // [atMs, km]
const ordered = segments
  .flatMap((s) => s.c.slice(1).map((point, i) => ({ a: s.c[i], b: point, at: s.t[i + 1] })))
  .sort((x, y) => x.at - y.at);
for (const step of ordered) {
  const a = { lat: step.a[1] / 1e5, lon: step.a[0] / 1e5 };
  const b = { lat: step.b[1] / 1e5, lon: step.b[0] / 1e5 };
  const cell = cellOf((a.lat + b.lat) / 2, (a.lon + b.lon) / 2);
  if (!seen.has(cell)) {
    seen.add(cell);
    litM += distanceM(a, b);
  }
  kmSteps.push([step.at, Math.round(litM / 100) / 10]);
}

// When each stamp lands: the pen's first pass within 250 m of the place.
const stamps = [];
for (const award of awards) {
  const place = places.get(award.place_id);
  if (place === undefined) continue;
  let best = null;
  for (const step of ordered) {
    const d = distanceM({ lat: place.lat, lon: place.lon }, { lat: step.b[1] / 1e5, lon: step.b[0] / 1e5 });
    if (d < 250) {
      best = step.at;
      break;
    }
  }
  if (best !== null) stamps.push({ at: best, lon: q(place.lon), lat: q(place.lat), name: place.name, category: place.category });
}

// The camera, frame by frame, from the app's storyboard.
const times = frameTimes(film);
const camera = times.map((at) => {
  const b = frameAt(film, at).bounds;
  return [at, q(b.west), q(b.south), q(b.east), q(b.north)];
});

// The island: municipalities of the main island, and every road but footpaths.
const regions = JSON.parse(readFileSync(path.join(root, 'content/regions.json'), 'utf8'));
const outlines = [];
for (const feature of regions.features) {
  if (feature.properties.islandId !== 'ilha-da-madeira') continue;
  const polys = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  for (const poly of polys) outlines.push(poly[0].filter((_, i) => i % 2 === 0).map(([lon, lat]) => [q(lon), q(lat)]));
}
const roadLines = { major: [], minor: [] };
for (let e = 0; e < graph.edgeCount; e += 1) {
  const kind = graph.edgeKindCodes[e].toLowerCase();
  if (kind === 'f' || kind === 'l' || kind === 'a') continue;
  if (graph.edgeKindCodes[e] !== kind) continue; // tunnels stay underground
  const line = [];
  for (let p = graph.pointStart[e]; p < graph.pointStart[e + 1]; p += 1) line.push([q(graph.lon[p]), q(graph.lat[p])]);
  (kind === 'm' || kind === 'p' ? roadLines.major : roadLines.minor).push(line);
}

// The app's own camera path (what `playCameraPath` plays on the phone), for a
// 360 x 640 dp frame with the title above and the counters below. Google zoom.
const path60 = cameraPath(film, { width: 360, height: 640, padding: { top: 100, bottom: 230, left: 20, right: 20 } });
const cameraPathData = path60
  .filter((_, i) => i % 2 === 0)
  .map((p) => [Math.round(p.atMs), q(p.camera.coordinates.longitude), q(p.camera.coordinates.latitude), Math.round(p.camera.zoom * 1000) / 1000]);

const data = {
  cameraPath: cameraPathData,
  durationMs: film.durationMs,
  draw: film.scenes.find((s) => s.kind === 'draw'),
  finaleAt: film.scenes.find((s) => s.kind === 'finale').startMs,
  segments,
  kmSteps,
  stamps,
  camera,
  outlines,
  roadLines,
  collected: film.scenes.find((s) => s.kind === 'finale').collected,
  total: madeiraTotal,
  // The trip's dates, as the app's film captions them (ReplayScreen, trip start to end or now).
  firstTs: day === null ? trip.started_ts : fromTs,
  lastTs: day === null ? (trip.ended_ts ?? allFixes[allFixes.length - 1].ts) : fromTs,
};
delete data.draw;

const html = readFileSync(path.join(root, 'tools/lib/video-options-page.html'), 'utf8').replace(
  '/*DATA*/null',
  JSON.stringify(data)
);
mkdirSync(path.join(root, 'tools/out'), { recursive: true });
// The natural map version (B on the project's own MapLibre map), lighter: no island geometry.
const natural = { ...data, outlines: undefined, roadLines: undefined, camera: undefined };
writeFileSync(
  path.join(root, 'tools/out/video-natural.html'),
  readFileSync(path.join(root, 'tools/lib/video-natural-page.html'), 'utf8').replace('/*DATA*/null', JSON.stringify(natural))
);
const out = path.join(root, 'tools/out/video-options.html');
writeFileSync(out, html);
console.log(
  `${(film.durationMs / 1000).toFixed(1)} s, ${segments.length} strokes, ${stamps.length}/${awards.length} stamps placed, ` +
    `~${(litM / 1000).toFixed(0)} km lit (approx.), ${(html.length / 1e6).toFixed(1)} MB → ${path.relative(root, out)}`
);
