/**
 * The icon, drawn as options for the project lead (T-257).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-icon-options.mjs
 *     → tools/out/icon-options.html
 *
 * The launcher showed Expo's template icon (third review, C). Options were
 * drawn here at real sizes, in a launcher among neighbours, on a light and a
 * dark wallpaper, over four rounds; the lead chose A2. The page now shows the
 * chosen icon as it ships, and `build-icon.mjs` writes the app's files.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  iconSvg,
  monochromeSvg,
  optionFlag,
} from './lib/icon-art.mjs';
import { mainIslandRings, ROUTE } from './lib/icon-geometry.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const rings = mainIslandRings();

/** The icon the lead chose (A2, 2026-10-07), as it ships: `build-icon.mjs` draws the same. */
const OPTIONS = [
  ['A2', 'Estrada acesa na bandeira', optionFlag(rings, ROUTE), 'A escolhida: a ilha com a estrada acesa, sobre a bandeira da Madeira.'],
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
<h1>O ícone do Bruma</h1>
<p class="lead">O ícone escolhido, nos tamanhos reais e num ecrã de telemóvel entre outras apps (letras simples, para não imitar nenhuma app real).
"Android 13, tema" é a versão de uma só cor que o telemóvel usa quando os ícones seguem o papel de parede.
Depois de escolheres, faço a partir dela o ícone, as camadas do Android, o ecrã de abertura e o pequeno ícone das notificações.</p>
${OPTIONS.map(board).join('')}
</main></body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
const out = path.join(here, 'out', 'icon-options.html');
writeFileSync(out, page);
console.log(out);
