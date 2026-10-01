// Companion to nullCardPlayCheck.ts (owner-feedback 2026-10-01 item 4): what
// does each of Null's four removal/debuff cards contribute? For each one, the
// shipped Null deck minus one copy of it (39 cards, legal) plays every other
// shipped deck; a positive delta means Null wins MORE without the card. Run
// on the agent before and after the session-25 fixes, this separates "the
// card is weak" from "the agent played it badly": a card whose cut stops
// helping once the agent plays it properly was an instrument problem.
//
// Usage: npx tsx src/dev/nullCardAblation.ts [firstSeed=1] [count=2500]

import { measureEdges, newcombeDiff, shippedPool } from "./edgeMeasure.js";

const firstSeed = Number(process.argv[2] ?? 1);
const count = Number(process.argv[3] ?? 2500);
const CARDS = ["Bit Rot", "Null Pointer", "Watchdog Timer", "Decay Ward"];
const pct = (x: number) => (x * 100).toFixed(1);

const total = (rs: Awaited<ReturnType<typeof measureEdges>>) => ({
  wins: rs.reduce((a, r) => a + r.selfWins, 0),
  games: rs.reduce((a, r) => a + r.games, 0),
  per: rs.map((r) => `${r.opponent} ${pct(r.selfWins / r.games)}`).join(", "),
});

const base = total(await measureEdges("Null", firstSeed, count));
console.log(`Null card ablation, LookaheadAgent, seeds ${firstSeed}-${firstSeed + count - 1}, ${base.games} games per deck`);
console.log(`  shipped deck: Null ${pct(base.wins / base.games)}%  (${base.per})`);
for (const name of CARDS) {
  const pool = shippedPool("Null")
    .map((p) => (p.card.name === name ? { ...p, copies: p.copies - 1 } : p))
    .filter((p) => p.copies > 0);
  let r;
  try {
    r = total(await measureEdges("Null", firstSeed, count, { pool }));
  } catch (e) {
    // At 36 cards Null sits on the 25% removal cap, so cutting a
    // non-removal copy is not a legal deck.
    console.log(`  -1 ${name.padEnd(15)}: not a legal deck (${(e as Error).message.split("\n")[1]?.trim()})`);
    continue;
  }
  const d = newcombeDiff(r.wins, r.games, base.wins, base.games);
  console.log(`  -1 ${name.padEnd(15)}: Null ${pct(r.wins / r.games)}%  delta ${d.diff >= 0 ? "+" : ""}${pct(d.diff)} [${pct(d.lo)}, ${pct(d.hi)}]  (${r.per})`);
}
