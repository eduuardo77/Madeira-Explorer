/**
 * Distances and routes along the road network (D-093).
 *
 * The matcher asks two things of the network, many times per trip:
 *
 *   1. **How far, along roads, from this point to each of those?** Two fixes
 *      ten seconds apart are 14 m apart as the crow flies. A candidate pair on
 *      the same street is about 14 m apart by road too; a pair that puts the
 *      second fix on the parallel street behind the houses is 200 m apart by
 *      road. That difference is most of how matching tells streets apart.
 *   2. **Which way, exactly?** Once the matcher has chosen, the route between
 *      consecutive fixes is what gets lit, and that is how a drive through a
 *      tunnel, where GPS stops, lights the tunnel (ARCHITECTURE §8.1).
 *
 * Dijkstra, bounded by a distance the caller sets, from a point partway along
 * an edge. Edges are undirected, because a walker ignores one-way signs,
 * **except motorway and trunk carriageways** (`RoadGraph.edgeOneway`): the
 * VR1 is two one-way roads side by side, and without direction a drive lit
 * the opposite carriageway on synthetic trips. Nobody walks there.
 *
 * Pure. Tested in `roadRouting.test.ts`.
 */

import type { RoadGraph } from './roadGraph.ts';

/**
 * How far a fix may seem to move backwards along a one-way carriageway, in
 * metres, before that counts as going the wrong way. GPS error along the road
 * is as large as across it.
 */
export const ONEWAY_JITTER_M = 30;

/** Can this edge be travelled from `node` to its other end? */
function canLeave(graph: RoadGraph, edge: number, node: number): boolean {
  const oneway = graph.edgeOneway.charCodeAt(edge);
  if (oneway === 102 /* f */) {
    return node === graph.edgeFrom[edge];
  }
  if (oneway === 114 /* r */) {
    return node === graph.edgeTo[edge];
  }
  return true;
}

/** Along one edge, from one offset to another, respecting its direction. */
function alongEdge(graph: RoadGraph, edge: number, from: number, to: number): number {
  const oneway = graph.edgeOneway.charCodeAt(edge);
  const backwards = oneway === 102 ? from - to : oneway === 114 ? to - from : 0;
  return backwards > ONEWAY_JITTER_M ? Infinity : Math.abs(to - from);
}

/** A point on the network. */
export type NetworkPoint = { edge: number; offset: number };

/** Part of one edge, travelled from `from` to `to` metres along it. */
export type EdgePiece = { edge: number; from: number; to: number };

/**
 * Reusable search state, so a trip's thousands of searches do not each
 * allocate arrays the size of the island.
 */
export type RouteScratch = {
  dist: Float64Array;
  /** The edge each node was reached by, or -1 at a seed. */
  via: Int32Array;
  /** Which search last wrote this node; anything else reads as unreached. */
  stamp: Int32Array;
  /** Which search is waiting for this node to settle (a target's end). */
  wanted: Int32Array;
  search: number;
  heap: MinHeap;
};

export function createScratch(graph: RoadGraph): RouteScratch {
  return {
    dist: new Float64Array(graph.nodeCount),
    via: new Int32Array(graph.nodeCount),
    stamp: new Int32Array(graph.nodeCount),
    wanted: new Int32Array(graph.nodeCount),
    search: 0,
    heap: new MinHeap(),
  };
}

/**
 * Shortest distances from `source` to each target, along the network, or
 * `Infinity` where no route is within `limitM`.
 */
export function distancesFrom(
  graph: RoadGraph,
  scratch: RouteScratch,
  source: NetworkPoint,
  targets: readonly NetworkPoint[],
  limitM: number
): number[] {
  search(graph, scratch, source, limitM, targets);
  return targets.map((target) => distanceTo(graph, scratch, source, target));
}

/**
 * The route from `source` to `target` as edge pieces in travel order, or null
 * when there is none within `limitM`.
 */
