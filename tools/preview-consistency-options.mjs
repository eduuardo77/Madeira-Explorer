/**
 * "Light map, dark passport, purple paywall": today's three screens beside
 * four directions that make them read as one app, for the project lead to
 * look at before choosing anything (30 Oct review, Visual consistency).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-consistency-options.mjs
 *     → tools/out/consistency-options.html
 *
 * Nothing in the app changes. The map is the P30's own screenshot; the
 * passport and the paywall are phone-sized sketches in HTML with the real
 * stamp drawings (`stampSvgWithDesign`) and the catalogue's Portuguese copy.
 * Every ink each direction proposes is measured here against the ground it
 * sits on, and the stamps' paper against each page (the D-080 floor, 3:1).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampSvgWithDesign } from './lib/svg-render.mjs';
import { designFor, UNCOLLECTED } from '../app/src/passport/stampArt.ts';
import { CATEGORIES } from '../app/src/content/contentPack.ts';
import { contrastRatio } from '../app/src/ui/contrast.ts';
import { album, colors, reward } from '../app/src/ui/theme.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(readFileSync(path.join(here, '..', 'content', 'pois.json'), 'utf8'));
const byId = new Map(pack.places.map((place) => [place.id, place]));
const mapShot = `data:image/png;base64,${readFileSync(path.join(here, 'out', 'a6-pins-p30.png')).toString('base64')}`;

function stamp(id, collected = true) {
  const place = byId.get(id);
  if (place === undefined) throw new Error(`no place ${id}`);
  return stampSvgWithDesign(place.id, designFor(place.id, place.category, place.motif), place.name, collected);
}

/** Every colourway's paper, as the contrast test collects them. */
const papers = (() => {
  const seen = new Map();
  for (const category of CATEGORIES) {
    for (let i = 0; i < 400; i += 1) {
      const { colourway } = designFor(`probe-${i}`, category);
      seen.set(JSON.stringify(colourway), colourway.paper);
    }
  }
  return [...seen.values()];
})();

const PADLOCK = `<svg class="padlock" viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 9.6-2" fill="none" stroke="#E59A00" stroke-width="2.6" stroke-linecap="round"/><rect x="4" y="10" width="16" height="12" rx="3" fill="#FFD45C" stroke="#E59A00" stroke-width="1.2"/><rect x="11" y="14" width="2" height="4" rx="1" fill="#8A5A00"/></svg>`;

/** One cell of a passport row: collected, locked (frosted, padlock) or not yet visited. */
function cell(id, state, o) {
  const art = stamp(id, state !== 'unvisited');
  const inner = state === 'locked' ? `<div class="frost">${art}</div>${PADLOCK}` : art;
  return `<div class="cell ${o.mounts ? 'mount' : ''}">${inner}</div>`;
}

const ROWS = [
  { label: 'ALDEIAS', count: '11 de 19', cells: [['camara-de-lobos', 'collected'], ['camacha', 'locked'], ['canical', 'unvisited']] },
  { label: 'PRAIAS', count: '3 de 8', cells: [['praia-formosa', 'collected'], ['prainha', 'locked'], ['praia-da-calheta', 'unvisited']] },
  { label: 'LEVADAS', count: '0 de 18', cells: [['levada-do-furado', 'unvisited'], ['levada-das-25-fontes', 'unvisited'], ['levada-do-norte', 'unvisited']] },
];

function passport(o) {
  const rows = ROWS.map(
    (row) => `<div class="sec"><span class="lbl">${row.label}</span><span class="cnt">${row.count}</span><span class="link">Ver tudo</span></div>
      <div class="strip">${row.cells.map(([id, state]) => cell(id, state, o)).join('')}</div>`
  ).join('');
  return `<div class="pp">
    <div class="bar"><span class="link">‹ Mapa</span><span class="link">Partilhar</span></div>
    <div class="hero"><div class="kicker">O TEU PASSAPORTE</div><div class="big">26 <small>de 81 lugares</small></div></div>
    <div class="nudge"><span><b>21 carimbos</b> à tua espera</span><span class="nudge-go">Ver</span></div>
    ${rows}
  </div>`;
}

