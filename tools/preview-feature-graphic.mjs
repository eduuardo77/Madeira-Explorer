/**
 * The Play feature graphic (1024 × 500), drawn as options for the project lead
 * (T-269).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-feature-graphic.mjs
 *     → tools/out/feature-graphic/{b,b1,b2,b3}.png and index.html
 *
 * Built from the icon's own art (`lib/icon-art.mjs`, A2) so the listing and the
 * launcher match. Nothing here is a person's trace (D-016): the island is the
 * regions' outline and the lit road the icon's stylised route.
 *
 * Round two (2026-10-07). Round one drew A (the lit island on slate with the
 * name), B (the flag, no text) and C (the island's road network); the lead
 * chose B, "however it's a bit loud". So B as drawn, beside three quieter
 * versions of it. A and C are in git history.
 *
 * Google shows the graphic at many sizes and may crop it, so the subject sits in
 * the middle.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { islandPaths, MADEIRA, optionFlag, orderOfChristCross, PALETTE } from './lib/icon-art.mjs';
import { mainIslandRings, ROUTE } from './lib/icon-geometry.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
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

/**
 * B: the flag across the whole banner, as in the icon: the bands, the cross,
 * the island and its road. `blue` and `gold` default to the flag's own.
 */
function flagBanner({ blue = MADEIRA.flagBlue, gold = MADEIRA.flagGold } = {}) {
  const { svg } = islandWithRoad(100, 'translate(242 10) scale(5.2)', { edge: '#FFFFFF' });
  const third = W / 3;
  return `<rect width="${W}" height="${H}" fill="${blue}"/>
    <rect x="${third}" width="${third}" height="${H}" fill="${gold}"/>
    <g transform="translate(512 70) scale(3.2) translate(-54 -38)">${orderOfChristCross(54, 38, 18)}</g>
    ${svg}`;
}

/** B2: the launcher icon itself, its circle of flag, centred on the app's dark slate. */
function iconOnSlate() {
  const icon = optionFlag(rings, ROUTE);
  // The icon's circle (r 36 at 54, 54 in its canvas) scaled to 190 px and centred.
  const scale = 190 / 36;
  const shift = (offset) => offset - 54 * scale;
  return `<rect width="${W}" height="${H}" fill="${PALETTE.slate}"/>
    <defs><clipPath id="circle"><circle cx="54" cy="54" r="36"/></clipPath></defs>
    <g transform="translate(${shift(W / 2)} ${shift(H / 2)}) scale(${scale})">
      <g clip-path="url(#circle)">${icon.background}${icon.foreground}</g>
    </g>`;
}

/** B3: the flag faded into slate: the same picture, the bands at a third of their strength. */
function fadedFlag() {
  const third = W / 3;
  const { svg } = islandWithRoad(100, 'translate(242 10) scale(5.2)', { edge: '#FFFFFF' });
  return `<rect width="${W}" height="${H}" fill="${PALETTE.slate}"/>
    <g opacity="0.35">
      <rect width="${W}" height="${H}" fill="${MADEIRA.flagBlue}"/>
      <rect x="${third}" width="${third}" height="${H}" fill="${MADEIRA.flagGold}"/>
    </g>
    <g transform="translate(512 70) scale(3.2) translate(-54 -38)">${orderOfChristCross(54, 38, 18)}</g>
    ${svg}`;
}

const options = [
  ['b', 'B, as drawn', 'The flag at full strength: what the lead chose, and found a bit loud.', flagBanner()],
  ['b1', 'B1, the flag, muted', 'The same picture in a deeper blue and an ochre gold: still the flag, less shout.', flagBanner({ blue: '#163E6B', gold: '#C49A2E' })],
  ['b2', 'B2, the icon on slate', 'The launcher icon itself, centred on the app’s dark slate: the flag only inside the circle, exactly what the phone shows.', iconOnSlate()],
  ['b3', 'B3, the flag faded into slate', 'The full picture, but the bands at a third of their strength over the dark: the island and its road lead, the flag stays as colour.', fadedFlag()],
];

const out = path.join(here, 'out', 'feature-graphic');
mkdirSync(out, { recursive: true });
/** Each option as a PNG, also kept for the page: it embeds them, so it opens on its own when sent. */
const pngs = new Map();
for (const [id, , , body] of options) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(path.join(out, `${id}.png`), png);
  pngs.set(id, `data:image/png;base64,${Buffer.from(png).toString('base64')}`);
}
writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Feature graphic options</title>
<style>body{margin:0;padding:24px;background:#111;color:#eee;font-family:system-ui,sans-serif}
figure{margin:0 0 28px}img{width:100%;max-width:1024px;display:block;border-radius:8px}
figcaption{margin-top:8px;max-width:1024px;line-height:1.4}b{display:block;color:#fff}</style>
<h2>T-269: the Play feature graphic, round two: B, quieter (1024 × 500)</h2>
${options.map(([id, name, note]) => `<figure><img src="${pngs.get(id)}" alt=""><figcaption><b>${name}</b>${note}</figcaption></figure>`).join('')}`
);
console.log('tools/out/feature-graphic/index.html');
