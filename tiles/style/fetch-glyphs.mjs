/**
 * Fetch the font glyphs the map styles need, for offline bundling (T-056).
 *
 *     node tiles/style/fetch-glyphs.mjs
 *
 * Writes PBF glyph ranges into app/assets/map/fonts/, which ARE committed —
 * they are shipped app assets, not build intermediates.
 *
 * WHY THIS EXISTS
 * ---------------
 * The generated styles reference three Noto Sans stacks. In the repo viewer
 * the glyphs come from Protomaps' hosted assets, but the app makes zero
 * network requests (D-001), so every glyph a label could need must ship in
 * the binary and be served from device storage.
 *
 * WHY ONLY RANGES 0–511
 * ---------------------
 * Glyphs are fetched by the renderer in blocks of 256 codepoints, on demand,
 * per fontstack. Madeira's place names are Portuguese: every accented letter
 * they use (ã, é, ç, ô…) lives in Latin-1 Supplement — range 0–255 — with a
 * safety margin for Latin Extended-A (ā, ł…) in 256–511. A label whose text
 * needed a range we did not bundle would simply not render, which is why the
 * validator-adjacent check here is conservative and bundles both.
 *
 * Source: protomaps/basemaps-assets (OFL-licensed Noto Sans builds — the same
 * files the viewer uses remotely).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const outRoot = path.resolve(here, '..', '..', 'app', 'assets', 'map', 'fonts');

const BASE = 'https://protomaps.github.io/basemaps-assets/fonts';

/** The stacks the generated styles reference (see generate.mjs / text-font). */
const STACKS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];
const RANGES = ['0-255', '256-511'];

for (const stack of STACKS) {
  const dir = path.join(outRoot, stack);
  mkdirSync(dir, { recursive: true });
  for (const range of RANGES) {
    const url = `${BASE}/${encodeURIComponent(stack)}/${range}.pbf`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${url}: HTTP ${response.status}`);
    }
    const data = Buffer.from(await response.arrayBuffer());
    writeFileSync(path.join(dir, `${range}.pbf`), data);
    console.log(`${stack}/${range}.pbf  ${(data.length / 1024).toFixed(0)} kB`);
  }
}

console.log(`\nWritten to ${outRoot}`);
