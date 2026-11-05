// Featured picks and viewer counts (session 74; owner app spec 2026-10-05
// C.4: Watch live's "Tournament" and "Top rated" groups, and viewer counts).
// The rule is checked as pure functions (featured.ts, viewers.ts), then end
// to end: a long-lived ladder with owners whose ratings were set by real
// recorded matches, read over HTTP.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore, PLACEMENT_MATCHES } from "@ai-tcg/economy";
import { compareTopRated, featuredPicks, TOP_RATED_MAX, topRatedEligible, type FeaturedInput } from "../src/ladder/featured.js";
import { LiveLadder, type LiveMatchView } from "../src/ladder/liveLadder.js";
import type { LadderMatch } from "../src/ladder/ladderRunner.js";
import { VIEWER_WINDOW_MS, ViewerCounter } from "../src/ladder/viewers.js";
import { startOwnerApi, type RunningOwnerApi } from "../src/ownerApi.js";

const PW = "correct horse battery";
const dirs: string[] = [];
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const api of running.splice(0)) await api.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const T0 = Date.parse("2026-11-05T22:00:00.000Z");

/** A live match as the rule reads it. */
function m(id: string, p1: [number, string], p2: [number, string], startedAt = T0): FeaturedInput {
  return { matchId: id, startedAt: new Date(startedAt).toISOString(), p1: { rating: p1[0], tier: p1[1] }, p2: { rating: p2[0], tier: p2[1] } };
}

describe("the Top rated rule (featured.ts)", () => {
  it("needs both sides out of placement", () => {
    expect(topRatedEligible(m("a", [1700, "Platinum"], [1600, "Gold"]))).toBe(true);
    expect(topRatedEligible(m("b", [1900, "Diamond"], [1500, "Placement"]))).toBe(false);
    expect(topRatedEligible(m("c", [1500, "Placement"], [1900, "Diamond"]))).toBe(false);
    expect(topRatedEligible(m("d", [1500, "Placement"], [1500, "Placement"]))).toBe(false);
  });

  it("ranks by the weaker side's starting rating, not the stronger", () => {
    // A Mythic against a Bronze ranks below two Golds.
    const stomp = m("stomp", [2000, "Mythic"], [1200, "Bronze"]);
    const even = m("even", [1520, "Gold"], [1510, "Gold"]);
    expect(featuredPicks([stomp, even]).topRated).toEqual(["even", "stomp"]);
  });

  it("breaks ties by the stronger side, then the earlier start, then the id", () => {
    const a = m("a", [1600, "Gold"], [1700, "Platinum"]);
    const b = m("b", [1800, "Diamond"], [1600, "Gold"]);
    expect(compareTopRated(a, b)).toBeGreaterThan(0); // same low (1600); b's high is higher
    const early = m("late-id", [1600, "Gold"], [1700, "Platinum"], T0);
    const late = m("early-id", [1600, "Gold"], [1700, "Platinum"], T0 + 1000);
    expect(featuredPicks([late, early]).topRated).toEqual(["late-id", "early-id"]);
    const x = m("x", [1600, "Gold"], [1700, "Platinum"]);
    const y = m("y", [1600, "Gold"], [1700, "Platinum"]);
    expect(featuredPicks([y, x]).topRated).toEqual(["x", "y"]);
  });

  it(`shows at most ${TOP_RATED_MAX}, and honours a rating floor when one is set`, () => {
    const many = [1400, 1500, 1600, 1700, 1800].map((r, i) => m(`m${i}`, [r, "Gold"], [r + 10, "Gold"]));
    expect(featuredPicks(many).topRated).toEqual(["m4", "m3", "m2"]);
    expect(featuredPicks(many, { max: 5 }).topRated).toEqual(["m4", "m3", "m2", "m1", "m0"]);
    expect(featuredPicks(many, { max: 5, minRating: 1500 }).topRated).toEqual(["m4", "m3", "m2", "m1"]);
  });

  it("has no tournament group in Season 0, and nothing live features nothing", () => {
    expect(featuredPicks([])).toEqual({ tournament: [], topRated: [] });
    expect(featuredPicks([m("a", [1700, "Platinum"], [1600, "Gold"])]).tournament).toEqual([]);
  });
});

