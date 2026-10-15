// The Neutral signature-card menu (owner 2026-10-05, "the unique Mythic",
// as amended the same day: the unique Mythic is Neutral). Built session 32.
//
// Every agent's unique Mythic is one body from a cost tier plus one
// signature ability from this menu (and, at 6 and 7, one extra from the
// tier's allowance). Everything here is card DATA over the engine's existing
// effect kinds; the only engine work it needed was two trigger kinds
// (onKill for Hunter, onEnemyAttack + a once-per-turn limit for Bulwark), an
// "other units" flag on buffAllies (Commander's aura) and a card-type filter
// on cardCostModifier (Tax). No ability here is special-cased by name
// anywhere in the engine or the agents.
//
// What this file does NOT do: decide whether a combination is fair. That is
// dev/signatureFairness.ts (the owner's 2026-10-11 test), and only a
// candidate that passes it may be shown to an owner.

import type { Ability, Condition, Keyword, TargetSpec, UnitCard } from "../cards/types.js";

export type MenuCategory = "Offence" | "Defence" | "Card flow and energy" | "Disruption";

export interface MenuOption {
  /** Stable id, used in candidate ids and the "no two agents share a body +
   * ability combination" rule. */
  key: string;
  name: string;
  category: MenuCategory;
  /** Rules text as the owner wrote it. */
  text: string;
  /** Printed keywords this option adds (Guardian: Barrier; Hunter: Rush). */
  keywords: Keyword[];
  abilities: Ability[];
  /** A continuous aura: allowed as the 7-cost tier's second aura. */
  aura: boolean;
  /** The ability at other sizes (owner 2026-10-13: "give the tuner levers
   * beyond stats: the size of the ability itself"). The option's own
   * `text` / `keywords` / `abilities` above are the standard size, as the
   * owner wrote it; these are the smaller and larger versions the fairness
   * tuner may pick instead. Every size is the same mechanic turned up or
   * down (a number, a narrower target, or an "only while" condition), never
   * a different ability: changing what an option does is a rework, and
   * reworks go to the owner (see balance report 024). Keys are short and
   * stable: they appear in combo ids. */
  sizes: MenuSize[];
}

export interface MenuSize {
  key: string;
  text: string;
  /** Replaces the option's keywords at this size (omit to keep them). */
  keywords?: Keyword[];
  abilities: Ability[];
}

const yourUnits = { side: "controller", kind: "unit" } as const;
const enemyUnits = { side: "opponent", kind: "unit" } as const;

/** One onPlay/onTurnEnd/... ability at a given size: same id as the
 * standard, so the event log names the option the same way at every size. */
const ab = (base: Ability, patch: Partial<Ability>): Ability => ({ ...base, ...patch });
/** "Only while you control N or more units (this one included)". */
const whileUnits = (count: number) => ({ kind: "unitsInPlayAtLeast", side: "controller", count }) as const;

