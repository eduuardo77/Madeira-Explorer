/**
 * The set medals, as the app draws them, for the project lead to judge by eye
 * before they ship (T-235, OQ-9).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-medals.mjs
 *     → tools/out/medals.html
 *
 * Every medal in `content/medals.json`, in its three looks: under way (silver,
 * a gold arc for how far), complete (gold), and complete on a passport not yet
 * unlocked (gold, frosted, padlock; the frost and padlock are the screen's,
 * imitated here with CSS). Then the passport's Medals section with a few of
 * them, beside the founder stamp. The drawings are `medalArt.ts`'s through the
 * same renderer as the stamps, so this is what ships.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { medalSvg } from './lib/svg-render.mjs';
import { founderElements, setMedalElements } from '../app/src/passport/medalArt.ts';
import { parseMedalPack } from '../app/src/content/medalPack.ts';
import { parseRegionPack } from '../app/src/content/regionPack.ts';
import { parseContentPack } from '../app/src/content/contentPack.ts';
import { medalProgress } from '../app/src/progress/medals.ts';
import { STRINGS } from '../app/src/i18n/strings.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(path.join(here, '..', 'content', name), 'utf8'));
const pack = parseContentPack(read('pois.json')).pack;
const medals = parseMedalPack(read('medals.json')).medals;
const regions = new Map(parseRegionPack(read('regions.json')).regions.map((region) => [region.id, region]));

/** The words the screen will pass for a medal. */
function words(progress, look) {
  const rule = progress.rule;
  const region = 'region' in rule ? regions.get(rule.region) : null;
  return {
    emblem:
      'region' in rule
        ? { kind: 'outline', points: region?.outline ?? [] }
        : { kind: 'category', category: rule.category },
    name: 'region' in rule ? region?.name ?? rule.region : STRINGS[`passport.category.${rule.category}`].pt,
    collected: look === 'silver' ? Math.max(1, Math.round(progress.total * 0.4)) : progress.total,
    total: progress.total,
    look,
  };
}

const all = medalProgress(medals, pack.places, [], false);

const row = (progress) => `<div class="medal-row">
  <div class="cell">${medalSvg(setMedalElements(words(progress, 'silver')))}<span>${Math.max(1, Math.round(progress.total * 0.4))} de ${progress.total}</span></div>
  <div class="cell">${medalSvg(setMedalElements(words(progress, 'gold')))}<span>completa</span></div>
  <div class="cell locked">${medalSvg(setMedalElements(words(progress, 'gold')))}<i class="lock">🔒</i><span>completa, por desbloquear</span></div>
</div>`;

const founder = medalSvg(founderElements({ title: STRINGS['medal.founder.title'].pt, destination: pack.destination, year: 2026 }));
const card = (svg, name, detail) => `<div class="card"><div class="small">${svg}</div><div class="words"><b>${name}</b><span>${detail}</span></div></div>`;
const byId = new Map(all.map((progress) => [progress.id, progress]));
const pick = (id, look) => medalSvg(setMedalElements(words(byId.get(id), look)));

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; background: #111113; color: #F2F2F7; }
main { padding: 20px; max-width: 1100px; margin: 0 auto; }
h1 { font-size: 22px; margin: 0 0 8px; } h2 { font-size: 18px; margin: 26px 0 8px; }
.note { color: #AEAEB2; max-width: 780px; margin: 0 0 14px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 18px; }
.medal-row { display: flex; gap: 10px; background: #1C1C1E; border-radius: 16px; padding: 10px; }
.cell { position: relative; text-align: center; color: #AEAEB2; font-size: 11px; width: 100px; }
.cell svg { width: 100px; height: 100px; display: block; }
.cell.locked svg { filter: blur(2.6px); }
.lock { position: absolute; top: 34px; left: 0; right: 0; font-style: normal; font-size: 26px; }
.album { width: 330px; background: #1C1C1E; border-radius: 20px; padding: 14px; }
.label { color: #AEAEB2; font-size: 12px; font-weight: 600; letter-spacing: .8px; margin: 4px 4px 8px; }
.card { display: flex; align-items: center; gap: 12px; background: #2C2C2E; border-radius: 14px; padding: 10px; margin-bottom: 8px; }
.small svg { width: 72px; height: 72px; display: block; }
.words { display: flex; flex-direction: column; gap: 2px; } .words b { font-size: 16px; } .words span { color: #AEAEB2; font-size: 13px; }
`;

const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bruma: as medalhas</title><style>${CSS}</style></head><body><main>
  <h1>As medalhas dos conjuntos (T-235)</h1>
  <p class="note">Uma por concelho com pelo menos três lugares, e uma para todas as levadas (OQ-3). Da família do carimbo de fundador: prateada com um arco dourado enquanto o conjunto vai a meio, dourada quando está completo. Cada concelho leva o seu próprio contorno, tirado do mapa. Completa num passaporte por desbloquear, aparece desfocada com o cadeado, como os carimbos.</p>
  <div class="grid">${all.map(row).join('')}</div>
  <h2>No passaporte</h2>
  <div class="album">
    <div class="label">MEDALHAS</div>
    ${card(founder, STRINGS['medal.founder.name'].pt, 'Comprado a 20 de novembro de 2026, quando o Bruma era novo')}
    ${card(pick('region-camara-de-lobos', 'gold'), 'Câmara de Lobos', 'Completa a 4 de outubro de 2026')}
    ${card(pick('region-funchal', 'silver'), 'Funchal', '6 de 14 lugares')}
    ${card(pick('category-levada', 'silver'), 'Levadas', '7 de 18 lugares')}
  </div>
</main></body></html>`;

const out = path.join(here, 'out');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'medals.html'), html);
console.log(`tools/out/medals.html: ${all.length} medals`);
