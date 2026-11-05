// The owner API's match endpoints (session 67): Watch live from the
// long-lived ladder, match history with each match's log and replay, and the
// auto-play switch. Real HTTP against a real port, over an in-memory store
// and a LiveLadder on a fake clock.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { formatLog } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../src/ownerApi.js";
import { LiveLadder } from "../src/ladder/liveLadder.js";
import { rebuildReplay, type ReplayFile } from "../src/ladder/ladderRunner.js";

const PW = "correct horse battery";
const running: RunningOwnerApi[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const api of running.splice(0)) await api.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
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
  const logDir = mkdtempSync(join(tmpdir(), "api-matches-"));
  dirs.push(logDir);
  let n = 0;
  const live = new LiveLadder({ store, seed: 9, build: { games: 0 }, matchId: () => `api-${++n}`, now: () => clock.t, logDir, housePacks: false, roundGapMs: 30_000 });
  const api = await startOwnerApi({ store, port: 0, live, matchFiles: logDir });
  running.push(api);
  const call = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await fetch(`http://localhost:${api.port}${path}`, {
      method,
      headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    const json = res.headers.get("content-type")?.startsWith("application/json");
    return { status: res.status, body: text === "" ? null : json ? JSON.parse(text) : text, type: res.headers.get("content-type") };
  };
  const signIn = async (login: string) => (await call("POST", "/api/session", { body: { login, password: PW } })).body.token as string;
  return { clock, store, live, ada, house, call, signIn };
}

const ENDPOINTS: [string, string, unknown?][] = [
  ["PUT", "/api/play/auto-play", { on: true }],
  ["GET", "/api/live"],
  ["GET", "/api/live/x"],
  ["GET", "/api/matches"],
  ["GET", "/api/matches/x"],
  ["GET", "/api/matches/x/log"],
  ["GET", "/api/matches/x/replay"],
];

