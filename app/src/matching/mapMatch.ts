/**
 * Which roads and paths a trace travelled (D-093).
 *
 * WHAT THIS REPLACES, AND WHY
 * ---------------------------
 * Until D-093 the map drew the phone's own positions joined by straight
 * lines. The project lead asked, three times, for the map to *"only highlight
 * the real roads which you can see on Google Maps"*, and the measurements
 * behind `docs/map-lines-problem.md` showed why the GPS line could not do it:
 * a phone at rest drifts smoothly along lines nobody walked, a recorder that
 * misses a stretch draws a chord across the mountains, and a line of fixes is
 * at best as close to the street as the GPS was. This module decides which
 * streets were travelled; what is drawn is then the street's own shape, from
 * OpenStreetMap (`roadGraph.ts`).
 *
 * HOW
 * ---
 * A hidden Markov model, the standard method (Newson and Krumm, 2009):
 *
 *   - Each fix has **candidates**: the nearest point on each edge within a
 *     radius set by the fix's own reported accuracy.
 *   - A candidate is **likely** in proportion to how close it is to the fix
 *     (a Gaussian of the distance, `emissionLog`).
 *   - A move from one fix's candidate to the next's is **likely** in
 *     proportion to how well the distance *along roads* agrees with the
 *     distance *as the crow flies* (`transitionLog`). This is what tells the
 *     street apart from the one behind the houses: both are 15 m from the fix,
 *     but only one is 14 m further along from where the last fix was.
 *   - Viterbi picks the single most likely sequence, and the route between
 *     consecutive choices is what was travelled. A drive through a tunnel,
 *     where GPS stops, is a fix at one portal and one at the other: the route
 *     between them is the tunnel (ARCHITECTURE §8.1).
 *
 * WHERE IT REFUSES
 * ----------------
 * ARCHITECTURE §8's governing rule, applied: *be strict about what you are
 * certain about, generous in between*. A trace is cut into **chains**, and a
 * chain ends, drawing nothing across the break, when:
 *
 *   - the phone was not moving (`motionGate.ts`), so a phone on a desk lights
 *     nothing however far its position drifts;
 *   - fixes stop matching any road for a while (a beach, a square, a boat);
 *   - no route between consecutive fixes is plausible in the time between
 *     them, or the silence between them is longer than `MAX_BRIDGE_S`.
 *
 * A chain too short to be evidence of a journey (`MIN_CHAIN_FIXES`) is
 * dropped. What is left is drawn as roads, and nothing is drawn where no road
 * matched: that is the honesty contract D-093 accepted in place of D-032's.
 *
 * ⚠ **Every threshold here is argued, not measured.** No real movement on
 * Madeira had been recorded when this was written. The lead's outing (T-245)
 * is what tunes them; until then each says why it is the number it is.
 *
 * Pure: no database, no Expo. Tested in `mapMatch.test.ts`.
 */

import { distanceM } from '../recording/distance.ts';
import { MOTION_WINDOW_S, movingMask, speedCeiling } from './motionGate.ts';
import type { GateFix } from './motionGate.ts';
import { KIND_COUNT, KIND_INDEX, nearbyEdges, pointAt } from './roadGraph.ts';
import type { Candidate, RoadGraph } from './roadGraph.ts';
import { createScratch, distancesFrom, routeBetween } from './roadRouting.ts';
import type { EdgePiece, KindCosts, RouteScratch } from './roadRouting.ts';
import type { Activity } from '../recording/activityTimeline.ts';

/**
 * Bumped whenever a change here, or in anything it calls, would match the same
 * fixes differently. Chains kept by `chainStore.ts` under another version are
 * dropped and the trip rematched.
 */
export const MATCHER_VERSION = 4;

/** What the matcher needs of a fix: a subset of the `raw_fix` row. */
export type MatchFix = GateFix & {
  accuracy_m: number | null;
};

/**
 * Fixes vaguer than this are not used at all, metres.
 *
 * ⚠ NOT TUNED. Loose on purpose: under canopy a levada walk may have nothing
 * better, and the candidate radius and emission already weigh a vague fix
 * lightly. Past 100 m a fix can sit on the wrong valley's path.
 */
export const MATCH_MAX_ACCURACY_M = 100;

