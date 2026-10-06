/**
 * The trip viewer, WalkNYC's way, drawn as options for the project lead
 * (T-253, 2026-10-06).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-trip-viewer-options.mjs <capture.png>
 *     → tools/out/trip-viewer-options.html
 *
 * The lead chose to replace the animated replay with a still viewer, as
 * WalkNYC has, after it was studied on the emulator (tools/out/walknyc/):
 * a full map framed on the walk, a round back button, a "Walk 1 of 1" pill,
 * a Share pill, the path with S and E, dark time tags, the blocks it earned in
 * green, and one bottom card with the date, arrows to the other walks and four
 * figures. Its Share sends one PNG of that view plus a line about the app.
 *
 * ⚠ The map is a **real capture** of the P30 (the replay's last frame, the
 * lead's own lit roads), passed in as a path and never committed: it shows
 * where they have been. Every figure is real, read from the P30's database on
 * 2026-10-06: trip 31 from 24 Sep 20:47, 13 days recorded, 47 176 m lit (the
 * app's own diary total), three stamps. Marker positions were placed by eye
 * on the capture, to within a few pixels.
 *
 * ⚠ No S and E. A WalkNYC walk starts and ends somewhere; a Bruma trip starts
 * and ends every day at the hotel, which D-040 keeps out of anything shared.
 * The dark tags go on the stamps instead.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampSvgWithDesign } from './lib/svg-render.mjs';
import { designFor } from '../app/src/passport/stampArt.ts';
import { colors, mapChrome } from '../app/src/ui/theme.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const capturePath = process.argv[2];
if (capturePath === undefined) {
  console.error('Usage: node tools/preview-trip-viewer-options.mjs <capture.png>');
  process.exit(1);
}
const capture = `data:image/png;base64,${readFileSync(capturePath).toString('base64')}`;
const pack = JSON.parse(readFileSync(path.join(here, '..', 'content', 'pois.json'), 'utf8'));
const byId = new Map(pack.places.map((place) => [place.id, place]));

/** The capture is 1080 wide, drawn here at 360: one CSS pixel is three. */
const SHIFT_Y = -50;
const at = (x, y) => ({ x: x / 3, y: y / 3 + SHIFT_Y });

const STAMPS = [
  { id: 'praia-formosa', tag: 'dom. 16:05', ...at(209, 1870) },
  { id: 'camara-de-lobos', tag: 'dom. 16:26', ...at(69, 1805) },
  { id: 'camacha', tag: 'ter. 15:33', ...at(829, 1593) },
];

const white = mapChrome.light;
const shadow = 'box-shadow:0 1px 3px rgba(0,0,0,.25)';

function stampArt(id, size) {
  const place = byId.get(id);
  const svg = stampSvgWithDesign(place.id, designFor(place.id, place.category, place.motif), place.name, true);
  return `<div class="art" style="width:${size}px">${svg}</div>`;
}

const STATUS = `<div class="status"><span>21:53</span><span>100%</span></div>`;

function chrome(pill, share = true) {
  return `<div class="round back" style="${shadow}">&#8592;</div>
    <div class="pill mid" style="${shadow}">${pill}</div>
    ${share ? `<div class="pill share" style="color:${white.link};${shadow}">Partilhar</div>` : ''}`;
}

function tags(withArt) {
  return STAMPS.map((s) =>
    withArt
      ? `<div class="pin" style="left:${s.x}px;top:${s.y}px">${stampArt(s.id, 40)}<span class="tag">${s.tag}</span></div>`
      : // Kept on screen: a stamp at the coast's edge would push its tag off it.
        `<span class="tag" style="left:${Math.max(34, Math.min(326, s.x))}px;top:${s.y - 26}px;position:absolute;transform:translateX(-50%)">${s.tag}</span>`
  ).join('');
}

function stats(items) {
  return `<div class="stats">${items
    .map(([n, label]) => `<div><b>${n}</b><span>${label}</span></div>`)
    .join('')}</div>`;
}

/**
 * The capture is the old replay's last frame, so it carries that screen's own
 * "Concluído" and "3 / 80". Both sit over open sea (rows 167 to 216 and 1934
 * to 2145, measured), so they are painted out in the sea's own colour.
 */
