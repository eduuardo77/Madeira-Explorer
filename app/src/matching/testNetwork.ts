/**
 * Small hand-drawn road networks for the matching tests (D-093).
 *
 * ⚠ **Only tests import this.** It lives beside them rather than in a test
 * file so that several test files can share one way of drawing a network.
 *
 * Networks are drawn in metres east and north of a point in Funchal, which is
 * easier to reason about in a test than degrees, and converted here.
 */

import { decodeRoadGraph } from './roadGraph.ts';
import type { RoadFile, RoadGraph } from './roadGraph.ts';

export const ORIGIN = { lat: 32.65, lon: -16.91 };

const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

/** [lat, lon] of a point `east`, `north` metres from the origin. */
export function at(east: number, north: number): [number, number] {
  return [ORIGIN.lat + north / M_PER_DEG_LAT, ORIGIN.lon + east / M_PER_DEG_LON];
}

/** Google's encoded polyline at 1e-6, as `tools/build-roads.mjs` writes it. */
export function encode(points: [number, number][]): string {
  let out = '';
  let lastLat = 0;
  let lastLon = 0;
  for (const [lat, lon] of points) {
    const la = Math.round(lat * 1e6);
    const lo = Math.round(lon * 1e6);
    out += encodeNumber(la - lastLat) + encodeNumber(lo - lastLon);
    lastLat = la;
    lastLon = lo;
  }
  return out;
}

function encodeNumber(value: number): string {
  let v = value < 0 ? ~(value * 2) : value * 2;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v = Math.floor(v / 32);
  }
  return out + String.fromCharCode(v + 63);
}

export type DrawnEdge = {
  from: string;
  to: string;
  /** `r` unless said otherwise; upper case for a tunnel. */
  kind?: string;
  oneway?: '0' | 'f' | 'r';
  /** Bends between the two junctions, in metres east and north. */
  via?: [number, number][];
};

export type TestNetwork = {
  graph: RoadGraph;
  file: RoadFile;
  /** The edge drawn from `a` to `b` (in either direction). */
  edge: (a: string, b: string) => number;
};

/** A network from named junctions (metres east, north) and edges between them. */
export function network(
  junctions: Record<string, [number, number]>,
  edges: DrawnEdge[]
): TestNetwork {
  const names = Object.keys(junctions);
  const index = new Map(names.map((name, i) => [name, i]));
  const edgeNodes: number[] = [];
  let edgeKind = '';
  let edgeOneway = '';
  const edgeGeometry: string[] = [];
  for (const edge of edges) {
    const points = [
      junctions[edge.from],
      ...(edge.via ?? []),
      junctions[edge.to],
    ].map(([east, north]) => at(east, north));
    edgeNodes.push(index.get(edge.from) as number, index.get(edge.to) as number);
    edgeKind += edge.kind ?? 'r';
    edgeOneway += edge.oneway ?? '0';
    edgeGeometry.push(encode(points));
  }
  const file: RoadFile = {
    version: 'test',
    precision: 1e6,
    nodeCount: names.length,
    edgeCount: edges.length,
    edgeNodes,
    edgeKind,
    edgeOneway,
    edgeGeometry,
  };
  const graph = decodeRoadGraph(file);
  return {
    graph,
    file,
    edge: (a, b) => {
      const found = edges.findIndex(
        (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a)
      );
      if (found === -1) {
        throw new Error(`no edge ${a}-${b}`);
      }
      return found;
    },
  };
}

/**
 * A square grid of streets, `blocks` by `blocks`, `blockM` apart. Junctions
 * are named `x,y` from 0.
 */
export function grid(blocks: number, blockM: number): TestNetwork {
  const junctions: Record<string, [number, number]> = {};
  const edges: DrawnEdge[] = [];
  for (let x = 0; x <= blocks; x += 1) {
    for (let y = 0; y <= blocks; y += 1) {
      junctions[`${x},${y}`] = [x * blockM, y * blockM];
      if (x > 0) edges.push({ from: `${x - 1},${y}`, to: `${x},${y}` });
      if (y > 0) edges.push({ from: `${x},${y - 1}`, to: `${x},${y}` });
    }
  }
  return network(junctions, edges);
}

/**
 * A fix `east`, `north` metres from the origin, at `seconds`.
 *
 * The default speed is a walk that differs in the last digits from fix to fix,
 * as a measured one does: an exact repeat reads as a copy
 * (`recording/staleSpeed.ts`).
 */
export function fixAt(
  seconds: number,
  east: number,
  north: number,
  speed: number | null = 1.4 + seconds * 1e-6,
  accuracy: number | null = 5
) {
  const [lat, lon] = at(east, north);
  return { ts: 1_800_000_000_000 + seconds * 1000, lat, lon, accuracy_m: accuracy, speed_mps: speed };
}

/** Metres travelled on the given edges in a visited map. */
export function litOn(
  visited: Map<number, [number, number][]>,
  edges: number[]
): number {
  let metres = 0;
  for (const edge of edges) {
    for (const [low, high] of visited.get(edge) ?? []) {
      metres += high - low;
    }
  }
  return metres;
}

/** Metres lit anywhere. */
export function litTotal(visited: Map<number, [number, number][]>): number {
  let metres = 0;
  for (const intervals of visited.values()) {
    for (const [low, high] of intervals) {
      metres += high - low;
    }
  }
  return metres;
}