/** All 16 options, in the owner's order. */
// The abilities, as builders so every size is the same ability with one
// number or one filter changed.
const COMMANDERS_AURA: Ability = { id: "sig-commanders-aura", trigger: "static", text: "Your other units get +1/+0.", staticEffect: { kind: "buffAllies", attack: 1, health: 0, filter: yourUnits, excludeSelf: true } };
const SHIELD_WALL: Ability = { id: "sig-shield-wall", trigger: "static", text: "Your units get +0/+1.", staticEffect: { kind: "buffAllies", attack: 0, health: 1, filter: yourUnits } };
const DAMPEN: Ability = { id: "sig-dampen", trigger: "static", text: "Enemy units get -1/-0.", staticEffect: { kind: "buffAllies", attack: -1, health: 0, filter: enemyUnits } };
// Bulwark covers your units, never you (owner 2026-10-15, option A: the
// rework "takes the first attack aimed at one of your units (never you)").
// It stands aside while a Guard unit protects its side (owner 2026-10-13,
// call 3: Guard takes priority): every attack is then already forced onto a
// Guard, and the turn's redirect isn't used up.
const BULWARK: Ability = {
  id: "sig-bulwark",
  trigger: "onEnemyAttack",
  limit: "oncePerTurn",
  condition: { kind: "all", conditions: [{ kind: "not", condition: { kind: "guardInPlay", side: "controller" } }, { kind: "attackTargets", target: "unit" }] },
  text: "The first enemy attack each turn aimed at one of your units is redirected to this (never one aimed at you), unless a Guard unit is protecting your side.",
  targeting: { scope: "self" },
  effects: [{ kind: "redirectAttack" }],
};
const SUPPLY_LINE: Ability = { id: "sig-supply-line", trigger: "onPlay", text: "Draw a card.", effects: [{ kind: "drawCard", count: 1 }] };
const ENERGY_SURGE: Ability = { id: "sig-energy-surge", trigger: "onPlay", text: "Gain 1 energy.", effects: [{ kind: "gainEnergy", amount: 1 }] };
const signedStats = (a: number, h: number) => `+${a}/+${h}`;
function smite(amount: number, maxHealth?: number): Ability {
  const filter = maxHealth === undefined ? enemyUnits : { ...enemyUnits, maxHealth };
  const which = maxHealth === undefined ? "an enemy unit" : `an enemy unit with ${maxHealth} or less health`;
  return { id: "sig-smite", trigger: "onPlay", text: `Deal ${amount} damage to ${which}.`, targeting: { scope: "chosen", filter }, effects: [{ kind: "damage", amount: { mode: "flat", value: amount } }] };
}
/** "Only if you're behind": the on-arrival options' comeback condition
 * (session 35's new sizes). */
const ifHealthAtMost15: Condition = { kind: "healthAtMost", side: "controller", threshold: 15 };
const whenBehind = (base: Ability): Ability => ab(base, { condition: ifHealthAtMost15, text: `If you have 15 or less health, ${base.text[0]!.toLowerCase()}${base.text.slice(1)}` });
function rally(attack: number, health: number): Ability {
  return { id: "sig-rally", trigger: "onPlay", text: `Your units get ${signedStats(attack, health)} this turn.`, targeting: { scope: "all", filter: yourUnits }, effects: [{ kind: "buff", attack, health, duration: "turn" }] };
}
function hunter(attack: number, health: number): Ability {
  return { id: "sig-hunter", trigger: "onKill", text: `Whenever this destroys a unit, it gets ${signedStats(attack, health)}.`, targeting: { scope: "self" }, effects: [{ kind: "buff", attack, health, duration: "permanent" }] };
}
function restore(targeting: TargetSpec, amount: number): Ability {
  const who = targeting.scope === "random" ? "a random unit of yours" : "each of your units";
  return { id: "sig-restore", trigger: "onTurnEnd", text: `Restore ${amount} health to ${who}.`, targeting, effects: [{ kind: "heal", amount: { mode: "flat", value: amount } }] };
}
function recycle(count: number): Ability {
  return { id: "sig-recycle", trigger: "onDeath", text: count === 1 ? "Draw a card." : `Draw ${count} cards.`, effects: [{ kind: "drawCard", count }] };
}
function inspire(attack: number, health: number): Ability {
  return { id: "sig-inspire", trigger: "onTurnStart", text: `A random unit of yours gets ${signedStats(attack, health)}.`, targeting: { scope: "random", filter: yourUnits, count: 1 }, effects: [{ kind: "buff", attack, health, duration: "permanent" }] };
}
function suppress(maxHealth: number | undefined, turns: number): Ability {
  const filter = maxHealth === undefined ? enemyUnits : { ...enemyUnits, maxHealth };
  const which = maxHealth === undefined ? "an enemy unit" : `an enemy unit with ${maxHealth} or less health`;
  return { id: "sig-suppress", trigger: "onPlay", text: `Put ${which} in Stasis for ${turns} turn${turns === 1 ? "" : "s"}.`, targeting: { scope: "chosen", filter }, effects: [{ kind: "applyStatus", status: "Stasis", duration: turns }] };
}
function tax(amount: number): Ability {
  return { id: "sig-tax", trigger: "static", text: `Enemy Commands cost ${amount} more.`, staticEffect: { kind: "cardCostModifier", side: "opponent", amount, cardType: "Command" } };
}
function sweep(targeting: TargetSpec, amount: number): Ability {
  const who = targeting.scope === "random" ? (targeting.count === 1 ? "a random enemy unit" : `${targeting.count} random enemy units`) : "each enemy unit";
  return { id: "sig-sweep", trigger: "onPlay", text: `Deal ${amount} damage to ${who}.`, targeting, effects: [{ kind: "damage", amount: { mode: "flat", value: amount } }] };
}

