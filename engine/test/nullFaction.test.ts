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
  state.players.p1.energy = 6;
  state.players.p1.maxEnergy = 6;

  const legal = getLegalMoves(state);
  const evolve = legal.find(
    (m) =>
      m.type === "playCard" &&
      m.target?.kind === "unit" &&
      m.target.instanceId === processInstanceId &&
      m.abilityTarget?.kind === "unit" &&
      m.abilityTarget.instanceId === victim.instanceId,
  );
  expect(evolve, "evolving into Kernel Panic, choosing the eligible victim as the destroy target, should be offered").toBeTruthy();
  // "chosen" targeting, as originally written — restored 2026-09-19 (the
  // architectural gap that forced this to "random" is now closed
  // generally, see engine/moves.ts's evolution branch and
  // engine/engine.ts's evolveUnit). getLegalMoves offers one move per
  // (base, eligible ability target) combination; this picks the specific
  // one whose abilityTarget is the victim, rather than relying on there
  // happening to be only one option.
  applyMove(state, evolve!, rng);

  const evolved = state.players.p1.board.find((u) => u.instanceId === processInstanceId);
  expect(evolved?.card.id, "the instance should now be the evolved card, same instanceId").toBe(kernelPanic.id);
  expect(isAlive(state, victim), "destroy must kill regardless of the health buff").toBe(false);
  expect(victim.statuses.some((s) => s.kind === "Barrier"), "destroy bypasses Barrier rather than being consumed by it").toBe(true);
});

