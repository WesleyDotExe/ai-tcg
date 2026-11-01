// Session 62: NA12 and CS7 shipped (owner 2026-11-01, answers to session 61's
// check-in; progress/balance-report-037-old-edges.txt). Null Pointer and Force
// Quit each became "choose one": the printed directive answer, unchanged, or a
// new mode aimed at units. These pin the new modes' real behaviour in play,
// that the old mode still works, that both stay Instant speed and 2 energy,
// and the removal-cap check the owner asked for.

import { describe, expect, it } from "vitest";
import { getLegalMoves, type Move } from "../src/engine/moves.js";
import { applyMove } from "../src/engine/engine.js";
import { Rng } from "../src/state/rng.js";
import { currentAttack, currentHealth, currentMaxHealth } from "../src/state/queries.js";
import { buildPlayerView } from "../src/agents/agent.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { forceQuit, mainframeCore, CORTEX_CARDS } from "../src/data/cards.js";
import { nullPointer, NULL_CARDS } from "../src/data/nullCards.js";
import { REMOVAL_DEBUFF_MAX_SHARE, isRemovalOrDebuffCard, lintCardPool } from "../src/cards/poolLint.js";
import { withMode } from "../src/cards/modes.js";
import type { Card, UnitCard } from "../src/cards/types.js";
import type { GameState, PlayerId } from "../src/state/types.js";
import { emptyState, putUnit, drainStack } from "./helpers.js";

const body = (attack: number, health: number, extra: Partial<UnitCard> = {}): UnitCard => ({
  id: `TEST-${attack}-${health}`,
  name: `Test ${attack}/${health}`,
  faction: "Aegis",
  rarity: "Common",
  cost: 3,
  type: "Unit",
  attack,
  health,
  keywords: [],
  art: "placeholder:test/body",
  flavor: "",
  abilities: [],
  ...extra,
});

/** `who` holds `card` with exactly its cost in energy. */
function holding(state: GameState, who: PlayerId, card: Card): void {
  state.players[who].hand.push(card);
  state.players[who].energy = card.cost;
  state.players[who].maxEnergy = card.cost;
}

function playsOf(state: GameState): Extract<Move, { type: "playCard" }>[] {
  return getLegalMoves(state).filter((m): m is Extract<Move, { type: "playCard" }> => m.type === "playCard");
}

function cast(state: GameState, move: Move | undefined, rng = new Rng(3)): void {
  expect(move, "the play should be legal").toBeDefined();
  applyMove(state, move!, rng);
  drainStack(state, rng);
}

