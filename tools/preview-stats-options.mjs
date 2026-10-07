/**
 * The passport's stats, drawn as options for the project lead (T-262).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/preview-stats-options.mjs --db <copy of madeira.db>
 *     → tools/out/stats-options.html
 *
 * The plan: km lit in total and this trip, days, places this trip, sets under
 * way; only figures the database holds exactly. So the figures here are
 * computed from a copy of the phone's database with the app's own code (the
 * stored chains, `visitedEdges`, `tripDayCount`), never typed in. The page
 * shows numbers only, no trace (D-016).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)).href);
const { decodeRoadGraph } = await imp('app/src/matching/roadGraph.ts');
const { chainVersion, fromStored } = await imp('app/src/matching/chainStore.ts');
const { chainTimedRuns } = await imp('app/src/matching/roadTrace.ts');
const { visitedEdges, visitedLengthM } = await imp('app/src/matching/visitedRoads.ts');
const { localStartOfDay, tripDayCount } = await imp('app/src/souvenir/tripDays.ts');
const { album } = await imp('app/src/ui/theme.ts');

const dbArg = process.argv.indexOf('--db');
if (dbArg === -1) {
  console.error('Usage: node tools/preview-stats-options.mjs --db <copy of madeira.db>');
  process.exit(1);
}
const db = new DatabaseSync(process.argv[dbArg + 1], { readOnly: true });
const graph = decodeRoadGraph(JSON.parse(readFileSync(path.join(root, 'content', 'roads.json'), 'utf8')));
const version = chainVersion(graph.version);
const places = JSON.parse(readFileSync(path.join(root, 'content', 'pois.json'), 'utf8')).places;
const categoryOf = new Map(places.map((place) => [place.id, place.category]));

const chainsOf = (tripId) =>
  db
    .prepare('SELECT first_ts AS firstTs, last_ts AS lastTs, confidence, pieces, anchors FROM matched_chain WHERE trip_id = ? AND version = ? ORDER BY first_ts, id')
    .all(tripId, version)
    .map(fromStored);

// The trip on show: the open one, else the latest (as `tripDao.getTripOnShow`).
const trip =
  db.prepare('SELECT id FROM trip WHERE ended_ts IS NULL ORDER BY started_ts DESC LIMIT 1').get() ??
  db.prepare('SELECT id FROM trip ORDER BY started_ts DESC LIMIT 1').get();
const allTrips = db.prepare('SELECT DISTINCT trip_id AS id FROM matched_chain').all().map((row) => row.id);

const tripChains = chainsOf(trip.id);
const awards = db.prepare('SELECT place_id, awarded_ts FROM stamp_award WHERE trip_id = ?').all(trip.id);
const figures = {
  tripKm: visitedLengthM(visitedEdges(graph, tripChains)) / 1000,
  totalKm: visitedLengthM(visitedEdges(graph, allTrips.flatMap(chainsOf))) / 1000,
  days: tripDayCount(
    tripChains.flatMap((chain) => chainTimedRuns(graph, chain)),
    awards.filter((award) => categoryOf.has(award.place_id)).map((award) => award.awarded_ts),
    localStartOfDay
  ),
  places: awards.length,
  sets: new Set(awards.map((award) => categoryOf.get(award.place_id)).filter(Boolean)).size,
};
const km = (value) => value.toLocaleString('pt-PT', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
console.log(figures);

const header = `
  <div class="nav"><span>‹ Mapa</span><span>Partilhar</span></div>
  <h1>Passaporte</h1>
  <div class="hero"><b>3</b> <span>/ 80</span></div>
  <div class="sub">lugares visitados</div>`;
const watch = `<div class="link">Ver a tua viagem</div>`;
const firstSet = `<div class="set"><span>MIRADOUROS</span><span class="muted">0 de 19 <i>Ver tudo</i></span></div><div class="panel"></div>`;

const options = [
  {
    name: 'A, one line under the count',
    note: 'The quietest: the trip in one sentence, the total for all trips beside it in grey.',
    body: `${header}
      <div class="line">${km(figures.tripKm)} km de estradas acesas em ${figures.days} dias</div>
      <div class="line muted small">${km(figures.totalKm)} km em todas as viagens</div>
      ${watch}${firstSet}`,
  },
  {
    name: 'B, a row of four figures',
    note: 'WalkNYC style: four numbers with their labels, between the count and the link.',
    body: `${header}
      <div class="row">
        <div><b>${km(figures.tripKm)}</b><small>km acesos</small></div>
        <div><b>${figures.days}</b><small>${figures.days === 1 ? 'dia' : 'dias'}</small></div>
        <div><b>${figures.places}</b><small>lugares</small></div>
        <div><b>${figures.sets}</b><small>coleções começadas</small></div>
      </div>
      <div class="line muted small">${km(figures.totalKm)} km em todas as viagens</div>
      ${watch}${firstSet}`,
  },
  {
    name: 'C, a card for this trip',
    note: 'A panel like the stamp panels, titled for the trip, with the total in its foot.',
    body: `${header}${watch}
      <div class="set"><span>ESTA VIAGEM</span></div>
      <div class="card">
        <div class="grid">
          <div><b>${km(figures.tripKm)} km</b><small>de estradas acesas</small></div>
          <div><b>${figures.days}</b><small>${figures.days === 1 ? 'dia com estradas' : 'dias com estradas'}</small></div>
          <div><b>${figures.places}</b><small>lugares visitados</small></div>
          <div><b>${figures.sets}</b><small>coleções começadas</small></div>
        </div>
        <div class="foot">${km(figures.totalKm)} km em todas as viagens</div>
      </div>
      ${firstSet}`,
  },
];

const html = `<!doctype html><meta charset="utf-8"><title>Passport stats options</title>
<style>
  body { margin: 0; padding: 24px; background: #111; font-family: system-ui, sans-serif; color: ${album.text}; }
  .options { display: flex; gap: 28px; flex-wrap: wrap; }
  figure { margin: 0; width: 360px; }
  figcaption { margin: 10px 4px; color: #ddd; font-size: 14px; line-height: 1.4; }
  figcaption b { display: block; color: #fff; font-size: 16px; margin-bottom: 2px; }
  .phone { width: 360px; height: 640px; overflow: hidden; border-radius: 28px; background: ${album.background}; padding: 16px; box-sizing: border-box; }
  .nav { display: flex; justify-content: space-between; color: ${album.tint}; font-size: 17px; margin: 8px 0 18px; }
  h1 { margin: 0 0 18px; font-size: 32px; }
  .hero { text-align: center; } .hero b { font-size: 48px; } .hero span { font-size: 22px; color: ${album.textMuted}; }
  .sub { text-align: center; color: ${album.textMuted}; font-size: 16px; margin-bottom: 10px; }
  .link { text-align: center; color: ${album.tint}; font-size: 16px; margin: 10px 0 22px; }
  .line { text-align: center; font-size: 16px; margin-top: 6px; }
  .muted { color: ${album.textMuted}; } .small { font-size: 14px; }
  .row { display: flex; justify-content: space-between; margin: 14px 0 6px; text-align: center; }
  .row div { flex: 1; } .row b { display: block; font-size: 22px; } .row small, .grid small { color: ${album.textMuted}; font-size: 12px; }
  .set { display: flex; justify-content: space-between; color: ${album.textMuted}; font-size: 14px; letter-spacing: 1px; margin: 4px 4px 8px; }
  .set i { font-style: normal; color: ${album.tint}; letter-spacing: 0; margin-left: 10px; }
  .panel { height: 120px; border: 1px solid ${album.hairline}; border-radius: 14px; }
  .card { border: 1px solid ${album.hairline}; border-radius: 14px; padding: 14px; margin-bottom: 18px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .grid b { display: block; font-size: 22px; }
  .foot { margin-top: 12px; padding-top: 10px; border-top: 1px solid ${album.hairline}; color: ${album.textMuted}; font-size: 13px; }
</style>
<h2 style="margin-top:0">T-262: the passport's stats, three ways</h2>
<p style="color:#bbb;max-width:1100px">Your real figures, from a copy of the P30's database (${new Date().toISOString().slice(0, 10)}), worked out with the app's own code: ${km(figures.tripKm)} km of road lit this trip, ${km(figures.totalKm)} km on all trips, ${figures.days} days with lit roads, ${figures.places} places, ${figures.sets} collections started. "Km acesos" counts each road once, however often you travelled it.</p>
<div class="options">${options
  .map((option) => `<figure><div class="phone">${option.body}</div><figcaption><b>${option.name}</b>${option.note}</figcaption></figure>`)
  .join('')}</div>`;

mkdirSync(path.join(here, 'out'), { recursive: true });
writeFileSync(path.join(here, 'out', 'stats-options.html'), html);
console.log('tools/out/stats-options.html');
