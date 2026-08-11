/**
 * Draw the stamp artwork to a standalone page, so it can be looked at (T-070).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-stamps.mjs
 *     → tools/out/stamps.html
 *
 * WHY THIS EXISTS
 * ---------------
 * Artwork is the one thing that cannot be verified by a test, and this project
 * has no device (`docs/dev-build.md`). D-038 built a web workbench for exactly
 * this reason; this is the same idea reduced to a single file that can be
 * opened, sent, or looked at on a phone.
 *
 * ⚠ **It replays `stampElements` and composes nothing of its own.** A preview
 * that draws the stamp slightly differently from the app is worse than no
 * preview, because it is the thing that gets judged and believed. If a stamp
 * looks wrong here, it is wrong in the app.
 *
 * The names below are **invented** — `content/pois.json` is empty and curating
 * it is the project lead's (T-066). They exist to show the artwork at
 * realistic name lengths, including ones long enough to be truncated.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { CATEGORIES } from '../app/src/content/contentPack.ts';
import {
  CANVAS,
  designFor,
  stampElements,
  toPolygon,
} from '../app/src/passport/stampArt.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'out');

/**
 * Synthetic places. Not Madeira content — deliberately generic, and chosen for
 * *name length* rather than for meaning: short, medium, and long enough to hit
 * the truncation path.
 */
const SAMPLES = {
  viewpoint: ['High Rock', 'Eagle Point', 'Miradouro Grande', 'Cabo', 'North Ridge Lookout'],
  levada: ['Water Walk', 'Long Canal Trail', 'Levada Alta', 'The Green Way', 'Old Channel'],
  village: ['Machico', 'Santana', 'Porto da Cruz', 'Ribeira Brava', 'São Vicente'],
  beach: ['Black Sands', 'Praia Formosa', 'Calheta Bay', 'Seixal', 'Long Shore Beach'],
  landmark: ['The Cathedral', 'Old Fort', 'Market Hall', 'Cable Car Station', 'Sé'],
};

function attrs(element) {
  const out = [];
  for (const [key, value] of Object.entries(element)) {
    if (key === 'kind' || key === 'text' || key === 'clip' || value === undefined) continue;
    // camelCase → kebab-case: strokeWidth becomes stroke-width. Both SVG in a
    // browser and react-native-svg accept their own spelling; only this side
    // needs the conversion.
    out.push(`${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${value}"`);
  }
  return out.join(' ');
}

function renderStamp(id, name, category, collected) {
  const design = designFor(id, category);
  const elements = stampElements(design, name, collected);

  const body = elements
    .map((element) => {
      if (element.kind === 'text') {
        const { text, textLength, ...rest } = element;
        // `textLength` and `lengthAdjust` are camelCase in SVG itself, so they
        // bypass the kebab-case conversion below.
        const fit =
          textLength === null || textLength === undefined
            ? ''
            : ` textLength="${textLength}" lengthAdjust="spacingAndGlyphs"`;
        return `<text ${attrs(rest)}${fit} text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" letter-spacing="0.6">${escapeXml(text)}</text>`;
      }
      // Which elements clip is `stampArt.ts`'s decision, not this file's: the
      // band and the sunburst both need it, and guessing from the kind would
      // have let the sunburst paint over the borders.
      const clip = element.clip === true ? ` clip-path="url(#panel-${id})"` : '';
      return `<${element.kind} ${attrs(element)}${clip} />`;
    })
    .join('\n      ');

  // Taken from the design rather than by indexing the element list — the
  // list gained two layers when the artwork was made more detailed, and an
  // index would have silently clipped the band to the wrong outline.
  const panelPoints = toPolygon(design.panel);

  return `
  <figure class="stamp ${collected ? 'on' : 'off'}">
    <svg viewBox="0 0 ${CANVAS} ${CANVAS}" style="transform: rotate(${design.tiltDeg}deg)">
      <defs><clipPath id="panel-${id}"><polygon points="${panelPoints}" /></clipPath></defs>
      ${body}
    </svg>
    <figcaption>${escapeXml(name)}</figcaption>
  </figure>`;
}

function escapeXml(value) {
  return value.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

const sections = CATEGORIES.map((category) => {
  const names = SAMPLES[category];
  const collected = names
    .map((name, i) => renderStamp(`${category}-${i}`, name, category, true))
    .join('');
  const uncollected = renderStamp(`${category}-x`, names[0], category, false);

  return `
  <section>
    <h2>${category}</h2>
    <p class="note">The <b>emblem</b> carries the category (D-015) — silhouette and colour both vary per place. Last one in the row is <b>not yet collected</b>.</p>
    <div class="row">${collected}${uncollected}</div>
  </section>`;
}).join('');

// A page of mixed categories at passport density, which is the real test —
// the grid is where a design either holds together or turns to noise.
const mixed = CATEGORIES.flatMap((category) =>
  SAMPLES[category].map((name, i) => ({ category, name, i }))
)
  .map(({ category, name, i }, index) =>
    renderStamp(`mix-${category}-${i}`, name, category, index % 4 !== 3)
  )
  .join('');

const html = `<!doctype html>
<meta charset="utf-8">
<title>Stamp artwork — T-070</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 24px; background: #12191F; color: #E8EEF2;
         font: 15px/1.5 -apple-system, Segoe UI, Roboto, sans-serif; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px;
       color: #A7B8C4; margin: 28px 0 4px; }
  .note { color: #A7B8C4; font-size: 13px; margin: 0 0 12px; max-width: 62ch; }
  .row, .grid { display: flex; flex-wrap: wrap; gap: 16px; }
  .grid { gap: 14px; }
  .stamp { margin: 0; width: 104px; text-align: center; }
  .stamp svg { width: 104px; height: 104px; display: block; }
  .stamp figcaption { font-size: 11px; color: #A7B8C4; margin-top: 4px;
                      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stamp.off figcaption { color: #6C7C88; }
  .panel { background: #1B2A33; border-radius: 12px; padding: 16px; margin-top: 12px; }
  footer { margin-top: 36px; color: #A7B8C4; font-size: 13px; max-width: 70ch; }
  code { background: #1B2A33; padding: 1px 5px; border-radius: 4px; }
</style>

<h1>Passport stamp artwork (T-070)</h1>
<p class="note">
  Generated from <code>app/src/passport/stampArt.ts</code> — the same module the app draws
  from, replaying the same composition. If it looks wrong here it is wrong in the app.
  Names are invented; <code>content/pois.json</code> is empty and is yours (T-066).
</p>

${sections}

<h2>A passport page, at density</h2>
<p class="note">
  The real test: mixed categories at the size a 150–250 place passport forces, one in four
  not yet collected. Shapes should still separate at a glance.
</p>
<div class="panel"><div class="grid">${mixed}</div></div>

<footer>
  <p><b>What to judge:</b> is it colourful and detailed enough now; can you tell the five
  <i>emblems</i> apart at a glance (they are the only non-colour signal, so this is the
  accessibility question too); do the place names read; are the uncollected ones clearly
  dimmer but still legible (D-015 — they are the recommendations); does the density hold up.</p>
  <p><b>What this cannot tell you:</b> anything about a real screen. No device has run this.</p>
</footer>
`;

mkdirSync(outDir, { recursive: true });
const target = path.join(outDir, 'stamps.html');
writeFileSync(target, html, 'utf8');

const count = CATEGORIES.length * 6 + CATEGORIES.length * 5;
console.log(`tools/out/stamps.html: ${count} stamps across ${CATEGORIES.length} categories`);
