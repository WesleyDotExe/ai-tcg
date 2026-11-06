// The Stats page's data over HTTP (session 78; roadmap 2e): GET /api/stats.
// Real HTTP on a real port; a LiveLadder on a fake clock playing real engine
// matches, so the factions counted are the ones the decks actually played.

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
  owner("House", "Null", "house");
  let n = 0;
  const live = new LiveLadder({ store, seed: 78, build: { games: 0 }, matchId: () => `st-${++n}`, now: () => clock.t, housePacks: false, roundGapMs: 30_000, idleRetryMs: 30_000 });
  const api = await startOwnerApi({ store, port: 0, live });
  running.push(api);
  const call = async (method: string, path: string, token?: string) => {
    const res = await fetch(`http://localhost:${api.port}${path}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const text = await res.text();
    return { status: res.status, body: text === "" ? null : JSON.parse(text), allow: res.headers.get("allow") };
  };
  const signIn = async (login: string) => {
    const res = await fetch(`http://localhost:${api.port}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password: PW }) });
    return ((await res.json()) as { token: string }).token;
  };
  return { clock, store, live, ada, bo, call, signIn };
}

describe("GET /api/stats", () => {
  it("needs a live session (401); a wrong method is 405 with Allow", async () => {
    const { call, signIn } = await setup();
    expect((await call("GET", "/api/stats")).status).toBe(401);
    const t = await signIn("ada");
    expect(await call("POST", "/api/stats", t)).toMatchObject({ status: 405, allow: "GET" });
  });

  it("after real ladder matches: the factions the decks played, the counts the history gives, the chart ending today", async () => {
    const { clock, store, live, ada, call, signIn } = await setup();
    const t = await signIn("ada");
    const tb = await signIn("bob");
    for (const tok of [t, tb]) {
      await fetch(`http://localhost:${(running[0] as RunningOwnerApi).port}/api/play/auto-play`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ on: true }),
      });
    }
    for (let s = 0; s < 40 * 60; s += 5) {
      await live.tick();
      clock.t += 5000;
    }
    const history = store.matchHistory({ ownerId: ada.ownerId });
    expect(history.length).toBeGreaterThanOrEqual(3);
    const res = await call("GET", "/api/stats", t);
    expect(res.status).toBe(200);
    const st = res.body;
    // Ada plays Cortex in every match; the opponents' factions are the decks they played.
    for (const m of history) {
      const seat = m.p1OwnerId === ada.ownerId ? "p1" : "p2";
      expect(m.factions[seat]).toBe("Cortex");
      expect(["Aegis", "Null"]).toContain(m.factions[seat === "p1" ? "p2" : "p1"]);
    }
    expect(st.byFaction.find((f: { faction: string }) => f.faction === "Cortex").matches).toBe(history.length);
    expect(st.factionNotRecorded.matches).toBe(0);
    const opp = (f: string) => history.filter((m) => m.factions[m.p1OwnerId === ada.ownerId ? "p2" : "p1"] === f).length;
    expect(st.byOpponentFaction.find((f: { faction: string }) => f.faction === "Aegis").matches).toBe(opp("Aegis"));
    expect(st.byOpponentFaction.find((f: { faction: string }) => f.faction === "Null").matches).toBe(opp("Null"));
    // The totals agree with ownerStats (the older count), streaks included.
    const old = store.ownerStats(ada.ownerId);
    expect(st.totals).toMatchObject({ matches: old.matches, wins: old.wins, losses: old.losses, draws: old.draws, void: old.void, bestWinStreak: old.bestWinStreak, creditsFromMatches: old.creditsFromMatches });
    expect(st.recent.map((r: { matchId: string }) => r.matchId)).toEqual(history.map((m) => m.matchId).reverse().slice(0, 10));
    expect(st.rating.chart).toHaveLength(30);
    expect(st.rating.chart.at(-1)).toMatchObject({ day: "2026-11-02", rating: store.rating(ada.ownerId).rating });
    expect(st.rating.chart.at(-1).rated).toBe(history.filter((m) => m.ratings !== null).length);
    expect(st.today).toEqual(JSON.parse(JSON.stringify(store.dailyEarnings(ada.ownerId))));
    // ?agent, ?days, ?recent.
    const one = (await call("GET", `/api/stats?agent=${ada.agentId}&days=7&recent=2`, t)).body;
    expect(one).toMatchObject({ agentId: ada.agentId, totals: { matches: history.length } });
    expect(one.rating.chart).toHaveLength(7);
    expect(one.recent).toHaveLength(2);
  });

  it("400 for a bad days or recent, 404 for an agent that isn't yours", async () => {
    const { bo, call, signIn } = await setup();
    const t = await signIn("ada");
    expect(await call("GET", "/api/stats?days=6", t)).toMatchObject({ status: 400, body: { error: '"days" must be a whole number from 7 to 90' } });
    expect(await call("GET", "/api/stats?days=91", t)).toMatchObject({ status: 400 });
    expect(await call("GET", "/api/stats?recent=0", t)).toMatchObject({ status: 400, body: { error: '"recent" must be a whole number from 1 to 50' } });
    expect(await call("GET", "/api/stats?recent=x", t)).toMatchObject({ status: 400 });
    expect(await call("GET", `/api/stats?agent=${bo.agentId}`, t)).toMatchObject({ status: 404, body: { error: `no agent "${bo.agentId}" of yours` } });
    expect(await call("GET", "/api/stats?agent=nope", t)).toMatchObject({ status: 404 });
  });
});
