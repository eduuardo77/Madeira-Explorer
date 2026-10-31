#!/usr/bin/env node
/**
 * Cut a recorder replay fixture out of a copy of the phone's database
 * (E3, A3 of the 30 Oct fix plan; the lead's answer to Q4: real batches,
 * moved by one fixed offset, times and distances kept).
 *
 *     node tools/extract-recorder-fixture.mjs --db <copy>/madeira.db \
 *       --from 2026-10-26T17:35:00 --to 2026-10-26T18:25:00 --name <name> \
 *       [--history-min 15] [--out <file>]
 *
 * Writes `app/src/recording/fixtures/<name>.json`, or `--out` (for a copy that
 * must stay out of the repo, such as a longer history to compare). Times are UTC.
 *
 * ⚠ THE OFFSET IS LONGITUDE ONLY, 2° WEST. `distanceM` is haversine, which
 * depends on the two latitudes and the difference in longitude, so a shift in
 * longitude keeps every distance exactly; a shift in latitude would not.
 * ⚠ It hides where the fixes are, not their shape: a stretch of road could be
 * slid back onto the map. So cut each window to the minutes the case needs.
 *
 * The OS's batches are rebuilt from the diary: a `batch` line `N fixes` at T
 * takes the N newest fixes at or before T not yet taken. A fix left over (a
 * motion wake's single look) is a batch of its own at its own time. Diary
 * lines holding anything like a coordinate are dropped, and counted.
 *
 * Read only: the database is opened with `readOnly`, never written.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

const OFFSET_LON_DEG = -2;

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  if (at === -1) {
    if (fallback !== undefined) return fallback;
    console.error(`--${name} is required`);
    process.exit(1);
  }
  return process.argv[at + 1];
};
const dbPath = arg('db');
const fromIso = arg('from');
const toIso = arg('to');
const name = arg('name');
const historyMin = Number(arg('history-min', '15'));
const outArg = arg('out', '');
const ms = (iso) => Date.parse(`${iso}Z`);
const from = ms(fromIso);
const to = ms(toIso);
const historyFrom = from - historyMin * 60_000;

const db = new DatabaseSync(dbPath, { readOnly: true });

const fixRows = db
  .prepare(
    `SELECT ts, lat, lon, accuracy_m AS accuracyM, speed_mps AS speedMps, bearing_deg AS bearingDeg,
            altitude_m AS altitudeM, activity_type AS activityType
       FROM raw_fix WHERE ts BETWEEN ? AND ? ORDER BY ts`
  )
  .all(historyFrom, to);
const moved = fixRows.map((row) => ({
  ts: row.ts,
  lat: row.lat,
  lon: row.lon + OFFSET_LON_DEG,
  accuracyM: row.accuracyM,
  speedMps: row.speedMps,
  bearingDeg: row.bearingDeg,
  altitudeM: row.altitudeM,
  activityType: row.activityType ?? 'unknown',
  source: 'fused',
}));
const history = moved.filter((fix) => fix.ts < from);
const inWindow = moved.filter((fix) => fix.ts >= from);

const diaryRows = db
  .prepare('SELECT ts, kind, detail FROM recording_event WHERE ts BETWEEN ? AND ? ORDER BY ts')
  .all(historyFrom, to);
const COORDINATE = /-?\d{1,3}\.\d{4,}/;
const dropped = diaryRows.filter((row) => COORDINATE.test(row.detail ?? '')).length;
const diary = diaryRows
  .filter((row) => !COORDINATE.test(row.detail ?? ''))
  .map((row) => ({ ts: row.ts, kind: row.kind, detail: row.detail }));

// The OS's batches, from the diary's `batch: N fixes` lines.
const taken = new Set();
const batches = [];
for (const line of diary.filter((row) => row.ts >= from)) {
  const match = /^(\d+) fix(?:es)?$/.exec(line.detail ?? '');
  if (line.kind !== 'batch' || match === null) continue;
  const want = Number(match[1]);
  const candidates = inWindow.filter((fix) => fix.ts <= line.ts && !taken.has(fix.ts)).slice(-want);
  candidates.forEach((fix) => taken.add(fix.ts));
  if (candidates.length > 0) batches.push({ at: line.ts, fixes: candidates });
}
for (const fix of inWindow) {
  if (!taken.has(fix.ts)) batches.push({ at: fix.ts, fixes: [fix], single: true });
}
batches.sort((a, b) => a.at - b.at);

const labels = db
  .prepare('SELECT ts, activity, transition FROM activity_event WHERE ts BETWEEN ? AND ? ORDER BY ts')
  .all(historyFrom, to);

// The profile at the window's start: the newest "profile A -> B" before it.
const before = db
  .prepare(
    `SELECT ts, detail FROM recording_event
      WHERE kind = 'start' AND detail LIKE 'profile % -> %' AND ts < ? ORDER BY ts DESC LIMIT 1`
  )
  .get(from);
const profileBefore = before ? /-> (\w+)/.exec(before.detail)?.[1] ?? null : null;

const fixture = {
  name,
  source: basename(dirname(dbPath)),
  window: { from: fromIso, to: toIso, historyMin },
  offsetLonDeg: OFFSET_LON_DEG,
  profileBefore: profileBefore ? { profile: profileBefore, ts: before.ts } : null,
  history,
  batches,
  labels,
  diary,
};
const out = outArg !== '' ? outArg : new URL(`../app/src/recording/fixtures/${name}.json`, import.meta.url);
if (outArg === '') mkdirSync(new URL('.', out), { recursive: true });
writeFileSync(out, `${JSON.stringify(fixture, null, 1)}\n`);
console.log(
  `${name}: ${history.length} fixes before, ${inWindow.length} in the window in ${batches.length} batches, ` +
    `${labels.length} sensor labels, ${diary.length} diary lines (${dropped} dropped for a coordinate), ` +
    `profile before: ${profileBefore ?? 'none in the diary'}`
);
