// Neutral package search (Phase 5 step (ii), owner-feedback 2026-09-20 item
// 10 and 2026-09-26 "revised Phase 5 order"): choose, for one faction, which
// neutral cards its shipped deck runs, from measurements rather than taste.
//
// Objective: the ring. For each of the faction's three edges, the distance
// from its LookaheadAgent win rate to the owner's band (0 inside the band),
// squared and summed. A swap that moves the faction's edges toward their
// bands lowers it. Two guards keep that honest:
//   - no sandbagging: a swap may not lower the faction's own mean win rate
//     by more than MAX_MEAN_DROP on the search seeds. A deck gets closer to
//     its bands by picking cards that shift its matchups, not by filling
//     slots with blanks;
//   - held-out check: the chosen package is re-measured against the shipped
//     deck on seeds the search never saw, with a Newcombe interval per edge.
//
// Method:
//   1. Ablation: replace one copy of each faction card with a plain neutral
//      body (Commodity Rack, a vanilla 3/3) and score the objective. A bare
//      removal would do, except that it breaks the 25% removal cap for a
//      deck sitting on it (Null), so the probe keeps the deck size. The
//      CUT_POOL copies whose loss costs least are the swap-out options.
//      Every faction card keeps at least one copy (no mechanic is removed).
//      Never cut: Kernel Panic (owner-feedback 2026-09-26), and Null's four
//      removal/debuff/turn-trigger cards, which the owner ruled out of any
//      further cut until "weak card" is separated from "agent misplays it"
//      (owner-feedback 2026-09-29, item 1).
//   2. Greedy: every (cut option, neutral card) swap is measured; the best
//      one that improves the objective and passes the guard is taken. Repeat
//      up to MAX_SWAPS times, re-measuring from the new deck each step.
//   3. Held-out seeds: shipped deck vs chosen deck.
// Opponents always play their shipped decks. Every candidate goes through
// buildDeck, so copy limits, the pool lint and the neutral cap all apply.
//
// Usage: npx tsx src/dev/neutralPackageSearch.ts <Faction> [searchSeeds=900] [heldOutSeeds=2500] [maxSwaps=4]

import { buildDeck } from "../data/decks.js";
import { NEUTRAL_POOL } from "../data/neutralCards.js";
import { FACTIONS, measureEdges, newcombeDiff, ringBand, shippedPool, type Pool } from "./edgeMeasure.js";
import type { DeckFaction } from "../cards/types.js";

const faction = process.argv[2] as DeckFaction;
if (!FACTIONS.includes(faction)) {
  console.error(`Usage: neutralPackageSearch.ts <${FACTIONS.join("|")}> [searchSeeds] [heldOutSeeds] [maxSwaps]`);
  process.exit(1);
}
const SEARCH_SEEDS = Number(process.argv[3] ?? 900);
const HELD_OUT_SEEDS = Number(process.argv[4] ?? 2500);
const MAX_SWAPS = Number(process.argv[5] ?? 4);
const HELD_OUT_FIRST = SEARCH_SEEDS + 1;
const CUT_POOL = 5;
const MAX_MEAN_DROP = 0.005;
const PROTECTED = new Set(["Kernel Panic", "Bit Rot", "Null Pointer", "Watchdog Timer", "Decay Ward"]);
const ABLATION_PROBE = NEUTRAL_POOL.find((c) => c.name === "Commodity Rack")!;

const pct = (x: number) => (x * 100).toFixed(1);

interface Score {
  objective: number;
  mean: number;
  rates: number[];
}

async function score(pool: Pool, first: number, count: number): Promise<Score> {
  const rs = await measureEdges(faction, first, count, { pool });
  let objective = 0;
  const rates = rs.map((r) => {
    const rate = r.selfWins / r.games;
    const band = ringBand(faction, r.opponent);
    const miss = rate < band.lo ? band.lo - rate : rate > band.hi ? rate - band.hi : 0;
    objective += miss * miss;
    return rate;
  });
  return { objective, mean: rates.reduce((a, b) => a + b, 0) / rates.length, rates };
}

function legal(pool: Pool): boolean {
  try {
    buildDeck("p1", `${faction} Deck`, pool);
    return true;
  } catch {
    return false;
  }
}

/** One copy of `cut` out, one copy of `add` in (appended when new, so the
 * faction's own card order, which drives the shuffle, is kept). */
function swap(pool: Pool, cut: string, add: (typeof NEUTRAL_POOL)[number] | undefined): Pool {
  const next = pool.map((p) => (p.card.name === cut ? { ...p, copies: p.copies - 1 } : { ...p })).filter((p) => p.copies > 0);
  if (!add) return next;
  const existing = next.find((p) => p.card === add);
  if (existing) existing.copies++;
  else next.push({ card: add, copies: 1 });
  return next;
}

