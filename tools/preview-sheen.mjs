/**
 * The band of light on the trophy's stamp, as the app draws it (T-236).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-sheen.mjs
 *     → tools/out/sheen.html
 *
 * The band is `stampSheen.ts`'s, through the same renderer as the stamps
 * (`lib/svg-render.mjs`): a few stamps of different colourways at trophy size,
 * on the trophy's dark stage.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampSvgWithDesign } from './lib/svg-render.mjs';
import { designFor } from '../app/src/passport/stampArt.ts';
import { SHEEN_PLACE } from '../app/src/passport/stampSheen.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(readFileSync(path.join(here, '..', 'content', 'pois.json'), 'utf8'));
const byId = new Map(pack.places.map((place) => [place.id, place]));

const STAMPS = ['pico-do-areeiro', 'cabo-girao', 'camara-de-lobos', 'praia-formosa', 'levada-do-furado'];

const stamp = (id) => {
  const place = byId.get(id);
  return stampSvgWithDesign(id, designFor(place.id, place.category, place.motif), place.name, true, '', null, null, SHEEN_PLACE);
};

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bruma: brilho</title><style>
body { margin: 0; font: 15px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; background: #111113; color: #F2F2F7; }
main { padding: 20px; max-width: 1100px; margin: 0 auto; }
h1 { font-size: 22px; margin: 0 0 8px; } .note { color: #AEAEB2; margin: 0 0 14px; }
.stage { display: flex; flex-wrap: wrap; gap: 18px; background: radial-gradient(circle at 50% 40%, #2A2310, #0F0E0C 70%); border-radius: 20px; padding: 18px; }
.stage svg { width: 180px; height: 180px; display: block; }
</style></head><body><main>
  <h1>O brilho do troféu (T-236)</h1>
  <p class="note">Uma faixa de luz branca, ténue e parada, recortada pelo contorno do carimbo.</p>
  <div class="stage">${STAMPS.map(stamp).join('')}</div>
</main></body></html>`;

const out = path.join(here, 'out');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'sheen.html'), html);
console.log('tools/out/sheen.html: the band on five stamps at trophy size');
