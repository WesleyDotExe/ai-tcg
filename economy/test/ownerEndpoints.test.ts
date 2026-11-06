import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  boardLayoutProblem,
  EconomyStore,
  MAX_WIDGETS,
  PACK_PRICE_CREDITS,
  RECOMMENDED_LAYOUT,
  resetDayOf,
  STARTER_PACKS,
  WIDGET_TYPES,
  WIN_SCHEDULE,
  winCredits,
} from "../src/index.js";

// Session 64 (owner 2026-11-01: "the economy endpoints come with the board
// layout, before match running"): the store side of the saved board, the
// daily reset at midnight Sydney and today's earnings, buying packs in one
// go, the recent pulls and the collection summary.

const DAY1 = "2026-11-01T10:00:00.000Z"; // 21:00 on 1 Nov in Sydney (AEDT, +11)
let clock = new Date(DAY1);
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo });
const tmpDirs: string[] = [];
const tmpFile = () => {
  const dir = mkdtempSync(join(tmpdir(), "economy-endpoints-"));
  tmpDirs.push(dir);
  return join(dir, "season.db");
};
afterEach(() => {
  clock = new Date(DAY1);
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function player(s: EconomyStore, name: string) {
  const owner = s.createOwner({ name });
  const agent = s.createAgent({ ownerId: owner.ownerId, name: `${name}-agent` });
  return { ownerId: owner.ownerId, agentId: agent.agentId };
}
let matchNo = 0;
const win = (s: EconomyStore, winner: string, loser: string, endedAt: string) =>
  s.recordMatch({ matchId: `m${++matchNo}`, seed: matchNo, p1AgentId: winner, p2AgentId: loser, outcome: { kind: "win", winnerAgentId: winner }, endedAt });

describe("the daily reset: midnight Sydney, following daylight saving", () => {
  it("names the Sydney date and the instants it starts and ends", () => {
    // AEDT (+11): midnight is 13:00 UTC the day before.
    expect(resetDayOf("2026-11-01T10:00:00.000Z")).toEqual({
      day: "2026-11-01",
      timeZone: "Australia/Sydney",
      startsAt: "2026-10-31T13:00:00.000Z",
      endsAt: "2026-11-01T13:00:00.000Z",
    });
    // The last second of the day and the first of the next.
    expect(resetDayOf("2026-11-01T12:59:59.999Z").day).toBe("2026-11-01");
    expect(resetDayOf("2026-11-01T13:00:00.000Z").day).toBe("2026-11-02");
    // AEST (+10) in winter: midnight is 14:00 UTC.
    expect(resetDayOf("2026-07-01T00:00:00.000Z")).toMatchObject({ day: "2026-07-01", startsAt: "2026-06-30T14:00:00.000Z", endsAt: "2026-07-01T14:00:00.000Z" });
    // Offsets in the input don't matter, only the instant.
    expect(resetDayOf("2026-11-02T00:30:00+11:00").day).toBe("2026-11-02");
    expect(() => resetDayOf("not a time")).toThrow(/not a valid time/);
  });

  it("the daylight-saving days are 23 and 25 hours long", () => {
    const hours = (d: { startsAt: string; endsAt: string }) => (Date.parse(d.endsAt) - Date.parse(d.startsAt)) / 3_600_000;
    // Clocks go forward at 02:00 on Sunday 4 Oct 2026, back at 03:00 on Sunday 5 Apr 2026.
    expect(resetDayOf("2026-10-04T05:00:00Z")).toMatchObject({ day: "2026-10-04", startsAt: "2026-10-03T14:00:00.000Z", endsAt: "2026-10-04T13:00:00.000Z" });
    expect(hours(resetDayOf("2026-10-04T05:00:00Z"))).toBe(23);
    expect(hours(resetDayOf("2026-04-05T05:00:00Z"))).toBe(25);
    expect(hours(resetDayOf("2026-10-05T05:00:00Z"))).toBe(24);
    // Every day of a year: each starts exactly where the one before ended.
    let day = resetDayOf("2026-01-01T00:00:00Z");
    for (let i = 0; i < 366; i++) {
      const next = resetDayOf(day.endsAt);
      expect(next.startsAt).toBe(day.endsAt);
      expect([23, 24, 25]).toContain(hours(next));
      day = next;
    }
  });

  it("the store pays the win schedule by the Sydney day", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    // 12:30 UTC and 12:59 UTC on 1 Nov are both 1 Nov in Sydney; 13:00 is 2 Nov.
    expect(win(s, a.agentId, b.agentId, "2026-11-01T12:30:00.000Z").p1Credits).toBe(30);
    expect(win(s, a.agentId, b.agentId, "2026-11-01T12:59:59.000Z").p1Credits).toBe(10);
    expect(win(s, a.agentId, b.agentId, "2026-11-01T13:00:00.000Z").p1Credits).toBe(30);
    // In UTC all three were 1 Nov: the old rule would have paid 30, 10, 10.
    expect(s.dailyTally(a.ownerId, "2026-11-01T13:00:00.000Z")).toEqual({ winsToday: 1, lossesToday: 0 });
    expect(s.dailyTally(b.ownerId, "2026-11-01T12:00:00.000Z")).toEqual({ winsToday: 0, lossesToday: 2 });
  });
});

describe("today's earnings (the Daily rewards widget)", () => {
  it("lists the schedule, each win with what it paid, the losses, and what the next of each pays", () => {
    expect(WIN_SCHEDULE.map((r) => [r.fromWin, r.toWin, r.credits])).toEqual([[1, 1, 30], [2, 4, 10], [5, 10, 5], [11, null, 0]]);
    for (let n = 1; n <= 15; n++) {
      const row = WIN_SCHEDULE.find((r) => n >= r.fromWin && (r.toWin === null || n <= r.toWin))!;
      expect(winCredits(n)).toBe(row.credits);
    }
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    const fresh = s.dailyEarnings(a.ownerId);
    expect(fresh).toEqual({
      day: "2026-11-01",
      timeZone: "Australia/Sydney",
      startedAt: "2026-10-31T13:00:00.000Z",
      resetsAt: "2026-11-01T13:00:00.000Z",
      schedule: WIN_SCHEDULE.map((r) => ({ ...r })),
      wins: [],
      rewardedWins: [],
      losses: 0,
      maxPaidLosses: 10,
      creditsFromWins: 0,
      creditsFromLosses: 0,
      credits: 0,
      nextWinPays: 30,
      nextLossPays: 2,
    });
    // Yesterday's win (Sydney) doesn't count; 11 wins today, a loss, a draw, a cancel.
    win(s, a.agentId, b.agentId, "2026-10-31T12:00:00.000Z");
    const times = Array.from({ length: 11 }, (_, i) => new Date(Date.parse("2026-10-31T13:00:00.000Z") + i * 60_000).toISOString());
    for (const t of times) win(s, a.agentId, b.agentId, t);
    win(s, b.agentId, a.agentId, "2026-11-01T01:00:00.000Z");
    s.recordMatch({ matchId: "draw", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "draw" }, endedAt: "2026-11-01T02:00:00.000Z" });
    s.recordMatch({ matchId: "cancel", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "cancelled" }, endedAt: "2026-11-01T03:00:00.000Z" });
    const e = s.dailyEarnings(a.ownerId);
    expect(e.wins.map((w) => w.credits)).toEqual([30, 10, 10, 10, 5, 5, 5, 5, 5, 5, 0]);
    expect(e.wins.map((w) => w.nth)).toEqual(Array.from({ length: 11 }, (_, i) => i + 1));
    expect(e.wins[0]!.endedAt).toBe(times[0]);
    expect(e.rewardedWins).toHaveLength(10);
    // Past the 10th win a loss pays nothing (an 11th win can't be worth less than a loss).
    expect([e.losses, e.creditsFromWins, e.creditsFromLosses, e.credits, e.nextWinPays, e.nextLossPays]).toEqual([2, 90, 0, 90, 0, 0]);
    // The widget's credits agree with the ledger's match payouts in the window.
    const paid = s
      .ledger(a.ownerId)
      .filter((l) => l.reason.startsWith("match") && l.createdAt >= e.startedAt && l.createdAt < e.resetsAt)
      .reduce((t, l) => t + l.delta, 0);
    expect(paid).toBe(e.credits);
    // b's side: 1 win, 11 losses + 1 draw (12; the 11th and 12th don't pay).
    const eb = s.dailyEarnings(b.ownerId);
    expect([eb.wins.length, eb.losses, eb.creditsFromLosses, eb.creditsFromWins, eb.nextLossPays]).toEqual([1, 12, 20, 30, 0]);
    // At the reset the day is empty again.
    expect(s.dailyEarnings(a.ownerId, "2026-11-01T13:00:00.000Z")).toMatchObject({ day: "2026-11-02", wins: [], credits: 0, nextWinPays: 30 });
    expect(() => s.dailyEarnings("nobody")).toThrow(/no owner/);
    expect(() => s.dailyEarnings(a.ownerId, "yesterday")).toThrow(/not a valid time/);
  });
});

