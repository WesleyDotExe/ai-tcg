// Crops the faction ward sheets' single-ring cell (cell 3 of the 2x2 sheet,
// the Rare ward: sigWardFx.ts SIG_CELL) into small files for the pack
// opening's ward flare (render session 60, the ceremony part 2), so the pack
// page embeds four ~20 KB rings instead of four ~110 KB sheets.
//
//   node render/tools/pack-wards.mjs
//
// Reads render/assets/wards/faction/<key>.webp, writes
// render/assets/wards/pack/<key>-ring.webp. Runs in the pre-installed
// headless Chromium (a canvas crop, then the browser's own WebP encoder);
// nothing is fetched. Re-run only when a faction sheet changes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const SIZE = 320;
const KEYS = ["cortex", "aegis", "swarm", "null"];

const browser = await chromium.launch();
const page = await browser.newPage();
mkdirSync(resolve(here, "../assets/wards/pack"), { recursive: true });
for (const key of KEYS) {
  const src = `data:image/webp;base64,${readFileSync(resolve(here, "../assets/wards/faction", `${key}.webp`)).toString("base64")}`;
  const out = await page.evaluate(async ({ src, size }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const cell = img.naturalWidth / 2;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, size, size);
    g.drawImage(img, cell, cell, cell, cell, 0, 0, size, size);
    return { url: c.toDataURL("image/webp", 0.86), cell };
  }, { src, size: SIZE });
  const bytes = Buffer.from(out.url.split(",")[1], "base64");
  writeFileSync(resolve(here, "../assets/wards/pack", `${key}-ring.webp`), bytes);
  console.log(`${key}: cell ${out.cell}px -> ${SIZE}px, ${bytes.length} bytes`);
}
await browser.close();