function paywall(o) {
  const stack = ['camacha', 'prainha', 'cabo-girao', 'fanal']
    .map((id, i) => `<div class="st st${i}"><div class="frost">${stamp(id)}</div></div>`)
    .join('');
  const ticks = [
    'Todos os carimbos, nesta e nas próximas visitas',
    'Todos os carimbos de Porto Santo',
    'Uma medalha por cada conjunto que completares',
    'Pagamento único. Sem subscrição.',
  ].map((t) => `<li><span class="tick">✓</span>${t}</li>`).join('');
  return `<div class="pp under">${passport(o)}</div><div class="scrim"></div>
    <div class="sheet">
      <div class="eyebrow">O TEU PASSAPORTE</div>
      <div class="title">Tens 21 carimbos à tua espera</div>
      <div class="stack ${o.mounts ? 'mounted' : ''}">${stack}${PADLOCK}</div>
      <div class="lead">Já lá estiveste. Só falta vê-los.</div>
      <ul>${ticks}</ul>
      <div class="buy">Desbloquear o passaporte · 5,99 €</div>
      <div class="quiet">Agora não</div>
      <div class="quiet small">Recuperar compra</div>
    </div>`;
}

/**
 * The directions. `t` is every colour a frame uses; `checks` are the pairs
 * measured for the caption ([what, ink, ground, floor]).
 */
