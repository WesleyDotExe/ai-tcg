// Render session 25: the pack-opening reveal, slice 2, the ten-pack open
// (owner 2026-10-05 and 2026-10-18: fast flips with skip and speed-up
// controls, full reveals only for the big pulls, a summary grid at the end).
// The page is driven in a real browser by
// progress/render/evidence/pack-bulk-check.mjs; these tests pin what can be
// pinned in Node:
//  1. over 40 real ten-pack opens (400 packs), the plan holds exactly the
//     store's packs, the summary grid holds every copy once, its NEW badges
//     are one per new collection entry, and it runs best first;
//  2. the showcase opens the same two real ten-packs every run (one with no
//     big pull, one with one), and the committed page holds them;
//  3. the page embeds them, the fast-sequence timings and the speeds;
//  4. the pure helpers: the finish order, the pack labels, the fast pack's
//     length at each speed;
//  5. the placeholder art's gradient is the card's own (the shared id made
//     every card on a page paint the first card's background).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EconomyStore, FINISHES, FULL_ART_OR_BETTER, type BulkOpening } from "@ai-tcg/economy";
import { BULK_SPEEDS, BULK_TIMINGS, cardFaceOf, entryKeyOf, planBulkReveal, planReveal } from "../src/packOpening.js";
import { BULK_SHOWCASE, openBulkShowcase, openShowcase } from "../src/packDemo.js";
import { renderPackOpeningHtml, PACK_PAGE_PURE_SOURCE } from "../src/packPage.js";

function openBulks(n: number): BulkOpening[] {
  const s = EconomyStore.open(":memory:", { now: () => new Date("2026-10-18T10:00:00.000Z") });
  const o = s.createOwner({ name: "bulk-test" }).ownerId;
  for (let i = 0; i < n * 10; i++) s.grantPack(o, "S0", "weeklyChallenge");
  const out: BulkOpening[] = [];
  for (let i = 0; i < n; i++) out.push(s.openPacks(o, 10, { seeds: Array.from({ length: 10 }, (_, k) => 1 + i * 10 + k) }));
  s.close();
  return out;
}

const RANK = ["zeroDay", "prototype", "tournament", "secret", "gold", "glitch", "altArt", "fullArt", "foil", "standard"];

