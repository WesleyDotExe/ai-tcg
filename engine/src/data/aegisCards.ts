// Stage-3 deliverable: the first *real* card set (see DESIGN.md's build
// order). Where Cortex/Swarm (cards.ts) exist to prove the effect system
// can express every mechanic category, Aegis exists to prove and exercise
// the owner's 2026-09-12 design-directive batch: the unified
// board-development system — finite face-up board slots (see
// state/init.ts's BOARD_SLOTS), telegraphed threats, evolution/upgrade
// cards, and tool/attachment cards, all sharing the same scarce-board-space
// spine and built to interact rather than as three isolated features (a
// telegraphed unit can be tooled up before it arms; an evolution base sitting
// on the board is itself a "will this get answered before it grows" threat;
// evolving carries an attached tool, accumulated damage, and statuses
// forward on the same instance rather than replacing it).
//
// Faction identity: Aegis is a hardened, defensive machine-guardian
// network — chrome plating, CRT-terminal diagnostics, the optimistic,
// synthetic "future as imagined in the 90s" the owner asked for (2026-09-11
// feedback, item 4) — the counterweight to Cortex's networked-intelligence
// control and Swarm's biological-mass aggression. Original names/flavour
// only; no reproduction of existing TCGs' card identities or keyword text.

import type { CommandCard, DirectiveCard, ToolCard, UnitCard } from "../cards/types.js";

// --- Evolution line: Cadet -> Sentinel -> Warden ---------------------------

export const aegisCadet: UnitCard = {
  id: "AG-001",
  name: "Aegis Cadet",
  faction: "Aegis",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 1,
  health: 2,
  keywords: [],
  art: "placeholder:aegis/aegis-cadet",
  flavor: "Boots up green on a chrome shell three sizes too big.",
  abilities: [],
};

export const aegisSentinel: UnitCard = {
  id: "AG-007",
  name: "Aegis Sentinel",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 3,
  health: 4,
  keywords: [],
  evolvesFrom: "AG-001",
  art: "placeholder:aegis/aegis-sentinel",
  flavor: "The plating thickens. So does the resolve.",
  abilities: [
    {
      id: "aegis-sentinel-evolve",
      trigger: "onPlay",
      text: "When this evolves in, recover 1 energy.",
      effects: [{ kind: "gainEnergy", amount: 1 }],
    },
  ],
};

export const aegisWarden: UnitCard = {
  id: "AG-013",
  name: "Aegis Warden",
  faction: "Aegis",
  rarity: "Rare",
  cost: 5,
  type: "Unit",
  attack: 5,
  health: 7,
  keywords: [],
  evolvesFrom: "AG-007",
  art: "placeholder:aegis/aegis-warden",
  flavor: "Every scar it kept becomes a weld line. Nothing gets through twice.",
  abilities: [
    {
      id: "aegis-warden-evolve",
      trigger: "onPlay",
      text: "When this evolves in, restore it to full health and it gains Barrier.",
      targeting: { scope: "self" },
      effects: [
        { kind: "heal", amount: { mode: "flat", value: 10 } },
        { kind: "applyStatus", status: "Barrier", duration: "untilConsumed" },
      ],
    },
  ],
};

// --- Telegraphed threats ----------------------------------------------------

export const perimeterTurret: UnitCard = {
  id: "AG-005",
  name: "Perimeter Turret",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 2,
  health: 4,
  keywords: [],
  telegraph: 1,
  art: "placeholder:aegis/perimeter-turret",
  flavor: "Deployed cold. Arms itself once it trusts the perimeter.",
  abilities: [
    {
      id: "perimeter-turret-arm",
      trigger: "onPlay",
      text: "When this arms, deal 3 damage to a random enemy unit.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 3 } }],
    },
  ],
};

export const latentWard: UnitCard = {
  id: "AG-011",
  name: "Latent Ward",
  faction: "Aegis",
  rarity: "Rare",
  cost: 3,
  type: "Unit",
  attack: 1,
  health: 5,
  keywords: [],
  // telegraph=2, not 1: the owner's stage-3 checkpoint feedback (item 3)
  // asked for a longer fuse tried on some telegraph cards, kept per-card so
  // a mix is possible — Perimeter Turret below stays at 1 as the other half
  // of that comparison. A 2-turn-fuse, board-wide Barrier payoff is also
  // the natural fit: it's the bigger swing of the two telegraphed units, so
  // it earning a longer "see it coming, answer it" window before it fires
  // reads right thematically, not just as an arbitrary A/B split.
  telegraph: 2,
  art: "placeholder:aegis/latent-ward",
  flavor: "Sits dark on the grid until the moment it lights every board at once.",
  abilities: [
    {
      id: "latent-ward-arm",
      trigger: "onPlay",
      text: "When this arms, your units gain Barrier.",
      targeting: { scope: "all", filter: { side: "controller", kind: "unit" } },
      effects: [{ kind: "applyStatus", status: "Barrier", duration: "untilConsumed" }],
    },
  ],
};

// --- Tool / attachment cards -------------------------------------------------

