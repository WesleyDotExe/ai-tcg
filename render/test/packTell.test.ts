// Render session 58: the pack ceremony, part 1 (the owner's 2026-11-06
// Season 0 brief, section 3, beats 1 and 2): the sealed pack's tells and
// the tear. Pinned in Node (the browser run is
// progress/render/evidence/pack-ceremony-check-s58.mjs):
//  1. over 1,000 real store openings: the best card is the best finish in
//     the pack; the backdrop never shows a rung above the best card (no
//     over-promise, ever), shows exactly one rung lower on the
//     under-promised packs, and those are about one in four of the packs
//     that hold more than a plain card; the burst is always the best card's
//     own rung; the tells are a pure function of the opening (planned twice,
//     the same), read from its seed, not drawn;
//  2. every reveal kind sits on a rung, in the summary's best-first order;
//  3. the page's helpers: the tear follows the cursor 1:1 and holds when let
//     go, the drag speed, the scraps, the burst growing with the rung, the
//     pack plate the same for every pack of a set;
//  4. the rip sound's level: silent when still, louder and brighter with
//     speed, saturating; the burst sound bigger with the tier;
//  5. the page ships the backdrops, and the sealed pack's markup reads
//     nothing from the pack's contents (only the backdrop does).
import { describe, expect, it } from "vitest";
import { EconomyStore, type PackOpening } from "@ai-tcg/economy";
import {
  bestCardIndex,
  planReveal,
  RUNG_OF,
  TELL_BACKDROPS,
  TELL_RUNGS,
  UNDER_PROMISE_ONE_IN,
  underPromises,
  type RevealKind,
} from "../src/packOpening.js";
import { PACK_CSS, PACK_PAGE_PURE_SOURCE, PACK_PAGE_RUNTIME_SOURCE, renderPackOpeningHtml } from "../src/packPage.js";
import { sfxRecipe, sfxScrubLevel, SFX_SCRUB_FULL } from "../src/soundFx.js";

const T0 = Date.parse("2026-11-05T10:00:00.000Z");

function openMany(n: number): PackOpening[] {
  const s = EconomyStore.open(":memory:", { now: () => new Date(T0) });
  const o = s.createOwner({ name: "tell-test" }).ownerId;
  for (let i = 0; i < n; i++) s.grantPack(o, "S0", "weeklyChallenge");
  const out: PackOpening[] = [];
  for (let i = 0; i < n / 10; i++) out.push(...s.openPacks(o, 10, { seeds: Array.from({ length: 10 }, (_, k) => 5001 + i * 10 + k) }).packs);
  s.close();
  return out;
}

const BEST_FIRST = ["zeroDay", "prototype", "tournament", "secret", "gold", "glitch", "altArt", "fullArt", "foil", "standard"];

describe("the sealed pack's tells over 1,000 real store openings", () => {
  const openings = openMany(1000);
  const plans = openings.map(planReveal);

  it("the best card is the pack's best finish; the burst is its own rung, never lowered", () => {
    for (const p of plans) {
      const t = p.tell;
      const best = p.cards[t.bestIndex]!;
      const top = Math.min(...p.cards.map((c) => BEST_FIRST.indexOf(c.finish)));
      expect(BEST_FIRST.indexOf(best.finish)).toBe(top);
      expect(t.best).toBe(best.reveal);
      expect(t.rung).toBe(TELL_RUNGS.indexOf(RUNG_OF[best.reveal]));
      expect(t.burst.rung).toBe(TELL_RUNGS[t.rung]);
      expect(t.bestFaction).toBe(best.face.faction);
    }
  });

  it("the backdrop never over-promises; an under-promise is exactly one rung low; about 1 in 4 of the packs above plain", () => {
    let above = 0, under = 0;
    const seen = new Set<string>();
    for (const p of plans) {
      const t = p.tell;
      expect(t.backdropRung).toBeLessThanOrEqual(t.rung);
      expect(t.backdropRung).toBe(t.underPromise ? t.rung - 1 : t.rung);
      expect(t.backdrop).toBe(TELL_RUNGS[t.backdropRung]);
      if (t.rung === 0) expect(t.underPromise).toBe(false);
      else {
        above++;
        if (t.underPromise) under++;
      }
      // A hit pack's sparks still come exactly with a hit (unchanged).
      expect(p.sparks).toBe(p.cards.some((c) => c.hit));
      seen.add(`${t.rung}>${t.backdropRung}`);
    }
    expect(above).toBeGreaterThan(300);
    const rate = under / above;
    expect(rate).toBeGreaterThan(1 / UNDER_PROMISE_ONE_IN - 0.07);
    expect(rate).toBeLessThan(1 / UNDER_PROMISE_ONE_IN + 0.07);
    // The backdrop's colour alone doesn't settle it: a rung shows up both
    // as itself and as an under-promise of the rung above.
    expect(seen.has("1>1") && seen.has("2>1")).toBe(true);
  });

  it("the tells are a pure function of the opening: read from its seed, the same when planned again", () => {
    for (const [i, o] of openings.entries()) {
      expect(planReveal(o).tell).toEqual(plans[i]!.tell);
      expect(plans[i]!.tell.underPromise).toBe(plans[i]!.tell.rung > 0 && underPromises(o.seed));
    }
    expect(underPromises(12345)).toBe(underPromises(12345));
  });

  it("ties between equal finishes go to the higher rarity, then the later card", () => {
    const c = (finish: string, rarity: string) => ({ finish, face: { rarity } }) as never;
    expect(bestCardIndex([c("standard", "Common"), c("standard", "Rare"), c("standard", "Uncommon")])).toBe(1);
    expect(bestCardIndex([c("foil", "Rare"), c("foil", "Rare")])).toBe(1);
    expect(bestCardIndex([c("gold", "Common"), c("foil", "Mythic")])).toBe(0);
  });
});

