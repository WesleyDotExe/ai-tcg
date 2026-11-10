// Notifications (schema v23, session 77; owner 2026-11-05 and 2026-11-06):
// match results, big pulls, the free daily pack ready, auto-play switched
// off (the day's rewards maxed, or the play-time allowance's time up).
// Each written by the store with what caused it, once; read and cleared by
// the owner; the three Settings -> Notifications switches.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore, LIVE_PACK_ODDS, cardSet, rollPack, type Notification } from "../src/index.js";

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

function owner(store: EconomyStore, name: string, kind: "player" | "house" = "player") {
  const o = store.createOwner({ name, kind });
  const { copies } = store.grantStarterCollection(o.ownerId, kind === "house" ? "Swarm" : "Cortex");
  store.setActiveDeck(o.ownerId, store.saveDeck(o.ownerId, "starter", copies.map((c) => c.copyId)).deckId);
  const a = store.createAgent({ ownerId: o.ownerId, name: `${name}-agent` });
  store.connectAgent(o.ownerId, a.agentId);
  return { ownerId: o.ownerId, agentId: a.agentId };
}

let n = 0;
type Side = { ownerId: string; agentId: string };
const record = (s: EconomyStore, p1: Side, p2: Side, outcome: "p1" | "p2" | "draw" | "cancelled" | "abandonedByP1") =>
  s.recordMatch({
    matchId: `nt-${++n}`,
    seed: n,
    p1AgentId: p1.agentId,
    p2AgentId: p2.agentId,
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

/** Settings with the daily pack switched off, so a test about another kind
 * reads only that kind (a new owner has a daily pack waiting). */
const quiet = (s: EconomyStore, ownerId: string) => s.updateAccountSettings(ownerId, { notifications: { dailyPack: false } });
const feed = (s: EconomyStore, ownerId: string, options = {}) => s.notifications(ownerId, options).notifications;
const kinds = (list: Notification[]) => list.map((x) => x.kind);

const S0 = cardSet("S0");
const ALL_RUNS = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));
const NO_PITY = { packsSinceFullArt: 0, packsSinceMythic: 0 };
const seedWhere = (want: (r: ReturnType<typeof rollPack>) => boolean) => {
  for (let seed = 0; seed < 1_000_000; seed++) if (want(rollPack(seed, S0, NO_PITY, ALL_RUNS, LIVE_PACK_ODDS))) return seed;
  throw new Error("no seed");
};
const BIG = new Set(["gold", "prototype", "secret", "zeroDay"]);