export const platingModule: ToolCard = {
  id: "AG-003",
  name: "Plating Module",
  faction: "Aegis",
  rarity: "Common",
  cost: 1,
  type: "Tool",
  attackBonus: 0,
  healthBonus: 3,
  grantedKeywords: [],
  art: "placeholder:aegis/plating-module",
  flavor: "Bolt it on. It was never going to be pretty anyway.",
  abilities: [],
};

export const guardDirectiveChip: ToolCard = {
  id: "AG-006",
  name: "Guard Directive Chip",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 2,
  type: "Tool",
  attackBonus: 1,
  healthBonus: 1,
  grantedKeywords: ["Guard"],
  art: "placeholder:aegis/guard-directive-chip",
  flavor: "One line of firmware, and it decides nothing gets past it.",
  abilities: [],
};

export const barrierShim: ToolCard = {
  id: "AG-010",
  name: "Barrier Shim",
  faction: "Aegis",
  rarity: "Rare",
  cost: 2,
  type: "Tool",
  attackBonus: 0,
  healthBonus: 0,
  grantedKeywords: ["Barrier"],
  art: "placeholder:aegis/barrier-shim",
  flavor: "A single-use field, wired into whatever's standing closest.",
  abilities: [],
};

// --- Rest of the pool: keywords, commands, a directive, static, triggered --

export const barrierDrone: UnitCard = {
  id: "AG-002",
  name: "Barrier Drone",
  faction: "Aegis",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 0,
  health: 3,
  keywords: ["Guard"],
  art: "placeholder:aegis/barrier-drone",
  flavor: "It has one job. It stands in front of things.",
  abilities: [],
};

export const diagnosticWard: CommandCard = {
  id: "AG-004",
  name: "Diagnostic Ward",
  faction: "Aegis",
  rarity: "Common",
  cost: 2,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:aegis/diagnostic-ward",
  flavor: "Green text scrolls: SYSTEMS NOMINAL. Mostly true.",
  abilities: [
    {
      id: "diagnostic-ward-cast",
      trigger: "onPlay",
      text: "Restore 2 health to yourself. If your hand has 1 or fewer cards, draw a card.",
      targeting: { scope: "self" },
      effects: [
        { kind: "heal", amount: { mode: "flat", value: 2 } },
        {
          kind: "conditional",
          condition: { kind: "not", condition: { kind: "handSizeAtLeast", side: "controller", count: 2 } },
          then: [{ kind: "drawCard", count: 1 }],
        },
      ],
    },
  ],
};

export const failoverCustodian: UnitCard = {
  id: "AG-009",
  name: "Failover Custodian",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 3,
  keywords: [],
  art: "placeholder:aegis/failover-custodian",
  flavor: "Every hit is just a diagnostic it failed and then patched.",
  abilities: [
    {
      id: "failover-custodian-damaged",
      trigger: "onDamaged",
      text: "Whenever this unit is damaged, restore 1 health to it.",
      targeting: { scope: "self" },
      effects: [{ kind: "heal", amount: { mode: "flat", value: 1 } }],
    },
  ],
};

export const staticWardBeacon: DirectiveCard = {
  id: "AG-008",
  name: "Static Ward Beacon",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 3,
  type: "Directive",
  art: "placeholder:aegis/static-ward-beacon",
  flavor: "A steady chrome hum, and the whole line stands a little straighter.",
  abilities: [
    {
      id: "static-ward-beacon-aura",
      trigger: "static",
      text: "Your units get +0/+1.",
      staticEffect: { kind: "buffAllies", attack: 0, health: 1, filter: { side: "controller", kind: "unit" } },
    },
  ],
};

export const lockdownField: CommandCard = {
  id: "AG-012",
  name: "Lockdown Field",
  faction: "Aegis",
  rarity: "Rare",
  cost: 4,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:aegis/lockdown-field",
  flavor: "Every actuator on the far side of the field freezes mid-cycle.",
  abilities: [
    {
      id: "lockdown-field-cast",
      trigger: "onPlay",
      text: "Stun all enemy units for 1 turn.",
      targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "applyStatus", status: "Stasis", duration: 1 }],
    },
  ],
};

export const primeAegis: UnitCard = {
  id: "AG-014",
  name: "Prime Aegis",
  faction: "Aegis",
  rarity: "Mythic",
  cost: 6,
  type: "Unit",
  attack: 4,
  health: 8,
  keywords: [],
  art: "placeholder:aegis/prime-aegis",
  flavor: "The reference implementation every other guardian was compiled from.",
  abilities: [
    {
      id: "prime-aegis-aura-ally",
      trigger: "static",
      text: "Your units get +1/+1.",
      staticEffect: { kind: "buffAllies", attack: 1, health: 1, filter: { side: "controller", kind: "unit" } },
    },
    {
      id: "prime-aegis-aura-enemy",
      trigger: "static",
      text: "Enemy units get -1/-0.",
      staticEffect: { kind: "buffAllies", attack: -1, health: 0, filter: { side: "opponent", kind: "unit" } },
    },
  ],
};

