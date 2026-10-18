// Victory boasts, render slice 1: the victory grammar, the spec format and
// the Aegis boast (Shield Slam). Four layers:
//  1. the specs: valid, in step with the economy catalogue's starter boasts,
//     and boastIdFor plays the record's boast or the winner's faction
//     starter, never one of its own choosing;
//  2. the grammar on laid-out plans: over both seats, a full and an empty
//     row, desktop and phone layouts and 300 random layouts, every piece and
//     every one-shot mark stays inside the winner's side and off the
//     loser's, no piece moves down, sparks only fly up; and the checker
//     catches each kind of break (mutations);
//  3. the shape of Shield Slam: the wall, the crest of seven, the sting and
//     the name before the end at 3 s; the reduced-motion still (1 s, the
//     final pose, nothing moving); deterministic per seed;
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
    // Slice 1 builds the Aegis boast; the other three come in slice 2.
    expect(Object.keys(BOAST_SPECS)).toEqual(["boast-aegis-shield-slam"]);
  });

  it("boastIdFor plays the record's boast, else the winner's faction starter, else none", () => {
    expect(boastIdFor(null, "Aegis")).toBe("boast-aegis-shield-slam");
    expect(boastIdFor("boast-aegis-shield-slam", "Cortex")).toBe("boast-aegis-shield-slam");
    // A record boast the render can't draw yet falls back to the faction's.
    expect(boastIdFor("boast-s1-not-drawn-yet", "Aegis")).toBe("boast-aegis-shield-slam");
    // Not built yet: no boast (the result line plays as before).
    expect(boastIdFor(null, "Swarm")).toBeNull();
    expect(boastIdFor(null, "Neutral")).toBeNull();
  });

  it("refuses broken specs", () => {
    const bad = (f: (s: BoastSpec) => void) => { const s = clone(SHIELD); f(s); return boastSpecProblem(s); };
    expect(bad((s) => { s.beats = s.beats.filter((b) => b.p !== "name"); })).toMatch(/name/);
    expect(bad((s) => { s.beats[1]!.p = "explode"; })).toMatch(/unknown primitive/);
    expect(bad((s) => { s.ms = BOAST_MS_MAX + 1; })).toMatch(/length/);
    expect(bad((s) => { s.beats.reverse(); })).toMatch(/time order/);
    expect(bad((s) => { s.beats = s.beats.filter((b) => b.p !== "wall"); })).toMatch(/gather needs a wall/);
    expect(bad((s) => { s.beats[s.beats.length - 1]!.at = s.ms + 10; })).toMatch(/after the boast ends/);
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

  it.each(cases)("Shield Slam keeps the grammar: %s", (_name, geom) => {
    const plan = boastPlan(SHIELD, geom, 3);
    expect(boastPlanProblem(plan, geom)).toBeNull();
    expect(boastPlanProblem(boastStill(plan), geom)).toBeNull();
  });

  it("holds over 300 random layouts and seeds", () => {
    const rand = seeded(11);
    let checked = 0;
    for (let n = 0; n < 300; n++) {
      const lines = rand() < 0.3 ? 2 : 1;
      const slotW = 60 + rand() * 70, slotH = slotW * (1.25 + rand() * 0.2);
      const width = Math.max((lines === 1 ? 6 : 3) * (slotW + 8) + 20, 300 + rand() * 1200);
      const geom = layout({ seat: rand() < 0.5 ? "p1" : "p2", lines, slotW, slotH, width, filled: Math.floor(rand() * 7), pad: 4 + rand() * 10 });
      const plan = boastPlan(SHIELD, geom, n);
      expect(boastPlanProblem(plan, geom), `layout ${n}`).toBeNull();
      expect(boastPlanProblem(boastStill(plan), geom), `still ${n}`).toBeNull();
      checked++;
    }
    expect(checked).toBe(300);
  });

  it("sampled at every 10 ms, no piece ever moves down or leaves the winner's side", () => {
    for (const [name, geom] of cases) {
      const plan = boastPlan(SHIELD, geom, 5);
      for (const pc of plan.pieces) {
        let lastY = Infinity;
        for (let t = 0; t <= plan.ms + 400; t += 10) {
          const at = boastPieceAt(pc, t);
          if (!at) continue;
          expect(at.y, name).toBeLessThanOrEqual(lastY + 1e-6);
          lastY = at.y;
          if (at.a > 0.01) {
            expect(at.y - at.s / 2, name).toBeGreaterThanOrEqual(geom.band.t - 2);
            expect(at.y + at.s / 2, name).toBeLessThanOrEqual(geom.band.b + 2);
            expect(at.x - at.s / 2, name).toBeGreaterThanOrEqual(geom.band.l - 2);
            expect(at.x + at.s / 2, name).toBeLessThanOrEqual(geom.band.r + 2);
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
    expect(scenes.map((s) => s.key.replace(/^.*-/, ""))).toEqual(["full", "empty", "top", "phone", "reduced"]);
    for (const s of scenes) expect(html).toContain(`id="${s.key}"`);
  });
});
