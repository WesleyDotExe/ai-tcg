// Session 102: the season server's ladder lines (ladderLog.ts). A repeat of
// the same "sits out" reason is summed up instead of printed every round.
import { describe, expect, it } from "vitest";
import { LadderLog, REMIND_EVERY } from "../src/ladder/ladderLog.js";
import { localStamp } from "../src/logTime.js";
import type { RoundReport } from "../src/ladder/ladderRunner.js";

const names: Record<string, string> = { a: "Alpha", b: "Beta", c: "Gamma" };
const round = (n: number, over: Partial<RoundReport> = {}): RoundReport => ({
  round: n,
  housePacks: [],
  rebuilt: [],
  excluded: [],
  pairs: [],
  sitOut: [],
  matches: [],
  ...over,
});
/** One round as the live ladder reports it: the excluded events, then the round. */
const play = (log: LadderLog, n: number, out: [string, string][], pairs: [string, string][] = [], sitOut: string[] = []) => {
  const lines: string[] = [];
  for (const [ownerId, reason] of out) lines.push(...log.event({ kind: "excluded", ownerId, reason }));
  lines.push(...log.round(round(n, { excluded: out.map(([ownerId, reason]) => ({ ownerId, reason })), pairs: pairs.map(([p1, p2]) => ({ p1, p2 }) as RoundReport["pairs"][number]), sitOut })));
  return lines;
};

describe("LadderLog (session 102)", () => {
  it("prints a reason the first time, and not again while it repeats", () => {
    const log = new LadderLog((id) => names[id]!);
    expect(play(log, 1, [["a", "no active deck"]], [["b", "c"]])).toEqual(["[ladder] Alpha sits out: no active deck", "[ladder] round 1 since this start: 1 match"]);
    expect(play(log, 2, [["a", "no active deck"]], [["b", "c"]])).toEqual(["[ladder] round 2 since this start: 1 match"]);
  });

  it("prints it again when the reason changes", () => {
    const log = new LadderLog((id) => names[id]!);
    play(log, 1, [["a", "at most 0 usable cards"]]);
    play(log, 2, [["a", "at most 0 usable cards"]]);
    expect(play(log, 3, [["a", "at most 19 usable cards"]])).toContain("[ladder] Alpha sits out: at most 19 usable cards");
  });

  it(`reminds once every ${REMIND_EVERY} rounds in a row`, () => {
    const log = new LadderLog((id) => names[id]!);
    const all: string[] = [];
    for (let i = 1; i <= REMIND_EVERY * 2 + 5; i++) all.push(...play(log, i, [["a", "no active deck"]]));
    const mine = all.filter((l) => l.includes("Alpha"));
    expect(mine).toEqual([
      "[ladder] Alpha sits out: no active deck",
      `[ladder] Alpha still sits out (${REMIND_EVERY} rounds in a row): no active deck`,
      `[ladder] Alpha still sits out (${REMIND_EVERY * 2} rounds in a row): no active deck`,
    ]);
  });

  it("says when the owner is back in the queue, counting every round left out (any reason)", () => {
    const log = new LadderLog((id) => names[id]!);
    play(log, 1, [["a", "one"]]);
    play(log, 2, [["a", "one"]]);
    play(log, 3, [["a", "two"]]);
    expect(play(log, 4, [], [["a", "b"]])).toEqual(["[ladder] Alpha is back in the queue after sitting out 3 rounds", "[ladder] round 4 since this start: 1 match"]);
    // Out again later: the first line is printed again.
    expect(play(log, 5, [["a", "one"]])).toContain("[ladder] Alpha sits out: one");
  });

  it("an odd-queue sit-out counts as back; leaving the queue (auto-play off) prints nothing", () => {
    const log = new LadderLog((id) => names[id]!);
    play(log, 1, [["a", "x"], ["b", "y"]]);
    const lines = play(log, 2, [], [], ["a"]);
    expect(lines).toContain("[ladder] Alpha is back in the queue after sitting out 1 round");
    expect(lines.some((l) => l.includes("Beta"))).toBe(false);
    // Beta's next exclusion is printed in full again (its run was cleared).
    expect(play(log, 3, [["b", "y"]])).toContain("[ladder] Beta sits out: y");
  });

  it("a match that didn't start is always printed and isn't a sit-out run", () => {
    const log = new LadderLog((id) => names[id]!);
    const r = "match not started: the deck went short";
    expect(log.event({ kind: "excluded", ownerId: "a", reason: r })).toEqual([`[ladder] Alpha sits out: ${r}`]);
    expect(log.event({ kind: "excluded", ownerId: "a", reason: r })).toEqual([`[ladder] Alpha sits out: ${r}`]);
    expect(log.round(round(2, { pairs: [{ p1: "a", p2: "b" } as RoundReport["pairs"][number]] }))).toEqual(["[ladder] round 2 since this start: 1 match"]);
  });

  it("(session 104) an owner switching auto-play off by hand gets one line, with when", () => {
    const log = new LadderLog((id) => names[id]!);
    expect(log.event({ kind: "autoPlaySwitchedOff", ownerId: "a", changedAt: "2026-12-05T01:02:03.000Z" })).toEqual([`[ladder] Alpha's auto-play is off: switched off by its owner at ${localStamp(new Date("2026-12-05T01:02:03.000Z"))}`]);
    expect(log.event({ kind: "autoPlaySwitchedOff", ownerId: "b", changedAt: null })).toEqual(["[ladder] Beta's auto-play is off: switched off by its owner"]);
  });
});