const OPTIONS = [
  {
    key: 'today',
    name: 'Hoje',
    blurb: 'Três fundos (mapa claro, passaporte quase preto, pop-up violeta) e quatro cores de destaque: verde no mapa, azul nas ligações, azul claro e verde no pop-up, dourado nas recompensas.',
    change: 'Nada.',
    cost: 'Nenhum.',
    t: {
      page: colors.stampPage, card: album.background, hairline: album.hairline, text: album.text, muted: album.textMuted,
      link: album.tint, nudgeBg: `linear-gradient(90deg, ${reward.nudgeFrom}, ${reward.panelTop})`, nudgeEdge: reward.nudgeEdge,
      sheet: `linear-gradient(180deg, ${reward.panelTop}, ${reward.panelBottom})`, sheetText: reward.text, sheetMuted: reward.textMuted,
      eyebrow: reward.goldInk, tick: reward.tick, buy: reward.action, buyText: reward.actionText, kicker: album.textMuted,
    },
  },
  {
    key: 'night',
    name: 'A · Uma só noite',
    blurb: 'O pop-up passa a ser feito do mesmo preto do passaporte; o violeta e o verde desaparecem. Regra nova: azul é para navegar, dourado é tudo o que se ganha ou se compra.',
    change: 'Três cores do pop-up e do cartão do passaporte. O mapa e os carimbos não mudam.',
    cost: 'Pequeno: umas horas, os testes de contraste já cobrem quase tudo.',
    t: {
      page: colors.stampPage, card: album.background, hairline: album.hairline, text: album.text, muted: album.textMuted,
      link: album.tint, nudgeBg: '#2A2414', nudgeEdge: reward.nudgeEdge,
      sheet: `linear-gradient(180deg, #2A2A2D, ${reward.panelBottom})`, sheetText: reward.text, sheetMuted: reward.textMuted,
      eyebrow: reward.goldInk, tick: reward.goldInk, buy: reward.goldButton, buyText: reward.goldButtonText, kicker: reward.goldInk,
    },
  },
  {
    key: 'cover',
    name: 'B · Capa de passaporte',
    blurb: 'O passaporte e o pop-up ganham a cor de um passaporte português: bordeaux escuro com letras douradas. O ecrã deixa de ser "modo escuro" e passa a ser o próprio objeto.',
    change: 'O fundo do passaporte, o pop-up e as celebrações; ligações e botões passam a dourado. O mapa não muda.',
    cost: 'Médio: um dia ou dois, mais medir de novo o contraste de cada carimbo e de cada texto.',
    t: {
      page: '#2A0E17', card: '#2A0E17', hairline: '#5A2A36', text: '#F5EBDD', muted: '#D2BFAE',
      link: '#F0C565', nudgeBg: '#3D1A22', nudgeEdge: '#F0C56566',
      sheet: 'linear-gradient(180deg, #3D1622, #220B12)', sheetText: '#F5EBDD', sheetMuted: '#D2BFAE',
      eyebrow: '#F0C565', tick: '#F0C565', buy: '#F0C565', buyText: '#2A0E17', kicker: '#F0C565', serif: true,
    },
  },
  {
    key: 'laurel',
    name: 'C · Laurissilva',
    blurb: 'Verde-floresta muito escuro no passaporte e no pop-up, a ligar ao botão verde "Começar passeio" do mapa e às levadas. Dourado continua a ser a recompensa.',
    change: 'O fundo do passaporte e do pop-up, as ligações passam a verde claro.',
    cost: 'Médio: como B, um dia ou dois com as medições.',
    t: {
      page: '#0F1F19', card: '#0F1F19', hairline: '#2C4A40', text: '#EEF3EF', muted: '#A9BDB4',
      link: '#7FD3A8', nudgeBg: '#22301A', nudgeEdge: reward.nudgeEdge,
      sheet: 'linear-gradient(180deg, #17332A, #0B1712)', sheetText: '#EEF3EF', sheetMuted: '#C3D3CB',
      eyebrow: reward.goldInk, tick: '#7FD3A8', buy: '#7FD3A8', buyText: '#0F1F19', kicker: '#7FD3A8',
    },
  },
  {
    key: 'light',
    name: 'D · Tudo claro, carimbos em moldura',
    blurb: 'O passaporte e o pop-up ficam claros como o resto da app. Como nenhum carimbo se lê num fundo claro (0 de 30 passam), cada um fica numa pequena moldura escura, como um selo num álbum.',
    change: 'O passaporte inteiro, o pop-up, as celebrações, a partilha. A maior mudança.',
    cost: 'Grande: vários dias, e perde-se o "álbum escuro" que escolheste a 28 de agosto.',
    mounts: true,
    t: {
      page: colors.background, card: colors.surface, hairline: '#D8D8DE', text: colors.text, muted: colors.textMuted,
      link: colors.tint, nudgeBg: '#FFF4D6', nudgeEdge: '#E59A0066',
      sheet: colors.surface, sheetText: colors.text, sheetMuted: colors.textMuted,
      eyebrow: colors.warn, tick: colors.good, buy: colors.tint, buyText: '#FFFFFF', kicker: colors.textMuted,
      mount: colors.stampPage,
    },
  },
];

