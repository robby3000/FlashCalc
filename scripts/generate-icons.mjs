import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const ICONS_DIR = join(process.cwd(), 'icons');
mkdirSync(ICONS_DIR, { recursive: true });

// CRC-32 implementation for standard PNG chunks
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const body = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([lenBuf, body, crcBuf]);
}

/**
 * Encode an RGBA Buffer (width x height x 4 bytes) to PNG format.
 */
function encodePNG(width, height, rgbaBuffer) {
  const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth: 8
  ihdr[9] = 6;  // color type: 6 (RGBA)
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: 0 (adaptive/standard)
  ihdr[12] = 0; // interlace: 0

  // Uncompressed scanlines: each row starts with filter byte 0 (None)
  const rowLength = width * 4;
  const rawScanlines = Buffer.alloc(height * (1 + rowLength));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + rowLength);
    rawScanlines[rowOffset] = 0; // filter byte: None
    rgbaBuffer.copy(rawScanlines, rowOffset + 1, y * rowLength, (y + 1) * rowLength);
  }

  const compressed = deflateSync(rawScanlines, { level: 9 });
  const idat = createChunk('IDAT', compressed);
  const ihdrChunk = createChunk('IHDR', ihdr);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([PNG_HEADER, ihdrChunk, idat, iendChunk]);
}

// Lightning bolt polygon in 24x24 viewport
// M13 2 3.5 13.5H10l-1.5 8.5L20.5 10.5H14L13 2Z
const BOLT_POLY = [
  [13, 2],
  [3.5, 13.5],
  [10, 13.5],
  [8.5, 22],
  [20.5, 10.5],
  [14, 10.5],
];

// Point in polygon test using ray casting
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance to rounded rectangle (for corner clipping)
function distToRoundRect(x, y, w, h, r) {
  const dx = Math.max(0, Math.abs(x - w / 2) - (w / 2 - r));
  const dy = Math.max(0, Math.abs(y - h / 2) - (h / 2 - r));
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist - r;
}

// Linear color interpolation
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Generate icon RGBA buffer
 */
function renderIcon({ size, boltScale = 0.6, isMaskable = false, isRounded = true, cornerRadiusRatio = 0.22 }) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = isRounded ? size * cornerRadiusRatio : 0;

  // Gradient colors: #e09a14 (224, 154, 20) to #c48200 (196, 130, 0)
  // Angle: 145deg (from top-left towards bottom-right)
  const c1 = [224, 154, 20];
  const c2 = [196, 130, 0];
  const darkColor = [10, 10, 13]; // #0a0a0d

  // Transform matrix for bolt
  // Bolt SVG viewBox: 24x24. Center is at (12, 12).
  const targetBoltSize = size * boltScale;
  const scale = targetBoltSize / 24;
  const offsetX = (size - 24 * scale) / 2;
  const offsetY = (size - 24 * scale) / 2;

  // Subsampling for antialiasing
  const SAMPLES = 4; // 4x4 grid = 16 subpixel samples
  const step = 1 / SAMPLES;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgCoverage = 0;
      let boltCoverage = 0;

      for (let sy = 0; sy < SAMPLES; sy++) {
        const py = y + (sy + 0.5) * step;
        for (let sx = 0; sx < SAMPLES; sx++) {
          const px = x + (sx + 0.5) * step;

          // Check if inside rounded rectangle
          let inBg = true;
          if (isRounded) {
            const d = distToRoundRect(px, py, size, size, radius);
            inBg = d <= 0;
          }
          if (inBg) {
            bgCoverage++;

            // Check if inside bolt
            const bx = (px - offsetX) / scale;
            const by = (py - offsetY) / scale;
            if (bx >= 0 && bx <= 24 && by >= 0 && by <= 24) {
              if (pointInPoly(bx, by, BOLT_POLY)) {
                boltCoverage++;
              }
            }
          }
        }
      }

      const totalSamples = SAMPLES * SAMPLES;
      const alphaBg = bgCoverage / totalSamples;
      const alphaBolt = boltCoverage / totalSamples;

      if (alphaBg <= 0) {
        // Transparent pixel
        const idx = (y * size + x) * 4;
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        continue;
      }

      // Compute gradient t (145 degrees)
      // Angle theta in radians: 145° = 2.53 rad
      const rad = 145 * Math.PI / 180;
      const nx = Math.cos(rad);
      const ny = Math.sin(rad);
      // Project (x - center, y - center) along gradient vector
      const cx = (x + 0.5) - size / 2;
      const cy = (y + 0.5) - size / 2;
      const maxProj = (size / 2) * (Math.abs(nx) + Math.abs(ny));
      const proj = cx * nx + cy * ny;
      let t = (proj + maxProj) / (2 * maxProj);
      t = Math.max(0, Math.min(1, t));

      const rBg = lerp(c1[0], c2[0], t);
      const gBg = lerp(c1[1], c2[1], t);
      const bBg = lerp(c1[2], c2[2], t);

      // Composite bolt on top of background
      const boltFrac = alphaBolt / alphaBg; // relative to background
      const rFinal = lerp(rBg, darkColor[0], boltFrac);
      const gFinal = lerp(gBg, darkColor[1], boltFrac);
      const bFinal = lerp(bBg, darkColor[2], boltFrac);

      const idx = (y * size + x) * 4;
      buf[idx] = Math.round(rFinal);
      buf[idx + 1] = Math.round(gFinal);
      buf[idx + 2] = Math.round(bFinal);
      buf[idx + 3] = Math.round(alphaBg * 255);
    }
  }

  return encodePNG(size, size, buf);
}

// Generate all target icons
const configs = [
  { name: 'icon-192.png', size: 192, boltScale: 0.55, isRounded: true, cornerRadiusRatio: 0.22 },
  { name: 'icon-512.png', size: 512, boltScale: 0.55, isRounded: true, cornerRadiusRatio: 0.22 },
  { name: 'icon-512-maskable.png', size: 512, boltScale: 0.52, isRounded: false }, // safe zone ~80%
  { name: 'favicon-32.png', size: 32, boltScale: 0.65, isRounded: true, cornerRadiusRatio: 0.25 },
  { name: 'apple-touch-icon.png', size: 180, boltScale: 0.55, isRounded: false }, // iOS applies rounded mask
];

console.log('Generating PWA icons (zero-dependency zlib PNG)...');
for (const config of configs) {
  const png = renderIcon(config);
  const outPath = join(ICONS_DIR, config.name);
  writeFileSync(outPath, png);
  console.log(`  ✓ ${config.name} (${config.size}x${config.size}, ${png.length} bytes)`);
}
console.log('Icons generated successfully.');
