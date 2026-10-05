/**
 * The revised new-stamp celebration (E2) and a collected stamp as a trophy,
 * drawn as options for the project lead (T-249, T-251, 2026-10-05).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-trophy-options.mjs
 *     → tools/out/trophy-options.html
 *
 * The lead picked E2 (gold rays) for a new stamp but said it "could have some
 * more work done"; E1 (the slam) was not disliked. So the revision gives E2
 * E1's impact. And a stamp already collected, tapped in the passport, opens a
 * card that is "quite simple"; it should "feel like a trophy".
 *
 * Every stamp is the real drawing with the real postmark (`stampElements` via
 * svg-render.mjs). Every fact on a trophy is one the app already stores for an
 * award: the place, the date and time, the minutes spent there, its set and
 * how much of the set is collected. Nothing is invented to fill the card.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampSvgWithDesign } from './lib/svg-render.mjs';
import { designFor } from '../app/src/passport/stampArt.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(readFileSync(path.join(here, '..', 'content', 'pois.json'), 'utf8'));
const byId = new Map(pack.places.map((place) => [place.id, place]));

/** The real stamp, collected, with the real postmark when given. */
function stamp(id, postmark = null) {
  const place = byId.get(id);
  return stampSvgWithDesign(place.id, designFor(place.id, place.category, place.motif), place.name, true, '', null, postmark);
}

/** The lead's own award at Câmara de Lobos (2026-10-04 16:26, 900 s inside). */
const AWARD = {
  id: 'camara-de-lobos',
  name: 'Câmara de Lobos',
  category: 'ALDEIA',
  set: 'aldeias',
  ofSet: [1, 19],
  date: '4 de outubro de 2026',
  shortDate: '4 out. 2026',
  time: '16:26',
  minutes: 15,
  region: 'Câmara de Lobos',
  postmark: { top: '4 OUT', bottom: '2026' },
  accent: designFor('camara-de-lobos', 'village').colourway.accent,
};
const why = byId.get(AWARD.id).why?.pt ?? '';

function phone(caption, inner, id) {
  return `<figure class="phone-wrap"><div class="phone" id="${id}">${inner}</div>
    <button class="replay" onclick="replay('${id}')">Repetir animação</button>
    <figcaption>${caption}</figcaption></figure>`;
}

const confetti = Array.from({ length: 34 }, (_, i) => {
  const hue = ['#F2A900', '#FFE08A', '#5AA9FF', '#FF6B6B', '#FFFFFF'][i % 5];
  return `<i class="cf" style="left:${(i * 29) % 100}%;background:${hue};--d:${(i % 8) * 0.04}s;--x:${((i * 53) % 80) - 40}px;--r:${(i * 47) % 360}deg"></i>`;
}).join('');

const NEW_ID = 'pico-do-areeiro';

// ---------------------------------------------------------------------------
// E2, as picked, and revised
// ---------------------------------------------------------------------------

const e2Before = phone(
  '<b>E2 como estava.</b> Raios, carimbo a girar, contador 9 → 10.',
  `<div class="scrim"></div><div class="cel">
    <div class="rays"></div>
    <div class="title gold">NOVO CARIMBO!</div>
    <div class="spin">${stamp(NEW_ID)}</div>
    <div class="place">Pico do Areeiro</div>
    <div class="counter"><span class="old">9</span><span class="new">10</span> / 80</div>
    <div class="cta gold-bg">Ver no passaporte</div><div class="link">Fechar</div>
  </div>`,
  'e2-before'
);

const e2Revised = phone(
  '<b>E2 revisto.</b> Escurece, e um clarão dourado abre os raios. O carimbo cai a girar e <b>bate</b> (tremor e anel de tinta de E1), e o carimbo dos correios é carimbado por cima com a data de hoje. Explode confetti dourado. Depois sobe o contador e enche-se a barra do conjunto, com "Falta 1 para a prata" quando é verdade.',
  `<div class="scrim"></div><div class="cel">
    <div class="flash"></div>
    <div class="rays big"></div>
    <div class="confetti">${confetti}</div>
    <div class="title gold">NOVO CARIMBO!</div>
    <div class="ring"></div>
    <div class="drop">${stamp(NEW_ID)}<div class="pm-stamp">${pmMark('5 OUT', '2026', '#B3261E')}</div></div>
    <div class="place">Pico do Areeiro</div>
    <div class="counter"><span class="old">9</span><span class="new">10</span> / 80 lugares</div>
    <div class="setbar"><div class="bar"><i style="--from:16%;--to:21%"></i></div><span>4 de 19 miradouros</span></div>
    <div class="cta gold-bg">Ver no passaporte</div><div class="link">Fechar</div>
  </div>`,
  'e2-revised'
);

