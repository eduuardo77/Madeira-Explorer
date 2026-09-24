#!/usr/bin/env node
/**
 * How many stamps does a real visitor collect, and on which day? (D-089 study, Q1)
 *
 *   node tools/stamp-days.mjs            # the table
 *   node tools/stamp-days.mjs --detail   # every stop, and what it earns
 *
 * A desk model, not a measurement. Each itinerary below is a **published** guide
 * or tour (the URL is beside it), transcribed stop by stop onto the 80 places in
 * `content/pois.json`. Nothing is invented: a stop a guide does not name is not
 * here, and a guide's stop that is not one of the 80 earns nothing.
 *
 * WHAT A STOP EARNS (app/src/progress/stampRules.ts)
 * --------------------------------------------------
 * - `foot`: the visitor gets out and stays. Earns the place: 3 min inside at
 *   walking pace is less than any stop a guide bothers to name.
 * - `walk`: a levada walked end to end. Earns it (both endpoints plus 20 min).
 * - `past`: driven past, or seen from above or from a boat. Earns nothing: that
 *   is exactly what the dwell and speed gates exist to refuse.
 *
 * TWO NUMBERS PER DAY
 * -------------------
 * **low** counts only the places the guide names. **high** also counts places
 * whose geofence overlaps a `foot` stop's, because standing in one may mean
 * standing in both (Monte Palace sits inside Monte's 600 m circle). The truth
 * is between them, and T-205, one real trip, is what places it.
 *
 * A tool, not app code: it imports nothing from `app/`.
 */

import { readFileSync } from 'node:fs';

const pois = JSON.parse(readFileSync(new URL('../content/pois.json', import.meta.url), 'utf8'));
const places = pois.places ?? pois;
const byId = new Map(places.map((place) => [place.id, place]));

const foot = (id, note) => ({ id, how: 'foot', note });
const walk = (id, note) => ({ id, how: 'walk', note });
const past = (id, note) => ({ id, how: 'past', note });

/**
 * The itineraries. Stops that are not among the 80 are listed as `null` with
 * their name, so the transcription can be checked against the source.
 */
const ITINERARIES = [
  {
    name: 'Hire car, one week (classic)',
    source: 'https://www.rentingacarineurope101.com/madeira-road-trip-7-day-itinerary/',
    days: [
      [null, 'Doca do Cavacas', foot('jardim-tropical-monte-palace'), foot('mercado-dos-lavradores'),
        null, 'Rua de Santa Maria', foot('forte-de-sao-tiago')],
      [foot('praia-do-porto-do-seixal'), foot('veu-da-noiva'), foot('sao-vicente'), null,
        'Capela de N. S. de Fátima', foot('ilheus-da-ribeira-da-janela'),
        foot('piscinas-naturais-do-porto-moniz'), foot('teleferico-das-achadas-da-cruz')],
      [foot('pico-do-areeiro', 'sunrise walk to Ninho da Manta; PR1 closed that day')],
      [foot('camara-de-lobos'), null, 'Vinhos Barbeito', foot('cabo-girao'), foot('ponta-do-sol'),
        null, 'Cascata dos Anjos'],
      [walk('levada-do-caldeirao-verde'), foot('santana'), foot('miradouro-da-rocha-do-navio'),
        foot('ponta-do-rosto')],
      [foot('fanal'), walk('levada-das-25-fontes'), walk('levada-do-risco', 'the Risco detour: short, may fall under 20 min')],
      [null, 'whale watching', foot('ponta-do-garajau', 'Cristo Rei')],
    ],
  },
  {
    name: 'Hiker, one week',
    source: 'https://www.madeirau.com/travel/madeira-7-day-itinerary/',
    days: [
      [foot('mercado-dos-lavradores'), foot('jardim-tropical-monte-palace'), foot('monte', 'toboggan start')],
      [foot('pico-do-areeiro'), foot('pico-ruivo', 'PR1, one way'),
        foot('achada-do-teixeira', 'where PR1 one-way usually ends; not named by the guide')],
      [walk('levada-das-25-fontes'), walk('levada-do-risco', 'detour')],
      [foot('cabo-girao', '4WD tour'), foot('piscinas-naturais-do-porto-moniz'),
        foot('praia-do-porto-do-seixal'), foot('fanal')],
      [null, 'boat day'],
      [walk('levada-do-caldeirao-verde', 'the guide offers this or PR8 or an east tour')],
      [null, 'Porto Santo ferry'],
    ],
  },
  {
    name: 'Long weekend, hire car ("famous places")',
    source: 'https://www.zigzagonearth.com/3-days-madeira-weekend-itinerary/ (itinerary 3)',
    days: [
      [foot('cabo-girao'), foot('camara-de-lobos'), foot('ponta-do-sol'),
        foot('ilheus-da-ribeira-da-janela'), foot('porto-moniz'), foot('seixal')],
      [foot('pico-do-areeiro'), foot('balcoes'), foot('santana'), foot('miradouro-da-rocha-do-navio'),
        foot('ponta-de-sao-lourenco'), foot('ponta-do-garajau')],
      [null, 'boat tour', foot('jardim-tropical-monte-palace'), foot('monte'),
        foot('se-do-funchal', '"historical Funchal": the Sé stands for it')],
    ],
  },
  {
    name: 'Long weekend, no car',
    source: 'https://www.zigzagonearth.com/3-days-madeira-weekend-itinerary/ (itinerary 2)',
    days: [
      [foot('se-do-funchal', 'hop-on hop-off bus; the Sé stands for Funchal'), foot('camara-de-lobos')],
      [null, 'Portela viewpoint', foot('santana'), foot('pico-do-areeiro')],
      [null, 'boat tour', foot('jardim-tropical-monte-palace'), foot('monte')],
    ],
  },
  {
    name: 'Hiker, long weekend',
    source: 'https://www.zigzagonearth.com/3-days-madeira-weekend-itinerary/ (itinerary 4)',
    days: [
      [foot('ponta-de-sao-lourenco', 'PR8, walked to the end')],
      [foot('pico-do-areeiro'), foot('pico-ruivo', 'PR1')],
      [walk('levada-do-caldeirao-verde', 'PR9')],
    ],
  },
  {
    name: 'Organised tours, 3 days',
    source: 'https://www.marvellousmadeira.com/3-days-madeira-itinerary/',
    days: [
      [foot('mercado-dos-lavradores'), foot('jardim-tropical-monte-palace'), foot('monte'),
        foot('jardim-botanico-da-madeira')],
      [foot('pico-do-areeiro'), foot('balcoes', 'Ribeiro Frio levada walk'), foot('santana')],
      [null, 'Garganta Funda', foot('piscinas-naturais-do-porto-moniz'), foot('cabo-girao'),
        past('faja-dos-padres', 'viewed from above'), foot('sao-vicente'), foot('fanal')],
    ],
  },
  {
    name: 'Cruise passenger, a day ashore (Island Centre & Toboggan)',
    source: 'https://madeira-tours.com/from-cruise-ship/ (tour 7)',
    days: [
      [foot('eira-do-serrado'), foot('camara-de-lobos'), foot('cabo-girao'), foot('monte')],
    ],
  },
  {
    name: 'Cruise passenger, a day ashore (Market, Toboggan & Gardens)',
    source: 'https://madeira-tours.com/from-cruise-ship/ (tour 4)',
    days: [
      [foot('mercado-dos-lavradores'), foot('jardim-botanico-da-madeira'), foot('monte'),
        foot('ponta-do-garajau')],
    ],
  },
];

