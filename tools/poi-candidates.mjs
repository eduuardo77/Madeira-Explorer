/**
 * Turn the tile pack into a triage list for T-066.
 *
 *     node tools/poi-candidates.mjs
 *     → content/pois.candidates.json
 *
 * WHAT THIS IS FOR
 * ----------------
 * `content/pois.json` is empty, and it is the single thing standing between
 * this app and being usable: no places means no stamps, no hero number, no
 * passport and no trip end. T-066 says the work is *"selection, not research"*
 * — OSM already holds far more candidates than the 60–100 target (D-049) — but until
 * now there was no list to select *from*. The file was blank and every
 * coordinate had to be looked up by hand.
 *
 * This produces the list. It reads `tiles/out/madeira.pmtiles`, which is
 * already in the repository and is the same data the map draws from, and
 * writes every named feature that could plausibly be a place, with its
 * coordinates, a suggested category, a suggested radius and a region.
 *
 * ⚠ **IT DOES NOT CURATE, AND MUST NOT.** Selection and editorial judgement
 * are the project lead's by decision (T-066, CONTEXT §5a — it is the one thing
 * a global competitor cannot buy). Everything below is mechanical: a name from
 * OSM, a coordinate, and a category chosen by a lookup table. The output is
 * deliberately named `pois.candidates.json` and is **not** what the app loads.
 * The work left is the part that matters — deleting the ones that are not
 * worth a stamp, fixing names, and adjusting radii.
 *
 * WHY IT READS THE TILE PACK AND NOT THE OSM EXTRACT
 * --------------------------------------------------
 * `tiles/src/portugal-latest.osm.pbf` is 390 MB and needs `osmium` to read.
 * The tile pack is 12 MB, is in the repo, needs nothing but Node's own `zlib`,
 * and has already been filtered to the island. It carries a `pois` layer (178
 * peaks, 115 viewpoints, 26 beaches, 23 trailheads…) and a `places` layer of
 * settlements, which is exactly the candidate set T-066 describes.
 *
 * ⚠ **LEVADAS ARE NOT PRODUCED HERE, ON PURPOSE.** A levada needs a `start`
 * and an `end` geofence and the award requires both (D-009) — one geofence
 * would credit somebody who parked at the trailhead and turned around. Pairing
 * a trailhead with the right exit is exactly the local knowledge this tool has
 * none of. Trailheads are listed in a separate section as a starting point for
 * that work, and are not emitted as places.
 */

import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const PACK = path.join(root, 'tiles', 'out', 'madeira.pmtiles');
const OUT = path.join(root, 'content', 'pois.candidates.json');

/**
 * OSM `kind` → our five categories (D-027). Kinds not listed are dropped.
 *
 * ⚠ These are *suggestions to be overruled*, not classifications. A peak is
 * filed as a viewpoint because that is what a tourist does at one, and a
 * `attraction` is a landmark because it has nowhere else to go — both are
 * exactly the judgement calls D-027 says belong to a person. There is no
 * "other" category and that is deliberate: a place that fits nowhere is a
 * signal about the place.
 */
const CATEGORY = {
  viewpoint: 'viewpoint',
  peak: 'viewpoint',
  cape: 'viewpoint',
  beach: 'beach',
  attraction: 'landmark',
  museum: 'landmark',
  castle: 'landmark',
  fort: 'landmark',
  monument: 'landmark',
  memorial: 'landmark',
  place_of_worship: 'landmark',
  christian: 'landmark',
  garden: 'landmark',
  park: 'landmark',
  nature_reserve: 'landmark',
  zoo: 'landmark',
  aquarium: 'landmark',
  theme_park: 'landmark',
  cable_car: 'landmark',
  lighthouse: 'landmark',
  waterfall: 'landmark',
};

/**
 * Default radius per category, in metres, straight from `content/README.md`.
 *
 * The README is blunt that this number is "the difference between a stamp
 * firing and a walked levada going uncredited", and that it is not a precision
 * setting. These defaults are the middle of its stated ranges; a place in a
 * valley under canopy needs more and a car park needs less, and only somebody
 * who has stood there knows which.
 */
