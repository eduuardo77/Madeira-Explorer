/**
 * GPS minutes spent at stops, and how many a different stop rule would save
 * (recording-modes proposal, measurement 2, 25 Oct 2026).
 *
 *     node tools/replay-stops.mjs --db <copy of madeira.db> --csv <Location.csv>
 *          --day 2026-10-18 --from 10:05 --to 16:54
 *
 * The app's own `decideProfile` is run again over the phone's stored fixes
 * (with their motion-sensor labels), at the moments the gate really ran (each
 * logged batch), with two of its constants changeable: STILL_CONFIRM_MS and
 * STATIONARY_WINDOW_MS. The first line, today's rule at today's moments, must
 * reproduce the profile changes the phone logged; if it does not, the replay
 * is wrong and nothing below it counts.
 *
 * The truth is the iPhone's 1 Hz SensorLogger track. A stop is a span where it
 * stays within STOP_RADIUS_M of the stop's first point for at least
 * MIN_STOP_MIN. A false stop is a switch to stationary with the iPhone moving
 * on within FALSE_STOP_MIN: that costs the start of whatever came next.
 *
 * Read only; prints figures, never a trace (D-016).
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  if (i === -1 && fallback === undefined) throw new Error(`missing ${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const { parseSensorLoggerExport } = await import(pathToFileURL(`${root}/tools/lib/sensorLogger.mjs`).href);

// --- the app's policy, with two constants made adjustable
const rec = `${root}/app/src/recording`;
const tmp = mkdtempSync(path.join(os.tmpdir(), 'replay-stops-'));
writeFileSync(path.join(tmp, 'distance.ts'), readFileSync(`${rec}/distance.ts`, 'utf8'));
let policy = readFileSync(`${rec}/movementPolicy.ts`, 'utf8');
for (const [name, key] of [['STILL_CONFIRM_MS', '__C'], ['STATIONARY_WINDOW_MS', '__W']]) {
  const def = new RegExp(`export const ${name} = ([^;]+);`);
  const m = def.exec(policy);
  if (!m) throw new Error(`${name} not found in movementPolicy.ts`);
  policy = policy.replace(def, `const ${key}_DEFAULT = ${m[1]};`).replaceAll(name, `${key}()`);
  policy = `const ${key} = () => globalThis.${key} ?? ${key}_DEFAULT;\nexport const ${name} = ${m[1]};\n` + policy;
}
writeFileSync(path.join(tmp, 'movementPolicy.ts'), policy);
const { decideProfile, STATIONARY_EDGE_MS } = await import(pathToFileURL(path.join(tmp, 'movementPolicy.ts')).href);
const { distanceM } = await import(pathToFileURL(path.join(tmp, 'distance.ts')).href);

const STOP_RADIUS_M = 50;
const MIN_STOP_MIN = 3;
const FALSE_STOP_MIN = 5;
const MIN = 60_000;

const DAY_ISO = arg('--day');
const T = (s) => Date.parse(new Date(`${DAY_ISO}T${s}:00`).toISOString());
const [FROM, TO] = [T(arg('--from')), T(arg('--to'))];
const hhmm = (ts) => new Date(ts).toTimeString().slice(0, 5);

// --- the iPhone: stops
const parsed = parseSensorLoggerExport(readFileSync(arg('--csv'), 'utf8'));
const ref = (parsed.fixes ?? parsed).filter((f) => f.ts >= FROM && f.ts <= TO).sort((a, b) => a.ts - b.ts);
const stops = [];
for (let i = 0; i < ref.length; ) {
  let j = i;
  while (j + 1 < ref.length && distanceM(ref[i], ref[j + 1]) <= STOP_RADIUS_M) j += 1;
  if (ref[j].ts - ref[i].ts >= MIN_STOP_MIN * MIN) {
    stops.push({ start: ref[i].ts, end: ref[j].ts });
    i = j + 1;
  } else i += 1;
}
const stopAt = (ts) => stops.find((s) => ts >= s.start && ts <= s.end);
const minutesUntilMoved = (ts) => {
  const here = ref.find((f) => f.ts >= ts);
  if (!here) return Infinity;
  const away = ref.find((f) => f.ts > ts && distanceM(here, f) > 100);
  return away ? (away.ts - ts) / MIN : Infinity;
};

// --- the phone
const db = new DatabaseSync(arg('--db'), { readOnly: true });
const before = FROM - 12 * 3600_000;
const events = db.prepare('SELECT ts, kind, detail FROM recording_event WHERE ts BETWEEN ? AND ? ORDER BY ts').all(before, TO);
const changes = []; // what the phone logged: [ts, from, to, reason]
for (const e of events) {
  const m = e.kind === 'start' && /^profile (\w+) -> (\w+): (.*)$/.exec(e.detail ?? '');
  if (m) changes.push({ ts: e.ts, from: m[1], to: m[2], reason: m[3] });
}
const batches = events.filter((e) => e.kind === 'batch' && e.ts >= FROM && e.ts <= TO).map((e) => e.ts);
// What wakes a stationary phone: the motion sensors (D-106), not the GPS,
// which the stationary profile does not use.
const MOVING = new Set(['walking', 'running', 'cycling', 'driving']);
const wakes = [
  ...db.prepare('SELECT ts, activity FROM activity_event WHERE ts BETWEEN ? AND ? AND transition = ?').all(FROM, TO, 'enter')
    .filter((a) => MOVING.has(a.activity)).map((a) => ({ ts: a.ts, to: a.activity === 'driving' ? 'driving' : 'walking' })),
  ...events.filter((e) => e.kind === 'activity' && /^motion wake: significant_motion/.test(e.detail ?? '') && e.ts >= FROM)
    .map((e) => ({ ts: e.ts, to: 'walking' })),
].sort((a, b) => a.ts - b.ts);
const fixes = db
  .prepare('SELECT ts, lat, lon, accuracy_m AS accuracyM, activity_type AS activity FROM raw_fix WHERE ts BETWEEN ? AND ? ORDER BY ts')
  .all(before, TO)
  .map((f) => ({ ...f, activity: f.activity ?? undefined }));

const loggedAt = (ts) => {
  let p = 'stationary';
  let since = before;
  for (const c of changes) if (c.ts <= ts) [p, since] = [c.to, c.ts];
  return { p, since };
};

/**
 * Run the gate over the day. Today it runs at each batch; `everyMin` adds a
 * run every minute, standing for a timer or a shorter batch interval. Raises
 * out of stationary and walking-to-driving come from the motion wake, outside
 * the gate, so they are taken from the log as they happened.
 */
