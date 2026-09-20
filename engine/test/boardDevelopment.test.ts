// The unified board-development system (finite face-up board slots,
// telegraphed threats, evolution/upgrade cards, tool/attachment cards) —
// see DESIGN.md's owner design-directive batch (2026-09-12) and
// data/aegisCards.ts. Ported from the old dev/effectSystemDemo.ts scenarios
// 13-16 into real vitest tests (see effectSystem.test.ts's header comment
// for why), plus one new test proving the owner's 2026-09-13 stage-3
// checkpoint overrule (item 4: no more same-turn play-and-evolve).

import { test, expect } from "vitest";
import { Rng } from "../src/state/rng.js";
import { currentAttack, currentHealth, hasKeyword } from "../src/state/queries.js";
import { applyMove, beginTurn } from "../src/engine/engine.js";
import { getLegalMoves } from "../src/engine/moves.js";
import { swarmLarva, signalDrone } from "../src/data/cards.js";
import { aegisCadet, aegisSentinel, perimeterTurret, platingModule, guardDirectiveChip, barrierShim } from "../src/data/aegisCards.js";
import { BOARD_SLOTS } from "../src/state/init.js";
import { emptyState, putUnit } from "./helpers.js";

test("a telegraphed unit is dormant on arrival and only fires its ability once armed", () => {
  const state = emptyState();
  const rng = new Rng(11);
  // signalDrone, not swarmLarva: a plain 1-health damage target with no
  // baseArmor (see cards/types.ts's UnitCard.baseArmor, 2026-09-20 Phase 2
  // item 5) — this test is about telegraph arming, not Swarm Larva's own
  // new mitigation, which would otherwise eat into the turret's damage.
  const victim = putUnit(state, "p2", signalDrone); // 1 health — the turret's arm-time ability will kill it
  state.players.p1.hand.push(perimeterTurret); // cost 2, telegraph 1
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;

  applyMove(state, { type: "playCard", handIndex: 0 }, rng);
  const turret = state.players.p1.board[0]!;
  expect(turret.pending, "a telegraphed unit should enter pending, not active").toBe(true);
  expect(currentHealth(state, victim), "the turret's damage effect must not fire while still dormant").toBe(1);
  const legalWhilePending = getLegalMoves(state);
  expect(
    legalWhilePending.some((m) => m.type === "attack" && m.attackerInstanceId === turret.instanceId),
    "a pending unit must not have a legal attack move",
  ).toBe(false);

  // Simulate one full round elapsing (turnNumber advances by 2: the
  // opponent's turn, then back to p1's own) and start p1's next turn, the
  // same call beginTurn makes at every real turn boundary.
  state.turnNumber += 2;
  beginTurn(state, "p1", rng, { draw: false });

  expect(turret.pending, "the turret should have armed once its controller's next turn began").toBe(false);
  expect(currentHealth(state, victim), "the turret's arm-time ability should now have fired its 3 damage").toBe(1 - 3);
});

test("evolving a unit keeps its instance identity and carries damage/tools forward, and spends the base card", () => {
  const state = emptyState();
  const rng = new Rng(12);
  const cadet = putUnit(state, "p1", aegisCadet, 1); // 1 damage already taken
  cadet.tools.push(platingModule); // simulate a tool attached before evolving
  const cadetInstanceId = cadet.instanceId;
  // Give the base a turn to "live" first — same-turn evolve is no longer
  // legal (see the dedicated test below), and this scenario is about the
  // evolve mechanics themselves, not that restriction.
  state.turnNumber += 1;
  state.players.p1.hand.push(aegisSentinel); // evolvesFrom AG-001 (Aegis Cadet), cost 3, onPlay: gain 1 energy
  state.players.p1.energy = 3;
  state.players.p1.maxEnergy = 3;

  const legal = getLegalMoves(state);
  const evolve = legal.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === cadetInstanceId);
  expect(evolve, "evolving into Aegis Sentinel should be offered, targeting the Aegis Cadet already in play").toBeTruthy();
  applyMove(state, evolve!, rng);

  const evolved = state.players.p1.board.find((u) => u.instanceId === cadetInstanceId);
  expect(evolved, "evolution must mutate the existing board unit in place, not remove and replace it").toBeTruthy();
  expect(evolved!.card.id, "the instance should now be the evolved card").toBe(aegisSentinel.id);
  expect(state.players.p1.board.length, "evolving must not consume an extra board slot").toBe(1);
  expect(evolved!.damageTaken, "accumulated damage should carry forward onto the evolved form").toBe(1);
  expect(evolved!.tools.includes(platingModule), "an attached tool should carry forward onto the evolved form").toBe(true);
  expect(
    state.players.p1.graveyard.some((c) => c.id === aegisCadet.id),
    "the consumed base card should go to the graveyard",
  ).toBe(true);
  expect(state.players.p1.energy, "the evolved card's own onPlay (gain 1 energy) should have fired: 3 - 3 (cost) + 1 = 1").toBe(1);
});

