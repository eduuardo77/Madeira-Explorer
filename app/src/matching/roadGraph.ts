/**
 * The road and path network, decoded for matching (D-093).
 *
 * `content/roads.json` is built by `tools/build-roads.mjs` from OpenStreetMap:
 * every road, path and levada a person can travel, split at junctions into
 * edges. This module turns that file into typed arrays the matcher can search
 * quickly, and answers the one spatial question matching asks: *which edges
 * run within r metres of this fix, and where along each is it closest?*
 *
 * WHY TYPED ARRAYS AND A GRID
 * ---------------------------
 * The island is about 59,000 edges and 6,500 km. Held as objects, that is
 * hundreds of thousands of small allocations and a slow start on a phone.
 * Flat arrays of numbers are one allocation each. The grid (cells of about
 * 100 m) means a query looks at the few dozen segments near a fix rather than
 * all of them; the SQLite R-tree ARCHITECTURE §4 imagined is not needed at
 * this size.
 *
 * Distances are metres on a local flat projection, as everywhere else in the
 * app's geometry: at this latitude and over the lengths compared here the
 * error is far under a metre.
 *
 * Pure: no Expo, no file access. The file is handed in by `roadNetwork.ts`.
 * Tested in `roadGraph.test.ts`.
 */

/** The file `tools/build-roads.mjs` writes. */
export type RoadFile = {
  version: string;
  precision: number;
  nodeCount: number;
  edgeCount: number;
  /** [from0, to0, from1, to1, ...] junction indices. */
  edgeNodes: number[];
  /** One character per edge; see `EdgeKind`. Upper case when a tunnel. */
  edgeKind: string;
  /**
   * One character per edge: `0` either way, `f` only first point to last,
   * `r` only last to first. Motorways and trunk roads only (the build tool
   * says why). Optional so an older file still loads.
   */
  edgeOneway?: string;
  /** One Google encoded polyline per edge, both ends included. */
  edgeGeometry: string[];
  /** Points across all edges, so the decoder allocates once. Optional. */
  pointCount?: number;
};

/**
 * `m` motorway or trunk, `p` primary to tertiary, `r` residential,
 * unclassified or service, `t` track, `f` footway, path, steps or cycleway,
 * `l` levada channel. The build tool says which OSM tags map to which.
 */
export type EdgeKind = 'm' | 'p' | 'r' | 't' | 'f' | 'l' | 'a';

/**
 * The index of each kind in `RoadGraph.kindIndex` and in cost tables: `a` is an
 * aerial lift (a cable car), the island's other way of crossing a valley.
 */
export const KIND_INDEX: Record<EdgeKind, number> = { m: 0, p: 1, r: 2, t: 3, f: 4, l: 5, a: 6 };
export const KIND_COUNT = 7;

export type RoadGraph = {
  version: string;
  nodeCount: number;
  edgeCount: number;
  edgeFrom: Int32Array;
  edgeTo: Int32Array;
  /** Metres from the edge's first point to its last, along it. */
  edgeLength: Float64Array;
  edgeKindCodes: string;
  /**
   * Each edge's kind as a small number, for cost tables indexed by kind
   * (`KIND_INDEX`): cheaper in a search's inner loop than reading a string.
   */
  kindIndex: Uint8Array;
  /** `0`, `f` or `r` per edge; see `RoadFile.edgeOneway`. */
  edgeOneway: string;
  /** Points of edge e are `pointStart[e]` up to, not including, `pointStart[e + 1]`. */
  pointStart: Int32Array;
  lat: Float64Array;
  lon: Float64Array;
  /** Metres along its edge at each point. */
  along: Float64Array;
  /** Edges meeting at each junction: `adjEdge[adjStart[n] .. adjStart[n + 1])`. */
  adjStart: Int32Array;
  adjEdge: Int32Array;
  grid: SegmentGrid;
};

type SegmentGrid = {
  south: number;
  west: number;
  cellDeg: number;
  rows: number;
  cols: number;
  /** Segments in cell c: `cellSegment[cellStart[c] .. cellStart[c + 1])`. */
  cellStart: Int32Array;
  /** A segment is named by the index of its first point. */
  cellSegment: Int32Array;
  /** The edge each point belongs to, so a segment knows its edge. */
  pointEdge: Int32Array;
  /** Per-segment scratch, so a query visits each segment once. */
  visited: Int32Array;
  query: number;
};

