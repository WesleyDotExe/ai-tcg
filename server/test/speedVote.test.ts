// The 2× vote (session 73; owner app spec 2026-10-05 D): a match starts at
// 1× and runs at 2× only while both owners agree; "Ask for 2× in every
// match" asks as each match starts; the screen can show who is waited on;
// the vote resets every match; and speed changes only the pace, never the
// match. The pace is checked against the timeline's own holds (stepHoldMs),
// and "never the match" against a 1× run of the same seed: the record, the
// log and the replay are byte for byte the same.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { LiveLadder } from "../src/ladder/liveLadder.js";
import type { LadderMatch } from "../src/ladder/ladderRunner.js";
import { agrees, rateOf, rescaleRemaining, speedView, startingVote, type SpeedVote } from "../src/ladder/speedVote.js";
import { stepHoldMs, WATCH_PACE_MS, watchLengthMs } from "../src/ladder/timeline.js";
import { startOwnerApi, type RunningOwnerApi } from "../src/ownerApi.js";

const PW = "correct horse battery";
const dirs: string[] = [];
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const api of running.splice(0)) await api.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

type Kind = "player" | "house";

/** A ladder of exactly the owners named, so who meets whom is known. */
function setup(owners: { name: string; kind: Kind; faction: DeckFaction; ask?: boolean }[], seed = 73) {
  const clock = { t: Date.parse("2026-11-03T22:00:00.000Z") };
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const ids: string[] = [];
  for (const o of owners) {
    const acct = store.createAccount({ name: o.name, username: o.name.toLowerCase(), password: PW, kind: o.kind });
    store.grantStarterCollection(acct.ownerId, o.faction);
    const a = store.createAgent({ ownerId: acct.ownerId, name: `${o.name}-agent` });
    store.connectAgent(acct.ownerId, a.agentId);
    if (o.kind === "player") store.setAutoPlay(acct.ownerId, true);
    if (o.ask) store.updateAccountSettings(acct.ownerId, { ask2xEveryMatch: true });
    ids.push(acct.ownerId);
  }
  const logDir = mkdtempSync(join(tmpdir(), "speed-vote-"));
  dirs.push(logDir);
  let n = 0;
  const recorded: { m: LadderMatch; startedAt: number; endedAt: number }[] = [];
  const live = new LiveLadder({
    store,
    seed,
    build: { games: 0 },
    matchId: () => `sv-${++n}`,
    now: () => clock.t,
    logDir,
    housePacks: false,
    roundGapMs: 30_000,
    onRecorded: (m, shown) => recorded.push({ m, ...shown }),
  });
  return { clock, store, live, ids, recorded, logDir };
}

const PVP = [
  { name: "Ada", kind: "player" as const, faction: "Cortex" as const },
  { name: "Bea", kind: "player" as const, faction: "Swarm" as const },
];

/** Ticks in `stepMs` steps until the match being shown is recorded. */
async function runOut(ctx: ReturnType<typeof setup>, stepMs = 250, onTick?: () => void) {
  const before = ctx.recorded.length;
  for (let guard = 0; ctx.recorded.length === before; guard++) {
    if (guard > 100_000) throw new Error("the match never ended");
    ctx.clock.t += stepMs;
    await ctx.live.tick();
    onTick?.();
  }
}

