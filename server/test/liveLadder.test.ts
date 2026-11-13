// The long-lived ladder (session 67): rounds on the clock, each match
// released a move at a time at watch speed and recorded only once the last
// move has been shown, the gap between rounds, and a restart mid-match.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { DeckFaction } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { clockJumpLine, LiveLadder } from "../src/ladder/liveLadder.js";
import type { LadderMatch } from "../src/ladder/ladderRunner.js";
import { stepHoldMs, WATCH_PACE_MS, watchLengthMs } from "../src/ladder/timeline.js";

function setup(factions: DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"]) {
  const clock = { t: Date.parse("2026-11-01T22:00:00.000Z") }; // 09:00 Mon in Sydney
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const owners = factions.map((f, i) => {
    const o = store.createOwner({ name: `house-${i}`, kind: "house" });
    store.grantStarterCollection(o.ownerId, f);
    const a = store.createAgent({ ownerId: o.ownerId, name: `Agent ${i}` });
    store.connectAgent(o.ownerId, a.agentId);
    return o.ownerId;
  });
  let n = 0;
  const make = (extra: Partial<ConstructorParameters<typeof LiveLadder>[0]> = {}) =>
    new LiveLadder({ store, seed: 67, build: { games: 0 }, matchId: () => `live-${++n}`, now: () => clock.t, roundGapMs: 30_000, idleRetryMs: 45_000, housePacks: false, ...extra });
  return { clock, store, owners, make };
}