describe("the rungs", () => {
  it("every reveal kind sits on a rung, never below a kind under it in the best-first order", () => {
    const order: RevealKind[] = ["plain", "foil", "fullArt", "altArt", "glitch", "gold", "secret", "prototype", "zeroDay"];
    const rungs = order.map((k) => TELL_RUNGS.indexOf(RUNG_OF[k]));
    for (let i = 1; i < rungs.length; i++) expect(rungs[i]).toBeGreaterThanOrEqual(rungs[i - 1]!);
    expect(rungs[0]).toBe(0);
    expect(rungs[rungs.length - 1]).toBe(TELL_RUNGS.length - 1);
  });
  it("each rung's backdrop pulses faster and harder than the one below", () => {
    for (let i = 1; i < TELL_RUNGS.length; i++) {
      const a = TELL_BACKDROPS[TELL_RUNGS[i - 1]!], b = TELL_BACKDROPS[TELL_RUNGS[i]!];
      expect(b.pulseMs).toBeLessThan(a.pulseMs);
      expect(b.pulse).toBeGreaterThan(a.pulse);
    }
  });
});

const pure = new Function(`${PACK_PAGE_PURE_SOURCE}; return { packTearStep, packDragSpeed, packScrapCount, packBurstPlan, packPlateSvg };`)() as {
  packTearStep: (prev: number, dx: number, width: number) => number;
  packDragSpeed: (prev: number, dx: number, ms: number) => number;
  packScrapCount: (dx: number) => number;
  packBurstPlan: (size: number, rung: number) => { scale: number; ms: number; motes: number; flash: number; ring: boolean };
  packPlateSvg: (setCode: string) => string;
};

