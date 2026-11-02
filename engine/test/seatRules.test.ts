// The seat rule the game plays (rules-2, session 71; owner 2026-11-02: "The
// player going second starts with 24 health; the player going first starts
// with 20 and skips its first draw."), and the older rules-1 still reachable
// for replays and measuring. Session 68's other three first-seat variants
// (an extra opening card, first-turn energy, no first-turn attack) left the
// engine; nothing may still play them.

import { describe, expect, test } from "vitest";
import { buildCortexDeck, buildSwarmDeck } from "../src/data/decks.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { runMatch } from "../src/engine/match.js";
import { beginTurn } from "../src/engine/engine.js";
import { getLegalMoves } from "../src/engine/moves.js";
import { createInitialState, STARTING_HEALTH } from "../src/state/init.js";
import { Rng } from "../src/state/rng.js";
import { isShippedRules, SECOND_SEAT_EXTRA_HEALTH, type MatchRules } from "../src/state/types.js";
import { rulesOfVersion } from "../src/engine/versions.js";
import { CARD_REGISTRY } from "../src/data/registry.js";
import type { UnitCard } from "../src/cards/types.js";
import { putUnit } from "./helpers.js";

const decks = () => [buildCortexDeck("p1", "Cortex"), buildSwarmDeck("p2", "Swarm")] as const;
const play = (seed: number, rules?: MatchRules, hooks = {}) =>
  runMatch(...decks(), new LookaheadAgent("A", seed), new LookaheadAgent("B", seed + 1), seed, hooks, rules);

describe("seat rules", () => {
  test("the game's rules: the first seat on 20, the second on 24 (health and maximum); no rules field on the state", () => {
    const s = createInitialState(...decks(), new Rng(9));
    expect(SECOND_SEAT_EXTRA_HEALTH).toBe(4);
    expect([s.players.p1.health, s.players.p1.maxHealth]).toEqual([STARTING_HEALTH, STARTING_HEALTH]);
    expect([s.players.p2.health, s.players.p2.maxHealth]).toEqual([24, 24]);
    expect("rules" in s).toBe(false);
  });

  test("today's rules named explicitly are the same game as no rules at all", async () => {
    expect(isShippedRules(undefined)).toBe(true);
    expect(isShippedRules({})).toBe(true);
    expect(isShippedRules({ secondSeatExtraHealth: 4 })).toBe(true);
    expect(isShippedRules({ secondSeatExtraHealth: 0 })).toBe(false);
    const plain = await play(11);
    const named = await play(11, { secondSeatExtraHealth: 4 });
    expect("rules" in plain.state).toBe(false);
    expect("rules" in named.state).toBe(false);
    expect(named.state.log).toEqual(plain.state.log);
  });

  test("rules-1 plays 20 and 20 and keeps its rules on the state; the same seed ends 4 health apart or plays differently", async () => {
    const old = await play(11, rulesOfVersion("rules-1"));
    const now = await play(11);
    expect(old.state.players.p2.maxHealth).toBe(STARTING_HEALTH);
    expect(old.state.rules).toEqual({ secondSeatExtraHealth: 0 });
    const sameGame = JSON.stringify(old.state.log) === JSON.stringify(now.state.log);
    if (sameGame) expect(now.state.players.p2.health - old.state.players.p2.health).toBe(4);
    let differs = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const a = await play(seed, rulesOfVersion("rules-1"));
      const b = await play(seed);
      if (JSON.stringify(a.state.log) !== JSON.stringify(b.state.log)) differs++;
    }
    expect(differs).toBeGreaterThan(0); // the rule changes real matches, not just a number
  });

  test("the first seat still skips its first draw: opening hands of 4, p1 holds 4 on turn 1, p2 draws to 5 on turn 2", () => {
    const s = createInitialState(...decks(), new Rng(3));
    expect([s.players.p1.hand.length, s.players.p2.hand.length]).toEqual([4, 4]);
    const rng = new Rng(3);
    s.turnNumber = 1;
    beginTurn(s, "p1", rng, { draw: false });
    expect(s.players.p1.hand.length).toBe(4);
    s.turnNumber = 2;
    beginTurn(s, "p2", rng);
    expect(s.players.p2.hand.length).toBe(5);
  });

  test("the dropped variants are gone: the second seat's first turn has the usual energy, the first seat may attack on turn 1", () => {
    const s = createInitialState(...decks(), new Rng(3), { secondSeatFirstTurnEnergy: 1 } as MatchRules);
    const rng = new Rng(3);
    s.turnNumber = 1;
    beginTurn(s, "p1", rng, { draw: false });
    s.turnNumber = 2;
    beginTurn(s, "p2", rng);
    expect([s.players.p2.energy, s.players.p2.maxEnergy]).toEqual([1, 1]);

    const t = createInitialState({ id: "p1", name: "P1", cards: [] }, { id: "p2", name: "P2", cards: [] }, new Rng(1), { firstSeatNoFirstTurnAttack: true } as MatchRules);
    t.turnNumber = 1;
    t.activePlayer = "p1";
    t.priority = "p1";
    putUnit(t, "p1", findRushUnit());
    expect(getLegalMoves(t).filter((m) => m.type === "attack").length).toBeGreaterThan(0);
  });
});

function findRushUnit(): UnitCard {
  const card = [...CARD_REGISTRY.values()].find((c) => c.type === "Unit" && c.keywords.includes("Rush"));
  if (!card) throw new Error("no Rush unit in the registry");
  return card as UnitCard;
}
