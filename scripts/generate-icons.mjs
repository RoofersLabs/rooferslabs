/**
 * Generates the installed-app (PWA) icon PNGs, without external dependencies:
 * rasterises the rooferslabs mark into a pixel buffer and encodes a PNG with
 * zlib.
 *
 *   node scripts/generate-icons.mjs
 *
 * The mark is the same two polygons the brand SVGs draw
 * (apps/web/public/brand/logo.svg), read from one place here so the home-screen
 * icon can never drift from the logo everywhere else.
 *
 * Home-screen icons are a light surface: a white field with the navy mark on
 * it. That is the inverse of the tab favicon, which is a navy mark on
 * transparency, and the two are deliberately separate assets —
 * apps/web/public/icons/icon-16/32/48.png are favicons, are not listed in the
 * manifest, and are NOT generated here.
 *
 * Output is opaque RGB with no alpha channel, on purpose: iOS composites a
 * transparent app icon onto black, so an icon with alpha would show a black
 * background on the very home screen this is for.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webPublic = join(root, 'apps/web/public');
const outDir = join(webPublic, 'icons');
mkdirSync(outDir, { recursive: true });

/** rooferslabs navy — --brand-950, the identity colour. */
const MARK = [0x08, 0x1c, 0x3a];
const FIELD = [0xff, 0xff, 0xff];

/**
 * The mark, in its own 933×343 coordinate space — the viewBox of
 * brand/logo.svg, with the same two paths expressed as points:
 *
 *   M373 0 H817 L447 343 H0 Z      the sweeping roof plane
 *   M555 343 L750 159 L933 343 Z   the gable to its right
 *
 * Both are convex, so a point is inside when it is on the inner side of every
 * edge — no scanline crossing logic needed.
 */
const ART_W = 933;
const ART_H = 343;
const POLYGONS = [
  [
    [373, 0],
    [817, 0],
    [447, 343],
    [0, 343],
  ],
  [
    [555, 343],
    [750, 159],
    [933, 343],
  ],
];

/**
 * How much of the icon's width the mark spans.
 *
 * `any` matches the icons this replaces. `maskable` is smaller because Android
 * crops a maskable icon to whatever shape the launcher uses — the safe zone is
 * the middle 80%, and a mark at 50% stays clear of a circle mask's corners.
 */
const MARK_WIDTH = { any: 0.64, maskable: 0.5 };

function inside(polygon, x, y) {
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[(i + 1) % polygon.length];
    // Vertices wind clockwise in SVG's y-down space, so an interior point is
    // left-of-edge by this cross product for every edge — i.e. never negative.
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false;
  }
  return true;
}

/**
 * Draw one icon as an RGB buffer.
 *
 * Coverage is sampled on a 4×4 grid per pixel and used to blend the mark into
 * the field, which is what keeps the long diagonal clean at 64px instead of
 * stair-stepping.
 */
function draw(size, purpose) {
  const px = Buffer.alloc(size * size * 3);
  const markWidth = size * MARK_WIDTH[purpose];
  const markHeight = (markWidth * ART_H) / ART_W;
  const originX = (size - markWidth) / 2;
  const originY = (size - markHeight) / 2;

  const SAMPLES = 4;
  const step = 1 / SAMPLES;
  const offset = step / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          // Sample position, mapped back into the art's own coordinates.
          const u = ((x + offset + sx * step - originX) / markWidth) * ART_W;
          const v = ((y + offset + sy * step - originY) / markHeight) * ART_H;
          if (u < 0 || v < 0 || u > ART_W || v > ART_H) continue;
          if (POLYGONS.some((polygon) => inside(polygon, u, v))) hits++;
        }
      }
      const coverage = hits / (SAMPLES * SAMPLES);
      const i = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) {
        px[i + c] = Math.round(FIELD[c] + (MARK[c] - FIELD[c]) * coverage);
      }
    }
  }
  return px;
}

/** Encode an RGB buffer as an opaque PNG (colour type 2, 8-bit). */
function encodePng(pixels, size) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeBuffer = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])) >>> 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB, no alpha
  // compression, filter, interlace = 0

  const stride = size * 3;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
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

/**
 * Every home-screen icon. 16/32/48 are absent deliberately — see the note at
 * the top of this file.
 */
const targets = [
  { file: 'icons/icon-64.png', size: 64, purpose: 'any' },
  { file: 'icons/icon-128.png', size: 128, purpose: 'any' },
  { file: 'icons/icon-180.png', size: 180, purpose: 'any' },
  { file: 'icons/icon-192.png', size: 192, purpose: 'any' },
  { file: 'icons/icon-256.png', size: 256, purpose: 'any' },
  { file: 'icons/icon-512.png', size: 512, purpose: 'any' },
  { file: 'icons/icon-1024.png', size: 1024, purpose: 'any' },
  { file: 'icons/icon-512-maskable.png', size: 512, purpose: 'maskable' },
  // iOS reads this one for the home screen. Same art as icon-180, written to
  // the path <link rel="apple-touch-icon"> points at.
  { file: 'apple-touch-icon.png', size: 180, purpose: 'any' },
];

for (const target of targets) {
  const png = encodePng(draw(target.size, target.purpose), target.size);
  writeFileSync(join(webPublic, target.file), png);
  console.log(`✓ ${target.file} (${target.size}px, ${target.purpose}, ${png.length} bytes)`);
}
