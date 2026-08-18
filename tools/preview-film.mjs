/**
 * Draw the film as a contact sheet, so it can be looked at (T-105b, D-063).
 *
 *     node tools/preview-film.mjs
 *     node tools/preview-film.mjs --frames 24 --route tools/routes/funchal-seafront.txt
 *     → tools/out/film-contact-sheet.html
 *
 * ⚠ **Nobody has ever seen a frame of this film.** `composition.ts` has planned
 * it since T-105a and `frame.ts` can now sample it, and the whole thing has been
 * verified exclusively by arithmetic. Geometry that passes every test still
 * renders as a crosshair sometimes — that is not hypothetical here, it is what
 * happened to the stamp mark — so the rule in CLAUDE.md is that anything visual
 * gets a second renderer and gets **looked at**.
 *
 * THE HONEST DESCRIPTION OF WHAT THIS IS
 * --------------------------------------
 * A contact sheet, not a video. It samples the film at N evenly spaced times
 * and draws each one, which answers *does the walk draw in the right order, is
 * the camera pointing at the right thing, do the stamps land where they should,
 * is anything cropped* — and answers **nothing at all** about motion. Whether
 * the pan feels smooth or the stamps pop too fast needs a real player, and a
 * real player needs a device.
 *
 * It composes **nothing of its own**: the times come from `frameTimes`, the
 * contents from `frameAt`, and the pixels from `projector`. If it drew its own
 * version of any of that, the sheet that gets approved would not be the film
 * that ships.
 *
 * ⚠ The trip is invented; only the *route* is real, read from `tools/routes/`
 * and cleaned by the app's own `traceCleanup` so the line is exactly what the
 * map would draw (D-066).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.removeAllListeners('warning');

const { composeSouvenir } = await import('../app/src/souvenir/composition.ts');
const { frameAt, frameCount, frameTimes, projector } = await import(
  '../app/src/souvenir/frame.ts'
);
const { cleanTrace } = await import('../app/src/map/traceCleanup.ts');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const routeFile = path.resolve(
  root,
  arg('route', 'tools/routes/funchal-seafront.txt')
);
const cells = Number(arg('frames', '24'));

// --- the route, through the app's own cleanup -------------------------------

const points = [];
for (const line of readFileSync(routeFile, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) continue;
  const [lat, lon] = trimmed.split(/\s+/).map(Number);
  if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon });
}

const T0 = 1_800_000_000_000;
const raw = points.map((point, i) => ({
  ts: T0 + i * 20_000,
  lat: point.lat,
  lon: point.lon,
  accuracy_m: 10,
}));
const fixes = cleanTrace(raw).fixes;

if (fixes.length < 2) {
  console.error(`Not enough usable fixes in ${routeFile} — got ${fixes.length}.`);
  process.exit(1);
}

// Stamps invented, but placed on the route rather than near it, so the cues
// land where a real arrival would. Names are made up on purpose (D-017).
const stampAt = (fraction, id, name, category) => {
  const fix = fixes[Math.min(fixes.length - 1, Math.floor(fixes.length * fraction))];
  return {
    placeId: id,
    name,
    category,
    awardedTs: fix.ts,
    lat: fix.lat,
    lon: fix.lon,
  };
};

const composition = composeSouvenir({
  trace: { fixes, safeToShare: true, reason: 'preview fixture' },
  stamps: [
    stampAt(0.15, 'a', 'First Lookout', 'viewpoint'),
    stampAt(0.4, 'b', 'The Water Walk', 'levada'),
    stampAt(0.62, 'c', 'Old Harbour', 'landmark'),
    stampAt(0.88, 'd', 'Black Beach', 'beach'),
  ],
  totalPlaces: 60,
  gapThresholdMs: 30 * 60 * 1000,
});

if (!composition.renderable) {
  console.error(`The film refused to exist: ${composition.reason}`);
  process.exit(1);
}

// --- drawing ----------------------------------------------------------------

const CATEGORY_COLOUR = {
  viewpoint: '#5AA9FF',
  levada: '#30D158',
  village: '#FFD60A',
  beach: '#4CC9F0',
  landmark: '#B5179E',
};

/** One frame, at a tenth of the real size — a contact sheet, not a poster. */
const CELL_W = 108;
const CELL_H = 192;

