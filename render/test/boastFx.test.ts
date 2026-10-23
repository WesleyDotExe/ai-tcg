// Victory boasts, render slices 1-2b: the victory grammar, the spec format
// and the four starter boasts (Shield Slam; slice 2: Hive Burst, Void
// Collapse, Data Cascade), the cosmetics switch, and (slice 2b) the two
// neutral Season 0 boasts, Boot Sequence and Dial-Up Fireworks, with the
// dot font they spell in. Four layers:
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
import { SEASON_0_BOASTS, STARTER_BOASTS } from "@ai-tcg/economy";
import {
  BOAST_MS_MAX,
  BOAST_CLOSE_LINE,
  BOAST_CLOSE_MS,
  BOAST_WINS,
  BOAST_PURE_SOURCE,
  BOAST_RUNTIME_SOURCE,
  BOAST_SPECS,
  BOAST_STARTER,
  BOAST_STILL_MS,
  BOAST_FORMATIONS,
  BOAST_FONT,
  boastBits,
  boastBitsFit,
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
const BOOT = BOAST_SPECS["boast-s0-boot-sequence"]!;
const DIALUP = BOAST_SPECS["boast-s0-dial-up-fireworks"]!;
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
    // Slice 2: all four starter boasts are drawn; slice 2b: the two Season 0
    // boasts, neutral (no faction), each with its own colour.
    expect(Object.keys(BOAST_SPECS).sort()).toEqual([...Object.values(STARTER_BOASTS), ...SEASON_0_BOASTS].map((i) => i.itemId).sort());
    for (const item of SEASON_0_BOASTS) {
      const spec = BOAST_SPECS[item.itemId]!;
      expect(spec.name).toBe(item.name);
      expect(spec.faction).toBeNull();
      expect(spec.col).toMatch(/^#[0-9a-f]{6}$/);
      expect(item.artRef).toBe(`code:boast/${item.itemId.replace(/^boast-/, "")}`);
    }
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
        const half = (s: number) => (pc.w ? pc.w / 2 : (s / 2) * (pc.sx ?? 1));
        let lastY = Infinity;
        // Collected, then asserted once (Dial-Up Fireworks has hundreds of
        // pixels; an expect per sample is too slow).
        const bad: string[] = [];
        for (let t = 0; t <= plan.ms + 400; t += 10) {
          const at = boastPieceAt(pc, t);
          if (!at) continue;
          if (at.y > lastY + 1e-6) bad.push(`${name}: down at ${t}`);
          lastY = at.y;
          if (at.a > 0.01) {
            const b = geom.band;
            if (at.y - at.s / 2 < b.t - 2 || at.y + at.s / 2 > b.b + 2 || at.x - half(at.s) < b.l - 2 || at.x + half(at.s) > b.r + 2) bad.push(`${name}: outside at ${t}`);
          }
        }
        expect(bad).toEqual([]);
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
    // A flare whose sprite fits but whose bloom (0.72 of its size) doesn't
    // (render session 33: the check had only counted the sprite).
    expect(broken((p) => { p.marks.push({ k: "flare", t: 100, x: geom.band.l + 200, y: geom.band.t + 30, s: 50 }); })).toMatch(/flare/);
    expect(broken((p) => { p.marks.push({ k: "flare", t: 100, x: geom.band.l + 200, y: geom.band.t + 40, s: 50 }); })).toBeNull();
    // Season 0: a CRT screen stretched past the side, and a tower whose
    // fixed width (w, not s x sx) reaches past it.
    const bplan = boastPlan(BOOT, geom, 1, { name: "Bo", faction: "Aegis" });
    const crt = clone(bplan); crt.marks.find((m) => m.k === "crt")!.r = geom.band.r + 30;
    expect(boastPlanProblem(crt, geom)).toMatch(/crt screen/);
    const dplan = boastPlan(DIALUP, geom, 1, { name: "Bo", faction: "Aegis" });
    const wide2 = clone(dplan); wide2.pieces.find((pc) => pc.shape === "tower")!.w = 4000;
    expect(boastPlanProblem(wide2, geom)).toMatch(/leaves the winner's side/);
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

describe("the dot font (Season 0)", () => {
  it("draws every character an agent name may use, each letter and digit distinct", () => {
    const needed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.-_";
    for (const ch of needed) {
      expect(BOAST_FONT[ch], ch).toMatch(/^[0-9a-f]{14}$/);
      // Five columns: no row sets a bit past the fifth.
      for (let r = 0; r < 7; r++) expect(parseInt(BOAST_FONT[ch]!.slice(r * 2, r * 2 + 2), 16), ch).toBeLessThan(32);
    }
    const alnum = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].map((c) => BOAST_FONT[c]);
    expect(new Set(alnum).size).toBe(alnum.length);
  });

  it("lays text out a character every six columns, lines centred, spaces drawing nothing", () => {
    const ab = boastBits(["AB"]);
    expect([ab.cols, ab.rows, ab.chars]).toEqual([11, 7, 2]);
    expect(ab.dots.every(([c, r, n]) => c >= n * 6 && c < n * 6 + 5 && r >= 0 && r < 7)).toBe(true);
    const two = boastBits(["A B", "C"]);
    expect([two.cols, two.rows, two.chars]).toEqual([17, 16, 3]);
    // "C" is centred under the 17-column first line, on rows 9-15.
    const c = two.dots.filter((d) => d[2] === 2);
    expect(Math.min(...c.map((d) => d[0]))).toBe(6);
    expect(c.every((d) => d[1] >= 9)).toBe(true);
    // An unknown character draws a box, an accented letter its plain letter.
    expect(boastBits(["É"]).dots).toEqual(boastBits(["E"]).dots);
    expect(boastBits(["@"]).dots).toHaveLength(5 + 5 + 2 * 5);
  });

  it("fits text as large as it can: one line, or two split at the middle space when the dots get bigger", () => {
    expect(boastBitsFit("SYSTEM READY", 720, 70, 9).bits.rows).toBe(7);
    const phone = boastBitsFit("SYSTEM READY", 288, 99, 9);
    expect(phone.bits.rows).toBe(16);
    expect(phone.cell).toBeCloseTo(99 / 16);
    expect(boastBitsFit("Bastion Relay", 900, 59, 8).cell).toBe(8);
    // No space: one line, however small.
    expect(boastBitsFit("Coiljackal", 100, 100).bits.rows).toBe(7);
  });
});

describe("Boot Sequence (Season 0)", () => {
  const geom = layout({ seat: "p1" });
  const who = { name: "Bastion Relay", faction: "Cortex" };
  const plan = boastPlan(BOOT, geom, 1, who);
  const lines = plan.pieces.filter((pc) => pc.grp === "line");
  const banner = plan.pieces.find((pc) => pc.shape === "bits")!;
  const bannerAt = BOOT.beats.find((b) => b.p === "banner")!.at;

  it("is neutral: its own phosphor colour, the winner's faction for the panel and the sting", () => {
    expect(plan.faction).toBe("Cortex");
    expect(boastPlan(BOOT, geom, 1, { name: "x", faction: "Aegis" }).faction).toBe("Aegis");
    expect(plan.col).toBe(BOOT.col);
    expect(plan.rgb).toEqual([0x7d, 0xff, 0xa8]);
    const sting = plan.marks.find((m) => m.k === "sound" && m.kind === "boast")!;
    expect([sting.t, sting.tier]).toEqual([bannerAt, "spectacle"]);
    expect(plan.marks.find((m) => m.k === "duck" && m.t === bannerAt)).toBeTruthy();
  });

  it("powers the winner's side on like a CRT, with the tube's sound and the POST beep as it settles", () => {
    const crt = plan.marks.filter((m) => m.k === "crt");
    expect(crt).toHaveLength(1);
    expect([crt[0]!.l, crt[0]!.t2, crt[0]!.r, crt[0]!.b]).toEqual([geom.band.l + 4, geom.band.t + 4, geom.band.r - 4, geom.band.b - 4]);
    const snd = plan.marks.filter((m) => m.k === "sound").map((m) => [m.kind, m.t]);
    expect(snd).toContainEqual(["crt", crt[0]!.t]);
    expect(snd).toContainEqual(["post", crt[0]!.t + (crt[0]!.on as number)]);
  });

  it("prints five BIOS lines that scroll UP a line at a time, naming the winner's faction, then clear before the banner", () => {
    expect(lines.map((l) => l.txt)).toEqual(["AI-TCG ARENA BIOS  REV S0", "MEMORY TEST  65536K  OK", "AGENT  CORTEX  ONLINE", "LOADING  VICTORY.SYS", "BOOT >"]);
    expect(lines.every((l) => l.shape === "text")).toBe(true);
    // Each prints at the same bottom line, in order.
    const y0 = lines[0]!.keys[0]!.y;
    for (let i = 0; i < lines.length; i++) {
      expect(lines[i]!.keys[0]!.y).toBe(y0);
      if (i) expect(lines[i]!.keys[0]!.t).toBeGreaterThan(lines[i - 1]!.keys[0]!.t);
    }
    // When the last prints, every line sits one line height above the next.
    const at = (pc: (typeof lines)[number], t: number) => boastPieceAt(pc, t)!;
    const tLast = lines[4]!.keys[0]!.t + 100;
    const ys = lines.map((l) => at(l, tLast).y);
    const lh = ys[3]! - ys[2]!;
    expect(lh).toBeGreaterThan(0);
    for (let i = 1; i < 5; i++) expect(ys[i]! - ys[i - 1]!).toBeCloseTo(lh);
    // The last keeps a cursor; all are gone before SYSTEM READY.
    expect(lines.filter((l) => l.cursor)).toEqual([lines[4]]);
    for (const l of lines) expect(boastPieceAt(l, bannerAt)?.a ?? 0).toBe(0);
    // Each line clicks as it prints.
    expect(plan.marks.filter((m) => m.k === "sound" && m.kind === "type" && (m.t as number) < bannerAt - 600).length).toBeGreaterThanOrEqual(15);
  });

  it("types the winner's name into the plate in the BIOS's type, in at most 0.6 s, before the banner", () => {
    const name = plan.marks.find((m) => m.k === "name")!;
    expect(name.mono).toBe(true);
    // The whole line, "<NAME> WINS", types in at most 0.6 s.
    expect((name.type as number) * (who.name.length + 5)).toBeLessThanOrEqual(600 + 1e-9);
    expect(name.t).toBeLessThan(bannerAt);
    const long = boastPlan(BOOT, geom, 1, { name: "A Very Long Agent Name Here", faction: "Null" }).marks.find((m) => m.k === "name")!;
    expect((long.type as number) * 32).toBeLessThanOrEqual(600 + 1e-9);
  });

  it("flashes SYSTEM READY twice in chunky dot letters over the name and holds it", () => {
    expect(banner.bits).toEqual(boastBits(["SYSTEM READY"]));
    expect(plan.crestPieces).toBe(1);
    const name = plan.marks.find((m) => m.k === "name")!;
    const b = boastPieceAt(banner, plan.ms - 1)!;
    expect(b.y + b.s / 2).toBeLessThan((name.y as number) - (name.h as number) / 2);
    expect(b.s).toBeGreaterThanOrEqual(7 * 6);
    // Two dips, then held lit.
    const alphas = banner.keys.filter((k) => k.t > bannerAt + 100 && k.t < plan.ms).map((k) => k.a);
    expect(alphas.filter((a, i) => a < 0.2 && (i === 0 || alphas[i - 1]! >= 0.2))).toHaveLength(2);
    expect(alphas[alphas.length - 1]).toBe(1);
    // It never sinks: it rises a little into place and holds.
    for (let i = 1; i < banner.keys.length; i++) expect(banner.keys[i]!.y).toBeLessThanOrEqual(banner.keys[i - 1]!.y);
    expect(showingAtEnd(plan)).toEqual([banner]);
    // On a phone it breaks onto two lines, larger.
    const ph = boastPlan(BOOT, layout({ seat: "p2", width: 360, slotW: 85, slotH: 114, lines: 2, pad: 6 }), 1, who);
    expect(ph.pieces.find((pc) => pc.shape === "bits")!.bits!.rows).toBe(16);
  });

  it("reduced motion: the screen already on, SYSTEM READY and the name, nothing typed or flickering", () => {
    const st = boastStill(plan);
    expect(st.pieces).toHaveLength(1);
    expect(st.pieces[0]!.shape).toBe("bits");
    const crt = st.marks.find((m) => m.k === "crt")!;
    expect([crt.t, crt.on, crt.flick]).toEqual([0, 0, 0]);
    const name = st.marks.find((m) => m.k === "name")!;
    expect(name.type).toBeUndefined();
    expect(name.mono).toBe(true);
    expect(st.col).toBe(BOOT.col);
    expect(boastPlanProblem(st, geom)).toBeNull();
  });
});

describe("Dial-Up Fireworks (Season 0)", () => {
  const geom = layout({ seat: "p1" });
  const who = { name: "Bastion Relay", faction: "Aegis" };
  const plan = boastPlan(DIALUP, geom, 1, who);
  const towers = plan.pieces.filter((pc) => pc.grp === "tower");
  const letters = plan.pieces.filter((pc) => pc.grp === "letter");
  const rockets = plan.pieces.filter((pc) => pc.grp === "rocket");

  it("raises a neon skyline across the winner's side, centre first, every tower's foot on the floor", () => {
    const band = geom.band, bh = band.b - band.t, bw = band.r - band.l;
    expect(towers.length).toBeGreaterThanOrEqual(9);
    expect(towers.reduce((a, t) => a + t.w!, 0)).toBeGreaterThan(bw * 0.8);
    for (const t of towers) {
      expect(t.shape).toBe("tower");
      const feet = new Set<number>();
      for (let ms = t.keys[0]!.t; ms <= plan.ms; ms += 25) { const at = boastPieceAt(t, ms)!; feet.add(Math.round((at.y + at.s / 2) * 1000)); }
      expect(feet.size).toBe(1);
      const top = t.keys[1]!;
      expect(top.s).toBeLessThanOrEqual(bh * 0.34 + 1e-9);
      expect(top.s).toBeGreaterThanOrEqual(bh * 0.14 - 1e-9);
    }
    const first = [...towers].sort((a, b) => a.keys[0]!.t - b.keys[0]!.t);
    const cx = (band.l + band.r) / 2;
    expect(Math.abs(first[0]!.keys[0]!.x - cx)).toBeLessThan(Math.abs(first[first.length - 1]!.keys[0]!.x - cx));
    const modem = plan.marks.find((m) => m.k === "sound" && m.kind === "modem")!;
    expect(modem.t).toBeLessThan(200);
    expect(plan.marks.find((m) => m.k === "duck" && m.t === modem.t)).toBeTruthy();
  });

  it("spells the winner's name: every dot of it lands on its cell, a letter all one colour, the bursts left to right", () => {
    const fit = boastBitsFit("BASTION RELAY", (geom.band.r - geom.band.l) * 0.9, (geom.band.b - geom.band.t) * 0.34, 8);
    expect(letters).toHaveLength(fit.bits.dots.length);
    expect(plan.crestPieces).toBe(letters.length);
    const ends = letters.map((l) => l.keys[l.keys.length - 1]!);
    const xs = ends.map((k) => k.x), ys = ends.map((k) => k.y);
    // The spelled block is exactly the font's block at its cell size.
    expect(Math.round((Math.max(...xs) - Math.min(...xs)) / fit.cell)).toBe(Math.max(...fit.bits.dots.map((d) => d[0])) - Math.min(...fit.bits.dots.map((d) => d[0])));
    expect(Math.round((Math.max(...ys) - Math.min(...ys)) / fit.cell)).toBe(6);
    // Every dot flies up (or across) from its burst.
    for (const l of letters) expect(l.keys[1]!.y).toBeLessThanOrEqual(l.keys[0]!.y);
    // One colour per letter: dots that share a column band of 6 share an rgb.
    const byChar = new Map<number, Set<string>>();
    letters.forEach((l, i) => { const ch = fit.bits.dots[i]![2]; (byChar.get(ch) ?? byChar.set(ch, new Set()).get(ch)!).add(String(l.rgb)); });
    expect([...byChar.values()].every((set) => set.size === 1)).toBe(true);
    // 12 letters, 4 bursts of 3, left to right in time.
    expect(rockets).toHaveLength(4);
    const launch = rockets.map((r) => [r.keys[0]!.t, r.keys[2]!.x]).sort((a, b) => a[0]! - b[0]!);
    for (let i = 1; i < launch.length; i++) expect(launch[i]![1]).toBeGreaterThan(launch[i - 1]![1]!);
    // Each rocket rises from a rooftop to its burst.
    for (const r of rockets) expect(r.keys[2]!.y).toBeLessThan(r.keys[0]!.y);
    expect(plan.marks.filter((m) => m.k === "sound" && m.kind === "whistle")).toHaveLength(4);
    expect(plan.marks.filter((m) => m.k === "sound" && m.kind === "pop")).toHaveLength(4);
  });

  it("ends on the skyline and the spelled name: the rockets and the fans are gone; the lock adds no piece", () => {
    const showing = showingAtEnd(plan);
    expect(showing).toHaveLength(towers.length + letters.length);
    expect(plan.pieces.filter((pc) => pc.grp === "fan").every((pc) => pc.keys[pc.keys.length - 1]!.a === 0)).toBe(true);
    for (const l of letters) expect(l.keys[1]!.t).toBeLessThanOrEqual(DIALUP.beats.find((b) => b.p === "lock")!.at);
    const st = boastStill(plan);
    expect(st.pieces).toHaveLength(towers.length + letters.length);
    expect(st.pieces.every((pc) => pc.shape === "tower" || pc.shape === "dot")).toBe(true);
    expect(boastPlanProblem(st, geom)).toBeNull();
  });

  it("breaks a two-word name onto two lines on a phone", () => {
    const ph = boastPlan(DIALUP, layout({ seat: "p1", width: 360, slotW: 85, slotH: 114, lines: 2, pad: 6 }), 1, who);
    const ys = new Set(ph.pieces.filter((pc) => pc.grp === "letter").map((l) => Math.round(l.keys[1]!.y)));
    expect(ys.size).toBe(14);
  });
});

describe("the Season 0 boasts keep the grammar for any winner's name", () => {
  const names = ["Bo", "Coiljackal's Croupier", "A Very Long Agent Name 24", "X_9.Q-7", "Static Static Static"];
  it.each([["Boot Sequence", BOOT], ["Dial-Up Fireworks", DIALUP]] as [string, BoastSpec][])("%s over 120 random layouts and names", (_n, spec) => {
    const rand = seeded(23);
    for (let n = 0; n < 120; n++) {
      const lines = rand() < 0.3 ? 2 : 1;
      const slotW = 60 + rand() * 70, slotH = slotW * (1.25 + rand() * 0.2);
      const width = Math.max((lines === 1 ? 6 : 3) * (slotW + 8) + 20, 300 + rand() * 1200);
      const geom = layout({ seat: rand() < 0.5 ? "p1" : "p2", lines, slotW, slotH, width, filled: Math.floor(rand() * 7), pad: 4 + rand() * 10 });
      const plan = boastPlan(spec, geom, n, { name: names[n % names.length], faction: ["Aegis", "Swarm", "Null", "Cortex"][n % 4] });
      expect(boastPlanProblem(plan, geom), `layout ${n}`).toBeNull();
      expect(boastPlanProblem(boastStill(plan), geom), `still ${n}`).toBeNull();
    }
  });
});

// Render session 37 (owner 2026-10-21): every boast says clearly who won.
// The plate's line is "<NAME> WINS"; a close win shows the close-call line
// alone first, then the winner's line, and every other beat keeps its time.
describe("the win message", () => {
  const geom = layout({ seat: "p1" });
  const who = { name: "Bastion Relay", faction: "Aegis" };

  it("the plate's words: <NAME> WINS, and CLOSE CALL first on a close win (one of the owner's two wordings)", () => {
    expect(BOAST_WINS).toBe("WINS");
    expect(["CLOSE CALL", "CLOSE WIN"]).toContain(BOAST_CLOSE_LINE);
    expect(BOAST_CLOSE_MS).toBeGreaterThanOrEqual(400);
    expect(BOAST_CLOSE_MS).toBeLessThanOrEqual(800);
  });

  it.each(ALL)("%s: a close win holds the close-call line, then plays the same boast 0.6 s longer", (_bn, spec) => {
    const win = boastPlan(spec, geom, 4, who), close = boastPlan(spec, geom, 4, { ...who, close: true });
    expect(win.close).toBeUndefined();
    expect(close.close).toBe(true);
    expect(win.ms).toBe(spec.ms);
    expect(close.ms).toBe(spec.ms + BOAST_CLOSE_MS);
    const n0 = win.marks.find((m) => m.k === "name")!, n1 = close.marks.find((m) => m.k === "name")!;
    expect(n0.close).toBeUndefined();
    expect(n1.close).toBe(BOAST_CLOSE_MS);
    // The plate is the same box at the same moment (the close-call line takes
    // the winner's line's place), so the name still shows for as long after
    // the swap as it does in any other win.
    expect([n1.t, n1.x, n1.y, n1.w, n1.h]).toEqual([n0.t, n0.x, n0.y, n0.w, n0.h]);
    expect(close.ms - ((n1.t as number) + BOAST_CLOSE_MS)).toBe(win.ms - (n0.t as number));
    // Every other moment keeps its time: only the typed line's clicks move
    // (by the close-call line's hold), the end, and the music held to it.
    const shape = (p: BoastPlan) => p.marks
      .filter((m) => m.k !== "end" && m.k !== "duck" && m.k !== "name" && !(m.k === "sound" && m.kind === "type" && (m.t as number) >= (n0.t as number)))
      .map((m) => JSON.stringify(m));
    expect(shape(close)).toEqual(shape(win));
    const clicks = (p: BoastPlan) => p.marks.filter((m) => m.k === "sound" && m.kind === "type" && (m.t as number) >= (n0.t as number)).map((m) => m.t as number);
    expect(clicks(close)).toEqual(clicks(win).map((t) => t + BOAST_CLOSE_MS));
    expect(close.marks.find((m) => m.k === "end")!.t).toBe(close.ms);
    // Every piece is where it was until the plain boast ends, then holds.
    expect(close.pieces).toHaveLength(win.pieces.length);
    const off: string[] = [];
    win.pieces.forEach((pc, i) => {
      for (let t = 0; t < spec.ms; t += 50) {
        if (JSON.stringify(boastPieceAt(pc, t)) !== JSON.stringify(boastPieceAt(close.pieces[i]!, t))) off.push(`${i} at ${t}`);
      }
      const end0 = boastPieceAt(pc, spec.ms - 1), end1 = boastPieceAt(close.pieces[i]!, close.ms - 1);
      if (JSON.stringify(end0) !== JSON.stringify(end1)) off.push(`${i} at the end`);
    });
    expect(off).toEqual([]);
  });

  it.each(ALL)("%s: a close win keeps the grammar on every layout, still included", (_bn, spec) => {
    for (const seat of ["p1", "p2"] as const) {
      for (const g of [layout({ seat }), layout({ seat, filled: 0 }), layout({ seat, width: 360, slotW: 85, slotH: 114, lines: 2, pad: 6 })]) {
        const plan = boastPlan(spec, g, 9, { ...who, close: true });
        expect(boastPlanProblem(plan, g)).toBeNull();
        expect(boastPlanProblem(boastStill(plan), g)).toBeNull();
      }
    }
  });

  it("a typed plate (Boot Sequence) types the whole line, NAME WINS, after the close-call line, in at most 0.6 s", () => {
    for (const close of [false, true]) {
      const plan = boastPlan(BOOT, geom, 1, { ...who, close });
      const name = plan.marks.find((m) => m.k === "name")!;
      const line = `${who.name} ${BOAST_WINS}`;
      expect((name.type as number) * line.length).toBeLessThanOrEqual(600 + 1e-9);
      const clicks = plan.marks.filter((m) => m.k === "sound" && m.kind === "type" && (m.t as number) >= (name.t as number)).map((m) => m.t as number);
      expect(clicks).toHaveLength(Math.min(line.length, 16));
      expect(clicks[0]).toBe((name.t as number) + (close ? BOAST_CLOSE_MS : 0));
      expect(clicks[clicks.length - 1]!).toBeLessThan((name.t as number) + (close ? BOAST_CLOSE_MS : 0) + 600);
    }
  });

  it("reduced motion: the still swaps the words too (no motion) and holds 0.6 s longer on a close win", () => {
    for (const spec of [SHIELD, BOOT, DIALUP]) {
      const st = boastStill(boastPlan(spec, geom, 2, who)), sc = boastStill(boastPlan(spec, geom, 2, { ...who, close: true }));
      expect(st.ms).toBe(BOAST_STILL_MS);
      expect(sc.ms).toBe(BOAST_STILL_MS + BOAST_CLOSE_MS);
      expect(sc.close).toBe(true);
      const nm = sc.marks.find((m) => m.k === "name")!;
      expect([nm.t, nm.close, nm.type]).toEqual([0, BOAST_CLOSE_MS, undefined]);
      expect(st.marks.find((m) => m.k === "name")!.close).toBeUndefined();
    }
  });

  it("the runtime draws the line: the name, then WINS; the close-call line first; no VICTORY left", () => {
    expect(BOAST_RUNTIME_SOURCE).toContain("boast-wins");
    expect(BOAST_RUNTIME_SOURCE).toContain("BOAST_CLOSE_LINE");
    expect(BOAST_RUNTIME_SOURCE).not.toContain("VICTORY'");
    expect(BOAST_RUNTIME_SOURCE).not.toContain("CLOSE WIN");
    expect(BOAST_RUNTIME_SOURCE).toMatch(/close: !!opts\.close/);
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

  it("the Season 0 sounds: a tube, a beep, a modem under a second, a rising whistle, a pop; none a match-event sound", () => {
    for (const k of ["crt", "post", "modem", "whistle", "pop"]) {
      expect(SFX_KINDS).not.toContain(k);
      const v = sfxRecipe(k, "Cortex", "normal", seeded(5));
      expect(v.length, k).toBeGreaterThan(0);
      expect(v.length, k).toBeLessThanOrEqual(20);
    }
    const modem = sfxRecipe("modem", "Aegis", "normal", seeded(5));
    expect(Math.max(...modem.map((x) => (x.delay ?? 0) + x.dur))).toBeLessThan(1);
    // The dial tones are true two-tone pairs, then the 2100 Hz answer tone.
    expect(modem.filter((x) => x.k === "tone" && (x.delay ?? 0) < 0.3)).toHaveLength(8);
    expect(modem.some((x) => x.f0 === 2100)).toBe(true);
    const wh = sfxRecipe("whistle", "Null", "subtle", seeded(5)).find((x) => x.k === "tone")!;
    expect(wh.f1!).toBeGreaterThan(wh.f0);
    expect(sfxRecipe("post", "Swarm", "normal", seeded(5))).toHaveLength(1);
  });

  it("the sheet carries every scene and the replay's own sources", () => {
    const html = renderBoastSheet();
    expect(html).toContain(BOAST_PURE_SOURCE);
    expect(html).toContain(BOAST_RUNTIME_SOURCE);
    const scenes = boastScenes();
    for (const spec of Object.values(BOAST_SPECS)) {
      expect(scenes.filter((s) => s.boast === spec.id).map((s) => s.key.replace(/^.*-/, ""))).toEqual(["full", "empty", "top", "phone", "reduced"]);
      const mine = scenes.filter((s) => s.boast === spec.id);
      if (spec.faction) expect(mine.every((s) => s.winner.faction === spec.faction && s.loser.faction !== spec.faction)).toBe(true);
      // A neutral boast is shown on every faction's win, never a mirror.
      else {
        expect(new Set(mine.map((s) => s.winner.faction))).toEqual(new Set(["Cortex", "Aegis", "Swarm", "Null"]));
        expect(mine.every((s) => s.loser.faction !== s.winner.faction)).toBe(true);
      }
    }
    for (const s of scenes) expect(html).toContain(`id="${s.key}"`);
  });
});
