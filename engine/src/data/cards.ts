// The stage-1 test card pool. Two factions, enough mechanical variety to
// exercise every category DESIGN.md calls out as a required-not-optional
// part of the effect system: keywords, triggered abilities (onPlay/onAttack
// /onDamaged/onDeath/onTurnStart/onTurnEnd), activated abilities,
// static/continuous auras, targeted effects, AOE, conditionals, and
// state-mutating (board-scaling) stats — plus, per the owner's stage-1
// checkpoint feedback, real Instant-speed cards/abilities (Interrupt
// Handler, Reflex Spike, Cortex Engineer's repair) that exercise the
// priority-passing reactive core in engine/engine.ts.
//
// This is deliberately not a "real card set" (that's build-order stage 3) —
// it exists to prove the rules engine can express the full range, and to
// give the dummy agents a real game to play. Original names/flavour only;
// no reproduction of existing TCGs' keywords-as-text or card identities.

import type { UnitCard, CommandCard, DirectiveCard, ToolCard } from "../cards/types.js";

export const signalDrone: UnitCard = {
  id: "CX-001",
  name: "Signal Drone",
  faction: "Cortex",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 1,
  health: 1,
  keywords: ["Rush"],
  art: "placeholder:cortex/signal-drone",
  flavor: "First to the wire, first to fall.",
  abilities: [],
};

export const firewallSentinel: UnitCard = {
  id: "CX-002",
  name: "Firewall Sentinel",
  faction: "Cortex",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 2,
  health: 5,
  keywords: ["Guard"],
  art: "placeholder:cortex/firewall-sentinel",
  flavor: "Nothing passes the perimeter unlogged.",
  abilities: [],
};

export const recursiveConstruct: UnitCard = {
  id: "CX-003",
  name: "Recursive Construct",
  faction: "Cortex",
  rarity: "Rare",
  cost: 2,
  type: "Unit",
  attack: 0,
  health: 4,
  keywords: [],
  art: "placeholder:cortex/recursive-construct",
  flavor: "It counts itself, then counts what it counted.",
  abilities: [
    {
      id: "recursive-construct-static",
      trigger: "static",
      text: "This unit's attack equals the number of units you control.",
      staticEffect: {
        kind: "selfStatFromScaling",
        attack: { mode: "scaling", base: 0, multiplier: 1, per: "controllerUnitsInPlay" },
      },
    },
  ],
};

export const diagnosticPulse: CommandCard = {
  id: "CX-004",
  name: "Diagnostic Pulse",
  faction: "Cortex",
  rarity: "Common",
  cost: 1,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:cortex/diagnostic-pulse",
  flavor: "A focused ping, sent to find the weak point.",
  abilities: [
    {
      id: "diagnostic-pulse-cast",
      trigger: "onPlay",
      text: "Deal 2 damage to target enemy unit.",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 2 } }],
    },
  ],
};

export const cascadePurge: CommandCard = {
  id: "CX-005",
  name: "Cascade Purge",
  faction: "Cortex",
  rarity: "Uncommon",
  cost: 4,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:cortex/cascade-purge",
  flavor: "Every open connection, closed at once.",
  abilities: [
    {
      id: "cascade-purge-cast",
      trigger: "onPlay",
      text: "Deal 2 damage to all enemy units.",
      targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 2 } }],
    },
  ],
};

export const backupProtocol: CommandCard = {
  id: "CX-006",
  name: "Backup Protocol",
  faction: "Cortex",
  rarity: "Uncommon",
  cost: 2,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:cortex/backup-protocol",
  flavor: "Restore from the last known good state.",
  abilities: [
    {
      id: "backup-protocol-cast",
      trigger: "onPlay",
      text: "Restore 3 health. If you are at 10 health or less, draw a card.",
      targeting: { scope: "self" },
      effects: [
        { kind: "heal", amount: { mode: "flat", value: 3 } },
        {
          kind: "conditional",
          condition: { kind: "healthAtMost", side: "controller", threshold: 10 },
          then: [{ kind: "drawCard", count: 1 }],
        },
      ],
    },
  ],
};