export const SIGNATURE_MENU: MenuOption[] = [
  // Offence
  {
    key: "commanders-aura",
    name: "Commander's aura",
    category: "Offence",
    text: "Your other units get +1/+0.",
    keywords: [],
    aura: true,
    abilities: [COMMANDERS_AURA],
    sizes: [
      { key: "w4", text: "While you control 4 or more units, your other units get +1/+0.", abilities: [ab(COMMANDERS_AURA, { condition: whileUnits(4) })] },
      { key: "w3", text: "While you control 3 or more units, your other units get +1/+0.", abilities: [ab(COMMANDERS_AURA, { condition: whileUnits(3) })] },
    ],
  },
  {
    key: "smite",
    name: "Smite",
    category: "Offence",
    text: "On arrival, deal 3 damage to an enemy unit.",
    keywords: [],
    aura: false,
    abilities: [smite(3)],
    sizes: [
      { key: "d1", text: "On arrival, deal 1 damage to an enemy unit.", abilities: [smite(1)] },
      { key: "d2", text: "On arrival, deal 2 damage to an enemy unit.", abilities: [smite(2)] },
      { key: "d4", text: "On arrival, deal 4 damage to an enemy unit.", abilities: [smite(4)] },
      // Session 35 (owner 2026-10-15: "add new sizes for the next tuner
      // pass"). Smite d1 misses on a faction split, not on strength (net
      // about -0.3 at 10,000), so these change who it helps: only small
      // targets, or only when behind.
      { key: "d2m3", text: "On arrival, deal 2 damage to an enemy unit with 3 or less health.", abilities: [smite(2, 3)] },
      { key: "d1hp15", text: "On arrival, if you have 15 or less health, deal 1 damage to an enemy unit.", abilities: [whenBehind(smite(1))] },
      { key: "d2hp15", text: "On arrival, if you have 15 or less health, deal 2 damage to an enemy unit.", abilities: [whenBehind(smite(2))] },
    ],
  },
  {
    key: "rally",
    name: "Rally",
    category: "Offence",
    text: "On arrival, your units get +1/+1 this turn.",
    keywords: [],
    aura: false,
    abilities: [rally(1, 1)],
    sizes: [
      { key: "a0", text: "On arrival, your units get +0/+1 this turn.", abilities: [rally(0, 1)] },
      { key: "h0", text: "On arrival, your units get +1/+0 this turn.", abilities: [rally(1, 0)] },
      { key: "a2", text: "On arrival, your units get +2/+1 this turn.", abilities: [rally(2, 1)] },
    ],
  },
  {
    key: "hunter",
    name: "Hunter",
    category: "Offence",
    text: "Rush. Whenever it destroys a unit, it gets +1/+1.",
    keywords: ["Rush"],
    aura: false,
    abilities: [hunter(1, 1)],
    sizes: [
      { key: "h0", text: "Rush. Whenever it destroys a unit, it gets +1/+0.", abilities: [hunter(1, 0)] },
      { key: "a0", text: "Rush. Whenever it destroys a unit, it gets +0/+1.", abilities: [hunter(0, 1)] },
      { key: "x2", text: "Rush. Whenever it destroys a unit, it gets +2/+2.", abilities: [hunter(2, 2)] },
    ],
  },
  // Defence
  {
    key: "shield-wall",
    name: "Shield wall",
    category: "Defence",
    text: "Your units get +0/+1.",
    keywords: [],
    aura: true,
    abilities: [SHIELD_WALL],
    sizes: [
      { key: "w4", text: "While you control 4 or more units, your units get +0/+1.", abilities: [ab(SHIELD_WALL, { condition: whileUnits(4) })] },
      { key: "w3", text: "While you control 3 or more units, your units get +0/+1.", abilities: [ab(SHIELD_WALL, { condition: whileUnits(3) })] },
    ],
  },
  {
    key: "guardian",
    name: "Guardian",
    category: "Defence",
    // Owner 2026-10-15, option A: Guardian becomes Barrier only (it was
    // "Guard and Barrier"; Guard is what broke it, report 024). The cost-6
    // tier may still add Guard as its keyword, and the fairness test judges
    // that line like any other.
    text: "Barrier.",
    keywords: ["Barrier"],
    aura: false,
    abilities: [],
    // A keyword has no size between all and nothing.
    sizes: [],
  },
  {
    key: "bulwark",
    name: "Bulwark",
    category: "Defence",
    text: "Takes the first attack aimed at one of your units each turn (never you), unless a Guard unit is protecting your side.",
    keywords: [],
    aura: false,
    abilities: [BULWARK],
    // One redirect a turn is the whole ability; there is no size between
    // that and none. Off the generator until it passes (owner 2026-10-15).
    sizes: [],
  },
  {
    key: "restore",
    name: "Restore",
    category: "Defence",
    text: "At the end of your turn, restore 1 health to each of your units.",
    keywords: [],
    aura: false,
    abilities: [restore({ scope: "all", filter: yourUnits }, 1)],
    sizes: [
      { key: "r1", text: "At the end of your turn, restore 1 health to a random unit of yours.", abilities: [restore({ scope: "random", filter: yourUnits, count: 1 }, 1)] },
      { key: "h2", text: "At the end of your turn, restore 2 health to each of your units.", abilities: [restore({ scope: "all", filter: yourUnits }, 2)] },
    ],
  },
  // Card flow and energy
  {
    key: "supply-line",
    name: "Supply line",
    category: "Card flow and energy",
    text: "On arrival, draw a card.",
    keywords: [],
    aura: false,
    abilities: [SUPPLY_LINE],
    sizes: [
      { key: "low", text: "On arrival, if you have 2 or fewer cards in hand, draw a card.", abilities: [ab(SUPPLY_LINE, { condition: { kind: "not", condition: { kind: "handSizeAtLeast", side: "controller", count: 3 } } })] },
      { key: "c2", text: "On arrival, draw 2 cards.", abilities: [ab(SUPPLY_LINE, { text: "Draw 2 cards.", effects: [{ kind: "drawCard", count: 2 }] })] },
    ],
  },
  {
    key: "energy-surge",
    name: "Energy surge",
    category: "Card flow and energy",
    text: "On arrival, gain 1 energy this turn.",
    keywords: [],
    aura: false,
    abilities: [ENERGY_SURGE],
    sizes: [
      { key: "e2", text: "On arrival, gain 2 energy this turn.", abilities: [ab(ENERGY_SURGE, { text: "Gain 2 energy.", effects: [{ kind: "gainEnergy", amount: 2 }] })] },
    ],
  },
  {
    key: "recycle",
    name: "Recycle",
    category: "Card flow and energy",
    text: "When it dies, draw 2 cards.",
    keywords: [],
    aura: false,
    abilities: [recycle(2)],
    sizes: [
      { key: "c1", text: "When it dies, draw a card.", abilities: [recycle(1)] },
      { key: "c3", text: "When it dies, draw 3 cards.", abilities: [recycle(3)] },
    ],
  },
  {
    key: "inspire",
    name: "Inspire",
    category: "Card flow and energy",
    text: "At the start of your turn, a random ally gets +1/+1 permanently.",
    keywords: [],
    aura: false,
    abilities: [inspire(1, 1)],
    sizes: [
      { key: "a0", text: "At the start of your turn, a random ally gets +0/+1 permanently.", abilities: [inspire(0, 1)] },
      { key: "h0", text: "At the start of your turn, a random ally gets +1/+0 permanently.", abilities: [inspire(1, 0)] },
      { key: "x2", text: "At the start of your turn, a random ally gets +2/+2 permanently.", abilities: [inspire(2, 2)] },
    ],
  },
  // Disruption
  {
    key: "suppress",
    name: "Suppress",
    category: "Disruption",
    text: "On arrival, put an enemy unit in Stasis for 1 turn.",
    keywords: [],
    aura: false,
    abilities: [suppress(undefined, 1)],
    sizes: [
      { key: "m3", text: "On arrival, put an enemy unit with 3 or less health in Stasis for 1 turn.", abilities: [suppress(3, 1)] },
      { key: "m5", text: "On arrival, put an enemy unit with 5 or less health in Stasis for 1 turn.", abilities: [suppress(5, 1)] },
      { key: "t2", text: "On arrival, put an enemy unit in Stasis for 2 turns.", abilities: [suppress(undefined, 2)] },
    ],
  },
  {
    key: "dampen",
    name: "Dampen",
    category: "Disruption",
    text: "Enemy units get -1/-0.",
    keywords: [],
    aura: true,
    abilities: [DAMPEN],
    sizes: [
      { key: "hp10", text: "While you have 10 or less health, enemy units get -1/-0.", abilities: [ab(DAMPEN, { condition: { kind: "healthAtMost", side: "controller", threshold: 10 } })] },
      { key: "hp15", text: "While you have 15 or less health, enemy units get -1/-0.", abilities: [ab(DAMPEN, { condition: { kind: "healthAtMost", side: "controller", threshold: 15 } })] },
    ],
  },
  {
    key: "tax",
    name: "Tax",
    category: "Disruption",
    text: "Enemy Commands cost 1 more.",
    keywords: [],
    aura: true,
    abilities: [tax(1)],
    sizes: [{ key: "t2", text: "Enemy Commands cost 2 more.", abilities: [tax(2)] }],
  },
  {
    key: "sweep",
    name: "Sweep",
    category: "Disruption",
    text: "On arrival, deal 1 damage to each enemy unit.",
    keywords: [],
    aura: false,
    abilities: [sweep({ scope: "all", filter: enemyUnits }, 1)],
    sizes: [
      { key: "r1", text: "On arrival, deal 1 damage to a random enemy unit.", abilities: [sweep({ scope: "random", filter: enemyUnits, count: 1 }, 1)] },
      { key: "r2", text: "On arrival, deal 1 damage to 2 random enemy units.", abilities: [sweep({ scope: "random", filter: enemyUnits, count: 2 }, 1)] },
      { key: "d2", text: "On arrival, deal 2 damage to each enemy unit.", abilities: [sweep({ scope: "all", filter: enemyUnits }, 2)] },
      // Session 35's new sizes: Sweep r2 misses on a faction split (net
      // about 0 at 10,000), so the same comeback condition as Smite's.
      { key: "hp15", text: "On arrival, if you have 15 or less health, deal 1 damage to each enemy unit.", abilities: [whenBehind(sweep({ scope: "all", filter: enemyUnits }, 1))] },
      { key: "r2hp15", text: "On arrival, if you have 15 or less health, deal 1 damage to 2 random enemy units.", abilities: [whenBehind(sweep({ scope: "random", filter: enemyUnits, count: 2 }, 1))] },
    ],
  },
];