/**
 * How far a mapped road may be from where it really is, metres. Added to the
 * fix's own error, because OpenStreetMap and Google do not trace every street
 * from the same imagery.
 */
export const MAP_ERROR_M = 4;

/** The smallest error a fix is ever credited with, metres. */
export const MIN_SIGMA_M = 5;

/**
 * Candidates are searched within this many sigmas of a fix, and within these
 * bounds, metres.
 *
 * ⚠ NOT TUNED. The floor keeps a street 20 m away in reach of an optimistic
 * ±3 m fix; the ceiling keeps a ±100 m canopy fix from reaching the wrong
 * valley.
 */
export const CANDIDATE_SIGMAS = 3;
export const MIN_CANDIDATE_RADIUS_M = 25;
export const MAX_CANDIDATE_RADIUS_M = 100;

/** Edges considered per fix, nearest first. */
export const MAX_CANDIDATES = 8;

/**
 * The transition's tolerance for road distance disagreeing with straight-line
 * distance, metres: `BETA_M + BETA_PER_M × straight-line distance`.
 *
 * ⚠ NOT TUNED. Newson and Krumm fitted theirs to ground truth; there is none
 * here yet. It grows with distance because a longer step cuts more corners:
 * two fixes 400 m apart on a hairpin road are 600 m apart by road, and that
 * is not evidence against the road.
 */
export const BETA_M = 10;
export const BETA_PER_M = 0.1;

/**
 * The fastest the route between two fixes may imply, m/s: about 180 km/h,
 * well over the VR1's 100 km/h, so a sparse drive survives it.
 */
export const MAX_ROUTE_SPEED_MPS = 50;

/**
 * How far past the phone's own reported speed a route may go: the route
 * between two fixes may imply at most `SPEED_FACTOR ×` the fastest speed
 * reported around them, plus `SPEED_MARGIN_MPS`.
 *
 * ⚠ NOT TUNED. This is what stops a wild fix from being reached by a detour
 * out and back: on synthetic walks in Funchal's old town it was most of the
 * wrongly lit road before it existed. Generous, because a bound tighter than
 * the truth breaks a real chain: the phone's speed is measured at the fixes
 * and the route runs between them.
 */
export const SPEED_FACTOR = 1.5;
export const SPEED_MARGIN_MPS = 2;

/**
 * The longest a route may be, as a multiple of the straight line plus a
 * constant, metres. A route three times the straight line plus 200 m covers a
 * hairpin stack; a route that has to go round a whole valley does not, and is
 * the wrong road.
 */
export const MAX_ROUTE_FACTOR = 4;
export const MAX_ROUTE_SLACK_M = 200;

/**
 * The longest silence a route may be drawn across, seconds.
 *
 * ⚠ NOT TUNED. A tunnel on the VR1 is a minute or two of silence at driving
 * speed; five minutes is well past that. Longer, and the shortest route is a
 * guess about which way the user went, so the line breaks instead (T-244's
 * lesson, kept).
 */
export const MAX_BRIDGE_S = 5 * 60;

/**
 * The widest gap the line may step across where the map does not join two
 * pieces, metres, and what each metre of it costs against a real route.
 *
 * ⚠ Found 2026-10-04 on the promenade into Câmara de Lobos: the footpath and
 * the street it meets are 10 m apart on the ground and 1.5 km apart in the
 * network, because OpenStreetMap stops the path short of the street (and
 * `build-roads.mjs` leaves sidewalks and crossings out on purpose). With no
 * route between two fixes 9 s apart, the line broke there, both ways. Nobody
 * teleports, so a short hop is allowed when no route is.
 *
 * Only where one side is a path or levada (`HOP_KINDS`): two roads that do
 * not meet are usually a bridge over another road, and a car must never hop
 * from one to the other.
 */
export const HOP_MAX_M = 25;
export const HOP_COST_FACTOR = 3;
const HOP_KINDS = new Set([KIND_INDEX.f, KIND_INDEX.l]);

/**
 * The straight hop between two candidates, metres, or null when none is
 * allowed. `movedM` is how far apart the two fixes are: the line waits at the
 * end of the path until no route is left, by which time the walker is past
 * the gap, so the hop may cover that too, up to twice `HOP_MAX_M`.
 */
