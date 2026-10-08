/**
 * A drive along the real road network, written as a route for
 * `tools/replay-route.sh`, so the emulator can light roads that are nobody's
 * real movements (T-269: store screenshots without the lead's trace, D-016).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/make-demo-route.mjs \
 *       [--from <place id>] [--length 6000] [--speed 9] [--interval 2] [--seed 7]
 *     → tools/routes/demo-drive.txt
 *
 * The route is `drivenRoute` from `lib/syntheticTrips.mjs` (shortest paths
 * between destinations 1 to 3 km apart, town and main roads), sampled with a
 * few metres of wandering GPS error, one point per `interval` seconds at
 * `speed`. Replay it with the same interval for that speed.
 *
 * ⚠ For pictures and checks on the emulator only. It is a model of a drive, not
 * a drive, and no threshold may be tuned against it (CONTEXT §6.6).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { drivenRoute, rng, sampleTrip } from './lib/syntheticTrips.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const load = (p) => import(pathToFileURL(path.join(root, 'app/src/matching', p)).href);
const { decodeRoadGraph, nearbyEdges, pointAt } = await load('roadGraph.ts');
const routing = await load('roadRouting.ts');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

const placeId = arg('--from', 'forte-de-sao-tiago');
const lengthM = Number(arg('--length', '6000'));
const speedMps = Number(arg('--speed', '9'));
const intervalS = Number(arg('--interval', '2'));
const seed = Number(arg('--seed', '7'));
const KINDS = 'mpr';

const pois = JSON.parse(readFileSync(path.join(root, 'content/pois.json'), 'utf8'));
const fence = pois.places.find((place) => place.id === placeId)?.geofences[0];
if (fence === undefined) throw new Error(`no place ${placeId} in content/pois.json`);

const graph = decodeRoadGraph(JSON.parse(readFileSync(path.join(root, 'content/roads.json'), 'utf8')));
const start = nearbyEdges(graph, fence.lat, fence.lon, 3000, 5000).find((c) =>
  KINDS.includes(graph.edgeKindCodes[c.edge].toLowerCase())
);
if (start === undefined) throw new Error(`no road near ${placeId}`);

const random = rng(seed);
const steps = drivenRoute(graph, routing, start.edge, lengthM, random, KINDS);
const { fixes, lengthM: drivenM } = sampleTrip(graph, pointAt, steps, random, {
  speedMps,
  intervalS,
  sigmaM: 4,
  correlationS: 60,
  outlierRate: 0,
  accuracyM: 8,
  dropTunnels: true,
});

const out = path.join(here, 'routes', 'demo-drive.txt');
writeFileSync(
  out,
  [
    `# A modelled drive from ${placeId}, ${Math.round(drivenM)} m on town and main roads, seed ${seed}.`,
    `# Written by tools/make-demo-route.mjs; replay ${intervalS} s apart for ${speedMps} m/s.`,
    '# For the emulator only: nobody drove this (D-016), and nothing may be tuned against it.',
    ...fixes.map((fix) => `${fix.lat.toFixed(6)} ${fix.lon.toFixed(6)}`),
    '',
  ].join('\n')
);
console.log(`${path.relative(root, out)}: ${fixes.length} points, ${Math.round(drivenM)} m, ~${Math.round((fixes.length * intervalS) / 60)} min to replay`);
