/**
 * A minimal PNG writer, so geometry can be looked at without a device.
 *
 * WHY THIS EXISTS
 * ---------------
 * This project's own rule is that anything drawn must be judged by eye as well
 * as measured — the stamp artwork passed every geometry test and still rendered
 * as a crosshair (CLAUDE.md). But the ways to look at something here are a
 * device screenshot (needs the emulator, a build and five minutes) or an HTML
 * page (needs a browser that is displaying). Neither is available to a session
 * checking a line's shape, and no image library is installed.
 *
 * So: PNG by hand. It is less code than it sounds — the format is four chunks,
 * and Node already has the only hard part (`zlib`).
 *
 * ⚠ **Deliberately tiny.** 8-bit RGB, no alpha, no palette, no interlacing, one
 * filter type (none). It exists to draw diagnostic lines on a plain background,
 * not to be an image library.
 */

import { deflateSync } from 'node:zlib';

/** CRC-32, as PNG wants it. Table built once. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * A drawing surface: a plain RGB buffer with the few operations a diagnostic
 * picture needs.
 */
export class Canvas {
  constructor(width, height, background = [255, 255, 255]) {
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i += 1) {
      this.pixels[i * 3] = background[0];
      this.pixels[i * 3 + 1] = background[1];
      this.pixels[i * 3 + 2] = background[2];
    }
  }

  set(x, y, colour) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) {
      return;
    }
    const offset = (py * this.width + px) * 3;
    this.pixels[offset] = colour[0];
    this.pixels[offset + 1] = colour[1];
    this.pixels[offset + 2] = colour[2];
  }

  /** A filled square, which is how a line gets its width here. */
  dot(x, y, colour, size = 1) {
    const half = Math.floor(size / 2);
    for (let dy = -half; dy <= half; dy += 1) {
      for (let dx = -half; dx <= half; dx += 1) {
        this.set(x + dx, y + dy, colour);
      }
    }
  }

  /** Bresenham, thickened by drawing a square at each step. */
  line(x0, y0, x1, y1, colour, width = 1) {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const endX = Math.round(x1);
    const endY = Math.round(y1);
    const dx = Math.abs(endX - x);
    const dy = -Math.abs(endY - y);
    const stepX = x < endX ? 1 : -1;
    const stepY = y < endY ? 1 : -1;
    let error = dx + dy;

    for (;;) {
      this.dot(x, y, colour, width);
      if (x === endX && y === endY) {
        return;
      }
      const doubled = 2 * error;
      if (doubled >= dy) {
        error += dy;
        x += stepX;
      }
      if (doubled <= dx) {
        error += dx;
        y += stepY;
      }
    }
  }

  toPng() {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(this.width, 0);
    header.writeUInt32BE(this.height, 4);
    header[8] = 8; // bit depth
    header[9] = 2; // colour type: truecolour
    header[10] = 0; // deflate
    header[11] = 0; // adaptive filtering
    header[12] = 0; // no interlace

    // Each scanline is prefixed with its filter type. 0 is "none", which costs
    // compression and saves this file from implementing five filters.
    const raw = Buffer.alloc(this.height * (this.width * 3 + 1));
    for (let y = 0; y < this.height; y += 1) {
      const from = y * this.width * 3;
      raw[y * (this.width * 3 + 1)] = 0;
      this.pixels.copy(raw, y * (this.width * 3 + 1) + 1, from, from + this.width * 3);
    }

    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}
