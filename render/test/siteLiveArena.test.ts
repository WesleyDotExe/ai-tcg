// The big live board over the real owner API (render session 51): the site
// host's live arena page and its frames, read while the game lane's
// long-lived ladder releases a real match on a clock the test moves, then
// checked against the full replay the same host rebuilds from the server's
// replay file once the match is recorded.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { LiveLadder } from "../../server/src/ladder/liveLadder.js";
import { SiteApiError, siteApi } from "../src/site/siteApi.js";
import { startSiteHost, type RunningSiteHost } from "../src/site/siteHost.js";
import { renderSitePage, siteScript } from "../src/site/sitePage.js";
import type { Frame, MatchReplay } from "../src/types.js";

const PW = "a long test password";
const running: (RunningOwnerApi | RunningSiteHost | { close(): Promise<void> })[] = [];
afterEach(async () => {
  while (running.length) await running.pop()!.close();
});

async function stack() {
  const clock = { t: Date.parse("2026-11-02T00:00:00.000Z") };
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  for (const c of [
    { name: "Ada", login: "ada", agent: "Lattice Wren", faction: "Swarm" as const },
    { name: "Boris", login: "boris", agent: "Mote Engine", faction: "Aegis" as const },
  ]) {
    const o = store.createAccount({ name: c.name, username: c.login, password: PW });
    const { copies } = store.grantStarterCollection(o.ownerId, c.faction);
    const a = store.createAgent({ ownerId: o.ownerId, name: c.agent });
    const d = store.saveDeck(o.ownerId, `${c.faction} starter`, copies.map((x) => x.copyId));
    store.setActiveDeck(o.ownerId, d.deckId);
    store.connectAgent(o.ownerId, a.agentId);
    store.setAutoPlay(o.ownerId, true);
  }
  const dir = mkdtempSync(join(tmpdir(), "site-live-"));
  let n = 0;
  const live = new LiveLadder({ store, seed: 91, build: { games: 0 }, matchId: () => `l-${++n}`, logDir: dir, housePacks: false, now: () => clock.t, roundGapMs: 60_000 });
  await live.tick();
  const api = await startOwnerApi({ store, port: 0, build: { games: 0 }, live, matchFiles: dir });
  running.push({ close: async () => rmSync(dir, { recursive: true, force: true }) });
  running.push(api);
  const host = await startSiteHost({ api: `http://localhost:${api.port}`, port: 0 });
  running.push(host);
  const base = `http://127.0.0.1:${host.port}`;
  const client = siteApi((u, i) => fetch(u, i), base);
  const ada = (await client.signIn("ada", PW)).token;
  const tick = async (ms: number) => {
    for (let k = 0; k < ms / 1000; k++) {
      clock.t += 1000;
      await live.tick();
    }
  };
  return { client, ada, live, base, tick };
}

const dataOf = (html: string) => JSON.parse(/<script type="application\/json" id="match-data">([\s\S]*?)<\/script>/.exec(html)![1]!.replace(/\\u003c/g, "<")) as MatchReplay;

/** The public parts of a frame: what the live board must agree on with the replay. */
function publicOf(f: Frame) {
  const side = (p: Frame["players"]["p1"]) => ({
    health: p.health, maxHealth: p.maxHealth, energy: p.energy, maxEnergy: p.maxEnergy, hand: p.hand.length, deck: p.deckSize, grave: p.graveyardSize, slots: p.slots,
    board: p.board.filter((u) => !u.isSignature).map(({ flavor: _f, ...u }) => u),
    sig: p.board.filter((u) => u.isSignature).map((u) => [u.instanceId, u.attack, u.health, u.maxHealth, u.pending]),
    directives: p.directives.map((d) => d.instanceId),
  });
  return { turn: f.turnNumber, active: f.activePlayer, priority: f.priority, winner: f.winner ?? null, stack: f.stack, events: f.newEvents.map((e) => e.text), p1: side(f.players.p1), p2: side(f.players.p2) };
}

