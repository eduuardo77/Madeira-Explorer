/**
 * Phone captures made fit for the Play listing (T-269).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/store-screenshots.mjs <captures dir> [<out dir>]
 *     → store/screenshots/<name>.png by default
 *
 * Play takes a phone screenshot only if its long side is at most twice its
 * short side, and only as JPEG or 24-bit PNG. A modern phone's capture is
 * taller than 2:1 (the emulator's 720 × 1560 is 2.17), so the status bar is
 * cut from the top, a sliver from the bottom, until the picture is exactly 2:1,
 * and the alpha channel goes (`lib/png-rgb.mjs`).
 *
 * ⚠ The captures must show nobody's real movements (D-016): the demo drive
 * (`make-demo-route.mjs`) on the emulator, never the P30's trace.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { rgbPng } from './lib/png-rgb.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [inDir, outArg] = process.argv.slice(2);
if (inDir === undefined) throw new Error('usage: store-screenshots.mjs <captures dir> [<out dir>]');
const outDir = outArg ?? path.join(here, '..', 'store', 'screenshots');

/** Of the height to remove, the share taken from the top: the status bar is the part worth losing. */
const FROM_TOP = 0.85;

mkdirSync(outDir, { recursive: true });
for (const name of readdirSync(inDir).filter((file) => file.endsWith('.png')).sort()) {
  const png = readFileSync(path.join(inDir, name));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const keep = Math.min(height, width * 2);
  const top = Math.round((height - keep) * FROM_TOP);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${keep}" viewBox="0 ${top} ${width} ${keep}"><image width="${width}" height="${height}" xlink:href="data:image/png;base64,${png.toString('base64')}"/></svg>`;
  const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render();
  writeFileSync(path.join(outDir, name), rgbPng(rendered, [255, 255, 255]));
  console.log(`${name}: ${width} × ${keep}, ${top} px off the top`);
}
