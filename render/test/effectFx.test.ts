// EFFECTS.md v2 slice 2: effectFx.ts pairs every ability effect with its
// exact source and target from the event log's instance ids. Two layers:
//  1. hand-built moves pin each rule (what counts as a spell vs combat
//     damage, buff vs debuff, a removal, a Command source, a self-target);
//  2. real matches, all 16 faction pairings: every pairing it reports is
//     backed by an event carrying those exact ids, and every end is a real
//     card on the board before or after the move.
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { DeckSpec, GameEvent } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "../src/engineInternal.js";
import type { DeckFaction } from "../src/engineInternal.js";
import { captureMatch } from "../src/capture.js";
import { EFFECT_FX_SOURCE, resolveEffects } from "../src/effectFx.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import type { Frame, MatchReplay } from "../src/types.js";

function frame(events: GameEvent[], stack: Frame["stack"] = []): Frame {
  return {
    index: 0, turnNumber: 1, activePlayer: "p1", priority: "p1", stack,
    players: { p1: {} as Frame["players"]["p1"], p2: {} as Frame["players"]["p2"] },
    newEvents: events.map((event) => ({ event, text: "" })),
    momentum: { score: 0, leader: "even", reasons: [] },
  };
}
const empty = frame([]);
const trig = (sourceId: string, source: string, targets: { kind: "unit"; instanceId: string }[] = []): GameEvent =>
  ({ type: "abilityTrigger", source, ability: `${source}-x`, trigger: "onPlay", sourceId, targets });
const unit = (instanceId: string) => ({ kind: "unit" as const, instanceId });

