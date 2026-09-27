/**
 * From matched chains to what the map draws (D-093).
 *
 * A trip's chains say which stretches of which edges were travelled, often the
 * same street many times over. The map wants the opposite shape: each
 * travelled stretch once, as few lines as possible, each following the road.
 * Three steps:
 *
 *   1. **Trim spurs.** Where the matcher briefly put a fix a few metres into a
 *      side street and came straight back out, the route has an out-and-back
 *      stub. Drawn, it is a nub sticking off a junction where nobody went.
 *      Stubs shorter than `SPUR_MAX_M` go; a real out-and-back (to a
 *      viewpoint at the end of a lane) is longer than that.
 *   2. **Merge.** Every stretch of an edge travelled, on any chain, becomes a
 *      set of non-overlapping intervals along it.
 *   3. **Stitch.** Stretches that meet end to end at a junction nobody else
 *      travelled through become one line, so a drive round the island is a
 *      few dozen polylines, not a few thousand.
 *
 * The output is also the trip's record of *where you have been*, by edge,
 * which is what a future "streets walked" count reads (WalkNYC's blocks).
 *
 * Pure. Tested in `visitedRoads.test.ts`.
 */

import type { MatchedChain } from './mapMatch.ts';
import { edgeSlice, isFaded } from './roadGraph.ts';
import type { RoadGraph } from './roadGraph.ts';
import type { EdgePiece } from './roadRouting.ts';

/**
 * An out-and-back shorter than this is a matching artefact, metres.
 *
 * ⚠ NOT TUNED. A fix 10 m past a corner, matched a few metres into the side
 * street, makes a stub about that long; 20 m is under a house front.
 */
export const SPUR_MAX_M = 20;

/** Intervals closer than this along one edge are one, metres. */
const JOIN_GAP_M = 1;

/**
 * Offsets this close are the same place, metres. ⚠ Not exact equality: chains
 * kept in `matched_chain` come back rounded to the centimetre, and an edge
 * 100.009 m long then ended at 100.01, so a stub no longer looked as if it
 * started at a junction and survived the trim after every restart
 * (`chainStore.test.ts` found it).
 */
const SAME_M = 0.02;

const same = (a: number, b: number): boolean => Math.abs(a - b) <= SAME_M;

/** Travelled stretches of one edge, sorted, non-overlapping, in metres. */
export type Visited = Map<number, [number, number][]>;

/**
 * Remove short out-and-back stubs from a chain's route.
 *
 * A stub is a pair of consecutive pieces on one edge that go in and come back
 * out through the same end. Repeats until none is left, because removing one
 * can expose another (a stub off a stub).
 */
export function trimSpurs(graph: RoadGraph, pieces: readonly EdgePiece[]): EdgePiece[] {
  let out = pieces.map((piece) => ({ ...piece }));
  let changed = true;
  while (changed) {
    changed = false;
    const next: EdgePiece[] = [];
    for (let i = 0; i < out.length; i += 1) {
      const a = out[i];
      const b = out[i + 1];
      if (b !== undefined && a.edge === b.edge && same(a.to, b.from)) {
        const aForward = a.to >= a.from;
        const bForward = b.to >= b.from;
        if (aForward !== bForward) {
          const length = graph.edgeLength[a.edge];
          const depth = Math.abs(a.to - a.from) < Math.abs(b.to - b.from)
            ? Math.abs(a.to - a.from)
            : Math.abs(b.to - b.from);
          const entersFromEnd = same(a.from, 0) || same(a.from, length);
          if (depth < SPUR_MAX_M && entersFromEnd && same(b.to, a.from)) {
            // In and straight back out through the same junction.
            i += 1;
            changed = true;
            continue;
          }
        }
      }
      next.push(a);
    }
    out = mergeRuns(next);
  }

  // Short stubs at either end of the chain: the first or last fix matched a
  // few metres into an edge the chain then left at once.
  if (out.length > 1 && isStub(graph, out[0], 'end')) {
    out = out.slice(1);
  }
  if (out.length > 1 && isStub(graph, out[out.length - 1], 'start')) {
    out = out.slice(0, -1);
  }
  return out;
}

/** A short piece touching a junction only at the end that joins the chain. */
function isStub(graph: RoadGraph, piece: EdgePiece, joined: 'start' | 'end'): boolean {
  if (Math.abs(piece.to - piece.from) >= SPUR_MAX_M) {
    return false;
  }
  const length = graph.edgeLength[piece.edge];
  const at = joined === 'end' ? piece.to : piece.from;
  const other = joined === 'end' ? piece.from : piece.to;
  const atJunction = same(at, 0) || same(at, length);
  const otherJunction = same(other, 0) || same(other, length);
  return atJunction && !otherJunction;
}

/** Merge consecutive pieces continuing along one edge in one direction. */
function mergeRuns(pieces: EdgePiece[]): EdgePiece[] {
  const out: EdgePiece[] = [];
  for (const piece of pieces) {
    const last = out[out.length - 1];
    if (
      last !== undefined &&
      last.edge === piece.edge &&
      same(last.to, piece.from) &&
      last.to >= last.from === piece.to >= piece.from
    ) {
      last.to = piece.to;
    } else {
      out.push({ ...piece });
    }
  }
  return out;
}

