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
  attack: 4,
  health: 4,
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
  cost: 2,
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
  // Phase 2 item 5 (2026-09-20 owner-feedback entry) — see
  // cards/types.ts's UnitCard.baseArmor: a base for compiledDaemon below.
  baseArmor: 1,
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

// --- Directive removal (2026-09-20 owner-feedback entry, Phase 2 item 3:
// "Directives must be removable ... give every faction one answer") --------
//
// Every faction gets exactly one card that can destroy an enemy Directive —
// a new generic TargetFilter.kind ("directive") and the "destroy" effect now
// dispatching on the resolved target's own kind (effects/resolver.ts's
// applyDestroy), not a card-specific mechanism. Cortex's identity (networked
// intelligence, process control) reads naturally as "kill the other side's
// running process."

export const forceQuit: CommandCard = {
  id: "CX-019",
  name: "Force Quit",
  faction: "Cortex",
  rarity: "Uncommon",
  cost: 2,
  type: "Command",
  speed: "Instant",
  art: "placeholder:cortex/force-quit",
  flavor: "SIGKILL doesn't ask the process to finish what it was doing.",
  abilities: [
    {
      id: "force-quit-cast",
      trigger: "onPlay",
      text: "Destroy target enemy directive. Instant speed.",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "directive" } },
      effects: [{ kind: "destroy" }],
    },
  ],
};

// --- Phase 5 slice 4: Cortex depth/variety pass (19 -> 24 unique cards) ---
//
// The last faction to get its Phase 5 slice (2026-09-26 owner entries). Two
// jobs at once, both measured in progress/balance-report-016:
// - Variety: each card uses a shape Cortex never had — a Directive turn
//   trigger, an onAttack trigger, an Instant friendly combat trick, a
//   condition read off the OPPONENT's board, opponent-scaled attack, and
//   Cortex's first Mythic.
// - Aim at the ring edge Cortex was furthest out of band on: Cortex should
//   beat Swarm (Lookahead had it at 44.3% over 300 seeds, 46.7% over 900).
//   Swarm's identity is width: tokens, many 1-health bodies, boards of 4-6
//   units. Rate Limiter and Deadlock Detector only switch on against a wide
//   board, Quorum Arbiter's attack grows with it, and Load Balancer's ping
//   kills small bodies. Rate Limiter was the most Swarm-selective in
//   ablation (removing it cost ~9 points vs Swarm, ~0 vs Aegis/Null).
//
// Honest limit, measured: no card here was selective enough to leave the
// Cortex-vs-Null edge alone. Across every copy mix tried, Cortex's rate vs
// Null tracks its rate vs Swarm almost 1:1, because Null is currently the
// weakest faction overall. See the report's header.

export const rateLimiter: DirectiveCard = {
  id: "CX-020",
  name: "Rate Limiter",
  faction: "Cortex",
  rarity: "Rare",
  cost: 3,
  type: "Directive",
  art: "placeholder:cortex/rate-limiter",
  flavor: "Past a certain number of connections, every new one pays a toll.",
  abilities: [
    {
      id: "rate-limiter-tick",
      trigger: "onTurnStart",
      text: "At the start of your turn, if the enemy controls 3 or more units, deal 1 damage to all enemy units.",
      targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
      effects: [
        {
          kind: "conditional",
          condition: { kind: "unitsInPlayAtLeast", side: "opponent", count: 3 },
          then: [{ kind: "damage", amount: { mode: "flat", value: 1 } }],
        },
      ],
    },
  ],
};

export const loadBalancer: UnitCard = {
  id: "CX-021",
  name: "Load Balancer",
  faction: "Cortex",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 2,
  health: 3,
  keywords: [],
  art: "placeholder:cortex/load-balancer",
  flavor: "Never sends the whole request to one place.",
  abilities: [
    {
      id: "load-balancer-attack",
      trigger: "onAttack",
      text: "Whenever this attacks, deal 1 damage to a random enemy unit.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 1 } }],
    },
  ],
};

export const hotfix: CommandCard = {
  id: "CX-022",
  name: "Hotfix",
  faction: "Cortex",
  rarity: "Common",
  cost: 1,
  type: "Command",
  speed: "Instant",
  art: "placeholder:cortex/hotfix",
  flavor: "Deployed to production mid-incident. Reviewed later. Maybe.",
  abilities: [
    {
      id: "hotfix-cast",
      trigger: "onPlay",
      text: "Give target friendly unit +1/+2 this turn. Instant speed.",
      targeting: { scope: "chosen", filter: { side: "controller", kind: "unit" } },
      effects: [{ kind: "buff", attack: 1, health: 2, duration: "turn" }],
    },
  ],
};

