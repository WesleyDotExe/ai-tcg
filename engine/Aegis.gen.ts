export const shieldRelay: UnitCard = {
  id: "AG-101",
  name: "Shield Relay",
  faction: "Aegis",
  rarity: "Common",
  cost: 2,
  type: "Unit",
  attack: 1,
  health: 3,
  keywords: [],
  art: "placeholder:aegis/shield-relay",
  flavor: "It doesn't block the hit. It makes sure someone else is ready for it.",
  abilities: [
    {
      id: "shield-relay-play",
      trigger: "onPlay",
      text: "When this enters play, target friendly unit gains Barrier.",
      targeting: { scope: "chosen", filter: { side: "controller", kind: "unit" } },
      effects: [
        { kind: "applyStatus", status: "Barrier", duration: "untilConsumed" },
      ],
    },
  ],
};

export const kineticBuffer: ToolCard = {
  id: "AG-102",
  name: "Kinetic Buffer",
  faction: "Aegis",
  rarity: "Common",
  cost: 2,
  type: "Tool",
  attackBonus: 1,
  healthBonus: 2,
  grantedKeywords: [],
  art: "placeholder:aegis/kinetic-buffer",
  flavor: "It stores the force of the last blow and hands it back.",
  abilities: [],
};

export const bastionArray: UnitCard = {
  id: "AG-103",
  name: "Bastion Array",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 3,
  type: "Unit",
  attack: 1,
  health: 4,
  keywords: ["Guard"],
  art: "placeholder:aegis/bastion-array",
  flavor: "Every hit it takes is logged, and every log entry pays the operator back.",
  abilities: [
    {
      id: "bastion-array-damaged",
      trigger: "onDamaged",
      text: "Whenever this unit is damaged, restore 1 health to you.",
      targeting: { scope: "all", filter: { side: "controller", kind: "player" } },
      effects: [
        { kind: "heal", amount: { mode: "flat", value: 1 } },
      ],
    },
  ],
};

export const hardlightShell: CommandCard = {
  id: "AG-104",
  name: "Hardlight Shell",
  faction: "Aegis",
  rarity: "Uncommon",
  cost: 2,
  type: "Command",
  speed: "Instant",
  art: "placeholder:aegis/hardlight-shell",
  flavor: "Projected in the instant before impact, gone the instant after.",
  abilities: [
    {
      id: "hardlight-shell-cast",
      trigger: "onPlay",
      text: "Target friendly unit gains Barrier. Draw a card. Instant speed.",
      targeting: { scope: "chosen", filter: { side: "controller", kind: "unit" } },
      effects: [
        { kind: "applyStatus", status: "Barrier", duration: "untilConsumed" },
        { kind: "drawCard", count: 1 },
      ],
    },
  ],
};

export const mirrorBulwark: UnitCard = {
  id: "AG-105",
  name: "Mirror Bulwark",
  faction: "Aegis",
  rarity: "Rare",
  cost: 3,
  type: "Unit",
  attack: 1,
  health: 5,
  keywords: ["Guard"],
  art: "placeholder:aegis/mirror-bulwark",
  flavor: "Strike the mirror and see who it hurts.",
  abilities: [
    {
      id: "mirror-bulwark-damaged",
      trigger: "onDamaged",
      text: "Whenever this unit is damaged, deal 1 damage to a random enemy unit. Once per turn.",
      limit: "oncePerTurn",
      targeting: { scope: "random", filter: { side: "opponent", kind: "unit" }, count: 1 },
      effects: [
        { kind: "damage", amount: { mode: "flat", value: 1 } },
      ],
    },
  ],
};

export const hardeningProtocol: DirectiveCard = {
  id: "AG-106",
  name: "Hardening Protocol",
  faction: "Aegis",
  rarity: "Rare",
  cost: 3,
  type: "Directive",
  art: "placeholder:aegis/hardening-protocol",
  flavor: "Every morning, one more system gets patched. Nobody gets to skip a day.",
  abilities: [
    {
      id: "hardening-protocol-tick",
      trigger: "onTurnStart",
      text: "At the start of your turn, a random friendly unit gets +1/+1 permanently.",
      targeting: { scope: "random", filter: { side: "controller", kind: "unit" }, count: 1 },
      effects: [
        { kind: "buff", attack: 1, health: 1, duration: "permanent" },
      ],
    },
  ],
};

export const aegisOverwatch: UnitCard = {
  id: "AG-107",
  name: "Aegis Overwatch",
  faction: "Aegis",
  rarity: "Mythic",
  cost: 6,
  type: "Unit",
  attack: 3,
  health: 5,
  keywords: ["Guard"],
  art: "placeholder:aegis/aegis-overwatch",
  flavor: "It sees the whole perimeter at once, and mends whatever got through.",
  abilities: [
    {
      id: "aegis-overwatch-play",
      trigger: "onPlay",
      text: "When this enters play, your units gain Barrier.",
      targeting: { scope: "all", filter: { side: "controller", kind: "unit" } },
      effects: [
        { kind: "applyStatus", status: "Barrier", duration: "untilConsumed" },
      ],
    },
    {
      id: "aegis-overwatch-tick",
      trigger: "onTurnEnd",
      text: "At the end of your turn, restore 1 health to each of your units.",
      targeting: { scope: "all", filter: { side: "controller", kind: "unit" } },
      effects: [
        { kind: "heal", amount: { mode: "flat", value: 1 } },
      ],
    },
  ],
};

export const AEGIS_BOOSTER_CARDS: readonly (UnitCard | CommandCard | DirectiveCard | ToolCard)[] = [
  shieldRelay,
  kineticBuffer,
  bastionArray,
  hardlightShell,
  mirrorBulwark,
  hardeningProtocol,
  aegisOverwatch,
];