export const mainframeCore: DirectiveCard = {
  id: "CX-007",
  name: "Mainframe Core",
  faction: "Cortex",
  rarity: "Rare",
  cost: 3,
  type: "Directive",
  art: "placeholder:cortex/mainframe-core",
  flavor: "Every process routes through here now.",
  abilities: [
    {
      id: "mainframe-core-aura",
      trigger: "static",
      text: "Your units get +1/+1.",
      staticEffect: { kind: "buffAllies", attack: 1, health: 1, filter: { side: "controller", kind: "unit" } },
    },
  ],
};

export const failsafeUnit: UnitCard = {
  id: "CX-008",
  name: "Fail-safe Unit",
  faction: "Cortex",
  rarity: "Common",
  cost: 2,
  type: "Unit",
  attack: 2,
  health: 2,
  keywords: [],
  art: "placeholder:cortex/failsafe-unit",
  flavor: "Even in failure, it logs one last useful thing.",
  abilities: [
    {
      id: "failsafe-unit-death",
      trigger: "onDeath",
      text: "When this dies, draw a card.",
      effects: [{ kind: "drawCard", count: 1 }],
    },
  ],
};

export const cortexEngineer: UnitCard = {
  id: "CX-009",
  name: "Cortex Engineer",
  faction: "Cortex",
  rarity: "Common",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 3,
  keywords: [],
  art: "placeholder:cortex/cortex-engineer",
  flavor: "Patches itself between shifts.",
  abilities: [
    {
      id: "cortex-engineer-repair",
      trigger: "activated",
      text: "Pay 1 energy: restore 2 health to this unit. Instant speed.",
      speed: "Instant",
      cost: { energy: 1 },
      targeting: { scope: "self" },
      effects: [{ kind: "heal", amount: { mode: "flat", value: 2 } }],
    },
  ],
};

export const watchtowerRelay: UnitCard = {
  id: "CX-010",
  name: "Watchtower Relay",
  faction: "Cortex",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 2,
  health: 4,
  keywords: [],
  art: "placeholder:cortex/watchtower-relay",
  flavor: "Sees the next cycle coming before it arrives.",
  abilities: [
    {
      id: "watchtower-relay-turnstart",
      trigger: "onTurnStart",
      text: "At the start of your turn, recover 1 energy.",
      effects: [{ kind: "gainEnergy", amount: 1 }],
    },
  ],
};

export const overloadCapacitor: UnitCard = {
  id: "CX-011",
  name: "Overload Capacitor",
  faction: "Cortex",
  rarity: "Rare",
  cost: 3,
  type: "Unit",
  attack: 5,
  health: 5,
  keywords: [],
  art: "placeholder:cortex/overload-capacitor",
  flavor: "All the power you asked for, none of the safety margin.",
  abilities: [
    {
      id: "overload-capacitor-play",
      trigger: "onPlay",
      text: "This unit takes 1 damage at the end of each of your turns for the next 3 turns.",
      targeting: { scope: "self" },
      effects: [{ kind: "applyStatus", status: "Overload", duration: 3, amount: 1 }],
    },
  ],
};

export const diagnosticLoop: UnitCard = {
  id: "CX-012",
  name: "Diagnostic Loop",
  faction: "Cortex",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 3,
  keywords: [],
  art: "placeholder:cortex/diagnostic-loop",
  flavor: "Runs its own health check, every cycle, without fail.",
  abilities: [
    {
      id: "diagnostic-loop-turnend",
      trigger: "onTurnEnd",
      text: "At the end of your turn, restore 1 health to this unit.",
      targeting: { scope: "self" },
      effects: [{ kind: "heal", amount: { mode: "flat", value: 1 } }],
    },
  ],
};

export const retaliationNode: UnitCard = {
  id: "CX-013",
  name: "Retaliation Node",
  faction: "Cortex",
  rarity: "Rare",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 3,
  keywords: [],
  art: "placeholder:cortex/retaliation-node",
  flavor: "Strike it and the whole grid strikes back.",
  abilities: [
    {
      id: "retaliation-node-damaged",
      trigger: "onDamaged",
      text: "Whenever this unit is damaged, deal 1 damage to all enemy units.",
      targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 1 } }],
    },
  ],
};

