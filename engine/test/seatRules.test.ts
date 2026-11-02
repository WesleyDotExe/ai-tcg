// The first-seat variants under measurement (session 68, owner 2026-11-02:
// "measure all four first-seat fixes, test only"). Each must do exactly what
// it says and nothing else, and a match with no variant (the game as
// shipped) must keep no `rules` field and play byte-identically.

import { describe, expect, test } from "vitest";
import { buildCortexDeck, buildSwarmDeck } from "../src/data/decks.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { runMatch } from "../src/engine/match.js";
import { beginTurn } from "../src/engine/engine.js";
import { getLegalMoves } from "../src/engine/moves.js";
import { createInitialState, STARTING_HEALTH } from "../src/state/init.js";
import { Rng } from "../src/state/rng.js";
import { isShippedRules, type MatchRules } from "../src/state/types.js";
import { CARD_REGISTRY } from "../src/data/registry.js";
import type { UnitCard } from "../src/cards/types.js";
import { putUnit } from "./helpers.js";

const decks = () => [buildCortexDeck("p1", "Cortex"), buildSwarmDeck("p2", "Swarm")] as const;
const play = (seed: number, rules?: MatchRules, hooks = {}) =>
  runMatch(...decks(), new LookaheadAgent("A", seed), new LookaheadAgent("B", seed + 1), seed, hooks, rules);

describe("seat rules", () => {
  test("no variant: no rules field, the same game as before the option existed", async () => {
    expect(isShippedRules(undefined)).toBe(true);
    expect(isShippedRules({ secondSeatExtraHealth: 0, firstSeatNoFirstTurnAttack: false })).toBe(true);
    const plain = await play(11);
    const zeroed = await play(11, { secondSeatExtraHealth: 0 });
    expect("rules" in plain.state).toBe(false);
    expect("rules" in zeroed.state).toBe(false);
    expect(zeroed.state.log).toEqual(plain.state.log);
  });

  test("(a) the second seat opens with one more card, the next one off its own deck; the shuffle is untouched", () => {
    const base = createInitialState(...decks(), new Rng(5));
    const a = createInitialState(...decks(), new Rng(5), { secondSeatExtraOpeningCards: 1 });
    expect(a.players.p1.hand.map((c) => c.id)).toEqual(base.players.p1.hand.map((c) => c.id));
    expect(a.players.p1.deck.map((c) => c.id)).toEqual(base.players.p1.deck.map((c) => c.id));
    expect(a.players.p2.hand.map((c) => c.id)).toEqual([...base.players.p2.hand, base.players.p2.deck[0]!].map((c) => c.id));
    expect(a.players.p2.deck.length).toBe(base.players.p2.deck.length - 1);
  });

  test("(b) the second seat's first turn (turn 2) has one more energy, its maximum unchanged; its next turn doesn't", () => {
    const s = createInitialState(...decks(), new Rng(3), { secondSeatFirstTurnEnergy: 1 });
    const rng = new Rng(3);
    s.turnNumber = 1;
    beginTurn(s, "p1", rng, { draw: false });
    expect(s.players.p1.energy).toBe(1);
    s.turnNumber = 2;
    beginTurn(s, "p2", rng);
    expect([s.players.p2.energy, s.players.p2.maxEnergy]).toEqual([2, 1]);
    s.turnNumber = 3;
    beginTurn(s, "p1", rng);
    expect(s.players.p1.energy).toBe(2);
    s.turnNumber = 4;
    beginTurn(s, "p2", rng);
    expect([s.players.p2.energy, s.players.p2.maxEnergy]).toEqual([2, 2]);
  });

  test("(c) the second seat starts with more health and a higher maximum; the first seat doesn't", () => {
    const s = createInitialState(...decks(), new Rng(9), { secondSeatExtraHealth: 2 });
    expect([s.players.p2.health, s.players.p2.maxHealth]).toEqual([STARTING_HEALTH + 2, STARTING_HEALTH + 2]);
    expect([s.players.p1.health, s.players.p1.maxHealth]).toEqual([STARTING_HEALTH, STARTING_HEALTH]);
  });

  test("(d) no attack on turn 1 for the first seat, Rush or not; attacks come back on turn 3", () => {
    const rusher = findRushUnit();
    for (const rules of [undefined, { firstSeatNoFirstTurnAttack: true }] as const) {
      const s = createInitialState({ id: "p1", name: "P1", cards: [] }, { id: "p2", name: "P2", cards: [] }, new Rng(1), rules);
      s.turnNumber = 1;
      s.activePlayer = "p1";
      s.priority = "p1";
      putUnit(s, "p1", rusher);
      const attacks = () => getLegalMoves(s).filter((m) => m.type === "attack").length;
      if (rules) expect(attacks()).toBe(0);
      else expect(attacks()).toBeGreaterThan(0);
      s.turnNumber = 3;
      expect(attacks()).toBeGreaterThan(0);
    }
  });
});

function findRushUnit(): UnitCard {
  const card = [...CARD_REGISTRY.values()].find((c) => c.type === "Unit" && c.keywords.includes("Rush"));
  if (!card) throw new Error("no Rush unit in the registry");
  return card as UnitCard;
}
