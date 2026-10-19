// Victory boasts, render slices 1-2: the victory grammar, the spec format
// and the four starter boasts (Shield Slam; slice 2: Hive Burst, Void
// Collapse, Data Cascade), and the cosmetics switch. Four layers:
//  1. the specs: valid, in step with the economy catalogue's starter boasts,
//     and boastIdFor plays the record's boast or the winner's faction
//     starter, never one of its own choosing;
//  2. the grammar on laid-out plans: over both seats, a full and an empty
//     row, desktop and phone layouts and 300 random layouts, every piece and
//     every one-shot mark stays inside the winner's side and off the
//     loser's, no piece moves down, sparks only fly up; and the checker
//     catches each kind of break (mutations);
//  3. the shape of each boast: Shield Slam's wall and crest of seven; Hive
//     Burst's sacs that grow in place and burst into a spore column; Void
//     Collapse's star that feeds, collapses, holds silent and blooms, and its
//     bars framing the name; Data Cascade's columns streaming up and the
//     lead pixels snapping into a stack of blocks; the reduced-motion still
//     (1 s, the final pose, nothing moving); deterministic per seed;
//  4. the sting's sound and the pages: the replay embeds the runtime and
//     holds the result line; the sheet carries every scene.
import { describe, expect, it } from "vitest";
import { STARTER_BOASTS } from "@ai-tcg/economy";
import {
  BOAST_MS_MAX,
  BOAST_PURE_SOURCE,
  BOAST_RUNTIME_SOURCE,
  BOAST_SPECS,
  BOAST_STARTER,
  BOAST_STILL_MS,
  BOAST_FORMATIONS,
  boastCosmeticsShown,
  boastIdFor,
  boastPieceAt,
  boastPlan,
  boastPlanProblem,
  boastSpecProblem,
  boastStill,
  type BoastGeom,
  type BoastPlan,
  type BoastRect,
  type BoastSpec,
} from "../src/boastFx.js";
import { SFX_KINDS, sfxRecipe } from "../src/soundFx.js";
import { renderBoastSheet, boastScenes } from "../src/boastSheet.js";

const SHIELD = BOAST_SPECS["boast-aegis-shield-slam"]!;
const HIVE = BOAST_SPECS["boast-swarm-hive-burst"]!;
const VOID = BOAST_SPECS["boast-null-void-collapse"]!;
const CASCADE = BOAST_SPECS["boast-cortex-data-cascade"]!;
const ALL: [string, BoastSpec][] = Object.values(BOAST_SPECS).map((s) => [s.name, s]);

