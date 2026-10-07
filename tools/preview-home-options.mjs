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
import { colors } from '../app/src/ui/theme.ts';

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


// Round two (2026-10-07). The lead: A's status line adds nothing relevant, B's
// ring and "3/80" badge are too much, C not liked; "the way it is now, or a
// more discreet version of B". So: as it is, and B at its quietest, a small
// muted count under the passport button with no ring and no badge.
// At the button's top right, clear of Centrar and of the status line; under
// it, the count touched the status line. (The gold count of locked stamps,
// D-097 R2, takes the same corner when there are any: one or the other.)
const QUIET_B = `<div class="quietCount" style="left:${351 / 3 - 40}px;top:${1623 / 3 - 4}px">${COLLECTED}/${TOTAL}</div>`;

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
.quietCount { position:absolute; width:60px; text-align:center; font-size:12px; font-weight:600; color:#3C3C43; text-shadow:0 0 3px #fff, 0 0 3px #fff; }
</style></head><body><main>
<h1>O ecrã principal: quantos dos 80 já tens, segunda ronda</h1>
<p class="lead">O mapa é uma captura do teu P30 de hoje, com os teus números reais (3 de 80). 
Hoje o ecrã principal não diz nada dos 80 lugares; a WalkNYC mostra "0 / 86,638 blocks · 0.0%" com uma barra, por cima do Start Walk.
As estradas acesas continuam a ser o mais forte do mapa.</p>
<div class="boards">
${board('', 'Como está agora', '', 'O ecrã principal de hoje, sem nada sobre os 80.')}
${board('', 'B, discreto', QUIET_B, 'Só um número pequeno e cinzento no canto do botão do passaporte: sem anel e sem fundo de cor.')}
</div></main></body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
const out = path.join(here, 'out', 'home-options.html');
writeFileSync(out, page);
console.log(out);
