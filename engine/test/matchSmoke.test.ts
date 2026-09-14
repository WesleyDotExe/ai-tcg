// A committed, automated version of the "run N seeds, confirm nothing
// crashes and matches resolve under the turn cap" stress run that
// progress/current.md's stage-3 entry described running manually (300
// games) but never committed as a script — named as a gap in
// progress/quality-debt.md. This runs a much smaller sample (fast enough
// for every `npm test`) across all three factions' matchups, but for real,
// every time, not just when someone remembers to run it by hand.

import { test, expect } from "vitest";
import { buildCortexDeck, buildSwarmDeck, buildAegisDeck } from "../src/data/decks.js";
import { RandomAgent } from "../src/agents/randomAgent.js";
import { AggressiveAgent } from "../src/agents/aggressiveAgent.js";
import { runMatch } from "../src/engine/match.js";
import { TURN_CAP } from "../src/state/init.js";
import type { DeckSpec } from "../src/state/init.js";

const SEEDS_PER_MATCHUP = 15;

const deckBuilders: Record<string, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Swarm: buildSwarmDeck,
  Aegis: buildAegisDeck,
};

const matchups: [keyof typeof deckBuilders, keyof typeof deckBuilders][] = [
  ["Cortex", "Swarm"],
  ["Cortex", "Aegis"],
  ["Swarm", "Aegis"],
];

for (const [factionA, factionB] of matchups) {
  test(`${factionA} vs ${factionB}: ${SEEDS_PER_MATCHUP} seeds all resolve cleanly, under the turn cap`, async () => {
    for (let seed = 1; seed <= SEEDS_PER_MATCHUP; seed++) {
      const deckA = deckBuilders[factionA]("p1", `${factionA} Deck`);
      const deckB = deckBuilders[factionB]("p2", `${factionB} Deck`);
      // Alternate which side is Random vs Aggressive across seeds so both
      // decision policies attack and defend with each faction, not just one
      // fixed pairing.
      const agentA = seed % 2 === 0 ? new RandomAgent(`Random-${factionA}`, seed) : new AggressiveAgent(`Aggressive-${factionA}`);
      const agentB = seed % 2 === 0 ? new AggressiveAgent(`Aggressive-${factionB}`) : new RandomAgent(`Random-${factionB}`, seed);

      const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, seed);

      expect(state.winner, `seed ${seed}: match must resolve to a winner or a draw, not hang`).toBeDefined();
      expect(state.turnNumber, `seed ${seed}: must resolve at or under the turn cap`).toBeLessThanOrEqual(TURN_CAP + 1);
      expect(movesPlayed, `seed ${seed}: should not hit the engine's runaway-loop safety valve`).toBeLessThan(5000);
    }
  });
}
