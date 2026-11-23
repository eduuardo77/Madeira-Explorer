/**
 * The unlock sheet (the paywall): directions for the project lead (23 Nov 2026).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-paywall-options.mjs
 *     → tools/out/paywall-options.html   (round 1: six directions)
 *     → tools/out/paywall-carousel.html  (round 2: the lead liked A, B, D, E, F; one swipeable sheet)
 *
 * The lead: today's sheet "has too much information and is less visual". Each
 * frame is a phone at 360 x 780 dp, in Portuguese, with the app's real art:
 * stamps through `stampSvg`, the founder and set medals through `medalArt.ts`,
 * the island from `content/regions.json`. Colours are `reward`'s tokens.
 * Sketches of a direction, not of a build: the chosen one is built in
 * `UnlockSheetView` and checked on the P30.
 *
 * Every claim drawn is true of the app on 23 Nov: launch price until 28 Feb,
 * founder stamp until 21 Feb, one payment, Porto Santo included. No "50% off".
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { medalSvg, stampSvg } from './lib/svg-render.mjs';
import { founderElements, setMedalElements } from '../app/src/passport/medalArt.ts';
import { STRINGS } from '../app/src/i18n/strings.ts';
import { reward } from '../app/src/ui/theme.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(path.join(here, '..', 'content', name), 'utf8'));
const pack = read('pois.json');
const regions = read('regions.json');
const byId = new Map(pack.places.map((place) => [place.id, place]));

const PRICE = '2,99 €';
const LAUNCH = 'Preço de lançamento até 28 de fevereiro. Depois, o dobro.';
const WAITING = 25;
const VISITED = 30;

const sized = (svg, size) => svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
const stamp = (id, size) => {
  const place = byId.get(id);
  return sized(stampSvg(place.id, place.name, place.category, true), size);
};
const PADLOCK = (size) => `<svg class="lock" width="${size}" height="${size}" viewBox="0 0 24 24">
  <rect x="4" y="10" width="16" height="12" rx="3" fill="#FFD45C" stroke="#7A5200" stroke-width="1.2"/>
  <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#FFD45C" stroke-width="2.6"/>
  <circle cx="12" cy="16" r="1.8" fill="#7A5200"/></svg>`;
/** A stamp the user earned and has not paid to see: frosted colour, padlock (D-075). */
const locked = (id, size, lock = true) =>
  `<span class="locked" style="width:${size}px;height:${size}px">${stamp(id, size)}${lock ? PADLOCK(size * 0.34) : ''}</span>`;

const founder = medalSvg(founderElements({ title: STRINGS['medal.founder.title'].pt, destination: pack.destination ?? null, year: 2026 }));
const setMedal = (category, collected, total, look) =>
  medalSvg(
    setMedalElements({
      emblem: { kind: 'category', category },
      name: STRINGS[`passport.category.${category}`].pt,
      collected,
      total,
      look,
    })
  );

const X = `<div class="x" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 2 L14 14 M14 2 L2 14" stroke="${reward.textMuted}" stroke-width="2.2" stroke-linecap="round"/></svg></div>`;
const buy = (label = `Desbloquear o passaporte · ${PRICE}`, gold = false) =>
  `<div class="buy${gold ? ' gold' : ''}">${label}</div>`;
const notNow = `<div class="notnow">Agora não</div>`;
const launchPill = `<div class="pill">${LAUNCH}</div>`;

