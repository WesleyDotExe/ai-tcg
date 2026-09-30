// Real-play evidence for the neutral pool (Phase 5 step (ii); see
// data/neutralCards.ts and neutralPackageSearch.ts). Plays every cross-faction
// pairing with the SHIPPED decks, both sides LookaheadAgent, with the exact
// seeding of lookaheadEdgeCheck.ts, and reports, per neutral card: how many
// games it was played in, by which factions, the win rate of the side that
// played it, and whether its effect actually landed (a heal that restored
// health, energy actually gained, a card actually drawn). Then prints the
// full log of the first game in which two or more different neutral cards
// were played.
//
// Usage: npx tsx src/dev/neutralPoolMatchDemo.ts [seedsPerPairing=300]

import { FACTIONS } from "./edgeMeasure.js";
import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { NEUTRAL_POOL } from "../data/neutralCards.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import { formatLog } from "../log/format.js";
import type { DeckFaction } from "../cards/types.js";
import type { DeckSpec } from "../state/init.js";
import type { GameState, PlayerId } from "../state/types.js";

const seeds = Number(process.argv[2] ?? 300);
const builders: Record<DeckFaction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Swarm: buildSwarmDeck,
  Aegis: buildAegisDeck,
  Null: buildNullDeck,
};
const NEUTRAL = new Set(NEUTRAL_POOL.map((c) => c.name));

interface Tally {
  games: number;
  wins: number;
  landed: number;
  byFaction: Map<DeckFaction, number>;
}
const tally = new Map<string, Tally>(NEUTRAL_POOL.map((c) => [c.name, { games: 0, wins: 0, landed: 0, byFaction: new Map() }]));

/** Neutral cards `pid` played this game, and how many times each one's
 * effect visibly landed (any heal/gainEnergy/draw event it sourced, or a
 * draw directly after its own trigger/cast). */
function neutralActivity(state: GameState, pid: PlayerId): { played: Set<string>; landed: Map<string, number> } {
  const played = new Set<string>();
  const landed = new Map<string, number>();
  const bump = (n: string) => landed.set(n, (landed.get(n) ?? 0) + 1);
  let lastSource: string | undefined;
  for (const e of state.log) {
    if ((e.type === "play" || e.type === "cast") && e.player === pid && NEUTRAL.has(e.card)) played.add(e.card);
    if (e.type === "toolAttached" && e.player === pid && NEUTRAL.has(e.tool)) {
      played.add(e.tool);
      bump(e.tool);
    }
    if ((e.type === "heal" || e.type === "gainEnergy") && NEUTRAL.has(e.source)) {
      if (e.type === "gainEnergy" ? e.player === pid : played.has(e.source)) bump(e.source);
    }
    if (e.type === "abilityTrigger") lastSource = e.source;
    else if (e.type === "stackResolve") lastSource = NEUTRAL.has(e.description) ? e.description : undefined;
    else if (e.type === "draw" && e.player === pid && lastSource && NEUTRAL.has(lastSource) && played.has(lastSource)) bump(lastSource);
    else if (e.type === "play" && e.player === pid && NEUTRAL.has(e.card)) lastSource = e.card;
    else if (e.type !== "draw") lastSource = undefined;
  }
  // A plain body (no ability) "lands" by entering play.
  for (const name of played) {
    const card = NEUTRAL_POOL.find((c) => c.name === name)!;
    if (card.abilities.length === 0 && card.type === "Unit") bump(name);
  }
  return { played, landed };
}

let showcase: { label: string; state: GameState; names: string[] } | undefined;
let totalGames = 0;
for (let i = 0; i < FACTIONS.length; i++) {
  for (let j = i + 1; j < FACTIONS.length; j++) {
    const fa = FACTIONS[i]!;
    const fb = FACTIONS[j]!;
    for (let seed = 1; seed <= seeds; seed++) {
      const aFirst = seed % 2 === 1;
      const agentA = new LookaheadAgent(`Lookahead-${fa}`, seed * 104729 + 31);
      const agentB = new LookaheadAgent(`Lookahead-${fb}`, seed * 104729 + 31);
      const { state } = aFirst
        ? await runMatch(builders[fa]("p1", `${fa} Deck`), builders[fb]("p2", `${fb} Deck`), agentA, agentB, seed)
        : await runMatch(builders[fb]("p1", `${fb} Deck`), builders[fa]("p2", `${fa} Deck`), agentB, agentA, seed);
      totalGames++;
      const factionOf: Record<PlayerId, DeckFaction> = aFirst ? { p1: fa, p2: fb } : { p1: fb, p2: fa };
      const allNames = new Set<string>();
      for (const pid of ["p1", "p2"] as PlayerId[]) {
        const { played, landed } = neutralActivity(state, pid);
        for (const name of played) {
          const t = tally.get(name)!;
          t.games++;
          if (state.winner === pid) t.wins++;
          t.landed += landed.get(name) ?? 0;
          t.byFaction.set(factionOf[pid], (t.byFaction.get(factionOf[pid]) ?? 0) + 1);
          allNames.add(`${name} (${factionOf[pid]})`);
        }
      }
      if (!showcase && allNames.size >= 2) {
        showcase = { label: `${factionOf.p1} (p1) vs ${factionOf.p2} (p2), seed ${seed}`, state, names: [...allNames] };
      }
    }
  }
}

console.log("AI-TCG neutral pool evidence: shipped decks, LookaheadAgent vs LookaheadAgent, all six pairings");
console.log(`${seeds} seeds per pairing (${totalGames} games), seeding identical to lookaheadEdgeCheck.ts.`);
console.log("");
console.log("Shipped neutral packages:");
for (const f of FACTIONS) {
  const deck = builders[f]("p1", f);
  const counts = new Map<string, number>();
  for (const c of deck.cards) if (c.faction === "Neutral") counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  const list = [...counts].map(([n, c]) => `${n} x${c}`).join(", ");
  console.log(`  ${f.padEnd(6)} ${deck.cards.length} cards, ${[...counts.values()].reduce((a, b) => a + b, 0)} neutral: ${list || "(none)"}`);
}
console.log("");
console.log("Per neutral card (games = games in which the card was played; landed = times its effect visibly happened):");
for (const card of NEUTRAL_POOL) {
  const t = tally.get(card.name)!;
  const by = [...t.byFaction].map(([f, n]) => `${f} ${n}`).join(", ");
  const wr = t.games ? `${((t.wins / t.games) * 100).toFixed(1)}% won` : "";
  console.log(`  ${card.name.padEnd(16)} games ${String(t.games).padStart(4)}  landed ${String(t.landed).padStart(4)}  ${wr.padEnd(10)} ${by}`);
}
if (!showcase) {
  console.log("\nNo game had two different neutral cards played.");
} else {
  console.log("");
  console.log(`=== Full match log: ${showcase.label}; neutral cards played: ${showcase.names.join(", ")} ===`);
  console.log("");
  console.log(formatLog(showcase.state.log));
  console.log("");
  console.log(`Winner: ${showcase.state.winner}, turns: ${showcase.state.turnNumber}`);
}
