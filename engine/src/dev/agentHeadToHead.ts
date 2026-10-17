// Instrument check (session 41, owner 2026-10-18: "fix the reference agent
// first: value auras over several turns and stuns by how long they last").
// Does the changed LookaheadAgent play better than the one it replaces? A
// fixed valuation should win head to head; if it lost, the "fix" would make
// the balance instrument worse, not better.
//
// The other agent is loaded from a module path, so any earlier version can be
// played without keeping its code in the tree. To rebuild the session-40
// agent (the last before the change):
//   git show 7a1151c:engine/src/agents/lookaheadAgent.ts > src/agents/lookaheadAgentPrev.ts
//   npx tsx src/dev/agentHeadToHead.ts ../agents/lookaheadAgentPrev.js [seeds=200]
// (the path is relative to this file; delete the copy afterwards).
//
// Shipped decks, all 16 ordered faction pairings (mirrors included), each
// seed played twice so each agent sits in each seat: deck, seat and shuffle
// cancel out. Both agents get the same agent seed. Draws count as a win for
// neither. Reports the current agent's win rate with the Newcombe interval
// on the difference, and by faction: the current agent's win rate piloting
// that faction against the other agent's win rate piloting it, over the
// same seeds and opponents' decks (a faction's own strength cancels out).

import { FACTIONS, compareTwoProportions } from "./edgeMeasure.js";
import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import type { Agent } from "../agents/agent.js";
import type { DeckFaction } from "../cards/types.js";
import type { DeckSpec } from "../state/init.js";
import type { PlayerId } from "../state/types.js";

const builders: Record<DeckFaction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Swarm: buildSwarmDeck,
  Aegis: buildAegisDeck,
  Null: buildNullDeck,
};
const pct = (x: number) => (x * 100).toFixed(1);

const [modulePath, seedArg] = process.argv.slice(2);
if (!modulePath) {
  console.error("Usage: agentHeadToHead.ts <module exporting LookaheadAgent, relative to src/dev/> [seeds=200]");
  process.exit(1);
}
const seeds = Number(seedArg ?? 200);
const Other = (await import(modulePath)).LookaheadAgent as new (name: string, seed: number) => Agent;

let games = 0, newWins = 0, oldWins = 0;
/** Per faction: games and wins with the current agent piloting it, and with the other agent piloting it. */
const perFaction = new Map<DeckFaction, { games: number; wins: number; otherGames: number; otherWins: number }>();
for (const fa of FACTIONS) {
  for (const fb of FACTIONS) {
    for (let seed = 1; seed <= seeds; seed++) {
      for (const newSeat of ["p1", "p2"] as PlayerId[]) {
        const agentSeed = seed * 104729 + 31;
        const make = (pid: PlayerId) => (pid === newSeat ? new LookaheadAgent(pid, agentSeed) : new Other(pid, agentSeed));
        const { state } = await runMatch(builders[fa]("p1", fa), builders[fb]("p2", fb), make("p1"), make("p2"), seed);
        games++;
        const won = state.winner === newSeat;
        const lost = state.winner !== "draw" && !won;
        if (won) newWins++;
        if (lost) oldWins++;
        const f = newSeat === "p1" ? fa : fb;
        const g = newSeat === "p1" ? fb : fa;
        const t = perFaction.get(f) ?? { games: 0, wins: 0, otherGames: 0, otherWins: 0 };
        t.games++;
        if (won) t.wins++;
        perFaction.set(f, t);
        const u = perFaction.get(g) ?? { games: 0, wins: 0, otherGames: 0, otherWins: 0 };
        u.otherGames++;
        if (lost) u.otherWins++;
        perFaction.set(g, u);
      }
    }
  }
}
const c = compareTwoProportions(newWins, games, oldWins, games);
console.log(`AI-TCG agent head to head: LookaheadAgent (current) vs LookaheadAgent from ${modulePath}`);
console.log(`Shipped decks, 16 ordered pairings x ${seeds} seeds x both seats = ${games} games.`);
console.log(
  `  current wins ${pct(newWins / games)}%, other wins ${pct(oldWins / games)}%, draws ${pct((games - newWins - oldWins) / games)}%; ` +
    `difference ${pct(c.diff.diff)} [${pct(c.diff.lo)}, ${pct(c.diff.hi)}]: ` +
    (c.verdict === "group 1 higher" ? "CURRENT BETTER" : c.verdict === "group 2 higher" ? "OTHER BETTER" : "no detectable difference"),
);
for (const f of FACTIONS) {
  const t = perFaction.get(f)!;
  const d = compareTwoProportions(t.wins, t.games, t.otherWins, t.otherGames);
  console.log(
    `  piloting ${f.padEnd(6)} current wins ${pct(t.wins / t.games)}% of ${t.games}, other wins ${pct(t.otherWins / t.otherGames)}% of ${t.otherGames}; ` +
      `difference ${pct(d.diff.diff)} [${pct(d.diff.lo)}, ${pct(d.diff.hi)}]`,
  );
}
