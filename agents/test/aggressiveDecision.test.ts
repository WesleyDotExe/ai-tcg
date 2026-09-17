// aggressiveDecision is the reference "not pure random" policy: greedy
// biggest-affordable-card, face damage over trades, cheapest-kill trades
// when Guard forces one, plus one genuine reactive rule (save a unit from a
// pending lethal combat hit). Ported from the engine's in-process
// AggressiveAgent but re-typed against @ai-tcg/protocol only — these tests
// build PlayerView/Move fixtures by hand, exactly what a real remote agent
// receives over the wire, to prove the ported logic still does the same
// thing outside the engine process.

import { describe, expect, it } from "vitest";
import type { Move, PlayerView, StackItem, UnitCard, UnitInstance } from "@ai-tcg/protocol";
import { aggressiveDecision } from "../src/aggressiveDecision.js";

function makeCard(overrides: Partial<UnitCard> & { id: string; cost: number; attack: number; health: number }): UnitCard {
  return {
    name: overrides.id,
    faction: "Cortex",
    rarity: "Common",
    type: "Unit",
    art: "placeholder",
    flavor: "",
    abilities: [],
    keywords: [],
    ...overrides,
  };
}

function makeUnit(overrides: Partial<UnitInstance> & { instanceId: string; card: UnitCard; controller: "p1" | "p2" }): UnitInstance {
  return {
    permanentBuff: { attack: 0, health: 0 },
    turnBuff: { attack: 0, health: 0 },
    damageTaken: 0,
    statuses: [],
    enteredTurn: 1,
    hasAttackedThisTurn: false,
    tools: [],
    ...overrides,
  };
}

function basePlayerState(overrides: Partial<PlayerView["me"]> = {}): PlayerView["me"] {
  return {
    id: "p1",
    name: "P1",
    health: 20,
    maxHealth: 20,
    energy: 10,
    maxEnergy: 10,
    hand: [],
    deck: [],
    board: [],
    directives: [],
    graveyard: [],
    ...overrides,
  };
}

function baseOpponentState(overrides: Partial<PlayerView["opponent"]> = {}): PlayerView["opponent"] {
  return {
    id: "p2",
    name: "P2",
    health: 20,
    maxHealth: 20,
    energy: 10,
    maxEnergy: 10,
    board: [],
    directives: [],
    graveyard: [],
    handSize: 3,
    deckSize: 20,
    ...overrides,
  };
}

function makeView(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    self: "p1",
    turnNumber: 1,
    activePlayer: "p1",
    priority: "p1",
    stack: [],
    me: basePlayerState(),
    opponent: baseOpponentState(),
    ...overrides,
  };
}

describe("aggressiveDecision — main phase", () => {
  it("plays the highest-cost affordable card in hand", () => {
    const hand = [makeCard({ id: "cheap", cost: 1, attack: 1, health: 1 }), makeCard({ id: "expensive", cost: 4, attack: 4, health: 4 })];
    const view = makeView({ me: basePlayerState({ hand }) });
    const legalMoves: Move[] = [
      { type: "passPriority" },
      { type: "playCard", handIndex: 0 },
      { type: "playCard", handIndex: 1 },
    ];
    expect(aggressiveDecision(view, legalMoves)).toEqual({ type: "playCard", handIndex: 1 });
  });

  it("prefers a face attack over attacking a unit when both are legal", () => {
    const view = makeView();
    const legalMoves: Move[] = [
      { type: "passPriority" },
      { type: "attack", attackerInstanceId: "u1", target: { kind: "unit", instanceId: "enemy1" } },
      { type: "attack", attackerInstanceId: "u1", target: { kind: "player", playerId: "p2" } },
    ];
    expect(aggressiveDecision(view, legalMoves)).toEqual({
      type: "attack",
      attackerInstanceId: "u1",
      target: { kind: "player", playerId: "p2" },
    });
  });

  it("attacks the lowest-health enemy unit when no face attack is legal (e.g. Guard forces a trade)", () => {
    const opponentBoard = [
      makeUnit({ instanceId: "tanky", controller: "p2", card: makeCard({ id: "tank", cost: 3, attack: 2, health: 8 }) }),
      makeUnit({ instanceId: "fragile", controller: "p2", card: makeCard({ id: "glass", cost: 1, attack: 1, health: 2 }) }),
    ];
    const view = makeView({ opponent: baseOpponentState({ board: opponentBoard }) });
    const legalMoves: Move[] = [
      { type: "passPriority" },
      { type: "attack", attackerInstanceId: "u1", target: { kind: "unit", instanceId: "tanky" } },
      { type: "attack", attackerInstanceId: "u1", target: { kind: "unit", instanceId: "fragile" } },
    ];
    expect(aggressiveDecision(view, legalMoves)).toEqual({
      type: "attack",
      attackerInstanceId: "u1",
      target: { kind: "unit", instanceId: "fragile" },
    });
  });

  it("activates an ability when no card play or attack is available", () => {
    const view = makeView();
    const legalMoves: Move[] = [{ type: "passPriority" }, { type: "activateAbility", sourceInstanceId: "u1", abilityId: "heal" }];
    expect(aggressiveDecision(view, legalMoves)).toEqual({ type: "activateAbility", sourceInstanceId: "u1", abilityId: "heal" });
  });

  it("passes when nothing else is legal", () => {
    const view = makeView();
    expect(aggressiveDecision(view, [{ type: "passPriority" }])).toEqual({ type: "passPriority" });
  });
});

describe("aggressiveDecision — reactive (outside main phase)", () => {
  it("prefers an instant that targets its own threatened unit over doing nothing", () => {
    const myUnit = makeUnit({ instanceId: "defender", controller: "p1", card: makeCard({ id: "def", cost: 1, attack: 1, health: 2 }) });
    const attacker = makeUnit({ instanceId: "attacker", controller: "p2", card: makeCard({ id: "atk", cost: 1, attack: 5, health: 5 }) });
    const stack: StackItem[] = [
      {
        kind: "combatDamage",
        instanceId: "s1",
        controller: "p2",
        attackerInstanceId: "attacker",
        attackerName: "atk",
        target: { kind: "unit", instanceId: "defender" },
      },
    ];
    const view = makeView({
      self: "p1",
      activePlayer: "p2",
      priority: "p1",
      stack,
      me: basePlayerState({ board: [myUnit] }),
      opponent: baseOpponentState({ board: [attacker] }),
    });
    const savingMove: Move = { type: "playCard", handIndex: 0, target: { kind: "unit", instanceId: "defender" } };
    const legalMoves: Move[] = [{ type: "passPriority" }, savingMove];
    expect(aggressiveDecision(view, legalMoves)).toEqual(savingMove);
  });

  it("passes when outside its main phase with no reactive option and nothing lethal pending", () => {
    const view = makeView({ self: "p1", activePlayer: "p2", priority: "p1", stack: [] });
    expect(aggressiveDecision(view, [{ type: "passPriority" }])).toEqual({ type: "passPriority" });
  });
});
