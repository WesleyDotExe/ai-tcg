import { describe, expect, it } from "vitest";
import { dailyPacksWaiting, EconomyStore, OWNER_DAILY_PACK_CAP } from "../src/index.js";

// Session 65 (owner 2026-11-01: "add the daily pack in session 65"; the rule
// is the owner's 2026-10-04 spec: "one free pack a day that only the owner
// can claim, stacking up to 2"; the day resets at midnight Sydney).

describe("the daily pack bank (pure)", () => {
  const cap = 2;
  it("a new owner has one on its first day; unclaimed days stack to the cap", () => {
    expect(dailyPacksWaiting("2026-11-01", [], "2026-11-01", cap)).toBe(1);
    expect(dailyPacksWaiting("2026-11-01", [], "2026-11-02", cap)).toBe(2);
    expect(dailyPacksWaiting("2026-11-01", [], "2026-12-25", cap)).toBe(2);
    expect(dailyPacksWaiting("2026-11-01", [], "2026-10-31", cap)).toBe(0);
  });

  it("claims come out of the bank; a full day adds nothing", () => {
    // Day 1 claimed, day 2 nothing claimed: one waiting on day 2.
    expect(dailyPacksWaiting("2026-11-01", ["2026-11-01"], "2026-11-01", cap)).toBe(0);
    expect(dailyPacksWaiting("2026-11-01", ["2026-11-01"], "2026-11-02", cap)).toBe(1);
    // Away five days, back: 2 waiting, claim both, none until tomorrow.
    expect(dailyPacksWaiting("2026-11-01", ["2026-11-01", "2026-11-06", "2026-11-06"], "2026-11-06", cap)).toBe(0);
    expect(dailyPacksWaiting("2026-11-01", ["2026-11-01", "2026-11-06", "2026-11-06"], "2026-11-07", cap)).toBe(1);
    // Full on day 3 (days 2 and 3 unclaimed), one claimed on day 4: day 4
    // added nothing (full), so one is left, and day 5 refills to two.
    expect(dailyPacksWaiting("2026-11-01", ["2026-11-01", "2026-11-04"], "2026-11-04", cap)).toBe(1);
    expect(dailyPacksWaiting("2026-11-01", ["2026-11-01", "2026-11-04"], "2026-11-05", cap)).toBe(2);
    // Claim order in the list doesn't matter.
    expect(dailyPacksWaiting("2026-11-01", ["2026-11-06", "2026-11-01", "2026-11-06"], "2026-11-06", cap)).toBe(0);
  });

  it("never more than one a day over any stretch, and never more than the cap ahead", () => {
    // Claiming every pack as soon as it's there, for 400 days across both
    // daylight-saving changes: exactly one a day.
    const claims: string[] = [];
    const day = (i: number) => new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10);
    for (let i = 0; i < 400; i++) {
      const w = dailyPacksWaiting(day(0), claims, day(i), cap);
      expect(w).toBe(1);
      claims.push(day(i));
    }
    // Any claim pattern: total packs claimed by day N is at most N + 1 days' worth.
    const rng = (() => {
      let x = 12345;
      return () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    })();
    const some: string[] = [];
    for (let i = 0; i < 300; i++) {
      let w = dailyPacksWaiting(day(0), some, day(i), cap);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(cap);
      while (w > 0 && rng() < 0.5) {
        some.push(day(i));
        w--;
        expect(dailyPacksWaiting(day(0), some, day(i), cap)).toBe(w);
      }
      expect(some.length).toBeLessThanOrEqual(i + 1);
    }
  });

  it("a pack granted past the bank (outside the claim) empties it, it doesn't owe", () => {
    expect(dailyPacksWaiting("2026-11-01", ["2026-11-01", "2026-11-01", "2026-11-01"], "2026-11-01", cap)).toBe(0);
    expect(dailyPacksWaiting("2026-11-01", ["2026-11-01", "2026-11-01", "2026-11-01"], "2026-11-02", cap)).toBe(1);
    expect(() => dailyPacksWaiting("2026-11-01", [], "2026-11-01", 0)).toThrow(/cap/);
    expect(() => dailyPacksWaiting("1 Nov", [], "2026-11-01", cap)).toThrow(/not a reset day/);
  });
});

