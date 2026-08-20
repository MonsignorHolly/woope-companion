// Generates placeholder art: colored-dot tray icons (connected/idle/
// disconnected, 1x + 2x) and a circular app icon for electron-builder.
// Hand-rolled PNG encoding (Node's zlib for deflate, no image-processing
// dependency) since these are throwaway placeholders - see README.md for
// where Holly's real assets should replace them.
//
// Re-run with `npm run icons:generate` after tweaking the colors/sizes below.
const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Encodes a flat RGBA byte buffer (top-to-bottom, no padding) as an 8-bit PNG. */
function encodePNG(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + stride);
    raw[rowStart] = 0; // per-scanline filter: none
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function createCanvas(size) {
  return Buffer.alloc(size * size * 4, 0); // transparent
}

function getPixel(pixels, size, x, y) {
  const i = (y * size + x) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
}

function setPixel(pixels, size, x, y, [r, g, b, a]) {
  const i = (y * size + x) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = a;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/** "src over dst" with src's coverage (0-1) as extra alpha - gives a cheap antialiased edge. */
function blendOver(dst, src, coverage) {
  const sa = (src[3] / 255) * coverage;
  const da = dst[3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA === 0) return [0, 0, 0, 0];
  return [
    Math.round((src[0] * sa + dst[0] * da * (1 - sa)) / outA),
    Math.round((src[1] * sa + dst[1] * da * (1 - sa)) / outA),
    Math.round((src[2] * sa + dst[2] * da * (1 - sa)) / outA),
    Math.round(outA * 255),
  ];
}

function fillCircle(pixels, size, cx, cy, radius, [r, g, b]) {
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius + 1));
  const minY = Math.max(0, Math.floor(cy - radius - 1));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius + 1));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const coverage = clamp01(radius + 0.5 - Math.sqrt(dx * dx + dy * dy));
      if (coverage <= 0) continue;
      setPixel(pixels, size, x, y, blendOver(getPixel(pixels, size, x, y), [r, g, b, 255], coverage));
    }
  }
}

const ROOT = path.join(__dirname, "..");
const TRAY_DIR = path.join(ROOT, "assets", "tray");
const BUILD_DIR = path.join(ROOT, "build");
fs.mkdirSync(TRAY_DIR, { recursive: true });
fs.mkdirSync(BUILD_DIR, { recursive: true });

// Discord's own status palette, so the tray dot reads consistently with the
// presence it's reflecting.
const TRAY_COLORS = {
  connected: [67, 181, 129], // green
  idle: [250, 166, 26], // amber
  disconnected: [116, 127, 141], // gray
};

function writeTrayIcon(status, color, size, suffix) {
  const canvas = createCanvas(size);
  fillCircle(canvas, size, size / 2, size / 2, size * 0.34, color);
  const file = path.join(TRAY_DIR, `tray-${status}${suffix}.png`);
  fs.writeFileSync(file, encodePNG(size, size, canvas));
  return file;
}

const written = [];
for (const [status, color] of Object.entries(TRAY_COLORS)) {
  written.push(writeTrayIcon(status, color, 16, "")); // 1x
  written.push(writeTrayIcon(status, color, 32, "@2x")); // 2x, auto-picked up by Electron on HiDPI
}

// App icon: brand-purple disc with a smaller dot, standing in for Holly's
// real Woope Companion logo. 1024x1024 so electron-builder's icon-gen has
// enough source resolution to derive every platform's icon sizes cleanly.
const APP_ICON_SIZE = 1024;
const appIcon = createCanvas(APP_ICON_SIZE);
fillCircle(appIcon, APP_ICON_SIZE, APP_ICON_SIZE / 2, APP_ICON_SIZE / 2, APP_ICON_SIZE * 0.48, [88, 101, 242]);
fillCircle(appIcon, APP_ICON_SIZE, APP_ICON_SIZE / 2, APP_ICON_SIZE / 2, APP_ICON_SIZE * 0.18, [255, 255, 255]);
const appIconFile = path.join(BUILD_DIR, "icon.png");
fs.writeFileSync(appIconFile, encodePNG(APP_ICON_SIZE, APP_ICON_SIZE, appIcon));
written.push(appIconFile);

for (const file of written) console.log("Wrote", path.relative(ROOT, file));
