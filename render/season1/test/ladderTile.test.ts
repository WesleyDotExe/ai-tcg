// The Ladder tile (render session 89, phase 2 "the tiles in groups", group
// 2): the rating, tier, rank and form in one tile, each size's copy written
// for its box, read from the owner API's rating, ladder and stats answers.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gridTileHtml } from "../src/homePage.js";
import { climbOf, factsIn, standingsRows, tileById, type HomeData } from "../src/homeFacts.js";
import { ladderStateCases, ladderStatesPage } from "../src/ladderStates.js";
import { type Size } from "../src/homeSpec.js";

const data = JSON.parse(readFileSync(join(import.meta.dirname, "..", "mockup", "data", "home-data.json"), "utf8")) as HomeData;
const cases = ladderStateCases(data);
const byId = Object.fromEntries(cases.map((c) => [c.id, c.data]));
const SIZES: Size[] = ["S", "M", "L"];
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("the Ladder tile", () => {
  it("shows exactly the spec's facts at each size, in every state, the first three as one headline", () => {
    const t = tileById("ladder");
    for (const c of cases) for (const s of SIZES) {
      const html = gridTileHtml("ladder", s, c.data);
      expect(factsIn(html), `${c.id} ${s}`).toEqual(t.sizes[s]);
      const head = /<div class="headline">([\s\S]*?)<div class="body">/.exec(html)![1]!;
      expect(factsIn(head)).toEqual(["rating", "tier", "rank"]);
    }
  });

  it("one bar: placement until placed, then the next tier; the top tier has none above", () => {
    expect(climbOf(byId.new!)).toMatchObject({ kind: "placement", done: 0, of: 5, pct: 0 });
    expect(climbOf(byId.placing!)).toMatchObject({ kind: "placement", done: 3, of: 5, pct: 60 });
    // Nova 1774 Platinum (1650) -> Diamond (1800): 26 points, 82.8% of the span.
    const n = climbOf(byId.placed!);
    expect(n).toMatchObject({ kind: "next", points: 26, next: "Diamond", nextFrom: 1800 });
    expect(n.pct).toBeCloseTo((100 * (1774.26 - 1650)) / 150, 0);
    expect(climbOf(byId["top-tier"]!)).toMatchObject({ kind: "top", pct: 100 });
    // Bronze has no floor: its bar runs over the next tier's span below Silver.
    const b = climbOf(byId["far-down"]!);
    expect(b).toMatchObject({ kind: "next", next: "Silver", points: 59 });
    expect(b.pct).toBeGreaterThan(0);
    expect(b.pct).toBeLessThan(100);
  });

  it("never says the placement count and the next tier at once, and never ±", () => {
    for (const c of cases) for (const s of SIZES) {
      const t = text(gridTileHtml("ladder", s, c.data));
      expect(/placement matches|of 5 matches/.test(t) && /points to/.test(t), `${c.id} ${s}`).toBe(false);
      expect(t, `${c.id} ${s}`).not.toContain("±");
    }
  });

  it("S unplaced carries the count (it has no bar); M and L say not ranked yet", () => {
    expect(text(gridTileHtml("ladder", "S", byId.placing!))).toContain("3 of 5 placement matches");
    expect(text(gridTileHtml("ladder", "M", byId.placing!))).toContain("Not ranked yet");
    expect(text(gridTileHtml("ladder", "M", byId.placing!))).toContain("3 of 5 matches");
  });

  it("the standings: the top, you on the list (with a gap when you're below), four ranked rows at most", () => {
    const top = standingsRows(byId.placed!);
    expect(top.map((r) => [r.rank, r.me])).toEqual([[1, true], [2, false]]);
    const far = standingsRows(byId["far-down"]!);
    expect(far.map((r) => (r.gap ? "gap" : r.rank))).toEqual([1, 2, "gap", 4, 5]);
    expect(far.at(-1)).toMatchObject({ me: true, rating: 1291 });
    const unplaced = standingsRows(byId.new!);
    expect(unplaced.at(-1)).toMatchObject({ me: true, rank: null, rating: null, name: "Wren" });
    for (const c of cases) expect(standingsRows(c.data).filter((r) => !r.gap).length).toBeLessThanOrEqual(4);
  });

  it("a new player gets the tier ladder with the ranked agents and the start, not an empty chart", () => {
    const html = gridTileHtml("ladder", "L", byId.new!);
    expect(html).toContain('class="scale"');
    expect(html).not.toContain('class="chart"');
    expect(text(html)).toMatch(/Mythic 1950\+.*Bronze under 1350/);
    expect((html.match(/<em>start<\/em>/g) ?? []).length).toBe(1);
    expect(gridTileHtml("ladder", "L", byId.placed!)).toContain('class="chart"');
  });

  it("decks: the two most played on the line, the rest as +n more with all of them in the title", () => {
    const t = gridTileHtml("ladder", "L", byId["far-down"]!);
    const wr = /data-fact="factionWinRate"[\s\S]*?<\/div>/.exec(t)![0];
    expect(text(wr)).toContain("Cortex 40%");
    expect(text(wr)).toContain("Swarm 36%");
    expect(text(wr)).toContain("+2 more");
    expect(wr).toContain("Null 20% of 5");
  });

  it("every state's tier follows its rating and the ladder's floors (the sheet's data is the API's shape)", () => {
    for (const c of cases) {
      const r = c.data.rating.rating;
      if (r.tier === "Placement") continue;
      const tier = [...c.data.ladder.tiers].reverse().find((t) => t.from === null || t.from <= r.rating)!.tier;
      expect(r.tier, c.id).toBe(tier);
      const me = c.data.ladder.standings.find((s) => s.rank === c.data.ladder.you.rank)!;
      expect(me.rating, c.id).toBe(r.rating);
    }
  });

  it("draws every state at S, M and L on each of the grid's three units", () => {
    const html = ladderStatesPage(data);
    expect((html.match(/<article class="tile[^"]*" data-tile="ladder"/g) ?? []).length).toBe(cases.length * 3 * 3);
    expect(html).not.toMatch(/<article class="tile[^"]* hero/);
  });
});