function hopM(graph: RoadGraph, from: Candidate, to: Candidate, movedM: number): number | null {
  if (!HOP_KINDS.has(graph.kindIndex[from.edge]) && !HOP_KINDS.has(graph.kindIndex[to.edge])) {
    return null;
  }
  const [aLat, aLon] = pointAt(graph, from.edge, from.offset);
  const [bLat, bLon] = pointAt(graph, to.edge, to.offset);
  const metres = distanceM({ lat: aLat, lon: aLon }, { lat: bLat, lon: bLon });
  return metres <= HOP_MAX_M + Math.min(movedM, HOP_MAX_M) ? metres : null;
}

/**
 * Fixes that match no road for this long end the chain, seconds. A few
 * off-road fixes in a row are noise; a minute and a half of them is a beach,
 * a square, or a boat.
 */
export const OFF_NETWORK_BREAK_S = 90;

/** Fixes in a row that may be skipped as impossible before the chain ends. */
export const MAX_SKIPPED_FIXES = 2;

/**
 * The fewest fixes a chain needs to be drawn. WalkNYC asks four fixes of a
 * block before it counts it; the same here, for the same reason: one or two
 * fixes near a road are not evidence of having travelled it.
 */
export const MIN_CHAIN_FIXES = 4;

/**
 * A fix is dropped as wild when it is the only evidence for a detour at least
 * this long, metres: when the route through it, from the fix before to the
 * fix after, is this much longer than the route that skips it. Two fixes in a
 * row are judged together the same way, because bad fixes come in bursts.
 *
 * ⚠ NOT TUNED. It is what the transition model cannot see by itself: a wild
 * fix 100 m up a side path is 100 m from its neighbours both as the crow
 * flies and by road, so each step looks honest while the pair is an
 * out-and-back nobody made. On synthetic levada walks those excursions were
 * most of the wrongly lit path. A real out-and-back to a viewpoint has several
 * fixes at its far end; a real corner has no detour at all. Twice
 * `SPUR_MAX_M`, the stub a spur trim removes anyway.
 */
export const DETOUR_MAX_M = 40;

/**
 * The rule applies only where the phone reported no more than this, m/s, or
 * no speed at all: on foot.
 *
 * ⚠ Measured on synthetic trips, where it was tried on everything first. On a
 * drive, fixes 200 to 400 m apart, a driver is often not on the shortest path
 * between two of them, and the rule dropped good fixes: automatic drives lost
 * a third of their length, even with the threshold scaled to the distance. On
 * foot it is what fixed the levada walks (precision 92% to 98%), and the
 * problem it solves, a wild fix pulling a slow line up a side path, is a
 * walking problem: at driving speed the speed bound already refuses most of it.
 */
export const DETOUR_WALKING_MAX_MPS = 3;

/** How many times matching is rerun with the wild fixes it found removed. */
export const OUTLIER_PASSES = 3;

/**
 * What a metre of each kind of way costs, by what the phone's motion sensors
 * said the user was doing (D-094). A cost, never a ban.
 *
 * ⚠ **Why not a filter.** "A car cannot be on a footway" is true, and a filter
 * would enforce it perfectly, until the label is wrong: Android's lags a change
 * by up to a minute, and can miss one. A filter then deletes a real journey; a
 * cost only makes the wrong way dearer, and enough evidence still wins.
 *
 * ⚠ NOT TUNED. Six times dearer is strong enough to choose the road beside a
 * levada over the levada path for a car, and weak enough that a car label on a
 * walk up a levada (a missed transition) still follows the levada when that is
 * the only way the fixes fit.
 *
 * ⚠ **Aerial lifts cost a metre for everyone.** A cable car ride reads as
 * *in a vehicle*, or as *still* on a smooth one, and must still match the cable.
 */
export const MODE_COSTS: Partial<Record<Activity, Float64Array>> = {
  driving: costs({ f: 6, l: 6 }),
  walking: costs({ m: 6 }),
  running: costs({ m: 6 }),
  cycling: costs({ m: 6 }),
};

/**
 * A walking or running label is ignored where the receiver measured more than
 * this nearby, m/s: 25 km/h, the recorder's own "vehicle rate"
 * (`movementPolicy.VEHICLE_SPEED_MPS`). Nobody walks that fast, so the label is
 * the wrong one, and on the VR1 a wrong *walking* label made the carriageway
 * dear. A wrong *driving* label cannot be disproved this way (Funchal's traffic
 * crawls), which is why every mode is a cost and never a ban.
 */
