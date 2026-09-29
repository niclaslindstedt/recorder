#!/usr/bin/env node
// Generate the PWA install icons and the social-preview image from the same
// geometry as public/icons/icon.svg — a recording dot in a ring, a wave,
// drawn in flat green on the app's dark surface. Pure Node (zlib + a minimal
// PNG encoder), so the pipeline needs no native image dependencies. Rerun
// with `npm run icons` / `make icons` after changing the mark.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
mkdirSync(iconsDir, { recursive: true });

// The install tile's surface (the manifest's background/theme colour, see
// pwa-plugin.ts) and the mark's ink — flat green, the same treatment as the
// sibling apps, so they read as one family on a home screen. Kept in lockstep
// with the fill/stroke colours in public/icons/icon.svg.
//
// Flat is the whole treatment: one ink, painted at full strength wherever the
// mark covers a pixel and not at all where it doesn't. The only intermediate
// values in the output are antialiasing along an edge. No gradient, no bevel,
// no drop shadow — a home screen already lights icons its own way, and a mark
// carrying its own fake light reads as muddy next to one that doesn't.
const BG = [18, 16, 26]; // #12101a
const INK = [62, 240, 127]; // #3ef07f

// --- minimal PNG encoder ----------------------------------------------------

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Pack already-encoded PNG blobs into a single ICONDIR (a .ico file). PNG-
// compressed entries are honoured by every current browser and by Windows
// since Vista, so one .ico carrying 16/32/48 px PNGs is the whole legacy-
// favicon story — the raster fallback for tabs that don't render the SVG mark.
function encodeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // resource type: icon
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = header.length + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const e = dir.subarray(i * 16);
    e[0] = size >= 256 ? 0 : size; // width  (0 encodes 256)
    e[1] = size >= 256 ? 0 : size; // height (0 encodes 256)
    e[2] = 0; // palette size (0 for a true-colour PNG entry)
    e[3] = 0; // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8); // bytes in this entry
    e.writeUInt32LE(offset, 12); // byte offset from the file start
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

// The other .ico, and it exists because a resource compiler is not a browser.
//
// `encodeIco` above packs PNG-compressed entries, which every current browser
// and Windows itself read happily. The Windows RESOURCE COMPILER does not:
// `tauri-build` embeds `icons/icon.ico` into the executable through `llvm-rc`
// (or `rc.exe`), and those parse the classic DIB entry rather than a PNG one —
// so the desktop shell's icon is packed the old way instead.
//
// A DIB entry is a `BITMAPINFOHEADER` whose height is DOUBLED, because the
// format still describes two stacked bitmaps: the bottom-up BGRA colour one,
// and a 1-bit AND mask. The mask is all zeroes (every pixel opaque as far as
// it is concerned) and the alpha channel does the real work, which is what
// every 32-bit icon since Windows XP does. Its rows are still padded to four
// bytes, and a parser that reads the header will read them.
function dibEntry(size, rgba) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight — colour + mask
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount

  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    // Bottom-up: the last row of the image is the first row of the DIB.
    const from = (size - 1 - y) * size * 4;
    for (let x = 0; x < size; x++) {
      const at = from + x * 4;
      const to = (y * size + x) * 4;
      pixels[to] = rgba[at + 2]; // B
      pixels[to + 1] = rgba[at + 1]; // G
      pixels[to + 2] = rgba[at]; // R
      pixels[to + 3] = rgba[at + 3]; // A
    }
  }

  const maskStride = Math.ceil(size / 32) * 4;
  return Buffer.concat([header, pixels, Buffer.alloc(maskStride * size)]);
}