const RADIUS = { viewpoint: 200, beach: 250, village: 600, landmark: 200 };

/* ------------------------------------------------------------ protobuf bits */

class Reader {
  constructor(buffer) {
    this.b = buffer;
    this.i = 0;
  }
  get done() {
    return this.i >= this.b.length;
  }
  varint() {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = this.b[this.i];
      this.i += 1;
      result += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7;
    }
  }
  field() {
    const key = this.varint();
    return [key >> 3, key & 7];
  }
  bytes() {
    const length = this.varint();
    const slice = this.b.subarray(this.i, this.i + length);
    this.i += length;
    return slice;
  }
  skip(wire) {
    if (wire === 0) this.varint();
    else if (wire === 2) this.i += this.varint();
    else if (wire === 5) this.i += 4;
    else if (wire === 1) this.i += 8;
    else throw new Error(`unknown wire type ${wire}`);
  }
}

/** Protobuf zigzag, used by MVT geometry deltas. */
const unzigzag = (n) => (n >> 1) ^ -(n & 1);

/* -------------------------------------------------------------- PMTiles v3 */

/**
 * PMTiles orders tiles along a Hilbert curve, so a tile id has to be walked
 * back to z/x/y before its contents can be georeferenced. This is the standard
 * inverse from the format specification.
 */
function tileIdToZxy(id) {
  let accumulated = 0;
  let z = 0;
  for (;;) {
    const tilesAtZoom = 4 ** z;
    if (accumulated + tilesAtZoom > id) {
      return [z, ...hilbertToXY(z, id - accumulated)];
    }
    accumulated += tilesAtZoom;
    z += 1;
  }
}

function hilbertToXY(z, position) {
  const n = 2 ** z;
  let x = 0;
  let y = 0;
  let t = position;
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & Math.floor(t / 2);
    const ry = 1 & (t ^ rx);
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      const swap = x;
      x = y;
      y = swap;
    }
    x += s * rx;
    y += s * ry;
    t = Math.floor(t / 4);
  }
  return [x, y];
}

function readDirectory(raw, offset, length) {
  const entries = [];
  const decoded = gunzipSync(raw.subarray(offset, offset + length));
  const reader = new Reader(decoded);
  const count = reader.varint();

  const ids = [];
  let last = 0;
  for (let i = 0; i < count; i += 1) {
    last += reader.varint();
    ids.push(last);
  }
  const runs = [];
  for (let i = 0; i < count; i += 1) runs.push(reader.varint());
  const lengths = [];
  for (let i = 0; i < count; i += 1) lengths.push(reader.varint());
  const offsets = [];
  for (let i = 0; i < count; i += 1) offsets.push(reader.varint());

  for (let i = 0; i < count; i += 1) {
    const raw0 = offsets[i];
    const resolved =
      raw0 === 0 && i > 0
        ? entries[i - 1].offset + entries[i - 1].length
        : raw0 - 1;
    entries.push({
      id: ids[i],
      run: runs[i],
      offset: resolved,
      length: lengths[i],
    });
  }
  return entries;
}

/* -------------------------------------------------------------------- MVT */

