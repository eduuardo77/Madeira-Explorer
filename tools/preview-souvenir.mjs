/**
 * Write the shareable still to a file, so it can be looked at (T-105d, D-063).
 *
 *     node tools/preview-souvenir.mjs
 *     → tools/out/souvenir-card.svg
 *
 * The second renderer for the souvenir, and the same argument as everywhere
 * else in this project: `composition.ts` has produced a storyboard since T-105a
 * and **nobody has ever seen a frame of it**. Geometry that passes every test
 * can still look wrong, and the only way to find out is to draw it.
 *
 * It uses the app's own module — imported, never reimplemented — so the picture
 * here is the picture the app draws through `react-native-svg`.
 *
 * ⚠ The trip is invented; only the *route* is real, read from `tools/routes/`
 * and cleaned by the app's own `traceCleanup` so the line is exactly what the
 * map would draw (D-066).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.removeAllListeners('warning');

const { buildShareCard, renderShareCardSvg } = await import('../app/src/souvenir/shareCard.ts');
const { cleanTrace } = await import('../app/src/map/traceCleanup.ts');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const routeFile =
  process.argv[2] ?? path.join(root, 'tools/routes/funchal-seafront.txt');

const points = [];
for (const line of readFileSync(routeFile, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) continue;
  const [lat, lon] = trimmed.split(/\s+/).map(Number);
  if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon });
}

// Through the app's own cleanup, so the souvenir cannot flatter the map.
const fixes = points.map((point, i) => ({
  ts: 1_800_000_000_000 + i * 20_000,
  lat: point.lat,
  lon: point.lon,
  accuracy_m: 10,
}));
const cleaned = cleanTrace(fixes).fixes.map((fix) => [fix.lon, fix.lat]);

const card = buildShareCard({
  destination: 'Madeira',
  dateRange: '12–19 August 2026',
  collected: 23,
  total: 60,
  strokes: [cleaned],
  stampNames: [
    'Pico do Areeiro',
    'Levada das 25 Fontes',
    'Câmara de Lobos',
    'Cabo Girão',
    'Fanal',
    'Praia do Porto do Seixal',
    'Pico Ruivo',
    'Monte',
  ],
});

const outDir = path.join(root, 'tools', 'out');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'souvenir-card.svg');
writeFileSync(out, `${renderShareCardSvg(card)}\n`);

console.log(`${card.elements.length} elements, ${cleaned.length} trace points`);
for (const element of card.elements) {
  if (element.kind === 'text') {
    console.log(`  "${element.text}" @ ${element.x},${element.y} size ${element.size}`);
  }
}
console.log('\nWrote tools/out/souvenir-card.svg');
