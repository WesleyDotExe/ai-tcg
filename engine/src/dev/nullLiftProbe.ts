// Phase 5 gate (session 26): a measured menu for the "targeted Null lift"
// the owner reserved as a gate-time decision (owner-feedback 2026-10-02
// item 2). Nothing here ships. For every Null unit in the shipped deck, it
// builds two variants, that card at +1 attack and that card at +1 health
// (every copy, nothing else changed, all 20 mechanics kept), and measures
// Null's three edges against the shipped Cortex/Swarm/Aegis decks. Each line
// shows the change in Null's pooled rate with its Newcombe interval and the
// per-edge rates, so the owner can pick a lift by what it does to the ring,
// not by guesswork. Screen on one seed range, confirm the leaders on a
// held-out one (`--only=Name+atk,Name+hp`).
//
// Usage: npx tsx src/dev/nullLiftProbe.ts [firstSeed=1] [count=2500] [--only=Card+atk,Card+hp]

import { measureEdges, newcombeDiff, shippedPool } from "./edgeMeasure.js";
import type { Pool } from "./edgeMeasure.js";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length).split(",");
const firstSeed = Number(args[0] ?? 1);
const count = Number(args[1] ?? 2500);
const pct = (x: number) => (x * 100).toFixed(1);

const total = (rs: Awaited<ReturnType<typeof measureEdges>>) => ({
  wins: rs.reduce((a, r) => a + r.selfWins, 0),
  games: rs.reduce((a, r) => a + r.games, 0),
  per: rs.map((r) => `${r.opponent} ${pct(r.selfWins / r.games)}`).join(", "),
});

const base = total(await measureEdges("Null", firstSeed, count));
console.log(`Null lift probe, LookaheadAgent, seeds ${firstSeed}-${firstSeed + count - 1}, ${base.games} games per variant`);
console.log(`  shipped Null: ${pct(base.wins / base.games)}%  (${base.per})`);

const rows: { label: string; diff: number; line: string }[] = [];
for (const entry of shippedPool("Null")) {
  const card = entry.card;
  if (card.type !== "Unit") continue;
  for (const stat of ["atk", "hp"] as const) {
    const label = `${card.name}+${stat}`;
    if (only && !only.includes(label)) continue;
    const lifted = stat === "atk" ? { ...card, attack: card.attack + 1 } : { ...card, health: card.health + 1 };
    const pool: Pool = shippedPool("Null").map((p) => (p.card.name === card.name ? { ...p, card: lifted } : p));
    const r = total(await measureEdges("Null", firstSeed, count, { pool }));
    const d = newcombeDiff(r.wins, r.games, base.wins, base.games);
    const stats = stat === "atk" ? `${card.attack + 1}/${card.health}` : `${card.attack}/${card.health + 1}`;
    const line =
      `  ${label.padEnd(26)} x${entry.copies} cost ${card.cost} -> ${stats.padEnd(5)}: Null ${pct(r.wins / r.games)}%  ` +
      `change ${d.diff >= 0 ? "+" : ""}${pct(d.diff)} [${pct(d.lo)}, ${pct(d.hi)}]  (${r.per})`;
    rows.push({ label, diff: d.diff, line });
    console.log(line);
  }
}
console.log("\nSorted by change in Null's pooled rate:");
for (const row of rows.sort((a, b) => b.diff - a.diff)) console.log(row.line);
