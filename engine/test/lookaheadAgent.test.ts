// The third reference agent (2026-09-20 owner feedback, "fix the instrument
// before any further balance change"): a one-step board-state evaluator,
// distinct in kind from Random (chance) and Aggressive (raw card cost). Its
// two owner-specified behaviours — "holds Instants for a target" and
// "never plays a reactive card with nothing to react to" — are what these
// tests are built to prove, using real engine-produced Move/PlayerView
// values (via getLegalMoves/buildPlayerView), not hand-built fixtures (see
// progress/quality-debt.md's note on aggressiveDecision.test.ts's fixtures
// being hand-built as a gap worth avoiding here).

import { test, expect } from "vitest";
import type { UnitCard } from "../src/cards/types.js";
import { getLegalMoves } from "../src/engine/moves.js";
import { applyMove } from "../src/engine/engine.js";
import { Rng } from "../src/state/rng.js";
import { buildPlayerView } from "../src/agents/agent.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { aegisSentinel, aegisWarden, interceptRoutine } from "../src/data/aegisCards.js";
import { cascadePurge, backupProtocol } from "../src/data/cards.js";
import { emptyState, putUnit } from "./helpers.js";

test("prefers killing a valuable enemy unit over an equivalent face swing", () => {
  const state = emptyState();
  const bigDefender: UnitCard = {
    id: "test-big-def",
    name: "Test Big Defender",
    faction: "Cortex",
    rarity: "Common",
    cost: 1,
    type: "Unit",
    attack: 6,
    health: 3,
    keywords: [],
    art: "placeholder",
    flavor: "",
    abilities: [],
  };
  const attacker = putUnit(state, "p1", aegisSentinel); // 3/4 — its 3 attack is exactly lethal to a 3-health defender
  attacker.enteredTurn = -1; // survived a turn boundary, so it's actually allowed to attack
  attacker.permanentBuff.health = 10; // survive the defender's mutual return hit for a clean assertion (see engine.ts's resolveCombatDamage — retaliation isn't skipped just because the defender is also dying)
  putUnit(state, "p2", bigDefender);

  const legal = getLegalMoves(state);
  const view = buildPlayerView(state, "p1");
  const agent = new LookaheadAgent("test", 1);
  const move = agent.decideMove(view, legal);

  expect(move.type, "should attack, not pass").toBe("attack");
  if (move.type === "attack") {
    expect(move.target.kind, "should hit the valuable unit, not swing at the face").toBe("unit");
  }
});

test("holds an Instant when there is nothing pending to react to (never plays a reactive card with nothing to react to)", () => {
  const state = emptyState();
  // Freshly played (enteredTurn === turnNumber), so it's summoning-sick and
  // offers no competing attack move — it's here purely as Intercept
  // Routine's own required "controller unit" target.
  putUnit(state, "p1", aegisWarden);
  state.players.p1.hand.push(interceptRoutine);
  state.players.p1.energy = 1;
  state.players.p1.maxEnergy = 1;

  const legal = getLegalMoves(state);
  expect(legal.some((m) => m.type === "playCard"), "Intercept Routine should be legally castable here (it has a target)").toBe(true);

  const view = buildPlayerView(state, "p1");
  const agent = new LookaheadAgent("test", 2);
  const move = agent.decideMove(view, legal);

  expect(move.type, "with nothing pending to redirect, casting it is a pure fizzle and should lose to passing").toBe("passPriority");
});

test("plays an AOE sweep (scope: \"all\") instead of always scoring it zero", () => {
  // Regression test for a real bug this session's first balance-report run
  // caught directly: an "all"-scope onPlay ability has no Move.target at
  // all (see engine/moves.ts — only "chosen" scope puts anything there), so
  // scoring it off `move.target` alone silently valued Cascade Purge (and
  // every other AOE/self-scope card) at zero forever — it was never once
  // played across 700+ drawn games in the first real report run.
  const state = emptyState();
  const smallEnemy: UnitCard = {
    id: "test-small-enemy",
    name: "Test Small Enemy",
    faction: "Swarm",
    rarity: "Common",
    cost: 1,
    type: "Unit",
    attack: 1,
    health: 2, // exactly lethal to Cascade Purge's 2 damage
    keywords: [],
    art: "placeholder",
    flavor: "",
    abilities: [],
  };
  putUnit(state, "p2", smallEnemy);
  putUnit(state, "p2", smallEnemy);
  state.players.p1.hand.push(cascadePurge);
  state.players.p1.energy = 4;
  state.players.p1.maxEnergy = 4;

  const legal = getLegalMoves(state);
  const view = buildPlayerView(state, "p1");
  const agent = new LookaheadAgent("test", 4);
  const move = agent.decideMove(view, legal);

  expect(move.type, "wiping two real enemy units should clearly beat passing").toBe("playCard");
});

test("plays a self-targeting Command (scope: \"self\") when it's actually worth it", () => {
  const state = emptyState();
  state.players.p1.health = 5; // low enough that Backup Protocol's heal (and bonus draw) both matter
  state.players.p1.hand.push(backupProtocol);
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;

  const legal = getLegalMoves(state);
  const view = buildPlayerView(state, "p1");
  const agent = new LookaheadAgent("test", 5);
  const move = agent.decideMove(view, legal);

  expect(move.type, "healing yourself while low, with a bonus card draw, should beat passing").toBe("playCard");
});

test("plays the Instant when there IS a real pending attack worth redirecting", () => {
  const state = emptyState();
  const rng = new Rng(7);
  const attacker = putUnit(state, "p1", aegisSentinel); // 3/4
  const guardian = putUnit(state, "p2", aegisWarden); // 5/7 — the only legal redirect target for p2

  applyMove(state, { type: "attack", attackerInstanceId: attacker.instanceId, target: { kind: "player", playerId: "p2" } }, rng);
  applyMove(state, { type: "passPriority" }, rng); // p1 passes, handing p2 a real response window

  state.players.p2.hand.push(interceptRoutine);
  state.players.p2.energy = 1;
  state.players.p2.maxEnergy = 1;

  const legal = getLegalMoves(state);
  const view = buildPlayerView(state, "p2");
  const agent = new LookaheadAgent("test", 3);
  const move = agent.decideMove(view, legal);

  expect(move.type, "a real pending face-bound attack is exactly the target this card needs").toBe("playCard");
  if (move.type === "playCard") {
    expect(move.target).toEqual({ kind: "unit", instanceId: guardian.instanceId });
  }
});
