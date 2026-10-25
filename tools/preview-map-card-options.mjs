/**
 * The map's place card and pin: options for the project lead (N12, 2026-10-23).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-map-card-options.mjs <map.png> <pinX> <pinY> [today.png]
 *     → tools/out/map-card-options.html
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

/** A: a ring in the album's blue, a dark core: a place, not a search result. */
const ringPin = `
<svg width="34" height="44" viewBox="0 0 34 44">
  <path d="M17 43 C17 43 3 27 3 17 A14 14 0 0 1 31 17 C31 27 17 43 17 43 Z" fill="${album.surface}" stroke="${album.tint}" stroke-width="3"/>
  <circle cx="17" cy="17" r="5.5" fill="${album.tint}"/>
</svg>`;

/** B: the place's own stamp, standing on a short stem. */
const stampPin = `
<div style="display:flex;flex-direction:column;align-items:center">
  <div style="filter:drop-shadow(0 3px 6px #000a)">${stamp(76)}</div>
  <div style="width:3px;height:12px;background:${reward.text};border-radius:2px;margin-top:-4px"></div>
  <div style="width:10px;height:4px;border-radius:50%;background:#0008;margin-top:1px"></div>
</div>`;

/** C: gold, the colour of a stamp earned. */
const goldPin = `
<svg width="34" height="44" viewBox="0 0 34 44">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${reward.gold}"/><stop offset="1" stop-color="${reward.goldDeep}"/>
  </linearGradient></defs>
  <path d="M17 43 C17 43 3 27 3 17 A14 14 0 0 1 31 17 C31 27 17 43 17 43 Z" fill="url(#g)" stroke="${reward.stage}" stroke-opacity="0.5" stroke-width="1.5"/>
  <circle cx="17" cy="17" r="5.5" fill="${reward.stage}"/>
</svg>`;

// --- The cards. ---------------------------------------------------------------

const lines = (ink) => `
  ${card.whyLine ? `<div class="why" style="color:${ink.text}">${escapeXml(card.whyLine)}</div>` : ''}
  ${card.distanceSentence ? `<div class="small" style="color:${ink.muted}">${escapeXml(card.distanceSentence)}</div>` : ''}
  <div class="plain" style="color:${ink.tint}">Fechar</div>`;

const albumInk = { text: album.text, muted: album.textMuted, tint: album.tint };
const rewardInk = { text: reward.text, muted: reward.textMuted, tint: reward.goldInk };

/** A: the passport's own card, as it opens over the album, stamp beside the name. */
const cardA = `
<div class="card" style="background:${album.surface}">
  <div class="grabber" style="background:${album.hairline}"></div>
  <div class="row">
    <div>${stamp(78)}</div>
    <div class="heading">
      <div class="meta" style="color:${album.textMuted}">${escapeXml(card.categoryLabel)}</div>
      <div class="name" style="color:${album.text}">${escapeXml(card.name)}</div>
      ${card.regionLabel ? `<div class="body" style="color:${album.text}">${escapeXml(card.regionLabel)}</div>` : ''}
      <div class="small" style="color:${album.textMuted}">${escapeXml(card.statusLine)}</div>
    </div>
  </div>
  ${lines(albumInk)}
</div>`;

/** B: the same dark sheet, words only: the stamp is on the map, as the pin. */
const cardB = `
<div class="card" style="background:${album.surface}">
  <div class="grabber" style="background:${album.hairline}"></div>
  <div class="meta" style="color:${album.textMuted}">${escapeXml(card.metaLabel)}</div>
  <div class="name" style="color:${album.text}">${escapeXml(card.name)}</div>
  ${card.regionLabel ? `<div class="body" style="color:${album.text}">${escapeXml(card.regionLabel)}</div>` : ''}
  ${lines(albumInk)}
</div>`;

/** C: the trophy's ground, violet to black, with the gold line over the name. */
const cardC = `
<div class="card" style="background:linear-gradient(${reward.panelTop}, ${reward.panelBottom});border:1px solid ${reward.panelEdge}">
  <div class="grabber" style="background:${reward.panelEdge}"></div>
  <div class="row">
    <div>${stamp(70)}</div>
    <div class="heading">
      <div class="meta" style="color:${reward.goldInk};letter-spacing:1.5px">${escapeXml(card.categoryLabel)}</div>
      <div class="name" style="color:${reward.text}">${escapeXml(card.name)}</div>
      <div class="small" style="color:${reward.textMuted}">${escapeXml(card.statusLine)}</div>
    </div>
  </div>
  ${lines(rewardInk)}
</div>`;

// --- The page. ------------------------------------------------------------------

const phone = (label, title, note, pin, pinW, pinH, sheet) => `
<figure>
  <div class="phone">
    <div class="base" style="background-image:url(${today})"></div>
    <div class="pin" style="left:${tip.x - pinW / 2}px;top:${tip.y - pinH}px">${pin}</div>
    <div class="sheet">${sheet}</div>
  </div>
  <figcaption><b>${label}. ${title}</b><br>${note}</figcaption>
</figure>`;

const html = `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><title>Cartão do mapa: opções</title>
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
  .sheet { position: absolute; left: 16px; right: 16px; bottom: 202px; }
  .card { border-radius: 22px; padding: 8px 16px 8px; display: flex; flex-direction: column; gap: 4px;
          box-shadow: 0 8px 24px #000a; }
  .grabber { align-self: center; width: 36px; height: 5px; border-radius: 3px; margin-bottom: 8px; }
  .row { display: flex; align-items: center; gap: 16px; }
  .heading { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .meta { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  .name { font-size: 22px; font-weight: 800; }
  .body { font-size: 17px; }
  .small { font-size: 14px; }
  .why { font-size: 17px; line-height: 1.35; margin: 8px 0; }
  .plain { min-height: 60px; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 600; }
</style></head><body>
<h1>O cartão que abre no mapa (N12)</h1>
<p class="lead">Praia Formosa, aberta com <i>Ver no mapa</i>, sobre o mapa do P30 de hoje de manhã. À esquerda, o que a app
mostra hoje: cartão cinzento claro e o pino vermelho do Google. As três opções usam as cores do passaporte e do troféu.
O pino de cada opção está no sítio exato do pino do Google.</p>
<div class="row-of">
<figure><div class="phone" style="background-image:url(${today})"></div><figcaption><b>Hoje</b><br>O cartão claro e o pino do Google, como estão na app.</figcaption></figure>
${phone('A', 'O cartão do passaporte, pino azul', 'O mesmo cartão escuro que abre no passaporte, com o carimbo ao lado do nome. O pino é um anel no azul da app.', ringPin, 34, 44, cardA)}
${phone('B', 'O carimbo é o pino', 'O próprio carimbo marca o lugar no mapa. O cartão fica só com palavras, mais baixo, e deixa ver mais mapa.', stampPin, 76, 93, cardB)}
${phone('C', 'Dourado, como o troféu', 'O fundo violeta a preto do troféu, com a linha dourada. O pino é dourado, a cor de um carimbo ganho.', goldPin, 34, 44, cardC)}
</div>
</body></html>`;

const out = path.join(here, 'out', 'map-card-options.html');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(out);
