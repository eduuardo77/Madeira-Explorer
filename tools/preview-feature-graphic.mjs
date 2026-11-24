/**
 * The Play feature graphic (1024 × 500), drawn as options for the project lead
 * (T-269, round three).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-feature-graphic.mjs
 *     → tools/out/feature-graphic/{g,g2,h,b,d,e,f}.png and index.html
 *
 * Round one drew A (the lit island on slate with the name), B (the flag) and C
 * (the road network); the lead chose B. Round two set B beside three quieter
 * versions and the lead kept B. Round three (2026-11-24): B is live, and the
 * lead finds it "a bit too similar to the icon". So three directions that do
 * not reuse the icon's picture, with B alongside for comparison. Rounds one and
 * two are in git history. Round four (same day): the lead asked for something
 * "not as dark and with more professional finish and polish": G and G2 (the
 * island as a light map) and H (E at first light), drawn above round three.
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

/** The island's whole road network, a set of lit roads and the levadas, as paths in the 108 canvas. */
function islandLayers(island, { litSeed = 7, litWalks = 9, walkM = 30000, kinds = ['m', 'p', 'r'], alwaysKinds = [] } = {}) {
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
    const steps = drivenRoute(graph, routing, nearest(place.geofences[0].lat, place.geofences[0].lon), walkM * (0.5 + random()), random, kinds);
    for (const { edge } of steps) {
      const pts = [];
      for (let i = graph.pointStart[edge]; i < graph.pointStart[edge + 1]; i += 1) pts.push(project(edge, i));
      lit += fmt(pts);
    }
  }
  // Every road of these kinds, lit whole: the expressways, which nearly every visitor drives.
  for (let e = 0; e < graph.edgeCount; e += 1) {
    if (!alwaysKinds.includes(graph.edgeKindCodes[e].toLowerCase()) || graph.lat[graph.pointStart[e]] < 32.6) continue;
    const pts = [];
    for (let i = graph.pointStart[e]; i < graph.pointStart[e + 1]; i += 1) pts.push(project(e, i));
    lit += fmt(pts);
  }
  let lev = '';
  for (const f of levadas.features) {
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const line of lines) lev += fmt(line.map(([lon, lat]) => island.project(lon, lat)));
  }
  return { network, lit, lev };
}

