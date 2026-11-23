/**
 * The passport's front page (the top of the passport, above the stamp rows):
 * directions for the project lead (23 Nov 2026). Sketches, not a build.
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-passport-cover-options.mjs
 *     → tools/out/passport-cover-options.html
 *
 * Each frame is a phone at 360 x 780 dp, in Portuguese, with the app's real
 * art: stamps through `stampSvg`, set medals through `medalArt.ts`, the island
 * from `content/regions.json`. The counts are the paywall sketch's (30 of 81,
 * the P30's on 23 Nov). The kilometres and days are example values.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { medalSvg, stampSvg } from './lib/svg-render.mjs';
import { setMedalElements } from '../app/src/passport/medalArt.ts';
import { STRINGS } from '../app/src/i18n/strings.ts';
import { album, reward } from '../app/src/ui/theme.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(path.join(here, '..', 'content', name), 'utf8'));
const pack = read('pois.json');
const regions = read('regions.json');
const byId = new Map(pack.places.map((place) => [place.id, place]));

const TOTAL = 81;
const VISITED = 30;
const KM = '412 km';
const DAYS = 6;
const SETS = [['viewpoint', 5, 20], ['levada', 0, 18], ['village', 9, 19], ['beach', 6, 8], ['landmark', 10, 16]];
const RECENT = ['praia-formosa', 'cabo-girao', 'camara-de-lobos'];

const sized = (svg, size) => svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
const stamp = (id, size, collected = true) => {
  const place = byId.get(id);
  return sized(stampSvg(place.id, place.name, place.category, collected), size);
};
const cat = (c) => STRINGS[`passport.category.${c}`].pt;
const setMedal = (c, n, t, size) =>
  sized(medalSvg(setMedalElements({ emblem: { kind: 'category', category: c }, name: cat(c), collected: n, total: t, look: 'silver' })), size);

// ── The island (Madeira only), as in the paywall sketch ─────────────────────
const rings = regions.features
  .filter((f) => f.properties.islandId === 'ilha-da-madeira')
  .flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((p) => ({ id: f.properties.id, ring: p[0] })));
const pts = rings.flatMap((r) => r.ring).filter(([lon]) => lon < -16.62);
const [minLon, maxLon, minLat, maxLat] = [
  Math.min(...pts.map((p) => p[0])) - 0.01, Math.max(...pts.map((p) => p[0])) + 0.01,
  Math.min(...pts.map((p) => p[1])) - 0.01, Math.max(...pts.map((p) => p[1])) + 0.01,
];
const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
const madeiraPlaces = pack.places.filter((p) => p.regionId !== 'porto-santo');
const visited = new Set(madeiraPlaces.filter((_, i) => i % 3 !== 2).slice(0, VISITED).map((p) => p.id));

/** `style`: 'dots' (gold places), 'emboss' (outline only, for a cover). */
function islandSvg(width, style, opts = {}) {
  const scale = width / ((maxLon - minLon) * kx);
  const height = (maxLat - minLat) * scale;
  const xy = (lon, lat) => [((lon - minLon) * kx * scale).toFixed(1), ((maxLat - lat) * scale).toFixed(1)];
  const d = (ring) => ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${xy(lon, lat).join(' ')}`).join('') + 'Z';
  if (style === 'emboss') {
    const shapes = rings.map(({ ring }) => `<path d="${d(ring)}" fill="${opts.fill}" stroke="${opts.stroke}" stroke-width="${opts.width ?? 0.8}"/>`).join('');
    return `<svg width="${width}" height="${height.toFixed(0)}" viewBox="0 0 ${width} ${height.toFixed(0)}">${shapes}</svg>`;
  }
  const shapes = rings.map(({ ring }) => `<path d="${d(ring)}" fill="#2A2A2E" stroke="#3E3E44" stroke-width="0.6"/>`).join('');
  const dots = madeiraPlaces
    .map((p) => {
      const [x, y] = xy(p.geofences[0].lon, p.geofences[0].lat);
      return visited.has(p.id)
        ? `<circle cx="${x}" cy="${y}" r="6" fill="${reward.gold}" opacity="0.22"/><circle cx="${x}" cy="${y}" r="3" fill="${reward.gold}"/>`
        : `<circle cx="${x}" cy="${y}" r="2.2" fill="#5E5E66"/>`;
    })
    .join('');
  return `<svg width="${width}" height="${height.toFixed(0)}" viewBox="0 0 ${width} ${height.toFixed(0)}">${shapes}${dots}</svg>`;
}

// ── Shared pieces of the real page ──────────────────────────────────────────
const bar = `<div class="bar"><span>‹ Mapa</span><span>Partilhar</span></div>`;
const nudge = `<div class="nudge"><div class="nfan">${RECENT.map((id) => `<span class="nl">${stamp(id, 34)}</span>`).join('')}</div>
  <div class="ntext"><b>25 carimbos à tua espera</b><span>Desbloqueia todos de uma vez</span></div><span class="nbtn">Ver</span></div>`;
const firstRow = `<div class="rowhead"><span class="rt">MIRADOUROS</span><span class="rc">5 de 20</span><span class="see">Ver tudo</span></div>
  <div class="panel">${stamp('pico-do-areeiro', 82)}${stamp('fanal', 82)}${stamp('achada-do-teixeira', 82, false)}${stamp('bica-da-cana', 82, false)}</div>`;
const page = (hero, { withNudge = true } = {}) => `${bar}<div class="scroll">${hero}${withNudge ? nudge : ''}${firstRow}</div>`;

const frames = [];

frames.push({
  name: 'Hoje',
  note: 'O que está no P30: o título grande, o número, quatro linhas de texto centradas e o link azul. Tudo texto, nada da arte da app até ao primeiro carimbo.',
  body: page(`<div class="h1">Passaporte</div>
    <div class="today"><div class="big">${VISITED}<small> / ${TOTAL}</small></div><div class="muted">lugares visitados</div>
    <div class="line">${KM} de estradas acesas em ${DAYS} dias</div><div class="muted sm">1 204 km em todas as viagens</div>
    <div class="link">Ver a tua viagem</div></div>`),
});

frames.push({
  name: 'A. A capa',
  note: 'A página abre como um passaporte fechado: capa escura com a ilha e o nome gravados a dourado. O número fica numa linha só por baixo. É a única que faz o ecrã parecer um objeto e não uma lista.',
  body: page(`<div class="cover">
      <div class="crest">${islandSvg(200, 'emboss', { fill: 'none', stroke: '#D9B45A', width: 1.1 })}</div>
      <div class="ctitle">PASSAPORTE</div><div class="csub">MADEIRA</div><div class="cbrand">BRUMA</div>
    </div>
    <div class="coverline"><b>${VISITED}</b> de ${TOTAL} lugares · ${KM} em ${DAYS} dias</div>
    <div class="link c">Ver a tua viagem</div>`),
});

frames.push({
  name: 'B. A tua ilha',
  note: 'O mapa da ilha com os teus lugares a dourado, o número por cima. Liga o passaporte ao que a app é: onde estiveste. Tocar no mapa abre a tua viagem, por isso o link azul desaparece.',
  body: page(`<div class="h1">Passaporte</div>
    <div class="isle"><div class="isleNum"><div class="big">${VISITED}<small> / ${TOTAL}</small></div><div class="muted">lugares visitados</div></div>
    ${islandSvg(328, 'dots')}<div class="play">▶ Ver a tua viagem</div></div>
    <div class="line c">${KM} de estradas acesas em ${DAYS} dias</div>`),
});

frames.push({
  name: 'C. Os últimos carimbos',
  note: 'Os três carimbos mais recentes, grandes e tortos como batidos à mão, com a data. O número passa a etiqueta. A primeira coisa que se vê é a arte, que é o que a app tem de mais bonito.',
  body: page(`<div class="h1">Passaporte</div>
    <div class="pile"><span class="p0">${stamp(RECENT[1], 118)}</span><span class="p1">${stamp(RECENT[2], 118)}</span><span class="p2">${stamp(RECENT[0], 140)}</span></div>
    <div class="pilecap">Último: Praia Formosa, 22 nov</div>
    <div class="chips"><span><b>${VISITED}</b> / ${TOTAL} lugares</span><span><b>${KM}</b></span><span><b>${DAYS}</b> dias</span></div>
    <div class="link c">Ver a tua viagem</div>`),
});

frames.push({
  name: 'D. Os cinco conjuntos',
  note: 'O total num anel e, por baixo, as cinco medalhas com o seu progresso. Mostra logo que há um jogo e o que falta (levadas a zero salta à vista). Cada medalha leva à sua fila.',
  body: page(`<div class="h1">Passaporte</div>
    <div class="ringwrap"><svg width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="64" fill="none" stroke="#2E2E33" stroke-width="10"/>
      <circle cx="75" cy="75" r="64" fill="none" stroke="${reward.gold}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${((2 * Math.PI * 64 * VISITED) / TOTAL).toFixed(1)} 999" transform="rotate(-90 75 75)"/></svg>
      <div class="ringnum"><div class="big s">${VISITED}</div><div class="muted">de ${TOTAL}</div></div></div>
    <div class="sets">${SETS.map(([c, n, t]) => `<div class="set">${setMedal(c, n, t, 54)}<span class="sn">${cat(c)}</span><span class="sc">${n}/${t}</span></div>`).join('')}</div>`),
});

frames.push({
  name: 'E. A página de identificação',
  note: 'Como a página da fotografia de um passaporte: o último carimbo no lugar da foto, os números como campos escritos à máquina e a linha de leitura óptica em baixo. Divertida; arrisca ser só um truque à segunda visita.',
  body: page(`<div class="idpage">
      <div class="idtop">PASSAPORTE · MADEIRA</div>
      <div class="idgrid"><div class="photo">${stamp(RECENT[0], 96)}</div>
        <div class="fields">
          <div><i>Lugares</i><b>${VISITED} de ${TOTAL}</b></div>
          <div><i>Estradas acesas</i><b>${KM}</b></div>
          <div><i>Dias na ilha</i><b>${DAYS}</b></div>
          <div><i>Primeira entrada</i><b>14 OUT 2026</b></div>
        </div></div>
      <div class="mrz">P&lt;MADEIRA&lt;&lt;BRUMA&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;<br>030&lt;081&lt;&lt;0412KM&lt;&lt;06D&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
    </div><div class="link c">Ver a tua viagem</div>`),
});

frames.push({
  name: 'F. Só o essencial',
  note: 'O mínimo: o número grande à esquerda, uma barra de 81 traços (um por lugar, na cor da sua categoria) e uma linha. Sem título grande, porque a barra de cima já diz onde se está. Ganha altura para os carimbos.',
  body: page(`<div class="minimal"><div class="big l">${VISITED}<small> / ${TOTAL}</small></div><div class="muted">lugares visitados · ${KM} em ${DAYS} dias</div>
    <div class="ticks">${SETS.flatMap(([c, n, t]) => Array.from({ length: t }, (_, i) => `<i class="k-${c}${i < n ? ' on' : ''}"></i>`)).join('')}</div>
    <div class="legend">${SETS.map(([c]) => `<span><i class="k-${c} on"></i>${cat(c)}</span>`).join('')}</div>
    <div class="link">Ver a tua viagem</div></div>`, { withNudge: true }),
});

const CSS = `
body { margin: 0; padding: 24px; background: #0E0E10; color: #EEE; font: 14px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; }
h1 { font-size: 22px; margin: 0 0 6px; } p.lead { max-width: 900px; color: #AAA; margin: 0 0 20px; }
.frames { display: flex; flex-wrap: wrap; gap: 28px; }
figure { margin: 0; width: 360px; } figcaption { margin-top: 10px; color: #BBB; font-size: 13px; } figcaption b { display: block; color: #FFF; font-size: 15px; margin-bottom: 2px; }
.phone { width: 360px; height: 780px; background: ${album.background}; border-radius: 28px; overflow: hidden; position: relative; box-shadow: 0 0 0 2px #333; color: ${album.text}; }
.bar { display: flex; justify-content: space-between; padding: 40px 16px 8px; color: ${album.tint}; font-size: 17px; }
.scroll { padding: 4px 16px 0; }
.h1 { font-size: 32px; font-weight: 700; letter-spacing: .4px; }
.big { font-size: 56px; font-weight: 800; line-height: 1; } .big small { font-size: 24px; color: ${album.textMuted}; font-weight: 600; } .big.s { font-size: 44px; } .big.l { text-align: left; }
.muted { color: ${album.textMuted}; } .sm { font-size: 12px; } .c { text-align: center; }
.today { text-align: center; padding: 12px 0; } .line { margin-top: 8px; } .link { color: ${album.tint}; font-weight: 600; margin-top: 8px; }
.nudge { display: flex; align-items: center; gap: 10px; background: linear-gradient(${reward.panelTop}, ${reward.panelBottom}); border-radius: 14px; padding: 10px 12px; margin: 14px 0 6px; }
.nfan { display: flex; } .nl { margin-left: -12px; filter: blur(1px) saturate(.6); } .nl:first-child { margin-left: 0; }
.ntext { flex: 1; display: flex; flex-direction: column; font-size: 13px; } .ntext span { color: ${reward.textMuted}; font-size: 12px; }
.nbtn { background: ${reward.goldButton}; color: #1C1C1E; font-weight: 700; border-radius: 14px; padding: 4px 12px; font-size: 13px; }
.rowhead { display: flex; gap: 12px; align-items: baseline; margin-top: 16px; } .rt { flex: 1; color: ${album.textMuted}; letter-spacing: 1px; font-size: 15px; } .rc { color: ${album.textMuted}; } .see { color: ${album.tint}; }
.panel { display: flex; gap: 4px; border: 1px solid ${album.hairline}; border-radius: 16px; padding: 14px 10px; margin-top: 10px; overflow: hidden; }
.cover { margin: 4px 0 0; height: 300px; border-radius: 6px 18px 18px 6px; background: radial-gradient(120% 90% at 30% 20%, #1F4A3E, #0F2A23); box-shadow: inset 8px 0 0 #0A1F19, inset 0 0 0 1px #2D5E50, 0 8px 20px #0008;
  display: flex; flex-direction: column; align-items: center; justify-content: center; color: #D9B45A; }
.crest { margin-bottom: 18px; filter: drop-shadow(0 1px 0 #0008); } .ctitle { letter-spacing: 6px; font-size: 20px; font-weight: 700; } .csub { letter-spacing: 4px; font-size: 13px; margin-top: 4px; opacity: .9; } .cbrand { letter-spacing: 3px; font-size: 10px; margin-top: 26px; opacity: .7; }
.coverline { text-align: center; margin-top: 14px; color: ${album.textMuted}; } .coverline b { color: ${album.text}; font-size: 18px; }
.isle { position: relative; margin-top: 8px; } .isleNum { text-align: center; } .isle svg { margin-top: 6px; display: block; }
.play { position: absolute; right: 6px; bottom: 4px; color: ${album.tint}; font-weight: 600; font-size: 13px; }
.pile { position: relative; height: 200px; margin-top: 6px; } .pile span { position: absolute; filter: drop-shadow(0 4px 6px #0009); }
.p0 { left: 18px; top: 36px; transform: rotate(-12deg); } .p1 { right: 18px; top: 30px; transform: rotate(10deg); } .p2 { left: 110px; top: 22px; transform: rotate(-3deg); }
.pilecap { text-align: center; color: ${album.textMuted}; font-size: 13px; }
.chips { display: flex; justify-content: center; gap: 8px; margin-top: 10px; } .chips span { background: ${album.surface}; border-radius: 12px; padding: 4px 10px; font-size: 13px; color: ${album.textMuted}; } .chips b { color: ${album.text}; }
.ringwrap { position: relative; width: 150px; height: 150px; margin: 10px auto 0; } .ringnum { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.sets { display: flex; justify-content: space-between; margin-top: 14px; } .set { display: flex; flex-direction: column; align-items: center; width: 64px; } .sn { font-size: 11px; color: ${album.textMuted}; } .sc { font-size: 12px; font-weight: 700; }
.idpage { margin-top: 6px; background: linear-gradient(160deg, #F3EBD8, #E6D8B8); color: #3A3224; border-radius: 12px; padding: 12px; box-shadow: 0 6px 16px #0008;
  background-image: repeating-linear-gradient(45deg, #0000 0 10px, #B8A27A14 10px 11px), linear-gradient(160deg, #F3EBD8, #E6D8B8); }
.idtop { font-size: 11px; letter-spacing: 3px; font-weight: 700; color: #6B5A3A; margin-bottom: 8px; }
.idgrid { display: flex; gap: 12px; } .photo { width: 104px; height: 120px; background: #FFF8; border: 1px solid #C9B58C; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
.fields { flex: 1; display: flex; flex-direction: column; gap: 4px; } .fields i { display: block; font-style: normal; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #8A7752; } .fields b { font-family: "Courier New", monospace; font-size: 15px; }
.mrz { font-family: "Courier New", monospace; font-size: 12.5px; letter-spacing: .5px; margin-top: 10px; color: #4A3F2C; word-break: break-all; }
.minimal { padding: 6px 0 2px; } .ticks { display: grid; grid-template-columns: repeat(27, 1fr); gap: 3px; margin-top: 14px; } .ticks i, .legend i { height: 16px; border-radius: 2px; background: #333338; display: block; }
.ticks i.on.k-viewpoint, .legend .k-viewpoint { background: #E4572E; } .ticks i.on.k-levada, .legend .k-levada { background: #3FA34D; } .ticks i.on.k-village, .legend .k-village { background: #F0A030; }
.ticks i.on.k-beach, .legend .k-beach { background: #2CB5C0; } .ticks i.on.k-landmark, .legend .k-landmark { background: #9B6BE0; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 8px; font-size: 11px; color: ${album.textMuted}; } .legend span { display: flex; align-items: center; gap: 4px; } .legend i { width: 8px; height: 8px; }
`;

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Passaporte: a primeira página</title><style>${CSS}</style></head><body>
<h1>A primeira página do passaporte: seis ideias</h1>
<p class="lead">Só o topo do passaporte, por cima das filas de carimbos (a primeira fila aparece em baixo em cada um, para se ver a transição). Carimbos, medalhas e ilha verdadeiros da app, num telemóvel de 360 x 780 dp. 30 de 81 lugares como no P30; os quilómetros e os dias são de exemplo. O cartão de desbloquear fica igual em todos.</p>
<div class="frames">${frames.map((f) => `<figure><div class="phone">${f.body}</div><figcaption><b>${f.name}</b>${f.note}</figcaption></figure>`).join('')}</div></body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
writeFileSync(path.join(here, 'out', 'passport-cover-options.html'), html);
console.log('tools/out/passport-cover-options.html');

// ── Round 2 (23 Nov): the lead liked none enough to pick; seven more ────────
// Counts here come from the sketch's visited set itself, so every row, mosaic
// and collage agrees with the 30.
const ORDER = ['viewpoint', 'levada', 'village', 'beach', 'landmark'];
const madeiraBy = (c) => madeiraPlaces.filter((p) => p.category === c);
const sets2 = ORDER.map((c) => [c, madeiraBy(c).filter((p) => visited.has(p.id)).length, madeiraBy(c).length]);
const mine = madeiraPlaces.filter((p) => visited.has(p.id)).map((p) => p.id);
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function outline(islandId, width, stroke, fill = 'none') {
  const rs = regions.features
    .filter((f) => f.properties.islandId === islandId)
    .flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((p) => p[0]));
  const ps = rs.flat().filter(([lon]) => islandId !== 'ilha-da-madeira' || lon < -16.62);
  const [a, b, c, d] = [Math.min(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[1]))];
  const k = Math.cos(((c + d) / 2) * (Math.PI / 180));
  const s = width / ((b - a) * k);
  const h = (d - c) * s;
  const shape = rs.map((r) => r.map(([lon, lat], i) => `${i ? 'L' : 'M'}${((lon - a) * k * s).toFixed(1)} ${((d - lat) * s).toFixed(1)}`).join('') + 'Z').join('');
  return `<svg width="${width}" height="${h.toFixed(0)}" viewBox="-2 -2 ${width + 4} ${(h + 4).toFixed(0)}" style="overflow:hidden"><path d="${shape}" fill="${fill}" stroke="${stroke}" stroke-width="1.1"/></svg>`;
}

const frames2 = [];

frames2.push({
  name: 'G. A página carimbada',
  note: 'A primeira página é uma página de papel do passaporte, cheia dos teus carimbos batidos uns por cima dos outros, como num passaporte verdadeiro depois de muitas viagens. Começa vazia e vai enchendo. O número fica num canto, pequeno. Uma página que é tua e de mais ninguém.',
  body: page(`<div class="paper collage"><div class="ptag">${VISITED} de ${TOTAL}</div>${mine
    .slice(0, 16)
    .map((id) => `<span style="left:${(rand() * 230).toFixed(0)}px;top:${(14 + rand() * 210).toFixed(0)}px;transform:rotate(${(rand() * 40 - 20).toFixed(0)}deg)">${stamp(id, 78)}</span>`)
    .join('')}</div><div class="link c">Ver a tua viagem</div>`),
});

frames2.push({
  name: 'H. O mosaico',
  note: 'Os 81 carimbos de uma vez, pequenos, por categoria: os teus a cores, os outros em cinzento. Num relance vê-se o que já tens e onde há buracos. Tocar num abre-o. As filas de baixo podiam até deixar de ser precisas.',
  body: page(`<div class="h1">Passaporte</div><div class="mline"><b>${VISITED}</b> de ${TOTAL} lugares · ${KM} em ${DAYS} dias</div>
    <div class="mosaic">${ORDER.flatMap((c) => madeiraBy(c).map((p) => `<span>${stamp(p.id, 34, visited.has(p.id))}</span>`)).join('')}</div>`, { withNudge: false }),
});

frames2.push({
  name: 'I. Dois passaportes',
  note: 'As capas dos dois passaportes lado a lado, Madeira à frente e Porto Santo a espreitar à direita: desliza-se para mudar de ilha. Porto Santo sobe do fundo da página para o topo, sem ganhar mais peso do que tem. Cada capa tem o seu número.',
  body: page(`<div class="duo"><div class="book m"><div class="bisle">${outline('ilha-da-madeira', 170, '#D9B45A')}</div><div class="bt">PASSAPORTE</div><div class="bs">MADEIRA</div><div class="bn">${VISITED} de 81</div></div>
    <div class="book ps"><div class="bisle">${outline('porto-santo', 80, '#7A5A2A')}</div><div class="bt">PASSAPORTE</div><div class="bs">PORTO SANTO</div><div class="bn">0 de 9</div></div></div>
    <div class="dots2"><i class="on"></i><i></i></div><div class="link c">Ver a tua viagem</div>`),
});

frames2.push({
  name: 'J. O índice',
  note: 'Como a primeira página de um livro: um índice com letra serifada e linhas pontilhadas até ao número. Cada linha leva à sua secção. Calmo e elegante; perde a arte, mas a arte vem logo a seguir.',
  body: page(`<div class="toc"><div class="tt">Passaporte</div><div class="tsub">Madeira · ${VISITED} de ${TOTAL} lugares</div>
    ${sets2.map(([c, n, t]) => `<div class="tr"><span>${cat(c)}</span><i></i><b>${n} / ${t}</b></div>`).join('')}
    <div class="tr ps first"><span>Porto Santo</span><i></i><b>0 / 9</b></div><div class="tr ps"><span>As tuas viagens</span><i></i><b>3</b></div></div>`, { withNudge: false }),
});

frames2.push({
  name: 'K. O bilhete da viagem',
  note: 'O topo é a viagem de agora, desenhada como um bilhete: datas, dias, estradas, carimbos desta viagem. O canhoto destacável é o botão para ver a viagem. O total do passaporte desce para uma linha. Faz sentido para quem abre a app durante a viagem.',
  body: page(`<div class="h1">Passaporte</div>
    <div class="ticket"><div class="tmain"><div class="tlab">VIAGEM</div><div class="troute">14 OUT <span>→</span> HOJE</div>
      <div class="tgrid"><div><i>Dias</i><b>${DAYS}</b></div><div><i>Estradas</i><b>${KM}</b></div><div><i>Carimbos</i><b>12</b></div></div></div>
      <div class="tstub"><div class="tplay">▶</div><div>Ver</div></div></div>
    <div class="mline c"><b>${VISITED}</b> de ${TOTAL} lugares no passaporte</div>`),
});

frames2.push({
  name: 'L. A capa entreaberta',
  note: 'A capa da ideia A, com os teus três últimos carimbos a sair por cima dela, como papéis guardados lá dentro. Junta o objeto (a capa) e a arte (os carimbos). Sem carimbos, a capa fica fechada e limpa.',
  body: page(`<div class="ajar">${RECENT.map((id, i) => `<span class="aj aj${i}">${stamp(id, 96)}</span>`).join('')}
    <div class="cover small"><div class="crest">${outline('ilha-da-madeira', 150, '#D9B45A')}</div><div class="ctitle">PASSAPORTE</div><div class="csub">MADEIRA</div></div></div>
    <div class="coverline"><b>${VISITED}</b> de ${TOTAL} lugares · ${KM} em ${DAYS} dias</div>`),
});

frames2.push({
  name: 'M. As medalhas na prateleira',
  note: 'As cinco medalhas, grandes, numa prateleira que desliza, a mais perto de completa primeiro, com o que falta escrito por baixo ("faltam 2"). O topo deixa de contar o passado e passa a mostrar o próximo objetivo.',
  body: page(`<div class="h1">Passaporte</div><div class="mline"><b>${VISITED}</b> de ${TOTAL} lugares · ${KM} em ${DAYS} dias</div>
    <div class="shelf">${[...sets2].sort((x, y) => x[2] - x[1] - (y[2] - y[1])).map(([c, n, t]) => `<div class="sm2">${setMedal(c, n, t, 96)}<b>${cat(c)}</b><span>${t - n === 0 ? 'completo' : `faltam ${t - n}`}</span></div>`).join('')}</div>`),
});

const CSS2 = `
.paper { position: relative; height: 330px; margin-top: 4px; border-radius: 8px; background: repeating-linear-gradient(0deg, #0000 0 22px, #B8A27A18 22px 23px), linear-gradient(160deg, #F1E8D2, #E2D2AE); box-shadow: 0 6px 16px #0008; overflow: hidden; }
.collage span { position: absolute; filter: drop-shadow(0 1px 1px #0005); opacity: .95; } .ptag { position: absolute; right: 10px; bottom: 8px; z-index: 2; font: 700 13px "Courier New", monospace; color: #5A4A2E; background: #F1E8D2; padding: 2px 6px; border-radius: 4px; }
.mline { color: ${album.textMuted}; margin: 2px 0 10px; } .mline b { color: ${album.text}; font-size: 18px; }
.mosaic { display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; } .mosaic span { display: flex; justify-content: center; }
.duo { display: flex; gap: 12px; margin-top: 6px; overflow: hidden; height: 300px; } .book { flex: 0 0 auto; border-radius: 6px 16px 16px 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.book.m { width: 250px; background: radial-gradient(120% 90% at 30% 20%, #1F4A3E, #0F2A23); color: #D9B45A; box-shadow: inset 7px 0 0 #0A1F19, 0 8px 18px #0009; }
.book.ps { width: 250px; background: radial-gradient(120% 90% at 30% 20%, #E8D3A6, #CDB27C); color: #6A4C1E; transform: scale(.92); opacity: .9; box-shadow: inset 7px 0 0 #B89A60; }
.bisle { margin-bottom: 18px; } .bt { letter-spacing: 5px; font-weight: 700; } .bs { letter-spacing: 3px; font-size: 12px; margin-top: 4px; } .bn { margin-top: 26px; font-size: 13px; opacity: .85; }
.dots2 { display: flex; gap: 6px; justify-content: center; margin-top: 10px; } .dots2 i { width: 7px; height: 7px; border-radius: 4px; background: #ffffff33; } .dots2 i.on { width: 18px; background: ${album.text}; }
.toc { font-family: Georgia, "Times New Roman", serif; padding: 8px 4px 0; } .tt { font-size: 38px; font-style: italic; } .tsub { color: ${album.textMuted}; margin: 2px 0 18px; font-size: 15px; }
.tr { display: flex; align-items: baseline; gap: 6px; font-size: 19px; padding: 9px 0; } .tr i { flex: 1; border-bottom: 2px dotted #55555c; transform: translateY(-4px); } .tr b { font-weight: 400; color: ${album.textMuted}; font-variant-numeric: tabular-nums; } .tr.ps { font-size: 16px; color: ${album.textMuted}; } .tr.first { margin-top: 10px; border-top: 1px solid ${album.hairline}; padding-top: 16px; }
.ticket { display: flex; margin-top: 12px; border-radius: 14px; background: linear-gradient(135deg, #243B55, #1B2A3C); overflow: hidden; } .tmain { flex: 1; padding: 14px; } .tlab { font-size: 11px; letter-spacing: 3px; color: #9DB4CC; }
.troute { font: 700 22px "Courier New", monospace; margin: 4px 0 12px; } .troute span { color: #9DB4CC; } .tgrid { display: flex; gap: 18px; } .tgrid i { display: block; font-style: normal; font-size: 11px; color: #9DB4CC; } .tgrid b { font-size: 18px; }
.tstub { width: 70px; border-left: 2px dashed #ffffff40; display: flex; flex-direction: column; align-items: center; justify-content: center; color: ${album.tint}; font-weight: 700; background: #ffffff08; } .tplay { font-size: 26px; }
.mline.c { text-align: center; margin-top: 12px; }
.ajar { position: relative; padding-top: 74px; } .aj { position: absolute; top: 0; filter: drop-shadow(0 4px 6px #0009); } .aj0 { left: 30px; transform: rotate(-14deg); top: 10px; } .aj1 { left: 128px; transform: rotate(3deg); } .aj2 { left: 220px; transform: rotate(16deg); top: 14px; }
.cover.small { position: relative; height: 230px; z-index: 2; margin-top: 0; } .cover.small .crest { margin-bottom: 12px; }
.shelf { display: flex; gap: 14px; overflow: hidden; margin-top: 6px; padding: 8px 0 14px; border-bottom: 3px solid #3A3A40; } .sm2 { flex: 0 0 auto; width: 104px; display: flex; flex-direction: column; align-items: center; } .sm2 b { font-size: 13px; margin-top: 4px; } .sm2 span { font-size: 12px; color: ${reward.goldInk}; }
`;

const html2 = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Passaporte: mais ideias</title><style>${CSS}${CSS2}</style></head><body>
<h1>A primeira página do passaporte: mais sete ideias</h1>
<p class="lead">Ronda 2, por caminhos diferentes dos da primeira: papel em vez de ecrã, a coleção inteira de uma vez, as duas ilhas, um índice, a viagem de agora, a capa com os carimbos e o próximo objetivo em vez do passado. As mesmas regras: arte verdadeira, 30 de 81 como no P30, quilómetros, dias e datas de exemplo.</p>
<div class="frames">${frames2.map((f) => `<figure><div class="phone">${f.body}</div><figcaption><b>${f.name}</b>${f.note}</figcaption></figure>`).join('')}</div></body></html>`;
writeFileSync(path.join(here, 'out', 'passport-cover-options-2.html'), html2);
console.log('tools/out/passport-cover-options-2.html');

// ── Round 3 (23 Nov): back to round 1. The lead: today's top is "a bit too
// plain, the text a bit simple, and above all it takes a lot of space for
// what it says". Every frame here is shorter than today's, and a script in
// the page measures where the first stamp row starts in each.
const SEG = { viewpoint: '#E4572E', levada: '#3FA34D', village: '#F0A030', beach: '#2CB5C0', landmark: '#9B6BE0' };
const segBar = (h = 6) =>
  `<div class="seg" style="height:${h}px">${SETS.map(([c, n, t]) => `<span style="flex:${t}"><i style="width:${(n / t) * 100}%;background:${SEG[c]}"></i></span>`).join('')}</div>`;
const postmark = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 100 100" class="pm">
  <defs><path id="pmr" d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0"/></defs>
  <circle cx="50" cy="50" r="47" fill="none" stroke="#D9B45A" stroke-width="2.4"/><circle cx="50" cy="50" r="30" fill="none" stroke="#D9B45A" stroke-width="1.4"/>
  <text font-size="9.5" font-weight="700" letter-spacing="2.2" fill="#D9B45A"><textPath href="#pmr">MADEIRA · PASSAPORTE · BRUMA ·</textPath></text>
  <text x="50" y="53" text-anchor="middle" font-size="24" font-weight="800" fill="#F2F2F7">${VISITED}</text>
  <text x="50" y="68" text-anchor="middle" font-size="10" font-weight="600" fill="#AEAEB2">de ${TOTAL}</text></svg>`;
const play = `<span class="playpill">▶ Ver viagem</span>`;
const mark = `<div class="mark"></div>`;
const page3 = (hero) => page(`${hero}`).replace('<div class="rowhead">', `${mark}<div class="rowhead">`);

const frames3 = [];

frames3.push({
  name: 'Hoje',
  note: 'O que está no P30, para comparar. A linha tracejada marca onde começa a primeira fila de carimbos.',
  body: page3(`<div class="h1">Passaporte</div>
    <div class="today"><div class="big">${VISITED}<small> / ${TOTAL}</small></div><div class="muted">lugares visitados</div>
    <div class="line">${KM} de estradas acesas em ${DAYS} dias</div><div class="muted sm">1 204 km em todas as viagens</div>
    <div class="link">Ver a tua viagem</div></div>`),
});

frames3.push({
  name: '1. Título com o número ao lado',
  note: 'O número sobe para a linha do título, a dourado. Por baixo, uma barra com as cinco categorias nas suas cores e uma linha com os quilómetros e o botão da viagem. Três linhas em vez de seis.',
  body: page3(`<div class="t1"><div class="h1">Passaporte</div><div class="gold"><b>${VISITED}</b>/${TOTAL}</div></div>
    ${segBar(7)}<div class="sub1"><span>${KM} de estradas acesas em ${DAYS} dias</span>${play}</div>`),
});

frames3.push({
  name: '2. A capa em faixa',
  note: 'A capa da ideia A, achatada numa faixa: verde e dourado, a ilha gravada à direita, o número à esquerda. Fica com o carácter de passaporte da A em menos de metade da altura de hoje. A faixa toda abre a viagem.',
  body: page3(`<div class="band"><div class="bleft"><div class="beye">PASSAPORTE · MADEIRA</div><div class="bnum">${VISITED}<small> de ${TOTAL} lugares</small></div>
      <div class="bkm">${KM} em ${DAYS} dias · <u>▶ ver viagem</u></div></div>
      <div class="bisle2">${islandSvg(104, 'emboss', { fill: 'none', stroke: '#D9B45A', width: 1 })}</div></div>`),
});

frames3.push({
  name: '3. A ilha ao lado',
  note: 'A ideia B, encolhida: o número e os quilómetros à esquerda, a ilha com os teus lugares a dourado à direita. Tocar na ilha abre a viagem. Lembra que a app é sobre onde estiveste sem gastar o ecrã todo.',
  body: page3(`<div class="h1">Passaporte</div>
    <div class="side"><div class="sl"><div class="big m">${VISITED}<small> / ${TOTAL}</small></div><div class="muted sm2b">lugares visitados</div><div class="sm2b">${KM} · ${DAYS} dias</div></div>
      <div class="sr">${islandSvg(178, 'dots')}<span class="mini">▶</span></div></div>`),
});

frames3.push({
  name: '4. O carimbo do passaporte',
  note: 'O número dentro de um carimbo redondo, como o da fronteira, com "Madeira · Passaporte · Bruma" à volta e ligeiramente torto. Ao lado, as duas linhas de texto. Dá ao topo a cara do resto do passaporte, em pouco espaço.',
  body: page3(`<div class="h1">Passaporte</div>
    <div class="pmrow">${postmark(108)}<div class="pmt"><div class="pml">${KM} de estradas acesas</div><div class="muted sm">em ${DAYS} dias · 1 204 km em todas</div>${play}</div></div>`),
});

frames3.push({
  name: '5. Três números',
  note: 'Lugares, estradas e dias lado a lado, cada um grande com a sua palavra por baixo, num cartão. A viagem é o botão à direita. Arrumado e informativo; é o mais "painel" de todos.',
  body: page3(`<div class="h1">Passaporte</div>
    <div class="trio"><div><b>${VISITED}<small>/${TOTAL}</small></b><span>lugares</span></div><div><b>412</b><span>km acesos</span></div><div><b>${DAYS}</b><span>dias</span></div><div class="tplay2">▶</div></div>`),
});

frames3.push({
  name: '6. Tudo na barra de cima',
  note: 'O extremo: sem título grande. A barra de cima diz "Passaporte 30/81" ao centro e por baixo fica só a barra das categorias e a linha da viagem. Os carimbos começam quase no topo do ecrã.',
  body: `<div class="bar b6"><span>‹ Mapa</span><span class="ctr">Passaporte <em>${VISITED}/${TOTAL}</em></span><span>Partilhar</span></div><div class="scroll">${segBar(6)}
    <div class="sub1"><span>${KM} de estradas acesas em ${DAYS} dias</span>${play}</div>${nudge}${mark}${firstRow}</div>`,
});

const CSS3 = `
.mark { position: relative; height: 0; } .mark::before { content: ''; position: absolute; left: -16px; right: -16px; top: 4px; border-top: 2px dashed #FF5A5A; }
.mark::after { content: attr(data-y); position: absolute; right: -10px; top: -14px; font-size: 11px; font-weight: 700; color: #FF7A7A; background: ${album.background}; padding: 0 4px; }
.t1 { display: flex; align-items: baseline; justify-content: space-between; } .gold { color: ${reward.goldInk}; font-size: 18px; font-weight: 600; } .gold b { font-size: 30px; font-weight: 800; }
.seg { display: flex; gap: 3px; margin-top: 8px; } .seg span { background: #333338; border-radius: 3px; overflow: hidden; } .seg i { display: block; height: 100%; }
.sub1 { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 13px; color: ${album.textMuted}; }
.playpill { color: ${album.tint}; font-weight: 600; font-size: 13px; border: 1px solid #5AA9FF55; border-radius: 14px; padding: 3px 10px; white-space: nowrap; margin-left: 8px; }
.band { display: flex; align-items: center; margin-top: 4px; border-radius: 6px 14px 14px 6px; padding: 12px 12px 12px 18px; background: radial-gradient(140% 120% at 20% 0%, #1F4A3E, #0F2A23); box-shadow: inset 6px 0 0 #0A1F19, 0 6px 14px #0008; color: #D9B45A; }
.bleft { flex: 1; } .beye { white-space: nowrap; font-size: 10px; letter-spacing: 2.5px; font-weight: 700; } .bnum { font-size: 34px; font-weight: 800; color: #F3E3B5; line-height: 1.1; } .bnum small { font-size: 14px; font-weight: 600; color: #D9B45A; } .bkm { font-size: 12px; margin-top: 2px; white-space: nowrap; } .bkm u { text-decoration: none; color: #F3E3B5; }
.side { display: flex; align-items: center; gap: 8px; margin-top: 6px; } .sl { flex: 0 0 auto; } .big.m { font-size: 44px; } .sm2b { font-size: 13px; margin-top: 2px; } .sr { position: relative; } .mini { position: absolute; right: 2px; bottom: -2px; color: ${album.tint}; font-size: 14px; }
.pmrow { display: flex; align-items: center; gap: 14px; margin-top: 6px; } .pm { transform: rotate(-9deg); flex: 0 0 auto; } .pmt { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; } .pml { font-size: 16px; font-weight: 600; } .pmt .playpill { margin: 6px 0 0; }
.trio { display: flex; align-items: center; margin-top: 8px; background: ${album.surface}; border-radius: 14px; padding: 10px 6px; } .trio div { flex: 1; display: flex; flex-direction: column; align-items: center; border-right: 1px solid ${album.hairline}; }
.trio b { font-size: 24px; font-weight: 800; } .trio b small { font-size: 13px; color: ${album.textMuted}; } .trio span { font-size: 12px; color: ${album.textMuted}; } .trio .tplay2 { flex: 0 0 44px; border: 0; color: ${album.tint}; font-size: 20px; }
.b6 { align-items: baseline; } .b6 .ctr { color: ${album.text}; font-weight: 700; } .b6 em { font-style: normal; color: ${reward.goldInk}; margin-left: 4px; }
`;
const MEASURE = `<script>document.querySelectorAll('.phone').forEach((p) => { const m = p.querySelector('.mark'); if (m) m.setAttribute('data-y', 'carimbos a ' + Math.round(m.getBoundingClientRect().top - p.getBoundingClientRect().top) + ' px'); });</script>`;
const html3 = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Passaporte: mais compacto</title><style>${CSS}${CSS3}</style></head><body>
<h1>A primeira página do passaporte: mais carácter, menos espaço</h1>
<p class="lead">Ronda 3, a partir da primeira. Hoje o topo é simples demais e ocupa muito espaço para o que diz. Todas estas são mais baixas do que hoje; a linha vermelha tracejada mostra onde começa a primeira fila de carimbos, medida na página. O cartão de desbloquear fica igual. 30 de 81 como no P30; quilómetros e dias de exemplo.</p>
<div class="frames">${frames3.map((f) => `<figure><div class="phone">${f.body}</div><figcaption><b>${f.name}</b>${f.note}</figcaption></figure>`).join('')}</div>${MEASURE}</body></html>`;
writeFileSync(path.join(here, 'out', 'passport-cover-options-3.html'), html3);
console.log('tools/out/passport-cover-options-3.html');