/** Measured pairs for a direction's caption. */
function measurements(o) {
  const t = o.t;
  const solid = (fill) => (fill.startsWith('linear') ? fill.match(/#[0-9A-Fa-f]{6}/g) : [fill]);
  const ground = o.mounts ? t.mount : t.page;
  const paperWorst = Math.min(...papers.map((p) => contrastRatio(p, ground)));
  const pairs = [
    ['Papel dos carimbos', null, ground, 3, paperWorst],
    ['Contorno de um carimbo por visitar', UNCOLLECTED.border, ground, 3],
    ['Texto', t.text, t.page, 4.5],
    ['Texto secundário', t.muted, t.page, 4.5],
    ['Ligações', t.link, t.page, 4.5],
    ['Texto do pop-up', t.sheetText, null, 4.5],
    ['Linha dourada do pop-up', t.eyebrow, null, 4.5],
    ['Texto do botão de compra', t.buyText, t.buy, 4.5],
  ];
  return pairs.map(([what, ink, bg, floor, fixed]) => {
    const grounds = bg === null ? solid(t.sheet) : [bg];
    const ratio = fixed ?? Math.min(...grounds.map((g) => contrastRatio(ink, g)));
    return { what, ratio, floor, ok: ratio >= floor };
  });
}

function css(o) {
  const t = o.t;
  const s = `#${o.key}`;
  return `
${s} .pp { background: ${t.page}; color: ${t.text}; }
${s} .link { color: ${t.link}; }
${s} .kicker { color: ${t.kicker}; ${t.serif ? 'font-family: Georgia, serif; letter-spacing: .18em;' : ''} }
${s} .big { ${t.serif ? 'font-family: Georgia, serif;' : ''} }
${s} .big small, ${s} .cnt { color: ${t.muted}; }
${s} .lbl { color: ${t.muted}; }
${s} .strip { background: ${t.card}; border: 1px solid ${t.hairline}; }
${s} .nudge { background: ${t.nudgeBg}; border: 1px solid ${t.nudgeEdge}; color: ${t.text}; }
${s} .nudge-go { color: ${o.key === 'today' ? t.link : t.eyebrow}; }
${s} .mount { background: ${t.mount ?? 'transparent'}; }
${s} .sheet { background: ${t.sheet}; color: ${t.sheetText}; ${o.mounts ? 'box-shadow: 0 8px 30px #0004;' : 'border: 1px solid #FFFFFF1A;'} }
${s} .sheet .lead, ${s} .sheet li, ${s} .quiet { color: ${t.sheetMuted}; }
${s} .eyebrow { color: ${t.eyebrow}; ${t.serif ? 'font-family: Georgia, serif;' : ''} }
${s} .title { ${t.serif ? 'font-family: Georgia, serif;' : ''} }
${s} .tick { color: ${t.tick}; }
${s} .buy { background: ${t.buy}; color: ${t.buyText}; }
${s} .stack.mounted { background: ${t.mount}; }`;
}

function section(o) {
  const rows = measurements(o)
    .map((m) => `<tr class="${m.ok ? '' : 'fail'}"><td>${m.what}</td><td>${m.ratio.toFixed(2)}:1</td><td>${m.ok ? 'passa' : `abaixo de ${m.floor}:1`}</td></tr>`)
    .join('');
  return `<section id="${o.key}">
    <h2>${o.name}</h2>
    <p class="blurb">${o.blurb}</p>
    <div class="phones">
      <figure><div class="phone"><img src="${mapShot}" alt=""></div><figcaption>Mapa${o.key === 'today' ? ' (o P30, 31 out)' : ': igual'}</figcaption></figure>
      <figure><div class="phone">${passport(o)}</div><figcaption>Passaporte</figcaption></figure>
      <figure><div class="phone">${paywall(o)}</div><figcaption>Pop-up de compra</figcaption></figure>
      <div class="notes">
        <p><b>O que muda:</b> ${o.change}</p>
        <p><b>Esforço (estimativa minha):</b> ${o.cost}</p>
        <table><caption>Contraste medido</caption>${rows}</table>
      </div>
    </div>
  </section>`;
}

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Consistência visual: opções</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; background: #E9E9EE; color: #1C1C1E; font: 14px/1.4 Roboto, "Segoe UI", system-ui, sans-serif; }
h1 { font-size: 22px; margin: 0 0 4px; }
.intro { max-width: 900px; color: #444; margin: 0 0 8px; }
section { background: #fff; border-radius: 16px; padding: 18px 20px; margin: 18px 0; }
h2 { margin: 0 0 4px; font-size: 18px; }
.blurb { margin: 0 0 12px; max-width: 900px; color: #333; }
.phones { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
figure { margin: 0; }
figcaption { text-align: center; font-size: 12px; color: #666; margin-top: 6px; }
.phone { width: 270px; height: 585px; border-radius: 26px; overflow: hidden; position: relative; border: 6px solid #111; background: #111; }
.phone img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pp { position: absolute; inset: 0; padding: 10px 12px; overflow: hidden; }
.bar { display: flex; justify-content: space-between; font-size: 14px; padding: 2px 2px 8px; }
.hero { padding: 4px 2px 8px; }
.kicker { font-size: 10px; letter-spacing: .12em; font-weight: 600; }
.big { font-size: 34px; font-weight: 700; line-height: 1.1; }
.big small { font-size: 13px; font-weight: 400; }
.nudge { display: flex; justify-content: space-between; border-radius: 12px; padding: 9px 11px; font-size: 12px; margin-bottom: 8px; }
.nudge-go { font-weight: 600; }
.sec { display: flex; align-items: baseline; gap: 8px; font-size: 11px; letter-spacing: .06em; padding: 8px 2px 5px; }
.lbl { flex: 1; font-weight: 600; }
.sec .link { letter-spacing: 0; font-size: 12px; }
.strip { display: flex; justify-content: space-around; align-items: center; border-radius: 14px; padding: 8px 4px; }
.cell { width: 70px; height: 70px; position: relative; display: flex; align-items: center; justify-content: center; border-radius: 10px; }
.cell svg { width: 64px; height: 64px; }
.cell.mount { padding: 3px; }
.frost { filter: blur(2.4px); display: flex; }
.cell .padlock { position: absolute; width: 22px; height: 22px; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.under { filter: none; }
.scrim { position: absolute; inset: 0; background: #000A; }
.sheet { position: absolute; left: 12px; right: 12px; top: 34px; bottom: 26px; border-radius: 20px; padding: 16px 16px; text-align: center; }
.eyebrow { font-size: 10px; letter-spacing: .14em; font-weight: 700; }
.title { font-size: 19px; font-weight: 700; line-height: 1.2; margin: 4px 0 6px; }
.stack { position: relative; height: 74px; margin: 2px auto 4px; width: 190px; border-radius: 12px; }
.stack .st { position: absolute; top: 6px; }
.stack .st svg { width: 58px; height: 58px; }
.st0 { left: 8px; transform: rotate(-8deg); } .st1 { left: 50px; } .st2 { left: 92px; transform: rotate(5deg); } .st3 { left: 128px; transform: rotate(-3deg); }
.stack .padlock { position: absolute; width: 28px; height: 28px; left: 80px; top: 22px; }
.lead { font-size: 12px; margin: 2px 0 8px; }
ul { list-style: none; padding: 0; margin: 0 0 12px; text-align: left; font-size: 11.5px; }
li { display: flex; gap: 6px; margin: 3px 0; }
.tick { font-weight: 700; }
.buy { border-radius: 12px; padding: 11px 6px; font-weight: 700; font-size: 13px; }
.quiet { font-size: 12px; margin-top: 10px; }
.quiet.small { font-size: 11px; margin-top: 14px; }
.notes { flex: 1; min-width: 240px; max-width: 360px; font-size: 13px; }
.notes p { margin: 0 0 8px; }
table { border-collapse: collapse; font-size: 12px; width: 100%; }
caption { text-align: left; font-weight: 600; padding: 6px 0 4px; }
td { padding: 3px 6px 3px 0; border-top: 1px solid #eee; }
tr.fail td { color: #C0271E; font-weight: 600; }
${OPTIONS.map(css).join('\n')}
</style></head><body>
<h1>Mapa claro, passaporte escuro, pop-up violeta</h1>
<p class="intro">Hoje primeiro, depois quatro direções. O mapa é o mesmo em todas: é o produto, e as estradas acesas leem-se nele. Os carimbos são os desenhos reais e o texto é o da app. Os ecrãs do passaporte e do pop-up são esboços, não capturas. Cada contraste foi medido aqui; o mínimo é 4,5:1 para texto e 3:1 para o contorno de um carimbo.</p>
${OPTIONS.map(section).join('\n')}
</body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
const out = path.join(here, 'out', 'consistency-options.html');
writeFileSync(out, html);
for (const o of OPTIONS) {
  const failed = measurements(o).filter((m) => !m.ok).map((m) => `${m.what} ${m.ratio.toFixed(2)}`);
  console.log(`${o.key.padEnd(7)} ${failed.length === 0 ? 'all pass' : `below floor: ${failed.join('; ')}`}`);
}
console.log(out);
