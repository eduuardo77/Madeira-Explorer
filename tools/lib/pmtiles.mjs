/**
 * A small PMTiles v3 reader and writer, for cutting zoom levels out of an
 * archive this project already has (T-329). Build-time only, no dependency.
 *
 * Why it exists: the video's map (`app/assets/map/`) shipped every zoom to 15
 * for an interactive map that left the app in August (D-057). The video never
 * zooms in that far, and 19 MB of tiles is most of what the video added to the
 * APK. The usual tool is the `pmtiles` CLI (`tools/fetch-toolchain.sh`); this
 * avoids a download for one subtraction.
 *
 * Format: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
 * A 127-byte header; directories of (tile id, offset, length, run length),
 * varint-coded and gzipped; then metadata and tile data. Tile ids count tiles
 * zoom by zoom, along a Hilbert curve inside each zoom.
 */

import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const HEADER_BYTES = 127;
const GZIP = 2;

function readVarint(buf, pos) {
  let value = 0;
  let shift = 0;
  for (;;) {
    const byte = buf[pos.i++];
    value += (byte & 0x7f) * 2 ** shift;
    if (byte < 0x80) return value;
    shift += 7;
  }
}

function writeVarint(out, value) {
  let v = value;
  while (v >= 0x80) {
    out.push((v % 0x80) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
}

function u64(buf, at) {
  return Number(buf.readBigUInt64LE(at));
}

export function readHeader(buf) {
  if (buf.toString('ascii', 0, 7) !== 'PMTiles' || buf[7] !== 3) throw new Error('not a PMTiles v3 archive');
  return {
    rootOffset: u64(buf, 8), rootLength: u64(buf, 16),
    metadataOffset: u64(buf, 24), metadataLength: u64(buf, 32),
    leafOffset: u64(buf, 40), leafLength: u64(buf, 48),
    dataOffset: u64(buf, 56), dataLength: u64(buf, 64),
    addressedTiles: u64(buf, 72), tileEntries: u64(buf, 80), tileContents: u64(buf, 88),
    clustered: buf[96], internalCompression: buf[97], tileCompression: buf[98], tileType: buf[99],
    minZoom: buf[100], maxZoom: buf[101],
    minLonE7: buf.readInt32LE(102), minLatE7: buf.readInt32LE(106), maxLonE7: buf.readInt32LE(110), maxLatE7: buf.readInt32LE(114),
    centerZoom: buf[118], centerLonE7: buf.readInt32LE(119), centerLatE7: buf.readInt32LE(123),
  };
}

function decompress(bytes, compression) {
  if (compression === GZIP) return gunzipSync(bytes);
  if (compression === 1) return bytes; // none
  throw new Error(`compression ${compression} not supported`);
}

function readDirectory(bytes) {
  const pos = { i: 0 };
  const n = readVarint(bytes, pos);
  const entries = Array.from({ length: n }, () => ({ tileId: 0, offset: 0, length: 0, runLength: 0 }));
  let last = 0;
  for (const e of entries) { last += readVarint(bytes, pos); e.tileId = last; }
  for (const e of entries) e.runLength = readVarint(bytes, pos);
  for (const e of entries) e.length = readVarint(bytes, pos);
  entries.forEach((e, i) => {
    const v = readVarint(bytes, pos);
    e.offset = v === 0 && i > 0 ? entries[i - 1].offset + entries[i - 1].length : v - 1;
  });
  return entries;
}

/** Every tile in the archive: { tileId, bytes } (a run of equal tiles comes out one per id). */
export function readTiles(buf) {
  const h = readHeader(buf);
  const tiles = [];
  const walk = (dirBytes) => {
    for (const e of readDirectory(decompress(dirBytes, h.internalCompression))) {
      if (e.runLength === 0) {
        walk(buf.subarray(h.leafOffset + e.offset, h.leafOffset + e.offset + e.length));
      } else {
        const bytes = buf.subarray(h.dataOffset + e.offset, h.dataOffset + e.offset + e.length);
        for (let k = 0; k < e.runLength; k += 1) tiles.push({ tileId: e.tileId + k, bytes });
      }
    }
  };
  walk(buf.subarray(h.rootOffset, h.rootOffset + h.rootLength));
  const metadata = buf.subarray(h.metadataOffset, h.metadataOffset + h.metadataLength);
  return { header: h, tiles, metadata };
}

/** The zoom of a tile id: ids count every tile of zoom 0, then of zoom 1, and so on. */
export function zoomOf(tileId) {
  let first = 0;
  for (let z = 0; z < 32; z += 1) {
    const count = 4 ** z;
    if (tileId < first + count) return z;
    first += count;
  }
  throw new Error(`tile id ${tileId} out of range`);
}

/**
 * Write tiles to a new archive with the given header fields (zooms, bounds,
 * types copied from the source). Identical tiles share one copy, consecutive
 * identical tiles become one run. The whole directory sits in the root; an
 * archive past its 16 KB limit is refused rather than written wrong.
 */
export function writeArchive({ header, tiles, metadata, maxZoom }) {
  const sorted = [...tiles].sort((a, b) => a.tileId - b.tileId);
  const data = [];
  const seen = new Map(); // content hash -> { offset, length }
  let dataLength = 0;
  const entries = [];
  for (const tile of sorted) {
    const hash = createHash('sha256').update(tile.bytes).digest('hex');
    let place = seen.get(hash);
    if (place === undefined) {
      place = { offset: dataLength, length: tile.bytes.length };
      seen.set(hash, place);
      data.push(tile.bytes);
      dataLength += tile.bytes.length;
    }
    const last = entries[entries.length - 1];
    if (last && last.tileId + last.runLength === tile.tileId && last.offset === place.offset) {
      last.runLength += 1;
    } else {
      entries.push({ tileId: tile.tileId, offset: place.offset, length: place.length, runLength: 1 });
    }
  }
  const dir = [];
  writeVarint(dir, entries.length);
  let last = 0;
  for (const e of entries) { writeVarint(dir, e.tileId - last); last = e.tileId; }
  for (const e of entries) writeVarint(dir, e.runLength);
  for (const e of entries) writeVarint(dir, e.length);
  entries.forEach((e, i) => {
    const contiguous = i > 0 && e.offset === entries[i - 1].offset + entries[i - 1].length;
    writeVarint(dir, contiguous ? 0 : e.offset + 1);
  });
  const root = gzipSync(Buffer.from(dir));
  if (HEADER_BYTES + root.length > 16384) throw new Error(`root directory ${root.length} bytes: too many tiles for a root-only archive`);

  const h = Buffer.alloc(HEADER_BYTES);
  h.write('PMTiles', 0, 'ascii');
  h[7] = 3;
  const rootOffset = HEADER_BYTES;
  const metadataOffset = rootOffset + root.length;
  const leafOffset = metadataOffset + metadata.length;
  const dataOffset = leafOffset;
  const put = (at, value) => h.writeBigUInt64LE(BigInt(value), at);
  put(8, rootOffset); put(16, root.length);
  put(24, metadataOffset); put(32, metadata.length);
  put(40, leafOffset); put(48, 0);
  put(56, dataOffset); put(64, dataLength);
  put(72, sorted.length); put(80, entries.length); put(88, seen.size);
  h[96] = 1; // clustered: data is in tile id order
  h[97] = GZIP;
  h[98] = header.tileCompression;
  h[99] = header.tileType;
  h[100] = header.minZoom;
  h[101] = maxZoom;
  h.writeInt32LE(header.minLonE7, 102); h.writeInt32LE(header.minLatE7, 106);
  h.writeInt32LE(header.maxLonE7, 110); h.writeInt32LE(header.maxLatE7, 114);
  h[118] = Math.min(header.centerZoom, maxZoom);
  h.writeInt32LE(header.centerLonE7, 119); h.writeInt32LE(header.centerLatE7, 123);
  return Buffer.concat([h, root, metadata, ...data]);
}