function simulate({ confirmMin = 5, windowMin = 10, everyMin = false } = {}) {
  globalThis.__C = confirmMin * MIN;
  globalThis.__W = windowMin * MIN;
  const times = new Set(batches);
  if (everyMin) for (let t = FROM; t <= TO; t += MIN) times.add(t);
  for (const w of wakes) times.add(w.ts); // only acted on while stationary, below
  // Raises (out of stationary, or walking to driving) came from motion wakes
  // or the gate on a wake; they are followed as logged. Drops are simulated.
  for (const c of changes) if (c.ts >= FROM && (c.from === 'stationary' || c.to === 'driving')) times.add(-c.ts);
  const timeline = [...times].sort((a, b) => Math.abs(a) - Math.abs(b));
  let { p, since } = loggedAt(FROM);
  const out = [{ ts: FROM, p }];
  for (const signed of timeline) {
    const now = Math.abs(signed);
    if (signed < 0) {
      // A raise from the log: follow it unless already there.
      const c = changes.find((x) => x.ts === now);
      if (p !== c.to && !(p === 'driving' && c.to === 'walking')) [p, since] = [c.to, now];
      out.push({ ts: now, p });
      continue;
    }
    if (p === 'stationary') {
      // Where the phone was stationary too, it leaves when the phone did (a
      // logged raise). Where only the replay is, by a motion wake since.
      if (loggedAt(now).p === 'stationary') continue;
      const w = wakes.find((x) => x.ts > since && x.ts <= now);
      if (w) {
        [p, since] = [w.to, w.ts];
        out.push({ ts: w.ts, p, reason: 'motion wake' });
      }
      continue;
    }
    if (!batches.includes(now) && !everyMin) continue; // the gate runs at batches only
    const windowStart = now - globalThis.__W - STATIONARY_EDGE_MS;
    const upToNow = fixes.filter((f) => f.ts <= now);
    const samples = p === 'stationary' ? upToNow.slice(-40) : upToNow.filter((f) => f.ts >= windowStart).slice(-400);
    const d = decideProfile(p, samples, now, since);
    if (d.changed) {
      [p, since] = [d.profile, now];
      out.push({ ts: now, p, reason: d.reason });
    }
  }
  return out;
}

