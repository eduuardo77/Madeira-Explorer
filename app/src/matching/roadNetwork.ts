/**
 * The shipped road network, and the lines each screen draws from it (D-093).
 *
 * The impure half beside the pure modules in this folder, the same split as
 * `stampRules` / `stampAwards`: this file reaches into `content/` and keeps
 * state; everything it calls is pure and tested on Node.
 *
 * **Three callers, two kinds of line.** The map is private to the phone and
 * draws every road the trip travelled. The share card and the film leave the
 * phone, so they are built only from the masked export trace, and then cut at
 * the mask circle (`roadTrace.ts` says why the second step is not optional).
 *
 * ⚠ **The network is 2.7 MB of JSON compiled into the bundle, and decoding it
 * blocked the P30's JavaScript thread for 1,241 ms the first time (measured
 * 2026-09-27).** So it is required on first use, not at start-up, and decoded
 * in slices of `SLICE_MS` with a frame let through between them: the map is
 * on screen and answering while its roads are being prepared. Kept for the
 * life of the process once decoded. Matching runs the same way, and the map's
 * chains are kept in `matched_chain` so a cold start only matches what the
 * recorder added since (`chainStore.ts`).
 */

import type { TraceSegment } from '../map/traceGeoJson';
import * as activityEventDao from '../storage/dao/activityEventDao';
import * as matchedChainDao from '../storage/dao/matchedChainDao';
import { activitiesAt } from '../recording/activityTimeline';
import { chainVersion, fromStored, keptBefore, resumeFrom, toStored } from './chainStore';
import { matchTraceInSteps, MOTION_CONTEXT_MS } from './mapMatch';
import type { MatchedChain, MatchFix, MatchStats } from './mapMatch';
import { decodeRoadGraphInSteps } from './roadGraph';
import type { DecodePhase, RoadFile, RoadGraph } from './roadGraph';
import { chainTimedRuns, clipOutsideCircle, travelledSinceM } from './roadTrace';
import type { TimedPoint } from './roadTrace';
import { visitedEdges, visitedLengthM, visitedLines } from './visitedRoads';
import type { VisitedLine } from './visitedRoads';

/** The longest the decoder runs before letting a frame through, ms. */
const SLICE_MS = 12;

export type NetworkTimings = {
  /** Evaluating the bundled JSON on first use. */
  requireMs: number;
  /** Time spent in each decode phase, summed over slices. */
  phaseMs: Record<DecodePhase, number>;
  /** First use to ready, including the frames let through. */
  wallMs: number;
  slices: number;
};

let graph: RoadGraph | null = null;
let loading: Promise<RoadGraph> | null = null;
let timings: NetworkTimings | null = null;

/** The network, decoded once, without holding the screen. */
export function loadRoadGraph(): Promise<RoadGraph> {
  if (graph !== null) {
    return Promise.resolve(graph);
  }
  if (loading === null) {
    loading = decodeInSlices().catch((error: unknown) => {
      loading = null; // a later caller may try again
      throw error;
    });
  }
  return loading;
}

/** How loading the network went, once it has; null before. */
export function networkTimings(): NetworkTimings | null {
  return timings;
}

async function decodeInSlices(): Promise<RoadGraph> {
  const started = Date.now();
  // Required here, not imported at the top: evaluating 2.7 MB of JSON is work
  // the app should not do at start-up for a screen that may not need it yet.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const file = require('../../../content/roads.json') as RoadFile;
  const requireMs = Date.now() - started;

  const phaseMs: Record<DecodePhase, number> = { geometry: 0, lengths: 0, junctions: 0, grid: 0 };
  const run = await runInSlices(decodeRoadGraphInSteps(file), (phase, ms) => {
    phaseMs[phase] += ms;
  });
  graph = run.value;
  timings = { requireMs, phaseMs, wallMs: Date.now() - started, slices: run.slices };
  return graph;
}

/**
 * Run a stepwise computation `SLICE_MS` at a time, letting a frame through
 * between slices. `onStep` hears what each step yielded and how long it took.
 */
