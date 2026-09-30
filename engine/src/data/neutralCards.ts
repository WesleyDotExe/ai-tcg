// The neutral pool (owner-feedback 2026-09-20, Phase 5 item 10): "a neutral
// pool any faction can run (Pokemon trainer/energy-style shared toolkit),
// sized so hybrid decks are possible. Faction cards carry identity; neutral
// cards carry utility."
//
// Theme: the commons. Shared, unbranded infrastructure every machine faction
// leans on: spare compute, caches, relays, rollback points, commodity racks.
// Nothing here belongs to any one faction's story.
//
// "Utility, not identity" is a checked rule, not a promise. cards/poolLint.ts's
// lintNeutralCard runs on every card below at load time (and on every neutral
// card in every built deck) and refuses:
//   - removal/debuff (the same classifier as the 25% density rule). Answers
//     are faction identity, and each faction already has its own directive
//     answer (Phase 2 item 3);
//   - summoning tokens (Swarm's width), Barrier/Guard/Rush keywords (Aegis's
//     and Cortex's walls, Cortex/Null's haste), evolution lines and
//     telegraphs (board-development identity), board-scaling stats (Cortex's
//     and Null's mutating units), and faction-conditional effects;
//   - Mythic rarity (a signature card is always a faction's).
// What is left is card flow, health, energy, plain bodies and a plain tool,
// which is the trainer/energy shape the entry names.
//
// Variation rule (Phase 5 item 9): the draw archetype has three cards at
// different costs and shapes (an Instant cantrip, a Sorcery double draw, a
// body that draws), energy has two (a one-shot refund and a standing
// end-of-turn refund), health has two (a flat restore and a death-triggered
// one), and bodies have three at different points (a 3/3, a 2/5 engine, a
// tool). No two cards are the same apart from name.

import type { UnitCard, CommandCard, DirectiveCard, ToolCard, Card } from "../cards/types.js";

export const spareCycles: CommandCard = {
  id: "NT-001",
  name: "Spare Cycles",
  faction: "Neutral",
  rarity: "Common",
  cost: 1,
  type: "Command",
  // Instant, so energy held up for a response that never came can still turn
  // into a card at the end of the opponent's turn.
  speed: "Instant",
  art: "placeholder:neutral/spare-cycles",
  flavor: "Idle time is just work nobody has claimed yet.",
  abilities: [
    {
      id: "spare-cycles-cast",
      trigger: "onPlay",
      text: "Draw a card.",
      targeting: { scope: "none" },
      effects: [{ kind: "drawCard", count: 1 }],
    },
  ],
};

export const cacheWarmup: CommandCard = {
  id: "NT-002",
  name: "Cache Warmup",
  faction: "Neutral",
  rarity: "Uncommon",
  cost: 3,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:neutral/cache-warmup",
  flavor: "The second request is always faster.",
  abilities: [
    {
      id: "cache-warmup-cast",
      trigger: "onPlay",
      text: "Draw two cards.",
      targeting: { scope: "none" },
      effects: [{ kind: "drawCard", count: 2 }],
    },
  ],
};

export const relayCourier: UnitCard = {
  id: "NT-003",
  name: "Relay Courier",
  faction: "Neutral",
  rarity: "Common",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 2,
  keywords: [],
  art: "placeholder:neutral/relay-courier",
  flavor: "Carries one packet, never asks what is in it.",
  abilities: [
    {
      id: "relay-courier-arrive",
      trigger: "onPlay",
      text: "When this enters play, draw a card.",
      effects: [{ kind: "drawCard", count: 1 }],
    },
  ],
};

export const rollbackPoint: CommandCard = {
  id: "NT-004",
  name: "Rollback Point",
  faction: "Neutral",
  rarity: "Common",
  cost: 3,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:neutral/rollback-point",
  flavor: "Everything since the snapshot never happened.",
  abilities: [
    {
      id: "rollback-point-cast",
      trigger: "onPlay",
      text: "Restore 5 health to yourself.",
      targeting: { scope: "self" },
      effects: [{ kind: "heal", amount: { mode: "flat", value: 5 } }],
    },
  ],
};

export const surgeProtector: ToolCard = {
  id: "NT-005",
  name: "Surge Protector",
  faction: "Neutral",
  rarity: "Common",
  cost: 1,
  type: "Tool",
  attackBonus: 0,
  healthBonus: 2,
  grantedKeywords: [],
  art: "placeholder:neutral/surge-protector",
  flavor: "Cheap, ugly, and the reason the rack is still standing.",
  abilities: [],
};