/** The island at night: the network faint, the lit roads in the dark map's blue. */
function nightIsland(island, { levadaGlow = true, ...litOptions } = {}) {
  const { network, lit, lev } = islandLayers(island, litOptions);
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
const DUSK = {
  ridges: ['#5C7486', '#3F5767', '#2A3F4C', '#18262E'],
  sky: ['#1B2A33', '#5E7A8C', '#E9C9A8'],
  sun: '#FBE3C4',
  mist: '#E8EEF2',
  road: PALETTE.road,
  ink: '#FFFFFF',
  sub: null,
};
function optionE(c = DUSK) {
  const layers = [
    { seed: 3, base: 250, amp: 60, fill: c.ridges[0], peaks: 2 },
    { seed: 11, base: 315, amp: 50, fill: c.ridges[1] },
    { seed: 21, base: 385, amp: 42, fill: c.ridges[2] },
    { seed: 5, base: 455, amp: 28, fill: c.ridges[3] },
  ];
  const mist = (y, h, o) => `<rect x="-40" y="${y}" width="${W + 80}" height="${h}" fill="url(#mist)" opacity="${o}" filter="url(#soft)"/>`;
  const ridges = layers.map((l) => ({ ...l, ...ridge(l.seed, l.base, l.amp, { peaks: l.peaks ?? 3 }) }));
  // The lit road: switchbacks climbing the third ridge's face, then along its crest.
  const crest = ridges[2].pts;
  const yAt = (x) => crest.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best))[1];
  // From the foreground, bottom left, up onto the third ridge and along its face below the crest.
  const road = [[40, 520], [110, 470]];
  for (let x = 200; x <= W + 60; x += 70) road.push([x, yAt(x) + 26 + 6 * Math.sin(x / 90)]);
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
        <stop offset="0" stop-color="${c.sky[0]}"/><stop offset="0.55" stop-color="${c.sky[1]}"/><stop offset="1" stop-color="${c.sky[2]}"/></linearGradient>
      <radialGradient id="sunGlow"><stop offset="0" stop-color="${c.sun}" stop-opacity="0.9"/><stop offset="0.35" stop-color="${c.sun}" stop-opacity="0.35"/><stop offset="1" stop-color="${c.sun}" stop-opacity="0"/></radialGradient>
      <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.mist}" stop-opacity="0"/><stop offset="0.5" stop-color="${c.mist}" stop-opacity="0.75"/><stop offset="1" stop-color="${c.mist}" stop-opacity="0"/></linearGradient>
      <filter id="soft" x="-5%" y="-60%" width="110%" height="220%"><feGaussianBlur stdDeviation="14"/></filter>
      <filter id="blur" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${c.sub === null ? `<circle cx="760" cy="215" r="34" fill="${c.sun}" opacity="0.55"/>` : `<circle cx="760" cy="200" r="150" fill="url(#sunGlow)"/><circle cx="760" cy="200" r="30" fill="${c.sun}"/>`}
    <path d="${ridges[0].d}" fill="${ridges[0].fill}"/>
    ${mist(190, 140, 0.7)}
    <path d="${ridges[1].d}" fill="${ridges[1].fill}"/>
    ${mist(260, 130, 0.55)}
    <path d="${ridges[2].d}" fill="${ridges[2].fill}"/>
    <path d="${roadD}" fill="none" stroke="${c.sub === null ? c.road : '#FFFFFF'}" stroke-opacity="${c.sub === null ? 0.45 : 0.9}" stroke-width="${c.sub === null ? 12 : 16}" stroke-linecap="round" filter="url(#blur)"/>
    <path d="${roadD}" fill="none" stroke="${c.road}" stroke-width="${c.sub === null ? 4 : 5.5}" stroke-linecap="round"/>
    <path d="${roadD}" fill="none" stroke="#FFFFFF" stroke-opacity="${c.sub === null ? 0.8 : 0.45}" stroke-width="${c.sub === null ? 1.4 : 1.2}" stroke-linecap="round"/>
    ${mist(370, 110, 0.4)}
    <path d="${ridges[3].d}" fill="${ridges[3].fill}"/>
    ${c.sub === null
      ? `<text x="512" y="132" text-anchor="middle" ${font} font-size="80" font-weight="600" letter-spacing="10" fill="${c.ink}">Bruma</text>`
      : wordmark(512, 120, 84, c.ink, c.sub)}`;
}

/** The name and, under it, MADEIRA in spaced capitals: a word every language reads the same. */
function wordmark(x, y, size, ink, sub, anchor = 'middle') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Segoe UI Semibold, Segoe UI, Roboto, Arial, sans-serif" font-size="${size}" font-weight="600" letter-spacing="${size * 0.06}" fill="${ink}">Bruma</text>
    <text x="${anchor === 'middle' ? x : x + 4}" y="${y + size * 0.48}" text-anchor="${anchor}" ${font} font-size="${size * 0.22}" font-weight="600" letter-spacing="${size * 0.11}" fill="${sub}">MADEIRA</text>`;
}

/** H: E at first light. Pale sky, white mist, the road in a deep blue with a white halo. */
function optionH() {
  return optionE({
    ridges: ['#B7CAD6', '#91AABA', '#6D889B', '#3E5869'],
    sky: ['#B9D3E3', '#DCE8EE', '#F7E8D8'],
    sun: '#FFF3E0',
    mist: '#FFFFFF',
    road: '#1F6FE0',
    ink: '#1B2A33',
    sub: '#4C6677',
  });
}

