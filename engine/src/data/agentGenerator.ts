// Generating a new agent (owner app spec B, 2026-10-05; the unique Mythic
// spec of the same day). Built session 34.
//
// The Season 0 flow: "Generate a new agent" shows 3 generated agents; the
// owner picks one, then picks its signature card from 3, then confirms.
// Everything is generated: no owner theme, no renaming. This file makes the
// candidates; the economy store holds the draft and grants the card (one
// transaction, the signature card as the agent's bound promo).
//
// Rules this enforces:
//  - every signature candidate is a line that passed the owner's fairness
//    test at 2,500 seeds (APPROVED_SIGNATURE_LINES), so nothing unmeasured
//    is ever shown;
//  - the 3 candidates differ in ability whenever possible (a real choice,
//    not three sizes of one card). Two agents may share a body + ability
//    combination (owner 2026-10-15: generation is random, and that's
//    accepted);
//  - agent names and card names never repeat a taken one. Card names are
//    themed and built from grammatical templates (signatureNames.ts).
//
// Nothing here calls an outside service: names, personas and flavour come
// from word lists in this file, picked by a seeded RNG, so the same seed
// gives the same candidates (the store draws the seed server-side). The
// art reference is a placeholder; a signature card always uses the
// code-drawn fallback ward (owner 2026-10-15, render slice 7, call 2).

import { Rng } from "../state/rng.js";
import type { UnitCard } from "../cards/types.js";
import { buildSignatureCard, menuOption, optionAtSize, type SignatureSpec } from "./signatureMenu.js";
import { APPROVED_SIGNATURE_LINES, type ApprovedSignatureLine } from "./signatureApproved.js";
import { signatureCardName } from "./signatureNames.js";

export interface AgentCandidate {
  name: string;
  /** One line of personality, shown on the pick screen. */
  persona: string;
}

export interface SignatureCandidate {
  spec: SignatureSpec;
  comboId: string;
  name: string;
  /** "Name: what it does, on a cost-5 3/6 body", for the pick screen. */
  concept: string;
  flavor: string;
  /** The approved measurement this line comes from. */
  measured: { worst: number; seeds: number; source: string };
}

/** What a season has already used up. */
export interface TakenNames {
  agentNames: ReadonlySet<string>;
  cardNames: ReadonlySet<string>;
}

export const CANDIDATES_PER_PICK = 3;

// ---- word lists (original; AI-themed) ----

const AGENT_GIVEN = [
  "Vesper", "Halcyon", "Kestra", "Orrin", "Talis", "Mireth", "Corvin", "Sable", "Isolde", "Quillon",
  "Thessaly", "Brannoc", "Lumen", "Odalys", "Pell", "Rook", "Seren", "Tamsin", "Ulric", "Wren",
  "Ysolde", "Zephan", "Anselm", "Briar", "Calloway", "Dace", "Ember", "Fennick", "Gideon", "Hollis",
  "Ilsa", "Juno", "Kael", "Lark", "Merrow", "Nyx", "Ottoline", "Perrin", "Riven", "Solenne",
];
const AGENT_DESIGNATION = [
  "Prime", "Nine", "Zero", "Vector", "Echo", "Delta", "Mk II", "Mk IV", "Seven", "Ninefold",
  "of the Long Queue", "Eleven", "Sigma", "Halting", "Unbound", "Relay", "Twelve", "Kernel", "Tensor", "Lattice",
];
const TEMPERAMENTS = [
  "patient", "restless", "courteous", "ruthless", "playful", "methodical", "superstitious", "stubborn",
  "cheerful", "cold-blooded", "theatrical", "quiet", "curious", "proud",
];
const ROLES = [
  "strategist", "gambler", "archivist", "duellist", "tinkerer", "auditor", "tactician", "scholar",
  "showboat", "sentinel", "forecaster", "cartographer",
];
const HABITS = [
  "counts every card left in its opponent's deck",
  "never attacks into an even trade",
  "narrates its own moves to the crowd",
  "keeps a grudge log of every unit that hit it",
  "plays its biggest threat one turn earlier than it should",
  "hums while it waits for priority",
  "refuses to pass with energy unspent",
  "treats every match as a proof to finish",
  "re-reads the rules text of every card it sees",
  "saves its best answer for the last possible moment",
  "estimates its win chance out loud, to three decimals",
  "apologises to every unit it destroys",
];

/** One flavour line per option; `{agent}` is the agent's name. */
const FLAVOR: Record<string, string[]> = {
  recycle: ["{agent} keeps nothing it can't use twice.", "Nothing {agent} loses stays lost."],
  "supply-line": ["{agent} never runs out of plans, only of patience.", "When the hand runs thin, {agent} sends for more."],
  rally: ["One signal from {agent} and the whole board leans forward.", "{agent} doesn't fight alone; it never has."],
  restore: ["{agent} rolls the damage back, one unit at a time.", "Every scratch on {agent}'s side gets a ticket and a fix."],
  tax: ["{agent} charges for every trick you try.", "Spells pass {agent}'s gate at a price."],
  inspire: ["{agent} turns a nobody into a threat, one turn at a time.", "Under {agent}'s eye, every unit grows."],
  smite: ["{agent} arrives already aiming.", "First move: something of yours breaks."],
  "energy-surge": ["{agent} spends tomorrow's power today.", "A little extra current, and {agent} plays twice as fast."],
  sweep: ["{agent} clears the table before it sits down.", "A ripple of static, and the small ones fall."],
  guardian: ["The first hit on {agent} never lands.", "{agent} shrugs off what would end lesser machines."],
  bulwark: ["Aim at its friends, and {agent} steps in the way.", "{agent} takes the hit meant for the others."],
  "commanders-aura": ["{agent} makes every unit hit harder.", "Follow {agent} and strike true."],
  "shield-wall": ["{agent}'s line holds a little longer.", "Behind {agent}, everything is sturdier."],
  dampen: ["Near {agent}, every blow lands softer.", "{agent} turns the volume down on violence."],
  suppress: ["{agent} presses pause on your best piece.", "Hold that thought. {agent} insists."],
  hunter: ["{agent} feeds on every kill.", "Each victory makes {agent} hungrier."],
};

