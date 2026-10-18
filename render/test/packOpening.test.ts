// Render session 24: the pack-opening reveal, slice 1 (owner 2026-10-18).
// The page is checked in a real browser by
// progress/render/evidence/pack-opening-check.mjs; these tests pin what can
// be pinned in Node:
//  1. the plan shows only what was rolled: over 400 real store openings it
//     holds exactly the opening's copies, the sparks are on iff the pack
//     holds a hit (as the pity timer counts one), the shine slot is last of
//     the five and a bonus 6th card after it, and every finish gets its own
//     reveal;
//  2. the showcase opens one real pack per finish, the same packs every run;
//  3. the page embeds the plans unchanged, every shader, both sound halves,
//     and calls no network;
//  4. the page's pure helpers (the same source the page runs): the tear,
//     the gestures, the finish labels, the placeholder art;
//  5. the pack sounds: each in every voice, the hit's rise always rising and
//     a big hit climbing longer than a small one.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EconomyStore, FINISHES, FULL_ART_OR_BETTER, type PackOpening } from "@ai-tcg/economy";
import { planReveal, revealKindOf, cardFaceOf, REVEAL_TIMINGS } from "../src/packOpening.js";
import { openShowcase, SHOWCASE } from "../src/packDemo.js";
import { renderPackOpeningHtml, PACK_PAGE_PURE_SOURCE, PACK_PAGE_RUNTIME_SOURCE } from "../src/packPage.js";
import { PACK_FX_SHADERS, PACK_FX_RUNTIME_SOURCE } from "../src/packFx.js";
import { SFX_PACK_KINDS, sfxRecipe } from "../src/soundFx.js";

const T0 = Date.parse("2026-10-18T10:00:00.000Z");

function openMany(n: number): PackOpening[] {
  const s = EconomyStore.open(":memory:", { now: () => new Date(T0) });
  const o = s.createOwner({ name: "plan-test" }).ownerId;
  for (let i = 0; i < n; i++) s.grantPack(o, "S0", "weeklyChallenge");
  const out: PackOpening[] = [];
  for (let i = 0; i < n / 10; i++) out.push(...s.openPacks(o, 10, { seeds: Array.from({ length: 10 }, (_, k) => 1 + i * 10 + k) }).packs);
  s.close();
  return out;
}

describe("the reveal plan shows only what was rolled (400 real store openings)", () => {
  const openings = openMany(400);
  const plans = openings.map(planReveal);

  it("holds exactly the opening's copies, each unchanged", () => {
    for (const [i, plan] of plans.entries()) {
      const o = openings[i]!;
      expect(plan.cards.map((c) => c.copyId).sort()).toEqual(o.cards.map((c) => c.copyId).sort());
      for (const c of plan.cards) {
        const src = o.cards.find((x) => x.copyId === c.copyId)!;
        expect([c.cardId, c.finish, c.slot, c.collectorNumber, c.isNew, c.ownedAfter]).toEqual([src.cardId, src.finish, src.slot, src.collectorNumber, src.isNew, src.ownedAfter]);
        expect(c.prototype).toEqual(src.prototype);
        expect(c.secret).toEqual(src.secret);
      }
      expect([plan.seed, plan.jackpot, plan.packPoints, plan.oddsVersion]).toEqual([o.seed, o.jackpot, o.packPoints, o.oddsVersion]);
      // Planning twice gives the same plan: nothing in it is drawn.
      expect(planReveal(o)).toEqual(plan);
    }
  });

  it("sparks exactly when the pack holds a hit (Full Art or better), never a fake-out", () => {
    let withHit = 0;
    for (const [i, plan] of plans.entries()) {
      const hit = openings[i]!.cards.some((c) => FULL_ART_OR_BETTER.includes(c.finish));
      expect(plan.sparks).toBe(hit);
      if (hit) withHit++;
    }
    // Both kinds of pack occur, so the rule was tested both ways.
    expect(withHit).toBeGreaterThan(20);
    expect(400 - withHit).toBeGreaterThan(20);
  });

  it("the shine slot is always last of the five, a bonus 6th card after it", () => {
    for (const plan of plans) {
      expect(plan.cards.slice(0, 4).map((c) => c.slot)).toEqual(["Common", "Common", "Uncommon", "Rare"]);
      expect(plan.cards[4]!.slot).toBe("shine");
      if (plan.cards.length === 6) expect(plan.cards[5]!.slot).toBe("bonus");
    }
  });

  it("every card but a Standard one arrives face down; each finish has its own reveal", () => {
    for (const plan of plans) for (const c of plan.cards) {
      expect(c.faceDown).toBe(c.finish !== "standard");
      expect(c.reveal).toBe(revealKindOf(c.finish));
      expect(c.hit).toBe(FULL_ART_OR_BETTER.includes(c.finish));
    }
    expect(new Set(FINISHES.filter((f) => f !== "tournament").map(revealKindOf)).size).toBe(9);
    for (const f of FINISHES) expect(REVEAL_TIMINGS[revealKindOf(f)]).toBeDefined();
  });

  it("a card face is the printed card; a Zero-Day card not live yet shows its reserved entry", () => {
    const f = cardFaceOf({ cardId: "AG-007", name: "Aegis Sentinel", rarity: "Uncommon" });
    expect(f.type).toBe("Unit");
    expect(f.attack).not.toBeNull();
    expect(f.text.length).toBeGreaterThan(0);
    // Season 0's Zero-Day cards are live (game session 42): the real card.
    const live = cardFaceOf({ cardId: "S0-ZD1", name: "Patient Zero", rarity: "Mythic" });
    expect(live).toMatchObject({ name: "Patient Zero", type: "Unit", faction: "Neutral", cost: 3 });
    // An entry whose card isn't in the registry still shows as reserved.
    const zd = cardFaceOf({ cardId: "S1-ZD1", name: "Zero-Day 1 (not designed yet)", rarity: "Mythic" });
    expect(zd.type).toBe("Reserved");
    expect(zd.name).toBe("Zero-Day 1 (not designed yet)");
    expect(zd.cost).toBeNull();
  });
});