describe("the tear and the burst (the page's helpers)", () => {
  it("the tear's head moves with the cursor, from wherever it was held, and never back", () => {
    const w = 300, cut = w * 0.88;
    let p = pure.packTearStep(0, cut * 0.3, w);
    expect(p).toBeCloseTo(0.3, 5);
    p = pure.packTearStep(p, -50, w); // dragging back holds it
    expect(p).toBeCloseTo(0.3, 5);
    p = pure.packTearStep(p, cut * 0.2, w); // picked up again: carries on from 30%
    expect(p).toBeCloseTo(0.5, 5);
    expect(pure.packTearStep(p, 10_000, w)).toBe(1);
  });
  it("the drag speed is smoothed; scraps follow the distance moved, capped", () => {
    expect(pure.packDragSpeed(0, 20, 10)).toBeCloseTo(0.9, 3);
    expect(pure.packDragSpeed(2, 0, 16)).toBeCloseTo(1.1, 3);
    expect(pure.packDragSpeed(0, 30, 0)).toBeCloseTo(3.375, 3); // a zero-time event counts as 4 ms
    expect(pure.packScrapCount(0)).toBe(0);
    expect(pure.packScrapCount(-30)).toBe(0);
    expect(pure.packScrapCount(15)).toBe(2);
    expect(pure.packScrapCount(400)).toBe(6);
  });
  it("the burst grows with the best card's rung: wider, longer, more motes, a stronger flash; the ring from Foil up", () => {
    const sizes = [0.35, 0.5, 0.7, 0.85, 1];
    const plans = sizes.map((s, r) => pure.packBurstPlan(s, r));
    for (let i = 1; i < plans.length; i++) {
      for (const k of ["scale", "ms", "motes", "flash"] as const) expect(plans[i]![k]).toBeGreaterThan(plans[i - 1]![k]);
    }
    expect(plans.map((p) => p.ring)).toEqual([false, true, true, true, true]);
  });
  it("the pack plate is the same for every pack of a set (it never hints at what a pack holds)", () => {
    expect(pure.packPlateSvg("S0")).toBe(pure.packPlateSvg("S0"));
    expect(pure.packPlateSvg("S0")).toContain("<svg");
    expect(pure.packPlateSvg("S0")).not.toBe(pure.packPlateSvg("S1"));
  });
});

describe("the rip and the burst sounds", () => {
  it("the rip: silent when still, louder and brighter with speed, saturating at full", () => {
    expect(sfxScrubLevel(0)).toEqual({ gain: 0, freq: 1400, crackle: 0 });
    const slow = sfxScrubLevel(0.3), fast = sfxScrubLevel(1.2);
    expect(fast.gain).toBeGreaterThan(slow.gain);
    expect(fast.freq).toBeGreaterThan(slow.freq);
    expect(fast.crackle).toBeGreaterThan(slow.crackle);
    expect(sfxScrubLevel(SFX_SCRUB_FULL * 3)).toEqual(sfxScrubLevel(SFX_SCRUB_FULL));
    expect(sfxScrubLevel(-1)).toEqual(sfxScrubLevel(0));
  });
  it("the burst: a bigger tier is louder, lower and longer", () => {
    const end = (vs: ReturnType<typeof sfxRecipe>) => Math.max(...vs.map((v) => (v.delay ?? 0) + v.dur));
    const small = sfxRecipe("burst", "Cortex", "subtle", () => 0.5), mid = sfxRecipe("burst", "Cortex", "normal", () => 0.5), big = sfxRecipe("burst", "Cortex", "spectacle", () => 0.5);
    expect(end(big)).toBeGreaterThan(end(mid));
    expect(end(mid)).toBeGreaterThan(end(small));
    expect(big.length).toBeGreaterThan(small.length);
    expect(big[0]!.f1!).toBeLessThan(small[0]!.f1!);
  });
});

describe("the page", () => {
  const plans = openMany(20).map(planReveal);
  const page = renderPackOpeningHtml({ title: "t", packs: plans.map((r, i) => ({ label: `p${i}`, reveal: r })) });
  it("ships the backdrops; every pack carries its tell", () => {
    const tm = JSON.parse(/<script type="application\/json" id="pack-timings">(.*?)<\/script>/s.exec(page)![1]!);
    expect(tm.backdrops).toEqual(TELL_BACKDROPS);
    const data = JSON.parse(/<script type="application\/json" id="pack-data">(.*?)<\/script>/s.exec(page)![1]!);
    for (const [i, p] of data.packs.entries()) expect(p.reveal.tell).toEqual(plans[i]!.tell);
  });
  it("the sealed pack's markup reads nothing from the tell; only the backdrop and the leak's colour do", () => {
    const sealed = PACK_PAGE_RUNTIME_SOURCE.slice(PACK_PAGE_RUNTIME_SOURCE.indexOf("function sealed("), PACK_PAGE_RUNTIME_SOURCE.indexOf("// A tap (or Enter / Space) finishes the tear"));
    const html = sealed.slice(sealed.indexOf("var wrap ="), sealed.indexOf("hint.innerHTML"));
    expect(html).not.toMatch(/tell|sparks|jackpot|best|hit|cards\.length/);
    expect(sealed).toContain("setBackdrop(tell.backdrop)");
    expect(PACK_CSS).toMatch(/\.bd \{/);
    expect(PACK_CSS).toMatch(/@property --tp/);
  });
});
