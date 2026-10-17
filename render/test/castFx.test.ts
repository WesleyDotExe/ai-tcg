// EFFECTS.md slice 3 (power / ability cast flourish). Four layers:
//  1. magnitude: castScore/castTier on the owner's named cases, and castTier
//     agrees with fxMagnitude's tierFromScore everywhere;
//  2. attribution on hand-built frames (the mirror-match cases a name-only
//     event log can't settle on its own);
//  3. the page embeds CAST_FX_SOURCE verbatim (single source, no mirror);
//  4. real matches with an ORACLE: the test wraps the engine's resolveAbility
//     (a test-only vi.mock — no engine file is touched) to record which
//     exact instance each logged abilityTrigger really came from, then
//     checks resolveCasts never points at the wrong card.
import { describe, expect, it, vi } from "vitest";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { GameEvent } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "../src/engineInternal.js";
import type { Faction, Rarity } from "../src/engineInternal.js";
import { captureMatch } from "../src/capture.js";
import { CAST_FX_SOURCE, castScore, castTier, resolveCasts } from "../src/castFx.js";
import { tierFromScore } from "../src/fxMagnitude.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import type { Frame, MatchReplay, PlayerSnapshot, UnitSnapshot } from "../src/types.js";

// Oracle: event object -> the instanceId of the source whose ability logged it.
const truth = vi.hoisted(() => new Map<object, string>());
vi.mock("../../engine/src/effects/resolver.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../engine/src/effects/resolver.js")>();
  return {
    ...mod,
    resolveAbility: (params: Parameters<typeof mod.resolveAbility>[0]) => {
      const before = params.state.log.length;
      mod.resolveAbility(params);
      const logged = params.state.log[before];
      if (logged && logged.type === "abilityTrigger" && "instanceId" in params.source) truth.set(logged, params.source.instanceId);
    },
  };
});

describe("castScore / castTier", () => {
  it("uses exactly fxMagnitude's tier thresholds", () => {
    for (let s = -1; s <= 5; s += 0.05) expect(castTier(s)).toBe(tierFromScore(s));
  });
  const tier = (r: Rarity, t: string) => castTier(castScore(r, t));
  it("routine recurring triggers stay subtle; a Mythic's power is spectacle", () => {
    expect(tier("Common", "onTurnEnd")).toBe("subtle");
    expect(tier("Uncommon", "onDamaged")).toBe("subtle");
    expect(tier("Common", "onPlay")).toBe("subtle");
    expect(tier("Mythic", "onPlay")).toBe("spectacle");
  });
  it("a deliberate cast reads louder than a passive trigger, and a response louder still", () => {
    expect(castScore("Common", "cast")).toBeGreaterThan(castScore("Common", "onPlay"));
    expect(castScore("Common", "response")).toBeGreaterThan(castScore("Common", "cast"));
    expect(tier("Common", "cast")).toBe("normal");
    expect(tier("Rare", "response")).toBe("spectacle");
  });
});

// ---- hand-built frames -------------------------------------------------

function unit(iid: string, name: string, p: Partial<UnitSnapshot> = {}): UnitSnapshot {
  return {
    instanceId: iid, cardId: name, name, faction: "Aegis", rarity: "Common", flavor: "", attack: 1, health: 2, maxHealth: 2,
    keywords: [], pending: false, isEvolved: false, canAttackThisTurn: true, baseArmor: 0, barrierActive: false,
    printedAttack: 1, printedHealth: 2, turnBuff: { attack: 0, health: 0 }, tools: [], statuses: [], visualSeed: 0, visualPattern: 0, ...p,
  };
}
function player(id: "p1" | "p2", board: UnitSnapshot[]): PlayerSnapshot {
  return { id, name: id, faction: "Aegis", health: 20, maxHealth: 20, energy: 3, maxEnergy: 3, hand: [], deckSize: 10, graveyardSize: 0, board, directives: [], slotsUsed: board.length, slotsMax: 6 };
}
function frame(p1: UnitSnapshot[], p2: UnitSnapshot[], events: GameEvent[], extra: Partial<Frame> = {}): Frame {
  return {
    index: 0, turnNumber: 3, activePlayer: "p1", priority: "p1", stack: [],
    players: { p1: player("p1", p1), p2: player("p2", p2) },
    newEvents: events.map((event) => ({ event, text: "" })),
    momentum: { score: 0, leader: "even", reasons: [] },
    ...extra,
  };
}
const F: Record<string, Faction> = { Sentry: "Aegis", Purge: "Null" };
const R: Record<string, Rarity> = { Sentry: "Common", Purge: "Rare" };
const trig = (source: string, trigger: string, ability = "a1"): GameEvent => ({ type: "abilityTrigger", source, ability, trigger });

