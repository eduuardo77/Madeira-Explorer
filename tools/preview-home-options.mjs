/**
 * The home showing where you stand among the places, drawn as options for the
 * project lead (T-260, review N1, D-090).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-home-options.mjs <capture.png>
 *     → tools/out/home-options.html
 *
 * The third review: the home shows the lit roads and the recorder's status,
 * but nothing of the 80 places; the only hint is the passport button. WalkNYC
 * answers the same question with "0 / 86,638 blocks · 0.0%" and a bar above
 * its Start Walk button. Three ways for Bruma, drawn over a real capture of the
 * P30's home (passed in, never committed: it shows where the lead has been).
 *
 * The lit roads stay the loudest thing on the map (the product, D-093): every
 * option sits in the controls already at the foot of the screen.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { colors, mapChrome } from '../app/src/ui/theme.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const capturePath = process.argv[2];
if (capturePath === undefined) {
  console.error('Usage: node tools/preview-home-options.mjs <capture.png>');
  process.exit(1);
}
const capture = `data:image/png;base64,${readFileSync(capturePath).toString('base64')}`;

/** The P30's real figures on 2026-10-07: 3 places of 80. */
const COLLECTED = 3;
const TOTAL = 80;
const PERCENT = Math.round((COLLECTED / TOTAL) * 100);

const chrome = mapChrome.light;
const GREEN = '#1E7B3C';

/** The capture is 1080 x 2340 at 360 wide: one CSS pixel is three. */
const box = (x1, y1, x2, y2) =>
  `left:${x1 / 3}px;top:${y1 / 3}px;width:${(x2 - x1) / 3}px;height:${(y2 - y1) / 3}px`;

/** Paint out the capture's own status line, so an option can be drawn in its place. */
const COVER_STATUS = `<div class="cover" style="${box(40, 1950, 1040, 2070)}"></div>`;

const statusLine = `<span class="dot"></span>A registar automaticamente`;

// A: WalkNYC's bar, inside the status panel.
const A = `${COVER_STATUS}
  <div class="panel" style="left:16px;right:16px;top:631px">
    <div class="row">${statusLine}</div>
    <div class="row between"><b>${COLLECTED} de ${TOTAL} lugares</b><span>${PERCENT}%</span></div>
    <div class="bar"><i style="width:${(COLLECTED / TOTAL) * 100}%"></i></div>
  </div>`;

// B: a ring on the passport button.
const ring = (() => {
  const r = 48;
  const c = 2 * Math.PI * r;
  const done = (COLLECTED / TOTAL) * c;
  return `<svg class="ring" style="${box(30, 1605, 369, 1944)}" viewBox="0 0 113 113">
      <circle cx="56.5" cy="56.5" r="${r}" fill="none" stroke="#FFFFFF" stroke-width="7"/>
      <circle cx="56.5" cy="56.5" r="${r}" fill="none" stroke="${GREEN}" stroke-width="7" stroke-linecap="round"
        stroke-dasharray="${done} ${c}" transform="rotate(-90 56.5 56.5)"/>
    </svg>
    <div class="ringLabel" style="left:${(48 + 351) / 6 - 30}px;top:${1944 / 3 - 20}px">${COLLECTED}/${TOTAL}</div>`;
})();
const B = ring;

// C: the next place, a quiet chip above the status line.
// Beside the passport button, above Centrar: clear of both.
const C = `<div class="chip" style="left:${351 / 3 + 10}px;top:${1782 / 3 - 44}px">
    <span class="pin"></span><span><b>Próximo:</b> Cabo Girão · a 7 km</span>
  </div>`;

function phone(overlay) {
  return `<div class="phone"><div class="map" style="background-image:url(${capture})"></div>${overlay}</div>`;
}

function board(letter, title, overlay, notes) {
  return `<figure><div class="letter">${letter}</div>${phone(overlay)}<figcaption><b>${title}</b>${notes}</figcaption></figure>`;
}

const page = `<!doctype html>
<html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bruma: o ecrã principal</title>
<style>
:root { --bg:${colors.background}; --fg:#1C1C1E; --muted:#5C5C63; }
body { margin:0; padding:24px 16px; background:var(--bg); color:var(--fg); font:15px/1.45 system-ui, sans-serif; }
main { max-width:1200px; margin:0 auto; }
h1 { font-size:24px; margin:0 0 4px; } .lead { color:var(--muted); max-width:760px; }
.boards { display:flex; flex-wrap:wrap; gap:28px; margin-top:24px; }
figure { margin:0; width:360px; } .letter { font-weight:700; font-size:20px; margin-bottom:8px; }
figcaption { color:var(--muted); margin-top:10px; font-size:14px; } figcaption b { display:block; color:var(--fg); font-size:16px; margin-bottom:4px; }
.phone { position:relative; width:360px; height:780px; border-radius:28px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.15); }
.map { position:absolute; inset:0; background-size:360px auto; background-repeat:no-repeat; }
.cover { position:absolute; background:#90daee; }
.panel { position:absolute; background:${colors.background}; border-radius:14px; padding:8px 14px 10px; box-shadow:0 1px 3px rgba(0,0,0,.2); }
.row { display:flex; align-items:center; gap:8px; font-size:15px; color:${chrome.content}; }
.row.between { justify-content:space-between; margin-top:4px; font-size:14px; } .row.between span { color:var(--muted); }
.dot { width:9px; height:9px; border-radius:5px; background:${GREEN}; display:inline-block; }
.bar { height:6px; border-radius:3px; background:#D8D8DE; margin-top:6px; overflow:hidden; } .bar i { display:block; height:100%; background:${GREEN}; }
.ring { position:absolute; }
.ringLabel { position:absolute; width:60px; text-align:center; font-weight:700; font-size:13px; color:#fff; background:${GREEN}; border-radius:10px; padding:1px 0; }
.chip { position:absolute; white-space:nowrap; display:flex; align-items:center; gap:8px; background:${chrome.surface}; color:${chrome.content}; border-radius:18px; padding:7px 14px; font-size:14px; box-shadow:0 1px 3px rgba(0,0,0,.25); }
.pin { width:10px; height:10px; border-radius:5px; border:2px solid ${GREEN}; display:inline-block; }
</style></head><body><main>
<h1>O ecrã principal: quantos dos 80 já tens</h1>
<p class="lead">O mapa é uma captura do teu P30 de hoje, com os teus números reais (3 de 80).
Hoje o ecrã principal não diz nada dos 80 lugares; a WalkNYC mostra "0 / 86,638 blocks · 0.0%" com uma barra, por cima do Start Walk.
As estradas acesas continuam a ser o mais forte do mapa: as três opções vivem nos controlos que já existem em baixo.</p>
<div class="boards">
${board('A', 'A barra da WalkNYC', A, 'A linha de estado ganha uma segunda linha: "3 de 80 lugares", a percentagem e uma barra fina. É o que a WalkNYC faz, e fica sempre à vista.')}
${board('B', 'Um anel no botão do passaporte', B, 'O botão do passaporte ganha um anel que se vai fechando, e "3/80" por baixo. O mapa e a linha de estado ficam como estão.')}
${board('C', 'O próximo lugar', C, 'Um aviso discreto com o lugar por visitar mais perto e a distância. Mostra o próximo objetivo em vez do total. O lugar e a distância aqui são um exemplo.')}
</div></main></body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
const out = path.join(here, 'out', 'home-options.html');
writeFileSync(out, page);
console.log(out);
