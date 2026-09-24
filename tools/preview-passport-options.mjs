/**
 * T-203: passport design options, side by side, for the project lead to judge.
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-passport-options.mjs
 *     → tools/out/passport-options.html
 *
 * The review (2026-09-22) found two things on the passport:
 *   P2-5  uncollected stamps are all the same grey, hard to tell apart;
 *   P2-6  dark stamp panels on a light page read as two design languages.
 *
 * Every stamp here comes from `stampElements` (via svg-render.mjs), as in the
 * app. The only thing an option changes is a colour: the page, the panel, or
 * the seven greys of the uncollected palette. Each option prints its measured
 * contrasts, because a design that looks right and measures wrong has shipped
 * here before (stampArt.ts, UNCOLLECTED).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeXml, stampSvgWithDesign } from './lib/svg-render.mjs';
import { designFor, UNCOLLECTED } from '../app/src/passport/stampArt.ts';
import { contrastRatio } from '../app/src/ui/contrast.ts';
import { colors } from '../app/src/ui/theme.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(readFileSync(path.join(here, '..', 'content', 'pois.json'), 'utf8'));

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));

/**
 * The uncollected greys, tinted towards this place's own colourway by `t`.
 * ⚠ The **border stays grey**: it carries the sticker's shape against the
 * panel (stampArt.ts, UNCOLLECTED), and tinting it measured 2.30:1. So do the
 * name's ink and the band behind it, which carry the one thing to read, and
 * the emblem's ink: the collected colourways put dark ink on pale paper, the
 * reverse of these greys, and tinting it measured 1.27:1.
 */
const KEEP_GREY = new Set(['border', 'bandInk', 'band', 'ink']);
function tintedUncollected(colourway, t) {
  const out = {};
  for (const key of Object.keys(UNCOLLECTED)) {
    out[key] = KEEP_GREY.has(key) ? UNCOLLECTED[key] : hueOnly(UNCOLLECTED[key], colourway.accent, t);
  }
  return out;
}

/**
 * The grey's own lightness, with the place's hue at saturation `sat`. Keeping
 * the lightness is what keeps the contrasts where option A has them; mixing
 * towards the pale collected paper dropped the emblem to 2.72:1.
 */