export const interruptHandler: CommandCard = {
  id: "CX-014",
  name: "Interrupt Handler",
  faction: "Cortex",
  rarity: "Uncommon",
  cost: 1,
  type: "Command",
  speed: "Instant",
  art: "placeholder:cortex/interrupt-handler",
  flavor: "Catches the exception before it can propagate.",
  abilities: [
    {
      id: "interrupt-handler-cast",
      trigger: "onPlay",
      text: "Deal 2 damage to target enemy unit. Instant speed.",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 2 } }],
    },
  ],
};

// --- Board-development system backfill (stage-3 debt: the system was
// Aegis-exclusive; see progress/quality-debt.md's "Cortex and Swarm don't
// use telegraph/evolution/tools" entry) -------------------------------------
//
// An evolution line, a telegraphed threat, and a Tool card, each written to
// fit Cortex's networked-intelligence/process-compilation identity and to
// exercise a combination the Aegis set didn't: Compiled Daemon's evolve
// effect is damage rather than energy/heal (Aegis's two evolve effects), and
// Dormant Exploit's arm-time effect applies Stasis rather than damage or
// Barrier (Aegis's two telegraph effects) — a telegraph-triggered status
// application, not a new pattern reused from Aegis. Overclock Shunt grants
// Rush via a Tool, a genuinely new interaction: no existing Tool card grants
// a keyword that changes attack-legality (Guard/Barrier don't), so this is
// the first tool-granted-keyword path that actually changes what a unit can
// do on the turn it's attached, not just how attacks resolve against it.

export const initDaemon: UnitCard = {
  id: "CX-015",
  name: "Init Daemon",
  faction: "Cortex",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 1,
  health: 2,
  keywords: [],
  art: "placeholder:cortex/init-daemon",
  flavor: "Runs once, quietly, waiting for something worth compiling into.",
  abilities: [],
};

export const compiledDaemon: UnitCard = {
  id: "CX-016",
  name: "Compiled Daemon",
  faction: "Cortex",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 3,
  health: 3,
  keywords: [],
  evolvesFrom: "CX-015",
  art: "placeholder:cortex/compiled-daemon",
  flavor: "Every optimization pass it survived is still in the binary.",
  abilities: [
    {
      id: "compiled-daemon-evolve",
      trigger: "onPlay",
      text: "When this evolves in, deal 2 damage to a random enemy unit.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 2 } }],
    },
  ],
};

export const dormantExploit: UnitCard = {
  id: "CX-017",
  name: "Dormant Exploit",
  faction: "Cortex",
  rarity: "Rare",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 3,
  keywords: [],
  telegraph: 1,
  art: "placeholder:cortex/dormant-exploit",
  flavor: "Sits in the logs, unpatched, until the day it finally executes.",
  abilities: [
    {
      id: "dormant-exploit-arm",
      trigger: "onPlay",
      text: "When this arms, stun a random enemy unit for 2 turns.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [{ kind: "applyStatus", status: "Stasis", duration: 2 }],
    },
  ],
};

export const overclockShunt: ToolCard = {
  id: "CX-018",
  name: "Overclock Shunt",
  faction: "Cortex",
  rarity: "Uncommon",
  cost: 1,
  type: "Tool",
  attackBonus: 1,
  healthBonus: 0,
  grantedKeywords: ["Rush"],
  art: "placeholder:cortex/overclock-shunt",
  flavor: "Skips the warm-up cycle. Runs hot from the first tick.",
  abilities: [],
};

export const CORTEX_CARDS: { card: UnitCard | CommandCard | DirectiveCard | ToolCard; copies: number }[] = [
  { card: signalDrone, copies: 3 },
  { card: firewallSentinel, copies: 3 },
  { card: recursiveConstruct, copies: 2 },
  { card: diagnosticPulse, copies: 3 },
  { card: cascadePurge, copies: 2 },
  { card: backupProtocol, copies: 2 },
  { card: mainframeCore, copies: 2 },
  { card: failsafeUnit, copies: 3 },
  { card: cortexEngineer, copies: 3 },
  { card: watchtowerRelay, copies: 2 },
  { card: overloadCapacitor, copies: 1 },
  { card: diagnosticLoop, copies: 2 },
  { card: retaliationNode, copies: 1 },
  { card: interruptHandler, copies: 3 },
  { card: initDaemon, copies: 2 },
  { card: compiledDaemon, copies: 2 },
  { card: dormantExploit, copies: 2 },
  { card: overclockShunt, copies: 2 },
];

