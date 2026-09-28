// Null consistency trim (owner-feedback 2026-09-26, "session 21
// confirmations" item 1 and "session 22 confirmations" item 2): trim Null's
// 40-card deck back toward ~36 by cutting its measured-weakest filler. The
// owner sanctioned consistency/density as the way to lift Null; stronger
// individual card stats are ruled out. This script picks the cuts from
// measurements, not from the per-card win-rate table (that table is
// confounded by when a card gets drawn and played).
//
// Method:
//   1. Ablation: for every card, drop one copy (40 -> 39) and measure Null's
//      mean Lookahead win rate over its three edges on the search seeds.
//   2. Greedy: remove the single copy whose removal helps most, re-measure
//      every candidate from the new deck, repeat until TARGET_SIZE. Each
//      step is re-measured from scratch because cuts interact.
//   3. Held-out check: baseline vs the chosen deck on seeds the search never
//      saw, with a Newcombe interval on each edge's change.
// Every candidate deck goes through buildDeck, so the pool lint and copy
// limits apply to each one.
//
// Constraints (both on by default, --unconstrained turns them off):
//   - Kernel Panic is never cut. The owner's reason for this trim includes
//     raising Kernel Panic's visibility (a signature arc showing in ~12% of
//     matches is too thin), and an unconstrained run does cut a copy of it.
//   - Every card keeps at least one copy. This is a density trim, not a
//     removal of the mechanics session 21's variety pass added.
//
// Usage: npx tsx src/dev/nullTrimSearch.ts [searchSeeds=900] [heldOutSeeds=1800] [targetSize=36] [--unconstrained | --allow-singleton-cuts]

import { NULL_CARDS } from "../data/nullCards.js";
import { buildDeck } from "../data/decks.js";
import { measureEdges, newcombeDiff, type Pool } from "./edgeMeasure.js";

const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SEARCH_SEEDS = Number(args[0] ?? 900);
const HELD_OUT_SEEDS = Number(args[1] ?? 1800);
const TARGET_SIZE = Number(args[2] ?? 36);
const CONSTRAINED = !flags.includes("--unconstrained");
const PROTECTED = new Set(CONSTRAINED ? ["Kernel Panic"] : []);
const MIN_COPIES = CONSTRAINED && !flags.includes("--allow-singleton-cuts") ? 1 : 0;
const HELD_OUT_FIRST = SEARCH_SEEDS + 1;

function size(pool: Pool): number {
  return pool.reduce((n, p) => n + p.copies, 0);
}

function minusOne(pool: Pool, name: string): Pool {
  return pool.map((p) => (p.card.name === name ? { ...p, copies: p.copies - 1 } : p)).filter((p) => p.copies > 0);
}

function legal(pool: Pool): boolean {
  try {
    buildDeck("p1", "Null Deck", pool);
    return true;
  } catch {
    return false;
  }
}

async function meanRate(pool: Pool, first: number, count: number): Promise<{ mean: number; rates: number[] }> {
  const rs = await measureEdges("Null", first, count, { pool });
  const rates = rs.map((r) => r.selfWins / r.games);
  return { mean: rates.reduce((a, b) => a + b, 0) / rates.length, rates };
}

const pct = (x: number) => (x * 100).toFixed(1);

// The search starts from the pre-trim 40-card deck, rebuilt in the same card
// order (order drives the shuffle, so this reproduces the original numbers).
const PRE_TRIM_COPIES: Record<string, number> = { "Decay Ward": 2, "Fork Bomb": 3, "Null Shell": 3 };
const PRE_TRIM: Pool = NULL_CARDS.map((p) => ({ ...p, copies: PRE_TRIM_COPIES[p.card.name] ?? p.copies }));
let pool: Pool = PRE_TRIM.map((p) => ({ ...p }));
const base = await meanRate(pool, 1, SEARCH_SEEDS);
console.log(
  !CONSTRAINED
    ? "Unconstrained search."
    : `Constrained: Kernel Panic protected${MIN_COPIES ? ", every card keeps >= 1 copy" : ", single-copy cards may be cut"}.`,
);
console.log(`Search seeds 1-${SEARCH_SEEDS}. Baseline (${size(pool)} cards): mean ${pct(base.mean)} ` +
  `[Cortex ${pct(base.rates[0]!)} / Swarm ${pct(base.rates[1]!)} / Aegis ${pct(base.rates[2]!)}]`);

let current = base;
let step = 0;
while (size(pool) > TARGET_SIZE) {
  step++;
  const scored: { name: string; mean: number; rates: number[] }[] = [];
  for (const { card, copies } of pool) {
    if (PROTECTED.has(card.name) || copies <= MIN_COPIES) continue;
    const cand = minusOne(pool, card.name);
    if (!legal(cand)) {
      console.log(`    (cutting ${card.name} breaks buildDeck; skipped)`);
      continue;
    }
    const r = await meanRate(cand, 1, SEARCH_SEEDS);
    scored.push({ name: card.name, ...r });
  }
  scored.sort((a, b) => b.mean - a.mean);
  console.log(`\nStep ${step} (${size(pool)} -> ${size(pool) - 1}), from mean ${pct(current.mean)}:`);
  for (const s of scored) {
    console.log(`  -1 ${s.name.padEnd(22)} mean ${pct(s.mean)} (${s.mean >= current.mean ? "+" : ""}${pct(s.mean - current.mean)}) ` +
      `[${s.rates.map(pct).join(" / ")}]`);
  }
  const best = scored[0]!;
  console.log(`  => cut one ${best.name}`);
  pool = minusOne(pool, best.name);
  current = { mean: best.mean, rates: best.rates };
}

console.log(`\nChosen deck (${size(pool)} cards):`);
for (const p of pool) {
  const was = PRE_TRIM.find((q) => q.card.name === p.card.name)!.copies;
  console.log(`  ${p.card.name.padEnd(22)} x${p.copies}${was !== p.copies ? `  (was x${was})` : ""}`);
}

console.log(`\nHeld-out seeds ${HELD_OUT_FIRST}-${HELD_OUT_FIRST + HELD_OUT_SEEDS - 1} (never used by the search):`);
const before = await measureEdges("Null", HELD_OUT_FIRST, HELD_OUT_SEEDS, { pool: PRE_TRIM });
const after = await measureEdges("Null", HELD_OUT_FIRST, HELD_OUT_SEEDS, { pool, trackCard: "Kernel Panic" });
const beforeKp = await measureEdges("Null", HELD_OUT_FIRST, HELD_OUT_SEEDS, { pool: PRE_TRIM, trackCard: "Kernel Panic" });
for (let i = 0; i < before.length; i++) {
  const b = before[i]!;
  const a = after[i]!;
  const d = newcombeDiff(a.selfWins, a.games, b.selfWins, b.games);
  console.log(`  Null vs ${b.opponent.padEnd(6)} ${pct(b.selfWins / b.games)} -> ${pct(a.selfWins / a.games)}  ` +
    `change ${d.diff >= 0 ? "+" : ""}${pct(d.diff)} (95% CI ${pct(d.lo)} to ${pct(d.hi)})`);
}
const kp = (rs: typeof after) => rs.reduce((n, r) => n + r.trackedPlays, 0) / rs.reduce((n, r) => n + r.games, 0);
console.log(`  Kernel Panic played in ${pct(kp(beforeKp))}% -> ${pct(kp(after))}% of Null's games`);