describe("notifications (schema v23): match results", () => {
  it("tells each player owner its own side of every outcome: win, loss, draw, cancel, abandon", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo");
    quiet(s, a.ownerId);
    quiet(s, b.ownerId);
    const m1 = record(s, a, b, "p1");
    const list = feed(s, a.ownerId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      kind: "matchResult",
      createdAt: m1.endedAt,
      readAt: null,
      matchResult: {
        matchId: m1.matchId,
        result: "win",
        agentId: a.agentId,
        agentName: "ada-agent",
        opponent: { ownerId: b.ownerId, ownerName: "bo", agentName: "bo-agent" },
        credits: m1.p1Credits,
        turns: 9,
      },
    });
    const r = list[0]!.kind === "matchResult" ? list[0]!.matchResult.rating! : null;
    expect(r!.before).toBe(m1.ratings!.p1.before.rating);
    expect(r!.after).toBe(m1.ratings!.p1.after.rating);
    expect(r!.change).toBeGreaterThan(0);
    const bSide = feed(s, b.ownerId)[0]!;
    expect(bSide).toMatchObject({ kind: "matchResult", matchResult: { result: "loss", credits: m1.p2Credits, opponent: { ownerName: "ada" } } });

    record(s, a, b, "draw");
    record(s, a, b, "cancelled");
    record(s, a, b, "abandonedByP1");
    const results = (ownerId: string) => feed(s, ownerId).map((x) => (x.kind === "matchResult" ? x.matchResult.result : x.kind));
    expect(results(a.ownerId)).toEqual(["abandonedByYou", "cancelled", "draw", "win"]);
    expect(results(b.ownerId)).toEqual(["abandonedByOpponent", "cancelled", "draw", "loss"]);
    // A cancel is never rated and pays nothing; the owner is still told.
    const cancel = feed(s, a.ownerId)[1]!;
    expect(cancel).toMatchObject({ kind: "matchResult", matchResult: { result: "cancelled", credits: 0, rating: null } });
  });

  it("house owners get none (no person to tell); the schema refuses one too", () => {
    const s = open();
    const a = owner(s, "ada");
    const h = owner(s, "house", "house");
    quiet(s, a.ownerId);
    record(s, a, h, "p2");
    expect(kinds(feed(s, a.ownerId))).toEqual(["matchResult"]);
    expect(s.notifications(h.ownerId)).toMatchObject({ notifications: [], unread: 0 });
    expect(() =>
      s.unsafeExec(`INSERT INTO notifications (owner_id, kind, ref, created_at, body_json) VALUES ('${h.ownerId}', 'matchResult', 'x', '${START}', '{}')`),
    ).toThrow(/only a player owner/);
  });

  it("the match results switch: off writes none from then on, the ones already written stay", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo");
    quiet(s, a.ownerId);
    record(s, a, b, "p1");
    s.updateAccountSettings(a.ownerId, { notifications: { matchResults: false } });
    record(s, a, b, "p1");
    expect(feed(s, a.ownerId)).toHaveLength(1);
    // Bo's switch is Bo's own.
    expect(feed(s, b.ownerId).filter((x) => x.kind === "matchResult")).toHaveLength(2);
    s.updateAccountSettings(a.ownerId, { notifications: { matchResults: true } });
    record(s, a, b, "p2");
    expect(feed(s, a.ownerId)).toHaveLength(2);
  });
});

describe("notifications: big pulls", () => {
  it("a pack the ceremony gives its full reveal is a big pull, naming the cards that made it; any other pack isn't", () => {
    const s = open();
    const a = owner(s, "ada");
    quiet(s, a.ownerId);
    const bigSeed = seedWhere((r) => !r.jackpot && r.pulls.some((p) => BIG.has(p.finish)));
    const plainSeed = seedWhere((r) => !r.jackpot && !r.pulls.some((p) => BIG.has(p.finish)));
    for (let i = 0; i < 2; i++) s.grantPack(a.ownerId, "S0", "weeklyChallenge");
    const plain = s.openPack(a.ownerId, undefined, { seed: plainSeed });
    expect(plain.fullReveal).toBe(false);
    expect(feed(s, a.ownerId)).toEqual([]);
    const big = s.openPack(a.ownerId, undefined, { seed: bigSeed });
    expect(big.fullReveal).toBe(true);
    const list = feed(s, a.ownerId);
    expect(list).toHaveLength(1);
    const hits = big.cards.filter((c) => BIG.has(c.finish));
    expect(list[0]).toMatchObject({
      kind: "bigPull",
      createdAt: big.openedAt,
      bigPull: {
        packId: big.packId,
        setCode: "S0",
        jackpot: false,
        cards: hits.map((c) => ({ copyId: c.copyId, cardId: c.cardId, name: c.name, rarity: c.rarity, finish: c.finish, isNew: c.isNew, prototype: c.prototype })),
      },
    });
  });

  it("a ten-pack open tells each big pull once; the big pulls switch turns them off", () => {
    const s = open();
    const a = owner(s, "ada");
    quiet(s, a.ownerId);
    const seeds = Array.from({ length: 10 }, (_, i) => seedWhere((r) => !r.jackpot && (i % 3 === 0 ? r.pulls.some((p) => BIG.has(p.finish)) : !r.pulls.some((p) => BIG.has(p.finish)))));
    for (let i = 0; i < 20; i++) s.grantPack(a.ownerId, "S0", "weeklyChallenge");
    const bulk = s.openPacks(a.ownerId, 10, { seeds });
    const list = feed(s, a.ownerId);
    expect(list.map((x) => (x.kind === "bigPull" ? x.bigPull.packId : null)).reverse()).toEqual(bulk.summary.fullReveals);
    expect(list).toHaveLength(4);
    s.updateAccountSettings(a.ownerId, { notifications: { bigPulls: false } });
    s.openPacks(a.ownerId, 10, { seeds });
    expect(feed(s, a.ownerId)).toHaveLength(4);
  });
});

