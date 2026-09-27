// EFFECTS.md slice 4 (attack travel + impact) and the Command flight.
// Three layers:
//  1. hand-built frames for every phase, including the two fizzle rules and
//     a redirect, in a mirror-style setup where names would collide;
//  2. the page embeds ATTACK_FX_SOURCE verbatim (single source, no mirror);
//  3. real matches with an ORACLE: each agent is wrapped so the test records
//     the exact move it submitted (attackerInstanceId + target come straight
//     from the engine's legal-move list), then checks every declared attack
//     the render draws is that exact attacker -> that exact target, that
//     every declaration strikes exactly once, and that what the strike says
//     happened (hit / fizzle) matches the engine's own log for that move.
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { Agent, GameEvent, Move } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "../src/engineInternal.js";
import { captureMatch } from "../src/capture.js";
import { ATTACK_FX_SOURCE, pendingAttacks, resolveAttacks } from "../src/attackFx.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import type { Frame, PlayerSnapshot, StackItemSnapshot, UnitSnapshot } from "../src/types.js";

function unit(iid: string, name: string, attack = 2): UnitSnapshot {
  return {
    instanceId: iid, cardId: name, name, faction: "Swarm", rarity: "Common", flavor: "", attack, health: 2, maxHealth: 2,
    keywords: [], pending: false, isEvolved: false, canAttackThisTurn: true, baseArmor: 0, barrierActive: false,
    printedAttack: attack, printedHealth: 2, turnBuff: { attack: 0, health: 0 }, tools: [], statuses: [], visualSeed: 0, visualPattern: 0,
  };
}
function player(id: "p1" | "p2", board: UnitSnapshot[]): PlayerSnapshot {
  return { id, name: id, faction: "Swarm", health: 20, maxHealth: 20, energy: 3, maxEnergy: 3, hand: [], deckSize: 10, graveyardSize: 0, board, directives: [], slotsUsed: board.length, slotsMax: 6 };
}
function frame(p1: UnitSnapshot[], p2: UnitSnapshot[], stack: StackItemSnapshot[]): Frame {
  return {
    index: 0, turnNumber: 5, activePlayer: "p1", priority: "p1", stack,
    players: { p1: player("p1", p1), p2: player("p2", p2) },
    newEvents: [], momentum: { score: 0, leader: "even", reasons: [] },
  };
}
const atk = (sid: string, attacker: string, target: StackItemSnapshot["target"], name = "Grunt"): StackItemSnapshot => ({
  kind: "combatDamage", stackId: sid, description: `${name}'s attack`, controller: "p1", attackerInstanceId: attacker, target,
});
const toUnit = (iid: string) => ({ kind: "unit" as const, instanceId: iid });
const toFace = (pid: "p1" | "p2") => ({ kind: "player" as const, playerId: pid });

