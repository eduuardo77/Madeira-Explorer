/**
 * Draw what the trace cleanup does, and measure it (D-066, T-059).
 *
 *     node tools/preview-trace.mjs                       # the seafront walk
 *     node tools/preview-trace.mjs tools/routes/vr1-tunnel.txt
 *     → tools/out/trace-preview.png
 *
 * WHY A SECOND RENDERER
 * ---------------------
 * The same reason the stamps have one: a mark that passed every geometry test
 * still rendered as a crosshair, and nobody knew until they looked. The trace
 * is drawn by Google Maps on a device this project does not have, so the only
 * way to see the shape of the line before it ships is to draw it here, with the
 * **app's own module** — imported, never reimplemented, so the picture cannot
 * flatter a rule the app does not actually apply.
 *
 * ⚠ **THE NOISE IS MODELLED, NOT MEASURED, AND THAT IS THE LIMITATION.**
 * `tools/fixtures/` is empty until somebody walks a levada with a logger
 * (T-018). What is below is a plausible GPS: Gaussian jitter, occasional
 * spikes, a stationary stretch. Plausible is not real, so **this proves the
 * rules do what they claim on the noise they were designed against, and proves
 * nothing about the noise Madeira actually produces.** When T-018 lands, point
 * this at a real trace with `--fixes` and believe it more.
 *
 * WHAT IT MEASURES
 * ----------------
 * The route file is ground truth — the path that was actually walked — so the
 * question is not "does it look tidier" but **"is the drawn line closer to the
 * truth than it was"**. Mean and worst deviation from the true path, before and
 * after, plus what the cleanup removed to get there.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Canvas } from './lib/png.mjs';
import { metresBetween } from './lib/geo.mjs';

// Node grumbles about `app/package.json` not declaring `"type": "module"` when
// it loads a TypeScript file from there — same reason as `validate-content.mjs`.
process.removeAllListeners('warning');

const { cleanTrace } = await import('../app/src/map/traceCleanup.ts');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/** How far apart the interpolated "true" positions are, in metres. */
const STEP_M = 12;

/** Typical horizontal error, in metres, and what the fix reports about itself. */
const JITTER_SIGMA_M = 9;

/** How often a wild fix arrives, and how far out it lands. */
const SPIKE_EVERY = 37;
const SPIKE_MIN_M = 80;
const SPIKE_MAX_M = 220;

/** A coffee stop: this many fixes inside a small circle, mid-route. */
const STATIONARY_FIXES = 30;
const STATIONARY_RADIUS_M = 18;

const COLOURS = {
  truth: [170, 170, 170],
  raw: [214, 69, 65],
  clean: [40, 106, 217],
  background: [255, 255, 255],
};

/** Deterministic noise, so two runs of this tool can be compared. */
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

/** Box-Muller, for noise shaped like GPS error rather than like a square. */
function gaussian(random) {
  const u = Math.max(random(), 1e-9);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function readRoute(file) {
  const points = [];
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const [lat, lon] = trimmed.split(/\s+/).map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      points.push({ lat, lon });
    }
  }
  return points;
}

/** The route's waypoints, filled in every `STEP_M` — the path actually walked. */
function densify(route) {
  const dense = [];
  for (let i = 1; i < route.length; i += 1) {
    const from = route[i - 1];
    const to = route[i];
    const metres = metresBetween(from, to);
    const steps = Math.max(1, Math.round(metres / STEP_M));
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      dense.push({
        lat: from.lat + (to.lat - from.lat) * t,
        lon: from.lon + (to.lon - from.lon) * t,
      });
    }
  }
  dense.push(route[route.length - 1]);
  return dense;
}

/** Metres east/north converted back to degrees at this latitude. */
function offset(point, eastM, northM) {
  return {
    lat: point.lat + northM / 110_540,
    lon: point.lon + eastM / (111_320 * Math.cos((point.lat * Math.PI) / 180)),
  };
}

/**
 * What the device would have reported walking this path: every true position,
 * displaced by its own error, with the occasional wild fix and one stop.
 */
