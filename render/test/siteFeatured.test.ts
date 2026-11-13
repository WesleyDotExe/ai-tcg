// Render session 71: Watch live's featured groups ("Top rated") and viewer
// counts, as the site words and orders what the server sends (OWNER_API.md
// "Featured and viewers", game session 74). The rule itself is the server's
// (server/src/ladder/featured.ts); these check the site only names, orders
// and explains it, and never invents a match or a number.

import { describe, expect, it } from "vitest";
import type { SiteLive, SiteLiveMatch, SitePublicSide } from "../src/site/siteApi.js";
import { liveGroups, liveLineHtml, liveOrder, scoreboardOf, topRatedHtml, topRatedRank, topRatedWhy, viewersHtml, viewersText } from "../src/site/siteMatches.js";
import { arenaMatchOf, widgetHtml, type WidgetData } from "../src/site/siteWidgets.js";

const side = (name: string): SitePublicSide => ({ name, health: 20, maxHealth: 20, energy: 1, maxEnergy: 1, hand: 4, deck: 30, graveyard: 0, board: [], directives: [], signature: null });
const match = (id: string, r1: number, t1: string, r2: number, t2: string, viewers = 0): SiteLiveMatch => ({
  matchId: id,
  startedAt: "2026-11-13T00:00:00.000Z",
  released: 3,
  nextAt: "2026-11-13T00:00:05.000Z",
  p1: { ownerId: `o-${id}-1`, ownerName: `Owner ${id}a`, agentId: "a1", agentName: `Agent ${id}a`, playStyle: "balanced", rating: r1, tier: t1 },
  p2: { ownerId: `o-${id}-2`, ownerName: `Owner ${id}b`, agentId: "a2", agentName: `Agent ${id}b`, playStyle: "balanced", rating: r2, tier: t2 },
  now: { turn: 2, activePlayer: "p1", priority: "p1", stack: 0, winner: null, p1: side("p1"), p2: side("p2") },
  recentLines: [],
  viewers,
});
// The server's own demo round (progress/featured-viewers-001.txt, section 2).
const LIVE: SiteLive = {
  running: true,
  mine: null,
  matches: [
    match("m21", 1819, "Diamond", 1786, "Platinum", 4),
    match("m22", 1663, "Platinum", 1500, "Placement", 1),
    match("m23", 1500, "Placement", 1538, "Gold"),
    match("m24", 1167, "Bronze", 1375, "Silver", 12),
    match("m25", 1371, "Silver", 1301, "Bronze"),
  ],
  featured: { tournament: [], topRated: ["m21", "m25", "m24"] },
};

