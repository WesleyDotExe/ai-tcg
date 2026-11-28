// Season 1's sealed booster pack: three wrapper designs with placeholder art
// (render session 95; the owner's Season 1 plan, phase 2 step 3, with the
// owner's 2026-11-28 entries: the pack as a foil object at the quality of the
// reference, its light and shine, and set names on packs).
//
// Pure: no DOM. Data in, HTML / CSS strings out, and the numbers the page's
// light follows, so the tests can hold the layout and the light to their
// rules without a browser. Fenced off in render/season1/: nothing outside
// this folder imports it.
//
// What every design lays out (owner 2026-11-28, point 6): the AI·TCG
// wordmark; the set's name as the title ("Set name" until the owner names a
// set: never a made-up name presented as real); "Season X" and the set code
// small; the set symbol. The faction mascot is the hero (placeholder art
// until the January art pass: the art region is the one the real art fills).
//
// The pack as an object (2026-11-28, point 2): crimped seal strips top and
// bottom (a serrated edge and ridges), a pillow curve across the face, light
// catching the edges, a specular highlight that slides as the pack turns, a
// holographic sheen in the foil, a soft reflection under it and a glow
// behind. The light follows the pointer on a desktop, the tilt on a phone
// where the browser allows it, otherwise a slow sweep; with reduced motion it
// holds still (point 4, FLASH.md's rules: a soft sweep, never a flash).

import { esc } from "../../src/site/siteModel.js";
import { FACTION_HEX } from "../../src/site/siteModel.js";

// ---------- the set's identity ----------

export interface PackSet {
  /** The set's own name, or null until the owner names it. */
  name: string | null;
  season: number;
  /** Season and set in order (season-1-ideas.md, "Set names": S1-01). */
  code: string;
}

/** The placeholder title until a set has a name (owner 2026-11-28). */
export const PLACEHOLDER_NAME = "Set name";

/** Season 1's first set, unnamed until the owner names it. */
export const S1_FIRST: PackSet = { name: null, season: 1, code: "S1-01" };

export const setTitle = (s: PackSet) => (s.name && s.name.trim() ? s.name.trim() : PLACEHOLDER_NAME);
export const seasonLine = (s: PackSet) => `Season ${s.season}`;
export const CODE_RE = /^S\d+-\d{2}$/;

// ---------- the pack's own space ----------

/** A pack is 100 units wide and 160 tall (Season 0's sealed pack is 1:1.6). */
export const PACK = { w: 100, h: 160 } as const;
/** The crimped seal strips, top and bottom (pack units). */
export const CRIMP = 9;
/** Where the print may go: inside the crimps, clear of the edge light. */
export const SAFE = { x: 6, y: CRIMP + 3, w: 88, h: PACK.h - 2 * (CRIMP + 3) } as const;

export type RegionId = "wordmark" | "season" | "title" | "symbol" | "art";
export interface Region { id: RegionId; x: number; y: number; w: number; h: number; /** text size, pack units (1 = 1% of the width) */ size?: number; align?: "left" | "center" | "right" }

export type DesignId = "crest" | "window" | "bleed";
export interface Design {
  id: DesignId;
  name: string;
  /** One line for the owner: what the design is. */
  pitch: string;
  regions: Region[];
  /** Text regions that sit on the art carry a scrim under them. */
  scrim: RegionId[];
}

/** The three designs. Each puts the same five things in the safe area; they
 * differ in how much of the face the hero gets and where the name sits. */