const profileIn = (timeline, ts) => {
  let p = timeline[0].p;
  for (const x of timeline) if (x.ts <= ts) p = x.p;
  return p;
};
function score(timeline) {
  let gps = 0;
  let atStops = 0;
  for (let t = FROM; t < TO; t += 15_000) {
    if (profileIn(timeline, t) === 'stationary') continue;
    gps += 0.25;
    if (stopAt(t)) atStops += 0.25;
  }
  const falseStops = timeline
    .filter((x) => x.p === 'stationary' && x.ts > FROM)
    .map((x) => ({ ts: x.ts, moved: minutesUntilMoved(x.ts) }))
    .filter((x) => x.moved <= FALSE_STOP_MIN);
  let lostM = 0;
  for (let i = 1; i < ref.length; i += 1) {
    const t = ref[i].ts;
    if (profileIn(timeline, t) === 'stationary' && loggedAt(t).p !== 'stationary') lostM += distanceM(ref[i - 1], ref[i]);
  }
  return { gps: Math.round(gps), atStops: Math.round(atStops), falseStops, lostM: Math.round(lostM) };
}

// --- the logged day, and today's rule replayed: these two must agree
const logged = [{ ts: FROM, p: loggedAt(FROM).p }, ...changes.filter((c) => c.ts > FROM).map((c) => ({ ts: c.ts, p: c.to }))];
const L = score(logged);
console.log(`${DAY_ISO} ${hhmm(FROM)} to ${hhmm(TO)} (${(TO - FROM) / MIN} min), ${stops.length} stops of ${MIN_STOP_MIN}+ min, ${Math.round(stops.reduce((s, x) => s + x.end - x.start, 0) / MIN)} min in all`);
console.log(`  logged by the phone        GPS ${L.gps} min, at stops ${L.atStops}; to stationary at ${logged.filter((x) => x.p === 'stationary' && x.ts > FROM).map((x) => hhmm(x.ts)).join(' ') || 'never'}`);

const variants = [
  ['today: 5 min still, at batches', {}],
  ['3 min still, at batches', { confirmMin: 3 }],
  ['2 min still, at batches', { confirmMin: 2 }],
  ['5 min still, every minute', { everyMin: true }],
  ['3 min still, every minute', { confirmMin: 3, everyMin: true }],
  ['2 min still, every minute', { confirmMin: 2, everyMin: true }],
  ['window 6 min, 3 still, every min', { confirmMin: 3, windowMin: 6, everyMin: true }],
];
for (const [name, opts] of variants) {
  const tl = simulate(opts);
  const s = score(tl);
  const toStat = tl.filter((x) => x.p === 'stationary' && x.ts > FROM).map((x) => hhmm(x.ts));
  console.log(
    `  ${name.padEnd(32)} GPS ${String(s.gps).padStart(3)} min, at stops ${String(s.atStops).padStart(3)}, false stops ${s.falseStops.length}, route at risk ${s.lostM} m` +
      (s.falseStops.length ? ` (${s.falseStops.map((f) => `${hhmm(f.ts)} moved ${f.moved.toFixed(1)} min later`).join(', ')})` : '') +
      `; to stationary at ${toStat.join(' ') || 'never'}`
  );
}