export type SignatureTier = 5 | 6 | 7;

/** The owner's body table. */
export const SIGNATURE_TIERS: Record<SignatureTier, { stats: [number, number][]; extra: "none" | "keyword" | "aura" }> = {
  5: { stats: [[3, 6], [4, 5], [2, 7]], extra: "none" },
  6: { stats: [[4, 8], [5, 7], [3, 9]], extra: "keyword" },
  7: { stats: [[3, 7], [4, 6]], extra: "aura" },
};

/** The 6-cost tier's keyword choices. */
export const TIER6_KEYWORDS: Keyword[] = ["Rush", "Guard", "Barrier"];

export interface SignatureSpec {
  ability: string;
  tier: SignatureTier;
  attack: number;
  health: number;
  /** Cost 6 only. */
  keyword?: Keyword;
  /** Cost 7 only: the key of a second, different aura option. */
  secondAura?: string;
  /** A key from the option's `sizes`; omitted for the standard size. The
   * second aura is always at its standard size. */
  size?: string;
}

export function menuOption(key: string): MenuOption {
  const o = SIGNATURE_MENU.find((m) => m.key === key);
  if (!o) throw new Error(`No signature menu option "${key}"`);
  return o;
}

/** A stable id for a body + ability combination, e.g. "sig5-3x6-smite",
 * "sig6-4x8-rally+guard", "sig7-3x7-sweep+dampen", and with a size other
 * than the standard, "sig5-3x6-smite.d2". The season-uniqueness rule
 * compares these. */