describe("resolveCasts on hand-built frames", () => {
  it("a mirror onPlay is pinned to the instance the play event names, not the other copy", () => {
    const prev = frame([], [unit("u1", "Sentry")], []);
    const next = frame([unit("u5", "Sentry")], [unit("u1", "Sentry")], [
      { type: "play", player: "p1", card: "Sentry", instanceId: "u5" },
      trig("Sentry", "onPlay"),
    ]);
    const [fx] = resolveCasts(prev, next, F, R);
    expect(fx).toMatchObject({ anchor: "card", iid: "u5", owner: "p1", candidates: 2, label: "ON PLAY", faction: "Aegis" });
  });
  it("onDeath is pinned to the copy that left the board, with departed=true", () => {
    const prev = frame([unit("u1", "Sentry")], [unit("u2", "Sentry")], []);
    const next = frame([unit("u1", "Sentry")], [], [{ type: "death", unit: "Sentry", controller: "p2" }, trig("Sentry", "onDeath")]);
    expect(resolveCasts(prev, next, F, R)[0]).toMatchObject({ anchor: "card", iid: "u2", owner: "p2", departed: true });
  });
  it("turn triggers only look at the turn owner's side, and pair copies to events in board order", () => {
    const board = [unit("u1", "Sentry"), unit("u3", "Sentry")];
    const prev = frame(board, [unit("u2", "Sentry")], []);
    const next = frame(board, [unit("u2", "Sentry")], [
      { type: "turnEnd", turn: 3, player: "p1" },
      trig("Sentry", "onTurnEnd"),
      trig("Sentry", "onTurnEnd"),
    ]);
    const out = resolveCasts(prev, next, F, R);
    expect(out.map((x) => x.iid)).toEqual(["u1", "u3"]);
  });
  it("when copies can't be paired (one copy's trigger didn't log), it's an honest side banner, not a guess", () => {
    const board = [unit("u1", "Sentry"), unit("u3", "Sentry")];
    const next = frame(board, [], [{ type: "turnEnd", turn: 3, player: "p1" }, trig("Sentry", "onTurnEnd")]);
    expect(resolveCasts(frame(board, [], []), next, F, R)[0]).toMatchObject({ anchor: "banner", owner: "p1" });
  });
  it("a resolving activated ability lands on the exact source the stack item named", () => {
    const board = [unit("u1", "Sentry"), unit("u3", "Sentry")];
    const prev = frame(board, [], [], { stack: [{ kind: "ability", stackId: "a1", description: "Sentry — do a thing", controller: "p1", sourceInstanceId: "u3" }] });
    const next = frame(board, [], [trig("Sentry", "activated")]);
    expect(resolveCasts(prev, next, F, R)[0]).toMatchObject({ anchor: "card", iid: "u3", label: "ACTIVATE" });
  });
  it("a Command casts from its own stack entry, and an off-turn Instant reads as a RESPONSE", () => {
    const prev = frame([], [], []);
    const next = frame([], [], [{ type: "cast", player: "p2", card: "Purge", speed: "Instant" }], {
      stack: [{ kind: "command", stackId: "c9", description: "Purge", controller: "p2" }],
    });
    const [fx] = resolveCasts(prev, next, F, R);
    expect(fx).toMatchObject({ kind: "announce", anchor: "stack", stackId: "c9", owner: "p2", label: "RESPONSE", faction: "Null", rarity: "Rare", tier: "spectacle" });
    const onTurn = frame([], [], [{ type: "cast", player: "p1", card: "Purge", speed: "Instant" }]);
    expect(resolveCasts(prev, onTurn, F, R)[0]).toMatchObject({ label: "CAST", tier: "normal" });
  });
  it("the Command resolving plays on the stack entry it resolved from", () => {
    const prev = frame([], [], [], { stack: [{ kind: "command", stackId: "c9", description: "Purge", controller: "p2" }] });
    const next = frame([], [], [{ type: "stackResolve", description: "Purge" }, trig("Purge", "onPlay")]);
    expect(resolveCasts(prev, next, F, R)[0]).toMatchObject({ kind: "trigger", anchor: "stack", stackId: "c9", owner: "p2", label: "RESOLVE" });
  });
});

