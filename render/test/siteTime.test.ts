// Agent controls' time ring and time buttons on the server's play-time
// allowance (render session 58, on game session 76's allowance; the owner's
// 2026-11-06 Season 0 brief, section 1): the adapter and the buttons' states
// (pure), then the widget over the real owner API with the game lane's ladder
// playing real matches on a clock the test moves: 15 minutes given, the ring
// draining, +15, time up mid-match ("Finishing match"), the match finishing,
// "Done for today", and the new day reading clean.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { LiveLadder } from "../../server/src/ladder/liveLadder.js";
import { siteApi, type SiteAllowance, type SiteAutoPlay, type SitePlay } from "../src/site/siteApi.js";
import { agentControlsHtml, allowanceOf, timeButtonsView, timeRingView, type AgentWidgetData } from "../src/site/siteAgent.js";
import { autoPlayView } from "../src/site/siteMatches.js";

const T0 = Date.parse("2026-11-05T01:00:00.000Z"); // 12:00 Sydney (AEDT)
const AL = (over: Partial<SiteAllowance> = {}): SiteAllowance => ({
  state: "running", startedAt: new Date(T0).toISOString(), endsAt: new Date(T0 + 30 * 60_000).toISOString(), totalMinutes: 30, secondsLeft: 1800, minutesLeft: 30, endsAtReset: false, ...over,
});
const AUTO = (over: Partial<SiteAutoPlay> = {}): SiteAutoPlay => ({ on: true, changedAt: null, stopped: null, dailyRewardsMaxed: false, canTurnOn: true, house: false, allowance: null, canAddTime: false, ...over });

describe("the time ring's allowance and the time buttons (pure)", () => {
  it("allowanceOf counts down from the window's end on the page's clock, never past the server's own count", () => {
    const a = AUTO({ allowance: AL(), canAddTime: true });
    expect(allowanceOf(a, T0)).toEqual({ minutesTotal: 30, minutesLeft: 30, secondsLeft: 1800, endsAtReset: false, state: "running" });
    // 12 min 30 s later, before the next read: 17 min 30 s left, shown as 18.
    const later = allowanceOf(a, T0 + 750_000)!;
    expect(later).toMatchObject({ secondsLeft: 1050, minutesLeft: 18 });
    const ring = timeRingView(later, autoPlayView(a, true), false);
    expect(ring).toMatchObject({ centre: "18", unit: "min", caption: "18 min left today", tone: "run", pct: 58 });
    // The local count reaching zero shows "Finishing match" until the server says more.
    expect(timeRingView(allowanceOf(a, T0 + 31 * 60_000), autoPlayView(a, true), true).centre).toBe("Finishing match");
    // A clock behind the server's never adds time.
    expect(allowanceOf(a, T0 - 600_000)!.secondsLeft).toBe(1800);
    // Under a fifth left: amber.
    expect(timeRingView(allowanceOf(a, T0 + 25 * 60_000), autoPlayView(a, true), false).tone).toBe("low");
    // Finishing and done carry no time.
    expect(allowanceOf(AUTO({ allowance: AL({ state: "finishing", secondsLeft: 0, minutesLeft: 0 }) }), T0)).toMatchObject({ state: "finishing", secondsLeft: 0 });
    expect(allowanceOf(AUTO(), T0)).toBeNull();
    expect(allowanceOf({ ...AUTO(), allowance: undefined }, T0)).toBeNull();
    // A window cut at midnight Sydney says so.
    const late = allowanceOf(AUTO({ allowance: AL({ endsAtReset: true, totalMinutes: 20, secondsLeft: 1200, minutesLeft: 20 }) }), T0)!;
    expect(timeRingView(late, autoPlayView(AUTO(), true), false).caption).toBe("20 min left today · runs to midnight (Sydney)");
  });

  it("the buttons: presets start time, +15 / +30 only on a running allowance, each refusal says why", () => {
    const v = (a: SiteAutoPlay, busy = false) => timeButtonsView(a, autoPlayView(a, true), busy);
    // An older server with no allowance field: both disabled, waiting.
    expect(v({ ...AUTO(), allowance: undefined }).presets.enabled).toBe(false);
    // Off: give it time; nothing to add to yet.
    const off = v(AUTO({ on: false }));
    expect(off.presets).toEqual({ enabled: true, why: "" });
    expect(off.adds).toEqual({ enabled: false, why: "Start with 15, 30 or 60 minutes first." });
    // On with no limit.
    expect(v(AUTO()).adds.why).toBe("Auto-play is on with no time limit.");
    // Running: both; a preset replaces the time left.
    const run = v(AUTO({ allowance: AL(), canAddTime: true }));
    expect(run.presets).toEqual({ enabled: true, why: "Starts a new allowance from now, in place of the time left." });
    expect(run.adds.enabled).toBe(true);
    expect(v(AUTO({ allowance: AL(), canAddTime: true }), true).adds.enabled).toBe(false); // busy
    // Running to midnight: nothing can be added.
    const mid = v(AUTO({ allowance: AL({ endsAtReset: true }), canAddTime: false }));
    expect(mid.adds).toEqual({ enabled: false, why: "The time already runs to midnight (Sydney)." });
    expect(mid.note).toBe("The time runs to midnight (Sydney); unused time doesn't carry over.");
    // Done for today: start again with minutes.
    const done = v(AUTO({ on: false, stopped: { reason: "timeUp", day: "2026-11-05" }, allowance: AL({ state: "done", secondsLeft: 0, minutesLeft: 0 }) }));
    expect(done.presets.enabled).toBe(true);
    expect(done.adds.why).toBe("Done for today: start again with 15, 30 or 60 minutes.");
    // Rewards maxed: no time can be given.
    expect(v(AUTO({ on: false, canTurnOn: false, dailyRewardsMaxed: true })).presets.enabled).toBe(false);
    // The stop's reason is worded by what stopped it.
    expect(autoPlayView(AUTO({ on: false, stopped: { reason: "timeUp", day: "d" } }), true).stopped).toContain("Time's up");
    expect(timeRingView(null, autoPlayView(AUTO({ on: false, stopped: { reason: "timeUp", day: "d" } }), true), false).caption).toBe("Done for today: time's up");
  });
});