describe("notifications: the free daily pack", () => {
  it("is written once per Sydney day while a pack waits, when the owner looks; claiming the last one reads it", () => {
    const s = open();
    const a = owner(s, "ada");
    const first = feed(s, a.ownerId);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ kind: "dailyPack", readAt: null, dailyPack: { day: "2026-11-02", waiting: 1, cap: 2 } });
    // A new owner's first pack is ready from the moment the account was made.
    expect(first[0]!.kind === "dailyPack" && first[0]!.dailyPack.readySince).toBe(START);
    // Looking again the same day writes nothing more.
    later(60);
    expect(feed(s, a.ownerId)).toHaveLength(1);
    s.claimDailyPack(a.ownerId);
    expect(s.notifications(a.ownerId)).toMatchObject({ unread: 0 });
    expect(feed(s, a.ownerId)[0]!.readAt).toBe(clock.toISOString());
    // Nothing waits for the rest of the day.
    later(60);
    expect(feed(s, a.ownerId)).toHaveLength(1);
    // The next Sydney day: a new one, from that day's midnight.
    clock = new Date("2026-11-02T15:30:00.000Z"); // 02:30 Tue 3 Nov, Sydney
    const next = feed(s, a.ownerId);
    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({ kind: "dailyPack", readAt: null, dailyPack: { day: "2026-11-03", readySince: "2026-11-02T13:00:00.000Z", waiting: 1 } });
  });

  it("the daily pack switch off writes none; a house owner gets none", () => {
    const s = open();
    const a = owner(s, "ada");
    quiet(s, a.ownerId);
    expect(feed(s, a.ownerId)).toEqual([]);
    const h = owner(s, "house", "house");
    expect(feed(s, h.ownerId)).toEqual([]);
  });
});

describe("notifications: auto-play switched off", () => {
  it("at the day's rewards cap: told once, with the day; it has no switch", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo");
    s.updateAccountSettings(a.ownerId, { notifications: { dailyPack: false, matchResults: false, bigPulls: false } });
    s.setAutoPlay(a.ownerId, true);
    for (let i = 0; i < 10; i++) record(s, a, b, "p1");
    expect(feed(s, a.ownerId)).toEqual([]);
    expect(s.stopAutoPlayIfMaxed(a.ownerId)).toBe(true);
    expect(s.stopAutoPlayIfMaxed(a.ownerId)).toBe(false);
    const list = feed(s, a.ownerId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "autoPlayStopped", createdAt: START, autoPlayStopped: { reason: "dailyRewardsMaxed", day: "2026-11-02", allowanceMinutes: null } });
  });

  it("time up: told once the last match is recorded and the server switches it off, with the allowance's length", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo");
    s.updateAccountSettings(a.ownerId, { notifications: { dailyPack: false, matchResults: false } });
    s.setAutoPlay(a.ownerId, true, 15);
    const matchId = "nt-live";
    s.startMatch({ matchId, p1OwnerId: a.ownerId, p2OwnerId: b.ownerId });
    later(20); // time up, still finishing its match
    expect(s.stopAutoPlayIfTimeUp(a.ownerId)).toBe(false);
    expect(feed(s, a.ownerId)).toEqual([]);
    s.recordMatch({ matchId, seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: b.agentId } });
    expect(s.stopAutoPlayIfTimeUp(a.ownerId)).toBe(true);
    expect(s.stopAutoPlayTimeUp()).toEqual([]);
    const list = feed(s, a.ownerId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "autoPlayStopped", createdAt: clock.toISOString(), autoPlayStopped: { reason: "timeUp", day: "2026-11-02", allowanceMinutes: 15 } });
    // Started again the same day and run out again: a second one.
    s.setAutoPlay(a.ownerId, true, 15);
    later(16);
    expect(s.stopAutoPlayTimeUp()).toEqual([a.ownerId]);
    expect(feed(s, a.ownerId).map((x) => x.kind)).toEqual(["autoPlayStopped", "autoPlayStopped"]);
  });
});