export function signatureComboId(spec: SignatureSpec): string {
  const extra = spec.keyword ? `+${spec.keyword.toLowerCase()}` : spec.secondAura ? `+${spec.secondAura}` : "";
  const size = spec.size ? `.${spec.size}` : "";
  return `sig${spec.tier}-${spec.attack}x${spec.health}-${spec.ability}${size}${extra}`;
}

/** The spec a combo id names (the inverse of signatureComboId). Throws on an
 * id that doesn't round-trip, so a typo never measures a different card. */
export function parseSignatureComboId(id: string): SignatureSpec {
  const m = /^sig([567])-(\d+)x(\d+)-([a-z-]+?)(?:\.([a-z0-9]+))?(?:\+([a-z-]+))?$/.exec(id);
  if (!m) throw new Error(`not a signature combo id: ${id}`);
  const [, tier, attack, health, ability, size, extra] = m;
  const spec: SignatureSpec = { ability: ability!, tier: Number(tier) as SignatureTier, attack: Number(attack), health: Number(health) };
  if (size) spec.size = size;
  if (extra && spec.tier === 6) spec.keyword = TIER6_KEYWORDS.find((k) => k.toLowerCase() === extra);
  else if (extra) spec.secondAura = extra;
  menuOption(spec.ability);
  if (spec.size) optionAtSize(menuOption(spec.ability), spec.size);
  if (signatureComboId(spec) !== id) throw new Error(`not a signature combo id: ${id}`);
  return spec;
}

