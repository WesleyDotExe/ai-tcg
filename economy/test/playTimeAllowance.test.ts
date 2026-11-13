// The play-time allowance on auto-play (schema v22, session 76; owner
// 2026-11-06, progress/season0-final-brief.md section 1): start with 15 / 30
// / 60 minutes, +15 / +30 while running; when time runs out the owner isn't
// queued again, finishes the match it is in ("finishing"), then is "done"
// for today; the window is cut at midnight Sydney, so unused time never
// carries over; no minutes is auto-play as before.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "../src/index.js";

// 10:00 Mon 2 Nov in Sydney (AEDT, UTC+11).
const START = "2026-11-01T23:00:00.000Z";
let clock = new Date(START);
const at = (iso: string) => (clock = new Date(iso));
const later = (minutes: number) => (clock = new Date(clock.getTime() + minutes * 60_000));
// (session 94) These are the v22-v28 rules, where the clock starts at the
// button: a v28 file. From v29 the clock starts at the agent's first pairing
// and then the same window rules apply (playTimeClock.test.ts).
const open = (path = ":memory:", migrateTo: number = 28) => EconomyStore.open(path, { now: () => clock, migrateTo });
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
const startLive = (s: EconomyStore, p1: { ownerId: string }, p2: { ownerId: string }) => {
  const matchId = `pt-${++n}`;
  s.startMatch({ matchId, p1OwnerId: p1.ownerId, p2OwnerId: p2.ownerId });
  return matchId;
};
const finish = (s: EconomyStore, matchId: string, p1: { agentId: string }, p2: { agentId: string }) =>
  s.recordMatch({ matchId, seed: n, p1AgentId: p1.agentId, p2AgentId: p2.agentId, outcome: { kind: "win", winnerAgentId: p2.agentId } });

