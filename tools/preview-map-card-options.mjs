/**
 * The map's place card and pin: options for the project lead (N12, 2026-10-23).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-map-card-options.mjs <map.png> <pinX> <pinY> [today.png]
 *     → tools/out/map-card-options-2.html (round 2; round 1, three full cards, is in git history)
 *
 * The 23 Oct review: the card *Ver no mapa* opens over the map is light grey
 * with Google's red pin, while the passport and the stamp card are Bruma's own
 * dark design, so it reads as two apps. Each option is drawn over a P30
 * screenshot of the map at Praia Formosa (1080 x 2340, shown at 1/3, so 1 px
 * here is 1 dp), taken after the card was closed, so Google's pin is gone; the
 * caller gives the pixel its tip stood on. The card sits where the app puts it,
 * its bottom 202 dp above the screen's (measured on the same P30 shot).
 *
 * The card's words come from `buildPlaceCard`, as in the app; the stamp is
 * `stampElements` (via svg-render.mjs). Colours are the app's own tokens. These
 * are sketches of a direction: the chosen one is built in `PlaceCardView` and
 * the map's marker, and checked on the P30.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeXml, stampSvgWithDesign } from './lib/svg-render.mjs';
import { designFor } from '../app/src/passport/stampArt.ts';
import { buildPlaceCard } from '../app/src/places/placeCard.ts';
import { album, reward } from '../app/src/ui/theme.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const [shot, pinX, pinY] = process.argv.slice(2);
if (!shot || !pinX || !pinY) {
  console.error('usage: preview-map-card-options.mjs <map.png> <pinX px> <pinY px>');
  process.exit(1);
}
const background = `data:image/png;base64,${readFileSync(shot).toString('base64')}`;
// Optional: the same view with today's card and pin, shown first for comparison.
const today = process.argv[5] ? `data:image/png;base64,${readFileSync(process.argv[5]).toString('base64')}` : background;
// The pin's tip, in dp.
const tip = { x: Number(pinX) / 3, y: Number(pinY) / 3 };

const pack = JSON.parse(readFileSync(path.join(here, '..', 'content', 'pois.json'), 'utf8'));
const place = (pack.places ?? pack).find((each) => each.id === 'praia-formosa');
const fence = place.geofences[0];
const card = buildPlaceCard({
  placeId: place.id,
  name: place.name,
  category: place.category,
  collected: true,
  regionName: 'Funchal',
  lat: fence.lat,
  lon: fence.lon,
  position: null,
  nowMs: Date.now(),
  language: 'pt',
  why: place.why,
  walk: place.walk,
});
const design = designFor(place.id, place.category, place.motif);
const stamp = (size) =>
  stampSvgWithDesign(place.id, design, place.name, true).replace('<svg ', `<svg width="${size}" height="${size}" `);

// --- The pins, each an SVG with its tip at (w/2, h). ------------------------
// Round 2 (2026-10-25): the lead kept these two of round 1's three.

/** A blue pin: a ring in the album's blue, a dark core. */
const bluePin = `
<svg width="34" height="44" viewBox="0 0 34 44">
  <path d="M17 43 C17 43 3 27 3 17 A14 14 0 0 1 31 17 C31 27 17 43 17 43 Z" fill="${album.surface}" stroke="${album.tint}" stroke-width="3"/>
  <circle cx="17" cy="17" r="5.5" fill="${album.tint}"/>
</svg>`;

/** A gold pin, the colour of a stamp earned. */
const goldPin = `
<svg width="34" height="44" viewBox="0 0 34 44">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${reward.gold}"/><stop offset="1" stop-color="${reward.goldDeep}"/>
  </linearGradient></defs>
  <path d="M17 43 C17 43 3 27 3 17 A14 14 0 0 1 31 17 C31 27 17 43 17 43 Z" fill="url(#g)" stroke="${reward.stage}" stroke-opacity="0.5" stroke-width="1.5"/>
  <circle cx="17" cy="17" r="5.5" fill="${reward.stage}"/>
</svg>`;

// --- The cards. ---------------------------------------------------------------
// Round 2: shorter. No grabber, no "Fechar" row (a drawn cross, its 60 dp
// target kept around it), the category and municipality on one line, and the
// reason to go replaced by a curiosity.

/**
 * ⚠ A sketch's sentence, not content: the pack has no curiosity field yet, and
 * this one is from memory (the 1566 French corsair raid on Funchal landed at
 * Praia Formosa). It must be checked before anything ships, and the 81 lines
 * would be drafted and vetoed like the rest of the pack (D-064).
 */
const CURIOSITY =
  'Em outubro de 1566, corsários franceses desembarcaram nesta praia antes de atacarem o Funchal.';

const cross = (color) => `
<div class="x"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 2 L12 12 M12 2 L2 12" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/></svg></div>`;

const head = (ink, size) => `
  <div class="row">
    <div class="st">${stamp(size)}</div>
    <div class="heading">
      <div class="meta" style="color:${ink.label}">${escapeXml(card.categoryLabel)}${card.regionLabel ? ` · ${escapeXml(card.regionLabel)}` : ''}</div>
      <div class="name" style="color:${ink.text}">${escapeXml(card.name)}</div>
      <div class="small" style="color:${ink.muted}">${escapeXml(card.statusLine)}</div>
    </div>
    ${cross(ink.muted)}
  </div>`;

