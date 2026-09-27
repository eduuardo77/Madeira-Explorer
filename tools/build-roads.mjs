/**
 * Build the road and path network the map lights up: `content/roads.json` (D-093).
 *
 *     node tools/build-roads.mjs
 *     node tools/build-roads.mjs --bbox 38.85,-9.45,38.97,-9.30 --out <file>   # elsewhere, for fieldwork
 *
 * WHAT IT IS FOR
 * --------------
 * Since D-093 the map does not draw the phone's GPS positions. It draws the
 * roads and paths the user travelled, in the road's own shape, so the line sits
 * on the street Google's map shows (WalkNYC's model). The phone matches its
 * fixes against this network, offline, and nothing about a trace leaves it.
 * The network is Madeira knowledge, so it lives in `content/` (D-017).
 *
 * WHAT IS IN IT, AND WHAT IS LEFT OUT ON PURPOSE
 * ----------------------------------------------
 * Every way a person can walk or drive: roads of every class, service roads,
 * tracks, footways, paths, steps, cycleways, and the levada channels (a levada
 * is often mapped as the channel alone, and those are the island's signature
 * walks: D-029, `docs/osm-coverage.md`). Tunnels are kept: they are how a
 * drive through the VR1 lights up at all, because GPS stops inside them.
 *
 *   - **Sidewalks and crossings are left out** (`footway=sidewalk|crossing`).
 *     Funchal maps many pavements as separate ways a few metres from the road.
 *     Kept, a walk along a street would light the pavement, which Google does
 *     not draw, instead of the street, which it does.
 *   - **Parking aisles and driveways are left out.** Driving into a car park
 *     would draw its aisles as a scribble, and a driveway is where a phone at
 *     rest drifts.
 *   - **Areas** (`area=yes`, a square drawn as its outline) are left out: the
 *     outline is not a way anybody walked.
 *   - Private service roads, construction, proposed roads, platforms, indoor
 *     corridors, lifts and raceways are left out.
 *   - Levada channels inside tunnels are left out: a water tunnel with no path
 *     is not walkable, and a route through one would bridge a GPS gap along a
 *     line nobody can take. A levada path in a tunnel is a `highway` and stays.
 *
 * THE FORMAT
 * ----------
 * A graph: ways are split at every node two ways share, so each edge runs from
 * one junction to the next. Flat arrays, because Hermes parses those far
 * faster than an array of small objects:
 *
 *   edgeNodes     [from0, to0, from1, to1, ...]  junction indices
 *   edgeKind      one character per edge, `m` motorway or trunk, `p` primary
 *                 to tertiary, `r` residential, unclassified or service,
 *                 `t` track, `f` footway, path, steps, cycleway, `l` levada
 *                 channel, `a` aerial lift (a cable car). Upper case when the
 *                 edge is a tunnel.
 *   edgeGeometry  one Google encoded polyline per edge, both ends included
 *   edgeOneway    one character per edge: `0` either way, `f` only from the
 *                 edge's first point to its last, `r` only the other way.
 *                 **Set for motorways and trunk roads only** (kinds `m`/`M`):
 *                 the VR1 is two one-way carriageways 15 to 30 m apart, and
 *                 without direction a drive lights the opposite one. Nobody
 *                 walks on them, so enforcing it costs nothing; a one-way
 *                 street in Funchal is walked both ways, so it is not marked.
 *
 * Geometry is simplified by 1 m (`SIMPLIFY_M`) and stored at 1e-6 degrees, so
 * what is drawn is the mapped road to well under a pixel at street zoom.
 *
 * ⚠ **Build-time only**, and reproducible: it reads the dated extract on disk,
 * never the network. OSM data, so the output is ODbL and the app must say
 * *© OpenStreetMap contributors* (the licences screen does).
 */

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPbf } from './lib/osmpbf.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const PBF = path.join(root, 'tiles/src/portugal-latest.osm.pbf');

/** Madeira, Porto Santo and the Desertas, the app's bounds (D-021). */
const ARCHIPELAGO = { south: 32.4, west: -17.32, north: 33.2, east: -16.2 };

/** Douglas-Peucker tolerance, in metres. Under a pixel at street zoom. */
const SIMPLIFY_M = 1;

/** Stored coordinate precision: 1e-6 degrees, about 0.1 m. */
const PRECISION = 1e6;

