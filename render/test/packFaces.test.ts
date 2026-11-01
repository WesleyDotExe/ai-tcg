// Render session 26: the owner's 2026-10-18 feel notes and side task.
// The page is checked in a real browser by
// progress/render/evidence/pack-tap-check.mjs; these tests pin what can be
// pinned in Node:
//  1. a modal ("choose one") card's face prints every mode's name and rules
//     text, exactly as the engine prints them;
//  2. full bleed: every finish rarer than Full Art (by the live shine-slot
//     odds) shows its art across the whole card once settled, and Standard
//     and Foil keep the framed art window;
//  3. the tap-driven ten-pack: what a tap on the row does, and the page
//     ships the tap timings, the Auto switch (off) and no "BIG PULL" tag;
//  4. the card-face sheet: the 3 Zero-Day cards and one real pull per
//     finish.
import { describe, expect, it } from "vitest";
import { CARD_REGISTRY, getCard } from "@ai-tcg/engine";
import { FINISHES, LIVE_PACK_ODDS, type Finish } from "@ai-tcg/economy";
import { BULK_TAP_TIMINGS, BULK_TIMINGS, cardFaceOf, revealKindOf, type RevealCard } from "../src/packOpening.js";
import { PACK_PAGE_PURE_SOURCE, renderPackOpeningHtml } from "../src/packPage.js";
import { openBulkShowcase, openShowcase } from "../src/packDemo.js";
import { renderFaceSheet, showcaseEntries, zeroDayEntries } from "../src/faceSheet.js";

type FaceCard = Pick<RevealCard, "face" | "finish" | "reveal" | "collectorNumber" | "prototype">;
const pure = new Function(`${PACK_PAGE_PURE_SOURCE}; return { packFaceHtml, packFullBleed, packRowTap, packFinishLayerName };`)() as {
  packFaceHtml: (c: FaceCard, opts: { settled: boolean }, setCode: string) => string;
  packFullBleed: (reveal: string) => boolean;
  packRowTap: (downs: number[], tapped: number, last: boolean) => { flip?: number; next?: "pack" | "summary" };
  packFinishLayerName: (reveal: string) => string;
};

const asCard = (cardId: string, finish: Finish): FaceCard => ({
  face: cardFaceOf({ cardId, name: cardId, rarity: "Mythic" }),
  finish,
  reveal: revealKindOf(finish),
  collectorNumber: "001/096",
  prototype: finish === "prototype" ? { runCode: "P01", serial: 7, runSize: 50 } : null,
});
const faceClass = (html: string) => /^<div class="([^"]+)"/.exec(html)![1]!.split(" ");

