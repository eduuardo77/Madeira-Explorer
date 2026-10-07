/**
 * The icon, drawn as options for the project lead (T-257).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-icon-options.mjs
 *     → tools/out/icon-options.html
 *
 * The launcher still shows Expo's template icon (third review, C). The plan
 * asks for three options at real sizes, in a launcher among neighbours, on a
 * light and a dark wallpaper; the lead picks one and then it is built: launcher,
 * adaptive layers, monochrome, splash and the notification's small icon.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  iconSvg,
  monochromeSvg,
  optionFlag,
  optionLitRoad,
  optionStampHouse,
} from './lib/icon-art.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const regions = JSON.parse(readFileSync(path.join(here, '..', 'content', 'regions.json'), 'utf8'));

/**
 * The main island's outline: every municipality's rings, drawn alike so they
 * read as one shape, except the islets south-east of it. ⚠ Not "the largest
 * ring of each": Santa Cruz's largest ring is the Desertas, and that rule drew
 * the islets and dropped Santa Cruz's part of the island. The main island lies
 * north of 32.6° N; the Desertas lie south of it.
 */
const MAIN_ISLAND_SOUTH = 32.6;
const centroidLat = (ring) => ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
const rings = regions.features
  .filter((feature) => feature.properties.islandId === 'ilha-da-madeira')
  .flatMap((feature) =>
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates[0]]
      : feature.geometry.coordinates.map((polygon) => polygon[0])
  )
  .filter((ring) => centroidLat(ring) > MAIN_ISLAND_SOUTH);

/**
 * The lit road: the south coast, a little inland, west to east, Calheta to
 * Machico. Approximate on purpose; at icon size it is a gesture, not a route.
 */
const ROUTE = [
  [-17.17, 32.73],
  [-17.06, 32.69],
  [-16.98, 32.67],
  [-16.91, 32.66],
  [-16.84, 32.66],
  [-16.78, 32.72],
];

/**
 * Round three (2026-10-07). The lead liked A2 and B2 "but they still need a bit
 * of work". A2 gains the flag's cross and its green island back; B2 gains the
 * lit road to the house, a truer thatch and a stamp that clears the mask.
 */
const OPTIONS = [
  ['A2', 'Estrada acesa na bandeira', optionFlag(rings, ROUTE), 'A ilha verde com a estrada acesa, sobre as faixas da bandeira, com a cruz da Ordem de Cristo por cima.'],
  ['B2', 'Selo com casa de Santana', optionStampHouse(), 'O selo do passaporte com uma casa de Santana, a estrada acesa a chegar à porta, e a bandeira na faixa de baixo.'],
  ['A', 'Estrada acesa (para comparar)', optionLitRoad(rings, ROUTE), 'A primeira, sem os sinais da Madeira.'],
];

/** Neighbours: plain coloured tiles with a letter, so no real app is imitated. */
const NEIGHBOURS = [
  ['#E8E8EC', '#3B3B44', 'M'],
  ['#2E7D32', '#FFFFFF', 'C'],
  ['#F2B705', '#3B2A00', 'N'],
];

let n = 0;
const uid = () => `c${(n += 1)}`;

function launcher(option, wallpaper) {
  const tiles = NEIGHBOURS.map(
    ([bg, fg, letter]) =>
      `<div class="app"><div class="tile" style="background:${bg};color:${fg}">${letter}</div><span>App</span></div>`
  );
  tiles.splice(1, 0, `<div class="app">${iconSvg(option, 52, 'circle', uid())}<span>Bruma</span></div>`);
  return `<div class="launcher ${wallpaper}">${tiles.join('')}</div>`;
}

function board([letter, title, option, note]) {
  return `<section>
    <h2>${letter} · ${title}</h2>
    <p class="note">${note}</p>
    <div class="sizes">
      <figure>${iconSvg(option, 48, 'circle', uid())}<figcaption>48</figcaption></figure>
      <figure>${iconSvg(option, 72, 'circle', uid())}<figcaption>72</figcaption></figure>
      <figure>${iconSvg(option, 192, 'circle', uid())}<figcaption>192</figcaption></figure>
      <figure>${iconSvg(option, 192, 'squircle', uid())}<figcaption>192, outra forma</figcaption></figure>
      <figure>${monochromeSvg(option, 72, uid())}<figcaption>Android 13, tema</figcaption></figure>
    </div>
    ${launcher(option, 'light')}
    ${launcher(option, 'dark')}
    <details><summary>512, Play Store</summary>${iconSvg(option, 512, 'squircle', uid())}</details>
  </section>`;
}

const page = `<!doctype html>
<html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bruma: ícone</title>
<style>
:root { --bg:#F2F2F7; --fg:#1C1C1E; --muted:#5C5C63; --card:#FFFFFF; }
body { margin:0; padding:24px 16px; background:var(--bg); color:var(--fg); font:15px/1.45 system-ui, sans-serif; }
main { max-width:1100px; margin:0 auto; }
h1 { font-size:24px; margin:0 0 4px; } .lead { color:var(--muted); max-width:720px; }
section { background:var(--card); border-radius:16px; padding:16px; margin:20px 0; }
h2 { margin:0; font-size:20px; } .note { color:var(--muted); margin:4px 0 12px; }
.sizes { display:flex; flex-wrap:wrap; gap:20px; align-items:flex-end; }
figure { margin:0; text-align:center; } figcaption { color:var(--muted); font-size:12px; margin-top:4px; }
.launcher { display:flex; gap:22px; padding:18px 20px; border-radius:14px; margin-top:14px; max-width:420px; }
.launcher.light { background:linear-gradient(135deg,#D9E4EA,#F3E9DA); }
.launcher.dark { background:linear-gradient(135deg,#12161C,#2B2236); }
.launcher.dark span { color:#EEE; }
.app { display:flex; flex-direction:column; align-items:center; gap:6px; width:60px; }
.app span { font-size:12px; color:#222; }
.tile { width:52px; height:52px; border-radius:26px; display:grid; place-items:center; font-weight:700; font-size:20px; }
details { margin-top:12px; } summary { cursor:pointer; color:var(--muted); }
</style></head><body><main>
<h1>O ícone do Bruma, terceira ronda</h1>
<p class="lead">Três opções, nos tamanhos reais e num ecrã de telemóvel entre outras apps (letras simples, para não imitar nenhuma app real).
"Android 13, tema" é a versão de uma só cor que o telemóvel usa quando os ícones seguem o papel de parede.
Depois de escolheres, faço a partir dela o ícone, as camadas do Android, o ecrã de abertura e o pequeno ícone das notificações.</p>
${OPTIONS.map(board).join('')}
</main></body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
const out = path.join(here, 'out', 'icon-options.html');
writeFileSync(out, page);
console.log(out);