const SEA = '#90daee';
const patch = (x0, y0, x1, y1) => {
  const a = at(x0, y0);
  const b = at(x1, y1);
  return `<i class="patch" style="left:${a.x}px;top:${a.y}px;width:${b.x - a.x}px;height:${b.y - a.y}px"></i>`;
};
const MAP = `<div class="map" style="background-image:url(${capture});background-position:0 ${SHIFT_Y}px"></div>
  ${patch(30, 150, 440, 232)}${patch(180, 1922, 900, 2160)}`;

// A: WalkNYC as it is, one page per trip.
const A = `<div class="phone">${MAP}${STATUS}${chrome('Viagem 31 de 31')}${tags(false)}
  <div class="card">
    <div class="nav"><span class="arrow">&#8249;</span><div><b>24 set. a 6 out.</b><small>quinta, 20:47</small></div><span class="arrow off">&#8250;</span></div>
    ${stats([['3', 'CARIMBOS'], ['47,2 km', 'ESTRADAS ACESAS'], ['13', 'DIAS']])}
  </div></div>`;

// B: the same, one page per day, because a holiday is many days.
const days = Array.from({ length: 13 }, (_, i) => i);
const B = `<div class="phone">${MAP}${STATUS}${chrome('Dia 13 de 13')}${tags(false)}
  <div class="card">
    <div class="nav"><span class="arrow">&#8249;</span><div><b>Terça, 6 de outubro</b><small>Viagem de 24 set. a 6 out.</small></div><span class="arrow off">&#8250;</span></div>
    ${stats([['1', 'CARIMBO'], ['6,8 km', 'ESTRADAS ACESAS'], ['47,2 km', 'NA VIAGEM']])}
    <div class="days">${days.map((d) => `<i class="${d === 12 ? 'on' : ''}"></i>`).join('')}</div>
  </div></div>`;

// C: one page per trip, with the stamps themselves on the map.
const C = `<div class="phone">${MAP}${STATUS}${chrome('Viagem 31 de 31')}${tags(true)}
  <div class="card">
    <div class="nav"><span class="arrow">&#8249;</span><div><b>24 set. a 6 out.</b><small>13 dias · 47,2 km de estradas acesas</small></div><span class="arrow off">&#8250;</span></div>
    <div class="row">${STAMPS.map((s) => `<div>${stampArt(s.id, 52)}<small>${byId.get(s.id).name}</small></div>`).join('')}</div>
  </div></div>`;

// Share: what leaves the phone, WalkNYC's way. One image, the view itself.
const SHARE = `<div class="phone shared">${MAP}${tags(false)}
  <div class="card">
    <div class="nav"><span></span><div><b>24 set. a 6 out.</b><small>Madeira</small></div><span></span></div>
    ${stats([['3', 'CARIMBOS'], ['47,2 km', 'ESTRADAS ACESAS'], ['13', 'DIAS']])}
    <p class="plug">Acende as tuas estradas com o Bruma</p>
  </div></div>`;

function board(letter, title, phoneHtml, notes) {
  return `<figure><div class="letter">${letter}</div>${phoneHtml}<figcaption><b>${title}</b>${notes}</figcaption></figure>`;
}

