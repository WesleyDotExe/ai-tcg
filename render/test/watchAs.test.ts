// The spectator point of view (render session 52, owner 2026-11-02): the
// "Watch as" switch on the website's live views and on the arena. Read from
// the real owner API with the game lane's long-lived ladder playing, as in
// siteMatches.test.ts, with a third account that only watches.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { LiveLadder } from "../../server/src/ladder/liveLadder.js";
import { siteApi, type SiteLiveMatch } from "../src/site/siteApi.js";
import { compactBoard, liveLineHtml, nearSeat, scoreboardHtml, scoreboardOf, watchAsHtml } from "../src/site/siteMatches.js";
import { widgetHtml, type WidgetData } from "../src/site/siteWidgets.js";
import { siteScript } from "../src/site/sitePage.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import { captureReplay } from "../src/replaySetup.js";

const PW = "a long test password";
const running: { close(): Promise<void> }[] = [];
afterEach(async () => {
  while (running.length) await running.pop()!.close();
});

/** Two players on the ladder (one rated higher, so defaultView is theirs)
 * and a spectator who owns neither agent. */
async function stack() {
  const clock = { t: Date.parse("2026-11-02T00:00:00.000Z") };
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const players = [
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
  const watcher = store.createAccount({ name: "Cleo", username: "cleo", password: PW });
  const dir = mkdtempSync(join(tmpdir(), "watch-as-"));
  let n = 0;
  const live = new LiveLadder({ store, seed: 77, build: { games: 0 }, matchId: () => `w-${++n}`, logDir: dir, housePacks: false, now: () => clock.t, roundGapMs: 60_000 });
  await live.tick();
  const api: RunningOwnerApi = await startOwnerApi({ store, port: 0, build: { games: 0 }, live, matchFiles: dir });
  running.push({ close: async () => rmSync(dir, { recursive: true, force: true }) });
  running.push(api);
  const client = siteApi((u, i) => fetch(u, i), `http://localhost:${api.port}`);
  const ada = (await client.signIn("ada", PW)).token;
  const cleo = (await client.signIn("cleo", PW)).token;
  for (let i = 0; i < 30; i++) {
    clock.t += 1000;
    await live.tick();
  }
  return { players, watcher, client, ada, cleo };
}

const nearOf = (html: string) => /data-near="(p[12])"/.exec(html)![1];
const pressedOf = (html: string) => [...html.matchAll(/data-seat="(p[12])" aria-pressed="true"/g)].map((m) => m[1]);

describe("the point of view on the website", () => {
  it("nearSeat: the viewer's own seat always; else the choice; else defaultView; else p1", () => {
    expect(nearSeat("p2", "p1", "p1")).toBe("p2");
    expect(nearSeat("p1", "p2", "p2")).toBe("p1");
    expect(nearSeat(null, "p2", "p1")).toBe("p2");
    expect(nearSeat(null, null, "p2")).toBe("p2");
    expect(nearSeat(null, undefined, undefined)).toBe("p1");
    expect(nearSeat(null, "x" as never, "p2")).toBe("p2");
  });

  it("a spectator gets the switch, defaultView near; their choice flips the scoreboard, the board and the line; an owner gets no switch", async () => {
    const { players, watcher, client, ada, cleo } = await stack();
    const l = await client.live(cleo);
    expect(l.matches).toHaveLength(1);
    const m = l.matches[0]!;
    // The server sends defaultView (v20); the website reads it.
    expect(m.defaultView === "p1" || m.defaultView === "p2").toBe(true);
    const other = m.defaultView === "p1" ? "p2" : "p1";

    const sb = scoreboardOf(m, watcher.ownerId);
    expect(sb.mine).toBeNull();
    expect(sb.near).toBe(m.defaultView);
    expect(nearOf(scoreboardHtml(sb))).toBe(m.defaultView);
    expect(/data-seat="(p[12])"/.exec(compactBoard(m, sb.near))![1]).toBe(m.defaultView);
    const sw = watchAsHtml(sb, "wa-live");
    expect(sw).toContain('role="group" aria-label="Watch as"');
    expect(sw).toContain(m.p1.agentName);
    expect(sw).toContain(m.p2.agentName);
    expect(pressedOf(sw)).toEqual([m.defaultView]);
    expect(sw).toContain(`id="wa-live-${m.matchId}-p1"`);

    const chosen = scoreboardOf(m, watcher.ownerId, other);
    expect(chosen.near).toBe(other);
    expect(nearOf(scoreboardHtml(chosen))).toBe(other);
    expect(/data-seat="(p[12])"/.exec(compactBoard(m, chosen.near))![1]).toBe(other);
    expect(pressedOf(watchAsHtml(chosen, "x"))).toEqual([other]);
    expect(liveLineHtml(chosen).indexOf(m[other].agentName)).toBeLessThan(liveLineHtml(chosen).indexOf(m[m.defaultView!].agentName));

    // Ada plays in it: her own side, whatever was chosen, and no switch.
    const adaSeat = m.p1.ownerId === players[0]!.ownerId ? "p1" : "p2";
    const own = scoreboardOf((await client.live(ada)).matches[0]!, players[0]!.ownerId, adaSeat === "p1" ? "p2" : "p1");
    expect(own.near).toBe(adaSeat);
    expect(watchAsHtml(own, "wa-live")).toBe("");
  });

  it("a server from before v20 (no defaultView): p1 near", async () => {
    const { watcher, client, cleo } = await stack();
    const m = { ...(await client.live(cleo)).matches[0]! } as SiteLiveMatch;
    delete m.defaultView;
    expect(scoreboardOf(m, watcher.ownerId).near).toBe("p1");
  });

  it("the Watch live widget: the switch for its first match at M and L, not at S, with the tab's choice", async () => {
    const { watcher, client, cleo } = await stack();
    const l = await client.live(cleo);
    const m = l.matches[0]!;
    const other = m.defaultView === "p1" ? "p2" : "p1";
    const base = { play: { connectedAgent: null } as never, wallet: null, packs: null, collection: null, daily: null, store: null, live: l, history: null, ownerId: watcher.ownerId, errors: {}, now: Date.now(), colFilter: "All" } as WidgetData;
    const at = (size: "S" | "M" | "L", d: WidgetData = base) => widgetHtml({ id: "w1", type: "watch", size } as never, d, { editing: false });
    expect(at("S")).not.toContain("watch-as");
    expect(pressedOf(at("M"))).toEqual([m.defaultView]);
    expect(pressedOf(at("L"))).toEqual([m.defaultView]);
    const chose = { ...base, viewOf: (id: string) => (id === m.matchId ? other : null) } as WidgetData;
    expect(pressedOf(at("M", chose))).toEqual([other]);
    expect(nearOf(at("M", chose))).toBe(other);
  });

  it("the site script keeps the choice per match for the tab only, and hands the arena its view in the hash", () => {
    const js = siteScript();
    expect(js).toContain("ai-tcg.watchAs");
    expect(js).toContain("sessionStorage");
    expect(js).not.toMatch(/localStorage\.setItem\([^)]*watchAs/);
    expect(js).toContain("#view=");
    expect(js).toContain("&switch=");
    expect(js).toContain("ai-tcg-view");
  });
});

describe("the point of view on the arena", () => {
  it("the page carries the switch, reads the hash, and moves only places (the rows keep their ids)", async () => {
    const { replay } = await captureReplay("Cortex", "Swarm", 6, false);
    const html = renderMatchHtml(replay);
    expect(html).toContain('<div class="pov" id="pov" role="group" aria-label="Watch as" hidden>');
    expect(html).toContain('id="pov-p1"');
    expect(html).toContain('id="pov-p2"');
    // Every row, HUD and hand keeps its player's id; placeSides moves them.
    for (const id of ["side-p1", "side-p2", "board-p1", "board-p2", "hud-p1", "hud-p2", "hand-p1", "hand-p2"]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("function placeSides()");
    expect(html).toContain("viewHash['switch'] !== '0'");
    // Nothing still assumes p1 sits at the bottom where it matters.
    expect(html).not.toContain("document.getElementById('board-p1').getBoundingClientRect()");
    expect(html).not.toContain("top: document.getElementById('side-p2'), bot: document.getElementById('side-p1')");
    expect(html).toContain("body.pov-p2 .board-row#board-p2 .card.fx-attack { animation-name: fx-lunge-up; }");
    // A live page carries the same switch.
    expect(renderMatchHtml(replay, { live: true })).toContain('id="pov"');
  });
});