// A replay-like layout: two sides of the board stacked (seat 2 above, seat 1
// below), each a row of six slots; the HUD panels side by side on top.
function layout(o: { seat: "p1" | "p2"; width?: number; slotW?: number; slotH?: number; lines?: 1 | 2; filled?: number; pad?: number }): BoastGeom {
  const width = o.width ?? 1100, slotW = o.slotW ?? 118, slotH = o.slotH ?? 158, lines = o.lines ?? 1, pad = o.pad ?? 8, gap = 8;
  const perLine = lines === 1 ? 6 : 3;
  const sideH = lines * slotH + (lines - 1) * gap + pad * 2;
  const hudTop = 60, hudH = 70, top = hudTop + hudH + 50;
  const sides: Record<"p1" | "p2", BoastRect> = {
    p2: { l: 20, t: top, r: 20 + width, b: top + sideH },
    p1: { l: 20, t: top + sideH + 40, r: 20 + width, b: top + sideH + 40 + sideH },
  };
  const huds: Record<"p1" | "p2", BoastRect> = {
    p1: { l: 20, t: hudTop, r: 20 + width / 2 - 120, b: hudTop + hudH },
    p2: { l: 20 + width / 2 + 120, t: hudTop, r: 20 + width, b: hudTop + hudH },
  };
  const band = sides[o.seat], other = o.seat === "p1" ? "p2" : "p1";
  const lineW = perLine * slotW + (perLine - 1) * gap;
  const slots = Array.from({ length: 6 }, (_, k) => {
    const line = Math.floor(k / perLine), col = k % perLine;
    const l = (band.l + band.r) / 2 - lineW / 2 + col * (slotW + gap), t = band.t + pad + line * (slotH + gap);
    return { l, t, r: l + slotW, b: t + slotH, filled: k < (o.filled ?? 6) };
  });
  return { band, panel: huds[o.seat], slots, loser: [sides[other], huds[other]] };
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

describe("boast specs", () => {
  it("every spec is valid and fits the length cap", () => {
    for (const spec of Object.values(BOAST_SPECS)) {
      expect(boastSpecProblem(spec)).toBeNull();
      expect(spec.ms).toBeLessThanOrEqual(BOAST_MS_MAX);
    }
  });

  it("the starter ids, names and factions match the economy catalogue", () => {
    for (const [faction, item] of Object.entries(STARTER_BOASTS)) {
      expect(BOAST_STARTER[faction]).toBe(item.itemId);
      const spec = BOAST_SPECS[item.itemId];
      if (spec) {
        expect(spec.name).toBe(item.name);
        expect(spec.faction).toBe(faction);
        expect(item.artRef).toBe(`code:boast/${item.itemId.replace(/^boast-/, "")}`);
      }
    }
    // Slice 2: all four starter boasts are drawn (the Season 0 boasts next).
    expect(Object.keys(BOAST_SPECS).sort()).toEqual(Object.values(STARTER_BOASTS).map((i) => i.itemId).sort());
  });

  it("boastIdFor plays the record's boast, else the winner's faction starter, else none", () => {
    expect(boastIdFor(null, "Aegis")).toBe("boast-aegis-shield-slam");
    expect(boastIdFor("boast-aegis-shield-slam", "Cortex")).toBe("boast-aegis-shield-slam");
    // A record boast the render can't draw yet falls back to the faction's.
    expect(boastIdFor("boast-s1-not-drawn-yet", "Aegis")).toBe("boast-aegis-shield-slam");
    expect(boastIdFor(null, "Swarm")).toBe("boast-swarm-hive-burst");
    expect(boastIdFor(null, "Null")).toBe("boast-null-void-collapse");
    expect(boastIdFor(null, "Cortex")).toBe("boast-cortex-data-cascade");
    expect(boastIdFor("boast-null-void-collapse", "Swarm")).toBe("boast-null-void-collapse");
    // Neutral has no starter boast (decks are one of the four factions).
    expect(boastIdFor(null, "Neutral")).toBeNull();
  });

  it("refuses broken specs", () => {
    const bad = (f: (s: BoastSpec) => void) => { const s = clone(SHIELD); f(s); return boastSpecProblem(s); };
    expect(bad((s) => { s.beats = s.beats.filter((b) => b.p !== "name"); })).toMatch(/name/);
    expect(bad((s) => { s.beats[1]!.p = "explode"; })).toMatch(/unknown primitive/);
    expect(bad((s) => { s.ms = BOAST_MS_MAX + 1; })).toMatch(/length/);
    expect(bad((s) => { s.beats.reverse(); })).toMatch(/time order/);
    expect(bad((s) => { s.beats = s.beats.filter((b) => b.p !== "wall"); })).toMatch(/gather needs pieces to lift/);
    expect(bad((s) => { s.beats[s.beats.length - 1]!.at = s.ms + 10; })).toMatch(/after the boast ends/);
    expect(bad((s) => { s.beats.find((b) => b.p === "gather")!.formation = "spiral"; })).toMatch(/unknown formation/);
    // Slice 2's dependencies: a burst needs its sacs, a pull its star, and a
    // star grows, collapses, then goes.
    const badOf = (base: BoastSpec, f: (s: BoastSpec) => void) => { const s = clone(base); f(s); return boastSpecProblem(s); };
    expect(badOf(HIVE, (s) => { s.beats = s.beats.filter((b) => b.p !== "bloom"); })).toMatch(/burst needs a bloom/);
    expect(badOf(HIVE, (s) => { s.beats = s.beats.filter((b) => b.p !== "burst"); })).toMatch(/gather needs pieces to lift/);
    expect(badOf(VOID, (s) => { s.beats = s.beats.filter((b) => b.p !== "star"); })).toMatch(/pull needs a star/);
    expect(badOf(VOID, (s) => { const st = s.beats.find((b) => b.p === "star")!; st.gone = (st.collapse as number) + 100; })).toMatch(/grows, then collapses, then goes/);
    expect(badOf(CASCADE, (s) => { s.beats = s.beats.filter((b) => b.p !== "stream"); })).toMatch(/gather needs pieces to lift/);
  });

  it("every formation fits over the name: cells bottom first, inside the crest's reach", () => {
    for (const [name, f] of Object.entries(BOAST_FORMATIONS)) {
      expect(f.cells.length, name).toBeGreaterThanOrEqual(4);
      for (const [x, y] of [...f.cells, [f.lock[0], f.lock[1]]]) {
        // Within 1.25 crest radii sideways and 1.15 up or down (with the
        // sprite, inside the crest's ring; the name sits lower still).
        expect(Math.abs(x), name).toBeLessThanOrEqual(1.25);
        expect(Math.abs(y), name).toBeLessThanOrEqual(1.15);
      }
    }
  });
});

describe("the cosmetics switch", () => {
  it("a spectator's switch hides both sides; an owner's hides only the other side", () => {
    for (const side of ["p1", "p2"]) {
      expect(boastCosmeticsShown(null, side, true)).toBe(true);
      expect(boastCosmeticsShown(null, side, false)).toBe(false);
    }
    expect(boastCosmeticsShown("p1", "p1", false)).toBe(true);
    expect(boastCosmeticsShown("p1", "p2", false)).toBe(false);
    expect(boastCosmeticsShown("p2", "p1", true)).toBe(true);
  });
});

describe("the victory grammar on laid-out plans", () => {
  const cases: [string, BoastGeom][] = [];
  for (const seat of ["p1", "p2"] as const) {
    for (const filled of [6, 3, 0]) {
      cases.push([`desktop ${seat} ${filled} cards`, layout({ seat, filled })]);
      cases.push([`phone ${seat} ${filled} cards`, layout({ seat, filled, width: 360, slotW: 85, slotH: 114, lines: 2, pad: 6 })]);
    }
    cases.push([`narrow one-line ${seat}`, layout({ seat, width: 640, slotW: 96, slotH: 128 })]);
  }

  const grid = ALL.flatMap(([bn, spec]) => cases.map(([cn, geom]) => [`${bn}, ${cn}`, spec, geom] as [string, BoastSpec, BoastGeom]));
  it.each(grid)("keeps the grammar: %s", (_name, spec, geom) => {
    const plan = boastPlan(spec, geom, 3);
    expect(boastPlanProblem(plan, geom)).toBeNull();
    expect(boastPlanProblem(boastStill(plan), geom)).toBeNull();
  });

  it.each(ALL)("%s holds over 300 random layouts and seeds", (_bn, spec) => {
    const rand = seeded(11);
    let checked = 0;
    for (let n = 0; n < 300; n++) {
      const lines = rand() < 0.3 ? 2 : 1;
      const slotW = 60 + rand() * 70, slotH = slotW * (1.25 + rand() * 0.2);
      const width = Math.max((lines === 1 ? 6 : 3) * (slotW + 8) + 20, 300 + rand() * 1200);
      const geom = layout({ seat: rand() < 0.5 ? "p1" : "p2", lines, slotW, slotH, width, filled: Math.floor(rand() * 7), pad: 4 + rand() * 10 });
      const plan = boastPlan(spec, geom, n);
      expect(boastPlanProblem(plan, geom), `layout ${n}`).toBeNull();
      expect(boastPlanProblem(boastStill(plan), geom), `still ${n}`).toBeNull();
      checked++;
    }
    expect(checked).toBe(300);
  });

  it.each(ALL)("%s, sampled at every 10 ms: no piece ever moves down or leaves the winner's side", (_bn, spec) => {
    for (const [name, geom] of cases) {
      const plan = boastPlan(spec, geom, 5);
      for (const pc of plan.pieces) {
        const half = (s: number) => (s / 2) * (pc.sx ?? 1);
        let lastY = Infinity;
        for (let t = 0; t <= plan.ms + 400; t += 10) {
          const at = boastPieceAt(pc, t);
          if (!at) continue;
          expect(at.y, name).toBeLessThanOrEqual(lastY + 1e-6);
          lastY = at.y;
          if (at.a > 0.01) {
            expect(at.y - at.s / 2, name).toBeGreaterThanOrEqual(geom.band.t - 2);
            expect(at.y + at.s / 2, name).toBeLessThanOrEqual(geom.band.b + 2);
            expect(at.x - half(at.s), name).toBeGreaterThanOrEqual(geom.band.l - 2);
            expect(at.x + half(at.s), name).toBeLessThanOrEqual(geom.band.r + 2);
          }
        }
      }
    }
  });

  it("catches each kind of break (mutations)", () => {
    const geom = layout({ seat: "p1" });
    const plan = boastPlan(SHIELD, geom, 1);
    const broken = (f: (p: BoastPlan) => void) => { const p = clone(plan); f(p); return boastPlanProblem(p, geom); };
    expect(broken(() => {})).toBeNull();
    // A piece that sinks back down (a debuff's grammar, not a victory's).
    expect(broken((p) => { const k = p.pieces[0]!.keys; k.push({ ...k[k.length - 1]!, t: k[k.length - 1]!.t + 50, y: k[k.length - 1]!.y + 20 }); })).toMatch(/moves down/);
    // A piece that crosses toward the loser (seat 1's loser is above it).
    expect(broken((p) => { const k = p.pieces[0]!.keys; k.push({ ...k[k.length - 1]!, t: k[k.length - 1]!.t + 50, y: geom.band.t - 60, a: 1 }); })).toMatch(/leaves the winner's side|touches the loser/);
    // Sparks thrown downward, or so wide they reach sideways and down.
    expect(broken((p) => { const m = p.marks.find((x) => x.k === "sparks")!; m.angle = Math.PI / 2; })).toMatch(/upward/);
    expect(broken((p) => { const m = p.marks.find((x) => x.k === "sparks")!; m.spread = Math.PI; })).toMatch(/upward/);
    // A shock big enough to reach the loser's side.
    expect(broken((p) => { const m = p.marks.find((x) => x.k === "shock")!; m.R = 400; })).toMatch(/shock/);
    // A veil stretched over the loser's side.
    expect(broken((p) => { const m = p.marks.find((x) => x.k === "veil")!; m.t2 = geom.loser![0]!.t; })).toMatch(/veil/);
    // The name plate on the loser's side.
    expect(broken((p) => { const m = p.marks.find((x) => x.k === "name")!; m.y = geom.loser![0]!.t + 40; })).toMatch(/name/);
    // A mark after the end, and no name at all.
    expect(broken((p) => { p.marks.push({ k: "flare", t: p.ms + 100, x: geom.band.l + 100, y: geom.band.t + 60, s: 10 }); })).toMatch(/after the boast ends/);
    expect(broken((p) => { p.marks = p.marks.filter((m) => m.k !== "name"); })).toMatch(/no name/);
    // A bar stretched past the side's edge (the checker reads the stretch).
    const vplan = boastPlan(VOID, geom, 1);
    const bar = vplan.pieces.findIndex((pc) => pc.frame);
    expect(boastPlanProblem(vplan, geom)).toBeNull();
    const wide = clone(vplan); wide.pieces[bar]!.sx = 400;
    expect(boastPlanProblem(wide, geom)).toMatch(/leaves the winner's side/);
    // A mote drawn into the star from above it would move down.
    const sunk = clone(vplan); const mote = sunk.pieces.find((pc) => pc.grp === "mote")!; mote.keys[0]!.y = mote.keys[0]!.y - 200; mote.keys[1]!.y = mote.keys[0]!.y;
    expect(boastPlanProblem(sunk, geom)).toMatch(/moves down|leaves/);
    // The checker sees the loser even inside the band (a stray loser rect).
    const g2 = { ...geom, loser: [...geom.loser!, { l: geom.band.l, t: geom.band.t, r: geom.band.r, b: geom.band.t + 30 }] };
    expect(boastPlanProblem(plan, g2)).toMatch(/touches the loser/);
  });
});

describe("Shield Slam", () => {
  const geom = layout({ seat: "p1" });
  const plan = boastPlan(SHIELD, geom, 1);

  it("is about 3 s and ends on the name, with the sting at the crest", () => {
    expect(plan.ms).toBe(3000);
    const kinds = plan.marks.map((m) => m.k);
    expect(kinds[kinds.length - 1]).toBe("end");
    const name = plan.marks.find((m) => m.k === "name")!;
    expect(name.t).toBeGreaterThan(2000);
    expect(name.t).toBeLessThan(plan.ms);
    const sting = plan.marks.find((m) => m.k === "sound" && m.kind === "boast")!;
    expect(sting.tier).toBe("spectacle");
    expect(sting.x).toBeCloseTo(plan.crest.x);
    expect(plan.marks.find((m) => m.k === "duck")!.t).toBe(sting.t);
    expect(plan.marks.find((m) => m.k === "panel")!.t).toBe(0);
  });

  it("raises a wall of two plates per slot, centre first, on a full or an empty row", () => {
    for (const filled of [6, 0]) {
      const p = boastPlan(SHIELD, layout({ seat: "p1", filled }), 1);
      const wall = p.pieces.filter((pc) => pc.slot !== undefined);
      expect(wall).toHaveLength(12);
      // Each slot's plates land in the slot, the bottom one first.
      const firstLand = (pc: (typeof wall)[number]) => pc.keys[1]!.t;
      const bySlot = new Map<number, number>();
      for (const pc of wall) if (pc.row === 0) bySlot.set(pc.slot!, firstLand(pc));
      // Centre slots (2, 3) land before the outer ones (0, 5).
      expect(Math.max(bySlot.get(2)!, bySlot.get(3)!)).toBeLessThan(Math.min(bySlot.get(0)!, bySlot.get(5)!));
      // One impact per slot.
      expect(p.marks.filter((m) => m.k === "sound" && m.kind === "impact")).toHaveLength(6);
    }
  });

  it("locks into a crest of seven plates (a hex ring and its centre) over the name", () => {
    expect(plan.crestPieces).toBe(7);
    const name = plan.marks.find((m) => m.k === "name")!;
    expect(plan.crest.y).toBeLessThan(name.y as number);
    // What still shows at the end: the seven crest plates, nothing else.
    const showing = plan.pieces.filter((pc) => { const at = boastPieceAt(pc, plan.ms - 1); return at && at.a > 0.5; });
    expect(showing).toHaveLength(7);
    for (const pc of showing) {
      const at = boastPieceAt(pc, plan.ms - 1)!;
      expect(Math.hypot(at.x - plan.crest.x, at.y - plan.crest.y)).toBeLessThanOrEqual(plan.crest.r * 1.2);
    }
    // And they fade as the result lands.
    for (const pc of showing) expect(boastPieceAt(pc, plan.ms + 330)).toBeNull();
  });

  it("is the same plan for the same seed and layout", () => {
    expect(boastPlan(SHIELD, geom, 9)).toEqual(boastPlan(SHIELD, geom, 9));
  });

  it("reduced motion: the final pose, still, with the panel, the name and the sting, about 1 s", () => {
    const still = boastStill(plan);
    expect(still.still).toBe(true);
    expect(still.ms).toBe(BOAST_STILL_MS);
    expect(BOAST_STILL_MS).toBe(1000);
    expect(still.pieces).toHaveLength(7);
    for (const pc of still.pieces) {
      const xs = new Set(pc.keys.map((k) => k.x)), ys = new Set(pc.keys.map((k) => k.y)), ss = new Set(pc.keys.map((k) => k.s));
      expect(xs.size + ys.size + ss.size).toBe(3);
      expect(boastPieceAt(pc, 0)!.a).toBe(1);
    }
    expect(still.marks.map((m) => m.k).sort()).toEqual(["end", "name", "panel", "sound", "veil"]);
    expect(still.marks.every((m) => m.k === "end" ? m.t === 1000 : m.t === 0)).toBe(true);
  });

  it("a slam accelerates into its rest and stops dead there", () => {
    const pc = plan.pieces.find((p) => p.row === 1)!;
    const [k0, k1] = pc.keys as [typeof pc.keys[0], typeof pc.keys[0]];
    const mid = boastPieceAt(pc, (k0.t + k1.t) / 2)!;
    // Cubic ease-in: a quarter of the way at most by half time.
    expect((k0.y - mid.y) / (k0.y - k1.y)).toBeLessThan(0.2);
    expect(boastPieceAt(pc, k1.t)!.y).toBeCloseTo(k1.y);
    expect(boastPieceAt(pc, k1.t + 200)!.y).toBeCloseTo(k1.y);
  });
});

// What still shows just before the end (the final pose the still keeps).
function showingAtEnd(plan: BoastPlan) {
  return plan.pieces.filter((pc) => { const at = boastPieceAt(pc, plan.ms - 1); return at && at.a > 0.5; });
}
const still = (pc: BoastPlan["pieces"][number]) => new Set(pc.keys.map((k) => `${k.x},${k.y}`)).size === 1;

describe("Hive Burst", () => {
  const geom = layout({ seat: "p1" });
  const plan = boastPlan(HIVE, geom, 1);

  it("an egg sac grows in every slot without moving, centre first, then bursts in the same order", () => {
    for (const filled of [6, 0]) {
      const p = boastPlan(HIVE, layout({ seat: "p1", filled }), 1);
      const sacs = p.pieces.filter((pc) => pc.grp === "sac");
      expect(sacs).toHaveLength(6);
      for (const sac of sacs) {
        expect(sac.sp).toBe("eggs");
        expect(still(sac)).toBe(true);
        // Grows to full, swells, then pops: bigger and gone.
        const sizes = sac.keys.map((k) => k.s);
        for (let i = 1; i < sizes.length; i++) expect(sizes[i]!).toBeGreaterThan(sizes[i - 1]!);
        expect(sac.keys[sac.keys.length - 1]!.a).toBe(0);
      }
      const popAt = (pc: (typeof sacs)[number]) => pc.keys[2]!.t;
      const bySlot = new Map(sacs.map((pc) => [pc.slot!, popAt(pc)]));
      expect(Math.max(bySlot.get(2)!, bySlot.get(3)!)).toBeLessThan(Math.min(bySlot.get(0)!, bySlot.get(5)!));
      // Each sac is full grown before it bursts.
      for (const sac of sacs) expect(sac.keys[2]!.t).toBeGreaterThanOrEqual(sac.keys[1]!.t);
      expect(p.marks.filter((m) => m.k === "sound" && m.kind === "impact")).toHaveLength(6);
      expect(p.marks.filter((m) => m.k === "sound" && m.kind === "buff")).toHaveLength(6);
    }
  });

  it("the burst throws two spores a sac up and in; six climb into a column and a seventh crowns it", () => {
    const spores = plan.pieces.filter((pc) => pc.grp === "spore");
    expect(spores).toHaveLength(12);
    expect(plan.crestPieces).toBe(7);
    const showing = showingAtEnd(plan);
    expect(showing).toHaveLength(7);
    expect(showing.every((pc) => pc.sp === "spores")).toBe(true);
    const name = plan.marks.find((m) => m.k === "name")!;
    const pos = showing.map((pc) => boastPieceAt(pc, plan.ms - 1)!);
    // A column: narrow, tall, wholly above the name plate, crowned at the top.
    const xs = pos.map((p) => p.x), ys = pos.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(plan.crest.r * 0.7);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(plan.crest.r * 1.8);
    for (const p of pos) expect(p.y + p.s / 2).toBeLessThan((name.y as number) - (name.h as number) / 2);
    const crown = showing.find((pc) => pc.centre)!;
    expect(boastPieceAt(crown, plan.ms - 1)!.y).toBe(Math.min(...ys));
    // The spores that didn't join rise on and fade before the end.
    expect(spores.filter((pc) => { const at = boastPieceAt(pc, plan.ms - 1); return !at || at.a < 0.5; })).toHaveLength(6);
    // Spore motes are green: no ember warmth.
    const motes = plan.marks.filter((m) => m.k === "sparks" && m.ember);
    expect(motes.length).toBeGreaterThan(5);
    expect(motes.every((m) => m.warm === false)).toBe(true);
  });

  it("ends on the name with the sting at the crown", () => {
    const sting = plan.marks.find((m) => m.k === "sound" && m.kind === "boast")!;
    const name = plan.marks.find((m) => m.k === "name")!;
    expect(sting.t).toBeLessThan(name.t);
    expect(name.t).toBeLessThan(plan.ms);
    expect(plan.marks[plan.marks.length - 1]!.k).toBe("end");
  });
});

describe("Void Collapse", () => {
  const geom = layout({ seat: "p1" });
  const plan = boastPlan(VOID, geom, 1);
  const spec = VOID.beats.find((b) => b.p === "star")!;
  const lockAt = VOID.beats.find((b) => b.p === "lock")!.at;

  it("the star grows in place, swells as it feeds, collapses and holds a silent beat before the bloom", () => {
    const star = plan.pieces.find((pc) => pc.grp === "star")!;
    expect(star.sp).toBe("darkStar");
    expect(still(star)).toBe(true);
    expect(star.keys[0]!.x).toBeCloseTo(plan.crest.x);
    const full = boastPieceAt(star, (spec.collapse as number) - 1)!.s;
    const collapsed = boastPieceAt(star, (spec.collapse as number) + 230)!.s;
    expect(collapsed).toBeLessThan(full * 0.3);
    // The hold: nothing sounds or flashes between the collapse and the bloom.
    const quiet = plan.marks.filter((m) => m.t > (spec.collapse as number) + 220 && m.t < lockAt);
    expect(quiet).toEqual([]);
    expect(lockAt - ((spec.collapse as number) + 220)).toBeGreaterThanOrEqual(150);
    // Gone as the bloom's own star opens, wider than the first.
    expect(boastPieceAt(star, lockAt + 70)).toBeNull();
    const bloom = plan.pieces.find((pc) => pc.grp === "crest")!;
    expect(bloom.sp).toBe("darkStar");
    expect(bloom.keys[bloom.keys.length - 1]!.t).toBeGreaterThan(plan.ms);
    const grown = boastPieceAt(star, (spec.at as number) + (spec.grow as number))!.s;
    expect(boastPieceAt(bloom, plan.ms - 1)!.s).toBeGreaterThan(grown);
    // Both are holes in the light (a dark core), and both turn.
    expect(star.core && bloom.core).toBe(true);
    expect(star.spin! > 0 && bloom.spin! > 0).toBe(true);
  });

  it("motes lift out of every slot and are drawn into the star, never downward", () => {
    for (const g of [geom, layout({ seat: "p2", width: 360, slotW: 85, slotH: 114, lines: 2, pad: 6 })]) {
      const p = boastPlan(VOID, g, 2);
      const motes = p.pieces.filter((pc) => pc.grp === "mote");
      expect(motes).toHaveLength(18);
      expect(new Set(motes.map((pc) => Math.round(pc.keys[0]!.x / 10))).size).toBeGreaterThan(6);
      for (const m of motes) {
        const end = m.keys[m.keys.length - 1]!;
        expect(end.x).toBeCloseTo(p.crest.x);
        expect(end.y).toBeCloseTo(p.crest.y);
        expect(end.a).toBe(0);
        expect(m.keys[0]!.y).toBeGreaterThanOrEqual(p.crest.y - 1e-9);
        // All in before the star collapses.
        expect(end.t).toBeLessThanOrEqual((spec.collapse as number) + 220);
      }
    }
  });

  it("the bloom tears glitch bars out sideways; four settle at the name line and frame it", () => {
    const bars = plan.pieces.filter((pc) => pc.grp === "bar");
    const tears = bars.filter((pc) => !pc.frame), frames = bars.filter((pc) => pc.frame);
    expect(tears).toHaveLength(10);
    expect(frames).toHaveLength(4);
    for (const b of bars) {
      expect(b.sp).toBe("glitch");
      expect(b.sx!).toBeGreaterThan(1);
      // Sideways only.
      expect(new Set(b.keys.map((k) => k.y)).size).toBe(1);
    }
    for (const t of tears) {
      expect(t.keys[0]!.t).toBeGreaterThanOrEqual(lockAt);
      expect(t.keys[t.keys.length - 1]!.a).toBe(0);
    }
    const name = plan.marks.find((m) => m.k === "name")!;
    const showing = showingAtEnd(plan);
    expect(showing.filter((pc) => pc.frame)).toHaveLength(4);
    expect(showing).toHaveLength(5);
    for (const f of frames) {
      const at = boastPieceAt(f, plan.ms - 1)!;
      expect(Math.abs(at.y - (name.y as number))).toBeLessThan((name.h as number) / 2);
      // At the plate's ends, left and right.
      expect(Math.abs(at.x - (name.x as number)) + (at.s * f.sx!) / 2).toBeCloseTo((name.w as number) / 2, 0);
    }
    expect(new Set(frames.map((f) => Math.sign(boastPieceAt(f, plan.ms - 1)!.x - (name.x as number))))).toEqual(new Set([-1, 1]));
  });

  it("the still keeps the bloomed star and the frame, stretched as they were", () => {
    const s = boastStill(plan);
    expect(s.pieces).toHaveLength(5);
    expect(s.pieces.filter((pc) => (pc.sx ?? 1) > 1)).toHaveLength(4);
    expect(boastPlanProblem(s, geom)).toBeNull();
  });
});

describe("Data Cascade", () => {
  const geom = layout({ seat: "p1" });
  const plan = boastPlan(CASCADE, geom, 1);

  it("streams columns of pixels UP out of every slot, centre first; each column's lead pixel waits at its top", () => {
    for (const filled of [6, 0]) {
      const p = boastPlan(CASCADE, layout({ seat: "p1", filled }), 1);
      const heads = p.pieces.filter((pc) => pc.grp === "head"), trails = p.pieces.filter((pc) => pc.grp === "trail");
      expect(heads).toHaveLength(6);
      expect(trails.length).toBeGreaterThan(40);
      for (const pc of [...heads, ...trails]) {
        expect(pc.sp).toBe("pixels");
        expect(pc.keys[1]!.y).toBeLessThan(pc.keys[0]!.y);
      }
      for (const t of trails) expect(t.keys[t.keys.length - 1]!.a).toBe(0);
      const first = new Map(heads.map((h) => [h.slot!, h.keys[0]!.t]));
      expect(Math.max(first.get(2)!, first.get(3)!)).toBeLessThan(Math.min(first.get(0)!, first.get(5)!));
      expect(p.marks.filter((m) => m.k === "sound" && m.kind === "beam")).toHaveLength(6);
    }
  });

  it("five lead pixels snap into blocks stacked three then two; the lock adds the top block", () => {
    expect(plan.crestPieces).toBe(6);
    const showing = showingAtEnd(plan);
    expect(showing).toHaveLength(6);
    expect(showing.every((pc) => pc.sp === "cube")).toBe(true);
    const rows = new Map<number, number>();
    for (const pc of showing) { const y = Math.round(boastPieceAt(pc, plan.ms - 1)!.y); rows.set(y, (rows.get(y) ?? 0) + 1); }
    expect([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, n]) => n)).toEqual([3, 2, 1]);
    // Each snap: the pixel goes out as its block pops in, with a flare.
    const gatherAt = CASCADE.beats.find((b) => b.p === "gather")!.at;
    expect(plan.marks.filter((m) => m.k === "flare" && m.t > gatherAt && m.t < plan.ms - 800)).toHaveLength(5);
    const heads = plan.pieces.filter((pc) => pc.grp === "head");
    expect(heads.every((h) => h.keys[h.keys.length - 1]!.a === 0)).toBe(true);
  });

  it("is deterministic per seed and the columns differ between seeds", () => {
    expect(boastPlan(CASCADE, geom, 4)).toEqual(boastPlan(CASCADE, geom, 4));
    expect(boastPlan(CASCADE, geom, 4)).not.toEqual(boastPlan(CASCADE, geom, 5));
  });
});

describe("the sting and the pages", () => {
  it("the sting rises in every voice and is not one of the match-event sounds", () => {
    expect(SFX_KINDS).not.toContain("boast");
    for (const f of ["Cortex", "Aegis", "Swarm", "Null", "Neutral"]) {
      const v = sfxRecipe("boast", f, "spectacle", seeded(3));
      expect(v.length).toBeGreaterThan(6);
      const tones = v.filter((x) => x.k === "tone" && x.type !== "sine" && (x.delay ?? 0) < 0.4);
      const held = v.filter((x) => x.k === "tone" && x.type !== "sine" && (x.delay ?? 0) >= 0.44);
      expect(tones.length).toBeGreaterThanOrEqual(3);
      // The fanfare climbs, and the held chord sits above it.
      for (let i = 1; i < tones.length; i++) expect(tones[i]!.f0).toBeGreaterThan(tones[i - 1]!.f0);
      expect(Math.min(...held.map((x) => x.f0))).toBeGreaterThan(Math.max(...tones.map((x) => x.f0)));
      expect(Math.max(...v.map((x) => (x.delay ?? 0) + x.dur))).toBeLessThan(2);
    }
  });

  it("the sheet carries every scene and the replay's own sources", () => {
    const html = renderBoastSheet();
    expect(html).toContain(BOAST_PURE_SOURCE);
    expect(html).toContain(BOAST_RUNTIME_SOURCE);
    const scenes = boastScenes();
    for (const spec of Object.values(BOAST_SPECS)) {
      expect(scenes.filter((s) => s.boast === spec.id).map((s) => s.key.replace(/^.*-/, ""))).toEqual(["full", "empty", "top", "phone", "reduced"]);
      expect(scenes.filter((s) => s.boast === spec.id).every((s) => s.winner.faction === spec.faction && s.loser.faction !== spec.faction)).toBe(true);
    }
    for (const s of scenes) expect(html).toContain(`id="${s.key}"`);
  });
});
