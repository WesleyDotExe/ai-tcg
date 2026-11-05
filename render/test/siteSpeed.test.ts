// Render session 56: the live arena slice. The 2× vote's controls (the
// owner's 2026-11-04 order: "Ask for 2×" and taking it back on the owner's
// own live match, who asks and who is waited on from `LiveMatchView.speed`,
// the arena at the agreed rate, Settings -> Play "Ask for 2× in every
// match"), and the live boast before the result (the live view's `boast`
// once the last move is out, game session 72), over the real owner API with
// the game lane's long-lived ladder on a clock the test moves.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { LiveLadder } from "../../server/src/ladder/liveLadder.js";
import { SiteApiError, siteApi, type SiteLiveMatch, type SiteSpeed } from "../src/site/siteApi.js";
import { startSiteHost, type RunningSiteHost } from "../src/site/siteHost.js";
import { speedControlHtml, speedControlView } from "../src/site/siteMatches.js";
import { liveRecordOf } from "../src/site/siteReplay.js";
import { siteScript } from "../src/site/sitePage.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import type { Frame, MatchReplay } from "../src/types.js";

const PW = "a long test password";
const running: (RunningOwnerApi | RunningSiteHost | { close(): Promise<void> })[] = [];
afterEach(async () => {
  while (running.length) await running.pop()!.close();
});

async function stack() {
  const clock = { t: Date.parse("2026-11-05T00:00:00.000Z") };
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
  const dir = mkdtempSync(join(tmpdir(), "site-speed-"));
  let n = 0;
  const live = new LiveLadder({ store, seed: 91, build: { games: 0 }, matchId: () => `s-${++n}`, logDir: dir, housePacks: false, now: () => clock.t, roundGapMs: 60_000 });
  await live.tick();
  const api = await startOwnerApi({ store, port: 0, build: { games: 0 }, live, matchFiles: dir });
  running.push({ close: async () => rmSync(dir, { recursive: true, force: true }) });
  running.push(api);
  const host = await startSiteHost({ api: `http://localhost:${api.port}`, port: 0 });
  running.push(host);
  const base = `http://127.0.0.1:${host.port}`;
  const client = siteApi((u, i) => fetch(u, i), base);
  const ada = (await client.signIn("ada", PW)).token;
  const boris = (await client.signIn("boris", PW)).token;
  const tick = async (ms: number) => {
    for (let k = 0; k < ms / 1000; k++) {
      clock.t += 1000;
      await live.tick();
    }
  };
  return { client, ada, boris, live, base, tick };
}

const dataOf = (html: string) => JSON.parse(/<script type="application\/json" id="match-data">([\s\S]*?)<\/script>/.exec(html)![1]!.replace(/\\u003c/g, "<")) as MatchReplay;

/** A live match as the site reads it, with a given vote. */
function matchWith(speed: SiteSpeed, over: Partial<SiteLiveMatch> = {}): SiteLiveMatch {
  const side = (ownerId: string, ownerName: string) => ({ ownerId, ownerName, agentId: `a-${ownerId}`, agentName: `${ownerName}'s agent`, playStyle: "balanced", rating: 1200, tier: "Silver" });
  const pub = { name: "x", health: 24, maxHealth: 24, energy: 1, maxEnergy: 1, hand: 5, deck: 30, graveyard: 0, board: [], directives: [], signature: null };
  return { matchId: "m1", startedAt: "", released: 4, nextAt: "2026-11-05T00:00:09.000Z", p1: side("o-ada", "Ada"), p2: side("o-bo", "Boris"), now: { turn: 2, activePlayer: "p1", priority: "p1", stack: 0, winner: null, p1: pub, p2: pub }, recentLines: [], speed, ...over };
}
const sp = (o: Partial<SiteSpeed>): SiteSpeed => ({ rate: 1, asks: { p1: false, p2: false }, house: { p1: false, p2: false }, waitingOn: null, ...o });

