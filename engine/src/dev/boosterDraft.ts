// DRAFT, NOT SHIPPED. The Season 0 booster-card proposal (owner 2026-11-14,
// option B: "a small pack-only booster set for Season 0: about 24-30 new
// cards, about 6-7 per faction ... the new cards use only abilities the
// engine already has (no new mechanics), and they power up each faction's
// existing plan"; first step: "the game lane proposes the card list at an
// [OWNER CHECK-IN] for the owner's approval before building it").
//
// These cards are written as real card data so the proposal can be checked
// by the engine itself (dev/boosterProposal.ts: the lint, a real match for
// every card, and a first power read against the starter decks). They are
// NOT in the card registry (data/registry.ts), not in any set, pack or
// starter deck, and can't be owned. Nothing here changes a shipped card,
// deck, rule or pack. Once the owner approves (or changes) the list, the
// build moves them into the faction files and the registry, with a new
// CARDS_VERSIONS entry.
//
// Every effect, trigger, condition, scaling source and keyword below is one
// the engine already resolves for a shipped card (or, for onKill, the
// approved signature menu's Hunter). The proposal's report lists which
// shipped card each one borrows its mechanism from.
//
// Ids: the 1xx range of each faction's prefix (CX-101 ... NL-107), so the
// booster cards never collide with the starter numbering (CX-001 ... ) or
// a trimmed card's id. Rarity split per faction: 2 Common, 2 Uncommon,
// 2 Rare, 1 Mythic (28 cards: 8 / 8 / 8 / 4), the shape the pack's slots
// need (2 Commons, 1 Uncommon, the Rare slot with a Mythic 1 time in 8).

import type {
  Ability,
  CommandCard,
  DirectiveCard,
  Faction,
  Keyword,
  Rarity,
  TokenSpec,
  ToolCard,
  UnitCard,
} from "../cards/types.js";

