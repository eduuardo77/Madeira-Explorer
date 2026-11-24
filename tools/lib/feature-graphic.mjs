/**
 * The Play feature graphic (1024 × 500): the lead's pick, G2, the island as a
 * light map with the name on its left (T-269 round four, 2026-11-24). It
 * replaced B, the flag (2026-10-07), which the lead came to find too close to
 * the icon; B stays here so the options page can still show it beside the rest.
 * Shared by `build-icon.mjs`, which writes the file Play takes, and
 * `preview-feature-graphic.mjs`, which drew the options, so the banner that
 * ships is the one picked.
 *
 * Nothing here is a person's trace (D-016): the island is the regions'
 * outline, the lit roads are every expressway plus a few routes chosen by
 * `drivenRoute` over the shipped OpenStreetMap network, and the levadas and
 * pins are `content/`.
 *
 * ⚠ The name is text, so the renderer needs `font: { loadSystemFonts: true }`
 * and draws it in Segoe UI Semibold on Windows. Render on this machine.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { islandPaths, MADEIRA, orderOfChristCross, PALETTE } from './icon-art.mjs';
import { drivenRoute, rng } from './syntheticTrips.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
const { decodeRoadGraph } = await import(pathToFileURL(path.join(root, 'app/src/matching/roadGraph.ts')).href);
export const graph = decodeRoadGraph(readJson('content/roads.json'));
const routing = await import(pathToFileURL(path.join(root, 'app/src/matching/roadRouting.ts')).href);
const levadas = readJson('content/levadas.json');
export const places = readJson('content/pois.json').places;

export const font = `font-family="Segoe UI, Roboto, Arial, sans-serif"`;
export const fmt = (points) => `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}`;

export const W = 1024;
export const H = 500;

/** The island `width` units wide in the 108 canvas, placed by `transform`, with its lit road along `route`. */
export function islandWithRoad(rings, route, width, transform, { edge = null } = {}) {
  const island = islandPaths(rings, width, 54);
  const road = curve(route.map(([lon, lat]) => island.project(lon, lat)));
  const outline =
    edge === null
      ? ''
      : `<path d="${island.d}" fill="${PALETTE.island}" stroke="${edge}" stroke-width="4.4" stroke-linejoin="round"/>`;
  return {
    island,
    svg: `<g transform="${transform}">
      ${outline}
      <!-- 3.2 wide in the island's own colour, a little more than the icon: the regions do not
           quite meet, and a thinner edge showed the gaps as slivers. -->
      <path d="${island.d}" fill="${PALETTE.island}" stroke="${PALETTE.island}" stroke-width="3.2" stroke-linejoin="round"/>
      <path d="${road}" fill="none" stroke="${PALETTE.roadGlow}" stroke-opacity="0.35" stroke-width="4.5" stroke-linecap="round"/>
      <path d="${road}" fill="none" stroke="${PALETTE.road}" stroke-width="1.8" stroke-linecap="round"/>
      <path d="${road}" fill="none" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="0.6" stroke-linecap="round"/>
    </g>`,
  };
}

/** The same smooth curve the icon draws its road with. */
function curve(points) {
  const [first, ...rest] = points;
  let d = `M${first[0]},${first[1]}`;
  rest.forEach(([x, y], i) => {
    const [px, py] = i === 0 ? first : rest[i - 1];
    d += ` Q${px + (x - px) / 2},${py} ${x},${y}`;
  });
  return d;
}

/**
 * B: the flag across the whole banner, as in the icon: the bands, the cross,
 * the island and its road. `blue` and `gold` default to the flag's own.
 */
export function flagBanner(rings, route, { blue = MADEIRA.flagBlue, gold = MADEIRA.flagGold } = {}) {
  const { svg } = islandWithRoad(rings, route, 100, 'translate(242 10) scale(5.2)', { edge: '#FFFFFF' });
  const third = W / 3;
  return `<rect width="${W}" height="${H}" fill="${blue}"/>
    <rect x="${third}" width="${third}" height="${H}" fill="${gold}"/>
    <g transform="translate(512 70) scale(3.2) translate(-54 -38)">${orderOfChristCross(54, 38, 18)}</g>
    ${svg}`;
}

/** The island's whole road network, a set of lit roads and the levadas, as paths in the 108 canvas. */
export function islandLayers(island, { litSeed = 7, litWalks = 9, walkM = 30000, kinds = ['m', 'p', 'r'], alwaysKinds = [] } = {}) {
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

/** The name and, under it, MADEIRA in spaced capitals: a word every language reads the same. */
export function wordmark(x, y, size, ink, sub, anchor = 'middle') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Segoe UI Semibold, Segoe UI, Roboto, Arial, sans-serif" font-size="${size}" font-weight="600" letter-spacing="${size * 0.06}" fill="${ink}">Bruma</text>
    <text x="${anchor === 'middle' ? x : x + 4}" y="${y + size * 0.48}" text-anchor="${anchor}" ${font} font-size="${size * 0.22}" font-weight="600" letter-spacing="${size * 0.11}" fill="${sub}">MADEIRA</text>`;
}

/** The island by day, map style: soft shadow, shelf rings in the sea, lit roads in deep blue with a white casing. */
export function dayIsland(island, { pins = true } = {}) {
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

export const DAY_DEFS = `
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EAF4F8"/><stop offset="1" stop-color="#CFE4EE"/></linearGradient>
    <radialGradient id="seaLight" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.7"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
    <linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E9F0DC"/><stop offset="0.6" stop-color="#D6E5C6"/><stop offset="1" stop-color="#C7DBB6"/></linearGradient>
    <filter id="islandShadow" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="pinShadow" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="0" dy="0.25" stdDeviation="0.3" flood-color="#000000" flood-opacity="0.35"/></filter>`;

/** G2: the same island by day, to the right, the name on the left. */
export function optionG2(rings) {
  const island = islandPaths(rings, 100, 54);
  const s = 6.0;
  return `<defs>${DAY_DEFS}</defs>
    <rect width="${W}" height="${H}" fill="url(#sea)"/>
    <rect width="${W}" height="${H}" fill="url(#seaLight)"/>
    <g transform="translate(${672 - 54 * s} ${262 - 54 * s}) scale(${s})">${dayIsland(island)}</g>
    ${wordmark(64, 252, 72, '#1B2A33', '#4C6677', 'start')}`;
}

/** The banner as a whole SVG document, ready to rasterise: G2. */
export function featureGraphicSvg(rings) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${optionG2(rings)}</svg>`;
}