export function routeBetween(
  graph: RoadGraph,
  scratch: RouteScratch,
  source: NetworkPoint,
  target: NetworkPoint,
  limitM: number,
  allowed?: (edge: number) => boolean
): EdgePiece[] | null {
  search(graph, scratch, source, limitM, [target], allowed);
  const through = bestEntry(graph, scratch, target);
  const direct =
    source.edge === target.edge
      ? alongEdge(graph, source.edge, source.offset, target.offset)
      : Infinity;

  if (direct <= through.distance) {
    return direct <= limitM
      ? [{ edge: source.edge, from: source.offset, to: target.offset }]
      : null;
  }
  if (!Number.isFinite(through.distance) || through.distance > limitM) {
    return null;
  }

  // Walk back from the node the target was entered by to a seed.
  const pieces: EdgePiece[] = [];
  const length = graph.edgeLength[target.edge];
  pieces.push({
    edge: target.edge,
    from: through.node === graph.edgeFrom[target.edge] ? 0 : length,
    to: target.offset,
  });
  let node = through.node;
  for (let guard = 0; guard < graph.nodeCount; guard += 1) {
    const edge = scratch.via[node];
    if (edge === -1) {
      break;
    }
    const other = graph.edgeFrom[edge] === node ? graph.edgeTo[edge] : graph.edgeFrom[edge];
    const edgeLength = graph.edgeLength[edge];
    pieces.push({
      edge,
      from: other === graph.edgeFrom[edge] ? 0 : edgeLength,
      to: node === graph.edgeFrom[edge] ? 0 : edgeLength,
    });
    node = other;
  }
  // `node` is now a seed: one end of the source edge.
  pieces.push({
    edge: source.edge,
    from: source.offset,
    to: node === graph.edgeFrom[source.edge] ? 0 : graph.edgeLength[source.edge],
  });
  pieces.reverse();
  return pieces.filter((piece) => piece.from !== piece.to);
}

function distanceTo(
  graph: RoadGraph,
  scratch: RouteScratch,
  source: NetworkPoint,
  target: NetworkPoint
): number {
  const through = bestEntry(graph, scratch, target).distance;
  if (source.edge === target.edge) {
    return Math.min(through, alongEdge(graph, source.edge, source.offset, target.offset));
  }
  return through;
}

/** The cheaper of entering the target's edge from either end. */
function bestEntry(
  graph: RoadGraph,
  scratch: RouteScratch,
  target: NetworkPoint
): { distance: number; node: number } {
  const from = graph.edgeFrom[target.edge];
  const to = graph.edgeTo[target.edge];
  const viaFrom = canLeave(graph, target.edge, from)
    ? reached(scratch, from) + target.offset
    : Infinity;
  const viaTo = canLeave(graph, target.edge, to)
    ? reached(scratch, to) + (graph.edgeLength[target.edge] - target.offset)
    : Infinity;
  return viaFrom <= viaTo ? { distance: viaFrom, node: from } : { distance: viaTo, node: to };
}

function reached(scratch: RouteScratch, node: number): number {
  return scratch.stamp[node] === scratch.search ? scratch.dist[node] : Infinity;
}

/**
 * Dijkstra from a point partway along an edge, stopping once every target's
 * edge ends are settled or the frontier passes `limitM`.
 */
