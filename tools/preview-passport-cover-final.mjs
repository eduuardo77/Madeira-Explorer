/**
 * The passport's front page: one finished proposal (23 Nov 2026), after three
 * rounds of directions (`preview-passport-cover-options.mjs`). The lead: the
 * top today is too plain, its text too simple, and it takes a lot of room for
 * what it says. Asked for one clean, professional design.
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-passport-cover-final.mjs
 *     → tools/out/passport-cover-final.html
 *
 * Only the app's tokens (`album`, `fontSize`, `spacing`): no new colour. Real
 * stamps through `stampSvg`, the island from `content/regions.json`. 30 of 81
 * as on the P30; kilometres, days and dates are example values.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampSvg } from './lib/svg-render.mjs';
import { album, reward } from '../app/src/ui/theme.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(path.join(here, '..', 'content', name), 'utf8'));
const pack = read('pois.json');
const regions = read('regions.json');
const byId = new Map(pack.places.map((p) => [p.id, p]));
const stamp = (id, size, collected = true) => {
  const p = byId.get(id);
  return stampSvg(p.id, p.name, p.category, collected).replace('<svg ', `<svg width="${size}" height="${size}" `);
};

// The island as a quiet mark: Madeira's coast only, one hairline stroke.
function islandMark(width, stroke) {
  const rs = regions.features
    .filter((f) => f.properties.islandId === 'ilha-da-madeira')
    .flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((p) => p[0]))
    .filter((r) => r.some(([lon]) => lon < -16.62));
  const ps = rs.flat().filter(([lon]) => lon < -16.62);
  const [a, b, c, d] = [Math.min(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[1]))];
  const k = Math.cos(((c + d) / 2) * (Math.PI / 180));
  const s = width / ((b - a) * k);
  const h = (d - c) * s;
  const shape = rs.map((r) => r.filter(([lon]) => lon < -16.62).map(([lon, lat], i) => `${i ? 'L' : 'M'}${((lon - a) * k * s).toFixed(1)} ${((d - lat) * s).toFixed(1)}`).join('') + 'Z').join('');
  return `<svg width="${width}" height="${h.toFixed(0)}" viewBox="-1 -1 ${width + 2} ${(h + 2).toFixed(0)}"><path d="${shape}" fill="${album.surface}" stroke="${stroke}" stroke-width="0.8" stroke-linejoin="round"/></svg>`;
}

const SETS = [['viewpoint', 5, 20], ['levada', 0, 18], ['village', 9, 19], ['beach', 6, 8], ['landmark', 10, 16]];
const track = (sets) => `<div class="track">${sets.map(([, n, t]) => `<span style="flex:${t}"><i style="width:${(n / t) * 100}%"></i></span>`).join('')}</div>`;
const chevron = `<svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" fill="none" stroke="${album.textMuted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const playSvg = `<svg width="13" height="15" viewBox="0 0 10 12"><path d="M1 1v10l8-5z" fill="${album.actionText}"/></svg>`;

const bar = `<div class="nav"><span><svg width="11" height="18" viewBox="0 0 11 18"><path d="M9 2L2 9l7 7" fill="none" stroke="${album.tint}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg> Mapa</span><span>Partilhar</span></div>`;
const nudge = `<div class="nudge"><div class="nfan">${['praia-formosa', 'cabo-girao', 'camara-de-lobos'].map((id) => `<span>${stamp(id, 34)}</span>`).join('')}</div>
  <div class="ntext"><b>25 carimbos à tua espera</b><span>Desbloqueia todos de uma vez</span></div><span class="nbtn">Ver</span></div>`;
const row = (n) => `<div class="mark"></div><div class="rowhead"><span class="rt">MIRADOUROS</span><span class="rc">${n} de 20</span><span class="see">Ver tudo</span></div>
  <div class="panel">${stamp('pico-do-areeiro', 82, n > 0)}${stamp('fanal', 82, n > 1)}${stamp('achada-do-teixeira', 82, false)}${stamp('bica-da-cana', 82, false)}</div>`;

function header({ visited, stats, sets }) {
  return `<header class="hd">
    <div class="titlerow"><h2>Passaporte</h2><div class="mark-isle">${islandMark(84, "#636366")}</div></div>
    <div class="stats">
      <div class="primary"><div class="num">${visited}<span>/ 81</span></div><div class="lab">lugares visitados</div></div>
      ${stats ? `<div class="divider"></div><div class="secondary"><b>${stats.km}</b><span>estradas acesas</span><span>${stats.days}, ${stats.dates}</span></div>
        <div class="play"><span class="playc">${playSvg}</span><span>Viagem</span></div>` : ''}
    </div>
    ${track(sets)}
  </header>`;
}

const main = `${bar}<div class="scroll">${header({ visited: 30, stats: { km: '412 km', days: '6 dias', dates: '14 a 19 out' }, sets: SETS })}${nudge}${row(2)}</div>`;
const empty = `${bar}<div class="scroll">${header({ visited: 0, stats: null, sets: SETS.map(([c, , t]) => [c, 0, t]) })}${row(0)}</div>`;

const today = `${bar}<div class="scroll"><div class="h1">Passaporte</div>
  <div class="today"><div class="big">30<small> / 81</small></div><div class="mut">lugares visitados</div>
  <div class="line">412 km de estradas acesas em 6 dias</div><div class="mut sm">1 204 km em todas as viagens</div>
  <div class="link">Ver a tua viagem</div></div>${nudge}${row(2)}</div>`;

const CSS = `
:root { --bg: ${album.background}; --surface: ${album.surface}; --hair: ${album.hairline}; --text: ${album.text}; --muted: ${album.textMuted}; --tint: ${album.tint}; }
* { box-sizing: border-box; }
body { margin: 0; padding: 40px 48px; background: #0B0B0D; color: #EDEDF0; font: 14px/1.5 -apple-system, "SF Pro Text", "Segoe UI", Roboto, sans-serif; }
.head h1 { font-size: 26px; font-weight: 700; margin: 0 0 6px; letter-spacing: -.2px; } .head p { color: #9A9AA2; max-width: 880px; margin: 0 0 32px; }
.stage { display: flex; gap: 40px; align-items: flex-start; flex-wrap: wrap; }
figure { margin: 0; } figcaption { margin-top: 14px; width: 360px; color: #A8A8B0; font-size: 13px; } figcaption b { color: #FFF; display: block; font-size: 14px; margin-bottom: 2px; }
.phone { width: 360px; height: 780px; border-radius: 34px; background: var(--bg); color: var(--text); overflow: hidden; position: relative; box-shadow: 0 0 0 1.5px #2E2E33, 0 30px 60px #0009; }
.phone.dim { opacity: .9; }
.nav { display: flex; justify-content: space-between; align-items: center; padding: 44px 16px 6px; color: var(--tint); font-size: 17px; } .nav span { display: flex; align-items: center; gap: 6px; }
.scroll { padding: 0 16px; }
.hd { padding-top: 8px; }
.titlerow { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
.eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 1.6px; color: var(--muted); }
h2 { margin: 2px 0 0; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: .2px; }
.mark-isle { margin-top: 4px; }
.stats { display: flex; align-items: center; margin-top: 14px; }
.primary { flex: 0 0 auto; padding-right: 20px; }
.num { font-size: 48px; line-height: 1; font-weight: 700; letter-spacing: -1px; font-variant-numeric: tabular-nums; } .num span { font-size: 20px; font-weight: 600; color: var(--muted); letter-spacing: 0; margin-left: 4px; }
.lab { font-size: 13px; color: var(--muted); margin-top: 6px; }
.divider { width: 1px; align-self: stretch; background: var(--hair); }
.secondary { flex: 1; padding-left: 16px; display: flex; flex-direction: column; } .secondary b { font-size: 17px; font-weight: 600; line-height: 1.25; font-variant-numeric: tabular-nums; } .secondary span { font-size: 12px; color: var(--muted); line-height: 1.45; }
.play { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--tint); }
.track { display: flex; gap: 3px; margin-top: 14px; height: 4px; } .track span { background: var(--surface); border-radius: 2px; overflow: hidden; } .track i { display: block; height: 100%; background: var(--text); border-radius: 2px; }
.action { display: flex; align-items: center; gap: 12px; margin-top: 16px; min-height: 52px; border-top: 1px solid var(--hair); border-bottom: 1px solid var(--hair); }
.playc { width: 44px; height: 44px; border-radius: 50%; background: ${album.action}; display: flex; align-items: center; justify-content: center; padding-left: 3px; }
.atext { flex: 1; font-size: 17px; } .asub { font-size: 13px; color: var(--muted); margin-right: 4px; }
.nudge { display: flex; align-items: center; gap: 10px; background: linear-gradient(${reward.panelTop}, ${reward.panelBottom}); border-radius: 14px; padding: 10px 12px; margin: 16px 0 4px; }
.nfan { display: flex; } .nfan span { margin-left: -12px; filter: blur(1px) saturate(.6); } .nfan span:first-child { margin-left: 0; }
.ntext { flex: 1; display: flex; flex-direction: column; font-size: 13px; } .ntext span { color: ${reward.textMuted}; font-size: 12px; }
.nbtn { background: ${reward.goldButton}; color: #1C1C1E; font-weight: 700; border-radius: 14px; padding: 4px 12px; font-size: 13px; }
.rowhead { display: flex; gap: 12px; align-items: baseline; margin-top: 18px; } .rt { flex: 1; color: var(--muted); letter-spacing: 1px; font-size: 15px; } .rc { color: var(--muted); } .see { color: var(--tint); }
.panel { display: flex; gap: 4px; border: 1px solid var(--hair); border-radius: 16px; padding: 14px 10px; margin-top: 10px; overflow: hidden; }
.mark { position: relative; height: 0; } .mark::before { content: ''; position: absolute; left: -16px; right: -16px; top: 6px; border-top: 1.5px dashed #FF5A5A99; }
.mark::after { content: attr(data-y); position: absolute; right: -8px; top: -12px; font-size: 10.5px; font-weight: 700; color: #FF8080; background: var(--bg); padding: 0 4px; }
.h1 { font-size: 34px; font-weight: 700; } .today { text-align: center; padding: 12px 0; } .big { font-size: 48px; font-weight: 800; line-height: 1; } .big small { font-size: 22px; color: var(--muted); font-weight: 600; }
.mut { color: var(--muted); } .sm { font-size: 12px; } .line { margin-top: 8px; } .link { color: var(--tint); font-weight: 600; margin-top: 8px; }
.spec { width: 380px; font-size: 13px; color: #B4B4BC; } .spec h3 { color: #FFF; font-size: 15px; margin: 0 0 8px; } .spec ol { padding-left: 18px; margin: 0 0 18px; } .spec li { margin-bottom: 8px; } .spec b { color: #FFF; font-weight: 600; }
.spec table { border-collapse: collapse; width: 100%; margin-bottom: 18px; } .spec td { padding: 5px 0; border-bottom: 1px solid #222228; } .spec td:last-child { text-align: right; color: #FFF; font-variant-numeric: tabular-nums; }
`;

const MEASURE = `<script>const out = {}; document.querySelectorAll('.phone').forEach((p) => { const m = p.querySelector('.mark'); if (!m) return; const y = Math.round(m.getBoundingClientRect().top - p.getBoundingClientRect().top); m.setAttribute('data-y', 'carimbos a ' + y + ' px'); out[p.dataset.k] = y; });
document.querySelectorAll('[data-m]').forEach((td) => { td.textContent = out[td.dataset.m] + ' px'; }); document.querySelector('[data-saved]').textContent = (out.today - out.main) + ' px';</script>`;

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Passaporte: primeira página</title><style>${CSS}</style></head><body>
<div class="head"><h1>Passaporte, primeira página</h1><p>Uma proposta acabada. Hierarquia clara, um só alinhamento à esquerda, nenhuma cor nova: só os tokens que o passaporte já usa. O carácter vem de uma marca discreta da ilha e do detalhe, não de decoração.</p></div>
<div class="stage">
  <figure><div class="phone" data-k="main">${main}</div><figcaption><b>Proposta</b>Com viagem em curso e 30 lugares.</figcaption></figure>
  <figure><div class="phone" data-k="empty">${empty}</div><figcaption><b>Proposta, primeiro dia</b>Sem lugares e sem viagem: a coluna da direita e a linha da viagem não aparecem. Nada fica vazio à espera.</figcaption></figure>
  <figure><div class="phone dim" data-k="today">${today}</div><figcaption><b>Hoje, para comparar</b>O mesmo conteúdo, centrado, em seis linhas.</figcaption></figure>
  <div class="spec"><h3>O que muda</h3><ol>
    <li><b>Tudo alinhado à esquerda.</b> Hoje o topo é centrado e as filas por baixo são à esquerda; o olho salta. Uma margem só, de 16.</li>
    <li><b>Uma hierarquia de três níveis.</b> O número (48), os dois secundários (17) e as legendas (12 e 13). Hoje há seis linhas quase do mesmo peso.</li>
    <li><b>O número e o contexto lado a lado</b>, separados por um fio, em vez de empilhados. É a maior poupança de altura.</li>
    <li><b>A barra mostra o progresso</b> em cinco troços, um por categoria, à proporção de cada uma. Branca sobre cinzento: diz o mesmo que o número, de outra forma, sem cor nova.</li>
    <li><b>"Ver a tua viagem" passa a um botão redondo de 44</b>, na mesma linha dos números, com as datas da viagem ao lado. Hoje é um link azul solto a meio do ecrã, numa linha só para ele.</li>
    <li><b>A ilha como marca.</b> O contorno da Madeira, em fio, ao lado do título. É o único pormenor decorativo, e é o que faz disto o passaporte da Madeira e não um ecrã de estatísticas.</li>
    <li><b>Porto Santo cabe sem mudar nada:</b> a página dele leva o contorno de Porto Santo no mesmo sítio.</li>
    <li><b>Sai</b> "1 204 km em todas as viagens": passa para a lista de viagens, onde faz sentido.</li></ol>
    <h3>Medido nesta página</h3><table>
      <tr><td>Primeira fila de carimbos, hoje</td><td data-m="today"></td></tr>
      <tr><td>Primeira fila de carimbos, proposta</td><td data-m="main"></td></tr>
      <tr><td>Altura poupada</td><td data-saved></td></tr>
      <tr><td>Primeiro dia, proposta</td><td data-m="empty"></td></tr></table>
    <h3>Fica igual</h3><p style="margin:0">A barra de cima, o cartão de desbloquear e as filas de carimbos. Os quilómetros, dias e datas são de exemplo.</p></div>
</div>${MEASURE}</body></html>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
writeFileSync(path.join(here, 'out', 'passport-cover-final.html'), html);
console.log('tools/out/passport-cover-final.html');