/**
 * Grid cell size, in degrees: about 110 m north to south, 94 m east to west
 * here. Near the widest candidate radius the matcher asks for, so a query
 * reads a 3 by 3 block of cells.
 */
export const GRID_CELL_DEG = 0.001;

const METRES_PER_DEG_LAT = 110_540;

function metresPerDegLon(lat: number): number {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

/** Metres between two points, flat-earth. */
export function metresBetween(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const x = (bLon - aLon) * metresPerDegLon((aLat + bLat) / 2);
  const y = (bLat - aLat) * METRES_PER_DEG_LAT;
  return Math.sqrt(x * x + y * y);
}

/**
 * Decode the file and index it, all at once. Tests and tools use this; the app
 * uses `decodeRoadGraphInSteps` so the screen keeps answering while it runs.
 */
export function decodeRoadGraph(file: RoadFile): RoadGraph {
  const steps = decodeRoadGraphInSteps(file);
  for (;;) {
    const next = steps.next();
    if (next.done === true) {
      return next.value;
    }
  }
}

/** The phases of a decode, as `decodeRoadGraphInSteps` names them. */
export type DecodePhase = 'geometry' | 'lengths' | 'junctions' | 'grid';

/**
 * Decode the file and index it, a slice at a time: yields the phase it is in
 * every few thousand edges, and returns the graph at the end.
 *
 * ⚠ **Why in steps (measured 2026-09-27).** On the P30 the first version took
 * 1,241 ms in one go on the JavaScript thread: 1.2 s of a screen that does not
 * answer a tap. Written for Hermes, which interprets rather than compiles: no
 * intermediate arrays, one cosine per edge rather than per point, no function
 * call per grid cell. The caller (`roadNetwork.ts`) runs a slice, lets a frame
 * through, and runs the next.
 */
export function* decodeRoadGraphInSteps(
  file: RoadFile
): Generator<DecodePhase, RoadGraph, void> {
  const edgeCount = file.edgeGeometry.length;
  if (
    file.edgeNodes.length !== edgeCount * 2 ||
    file.edgeKind.length !== edgeCount
  ) {
    throw new Error('roads file is inconsistent: edge arrays differ in length');
  }

  // How many points there are, so the arrays are allocated once. The build
  // tool writes it; an older file is counted: every coordinate pair ends in
  // two characters below 95 (the terminator of Google's encoding).
  let pointCount = file.pointCount ?? -1;
  if (pointCount < 0) {
    let terminators = 0;
    for (let e = 0; e < edgeCount; e += 1) {
      const text = file.edgeGeometry[e];
      for (let i = 0; i < text.length; i += 1) {
        if (text.charCodeAt(i) < 95) {
          terminators += 1;
        }
      }
    }
    pointCount = terminators / 2;
  }

  const lat = new Float64Array(pointCount);
  const lon = new Float64Array(pointCount);
  const pointStart = new Int32Array(edgeCount + 1);
  const precision = file.precision;
  let p = 0;
  for (let e = 0; e < edgeCount; e += 1) {
    pointStart[e] = p;
    const text = file.edgeGeometry[e];
    const length = text.length;
    let index = 0;
    let la = 0;
    let lo = 0;
    while (index < length) {
      let result = 0;
      let factor = 1;
      let byte = 0;
      do {
        byte = text.charCodeAt(index) - 63;
        index += 1;
        result += (byte & 0x1f) * factor;
        factor *= 32;
      } while (byte >= 0x20);
      la += result % 2 === 1 ? -(result + 1) / 2 : result / 2;
      result = 0;
      factor = 1;
      do {
        byte = text.charCodeAt(index) - 63;
        index += 1;
        result += (byte & 0x1f) * factor;
        factor *= 32;
      } while (byte >= 0x20);
      lo += result % 2 === 1 ? -(result + 1) / 2 : result / 2;
      lat[p] = la / precision;
      lon[p] = lo / precision;
      p += 1;
    }
    if ((e & 2047) === 2047) {
      yield 'geometry';
    }
  }
  pointStart[edgeCount] = p;
  if (p !== pointCount) {
    throw new Error(`roads file is inconsistent: ${p} points decoded, ${pointCount} declared`);
  }
  yield 'geometry';

  const along = new Float64Array(pointCount);
  const edgeLength = new Float64Array(edgeCount);
  const pointEdge = new Int32Array(pointCount);
  for (let e = 0; e < edgeCount; e += 1) {
    const first = pointStart[e];
    const end = pointStart[e + 1];
    // One scale per edge: an edge spans metres to a few kilometres, over which
    // the cosine of the latitude does not change in any digit that matters.
    const scaleX = metresPerDegLon(lat[first]);
    let metres = 0;
    pointEdge[first] = e;
    for (let q = first + 1; q < end; q += 1) {
      const x = (lon[q] - lon[q - 1]) * scaleX;
      const y = (lat[q] - lat[q - 1]) * METRES_PER_DEG_LAT;
      metres += Math.sqrt(x * x + y * y);
      along[q] = metres;
      pointEdge[q] = e;
    }
    edgeLength[e] = metres;
    if ((e & 2047) === 2047) {
      yield 'lengths';
    }
  }
  yield 'lengths';

  const nodeCount = file.nodeCount;
  const edgeFrom = new Int32Array(edgeCount);
  const edgeTo = new Int32Array(edgeCount);
  const degree = new Int32Array(nodeCount + 1);
  for (let e = 0; e < edgeCount; e += 1) {
    edgeFrom[e] = file.edgeNodes[2 * e];
    edgeTo[e] = file.edgeNodes[2 * e + 1];
    degree[edgeFrom[e]] += 1;
    if (edgeTo[e] !== edgeFrom[e]) {
      degree[edgeTo[e]] += 1;
    }
  }
  const adjStart = new Int32Array(nodeCount + 1);
  for (let n = 0; n < nodeCount; n += 1) {
    adjStart[n + 1] = adjStart[n] + degree[n];
  }
  const adjEdge = new Int32Array(adjStart[nodeCount]);
  const fill = adjStart.slice(0, nodeCount);
  for (let e = 0; e < edgeCount; e += 1) {
    adjEdge[fill[edgeFrom[e]]++] = e;
    if (edgeTo[e] !== edgeFrom[e]) {
      adjEdge[fill[edgeTo[e]]++] = e;
    }
  }
  yield 'junctions';

  const kindIndex = new Uint8Array(edgeCount);
  for (let e = 0; e < edgeCount; e += 1) {
    const kind = KIND_INDEX[file.edgeKind[e].toLowerCase() as EdgeKind];
    kindIndex[e] = kind === undefined ? KIND_INDEX.r : kind;
  }

  const grid = yield* buildGrid(lat, lon, pointStart, pointEdge);

  return {
    version: file.version,
    nodeCount,
    edgeCount,
    edgeFrom,
    edgeTo,
    edgeLength,
    edgeKindCodes: file.edgeKind,
    kindIndex,
    edgeOneway:
      file.edgeOneway !== undefined && file.edgeOneway.length === edgeCount
        ? file.edgeOneway
        : '0'.repeat(edgeCount),
    pointStart,
    lat,
    lon,
    along,
    adjStart,
    adjEdge,
    grid,
  };
}

function* buildGrid(
  lat: Float64Array,
  lon: Float64Array,
  pointStart: Int32Array,
  pointEdge: Int32Array
): Generator<DecodePhase, SegmentGrid, void> {
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (let p = 0; p < lat.length; p += 1) {
    if (lat[p] < south) south = lat[p];
    if (lat[p] > north) north = lat[p];
    if (lon[p] < west) west = lon[p];
    if (lon[p] > east) east = lon[p];
  }
  if (lat.length === 0) {
    south = north = west = east = 0;
  }
  const cellDeg = GRID_CELL_DEG;
  const rows = Math.floor((north - south) / cellDeg) + 1;
  const cols = Math.floor((east - west) / cellDeg) + 1;
  const cells = rows * cols;
  const edgeCount = pointStart.length - 1;

  // Every segment goes into every cell its bounding box touches. A few long
  // straight segments cover many cells; that is the price of a simple index.
  // Two passes, counting then filling, with the loops written out rather than
  // shared through a callback: a call per cell was most of the cost on Hermes.
  const counts = new Int32Array(cells + 1);
  for (let e = 0; e < edgeCount; e += 1) {
    const last = pointStart[e + 1] - 1;
    for (let p = pointStart[e]; p < last; p += 1) {
      const a = lat[p];
      const b = lat[p + 1];
      const c = lon[p];
      const d = lon[p + 1];
      const r0 = Math.floor(((a < b ? a : b) - south) / cellDeg);
      const r1 = Math.floor(((a < b ? b : a) - south) / cellDeg);
      const c0 = Math.floor(((c < d ? c : d) - west) / cellDeg);
      const c1 = Math.floor(((c < d ? d : c) - west) / cellDeg);
      for (let r = r0; r <= r1; r += 1) {
        for (let col = c0; col <= c1; col += 1) {
          counts[r * cols + col + 1] += 1;
        }
      }
    }
    if ((e & 2047) === 2047) {
      yield 'grid';
    }
  }
  const cellStart = new Int32Array(cells + 1);
  for (let c = 0; c < cells; c += 1) {
    cellStart[c + 1] = cellStart[c] + counts[c + 1];
  }
  const cellSegment = new Int32Array(cellStart[cells]);
  const fill = cellStart.slice(0, cells);
  for (let e = 0; e < edgeCount; e += 1) {
    const last = pointStart[e + 1] - 1;
    for (let p = pointStart[e]; p < last; p += 1) {
      const a = lat[p];
      const b = lat[p + 1];
      const c = lon[p];
      const d = lon[p + 1];
      const r0 = Math.floor(((a < b ? a : b) - south) / cellDeg);
      const r1 = Math.floor(((a < b ? b : a) - south) / cellDeg);
      const c0 = Math.floor(((c < d ? c : d) - west) / cellDeg);
      const c1 = Math.floor(((c < d ? d : c) - west) / cellDeg);
      for (let r = r0; r <= r1; r += 1) {
        for (let col = c0; col <= c1; col += 1) {
          cellSegment[fill[r * cols + col]++] = p;
        }
      }
    }
    if ((e & 2047) === 2047) {
      yield 'grid';
    }
  }
  yield 'grid';

  return {
    south,
    west,
    cellDeg,
    rows,
    cols,
    cellStart,
    cellSegment,
    pointEdge,
    visited: new Int32Array(lat.length),
    query: 0,
  };
}

/** Where a fix falls on one edge. */
export type Candidate = {
  edge: number;
  /** Metres along the edge from its first point. */
  offset: number;
  /** Metres from the fix to that point. */
  distance: number;
  lat: number;
  lon: number;
};

/**
 * The closest point on each edge within `radiusM` of a position, nearest
 * first, at most `limit` of them.
 *
 * ⚠ One candidate per **edge**, not per segment: a winding road passes near a
 * fix several times over, and the matcher wants to know *which road*, then
 * *where on it*.
 */
export function nearbyEdges(
  graph: RoadGraph,
  lat: number,
  lon: number,
  radiusM: number,
  limit: number
): Candidate[] {
  const grid = graph.grid;
  grid.query += 1;
  const stamp = grid.query;

  const scaleX = metresPerDegLon(lat);
  const scaleY = METRES_PER_DEG_LAT;
  const dLat = radiusM / scaleY;
  const dLon = radiusM / scaleX;
  const r0 = Math.max(0, Math.floor((lat - dLat - grid.south) / grid.cellDeg));
  const r1 = Math.min(grid.rows - 1, Math.floor((lat + dLat - grid.south) / grid.cellDeg));
  const c0 = Math.max(0, Math.floor((lon - dLon - grid.west) / grid.cellDeg));
  const c1 = Math.min(grid.cols - 1, Math.floor((lon + dLon - grid.west) / grid.cellDeg));

  const best = new Map<number, Candidate>();
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const cell = r * grid.cols + c;
      for (let i = grid.cellStart[cell]; i < grid.cellStart[cell + 1]; i += 1) {
        const p = grid.cellSegment[i];
        if (grid.visited[p] === stamp) {
          continue;
        }
        grid.visited[p] = stamp;

        // Project onto the segment p → p + 1 in local metres.
        const ax = (graph.lon[p] - lon) * scaleX;
        const ay = (graph.lat[p] - lat) * scaleY;
        const bx = (graph.lon[p + 1] - lon) * scaleX;
        const by = (graph.lat[p + 1] - lat) * scaleY;
        const sx = bx - ax;
        const sy = by - ay;
        const lengthSquared = sx * sx + sy * sy;
        let t = lengthSquared === 0 ? 0 : -(ax * sx + ay * sy) / lengthSquared;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + t * sx;
        const py = ay + t * sy;
        const distance = Math.sqrt(px * px + py * py);
        if (distance > radiusM) {
          continue;
        }

        const edge = grid.pointEdge[p];
        const previous = best.get(edge);
        if (previous !== undefined && previous.distance <= distance) {
          continue;
        }
        const segmentM = graph.along[p + 1] - graph.along[p];
        best.set(edge, {
          edge,
          offset: graph.along[p] + t * segmentM,
          distance,
          lat: graph.lat[p] + t * (graph.lat[p + 1] - graph.lat[p]),
          lon: graph.lon[p] + t * (graph.lon[p + 1] - graph.lon[p]),
        });
      }
    }
  }

  const found = [...best.values()];
  found.sort((a, b) => a.distance - b.distance);
  return found.length > limit ? found.slice(0, limit) : found;
}

