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
// ⚠ The drawing itself moved to `lib/svg-render.mjs` when `preview-tour.mjs`
// needed the same stamps. One second renderer, shared — not a third copy.
import { escapeXml, stampSvg } from './lib/svg-render.mjs';
// Still needed here: the app's mark is drawn by this page's header, not by a
// stamp.
import { CANVAS } from '../app/src/passport/stampArt.ts';
import { stampMarkPath, TILT_DEG } from '../app/src/passport/stampMark.ts';
import { TIERS, TIER_METAL, TIER_THRESHOLDS } from '../app/src/passport/stampTier.ts';
// The real palette, not hexes retyped by eye. `theme.ts` has no imports of its
// own, so Node can load it directly — and a preview whose colours differ from
// the app's is exactly the thing this file's header warns against.
import { colors } from '../app/src/ui/theme.ts';

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

function renderStamp(id, name, category, collected) {
  return `
  <figure class="stamp ${collected ? 'on' : 'off'}">
    ${stampSvg(id, name, category, collected)}
    <figcaption>${escapeXml(name)}</figcaption>
  </figure>`;
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

/**
 * The passport *mark* (T-075) — the icon on the primary screen's passport
 * button, not a stamp for a place.
 *
 * Drawn at the sizes it is actually used, because the defect it replaced was
 * specifically a size failure: a `🛂` emoji that read as a blue rectangle on a
 * phone. A mark that only works at 104px would be the same mistake again.
 *
 * Shown twice: on this page's own dark ground, and — the one that matters — on
 * `colors.action` in `colors.actionText`, which is what the button actually
 * does. Judging a button icon anywhere but on its button would flatter it.
 */
const MARK_SIZES = [24, 34, 48, 96];

function markRow(ink) {
  return MARK_SIZES.map(
    (size) => `
  <figure class="stamp mark" style="width:${size}px">
    <svg viewBox="0 0 ${CANVAS} ${CANVAS}" style="width:${size}px;height:${size}px">
      <path d="${stampMarkPath()}" fill="${ink}" fill-rule="evenodd" transform="rotate(${TILT_DEG} ${CANVAS/2} ${CANVAS/2})" />
    </svg>
    <figcaption>${size} dp</figcaption>
  </figure>`
  ).join('');
}

/**
 * The passport button at each rank (T-158, D-078).
 *
 * ⚠ **This is the whole reason the ranks can be looked at at all.** The button
 * lives on the map screen, which needs a device; the ranks are a fill and a
 * mark, which do not. Drawn at the real 36 dp mark size inside the real pill.
 *
 * The question it exists to answer is the one no test can: **does bronze read
 * as bronze, or as brown?** And does platinum read as *colder* than silver
 * rather than just paler.
 */
function tierRow() {
  const label = { none: 'no stamps yet', bronze: `${TIER_THRESHOLDS.bronze}+`,
                  silver: `${TIER_THRESHOLDS.silver}+`, gold: `${TIER_THRESHOLDS.gold}+`,
                  platinum: 'all of them' };
  return TIERS.map((tier) => {
    const metal = TIER_METAL[tier];
    return `
  <figure class="tier">
    <div class="pill" style="background:${metal.fill}">
      <svg viewBox="0 0 ${CANVAS} ${CANVAS}" style="width:36px;height:36px">
        <path d="${stampMarkPath()}" fill="${colors.actionText}" fill-rule="evenodd" transform="rotate(${TILT_DEG} ${CANVAS/2} ${CANVAS/2})" />
      </svg>
      <span style="color:${colors.actionText}">23 / 60</span>
    </div>
    <figcaption>${tier} · ${label[tier]}</figcaption>
  </figure>`;
  }).join('');
}

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
  .tiers { display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start; }
  .tier { margin: 0; }
  .pill { display: inline-flex; align-items: center; gap: 8px; height: 56px;
          padding: 0 20px; border-radius: 999px; font: 600 17px/1 -apple-system, Segoe UI, Roboto, sans-serif; }
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

<h2>The passport mark (T-075)</h2>
<p class="note">
  The icon on the primary screen's passport button — the <i>idea</i> of a stamp, not a stamp
  for a place. Cut by the same <code>cutEdge</code> the real stamps use, so it cannot drift
  away from them. It replaced a <code>🛂</code> emoji that rendered as a blue rectangle at
  button size. <b>The button draws it at 34 dp</b>; the rest are here to show where it stops
  working.
</p>
<div class="row" style="align-items: flex-end">${markRow(colors.text)}</div>
<p class="note">And how it actually ships — <code>colors.actionText</code> on
<code>colors.action</code>, which is the passport button:</p>
<div class="panel" style="background:${colors.action}">
  <div class="row" style="align-items: flex-end">${markRow(colors.actionText)}</div>
</div>

<h2>The rank, on the button itself (T-158, D-078)</h2>
<p class="note">
  The passport button <b>is</b> a stamp, and since D-078 it is the stamp you have
  earned: the rank comes from <b>how many places you have collected</b>, never from
  which ones — ranking places is what killed the "stars" proposal that stamps
  replaced. Silver lands exactly where the free tier ends (D-072), so a visitor who
  never pays reaches it and can see gold above them.
  <br><br>
  ⚠ <b>The question no test can answer, and the reason this row exists:</b> does
  bronze read as <i>bronze</i> or as brown? Is platinum <i>colder</i> than silver
  rather than merely paler? Contrast is asserted in <code>stampTier.test.ts</code>;
  whether these look like metal is for a pair of eyes.
</p>
<div class="tiers">${tierRow()}</div>

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
