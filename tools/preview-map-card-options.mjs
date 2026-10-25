/**
 * The map's place card and pin: options for the project lead (N12, 2026-10-23).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-map-card-options.mjs <map.png> <pinX> <pinY> [today.png]
 *     → tools/out/map-card-options-5.html (round 5; rounds 1 to 4 are in git history)
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
// target kept around it), the category and municipality on one line.
// Rounds 3 and 4 turned the place's *why* line into a *Sabias que…* question;
// the lead (2026-10-25): "let's not make it a question". Round 5: the line
// stays exactly as the pack has it, and the "did you know" is only its label,
// itself a short question so a statement can follow it: PT "Sabias?", EN "Did
// you know?", DE "Schon gewusst?". No content changes. A line with nothing
// surprising in it (a route, a plain description) shows without the label.

/** The sample: [id, whether its line earns the label]. */
const SAMPLE = [
  ['praia-formosa', true],
  ['camara-de-lobos', true],
  ['camacha', true],
  ['levada-do-barreiro', true],
  ['pico-do-facho', true],
  ['pico-ruivo', true],
  ['levada-do-furado', false],
  ['ponta-do-sol', false],
];
const CURIOSITY = place.why.pt;
const LABEL = 'Sabias?';

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
    <div class="factLabel" style="color:${ink.label}">${LABEL}</div>
    <div class="factText" style="color:${ink.text}">${escapeXml(CURIOSITY)}</div>
  </div>`;

const albumInk = { text: album.text, muted: album.textMuted, label: album.tint, factFill: '#FFFFFF0D' };
const rewardInk = { text: reward.text, muted: reward.textMuted, label: reward.goldInk, factFill: '#FFFFFF0F' };

/** 1: the passport's dark sheet, its blue. */
const card1 = `<div class="card" style="background:${album.surface}">${head(albumInk, 56)}${fact(albumInk)}</div>`;

/** 2: the trophy's violet to black, its gold. */
const card2 = `<div class="card" style="background:linear-gradient(${reward.panelTop}, ${reward.panelBottom});border:1px solid ${reward.panelEdge}">${head(rewardInk, 56)}${fact(rewardInk)}</div>`;

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
  h2 { font-size: 16px; margin: 32px 0 4px; }
  table { border-collapse: collapse; max-width: 1200px; }
  th, td { text-align: left; padding: 6px 12px; border-bottom: 1px solid #333; vertical-align: top; }
  th { color: #aaa; font-weight: 600; }
  tr.flat td { color: #777; }
  .samples { display: grid; grid-template-columns: repeat(4, 280px); gap: 16px; }
  .who { color: #aaa; margin-bottom: 4px; }
  .sample.flat { opacity: .6; }
  td.old { color: #888; text-decoration: line-through; text-decoration-color: #555; }
</style></head><body>
<h1>O cartão que abre no mapa, quinta ronda (N12)</h1>
<p class="lead">As opções 1 e 2, com a frase de hoje tal como está, debaixo da etiqueta <i>Sabias?</i>. Sem a pega e sem a linha <i>Fechar</i>: uma cruz no canto
fecha (com a mesma área de toque de 60 dp). A categoria e o concelho numa só linha. À esquerda, o cartão de hoje para comparar.</p>
<div class="row-of">
<figure><div class="phone" style="background-image:url(${today})"></div><figcaption><b>Hoje</b><br>O cartão claro e o pino do Google, como estão na app.</figcaption></figure>
${phone('1', 'Escuro, pino azul', 'O cartão do passaporte, mais baixo. A curiosidade numa caixa por baixo do nome.', bluePin, card1)}
${phone('2', 'Violeta e dourado, pino amarelo', 'As cores do troféu, com a mesma forma do 1.', goldPin, card2)}
</div>
<h2>As frases de hoje, com a etiqueta: amostra</h2>
<p class="lead">Nenhuma frase muda. A etiqueta <i>Sabias?</i> fica por cima quando a frase tem alguma coisa de curioso; quando é
só um percurso ou uma descrição (a cinzento), a frase aparece sozinha, sem etiqueta.</p>
<div class="samples">
${SAMPLE.map(([id, labelled]) => {
  const each = (pack.places ?? pack).find((one) => one.id === id);
  return `<div class="sample${labelled ? '' : ' flat'}"><div class="who">${escapeXml(each.name)}</div>` +
    `<div class="fact" style="background:#2C2C2E">${labelled ? `<div class="factLabel" style="color:${album.tint}">${LABEL}</div>` : ''}` +
    `<div class="factText" style="color:${album.text}">${escapeXml(each.why.pt)}</div></div></div>`;
}).join('\n')}
</div>
</body></html>`;

const out = path.join(here, 'out', 'map-card-options-5.html');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(out);
