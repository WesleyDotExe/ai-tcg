// Builds the Season 1 Home, phase 2 (render session 86): mockup B on the
// uniform grid, from the same snapshot of the Season 0 site demo's owner API
// as the mockups (season1/mockup/snapshot.ts).
//   npx tsx season1/mockup/buildHome.ts      (in render/)
// Writes render/season1/output/home.html (self-contained: no outside requests).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homePage } from "../src/homePage.js";
import { agentStatesPage } from "../src/agentStates.js";
import { ladderStatesPage } from "../src/ladderStates.js";
import { storeStatesPage } from "../src/storeStates.js";
import { packsStatesPage } from "../src/packsStates.js";
import { collectionStatesPage } from "../src/collectionStates.js";
import { dailyStatesPage } from "../src/dailyStates.js";
import type { HomeData } from "../src/homeFacts.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "data", "home-data.json"), "utf8")) as HomeData;
const out = join(here, "..", "output", "home.html");
mkdirSync(dirname(out), { recursive: true });
const html = homePage(data);
writeFileSync(out, html);
console.log(`[home] wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);

// The My agent tile in every auto-play state (render session 88).
const states = join(here, "..", "output", "agent-states.html");
const sheet = agentStatesPage(data);
writeFileSync(states, sheet);
console.log(`[home] wrote ${states} (${(sheet.length / 1024).toFixed(0)} KB)`);

// The Ladder tile in every rating state (render session 89).
const ladder = join(here, "..", "output", "ladder-states.html");
const lsheet = ladderStatesPage(data);
writeFileSync(ladder, lsheet);
console.log(`[home] wrote ${ladder} (${(lsheet.length / 1024).toFixed(0)} KB)`);

// The Store tile in every credits and pack-offer state (render session 91).
const store = join(here, "..", "output", "store-states.html");
const ssheet = storeStatesPage(data);
writeFileSync(store, ssheet);
console.log(`[home] wrote ${store} (${(ssheet.length / 1024).toFixed(0)} KB)`);

// The Packs tile in every waiting and pity state (render session 91).
const packs = join(here, "..", "output", "packs-states.html");
const psheet = packsStatesPage(data);
writeFileSync(packs, psheet);
console.log(`[home] wrote ${packs} (${(psheet.length / 1024).toFixed(0)} KB)`);

// The Collection and Daily rewards tiles in every state (render session 93).
for (const [name, page] of [["collection", collectionStatesPage(data)], ["daily", dailyStatesPage(data)]] as const) {
  const f = join(here, "..", "output", `${name}-states.html`);
  writeFileSync(f, page);
  console.log(`[home] wrote ${f} (${(page.length / 1024).toFixed(0)} KB)`);
}
