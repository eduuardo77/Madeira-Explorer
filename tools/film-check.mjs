/**
 * The film of a real trip, measured (T-279).
 *
 *     node tools/film-check.mjs --db <madeira.db> [--trip 31] [--day 2026-10-18]
 *
 * Builds the film the way the app does (the matcher, the roads as timed runs,
 * simplified, `composeSouvenir`) and samples it every 50 ms, then reports the
 * what the lead saw on 19 Oct 2026:
 *
 *   - **pen speed**: how far along the road the pen moves per second, as
 *     percentiles. Even pacing has them close together;
 *   - **out of frame**: samples, over the whole film, whose pen tip is outside
 *     the visible map through the camera the map is given (`replayMap.cameraAt`);
 *   - **pen up**: the jumps between strokes, by length, and the time spent on them;
 *   - **repeated road**: time spent drawing road the film already drew;
 *   - **camera jerk**: how much the camera's speed on screen changes from one
 *     60 fps frame to the next, for the pan and the zoom.
 *
 * ⚠ Unmasked (the mask is a circle around the hotel and changes none of
 * this) and without stamps. It prints numbers only, never a place, so its
 * output may be pasted anywhere; the database itself stays outside the
 * repository (D-016, D-040).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.removeAllListeners('warning');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(pathToFileURL(path.join(root, 'app/src', p)).href);

const { decodeRoadGraph } = await load('matching/roadGraph.ts');
const { matchTrace } = await load('matching/mapMatch.ts');
const { chainTimedRuns } = await load('matching/roadTrace.ts');
const { activitiesAt } = await load('recording/activityTimeline.ts');
const { keepSimplified } = await load('map/simplifyLine.ts');
const { distanceM } = await load('recording/distance.ts');
const { projectPoint } = await load('map/cameraFit.ts');
const { composeSouvenir } = await load('souvenir/composition.ts');
const { frameAt } = await load('souvenir/frame.ts');
const { cameraPath, cameraAt } = await load('souvenir/replayMap.ts');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const dbPath = arg('db', null);
if (dbPath === null) {
  throw new Error('--db <madeira.db> is required');
}
const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync(dbPath, { readOnly: true });
const tripId = Number(arg('trip', db.prepare('SELECT max(id) AS id FROM trip').get().id));
const day = arg('day', null);
const fromTs = day === null ? -Infinity : new Date(`${day}T00:00:00`).getTime();
const toTs = day === null ? Infinity : fromTs + 24 * 3600_000;
const inRange = (ts) => ts >= fromTs && ts < toTs;

const fixes = db
  .prepare('SELECT ts, lat, lon, accuracy_m, speed_mps FROM raw_fix WHERE trip_id = ? ORDER BY ts')
  .all(tripId);
const events = db.prepare('SELECT ts, activity, transition FROM activity_event ORDER BY ts').all();
const labels = activitiesAt(events, fixes.map((fix) => fix.ts));
const graph = decodeRoadGraph(JSON.parse(readFileSync(path.join(root, 'content/roads.json'), 'utf8')));
const { chains } = matchTrace(graph, fixes.map((fix, i) => ({ ...fix, activity: labels[i] })));

const roads = chains
  .flatMap((chain) => chainTimedRuns(graph, chain))
  .map((run) => ({
    faded: run.faded,
    fixes: keepSimplified(
      run.points.filter((point) => inRange(point.ts)).map((point) => ({ ...point, accuracy_m: null }))
    ),
  }))
  .filter((segment) => segment.fixes.length >= 2);

const film = composeSouvenir({
  trace: { fixes: fixes.filter((fix) => inRange(fix.ts)), safeToShare: true, reason: 'film-check' },
  stamps: [],
  totalPlaces: 0,
  gapThresholdMs: 0,
  roads,
});
if (!film.renderable) {
  throw new Error(`no film: ${film.reason}`);
}

// The replay's own viewport on the P30 (360 × 780 dp), from `ReplayScreen.tsx`.
const viewport = { width: 360, height: 780, padding: { top: 64, bottom: 160, left: 24, right: 24 } };
const path_ = cameraPath(film, viewport);
const draw = film.scenes.find((scene) => scene.kind === 'draw');

const STEP_MS = 50;
const tipOf = (frame) => {
  const last = frame.strokes[frame.strokes.length - 1];
  return last === undefined ? null : last[last.length - 1];
};

// Speed on road the film has not drawn yet, apart from road it redraws: the
// second is meant to be faster (`penPath.REPEAT_PACE`). A 40 m cell is drawn
// once the pen is 300 m past it.
const cellOf = (lat, lon) => `${Math.round(lat / 0.00036)},${Math.round(lon / 0.00043)}`;
const speeds = { fresh: [], repeat: [] };
const tipSeen = new Map();
let tipAlongM = 0;
let outside = 0;
let samples = 0;
let worstPx = 0;
let previousM = null;
const drawnLengthM = (strokes) => {
  let metres = 0;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i += 1) {
      metres += distanceM({ lat: stroke[i - 1][1], lon: stroke[i - 1][0] }, { lat: stroke[i][1], lon: stroke[i][0] });
    }
  }
  return metres;
};
// The whole film, the pull-back to the closing card included.
for (let at = 0; at <= film.durationMs; at += STEP_MS) {
  const frame = frameAt(film, at);
  const tip = tipOf(frame);
  if (tip === null) continue;
  const camera = cameraAt(path_, at);
  const { x, y } = projectPoint({ latitude: tip[1], longitude: tip[0] }, camera, viewport);
  samples += 1;
  const beyond = Math.max(-x, x - viewport.width, -y, y - viewport.height, 0);
  if (beyond > 0) outside += 1;
  worstPx = Math.max(worstPx, beyond);
  // Road drawn since the last sample, measured along the road; none while the pen is up.
  const drawnM = drawnLengthM(frame.strokes);
  if (previousM !== null && drawnM > previousM) {
    tipAlongM += drawnM - previousM;
    const cell = cellOf(tip[1], tip[0]);
    const seen = tipSeen.get(cell);
    if (seen === undefined) tipSeen.set(cell, tipAlongM);
    (seen !== undefined && seen < tipAlongM - 300 ? speeds.repeat : speeds.fresh).push((drawnM - previousM) / (STEP_MS / 1000));
  }
  previousM = drawnM;
}

// The camera's smoothness at 60 fps: how much its speed on screen changes from
// one frame to the next, in dp per frame per frame, for the pan and the zoom.
// A smooth camera changes speed a little every frame; a jerky one in steps.
const FRAME_S = 1 / 60;
const mercator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const panJerk = [];
const zoomJerk = [];
let lastPan = null;
let lastZoom = null;
let lastCamera = cameraAt(path_, 0);
let worstJerk = { value: 0, atMs: 0 };
for (let at = FRAME_S * 1000; at <= film.durationMs; at += FRAME_S * 1000) {
  const camera = cameraAt(path_, at);
  const world = 256 * Math.pow(2, camera.zoom);
  const pan = [
    ((camera.coordinates.longitude - lastCamera.coordinates.longitude) * world) / 360,
    ((mercator(camera.coordinates.latitude) - mercator(lastCamera.coordinates.latitude)) * world) / (2 * Math.PI),
  ];
  // A zoom change as the dp a point at the screen's edge moves.
  const zoom = (Math.pow(2, camera.zoom - lastCamera.zoom) - 1) * (viewport.width / 2);
  if (lastPan !== null) {
    const jerk = Math.hypot(pan[0] - lastPan[0], pan[1] - lastPan[1]);
    if (jerk > worstJerk.value) worstJerk = { value: jerk, atMs: at };
    panJerk.push(jerk);
    zoomJerk.push(Math.abs(zoom - lastZoom));
  }
  lastPan = pan;
  lastZoom = zoom;
  lastCamera = camera;
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};

const segments = draw.segments;
const lifts = { touching: 0, under100: 0, under1000: 0, over1000: 0, ms: 0 };
for (let i = 1; i < segments.length; i += 1) {
  const [lon0, lat0] = segments[i - 1].coordinates.at(-1);
  const [lon1, lat1] = segments[i].coordinates[0];
  const metres = distanceM({ lat: lat0, lon: lon0 }, { lat: lat1, lon: lon1 });
  if (metres < 1) lifts.touching += 1;
  else if (metres < 100) lifts.under100 += 1;
  else if (metres < 1000) lifts.under1000 += 1;
  else lifts.over1000 += 1;
  lifts.ms += Math.max(0, segments[i].startMs - segments[i - 1].endMs);
}

// Time drawing road already drawn: a 40 m cell visited more than 300 m of drawing earlier.
const firstSeen = new Map();
let alongM = 0;
let repeatMs = 0;
for (const segment of segments) {
  const coords = segment.coordinates;
  for (let i = 1; i < coords.length; i += 1) {
    const [lon, lat] = coords[i];
    const cell = cellOf(lat, lon);
    const seen = firstSeen.get(cell);
    if (seen !== undefined && seen < alongM - 300) repeatMs += segment.timesMs[i] - segment.timesMs[i - 1];
    if (seen === undefined) firstSeen.set(cell, alongM);
    alongM += distanceM({ lat: coords[i - 1][1], lon: coords[i - 1][0] }, { lat, lon });
  }
}

const km = (alongM / 1000).toFixed(1);
console.log(`trip ${tripId}${day === null ? '' : `, ${day}`}: ${segments.length} strokes, ${km} km drawn, draw ${(draw.durationMs / 1000).toFixed(1)} s`);
const speedLine = (values) =>
  `p10 ${percentile(values, 10).toFixed(0)}, p50 ${percentile(values, 50).toFixed(0)}, p90 ${percentile(values, 90).toFixed(0)}`;
console.log(`pen speed, m of road per s: new road ${speedLine(speeds.fresh)}; road drawn again ${speedLine(speeds.repeat)}`);
console.log(`out of frame: ${outside} of ${samples} samples (${((100 * outside) / Math.max(1, samples)).toFixed(1)}%), worst ${worstPx.toFixed(0)} dp beyond the edge`);
console.log(
  `pen up: ${lifts.touching} touching, ${lifts.under100} under 100 m, ${lifts.under1000} under 1 km, ` +
    `${lifts.over1000} over 1 km; ${(lifts.ms / 1000).toFixed(2)} s with the pen up`
);
console.log(`repeated road: ${(repeatMs / 1000).toFixed(1)} s of ${(draw.durationMs / 1000).toFixed(1)} s`);
console.log(
  `camera jerk, dp per frame per frame: pan p50 ${percentile(panJerk, 50).toFixed(2)}, p99 ${percentile(panJerk, 99).toFixed(2)}, ` +
    `max ${percentile(panJerk, 100).toFixed(2)}; zoom p50 ${percentile(zoomJerk, 50).toFixed(2)}, p99 ${percentile(zoomJerk, 99).toFixed(2)}, max ${percentile(zoomJerk, 100).toFixed(2)}; the worst pan at ${(worstJerk.atMs / 1000).toFixed(2)} s of ${(film.durationMs / 1000).toFixed(1)} s`
);
