// Render session 61: the pack ceremony, part 3 (the owner's 2026-11-06
// Season 0 brief, section 3, beats 3 and 4): the takeovers and the
// afterglow. Pinned in Node (the browser run is
// progress/render/evidence/pack-ceremony-check-s61.mjs):
//  1. the takeovers: a Prototype and a Zero-Day keep the build every held
//     card has, then their takeover replaces the flip; the tap-to-hit time
//     still grows up the whole ladder (the Zero-Day used to hit sooner than
//     a Gold); the Prototype's beats are in order and its serial counts up
//     to itself;
//  2. the set bar, over 300 real store openings one pack at a time: the
//     bar's `before` is exactly the binder's base count read before the
//     open, `after` the count after, and it ticks once per place filled;
//  3. the afterglow plan: every card is dealt, one stamp per NEW card in
//     reveal order after the fan is down, then the bar's ticks, each a
//     little higher;
//  4. the page reads the takeover, the stamps and the ticks from the plan,
//     and its new keyframes animate only transform and opacity.
import { describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import {
  AFTERGLOW,
  afterglowPlanOf,
  planReveal,
  PROTOTYPE_TAKEOVER,
  REVEAL_LADDER,
  revealBuildOf,
  serialCountUp,
  withSetBar,
  ZERO_DAY_TIMINGS,
  type PackReveal,
  type RevealKind,
} from "../src/packOpening.js";
import { PACK_CSS, PACK_PAGE_RUNTIME_SOURCE, renderPackOpeningHtml } from "../src/packPage.js";
import { sfxRecipe } from "../src/soundFx.js";

const T0 = Date.parse("2026-11-10T10:00:00.000Z");

describe("the takeovers", () => {
  const proto = revealBuildOf("prototype", "Rare", "Cortex");
  const zd = revealBuildOf("zeroDay", "Mythic", "Null");

  it("only a Prototype and a Zero-Day take over; every other build hits when it lands", () => {
    expect(proto.takeover?.kind).toBe("prototype");
    expect(zd.takeover?.kind).toBe("zeroDay");
    for (const k of ["foil", "fullArt", "altArt", "glitch", "gold", "secret"] as RevealKind[]) {
      const b = revealBuildOf(k, "Mythic", "Aegis");
      expect(b.takeover, k).toBeNull();
      expect(b.hitAt, k).toBe(b.timeline.landAt);
    }
    expect(revealBuildOf("plain", "Common", "Swarm").hitAt).toBe(revealBuildOf("plain", "Common", "Swarm").timeline.landAt);
  });

  it("a takeover starts when the build hands over (after all four glow stages) and hits inside itself", () => {
    for (const b of [proto, zd]) {
      expect(b.stages).toBe(4);
      expect(b.timeline.stages).toHaveLength(4);
      expect(b.hitAt).toBe(b.timeline.flipAt + b.takeover!.hitAt);
      expect(b.takeover!.hitAt).toBeLessThan(b.takeover!.endAt);
    }
  });

  it("tap to hit grows up the whole ladder, the Zero-Day last (it used to hit before a Gold)", () => {
    const order = REVEAL_LADDER.map((s) => (s === "snap" ? revealBuildOf("plain", "Common") : s === "rare" ? revealBuildOf("plain", "Rare") : s === "mythic" ? revealBuildOf("plain", "Mythic") : revealBuildOf(s as RevealKind, "Rare", "Cortex")));
    for (let i = 1; i < order.length; i++) expect(order[i]!.hitAt, `${order[i - 1]!.step} < ${order[i]!.step}`).toBeGreaterThan(order[i - 1]!.hitAt);
    // The old Zero-Day: straight to the terminal, no build.
    const oldZd = ZERO_DAY_TIMINGS.black + "ZERO-DAY DETECTED".length * ZERO_DAY_TIMINGS.typePerChar + ZERO_DAY_TIMINGS.breach;
    expect(oldZd).toBeLessThan(revealBuildOf("gold", "Rare").hitAt);
    expect(zd.hitAt).toBeGreaterThan(proto.hitAt);
    // The Prototype's takeover alone is longer than a plain Rare's whole build.
    expect(proto.takeover!.hitAt).toBeGreaterThan(revealBuildOf("plain", "Rare").hitAt * 2);
  });

  it("the Prototype's beats: black, bloom, the flip, the marker stamp, the count, the hit, the fade", () => {
    const t = proto.takeover!;
    expect(t.beats.map((b) => b.beat)).toEqual(["black", "bloom", "flip", "marker", "count", "hit", "fade"]);
    for (let i = 1; i < t.beats.length; i++) expect(t.beats[i]!.at).toBeGreaterThan(t.beats[i - 1]!.at);
    expect(t.beats.find((b) => b.beat === "hit")!.at).toBe(t.hitAt);
    expect(t.endAt).toBe(t.hitAt + PROTOTYPE_TAKEOVER.afterHold + PROTOTYPE_TAKEOVER.fade);
  });

  it("the serial counts up to itself, strictly rising, never past the tick cap", () => {
    expect(serialCountUp(1)).toEqual([1]);
    expect(serialCountUp(5)).toEqual([1, 2, 3, 4, 5]);
    for (const s of [7, 14, 15, 25, 50, 99, 250]) {
      const c = serialCountUp(s);
      expect(c[c.length - 1], String(s)).toBe(s);
      expect(c.length).toBeLessThanOrEqual(PROTOTYPE_TAKEOVER.countMaxTicks);
      for (let i = 1; i < c.length; i++) expect(c[i]!).toBeGreaterThan(c[i - 1]!);
    }
    expect(serialCountUp(0)).toEqual([]);
  });
});

describe("the set bar over 300 real openings, one pack at a time", () => {
  const s = EconomyStore.open(":memory:", { now: () => new Date(T0) });
  const o = s.createOwner({ name: "afterglow-test" }).ownerId;
  const rows: { reveal: PackReveal; before: number; after: number; total: number }[] = [];
  for (let i = 0; i < 300; i++) {
    s.grantPack(o, "S0", "weeklyChallenge");
    const before = s.binder(o, "S0").base.held;
    const opening = s.openPack(o, undefined, { seed: 7001 + i });
    const base = s.binder(o, "S0").base;
    rows.push({ reveal: withSetBar(planReveal(opening), base), before, after: base.held, total: base.total });
  }
  s.close();

  it("before is the binder's count before the open; after the count after; one place per card filled", () => {
    for (const r of rows) {
      const bar = r.reveal.setBar!;
      expect(bar.setCode).toBe("S0");
      expect(bar.total).toBe(r.total);
      expect(bar.before).toBe(r.before);
      expect(bar.after).toBe(r.after);
      expect(bar.filled.length).toBe(r.after - r.before);
      expect(new Set(bar.filled).size).toBe(bar.filled.length);
    }
    // The run sees packs that fill many places and, late on, packs that fill none.
    expect(rows[0]!.reveal.setBar!.filled.length).toBeGreaterThanOrEqual(4);
    expect(rows.some((r) => r.reveal.setBar!.filled.length === 0)).toBe(true);
  });

  it("every card filled is a NEW card of the pack", () => {
    for (const r of rows) for (const id of r.reveal.setBar!.filled) expect(r.reveal.cards.some((c) => c.cardId === id && c.isNew)).toBe(true);
  });

  it("no binder answer, no bar", () => {
    const r = rows[0]!.reveal;
    expect(withSetBar({ ...r, setBar: undefined }, null).setBar).toBeUndefined();
  });

  it("the afterglow plan over the same packs: every card dealt, a stamp per NEW card after the fan, then the ticks", () => {
    for (const { reveal } of rows) {
      const p = afterglowPlanOf(reveal);
      expect(p.deal.map((d) => d.idx)).toEqual(reveal.cards.map((_, i) => i));
      const fanDown = p.deal[p.deal.length - 1]!.at;
      expect(p.stamps.map((x) => x.idx)).toEqual(reveal.cards.flatMap((c, i) => (c.isNew ? [i] : [])));
      for (const st of p.stamps) expect(st.at).toBeGreaterThan(fanDown);
      for (let i = 1; i < p.stamps.length; i++) expect(p.stamps[i]!.at - p.stamps[i - 1]!.at).toBe(AFTERGLOW.stampGap);
      const bar = reveal.setBar!;
      expect(p.ticks.map((t) => t.held)).toEqual(bar.filled.map((_, i) => bar.before + i + 1));
      if (p.ticks.length) expect(p.ticks[p.ticks.length - 1]!.held).toBe(bar.after);
      for (const t of p.ticks) expect(t.at).toBeGreaterThan(p.barAt);
      if (p.stamps.length) expect(p.barAt).toBeGreaterThan(p.stamps[p.stamps.length - 1]!.at);
      for (let i = 1; i < p.ticks.length; i++) expect(p.ticks[i]!.pitch).toBeGreaterThan(p.ticks[i - 1]!.pitch);
      expect(p.doneAt).toBeGreaterThanOrEqual(p.barAt);
    }
  });
});

describe("the page", () => {
  it("plays the takeover and the afterglow from the plan, not its own numbers", () => {
    expect(PACK_PAGE_RUNTIME_SOURCE).toContain("to = b.takeover");
    expect(PACK_PAGE_RUNTIME_SOURCE).toContain("to.beats.forEach");
    expect(PACK_PAGE_RUNTIME_SOURCE).toContain("r.afterglow");
    expect(PACK_PAGE_RUNTIME_SOURCE).toContain("plan.stamps.forEach");
    expect(PACK_PAGE_RUNTIME_SOURCE).toContain("plan.ticks.forEach");
    expect(PACK_PAGE_RUNTIME_SOURCE).toContain("r.setBar");
    const html = renderPackOpeningHtml({ title: "t", packs: [] });
    expect(html).toContain('id="pt"');
    expect(html).toContain('"afterglow"');
  });

  it("the new keyframes animate only transform and opacity", () => {
    for (const name of ["ptrays", "ptbloom", "newslam", "fanin", "barpulse"]) {
      const m = new RegExp(`@keyframes ${name} \\{([^@]*?)\\}\\s*(?=@|\\.|$|/)`, "s").exec(PACK_CSS);
      expect(m, name).not.toBeNull();
      const props = [...m![1]!.matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]);
      for (const p of props) expect(["transform", "opacity"], `${name}: ${p}`).toContain(p);
    }
  });

  it("the set bar's tick and the Prototype's count tick are their own sounds, and the tick takes its pitch", () => {
    const rand = () => 0.5;
    const lo = sfxRecipe("tick", "Neutral", "normal", rand, { pitch: 1 });
    const hi = sfxRecipe("tick", "Neutral", "normal", rand, { pitch: 1.5 });
    expect(lo.length).toBeGreaterThan(0);
    expect(hi[0].f0).toBeCloseTo(lo[0].f0 * 1.5, 5);
    const fan = sfxRecipe("fanfare", "Cortex", "spectacle", rand, {});
    expect(fan.length).toBeGreaterThanOrEqual(4);
  });
});
