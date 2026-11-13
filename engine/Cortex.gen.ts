export const portScanner: UnitCard = {
  id: "CX-101",
  name: "Port Scanner",
  faction: "Cortex",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 1,
  health: 1,
  keywords: [],
  art: "placeholder:cortex/port-scanner",
  flavor: "It knocks on every door, just to hear which ones answer.",
  abilities: [
    {
      id: "port-scanner-play",
      trigger: "onPlay",
      text: "When this enters play, if you control 3 or more units, recover 1 energy.",
      condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 3 },
      effects: [
        { kind: "gainEnergy", amount: 1 },
      ],
    },
  ],
};

export const mutexLock: UnitCard = {
  id: "CX-102",
  name: "Mutex Lock",
  faction: "Cortex",
  rarity: "Common",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 3,
  keywords: ["Guard"],
  art: "placeholder:cortex/mutex-lock",
  flavor: "One at a time. Everyone else waits at the gate.",
  abilities: [],
};

export const clusterNode: UnitCard = {
  id: "CX-103",
  name: "Cluster Node",
  faction: "Cortex",
  rarity: "Uncommon",
  cost: 4,
  type: "Unit",
  attack: 1,
  health: 3,
  keywords: [],
  art: "placeholder:cortex/cluster-node",
  flavor: "Alone it is a server. Racked with the others it is a grid.",
  abilities: [
    {
      id: "cluster-node-aura",
      trigger: "static",
      text: "Your other units get +1/+0.",
      staticEffect: {
        kind: "buffAllies",
        attack: 1,
        health: 0,
        filter: { side: "controller", kind: "unit" },
        excludeSelf: true,
      },
    },
  ],
};

export const hotSwap: CommandCard = {
  id: "CX-104",
  name: "Hot Swap",
  faction: "Cortex",
  rarity: "Uncommon",
  cost: 2,
  type: "Command",
  speed: "Instant",
  art: "placeholder:cortex/hot-swap",
  flavor: "Pull the failing part, slot the spare, never drop the connection.",
  abilities: [
    {
      id: "hot-swap-cast",
      trigger: "onPlay",
      text: "Give target friendly unit +2/+2 this turn. If you control 3 or more units, draw a card. Instant speed.",
      targeting: { scope: "chosen", filter: { side: "controller", kind: "unit" } },
      effects: [
        { kind: "buff", attack: 2, health: 2, duration: "turn" },
        {
          kind: "conditional",
          condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 3 },
          then: [
            { kind: "drawCard", count: 1 },
          ],
        },
      ],
    },
  ],
};

export const parityChecker: UnitCard = {
  id: "CX-105",
  name: "Parity Checker",
  faction: "Cortex",
  rarity: "Rare",
  cost: 3,
  type: "Unit",
  attack: 2,
  health: 4,
  keywords: [],
  art: "placeholder:cortex/parity-checker",
  flavor: "Every bit that disagrees with the checksum gets corrected, one at a time.",
  abilities: [
    {
      id: "parity-checker-correct",
      trigger: "activated",
      text: "Pay 2 energy: deal 1 damage to target enemy unit. Instant speed. Once per turn.",
      cost: { energy: 2 },
      speed: "Instant",
      limit: "oncePerTurn",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
      effects: [
        { kind: "damage", amount: { mode: "flat", value: 1 } },
      ],
    },
  ],
};

export const jobScheduler: DirectiveCard = {
  id: "CX-106",
  name: "Job Scheduler",
  faction: "Cortex",
  rarity: "Rare",
  cost: 3,
  type: "Directive",
  art: "placeholder:cortex/job-scheduler",
  flavor: "Every cycle it looks at the queue and hands the next task to whoever is free.",
  abilities: [
    {
      id: "job-scheduler-tick",
      trigger: "onTurnStart",
      text: "At the start of your turn, if you control 3 or more units, draw a card.",
      condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 3 },
      effects: [
        { kind: "drawCard", count: 1 },
      ],
    },
  ],
};

export const gridConsensus: UnitCard = {
  id: "CX-107",
  name: "Grid Consensus",
  faction: "Cortex",
  rarity: "Mythic",
  cost: 6,
  type: "Unit",
  attack: 1,
  health: 6,
  keywords: [],
  art: "placeholder:cortex/grid-consensus",
  flavor: "No single node decides. All of them do, and they never disagree.",
  abilities: [
    {
      id: "grid-consensus-scale",
      trigger: "static",
      text: "This unit's attack equals 1 plus the number of units you control.",
      staticEffect: {
        kind: "selfStatFromScaling",
        attack: { mode: "scaling", base: 1, multiplier: 1, per: "controllerUnitsInPlay" },
      },
    },
    {
      id: "grid-consensus-play",
      trigger: "onPlay",
      text: "When this enters play, deal 1 damage to all enemy units.",
      targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
      effects: [
        { kind: "damage", amount: { mode: "flat", value: 1 } },
      ],
    },
  ],
};

export const CORTEX_BOOSTER_CARDS: readonly (UnitCard | CommandCard | DirectiveCard | ToolCard)[] = [
  portScanner,
  mutexLock,
  clusterNode,
  hotSwap,
  parityChecker,
  jobScheduler,
  gridConsensus,
];