export const FOOT_MAX_MPS = 7;

/** The label as the matcher trusts it: see `FOOT_MAX_MPS`. */
export function effectiveActivity(
  activity: Activity | null | undefined,
  ceiling: number | null
): Activity {
  const label = activity ?? 'unknown';
  if ((label === 'walking' || label === 'running') && ceiling !== null && ceiling > FOOT_MAX_MPS) {
    return 'unknown';
  }
  return label;
}

/** A candidate on a way its mode makes dear starts this much less likely. */
export const MODE_EMISSION_PENALTY = 1.5;

function costs(dear: Partial<Record<keyof typeof KIND_INDEX, number>>): Float64Array {
  const table = new Float64Array(KIND_COUNT).fill(1);
  for (const [kind, cost] of Object.entries(dear)) {
    table[KIND_INDEX[kind as keyof typeof KIND_INDEX]] = cost as number;
  }
  return table;
}

/**
 * The costs for a step between two fixes: those of the mode both agree on, or
 * of the one that has a mode when the other has none. Two different modes (the
 * car park, where a drive becomes a walk) cost nothing extra at all.
 */
export function stepCosts(a: Activity | null | undefined, b: Activity | null | undefined): KindCosts {
  const first = a === null || a === undefined ? undefined : MODE_COSTS[a];
  const second = b === null || b === undefined ? undefined : MODE_COSTS[b];
  if (first !== undefined && second !== undefined) {
    return first === second ? first : null;
  }
  return first ?? second ?? null;
}

/** A travelled stretch: one unbroken chain of matched fixes. */
export type MatchedChain = {
  /** The route travelled, in order. Consecutive pieces on one edge are merged. */
  pieces: EdgePiece[];
  /**
   * Where each matched fix sits along the route, in metres from its start,
   * with its time: what the replay film paces itself by.
   */
  anchors: { ts: number; atM: number }[];
  /**
   * Mean emission likelihood of the chosen candidates, 0 to 1: how close the
   * fixes sat to the roads they were matched to. Never shown; stored so the
   * thresholds can be retuned against real trips (CONTEXT §6.2).
   */
  confidence: number;
};

export type MatchStats = {
  fixesIn: number;
  fixesUsable: number;
  fixesMoving: number;
  fixesMatched: number;
  /** Dropped as the only evidence for a detour (`DETOUR_MAX_M`). */
  fixesWild: number;
  chains: number;
  chainsDropped: number;
};

type Layer = {
  fix: MatchFix;
  /** The fastest speed reported near this fix, or null. */
  ceiling: number | null;
  candidates: Candidate[];
  /** Log-probability of the best sequence ending at each candidate. */
  score: Float64Array;
  /** Index into the previous layer's candidates, or -1 for a chain's first. */
  back: Int32Array;
  /** The route limit used to reach this layer, for rebuilding the route. */
  limitM: number;
  /** The costs used to reach this layer, for rebuilding the same route. */
  costs: KindCosts;
};

/** The sigma a fix is judged by, metres. */
export function sigmaOf(accuracyM: number | null): number {
  // Android's accuracy is the radius of 68% confidence. For a circular
  // Gaussian that radius is about 1.5 sigmas.
  const gps = accuracyM === null ? 10 : accuracyM / 1.5;
  return Math.max(MIN_SIGMA_M, Math.sqrt(gps * gps + MAP_ERROR_M * MAP_ERROR_M));
}

export function emissionLog(distance: number, sigma: number): number {
  const z = distance / sigma;
  return -0.5 * z * z;
}

export function transitionLog(routeM: number, straightM: number): number {
  const beta = BETA_M + BETA_PER_M * straightM;
  return -Math.abs(routeM - straightM) / beta;
}

/**
 * Match a trace to the network, all at once. `fixes` in any order. Tests and
 * tools use this; the app uses `matchTraceInSteps`.
 */
export function matchTrace(
  graph: RoadGraph,
  fixes: readonly MatchFix[],
  options: MatchOptions = {}
): MatchResult {
  const steps = matchTraceInSteps(graph, fixes, options);
  for (;;) {
    const next = steps.next();
    if (next.done === true) {
      return next.value;
    }
  }
}