describe("the saved board layout (schema v16)", () => {
  it("reads the recommended layout until the owner saves a board, then the owner's board", () => {
    const s = open();
    const o = player(s, "a");
    const first = s.boardLayout(o.ownerId);
    expect(first).toEqual({ widgets: RECOMMENDED_LAYOUT.map((w) => ({ ...w })), recommended: true, updatedAt: null });
    expect(first.widgets.map((w) => `${w.type}:${w.size}`)).toEqual(["agent:M", "live:M", "packs:M", "daily:S", "store:S", "watch:M", "collection:M", "ladder:M", "form:M"]);
    // The recommended layout is itself a valid board, and has no Tournament.
    expect(boardLayoutProblem({ widgets: RECOMMENDED_LAYOUT })).toBeUndefined();
    first.widgets[0]!.size = "L";
    expect(s.boardLayout(o.ownerId).widgets[0]!.size).toBe("M");
    clock = new Date("2026-11-01T11:00:00.000Z");
    const board = [
      { id: "w9", type: "watch", size: "L" },
      { id: "w2", type: "watch", size: "S" },
      { id: "w1", type: "agent", size: "M" },
    ] as const;
    expect(s.saveBoardLayout(o.ownerId, { widgets: [...board] })).toEqual({ widgets: board, recommended: false, updatedAt: "2026-11-01T11:00:00.000Z" });
    // An empty board saves as empty, not as "never saved".
    expect(s.saveBoardLayout(o.ownerId, { widgets: [] })).toMatchObject({ widgets: [], recommended: false });
    // Every widget at its limit fits: 13.
    const full = WIDGET_TYPES.flatMap((t) => (t === "watch" ? [`${t}-1`, `${t}-2`] : [t]).map((id) => ({ id, type: t, size: "S" as const })));
    expect(full).toHaveLength(MAX_WIDGETS);
    expect(s.saveBoardLayout(o.ownerId, { widgets: full }).widgets).toHaveLength(13);
  });

  it("refuses a bad board with the reason and saves nothing", () => {
    const s = open();
    const o = player(s, "a");
    s.saveBoardLayout(o.ownerId, { widgets: [{ id: "w1", type: "agent", size: "M" }] });
    const before = s.boardLayout(o.ownerId);
    const w = (x: Record<string, unknown>) => ({ widgets: [{ id: "w1", type: "agent", size: "M", ...x }] });
    const bad: [unknown, RegExp][] = [
      [null, /must be an object/],
      [[], /must be an object/],
      [{}, /"widgets" must be a list/],
      [{ widgets: [], theme: "dark" }, /unknown field "theme"/],
      [{ widgets: "agent" }, /must be a list/],
      [{ widgets: ["agent"] }, /widget 1 must be an object/],
      [w({ colour: "red" }), /unknown field "colour"/],
      [w({ id: "" }), /"id" must be 1 to 32/],
      [w({ id: "has space" }), /"id" must be 1 to 32/],
      [w({ id: "x".repeat(33) }), /"id" must be 1 to 32/],
      [w({ id: 7 }), /"id" must be/],
      [w({ type: "tournament" }), /Tournament widget comes after Season 0/],
      [w({ type: "feed" }), /League pull feed comes after Season 0/],
      [w({ type: "clock" }), /no widget "clock"/],
      [w({ type: "toString" }), /no widget "toString"/],
      [w({ type: 3 }), /"type" must be a widget type/],
      [w({ size: "XL" }), /"size" must be S, M or L/],
      [w({ size: "m" }), /"size" must be S, M or L/],
      [{ widgets: [{ id: "a", type: "agent", size: "M" }, { id: "a", type: "live", size: "M" }] }, /widget 2: the id "a" is already/],
      [{ widgets: [{ id: "a", type: "agent", size: "M" }, { id: "b", type: "agent", size: "S" }] }, /widget 2: a board holds one "agent" widget$/],
      [{ widgets: ["1", "2", "3"].map((id) => ({ id, type: "watch", size: "M" })) }, /widget 3: a board holds 2 "watch" widgets/],
      [{ widgets: Array.from({ length: 14 }, (_, i) => ({ id: `w${i}`, type: "agent", size: "S" })) }, /at most 13 widgets, got 14/],
    ];
    for (const [body, message] of bad) {
      expect(boardLayoutProblem(body)).toMatch(message);
      expect(() => s.saveBoardLayout(o.ownerId, body as never)).toThrow(message);
    }
    expect(s.boardLayout(o.ownerId)).toEqual(before);
    expect(() => s.saveBoardLayout("nobody", { widgets: [] })).toThrow(/no owner/);
  });

  it("the schema itself guards the row, and a v15 file migrates with every owner on the recommended layout", () => {
    const path = tmpFile();
    const v15 = open(path, 15);
    const o = v15.createOwner({ name: "old" });
    v15.updateAccountSettings(o.ownerId, { theme: "dark" });
    v15.close();
    const v16 = open(path);
    expect(v16.schemaVersion).toBe(25);
    expect(v16.boardLayout(o.ownerId)).toMatchObject({ recommended: true, updatedAt: null });
    expect(v16.accountSettings(o.ownerId).theme).toBe("dark");
    v16.saveBoardLayout(o.ownerId, { widgets: [{ id: "w1", type: "packs", size: "L" }] });
    const set = (json: string) => () => v16.unsafeExec(`UPDATE board_layouts SET widgets = '${json}' WHERE owner_id = '${o.ownerId}'`);
    expect(set("not json")).toThrow(/CHECK/);
    expect(set('{"id":"w1"}')).toThrow(/CHECK/);
    expect(set(JSON.stringify(Array.from({ length: 14 }, () => ({ type: "agent", size: "S" }))))).toThrow(/CHECK/);
    expect(set('[{"id":"w1","type":"tournament","size":"M"}]')).toThrow(/known widgets/);
    expect(set('[{"id":"w1","type":"packs","size":"XL"}]')).toThrow(/known widgets/);
    expect(set('[{"id":"w1","type":"packs"}]')).toThrow(/known widgets/);
    expect(set('["packs"]')).toThrow(/known widgets/);
    expect(() => v16.unsafeExec(`INSERT INTO board_layouts (owner_id, widgets, updated_at) VALUES ('ghost', '[]', 'x')`)).toThrow(/FOREIGN KEY/);
    expect(() => v16.unsafeExec(`INSERT INTO board_layouts (owner_id, widgets, updated_at) VALUES ('${o.ownerId}', '[]', 'x')`)).toThrow(/UNIQUE|PRIMARY/);
    v16.close();
    // A saved board survives a reopen.
    const again = open(path);
    expect(again.boardLayout(o.ownerId)).toMatchObject({ widgets: [{ id: "w1", type: "packs", size: "L" }], recommended: false });
    again.close();
  });
});

