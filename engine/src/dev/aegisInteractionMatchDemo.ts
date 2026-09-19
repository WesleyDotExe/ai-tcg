// 2026-09-19 owner-feedback evidence: a REAL played match (not a whitebox
// scenario — see test/aegisInteraction.test.ts for those) where at least one
// of Aegis's new defensive-interaction cards (Intercept Routine's redirect,
// Tariff Field's tax, Feedback Plating's blunt) actually fires during
// unscripted play, same search-over-seeds approach aegisMatchDemo.ts and
// nullMatchDemo.ts used for their own faction's mechanics. Also searches for
// the 2026-09-19 chosen-targeting fix (Kernel Panic's evolve-in destroy or
// Deprecated Routine's telegraph-arm debuff actually firing) in the same
// pass, since both changes landed together this session.

import { buildAegisDeck, buildCortexDeck } from "../data/decks.js";
import { RandomAgent } from "../agents/randomAgent.js";
import { AggressiveAgent } from "../agents/aggressiveAgent.js";
import { runMatch } from "../engine/match.js";
import { formatLog } from "../log/format.js";
import type { GameState, GameEvent } from "../state/types.js";

function hasEventsOfInterest(state: GameState) {
  const named = (e: GameEvent, ...names: string[]) => names.some((n) => JSON.stringify(e).includes(n));
  return {
    redirected: state.log.some((e) => e.type === "attackRedirected"),
    feedbackTriggered: state.log.some((e) => e.type === "abilityTrigger" && e.ability === "feedback-plating-damaged"),
    tariffPlayed: state.log.some((e) => e.type === "play" && named(e, "Tariff Field")),
    nullChosenEvolveOrArm: state.log.some((e) => (e.type === "evolve" && named(e, "Kernel Panic")) || (e.type === "telegraphArmed" && named(e, "Deprecated Routine"))),
  };
}

async function findDemonstratingSeed(maxSeed: number) {
  let best: { seed: number; state: GameState; movesPlayed: number; score: number } | undefined;
  for (let seed = 1; seed <= maxSeed; seed++) {
    const deckA = buildAegisDeck("p1", "Aegis Deck");
    const deckB = buildCortexDeck("p2", "Cortex Deck"); // Cortex is aggressive-leaning — gives Aegis's reactive cards real attacks to answer
    // RandomAgent, not AggressiveAgent, plays Aegis here: it actually uses a
    // reactive Instant like Intercept Routine whenever legal (uniform pick
    // among legal moves), where AggressiveAgent's narrow reactive heuristic
    // (see quality-debt.md) mostly ignores it — see progress/log.md for the
    // honest writeup on why that gap exists.
    const agentA = new RandomAgent("Random-Aegis", seed * 104729 + 3);
    const agentB = new AggressiveAgent("Aggressive-Cortex");
    const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, seed);
    const hits = hasEventsOfInterest(state);
    const score = Number(hits.redirected) * 4 + Number(hits.feedbackTriggered) * 2 + Number(hits.tariffPlayed) + Number(hits.nullChosenEvolveOrArm);
    if (!best || score > best.score) best = { seed, state, movesPlayed, score };
    if (hits.redirected && hits.feedbackTriggered) return { ...best, deckA, deckB, agentA, agentB };
  }
  return best
    ? {
        ...best,
        deckA: buildAegisDeck("p1", "Aegis Deck"),
        deckB: buildCortexDeck("p2", "Cortex Deck"),
        agentA: new RandomAgent("Random-Aegis", best.seed * 104729 + 3),
        agentB: new AggressiveAgent("Aggressive-Cortex"),
      }
    : undefined;
}

const maxSeed = Number(process.argv[2] ?? 3000);
const found = await findDemonstratingSeed(maxSeed);

if (!found) {
  console.error(`No seed in [1, ${maxSeed}] produced any match at all — something is badly broken.`);
  process.exit(1);
}

const { seed, state, movesPlayed, deckA, deckB, agentA, agentB } = found;
const hits = hasEventsOfInterest(state);
console.log(`AI-TCG 2026-09-19 owner-feedback evidence — Aegis defensive interaction + chosen-targeting fix — seed ${seed} (best of up to ${maxSeed} searched)`);
console.log(`${agentA.name} (Aegis, p1) vs ${agentB.name} (Cortex, p2)`);
console.log(`Deck sizes: p1=${deckA.cards.length}, p2=${deckB.cards.length}`);
console.log("");
console.log(formatLog(state.log));
console.log("");
console.log("--- Summary ---");
console.log(`Winner: ${state.winner}`);
console.log(`Turns played: ${state.turnNumber}`);
console.log(`Moves applied: ${movesPlayed}`);
console.log(`Final health — p1 (${state.players.p1.name}): ${state.players.p1.health}, p2 (${state.players.p2.name}): ${state.players.p2.health}`);
console.log("");
console.log("--- Which of this session's mechanics fired in THIS real match ---");
console.log(`Intercept Routine redirected a pending attack: ${hits.redirected}`);
console.log(`Feedback Plating's blunting trigger fired: ${hits.feedbackTriggered}`);
console.log(`Tariff Field was played (tax aura live — see effects/statics behaviour, not independently visible in the log): ${hits.tariffPlayed}`);
console.log(`Null's chosen-targeting fix fired (Kernel Panic evolve or Deprecated Routine arm): ${hits.nullChosenEvolveOrArm}`);
console.log("");
console.log("Any mechanic not hit in this particular match is proven instead by its dedicated unit test");
console.log("(engine/test/aegisInteraction.test.ts, engine/test/nullFaction.test.ts) — see progress/log.md.");