/** The island by day, map style: soft shadow, shelf rings in the sea, lit roads in deep blue with a white casing. */
function dayIsland(island, { pins = true } = {}) {
  const { network, lit, lev } = islandLayers(island, { litSeed: 4, litWalks: 4, walkM: 40000, kinds: ['m', 'p'], alwaysKinds: ['m'] });
  const pinAt = (id) => {
    const g = places.find((p) => p.id === id).geofences[0];
    const [x, y] = island.project(g.lon, g.lat);
    return `<circle cx="${x}" cy="${y}" r="1.25" fill="#FFFFFF" filter="url(#pinShadow)"/><circle cx="${x}" cy="${y}" r="0.7" fill="#E4572E"/>`;
  };
  const line = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
  return `
    <path d="${island.d}" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="9" stroke-linejoin="round"/>
    <path d="${island.d}" fill="none" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="${island.d}" fill="#000000" fill-opacity="0.18" stroke="#000000" stroke-opacity="0.18" stroke-width="2.4" stroke-linejoin="round" transform="translate(0.6 1.4)" filter="url(#islandShadow)"/>
    <path d="${island.d}" fill="url(#land)" stroke="url(#land)" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="${island.d}" fill="none" stroke="#FFFFFF" stroke-opacity="0.9" stroke-width="0.35" stroke-linejoin="round"/>
    <path d="${network}" fill="none" stroke="#7D8F86" stroke-opacity="0.28" stroke-width="0.09"/>
    <path d="${lev}" ${line} stroke="#1E9E78" stroke-opacity="0.75" stroke-width="0.22" stroke-dasharray="0.6 0.45"/>
    <path d="${lit}" ${line} stroke="#FFFFFF" stroke-width="1.05"/>
    <path d="${lit}" ${line} stroke="#1F6FE0" stroke-width="0.55"/>
    ${pins ? ['pico-do-areeiro', 'cabo-girao', 'porto-moniz', 'levada-das-25-fontes', 'santana', 'ponta-de-sao-lourenco'].map(pinAt).join('') : ''}`;
}

const DAY_DEFS = `
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EAF4F8"/><stop offset="1" stop-color="#CFE4EE"/></linearGradient>
    <radialGradient id="seaLight" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.7"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
    <linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E9F0DC"/><stop offset="0.6" stop-color="#D6E5C6"/><stop offset="1" stop-color="#C7DBB6"/></linearGradient>
    <filter id="islandShadow" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="pinShadow" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="0" dy="0.25" stdDeviation="0.3" flood-color="#000000" flood-opacity="0.35"/></filter>`;

/** G: the island by day, centred, the name above it. */
function optionG() {
  const island = islandPaths(rings, 100, 54);
  const s = 7.2;
  return `<defs>${DAY_DEFS}</defs>
    <rect width="${W}" height="${H}" fill="url(#sea)"/>
    <rect width="${W}" height="${H}" fill="url(#seaLight)"/>
    <g transform="translate(${512 - 54 * s} ${306 - 54 * s}) scale(${s})">${dayIsland(island)}</g>
    ${wordmark(512, 92, 62, '#1B2A33', '#4C6677')}`;
}

/** G2: the same island by day, to the right, the name on the left. */
function optionG2() {
  const island = islandPaths(rings, 100, 54);
  const s = 6.0;
  return `<defs>${DAY_DEFS}</defs>
    <rect width="${W}" height="${H}" fill="url(#sea)"/>
    <rect width="${W}" height="${H}" fill="url(#seaLight)"/>
    <g transform="translate(${672 - 54 * s} ${262 - 54 * s}) scale(${s})">${dayIsland(island)}</g>
    ${wordmark(64, 252, 72, '#1B2A33', '#4C6677', 'start')}`;
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
  ['g', 'G, the island by day', 'A light map: the island with a soft shadow and pale shelf rings in the sea, a few trips in deep blue with a white casing, levadas as green dashes, six places pinned. MADEIRA under the name reads the same in every language.', optionG()],
  ['g2', 'G2, the same, name on the left', 'G as a layout with the name beside the island instead of above it: more room for both.', optionG2()],
  ['h', 'H, bruma at first light', 'E redrawn in daylight: pale sky, white mist, a soft sun, the road in deep blue with a white halo.', optionH()],
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
<h2>T-269: the Play feature graphic, round four: lighter, G, G2 and H; round three below (1024 × 500)</h2>
${options.map(([id, name, note]) => `<figure><img src="${pngs.get(id)}" alt=""><figcaption><b>${name}</b>${note}</figcaption></figure>`).join('')}`
);
console.log('tools/out/feature-graphic/index.html');
