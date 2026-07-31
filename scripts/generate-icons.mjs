/**
 * Generates the installed-app (PWA) and Web Push notification icon PNGs, without
 * external dependencies: rasterises the rooferslabs mark into a pixel buffer and
 * encodes a PNG with zlib.
 *
 *   node scripts/generate-icons.mjs
 *
 * The mark is the same two polygons the brand SVGs draw
 * (apps/web/public/brand/logo.svg), read from one place here so every icon can
 * never drift from the logo everywhere else.
 *
 * There are three surfaces here, and they are separate assets because the
 * platforms treat them differently — one file cannot serve all three:
 *
 *   home screen   A white field with the navy mark, opaque RGB with no alpha
 *                 channel. iOS composites a transparent app icon onto black, so
 *                 alpha would show a black background on the very home screen
 *                 this is for.
 *
 *   notification  The navy field with the white mark — the inverse. A
 *                 notification is drawn on the platform's own surface, which is
 *                 near-white in light mode, so the home-screen icon's white
 *                 field dissolves into it and leaves what looks like an empty
 *                 box. A navy tile reads as the brand on light AND dark shades.
 *
 *   badge         Alpha only: an opaque white mark on full transparency.
 *                 Android draws the badge as a monochrome silhouette cut from
 *                 the ALPHA channel and ignores the colours entirely, so a fully
 *                 opaque image — which every home-screen icon here is — becomes
 *                 a solid filled square in the status bar. That is the "plain
 *                 white box" this asset exists to fix.
 *
 * The tab favicons (apps/web/public/icons/icon-16/32/48.png) are a navy mark on
 * transparency, are not listed in the manifest, and are NOT generated here.
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
const NAVY = [0x08, 0x1c, 0x3a];
const WHITE = [0xff, 0xff, 0xff];

/**
 * The three palettes, one per surface. `field: null` means "no field at all" —
 * the mark is written into the alpha channel over transparency, which is the
 * only form Android's notification badge can read.
 */
const PALETTE = {
  light: { mark: NAVY, field: WHITE },
  navy: { mark: WHITE, field: NAVY },
  alpha: { mark: WHITE, field: null },
};

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
 * The mark is 933×343 — wide and short — so width alone understates how big it
 * reads: at the previous 0.64 the artwork covered under a quarter of the icon's
 * height and looked lost inside its own padding on a home screen. These figures
 * are the largest that keep a comfortable, even margin under each platform's
 * mask, and both preserve the 933:343 aspect ratio — `draw()` derives height
 * from width, so the mark can never stretch.
 *
 * `any` at 0.80 leaves a 10% side margin. The mark's extreme points are the two
 * lower corners of its box, which land at 0.647 of the icon's height — clear of
 * the corner radius iOS's superellipse and Android's squircle cut away.
 *
 * `maskable` stays smaller because Android crops to whatever shape the launcher
 * uses: the guaranteed safe zone is the middle 80%, i.e. a circle of radius
 * 0.4. Those same corners sit at radius (w/2)·√(1+(343/933)²) = 0.533·w from
 * the centre, so the mark fits any mask up to w = 0.751; 0.68 takes most of
 * that headroom and keeps ~10% of margin in hand.
 *
 * `notification` borrows the maskable figure rather than the `any` one: Android
 * crops the large notification icon to a circle, so it faces the same problem a
 * maskable icon does and wants the same margin.
 *
 * `badge` is the largest of the three, because the badge is drawn at 24dp in the
 * status bar — roughly a fifth of a home-screen icon — and anything smaller
 * stops being legible as a shape. 0.72 puts the extreme corners at 0.384 of the
 * width, still inside the 0.4 safe circle.
 */
const MARK_WIDTH = { any: 0.8, maskable: 0.68, notification: 0.68, badge: 0.72 };

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
 * Draw one icon as a pixel buffer — RGB when the palette has a field, RGBA when
 * it does not.
 *
 * Coverage is sampled on a 4×4 grid per pixel and used to blend the mark into
 * the field, which is what keeps the long diagonal clean at 64px instead of
 * stair-stepping. With no field, that same coverage becomes the alpha value, so
 * the transparent variants are anti-aliased identically.
 */
function draw(size, purpose, palette) {
  const { mark, field } = palette;
  const channels = field ? 3 : 4;
  const px = Buffer.alloc(size * size * channels);
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
      const i = (y * size + x) * channels;
      if (field) {
        for (let c = 0; c < 3; c++) {
          px[i + c] = Math.round(field[c] + (mark[c] - field[c]) * coverage);
        }
      } else {
        // Flat mark colour throughout; coverage lands in alpha instead. Blending
        // it into the colour as well would leave a fringe that a monochrome
        // badge mask reads as part of the shape.
        for (let c = 0; c < 3; c++) px[i + c] = mark[c];
        px[i + 3] = Math.round(255 * coverage);
      }
    }
  }
  return { pixels: px, channels };
}

/**
 * Encode a pixel buffer as a PNG — colour type 2 (RGB) for 3 channels, type 6
 * (RGBA) for 4.
 */
function encodePng(pixels, size, channels) {
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
  ihdr[9] = channels === 4 ? 6 : 2; // colour type: RGBA or RGB
  // compression, filter, interlace = 0

  const stride = size * channels;
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
 * Every generated icon. The favicons (16/32/48) are absent deliberately — see
 * the note at the top of this file.
 */
const targets = [
  { file: 'icons/icon-64.png', size: 64, purpose: 'any', palette: 'light' },
  { file: 'icons/icon-128.png', size: 128, purpose: 'any', palette: 'light' },
  { file: 'icons/icon-180.png', size: 180, purpose: 'any', palette: 'light' },
  { file: 'icons/icon-192.png', size: 192, purpose: 'any', palette: 'light' },
  { file: 'icons/icon-256.png', size: 256, purpose: 'any', palette: 'light' },
  { file: 'icons/icon-512.png', size: 512, purpose: 'any', palette: 'light' },
  { file: 'icons/icon-1024.png', size: 1024, purpose: 'any', palette: 'light' },
  { file: 'icons/icon-512-maskable.png', size: 512, purpose: 'maskable', palette: 'light' },
  // iOS reads this one for the home screen. Same art as icon-180, written to
  // the path <link rel="apple-touch-icon"> points at.
  { file: 'apple-touch-icon.png', size: 180, purpose: 'any', palette: 'light' },

  // Web Push. 192 is what Chrome asks for on desktop and Android; 96 is the
  // Android badge size. Both are referenced from apps/web/public/push-sw.js.
  {
    file: 'icons/notification-192.png',
    size: 192,
    purpose: 'notification',
    palette: 'navy',
  },
  { file: 'icons/notification-badge-96.png', size: 96, purpose: 'badge', palette: 'alpha' },
];

for (const target of targets) {
  const { pixels, channels } = draw(target.size, target.purpose, PALETTE[target.palette]);
  const png = encodePng(pixels, target.size, channels);
  writeFileSync(join(webPublic, target.file), png);
  console.log(
    `✓ ${target.file} (${target.size}px, ${target.purpose}, ${target.palette}, ` +
      `${channels === 4 ? 'RGBA' : 'RGB'}, ${png.length} bytes)`,
  );
}
