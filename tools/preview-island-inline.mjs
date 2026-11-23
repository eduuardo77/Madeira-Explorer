/**
 * The passport's island, round 2 (23 Nov 2026): it grows inside the page,
 * pushing the stamp rows down, instead of opening over everything (the lead,
 * after `island-interaction.html`). Sketch, not a build.
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-island-inline.mjs
 *     → tools/out/island-inline.html   (a clickable prototype, then the states as stills)
 *
 * New in this round: a bubble on the map instead of a card under it, and the
 * white progress bar turning into five category filters while the island is
 * open. Same island code as the app (`passport/islandMapArt.ts`), same example
 * data as round 1: 30 visited, 5 unlocked, 25 waiting; places and dates invented.
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
const CATS = { viewpoint: 'Miradouros', levada: 'Levadas', village: 'Aldeias', beach: 'Praias', landmark: 'Monumentos' };
const ORDER = ['viewpoint', 'levada', 'village', 'beach', 'landmark'];
const regionName = new Map(regions.features.map((f) => [f.properties.id, f.properties.name]));
const outlines = regions.features
  .filter((f) => f.properties.islandId === 'ilha-da-madeira')
  .map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    // The app picks by area (`regionPack.ts`); by longitude here is the same answer.
    const rings = polys.map((p) => p[0]).filter((r) => Math.min(...r.map(([lon]) => lon)) < -16.62);
    return rings.length ? { id: f.properties.id, outline: rings.reduce((a, b) => (b.length > a.length ? b : a)) } : null;
  })
  .filter(Boolean);
const places = pack.places
  .filter((p) => p.regionId !== 'porto-santo')
  .map((p) => ({ id: p.id, regionId: p.regionId, lat: p.geofences[0].lat, lon: p.geofences[0].lon, name: p.name, category: p.category }));
const byId = new Map(places.map((p) => [p.id, p]));

const order = places.filter((_, i) => i % 3 !== 2).slice(0, 30).map((p) => p.id);
const visited = new Set(order);
const unlocked = new Set(order.slice(0, 5));
const dateOf = (id) => {
  const day = 14 + Math.floor(order.indexOf(id) / 2);
  return day <= 31 ? `${day} out` : `${day - 31} nov`;
};
const state = (id) => (unlocked.has(id) ? 'open' : visited.has(id) ? 'waiting' : 'new');
const sets = ORDER.map((c) => {
  const all = places.filter((p) => p.category === c);
  return [c, all.filter((p) => visited.has(p.id)).length, all.length];
});

const W = 328;
const big = islandMap(outlines, places, visited, W);
const small = islandMap(outlines, places, visited, 84);

// ── Drawing ────────────────────────────────────────────────────────────────
const LAND = '#2A2A2E', LAND_LIT = '#3A3424', COAST = '#48484A', GREY = '#6E6E76';
const dotSvg = (d) => {
  const s = state(d.id);
  const c = byId.get(d.id).category;
  if (s === 'open') return `<g class="dot open" data-id="${d.id}" data-c="${c}"><circle cx="${d.x}" cy="${d.y}" r="8" fill="${reward.gold}" opacity=".25"/><circle cx="${d.x}" cy="${d.y}" r="4.2" fill="${reward.gold}"/></g>`;
  if (s === 'waiting') return `<g class="dot waiting" data-id="${d.id}" data-c="${c}"><circle cx="${d.x}" cy="${d.y}" r="3.6" fill="${album.background}" stroke="${reward.gold}" stroke-width="1.8"/></g>`;
  return `<g class="dot new" data-id="${d.id}" data-c="${c}"><circle cx="${d.x}" cy="${d.y}" r="2.6" fill="${GREY}"/></g>`;
};
const rank = { new: 0, waiting: 1, open: 2 };
const mapSvg = (map, { selected = [], only = null } = {}) => {
  const land = map.regions.map((r) => `<path d="${r.d}" fill="${r.lit ? LAND_LIT : LAND}" stroke="${COAST}" stroke-width="0.7"/>`).join('');
  const dots = [...map.dots].sort((a, b) => rank[state(a.id)] - rank[state(b.id)]).map(dotSvg).join('');
  const rings = selected.map((id) => map.dots.find((d) => d.id === id)).map((d) => `<circle class="selring" cx="${d.x}" cy="${d.y}" r="10"/>`).join('');
  return `<svg class="map${only ? ` only-${only}` : ''}" width="${map.width}" height="${map.height}" viewBox="0 0 ${map.width} ${map.height}">${land}${dots}${rings}</svg>`;
};
const markSvg = (map) => {
  const land = map.regions.map((r) => `<path d="${r.d}" fill="${album.surface}" stroke="#636366" stroke-width="0.6"/>`).join('');
  const dots = map.dots.filter((d) => d.visited).map((d) => `<circle cx="${d.x}" cy="${d.y}" r="1.3" fill="${reward.gold}"/>`).join('');
  return `<svg width="${map.width}" height="${map.height}" viewBox="0 0 ${map.width} ${map.height}">${land}${dots}</svg>`;
};
const stamp = (id, size, collected) => {
  const p = byId.get(id);
  return stampSvg(p.id, p.name, p.category, collected).replace('<svg ', `<svg width="${size}" height="${size}" `);
};
const PADLOCK = (size) => `<svg class="lock" width="${size}" height="${size}" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="12" rx="3" fill="#FFD45C" stroke="#7A5200" stroke-width="1.2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#FFD45C" stroke-width="2.6"/><circle cx="12" cy="16" r="1.8" fill="#7A5200"/></svg>`;
const stampFor = (id, size) =>
  state(id) === 'waiting'
    ? `<span class="locked" style="width:${size}px;height:${size}px">${stamp(id, size, true)}${PADLOCK(size * 0.4)}</span>`
    : stamp(id, size, state(id) === 'open');
const lineFor = (id) => (state(id) === 'open' ? `Carimbado a ${dateOf(id)}` : state(id) === 'waiting' ? `À tua espera desde ${dateOf(id)}` : 'Ainda não estiveste aqui');
const actionFor = (id) => (state(id) === 'open' ? 'Ver carimbo' : state(id) === 'waiting' ? 'Desbloquear' : 'Ver no mapa');

/** A bubble pinned to its dot: above it, or below when the dot is near the top. */
function bubble(id) {
  const d = big.dots.find((x) => x.id === id);
  const p = byId.get(id);
  const BW = 226;
  const left = Math.max(0, Math.min(W - BW, d.x - BW / 2));
  const below = d.y < 70;
  const top = below ? d.y + 14 : d.y - 72;
  const tip = d.x - left;
  return `<div class="bubble${below ? ' below' : ''}" style="left:${left}px;top:${top}px;--tip:${tip}px">
    <span class="bst">${stampFor(id, 44)}</span><span class="btx"><b>${p.name}</b><i class="${state(id)}">${lineFor(id)}</i></span><span class="bchev">›</span></div>`;
}
function inlineCard(id) {
  const p = byId.get(id);
  const s = state(id);
  return `<div class="icard"><div>${stampFor(id, 72)}</div><div class="ictx"><div class="cwhere">${CAT[p.category]} · ${regionName.get(p.regionId)}</div><div class="cname">${p.name}</div><div class="cline">${lineFor(id)}</div>
    <span class="cbtn ${s}">${actionFor(id)}</span></div></div>`;
}

