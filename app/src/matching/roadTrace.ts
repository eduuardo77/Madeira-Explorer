/**
 * Matched roads as timed lines, and the privacy clip every export needs (D-093).
 *
 * TIMED LINES
 * -----------
 * The replay film (`souvenir/composition.ts`) paces its drawing by time: a
 * stamp lands when the line reaches it. Matched chains carry the time of each
 * matched fix as a distance along the route (`MatchedChain.anchors`), so any
 * point on the route gets its time by interpolating between the anchors either
 * side of it. Between two fixes that is a guess of steady speed, which is what
 * the film already assumed between fixes.
 *
 * THE CLIP, AND WHY IT IS GEOMETRIC
 * ---------------------------------
 * Exports hide everything within `MASK_RADIUS_M` of where the user slept
 * (D-016, D-040) by removing those fixes before anything is drawn. That was
 * enough while the drawing was fixes joined by straight lines (almost: a short
 * gap drew a chord across the circle). **It is not enough for matched roads:**
 * the matcher bridges a gap along the network, so the fixes before and after
 * the circle would be joined by the actual streets inside it, down to the one
 * the user sleeps on. So every exported line is cut where it crosses the
 * circle, exactly, and nothing inside it survives, whatever produced it.
 *
 * Pure. Tested in `roadTrace.test.ts`.
 */

import type { MatchedChain } from './mapMatch.ts';
import { edgeSlice } from './roadGraph.ts';
import type { RoadGraph } from './roadGraph.ts';

export type TimedPoint = { lat: number; lon: number; ts: number };

/** A chain's route as points, each with the time it was reached. */
export function chainTimedPath(graph: RoadGraph, chain: MatchedChain): TimedPoint[] {
  const points: TimedPoint[] = [];
  const anchors = chain.anchors;
  let atM = 0;
  let anchor = 0;

  const timeAt = (metres: number): number => {
    while (anchor < anchors.length - 2 && anchors[anchor + 1].atM < metres) {
      anchor += 1;
    }
    const a = anchors[anchor];
    const b = anchors[Math.min(anchor + 1, anchors.length - 1)];
    if (b.atM <= a.atM) {
      return metres <= a.atM ? a.ts : b.ts;
    }
    const t = Math.max(0, Math.min(1, (metres - a.atM) / (b.atM - a.atM)));
    return a.ts + t * (b.ts - a.ts);
  };

  for (const piece of chain.pieces) {
    const slice = edgeSlice(graph, piece.edge, piece.from, piece.to);
    for (let i = 0; i < slice.length; i += 1) {
      if (i > 0) {
        atM += metres(slice[i - 1], slice[i]);
      }
      const [lat, lon] = slice[i];
      const last = points[points.length - 1];
      if (last !== undefined && last.lat === lat && last.lon === lon) {
        continue;
      }
      points.push({ lat, lon, ts: timeAt(atM) });
    }
  }
  return points;
}

function metres(a: [number, number], b: [number, number]): number {
  const x = (b[1] - a[1]) * 111_320 * Math.cos((a[0] * Math.PI) / 180);
  const y = (b[0] - a[0]) * 110_540;
  return Math.sqrt(x * x + y * y);
}

/**
 * The parts of a line outside a circle, as separate lines. Crossing points
 * are placed exactly on the circle, with their time interpolated.
 */
export function clipOutsideCircle(
  line: readonly TimedPoint[],
  centre: { lat: number; lon: number },
  radiusM: number
): TimedPoint[][] {
  const scaleX = 111_320 * Math.cos((centre.lat * Math.PI) / 180);
  const scaleY = 110_540;
  const toXY = (p: TimedPoint): [number, number] => [
    (p.lon - centre.lon) * scaleX,
    (p.lat - centre.lat) * scaleY,
  ];
  const inside = (p: TimedPoint): boolean => {
    const [x, y] = toXY(p);
    return x * x + y * y <= radiusM * radiusM;
  };
  const at = (a: TimedPoint, b: TimedPoint, t: number): TimedPoint => ({
    lat: a.lat + t * (b.lat - a.lat),
    lon: a.lon + t * (b.lon - a.lon),
    ts: a.ts + t * (b.ts - a.ts),
  });

  const out: TimedPoint[][] = [];
  let current: TimedPoint[] = [];
  const flush = () => {
    if (current.length >= 2) {
      out.push(current);
    }
    current = [];
  };

  for (let i = 0; i < line.length; i += 1) {
    const p = line[i];
    if (i === 0) {
      if (!inside(p)) {
        current.push(p);
      }
      continue;
    }
    const a = line[i - 1];
    // Where along a → b the segment meets the circle: |a + t(b - a)| = r.
    const [ax, ay] = toXY(a);
    const [bx, by] = toXY(p);
    const dx = bx - ax;
    const dy = by - ay;
    const qa = dx * dx + dy * dy;
    const qb = 2 * (ax * dx + ay * dy);
    const qc = ax * ax + ay * ay - radiusM * radiusM;
    const disc = qb * qb - 4 * qa * qc;
    const crossings: number[] = [];
    if (qa > 0 && disc > 0) {
      const root = Math.sqrt(disc);
      for (const t of [(-qb - root) / (2 * qa), (-qb + root) / (2 * qa)]) {
        if (t > 0 && t < 1) {
          crossings.push(t);
        }
      }
    }

    let wasInside = inside(a);
    for (const t of crossings) {
      const cross = at(a, p, t);
      if (wasInside) {
        current.push(cross); // leaving the circle: a new line starts here
      } else {
        current.push(cross); // entering it: this line ends here
        flush();
      }
      wasInside = !wasInside;
    }
    if (!inside(p)) {
      current.push(p);
    }
  }
  flush();
  return out;
}