describe("notifications: reading, clearing, paging", () => {
  function busy() {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo");
    quiet(s, a.ownerId);
    quiet(s, b.ownerId);
    for (let i = 0; i < 5; i++) {
      later(10);
      record(s, a, b, i % 2 === 0 ? "p1" : "p2");
    }
    return { s, a, b };
  }

  it("lists newest first in pages, with `more` and a `before` cursor, and filters by kind; unread counts stay whole", () => {
    const { s, a } = busy();
    s.grantPack(a.ownerId, "S0", "weeklyChallenge");
    s.openPack(a.ownerId, undefined, { seed: seedWhere((r) => !r.jackpot && r.pulls.some((p) => BIG.has(p.finish))) });
    const page1 = s.notifications(a.ownerId, { limit: 4 });
    expect(page1.notifications).toHaveLength(4);
    expect(page1.more).toBe(true);
    expect(page1.unread).toBe(6);
    expect(page1.unreadByKind).toEqual({ matchResult: 5, bigPull: 1, dailyPack: 0, autoPlayStopped: 0 });
    expect(kinds(page1.notifications)[0]).toBe("bigPull");
    const ids = page1.notifications.map((x) => x.notificationId);
    expect([...ids].sort((x, y) => y - x)).toEqual(ids);
    const page2 = s.notifications(a.ownerId, { limit: 4, before: ids.at(-1)! });
    expect(page2.notifications).toHaveLength(2);
    expect(page2.more).toBe(false);
    expect(page2.notifications.every((x) => x.notificationId < ids.at(-1)!)).toBe(true);
    const onlyPulls = s.notifications(a.ownerId, { kind: "bigPull" });
    expect(kinds(onlyPulls.notifications)).toEqual(["bigPull"]);
    expect(onlyPulls.unread).toBe(6);
    expect(() => s.notifications(a.ownerId, { kind: "nope" as never })).toThrow(/no notification kind "nope"/);
    expect(() => s.notifications(a.ownerId, { limit: 0 })).toThrow(/1 to 100/);
  });

  it("marks some or all read (once: read stays read), and clears some or all (gone from the feed, read)", () => {
    const { s, a, b } = busy();
    const [n5, n4, n3, n2, n1] = feed(s, a.ownerId).map((x) => x.notificationId);
    later(1);
    expect(s.markNotificationsRead(a.ownerId, [n5!, n4!, n4!])).toEqual({ marked: 2, unread: 3 });
    const readAt = clock.toISOString();
    later(1);
    expect(s.markNotificationsRead(a.ownerId, [n5!])).toEqual({ marked: 0, unread: 3 });
    expect(feed(s, a.ownerId)[0]!.readAt).toBe(readAt);
    expect(s.clearNotifications(a.ownerId, [n3!])).toEqual({ cleared: 1, unread: 2 });
    expect(feed(s, a.ownerId).map((x) => x.notificationId)).toEqual([n5, n4, n2, n1]);
    // A cleared one, another owner's, or a made-up id reads as missing, and nothing changes.
    const bs = feed(s, b.ownerId)[0]!.notificationId;
    for (const bad of [n3!, bs, 9999]) {
      expect(() => s.markNotificationsRead(a.ownerId, [n2!, bad])).toThrow(`no notification ${bad}`);
      expect(() => s.clearNotifications(a.ownerId, [bad])).toThrow(`no notification ${bad}`);
    }
    expect(s.notifications(a.ownerId).unread).toBe(2);
    expect(s.markNotificationsRead(a.ownerId, "all")).toEqual({ marked: 2, unread: 0 });
    expect(s.clearNotifications(a.ownerId, "all")).toEqual({ cleared: 4, unread: 0 });
    expect(s.notifications(a.ownerId)).toMatchObject({ notifications: [], more: false, unread: 0 });
    // Bo's are untouched.
    expect(s.notifications(b.ownerId).unread).toBe(5);
  });
});

