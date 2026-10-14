// Real-play evidence for the owner's 2026-10-13 call 3, "Guard takes
// priority over Bulwark" (session 33). Aegis carries Bulwark (cost 5, 3/6)
// as its signature card, Cortex the plain reference card; both decks as
// shipped, LookaheadAgent with the edge-measure seeding. Prints the first
// game in which Cortex attacks while Bulwark is on the board AND an Aegis
// Guard unit is protecting it (Bulwark must stand aside), and in which
// Bulwark also pulls an attack onto itself once no Guard is up.
//
// The Guard check reads the live state when Cortex's agent declares the
// attack (a dev-only observer around the agent; the agent itself sees only
// its PlayerView). Then the same seed is replayed with session 32's Bulwark
// (no Guard rule) to show what the rule changed in that game.
//
// Usage: npx tsx src/dev/bulwarkGuardMatchDemo.ts [maxSeed=400]

import { buildAegisDeck, buildCortexDeck } from "../data/decks.js";
import { buildSignatureCard } from "../data/signatureMenu.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import type { Agent } from "../agents/agent.js";
import { runMatch } from "../engine/match.js";
import { formatEvent } from "../log/format.js";
import { activeGuards } from "../state/queries.js";
import type { GameState, PlayerId } from "../state/types.js";
import type { UnitCard } from "../cards/types.js";
import { REFERENCE_SIGNATURE } from "./signatureFairness.js";

const maxSeed = Number(process.argv[2] ?? 400);
const bulwark = buildSignatureCard({ ability: "bulwark", tier: 5, attack: 3, health: 6 }, { name: "Bulwark (sig5-3x6-bulwark)" });
// Session 32's Bulwark: the same card without the Guard condition.
const oldBulwark: UnitCard = { ...bulwark, abilities: bulwark.abilities.map(({ condition: _c, ...a }) => a) };

interface Watched {
  state?: GameState;
  /** Log lengths at which Cortex declared an attack past a protecting Guard
   * with Bulwark on the board (the attack event is the next log entry). */
  guardedAttacks: number[];
}

/** Notes every attack Cortex declares while Aegis has Bulwark (armed) and an
 * active Guard on the board. Passes the agent's own choice through. */
function observe(agent: Agent, watched: Watched, aegisPid: () => PlayerId): Agent {
  return {
    name: agent.name,
    async decideMove(view, legal) {
      const move = await agent.decideMove(view, legal);
      const s = watched.state;
      if (s && move.type === "attack") {
        const aegis = aegisPid();
        const bulwarkUp = s.players[aegis].board.some((u) => u.card.id === bulwark.id && !u.pending);
        if (bulwarkUp && activeGuards(s, aegis).some((u) => u.card.id !== bulwark.id)) watched.guardedAttacks.push(s.log.length);
      }
      return move;
    },
  };
}

async function play(seed: number, aegisSignature: UnitCard): Promise<{ state: GameState; watched: Watched }> {
  // measurePairing's seat rule: Cortex (slot A) goes first on odd seeds.
  const cortexPid: PlayerId = seed % 2 === 1 ? "p1" : "p2";
  const aegisPid: PlayerId = cortexPid === "p1" ? "p2" : "p1";
  const cortex = { ...buildCortexDeck(cortexPid, "Cortex Deck"), signature: REFERENCE_SIGNATURE };
  const aegis = { ...buildAegisDeck(aegisPid, "Aegis Deck"), signature: aegisSignature };
  const watched: Watched = { guardedAttacks: [] };
  const a = observe(new LookaheadAgent("Lookahead-Cortex", seed * 104729 + 31), watched, () => aegisPid);
  const b = new LookaheadAgent("Lookahead-Aegis", seed * 104729 + 31);
  const hooks = { onMatchStart: (s: GameState) => (watched.state = s) };
  const { state } = seed % 2 === 1 ? await runMatch(cortex, aegis, a, b, seed, hooks) : await runMatch(aegis, cortex, b, a, seed, hooks);
  return { state, watched };
}

for (let seed = 1; seed <= maxSeed; seed++) {
  const { state, watched } = await play(seed, bulwark);
  const pulls = state.log.filter((e) => e.type === "attackRedirected" && e.source === bulwark.name).length;
  if (watched.guardedAttacks.length === 0 || pulls === 0) continue;

  // Each recorded log length points at or just before its attack event
  // (onAttack triggers log first).
  const attackAt = (i: number) => state.log.findIndex((e, j) => j >= i && e.type === "attack");
  const guarded = new Set(watched.guardedAttacks.map(attackAt));
  const lines: string[] = [];
  lines.push(`AI-TCG Guard-over-Bulwark demo (owner 2026-10-13, call 3): Cortex vs Aegis (Bulwark), seed ${seed}`);
  lines.push(`(first seed in 1-${maxSeed} where Bulwark both stands aside for a Guard and pulls an attack)`);
  lines.push(`p1 = ${state.players.p1.name}, p2 = ${state.players.p2.name}`);
  lines.push(`Bulwark: 5 cost, 3/6, "${bulwark.abilities[0]!.text}" (once per turn)`);
  lines.push("SIG   = a signature-card line.");
  lines.push("GUARD = Cortex attacks while Bulwark is on the board and an Aegis Guard unit protects the side:");
  lines.push("        the attack is forced onto the Guard and Bulwark doesn't step in (no redirect follows).");
  lines.push("");
  state.log.forEach((e, i) => {
    const text = formatEvent(e);
    if (guarded.has(i)) lines.push(`GUARD ${text.trimStart()}`);
    else if (
      (e.type === "play" && e.fromSignatureZone) ||
      e.type === "signatureReturn" ||
      (e.type === "abilityTrigger" && e.ability.startsWith("sig-")) ||
      (e.type === "attackRedirected" && e.source === bulwark.name)
    )
      lines.push(`SIG   ${text.trimStart()}`);
    else lines.push(text);
  });
  lines.push("");
  lines.push(`Turns: ${state.turnNumber}. Attacks past a protecting Guard (Bulwark stood aside): ${watched.guardedAttacks.length}.`);
  lines.push(`Attacks Bulwark pulled onto itself: ${pulls}. Winner: ${state.winner}.`);
  // A redirect right after a GUARD attack would be the rule failing.
  const broken = [...guarded].filter((i) => state.log[i + 1]?.type === "attackRedirected" || state.log[i + 2]?.type === "attackRedirected");
  lines.push(`Redirects right after a GUARD attack (must be 0): ${broken.length}.`);

  const old = await play(seed, oldBulwark);
  const oldPulls = old.state.log.filter((e) => e.type === "attackRedirected" && e.source === bulwark.name).length;
  lines.push("");
  lines.push(`Same seed with session 32's Bulwark (no Guard rule): Bulwark pulled ${oldPulls} attack(s), ${old.state.turnNumber} turns, winner ${old.state.winner}.`);
  console.log(lines.join("\n"));
  process.exit(0);
}
console.log(`no game in seeds 1-${maxSeed} with both`);