// --- Swarm faction ---------------------------------------------------------

export const swarmLarva: UnitCard = {
  id: "SW-001",
  name: "Swarm Larva",
  faction: "Swarm",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 1,
  health: 1,
  keywords: [],
  art: "placeholder:swarm/swarm-larva",
  flavor: "One of ten thousand. Ten thousand more where it came from.",
  abilities: [],
};

export const broodcaller: UnitCard = {
  id: "SW-002",
  name: "Broodcaller",
  faction: "Swarm",
  rarity: "Common",
  cost: 3,
  type: "Unit",
  attack: 3,
  health: 3,
  keywords: [],
  art: "placeholder:swarm/broodcaller",
  flavor: "Calls the others in once the numbers favour it.",
  abilities: [
    {
      id: "broodcaller-play",
      trigger: "onPlay",
      text: "If you control 3 or more units, draw a card.",
      targeting: { scope: "self" },
      effects: [
        {
          kind: "conditional",
          condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 3 },
          then: [{ kind: "drawCard", count: 1 }],
        },
      ],
    },
  ],
};

export const rallyCry: CommandCard = {
  id: "SW-003",
  name: "Rally Cry",
  faction: "Swarm",
  rarity: "Uncommon",
  cost: 2,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:swarm/rally-cry",
  flavor: "One voice, then all of them.",
  abilities: [
    {
      id: "rally-cry-cast",
      trigger: "onPlay",
      text: "If you control a Swarm unit, your units get +1/+0 this turn.",
      targeting: { scope: "all", filter: { side: "controller", kind: "unit" } },
      effects: [
        {
          kind: "conditional",
          condition: { kind: "controllerFactionInPlay", faction: "Swarm" },
          then: [{ kind: "buff", attack: 1, health: 0, duration: "turn" }],
        },
      ],
    },
  ],
};

export const overclockBeast: UnitCard = {
  id: "SW-004",
  name: "Overclock Beast",
  faction: "Swarm",
  rarity: "Rare",
  cost: 4,
  type: "Unit",
  attack: 4,
  health: 2,
  keywords: [],
  art: "placeholder:swarm/overclock-beast",
  flavor: "It gets harder to put down the more you throw at it.",
  abilities: [
    {
      id: "overclock-beast-static",
      trigger: "static",
      text: "This unit's health equals 2 plus the number of enemy units in play.",
      staticEffect: {
        kind: "selfStatFromScaling",
        health: { mode: "scaling", base: 2, multiplier: 1, per: "opponentUnitsInPlay" },
      },
    },
  ],
};

export const corrosiveSpitter: UnitCard = {
  id: "SW-005",
  name: "Corrosive Spitter",
  faction: "Swarm",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 2,
  health: 1,
  keywords: [],
  art: "placeholder:swarm/corrosive-spitter",
  flavor: "Aims badly. Hits something anyway.",
  abilities: [
    {
      id: "corrosive-spitter-attack",
      trigger: "onAttack",
      text: "Whenever this attacks, stun a random enemy unit for 1 turn.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [{ kind: "applyStatus", status: "Stasis", duration: 1 }],
    },
  ],
};

export const hiveMother: UnitCard = {
  id: "SW-006",
  name: "Hive Mother",
  faction: "Swarm",
  rarity: "Mythic",
  cost: 5,
  type: "Unit",
  attack: 3,
  health: 6,
  keywords: [],
  art: "placeholder:swarm/hive-mother",
  flavor: "Everything else in the swarm is downstream of her.",
  abilities: [
    {
      id: "hive-mother-aura",
      trigger: "static",
      text: "Your other units get +1/+0.",
      staticEffect: { kind: "buffAllies", attack: 1, health: 0, filter: { side: "controller", kind: "unit" } },
    },
  ],
};

export const sporeCluster: UnitCard = {
  id: "SW-007",
  name: "Spore Cluster",
  faction: "Swarm",
  rarity: "Uncommon",
  cost: 1,
  type: "Unit",
  attack: 0,
  health: 3,
  keywords: [],
  art: "placeholder:swarm/spore-cluster",
  flavor: "Its last act is its only aggressive one.",
  abilities: [
    {
      id: "spore-cluster-death",
      trigger: "onDeath",
      text: "When this dies, deal 1 damage to all enemy units.",
      targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 1 } }],
    },
  ],
};