describe("the live arena over the real owner API, with the ladder playing", () => {
  it("the page starts at the moves released so far, takes the rest a read at a time, ends with the record's boast, and is the replay's match frame for frame", async () => {
    const { client, ada, live, base, tick } = await stack();
    await tick(40_000);
    const id = live.showing()[0]!.matchId;
    const page = await client.livePage(ada, id);
    expect(page.url).toMatch(/^\/live\/[A-Za-z0-9_-]{24}$/);
    const res = await fetch(base + page.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
    const html = await res.text();
    expect(html).toContain('<script type="application/json" id="live-data">true</script>');
    expect(html).toContain('id="btn-live"');
    const start = dataOf(html);
    expect(start.frames).toHaveLength(page.released + 1);
    expect(page.released).toBeGreaterThan(0);
    // Hands are card backs: the count only.
    expect(start.frames.at(-1)!.players.p1.hand.every((c) => c.hidden === true)).toBe(true);

    const frames: Frame[] = [...start.frames];
    let ended = false;
    let record: unknown = null;
    for (let i = 0; i < 400 && !ended; i++) {
      await tick(3000);
      const r = await client.liveFrames(ada, page.key, frames.length);
      // Each answer starts where the page is: never a frame twice, never a gap.
      (r.frames as Frame[]).forEach((f, k) => expect(f.index).toBe(frames.length + k));
      frames.push(...(r.frames as Frame[]));
      expect(r.released).toBe(frames.length - 1);
      ended = r.ended;
      record = r.record;
    }
    expect(ended).toBe(true);
    expect(frames.at(-1)!.winner).toBeDefined();
    // Asking again from an earlier frame answers those frames unchanged (a frame never changes once given).
    const again = await client.liveFrames(ada, page.key, 5);
    expect(JSON.stringify(again.frames)).toBe(JSON.stringify(frames.slice(5)));

    // The recorded match's own replay, rebuilt by the host from the server's file.
    const rp = await client.replayPage(ada, id);
    const replay = dataOf(await (await fetch(base + rp.url)).text());
    expect(frames).toHaveLength(replay.frames.length);
    frames.forEach((f, k) => expect(publicOf(f), `frame ${k}`).toEqual(publicOf(replay.frames[k]!)));
    // The boast the live page plays is the record's, as the replay's is.
    expect(record).toEqual(replay.record);
  }, 120_000);

  it("a match recorded between two reads still ends on the last move: the moves the feed no longer has come from the replay file", async () => {
    const { client, ada, live, base, tick } = await stack();
    await tick(20_000);
    const id = live.showing()[0]!.matchId;
    const page = await client.livePage(ada, id);
    const start = dataOf(await (await fetch(base + page.url)).text());
    // No read until the match is over and recorded (a tab in the background, or a slow poll).
    for (let i = 0; i < 2000 && live.showing().length > 0; i++) await tick(1000);
    const r = await client.liveFrames(ada, page.key, start.frames.length);
    expect(r.ended).toBe(true);
    const frames = [...start.frames, ...(r.frames as Frame[])];
    const rp = await client.replayPage(ada, id);
    const replay = dataOf(await (await fetch(base + rp.url)).text());
    expect(frames).toHaveLength(replay.frames.length);
    expect(frames.at(-1)!.winner).toBe(replay.frames.at(-1)!.winner);
    frames.forEach((f, k) => expect(publicOf(f), `frame ${k}`).toEqual(publicOf(replay.frames[k]!)));
    expect(r.record).toEqual(replay.record);
  }, 120_000);

  it("refusals: a match that isn't live, an unknown key, wrong methods", async () => {
    const { client, ada, base, live, tick } = await stack();
    await tick(5000);
    const nope = await client.livePage(ada, "no-such-match").catch((e: unknown) => e);
    expect(nope).toBeInstanceOf(SiteApiError);
    expect((nope as SiteApiError).status).toBe(404);
    const unknown = await client.liveFrames(ada, "y".repeat(24), 0).catch((e: unknown) => e);
    expect((unknown as SiteApiError).status).toBe(404);
    expect((unknown as SiteApiError).message).toMatch(/expired/);
    expect((await fetch(`${base}/live/${"y".repeat(24)}`)).status).toBe(404);
    expect((await fetch(`${base}/live-page/${live.showing()[0]!.matchId}`)).status).toBe(405);
    expect((await fetch(`${base}/live-frames/${"y".repeat(24)}`, { method: "POST" })).status).toBe(405);
    expect((await fetch(`${base}/live/${"y".repeat(24)}`, { method: "POST" })).status).toBe(405);
  });

  it("Agent match and Watch live offer the arena for each live match", () => {
    const script = siteScript();
    expect(script).toContain('data-act="watch-arena"');
    expect(script).toContain("Watch on the arena");
    expect(renderSitePage()).toContain('id="replay"');
  });
});
