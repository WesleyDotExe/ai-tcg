// The Stats page's data (session 78; roadmap 2e; owner 2026-11-05): each
// side's faction kept on the match (schema v24), the counting rules
// (stats.ts), and `store.stats` (the owner's tallies by faction and by the
// opponent's faction, recent results, the rating chart, the weekly trend,
// the agent filter).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SHIPPED_DECK_LISTS, type DeckFaction } from "@ai-tcg/engine";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore, ratingChart, tallyMatches, type StatsMatchRow } from "../src/index.js";

// 10:00 Mon 2 Nov in Sydney (AEDT, UTC+11).
const START = "2026-11-01T23:00:00.000Z";
let clock = new Date(START);
const later = (minutes: number) => (clock = new Date(clock.getTime() + minutes * 60_000));
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo });
const tmpDirs: string[] = [];
afterEach(() => {
  clock = new Date(START);
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

type Side = { ownerId: string; agentId: string; deckId: string };
function owner(store: EconomyStore, name: string, faction: DeckFaction): Side {
  const o = store.createOwner({ name, kind: "player" });
  const { copies } = store.grantStarterCollection(o.ownerId, faction);
  const deck = store.saveDeck(o.ownerId, "starter", copies.map((c) => c.copyId));
  store.setActiveDeck(o.ownerId, deck.deckId);
  const a = store.createAgent({ ownerId: o.ownerId, name: `${name}-agent` });
  store.connectAgent(o.ownerId, a.agentId);
  return { ownerId: o.ownerId, agentId: a.agentId, deckId: deck.deckId };
}

/** A second deck of another faction for the same owner (its cards granted
 * as pack copies). */
function secondDeck(store: EconomyStore, side: Side, faction: DeckFaction): string {
  const ids = SHIPPED_DECK_LISTS[faction]!.flatMap(({ cardId, copies }) =>
    Array.from({ length: copies }, () => store.grantCopy({ ownerId: side.ownerId, cardId, origin: "pack" }).copyId),
  );
  return store.saveDeck(side.ownerId, `${faction} deck`, ids).deckId;
}

let n = 0;
type Outcome = "p1" | "p2" | "draw" | "cancelled" | "abandonedByP1";
const record = (s: EconomyStore, p1: Side, p2: Side, outcome: Outcome, decks: { p1?: string | null; p2?: string | null } = {}) => {
  later(7);
  return s.recordMatch({
    matchId: `st-${++n}`,
    seed: n,
    p1AgentId: p1.agentId,
    p2AgentId: p2.agentId,
    p1DeckId: decks.p1 === undefined ? p1.deckId : decks.p1,
    p2DeckId: decks.p2 === undefined ? p2.deckId : decks.p2,
    turns: 9,
    outcome:
      outcome === "p1"
        ? { kind: "win", winnerAgentId: p1.agentId }
        : outcome === "p2"
          ? { kind: "win", winnerAgentId: p2.agentId }
          : outcome === "abandonedByP1"
            ? { kind: "abandoned", byAgentId: p1.agentId }
            : { kind: outcome },
  });
};

const row = (result: StatsMatchRow["result"], faction: DeckFaction | null = "Cortex", opponentFaction: DeckFaction | null = "Swarm"): StatsMatchRow => ({
  matchId: `r-${++n}`,
  endedAt: "2026-11-02T00:00:00.000Z",
  result,
  abandonedByYou: false,
  agentId: "a",
  faction,
  opponentOwnerId: "o",
  opponentAgentId: "b",
  opponentFaction,
  credits: result === "win" ? 30 : result === "loss" || result === "draw" ? 10 : 0,
  ratingBefore: null,
  ratingAfter: null,
  turns: 9,
});

describe("the counting rules (stats.ts)", () => {
  it("void matches count as matches but never win, lose, or touch a streak; a draw breaks one", () => {
    const t = tallyMatches(["win", "win", "cancelled", "win", "abandoned", "loss", "win", "win", "draw", "loss", "loss"].map((r) => row(r as StatsMatchRow["result"])));
    expect(t.totals).toEqual({
      matches: 11,
      wins: 5,
      losses: 3,
      draws: 1,
      void: 2,
      winRate: 5 / 9,
      bestWinStreak: 3,
      currentStreak: { kind: "loss", length: 2 },
      creditsFromMatches: 5 * 30 + 4 * 10,
    });
    expect(tallyMatches([row("win"), row("draw")]).totals.currentStreak).toBeNull();
    expect(tallyMatches([row("win"), row("draw"), row("cancelled")]).totals.currentStreak).toBeNull();
    expect(tallyMatches([row("loss"), row("cancelled"), row("loss")]).totals.currentStreak).toEqual({ kind: "loss", length: 2 });
    expect(tallyMatches([]).totals).toMatchObject({ matches: 0, winRate: 0, bestWinStreak: 0, currentStreak: null });
  });

  it("splits by the owner's faction and by the opponent's, every faction listed, unrecorded ones apart", () => {
    const t = tallyMatches([row("win", "Cortex", "Swarm"), row("loss", "Cortex", "Aegis"), row("win", "Null", "Swarm"), row("win", null, null), row("cancelled", "Null", "Aegis")]);
    expect(t.byFaction.map((f) => f.faction)).toEqual(["Cortex", "Swarm", "Aegis", "Null"]);
    expect(t.byFaction).toEqual([
      { faction: "Cortex", matches: 2, wins: 1, losses: 1, draws: 0, void: 0, winRate: 0.5 },
      { faction: "Swarm", matches: 0, wins: 0, losses: 0, draws: 0, void: 0, winRate: 0 },
      { faction: "Aegis", matches: 0, wins: 0, losses: 0, draws: 0, void: 0, winRate: 0 },
      { faction: "Null", matches: 2, wins: 1, losses: 0, draws: 0, void: 1, winRate: 1 },
    ]);
    expect(t.factionNotRecorded).toMatchObject({ matches: 1, wins: 1 });
    expect(t.byOpponentFaction.find((f) => f.faction === "Swarm")).toMatchObject({ matches: 2, wins: 2, winRate: 1 });
    expect(t.byOpponentFaction.find((f) => f.faction === "Aegis")).toMatchObject({ matches: 2, losses: 1, void: 1, winRate: 0 });
    expect(t.opponentFactionNotRecorded).toMatchObject({ matches: 1, wins: 1 });
  });

  it("the chart keeps each day's last rating, carries it over idle days, and ignores points outside", () => {
    const days = ["01", "02", "03", "04"].map((d) => ({ day: `2026-11-${d}`, startsAt: `2026-11-${d}T00:00:00.000Z`, endsAt: `2026-11-${String(+d + 1).padStart(2, "0")}T00:00:00.000Z` }));
    const chart = ratingChart(
      days,
      [
        { endedAt: "2026-10-31T12:00:00.000Z", ratingAfter: 1400, score: 0 },
        { endedAt: "2026-11-02T01:00:00.000Z", ratingAfter: 1520, score: 1 },
        { endedAt: "2026-11-02T02:00:00.000Z", ratingAfter: 1510, score: 0.5 },
        { endedAt: "2026-11-04T23:59:59.999Z", ratingAfter: 1490, score: 0 },
        { endedAt: "2026-11-05T00:00:00.000Z", ratingAfter: 1700, score: 1 },
      ],
      1450,
    );
    expect(chart).toEqual([
      { day: "2026-11-01", rating: 1450, rated: 0, wins: 0, losses: 0, draws: 0 },
      { day: "2026-11-02", rating: 1510, rated: 2, wins: 1, losses: 0, draws: 1 },
      { day: "2026-11-03", rating: 1510, rated: 0, wins: 0, losses: 0, draws: 0 },
      { day: "2026-11-04", rating: 1490, rated: 1, wins: 0, losses: 1, draws: 0 },
    ]);
  });
});

describe("each side's faction on the match (schema v24)", () => {
  it("is the faction the deck played, kept on the record, written once; null without a deck", () => {
    const s = open();
    const a = owner(s, "ada", "Cortex");
    const b = owner(s, "bo", "Aegis");
    const m = record(s, a, b, "p1");
    expect(m.factions).toEqual({ p1: "Cortex", p2: "Aegis" });
    expect(s.matchById(m.matchId)!.factions).toEqual({ p1: "Cortex", p2: "Aegis" });
    expect(() => s.unsafeExec(`UPDATE matches SET p1_faction = 'Swarm' WHERE match_id = '${m.matchId}'`)).toThrow(/a match's factions are written once/);
    expect(() => s.unsafeExec(`UPDATE matches SET p1_faction = 'Neutral' WHERE match_id = '${m.matchId}'`)).toThrow();
    const none = record(s, a, b, "p2", { p1: null, p2: null });
    expect(none.factions).toEqual({ p1: null, p2: null });
  });

  it("a deck rebuilt in place after the match doesn't change what the match played", () => {
    const s = open();
    const a = owner(s, "ada", "Cortex");
    const b = owner(s, "bo", "Swarm");
    const m = record(s, a, b, "p1");
    // The same deck id saved again as a Null list (as an agent's rebuild does).
    const nullIds = SHIPPED_DECK_LISTS.Null!.flatMap(({ cardId, copies }) =>
      Array.from({ length: copies }, () => s.grantCopy({ ownerId: a.ownerId, cardId, origin: "pack" }).copyId),
    );
    s.unsafeExec(`DELETE FROM deck_copies WHERE deck_id = '${a.deckId}'`);
    for (const id of nullIds) s.unsafeExec(`INSERT INTO deck_copies (deck_id, copy_id) VALUES ('${a.deckId}', '${id}')`);
    expect(s.matchById(m.matchId)!.factions.p1).toBe("Cortex");
    expect(record(s, a, b, "p1").factions.p1).toBe("Null");
  });
});

describe("store.stats: the Stats page", () => {
  it("counts the owner's matches, by its faction and the opponent's, with recent results newest first", () => {
    const s = open();
    const a = owner(s, "ada", "Cortex");
    const b = owner(s, "bo", "Swarm");
    const c = owner(s, "cy", "Aegis");
    const aNull = secondDeck(s, a, "Null");
    record(s, a, b, "p1");
    record(s, b, a, "p2"); // a wins from p2
    record(s, a, c, "p2");
    record(s, a, c, "cancelled");
    record(s, a, b, "draw", { p1: aNull });
    record(s, a, b, "p1", { p1: aNull });
    record(s, a, c, "abandonedByP1");
    const st = s.stats(a.ownerId);
    expect(st.totals).toMatchObject({ matches: 7, wins: 3, losses: 1, draws: 1, void: 2, winRate: 3 / 5, bestWinStreak: 2, currentStreak: { kind: "win", length: 1 } });
    expect(st.totals.creditsFromMatches).toBe(s.ownerStats(a.ownerId).creditsFromMatches);
    expect(st.byFaction.find((f) => f.faction === "Cortex")).toMatchObject({ matches: 5, wins: 2, losses: 1, void: 2 });
    expect(st.byFaction.find((f) => f.faction === "Null")).toMatchObject({ matches: 2, wins: 1, draws: 1, winRate: 0.5 });
    expect(st.factionNotRecorded.matches).toBe(0);
    expect(st.byOpponentFaction.find((f) => f.faction === "Swarm")).toMatchObject({ matches: 4, wins: 3, draws: 1, winRate: 0.75 });
    expect(st.byOpponentFaction.find((f) => f.faction === "Aegis")).toMatchObject({ matches: 3, losses: 1, void: 2 });

    expect(st.recent.map((r) => r.result)).toEqual(["abandonedByYou", "win", "draw", "cancelled", "loss", "win", "win"]);
    expect(st.recent[0]).toMatchObject({ faction: "Cortex", opponent: { ownerName: "cy", agentName: "cy-agent", faction: "Aegis" }, credits: 0, turns: 9 });
    expect(st.recent[0]!.rating!.change).toBeLessThan(0); // an abandon is rated, a loss for the side that walked out
    expect(st.recent[3]).toMatchObject({ result: "cancelled", rating: null });
    expect(st.recent[1]).toMatchObject({ result: "win", faction: "Null", agentId: a.agentId, agentName: "ada-agent" });
    expect(st.recent[1]!.rating!.change).toBeCloseTo(st.recent[1]!.rating!.after - st.recent[1]!.rating!.before, 9);
    expect(st.recent[1]!.rating!.change).toBeGreaterThan(0);
    // c's side of the abandon: void in the tallies, rated a win.
    const sc = s.stats(c.ownerId);
    expect(sc.recent[0]).toMatchObject({ result: "abandonedByOpponent" });
    expect(sc.recent[0]!.rating!.change).toBeGreaterThan(0);
    expect(s.stats(a.ownerId, { recent: 2 }).recent.map((r) => r.matchId)).toEqual(st.recent.slice(0, 2).map((r) => r.matchId));
  });

  it("the agent filter narrows every count and the results, but not the owner's rating", () => {
    const s = open();
    const a = owner(s, "ada", "Cortex");
    const b = owner(s, "bo", "Swarm");
    const first = a.agentId;
    record(s, a, b, "p1");
    record(s, a, b, "p1");
    const second = s.createAgent({ ownerId: a.ownerId, name: "ada-two" }).agentId;
    s.connectAgent(a.ownerId, second);
    const a2 = { ...a, agentId: second };
    record(s, a2, b, "p2");
    const all = s.stats(a.ownerId);
    const one = s.stats(a.ownerId, { agentId: first });
    const two = s.stats(a.ownerId, { agentId: second });
    expect(all.agents).toEqual([
      { agentId: first, name: "ada-agent", matches: 2 },
      { agentId: second, name: "ada-two", matches: 1 },
    ]);
    expect(all.agentId).toBeNull();
    expect([all.totals.matches, one.totals.matches, two.totals.matches]).toEqual([3, 2, 1]);
    expect(one.totals).toMatchObject({ wins: 2, losses: 0, currentStreak: { kind: "win", length: 2 } });
    expect(two.totals).toMatchObject({ wins: 0, losses: 1 });
    expect(two.recent.map((r) => r.agentName)).toEqual(["ada-two"]);
    expect(one.rating).toEqual(all.rating);
    expect(two.rating).toEqual(all.rating);
    expect(() => s.stats(a.ownerId, { agentId: b.agentId })).toThrow(/isn't one of this owner's agents/);
  });

  it("the rating chart: one row per Sydney day ending today, the day's last rating carried over idle days; the weekly trend", () => {
    const s = open();
    const a = owner(s, "ada", "Cortex");
    const b = owner(s, "bo", "Swarm");
    // Day 1 (Mon 2 Nov, Sydney): two wins. Day 4 (Thu 5 Nov): a loss. Day 10 (Wed 11 Nov): read.
    record(s, a, b, "p1");
    record(s, a, b, "p1");
    const afterDay1 = s.rating(a.ownerId).rating;
    clock = new Date("2026-11-04T23:00:00.000Z"); // 10:00 Thu 5 Nov Sydney
    record(s, a, b, "p2");
    const afterDay4 = s.rating(a.ownerId).rating;
    clock = new Date("2026-11-10T23:00:00.000Z"); // 10:00 Wed 11 Nov Sydney
    const st = s.stats(a.ownerId, { days: 14 });
    expect(st.rating.chart).toHaveLength(14);
    expect(st.rating.chart.at(-1)!.day).toBe("2026-11-11");
    expect(st.rating.chart[0]!.day).toBe("2026-10-29");
    const byDay = new Map(st.rating.chart.map((d) => [d.day, d]));
    expect(byDay.get("2026-11-01")).toMatchObject({ rating: 1500, rated: 0 });
    expect(byDay.get("2026-11-02")).toMatchObject({ rating: afterDay1, rated: 2, wins: 2 });
    expect(byDay.get("2026-11-03")).toMatchObject({ rating: afterDay1, rated: 0 });
    expect(byDay.get("2026-11-05")).toMatchObject({ rating: afterDay4, rated: 1, losses: 1 });
    expect(byDay.get("2026-11-11")).toMatchObject({ rating: afterDay4, rated: 0 });
    // A week ago is the end of Wed 4 Nov (Sydney): after day 1, before day 4's loss.
    expect(st.rating.weekAgo).toBe(afterDay1);
    expect(st.rating.weekChange).toBeCloseTo(afterDay4 - afterDay1, 9);
    expect(st.rating.now.rating).toBe(afterDay4);
    // Today's earnings are the owner's day, as GET /api/daily.
    expect(st.today).toEqual(s.dailyEarnings(a.ownerId));
    // The default chart is 30 days; a fresh owner's is flat at the start.
    const fresh = owner(s, "cy", "Aegis");
    const f = s.stats(fresh.ownerId);
    expect(f.rating.chart).toHaveLength(30);
    expect(new Set(f.rating.chart.map((d) => d.rating))).toEqual(new Set([1500]));
    expect(f.rating).toMatchObject({ weekAgo: 1500, weekChange: 0 });
    expect(f.recent).toEqual([]);
    expect(f.totals.matches).toBe(0);
  });

  it("refuses a chart outside 7-90 days and recent results outside 1-50", () => {
    const s = open();
    const a = owner(s, "ada", "Cortex");
    expect(() => s.stats(a.ownerId, { days: 6 })).toThrow(/7 to 90 days/);
    expect(() => s.stats(a.ownerId, { days: 91 })).toThrow(/7 to 90 days/);
    expect(() => s.stats(a.ownerId, { recent: 0 })).toThrow(/1 to 50/);
    expect(() => s.stats(a.ownerId, { recent: 1.5 })).toThrow(/1 to 50/);
    expect(s.stats(a.ownerId, { days: 7 }).rating.chart).toHaveLength(7);
    expect(s.stats(a.ownerId, { days: 90 }).rating.chart).toHaveLength(90);
  });

  it("a v23 file migrates: older matches keep no faction and count as not recorded; new ones record theirs", () => {
    const dir = mkdtempSync(join(tmpdir(), "ai-tcg-stats-"));
    tmpDirs.push(dir);
    const path = join(dir, "store.db");
    const v23 = open(path, 23);
    const a = owner(v23, "ada", "Cortex");
    const b = owner(v23, "bo", "Swarm");
    expect(record(v23, a, b, "p1").factions).toEqual({ p1: null, p2: null });
    // A store held at v23 still answers the page, with nothing recorded.
    expect(v23.stats(a.ownerId)).toMatchObject({ totals: { matches: 1, wins: 1 }, factionNotRecorded: { matches: 1, wins: 1 } });
    v23.close();
    const v24 = open(path);
    expect(v24.schemaVersion).toBe(24);
    const old = v24.matchHistory({ ownerId: a.ownerId })[0]!;
    expect(old.factions).toEqual({ p1: null, p2: null });
    record(v24, a, b, "p2");
    const st = v24.stats(a.ownerId);
    expect(st.factionNotRecorded).toMatchObject({ matches: 1, wins: 1 });
    expect(st.opponentFactionNotRecorded).toMatchObject({ matches: 1, wins: 1 });
    expect(st.byFaction.find((f) => f.faction === "Cortex")).toMatchObject({ matches: 1, losses: 1 });
    expect(st.byOpponentFaction.find((f) => f.faction === "Swarm")).toMatchObject({ matches: 1, losses: 1 });
    // Old rows can still be given a faction once (null -> a value isn't a rewrite), as a repair could.
    v24.unsafeExec(`UPDATE matches SET p1_faction = 'Cortex', p2_faction = 'Swarm' WHERE match_id = '${old.matchId}'`);
    expect(() => v24.unsafeExec(`UPDATE matches SET p1_faction = 'Aegis' WHERE match_id = '${old.matchId}'`)).toThrow(/written once/);
    v24.close();
  });
});