async function runInSlices<Y, R>(
  steps: Generator<Y, R, void>,
  onStep?: (value: Y, ms: number) => void
): Promise<{ value: R; slices: number; busyMs: number }> {
  let slices = 0;
  let busyMs = 0;
  for (;;) {
    const sliceStart = Date.now();
    slices += 1;
    for (;;) {
      const before = Date.now();
      const next = steps.next();
      const ms = Date.now() - before;
      busyMs += ms;
      if (next.done === true) {
        return { value: next.value, slices, busyMs };
      }
      if (onStep !== undefined) {
        onStep(next.value, ms);
      }
      if (Date.now() - sliceStart >= SLICE_MS) {
        break;
      }
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

export type RoadLines = {
  /** [lat, lon] points, each line following the roads; faded ones apart. */
  lines: VisitedLine[];
  /** Each travelled stretch counted once, metres. */
  lengthM: number;
  /** Metres travelled along the roads since local midnight, as a trip meter counts. */
  todayM: number;
  /** Of what was matched this time. */
  stats: MatchStats;
  /** Chains reused from `matched_chain`, and chains matched now. */
  keptChains: number;
  newChains: number;
  /** Time spent matching this time, summed over slices, for the diary. */
  elapsedMs: number;
  /** False when this is the in-memory answer and nothing was done now. */
  fresh: boolean;
};

/**
 * The last answer, keyed by what it was computed from. Opening the map again
 * with no new fixes costs nothing; one new fix rematches the trip, which is
 * the simple and safe choice while a trip is thousands of fixes, not millions.
 */
let cached: { key: string; value: RoadLines; chains: MatchedChain[]; day: number } | null = null;

function keyOf(network: RoadGraph, fixes: readonly MatchFix[]): string {
  const first = fixes[0]?.ts ?? 0;
  const last = fixes[fixes.length - 1]?.ts ?? 0;
  return `${network.version}:${fixes.length}:${first}:${last}`;
}

/**
 * Every road the trip travelled, for the map. Private: never exported.
 *
 * `fixes` are the trip's, in time order (`rawFixDao.getTraceFixes`).
 */
export async function roadLinesFor(
  tripId: number,
  fixes: readonly MatchFix[]
): Promise<RoadLines> {
  const network = await loadRoadGraph();
  const key = `${tripId}:${keyOf(network, fixes)}`;
  if (cached !== null && cached.key === key) {
    // ⚠ The day can change with no new fix: "today" is recounted, not cached.
    const todayM =
      cached.day === startOfToday()
        ? cached.value.todayM
        : travelledSinceM(network, cached.chains, startOfToday());
    return { ...cached.value, todayM, fresh: false };
  }

  const version = chainVersion(network.version);
  const fromTs = resumeFrom(await matchedChainDao.getProgress(tripId), version);
  const kept = keptBefore(await matchedChainDao.getChains(tripId, version), fromTs);

  // The minute before the resume point is context for the motion gate, not
  // matched again.
  const subset = await withActivities(fixes.filter((fix) => fix.ts >= fromTs - MOTION_CONTEXT_MS));
  const run = await runInSlices(matchTraceInSteps(network, subset, { fromTs }));
  const fresh = run.value.chains;
  await matchedChainDao.saveFrom(
    tripId,
    version,
    fromTs,
    fresh.map(toStored),
    run.value.resumeTs ?? fromTs
  );

  const chains = [...kept.map(fromStored), ...fresh];
  const visited = visitedEdges(network, chains);
  const value: RoadLines = {
    lines: visitedLines(network, visited),
    lengthM: visitedLengthM(visited),
    todayM: travelledSinceM(network, chains, startOfToday()),
    stats: run.value.stats,
    keptChains: kept.length,
    newChains: fresh.length,
    elapsedMs: run.busyMs,
    fresh: true,
  };
  cached = { key, value, chains, day: startOfToday() };
  return value;
}

/** Local midnight, on the phone's clock. */
function startOfToday(): number {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

let exportCached: { key: string; value: TraceSegment[] } | null = null;

/**
 * The fixes, each labelled with what the phone's motion sensors said at the
 * time (D-094), from the stored transitions. Labelled here, at match time, and
 * not trusted from `raw_fix.activity_type`, because a transition can reach the
 * app after the fixes it applies to were stored. No transitions (no
 * permission, another platform): every label is `unknown` and matching is as
 * it was before D-094.
 */
async function withActivities(fixes: readonly MatchFix[]): Promise<MatchFix[]> {
  if (fixes.length === 0) {
    return [];
  }
  try {
    let first = Infinity;
    let last = -Infinity;
    for (const fix of fixes) {
      first = Math.min(first, fix.ts);
      last = Math.max(last, fix.ts);
    }
    const events = await activityEventDao.getEventsFor(first, last);
    if (events.length === 0) {
      return [...fixes];
    }
    const labels = activitiesAt(events, fixes.map((fix) => fix.ts));
    return fixes.map((fix, i) => ({ ...fix, activity: labels[i] }));
  } catch {
    return [...fixes];
  }
}

/**
 * The roads travelled, as timed strokes safe to leave the phone.
 *
 * `fixes` must already be the masked export trace (`getExportableTrace`);
 * `mask` is the accommodation it was masked around, when there was one, and
 * `maskRadiusM` its radius. Strokes are in time order, as the film draws them.
 */
export async function exportRoadSegments(
  fixes: readonly MatchFix[],
  mask: { lat: number; lon: number } | null,
  maskRadiusM: number
): Promise<TraceSegment[]> {
  const network = await loadRoadGraph();
  // The passport asks the film planner whether there is a film on every visit
  // (T-217), so the same trace arrives again and again.
  const key = `${keyOf(network, fixes)}:${mask === null ? '-' : `${mask.lat},${mask.lon}`}:${maskRadiusM}`;
  if (exportCached !== null && exportCached.key === key) {
    return exportCached.value;
  }
  const { value } = await runInSlices(matchTraceInSteps(network, await withActivities(fixes)));
  const chains = value.chains;
  const segments: TraceSegment[] = [];
  for (const chain of chains) {
    // Run by run, so the film can fade tunnels and cable cars.
    for (const run of chainTimedRuns(network, chain)) {
      const pieces: TimedPoint[][] =
        mask === null ? [run.points] : clipOutsideCircle(run.points, mask, maskRadiusM);
      for (const piece of pieces) {
        if (piece.length >= 2) {
          segments.push({
            fixes: piece.map((point) => ({
              ts: point.ts,
              lat: point.lat,
              lon: point.lon,
              accuracy_m: null,
            })),
            faded: run.faded,
          });
        }
      }
    }
  }
  exportCached = { key, value: segments };
  return segments;
}
