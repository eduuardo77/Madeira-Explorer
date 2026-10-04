/**
 * Collected versus not: options for the project lead to judge (2026-10-04).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-collected-options.mjs
 *     → tools/out/collected-options.html
 *
 * The lead, after their first stamps on a phone: the collected stamp has
 * "slightly more colour than the locked ones, but it's still not enough. It's
 * hard to differentiate both. And doesn't feel special."
 *
 * Every stamp is drawn by `stampElements` (via svg-render.mjs), as in the app,
 * on the passport's dark page. What an option changes is drawn around that:
 * how much of its own hue an unvisited stamp keeps, how bright it is, whether
 * it is a full sticker or only the place for one, and what a collected stamp
 * gains. These are sketches of a direction; the chosen one is then built in
 * `stampArt.ts` and measured by `contrast.test.ts` like everything else.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeXml, stampSvgWithDesign } from './lib/svg-render.mjs';
import { designFor, toPolygon, UNCOLLECTED, wrapLabel } from '../app/src/passport/stampArt.ts';
import { colors } from '../app/src/ui/theme.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(readFileSync(path.join(here, '..', 'content', 'pois.json'), 'utf8'));
const PAGE = colors.stampPage;

const designOf = (place) => designFor(place.id, place.category, place.motif);

/** The app's unvisited drawing (hue kept at UNCOLLECTED_HUE). */
const today = (place) => stampSvgWithDesign(place.id, designOf(place), place.name, false);

/** Unvisited with every hue taken out: the plain greys of `UNCOLLECTED`. */
function grey(place) {
  // Recolour the hue-tinted greys back to the neutral palette by drawing the
  // collected=false stamp and swapping each tinted colour for its grey.
  let svg = today(place);
  const tinted = svg.match(/#[0-9A-Fa-f]{6}/g) ?? [];
  const greys = Object.values(UNCOLLECTED);
  for (const colour of new Set(tinted)) {
    if (greys.includes(colour.toUpperCase())) continue;
    // Nearest grey by lightness.
    const l = lightness(colour);
    const nearest = greys.reduce((a, b) => (Math.abs(lightness(a) - l) < Math.abs(lightness(b) - l) ? a : b));
    svg = svg.split(colour).join(nearest);
  }
  return svg;
}

function lightness(hex) {
  return [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0) / 3;
}

/** Only the place for a stamp: its cut silhouette, dashed, and the name. */
function slot(place) {
  const design = designOf(place);
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(${design.tiltDeg}deg)">
    <polygon points="${toPolygon(design.cutOutline)}" fill="none" stroke="#6E6E73" stroke-width="1.6" stroke-dasharray="4 3" stroke-linejoin="round"/>
    ${wrapLabel(place.name.toUpperCase(), 13)
      .slice(0, 3)
      .map((line, i, all) => `<text x="50" y="${53 - (all.length - 1) * 4.5 + i * 9}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="7.5" fill="#8E8E93">${escapeXml(line)}</text>`)
      .join('')}
  </svg>`;
}

/** A collected stamp with a soft glow of its own colour behind it. */
function glow(place, svg) {
  const accent = designOf(place).colourway.accent;
  return `<div class="glow" style="--glow:${accent}">${svg}</div>`;
}

/** A collected stamp with a cancellation mark: a ring and the date, in ink. */
function postmark(place, svg) {
  const ink = designOf(place).colourway.accent;
  return `<div class="stack">${svg}<svg class="mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(-14 76 24)" opacity="0.85">
      <circle cx="76" cy="24" r="17" fill="none" stroke="${ink}" stroke-width="2.2"/>
      <circle cx="76" cy="24" r="13" fill="none" stroke="${ink}" stroke-width="0.9"/>
      <text x="76" y="22" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="7" fill="${ink}">4 OUT</text>
      <text x="76" y="30.5" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="5.2" fill="${ink}">2026</text>
    </g></svg></div>`;
}

const collected = (place) => stampSvgWithDesign(place.id, designOf(place), place.name, true);
const dim = (svg, opacity) => `<div style="opacity:${opacity}">${svg}</div>`;

const OPTIONS = [
  {
    id: 'A',
    title: 'A. Today',
    note: 'Unvisited stamps keep 35% of their own hue (T-203 option D). The difference is colour strength only.',
    collected: collected,
    unvisited: today,
  },
  {
    id: 'B',
    title: 'B. Unvisited back to plain grey, and dimmer',
    note: 'Every hue goes to the collected stamps. Unvisited ones are neutral grey at 60% strength: still readable as recommendations, clearly not yours.',
    collected: collected,
    unvisited: (place) => dim(grey(place), 0.6),
  },
  {
    id: 'C',
    title: 'C. Unvisited is only the place for a stamp',
    note: 'An empty, dashed outline with the name, like a blank square in a sticker album. A collected stamp is the only full sticker on the page.',
    collected: collected,
    unvisited: slot,
  },
  {
    id: 'D',
    title: 'D. Collected stamps are marked as yours',
    note: 'Unvisited as today. A collected stamp gets a soft glow of its own colour and a postmark with the day you earned it.',
    collected: (place) => glow(place, postmark(place, collected(place))),
    unvisited: today,
  },
  {
    id: 'E',
    title: 'E. B and D together',
    note: 'Grey, dimmer unvisited stamps; collected ones glow and carry the postmark. The strongest difference short of hiding the unvisited.',
    collected: (place) => glow(place, postmark(place, collected(place))),
    unvisited: (place) => dim(grey(place), 0.6),
  },
];

const byCategory = {};
for (const place of pack.places) (byCategory[place.category] ??= []).push(place);

function row(option, category) {
  const places = byCategory[category].slice(0, 6);
  const cells = places
    .map((place, i) => `<div class="cell">${i < 2 ? option.collected(place) : option.unvisited(place)}</div>`)
    .join('');
  return `<div class="rowlabel">${escapeXml(category)} · 2 of ${byCategory[category].length}</div><div class="row">${cells}</div>`;
}

const sections = OPTIONS.map(
  (option) => `<section>
  <h2>${escapeXml(option.title)}</h2>
  <p class="note">${escapeXml(option.note)}</p>
  ${['viewpoint', 'levada', 'beach'].map((c) => row(option, c)).join('')}
</section>`
).join('\n');

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Collected stamp options</title>
<style>
  body { margin: 0; font: 15px/1.4 -apple-system, Segoe UI, Roboto, sans-serif; background: ${PAGE}; color: #F2F2F7; }
  header { padding: 16px; max-width: 760px; }
  section { padding: 16px; border-top: 1px solid #3A3A3C; }
  h2 { margin: 0 0 4px; font-size: 18px; }
  .note { margin: 0 0 12px; max-width: 720px; color: #AEAEB2; }
  .rowlabel { font-weight: 700; font-size: 13px; margin: 10px 0 6px; text-transform: capitalize; color: #AEAEB2; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  .cell { width: 96px; height: 96px; }
  .cell svg, .cell > div, .cell .stack { width: 100%; height: 100%; }
  .stack { position: relative; }
  .stack > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .glow { filter: drop-shadow(0 0 7px var(--glow)); }
</style></head><body>
<header><h1 style="margin:0 0 6px;font-size:20px">Collected versus not: five options</h1>
<p style="margin:0;color:#AEAEB2">Real places, the real stamp drawing, on the passport's dark page. In each row the first two are collected and the rest are not. Pick one, or mix (for example C with D's postmark).</p></header>
${sections}
</body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
writeFileSync(path.join(here, 'out', 'collected-options.html'), html);
console.log('tools/out/collected-options.html');