test("a base cannot be evolved the same turn it was played — it must survive to a later turn first", () => {
  // Owner overrule, 2026-09-13 stage-3 checkpoint feedback, item 4: the
  // original implementation allowed playing a base and evolving it in the
  // same turn (observed in sample-match-004-boarddev.txt), which let the
  // base skip the "answer it early while it's weak" exposure window
  // entirely. This is the regression test for that fix (moves.ts's
  // evolution-targeting filter).
  const state = emptyState();
  const rng = new Rng(15);
  state.players.p1.hand.push(aegisCadet);
  state.players.p1.energy = 4;
  state.players.p1.maxEnergy = 4;
  applyMove(state, { type: "playCard", handIndex: 0 }, rng); // play the base this same turn
  const cadet = state.players.p1.board[0]!;
  expect(cadet.enteredTurn, "the base should have entered play this turn").toBe(state.turnNumber);

  state.players.p1.hand.push(aegisSentinel);
  const legalSameTurn = getLegalMoves(state);
  expect(
    legalSameTurn.some((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === cadet.instanceId),
    "evolving the base should NOT be a legal move on the same turn it was played",
  ).toBe(false);

  // Advance to a later turn (a full round: opponent's turn, then back to
  // p1's own) — now it should be legal.
  state.turnNumber += 2;
  beginTurn(state, "p1", rng, { draw: false });
  const legalLaterTurn = getLegalMoves(state);
  expect(
    legalLaterTurn.some((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === cadet.instanceId),
    "evolving the base should become legal once it has survived to a later turn",
  ).toBe(true);
});

test("a Tool attaches to a friendly unit, boosting its live stats and granting a keyword", () => {
  const state = emptyState();
  const rng = new Rng(13);
  const drone = putUnit(state, "p1", aegisCadet); // 1/2, no keywords
  expect(hasKeyword(drone, "Guard"), "baseline: no Guard").toBe(false);
  state.players.p1.hand.push(guardDirectiveChip); // Tool: +1/+1, grants Guard
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;

  const legal = getLegalMoves(state);
  const attach = legal.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === drone.instanceId);
  expect(attach, "attaching the Tool to the friendly unit should be a legal move").toBeTruthy();
  applyMove(state, attach!, rng);

  expect(currentAttack(state, drone), "1 base + 1 tool bonus").toBe(2);
  expect(currentHealth(state, drone), "2 base + 1 tool bonus").toBe(3);
  expect(hasKeyword(drone, "Guard"), "the Tool's granted keyword should now apply, live, with no card change").toBe(true);
  expect(drone.tools.length, "the tool should be recorded as attached").toBe(1);

  // A Tool granting Barrier should apply the actual consumable status, not
  // just a live keyword flag — Barrier's behaviour lives in `statuses`.
  const shieldTarget = putUnit(state, "p1", aegisCadet);
  state.players.p1.hand.push(barrierShim);
  state.players.p1.energy = 2;
  const legal2 = getLegalMoves(state);
  const attachShim = legal2.find(
    (m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === shieldTarget.instanceId,
  );
  expect(attachShim, "attaching Barrier Shim should be legal").toBeTruthy();
  applyMove(state, attachShim!, rng);
  expect(shieldTarget.statuses.some((s) => s.kind === "Barrier"), "Barrier Shim should grant an actual Barrier status on attach").toBe(true);
});

test("the board-slot cap blocks new Units/Directives once full, but never blocks Tools", () => {
  const state = emptyState();
  const rng = new Rng(14);
  for (let i = 0; i < BOARD_SLOTS; i++) putUnit(state, "p1", swarmLarva);
  expect(state.players.p1.board.length, "board should be at capacity").toBe(BOARD_SLOTS);

  state.players.p1.hand.push(aegisCadet); // a plain new Unit — should be unplayable, no free slot
  state.players.p1.hand.push(platingModule); // a Tool — should still be playable, it doesn't need a slot
  state.players.p1.energy = 3;
  state.players.p1.maxEnergy = 3;

  const legal = getLegalMoves(state);
  expect(legal.some((m) => m.type === "playCard" && m.handIndex === 0), "a full board must block playing a new Unit").toBe(false);
  expect(legal.some((m) => m.type === "playCard" && m.handIndex === 1), "a full board must NOT block attaching a Tool").toBe(true);
});