describe("the 2× rule (speedVote.ts)", () => {
  const vote = (asks: [boolean, boolean], house: [boolean, boolean]): SpeedVote => ({ asks: { p1: asks[0], p2: asks[1] }, house: { p1: house[0], p2: house[1] } });

  it("two player owners: 2× only when both ask; one asking waits on the other", () => {
    expect(rateOf(vote([false, false], [false, false]))).toBe(1);
    expect(rateOf(vote([true, false], [false, false]))).toBe(1);
    expect(rateOf(vote([false, true], [false, false]))).toBe(1);
    expect(rateOf(vote([true, true], [false, false]))).toBe(2);
    expect(speedView(vote([true, false], [false, false])).waitingOn).toBe("p2");
    expect(speedView(vote([false, true], [false, false])).waitingOn).toBe("p1");
    expect(speedView(vote([false, false], [false, false])).waitingOn).toBeNull();
    expect(speedView(vote([true, true], [false, false]))).toEqual({ rate: 2, asks: { p1: true, p2: true }, house: { p1: false, p2: false }, waitingOn: null });
  });

  it("a house side agrees to what its player opponent asks; house against house stays 1×", () => {
    expect(rateOf(vote([false, false], [false, true]))).toBe(1);
    expect(rateOf(vote([true, false], [false, true]))).toBe(2);
    expect(agrees(vote([true, false], [false, true]), "p2")).toBe(true);
    expect(rateOf(vote([false, true], [true, false]))).toBe(2);
    // A house side's own ask (never set by the ladder) counts for nothing.
    expect(rateOf(vote([true, true], [true, true]))).toBe(1);
    expect(speedView(vote([false, false], [false, true])).waitingOn).toBeNull();
  });

  it("a starting vote asks only for a player side with the setting on", () => {
    expect(startingVote({ p1: { house: false, askEveryMatch: true }, p2: { house: false, askEveryMatch: false } }).asks).toEqual({ p1: true, p2: false });
    expect(startingVote({ p1: { house: true, askEveryMatch: true }, p2: { house: false, askEveryMatch: true } }).asks).toEqual({ p1: false, p2: true });
  });

  it("what is left of a hold scales with the change", () => {
    expect(rescaleRemaining(4000, 1, 2)).toBe(2000);
    expect(rescaleRemaining(1500, 2, 1)).toBe(3000);
    expect(rescaleRemaining(3, 1, 2)).toBe(2);
    expect(rescaleRemaining(-5, 1, 2)).toBe(0);
    expect(rescaleRemaining(700, 1, 1)).toBe(700);
  });
});