const e2Rank = phone(
  '<b>E2 revisto, quando sobe de nível.</b> O mesmo, e se este carimbo fizer subir a medalha do passaporte (bronze → prata aos 10 lugares, D-078), a medalha entra a seguir com o seu próprio brilho. Só aparece quando acontece de verdade.',
  `<div class="scrim"></div><div class="cel">
    <div class="flash"></div>
    <div class="rays big"></div>
    <div class="confetti">${confetti}</div>
    <div class="title gold">NOVO CARIMBO!</div>
    <div class="ring"></div>
    <div class="drop">${stamp(NEW_ID)}<div class="pm-stamp">${pmMark('5 OUT', '2026', '#B3261E')}</div></div>
    <div class="place">Pico do Areeiro</div>
    <div class="rankup"><div class="medal silver">10</div><div><b>Subiste a prata!</b><span>10 lugares visitados</span></div></div>
    <div class="cta gold-bg">Ver no passaporte</div><div class="link">Fechar</div>
  </div>`,
  'e2-rank'
);

/** A cancellation mark in ink: two rings, the date, wavy lines. */
function pmMark(top, bottom, ink) {
  return `<svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="${ink}" stroke-width="2.2" opacity="0.9">
      <circle cx="35" cy="35" r="26"/><circle cx="35" cy="35" r="20" stroke-width="1"/>
      ${[20, 30, 40, 50].map((y) => `<path d="M64 ${y} q8 -5 16 0 t16 0 t16 0"/>`).join('')}
    </g>
    <text x="35" y="33" text-anchor="middle" font-family="Helvetica, Arial" font-weight="800" font-size="10" fill="${ink}">${top}</text>
    <text x="35" y="45" text-anchor="middle" font-family="Helvetica, Arial" font-weight="700" font-size="9" fill="${ink}">${bottom}</text>
  </svg>`;
}

// ---------------------------------------------------------------------------
// T-251: a collected stamp as a trophy
// ---------------------------------------------------------------------------

const facts = `<div class="facts">
  <div><b>${AWARD.shortDate}</b><span>às ${AWARD.time}</span></div>
  <div><b>${AWARD.minutes} min</b><span>no local</span></div>
  <div><b>${AWARD.ofSet[0]} de ${AWARD.ofSet[1]}</b><span>${AWARD.set}</span></div>
</div>`;

const trophyVitrine = phone(
  '<b>T1. Vitrine.</b> O carimbo enorme sob um foco de luz, num pedestal, com um brilho que passa devagar. Por baixo, três factos verdadeiros deste carimbo: quando, quanto tempo lá estiveste, e onde vai no conjunto. Botões: Ver no mapa e Partilhar.',
  `<div class="vitrine">
    <div class="close">×</div>
    <div class="cat">${AWARD.category}</div>
    <div class="spot"></div>
    <div class="trophy-stamp sheen">${stamp(AWARD.id, AWARD.postmark)}</div>
    <div class="pedestal"></div>
    <div class="tname">${AWARD.name}</div>
    ${facts}
    <p class="why">${why}</p>
    <div class="cta gold-bg">Ver no mapa</div><div class="link">Partilhar</div>
  </div>`,
  't-vitrine'
);