describe("featured groups (pure)", () => {
  it("groups by the server's ids, in its order; the rest in the list's order", () => {
    const g = liveGroups(LIVE);
    expect(g.tournament).toEqual([]);
    expect(g.topRated.map((m) => m.matchId)).toEqual(["m21", "m25", "m24"]);
    expect(g.rest.map((m) => m.matchId)).toEqual(["m22", "m23"]);
    expect(liveOrder(LIVE).map((m) => m.matchId)).toEqual(["m21", "m25", "m24", "m22", "m23"]);
  });
  it("a tournament match comes first and is in one group only; an id not live is skipped", () => {
    const l = { ...LIVE, featured: { tournament: ["m24", "gone"], topRated: ["m21", "m24", "gone", "m25"] } };
    const g = liveGroups(l);
    expect(g.tournament.map((m) => m.matchId)).toEqual(["m24"]);
    expect(g.topRated.map((m) => m.matchId)).toEqual(["m21", "m25"]);
    expect(liveOrder(l)).toHaveLength(5);
    expect(topRatedRank(l, "gone")).toBeNull();
  });
  it("a server without `featured` (before session 74): every match in the rest, nothing ranked", () => {
    const old = { ...LIVE, featured: undefined } as unknown as SiteLive;
    expect(liveGroups(old).rest).toHaveLength(5);
    expect(liveOrder(old).map((m) => m.matchId)).toEqual(LIVE.matches.map((m) => m.matchId));
    expect(topRatedRank(old, "m21")).toBeNull();
    expect(topRatedHtml(old, LIVE.matches[0]!)).toBe("");
  });
  it("ranks and says why: the weaker side's rating and tier as it started", () => {
    expect(["m21", "m25", "m24", "m22"].map((id) => topRatedRank(LIVE, id))).toEqual([1, 2, 3, null]);
    expect(topRatedWhy(LIVE.matches[0]!)).toBe("Weaker side 1786 Platinum");
    expect(topRatedWhy(LIVE.matches[4]!)).toBe("Weaker side 1301 Bronze");
    expect(topRatedWhy(match("x", 1600.4, "Gold", 1599.6, "Gold"))).toBe("Weaker side 1600 Gold");
    const chip = topRatedHtml(LIVE, LIVE.matches[4]!);
    expect(chip).toContain(">Top rated #2<");
    expect(chip).toContain("both sides out of placement; weaker side 1301 bronze as the match started");
    expect(topRatedHtml(LIVE, LIVE.matches[4]!, { short: true })).toContain(">#2<");
    expect(topRatedHtml(LIVE, LIVE.matches[1]!)).toBe("");
  });
  it("viewer counts in words, and nothing when the server sent none", () => {
    expect([0, 1, 12].map((n) => viewersText(n))).toEqual(["No one watching", "1 watching", "12 watching"]);
    expect(viewersText(undefined)).toBeNull();
    expect(viewersText(-1)).toBeNull();
    expect(viewersText(NaN)).toBeNull();
    expect(viewersHtml(undefined)).toBe("");
    expect(viewersHtml(0)).toContain('class="vw none"');
    expect(viewersHtml(3)).toContain('aria-label="3 watching"');
    expect(viewersHtml(3)).toContain("<b aria-hidden=\"true\">3</b>");
  });
  it("a live line carries its tags; none without them", () => {
    const sb = scoreboardOf(LIVE.matches[0]!, null);
    expect(liveLineHtml(sb)).not.toContain("ltags");
    expect(liveLineHtml(sb, viewersHtml(4))).toContain('<span class="ltags"><span class="vw"');
  });
});

describe("the Watch live widget leads with the top pick", () => {
  const data = { live: LIVE, ownerId: null, errors: {}, now: 0, colFilter: "All" } as unknown as WidgetData;
  it("M: the top pick first, with its chip and eye; the others with rank and eye; the count line", () => {
    const html = widgetHtml({ id: "w", type: "watch", size: "M" }, data, { editing: false, live: "list" });
    expect(html.indexOf("Agent m21a")).toBeGreaterThan(-1);
    expect(html.indexOf("Agent m21a")).toBeLessThan(html.indexOf("Agent m25a"));
    expect(html.indexOf("Agent m25a")).toBeLessThan(html.indexOf("Agent m24a"));
    expect(html.indexOf("Agent m24a")).toBeLessThan(html.indexOf("Agent m22a"));
    expect(html).toContain('<div class="mtags"><span class="pill top"');
    expect(html).toContain('aria-label="4 watching"');
    expect(html).toContain(">#3<");
    expect(html).toContain("5 live · 3 top rated");
    expect(html).not.toContain("featured picks come later");
    expect(html).not.toMatch(/undefined|NaN|\[object/);
  });
  it("S: the score alone (owner 2026-11-12, call 4), of the top pick", () => {
    const html = widgetHtml({ id: "w", type: "watch", size: "S" }, data, { editing: false, live: "scoreboard" });
    expect(html).toContain('data-match="m21"');
    expect(html).not.toContain("pill top");
    expect(html).not.toContain('class="vw');
  });
  it("L: the tile's arena takes the top pick unless one is held", () => {
    expect(arenaMatchOf(LIVE, {}).matchId).toBe("m21");
    expect(arenaMatchOf(LIVE, { arena: { matchId: "m23", ended: false } })).toEqual({ matchId: "m23", index: 4 });
    const html = widgetHtml({ id: "w", type: "watch", size: "L" }, data, { editing: false, live: "arena" });
    expect(html).toContain('class="wl-arena" data-match="m21"');
    expect(html).toContain("5 live · 3 top rated");
  });
  it("no featured round: the list's order, no chips, the plain count", () => {
    const none = { ...data, live: { ...LIVE, featured: { tournament: [], topRated: [] } } } as WidgetData;
    const html = widgetHtml({ id: "w", type: "watch", size: "M" }, none, { editing: false, live: "list" });
    expect(html).not.toContain("pill top");
    expect(html).toContain(">5 live<");
  });
});