describe("resolveAttacks — hand-built frames", () => {
  // Mirror-style board: both sides field a "Grunt"; only ids tell them apart.
  const mine = [unit("u1", "Grunt", 3), unit("u2", "Grunt", 1)];
  const theirs = [unit("u5", "Grunt", 2), unit("u6", "Wall", 0)];

  it("a new combat item is a declare, aimed at its exact target", () => {
    const prev = frame(mine, theirs, []);
    const next = frame(mine, theirs, [atk("k9", "u2", toUnit("u5"))]);
    expect(resolveAttacks(prev, next)).toEqual([
      { phase: "declare", stackId: "k9", owner: "p1", attackerIid: "u2", attackerName: "Grunt", target: toUnit("u5") },
    ]);
    expect(pendingAttacks(next)).toEqual([{ stackId: "k9", owner: "p1", attackerIid: "u2", target: toUnit("u5") }]);
  });

  it("the item persisting unchanged (responses stacking on top) produces nothing new", () => {
    const cmd: StackItemSnapshot = { kind: "command", stackId: "c3", description: "Purge", controller: "p2" };
    const prev = frame(mine, theirs, [atk("k9", "u2", toUnit("u5"))]);
    const next = frame(mine, theirs, [atk("k9", "u2", toUnit("u5")), cmd]);
    expect(resolveAttacks(prev, next)).toEqual([{ phase: "command", stackId: "c3", owner: "p2", card: "Purge" }]);
  });

  it("a changed target on the same item is a redirect, carrying the old target", () => {
    const prev = frame(mine, theirs, [atk("k9", "u1", toFace("p2"))]);
    const next = frame(mine, theirs, [atk("k9", "u1", toUnit("u6"))]);
    expect(resolveAttacks(prev, next)).toEqual([
      { phase: "redirect", stackId: "k9", owner: "p1", attackerIid: "u1", attackerName: "Grunt", target: toUnit("u6"), from: toFace("p2") },
    ]);
  });

  it("the item leaving is a strike; power comes from the pre-move board, counter only when the defender has attack", () => {
    const prev = frame(mine, theirs, [atk("k9", "u1", toUnit("u5"))]);
    const next = frame(mine, [theirs[1]!], []);
    expect(resolveAttacks(prev, next)).toEqual([
      { phase: "strike", stackId: "k9", owner: "p1", attackerIid: "u1", attackerName: "Grunt", target: toUnit("u5"), power: 3, counter: true, counterPower: 2, outcome: "hit" },
    ]);
    const intoWall = frame(mine, theirs, [atk("k8", "u1", toUnit("u6"))]);
    expect(resolveAttacks(intoWall, frame(mine, theirs, []))[0]).toMatchObject({ outcome: "hit", counter: false, counterPower: 0 });
    const face = frame(mine, theirs, [atk("k7", "u2", toFace("p2"))]);
    expect(resolveAttacks(face, frame(mine, theirs, []))[0]).toMatchObject({ outcome: "hit", power: 1, counter: false });
  });

  it("the engine's two fizzle rules: attacker gone, or unit target gone, before resolution", () => {
    const noAttacker = frame([mine[1]!], theirs, [atk("k9", "u1", toUnit("u5"))]);
    expect(resolveAttacks(noAttacker, frame([mine[1]!], theirs, []))[0]).toMatchObject({ phase: "strike", outcome: "fizzle-attacker" });
    const noTarget = frame(mine, [theirs[1]!], [atk("k9", "u1", toUnit("u5"))]);
    expect(resolveAttacks(noTarget, frame(mine, [theirs[1]!], []))[0]).toMatchObject({ phase: "strike", outcome: "fizzle-target" });
  });

  it("a strike and a new declaration in one move come out strike-first", () => {
    const prev = frame(mine, theirs, [atk("k9", "u1", toFace("p2"))]);
    const next = frame(mine, theirs, [atk("k10", "u2", toFace("p2"))]);
    expect(resolveAttacks(prev, next).map((x) => x.phase)).toEqual(["strike", "declare"]);
  });
});

describe("single source", () => {
  it("the page embeds ATTACK_FX_SOURCE verbatim", async () => {
    const replay = await captureMatch({
      title: "embed", seed: 1, deckA: buildSwarmDeck("p1", "S"), deckB: buildAegisDeck("p2", "A"),
      agentA: new LookaheadAgent("a", 3), agentB: new LookaheadAgent("b", 4), boardSlots: BOARD_SLOTS,
    });
    expect(renderMatchHtml(replay)).toContain(ATTACK_FX_SOURCE);
  });
});

/** Records every move an agent submits, in order. */
class RecordingAgent implements Agent {
  constructor(private inner: Agent, private log: Move[]) {}
  get name() { return this.inner.name; }
  async decideMove(...args: Parameters<Agent["decideMove"]>) {
    const m = await this.inner.decideMove(...args);
    this.log.push(m);
    return m;
  }
}

