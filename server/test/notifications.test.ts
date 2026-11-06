// Notifications over HTTP (schema v23, session 77; owner 2026-11-05 and
// 2026-11-06: the top bar's bell and the Notifications widget): GET
// /api/notifications, POST /api/notifications/read and /clear, and the
// Settings -> Notifications switches on PATCH /api/account/settings. Real
// HTTP on a real port; a LiveLadder on a fake clock for the end-to-end case
// (auto-play on a 15-minute allowance until the time is up).

import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../src/ownerApi.js";
import { LiveLadder } from "../src/ladder/liveLadder.js";

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
    return { ownerId: o.ownerId, agentId: a.agentId };
  };
  const ada = owner("Ada", "Cortex", "player");
  const bo = owner("Bob", "Aegis", "player");
  const house = owner("House", "Null", "house");
  let n = 0;
  const live = new LiveLadder({ store, seed: 77, build: { games: 0 }, matchId: () => `nt-${++n}`, now: () => clock.t, housePacks: false, roundGapMs: 30_000, idleRetryMs: 30_000 });
  const api = await startOwnerApi({ store, port: 0, live });
  running.push(api);
  const call = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await fetch(`http://localhost:${api.port}${path}`, {
      method,
      headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    return { status: res.status, body: text === "" ? null : JSON.parse(text), allow: res.headers.get("allow") };
  };
  const signIn = async (login: string) => (await call("POST", "/api/session", { body: { login, password: PW } })).body.token as string;
  return { clock, store, live, ada, bo, house, call, signIn };
}

const ENDPOINTS: [string, string, unknown?][] = [
  ["GET", "/api/notifications"],
  ["POST", "/api/notifications/read", { all: true }],
  ["POST", "/api/notifications/clear", { all: true }],
];