export const deadlockDetector: UnitCard = {
  id: "CX-023",
  name: "Deadlock Detector",
  faction: "Cortex",
  rarity: "Common",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 3,
  keywords: [],
  art: "placeholder:cortex/deadlock-detector",
  flavor: "Too many threads waiting on each other. It picks one and freezes it.",
  abilities: [
    {
      id: "deadlock-detector-play",
      trigger: "onPlay",
      text: "If the enemy controls 3 or more units, stun a random enemy unit for 1 turn.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [
        {
          kind: "conditional",
          condition: { kind: "unitsInPlayAtLeast", side: "opponent", count: 3 },
          then: [{ kind: "applyStatus", status: "Stasis", duration: 1 }],
        },
      ],
    },
  ],
};

export const quorumArbiter: UnitCard = {
  id: "CX-024",
  name: "Quorum Arbiter",
  faction: "Cortex",
  rarity: "Mythic",
  cost: 5,
  type: "Unit",
  attack: 3,
  health: 6,
  keywords: [],
  art: "placeholder:cortex/quorum-arbiter",
  flavor: "It waits until everyone has spoken. Then it answers all of them.",
  abilities: [
    {
      id: "quorum-arbiter-static",
      trigger: "static",
      text: "This unit's attack equals 1 plus the number of enemy units in play.",
      staticEffect: {
        kind: "selfStatFromScaling",
        attack: { mode: "scaling", base: 1, multiplier: 1, per: "opponentUnitsInPlay" },
      },
    },
  ],
};

// Phase 3 pool lint (cards/poolLint.ts): this pool measured at 32.5% (13/40
// copies) removal/debuff density, over the lint's 25% cap — see
// progress/checkpoints.md's Phase 3 entry for the full numbers. Fixed with a
// copy-count rebalance, not a redesign (unlike Null's — see nullCards.ts —
// Cortex's removal cards are each individually reasonable, there's just too
// much of it in aggregate): Cascade Purge, Interrupt Handler, and Dormant
// Exploit each trimmed by 1 copy (-3 total), backfilled by giving Watchtower
// Relay/Init Daemon/Overclock Shunt (each sitting below their own rarity's
// copy cap) +1 copy so the pool stays at exactly 40, the same "make room"
// pattern session 13 used for Force Quit. Diagnostic Pulse and Compiled
// Daemon's own damage effects were left untouched (they're the pool's
// cheapest, most central removal, and the density cap only needed a partial
// trim, not zeroing anything out).
// Phase 5 slice 4 (2026-09-26): the 7 copies of the five new cards are
// funded by trimming one copy each of the pool's seven measured-weakest
// cards under Lookahead (report 015's per-card table: Cortex Engineer 40.7%
// played, Backup Protocol 41.8%, Diagnostic Pulse 43.7%, Interrupt Handler
// 46.1%, Signal Drone 48.9%, Overclock Shunt 49.5%, Fail-safe Unit 49.5%).
// No card left the deck. Two of the trims were removal, so removal/debuff
// density fell from 10/40 to 9/40 (22.5%) even with Deadlock Detector in.
export const CORTEX_CARDS: { card: UnitCard | CommandCard | DirectiveCard | ToolCard; copies: number }[] = [
  { card: signalDrone, copies: 2 },
  { card: firewallSentinel, copies: 3 },
  { card: recursiveConstruct, copies: 2 },
  { card: diagnosticPulse, copies: 1 },
  { card: cascadePurge, copies: 1 },
  { card: backupProtocol, copies: 1 },
  { card: mainframeCore, copies: 2 },
  { card: failsafeUnit, copies: 2 },
  { card: cortexEngineer, copies: 2 },
  { card: watchtowerRelay, copies: 3 },
  { card: overloadCapacitor, copies: 1 },
  { card: diagnosticLoop, copies: 1 },
  { card: retaliationNode, copies: 1 },
  { card: interruptHandler, copies: 1 },
  { card: initDaemon, copies: 3 },
  { card: compiledDaemon, copies: 2 },
  { card: dormantExploit, copies: 1 },
  { card: overclockShunt, copies: 2 },
  { card: forceQuit, copies: 2 },
  { card: rateLimiter, copies: 2 },
  { card: loadBalancer, copies: 2 },
  { card: hotfix, copies: 1 },
  { card: deadlockDetector, copies: 1 },
  { card: quorumArbiter, copies: 1 },
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
  // Phase 2 item 5 (2026-09-20 owner-feedback entry) — see
  // cards/types.ts's UnitCard.baseArmor: a base for moltedStalker below.
  // The Brood Reserves *token* below (Phase 2 item 4) is a separate card
  // object with its own id and no baseArmor — this field belongs to the
  // real, deck-drawn SW-001 only.
  baseArmor: 1,
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

// --- Directive removal (same 2026-09-20 entry as Cortex's Force Quit,
// above) — Swarm's answer reads as the mass simply chewing through
// standing infrastructure rather than a single precise strike. -------------

export const boreSwarm: CommandCard = {
  id: "SW-013",
  name: "Bore Swarm",
  faction: "Swarm",
  rarity: "Uncommon",
  cost: 2,
  type: "Command",
  speed: "Instant",
  art: "placeholder:swarm/bore-swarm",
  flavor: "Nothing standing still is anything but slower food.",
  abilities: [
    {
      id: "bore-swarm-cast",
      trigger: "onPlay",
      text: "Destroy target enemy directive. Instant speed.",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "directive" } },
      effects: [{ kind: "destroy" }],
    },
  ],
};

