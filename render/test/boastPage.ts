// A small fake page for the boast runtime (the exact text the page embeds),
// shared by the boast's runtime tests: a winner's side with six cards, its
// panel above, the loser's side below; a recording fake SND and MUS; a CFX
// whose kit draws nothing. page().plugin() is what the runtime plugged into
// CFX (update each frame, drawTop over the cards).
import { BOAST_PURE_SOURCE, BOAST_RUNTIME_SOURCE, type BoastGeom, type BoastRect } from "../src/boastFx.js";
import { CANVAS_FX_PURE_SOURCE } from "../src/canvasFx.js";

export interface FakeEl {
  className: string; textContent: string; style: Record<string, unknown> & { setProperty: () => void };
  classList: { add: (c: string) => void; remove: (c: string) => void; contains: (c: string) => boolean };
  children: FakeEl[]; offsetWidth: number; offsetHeight: number; type?: string; attrs: Record<string, string>; setAttribute: (k: string, v: string) => void;
  appendChild: (c: FakeEl) => FakeEl; insertBefore: (c: FakeEl, r: FakeEl) => FakeEl; remove: () => void;
  getBoundingClientRect: () => { left: number; top: number; right: number; bottom: number; width: number; height: number };
  scrollIntoView?: () => void; firstChild: FakeEl | null; nextSibling: FakeEl | null; parent?: FakeEl | null;
}
export function el(r: BoastRect | null = null, cls = ""): FakeEl {
  const classes = new Set(cls.split(" ").filter(Boolean));
  const e: FakeEl = {
    className: cls, textContent: "", style: { setProperty() {} }, children: [], offsetWidth: 60, offsetHeight: 14, attrs: {},
    setAttribute: (k, v) => { e.attrs[k] = v; },
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    appendChild: (c) => { e.children.push(c); c.parent = e; return c; }, insertBefore: (c) => { e.children.unshift(c); c.parent = e; return c; },
    remove() { if (e.parent) { e.parent.children = e.parent.children.filter((x) => x !== e); e.parent = null; } },
    // An element the runtime makes (no rect given) sits where its style puts
    // it, at its offset size (the Skip button, the skip hint).
    getBoundingClientRect: () => {
      if (r) return { left: r.l, top: r.t, right: r.r, bottom: r.b, width: r.r - r.l, height: r.b - r.t };
      const l = parseFloat(String(e.style.left ?? "0")) || 0, t = parseFloat(String(e.style.top ?? "0")) || 0;
      return { left: l, top: t, right: l + e.offsetWidth, bottom: t + e.offsetHeight, width: e.offsetWidth, height: e.offsetHeight };
    },
    firstChild: null, nextSibling: null,
  };
  return e;
}

// One winner's side: a row of six slots, the panel above, the loser's side
// below it.
export const BAND: BoastRect = { l: 20, t: 180, r: 1120, b: 354 };
export const PANEL: BoastRect = { l: 20, t: 60, r: 430, b: 130 };
export const LOSER: BoastRect = { l: 20, t: 400, r: 1120, b: 574 };
export function slotRects(): BoastRect[] {
  return Array.from({ length: 6 }, (_, k) => ({ l: 570 - 375 + k * 126, t: 188, r: 570 - 375 + k * 126 + 118, b: 346 }));
}
export function geom(): BoastGeom {
  return { band: BAND, panel: PANEL, slots: slotRects().map((s) => ({ ...s, filled: true })), loser: [LOSER] };
}

export interface SeqCall { list: { t: number; kind?: string; tier?: string; x?: number; ms?: number; run?: (at: number) => void }[]; o: { t0?: number; faction?: string; pan?: number } }
export function page() {
  let now = 5000;
  const log: string[] = [];
  const seqs: SeqCall[] = [];
  const played: string[] = [];
  const holds: [number, number][] = [];
  const MUS = { duckHold: (sec: number, at: number) => { holds.push([sec, at]); return true; } };
  let plugin: { update: () => void; drawTop: (ctx: unknown) => void } | null = null;
  const SND = {
    play: (k: string) => { played.push(k); return true; },
    sequence: (list: SeqCall["list"], o: SeqCall["o"]) => {
      seqs.push({ list: list.slice(), o });
      return { tick: () => log.push("tick"), stop: () => log.push("stop"), cut: () => { log.push("cut"); return true; }, stats: () => ({ planned: list.length, queued: 0, sched: [], late: 0, base: null, stopped: false }) };
    },
  };
  const noop = () => {};
  const CFX = {
    kit: { reduced: false, mix: (a: number[]) => a, tex: () => ({}), drawGlow: noop, shock: noop, flare: noop, ring: noop, sparks: noop, gridForce: noop, gridTint: noop, kick: noop },
    isReady: () => true, plug: (p: { update: () => void; drawTop: (ctx: unknown) => void }) => { plugin = p; }, fadeOutIn: noop,
  };
  const body = el();
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const doc = {
    body, createElement: () => el(),
    addEventListener: (k: string, f: (e: unknown) => void) => { (listeners[k] ||= []).push(f); },
    removeEventListener: (k: string, f: (e: unknown) => void) => { listeners[k] = (listeners[k] || []).filter((g) => g !== f); },
  };
  const media = { coarse: false };
  const win = { scrollX: 0, scrollY: 0, innerHeight: 900, innerWidth: 1280, matchMedia: (q: string) => ({ matches: q === "(pointer: coarse)" && media.coarse }) };
  const timers: (() => void)[] = [];
  const BOAST = new Function("window", "document", "performance", "CFX", "SND", "MUS", "getComputedStyle", "setTimeout", "clearTimeout", "setInterval", "clearInterval",
    `${CANVAS_FX_PURE_SOURCE}; ${BOAST_PURE_SOURCE}; ${BOAST_RUNTIME_SOURCE}; return BOAST;`,
  )(win, doc, { now: () => now }, CFX, SND, MUS, () => ({ fontSize: "28px", marginLeft: "0", marginRight: "0" }),
    (f: () => void) => { timers.push(f); return timers.length; }, noop, (f: () => void) => { timers.push(f); return timers.length; }, noop) as {
    play: (id: string, els: object, o: object) => { marks: { k: string; t: number }[] } | null;
    skip: () => void; cancel: () => void; active: () => boolean;
    stats: () => { planned: number | null; fired: Record<string, number>; last: { reason: string } | null; hint: string | null; hintSeen: boolean; active: boolean };
  };
  const row = el(BAND);
  row.children = slotRects().map((r) => el(r, "card"));
  const els = { band: el(BAND), panel: el(PANEL), row, loser: [el(LOSER)], dim: [] };
  const frame = (ms: number) => { now += ms; plugin!.update(); };
  const key = (k: string) => (listeners.keydown || []).forEach((f) => f({ key: k, preventDefault: noop }));
  const down = () => (listeners.pointerdown || []).forEach((f) => f({ target: null }));
  return { BOAST, els, seqs, played, holds, log, frame, key, down, media, body, now: () => now, plugin: () => plugin! };
}