function record(truth, seed = 7) {
  const random = makeRandom(seed);
  const fixes = [];
  let ts = 1_800_000_000_000;
  const secondsPerStep = STEP_M / 1.3; // a walk, near enough

  const stopAt = Math.floor(truth.length / 2);

  truth.forEach((point, index) => {
    if (index === stopAt) {
      // Standing still: the fixes keep arriving and wander around one spot.
      for (let i = 0; i < STATIONARY_FIXES; i += 1) {
        const angle = random() * Math.PI * 2;
        const radius = random() * STATIONARY_RADIUS_M;
        fixes.push({
          ts,
          ...offset(point, Math.cos(angle) * radius, Math.sin(angle) * radius),
          accuracy_m: 10,
        });
        ts += 30_000;
      }
    }

    const spike = index > 0 && index % SPIKE_EVERY === 0;
    const metres = spike
      ? SPIKE_MIN_M + random() * (SPIKE_MAX_M - SPIKE_MIN_M)
      : Math.abs(gaussian(random) * JITTER_SIGMA_M);
    const angle = random() * Math.PI * 2;

    fixes.push({
      ts,
      ...offset(point, Math.cos(angle) * metres, Math.sin(angle) * metres),
      // ⚠ A spike reports a *good* accuracy, which is the whole difficulty:
      // the case `MAX_DRAWN_ACCURACY_M` cannot catch (traceGeoJson rule 3).
      accuracy_m: spike ? 12 : Math.round(6 + Math.abs(gaussian(random)) * 6),
    });
    ts += secondsPerStep * 1000;
  });

  return fixes;
}

/** Distance from a point to the true path, in metres. */
function metresFromTruth(point, truth) {
  let best = Infinity;
  for (let i = 1; i < truth.length; i += 1) {
    best = Math.min(best, metresToSegment(point, truth[i - 1], truth[i]));
  }
  return best;
}

function metresToSegment(point, a, b) {
  const scaleX = 111_320 * Math.cos((a.lat * Math.PI) / 180);
  const scaleY = 110_540;
  const px = (point.lon - a.lon) * scaleX;
  const py = (point.lat - a.lat) * scaleY;
  const bx = (b.lon - a.lon) * scaleX;
  const by = (b.lat - a.lat) * scaleY;
  const lengthSquared = bx * bx + by * by;
  if (lengthSquared === 0) {
    return Math.hypot(px, py);
  }
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared));
  return Math.hypot(px - t * bx, py - t * by);
}

/**
 * How far the drawn *line* strays from the truth, sampled along it.
 *
 * ⚠ **Measured along the line, not at its vertices, and the first version of
 * this got it wrong.** Vertex deviation made the cleaned trace look worse than
 * the raw one — 8.7 m against 6.8 m — for a reason that is arithmetic rather
 * than quality: Douglas-Peucker keeps precisely the points that stick out, so
 * what survives is biased towards the deviant ones. The user does not see
 * vertices. They see the stroke between them, which is what this samples.
 */
function deviation(points, truth) {
  const samples = [];
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    const steps = Math.max(1, Math.round(metresBetween(from, to) / 5));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      samples.push({
        lat: from.lat + (to.lat - from.lat) * t,
        lon: from.lon + (to.lon - from.lon) * t,
      });
    }
  }

  const all = samples.map((point) => metresFromTruth(point, truth));
  return {
    mean: all.reduce((sum, d) => sum + d, 0) / all.length,
    worst: Math.max(...all),
  };
}

function lengthM(points) {
  let metres = 0;
  for (let i = 1; i < points.length; i += 1) {
    metres += metresBetween(points[i - 1], points[i]);
  }
  return metres;
}