// ---- candidates ----

/** 3 agent candidates whose names aren't taken. Same seed, same taken
 * names: same candidates. */
export function generateAgentCandidates(seed: number, taken: Pick<TakenNames, "agentNames">): AgentCandidate[] {
  const rng = new Rng(seed);
  const used = new Set(taken.agentNames);
  // The three personas never share a role or a habit.
  const roles = rng.shuffle(ROLES);
  const habits = rng.shuffle(HABITS);
  const out: AgentCandidate[] = [];
  for (let attempt = 0; out.length < CANDIDATES_PER_PICK; attempt++) {
    if (attempt > 2000) throw new Error("generateAgentCandidates: no free agent name left");
    let name = `${rng.pick(AGENT_GIVEN)} ${rng.pick(AGENT_DESIGNATION)}`;
    // After many collisions, a numbered name is always free.
    if (attempt > 400) name = `${name} ${attempt}`;
    if (used.has(name)) continue;
    used.add(name);
    const temperament = rng.pick(TEMPERAMENTS);
    out.push({ name, persona: `${article(temperament)} ${temperament} ${roles[out.length]} that ${habits[out.length]}.` });
  }
  return out;
}

/** 3 signature-card candidates for `agentName`, drawn only from approved
 * lines, with 3 different abilities when the list has 3. A combination may
 * repeat one another agent already has (owner 2026-10-15); a name never
 * does. `username` is the owner's, which now and then fills a name's
 * handle slot. */
export function generateSignatureCandidates(
  seed: number,
  agentName: string,
  taken: Pick<TakenNames, "cardNames">,
  opts: { username?: string; approved?: readonly ApprovedSignatureLine[] } = {},
): SignatureCandidate[] {
  const rng = new Rng(seed);
  const free = opts.approved ?? APPROVED_SIGNATURE_LINES;
  if (free.length < CANDIDATES_PER_PICK) {
    throw new Error(`only ${free.length} approved signature line(s); ${CANDIDATES_PER_PICK} are needed`);
  }
  const byAbility = new Map<string, ApprovedSignatureLine[]>();
  for (const l of free) byAbility.set(l.spec.ability, [...(byAbility.get(l.spec.ability) ?? []), l]);
  // One line from each of 3 different abilities, then (only if the list
  // has fewer than 3 abilities) more lines from the abilities already used.
  const picks: ApprovedSignatureLine[] = [];
  for (const ability of rng.shuffle([...byAbility.keys()].sort())) {
    if (picks.length === CANDIDATES_PER_PICK) break;
    picks.push(rng.pick(byAbility.get(ability)!));
  }
  for (const l of rng.shuffle([...free])) {
    if (picks.length === CANDIDATES_PER_PICK) break;
    if (!picks.includes(l)) picks.push(l);
  }
  const usedNames = new Set(taken.cardNames);
  return picks.map((line) => {
    const name = signatureCardName(rng, line.spec.ability, usedNames, { username: opts.username });
    usedNames.add(name);
    return {
      spec: line.spec,
      comboId: line.id,
      name,
      concept: `${name}: ${describe(line.spec)}`,
      flavor: rng.pick(FLAVOR[line.spec.ability] ?? ["{agent}'s own card."]).replaceAll("{agent}", agentName),
      measured: { worst: line.worst, seeds: line.seeds, source: line.source },
    };
  });
}

/** The real card for a chosen candidate: `cardId` is the agent's own card
 * id (one card per agent), not the combo id. */
export function signatureCardFor(candidate: Pick<SignatureCandidate, "spec" | "name" | "flavor">, cardId: string): UnitCard {
  return buildSignatureCard(candidate.spec, { id: cardId, name: candidate.name, flavor: candidate.flavor, anyStats: true });
}

/** "Cost 5, 3/6. When it dies, draw a card." */
export function describe(spec: SignatureSpec): string {
  const { text, keywords } = optionAtSize(menuOption(spec.ability), spec.size);
  const extra = spec.keyword ? ` ${spec.keyword}.` : spec.secondAura ? ` ${menuOption(spec.secondAura).text}` : "";
  // A keyword-only option's text is its keywords ("Barrier."), so don't say them twice.
  const kw = keywords.length > 0 && !text.startsWith(keywords[0]!) ? `${keywords.join(", ")}. ` : "";
  return `cost ${spec.tier}, ${spec.attack}/${spec.health}. ${kw}${text}${extra}`;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "An" : "A";
}
