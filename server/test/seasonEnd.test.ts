// The season's end over the ladder and the owner API (session 82; Season 0
// game item 3, part 1). The live ladder, told to end the season, starts no
// new round, lets the matches being shown finish and be recorded, then the
// store ends the season (tier coins, final standings, retired Prototype
// runs). The house admin asks for it with POST /api/admin/season/end; every
// owner reads it with GET /api/season.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DeckFaction } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { Ladder, type LadderEvent, type LadderMatch } from "../src/ladder/ladderRunner.js";
import { LiveLadder } from "../src/ladder/liveLadder.js";
import { startOwnerApi, type RunningOwnerApi } from "../src/ownerApi.js";

const PW = "correct horse battery";
const dirs: string[] = [];
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const api of running.splice(0)) await api.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const FACTIONS: DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"];

function setup() {
  const clock = { t: Date.parse("2026-12-13T22:00:00.000Z") };
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const owners = FACTIONS.map((f, i) => {
    const acct = store.createAccount({ name: `House ${i}`, username: `house${i}`, password: PW, kind: "house", isAdmin: i === 0 });
    store.grantStarterCollection(acct.ownerId, f);
    const a = store.createAgent({ ownerId: acct.ownerId, name: `Agent ${i}` });
    store.connectAgent(acct.ownerId, a.agentId);
    return acct.ownerId;
  });
  const player = store.createAccount({ name: "Ada", username: "ada", password: PW, kind: "player" });
  const logDir = mkdtempSync(join(tmpdir(), "season-end-"));
  dirs.push(logDir);
  let n = 0;
  const events: LadderEvent[] = [];
  const recorded: LadderMatch[] = [];
  const live = new LiveLadder({
    store,
    seed: 82,
    build: { games: 0 },
    matchId: () => `se-${++n}`,
    now: () => clock.t,
    logDir,
    housePacks: false,
    roundGapMs: 30_000,
    onEvent: (e) => events.push(e),
    onRecorded: (m) => recorded.push(m),
  });
  return { clock, store, owners, player: player.ownerId, live, logDir, events, recorded };
}

async function api(store: EconomyStore, opts: { live?: LiveLadder; matchFiles?: string } = {}) {
  const server = await startOwnerApi({ store, port: 0, ...opts });
  running.push(server);
  const base = `http://127.0.0.1:${server.port}`;
  async function call(method: string, path: string, o: { token?: string; body?: unknown } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...(o.body !== undefined ? { "content-type": "application/json" } : {}) },
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, body: (await res.json()) as any };
  }
  async function signIn(username: string): Promise<string> {
    const r = await call("POST", "/api/session", { body: { login: username, password: PW } });
    expect(r.status).toBe(201);
    return r.body.token as string;
  }
  return { call, signIn };
}

/** Ticks the clock forward a second at a time until `done` or `limitMs`. */
async function runUntil(ctx: ReturnType<typeof setup>, done: () => boolean, limitMs = 30 * 60_000) {
  const stop = ctx.clock.t + limitMs;
  while (!done() && ctx.clock.t < stop) {
    ctx.clock.t += 1000;
    await ctx.live.tick();
  }
  expect(done()).toBe(true);
}

describe("the season's end: the ladder", () => {
  it("ending while matches are shown: no new round, the shown matches finish and count, then the season ends", async () => {
    const ctx = setup();
    await ctx.live.tick();
    const shown = ctx.live.showing().map((s) => s.matchId).sort();
    expect(shown).toHaveLength(2);
    expect(ctx.live.seasonState()).toBe("open");

    expect(await ctx.live.endSeason()).toBe("ending");
    expect(ctx.store.seasonEnded()).toBe(false);
    await runUntil(ctx, () => ctx.store.seasonEnded());

    // Both shown matches were recorded as played (not cancelled), and no
    // match started after the ask.
    expect(ctx.recorded.map((m) => m.record.matchId).sort()).toEqual(shown);
    expect(ctx.recorded.every((m) => m.record.outcome !== "cancelled")).toBe(true);
    expect(ctx.store.matchHistory().map((m) => m.matchId).sort()).toEqual(shown);
    expect(ctx.live.seasonState()).toBe("ended");
    const end = ctx.store.seasonEnd()!;
    expect(end.standings).toHaveLength(4);
    const ev = ctx.events.filter((e) => e.kind === "seasonEnded");
    expect(ev).toEqual([{ kind: "seasonEnded", season: "S0", endedAt: end.endedAt, standings: 4, retiredCopies: 1516 }]);

    // Hours later: still no round.
    for (let i = 0; i < 20; i++) {
      ctx.clock.t += 10 * 60_000;
      await ctx.live.tick();
    }
    expect(ctx.live.showing()).toEqual([]);
    expect(ctx.store.matchHistory()).toHaveLength(2);
    expect(ctx.store.liveMatches()).toEqual([]);
  });

  it("ending with nothing live ends it at once; the plain ladder pairs nobody after", async () => {
    const ctx = setup();
    expect(await ctx.live.endSeason()).toBe("ended");
    expect(ctx.store.seasonEnd()!.standings).toEqual([]);
    expect(await ctx.live.endSeason()).toBe("ended");
    const ladder = new Ladder({ store: ctx.store, seed: 1, build: { games: 0 }, housePacks: false });
    expect(ladder.eligibleOwners()).toEqual([]);
    const report = await ladder.runRound(ctx.owners);
    expect(report.pairs).toEqual([]);
    expect(report.matches).toEqual([]);
  });
});

