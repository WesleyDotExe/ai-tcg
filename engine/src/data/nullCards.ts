// Stage-3 continuation (progress/roadmap.md item 1): the fourth faction.
// "Null" is reserved in cards/types.ts's Faction union since stage 3 but
// was never built — this is that build. Like Aegis, Null is designed to
// exercise the unified board-development system (finite board slots,
// telegraphed threats, evolution, tools — see aegisCards.ts's header for
// the system itself) on a faction with its own distinct mechanical
// identity, not a reskin of an existing one.
//
// Faction identity: Null is corruption/deletion/entropy — crashed
// processes, segfaults, memory that was never freed. Where Cortex plays a
// reactive control game and Aegis plays a defensive stacking game, Null's
// answer to both is attrition: it is the first faction to use the
// `destroy` effect kind (unconditional removal, ignoring stats entirely —
// nothing else in the pool has used it before this) and the first to apply
// *negative* permanent buffs to an opponent's unit (a "decay" debuff,
// where every other faction's `buff` effect so far only ever added stats).
// It also introduces `controllerGraveyardSize` as a live scaling source for
// a unit's own stats (only `controllerUnitsInPlay`/`opponentUnitsInPlay`
// were exercised before this) — a unit that gets stronger the more things
// have already died under its controller, the mechanical expression of
// "feeds on what it deletes." Cyberpunk + 1990s-retro-futurism flavour
// throughout (2026-09-11 owner feedback, item 4), expressed here as
// terminal-crash / kernel-panic / bit-rot imagery rather than Aegis's
// chrome-guardian angle or Cortex's networked-intelligence angle. Original
// names/flavour only; no reproduction of existing TCGs' card identities.

import type { CommandCard, DirectiveCard, ToolCard, UnitCard } from "../cards/types.js";

// --- Evolution line: Glitch Seed -> Corrupted Process -> Kernel Panic -----

export const glitchSeed: UnitCard = {
  id: "NL-001",
  name: "Glitch Seed",
  faction: "Null",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 1,
  health: 2,
  keywords: [],
  art: "placeholder:null/glitch-seed",
  flavor: "A single flipped bit, and the whole process forgets what it was doing.",
  abilities: [],
};

export const corruptedProcess: UnitCard = {
  id: "NL-006",
  name: "Corrupted Process",
  faction: "Null",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 2,
  health: 4,
  keywords: [],
  evolvesFrom: "NL-001",
  art: "placeholder:null/corrupted-process",
  flavor: "It kept running. It just stopped running the program it was given.",
  abilities: [
    {
      id: "corrupted-process-evolve",
      trigger: "onPlay",
      text: "When this evolves in, deal 3 damage to a random enemy unit.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 3 } }],
    },
  ],
};

export const kernelPanic: UnitCard = {
  id: "NL-013",
  name: "Kernel Panic",
  faction: "Null",
  rarity: "Rare",
  cost: 5,
  type: "Unit",
  attack: 4,
  health: 6,
  keywords: [],
  evolvesFrom: "NL-006",
  art: "placeholder:null/kernel-panic",
  flavor: "STOP: everything else on the machine halts so this can finish.",
  abilities: [
    {
      id: "kernel-panic-evolve",
      trigger: "onPlay",
      // "chosen" targeting isn't available here: evolveUnit's onPlay
      // resolution (engine.ts) never supplies a `chosen` ref, the same
      // architectural gap named in quality-debt.md ("triggered abilities
      // can't use chosen targeting, and nothing enforces that") — every
      // existing evolve/telegraph-arm effect in the pool already works
      // around it by using random/all/self, and this one follows suit.
      text: "When this evolves in, destroy a random enemy unit.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [{ kind: "destroy" }],
    },
  ],
};

// --- Telegraphed threats ----------------------------------------------------

export const forkBomb: UnitCard = {
  id: "NL-005",
  name: "Fork Bomb",
  faction: "Null",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 3,
  keywords: [],
  telegraph: 1,
  art: "placeholder:null/fork-bomb",
  flavor: ":(){ :|:& };: — it never stops calling itself, and now it's calling everything else too.",
  abilities: [
    {
      id: "fork-bomb-arm",
      trigger: "onPlay",
      text: "When this arms, deal 1 damage to all enemy units.",
      targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 1 } }],
    },
  ],
};

export const deprecatedRoutine: UnitCard = {
  id: "NL-009",
  name: "Deprecated Routine",
  faction: "Null",
  rarity: "Rare",
  cost: 3,
  type: "Unit",
  attack: 1,
  health: 5,
  keywords: [],
  // telegraph=2, matching the owner's request (2026-09-13 checkpoint
  // feedback) to keep a mix of fuse lengths per card rather than one
  // global number — Fork Bomb above stays at 1 as the short-fuse half of
  // that split for this faction.
  telegraph: 2,
  art: "placeholder:null/deprecated-routine",
  flavor: "Still callable. Nobody remembers why, and it's forgetting too.",
  abilities: [
    {
      id: "deprecated-routine-arm",
      trigger: "onPlay",
      // Same reason as Kernel Panic's evolve effect: processTelegraphArming
      // fires this automatically with no `chosen` ref available, so the
      // target has to be random/all/self, not chosen.
      text: "When this arms, a random enemy unit gets -2/-2 permanently.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [{ kind: "buff", attack: -2, health: -2, duration: "permanent" }],
    },
  ],
};

// --- Tool / attachment cards -------------------------------------------------