describe("viewer counts (viewers.ts)", () => {
  it("counts each owner once, for the window after its last read", () => {
    const v = new ViewerCounter();
    v.saw("m1", "ada", T0);
    v.saw("m1", "ada", T0 + 3000); // a second tab, or the next poll
    v.saw("m1", "bea", T0 + 1000);
    v.saw("m2", "ada", T0); // watching two matches at once
    expect(v.count("m1", T0 + 3000)).toBe(2);
    expect(v.count("m2", T0 + 3000)).toBe(1);
    // bea's window ends 30 s after her read; ada's after her last.
    expect(v.count("m1", T0 + 1000 + VIEWER_WINDOW_MS - 1)).toBe(2);
    expect(v.count("m1", T0 + 1000 + VIEWER_WINDOW_MS)).toBe(1);
    expect(v.count("m1", T0 + 3000 + VIEWER_WINDOW_MS)).toBe(0);
    expect(v.count("m2", T0 + VIEWER_WINDOW_MS)).toBe(0);
    expect(v.tracked()).toBe(0);
  });

  it("a read out of order never shortens a window; a match's viewers go with it", () => {
    const v = new ViewerCounter(10_000);
    v.saw("m1", "ada", T0 + 5000);
    v.saw("m1", "ada", T0);
    expect(v.count("m1", T0 + 14_999)).toBe(1);
    v.forget("m1");
    expect(v.count("m1", T0)).toBe(0);
    expect(v.tracked()).toBe(0);
  });
});

/** House owners (always queued), with ratings set by real recorded
 * matches: `placed` owners play a full round robin (strongest first beats
 * every later one), so each has at least PLACEMENT_MATCHES rated matches;
 * `fresh` owners play one match between themselves and stay in placement. */
async function setup(placed: [string, DeckFaction][], fresh: [string, DeckFaction][], seed = 74) {
  const clock = { t: T0 };
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const agents = new Map<string, string>();
  const owners = new Map<string, string>();
  for (const [name, faction] of [...placed, ...fresh]) {
    const acct = store.createAccount({ name, username: name.toLowerCase(), password: PW, kind: "house" });
    store.grantStarterCollection(acct.ownerId, faction);
    const a = store.createAgent({ ownerId: acct.ownerId, name: `${name}-agent` });
    store.connectAgent(acct.ownerId, a.agentId);
    agents.set(name, a.agentId);
    owners.set(name, acct.ownerId);
  }
  // Spectators: signed-in owners with no agent.
  for (const name of ["Cyd", "Dot", "Eve"]) store.createAccount({ name, username: name.toLowerCase(), password: PW, kind: "player" });
  let n = 0;
  const rec = (a: string, b: string) =>
    store.recordMatch({ matchId: `seed-${++n}`, seed: n, p1AgentId: agents.get(a)!, p2AgentId: agents.get(b)!, outcome: { kind: "win", winnerAgentId: agents.get(a)! } });
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) rec(placed[i]![0], placed[j]![0]);
  if (fresh.length >= 2) rec(fresh[0]![0], fresh[1]![0]);
  const logDir = mkdtempSync(join(tmpdir(), "featured-"));
  dirs.push(logDir);
  let k = 0;
  const recorded: LadderMatch[] = [];
  const live = new LiveLadder({
    store,
    seed,
    build: { games: 0 },
    matchId: () => `fv-${++k}`,
    now: () => clock.t,
    logDir,
    housePacks: false,
    roundGapMs: 30_000,
    onRecorded: (x) => recorded.push(x),
  });
  const api = await startOwnerApi({ store, port: 0, live, matchFiles: logDir });
  running.push(api);
  const base = `http://127.0.0.1:${api.port}`;
  async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.body !== undefined ? { "content-type": "application/json" } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, body: (await res.json()) as any };
  }
  async function signIn(username: string): Promise<string> {
    const r = await call("POST", "/api/session", { body: { login: username, password: PW } });
    expect(r.status).toBe(201);
    return r.body.token as string;
  }
  return { clock, store, live, owners, recorded, call, signIn };
}

const PLACED: [string, DeckFaction][] = [
  ["Ace", "Cortex"],
  ["Bix", "Swarm"],
  ["Cog", "Aegis"],
  ["Dex", "Null"],
  ["Elm", "Cortex"],
  ["Fax", "Swarm"],
];