// --- Rebuild after board-wide damage (2026-09-20 owner-feedback entry,
// Phase 2 item 4: "Add a 'summon' (token) effect kind so wide decks can
// rebuild after board-wide damage" — the entry names Swarm specifically as
// the faction with no way to recover after a sweep, e.g. its own Spore
// Cluster/Cortex's AOE cards clearing its board). Brood Reserves is the
// first card in the pool to use the new engine mechanism: it doesn't touch
// anything already on the board, it just puts fresh bodies down, which is
// exactly the "wide decks rebuild wide" identity a token effect is for. The
// summoned token reuses Swarm Larva's exact name/stats/flavor rather than
// inventing a new throwaway identity — "One of ten thousand. Ten thousand
// more where it came from" was already true before this card existed; this
// just makes it mechanically literal.

export const broodReserves: CommandCard = {
  id: "SW-014",
  name: "Brood Reserves",
  faction: "Swarm",
  rarity: "Uncommon",
  cost: 3,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:swarm/brood-reserves",
  flavor: "The mass doesn't grieve. It replaces.",
  abilities: [
    {
      id: "brood-reserves-cast",
      trigger: "onPlay",
      text: "Summon two 1/1 Swarm Larvae.",
      effects: [
        {
          kind: "summon",
          count: 2,
          token: {
            name: "Swarm Larva",
            faction: "Swarm",
            attack: 1,
            health: 1,
            keywords: [],
            art: "placeholder:swarm/swarm-larva",
            flavor: "One of ten thousand. Ten thousand more where it came from.",
          },
        },
      ],
    },
  ],
};

// --- Go-wide resilience (2026-09-23 owner-feedback entry, Phase 4
// decisions, item 3: "Swarm-vs-Null (and Cortex-vs-Swarm) — buff Swarm, do
// not nerf Cortex... give Swarm's kit real go-wide resilience so width
// answers removal (its role vs Null) and holds up vs Cortex." Brood
// Reserves (above) already tried "rebuild after a wipe" and measured below
// average — quality-debt.md's read is that a reactive/situational summon
// isn't enough on its own, the dummy policies don't value "hold this for
// later" timing. These two cards instead make width matter passively,
// every turn, with no timing judgment required of the agent playing them:
// one turns a single-target kill into a replacement (directly punishing
// Null's single-target-removal identity — the ring's own stated reason
// Swarm should beat Null), the other makes an individual body harder to
// two-shot the wider the board already is (resilient against Cortex's
// removal too, not just Null's). Both reuse only existing, already-generic
// engine mechanisms (summon, conditional, selfStatFromScaling) — no new
// engine work needed, unlike the Phase 2 items that came before this.