export const DESIGNS: readonly Design[] = [
  {
    id: "crest",
    name: "A · Crest",
    pitch: "The classic booster: the wordmark at the top crimp, the set's name large under it, the mascot standing in the middle of the foil, the set symbol low on the right.",
    regions: [
      { id: "wordmark", x: 22, y: 13, w: 56, h: 8, size: 7.2, align: "center" },
      { id: "season", x: 20, y: 23, w: 60, h: 5, size: 4.4, align: "center" },
      { id: "title", x: 8, y: 29, w: 84, h: 14, size: 12.5, align: "center" },
      { id: "art", x: 8, y: 46, w: 84, h: 86 },
      { id: "symbol", x: 78, y: 134, w: 12, h: 12 },
    ],
    scrim: [],
  },
  {
    id: "window",
    name: "B · Window",
    pitch: "A cut-corner HUD window holds the mascot; the wordmark and symbol ride the top, and the name sits in a band of its own below the window.",
    regions: [
      { id: "wordmark", x: 9, y: 13, w: 40, h: 7, size: 6.2, align: "left" },
      { id: "symbol", x: 81, y: 12.5, w: 10, h: 10 },
      { id: "art", x: 8, y: 24, w: 84, h: 90 },
      { id: "season", x: 9, y: 118, w: 82, h: 5, size: 4.4, align: "left" },
      { id: "title", x: 9, y: 124, w: 82, h: 14, size: 12, align: "left" },
    ],
    scrim: [],
  },
  {
    id: "bleed",
    name: "C · Full bleed",
    pitch: "The mascot fills the foil edge to edge; the wordmark sits on a glass strip at the top, the name and season on a dark scrim in the lower third, the symbol under them.",
    regions: [
      { id: "art", x: 0, y: CRIMP, w: 100, h: PACK.h - 2 * CRIMP },
      { id: "wordmark", x: 26, y: 13, w: 48, h: 7, size: 6.4, align: "center" },
      { id: "title", x: 8, y: 106, w: 84, h: 14, size: 12.5, align: "center" },
      { id: "season", x: 20, y: 121, w: 60, h: 5, size: 4.4, align: "center" },
      { id: "symbol", x: 44, y: 131, w: 12, h: 12 },
    ],
    scrim: ["wordmark", "title", "season"],
  },
];

export const designOf = (id: DesignId) => DESIGNS.find((d) => d.id === id)!;
export const TEXT_REGIONS: RegionId[] = ["wordmark", "season", "title"];

/** Two regions overlap (by more than a hairline). */
export function overlaps(a: Region, b: Region, eps = 0.01): boolean {
  return a.x + a.w > b.x + eps && b.x + b.w > a.x + eps && a.y + a.h > b.y + eps && b.y + b.h > a.y + eps;
}
/** A region sits inside the safe area (art in the full-bleed design may run
 * to the edge: the print, never). */
export function inSafe(r: Region): boolean {
  return r.x >= SAFE.x && r.y >= SAFE.y && r.x + r.w <= SAFE.x + SAFE.w && r.y + r.h <= SAFE.y + SAFE.h;
}

/** Below this drawn width (px) the season line is dropped: at the Store
 * tile's sizes it would be under 6 px, a smudge rather than words. */
export const SMALL_PACK_PX = 150;
/** The smallest the print may draw where it is shown (px). */
export const MIN_TEXT_PX = 6.5;

// ---------- the crimp's serrated edge ----------

/** The pack's outline: straight sides, a serrated top and bottom edge (the
 * crimp's teeth), as a CSS polygon in percent. */
export function crimpClip(teeth = 22, depth = 1.1): string {
  const pts: string[] = [];
  const yTop = (k: number) => (k % 2 ? depth : 0);
  for (let k = 0; k <= teeth * 2; k++) pts.push(`${((k / (teeth * 2)) * 100).toFixed(2)}% ${yTop(k).toFixed(2)}%`);
  for (let k = teeth * 2; k >= 0; k--) pts.push(`${((k / (teeth * 2)) * 100).toFixed(2)}% ${(100 - yTop(k)).toFixed(2)}%`);
  return `polygon(${pts.join(", ")})`;
}

// ---------- the light ----------

/** What drives the light: the pointer over the pack (px, py in -1..1), the
 * device's tilt (beta, gamma in degrees), the slow sweep (time in ms), or
 * nothing (reduced motion: a still, pleasant light). */
export type LightInput =
  | { mode: "pointer"; px: number; py: number }
  | { mode: "tilt"; beta: number; gamma: number }
  | { mode: "sweep"; t: number }
  | { mode: "still" };

export interface LightPose {
  /** The pack's turn (degrees): about its vertical axis, and its lean. */
  turnY: number;
  turnX: number;
  /** Where the specular highlight sits on the face (0..100, percent). */
  lx: number;
  ly: number;
  /** The holographic sheen's travel (0..100). */
  holo: number;
}

