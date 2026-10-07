/**
 * The Play feature graphic (1024 × 500), drawn as options for the project lead
 * (T-269).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-feature-graphic.mjs
 *     → tools/out/feature-graphic/{a,b,c}.png and index.html
 *
 * Built from the icon's own art (`lib/icon-art.mjs`, A2) so the listing and the
 * launcher match. Nothing here is a person's trace (D-016): the island is the
 * regions' outline, the lit road the icon's stylised route, and option C's
 * faint roads are the shipped OpenStreetMap network, which is public map data.
 *
 * Google shows the graphic at many sizes and may crop it, so the subject sits in
 * the middle and any text stays large and short.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { islandPaths, MADEIRA, orderOfChristCross, PALETTE } from './lib/icon-art.mjs';
import { mainIslandRings, ROUTE } from './lib/icon-geometry.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const W = 1024;
const H = 500;

const rings = mainIslandRings();

/** The island `width` units wide in the 108 canvas, placed by `transform`, with its lit road. */
function islandWithRoad(width, transform, { edge = null } = {}) {
  const island = islandPaths(rings, width, 54);
  const road = curve(ROUTE.map(([lon, lat]) => island.project(lon, lat)));
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

const font = `font-family="Segoe UI, Roboto, Arial, sans-serif"`;

/** A: the lit island on slate, the name and the Portuguese title beside it. */
function optionA() {
  const { svg } = islandWithRoad(100, 'translate(40 -20) scale(5.4)');
  return `<rect width="${W}" height="${H}" fill="${PALETTE.slate}"/>
    ${svg}
    <text x="640" y="232" ${font} font-size="96" font-weight="700" fill="#FFFFFF">Bruma</text>
    <text x="644" y="292" ${font} font-size="34" fill="#C9D6DE">Madeira por onde passei</text>`;
}

/** B: the flag, as in the icon: blue, gold, blue, the cross, the island and its road. No text. */
function optionB() {
  const { svg } = islandWithRoad(100, 'translate(242 10) scale(5.2)', { edge: '#FFFFFF' });
  const third = W / 3;
  return `<rect width="${W}" height="${H}" fill="${MADEIRA.flagBlue}"/>
    <rect x="${third}" width="${third}" height="${H}" fill="${MADEIRA.flagGold}"/>
    <g transform="translate(512 70) scale(3.2) translate(-54 -38)">${orderOfChristCross(54, 38, 18)}</g>
    ${svg}`;
}

/** C: the island's real road network, faint, with the road lit across it, and the name. */
async function optionC() {
  const imp = (p) => import(pathToFileURL(path.join(root, p)).href);
  const { decodeRoadGraph } = await imp('app/src/matching/roadGraph.ts');
  const graph = decodeRoadGraph(JSON.parse(readFileSync(path.join(root, 'content', 'roads.json'), 'utf8')));
  // Centred: the island's middle (54, 54 in the canvas) at the banner's middle, a little high.
  const place = 'translate(210 -72) scale(5.6)';
  const { island, svg } = islandWithRoad(100, place);
  // Every road on the main island, as one path, in the island's projection.
  let roads = '';
  for (let e = 0; e < graph.edgeCount; e += 1) {
    const from = graph.pointStart[e];
    const to = graph.pointStart[e + 1];
    if (graph.lat[from] < 32.6) continue; // the Desertas and Porto Santo are not drawn
    const points = [];
    for (let i = from; i < to; i += 1) points.push(island.project(graph.lon[i], graph.lat[i]));
    roads += `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}`;
  }
  return `<rect width="${W}" height="${H}" fill="#121C22"/>
    <g transform="${place}">
      <path d="${island.d}" fill="#1E3A2E" stroke="#1E3A2E" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="${roads}" fill="none" stroke="#7FA0B0" stroke-opacity="0.28" stroke-width="0.12"/>
    </g>
    ${svg.replace(/<path d="[^"]*" fill="#2F6B4F"[^>]*\/>/, '')}
    <text x="${W - 48}" y="${H - 44}" text-anchor="end" ${font} font-size="64" font-weight="700" fill="#FFFFFF">Bruma</text>`;
}

const options = [
  ['a', 'A, the lit road on slate, with the name', 'Like the app’s dark map: the island in the icon’s green, its road lit, “Bruma” and the Portuguese title beside it. The text would be redrawn per language.', optionA()],
  ['b', 'B, the flag, no text', 'The icon at banner size: the flag’s bands and cross, the island and its lit road. Nothing to translate, and it reads at any size.', optionB()],
  ['c', 'C, the real road network', 'Every road on the island, faint, from the map data the app ships, and one road lit across it: what Bruma does, in one picture.', await optionC()],
];

const out = path.join(here, 'out', 'feature-graphic');
mkdirSync(out, { recursive: true });
for (const [id, , , body] of options) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: true } }).render().asPng();
  writeFileSync(path.join(out, `${id}.png`), png);
}
writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Feature graphic options</title>
<style>body{margin:0;padding:24px;background:#111;color:#eee;font-family:system-ui,sans-serif}
figure{margin:0 0 28px}img{width:100%;max-width:1024px;display:block;border-radius:8px}
figcaption{margin-top:8px;max-width:1024px;line-height:1.4}b{display:block;color:#fff}</style>
<h2>T-269: the Play feature graphic, three ways (1024 × 500)</h2>
${options.map(([id, name, note]) => `<figure><img src="${id}.png" alt=""><figcaption><b>${name}</b>${note}</figcaption></figure>`).join('')}`
);
console.log('tools/out/feature-graphic/index.html');