describe("Null Pointer (NA12): Dereference or Null Out", () => {
  it("is still a 2-energy Instant Uncommon, its printed text now the first of two modes", () => {
    expect(nullPointer.cost).toBe(2);
    expect(nullPointer.speed).toBe("Instant");
    expect(nullPointer.rarity).toBe("Uncommon");
    expect(nullPointer.abilities).toEqual([]);
    expect(nullPointer.modes!.map((m) => [m.id, m.name, m.text])).toEqual([
      ["dereference", "Dereference", "Destroy target enemy directive. Instant speed."],
      ["null-out", "Null Out", "Target enemy unit gets -3/-3 permanently."],
    ]);
  });

  it("offers one move per legal target in each mode: the enemy directive for Dereference, each enemy unit for Null Out", () => {
    const state = emptyState();
    const a = putUnit(state, "p2", body(2, 4));
    const b = putUnit(state, "p2", body(1, 1));
    putUnit(state, "p1", body(5, 5)); // never a Null Out target
    state.players.p2.directives.push({ instanceId: "test-d1", card: mainframeCore, controller: "p2" });
    holding(state, "p1", nullPointer);
    const moves = playsOf(state).map((m) => [m.mode, m.target && "instanceId" in m.target ? m.target.instanceId : undefined]);
    expect(moves).toEqual([["dereference", "test-d1"], ["null-out", a.instanceId], ["null-out", b.instanceId]]);
  });

  // The engine floors max health at 1 (state/queries.ts currentMaxHealth;
  // pinned for Deprecated Routine in nullFaction.test.ts): a stat loss
  // alone never kills, it kills together with damage. So Null Out leaves an
  // undamaged 3/3 at 0/1, and kills any unit of 4 or less health that has
  // taken damage. Session 61 measured NA12 under this same rule, so the
  // measured numbers are the shipped card's (flagged to the owner: the text
  // "-3/-3" reads as if it kills a 3-health unit).
  it("Null Out leaves an undamaged 3/3 at 0/1 (max health floors at 1), alive", () => {
    const state = emptyState();
    const target = putUnit(state, "p2", body(3, 3));
    holding(state, "p1", nullPointer);
    cast(state, playsOf(state).find((m) => m.mode === "null-out"));
    const unit = state.players.p2.board.find((u) => u.instanceId === target.instanceId)!;
    expect([currentAttack(state, unit), currentHealth(state, unit)]).toEqual([0, 1]);
    // The Command goes to the graveyard as the printed card (no mode left on it).
    const spent = state.players.p1.graveyard.find((c) => c.id === nullPointer.id)!;
    expect(spent.chosenMode).toBeUndefined();
    expect(spent.modes).toHaveLength(2);
  });

  it("Null Out kills a damaged unit of up to 4 health: a 2/4 with 1 damage dies", () => {
    const state = emptyState();
    const target = putUnit(state, "p2", body(2, 4), 1);
    holding(state, "p1", nullPointer);
    cast(state, playsOf(state).find((m) => m.mode === "null-out"));
    expect(state.players.p2.board.some((u) => u.instanceId === target.instanceId)).toBe(false);
    expect(state.players.p2.graveyard.map((c) => c.id)).toContain(target.card.id);
  });

  it("Null Out leaves a 3/6 at 0/3, and the shrink outlasts the turn", () => {
    const state = emptyState();
    const target = putUnit(state, "p2", body(3, 6));
    holding(state, "p1", nullPointer);
    cast(state, playsOf(state).find((m) => m.mode === "null-out"));
    const unit = state.players.p2.board.find((u) => u.instanceId === target.instanceId)!;
    expect([currentAttack(state, unit), currentHealth(state, unit), currentMaxHealth(state, unit)]).toEqual([0, 3, 3]);
    expect(unit.permanentBuff).toEqual({ attack: -3, health: -3 });
    expect(unit.turnBuff).toEqual({ attack: 0, health: 0 });
  });

  it("Null Out goes through base armor (a stat change, not damage): an armored 2/3 with 1 damage dies", () => {
    const state = emptyState();
    const target = putUnit(state, "p2", body(2, 3, { baseArmor: 1 }), 1);
    holding(state, "p1", nullPointer);
    cast(state, playsOf(state).find((m) => m.mode === "null-out"));
    expect(state.players.p2.board.some((u) => u.instanceId === target.instanceId)).toBe(false);
  });

  it("Dereference still destroys the enemy directive", () => {
    const state = emptyState();
    state.players.p2.directives.push({ instanceId: "test-d1", card: mainframeCore, controller: "p2" });
    putUnit(state, "p2", body(3, 3));
    holding(state, "p1", nullPointer);
    cast(state, playsOf(state).find((m) => m.mode === "dereference"));
    expect(state.players.p2.directives).toHaveLength(0);
    expect(state.players.p2.board).toHaveLength(1);
    expect(state.log.some((e) => e.type === "directiveDestroyed")).toBe(true);
  });

  it("is castable at instant speed in the opponent's turn, in either mode", () => {
    const state = emptyState();
    state.activePlayer = "p2";
    state.priority = "p1";
    putUnit(state, "p2", body(3, 3));
    state.players.p2.directives.push({ instanceId: "test-d1", card: mainframeCore, controller: "p2" });
    holding(state, "p1", nullPointer);
    expect(playsOf(state).map((m) => m.mode)).toEqual(["dereference", "null-out"]);
  });

  it("with no enemy directive, the lookahead agent uses Null Out on a 3/3 (taking its attack to 0) rather than pass", () => {
    const state = emptyState();
    putUnit(state, "p2", body(3, 3));
    holding(state, "p1", nullPointer);
    const legal = getLegalMoves(state);
    const move = new LookaheadAgent("test", 4).decideMove(buildPlayerView(state, "p1"), legal);
    expect(move).toMatchObject({ type: "playCard", mode: "null-out" });
  });
});

