/**
 * The Play feature graphic (1024 × 500), drawn as options for the project lead
 * (T-269, round three).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-feature-graphic.mjs
 *     → tools/out/feature-graphic/{b,d,e,f}.png and index.html
 *
 * Round one drew A (the lit island on slate with the name), B (the flag) and C
 * (the road network); the lead chose B. Round two set B beside three quieter
 * versions and the lead kept B. Round three (2026-11-24): B is live, and the
 * lead finds it "a bit too similar to the icon". So three directions that do
 * not reuse the icon's picture, with B alongside for comparison. Rounds one and
 * two are in git history.
 *
 * Nothing here is a person's trace (D-016): the lit roads are driven routes over
 * the shipped OpenStreetMap network (`lib/syntheticTrips.mjs`), the levadas are
 * `content/levadas.json`, and the stamps are drawn by the app's own stamp art.
 *
 * Google shows the graphic at many sizes and may crop it, so the subject sits in
 * the middle and the only text is the name, which needs no translation.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { islandPaths, PALETTE } from './lib/icon-art.mjs';
import { flagBanner, H, W } from './lib/feature-graphic.mjs';
import { mainIslandRings, ROUTE } from './lib/icon-geometry.mjs';
import { drivenRoute, rng } from './lib/syntheticTrips.mjs';
import { stampSvg } from './lib/svg-render.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const readJson = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));

const rings = mainIslandRings();
const { decodeRoadGraph } = await import(pathToFileURL(path.join(root, 'app/src/matching/roadGraph.ts')).href);
const graph = decodeRoadGraph(readJson('content/roads.json'));
const routing = await import(pathToFileURL(path.join(root, 'app/src/matching/roadRouting.ts')).href);
const levadas = readJson('content/levadas.json');
const places = readJson('content/pois.json').places;

const font = `font-family="Segoe UI, Roboto, Arial, sans-serif"`;
const NIGHT = '#0F1A20';

const fmt = (points) => `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}`;

/** The island, its whole road network and a set of lit roads, in the 108 canvas. */
function nightIsland(island, { litSeed = 7, litWalks = 9, walkM = 30000, levadaGlow = true } = {}) {
  const project = (e, i) => island.project(graph.lon[i], graph.lat[i]);
  let network = '';
  for (let e = 0; e < graph.edgeCount; e += 1) {
    const from = graph.pointStart[e];
    const to = graph.pointStart[e + 1];
    if (graph.lat[from] < 32.6) continue; // the Desertas and Porto Santo
    const pts = [];
    for (let i = from; i < to; i += 1) pts.push(project(e, i));
    network += fmt(pts);
  }
  // Lit roads: walks from real places, so they cluster where people go.
  const random = rng(litSeed);
  const starts = places.filter((p) => p.geofences[0].lat > 32.6);
  const nearest = (lat, lon) => {
    let best = -1;
    let bestD = Infinity;
    for (let e = 0; e < graph.edgeCount; e += 1) {
      const kind = graph.edgeKindCodes[e].toLowerCase();
      if (!'mpr'.includes(kind)) continue;
      const i = graph.pointStart[e];
      const d = (graph.lat[i] - lat) ** 2 + (graph.lon[i] - lon) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  };
  let lit = '';
  for (let w = 0; w < litWalks; w += 1) {
    const place = starts[Math.floor(random() * starts.length)];
    const steps = drivenRoute(graph, routing, nearest(place.geofences[0].lat, place.geofences[0].lon), walkM * (0.5 + random()), random, ['m', 'p', 'r']);
    for (const { edge } of steps) {
      const pts = [];
      for (let i = graph.pointStart[edge]; i < graph.pointStart[edge + 1]; i += 1) pts.push(project(edge, i));
      lit += fmt(pts);
    }
  }
  let lev = '';
  for (const f of levadas.features) {
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const line of lines) lev += fmt(line.map(([lon, lat]) => island.project(lon, lat)));
  }
  return `
    <path d="${island.d}" fill="#1D3329" stroke="#1D3329" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="${island.d}" fill="none" stroke="#3E6B58" stroke-opacity="0.6" stroke-width="0.35" stroke-linejoin="round"/>
    <path d="${network}" fill="none" stroke="#8FB3C4" stroke-opacity="0.16" stroke-width="0.1"/>
    ${levadaGlow ? `<path d="${lev}" fill="none" stroke="#7FE0C2" stroke-opacity="0.14" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${lev}" fill="none" stroke="#9FF0D6" stroke-opacity="0.55" stroke-width="0.2" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    <path d="${lit}" fill="none" stroke="${PALETTE.roadGlow}" stroke-opacity="0.25" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${lit}" fill="none" stroke="${PALETTE.road}" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${lit}" fill="none" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="0.14" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** D: the island at night, its whole network faint and the roads you have driven lit, levadas in green light. */
function optionD() {
  const island = islandPaths(rings, 100, 54);
  // The island's middle (54, 54) at (512, 270), 8.4 px a unit: about 840 px wide.
  const s = 8.4;
  return `<defs><radialGradient id="sea" cx="50%" cy="55%" r="65%">
      <stop offset="0" stop-color="#173039"/><stop offset="1" stop-color="${NIGHT}"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sea)"/>
    <g transform="translate(${512 - 54 * s} ${282 - 54 * s}) scale(${s})">${nightIsland(island)}</g>
    <text x="512" y="92" text-anchor="middle" ${font} font-size="64" font-weight="600" letter-spacing="6" fill="#FFFFFF">Bruma</text>`;
}

/** A smooth ridge line across the banner, from a seeded sum of sines. */
function ridge(seed, base, amp, { peaks = 3 } = {}) {
  const r = rng(seed);
  const waves = Array.from({ length: peaks + 2 }, (_, i) => ({ f: (i + 1) * (0.6 + r() * 0.8), p: r() * 6.28, a: amp / (i + 1) ** 0.9 }));
  const pts = [];
  for (let x = -10; x <= W + 10; x += 8) {
    const t = x / W;
    const y = base - waves.reduce((s, w) => s + w.a * Math.sin(t * w.f * Math.PI * 2 + w.p), 0);
    pts.push([x, y]);
  }
  return { pts, d: `${fmt(pts)}L${W + 10},${H + 10}L-10,${H + 10}Z` };
}

/** E: Bruma is mist. Ridges in layers of cloud at dusk, one road lit through them. */
function optionE() {
  const layers = [
    { seed: 3, base: 250, amp: 60, fill: '#5C7486', peaks: 2 },
    { seed: 11, base: 315, amp: 50, fill: '#3F5767' },
    { seed: 21, base: 385, amp: 42, fill: '#2A3F4C' },
    { seed: 5, base: 455, amp: 28, fill: '#18262E' },
  ];
  const mist = (y, h, o) => `<rect x="-40" y="${y}" width="${W + 80}" height="${h}" fill="url(#mist)" opacity="${o}" filter="url(#soft)"/>`;
  const ridges = layers.map((l) => ({ ...l, ...ridge(l.seed, l.base, l.amp, { peaks: l.peaks ?? 3 }) }));
  // The lit road: switchbacks climbing the third ridge's face, then along its crest.
  const crest = ridges[2].pts;
  const yAt = (x) => crest.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best))[1];
  // From the foreground, bottom left, up onto the third ridge and along its face below the crest.
  const road = [[40, 520], [110, 470]];
  for (let x = 200; x <= 900; x += 70) road.push([x, yAt(x) + 26 + 6 * Math.sin(x / 90)]);
  // A smooth curve through the midpoints, the points as controls: it never doubles back.
  let roadD = `M${road[0][0]},${road[0][1]}`;
  for (let i = 1; i < road.length - 1; i += 1) {
    const [x, y] = road[i];
    const [nx, ny] = road[i + 1];
    roadD += ` Q${x},${y} ${(x + nx) / 2},${(y + ny) / 2}`;
  }
  roadD += ` L${road[road.length - 1][0]},${road[road.length - 1][1]}`;
  return `<defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1B2A33"/><stop offset="0.55" stop-color="#5E7A8C"/><stop offset="1" stop-color="#E9C9A8"/></linearGradient>
      <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#E8EEF2" stop-opacity="0"/><stop offset="0.5" stop-color="#E8EEF2" stop-opacity="0.75"/><stop offset="1" stop-color="#E8EEF2" stop-opacity="0"/></linearGradient>
      <filter id="soft" x="-5%" y="-60%" width="110%" height="220%"><feGaussianBlur stdDeviation="14"/></filter>
      <filter id="blur" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <circle cx="760" cy="215" r="34" fill="#FBE3C4" opacity="0.55"/>
    <path d="${ridges[0].d}" fill="${ridges[0].fill}"/>
    ${mist(190, 140, 0.7)}
    <path d="${ridges[1].d}" fill="${ridges[1].fill}"/>
    ${mist(260, 130, 0.55)}
    <path d="${ridges[2].d}" fill="${ridges[2].fill}"/>
    <path d="${roadD}" fill="none" stroke="${PALETTE.roadGlow}" stroke-opacity="0.45" stroke-width="12" stroke-linecap="round" filter="url(#blur)"/>
    <path d="${roadD}" fill="none" stroke="${PALETTE.road}" stroke-width="4" stroke-linecap="round"/>
    <path d="${roadD}" fill="none" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="1.4" stroke-linecap="round"/>
    ${mist(370, 110, 0.4)}
    <path d="${ridges[3].d}" fill="${ridges[3].fill}"/>
    <text x="512" y="132" text-anchor="middle" ${font} font-size="80" font-weight="600" letter-spacing="10" fill="#FFFFFF">Bruma</text>`;
}

