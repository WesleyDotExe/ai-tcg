export const badSector: UnitCard = {
  id: "NL-101",
  name: "Bad Sector",
  faction: "Null",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 1,
  health: 1,
  keywords: [],
  art: "placeholder:null/bad-sector",
  flavor: "Write to it once and the corruption spreads to whatever touched it.",
  abilities: [
    {
      id: "bad-sector-death",
      trigger: "onDeath",
      text: "When this dies, a random enemy unit gets -1/-0 permanently.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [
        { kind: "buff", attack: -1, health: 0, duration: "permanent" },
      ],
    },
  ],
};

export const memoryLeak: CommandCard = {
  id: "NL-102",
  name: "Memory Leak",
  faction: "Null",
  rarity: "Common",
  cost: 2,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:null/memory-leak",
  flavor: "Nothing is taken all at once. It just never comes back.",
  abilities: [
    {
      id: "memory-leak-cast",
      trigger: "onPlay",
      text: "Target enemy unit gets -1/-1 permanently (it can't take health below 1). Draw a card.",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
      effects: [
        { kind: "buff", attack: -1, health: -1, duration: "permanent" },
        { kind: "drawCard", count: 1 },
      ],
    },
  ],
};

export const reaperThread: UnitCard = {
  id: "NL-103",
  name: "Reaper Thread",
  faction: "Null",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 2,
  health: 3,
  keywords: [],
  art: "placeholder:null/reaper-thread",
  flavor: "It ends what the others leave running, and reads the leftovers.",
  abilities: [
    {
      id: "reaper-thread-kill",
      trigger: "onKill",
      text: "Whenever this destroys a unit, draw a card.",
      effects: [
        { kind: "drawCard", count: 1 },
      ],
    },
  ],
};

export const zombieFork: UnitCard = {
  id: "NL-104",
  name: "Zombie Fork",
  faction: "Null",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 2,
  health: 2,
  keywords: [],
  art: "placeholder:null/zombie-fork",
  flavor: "Kill the parent and both children keep running.",
  abilities: [
    {
      id: "zombie-fork-death",
      trigger: "onDeath",
      text: "When this dies, create two 1/1 Orphaned Thread tokens.",
      effects: [
        {
          kind: "summon",
          token: {
            name: "Orphaned Thread",
            faction: "Null",
            attack: 1,
            health: 1,
            keywords: [],
            art: "placeholder:null/orphaned-thread",
            flavor: "Still running. Still waiting for a join that will never come.",
          },
          count: 2,
        },
      ],
    },
  ],
};

export const heapSpray: UnitCard = {
  id: "NL-105",
  name: "Heap Spray",
  faction: "Null",
  rarity: "Rare",
  cost: 4,
  type: "Unit",
  attack: 2,
  health: 4,
  keywords: [],
  art: "placeholder:null/heap-spray",
  flavor: "It floods memory with junk until nothing else can run at full strength.",
  abilities: [
    {
      id: "heap-spray-play",
      trigger: "onPlay",
      text: "When this enters play, enemy units get -1/-0 permanently.",
      targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
      effects: [
        { kind: "buff", attack: -1, health: 0, duration: "permanent" },
      ],
    },
  ],
};

export const decayEngine: UnitCard = {
  id: "NL-106",
  name: "Decay Engine",
  faction: "Null",
  rarity: "Rare",
  cost: 4,
  type: "Unit",
  attack: 2,
  health: 4,
  keywords: [],
  art: "placeholder:null/decay-engine",
  flavor: "It doesn't attack. It waits, and everything near it gets a little less.",
  abilities: [
    {
      id: "decay-engine-tick",
      trigger: "onTurnEnd",
      text: "At the end of your turn, a random enemy unit gets -1/-0 permanently.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [
        { kind: "buff", attack: -1, health: 0, duration: "permanent" },
      ],
    },
  ],
};

export const heatDeath: UnitCard = {
  id: "NL-107",
  name: "Heat Death",
  faction: "Null",
  rarity: "Mythic",
  cost: 6,
  type: "Unit",
  attack: 3,
  health: 6,
  keywords: [],
  art: "placeholder:null/heat-death",
  flavor: "Not an explosion. Just the slow, even end of every difference.",
  abilities: [
    {
      id: "heat-death-play",
      trigger: "onPlay",
      text: "When this enters play, enemy units get -1/-0 permanently.",
      targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
      effects: [
        { kind: "buff", attack: -1, health: 0, duration: "permanent" },
      ],
    },
    {
      id: "heat-death-death",
      trigger: "onDeath",
      text: "When this dies, create two 1/1 Orphaned Thread tokens.",
      effects: [
        {
          kind: "summon",
          token: {
            name: "Orphaned Thread",
            faction: "Null",
            attack: 1,
            health: 1,
            keywords: [],
            art: "placeholder:null/orphaned-thread",
            flavor: "Still running. Still waiting for a join that will never come.",
          },
          count: 2,
        },
      ],
    },
  ],
};

export const NULL_BOOSTER_CARDS: readonly (UnitCard | CommandCard | DirectiveCard | ToolCard)[] = [
  badSector,
  memoryLeak,
  reaperThread,
  zombieFork,
  heapSpray,
  decayEngine,
  heatDeath,
];
