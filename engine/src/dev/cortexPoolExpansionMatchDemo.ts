// Real, unscripted-play evidence for the Cortex slice of Phase 5 pool
// expansion (the last faction slice; 2026-09-26 owner-feedback entries).
// Searches real LookaheadAgent-vs-LookaheadAgent games (Cortex against each
// other faction in turn) for all five of this slice's new cards doing their
// specific new thing mid-game, detected from the engine's own event log and
// live state, not a whitebox fixture:
//
//   Rate Limiter       onTurnStart -> its trigger followed by damage (the
//                                     "enemy controls 3+ units" branch fired)
//   Load Balancer      onAttack    -> its trigger followed by damage
//   Hotfix             Instant     -> cast on the OPPONENT's turn (reactive play)
//   Deadlock Detector  onPlay      -> its trigger followed by a Stasis (the
//                                     condition was live when it landed)
//   Quorum Arbiter     static      -> attacks with attack above its printed 3,
//                                     read from the live state
//
// Then prints the full log of the single game that showed the most of them.
// Mirrors nullPoolExpansionMatchDemo.ts's shape.

import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { createInitialState } from "../state/init.js";
import type { DeckSpec } from "../state/init.js";
import { Rng } from "../state/rng.js";
import { getLegalMoves } from "../engine/moves.js";
import { applyMove, beginTurn } from "../engine/engine.js";
import { buildPlayerView } from "../agents/agent.js";
import { formatLog } from "../log/format.js";
import { currentAttack } from "../state/queries.js";
import type { GameState, PlayerId } from "../state/types.js";

const MECHANISMS = [
  "Rate Limiter sweep",
  "Load Balancer onAttack",
  "Hotfix instant",
  "Deadlock Detector stun",
  "Quorum Arbiter scaling",
] as const;
type Mechanism = (typeof MECHANISMS)[number];

const OPPONENTS: { name: string; build: (id: DeckSpec["id"], name: string) => DeckSpec }[] = [
  { name: "Swarm", build: buildSwarmDeck },
  { name: "Aegis", build: buildAegisDeck },
  { name: "Null", build: buildNullDeck },
];

interface Attempt {
  seed: number;
  opponent: string;
  state: GameState;
  found: Map<Mechanism, string>;
}

/** The engine logs an ability's trigger, then that ability's own effects, so
 * "this trigger actually did something" is the entry straight after it. */
function followedBy(fresh: GameState["log"], i: number, type: string): GameState["log"][number] | undefined {
  const next = fresh[i + 1];
  return next?.type === type ? next : undefined;
}

