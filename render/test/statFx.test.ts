// EFFECTS.md slice 2 (buff rise / penalty sink). Three layers:
//  1. the pure classifier on hand-built cases, including the two real
//     misreads this slice fixes (debuff drawn as a buff, +HP buff drawn as a
//     heal);
//  2. parity — the hand-mirrored copy inside the generated page's inline
//     <script> gives the same answers as the TS module on every case;
//  3. real matches — classify actual frame pairs captured from real engine
//     play and check them against what the engine's own event log says
//     happened.
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, RandomAgent, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { GameEvent } from "@ai-tcg/engine";
import { buildNullDeck } from "../src/engineInternal.js";
import { captureMatch } from "../src/capture.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import { statShiftScore } from "../src/fxMagnitude.js";
import { classifyStatShift, healthResidual, statLabel, tintFaction } from "../src/statFx.js";
import type { StatSide } from "../src/statFx.js";
import type { MatchReplay, UnitSnapshot } from "../src/types.js";

function side(p: Partial<StatSide>): StatSide {
  return { attack: 2, maxHealth: 3, turnBuffAttack: 0, turnBuffHealth: 0, statuses: [], ...p };
}

const CASES: { name: string; prev: StatSide; next: StatSide }[] = [
  { name: "no change", prev: side({}), next: side({}) },
  { name: "+2 ATK permanent", prev: side({}), next: side({ attack: 4 }) },
  { name: "+0/+2 HP buff", prev: side({}), next: side({ maxHealth: 5 }) },
  { name: "-2/-2 shrink", prev: side({}), next: side({ attack: 0, maxHealth: 1 }) },
  { name: "-1 ATK aura", prev: side({}), next: side({ attack: 1 }) },
  { name: "Stasis applied", prev: side({}), next: side({ statuses: ["Stasis"] }) },
  { name: "Overload applied alongside -1 ATK", prev: side({}), next: side({ attack: 1, statuses: ["Overload"] }) },
  { name: "Barrier gained is not a penalty", prev: side({}), next: side({ statuses: ["Barrier"] }) },
  { name: "existing Stasis ticking is not re-announced", prev: side({ statuses: ["Stasis"] }), next: side({ statuses: ["Stasis"] }) },
  { name: "turn buff +2 ATK expires", prev: side({ attack: 4, turnBuffAttack: 2 }), next: side({ attack: 2 }) },
  { name: "turn debuff -1 ATK expires", prev: side({ attack: 1, turnBuffAttack: -1 }), next: side({ attack: 2 }) },
  { name: "turn buff applied this move", prev: side({}), next: side({ attack: 3, turnBuffAttack: 1 }) },
  { name: "mixed +2/-1 nets positive", prev: side({}), next: side({ attack: 4, maxHealth: 2 }) },
  { name: "even trade +1/-1 reads as buff (attack decides)", prev: side({}), next: side({ attack: 3, maxHealth: 2 }) },
  { name: "even trade -1/+1 reads as penalty", prev: side({}), next: side({ attack: 1, maxHealth: 4 }) },
  { name: "expiry masked by a clamp at 0 is not reported", prev: side({ attack: 0, turnBuffAttack: -1 }), next: side({ attack: 0 }) },
];

describe("classifyStatShift", () => {
  const byName = Object.fromEntries(CASES.map((c) => [c.name, classifyStatShift(c.prev, c.next)]));

  it("returns null when nothing buff/penalty-shaped happened", () => {
    expect(byName["no change"]).toBeNull();
    expect(byName["Barrier gained is not a penalty"]).toBeNull();
    expect(byName["existing Stasis ticking is not re-announced"]).toBeNull();
    expect(byName["expiry masked by a clamp at 0 is not reported"]).toBeNull();
  });
  it("a debuff is a penalty, never a buff (the invariant the old gold flash broke)", () => {
    expect(byName["-2/-2 shrink"]).toMatchObject({ kind: "penalty", attack: -2, health: -2, label: "-2/-2" });
    expect(byName["-1 ATK aura"]).toMatchObject({ kind: "penalty", label: "-1 ATK" });
  });
  it("a +HP buff is a buff (the old render drew it as a heal)", () => {
    expect(byName["+0/+2 HP buff"]).toMatchObject({ kind: "buff", attack: 0, health: 2, label: "+2 HP" });
  });
  it("new penalty statuses are penalties and appear in the label", () => {
    expect(byName["Stasis applied"]).toMatchObject({ kind: "penalty", newStatuses: ["Stasis"], label: "STASIS" });
    expect(byName["Overload applied alongside -1 ATK"]).toMatchObject({ kind: "penalty", label: "-1 ATK OVERLOAD" });
  });
  it("a temporary buff or debuff wearing off is an expiry, not a penalty/buff", () => {
    expect(byName["turn buff +2 ATK expires"]).toMatchObject({ kind: "expire", attack: -2, label: "-2 ATK" });
    expect(byName["turn debuff -1 ATK expires"]).toMatchObject({ kind: "expire", attack: 1 });
    expect(byName["turn buff applied this move"]).toMatchObject({ kind: "buff", attack: 1 });
  });
  it("mixed shifts are judged by their net direction", () => {
    expect(byName["mixed +2/-1 nets positive"]).toMatchObject({ kind: "buff", label: "+2/-1" });
    expect(byName["even trade +1/-1 reads as buff (attack decides)"]?.kind).toBe("buff");
    expect(byName["even trade -1/+1 reads as penalty"]?.kind).toBe("penalty");
  });
});