/** Decode one layer into `{ name, features: [{ props, x, y }] }` in tile units. */
function readLayer(buffer) {
  const reader = new Reader(buffer);
  let name = null;
  let extent = 4096;
  const keys = [];
  const values = [];
  const rawFeatures = [];

  while (!reader.done) {
    const [field, wire] = reader.field();
    if (field === 1 && wire === 2) name = reader.bytes().toString('utf8');
    else if (field === 3 && wire === 2) keys.push(reader.bytes().toString('utf8'));
    else if (field === 4 && wire === 2) {
      const vr = new Reader(reader.bytes());
      let value = null;
      while (!vr.done) {
        const [vf, vw] = vr.field();
        if (vf === 1 && vw === 2) value = vr.bytes().toString('utf8');
        else if (vf === 2 && vw === 5) {
          value = vr.b.readFloatLE(vr.i);
          vr.i += 4;
        } else if (vf === 3 && vw === 1) {
          value = vr.b.readDoubleLE(vr.i);
          vr.i += 8;
        } else if ((vf === 4 || vf === 5) && vw === 0) value = vr.varint();
        else if (vf === 6 && vw === 0) value = unzigzag(vr.varint());
        else if (vf === 7 && vw === 0) value = vr.varint() !== 0;
        else vr.skip(vw);
      }
      values.push(value);
    } else if (field === 5 && wire === 0) extent = reader.varint();
    else if (field === 2 && wire === 2) rawFeatures.push(reader.bytes());
    else reader.skip(wire);
  }

  const features = [];
  for (const raw of rawFeatures) {
    const fr = new Reader(raw);
    let tags = [];
    let geometry = [];
    while (!fr.done) {
      const [ff, fw] = fr.field();
      if (ff === 2 && fw === 2) {
        const tr = new Reader(fr.bytes());
        while (!tr.done) tags.push(tr.varint());
      } else if (ff === 4 && fw === 2) {
        const gr = new Reader(fr.bytes());
        while (!gr.done) geometry.push(gr.varint());
      } else fr.skip(fw);
    }

    // Only the first MoveTo is needed: every candidate is a point, and for a
    // polygon or line the first vertex is a good enough handle for a human to
    // recognise and correct.
    if (geometry.length < 3) continue;
    const command = geometry[0] & 0x7;
    if (command !== 1) continue;
    const x = unzigzag(geometry[1]);
    const y = unzigzag(geometry[2]);

    const props = {};
    for (let i = 0; i + 1 < tags.length; i += 2) {
      props[keys[tags[i]]] = values[tags[i + 1]];
    }
    features.push({ props, x, y, extent });
  }

  return { name, features };
}

/* --------------------------------------------------------------- geography */

function toLonLat(z, tileX, tileY, x, y, extent) {
  const scale = 2 ** z;
  const lon = ((tileX + x / extent) / scale) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * ((tileY + y / extent) / scale);
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return [lon, lat];
}

/** Metres between two coordinates. Equirectangular is ample at island scale. */
function metresBetween(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const x = dLon * Math.cos(meanLat);
  return Math.sqrt(dLat * dLat + x * x) * R;
}