export const LIGHT = {
  /** The largest turn the light gives the pack. */
  maxTurnY: 14,
  maxTurnX: 9,
  /** The sweep's period: once across and back every 7 s (FLASH.md: a slow sheen). */
  sweepMs: 7000,
  /** The tilt that reaches the full turn (degrees off the phone's rest angle). */
  tiltRange: 25,
  /** A phone held in the hand rests at about this lean. */
  restBeta: 40,
  /**
   * The specular highlight's strongest white (alpha over the foil). FLASH.md
   * counts a change at 0.1 in relative luminance; over the dark foil this
   * peak lifts a block by under 0.07 at the highlight's centre, so the light
   * sliding across the pack makes no change the flash check counts, at any
   * speed (the sampler measures the built page: FLASH.md).
   */
  specAlpha: 0.12,
  /** The narrow gloss streak that rides with the highlight (the same limit:
   * where the two overlap they stay under 0.1 over the foil). */
  streakAlpha: 0.12,
  /** The sheen's strongest tint. */
  holoAlpha: 0.2,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function lightAt(input: LightInput): LightPose {
  let px = 0, py = 0;
  if (input.mode === "pointer") { px = clamp(input.px, -1, 1); py = clamp(input.py, -1, 1); }
  else if (input.mode === "tilt") { px = clamp(input.gamma / LIGHT.tiltRange, -1, 1); py = clamp((input.beta - LIGHT.restBeta) / LIGHT.tiltRange, -1, 1); }
  else if (input.mode === "sweep") { const a = (2 * Math.PI * input.t) / LIGHT.sweepMs; px = Math.sin(a); py = 0.35 * Math.sin(2 * a); }
  else { px = -0.45; py = -0.35; }
  return {
    turnY: +(px * LIGHT.maxTurnY).toFixed(2),
    turnX: +(-py * LIGHT.maxTurnX).toFixed(2),
    // The highlight moves against the turn, as a fixed light does on a turning sheet.
    lx: +(50 - px * 42).toFixed(2),
    ly: +(42 - py * 30).toFixed(2),
    holo: +(50 + px * 50).toFixed(2),
  };
}

// ---------- placeholder art ----------

export type Mascot = "Cortex" | "Aegis" | "Swarm" | "Null";
export const MASCOTS: readonly Mascot[] = ["Cortex", "Aegis", "Swarm", "Null"];

/** A placeholder mascot per faction, drawn from shapes in the faction's
 * colour on a circuit field (DESIGN.md: a generative placeholder, never an
 * emoji or a glyph on a flat background). The January art pass replaces the
 * art region's contents and nothing else. */
export function mascotSvg(f: Mascot, framed: "open" | "window" | "bleed"): string {
  const c = FACTION_HEX[f]!;
  const field = `<g opacity=".5" stroke="${c}" stroke-width=".5" fill="none">` +
    Array.from({ length: 7 }, (_, k) => `<path d="M${6 + k * 14} 0v${18 + (k % 3) * 9}l7 7v${40 - (k % 2) * 12}"/><circle cx="${13 + k * 14}" cy="${65 - (k % 2) * 12}" r="1.4" fill="${c}"/>`).join("") +
    `</g>`;
  const halo = `<circle cx="50" cy="50" r="34" fill="url(#mg-${f})"/>`;
  const fig: Record<Mascot, string> = {
    Cortex: `<g><path d="M30 92c0-16 9-26 20-26s20 10 20 26z" fill="#0c1a33" stroke="${c}" stroke-width="1.4"/><rect x="31" y="26" width="38" height="36" rx="11" fill="#0c1a33" stroke="${c}" stroke-width="1.6"/><rect x="36" y="38" width="28" height="9" rx="4.5" fill="${c}" opacity=".9"/><path d="M50 26V15m0 0l-6-5m6 5l6-5" stroke="${c}" stroke-width="1.4" fill="none"/><circle cx="44" cy="10" r="2" fill="${c}"/><circle cx="56" cy="10" r="2" fill="${c}"/><path d="M38 56h24" stroke="${c}" stroke-width="1" opacity=".6"/></g>`,
    Aegis: `<g><path d="M50 14l26 9v22c0 20-12 34-26 41-14-7-26-21-26-41V23z" fill="#2a1406" stroke="${c}" stroke-width="1.8"/><path d="M50 24l17 6v15c0 13-8 23-17 28-9-5-17-15-17-28V30z" fill="none" stroke="${c}" stroke-width="1" opacity=".7"/><rect x="38" y="40" width="24" height="7" rx="2" fill="${c}"/><path d="M50 55v18" stroke="${c}" stroke-width="1.4"/></g>`,
    Swarm: `<g fill="#0b2207" stroke="${c}" stroke-width="1.3">${[[50, 30, 11], [33, 47, 9], [67, 47, 9], [41, 66, 8], [59, 66, 8], [50, 82, 6], [24, 66, 5], [76, 66, 5]].map(([x, y, r]) => `<path d="${hexPath(x!, y!, r!)}"/><circle cx="${x}" cy="${y}" r="${(r! * 0.28).toFixed(1)}" fill="${c}" stroke="none"/>`).join("")}</g>`,
    Null: `<g><circle cx="50" cy="48" r="28" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="3 3"/><path d="M50 22c15 0 24 12 24 27 0 17-11 31-24 37-13-6-24-20-24-37 0-15 9-27 24-27z" fill="#1a0a24" stroke="${c}" stroke-width="1.6"/><path d="M36 46l9 4-9 4zM64 46l-9 4 9 4z" fill="${c}"/><path d="M42 68h16" stroke="${c}" stroke-width="1.4"/></g>`,
  };
  const vb = framed === "bleed" ? "8 -6 84 140" : "0 0 100 100";
  return `<svg class="mascot" viewBox="${vb}" preserveAspectRatio="xMidYMid ${framed === "bleed" ? "slice" : "meet"}" aria-hidden="true">` +
    `<defs><radialGradient id="mg-${f}"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset=".6" stop-color="${c}" stop-opacity=".12"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>` +
    `${field}${halo}${fig[f]}<text x="50" y="98" text-anchor="middle" font-size="3.4" fill="${c}" opacity=".75" font-family="ui-monospace,monospace" letter-spacing=".4">PLACEHOLDER ART</text></svg>`;
}
function hexPath(x: number, y: number, r: number): string {
  return Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k - Math.PI / 2; return `${k ? "L" : "M"}${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}`; }).join("") + "z";
}