describe("buying packs, the recent pulls and the collection summary", () => {
  it("buys 1 to 10 packs in one go, all or none", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    for (let i = 0; i < 9; i++) win(s, a.agentId, b.agentId, DAY1); // 30 + 3x10 + 5x5 = 85
    for (let d = 1; d <= 6; d++) win(s, a.agentId, b.agentId, new Date(Date.parse(DAY1) + d * 86_400_000).toISOString()); // +180
    expect(s.balance(a.ownerId)).toBe(265);
    expect(() => s.buyPacks(a.ownerId, "S0", 3)).toThrow(/3 pack\(s\) cost 300 credits; the owner has 265/);
    expect(s.unopenedPacks(a.ownerId)).toHaveLength(0);
    expect(s.balance(a.ownerId)).toBe(265);
    const bought = s.buyPacks(a.ownerId, "S0", 2);
    expect(bought.map((p) => p.source)).toEqual(["purchase", "purchase"]);
    expect(s.balance(a.ownerId)).toBe(265 - 2 * PACK_PRICE_CREDITS);
    expect(s.wallet(a.ownerId).unopenedPacks.map((p) => p.packId)).toEqual(bought.map((p) => p.packId));
    for (const n of [0, 11, 1.5, -1]) expect(() => s.buyPacks(a.ownerId, "S0", n)).toThrow(/buy 1 to 10 packs at once/);
    expect(() => s.buyPacks(a.ownerId, "S9", 1)).toThrow(/no card set "S9"/);
  });

  it("lists the last openings newest first, and sums the collection by card and by set", () => {
    const s = open();
    const o = s.createOwner({ name: "collector" });
    expect(s.collectionSummary(o.ownerId)).toMatchObject({ copies: 0, distinctCards: 0, cards: [], recentPulls: [] });
    s.grantStarterCollection(o.ownerId, "Swarm");
    const opened = [1, 2, 3, 4].slice(0, STARTER_PACKS).map((seed) => s.openPack(o.ownerId, undefined, { seed }));
    const recent = s.recentPulls(o.ownerId, 2);
    expect(recent.map((r) => r.packId)).toEqual(opened.slice(-2).reverse().map((p) => p.packId));
    expect(recent[0]!.cards.map((c) => c.copyId)).toEqual(opened.at(-1)!.cards.map((c) => c.copyId));
    expect(recent[0]!.cards.map((c) => c.name)).toEqual(opened.at(-1)!.cards.map((c) => c.name));
    expect(recent[0]!.cards.every((c) => c.held)).toBe(true);
    expect(() => s.recentPulls(o.ownerId, 0)).toThrow(/1 to 50/);

    const sum = s.collectionSummary(o.ownerId);
    const all = s.collection(o.ownerId);
    expect(sum.copies).toBe(all.length);
    expect(sum.cards.reduce((t, c) => t + c.owned, 0)).toBe(all.length);
    expect(sum.distinctCards).toBe(new Set(all.map((c) => c.cardId)).size);
    expect(sum.cards.map((c) => c.name)).toEqual([...sum.cards.map((c) => c.name)].sort((x, y) => x.localeCompare(y)));
    for (const c of sum.cards) {
      expect(c.copies).toHaveLength(c.owned);
      expect(c.copies.every((x) => !("ownerId" in x))).toBe(true);
      expect(c.salvageable).toBe(s.cardHoldings(o.ownerId, c.cardId).salvageable);
    }
    // Starter copies are bound, so the starter cards are mostly not salvageable.
    expect(sum.cards.some((c) => c.copies.some((x) => x.origin === "starter" && x.accountBound))).toBe(true);
    const binder = s.binder(o.ownerId, "S0");
    expect(sum.sets).toEqual([
      {
        setCode: "S0",
        base: { held: binder.base.held, total: binder.base.total },
        secrets: { held: binder.secrets.held, total: binder.secrets.total },
        glitch: { held: binder.glitch.held, total: binder.glitch.total },
        gold: { held: binder.gold.held, total: binder.gold.total },
        prototypes: { runsHeld: 0, runs: binder.prototypes.length, copiesHeld: 0 },
      },
    ]);
    expect(sum.recentPulls).toHaveLength(3);
    // A salvaged pull stays in the recent pulls, marked as no longer held.
    const salvageable = sum.cards.find((c) => c.salvageable > 0 && c.copies.some((x) => x.origin === "pack"));
    if (salvageable) {
      s.salvage(o.ownerId, salvageable.cardId, salvageable.salvageable, { confirmDeckImpact: true });
      const pulls = s.recentPulls(o.ownerId, 3).flatMap((r) => r.cards).filter((c) => c.cardId === salvageable.cardId);
      expect(pulls.some((c) => !c.held)).toBe(true);
    }
  });
});

