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

/**
 * What a metre of each kind of edge costs, indexed by `KIND_INDEX` (D-094), or
 * null for a metre everywhere. Only the matcher uses it, to make a footway dear
 * for a car and the VR1 dear on foot without forbidding either.
 */
export type KindCosts = Float64Array | null;

/** A point on the network. */
export type NetworkPoint = { edge: number; offset: number };

/** Part of one edge, travelled from `from` to `to` metres along it. */
export type EdgePiece = { edge: number; from: number; to: number };

/**
 * Reusable search state, so a trip's thousands of searches do not each
 * allocate arrays the size of the island.
 */
export type RouteScratch = {
  /** What reaching each node cost (metres times the kind's cost). */
  dist: Float64Array;
  /**
   * How many real metres the cheapest way to each node is. The search is
   * ordered by cost but bounded by metres: a dear road must stay possible,
   * only less likely, or a wrong activity label deletes a journey (D-094).
   */
  len: Float64Array;
  /** The edge each node was reached by, or -1 at a seed. */
  via: Int32Array;
  /** Which search last wrote this node; anything else reads as unreached. */
  stamp: Int32Array;
  /** Which search is waiting for this node to settle (a target's end). */
  wanted: Int32Array;
  search: number;
  heap: MinHeap;
  /** The costs of the last search, read by the functions that finish it. */
  costs: KindCosts;
  /** Real metres to each target of the last `distancesFrom`, beside its costs. */
  lengths: number[];
};

export function createScratch(graph: RoadGraph): RouteScratch {
  return {
    dist: new Float64Array(graph.nodeCount),
    len: new Float64Array(graph.nodeCount),
    via: new Int32Array(graph.nodeCount),
    stamp: new Int32Array(graph.nodeCount),
    wanted: new Int32Array(graph.nodeCount),
    search: 0,
    heap: new MinHeap(),
    costs: null,
    lengths: [],
  };
}

/**
 * Shortest distances from `source` to each target, along the network, or
 * `Infinity` where no route is within `limitM` real metres.
 *
 * With `costs`, the answer is the **cost** of the cheapest route (metres times
 * the cost of each edge's kind), and `scratch.lengths` holds its real length
 * beside it. Without, both are metres.
 */
export function distancesFrom(
  graph: RoadGraph,
  scratch: RouteScratch,
  source: NetworkPoint,
  targets: readonly NetworkPoint[],
  limitM: number,
  costs: KindCosts = null
): number[] {
  search(graph, scratch, source, limitM, targets, undefined, costs);
  const out: number[] = new Array(targets.length);
  scratch.lengths = new Array(targets.length);
  for (let t = 0; t < targets.length; t += 1) {
    const entry = distanceTo(graph, scratch, source, targets[t]);
    const within = entry.length <= limitM;
    out[t] = within ? entry.cost : Infinity;
    scratch.lengths[t] = within ? entry.length : Infinity;
  }
  return out;
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
  allowed?: (edge: number) => boolean,
  costs: KindCosts = null
): EdgePiece[] | null {
  search(graph, scratch, source, limitM, [target], allowed, costs);
  const through = bestEntry(graph, scratch, target);
  const directLength =
    source.edge === target.edge
      ? alongEdge(graph, source.edge, source.offset, target.offset)
      : Infinity;
  const direct = directLength * costOf(scratch, graph, source.edge);

  if (direct <= through.distance) {
    return directLength <= limitM
      ? [{ edge: source.edge, from: source.offset, to: target.offset }]
      : null;
  }
  if (!Number.isFinite(through.distance) || through.length > limitM) {
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
): { cost: number; length: number } {
  const through = bestEntry(graph, scratch, target);
  if (source.edge === target.edge) {
    const length = alongEdge(graph, source.edge, source.offset, target.offset);
    const cost = length * costOf(scratch, graph, source.edge);
    if (cost <= through.distance) {
      return { cost, length };
    }
  }
  return { cost: through.distance, length: through.length };
}

/** What a metre of this edge costs in the current search. */
function costOf(scratch: RouteScratch, graph: RoadGraph, edge: number): number {
  return scratch.costs === null ? 1 : scratch.costs[graph.kindIndex[edge]];
}

/** The cheaper of entering the target's edge from either end. */
function bestEntry(
  graph: RoadGraph,
  scratch: RouteScratch,
  target: NetworkPoint
): { distance: number; length: number; node: number } {
  const from = graph.edgeFrom[target.edge];
  const to = graph.edgeTo[target.edge];
  const cost = costOf(scratch, graph, target.edge);
  const tail = graph.edgeLength[target.edge] - target.offset;
  const viaFrom = canLeave(graph, target.edge, from)
    ? reached(scratch, from) + target.offset * cost
    : Infinity;
  const viaTo = canLeave(graph, target.edge, to)
    ? reached(scratch, to) + tail * cost
    : Infinity;
  return viaFrom <= viaTo
    ? { distance: viaFrom, length: lengthTo(scratch, from) + target.offset, node: from }
    : { distance: viaTo, length: lengthTo(scratch, to) + tail, node: to };
}

function lengthTo(scratch: RouteScratch, node: number): number {
  return scratch.stamp[node] === scratch.search ? scratch.len[node] : Infinity;
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
  allowed?: (edge: number) => boolean,
  costs: KindCosts = null
): void {
  scratch.search += 1;
  scratch.costs = costs;
  const id = scratch.search;
  const heap = scratch.heap;
  heap.clear();
  const kindIndex = graph.kindIndex;

  // Leaving the source edge towards its first point means travelling it
  // backwards, which a one-way carriageway only allows as GPS jitter.
  // (Written out rather than through a helper closure: this runs thousands of
  // times a trip, and on Hermes a call is most of the cost of a small body.)
  const sourceFrom = graph.edgeFrom[source.edge];
  const sourceTo = graph.edgeTo[source.edge];
  const sourceCost = costs === null ? 1 : costs[kindIndex[source.edge]];
  const lenFrom = source.offset;
  const lenTo = graph.edgeLength[source.edge] - source.offset;
  const toFrom = lenFrom * sourceCost;
  const toTo = lenTo * sourceCost;
  if (
    lenFrom <= limitM &&
    (canLeave(graph, source.edge, sourceTo) || source.offset <= ONEWAY_JITTER_M)
  ) {
    scratch.stamp[sourceFrom] = id;
    scratch.dist[sourceFrom] = toFrom;
    scratch.len[sourceFrom] = lenFrom;
    scratch.via[sourceFrom] = -1;
    heap.push(sourceFrom, toFrom);
  }
  if (
    lenTo <= limitM &&
    (canLeave(graph, source.edge, sourceFrom) || lenTo <= ONEWAY_JITTER_M) &&
    (scratch.stamp[sourceTo] !== id || toTo < scratch.dist[sourceTo])
  ) {
    scratch.stamp[sourceTo] = id;
    scratch.dist[sourceTo] = toTo;
    scratch.len[sourceTo] = lenTo;
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
      const edgeLength = graph.edgeLength[edge];
      // Bounded by real metres, ordered by cost: see `RouteScratch.len`.
      const length = scratch.len[node] + edgeLength;
      if (length > limitM) {
        continue;
      }
      const candidate = distance + edgeLength * (costs === null ? 1 : costs[kindIndex[edge]]);
      if (scratch.stamp[next] !== id || candidate < scratch.dist[next]) {
        scratch.stamp[next] = id;
        scratch.dist[next] = candidate;
        scratch.len[next] = length;
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
