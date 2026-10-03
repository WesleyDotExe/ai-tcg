// EFFECTS.md v2 slice 1 (canvas FX layer, sprite materials). Four layers:
//  1. the sprite map matches the committed atlas manifest, and every kit
//     only names real cells;
//  2. axis 2: every faction the replays can name has its own kit in its
//     EFFECTS.md colour (Aegis orange), and the page's CSS agrees;
//  3. the tint maths: black is transparent, alpha is the brightest channel,
//     the hue is the faction's, brighter source = more opaque;
//  4. axis 3 + the meaning invariant: every recipe grows with the tier, the
//     flight lands exactly on the target at t = 1, and the page embeds the
//     same source the tests run, with the v1 DOM fallback still wired.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CANVAS_FX_PURE_SOURCE,
  CANVAS_FX_RUNTIME_SOURCE,
  FX_ATLAS_FILES,
  FX_IMPACT,
  FX_KITS,
  FX_SP,
  FX_TRAVEL,
  fxArcPoint,
  fxAtlasDataUris,
  fxDecalCover,
  fxFlightEase,
  fxImpactRecipe,
  fxKitOf,
  fxRgbOf,
  fxTintPixels,
  fxTravelRecipe,
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