const art = (faction: Faction, name: string) =>
  `placeholder:${faction.toLowerCase()}/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

function unit(
  id: string, name: string, faction: Faction, rarity: Rarity, cost: number,
  attack: number, health: number, keywords: Keyword[], flavor: string, abilities: Ability[],
): UnitCard {
  return { id, name, faction, rarity, cost, type: "Unit", attack, health, keywords, art: art(faction, name), flavor, abilities };
}

function command(
  id: string, name: string, faction: Faction, rarity: Rarity, cost: number,
  speed: CommandCard["speed"], flavor: string, abilities: Ability[], modes?: CommandCard["modes"],
): CommandCard {
  return { id, name, faction, rarity, cost, type: "Command", speed, art: art(faction, name), flavor, abilities, ...(modes ? { modes } : {}) };
}

function directive(id: string, name: string, faction: Faction, rarity: Rarity, cost: number, flavor: string, abilities: Ability[]): DirectiveCard {
  return { id, name, faction, rarity, cost, type: "Directive", art: art(faction, name), flavor, abilities };
}

function tool(
  id: string, name: string, faction: Faction, rarity: Rarity, cost: number,
  attackBonus: number, healthBonus: number, grantedKeywords: Keyword[], flavor: string,
): ToolCard {
  return { id, name, faction, rarity, cost, type: "Tool", attackBonus, healthBonus, grantedKeywords, art: art(faction, name), flavor, abilities: [] };
}

// The tokens are the starter cards' own (Brood Reserves' Swarm Larva,
// Zombie Process's Orphaned Thread), so the board shows nothing new.
const SWARM_LARVA: TokenSpec = {
  name: "Swarm Larva", faction: "Swarm", attack: 1, health: 1, keywords: [],
  art: "placeholder:swarm/swarm-larva", flavor: "One of ten thousand. Ten thousand more where it came from.",
};
const ORPHANED_THREAD: TokenSpec = {
  name: "Orphaned Thread", faction: "Null", attack: 1, health: 1, keywords: [],
  art: "placeholder:null/orphaned-thread", flavor: "Still running. Still waiting for a join that will never come.",
};

const ENEMY_UNIT = { side: "opponent", kind: "unit" } as const;
const FRIENDLY_UNIT = { side: "controller", kind: "unit" } as const;
const flat = (value: number) => ({ mode: "flat", value }) as const;

// ---- Cortex: the cluster. Count your units, ping theirs, keep the energy flowing. ----

export const CORTEX_BOOSTER = [
  // First cut pinged a random enemy unit on play; the probe deck then failed
  // the pool lint (Cortex removal/debuff 27.5%, over the 25% cap, with
  // Parity Checker and Grid Consensus in), so it pays back energy instead:
  // Watchtower Relay's mechanism, on Cortex's count-your-units condition.
  unit("CX-101", "Port Scanner", "Cortex", "Common", 1, 1, 1, [], "It knocks on every door, just to hear which ones answer.", [
    { id: "port-scanner-play", trigger: "onPlay", text: "When this enters play, if you control 3 or more units, recover 1 energy.",
      condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 3 }, effects: [{ kind: "gainEnergy", amount: 1 }] },
  ]),
  unit("CX-102", "Mutex Lock", "Cortex", "Common", 2, 1, 3, ["Guard"], "One at a time. Everyone else waits at the gate.", []),
  unit("CX-103", "Cluster Node", "Cortex", "Uncommon", 4, 1, 3, [], "Alone it is a server. Racked with the others it is a grid.", [
    { id: "cluster-node-aura", trigger: "static", text: "Your other units get +1/+0.",
      staticEffect: { kind: "buffAllies", attack: 1, health: 0, filter: FRIENDLY_UNIT, excludeSelf: true } },
  ]),
  command("CX-104", "Hot Swap", "Cortex", "Uncommon", 2, "Instant", "Pull the failing part, slot the spare, never drop the connection.", [
    { id: "hot-swap-cast", trigger: "onPlay", text: "Give target friendly unit +2/+2 this turn. If you control 3 or more units, draw a card. Instant speed.",
      targeting: { scope: "chosen", filter: FRIENDLY_UNIT },
      effects: [
        { kind: "buff", attack: 2, health: 2, duration: "turn" },
        { kind: "conditional", condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 3 }, then: [{ kind: "drawCard", count: 1 }] },
      ] },
  ]),
  unit("CX-105", "Parity Checker", "Cortex", "Rare", 3, 2, 4, [], "Every bit that disagrees with the checksum gets corrected, one at a time.", [
    { id: "parity-checker-correct", trigger: "activated", text: "Pay 2 energy: deal 1 damage to target enemy unit. Instant speed. Once per turn.",
      cost: { energy: 2 }, speed: "Instant", limit: "oncePerTurn",
      targeting: { scope: "chosen", filter: ENEMY_UNIT }, effects: [{ kind: "damage", amount: flat(1) }] },
  ]),
  directive("CX-106", "Job Scheduler", "Cortex", "Rare", 3, "Every cycle it looks at the queue and hands the next task to whoever is free.", [
    { id: "job-scheduler-tick", trigger: "onTurnStart", text: "At the start of your turn, if you control 3 or more units, draw a card.",
      condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 3 }, effects: [{ kind: "drawCard", count: 1 }] },
  ]),
  unit("CX-107", "Grid Consensus", "Cortex", "Mythic", 6, 1, 6, [], "No single node decides. All of them do, and they never disagree.", [
    { id: "grid-consensus-scale", trigger: "static", text: "This unit's attack equals 1 plus the number of units you control.",
      staticEffect: { kind: "selfStatFromScaling", attack: { mode: "scaling", base: 1, multiplier: 1, per: "controllerUnitsInPlay" } } },
    { id: "grid-consensus-play", trigger: "onPlay", text: "When this enters play, deal 1 damage to all enemy units.",
      targeting: { scope: "all", filter: ENEMY_UNIT }, effects: [{ kind: "damage", amount: flat(1) }] },
  ]),
];

// ---- Swarm: go wide, die well, come back. ----

export const SWARM_BOOSTER = [
  unit("SW-101", "Egg Courier", "Swarm", "Common", 2, 2, 2, [], "It carries the next generation on its back, and drops it when it falls.", [
    { id: "egg-courier-death", trigger: "onDeath", text: "When this dies, summon a 1/1 Swarm Larva.",
      effects: [{ kind: "summon", token: SWARM_LARVA, count: 1 }] },
  ]),
  command("SW-102", "Spawning Pulse", "Swarm", "Common", 1, "Sorcery", "A single signal, and the walls start to crawl.", [
    { id: "spawning-pulse-cast", trigger: "onPlay", text: "Summon a 1/1 Swarm Larva. Then, if you control 2 or more units, draw a card.",
      effects: [
        { kind: "summon", token: SWARM_LARVA, count: 1 },
        { kind: "conditional", condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 2 }, then: [{ kind: "drawCard", count: 1 }] },
      ] },
  ]),
  unit("SW-103", "Hive Relay", "Swarm", "Uncommon", 3, 3, 3, [], "It hums a frequency only the brood can hear, and the brood answers.", [
    { id: "hive-relay-tick", trigger: "onTurnStart", text: "At the start of your turn, if you control 2 or more units, summon a 1/1 Swarm Larva.",
      condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 2 }, effects: [{ kind: "summon", token: SWARM_LARVA, count: 1 }] },
  ]),
  unit("SW-104", "Acid Drone", "Swarm", "Uncommon", 2, 2, 2, [], "Crush it and it bursts. Everything nearby wishes you hadn't.", [
    { id: "acid-drone-death", trigger: "onDeath", text: "When this dies, deal 2 damage to a random enemy unit.",
      targeting: { scope: "random", filter: ENEMY_UNIT, count: 1 }, effects: [{ kind: "damage", amount: flat(2) }] },
  ]),
  command("SW-105", "Swarm Surge", "Swarm", "Rare", 2, "Instant", "The brood never decides between more and stronger. It just picks the one you didn't plan for.", [], [
    { id: "overrun", name: "Overrun", text: "Your units get +2/+1 this turn. Instant speed.", abilities: [
      { id: "swarm-surge-overrun", trigger: "onPlay", text: "Your units get +2/+1 this turn. Instant speed.",
        targeting: { scope: "all", filter: FRIENDLY_UNIT }, effects: [{ kind: "buff", attack: 2, health: 1, duration: "turn" }] },
    ] },
    { id: "brood", name: "Brood", text: "Summon two 1/1 Swarm Larvae. Instant speed.", abilities: [
      { id: "swarm-surge-brood", trigger: "onPlay", text: "Summon two 1/1 Swarm Larvae. Instant speed.",
        effects: [{ kind: "summon", token: SWARM_LARVA, count: 2 }] },
    ] },
  ]),
  unit("SW-106", "Brood Tyrant", "Swarm", "Rare", 3, 0, 4, [], "It is only as large as the colony behind it, and the colony is never small.", [
    { id: "brood-tyrant-scale", trigger: "static", text: "This unit's attack equals 1 plus the number of units you control.",
      staticEffect: { kind: "selfStatFromScaling", attack: { mode: "scaling", base: 1, multiplier: 1, per: "controllerUnitsInPlay" } } },
  ]),
  unit("SW-107", "Colony Overmind", "Swarm", "Mythic", 6, 4, 5, [], "Ten thousand minds, one appetite.", [
    { id: "colony-overmind-play", trigger: "onPlay", text: "When this enters play, summon two 1/1 Swarm Larvae.",
      effects: [{ kind: "summon", token: SWARM_LARVA, count: 2 }] },
    { id: "colony-overmind-tick", trigger: "onTurnEnd", text: "At the end of your turn, if you control 4 or more units, your units get +1/+0 permanently.",
      condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 4 },
      targeting: { scope: "all", filter: FRIENDLY_UNIT }, effects: [{ kind: "buff", attack: 1, health: 0, duration: "permanent" }] },
  ]),
];

// ---- Aegis: walls, Barrier, outlast. ----

export const AEGIS_BOOSTER = [
  unit("AG-101", "Shield Relay", "Aegis", "Common", 2, 1, 3, [], "It doesn't block the hit. It makes sure someone else is ready for it.", [
    { id: "shield-relay-play", trigger: "onPlay", text: "When this enters play, target friendly unit gains Barrier.",
      targeting: { scope: "chosen", filter: FRIENDLY_UNIT }, effects: [{ kind: "applyStatus", status: "Barrier", duration: "untilConsumed" }] },
  ]),
  tool("AG-102", "Kinetic Buffer", "Aegis", "Common", 2, 1, 2, [], "It stores the force of the last blow and hands it back."),
  unit("AG-103", "Bastion Array", "Aegis", "Uncommon", 3, 1, 4, ["Guard"], "Every hit it takes is logged, and every log entry pays the operator back.", [
    { id: "bastion-array-damaged", trigger: "onDamaged", text: "Whenever this unit is damaged, restore 1 health to you.",
      targeting: { scope: "all", filter: { side: "controller", kind: "player" } }, effects: [{ kind: "heal", amount: flat(1) }] },
  ]),
  command("AG-104", "Hardlight Shell", "Aegis", "Uncommon", 2, "Instant", "Projected in the instant before impact, gone the instant after.", [
    { id: "hardlight-shell-cast", trigger: "onPlay", text: "Target friendly unit gains Barrier. Draw a card. Instant speed.",
      targeting: { scope: "chosen", filter: FRIENDLY_UNIT },
      effects: [{ kind: "applyStatus", status: "Barrier", duration: "untilConsumed" }, { kind: "drawCard", count: 1 }] },
  ]),
  unit("AG-105", "Mirror Bulwark", "Aegis", "Rare", 3, 1, 5, ["Guard"], "Strike the mirror and see who it hurts.", [
    { id: "mirror-bulwark-damaged", trigger: "onDamaged", text: "Whenever this unit is damaged, deal 1 damage to a random enemy unit. Once per turn.",
      limit: "oncePerTurn",
      targeting: { scope: "random", filter: ENEMY_UNIT, count: 1 }, effects: [{ kind: "damage", amount: flat(1) }] },
  ]),
  // Measured twice as "a random friendly unit gains Barrier" each turn
  // (cost 3, then 2): the deck was worse with it in (-2.5, -1.9 points in
  // the leave-one-out). Now Aegis's stacking plan, one permanent point a
  // turn, Propagating Exploit's permanent buff on Aegis's side.
  directive("AG-106", "Hardening Protocol", "Aegis", "Rare", 3, "Every morning, one more system gets patched. Nobody gets to skip a day.", [
    { id: "hardening-protocol-tick", trigger: "onTurnStart", text: "At the start of your turn, a random friendly unit gets +1/+1 permanently.",
      targeting: { scope: "random", filter: FRIENDLY_UNIT, count: 1 }, effects: [{ kind: "buff", attack: 1, health: 1, duration: "permanent" }] },
  ]),
  unit("AG-107", "Aegis Overwatch", "Aegis", "Mythic", 6, 3, 5, ["Guard"], "It sees the whole perimeter at once, and mends whatever got through.", [
    { id: "aegis-overwatch-play", trigger: "onPlay", text: "When this enters play, your units gain Barrier.",
      targeting: { scope: "all", filter: FRIENDLY_UNIT }, effects: [{ kind: "applyStatus", status: "Barrier", duration: "untilConsumed" }] },
    { id: "aegis-overwatch-tick", trigger: "onTurnEnd", text: "At the end of your turn, restore 1 health to each of your units.",
      targeting: { scope: "all", filter: FRIENDLY_UNIT }, effects: [{ kind: "heal", amount: flat(1) }] },
  ]),
];

// ---- Null: corrupt, shrink, outlast; what dies leaves something behind. ----

export const NULL_BOOSTER = [
  unit("NL-101", "Bad Sector", "Null", "Common", 1, 1, 1, [], "Write to it once and the corruption spreads to whatever touched it.", [
    { id: "bad-sector-death", trigger: "onDeath", text: "When this dies, a random enemy unit gets -1/-0 permanently.",
      targeting: { scope: "random", filter: ENEMY_UNIT, count: 1 }, effects: [{ kind: "buff", attack: -1, health: 0, duration: "permanent" }] },
  ]),
  command("NL-102", "Memory Leak", "Null", "Common", 2, "Sorcery", "Nothing is taken all at once. It just never comes back.", [
    { id: "memory-leak-cast", trigger: "onPlay", text: "Target enemy unit gets -1/-1 permanently (it can't take health below 1). Draw a card.",
      targeting: { scope: "chosen", filter: ENEMY_UNIT },
      effects: [{ kind: "buff", attack: -1, health: -1, duration: "permanent" }, { kind: "drawCard", count: 1 }] },
  ]),
  unit("NL-103", "Reaper Thread", "Null", "Uncommon", 3, 2, 3, [], "It ends what the others leave running, and reads the leftovers.", [
    { id: "reaper-thread-kill", trigger: "onKill", text: "Whenever this destroys a unit, draw a card.", effects: [{ kind: "drawCard", count: 1 }] },
  ]),
  unit("NL-104", "Zombie Fork", "Null", "Uncommon", 2, 2, 2, [], "Kill the parent and both children keep running.", [
    { id: "zombie-fork-death", trigger: "onDeath", text: "When this dies, create two 1/1 Orphaned Thread tokens.",
      effects: [{ kind: "summon", token: ORPHANED_THREAD, count: 2 }] },
  ]),
  unit("NL-105", "Heap Spray", "Null", "Rare", 4, 2, 4, [], "It floods memory with junk until nothing else can run at full strength.", [
    { id: "heap-spray-play", trigger: "onPlay", text: "When this enters play, enemy units get -1/-0 permanently.",
      targeting: { scope: "all", filter: ENEMY_UNIT }, effects: [{ kind: "buff", attack: -1, health: 0, duration: "permanent" }] },
  ]),
  unit("NL-106", "Decay Engine", "Null", "Rare", 4, 2, 4, [], "It doesn't attack. It waits, and everything near it gets a little less.", [
    { id: "decay-engine-tick", trigger: "onTurnEnd", text: "At the end of your turn, a random enemy unit gets -1/-0 permanently.",
      targeting: { scope: "random", filter: ENEMY_UNIT, count: 1 }, effects: [{ kind: "buff", attack: -1, health: 0, duration: "permanent" }] },
  ]),
  unit("NL-107", "Heat Death", "Null", "Mythic", 6, 3, 6, [], "Not an explosion. Just the slow, even end of every difference.", [
    { id: "heat-death-play", trigger: "onPlay", text: "When this enters play, enemy units get -1/-0 permanently.",
      targeting: { scope: "all", filter: ENEMY_UNIT }, effects: [{ kind: "buff", attack: -1, health: 0, duration: "permanent" }] },
    { id: "heat-death-death", trigger: "onDeath", text: "When this dies, create two 1/1 Orphaned Thread tokens.",
      effects: [{ kind: "summon", token: ORPHANED_THREAD, count: 2 }] },
  ]),
];

export const BOOSTER_DRAFT = {
  Cortex: CORTEX_BOOSTER,
  Swarm: SWARM_BOOSTER,
  Aegis: AEGIS_BOOSTER,
  Null: NULL_BOOSTER,
} as const;