export const powerReserve: DirectiveCard = {
  id: "NT-006",
  name: "Power Reserve",
  faction: "Neutral",
  rarity: "Uncommon",
  cost: 2,
  type: "Directive",
  // Energy refills only on your own turn (DESIGN.md, "Resource model"). This
  // hands back one point at the end of your turn, so a player who spent out
  // still has something to answer with during the opponent's turn. It is
  // the reactive pillar's utility card: it does nothing for a player who
  // never holds a response.
  art: "placeholder:neutral/power-reserve",
  flavor: "A capacitor bank nobody remembers installing.",
  abilities: [
    {
      id: "power-reserve-tick",
      trigger: "onTurnEnd",
      text: "At the end of your turn, gain 1 energy.",
      effects: [{ kind: "gainEnergy", amount: 1 }],
    },
  ],
};

export const commodityRack: UnitCard = {
  id: "NT-007",
  name: "Commodity Rack",
  faction: "Neutral",
  rarity: "Common",
  cost: 3,
  type: "Unit",
  attack: 3,
  health: 3,
  keywords: [],
  art: "placeholder:neutral/commodity-rack",
  flavor: "Off-the-shelf, bulk-priced, and exactly as good as it needs to be.",
  abilities: [],
};

export const uplinkTower: UnitCard = {
  id: "NT-008",
  name: "Uplink Tower",
  faction: "Neutral",
  rarity: "Rare",
  cost: 4,
  type: "Unit",
  attack: 2,
  health: 5,
  keywords: [],
  art: "placeholder:neutral/uplink-tower",
  flavor: "Always listening for the next instruction.",
  abilities: [
    {
      // A refuel engine, not a snowball: it draws only while the hand is
      // running low, so it cannot stack cards on a full hand.
      id: "uplink-tower-sync",
      trigger: "onTurnStart",
      text: "At the start of your turn, if you have 2 or fewer cards in hand, draw a card.",
      effects: [
        {
          kind: "conditional",
          condition: { kind: "not", condition: { kind: "handSizeAtLeast", side: "controller", count: 3 } },
          then: [{ kind: "drawCard", count: 1 }],
        },
      ],
    },
  ],
};

export const scrapRecycler: UnitCard = {
  id: "NT-009",
  name: "Scrap Recycler",
  faction: "Neutral",
  rarity: "Common",
  cost: 2,
  type: "Unit",
  attack: 2,
  health: 1,
  keywords: [],
  art: "placeholder:neutral/scrap-recycler",
  flavor: "Strips itself for parts on the way down.",
  abilities: [
    {
      id: "scrap-recycler-salvage",
      trigger: "onDeath",
      text: "When this dies, restore 2 health to you.",
      // A unit's own "self" is the unit, so the controller is named as a
      // player target instead.
      targeting: { scope: "all", filter: { side: "controller", kind: "player" } },
      effects: [{ kind: "heal", amount: { mode: "flat", value: 2 } }],
    },
  ],
};

export const burstCredit: CommandCard = {
  id: "NT-010",
  name: "Burst Credit",
  faction: "Neutral",
  rarity: "Uncommon",
  cost: 0,
  type: "Command",
  speed: "Instant",
  // The energy card. gainEnergy never raises energy above maxEnergy
  // (effects/resolver.ts), so this is a refund of up to 2 already-spent
  // points, not ramp: it lets one turn, or one response window, reach two
  // points further than the curve allows, once.
  art: "placeholder:neutral/burst-credit",
  flavor: "Borrowed against next cycle's allocation. Interest is somebody else's problem.",
  abilities: [
    {
      id: "burst-credit-cast",
      trigger: "onPlay",
      text: "Gain 2 energy (up to your maximum).",
      targeting: { scope: "none" },
      effects: [{ kind: "gainEnergy", amount: 2 }],
    },
  ],
};

/** The neutral pool: every card any faction's deck may draw from. Unlike a
 * faction's `*_CARDS` list this is not a deck, so it has no copy counts; a
 * deck picks its own neutral package (see data/decks.ts's buildDeck for the
 * neutral share cap). */
export const NEUTRAL_POOL: Card[] = [
  spareCycles,
  cacheWarmup,
  relayCourier,
  rollbackPoint,
  surgeProtector,
  powerReserve,
  commodityRack,
  uplinkTower,
  scrapRecycler,
  burstCredit,
];