// ---------------------------------------------------------------------------

function distanceM(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Non-levada places whose circle overlaps one of this place's circles. */
function overlapping(id) {
  const here = byId.get(id).geofences;
  return places
    .filter((other) => other.id !== id && other.category !== 'levada')
    .filter((other) =>
      other.geofences.some((g) => here.some((h) => distanceM(g, h) < g.radiusM + h.radiusM))
    )
    .map((other) => other.id);
}

const detail = process.argv.includes('--detail');
const CANDIDATE_N = [3, 5, 10];

for (const stop of ITINERARIES.flatMap((it) => it.days.flat())) {
  if (stop !== null && typeof stop === 'object' && !byId.has(stop.id)) {
    throw new Error(`unknown place id: ${stop.id}`);
  }
}

const rows = [];
for (const itinerary of ITINERARIES) {
  const low = new Set();
  const high = new Set();
  const curve = [];
  if (detail) console.log(`\n## ${itinerary.name}\n   ${itinerary.source}`);

  itinerary.days.forEach((day, index) => {
    for (const stop of day) {
      if (stop === null || typeof stop === 'string') {
        if (detail && typeof stop === 'string') console.log(`   day ${index + 1}  ·  ${stop} (not one of the 80)`);
        continue;
      }
      if (stop.how === 'past') {
        if (detail) console.log(`   day ${index + 1}  ✗  ${stop.id} (${stop.note ?? 'passed'})`);
        continue;
      }
      low.add(stop.id);
      high.add(stop.id);
      const extra = stop.how === 'foot' ? overlapping(stop.id).filter((id) => !high.has(id)) : [];
      extra.forEach((id) => high.add(id));
      if (detail) {
        console.log(
          `   day ${index + 1}  ✓  ${stop.id}${stop.note ? ` (${stop.note})` : ''}` +
            (extra.length > 0 ? `  + maybe ${extra.join(', ')}` : '')
        );
      }
    }
    curve.push([low.size, high.size]);
  });

  const lockDay = (n) => {
    const at = (pick) => curve.findIndex((c) => pick(c) > n);
    const early = at((c) => c[1]);
    const late = at((c) => c[0]);
    const fmt = (i) => (i === -1 ? 'never' : `day ${i + 1}`);
    return early === late ? fmt(early) : `${fmt(early)} to ${fmt(late)}`;
  };

  rows.push({
    name: itinerary.name,
    curve: curve.map(([l, h]) => (l === h ? `${l}` : `${l}-${h}`)).join(' · '),
    locks: CANDIDATE_N.map(lockDay),
    levada: curve.length > 0 && itinerary.days.flat().some((s) => s?.how === 'walk'),
  });
}

console.log('\nStamps held at the end of each day (low-high), and the day stamp N+1 arrives:\n');
for (const row of rows) {
  console.log(`${row.name}`);
  console.log(`   by day: ${row.curve}${row.levada ? '   (walks a levada)' : ''}`);
  console.log(`   lock at N=${CANDIDATE_N.map((n, i) => `${n}: ${row.locks[i]}`).join(' · N=')}`);
}
console.log('\n⚠ A desk model from published itineraries, not a measurement. T-205 confirms or breaks it.');