describe("healthResidual / statLabel / tintFaction", () => {
  it("separates damage and heal from maxHealth changes exactly", () => {
    expect(healthResidual(3, 5, 3, 5)).toBe(0); // +0/+2 buff: no heal
    expect(healthResidual(3, 1, 3, 1)).toBe(0); // -0/-2 shrink: no hit
    expect(healthResidual(3, 1, 3, 3)).toBe(-2); // plain 2 damage
    expect(healthResidual(1, 3, 3, 3)).toBe(2); // plain 2 heal
    expect(healthResidual(3, 2, 3, 5)).toBe(-3); // buffed +2 AND hit for 3 in one move
  });
  it("labels", () => {
    expect(statLabel(1, 0)).toBe("+1 ATK");
    expect(statLabel(0, -3)).toBe("-3 HP");
    expect(statLabel(2, 2)).toBe("+2/+2");
  });
  it("tints by the source's faction when known, else by the side that usually causes it", () => {
    expect(tintFaction("penalty", "Aegis", "Null", "Cortex")).toBe("Cortex");
    expect(tintFaction("penalty", "Aegis", "Null")).toBe("Null");
    expect(tintFaction("buff", "Aegis", "Null")).toBe("Aegis");
  });
});

describe("inline-script mirror parity", () => {
  // Extract the hand-mirrored block from a real generated page and run it.
  const stub = { title: "t", seed: 0, frames: [] } as unknown as MatchReplay;
  const html = renderMatchHtml(stub);
  const block = html.slice(html.indexOf("// BEGIN statFx mirror"), html.indexOf("// END statFx mirror"));
  const mirror = new Function(`${block}; return { classifyStatShift, healthResidual, statLabel, tintFaction };`)() as {
    classifyStatShift: typeof classifyStatShift;
    healthResidual: typeof healthResidual;
    statLabel: typeof statLabel;
    tintFaction: typeof tintFaction;
  };

  it("found the mirror block", () => {
    expect(block.length).toBeGreaterThan(200);
  });
  for (const c of CASES) {
    it(`classifies "${c.name}" identically`, () => {
      expect(mirror.classifyStatShift(c.prev, c.next)).toEqual(classifyStatShift(c.prev, c.next));
    });
  }
  it("statShiftScore matches fxMagnitude.ts across its whole input grid", () => {
    const from = html.indexOf("function statShiftScore");
    const src = html.slice(from, html.indexOf("\n  }\n", from) + 4);
    const inline = new Function(`${src}; return statShiftScore;`)() as typeof statShiftScore;
    for (const kind of ["buff", "penalty", "expire"] as const)
      for (let total = 0; total <= 7; total++)
        for (let statuses = 0; statuses <= 2; statuses++)
          for (let units = 1; units <= 6; units++)
            expect(inline(kind, total, statuses, units)).toBe(statShiftScore(kind, total, statuses, units));
  });
  it("healthResidual / statLabel / tintFaction match", () => {
    expect(mirror.healthResidual(3, 2, 3, 5)).toBe(healthResidual(3, 2, 3, 5));
    expect(mirror.statLabel(-2, -2)).toBe(statLabel(-2, -2));
    expect(mirror.tintFaction("penalty", "Aegis", "Null", undefined)).toBe(tintFaction("penalty", "Aegis", "Null"));
  });
});

function sideOf(u: UnitSnapshot): StatSide {
  return {
    attack: u.attack,
    maxHealth: u.maxHealth,
    turnBuffAttack: u.turnBuff.attack,
    turnBuffHealth: u.turnBuff.health,
    statuses: u.statuses.map((s) => s.kind),
  };
}