/**
 * How far before `MatchOptions.fromTs` a caller should include fixes, ms: the
 * motion gate and the speed bound look `MOTION_WINDOW_S` either side of a fix,
 * and a fix at the start of the range must see the same neighbours it would
 * in the whole trace.
 */
export const MOTION_CONTEXT_MS = 2 * MOTION_WINDOW_S * 1000;

export type MatchOptions = {
  /**
   * Match only fixes from this moment on. Earlier fixes still inform the
   * motion gate and the speed bound around the start, which look either side
   * of each fix; they are not matched again (`chainStore.ts`).
   */
  fromTs?: number;
};

export type MatchResult = {
  chains: MatchedChain[];
  stats: MatchStats;
  /**
   * The latest fix at which a chain began and from which matching may resume
   * with the same result (`chainStore.ts` says why), or null when there is
   * none yet: at least `MOTION_CONTEXT_MS` older than the newest fix.
   */
  resumeTs: number | null;
};

/** A chain's worth of a pass: what it matched, and over which fixes. */
type Part = {
  chain: MatchedChain | null;
  firstTs: number;
  lastTs: number;
  fixCount: number;
  wild: number[];
};

/**
 * Match a trace to the network a little at a time: yields after every fix and
 * every few steps of a backtrack, and returns the chains at the end.
 *
 * ⚠ **Why in steps (measured 2026-09-27).** On the P30, 630 moving fixes took
 * 1,015 ms in one go on the JavaScript thread, about 1.6 ms a fix; a week's
 * trip is thousands. The caller (`roadNetwork.ts`) runs a slice and lets a
 * frame through, as it does for the network's decode.
 */
export function* matchTraceInSteps(
  graph: RoadGraph,
  fixes: readonly MatchFix[],
  options: MatchOptions = {}
): Generator<void, MatchResult, void> {
  const fromTs = options.fromTs ?? Number.NEGATIVE_INFINITY;
  const usable = fixes
    .filter(
      (fix) =>
        Number.isFinite(fix.lat) &&
        Number.isFinite(fix.lon) &&
        (fix.accuracy_m === null || fix.accuracy_m <= MATCH_MAX_ACCURACY_M)
    )
    .sort((a, b) => a.ts - b.ts)
    .filter((fix, i, all) => i === 0 || fix.ts !== all[i - 1].ts);

  const mask = movingMask(usable);
  const ceilings = speedCeiling(usable);
  const moving: Moving[] = [];
  for (let i = 0; i < usable.length; i += 1) {
    if (mask[i] && usable[i].ts >= fromTs) {
      moving.push({ fix: usable[i], ceiling: ceilings[i] });
    }
  }
  yield;

  const scratch = createScratch(graph);
  const firstPass = yield* matchPass(graph, scratch, moving);
  let parts = firstPass.parts;

  // A chain start is a safe place to resume only once nothing still to be
  // recorded can change the decisions that led to it: its context is the
  // minute either side.
  const newest = usable.length === 0 ? Number.NEGATIVE_INFINITY : usable[usable.length - 1].ts;
  let resumeTs: number | null = null;
  for (const start of firstPass.starts) {
    if (start <= newest - MOTION_CONTEXT_MS) {
      resumeTs = start;
    }
  }

  // Wild fixes (`DETOUR_MAX_M`) are removed and **only the chains that held
  // them** are matched again. Rematching the whole trace for a handful of
  // wild fixes tripled the cost on the phone for nothing: a chain is matched
  // from its own fixes alone, so the others cannot change.
  const removed = new Set<number>();
  for (let pass = 2; pass <= OUTLIER_PASSES; pass += 1) {
    if (!parts.some((part) => part.wild.length > 0)) {
      break;
    }
    const next: Part[] = [];
    for (const part of parts) {
      if (part.wild.length === 0) {
        next.push(part);
        continue;
      }
      for (const ts of part.wild) {
        removed.add(ts);
      }
      const subset = moving.filter(
        (entry) =>
          entry.fix.ts >= part.firstTs && entry.fix.ts <= part.lastTs && !removed.has(entry.fix.ts)
      );
      const redone = yield* matchPass(graph, scratch, subset);
      for (const piece of redone.parts) {
        next.push(piece);
      }
    }
    parts = next;
  }

  const chains: MatchedChain[] = [];
  let matched = 0;
  let dropped = 0;
  for (const part of parts) {
    if (part.chain === null) {
      dropped += 1;
    } else {
      chains.push(part.chain);
      matched += part.fixCount;
    }
  }
  return {
    chains,
    stats: {
      fixesIn: fixes.length,
      fixesUsable: usable.length,
      fixesMoving: moving.length,
      fixesMatched: matched,
      fixesWild: removed.size,
      chains: chains.length,
      chainsDropped: dropped,
    },
    resumeTs,
  };
}

