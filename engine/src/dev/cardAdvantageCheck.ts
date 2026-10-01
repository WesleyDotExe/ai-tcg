// Instrument check (owner-feedback 2026-10-01, item 1): before nerfing
// Commodity Rack, find out whether LookaheadAgent under-values card
// advantage. The neutral-pool probe had the vanilla 3/3 at 48% against
// 34-42% for the draw/utility cards; that gap is only a card-strength fact if
// the agent values a drawn card about right.
//
// Two measurements:
//
// 1. Head-to-head. A LookaheadAgent with card-advantage weight W plays one
//    with the shipped weight (CARD_ADVANTAGE_WEIGHT = 1.5) on the shipped
//    decks. Every ordered faction pairing (mirrors included) is played on
//    each seed twice, once with each agent in each seat, so deck, seat and
//    shuffle cancel out. If some W beats 1.5 by a margin whose Newcombe
//    interval excludes zero, the shipped weight is mis-set: the agent plays
//    worse than it could because it misjudges a card in hand.
//
// 2. Probe under a weight. The neutral-pool probe (Null's own 36 cards + a
//    full set of one neutral card, vs each other shipped deck), with BOTH
//    sides using weight W. Shows whether the Rack-vs-draw gap survives a
//    correctly-valuing agent.
//
// Usage:
//   npx tsx src/dev/cardAdvantageCheck.ts h2h [seeds=100] [weights=0.75,3,4.5,6]
//   npx tsx src/dev/cardAdvantageCheck.ts probe [seeds=300] [weight=1.5] [cards=all]

import { FACTIONS, compareTwoProportions, wilson } from "./edgeMeasure.js";
import { buildDeck, buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { NULL_CARDS } from "../data/nullCards.js";
import { NEUTRAL_POOL } from "../data/neutralCards.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import type { DeckFaction } from "../cards/types.js";
import type { DeckSpec } from "../state/init.js";
import type { PlayerId } from "../state/types.js";

const SHIPPED_WEIGHT = 1.5;
const builders: Record<DeckFaction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Swarm: buildSwarmDeck,
  Aegis: buildAegisDeck,
  Null: buildNullDeck,
};
const pct = (x: number) => (x * 100).toFixed(1);

const [mode = "h2h", ...rest] = process.argv.slice(2);

if (mode === "h2h") {
  const seeds = Number(rest[0] ?? 100);
  const weights = (rest[1] ?? "0.75,3,4.5,6").split(",").map(Number);
  console.log("AI-TCG card-advantage instrument check: LookaheadAgent(weight W) vs LookaheadAgent(weight 1.5)");
  console.log(`Shipped decks, all 16 ordered faction pairings, ${seeds} seeds each, each seed played with W in both seats.`);
  console.log(`Games per weight: ${16 * seeds * 2}. Draws count as non-wins for both sides.`);
  console.log("");
  for (const w of weights) {
    let games = 0, wWins = 0, baseWins = 0;
    const perFaction = new Map<DeckFaction, { games: number; wins: number }>();
    for (const fa of FACTIONS) {
      for (const fb of FACTIONS) {
        for (let seed = 1; seed <= seeds; seed++) {
          for (const wSeat of ["p1", "p2"] as PlayerId[]) {
            const agentSeed = seed * 104729 + 31;
            const a1 = new LookaheadAgent("p1", agentSeed, { cardAdvantageWeight: wSeat === "p1" ? w : SHIPPED_WEIGHT });
            const a2 = new LookaheadAgent("p2", agentSeed, { cardAdvantageWeight: wSeat === "p2" ? w : SHIPPED_WEIGHT });
            const { state } = await runMatch(builders[fa]("p1", fa), builders[fb]("p2", fb), a1, a2, seed);
            games++;
            if (state.winner === wSeat) wWins++;
            else if (state.winner !== "draw") baseWins++;
            const wFaction = wSeat === "p1" ? fa : fb;
            const t = perFaction.get(wFaction) ?? { games: 0, wins: 0 };
            t.games++;
            if (state.winner === wSeat) t.wins++;
            perFaction.set(wFaction, t);
          }
        }
      }
    }
    const c = compareTwoProportions(wWins, games, baseWins, games);
    const by = FACTIONS.map((f) => {
      const t = perFaction.get(f)!;
      return `${f} ${pct(t.wins / t.games)}`;
    }).join(", ");
    console.log(
      `  W=${String(w).padEnd(5)} W wins ${pct(wWins / games)}%  1.5 wins ${pct(baseWins / games)}%  ` +
        `diff ${pct(c.diff.diff)} [${pct(c.diff.lo)}, ${pct(c.diff.hi)}]  ${c.verdict === "group 1 higher" ? "W BETTER" : c.verdict === "group 2 higher" ? "1.5 BETTER" : "no detectable difference"}`,
    );
    console.log(`         W's win rate by the faction W piloted: ${by}`);
  }
} else if (mode === "probe") {
  const seeds = Number(rest[0] ?? 300);
  const w = Number(rest[1] ?? SHIPPED_WEIGHT);
  const names = rest[2] ? rest[2].split(",") : NEUTRAL_POOL.map((c) => c.name);
  console.log(`AI-TCG neutral probe under card-advantage weight ${w} (both sides): Null's own 36 + one neutral card's full set`);
  console.log(`${seeds} seeds per opponent, seeding identical to neutralPoolMatchDemo.ts --probe.`);
  console.log("");
  const own = NULL_CARDS.filter((p) => p.card.faction === "Null");
  for (const card of NEUTRAL_POOL.filter((c) => names.includes(c.name))) {
    const copies = card.rarity === "Rare" ? 2 : 3;
    const pool = [...own, { card, copies }];
    let games = 0, wins = 0;
    for (const opp of FACTIONS.filter((f) => f !== "Null")) {
      for (let seed = 1; seed <= seeds; seed++) {
        const oppFirst = seed % 2 === 1;
        const nul = new LookaheadAgent("Lookahead-Null", seed * 104729 + 31, { cardAdvantageWeight: w });
        const other = new LookaheadAgent(`Lookahead-${opp}`, seed * 104729 + 31, { cardAdvantageWeight: w });
        const { state } = oppFirst
          ? await runMatch(builders[opp]("p1", opp), buildDeck("p2", "Null probe", pool), other, nul, seed)
          : await runMatch(buildDeck("p1", "Null probe", pool), builders[opp]("p2", opp), nul, other, seed);
        games++;
        if (state.winner === (oppFirst ? "p2" : "p1")) wins++;
      }
    }
    const ci = wilson(wins, games);
    console.log(`  ${card.name.padEnd(16)} x${copies}: Null won ${pct(wins / games)}% of ${games}  [${pct(ci.lo)}, ${pct(ci.hi)}]`);
  }
} else {
  console.error("Usage: cardAdvantageCheck.ts h2h [seeds] [weights] | probe [seeds] [weight] [cards]");
  process.exit(1);
}
