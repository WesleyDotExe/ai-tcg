// How much one full-collection build swings by its search seed alone
// (session 60, test only). Reads the full-level builds and rings for search
// seed 1 (progress/built-deck-ring-003) and seeds 2-4 (this folder) and
// prints, per mode, each faction's mean over its three edges and each edge,
// per seed, with the range; then each built deck's confirm score and how
// many cards differ from seed 1's deck.
//
//   node progress/full-seed-swing/summarize.mjs > progress/full-seed-swing/report.txt

import { readFileSync } from "node:fs";

const here = new URL(".", import.meta.url);
const dirs = [
  ["1", new URL("../built-deck-ring-003/", here)],
  ["2", new URL("seed-2/", here)],
  ["3", new URL("seed-3/", here)],
  ["4", new URL("seed-4/", here)],
];
const FACTIONS = ["Cortex", "Swarm", "Aegis", "Null"];
const read = (u) => JSON.parse(readFileSync(u, "utf8"));
const pct = (x) => (100 * x).toFixed(1);

const range = (xs) => `${pct(Math.min(...xs)).padStart(5)}-${pct(Math.max(...xs)).padEnd(5)} (${(100 * (Math.max(...xs) - Math.min(...xs))).toFixed(1)})`;

console.log("One full-collection build per faction, the store's settings, search seeds 1-4 (seed 1 is the store's; built-deck-ring-003).");
console.log("Every other input is the same: the collections, the confirm seeds, the ring seeds (2,500 / 900). Rates are the first-named side's.\n");
for (const mode of ["real", "gate"]) {
  const rings = dirs.map(([s, d]) => [s, read(new URL(`rings/full-${mode}.json`, d))]);
  console.log(`== ${mode === "real" ? "REAL-MATCH" : "GATE"} MODE ==`);
  console.log(`${"".padEnd(16)}${dirs.map(([s]) => `seed ${s}`.padStart(8)).join("")}   range (width)`);
  for (const e of rings[0][1].edges) {
    const xs = rings.map(([, r]) => { const x = r.edges.find((y) => y.edge === e.edge); return x.selfWins / x.games; });
    console.log(`${e.edge.padEnd(16)}${xs.map((x) => pct(x).padStart(8)).join("")}   ${range(xs)}`);
  }
  for (const f of FACTIONS) {
    const xs = rings.map(([, r]) => {
      const rates = r.edges.filter((y) => y.edge.includes(f)).map((y) => (y.edge.startsWith(f) ? y.selfWins / y.games : 1 - y.selfWins / y.games));
      return rates.reduce((a, b) => a + b, 0) / rates.length;
    });
    console.log(`${(f + " mean").padEnd(16)}${xs.map((x) => pct(x).padStart(8)).join("")}   ${range(xs)}`);
  }
  console.log("");
}
console.log("== the built decks: confirm score against the four shipped decks, and cards that differ from seed 1's deck ==");
for (const f of FACTIONS) {
  const decks = dirs.map(([s, d]) => [s, read(new URL(`builds/full-${f}.json`, d)).decks[0]]);
  const base = new Map(decks[0][1].list);
  const cells = decks.map(([s, d]) => {
    const l = new Map(d.list);
    let diff = 0;
    for (const id of new Set([...base.keys(), ...l.keys()])) diff += Math.abs((base.get(id) ?? 0) - (l.get(id) ?? 0));
    return `seed ${s} ${pct(d.score.wins / d.score.games)} (${d.chosen}, ${diff / 2} swapped)`;
  });
  console.log(`  ${f.padEnd(7)}${cells.join("   ")}`);
}
