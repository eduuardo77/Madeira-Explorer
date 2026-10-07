/**
 * Write the app's icon files from the chosen design (T-257, A2, 2026-10-07).
 *
 *     cd tools && npm install            (once: the rasteriser, tools only)
 *     node tools/build-icon.mjs
 *     → app/assets/icon.png, android-icon-{foreground,background,monochrome}.png,
 *       notification-icon.png
 *
 * Then `npx expo prebuild --platform android` in `app/` turns them into the
 * launcher's mipmaps and the notification drawable.
 *
 * The art is `lib/icon-art.mjs`, the same module the options page drew, so the
 * icon that ships is the one the lead picked. Every layer is drawn on Android's
 * adaptive canvas (108 units, the middle 72 shown by the launcher's mask).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { CANVAS, islandPaths, optionFlag } from './lib/icon-art.mjs';
import { mainIslandRings, ROUTE } from './lib/icon-geometry.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(here, '..', 'app', 'assets');

const rings = mainIslandRings();
const icon = optionFlag(rings, ROUTE);

/** An SVG of `body` over the given view box, rendered to a square PNG of `size` pixels. */
function png(body, viewBox, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

const FULL = `0 0 ${CANVAS} ${CANVAS}`;
/** What the launcher shows: the middle 72 of the 108 canvas. */
const SHOWN = '18 18 72 72';

/**
 * The notification's small icon: Android draws it as a white silhouette and
 * ignores every colour, so it is the island alone, filled white, as wide as
 * the canvas allows. A coloured icon there shows as a white square.
 */
const notification = (() => {
  const island = islandPaths(rings, 100, CANVAS / 2);
  return `<path d="${island.d}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="3.2" stroke-linejoin="round"/>`;
})();

const files = {
  // Play Store and older launchers: the full square, edge to edge.
  'icon.png': png(`${icon.background}${icon.foreground}`, SHOWN, 1024),
  // Android 8+ adaptive layers, each on the whole 108 canvas.
  'android-icon-background.png': png(icon.background, FULL, 1024),
  'android-icon-foreground.png': png(icon.foreground, FULL, 1024),
  // Android 13+ themed icons: one colour, tinted by the system.
  'android-icon-monochrome.png': png(`<g fill="#FFFFFF">${icon.monochrome}</g>`, FULL, 1024),
  'notification-icon.png': png(notification, FULL, 96),
};

mkdirSync(assets, { recursive: true });
for (const [name, data] of Object.entries(files)) {
  writeFileSync(path.join(assets, name), data);
  console.log(`app/assets/${name}  ${data.length} bytes`);
}
