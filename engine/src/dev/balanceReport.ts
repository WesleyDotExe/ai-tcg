// Design principle 3 ("A self-disrupting metagame") says explicitly:
// "Measure it: track whether one archetype dominates win rates over time;
// if it does, that's a balance bug to fix, and the record should show it
// being fixed." Three factions (Cortex, Swarm, Aegis) have existed since
// session 4 with zero balance measurement between them — named as aging
// debt in quality-debt.md across sessions 5 and 6. This script is that
// first measurement.
//
// Design of the measurement, and why: matchSmoke.test.ts already proves
// matches resolve cleanly, but it alternates RandomAgent/AggressiveAgent
// per side, which mixes agent-skill difference into any win-rate signal —
// useless for isolating faction balance. Here both sides always run the
// SAME agent policy (AggressiveAgent, deterministic — no RNG of its own),
// so the only things that differ between games are the faction card pools
// and the seed-driven shuffle/draw order and any randomly-targeted effects.
// We also alternate which faction plays first across seeds so a real
// first-player advantage doesn't get misread as a faction imbalance.
//
// A second pass repeats the same matchups with RandomAgent on both sides,
// as a check against a specific failure mode: a heuristic-favoring result
// (AggressiveAgent plays a rush-y faction "better" than a value faction by
// construction of the heuristic, not because the faction is stronger).
// A faction that wins disproportionately under BOTH agent policies is a
// much stronger balance signal than either alone.

import { buildCortexDeck, buildSwarmDeck, buildAegisDeck } from "../data/decks.js";
import { AggressiveAgent } from "../agents/aggressiveAgent.js";
import { RandomAgent } from "../agents/randomAgent.js";
import { runMatch } from "../engine/match.js";
import { TURN_CAP } from "../state/init.js";
import type { Agent } from "../agents/agent.js";
import type { DeckSpec } from "../state/init.js";

const FACTIONS = ["Cortex", "Swarm", "Aegis"] as const;
type Faction = (typeof FACTIONS)[number];

const deckBuilders: Record<Faction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Swarm: buildSwarmDeck,
  Aegis: buildAegisDeck,
};

const SEEDS_PER_MATCHUP = Number(process.argv[2] ?? 300);

interface MatchupResult {
  factionA: Faction;
  factionB: Faction;
  gamesPlayed: number;
  aWins: number;
  bWins: number;
  draws: number;
  cappedGames: number;
  totalTurns: number;
}

function pairings(): [Faction, Faction][] {
  const pairs: [Faction, Faction][] = [];
  for (let i = 0; i < FACTIONS.length; i++) {
    for (let j = i + 1; j < FACTIONS.length; j++) {
      pairs.push([FACTIONS[i]!, FACTIONS[j]!]);
    }
  }
  return pairs;
}

async function runMatchup(
  factionA: Faction,
  factionB: Faction,
  makeAgent: (name: string, seed: number) => Agent,
  seeds: number,
): Promise<MatchupResult> {
  const result: MatchupResult = {
    factionA,
    factionB,
    gamesPlayed: 0,
    aWins: 0,
    bWins: 0,
    draws: 0,
    cappedGames: 0,
    totalTurns: 0,
  };

  for (let seed = 1; seed <= seeds; seed++) {
    // Alternate who goes first across seeds so first-player advantage
    // (a real, separate effect — see the mirror matchups below) doesn't
    // leak into the cross-faction win-rate signal.
    const aGoesFirst = seed % 2 === 1;
    const deckA = deckBuilders[factionA]("p1", `${factionA} Deck`);
    const deckB = deckBuilders[factionB]("p2", `${factionB} Deck`);
    const agentA = makeAgent(factionA, seed);
    const agentB = makeAgent(factionB, seed);

    const { state } = aGoesFirst
      ? await runMatch(deckA, deckB, agentA, agentB, seed)
      : await runMatch(deckB, deckA, agentB, agentA, seed);

    result.gamesPlayed++;
    result.totalTurns += state.turnNumber;
    if (state.turnNumber >= TURN_CAP) result.cappedGames++;

    // winner is always expressed as "p1" | "p2" | "draw" by the engine;
    // translate back to which faction that was given aGoesFirst.
    if (state.winner === "draw") {
      result.draws++;
    } else if (state.winner === "p1") {
      if (aGoesFirst) result.aWins++;
      else result.bWins++;
    } else if (state.winner === "p2") {
      if (aGoesFirst) result.bWins++;
      else result.aWins++;
    }
  }

  return result;
}