describe("the match endpoints", () => {
  it("answer 401 with no token", async () => {
    const { call } = await setup();
    for (const [method, path, body] of ENDPOINTS) {
      const res = await call(method, path, { body });
      expect([method, path, res.status]).toEqual([method, path, 401]);
    }
  });

  it("auto-play: off by default in Settings -> Play, on and off over PUT; a bad body is 400; the house can't switch", async () => {
    const { store, ada, call, signIn } = await setup();
    const t = await signIn("ada");
    expect((await call("GET", "/api/play", { token: t })).body.autoPlay).toMatchObject({ on: false, canTurnOn: true, house: false });
    expect((await call("PUT", "/api/play/auto-play", { token: t, body: { on: "yes" } })).status).toBe(400);
    const on = await call("PUT", "/api/play/auto-play", { token: t, body: { on: true } });
    expect(on.status).toBe(200);
    expect(on.body.autoPlay).toMatchObject({ on: true, stopped: null });
    expect(store.autoPlay(ada).on).toBe(true);
    expect((await call("PUT", "/api/play/auto-play", { token: t, body: { on: false } })).body.autoPlay.on).toBe(false);
    const h = await signIn("house");
    const refused = await call("PUT", "/api/play/auto-play", { token: h, body: { on: true } });
    expect(refused).toMatchObject({ status: 409, body: { error: "house owners always play; auto-play is for player owners" } });
    expect((await call("GET", "/api/play", { token: h })).body.autoPlay.house).toBe(true);
  });

  it("Watch live lists the live match and feeds its moves as they are released; then history, the log and the replay", async () => {
    const { clock, live, ada, house, call, signIn } = await setup();
    const t = await signIn("ada");
    expect((await call("GET", "/api/live", { token: t })).body).toEqual({ running: true, matches: [], mine: null, featured: { tournament: [], topRated: [] } });
    await call("PUT", "/api/play/auto-play", { token: t, body: { on: true } });
    await live.tick();
    const list = (await call("GET", "/api/live", { token: t })).body;
    expect(list.matches).toHaveLength(1);
    const id = list.matches[0].matchId as string;
    expect(list.mine).toBe(id);
    expect([list.matches[0].p1.ownerId, list.matches[0].p2.ownerId].sort()).toEqual([ada, house].sort());
    expect(list.matches[0].released).toBe(0);

    const f0 = (await call("GET", `/api/live/${id}?from=0`, { token: t })).body;
    expect(f0).toMatchObject({ from: 0, released: 0, steps: [] });
    expect(f0.start.turn).toBe(1);
    // (session 72) The live-feed asks over HTTP: the opening hands beside the
    // start, each side's faction, and no boast before the last move is out.
    expect(f0.openingHands.p1).toHaveLength(f0.start.p1.hand);
    expect(f0.openingHands.p2).toHaveLength(f0.start.p2.hand);
    const factionOf = { [ada]: "Cortex", [house]: "Null" };
    expect(f0.p1.faction).toBe(factionOf[f0.p1.ownerId]);
    expect(f0.p2.faction).toBe(factionOf[f0.p2.ownerId]);
    expect(f0.boast).toBeNull();
    clock.t += 30_000;
    await live.tick();
    const f1 = (await call("GET", `/api/live/${id}?from=0`, { token: t })).body;
    expect(f1.released).toBeGreaterThan(0);
    expect(f1.steps).toHaveLength(f1.released);
    const f2 = (await call("GET", `/api/live/${id}?from=${f1.released}`, { token: t })).body;
    expect(f2).toMatchObject({ from: f1.released, steps: [], start: null, openingHands: null });
    expect((await call("GET", `/api/live/${id}?from=-1`, { token: t })).status).toBe(400);
    expect((await call("GET", "/api/live/nope", { token: t })).status).toBe(404);
    // Nothing recorded yet.
    expect((await call("GET", "/api/matches", { token: t })).body).toEqual({ matches: [], total: 0, more: false });

    clock.t += 60 * 60_000;
    await live.tick();
    const ended = await call("GET", `/api/live/${id}`, { token: t });
    expect(ended.status).toBe(404);
    expect(ended.body.error).toBe(`match "${id}" has ended; see /api/matches/${id}`);

    const history = (await call("GET", "/api/matches", { token: t })).body;
    expect(history.total).toBe(1);
    const row = history.matches[0];
    expect(row).toMatchObject({ matchId: id, hasLog: true, hasReplay: true, opponent: { ownerId: house, agentName: "House-agent" }, agentName: "Ada-agent" });
    expect(["win", "loss"]).toContain(row.result);
    expect(row.rating.change).toBeCloseTo(row.rating.after - row.rating.before);
    expect(row.credits).toBe(row.result === "win" ? 30 : 2);

    const one = (await call("GET", `/api/matches/${id}`, { token: t })).body;
    expect(one.p1.agentName).toMatch(/-agent$/);
    expect(one.turns).toBe(row.turns);

    const log = await call("GET", `/api/matches/${id}/log`, { token: t });
    expect(log.type).toMatch(/^text\/plain/);
    const replay = (await call("GET", `/api/matches/${id}/replay`, { token: t })).body as ReplayFile;
    const { state } = rebuildReplay(replay);
    expect(`${formatLog(state.log)}\n`).toBe(log.body);
    expect((await call("GET", "/api/matches/nope", { token: t })).status).toBe(404);
    expect((await call("GET", "/api/matches/nope/log", { token: t })).status).toBe(404);
  });

  it("(v20) both sides' coins, arenas and starting ratings on the live view, the match and the replay; the default view is the higher-rated side", async () => {
    const { clock, store, live, ada, house, call, signIn } = await setup();
    // House goes in rated higher than Ada (who has no rating yet: 1500).
    store.unsafeExec(`INSERT INTO ratings (owner_id, rating, rd, volatility, matches, last_day, updated_at) VALUES ('${house}', 1720, 80, 0.06, 6, '2026-11-02', '2026-11-01T22:00:00.000Z')`);
    const houseAgent = store.getOwner(house).connectedAgentId!;
    store.setLoadout(house, houseAgent, "coin", null); // an empty slot flips the Chrome Token
    const t = await signIn("ada");
    await call("PUT", "/api/play/auto-play", { token: t, body: { on: true } });
    await live.tick();
    const m = (await call("GET", "/api/live", { token: t })).body.matches[0];
    const seatOf = (ownerId: string) => (m.p1.ownerId === ownerId ? "p1" : "p2");
    expect(m[seatOf(house)]).toMatchObject({ rating: 1720, coin: "coin-chrome-token", arena: null });
    expect(m[seatOf(ada)]).toMatchObject({ rating: 1500, coin: "coin-chrome-token", arena: null });
    expect(m.defaultView).toBe(seatOf(house));
    const feed = (await call("GET", `/api/live/${m.matchId}?from=0`, { token: t })).body;
    expect(feed.defaultView).toBe(seatOf(house));
    expect(feed.p1.coin).toBe("coin-chrome-token");

    clock.t += 60 * 60_000;
    await live.tick();
    const one = (await call("GET", `/api/matches/${m.matchId}`, { token: t })).body;
    expect(one.coins).toEqual({ p1: "coin-chrome-token", p2: "coin-chrome-token" });
    expect(one[seatOf(house)]).toMatchObject({ ratingAtStart: 1720, coin: "coin-chrome-token", arena: null });
    expect(one[seatOf(ada)].ratingAtStart).toBe(1500);
    expect(one.defaultView).toBe(seatOf(house));
    // The record kept the raw loadouts: House's empty coin slot, Ada's Chrome Token.
    expect(store.matchById(m.matchId)!.loadouts![seatOf(house)].coin).toBeNull();
    expect(store.matchById(m.matchId)!.loadouts![seatOf(ada)].coin).toBe("coin-chrome-token");
    const replay = (await call("GET", `/api/matches/${m.matchId}/replay`, { token: t })).body as ReplayFile;
    expect(replay.coins).toEqual({ p1: "coin-chrome-token", p2: "coin-chrome-token" });
    // The coin is cosmetic: the replay still rebuilds the same match.
    const log = (await call("GET", `/api/matches/${m.matchId}/log`, { token: t })).body;
    const { state } = rebuildReplay(replay);
    expect(`${formatLog(state.log)}\n`).toBe(log);
  });

  it("history pages newest first with `before`, and refuses a match id that isn't yours", async () => {
    const { clock, live, store, call, signIn } = await setup();
    const t = await signIn("ada");
    await call("PUT", "/api/play/auto-play", { token: t, body: { on: true } });
    for (let i = 0; i < 3; i++) {
      await live.tick();
      clock.t += 60 * 60_000;
      await live.tick();
      clock.t += 31_000;
    }
    const all = store.matchHistory().map((m) => m.matchId).reverse();
    expect(all).toHaveLength(3);
    const p1 = (await call("GET", "/api/matches?limit=2", { token: t })).body;
    expect(p1.matches.map((m: { matchId: string }) => m.matchId)).toEqual(all.slice(0, 2));
    expect(p1.more).toBe(true);
    const p2 = (await call("GET", `/api/matches?limit=2&before=${all[1]}`, { token: t })).body;
    expect(p2.matches.map((m: { matchId: string }) => m.matchId)).toEqual(all.slice(2));
    expect(p2.more).toBe(false);
    expect((await call("GET", "/api/matches?before=nope", { token: t })).status).toBe(400);
    expect((await call("GET", "/api/matches?limit=0", { token: t })).status).toBe(400);
  });
});
