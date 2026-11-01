// The owner website's look (Season 0 render item 2, render session 45): the
// liquid backgrounds' colours, which theme the page draws, the background
// picker's swatches, and the liquid's frame pacing. Pure: no DOM, no WebGL;
// the page bundles this file (liquid.ts draws with it) and the tests import
// it directly, so what is tested is what runs.
//
// The spec is the owner's 2026-10-05 "website first" entry, D (look and
// feel), kept by the 2026-11-01 Season 0 list:
// - a slow-moving liquid gradient drawn in the browser (WebGL), behind the
//   glass sidebar, top bar, panels and dialogs;
// - Glacier (default, soft blue-grey), Ocean, Aurora, Sunset, Lavender,
//   Graphite, each with a light and a dark version; Plain black and Plain
//   purple, which always use dark mode; the choice saves to the account;
// - reduce motion keeps the background still; low resolution, about 30
//   frames a second, paused when the tab is hidden or the background isn't
//   visible.
// The colours are render/reference/owner-web-mockup.html's, unchanged.

import type { ThemePref } from "./siteModel.js";

/** The ids the account settings take (server/OWNER_API.md), in the
 * picker's order. */
export const BACKGROUND_IDS = ["glacier", "ocean", "aurora", "sunset", "lavender", "graphite", "black", "purple"] as const;
export type BackgroundId = (typeof BACKGROUND_IDS)[number];
export const DEFAULT_BACKGROUND: BackgroundId = "glacier";

/** An RGB colour, each channel 0..1 (the shader's own form). */
export type Rgb = readonly [number, number, number];
/** The liquid's four colours: two blended by the field's height, two
 * across the screen. */
export type Four = readonly [Rgb, Rgb, Rgb, Rgb];

export type Background =
  | { id: BackgroundId; name: string; kind: "liquid"; light: Four; dark: Four }
  | { id: BackgroundId; name: string; kind: "plain"; colour: string };

export const BACKGROUNDS: Record<BackgroundId, Background> = {
  glacier: { id: "glacier", name: "Glacier", kind: "liquid", light: [[0.87, 0.9, 0.97], [0.77, 0.83, 0.96], [0.83, 0.81, 0.95], [0.75, 0.86, 0.97]], dark: [[0.05, 0.07, 0.14], [0.09, 0.13, 0.27], [0.15, 0.14, 0.3], [0.07, 0.17, 0.34]] },
  ocean: { id: "ocean", name: "Ocean", kind: "liquid", light: [[0.84, 0.94, 0.97], [0.7, 0.88, 0.95], [0.78, 0.9, 0.98], [0.66, 0.82, 0.96]], dark: [[0.02, 0.08, 0.12], [0.03, 0.17, 0.25], [0.05, 0.12, 0.24], [0.02, 0.24, 0.32]] },
  aurora: { id: "aurora", name: "Aurora", kind: "liquid", light: [[0.86, 0.96, 0.92], [0.74, 0.92, 0.86], [0.8, 0.9, 0.97], [0.72, 0.94, 0.9]], dark: [[0.02, 0.08, 0.08], [0.04, 0.2, 0.16], [0.05, 0.12, 0.22], [0.06, 0.26, 0.22]] },
  sunset: { id: "sunset", name: "Sunset", kind: "liquid", light: [[0.99, 0.92, 0.88], [0.98, 0.84, 0.82], [0.96, 0.86, 0.92], [0.99, 0.88, 0.78]], dark: [[0.1, 0.05, 0.08], [0.24, 0.09, 0.14], [0.2, 0.08, 0.2], [0.3, 0.13, 0.1]] },
  lavender: { id: "lavender", name: "Lavender", kind: "liquid", light: [[0.86, 0.84, 0.98], [0.76, 0.72, 0.96], [0.84, 0.76, 0.97], [0.72, 0.78, 0.98]], dark: [[0.07, 0.05, 0.16], [0.17, 0.11, 0.36], [0.26, 0.12, 0.4], [0.1, 0.12, 0.36]] },
  graphite: { id: "graphite", name: "Graphite", kind: "liquid", light: [[0.9, 0.91, 0.93], [0.82, 0.84, 0.87], [0.86, 0.86, 0.89], [0.8, 0.83, 0.86]], dark: [[0.05, 0.05, 0.06], [0.1, 0.1, 0.12], [0.13, 0.13, 0.15], [0.08, 0.09, 0.11]] },
  black: { id: "black", name: "Plain black", kind: "plain", colour: "#050507" },
  purple: { id: "purple", name: "Plain purple", kind: "plain", colour: "#24174f" },
};

/** An id from the server, or the default for anything not on the list
 * (an older or newer server must not leave the page without a background). */
export function backgroundOf(id: string | null | undefined): Background {
  return id && Object.prototype.hasOwnProperty.call(BACKGROUNDS, id) ? BACKGROUNDS[id as BackgroundId] : BACKGROUNDS[DEFAULT_BACKGROUND];
}

/** The theme the page draws. A plain background always draws dark (the
 * spec); a liquid one follows the owner's choice, or the computer's. */
export function drawnTheme(pref: ThemePref, background: string, systemDark: boolean): "light" | "dark" {
  if (backgroundOf(background).kind === "plain") return "dark";
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}

/** The four colours at a darkness from 0 (light) to 1 (dark): the light
 * and dark versions blended, so a theme change fades rather than cuts. */
