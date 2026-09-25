/**
 * Three screens, drawn as options side by side for the project lead to judge
 * (2026-09-25, after the second review and their first look at it).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-screen-options.mjs
 *     → tools/out/screen-options.html
 *
 *   1. The place card a stamp opens: *"A 39 km em linha reta" is a bit useless,
 *      Madeira is full of turns*, and the information could be better presented.
 *   2. The top of the passport: *still needs some work*.
 *   3. T-220, one control language on the map: *I need some visual reference*.
 *
 * Round 2 (→ `tools/out/screen-options-2.html`), after the project lead chose A
 * for the map with a quieter progress line: *"we could explore different
 * information to present instead of 0 of 80 places"*, and *Centrar* *"could be
 * more discreet"*. Every progress option is a number the app can already
 * compute; none is invented for the drawing.
 *
 * Every stamp comes from `stampElements` (via svg-render.mjs), every colour and
 * size from `theme.ts` and the screens' own constants, so option A is today's
 * screen and the others differ only where they say they do. Nothing here
 * changes the app.
 *
 * ⚠ The map in the third board is a stand-in: the real one is Google's and a
 * Node script has no tiles. Judge the controls against each other, not against
 * the ground.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampSvg } from './lib/svg-render.mjs';
import { album, colors, mapChrome } from '../app/src/ui/theme.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(readFileSync(path.join(here, '..', 'content', 'pois.json'), 'utf8'));
const place = (id) => pack.places.find((candidate) => candidate.id === id);

const AREEIRO = place('pico-do-areeiro');
/** The draft why-go line (docs/why-go-draft.md), put into Portuguese for the mock. */
const WHY =
  'O terceiro pico mais alto da ilha, e o início do trilho até ao Pico Ruivo. Venha ver o nascer do sol acima das nuvens.';

const COUNTS = [
  ['Miradouros', 1, 19],
  ['Levadas', 0, 18],
  ['Aldeias', 1, 19],
  ['Praias', 0, 8],
  ['Monumentos', 1, 16],
];

const stamp = (p, collected, size, extra = '') =>
  `<div class="stamp" style="width:${size}px;height:${size}px">${stampSvg(`${p.id}-${Math.random().toString(36).slice(2, 7)}`, p.name, p.category, collected, `width:${Math.floor(size * 0.84)}px;height:${Math.floor(size * 0.84)}px;${extra}`, p.motif)}</div>`;

// The app's glyphs, same paths as SettingsMark, RecentreMark and WalkMark.
const SETTINGS = (ink) => `<svg viewBox="0 0 24 24" width="24" height="24">${[
  [7, 15],
  [12, 9],
  [17, 16],
]
  .map(([y, x]) => `<line x1="4" y1="${y}" x2="20" y2="${y}" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="2.4" fill="${ink}"/>`)
  .join('')}</svg>`;