const KIND = {
  motorway: 'm', motorway_link: 'm', trunk: 'm', trunk_link: 'm',
  primary: 'p', primary_link: 'p', secondary: 'p', secondary_link: 'p',
  tertiary: 'p', tertiary_link: 'p',
  unclassified: 'r', residential: 'r', living_street: 'r', road: 'r', service: 'r',
  track: 't',
  pedestrian: 'f', footway: 'f', path: 'f', steps: 'f', cycleway: 'f', bridleway: 'f',
};

const LEVADA_WATERWAYS = new Set(['canal', 'drain', 'ditch']);

/**
 * Aerial lifts that carry people (D-094): Funchal to Monte, Monte to the
 * Botanical Garden, Garajau, Achadas da Cruz, the fajãs. The Monte cable car
 * crosses the city at walking-to-cycling speed, and without the cable in the
 * network the ride matched the streets underneath it. With it, the ride
 * follows the cable, and the map draws it faded, like a tunnel.
 */
const AERIALWAYS = new Set(['cable_car', 'gondola', 'mixed_lift']);

/** `f`, `r` or `0`: see the file header. */
export function onewayOf(tags, kind) {
  if (kind.toLowerCase() !== 'm') {
    return '0';
  }
  const value = tags.oneway;
  if (value === '-1' || value === 'reverse') {
    return 'r';
  }
  if (value === 'yes' || value === '1' || value === 'true') {
    return 'f';
  }
  // A motorway is one-way unless it says otherwise; a trunk road is not.
  if (value === undefined && (tags.highway === 'motorway' || tags.highway === 'motorway_link')) {
    return 'f';
  }
  return '0';
}

/** The kind of edge this way becomes, or null when it is left out. */
export function kindOf(tags) {
  if (tags.area === 'yes' || tags.indoor === 'yes') {
    return null;
  }
  if (tags.highway !== undefined) {
    const kind = KIND[tags.highway];
    if (kind === undefined) {
      return null;
    }
    if (tags.footway === 'sidewalk' || tags.footway === 'crossing') {
      return null;
    }
    if (tags.highway === 'service') {
      if (['parking_aisle', 'driveway', 'drive-through'].includes(tags.service)) {
        return null;
      }
      if (tags.access === 'private' || tags.access === 'no') {
        return null;
      }
    }
    return isTunnel(tags) ? kind.toUpperCase() : kind;
  }
  if (AERIALWAYS.has(tags.aerialway)) {
    return 'a';
  }
  if (
    LEVADA_WATERWAYS.has(tags.waterway) &&
    /levada/i.test(tags.name ?? '') &&
    !isTunnel(tags)
  ) {
    return 'l';
  }
  return null;
}

function isTunnel(tags) {
  return tags.tunnel !== undefined && tags.tunnel !== 'no';
}

/** Metres between two [lat, lon] points, flat-earth: edges are short. */
function metres(a, b) {
  const x = (b[1] - a[1]) * 111_320 * Math.cos((a[0] * Math.PI) / 180);
  const y = (b[0] - a[0]) * 110_540;
  return Math.hypot(x, y);
}

function perpendicularM(p, a, b) {
  const scaleX = 111_320 * Math.cos((a[0] * Math.PI) / 180);
  const scaleY = 110_540;
  const px = (p[1] - a[1]) * scaleX;
  const py = (p[0] - a[0]) * scaleY;
  const bx = (b[1] - a[1]) * scaleX;
  const by = (b[0] - a[0]) * scaleY;
  const lengthSquared = bx * bx + by * by;
  if (lengthSquared === 0) {
    return Math.hypot(px, py);
  }
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared));
  return Math.hypot(px - t * bx, py - t * by);
}

function simplifyM(points, tolerance) {
  if (points.length < 3) {
    return points;
  }
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let worst = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = perpendicularM(points[i], points[first], points[last]);
      if (d > worst) {
        worst = d;
        index = i;
      }
    }
    if (index !== -1 && worst > tolerance) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Google's encoded polyline, at `PRECISION`. [lat, lon] pairs in. */
export function encodePolyline(points) {
  let out = '';
  let lastLat = 0;
  let lastLon = 0;
  for (const [lat, lon] of points) {
    const la = Math.round(lat * PRECISION);
    const lo = Math.round(lon * PRECISION);
    out += encodeNumber(la - lastLat) + encodeNumber(lo - lastLon);
    lastLat = la;
    lastLon = lo;
  }
  return out;
}

function encodeNumber(value) {
  let v = value < 0 ? ~(value * 2) : value * 2;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v = Math.floor(v / 32);
  }
  return out + String.fromCharCode(v + 63);
}

/**
 * Split kept ways into junction-to-junction edges.
 *
 * @returns {{ nodeCount: number, edges: { from: number, to: number, kind: string, points: [number, number][] }[] }}
 */