describe("single source", () => {
  it("the page carries CAST_FX_SOURCE verbatim", () => {
    const stub = { title: "t", seed: 0, frames: [] } as unknown as MatchReplay;
    expect(renderMatchHtml(stub)).toContain(CAST_FX_SOURCE);
  });
});

describe("real matches (oracle: the engine's own resolveAbility source)", () => {
  it("never pins a flourish on the wrong instance, and accounts for every trigger and cast", async () => {
    const builders = { Cortex: buildCortexDeck, Aegis: buildAegisDeck, Swarm: buildSwarmDeck, Null: buildNullDeck };
    const factions = Object.keys(builders) as (keyof typeof builders)[];
    const tally = { triggers: 0, quiet: 0, casts: 0, fx: 0, oracleChecked: 0, oracleNarrowed: 0, banners: 0, stack: 0, stackMissingId: 0, departedChecked: 0 };
    for (const a of factions) {
      for (const b of factions) {
        for (const seed of [1, 2, 3]) {
          truth.clear();
          const replay = await captureMatch({
            title: "cast-scan", seed,
            deckA: builders[a]("p1", a), deckB: builders[b]("p2", b),
            agentA: new LookaheadAgent(`${a}-A`, seed * 2 + 1), agentB: new LookaheadAgent(`${b}-B`, seed * 2 + 2),
            boardSlots: BOARD_SLOTS,
          });
          for (let f = 1; f < replay.frames.length; f++) {
            const prev = replay.frames[f - 1]!;
            const next = replay.frames[f]!;
            const events = next.newEvents.map((e) => e.event);
            // The triggers the feed dropped as quiet get no flourish
            // (render session 23); every other trigger gets exactly one.
            const quiet = new Set(next.quietTriggers ?? []);
            for (const k of quiet) expect(events[k]!.type).toBe("abilityTrigger");
            tally.quiet += quiet.size;
            const triggers = events.filter((e, k) => e.type === "abilityTrigger" && !quiet.has(k));
            tally.triggers += triggers.length;
            tally.casts += events.filter((e) => e.type === "cast").length;
            const fxs = resolveCasts(prev, next, replay.cardFactions, replay.cardRarities);
            tally.fx += fxs.length;
            const triggerFx = fxs.filter((x) => x.kind === "trigger");
            expect(triggerFx.length).toBe(triggers.length);
            // Without the list, the quiet ones are back: the skip is the
            // list's doing, and the narrowing still places them right.
            const allTriggers = events.filter((e) => e.type === "abilityTrigger");
            const allFx = resolveCasts(prev, { ...next, quietTriggers: undefined }, replay.cardFactions, replay.cardRarities).filter((x) => x.kind === "trigger");
            expect(allFx.length).toBe(triggers.length + quiet.size);
            allFx.forEach((fx, k) => {
              const real = truth.get(allTriggers[k]!);
              if (real !== undefined && fx.anchor === "card") expect(fx.iid).toBe(real);
            });
            triggerFx.forEach((fx, k) => {
              const ev = triggers[k]!;
              if (fx.anchor === "banner") tally.banners++;
              if (fx.anchor === "stack") { tally.stack++; if (!fx.stackId) tally.stackMissingId++; }
              const real = truth.get(ev);
              if (real !== undefined && fx.anchor === "card") {
                expect(fx.iid).toBe(real);
                tally.oracleChecked++;
                if (fx.candidates > 1) tally.oracleNarrowed++;
              }
              if (fx.departed) {
                const wasThere = [...prev.players.p1.board, ...prev.players.p2.board, ...prev.players.p1.directives, ...prev.players.p2.directives].some((u) => u.instanceId === fx.iid && u.name === fx.source);
                expect(wasThere).toBe(true);
                tally.departedChecked++;
              }
            });
          }
        }
      }
    }
    expect(tally.fx).toBe(tally.triggers + tally.casts);
    expect(tally.quiet).toBeGreaterThan(0);
    expect(tally.oracleChecked).toBeGreaterThan(100);
    expect(tally.oracleNarrowed).toBeGreaterThan(10);
    expect(tally.stack).toBeGreaterThan(0);
    // Every Command flourish found its exact stack entry.
    expect(tally.stackMissingId).toBe(0);
    expect(tally.departedChecked).toBeGreaterThan(0);
    console.log("castFx real-match tally", tally);
  }, 300_000);
});