describe("the season's end: the owner API", () => {
  it("GET /api/season while open, the admin's POST (202, ending), then the final standings", async () => {
    const ctx = setup();
    const { call, signIn } = await api(ctx.store, { live: ctx.live, matchFiles: ctx.logDir });
    const admin = await signIn("house0");
    const ada = await signIn("ada");
    await ctx.live.tick();

    const open = await call("GET", "/api/season", { token: ada });
    expect(open.status).toBe(200);
    expect(open.body).toMatchObject({ season: "S0", state: "open", endedAt: null, liveMatches: 2, you: null, standings: null, retiredPrototypes: null });
    expect(open.body.tierCoinsNow).toEqual({ tier: "Placement", coins: [] });

    // Only the admin, and only for the season named.
    expect((await call("POST", "/api/admin/season/end", { token: ada, body: { season: "S0" } })).status).toBe(403);
    const wrong = await call("POST", "/api/admin/season/end", { token: admin, body: { season: "S1" } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toMatch(/must name the season being ended \("S0"\)/);
    expect((await call("POST", "/api/admin/season/end", { body: { season: "S0" } })).status).toBe(401);

    const asked = await call("POST", "/api/admin/season/end", { token: admin, body: { season: "S0" } });
    expect(asked.status).toBe(202);
    expect(asked.body).toMatchObject({ state: "ending", liveMatches: 2 });
    expect((await call("GET", "/api/season", { token: ada })).body.state).toBe("ending");

    await runUntil(ctx, () => ctx.store.seasonEnded());
    const ended = await call("GET", "/api/season", { token: admin });
    expect(ended.body.state).toBe("ended");
    expect(ended.body.endedAt).toBe(ctx.store.seasonEnd()!.endedAt);
    expect(ended.body.liveMatches).toBe(0);
    expect(ended.body.tierCoinsNow).toBeNull();
    expect(ended.body.standings.map((r: { ownerName: string }) => r.ownerName).sort()).toEqual(["House 0", "House 1", "House 2", "House 3"]);
    expect(ended.body.you).toMatchObject({ ownerId: ctx.owners[0], ownerName: "House 0", agentName: "Agent 0", ratedMatches: 1, rank: null });
    expect(ended.body.retiredPrototypes).toHaveLength(15);
    expect((await call("GET", "/api/season", { token: ada })).body.you).toBeNull(); // never rated
    const again = await call("POST", "/api/admin/season/end", { token: admin, body: { season: "S0" } });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/already ended/);
  });

  it("with no ladder running, the admin's POST ends the season at once (200); a live match refuses it (409) until it is recorded", async () => {
    const ctx = setup();
    const { call, signIn } = await api(ctx.store);
    const admin = await signIn("house0");
    // The ladder runs elsewhere (not this API's): its matches are live in the store.
    await ctx.live.tick();
    const refused = await call("POST", "/api/admin/season/end", { token: admin, body: { season: "S0" } });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/2 matches are still live: end the season once they are recorded/);
    expect(ctx.store.seasonEnded()).toBe(false);
    await runUntil(ctx, () => ctx.store.liveMatches().length === 0);
    const done = await call("POST", "/api/admin/season/end", { token: admin, body: { season: "S0" } });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ season: "S0", state: "ended", liveMatches: 0 });
    expect(done.body.standings).toHaveLength(4);
  });
});
