// Real-play evidence for the Neutral signature menu (session 32): Cortex
// carries Hunter (Rush; +1/+1 whenever it destroys a unit), Aegis carries
// Bulwark (takes the first attack aimed at its side each turn), both cost 5,
// 3/6, both decks as shipped, LookaheadAgent with the edge-measure seeding.
// Prints the first game in which Hunter's onKill fires AND Bulwark pulls an
// attack onto itself, with every signature-card line marked SIG.
//
// These are the two menu options that needed new engine triggers (onKill,
// onEnemyAttack + the once-per-turn limit), so this is the game-level check
// that they work in real play, not just in the whitebox tests.
//
// Usage: npx tsx src/dev/signatureMenuMatchDemo.ts [maxSeed=400]

import { buildAegisDeck, buildCortexDeck } from "../data/decks.js";
import { buildSignatureCard } from "../data/signatureMenu.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import { formatEvent } from "../log/format.js";

const maxSeed = Number(process.argv[2] ?? 400);
const hunter = buildSignatureCard({ ability: "hunter", tier: 5, attack: 3, health: 6 }, { name: "Hunter (sig5-3x6-hunter)" });
const bulwark = buildSignatureCard({ ability: "bulwark", tier: 5, attack: 3, health: 6 }, { name: "Bulwark (sig5-3x6-bulwark)" });

for (let seed = 1; seed <= maxSeed; seed++) {
  // measurePairing's seat rule: Cortex (slot A) goes first on odd seeds.
  const cortex = { ...buildCortexDeck(seed % 2 === 1 ? "p1" : "p2", "Cortex Deck"), signature: hunter };
  const aegis = { ...buildAegisDeck(seed % 2 === 1 ? "p2" : "p1", "Aegis Deck"), signature: bulwark };
  const a = new LookaheadAgent("Lookahead-Cortex", seed * 104729 + 31);
  const b = new LookaheadAgent("Lookahead-Aegis", seed * 104729 + 31);
  const { state } = seed % 2 === 1 ? await runMatch(cortex, aegis, a, b, seed) : await runMatch(aegis, cortex, b, a, seed);
  const kills = state.log.filter((e) => e.type === "abilityTrigger" && e.ability === "sig-hunter").length;
  const pulls = state.log.filter((e) => e.type === "attackRedirected" && e.source === bulwark.name).length;
  if (kills === 0 || pulls === 0) continue;

  const lines: string[] = [];
  lines.push(`AI-TCG signature-menu demo: Cortex (Hunter) vs Aegis (Bulwark), seed ${seed} (first seed in 1-${maxSeed} where both fire)`);
  lines.push(`p1 = ${state.players.p1.name}, p2 = ${state.players.p2.name}`);
  lines.push(`Hunter: 5 cost, 3/6, Rush, "${hunter.abilities[0]!.text}"`);
  lines.push(`Bulwark: 5 cost, 3/6, "${bulwark.abilities[0]!.text}" (once per turn)`);
  lines.push("Lines marked SIG involve a signature card.");
  lines.push("");
  for (const e of state.log) {
    const text = formatEvent(e);
    const sig =
      (e.type === "play" && e.fromSignatureZone) ||
      e.type === "signatureReturn" ||
      (e.type === "abilityTrigger" && e.ability.startsWith("sig-")) ||
      (e.type === "attackRedirected" && e.source === bulwark.name) ||
      (e.type === "buff" && e.source === hunter.name);
    lines.push(sig ? `SIG ${text.trimStart()}` : text);
  }
  lines.push("");
  lines.push(`Turns: ${state.turnNumber}. Hunter kills that grew it: ${kills}. Attacks Bulwark pulled onto itself: ${pulls}. Winner: ${state.winner}.`);
  console.log(lines.join("\n"));
  process.exit(0);
}
console.log(`no game in seeds 1-${maxSeed} with both`);
