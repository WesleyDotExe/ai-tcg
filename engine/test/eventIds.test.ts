// Instance ids in the event log (owner-feedback 2026-10-03, balance lane
// item b; built session 27). The render lane needs every event that names a
// board card to say WHICH copy, so a spell travels to its exact target and
// each hit pairs with the card that caused it. The id fields are optional in
// the GameEvent type (old hand-built fixtures stay valid), so this suite is
// what makes them a guarantee: real matches for every faction pairing, every
// event checked, plus hand-built two-copy scenarios where a name can't tell
// the copies apart and only the id can.

import { test, expect } from "vitest";
import { Rng } from "../src/state/rng.js";
import { createInitialState } from "../src/state/init.js";
import { applyMove, beginTurn } from "../src/engine/engine.js";
import { getLegalMoves } from "../src/engine/moves.js";
import { buildPlayerView, type Agent } from "../src/agents/agent.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { RandomAgent } from "../src/agents/randomAgent.js";
import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../src/data/decks.js";
import { diagnosticPulse, failsafeUnit } from "../src/data/cards.js";
import { aegisSentinel, aegisWarden, interceptRoutine } from "../src/data/aegisCards.js";
import type { GameEvent, GameState } from "../src/state/types.js";
import type { TargetRef } from "../src/effects/targeting.js";
import { emptyState, putUnit, drainStack } from "./helpers.js";

const BUILDERS = { Cortex: buildCortexDeck, Swarm: buildSwarmDeck, Aegis: buildAegisDeck, Null: buildNullDeck } as const;
type F = keyof typeof BUILDERS;
const FACTIONS = Object.keys(BUILDERS) as F[];

/** Damage minus healing per unit id, from one move's worth of events. */
function netDamageById(events: GameEvent[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const e of events) {
    if ((e.type === "damage" || e.type === "heal") && e.targetRef?.kind === "unit") {
      const id = e.targetRef.instanceId;
      net.set(id, (net.get(id) ?? 0) + (e.type === "damage" ? e.amount : -e.amount));
    }
  }
  return net;
}

function damageTakenById(state: GameState): Map<string, number> {
  const m = new Map<string, number>();
  for (const pid of ["p1", "p2"] as const) for (const u of state.players[pid].board) m.set(u.instanceId, u.damageTaken);
  return m;
}

/** Plays one match the way runMatch does, checking every move's new events
 * against the state on either side of the move. Returns the number of
 * id-bearing events checked. */