/** One of the app's own stamps, placed and turned. resvg ignores CSS transforms, so the tilt moves to a group. */
function placedStamp(id, size, x, y, extraTilt = 0) {
  const place = places.find((p) => p.id === id);
  let svg = stampSvg(id, place.name, place.category, true);
  const tilt = Number(/rotate\(([-\d.]+)deg\)/.exec(svg)?.[1] ?? 0) + extraTilt;
  svg = svg.replace(/ style="[^"]*"/, ` x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}"`);
  return `<g transform="translate(${x} ${y}) rotate(${tilt})">${svg}</g>`;
}

/** F: the passport. Five stamps fanned across the island at night. */
function optionF() {
  const island = islandPaths(rings, 100, 54);
  const s = 8.4;
  const stamps = [
    ['pico-do-areeiro', 190, 250, -8],
    ['levada-das-25-fontes', 350, 225, 4],
    ['cabo-girao', 512, 250, -2],
    ['porto-moniz', 674, 225, 6],
    ['praia-de-machico', 834, 250, -5],
  ];
  return `<rect width="${W}" height="${H}" fill="${NIGHT}"/>
    <g opacity="0.75" transform="translate(${512 - 54 * s} ${250 - 54 * s}) scale(${s})">${nightIsland(island, { litWalks: 8, levadaGlow: false })}</g>
    ${stamps.map(([id, x, y, t]) => placedStamp(id, 190, x, y, t)).join('\n')}
    <text x="512" y="452" text-anchor="middle" ${font} font-size="48" font-weight="600" letter-spacing="5" fill="#FFFFFF">Bruma</text>`;
}

const options = [
  ['b', 'B, the banner now', 'What Play shows today: the icon at banner size. For comparison.', flagBanner(rings, ROUTE)],
  ['d', 'D, the island at night', 'The whole road network faint, a month of driving lit in the app’s blue, the levadas glowing green. What the app looks like after you have used it, which the icon does not show.', optionD()],
  ['e', 'E, bruma', 'The name in a picture: ridges in layers of mist at dusk, one road lit through them. No map at all, nothing like the icon.', optionE()],
  ['f', 'F, the passport', 'Five of the app’s real stamps fanned over the island at night: the collecting side of the app.', optionF()],
];

const out = path.join(here, 'out', 'feature-graphic');
mkdirSync(out, { recursive: true });
/** Each option as a PNG, also kept for the page: it embeds them, so it opens on its own when sent. */
const pngs = new Map();
for (const [id, , , body] of options) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: true } }).render().asPng();
  writeFileSync(path.join(out, `${id}.png`), png);
  pngs.set(id, `data:image/png;base64,${Buffer.from(png).toString('base64')}`);
}
writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Feature graphic options</title>
<style>body{margin:0;padding:24px;background:#111;color:#eee;font-family:system-ui,sans-serif}
figure{margin:0 0 28px}img{width:100%;max-width:1024px;display:block;border-radius:8px}
figcaption{margin-top:8px;max-width:1024px;line-height:1.4}b{display:block;color:#fff}</style>
<h2>T-269: the Play feature graphic, round three: away from the icon (1024 × 500)</h2>
${options.map(([id, name, note]) => `<figure><img src="${pngs.get(id)}" alt=""><figcaption><b>${name}</b>${note}</figcaption></figure>`).join('')}`
);
console.log('tools/out/feature-graphic/index.html');