// ── The page ───────────────────────────────────────────────────────────────
const nav = `<div class="nav"><span>‹ Mapa</span><span>Partilhar</span></div>`;
const track = `<div class="track">${sets.map(([, n, t]) => `<span style="flex:${t}"><i style="width:${(n / t) * 100}%"></i></span>`).join('')}</div>`;
const chips = (active) => `<div class="chips">${sets.map(([c, n, t]) => `<span class="chip${active === c ? ' on' : ''}" data-c="${c}"><i style="--f:${(n / t) * 100}%"></i>${CATS[c]} <b>${n}/${t}</b></span>`).join('')}</div>`;
const legend = `<div class="legend"><span><i class="lg open"></i>5 a cores</span><span><i class="lg waiting"></i>25 à tua espera</span><span><i class="lg new"></i>51 por visitar</span></div>`;
// The rows count from the same visited set as the filters, so they agree.
const rowFor = (c) => {
  const [, n, t] = sets.find((x) => x[0] === c);
  const ids = places.filter((p) => p.category === c).sort((a, b) => rank[state(b.id)] - rank[state(a.id)]).slice(0, 4).map((p) => p.id);
  return `<div class="rowhead"><span class="rt">${CATS[c].toUpperCase()}</span><span class="rc">${n} de ${t}</span><span class="see">Ver tudo</span></div>
  <div class="panel">${ids.map((id) => `<span class="ps">${stampFor(id, 74)}</span>`).join('')}</div>`;
};
const rows = rowFor('viewpoint') + rowFor('levada');
const stats = `<div class="stats"><div class="primary"><div class="num">${visited.size}<span>/ ${places.length}</span></div><div class="lab">lugares visitados</div></div><div class="divider"></div>
  <div class="secondary"><b>412 km</b><span>estradas acesas</span><span>6 dias, 14 a 19 out</span></div><div class="play"><span class="playc">▶</span><span>Viagem</span></div></div>`;