describe("notifications over HTTP", () => {
  it("every endpoint needs a live session (401); a wrong method is 405 with Allow", async () => {
    const { call, signIn } = await setup();
    for (const [method, path, body] of ENDPOINTS) expect([method, path, (await call(method, path, { body })).status]).toEqual([method, path, 401]);
    const t = await signIn("ada");
    expect(await call("DELETE", "/api/notifications", { token: t })).toMatchObject({ status: 405, allow: "GET" });
    expect(await call("GET", "/api/notifications/read", { token: t })).toMatchObject({ status: 405, allow: "POST" });
  });

  it("the live ladder end to end: every match the agent played, then its time up, newest first; the house owner hears nothing", async () => {
    const { clock, store, live, ada, house, call, signIn } = await setup();
    const t = await signIn("ada");
    await call("PATCH", "/api/account/settings", { token: t, body: { notifications: { dailyPack: false } } });
    await call("PUT", "/api/play/auto-play", { token: t, body: { on: true, minutes: 15 } });
    let bellWhileRunning = 0;
    for (let s = 0; s < 45 * 60; s += 5) {
      await live.tick();
      if (s % 60 === 0) bellWhileRunning = Math.max(bellWhileRunning, (await call("GET", "/api/notifications?limit=1", { token: t })).body.unread);
      clock.t += 5000;
    }
    expect(store.autoPlay(ada.ownerId)).toMatchObject({ on: false, stopped: { reason: "timeUp" } });
    const history = store.matchHistory({ ownerId: ada.ownerId });
    expect(history.length).toBeGreaterThanOrEqual(2);
    // The bell counted up while the agent played.
    expect(bellWhileRunning).toBeGreaterThanOrEqual(1);
    const page = (await call("GET", "/api/notifications?limit=100", { token: t })).body;
    expect(page.unread).toBe(history.length + 1);
    expect(page.unreadByKind).toEqual({ matchResult: history.length, bigPull: 0, dailyPack: 0, autoPlayStopped: 1 });
    // Newest first: the time up after the last match.
    expect(page.notifications[0]).toMatchObject({ kind: "autoPlayStopped", autoPlayStopped: { reason: "timeUp", allowanceMinutes: 15, day: "2026-11-02" } });
    const results = page.notifications.slice(1);
    expect(results.map((x: { matchResult: { matchId: string } }) => x.matchResult.matchId)).toEqual(history.map((m) => m.matchId).reverse());
    for (const x of results) {
      const m = history.find((h) => h.matchId === x.matchResult.matchId)!;
      const seat = m.p1OwnerId === ada.ownerId ? "p1" : "p2";
      const want = m.outcome === "win" ? (m.winnerOwnerId === ada.ownerId ? "win" : "loss") : m.outcome;
      expect(x).toMatchObject({ kind: "matchResult", createdAt: m.endedAt, readAt: null, matchResult: { result: want, credits: seat === "p1" ? m.p1Credits : m.p2Credits, agentName: "Ada-agent" } });
    }
    // The matches went somewhere: house owners played them and were told nothing.
    expect(store.notifications(house.ownerId)).toMatchObject({ notifications: [], unread: 0 });
    // Filtered by kind, the count stays whole.
    const stops = (await call("GET", "/api/notifications?kind=autoPlayStopped", { token: t })).body;
    expect(stops.notifications).toHaveLength(1);
    expect(stops.unread).toBe(history.length + 1);
  });

  it("reads and clears by ids or all, pages with before, and answers 400 / 404 for bad requests without changing anything", async () => {
    const { store, ada, bo, call, signIn } = await setup();
    const t = await signIn("ada");
    const tb = await signIn("bob");
    for (const tok of [t, tb]) await call("PATCH", "/api/account/settings", { token: tok, body: { notifications: { dailyPack: false } } });
    for (let i = 0; i < 4; i++) {
      store.recordMatch({ matchId: `m${i}`, seed: i, p1AgentId: ada.agentId, p2AgentId: bo.agentId, outcome: { kind: "win", winnerAgentId: i % 2 ? ada.agentId : bo.agentId } });
    }
    const first = (await call("GET", "/api/notifications?limit=3", { token: t })).body;
    expect(first.notifications).toHaveLength(3);
    expect(first.more).toBe(true);
    const ids: number[] = first.notifications.map((x: { notificationId: number }) => x.notificationId);
    const rest = (await call("GET", `/api/notifications?limit=3&before=${ids[2]}`, { token: t })).body;
    expect(rest).toMatchObject({ more: false, unread: 4 });
    expect(rest.notifications.map((x: { matchResult: { matchId: string } }) => x.matchResult.matchId)).toEqual(["m0"]);
    for (const q of ["limit=0", "limit=101", "limit=x", "before=0", "kind=gossip"]) expect([q, (await call("GET", `/api/notifications?${q}`, { token: t })).status]).toEqual([q, 400]);

    for (const body of [undefined, {}, { ids: [] }, { ids: ["1"] }, { ids: [0] }, { all: false }, { all: true, ids: [ids[0]] }, { ids: Array(101).fill(1) }]) {
      expect([body, (await call("POST", "/api/notifications/read", { token: t, body })).status]).toEqual([body, 400]);
      expect([body, (await call("POST", "/api/notifications/clear", { token: t, body })).status]).toEqual([body, 400]);
    }
    const bosId = (await call("GET", "/api/notifications", { token: tb })).body.notifications[0].notificationId;
    for (const bad of [bosId, 9999]) {
      expect(await call("POST", "/api/notifications/read", { token: t, body: { ids: [ids[0], bad] } })).toMatchObject({ status: 404, body: { error: `no notification ${bad}` } });
    }
    expect((await call("GET", "/api/notifications", { token: t })).body.unread).toBe(4);

    expect(await call("POST", "/api/notifications/read", { token: t, body: { ids: [ids[0]] } })).toMatchObject({ status: 200, body: { marked: 1, unread: 3 } });
    expect(await call("POST", "/api/notifications/clear", { token: t, body: { ids: [ids[1]] } })).toMatchObject({ status: 200, body: { cleared: 1, unread: 2 } });
    const after = (await call("GET", "/api/notifications", { token: t })).body;
    expect(after.notifications.map((x: { notificationId: number }) => x.notificationId)).not.toContain(ids[1]);
    expect(after.notifications[0].readAt).not.toBeNull();
    expect(await call("POST", "/api/notifications/read", { token: t, body: { all: true } })).toMatchObject({ body: { marked: 2, unread: 0 } });
    expect(await call("POST", "/api/notifications/clear", { token: t, body: { all: true } })).toMatchObject({ body: { cleared: 3, unread: 0 } });
    expect((await call("GET", "/api/notifications", { token: t })).body).toMatchObject({ notifications: [], unread: 0 });
    // Bo's are Bo's own.
    expect((await call("GET", "/api/notifications", { token: tb })).body.unread).toBe(4);
  });

  it("the three switches are account settings: patched in part, checked, and they decide what is written", async () => {
    const { store, ada, bo, call, signIn } = await setup();
    const t = await signIn("ada");
    expect((await call("GET", "/api/account/settings", { token: t })).body.notifications).toEqual({ bigPulls: true, matchResults: true, dailyPack: true });
    // A new owner's first daily pack is waiting.
    expect((await call("GET", "/api/notifications", { token: t })).body.notifications.map((x: { kind: string }) => x.kind)).toEqual(["dailyPack"]);
    const patched = await call("PATCH", "/api/account/settings", { token: t, body: { notifications: { matchResults: false } } });
    expect(patched.body.notifications).toEqual({ bigPulls: true, matchResults: false, dailyPack: true });
    for (const body of [{ notifications: { gossip: true } }, { notifications: { bigPulls: "no" } }, { notifications: [] }]) {
      expect([body, (await call("PATCH", "/api/account/settings", { token: t, body })).status]).toEqual([body, 400]);
    }
    store.recordMatch({ matchId: "quiet", seed: 1, p1AgentId: ada.agentId, p2AgentId: bo.agentId, outcome: { kind: "draw" } });
    expect((await call("GET", "/api/notifications", { token: t })).body.unreadByKind).toMatchObject({ matchResult: 0, dailyPack: 1 });
  });
});