function search(
  graph: RoadGraph,
  scratch: RouteScratch,
  source: NetworkPoint,
  limitM: number,
  targets: readonly NetworkPoint[],
  allowed?: (edge: number) => boolean
): void {
  scratch.search += 1;
  const id = scratch.search;
  const heap = scratch.heap;
  heap.clear();

  // Leaving the source edge towards its first point means travelling it
  // backwards, which a one-way carriageway only allows as GPS jitter.
  // (Written out rather than through a helper closure: this runs thousands of
  // times a trip, and on Hermes a call is most of the cost of a small body.)
  const sourceFrom = graph.edgeFrom[source.edge];
  const sourceTo = graph.edgeTo[source.edge];
  const toFrom = source.offset;
  const toTo = graph.edgeLength[source.edge] - source.offset;
  if (
    toFrom <= limitM &&
    (canLeave(graph, source.edge, sourceTo) || source.offset <= ONEWAY_JITTER_M)
  ) {
    scratch.stamp[sourceFrom] = id;
    scratch.dist[sourceFrom] = toFrom;
    scratch.via[sourceFrom] = -1;
    heap.push(sourceFrom, toFrom);
  }
  if (
    toTo <= limitM &&
    (canLeave(graph, source.edge, sourceFrom) || toTo <= ONEWAY_JITTER_M) &&
    (scratch.stamp[sourceTo] !== id || toTo < scratch.dist[sourceTo])
  ) {
    scratch.stamp[sourceTo] = id;
    scratch.dist[sourceTo] = toTo;
    scratch.via[sourceTo] = -1;
    heap.push(sourceTo, toTo);
  }

  // Settling every target edge's two ends answers every target, so stop there
  // rather than exploring out to the limit. Counted with a stamp per node, not
  // a Set: no allocation and no hashing per search.
  const wanted = scratch.wanted;
  let waiting = 0;
  for (let t = 0; t < targets.length; t += 1) {
    const a = graph.edgeFrom[targets[t].edge];
    const b = graph.edgeTo[targets[t].edge];
    if (wanted[a] !== id) {
      wanted[a] = id;
      waiting += 1;
    }
    if (wanted[b] !== id) {
      wanted[b] = id;
      waiting += 1;
    }
  }

  while (heap.size > 0) {
    const node = heap.peekNode();
    const distance = heap.peekKey();
    heap.pop();
    if (distance > scratch.dist[node]) {
      continue; // a stale entry: the node was reached more cheaply since
    }
    if (wanted[node] === id) {
      wanted[node] = 0;
      waiting -= 1;
      if (waiting === 0) {
        return;
      }
    }
    for (let i = graph.adjStart[node]; i < graph.adjStart[node + 1]; i += 1) {
      const edge = graph.adjEdge[i];
      if (allowed !== undefined && !allowed(edge)) {
        continue; // test harnesses only: the matcher never restricts the network
      }
      if (!canLeave(graph, edge, node)) {
        continue;
      }
      const next = graph.edgeFrom[edge] === node ? graph.edgeTo[edge] : graph.edgeFrom[edge];
      const candidate = distance + graph.edgeLength[edge];
      if (candidate > limitM) {
        continue;
      }
      if (scratch.stamp[next] !== id || candidate < scratch.dist[next]) {
        scratch.stamp[next] = id;
        scratch.dist[next] = candidate;
        scratch.via[next] = edge;
        heap.push(next, candidate);
      }
    }
  }
}

/** A binary min-heap of (node, key), keys compared as numbers. */
export class MinHeap {
  private nodes: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  clear(): void {
    this.nodes.length = 0;
    this.keys.length = 0;
  }

  peekNode(): number {
    return this.nodes[0];
  }

  peekKey(): number {
    return this.keys[0];
  }

  push(node: number, key: number): void {
    const nodes = this.nodes;
    const keys = this.keys;
    let i = nodes.length;
    nodes.push(node);
    keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) {
        break;
      }
      nodes[i] = nodes[parent];
      keys[i] = keys[parent];
      i = parent;
    }
    nodes[i] = node;
    keys[i] = key;
  }

  pop(): void {
    const nodes = this.nodes;
    const keys = this.keys;
    const lastNode = nodes.pop() as number;
    const lastKey = keys.pop() as number;
    const size = nodes.length;
    if (size === 0) {
      return;
    }
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      if (left >= size) {
        break;
      }
      const right = left + 1;
      const child = right < size && keys[right] < keys[left] ? right : left;
      if (keys[child] >= lastKey) {
        break;
      }
      nodes[i] = nodes[child];
      keys[i] = keys[child];
      i = child;
    }
    nodes[i] = lastNode;
    keys[i] = lastKey;
  }
}
