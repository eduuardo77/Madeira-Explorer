/**
 * The app's lit roads measured against a SensorLogger recording of the same
 * outing (first used 2026-10-04: the promenade walk, an iPhone 15 at 1 Hz
 * beside the P30). The reference is the 1 Hz track; the Android fixes are
 * matched exactly as the app matches them (motion-sensor labels included).
 *
 *     node tools/compare-sensorlogger.mjs --db <copy of madeira.db> --csv <Location.csv>
 *          --day 2026-10-04 --from 15:52 --to 17:48 --out <outside the repo>/compare.html
 *          [--roads <roads.json>]
 *
 * Prints precision (lit metres near the walked track), recall (walked metres
 * near a lit line), the Android receiver's error against the reference at the
 * same second, and the stretches walked and not lit. Draws the walk area only,
 * never the whole trace (D-016): the output must stay outside the repository.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  if (i === -1 && fallback === undefined) throw new Error(`missing ${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const OUT = path.resolve(arg('--out'));
if (OUT.toLowerCase().startsWith(path.resolve(root).toLowerCase())) {
  throw new Error('--out must be outside the repository: the picture is a real trace (D-016)');
}
const imp = (p) => import(pathToFileURL(`${root}/${p}`).href);
const { decodeRoadGraph, edgeSlice } = await imp('app/src/matching/roadGraph.ts');
const { matchTrace } = await imp('app/src/matching/mapMatch.ts');
const { visitedEdges, visitedLines, visitedLengthM } = await imp('app/src/matching/visitedRoads.ts');
const { activitiesAt } = await imp('app/src/recording/activityTimeline.ts');
const { parseSensorLoggerExport, summariseFixes } = await imp('tools/lib/sensorLogger.mjs');

const graph = decodeRoadGraph(JSON.parse(readFileSync(arg('--roads', `${root}/content/roads.json`), 'utf8')));
const DAY_ISO = arg('--day');
const T = (s) => Date.parse(new Date(`${DAY_ISO}T${s.length === 5 ? s + ':00' : s}`).toISOString());
const WALK = [T(arg('--from')), T(arg('--to'))];
// Fixes from 20 minutes either side, so the matcher sees the walk's ends in context.
const DAY = [WALK[0] - 20 * 60_000, WALK[1] + 20 * 60_000];

// --- the iPhone, through the project's own importer (its first real export)
const parsed = parseSensorLoggerExport(readFileSync(arg('--csv'), 'utf8'));
const iphone = (parsed.fixes ?? parsed).filter((f) => f.ts >= WALK[0] && f.ts <= WALK[1]);
console.log('importer:', Array.isArray(parsed) ? 'array' : Object.keys(parsed).join(','), '| walk fixes', iphone.length);
console.log('importer summary:', JSON.stringify(summariseFixes(parsed.fixes ?? parsed)).slice(0, 300));

// --- the Android phone, labelled with its motion-sensor events as roadNetwork.ts does
const db = new DatabaseSync(arg('--db'), { readOnly: true });
const raw = db
  .prepare('SELECT ts, lat, lon, accuracy_m, speed_mps FROM raw_fix WHERE ts BETWEEN ? AND ? ORDER BY ts')
  .all(DAY[0], DAY[1]);
const events = db.prepare('SELECT ts, activity, transition FROM activity_event ORDER BY ts').all();
const labels = activitiesAt(events, raw.map((f) => f.ts));
const android = raw.map((f, i) => ({ ...f, activity: labels[i] }));
const { chains } = matchTrace(graph, android);
const visited = visitedEdges(graph, chains);
const lines = visitedLines(graph, visited);
console.log('android fixes', android.length, 'chains', chains.length, 'lit', Math.round(visitedLengthM(visited)), 'm');

// --- geometry helpers, local metres
const LAT0 = 32.643, LON0 = -16.962;
const kx = 111320 * Math.cos((LAT0 * Math.PI) / 180), ky = 110540;
const xy = (lat, lon) => [(lon - LON0) * kx, (lat - LAT0) * ky];
const segDist = (p, a, b) => {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const polyDist = (p, poly) => {
  let best = Infinity;
  for (let i = 1; i < poly.length; i += 1) best = Math.min(best, segDist(p, poly[i - 1], poly[i]));
  return best;
};
const resample = (poly, step) => {
  const out = [];
  for (let i = 1; i < poly.length; i += 1) {
    const [a, b] = [poly[i - 1], poly[i]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k += 1) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
};

// Thinned to points 8 m apart: at 1 Hz, standing still adds kilometres of jitter.
// ⚠ Split wherever the good fixes stop for over 30 s. In a tunnel the iPhone
// has no fix either, and one straight line from mouth to mouth crosses the
// mountain: on 10 Oct 2026 that counted 7 km of tunnels, all lit by the app, as
// "walked but not lit", and gave 81.8% for a ride that was 95.1%.
const TRUTH_SPLIT_MS = 30_000;
const truthRuns = [];
const goodTs = [];
let lastTs = -Infinity;
for (const f of iphone) {
  if (f.accuracy_m !== null && f.accuracy_m > 20) continue;
  goodTs.push(f.ts);
  const p = xy(f.lat, f.lon);
  if (f.ts - lastTs > TRUTH_SPLIT_MS) truthRuns.push([]);
  lastTs = f.ts;
  const run = truthRuns[truthRuns.length - 1];
  const last = run[run.length - 1];
  if (last === undefined || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 8) run.push(p);
}
const truth = truthRuns.flat();
const truthT = iphone.map((f) => f.ts);
// The walk area only: the lit lines inside the box the iPhone walk covers, plus 150 m.
const xs = truth.map((p) => p[0]), ys = truth.map((p) => p[1]);
const box = [Math.min(...xs) - 150, Math.min(...ys) - 150, Math.max(...xs) + 150, Math.max(...ys) + 150];
const inBox = (p) => p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3];
const litPolys = lines.map((l) => l.points.map(([lat, lon]) => xy(lat, lon)));
// Precision from the walk's own chains only: the drive in also lit roads in this box.
// The stretch of each chain reached during the walk, by the time along the route.
const { chainTimedPath } = await imp('app/src/matching/roadTrace.ts');
// And only where the iPhone had a fix: a lit tunnel has no reference beside it,
// and judging it against none would call it a road the app invented.
const referenced = (ts) => {
  let lo = 0, hi = goodTs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (goodTs[m] <= ts) lo = m; else hi = m; }
  return ts >= goodTs[lo] && ts <= goodTs[hi] && goodTs[hi] - goodTs[lo] <= TRUTH_SPLIT_MS;
};
const walkPolys = [];
for (const c of chains) {
  let poly = [];
  for (const p of chainTimedPath(graph, c)) {
    if (p.ts >= WALK[0] && p.ts <= WALK[1] && referenced(p.ts)) poly.push(xy(p.lat, p.lon));
    else if (poly.length > 0) { walkPolys.push(poly); poly = []; }
  }
  walkPolys.push(poly);
}
walkPolys.splice(0, walkPolys.length, ...walkPolys.filter((poly) => poly.length >= 2));
const litPts = walkPolys.flatMap((poly) => resample(poly, 5)).filter(inBox);

const pct = (arr, lim) => ((100 * arr.filter((d) => d <= lim).length) / arr.length).toFixed(1);
const q = (arr, p) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length * p)];

// Precision: is each lit metre where the walker actually went?
const litErr = litPts.map((p) => Math.min(...truthRuns.map((run) => polyDist(p, run))));
console.log(`\nLIT vs iPhone track (walk area, ${litPts.length * 5} m of lit line):`);
console.log(`  within 10 m ${pct(litErr, 10)}%  15 m ${pct(litErr, 15)}%  30 m ${pct(litErr, 30)}%   median ${q(litErr, 0.5).toFixed(1)} m  p90 ${q(litErr, 0.9).toFixed(1)} m`);

// Recall: is each metre the walker went lit?
const truthPts = truthRuns.flatMap((run) => resample(run, 5));
const recallErr = truthPts.map((p) => Math.min(...litPolys.map((poly) => polyDist(p, poly))));
console.log(`iPhone track vs LIT (${truthPts.length * 5} m walked):`);
console.log(`  within 10 m ${pct(recallErr, 10)}%  15 m ${pct(recallErr, 15)}%  30 m ${pct(recallErr, 30)}%   median ${q(recallErr, 0.5).toFixed(1)} m`);

// The Android receiver against the iPhone at the same instant.
const at = (ts) => {
  let lo = 0, hi = truthT.length - 1;
  if (ts < truthT[lo] || ts > truthT[hi]) return null;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (truthT[m] <= ts) lo = m; else hi = m; }
  const a = iphone[lo], b = iphone[hi], t = (ts - a.ts) / Math.max(1, b.ts - a.ts);
  return xy(a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t);
};
const rx = android.filter((f) => f.ts >= WALK[0] && f.ts <= WALK[1]).map((f) => { const p = at(f.ts); return p === null ? null : Math.hypot(xy(f.lat, f.lon)[0] - p[0], xy(f.lat, f.lon)[1] - p[1]); }).filter((d) => d !== null);
console.log(`Android fix vs iPhone at the same second (${rx.length} fixes): median ${q(rx, 0.5).toFixed(1)} m  p90 ${q(rx, 0.9).toFixed(1)} m  max ${Math.max(...rx).toFixed(0)} m`);

// Runs of points over 30 m from the other track, printed both ways: walked and
// not lit, and lit where nobody went.
const farRuns = (label, pts, err) => {
  const runs = [];
  let run = null;
  pts.forEach((p, i) => {
    if (err[i] > 30) { run ??= { from: i, to: i }; run.to = i; }
    else if (run) { runs.push(run); run = null; }
  });
  if (run) runs.push(run);
  console.log(`${label} (> 30 m from the other track, runs over 40 m):`);
  for (const g of runs.filter((g) => (g.to - g.from) * 5 > 40)) {
    const [x, y] = pts[Math.floor((g.from + g.to) / 2)];
    console.log(`  ${(g.to - g.from) * 5} m around ${(LAT0 + y / ky).toFixed(5)},${(LON0 + x / kx).toFixed(5)}`);
  }
};
farRuns('walked but not lit', truthPts, recallErr);
farRuns('lit but not walked', litPts, litErr);

// --- the picture: walk area only (D-016: nothing near where the user sleeps)
const W = 1400, scale = W / (box[2] - box[0]), H = Math.round((box[3] - box[1]) * scale);
const P = ([x, y]) => `${((x - box[0]) * scale).toFixed(1)},${((box[3] - y) * scale).toFixed(1)}`;
const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="background:#f4f1ea;width:100%;height:auto">`];
// The network, faint: footpaths dashed.
const KIND = 'mprtfla';
for (let e = 0; e < graph.edgeCount; e += 1) {
  const pts = edgeSlice(graph, e, 0, Infinity).map(([lat, lon]) => xy(lat, lon));
  if (!pts.some(inBox)) continue;
  const foot = KIND[graph.kindIndex[e]] === 'f';
  parts.push(`<polyline points="${pts.map(P).join(' ')}" fill="none" stroke="${foot ? '#b9b2a3' : '#cfc8b8'}" stroke-width="${foot ? 1.5 : 3}" ${foot ? 'stroke-dasharray="4 3"' : ''}/>`);
}
for (const poly of litPolys) parts.push(`<polyline points="${poly.map(P).join(' ')}" fill="none" stroke="#1565c0" stroke-width="7" stroke-opacity="0.55" stroke-linecap="round" stroke-linejoin="round"/>`);
for (const run of truthRuns) parts.push(`<polyline points="${run.map(P).join(' ')}" fill="none" stroke="#d32f2f" stroke-width="1.6"/>`);
for (const f of android.filter((f) => f.ts >= WALK[0] && f.ts <= WALK[1])) parts.push(`<circle cx="${P(xy(f.lat, f.lon)).split(',')[0]}" cy="${P(xy(f.lat, f.lon)).split(',')[1]}" r="3" fill="#2e7d32"/>`);
parts.push('</svg>');
const html = `<!doctype html><meta charset="utf-8"><title>Lit roads vs reference</title>
<body style="margin:0;font:14px system-ui;background:#f4f1ea">
<p style="margin:10px 14px"><b>${DAY_ISO}, ${arg('--from')} to ${arg('--to')}.</b>
<span style="color:#1565c0">■ lit by the app</span> &nbsp; <span style="color:#d32f2f">— SensorLogger reference</span> &nbsp;
<span style="color:#2e7d32">● Android fixes</span> &nbsp; <span style="color:#999">grey: mapped roads, dashed: footpaths</span></p>
${parts.join('\n')}</body>`;
writeFileSync(OUT, html);
console.log(`\n→ ${OUT}`);
