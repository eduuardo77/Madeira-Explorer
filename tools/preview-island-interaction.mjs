/**
 * The passport's island, made usable (23 Nov 2026). The lead liked the island
 * mark beside the title in `passport-cover-final.html` and asked whether it
 * could show where the stamps are and which are lit. Sketch, not a build.
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-island-interaction.mjs
 *     → tools/out/island-interaction.html   (a clickable prototype, then each state as a still)
 *
 * The island is drawn by the app's own `passport/islandMapArt.ts`, the module
 * behind the unlock sheet's island page, fed the way `UnlockSheet` feeds it
 * (each municipality's largest polygon). Stamps through `stampSvg`.
 * 30 places as on the P30, 5 unlocked and 25 waiting (the "25 carimbos à tua
 * espera" of the unlock card); which places, and every date, are example values.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampSvg } from './lib/svg-render.mjs';
import { islandMap } from '../app/src/passport/islandMapArt.ts';
import { album, reward } from '../app/src/ui/theme.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(path.join(here, '..', 'content', name), 'utf8'));
const pack = read('pois.json');
const regions = read('regions.json');

const CAT = { viewpoint: 'Miradouro', levada: 'Levada', village: 'Aldeia', beach: 'Praia', landmark: 'Monumento' };
const regionName = new Map(regions.features.map((f) => [f.properties.id, f.properties.name]));

// Each municipality's largest polygon, as `regionPack.ts` gives `islandMap`.
const outlines = regions.features
  .filter((f) => f.properties.islandId === 'ilha-da-madeira')
  .map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    // ⚠ The Desertas (east of -16.62) are left out: in a first render one of
    // them was framed in and shrank Madeira to two thirds of the width.
    const rings = polys.map((p) => p[0]).filter((r) => Math.min(...r.map(([lon]) => lon)) < -16.62);
    if (rings.length === 0) return null;
    return { id: f.properties.id, outline: rings.reduce((a, b) => (b.length > a.length ? b : a)) };
  })
  .filter(Boolean);
const places = pack.places
  .filter((p) => p.regionId !== 'porto-santo')
  .map((p) => ({ id: p.id, regionId: p.regionId, lat: p.geofences[0].lat, lon: p.geofences[0].lon, name: p.name, category: p.category }));

// The sketch's 30, in the order they were collected; the first 5 unlocked.
const order = places.filter((_, i) => i % 3 !== 2).slice(0, 30).map((p) => p.id);
const visited = new Set(order);
const unlocked = new Set(order.slice(0, 5));
const MONTHS = ['out', 'nov'];
const dateOf = (id) => {
  const i = order.indexOf(id);
  const day = 14 + Math.floor(i / 2);
  return day <= 31 ? `${day} ${MONTHS[0]}` : `${day - 31} ${MONTHS[1]}`;
};
const state = (id) => (unlocked.has(id) ? 'open' : visited.has(id) ? 'waiting' : 'new');

const BIG = 344;
const big = islandMap(outlines, places, visited, BIG);
const small = islandMap(outlines, places, visited, 84);

// ── Drawing ────────────────────────────────────────────────────────────────
const LAND = '#2A2A2E', LAND_LIT = '#3A3424', COAST = '#48484A', GREY = '#6E6E76';
function dotSvg(d, opts = {}) {
  const s = state(d.id);
  const sel = opts.selected?.includes(d.id) ? `<circle cx="${d.x}" cy="${d.y}" r="10" fill="none" stroke="#FFF" stroke-width="2"/>` : '';
  if (s === 'open') return `<g class="dot open" data-id="${d.id}"><circle cx="${d.x}" cy="${d.y}" r="8" fill="${reward.gold}" opacity=".25"/><circle cx="${d.x}" cy="${d.y}" r="4.2" fill="${reward.gold}"/>${sel}</g>`;
  if (s === 'waiting') return `<g class="dot waiting" data-id="${d.id}"><circle cx="${d.x}" cy="${d.y}" r="3.6" fill="${album.background}" stroke="${reward.gold}" stroke-width="1.8"/>${sel}</g>`;
  return `<g class="dot new" data-id="${d.id}"><circle cx="${d.x}" cy="${d.y}" r="2.6" fill="${GREY}"/>${sel}</g>`;
}
function mapSvg(map, opts = {}) {
  const land = map.regions.map((r) => `<path d="${r.d}" fill="${r.lit ? LAND_LIT : LAND}" stroke="${COAST}" stroke-width="0.7"/>`).join('');
  const rank = { new: 0, waiting: 1, open: 2 };
  const dots = [...map.dots].sort((a, b) => rank[state(a.id)] - rank[state(b.id)]).map((d) => dotSvg(d, opts)).join('');
  return `<svg class="map" width="${map.width}" height="${map.height}" viewBox="0 0 ${map.width} ${map.height}">${land}${dots}</svg>`;
}
function markSvg(map) {
  const land = map.regions.map((r) => `<path d="${r.d}" fill="${album.surface}" stroke="#636366" stroke-width="0.6"/>`).join('');
  const dots = map.dots.filter((d) => d.visited).map((d) => `<circle cx="${d.x}" cy="${d.y}" r="1.3" fill="${reward.gold}"/>`).join('');
  return `<svg width="${map.width}" height="${map.height}" viewBox="0 0 ${map.width} ${map.height}">${land}${dots}</svg>`;
}

const byId = new Map(places.map((p) => [p.id, p]));
const stamp = (id, size, collected) => {
  const p = byId.get(id);
  return stampSvg(p.id, p.name, p.category, collected).replace('<svg ', `<svg width="${size}" height="${size}" `);
};
const PADLOCK = (size) => `<svg class="lock" width="${size}" height="${size}" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="12" rx="3" fill="#FFD45C" stroke="#7A5200" stroke-width="1.2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#FFD45C" stroke-width="2.6"/><circle cx="12" cy="16" r="1.8" fill="#7A5200"/></svg>`;
const stampFor = (id, size) => {
  const s = state(id);
  if (s === 'waiting') return `<span class="locked" style="width:${size}px;height:${size}px">${stamp(id, size, true)}${PADLOCK(size * 0.36)}</span>`;
  return stamp(id, size, s === 'open');
};

function card(id) {
  const p = byId.get(id);
  const s = state(id);
  const where = `${CAT[p.category]} · ${regionName.get(p.regionId)}`;
  const line = s === 'open' ? `Carimbado a ${dateOf(id)}` : s === 'waiting' ? `Estiveste aqui a ${dateOf(id)}. O carimbo está à tua espera.` : 'Ainda não estiveste aqui.';
  const btn = s === 'open' ? `<span class="cbtn">Ver carimbo</span>` : s === 'waiting' ? `<span class="cbtn gold">Desbloquear</span>` : `<span class="cbtn ghost">Ver no mapa</span>`;
  return `<div class="card"><div class="cst">${stampFor(id, 84)}</div><div class="ctx"><div class="cwhere">${where}</div><div class="cname">${p.name}</div><div class="cline">${line}</div>${btn}</div></div>`;
}
function clusterCard(ids) {
  const rows = ids.map((id) => {
    const s = state(id);
    const tag = s === 'open' ? `<i class="tg open">${dateOf(id)}</i>` : s === 'waiting' ? `<i class="tg waiting">à espera</i>` : `<i class="tg new">por visitar</i>`;
    return `<div class="lrow"><span class="lst">${stampFor(id, 40)}</span><span class="lname">${byId.get(id).name}</span>${tag}</div>`;
  }).join('');
  return `<div class="card list"><div class="lhead">${ids.length} lugares aqui · Funchal</div>${rows}</div>`;
}

const counts = { open: unlocked.size, waiting: visited.size - unlocked.size, new: places.length - visited.size };
const legend = `<div class="legend"><span><i class="lg open"></i>${counts.open} a cores</span><span><i class="lg waiting"></i>${counts.waiting} à tua espera</span><span><i class="lg new"></i>${counts.new} por visitar</span></div>`;

// The passport header, from passport-cover-final, with the live mark.
const nav = `<div class="nav"><span>‹ Mapa</span><span>Partilhar</span></div>`;
const track = `<div class="track">${[[5, 20], [0, 18], [9, 19], [6, 8], [10, 16]].map(([n, t]) => `<span style="flex:${t}"><i style="width:${(n / t) * 100}%"></i></span>`).join('')}</div>`;
const header = (tap = false) => `<div class="hd"><div class="titlerow"><h2>Passaporte</h2><button class="mark${tap ? ' tap' : ''}" aria-label="Abrir a ilha">${markSvg(small)}</button></div>
  <div class="stats"><div class="primary"><div class="num">30<span>/ 81</span></div><div class="lab">lugares visitados</div></div><div class="divider"></div>
  <div class="secondary"><b>412 km</b><span>estradas acesas</span><span>6 dias, 14 a 19 out</span></div><div class="play"><span class="playc">▶</span><span>Viagem</span></div></div>${track}</div>
  <div class="rowhead"><span class="rt">MIRADOUROS</span><span class="rc">5 de 20</span><span class="see">Ver tudo</span></div>
  <div class="panel">${['pico-do-areeiro', 'fanal', 'achada-do-teixeira', 'bica-da-cana'].map((id) => stamp(id, 74, unlocked.has(id))).join('')}</div>`;

const islandView = (body, opts = {}) => `<div class="iv"><div class="ivtop"><div><div class="ivt">Madeira</div><div class="ivs">30 de ${places.length} lugares</div></div><span class="x">✕</span></div>
  <div class="mapwrap">${mapSvg(big, opts)}</div>${legend}<div class="ivbody">${body}</div></div>`;
const hint = `<div class="hint">Toca num ponto para ver o carimbo.<br>Dois dedos para aproximar.</div>`;

// Funchal: the tight spot a finger cannot split.
const funchal = big.dots.filter((d) => byId.get(d.id).regionId === 'funchal');
const fx = funchal.reduce((s, d) => s + d.x, 0) / funchal.length, fy = funchal.reduce((s, d) => s + d.y, 0) / funchal.length;
const cluster = big.dots.filter((d) => Math.hypot(d.x - fx, d.y - fy) < 16).map((d) => d.id).slice(0, 5);
const pick = (s) => order.find((id) => state(id) === s && byId.get(id).regionId !== 'funchal') ?? places.find((p) => state(p.id) === s && p.regionId !== 'funchal').id;
const openId = pick('open'), waitId = pick('waiting'), newId = places.find((p) => state(p.id) === 'new' && p.category === 'levada').id;

const stills = [
  { name: '1. O passaporte', note: 'A ilha ao lado do título ganha pontos dourados, um por lugar onde estiveste. É pequena de propósito: um ponto aqui tem 2 px e não se acerta com o dedo. Toca-se na ilha inteira.', body: `${nav}<div class="scroll">${header(true)}</div>` },
  { name: '2. A ilha aberta', note: 'A ilha cresce do canto até à largura do ecrã. Os concelhos onde estiveste ficam mais quentes e os teus lugares acendem-se um a um, pela ordem em que os visitaste (no protótipo vê-se a animação). Três estados, os mesmos das filas: a cores, à tua espera, por visitar.', body: islandView(hint) },
  { name: '3. Um carimbo teu', note: 'Tocar num ponto dourado: o anel branco marca-o e o cartão de baixo mostra o carimbo a cores, onde é e quando o ganhaste. "Ver carimbo" abre o mesmo ecrã que tocar no carimbo da fila.', body: islandView(card(openId), { selected: [openId] }) },
  { name: '4. Um carimbo à espera', note: 'Um ponto com anel dourado: estiveste lá, mas o carimbo está fechado. O cartão mostra-o fosco com o cadeado e o botão dourado leva ao ecrã de desbloquear, aberto neste carimbo (como já faz a fila).', body: islandView(card(waitId), { selected: [waitId] }) },
  { name: '5. Um lugar por visitar', note: 'Um ponto cinzento: o carimbo em cinzento e "Ver no mapa", que fecha o passaporte e centra o mapa nesse lugar. A ilha passa a servir para escolher o próximo passeio.', body: islandView(card(newId), { selected: [newId] }) },
  { name: '6. Vários lugares juntos', note: 'No Funchal os pontos ficam a poucos píxeis uns dos outros. Um toque ali não adivinha: abre a lista dos lugares mais perto do dedo. Quem quiser pode aproximar com dois dedos.', body: islandView(clusterCard(cluster), { selected: cluster }) },
];

// ── The clickable prototype ────────────────────────────────────────────────
const cards = Object.fromEntries(places.map((p) => [p.id, card(p.id)]));
const PROTO_JS = `
const CARDS = ${JSON.stringify(cards)};
const DOTS = ${JSON.stringify(big.dots.map((d) => ({ id: d.id, x: d.x, y: d.y })))};
const ORDER = ${JSON.stringify(order)};
const CLUSTER_HTML = ${JSON.stringify(clusterCard(cluster))};
const proto = document.getElementById('proto');
const sheet = proto.querySelector('.ivwrap');
const body = sheet.querySelector('.ivbody');
const svg = sheet.querySelector('svg.map');
const HINT = body.innerHTML;
function select(ids) {
  svg.querySelectorAll('.selring').forEach((n) => n.remove());
  for (const id of ids) {
    const d = DOTS.find((x) => x.id === id);
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', d.x); c.setAttribute('cy', d.y); c.setAttribute('r', 10); c.setAttribute('class', 'selring');
    svg.appendChild(c);
  }
}
function light() {
  svg.querySelectorAll('.dot.open, .dot.waiting').forEach((g) => g.classList.add('unlit'));
  ORDER.forEach((id, i) => setTimeout(() => svg.querySelector('[data-id="' + id + '"]')?.classList.remove('unlit'), 380 + i * 55));
}
proto.querySelector('.mark').addEventListener('click', () => { body.innerHTML = HINT; select([]); sheet.classList.add('open'); light(); });
sheet.querySelector('.x').addEventListener('click', () => sheet.classList.remove('open'));
svg.addEventListener('click', (e) => {
  const r = svg.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const near = DOTS.map((d) => ({ d, k: Math.hypot(d.x - x, d.y - y) })).filter((o) => o.k < 16).sort((a, b) => a.k - b.k);
  if (near.length === 0) { body.innerHTML = HINT; select([]); return; }
  // A tap squarely on one dot opens it; only a tap that cannot tell two apart lists them.
  const square = near[0].k <= 5 && (near[1] ? near[1].k : 99) > near[0].k + 4;
  const close = square ? [near[0]] : near.filter((o) => o.k < near[0].k + 7);
  if (close.length > 1) {
    const ids = close.slice(0, 5).map((o) => o.d.id);
    body.innerHTML = '<div class="card list"><div class="lhead">' + ids.length + ' lugares aqui</div>' + ids.map((id) => '<div class="lrow pick" data-id="' + id + '">' + CARDS[id].match(/<div class="cname">(.*?)<\\/div>/)[1] + '</div>').join('') + '</div>';
    body.querySelectorAll('.pick').forEach((n) => n.addEventListener('click', () => { body.innerHTML = CARDS[n.dataset.id]; select([n.dataset.id]); }));
    select(ids);
  } else { body.innerHTML = CARDS[near[0].d.id]; select([near[0].d.id]); }
});
`;

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; padding: 40px 48px; background: #0B0B0D; color: #EDEDF0; font: 14px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; }
.head h1 { font-size: 26px; margin: 0 0 6px; } .head p { color: #9A9AA2; max-width: 900px; margin: 0 0 28px; }
.frames { display: flex; flex-wrap: wrap; gap: 36px 32px; }
figure { margin: 0; width: 360px; } figcaption { margin-top: 12px; color: #A8A8B0; font-size: 13px; } figcaption b { color: #FFF; display: block; font-size: 14px; margin-bottom: 2px; }
.phone { width: 360px; height: 780px; border-radius: 34px; background: ${album.background}; color: ${album.text}; overflow: hidden; position: relative; box-shadow: 0 0 0 1.5px #2E2E33, 0 24px 50px #0009; }
.nav { display: flex; justify-content: space-between; padding: 44px 16px 6px; color: ${album.tint}; font-size: 17px; }
.scroll { padding: 0 16px; }
.titlerow { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; } h2 { margin: 0; font-size: 34px; font-weight: 700; }
.mark { background: none; border: 0; padding: 6px; margin: -6px -6px -6px 0; border-radius: 12px; cursor: pointer; position: relative; }
.mark.tap::after { content: ''; position: absolute; inset: -2px; border-radius: 14px; border: 2px solid #FFFFFF55; }
.stats { display: flex; align-items: center; margin-top: 14px; } .primary { padding-right: 20px; } .num { font-size: 48px; line-height: 1; font-weight: 700; } .num span { font-size: 20px; color: ${album.textMuted}; margin-left: 4px; font-weight: 600; }
.lab { font-size: 13px; color: ${album.textMuted}; margin-top: 6px; } .divider { width: 1px; align-self: stretch; background: ${album.hairline}; }
.secondary { flex: 1; padding-left: 16px; display: flex; flex-direction: column; } .secondary b { font-size: 17px; } .secondary span { font-size: 12px; color: ${album.textMuted}; }
.play { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: ${album.tint}; } .playc { width: 44px; height: 44px; border-radius: 50%; background: ${album.action}; color: ${album.actionText}; display: flex; align-items: center; justify-content: center; font-size: 15px; }
.track { display: flex; gap: 3px; margin-top: 14px; height: 4px; } .track span { background: ${album.surface}; border-radius: 2px; overflow: hidden; } .track i { display: block; height: 100%; background: ${album.text}; }
.rowhead { display: flex; gap: 12px; margin-top: 22px; } .rt { flex: 1; color: ${album.textMuted}; letter-spacing: 1px; } .rc { color: ${album.textMuted}; } .see { color: ${album.tint}; }
.panel { display: flex; gap: 6px; border: 1px solid ${album.hairline}; border-radius: 16px; padding: 12px 8px; margin-top: 10px; overflow: hidden; }
.iv { position: absolute; inset: 0; background: ${album.background}; display: flex; flex-direction: column; }
.ivtop { display: flex; justify-content: space-between; align-items: flex-start; padding: 48px 16px 0; } .ivt { font-size: 28px; font-weight: 700; } .ivs { color: ${album.textMuted}; font-size: 14px; }
.x { width: 32px; height: 32px; border-radius: 50%; background: ${album.surface}; color: ${album.textMuted}; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; }
.mapwrap { padding: 28px 8px 0; } .map { display: block; cursor: pointer; }
.legend { display: flex; gap: 14px; padding: 14px 16px 0; font-size: 12px; color: ${album.textMuted}; } .legend span { display: flex; align-items: center; gap: 6px; }
.lg { width: 9px; height: 9px; border-radius: 50%; display: inline-block; } .lg.open { background: ${reward.gold}; } .lg.waiting { border: 1.8px solid ${reward.gold}; } .lg.new { background: #6E6E76; width: 6px; height: 6px; }
.ivbody { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 16px; }
.hint { text-align: center; color: ${album.textMuted}; font-size: 13px; margin-bottom: 40px; }
.card { background: ${album.surface}; border-radius: 18px; padding: 16px; display: flex; gap: 14px; align-items: center; margin-bottom: 8px; }
.ctx { flex: 1; } .cwhere { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: ${album.textMuted}; } .cname { font-size: 19px; font-weight: 700; line-height: 1.2; margin-top: 2px; }
.cline { font-size: 13px; color: ${album.textMuted}; margin-top: 4px; }
.cbtn { display: inline-block; margin-top: 10px; padding: 7px 14px; border-radius: 16px; font-weight: 700; font-size: 13px; background: ${album.action}; color: ${album.actionText}; }
.cbtn.gold { background: ${reward.goldButton}; color: #1C1C1E; } .cbtn.ghost { background: none; color: ${album.tint}; border: 1px solid #5AA9FF66; }
.locked { position: relative; display: inline-block; } .locked > svg:first-child { filter: blur(2.2px) saturate(.75); } .locked .lock { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.card.list { flex-direction: column; align-items: stretch; gap: 0; padding: 12px 16px; } .lhead { font-size: 12px; color: ${album.textMuted}; margin-bottom: 6px; }
.lrow { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-top: 1px solid ${album.hairline}; font-size: 15px; cursor: pointer; } .lrow:first-of-type { border-top: 0; }
.lname { flex: 1; } .tg { font-style: normal; font-size: 12px; } .tg.open { color: ${reward.goldInk}; } .tg.waiting { color: ${reward.goldInk}; opacity: .8; } .tg.new { color: ${album.textMuted}; }
.selring { fill: none; stroke: #FFF; stroke-width: 2; }
.dot { transition: opacity .25s, transform .35s; transform-box: fill-box; transform-origin: center; } .dot.unlit { opacity: 0; transform: scale(2.4); }
.ivwrap { position: absolute; inset: 0; transform-origin: 300px 98px; transform: scale(.22); opacity: 0; pointer-events: none; transition: transform .38s cubic-bezier(.2,.8,.2,1), opacity .2s; }
.ivwrap.open { transform: none; opacity: 1; pointer-events: auto; }
.protorow { display: flex; gap: 40px; align-items: flex-start; margin-bottom: 44px; } .protonote { max-width: 420px; color: #B4B4BC; font-size: 14px; } .protonote b { color: #FFF; } .protonote h3 { color: #FFF; margin: 0 0 8px; font-size: 16px; }
.protonote ul { padding-left: 18px; } .protonote li { margin-bottom: 6px; }
`;

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Passaporte: a ilha</title><style>${CSS}</style></head><body>
<div class="head"><h1>A ilha do passaporte</h1><p>A marca da ilha ao lado do título passa a abrir o mapa dos teus carimbos. Desenhada pelo mesmo código que já desenha a ilha no ecrã de desbloquear. 30 lugares como no P30, 5 a cores e 25 à espera; que lugares e as datas são de exemplo.</p></div>
<div class="protorow"><figure><div class="phone" id="proto">${nav}<div class="scroll">${header(false)}</div><div class="ivwrap">${islandView(hint)}</div></div><figcaption><b>Protótipo</b>Toca na ilha ao lado de "Passaporte". Depois toca nos pontos, e no Funchal.</figcaption></figure>
<div class="protonote"><h3>Como funciona</h3><ul>
<li><b>Abrir:</b> tocar na ilha pequena. A ilha cresce do canto e os teus lugares acendem-se pela ordem em que lá foste.</li>
<li><b>Os três estados</b> são os das filas de carimbos: <b>ponto dourado</b> a cores, <b>anel dourado</b> à tua espera (estiveste lá, falta desbloquear), <b>ponto cinzento</b> por visitar.</li>
<li><b>Os concelhos</b> onde estiveste ficam mais quentes, como no ecrã de desbloquear.</li>
<li><b>Tocar num ponto</b> mostra o cartão desse lugar. Cada estado tem a sua ação: ver o carimbo, desbloquear, ou ver no mapa.</li>
<li><b>Pontos juntos</b> (o Funchal) abrem uma lista em vez de adivinhar.</li>
<li><b>Fechar:</b> o X, ou deslizar para baixo.</li></ul>
<h3>O que ainda não está decidido</h3><ul>
<li>Se abre por cima de tudo (como aqui) ou se cresce dentro da página, empurrando as filas.</li>
<li>Se a barra branca de progresso fica, agora que a ilha também mostra o progresso.</li>
<li>Porto Santo: a sua página teria a sua ilha, com os mesmos estados.</li></ul></div></div>
<div class="frames">${stills.map((f) => `<figure><div class="phone">${f.body}</div><figcaption><b>${f.name}</b>${f.note}</figcaption></figure>`).join('')}</div>
<script>${PROTO_JS}</script></body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
writeFileSync(path.join(here, 'out', 'island-interaction.html'), html);
console.log('tools/out/island-interaction.html', { cluster, openId, waitId, newId, counts });