describe("the 2× control's words (siteMatches.ts speedControlView), every state the server can send", () => {
  it("nobody asks: Ask for 2×, and it says the other owner must agree", () => {
    const v = speedControlView(matchWith(sp({})), "o-ada")!;
    expect(v).toMatchObject({ canVote: true, rate: 1, button: { label: "Ask for 2×", ask: true }, pill: null });
    expect(v.line).toBe("2× needs you and Boris to agree.");
  });
  it("I asked, the other hasn't: Take back, waiting on them by name", () => {
    const v = speedControlView(matchWith(sp({ asks: { p1: true, p2: false }, waitingOn: "p2" })), "o-ada")!;
    expect(v).toMatchObject({ rate: 1, button: { label: "Take back", ask: false }, line: "You asked for 2×. Waiting on Boris." });
  });
  it("the other asked: Agree to 2× for the owner being waited on", () => {
    const v = speedControlView(matchWith(sp({ asks: { p1: true, p2: false }, waitingOn: "p2" })), "o-bo")!;
    expect(v).toMatchObject({ rate: 1, button: { label: "Agree to 2×", ask: true }, line: "Ada asks for 2×. It starts when you agree." });
  });
  it("both agreed: playing at 2×, Back to 1×; a spectator sees a 2× pill and no button", () => {
    const m = matchWith(sp({ rate: 2, asks: { p1: true, p2: true } }));
    expect(speedControlView(m, "o-ada")).toMatchObject({ rate: 2, button: { label: "Back to 1×", ask: false }, line: "Playing at 2×: you and Boris agreed.", pill: "2×" });
    expect(speedControlView(m, "o-someone-else")).toMatchObject({ canVote: false, button: null, pill: "2×", line: "2×: both owners agreed" });
    expect(speedControlView(m, null)).toMatchObject({ canVote: false, button: null, pill: "2×" });
  });
  it("against the house: one ask is enough, and it says so", () => {
    const m = matchWith(sp({ house: { p1: false, p2: true } }));
    expect(speedControlView(m, "o-ada")!.line).toBe("Against the house, your ask alone makes it 2×.");
    const fast = matchWith(sp({ rate: 2, asks: { p1: true, p2: false }, house: { p1: false, p2: true } }));
    expect(speedControlView(fast, "o-ada")).toMatchObject({ line: "Playing at 2×: the house agrees to what you ask.", button: { label: "Back to 1×" } });
  });
  it("once the last move is out (the result holds) nobody votes and no pill shows", () => {
    const m = matchWith(sp({ rate: 2, asks: { p1: true, p2: true } }), { nextAt: null });
    expect(speedControlView(m, "o-ada")).toMatchObject({ canVote: false, button: null, pill: null, line: "" });
    expect(speedControlHtml(speedControlView(m, "o-ada"), "x", "m1")).toBe("");
  });
  it("a server without the vote (before game session 73): no control at all", () => {
    expect(speedControlView(matchWith(undefined as unknown as SiteSpeed), "o-ada")).toBeNull();
  });
  it("the HTML: a status line and one button carrying what it sends; escaped names", () => {
    const html = speedControlHtml(speedControlView(matchWith(sp({}), { p2: { ...matchWith(sp({})).p2, ownerName: "<b>Bo</b>" } }), "o-ada"), "m-speed", "m1");
    expect(html).toContain('role="status"');
    expect(html).toContain('id="m-speed" data-act="live-speed" data-match="m1" data-ask="1"');
    expect(html).toContain("&lt;b&gt;Bo&lt;/b&gt;");
    expect(html).not.toContain("<b>Bo</b>");
  });
  it("the site's script wires the button, the arena's control and the Settings switch", () => {
    const script = siteScript();
    for (const s of ['data-act="live-speed"', "rp-speed", "ask-2x-every", " in every match"]) expect(script, s).toContain(s);
  });
});

