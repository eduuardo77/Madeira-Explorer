/**
 * The passport's island, round 3 (23 Nov 2026): the lead chose the bubble over
 * the card (`island-inline.html`) and asked to keep polishing. Sketch, not a build.
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-island-bubble.mjs
 *     → tools/out/island-bubble.html   (a clickable prototype, then the states as stills)
 *
 * Polish over round 2: the bubble says what a tap does, pops from its dot and
 * flips below when the dot is near the top; the chosen dot pulses; a cluster
 * is a bubble with a list, not a card; the small island flies into place as it
 * opens; tapping empty sea closes the bubble. Same island code as the app
 * (`passport/islandMapArt.ts`), same example data: 30 visited, 5 unlocked,
 * 25 waiting; which places and the dates are invented.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
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
regionName.set('porto-santo', 'Porto Santo');
/** Each municipality's largest polygon, as `regionPack.ts` gives `islandMap` (it picks by area). */
const area = (r) => Math.abs(r.reduce((s, [x0, y0], i) => { const [x1, y1] = r[(i + 1) % r.length]; return s + x0 * y1 - x1 * y0; }, 0));
const outlinesOf = (islandId) =>
  regions.features
    .filter((f) => f.properties.islandId === islandId)
    .map((f) => {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      return { id: f.properties.id, outline: polys.map((q) => q[0]).reduce((a, b) => (area(b) > area(a) ? b : a)) };
    });
const placesOf = (islandId) =>
  pack.places
    .filter((p) => (islandId === 'porto-santo') === (p.regionId === 'porto-santo'))
    .map((p) => ({ id: p.id, regionId: p.regionId, lat: p.geofences[0].lat, lon: p.geofences[0].lon, name: p.name, category: p.category }));

