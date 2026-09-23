// Real, unscripted-play evidence for the 2026-09-23 owner-feedback entry
// ("Phase 4 decisions"), item 3: "Swarm-vs-Null (and Cortex-vs-Swarm) —
// buff Swarm... give Swarm's kit real go-wide resilience so width answers
// removal." Two new cards (data/cards.ts): Colony Broodling (onDeath,
// summons a replacement Swarm Larva if 2+ other units survive it — directly
// punishing single-target removal) and Overgrown Carapace (its own health
// scales live with the controller's board width — a body that gets harder
// to burn down the wider Swarm already is). Both are whitebox-provable
// (they reuse only already-tested generic mechanisms: summon, ability
// condition, selfStatFromScaling), but per this project's own evidence
// convention, this script also proves both fire for real, mid-game, in
// unscripted LookaheadAgent-vs-LookaheadAgent play — not just a staged
// scenario. Mirrors segfaultConditionMatchDemo.ts's shape: re-drives
// runMatch's own move loop so it can sample live state after every move.

import { buildSwarmDeck, buildNullDeck, buildCortexDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { createInitialState } from "../state/init.js";
import { Rng } from "../state/rng.js";
import { getLegalMoves } from "../engine/moves.js";
import { applyMove, beginTurn } from "../engine/engine.js";
import { buildPlayerView } from "../agents/agent.js";
import { currentHealth } from "../state/queries.js";
import { formatLog } from "../log/format.js";
import type { GameState, GameEvent } from "../state/types.js";
import type { DeckSpec } from "../state/init.js";

const OPPONENTS: { name: string; build: (id: DeckSpec["id"], name: string) => DeckSpec }[] = [
  { name: "Null", build: buildNullDeck },
  { name: "Cortex", build: buildCortexDeck },
];

interface CarapaceSample {
  move: number;
  swarmUnits: number;
  observedHealth: number;
  expectedHealth: number;
}

interface Attempt {
  matchup: string;
  seed: number;
  state: GameState;
  broodlingSummonEvents: GameEvent[];
  carapaceSamples: CarapaceSample[];
  sawReplacement: boolean;
  sawScalingChange: boolean;
}

async function tryOne(opponent: (typeof OPPONENTS)[number], seed: number): Promise<Attempt> {
  const deckA = buildSwarmDeck("p1", "Swarm Deck");
  const deckB = opponent.build("p2", `${opponent.name} Deck`);
  const agentA = new LookaheadAgent("Lookahead-Swarm", seed);
  const agentB = new LookaheadAgent(`Lookahead-${opponent.name}`, seed + 1);

  const rng = new Rng(seed);
  const state = createInitialState(deckA, deckB, rng);
  state.players.p1.name = agentA.name;
  state.players.p2.name = agentB.name;
  state.turnNumber = 1;
  state.activePlayer = "p1";
  beginTurn(state, "p1", rng, { draw: false });

  const agents = { p1: agentA, p2: agentB } as const;
  const broodlingSummonEvents: GameEvent[] = [];
  const carapaceSamples: CarapaceSample[] = [];
  let sawReplacement = false;
  let sawScalingChange = false;
  let lastCarapaceHealth: number | undefined;
  let movesPlayed = 0;
  let logCursor = 0;

  while (!state.winner && movesPlayed < 5000) {
    const legalMoves = getLegalMoves(state);
    if (legalMoves.length === 0) break;
    const agent = agents[state.priority];
    const view = buildPlayerView(state, state.priority);
    const move = await agent.decideMove(view, legalMoves);
    applyMove(state, move, rng);
    movesPlayed++;

    // Any "summon" log event attributed to Colony Broodling is the
    // replacement mechanism firing for real (onDeath fires post-removal —
    // see data/cards.ts's own comment — so this only ever appears after
    // Colony Broodling itself has already left the board).
    for (; logCursor < state.log.length; logCursor++) {
      const event = state.log[logCursor]!;
      if (event.type === "summon" && event.source === "Colony Broodling") {
        broodlingSummonEvents.push(event);
        sawReplacement = true;
      }
    }

    const carapace = state.players.p1.board.find((u) => u.card.name === "Overgrown Carapace");
    if (carapace) {
      const swarmUnits = state.players.p1.board.length;
      const observedHealth = currentHealth(state, carapace);
      const expectedHealth = 1 + swarmUnits - carapace.damageTaken;
      carapaceSamples.push({ move: movesPlayed, swarmUnits, observedHealth, expectedHealth });
      if (lastCarapaceHealth !== undefined && lastCarapaceHealth !== observedHealth) sawScalingChange = true;
      lastCarapaceHealth = observedHealth;
    }
  }

  return {
    matchup: `Swarm vs ${opponent.name}`,
    seed,
    state,
    broodlingSummonEvents,
    carapaceSamples,
    sawReplacement,
    sawScalingChange,
  };
}

async function findBoth(maxSeed: number): Promise<Attempt | undefined> {
  let bestPartial: Attempt | undefined;
  for (const opponent of OPPONENTS) {
    for (let seed = 1; seed <= maxSeed; seed++) {
      const attempt = await tryOne(opponent, seed);
      if (attempt.sawReplacement && attempt.sawScalingChange) return attempt;
      if (!bestPartial && (attempt.sawReplacement || attempt.carapaceSamples.length > 0)) bestPartial = attempt;
      if (attempt.sawReplacement && (!bestPartial || !bestPartial.sawReplacement)) bestPartial = attempt;
    }
  }
  return bestPartial;
}

const maxSeed = Number(process.argv[2] ?? 300);
const found = await findBoth(maxSeed);

if (!found) {
  console.error(`No seed in [1, ${maxSeed}] ever got Colony Broodling to die-and-replace or Overgrown Carapace onto the board. Try a higher range.`);
  process.exit(1);
}

console.log(`AI-TCG Swarm go-wide resilience evidence (2026-09-23 Phase 4 decisions, item 3) — seed ${found.seed}, ${found.matchup}`);
console.log("Both sides played by LookaheadAgent.");
console.log("");
console.log("--- Colony Broodling: onDeath replacement ---");
if (found.broodlingSummonEvents.length === 0) {
  console.log("  Not observed this seed (no Colony Broodling died with 2+ other units surviving it).");
} else {
  for (const e of found.broodlingSummonEvents) {
    console.log(`  ${JSON.stringify(e)}`);
  }
}
console.log(`Replacement observed at least once: ${found.sawReplacement}`);
console.log("");
console.log("--- Overgrown Carapace: live health scaling with board width ---");
console.log("  (move #, Swarm's own unit count, observed live health, expected = 1 + count - damage taken)");
for (const s of found.carapaceSamples) {
  const match = s.observedHealth === s.expectedHealth ? "OK" : "MISMATCH";
  console.log(`  move ${String(s.move).padStart(4)}: Swarm controls ${s.swarmUnits} unit(s) -> health ${s.observedHealth} (expected ${s.expectedHealth}) [${match}]`);
}
console.log(`Health value changed at least once as board width changed: ${found.sawScalingChange}`);
console.log("");
console.log("--- Full match log ---");
console.log(formatLog(found.state.log));
console.log("");
console.log("--- Summary ---");
console.log(`Winner: ${found.state.winner}`);
console.log(`Turns played: ${found.state.turnNumber}`);
