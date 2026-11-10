// Render session 62: the pack ceremony, part 3b (the owner's 2026-11-06
// Season 0 brief, section 3, supporting requirements): Open 10's stops and
// the owner-only debug panel. Pinned in Node (the browser run is
// progress/render/evidence/pack-ceremony-check-s62.mjs):
//  1. the stops, over 40 real ten-pack opens (400 packs): a stop is exactly a
//     card above a snap on the ladder (a plain Rare or Mythic, every finish,
//     a Prototype); no plain Common or Uncommon is one; every pack has at
//     least one (its Rare slot); a stop is "big" exactly when its pack is a
//     store full reveal;
//  2. a roll's best step, read off the store's pulls, is the planned
//     reveal's own best build step (300 real openings);
//  3. the debug panel's packs: for every kind it offers, the single pack's
//     best card is that kind and the ten-pack's pack 1 is the same real
//     roll; Gold and above take the big-pull path in the ten;
//  4. the page: the panel is on the demo page only (never on the website,
//     never without the data); the row's stops, Auto and Skip never pass a
//     stop; a stop's time doesn't shrink with the Auto speed; the new
//     keyframe animates only transform.
import { describe, expect, it } from "vitest";
import { EconomyStore, type BulkOpening } from "@ai-tcg/economy";
import { bestStepOf, bulkStopsOf, DEBUG_STEPS, isBulkStop, planBulkReveal, planReveal, REVEAL_LADDER, BULK_TIMINGS } from "../src/packOpening.js";
import { debugSeedFor, openDebugPacks } from "../src/packDemo.js";
import { PACK_CSS, PACK_PAGE_PURE_SOURCE, PACK_PAGE_RUNTIME_SOURCE, renderPackOpeningHtml } from "../src/packPage.js";

const CLOCK = () => new Date("2026-11-10T10:00:00.000Z");

function openBulks(n: number): BulkOpening[] {
  const s = EconomyStore.open(":memory:", { now: CLOCK });
  const o = s.createOwner({ name: "stops-test" }).ownerId;
  for (let i = 0; i < n * 10; i++) s.grantPack(o, "S0", "weeklyChallenge");
  const out: BulkOpening[] = [];
  for (let i = 0; i < n; i++) out.push(s.openPacks(o, 10, { seeds: Array.from({ length: 10 }, (_, k) => 5001 + i * 10 + k) }));
  s.close();
  return out;
}

describe("Open 10's stops (40 real ten-pack opens)", () => {
  const plans = openBulks(40).map(planBulkReveal);

  it("stops on exactly the cards above a snap, never on a plain Common or Uncommon", () => {
    let snaps = 0, stops = 0;
    for (const plan of plans) {
      const list = bulkStopsOf(plan);
      const want = plan.packs.flatMap((p, pack) => p.cards.map((c, idx) => ({ c, pack, idx }))).filter(({ c }) => c.build.step !== "snap");
      expect(list.map((s) => `${s.pack}:${s.idx}`)).toEqual(want.map((w) => `${w.pack}:${w.idx}`));
      for (const p of plan.packs) for (const c of p.cards) {
        const plainLow = c.finish === "standard" && (c.face.rarity === "Common" || c.face.rarity === "Uncommon");
        expect(isBulkStop(c)).toBe(!plainLow);
        if (plainLow) snaps++; else stops++;
      }
    }
    expect(snaps).toBeGreaterThan(1000);
    expect(stops).toBeGreaterThan(400);
  });

  it("every pack has at least one stop (its Rare slot), and every finish above Standard is one", () => {
    for (const plan of plans) {
      for (const p of plan.packs) {
        expect(p.cards.some(isBulkStop)).toBe(true);
        for (const c of p.cards) if (c.finish !== "standard" || c.face.rarity === "Rare" || c.face.rarity === "Mythic") expect(isBulkStop(c)).toBe(true);
      }
    }
  });

  it("a stop is big exactly when its pack is a store full reveal, and carries its build's own times", () => {
    let big = 0;
    for (const plan of plans) {
      for (const s of bulkStopsOf(plan)) {
        const p = plan.packs[s.pack]!, c = p.cards[s.idx]!;
        expect(s.big).toBe(p.fullReveal);
        expect(s.step).toBe(c.build.step);
        expect(s.hitAt).toBe(c.build.hitAt);
        expect(s.hold).toBe(c.build.hold);
        if (s.big) big++;
      }
    }
    expect(big).toBeGreaterThan(0);
  });
});