function formatMatchup(r: MatchupResult): string {
  const aRate = ((r.aWins / r.gamesPlayed) * 100).toFixed(1);
  const bRate = ((r.bWins / r.gamesPlayed) * 100).toFixed(1);
  const avgTurns = (r.totalTurns / r.gamesPlayed).toFixed(1);
  const capRate = ((r.cappedGames / r.gamesPlayed) * 100).toFixed(1);
  const flag = Math.max(r.aWins, r.bWins) / r.gamesPlayed >= 0.6 ? "  <-- FLAG: >=60% win rate" : "";
  return (
    `  ${r.factionA} ${r.aWins}-${r.bWins} ${r.factionB}  ` +
    `(${r.factionA} ${aRate}% / ${r.factionB} ${bRate}%, ${r.draws} draws, ` +
    `avg ${avgTurns} turns, ${capRate}% hit turn cap)${flag}`
  );
}

async function runPolicy(label: string, makeAgent: (name: string, seed: number) => Agent) {
  console.log(`\n=== ${label} ===`);
  const results: MatchupResult[] = [];
  for (const [factionA, factionB] of pairings()) {
    const r = await runMatchup(factionA, factionB, makeAgent, SEEDS_PER_MATCHUP);
    results.push(r);
    console.log(formatMatchup(r));
  }
  console.log(`  --- mirror matches (first-player-advantage baseline) ---`);
  for (const faction of FACTIONS) {
    const r = await runMatchup(faction, faction, makeAgent, SEEDS_PER_MATCHUP);
    // In a mirror match "aWins"/"bWins" are both the same faction; report
    // as first-player vs second-player instead, which is the only real
    // signal a mirror match can carry.
    const firstRate = ((r.aWins / r.gamesPlayed) * 100).toFixed(1);
    console.log(
      `  ${faction} mirror: first-player ${r.aWins}-${r.bWins} second-player ` +
        `(first-player win rate ${firstRate}%, ${r.draws} draws, avg ${(r.totalTurns / r.gamesPlayed).toFixed(1)} turns)`,
    );
  }
  return results;
}

console.log(`AI-TCG balance report — design principle 3 measurement`);
console.log(`${SEEDS_PER_MATCHUP} seeds per matchup, ${pairings().length} cross-faction pairings + ${FACTIONS.length} mirror matchups per agent policy.`);

const aggressiveResults = await runPolicy("AggressiveAgent vs AggressiveAgent (same policy both sides)", (name, _seed) => new AggressiveAgent(`Aggressive-${name}`));
const randomResults = await runPolicy("RandomAgent vs RandomAgent (same policy both sides)", (name, seed) => new RandomAgent(`Random-${name}`, seed * 7919 + 13));

console.log(`\n=== Cross-check: flagged in both agent policies? ===`);
let anyDoubleFlag = false;
for (const ar of aggressiveResults) {
  const rr = randomResults.find((r) => r.factionA === ar.factionA && r.factionB === ar.factionB);
  if (!rr) continue;
  const aggressiveFlag = Math.max(ar.aWins, ar.bWins) / ar.gamesPlayed >= 0.6;
  const randomFlag = Math.max(rr.aWins, rr.bWins) / rr.gamesPlayed >= 0.6;
  if (aggressiveFlag && randomFlag) {
    const aggWinner = ar.aWins > ar.bWins ? ar.factionA : ar.factionB;
    const randWinner = rr.aWins > rr.bWins ? rr.factionA : rr.factionB;
    console.log(`  ${ar.factionA} vs ${ar.factionB}: FLAGGED under both policies (Aggressive favors ${aggWinner}, Random favors ${randWinner})`);
    anyDoubleFlag = true;
  }
}
if (!anyDoubleFlag) {
  console.log(`  None. No cross-faction pairing shows a >=60% win rate under both agent policies — no strong evidence of a dominant archetype from this measurement.`);
}