describe("the 2× vote on the live ladder", () => {
  it("starts at 1×; one ask waits on the other owner; both asking halves what is left of the hold and every hold after; taking it back returns to 1×", async () => {
    const ctx = setup(PVP);
    const { live, clock, ids } = ctx;
    await live.tick();
    const [m] = live.liveMatches();
    expect(m).toBeDefined();
    expect(m!.speed).toEqual({ rate: 1, asks: { p1: false, p2: false }, house: { p1: false, p2: false }, waitingOn: null });
    const seatOf = (ownerId: string) => (m!.p1.ownerId === ownerId ? "p1" : "p2");
    const [ada, bea] = ids as [string, string];

    // Part-way through the first hold, Ada asks: still 1×, waiting on Bea.
    const firstAt = Date.parse(m!.nextAt!);
    clock.t += 1000;
    const one = live.askForSpeed(m!.matchId, ada, true);
    expect(one.ok && one.speed).toMatchObject({ rate: 1, waitingOn: seatOf(bea) });
    expect(one.ok && Date.parse(one.nextAt!)).toBe(firstAt);

    // Bea agrees: 2×, and only the part of the hold not yet waited is halved.
    const left = firstAt - clock.t;
    const both = live.askForSpeed(m!.matchId, bea, true);
    expect(both.ok && both.speed).toMatchObject({ rate: 2, waitingOn: null, asks: { p1: true, p2: true } });
    expect(both.ok && Date.parse(both.nextAt!)).toBe(clock.t + left / 2);
    expect(Date.parse(live.liveMatch(m!.matchId)!.nextAt!)).toBe(clock.t + left / 2);

    // Every hold after is half its 1× length (the timeline's own holds,
    // rebuilt from the feed: a hold depends only on its step and the one before).
    let prev = Date.parse(live.liveMatch(m!.matchId)!.nextAt!);
    clock.t = prev;
    await live.tick();
    for (let checked = 0; checked < 12; checked++) {
      const next = Date.parse(live.liveMatch(m!.matchId)!.nextAt!);
      clock.t = next;
      await live.tick();
      const f = live.liveMatch(m!.matchId, 0)!;
      const timeline = { start: f.start!, steps: f.steps, startLines: [], openingHands: { p1: [], p2: [] } };
      expect(next - prev, `hold before move ${f.released}`).toBe(stepHoldMs(timeline, f.released - 1) / 2);
      prev = next;
    }
    prev = Date.parse(live.liveMatch(m!.matchId)!.nextAt!);

    // Ada takes it back: 1× again, waiting on Ada now, what's left doubled.
    clock.t = prev - 200;
    const back = live.askForSpeed(m!.matchId, ada, false);
    expect(back.ok && back.speed).toMatchObject({ rate: 1, waitingOn: seatOf(ada), asks: { [seatOf(ada)]: false, [seatOf(bea)]: true } });
    expect(back.ok && Date.parse(back.nextAt!)).toBe(clock.t + 400);
    // Asking the same thing twice changes nothing.
    const again = live.askForSpeed(m!.matchId, ada, false);
    expect(again.ok && again.nextAt).toBe(back.ok && back.nextAt);
    await live.stop();
  });

  it("at 2× from the first move, every hold is exactly half the timeline's 1× hold, and the match shows in half the time", async () => {
    const ctx = setup(PVP.map((o) => ({ ...o, ask: true })));
    const { live, clock } = ctx;
    await live.tick();
    const [m] = live.liveMatches();
    expect(m!.speed.rate).toBe(2);
    const startedAt = Date.parse(m!.startedAt);
    // The full timeline, read once the last move is out.
    const releasedAt: number[] = [];
    let last = 0;
    await runOut(ctx, 250, () => {
      const f = live.liveMatch(m!.matchId);
      if (f && f.released > last) {
        for (let i = last; i < f.released; i++) releasedAt.push(clock.t);
        last = f.released;
      }
    });
    const rec = ctx.recorded.at(-1)!;
    // Rebuild the 1× holds from the same match played at 1× (same seed).
    const slow = setup(PVP);
    await slow.live.tick();
    const [sm] = slow.live.liveMatches();
    let feed = slow.live.liveMatch(sm!.matchId, 0)!;
    while (feed.nextAt !== null) {
      slow.clock.t = Date.parse(feed.nextAt);
      await slow.live.tick();
      feed = slow.live.liveMatch(sm!.matchId, 0)!;
    }
    const timeline = { start: feed.start!, steps: feed.steps, startLines: [], openingHands: { p1: [], p2: [] } };
    const oneX = watchLengthMs(timeline);
    expect(rec.endedAt - startedAt).toBeGreaterThanOrEqual(oneX / 2);
    expect(rec.endedAt - startedAt).toBeLessThan(oneX / 2 + 250);
    // Each release came no earlier than its 2× due time, and within a tick of it.
    let due = startedAt;
    for (let i = 0; i < releasedAt.length; i++) {
      due += stepHoldMs(timeline, i) / 2;
      expect(releasedAt[i]!, `move ${i + 1}`).toBeGreaterThanOrEqual(due);
      expect(releasedAt[i]! - due, `move ${i + 1}`).toBeLessThan(250);
    }
    expect(releasedAt).toHaveLength(timeline.steps.length);
    await live.stop();
    await slow.live.stop();
  });

  it("never changes the match: at 2× the record, log and replay are those of the same match at 1×", async () => {
    const fast = setup(PVP.map((o) => ({ ...o, ask: true })));
    const slow = setup(PVP);
    for (const ctx of [fast, slow]) {
      await ctx.live.tick();
      await runOut(ctx, 1000);
    }
    const [f, s] = [fast.recorded[0]!, slow.recorded[0]!];
    expect(f.m.record.matchId).toBe(s.m.record.matchId);
    // The two stores made their own random ids (owners, agents, decks):
    // each id is renamed by where it first appears, so the same id must
    // stand in the same places in both.
    const same = (text: string) => {
      const seen = new Map<string, string>();
      return text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (id) => {
        if (!seen.has(id)) seen.set(id, `id${seen.size}`);
        return seen.get(id)!;
      });
    };
    const record = (r: typeof f.m.record) => {
      const { endedAt: _e, ...rest } = r as typeof r & { endedAt: string };
      return same(JSON.stringify(rest));
    };
    expect(record(f.m.record)).toBe(record(s.m.record));
    expect(same(readFileSync(f.m.logPath!, "utf8"))).toBe(same(readFileSync(s.m.logPath!, "utf8")));
    expect(same(readFileSync(f.m.replayPath!, "utf8"))).toBe(same(readFileSync(s.m.replayPath!, "utf8")));
    // And the 2× match really was shown faster.
    expect(f.endedAt - f.startedAt).toBeLessThan((s.endedAt - s.startedAt) * 0.51);
    await fast.live.stop();
    await slow.live.stop();
  });

  it("the setting asks as each match starts; only one owner with it on waits on the other", async () => {
    const ctx = setup([{ ...PVP[0]!, ask: true }, PVP[1]!]);
    await ctx.live.tick();
    const [m] = ctx.live.liveMatches();
    const adaSeat = m!.p1.ownerId === ctx.ids[0] ? "p1" : "p2";
    expect(m!.speed).toMatchObject({ rate: 1, asks: { [adaSeat]: true, [adaSeat === "p1" ? "p2" : "p1"]: false }, waitingOn: adaSeat === "p1" ? "p2" : "p1" });
    await ctx.live.stop();
  });

  it("the vote resets every match: a tap asks for this match only", async () => {
    const ctx = setup(PVP);
    const { live, ids, clock } = ctx;
    await live.tick();
    const first = live.liveMatches()[0]!;
    live.askForSpeed(first.matchId, ids[0]!, true);
    live.askForSpeed(first.matchId, ids[1]!, true);
    expect(live.liveMatches()[0]!.speed.rate).toBe(2);
    await runOut(ctx, 1000);
    clock.t += 31_000;
    await live.tick();
    const second = live.liveMatches()[0]!;
    expect(second.matchId).not.toBe(first.matchId);
    expect(second.speed).toMatchObject({ rate: 1, asks: { p1: false, p2: false } });
    await live.stop();
  });

  it("against a house owner one ask is enough; the house side can't ask; house against house stays 1×", async () => {
    const pvh = setup([PVP[0]!, { name: "House", kind: "house", faction: "Null" }]);
    await pvh.live.tick();
    const m = pvh.live.liveMatches()[0]!;
    const houseSeat = m.p1.ownerId === pvh.ids[1] ? "p1" : "p2";
    expect(m.speed).toMatchObject({ rate: 1, house: { [houseSeat]: true }, waitingOn: null });
    expect(pvh.live.askForSpeed(m.matchId, pvh.ids[1]!, true)).toEqual({ ok: false, reason: "house" });
    const asked = pvh.live.askForSpeed(m.matchId, pvh.ids[0]!, true);
    expect(asked.ok && asked.speed.rate).toBe(2);
    await pvh.live.stop();

    const hvh = setup([
      { name: "Hal1", kind: "house", faction: "Aegis", ask: true },
      { name: "Hal2", kind: "house", faction: "Swarm", ask: true },
    ]);
    await hvh.live.tick();
    const h = hvh.live.liveMatches()[0]!;
    // The setting is ignored for a house side.
    expect(h.speed).toMatchObject({ rate: 1, asks: { p1: false, p2: false }, house: { p1: true, p2: true } });
    expect(hvh.live.askForSpeed(h.matchId, hvh.ids[0]!, true)).toEqual({ ok: false, reason: "house" });
    await hvh.live.stop();
  });

  it("an owner not in the match can't vote; an unknown match isn't live", async () => {
    const ctx = setup([...PVP, { name: "Cyd", kind: "player", faction: "Aegis" }]);
    await ctx.live.tick();
    // Three player owners: two play, one sits out this round.
    const m = ctx.live.liveMatches()[0]!;
    const out = ctx.ids.find((o) => o !== m.p1.ownerId && o !== m.p2.ownerId)!;
    expect(ctx.live.askForSpeed(m.matchId, out, true)).toEqual({ ok: false, reason: "notYourMatch" });
    expect(ctx.live.askForSpeed("nope", m.p1.ownerId, true)).toEqual({ ok: false, reason: "notLive" });
    await ctx.live.stop();
  });

  it("after the last move, the result's hold is halved too", async () => {
    const ctx = setup(PVP);
    const { live, clock, ids } = ctx;
    await live.tick();
    const m = live.liveMatches()[0]!;
    let f = live.liveMatch(m.matchId)!;
    while (f.nextAt !== null) {
      clock.t = Date.parse(f.nextAt);
      await live.tick();
      f = live.liveMatch(m.matchId)!;
    }
    // The last move just came out: the result holds WATCH_PACE_MS.end at 1×.
    const outAt = clock.t;
    live.askForSpeed(m.matchId, ids[0]!, true);
    live.askForSpeed(m.matchId, ids[1]!, true);
    clock.t = outAt + WATCH_PACE_MS.end / 2 - 1;
    await live.tick();
    expect(ctx.recorded).toHaveLength(0);
    clock.t += 1;
    await live.tick();
    expect(ctx.recorded).toHaveLength(1);
    await live.stop();
  });
});

