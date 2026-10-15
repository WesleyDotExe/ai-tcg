// Real-play evidence for the owner's 2026-10-15 Bulwark rework (option A):
// "takes the first attack aimed at one of your units (never you)", still
// standing aside for a Guard (owner 2026-10-13, call 3). Built session 34.
//
// Aegis carries Bulwark (cost 5, 3/6) as its signature card, Cortex the
// plain reference card; both decks as shipped, LookaheadAgent with the
// edge-measure seeding. Prints the first game in which Cortex attacks the
// Aegis PLAYER while Bulwark is armed with its redirect unused that turn and
// no Guard up (FACE: Bulwark must let it through), and in which Bulwark also
// pulls an attack aimed at another Aegis unit onto itself (SIG).
//
// The check reads the live state when Cortex's agent declares the attack (a
// dev-only observer around the agent; the agent itself sees only its
// PlayerView).
//
// Usage: npx tsx src/dev/bulwarkUnitsMatchDemo.ts [maxSeed=400]

import { buildAegisDeck, buildCortexDeck } from "../data/decks.js";
import { buildSignatureCard } from "../data/signatureMenu.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import type { Agent } from "../agents/agent.js";
import { runMatch } from "../engine/match.js";
import { formatEvent } from "../log/format.js";
import { activeGuards } from "../state/queries.js";
import type { GameState, PlayerId } from "../state/types.js";
import { REFERENCE_SIGNATURE } from "./signatureFairness.js";

const maxSeed = Number(process.argv[2] ?? 400);
const bulwark = buildSignatureCard({ ability: "bulwark", tier: 5, attack: 3, health: 6 }, { name: "Bulwark (sig5-3x6-bulwark)" });

interface Watched {
  state?: GameState;
  /** Log lengths at which Cortex declared an attack on the Aegis player with
   * Bulwark armed, its redirect unused this turn, and no Guard up. */
  faceAttacks: number[];
}

function observe(agent: Agent, watched: Watched, aegisPid: () => PlayerId): Agent {
  return {
    name: agent.name,
    async decideMove(view, legal) {
      const move = await agent.decideMove(view, legal);
      const s = watched.state;
      if (s && move.type === "attack" && move.target.kind === "player") {
        const aegis = aegisPid();
        const b = s.players[aegis].board.find((u) => u.card.id === bulwark.id && !u.pending);
        if (b && b.usedThisTurn === undefined && activeGuards(s, aegis).length === 0) watched.faceAttacks.push(s.log.length);
      }
      return move;
    },
  };
}

async function play(seed: number): Promise<{ state: GameState; watched: Watched }> {
  // measurePairing's seat rule: Cortex (slot A) goes first on odd seeds.
  const cortexPid: PlayerId = seed % 2 === 1 ? "p1" : "p2";
  const aegisPid: PlayerId = cortexPid === "p1" ? "p2" : "p1";
  const cortex = { ...buildCortexDeck(cortexPid, "Cortex Deck"), signature: REFERENCE_SIGNATURE };
  const aegis = { ...buildAegisDeck(aegisPid, "Aegis Deck"), signature: bulwark };
  const watched: Watched = { faceAttacks: [] };
  const a = observe(new LookaheadAgent("Lookahead-Cortex", seed * 104729 + 31), watched, () => aegisPid);
  const b = new LookaheadAgent("Lookahead-Aegis", seed * 104729 + 31);
  const hooks = { onMatchStart: (s: GameState) => (watched.state = s) };
  const { state } = seed % 2 === 1 ? await runMatch(cortex, aegis, a, b, seed, hooks) : await runMatch(aegis, cortex, b, a, seed, hooks);
  return { state, watched };
}

for (let seed = 1; seed <= maxSeed; seed++) {
  const { state, watched } = await play(seed);
  const pulls = state.log.filter((e) => e.type === "attackRedirected" && e.source === bulwark.name);
  if (watched.faceAttacks.length === 0 || pulls.length === 0) continue;

  const attackAt = (i: number) => state.log.findIndex((e, j) => j >= i && e.type === "attack");
  const face = new Set(watched.faceAttacks.map(attackAt));
  const lines: string[] = [];
  lines.push(`AI-TCG Bulwark "units only" demo (owner 2026-10-15, option A): Cortex vs Aegis (Bulwark), seed ${seed}`);
  lines.push(`(first seed in 1-${maxSeed} where Bulwark both lets an attack on its player through and pulls an attack off a unit)`);
  lines.push(`p1 = ${state.players.p1.name}, p2 = ${state.players.p2.name}`);
  lines.push(`Bulwark: 5 cost, 3/6, "${bulwark.abilities[0]!.text}" (once per turn)`);
  lines.push("SIG  = a signature-card line (Bulwark redirecting an attack aimed at another unit is one).");
  lines.push("FACE = Cortex attacks the Aegis player while Bulwark is armed, unused this turn, with no Guard up:");
  lines.push("       Bulwark never covers its player, so the attack goes through (no redirect follows).");
  lines.push("");
  state.log.forEach((e, i) => {
    const text = formatEvent(e);
    if (face.has(i)) lines.push(`FACE ${text.trimStart()}`);
    else if (
      (e.type === "play" && e.fromSignatureZone) ||
      e.type === "signatureReturn" ||
      (e.type === "attackRedirected" && e.source === bulwark.name)
    )
      lines.push(`SIG  ${text.trimStart()}`);
    else lines.push(text);
  });
  lines.push("");
  const fromUnits = pulls.filter((e) => e.type === "attackRedirected" && e.fromRef?.kind === "unit").length;
  lines.push(`Turns: ${state.turnNumber}. Attacks on the Aegis player past an armed, unused Bulwark: ${face.size}.`);
  lines.push(`Attacks Bulwark pulled onto itself: ${pulls.length}, all aimed at a unit: ${fromUnits === pulls.length ? "yes" : "NO"}. Winner: ${state.winner}.`);
  const broken = [...face].filter((i) => state.log[i + 1]?.type === "attackRedirected" || state.log[i + 2]?.type === "attackRedirected");
  lines.push(`Redirects right after a FACE attack (must be 0): ${broken.length}.`);
  console.log(lines.join("\n"));
  process.exit(0);
}
console.log(`no game in seeds 1-${maxSeed} with both`);