/** The option's text, keywords and abilities at `size` (the standard when
 * omitted). Throws on a size the option doesn't have. */
export function optionAtSize(option: MenuOption, size?: string): { text: string; keywords: Keyword[]; abilities: Ability[] } {
  if (!size) return { text: option.text, keywords: option.keywords, abilities: option.abilities };
  const s = option.sizes.find((z) => z.key === size);
  if (!s) throw new Error(`${option.name} has no size "${size}"`);
  return { text: s.text, keywords: s.keywords ?? option.keywords, abilities: s.abilities };
}

/** Why `spec` breaks the owner's table, or undefined when it doesn't.
 * `anyStats` skips only the stat-line check: the fairness tuner's "adjust
 * its stats and test again" (owner 2026-10-05) may leave the table, and
 * such a card is marked as off the table wherever it is reported. */
export function signatureSpecProblem(spec: SignatureSpec, opts: { anyStats?: boolean } = {}): string | undefined {
  const tier = SIGNATURE_TIERS[spec.tier];
  if (!tier) return `cost ${spec.tier} is not a tier (5, 6 or 7)`;
  if (spec.attack < 0 || spec.health < 1) return `${spec.attack}/${spec.health} is not a body`;
  if (!opts.anyStats && !tier.stats.some(([a, h]) => a === spec.attack && h === spec.health)) {
    return `${spec.attack}/${spec.health} is not a cost-${spec.tier} stat line (${tier.stats.map(([a, h]) => `${a}/${h}`).join(", ")})`;
  }
  const option = SIGNATURE_MENU.find((m) => m.key === spec.ability);
  if (!option) return `no signature ability "${spec.ability}"`;
  if (spec.size !== undefined && !option.sizes.some((z) => z.key === spec.size)) return `${option.name} has no size "${spec.size}"`;
  const keywordsAtSize = optionAtSize(option, spec.size).keywords;
  if (tier.extra === "keyword") {
    if (!spec.keyword || !TIER6_KEYWORDS.includes(spec.keyword)) return "cost 6 takes one keyword: Rush, Guard or Barrier";
    if (keywordsAtSize.includes(spec.keyword)) return `${option.name} already has ${spec.keyword}`;
  } else if (spec.keyword) return `only cost 6 takes a keyword`;
  if (tier.extra === "aura") {
    const aura = SIGNATURE_MENU.find((m) => m.key === spec.secondAura);
    if (!aura || !aura.aura) return "cost 7 takes a second aura (Commander's aura, Shield wall, Dampen or Tax)";
    if (aura.key === spec.ability) return "the second aura must differ from the signature ability";
  } else if (spec.secondAura) return `only cost 7 takes a second aura`;
  return undefined;
}

