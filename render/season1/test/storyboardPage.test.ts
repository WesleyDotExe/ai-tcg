// The storyboard page (render session 85): every beat drawn, the audit's
// rows read from the sampler's summaries, self-contained.
import { describe, expect, it } from "vitest";
import { renderStoryboardHtml } from "../src/storyboardPage.js";
import { BIG_PULL, STORYBOARD } from "../src/openingStoryboard.js";

describe("the pack-opening storyboard page", () => {
  const html = renderStoryboardHtml({
    owner: [{ run: "pack=7", label: "Gold", pass: true, text: "worst 2 flashes/s (4 changes)" }],
    fastest: [{ run: "pack=7", label: "Gold", pass: false, text: "worst 5 flashes/s (10 changes)" }],
    reduced: [],
    repeats: [{ run: "pack=7#2", label: "Gold", pass: true, text: "worst 2.5 flashes/s (5 changes)" }],
  });
  it("draws every beat with its sketch, its words and its light curve", () => {
    expect(html.match(/<article class="beat"/g)?.length).toBe(STORYBOARD.length + BIG_PULL.length);
    for (const b of [...STORYBOARD, ...BIG_PULL]) expect(html).toContain(`id="${b.id}"`);
    expect(html.match(/<svg viewBox="0 0 240 150" class="sk"/g)?.length).toBe(STORYBOARD.length + BIG_PULL.length);
    expect(html.match(/class="chart/g)?.length).toBe(STORYBOARD.length + BIG_PULL.length + 1);
  });
  it("says the storyboard's own light passes, normal and reduced, and shows the audit's rows as given", () => {
    const verdicts = html.slice(html.indexOf("The storyboard's light, checked"), html.indexOf("The beats ("));
    expect(verdicts).not.toContain('class="bad"');
    expect(verdicts.match(/none counted/g)?.length).toBe(3);
    expect(html).toContain("Gold · run 2");
    expect(html).toMatch(/<td class="bad">FAIL<\/td><td>worst 5 flashes\/s/);
    expect(html).not.toMatch(/undefined|NaN/);
  });
  it("loads nothing from outside", () => {
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toMatch(/@import|url\(http/);
  });
});
