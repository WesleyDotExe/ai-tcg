// The pack opening's ward rings (render session 60, the ceremony part 2:
// "the card's faction ward sigil flares as it lands"). The single-ring cell
// of each faction's ward sheet (the Rare ward the board already draws:
// sigWardFx.ts), cropped small by tools/pack-wards.mjs and committed under
// assets/wards/pack/. Node-side only: the page builders read them here and
// hand them to renderPackOpeningHtml as data URLs, because packPage.ts is
// also bundled into the website's client and must not touch the file
// system. Neutral has no ward (as on the board).
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets", "wards", "pack");
export const PACK_WARD_FACTIONS: Record<string, string> = { Cortex: "cortex", Aegis: "aegis", Swarm: "swarm", Null: "null" };

let cache: Record<string, string> | null = null;
export function packWardRings(): Record<string, string> {
  if (!cache) {
    cache = {};
    for (const [faction, key] of Object.entries(PACK_WARD_FACTIONS)) {
      cache[faction] = `data:image/webp;base64,${readFileSync(resolve(DIR, `${key}-ring.webp`)).toString("base64")}`;
    }
  }
  return cache;
}
