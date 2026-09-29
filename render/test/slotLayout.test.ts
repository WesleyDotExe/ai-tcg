// Fixed-slot board layout (render/src/slotLayout.ts, owner feedback
// 2026-09-27 item 3) and the response cast beat's stack bookkeeping
// (castFx.ts responseStackIds / resolvedStackIds, same entry item 2).
//  1. hand-built frames for each placement rule;
//  2. real matches, all 16 pairings x 3 seeds: every frame's slots hold
//     exactly its board, no card ever changes slot, no card enters a slot
//     vacated on the same move while another was free; and, counted against
//     the old packed layout, how many card moves the change removed;
//  3. real matches again for the response beat: every RESPONSE cast pushes
//     exactly one tracked item, and each tracked item resolves exactly once,
//     on a move whose own log says it resolved.
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { GameEvent } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "../src/engineInternal.js";
import { captureMatch } from "../src/capture.js";
import { assignSlots } from "../src/slotLayout.js";
import { resolvedStackIds, responseStackIds } from "../src/castFx.js";
import type { DirectiveSnapshot, Frame, MatchReplay, PlayerSnapshot, UnitSnapshot } from "../src/types.js";

function unit(iid: string, cardId = "Grunt"): UnitSnapshot {
  return {
    instanceId: iid, cardId, name: "Grunt", faction: "Swarm", rarity: "Common", flavor: "", attack: 1, health: 1, maxHealth: 1,
    keywords: [], pending: false, isEvolved: false, canAttackThisTurn: true, baseArmor: 0, barrierActive: false,
    printedAttack: 1, printedHealth: 1, turnBuff: { attack: 0, health: 0 }, tools: [], statuses: [], visualSeed: 0, visualPattern: 0,
  };
}
function dir(iid: string): DirectiveSnapshot {
  return { instanceId: iid, cardId: "Law", name: "Law", faction: "Swarm", rarity: "Common", flavor: "", visualSeed: 0, visualPattern: 0 };
}
function player(id: "p1" | "p2", board: UnitSnapshot[], directives: DirectiveSnapshot[], slotsMax: number): PlayerSnapshot {
  return { id, name: id, faction: "Swarm", health: 20, maxHealth: 20, energy: 3, maxEnergy: 3, hand: [], deckSize: 10, graveyardSize: 0, board, directives, slotsUsed: board.length + directives.length, slotsMax };
}
/** One frame per entry; p2 stays empty. */
function timeline(steps: { units: string[]; dirs?: string[]; evolved?: string[] }[], slotsMax = 5): Frame[] {
  return steps.map((s, index) => ({
    index, turnNumber: 1, activePlayer: "p1", priority: "p1", stack: [],
    players: {
      p1: player("p1", s.units.map((u) => unit(u, s.evolved?.includes(u) ? "Grunt+" : "Grunt")), (s.dirs ?? []).map(dir), slotsMax),
      p2: player("p2", [], [], slotsMax),
    },
    newEvents: [], momentum: { score: 0, leader: "even", reasons: [] },
  }));
}
const slotsOf = (frames: Frame[]) => assignSlots(frames).map((f) => f.players.p1.slots);

describe("assignSlots — hand-built", () => {
  it("a card leaving leaves a gap; nothing slides left", () => {
    expect(slotsOf(timeline([{ units: [] }, { units: ["a", "b", "c"] }, { units: ["a", "c"] }]))).toEqual([
      [null, null, null, null, null],
      ["a", "b", "c", null, null],
      ["a", null, "c", null, null],
    ]);
  });

  it("units fill from the left, directives from the right", () => {
    expect(slotsOf(timeline([{ units: ["a"], dirs: ["d1"] }, { units: ["a", "b"], dirs: ["d1", "d2"] }]))).toEqual([
      ["a", null, null, null, "d1"],
      ["a", "b", null, "d2", "d1"],
    ]);
  });

  it("a later arrival reuses an older gap", () => {
    expect(slotsOf(timeline([{ units: ["a", "b", "c"] }, { units: ["a", "c"] }, { units: ["a", "c", "e"] }]))[2]).toEqual(["a", "e", "c", null, null]);
  });

  it("a card entering on the same move another left does not take the spot its ghost is fading in", () => {
    expect(slotsOf(timeline([{ units: ["a", "b"] }, { units: ["b", "n"] }]))[1]).toEqual([null, "b", "n", null, null]);
  });

  it("on a full board the freshly emptied slot is used, since nowhere else is free", () => {
    expect(slotsOf(timeline([{ units: ["a", "b", "c"] }, { units: ["a", "c", "n"] }], 3))[1]).toEqual(["a", "n", "c"]);
  });

  it("an evolution is the same instance, so it keeps its slot", () => {
    expect(slotsOf(timeline([{ units: ["a", "b"] }, { units: ["a", "b"], evolved: ["b"] }]))[1]).toEqual(["a", "b", null, null, null]);
  });

  it("refuses to invent room past the slot cap", () => {
    expect(() => assignSlots(timeline([{ units: ["a", "b", "c"] }], 2))).toThrow(/slot cap/);
  });
});