function drawFrame(frame) {
  const toPixel = projector(frame.bounds, CELL_W, CELL_H);

  const paths = frame.strokes
    .map((stroke) => {
      const d = stroke
        .map(([lon, lat], i) => {
          const [x, y] = toPixel(lon, lat);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');
      return `<path d="${d}" fill="none" stroke="#F1F7FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');

  const marks = frame.stamps
    .map((stamp) => {
      const [x, y] = toPixel(stamp.lon, stamp.lat);
      // A stamp that just landed is drawn larger, so the contact sheet shows
      // the pop the renderer is expected to animate.
      const grow = Math.max(0, 1 - stamp.ageMs / 400);
      const r = 3 + grow * 4;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${CATEGORY_COLOUR[stamp.category] ?? '#FFFFFF'}"/>`;
    })
    .join('');

  const hero =
    frame.hero === null
      ? ''
      : `<text x="${CELL_W / 2}" y="${CELL_H - 24}" text-anchor="middle" fill="#FFFFFF" font-size="22" font-weight="700">${frame.hero.collected}<tspan font-size="13" fill="#A0A0A8"> / ${frame.hero.total}</tspan></text>`;

  return `<svg width="${CELL_W}" height="${CELL_H}" viewBox="0 0 ${CELL_W} ${CELL_H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${CELL_W}" height="${CELL_H}" fill="#0E0E10"/>
  ${paths}${marks}${hero}
</svg>`;
}

// Evenly spaced across the film, taken from the real schedule so a cell is
// always an actual frame the encoder would produce.
const schedule = frameTimes(composition);
const chosen = [];
for (let i = 0; i < cells; i += 1) {
  chosen.push(schedule[Math.min(schedule.length - 1, Math.round((i * (schedule.length - 1)) / Math.max(1, cells - 1)))]);
}

const figures = chosen
  .map((at) => {
    const frame = frameAt(composition, at);
    const label = `${(at / 1000).toFixed(2)}s · ${frame.kind} · ${frame.strokes.length} stroke${frame.strokes.length === 1 ? '' : 's'} · ${frame.stamps.length} stamp${frame.stamps.length === 1 ? '' : 's'}`;
    return `<figure>${drawFrame(frame)}<figcaption>${label}</figcaption></figure>`;
  })
  .join('\n');

const html = `<!doctype html>
<meta charset="utf-8">
<title>Film contact sheet</title>
<style>
  body { background: #1C1C1E; color: #F1F7FF; font: 14px/1.5 -apple-system, system-ui, sans-serif; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.note { color: #A0A0A8; max-width: 62ch; }
  .sheet { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 20px; }
  figure { margin: 0; }
  figcaption { color: #A0A0A8; font-size: 11px; margin-top: 4px; width: ${CELL_W}px; }
</style>
<h1>The souvenir film, ${chosen.length} of ${frameCount(composition)} frames</h1>
<p class="note">
  Route: <code>${path.relative(root, routeFile)}</code> —
  ${(composition.durationMs / 1000).toFixed(1)}s at ${composition.frameRate} fps.
  Frames are drawn at a tenth size. <b>This shows composition, not motion</b>:
  whether the walk draws in the right order, where the camera points, whether
  a stamp lands off the edge. Whether the pan feels smooth needs a player, and
  a player needs a device.
</p>
<div class="sheet">
${figures}
</div>
`;

const outDir = path.join(root, 'tools', 'out');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'film-contact-sheet.html');
writeFileSync(out, html);

console.log(
  `${(composition.durationMs / 1000).toFixed(1)}s, ${frameCount(composition)} frames at ${composition.frameRate} fps`
);
for (const scene of composition.scenes) {
  console.log(
    `  ${scene.startMs.toString().padStart(6)}ms  ${scene.kind.padEnd(9)} ${scene.durationMs}ms` +
      (scene.kind === 'draw'
        ? `  ${scene.segments.length} segment(s), ${scene.cues.length} cue(s), ${scene.camera.length} keyframe(s)`
        : '')
  );
}
console.log(`\nWrote tools/out/film-contact-sheet.html (${chosen.length} frames drawn)`);
