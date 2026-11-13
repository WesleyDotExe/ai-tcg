export const eggCourier: UnitCard = {
  id: "SW-101",
  name: "Egg Courier",
  faction: "Swarm",
  rarity: "Common",
  cost: 2,
  type: "Unit",
  attack: 2,
  health: 2,
  keywords: [],
  art: "placeholder:swarm/egg-courier",
  flavor: "It carries the next generation on its back, and drops it when it falls.",
  abilities: [
    {
      id: "egg-courier-death",
      trigger: "onDeath",
      text: "When this dies, summon a 1/1 Swarm Larva.",
      effects: [
        {
          kind: "summon",
          token: {
            name: "Swarm Larva",
            faction: "Swarm",
            attack: 1,
            health: 1,
            keywords: [],
            art: "placeholder:swarm/swarm-larva",
            flavor: "One of ten thousand. Ten thousand more where it came from.",
          },
          count: 1,
        },
      ],
    },
  ],
};

export const spawningPulse: CommandCard = {
  id: "SW-102",
  name: "Spawning Pulse",
  faction: "Swarm",
  rarity: "Common",
  cost: 1,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:swarm/spawning-pulse",
  flavor: "A single signal, and the walls start to crawl.",
  abilities: [
    {
      id: "spawning-pulse-cast",
      trigger: "onPlay",
      text: "Summon a 1/1 Swarm Larva. Then, if you control 2 or more units, draw a card.",
      effects: [
        {
          kind: "summon",
          token: {
            name: "Swarm Larva",
            faction: "Swarm",
            attack: 1,
            health: 1,
            keywords: [],
            art: "placeholder:swarm/swarm-larva",
            flavor: "One of ten thousand. Ten thousand more where it came from.",
          },
          count: 1,
        },
        {
          kind: "conditional",
          condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 2 },
          then: [
            { kind: "drawCard", count: 1 },
          ],
        },
      ],
    },
  ],
};

export const hiveRelay: UnitCard = {
  id: "SW-103",
  name: "Hive Relay",
  faction: "Swarm",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 3,
  health: 3,
  keywords: [],
  art: "placeholder:swarm/hive-relay",
  flavor: "It hums a frequency only the brood can hear, and the brood answers.",
  abilities: [
    {
      id: "hive-relay-tick",
      trigger: "onTurnStart",
      text: "At the start of your turn, if you control 2 or more units, summon a 1/1 Swarm Larva.",
      condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 2 },
      effects: [
        {
          kind: "summon",
          token: {
            name: "Swarm Larva",
            faction: "Swarm",
            attack: 1,
            health: 1,
            keywords: [],
            art: "placeholder:swarm/swarm-larva",
            flavor: "One of ten thousand. Ten thousand more where it came from.",
          },
          count: 1,
        },
      ],
    },
  ],
};

export const acidDrone: UnitCard = {
  id: "SW-104",
  name: "Acid Drone",
  faction: "Swarm",
  rarity: "Uncommon",
  cost: 2,
  type: "Unit",
  attack: 2,
  health: 2,
  keywords: [],
  art: "placeholder:swarm/acid-drone",
  flavor: "Crush it and it bursts. Everything nearby wishes you hadn't.",
  abilities: [
    {
      id: "acid-drone-death",
      trigger: "onDeath",
      text: "When this dies, deal 2 damage to a random enemy unit.",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [
        { kind: "damage", amount: { mode: "flat", value: 2 } },
      ],
    },
  ],
};

export const swarmSurge: CommandCard = {
  id: "SW-105",
  name: "Swarm Surge",
  faction: "Swarm",
  rarity: "Rare",
  cost: 2,
  type: "Command",
  speed: "Instant",
  art: "placeholder:swarm/swarm-surge",
  flavor: "The brood never decides between more and stronger. It just picks the one you didn't plan for.",
  abilities: [],
  modes: [
    {
      id: "overrun",
      name: "Overrun",
      text: "Your units get +2/+1 this turn. Instant speed.",
      abilities: [
        {
          id: "swarm-surge-overrun",
          trigger: "onPlay",
          text: "Your units get +2/+1 this turn. Instant speed.",
          targeting: { scope: "all", filter: { side: "controller", kind: "unit" } },
          effects: [
            { kind: "buff", attack: 2, health: 1, duration: "turn" },
          ],
        },
      ],
    },
    {
      id: "brood",
      name: "Brood",
      text: "Summon two 1/1 Swarm Larvae. Instant speed.",
      abilities: [
        {
          id: "swarm-surge-brood",
          trigger: "onPlay",
          text: "Summon two 1/1 Swarm Larvae. Instant speed.",
          effects: [
            {
              kind: "summon",
              token: {
                name: "Swarm Larva",
                faction: "Swarm",
                attack: 1,
                health: 1,
                keywords: [],
                art: "placeholder:swarm/swarm-larva",
                flavor: "One of ten thousand. Ten thousand more where it came from.",
              },
              count: 2,
            },
          ],
        },
      ],
    },
  ],
};

export const broodTyrant: UnitCard = {
  id: "SW-106",
  name: "Brood Tyrant",
  faction: "Swarm",
  rarity: "Rare",
  cost: 3,
  type: "Unit",
  attack: 0,
  health: 4,
  keywords: [],
  art: "placeholder:swarm/brood-tyrant",
  flavor: "It is only as large as the colony behind it, and the colony is never small.",
  abilities: [
    {
      id: "brood-tyrant-scale",
      trigger: "static",
      text: "This unit's attack equals 1 plus the number of units you control.",
      staticEffect: {
        kind: "selfStatFromScaling",
        attack: { mode: "scaling", base: 1, multiplier: 1, per: "controllerUnitsInPlay" },
      },
    },
  ],
};

export const colonyOvermind: UnitCard = {
  id: "SW-107",
  name: "Colony Overmind",
  faction: "Swarm",
  rarity: "Mythic",
  cost: 6,
  type: "Unit",
  attack: 4,
  health: 5,
  keywords: [],
  art: "placeholder:swarm/colony-overmind",
  flavor: "Ten thousand minds, one appetite.",
  abilities: [
    {
      id: "colony-overmind-play",
      trigger: "onPlay",
      text: "When this enters play, summon two 1/1 Swarm Larvae.",
      effects: [
        {
          kind: "summon",
          token: {
            name: "Swarm Larva",
            faction: "Swarm",
            attack: 1,
            health: 1,
            keywords: [],
            art: "placeholder:swarm/swarm-larva",
            flavor: "One of ten thousand. Ten thousand more where it came from.",
          },
          count: 2,
        },
      ],
    },
    {
      id: "colony-overmind-tick",
      trigger: "onTurnEnd",
      text: "At the end of your turn, if you control 4 or more units, your units get +1/+0 permanently.",
      condition: { kind: "unitsInPlayAtLeast", side: "controller", count: 4 },
      targeting: { scope: "all", filter: { side: "controller", kind: "unit" } },
      effects: [
        { kind: "buff", attack: 1, health: 0, duration: "permanent" },
      ],
    },
  ],
};

export const SWARM_BOOSTER_CARDS: readonly (UnitCard | CommandCard | DirectiveCard | ToolCard)[] = [
  eggCourier,
  spawningPulse,
  hiveRelay,
  acidDrone,
  swarmSurge,
  broodTyrant,
  colonyOvermind,
];
