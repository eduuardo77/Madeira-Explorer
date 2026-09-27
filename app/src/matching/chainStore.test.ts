/**
 * Kept chains: written down, read back, and resumed (D-093).
 *
 *     cd app && npm test
 *
 * ⚠⚠ The test that matters is the last: matching a trip visit by visit, keeping
 * what `resumePlan` calls final, must light the same roads as matching it all
 * at once. If it did not, the map would depend on when the user happened to
 * open it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fromStored, keptBefore, resumeFrom, toStored, type StoredChain } from './chainStore.ts';
import { matchTrace, MOTION_CONTEXT_MS, type MatchedChain, type MatchFix } from './mapMatch.ts';
import { decodeRoadGraph, pointAt, type RoadFile } from './roadGraph.ts';
import { visitedEdges } from './visitedRoads.ts';
import { randomRoute, rng, sampleTrip } from '../../../tools/lib/syntheticTrips.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('a chain survives being written down, to the centimetre', () => {
  const chain: MatchedChain = {
    pieces: [{ edge: 7, from: 12.3456, to: 80 }, { edge: 9, from: 0, to: 33.339 }],
    anchors: [{ ts: 1000, atM: 0 }, { ts: 11000, atM: 101.004 }],
    confidence: 0.91,
  };
  const back = fromStored(toStored(chain));
  assert.deepEqual(back.pieces, [{ edge: 7, from: 12.35, to: 80 }, { edge: 9, from: 0, to: 33.34 }]);
  assert.deepEqual(back.anchors, [{ ts: 1000, atM: 0 }, { ts: 11000, atM: 101 }]);
  assert.equal(back.confidence, 0.91);
});

test('no progress, or progress under another version: match from the beginning', () => {
  assert.equal(resumeFrom(null, 'v2'), Number.NEGATIVE_INFINITY);
  assert.equal(resumeFrom({ version: 'v1', resumeTs: 5000 }, 'v2'), Number.NEGATIVE_INFINITY);
  assert.equal(resumeFrom({ version: 'v2', resumeTs: 5000 }, 'v2'), 5000);
});

test('the chains kept are those begun before the resume point', () => {
  const row = (firstTs: number) => ({ firstTs, lastTs: firstTs + 1, confidence: 1, pieces: '[]', anchors: '[]' });
  assert.deepEqual(keptBefore([row(0), row(10), row(20)], 20).map((r) => r.firstTs), [0, 10]);
});

/** The shipped network, for a realistic trip. */
const graph = decodeRoadGraph(
  JSON.parse(readFileSync(path.join(repoRoot, 'content/roads.json'), 'utf8')) as RoadFile
);

/** Three walks in Funchal with stops between them, and the desk-like rest after. */
function dayOfWalks(): MatchFix[] {
  const starts = [[32.6496, -16.9086], [32.6480, -16.9020], [32.6520, -16.9150]];
  const fixes: MatchFix[] = [];
  let clock = 1_800_000_000_000;
  starts.forEach(([lat, lon], i) => {
    const random = rng(4242 + i);
    const found = [];
    for (let e = 0; e < graph.edgeCount && found.length === 0; e += 1) {
      const p = graph.pointStart[e];
      if (Math.abs(graph.lat[p] - lat) < 0.001 && Math.abs(graph.lon[p] - lon) < 0.001 && 'rf'.includes(graph.edgeKindCodes[e])) {
        found.push(e);
      }
    }
    const steps = randomRoute(graph, found[0], 1500, random, 'rf');
    const trip = sampleTrip(graph, pointAt, steps, random, {
      speedMps: 1.4, intervalS: 10, sigmaM: 5, correlationS: 60, outlierRate: 0.01, accuracyM: 6,
    });
    const offset = clock - trip.fixes[0].ts;
    for (const fix of trip.fixes) {
      fixes.push({ ...fix, ts: fix.ts + offset });
    }
    clock = fixes[fixes.length - 1].ts;
    // A coffee: twenty minutes at rest, reporting almost no speed.
    const [restLat, restLon] = [fixes[fixes.length - 1].lat, fixes[fixes.length - 1].lon];
    for (let t = 1; t <= 120; t += 1) {
      fixes.push({ ts: clock + t * 10_000, lat: restLat, lon: restLon, accuracy_m: 5, speed_mps: 0.05 });
    }
    clock += 121 * 10_000;
  });
  return fixes;
}

function litByEdge(chains: MatchedChain[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const [edge, intervals] of visitedEdges(graph, chains)) {
    out.set(edge, intervals.reduce((sum, [a, b]) => sum + (b - a), 0));
  }
  return out;
}

test('matched visit by visit, the roads are the same as matched all at once', () => {
  const fixes = dayOfWalks();
  const whole = litByEdge(matchTrace(graph, fixes).chains);
  assert.ok(whole.size > 20, 'the day lights a real network');

  // The map opened every 97 fixes as the day was recorded, keeping chains and
  // the resume point between visits exactly as roadNetwork.ts does.
  let kept: StoredChain[] = [];
  let resumeTs = Number.NEGATIVE_INFINITY;
  let visits = 0;
  for (let upTo = 97; upTo < fixes.length + 97; upTo += 97) {
    const seen = fixes.slice(0, Math.min(upTo, fixes.length));
    const fromTs = resumeTs;
    const subset = seen.filter((fix) => fix.ts >= fromTs - MOTION_CONTEXT_MS);
    const result = matchTrace(graph, subset, { fromTs });
    kept = [...keptBefore(kept, fromTs), ...result.chains.map(toStored)];
    resumeTs = result.resumeTs ?? fromTs;
    visits += 1;
  }
  assert.ok(visits >= 5 && Number.isFinite(resumeTs), 'the resume point moved on during the day');
  const incremental = litByEdge(kept.map(fromStored));

  assert.deepEqual([...incremental.keys()].sort(), [...whole.keys()].sort(), 'the same edges lit');
  for (const [edge, metres] of whole) {
    assert.ok(Math.abs((incremental.get(edge) ?? 0) - metres) < 0.5, `edge ${edge}`);
  }
});