const page = `<!doctype html>
<html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bruma: ver a viagem</title>
<style>
:root { --bg:${colors.background}; --fg:#1C1C1E; --muted:#6B6B70; }
body { margin:0; padding:24px 16px; background:var(--bg); color:var(--fg); font:15px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; }
main { max-width:1560px; margin:0 auto; }
h1 { font-size:24px; margin:0 0 4px; } .lead { color:var(--muted); max-width:760px; }
.boards { display:flex; flex-wrap:wrap; gap:28px; margin-top:24px; }
figure { margin:0; width:360px; }
.letter { font-weight:700; font-size:20px; margin-bottom:8px; }
figcaption { color:var(--muted); margin-top:10px; font-size:14px; } figcaption b { display:block; color:var(--fg); font-size:16px; margin-bottom:4px; }
.phone { position:relative; width:360px; height:780px; border-radius:28px; overflow:hidden; background:#9fd6e8; box-shadow:0 2px 12px rgba(0,0,0,.15); }
.phone.shared { height:640px; }
.map { position:absolute; inset:0; background-size:360px auto; background-repeat:no-repeat; }
.patch { position:absolute; background:${SEA}; }
.status { position:absolute; top:0; left:0; right:0; height:28px; display:flex; justify-content:space-between; padding:6px 18px 0; font-size:12px; font-weight:600; background:linear-gradient(rgba(255,255,255,.85), rgba(255,255,255,0)); box-sizing:border-box; }
.round { position:absolute; width:40px; height:40px; border-radius:20px; background:${white.surface}; display:grid; place-items:center; font-size:20px; }
.back { top:40px; left:16px; }
.pill { position:absolute; top:44px; height:32px; padding:0 14px; border-radius:16px; background:${white.surface}; display:flex; align-items:center; font-weight:600; font-size:14px; }
.mid { left:50%; transform:translateX(-50%); } .share { right:16px; }
.tag { background:#1C1C1E; color:#fff; font-size:11px; font-weight:600; padding:3px 7px; border-radius:6px; white-space:nowrap; }
.pin { position:absolute; transform:translate(-50%,-100%); display:flex; flex-direction:column; align-items:center; gap:2px; }
.art svg { width:100%; height:auto; display:block; filter:drop-shadow(0 1px 2px rgba(0,0,0,.35)); }
.card { position:absolute; left:12px; right:12px; bottom:14px; background:${white.surface}; border-radius:18px; padding:14px 12px 12px; ${shadow}; }
.nav { display:flex; align-items:center; justify-content:space-between; text-align:center; }
.nav b { display:block; font-size:17px; } .nav small { color:var(--muted); font-size:13px; }
.arrow { width:32px; height:32px; border-radius:16px; background:${colors.background}; display:grid; place-items:center; font-size:22px; color:#444; } .arrow.off { opacity:.35; }
.stats { display:flex; margin-top:12px; } .stats div { flex:1; text-align:center; border-left:1px solid #E5E5EA; } .stats div:first-child { border-left:0; }
.stats b { display:block; font-size:18px; } .stats span { font-size:10px; letter-spacing:.04em; color:var(--muted); font-weight:600; }
.days { display:flex; gap:4px; justify-content:center; margin-top:12px; } .days i { width:16px; height:6px; border-radius:3px; background:#D1D1D6; } .days i.on { background:${white.link}; }
.row { display:flex; justify-content:space-around; margin-top:10px; } .row > div { display:flex; flex-direction:column; align-items:center; gap:4px; width:30%; } .row small { font-size:11px; text-align:center; color:var(--muted); }
.plug { margin:10px 0 0; text-align:center; font-size:12px; color:var(--muted); }
</style></head><body><main>
<h1>Ver a viagem, à maneira da WalkNYC</h1>
<p class="lead">O mapa é uma captura real do teu P30 e os números são os da tua viagem atual, lidos da base de dados a 6 de outubro.
Não há S nem E: na WalkNYC marcam o início e o fim de um passeio, mas uma viagem do Bruma começa e acaba todos os dias no hotel, e o hotel nunca aparece no que se partilha.
As etiquetas escuras vão para os carimbos, com o dia e a hora.</p>
<div class="boards">
${board('A', 'Uma página por viagem', A, 'A WalkNYC tal como é. As setas passam de viagem em viagem; esta lista de viagens é a T-261. Simples, mas numa viagem de duas semanas o mapa é sempre o mesmo, só cresce.')}
${board('B', 'Uma página por dia', B, 'Igual à A, mas as setas passam de dia em dia, e cada dia mostra os seus números. É o mais próximo do que a WalkNYC faz com um passeio, porque um dia de férias é o teu passeio. No app, as estradas desse dia ficavam acesas e as outras mais claras.')}
${board('C', 'Os carimbos no mapa', C, 'Uma página por viagem, com a arte dos carimbos no sítio onde os ganhaste. A mais nossa: a WalkNYC pinta quarteirões, o Bruma mostra carimbos.')}
${board('Partilhar', 'O que sai do telemóvel', SHARE, 'Como na WalkNYC: uma só imagem do próprio ecrã, com os números e uma linha sobre a app. Sem botões. O sítio onde dormes é removido antes, como hoje.')}
</div></main></body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
const out = path.join(here, 'out', 'trip-viewer-options.html');
writeFileSync(out, page);
console.log(out);