const builders = { Cortex: buildCortexDeck, Aegis: buildAegisDeck, Swarm: buildSwarmDeck, Null: buildNullDeck };
const factions = Object.keys(builders) as (keyof typeof builders)[];
async function everyPairing(fn: (replay: MatchReplay) => void) {
  for (const a of factions) {
    for (const b of factions) {
      for (const seed of [1, 2, 3]) {
        fn(await captureMatch({
          title: "slot-scan", seed,
          deckA: builders[a]("p1", a), deckB: builders[b]("p2", b),
          agentA: new LookaheadAgent(`${a}-A`, seed * 2 + 1), agentB: new LookaheadAgent(`${b}-B`, seed * 2 + 2),
          boardSlots: BOARD_SLOTS,
        }));
      }
    }
  }
}
const packedOrder = (p: PlayerSnapshot) => [...p.board.map((u) => u.instanceId), ...p.directives.map((d) => d.instanceId)];

describe("assignSlots — real matches", () => {
  it("holds exactly the board, never moves a card, and never drops a newcomer under a ghost", async () => {
    const tally = { frames: 0, placements: 0, forcedIntoVacated: 0, packedSlides: 0, fixedSlides: 0, sameMoveEntryAndExit: 0 };
    await everyPairing((replay) => {
      for (const pid of ["p1", "p2"] as const) {
        const home = new Map<string, number>();
        for (let f = 0; f < replay.frames.length; f++) {
          tally.frames++;
          const snap = replay.frames[f]!.players[pid];
          const slots = snap.slots!;
          expect(slots.length).toBe(snap.slotsMax);
          // Exactly the board: every occupant once, nothing else.
          expect(slots.filter((s) => s !== null).sort()).toEqual(packedOrder(snap).sort());
          // Nobody moves while on the board.
          slots.forEach((iid, i) => {
            if (iid === null) return;
            if (home.has(iid)) expect(home.get(iid)).toBe(i);
            else home.set(iid, i);
          });
          if (f === 0) continue;
          const prevSnap = replay.frames[f - 1]!.players[pid];
          const prevSlots = prevSnap.slots!;
          const vacated = prevSlots.map((iid, i) => (iid !== null && slots[i] !== iid ? i : -1)).filter((i) => i >= 0);
          const entered = slots.map((iid, i) => (iid !== null && !prevSlots.includes(iid) ? i : -1)).filter((i) => i >= 0);
          if (vacated.length && entered.length) tally.sameMoveEntryAndExit++;
          for (const i of entered) {
            tally.placements++;
            if (!vacated.includes(i)) continue;
            // Allowed only when every other slot was taken.
            tally.forcedIntoVacated++;
            const freeElsewhere = slots.some((s, j) => j !== i && s === null && !vacated.includes(j));
            expect(freeElsewhere).toBe(false);
          }
          // What the old packed layout did: a card still on the board shown
          // at a different index than one move ago.
          const was = packedOrder(prevSnap), now = packedOrder(snap);
          for (const iid of now) {
            if (was.includes(iid) && was.indexOf(iid) !== now.indexOf(iid)) tally.packedSlides++;
            if (prevSlots.includes(iid) && prevSlots.indexOf(iid) !== slots.indexOf(iid)) tally.fixedSlides++;
          }
        }
      }
    });
    expect(tally.fixedSlides).toBe(0);
    expect(tally.packedSlides).toBeGreaterThan(0);
    expect(tally.sameMoveEntryAndExit).toBeGreaterThan(0);
    console.log("slotLayout real-match tally", tally);
  }, 120_000);
});

describe("response beat bookkeeping — real matches", () => {
  it("tracks every response's stack item from its push to its one resolution", async () => {
    const tally = { responseCasts: 0, tracked: 0, resolved: 0, stillOnStackAtEnd: 0 };
    await everyPairing((replay) => {
      const ids = responseStackIds(replay.frames);
      const seen = new Map<string, number>();
      for (let f = 1; f < replay.frames.length; f++) {
        const prev = replay.frames[f - 1]!, next = replay.frames[f]!;
        const events: GameEvent[] = next.newEvents.map((e) => e.event);
        const responses = events.filter((e) => e.type === "cast" && e.speed === "Instant" && e.player !== next.activePlayer);
        tally.responseCasts += responses.length;
        const pushed = next.stack.filter((it) => !prev.stack.some((p) => p.stackId === it.stackId) && ids[it.stackId]);
        expect(pushed.length).toBe(responses.length);
        pushed.forEach((it) => { tally.tracked++; seen.set(it.stackId, 0); });
        const gone = resolvedStackIds(prev, next);
        expect(gone.length).toBeLessThanOrEqual(1);
        for (const sid of gone) {
          if (!ids[sid]) continue;
          seen.set(sid, seen.get(sid)! + 1);
          tally.resolved++;
          const item = prev.stack.find((p) => p.stackId === sid)!;
          expect(events.some((e) => e.type === "stackResolve" && e.description === item.description)).toBe(true);
        }
      }
      const last = replay.frames[replay.frames.length - 1]!;
      for (const [sid, n] of seen) {
        if (n === 0) { expect(last.stack.some((s) => s.stackId === sid)).toBe(true); tally.stillOnStackAtEnd++; }
        else expect(n).toBe(1);
      }
    });
    expect(tally.responseCasts).toBeGreaterThan(0);
    expect(tally.tracked).toBe(tally.responseCasts);
    expect(tally.resolved + tally.stillOnStackAtEnd).toBe(tally.tracked);
    console.log("response-beat real-match tally", tally);
  }, 120_000);
});
