// Auto-play (schema v18; owner app spec 2026-10-05 E): the owner's switch,
// refused while today's rewards are maxed, turned off by the server once
// they are (with the reason, shown that Sydney day only), and back on the
// next day.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "../src/index.js";

// 10:00 Mon 2 Nov in Sydney (AEDT, UTC+11).
const START = "2026-11-01T23:00:00.000Z";
let clock = new Date(START);
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo });
const tmpDirs: string[] = [];
afterEach(() => {
  clock = new Date(START);
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function owner(store: EconomyStore, name: string, kind: "player" | "house" = "player") {
  const o = store.createOwner({ name, kind });
  const a = store.createAgent({ ownerId: o.ownerId, name: `${name}-agent` });
  store.connectAgent(o.ownerId, a.agentId);
  return { ownerId: o.ownerId, agentId: a.agentId };
}

let n = 0;
function win(store: EconomyStore, winner: { agentId: string }, loser: { agentId: string }) {
  clock = new Date(clock.getTime() + 60_000);
  return store.recordMatch({ matchId: `ap-${++n}`, seed: n, p1AgentId: winner.agentId, p2AgentId: loser.agentId, outcome: { kind: "win", winnerAgentId: winner.agentId } });
}

describe("auto-play (schema v18)", () => {
  it("is off until the owner turns it on; on and off again; listed while on", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo");
    expect(s.autoPlay(a.ownerId)).toEqual({ on: false, changedAt: null, stopped: null, dailyRewardsMaxed: false, canTurnOn: true, allowance: null, canAddTime: false });
    expect(s.setAutoPlay(a.ownerId, true)).toMatchObject({ on: true, changedAt: clock.toISOString(), stopped: null });
    s.setAutoPlay(b.ownerId, true);
    expect(s.autoPlayOwners()).toEqual([a.ownerId, b.ownerId]);
    expect(s.setAutoPlay(a.ownerId, false).on).toBe(false);
    expect(s.autoPlayOwners()).toEqual([b.ownerId]);
  });

  it("house owners always play: their switch is refused", () => {
    const s = open();
    const h = owner(s, "house", "house");
    expect(() => s.setAutoPlay(h.ownerId, true)).toThrow(/house owners always play/);
  });

  it("goes off by itself once the day's rewards are maxed (the 10th win), with the reason that day only; back on the next day", () => {
    const s = open();
    const a = owner(s, "ada");
    const b = owner(s, "bo");
    s.setAutoPlay(a.ownerId, true);
    for (let i = 0; i < 9; i++) {
      win(s, a, b);
      expect(s.stopAutoPlayIfMaxed(a.ownerId)).toBe(false);
    }
    expect(s.autoPlay(a.ownerId)).toMatchObject({ on: true, dailyRewardsMaxed: false });
    win(s, a, b); // the 10th rewarded win
    expect(s.dailyEarnings(a.ownerId).nextWinPays).toBe(0);
    expect(s.stopAutoPlayIfMaxed(a.ownerId)).toBe(true);
    expect(s.stopAutoPlayIfMaxed(a.ownerId)).toBe(false); // already off
    expect(s.autoPlay(a.ownerId)).toMatchObject({ on: false, stopped: { reason: "dailyRewardsMaxed", day: "2026-11-02" }, dailyRewardsMaxed: true, canTurnOn: false });
    expect(s.autoPlayOwners()).toEqual([]);
    expect(() => s.setAutoPlay(a.ownerId, true)).toThrow(/today's rewards are maxed/);
    // Turning it off is always allowed (and clears nothing harmful).
    expect(s.setAutoPlay(a.ownerId, false)).toMatchObject({ on: false, stopped: null });
    // The loser's switch was never on, so the server leaves it alone.
    expect(s.stopAutoPlayIfMaxed(b.ownerId)).toBe(false);

    // After midnight Sydney: the message is gone and it can go on again.
    const t = open();
    const c = owner(t, "cy");
    const d = owner(t, "di");
    t.setAutoPlay(c.ownerId, true);
    for (let i = 0; i < 10; i++) win(t, c, d);
    t.stopAutoPlayIfMaxed(c.ownerId);
    clock = new Date("2026-11-02T13:00:00.000Z"); // 00:00 Tue 3 Nov Sydney
    expect(t.autoPlay(c.ownerId)).toMatchObject({ on: false, stopped: null, dailyRewardsMaxed: false, canTurnOn: true });
    expect(t.setAutoPlay(c.ownerId, true).on).toBe(true);
  });

  it("the schema guards the row (a reason only while off; a day with every reason), and a v17 file migrates with every switch off", () => {
    const dir = mkdtempSync(join(tmpdir(), "autoplay-"));
    tmpDirs.push(dir);
    const path = join(dir, "s.db");
    const v17 = open(path, 17);
    const o = v17.createOwner({ name: "old" });
    v17.close();
    const v18 = open(path);
    expect(v18.schemaVersion).toBe(22);
    expect(v18.autoPlay(o.ownerId).on).toBe(false);
    v18.setAutoPlay(o.ownerId, true);
    const exec = (sql: string) => () => v18.unsafeExec(sql);
    expect(exec(`UPDATE auto_play SET stopped_reason = 'dailyRewardsMaxed', stopped_day = '2026-11-02' WHERE owner_id = '${o.ownerId}'`)).toThrow(/CHECK/);
    expect(exec(`UPDATE auto_play SET is_on = 0, stopped_reason = 'dailyRewardsMaxed' WHERE owner_id = '${o.ownerId}'`)).toThrow(/CHECK/);
    expect(exec(`UPDATE auto_play SET is_on = 0, stopped_reason = 'bored', stopped_day = '2026-11-02' WHERE owner_id = '${o.ownerId}'`)).toThrow(/CHECK/);
    expect(exec(`UPDATE auto_play SET is_on = 2 WHERE owner_id = '${o.ownerId}'`)).toThrow(/CHECK/);
    v18.close();
  });
});