/** Every stretch travelled, across all chains, merged per edge. */
export function visitedEdges(graph: RoadGraph, chains: readonly MatchedChain[]): Visited {
  const raw = new Map<number, [number, number][]>();
  for (const chain of chains) {
    for (const piece of trimSpurs(graph, chain.pieces)) {
      const low = Math.min(piece.from, piece.to);
      const high = Math.max(piece.from, piece.to);
      if (high - low <= 0) {
        continue;
      }
      const list = raw.get(piece.edge);
      if (list === undefined) {
        raw.set(piece.edge, [[low, high]]);
      } else {
        list.push([low, high]);
      }
    }
  }

  const visited: Visited = new Map();
  for (const [edge, intervals] of raw) {
    intervals.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [low, high] of intervals) {
      const last = merged[merged.length - 1];
      if (last !== undefined && low <= last[1] + JOIN_GAP_M) {
        last[1] = Math.max(last[1], high);
      } else {
        merged.push([low, high]);
      }
    }
    visited.set(edge, merged);
  }
  return visited;
}

/**
 * A line to draw, and whether it is drawn faded: underground (a tunnel) or
 * overhead (a cable car, since D-094).
 *
 * ⚠ **Tunnels are their own lines (seen on the P30, 2026-09-27).** Drawn like
 * the rest, a drive through Funchal's tunnels was a bright straight stroke
 * over blocks where Google's map shows no street, which reads as exactly the
 * *"lines in random places"* this work exists to remove. Google draws tunnels
 * faded; the map does the same (`traceStyle.ts`), and says the true thing:
 * you went through there, underneath.
 */
export type VisitedLine = { points: [number, number][]; faded: boolean };

/** Total length travelled, counting each stretch once, metres. */
export function visitedLengthM(visited: Visited): number {
  let metres = 0;
  for (const intervals of visited.values()) {
    for (const [low, high] of intervals) {
      metres += high - low;
    }
  }
  return metres;
}

/**
 * The travelled network as lines to draw: [lat, lon] points, each line
 * following the roads.
 */
export function visitedLines(graph: RoadGraph, visited: Visited): VisitedLine[] {
  // Each interval is a piece; a piece whose end sits on a junction can join
  // another piece ending at the same junction.
  type Piece = { edge: number; low: number; high: number; lowNode: number; highNode: number };
  const pieces: Piece[] = [];
  const ends = new Map<number, number[]>();
  const touch = (node: number, piece: number) => {
    if (node < 0) {
      return;
    }
    const list = ends.get(node);
    if (list === undefined) {
      ends.set(node, [piece]);
    } else {
      list.push(piece);
    }
  };

  for (const [edge, intervals] of visited) {
    const length = graph.edgeLength[edge];
    for (const [rawLow, rawHigh] of intervals) {
      const index = pieces.length;
      // Within a metre of a junction is at it: snapped exactly, so two lines
      // meeting there share a point rather than stopping a centimetre apart.
      const lowNode = rawLow <= JOIN_GAP_M ? graph.edgeFrom[edge] : -1;
      const highNode = rawHigh >= length - JOIN_GAP_M ? graph.edgeTo[edge] : -1;
      const low = lowNode >= 0 ? 0 : rawLow;
      const high = highNode >= 0 ? length : rawHigh;
      pieces.push({ edge, low, high, lowNode, highNode });
      touch(lowNode, index);
      touch(highNode, index);
    }
  }

  // Pieces join only through a junction exactly two of them touch, and only
  // when both are underground or neither is; where three or more lit roads
  // meet, each line simply ends there.
  const partner = (node: number, piece: number): number => {
    const list = ends.get(node);
    if (list === undefined || list.length !== 2) {
      return -1;
    }
    const other = list[0] === piece ? list[1] : list[0];
    // A loop edge touching the same junction twice is not a join.
    if (other === piece) {
      return -1;
    }
    return isFaded(graph, pieces[other].edge) === isFaded(graph, pieces[piece].edge) ? other : -1;
  };

  const used = new Uint8Array(pieces.length);
  const lines: VisitedLine[] = [];

  /** Follow joins from `start`, travelling it low to high when `forward`. */
  const walk = (start: number, startForward: boolean): VisitedLine => {
    const points: [number, number][] = [];
    const faded = isFaded(graph, pieces[start].edge);
    let piece = start;
    let forward = startForward;
    for (;;) {
      used[piece] = 1;
      const p = pieces[piece];
      appendPoints(
        points,
        forward ? edgeSlice(graph, p.edge, p.low, p.high) : edgeSlice(graph, p.edge, p.high, p.low)
      );
      const exit = forward ? p.highNode : p.lowNode;
      if (exit < 0) {
        return { points, faded };
      }
      const next = partner(exit, piece);
      if (next < 0 || used[next] === 1) {
        return { points, faded };
      }
      piece = next;
      // Enter the next piece through the junction just left.
      forward = pieces[next].lowNode === exit;
    }
  };

  // Start from pieces at a line's natural end, so each line is walked whole.
  for (let i = 0; i < pieces.length; i += 1) {
    if (used[i] === 1) {
      continue;
    }
    const p = pieces[i];
    const lowOpen = p.lowNode < 0 || partner(p.lowNode, i) < 0;
    const highOpen = p.highNode < 0 || partner(p.highNode, i) < 0;
    if (lowOpen) {
      lines.push(walk(i, true));
    } else if (highOpen) {
      lines.push(walk(i, false));
    }
  }
  // Whatever is left is closed loops: start anywhere.
  for (let i = 0; i < pieces.length; i += 1) {
    if (used[i] === 0) {
      lines.push(walk(i, true));
    }
  }
  return lines.filter((line) => line.points.length >= 2);
}

/** Append, dropping the first point when it repeats the last. */
function appendPoints(points: [number, number][], more: [number, number][]): void {
  for (let i = 0; i < more.length; i += 1) {
    const last = points[points.length - 1];
    if (i === 0 && last !== undefined && last[0] === more[0][0] && last[1] === more[0][1]) {
      continue;
    }
    points.push(more[i]);
  }
}