describe("notifications: the schema", () => {
  it("guards the rows: a known kind, one per source, text and times kept, read and cleared once, never deleted", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo");
    quiet(s, a.ownerId);
    const m = record(s, a, b, "p1");
    const id = feed(s, a.ownerId)[0]!.notificationId;
    const exec = (sql: string) => () => s.unsafeExec(sql);
    expect(exec(`INSERT INTO notifications (owner_id, kind, ref, created_at, body_json) VALUES ('${a.ownerId}', 'gossip', 'x', '${START}', '{}')`)).toThrow(/CHECK/);
    expect(exec(`INSERT INTO notifications (owner_id, kind, ref, created_at, body_json) VALUES ('${a.ownerId}', 'matchResult', '${m.matchId}', '${START}', '{}')`)).toThrow(/UNIQUE/);
    expect(exec(`INSERT INTO notifications (owner_id, kind, ref, created_at, body_json) VALUES ('${a.ownerId}', 'bigPull', 'p', '${START}', '[1]')`)).toThrow(/CHECK/);
    expect(exec(`UPDATE notifications SET body_json = '{}' WHERE notification_id = ${id}`)).toThrow(/never change/);
    expect(exec(`UPDATE notifications SET created_at = '2030-01-01' WHERE notification_id = ${id}`)).toThrow(/never change/);
    expect(exec(`UPDATE notifications SET read_at = '2020-01-01' WHERE notification_id = ${id}`)).toThrow(/CHECK/);
    s.markNotificationsRead(a.ownerId, [id]);
    expect(exec(`UPDATE notifications SET read_at = NULL WHERE notification_id = ${id}`)).toThrow(/read once/);
    s.clearNotifications(a.ownerId, [id]);
    expect(exec(`UPDATE notifications SET cleared_at = NULL WHERE notification_id = ${id}`)).toThrow(/cleared once/);
    expect(exec(`DELETE FROM notifications WHERE notification_id = ${id}`)).toThrow(/never deleted/);
    expect(exec(`UPDATE account_settings SET notify_big_pulls = 2 WHERE owner_id = '${a.ownerId}'`)).toThrow(/CHECK/);
  });

  it("a v22 file migrates: saved settings get every switch on, nothing is told of the past; a store held at v22 has none", () => {
    const dir = mkdtempSync(join(tmpdir(), "notif-"));
    tmpDirs.push(dir);
    const path = join(dir, "v22.db");
    const v22 = open(path, 22);
    const a = owner(v22, "ada");
    const b = owner(v22, "bo");
    v22.updateAccountSettings(a.ownerId, { theme: "dark" });
    record(v22, a, b, "p1");
    expect(v22.notifications(a.ownerId)).toMatchObject({ notifications: [], unread: 0 });
    expect(v22.accountSettings(a.ownerId).notifications).toEqual({ bigPulls: true, matchResults: true, dailyPack: true });
    expect(() => v22.updateAccountSettings(a.ownerId, { notifications: { bigPulls: false } })).toThrow(/needs schema v23/);
    expect(() => v22.markNotificationsRead(a.ownerId, "all")).toThrow(/notifications need schema v23/);
    v22.close();
    const v23 = open(path);
    expect(v23.schemaVersion).toBe(28);
    expect(v23.accountSettings(a.ownerId)).toMatchObject({ theme: "dark", notifications: { bigPulls: true, matchResults: true, dailyPack: true } });
    // The match before the migration isn't told; today's daily pack is (it waits now).
    expect(kinds(feed(v23, a.ownerId))).toEqual(["dailyPack"]);
    record(v23, a, b, "p2");
    expect(kinds(feed(v23, a.ownerId))).toEqual(["matchResult", "dailyPack"]);
  });
});
