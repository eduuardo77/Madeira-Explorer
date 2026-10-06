/**
 * The founder stamp, drawn three ways for the project lead to choose (T-233, OQ-9).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-founder-options.mjs
 *     → tools/out/founder-options.html
 *
 * Every drawing is `medalArt.ts`'s, through the same element renderer as the
 * stamps (`lib/svg-render.mjs`), so what is chosen here is what ships. Each is
 * shown large, at the passport's size on the dark album beside two real
 * stamps, and with the title in all three languages, since a longer word is
 * condensed to fit.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { medalSvg, stampSvg } from './lib/svg-render.mjs';
import { founderElements } from '../app/src/passport/medalArt.ts';
import { STRINGS } from '../app/src/i18n/strings.ts';
import { APP_NAME } from '../app/src/brand.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(readFileSync(path.join(here, '..', 'content', 'pois.json'), 'utf8'));
const byId = new Map(pack.places.map((place) => [place.id, place]));

const STYLES = [
  ['seal', 'F1. Selo de cera', 'Vermelho, prensado com uma estrela e louros dourados. O mais diferente dos carimbos: lê-se logo como especial.'],
  ['medal', 'F2. Medalha', 'Ouro numa fita azul e vermelha, raios atrás da estrela. Prepara o caminho para as medalhas dos conjuntos (fase 4).'],
  ['postmark', 'F3. Carimbo dourado', 'Redondo e perfurado como os outros carimbos, a tinta dourada. O mais próximo do passaporte que já existe.'],
];

/** The words as the app will pass them: the year is the window's, here the planned launch. */
const words = (language) => ({
  title: STRINGS['medal.founder.title'][language],
  destination: pack.destination ?? null,
  year: 2026,
});

const real = (id) => {
  const place = byId.get(id);
  return stampSvg(place.id, place.name, place.category, true);
};

function option([style, name, note]) {
  const big = medalSvg(founderElements(words('pt'), style));
  const small = medalSvg(founderElements(words('pt'), style));
  const langs = ['en', 'pt', 'de']
    .map((language) => `<div class="lang">${medalSvg(founderElements(words(language), style))}<span>${language}</span></div>`)
    .join('');
  return `<section class="option">
    <h2>${name}</h2>
    <p class="note">${note}</p>
    <div class="row">
      <div class="big">${big}</div>
      <div class="album">
        <div class="label">MEDALHAS</div>
        <div class="card">
          <div class="medal">${small}</div>
          <div class="words"><b>${STRINGS['medal.founder.name'].pt}</b><span>${STRINGS['medal.founder.detail'].pt.replace('{date}', '20 de nov. de 2026').replace('{app}', APP_NAME)}</span></div>
        </div>
        <div class="label">MIRADOUROS</div>
        <div class="stamps">${real('pico-do-areeiro')}${real('cabo-girao')}</div>
      </div>
      <div class="langs">${langs}</div>
    </div>
  </section>`;
}

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; background: #111113; color: #F2F2F7; }
header, section { padding: 20px; max-width: 1100px; margin: 0 auto; }
section { border-top: 1px solid #2C2C2E; }
h1 { font-size: 22px; margin: 0 0 8px; } h2 { font-size: 19px; margin: 0 0 4px; }
.note { color: #AEAEB2; max-width: 760px; margin: 0 0 14px; }
.row { display: flex; flex-wrap: wrap; gap: 28px; align-items: flex-start; }
.big svg { width: 240px; height: 240px; display: block; }
.album { width: 300px; background: #1C1C1E; border-radius: 20px; padding: 14px; }
.label { color: #AEAEB2; font-size: 12px; font-weight: 600; letter-spacing: .8px; margin: 4px 4px 8px; }
.card { display: flex; align-items: center; gap: 12px; background: #2C2C2E; border-radius: 14px; padding: 10px; margin-bottom: 14px; }
.medal svg { width: 84px; height: 84px; display: block; }
.words { display: flex; flex-direction: column; gap: 2px; } .words b { font-size: 16px; } .words span { color: #AEAEB2; font-size: 13px; }
.stamps { display: flex; gap: 10px; } .stamps svg { width: 84px; height: 84px; }
.langs { display: flex; gap: 10px; } .lang { text-align: center; color: #AEAEB2; font-size: 12px; } .lang svg { width: 96px; height: 96px; display: block; }
`;

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bruma: o carimbo de fundador</title><style>${CSS}</style></head><body>
<header>
  <h1>O carimbo de fundador: três desenhos (T-233)</h1>
  <p class="note">Para quem comprar nos primeiros três meses depois do lançamento. Aparece no passaporte numa secção própria, Medalhas, e não conta para os 80 lugares (OQ-2). Escolhe um; os outros dois são apagados.</p>
</header>
${STYLES.map(option).join('\n')}
</body></html>`;

const out = path.join(here, 'out');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'founder-options.html'), html);
console.log('tools/out/founder-options.html: 3 founder designs');
