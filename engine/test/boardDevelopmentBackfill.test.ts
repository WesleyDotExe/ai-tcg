// Backfill: the board-development system (telegraph, evolution, Tool
// cards) was Aegis-exclusive after stage 3 — see progress/quality-debt.md's
// "Cortex and Swarm don't use telegraph/evolution/tools" entry. This proves
// the new Cortex/Swarm cards (data/cards.ts) actually exercise the same
// generic engine mechanics boardDevelopment.test.ts already covers, with
// combinations Aegis's own set didn't: a telegraph arm effect that applies
// a status (Stasis) rather than damage or Barrier, an evolve effect that
// draws a card rather than granting energy/healing, a Tool granting Rush
// (the first tool-granted keyword that changes what a unit can legally do,
// not just how attacks resolve against it), and an evolution line built on
// an existing stage-1 card (Swarm Larva) rather than a purpose-built base.

import { test, expect } from "vitest";
import { Rng } from "../src/state/rng.js";
import { currentAttack, currentHealth, hasKeyword } from "../src/state/queries.js";
import { applyMove, beginTurn } from "../src/engine/engine.js";
import { getLegalMoves } from "../src/engine/moves.js";
import { swarmLarva, initDaemon, compiledDaemon, dormantExploit, overclockShunt, dormantEggSac, moltedStalker, chitinPlating } from "../src/data/cards.js";
import { emptyState, putUnit } from "./helpers.js";

test("Compiled Daemon (Cortex) evolves from Init Daemon in place and its arm-time damage fires", () => {
  const state = emptyState();
  const rng = new Rng(21);
  const daemon = putUnit(state, "p1", initDaemon);
  const daemonInstanceId = daemon.instanceId;
  const victim = putUnit(state, "p2", swarmLarva); // 1 health — dies to the 2-damage evolve effect
  state.turnNumber += 1; // let the base survive to a later turn, required to evolve
  state.players.p1.hand.push(compiledDaemon);
  state.players.p1.energy = 3;
  state.players.p1.maxEnergy = 3;

  const legal = getLegalMoves(state);
  const evolve = legal.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === daemonInstanceId);
  expect(evolve, "evolving into Compiled Daemon should target the Init Daemon already in play").toBeTruthy();
  applyMove(state, evolve!, rng);

  const evolved = state.players.p1.board.find((u) => u.instanceId === daemonInstanceId);
  expect(evolved?.card.id, "the instance should now be the evolved card, same instanceId").toBe(compiledDaemon.id);
  expect(currentHealth(state, victim), "the evolve-in ability's 2 damage should have killed the 1-health target").toBeLessThanOrEqual(0);
});

test("Dormant Exploit (Cortex) stays dormant until it arms, then stuns a random enemy rather than dealing damage", () => {
  const state = emptyState();
  const rng = new Rng(22);
  const target = putUnit(state, "p2", swarmLarva);
  state.players.p1.hand.push(dormantExploit); // cost 2, telegraph 1
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;

  applyMove(state, { type: "playCard", handIndex: 0 }, rng);
  const exploit = state.players.p1.board[0]!;
  expect(exploit.pending, "should enter pending, not active").toBe(true);
  expect(target.statuses.some((s) => s.kind === "Stasis"), "Stasis must not apply before the exploit arms").toBe(false);

  state.turnNumber += 2;
  beginTurn(state, "p1", rng, { draw: false });

  expect(exploit.pending, "should have armed at the start of p1's next turn").toBe(false);
  expect(target.statuses.some((s) => s.kind === "Stasis"), "arming should apply Stasis to the random enemy target").toBe(true);
  expect(currentHealth(state, target), "the arm effect is a stun, not damage — health should be untouched").toBe(swarmLarva.health);
});

test("Overclock Shunt (Cortex Tool) grants Rush, letting a freshly played unit attack the same turn", () => {
  const state = emptyState();
  const rng = new Rng(23);
  const drone = putUnit(state, "p1", initDaemon); // played this turn, no Rush of its own — cannot normally attack yet
  expect(hasKeyword(drone, "Rush"), "baseline: no Rush").toBe(false);
  const legalBefore = getLegalMoves(state);
  expect(legalBefore.some((m) => m.type === "attack" && m.attackerInstanceId === drone.instanceId), "should not be able to attack before Rush is granted").toBe(false);

  state.players.p1.hand.push(overclockShunt);
  state.players.p1.energy = 1;
  state.players.p1.maxEnergy = 1;
  const attach = getLegalMoves(state).find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === drone.instanceId);
  expect(attach, "attaching the Tool should be legal").toBeTruthy();
  applyMove(state, attach!, rng);

  expect(hasKeyword(drone, "Rush"), "the Tool's granted Rush should apply live").toBe(true);
  expect(currentAttack(state, drone), "1 base + 1 tool bonus").toBe(2);
  const legalAfter = getLegalMoves(state);
  expect(
    legalAfter.some((m) => m.type === "attack" && m.attackerInstanceId === drone.instanceId),
    "Rush granted by a Tool should bypass summoning sickness the same turn it's attached",
  ).toBe(true);
});

test("Molted Stalker (Swarm) evolves from the pre-existing Swarm Larva and draws a card on evolving in", () => {
  const state = emptyState();
  const rng = new Rng(24);
  const larva = putUnit(state, "p1", swarmLarva);
  const larvaInstanceId = larva.instanceId;
  state.turnNumber += 1;
  state.players.p1.hand.push(moltedStalker);
  state.players.p1.deck.push(initDaemon); // something to draw
  state.players.p1.energy = 3;
  state.players.p1.maxEnergy = 3;
  const handSizeBefore = state.players.p1.hand.length; // includes moltedStalker itself pre-play

  const legal = getLegalMoves(state);
  const evolve = legal.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === larvaInstanceId);
  expect(evolve, "evolving into Molted Stalker should target the pre-existing Swarm Larva").toBeTruthy();
  applyMove(state, evolve!, rng);

  const evolved = state.players.p1.board.find((u) => u.instanceId === larvaInstanceId);
  expect(evolved?.card.id, "same instance, now the evolved card").toBe(moltedStalker.id);
  expect(state.players.p1.hand.length, "playing the evolution card removes it from hand, then its onPlay draws one back").toBe(handSizeBefore - 1 + 1);
});

test("Dormant Egg Sac (Swarm) telegraph arms and deals its damage, and Chitin Plating boosts health as a Tool", () => {
  const state = emptyState();
  const rng = new Rng(25);
  const victim = putUnit(state, "p2", swarmLarva);
  state.players.p1.hand.push(dormantEggSac); // cost 2, telegraph 1
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;
  applyMove(state, { type: "playCard", handIndex: 0 }, rng);
  const eggSac = state.players.p1.board[0]!;
  expect(eggSac.pending).toBe(true);

  state.turnNumber += 2;
  beginTurn(state, "p1", rng, { draw: false });
  expect(eggSac.pending, "should arm on p1's next turn").toBe(false);
  expect(currentHealth(state, victim), "the 3-damage arm effect should have killed the 1-health target").toBeLessThanOrEqual(0);

  const healthy = putUnit(state, "p1", swarmLarva);
  state.players.p1.hand.push(chitinPlating);
  state.players.p1.energy = 1;
  state.players.p1.maxEnergy = 1;
  const attach = getLegalMoves(state).find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === healthy.instanceId);
  expect(attach, "attaching Chitin Plating should be legal").toBeTruthy();
  applyMove(state, attach!, rng);
  expect(currentHealth(state, healthy), "1 base health + 3 tool bonus").toBe(swarmLarva.health + 3);
});
