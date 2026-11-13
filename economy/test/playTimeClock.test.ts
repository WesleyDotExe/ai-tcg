// The play-time allowance's clock starts at the agent's first pairing
// (schema v29, session 94; owner 2026-11-13, answer 1 to game session 93:
// "(a) the allowance's clock starts when the agent is first paired, not when
// the owner presses the button; until then the ring reads 'Waiting for the
// next round'"). The dry run (progress/season0-dry-run-001.txt) found that 15
// minutes switched on while a round was being shown bought one match: the
// agent waited ~11 minutes for the round to end. Once the clock starts, the
// v22 window rules apply unchanged (playTimeAllowance.test.ts).

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
const iso = () => clock.toISOString();
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
const startLive = (s: EconomyStore, p1: { ownerId: string }, p2: { ownerId: string }) => {
  const matchId = `pc-${++n}`;
  s.startMatch({ matchId, p1OwnerId: p1.ownerId, p2OwnerId: p2.ownerId });
  return matchId;
};
const finish = (s: EconomyStore, matchId: string, p1: { agentId: string }, p2: { agentId: string }) =>
  s.recordMatch({ matchId, seed: n, p1AgentId: p1.agentId, p2AgentId: p2.agentId, outcome: { kind: "win", winnerAgentId: p2.agentId } });

