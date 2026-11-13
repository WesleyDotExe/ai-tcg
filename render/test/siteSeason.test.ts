// Render session 72: the season's end on the Stats page (`GET /api/season`'s
// state and `endsAt`, game session 94, schema v29), worded in Sydney time.
// Pure, on the server's own Season 0 end time.
import { describe, expect, it } from "vitest";
import { seasonClosed, seasonEndHtml, seasonEndView, seasonName, sydneyWhen, untilText, type SiteSeason } from "../src/site/siteSeason.js";
import { agentControlsHtml, ringTicks, timeButtonsView, timeRingView, type AgentWidgetData } from "../src/site/siteAgent.js";
import { autoPlayView } from "../src/site/siteMatches.js";
import type { SiteAutoPlay, SitePlay } from "../src/site/siteApi.js";
import { ladderSectionHtml } from "../src/site/siteStats.js";

// The server's `SEASON_END_TIMES.S0` (owner 2026-11-13: midnight Sydney at the end of 26 Dec 2026).
const S0_END = "2026-12-26T13:00:00.000Z";
const SEASON: SiteSeason = { season: "S0", state: "open", endedAt: null, endsAt: S0_END, liveMatches: 2, tierCoinsNow: null, you: null, standings: null, retiredPrototypes: null, startedFrom: null, yourSeed: null };
const DAY = 86_400_000;

describe("the season's end, in words", () => {
  it("Sydney time: a midnight is the end of the day before, as the owner says it", () => {
    expect(seasonName("S0")).toBe("Season 0");
    expect(seasonName("S12")).toBe("Season 12");
    expect(sydneyWhen(S0_END)).toBe("midnight at the end of Sat 26 Dec");
    // Not a midnight: the day and the time (AEDT, UTC+11).
    expect(sydneyWhen("2026-12-26T12:00:00.000Z")).toBe("Sat 26 Dec, 23:00");
    // Winter (AEST, UTC+10): the zone, not a fixed offset.
    expect(sydneyWhen("2027-06-30T14:00:00.000Z")).toBe("midnight at the end of Wed 30 Jun");
  });

  it("how long is left", () => {
    expect(untilText(30_000)).toBe("in under a minute");
    expect(untilText(12 * 60_000)).toBe("in 12 min");
    expect(untilText(5 * 3_600_000 + 59 * 60_000)).toBe("in 5 h");
    expect(untilText(47 * 3_600_000)).toBe("in 47 h");
    expect(untilText(43 * DAY + 3_600_000)).toBe("in 43 days");
  });

  it("open with an end time; none set; passed; ending; ended", () => {
    const now = Date.parse(S0_END) - 43 * DAY - 3_600_000;
    expect(seasonEndView(SEASON, now)).toEqual({
      tone: "open",
      chip: "Ends in 43 days",
      line: "Season 0 ends at midnight at the end of Sat 26 Dec (Sydney time), in 43 days. The server ends it: no new round starts from then.",
    });
    expect(seasonEndView({ ...SEASON, endsAt: null }, now)).toMatchObject({ tone: "none", chip: "No end time" });
    // A server older than v29 sends no endsAt at all: the same.
    const { endsAt: _, ...old } = SEASON;
    expect(seasonEndView(old, now)?.tone).toBe("none");
    // The page's clock past the end before the server's next read says "ending".
    expect(seasonEndView(SEASON, Date.parse(S0_END) + 1000)).toMatchObject({ tone: "ending", chip: "Ending now" });
    expect(seasonEndView({ ...SEASON, state: "ending" }, now)?.line).toBe("Season 0 is ending: no new round starts; the 2 matches on screen finish and count, then it ends.");
    expect(seasonEndView({ ...SEASON, state: "ending", liveMatches: 1 }, now)?.line).toContain("the match on screen finishes and counts");
    expect(seasonEndView({ ...SEASON, state: "ending", liveMatches: 0 }, now)?.line).toBe("Season 0 is ending: no new round starts; it ends in a moment.");
    expect(seasonEndView({ ...SEASON, state: "ended", endedAt: "2026-12-26T13:04:10.000Z", liveMatches: 0 }, now)).toEqual({
      tone: "ended",
      chip: "Ended",
      line: "Season 0 has ended (its last match recorded Sun 27 Dec, 00:04, Sydney time). The ladder is its final standings.",
    });
    expect(seasonEndView(null, now)).toBeNull();
  });

  it("drawn under the ladder's title, escaped; nothing before the season is read", () => {
    const html = seasonEndHtml(seasonEndView({ ...SEASON, season: "S<1>" }, Date.parse(S0_END) - 2 * DAY));
    expect(html).toContain('class="st-season t-open"');
    expect(html).toContain("S&lt;1&gt; ends at");
    expect(seasonEndHtml(null)).toBe("");
    const ladder = { standings: [], you: { rank: null, ownerId: "o", ownerName: "Nova", ownerKind: "player", agent: null, rating: 1500, rd: 350, tier: "Placement", ratedMatches: 0, wins: 0, losses: 0, draws: 0, lastDay: null }, owners: 0, tiers: [], placementMatches: 5 } as unknown as Parameters<typeof ladderSectionHtml>[0];
    const section = ladderSectionHtml(ladder, null, html);
    expect(section.indexOf("st-season")).toBeGreaterThan(section.indexOf("Season ladder"));
    expect(ladderSectionHtml(ladder, null)).not.toContain("st-season");
  });
});