const trophyPage = phone(
  '<b>T2. Página do passaporte.</b> O carimbo colado numa página de papel, carimbado por cima a tinta com a data, e a hora e o tempo escritos à mão ao lado, como num passaporte verdadeiro. Mais íntimo, menos festa.',
  `<div class="paper">
    <div class="close dark">×</div>
    <div class="paper-head"><span>PASSAPORTE · ${AWARD.category}</span><span>MADEIRA</span></div>
    <div class="paper-stamp">${stamp(AWARD.id)}<div class="pm-over">${pmMark('4 OUT', '2026', '#1E3A8A')}</div></div>
    <div class="hand">Câmara de Lobos<br><small>4 de outubro, 16:26 · 15 minutos</small></div>
    <div class="paper-set"><span>Aldeias</span><div class="dots">${Array.from({ length: 19 }, (_, i) => `<i class="${i < 1 ? 'on' : ''}"></i>`).join('')}</div><span>1 de 19</span></div>
    <p class="why dark">${why}</p>
    <div class="cta blue">Ver no mapa</div><div class="link dark">Partilhar</div>
  </div>`,
  't-page'
);

const trophyTilt = phone(
  '<b>T3. Na mão.</b> O carimbo grande inclina-se com o telemóvel (aqui com o rato: passa por cima) e um reflexo holográfico corre pela superfície. É a "inclinação e brilho" da Fase 5 (D-089), que já está no plano. A moldura e a medalha do nível do passaporte ficam por trás.',
  `<div class="holo-bg">
    <div class="close">×</div>
    <div class="cat">${AWARD.category} · ${AWARD.ofSet[0]} DE ${AWARD.ofSet[1]}</div>
    <div class="tilt" onmousemove="tilt(event,this)" onmouseleave="untilt(this)">
      <div class="tilt-inner">${stamp(AWARD.id, AWARD.postmark)}<div class="holo"></div></div>
    </div>
    <div class="tname">${AWARD.name}</div>
    <div class="sub">Visitado a ${AWARD.date}, às ${AWARD.time}</div>
    <div class="medal-row"><div class="medal bronze">2</div><span>Passaporte bronze · faltam 8 para a prata</span></div>
    <p class="why">${why}</p>
    <div class="cta gold-bg">Ver no mapa</div><div class="link">Partilhar</div>
  </div>`,
  't-tilt'
);

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; background: #111113; color: #F2F2F7; }
header, section { padding: 20px; max-width: 1240px; margin: 0 auto; }
section { border-top: 1px solid #2C2C2E; }
h1 { font-size: 22px; margin: 0 0 8px; } h2 { font-size: 19px; margin: 0 0 6px; }
.note { color: #AEAEB2; max-width: 820px; margin: 0 0 14px; }
.row { display: flex; flex-wrap: wrap; gap: 26px; align-items: flex-start; }
.phone-wrap { margin: 0; width: 300px; } .phone-wrap figcaption { color: #C7C7CC; font-size: 13.5px; margin-top: 6px; }
.phone { position: relative; width: 300px; height: 634px; border-radius: 34px; overflow: hidden; border: 8px solid #2C2C2E; background: #000; font-size: 13px; }
.phone svg { display: block; width: 100%; height: 100%; }
.replay { margin-top: 8px; background: #2C2C2E; color: #F2F2F7; border: 0; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
.scrim { position: absolute; inset: 0; background: radial-gradient(circle at 50% 36%, #2a2310, #000 70%); }
.cel { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: 34px 18px 14px; text-align: center; }
.title { font-size: 27px; font-weight: 900; letter-spacing: 1px; animation: pop .5s cubic-bezier(.2,1.6,.4,1) .7s both; z-index: 2; }
.gold { background: linear-gradient(#FFF1B8, #E59A00); -webkit-background-clip: text; background-clip: text; color: transparent; }
@keyframes pop { from { transform: scale(.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.rays { position: absolute; top: 40px; width: 420px; height: 420px; border-radius: 50%; background: repeating-conic-gradient(#F2A90040 0 9deg, transparent 9deg 22deg); mask: radial-gradient(circle, #000 25%, transparent 65%); animation: spin 14s linear infinite, pop .6s ease-out both; }
.rays.big { width: 520px; height: 520px; top: -10px; background: repeating-conic-gradient(#FFD45C55 0 7deg, transparent 7deg 18deg); animation: spin 10s linear infinite, raysin .8s ease-out .15s both; }
@keyframes raysin { from { transform: scale(.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes spin { to { rotate: 360deg; } }
.flash { position: absolute; top: 120px; width: 60px; height: 60px; border-radius: 50%; background: #FFF4C2; box-shadow: 0 0 80px 50px #FFD45C; opacity: 0; animation: flash .7s ease-out .1s both; }
@keyframes flash { 0% { transform: scale(.2); opacity: 0; } 30% { opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
.spin { width: 190px; height: 190px; margin-top: 18px; animation: spinin 1s cubic-bezier(.2,1.3,.4,1) .2s both; filter: drop-shadow(0 0 18px #F2A90088); }
@keyframes spinin { from { transform: scale(0) rotate(-540deg); } to { transform: scale(1) rotate(-4deg); } }
.drop { position: relative; width: 196px; height: 196px; margin-top: 16px; animation: drop .75s cubic-bezier(.55,0,.75,0) .35s both, shake .35s 1.1s both; filter: drop-shadow(0 0 20px #F2A900aa); z-index: 1; }
@keyframes drop { from { transform: translateY(-260px) scale(2.2) rotate(-200deg); opacity: 0; } to { transform: none; rotate: -4deg; opacity: 1; } }
@keyframes shake { 0%,100% { translate: 0 0; } 20% { translate: -7px 3px; } 40% { translate: 6px -4px; } 60% { translate: -4px 2px; } 80% { translate: 3px -1px; } }
.pm-stamp { position: absolute; right: -24px; top: -6px; width: 112px; height: 66px; transform: rotate(-12deg); opacity: 0; animation: thump .35s cubic-bezier(.3,1.8,.5,1) 1.55s both; }
@keyframes thump { from { transform: rotate(-12deg) scale(2.4); opacity: 0; } to { transform: rotate(-12deg) scale(1); opacity: 1; } }
.ring { position: absolute; top: 150px; width: 200px; height: 200px; border-radius: 50%; border: 7px solid #F2A900; opacity: 0; animation: ring 1s ease-out 1.1s both; }
@keyframes ring { 0% { transform: scale(.6); opacity: 0; } 1% { opacity: .95; } 100% { transform: scale(2); opacity: 0; } }
.confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.cf { position: absolute; top: 36%; width: 8px; height: 13px; border-radius: 2px; opacity: 0; animation: cf 1.8s cubic-bezier(.2,.7,.4,1) calc(1.1s + var(--d)) both; }
@keyframes cf { 0% { opacity: 0; transform: translate(0,0) rotate(0); } 1% { opacity: 1; } 15% { transform: translate(calc(var(--x) * .6), -60px) rotate(120deg); } 100% { opacity: 0; transform: translate(var(--x), 380px) rotate(calc(var(--r) + 540deg)); } }
.place { font-size: 23px; font-weight: 800; margin-top: 12px; animation: pop .4s ease-out 1.3s both; z-index: 2; }
.counter { font-size: 15px; color: #D1D1D6; margin: 8px 0 2px; position: relative; animation: pop .4s ease-out 1.6s both; }
.counter .old, .counter .new { display: inline-block; font-size: 28px; font-weight: 900; color: #F2F2F7; }
.counter .old { position: absolute; left: 0; animation: out .4s ease-in 2.1s both; } .counter .new { animation: in .4s ease-out 2.3s both; }
@keyframes out { to { transform: translateY(-20px); opacity: 0; } } @keyframes in { from { transform: translateY(20px); opacity: 0; } }
.setbar { width: 100%; font-size: 13px; color: #D1D1D6; margin: 6px 0 2px; animation: pop .4s ease-out 2.2s both; }
.bar { height: 8px; background: #3A3A3C; border-radius: 4px; overflow: hidden; margin-bottom: 5px; }
.bar i { display: block; height: 100%; width: var(--to); background: linear-gradient(90deg, #F2A900, #FFE08A); animation: fill .9s ease-out 2.5s both; }
@keyframes fill { from { width: var(--from); } }
.rankup { display: flex; gap: 12px; align-items: center; background: #ffffff10; border: 1px solid #C0C6D066; border-radius: 16px; padding: 8px 14px; margin: 10px 0 2px; text-align: left; animation: pop .5s cubic-bezier(.2,1.6,.4,1) 2.3s both; }
.rankup b { display: block; font-size: 15px; } .rankup span { font-size: 12px; color: #D1D1D6; }
.medal { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font-weight: 900; color: #1C1C1E; flex: none; }
.medal.silver { background: radial-gradient(circle at 35% 30%, #FFFFFF, #9AA3AF 70%); box-shadow: 0 0 18px #E5E7EB99; animation: medal 1.6s ease-in-out 2.8s 2; }
.medal.bronze { background: radial-gradient(circle at 35% 30%, #F3C08A, #9A5B22 70%); }
@keyframes medal { 50% { transform: scale(1.18) rotate(8deg); box-shadow: 0 0 30px #FFFFFF; } }
.cel .cta, .cel .link { width: 100%; animation: pop .4s ease-out 2.5s both; }
.cel .cta { margin-top: auto; }
.cta { border-radius: 16px; padding: 14px 10px; font-weight: 800; font-size: 15px; margin-top: 8px; text-align: center; }
.gold-bg { background: linear-gradient(#FFD45C, #E59A00); color: #1C1C1E; }
.blue { background: #0A5AAE; color: #fff; }
.link { color: #8E8E93; padding: 10px 0 2px; font-size: 14px; text-align: center; } .link.dark { color: #0A5AAE; }
.close { position: absolute; top: 12px; right: 16px; font-size: 26px; color: #AEAEB2; z-index: 3; } .close.dark { color: #636366; }
.cat { font-size: 11px; letter-spacing: 2px; color: #FFD479; font-weight: 800; text-align: center; margin-top: 14px; }
.vitrine { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 28%, #3a3020 0%, #121214 55%, #000 100%); padding: 18px; display: flex; flex-direction: column; align-items: center; }
.spot { position: absolute; top: 0; width: 260px; height: 360px; background: linear-gradient(#FFF6D530, transparent 80%); clip-path: polygon(40% 0, 60% 0, 100% 100%, 0 100%); }
.trophy-stamp { position: relative; width: 210px; height: 210px; margin-top: 14px; z-index: 1; filter: drop-shadow(0 18px 18px #000c) drop-shadow(0 0 22px ${AWARD.accent}66); animation: float 4s ease-in-out infinite; }
@keyframes float { 50% { transform: translateY(-6px) rotate(1deg); } }
.sheen { overflow: hidden; } .sheen::after { content: ""; position: absolute; inset: -20%; background: linear-gradient(115deg, transparent 35%, #ffffff66 48%, transparent 60%); mix-blend-mode: soft-light; animation: sheen 3.5s ease-in-out infinite; }
@keyframes sheen { from { transform: translateX(-80%); } to { transform: translateX(80%); } }
.pedestal { width: 170px; height: 18px; margin-top: -6px; border-radius: 50%; background: radial-gradient(ellipse, #F2A90055, transparent 70%); }
.tname { font-size: 25px; font-weight: 900; margin-top: 8px; text-align: center; }
.sub { font-size: 13px; color: #D1D1D6; margin-top: 2px; text-align: center; }
.facts { display: flex; gap: 6px; width: 100%; margin: 10px 0 4px; }
.facts > div { flex: 1; background: #ffffff0f; border: 1px solid #ffffff1a; border-radius: 12px; padding: 7px 4px; text-align: center; }
.facts b { display: block; font-size: 12.5px; } .facts span { font-size: 11px; color: #AEAEB2; }
.why { font-size: 12.5px; color: #C7C7CC; margin: 6px 0 auto; text-align: center; } .why.dark { color: #3A3A3C; }
.vitrine .cta, .vitrine .link, .holo-bg .cta, .holo-bg .link, .paper .cta, .paper .link { width: 100%; }
.paper { position: absolute; inset: 0; padding: 18px; display: flex; flex-direction: column; align-items: center; color: #1C1C1E;
  background: #F4EEDC repeating-linear-gradient(0deg, transparent 0 22px, #00000008 22px 23px); }
.paper-head { width: 100%; display: flex; justify-content: space-between; font-size: 10.5px; letter-spacing: 1.5px; color: #7A6A48; font-weight: 700; margin-top: 18px; border-bottom: 1px solid #C9BB97; padding-bottom: 6px; }
.paper-stamp { position: relative; width: 196px; height: 196px; margin-top: 16px; transform: rotate(-3deg); filter: drop-shadow(0 4px 4px #0003); }
.pm-over { position: absolute; right: -40px; bottom: 10px; width: 130px; height: 76px; transform: rotate(-10deg); mix-blend-mode: multiply; animation: thump .35s cubic-bezier(.3,1.8,.5,1) .4s both; }
.hand { font-family: "Segoe Script", "Bradley Hand", cursive; font-size: 22px; color: #1E3A8A; text-align: center; margin-top: 8px; transform: rotate(-2deg); }
.hand small { font-size: 14px; }
.paper-set { width: 100%; display: flex; align-items: center; gap: 8px; font-size: 12px; color: #5A4A2A; font-weight: 700; margin: 10px 0 4px; }
.dots { flex: 1; display: flex; gap: 3px; } .dots i { flex: 1; height: 8px; border-radius: 2px; background: #D8CCAA; } .dots i.on { background: #B3261E; }
.holo-bg { position: absolute; inset: 0; padding: 18px; display: flex; flex-direction: column; align-items: center; background: radial-gradient(circle at 50% 35%, #1f2a44, #0b0d14 70%); }
.tilt { width: 230px; height: 230px; margin-top: 16px; perspective: 700px; }
.tilt-inner { position: relative; width: 100%; height: 100%; transition: transform .12s; transform-style: preserve-3d; filter: drop-shadow(0 20px 20px #000c); animation: idle 5s ease-in-out infinite; }
@keyframes idle { 25% { transform: rotateX(8deg) rotateY(-12deg); } 75% { transform: rotateX(-6deg) rotateY(12deg); } }
.holo { position: absolute; inset: 8%; border-radius: 6px; background: linear-gradient(var(--a, 120deg), transparent 30%, #ff00c833 40%, #00e5ff40 50%, #ffe60033 60%, transparent 70%); mix-blend-mode: color-dodge; background-size: 200% 200%; animation: holo 4s linear infinite; }
@keyframes holo { from { background-position: 0% 0%; } to { background-position: 200% 200%; } }
.medal-row { display: flex; align-items: center; gap: 10px; margin: 10px 0 2px; font-size: 13px; color: #D1D1D6; }
.medal-row .medal { width: 34px; height: 34px; font-size: 13px; }
`;

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bruma: E2 revisto e o carimbo como troféu</title><style>${CSS}</style></head><body>
<header>
  <h1>E2 revisto, e o carimbo como troféu (T-249, T-251)</h1>
  <p class="note">Carimbos reais com o carimbo dos correios real. Nos troféus, todos os factos são os que a app já guarda: a tua visita a Câmara de Lobos a 4 de outubro às 16:26, 15 minutos no local, 1 de 19 aldeias. Carrega em "Repetir animação" para ver de novo.</p>
</header>
<section>
  <h2>1. Novo carimbo: E2 revisto</h2>
  <p class="note">À esquerda, E2 como o escolheste. Ao meio, a revisão com o impacto de E1. À direita, a mesma revisão quando o carimbo faz subir a medalha do passaporte.</p>
  <div class="row">${e2Before}${e2Revised}${e2Rank}</div>
</section>
<section>
  <h2>2. Um carimbo que já tens, como troféu (T-251)</h2>
  <p class="note">Hoje: um cartão com o carimbo pequeno ao lado do nome. As três direções abaixo põem o carimbo ao centro e grande. Em T3, passa o rato por cima do carimbo para o inclinar.</p>
  <div class="row">${trophyVitrine}${trophyPage}${trophyTilt}</div>
</section>
<script>
function replay(id) { const el = document.getElementById(id); el.parentNode.replaceChild(el.cloneNode(true), el); }
function tilt(e, el) { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
  const inner = el.firstElementChild; inner.style.animation = 'none'; inner.style.transform = 'rotateX(' + (-y * 28) + 'deg) rotateY(' + (x * 28) + 'deg)';
  inner.querySelector('.holo').style.setProperty('--a', (120 + x * 120) + 'deg'); }
function untilt(el) { const inner = el.firstElementChild; inner.style.transform = ''; inner.style.animation = ''; }
</script>
</body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
writeFileSync(path.join(here, 'out', 'trophy-options.html'), html);
console.log(`Wrote tools/out/trophy-options.html (${Math.round(html.length / 1024)} kB)`);
