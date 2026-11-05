// The play-time allowance over HTTP and on the long-lived ladder (session
// 76; owner 2026-11-06, progress/season0-final-brief.md section 1): auto-play
// on with 15 / 30 / 60 minutes, +15 / +30 while running; when time runs out
// the agent finishes its current match and isn't paired again; reported in
// GET /api/play as running / finishing / done. Real HTTP on a real port, a
// LiveLadder on a fake clock.

import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../src/ownerApi.js";
import { LiveLadder } from "../src/ladder/liveLadder.js";
import type { LadderEvent } from "../src/ladder/ladderRunner.js";

const PW = "correct horse battery";
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const api of running.splice(0)) await api.close();
});

async function setup() {
  const clock = { t: Date.parse("2026-11-01T22:00:00.000Z") }; // 09:00 Mon in Sydney
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const owner = (name: string, faction: "Cortex" | "Swarm" | "Aegis" | "Null", kind: "player" | "house") => {
    const o = store.createAccount({ name, username: name.toLowerCase(), password: PW, kind });
    store.grantStarterCollection(o.ownerId, faction);
    const a = store.createAgent({ ownerId: o.ownerId, name: `${name}-agent` });
    store.connectAgent(o.ownerId, a.agentId);
    return o.ownerId;
  };
  const ada = owner("Ada", "Cortex", "player");
  const house = owner("House", "Null", "house");
  const events: LadderEvent[] = [];
  // Each recorded match with when the live ladder started and ended it.
  const shown: { owners: string[]; outcome: string; startedAt: number; endedAt: number }[] = [];
  let n = 0;
  const live = new LiveLadder({ store, seed: 76, build: { games: 0 }, matchId: () => `pt-${++n}`, now: () => clock.t, housePacks: false, roundGapMs: 30_000, idleRetryMs: 30_000, onEvent: (e) => events.push(e), onRecorded: (m, w) => shown.push({ owners: [m.record.p1OwnerId, m.record.p2OwnerId], outcome: m.record.outcome, ...w }) });
  const api = await startOwnerApi({ store, port: 0, live });
  running.push(api);
  const call = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await fetch(`http://localhost:${api.port}${path}`, {
      method,
      headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    return { status: res.status, body: await res.json() };
  };
  const signIn = async (login: string) => (await call("POST", "/api/session", { body: { login, password: PW } })).body.token as string;
  const of = (ownerId: string) => shown.filter((m) => m.owners.includes(ownerId));
  return { clock, store, live, ada, house, events, of, call, signIn };
}

describe("the play-time allowance over HTTP", () => {
  it("PUT /api/play/auto-play takes 15 / 30 / 60 minutes; POST /api/play/auto-play/time adds 15 / 30; bad bodies are 400, refusals 409", async () => {
    const { clock, call, signIn } = await setup();
    const t = await signIn("ada");
    const h = await signIn("house");
    expect((await call("POST", "/api/play/auto-play/time", { body: { minutes: 15 } })).status).toBe(401);
    expect((await call("GET", "/api/play", { token: t })).body.autoPlay).toMatchObject({ on: false, allowance: null, canAddTime: false });
    for (const body of [{ on: true, minutes: 45 }, { on: true, minutes: "30" }, { on: false, minutes: 15 }]) {
      expect((await call("PUT", "/api/play/auto-play", { token: t, body })).status).toBe(400);
    }
    const on = await call("PUT", "/api/play/auto-play", { token: t, body: { on: true, minutes: 30 } });
    expect(on).toMatchObject({
      status: 200,
      body: { autoPlay: { on: true, house: false, canAddTime: true, allowance: { state: "running", endsAt: "2026-11-01T22:30:00.000Z", totalMinutes: 30, minutesLeft: 30, endsAtReset: false } } },
    });
    clock.t += 12 * 60_000;
    expect((await call("GET", "/api/play", { token: t })).body.autoPlay.allowance).toMatchObject({ state: "running", minutesLeft: 18, secondsLeft: 1080 });
    for (const minutes of [60, 0, "15", undefined]) expect((await call("POST", "/api/play/auto-play/time", { token: t, body: { minutes } })).status).toBe(400);
    const added = await call("POST", "/api/play/auto-play/time", { token: t, body: { minutes: 15 } });
    expect(added.body.autoPlay.allowance).toMatchObject({ endsAt: "2026-11-01T22:45:00.000Z", totalMinutes: 45, minutesLeft: 33 });
    // No time limit: on as before, nothing to add to.
    expect((await call("PUT", "/api/play/auto-play", { token: t, body: { on: true } })).body.autoPlay).toMatchObject({ on: true, allowance: null, canAddTime: false });
    expect(await call("POST", "/api/play/auto-play/time", { token: t, body: { minutes: 30 } })).toMatchObject({
      status: 409,
      body: { error: "auto-play isn't running on a time allowance; start it with 15, 30 or 60 minutes" },
    });
    expect((await call("PUT", "/api/play/auto-play", { token: h, body: { on: true, minutes: 15 } })).status).toBe(409);
    expect((await call("POST", "/api/play/auto-play/time", { token: h, body: { minutes: 15 } })).status).toBe(409);
    // Near midnight Sydney the window is cut there, and nothing more goes on.
    clock.t = Date.parse("2026-11-02T12:20:00.000Z"); // 23:20 Mon
    expect((await call("PUT", "/api/play/auto-play", { token: t, body: { on: true, minutes: 60 } })).body.autoPlay).toMatchObject({
      canAddTime: false,
      allowance: { endsAt: "2026-11-02T13:00:00.000Z", totalMinutes: 40, endsAtReset: true },
    });
    expect((await call("POST", "/api/play/auto-play/time", { token: t, body: { minutes: 15 } })).status).toBe(409);
  });
});

describe("the play-time allowance on the ladder", () => {
  it("time running out mid-match: the match finishes (finishing), then the agent isn't paired again (done), with a timeUp stop", async () => {
    const { clock, store, live, ada, events, of, call, signIn } = await setup();
    const t = await signIn("ada");
    await call("PUT", "/api/play/auto-play", { token: t, body: { on: true, minutes: 15 } });
    const endsAt = Date.parse("2026-11-01T22:15:00.000Z");
    const seen: string[] = [];
    let finishingWhileLive = false;
    for (let s = 0; s < 75 * 60; s += 5) {
      await live.tick();
      const autoPlay = (await call("GET", "/api/play", { token: t })).body.autoPlay;
      const state = autoPlay.allowance?.state ?? "none";
      if (seen.at(-1) !== state) seen.push(state);
      if (state === "finishing") finishingWhileLive ||= live.liveMatchOf(ada) !== null && autoPlay.on === true;
      clock.t += 5000;
    }
    expect(seen).toEqual(["running", "finishing", "done"]);
    expect(finishingWhileLive).toBe(true);
    const mine = of(ada);
    expect(mine.length).toBeGreaterThanOrEqual(2);
    expect(store.matchHistory({ ownerId: ada })).toHaveLength(mine.length);
    // Every match started inside the window; the last one ran past its end and still counted.
    for (const m of mine) expect(m.startedAt).toBeLessThan(endsAt);
    expect(mine.at(-1)!.endedAt).toBeGreaterThan(endsAt);
    expect(mine.at(-1)!.outcome).not.toBe("cancelled");
    // One stop, timeUp, right after that last match was recorded.
    const stops = events.filter((e) => e.kind === "autoPlayStopped");
    expect(stops).toEqual([{ kind: "autoPlayStopped", ownerId: ada, reason: "timeUp" }]);
    expect(store.autoPlay(ada)).toMatchObject({ on: false, stopped: { reason: "timeUp", day: "2026-11-02" }, allowance: { state: "done" } });
    expect(live.ladder.eligibleOwners()).not.toContain(ada);
  });

  it("+15 while finishing opens a new window: the agent is paired again in the next round", async () => {
    const { clock, store, live, ada, of, call, signIn } = await setup();
    const t = await signIn("ada");
    await call("PUT", "/api/play/auto-play", { token: t, body: { on: true, minutes: 15 } });
    let extended = false;
    let extendedAt = 0;
    for (let s = 0; s < 40 * 60; s += 5) {
      await live.tick();
      if (!extended && store.autoPlay(ada).allowance?.state === "finishing") {
        const r = await call("POST", "/api/play/auto-play/time", { token: t, body: { minutes: 15 } });
        expect(r.body.autoPlay.allowance).toMatchObject({ state: "running", startedAt: new Date(clock.t).toISOString(), minutesLeft: 15 });
        extended = true;
        extendedAt = clock.t;
      }
      clock.t += 5000;
    }
    expect(extended).toBe(true);
    const after = of(ada).filter((m) => m.startedAt > extendedAt);
    expect(after.length).toBeGreaterThanOrEqual(1);
    // ...inside the new window only; that one ran out too, 40 minutes on.
    for (const m of after) expect(m.startedAt).toBeLessThan(extendedAt + 15 * 60_000);
    expect(store.autoPlay(ada)).toMatchObject({ on: false, stopped: { reason: "timeUp" } });
  });

  it("time running out between rounds: switched off at the next round with the event, and not queued", async () => {
    const { clock, store, live, ada, events } = await setup();
    store.setAutoPlay(ada, true, 15);
    clock.t += 15 * 60_000; // before any round has run
    await live.tick();
    expect(live.liveMatches()).toEqual([]);
    expect(events.filter((e) => e.kind === "autoPlayStopped")).toEqual([{ kind: "autoPlayStopped", ownerId: ada, reason: "timeUp" }]);
    expect(store.autoPlay(ada)).toMatchObject({ on: false, stopped: { reason: "timeUp" } });
  });
});
