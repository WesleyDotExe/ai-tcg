import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore, PLACEMENT_MATCHES, ratePeriod, RATING_START, tierOf, type RecordedOutcome } from "../src/index.js";

// Sydney is UTC+11 in October-November (daylight saving): 10:00 UTC is
// 21:00 the same Sydney day.
const DAY1 = "2026-11-02T01:00:00.000Z";
const at = (day: number, hour = 1) => new Date(Date.UTC(2026, 10, 1 + day, hour)).toISOString();
let clock = new Date(DAY1);
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo });
const tmpDirs: string[] = [];
afterEach(() => {
  clock = new Date(DAY1);
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function player(store: EconomyStore, name: string) {
  const owner = store.createOwner({ name, kind: "house" });
  const agent = store.createAgent({ ownerId: owner.ownerId, name: `${name}-agent` });
  store.connectAgent(owner.ownerId, agent.agentId);
  return { ownerId: owner.ownerId, agentId: agent.agentId };
}

let n = 0;
function play(store: EconomyStore, p1: { agentId: string }, p2: { agentId: string }, outcome: RecordedOutcome, endedAt = DAY1) {
  return store.recordMatch({ matchId: `m${++n}`, seed: n, p1AgentId: p1.agentId, p2AgentId: p2.agentId, outcome, endedAt });
}

describe("ratings (schema v17)", () => {
  it("an owner starts at 1500 / 350 / 0.06 in placement, and a win rates both sides from their pre-match ratings", () => {
    const s = open();
    const a = player(s, "ada");
    const b = player(s, "bo");
    expect(s.rating(a.ownerId)).toMatchObject({ ...RATING_START, ratedMatches: 0, tier: "Placement", lastDay: null });
    const m = play(s, a, b, { kind: "win", winnerAgentId: b.agentId });
    const expectB = ratePeriod(RATING_START, [{ opponent: RATING_START, score: 1 }]);
    const expectA = ratePeriod(RATING_START, [{ opponent: RATING_START, score: 0 }]);
    expect(m.ratings).toEqual({
      p1: { ownerId: a.ownerId, score: 0, before: RATING_START, after: expectA },
      p2: { ownerId: b.ownerId, score: 1, before: RATING_START, after: expectB },
    });
    expect(s.rating(b.ownerId)).toMatchObject({ ...expectB, ratedMatches: 1, lastDay: "2026-11-02" });
    // The history reads back exactly what recordMatch returned.
    expect(s.matchHistory()[0]!.ratings).toEqual(m.ratings);
  });

  it("the seat doesn't matter: the same result from either seat gives the same ratings", () => {
    const s1 = open();
    const s2 = open();
    const [a1, b1] = [player(s1, "a"), player(s1, "b")];
    const [a2, b2] = [player(s2, "a"), player(s2, "b")];
    play(s1, a1, b1, { kind: "win", winnerAgentId: a1.agentId });
    play(s2, b2, a2, { kind: "win", winnerAgentId: a2.agentId });
    expect(s1.rating(a1.ownerId).rating).toBe(s2.rating(a2.ownerId).rating);
    expect(s1.rating(b1.ownerId).rd).toBe(s2.rating(b2.ownerId).rd);
  });

  it("a cancel isn't rated; an abandon is a loss for the side that walked out; a draw is half", () => {
    const s = open();
    const a = player(s, "ada");
    const b = player(s, "bo");
    expect(play(s, a, b, { kind: "cancelled" }).ratings).toBeNull();
    expect(s.rating(a.ownerId).ratedMatches).toBe(0);
    const ab = play(s, a, b, { kind: "abandoned", byAgentId: a.agentId });
    expect(ab.p1Credits + ab.p2Credits).toBe(0); // the economy rule: an abandon pays nothing
    expect(ab.ratings!.p1.score).toBe(0);
    expect(ab.ratings!.p2.score).toBe(1);
    expect(s.rating(a.ownerId).rating).toBeLessThan(1500);
    const before = s.rating(a.ownerId);
    const d = play(s, a, b, { kind: "draw" });
    expect(d.ratings!.p1.score).toBe(0.5);
    expect(d.ratings!.p1.before.rating).toBe(before.rating);
    // The lower-rated side gains from a draw.
    expect(s.rating(a.ownerId).rating).toBeGreaterThan(before.rating);
  });

  it("RD grows once per whole empty reset day (midnight Sydney), not within a day or into the next", () => {
    const s = open();
    const a = player(s, "ada");
    const b = player(s, "bo");
    play(s, a, b, { kind: "win", winnerAgentId: a.agentId }, at(1, 1)); // Sydney 2026-11-02 12:00
    const after = s.rating(a.ownerId, at(1, 1));
    // Later the same Sydney day, and the next Sydney day: no empty day yet.
    expect(s.rating(a.ownerId, at(1, 12)).rd).toBe(after.rd); // 23:00 Sydney
    expect(s.rating(a.ownerId, at(1, 13)).rd).toBe(after.rd); // 00:00 Sydney, 2026-11-03
    // Two days on: one empty day (2026-11-03) between.
    const later = s.rating(a.ownerId, at(3, 1));
    const phi = after.rd / 173.7178;
    expect(later.rd).toBeCloseTo(Math.sqrt(phi * phi + after.volatility ** 2) * 173.7178, 9);
    expect(later.rating).toBe(after.rating);
    // The next match starts from the grown RD.
    const m = play(s, a, b, { kind: "win", winnerAgentId: a.agentId }, at(3, 1));
    expect(m.ratings!.p1.before.rd).toBeCloseTo(later.rd, 9);
  });

  it("the ladder ranks placed owners by rating, lists placement after, and keeps the tallies", () => {
    clock = new Date(at(1));
    const s = open();
    const top = player(s, "top");
    const mid = player(s, "mid");
    const low = player(s, "low");
    const fresh = player(s, "fresh");
    player(s, "never-played");
    for (let i = 0; i < PLACEMENT_MATCHES; i++) {
      play(s, top, mid, { kind: "win", winnerAgentId: top.agentId }, at(1));
      play(s, mid, low, { kind: "win", winnerAgentId: mid.agentId }, at(1));
    }
    play(s, low, top, { kind: "draw" }, at(1));
    play(s, fresh, low, { kind: "win", winnerAgentId: fresh.agentId }, at(1));
    const ladder = s.ladder();
    expect(ladder.map((r) => [r.ownerName, r.rank])).toEqual([
      ["top", 1],
      ["mid", 2],
      ["low", 3],
      ["fresh", null],
    ]);
    expect(ladder[0]).toMatchObject({ wins: PLACEMENT_MATCHES, losses: 0, draws: 1, ratedMatches: PLACEMENT_MATCHES + 1 });
    expect(ladder[0]!.agent?.name).toBe("top-agent");
    expect(ladder[3]!.tier).toBe("Placement");
    expect(ladder[0]!.tier).toBe(tierOf(ladder[0]!.rating, ladder[0]!.ratedMatches));
    expect(s.ladder({ limit: 2 }).map((r) => r.ownerName)).toEqual(["top", "mid"]);
    expect(() => s.ladder({ limit: 0 })).toThrow(/limit/);
  });

  it("tiers: placement first, then 150-point bands from Bronze to Mythic", () => {
    expect(tierOf(2400, PLACEMENT_MATCHES - 1)).toBe("Placement");
    expect(tierOf(1100, PLACEMENT_MATCHES)).toBe("Bronze");
    expect(tierOf(1349.9, 9)).toBe("Bronze");
    expect(tierOf(1350, 9)).toBe("Silver");
    expect(tierOf(1500, 9)).toBe("Gold");
    expect(tierOf(1650, 9)).toBe("Platinum");
    expect(tierOf(1800, 9)).toBe("Diamond");
    expect(tierOf(1950, 9)).toBe("Mythic");
  });

  it("the schema keeps match ratings write-once and only on a rated side of a rated match", () => {
    const s = open();
    const a = player(s, "ada");
    const b = player(s, "bo");
    const c = player(s, "cy");
    const m1 = play(s, a, b, { kind: "win", winnerAgentId: a.agentId }).matchId;
    const cancelled = play(s, a, b, { kind: "cancelled" });
    expect(() => s.unsafeExec("UPDATE match_ratings SET rating_after = 3000")).toThrow(/written once/);
    expect(() => s.unsafeExec("DELETE FROM match_ratings")).toThrow(/written once/);
    const row = (matchId: string, owner: string, seat: string) =>
      `INSERT INTO match_ratings VALUES ('${matchId}', '${owner}', '${seat}', 1, 1500, 350, 0.06, 1600, 300, 0.06)`;
    expect(() => s.unsafeExec(row(cancelled.matchId, a.ownerId, "p1"))).toThrow(/rated match side/);
    expect(() => s.unsafeExec(row("m-none", a.ownerId, "p1"))).toThrow();
    // A rated match, but the owner named didn't play it.
    const draw = play(s, a, c, { kind: "draw" });
    expect(() => s.unsafeExec(`DELETE FROM match_ratings WHERE match_id = '${draw.matchId}'`)).toThrow(/written once/);
    expect(() => s.unsafeExec(row(m1, b.ownerId, "p1"))).toThrow();
    expect(() => s.unsafeExec("UPDATE ratings SET rd = 400")).toThrow(/CHECK/);
  });

  it("a v16 file migrates: old matches stay unrated, everyone starts at the start, and new matches rate", () => {
    const dir = mkdtempSync(join(tmpdir(), "ladder-"));
    tmpDirs.push(dir);
    const path = join(dir, "season.db");
    const v16 = open(path, 16);
    const a = player(v16, "ada");
    const b = player(v16, "bo");
    play(v16, a, b, { kind: "win", winnerAgentId: a.agentId });
    expect(() => v16.rating(a.ownerId)).toThrow(/v17/);
    v16.close();
    const v17 = open(path);
    expect(v17.schemaVersion).toBe(23);
    expect(v17.matchHistory()[0]!.ratings).toBeNull();
    expect(v17.rating(a.ownerId)).toMatchObject({ ...RATING_START, ratedMatches: 0 });
    expect(v17.ladder()).toEqual([]);
    play(v17, a, b, { kind: "win", winnerAgentId: b.agentId });
    expect(v17.ladder().map((r) => r.ownerName)).toEqual(["bo", "ada"]);
  });
});
