// Prints sample signature card names for the owner's check-in (owner
// 2026-10-15: "show sample names at a checkpoint before they go live").
// Session 35. Everything is seeded, so the file reproduces exactly.
//
// Usage (from engine/): npx tsx src/dev/signatureNameSamples.ts > ../progress/signature-names-sample-001.txt

import { Rng } from "../state/rng.js";
import { SIGNATURE_MENU } from "../data/signatureMenu.js";
import { CARD_REGISTRY } from "../data/registry.js";
import { APPROVED_SIGNATURE_LINES } from "../data/signatureApproved.js";
import { generateAgentCandidates, generateSignatureCandidates } from "../data/agentGenerator.js";
import { HANDLES, NAME_LISTS, USERNAME_HANDLE_ODDS, signatureCardName, signatureNameSpace } from "../data/signatureNames.js";

const out: string[] = [];
const say = (s = "") => out.push(s);
const setNames = new Set([...CARD_REGISTRY.values()].map((c) => c.name));

say("AI-TCG signature card names: samples for the owner's check-in (session 35)");
say("Generator: engine/src/data/signatureNames.ts. Command: npx tsx src/dev/signatureNameSamples.ts (from engine/).");
say();
say("Templates (weights): [Handle]'s [Modifier] [Thing] 40, [Modifier] [Thing] 25, [Thing] of [Place] 15,");
say("[Handle]'s [Thing] 10, [Modifier] [Thing] [Edition] 10. The Thing hints at the ability 80% of the time,");
say("otherwise it is a generic retro-tech object. Filter: no word repeated across slots, 30 characters at most,");
say("no blocked word. A taken name (a set card or another signature card) is re-rolled.");
say();
say(`List sizes: ${HANDLES.length} handles, ${NAME_LISTS.modifiers.length} modifiers, ${NAME_LISTS.places.length} places, ${NAME_LISTS.editions.length} editions, ${NAME_LISTS.generic.length} generic things,`);
say(`and per ability group: ${Object.entries(NAME_LISTS.things).map(([g, t]) => `${g} ${t.length}`).join(", ")}.`);
say();
say("Name space per menu option (before the filter):");
for (const o of SIGNATURE_MENU) say(`  ${o.name.padEnd(18)} ${NAME_LISTS.groupOf[o.key]!.padEnd(7)} ${signatureNameSpace(o.key).toLocaleString("en-US").padStart(12)}`);
say();

say("1. Twelve names per approved option (seed 2026), as the generator makes them");
say();
const rng = new Rng(2026);
const used = new Set(setNames);
for (const ability of [...new Set(APPROVED_SIGNATURE_LINES.map((l) => l.spec.ability))].sort()) {
  const names = Array.from({ length: 12 }, () => {
    const n = signatureCardName(rng, ability, used);
    used.add(n);
    return n;
  });
  say(`  ${ability}`);
  for (let i = 0; i < names.length; i += 3) say(`    ${names.slice(i, i + 3).map((n) => n.padEnd(32)).join("")}`.trimEnd());
  say();
}

say(`2. The rare username variant (1 candidate in ${USERNAME_HANDLE_ODDS}), shown here forced on, for three example usernames`);
say();
for (const [k, username] of ["zion", "Neon_Fan99", "kestrel"].entries()) {
  const r = new Rng(7 + k);
  const names: string[] = [];
  // Draw until 4 use the username, so the examples show the variant.
  while (names.length < 4) {
    const n = signatureCardName(r, ["smite", "guardian", "tax", "rally"][names.length]!, new Set(), { username });
    if (/'s /.test(n) && n.toLowerCase().startsWith(username.toLowerCase())) names.push(n);
  }
  say(`  ${username.padEnd(12)} ${names.join("  |  ")}`);
}
say();

say("3. Ten complete \"Generate a new agent\" drafts (agent picked = the first; its 3 signature cards)");
say();
const taken = { agentNames: new Set<string>(), cardNames: new Set(setNames) };
for (let d = 0; d < 10; d++) {
  const agent = generateAgentCandidates(100 + d, taken)[0]!;
  taken.agentNames.add(agent.name);
  const sigs = generateSignatureCandidates(200 + d, agent.name, taken, { username: d === 3 ? "zion" : undefined });
  say(`  ${agent.name} — ${agent.persona}`);
  for (const s of sigs) say(`      ${s.concept}`);
  say(`      flavour: "${sigs[0]!.flavor}"`);
  say();
}
process.stdout.write(out.join("\n") + "\n");