const fmt = (s: Score) => `obj ${(s.objective * 1e4).toFixed(1)} mean ${pct(s.mean)} [${s.rates.map(pct).join(" / ")}]`;
const opponents = FACTIONS.filter((f) => f !== faction);

const shipped = shippedPool(faction);
let pool: Pool = shipped.map((p) => ({ ...p }));
let current = await score(pool, 1, SEARCH_SEEDS);
console.log(`${faction}: neutral package search, seeds 1-${SEARCH_SEEDS}, edges vs ${opponents.join(" / ")}`);
console.log(`Objective = sum over edges of (distance to band)^2, x1e4. Guard: mean may drop at most ${pct(MAX_MEAN_DROP)} pts.`);
console.log(`Shipped deck: ${fmt(current)}`);

console.log(`\nAblation (one copy replaced by ${ABLATION_PROBE.name}):`);
const ablation: { name: string; s: Score }[] = [];
for (const { card, copies } of pool) {
  if (card.faction === "Neutral" || PROTECTED.has(card.name) || copies <= 1) continue;
  const cand = swap(pool, card.name, ABLATION_PROBE);
  if (!legal(cand)) continue;
  ablation.push({ name: card.name, s: await score(cand, 1, SEARCH_SEEDS) });
}
ablation.sort((a, b) => a.s.objective - b.s.objective || b.s.mean - a.s.mean);
for (const a of ablation) console.log(`  -1 ${a.name.padEnd(22)} ${fmt(a.s)}`);
const cutOptions = ablation.slice(0, CUT_POOL).map((a) => a.name);
console.log(`Swap-out options: ${cutOptions.join(", ")}`);

for (let step = 1; step <= MAX_SWAPS; step++) {
  console.log(`\nStep ${step}, from ${fmt(current)}:`);
  const scored: { cut: string; add: string; s: Score }[] = [];
  for (const cut of cutOptions) {
    const entry = pool.find((p) => p.card.name === cut);
    if (!entry || entry.copies <= 1) continue;
    for (const add of NEUTRAL_POOL) {
      const cand = swap(pool, cut, add);
      if (!legal(cand)) continue;
      scored.push({ cut, add: add.name, s: await score(cand, 1, SEARCH_SEEDS) });
    }
  }
  scored.sort((a, b) => a.s.objective - b.s.objective || b.s.mean - a.s.mean);
  for (const c of scored.slice(0, 12)) console.log(`  -${c.cut} +${c.add}`.padEnd(48) + fmt(c.s));
  const best = scored.find((c) => c.s.objective < current.objective && c.s.mean >= current.mean - MAX_MEAN_DROP);
  if (!best) {
    console.log("  => no swap improves the objective within the guard; stop.");
    break;
  }
  console.log(`  => take -1 ${best.cut}, +1 ${best.add}`);
  pool = swap(pool, best.cut, NEUTRAL_POOL.find((c) => c.name === best.add));
  current = best.s;
}

console.log(`\nChosen deck (${pool.reduce((n, p) => n + p.copies, 0)} cards):`);
for (const p of pool) {
  const was = shipped.find((q) => q.card === p.card)?.copies ?? 0;
  console.log(`  ${p.card.name.padEnd(22)} x${p.copies}${was !== p.copies ? `  (was x${was})` : ""}`);
}
for (const q of shipped) if (!pool.some((p) => p.card === q.card)) console.log(`  ${q.card.name.padEnd(22)} x0  (was x${q.copies})`);

console.log(`\nHeld-out seeds ${HELD_OUT_FIRST}-${HELD_OUT_FIRST + HELD_OUT_SEEDS - 1} (never used by the search):`);
const before = await measureEdges(faction, HELD_OUT_FIRST, HELD_OUT_SEEDS, { pool: shipped });
const after = await measureEdges(faction, HELD_OUT_FIRST, HELD_OUT_SEEDS, { pool });
for (let i = 0; i < before.length; i++) {
  const b = before[i]!;
  const a = after[i]!;
  const d = newcombeDiff(a.selfWins, a.games, b.selfWins, b.games);
  const band = ringBand(faction, b.opponent);
  console.log(
    `  ${faction} vs ${b.opponent.padEnd(6)} ${pct(b.selfWins / b.games)} -> ${pct(a.selfWins / a.games)}  ` +
      `change ${d.diff >= 0 ? "+" : ""}${pct(d.diff)} (95% CI ${pct(d.lo)} to ${pct(d.hi)})  band ${pct(band.lo)}-${pct(band.hi)}`,
  );
}