describe("the showcase: one real pack per finish", () => {
  const a = openShowcase();
  const b = openShowcase();
  const by = (label: string) => a.find((s) => s.label === label)!.reveal;

  it("opens every pack the page offers, in order, each with its finish", () => {
    expect(a.map((s) => s.label)).toEqual(SHOWCASE.map((w) => w.label));
    const shine = (label: string) => by(label).cards.find((c) => c.slot === "shine")!.finish;
    expect(shine("No hit")).toBe("standard");
    expect(by("No hit").sparks).toBe(false);
    expect(shine("Foil")).toBe("foil");
    expect(by("Foil").sparks).toBe(false);
    for (const [label, finish] of [["Full Art", "fullArt"], ["Alt Art", "altArt"], ["Glitch", "glitch"], ["Secret", "secret"], ["Gold", "gold"], ["Zero-Day", "zeroDay"]] as const) {
      expect(shine(label)).toBe(finish);
      expect(by(label).sparks).toBe(true);
    }
    const proto = by("Prototype").cards[5]!;
    expect(proto.finish).toBe("prototype");
    expect(proto.prototype!.serial).toBeGreaterThanOrEqual(1);
    expect(by("Jackpot").jackpot).toBe(true);
    expect(by("Jackpot").cards.every((c) => c.faceDown)).toBe(true);
    // Live since game session 42: the pulled Zero-Day card is the real card.
    expect(["Unit", "Command"]).toContain(by("Zero-Day").cards[4]!.face.type);
    expect(by("Zero-Day").cards[4]!.face.name).not.toMatch(/not designed yet/);
  });

  it("opens the same packs every run (only the store's random ids differ)", () => {
    const strip = (x: typeof a) => JSON.stringify(x, (k, v) => (k === "copyId" || k === "packId" ? undefined : v));
    expect(strip(b)).toBe(strip(a));
  });

  it("the committed page holds the same packs as a fresh build", () => {
    const committed = readFileSync(new URL("../output/pack-opening.html", import.meta.url), "utf8");
    const json = /<script type="application\/json" id="pack-data">([\s\S]*?)<\/script>/.exec(committed)![1]!;
    const data = JSON.parse(json) as { packs: typeof a };
    const strip = (x: unknown) => JSON.stringify(x, (k, v) => (k === "copyId" || k === "packId" ? undefined : v));
    expect(strip(data.packs)).toBe(strip(a));
  });
});

