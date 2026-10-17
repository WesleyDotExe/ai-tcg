// Evidence for the owner's 2026-10-18 game-lane side task (session 38):
//  1. unique signature ability ids: over generated agents' signature cards,
//     how many ids named more than one ability under the old scheme (every
//     size shared the standard's id) and under the new one (a size adds its
//     key), with every id and its rules text;
//  2. engine reason text: the game-over events of real matches, with the
//     cause the event now carries as data.
// Everything is seeded, so the file reproduces exactly.
//
// Usage (from engine/): npx tsx src/dev/signatureAbilityIdReport.ts > ../progress/signature-ability-ids-001.txt

import { generateAgentCandidates, generateSignatureCandidates, signatureCardFor } from "../data/agentGenerator.js";
import { SIGNATURE_MENU, legacySignatureAbilityId, optionAtSize } from "../data/signatureMenu.js";
import { buildAegisDeck, buildCortexDeck, buildNullDeck, buildSwarmDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import type { Ability } from "../cards/types.js";

const say = (line = "") => console.log(line);
const behaviour = (a: Ability) => JSON.stringify({ ...a, id: undefined });

function generated(agents: number): Ability[] {
  const out: Ability[] = [];
  const taken = { agentNames: new Set<string>(), cardNames: new Set<string>() };
  for (let seed = 1; seed <= agents; seed++) {
    const agent = generateAgentCandidates(seed, taken)[0]!;
    taken.agentNames.add(agent.name);
    // The owner sees 3 candidates and keeps one: count all three, as render did.
    for (const c of generateSignatureCandidates(seed * 7919, agent.name, taken)) {
      taken.cardNames.add(c.name);
      out.push(...signatureCardFor(c, `sig-R-${seed}`).abilities);
    }
  }
  return out;
}

/** id -> the distinct abilities it named. */
function byId(abilities: Ability[], id: (a: Ability) => string): Map<string, Map<string, string>> {
  const m = new Map<string, Map<string, string>>();
  for (const a of abilities) {
    const k = id(a);
    if (!m.has(k)) m.set(k, new Map());
    m.get(k)!.set(behaviour(a), a.text);
  }
  return m;
}

say("# Unique signature ability ids (owner 2026-10-18, session 38)");
say();
for (const agents of [300, 3000]) {
  const abilities = generated(agents);
  const before = byId(abilities, (a) => legacySignatureAbilityId(a.id));
  const after = byId(abilities, (a) => a.id);
  const clashing = (m: Map<string, Map<string, string>>) => [...m].filter(([, v]) => v.size > 1);
  // Render's count: abilities whose id is shared with a different version.
  const clashCards = (id: (a: Ability) => string, m: Map<string, Map<string, string>>) => abilities.filter((a) => m.get(id(a))!.size > 1).length;
  say(`## ${agents} generated agents (${abilities.length} abilities on ${agents * 3} candidate cards)`);
  say(`  old ids: ${before.size} ids, ${clashing(before).length} naming more than one ability; ${clashCards((a) => legacySignatureAbilityId(a.id), before)} abilities carry a shared id`);
  for (const [id, v] of clashing(before)) say(`    ${id}: ${[...v.values()].map((t) => JSON.stringify(t)).join(" / ")}`);
  say(`  new ids: ${after.size} ids, ${clashing(after).length} naming more than one ability; ${clashCards((a) => a.id, after)} abilities carry a shared id`);
  for (const [id, v] of [...after].sort(([a], [b]) => a.localeCompare(b))) say(`    ${id.padEnd(24)} ${[...v.values()].map((t) => JSON.stringify(t)).join(" / ")}`);
  say();
}

say("## Every option at every size (the whole menu, not only the approved lines)");
let total = 0;
const all = new Map<string, Set<string>>();
for (const option of SIGNATURE_MENU) {
  for (const size of [undefined, ...option.sizes.map((s) => s.key)]) {
    for (const a of optionAtSize(option, size).abilities) {
      total += 1;
      all.set(a.id, (all.get(a.id) ?? new Set()).add(behaviour(a)));
    }
  }
}
say(`  ${total} ability versions, ${all.size} ids, ${[...all.values()].filter((v) => v.size > 1).length} clashes`);
say();

say("# Engine reason text (owner 2026-10-18): game over as text and as data");
say("  The raw log names seats; the feed names agents, so \"p2's health reached 0\" reads");
say("  \"<agent>'s health reached 0\" (it used to be \"<agent> health depleted\").");
say();
const decks = [buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck];
const names = ["Cortex", "Swarm", "Aegis", "Null"];
for (let i = 0; i < 4; i++) {
  const seed = 101 + i;
  const { state } = await runMatch(decks[i]!("p1", names[i]!), decks[(i + 1) % 4]!("p2", names[(i + 1) % 4]!), new LookaheadAgent("A", seed), new LookaheadAgent("B", seed + 50), seed);
  const end = state.log.find((e) => e.type === "gameOver")!;
  if (end.type !== "gameOver") continue;
  say(`  ${names[i]} vs ${names[(i + 1) % 4]}, seed ${seed}: winner ${end.winner}; reason "${end.reason}"; cause ${JSON.stringify(end.cause)}; health p1 ${state.players.p1.health}, p2 ${state.players.p2.health}, turn ${state.turnNumber}`);
}
