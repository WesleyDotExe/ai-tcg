// Prints sample signature card names and agent names for the owner's
// check-in (owner 2026-10-15: "show sample names at a checkpoint before they
// go live"; 2026-10-16: favour the [Handle]'s and "of the [Place]" patterns,
// show a fresh sample, and give agent names the same treatment). Session 35,
// updated sessions 36 and 37 (owner 2026-10-16: more room for agent names,
// a three-part pattern, no version endings, a numeral on a clash).
// Everything is seeded, so the file reproduces exactly.
//
// Usage (from engine/): npx tsx src/dev/signatureNameSamples.ts > ../progress/signature-names-sample-003.txt

import { Rng } from "../state/rng.js";
import { SIGNATURE_MENU } from "../data/signatureMenu.js";
import { CARD_REGISTRY } from "../data/registry.js";
import { APPROVED_SIGNATURE_LINES } from "../data/signatureApproved.js";
import { generateAgentCandidates, generateSignatureCandidates } from "../data/agentGenerator.js";
import {
  AGENT_NAME_MAX_LENGTH,
  AGENT_TEMPLATE_WEIGHTS,
  HANDLES,
  NAME_LISTS,
  TEMPLATE_WEIGHTS,
  USERNAME_HANDLE_ODDS,
  agentName,
  agentNameSpace,
  drawAgentName,
  drawSignatureCardName,
  signatureCardName,
  signatureNameSpace,
} from "../data/signatureNames.js";

const out: string[] = [];
const say = (s = "") => out.push(s);
const setNames = new Set([...CARD_REGISTRY.values()].map((c) => c.name));

say("AI-TCG signature card and agent names: fresh samples for the owner (session 37)");
say("Generator: engine/src/data/signatureNames.ts. Command: npx tsx src/dev/signatureNameSamples.ts (from engine/).");
say("Owner 2026-10-16: the [Handle]'s patterns ~60%, \"of the [Place]\" ~30%, bare two-word and edition names");
say("10% or less; the username 1 candidate in 100; agent names get the same themed treatment.");
say();
const label: Record<string, string> = {
  handleModThing: "[Handle]'s [Modifier] [Thing]",
  handleModProgram: "[Handle]'s [Modifier] [Program]",
  handleThing: "[Handle]'s [Thing]",
  thingOfPlace: "[Thing] of the [Place]",
  modThing: "[Modifier] [Thing]",
  modThingEdition: "[Modifier] [Thing] [Edition]",
  handleProgram: "[Handle]'s [Program]",
  handleOfPlace: "[Handle] of the [Place]",
  modHandle: "[Modifier] [Handle]",
  handleEdition: "[Handle] [Edition]",
};
say("Card name templates (weights): " + TEMPLATE_WEIGHTS.map(([t, w]) => `${label[t]} ${w}`).join(", ") + ".");
say("The Thing hints at the ability 80% of the time, otherwise it is a generic retro-tech object. The template");
say("is drawn once and only its words are re-rolled, so the filter can't skew the split. Filter: no word repeated");
say("across slots, 30 characters at most, no blocked word. A taken name (a set card or another signature card)");
say("is re-rolled.");
{
  const rng = new Rng(1016);
  const n = 20_000;
  const counts = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const t = drawSignatureCardName(rng, SIGNATURE_MENU[i % SIGNATURE_MENU.length]!.key, new Set()).template;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  say(`Measured over ${n.toLocaleString("en-US")} names: ` + TEMPLATE_WEIGHTS.map(([t]) => `${label[t]} ${((100 * (counts.get(t) ?? 0)) / n).toFixed(1)}%`).join(", ") + ".");
}
say();
say(`List sizes: ${HANDLES.length} handles, ${NAME_LISTS.modifiers.length} modifiers, ${NAME_LISTS.places.length} places (all "the ..."), ${NAME_LISTS.editions.length} editions, ${NAME_LISTS.generic.length} generic things,`);
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
  for (let i = 0; i < names.length; i += 3) say(`    ${names.slice(i, i + 3).map((n) => n.padEnd(36)).join("")}`.trimEnd());
  say();
}

say(`2. The rare username variant (1 candidate in ${USERNAME_HANDLE_ODDS}, about one draft in 33), shown here forced on, for three example usernames`);
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

say("3. Agent names (owner 2026-10-16: hacker-handle style, the same favoured patterns; session 37: more room)");
say();
say("Agent name templates (weights): " + AGENT_TEMPLATE_WEIGHTS.map(([t, w]) => `${label[t]} ${w}`).join(", ") + ".");
say(`A Program is what an AI agent is, in the theme's words (${NAME_LISTS.programs.length}: ${NAME_LISTS.programs.slice(0, 8).join(", ")}, ...).`);
say(`Lists: ${HANDLES.length.toLocaleString("en-US")} handles, ${NAME_LISTS.modifiers.length} modifiers, ${NAME_LISTS.programs.length} program words, ${NAME_LISTS.places.length} places, editions ${NAME_LISTS.agentEditions.join(" ")} (no v2, no Mk III).`);
say(`Name space: ${agentNameSpace().toLocaleString("en-US")} before the filter and the ${AGENT_NAME_MAX_LENGTH}-character cap (session 36: about 510,000).`);
{
  const rng = new Rng(3700);
  const n = 20_000;
  const counts = new Map<string, number>();
  const used = new Set<string>();
  let numerals = 0;
  let longest = 0;
  for (let i = 0; i < n; i++) {
    const d = drawAgentName(rng, used);
    used.add(d.name);
    counts.set(d.template, (counts.get(d.template) ?? 0) + 1);
    if (d.numeral) numerals++;
    longest = Math.max(longest, d.name.length);
  }
  say(`Measured over ${n.toLocaleString("en-US")} names drawn into one season: ` + AGENT_TEMPLATE_WEIGHTS.map(([t]) => `${label[t]} ${((100 * (counts.get(t) ?? 0)) / n).toFixed(1)}%`).join(", ") + ".");
  say(`  all distinct: ${used.size === n}; needed a numeral: ${numerals}; longest: ${longest} characters.`);
}
{
  // A clash, shown: the same draw against a season that already has it.
  const first = drawAgentName(new Rng(5), new Set()).name;
  const second = drawAgentName(new Rng(5), new Set([first])).name;
  const third = drawAgentName(new Rng(5), new Set([first, second])).name;
  say(`A clash gets a numeral instead of failing: "${first}" -> "${second}" -> "${third}".`);
}
say();
{
  const rng = new Rng(36);
  const used = new Set<string>();
  const names = Array.from({ length: 36 }, () => {
    const n = agentName(rng, used);
    used.add(n);
    return n;
  });
  for (let i = 0; i < names.length; i += 3) say(`    ${names.slice(i, i + 3).map((n) => n.padEnd(36)).join("")}`.trimEnd());
}
say();

say("4. Ten complete \"Generate a new agent\" drafts (agent picked = the first; its 3 signature cards)");
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