describe("PUT /api/live/:matchId/speed", () => {
  it("401 without a token; 400 for a bad body; 403 for an owner not in it; 409 for a house owner; 404 when not live or ended; 200 with the vote, which GET shows", async () => {
    const ctx = setup([...PVP, { name: "Cyd", kind: "player", faction: "Aegis" }, { name: "Hal", kind: "house", faction: "Null" }]);
    const api = await startOwnerApi({ store: ctx.store, port: 0, live: ctx.live, matchFiles: ctx.logDir });
    running.push(api);
    const call = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
      const res = await fetch(`http://localhost:${api.port}${path}`, {
        method,
        headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), "Content-Type": "application/json" },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
      const text = await res.text();
      return { status: res.status, body: text === "" ? null : JSON.parse(text) };
    };
    const token = async (login: string) => (await call("POST", "/api/session", { body: { login, password: PW } })).body.token as string;
    await ctx.live.tick();
    const matches = ctx.live.liveMatches();
    expect(matches).toHaveLength(2);
    const name = (ownerId: string) => ctx.store.getOwner(ownerId).name.toLowerCase();
    const pvp = matches.find((m) => ctx.store.getOwner(m.p1.ownerId).kind === "player" && ctx.store.getOwner(m.p2.ownerId).kind === "player");
    const withHouse = matches.find((m) => m !== pvp)!;
    const houseSide = ctx.store.getOwner(withHouse.p1.ownerId).kind === "house" ? withHouse.p1 : withHouse.p2;
    const playerVsHouse = houseSide === withHouse.p1 ? withHouse.p2 : withHouse.p1;
    expect(pvp).toBeDefined();

    const path = `/api/live/${pvp!.matchId}/speed`;
    expect((await call("PUT", path, { body: { ask: true } })).status).toBe(401);
    const a = await token(name(pvp!.p1.ownerId));
    const b = await token(name(pvp!.p2.ownerId));
    const c = await token(name(playerVsHouse.ownerId));
    const h = await token(name(houseSide.ownerId));
    for (const body of [{}, { ask: "yes" }, { ask: 1 }]) expect((await call("PUT", path, { token: a, body })).status).toBe(400);
    const notMine = await call("PUT", path, { token: c, body: { ask: true } });
    expect(notMine.status).toBe(403);
    expect(notMine.body.error).toMatch(/only its two owners vote/);
    const house = await call("PUT", `/api/live/${withHouse.matchId}/speed`, { token: h, body: { ask: true } });
    expect(house.status).toBe(409);
    expect((await call("PUT", "/api/live/nope/speed", { token: a, body: { ask: true } })).status).toBe(404);

    const first = await call("PUT", path, { token: a, body: { ask: true } });
    expect(first.status).toBe(200);
    expect(first.body.speed).toEqual({ rate: 1, asks: { p1: true, p2: false }, house: { p1: false, p2: false }, waitingOn: "p2" });
    const second = await call("PUT", path, { token: b, body: { ask: true } });
    expect(second.body.speed).toMatchObject({ rate: 2, waitingOn: null });
    const view = await call("GET", `/api/live/${pvp!.matchId}`, { token: c });
    expect(view.body.speed).toEqual(second.body.speed);
    expect(view.body.nextAt).toBe(second.body.nextAt);
    const list = await call("GET", "/api/live", { token: c });
    expect(list.body.matches.find((m: { matchId: string }) => m.matchId === pvp!.matchId).speed.rate).toBe(2);
    // Against the house, one ask is enough.
    expect((await call("PUT", `/api/live/${withHouse.matchId}/speed`, { token: c, body: { ask: true } })).body.speed.rate).toBe(2);

    // Ended: the same 404 the feed gives, pointing at the record.
    await runOut(ctx, 1000);
    while (ctx.live.liveMatches().some((m) => m.matchId === pvp!.matchId)) {
      ctx.clock.t += 1000;
      await ctx.live.tick();
    }
    const ended = await call("PUT", path, { token: a, body: { ask: false } });
    expect(ended.status).toBe(404);
    expect(ended.body.error).toMatch(/has ended; see \/api\/matches\//);

    // The setting, over PATCH /api/account/settings.
    const set = await call("PATCH", "/api/account/settings", { token: a, body: { ask2xEveryMatch: true } });
    expect(set.body.ask2xEveryMatch).toBe(true);
    expect((await call("PATCH", "/api/account/settings", { token: a, body: { ask2xEveryMatch: "on" } })).status).toBe(400);
    await ctx.live.stop();
  });
});