describe("the page", () => {
  const showcase = openShowcase();
  const html = renderPackOpeningHtml({ title: "t", packs: showcase });

  it("embeds the plans unchanged, every shader and both sound halves", () => {
    const json = /<script type="application\/json" id="pack-data">([\s\S]*?)<\/script>/.exec(html)![1]!;
    expect(JSON.parse(json).packs).toEqual(JSON.parse(JSON.stringify(showcase)));
    const shaders = /<script type="application\/json" id="pack-shaders">([\s\S]*?)<\/script>/.exec(html)![1]!;
    expect(JSON.parse(shaders)).toEqual(PACK_FX_SHADERS);
    expect(Object.keys(PACK_FX_SHADERS).sort()).toEqual(["foil", "glitch", "gold", "pack", "zeroDay"]);
    expect(html).toContain(PACK_FX_RUNTIME_SOURCE);
    expect(html).toContain("SND.mount(");
    expect(html).toContain("var SFX_PACK_KINDS");
  });

  it("calls no network and loads nothing from outside the file", () => {
    expect(html).not.toMatch(/\bsrc=["']https?:/);
    expect(html).not.toMatch(/<link\b/);
    expect(html).not.toMatch(/\bfetch\(|XMLHttpRequest|import\(/);
    expect(html).not.toMatch(/url\(["']?https?:/);
  });

  it("the page script never rolls: no Math.random decides a card, only effects", () => {
    // Math.random appears only in effect jitter (sparks, glitch bands); no
    // card, finish or order is read from it. The page takes its cards from
    // DATA only.
    const uses = PACK_PAGE_RUNTIME_SOURCE.split("\n").filter((l) => l.includes("Math.random"));
    for (const l of uses) expect(l).not.toMatch(/cards|finish|reveal\b|isNew|DATA/);
    expect(PACK_PAGE_RUNTIME_SOURCE).not.toMatch(/rollPack|seed\s*=/);
  });
});

const pure = new Function(`${PACK_PAGE_PURE_SOURCE}; return { packTearProgress, packGesture, packRiseTier, packFinishLabel, packArtSvg };`)() as {
  packTearProgress: (prev: number, x0: number, x: number, width: number) => number;
  packGesture: (dx: number, dy: number, ms: number) => string;
  packRiseTier: (kind: string) => string;
  packFinishLabel: (finish: string) => string;
  packArtSvg: (face: ReturnType<typeof cardFaceOf>, variant: string) => string;
};

describe("the page's pure helpers", () => {
  it("a drag across 70% of the pack tears it; dragging back never un-tears", () => {
    expect(pure.packTearProgress(0, 100, 100 + 140, 200)).toBe(1);
    expect(pure.packTearProgress(0, 100, 170, 200)).toBeCloseTo(0.5);
    expect(pure.packTearProgress(0.5, 100, 110, 200)).toBe(0.5);
    expect(pure.packTearProgress(0, 100, 50, 200)).toBe(0);
  });

  it("a tap, a swipe either way, or neither", () => {
    expect(pure.packGesture(3, 2, 120)).toBe("tap");
    expect(pure.packGesture(3, 2, 900)).toBe("none");
    expect(pure.packGesture(-90, 10, 200)).toBe("swipeLeft");
    expect(pure.packGesture(90, 10, 200)).toBe("swipeRight");
    expect(pure.packGesture(30, 120, 200)).toBe("none");
  });

  it("every finish has a label but Standard; big hits get the long climb", () => {
    for (const f of FINISHES) expect(pure.packFinishLabel(f) === "").toBe(f === "standard");
    expect(["gold", "secret", "zeroDay", "prototype"].map(pure.packRiseTier)).toEqual(["spectacle", "spectacle", "spectacle", "spectacle"]);
    expect(["foil", "fullArt", "altArt", "glitch"].map(pure.packRiseTier)).toEqual(["normal", "normal", "normal", "normal"]);
  });

  it("the placeholder art is drawn from the card (not a glyph on a flat background), the same every time", () => {
    const sentinel = cardFaceOf({ cardId: "AG-007", name: "Aegis Sentinel", rarity: "Uncommon" });
    const spike = cardFaceOf({ cardId: "CX-001", name: "Signal Drone", rarity: "Common" });
    const a = pure.packArtSvg(sentinel, "");
    expect(pure.packArtSvg(sentinel, "")).toBe(a);
    expect(pure.packArtSvg(spike, "")).not.toBe(a);
    expect(pure.packArtSvg(sentinel, "alt")).not.toBe(a);
    expect(pure.packArtSvg(sentinel, "illustration")).not.toBe(a);
    expect(a).toMatch(/^<svg /);
    expect((a.match(/<polyline/g) ?? []).length).toBeGreaterThanOrEqual(9);
    expect(a).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});

describe("the pack sounds (the game's own sound system)", () => {
  const voices = ["Cortex", "Aegis", "Swarm", "Null", "Neutral"];
  it("every pack sound is made of sane voices in every faction voice", () => {
    expect(SFX_PACK_KINDS).toEqual(["tear", "flip", "rise", "sparkle", "type", "breach", "glitch", "stamp"]);
    for (const k of SFX_PACK_KINDS) for (const f of voices) {
      const vs = sfxRecipe(k, f, "normal", () => 0.5);
      expect(vs.length).toBeGreaterThan(0);
      for (const v of vs) {
        expect(v.f0).toBeGreaterThan(0);
        expect(v.g).toBeGreaterThan(0);
        expect(v.dur).toBeGreaterThan(0);
      }
    }
  });

  it("a hit's tone always rises, and a big hit climbs higher and longer than a small one", () => {
    const small = sfxRecipe("rise", "Neutral", "normal", () => 0.5);
    const big = sfxRecipe("rise", "Neutral", "spectacle", () => 0.5);
    for (const v of [...small, ...big]) if (v.f1 !== undefined) expect(v.f1).toBeGreaterThan(v.f0);
    const end = (vs: typeof small) => Math.max(...vs.map((v) => (v.delay ?? 0) + v.dur));
    expect(end(big)).toBeGreaterThan(end(small));
    expect(Math.max(...big.map((v) => v.f1 ?? v.f0))).toBeGreaterThan(Math.max(...small.map((v) => v.f1 ?? v.f0)));
  });
});
