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
  nullSingularity,
} from "../src/data/nullCards.js";
import { swarmLarva } from "../src/data/cards.js";
import { barrierDrone, aegisWarden, aegisCadet } from "../src/data/aegisCards.js";
import { emptyState, putUnit } from "./helpers.js";

test("Kernel Panic (Null) evolves from Corrupted Process and destroys a small target outright, ignoring stat buffs and Barrier", () => {
  const state = emptyState();
  const rng = new Rng(31);
  const process = putUnit(state, "p1", corruptedProcess);
  const processInstanceId = process.instanceId;
  const victim = putUnit(state, "p2", swarmLarva);
  // +3 health keeps it at 4 total max health, under Kernel Panic's
  // maxHealth:5 eligibility cap (see the card's own comment) — still
  // proving destroy ignores the buff to kill it, without also tripping
  // the new targeting restriction this session added (see the next test
  // for that).
  victim.permanentBuff.health = 3;
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
  // the card's own comment), so with only one *eligible* enemy unit on the
  // board the random pick is deterministically that unit.
  applyMove(state, evolve!, rng);

  const evolved = state.players.p1.board.find((u) => u.instanceId === processInstanceId);
  expect(evolved?.card.id, "the instance should now be the evolved card, same instanceId").toBe(kernelPanic.id);
  expect(isAlive(state, victim), "destroy must kill regardless of the health buff").toBe(false);
  expect(victim.statuses.some((s) => s.kind === "Barrier"), "destroy bypasses Barrier rather than being consumed by it").toBe(true);
});

test("Kernel Panic (Null) cannot target a unit built bigger than its 5-health cap — the Aegis-vs-Null soft-counter fix", () => {
  // 2026-09-17 owner feedback: Kernel Panic's unconditional destroy was a
  // hard counter to Aegis's stacking identity (Aegis-vs-Null measured
  // 75-81% for Null, the worst pairing in progress/balance-report-002-null.txt).
  // Aegis Warden (7 max health, and it evolves in already fully healed via
  // its own onPlay — see aegisCards.ts) is exactly the kind of "evolved,
  // stacked" unit the fix direction named as something that should escape.
  const state = emptyState();
  const rng = new Rng(35);
  const process = putUnit(state, "p1", corruptedProcess);
  const processInstanceId = process.instanceId;
  const warden = putUnit(state, "p2", aegisWarden); // 7 max health, over the cap
  state.turnNumber += 1;
  state.players.p1.hand.push(kernelPanic);
  state.players.p1.energy = 5;
  state.players.p1.maxEnergy = 5;

  const legal = getLegalMoves(state);
  const evolve = legal.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === processInstanceId);
  applyMove(state, evolve!, rng);

  expect(isAlive(state, warden), "a unit above the maxHealth cap must never be a legal destroy target, even as the only enemy unit in play").toBe(true);
  expect(warden.damageTaken, "the ineligible unit should be completely untouched, not partially damaged").toBe(0);
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

test("Null Singularity's enemy aura debuffs attack only, not health (session-10 Aegis-vs-Null fix)", () => {
  // 2026-09-17 owner feedback: Null Singularity was the only card in the
  // pool applying a persistent, un-cleansable enemy-health reduction
  // (see nullCards.ts's own comment on this ability for the full
  // reasoning and its Prime Aegis/Segmentation Fault precedent). This
  // pins the fix so the health component can't silently regress.
  const state = emptyState();
  putUnit(state, "p1", nullSingularity);
  const enemy = putUnit(state, "p2", aegisCadet); // 1/2
  expect(currentAttack(state, enemy), "enemy attack should drop by 1 from the aura").toBe(0);
  expect(currentHealth(state, enemy), "enemy health must NOT be reduced by this aura anymore").toBe(2);
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
