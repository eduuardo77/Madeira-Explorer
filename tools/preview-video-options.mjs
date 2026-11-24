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
const toData = (points) =>
  points.map((p) => [Math.round(p.atMs), q(p.camera.coordinates.longitude), q(p.camera.coordinates.latitude), Math.round(p.camera.zoom * 1000) / 1000]);
const cameraPathData = toData(path60);
// The same camera with the foot of the frame free, for the video without the info card.
const cameraPathLean = toData(cameraPath(film, { width: 360, height: 640, padding: { top: 100, bottom: 130, left: 20, right: 20 } }));

const data = {
  cameraPath: cameraPathData,
  cameraPathLean,
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
// The watermark's glyph: the main island's silhouette, every municipality filled
// the same colour so the borders vanish, in a 100-wide box. From content (D-017).
const islandGlyph = (() => {
  const pts = outlines.flat();
  const xs = pts.map(([x]) => x * Math.cos((32.75 * Math.PI) / 180));
  const ys = pts.map(([, y]) => -y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = 100 / (x1 - x0);
  const d = outlines
    .filter((ring) => ring.length > 40)
    .map((ring) => 'M' + ring.filter((_, i) => i % 3 === 0)
      .map(([x, y]) => `${((x * Math.cos((32.75 * Math.PI) / 180) - x0) * k).toFixed(1)},${((-y - y0) * k).toFixed(1)}`).join('L') + 'Z')
    .join('');
  return { d, height: Math.round((y1 - y0) * k * 10) / 10 };
})();
// --- A second pacing, to compare (the lead, 24 Nov: "try the 3 combined") ----
//
// 1. Road already drawn is not drawn again: the pen goes only over new road.
// 2. Paced by day: each day with new road gets a share of the same drawing time,
//    by the square root of its new kilometres (busy days longer, quiet days
//    still readable), at least MIN_DAY_MS; inside a day, one steady speed.
// 3. The head is a comet, drawn by the page.
// Same masked roads, same drawing time and finale as the app's film.
const MIN_DAY_MS = 350;
const BRIDGE_REPEAT_M = 500;
const draw0 = film.scenes.find((s) => s.kind === 'draw');
const DRAW_FROM = draw0.startMs;
const DRAW_MS = film.scenes.find((s) => s.kind === 'finale').startMs - DRAW_FROM;
const dayOf = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Atlantic/Madeira' }).format(ts);
const runs = [...roads].sort((a, b) => a.fixes[0].ts - b.fixes[0].ts);
const drawnCells = new Map(); // cell -> metres along the whole pen when first drawn
let penAlong = 0;
const pieces = []; // { day, ts0, pts: [[lon, lat, ts]], m }
const allByDay = new Map(); // every road of a day, animated or not, so the day ends complete
for (const run of runs) {
  let cur = null;
  let whole = null;
  let held = [], heldM = 0;
  for (let i = 1; i < run.fixes.length; i += 1) {
    const a = run.fixes[i - 1], b = run.fixes[i];
    const d = dayOf(a.ts);
    if (whole === null || whole.day !== d) {
      whole = { day: d, c: [[q(a.lon), q(a.lat)]] };
      if (!allByDay.has(d)) allByDay.set(d, []);
      allByDay.get(d).push(whole);
    }
    whole.c.push([q(b.lon), q(b.lat)]);
    const m = distanceM(a, b);
    // Sample the step against a 40 m grid, as penPath does: new if any of it is new.
    const n = Math.max(1, Math.ceil(m / 20));
    let fresh = false;
    const cells = [];
    // A cell counts as drawn when it or a neighbour is: two passes of one road,
    // simplified differently, wander a cell apart on bends.
    const near = (lat, lon) => {
      const i = Math.round(lat / 0.00036), j = Math.round(lon / 0.00043);
      // Drawn by the pen at least 300 m ago (REPEAT_AFTER_M), so a road never repeats itself.
      for (let di = -1; di <= 1; di += 1) for (let dj = -1; dj <= 1; dj += 1) {
        const at = drawnCells.get(`${i + di},${j + dj}`);
        if (at !== undefined && at < penAlong - 300) return true;
      }
      return false;
    };
    let newCells = 0;
    for (let k = 0; k <= n; k += 1) {
      const lat = a.lat + ((b.lat - a.lat) * k) / n, lon = a.lon + ((b.lon - a.lon) * k) / n;
      cells.push(cellOf(lat, lon));
      if (!near(lat, lon)) newCells += 1;
    }
    fresh = newCells * 2 > n + 1;
    penAlong += m;
    for (const c of cells) if (!drawnCells.has(c)) drawnCells.set(c, penAlong);
    // A short stretch of known road between two new pieces is run through rather
    // than hopped over (BRIDGE_REPEAT_M): fewer jumps of the head, little time spent.
    if (fresh) {
      if (cur !== null && held.length && heldM <= BRIDGE_REPEAT_M && dayOf(a.ts) === cur.day) {
        for (const h of held) cur.pts.push(h);
        cur.m += heldM;
      } else if (cur === null || held.length) {
        cur = { day: dayOf(a.ts), pts: [[a.lon, a.lat, a.ts]], m: 0 };
        pieces.push(cur);
      }
      held = []; heldM = 0;
      cur.pts.push([b.lon, b.lat, b.ts]);
      cur.m += m;
    } else if (cur !== null) {
      held.push([b.lon, b.lat, b.ts]);
      heldM += m;
      if (heldM > BRIDGE_REPEAT_M) { cur = null; held = []; heldM = 0; }
    }
  }
}
// New road shorter than this is a sliver beside a road already drawn, not a road:
// drawing it would only send the head hopping.
const MIN_PIECE_M = 250;
const kept = pieces.filter((p) => p.m >= MIN_PIECE_M);
console.log(`new road: ${pieces.length} pieces, ${kept.length} of at least ${MIN_PIECE_M} m (${(kept.reduce((s, p) => s + p.m, 0) / 1000).toFixed(0)} of ${(pieces.reduce((s, p) => s + p.m, 0) / 1000).toFixed(0)} km)`);
pieces.length = 0;
pieces.push(...kept);
const dayKeys = [...new Set(pieces.map((p) => p.day))];
const tripDay0 = new Date(`${dayOf(trip.started_ts)}T00:00:00Z`).getTime();
const days = dayKeys.map((key) => {
  const ps = pieces.filter((p) => p.day === key);
  const km = ps.reduce((sum, p) => sum + p.m, 0) / 1000;
  const lons = ps.flatMap((p) => p.pts.map((x) => x[0])), lats = ps.flatMap((p) => p.pts.map((x) => x[1]));
  return { key, km, ps, bounds: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
           dayNo: Math.round((new Date(`${key}T00:00:00Z`).getTime() - tripDay0) / 86400000) + 1 };
});
const weights = days.map((d) => Math.sqrt(d.km));
const sumW = weights.reduce((a, b) => a + b, 0);
let ms = days.map((d, i) => Math.max(MIN_DAY_MS, (DRAW_MS * weights[i]) / sumW));
const scale = DRAW_MS / ms.reduce((a, b) => a + b, 0);
ms = ms.map((x) => x * scale);
let clock = DRAW_FROM;
const v2Strokes = [];
const v2Days = [];
const v2Km = [];
let litSoFar = 0;
const freshPoints = []; // [ts, filmMs], for placing stamps
days.forEach((d, i) => {
  const start = clock, total = d.km * 1000;
  let along = 0;
  for (const p of d.ps) {
    const c = [], tt = [];
    p.pts.forEach((pt, k) => {
      if (k > 0) along += distanceM({ lat: p.pts[k - 1][1], lon: p.pts[k - 1][0] }, { lat: pt[1], lon: pt[0] });
      const at = start + (total > 0 ? (along / total) * ms[i] : 0);
      c.push([q(pt[0]), q(pt[1])]);
      tt.push(Math.round(at));
      freshPoints.push([pt[2], at]);
      if (k > 0) v2Km.push([Math.round(at), Math.round((litSoFar + along) / 100) / 10]);
    });
    v2Strokes.push({ c, t: tt });
  }
  litSoFar += total;
  clock += ms[i];
  // The rest of the day (slivers too short to animate, roads beside roads already
  // drawn) appears as the day closes, so the finished map is the whole trip.
  for (const w of allByDay.get(d.key) ?? []) {
    if (w.c.length >= 2) v2Strokes.push({ c: w.c, t: w.c.map(() => Math.round(clock - 1)), quiet: 1 });
  }
  v2Days.push({ start: Math.round(start), end: Math.round(clock), dayNo: d.dayNo, date: new Date(`${d.key}T12:00:00Z`).getTime(),
                km: Math.round(d.km * 10) / 10, bounds: d.bounds.map(q) });
});
// Days with no new road worth animating still add their slivers, as the day before closes.
for (const [key, ws] of allByDay) {
  if (dayKeys.includes(key)) continue;
  const before = v2Days.filter((d) => new Date(d.date).toISOString().slice(0, 10) < key).pop();
  const at = before ? before.end - 1 : DRAW_FROM;
  for (const w of ws) if (w.c.length >= 2) v2Strokes.push({ c: w.c, t: w.c.map(() => Math.round(at)), quiet: 1 });
}
freshPoints.sort((a, b) => a[0] - b[0]);
const filmTimeOf = (ts) => {
  let lo = 0, hi = freshPoints.length - 1, best = DRAW_FROM;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (freshPoints[mid][0] <= ts) { best = freshPoints[mid][1]; lo = mid + 1; } else hi = mid - 1; }
  return Math.round(best);
};
const v2Stamps = awards
  .filter((a) => places.has(a.place_id))
  .map((a) => { const p = places.get(a.place_id); return { at: filmTimeOf(a.awarded_ts), lon: q(p.lon), lat: q(p.lat), name: p.name }; });
// The count must end where the trip's does: roads shown at a day's close are lit
// too, so the running figure is scaled to finish on the same total.
const kmTotal = kmSteps.length ? kmSteps[kmSteps.length - 1][1] : 0;
const kmScale = litSoFar > 0 ? kmTotal / (litSoFar / 1000) : 1;
for (const step of v2Km) step[1] = Math.round(step[1] * kmScale * 10) / 10;
const paced = { strokes: v2Strokes, days: v2Days, kmSteps: v2Km, stamps: v2Stamps, tripDays: Math.round((data.lastTs - data.firstTs) / 86400000) + 1 };
console.log(`paced by day: ${days.length} days with new road, ${(litSoFar / 1000).toFixed(0)} km new, ` +
  `day share ${Math.round(Math.min(...ms))} to ${Math.round(Math.max(...ms))} ms`);

const natural = { ...data, paced, islandGlyph, outlines: undefined, roadLines: undefined, camera: undefined, finaleMs: film.durationMs - film.scenes.find((s) => s.kind === 'finale').startMs };
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
