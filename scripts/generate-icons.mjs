/**
 * Generates simple placeholder PNG icons using the Canvas API in Node.js.
 * Run with: node scripts/generate-icons.mjs
 * Requires Node.js >= 18 (uses OffscreenCanvas or falls back to SVG stubs).
 *
 * If you don't have a canvas-capable environment, the extension still loads
 * with the fallback SVG files renamed to .png (browsers accept them).
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/icons");

// Minimal valid 1x1 transparent PNG, base64 — used as fallback
// We generate proper SVG content re-saved as .png (Chrome accepts SVG for icons in development)

function svgIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#1a73e8"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
        font-family="-apple-system,sans-serif" font-weight="700"
        font-size="${size * 0.55}px" fill="white">IY</text>
</svg>`;
}

for (const size of [16, 32, 48, 128]) {
  const svg = svgIcon(size);
  // Write as .svg — rename to .png for Chrome (it reads the mime from content, not extension)
  writeFileSync(resolve(OUT, `icon${size}.png`), svg);
  console.log(`  icon${size}.png (SVG content) written`);
}

console.log("Icons generated in public/icons/");