describe("Force Quit (CS7): Terminate or Kill All", () => {
  it("is still a 2-energy Instant, its printed text now the first of two modes", () => {
    expect(forceQuit.cost).toBe(2);
    expect(forceQuit.speed).toBe("Instant");
    expect(forceQuit.abilities).toEqual([]);
    expect(forceQuit.modes!.map((m) => [m.id, m.name, m.text])).toEqual([
      ["terminate", "Terminate", "Destroy target enemy directive. Instant speed."],
      ["kill-all", "Kill All", "Deal 1 damage to all enemy units."],
    ]);
  });

  it("Kill All deals 1 to every enemy unit, kills the 1-health ones, and leaves its own side alone", () => {
    const state = emptyState();
    const tokens = [putUnit(state, "p2", body(1, 1)), putUnit(state, "p2", body(1, 1)), putUnit(state, "p2", body(2, 1))];
    const big = putUnit(state, "p2", body(2, 3));
    const mine = putUnit(state, "p1", body(1, 1));
    holding(state, "p1", forceQuit);
    cast(state, playsOf(state).find((m) => m.mode === "kill-all"));
    expect(state.players.p2.board.map((u) => u.instanceId)).toEqual([big.instanceId]);
    expect(currentHealth(state, state.players.p2.board[0]!)).toBe(2);
    expect(state.players.p2.graveyard).toHaveLength(tokens.length);
    expect(state.players.p1.board.map((u) => u.instanceId)).toEqual([mine.instanceId]);
  });

  it("Kill All is stopped by base armor 1 (it is damage)", () => {
    const state = emptyState();
    const armored = putUnit(state, "p2", body(1, 1, { baseArmor: 1 }));
    holding(state, "p1", forceQuit);
    cast(state, playsOf(state).find((m) => m.mode === "kill-all"));
    const unit = state.players.p2.board.find((u) => u.instanceId === armored.instanceId);
    expect(unit, "armor 1 soaks the 1 damage").toBeDefined();
    expect(unit!.damageTaken).toBe(0);
  });

  it("Terminate still destroys the enemy directive and touches no unit", () => {
    const state = emptyState();
    state.players.p2.directives.push({ instanceId: "test-d1", card: mainframeCore, controller: "p2" });
    putUnit(state, "p2", body(1, 1));
    holding(state, "p1", forceQuit);
    cast(state, playsOf(state).find((m) => m.mode === "terminate"));
    expect(state.players.p2.directives).toHaveLength(0);
    expect(state.players.p2.board).toHaveLength(1);
  });

  it("is castable at instant speed in the opponent's turn: Kill All in answer to a wide board", () => {
    const state = emptyState();
    state.activePlayer = "p2";
    state.priority = "p1";
    putUnit(state, "p2", body(1, 1));
    putUnit(state, "p2", body(1, 1));
    holding(state, "p1", forceQuit);
    expect(playsOf(state).map((m) => m.mode)).toEqual(["kill-all"]);
    cast(state, playsOf(state)[0]);
    expect(state.players.p2.board).toHaveLength(0);
  });
});

describe("the removal cap with the new modes (the owner's check, 2026-11-01)", () => {
  const removalCopies = (list: { card: Card; copies: number }[]) =>
    list.filter((p) => isRemovalOrDebuffCard(p.card)).reduce((s, p) => s + p.copies, 0);
  const total = (list: { card: Card; copies: number }[]) => list.reduce((s, p) => s + p.copies, 0);

  it("each mode of both cards counts as removal on its own, so each card counts once, as it did before", () => {
    for (const card of [nullPointer, forceQuit]) {
      for (const mode of card.modes!) {
        expect(isRemovalOrDebuffCard({ ...withMode(card, mode.id), modes: undefined }), `${card.name}: ${mode.name}`).toBe(true);
      }
      expect(isRemovalOrDebuffCard(card)).toBe(true);
    }
  });

  it("Null's list (and so its starter) stays exactly at the cap, 10 of 40, and Cortex's at 9 of 40; both lint clean", () => {
    expect([removalCopies(NULL_CARDS), total(NULL_CARDS)]).toEqual([10, 40]);
    expect(removalCopies(NULL_CARDS) / total(NULL_CARDS)).toBeLessThanOrEqual(REMOVAL_DEBUFF_MAX_SHARE);
    expect([removalCopies(CORTEX_CARDS), total(CORTEX_CARDS)]).toEqual([9, 40]);
    expect(() => lintCardPool(NULL_CARDS, "Null")).not.toThrow();
    expect(() => lintCardPool(CORTEX_CARDS, "Cortex")).not.toThrow();
  });
});
