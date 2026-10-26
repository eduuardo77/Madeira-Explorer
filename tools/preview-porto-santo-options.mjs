/**
 * Porto Santo's own passport: where it lives, three options for the lead (2026-10-26).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-porto-santo-options.mjs
 *     → tools/out/porto-santo-options.html
 *
 * Agreed already: its own passport, apart from Madeira's; a few places; one medal
 * for the island; one free stamp; the €5.99 covers both; roads free for now.
 * Open: whether it is visible from install. The stamps and the medal come from
 * the shipped renderers (svg-render.mjs, medalArt.ts); the island's outline is
 * the real one from regions.json. ⚠ The Porto Santo place names are examples,
 * nothing is curated (D-064).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { medalSvg, stampSvg } from './lib/svg-render.mjs';
import { setMedalElements } from '../app/src/passport/medalArt.ts';
import { parseRegionPack } from '../app/src/content/regionPack.ts';
import { parseContentPack } from '../app/src/content/contentPack.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(path.join(here, '..', 'content', name), 'utf8'));
const pack = parseContentPack(read('pois.json')).pack;
const island = parseRegionPack(read('regions.json')).regions.find((r) => r.id === 'porto-santo');

// Examples only, to give the page its shape.
const PS = [
  { id: 'ps-praia', name: 'Praia', category: 'beach' },
  { id: 'ps-facho', name: 'Pico do Facho', category: 'viewpoint' },
  { id: 'ps-vila', name: 'Vila Baleira', category: 'village' },
  { id: 'ps-ana', name: 'Ana Ferreira', category: 'landmark' },
  { id: 'ps-flores', name: 'Flores', category: 'viewpoint' },
  { id: 'ps-zimbralinho', name: 'Zimbralinho', category: 'beach' },
];

const medal = (look, collected) =>
  medalSvg(
    setMedalElements({
      emblem: { kind: 'outline', points: island.outline },
      name: 'Porto Santo',
      collected,
      total: PS.length,
      look,
    })
  );

const stamp = (place, collected, locked = false) =>
  `<div class="st">${stampSvg(place.id, place.name, place.category, collected)}${locked ? '<i class="lk"></i>' : ''}</div>`;

const madeiraRow = (label, count, category) => {
  const places = pack.places.filter((p) => p.category === category).slice(0, 4);
  return `<div class="rowhead"><span>${label}</span><span class="dim">${count}</span><span class="link">Ver tudo</span></div>
  <div class="panel">${places.map((p, i) => stamp(p, i < 1, false)).join('')}</div>`;
};

const hero = (n, total, sub) => `<div class="hero"><b>${n}</b><span> / ${total}</span></div><div class="sub">${sub}</div>`;

const top = (title, extra = '') =>
  `<div class="bar"><span class="link">‹ Mapa</span><span class="link">Partilhar</span></div>${extra}<h1>${title}</h1>`;

const madeiraBody = `${hero(26, 81, 'lugares visitados')}
  <div class="km">267 km de estradas acesas em 12 dias</div>
  ${madeiraRow('MIRADOUROS', '5 de 20', 'viewpoint')}
  ${madeiraRow('LEVADAS', '0 de 18', 'levada')}`;

const tabs = (active) =>
  `<div class="tabs"><span class="${active === 'm' ? 'on' : ''}">Madeira</span><span class="${active === 'p' ? 'on' : ''}">Porto Santo</span></div>`;

const psPage = `${top('Porto Santo', tabs('p'))}
  ${hero(0, PS.length, 'lugares visitados')}
  <div class="medalcard">${medal('silver', 0)}<div><b>Medalha de Porto Santo</b><span>Todos os ${PS.length} lugares da ilha</span></div></div>
  <div class="info">Incluído no passaporte. O primeiro carimbo é grátis.</div>
  <div class="rowhead"><span>LUGARES</span><span class="dim">0 de ${PS.length}</span></div>
  <div class="panel wrap">${PS.map((p) => stamp(p, false)).join('')}</div>`;

const teaser = (line) => `<div class="teaser">
  <div class="tmedal">${medal('silver', 0)}</div>
  <div><b>Porto Santo</b><span>${PS.length} carimbos e uma medalha</span><span class="dim2">${line}</span></div>
  <span class="chev">›</span></div>`;

const phone = (caption, body) => `<figure><div class="phone">${body}</div><figcaption>${caption}</figcaption></figure>`;

const arrival = `${top('Passaporte')}
  ${hero(27, 81, 'lugares visitados')}
  <div class="sheet"><div class="big">${medal('silver', 1)}</div>
  <b>Chegaste a Porto Santo</b><span>A ilha tem o seu próprio passaporte: ${PS.length} carimbos e uma medalha. O primeiro é grátis.</span>
  <div class="btn">Abrir</div></div>`;

const options = [
  {
    key: 'A',
    title: 'A. Dois separadores, lado a lado',
    note: 'Porto Santo está no topo do passaporte desde a instalação, com o mesmo peso que a Madeira. Vende-se bem, mas quem nunca vai vê sempre um separador a zero.',
    phones: [
      phone('Madeira, como hoje, com o separador', `${top('Passaporte', tabs('m'))}${madeiraBody}`),
      phone('Porto Santo, tocando no separador', psPage),
    ],
  },
  {
    key: 'B',
    title: 'B. Um cartão no passaporte da Madeira (recomendado)',
    note: 'A Madeira continua a ser o passaporte. Um cartão, desde a instalação, abre o de Porto Santo a qualquer momento. Vende a ilha sem pôr um segundo número no topo, e quem não vai não fica com nada por fazer à vista.',
    phones: [
      phone('Madeira, com o cartão depois das categorias', `${top('Passaporte')}${hero(26, 81, 'lugares visitados')}<div class="km">267 km de estradas acesas em 12 dias</div>${teaser('Incluído no passaporte')}${madeiraRow('MIRADOUROS', '5 de 20', 'viewpoint')}`),
      phone('Tocando no cartão: o passaporte de Porto Santo', psPage.replace(tabs('p'), '')),
    ],
  },
  {
    key: 'C',
    title: 'C. Escondido até lá chegar (o que está feito hoje)',
    note: 'Nada de Porto Santo antes de lá ir; ao chegar, abre-se com um aviso. É a surpresa da D-024, mas não vende nada a quem está na Madeira, e só o ecrã de compra o mencionaria.',
    phones: [
      phone('Madeira, sem nada de Porto Santo', `${top('Passaporte')}${madeiraBody}`),
      phone('Ao chegar: a ilha abre', arrival),
    ],
  },
];

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.45 Roboto, "Segoe UI", sans-serif; background: #0E0E10; color: #F2F2F7; }
main { padding: 24px; max-width: 1180px; margin: 0 auto; }
h2 { font-size: 20px; margin: 34px 0 6px; } .note { color: #AEAEB2; max-width: 820px; margin: 0 0 16px; }
.agreed { background: #1C1C1E; border-radius: 14px; padding: 14px 18px; color: #D1D1D6; max-width: 820px; }
.row { display: flex; flex-wrap: wrap; gap: 28px; }
figure { margin: 0; } figcaption { color: #AEAEB2; font-size: 13px; margin-top: 8px; max-width: 340px; }
.phone { width: 340px; height: 720px; overflow: hidden; background: #1C1C1E; border-radius: 28px; border: 6px solid #2C2C2E; padding: 14px 16px; }
.bar { display: flex; justify-content: space-between; font-size: 17px; margin-bottom: 6px; }
.link { color: #4DA3FF; }
h1 { font-size: 34px; margin: 6px 0 10px; font-weight: 700; }
.hero { text-align: center; } .hero b { font-size: 58px; font-weight: 800; } .hero span { font-size: 26px; color: #C7C7CC; }
.sub { text-align: center; color: #AEAEB2; font-size: 16px; margin-top: -6px; }
.km { text-align: center; font-size: 14px; margin: 8px 0 12px; }
.rowhead { display: flex; gap: 12px; align-items: baseline; color: #AEAEB2; font-size: 13px; letter-spacing: .8px; margin: 14px 4px 6px; }
.rowhead span:first-child { flex: 1; } .dim { color: #C7C7CC; } .rowhead .link { letter-spacing: 0; }
.panel { display: flex; gap: 6px; border: 1px solid #3A3A3C; border-radius: 16px; padding: 10px 8px; overflow: hidden; }
.panel.wrap { flex-wrap: wrap; justify-content: space-around; }
.st { position: relative; width: 88px; height: 88px; flex: none; } .st svg { width: 88px; height: 88px; }
.lk { position: absolute; right: 2px; top: 0; width: 18px; height: 18px; border-radius: 50%; background: #F2F2F7; }
.tabs { display: flex; background: #2C2C2E; border-radius: 10px; padding: 3px; margin: 4px 0 4px; }
.tabs span { flex: 1; text-align: center; padding: 6px; border-radius: 8px; color: #AEAEB2; font-size: 14px; }
.tabs span.on { background: #48484A; color: #F2F2F7; font-weight: 600; }
.medalcard, .teaser { display: flex; align-items: center; gap: 12px; background: linear-gradient(120deg, #2B2238, #3A2E1A); border: 1px solid #6B5A2A; border-radius: 16px; padding: 10px 12px; margin: 12px 0 8px; }
.medalcard svg, .tmedal svg { width: 64px; height: 64px; display: block; }
.medalcard div, .teaser > div:nth-child(2) { display: flex; flex-direction: column; flex: 1; }
.medalcard b, .teaser b { font-size: 17px; } .medalcard span, .teaser span { color: #C7C7CC; font-size: 13px; }
.teaser .dim2 { color: #F0B429; } .chev { font-size: 28px; color: #C7C7CC !important; }
.info { color: #C7C7CC; font-size: 13px; text-align: center; margin: 4px 0; }
.sheet { margin-top: 18px; background: #2C2C2E; border-radius: 20px; padding: 16px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sheet .big svg { width: 110px; height: 110px; } .sheet b { font-size: 19px; } .sheet span { color: #C7C7CC; font-size: 14px; }
.btn { margin-top: 8px; background: #F0B429; color: #1C1C1E; font-weight: 700; border-radius: 14px; padding: 8px 28px; }
`;

const html = `<!doctype html><meta charset="utf-8"><title>Porto Santo, options</title><style>${CSS}</style><main>
<h1 style="font-size:26px">Porto Santo: onde vive o seu passaporte</h1>
<div class="agreed">Já combinado: passaporte próprio, à parte da Madeira; poucos lugares; uma medalha pela ilha toda; um carimbo grátis; os 5,99 € incluem tudo; estradas grátis por agora. Em aberto: se aparece desde a instalação. Os nomes de Porto Santo são exemplos, nada está escolhido.</div>
${options.map((o) => `<h2>${o.title}</h2><p class="note">${o.note}</p><div class="row">${o.phones.join('')}</div>`).join('')}
</main>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
writeFileSync(path.join(here, 'out', 'porto-santo-options.html'), html);
console.log('tools/out/porto-santo-options.html');