// Agent controls once the season stops starting matches: the server still
// takes auto-play on after the end (no refusal), but no match ever starts,
// so Start and the time buttons would promise nothing (seen in the browser,
// season-check-s72).
const RUNNING = { state: "running" as const, label: "Running", startedAt: "2026-12-26T12:50:00.000Z", endsAt: "2026-12-26T13:05:00.000Z", totalMinutes: 15, secondsLeft: 300, minutesLeft: 5, endsAtReset: false };
const AUTO: SiteAutoPlay = { on: true, changedAt: null, stopped: null, dailyRewardsMaxed: false, canTurnOn: true, house: false, allowance: RUNNING, canAddTime: true };
const PLAY = {
  deckChoice: "agent", factionLock: null, lockableFactions: [], activeDeck: null, agentDeck: null, rebuild: { reasons: [], job: null },
  connectedAgent: { agentId: "a1", name: "Wren", playStyle: "tempo" }, agents: [], playStyles: [], decks: [], liveMatch: null, autoPlay: AUTO,
} as unknown as SitePlay;
const DATA: AgentWidgetData = { play: PLAY, rating: null, daily: null, history: { total: 0, more: false, matches: [] }, live: null, allowance: { minutesTotal: 15, minutesLeft: 5, secondsLeft: 300, state: "running", label: "Running" }, errors: {}, now: Date.parse(S0_END) };

describe("Agent controls once the season stops starting matches", () => {
  const after = Date.parse(S0_END) + 60_000;
  it("closed: ending, ended, or the end time passed on the page's clock; open otherwise", () => {
    expect(seasonClosed(SEASON, Date.parse(S0_END) - 1000)).toBeNull();
    expect(seasonClosed(SEASON, after)).toEqual({ ended: false, why: "Season 0 is ending: no new round starts." });
    expect(seasonClosed({ ...SEASON, state: "ending" }, 0)).toEqual({ ended: false, why: "Season 0 is ending: no new round starts." });
    expect(seasonClosed({ ...SEASON, state: "ended" }, 0)).toEqual({ ended: true, why: "Season 0 has ended: no new match starts." });
    expect(seasonClosed({ ...SEASON, endsAt: null }, after)).toBeNull();
    expect(seasonClosed(null, after)).toBeNull();
  });

  it("ended: the ring says so, Start and the time buttons are off with the reason; Stop stays", () => {
    const closed = seasonClosed({ ...SEASON, state: "ended" }, after)!;
    const ap = autoPlayView({ ...AUTO, on: false, allowance: null }, true, closed.why);
    expect(ap).toMatchObject({ on: false, enabled: false, note: "Season 0 has ended: no new match starts." });
    // Stop is still offered while on (it harms nothing).
    expect(autoPlayView(AUTO, true, closed.why)).toMatchObject({ on: true, enabled: true });
    // A house agent is unchanged.
    expect(autoPlayView({ ...AUTO, house: true }, true, closed.why).shown).toBe(false);
    expect(timeRingView(DATA.allowance, ap, false, closed)).toEqual({ pct: 0, centre: "Ended", unit: null, caption: "Season 0 has ended: no new match starts. Its ladder is the final standings.", tone: "done", note: "Season over" });
    expect(timeButtonsView({ ...AUTO, on: false, allowance: null }, ap, false, closed)).toEqual({ presets: { enabled: false, why: closed.why }, adds: { enabled: false, why: closed.why }, note: "" });
    // The page's tick doesn't redraw a running allowance over it.
    expect(ringTicks(PLAY)).toBe(true);
    expect(ringTicks(PLAY, closed)).toBe(false);
    for (const size of ["S", "M", "L"] as const) {
      const html = agentControlsHtml(size, { ...DATA, play: { ...PLAY, autoPlay: { ...AUTO, on: false, allowance: null } }, allowance: null, closed });
      expect(html).toContain('class="tring t-done"');
      expect(html).toContain(">Ended</b>");
      expect(html).toMatch(/data-act="auto-play" data-on="1" disabled title="Season 0 has ended: no new match starts.">Start</);
      expect(html).not.toContain("joins the next ladder round");
      if (size === "S") expect(html).toMatch(/<span class="small ac-cap ac-note" title="Season 0 has ended[^"]*">Season over<\/span>/);
      else expect(html).not.toMatch(/data-act="play-time"(?![^>]*disabled)/);
    }
  });

  it("ending, the agent in its last match: the ring says ending, the match counts", () => {
    const closed = seasonClosed({ ...SEASON, state: "ending" }, after)!;
    const ap = autoPlayView(AUTO, true, closed.why);
    const v = timeRingView(DATA.allowance, ap, true, closed);
    expect(v).toMatchObject({ centre: "Ending", tone: "finish", note: "Season ending" });
    expect(v.caption).toBe("Season 0 is ending: no new round starts. Your agent's match finishes and counts.");
  });
});
