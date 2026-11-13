// The season's end time (schema v29, session 94; owner 2026-11-13: "the
// season's end is decided by the server, not the player; the end time is set
// before the season starts", and Season 0 ends at midnight Sydney at the end
// of 26 Dec 2026, 13:00 UTC). The store holds the time and refuses a match
// from it; the live ladder ends the season (server/test/seasonSchedule.test.ts).

import { describe, expect, it } from "vitest";
import { EconomyStore, SEASON_END_TIMES } from "../src/index.js";

let clock = new Date("2026-12-05T00:00:00.000Z");
const open = (migrateTo?: number) => EconomyStore.open(":memory:", { now: () => clock, migrateTo });

function owner(store: EconomyStore, name: string) {
  const o = store.createOwner({ name, kind: "house" });
  const { copies } = store.grantStarterCollection(o.ownerId, "Swarm");
  store.setActiveDeck(o.ownerId, store.saveDeck(o.ownerId, "starter", copies.map((c) => c.copyId)).deckId);
  const a = store.createAgent({ ownerId: o.ownerId, name: `${name}-agent` });
  store.connectAgent(o.ownerId, a.agentId);
  return { ownerId: o.ownerId, agentId: a.agentId };
}

describe("the season's end time (schema v29)", () => {
  it("Season 0's end time is the owner's: 00:00 27 Dec Sydney", () => {
    expect(SEASON_END_TIMES.S0).toBe("2026-12-26T13:00:00.000Z");
    expect(new Date(SEASON_END_TIMES.S0!).toLocaleString("en-AU", { timeZone: "Australia/Sydney", hour12: false })).toMatch(/^27\/12\/2026, 00:00:00$/);
  });

  it("is none until set; set, it can be replaced while open; a past or bad time is refused", () => {
    clock = new Date("2026-12-05T00:00:00.000Z");
    const s = open();
    expect(s.seasonSchedule()).toBeNull();
    expect(s.seasonEndDue()).toBe(false);
    expect(s.setSeasonEndTime("2026-12-26T13:00:00Z")).toEqual({ endsAt: "2026-12-26T13:00:00.000Z", setAt: "2026-12-05T00:00:00.000Z" });
    expect(s.setSeasonEndTime("2026-12-27T13:00:00.000Z").endsAt).toBe("2026-12-27T13:00:00.000Z");
    expect(() => s.setSeasonEndTime("2026-12-01T00:00:00Z")).toThrow(/already passed/);
    expect(() => s.setSeasonEndTime("soon")).toThrow(/isn't a time/);
    expect(() => open(28).setSeasonEndTime("2026-12-26T13:00:00Z")).toThrow(/needs schema v29/);
  });

  it("from the end time no match starts, and the end is due; once ended the time is fixed", () => {
    clock = new Date("2026-12-26T12:50:00.000Z");
    const s = open();
    const a = owner(s, "a");
    const b = owner(s, "b");
    s.setSeasonEndTime("2026-12-26T13:00:00.000Z");
    s.startMatch({ matchId: "last", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId });
    clock = new Date("2026-12-26T13:00:00.000Z");
    expect(s.seasonEndDue()).toBe(true);
    expect(() => s.startMatch({ matchId: "late", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId })).toThrow(/end time \(2026-12-26T13:00:00.000Z\) has passed: no match starts/);
    // The match on screen at the end time is recorded, then the season ends.
    clock = new Date("2026-12-26T13:07:00.000Z");
    s.recordMatch({ matchId: "last", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: a.agentId } });
    const end = s.endSeason();
    expect(end.endedAt).toBe("2026-12-26T13:07:00.000Z");
    expect(s.seasonEndDue()).toBe(false);
    expect(s.seasonSchedule()?.endsAt).toBe("2026-12-26T13:00:00.000Z");
    expect(() => s.setSeasonEndTime("2027-01-01T00:00:00Z")).toThrow(/has ended: its end time is fixed/);
    expect(() => s.unsafeExec("DELETE FROM season_schedule")).toThrow(/end time is fixed/);
    expect(() => s.unsafeExec("UPDATE season_schedule SET ends_at = '2027-01-01T00:00:00.000Z'")).toThrow(/end time is fixed/);
  });
});