describe("real matches (engine event log is the referee)", () => {
  it("every unambiguous engine buff event is classified in its own direction; statuses and expiries show up too", async () => {
    const tally = { penaltyChecked: 0, buffChecked: 0, statusChecked: 0, expiries: 0, residualHits: 0 };
    const matchups = [
      [buildNullDeck, buildCortexDeck],
      [buildAegisDeck, buildSwarmDeck],
      [buildCortexDeck, buildNullDeck],
      [buildAegisDeck, buildNullDeck],
    ] as const;
    for (let seed = 1; seed <= 12; seed++) {
      for (const [a, b] of matchups) {
        const replay = await captureMatch({
          title: "statfx-scan",
          seed,
          deckA: a("p1", "A"),
          deckB: b("p2", "B"),
          agentA: new RandomAgent("A", seed),
          agentB: new RandomAgent("B", seed + 500),
          boardSlots: BOARD_SLOTS,
        });
        for (let f = 1; f < replay.frames.length; f++) {
          const prev = replay.frames[f - 1]!;
          const next = replay.frames[f]!;
          const prevUnits = new Map<string, UnitSnapshot>();
          for (const pid of ["p1", "p2"] as const) for (const u of prev.players[pid].board) prevUnits.set(u.instanceId, u);
          const nextUnits: UnitSnapshot[] = [...next.players.p1.board, ...next.players.p2.board];
          const events = next.newEvents.map((e) => e.event);
          // Only single-effect moves on a uniquely named unit, so the check
          // can't be confused by the event log's name-only identity or by
          // two effects landing together.
          const buffs = events.filter((e): e is Extract<GameEvent, { type: "buff" }> => e.type === "buff");
          // Moves where something could ALSO shift stats without a buff event
          // (a static aura entering/leaving, a tool, a turn-buff expiry) are
          // skipped for the direction check — the event log can't referee them.
          const auraNoise = events.some((e) => ["toolAttached", "play", "summon", "death", "turnEnd", "evolve"].includes(e.type));
          for (const u of nextUnits) {
            const p = prevUnits.get(u.instanceId);
            if (!p || p.cardId !== u.cardId) continue;
            const shift = classifyStatShift(sideOf(p), sideOf(u));
            const named = nextUnits.filter((x) => x.name === u.name).length === 1;
            // "Visibly": a stat-scaling override (e.g. Overclock Beast, SW-004)
            // can swallow a buff whole — the engine logs it, the board doesn't
            // move, and drawing nothing is the truthful render.
            const visiblyMoved = p.attack !== u.attack || p.maxHealth !== u.maxHealth;
            const mine = buffs.filter((b) => b.target === u.name);
            if (mine.length > 0 && named && visiblyMoved && !auraNoise) {
              if (mine.every((b) => b.attack + b.health < 0)) {
                expect(shift?.kind).toBe("penalty");
                tally.penaltyChecked++;
              } else if (mine.every((b) => b.attack + b.health > 0)) {
                expect(shift?.kind).toBe("buff");
                tally.buffChecked++;
              }
            }
            const applied = events.find((e) => e.type === "statusApplied" && e.target === u.name && (e.status === "Stasis" || e.status === "Overload"));
            if (applied && named && !p.statuses.some((s) => s.kind === (applied as { status: string }).status)) {
              expect(shift?.kind).toBe("penalty");
              tally.statusChecked++;
            }
            if (shift?.kind === "expire") {
              expect(events.some((e) => e.type === "turnEnd")).toBe(true);
              tally.expiries++;
            }
            // A plain hit (stats otherwise untouched) must read as damage
            // only — never as a penalty. (Static auras CAN legitimately shift
            // a unit's ATK in the same move it's hit; that's excluded here.)
            const statsSteady = p.attack === u.attack && p.maxHealth === u.maxHealth && p.statuses.length === u.statuses.length;
            if (events.some((e) => e.type === "damage" && e.targetKind === "unit") && buffs.length === 0 && u.health < p.health && statsSteady) {
              expect(healthResidual(p.health, u.health, p.maxHealth, u.maxHealth)).toBeLessThan(0);
              expect(shift).toBeNull();
              tally.residualHits++;
            }
          }
        }
      }
    }
    // Each real path must actually have been exercised, not vacuously passed.
    expect(tally.penaltyChecked).toBeGreaterThan(0);
    expect(tally.buffChecked).toBeGreaterThan(0);
    expect(tally.statusChecked).toBeGreaterThan(0);
    expect(tally.expiries).toBeGreaterThan(0);
    expect(tally.residualHits).toBeGreaterThan(0);
    console.log("statFx real-match tally", tally);
  }, 120_000);
});