test("Kernel Panic (Null) chosen targeting lets the controller pick WHICH eligible enemy unit dies, not a random one", () => {
  // The real proof the 2026-09-19 chosen-targeting fix works: with two
  // eligible (under-cap) enemy units in play, the controller can choose
  // exactly one to destroy and leave the other alone — impossible to
  // guarantee under the old "random" workaround.
  const state = emptyState();
  const rng = new Rng(36);
  const process = putUnit(state, "p1", corruptedProcess);
  const processInstanceId = process.instanceId;
  const spare = putUnit(state, "p2", swarmLarva); // 1 health, eligible, should survive
  const spareInstanceId = spare.instanceId;
  const chosenVictim = putUnit(state, "p2", swarmLarva); // 1 health, eligible, the one we pick
  const chosenVictimInstanceId = chosenVictim.instanceId;
  state.turnNumber += 1;
  state.players.p1.hand.push(kernelPanic);
  state.players.p1.energy = 6;
  state.players.p1.maxEnergy = 6;

  const legal = getLegalMoves(state);
  const evolveOptions = legal.filter((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === processInstanceId);
  expect(evolveOptions.length, "one legal evolve move per eligible destroy target — two enemy units, two options").toBe(2);
  const pick = evolveOptions.find((m) => m.type === "playCard" && m.abilityTarget?.kind === "unit" && m.abilityTarget.instanceId === chosenVictimInstanceId);
  expect(pick, "the controller must be able to choose the specific eligible target to destroy").toBeTruthy();

  applyMove(state, pick!, rng);

  expect(isAlive(state, chosenVictim), "the chosen target should be destroyed").toBe(false);
  const spareStillThere = state.players.p2.board.find((u) => u.instanceId === spareInstanceId);
  expect(spareStillThere, "the unchosen eligible unit must be left completely alone, not caught by a random pick").toBeTruthy();
  expect(spareStillThere?.damageTaken, "the unchosen unit should be untouched").toBe(0);
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
  state.players.p1.energy = 6;
  state.players.p1.maxEnergy = 6;

  const legal = getLegalMoves(state);
  const evolveOptions = legal.filter((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === processInstanceId);
  // Evolving is still legal even though the bonus destroy has zero eligible
  // targets — the base's upgrade isn't conditional on the ability having
  // somewhere to point (see moves.ts's evolution branch) — but exactly one
  // option is offered, with no ability target, since Warden is the only
  // enemy unit and it's ineligible.
  expect(evolveOptions.length, "evolving must still be offered with zero eligible destroy targets").toBe(1);
  expect(evolveOptions[0]!.type === "playCard" && evolveOptions[0]!.abilityTarget, "no ability target should be offered when nothing is eligible").toBeUndefined();
  applyMove(state, evolveOptions[0]!, rng);

  const evolved = state.players.p1.board.find((u) => u.instanceId === processInstanceId);
  expect(evolved?.card.id, "evolution itself must still go through").toBe(kernelPanic.id);
  expect(isAlive(state, warden), "a unit above the maxHealth cap must never be a legal destroy target, even as the only enemy unit in play").toBe(true);
  expect(warden.damageTaken, "the ineligible unit should be completely untouched, not partially damaged").toBe(0);
});

test("Deprecated Routine (Null) telegraph arms and applies a permanent -2/-2 decay debuff, chosen at deploy time, not damage", () => {
  const state = emptyState();
  const rng = new Rng(32);
  // Two enemy units in play at deploy time, so choosing one over the other
  // is a real, provable decision — not just "the only eligible target
  // happened to be this one." barrierDrone is 0/3; pre-damaged for 2 so
  // it's at 1 current health — enough headroom to show the debuff lowers
  // max health (not just dealing damage) while also proving decay can
  // finish off an already-weakened unit once its max health drops below
  // what it's already taken.
  const target = putUnit(state, "p2", barrierDrone, 2);
  const targetInstanceId = target.instanceId;
  const spare = putUnit(state, "p2", barrierDrone);
  const spareInstanceId = spare.instanceId;
  expect(currentHealth(state, target), "sanity: 3 max health - 2 damage taken").toBe(1);
  state.players.p1.hand.push(deprecatedRoutine); // cost 3, telegraph 2
  state.players.p1.energy = 3;
  state.players.p1.maxEnergy = 3;

  // "chosen" targeting, as originally written — restored 2026-09-19. The
  // choice is made now, at deploy time (there's no agent decision point
  // left once the telegraph actually arms, turns later — see
  // UnitInstance.armChosenTarget), by picking the legal playCard move whose
  // target is specifically the intended victim, not the spare.
  const legalAtDeploy = getLegalMoves(state);
  const deploy = legalAtDeploy.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === targetInstanceId);
  expect(deploy, "deploying Deprecated Routine, choosing the intended victim, should be offered").toBeTruthy();
  applyMove(state, deploy!, rng);
  const routine = state.players.p1.board[0]!;
  expect(routine.pending, "should enter pending, not active").toBe(true);
  expect(routine.armChosenTarget?.kind === "unit" && routine.armChosenTarget.instanceId, "the chosen target should be captured on the unit for later").toBe(targetInstanceId);
  expect(target.permanentBuff.attack, "the debuff must not apply before the telegraph arms").toBe(0);

  state.turnNumber += 4; // telegraph=2 => armTurn = turnNumber + 2*2 (see computeArmTurn)
  beginTurn(state, "p1", rng, { draw: false });

  expect(routine.pending, "should have armed after 2 of p1's own turns").toBe(false);
  expect(target.permanentBuff.attack, "arming should apply the permanent -2 attack debuff to the chosen target").toBe(-2);
  expect(target.permanentBuff.health, "arming should apply the permanent -2 health debuff to the chosen target").toBe(-2);
  const spareStillThere = state.players.p2.board.find((u) => u.instanceId === spareInstanceId);
  expect(spareStillThere?.permanentBuff.attack, "the unchosen enemy unit must be completely untouched").toBe(0);
  expect(spareStillThere?.permanentBuff.health, "the unchosen enemy unit must be completely untouched").toBe(0);
  // Max health drops from 3 to 1 (the engine floors max health at 1, never
  // lower), and 1 max health minus the 2 damage already taken is lethal —
  // this is decay, working through the same damageTaken bookkeeping as
  // everything else, not a disguised damage effect.
  expect(isAlive(state, target), "reducing max health below already-taken damage should kill the unit").toBe(false);
  expect(currentAttack(state, target), "attack should be clamped at 0, not negative").toBe(0);
});

test("Deprecated Routine (Null) no-ops harmlessly if its chosen target is gone by the time the telegraph arms", () => {
  const state = emptyState();
  const rng = new Rng(37);
  const victim = putUnit(state, "p2", barrierDrone);
  const victimInstanceId = victim.instanceId;
  state.players.p1.hand.push(deprecatedRoutine);
  state.players.p1.energy = 3;
  state.players.p1.maxEnergy = 3;
  const legal = getLegalMoves(state);
  const deploy = legal.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === victimInstanceId);
  applyMove(state, deploy!, rng);
  const routine = state.players.p1.board[0]!;

  // The chosen target dies (of something else entirely) before the
  // telegraph arms — a real consequence of choosing 2 turns in advance
  // (see quality-debt.md), not a bug.
  state.players.p2.board = state.players.p2.board.filter((u) => u.instanceId !== victimInstanceId);
  state.players.p2.graveyard.push(victim.card);

  state.turnNumber += 4;
  expect(() => beginTurn(state, "p1", rng, { draw: false })).not.toThrow();
  expect(routine.pending, "should still arm on schedule even though its target is gone").toBe(false);
});

