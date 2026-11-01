// The owner website's look (render session 45): the backgrounds, which
// theme draws, the still gradients, the liquid's pacing and the wallet's
// numbers. siteLook.ts is what the page bundles, so this is what runs.

import { describe, expect, it } from "vitest";
import { BACKGROUNDS as ACCOUNT_BACKGROUNDS, DEFAULT_ACCOUNT_SETTINGS } from "../../economy/src/accountSettings.js";
import {
  BACKGROUNDS,
  BACKGROUND_IDS,
  DEFAULT_BACKGROUND,
  LIQUID_FRAME_MS,
  LIQUID_SCALE,
  LIQUID_SCALES,
  LIQUID_SLOW_FPS,
  LIQUID_WINDOW,
  amount,
  backgroundOf,
  canvasSize,
  cssRgb,
  drawnTheme,
  easeDarkness,
  liquidColours,
  liquidPause,
  nextScale,
  openButton,
  shouldDrawFrame,
  stillGradient,
} from "../src/site/siteLook.js";

describe("the backgrounds", () => {
  it("are the account settings' list, in its order, with Glacier the default on both sides", () => {
    expect([...BACKGROUND_IDS]).toEqual([...ACCOUNT_BACKGROUNDS]);
    expect(DEFAULT_BACKGROUND).toBe("glacier");
    expect(DEFAULT_ACCOUNT_SETTINGS.background).toBe(DEFAULT_BACKGROUND);
  });
  it("six liquid colours, each with a light and a dark version, and two plain ones (the spec's names)", () => {
    const names = BACKGROUND_IDS.map((id) => BACKGROUNDS[id].name);
    expect(names).toEqual(["Glacier", "Ocean", "Aurora", "Sunset", "Lavender", "Graphite", "Plain black", "Plain purple"]);
    for (const id of BACKGROUND_IDS) {
      const b = BACKGROUNDS[id];
      expect(b.id).toBe(id);
      if (b.kind === "liquid") {
        for (const set of [b.light, b.dark]) {
          expect(set).toHaveLength(4);
          for (const c of set) for (const v of c) expect(v >= 0 && v <= 1).toBe(true);
        }
        // The dark version really is darker, colour by colour.
        const lum = (c: readonly number[]) => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
        for (let i = 0; i < 4; i++) expect(lum(b.dark[i]!)).toBeLessThan(lum(b.light[i]!) - 0.4);
      }
    }
    expect(BACKGROUND_IDS.filter((id) => BACKGROUNDS[id].kind === "plain")).toEqual(["black", "purple"]);
  });
  it("an id the page doesn't know (an older or newer server) reads as Glacier, never as nothing", () => {
    expect(backgroundOf("ocean").name).toBe("Ocean");
    expect(backgroundOf("neon").id).toBe("glacier");
    expect(backgroundOf(null).id).toBe("glacier");
    expect(backgroundOf("constructor").id).toBe("glacier");
    expect(backgroundOf("__proto__").id).toBe("glacier");
  });
});

describe("which theme draws", () => {
  it("a liquid background follows the owner's choice, or the computer's on System", () => {
    expect(drawnTheme("system", "glacier", true)).toBe("dark");
    expect(drawnTheme("system", "glacier", false)).toBe("light");
    expect(drawnTheme("light", "sunset", true)).toBe("light");
    expect(drawnTheme("dark", "aurora", false)).toBe("dark");
  });
  it("a plain background always draws dark, whatever the choice", () => {
    for (const pref of ["system", "light", "dark"] as const) for (const sys of [true, false]) {
      expect(drawnTheme(pref, "black", sys)).toBe("dark");
      expect(drawnTheme(pref, "purple", sys)).toBe("dark");
    }
  });
});

describe("the liquid's colours", () => {
  const g = BACKGROUNDS.glacier;
  it("at 0 the light version, at 1 the dark, between them a blend; clamped outside", () => {
    expect(liquidColours(g, 0)).toEqual(g.kind === "liquid" ? g.light : null);
    expect(liquidColours(g, 1)).toEqual(g.kind === "liquid" ? g.dark : null);
    const half = liquidColours(g, 0.5)!;
    if (g.kind !== "liquid") throw new Error("glacier is liquid");
    expect(half[0][0]).toBeCloseTo((g.light[0][0] + g.dark[0][0]) / 2, 10);
    expect(liquidColours(g, -3)).toEqual(liquidColours(g, 0));
    expect(liquidColours(g, 7)).toEqual(liquidColours(g, 1));
  });
  it("a plain background has none (the canvas hides)", () => {
    expect(liquidColours(BACKGROUNDS.black, 0)).toBeNull();
  });
  it("a theme change fades over about a second, the same at any frame rate; reduce motion jumps", () => {
    const fade = (fps: number) => {
      let d = 0, t = 0, t90 = 0;
      while (d !== 1 && t < 20000) {
        d = easeDarkness(d, 1, 1000 / fps, false);
        t += 1000 / fps;
        if (!t90 && d >= 0.9) t90 = t;
      }
      return { t90, landed: t, d };
    };
    for (const fps of [30, 12, 60]) {
      const f = fade(fps);
      expect(f.d).toBe(1); // it lands exactly, not forever approaching
      // Most of the way (90%) in 0.8-1.2 s, at 30, 12 or 60 fps alike.
      expect(f.t90).toBeGreaterThan(800);
      expect(f.t90).toBeLessThan(1200);
      expect(f.landed).toBeLessThan(3000);
    }
    // A stall (a quarter second or more between frames) moves it at most a quarter second's worth.
    expect(easeDarkness(0, 1, 5000, false)).toBeCloseTo(easeDarkness(0, 1, 250, false), 10);
    expect(easeDarkness(0.5, 1, -10, false)).toBe(0.5);
    expect(easeDarkness(0, 1, 16, true)).toBe(1);
    expect(easeDarkness(1, 0, 16, true)).toBe(0);
  });
});