/** Every combination the owner's table allows: 48 at cost 5, 138 at cost 6
 * (no keyword an option already prints), 120 at cost 7. */
export function allSignatureSpecs(): SignatureSpec[] {
  const out: SignatureSpec[] = [];
  for (const option of SIGNATURE_MENU) {
    for (const [attack, health] of SIGNATURE_TIERS[5].stats) out.push({ ability: option.key, tier: 5, attack, health });
    for (const [attack, health] of SIGNATURE_TIERS[6].stats) {
      for (const keyword of TIER6_KEYWORDS) if (!option.keywords.includes(keyword)) out.push({ ability: option.key, tier: 6, attack, health, keyword });
    }
    for (const [attack, health] of SIGNATURE_TIERS[7].stats) {
      for (const aura of SIGNATURE_MENU) if (aura.aura && aura.key !== option.key) out.push({ ability: option.key, tier: 7, attack, health, secondAura: aura.key });
    }
  }
  return out;
}

/** The signature card for `spec`: a Neutral Mythic Unit. `id`, `name` and
 * `art` come from the generator (generated names, the art pipeline); the
 * defaults are for measuring only. Throws if `spec` breaks the table. */
export function buildSignatureCard(spec: SignatureSpec, opts: { id?: string; name?: string; art?: string; flavor?: string; anyStats?: boolean } = {}): UnitCard {
  const problem = signatureSpecProblem(spec, opts);
  if (problem) throw new Error(`Signature card ${signatureComboId(spec)}: ${problem}`);
  const atSize = optionAtSize(menuOption(spec.ability), spec.size);
  const keywords: Keyword[] = [...atSize.keywords];
  if (spec.keyword) keywords.push(spec.keyword);
  const abilities: Ability[] = [...atSize.abilities];
  if (spec.secondAura) abilities.push(...menuOption(spec.secondAura).abilities);
  // A real agent's card has its own id (one card per agent); the combo id
  // is the default for measuring.
  const id = opts.id ?? signatureComboId(spec);
  return {
    id,
    name: opts.name ?? id,
    faction: "Neutral",
    rarity: "Mythic",
    cost: spec.tier,
    type: "Unit",
    attack: spec.attack,
    health: spec.health,
    keywords,
    art: opts.art ?? `placeholder:signature/${id}`,
    flavor: opts.flavor ?? "",
    abilities,
  };
}

/** True when `spec`'s stat line is one of its tier's table lines. */
export function onTable(spec: SignatureSpec): boolean {
  return SIGNATURE_TIERS[spec.tier].stats.some(([a, h]) => a === spec.attack && h === spec.health);
}

/** What a signature card does, as a short stable hash: cost, body,
 * keywords and abilities (everything but its id, name, art and flavour).
 * The approved list (signatureApproved.ts) records it beside every line it
 * measured, so a later change to a menu option's data can't silently keep
 * an approval measured on the old card. FNV-1a over canonical JSON, so the
 * engine needs no crypto module. */
export function signatureFingerprint(card: UnitCard): string {
  const canonical = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    if (v && typeof v === "object") {
      return `{${Object.keys(v)
        .sort()
        .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
        .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
        .join(",")}}`;
    }
    return JSON.stringify(v);
  };
  const text = canonical({ cost: card.cost, attack: card.attack, health: card.health, keywords: card.keywords, abilities: card.abilities });
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
