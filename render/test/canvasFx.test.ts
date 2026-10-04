// EFFECTS.md v2 slices 1-2 (canvas FX layer, sprite materials, every
// category's faction material, the kill + camera beats). Five layers:
//  1. the sprite map matches the committed atlas manifest, and every kit
//     only names real cells;
//  2. axis 2: every faction the replays can name has its own kit in its
//     EFFECTS.md colour (Aegis orange), and the page's CSS agrees;
//  3. the tint maths: black is transparent, alpha is the brightest channel,
//     the hue is the faction's, brighter source = more opaque;
//  4. axis 3 + the meaning invariant: every recipe grows with the tier, the
//     flight lands exactly on the target at t = 1, and the page embeds the
//     same source the tests run, with the v1 DOM fallback still wired;
//  5. slice 2: every kit names a variant for every category (Neutral's
//     debuff is Swarm's acid), every spell volley lands its last shot
//     exactly when the number shows and none later, the camera beats are
//     spectacle-only, and reduced motion turns them off.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CANVAS_FX_PURE_SOURCE,
  CANVAS_FX_RUNTIME_SOURCE,
  FX_ATLAS_FILES,
  FX_CATEGORIES,
  FX_IMPACT,
  FX_KILL,
  FX_KITS,
  FX_SPELL_SHOTS,
  FX_SP,
  FX_TRAVEL,
  fxArcPoint,
  fxAtlasDataUris,
  fxCurve,
  fxDecalCover,
  fxFlightEase,
  fxImpactRecipe,
  fxKitOf,
  fxRgbOf,
  fxShotCount,
  fxTintPixels,
  fxTravelRecipe,
  fxVariant,
  fxVolleySchedule,
} from "../src/canvasFx.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import type { MatchReplay } from "../src/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(here, "../assets/manifest.json"), "utf8")) as { fx: { cells: Record<string, string>; files: string[] } };
const FACTIONS = ["Cortex", "Aegis", "Swarm", "Null", "Neutral"] as const;
const TIERS = ["subtle", "normal", "spectacle"] as const;
// EFFECTS.md, Axis 2.
const SPEC_COLOURS = { Cortex: "#35c9ff", Aegis: "#ff7d24", Swarm: "#8bff5c", Null: "#d565ff", Neutral: "#ffcf5c" };

describe("sprite map vs the committed atlases", () => {
  it("is a permutation of the 48 cells", () => {
    const ids = Object.values(FX_SP).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 48 }, (_, i) => i));
    expect(Object.keys(manifest.fx.cells)).toHaveLength(48);
  });

  it("names the same thing the manifest says lives in that cell", () => {
    const expected: Record<string, string> = {
      smoke: "smoke puff", smokeTrail: "smoke trail", embers: "ember", molten: "molten", shrapnel: "shrapnel",
      hexPlate: "hex plate", crackedHex: "cracked hex", scorch: "scorch", goo: "goo", chitin: "chitin", spores: "spore",
      glitch: "glitch", pixels: "pixels", circuit: "circuit", arc: "electric arc", shard: "data shard", cube: "wireframe cube",
      wing: "wing", claw: "claw", rift: "rift", glass: "glass", darkStar: "dark star", glint: "glint", rays: "light rays",
      rune: "rune", feather: "feather", shock: "shockwave", flare: "lens flare", crater: "crater", dust: "sparkle dust",
    };
    for (const [name, words] of Object.entries(expected)) {
      expect(manifest.fx.cells[String(FX_SP[name])], name).toContain(words);
    }
  });

  it("embeds exactly the three committed atlas files, as webp data URIs", () => {
    expect(manifest.fx.files.map((f) => f.split("/").pop())).toEqual([...FX_ATLAS_FILES]);
    const uris = fxAtlasDataUris();
    expect(uris).toHaveLength(3);
    uris.forEach((u, i) => {
      expect(u.startsWith("data:image/webp;base64,")).toBe(true);
      const bytes = readFileSync(resolve(here, "../assets/fx", FX_ATLAS_FILES[i]!));
      expect(Buffer.from(u.split(",")[1]!, "base64").equals(bytes)).toBe(true);
    });
  });
});