describe("the ten-pack plan shows only what was rolled (40 real opens, 400 packs)", () => {
  const bulks = openBulks(40);
  const plans = bulks.map(planBulkReveal);

  it("holds the store's packs in order, each planned as a single pack would be, and the store's summary", () => {
    for (const [i, plan] of plans.entries()) {
      const b = bulks[i]!;
      expect(plan.packs).toEqual(b.packs.map(planReveal));
      expect(plan.summary).toEqual(b.summary);
      // The packs that leave the fast sequence are exactly the store's.
      expect(plan.packs.filter((p) => p.fullReveal).map((p) => p.packId)).toEqual(b.summary.fullReveals);
      expect(planBulkReveal(b)).toEqual(plan);
    }
    // Both kinds of open occur, so the rule is tested both ways.
    expect(plans.some((p) => p.summary.fullReveals.length > 0)).toBe(true);
    expect(plans.some((p) => p.summary.fullReveals.length === 0)).toBe(true);
  });

  it("the summary grid holds every copy exactly once, folded by card and finish", () => {
    for (const [i, plan] of plans.entries()) {
      const copies = bulks[i]!.packs.flatMap((p) => p.cards);
      expect(plan.tiles.reduce((n, t) => n + t.count, 0)).toBe(copies.length);
      const count = (cardId: string, finish: string) => copies.filter((c) => c.cardId === cardId && c.finish === finish).length;
      for (const t of plan.tiles) {
        if (t.prototype) expect(t.count).toBe(1);
        else expect(plan.tiles.filter((x) => x.cardId === t.cardId && x.finish === t.finish && !x.prototype).reduce((n, x) => n + x.count, 0)).toBe(count(t.cardId, t.finish));
        // Every pack it names really holds the card in that finish.
        for (const pk of t.packs) expect(bulks[i]!.packs[pk - 1]!.cards.some((c) => c.cardId === t.cardId && c.finish === t.finish)).toBe(true);
        expect(t.hit).toBe(FULL_ART_OR_BETTER.includes(t.finish));
        expect(t.ownedAfter).toBe(Math.max(...copies.filter((c) => c.cardId === t.cardId).map((c) => c.ownedAfter)));
      }
    }
  });

  it("one NEW badge per collection entry the owner lacked, never more than the store found", () => {
    for (const [i, plan] of plans.entries()) {
      const copies = bulks[i]!.packs.flatMap((p) => p.cards);
      const newEntries = new Set(copies.filter((c) => c.isNew).map(entryKeyOf));
      expect(plan.tiles.filter((t) => t.isNew).length).toBe(newEntries.size);
      // The store counts new cards by card; an entry count is never fewer.
      expect(newEntries.size).toBeGreaterThanOrEqual(bulks[i]!.summary.newCards);
      expect(new Set(plan.tiles.filter((t) => t.isNew).map(entryKeyOf)).size).toBe(newEntries.size);
    }
    // A later open by the same owner finds fewer new cards than the first.
    expect(plans[39]!.tiles.filter((t) => t.isNew).length).toBeLessThan(plans[0]!.tiles.filter((t) => t.isNew).length);
  });

  it("a new card pulled twice in one pack, plain and Foil, gets one badge: one entry, two tiles", () => {
    // Rare in real packs (none in these 400), so built from a real opening:
    // the store marks both copies new (nothing was held before the pack).
    const real = bulks[0]!;
    const pack = real.packs[0]!;
    const plain = pack.cards.find((c) => c.isNew && c.finish === "standard")!;
    const foil = { ...plain, copyId: plain.copyId + "-foil", finish: "foil" as const, slot: "shine" as const, ownedAfter: plain.ownedAfter + 1 };
    const doubled: BulkOpening = { ...real, packs: [{ ...pack, cards: [...pack.cards, foil] }, ...real.packs.slice(1)] };
    const tiles = planBulkReveal(doubled).tiles.filter((t) => t.cardId === plain.cardId);
    expect(tiles.map((t) => t.finish).sort()).toEqual(["foil", "standard"]);
    expect(tiles.filter((t) => t.isNew)).toHaveLength(1);
  });

  it("runs best first: finish, then rarity", () => {
    const rar = ["Mythic", "Rare", "Uncommon", "Common"];
    for (const plan of plans) {
      for (let k = 1; k < plan.tiles.length; k++) {
        const a = plan.tiles[k - 1]!, b = plan.tiles[k]!;
        const fa = RANK.indexOf(a.finish), fb = RANK.indexOf(b.finish);
        expect(fa).toBeLessThanOrEqual(fb);
        if (fa === fb) expect(rar.indexOf(a.face.rarity)).toBeLessThanOrEqual(rar.indexOf(b.face.rarity));
      }
    }
  });
});

describe("the ten-pack showcase", () => {
  const a = openBulkShowcase();
  const strip = (x: unknown) => JSON.stringify(x, (k, v) => (k === "copyId" || k === "packId" || k === "fullReveals" ? undefined : v));

  it("opens one ten without a big pull and one with, both with a smaller hit", () => {
    expect(a.map((s) => s.label)).toEqual(BULK_SHOWCASE.map((w) => w.label));
    const [plain, big] = a.map((s) => s.reveal);
    expect(plain!.packs).toHaveLength(10);
    expect(plain!.packs.some((p) => p.fullReveal)).toBe(false);
    expect(plain!.packs.some((p) => p.sparks)).toBe(true);
    expect(big!.packs.filter((p) => p.fullReveal).length).toBeGreaterThanOrEqual(1);
    expect(big!.packs.filter((p) => !p.fullReveal && p.sparks).length).toBeGreaterThanOrEqual(1);
  });

  it("opens the same tens every run (only the store's random ids differ)", () => {
    expect(strip(openBulkShowcase())).toBe(strip(a));
  });

  it("the committed page holds the same tens as a fresh build", () => {
    const committed = readFileSync(new URL("../output/pack-opening.html", import.meta.url), "utf8");
    const json = /<script type="application\/json" id="pack-data">([\s\S]*?)<\/script>/.exec(committed)![1]!;
    expect(strip(JSON.parse(json).bulks)).toBe(strip(a));
  });

  it("the page embeds the tens, the fast-sequence timings and the speeds", () => {
    const html = renderPackOpeningHtml({ title: "t", packs: openShowcase().slice(0, 1), bulks: a });
    const json = /<script type="application\/json" id="pack-data">([\s\S]*?)<\/script>/.exec(html)![1]!;
    expect(JSON.parse(json).bulks).toEqual(JSON.parse(JSON.stringify(a)));
    const tm = JSON.parse(/<script type="application\/json" id="pack-timings">([\s\S]*?)<\/script>/.exec(html)![1]!);
    expect(tm.bulk).toEqual(BULK_TIMINGS);
    expect(tm.speeds).toEqual([...BULK_SPEEDS]);
    // A page built without tens still works (it offers none).
    const none = renderPackOpeningHtml({ title: "t", packs: openShowcase().slice(0, 1) });
    expect(JSON.parse(/<script type="application\/json" id="pack-data">([\s\S]*?)<\/script>/.exec(none)![1]!).bulks).toEqual([]);
  });
});

