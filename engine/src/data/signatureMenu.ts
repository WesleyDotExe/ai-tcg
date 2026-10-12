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

import type { Ability, Keyword, UnitCard } from "../cards/types.js";

export type MenuCategory = "Offence" | "Defence" | "Card flow and energy" | "Disruption";

export interface MenuOption {
  /** Stable id, used in candidate ids and the "no two agents share a body +
   * ability combination" rule. */
  key: string;
  name: string;
  category: MenuCategory;
  /** Rules text as the owner wrote it. */
  text: string;
  /** Printed keywords this option adds (Guardian: Guard + Barrier; Hunter:
   * Rush). */
  keywords: Keyword[];
  abilities: Ability[];
  /** A continuous aura: allowed as the 7-cost tier's second aura. */
  aura: boolean;
}

const yourUnits = { side: "controller", kind: "unit" } as const;
const enemyUnits = { side: "opponent", kind: "unit" } as const;

/** All 16 options, in the owner's order. */
export const SIGNATURE_MENU: MenuOption[] = [
  // Offence
  {
    key: "commanders-aura",
    name: "Commander's aura",
    category: "Offence",
    text: "Your other units get +1/+0.",
    keywords: [],
    aura: true,
    abilities: [{ id: "sig-commanders-aura", trigger: "static", text: "Your other units get +1/+0.", staticEffect: { kind: "buffAllies", attack: 1, health: 0, filter: yourUnits, excludeSelf: true } }],
  },
  {
    key: "smite",
    name: "Smite",
    category: "Offence",
    text: "On arrival, deal 3 damage to an enemy unit.",
    keywords: [],
    aura: false,
    abilities: [{ id: "sig-smite", trigger: "onPlay", text: "Deal 3 damage to an enemy unit.", targeting: { scope: "chosen", filter: enemyUnits }, effects: [{ kind: "damage", amount: { mode: "flat", value: 3 } }] }],
  },
  {
    key: "rally",
    name: "Rally",
    category: "Offence",
    text: "On arrival, your units get +1/+1 this turn.",
    keywords: [],
    aura: false,
    abilities: [{ id: "sig-rally", trigger: "onPlay", text: "Your units get +1/+1 this turn.", targeting: { scope: "all", filter: yourUnits }, effects: [{ kind: "buff", attack: 1, health: 1, duration: "turn" }] }],
  },
  {
    key: "hunter",
    name: "Hunter",
    category: "Offence",
    text: "Rush. Whenever it destroys a unit, it gets +1/+1.",
    keywords: ["Rush"],
    aura: false,
    abilities: [{ id: "sig-hunter", trigger: "onKill", text: "Whenever this destroys a unit, it gets +1/+1.", targeting: { scope: "self" }, effects: [{ kind: "buff", attack: 1, health: 1, duration: "permanent" }] }],
  },
  // Defence
  {
    key: "shield-wall",
    name: "Shield wall",
    category: "Defence",
    text: "Your units get +0/+1.",
    keywords: [],
    aura: true,
    abilities: [{ id: "sig-shield-wall", trigger: "static", text: "Your units get +0/+1.", staticEffect: { kind: "buffAllies", attack: 0, health: 1, filter: yourUnits } }],
  },
  {
    key: "guardian",
    name: "Guardian",
    category: "Defence",
    text: "Guard and Barrier.",
    keywords: ["Guard", "Barrier"],
    aura: false,
    abilities: [],
  },
  {
    key: "bulwark",
    name: "Bulwark",
    category: "Defence",
    text: "Takes the first attack aimed at your side each turn.",
    keywords: [],
    aura: false,
    abilities: [{ id: "sig-bulwark", trigger: "onEnemyAttack", limit: "oncePerTurn", text: "The first enemy attack each turn is redirected to this.", targeting: { scope: "self" }, effects: [{ kind: "redirectAttack" }] }],
  },
  {
    key: "restore",
    name: "Restore",
    category: "Defence",
    text: "At the end of your turn, restore 1 health to each of your units.",
    keywords: [],
    aura: false,
    abilities: [{ id: "sig-restore", trigger: "onTurnEnd", text: "Restore 1 health to each of your units.", targeting: { scope: "all", filter: yourUnits }, effects: [{ kind: "heal", amount: { mode: "flat", value: 1 } }] }],
  },
  // Card flow and energy
  {
    key: "supply-line",
    name: "Supply line",
    category: "Card flow and energy",
    text: "On arrival, draw a card.",
    keywords: [],
    aura: false,
    abilities: [{ id: "sig-supply-line", trigger: "onPlay", text: "Draw a card.", effects: [{ kind: "drawCard", count: 1 }] }],
  },
  {
    key: "energy-surge",
    name: "Energy surge",
    category: "Card flow and energy",
    text: "On arrival, gain 1 energy this turn.",
    keywords: [],
    aura: false,
    abilities: [{ id: "sig-energy-surge", trigger: "onPlay", text: "Gain 1 energy.", effects: [{ kind: "gainEnergy", amount: 1 }] }],
  },
  {
    key: "recycle",
    name: "Recycle",
    category: "Card flow and energy",
    text: "When it dies, draw 2 cards.",
    keywords: [],
    aura: false,
    abilities: [{ id: "sig-recycle", trigger: "onDeath", text: "Draw 2 cards.", effects: [{ kind: "drawCard", count: 2 }] }],
  },
  {
    key: "inspire",
    name: "Inspire",
    category: "Card flow and energy",
    text: "At the start of your turn, a random ally gets +1/+1 permanently.",
    keywords: [],
    aura: false,
    abilities: [{ id: "sig-inspire", trigger: "onTurnStart", text: "A random unit of yours gets +1/+1.", targeting: { scope: "random", filter: yourUnits, count: 1 }, effects: [{ kind: "buff", attack: 1, health: 1, duration: "permanent" }] }],
  },
  // Disruption
  {
    key: "suppress",
    name: "Suppress",
    category: "Disruption",
    text: "On arrival, put an enemy unit in Stasis for 1 turn.",
    keywords: [],
    aura: false,
    abilities: [{ id: "sig-suppress", trigger: "onPlay", text: "Put an enemy unit in Stasis for 1 turn.", targeting: { scope: "chosen", filter: enemyUnits }, effects: [{ kind: "applyStatus", status: "Stasis", duration: 1 }] }],
  },
  {
    key: "dampen",
    name: "Dampen",
    category: "Disruption",
    text: "Enemy units get -1/-0.",
    keywords: [],
    aura: true,
    abilities: [{ id: "sig-dampen", trigger: "static", text: "Enemy units get -1/-0.", staticEffect: { kind: "buffAllies", attack: -1, health: 0, filter: enemyUnits } }],
  },
  {
    key: "tax",
    name: "Tax",
    category: "Disruption",
    text: "Enemy Commands cost 1 more.",
    keywords: [],
    aura: true,
    abilities: [{ id: "sig-tax", trigger: "static", text: "Enemy Commands cost 1 more.", staticEffect: { kind: "cardCostModifier", side: "opponent", amount: 1, cardType: "Command" } }],
  },
  {
    key: "sweep",
    name: "Sweep",
    category: "Disruption",
    text: "On arrival, deal 1 damage to each enemy unit.",
    keywords: [],
    aura: false,
    abilities: [{ id: "sig-sweep", trigger: "onPlay", text: "Deal 1 damage to each enemy unit.", targeting: { scope: "all", filter: enemyUnits }, effects: [{ kind: "damage", amount: { mode: "flat", value: 1 } }] }],
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
}

export function menuOption(key: string): MenuOption {
  const o = SIGNATURE_MENU.find((m) => m.key === key);
  if (!o) throw new Error(`No signature menu option "${key}"`);
  return o;
}

/** A stable id for a body + ability combination, e.g. "sig5-3x6-smite",
 * "sig6-4x8-rally+guard", "sig7-3x7-sweep+dampen". The season-uniqueness
 * rule compares these. */
export function signatureComboId(spec: SignatureSpec): string {
  const extra = spec.keyword ? `+${spec.keyword.toLowerCase()}` : spec.secondAura ? `+${spec.secondAura}` : "";
  return `sig${spec.tier}-${spec.attack}x${spec.health}-${spec.ability}${extra}`;
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
  if (tier.extra === "keyword") {
    if (!spec.keyword || !TIER6_KEYWORDS.includes(spec.keyword)) return "cost 6 takes one keyword: Rush, Guard or Barrier";
    if (option.keywords.includes(spec.keyword)) return `${option.name} already has ${spec.keyword}`;
  } else if (spec.keyword) return `only cost 6 takes a keyword`;
  if (tier.extra === "aura") {
    const aura = SIGNATURE_MENU.find((m) => m.key === spec.secondAura);
    if (!aura || !aura.aura) return "cost 7 takes a second aura (Commander's aura, Shield wall, Dampen or Tax)";
    if (aura.key === spec.ability) return "the second aura must differ from the signature ability";
  } else if (spec.secondAura) return `only cost 7 takes a second aura`;
  return undefined;
}

/** Every combination the owner's table allows: 48 at cost 5, 135 at cost 6
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

/** The signature card for `spec`: a Neutral Mythic Unit. `name` and
 * `art` come from the generator (generated names, the art pipeline); the
 * defaults are for measuring only. Throws if `spec` breaks the table. */
export function buildSignatureCard(spec: SignatureSpec, opts: { name?: string; art?: string; flavor?: string; anyStats?: boolean } = {}): UnitCard {
  const problem = signatureSpecProblem(spec, opts);
  if (problem) throw new Error(`Signature card ${signatureComboId(spec)}: ${problem}`);
  const option = menuOption(spec.ability);
  const keywords: Keyword[] = [...option.keywords];
  if (spec.keyword) keywords.push(spec.keyword);
  const abilities: Ability[] = [...option.abilities];
  if (spec.secondAura) abilities.push(...menuOption(spec.secondAura).abilities);
  const id = signatureComboId(spec);
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