// ── The island, from the municipal outlines (Madeira only) ──────────────────
const madeira = regions.features.filter((f) => f.properties.islandId === 'ilha-da-madeira');
const rings = madeira.flatMap((f) =>
  (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((poly) => ({
    id: f.properties.id,
    ring: poly[0],
  }))
);
// Framed on the main island, not the outlines' extent: Santa Cruz's reaches the
// Desertas, which squashed the island into a corner (first render).
const main = rings.reduce((a, b) => (b.ring.length > a.ring.length ? b : a)) && rings;
const pts = main.flatMap((r) => r.ring).filter(([lon]) => lon < -16.62);
const lons = pts.map((p) => p[0]);
const lats = pts.map((p) => p[1]);
const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons) - 0.01, Math.max(...lons) + 0.01, Math.min(...lats) - 0.01, Math.max(...lats) + 0.01];
const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
function islandSvg(width, visitedIds, litRegions) {
  const scale = width / ((maxLon - minLon) * kx);
  const height = (maxLat - minLat) * scale;
  const xy = (lon, lat) => [((lon - minLon) * kx * scale).toFixed(1), ((maxLat - lat) * scale).toFixed(1)];
  const shapes = rings
    .map(({ id, ring }) => {
      const d = ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${xy(lon, lat).join(' ')}`).join('') + 'Z';
      return `<path d="${d}" fill="${litRegions.has(id) ? '#3A3020' : '#26232F'}" stroke="#4A4458" stroke-width="0.6"/>`;
    })
    .join('');
  const dots = pack.places
    .filter((p) => p.regionId !== 'porto-santo')
    .map((p) => {
      const [x, y] = xy(p.geofences[0].lon, p.geofences[0].lat);
      return visitedIds.has(p.id)
        ? `<circle cx="${x}" cy="${y}" r="6" fill="#FFD45C" opacity="0.25"/><circle cx="${x}" cy="${y}" r="3.2" fill="#FFD45C"/>`
        : `<circle cx="${x}" cy="${y}" r="2.4" fill="#6E6880"/>`;
    })
    .join('');
  return `<svg width="${width}" height="${height.toFixed(0)}" viewBox="0 0 ${width} ${height.toFixed(0)}" style="overflow:hidden">${shapes}${dots}</svg>`;
}
const madeiraPlaces = pack.places.filter((p) => p.regionId !== 'porto-santo');
// A plausible spread for the sketch: every other place in the west and south.
const visited = new Set(
  madeiraPlaces
    .filter((_, i) => i % 3 !== 2)
    .slice(0, VISITED)
    .map((p) => p.id)
);
const litRegions = new Set([...visited].map((id) => byId.get(id).regionId));

const MINE = ['fanal', 'cabo-girao', 'praia-formosa', 'pico-do-areeiro', 'porto-moniz', 'levada-das-25-fontes', 'camara-de-lobos', 'achada-do-teixeira', 'praia-da-calheta'];

// ── The frames ──────────────────────────────────────────────────────────────
const frames = [];

frames.push({
  name: 'Hoje',
  note: 'O que está no P30. Sete blocos de texto antes do botão: o título, a frase, cinco linhas da lista, o preço de lançamento. Os carimbos são pequenos e desfocados.',
  body: `<div class="scrim"><div class="card today">${X}
    <div class="eyebrow">O TEU PASSAPORTE</div>
    <div class="title">Tens 25 carimbos à tua espera</div>
    <div class="fan small">${MINE.slice(0, 5).map((id) => locked(id, 58, id === 'praia-formosa')).join('')}</div>
    <div class="lead">Já lá estiveste. Só falta vê-los.</div>
    <ul class="adds">
      <li>Todos os carimbos, nesta e nas próximas visitas</li><li>Todos os carimbos de Porto Santo</li>
      <li>Uma medalha por cada conjunto que completares</li><li>Um carimbo de fundador, por comprares nos primeiros três meses</li>
      <li>Pagamento único. Sem subscrição.</li></ul>
    <div class="launch">${LAUNCH}</div>${buy()}${notNow}</div></div>`,
});

frames.push({
  name: 'A. A revelação',
  note: 'Um carimbo teu, grande e já a cores, no centro; os outros à volta ainda foscos. O ecrã mostra o que se compra em vez de o descrever. O que se ganha passa a três ícones com uma palavra cada.',
  body: `<div class="full stage">${X}
    <div class="eyebrow top">O TEU PASSAPORTE</div>
    <div class="reveal">
      <div class="orbit">${['fanal', 'cabo-girao', 'pico-do-areeiro', 'porto-moniz', 'levada-das-25-fontes', 'camara-de-lobos']
        .map((id, i) => `<span class="o o${i}">${locked(id, 74, false)}</span>`)
        .join('')}</div>
      <div class="hero glow">${stamp('praia-formosa', 168)}</div>
    </div>
    <div class="title big">25 carimbos teus,<br>à espera de cor</div>
    <div class="chips">
      <div class="chip"><span class="ic">${stamp('achada-do-teixeira', 34)}</span>Todos os carimbos</div>
      <div class="chip"><span class="ic">${setMedal('levada', 18, 18, 'gold').replace('<svg ', '<svg width="34" height="34" ')}</span>Medalhas</div>
      <div class="chip"><span class="ic">${founder.replace('<svg ', '<svg width="34" height="34" ')}</span>Fundador</div>
    </div>
    <div class="bottom">${launchPill}${buy(`Ver os meus carimbos · ${PRICE}`, true)}<div class="fine">Pagamento único. Sem subscrição.</div></div></div>`,
});

frames.push({
  name: 'B. Antes e depois',
  note: 'Um só carimbo, cortado ao meio: metade fosca com cadeado, metade a cores. A ideia inteira numa imagem. Quase sem texto; o resto fica numa linha pequena por baixo do botão.',
  body: `<div class="full stage">${X}
    <div class="split">
      <div class="half left">${stamp('cabo-girao', 250)}</div>
      <div class="half right">${stamp('cabo-girao', 250)}</div>
      <div class="seam"></div>
      <div class="seam-knob">${PADLOCK(30)}</div>
    </div>
    <div class="place">Cabo Girão, um dos teus</div>
    <div class="title big">Já lá estiveste.<br>Agora vê-o a cores.</div>
    <div class="sub">E os outros 24 carimbos que já ganhaste.</div>
    <div class="bottom">${launchPill}${buy()}<div class="fine">Todos os carimbos, medalhas e o de fundador. Uma vez só.</div></div></div>`,
});

frames.push({
  name: 'C. A tua coleção',
  note: 'Folha que sobe do fundo, como as das lojas. Uma grelha com os teus carimbos foscos e um mosaico "+17": vê-se o tamanho do que espera. Título curto, nada mais acima do botão.',
  body: `<div class="scrim bottomed"><div class="sheet">${X}
    <div class="grab"></div>
    <div class="title">25 carimbos à tua espera</div>
    <div class="grid">${MINE.slice(0, 8).map((id) => `<div class="cell">${locked(id, 82, false)}</div>`).join('')}
      <div class="cell more">+17</div></div>
    <div class="ticks"><span>✓ Todos os carimbos</span><span>✓ Medalhas</span><span>✓ Porto Santo</span></div>
    ${launchPill}${buy()}${notNow}</div></div>`,
});

frames.push({
  name: 'D. A tua ilha',
  note: 'A Madeira desenhada pelos concelhos, com os sítios onde estiveste a dourado e o resto apagado. Fala do que a app é (onde estiveste), não do que falta. Os carimbos aparecem só como fila por baixo.',
  body: `<div class="full stage">${X}
    <div class="eyebrow top">O TEU PASSAPORTE DA MADEIRA</div>
    <div class="island">${islandSvg(330, visited, litRegions)}</div>
    <div class="stat"><b>${VISITED}</b> de ${madeiraPlaces.length} lugares</div>
    <div class="title big">Estiveste em ${VISITED} lugares.<br>Tens ${WAITING} carimbos por ver.</div>
    <div class="row">${MINE.slice(0, 5).map((id) => locked(id, 54, false)).join('')}</div>
    <div class="bottom">${launchPill}${buy(`Desbloquear a Madeira · ${PRICE}`)}${notNow}</div></div>`,
});

frames.push({
  name: 'E. Fundador',
  note: 'A medalha de fundador como herói: é a única coisa que nunca mais volta. A urgência é verdadeira (21 de fevereiro) e não precisa de desconto. Serve melhor como segundo ecrã ou para quem ainda não tem carimbos.',
  body: `<div class="full stage warm">${X}
    <div class="eyebrow top">SÓ ATÉ 21 DE FEVEREIRO</div>
    <div class="hero founder glow">${founder.replace('<svg ', '<svg width="210" height="210" ')}</div>
    <div class="title big">Sê um dos primeiros</div>
    <div class="sub">Quem desbloqueia o passaporte nos primeiros três meses fica com este carimbo para sempre. Depois, nunca mais.</div>
    <div class="row">${MINE.slice(0, 4).map((id) => locked(id, 54, false)).join('')}<span class="plus">+21</span></div>
    <div class="bottom">${launchPill}${buy(`Ficar com o passaporte · ${PRICE}`, true)}${notNow}</div></div>`,
});

frames.push({
  name: 'F. Os conjuntos',
  note: 'Para quem gosta de completar: as cinco medalhas dos conjuntos, cada uma com o seu progresso. Mostra que há um jogo para acabar. Mais abstrato que A ou B; talvez melhor depois de algumas visitas.',
  body: `<div class="full stage">${X}
    <div class="eyebrow top">O TEU PASSAPORTE</div>
    <div class="title big">Completa a Madeira</div>
    <div class="medals">
      ${[['viewpoint', 5, 20], ['levada', 0, 18], ['village', 9, 19], ['beach', 6, 8], ['landmark', 10, 16]]
        .map(
          ([c, n, t]) => `<div class="medal"><span class="m">${setMedal(c, n, t, n === t ? 'gold' : 'silver').replace('<svg ', '<svg width="74" height="74" ')}</span>
          <span class="mname">${STRINGS[`passport.category.${c}`].pt}</span><span class="bar"><i style="width:${Math.round((n / t) * 100)}%"></i></span><span class="mcount">${n} de ${t}</span></div>`
        )
        .join('')}
    </div>
    <div class="sub">Desbloqueia os teus ${WAITING} carimbos e ganha uma medalha por cada conjunto.</div>
    <div class="bottom">${launchPill}${buy()}${notNow}</div></div>`,
});

// ── The page ────────────────────────────────────────────────────────────────
const CSS = `
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; background: #0B0B0D; color: #eee; font: 14px/1.4 Roboto, "Segoe UI", system-ui, sans-serif; }
h1 { font-size: 20px; margin: 0 0 6px; } p.lead { margin: 0 0 22px; color: #aaa; max-width: 1180px; }
.frames { display: flex; flex-wrap: wrap; gap: 28px; }
figure { margin: 0; width: 360px; } figcaption { margin-top: 10px; color: #ccc; font-size: 13px; } figcaption b { color: #fff; font-size: 15px; display: block; margin-bottom: 3px; }
.phone { position: relative; width: 360px; height: 780px; overflow: hidden; border-radius: 30px; border: 1px solid #333;
  background: #1a1d22; }
.phone::before { content: ''; position: absolute; inset: 0; background:
  radial-gradient(circle at 30% 30%, #2d4a3a 0, transparent 40%), radial-gradient(circle at 70% 70%, #2b3d52 0, transparent 45%), #20252b; }
.scrim { position: absolute; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; padding: 18px; }
.scrim.bottomed { align-items: flex-end; padding: 0; }
.card { position: relative; width: 100%; border-radius: 22px; border: 1px solid ${reward.panelEdge}; padding: 22px 20px 6px;
  background: linear-gradient(170deg, ${reward.panelTop}, ${reward.panelBottom} 55%); text-align: center; }
.sheet { position: relative; width: 100%; border-radius: 26px 26px 0 0; padding: 10px 18px 8px; text-align: center;
  background: linear-gradient(175deg, ${reward.panelTop}, ${reward.panelBottom} 60%); border-top: 1px solid ${reward.panelEdge}; }
.grab { width: 40px; height: 4px; border-radius: 2px; background: #ffffff33; margin: 0 auto 14px; }
.full { position: absolute; inset: 0; padding: 54px 22px 18px; text-align: center; display: flex; flex-direction: column; align-items: center; }
.stage { background: radial-gradient(ellipse at 50% 28%, #3a2f55 0, ${reward.panelTop} 35%, ${reward.panelBottom} 75%); }
.stage.warm { background: radial-gradient(ellipse at 50% 30%, #4a3510 0, #2a2214 35%, ${reward.panelBottom} 75%); }
.x { position: absolute; top: 12px; right: 12px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; z-index: 3; }
.full .x { top: 38px; }
.eyebrow { color: ${reward.goldInk}; font-weight: 700; letter-spacing: 1.6px; font-size: 12px; }
.eyebrow.top { margin-bottom: 8px; }
.title { color: ${reward.text}; font-weight: 800; font-size: 22px; line-height: 1.2; margin-top: 4px; }
.title.big { font-size: 25px; margin-top: 14px; }
.sub { color: ${reward.textMuted}; font-size: 14.5px; margin-top: 8px; max-width: 300px; }
.lead { color: ${reward.text}; font-size: 13.5px; }
.adds { list-style: none; padding: 0; margin: 10px 0 0; text-align: left; }
.adds li { color: ${reward.textMuted}; font-size: 12.5px; padding-left: 20px; position: relative; margin: 5px 0; }
.adds li::before { content: '✓'; color: ${reward.tick}; position: absolute; left: 0; font-weight: 700; }
.launch { color: ${reward.text}; font-weight: 700; font-size: 12.5px; margin-top: 12px; }
.pill { color: ${reward.goldInk}; background: #FFD45C14; border: 1px solid #FFD45C40; border-radius: 999px; font-size: 11.5px; font-weight: 600; padding: 6px 12px; margin: 10px auto 0; display: inline-block; }
.buy { margin-top: 10px; background: ${reward.action}; color: ${reward.actionText}; font-weight: 800; font-size: 15.5px; border-radius: 14px; padding: 16px 12px; width: 100%; }
.buy.gold { background: linear-gradient(180deg, ${reward.gold}, ${reward.goldDeep}); color: ${reward.goldButtonText}; box-shadow: 0 6px 24px #E59A0055; }
.notnow { color: ${reward.textMuted}; font-size: 14px; padding: 12px 0 6px; }
.fine { color: #8E8E93; font-size: 11.5px; margin-top: 8px; }
.bottom { margin-top: auto; width: 100%; }
.locked { position: relative; display: inline-flex; align-items: center; justify-content: center; }
.locked > svg:first-child { filter: blur(2.6px) saturate(0.55) brightness(0.85); }
.locked .lock { position: absolute; }
.fan { display: flex; justify-content: center; margin: 8px 0; } .fan .locked { margin: 0 -6px; }
.reveal { position: relative; width: 316px; height: 250px; margin-top: 4px; }
.orbit .o { position: absolute; opacity: 0.8; }
.o0 { left: 0; top: 18px; transform: rotate(-12deg); } .o1 { right: 0; top: 10px; transform: rotate(10deg); }
.o2 { left: 6px; top: 150px; transform: rotate(8deg); } .o3 { right: 4px; top: 156px; transform: rotate(-9deg); }
.o4 { left: 50px; top: -18px; transform: rotate(4deg) scale(0.8); } .o5 { right: 52px; top: 196px; transform: rotate(-4deg) scale(0.8); }
.hero { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-3deg); }
.hero.founder { position: static; transform: none; margin-top: 8px; }
.glow { filter: drop-shadow(0 0 22px #FFD45C66); }
.chips { display: flex; gap: 8px; margin-top: 16px; }
.chip { flex: 1; background: #ffffff0d; border: 1px solid #ffffff14; border-radius: 14px; padding: 9px 4px 8px; color: ${reward.text}; font-size: 11.5px; font-weight: 600; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.split { position: relative; width: 250px; height: 250px; margin-top: 18px; }
.half { position: absolute; inset: 0; } .half.left { clip-path: polygon(0 0, 55% 0, 45% 100%, 0 100%); filter: blur(3px) saturate(0.5) brightness(0.8); }
.half.right { clip-path: polygon(55% 0, 100% 0, 100% 100%, 45% 100%); filter: drop-shadow(0 0 18px #FFD45C55); }
.seam { position: absolute; left: 50%; top: -8px; bottom: -8px; width: 2px; background: #FFD45C; transform: translateX(-50%) rotate(5.7deg); box-shadow: 0 0 10px #FFD45C; }
.seam-knob { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; border-radius: 50%; background: ${reward.panelBottom}; border: 2px solid #FFD45C; display: flex; align-items: center; justify-content: center; }
.seam-knob .lock { position: static; }
.place { color: ${reward.goldInk}; font-size: 12.5px; margin-top: 16px; font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 6px 0; }
.cell { aspect-ratio: 1; border-radius: 16px; background: #ffffff08; display: flex; align-items: center; justify-content: center; }
.cell.more { color: ${reward.goldInk}; font-size: 26px; font-weight: 800; border: 1.5px dashed #FFD45C55; }
.ticks { display: flex; justify-content: center; gap: 12px; color: ${reward.textMuted}; font-size: 12px; margin-top: 14px; }
.ticks span { white-space: nowrap; }
.island { margin-top: 18px; filter: drop-shadow(0 6px 20px #00000088); }
.stat { color: ${reward.goldInk}; font-size: 13px; margin-top: 6px; } .stat b { font-size: 18px; }
.row { display: flex; gap: 6px; justify-content: center; align-items: center; margin-top: 16px; }
.plus { color: ${reward.goldInk}; font-weight: 800; font-size: 16px; margin-left: 4px; }
.medals { width: 100%; margin-top: 16px; display: flex; flex-direction: column; gap: 6px; }
.medal { display: grid; grid-template-columns: 50px 1fr auto; grid-template-rows: auto auto; align-items: center; column-gap: 10px; text-align: left; }
.medal .m { grid-row: span 2; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; }
.medal .m svg { width: 56px; height: 56px; }
.mname { color: ${reward.text}; font-weight: 700; font-size: 14px; } .mcount { color: ${reward.textMuted}; font-size: 12px; grid-row: 1; grid-column: 3; }
.bar { grid-column: 2 / span 2; height: 5px; border-radius: 3px; background: #ffffff18; overflow: hidden; } .bar i { display: block; height: 100%; background: ${reward.gold}; }
`;

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Paywall: ideias</title><style>${CSS}</style></head><body>
<h1>O ecrã de desbloquear: seis ideias</h1>
<p class="lead">Desenhado com os carimbos, medalhas e mapa verdadeiros da app, num telemóvel de 360 x 780 dp, em português. Todas mantêm o X, o preço do Google e a linha do preço de lançamento. Nenhuma diz "50%". Os números (30 lugares, 25 carimbos) são os do P30 hoje.</p>
<div class="frames">${frames
  .map((f) => `<figure><div class="phone">${f.body}</div><figcaption><b>${f.name}</b>${f.note}</figcaption></figure>`)
  .join('')}</div></body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
writeFileSync(path.join(here, 'out', 'paywall-options.html'), html);
console.log('tools/out/paywall-options.html');

// ── Round 2: one sheet, swiped (the lead, 23 Nov) ───────────────────────────
// The bottom never moves: price line, button, "Agora não". The pages above it
// are the round-1 favourites, one picture and one line each. Page 1 is B when
// the sheet opened from a tapped stamp, A otherwise; Founder only while its
// window is open.
const pagesShown = (index, count) =>
  `<div class="dots">${Array.from({ length: count }, (_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</div>`;
const fixedBottom = (index, count, label = `Desbloquear o passaporte · ${PRICE}`) =>
  `<div class="fixed">${pagesShown(index, count)}${launchPill}${buy(label, true)}${notNow}</div>`;
const page = (index, count, hero) =>
  `<div class="full stage">${X}<div class="eyebrow top">O TEU PASSAPORTE</div><div class="pagebody">${hero}</div>${fixedBottom(index, count)}</div>`;
const COUNT = 4;

const carousel = [
  {
    name: '1. Os teus carimbos (aberto no passaporte)',
    note: 'A primeira página quando o ecrã abre do cartão do passaporte: o carimbo do centro a cores, os teus à volta foscos. Uma frase.',
    body: page(0, COUNT, `
      <div class="reveal compact">
        <div class="orbit">${['fanal', 'cabo-girao', 'pico-do-areeiro', 'porto-moniz', 'levada-das-25-fontes', 'camara-de-lobos']
          .map((id, i) => `<span class="o o${i}">${locked(id, 66, false)}</span>`)
          .join('')}</div>
        <div class="hero glow">${stamp('praia-formosa', 150)}</div>
      </div>
      <div class="title big">25 carimbos teus,<br>à espera de cor</div>`),
  },
  {
    name: '1. Os teus carimbos (aberto num carimbo)',
    note: 'A mesma página quando o ecrã abre de um carimbo fosco que tocaste: esse carimbo, meio fosco e meio a cores. As outras páginas são iguais.',
    body: page(0, COUNT, `
      <div class="split compact">
        <div class="half left">${stamp('cabo-girao', 250)}</div>
        <div class="half right">${stamp('cabo-girao', 250)}</div>
        <div class="seam"></div><div class="seam-knob">${PADLOCK(28)}</div>
      </div>
      <div class="title big">Cabo Girão, a cores.<br>E mais 24.</div>`),
  },
  {
    name: '2. A tua ilha',
    note: 'O mapa dos concelhos, os teus lugares a dourado. Lembra que a app é sobre onde estiveste e que o passaporte é o álbum disso.',
    body: page(1, COUNT, `
      <div class="island">${islandSvg(330, visited, litRegions)}</div>
      <div class="stat"><b>${VISITED}</b> de ${madeiraPlaces.length} lugares</div>
      <div class="title big">Cada lugar onde estiveste<br>tem o seu carimbo</div>
      <div class="sub">Porto Santo incluído, quando lá fores.</div>`),
  },
  {
    name: '3. Os conjuntos',
    note: 'As cinco medalhas com o teu progresso. Mostra que há um jogo para acabar.',
    body: page(2, COUNT, `
      <div class="medals compact">
        ${[['viewpoint', 5, 20], ['levada', 0, 18], ['village', 9, 19], ['beach', 6, 8], ['landmark', 10, 16]]
          .map(
            ([c, n, t]) => `<div class="medal"><span class="m">${setMedal(c, n, t, 'silver').replace('<svg ', '<svg width="74" height="74" ')}</span>
            <span class="mname">${STRINGS[`passport.category.${c}`].pt}</span><span class="bar"><i style="width:${Math.round((n / t) * 100)}%"></i></span><span class="mcount">${n} de ${t}</span></div>`
          )
          .join('')}
      </div>
      <div class="title big">Uma medalha por<br>cada conjunto</div>`),
  },
  {
    name: '4. Fundador (só até 21 de fevereiro)',
    note: 'Só aparece enquanto a janela de fundador está aberta; depois o carrossel fica com três páginas e os pontos passam a três sozinhos.',
    body: page(3, COUNT, `
      <div class="hero founder glow">${founder.replace('<svg ', '<svg width="200" height="200" ')}</div>
      <div class="title big">Carimbo de fundador,<br>só até 21 de fevereiro</div>
      <div class="sub">Para quem desbloqueia nos primeiros três meses. Depois, nunca mais.</div>`),
  },
];

const CAROUSEL_CSS = `
.pagebody { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; padding-bottom: 12px; }
.fixed { width: 100%; }
.dots { display: flex; gap: 7px; justify-content: center; margin-bottom: 4px; }
.dots i { width: 7px; height: 7px; border-radius: 50%; background: #ffffff33; } .dots i.on { width: 20px; border-radius: 4px; background: ${reward.goldInk}; }
.reveal.compact { height: 290px; } .reveal.compact .hero svg { width: 180px; height: 180px; } .split.compact { width: 250px; height: 250px; margin-top: 0; }
.medals.compact { gap: 10px; margin-top: 0; } .medals.compact .medal .m svg { width: 58px; height: 58px; }
.swipe { position: absolute; top: 46%; color: #ffffff55; font-size: 26px; } .swipe.l { left: 6px; } .swipe.r { right: 6px; }
`;
const carouselHtml = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Paywall: carrossel</title><style>${CSS}${CAROUSEL_CSS}</style></head><body>
<h1>O ecrã de desbloquear, deslizável</h1>
<p class="lead">Ronda 2. As favoritas da ronda 1 (A, B, D, E, F) como páginas de um só ecrã. O fundo não se mexe: os pontos, o preço de lançamento, o botão e "Agora não". Cada página tem uma imagem e uma frase. A primeira muda conforme de onde se abriu o ecrã.</p>
<div class="frames">${carousel
  .map((f) => `<figure><div class="phone">${f.body}</div><figcaption><b>${f.name}</b>${f.note}</figcaption></figure>`)
  .join('')}</div></body></html>`;
writeFileSync(path.join(here, 'out', 'paywall-carousel.html'), carouselHtml);
console.log('tools/out/paywall-carousel.html');
