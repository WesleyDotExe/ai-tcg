// The match pages (render session 50): match history, the live scoreboard,
// the auto-play switch and the full arena replay of a recorded match, read
// from the real owner API with the game lane's long-lived ladder playing
// real matches on a clock the test moves.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { LiveLadder } from "../../server/src/ladder/liveLadder.js";
import type { ReplayFile } from "../../server/src/ladder/ladderRunner.js";
import { SiteApiError, siteApi, type SiteAutoPlay, type SiteHistoryRow, type SiteLiveMatch } from "../src/site/siteApi.js";
import { startSiteHost, type RunningSiteHost } from "../src/site/siteHost.js";
import {
  RESULT_WORDS,
  autoPlaySwitch,
  autoPlayView,
  compactBoard,
  historyRowHtml,
  historyRowView,
  liveLineHtml,
  myLiveMatch,
  nearFirst,
  recordOf,
  scoreboardHtml,
  scoreboardOf,
  signed,
  tidyLine,
  tidyLines,
  whenText,
} from "../src/site/siteMatches.js";
import { replayOfFile } from "../src/site/siteReplay.js";
import { renderSitePage, siteScript } from "../src/site/sitePage.js";
import { widgetHtml, type WidgetData } from "../src/site/siteWidgets.js";
import type { MatchReplay } from "../src/types.js";

const PW = "a long test password";
const running: (RunningOwnerApi | RunningSiteHost | { close(): Promise<void> })[] = [];
afterEach(async () => {
  while (running.length) await running.pop()!.close();
});

/** Two player owners (their starter decks forced, so no rebuild runs), both
 * on auto-play; the long-lived ladder on a clock the test moves; the owner
 * API with Watch live and match history; the site host in front. */
async function stack() {
  const clock = { t: Date.parse("2026-11-02T00:00:00.000Z") };
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const owners = [
    { name: "Ada", login: "ada", agent: "Lattice Wren", faction: "Swarm" as const },
    { name: "Boris", login: "boris", agent: "Mote Engine", faction: "Aegis" as const },
  ].map((c) => {
    const o = store.createAccount({ name: c.name, username: c.login, password: PW });
    const { copies } = store.grantStarterCollection(o.ownerId, c.faction);
    const a = store.createAgent({ ownerId: o.ownerId, name: c.agent });
    const d = store.saveDeck(o.ownerId, `${c.faction} starter`, copies.map((x) => x.copyId));
    store.setActiveDeck(o.ownerId, d.deckId);
    store.connectAgent(o.ownerId, a.agentId);
    store.setAutoPlay(o.ownerId, true);
    return { ...o, agent: a };
  });
  // A match recorded with no match played (no log, no replay).
  store.recordMatch({ matchId: "bare-1", seed: 1, p1AgentId: owners[0]!.agent.agentId, p2AgentId: owners[1]!.agent.agentId, outcome: { kind: "win", winnerAgentId: owners[0]!.agent.agentId }, endedAt: "2026-11-01T20:00:00.000Z" });
  const dir = mkdtempSync(join(tmpdir(), "site-matches-"));
  let n = 0;
  const live = new LiveLadder({ store, seed: 77, build: { games: 0 }, matchId: () => `t-${++n}`, logDir: dir, housePacks: false, now: () => clock.t, roundGapMs: 60_000 });
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
  /** Moves the clock until the match on show is recorded. */
  const playOut = async () => {
    for (let i = 0; i < 2000 && live.showing().length > 0; i++) {
      clock.t += 1000;
      await live.tick();
    }
  };
  return { store, owners, live, clock, client, ada, boris, base, dir, playOut };
}

const AUTO: SiteAutoPlay = { on: false, changedAt: null, stopped: null, dailyRewardsMaxed: false, canTurnOn: true, house: false };