export function liquidColours(bg: Background, darkness: number): Four | null {
  if (bg.kind !== "liquid") return null;
  const d = Math.min(1, Math.max(0, darkness));
  const mix = (i: number): Rgb => {
    const a = bg.light[i]!, b = bg.dark[i]!;
    // a*(1-d) + b*d: exactly the light version at 0 and the dark at 1.
    return [a[0] * (1 - d) + b[0] * d, a[1] * (1 - d) + b[1] * d, a[2] * (1 - d) + b[2] * d];
  };
  return [mix(0), mix(1), mix(2), mix(3)];
}

/** How far the drawn darkness moves toward the theme's in `dtMs` of time:
 * the mockup's 0.08 a frame at 30 fps, made time-based so the fade takes
 * the same second however fast the machine draws (a frame count made it
 * three times longer in software WebGL: session 45's browser check). The
 * step is capped at a quarter second, so a stall doesn't snap it. Within
 * 0.002 it lands; reduce motion jumps straight there. */
export function easeDarkness(current: number, target: number, dtMs: number, reduceMotion: boolean): number {
  if (reduceMotion) return target;
  const k = 1 - Math.pow(1 - 0.08, Math.min(Math.max(dtMs, 0), 250) / (1000 / 30));
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 0.002 ? target : next;
}

export function cssRgb(c: Rgb): string {
  return `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(",")})`;
}

/** The still version: the picker's swatch, and what sits under the canvas
 * (so the page has its colours before the first frame, and keeps them if
 * the browser has no WebGL). The mockup's swatch gradient. */
export function stillGradient(bg: Background, dark: boolean): string {
  if (bg.kind === "plain") return bg.colour;
  const c = dark ? bg.dark : bg.light;
  return `linear-gradient(135deg, ${cssRgb(c[0])}, ${cssRgb(c[2])} 55%, ${cssRgb(c[3])})`;
}

// ---- the liquid's pacing ------------------------------------------------------

/** The canvas is drawn at this fraction of the window's size and stretched
 * (the mockup's 0.3): a slow blur needs no more, and it keeps the GPU cost
 * near nothing. */
export const LIQUID_SCALE = 0.3;
/** About 30 frames a second: a frame is drawn only once this many ms have
 * passed since the last. Well under 33.3, so a 60 Hz screen's every other
 * frame (33.3 ms apart, give or take a few ms of timer jitter) is never
 * skipped; one 60 Hz frame (16.7 ms) is still too soon, so 60 Hz draws 30,
 * and 90 or 120 Hz draw every third or fourth frame (30). (32 ms, the
 * first try, lost about 4% of frames to 1.5 ms of jitter in the test.) */
export const LIQUID_FRAME_MS = 28;

export function canvasSize(clientWidth: number, clientHeight: number, scale = LIQUID_SCALE): { width: number; height: number } {
  return { width: Math.max(2, Math.round(clientWidth * scale)), height: Math.max(2, Math.round(clientHeight * scale)) };
}

/** The resolution steps the liquid drops through when the machine can't
 * keep up (no GPU, or a busy one: software WebGL drew 12 fps at 0.3 in
 * session 45's check). Each step draws about half the pixels of the one
 * before; the blur hides it. It never steps back up in a page's life, so
 * it can't flicker between two. */
export const LIQUID_SCALES = [0.3, 0.2, 0.14] as const;
/** Below this many frames a second, measured over a window, it steps down. */
export const LIQUID_SLOW_FPS = 20;
/** The window, in drawn frames and in ms: whichever is longer. A short
 * stall (a page drawing, a tab coming back) is not "slow". */
export const LIQUID_WINDOW = { frames: 30, ms: 2000 } as const;

/** The next scale after a measured window: one step down when slow,
 * otherwise the same. */
export function nextScale(scale: number, fps: number): number {
  if (fps >= LIQUID_SLOW_FPS) return scale;
  const i = LIQUID_SCALES.findIndex((s) => s <= scale + 1e-9);
  return i < 0 ? scale : (LIQUID_SCALES[Math.min(i + 1, LIQUID_SCALES.length - 1)] ?? scale);
}

/** Why the liquid isn't moving right now, or null when it should draw. */
export type LiquidPause = "hidden" | "covered" | "plain" | "still" | "no-webgl" | null;

export function liquidPause(s: { webgl: boolean; tabHidden: boolean; covered: boolean; plain: boolean; reduceMotion: boolean }): LiquidPause {
  if (!s.webgl) return "no-webgl";
  if (s.plain) return "plain";
  if (s.tabHidden) return "hidden";
  if (s.covered) return "covered";
  if (s.reduceMotion) return "still";
  return null;
}

/** One tick of the animation loop: draw now, or wait. */
export function shouldDrawFrame(now: number, lastDrawn: number, pause: LiquidPause): boolean {
  return pause === null && now - lastDrawn >= LIQUID_FRAME_MS;
}

// ---- the wallet in the top bar ----------------------------------------------------

/** Credits and pack points as the top bar shows them: whole numbers with
 * thousands separators ("12,400"). */
export function amount(n: number): string {
  const v = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** The Open button's label and whether it has anything to open. */
export function openButton(unopened: number): { label: string; count: number; enabled: boolean } {
  const count = Math.max(0, Math.floor(unopened));
  return { label: count === 0 ? "No packs to open" : `Open ${count === 1 ? "1 pack" : `${count} packs`}`, count, enabled: count > 0 };
}