const PW = "a long test password";
const running: (RunningOwnerApi | { close(): Promise<void> })[] = [];
afterEach(async () => {
  while (running.length) await running.pop()!.close();
});

describe("the time ring over the real owner API, with the ladder playing", () => {
  it("15 minutes given, the ring drains, +15, time up mid-match finishes the match, then Done for today; midnight Sydney clears it", async () => {
    const clock = { t: T0 };
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
      return { ...o, agent: a };
    });
    store.setAutoPlay(owners[1]!.ownerId, true); // Boris: no time limit
    const dir = mkdtempSync(join(tmpdir(), "site-time-"));
    let n = 0;
    const live = new LiveLadder({ store, seed: 58, build: { games: 0 }, matchId: () => `t-${++n}`, logDir: dir, housePacks: false, now: () => clock.t, roundGapMs: 60_000 });
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 }, live, matchFiles: dir });
    running.push({ close: async () => rmSync(dir, { recursive: true, force: true }) });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const ada = (await client.signIn("ada", PW)).token;
    const draw = async (size: "S" | "M" | "L"): Promise<{ html: string; play: SitePlay }> => {
      const play = await client.play(ada);
      const d: AgentWidgetData = { play, rating: null, daily: null, history: null, live: null, allowance: allowanceOf(play.autoPlay, clock.t), errors: {}, now: clock.t };
      return { html: agentControlsHtml(size, d), play };
    };
    const centre = (html: string) => /<b class="tr-c[^"]*">([^<]*)/.exec(html)![1];

    // Off: the 15 / 30 / 60 buttons are live, +15 / +30 aren't.
    let { html } = await draw("L");
    expect(html).toMatch(/data-act="play-time" data-min="15" data-add="0">/);
    expect(html).toMatch(/data-min="15" data-add="1" disabled title="Start with 15, 30 or 60 minutes first."/);
    expect(html).not.toContain("arrive with the server");

    // "15 min" (what its button sends).
    let r = await client.setAutoPlay(ada, true, 15);
    expect(r.autoPlay.allowance).toMatchObject({ state: "running", totalMinutes: 15, minutesLeft: 15 });
    ({ html } = await draw("S"));
    expect(centre(html)).toBe("15");
    expect(html).toContain('aria-label="Lattice Wren: 15 min left"');

    // The ladder pairs Ada; 6 minutes on, the ring has drained.
    const step = async (ms: number) => {
      for (let left = ms; left > 0; left -= 1000) {
        clock.t += 1000;
        await live.tick();
      }
    };
    await step(6 * 60_000);
    ({ html } = await draw("M"));
    expect(centre(html)).toBe("9");
    expect(html).toContain("9 min left today");

    // "+15" while it runs.
    r = await client.addPlayTime(ada, 15);
    expect(r.autoPlay.allowance).toMatchObject({ state: "running", totalMinutes: 30, minutesLeft: 24 });
    ({ html } = await draw("L"));
    expect(centre(html)).toBe("24");

    // Run the time out with a match live: "Finishing match".
    let finishing = false;
    for (let i = 0; i < 3 * 3600 && !finishing; i++) {
      clock.t += 1000;
      await live.tick();
      const ap = store.autoPlay(owners[0]!.ownerId);
      if (ap.allowance?.state === "finishing") finishing = true;
      if (ap.allowance?.state === "done") break;
    }
    expect(finishing).toBe(true);
    ({ html } = await draw("M"));
    expect(centre(html)).toBe("Finishing match");
    expect(html).toContain("Time&#39;s up: your agent is finishing its last match.");
    expect(html).toContain('href="#/match">Go to match');

    // The match plays out; no new one starts: "Done for today".
    for (let i = 0; i < 4000 && store.autoPlay(owners[0]!.ownerId).allowance?.state !== "done"; i++) {
      clock.t += 1000;
      await live.tick();
    }
    let d = await draw("L");
    expect(d.play.autoPlay.on).toBe(false);
    expect(centre(d.html)).toBe("Done for today");
    expect(d.html).toContain("Time&#39;s up: your agent is done for today.");
    expect(d.html).toMatch(/data-min="30" data-add="1" disabled title="Done for today: start again with 15, 30 or 60 minutes."/);
    // No match for Ada starts after.
    await step(3 * 60_000);
    expect((await client.play(ada)).liveMatch).toBeNull();

    // Midnight Sydney (13:00Z): the new day reads clean, the ring "Off".
    clock.t = Date.parse("2026-11-05T13:00:30.000Z");
    d = await draw("S");
    expect(d.play.autoPlay.allowance).toBeNull();
    expect(centre(d.html)).toBe("Off");
    expect(d.html).not.toMatch(/undefined|NaN/);
  }, 120_000);
});