describe("the match pages' words (pure)", () => {
  it("every result reads in words, with its letter and tone", () => {
    const row = (result: SiteHistoryRow["result"], over: Partial<SiteHistoryRow> = {}): SiteHistoryRow => ({
      matchId: "m", endedAt: "2026-11-02T09:00:00.000Z", seat: "p1", result, credits: 0, rating: null, opponent: { ownerId: "o", ownerName: "Bo <b>", agentName: "Foe" }, agentName: "Me", turns: 12, hasLog: true, hasReplay: true, ...over,
    });
    for (const r of Object.keys(RESULT_WORDS) as SiteHistoryRow["result"][]) {
      const v = historyRowView(row(r), Date.parse("2026-11-02T09:05:00.000Z"));
      expect(v.word).toBe(RESULT_WORDS[r].word);
      expect(v.versus).toBe("vs Foe (Bo <b>)");
      expect(v.when).toBe("5 min ago");
    }
    const win = historyRowView(row("win", { credits: 30, rating: { before: 1500.4, after: 1523.6, change: 23.2 } }), 0);
    expect([win.credits, win.rating, win.ratingTone, win.turns]).toEqual(["+30 credits", "+24 rating", "up", "12 turns"]);
    const loss = historyRowView(row("loss", { credits: 2, rating: { before: 1500, after: 1491.2, change: -8.8 } }), 0);
    expect([loss.rating, loss.ratingTone]).toEqual(["−9 rating", "down"]);
    const cancel = historyRowView(row("cancelled", { hasReplay: false, hasLog: false, turns: null }), 0);
    expect([cancel.credits, cancel.rating, cancel.ratingTone, cancel.turns, cancel.canReplay, cancel.noReplay]).toEqual(["No credits", "Not rated", "none", null, false, "No replay: the match never started"]);
    expect(historyRowView(row("abandonedByOpponent", { hasReplay: false }), 0).noReplay).toBe("No replay: the match didn't resolve");
    // Escaped in the HTML; the Replay button only when there is one; Log only when there is one.
    const h = historyRowHtml(historyRowView(row("win"), 0));
    expect(h).toContain("Bo &lt;b&gt;");
    expect(h).toContain('data-act="replay" data-match="m"');
    expect(h).toContain('data-act="match-log"');
    expect(historyRowHtml(cancel)).not.toContain('data-act="replay"');
    expect(historyRowHtml(cancel)).not.toContain('data-act="match-log"');
    expect(historyRowHtml(historyRowView(row("win"), 0), { compact: true })).not.toContain('data-act="match-log"');
  });
  it("signs, times and records", () => {
    expect([signed(4.4), signed(-0.4), signed(-12.6)]).toEqual(["+4", "0", "−13"]);
    const now = Date.parse("2026-11-02T09:00:00.000Z");
    expect(whenText("2026-11-02T08:59:30.000Z", now)).toBe("just now");
    expect(whenText("2026-11-02T06:30:00.000Z", now)).toBe("2 h ago");
    expect(whenText("2026-10-20T10:00:00.000Z", now)).toMatch(/^20 Oct, \d\d:\d\d$/);
    expect(whenText("not a date", now)).toBe("not a date");
    const rows = (["win", "loss", "draw", "cancelled", "abandonedByYou", "abandonedByOpponent"] as const).map((result) => ({ result }) as SiteHistoryRow);
    expect(recordOf(rows)).toMatchObject({ wins: 2, losses: 2, draws: 1, line: "2W 2L 1D" });
  });
  it("the auto-play switch: on, off, maxed (the server's message), a house owner, no agent", () => {
    expect(autoPlayView({ ...AUTO, on: true }, true)).toMatchObject({ shown: true, on: true, enabled: true, stopped: null });
    expect(autoPlayView(AUTO, true)).toMatchObject({ on: false, enabled: true, note: "Off: your agent sits out the ladder rounds." });
    const maxed = autoPlayView({ ...AUTO, canTurnOn: false, dailyRewardsMaxed: true, stopped: { reason: "dailyRewardsMaxed", day: "2026-11-02" } }, true);
    expect(maxed.enabled).toBe(false);
    expect(maxed.stopped).toContain("today's rewards are maxed");
    expect(autoPlayView({ ...AUTO, house: true }, true).shown).toBe(false);
    expect(autoPlayView(AUTO, false)).toMatchObject({ enabled: false, note: "Connect an agent to play matches." });
    const sw = autoPlaySwitch(autoPlayView({ ...AUTO, on: true }, true), "ap");
    expect(sw).toContain('role="switch" aria-checked="true" data-act="auto-play" data-on="0"');
    expect(autoPlaySwitch(maxed, "ap")).toContain("disabled");
    expect(autoPlaySwitch(autoPlayView(AUTO, true), "ap", true)).toContain("disabled");
    expect(autoPlaySwitch(autoPlayView({ ...AUTO, house: true }, true), "ap")).toContain("Always plays");
  });
  it("tidies the released log lines: names for seats, no ids, no bookkeeping", () => {
    const names = { p1: "Lattice Wren", p2: "Mote Engine" };
    expect(tidyLine("  p2 passes priority", names)).toBeNull();
    expect(tidyLine("[end of turn 4 for p2]", names)).toBeNull();
    expect(tidyLine("--- Turn 5 (p1) ---", names)).toBe("Turn 5 · Lattice Wren");
    expect(tidyLine("p1 plays Propagating Exploit (u5)", names)).toBe("Lattice Wren plays Propagating Exploit");
    expect(tidyLine("p2 casts Reflex Spike [Instant] (goes on the stack)", names)).toBe("Mote Engine casts Reflex Spike");
    expect(tidyLine(">>> resolving: Glitch Seed's attack", names)).toBe("Glitch Seed's attack resolves");
    expect(tidyLine("  Glitch Seed deals 2 damage to Aegis Cadet (unit)", names)).toBe("Glitch Seed deals 2 damage to Aegis Cadet");
    expect(tidyLine("  Aegis Cadet (p2) dies", names)).toBe("Aegis Cadet dies");
    expect(tidyLine("  ability: Deadlock Detector — deadlock-detector-play (onPlay)", names)).toBe("Deadlock Detector's ability triggers");
    expect(tidyLine("=== GAME OVER: p1 wins (p2's health reached 0) ===", names)).toBe("Game over: Lattice Wren wins (Mote Engine's health reached 0)");
    expect(tidyLines(["p1 draws X", "  p1 passes priority", "p2 draws Y"], names)).toEqual(["Lattice Wren draws X", "Mote Engine draws Y"]);
  });
});