/** The set symbol (a placeholder until the January identity pass: the hex
 * and dot Season 0's cards carry, with a second ring for Season 1). */
export const SET_SYMBOL_SVG = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 14 4.5v7L8 15 2 11.5v-7z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 4.2 11.3 6.1v3.8L8 11.8 4.7 9.9V6.1z" fill="none" stroke="currentColor" stroke-width=".9" opacity=".8"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></svg>`;

// ---------- the pack ----------

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;

export interface PackOpts { design: DesignId; mascot: Mascot; set?: PackSet; px: number; /** extra attributes on the root */ attrs?: string }

/** One sealed pack, `px` wide. Its light is set through CSS variables on the
 * root (--ty, --tx, --lx, --ly, --holo), which the page's script drives with
 * lightAt(); without the script it sits in the still pose. */
export function packHtml(o: PackOpts): string {
  const d = designOf(o.design);
  const set = o.set ?? S1_FIRST;
  const still = lightAt({ mode: "still" });
  const small = o.px < SMALL_PACK_PX;
  const reg = (r: Region, inner: string, cls = "") =>
    `<div class="rg rg-${r.id}${d.scrim.includes(r.id) ? " scrim" : ""}${cls}" data-region="${r.id}" style="left:${pct(r.x, PACK.w)};top:${pct(r.y, PACK.h)};width:${pct(r.w, PACK.w)};height:${pct(r.h, PACK.h)};${r.size ? `font-size:${r.size}cqw;` : ""}${r.align ? `text-align:${r.align};justify-content:${r.align === "left" ? "flex-start" : r.align === "right" ? "flex-end" : "center"};` : ""}">${inner}</div>`;
  const parts = d.regions.map((r) => {
    switch (r.id) {
      case "wordmark": return reg(r, `<span class="wm">AI<i>·</i>TCG</span>`);
      case "season": return small ? "" : reg(r, `<span class="sl">${esc(seasonLine(set))}<i aria-hidden="true"> · </i>${esc(set.code)}</span>`);
      case "title": return reg(r, `<span class="ti${set.name ? "" : " placeholder"}">${esc(setTitle(set))}</span>`);
      case "symbol": return reg(r, SET_SYMBOL_SVG);
      case "art": return reg(r, (o.design === "window" ? `<div class="win">${mascotSvg(o.mascot, "window")}</div>` : mascotSvg(o.mascot, o.design === "bleed" ? "bleed" : "open")), "");
    }
  }).join("");
  const label = `${setTitle(set)}, ${seasonLine(set)}, ${set.code}: a sealed pack`;
  return `<div class="pw d-${d.id}${small ? " small" : ""}" style="--pw:${Math.round(o.px)}px;--fc:${FACTION_HEX[o.mascot]};--ty:${still.turnY}deg;--tx:${still.turnX}deg;--lx:${still.lx}%;--ly:${still.ly}%;--holo:${still.holo}%" data-design="${d.id}" data-mascot="${o.mascot}" role="img" aria-label="${esc(label)}"${o.attrs ? ` ${o.attrs}` : ""}>` +
    `<div class="glow" aria-hidden="true"></div>` +
    `<div class="obj"><div class="face">` +
    `<div class="foil"></div>${parts}` +
    `<div class="holo"></div><div class="spec"></div><div class="streak"></div><div class="pillow"></div>` +
    `<div class="crimp t"></div><div class="crimp b"></div><div class="edge"></div>` +
    `</div></div></div>`;
}