describe("Watch live: featured and viewers over HTTP", () => {
  it("GET /api/live groups the live matches by the rule, on the ratings each match started with", async () => {
    const ctx = await setup(PLACED, [["Gus", "Aegis"], ["Hal", "Null"]]);
    for (const [name] of PLACED) expect(ctx.store.rating(ctx.owners.get(name)!).ratedMatches).toBeGreaterThanOrEqual(PLACEMENT_MATCHES);
    expect(ctx.store.rating(ctx.owners.get("Gus")!).tier).toBe("Placement");
    await ctx.live.tick();
    const t = await ctx.signIn("cyd");
    const list = (await ctx.call("GET", "/api/live", { token: t })).body;
    const matches = list.matches as LiveMatchView[];
    expect(matches.length).toBe(4);
    // The groups are exactly the rule on what the list itself shows.
    const eligible = matches.filter((x) => x.p1.tier !== "Placement" && x.p2.tier !== "Placement");
    const want = [...eligible].sort((a, b) => Math.min(b.p1.rating, b.p2.rating) - Math.min(a.p1.rating, a.p2.rating) || Math.max(b.p1.rating, b.p2.rating) - Math.max(a.p1.rating, a.p2.rating)).slice(0, TOP_RATED_MAX);
    expect(list.featured).toEqual({ tournament: [], topRated: want.map((x) => x.matchId) });
    // At least one match has a side in placement, and it isn't featured.
    const withPlacement = matches.filter((x) => x.p1.tier === "Placement" || x.p2.tier === "Placement");
    expect(withPlacement.length).toBeGreaterThan(0);
    for (const x of withPlacement) expect(list.featured.topRated).not.toContain(x.matchId);
    // The top pick's weaker side is at least every other eligible match's weaker side.
    const low = (x: LiveMatchView) => Math.min(x.p1.rating, x.p2.rating);
    const top = matches.find((x) => x.matchId === list.featured.topRated[0])!;
    for (const x of eligible) expect(low(top)).toBeGreaterThanOrEqual(low(x));
  });

  it("counts an owner reading the feed, once, for 30 s; the list is not watching; a finished match has none", async () => {
    const ctx = await setup(PLACED.slice(0, 2), []);
    await ctx.live.tick();
    const [cy, dot, eve] = [await ctx.signIn("cyd"), await ctx.signIn("dot"), await ctx.signIn("eve")];
    const id = (await ctx.call("GET", "/api/live", { token: cy })).body.matches[0].matchId as string;
    const viewers = async () => (await ctx.call("GET", "/api/live", { token: eve })).body.matches[0].viewers as number;
    expect(await viewers()).toBe(0); // reading the list counts nobody
    // The first read already counts the reader.
    expect((await ctx.call("GET", `/api/live/${id}?from=0`, { token: cy })).body.viewers).toBe(1);
    await ctx.call("GET", `/api/live/${id}?from=0`, { token: cy }); // a second tab
    expect((await ctx.call("GET", `/api/live/${id}?from=0`, { token: dot })).body.viewers).toBe(2);
    expect(await viewers()).toBe(2);
    // cy keeps polling every 3 s; dot stops.
    for (let s = 0; s < 10; s++) {
      ctx.clock.t += 3000;
      await ctx.call("GET", `/api/live/${id}?from=0`, { token: cy });
    }
    expect(await viewers()).toBe(1);
    // A hidden tab's 15 s poll keeps cy counted.
    ctx.clock.t += 15_000;
    await ctx.call("GET", `/api/live/${id}?from=0`, { token: cy });
    ctx.clock.t += 15_000;
    expect(await viewers()).toBe(1);
    ctx.clock.t += 15_000;
    expect(await viewers()).toBe(0);
    // Run the match out: once recorded, the next round's match starts at 0.
    await ctx.call("GET", `/api/live/${id}?from=0`, { token: cy });
    for (let guard = 0; ctx.recorded.length === 0; guard++) {
      if (guard > 100_000) throw new Error("the match never ended");
      ctx.clock.t += 1000;
      await ctx.live.tick();
    }
    expect((await ctx.call("GET", `/api/live/${id}`, { token: cy })).status).toBe(404);
    ctx.clock.t += 31_000;
    await ctx.live.tick();
    const next = (await ctx.call("GET", "/api/live", { token: cy })).body.matches;
    expect(next.length).toBe(1);
    expect(next[0].matchId).not.toBe(id);
    expect(next[0].viewers).toBe(0);
  });

  it("the players' own owners count when they watch, and the speed vote is unaffected", async () => {
    const ctx = await setup(PLACED.slice(0, 2), []);
    await ctx.live.tick();
    const ace = await ctx.signIn("ace");
    const id = (await ctx.call("GET", "/api/live", { token: ace })).body.matches[0].matchId as string;
    const feed = (await ctx.call("GET", `/api/live/${id}?from=0`, { token: ace })).body;
    expect(feed.viewers).toBe(1);
    expect(feed.speed.rate).toBe(1);
  });
});
