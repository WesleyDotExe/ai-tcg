// The fourth faction (progress/roadmap.md item 1). Null reuses the board-
// development system (telegraph/evolution/tools — already whitebox-tested
// generically in boardDevelopment.test.ts) but introduces three mechanics
// no earlier card exercised: the `destroy` effect kind (unconditional
// removal, ignoring stats/Barrier), a *negative* permanent `buff` (a decay
// debuff — every prior buff effect only ever added stats), and
// `controllerGraveyardSize` as a live scaling source for a unit's own
// stats. This file proves each of those three actually works, not just
// that the generic telegraph/evolve/tool plumbing accepts Null's cards.

import { test, expect } from "vitest";
import { Rng } from "../src/state/rng.js";
import { currentAttack, currentHealth, isAlive } from "../src/state/queries.js";
import { applyMove, beginTurn } from "../src/engine/engine.js";
import { getLegalMoves } from "../src/engine/moves.js";
import {
  corruptedProcess,
  kernelPanic,
  deprecatedRoutine,
  forkBomb,
  entropyHarvester,
  propagatingExploit,
  glitchSeed,
} from "../src/data/nullCards.js";
import { swarmLarva } from "../src/data/cards.js";
import { barrierDrone } from "../src/data/aegisCards.js";
import { emptyState, putUnit } from "./helpers.js";

test("Kernel Panic (Null) evolves from Corrupted Process and destroys its target outright, ignoring stats and Barrier", () => {
  const state = emptyState();
  const rng = new Rng(31);
  const process = putUnit(state, "p1", corruptedProcess);
  const processInstanceId = process.instanceId;
  const victim = putUnit(state, "p2", swarmLarva);
  victim.permanentBuff.health = 50; // even a huge stat buff must not save it from `destroy`
  victim.statuses.push({ kind: "Barrier", duration: "untilConsumed" }); // and Barrier must not absorb it either
  state.turnNumber += 1; // let the base survive to a later turn, required to evolve
  state.players.p1.hand.push(kernelPanic);
  state.players.p1.energy = 5;
  state.players.p1.maxEnergy = 5;

  const legal = getLegalMoves(state);
  const evolve = legal.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === processInstanceId);
  expect(evolve, "evolving into Kernel Panic should target the Corrupted Process already in play").toBeTruthy();
  // Kernel Panic's destroy effect targets a random enemy unit, not a chosen
  // one: evolveUnit's onPlay resolution never supplies a `chosen` ref (see
  // the card's own comment), so with only one enemy unit on the board the
  // random pick is deterministically that unit.
  applyMove(state, evolve!, rng);

  const evolved = state.players.p1.board.find((u) => u.instanceId === processInstanceId);
  expect(evolved?.card.id, "the instance should now be the evolved card, same instanceId").toBe(kernelPanic.id);
  expect(isAlive(state, victim), "destroy must kill regardless of the +50 health buff").toBe(false);
  expect(victim.statuses.some((s) => s.kind === "Barrier"), "destroy bypasses Barrier rather than being consumed by it").toBe(true);
});

