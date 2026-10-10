// Real-play evidence for the signature zone (session 31): Cortex vs Swarm,
// both LookaheadAgent with the edge-measure seeding, each set Mythic in its
// signature zone (withSetMythicSignature). Prints the first game in which a
// signature card is played, dies, goes back to its zone and is played again
// at the +2 surcharge, then the full ordinary text log, with a zone summary
// after every signature event.
//
// Usage: npx tsx src/dev/signatureZoneMatchDemo.ts [maxSeed=400]

import { buildCortexDeck, buildSwarmDeck, withSetMythicSignature } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import { formatEvent } from "../log/format.js";
import type { GameState } from "../state/types.js";

const maxSeed = Number(process.argv[2] ?? 400);

function replayed(state: GameState): boolean {
  return (["p1", "p2"] as const).some((pid) => (state.players[pid].signature?.timesPlayed ?? 0) >= 2);
}

for (let seed = 1; seed <= maxSeed; seed++) {
  // measurePairing's seat rule: Cortex (slot A) goes first on odd seeds.
  const cortex = withSetMythicSignature(buildCortexDeck(seed % 2 === 1 ? "p1" : "p2", "Cortex Deck"));
  const swarm = withSetMythicSignature(buildSwarmDeck(seed % 2 === 1 ? "p2" : "p1", "Swarm Deck"));
  const a = new LookaheadAgent("Lookahead-Cortex", seed * 104729 + 31);
  const b = new LookaheadAgent("Lookahead-Swarm", seed * 104729 + 31);
  const { state } = seed % 2 === 1 ? await runMatch(cortex, swarm, a, b, seed) : await runMatch(swarm, cortex, b, a, seed);
  if (!replayed(state)) continue;

  const lines: string[] = [];
  lines.push(`AI-TCG signature-zone demo: Cortex vs Swarm, seed ${seed} (first seed in 1-${maxSeed} with a signature replay)`);
  lines.push(`p1 = ${state.players.p1.name}, p2 = ${state.players.p2.name}`);
  for (const pid of ["p1", "p2"] as const) {
    const z = state.players[pid].signature!;
    const deckSize = (state.players[pid].name.endsWith("Cortex") ? cortex : swarm).cards.length;
    lines.push(`${pid} signature card: ${z.card.name} (${z.card.cost} cost, ${z.card.attack}/${z.card.health}); deck ${deckSize} cards, the Mythic not among them`);
  }
  lines.push("Lines marked SIG are the signature zone's own events; [zone ...] is the zone straight after.");
  lines.push("");
  for (const e of state.log) {
    const text = formatEvent(e);
    const sig = (e.type === "play" && e.fromSignatureZone) || e.type === "signatureReturn";
    lines.push(sig ? `SIG ${text.trimStart()}` : text);
    if (sig) {
      const pid = e.player;
      const z = state.players[pid].signature!;
      // The log is final state, so recount the zone at this point from the log itself.
      const idx = state.log.indexOf(e);
      const played = state.log.slice(0, idx + 1).filter((x) => x.type === "play" && x.player === pid && x.fromSignatureZone).length;
      lines.push(`   [zone ${pid}: ${z.card.name}, played ${played}x, ${e.type === "signatureReturn" ? `waiting, next play costs ${e.nextCost}` : "on the board"}]`);
    }
  }
  lines.push("");
  lines.push(`Turns: ${state.turnNumber}. Signature plays: p1 ${state.players.p1.signature!.timesPlayed}, p2 ${state.players.p2.signature!.timesPlayed}.`);
  console.log(lines.join("\n"));
  process.exit(0);
}
console.log(`no replay in seeds 1-${maxSeed}`);
