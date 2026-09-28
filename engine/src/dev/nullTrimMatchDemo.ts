// Real-play evidence for the 2026-09-28 Null consistency trim (40 -> 36; see
// data/nullCards.ts's NULL_CARDS comment and nullTrimSearch.ts). The trim's
// two stated goals were a stronger Null through density alone and more
// frequent Kernel Panic arcs (Glitch Seed -> Corrupted Process -> Kernel
// Panic, Null's signature finisher). This plays the shipped 36-card deck in
// real LookaheadAgent-vs-LookaheadAgent games against Aegis, the edge the
// ring says Null should win, with the exact seeding of lookaheadEdgeCheck.ts.
// It prints the first game Null wins after completing the Kernel Panic
// evolution, with its full log.
//
// Usage: npx tsx src/dev/nullTrimMatchDemo.ts [maxSeed=200]

import { buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import { formatLog } from "../log/format.js";
import type { GameState, PlayerId } from "../state/types.js";

const maxSeed = Number(process.argv[2] ?? 200);

function evolvedTo(state: GameState, pid: PlayerId, name: string): number | undefined {
  let turn = 0;
  for (const e of state.log) {
    if (e.type === "turnStart") turn = e.turn;
    if (e.type === "evolve" && e.player === pid && e.to === name) return turn;
  }
  return undefined;
}

let kpGames = 0;
let found: { seed: number; state: GameState; nullPid: PlayerId; kpTurn: number } | undefined;
for (let seed = 1; seed <= maxSeed; seed++) {
  // Aegis sits before Null in FACTIONS order, so Aegis is slot A.
  const aegisFirst = seed % 2 === 1;
  const aegis = new LookaheadAgent("Lookahead-Aegis", seed * 104729 + 31);
  const nul = new LookaheadAgent("Lookahead-Null", seed * 104729 + 31);
  const { state } = aegisFirst
    ? await runMatch(buildAegisDeck("p1", "Aegis Deck"), buildNullDeck("p2", "Null Deck"), aegis, nul, seed)
    : await runMatch(buildNullDeck("p1", "Null Deck"), buildAegisDeck("p2", "Aegis Deck"), nul, aegis, seed);
  const nullPid: PlayerId = aegisFirst ? "p2" : "p1";
  const kpTurn = evolvedTo(state, nullPid, "Kernel Panic");
  if (kpTurn !== undefined) kpGames++;
  if (!found && kpTurn !== undefined && state.winner === nullPid) found = { seed, state, nullPid, kpTurn };
}

console.log("AI-TCG Null consistency trim evidence (2026-09-28): the shipped 36-card Null deck vs Aegis");
console.log("Both sides LookaheadAgent, seeding identical to lookaheadEdgeCheck.ts.");
console.log(`Null completed the Kernel Panic evolution in ${kpGames} of ${maxSeed} games vs Aegis.`);
if (!found) {
  console.log(`No Null win with a Kernel Panic evolution in seeds 1-${maxSeed}; try a higher range.`);
} else {
  const { seed, state, nullPid, kpTurn } = found;
  console.log("");
  console.log(`=== Full match log: seed ${seed}, Null is ${nullPid}; Kernel Panic evolved on turn ${kpTurn}; Null wins ===`);
  console.log("");
  console.log(formatLog(state.log));
  console.log("");
  console.log(`Winner: ${state.winner}, turns: ${state.turnNumber}`);
}