type Moving = { fix: MatchFix; ceiling: number | null };

/**
 * One pass of matching over moving fixes, chain by chain, and the time of
 * every fix a chain started at (drawn or dropped).
 */
function* matchPass(
  graph: RoadGraph,
  scratch: RouteScratch,
  moving: readonly Moving[]
): Generator<void, { parts: Part[]; starts: number[] }, void> {
  const parts: Part[] = [];
  const starts: number[] = [];
  let layers: Layer[] = [];
  let skipped = 0;

  // A generator cannot yield from inside a nested function, so finishing a
  // chain is written as one: `yield* finish()`.
  function* finish(): Generator<void, void, void> {
    if (layers.length >= MIN_CHAIN_FIXES) {
      const result = yield* backtrack(graph, scratch, layers);
      parts.push({
        chain: result.chain,
        firstTs: layers[0].fix.ts,
        lastTs: layers[layers.length - 1].fix.ts,
        fixCount: layers.length,
        wild: result.wild,
      });
    } else if (layers.length > 0) {
      parts.push({
        chain: null,
        firstTs: layers[0].fix.ts,
        lastTs: layers[layers.length - 1].fix.ts,
        fixCount: layers.length,
        wild: [],
      });
    }
    layers = [];
    skipped = 0;
  }

  for (const { fix, ceiling } of moving) {
    yield;
    const sigma = sigmaOf(fix.accuracy_m);
    const radius = Math.min(
      MAX_CANDIDATE_RADIUS_M,
      Math.max(MIN_CANDIDATE_RADIUS_M, CANDIDATE_SIGMAS * sigma)
    );
    const candidates = nearbyEdges(graph, fix.lat, fix.lon, radius, MAX_CANDIDATES);

    if (candidates.length === 0) {
      // Off the network. A short excursion is noise and is stepped over; a
      // long one ends the chain, so nothing is bridged across a beach.
      const last = layers[layers.length - 1];
      if (last !== undefined && fix.ts - last.fix.ts > OFF_NETWORK_BREAK_S * 1000) {
        yield* finish();
      }
      continue;
    }

    const own = MODE_COSTS[effectiveActivity(fix.activity, ceiling)];
    const emission = candidates.map(
      (c) =>
        emissionLog(c.distance, sigma) -
        (own !== undefined && own[graph.kindIndex[c.edge]] > 1 ? MODE_EMISSION_PENALTY : 0)
    );

    const previous = layers.length > 0 ? layers[layers.length - 1] : null;
    if (previous === null || fix.ts - previous.fix.ts > MAX_BRIDGE_S * 1000) {
      yield* finish();
      layers.push(firstLayer(fix, ceiling, candidates, emission));
      starts.push(fix.ts);
      continue;
    }

    const next = step(graph, scratch, previous, fix, ceiling, candidates, emission);
    if (next === null) {
      // No plausible route from anywhere the last fix could have been. One or
      // two such fixes are skipped as wild; more, and the trace has genuinely
      // broken, so a new chain starts here.
      skipped += 1;
      if (skipped > MAX_SKIPPED_FIXES) {
        yield* finish();
        layers.push(firstLayer(fix, ceiling, candidates, emission));
        starts.push(fix.ts);
      }
      continue;
    }

    skipped = 0;
    layers.push(next);
  }
  yield* finish();

  return { parts, starts };
}

function firstLayer(
  fix: MatchFix,
  ceiling: number | null,
  candidates: Candidate[],
  emission: number[]
): Layer {
  return {
    fix,
    ceiling,
    candidates,
    score: Float64Array.from(emission),
    back: new Int32Array(candidates.length).fill(-1),
    limitM: 0,
    costs: null,
  };
}