// `opaque` writes RGB with no alpha channel at all — what the App Store wants
// of an app icon, which it refuses if the file carries one, even a fully
// opaque one. It throws rather than flatten a pixel that is not opaque.
function encodePng(width, height, rgba, { opaque = false } = {}) {
  const channels = opaque ? 3 : 4;
  const stride = width * channels + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    if (!opaque) {
      rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
      continue;
    }
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      if (rgba[from + 3] !== 255) {
        throw new Error(`opaque icon has a see-through pixel at ${x},${y}`);
      }
      rgba.copy(raw, y * stride + 1 + x * 3, from, from + 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = opaque ? 2 : 6; // colour type: RGB / RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- the mark ----------------------------------------------------------------

// The mark: a recording dot inside a ring, with a sound wave leaving it to
// the right — two arcs. Analytic, so `inStroke` below is the definition
// rather than a sampling of one: a pixel is on the mark if it lies within
// half a stroke of the ring, inside the dot, or within half a stroke of
// either arc (round caps included). That is what an SVG renderer does with
// public/icons/icon.svg too, which is why the .ico and the .svg agree.
//
// Everything below is unit space — the 100 viewBox divided by 100 — and is
// mirrored into public/icons/icon.svg and src/app/icons.tsx by hand.

/** The ring's centre and radius, and the dot inside it. */
const CX = 0.4;
const CY = 0.5;
const R = 0.27;
const DOT_R = 0.1;
/** Half the stroke width (SVG stroke-width 11 on the 100 viewBox). */
const STROKE_HALF = 0.055;
/** The two arcs of the wave: centred to the right of the ring, each drawn
 *  over a symmetric span of angle about the horizontal, in radians. */
const WAVE_CX = 0.6;
const WAVES = [
  { r: 0.2, span: 0.62 },
  { r: 0.33, span: 0.68 },
];

/** Whether unit-space point (x, y) lands on the mark. */
function inStroke(x, y) {
  const d = Math.hypot(x - CX, y - CY);
  if (Math.abs(d - R) < STROKE_HALF) return true;
  if (d < DOT_R) return true;
  const wx = x - WAVE_CX;
  const wy = y - CY;
  const wd = Math.hypot(wx, wy);
  const angle = Math.atan2(wy, wx);
  for (const { r, span } of WAVES) {
    if (Math.abs(wd - r) >= STROKE_HALF) continue;
    if (Math.abs(angle) <= span) return true;
    // The round caps at each end of the arc.
    for (const end of [span, -span]) {
      const ex = WAVE_CX + r * Math.cos(end);
      const ey = CY + r * Math.sin(end);
      if (Math.hypot(x - ex, y - ey) < STROKE_HALF) return true;
    }
  }
  return false;
}

// Render size×size RGBA. `pad` insets the mark (maskable icons need a safe
// zone); `radius` rounds the background corners (0 = square, for maskable).
// The default is deliberately tight — the mark is drawn to fill its tile, and
// the padding an install icon needs is the launcher's margin, not a second one
// on top of it.
function renderIconRgba(size, { pad = 0.08, radius = 0.2 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const r = radius * size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;
      // Rounded-rect background coverage, as the signed distance from the
      // pixel's centre to the tile's edge: negative inside, positive outside,
      // so half a pixel either side of zero is the antialiased rim. The
      // `min(max(qx, qy), 0)` term is what makes it hold up in the middle of
      // the tile as well as at a corner — without it the interior distance
      // collapses to −r, which is fine while the corners are round and puts
      // the *whole* square tile on 50% alpha the moment `radius` is 0.
      const half = size / 2;
      const qx = Math.abs(px + 0.5 - half) - (half - r);
      const qy = Math.abs(py + 0.5 - half) - (half - r);
      const outside =
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
        Math.min(Math.max(qx, qy), 0) -
        r;
      const bgAlpha = Math.max(0, Math.min(1, 0.5 - outside));
      // Mark coverage in padded unit space, 3×3 supersampled so the ring's
      // curve and the arrowhead's edges stay smooth at every size.
      let hit = 0;
      for (const oy of [1 / 6, 0.5, 5 / 6]) {
        for (const ox of [1 / 6, 0.5, 5 / 6]) {
          const sx = ((px + ox) / size - pad) / (1 - 2 * pad);
          const sy = ((py + oy) / size - pad) / (1 - 2 * pad);
          if (inStroke(sx, sy)) hit += 1 / 9;
        }
      }
      const [br, bg2, bb] = BG;
      const [fr, fg2, fb] = INK;
      rgba[i] = Math.round(br + (fr - br) * hit);
      rgba[i + 1] = Math.round(bg2 + (fg2 - bg2) * hit);
      rgba[i + 2] = Math.round(bb + (fb - bb) * hit);
      rgba[i + 3] = Math.round(bgAlpha * 255);
    }
  }
  return rgba;
}

/** The same mark, encoded as a PNG. The desktop `.ico` below needs the raw
 *  pixels instead. */
function renderIcon(size, options = {}) {
  return encodePng(size, size, renderIconRgba(size, options), {
    opaque: options.opaque,
  });
}

// The 1200×630 Open Graph card: the mark on the left, a week of hour columns
// on the right against a target line — the app's whole idea in one glance.
function renderOg() {
  const w = 1200;
  const h = 630;
  const rgba = Buffer.alloc(w * h * 4);
  const markSize = 440;
  const markX = 110;
  const markY = (h - markSize) / 2;

  // Seven columns, hours worked as a share of the target; the sixth and
  // seventh are a weekend. The dashed line is the eight-hour target.
  const COL = 56;
  const GAP = 22;
  const chartX = 660;
  const baseY = 470;
  const maxH = 300;
  const hours = [0.98, 1.1, 0.85, 1.02, 0.7, 0.25, 0];

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      let [cr, cg, cb] = BG;

      if (
        px >= markX &&
        px < markX + markSize &&
        py >= markY &&
        py < markY + markSize
      ) {
        const sx = (px - markX) / markSize;
        const sy = (py - markY) / markSize;
        if (inStroke(sx, sy)) [cr, cg, cb] = INK;
      }

      const col = Math.floor((px - chartX) / (COL + GAP));
      const inCol = px - chartX - col * (COL + GAP) < COL;
      let alpha = 0;
      if (col >= 0 && col < 7 && inCol) {
        const top = baseY - hours[col] * maxH;
        if (py <= baseY && py >= top) alpha = col < 5 ? 1 : 0.45;
      }
      // The target line, dashed.
      const targetY = baseY - maxH;
      if (
        px >= chartX &&
        px < chartX + 7 * (COL + GAP) - GAP &&
        Math.abs(py - targetY) < 2 &&
        Math.floor((px - chartX) / 14) % 2 === 0
      ) {
        alpha = Math.max(alpha, 0.6);
      }
      if (alpha > 0) {
        cr = Math.round(BG[0] + (INK[0] - BG[0]) * alpha);
        cg = Math.round(BG[1] + (INK[1] - BG[1]) * alpha);
        cb = Math.round(BG[2] + (INK[2] - BG[2]) * alpha);
      }

      rgba[i] = cr;
      rgba[i + 1] = cg;
      rgba[i + 2] = cb;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(w, h, rgba);
}

writeFileSync(join(iconsDir, "pwa-192.png"), renderIcon(192));
writeFileSync(join(iconsDir, "pwa-512.png"), renderIcon(512));
writeFileSync(
  join(iconsDir, "pwa-512-maskable.png"),
  // The maskable safe zone is the centre circle of 80% diameter, i.e. radius
  // 0.4. The mark's furthest ink from centre — the ring's outer edge — sits
  // at radius 0.4 of the padded square, so this inset puts it at 0.304 and
  // the launcher can crop to any shape it likes without clipping the ring.
  renderIcon(512, { pad: 0.12, radius: 0 }),
);
writeFileSync(
  join(iconsDir, "apple-touch-icon-180.png"),
  renderIcon(180, { pad: 0.1, radius: 0 }),
);
writeFileSync(join(root, "public", "og.png"), renderOg());

// The native wrapper's assets (native/assets), cut from the same mark so the
// app on a home screen and the PWA on a home screen are one product rather
// than two that resemble each other. Written here rather than kept as a
// separate set of files precisely so they cannot drift.
//   icon          — iOS wants a square, fully opaque icon and applies its own
//                   mask, so the tile is not pre-rounded, and it is written
//                   with no alpha channel at all.
//   adaptive-icon — Android masks the foreground to whatever shape the
//                   launcher uses, so the mark is inset to the safe zone and
//                   the tile runs to the edges (app.config.js paints the same
//                   ink behind it).
//   splash-icon   — the launch screen's mark, so this one keeps its rounded
//                   corners.
const nativeAssets = join(root, "native", "assets");
mkdirSync(nativeAssets, { recursive: true });
writeFileSync(
  join(nativeAssets, "icon.png"),
  renderIcon(1024, { radius: 0, opaque: true }),
);
writeFileSync(
  join(nativeAssets, "adaptive-icon.png"),
  renderIcon(1024, { pad: 0.18, radius: 0 }),
);
writeFileSync(join(nativeAssets, "splash-icon.png"), renderIcon(512));

// favicon.ico — the browser-tab fallback for engines that ignore the SVG
// favicon (Safari, search crawlers) and for the implicit /favicon.ico request.
// Packs the mark at the three classic tab sizes; a hair less padding than the
// install icons, because a tab favicon is drawn small and unrounded and every
// pixel spent on margin is one not spent on the ring. Lives at the public
// root so it deploys as `<base>favicon.ico` (see pwa-plugin.ts link tag).
writeFileSync(
  join(root, "public", "favicon.ico"),
  encodeIco(
    [16, 32, 48].map((size) => ({
      size,
      data: renderIcon(size, { pad: 0.06 }),
    })),
  ),
);
console.log(
  "icons: wrote pwa-192/512/512-maskable, apple-touch-180, og.png, favicon.ico, " +
    "native icon/adaptive-icon/splash-icon",
);

// The DESKTOP SHELL's icons (tauri/src-tauri/icons/), from the same geometry
// and the same ink as everything above — so the app in the dock, the tile on
// the home screen and the favicon in the tab are one mark rather than three
// that resemble each other.
//
// Two things make this a separate set rather than a reference to `public/`:
//
//   - **Tauri refuses a paletted PNG at COMPILE time**, inside
//     `generate_context!`, with `icon … is not RGBA`. These are RGBA (colour
//     type 6, see `encodePng`), so that is satisfied by construction here —
//     but it is why the sizes are re-rendered rather than symlinked to
//     whichever file happened to be the right shape.
//   - **`tauri-build` refuses a MISSING `icon.ico` outright** on a Windows
//     target ("required for generating a Windows Resource file"), and it must
//     be the DIB flavour a resource compiler can read — see `encodeIcoDib`.
//
// `radius: 0` throughout: every desktop draws its own mask over an app icon
// (macOS its squircle, Windows its square), so a tile that rounded its own
// corners first would sit inside a second rounding.
const tauriIconsDir = join(root, "tauri", "src-tauri", "icons");
mkdirSync(tauriIconsDir, { recursive: true });
const TAURI_SIZES = [32, 128, 256, 512];
for (const size of TAURI_SIZES) {
  writeFileSync(
    join(tauriIconsDir, `${size}x${size}.png`),
    renderIcon(size, { pad: 0.12, radius: 0 }),
  );
}
// Windows' own ladder: 16 and 32 are the ones actually drawn (the title bar,
// the taskbar, Explorer's small views), 48 is the shell's medium icon, and 256
// is what a large-icon view scales from. The three small ones are bitmaps and
// 256 is a PNG, which is the layout every Windows icon has worn since Vista —
// a 256 bitmap would be a quarter-megabyte of uncompressed BGRA in a file the
// repository carries, for the one size the format was extended to compress.
writeFileSync(
  join(tauriIconsDir, "icon.ico"),
  encodeIco([
    ...[16, 32, 48].map((size) => ({
      size,
      data: dibEntry(size, renderIconRgba(size, { pad: 0.08, radius: 0 })),
    })),
    { size: 256, data: renderIcon(256, { pad: 0.08, radius: 0 }) },
  ]),
);
console.log(`icons: wrote ${TAURI_SIZES.length} desktop icons + icon.ico`);