const fact = (ink) => `
  <div class="fact" style="background:${ink.factFill}">
    <div class="factLabel" style="color:${ink.label}">Sabias que…</div>
    <div class="factText" style="color:${ink.text}">${escapeXml(CURIOSITY)}</div>
  </div>`;

const albumInk = { text: album.text, muted: album.textMuted, label: album.tint, factFill: '#FFFFFF0D' };
const rewardInk = { text: reward.text, muted: reward.textMuted, label: reward.goldInk, factFill: '#FFFFFF0F' };

/** 1: the passport's dark sheet, its blue. */
const card1 = `<div class="card" style="background:${album.surface}">${head(albumInk, 56)}${fact(albumInk)}</div>`;

/** 2: the trophy's violet to black, its gold. */
const card2 = `<div class="card" style="background:linear-gradient(${reward.panelTop}, ${reward.panelBottom});border:1px solid ${reward.panelEdge}">${head(rewardInk, 56)}${fact(rewardInk)}</div>`;

/** 3: the smallest: one dark row; the curiosity rides on the pin. */
const card3 = `<div class="card slim" style="background:${album.surface}">${head(rewardInk, 44)}</div>`;
const bubble = `
<div class="bubble" style="left:${tip.x - 100}px;top:${tip.y - 44 - 118}px;background:${album.surface}">
  <div class="factLabel" style="color:${reward.goldInk}">Sabias que…</div>
  <div class="factText" style="color:${album.text}">${escapeXml(CURIOSITY)}</div>
  <div class="tail" style="border-top-color:${album.surface}"></div>
</div>`;

// --- The page. ------------------------------------------------------------------

const phone = (label, title, note, pin, sheet, extra = '') => `
<figure>
  <div class="phone">
    <div class="base" style="background-image:url(${today})"></div>
    <div class="pin" style="left:${tip.x - 17}px;top:${tip.y - 44}px">${pin}</div>
    ${extra}
    <div class="sheet">${sheet}</div>
  </div>
  <figcaption><b>${label}. ${title}</b><br>${note}</figcaption>
</figure>`;

const html = `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><title>Cartão do mapa: opções 2</title>
<style>
  body { margin: 0; padding: 24px; background: #111; color: #eee; font: 14px/1.4 system-ui, sans-serif; }
  h1 { font-size: 18px; margin: 0 0 4px; } p.lead { margin: 0 0 20px; color: #aaa; max-width: 1100px; }
  .row-of { display: flex; gap: 28px; flex-wrap: wrap; }
  figure { margin: 0; width: 360px; }
  figcaption { margin-top: 10px; color: #ccc; }
  .phone { position: relative; width: 360px; height: 780px; overflow: hidden; border-radius: 28px;
           background: url(${background}) 0 0 / 360px 780px no-repeat; }
  .pin { position: absolute; }
  /* Below the card, the controls as they stand while a card is open (today's shot). */
  .base { position: absolute; left: 0; right: 0; bottom: 0; height: 202px;
          background-size: 360px 780px; background-position: 0 100%; }
  .sheet { position: absolute; left: 16px; right: 16px; bottom: 210px; }
  .card { border-radius: 20px; padding: 12px 6px 12px 12px; display: flex; flex-direction: column; gap: 10px;
          box-shadow: 0 8px 24px #000a; }
  .card.slim { padding: 8px 6px 8px 10px; }
  .row { display: flex; align-items: center; gap: 12px; }
  .st { flex: none; display: flex; }
  .heading { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
  .meta { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .name { font-size: 20px; font-weight: 800; line-height: 1.2; }
  .small { font-size: 14px; }
  .x { flex: none; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; align-self: flex-start; }
  .fact { border-radius: 12px; padding: 8px 12px 10px; margin-right: 6px; }
  .factLabel { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
  .factText { font-size: 15px; line-height: 1.35; }
  .bubble { position: absolute; width: 260px; box-sizing: border-box; border-radius: 14px; padding: 8px 12px 10px;
            box-shadow: 0 6px 18px #0008; }
  .tail { position: absolute; left: 92px; bottom: -9px; width: 0; height: 0;
          border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid; }
</style></head><body>
<h1>O cartão que abre no mapa, segunda ronda (N12)</h1>
<p class="lead">Mais baixos, e com um <i>Sabias que…</i> sobre o lugar. Sem a pega e sem a linha <i>Fechar</i>: uma cruz no canto
fecha (com a mesma área de toque de 60 dp). A categoria e o concelho numa só linha. O texto da curiosidade é um exemplo, ainda por
confirmar. À esquerda, o cartão de hoje para comparar.</p>
<div class="row-of">
<figure><div class="phone" style="background-image:url(${today})"></div><figcaption><b>Hoje</b><br>O cartão claro e o pino do Google, como estão na app.</figcaption></figure>
${phone('1', 'Escuro, pino azul', 'O cartão do passaporte, mais baixo. A curiosidade numa caixa por baixo do nome.', bluePin, card1)}
${phone('2', 'Violeta e dourado, pino amarelo', 'As cores do troféu, com a mesma forma do 1.', goldPin, card2)}
${phone('3', 'Uma linha só, a curiosidade no pino', 'O cartão fica numa linha. O <i>Sabias que…</i> aparece num balão por cima do pino amarelo.', goldPin, card3, bubble)}
</div>
</body></html>`;

const out = path.join(here, 'out', 'map-card-options-2.html');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(out);
