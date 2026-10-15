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
//  - no candidate reuses a body + ability combination already taken this
//    season, and the 3 candidates differ in ability whenever 3 abilities
//    are left (a real choice, not three sizes of one card);
//  - agent names and card names never repeat a taken one.
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
  comboIds: ReadonlySet<string>;
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

const CARD_PREFIX = [
  "Quiet", "Gilded", "Recursive", "Hollow", "Lantern", "Sable", "Patient", "Vigil", "Ivory", "Cinder",
  "Meridian", "Glass", "Second", "Errant", "Orbital", "Tidal", "Woven", "Last", "Bright", "Velvet",
];
/** Card nouns by menu option, so a name hints at what the card does. */
const CARD_NOUN: Record<string, string[]> = {
  recycle: ["Reclaimer", "Undertow Cache", "Salvage Loop", "Afterimage", "Remnant Engine", "Return Coil"],
  "supply-line": ["Courier", "Supply Daemon", "Relay Mule", "Provisioner", "Quartermaster", "Packet Runner"],
  rally: ["Herald", "Banner Process", "Chorus", "Signal Fire", "Drumline", "Muster Call"],
  restore: ["Mender", "Patchwright", "Rollback", "Field Medic", "Checkpoint", "Restorer"],
  tax: ["Tollgate", "Toll Daemon", "Customs Unit", "Levy Engine", "Gatekeeper", "Tariff Clerk"],
  inspire: ["Mentor", "Tutor Thread", "Muse", "Coach", "Kindler", "Uplink"],
  smite: ["Lance", "Pinpoint", "Striker", "Needle", "Marksman", "Spike"],
  "energy-surge": ["Capacitor", "Overclock", "Dynamo", "Surge Cell", "Spark Bank", "Battery"],
  sweep: ["Scythe", "Broom Protocol", "Static Wave", "Purge", "Shockfront", "Sweeper"],
  guardian: ["Ward Shell", "Warden", "Shieldframe", "Bastion", "Ward Plate", "Keeper"],
  bulwark: ["Bulwark", "Interceptor", "Decoy Frame", "Bodyguard", "Shield Bearer", "Catcher"],
  "commanders-aura": ["Marshal", "Commander", "Captain", "Warlead", "Conductor", "Admiral"],
  "shield-wall": ["Rampart", "Wall Process", "Parapet", "Bulkhead", "Battlement", "Palisade"],
  dampen: ["Damper", "Muffler", "Fog Engine", "Static", "Hush", "Inhibitor"],
  suppress: ["Freezer", "Stasis Lock", "Pause Key", "Holding Cell", "Halt", "Interrupt"],
  hunter: ["Hunter", "Tracker", "Stalker", "Predator", "Seeker", "Hound"],
};
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
 * lines whose combination isn't taken, with 3 different abilities when 3
 * are left. Throws when fewer than 3 approved lines are free (the season's
 * pool is used up: an owner call, see notes-for-owner.md). */
export function generateSignatureCandidates(
  seed: number,
  agentName: string,
  taken: Pick<TakenNames, "cardNames" | "comboIds">,
  approved: readonly ApprovedSignatureLine[] = APPROVED_SIGNATURE_LINES,
): SignatureCandidate[] {
  const rng = new Rng(seed);
  const free = approved.filter((l) => !taken.comboIds.has(l.id));
  if (free.length < CANDIDATES_PER_PICK) {
    throw new Error(`only ${free.length} approved signature line(s) left untaken this season; ${CANDIDATES_PER_PICK} are needed`);
  }
  const byAbility = new Map<string, ApprovedSignatureLine[]>();
  for (const l of free) byAbility.set(l.spec.ability, [...(byAbility.get(l.spec.ability) ?? []), l]);
  // One line from each of 3 different abilities, then (only if fewer than
  // 3 abilities are left) more lines from the abilities already used.
  const picks: ApprovedSignatureLine[] = [];
  for (const ability of rng.shuffle([...byAbility.keys()].sort())) {
    if (picks.length === CANDIDATES_PER_PICK) break;
    picks.push(rng.pick(byAbility.get(ability)!));
  }
  for (const l of rng.shuffle(free)) {
    if (picks.length === CANDIDATES_PER_PICK) break;
    if (!picks.includes(l)) picks.push(l);
  }
  const usedNames = new Set(taken.cardNames);
  return picks.map((line) => {
    const name = cardName(rng, line.spec.ability, usedNames);
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

function cardName(rng: Rng, ability: string, used: ReadonlySet<string>): string {
  const nouns = CARD_NOUN[ability] ?? ["Construct"];
  for (let attempt = 0; attempt < 500; attempt++) {
    const name = `${rng.pick(CARD_PREFIX)} ${rng.pick(nouns)}`;
    if (!used.has(name)) return name;
  }
  for (let n = 2; ; n++) {
    const name = `${rng.pick(CARD_PREFIX)} ${rng.pick(nouns)} ${roman(n)}`;
    if (!used.has(name)) return name;
  }
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

function roman(n: number): string {
  const table: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of table) while (n >= v) (out += s), (n -= v);
  return out;
}