describe("rules (hand-built moves)", () => {
  it("an ability's damage is a spell from its exact source to its exact target", () => {
    const fx = resolveEffects(empty, frame([
      trig("u3", "Perimeter Turret", [unit("u9")]),
      { type: "damage", target: "Glitch Seed", targetKind: "unit", amount: 3, source: "Perimeter Turret", sourceId: "u3", targetRef: unit("u9") },
    ]));
    expect(fx).toEqual([{ category: "spell", source: unit("u3"), target: unit("u9"), self: false, sourceName: "Perimeter Turret", ability: "Perimeter Turret-x", amount: 3 }]);
  });

  it("combat damage is never read as a spell, even from a unit that has abilities", () => {
    const fx = resolveEffects(empty, frame([
      trig("u3", "Watchtower Relay"),
      { type: "attack", attacker: "Watchtower Relay", defender: "Zombie Process", defenderKind: "unit", attackerId: "u3", defenderRef: unit("u2"), stackId: "k8" },
      { type: "stackResolve", description: "Watchtower Relay's attack", stackId: "k8" },
      { type: "damage", target: "Zombie Process", targetKind: "unit", amount: 2, source: "Watchtower Relay", sourceId: "u3", targetRef: unit("u2") },
      { type: "damage", target: "Watchtower Relay", targetKind: "unit", amount: 2, source: "Zombie Process", sourceId: "u2", targetRef: unit("u3") },
    ]));
    expect(fx).toEqual([]);
  });

  it("an onDeath ability after combat still pairs (source = the dead unit's id), and a context never leaks to another source", () => {
    const fx = resolveEffects(empty, frame([
      { type: "stackResolve", description: "x's attack", stackId: "k1" },
      { type: "damage", target: "Spore Cluster", targetKind: "unit", amount: 2, source: "Hired Blade", sourceId: "u5", targetRef: unit("u4") },
      { type: "death", unit: "Spore Cluster", controller: "p2", instanceId: "u4" },
      trig("u4", "Spore Cluster"),
      { type: "damage", target: "Hired Blade", targetKind: "unit", amount: 1, source: "Spore Cluster", sourceId: "u4", targetRef: unit("u5") },
      // Same move, a different source with no trigger of its own: ignored.
      { type: "damage", target: "Hired Blade", targetKind: "unit", amount: 1, source: "Other", sourceId: "u7", targetRef: unit("u5") },
    ]));
    expect(fx.map((f) => [f.category, f.source, f.target, f.amount])).toEqual([["spell", unit("u4"), unit("u5"), 1]]);
  });

  it("splits stat shifts into buff / debuff by their sign, and statuses by protection", () => {
    const fx = resolveEffects(empty, frame([
      trig("u1", "Hotfix"),
      { type: "buff", target: "A", attack: 1, health: 2, source: "Hotfix", sourceId: "u1", targetId: "u2" },
      { type: "buff", target: "B", attack: -2, health: 0, source: "Hotfix", sourceId: "u1", targetId: "u3" },
      { type: "statusApplied", target: "C", status: "Barrier", source: "Hotfix", sourceId: "u1", targetId: "u4" },
      { type: "statusApplied", target: "D", status: "Stasis", source: "Hotfix", sourceId: "u1", targetId: "u5" },
      { type: "heal", target: "E", targetKind: "unit", amount: 2, source: "Hotfix", sourceId: "u1", targetRef: unit("u6") },
    ]));
    expect(fx.map((f) => [f.category, (f.target as { instanceId: string }).instanceId, f.amount, f.status])).toEqual([
      ["buff", "u2", 3, undefined], ["debuff", "u3", 2, undefined], ["buff", "u4", 0, "Barrier"], ["debuff", "u5", 0, "Stasis"], ["heal", "u6", 2, undefined],
    ]);
  });

  it("a Command's source is its stack entry, owned by its caster; a player can be the target", () => {
    const stack = [{ kind: "command" as const, stackId: "c26", description: "Interrupt Handler", controller: "p1" as const }];
    const fx = resolveEffects(frame([], stack), frame([
      trig("c26", "Interrupt Handler", [unit("u22")]),
      { type: "damage", target: "Lookahead-Null", targetKind: "player", amount: 2, source: "Interrupt Handler", sourceId: "c26", targetRef: { kind: "player", playerId: "p2" } },
    ]));
    expect(fx[0]!.source).toEqual({ kind: "stack", stackId: "c26", owner: "p1" });
    expect(fx[0]!.target).toEqual({ kind: "player", playerId: "p2" });
  });

  it("a removal is a targeted unit that died without taking damage; a damage kill is not", () => {
    const fx = resolveEffects(empty, frame([
      trig("c9", "Kernel Panic", [unit("u7"), unit("u8")]),
      { type: "damage", target: "B", targetKind: "unit", amount: 5, source: "Kernel Panic", sourceId: "c9", targetRef: unit("u8") },
      { type: "death", unit: "A", controller: "p2", instanceId: "u7" },
      { type: "death", unit: "B", controller: "p2", instanceId: "u8" },
      trig("u7", "A"),
    ]));
    expect(fx.map((f) => [f.category, (f.target as { instanceId: string }).instanceId])).toEqual([["spell", "u8"], ["removal", "u7"]]);
  });

  it("a destroyed Directive is a removal of that Directive", () => {
    const fx = resolveEffects(empty, frame([
      trig("c4", "Force Quit", [{ kind: "unit", instanceId: "d27" }]),
      { type: "directiveDestroyed", directive: "Tariff Field", controller: "p2", source: "Force Quit", sourceId: "c4", instanceId: "d27" },
    ]));
    expect(fx).toHaveLength(1);
    expect(fx[0]!.category).toBe("removal");
    expect(fx[0]!.target).toEqual(unit("d27"));
  });

  it("marks a self-target, merges repeats of one pairing, and ignores events with no source id", () => {
    const fx = resolveEffects(empty, frame([
      trig("u16", "Diagnostic Loop", [unit("u16")]),
      { type: "heal", target: "Diagnostic Loop", targetKind: "unit", amount: 1, source: "Diagnostic Loop", sourceId: "u16", targetRef: unit("u16") },
      { type: "heal", target: "Diagnostic Loop", targetKind: "unit", amount: 2, source: "Diagnostic Loop", sourceId: "u16", targetRef: unit("u16") },
      { type: "damage", target: "Overload Capacitor", targetKind: "unit", amount: 1, source: "Overload", targetRef: unit("u7") },
    ]));
    expect(fx).toHaveLength(1);
    expect(fx[0]).toMatchObject({ category: "heal", self: true, amount: 3 });
  });
});

const DECKS: Record<DeckFaction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck, Aegis: buildAegisDeck, Swarm: buildSwarmDeck, Null: buildNullDeck,
};

