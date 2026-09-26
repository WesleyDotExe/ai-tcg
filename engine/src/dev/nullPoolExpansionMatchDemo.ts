// Real, unscripted-play evidence for the Null slice of Phase 5 pool
// expansion (2026-09-26 owner-feedback entry: "Null — as a DEPTH / VARIETY
// pass, not a power buff"). Searches real LookaheadAgent-vs-LookaheadAgent
// games (Null against each other faction in turn) for all five of this
// slice's new cards doing their specific new thing mid-game, detected from
// the engine's own event log — not a whitebox fixture:
//
//   Zombie Process    onDeath   -> a "summon" whose source is Zombie Process
//   Dangling Pointer  Rush      -> an attack by it on the same turn it was played
//   Bit Rot           Instant   -> cast on the OPPONENT's turn (reactive play)
//   Watchdog Timer    onTurnEnd -> a Null draw right after its own onTurnEnd trigger
//   Garbage Collector activated -> a "heal" whose source is Garbage Collector
//
// Then prints the full log of the single game that showed the most of them.
// Mirrors swarmPoolExpansionMatchDemo.ts's shape.

import { buildNullDeck, buildCortexDeck, buildSwarmDeck, buildAegisDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { createInitialState } from "../state/init.js";
import type { DeckSpec } from "../state/init.js";
import { Rng } from "../state/rng.js";
import { getLegalMoves } from "../engine/moves.js";
import { applyMove, beginTurn } from "../engine/engine.js";
import { buildPlayerView } from "../agents/agent.js";
import { formatLog } from "../log/format.js";
import type { GameState } from "../state/types.js";

const MECHANISMS = ["Zombie Process onDeath", "Dangling Pointer Rush", "Bit Rot instant", "Watchdog Timer draw", "Garbage Collector heal"] as const;
type Mechanism = (typeof MECHANISMS)[number];

const OPPONENTS: { name: string; build: (id: DeckSpec["id"], name: string) => DeckSpec }[] = [
  { name: "Cortex", build: buildCortexDeck },
  { name: "Swarm", build: buildSwarmDeck },
  { name: "Aegis", build: buildAegisDeck },
];

interface Attempt {
  seed: number;
  opponent: string;
  state: GameState;
  found: Map<Mechanism, string>;
}

async function tryOne(seed: number, opponent: (typeof OPPONENTS)[number]): Promise<Attempt> {
  // Null is always p2 here, so the Null player id is fixed.
  const deckA = opponent.build("p1", `${opponent.name} Deck`);
  const deckB = buildNullDeck("p2", "Null Deck");
  const agentA = new LookaheadAgent(`Lookahead-${opponent.name}`, seed);
  const agentB = new LookaheadAgent("Lookahead-Null", seed + 1);

  const rng = new Rng(seed);
  const state = createInitialState(deckA, deckB, rng);
  state.players.p1.name = agentA.name;
  state.players.p2.name = agentB.name;
  state.turnNumber = 1;
  state.activePlayer = "p1";
  beginTurn(state, "p1", rng, { draw: false });

  const agents = { p1: agentA, p2: agentB } as const;
  const found = new Map<Mechanism, string>();
  const pointerPlayedTurn = new Map<string, number>(); // instanceId -> turn
  let movesPlayed = 0;

  while (!state.winner && movesPlayed < 5000) {
    const legalMoves = getLegalMoves(state);
    if (legalMoves.length === 0) break;
    const agent = agents[state.priority];
    const view = buildPlayerView(state, state.priority);
    const move = await agent.decideMove(view, legalMoves);
    const activeAtMove = state.activePlayer;
    const turnAtMove = state.turnNumber;
    const logStart = state.log.length;
    applyMove(state, move, rng);
    movesPlayed++;

    const fresh = state.log.slice(logStart);
    for (let i = 0; i < fresh.length; i++) {
      const e = fresh[i]!;
      if (e.type === "summon" && e.source === "Zombie Process" && !found.has("Zombie Process onDeath")) {
        found.set("Zombie Process onDeath", `turn ${turnAtMove}: Zombie Process died and left a ${e.token} behind`);
      }
      if (e.type === "play" && e.card === "Dangling Pointer" && e.instanceId) {
        pointerPlayedTurn.set(e.instanceId, state.turnNumber);
      }
      if (e.type === "cast" && e.card === "Bit Rot" && e.player === "p2" && activeAtMove === "p1" && !found.has("Bit Rot instant")) {
        found.set("Bit Rot instant", `turn ${turnAtMove}: Null cast Bit Rot at Instant speed during ${opponent.name}'s turn`);
      }
      if (e.type === "heal" && e.source === "Garbage Collector" && !found.has("Garbage Collector heal")) {
        found.set("Garbage Collector heal", `turn ${turnAtMove}: Garbage Collector restored ${e.amount} health to ${e.target}`);
      }
      // The engine logs turnEnd, then an abilityTrigger for each onTurnEnd
      // ability, then that ability's own effects — so a Watchdog draw is a
      // Null "draw" directly after Watchdog Timer's abilityTrigger entry.
      if (e.type === "abilityTrigger" && e.source === "Watchdog Timer" && !found.has("Watchdog Timer draw")) {
        const next = fresh[i + 1];
        if (next?.type === "draw" && next.player === "p2") {
          found.set("Watchdog Timer draw", `turn ${turnAtMove}: Null ended its turn with an empty hand and Watchdog Timer drew ${next.card}`);
        }
      }
    }
    // Rush: an attack declared by a Dangling Pointer on the turn it was played.
    if (move.type === "attack" && !found.has("Dangling Pointer Rush")) {
      const played = pointerPlayedTurn.get(move.attackerInstanceId);
      if (played !== undefined && played === turnAtMove) {
        found.set("Dangling Pointer Rush", `turn ${turnAtMove}: Dangling Pointer attacked the same turn it was played (Rush)`);
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

console.log(`AI-TCG Phase 5 Null slice evidence (2026-09-26 "Null — as a DEPTH / VARIETY pass" entry)`);
console.log("Both sides played by LookaheadAgent; Null (p2) against Cortex, Swarm and Aegis in turn.");
console.log("");
for (const m of MECHANISMS) {
  const a = firstSeen.get(m);
  console.log(`--- ${m} ---`);
  console.log(a ? `  Found at seed ${a.seed} vs ${a.opponent}: ${a.found.get(m)}.` : `  Not observed in seeds [1, ${maxSeed}] — try a higher range.`);
}
console.log("");
if (best) {
  console.log(`=== Full match log: seed ${best.seed}, ${best.opponent} vs Null — ${best.found.size}/${MECHANISMS.length} new mechanisms in one game ===`);
  for (const [m, detail] of best.found) console.log(`  * ${m}: ${detail}`);
  console.log("");
  console.log(formatLog(best.state.log));
  console.log("");
  console.log(`Winner: ${best.state.winner}, turns: ${best.state.turnNumber}`);
}
