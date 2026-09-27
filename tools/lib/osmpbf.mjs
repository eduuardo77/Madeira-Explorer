/**
 * A minimal OpenStreetMap PBF reader: nodes and ways inside a bounding box.
 *
 * WHY THIS EXISTS RATHER THAN A PACKAGE
 * -------------------------------------
 * `tools/build-roads.mjs` needs every road and path of the archipelago, with
 * geometry. Overpass (what `build-levadas.mjs` uses) can serve that, but the
 * answer changes under you and the build then depends on a shared free
 * service. The Portugal extract the tile pipeline already uses
 * (`tiles/src/portugal-latest.osm.pbf`) is on disk, dated, and reproducible.
 * Reading it takes about two hundred lines of protobuf, which is cheaper than
 * a dependency that would need the network-behaviour check CONTEXT §6.4 asks
 * for. Build-time only: nothing here ships.
 *
 * The format is `https://wiki.openstreetmap.org/wiki/PBF_Format`: a sequence
 * of zlib-compressed blocks, each a protobuf message. Only what the road graph
 * needs is decoded: dense nodes (id, lat, lon), and ways (id, tags, node refs).
 * Nodes precede ways in a sorted extract, so one pass is enough: nodes inside
 * the box are remembered, and a way is kept when any of its nodes was.
 */

import { openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** Reads protobuf wire format from a byte array. */
class Reader {
  constructor(buf, start = 0, end = buf.length) {
    this.buf = buf;
    this.pos = start;
    this.end = end;
  }

  done() {
    return this.pos >= this.end;
  }

  varint() {
    // Numbers here reach 2^40 or so (node ids, delta-coded coordinates), past
    // what 32-bit bit operations hold, so the high part is accumulated with
    // multiplication. Exact up to 2^53, which OSM ids are far below.
    let result = 0;
    let shift = 1;
    for (;;) {
      const byte = this.buf[this.pos++];
      result += (byte & 0x7f) * shift;
      if (byte < 0x80) {
        return result;
      }
      shift *= 128;
    }
  }

  svarint() {
    const n = this.varint();
    // Zigzag: 0, -1, 1, -2 ... encoded as 0, 1, 2, 3 ...
    return n % 2 === 0 ? n / 2 : -(n + 1) / 2;
  }

  key() {
    const k = this.varint();
    return [Math.floor(k / 8), k % 8];
  }

  bytes() {
    const length = this.varint();
    const start = this.pos;
    this.pos += length;
    return [start, this.pos];
  }

  skip(wireType) {
    if (wireType === 0) this.varint();
    else if (wireType === 1) this.pos += 8;
    else if (wireType === 2) this.bytes();
    else if (wireType === 5) this.pos += 4;
    else throw new Error(`unsupported wire type ${wireType}`);
  }

  /** A packed repeated varint field, as an array. */
  packed(signed) {
    const [start, end] = this.bytes();
    const inner = new Reader(this.buf, start, end);
    const out = [];
    while (!inner.done()) {
      out.push(signed ? inner.svarint() : inner.varint());
    }
    return out;
  }
}

function readBlob(buf) {
  const r = new Reader(buf);
  let raw = null;
  let zlib = null;
  while (!r.done()) {
    const [field, type] = r.key();
    if (field === 1 && type === 2) {
      const [s, e] = r.bytes();
      raw = buf.subarray(s, e);
    } else if (field === 3 && type === 2) {
      const [s, e] = r.bytes();
      zlib = buf.subarray(s, e);
    } else {
      r.skip(type);
    }
  }
  if (raw) return raw;
  if (zlib) return inflateSync(zlib);
  throw new Error('blob with neither raw nor zlib data (lzma is not supported)');
}

function readBlobHeader(buf) {
  const r = new Reader(buf);
  let type = '';
  let size = 0;
  while (!r.done()) {
    const [field, wt] = r.key();
    if (field === 1 && wt === 2) {
      const [s, e] = r.bytes();
      type = buf.toString('utf8', s, e);
    } else if (field === 3 && wt === 0) {
      size = r.varint();
    } else {
      r.skip(wt);
    }
  }
  return { type, size };
}

/**
 * Every node inside `bbox` and every way touching one, from a PBF file.
 *
 * @param {string} file
 * @param {{south:number, west:number, north:number, east:number}} bbox
 * @param {(tags: Record<string,string>) => boolean} wantWay  called only with tags
 * @returns {{ nodes: Map<number,[number,number]>, ways: {id:number, tags:Record<string,string>, refs:number[]}[], timestamp: string|null }}
 */
export function readPbf(file, bbox, wantWay) {
  const fd = openSync(file, 'r');
  const fileSize = fstatSync(fd).size;
  const nodes = new Map();
  const ways = [];
  let timestamp = null;
  let offset = 0;

  const read = (length) => {
    const buf = Buffer.alloc(length);
    readSync(fd, buf, 0, length, offset);
    offset += length;
    return buf;
  };

  try {
    while (offset < fileSize) {
      const headerLength = read(4).readUInt32BE(0);
      const header = readBlobHeader(read(headerLength));
      const data = readBlob(read(header.size));
      if (header.type === 'OSMHeader') {
        timestamp = readHeaderTimestamp(data);
      } else if (header.type === 'OSMData') {
        readPrimitiveBlock(data, bbox, nodes, ways, wantWay);
      }
    }
  } finally {
    closeSync(fd);
  }

  return { nodes, ways, timestamp };
}

function readHeaderTimestamp(buf) {
  const r = new Reader(buf);
  while (!r.done()) {
    const [field, wt] = r.key();
    // osmosis_replication_timestamp, seconds since the epoch.
    if (field === 32 && wt === 0) {
      return new Date(r.varint() * 1000).toISOString();
    }
    r.skip(wt);
  }
  return null;
}

function readPrimitiveBlock(buf, bbox, nodes, ways, wantWay) {
  const r = new Reader(buf);
  const strings = [];
  const groups = [];
  let granularity = 100;
  let latOffset = 0;
  let lonOffset = 0;

  while (!r.done()) {
    const [field, wt] = r.key();
    if (field === 1 && wt === 2) {
      const [s, e] = r.bytes();
      const st = new Reader(buf, s, e);
      while (!st.done()) {
        const [f2, w2] = st.key();
        if (f2 === 1 && w2 === 2) {
          const [a, b] = st.bytes();
          strings.push(buf.toString('utf8', a, b));
        } else {
          st.skip(w2);
        }
      }
    } else if (field === 2 && wt === 2) {
      groups.push(r.bytes());
    } else if (field === 17 && wt === 0) {
      granularity = r.varint();
    } else if (field === 19 && wt === 0) {
      latOffset = r.varint();
    } else if (field === 20 && wt === 0) {
      lonOffset = r.varint();
    } else {
      r.skip(wt);
    }
  }

  const toDeg = (value, off) => 1e-9 * (off + granularity * value);

  for (const [gs, ge] of groups) {
    const g = new Reader(buf, gs, ge);
    while (!g.done()) {
      const [field, wt] = g.key();
      if (field === 2 && wt === 2) {
        // DenseNodes
        const [s, e] = g.bytes();
        const d = new Reader(buf, s, e);
        let ids = null;
        let lats = null;
        let lons = null;
        while (!d.done()) {
          const [f2, w2] = d.key();
          if (f2 === 1 && w2 === 2) ids = d.packed(true);
          else if (f2 === 8 && w2 === 2) lats = d.packed(true);
          else if (f2 === 9 && w2 === 2) lons = d.packed(true);
          else d.skip(w2);
        }
        let id = 0;
        let lat = 0;
        let lon = 0;
        for (let i = 0; i < ids.length; i += 1) {
          id += ids[i];
          lat += lats[i];
          lon += lons[i];
          const la = toDeg(lat, latOffset);
          const lo = toDeg(lon, lonOffset);
          if (la >= bbox.south && la <= bbox.north && lo >= bbox.west && lo <= bbox.east) {
            nodes.set(id, [la, lo]);
          }
        }
      } else if (field === 1 && wt === 2) {
        // A plain Node. Rare in extracts, but legal.
        const [s, e] = g.bytes();
        const n = new Reader(buf, s, e);
        let id = 0;
        let lat = 0;
        let lon = 0;
        while (!n.done()) {
          const [f2, w2] = n.key();
          if (f2 === 1 && w2 === 0) id = n.svarint();
          else if (f2 === 8 && w2 === 0) lat = n.svarint();
          else if (f2 === 9 && w2 === 0) lon = n.svarint();
          else n.skip(w2);
        }
        const la = toDeg(lat, latOffset);
        const lo = toDeg(lon, lonOffset);
        if (la >= bbox.south && la <= bbox.north && lo >= bbox.west && lo <= bbox.east) {
          nodes.set(id, [la, lo]);
        }
      } else if (field === 3 && wt === 2) {
        const [s, e] = g.bytes();
        const w = new Reader(buf, s, e);
        let id = 0;
        let keys = [];
        let vals = [];
        let refs = [];
        while (!w.done()) {
          const [f2, w2] = w.key();
          if (f2 === 1 && w2 === 0) id = w.varint();
          else if (f2 === 2 && w2 === 2) keys = w.packed(false);
          else if (f2 === 3 && w2 === 2) vals = w.packed(false);
          else if (f2 === 8 && w2 === 2) refs = w.packed(true);
          else w.skip(w2);
        }
        // Cheap test first: does the way touch the box at all?
        let ref = 0;
        let inside = false;
        const absolute = new Array(refs.length);
        for (let i = 0; i < refs.length; i += 1) {
          ref += refs[i];
          absolute[i] = ref;
          if (!inside && nodes.has(ref)) inside = true;
        }
        if (!inside) continue;
        const tags = {};
        for (let i = 0; i < keys.length; i += 1) {
          tags[strings[keys[i]]] = strings[vals[i]];
        }
        if (wantWay(tags)) {
          ways.push({ id, tags, refs: absolute });
        }
      } else {
        g.skip(wt);
      }
    }
  }
}