describe("the long-lived ladder", () => {
  it("shows each match at watch speed and records it only after its last move is shown", async () => {
    const { clock, store, make } = setup();
    const logDir = mkdtempSync(join(tmpdir(), "live-ladder-"));
    const recorded: LadderMatch[] = [];
    const live = make({ logDir, onRecorded: (m) => recorded.push(m) });
    await live.tick();
    const shown = live.showing();
    expect(shown).toHaveLength(2);
    // Live in the store (owners can't change agent or loadout), and nothing
    // about the result is anywhere yet.
    expect(store.liveMatches().map((m) => m.matchId).sort()).toEqual(shown.map((s) => s.matchId).sort());
    expect(store.matchHistory()).toEqual([]);
    const first = live.liveMatches()[0]!;
    expect(first.released).toBe(0);
    expect(first.now.turn).toBe(1);
    expect(first.now.winner).toBeNull();
    expect(first.p1.agentName).toMatch(/^Agent \d$/);

    // Every match is about the watch length its moves add up to.
    for (const s of shown) expect(s.lengthMs).toBeGreaterThan(60_000);
    const short = Math.min(...shown.map((s) => s.lengthMs));
    const long = Math.max(...shown.map((s) => s.lengthMs));

    // Walk the clock in 1 s steps: moves come out in order, never ahead.
    const id = shown.find((s) => s.lengthMs === short)!.matchId;
    let seen = 0;
    let lastReleased = 0;
    const lines: string[] = [];
    const feed0 = live.liveMatch(id, 0)!;
    expect(feed0.start).not.toBeNull();
    lines.push(...feed0.startLines!);
    const begin = clock.t;
    while (clock.t < begin + short - 1000) {
      clock.t += 1000;
      await live.tick();
      const f = live.liveMatch(id, seen)!;
      expect(f.released).toBeGreaterThanOrEqual(lastReleased);
      expect(f.steps.map((s) => s.n)).toEqual(Array.from({ length: f.released - seen }, (_, i) => seen + i + 1));
      lines.push(...f.steps.flatMap((s) => s.lines));
      seen = lastReleased = f.released;
    }
    // Not yet recorded a second before its length; the last move is out
    // (holding the result).
    expect(store.matchHistory()).toEqual([]);
    const end = live.liveMatch(id)!;
    expect(end.now.winner).not.toBeNull();
    expect(end.nextAt).toBeNull();
    clock.t += 1000;
    await live.tick();
    expect(live.liveMatch(id)).toBeNull();
    const [rec] = store.matchHistory();
    expect(rec!.matchId).toBe(id);
    expect(Date.parse(rec!.endedAt)).toBe(begin + short);
    expect(store.liveMatches()).toHaveLength(1);
    // What the feed released is the whole log, line for line.
    expect(`${lines.join("\n")}\n`).toBe(readFileSync(recorded[0]!.logPath!, "utf8"));

    // The other match ends at its own length; the next round only after the gap.
    clock.t = begin + long;
    await live.tick();
    expect(store.matchHistory()).toHaveLength(2);
    expect(live.liveMatches()).toEqual([]);
    clock.t += 29_000;
    await live.tick();
    expect(live.liveMatches()).toEqual([]);
    clock.t += 1000;
    await live.tick();
    expect(live.liveMatches()).toHaveLength(2);
    await live.stop();
    rmSync(logDir, { recursive: true, force: true });
  });

  it("the wait before each move follows the pace: actions 6 s, passes 1 s, a new turn 3 s more; the result holds 8 s", async () => {
    const { make } = setup(["Cortex", "Swarm"]);
    const live = make();
    const { pairs } = await live.ladder.startRound();
    const played = (await live.ladder.playPair(pairs[0]!))!;
    const t = played.timeline!;
    let total = 0;
    for (let i = 0; i < t.steps.length; i++) {
      const before = i === 0 ? t.start : t.steps[i - 1]!.after;
      const expected = (t.steps[i]!.move.type === "passPriority" ? 1000 : 6000) + (t.steps[i]!.after.turn !== before.turn ? 3000 : 0);
      expect(stepHoldMs(t, i)).toBe(expected);
      total += expected;
    }
    expect(watchLengthMs(t)).toBe(total + WATCH_PACE_MS.end);
    live.ladder.recordPlayed(played);
  });

  it("a restart mid-match cancels what was being shown (no credits, no rating), then the ladder carries on", async () => {
    const { clock, store, owners, make } = setup();
    const first = make();
    await first.tick();
    clock.t += 60_000;
    await first.tick();
    expect(first.liveMatches()[0]!.released).toBeGreaterThan(0);
    await first.stop();
    // The process is gone; a new one starts on the same store.
    const second = make();
    await second.tick();
    const history = store.matchHistory();
    expect(history.map((m) => m.outcome)).toEqual(["cancelled", "cancelled"]);
    expect(history.every((m) => m.p1Credits + m.p2Credits === 0 && m.ratings === null)).toBe(true);
    for (const o of owners) expect(store.rating(o).ratedMatches).toBe(0);
    // The owners are free again: the new process starts a round at once.
    expect(second.liveMatches()).toHaveLength(2);
  });

  it("with nobody to pair it waits and tries again; an owner turning auto-play on joins the next round", async () => {
    const { clock, store, make } = setup([]);
    const mk = (name: string, f: DeckFaction) => {
      const o = store.createOwner({ name });
      store.grantStarterCollection(o.ownerId, f);
      const a = store.createAgent({ ownerId: o.ownerId, name: `${name}-agent` });
      store.connectAgent(o.ownerId, a.agentId);
      return o.ownerId;
    };
    const a = mk("ada", "Cortex");
    const b = mk("bo", "Null");
    const live = make();
    await live.tick();
    expect(live.liveMatches()).toEqual([]);
    store.setAutoPlay(a, true);
    store.setAutoPlay(b, true);
    clock.t += 44_000;
    await live.tick();
    expect(live.liveMatches()).toEqual([]);
    clock.t += 1000;
    await live.tick();
    expect(live.liveMatches()).toHaveLength(1);
    expect(live.liveMatchOf(a)).toBe(live.liveMatches()[0]!.matchId);
    // Turning it off lets the current match finish.
    store.setAutoPlay(a, false);
    clock.t += 60 * 60_000;
    await live.tick();
    expect(store.matchHistory()).toHaveLength(1);
    expect(store.matchHistory()[0]!.outcome).toBe("win");
    expect(live.ladder.eligibleOwners()).toEqual([b]);
  });

  // (session 92) The 7-day unattended run: a write that fails once (a full
  // disk, a busy file) used to drop the match from the show while the store
  // still held it live, so its owners were never paired again until a
  // restart: with four house owners the ladder stopped for good.
  it("a match that can't be recorded stays live and is tried again (30 s, doubling to 10 min); the ladder carries on once it can", async () => {
    const { clock, store, make } = setup();
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void errors.push(a.join(" ")));
    try {
      const live = make();
      await live.tick();
      const ids = live.showing().map((s) => s.matchId).sort();
      expect(ids).toHaveLength(2);
      let failing = true;
      const real = store.recordMatch.bind(store);
      vi.spyOn(store, "recordMatch").mockImplementation((input) => {
        if (failing) throw new Error("database or disk is full");
        return real(input);
      });
      // Past both matches' ends, then 20 minutes of failing writes.
      const end = Math.max(...live.showing().map((s) => s.lengthMs));
      const failFrom = clock.t + end;
      while (clock.t < failFrom + 20 * 60_000) {
        clock.t += 1_000;
        await live.tick();
      }
      expect(store.matchHistory()).toEqual([]);
      // Still shown, still live in the store, nothing else paired.
      expect(live.showing().map((s) => s.matchId).sort()).toEqual(ids);
      expect(store.liveMatches().map((m) => m.matchId).sort()).toEqual(ids);
      // Tried at the end, then 30, 60, 120, 240, 480 s later (15.5 min);
      // the next would be 10 min on (capped), past the 20 minutes.
      const tries = (id: string) => errors.filter((e) => e.includes(`couldn't record ${id} `));
      for (const id of ids) {
        expect(tries(id).map((e) => /in (\d+) s/.exec(e)![1])).toEqual(["30", "60", "120", "240", "480", "600"]);
        expect(tries(id)[0]).toContain("database or disk is full");
      }
      // The disk is freed: the next try records both, and rounds carry on.
      failing = false;
      for (let i = 0; i < 30 * 60; i++) {
        clock.t += 1_000;
        await live.tick();
      }
      const history = store.matchHistory();
      for (const id of ids) expect(history.find((h) => h.matchId === id)?.outcome).not.toBe("cancelled");
      expect(history.length).toBeGreaterThan(2);
    } finally {
      spy.mockRestore();
    }
  });

  it("a match recorded whose log can't be written still counts, with no log file", async () => {
    const { clock, store, make } = setup();
    const logDir = join(mkdtempSync(join(tmpdir(), "live-ladder-")), "not-a-dir");
    const warnings: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => void warnings.push(a.join(" ")));
    try {
      const recorded: LadderMatch[] = [];
      const live = make({ logDir, onRecorded: (m) => recorded.push(m) });
      await live.tick();
      // The directory goes (as a full or failed disk would make writes fail).
      rmSync(logDir, { recursive: true, force: true });
      const end = Math.max(...live.showing().map((s) => s.lengthMs));
      clock.t += end + 1_000;
      await live.tick();
      expect(recorded).toHaveLength(2);
      for (const m of recorded) {
        expect(m.logPath).toBeNull();
        expect(m.replayPath).toBeNull();
      }
      expect(store.liveMatches()).toEqual([]);
      expect(warnings.filter((w) => w.includes("no log file"))).toHaveLength(2);
    } finally {
      spy.mockRestore();
    }
  });

  it("the running ladder says when the clock jumps ahead (the machine slept) or goes back, and not on an ordinary tick", () => {
    const t = Date.parse("2026-12-05T00:00:00.000Z");
    expect(clockJumpLine(t, t + 250, 250)).toBeNull();
    expect(clockJumpLine(t, t + 30_000, 250)).toBeNull(); // a slow tick (a rebuild) is not a jump
    expect(clockJumpLine(t, t + 3 * 3_600_000, 250)).toBe("[ladder] the clock moved ahead 180 minutes since the last tick (the machine slept, or its clock was changed): moves due in that time are shown at once");
    expect(clockJumpLine(t, t + 90_000, 250)).toContain("ahead 90 s");
    expect(clockJumpLine(t, t - 500, 250)).toBeNull();
    expect(clockJumpLine(t, t - 300_000, 250)).toBe("[ladder] the clock went back 5 minutes (it was changed): no move is shown until it catches up");
  });
});