const W = 328;
let places, byId, order, visited, unlocked, fresh, sets, big, small;
/** Switches every drawing below to one island and one passport's state. */
// ── The modelled month (`tools/make-demo-db.mjs`, T-317) ─────────────────
// Drives routed on content/roads.json through real places, sampled like a phone
// in a car. Nobody drove it (D-016): it is the store screenshots' month, used
// here so the lit roads and the stamps on the island belong to the same trips.
const db = new DatabaseSync(path.join(here, 'out', 'demo-db', 'demo.db'), { readOnly: true });
const AWARDS = db.prepare('SELECT place_id, awarded_ts FROM stamp_award ORDER BY awarded_ts').all();
const FIXES = db.prepare('SELECT trip_id, ts, lat, lon FROM raw_fix ORDER BY trip_id, ts').all();
db.close();
const R = 6371000, rad = Math.PI / 180;
const metres = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2));
/** The month's drives as unbroken pieces: a gap over a minute or a jump over 300 m starts a new one. */
const DRIVES = [];
let km = 0;
const days = new Set();
for (let i = 0; i < FIXES.length; i += 1) {
  const f = FIXES[i], prev = FIXES[i - 1];
  days.add(new Date(f.ts).toISOString().slice(0, 10));
  const joined = prev && prev.trip_id === f.trip_id && f.ts - prev.ts < 60000 && metres(prev, f) < 300;
  if (!joined) DRIVES.push([]);
  else km += metres(prev, f) / 1000;
  DRIVES[DRIVES.length - 1].push([f.lon, f.lat]);
}
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dayLabel = (ts) => { const d = new Date(ts); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const TRIP = { km: `${Math.round(km)} km`, days: days.size, range: `${dayLabel(FIXES[0].ts)} a ${dayLabel(FIXES[FIXES.length - 1].ts)}` };
const awardedAt = new Map(AWARDS.map((a) => [a.place_id, a.awarded_ts]));

/** The same framing as `islandMap` (PAD 8, squeezed by the middle latitude), for drawing the drives on it. */
function projector(outlines, width) {
  const pts = outlines.flatMap((o) => o.outline);
  const lons = pts.map((q) => q[0]), lats = pts.map((q) => q[1]);
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const scale = (width - 16) / ((maxLon - minLon) * kx);
  return ([lon, lat]) => [8 + (lon - minLon) * kx * scale, 8 + (maxLat - lat) * scale];
}
let roadsBig = '', roadsSmall = '';
const roadPath = (proj, step) =>
  DRIVES.map((drive) => drive.filter((_, i) => i % step === 0 || i === drive.length - 1).map((q, i) => { const [x, y] = proj(q); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join('')).join('');

function useIsland(islandId, collectedInOrder, unlockedCount, freshCount = 0, withDrives = false) {
  places = placesOf(islandId);
  byId = new Map(places.map((p) => [p.id, p]));
  order = collectedInOrder;
  visited = new Set(order);
  unlocked = new Set(order.slice(0, unlockedCount));
  fresh = new Set(freshCount ? order.slice(-freshCount) : []);
  sets = ORDER.map((c) => {
    const all = places.filter((p) => p.category === c);
    return [c, all.filter((p) => visited.has(p.id)).length, all.length];
  }).filter(([, , t]) => t > 0);
  const outlines = outlinesOf(islandId);
  big = islandMap(outlines, places, visited, W);
  small = islandMap(outlines, places, visited, 84);
  roadsBig = withDrives ? roadPath(projector(outlines, W), 2) : '';
  roadsSmall = withDrives ? roadPath(projector(outlines, 84), 6) : '';
}
// The month's stamps in the order they were earned: the first 10 unlocked (example), the last 2 new since the passport was last opened.
const MADEIRA = AWARDS.map((a) => a.place_id).filter((id) => placesOf('ilha-da-madeira').some((p) => p.id === id));
useIsland('ilha-da-madeira', MADEIRA, 10, 2, true);
const dateOf = (id) => (awardedAt.has(id) ? dayLabel(awardedAt.get(id)) : dayLabel(Date.UTC(2026, 10, 1)));
const state = (id) => (unlocked.has(id) ? 'open' : visited.has(id) ? 'waiting' : 'new');
const rank = { new: 0, waiting: 1, open: 2 };
const dotOf = (id) => big.dots.find((d) => d.id === id);

// ── Drawing ────────────────────────────────────────────────────────────────
const LAND = '#2A2A2E', LAND_LIT = '#3A3424', COAST = '#48484A', GREY = '#6E6E76';
const burst = (d) =>
  `<g class="burst" style="--x:${d.x}px;--y:${d.y}px">${[0, 45, 90, 135, 180, 225, 270, 315]
    .map((a) => { const r = (a * Math.PI) / 180; return `<line x1="${(d.x + Math.cos(r) * 8).toFixed(1)}" y1="${(d.y + Math.sin(r) * 8).toFixed(1)}" x2="${(d.x + Math.cos(r) * 12).toFixed(1)}" y2="${(d.y + Math.sin(r) * 12).toFixed(1)}"/>`; })
    .join('')}</g>`;
const dotSvg = (d) => (fresh.has(d.id) ? burst(d) : '') + dotCore(d);
const dotCore = (d) => {
  const s = state(d.id);
  const c = byId.get(d.id).category;
  if (s === 'open') return `<g class="dot open" data-id="${d.id}" data-c="${c}"><circle cx="${d.x}" cy="${d.y}" r="8" fill="${reward.gold}" opacity=".25"/><circle cx="${d.x}" cy="${d.y}" r="4.2" fill="${reward.gold}"/></g>`;
  if (s === 'waiting') return `<g class="dot waiting" data-id="${d.id}" data-c="${c}"><circle cx="${d.x}" cy="${d.y}" r="3.6" fill="${album.background}" stroke="${reward.gold}" stroke-width="1.8"/></g>`;
  return `<g class="dot new" data-id="${d.id}" data-c="${c}"><circle cx="${d.x}" cy="${d.y}" r="2.6" fill="${GREY}"/></g>`;
};
/** What the map shows: all of it, or a zoomed part (x, y, w in map units). Dots and rings keep their size on screen. */
const FULL = { x: 0, y: 0, w: W };
const inv = (view) => view.w / W;
const toScreen = (view, x, y) => [(x - view.x) / inv(view), (y - view.y) / inv(view)];
const ringSvg = (id, view = FULL) => `<g class="sel"><circle class="pulse" cx="${dotOf(id).x}" cy="${dotOf(id).y}" r="${9 * inv(view)}"/><circle class="selring" cx="${dotOf(id).x}" cy="${dotOf(id).y}" r="${9 * inv(view)}"/></g>`;
/** A group is ringed once, round all of it. */
const groupRing = (ids) => {
  const ds = ids.map(dotOf);
  const cx = ds.reduce((a, d) => a + d.x, 0) / ds.length, cy = ds.reduce((a, d) => a + d.y, 0) / ds.length;
  const r = Math.max(...ds.map((d) => Math.hypot(d.x - cx, d.y - cy))) + 9;
  return `<g class="sel"><circle class="pulse" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"/><circle class="selring" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"/></g>`;
};
const mapSvg = ({ selected = [], only = null, view = FULL } = {}) => {
  const land = big.regions.map((r) => `<path class="land${r.lit ? ' lit' : ''}" d="${r.d}" fill="${r.lit ? LAND_LIT : LAND}" stroke="${COAST}" stroke-width="0.7"/>`).join('');
  const dots = [...big.dots].sort((a, b) => rank[state(a.id)] - rank[state(b.id)]).map(dotSvg).join('');
  const roads = roadsBig ? `<path class="roads glow" d="${roadsBig}" pathLength="1"/><path class="roads" d="${roadsBig}" pathLength="1"/>` : '';
  const zoomed = view.w < W;
  return `<svg class="map${only ? ` only-${only}` : ''}${zoomed ? ' zoomed' : ''}" style="--inv:${inv(view)}" width="${big.width}" height="${big.height}" viewBox="${view.x} ${view.y} ${view.w} ${(view.w * big.height) / W}">${land}${roads}${dots}${selected.length > 1 ? groupRing(selected) : selected.map((id) => ringSvg(id, view)).join('')}</svg>`;
};
const markSvg = () => {
  const land = small.regions.map((r) => `<path d="${r.d}" fill="${album.surface}" stroke="#636366" stroke-width="0.6"/>`).join('');
  const dots = small.dots.filter((d) => d.visited).map((d) => `<circle cx="${d.x}" cy="${d.y}" r="1.3" fill="${reward.gold}"/>`).join('');
  const roads = roadsSmall ? `<path d="${roadsSmall}" fill="none" stroke="${reward.gold}" stroke-width="0.7" stroke-opacity=".7" stroke-linejoin="round"/>` : '';
  return `<svg width="${small.width}" height="${small.height}" viewBox="0 0 ${small.width} ${small.height}">${land}${roads}${dots}</svg>`;
};
const stamp = (id, size, collected) => {
  const p = byId.get(id);
  return stampSvg(p.id, p.name, p.category, collected).replace('<svg ', `<svg width="${size}" height="${size}" `);
};
const PADLOCK = (size) => `<svg class="lock" width="${size}" height="${size}" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="12" rx="3" fill="#FFD45C" stroke="#7A5200" stroke-width="1.2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#FFD45C" stroke-width="2.6"/><circle cx="12" cy="16" r="1.8" fill="#7A5200"/></svg>`;
const stampFor = (id, size) =>
  state(id) === 'waiting'
    ? `<span class="locked" style="width:${size}px;height:${size}px">${stamp(id, size, true)}${PADLOCK(size * 0.42)}</span>`
    : stamp(id, size, state(id) === 'open');

// ── The bubble ─────────────────────────────────────────────────────────────
const META = {
  open: (id) => ({ line: `Carimbado a ${dateOf(id)}`, act: 'Ver carimbo' }),
  waiting: (id) => ({ line: `Estiveste aqui a ${dateOf(id)}`, act: 'Desbloquear' }),
  new: () => ({ line: 'Por visitar', act: 'Ver no mapa' }),
};
const BW = 256;
/** The bubble's one button, as a map callout's: its label is spoken, not printed (the state line says the state). */
const ICON = {
  open: `<svg width="9" height="14" viewBox="0 0 9 14"><path d="M2 2l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  waiting: `<svg width="16" height="16" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  new: `<svg width="14" height="16" viewBox="0 0 14 18"><path d="M7 17s6-6.2 6-10A6 6 0 0 0 1 7c0 3.8 6 10 6 10z" fill="currentColor"/><circle cx="7" cy="7" r="2.3" fill="#2C2C2E"/></svg>`,
};
/** Pinned over its dot, or under it when the dot is in the top third; never past the map's edge. */
function place(dot, height) {
  const left = Math.max(-4, Math.min(W + 4 - BW, dot.x - BW / 2));
  const below = dot.y - height - 15 < -10;
  return { left, top: below ? dot.y + 15 : dot.y - height - 15, tip: Math.max(18, Math.min(BW - 18, dot.x - left)), below };
}
function bubble(id, view = FULL) {
  const p = byId.get(id);
  const s = state(id);
  const { line, act } = META[s](id);
  const [sx, sy] = toScreen(view, dotOf(id).x, dotOf(id).y);
  const { left, top, tip, below } = place({ x: sx, y: sy }, 66);
  return `<div class="bubble ${s}${below ? ' below' : ''}" style="left:${left}px;top:${top}px;--tip:${tip}px">
    <span class="bst">${stampFor(id, 46)}</span>
    <span class="btx"><span class="bwhere">${CAT[p.category]} · ${regionName.get(p.regionId)}</span><b>${p.name}</b><span class="bline">${line}</span></span>
    <span class="bact" aria-label="${act}">${ICON[s]}</span></div>`;
}
const ZOOM_IN = `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="5" cy="5" r="3.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 8l3 3M3.4 5h3.2M5 3.4v3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const TAG = { open: (id) => dateOf(id), waiting: () => 'à espera', new: () => 'por visitar' };
function clusterBubble(ids) {
  const cx = ids.reduce((s, id) => s + dotOf(id).x, 0) / ids.length, cy = ids.reduce((s, id) => s + dotOf(id).y, 0) / ids.length;
  const h = 34 + ids.length * 44;
  const { left, top, tip, below } = place({ x: cx, y: cy }, h);
  return `<div class="bubble list${below ? ' below' : ''}" style="left:${left}px;top:${top}px;--tip:${tip}px">
    <div class="lhead"><span>${ids.length} lugares aqui</span><span class="zoomin">${ZOOM_IN} Aproximar</span></div>${ids
      .map((id) => `<div class="lrow" data-id="${id}"><span class="lst">${stampFor(id, 30)}</span><span class="lname">${byId.get(id).name}</span><i class="tg ${state(id)}">${TAG[state(id)](id)}</i></div>`)
      .join('')}</div>`;
}

// ── The page ───────────────────────────────────────────────────────────────
const nav = `<div class="nav"><span>‹ Mapa</span><span>Partilhar</span></div>`;
const track = () => `<div class="track">${sets.map(([, n, t]) => `<span style="flex:${t}"><i style="width:${(n / t) * 100}%"></i></span>`).join('')}</div>`;
const chips = (active) => `<div class="chips">${sets.map(([c, n, t]) => `<span class="chip${active === c ? ' on' : ''}" data-c="${c}"><i style="--f:${(n / t) * 100}%"></i>${CATS[c]} <b>${n}/${t}</b></span>`).join('')}</div>`;
const legend = () => {
  const n = { open: unlocked.size, waiting: visited.size - unlocked.size, new: places.length - visited.size };
  return `<div class="legend">${n.open ? `<span><i class="lg open"></i>${n.open} a cores</span>` : ''}${n.waiting ? `<span><i class="lg waiting"></i>${n.waiting} à tua espera</span>` : ''}<span><i class="lg new"></i>${n.new} por visitar</span></div>`;
};
const rowFor = (c) => {
  const [, n, t] = sets.find((x) => x[0] === c);
  const ids = places.filter((p) => p.category === c).sort((a, b) => rank[state(b.id)] - rank[state(a.id)]).slice(0, 4).map((p) => p.id);
  return `<div class="rowhead"><span class="rt">${CATS[c].toUpperCase()}</span><span class="rc">${n} de ${t}</span><span class="see">Ver tudo</span></div>
  <div class="panel">${ids.map((id) => stampFor(id, 74)).join('')}</div>`;
};
const rows = () => sets.slice(0, 2).map(([c]) => rowFor(c)).join('');
/** Without a trip there is no right-hand column: nothing waits empty (as in the proposal's first day). */
const stats = (trip = true) => `<div class="stats"><div class="primary"><div class="num">${visited.size}<span>/ ${places.length}</span></div><div class="lab">lugares visitados</div></div>${trip ? `<div class="divider"></div>
  <div class="secondary"><b>${TRIP.km}</b><span>estradas acesas</span><span>${TRIP.days} dias, ${TRIP.range}</span></div><div class="play"><span class="playc">▶</span><span>Viagem</span></div>` : ''}</div>`;
const expandBadge = `<span class="expand"><svg width="8" height="5" viewBox="0 0 8 5"><path d="M1 1l3 3 3-3" fill="none" stroke="${album.text}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
const toastFor = () => (fresh.size ? `<div class="toast"><i></i>${fresh.size} lugares novos desde a última vez</div>` : '');
const chevronUp = `<svg width="14" height="9" viewBox="0 0 14 9"><path d="M1 8l6-6 6 6" fill="none" stroke="${album.textMuted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function page({ open = false, selected = null, list = null, only = null, title = 'Passaporte', trip = true, toast = false, view = FULL } = {}) {
  const head = `<div class="titlerow"><h2>${title}</h2>${open ? `<button class="mark close">${chevronUp}</button>` : `<button class="mark">${markSvg()}${expandBadge}</button>`}</div>${stats(trip)}`;
  if (!open) return `${nav}<div class="scroll">${head}${track()}${rows()}</div>`;
  const sel = list ?? (selected ? [selected] : []);
  const pop = list ? clusterBubble(list) : selected ? bubble(selected, view) : '';
  const out = view.w < W ? `<span class="zoomout">Ilha inteira</span>` : '';
  const [, n, t] = only ? sets.find((s) => s[0] === only) : [];
  const under = only ? `<div class="legend">${CATS[only]}: ${n} de ${t} · <u>mostrar todos</u></div>` : legend();
  return `${nav}<div class="scroll">${head}<div class="mapbox">${mapSvg({ selected: sel, only, view })}${pop}${out}${toast ? toastFor() : ''}</div>${under}${chips(only)}${rows()}</div>`;
}

const pick = (s, pred = () => true) => order.find((id) => state(id) === s && pred(byId.get(id))) ?? places.find((p) => state(p.id) === s && pred(p)).id;
const top = (p) => dotOf(p.id).y < 45;
const openId = pick('open', (p) => !top(p) && p.regionId !== 'funchal');
const waitId = pick('waiting', (p) => p.category === 'beach' && p.regionId !== 'funchal');
const newTop = places.find((p) => state(p.id) === 'new' && top(p))?.id ?? places.find((p) => state(p.id) === 'new').id;
const levadaNew = places.find((p) => p.category === 'levada' && state(p.id) === 'new' && !top(p)).id;
const funchal = big.dots.filter((d) => byId.get(d.id).regionId === 'funchal');
const fx = funchal.reduce((s, d) => s + d.x, 0) / funchal.length, fy = funchal.reduce((s, d) => s + d.y, 0) / funchal.length;
const cluster = big.dots.filter((d) => Math.hypot(d.x - fx, d.y - fy) < 12).map((d) => d.id).slice(0, 4);

const stills = [
  { name: '0. Fechada', note: 'A ilha pequena ganha um pequeno sinal no canto, uma seta para baixo, que diz que se abre. Sem ele, um ícone ao lado do título lê-se como decoração.', body: page() },
  { name: '1. Aberta', note: 'A ilha pequena voa do canto para o seu lugar e cresce até à largura da página; os teus pontos acendem-se pela ordem em que lá foste e as filas descem. Os lugares novos desde a última vez que abriste o passaporte acendem-se por último, com um brilho, e uma etiqueta diz quantos são; some-se sozinha.', body: page({ open: true, toast: true }) },
  { name: '2. Um carimbo teu', note: 'A bolha sai do ponto com um pequeno salto e o ponto escolhido pulsa. Uma linha de contexto (categoria e concelho), o nome, a data, e à direita o botão: a seta abre o carimbo.', body: page({ open: true, selected: openId }) },
  { name: '3. À tua espera', note: 'O mesmo desenho; o botão passa a cadeado dourado e abre o ecrã de desbloquear já neste carimbo. O carimbo aparece fosco com o cadeado, como nas filas.', body: page({ open: true, selected: waitId }) },
  { name: '4. Por visitar, perto do topo', note: 'Quando não há lugar por cima, a bolha vira-se e abre por baixo, para não tapar os números. O alfinete fecha o passaporte e centra o mapa nesse lugar. O nome comprido passa a duas linhas.', body: page({ open: true, selected: newTop }) },
  { name: '5. Vários lugares juntos', note: 'No Funchal a bolha traz uma lista em vez de um só lugar: cada linha com o carimbo pequeno e o estado. Um só anel à volta do grupo, em vez de quatro sobrepostos. Tocar numa linha troca a lista pela bolha desse lugar.', body: page({ open: true, list: cluster }) },
  { name: '6. Com um filtro', note: 'Com "Levadas" ligado, só as levadas se podem tocar; a bolha funciona igual. Tocar no mar, fora dos pontos, fecha a bolha.', body: page({ open: true, only: 'levada', selected: levadaNew }) },
  { name: '7. Aproximado', note: 'Dois toques no mapa, ou "Aproximar" na lista de um grupo, aproximam essa zona. Os pontos e os anéis ficam do mesmo tamanho no ecrã, por isso no Funchal cada lugar passa a ter espaço para o seu próprio toque. "Ilha inteira" volta atrás; os dois dedos também funcionam.', body: page({ open: true, selected: 'se-do-funchal', view: { w: W / 7, x: fx - W / 14, y: fy - (W / 7) * (big.height / W) / 2 } }) },
];

// ── The prototype ──────────────────────────────────────────────────────────
const JS = `
const BUBBLES = ${JSON.stringify(Object.fromEntries(places.map((p) => [p.id, bubble(p.id)])))};
const DOTS = ${JSON.stringify(big.dots.map((d) => ({ id: d.id, x: d.x, y: d.y, c: byId.get(d.id).category })))};
const ORDER = ${JSON.stringify(order)};
const W = ${W}, H = ${big.height};
const ZOOM_IN = ${JSON.stringify(ZOOM_IN)};
const proto = document.getElementById('proto');
const slot = proto.querySelector('.slot'), box = slot.querySelector('.mapbox'), svg = box.querySelector('svg.map'), zoomOut = box.querySelector('.zoomout');
const opener = proto.querySelector('.mark.opener'), closer = proto.querySelector('.mark.close'), trackEl = proto.querySelector('.track');
const NS = 'http://www.w3.org/2000/svg';
// With "reduce motion" on, the island appears in place: no flight, no drawing, no pops.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
let only = null, view = { x: 0, y: 0, w: W }, pinned = null;
const inv = () => view.w / W;
const toScreen = (x, y) => [(x - view.x) / inv(), (y - view.y) / inv()];

function applyView() {
  svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.w * H / W);
  svg.style.setProperty('--inv', inv());
  svg.querySelectorAll('.sel circle').forEach((c) => c.setAttribute('r', +c.dataset.r0 + 9 * inv()));
  const zoomed = view.w < W - 0.5;
  svg.classList.toggle('zoomed', zoomed); zoomOut.hidden = !zoomed;
  repin();
}
function fit(v) { const w = Math.max(W / 8, Math.min(W, v.w)), h = w * H / W; return { w, x: Math.max(0, Math.min(W - w, v.x)), y: Math.max(0, Math.min(H - h, v.y)) }; }
function zoomTo(target) {
  const t = fit(target);
  if (still) { view = t; applyView(); return; }
  const from = Object.assign({}, view), t0 = performance.now();
  (function step(now) {
    const k = Math.min(1, (now - t0) / 380), e = 1 - Math.pow(1 - k, 3);
    view = { x: from.x + (t.x - from.x) * e, y: from.y + (t.y - from.y) * e, w: from.w + (t.w - from.w) * e }; applyView();
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}
const around = (x, y, w) => ({ w, x: x - w / 2, y: y - (w * H / W) / 2 });

/** The bubble follows its dot through a zoom, flips under it when there is no room above, and hides if the dot leaves the view. */
function repin() {
  if (!pinned) return;
  const [sx, sy] = toScreen(pinned.x, pinned.y), el = pinned.el, h = el.offsetHeight, bw = el.offsetWidth;
  const left = Math.max(-4, Math.min(W + 4 - bw, sx - bw / 2)), below = sy - h - 15 < -10;
  el.classList.toggle('below', below);
  el.style.left = left + 'px'; el.style.top = (below ? sy + 15 : sy - h - 15) + 'px';
  el.style.setProperty('--tip', Math.max(18, Math.min(bw - 18, sx - left)) + 'px');
  el.style.visibility = sx < -6 || sx > W + 6 || sy < -6 || sy > H + 6 ? 'hidden' : '';
}
function clearSel() { pinned = null; svg.querySelectorAll('.sel').forEach((n) => n.remove()); box.querySelectorAll('.bubble').forEach((n) => n.remove()); }
/** One ring for one place, one ring round a group; returns the ring's centre. */
function ring(ids) {
  const ds = ids.map((id) => DOTS.find((d) => d.id === id));
  const cx = ds.reduce((a, d) => a + d.x, 0) / ds.length, cy = ds.reduce((a, d) => a + d.y, 0) / ds.length;
  const r0 = ds.length > 1 ? Math.max(...ds.map((d) => Math.hypot(d.x - cx, d.y - cy))) : 0;
  const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'sel');
  for (const cls of ['pulse', 'selring']) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.dataset.r0 = r0; c.setAttribute('r', r0 + 9 * inv()); c.setAttribute('class', cls); g.appendChild(c); }
  svg.appendChild(g);
  return [cx, cy];
}
function show(id) {
  clearSel(); const [x, y] = ring([id]);
  box.insertAdjacentHTML('beforeend', BUBBLES[id]);
  pinned = { el: box.querySelector('.bubble'), x, y }; repin();
}
function showList(ids) {
  clearSel(); const [cx, cy] = ring(ids);
  const rows = ids.map((id) => { const b = new DOMParser().parseFromString(BUBBLES[id], 'text/html').body.firstChild; const s = b.classList.contains('open') ? 'open' : b.classList.contains('waiting') ? 'waiting' : 'new';
    return '<div class="lrow" data-id="' + id + '"><span class="lst">' + b.querySelector('.bst').innerHTML.replace(/width="46" height="46"/g, 'width="30" height="30"').replace(/width:46px;height:46px/, 'width:30px;height:30px') + '</span><span class="lname">' + b.querySelector('b').textContent + '</span><i class="tg ' + s + '">' + (s === 'open' ? b.querySelector('.bline').textContent.replace('Carimbado a ', '') : s === 'waiting' ? 'à espera' : 'por visitar') + '</i></div>'; }).join('');
  box.insertAdjacentHTML('beforeend', '<div class="bubble list"><div class="lhead"><span>' + ids.length + ' lugares aqui</span><span class="zoomin">' + ZOOM_IN + ' Aproximar</span></div>' + rows + '</div>');
  const el = box.querySelector('.bubble');
  pinned = { el, x: cx, y: cy }; repin();
  el.querySelectorAll('.lrow').forEach((n) => n.addEventListener('click', (e) => { e.stopPropagation(); show(n.dataset.id); }));
  el.querySelector('.zoomin').addEventListener('click', (e) => { e.stopPropagation(); clearSel(); zoomTo(around(cx, cy, W / 7)); });
}
function open() {
  // Measured before it is hidden: the flight starts where the small island was.
  const from = opener.getBoundingClientRect();
  slot.classList.add('open'); trackEl.classList.add('gone'); opener.hidden = true; closer.hidden = false;
  if (still) { slot.style.height = 'auto'; return; }
  slot.style.height = slot.scrollHeight + 'px';
  // The small island flies to where the big one sits.
  const to = svg.getBoundingClientRect();
  svg.style.transition = 'none';
  svg.style.transform = 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' + (from.width / to.width) + ')';
  svg.getBoundingClientRect();
  svg.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)'; svg.style.transform = 'none';
  // The roads draw themselves first, the way the trip film does; the places light along them.
  svg.querySelectorAll('.roads').forEach((r) => { r.style.transition = 'none'; r.style.strokeDasharray = '1'; r.style.strokeDashoffset = '1'; r.getBBox(); r.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.4,0,.2,1) .3s'; r.style.strokeDashoffset = '0'; });
  svg.querySelectorAll('.dot.open, .dot.waiting').forEach((g) => g.classList.add('unlit'));
  svg.querySelectorAll('.land.lit').forEach((g) => g.classList.add('unlit'));
  ORDER.forEach((id, i) => setTimeout(() => svg.querySelector('[data-id="' + id + '"]')?.classList.remove('unlit'), 480 + i * 50));
  setTimeout(() => svg.querySelectorAll('.land.lit').forEach((g) => g.classList.remove('unlit')), 480 + ORDER.length * 25);
  // The new ones light last, with a burst, and the hint says how many; it leaves on its own.
  svg.querySelectorAll('.burst').forEach((b) => { b.classList.remove('go'); void b.getBBox(); });
  setTimeout(() => svg.querySelectorAll('.burst').forEach((b) => b.classList.add('go')), 520 + ORDER.length * 50);
  const t = box.querySelector('.toast'); if (t) { t.classList.remove('show'); setTimeout(() => t.classList.add('show'), 560 + ORDER.length * 50); setTimeout(() => t.classList.remove('show'), 3400 + ORDER.length * 50); }
  setTimeout(() => { slot.style.height = 'auto'; }, 460);
}
function close() {
  clearSel(); filter(null); view = { x: 0, y: 0, w: W }; applyView();
  if (still) slot.style.height = '0px';
  else { slot.style.height = slot.scrollHeight + 'px'; requestAnimationFrame(() => { slot.style.height = '0px'; }); }
  slot.classList.remove('open'); trackEl.classList.remove('gone'); opener.hidden = false; closer.hidden = true;
}
function filter(c) {
  only = c; clearSel();
  slot.querySelectorAll('.chip').forEach((n) => n.classList.toggle('on', n.dataset.c === c));
  [...svg.classList].filter((k) => k.startsWith('only-')).forEach((k) => svg.classList.remove(k));
  if (c) svg.classList.add('only-' + c);
}
/** Where on the map a pointer is, in map units, through the flight and any zoom. */
function at(e) { const r = svg.getBoundingClientRect(), s = W / r.width; return [view.x + (e.clientX - r.left) * s * inv(), view.y + (e.clientY - r.top) * s * inv()]; }
opener.addEventListener('click', open); closer.addEventListener('click', close);
zoomOut.addEventListener('click', (e) => { e.stopPropagation(); clearSel(); zoomTo({ x: 0, y: 0, w: W }); });
slot.querySelectorAll('.chip').forEach((n) => n.addEventListener('click', () => filter(only === n.dataset.c ? null : n.dataset.c)));
box.addEventListener('click', (e) => {
  if (e.target.closest('.bubble')) { const b = e.target.closest('.bubble'); b.classList.remove('press'); void b.offsetWidth; b.classList.add('press'); return; }
  if (e.target.closest('.zoomout')) return;
  const [x, y] = at(e);
  // Distances in screen pixels, so a zoomed map gives each dot its full 16 px of touch.
  const near = DOTS.filter((d) => !only || d.c === only).map((d) => ({ d, k: Math.hypot(d.x - x, d.y - y) / inv() })).filter((o) => o.k < 16).sort((a, b) => a.k - b.k);
  if (!near.length) { clearSel(); return; }
  const square = near[0].k <= 5 && (near[1] ? near[1].k : 99) > near[0].k + 4;
  const pickd = square ? [near[0]] : near.filter((o) => o.k < near[0].k + 7).slice(0, 4);
  if (pickd.length === 1) show(pickd[0].d.id); else showList(pickd.map((o) => o.d.id));
});
box.addEventListener('dblclick', (e) => {
  if (e.target.closest('.bubble, .zoomout')) return;
  clearSel(); const [x, y] = at(e);
  zoomTo(view.w < W - 0.5 ? { x: 0, y: 0, w: W } : around(x, y, W / 2.6));
});
`;
const protoBody = `${nav}<div class="scroll"><div class="titlerow"><h2>Passaporte</h2><button class="mark opener" aria-label="Abrir a ilha">${markSvg()}${expandBadge}</button><button class="mark close" hidden aria-label="Fechar a ilha">${chevronUp}</button></div>${stats()}${track()}
  <div class="slot"><div class="mapbox">${mapSvg()}<span class="zoomout" hidden>Ilha inteira</span>${toastFor().replace('class="toast"', 'class="toast live"')}</div>${legend()}${chips(null)}</div>${rows()}</div>`;

// ── Two more states, drawn after the prototype has taken Madeira's ─────────
useIsland('ilha-da-madeira', [], 0);
stills.push({ name: '8. Primeiro dia', note: 'Nenhum lugar ainda: a ilha abre toda cinzenta, sem coluna da viagem e sem legenda a cores, só "81 por visitar". Os filtros dizem 0 de cada. Serve logo para ver onde ficam as coisas.', body: page({ open: true, trip: false }) });
useIsland('porto-santo', ['praia-do-porto-santo'], 1);
stills.push({ name: '9. Porto Santo', note: 'A página de Porto Santo tem a sua ilha, com o mesmo desenho e os mesmos três estados; os filtros mostram só as categorias que lá existem. Aqui com o carimbo grátis da praia.', body: page({ open: true, title: 'Porto Santo', trip: false, selected: 'praia-do-porto-santo' }) });

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
.track { display: flex; gap: 3px; margin-top: 14px; height: 4px; } .track.gone { display: none; } .track span { background: ${album.surface}; border-radius: 2px; overflow: hidden; } .track i { display: block; height: 100%; background: ${album.text}; }
.slot { height: 0; overflow: hidden; transition: height .46s cubic-bezier(.2,.8,.2,1); } .slot.open { overflow: visible; }
.mapbox { position: relative; margin-top: 18px; } .map { display: block; cursor: pointer; transform-origin: 0 0; overflow: visible; }
.land { transition: fill .6s; } .land.lit.unlit { fill: ${LAND}; }
.dot { transition: opacity .25s, transform .35s cubic-bezier(.3,1.6,.5,1); transform-box: fill-box; transform-origin: center; transform: scale(var(--inv, 1)); } .dot.unlit { opacity: 0; transform: scale(calc(var(--inv, 1) * 2.4)); }
${ORDER.map((c) => `.map.only-${c} .dot:not([data-c="${c}"]) { opacity: .12; pointer-events: none; }`).join(' ')}
.selring { fill: none; stroke: #FFF; stroke-width: 2; }
.pulse { fill: none; stroke: #FFF; stroke-width: 2; transform-box: fill-box; transform-origin: center; animation: pulse 1.6s ease-out infinite; }
@keyframes pulse { from { transform: scale(1); opacity: .7; } to { transform: scale(2.2); opacity: 0; } }
.legend { display: flex; gap: 14px; margin-top: 10px; font-size: 12px; color: ${album.textMuted}; } .legend span { display: flex; align-items: center; gap: 6px; } .legend u { color: ${album.tint}; text-decoration: none; margin-left: -8px; }
.lg { width: 9px; height: 9px; border-radius: 50%; display: inline-block; } .lg.open { background: ${reward.gold}; } .lg.waiting { border: 1.8px solid ${reward.gold}; } .lg.new { background: ${GREY}; width: 6px; height: 6px; }
.chips { display: flex; gap: 6px; margin: 12px -16px 0 0; padding-right: 24px; overflow-x: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, #000 85%, transparent); mask-image: linear-gradient(90deg, #000 85%, transparent); }
.chip { flex: 0 0 auto; position: relative; overflow: hidden; border: 1px solid ${album.hairline}; border-radius: 16px; padding: 5px 11px 7px; font-size: 13px; color: ${album.text}; cursor: pointer; white-space: nowrap; }
.chip b { font-weight: 600; color: ${album.textMuted}; margin-left: 2px; } .chip i { position: absolute; left: 0; bottom: 0; height: 2px; width: var(--f); background: ${album.text}; }
.chip { transition: background .2s, border-color .2s; } .chip.on { background: #3A3A3C; border-color: ${album.text}; } .chip.on b { color: ${album.text}; }

/* The bubble */
.bubble { position: absolute; z-index: 3; width: ${BW}px; display: flex; align-items: center; gap: 10px; padding: 9px 10px 9px 9px;
  background: #2C2C2EF2; border: 1px solid #48484A; border-radius: 16px; box-shadow: 0 10px 28px #000C, 0 1px 0 #FFFFFF0F inset;
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); cursor: pointer;
  transform-origin: var(--tip) calc(100% + 8px); animation: pop .32s cubic-bezier(.3,1.5,.5,1) both; }
.bubble.below { transform-origin: var(--tip) -8px; }
@keyframes pop { from { transform: scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
.bubble.press { animation: press .18s ease-out; } @keyframes press { 50% { transform: scale(.97); } }
.bubble::before, .bubble::after { content: ''; position: absolute; left: calc(var(--tip) - 8px); border: 8px solid transparent; }
.bubble::before { bottom: -9px; border-bottom: 0; border-top-color: #48484A; } .bubble::after { bottom: -7.5px; border-bottom: 0; border-top-color: #2C2C2E; }
.bubble.below::before { bottom: auto; top: -9px; border: 8px solid transparent; border-top: 0; border-bottom-color: #48484A; }
.bubble.below::after { bottom: auto; top: -7.5px; border: 8px solid transparent; border-top: 0; border-bottom-color: #2C2C2E; }
.bst { flex: 0 0 46px; display: flex; align-self: center; }
.btx { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.bwhere { font-size: 10px; letter-spacing: .8px; text-transform: uppercase; color: ${album.textMuted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.btx b { font-size: 15px; font-weight: 650; margin-top: 1px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.bline { font-size: 12px; color: ${album.textMuted}; margin-top: 1px; } .bubble.open .bline, .bubble.waiting .bline { color: ${reward.goldInk}; }
.bact { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 50px; align-self: stretch; margin: -9px -10px -9px 0; border-left: 1px solid #48484A;
  font-size: 10.5px; font-weight: 700; line-height: 1.15; text-align: center; color: ${album.tint}; padding: 0 4px; }
.bubble.waiting .bact { color: ${reward.goldInk}; }
.bubble.list { display: block; padding: 8px 12px 6px; }
.lhead { font-size: 11px; letter-spacing: .6px; color: ${album.textMuted}; padding-bottom: 4px; }
.lrow { display: flex; align-items: center; gap: 10px; height: 44px; border-top: 1px solid #48484A; font-size: 14px; } .lst { display: flex; width: 30px; justify-content: center; }
.lname { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .tg { font-style: normal; font-size: 11.5px; white-space: nowrap; } .tg.open, .tg.waiting { color: ${reward.goldInk}; } .tg.new { color: ${album.textMuted}; }
.locked { position: relative; display: inline-block; } .locked > svg:first-child { filter: blur(1.8px) saturate(.75); } .locked .lock { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }

.mark { position: relative; }
.expand { position: absolute; right: 2px; bottom: 2px; width: 16px; height: 16px; border-radius: 50%; background: #48484A; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px ${album.background}; }
.burst line { stroke: ${reward.gold}; stroke-width: 1.6; stroke-linecap: round; }
.phone#proto .burst { opacity: 0; } .phone#proto .burst.go { animation: burst 1.1s ease-out 2 both; }
.burst { transform-box: view-box; transform-origin: var(--x) var(--y); }
@keyframes burst { 0% { opacity: 0; transform: scale(.4); } 30% { opacity: 1; } 100% { opacity: 0; transform: scale(1.5); } }
.toast { position: absolute; left: 0; top: -6px; display: flex; align-items: center; gap: 7px; padding: 5px 11px 5px 9px; border-radius: 14px; background: #2C2C2EF2; border: 1px solid #48484A; font-size: 12px; color: ${album.text}; box-shadow: 0 6px 16px #0009; }
.toast i { width: 7px; height: 7px; border-radius: 50%; background: ${reward.gold}; box-shadow: 0 0 0 3px #FFD45C40; }
.toast.live { opacity: 0; transform: translateY(-4px); transition: opacity .3s, transform .3s; pointer-events: none; } .toast.live.show { opacity: 1; transform: none; }
.roads { fill: none; stroke: ${reward.gold}; stroke-width: 1.3; stroke-opacity: .8; stroke-linejoin: round; stroke-linecap: round; pointer-events: none; }
.roads.glow { stroke-width: 4.5; stroke-opacity: .16; }
.map[class*="only-"] .roads { opacity: .3; }
.land, .roads, .sel circle { vector-effect: non-scaling-stroke; }
.map.zoomed { overflow: hidden; } .map.zoomed .burst { display: none; }
.zoomout { position: absolute; right: 0; top: -4px; z-index: 2; padding: 5px 12px; border-radius: 14px; background: #2C2C2EF2; border: 1px solid #48484A; font-size: 12px; font-weight: 600; color: ${album.tint}; cursor: pointer; box-shadow: 0 6px 16px #0009; } .zoomout[hidden] { display: none; }
.lhead { display: flex; justify-content: space-between; align-items: center; } .zoomin { display: flex; align-items: center; gap: 5px; color: ${album.tint}; font-weight: 600; font-size: 12px; letter-spacing: 0; cursor: pointer; padding: 4px 0 4px 10px; }
@media (prefers-reduced-motion: reduce) { .bubble, .pulse, .burst { animation: none !important; } .dot, .slot, .land, .chip { transition: none !important; } }
.rowhead { display: flex; gap: 12px; margin-top: 22px; } .rt { flex: 1; color: ${album.textMuted}; letter-spacing: 1px; } .rc { color: ${album.textMuted}; } .see { color: ${album.tint}; }
.panel { display: flex; gap: 6px; border: 1px solid ${album.hairline}; border-radius: 16px; padding: 12px 8px; margin-top: 10px; overflow: hidden; }
.protorow { display: flex; gap: 40px; align-items: flex-start; margin-bottom: 44px; } .protonote { max-width: 460px; color: #B4B4BC; } .protonote h3 { color: #FFF; margin: 0 0 8px; font-size: 16px; } .protonote b { color: #FFF; } .protonote li { margin-bottom: 6px; } .protonote ul { padding-left: 18px; }
.spec { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; font-size: 13px; margin-bottom: 18px; } .spec span:nth-child(odd) { color: #FFF; }
`;

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Passaporte: a ilha</title><style>${CSS}</style></head><body>
<div class="head"><h1>A ilha do passaporte, com as estradas acesas</h1><p>Ronda 6. A ilha passa a mostrar o que a app tem de mais seu: as estradas por onde andaste, acesas a dourado por baixo dos carimbos. Os dados são o mês modelado das capturas da loja (<code>make-demo-db.mjs</code>): viagens traçadas pelas estradas verdadeiras até lugares verdadeiros, mas que ninguém conduziu. Os carimbos, as datas e os quilómetros vêm desse mesmo mês; quais estão desbloqueados (os 10 primeiros) é de exemplo. A ilha é desenhada pelo código da app.</p></div>
<div class="protorow"><figure><div class="phone" id="proto">${protoBody}</div><figcaption><b>Protótipo</b>Toca na ilha pequena. Depois nos pontos, no Funchal, nos filtros e no mar.</figcaption></figure>
<div class="protonote"><h3>O que se afinou</h3><ul>
<li><b>Um botão redondo à direita</b>, como nas bolhas de um mapa, com o que o toque faz: seta azul (ver o carimbo), cadeado dourado (desbloquear) ou alfinete (ver no mapa). O leitor de ecrã diz a ação por extenso. A bolha toda também se pode tocar.</li>
<li><b>Uma linha de contexto</b> por cima do nome: categoria e concelho, como no cartão de um carimbo.</li>
<li><b>Nomes longos passam a duas linhas</b> em vez de serem cortados: "Miradouro da Rocha do Navio" lê-se inteiro.</li>
<li><b>Sai do ponto</b> com um pequeno salto, e o ponto escolhido pulsa enquanto a bolha está aberta.</li>
<li><b>Vira-se</b> e abre por baixo quando não cabe por cima, e nunca sai pelos lados.</li>
<li><b>Lugares juntos</b> abrem uma bolha com lista, no mesmo estilo, em vez de um cartão que empurrava as filas.</li>
<li><b>Tocar no mar</b> fecha a bolha. Um filtro ligado deixa tocar só nos pontos dessa categoria.</li>
<li><b>A ilha voa</b> do canto para o seu lugar ao abrir; os concelhos aquecem depois dos pontos.</li>
<li><b>Ronda 6: aproximar.</b> Dois toques no mapa aproximam essa zona; "Aproximar" na lista de um grupo vai direito a ele; "Ilha inteira" volta. Os pontos e anéis mantêm o tamanho no ecrã e a bolha segue o seu ponto. Com "reduzir movimento" ligado no telemóvel, a ilha aparece no sítio, sem voo, sem desenho, sem saltos.</li>
<li><b>Ronda 5: as estradas acesas.</b> Por baixo dos pontos, as estradas por onde andaste, a dourado, como no mapa principal; ao abrir, desenham-se sozinhas e os lugares acendem-se ao longo delas. Também na ilha pequena, em fio. A coluna da viagem mostra os quilómetros e os dias desse mesmo mês.</li>
<li><b>Ronda 4:</b> um sinal de abrir na ilha pequena; os lugares novos desde a última visita acendem-se por último com um brilho e uma etiqueta que some; um só anel à volta de um grupo; o filtro ligado fica em cinzento com contorno, em vez de branco cheio; a página do primeiro dia e a de Porto Santo.</li></ul>
<h3>Medidas</h3><div class="spec"><span>Bolha</span><span>256 de largura, 66 a 84 de altura, cantos de 16</span><span>Botão</span><span>34, zona de toque 44</span><span>Carimbo</span><span>46</span><span>Zona de toque de um ponto</span><span>16 à volta no ecrã, com ou sem aproximação</span><span>Aproximação</span><span>dois toques: 2,6 vezes; num grupo: 7 vezes; no máximo 8</span><span>Abrir</span><span>0,46 s; pontos a cada 50 ms</span></div>
<h3>Por decidir</h3><ul><li>Se a ilha fica aberta da próxima vez que se abre o passaporte.</li><li>Leitores de ecrã: proponho que a ilha se leia como a lista dos lugares, por categoria, com o estado de cada um.</li></ul></div></div>
<div class="frames">${stills.map((f) => `<figure><div class="phone">${f.body}</div><figcaption><b>${f.name}</b>${f.note}</figcaption></figure>`).join('')}</div>
<script>${JS}</script></body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
writeFileSync(path.join(here, 'out', 'island-bubble.html'), html);
console.log('tools/out/island-bubble.html', { openId, waitId, newTop, levadaNew, cluster });
