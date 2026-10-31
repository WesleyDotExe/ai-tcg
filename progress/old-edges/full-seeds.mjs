// NA12's full-collection column against the shipped game's, search seeds 1-3
// (session 61). Session 60 showed one full build swings a faction's mean 4-6
// points by search seed alone, so the full column is read as the mean of
// three seeds here. Shipped: progress/built-deck-ring-003 (seed 1) and
// progress/full-seed-swing/seed-2, seed-3. NA12: built-NA12 and
// built-NA12-seed-2, -seed-3 (this folder).
//
//   node progress/old-edges/full-seeds.mjs > progress/old-edges/full-seeds.txt
import { readFileSync } from "node:fs";
const here = new URL(".", import.meta.url);
const sets = {
  shipped: ["../built-deck-ring-003/", "../full-seed-swing/seed-2/", "../full-seed-swing/seed-3/"],
  NA12: ["built-NA12/", "built-NA12-seed-2/", "built-NA12-seed-3/"],
};
const FACTIONS = ["Cortex", "Swarm", "Aegis", "Null"];
const pct = (x) => (100 * x).toFixed(1);
const read = (d, mode) => JSON.parse(readFileSync(new URL(`${d}rings/full-${mode}.json`, here), "utf8"));
console.log("Full-collection column, search seeds 1-3, shipped vs NA12 (rates are the first-named side's; mean = 3 seeds).");
for (const mode of ["real", "gate"]) {
  console.log(`\n== ${mode === "real" ? "REAL-MATCH" : "GATE"} MODE ==`);
  console.log(`${"".padEnd(16)}${"shipped s1  s2  s3".padStart(22)}  mean   ${"NA12 s1  s2  s3".padStart(19)}  mean   change`);
  const rings = Object.fromEntries(Object.entries(sets).map(([k, ds]) => [k, ds.map((d) => read(d, mode))]));
  const rows = [
    ...rings.shipped[0].edges.map((e) => [e.edge, (r) => { const x = r.edges.find((y) => y.edge === e.edge); return x.selfWins / x.games; }]),
    ...FACTIONS.map((f) => [`${f} mean`, (r) => {
      const rates = r.edges.filter((y) => y.edge.includes(f)).map((y) => (y.edge.startsWith(f) ? y.selfWins / y.games : 1 - y.selfWins / y.games));
      return rates.reduce((a, b) => a + b, 0) / rates.length;
    }]),
  ];
  for (const [name, fn] of rows) {
    const s = rings.shipped.map(fn), n = rings.NA12.map(fn);
    const ms = s.reduce((a, b) => a + b) / 3, mn = n.reduce((a, b) => a + b) / 3;
    console.log(`${name.padEnd(16)}${s.map((x) => pct(x).padStart(6)).join("")}   ${pct(ms).padStart(5)}   ${n.map((x) => pct(x).padStart(6)).join("")}   ${pct(mn).padStart(5)}   ${(mn - ms >= 0 ? "+" : "") + pct(mn - ms)}`);
  }
}