describe("a modal card's face prints each mode (owner side task, 2026-10-18)", () => {
  const modal = [...CARD_REGISTRY.values()].filter((c) => c.modes && c.modes.length);

  it("covers the 3 Zero-Day cards and, since game session 62, Force Quit and Null Pointer; every one's abilities list is empty", () => {
    expect(modal.map((c) => c.id).sort()).toEqual(["CX-019", "NL-015", "S0-ZD1", "S0-ZD2", "S0-ZD3"]);
    for (const c of modal) expect(c.abilities).toEqual([]);
  });

  it("the face data carries every mode's printed name and text, in order; other cards carry none", () => {
    for (const c of modal) expect(cardFaceOf({ cardId: c.id, name: c.name, rarity: c.rarity }).modes).toEqual(c.modes!.map((m) => ({ name: m.name, text: m.text })));
    for (const c of [...CARD_REGISTRY.values()].filter((x) => !x.modes)) expect(cardFaceOf({ cardId: c.id, name: c.name, rarity: c.rarity }).modes).toEqual([]);
    expect(cardFaceOf({ cardId: "S9-ZD1", name: "Reserved", rarity: "Mythic" }).modes).toEqual([]);
  });

  it("the face's rules box says CHOOSE ONE, then each mode's name with its rules text", () => {
    for (const c of modal) {
      const html = pure.packFaceHtml(asCard(c.id, "zeroDay"), { settled: true }, "S0");
      expect(html).toContain('<div class="text modal">');
      expect(html).toContain("CHOOSE ONE");
      const shown = [...html.matchAll(/<p class="mode"><b>([^<]+)<\/b> ([^<]+)<\/p>/g)].map((m) => [m[1], m[2]]);
      const esc = (s: string) => s.replace(/'/g, "&#39;");
      expect(shown).toEqual(c.modes!.map((m) => [esc(m.name), esc(m.text)]));
      expect(faceClass(html)).toContain("modal");
    }
    // Patient Zero, spelled out.
    const pz = pure.packFaceHtml(asCard("S0-ZD1", "zeroDay"), { settled: true }, "S0");
    expect(pz).toContain("<b>Outbreak</b> When this dies, deal 2 damage to all enemy units.");
    expect(pz).toContain("<b>Carrier</b> Your other units get +1/+0.");
  });

  it("a plain card's face has no mode block", () => {
    const html = pure.packFaceHtml(asCard("AG-007", "standard"), { settled: true }, "S0");
    expect(html).not.toContain("CHOOSE ONE");
    expect(html).toContain('<div class="text">');
    expect(faceClass(html)).not.toContain("modal");
  });

  it("mode text is escaped", () => {
    const c = asCard("S0-ZD1", "zeroDay");
    c.face = { ...c.face, modes: [{ name: "<b>x</b>", text: "a & b" }] };
    const html = pure.packFaceHtml(c, { settled: true }, "S0");
    expect(html).toContain("<b>&lt;b&gt;x&lt;/b&gt;</b> a &amp; b");
  });
});

describe("full bleed: a finish rarer than Full Art shows its art across the whole card (owner 2026-10-18)", () => {
  it("is exactly the finishes no commoner than Full Art in the live shine slot, plus the ones not in it", () => {
    const shine = LIVE_PACK_ODDS.shineFinish as Record<string, number>;
    for (const f of FINISHES) {
      // Standard is the shine slot's remainder (53.6%); Prototype and the
      // prize copy never roll in it (a 1-in-1,000 bonus card, a prize).
      const pct = f === "standard" ? 100 - Object.values(shine).reduce((a, b) => a + b, 0) : shine[f] ?? 0;
      const rarerOrFullArt = pct <= shine.fullArt!;
      expect(pure.packFullBleed(revealKindOf(f)), f).toBe(rarerOrFullArt);
    }
    expect(FINISHES.filter((f) => !pure.packFullBleed(revealKindOf(f))).sort()).toEqual(["foil", "standard"]);
  });

  it("a settled face carries the full-bleed class on those finishes; the reveal starts from the plain face", () => {
    const id = "AG-014";
    expect(getCard(id)).toBeTruthy();
    for (const f of FINISHES) {
      const settled = faceClass(pure.packFaceHtml(asCard(id, f), { settled: true }, "S0"));
      expect(settled.includes("full"), f).toBe(pure.packFullBleed(revealKindOf(f)));
      // Before its reveal a card turns over plain; the finish arrives with it.
      expect(faceClass(pure.packFaceHtml(asCard(id, f), { settled: false }, "S0"))).not.toContain("full");
    }
    expect(faceClass(pure.packFaceHtml(asCard(id, "gold"), { settled: true }, "S0"))).toEqual(expect.arrayContaining(["full", "goldframe"]));
    expect(faceClass(pure.packFaceHtml(asCard(id, "zeroDay"), { settled: true }, "S0"))).toEqual(expect.arrayContaining(["full", "zdface"]));
    const proto = pure.packFaceHtml(asCard(id, "prototype"), { settled: true }, "S0");
    expect(faceClass(proto)).toEqual(expect.arrayContaining(["full", "proto"]));
    expect(proto).toContain('<span class="plate">7/50</span>');
  });

  it("every finish but Standard has a lasting look (a shader layer or its CSS stand-in)", () => {
    for (const f of FINISHES) expect(pure.packFinishLayerName(revealKindOf(f)) === "", f).toBe(f === "standard");
  });
});

describe("the tap-driven ten-pack opening (owner 2026-10-18 feel notes)", () => {
  it("a tap turns the card under it if face down, else the first face-down card, else moves on", () => {
    expect(pure.packRowTap([2, 4], 4, false)).toEqual({ flip: 4 });
    expect(pure.packRowTap([2, 4], 0, false)).toEqual({ flip: 2 });
    expect(pure.packRowTap([2, 4], -1, false)).toEqual({ flip: 2 });
    expect(pure.packRowTap([4], 2, true)).toEqual({ flip: 4 });
    expect(pure.packRowTap([], 3, false)).toEqual({ next: "pack" });
    expect(pure.packRowTap([], -1, true)).toEqual({ next: "summary" });
  });

  const html = renderPackOpeningHtml({ title: "t", packs: openShowcase().slice(0, 1), bulks: openBulkShowcase() });

  it("the page ships the tap timings, an Auto switch that starts off, and no BIG PULL tag", () => {
    const timings = JSON.parse(/<script type="application\/json" id="pack-timings">([^<]+)<\/script>/.exec(html)![1]!);
    expect(timings.tap).toEqual(BULK_TAP_TIMINGS);
    expect(timings.bulk).toEqual(BULK_TIMINGS);
    expect(html).toMatch(/<button class="bauto" id="bauto" role="switch" aria-checked="false" hidden/);
    expect(html).toContain(">Skip to summary</button></div>");
    expect(html).not.toContain("BIG PULL");
  });

  it("the tap timings are short beats, and the pop guard never outlasts a slow tap", () => {
    expect(BULK_TAP_TIMINGS.sealed).toBeLessThan(BULK_TIMINGS.sealed);
    expect(BULK_TAP_TIMINGS.hitPop).toBeLessThanOrEqual(BULK_TIMINGS.hitHold);
    expect(BULK_TAP_TIMINGS.autoStackBeat).toBeGreaterThan(0);
  });
});

describe("the card-face sheet", () => {
  const showcase = openShowcase();

  it("shows the 3 Zero-Day cards with their set numbers and both modes", () => {
    const zd = zeroDayEntries();
    expect(zd.map((e) => [e.card.face.name, e.card.collectorNumber])).toEqual([["Patient Zero", "226/096"], ["Root Access", "227/096"], ["Kill Switch", "228/096"]]);
    for (const e of zd) expect(e.card.face.modes).toHaveLength(2);
  });

  it("shows one real pull per finish from the showcase, each a real card", () => {
    const entries = showcaseEntries(showcase);
    expect(entries.map((e) => e.card.finish)).toEqual(["standard", "foil", "fullArt", "altArt", "glitch", "secret", "gold", "zeroDay", "prototype"]);
    const sheet = renderFaceSheet(showcase);
    expect((sheet.match(/<figure class="sc"/g) ?? []).length).toBe(12);
    expect((sheet.match(/data-full="true"/g) ?? []).length).toBe(10);
  });
});