/** One Viterbi step, or null when no transition is plausible. */
function step(
  graph: RoadGraph,
  scratch: RouteScratch,
  previous: Layer,
  fix: MatchFix,
  ceiling: number | null,
  candidates: Candidate[],
  emission: number[]
): Layer | null {
  const straight = distanceM(previous.fix, fix);
  const seconds = (fix.ts - previous.fix.ts) / 1000;
  // Both fixes may be off by their own error, which the speed limit must not
  // count as travel.
  const slack = 2 * (sigmaOf(previous.fix.accuracy_m) + sigmaOf(fix.accuracy_m));
  const reported =
    previous.ceiling === null
      ? ceiling
      : ceiling === null
        ? previous.ceiling
        : Math.max(previous.ceiling, ceiling);
  const speedLimit =
    reported === null
      ? MAX_ROUTE_SPEED_MPS
      : Math.min(MAX_ROUTE_SPEED_MPS, SPEED_FACTOR * reported + SPEED_MARGIN_MPS);
  const limitM = Math.min(
    speedLimit * seconds + slack,
    MAX_ROUTE_FACTOR * straight + MAX_ROUTE_SLACK_M
  );

  const score = new Float64Array(candidates.length).fill(-Infinity);
  const back = new Int32Array(candidates.length).fill(-1);
  const targets = candidates.map((c) => ({ edge: c.edge, offset: c.offset }));
  const costs = stepCosts(
    effectiveActivity(previous.fix.activity, previous.ceiling),
    effectiveActivity(fix.activity, ceiling)
  );

  // ⚠ Hops only where the line would otherwise break: a second pass, taken
  // when no route at all joins the two fixes. Offered alongside routes, a
  // hop was cheaper than following a levada's own path beside its channel,
  // and the synthetic trail walk's precision fell from 98% to 69%.
  for (const allowHops of [false, true]) {
    for (let i = 0; i < previous.candidates.length; i += 1) {
      if (previous.score[i] === -Infinity) {
        continue;
      }
      const from = previous.candidates[i];
      // `routes` are costs; whether a route was possible at all was decided
      // in real metres inside the search (`RouteScratch.len`).
      const routes = allowHops
        ? null
        : distancesFrom(
            graph,
            scratch,
            { edge: from.edge, offset: from.offset },
            targets,
            limitM,
            costs
          );
      for (let j = 0; j < candidates.length; j += 1) {
        let routeCost = routes === null ? Infinity : routes[j];
        if (allowHops) {
          const hop = hopM(graph, from, candidates[j], straight);
          if (hop === null) {
            continue;
          }
          routeCost = HOP_COST_FACTOR * hop;
        } else if (!Number.isFinite(routeCost)) {
          continue;
        }
        const value = previous.score[i] + transitionLog(routeCost, straight);
        if (value > score[j]) {
          score[j] = value;
          back[j] = i;
        }
      }
    }
    if (score.some((value) => value !== -Infinity)) {
      break;
    }
  }

  let any = false;
  for (let j = 0; j < candidates.length; j += 1) {
    if (score[j] !== -Infinity) {
      score[j] += emission[j];
      any = true;
    }
  }
  if (!any) {
    return null;
  }

  // Keep the scores from drifting towards -Infinity over a long chain: only
  // their differences matter.
  let best = -Infinity;
  for (let j = 0; j < candidates.length; j += 1) {
    best = Math.max(best, score[j]);
  }
  for (let j = 0; j < candidates.length; j += 1) {
    score[j] -= best;
  }

  return { fix, ceiling, candidates, score, back, limitM, costs };
}