export const barrierNode: UnitCard = {
  id: "SW-008",
  name: "Barrier Node",
  faction: "Swarm",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 2,
  keywords: ["Barrier"],
  art: "placeholder:swarm/barrier-node",
  flavor: "Absorbs the first hit so the rest of the swarm doesn't have to.",
  abilities: [],
};

export const reflexSpike: CommandCard = {
  id: "SW-009",
  name: "Reflex Spike",
  faction: "Swarm",
  rarity: "Uncommon",
  cost: 1,
  type: "Command",
  speed: "Instant",
  art: "placeholder:swarm/reflex-spike",
  flavor: "The swarm doesn't wait for its turn to brace for impact.",
  abilities: [
    {
      id: "reflex-spike-cast",
      trigger: "onPlay",
      text: "Give target friendly unit +0/+3 this turn. Instant speed.",
      targeting: { scope: "chosen", filter: { side: "controller", kind: "unit" } },
      effects: [{ kind: "buff", attack: 0, health: 3, duration: "turn" }],
    },
  ],
};

// --- Board-development system backfill (same debt as Cortex, above) --------
//
// Molted Stalker deliberately evolves from Swarm Larva (SW-001), an
// existing stage-1 card, rather than a new purpose-built base — proving the
// system works retroactively on a card that was never designed with
// evolution in mind, not just on bases built for it (Aegis Cadet). Its
// evolve effect (draw a card) is a third distinct evolve payload, next to
// Aegis's energy-gain/heal+Barrier and Cortex's damage above. Dormant Egg
// Sac reuses the damage-on-arm shape (like Perimeter Turret) scaled to
// Swarm's more aggressive stat line, rather than inventing a fourth telegraph
// payload where a straightforward one already fits the faction's identity.

export const dormantEggSac: UnitCard = {
  id: "SW-010",
  name: "Dormant Egg Sac",
  faction: "Swarm",
  rarity: "Rare",
  cost: 2,
  type: "Unit",
  attack: 0,
  health: 4,
  keywords: [],
  telegraph: 1,
  art: "placeholder:swarm/dormant-egg-sac",
  flavor: "Doesn't move. Doesn't need to, yet.",
  abilities: [
    {
      id: "dormant-egg-sac-hatch",
      trigger: "onPlay",
      text: "When this hatches, deal 3 damage to a random enemy unit.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 3 } }],
    },
  ],
};

export const moltedStalker: UnitCard = {
  id: "SW-011",
  name: "Molted Stalker",
  faction: "Swarm",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 4,
  health: 3,
  keywords: [],
  evolvesFrom: "SW-001",
  art: "placeholder:swarm/molted-stalker",
  flavor: "Sheds the shell it grew too big for and keeps every tooth from it.",
  abilities: [
    {
      id: "molted-stalker-evolve",
      trigger: "onPlay",
      text: "When this evolves in, draw a card.",
      effects: [{ kind: "drawCard", count: 1 }],
    },
  ],
};

export const chitinPlating: ToolCard = {
  id: "SW-012",
  name: "Chitin Plating",
  faction: "Swarm",
  rarity: "Common",
  cost: 1,
  type: "Tool",
  attackBonus: 0,
  healthBonus: 3,
  grantedKeywords: [],
  art: "placeholder:swarm/chitin-plating",
  flavor: "Grown, not built. Just as hard to get through.",
  abilities: [],
};

export const SWARM_CARDS: { card: UnitCard | CommandCard | DirectiveCard | ToolCard; copies: number }[] = [
  { card: swarmLarva, copies: 3 },
  { card: broodcaller, copies: 3 },
  { card: rallyCry, copies: 2 },
  { card: overclockBeast, copies: 2 },
  { card: corrosiveSpitter, copies: 3 },
  { card: hiveMother, copies: 1 },
  { card: sporeCluster, copies: 3 },
  { card: barrierNode, copies: 3 },
  { card: reflexSpike, copies: 3 },
  { card: dormantEggSac, copies: 2 },
  { card: moltedStalker, copies: 2 },
  { card: chitinPlating, copies: 3 },
];