test("Deprecated Routine (Null) telegraph arms and applies a permanent -2/-2 decay debuff, not damage", () => {
  const state = emptyState();
  const rng = new Rng(32);
  // barrierDrone is 0/3; pre-damaged for 2 so it's at 1 current health —
  // enough headroom to show the debuff lowers max health (not just dealing
  // damage) while also proving decay can finish off an already-weakened
  // unit once its max health drops below what it's already taken.
  const target = putUnit(state, "p2", barrierDrone, 2);
  expect(currentHealth(state, target), "sanity: 3 max health - 2 damage taken").toBe(1);
  state.players.p1.hand.push(deprecatedRoutine); // cost 3, telegraph 2
  state.players.p1.energy = 3;
  state.players.p1.maxEnergy = 3;
  applyMove(state, { type: "playCard", handIndex: 0 }, rng);
  const routine = state.players.p1.board[0]!;
  expect(routine.pending, "should enter pending, not active").toBe(true);
  expect(target.permanentBuff.attack, "the debuff must not apply before the telegraph arms").toBe(0);

  state.turnNumber += 4; // telegraph=2 => armTurn = turnNumber + 2*2 (see computeArmTurn)
  beginTurn(state, "p1", rng, { draw: false });

  expect(routine.pending, "should have armed after 2 of p1's own turns").toBe(false);
  expect(target.permanentBuff.attack, "arming should apply the permanent -2 attack debuff").toBe(-2);
  expect(target.permanentBuff.health, "arming should apply the permanent -2 health debuff").toBe(-2);
  // Max health drops from 3 to 1 (the engine floors max health at 1, never
  // lower), and 1 max health minus the 2 damage already taken is lethal —
  // this is decay, working through the same damageTaken bookkeeping as
  // everything else, not a disguised damage effect.
  expect(isAlive(state, target), "reducing max health below already-taken damage should kill the unit").toBe(false);
  expect(currentAttack(state, target), "attack should be clamped at 0, not negative").toBe(0);
});

test("Fork Bomb (Null) telegraph arms and deals AOE damage to every enemy unit, not just one", () => {
  const state = emptyState();
  const rng = new Rng(33);
  const victimA = putUnit(state, "p2", swarmLarva); // 1 health
  const victimB = putUnit(state, "p2", swarmLarva); // 1 health
  state.players.p1.hand.push(forkBomb); // cost 2, telegraph 1
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;
  applyMove(state, { type: "playCard", handIndex: 0 }, rng);
  const bomb = state.players.p1.board[0]!;
  expect(bomb.pending).toBe(true);

  state.turnNumber += 2;
  beginTurn(state, "p1", rng, { draw: false });

  expect(bomb.pending, "should arm on p1's next turn (telegraph=1)").toBe(false);
  expect(isAlive(state, victimA), "arming's 2-damage AOE should kill both 1-health enemy units").toBe(false);
  expect(isAlive(state, victimB), "AOE must hit every enemy unit, not just the first").toBe(false);
});

test("Entropy Harvester (Null) attack scales live with the controller's graveyard size", () => {
  const state = emptyState();
  const harvester = putUnit(state, "p1", entropyHarvester);
  expect(currentAttack(state, harvester), "base case: empty graveyard, base 1 + 1*0").toBe(1);

  state.players.p1.graveyard.push(glitchSeed, glitchSeed, glitchSeed);
  expect(currentAttack(state, harvester), "3 cards in the graveyard should push attack to 1 + 1*3").toBe(4);

  state.players.p1.graveyard.push(glitchSeed);
  expect(currentAttack(state, harvester), "the stat is recomputed live, not snapshotted at play time").toBe(5);
});

test("Propagating Exploit (Null) permanently grows +1/+0 every time it attacks, across turns", () => {
  const state = emptyState();
  const rng = new Rng(34);
  const exploit = putUnit(state, "p1", propagatingExploit);
  exploit.enteredTurn = -1; // treat as having survived a prior turn so it can attack immediately
  expect(currentAttack(state, exploit)).toBe(propagatingExploit.attack);

  applyMove(state, { type: "attack", attackerInstanceId: exploit.instanceId, target: { kind: "player", playerId: "p2" } }, rng);
  expect(currentAttack(state, exploit), "first attack should permanently add +1 attack").toBe(propagatingExploit.attack + 1);

  state.turnNumber += 1;
  beginTurn(state, "p1", rng, { draw: false }); // resets hasAttackedThisTurn for the new turn
  applyMove(state, { type: "attack", attackerInstanceId: exploit.instanceId, target: { kind: "player", playerId: "p2" } }, rng);
  expect(currentAttack(state, exploit), "a second attack on a later turn should stack another permanent +1").toBe(propagatingExploit.attack + 2);
});