async function playAndCheck(fa: F, fb: F, seed: number, policy: "lookahead" | "random"): Promise<number> {
  const rng = new Rng(seed);
  const state = createInitialState(BUILDERS[fa]("p1", fa), BUILDERS[fb]("p2", fb), rng);
  state.turnNumber = 1;
  state.activePlayer = "p1";
  beginTurn(state, "p1", rng, { draw: false });
  const mk = (n: string, s: number): Agent => (policy === "lookahead" ? new LookaheadAgent(n, s) : new RandomAgent(n, s));
  const agents = { p1: mk("A", seed * 7 + 1), p2: mk("B", seed * 13 + 5) };

  // Name of every instance id ever seen, kept current through evolutions.
  const names = new Map<string, string>();
  // A Command's stack id -> its card name (its sourceId on what it causes).
  const commandNames = new Map<string, string>();
  const openStack = new Set<string>();
  const label = `${fa} v ${fb}, seed ${seed}, ${policy}`;
  let checked = 0;

  const unitName = (ref: TargetRef | undefined, expected: string, what: string) => {
    expect(ref, `${label}: ${what} has no ref`).toBeDefined();
    if (ref!.kind === "player") {
      expect(state.players[ref!.playerId].name, `${label}: ${what} player ref`).toBe(expected);
    } else {
      expect(names.get(ref!.instanceId), `${label}: ${what} id ${ref!.instanceId}`).toBe(expected);
    }
  };
  const source = (id: string | undefined, expected: string, what: string) => {
    if (expected === "Overload") {
      expect(id, `${label}: Overload is a status, it has no source card`).toBeUndefined();
      return;
    }
    expect(id, `${label}: ${what} from ${expected} has no sourceId`).toBeDefined();
    expect(names.get(id!) ?? commandNames.get(id!), `${label}: ${what} sourceId ${id}`).toBe(expected);
  };

  // The opening draws/turnStart carry no ids; checking starts with moves.
  let seen = state.log.length;
  for (let moves = 0; !state.winner && moves < 5000; moves++) {
    const before = damageTakenById(state);
    const legal = getLegalMoves(state);
    const move = await agents[state.priority].decideMove(buildPlayerView(state, state.priority), legal);
    applyMove(state, move, rng);
    const fresh = state.log.slice(seen);
    seen = state.log.length;

    for (const e of fresh) {
      switch (e.type) {
        case "play":
        case "summon":
          expect(e.instanceId, `${label}: ${e.type} without an id`).toBeDefined();
          names.set(e.instanceId!, e.type === "play" ? e.card : e.token);
          if (e.type === "summon") source(e.sourceId, e.source, "summon");
          checked++;
          break;
        case "evolve":
          expect(names.get(e.instanceId!), `${label}: evolve base`).toBe(e.from);
          names.set(e.instanceId!, e.to);
          checked++;
          break;
        case "cast":
          expect(e.stackId, `${label}: cast without a stackId`).toBeDefined();
          openStack.add(e.stackId!);
          if (e.sourceId === undefined) commandNames.set(e.stackId!, e.card);
          else expect(e.card.startsWith(`${names.get(e.sourceId)} — `), `${label}: activated ability source`).toBe(true);
          checked++;
          break;
        case "attack":
          expect(names.get(e.attackerId!), `${label}: attacker id`).toBe(e.attacker);
          unitName(e.defenderRef, e.defender, "attack defender");
          expect(e.stackId, `${label}: attack without a stackId`).toBeDefined();
          openStack.add(e.stackId!);
          checked++;
          break;
        case "stackResolve":
          expect(openStack.delete(e.stackId!), `${label}: stackResolve ${e.stackId} matches no open cast/attack`).toBe(true);
          checked++;
          break;
        case "abilityTrigger":
          source(e.sourceId, e.source, `ability ${e.ability}`);
          expect(e.targets, `${label}: abilityTrigger without targets`).toBeDefined();
          checked++;
          break;
        case "damage":
        case "heal":
          source(e.sourceId, e.source, e.type);
          unitName(e.targetRef, e.target, e.type);
          checked++;
          break;
        case "buff":
        case "statusApplied":
          source(e.sourceId, e.source, e.type);
          expect(names.get(e.targetId!), `${label}: ${e.type} target id`).toBe(e.target);
          checked++;
          break;
        case "barrierAbsorbed":
        case "baseArmorReduced":
          source(e.sourceId, e.source, e.type);
          expect(names.get(e.unitId!), `${label}: ${e.type} unit id`).toBe(e.unit);
          checked++;
          break;
        case "gainEnergy":
        case "summonFizzle":
          source(e.sourceId, e.source, e.type);
          checked++;
          break;
        case "death":
          expect(names.get(e.instanceId!), `${label}: death id`).toBe(e.unit);
          checked++;
          break;
        case "telegraphPlaced":
        case "telegraphArmed":
          expect(names.get(e.instanceId!), `${label}: ${e.type} id`).toBe(e.unit);
          checked++;
          break;
        case "toolAttached":
          expect(names.get(e.unitId!), `${label}: tool host id`).toBe(e.unit);
          checked++;
          break;
        case "directiveDestroyed":
          source(e.sourceId, e.source, e.type);
          expect(names.get(e.instanceId!), `${label}: destroyed directive id`).toBe(e.directive);
          checked++;
          break;
        case "attackRedirected":
          source(e.sourceId, e.source, e.type);
          expect(names.get(e.attackerId!), `${label}: redirected attacker id`).toBe(e.attacker);
          unitName(e.fromRef, e.from, "redirect from");
          unitName(e.toRef, e.to, "redirect to");
          checked++;
          break;
        default:
          break;
      }
    }

    // The exact identity check: names can't tell two copies apart, so the
    // damage each id is logged as taking must equal the damage that
    // instance actually took. Holds for every unit on the board both
    // before and after the move (a dead one's damageTaken is gone with it).
    const after = damageTakenById(state);
    for (const [id, net] of netDamageById(fresh)) {
      if (!before.has(id) || !after.has(id)) continue;
      expect(after.get(id)! - before.get(id)!, `${label}: logged damage on ${id} (${names.get(id)}) vs its real damage`).toBe(net);
    }
  }
  expect(state.winner, `${label}: match did not finish`).toBeDefined();
  return checked;
}

test("every id-bearing event in real matches names the right instance (all 16 faction pairings, two policies)", async () => {
  let total = 0;
  for (const fa of FACTIONS) {
    for (const fb of FACTIONS) {
      total += await playAndCheck(fa, fb, 3, "lookahead");
      total += await playAndCheck(fa, fb, 4, "random");
    }
  }
  expect(total, "the matches should exercise thousands of id-bearing events").toBeGreaterThan(2000);
}, 120_000);