function hueOnly(grey, source, sat) {
  const [r, g, b] = hex(source).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = hex(grey).reduce((a, v) => a + v, 0) / 3 / 255;
  const c = (1 - Math.abs(2 * l - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([r1 + m, g1 + m, b1 + m].map((v) => v * 255));
}

/** Render an uncollected stamp, swapping the seven greys for `palette`. */
function uncollectedSvg(place, palette) {
  let svg = stampSvgWithDesign(place.id, designFor(place.id, place.category, place.motif), place.name, false);
  if (palette !== null) {
    for (const key of Object.keys(UNCOLLECTED)) {
      svg = svg.split(UNCOLLECTED[key]).join(palette[key]);
    }
  }
  return svg;
}

const collectedSvg = (place) =>
  stampSvgWithDesign(place.id, designFor(place.id, place.category, place.motif), place.name, true);

const OPTIONS = [
  { id: 'A', title: 'A — today', page: colors.background, panel: colors.stampPage, tint: 0,
    note: 'Light page, dark album panels, every uncollected stamp the same grey.' },
  { id: 'B', title: 'B — each unvisited stamp keeps a hint of its own colour', page: colors.background, panel: colors.stampPage, tint: 0.35,
    note: 'Same layout. The greys take on the place’s own hue at 35% saturation, at the same lightness, so a row of unvisited stamps is no longer one colour. Shape, emblem and fainter ink still say “not yet”.' },
  { id: 'C', title: 'C — one dark album, page and panels together', page: colors.stampPage, panel: colors.stampPage, tint: 0,
    note: 'The whole passport screen is the dark album the stamps were drawn for; the rest of the app stays light. Answers P2-6 by making it one surface.' },
  { id: 'D', title: 'D — B and C together', page: colors.stampPage, panel: colors.stampPage, tint: 0.35,
    note: 'One dark album, and unvisited stamps that keep a hint of their colour.' },
];

const byCategory = {};
for (const place of pack.places) (byCategory[place.category] ??= []).push(place);

function measure(option) {
  const worst = { border: Infinity, band: Infinity, ink: Infinity };
  for (const place of pack.places) {
    const colourway = designFor(place.id, place.category, place.motif).colourway;
    const palette = option.tint === 0 ? UNCOLLECTED : tintedUncollected(colourway, option.tint);
    worst.border = Math.min(worst.border, contrastRatio(palette.border, option.panel));
    worst.band = Math.min(worst.band, contrastRatio(palette.bandInk, palette.band));
    worst.ink = Math.min(worst.ink, contrastRatio(palette.ink, palette.paper));
  }
  return worst;
}

function row(option, category) {
  const places = byCategory[category].slice(0, 7);
  const cells = places.map((place, i) => {
    const colourway = designFor(place.id, place.category, place.motif).colourway;
    const svg = i < 2
      ? collectedSvg(place)
      : uncollectedSvg(place, option.tint === 0 ? null : tintedUncollected(colourway, option.tint));
    return `<div class="cell">${svg}</div>`;
  }).join('');
  const edge = option.panel === option.page ? 'border:1px solid #3A3A3C;' : '';
  return `<div class="panel" style="background:${option.panel};${edge}"><div class="rowlabel" style="color:${option.page === colors.background ? colors.text : '#E5E5EA'}">${escapeXml(category)} · 2 of ${byCategory[category].length}</div><div class="row">${cells}</div></div>`;
}

const sections = OPTIONS.map((option) => {
  const worst = measure(option);
  const ok = (v, floor) => `${v.toFixed(2)}:1 ${v >= floor ? '✓' : '✗ under ' + floor + ':1'}`;
  return `<section style="background:${option.page}">
  <h2 style="color:${option.page === colors.background ? colors.text : '#F2F2F7'}">${escapeXml(option.title)}</h2>
  <p class="note" style="color:${option.page === colors.background ? colors.textMuted : '#AEAEB2'}">${escapeXml(option.note)}<br>
  Worst unvisited-stamp edge against its panel: <b>${ok(worst.border, 3)}</b> · name on its band: <b>${ok(worst.band, 4.5)}</b> · emblem on its paper: <b>${ok(worst.ink, 3)}</b> (all 80 places measured)</p>
  ${['viewpoint', 'levada', 'village'].map((c) => row(option, c)).join('')}
</section>`;
}).join('\n');

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Passport options</title>
<style>
  body { margin: 0; font: 15px/1.4 -apple-system, Segoe UI, Roboto, sans-serif; background: #F2F2F7; }
  header { padding: 16px; max-width: 760px; }
  section { padding: 16px; margin: 0 0 4px; }
  h2 { margin: 0 0 4px; font-size: 18px; }
  .note { margin: 0 0 12px; max-width: 720px; }
  .panel { border-radius: 12px; padding: 10px 12px; margin: 8px 0; max-width: 760px; }
  .rowlabel { font-weight: 700; font-size: 13px; margin-bottom: 6px; text-transform: capitalize; }
  .row { display: flex; gap: 6px; overflow-x: auto; }
  .cell { flex: 0 0 auto; width: 92px; height: 92px; }
  .cell svg { width: 100%; height: 100%; }
</style></head><body>
<header><h1 style="margin:0 0 6px;font-size:20px">Passport: four options (T-203)</h1>
<p style="margin:0;color:#5C5C63">Real places and the real stamp drawing. In each row the first two stamps are collected, the rest are not. Pick one (or say what to change). The other screens of the app stay as they are.</p></header>
${sections}
</body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
writeFileSync(path.join(here, 'out', 'passport-options.html'), html);
for (const option of OPTIONS) {
  const w = measure(option);
  console.log(`${option.id}: edge ${w.border.toFixed(2)}:1, band ${w.band.toFixed(2)}:1, emblem ${w.ink.toFixed(2)}:1`);
}
console.log('tools/out/passport-options.html');