describe("the ledger, paged in SQL (session 65)", () => {
  it("every page matches the whole ledger read newest first, for every limit and starting point", () => {
    const s = open();
    const ada = player(s, "ada");
    const bo = player(s, "bo");
    s.grantStarterCollection(ada.ownerId, "Swarm");
    for (let i = 0; i < 12; i++) win(s, i % 3 ? ada.agentId : bo.agentId, i % 3 ? bo.agentId : ada.agentId, `2026-10-${String(10 + i).padStart(2, "0")}T01:00:00.000Z`);
    s.openPack(ada.ownerId);
    const newestFirst = s.ledger(ada.ownerId).reverse();
    expect(newestFirst.length).toBeGreaterThan(10);
    // Another owner's entries never show.
    expect(newestFirst.every((e) => e.ownerId === ada.ownerId)).toBe(true);
    const ids = [null, ...newestFirst.map((e) => e.entryId), newestFirst[0]!.entryId + 1000, 1];
    for (const limit of [1, 2, 3, 5, 50]) {
      for (const before of ids) {
        const want = newestFirst.filter((e) => before === null || e.entryId < before);
        expect(s.ledgerPage(ada.ownerId, { limit, before })).toEqual({ entries: want.slice(0, limit), more: want.length > limit });
      }
    }
    // Walking the pages visits every entry once, in order.
    const walked: number[] = [];
    let before: number | null = null;
    for (;;) {
      const page = s.ledgerPage(ada.ownerId, { limit: 4, before });
      walked.push(...page.entries.map((e) => e.entryId));
      if (!page.more) break;
      before = page.entries[page.entries.length - 1]!.entryId;
    }
    expect(walked).toEqual(newestFirst.map((e) => e.entryId));
    expect(() => s.ledgerPage(ada.ownerId, { limit: 0 })).toThrow(/limit/);
    expect(() => s.ledgerPage(ada.ownerId, { limit: 5, before: 1.5 })).toThrow(/before/);
  });
});

describe("a file before v12 (no deck choice) (session 65)", () => {
  it("setActiveDeck works on a v10 file and the migration then marks the owner forced; setDeckChoice says it needs v12", () => {
    const path = tmpFile();
    let s = open(path, 10);
    expect(s.schemaVersion).toBe(10);
    const ada = player(s, "ada");
    const { copies } = s.grantStarterCollection(ada.ownerId, "Cortex");
    const deck = s.saveDeck(ada.ownerId, "Cortex starter", copies.map((c) => c.copyId));
    // This threw "no such column: deck_choice" before (boastDemo.ts crashed).
    s.setActiveDeck(ada.ownerId, deck.deckId);
    expect(s.getOwner(ada.ownerId).activeDeckId).toBe(deck.deckId);
    expect(() => s.setDeckChoice(ada.ownerId, "agent")).toThrow("the deck choice needs schema v12");
    s.close();
    s = open(path);
    expect(s.schemaVersion).toBeGreaterThanOrEqual(12);
    expect(s.getOwner(ada.ownerId)).toMatchObject({ activeDeckId: deck.deckId, deckChoice: "forced" });
    s.close();
  });
});
