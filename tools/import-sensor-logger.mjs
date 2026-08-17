/**
 * Turn a Sensor Logger export into a fixture this project can measure against
 * (T-017, T-020, T-021).
 *
 *     node tools/import-sensor-logger.mjs ~/Downloads/levada-do-rei
 *     node tools/import-sensor-logger.mjs Location.csv --name levada-do-rei
 *     → tools/fixtures/levada-do-rei.json
 *
 * Then, and this is the point of it:
 *
 *     node tools/preview-trace.mjs --fixes tools/fixtures/levada-do-rei.json
 *
 * WHY
 * ---
 * `tools/fixtures/` has been empty since the project started, and every
 * threshold in the trace chapter was set against noise this repository invented
 * for itself. A real walk replaces guesses with measurements in one step, and
 * the numbers printed below are exactly the ones T-020 asks for: how long the
 * blackouts are, how big the errors are, how often a fix arrives.
 *
 * ⚠ **Unzip the export first.** Sensor Logger hands you a `.zip`; Node has no
 * unzip and this project adds no dependency for one (D-001's habit). Point this
 * at the unzipped folder.
 *
 * ⚠ **NOTHING HERE HAS SEEN A REAL EXPORT.** The parser matches column names
 * from a list of plausible ones and says what it saw when it fails — see
 * `tools/lib/sensorLogger.mjs`. If the first real file does not import, the fix
 * is a name in that list.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { metresBetween, slug } from './lib/geo.mjs';
import { parseSensorLoggerExport, summariseFixes } from './lib/sensorLogger.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/** Madeira and Porto Santo, generously. A walk outside this is a mistake. */
const ISLANDS = { minLat: 32.35, maxLat: 33.15, minLon: -17.35, maxLon: -16.2 };

/** The file inside an unzipped export that holds the positions. */
function locationFileIn(dir) {
  const entries = readdirSync(dir);
  const byPreference = [
    (name) => /^location\.csv$/i.test(name),
    (name) => /^location.*\.csv$/i.test(name),
    (name) => /\.json$/i.test(name),
    (name) => /\.csv$/i.test(name),
  ];
  for (const matches of byPreference) {
    const found = entries.find(matches);
    if (found) return path.join(dir, found);
  }
  throw new Error(
    `No Location.csv or .json in ${dir}. It holds: ${entries.join(', ') || '(nothing)'}`
  );
}

const flag = (name) => {
  const found = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (found) return found.split('=').slice(1).join('=');
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

/** How far the walk covered on the ground, following the fixes as recorded. */
function lengthM(fixes) {
  let total = 0;
  for (let i = 1; i < fixes.length; i += 1) {
    total += metresBetween(fixes[i - 1], fixes[i]);
  }
  return total;
}

const hhmmss = (seconds) => {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
};

function main() {
  const target = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  if (!target) {
    console.error('Usage: node tools/import-sensor-logger.mjs <unzipped-export-dir|file>');
    console.error('       [--name <fixture-name>] [--gap-seconds 30]');
    process.exit(1);
  }
  if (!existsSync(target)) {
    console.error(`No such file or directory: ${target}`);
    process.exit(1);
  }

  const source = statSync(target).isDirectory() ? locationFileIn(target) : target;
  const { fixes, columns, warnings, format } = parseSensorLoggerExport(
    readFileSync(source, 'utf8')
  );
  if (fixes.length < 2) {
    console.error(`Only ${fixes.length} usable fixes in ${source}. Nothing to measure.`);
    process.exit(1);
  }

  const gapSeconds = Number(flag('gap-seconds') ?? 30);
  const stats = summariseFixes(fixes, { gapSeconds });
  const name = slug(
    flag('name') ?? path.basename(statSync(target).isDirectory() ? target : source, path.extname(source))
  );

  const outDir = path.join(root, 'tools', 'fixtures');
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${name}.json`);

  // The fixture keeps its own provenance. A trace whose origin is unknown is
  // not evidence, and this is the one file in the project that outranks
  // reasoning (`docs/field-notes.md`).
  writeFileSync(
    out,
    `${JSON.stringify(
      {
        name,
        source: path.basename(source),
        format,
        importedAt: new Date().toISOString(),
        note: flag('note') ?? null,
        columns,
        stats: { ...stats, gaps: stats.gaps.length },
        fixes,
      },
      null,
      2
    )}\n`
  );

  const relative = (file) => path.relative(root, file).replace(/\\/g, '/');
  console.log(`${relative(source)} → ${relative(out)}`);
  console.log();
  console.log(`  fixes        ${stats.count} over ${hhmmss(stats.durationS)}`);
  console.log(
    `  distance     ${(lengthM(fixes) / 1000).toFixed(2)} km as recorded, uncleaned`
  );
  console.log(
    `  interval     median ${stats.interval.median?.toFixed(1)} s, ` +
      `p95 ${stats.interval.p95?.toFixed(1)} s, max ${stats.interval.max?.toFixed(1)} s`
  );
  console.log(
    `  drops >${gapSeconds}s   ${stats.gaps.length}, longest ${hhmmss(stats.longestGapS)}, ` +
      `${((stats.droppedTimeS / stats.durationS) * 100).toFixed(1)}% of the walk unrecorded`
  );
  console.log(
    `  accuracy     median ${stats.accuracy.median ?? '—'} m, p90 ${stats.accuracy.p90 ?? '—'} m, ` +
      `worst ${stats.accuracy.worst ?? '—'} m`
  );
  console.log(
    `  over 120 m   ${stats.accuracy.over120} fixes ` +
      `(${((stats.accuracy.over120 / stats.count) * 100).toFixed(1)}%) — the cut D-067 argues about`
  );

  if (stats.gaps.length > 0) {
    console.log();
    console.log('  the longest silences, which is what "data comes and goes" means:');
    for (const gap of [...stats.gaps].sort((a, b) => b.seconds - a.seconds).slice(0, 5)) {
      const at = (gap.fromTs - stats.startTs) / 1000;
      console.log(`    ${hhmmss(gap.seconds).padStart(8)} starting ${hhmmss(at)} in`);
    }
  }

  const outside =
    stats.bbox.minLat < ISLANDS.minLat ||
    stats.bbox.maxLat > ISLANDS.maxLat ||
    stats.bbox.minLon < ISLANDS.minLon ||
    stats.bbox.maxLon > ISLANDS.maxLon;

  for (const warning of warnings) {
    console.log(`  ⚠ ${warning}`);
  }
  if (outside) {
    console.log(
      '  ⚠ some fixes are outside Madeira and Porto Santo — check this is the walk you meant'
    );
  }

  console.log();
  console.log(`Next: node tools/preview-trace.mjs --fixes ${relative(out)}`);
}

main();
