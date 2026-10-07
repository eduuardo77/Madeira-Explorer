/**
 * A PNG without an alpha channel, from a resvg render (T-269).
 *
 * Play takes the feature graphic only as JPEG or 24-bit PNG, and resvg always
 * writes 32-bit RGBA. Each pixel is laid over `background` (the picture is
 * opaque, so this changes nothing visible) and written as 8-bit RGB, with
 * Node's own zlib: no image library for one file.
 */

import { crc32, deflateSync } from 'node:zlib';

/** `rendered` is resvg's `render()` result; `background` is [r, g, b]. */
export function rgbPng(rendered, background = [0, 0, 0]) {
  const { width, height, pixels } = rendered;
  const rows = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const out = y * (1 + width * 3); // each row starts with filter type 0, "none"
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const alpha = pixels[i + 3] / 255;
      for (let c = 0; c < 3; c += 1) {
        rows[out + 1 + x * 3 + c] = Math.round(pixels[i + c] * alpha + background[c] * (1 - alpha));
      }
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(2, 9); // colour type 2: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