test("Fork Bomb (Null) telegraph arms and creates two Fork Child tokens on the controller's board", () => {
  // Phase 3 pool lint (cards/poolLint.ts): Fork Bomb's arm effect was
  // redesigned from AOE damage to a summon (see data/nullCards.ts's own
  // comment on the card — it both cut Null's removal/debuff density and
  // gave the AOE-damage flavour a more literal "forks copies of itself"
  // reading). This test replaces the old AOE-damage assertion below with
  // one proving the new summon effect actually fires on arm, the same way
  // summon.test.ts proves it for Brood Reserves.
  const state = emptyState();
  const rng = new Rng(33);
  state.players.p1.hand.push(forkBomb); // cost 2, telegraph 1
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;
  applyMove(state, { type: "playCard", handIndex: 0 }, rng);
  const bomb = state.players.p1.board[0]!;
  expect(bomb.pending).toBe(true);
  expect(state.players.p1.board).toHaveLength(1);

  state.turnNumber += 2;
  beginTurn(state, "p1", rng, { draw: false });

  expect(bomb.pending, "should arm on p1's next turn (telegraph=1)").toBe(false);
  const tokens = state.players.p1.board.filter((u) => u.card.name === "Fork Child");
  expect(tokens, "arming should create two 1/1 Fork Child tokens").toHaveLength(2);
  for (const token of tokens) {
    expect(currentAttack(state, token)).toBe(1);
    expect(currentHealth(state, token)).toBe(1);
  }
});

test("Entropy Harvester (Null) attack scales live with the ENEMY graveyard size (2026-09-22 Phase 4 backstop: was the controller's own)", () => {
  const state = emptyState();
  const harvester = putUnit(state, "p1", entropyHarvester);
  expect(currentAttack(state, harvester), "base case: empty enemy graveyard, base 1 + 1*0").toBe(1);

  // The controller's OWN graveyard filling up must NOT move this anymore —
  // that's exactly the old behaviour this session's redesign removed.
  state.players.p1.graveyard.push(glitchSeed, glitchSeed, glitchSeed);
  expect(currentAttack(state, harvester), "the controller's own graveyard is no longer this card's scaling source").toBe(1);

  state.players.p2.graveyard.push(glitchSeed, glitchSeed, glitchSeed);
  expect(currentAttack(state, harvester), "3 cards in the ENEMY graveyard should push attack to 1 + 1*3").toBe(4);

  state.players.p2.graveyard.push(glitchSeed);
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
