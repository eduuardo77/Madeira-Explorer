/**
 * Where the film's pen goes, and how fast (T-279).
 *
 * WHY THE PEN IS PACED BY GROUND, NOT BY POINTS
 * ---------------------------------------------
 * The film once advanced one road point per step. A road's points are as
 * dense as its curves, so a hairpin village took seconds and a straight
 * expressway or a tunnel went by in a blink, while the camera, paced by
 * distance, drifted away from the pen. Measured on the lead's 12-day trip
 * (`tools/film-check.mjs`): the pen ran between 10 and 60 km of road a second.
 * Here every metre costs the same, so the pen keeps one speed and the camera
 * shares its clock.
 *
 * Two exceptions, both measured on that trip:
 *
 *   - **Road already drawn costs a quarter** (`REPEAT_PACE`). Half the film,
 *     7 of 14 seconds, redrew roads the film had drawn: the way home each
 *     evening, the same coast road twice. A pen retracing a line shows nothing
 *     new, so it hurries.
 *   - **A short hole is filled from the pass that has it** (`bridgeHoles`).
 *     A pass that loses GPS in a tunnel ends its chain at the portal; another
 *     pass along the same road, the other way or another day, often went
 *     through. 42 of the trip's 46 jumps under a kilometre were such holes.
 *     The finished map shows that road lit, so drawing it as the pen passes
 *     is the road the map already shows, not a line nobody proved was taken
 *     (ARCHITECTURE §10). A hole on every pass stays a hole.
 *
 * Pure: no database, no Expo, no clock. Tested in `penPath.test.ts`.
 */

import { distanceM } from '../recording/distance.ts';

export type LatLon = { lat: number; lon: number };

/** A point of the pen's path, with how far it is along and what it cost to reach. */
export type PenPoint = LatLon & {
  /** Ground metres from the film's first point, pen-up jumps included. */
  alongM: number;
  /** The pace clock: metres, repeated road and jumps discounted. */
  cost: number;
};

export type PenPath = {
  strokes: PenPoint[][];
  /** The pace clock at the last point. */
  totalCost: number;
  /** Metres drawn, jumps excluded. */
  drawnM: number;
};

/** How much a metre of road the film has already drawn costs. */
export const REPEAT_PACE = 0.25;
/** Road counts as drawn once the pen is this far past it: a pen is not repeating itself on a bend. */
export const REPEAT_AFTER_M = 300;
/** The grid that says "drawn already", metres: wider than GPS error, narrower than two streets. */
const REPEAT_CELL_M = 40;
/** How finely an edge is sampled against that grid, metres. */
const REPEAT_SAMPLE_M = 20;

/**
 * The longest pen-up jump a pace charges in full, as a share of the drawing.
 * A jump costs its ground distance so the pen seems to keep going, but the
 * hop from one day's last road to the next day's first is not worth seconds.
 */
export const MAX_JUMP_SHARE = 0.025;

/** Holes up to this long are looked for on other passes. */
export const BRIDGE_MAX_M = 1_000;
/** How near another pass must come to both ends of a hole to fill it. */
export const BRIDGE_REACH_M = 60;
/** A filling no longer than this many times the hole: past that it is another road. */
const BRIDGE_DETOUR = 3;

/** Two ends closer than this are the same point: the pen continues. */
const TOUCHING_M = 1;

/**
 * Strokes, with each short hole between consecutive strokes filled by the
 * stretch of another stroke that covers it, inserted between them.
 */
export function bridgeHoles(strokes: readonly LatLon[][]): LatLon[][] {
  const filled: LatLon[][] = [];
  for (let i = 0; i < strokes.length; i += 1) {
    if (i > 0) {
      const from = strokes[i - 1][strokes[i - 1].length - 1];
      const to = strokes[i][0];
      const holeM = distanceM(from, to);
      if (holeM >= TOUCHING_M && holeM <= BRIDGE_MAX_M) {
        const bridge = coveringStretch(strokes, from, to, holeM);
        if (bridge !== null) {
          filled.push(bridge);
        }
      }
    }
    filled.push(strokes[i]);
  }
  return filled;
}

/** The shortest stretch of any stroke running from near `from` to near `to`, or null. */
function coveringStretch(
  strokes: readonly LatLon[][],
  from: LatLon,
  to: LatLon,
  holeM: number
): LatLon[] | null {
  let best: { points: LatLon[]; lengthM: number } | null = null;
  for (const stroke of strokes) {
    const start = nearestOn(stroke, from);
    const end = nearestOn(stroke, to);
    if (start.distanceM > BRIDGE_REACH_M || end.distanceM > BRIDGE_REACH_M) {
      continue;
    }
    const points = stretch(stroke, start, end);
    const lengthM = lengthOf(points);
    if (points.length >= 2 && lengthM <= holeM * BRIDGE_DETOUR && (best === null || lengthM < best.lengthM)) {
      best = { points, lengthM };
    }
  }
  return best?.points ?? null;
}