const RECENTRE = (ink, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M21 3 L3 10.5 L10.6 13.4 L13.5 21 Z" fill="${ink}"/></svg>`;
const PLAY = (ink) => `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M9 5.5 L19 12 L9 18.5 Z" fill="${ink}"/></svg>`;
const SHARE = (ink) =>
  `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3v12M7 8l5-5 5 5M5 13v6h14v-6" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ---------------------------------------------------------------------------
// The passport page behind a card, and the passport's rows
// ---------------------------------------------------------------------------

/** A row as the passport draws it: its own category, collected ones first. */
function row(title, category, collected, size = 84) {
  const places = pack.places.filter((p) => p.category === category);
  return `<div class="rowhead"><span>${title.toUpperCase()}</span><span>${collected} de ${places.length} <b style="color:${album.tint}">Ver tudo</b></span></div>
    <div class="strip">${places.slice(0, 5).map((p, i) => stamp(p, i < collected, size)).join('')}</div>`;
}

function passportTopToday() {
  return `<div class="nav"><span style="color:${album.tint}">‹ Mapa</span><span>${SHARE(album.tint)}</span></div>
    <div class="largetitle">Passaporte</div>
    <div class="hero"><div class="heronum">3<span> / 80</span></div><div class="herolabel">lugares visitados</div>
    <div class="herolink">Ver a sua viagem</div></div>`;
}

// ---------------------------------------------------------------------------
// 1. The place card
// ---------------------------------------------------------------------------

function sheet({ dark, withStamp, why, distance, status }) {
  const t = dark
    ? { sheet: album.surface, text: album.text, muted: album.textMuted, tint: album.tint, action: album.action, actionText: album.actionText, grab: album.hairline }
    : { sheet: colors.surfaceRaised, text: colors.text, muted: colors.textMuted, tint: colors.tint, action: colors.action, actionText: colors.actionText, grab: colors.border };
  const heading = `<div><div class="meta" style="color:${t.muted}">MIRADOURO</div><div class="name" style="color:${t.text}">Pico do Areeiro</div>
      ${status ? `<div class="status" style="color:${t.muted}">${status}</div>` : ''}</div>`;
  return `<div class="sheet" style="background:${t.sheet}">
      <div class="grab" style="background:${t.grab}"></div>
      ${withStamp ? `<div class="stamprow">${stamp(AREEIRO, false, 88)}${heading}</div>` : heading}
      ${why ? `<div class="why" style="color:${t.text}">${WHY}</div>` : ''}
      <div class="region" style="color:${t.text}">Santana</div>
      ${distance ? `<div class="distance" style="color:${t.muted}">${distance}</div>` : ''}
      <div class="btn" style="background:${t.action};color:${t.actionText}">Ver no mapa</div>
      <div class="plain" style="color:${t.tint}">Fechar</div>
    </div>`;
}

function cardPhone(options) {
  return `<div class="phone" style="background:${album.background}">
      <div class="page">${passportTopToday()}${row('Miradouros', 'viewpoint', 1)}${row('Levadas', 'levada', 0)}</div>
      <div class="scrim"></div>
      <div class="sheetholder">${sheet(options)}</div>
    </div>`;
}

const CARD_OPTIONS = [
  {
    title: 'A. Hoje, no seu P30',
    phone: cardPhone({ dark: false, withStamp: false, why: false, distance: 'A 39 km, em linha reta' }),
    notes: [
      'Nenhum motivo para ir: a linha "porquê ir" existe em rascunho (T-201) e espera o seu veto.',
      'A distância em linha reta não diz nada numa ilha de estradas sinuosas.',
      'O carimbo que abriu o cartão desaparece.',
    ],
  },
  {
    title: 'B. Branco, com o carimbo e o motivo',
    phone: cardPhone({ dark: false, withStamp: true, why: true, distance: null, status: 'Ainda por visitar' }),
    notes: [
      'O carimbo ao lado do nome, como no passaporte.',
      'Uma frase de porquê ir (do rascunho T-201, aqui traduzida para o exemplo).',
      '<b>Distância só quando está perto</b> (até 2 km, "A 800 m daqui"): aí a linha reta é útil. Longe, não aparece.',
      'Uma linha de estado: "Ainda por visitar" ou "Visitou a 12 de setembro".',
    ],
  },
  {
    title: 'C. O mesmo, escuro como o álbum',
    phone: cardPhone({ dark: true, withStamp: true, why: true, distance: null, status: 'Ainda por visitar' }),
    notes: [
      'Igual a B, com as cores do álbum. É o que está na versão nova que ainda não chegou ao telemóvel.',
      'Disse que não se importa do branco: se preferir B, volto ao branco.',
    ],
  },
];

// ---------------------------------------------------------------------------
// 2. The top of the passport
// ---------------------------------------------------------------------------

function topPhone(top) {
  return `<div class="phone" style="background:${album.background}"><div class="page">${top}${row('Miradouros', 'viewpoint', 1)}${row('Levadas', 'levada', 0)}</div></div>`;
}

const bar = (fraction, fill, track) =>
  `<div class="bar" style="background:${track}"><div style="width:${Math.max(2, fraction * 100)}%;background:${fill}"></div></div>`;

const TOP_B = `<div class="nav"><span style="color:${album.tint}">‹ Mapa</span><span>${SHARE(album.tint)}</span></div>
  <div class="largetitle">Passaporte</div>
  <div class="card" style="background:${album.surface}">
    <div class="sumline"><span class="sumnum">3</span><span class="sumof">de 80 lugares</span></div>
    ${bar(3 / 80, album.tint, album.hairline)}
    <div class="cats">${COUNTS.map(([n, c, t]) => `<div class="cat"><b>${c}/${t}</b><span>${n}</span></div>`).join('')}</div>
    <div class="btn small" style="background:${album.action};color:${album.actionText}">${PLAY(album.actionText)} Ver a sua viagem</div>
  </div>`;

const TOP_C = `<div class="nav"><span style="color:${album.tint}">‹ Mapa</span><span></span></div>
  <div class="cover" style="background:${album.surface};border-color:${album.hairline}">
    <div class="covertop">PASSAPORTE · MADEIRA</div>
    <div class="coverdates">20 a 27 de setembro</div>
    <div class="coverstats">
      <div><b>3</b><span>de 80 lugares</span></div>
      <div><b>2</b><span>municípios</span></div>
      <div><b>2</b><span>dias</span></div>
    </div>
    <div class="coveractions">
      <div class="btn small" style="background:${album.action};color:${album.actionText}">${PLAY(album.actionText)} Ver a viagem</div>
      <div class="btn small ghost" style="color:${album.tint};border-color:${album.hairline}">${SHARE(album.tint)} Partilhar</div>
    </div>
  </div>`;

const TOP_OPTIONS = [
  {
    title: 'A. Hoje',
    phone: topPhone(passportTopToday()),
    notes: [
      'Um título grande, um número grande e um link. Ocupa meio ecrã e diz uma coisa só.',
      'Partilhar é um ícone sozinho no canto, fácil de não ver.',
      'As contagens por categoria estão espalhadas pelas filas lá em baixo.',
    ],
  },
  {
    title: 'B. Um resumo compacto',
    phone: topPhone(TOP_B),
    notes: [
      'O total, uma barra e as cinco categorias num só cartão, visíveis sem descer.',
      '"Ver a sua viagem" passa a botão.',
      'Mais baixo que hoje: as filas de carimbos começam mais acima.',
    ],
  },
  {
    title: 'C. A capa do passaporte',
    phone: topPhone(TOP_C),
    notes: [
      'Como a capa de um passaporte: o destino, as datas da viagem e três números.',
      'Ver e Partilhar lado a lado, com palavras, onde se veem.',
      'Municípios e dias já existem nos dados da aplicação; as datas aqui são um exemplo.',
    ],
  },
];

// ---------------------------------------------------------------------------
// 3. The map's controls (T-220)
// ---------------------------------------------------------------------------

const GROUND = `<svg class="ground" viewBox="0 0 360 780" preserveAspectRatio="none">
  <rect width="360" height="780" fill="#AADAFF"/>
  <path d="M-20 230 C 60 180, 150 210, 230 190 S 380 220, 400 260 L 400 560 C 330 600, 250 570, 170 600 S 40 590, -20 620 Z" fill="#F2EFE9"/>
  <path d="M40 300 C 90 350, 140 330, 200 380 S 300 420, 330 470" stroke="#FFFFFF" stroke-width="5" fill="none"/>
  <path d="M60 480 C 120 440, 180 470, 250 430" stroke="#FFFFFF" stroke-width="4" fill="none"/>
  <path d="M150 250 C 170 320, 160 420, 190 560" stroke="#FDE293" stroke-width="4" fill="none"/>
  <ellipse cx="200" cy="360" rx="70" ry="45" fill="#CDE6C3"/>
  <circle cx="180" cy="430" r="7" fill="#4285F4" stroke="#fff" stroke-width="3"/>
</svg>`;

const white = mapChrome.light;
const green = colors.good;
const shadow = 'box-shadow:0 1px 4px rgba(0,0,0,0.25);';
const passportStamp = stamp(place('miradouro-do-pico-dos-barcelos') ?? AREEIRO, true, 101, '');

function strip(bg = white.surface) {
  return `<div class="progress" style="background:${bg};${shadow}"><div style="color:${white.muted}">3 de 80 lugares</div>${bar(3 / 80, white.link, white.track)}</div>`;
}

const MAP_A = `<div class="phone map">${GROUND}
  <div class="gear" style="background:${white.surface};${shadow}">${SETTINGS(white.content)}</div>
  <div class="bottom">
    ${strip()}
    <div class="stamprowmap">${passportStamp}<div class="centre"><div class="pill" style="background:${white.surface};color:${white.link};height:40px;${shadow}">${RECENTRE(white.link)} Centrar</div></div><div style="width:101px"></div></div>
    <div class="walk" style="background:${green}">${PLAY('#fff')} Começar passeio</div>
  </div></div>`;

const MAP_B = `<div class="phone map">${GROUND}
  <div class="gear" style="background:${green};${shadow}">${SETTINGS('#fff')}</div>
  <div class="bottom">
    ${strip()}
    <div class="stamprowmap">${passportStamp}<div class="centre"><div class="pill" style="background:${green};color:#fff;height:60px;${shadow}">${RECENTRE('#fff')} Centrar</div></div><div style="width:101px"></div></div>
    <div class="walk" style="background:${green}">${PLAY('#fff')} Começar passeio</div>
  </div></div>`;

const MAP_C = `<div class="phone map">${GROUND}
  <div class="gear" style="background:${white.surface};${shadow}">${SETTINGS(white.content)}</div>
  <div class="pill floating" style="background:${white.surface};color:${white.content};height:60px;${shadow}">${RECENTRE(white.content)} Centrar</div>
  <div class="panel" style="background:${white.surface}">
    <div class="panelrow">${stamp(place('miradouro-do-pico-dos-barcelos') ?? AREEIRO, true, 76)}
      <div class="panelinfo"><div style="color:${white.content};font-weight:700">Passaporte</div><div style="color:${white.muted};font-size:14px">3 de 80 lugares</div>${bar(3 / 80, white.link, white.track)}</div></div>
    <div class="walk" style="background:${green};box-shadow:none">${PLAY('#fff')} Começar passeio</div>
  </div></div>`;

/** The flat progress line as it ships since D-090 was amended (2026-09-25). */
function quietLine(caption, fraction) {
  return `<div class="progress" style="background:${white.strip}"><div style="color:${white.muted}">${caption}</div>${
    fraction === null ? '' : bar(fraction, white.stripFill, white.track)
  }</div>`;
}

const CENTRAR = {
  today: `<div class="pill" style="background:${white.surface};color:${white.link};height:40px;${shadow}">${RECENTRE(white.link)} Centrar</div>`,
  quiet: `<div class="pill small" style="background:${white.strip};color:${white.muted};height:32px">${RECENTRE(white.muted, 14)} Centrar</div>`,
};

function home({ caption, fraction, centrar = 'today' }) {
  const middle =
    centrar === 'corner'
      ? `<div class="centre"></div><div class="pill small" style="background:${white.surface};color:${white.muted};height:36px;${shadow}">${RECENTRE(white.muted, 14)} Centrar</div>`
      : `<div class="centre">${CENTRAR[centrar]}</div><div style="width:101px"></div>`;
  return `<div class="phone map">${GROUND}
  <div class="gear" style="background:${white.surface};${shadow}">${SETTINGS(white.content)}</div>
  <div class="bottom">
    <div class="stamprowmap">${passportStamp}${middle}</div>
    ${quietLine(caption, fraction)}
    <div class="walk" style="background:${green}">${PLAY('#fff')} Começar passeio</div>
  </div></div>`;
}

const LINE_OPTIONS = [
  {
    title: 'A. Hoje: o total',
    phone: home({ caption: '3 de 80 lugares', fraction: 3 / 80 }),
    notes: ['Diz quanto falta na ilha toda. Com 80 lugares, a barra quase não mexe durante dias.'],
  },
  {
    title: 'B. A região para acabar',
    phone: home({ caption: 'Santana: 1 de 12 lugares', fraction: 1 / 12 }),
    notes: [
      'O município que já começou e está mais perto de acabar. É o que a WalkNYC faz com os bairros, e o que a decisão D-027 pedia para o mapa.',
      'Já calculado pela aplicação (<code>suggestNextRegion</code>), nunca foi mostrado.',
      'A barra mexe a sério: um lugar em doze.',
      'Sem nenhum carimbo ainda, mostra o total, como A.',
    ],
  },
  {
    title: 'C. A categoria que mais colecciona',
    phone: home({ caption: 'Miradouros: 3 de 19', fraction: 3 / 19 }),
    notes: [
      'Segue o que a pessoa gosta de fazer: quem anda em levadas vê levadas.',
      'Mais simples que B, mas não diz onde ir.',
    ],
  },
  {
    title: 'D. O lugar mais perto por visitar',
    phone: home({ caption: 'Mais perto: Fanal, a 1,4 km', fraction: null }),
    notes: [
      'Só aparece a menos de 2 km, como no cartão; longe, mostra o total.',
      '⚠ É parecido com o aviso "Mais perto por visitar" que retirou a 24 de setembro.',
    ],
  },
];

const CENTRAR_OPTIONS = [
  {
    title: 'A. Hoje',
    phone: home({ caption: 'Santana: 1 de 12 lugares', fraction: 1 / 12, centrar: 'today' }),
    notes: ['Branco com sombra e texto azul: o segundo objeto mais visível no fundo do ecrã.'],
  },
  {
    title: 'B. Mais discreto, no mesmo sítio',
    phone: home({ caption: 'Santana: 1 de 12 lugares', fraction: 1 / 12, centrar: 'quiet' }),
    notes: [
      'Plano, cinzento, sem sombra, da mesma família da linha de progresso.',
      'Mais pequeno à vista; a área de toque continua a ter 60 dp.',
    ],
  },
  {
    title: 'C. Pequeno, à direita',
    phone: home({ caption: 'Santana: 1 de 12 lugares', fraction: 1 / 12, centrar: 'corner' }),
    notes: [
      'Onde a maioria das aplicações de mapas o põe.',
      'Sai do meio, e o carimbo fica sozinho à esquerda.',
    ],
  },
];

const MAP_OPTIONS = [
  {
    title: 'A. Hoje: quatro estilos',
    phone: MAP_A,
    notes: [
      'Círculo branco (Definições), carimbo inclinado (passaporte), pílula branca mais baixa (Centrar), barra verde (Começar passeio).',
      'Mais a faixa de progresso, que é um quinto objeto a flutuar.',
    ],
  },
  {
    title: 'B. À WalkNYC: tudo verde',
    phone: MAP_B,
    notes: [
      'Todos os botões na cor da marca, com a mesma altura de 60.',
      'Fica coerente, mas o verde passa a estar em três sítios e o botão principal destaca-se menos.',
      'O carimbo fica como está: é o passaporte, não um botão (D-083).',
    ],
  },
  {
    title: 'C. Um só painel em baixo',
    phone: MAP_C,
    notes: [
      'Tudo o que é da viagem num painel branco: o carimbo, o progresso e o botão principal.',
      'Por cima do mapa ficam só dois botões brancos iguais: Definições e Centrar (quando é preciso).',
      'Menos objetos soltos: três em vez de cinco. Tapa um pouco mais de mapa em baixo.',
    ],
  },
];

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const board = (heading, question, options) => `<section>
  <h2>${heading}</h2><p class="q">${question}</p>
  <div class="options">${options
    .map((o) => `<figure>${o.phone}<figcaption><h3>${o.title}</h3><ul>${o.notes.map((n) => `<li>${n}</li>`).join('')}</ul></figcaption></figure>`)
    .join('')}</div></section>`;

const HEAD = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Bruma: opções de ecrã</title>
<style>
  body { margin: 0; padding: 32px; background: #e9e9ee; font-family: Roboto, "Segoe UI", Arial, sans-serif; color: #1c1c1e; }
  h1 { margin: 0 0 4px; font-size: 26px; } .lead { color: #5c5c63; margin: 0 0 24px; max-width: 900px; }
  section { margin-bottom: 48px; } h2 { margin: 0; font-size: 21px; } .q { color: #5c5c63; margin: 4px 0 16px; }
  .options { display: flex; gap: 28px; flex-wrap: wrap; } figure { margin: 0; width: 360px; }
  figcaption h3 { font-size: 16px; margin: 12px 0 4px; } figcaption ul { margin: 0; padding-left: 18px; color: #3a3a3f; font-size: 14px; line-height: 1.45; }
  .phone { position: relative; width: 360px; height: 780px; border-radius: 28px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,.18); }
  .page { padding: 20px 16px; }
  .nav { display: flex; justify-content: space-between; align-items: center; font-size: 17px; height: 44px; }
  .largetitle { color: ${album.text}; font-size: 34px; font-weight: 700; margin: 4px 0 8px; }
  .hero { text-align: center; padding: 16px 0; color: ${album.textMuted}; }
  .heronum { color: ${album.text}; font-size: 56px; font-weight: 800; } .heronum span { color: ${album.textMuted}; font-size: 28px; font-weight: 600; }
  .herolabel { font-size: 17px; margin-top: 4px; } .herolink { color: ${album.tint}; font-size: 17px; font-weight: 600; margin-top: 8px; }
  .rowhead { display: flex; justify-content: space-between; color: ${album.textMuted}; font-size: 14px; font-weight: 600; letter-spacing: .6px; margin: 16px 4px 8px; }
  .strip { display: flex; gap: 8px; padding: 12px 16px; border: 1px solid ${album.hairline}; border-radius: 16px; overflow: hidden; }
  .stamp { flex: none; display: flex; align-items: center; justify-content: center; }
  .scrim { position: absolute; inset: 0; background: ${colors.scrim}; }
  .sheetholder { position: absolute; left: 16px; right: 16px; bottom: 32px; }
  .sheet { border-radius: 20px; padding: 8px 16px 16px; box-shadow: 0 8px 24px rgba(0,0,0,.45); display: flex; flex-direction: column; gap: 4px; }
  .grab { width: 36px; height: 5px; border-radius: 3px; margin: 0 auto 8px; }
  .meta { font-size: 14px; font-weight: 700; letter-spacing: .5px; } .name { font-size: 22px; font-weight: 800; } .status { font-size: 14px; margin-top: 2px; }
  .stamprow { display: flex; align-items: center; gap: 16px; }
  .why { font-size: 17px; line-height: 1.35; margin: 6px 0 8px; } .region { font-size: 17px; } .distance { font-size: 14px; }
  .btn { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 60px; border-radius: 12px; font-size: 17px; font-weight: 700; margin-top: 8px; }
  .btn.small { min-height: 48px; font-size: 16px; } .btn.ghost { border: 1px solid; background: transparent; }
  .plain { min-height: 60px; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 600; }
  .card { border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .sumline { display: flex; align-items: baseline; gap: 8px; } .sumnum { color: ${album.text}; font-size: 44px; font-weight: 800; } .sumof { color: ${album.textMuted}; font-size: 17px; }
  .bar { height: 4px; border-radius: 2px; overflow: hidden; } .bar div { height: 100%; }
  .cats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
  .cat { display: flex; flex-direction: column; align-items: center; color: ${album.textMuted}; font-size: 11px; } .cat b { color: ${album.text}; font-size: 16px; }
  .cover { border: 1px solid; border-radius: 16px; padding: 20px 16px; text-align: center; }
  .covertop { color: ${album.textMuted}; font-size: 14px; font-weight: 700; letter-spacing: 2px; } .coverdates { color: ${album.text}; font-size: 17px; margin: 6px 0 14px; }
  .coverstats { display: flex; justify-content: space-around; } .coverstats div { display: flex; flex-direction: column; color: ${album.textMuted}; font-size: 13px; }
  .coverstats b { color: ${album.text}; font-size: 30px; font-weight: 800; } .coveractions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
  .map .ground { position: absolute; inset: 0; width: 100%; height: 100%; }
  .gear { position: absolute; top: 48px; left: 16px; width: 60px; height: 60px; border-radius: 30px; display: flex; align-items: center; justify-content: center; }
  .bottom { position: absolute; left: 16px; right: 16px; bottom: 32px; display: flex; flex-direction: column; gap: 8px; }
  .progress { border-radius: 16px; padding: 8px 16px; font-size: 14px; display: flex; flex-direction: column; gap: 6px; }
  .stamprowmap { display: flex; align-items: center; } .centre { flex: 1; display: flex; justify-content: center; }
  .pill.small { font-size: 14px; padding: 0 12px; }
  .pill { display: flex; align-items: center; gap: 4px; padding: 0 16px; border-radius: 30px; font-size: 17px; font-weight: 600; }
  .pill.floating { position: absolute; right: 16px; bottom: 236px; }
  .walk { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 60px; border-radius: 30px; color: #fff; font-size: 17px; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,.18); }
  .panel { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 24px 24px 0 0; padding: 12px 16px 32px; box-shadow: 0 -2px 12px rgba(0,0,0,.15); display: flex; flex-direction: column; gap: 10px; }
  .panelrow { display: flex; align-items: center; gap: 12px; } .panelinfo { flex: 1; display: flex; flex-direction: column; gap: 4px; }
</style></head><body>`;

const page = (lead, boards) => `${HEAD}
<h1>Bruma: opções de ecrã</h1>
<p class="lead">${lead}</p>
${boards}
</body></html>`;

const PAGES = [
  [
    'screen-options.html',
    page(
      'Desenhado com os carimbos, cores e tamanhos reais da aplicação. A de cada quadro é o que está hoje no telemóvel; as outras mudam só o que dizem. Diga a letra que prefere em cada um, ou o que misturar.',
      board('1. O cartão de um carimbo', '"A 39 km em linha reta" não ajuda numa ilha cheia de curvas, e a informação podia estar melhor apresentada.', CARD_OPTIONS) +
        board('2. O topo do passaporte', 'A informação podia estar melhor apresentada.', TOP_OPTIONS) +
        board('3. Os botões do mapa (T-220)', 'Uma só linguagem para os controlos. O fundo é simulado: o mapa real é o da Google.', MAP_OPTIONS)
    ),
  ],
  [
    'screen-options-2.html',
    page(
      'Segunda ronda, sobre o ecrã do mapa que escolheu (A, com a linha de progresso mais discreta). Os números são exemplos com 3 carimbos; todos são coisas que a aplicação já sabe calcular. O fundo é simulado.',
      board('4. O que diz a linha de progresso', 'Algo mais útil que "0 de 80 lugares".', LINE_OPTIONS) +
        board('5. O botão Centrar', 'Mais discreto, sem deixar de se encontrar.', CENTRAR_OPTIONS)
    ),
  ],
];

mkdirSync(path.join(here, 'out'), { recursive: true });
for (const [name, html] of PAGES) {
  writeFileSync(path.join(here, 'out', name), html, 'utf8');
  console.log(`Wrote tools/out/${name}`);
}