export const colonyBroodling: UnitCard = {
  id: "SW-015",
  name: "Colony Broodling",
  faction: "Swarm",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 1,
  health: 1,
  keywords: [],
  art: "placeholder:swarm/colony-broodling",
  flavor: "Killing one changes nothing the mass hasn't already budgeted for.",
  abilities: [
    {
      id: "colony-broodling-death",
      trigger: "onDeath",
      // onDeath fires post-removal (effects/resolver.ts) — this unit is
      // already off the board by the time unitsInPlayAtLeast is sampled,
      // so "count: 2" genuinely reads as "2 or more OTHER units survive
      // you," not "2 including yourself." A single-target removal spell
      // that kills this for tempo hands Swarm the body straight back
      // whenever the board wasn't already nearly empty.
      text: "When this dies, if you control 2 or more other units, summon a 1/1 Swarm Larva.",
      condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 2 },
      effects: [
        {
          kind: "summon",
          count: 1,
          token: {
            name: "Swarm Larva",
            faction: "Swarm",
            attack: 1,
            health: 1,
            keywords: [],
            art: "placeholder:swarm/swarm-larva",
            flavor: "One of ten thousand. Ten thousand more where it came from.",
          },
        },
      ],
    },
  ],
};

export const overgrownCarapace: UnitCard = {
  id: "SW-016",
  name: "Overgrown Carapace",
  faction: "Swarm",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 2,
  health: 1,
  keywords: [],
  art: "placeholder:swarm/overgrown-carapace",
  flavor: "The mass doesn't grow one shell. It grows this one, out of all the others.",
  abilities: [
    {
      id: "overgrown-carapace-static",
      trigger: "static",
      // Mirrors Overclock Beast's shape above (selfStatFromScaling) but
      // reads off the CONTROLLER's own board, not the opponent's — a wide
      // Swarm board makes this specific body steadily harder for a
      // fixed-damage single-target spell to answer, the direct mechanical
      // counter to Null's identity (see the ring: "Swarm width beats
      // Null's single-target removal"). Counts itself, same as any other
      // "how many units do you control" read elsewhere in the engine
      // (effects/scaling.ts's controllerUnitsInPlay).
      text: "This unit's health equals 1 plus the number of units you control.",
      staticEffect: {
        kind: "selfStatFromScaling",
        health: { mode: "scaling", base: 1, multiplier: 1, per: "controllerUnitsInPlay" },
      },
    },
  ],
};

// --- Phase 5 pool expansion, Swarm slice (2026-09-25/26 owner-feedback
// entries: "Swarm next would help both its own weak matchups and the
// Aegis-vs-Swarm drift" — unlike Aegis's slice, which aimed at one named
// pairing, Swarm is this session's baseline-worst faction across THREE of
// its four matchups (loses to Cortex, loses/ties Null when the ring says it
// should win, loses hard to Aegis when the ring says it should be even), so
// this slice is a general power-level pass, not a single-pairing aim. All
// four cards are real, immediate board stats (not reactive/zero-tempo
// utility) per the established failure pattern (Brood Reserves, session 11's
// Aegis defensive batch) that the dummy agent policies undervalue "hold this
// for the right moment" cards. Funded by data-driven trims of the pool's own
// measured weakest cards (baseline balance report, this session), same
// method as session 19's Aegis slice. -------------------------------------

export const broodSkitterer: UnitCard = {
  id: "SW-017",
  name: "Brood Skitterer",
  faction: "Swarm",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  // First cut matched Aegis Line Trooper (2/1) exactly and, together with
  // the other three new cards, measured badly overtuned — see this file's
  // own note above SWARM_CARDS and progress/notes-for-owner.md: the whole
  // deck's per-card win rates jumped uniformly (even untouched cards like
  // Swarm Larva rose from 47.6% to 63.0% played), so the new cards were
  // simply too strong, not just this one. Scaled back to Init Daemon/Glitch
  // Seed's more conservative 1/2 (the actual cross-faction median for a
  // cost-1 vanilla body, not the strongest outlier) and re-measured.
  attack: 1,
  health: 2,
  keywords: [],
  art: "placeholder:swarm/brood-skitterer",
  flavor: "First out of the nest. First into everything.",
  abilities: [],
};