export const corruptionPatch: ToolCard = {
  id: "NL-003",
  name: "Corruption Patch",
  faction: "Null",
  rarity: "Common",
  cost: 1,
  type: "Tool",
  attackBonus: 1,
  healthBonus: 1,
  grantedKeywords: [],
  art: "placeholder:null/corruption-patch",
  flavor: "It doesn't fix the bug. It just makes the bug hit harder.",
  abilities: [],
};

export const nullShell: ToolCard = {
  id: "NL-007",
  name: "Null Shell",
  faction: "Null",
  rarity: "Uncommon",
  cost: 1,
  type: "Tool",
  attackBonus: 0,
  healthBonus: 3,
  grantedKeywords: [],
  art: "placeholder:null/null-shell",
  flavor: "Wraps whatever's underneath in nothing at all. Nothing is very hard to hurt.",
  abilities: [],
};

export const decayWard: ToolCard = {
  id: "NL-010",
  name: "Decay Ward",
  faction: "Null",
  rarity: "Rare",
  cost: 2,
  type: "Tool",
  attackBonus: 0,
  healthBonus: 0,
  grantedKeywords: ["Barrier"],
  art: "placeholder:null/decay-ward",
  flavor: "One clean read before the sector goes bad.",
  abilities: [],
};

// --- Rest of the pool: keywords, commands, a directive, static, triggered --

export const strayFragment: UnitCard = {
  id: "NL-002",
  name: "Stray Fragment",
  faction: "Null",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 1,
  health: 2,
  keywords: ["Guard"],
  art: "placeholder:null/stray-fragment",
  flavor: "Leftover from a deallocation that never quite finished.",
  abilities: [],
};

export const segfaultHandler: CommandCard = {
  id: "NL-004",
  name: "Segfault Handler",
  faction: "Null",
  rarity: "Common",
  cost: 2,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:null/segfault-handler",
  flavor: "Access violation at address zero. Whatever was there, isn't anymore.",
  abilities: [
    {
      id: "segfault-handler-cast",
      trigger: "onPlay",
      text: "Deal 3 damage to target enemy unit.",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 3 } }],
    },
  ],
};

export const propagatingExploit: UnitCard = {
  id: "NL-008",
  name: "Propagating Exploit",
  faction: "Null",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 2,
  health: 2,
  keywords: [],
  art: "placeholder:null/propagating-exploit",
  flavor: "Every machine it touches teaches it something it keeps.",
  abilities: [
    {
      id: "propagating-exploit-attack",
      trigger: "onAttack",
      text: "Whenever this attacks, it gains +1/+0 permanently.",
      targeting: { scope: "self" },
      effects: [{ kind: "buff", attack: 1, health: 0, duration: "permanent" }],
    },
  ],
};

export const entropyHarvester: UnitCard = {
  id: "NL-011",
  name: "Entropy Harvester",
  faction: "Null",
  rarity: "Rare",
  cost: 3,
  type: "Unit",
  attack: 1,
  health: 4,
  keywords: [],
  art: "placeholder:null/entropy-harvester",
  flavor: "It doesn't grow. It just collects what everything else stopped needing.",
  abilities: [
    {
      id: "entropy-harvester-static",
      trigger: "static",
      text: "This unit's attack equals 1 plus the number of cards in your graveyard.",
      staticEffect: {
        kind: "selfStatFromScaling",
        attack: { mode: "scaling", base: 1, multiplier: 1, per: "controllerGraveyardSize" },
      },
    },
  ],
};

export const segmentationFault: DirectiveCard = {
  id: "NL-012",
  name: "Segmentation Fault",
  faction: "Null",
  rarity: "Rare",
  cost: 3,
  type: "Directive",
  art: "placeholder:null/segmentation-fault",
  flavor: "A standing violation nobody on the far side can clear.",
  abilities: [
    {
      id: "segmentation-fault-aura",
      trigger: "static",
      text: "Enemy units get -1/-0.",
      staticEffect: { kind: "buffAllies", attack: -1, health: 0, filter: { side: "opponent", kind: "unit" } },
    },
  ],
};

export const nullSingularity: UnitCard = {
  id: "NL-014",
  name: "Null Singularity",
  faction: "Null",
  rarity: "Mythic",
  cost: 6,
  type: "Unit",
  attack: 3,
  health: 8,
  keywords: [],
  art: "placeholder:null/null-singularity",
  flavor: "Not a process anymore. Just the address where every dangling pointer eventually leads.",
  abilities: [
    {
      id: "null-singularity-aura-ally",
      trigger: "static",
      text: "Your units get +1/+0.",
      staticEffect: { kind: "buffAllies", attack: 1, health: 0, filter: { side: "controller", kind: "unit" } },
    },
    {
      id: "null-singularity-aura-enemy",
      trigger: "static",
      text: "Enemy units get -1/-1.",
      staticEffect: { kind: "buffAllies", attack: -1, health: -1, filter: { side: "opponent", kind: "unit" } },
    },
  ],
};

export const NULL_CARDS: { card: UnitCard | CommandCard | DirectiveCard | ToolCard; copies: number }[] = [
  { card: glitchSeed, copies: 3 },
  { card: strayFragment, copies: 3 },
  { card: corruptionPatch, copies: 3 },
  { card: segfaultHandler, copies: 3 },
  { card: forkBomb, copies: 3 },
  { card: corruptedProcess, copies: 3 },
  { card: nullShell, copies: 2 },
  { card: propagatingExploit, copies: 3 },
  { card: deprecatedRoutine, copies: 2 },
  { card: decayWard, copies: 2 },
  { card: entropyHarvester, copies: 2 },
  { card: segmentationFault, copies: 2 },
  { card: kernelPanic, copies: 2 },
  { card: nullSingularity, copies: 1 },
];