describe("a roll's best step", () => {
  it("is the planned reveal's best build step, over 300 real openings", () => {
    const s = EconomyStore.open(":memory:", { now: CLOCK });
    const o = s.createOwner({ name: "best-test" }).ownerId;
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      s.grantPack(o, "S0", "weeklyChallenge");
      const opening = s.openPack(o, undefined, { seed });
      const plan = planReveal(opening);
      const top = plan.cards.reduce((a, c) => Math.max(a, REVEAL_LADDER.indexOf(c.build.step)), 0);
      expect(bestStepOf(opening.cards)).toBe(REVEAL_LADDER[top]);
      seen.add(bestStepOf(opening.cards));
    }
    s.close();
    expect(seen.has("snap")).toBe(false);
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
});

describe("the debug panel's packs", () => {
  const d = openDebugPacks();

  it("offers every step above a snap, each once, for one pack and for ten", () => {
    expect(DEBUG_STEPS).toEqual(REVEAL_LADDER.filter((x) => x !== "snap"));
    expect(d.single.map((x) => x.step)).toEqual(DEBUG_STEPS);
    expect(d.bulk.map((x) => x.step)).toEqual(DEBUG_STEPS);
  });

  it("each single pack is a real opening whose best card is its kind, at the first such seed", () => {
    for (const x of d.single) {
      const top = x.reveal.cards.reduce((a, c) => Math.max(a, REVEAL_LADDER.indexOf(c.build.step)), 0);
      expect(REVEAL_LADDER[top], x.step).toBe(x.step);
      expect(x.reveal.seed).toBe(debugSeedFor(x.step));
      expect(x.reveal.jackpot).toBe(false);
      expect(x.reveal.packId).toBeTruthy();
      expect(x.reveal.setBar).toBeTruthy();
    }
  });

  it("the Prototype's best card is its bonus 6th card, with a serial; no other forced pack has a bonus", () => {
    for (const x of d.single) {
      const bonus = x.reveal.cards.filter((c) => c.slot === "bonus");
      if (x.step === "prototype") {
        expect(bonus).toHaveLength(1);
        expect(bonus[0]!.finish).toBe("prototype");
        expect(bonus[0]!.prototype?.serial).toBeGreaterThan(0);
        expect(bonus[0]!.build.takeover?.kind).toBe("prototype");
      } else expect(bonus).toHaveLength(0);
    }
  });

  it("each ten's pack 1 is the same roll as the single, and Gold and above take the big-pull path", () => {
    d.single.forEach((x, i) => {
      const b = d.bulk[i]!.reveal, p1 = b.packs[0]!;
      expect(p1.seed).toBe(x.reveal.seed);
      expect(p1.cards.map((c) => [c.cardId, c.finish])).toEqual(x.reveal.cards.map((c) => [c.cardId, c.finish]));
      expect(b.packs.map((p) => p.seed)).toEqual(Array.from({ length: 10 }, (_, k) => x.reveal.seed + k));
      const big = ["gold", "secret", "prototype", "zeroDay"].includes(x.step);
      expect(p1.fullReveal, x.step).toBe(big);
    });
  });

  it("is the same every run", () => {
    const again = openDebugPacks(["rare", "prototype"]);
    const strip = (v: unknown) => JSON.stringify(v, (k, val) => (k === "copyId" || k === "packId" || k === "fullReveals" ? undefined : val));
    expect(strip(again.single[0])).toBe(strip(d.single[0]));
    expect(strip(again.single[1])).toBe(strip(d.single.find((x) => x.step === "prototype")));
  });
});

describe("the page", () => {
  const d = openDebugPacks(["rare", "gold"]);
  const packs = [{ label: "x", reveal: d.single[0]!.reveal }];

  it("has the debug panel on the demo page only", () => {
    expect(renderPackOpeningHtml({ title: "t", packs, debug: d })).toContain('id="dbg"');
    expect(renderPackOpeningHtml({ title: "t", packs })).not.toContain('id="dbg"');
    // The website never gets one, even if it were handed the data.
    expect(renderPackOpeningHtml({ title: "t", packs, site: true, debug: d })).not.toContain('id="dbg"');
  });

  it("an armed kind replaces only the next open, then disarms", () => {
    const src = PACK_PAGE_RUNTIME_SOURCE;
    expect(src).toMatch(/var forced = takeForced\('single'\)/);
    expect(src).toMatch(/var forced = takeForced\('bulk'\)/);
    expect(src).toMatch(/S\.force = null; dbgMark\(\)/);
  });

  it("the row's face-down cards are its stops; Auto and Skip never pass one", () => {
    const src = PACK_PAGE_RUNTIME_SOURCE;
    // Dealt face down by the stop rule, not by the finish alone.
    expect(src).toMatch(/var held = packRowHeld\(c\);/);
    expect(src).toMatch(/if \(packRowHeld\(c\) && !R\.flipped\[k\]\) out\.push\(k\)/);
    // Auto: the row waits at a stop, and never flips one by itself.
    const autoRow = /function autoRow\(r, first\) \{([\s\S]*?)\n  \}\n/.exec(src)![1]!;
    expect(autoRow).not.toMatch(/flipCard/);
    expect(autoRow).toMatch(/if \(rowDowns\(\)\.length\) \{ bulkHint\(\); return; \}/);
    // Auto in a big pull: a held card waits for the owner's tap.
    expect(src).toMatch(/if \(c && heldCard\(c\) && !S\.revealed\[S\.i\]\)/);
    // Skip: points at a stop still face down, and skips only packs without one.
    expect(src).toMatch(/if \(S\.phase === 'bulk' && rowDowns\(\)\.length\) \{ log\('bulkSkip'/);
    expect(src).toMatch(/if \(S\.skipping && !r\.fullReveal && !r\.cards\.some\(packRowHeld\)\)/);
    // Every stack starts with no card revealed (a second big pull used to
    // inherit the last one's reveals and skip its builds).
    expect(/function dealStack\(\) \{[\s\S]*?S\.revealed = \{\};/.test(src)).toBe(true);
    // A big pull inside Open 10 has no "skip this pack".
    expect(src).toMatch(/skipBtn\.hidden = S\.mode === 'bulk';/);
  });

  it("a stop keeps its full length at every Auto speed", () => {
    const pure = new Function(`${PACK_PAGE_PURE_SOURCE}; return { packFastDuration, packRowHeld };`)() as {
      packFastDuration: (cards: unknown[], sparks: boolean, T: typeof BULK_TIMINGS, speed: number) => number;
      packRowHeld: (c: unknown) => boolean;
    };
    const rare = d.single[0]!.reveal.cards.find((c) => c.build.step === "rare")!;
    const snap = d.single[0]!.reveal.cards.find((c) => c.build.step === "snap")!;
    expect(pure.packRowHeld(rare)).toBe(true);
    expect(pure.packRowHeld(snap)).toBe(false);
    const five = [snap, snap, snap, snap, rare];
    const plain = [snap, snap, snap, snap, snap];
    for (const v of [1, 2, 4]) {
      const diff = pure.packFastDuration(five, false, BULK_TIMINGS, v) - pure.packFastDuration(plain, false, BULK_TIMINGS, v);
      expect(diff).toBe(rare.build.hitAt + rare.build.hold);
    }
  });

  it("the nudge keyframe animates only transform", () => {
    const m = /@keyframes nudge \{([^@]*?)\}\s*(?=@|\.|$|\/)/s.exec(PACK_CSS);
    expect(m).not.toBeNull();
    for (const p of [...m![1]!.matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1])) expect(["transform", "opacity"]).toContain(p);
  });
});