function slug(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/* -------------------------------------------------------------------- main */

const raw = readFileSync(PACK);
if (raw.subarray(0, 7).toString('ascii') !== 'PMTiles') {
  throw new Error(`${PACK} is not a PMTiles archive`);
}
const rootOffset = Number(raw.readBigUInt64LE(8));
const rootLength = Number(raw.readBigUInt64LE(16));
const leafOffset = Number(raw.readBigUInt64LE(24));
const dataOffset = Number(raw.readBigUInt64LE(40));

const rootEntries = readDirectory(raw, rootOffset, rootLength);
const tileEntries = [];
for (const entry of rootEntries) {
  if (entry.run === 0) {
    tileEntries.push(
      ...readDirectory(raw, leafOffset + entry.offset, entry.length).filter(
        (leaf) => leaf.run !== 0
      )
    );
  } else {
    tileEntries.push(entry);
  }
}

/** Everything named, keyed by rounded position so a feature in four tiles counts once. */
const candidates = new Map();
const settlements = [];
const trailheads = [];

for (const entry of tileEntries) {
  const [z, tileX, tileY] = tileIdToZxy(entry.id);
  let blob = raw.subarray(dataOffset + entry.offset, dataOffset + entry.offset + entry.length);
  try {
    blob = gunzipSync(blob);
  } catch {
    // Already plain; the pack mixes both.
  }

  const reader = new Reader(blob);
  while (!reader.done) {
    const [field, wire] = reader.field();
    if (field !== 3 || wire !== 2) {
      reader.skip(wire);
      continue;
    }
    const layer = readLayer(reader.bytes());
    if (layer.name !== 'pois' && layer.name !== 'places') continue;

    for (const feature of layer.features) {
      const name = feature.props['name:pt'] ?? feature.props.name;
      const kind = feature.props.kind;
      if (typeof name !== 'string' || name.length === 0) continue;

      const [lon, lat] = toLonLat(z, tileX, tileY, feature.x, feature.y, feature.extent);
      // The pack covers the whole archipelago; Porto Santo is deferred (D-021).
      if (lat < 32.6 || lat > 32.92 || lon < -17.31 || lon > -16.6) continue;

      // ⚠ Dedupe on the name plus *proximity*, not on rounded coordinates. A
      // feature mapped as both a node and an area, or repeated across tile
      // boundaries, lands a few metres away and rounding put those in separate
      // buckets — the validator caught six pairs "0 m apart". Two stamps for
      // one arrival is a silent way to make a collection wrong.
      const near = (list) =>
        list.find((existing) => metresBetween(existing, { lat, lon }) < 150);

      if (layer.name === 'places') {
        const rank = feature.props.population_rank ?? 0;
        if (kind === 'locality' || kind === 'borough') {
          settlements.push({ name, lat, lon, rank });
        }
        continue;
      }

      if (kind === 'trailhead') {
        trailheads.push({ name, lat, lon });
        continue;
      }

      const category = CATEGORY[kind];
      if (category === undefined) continue;
      const sameName = candidates.get(name) ?? [];
      if (near(sameName) === undefined) {
        // `min_zoom` is Protomaps' own prominence signal — the zoom at which a
        // feature starts being worth drawing. Lower is more important. It is
        // not editorial judgement, but it is a far better starting order than
        // alphabetical, and it is what makes this list triageable rather than
        // a 1,795-row dump.
        const prominence = feature.props.min_zoom ?? 99;
        sameName.push({ name, category, kind, lat, lon, prominence });
        candidates.set(name, sameName);
      }
    }
  }
}

/** The largest settlements become `village` candidates; the rest name regions. */
const bySettlement = new Map();
for (const s of settlements) {
  const key = `${s.name}|${s.lat.toFixed(3)}`;
  if (!bySettlement.has(key) || bySettlement.get(key).rank < s.rank) {
    bySettlement.set(key, s);
  }
}
const uniqueSettlements = [...bySettlement.values()].sort((a, b) => b.rank - a.rank);

for (const s of uniqueSettlements) {
  const sameName = candidates.get(s.name) ?? [];
  const clash = sameName.find((e) => metresBetween(e, s) < 150);
  if (clash !== undefined) continue;
  sameName.push({
    name: s.name,
    category: 'village',
    kind: 'locality',
    lat: s.lat,
    lon: s.lon,
    // Settlements have no `min_zoom`, so they rank by population instead —
    // on their own scale, compared only against each other.
    prominence: -s.rank,
  });
  candidates.set(s.name, sameName);
}

/** Region = the nearest sizeable settlement. Mechanical, and easy to overrule. */
const regionAnchors = uniqueSettlements.slice(0, 12);
function regionFor(place) {
  let best = null;
  let bestDistance = Infinity;
  for (const anchor of regionAnchors) {
    const d = metresBetween(place, anchor);
    if (d < bestDistance) {
      bestDistance = d;
      best = anchor;
    }
  }
  return best === null ? 'unassigned' : slug(best.name);
}

const usedIds = new Set();
function uniqueId(name) {
  const base = slug(name) || 'place';
  let id = base;
  let n = 2;
  while (usedIds.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  usedIds.add(id);
  return id;
}

/**
 * How many candidates to write, per category.
 *
 * 200 against a 60–100 target (D-049): triage means deleting roughly two in
 * three, which is a job that finishes. It was 400 when the target was 150–250.
 *
 * ⚠ **Ranking has to happen inside a category, never across them.** The first
 * attempt sorted everything on one scale and produced 397 villages, three
 * landmarks and no viewpoints at all — every named hamlet outranked every
 * miradouro, because a settlement's importance and a POI's `min_zoom` are not
 * the same measurement and pretending they are is meaningless.
 *
 * The shares below are a **starting mix, not a judgement**: enough of each to
 * triage from, weighted toward viewpoints because Madeira has 115 mapped ones
 * and they are what the island is for. Scale the whole thing with `--max`.
 * Everything held back is still in the pack; nothing is lost by cutting deep.
 */
const SHARE = { viewpoint: 0.42, landmark: 0.28, village: 0.21, beach: 0.09 };

const maxArgument = process.argv.indexOf('--max');
const MAX = maxArgument === -1 ? 200 : Number(process.argv[maxArgument + 1]);

const allCandidates = [...candidates.values()].flat();
const byCategoryRanked = new Map();
for (const candidate of allCandidates) {
  const list = byCategoryRanked.get(candidate.category) ?? [];
  list.push(candidate);
  byCategoryRanked.set(candidate.category, list);
}

const kept = [];
let collapsed = 0;
for (const [category, list] of byCategoryRanked) {
  list.sort((a, b) => a.prominence - b.prominence || a.name.localeCompare(b.name));

  // ⚠ One entry per name, per category. Madeira has six distinct hamlets
  // called "Achada" and two beaches called "Praia da Calheta", and they are
  // genuinely different places — but six identical stamps reading "Achada"
  // would make a collection look broken, and D-002 says the passport is the
  // reward. The most prominent survives; the rest are still in the pack if a
  // person decides one of them earns its own name.
  const seen = new Set();
  const unique = [];
  for (const candidate of list) {
    if (seen.has(candidate.name)) {
      collapsed += 1;
      continue;
    }
    seen.add(candidate.name);
    unique.push(candidate);
  }

  const quota = Math.round(MAX * (SHARE[category] ?? 0));
  kept.push(...unique.slice(0, quota));
}
const heldBack = allCandidates.length - kept.length;

const places = kept
  .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  .map((c) => {
    const id = uniqueId(c.name);
    return {
      id,
      name: c.name,
      category: c.category,
      regionId: regionFor(c),
      _osmKind: c.kind,
      _prominence: c.prominence,
      geofences: [
        {
          id,
          lat: Number(c.lat.toFixed(5)),
          lon: Number(c.lon.toFixed(5)),
          radiusM: RADIUS[c.category],
        },
      ],
    };
  });

const output = {
  formatVersion: 1,
  _generatedBy:
    'tools/poi-candidates.mjs — CANDIDATES, NOT CONTENT. Triage into content/pois.json (T-066).',
  _howToUse: [
    'This is a starting list, not a curated one. Every entry needs a human decision.',
    'DELETE anything not worth a stamp — that is most of the work and the whole point.',
    'CHECK each name reads well; OSM names are not always what a visitor calls the place.',
    'ADJUST radiusM: 400-600 for a trailhead under canopy, 150-250 for an exposed miradouro.',
    'The target is 60-100 places (D-049), so expect to delete well over half of this.',
    'REMOVE the _osmKind and _prominence fields once reviewed; they are hints, not format.',
    'WATCH for OSM mapping artefacts — names like "arvore1" are somebody\'s test node.',
    'Levadas are NOT here: they need a start and an end geofence (D-009). See _trailheads.',
    'Validate with: node tools/validate-content.mjs content/pois.candidates.json',
  ],
  _trailheads: trailheads
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({
      name: t.name,
      lat: Number(t.lat.toFixed(5)),
      lon: Number(t.lon.toFixed(5)),
    })),
  places,
};

writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

const byCategory = new Map();
for (const p of places) byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + 1);

console.log(`content/pois.candidates.json: ${places.length} candidates`);
for (const [category, count] of [...byCategory].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${category.padEnd(12)} ${String(count).padStart(4)}`);
}
console.log(`  ${'(trailheads)'.padEnd(12)} ${String(trailheads.length).padStart(4)}  listed separately — levadas need a start and an end`);
if (heldBack > 0) {
  console.log(
    `\n${heldBack} lower-prominence candidates held back. Ordered by OSM's own\n` +
      "min_zoom, so the ones most likely to matter are in. `--max 800` to see more."
  );
}
console.log('\nThis is a triage list, not content. Deleting is the work (T-066).');
console.log('Check it with: node tools/validate-content.mjs content/pois.candidates.json');