describe("real matches (oracle: the moves the agents actually submitted)", () => {
  it("every attack is drawn from the exact attacker to the exact target, and strikes exactly once", async () => {
    const builders = { Cortex: buildCortexDeck, Aegis: buildAegisDeck, Swarm: buildSwarmDeck, Null: buildNullDeck };
    const factions = Object.keys(builders) as (keyof typeof builders)[];
    const tally = { attackMoves: 0, declares: 0, strikes: 0, hits: 0, counters: 0, fizzles: 0, redirects: 0, commandsCast: 0, commandFx: 0, mirrorNameClash: 0 };
    for (const a of factions) {
      for (const b of factions) {
        for (const seed of [1, 2, 3]) {
          const moves: Move[] = [];
          const replay = await captureMatch({
            title: "attack-scan", seed,
            deckA: builders[a]("p1", a), deckB: builders[b]("p2", b),
            agentA: new RecordingAgent(new LookaheadAgent(`${a}-A`, seed * 2 + 1), moves),
            agentB: new RecordingAgent(new LookaheadAgent(`${b}-B`, seed * 2 + 2), moves),
            boardSlots: BOARD_SLOTS,
          });
          expect(moves.length).toBe(replay.frames.length - 1);
          const open = new Map<string, { attackerIid: string }>();
          for (let f = 1; f < replay.frames.length; f++) {
            const prev = replay.frames[f - 1]!;
            const next = replay.frames[f]!;
            const move = moves[f - 1]!;
            const events: GameEvent[] = next.newEvents.map((e) => e.event);
            const fxs = resolveAttacks(prev, next);
            const declares = fxs.filter((x) => x.phase === "declare");
            if (move.type === "attack") {
              tally.attackMoves++;
              // Exactly one declaration, and it is THIS move's attacker and target.
              expect(declares.length).toBe(1);
              expect(declares[0]!.attackerIid).toBe(move.attackerInstanceId);
              expect(declares[0]!.target).toEqual(move.target);
              const attackerName = [...prev.players.p1.board, ...prev.players.p2.board].find((u) => u.instanceId === move.attackerInstanceId)!.name;
              const sameName = [...prev.players.p1.board, ...prev.players.p2.board].filter((u) => u.name === attackerName).length;
              if (sameName > 1) tally.mirrorNameClash++;
            } else {
              expect(declares.length).toBe(0);
            }
            for (const d of declares) { tally.declares++; open.set(d.stackId, { attackerIid: d.attackerIid! }); }

            const redirects = fxs.filter((x) => x.phase === "redirect");
            expect(redirects.length).toBe(events.filter((e) => e.type === "attackRedirected").length);
            tally.redirects += redirects.length;

            const strikes = fxs.filter((x) => x.phase === "strike");
            expect(strikes.length).toBeLessThanOrEqual(1);
            for (const s of strikes) {
              tally.strikes++;
              expect(open.get(s.stackId)?.attackerIid).toBe(s.attackerIid);
              open.delete(s.stackId);
              const resolved = events.find((e) => e.type === "stackResolve");
              expect(resolved && resolved.type === "stackResolve" && resolved.description).toBe(`${s.attackerName}'s attack`);
              const fizzled = events.some((e) => e.type === "fizzle" && e.reason.startsWith(`${s.attackerName}'s attack fizzles`));
              if (s.outcome === "hit") {
                tally.hits++;
                if (s.counter) tally.counters++;
                expect(fizzled).toBe(false);
              } else {
                tally.fizzles++;
                expect(fizzled).toBe(true);
              }
            }

            const commandCasts = events.filter((e) => e.type === "cast" && !e.card.includes(" — "));
            const commandFx = fxs.filter((x) => x.phase === "command");
            expect(commandFx.map((x) => x.card)).toEqual(commandCasts.map((e) => (e.type === "cast" ? e.card : "")));
            tally.commandsCast += commandCasts.length;
            tally.commandFx += commandFx.length;
          }
          // Only an attack still pending when the game ended may stay open.
          const last = replay.frames[replay.frames.length - 1]!;
          for (const sid of open.keys()) expect(last.stack.some((s) => s.stackId === sid)).toBe(true);
        }
      }
    }
    expect(tally.declares).toBe(tally.attackMoves);
    expect(tally.strikes).toBeGreaterThan(tally.attackMoves * 0.95);
    expect(tally.counters).toBeGreaterThan(0);
    expect(tally.commandFx).toBe(tally.commandsCast);
    expect(tally.commandFx).toBeGreaterThan(0);
    expect(tally.mirrorNameClash).toBeGreaterThan(0);
    console.log("attackFx real-match tally", tally);
  }, 300_000);
});