describe("the daily pack in the store: per owner, on the Sydney day", () => {
  // 21:00 on 1 Nov in Sydney (AEDT, +11); Sydney midnight is 13:00 UTC.
  let clock = new Date("2026-11-01T10:00:00.000Z");
  const set = (iso: string) => (clock = new Date(iso));
  const open = () => EconomyStore.open(":memory:", { now: () => clock });

  it("claims one a day, refuses when none waits, and the next comes in at Sydney midnight", () => {
    set("2026-11-01T10:00:00.000Z");
    const s = open();
    const ada = s.createOwner({ name: "ada" }).ownerId;
    expect(OWNER_DAILY_PACK_CAP).toBe(2);
    expect(s.dailyPackStatus(ada)).toEqual({
      setCode: "S0",
      waiting: 1,
      cap: 2,
      day: "2026-11-01",
      timeZone: "Australia/Sydney",
      resetsAt: "2026-11-01T13:00:00.000Z",
      nextPackAt: "2026-11-01T13:00:00.000Z",
      claimedToday: 0,
      lastClaimedAt: null,
    });
    const { pack, status } = s.claimDailyPack(ada);
    expect(pack).toMatchObject({ ownerId: ada, setCode: "S0", source: "ownerDaily", openedAt: null, acquiredAt: "2026-11-01T10:00:00.000Z" });
    expect(s.unopenedPacks(ada).map((p) => p.packId)).toEqual([pack.packId]);
    expect(status).toMatchObject({ waiting: 0, claimedToday: 1, lastClaimedAt: "2026-11-01T10:00:00.000Z", nextPackAt: "2026-11-01T13:00:00.000Z" });
    expect(() => s.claimDailyPack(ada)).toThrow("no daily pack to claim; the next one comes in at 2026-11-01T13:00:00.000Z");
    expect(s.unopenedPacks(ada)).toHaveLength(1);

    // 12:59:59 UTC is still 1 Nov in Sydney (11:59:59 pm): still none.
    set("2026-11-01T12:59:59.999Z");
    expect(s.dailyPackStatus(ada).waiting).toBe(0);
    // Sydney midnight (UTC is still 1 Nov): the next one is in.
    set("2026-11-01T13:00:00.000Z");
    expect(s.dailyPackStatus(ada)).toMatchObject({ day: "2026-11-02", waiting: 1, claimedToday: 0 });
  });

  it("stacks to two while the owner is away, then stops coming in until one is claimed", () => {
    set("2026-11-01T10:00:00.000Z");
    const s = open();
    const bo = s.createOwner({ name: "bo" }).ownerId;
    s.claimDailyPack(bo);
    set("2026-11-05T01:00:00.000Z");
    const full = s.dailyPackStatus(bo);
    expect(full).toMatchObject({ day: "2026-11-05", waiting: 2, nextPackAt: null });
    s.claimDailyPack(bo);
    expect(s.dailyPackStatus(bo)).toMatchObject({ waiting: 1, nextPackAt: "2026-11-05T13:00:00.000Z" });
    s.claimDailyPack(bo);
    expect(() => s.claimDailyPack(bo)).toThrow(/no daily pack to claim/);
    expect(s.unopenedPacks(bo).filter((p) => p.source === "ownerDaily")).toHaveLength(3);
  });

  it("is per owner: one owner's claims and agents don't touch another's", () => {
    set("2026-11-01T10:00:00.000Z");
    const s = open();
    const ada = s.createOwner({ name: "ada" }).ownerId;
    const bo = s.createOwner({ name: "bo" }).ownerId;
    s.createAgent({ ownerId: ada, name: "ada-one" });
    s.createAgent({ ownerId: ada, name: "ada-two" });
    s.claimDailyPack(ada);
    expect(s.dailyPackStatus(ada).waiting).toBe(0);
    expect(s.dailyPackStatus(bo).waiting).toBe(1);
    // Starter and bought packs aren't daily packs.
    s.grantStarterCollection(bo, "Swarm");
    expect(s.dailyPackStatus(bo).waiting).toBe(1);
    expect(() => s.dailyPackStatus("no-such-owner")).toThrow();
  });

  it("an owner made late in the Sydney day still gets that day's pack; the day is Sydney's, not UTC's", () => {
    // 23:30 Sydney on 1 Nov = 12:30 UTC.
    set("2026-11-01T12:30:00.000Z");
    const s = open();
    const cy = s.createOwner({ name: "cy" }).ownerId;
    s.claimDailyPack(cy);
    // 14:00 UTC is still 1 Nov in UTC but 2 Nov in Sydney: a new pack.
    set("2026-11-01T14:00:00.000Z");
    expect(s.dailyPackStatus(cy)).toMatchObject({ day: "2026-11-02", waiting: 1 });
    // Claimed then, it is 2 Nov's claim (the UTC date would say 1 Nov and
    // hand out a third pack in two days).
    s.claimDailyPack(cy);
    expect(s.dailyPackStatus(cy)).toMatchObject({ waiting: 0, claimedToday: 1 });
    expect(() => s.claimDailyPack(cy)).toThrow(/no daily pack to claim/);
  });

  it("the claim survives closing and reopening the file", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "daily-pack-"));
    try {
      set("2026-11-01T10:00:00.000Z");
      const path = join(dir, "season.db");
      let s = EconomyStore.open(path, { now: () => clock });
      const ada = s.createOwner({ name: "ada" }).ownerId;
      s.claimDailyPack(ada);
      s.close();
      s = EconomyStore.open(path, { now: () => clock });
      expect(s.dailyPackStatus(ada)).toMatchObject({ waiting: 0, claimedToday: 1 });
      expect(() => s.claimDailyPack(ada)).toThrow(/no daily pack/);
      s.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