const pure = new Function(`${PACK_PAGE_PURE_SOURCE}; return { packFinishOrder, packListLabel, packFastDuration, packArtSvg };`)() as {
  packFinishOrder: () => string[];
  packListLabel: (packs: number[]) => string;
  packFastDuration: (cards: { faceDown: boolean }[], sparks: boolean, T: typeof BULK_TIMINGS, speed: number) => number;
  packArtSvg: (face: ReturnType<typeof cardFaceOf>, variant: string) => string;
};

describe("the ten-pack page's pure helpers", () => {
  it("the finish order names every finish once, best first, as the plan sorts", () => {
    expect([...pure.packFinishOrder()].sort()).toEqual([...FINISHES].sort());
    expect(pure.packFinishOrder()).toEqual(RANK);
  });

  it("names the packs a tile came from", () => {
    expect(pure.packListLabel([3])).toBe("pack 3");
    expect(pure.packListLabel([2, 7])).toBe("packs 2, 7");
    expect(pure.packListLabel([1, 4, 5, 8, 9])).toBe("packs 1, 4, 5 +2");
  });

  it("a fast pack is quick, quicker at each speed, and holds longer on a hit", () => {
    const plain = Array.from({ length: 5 }, () => ({ faceDown: false }));
    const withFoil = [...plain.slice(0, 4), { faceDown: true }];
    const d1 = pure.packFastDuration(plain, false, BULK_TIMINGS, 1);
    expect(d1).toBeLessThan(2000);
    expect(pure.packFastDuration(plain, false, BULK_TIMINGS, 2)).toBeCloseTo(d1 / 2);
    expect(pure.packFastDuration(plain, false, BULK_TIMINGS, 4)).toBeCloseTo(d1 / 4);
    expect(pure.packFastDuration(withFoil, false, BULK_TIMINGS, 1)).toBe(d1 + BULK_TIMINGS.flip);
    expect(pure.packFastDuration(withFoil, true, BULK_TIMINGS, 1) - pure.packFastDuration(withFoil, false, BULK_TIMINGS, 1)).toBe(BULK_TIMINGS.hitHold - BULK_TIMINGS.hold);
    // Ten everyday packs (no hit) at 4x take about 4 s; even ten that all
    // hold a hit stay under 6.5 s. The browser check measures about 5 s from
    // the first tap to the summary for the everyday showcase ten.
    expect(10 * pure.packFastDuration(plain, false, BULK_TIMINGS, 4)).toBeLessThan(4500);
    expect(10 * pure.packFastDuration(withFoil, true, BULK_TIMINGS, 4)).toBeLessThan(6500);
  });

  it("each card's art paints with its own gradient, so cards on one page don't share a background", () => {
    const faces = ["AG-007", "CX-001", "SW-001", "NL-001"].map((id) => cardFaceOf({ cardId: id, name: id, rarity: "Common" }));
    const ids = faces.map((f) => /<radialGradient id="([^"]+)"/.exec(pure.packArtSvg(f, ""))![1]!);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of faces) {
      const svg = pure.packArtSvg(f, "");
      const id = /<radialGradient id="([^"]+)"/.exec(svg)![1]!;
      expect(svg).toContain(`fill="url(#${id})"`);
    }
    // Alt Art and the illustration are their own compositions: their own ids.
    const g = (v: string) => /<radialGradient id="([^"]+)"/.exec(pure.packArtSvg(faces[0]!, v))![1]!;
    expect(new Set([g(""), g("alt"), g("illustration")]).size).toBe(3);
  });
});