describe("axis 2: faction kits", () => {
  it("gives every faction its own kit in its EFFECTS.md colour, and an unknown faction the Neutral one", () => {
    for (const f of FACTIONS) expect(fxKitOf(f).col).toBe(SPEC_COLOURS[f]);
    expect(new Set(FACTIONS.map((f) => fxKitOf(f).col)).size).toBe(FACTIONS.length);
    expect(fxKitOf("Someday-Faction")).toBe(FX_KITS.Neutral);
    expect(fxKitOf(undefined)).toBe(FX_KITS.Neutral);
    expect(fxRgbOf("Aegis")).toEqual([255, 125, 36]);
  });

  it("kits only name real cells, and each faction is made of different material", () => {
    for (const f of FACTIONS) {
      const k = fxKitOf(f);
      for (const id of [...k.debris, k.trail, k.head, k.decal]) expect(id >= 0 && id < 48).toBe(true);
      expect(k.debris).toHaveLength(4);
    }
    const prints = FACTIONS.map((f) => { const k = fxKitOf(f); return [k.trail, k.head, k.decal, k.flavor].join(","); });
    expect(new Set(prints).size).toBe(FACTIONS.length);
    expect(new Set(FACTIONS.map((f) => fxKitOf(f).decal)).size).toBe(FACTIONS.length);
  });
});

describe("the tint", () => {
  const px = (l: number) => new Uint8ClampedArray([l, l, l, 255]);

  it("makes black fully transparent", () => {
    for (const f of FACTIONS) expect(Array.from(fxTintPixels(px(0), fxRgbOf(f)))).toEqual([0, 0, 0, 0]);
  });

  it("sets alpha to the brightest channel and keeps the faction's hue", () => {
    for (const f of FACTIONS) {
      const c = fxRgbOf(f);
      const out = fxTintPixels(px(128), c);
      const l = 128 / 255, core = l * l * l * 0.62 * 255;
      const raw = c.map((v) => Math.min(255, v * l + core));
      expect(out[3]).toBe(Math.round(Math.max(...raw)));
      // Renormalised: the brightest channel is full, the others in the
      // faction's own proportion (within the tiny white core's lift).
      expect(Math.max(out[0]!, out[1]!, out[2]!)).toBe(255);
      const top = c.indexOf(Math.max(...c));
      expect(out[top]).toBe(255);
    }
  });

  it("brighter source pixels are more opaque, and white-hot ones get a white core", () => {
    const c = fxRgbOf("Null");
    let prev = -1;
    for (let l = 8; l <= 255; l += 8) {
      const a = fxTintPixels(px(l), c)[3]!;
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
    const hot = fxTintPixels(px(255), c), dim = fxTintPixels(px(60), c);
    const minRatio = (p: Uint8ClampedArray) => Math.min(p[0]!, p[1]!, p[2]!) / 255;
    expect(minRatio(hot)).toBeGreaterThan(minRatio(dim));
  });
});

describe("axis 3 + the meaning invariant", () => {
  it("every travel and impact number grows with the tier", () => {
    for (const key of Object.keys(FX_TRAVEL.normal) as (keyof typeof FX_TRAVEL.normal)[]) {
      if (key === "trailEvery") continue; // an emission interval: lower = denser
      expect(FX_TRAVEL.subtle[key]).toBeLessThanOrEqual(FX_TRAVEL.normal[key]);
      expect(FX_TRAVEL.normal[key]).toBeLessThanOrEqual(FX_TRAVEL.spectacle[key]);
    }
    for (const key of Object.keys(FX_IMPACT.normal)) {
      expect(FX_IMPACT.subtle[key]!, key).toBeLessThanOrEqual(FX_IMPACT.normal[key]!);
      expect(FX_IMPACT.normal[key]!, key).toBeLessThanOrEqual(FX_IMPACT.spectacle[key]!);
    }
    expect(FX_IMPACT.spectacle.sparks).toBeGreaterThan(FX_IMPACT.subtle.sparks * 4);
    // A subtle ping leaves nothing on the table; a bigger hit's mark reaches
    // past the card it hit (so it shows around a card instead of under it).
    expect(fxDecalCover("subtle")).toBe(0);
    expect(fxDecalCover("normal")).toBeGreaterThan(1);
    expect(fxDecalCover("spectacle")).toBeGreaterThan(fxDecalCover("normal"));
  });

  it("a hit on a player is wider and flatter than a hit on a card; a return bolt is smaller", () => {
    for (const t of TIERS) {
      const unit = fxImpactRecipe(t, "unit"), face = fxImpactRecipe(t, "player");
      expect(unit.shockSx).toBe(1);
      expect(face.shockSx).toBeGreaterThan(1);
      expect(face.shockSy).toBeLessThan(1);
      expect(face.sparks).toBeGreaterThanOrEqual(unit.sparks);
      expect(fxTravelRecipe(t, true).size).toBeLessThan(fxTravelRecipe(t, false).size);
    }
    // Recipes are copies: a caller can't mutate the shared table.
    fxImpactRecipe("normal", "player").sparks = 9999;
    expect(FX_IMPACT.normal.sparks).not.toBe(9999);
  });

  it("the flight leaves the attacker and lands exactly on the target at t = 1", () => {
    expect(fxFlightEase(0)).toBe(0);
    expect(fxFlightEase(1)).toBe(1);
    expect(fxFlightEase(-1)).toBe(0);
    expect(fxFlightEase(2)).toBe(1);
    let prev = 0;
    for (let t = 0.05; t <= 1; t += 0.05) { const e = fxFlightEase(t); expect(e).toBeGreaterThan(prev); prev = e; }
    const arc = { a: { x: 100, y: 500 }, c: { x: 180, y: 300 }, b: { x: 420, y: 120 } };
    expect(fxArcPoint(arc, 0)).toEqual(arc.a);
    expect(fxArcPoint(arc, 1)).toEqual(arc.b);
  });
});

describe("the page", () => {
  const replay: MatchReplay = {
    title: "fx", seed: 1, factions: { p1: "Cortex", p2: "Aegis" }, movesPlayed: 0, frames: [],
    identities: { p1: { username: "a", avatarSvg: "<svg></svg>" }, p2: { username: "b", avatarSvg: "<svg></svg>" } },
    cardFactions: {}, cardRarities: {},
  } as unknown as MatchReplay;
  const html = renderMatchHtml(replay);

  it("embeds both halves verbatim and the atlases as data", () => {
    expect(html).toContain(CANVAS_FX_PURE_SOURCE);
    expect(html).toContain(CANVAS_FX_RUNTIME_SOURCE);
    const m = html.match(/<script type="application\/json" id="fx-atlases">([^<]*)<\/script>/);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1]!)).toEqual(fxAtlasDataUris());
  });

  it("keeps the CSS faction colours on the EFFECTS.md palette (Aegis orange)", () => {
    for (const f of FACTIONS) expect(html).toContain(`--${f.toLowerCase()}: ${SPEC_COLOURS[f]};`);
  });

  it("falls back to the v1 DOM bolt and burst when the canvas can't draw", () => {
    expect(html).toContain("if (!CFX.travel(fromR, toR, f, strikeTier, strikeT, false)) spawnBolt(");
    expect(html).toMatch(/if \(!CFX\.impact\(toR, f, strikeTier, strike\.target\.kind\) && strikeTier !== 'subtle'\) spawnBurst\(/);
    expect(html).toContain("CFX.clear();");
  });
});