type OnStroke = { edge: number; t: number; point: LatLon; distanceM: number };

/** The point of `stroke` nearest `target`: on which edge, how far along it, how far off. */
function nearestOn(stroke: readonly LatLon[], target: LatLon): OnStroke {
  const kx = 111_320 * Math.cos((target.lat * Math.PI) / 180);
  const ky = 110_540;
  let best: OnStroke = { edge: 0, t: 0, point: stroke[0], distanceM: Infinity };
  for (let i = 0; i + 1 < stroke.length; i += 1) {
    const ax = (stroke[i].lon - target.lon) * kx;
    const ay = (stroke[i].lat - target.lat) * ky;
    const dx = (stroke[i + 1].lon - stroke[i].lon) * kx;
    const dy = (stroke[i + 1].lat - stroke[i].lat) * ky;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    const off = Math.hypot(ax + t * dx, ay + t * dy);
    if (off < best.distanceM) {
      best = {
        edge: i,
        t,
        point: {
          lat: stroke[i].lat + t * (stroke[i + 1].lat - stroke[i].lat),
          lon: stroke[i].lon + t * (stroke[i + 1].lon - stroke[i].lon),
        },
        distanceM: off,
      };
    }
  }
  return best;
}

/** The stroke between two points on it, in the direction from `start` to `end`. */
function stretch(stroke: readonly LatLon[], start: OnStroke, end: OnStroke): LatLon[] {
  const forward = start.edge + start.t <= end.edge + end.t;
  const [a, b] = forward ? [start, end] : [end, start];
  const points = [a.point, ...stroke.slice(a.edge + 1, b.edge + 1), b.point];
  return forward ? points : points.reverse();
}

function lengthOf(points: readonly LatLon[]): number {
  let metres = 0;
  for (let i = 1; i < points.length; i += 1) metres += distanceM(points[i - 1], points[i]);
  return metres;
}

/**
 * The pen's path through `strokes`, in order, each point given its distance
 * along and its cost on the pace clock.
 */
export function pacePen(strokes: readonly LatLon[][]): PenPath {
  const seen = new Map<string, number>();
  const cell = (point: LatLon): string => {
    const x = Math.round((point.lon * 111_320 * Math.cos((point.lat * Math.PI) / 180)) / REPEAT_CELL_M);
    const y = Math.round((point.lat * 110_540) / REPEAT_CELL_M);
    return `${x},${y}`;
  };
  /** What a metre at `point` costs, the pen having come `alongM`; marks it drawn. */
  const paceAt = (point: LatLon, alongM: number): number => {
    const key = cell(point);
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, alongM);
      return 1;
    }
    return first < alongM - REPEAT_AFTER_M ? REPEAT_PACE : 1;
  };

  // First the drawing, then the jumps, whose cost depends on the drawing's.
  let alongM = 0;
  let drawnM = 0;
  let drawnCost = 0;
  const jumpsM: number[] = [];
  const edges: { metres: number; cost: number }[][] = [];
  strokes.forEach((stroke, index) => {
    if (index > 0) {
      const jumpM = distanceM(strokes[index - 1][strokes[index - 1].length - 1], stroke[0]);
      jumpsM.push(jumpM);
      alongM += jumpM;
    }
    paceAt(stroke[0], alongM);
    const costs: { metres: number; cost: number }[] = [];
    for (let i = 1; i < stroke.length; i += 1) {
      const metres = distanceM(stroke[i - 1], stroke[i]);
      const samples = Math.max(1, Math.ceil(metres / REPEAT_SAMPLE_M));
      let cost = 0;
      for (let s = 1; s <= samples; s += 1) {
        const u = s / samples;
        const at = {
          lat: stroke[i - 1].lat + u * (stroke[i].lat - stroke[i - 1].lat),
          lon: stroke[i - 1].lon + u * (stroke[i].lon - stroke[i - 1].lon),
        };
        cost += (metres / samples) * paceAt(at, alongM + metres * u);
      }
      alongM += metres;
      drawnM += metres;
      drawnCost += cost;
      costs.push({ metres, cost });
    }
    edges.push(costs);
  });

  const jumpCap = MAX_JUMP_SHARE * drawnCost;
  const jumpCost = (metres: number): number => (metres < TOUCHING_M ? 0 : Math.min(metres, jumpCap));

  const out: PenPoint[][] = [];
  let along = 0;
  let cost = 0;
  strokes.forEach((stroke, index) => {
    if (index > 0) {
      along += jumpsM[index - 1];
      cost += jumpCost(jumpsM[index - 1]);
    }
    const points: PenPoint[] = [{ ...stroke[0], alongM: along, cost }];
    for (let i = 1; i < stroke.length; i += 1) {
      along += edges[index][i - 1].metres;
      cost += edges[index][i - 1].cost;
      points.push({ ...stroke[i], alongM: along, cost });
    }
    out.push(points);
  });

  return { strokes: out, totalCost: cost, drawnM };
}