export const carapaceGrunt: UnitCard = {
  id: "SW-018",
  name: "Carapace Grunt",
  faction: "Swarm",
  rarity: "Common",
  cost: 2,
  type: "Unit",
  // First cut (3/1, Bulwark Chassis's total redistributed toward attack)
  // measured overtuned alongside the other three new cards — see the note
  // above SWARM_CARDS. Scaled back to Fail-safe Unit's 2/2 (a plain,
  // no-upside cost-2 vanilla stat line, the actual conservative benchmark;
  // Bulwark Chassis was itself one of Aegis's stronger-testing cards, not a
  // neutral baseline to copy from). Still fills the real gap this card
  // exists for — Swarm had no plain cost-2 stat body at all, every existing
  // one carries an ability.
  attack: 2,
  health: 2,
  keywords: [],
  art: "placeholder:swarm/carapace-grunt",
  flavor: "Doesn't dig in. Doesn't need to — there's another one behind it.",
  abilities: [],
};

export const warrenGuardian: UnitCard = {
  id: "SW-019",
  name: "Warren Guardian",
  faction: "Swarm",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  // Swarm's first Guard unit — it had zero front-line protection for the
  // rest of a wide board (Barrier Node's "Barrier" keyword is a one-hit
  // shield on itself, not a Guard that redirects attacks). First cut (3/3,
  // matching Reinforced Bastion's total stats redistributed toward attack)
  // measured overtuned alongside the other three new cards — see the note
  // above SWARM_CARDS. Scaled back below BOTH established cost-3 Guard
  // benchmarks (Firewall Sentinel 2/5, Reinforced Bastion 2/4): Swarm's
  // identity is numbers, not individual toughness, so a single Guard body
  // deliberately costs less than either faction that's actually built
  // around walling.
  attack: 2,
  health: 3,
  keywords: ["Guard"],
  art: "placeholder:swarm/warren-guardian",
  flavor: "It doesn't wall the nest off. It meets whatever's coming halfway.",
  abilities: [],
};

export const bloodswarmAlpha: UnitCard = {
  id: "SW-020",
  name: "Bloodswarm Alpha",
  faction: "Swarm",
  rarity: "Rare",
  cost: 4,
  type: "Unit",
  attack: 3,
  health: 3,
  keywords: [],
  art: "placeholder:swarm/bloodswarm-alpha",
  flavor: "It doesn't lead the mass. It just makes more of it, wherever it stands.",
  abilities: [
    {
      id: "bloodswarm-alpha-play",
      trigger: "onPlay",
      // Immediate width the moment it lands, not a reactive "hold for a
      // wipe" ask like Brood Reserves — a real body that ALSO advances the
      // "go-wide" plan the instant it's played, so a dummy policy scoring
      // "play the biggest affordable thing" values it correctly, unlike a
      // pure summon spell with no board presence of its own. First cut
      // (4/4 body, i.e. Overclock Beast's stats PLUS a free token) measured
      // overtuned alongside the other three new cards — see the note above
      // SWARM_CARDS. Scaled to 3/3: the summoned Larva is the real payoff
      // for the cost, not a bonus on top of an already-on-curve body.
      text: "When this enters play, summon a 1/1 Swarm Larva.",
      effects: [
        {
          kind: "summon",
          count: 1,
          token: {
            name: "Swarm Larva",
            faction: "Swarm",
            attack: 1,
            health: 1,
            keywords: [],
            art: "placeholder:swarm/swarm-larva",
            flavor: "One of ten thousand. Ten thousand more where it came from.",
          },
        },
      ],
    },
  ],
};

export const SWARM_CARDS: { card: UnitCard | CommandCard | DirectiveCard | ToolCard; copies: number }[] = [
  { card: swarmLarva, copies: 3 },
  { card: broodcaller, copies: 3 },
  { card: rallyCry, copies: 1 },
  { card: overclockBeast, copies: 2 },
  { card: corrosiveSpitter, copies: 3 },
  { card: hiveMother, copies: 1 },
  { card: sporeCluster, copies: 2 },
  { card: barrierNode, copies: 1 },
  { card: reflexSpike, copies: 2 },
  { card: dormantEggSac, copies: 1 },
  { card: moltedStalker, copies: 2 },
  { card: chitinPlating, copies: 1 },
  { card: boreSwarm, copies: 2 },
  { card: broodReserves, copies: 1 },
  { card: colonyBroodling, copies: 3 },
  { card: overgrownCarapace, copies: 2 },
  { card: broodSkitterer, copies: 3 },
  { card: carapaceGrunt, copies: 3 },
  { card: warrenGuardian, copies: 2 },
  { card: bloodswarmAlpha, copies: 2 },
];
