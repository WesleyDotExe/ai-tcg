// The server ends the season at its end time (session 94; owner 2026-11-13,
// answer 2 to game session 93 and the end time: Season 0 ends at 00:00 27
// Dec 2026 Sydney, 13:00 UTC 26 Dec, ended by the server). The live ladder on
// a fake clock: no round starts from the end time, the matches on screen
// finish and count, then the season ends; a server started after the end time
// ends it on its first tick; GET /api/season says the time.

import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { LiveLadder } from "../src/ladder/liveLadder.js";
import type { LadderEvent } from "../src/ladder/ladderRunner.js";
import { startOwnerApi, type RunningOwnerApi } from "../src/ownerApi.js";

const ENDS = "2026-12-26T13:00:00.000Z";
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const api of running.splice(0)) await api.close();
});

function setup(startIso: string) {
  const clock = { t: Date.parse(startIso) };
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  for (const [name, faction] of [
    ["House Cortex", "Cortex"],
    ["House Swarm", "Swarm"],
    ["House Aegis", "Aegis"],
    ["House Null", "Null"],
  ] as const) {
    const o = store.createAccount({ name, username: name.replace(" ", "").toLowerCase(), password: "correct horse battery", kind: "house" });
    store.grantStarterCollection(o.ownerId, faction);
    store.connectAgent(o.ownerId, store.createAgent({ ownerId: o.ownerId, name: `${name} agent` }).agentId);
  }
  const events: LadderEvent[] = [];
  const shown: { startedAt: number; endedAt: number; outcome: string }[] = [];
  let n = 0;
  const ladder = () =>
    new LiveLadder({
      store,
      seed: 94,
      build: { games: 0 },
      matchId: () => `se-${++n}`,
      now: () => clock.t,
      housePacks: false,
      roundGapMs: 30_000,
      idleRetryMs: 30_000,
      onEvent: (e) => events.push(e),
      onRecorded: (m, w) => shown.push({ ...w, outcome: m.record.outcome }),
    });
  return { clock, store, events, shown, ladder };
}

describe("the season's end time on the live ladder", () => {
  it("no round from the end time; the matches on screen finish and count; then the season ends", async () => {
    // 23:40 Sydney on 26 Dec: rounds play up to midnight.
    const { clock, store, events, shown, ladder } = setup("2026-12-26T12:40:00.000Z");
    store.setSeasonEndTime(ENDS);
    const live = ladder();
    const endMs = Date.parse(ENDS);
    let liveAtEnd = -1;
    for (let s = 0; s < 60 * 60 && !store.seasonEnded(); s += 5) {
      await live.tick();
      if (liveAtEnd < 0 && clock.t >= endMs) liveAtEnd = live.liveMatches().length;
      clock.t += 5000;
    }
    expect(store.seasonEnded()).toBe(true);
    expect(shown.length).toBeGreaterThanOrEqual(2);
    // Every match started before the end time, and none was cancelled.
    for (const m of shown) {
      expect(m.startedAt).toBeLessThan(endMs);
      expect(m.outcome).not.toBe("cancelled");
    }
    // A round was on screen at midnight: it finished after the end time and counted.
    expect(liveAtEnd).toBeGreaterThan(0);
    expect(Math.max(...shown.map((m) => m.endedAt))).toBeGreaterThan(endMs);
    const said = events.filter((e) => e.kind === "seasonEndTime");
    expect(said).toEqual([{ kind: "seasonEndTime", season: "S0", endsAt: ENDS, live: liveAtEnd }]);
    const end = store.seasonEnd()!;
    expect(Date.parse(end.endedAt)).toBeGreaterThanOrEqual(Math.max(...shown.map((m) => m.endedAt)));
    expect(end.standings).toHaveLength(4);
    expect(store.matchHistory({}).length).toBe(shown.length);
    expect(events.filter((e) => e.kind === "seasonEnded")).toHaveLength(1);
    // Nothing more happens.
    const after = shown.length;
    for (let s = 0; s < 10 * 60; s += 5) {
      clock.t += 5000;
      await live.tick();
    }
    expect(shown.length).toBe(after);
    expect(live.seasonState()).toBe("ended");
  });

  it("a server started after the end time (down over midnight) ends the season at once, cancelling what the last run left on screen", async () => {
    const { clock, store, events, ladder } = setup("2026-12-26T12:50:00.000Z");
    store.setSeasonEndTime(ENDS);
    const first = ladder();
    await first.tick();
    expect(store.liveMatches().length).toBeGreaterThan(0);
    // The process stops (no clean stop), and comes back at 00:20.
    clock.t = Date.parse("2026-12-26T13:20:00.000Z");
    const second = ladder();
    await second.tick();
    expect(store.seasonEnded()).toBe(true);
    expect(store.seasonEnd()!.endedAt).toBe("2026-12-26T13:20:00.000Z");
    expect(store.matchHistory({}).every((m) => m.outcome === "cancelled")).toBe(true);
    expect(events.filter((e) => e.kind === "seasonEndTime").at(-1)).toMatchObject({ live: 0 });
  });

  it("with no end time it never ends by itself (the admin's end call stays)", async () => {
    const { clock, store, ladder } = setup("2026-12-26T12:50:00.000Z");
    const live = ladder();
    for (let s = 0; s < 40 * 60; s += 5) {
      await live.tick();
      clock.t += 5000;
    }
    expect(store.seasonEnded()).toBe(false);
    expect(store.matchHistory({}).length).toBeGreaterThan(0);
  });

  it("GET /api/season says the end time, before and after", async () => {
    const { clock, store, ladder } = setup("2026-12-26T12:59:00.000Z");
    store.setSeasonEndTime(ENDS);
    const live = ladder();
    const api = await startOwnerApi({ store, port: 0, live });
    running.push(api);
    const token = store.signIn("housecortex", "correct horse battery").token;
    const season = async () => (await (await fetch(`http://localhost:${api.port}/api/season`, { headers: { Authorization: `Bearer ${token}` } })).json()) as Record<string, unknown>;
    expect(await season()).toMatchObject({ season: "S0", state: "open", endsAt: ENDS, endedAt: null });
    for (let s = 0; s < 30 * 60 && !store.seasonEnded(); s += 5) {
      await live.tick();
      clock.t += 5000;
    }
    expect(await season()).toMatchObject({ state: "ended", endsAt: ENDS, endedAt: store.seasonEnd()!.endedAt });
  });
});