const closeBtn = `<button class="mark close" aria-label="Fechar a ilha"><svg width="14" height="9" viewBox="0 0 14 9"><path d="M1 8l6-6 6 6" fill="none" stroke="${album.textMuted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;

/** opts: open, selected (id), only (category), card (true: card under the map instead of a bubble). */
function page(opts = {}) {
  const { open = false, selected = null, only = null, card = false, list = null } = opts;
  const head = `<div class="titlerow"><h2>Passaporte</h2>${open ? closeBtn : `<button class="mark" aria-label="Abrir a ilha">${markSvg(small)}</button>`}</div>${stats}`;
  if (!open) return `${nav}<div class="scroll">${head}${track}${rows}</div>`;
  const sel = list ?? (selected ? [selected] : []);
  const pop = selected && !card ? bubble(selected) : '';
  const listCard = list ? `<div class="lcard"><div class="lhead">${list.length} lugares aqui · Funchal</div>${list.map((id) => `<div class="lrow"><span>${stampFor(id, 34)}</span><span class="lname">${byId.get(id).name}</span><i class="tg ${state(id)}">${state(id) === 'open' ? dateOf(id) : state(id) === 'waiting' ? 'à espera' : 'por visitar'}</i></div>`).join('')}</div>` : '';
  return `${nav}<div class="scroll">${head}
    <div class="mapbox">${mapSvg(big, { selected: sel, only })}${pop}</div>
    ${only ? `<div class="filterline">${CATS[only]}: ${sets.find((s) => s[0] === only)[1]} de ${sets.find((s) => s[0] === only)[2]} · <u>mostrar todos</u></div>` : legend}
    ${chips(only)}${card && selected ? inlineCard(selected) : ''}${listCard}${rows}</div>`;
}

const pick = (s) => order.find((id) => state(id) === s && byId.get(id).regionId !== 'funchal');
const openId = pick('open'), waitId = pick('waiting');
const funchal = big.dots.filter((d) => byId.get(d.id).regionId === 'funchal');
const fx = funchal.reduce((s, d) => s + d.x, 0) / funchal.length, fy = funchal.reduce((s, d) => s + d.y, 0) / funchal.length;
const cluster = big.dots.filter((d) => Math.hypot(d.x - fx, d.y - fy) < 12).map((d) => d.id).slice(0, 4);

const stills = [
  { name: '1. Fechada', note: 'Como na proposta: a ilha pequena com os teus pontos dourados ao lado do título. Toca-se nela.', body: page() },
  { name: '2. Aberta, dentro da página', note: 'A ilha desce para baixo dos números, à largura da página, e as filas de carimbos descem com ela. A barra branca transforma-se em cinco filtros, um por categoria, cada um com o seu número: deixa de ser um enigma. No lugar da ilha pequena fica uma seta para fechar.', body: page({ open: true }) },
  { name: '3. Um ponto tocado: bolha', note: 'Uma bolha presa ao ponto, com o carimbo pequeno, o nome e o estado. Não empurra nada: as filas ficam onde estão. Tocar na bolha abre o carimbo (ou o desbloquear, ou o mapa).', body: page({ open: true, selected: waitId }) },
  { name: '4. Um ponto tocado: cartão', note: 'A alternativa à bolha, para comparar: um cartão por baixo dos filtros, com o carimbo maior e o botão à vista. Mais claro, mas empurra as filas mais uma vez e afasta o cartão do ponto.', body: page({ open: true, selected: openId, card: true }) },
  { name: '5. Só levadas', note: `Tocar num filtro apaga os outros pontos e deixa só essa categoria: aqui as ${sets[1][2]} levadas, ${sets[1][1]} tuas e ${sets[1][2] - sets[1][1]} por fazer, que se vê logo onde ficam. Tocar outra vez no filtro, ou em "mostrar todos", volta ao mapa inteiro. Os filtros deslizam para o lado.`, body: page({ open: true, only: 'levada' }) },
  { name: '6. Vários lugares juntos', note: 'No Funchal um toque não adivinha: aparece a lista dos lugares mais perto do dedo, dentro da página, por cima das filas.', body: page({ open: true, list: cluster }) },
];

// ── The prototype ──────────────────────────────────────────────────────────
const bubbles = Object.fromEntries(places.map((p) => [p.id, bubble(p.id)]));
const names = Object.fromEntries(places.map((p) => [p.id, [p.name, state(p.id), state(p.id) === 'open' ? dateOf(p.id) : state(p.id) === 'waiting' ? 'à espera' : 'por visitar']]));
const JS = `
const BUBBLES = ${JSON.stringify(bubbles)};
const NAMES = ${JSON.stringify(names)};
const DOTS = ${JSON.stringify(big.dots.map((d) => ({ id: d.id, x: d.x, y: d.y })))};
const ORDER = ${JSON.stringify(order)};
const proto = document.getElementById('proto');
const slot = proto.querySelector('.slot');
const svg = slot.querySelector('svg.map');
const box = slot.querySelector('.mapbox');
const extra = slot.querySelector('.extra');
const markOpen = proto.querySelector('.mark.opener'), markClose = proto.querySelector('.mark.close');
const trackEl = proto.querySelector('.track');
function clearSel() { svg.querySelectorAll('.selring').forEach((n) => n.remove()); box.querySelectorAll('.bubble').forEach((n) => n.remove()); extra.innerHTML = ''; }
function ring(id) { const d = DOTS.find((x) => x.id === id); const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('cx', d.x); c.setAttribute('cy', d.y); c.setAttribute('r', 10); c.setAttribute('class', 'selring'); svg.appendChild(c); }
function open() {
  slot.style.height = slot.scrollHeight + 'px'; slot.classList.add('open'); trackEl.classList.add('gone');
  markOpen.hidden = true; markClose.hidden = false;
  svg.querySelectorAll('.dot.open, .dot.waiting').forEach((g) => g.classList.add('unlit'));
  ORDER.forEach((id, i) => setTimeout(() => svg.querySelector('[data-id="' + id + '"]')?.classList.remove('unlit'), 420 + i * 55));
  setTimeout(() => { slot.style.height = 'auto'; }, 420);
}
function close() {
  slot.style.height = slot.scrollHeight + 'px'; requestAnimationFrame(() => { slot.style.height = '0px'; });
  slot.classList.remove('open'); trackEl.classList.remove('gone'); markOpen.hidden = false; markClose.hidden = true; clearSel(); filter(null);
}
function filter(c) {
  slot.querySelectorAll('.chip').forEach((n) => n.classList.toggle('on', n.dataset.c === c));
  svg.setAttribute('class', 'map' + (c ? ' only-' + c : ''));
  svg.dataset.only = c || '';
}
markOpen.addEventListener('click', open); markClose.addEventListener('click', close);
slot.querySelectorAll('.chip').forEach((n) => n.addEventListener('click', () => { clearSel(); filter(svg.dataset.only === n.dataset.c ? null : n.dataset.c); }));
svg.addEventListener('click', (e) => {
  const r = svg.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
  const only = svg.dataset.only;
  const near = DOTS.filter((d) => !only || svg.querySelector('[data-id="' + d.id + '"]').dataset.c === only)
    .map((d) => ({ d, k: Math.hypot(d.x - x, d.y - y) })).filter((o) => o.k < 16).sort((a, b) => a.k - b.k);
  clearSel();
  if (!near.length) return;
  const square = near[0].k <= 5 && (near[1] ? near[1].k : 99) > near[0].k + 4;
  const close = square ? [near[0]] : near.filter((o) => o.k < near[0].k + 7).slice(0, 5);
  if (close.length === 1) { ring(close[0].d.id); box.insertAdjacentHTML('beforeend', BUBBLES[close[0].d.id]); return; }
  close.forEach((o) => ring(o.d.id));
  extra.innerHTML = '<div class="lcard"><div class="lhead">' + close.length + ' lugares aqui</div>' + close.map((o) => { const [n, s, t] = NAMES[o.d.id]; return '<div class="lrow" data-id="' + o.d.id + '"><span class="lname">' + n + '</span><i class="tg ' + s + '">' + t + '</i></div>'; }).join('') + '</div>';
  extra.querySelectorAll('.lrow').forEach((n) => n.addEventListener('click', () => { const id = n.dataset.id; clearSel(); ring(id); box.insertAdjacentHTML('beforeend', BUBBLES[id]); }));
});
`;
const protoBody = `${nav}<div class="scroll"><div class="titlerow"><h2>Passaporte</h2><button class="mark opener" aria-label="Abrir a ilha">${markSvg(small)}</button>${closeBtn.replace('class="mark close"', 'class="mark close" hidden')}</div>${stats}${track}
  <div class="slot"><div class="mapbox">${mapSvg(big)}</div>${legend}${chips(null)}<div class="extra"></div></div>${rows}</div>`;

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; padding: 40px 48px; background: #0B0B0D; color: #EDEDF0; font: 14px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; }
.head h1 { font-size: 26px; margin: 0 0 6px; } .head p { color: #9A9AA2; max-width: 900px; margin: 0 0 28px; }
.frames { display: flex; flex-wrap: wrap; gap: 36px 32px; }
figure { margin: 0; width: 360px; } figcaption { margin-top: 12px; color: #A8A8B0; font-size: 13px; } figcaption b { color: #FFF; display: block; font-size: 14px; margin-bottom: 2px; }
.phone { width: 360px; height: 780px; border-radius: 34px; background: ${album.background}; color: ${album.text}; overflow: hidden; position: relative; box-shadow: 0 0 0 1.5px #2E2E33, 0 24px 50px #0009; }
.phone#proto { overflow-y: auto; scrollbar-width: none; }
.nav { display: flex; justify-content: space-between; padding: 44px 16px 6px; color: ${album.tint}; font-size: 17px; }
.scroll { padding: 0 16px 40px; }
.titlerow { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; min-height: 48px; } h2 { margin: 0; font-size: 34px; font-weight: 700; }
.mark { background: none; border: 0; padding: 6px; margin: -6px -6px -6px 0; border-radius: 12px; cursor: pointer; } .mark[hidden], .mark.close[hidden] { display: none; }
.mark.close { width: 36px; height: 36px; border-radius: 50%; background: ${album.surface}; display: flex; align-items: center; justify-content: center; margin: 0; }
.stats { display: flex; align-items: center; margin-top: 14px; } .primary { padding-right: 20px; } .num { font-size: 48px; line-height: 1; font-weight: 700; } .num span { font-size: 20px; color: ${album.textMuted}; margin-left: 4px; font-weight: 600; }
.lab { font-size: 13px; color: ${album.textMuted}; margin-top: 6px; } .divider { width: 1px; align-self: stretch; background: ${album.hairline}; }
.secondary { flex: 1; padding-left: 16px; display: flex; flex-direction: column; } .secondary b { font-size: 17px; } .secondary span { font-size: 12px; color: ${album.textMuted}; }
.play { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: ${album.tint}; } .playc { width: 44px; height: 44px; border-radius: 50%; background: ${album.action}; color: ${album.actionText}; display: flex; align-items: center; justify-content: center; font-size: 15px; }
.track { display: flex; gap: 3px; margin-top: 14px; height: 4px; transition: opacity .2s; } .track.gone { display: none; } .track span { background: ${album.surface}; border-radius: 2px; overflow: hidden; } .track i { display: block; height: 100%; background: ${album.text}; }
.slot { height: 0; overflow: hidden; transition: height .42s cubic-bezier(.2,.8,.2,1); }
.mapbox { position: relative; margin-top: 16px; } .map { display: block; cursor: pointer; }
.dot { transition: opacity .25s, transform .35s; transform-box: fill-box; transform-origin: center; } .dot.unlit { opacity: 0; transform: scale(2.4); }
${ORDER.map((c) => `.map.only-${c} .dot:not([data-c="${c}"]) { opacity: .12; }`).join(' ')}
.selring { fill: none; stroke: #FFF; stroke-width: 2; }
.legend { display: flex; gap: 14px; margin-top: 10px; font-size: 12px; color: ${album.textMuted}; } .legend span { display: flex; align-items: center; gap: 6px; }
.lg { width: 9px; height: 9px; border-radius: 50%; display: inline-block; } .lg.open { background: ${reward.gold}; } .lg.waiting { border: 1.8px solid ${reward.gold}; } .lg.new { background: ${GREY}; width: 6px; height: 6px; }
.filterline { margin-top: 10px; font-size: 12px; color: ${album.textMuted}; } .filterline u { color: ${album.tint}; text-decoration: none; }
.chips { display: flex; gap: 6px; margin: 12px -16px 0 0; padding-right: 24px; overflow-x: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, #000 85%, transparent); mask-image: linear-gradient(90deg, #000 85%, transparent); }
.chip { flex: 0 0 auto; position: relative; overflow: hidden; border: 1px solid ${album.hairline}; border-radius: 16px; padding: 5px 11px 7px; font-size: 13px; color: ${album.text}; cursor: pointer; white-space: nowrap; }
.chip b { font-weight: 600; color: ${album.textMuted}; margin-left: 2px; } .chip i { position: absolute; left: 0; bottom: 0; height: 2px; width: var(--f); background: ${album.text}; }
.chip.on { background: ${album.text}; color: ${album.actionText}; border-color: ${album.text}; } .chip.on b { color: #3A3A3C; } .chip.on i { background: ${album.actionText}; }
.bubble { position: absolute; width: 226px; display: flex; align-items: center; gap: 10px; background: #3A3A3C; border-radius: 14px; padding: 8px 10px; box-shadow: 0 8px 20px #000A; }
.bubble::after { content: ''; position: absolute; left: calc(var(--tip) - 7px); bottom: -7px; border: 7px solid transparent; border-bottom: 0; border-top-color: #3A3A3C; }
.bubble.below::after { bottom: auto; top: -7px; border: 7px solid transparent; border-top: 0; border-bottom-color: #3A3A3C; }
.btx { flex: 1; display: flex; flex-direction: column; line-height: 1.25; } .btx b { font-size: 14px; } .btx i { font-style: normal; font-size: 12px; color: ${album.textMuted}; } .btx i.open, .btx i.waiting { color: ${reward.goldInk}; }
.bchev { color: ${album.textMuted}; font-size: 22px; }
.locked { position: relative; display: inline-block; } .locked > svg:first-child { filter: blur(1.8px) saturate(.75); } .locked .lock { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.icard { display: flex; gap: 14px; align-items: center; background: ${album.surface}; border-radius: 16px; padding: 12px 14px; margin-top: 12px; }
.ictx { flex: 1; } .cwhere { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: ${album.textMuted}; } .cname { font-size: 17px; font-weight: 700; } .cline { font-size: 12px; color: ${album.textMuted}; }
.cbtn { display: inline-block; margin-top: 8px; padding: 6px 13px; border-radius: 15px; font-weight: 700; font-size: 13px; background: ${album.action}; color: ${album.actionText}; } .cbtn.waiting { background: ${reward.goldButton}; color: #1C1C1E; } .cbtn.new { background: none; color: ${album.tint}; border: 1px solid #5AA9FF66; }
.lcard { background: ${album.surface}; border-radius: 16px; padding: 10px 14px; margin-top: 12px; } .lhead { font-size: 12px; color: ${album.textMuted}; margin-bottom: 4px; }
.lrow { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid ${album.hairline}; font-size: 14px; cursor: pointer; } .lrow:first-of-type { border-top: 0; } .lname { flex: 1; }
.tg { font-style: normal; font-size: 12px; } .tg.open, .tg.waiting { color: ${reward.goldInk}; } .tg.new { color: ${album.textMuted}; }
.rowhead { display: flex; gap: 12px; margin-top: 22px; } .rt { flex: 1; color: ${album.textMuted}; letter-spacing: 1px; } .rc { color: ${album.textMuted}; } .see { color: ${album.tint}; }
.panel { display: flex; gap: 6px; border: 1px solid ${album.hairline}; border-radius: 16px; padding: 12px 8px; margin-top: 10px; overflow: hidden; }
.protorow { display: flex; gap: 40px; align-items: flex-start; margin-bottom: 44px; } .protonote { max-width: 440px; color: #B4B4BC; } .protonote h3 { color: #FFF; margin: 0 0 8px; font-size: 16px; } .protonote b { color: #FFF; } .protonote li { margin-bottom: 6px; } .protonote ul { padding-left: 18px; }
`;

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Passaporte: a ilha na página</title><style>${CSS}</style></head><body>
<div class="head"><h1>A ilha do passaporte, dentro da página</h1><p>Ronda 2. A ilha já não abre por cima de tudo: cresce no sítio, por baixo dos números, e empurra as filas de carimbos. Desenhada pelo código da app. 30 lugares como no P30, 5 a cores e 25 à espera; que lugares e as datas são de exemplo.</p></div>
<div class="protorow"><figure><div class="phone" id="proto">${protoBody}</div><figcaption><b>Protótipo</b>Toca na ilha pequena. Depois nos pontos, nos filtros e no Funchal. A seta fecha. A página desliza.</figcaption></figure>
<div class="protonote"><h3>O que muda desde a ronda 1</h3><ul>
<li><b>Cresce no sítio.</b> A página fica a mesma; a ilha abre-se entre os números e os carimbos, e fechar devolve tudo ao lugar.</li>
<li><b>A barra branca vira filtros.</b> Fechada é a barra fina da proposta; aberta, cada troço passa a um botão com o nome da categoria e o seu número, e um fio por baixo com o progresso. Resolve a dúvida da barra: quando a ilha está aberta, diz o que é.</li>
<li><b>Uma bolha em vez de um cartão.</b> Fica junto ao ponto e não empurra a página outra vez. O cartão está ao lado, no 4, para comparar.</li>
<li><b>Filtrar por categoria</b> mostra onde estão as que faltam, por exemplo as levadas por fazer.</li></ul>
<h3>Por decidir</h3><ul>
<li>Bolha ou cartão.</li>
<li>Se a ilha fica aberta da próxima vez que se abre o passaporte, ou se volta sempre fechada.</li>
<li>Se tocar num carimbo de uma fila, com a ilha aberta, deve marcar o seu ponto em vez de abrir o carimbo. Proponho que não: o toque no carimbo faz o que sempre fez.</li></ul></div></div>
<div class="frames">${stills.map((f) => `<figure><div class="phone">${f.body}</div><figcaption><b>${f.name}</b>${f.note}</figcaption></figure>`).join('')}</div>
<script>${JS}</script></body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
writeFileSync(path.join(here, 'out', 'island-inline.html'), html);
console.log('tools/out/island-inline.html', { openId, waitId, cluster });
