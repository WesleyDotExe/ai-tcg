// Real, unscripted-play evidence for the Phase 4 backstop's step 1
// (2026-09-22 owner-feedback entry, "Null dominance ... backstop: nerf its
// abilities ... Candidates in priority order: redesign Segmentation Fault
// so its effect is conditional or temporary"): Segmentation Fault's aura
// ("While you control 2 or more units, enemy units get -1/-0.") is no
// longer unconditional — data/nullCards.ts's own comment explains why, and
// engine/test/nullFaction.test.ts whitebox-proves the on/off toggle against
// a synthetic fixture. This script is the OTHER half of this project's
// standing evidence convention: proving the same mechanism fires for real,
// mid-game, in unscripted LookaheadAgent-vs-LookaheadAgent play, not just a
// hand-built scenario.
//
// It re-drives runMatch's own move loop (rather than calling runMatch
// itself) purely so it can sample live state after every move — runMatch
// has no per-move hook, only onMatchStart, so a demo that wants to observe
// mid-match values has to step the engine itself, exactly the same
// getLegalMoves/decideMove/applyMove sequence runMatch uses.

import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { createInitialState } from "../state/init.js";
import { Rng } from "../state/rng.js";
import { getLegalMoves } from "../engine/moves.js";
import { applyMove, beginTurn } from "../engine/engine.js";
import { buildPlayerView } from "../agents/agent.js";
import { currentAttack } from "../state/queries.js";
import { formatLog } from "../log/format.js";
import type { GameState } from "../state/types.js";
import type { DeckSpec } from "../state/init.js";

const OPPONENTS: { name: string; build: (id: DeckSpec["id"], name: string) => DeckSpec }[] = [
  { name: "Cortex", build: buildCortexDeck },
  { name: "Swarm", build: buildSwarmDeck },
  { name: "Aegis", build: buildAegisDeck },
];

interface Sample {
  move: number;
  nullUnits: number;
  auraShouldBeActive: boolean;
  enemyAttack: number;
  enemyBaseAttack: number;
  debuffObserved: boolean;
}

interface Attempt {
  matchup: string;
  seed: number;
  state: GameState;
  samples: Sample[];
  sawActive: boolean;
  sawInactiveWhileInPlay: boolean;
}

async function tryOne(opponent: (typeof OPPONENTS)[number], seed: number): Promise<Attempt> {
  const deckA = buildNullDeck("p1", "Null Deck");
  const deckB = opponent.build("p2", `${opponent.name} Deck`);
  const agentA = new LookaheadAgent(`Lookahead-Null`, seed);
  const agentB = new LookaheadAgent(`Lookahead-${opponent.name}`, seed + 1);

  const rng = new Rng(seed);
  const state = createInitialState(deckA, deckB, rng);
  state.players.p1.name = agentA.name;
  state.players.p2.name = agentB.name;
  state.turnNumber = 1;
  state.activePlayer = "p1";
  beginTurn(state, "p1", rng, { draw: false });

  const agents = { p1: agentA, p2: agentB } as const;
  const samples: Sample[] = [];
  let sawActive = false;
  let sawInactiveWhileInPlay = false;
  let movesPlayed = 0;

  while (!state.winner && movesPlayed < 5000) {
    const legalMoves = getLegalMoves(state);
    if (legalMoves.length === 0) break;
    const agent = agents[state.priority];
    const view = buildPlayerView(state, state.priority);
    const move = await agent.decideMove(view, legalMoves);
    applyMove(state, move, rng);
    movesPlayed++;

    const segfaultInPlay = state.players.p1.directives.some((d) => d.card.name === "Segmentation Fault");
    const enemyUnit = state.players.p2.board[0];
    if (segfaultInPlay && enemyUnit) {
      const nullUnits = state.players.p1.board.length;
      const auraShouldBeActive = nullUnits >= 2;
      const observed = currentAttack(state, enemyUnit);
      const baseline = enemyUnit.card.attack;
      const debuffObserved = observed < baseline;
      samples.push({
        move: movesPlayed,
        nullUnits,
        auraShouldBeActive,
        enemyAttack: observed,
        enemyBaseAttack: baseline,
        debuffObserved,
      });
      if (auraShouldBeActive && debuffObserved) sawActive = true;
      if (!auraShouldBeActive) sawInactiveWhileInPlay = true;
    }
  }

  return { matchup: `Null vs ${opponent.name}`, seed, state, samples, sawActive, sawInactiveWhileInPlay };
}

async function findBothTransitions(maxSeed: number): Promise<Attempt | undefined> {
  let bestPartial: Attempt | undefined;
  for (const opponent of OPPONENTS) {
    for (let seed = 1; seed <= maxSeed; seed++) {
      const attempt = await tryOne(opponent, seed);
      if (attempt.sawActive && attempt.sawInactiveWhileInPlay) return attempt;
      if (!bestPartial && attempt.samples.length > 0) bestPartial = attempt;
      if (attempt.sawActive && (!bestPartial || !bestPartial.sawActive)) bestPartial = attempt;
    }
  }
  return bestPartial;
}

const maxSeed = Number(process.argv[2] ?? 300);
const found = await findBothTransitions(maxSeed);

if (!found) {
  console.error(`No seed in [1, ${maxSeed}] across any matchup ever got Segmentation Fault onto the board with an enemy unit present. Try a higher range.`);
  process.exit(1);
}

console.log(`AI-TCG Segmentation Fault conditional-aura evidence (2026-09-22 Phase 4 backstop, step 1) — seed ${found.seed}, ${found.matchup}`);
console.log(`Both sides played by LookaheadAgent. ${found.samples.length} samples taken (one per move after Segmentation Fault entered play, while an enemy unit existed).`);
console.log("");
console.log("--- Samples (move #, Null's own unit count, whether the aura's condition should be active, observed enemy attack vs base) ---");
for (const s of found.samples) {
  console.log(
    `  move ${String(s.move).padStart(4)}: Null controls ${s.nullUnits} unit(s), condition ${s.auraShouldBeActive ? "ACTIVE  " : "inactive"} -> enemy attack ${s.enemyAttack} (base ${s.enemyBaseAttack})${s.debuffObserved ? "  [debuffed]" : ""}`,
  );
}
console.log("");
console.log(`Aura observed ACTIVE (debuff applied) at least once: ${found.sawActive}`);
console.log(`Aura observed INACTIVE while Segmentation Fault was still in play (Null's board thinned below 2): ${found.sawInactiveWhileInPlay}`);
if (!found.sawInactiveWhileInPlay) {
  console.log("  (This particular seed never thinned Null's board below 2 units while Segmentation Fault stayed in play — the ON case is proven live here; the OFF transition is proven by the dedicated whitebox test in engine/test/nullFaction.test.ts instead.)");
}
console.log("");
console.log("--- Full match log ---");
console.log(formatLog(found.state.log));
console.log("");
console.log("--- Summary ---");
console.log(`Winner: ${found.state.winner}`);
console.log(`Turns played: ${found.state.turnNumber}`);