/**
 * The stretch of an edge between two offsets, as [lat, lon] points in the
 * direction `from` → `to` (which may run against the edge).
 */
export function edgeSlice(
  graph: RoadGraph,
  edge: number,
  from: number,
  to: number
): [number, number][] {
  const forward = from <= to;
  const low = forward ? from : to;
  const high = forward ? to : from;
  const first = graph.pointStart[edge];
  const last = graph.pointStart[edge + 1] - 1;

  const points: [number, number][] = [pointAt(graph, edge, low)];
  for (let p = first; p <= last; p += 1) {
    if (graph.along[p] > low && graph.along[p] < high) {
      points.push([graph.lat[p], graph.lon[p]]);
    }
  }
  points.push(pointAt(graph, edge, high));
  if (!forward) {
    points.reverse();
  }
  return points;
}

/** The position `offset` metres along an edge. */
export function pointAt(
  graph: RoadGraph,
  edge: number,
  offset: number
): [number, number] {
  const first = graph.pointStart[edge];
  const last = graph.pointStart[edge + 1] - 1;
  if (offset <= 0) {
    return [graph.lat[first], graph.lon[first]];
  }
  for (let p = first + 1; p <= last; p += 1) {
    if (graph.along[p] >= offset) {
      const span = graph.along[p] - graph.along[p - 1];
      const t = span === 0 ? 0 : (offset - graph.along[p - 1]) / span;
      return [
        graph.lat[p - 1] + t * (graph.lat[p] - graph.lat[p - 1]),
        graph.lon[p - 1] + t * (graph.lon[p] - graph.lon[p - 1]),
      ];
    }
  }
  return [graph.lat[last], graph.lon[last]];
}

/** The kind of an edge, ignoring whether it is a tunnel. */
export function edgeKind(graph: RoadGraph, edge: number): EdgeKind {
  return graph.edgeKindCodes[edge].toLowerCase() as EdgeKind;
}

/**
 * Drawn faded rather than at full strength: underground (a tunnel) or
 * overhead (an aerial lift). Neither is a street the map shows, and a bright
 * line over blocks with no street reads as a line in a random place (D-093).
 */
export function isFaded(graph: RoadGraph, edge: number): boolean {
  return isTunnel(graph, edge) || graph.kindIndex[edge] === KIND_INDEX.a;
}

export function isTunnel(graph: RoadGraph, edge: number): boolean {
  const code = graph.edgeKindCodes[edge];
  return code !== code.toLowerCase();
}