async function tryOne(seed: number, opponent: (typeof OPPONENTS)[number]): Promise<Attempt> {
  // Cortex is always p1 here, so the Cortex player id is fixed.
  const deckA = buildCortexDeck("p1", "Cortex Deck");
  const deckB = opponent.build("p2", `${opponent.name} Deck`);
  const agentA = new LookaheadAgent("Lookahead-Cortex", seed);
  const agentB = new LookaheadAgent(`Lookahead-${opponent.name}`, seed + 1);

  const rng = new Rng(seed);
  const state = createInitialState(deckA, deckB, rng);
  state.players.p1.name = agentA.name;
  state.players.p2.name = agentB.name;
  state.turnNumber = 1;
  state.activePlayer = "p1";
  beginTurn(state, "p1", rng, { draw: false });

  const agents = { p1: agentA, p2: agentB } as const;
  const found = new Map<Mechanism, string>();
  let movesPlayed = 0;

  while (!state.winner && movesPlayed < 5000) {
    const legalMoves = getLegalMoves(state);
    if (legalMoves.length === 0) break;
    const agent = agents[state.priority];
    const view = buildPlayerView(state, state.priority);
    const move = await agent.decideMove(view, legalMoves);
    const activeAtMove = state.activePlayer as PlayerId;
    const turnAtMove = state.turnNumber;

    // Quorum Arbiter: read its live attack at the moment it is declared.
    if (move.type === "attack" && !found.has("Quorum Arbiter scaling")) {
      const unit = state.players.p1.board.find((u) => u.instanceId === move.attackerInstanceId);
      if (unit?.card.name === "Quorum Arbiter") {
        const atk = currentAttack(state, unit);
        const enemies = state.players.p2.board.length;
        if (atk > unit.card.attack) {
          found.set(
            "Quorum Arbiter scaling",
            `turn ${turnAtMove}: Quorum Arbiter attacked with ${atk} attack (printed 3) into a ${enemies}-unit enemy board`,
          );
        }
      }
    }

    const logStart = state.log.length;
    applyMove(state, move, rng);
    movesPlayed++;

    const fresh = state.log.slice(logStart);
    for (let i = 0; i < fresh.length; i++) {
      const e = fresh[i]!;
      if (e.type === "abilityTrigger" && e.source === "Rate Limiter" && !found.has("Rate Limiter sweep")) {
        const hit = followedBy(fresh, i, "damage");
        if (hit?.type === "damage") {
          // Count the damage entries in the run of effect entries straight
          // after the trigger (a base-armor reduction can sit between them).
          let hits = 0;
          for (let j = i + 1; j < fresh.length; j++) {
            const x = fresh[j]!;
            if (x.type === "damage") hits++;
            else if (x.type !== "baseArmorReduced") break;
          }
          found.set("Rate Limiter sweep", `turn ${turnAtMove}: Rate Limiter fired at Cortex's turn start and hit ${hits} enemy units for 1 each`);
        }
      }
      if (e.type === "abilityTrigger" && e.source === "Load Balancer" && e.trigger === "onAttack" && !found.has("Load Balancer onAttack")) {
        const hit = followedBy(fresh, i, "damage");
        if (hit?.type === "damage") {
          found.set("Load Balancer onAttack", `turn ${turnAtMove}: Load Balancer attacked and its onAttack pinged ${hit.target} for ${hit.amount}`);
        }
      }
      if (e.type === "cast" && e.card === "Hotfix" && e.player === "p1" && activeAtMove === "p2" && !found.has("Hotfix instant")) {
        found.set("Hotfix instant", `turn ${turnAtMove}: Cortex cast Hotfix at Instant speed during ${opponent.name}'s turn`);
      }
      if (e.type === "abilityTrigger" && e.source === "Deadlock Detector" && !found.has("Deadlock Detector stun")) {
        const stun = followedBy(fresh, i, "statusApplied");
        if (stun?.type === "statusApplied") {
          found.set("Deadlock Detector stun", `turn ${turnAtMove}: Deadlock Detector entered against a 3+ unit board and stunned ${stun.target}`);
        }
      }
    }
  }

  return { seed, opponent: opponent.name, state, found };
}

const maxSeed = Number(process.argv[2] ?? 60);

const firstSeen = new Map<Mechanism, Attempt>();
let best: Attempt | undefined;
outer: for (let seed = 1; seed <= maxSeed; seed++) {
  for (const opponent of OPPONENTS) {
    const attempt = await tryOne(seed, opponent);
    for (const m of attempt.found.keys()) if (!firstSeen.has(m)) firstSeen.set(m, attempt);
    if (!best || attempt.found.size > best.found.size) best = attempt;
    if (firstSeen.size === MECHANISMS.length && best.found.size >= 4) break outer;
  }
}

console.log("AI-TCG Phase 5 Cortex slice evidence (the last per-faction Phase 5 slice)");
console.log("Both sides played by LookaheadAgent; Cortex (p1) against Swarm, Aegis and Null in turn.");
console.log("");
for (const m of MECHANISMS) {
  const a = firstSeen.get(m);
  console.log(`--- ${m} ---`);
  console.log(a ? `  Found at seed ${a.seed} vs ${a.opponent}: ${a.found.get(m)}.` : `  Not observed in seeds [1, ${maxSeed}] — try a higher range.`);
}
console.log("");
if (best) {
  console.log(`=== Full match log: seed ${best.seed}, Cortex vs ${best.opponent} — ${best.found.size}/${MECHANISMS.length} new mechanisms in one game ===`);
  for (const [m, detail] of best.found) console.log(`  * ${m}: ${detail}`);
  console.log("");
  console.log(formatLog(best.state.log));
  console.log("");
  console.log(`Winner: ${best.state.winner}, turns: ${best.state.turnNumber}`);
}