describe("slice 2: every category in every faction's material", () => {
  it("every kit names a variant for every category; the variants differ by faction, except Neutral's debuff, which is Swarm's acid", () => {
    expect(FX_CATEGORIES).toEqual(["spell", "removal", "heal", "buff", "debuff"]);
    for (const cat of FX_CATEGORIES) {
      const vs = FACTIONS.map((f) => fxVariant(f, cat));
      vs.forEach((v) => expect(typeof v === "string" && v.length > 0).toBe(true));
      if (cat === "debuff") {
        expect(fxVariant("Neutral", "debuff")).toBe(fxVariant("Swarm", "debuff"));
        expect(new Set(vs).size).toBe(FACTIONS.length - 1);
      } else expect(new Set(vs).size, cat).toBe(FACTIONS.length);
    }
    // EFFECTS.md's material table, spelled out.
    expect(FACTIONS.map((f) => fxVariant(f, "spell"))).toEqual(["laser", "shells", "swarm", "blink", "lances"]);
    expect(FACTIONS.map((f) => fxVariant(f, "removal"))).toEqual(["orbital", "breach", "devour", "vortex", "smite"]);
    expect(fxVariant("Unknown-Faction", "heal")).toBe(fxVariant("Neutral", "heal"));
    for (const v of FACTIONS.map((f) => fxVariant(f, "spell"))) expect(FX_SPELL_SHOTS[v], v).toBeGreaterThan(0);
  });

  it("every spell volley lands its last shot exactly at ms and nothing after it, at every tier and speed", () => {
    for (const f of FACTIONS) for (const tier of TIERS) for (const ms of [60, 120, 168, 210, 284, 400]) {
      const v = fxVariant(f, "spell");
      const n = fxShotCount(v, tier);
      const plan = fxVolleySchedule(v, n, ms);
      expect(plan).toHaveLength(n);
      for (const s of plan) {
        expect(s.at).toBeGreaterThanOrEqual(0);
        expect(s.dur).toBeGreaterThanOrEqual(0);
        expect(s.at + s.dur).toBeLessThanOrEqual(ms + 1e-9);
      }
      expect(Math.abs(plan[n - 1]!.at + plan[n - 1]!.dur - ms)).toBeLessThan(1e-9);
    }
    expect(fxVolleySchedule("laser", 0, 200)).toEqual([]);
  });

  it("a bigger tier fires at least as many shots", () => {
    for (const v of Object.keys(FX_SPELL_SHOTS)) {
      expect(fxShotCount(v, "subtle")).toBeGreaterThanOrEqual(1);
      expect(fxShotCount(v, "subtle")).toBeLessThanOrEqual(fxShotCount(v, "normal"));
      expect(fxShotCount(v, "normal")).toBeLessThanOrEqual(fxShotCount(v, "spectacle"));
    }
  });

  it("a curve leaves the source and lands on the target exactly; bend 0 is a straight line", () => {
    const a = { x: 40, y: 600 }, b = { x: 900, y: 140 };
    for (const [bend, side, lob] of [[0, 1, 0], [0.45, -1, 0], [0.05, 1, -170]] as const) {
      const c = fxCurve(a, b, bend, side, lob);
      expect(fxArcPoint(c, 0)).toEqual(a);
      expect(fxArcPoint(c, 1)).toEqual(b);
    }
    const straight = fxCurve(a, b, 0, 1, 0);
    expect(straight.c).toEqual({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  });

  it("kills grow with the tier, and the camera beats are spectacle-only (hit-stop ~120 ms on a kill)", () => {
    for (const key of Object.keys(FX_KILL.normal)) {
      expect(FX_KILL.subtle[key]!, key).toBeLessThanOrEqual(FX_KILL.normal[key]!);
      expect(FX_KILL.normal[key]!, key).toBeLessThanOrEqual(FX_KILL.spectacle[key]!);
    }
    expect(FX_KILL.spectacle.hitStop).toBe(120);
    expect(FX_KILL.spectacle.fringe).toBeGreaterThan(0);
    for (const t of ["subtle", "normal"] as const) {
      expect(FX_KILL[t].hitStop).toBe(0);
      expect(FX_KILL[t].fringe).toBe(0);
      expect(FX_IMPACT[t].hitStop).toBe(0);
      expect(FX_IMPACT[t].punch).toBe(0);
      expect(FX_IMPACT[t].shake).toBe(0);
    }
    expect(FX_IMPACT.spectacle.hitStop).toBeGreaterThan(0);
    expect(FX_KILL.spectacle.punch).toBeGreaterThan(FX_IMPACT.spectacle.punch);
  });

  it("the runtime honours prefers-reduced-motion and draws the grid at the bottom of the floor", () => {
    expect(CANVAS_FX_RUNTIME_SOURCE).toContain("prefers-reduced-motion: reduce");
    for (const fn of ["function hitStop(ms) { if (!REDUCED", "if (REDUCED || !camEl", "function doShake(amp, ms) { if (!REDUCED", "function doFringe(ms) { if (!REDUCED", "if (!ok || REDUCED || !G.dx", "if (!ok || REDUCED || !G.tint"]) {
      expect(CANVAS_FX_RUNTIME_SOURCE, fn).toContain(fn);
    }
    const html = renderMatchHtml({
      title: "fx", seed: 1, factions: { p1: "Cortex", p2: "Aegis" }, movesPlayed: 0, frames: [],
      identities: { p1: { username: "a", avatarSvg: "<svg></svg>" }, p2: { username: "b", avatarSvg: "<svg></svg>" } },
      cardFactions: {}, cardRarities: {},
    } as unknown as MatchReplay);
    expect(html).toContain(".fx-canvas.fx-floor { z-index: 0; }");
    // Grid first, then the floor's own marks on top of it.
    const d = CANVAS_FX_RUNTIME_SOURCE.indexOf("function draw()");
    expect(CANVAS_FX_RUNTIME_SOURCE.indexOf("gridDraw(flc);", d)).toBeLessThan(CANVAS_FX_RUNTIME_SOURCE.indexOf("if (P[i].layer === 0) drawP(flc, P[i]);", d));
  });
});
