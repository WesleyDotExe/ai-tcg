// The Match history and Notifications tiles (render session 94, phase 2
// "the tiles in groups", group 4's second half).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alertSummary, resultOf, tileById, tileFacts, when, type HomeData } from "../src/homeFacts.js";
import { gridTileHtml } from "../src/homePage.js";
import { historyExpect, historyStateCases } from "../src/historyStates.js";
import { notifExpect, notifStateCases } from "../src/notifStates.js";
import type { Size } from "../src/homeSpec.js";

const data = JSON.parse(readFileSync(join(import.meta.dirname, "..", "mockup", "data", "home-data.json"), "utf8")) as HomeData;
const nova = data.owners.nova!, wren = data.owners.wren!;
const SIZES: Size[] = ["S", "M", "L"];
const text = (html: string) => html.replace(/&#39;|&#x27;/g, "'").replace(/<[^>]+>/g, " ").replace(/&[#a-z0-9]+;/g, " ").replace(/\s+/g, " ").replace(/ ([.,:])/g, "$1").trim();
const fact = (tile: string, size: Size, d: typeof nova, f: string) => text(tileFacts(tileById(tile), size, d).find((h) => h.includes(`data-fact="${f}"`)) ?? "");
const hist = (id: string) => historyStateCases(data).find((c) => c.id === id)!.data;
const notif = (id: string) => notifStateCases(data).find((c) => c.id === id)!.data;

describe("a match result in words", () => {
  it("names every result the API sends; a cancel or an abandon is never \"Drew\"", () => {
    expect(["win", "loss", "draw", "cancelled", "abandonedByYou", "abandonedByOpponent"].map((r) => resultOf(r).word)).toEqual(["Won", "Lost", "Drew", "Cancelled", "Your agent left", "Opponent left"]);
    expect(fact("history", "S", hist("every-result"), "lastResult")).toBe("Cancelled vs Static Widow paid nothing · not rated · 1:20 pm");
  });
  it("says when on the day's own clock: the time today, Yesterday, else the date", () => {
    expect(when("2026-11-22T02:22:49.425Z", nova)).toBe("1:22 pm");
    expect(when("2026-11-21T05:00:00.000Z", nova)).toBe("Yesterday");
    expect(when("2026-10-17T10:00:00.000Z", nova)).toBe("17 Oct");
  });
});

describe("the Match history tile", () => {
  it("leads with the last match: what it paid and the rating change; the list is the matches before it", () => {
    expect(fact("history", "S", nova, "lastResult")).toBe("Won vs Rook's agent +10 credits · rating +19 · 1:22 pm");
    expect(fact("history", "M", nova, "recentMatches")).toBe("Before that Paid Rating Ended L vs Rook's agent +2 −174 12:45 pm W vs Rook's agent +30 +4 12:15 pm W vs Static Widow +5 +32 11:56 am");
  });
  it("M lists three, L six, S none; L has a Replay link only where a replay was kept", () => {
    for (const c of historyStateCases(data)) {
      const e = historyExpect(c.data);
      const rows = (s: Size) => (gridTileHtml("history", s, c.data).match(/<li title=/g) ?? []).length;
      expect([rows("S"), rows("M"), rows("L")], c.id).toEqual([0, e.m, e.l]);
      expect((gridTileHtml("history", "L", c.data).match(/<a class="rp"/g) ?? []).length, c.id).toBe(e.replays);
      expect(gridTileHtml("history", "M", c.data), c.id).not.toContain('class="rp"');
    }
  });
  it("names the agent in a row only when two agents share the history", () => {
    expect(fact("history", "M", nova, "recentMatches")).not.toContain("Vector Halcyon");
    expect(fact("history", "M", hist("two-agents"), "recentMatches")).toContain("Quill Static vs");
  });
  it("a new player: no matches yet, what a match pays at L (the economy rule), Start your agent", () => {
    for (const s of SIZES) expect(gridTileHtml("history", s, wren)).toContain("Start your agent");
    const pays = fact("history", "L", wren, "recentMatches");
    expect(pays).toContain("A win pays most: the first today 30 credits");
    expect(pays).toContain("A loss pays a little: 2 credits, up to 10 losses a day");
    expect(pays).toContain("A cancelled match pays nothing");
    expect(pays).toContain("An abandoned match pays nothing to either side");
    expect(fact("history", "M", wren, "recentMatches")).not.toContain("What a match pays");
  });
  it("the tally at L counts what paid nothing apart from the losses", () => {
    expect(fact("history", "L", hist("every-result"), "replays")).toBe("Last 7 2 W · 2 L · 1 D · 2 paid nothing Replays 5 of these 7 kept · 41 matches in all");
  });
});

describe("the Notifications tile", () => {
  it("the new count is the headline at every size; S names the newest", () => {
    for (const s of SIZES) expect(fact("notif", s, nova, "unread")).toBe("24 new");
    expect(fact("notif", "S", nova, "alerts")).toBe("Latest Your free pack is waiting");
    expect(fact("notif", "S", notif("read"), "alerts")).toBe("");
    expect(fact("notif", "S", notif("read"), "unread")).toBe("All caught up Nothing new since you last looked.");
    expect(fact("notif", "S", notif("empty"), "unread")).toBe("No alerts yet Results, big pulls and your free pack show here.");
  });
  it("M lists the newest three, L five, each one link to the tile that owns it, and counts the new ones not shown", () => {
    for (const c of notifStateCases(data)) {
      const e = notifExpect(c.data);
      const links = (s: Size) => [...gridTileHtml("notif", s, c.data).matchAll(/class="alink" href="#\/home" data-to="(\w+)"/g)].map((m) => m[1]!);
      expect([links("S").length, links("M").length, links("L").length], c.id).toEqual([0, e.m, e.l]);
      expect(links("L").every((t) => ["daily", "history", "collection", "agent"].includes(t)), c.id).toBe(true);
    }
    expect(fact("notif", "M", nova, "alerts")).toContain("21 more new in Alerts");
    expect(fact("notif", "L", nova, "alerts")).toContain("19 more new in Alerts");
  });
  it("reads each kind from the API's own fields: a big pull's cards, a stop's reason, a cancel", () => {
    const d = notif("every-kind");
    const s = d.notifications.notifications.map((a) => alertSummary(a, d));
    expect(s.map((x) => x.title)).toEqual(["Your agent stopped playing", "Big pull: Patient Zero", "Cancelled vs Static Widow", "A Jackpot pack", "Opponent left vs Hive Courier", "2 free packs waiting", "Your agent stopped playing"]);
    expect(s[0]!.meta).toContain("Its 45 minutes of play are up");
    expect(s[1]!.meta).toBe("1:11 pm · Prototype Mythic · +1 more");
    expect(s[2]!.meta).toContain("paid nothing");
    expect(s[6]!.meta).toContain("Every paid win today is in");
    expect(s.map((x) => x.to)).toEqual(["agent", "collection", "history", "collection", "history", "daily", "agent"]);
  });
  it("names the agent only when the owner has two", () => {
    expect(alertSummary(nova.notifications.notifications[1]!, nova).meta).toContain("Vector Halcyon");
    expect(alertSummary(notif("every-kind").notifications.notifications[2]!, notif("every-kind")).meta).not.toContain("Wren's agent");
  });
  it("a new player's L says what each kind tells; L's kinds are links that filter the Alerts page", () => {
    expect(fact("notif", "L", wren, "alertKinds")).toContain("What tells you here Results each match your agent finishes");
    expect(gridTileHtml("notif", "L", nova)).toMatch(/class="chip kf" href="#\/alerts" data-go="alerts" data-kind="matchResult"/);
    expect(fact("notif", "L", nova, "alertKinds")).not.toContain("What tells you here");
  });
});