describe("the still gradients (the swatches, and the background before the first frame or without WebGL)", () => {
  it("the mockup's swatch: colours 1, 3 and 4 of the version the theme draws", () => {
    expect(stillGradient(BACKGROUNDS.glacier, false)).toBe("linear-gradient(135deg, rgb(222,230,247), rgb(212,207,242) 55%, rgb(191,219,247))");
    expect(stillGradient(BACKGROUNDS.glacier, true)).toBe("linear-gradient(135deg, rgb(13,18,36), rgb(38,36,77) 55%, rgb(18,43,87))");
  });
  it("a plain background is its one colour, light or dark", () => {
    expect(stillGradient(BACKGROUNDS.black, false)).toBe("#050507");
    expect(stillGradient(BACKGROUNDS.purple, true)).toBe("#24174f");
  });
  it("cssRgb rounds and clamps", () => {
    expect(cssRgb([0, 0.5, 1])).toBe("rgb(0,128,255)");
    expect(cssRgb([-1, 2, 0.001])).toBe("rgb(0,255,0)");
  });
});

describe("the liquid's pacing (the spec: low resolution, about 30 fps, paused when not seen)", () => {
  it("draws at 0.3 of the window, never below 2 px", () => {
    expect(LIQUID_SCALE).toBe(0.3);
    expect(canvasSize(1440, 900)).toEqual({ width: 432, height: 270 });
    expect(canvasSize(0, 0)).toEqual({ width: 2, height: 2 });
  });
  it("about 30 frames a second: on a 60 Hz screen every other frame draws, jitter or not", () => {
    // 60 Hz frames with +-1.5 ms of jitter, for 10 s.
    let last = -Infinity, drawn = 0;
    let jit = 7;
    for (let i = 0; i < 600; i++) {
      jit = (jit * 31 + 17) % 97;
      const now = i * (1000 / 60) + (jit / 97 - 0.5) * 3;
      if (shouldDrawFrame(now, last, null)) { drawn++; last = now; }
    }
    expect(drawn).toBeGreaterThanOrEqual(295);
    expect(drawn).toBeLessThanOrEqual(305);
    // On a 120 Hz screen it's still about 30 (every fourth frame or so).
    last = -Infinity; drawn = 0;
    for (let i = 0; i < 1200; i++) if (shouldDrawFrame(i * (1000 / 120), last, null)) { drawn++; last = i * (1000 / 120); }
    expect(drawn).toBeGreaterThanOrEqual(290);
    expect(drawn).toBeLessThanOrEqual(310);
    expect(LIQUID_FRAME_MS).toBeLessThan(1000 / 30);
  });
  it("a slow machine steps the resolution down, one step a window, to a floor; never back up", () => {
    expect([...LIQUID_SCALES]).toEqual([0.3, 0.2, 0.14]);
    expect(LIQUID_SCALES[0]).toBe(LIQUID_SCALE);
    expect(nextScale(0.3, 29.9)).toBe(0.3);
    expect(nextScale(0.3, LIQUID_SLOW_FPS)).toBe(0.3);
    expect(nextScale(0.3, 11.7)).toBe(0.2);
    expect(nextScale(0.2, 15)).toBe(0.14);
    expect(nextScale(0.14, 3)).toBe(0.14);
    expect(nextScale(0.14, 30)).toBe(0.14);
    // Each step about halves the pixels (the blur hides it).
    for (let i = 1; i < LIQUID_SCALES.length; i++) {
      const ratio = (LIQUID_SCALES[i]! / LIQUID_SCALES[i - 1]!) ** 2;
      expect(ratio).toBeGreaterThan(0.4);
      expect(ratio).toBeLessThan(0.55);
    }
    // A window is long enough that a short stall isn't "slow".
    expect(LIQUID_WINDOW.ms).toBeGreaterThanOrEqual(2000);
    expect(LIQUID_WINDOW.frames).toBeGreaterThanOrEqual(30);
  });
  it("paused: never draws a frame", () => {
    for (const p of ["hidden", "covered", "plain", "still", "no-webgl"] as const) expect(shouldDrawFrame(1e9, 0, p)).toBe(false);
  });
  it("why it pauses, in order: no WebGL, a plain background, a hidden tab, covered, reduce motion", () => {
    const base = { webgl: true, tabHidden: false, covered: false, plain: false, reduceMotion: false };
    expect(liquidPause(base)).toBeNull();
    expect(liquidPause({ ...base, reduceMotion: true })).toBe("still");
    expect(liquidPause({ ...base, covered: true, reduceMotion: true })).toBe("covered");
    expect(liquidPause({ ...base, tabHidden: true, covered: true })).toBe("hidden");
    expect(liquidPause({ ...base, plain: true, tabHidden: true })).toBe("plain");
    expect(liquidPause({ ...base, webgl: false, plain: true })).toBe("no-webgl");
  });
});

describe("the wallet in the top bar", () => {
  it("whole numbers with thousands separators; nothing below zero or not a number", () => {
    expect(amount(0)).toBe("0");
    expect(amount(950)).toBe("950");
    expect(amount(12400)).toBe("12,400");
    expect(amount(1234567.9)).toBe("1,234,567");
    expect(amount(-5)).toBe("0");
    expect(amount(NaN)).toBe("0");
  });
  it("the Open button says how many packs wait", () => {
    expect(openButton(0)).toEqual({ label: "No packs to open", count: 0, enabled: false });
    expect(openButton(1)).toEqual({ label: "Open 1 pack", count: 1, enabled: true });
    expect(openButton(3)).toEqual({ label: "Open 3 packs", count: 3, enabled: true });
  });
});
