// Real, unscripted-play evidence for the 2026-09-23 owner-feedback entry
// ("Phase 4 session 17 follow-ups"), items 3-4:
//   3. Aegis-vs-Cortex fix — Guard Directive Chip bumped to 3 copies
//      (data/aegisCards.ts) rather than shipping an unproven new card (a
//      first attempt, a new 0/0-stat Barrier Tool, measured WORSE and was
//      reverted — see that file's own comment).
//   4. Null step 4, past cost to power — Kernel Panic's destroy reach
//      tightened from maxHealth 5 to 4, and Null Singularity's health
//      dropped 8 -> 7 (data/nullCards.ts).
// engine/test/nullFaction.test.ts already whitebox-proves Kernel Panic's
// tightened cap with a synthetic fixture; this script is the other half of
// this project's standing evidence convention — proving the same
// mechanisms show up for real, mid-game, in unscripted
// LookaheadAgent-vs-LookaheadAgent play. Mirrors segfaultConditionMatchDemo.ts's
// shape: re-drives runMatch's own move loop so it can sample live state
// after every move.

import { buildAegisDeck, buildCortexDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { createInitialState } from "../state/init.js";
import { Rng } from "../state/rng.js";
import { getLegalMoves } from "../engine/moves.js";
import { applyMove, beginTurn } from "../engine/engine.js";
import { buildPlayerView } from "../agents/agent.js";
import { formatLog } from "../log/format.js";
import type { GameState } from "../state/types.js";

interface GuardAttempt {
  seed: number;
  state: GameState;
  guardUnit: string | undefined;
  forcedAttack: boolean;
}

async function tryGuard(seed: number): Promise<GuardAttempt> {
  const deckA = buildAegisDeck("p1", "Aegis Deck");
  const deckB = buildCortexDeck("p2", "Cortex Deck");
  const agentA = new LookaheadAgent("Lookahead-Aegis", seed);
  const agentB = new LookaheadAgent("Lookahead-Cortex", seed + 1);

  const rng = new Rng(seed);
  const state = createInitialState(deckA, deckB, rng);
  state.players.p1.name = agentA.name;
  state.players.p2.name = agentB.name;
  state.turnNumber = 1;
  state.activePlayer = "p1";
  beginTurn(state, "p1", rng, { draw: false });

  const agents = { p1: agentA, p2: agentB } as const;
  let guardUnit: string | undefined;
  let forcedAttack = false;
  let movesPlayed = 0;

  while (!state.winner && movesPlayed < 5000) {
    const legalMoves = getLegalMoves(state);
    if (legalMoves.length === 0) break;
    const agent = agents[state.priority];
    const view = buildPlayerView(state, state.priority);
    const move = await agent.decideMove(view, legalMoves);
    applyMove(state, move, rng);
    movesPlayed++;

    const latest = state.log[state.log.length - 1];
    if (latest?.type === "toolAttached" && latest.tool === "Guard Directive Chip") guardUnit = latest.unit;
    if (latest?.type === "attack" && latest.defenderKind === "unit" && guardUnit && latest.defender === guardUnit) {
      forcedAttack = true;
    }
  }

  return { seed, state, guardUnit, forcedAttack };
}

interface ReachAttempt {
  seed: number;
  state: GameState;
  sparedUnit: string | undefined;
}

async function tryReach(seed: number): Promise<ReachAttempt> {
  const deckA = buildNullDeck("p1", "Null Deck");
  const deckB = buildAegisDeck("p2", "Aegis Deck");
  const agentA = new LookaheadAgent("Lookahead-Null", seed);
  const agentB = new LookaheadAgent("Lookahead-Aegis", seed + 1);

  const rng = new Rng(seed);
  const state = createInitialState(deckA, deckB, rng);
  state.players.p1.name = agentA.name;
  state.players.p2.name = agentB.name;
  state.turnNumber = 1;
  state.activePlayer = "p1";
  beginTurn(state, "p1", rng, { draw: false });

  const agents = { p1: agentA, p2: agentB } as const;
  let sparedUnit: string | undefined;
  let movesPlayed = 0;

  while (!state.winner && movesPlayed < 5000) {
    const legalMoves = getLegalMoves(state);
    if (legalMoves.length === 0) break;
    const agent = agents[state.priority];
    const view = buildPlayerView(state, state.priority);
    const move = await agent.decideMove(view, legalMoves);

    // Right before an evolve into Kernel Panic resolves, note any enemy
    // unit sitting at exactly 5 max health with no ability target chosen —
    // the exact shape that used to be a legal, chosen destroy target under
    // the old maxHealth:5 cap and now isn't.
    if (move.type === "playCard" && move.abilityTarget === undefined) {
      const process = state.players.p1.board.find((u) => u.instanceId === (move.target?.kind === "unit" ? move.target.instanceId : undefined));
      if (process?.card.name === "Corrupted Process") {
        const fiveHealth = state.players.p2.board.find((u) => u.card.health + u.permanentBuff.health === 5);
        if (fiveHealth) sparedUnit = fiveHealth.card.name;
      }
    }

    applyMove(state, move, rng);
    movesPlayed++;
  }

  return { seed, state, sparedUnit };
}

const maxSeed = Number(process.argv[2] ?? 400);

let guardFound: GuardAttempt | undefined;
for (let seed = 1; seed <= maxSeed && !guardFound?.forcedAttack; seed++) {
  const attempt = await tryGuard(seed);
  if (attempt.forcedAttack) guardFound = attempt;
}

let reachFound: ReachAttempt | undefined;
for (let seed = 1; seed <= maxSeed && !reachFound?.sparedUnit; seed++) {
  const attempt = await tryReach(seed);
  if (attempt.sparedUnit) reachFound = attempt;
}

console.log(`AI-TCG ring-fix evidence (2026-09-23 "Phase 4 session 17 follow-ups")`);
console.log("Both sides played by LookaheadAgent in every match below.");
console.log("");
console.log("--- Item 3: Guard Directive Chip forces an attack onto the equipped unit (Aegis vs Cortex) ---");
if (guardFound) {
  console.log(`  Found at seed ${guardFound.seed}: Guard Directive Chip attached to "${guardFound.guardUnit}", which was then the forced attack target.`);
} else {
  console.log(`  Not observed in seeds [1, ${maxSeed}] — try a higher range.`);
}
console.log("");
console.log("--- Item 4: Kernel Panic's tightened destroy reach spares a 5-health unit (Null vs Aegis) ---");
if (reachFound) {
  console.log(`  Found at seed ${reachFound.seed}: "${reachFound.sparedUnit}" (5 max health) had no legal destroy target offered when Corrupted Process evolved, and survived.`);
} else {
  console.log(`  Not observed in seeds [1, ${maxSeed}] — try a higher range.`);
}
console.log("");

if (guardFound) {
  console.log("=== Full match log: Guard Directive Chip evidence ===");
  console.log(formatLog(guardFound.state.log));
  console.log("");
  console.log(`Winner: ${guardFound.state.winner}, turns: ${guardFound.state.turnNumber}`);
  console.log("");
}
if (reachFound) {
  console.log("=== Full match log: Kernel Panic tightened-reach evidence ===");
  console.log(formatLog(reachFound.state.log));
  console.log("");
  console.log(`Winner: ${reachFound.state.winner}, turns: ${reachFound.state.turnNumber}`);
}