// --- Defensive interaction (2026-09-19 owner feedback: "Aegis gets defensive
// answers, not removal") -----------------------------------------------------
//
// Session 10's balance investigation found Aegis's real problem wasn't that
// Null (or anyone) hits too hard — it's that Aegis's own kit has almost no
// independent interaction at all (Perimeter Turret's telegraphed random
// 3-damage hit and Lockdown Field's 1-turn AOE stun were close to its whole
// answer suite). The owner's direction: fix that with interaction that fits
// the hardened-guardian identity — intercepting/redirecting attacks, damage
// reflection, blunting or taxing what the opponent commits — explicitly NOT
// outright removal. Aegis should be able to survive a threat it can't
// answer, and still not be able to delete it; "outlast them," not "control
// them." Three cards below, each a genuinely different mechanic, none of
// them destroy/remove:

export const interceptRoutine: CommandCard = {
  id: "AG-015",
  name: "Intercept Routine",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 1,
  type: "Command",
  speed: "Instant",
  art: "placeholder:aegis/intercept-routine",
  flavor: "The hit was already routed. This just changes where it lands.",
  abilities: [
    {
      id: "intercept-routine-cast",
      trigger: "onPlay",
      // The headline "intercepting/redirecting attacks" answer. A new
      // generic effect kind, redirectAttack (cards/types.ts,
      // effects/resolver.ts's redirectTopAttack): cast at Instant speed in
      // response to a declared attack (a pending combatDamage stack item —
      // see engine.ts's declareAttack), it retargets that attack to a unit
      // you control instead. Nothing is destroyed or countered — the
      // attack still resolves in full, including the attacker taking
      // return damage from whoever it now hits — this is a Guard-style
      // interception made reactive instead of a standing keyword, not
      // removal by another name.
      text: "Instant. Redirect a pending attack to target unit you control.",
      targeting: { scope: "chosen", filter: { side: "controller", kind: "unit" } },
      effects: [{ kind: "redirectAttack" }],
    },
  ],
};

export const tariffField: DirectiveCard = {
  id: "AG-016",
  name: "Tariff Field",
  faction: "Aegis",
  rarity: "Rare",
  cost: 3,
  type: "Directive",
  art: "placeholder:aegis/tariff-field",
  flavor: "Every packet that crosses the line pays a toll first.",
  abilities: [
    {
      id: "tariff-field-aura",
      trigger: "static",
      // The "taxing what the opponent commits" answer. A new generic
      // static-effect kind, cardCostModifier (cards/types.ts,
      // state/queries.ts's effectiveCardCost): every card the opponent
      // plays costs 1 more energy while this is in play. Doesn't stop
      // anything outright — a determined opponent can still pay it — but
      // it blunts their curve and makes their board development slower and
      // more constrained turn over turn, a genuinely different pressure
      // than damage or stat debuffs.
      text: "Enemy cards cost 1 more to play.",
      staticEffect: { kind: "cardCostModifier", side: "opponent", amount: 1 },
    },
  ],
};

export const feedbackPlating: UnitCard = {
  id: "AG-017",
  name: "Feedback Plating",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 4,
  keywords: [],
  art: "placeholder:aegis/feedback-plating",
  flavor: "Every impact bleeds current back down the line — just enough to hurt.",
  abilities: [
    {
      id: "feedback-plating-damaged",
      trigger: "onDamaged",
      // The "blunting" answer: every hit this unit takes saps the
      // opponent's whole board's offense for the rest of the turn — real
      // pressure back on whoever commits to attacking it, without killing
      // or permanently maiming anything. Untargeted (onDamaged has no
      // agent decision point to supply a chosen target — see
      // quality-debt.md's architectural-gaps note, unaffected by this
      // session's evolve/telegraph-specific chosen-targeting fix), so it
      // hits the whole enemy board rather than just the attacker, same
      // pattern as every other automatic-trigger effect in the pool.
      text: "Whenever this is damaged, enemy units get -1/-0 until end of turn.",
      targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "buff", attack: -1, health: 0, duration: "turn" }],
    },
  ],
};

export const AEGIS_CARDS: { card: UnitCard | CommandCard | DirectiveCard | ToolCard; copies: number }[] = [
  { card: aegisCadet, copies: 3 },
  { card: barrierDrone, copies: 3 },
  { card: platingModule, copies: 3 },
  { card: diagnosticWard, copies: 3 },
  { card: perimeterTurret, copies: 3 },
  { card: guardDirectiveChip, copies: 2 },
  { card: aegisSentinel, copies: 3 },
  { card: staticWardBeacon, copies: 2 },
  { card: failoverCustodian, copies: 3 },
  { card: barrierShim, copies: 2 },
  { card: latentWard, copies: 2 },
  { card: lockdownField, copies: 2 },
  { card: aegisWarden, copies: 2 },
  { card: primeAegis, copies: 1 },
  { card: interceptRoutine, copies: 1 },
  { card: tariffField, copies: 1 },
  { card: feedbackPlating, copies: 1 },
];