describe("the match pages over the real owner API, with the ladder playing", () => {
  it("Watch live: every live match, its scoreboard the server's board now, the viewer's side first", async () => {
    const { client, ada, boris, owners, clock, live } = await stack();
    for (let i = 0; i < 30; i++) {
      clock.t += 1000;
      await live.tick();
    }
    const l = await client.live(ada);
    expect(l.running).toBe(true);
    expect(l.matches).toHaveLength(1);
    const m = l.matches[0]!;
    expect(myLiveMatch(l)).toBe(m);
    const seatOfAda = m.p1.ownerId === owners[0]!.ownerId ? "p1" : "p2";
    const sb = scoreboardOf(m, owners[0]!.ownerId);
    expect(sb.mine).toBe(seatOfAda);
    for (const seat of ["p1", "p2"] as const) {
      expect(sb[seat].health).toBe(Math.max(0, m.now[seat].health));
      expect(sb[seat].hand).toBe(m.now[seat].hand);
      expect(sb[seat].units).toBe(m.now[seat].board.length);
      expect(sb[seat].energy).toBe(`${m.now[seat].energy}/${m.now[seat].maxEnergy}`);
      expect(sb[seat].agentName).toBe(m[seat].agentName);
    }
    expect(sb.status).toBe(`Turn ${m.now.turn} · ${m[m.now.activePlayer].agentName} to play`);
    // Ada sees her agent first; Boris sees his; the board follows.
    const first = (html: string) => /data-near="(p[12])"/.exec(html)![1];
    expect(first(scoreboardHtml(sb))).toBe(seatOfAda);
    expect(first(scoreboardHtml(scoreboardOf(m, owners[1]!.ownerId)))).toBe(seatOfAda === "p1" ? "p2" : "p1");
    expect(nearFirst(null)).toEqual(["p1", "p2"]);
    expect(/data-seat="(p[12])"/.exec(compactBoard(m, sb.mine))![1]).toBe(seatOfAda);
    expect(liveLineHtml(sb)).toContain(m[seatOfAda].agentName);
    // A spectator (no seat) sees the same list.
    expect((await client.live(boris)).matches.map((x) => x.matchId)).toEqual([m.matchId]);
  });

  it("the play-by-play from the feed, a read at a time, adds up to the match log; then the history row and the full replay", async () => {
    const { client, ada, clock, live, playOut, base, dir } = await stack();
    let m: SiteLiveMatch | undefined;
    const raw: string[] = [];
    let next = 0;
    let started = false;
    let names = { p1: "", p2: "" };
    for (let i = 0; i < 3000; i++) {
      clock.t += 1000;
      await live.tick();
      const l = await client.live(ada);
      if (!l.matches.length) break;
      m = l.matches[0]!;
      const feed = await client.liveFeed(ada, m.matchId, next);
      names = { p1: feed.p1.agentName, p2: feed.p2.agentName };
      // The opening lines come with every read from 0 until a move is out: taken once.
      if (feed.from === 0 && !started) {
        raw.push(...(feed.startLines ?? []));
        started = true;
      }
      raw.push(...feed.steps.flatMap((s) => s.lines));
      next = feed.from + feed.steps.length;
      expect(next).toBe(feed.released);
    }
    await playOut();
    expect(m).toBeDefined();
    const log = await client.matchLog(ada, m!.matchId);
    // Every line released is in the log, in order (the log adds a header).
    const logLines = log.split("\n");
    let at = 0;
    for (const line of raw) {
      at = logLines.indexOf(line, at);
      expect(at, line).toBeGreaterThanOrEqual(0);
      at++;
    }
    const pbp = tidyLines(raw, names);
    expect(pbp.some((x) => /^Game over: /.test(x))).toBe(true);
    expect(pbp.join("\n")).not.toMatch(/\bp[12]\b|passes priority|\(u\d+\)/);

    // The history: the ladder's match first, then the bare record (no files).
    const h = await client.matches(ada, 20);
    expect(h.matches.map((r) => r.matchId)).toEqual([m!.matchId, "bare-1"]);
    const row = h.matches[0]!;
    const view = historyRowView(row, clock.t);
    expect(view.canReplay && view.canLog).toBe(true);
    expect(historyRowView(h.matches[1]!, clock.t).canReplay).toBe(false);
    expect(view.credits).toBe(row.credits > 0 ? `+${row.credits} credits` : "No credits");

    // The replay page: built by the host from the server's file, with Ada's token.
    const rp = await client.replayPage(ada, m!.matchId);
    expect(rp.url).toMatch(/^\/replay\/[A-Za-z0-9_-]{24}$/);
    const page = await fetch(base + rp.url);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
    const html = await page.text();
    const data = JSON.parse(/<script type="application\/json" id="match-data">([\s\S]*?)<\/script>/.exec(html)![1]!.replace(/\\u003c/g, "<")) as MatchReplay;
    // The same match: every move, every event line the feed released, the same end.
    const file = JSON.parse(readFileSync(join(dir, `${m!.matchId}.replay.json`), "utf8")) as ReplayFile;
    expect(data.movesPlayed).toBe(file.moves.length);
    expect(data.frames).toHaveLength(file.moves.length + 1);
    expect(data.frames.flatMap((f) => f.newEvents.map((e) => e.text))).toEqual(raw);
    const last = data.frames[data.frames.length - 1]!;
    expect(last.winner).toBe(file.result.winner);
    expect(data.agentNames).toEqual(file.names);
    const rec = await client.match(ada, m!.matchId);
    expect(data.record?.matchId).toBe(m!.matchId);
    expect(data.record?.boast?.itemId ?? null).toBe(rec.boast?.itemId ?? null);
    expect(rp.moves).toBe(file.moves.length);
    // Boris (the other side) may open it too: any signed-in owner opens any recorded match.
    expect((await client.replayPage(ada, m!.matchId)).url).not.toBe(rp.url);
  });

  it("refusals: no token, no such match, no replay file, a file this engine can't rebuild, an unknown or expired page, wrong methods", async () => {
    const { client, ada, playOut, base, dir, live, clock } = await stack();
    clock.t += 1000;
    await live.tick();
    const id = live.showing()[0]!.matchId;
    await playOut();
    const post = (path: string, token?: string) => fetch(base + path, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    expect((await post(`/replay-page/${id}`)).status).toBe(401);
    const missing = await client.replayPage(ada, "no-such-match").catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(SiteApiError);
    expect((missing as SiteApiError).status).toBe(404);
    const bare = await client.replayPage(ada, "bare-1").catch((e: unknown) => e);
    expect((bare as SiteApiError).status).toBe(404);
    // A replay file whose moves aren't this match's: 422 with the reason, never another match.
    const path = join(dir, `${id}.replay.json`);
    const file = JSON.parse(readFileSync(path, "utf8")) as ReplayFile;
    writeFileSync(path, JSON.stringify({ ...file, seed: file.seed + 1 }));
    const bad = await client.replayPage(ada, id).catch((e: unknown) => e);
    expect((bad as SiteApiError).status).toBe(422);
    expect((bad as SiteApiError).message).toMatch(/^this replay can't be rebuilt: /);
    writeFileSync(path, JSON.stringify({ ...file, moves: file.moves.slice(0, -3) }));
    expect(((await client.replayPage(ada, id).catch((e: unknown) => e)) as SiteApiError).status).toBe(422);
    writeFileSync(path, JSON.stringify(file));
    expect((await client.replayPage(ada, id)).moves).toBe(file.moves.length);
    expect((await fetch(`${base}/replay/${"x".repeat(24)}`)).status).toBe(404);
    expect((await fetch(`${base}/replay-page/${id}`)).status).toBe(405);
    expect((await fetch(`${base}/replay/${"x".repeat(24)}`, { method: "POST" })).status).toBe(405);
    expect((await fetch(`${base}/replay/short`)).status).toBe(404);
  });

  it("replayOfFile refuses a record that isn't the file's match", async () => {
    const { client, ada, playOut, dir, live, clock } = await stack();
    clock.t += 1000;
    await live.tick();
    const id = live.showing()[0]!.matchId;
    await playOut();
    const file = JSON.parse(readFileSync(join(dir, `${id}.replay.json`), "utf8")) as ReplayFile;
    const view = await client.match(ada, id);
    await expect(replayOfFile({ ...file, matchId: "other" }, view)).rejects.toThrow(/is match "other"/);
    await expect(replayOfFile({ ...file, format: "ai-tcg-replay/9" as never }, view)).rejects.toThrow(/format/);
    const flipped = view.outcome === "win" ? { ...view, winnerOwnerId: view.winnerOwnerId === view.p1.ownerId ? view.p2.ownerId : view.p1.ownerId } : { ...view, outcome: "cancelled" as const };
    await expect(replayOfFile(file, flipped)).rejects.toThrow(/the record says/);
    const r = await replayOfFile(file, view);
    expect(r.frames.length).toBe(file.moves.length + 1);
  });

  it("auto-play: the switch's answer is the server's; the widgets draw the real answers at every size", async () => {
    const { client, ada, owners, clock, live } = await stack();
    const off = await client.setAutoPlay(ada, false);
    expect(off.autoPlay.on).toBe(false);
    expect((await client.play(ada)).autoPlay).toEqual(off.autoPlay);
    expect(autoPlayView(off.autoPlay, true).note).toMatch(/^Off/);
    const on = await client.setAutoPlay(ada, true);
    expect(on.autoPlay.on).toBe(true);
    for (let i = 0; i < 20; i++) {
      clock.t += 1000;
      await live.tick();
    }
    const [play, l, h] = await Promise.all([client.play(ada), client.live(ada), client.matches(ada, 20)]);
    const data: WidgetData = { play, wallet: null, packs: null, collection: null, daily: null, store: null, live: l, history: h, ownerId: owners[0]!.ownerId, errors: {}, now: clock.t, colFilter: "All" };
    for (const type of ["live", "watch", "history", "agent"] as const) {
      for (const size of ["S", "M", "L"] as const) {
        const html = widgetHtml({ id: "w", type, size }, data, { editing: false, live: "board" });
        expect(html, `${type} ${size}`).not.toMatch(/undefined|NaN|\[object|>null</);
        if (type === "watch") expect(html).toContain(l.matches[0]!.p1.agentName.replace(/'/g, "&#39;"));
        // Render session 57: Agent controls' Start / Stop is the auto-play switch (on: Stop).
        if (type === "live") expect(html).toContain('data-act="auto-play" data-on="0"');
      }
    }
    expect(widgetHtml({ id: "w", type: "history", size: "S" }, data, { editing: false })).toContain("Win");
    // Nothing live: Agent controls says the agent joins the next round; with a match live, "Go to match".
    const none = { ...data, play: { ...play, liveMatch: null }, live: { running: true, matches: [], mine: null } };
    expect(widgetHtml({ id: "w", type: "live", size: "M" }, none, { editing: false })).toContain("No match live: joins the next ladder round");
    expect(widgetHtml({ id: "w", type: "live", size: "M" }, { ...none, play }, { editing: false })).toContain(play.liveMatch ? "Go to match" : "No match live");
    expect(widgetHtml({ id: "w", type: "watch", size: "M" }, { ...none, live: { running: false, matches: [], mine: null } }, { editing: false })).toContain("The ladder isn't running");
  });
});

describe("the page", () => {
  it("has the replay layer and the match pages in its bundle", () => {
    const page = renderSitePage();
    expect(page).toContain('<div id="replay" class="opening" hidden role="dialog" aria-modal="true" aria-label="Match replay"></div>');
    const js = siteScript();
    for (const s of ["/replay-page/", "/api/live", "/api/matches", "/api/play/auto-play"]) expect(js).toContain(s);
  });
});