describe("the play-time allowance (schema v22 to v28: the clock starts at the button)", () => {
  it("starts with 15, 30 or 60 minutes and counts down on the clock; queued while time is left", () => {
    const s = open();
    const a = owner(s, "ada");
    const on = s.setAutoPlay(a.ownerId, true, 30);
    expect(on).toMatchObject({
      on: true,
      stopped: null,
      canAddTime: true,
      allowance: { state: "running", label: "Running", startedAt: START, endsAt: "2026-11-01T23:30:00.000Z", totalMinutes: 30, secondsLeft: 1800, minutesLeft: 30, endsAtReset: false },
    });
    expect(s.autoPlayOwners()).toEqual([a.ownerId]);
    later(17.5);
    expect(s.autoPlay(a.ownerId).allowance).toMatchObject({ state: "running", secondsLeft: 750, minutesLeft: 13 });
    clock = new Date(Date.parse("2026-11-01T23:30:00.000Z") - 1000);
    expect(s.autoPlay(a.ownerId).allowance).toMatchObject({ secondsLeft: 1, minutesLeft: 1 });
    for (const m of [15, 60]) expect(s.setAutoPlay(a.ownerId, true, m).allowance?.totalMinutes).toBe(m);
  });

  it("refuses other minutes, minutes with off, and house owners", () => {
    const s = open();
    const a = owner(s, "ada");
    const h = owner(s, "house", "house");
    expect(() => s.setAutoPlay(a.ownerId, true, 45)).toThrow(/starts with 15, 30, 60 minutes/);
    expect(() => s.setAutoPlay(a.ownerId, false, 15)).toThrow(/minutes go with turning auto-play on/);
    expect(() => s.setAutoPlay(h.ownerId, true, 15)).toThrow(/house owners always play/);
    expect(() => s.addAutoPlayTime(h.ownerId, 15)).toThrow(/house owners always play/);
    expect(s.autoPlay(a.ownerId).on).toBe(false);
  });

  it("time up with no match: not queued, done for today, off with the reason; the server's write agrees with the read", () => {
    const s = open();
    const a = owner(s, "ada");
    s.setAutoPlay(a.ownerId, true, 15);
    later(15);
    expect(s.autoPlayOwners()).toEqual([]);
    const read = s.autoPlay(a.ownerId);
    expect(read).toMatchObject({ on: false, stopped: { reason: "timeUp", day: "2026-11-02" }, canTurnOn: true, canAddTime: false, allowance: { state: "done", label: "Time's up", secondsLeft: 0, minutesLeft: 0 } });
    expect(s.stopAutoPlayTimeUp()).toEqual([a.ownerId]);
    expect(s.stopAutoPlayIfTimeUp(a.ownerId)).toBe(false); // already off
    expect(s.autoPlay(a.ownerId)).toEqual({ ...read, changedAt: clock.toISOString() });
    expect(() => s.addAutoPlayTime(a.ownerId, 15)).toThrow(/start it with 15, 30 or 60 minutes/);
    // Starting again is allowed (there is no daily cap on time): a fresh window.
    expect(s.setAutoPlay(a.ownerId, true, 15)).toMatchObject({ on: true, stopped: null, allowance: { state: "running", minutesLeft: 15 } });
  });

  it("time up mid-match: finishing while the match is live (not queued, not stopped), done once it is recorded", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo", "house");
    s.setAutoPlay(a.ownerId, true, 15);
    later(10);
    const m = startLive(s, a, b);
    later(6);
    expect(s.autoPlay(a.ownerId)).toMatchObject({ on: true, stopped: null, canAddTime: true, allowance: { state: "finishing", label: "Finishing match", secondsLeft: 0 } });
    expect(s.autoPlayOwners()).toEqual([]);
    expect(s.stopAutoPlayTimeUp()).toEqual([]); // the match is still live
    later(3);
    finish(s, m, a, b);
    expect(s.autoPlay(a.ownerId).allowance?.state).toBe("done");
    expect(s.stopAutoPlayIfTimeUp(a.ownerId)).toBe(true);
    expect(s.autoPlay(a.ownerId)).toMatchObject({ on: false, stopped: { reason: "timeUp" }, allowance: { state: "done" } });
  });

  it("+15 / +30 while running adds to the end; while finishing opens a new window from now; refused without an allowance", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo", "house");
    expect(() => s.addAutoPlayTime(a.ownerId, 15)).toThrow(/isn't running on a time allowance/);
    s.setAutoPlay(a.ownerId, true); // no time limit
    expect(s.autoPlay(a.ownerId)).toMatchObject({ on: true, allowance: null, canAddTime: false });
    expect(() => s.addAutoPlayTime(a.ownerId, 15)).toThrow(/isn't running on a time allowance/);
    s.setAutoPlay(a.ownerId, true, 15);
    expect(() => s.addAutoPlayTime(a.ownerId, 60)).toThrow(/15 or 30 minutes at a time/);
    later(5);
    expect(s.addAutoPlayTime(a.ownerId, 30).allowance).toMatchObject({ state: "running", startedAt: START, endsAt: "2026-11-01T23:45:00.000Z", totalMinutes: 45, minutesLeft: 40 });
    later(30);
    const m = startLive(s, a, b);
    later(15);
    expect(s.autoPlay(a.ownerId).allowance?.state).toBe("finishing");
    const fresh = s.addAutoPlayTime(a.ownerId, 15);
    expect(fresh.allowance).toMatchObject({ state: "running", startedAt: clock.toISOString(), totalMinutes: 15, minutesLeft: 15 });
    expect(s.autoPlayOwners()).toEqual([a.ownerId]);
    finish(s, m, a, b);
    expect(s.stopAutoPlayIfTimeUp(a.ownerId)).toBe(false);
  });

  it("no carry-over: a window is cut at midnight Sydney, adding past it is refused, and the next day starts clean", () => {
    const s = open();
    const a = owner(s, "ada");
    at("2026-11-02T12:40:00.000Z"); // 23:40 Mon 2 Nov Sydney
    const on = s.setAutoPlay(a.ownerId, true, 60);
    expect(on.allowance).toMatchObject({ endsAt: "2026-11-02T13:00:00.000Z", totalMinutes: 20, minutesLeft: 20, endsAtReset: true });
    expect(on.canAddTime).toBe(false);
    expect(() => s.addAutoPlayTime(a.ownerId, 15)).toThrow(/runs to midnight Sydney/);
    // 23:30: 15 minutes end 23:45; +30 on top is cut at midnight too.
    at("2026-11-02T12:30:00.000Z");
    expect(s.setAutoPlay(a.ownerId, true, 15)).toMatchObject({ canAddTime: true, allowance: { endsAt: "2026-11-02T12:45:00.000Z", endsAtReset: false } });
    expect(s.addAutoPlayTime(a.ownerId, 30)).toMatchObject({ canAddTime: false, allowance: { endsAt: "2026-11-02T13:00:00.000Z", totalMinutes: 30, endsAtReset: true } });
    // Midnight: time up, done; the stop is Monday's, so Tuesday reads clean.
    at("2026-11-02T13:00:00.000Z");
    expect(s.autoPlay(a.ownerId)).toMatchObject({ on: false, stopped: null, allowance: null, canTurnOn: true });
    expect(s.stopAutoPlayTimeUp()).toEqual([a.ownerId]);
    expect(s.autoPlay(a.ownerId)).toMatchObject({ on: false, stopped: null, allowance: null });
    expect(s.setAutoPlay(a.ownerId, true, 15).allowance?.minutesLeft).toBe(15);
  });

  it("a match finishing past midnight: finishing shows on, then the stop belongs to the day the time ran out", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo", "house");
    at("2026-11-02T12:50:00.000Z");
    s.setAutoPlay(a.ownerId, true, 30);
    later(5);
    const m = startLive(s, a, b);
    at("2026-11-02T13:03:00.000Z"); // 00:03 Tue
    expect(s.autoPlay(a.ownerId).allowance).toMatchObject({ state: "finishing" });
    finish(s, m, a, b);
    expect(s.stopAutoPlayIfTimeUp(a.ownerId)).toBe(true);
    // The stop is written on Tuesday but belongs to Monday, when the time ran out.
    at("2026-11-02T12:59:00.000Z");
    expect(s.autoPlay(a.ownerId)).toMatchObject({ on: false, stopped: { reason: "timeUp", day: "2026-11-02" }, allowance: { state: "done" } });
    at("2026-11-02T13:03:00.000Z");
    expect(s.autoPlay(a.ownerId)).toMatchObject({ on: false, stopped: null, allowance: null });
  });

  it("turning off drops the allowance; turning on without minutes is no time limit; maxing the day's rewards clears it", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo");
    s.setAutoPlay(a.ownerId, true, 60);
    expect(s.setAutoPlay(a.ownerId, false)).toMatchObject({ on: false, allowance: null, stopped: null });
    expect(s.setAutoPlay(a.ownerId, true, 60).allowance?.state).toBe("running");
    expect(s.setAutoPlay(a.ownerId, true)).toMatchObject({ on: true, allowance: null });
    s.setAutoPlay(a.ownerId, true, 60);
    for (let i = 0; i < 10; i++) {
      later(1);
      s.recordMatch({ matchId: `max-${i}`, seed: i, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: a.agentId } });
    }
    expect(s.stopAutoPlayIfMaxed(a.ownerId)).toBe(true);
    expect(s.autoPlay(a.ownerId)).toMatchObject({ on: false, stopped: { reason: "dailyRewardsMaxed" }, allowance: null, canTurnOn: false });
    expect(() => s.setAutoPlay(a.ownerId, true, 15)).toThrow(/today's rewards are maxed/);
  });

  it("the schema guards the window, and a v21 file migrates with every switch kept and no allowance", () => {
    const dir = mkdtempSync(join(tmpdir(), "playtime-"));
    tmpDirs.push(dir);
    const path = join(dir, "s.db");
    const v21 = open(path, 21);
    const x = owner(v21, "on-before");
    const y = owner(v21, "off-before");
    v21.setAutoPlay(x.ownerId, true);
    v21.setAutoPlay(y.ownerId, true);
    v21.setAutoPlay(y.ownerId, false);
    expect(() => v21.setAutoPlay(x.ownerId, true, 15)).toThrow(/needs schema v22/);
    expect(v21.autoPlay(x.ownerId)).toMatchObject({ on: true, allowance: null });
    v21.close();
    const v22 = open(path);
    expect(v22.schemaVersion).toBe(28);
    expect(v22.autoPlay(x.ownerId)).toMatchObject({ on: true, allowance: null, changedAt: START });
    expect(v22.autoPlay(y.ownerId)).toMatchObject({ on: false, allowance: null });
    expect(v22.autoPlayOwners()).toEqual([x.ownerId]);
    const exec = (sql: string) => () => v22.unsafeExec(sql);
    const w = `WHERE owner_id = '${x.ownerId}'`;
    expect(exec(`UPDATE auto_play SET allowance_started_at = '${START}' ${w}`)).toThrow(/CHECK/);
    expect(exec(`UPDATE auto_play SET allowance_started_at = '${START}', allowance_ends_at = '${START}' ${w}`)).toThrow(/CHECK/);
    expect(exec(`UPDATE auto_play SET is_on = 0, stopped_reason = 'timeUp', stopped_day = '2026-11-02' ${w}`)).toThrow(/CHECK/);
    v22.setAutoPlay(x.ownerId, true, 15);
    expect(exec(`UPDATE auto_play SET is_on = 0 ${w}`)).toThrow(/CHECK/);
    expect(exec(`UPDATE auto_play SET is_on = 0, stopped_reason = 'dailyRewardsMaxed', stopped_day = '2026-11-02' ${w}`)).toThrow(/CHECK/);
    v22.unsafeExec(`UPDATE auto_play SET is_on = 0, stopped_reason = 'timeUp', stopped_day = '2026-11-02' ${w}`);
    v22.close();
  });
});