export function buildGraph(nodes, ways) {
  // How many times each OSM node is used. A node used twice, by two ways or by
  // one way that loops back through it, is a junction.
  const uses = new Map();
  const kept = [];
  for (const way of ways) {
    const kind = kindOf(way.tags);
    if (kind === null) {
      continue;
    }
    const refs = way.refs.filter((ref) => nodes.has(ref));
    // Drop consecutive duplicates, which OSM occasionally has.
    const clean = refs.filter((ref, i) => i === 0 || ref !== refs[i - 1]);
    if (clean.length < 2) {
      continue;
    }
    kept.push({ kind, oneway: onewayOf(way.tags, kind), refs: clean });
    for (const ref of clean) {
      uses.set(ref, (uses.get(ref) ?? 0) + 1);
    }
  }

  const junction = new Map();
  const junctionOf = (ref) => {
    let index = junction.get(ref);
    if (index === undefined) {
      index = junction.size;
      junction.set(ref, index);
    }
    return index;
  };

  const edges = [];
  const seen = new Set();
  for (const way of kept) {
    let start = 0;
    for (let i = 1; i < way.refs.length; i += 1) {
      const last = i === way.refs.length - 1;
      if (!last && (uses.get(way.refs[i]) ?? 0) < 2) {
        continue;
      }
      const refs = way.refs.slice(start, i + 1);
      const from = junctionOf(refs[0]);
      const to = junctionOf(refs[refs.length - 1]);
      const points = simplifyM(
        refs.map((ref) => nodes.get(ref)),
        SIMPLIFY_M
      );
      start = i;
      // The same stretch mapped twice (two ways over the same nodes, in either
      // direction) is one edge: two would light one street twice.
      const forward = refs[0] <= refs[refs.length - 1];
      const key = (forward ? refs : [...refs].reverse()).join(':');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      edges.push({ from, to, kind: way.kind, oneway: way.oneway, points });
    }
  }

  return { nodeCount: junction.size, edges };
}

function parseArgs(argv) {
  const args = { bbox: ARCHIPELAGO, out: path.join(root, 'content/roads.json') };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--bbox') {
      const [south, west, north, east] = argv[i + 1].split(',').map(Number);
      args.bbox = { south, west, north, east };
      i += 1;
    } else if (argv[i] === '--out') {
      args.out = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const { nodes, ways, timestamp } = readPbf(
    PBF,
    args.bbox,
    (tags) => kindOf(tags) !== null
  );
  const graph = buildGraph(nodes, ways);

  const edgeNodes = [];
  let edgeKind = '';
  let edgeOneway = '';
  const edgeGeometry = [];
  let lengthM = 0;
  let pointCount = 0;
  const lengthByKind = {};
  for (const edge of graph.edges) {
    edgeNodes.push(edge.from, edge.to);
    edgeKind += edge.kind;
    edgeOneway += edge.oneway;
    edgeGeometry.push(encodePolyline(edge.points));
    pointCount += edge.points.length;
    let m = 0;
    for (let i = 1; i < edge.points.length; i += 1) {
      m += metres(edge.points[i - 1], edge.points[i]);
    }
    lengthM += m;
    lengthByKind[edge.kind] = (lengthByKind[edge.kind] ?? 0) + m;
  }

  const body = { edgeNodes, edgeKind, edgeOneway, edgeGeometry };
  const version = createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex')
    .slice(0, 12);

  const file = {
    about:
      'Roads and paths the map lights up (D-093). Built by tools/build-roads.mjs; never edit by hand.',
    source: `© OpenStreetMap contributors, ODbL. Extract dated ${timestamp ?? 'unknown'}.`,
    version,
    precision: PRECISION,
    nodeCount: graph.nodeCount,
    edgeCount: graph.edges.length,
    pointCount,
    ...body,
  };
  const text = JSON.stringify(file);
  writeFileSync(args.out, text);

  const km = (m) => (m / 1000).toFixed(0);
  console.log(
    `${graph.edges.length} edges, ${graph.nodeCount} junctions, ${km(lengthM)} km, ` +
      `${(text.length / 1e6).toFixed(2)} MB, version ${version}, ${((Date.now() - started) / 1000).toFixed(0)} s`
  );
  console.log(
    'km by kind: ' +
      Object.entries(lengthByKind)
        .sort((a, b) => b[1] - a[1])
        .map(([k, m]) => `${k} ${km(m)}`)
        .join(', ')
  );
  console.log(`→ ${path.relative(root, args.out)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