/** The most likely sequence, as the route it travelled. */
function* backtrack(
  graph: RoadGraph,
  scratch: RouteScratch,
  layers: Layer[]
): Generator<void, { chain: MatchedChain | null; wild: number[] }, void> {
  const last = layers[layers.length - 1];
  let index = 0;
  for (let j = 1; j < last.candidates.length; j += 1) {
    if (last.score[j] > last.score[index]) {
      index = j;
    }
  }

  const chosen: Candidate[] = new Array(layers.length);
  for (let k = layers.length - 1; k >= 0; k -= 1) {
    chosen[k] = layers[k].candidates[index];
    index = layers[k].back[index];
  }

  const pieces: EdgePiece[] = [];
  const anchors: { ts: number; atM: number }[] = [{ ts: layers[0].fix.ts, atM: 0 }];
  /** Route length from chosen[k - 1] to chosen[k], at index k. */
  const stepM: number[] = [0];
  let atM = 0;
  let likelihood = Math.exp(emissionLog(chosen[0].distance, sigmaOf(layers[0].fix.accuracy_m)));

  for (let k = 1; k < layers.length; k += 1) {
    if (k % 8 === 0) {
      yield;
    }
    const route = routeBetween(
      graph,
      scratch,
      { edge: chosen[k - 1].edge, offset: chosen[k - 1].offset },
      { edge: chosen[k].edge, offset: chosen[k].offset },
      layers[k].limitM,
      undefined,
      layers[k].costs
    );
    let routeM = 0;
    if (route === null) {
      // No route, so Viterbi chose a hop (`HOP_MAX_M`). The next route starts
      // on the far side; the hop adds nothing to the distance along the
      // pieces, which is what the anchors measure.
      const hop = hopM(
        graph,
        chosen[k - 1],
        chosen[k],
        distanceM(layers[k - 1].fix, layers[k].fix)
      );
      if (hop === null) {
        // Viterbi found a route or a hop a moment ago; neither can fail now.
        // Refuse the chain rather than draw a guess.
        return { chain: null, wild: [] };
      }
      stepM.push(hop);
      anchors.push({ ts: layers[k].fix.ts, atM });
      likelihood += Math.exp(emissionLog(chosen[k].distance, sigmaOf(layers[k].fix.accuracy_m)));
      continue;
    }
    for (const piece of route) {
      appendPiece(pieces, piece);
      routeM += Math.abs(piece.to - piece.from);
    }
    atM += routeM;
    stepM.push(routeM);
    anchors.push({ ts: layers[k].fix.ts, atM });
    likelihood += Math.exp(emissionLog(chosen[k].distance, sigmaOf(layers[k].fix.accuracy_m)));
  }

  const wild = yield* findWild(graph, scratch, layers, chosen, stepM);
  if (pieces.length === 0) {
    return { chain: null, wild };
  }
  return { chain: { pieces, anchors, confidence: likelihood / layers.length }, wild };
}

/**
 * Fixes that are the only evidence for a detour (`DETOUR_MAX_M`): one fix, or
 * two in a row, whose removal shortens the route by more than that.
 */
function* findWild(
  graph: RoadGraph,
  scratch: RouteScratch,
  layers: Layer[],
  chosen: Candidate[],
  stepM: number[]
): Generator<void, number[], void> {
  const wild: number[] = [];
  const point = (c: Candidate) => ({ edge: c.edge, offset: c.offset });
  for (let k = 1; k < layers.length - 1; k += 1) {
    if (k % 8 === 0) {
      yield;
    }
    const ceiling = layers[k].ceiling;
    if (ceiling !== null && ceiling > DETOUR_WALKING_MAX_MPS) {
      continue;
    }
    for (const span of [1, 2]) {
      const after = k + span;
      if (after >= layers.length) {
        continue;
      }
      let through = 0;
      for (let j = k; j <= after; j += 1) {
        through += stepM[j];
      }
      if (through <= DETOUR_MAX_M) {
        continue;
      }
      const [skipping] = distancesFrom(
        graph,
        scratch,
        point(chosen[k - 1]),
        [point(chosen[after])],
        through
      );
      if (through - skipping > DETOUR_MAX_M) {
        for (let j = k; j < after; j += 1) {
          wild.push(layers[j].fix.ts);
        }
        k = after - 1; // judge the next fix against a clean neighbour
        break;
      }
    }
  }
  return wild;
}

/** Add a piece, merging it into the last when it continues along one edge. */
function appendPiece(pieces: EdgePiece[], piece: EdgePiece): void {
  const last = pieces[pieces.length - 1];
  if (last !== undefined && last.edge === piece.edge && last.to === piece.from) {
    const lastForward = last.to >= last.from;
    const pieceForward = piece.to >= piece.from;
    if (lastForward === pieceForward) {
      last.to = piece.to;
      return;
    }
  }
  pieces.push({ ...piece });
}
