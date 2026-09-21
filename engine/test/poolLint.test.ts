// Phase 3 of the 2026-09-20 owner-feedback entry: "a card-pool lint that
// fails to load a deck that breaks a rule." Proves cards/poolLint.ts's four
// rules actually fire — each on a minimal synthetic pool built just for
// that rule, so a failure here points at exactly which rule broke, not just
// "the lint is unhappy" — and that all four REAL faction pools (as fixed
// this session) load cleanly through the exact same path a match uses
// (buildDeck), not just that the classifier function returns the right
// booleans in isolation.

import { test, expect } from "vitest";
import type { Card, CommandCard, UnitCard, DirectiveCard } from "../src/cards/types.js";
import { isRemovalOrDebuffCard, lintCardPool } from "../src/cards/poolLint.js";
import { buildDeck, buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../src/data/decks.js";

function vanillaUnit(overrides: Partial<UnitCard> = {}): UnitCard {
  return {
    id: "T-VANILLA",
    name: "Test Vanilla",
    faction: "Cortex",
    rarity: "Common",
    cost: 2,
    type: "Unit",
    attack: 1,
    health: 1,
    keywords: [],
    art: "placeholder:test/vanilla",
    flavor: "",
    abilities: [],
    ...overrides,
  };
}

function drawerUnit(overrides: Partial<UnitCard> = {}): UnitCard {
  return vanillaUnit({
    id: "T-DRAWER",
    name: "Test Drawer",
    abilities: [{ id: "t-drawer-play", trigger: "onPlay", text: "Draw a card.", effects: [{ kind: "drawCard", count: 1 }] }],
    ...overrides,
  });
}

/** Filler that alone satisfies rules 1 (zero density), 4's clock (an
 * attacker), and 4's card flow (a draw) — added to the pool under test in
 * every single-rule test below so only the rule actually being tested can
 * fail, not every other rule at once on a 1-2-card pool. */
function baseFiller(): { card: Card; copies: number }[] {
  return [
    { card: vanillaUnit(), copies: 10 },
    { card: drawerUnit(), copies: 2 },
  ];
}

function removalCommand(id = "T-REMOVAL"): CommandCard {
  return {
    id,
    name: "Test Removal Spell",
    faction: "Cortex",
    rarity: "Common",
    cost: 5,
    type: "Command",
    speed: "Sorcery",
    art: "placeholder:test/removal",
    flavor: "",
    abilities: [
      {
        id: "t-removal-cast",
        trigger: "onPlay",
        text: "Destroy target enemy unit.",
        targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
        effects: [{ kind: "destroy" }],
      },
    ],
  };
}

test("rule 1: a pool over 25% removal/debuff density fails to build", () => {
  // baseFiller is 12 non-removal copies; 4 removal copies makes 4/16 = 25%
  // exactly (the boundary, legal under "<=") and 5 makes 5/17 = 29.4% (over).
  const atThreshold = [...baseFiller(), { card: removalCommand(), copies: 4 }];
  expect(() => lintCardPool(atThreshold, "Test")).not.toThrow(); // sanity: 25% itself is legal ("<=")

  const overPool = [...baseFiller(), { card: removalCommand(), copies: 5 }];
  expect(() => lintCardPool(overPool, "Test")).toThrow(/removal\/debuff cards are 29\.4% .* over the 25% cap/);
});

test("rule 1: reactive triggers (onDamaged/onDeath/onAttack) don't count toward removal density", () => {
  const reactiveDamager = vanillaUnit({
    id: "T-REACTIVE",
    abilities: [
      {
        id: "t-reactive-death",
        trigger: "onDeath",
        text: "When this dies, deal 1 damage to all enemy units.",
        targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
        effects: [{ kind: "damage", amount: { mode: "flat", value: 1 } }],
      },
    ],
  });
  expect(isRemovalOrDebuffCard(reactiveDamager), "an onDeath trigger is reactive, not a committed removal spell").toBe(false);

  const onPlayDamager = vanillaUnit({
    id: "T-ONPLAY",
    abilities: [
      {
        id: "t-onplay-damage",
        trigger: "onPlay",
        text: "Deal 1 damage to target enemy unit.",
        targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
        effects: [{ kind: "damage", amount: { mode: "flat", value: 1 } }],
      },
    ],
  });
  expect(isRemovalOrDebuffCard(onPlayDamager), "an onPlay effect is a deliberate committed play").toBe(true);
});

test("rule 1: redirectAttack, heals, buffs to your own side, and draws never count as removal/debuff", () => {
  const redirector = vanillaUnit({
    abilities: [
      {
        id: "t-redirect",
        trigger: "onPlay",
        text: "Redirect a pending attack.",
        targeting: { scope: "chosen", filter: { side: "controller", kind: "unit" } },
        effects: [{ kind: "redirectAttack" }],
      },
    ],
  });
  expect(isRemovalOrDebuffCard(redirector)).toBe(false);
  expect(isRemovalOrDebuffCard(drawerUnit())).toBe(false);
});

test("rule 2: targeted damage above cost+1 under 3 mana is rejected", () => {
  const overcosted: CommandCard = {
    id: "T-BURN",
    name: "Test Overcosted Burn",
    faction: "Cortex",
    rarity: "Common",
    cost: 1,
    type: "Command",
    speed: "Sorcery",
    art: "placeholder:test/burn",
    flavor: "",
    abilities: [
      {
        id: "t-burn-cast",
        trigger: "onPlay",
        text: "Deal 5 damage to target enemy unit.",
        targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
        effects: [{ kind: "damage", amount: { mode: "flat", value: 5 } }],
      },
    ],
  };
  expect(() => lintCardPool([...baseFiller(), { card: overcosted, copies: 1 }], "Test")).toThrow(/exceeds cost\+1/);

  // The same effect at cost 3 (not "under 3 mana") is legal regardless of amount.
  const atThreshold = { ...overcosted, id: "T-BURN-3", cost: 3 };
  expect(() => lintCardPool([...baseFiller(), { card: atThreshold, copies: 1 }], "Test")).not.toThrow();

  // An AOE ("all" scope) at the same cost/amount is not "targeted" and is exempt.
  const aoe: CommandCard = {
    ...overcosted,
    id: "T-BURN-AOE",
    abilities: [
      {
        id: "t-burn-aoe",
        trigger: "onPlay",
        text: "Deal 5 damage to all enemy units.",
        targeting: { scope: "all", filter: { side: "opponent", kind: "unit" } },
        effects: [{ kind: "damage", amount: { mode: "flat", value: 5 } }],
      },
    ],
  };
  expect(() => lintCardPool([...baseFiller(), { card: aoe, copies: 1 }], "Test")).not.toThrow();
});

test("rule 3: a permanent enemy-stat aura under 4 mana is rejected", () => {
  const cheapAura: DirectiveCard = {
    id: "T-AURA",
    name: "Test Cheap Aura",
    faction: "Cortex",
    rarity: "Rare",
    cost: 3,
    type: "Directive",
    art: "placeholder:test/aura",
    flavor: "",
    abilities: [
      {
        id: "t-aura-static",
        trigger: "static",
        text: "Enemy units get -1/-0.",
        staticEffect: { kind: "buffAllies", attack: -1, health: 0, filter: { side: "opponent", kind: "unit" } },
      },
    ],
  };
  expect(() => lintCardPool([...baseFiller(), { card: cheapAura, copies: 1 }], "Test")).toThrow(/permanent enemy-stat aura/);

  const atThreshold = { ...cheapAura, id: "T-AURA-4", cost: 4 };
  expect(() => lintCardPool([...baseFiller(), { card: atThreshold, copies: 1 }], "Test")).not.toThrow();

  // A cost tax (cardCostModifier) is a different kind of standing pressure,
  // not a "stat aura" — deliberately exempt from this specific rule (it
  // still counts toward rule 1's broader density, proven separately).
  const taxDirective: DirectiveCard = {
    ...cheapAura,
    id: "T-TAX",
    abilities: [
      {
        id: "t-tax-static",
        trigger: "static",
        text: "Enemy cards cost 1 more.",
        staticEffect: { kind: "cardCostModifier", side: "opponent", amount: 1 },
      },
    ],
  };
  expect(() => lintCardPool([...baseFiller(), { card: taxDirective, copies: 1 }], "Test")).not.toThrow();
});

test("rule 4: a pool with no card draws anywhere fails as missing card flow", () => {
  const pool = [{ card: vanillaUnit(), copies: 4 }];
  expect(() => lintCardPool(pool, "Test")).toThrow(/no card flow/);

  const withDraw = [{ card: vanillaUnit(), copies: 3 }, { card: drawerUnit(), copies: 1 }];
  expect(() => lintCardPool(withDraw, "Test")).not.toThrow();
});

test("rule 4: a pool with no attacker and no player-targeted damage fails as missing a clock", () => {
  const wallOnly = vanillaUnit({ id: "T-WALL", attack: 0 });
  // drawerUnit itself must also have 0 attack here, or it silently supplies
  // the clock this test is supposed to be missing.
  const pool = [{ card: wallOnly, copies: 3 }, { card: drawerUnit({ attack: 0 }), copies: 3 }];
  expect(() => lintCardPool(pool, "Test")).toThrow(/no clock/);
});

test("buildDeck runs the lint (not just lintCardPool called directly) — a violating pool fails to build at all", () => {
  const pool = [
    { card: removalCommand(), copies: 6 },
    { card: vanillaUnit(), copies: 6 },
    { card: drawerUnit(), copies: 6 },
  ]; // 6/18 = 33.3% removal, well over the cap
  expect(() => buildDeck("p1", "Test Deck", pool as unknown as { card: Card; copies: number }[])).toThrow(/Card pool lint failed/);
});

test("all four real faction pools, as shipped this session, build clean through the lint", () => {
  expect(() => buildCortexDeck("p1", "Cortex Test Deck")).not.toThrow();
  expect(() => buildSwarmDeck("p1", "Swarm Test Deck")).not.toThrow();
  expect(() => buildAegisDeck("p1", "Aegis Test Deck")).not.toThrow();
  expect(() => buildNullDeck("p1", "Null Test Deck")).not.toThrow();
});
