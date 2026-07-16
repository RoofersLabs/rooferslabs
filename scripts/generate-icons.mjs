/**
 * Generates the PWA icon PNGs (192, 512, 512-maskable + apple-touch-icon)
 * without external dependencies: draws the RoofersLabs house mark into an RGBA
 * buffer and encodes a valid PNG using zlib.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'apps/web/public/icons');
mkdirSync(outDir, { recursive: true });

const BRAND = [0x1e, 0x40, 0xaf, 0xff]; // #1E40AF
const WHITE = [0xff, 0xff, 0xff, 0xff];

/** Draw the icon into an RGBA pixel buffer. */
function draw(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = c[3];
  };

  // Background: full square for maskable, rounded square otherwise.
  const radius = maskable ? 0 : Math.round(size * 0.22);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true;
      if (radius > 0) {
        const cx = x < radius ? radius : x >= size - radius ? size - radius - 1 : x;
        const cy = y < radius ? radius : y >= size - radius ? size - radius - 1 : y;
        inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
      }
      put(x, y, inside ? BRAND : [0, 0, 0, 0]);
    }
  }

  // House glyph geometry (scaled to a 64-unit grid, inset for maskable safe zone).
  const scale = maskable ? (size * 0.72) / 64 : size / 64;
  const offset = maskable ? (size - 64 * scale) / 2 : 0;
  const gx = (u) => Math.round(offset + u * scale);
  const gy = (v) => Math.round(offset + v * scale);

  // Roof triangle: apex (32,14), base y=36 from x=10..54.
  for (let v = 14; v <= 36; v++) {
    const t = (v - 14) / (36 - 14);
    const halfWidth = t * 22;
    for (let u = 32 - halfWidth; u <= 32 + halfWidth; u++) {
      for (let sy = gy(v); sy < gy(v + 1); sy++) {
        for (let sx = gx(u); sx < gx(u + 1); sx++) put(sx, sy, WHITE);
      }
    }
  }
  // Body: x=18..46, y=36..50.
  for (let sy = gy(36); sy < gy(50); sy++) {
    for (let sx = gx(18); sx < gx(46); sx++) put(sx, sy, WHITE);
  }
  // Chimney: x=40..46, y=18..28.
  for (let sy = gy(18); sy < gy(28); sy++) {
    for (let sx = gx(40); sx < gx(46); sx++) put(sx, sy, WHITE);
  }

  return px;
}

/** Encode an RGBA buffer as a PNG file. */
function encodePng(pixels, size) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeBuffer = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput) >>> 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // compression, filter, interlace = 0

  // Raw scanlines, each prefixed with filter byte 0.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// CRC-32 (PNG polynomial).
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-512-maskable.png', size: 512, maskable: true },
];
for (const target of targets) {
  const png = encodePng(draw(target.size, target), target.size);
  writeFileSync(join(outDir, target.file), png);
  console.log(`✓ ${target.file} (${png.length} bytes)`);
}
// Apple touch icon (180px, opaque background).
const apple = encodePng(draw(180, { maskable: true }), 180);
writeFileSync(join(root, 'apps/web/public/apple-touch-icon.png'), apple);
console.log(`✓ apple-touch-icon.png (${apple.length} bytes)`);