describe("the arena at the agreed rate (renderHtml.ts live mode)", () => {
  it("the page starts at the rate the host read; 1 for a replay page", () => {
    const replay = { title: "t", seed: 1, agentNames: { p1: "A", p2: "B" }, identities: { p1: { username: "A", avatarSvg: "" }, p2: { username: "B", avatarSvg: "" } }, cardFactions: {}, cardRarities: {}, factions: { p1: "Cortex", p2: "Swarm" }, movesPlayed: 0, turnCap: 30, energyCap: 10, frames: [] } as unknown as MatchReplay;
    expect(renderMatchHtml(replay, { live: true, rate: 2 })).toContain('<script type="application/json" id="live-rate">2</script>');
    expect(renderMatchHtml(replay, { live: true })).toContain('<script type="application/json" id="live-rate">1</script>');
    expect(renderMatchHtml(replay, { rate: 2 })).toContain('<script type="application/json" id="live-rate">1</script>');
    const page = renderMatchHtml(replay, { live: true, rate: 2 });
    // Following live at 2× halves the step; the badge says so.
    expect(page).toContain("liveRate === 2) delay = Math.round(delay / 2)");
    expect(page).toContain("if (d.rate === 1 || d.rate === 2) liveRate = d.rate;");
  });
});

describe("liveRecordOf (the live view's boast as the arena's record)", () => {
  const frame = (winner?: "p1" | "p2" | "draw") => ({ players: { p1: { health: 7 }, p2: { health: 0 } }, ...(winner ? { winner } : {}) }) as unknown as Frame;
  const replay = (n: number, winner?: "p1" | "p2" | "draw") => ({ frames: [...Array.from({ length: n }, () => frame()), frame(winner)] }) as unknown as MatchReplay;
  const view = { matchId: "m", released: 3, nextAt: null as string | null, p1: { agentId: "a1" }, p2: { agentId: "a2" }, boast: { agentId: "a1", itemId: "boast-x", slot: "boast" as const, winnerHealth: 7 } };
  it("once the last move is out: the boast on the winner's seat", () => {
    expect(liveRecordOf(replay(3, "p1"), view)).toEqual({ matchId: "m", loadouts: null, boast: { side: "p1", itemId: "boast-x", slot: "boast", winnerHealth: 7 } });
  });
  it("not before: moves still to come, the board short of released, no winner on the board, an older server", () => {
    expect(liveRecordOf(replay(3, "p1"), { ...view, nextAt: "2026-11-05T00:00:00Z" })).toBeNull();
    expect(liveRecordOf(replay(2, "p1"), view)).toBeNull();
    expect(liveRecordOf(replay(3), view)).toBeNull();
    const { boast: _b, ...old } = view;
    expect(liveRecordOf(replay(3, "p1"), old)).toBeNull();
  });
  it("a draw: a record with no boast", () => {
    expect(liveRecordOf(replay(3, "draw"), { ...view, boast: null })).toEqual({ matchId: "m", loadouts: null, boast: null });
  });
  it("never a wrong boast: the loser's, or on other health, throws", () => {
    expect(() => liveRecordOf(replay(3, "p1"), { ...view, boast: { ...view.boast, agentId: "a2" } })).toThrow(/not the winner's/);
    expect(() => liveRecordOf(replay(3, "p1"), { ...view, boast: { ...view.boast, winnerHealth: 9 } })).toThrow(/health/);
  });
});

describe("over the real owner API, with the ladder playing", () => {
  it("the vote from both owners: ask, waiting, agree (2× on the arena's frames), take back; refusals in the server's words", async () => {
    const { client, ada, boris, live, base, tick } = await stack();
    await tick(20_000);
    const id = live.showing()[0]!.matchId;
    const page = await client.livePage(ada, id);
    expect((await client.liveFrames(ada, page.key, page.released + 1)).rate).toBe(1);
    const seen = (await client.live(ada)).matches.find((m) => m.matchId === id)!;
    const adaSeat = seen.p1.ownerName === "Ada" ? "p1" : "p2";
    const boSeat = adaSeat === "p1" ? "p2" : "p1";
    const me = (await client.me(ada)).ownerId, bo = (await client.me(boris)).ownerId;

    // Ada asks: still 1×, waiting on Boris.
    let r = await client.setLiveSpeed(ada, id, true);
    expect(r.speed).toMatchObject({ rate: 1, waitingOn: boSeat });
    let m = (await client.live(ada)).matches.find((x) => x.matchId === id)!;
    expect(speedControlView(m, me)).toMatchObject({ line: "You asked for 2×. Waiting on Boris.", button: { label: "Take back", ask: false } });
    expect(speedControlView(m, bo)).toMatchObject({ line: "Ada asks for 2×. It starts when you agree.", button: { label: "Agree to 2×", ask: true } });

    // Boris agrees: 2×, and the live arena's next read carries the rate.
    r = await client.setLiveSpeed(boris, id, true);
    expect(r.speed.rate).toBe(2);
    await tick(3000);
    const f2 = await client.liveFrames(ada, page.key, page.released + 1);
    expect(f2.rate).toBe(2);
    m = (await client.live(ada)).matches.find((x) => x.matchId === id)!;
    expect(speedControlView(m, me)).toMatchObject({ rate: 2, line: "Playing at 2×: you and Boris agreed.", button: { label: "Back to 1×" } });
    // A page opened now starts at 2×.
    const page2 = await client.livePage(boris, id);
    expect(await (await fetch(base + page2.url)).text()).toContain('<script type="application/json" id="live-rate">2</script>');

    // Ada takes it back: 1× again.
    r = await client.setLiveSpeed(ada, id, false);
    expect(r.speed).toMatchObject({ rate: 1, waitingOn: adaSeat });
    await tick(1000);
    expect((await client.liveFrames(ada, page.key, 0)).rate).toBe(1);

    // Refusals, as the server words them.
    const bad = await client.setLiveSpeed(ada, "no-such-match", true).catch((e: unknown) => e);
    expect(bad).toBeInstanceOf(SiteApiError);
    expect((bad as SiteApiError).status).toBe(404);
  }, 120_000);

  it("Settings -> Play: Ask for 2× in every match is saved to the account and read back", async () => {
    const { client, ada } = await stack();
    expect((await client.accountSettings(ada)).ask2xEveryMatch).toBe(false);
    expect((await client.updateAccountSettings(ada, { ask2xEveryMatch: true })).ask2xEveryMatch).toBe(true);
    expect((await client.accountSettings(ada)).ask2xEveryMatch).toBe(true);
  });

  it("the boast comes with the last move, before the match is recorded (the result's hold), and is the record's", async () => {
    const { client, ada, live, base, tick } = await stack();
    await tick(20_000);
    const id = live.showing()[0]!.matchId;
    const page = await client.livePage(ada, id);
    let have = page.released + 1;
    let atLast: { ended: boolean; record: unknown } | null = null;
    let finalRecord: unknown = null;
    for (let i = 0; i < 600; i++) {
      await tick(3000);
      const r = await client.liveFrames(ada, page.key, have);
      have += r.frames.length;
      const last = (r.frames as Frame[]).at(-1);
      if (last?.winner && !atLast) atLast = { ended: r.ended, record: r.record };
      finalRecord = r.record;
      if (r.ended) break;
    }
    expect(atLast).not.toBeNull();
    // The read that brought the last move: the match isn't recorded yet, and the boast is already there.
    expect(atLast!.ended).toBe(false);
    expect(atLast!.record).not.toBeNull();
    // The same record the replay page shows (the store's), once recorded.
    const rp = await client.replayPage(ada, id);
    const replay = dataOf(await (await fetch(base + rp.url)).text());
    expect(atLast!.record).toEqual(replay.record);
    expect(finalRecord).toEqual(replay.record);
  }, 120_000);
});