/** The pack's CSS: one block, scoped to .pw. */
export function packCss(): string {
  return `
.pw { position: relative; width: var(--pw); aspect-ratio: ${PACK.w} / ${PACK.h}; flex: none; perspective: calc(var(--pw) * 5); container-type: inline-size; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #f2f5ff; }
.pw .glow { position: absolute; inset: 8% -6%; border-radius: 40%; background: radial-gradient(closest-side, color-mix(in srgb, var(--fc) 55%, transparent), transparent); filter: blur(calc(var(--pw) * .08)); opacity: .5; transform: translateX(calc((var(--lx) - 50%) * -.08)); }
.pw .obj { position: absolute; inset: 0; transform: rotateY(var(--ty)) rotateX(var(--tx)); transform-style: preserve-3d; transition: transform .25s ease-out;
  -webkit-box-reflect: below calc(var(--pw) * .04) linear-gradient(transparent 78%, rgba(255,255,255,.16)); }
.pw .face { position: absolute; inset: 0; clip-path: ${crimpClip()}; overflow: hidden; border-radius: 2px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--fc) 34%, #0a0f24), #0a0d1e 46%, color-mix(in srgb, var(--fc) 22%, #070915)); }
.pw .foil { position: absolute; inset: 0; background:
  repeating-linear-gradient(115deg, rgba(255,255,255,.035) 0 2px, transparent 2px 5px),
  radial-gradient(120% 60% at 50% 0%, color-mix(in srgb, var(--fc) 30%, transparent), transparent 60%); }
.pw .rg { position: absolute; display: flex; align-items: center; z-index: 3; line-height: 1; }
.pw .rg-art { z-index: 1; display: block; }
.pw .rg-art .mascot { width: 100%; height: 100%; display: block; }
.pw .rg-symbol { color: #f2f5ff; filter: drop-shadow(0 0 2cqw color-mix(in srgb, var(--fc) 80%, transparent)); } .pw .rg-symbol svg { width: 100%; height: 100%; }
.pw .wm { font-weight: 900; letter-spacing: .06em; white-space: nowrap; background: linear-gradient(180deg, #ffffff 0%, #dfe9ff 42%, #8fa6d8 52%, #f4f0ff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 .3cqw .5cqw rgba(0,0,0,.8)) drop-shadow(0 0 1.6cqw rgba(0,0,0,.6)); }
.pw .wm i { font-style: normal; color: var(--fc); -webkit-text-fill-color: color-mix(in srgb, var(--fc) 60%, #fff); }
.pw .sl { font: 700 1em/1 ui-monospace, Menlo, monospace; letter-spacing: .18em; text-transform: uppercase; color: #dfe5fb; white-space: nowrap; text-shadow: 0 0 .8cqw #000, 0 0 2.4cqw rgba(0,0,0,.85); }
.pw .sl i { font-style: normal; color: color-mix(in srgb, var(--fc) 50%, #fff); }
.pw .ti { font-weight: 900; letter-spacing: .01em; color: #fff; white-space: nowrap; text-shadow: 0 .5cqw 1.4cqw rgba(0,0,0,.75), 0 0 3cqw color-mix(in srgb, var(--fc) 55%, transparent); }
.pw .scrim::before { content: ""; position: absolute; inset: -18% -6%; z-index: -1; border-radius: 1.5cqw; background: rgba(6,8,22,.72); box-shadow: 0 0 4cqw 2cqw rgba(6,8,22,.45); }
.pw .rg-wordmark.scrim::before { background: rgba(10,14,34,.6); box-shadow: inset 0 0 0 .3cqw rgba(255,255,255,.18); }
.pw .win { position: absolute; inset: 0; clip-path: polygon(8% 0, 92% 0, 100% 6%, 100% 94%, 92% 100%, 8% 100%, 0 94%, 0 6%); background: linear-gradient(180deg, #050816, color-mix(in srgb, var(--fc) 18%, #050816)); }
.pw .win::after { content: ""; position: absolute; inset: 0; clip-path: inherit; box-shadow: inset 0 0 0 .5cqw color-mix(in srgb, var(--fc) 75%, #fff), inset 0 0 5cqw color-mix(in srgb, var(--fc) 35%, transparent); }
.pw .holo { position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: ${LIGHT.holoAlpha}; mix-blend-mode: screen;
  background: repeating-linear-gradient(115deg, #ff7ad9 0%, #7affea 6%, #8f8bff 12%, #ffe37a 18%, #ff7ad9 24%); background-size: 260% 260%; background-position: var(--holo) 50%;
  -webkit-mask: linear-gradient(115deg, transparent 10%, #000 45%, #000 55%, transparent 90%); mask: linear-gradient(115deg, transparent 10%, #000 45%, #000 55%, transparent 90%); }
.pw .spec { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: radial-gradient(38% 26% at var(--lx) var(--ly), rgba(255,255,255,${LIGHT.specAlpha}), rgba(255,255,255,${(LIGHT.specAlpha / 3).toFixed(3)}) 45%, transparent 75%); }
.pw .streak { position: absolute; inset: -20% -60%; z-index: 2; pointer-events: none; background: linear-gradient(115deg, transparent 44%, rgba(255,255,255,${LIGHT.streakAlpha / 2}) 47.5%, rgba(255,255,255,${LIGHT.streakAlpha}) 49%, rgba(255,255,255,${LIGHT.streakAlpha / 2}) 50.5%, transparent 54%); transform: translateX(calc((var(--lx) - 50%) * 1.1)); }
.pw .pillow { position: absolute; inset: 0; z-index: 4; pointer-events: none; background:
  radial-gradient(55% 32% at 34% 30%, rgba(255,255,255,.07), transparent 70%),
  linear-gradient(180deg, rgba(0,0,0,.38), transparent 9%, transparent 91%, rgba(0,0,0,.38)),
  radial-gradient(140% 70% at 50% 50%, transparent 55%, rgba(0,0,0,.42) 100%),
  linear-gradient(90deg, rgba(0,0,0,.3), transparent 12%, transparent 88%, rgba(0,0,0,.3)); }
.pw .crimp { position: absolute; left: 0; right: 0; height: ${pct(CRIMP, PACK.h)}; z-index: 5; pointer-events: none;
  background: repeating-linear-gradient(90deg, rgba(255,255,255,.34) 0 1.1cqw, rgba(0,0,0,.28) 1.1cqw 2.2cqw), linear-gradient(180deg, #c9d2ea, #6d7898 50%, #b8c3e0); background-blend-mode: overlay; }
.pw .crimp.t { top: 0; box-shadow: 0 .4cqw .8cqw rgba(0,0,0,.45); } .pw .crimp.b { bottom: 0; box-shadow: 0 -.4cqw .8cqw rgba(0,0,0,.45); }
.pw .edge { position: absolute; inset: 0; z-index: 6; pointer-events: none;
  box-shadow: inset .6cqw 0 0 rgba(255,255,255,calc(.08 + (100 - var(--lx-n, 50)) * .002)), inset -.6cqw 0 0 rgba(255,255,255,calc(.08 + var(--lx-n, 50) * .002)), inset 0 0 1.5cqw rgba(255,255,255,.08);
  background: linear-gradient(calc(90deg + var(--ty) * 3), rgba(255,255,255,.12), transparent 8%, transparent 92%, rgba(255,255,255,.12)); }
.pw.small .sl { display: none; }
@media (prefers-reduced-motion: reduce) { .pw .obj { transition: none; } }
`;
}

/** The light, as plain JavaScript for the page (the same function the tests
 * read, so the page and the tests can never disagree). */
export const LIGHT_JS = `const LIGHT=${JSON.stringify(LIGHT)};const clamp=${clamp.toString()};const lightAt=${lightAt.toString()};`;
