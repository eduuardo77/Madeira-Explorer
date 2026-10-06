/**
 * The founder stamp, as the app draws it (T-233, OQ-9).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-founder.mjs
 *     → tools/out/founder.html
 *
 * The drawing is `medalArt.ts`'s, through the same element renderer as the
 * stamps (`lib/svg-render.mjs`), so this page shows what ships: large, in the
 * passport's Medals card beside two real stamps, and with the title in all
 * three languages, since a longer word is condensed to fit. The gold postmark
 * was chosen from three designs on 2026-10-06.
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

/** The words as the app passes them; the year is the planned launch's. */
const words = (language) => ({
  title: STRINGS['medal.founder.title'][language],
  destination: pack.destination ?? null,
  year: 2026,
});

const founder = (language) => medalSvg(founderElements(words(language)));

const real = (id) => {
  const place = byId.get(id);
  return stampSvg(place.id, place.name, place.category, true);
};

const detail = STRINGS['medal.founder.detail'].pt.replace('{date}', '20 de novembro de 2026').replace('{app}', APP_NAME);

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; background: #111113; color: #F2F2F7; }
main { padding: 20px; max-width: 1000px; margin: 0 auto; }
h1 { font-size: 22px; margin: 0 0 8px; }
.note { color: #AEAEB2; max-width: 760px; margin: 0 0 18px; }
.row { display: flex; flex-wrap: wrap; gap: 28px; align-items: flex-start; }
.big svg { width: 280px; height: 280px; display: block; }
.album { width: 300px; background: #1C1C1E; border-radius: 20px; padding: 14px; }
.label { color: #AEAEB2; font-size: 12px; font-weight: 600; letter-spacing: .8px; margin: 4px 4px 8px; }
.card { display: flex; align-items: center; gap: 12px; background: #2C2C2E; border-radius: 14px; padding: 10px; margin-bottom: 14px; }
.medal svg { width: 84px; height: 84px; display: block; }
.words { display: flex; flex-direction: column; gap: 2px; } .words b { font-size: 16px; } .words span { color: #AEAEB2; font-size: 13px; }
.stamps { display: flex; gap: 10px; } .stamps svg { width: 84px; height: 84px; }
.langs { display: flex; gap: 10px; } .lang { text-align: center; color: #AEAEB2; font-size: 12px; } .lang svg { width: 110px; height: 110px; display: block; }
`;

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bruma: o carimbo de fundador</title><style>${CSS}</style></head><body><main>
  <h1>O carimbo de fundador (T-233)</h1>
  <p class="note">Para quem comprar nos primeiros três meses depois do lançamento. Na secção Medalhas do passaporte, fora da contagem dos 80 lugares (OQ-2).</p>
  <div class="row">
    <div class="big">${founder('pt')}</div>
    <div class="album">
      <div class="label">MEDALHAS</div>
      <div class="card">
        <div class="medal">${founder('pt')}</div>
        <div class="words"><b>${STRINGS['medal.founder.name'].pt}</b><span>${detail}</span></div>
      </div>
      <div class="label">MIRADOUROS</div>
      <div class="stamps">${real('pico-do-areeiro')}${real('cabo-girao')}</div>
    </div>
    <div class="langs">${['en', 'pt', 'de'].map((language) => `<div class="lang">${founder(language)}<span>${language}</span></div>`).join('')}</div>
  </div>
</main></body></html>`;

const out = path.join(here, 'out');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'founder.html'), html);
console.log('tools/out/founder.html: the founder stamp');