function draw(truth, raw, clean, file) {
  const width = 1400;
  const height = 900;
  const margin = 40;

  const all = [...truth, ...raw, ...clean];
  const north = Math.max(...all.map((p) => p.lat));
  const south = Math.min(...all.map((p) => p.lat));
  const east = Math.max(...all.map((p) => p.lon));
  const west = Math.min(...all.map((p) => p.lon));

  // One scale for both axes, so the drawing is not stretched — a squashed
  // picture would make a spike look like a wobble.
  const scale = Math.min(
    (width - margin * 2) / Math.max(east - west, 1e-9),
    (height - margin * 2) / Math.max(north - south, 1e-9)
  );
  const project = (point) => ({
    x: margin + (point.lon - west) * scale,
    y: height - margin - (point.lat - south) * scale,
  });

  const canvas = new Canvas(width, height, COLOURS.background);
  const stroke = (points, colour, thickness) => {
    for (let i = 1; i < points.length; i += 1) {
      const a = project(points[i - 1]);
      const b = project(points[i]);
      canvas.line(a.x, a.y, b.x, b.y, colour, thickness);
    }
  };

  stroke(truth, COLOURS.truth, 7);
  stroke(raw, COLOURS.raw, 2);
  stroke(clean, COLOURS.clean, 3);

  // A key, drawn as three short strokes in the corner.
  const keyY = margin;
  canvas.line(margin, keyY, margin + 60, keyY, COLOURS.truth, 7);
  canvas.line(margin, keyY + 20, margin + 60, keyY + 20, COLOURS.raw, 2);
  canvas.line(margin, keyY + 40, margin + 60, keyY + 40, COLOURS.clean, 3);

  writeFileSync(file, canvas.toPng());
}

function main() {
  // Flags may come in any order, so the route is the first argument that is
  // not one.
  const named = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  const routeFile = named ?? path.join(root, 'tools/routes/funchal-seafront.txt');
  const route = readRoute(routeFile);
  if (route.length < 2) {
    console.error(`No usable points in ${routeFile}`);
    process.exit(1);
  }

  const truth = densify(route);
  const raw = record(truth);

  // A sweep, because the simplification tolerance is the one number here that
  // visibly changes the drawing and there is no field data to set it from.
  const sweep = process.argv.includes('--sweep');
  if (sweep) {
    console.log('tolerance   points   drawn km   mean off   worst off');
    for (const tolerance of [8, 12, 16, 20, 25, 30, 40]) {
      const trial = cleanTrace(raw, tolerance);
      const off = deviation(trial.fixes, truth);
      console.log(
        `  ${String(tolerance).padStart(3)} m     ${String(trial.fixes.length).padStart(4)}` +
          `     ${(lengthM(trial.fixes) / 1000).toFixed(2)}` +
          `       ${off.mean.toFixed(1)} m     ${off.worst.toFixed(0)} m`
      );
    }
    console.log();
  }

  const tolerance = Number(
    (process.argv.find((arg) => arg.startsWith('--tolerance=')) ?? '').split('=')[1]
  );
  const { fixes: clean, stats } = cleanTrace(
    raw,
    Number.isFinite(tolerance) && tolerance > 0 ? tolerance : undefined
  );

  const before = deviation(raw, truth);
  const after = deviation(clean, truth);

  console.log(path.relative(root, routeFile).replace(/\\/g, '/'));
  console.log(
    `  truth        ${truth.length} points, ${(lengthM(truth) / 1000).toFixed(2)} km`
  );
  console.log(
    `  recorded     ${raw.length} fixes, ${(lengthM(raw) / 1000).toFixed(2)} km drawn` +
      `   mean ${before.mean.toFixed(1)} m off, worst ${before.worst.toFixed(0)} m`
  );
  console.log(
    `  cleaned      ${clean.length} fixes, ${(lengthM(clean) / 1000).toFixed(2)} km drawn` +
      `   mean ${after.mean.toFixed(1)} m off, worst ${after.worst.toFixed(0)} m`
  );
  console.log(
    `  removed      ${stats.spikesRemoved} outliers, ` +
      `${stats.stationaryCollapsed} standing still, ${stats.simplifiedAway} redundant`
  );

  const outDir = path.join(root, 'tools', 'out');
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'trace-preview.png');
  draw(truth, raw, clean, out);
  console.log();
  console.log('Wrote tools/out/trace-preview.png — grey is the truth, red recorded, blue cleaned.');
  console.log('⚠ The noise is modelled, not measured (T-018). Judge the shape, not the numbers.');
}

main();