describe("real matches (all 16 pairings)", () => {
  it("every pairing is backed by an event with those exact ids, and every end is a real card", async () => {
    const seen: Record<string, number> = {};
    let total = 0;
    for (const a of Object.keys(DECKS) as DeckFaction[]) for (const b of Object.keys(DECKS) as DeckFaction[]) {
      const replay = await captureMatch({
        title: `${a} v ${b}`, seed: 1, deckA: DECKS[a]("p1", a), deckB: DECKS[b]("p2", b),
        agentA: new LookaheadAgent("A", 3), agentB: new LookaheadAgent("B", 4), boardSlots: BOARD_SLOTS,
      });
      for (let i = 1; i < replay.frames.length; i++) {
        const prev = replay.frames[i - 1]!, next = replay.frames[i]!;
        const evs = next.newEvents.map((e) => e.event);
        const onBoard = (iid: string) => [prev, next].some((f) => (["p1", "p2"] as const).some((p) =>
          f.players[p].board.some((u) => u.instanceId === iid) || f.players[p].directives.some((d) => d.instanceId === iid)));
        for (const fx of resolveEffects(prev, next)) {
          total++;
          seen[fx.category] = (seen[fx.category] ?? 0) + 1;
          expect(replay.cardFactions[fx.sourceName], fx.sourceName).toBeTruthy();
          const srcId = fx.source.kind === "stack" ? fx.source.stackId : fx.source.kind === "unit" ? fx.source.instanceId : null;
          expect(srcId).toBeTruthy();
          if (fx.source.kind === "unit") expect(onBoard(fx.source.instanceId), `source ${fx.source.instanceId}`).toBe(true);
          if (fx.target.kind === "unit") expect(onBoard(fx.target.instanceId), `target ${fx.target.instanceId}`).toBe(true);
          // The trigger that opened this ability carries the same source id.
          expect(evs.some((e) => e.type === "abilityTrigger" && e.sourceId === srcId && e.source === fx.sourceName)).toBe(true);
          const tid = fx.target.kind === "unit" ? fx.target.instanceId : fx.target.kind === "player" ? fx.target.playerId : "";
          const backed = evs.some((e) => {
            if (fx.category === "spell") return e.type === "damage" && e.sourceId === srcId && (e.targetRef?.kind === "player" ? e.targetRef.playerId : e.targetRef?.instanceId) === tid;
            if (fx.category === "heal") return e.type === "heal" && e.sourceId === srcId && (e.targetRef?.kind === "player" ? e.targetRef.playerId : e.targetRef?.instanceId) === tid;
            if (fx.category === "removal") return (e.type === "death" && e.instanceId === tid) || (e.type === "directiveDestroyed" && e.instanceId === tid && e.sourceId === srcId);
            return (e.type === "buff" || e.type === "statusApplied") && e.sourceId === srcId && e.targetId === tid;
          });
          expect(backed, `${fx.category} ${fx.sourceName} -> ${tid}`).toBe(true);
        }
      }
    }
    // The pool really exercises the categories the page draws.
    expect(total).toBeGreaterThan(40);
    for (const c of ["spell", "heal", "buff", "debuff"]) expect(seen[c], c).toBeGreaterThan(0);
  }, 120_000);
});

describe("the page", () => {
  it("embeds the resolver verbatim and draws every effect on the canvas from its exact ends", () => {
    const html = renderMatchHtml({
      title: "fx", seed: 1, factions: { p1: "Cortex", p2: "Aegis" }, movesPlayed: 0, frames: [],
      identities: { p1: { username: "a", avatarSvg: "<svg></svg>" }, p2: { username: "b", avatarSvg: "<svg></svg>" } },
      cardFactions: {}, cardRarities: {},
    } as unknown as MatchReplay);
    expect(html).toContain(EFFECT_FX_SOURCE);
    expect(html).toContain("const effects = resolveEffects(prevFrame, newFrame);");
    expect(html).toContain("CFX.effect(e.category, fromR, toR, f, tier, effT,");
    // A death shatters on the canvas when it can, else the v1 fade + burst.
    expect(html).toContain("if (kill && CFX.kill(rect, kill.killer, kill.victim, tier))");
    // The canvas buff/debuff stands the v1 motes down; the label stays.
    expect(html).toContain("if (!onCanvas) spawnMotes(");
  });
});