describe("the allowance's clock starts at the first pairing (schema v29)", () => {
  it("switched on, it waits: no window, the minutes chosen in full, queued, +time allowed", () => {
    const s = open();
    const a = owner(s, "ada");
    const on = s.setAutoPlay(a.ownerId, true, 15);
    expect(on).toMatchObject({
      on: true,
      stopped: null,
      canAddTime: true,
      allowance: { state: "waiting", label: "Waiting for the next round", startedAt: null, endsAt: null, totalMinutes: 15, secondsLeft: 900, minutesLeft: 15, endsAtReset: false },
    });
    expect(s.autoPlayOwners()).toEqual([a.ownerId]);
    // Eleven minutes of a round being shown: nothing is used up.
    later(11);
    expect(s.autoPlay(a.ownerId).allowance).toMatchObject({ state: "waiting", secondsLeft: 900 });
    expect(s.stopAutoPlayTimeUp()).toEqual([]);
    expect(s.autoPlayOwners()).toEqual([a.ownerId]);
  });

  it("the pairing starts the clock: the window runs from the match's start, for the minutes chosen", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo", "house");
    s.setAutoPlay(a.ownerId, true, 15);
    later(11);
    const paired = iso();
    const m = startLive(s, a, b);
    expect(s.autoPlay(a.ownerId).allowance).toMatchObject({
      state: "running",
      label: "Running",
      startedAt: paired,
      endsAt: new Date(Date.parse(paired) + 15 * 60_000).toISOString(),
      totalMinutes: 15,
      minutesLeft: 15,
    });
    // The house side has no allowance; nothing of it changes.
    expect(s.autoPlay(b.ownerId).allowance).toBeNull();
    later(9);
    finish(s, m, a, b);
    expect(s.autoPlay(a.ownerId).allowance).toMatchObject({ state: "running", minutesLeft: 6 });
    // A second pairing doesn't restart it.
    const m2 = startLive(s, a, b);
    expect(s.autoPlay(a.ownerId).allowance?.startedAt).toBe(paired);
    later(8);
    expect(s.autoPlay(a.ownerId).allowance?.state).toBe("finishing");
    finish(s, m2, a, b);
    expect(s.stopAutoPlayIfTimeUp(a.ownerId)).toBe(true);
    expect(s.autoPlay(a.ownerId)).toMatchObject({ on: false, stopped: { reason: "timeUp" }, allowance: { state: "done", totalMinutes: 15 } });
  });

  it("+15 / +30 while waiting go on the minutes chosen", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo", "house");
    s.setAutoPlay(a.ownerId, true, 15);
    expect(s.addAutoPlayTime(a.ownerId, 30).allowance).toMatchObject({ state: "waiting", totalMinutes: 45, minutesLeft: 45 });
    expect(() => s.addAutoPlayTime(a.ownerId, 60)).toThrow(/15 or 30 minutes at a time/);
    later(3);
    startLive(s, a, b);
    expect(s.autoPlay(a.ownerId).allowance).toMatchObject({ state: "running", totalMinutes: 45, startedAt: iso() });
  });

  it("the window is still cut at midnight Sydney, worked out at the pairing (a wait across midnight carries the minutes)", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo", "house");
    at("2026-11-02T12:40:00.000Z"); // 23:40 Mon Sydney
    s.setAutoPlay(a.ownerId, true, 60);
    expect(s.autoPlay(a.ownerId).allowance).toMatchObject({ state: "waiting", totalMinutes: 60 });
    at("2026-11-02T12:50:00.000Z"); // paired 23:50: cut at midnight
    const m = startLive(s, a, b);
    expect(s.autoPlay(a.ownerId)).toMatchObject({ canAddTime: false, allowance: { state: "running", endsAt: "2026-11-02T13:00:00.000Z", totalMinutes: 10, endsAtReset: true } });
    finish(s, m, a, b);
    // Switched on at 23:55 and first paired at 00:05: the 60 minutes are Tuesday's.
    at("2026-11-02T13:00:00.000Z");
    s.stopAutoPlayTimeUp();
    at("2026-11-02T12:55:00.000Z");
    s.setAutoPlay(a.ownerId, true, 60);
    at("2026-11-02T13:05:00.000Z");
    expect(s.autoPlay(a.ownerId).allowance).toMatchObject({ state: "waiting", totalMinutes: 60 });
    startLive(s, a, b);
    expect(s.autoPlay(a.ownerId).allowance).toMatchObject({ state: "running", startedAt: "2026-11-02T13:05:00.000Z", endsAt: "2026-11-02T14:05:00.000Z", totalMinutes: 60 });
  });

  it("off drops a waiting allowance; maxing the day's rewards clears it; no minutes is no time limit", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo");
    s.setAutoPlay(a.ownerId, true, 30);
    expect(s.setAutoPlay(a.ownerId, false)).toMatchObject({ on: false, allowance: null });
    expect(s.setAutoPlay(a.ownerId, true)).toMatchObject({ on: true, allowance: null, canAddTime: false });
    s.setAutoPlay(a.ownerId, true, 30);
    for (let i = 0; i < 10; i++) {
      later(1);
      s.recordMatch({ matchId: `max-${i}`, seed: i, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: a.agentId } });
    }
    expect(s.stopAutoPlayIfMaxed(a.ownerId)).toBe(true);
    expect(s.autoPlay(a.ownerId)).toMatchObject({ on: false, stopped: { reason: "dailyRewardsMaxed" }, allowance: null });
  });

  it("the schema guards the waiting minutes; a v28 file migrates with its running window kept as it was", () => {
    const dir = mkdtempSync(join(tmpdir(), "playclock-"));
    tmpDirs.push(dir);
    const path = join(dir, "s.db");
    const v28 = open(path, 28);
    const x = owner(v28, "ran-before");
    v28.setAutoPlay(x.ownerId, true, 30); // v28: the clock starts at the button
    v28.close();
    later(5);
    const v29 = open(path);
    expect(v29.schemaVersion).toBe(29);
    expect(v29.autoPlay(x.ownerId).allowance).toMatchObject({ state: "running", startedAt: START, minutesLeft: 25 });
    const y = owner(v29, "waits");
    v29.setAutoPlay(y.ownerId, true, 15);
    const exec = (sql: string) => () => v29.unsafeExec(sql);
    const w = `WHERE owner_id = '${y.ownerId}'`;
    expect(exec(`UPDATE auto_play SET is_on = 0 ${w}`)).toThrow(/CHECK/);
    expect(exec(`UPDATE auto_play SET allowance_waiting_minutes = 0 ${w}`)).toThrow(/CHECK/);
    expect(exec(`UPDATE auto_play SET allowance_started_at = '${START}', allowance_ends_at = '2026-11-01T23:15:00.000Z' ${w}`)).toThrow(/CHECK/);
    v29.close();
  });
});