test("two copies of the same unit: a Command's damage names the copy it hit, and its sourceId is the cast's stackId", () => {
  const state = emptyState();
  const rng = new Rng(7);
  putUnit(state, "p2", failsafeUnit);
  const second = putUnit(state, "p2", failsafeUnit);
  state.players.p1.hand.push(diagnosticPulse);
  state.players.p1.energy = 1;
  state.players.p1.maxEnergy = 1;
  applyMove(state, { type: "playCard", handIndex: 0, target: { kind: "unit", instanceId: second.instanceId } }, rng);
  drainStack(state, rng);

  const cast = state.log.find((e): e is Extract<GameEvent, { type: "cast" }> => e.type === "cast")!;
  expect(cast.stackId).toMatch(/^c\d+$/);
  expect(cast.targetRef).toEqual({ kind: "unit", instanceId: second.instanceId });
  const trigger = state.log.find((e): e is Extract<GameEvent, { type: "abilityTrigger" }> => e.type === "abilityTrigger")!;
  expect(trigger.sourceId).toBe(cast.stackId);
  expect(trigger.targets).toEqual([{ kind: "unit", instanceId: second.instanceId }]);
  const dmg = state.log.find((e): e is Extract<GameEvent, { type: "damage" }> => e.type === "damage")!;
  expect(dmg.sourceId).toBe(cast.stackId);
  expect(dmg.targetRef).toEqual({ kind: "unit", instanceId: second.instanceId });
  const resolve = state.log.find((e): e is Extract<GameEvent, { type: "stackResolve" }> => e.type === "stackResolve")!;
  expect(resolve.stackId).toBe(cast.stackId);
  // The 2/2 dies; its death and its own onDeath draw both carry its old id.
  const death = state.log.find((e): e is Extract<GameEvent, { type: "death" }> => e.type === "death")!;
  expect(death.instanceId).toBe(second.instanceId);
  const deathTrigger = state.log.filter((e): e is Extract<GameEvent, { type: "abilityTrigger" }> => e.type === "abilityTrigger")[1]!;
  expect(deathTrigger.trigger).toBe("onDeath");
  expect(deathTrigger.sourceId).toBe(second.instanceId);
});

test("combat: attack, both damage events and the redirect carry exact ids, including face damage", () => {
  const state = emptyState();
  const rng = new Rng(41);
  const attacker = putUnit(state, "p1", aegisSentinel);
  attacker.permanentBuff.health = 10;
  putUnit(state, "p2", aegisWarden); // a decoy copy with the same name
  const guardian = putUnit(state, "p2", aegisWarden);

  applyMove(state, { type: "attack", attackerInstanceId: attacker.instanceId, target: { kind: "player", playerId: "p2" } }, rng);
  const attack = state.log.find((e): e is Extract<GameEvent, { type: "attack" }> => e.type === "attack")!;
  expect(attack.attackerId).toBe(attacker.instanceId);
  expect(attack.defenderRef).toEqual({ kind: "player", playerId: "p2" });
  expect(attack.stackId).toMatch(/^k\d+$/);

  applyMove(state, { type: "passPriority" }, rng);
  state.players.p2.hand.push(interceptRoutine);
  state.players.p2.energy = 1;
  state.players.p2.maxEnergy = 1;
  applyMove(state, { type: "playCard", handIndex: 0, target: { kind: "unit", instanceId: guardian.instanceId } }, rng);
  drainStack(state, rng);

  const redirect = state.log.find((e): e is Extract<GameEvent, { type: "attackRedirected" }> => e.type === "attackRedirected")!;
  expect(redirect.attackerId).toBe(attacker.instanceId);
  expect(redirect.fromRef).toEqual({ kind: "player", playerId: "p2" });
  expect(redirect.toRef).toEqual({ kind: "unit", instanceId: guardian.instanceId });
  const hits = state.log.filter((e): e is Extract<GameEvent, { type: "damage" }> => e.type === "damage");
  expect(hits.map((h) => [h.sourceId, h.targetRef])).toEqual([
    [attacker.instanceId, { kind: "unit", instanceId: guardian.instanceId }],
    [guardian.instanceId, { kind: "unit", instanceId: attacker.instanceId }],
  ]);
  const armor = state.log.find((e): e is Extract<GameEvent, { type: "baseArmorReduced" }> => e.type === "baseArmorReduced")!;
  expect(armor.unitId).toBe(attacker.instanceId);
  expect(armor.sourceId).toBe(guardian.instanceId);
  const resolves = state.log.filter((e): e is Extract<GameEvent, { type: "stackResolve" }> => e.type === "stackResolve");
  expect(resolves.map((r) => r.stackId)).toContain(attack.stackId);
});
