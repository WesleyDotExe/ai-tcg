// EFFECTS.md v2 slice 3 (procedural sound with faction voices). Five layers:
//  1. every event kind has a sound in every faction voice, made of sane
//     voices (positive frequencies, gains and durations), and an unknown
//     faction gets the Neutral voice;
//  2. axis 3: the tier only scales volume (subtle < normal < spectacle);
//  3. axis 1, the meaning invariant: in every voice an impact thumps low, a
//     heal ends higher than it starts, a buff sweeps up, a debuff falls, a
//     block rings, a kill drops; axis 2: the voices really differ (Cortex
//     square blips, Aegis inharmonic partials, Swarm high-Q noise chitters,
//     Null stepped/broken pitch, Neutral bells only);
//  4. the runtime (the exact text the page embeds) against a recording fake
//     AudioContext: silent and context-free until switched on, a limiter on
//     the master bus, panning by position, the voice cap and the repeat gap;
//  5. the viewer's setting (owner 2026-10-07): on by default and armed
//     until the first gesture, one-click mute, the effects volume, both
//     remembered through the store, a hidden tab going quiet; and the replay
//     page embeds both halves and mounts the control.
import { describe, expect, it } from "vitest";
import {
  SFX_BELL,
  SFX_DEFAULT_VOLUME,
  SFX_KINDS,
  SFX_PREF_KEY,
  SFX_REPEAT_GAP_MS,
  SFX_TIER_GAIN,
  SFX_VOICE_CAP,
  SOUND_FX_PURE_SOURCE,
  SOUND_FX_RUNTIME_SOURCE,
  sfxPan,
  sfxPrefParse,
  sfxPrefSerialize,
  sfxRecipe,
  sfxVoiceOf,
  type SfxKind,
  type SfxVoice,
} from "../src/soundFx.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import type { MatchReplay } from "../src/types.js";

const FACTIONS = ["Cortex", "Aegis", "Swarm", "Null", "Neutral"] as const;
const TIERS = ["subtle", "normal", "spectacle"] as const;

function seeded(seed = 7): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const recipe = (k: SfxKind, f: string | undefined, t: (typeof TIERS)[number] = "normal", o?: Parameters<typeof sfxRecipe>[4]) => sfxRecipe(k, f, t, seeded(), o);
const totalGain = (vs: SfxVoice[]) => vs.reduce((a, v) => a + v.g, 0);
const tones = (vs: SfxVoice[]) => vs.filter((v) => v.k === "tone");

describe("every event has a sound in every voice", () => {
  it("covers all fourteen kinds in all five factions with sane voices", () => {
    expect(SFX_KINDS).toEqual(["launch", "impact", "bolt", "heal", "buff", "debuff", "lock", "beam", "kill", "block", "cast", "ward", "wardPulse", "wardBreak"]);
    for (const k of SFX_KINDS) for (const f of FACTIONS) for (const t of TIERS) {
      const vs = recipe(k, f, t, { victim: "Aegis" });
      expect(vs.length, `${k}/${f}/${t}`).toBeGreaterThan(0);
      for (const v of vs) {
        expect(["tone", "noise"]).toContain(v.k);
        expect(v.f0).toBeGreaterThan(0);
        expect(v.dur).toBeGreaterThan(0);
        expect(v.g).toBeGreaterThan(0);
        expect(v.g).toBeLessThan(1.5);
        if (v.f1 !== undefined) expect(v.f1).toBeGreaterThan(0);
        expect(v.delay ?? 0).toBeGreaterThanOrEqual(0);
        // Every voice of one event is over within a second and a half.
        expect((v.delay ?? 0) + v.dur).toBeLessThan(1.5);
      }
    }
  });

  it("gives an unknown or missing faction the Neutral voice", () => {
    expect(sfxVoiceOf("Someday-Faction")).toBe("neutral");
    expect(sfxVoiceOf(undefined)).toBe("neutral");
    expect(recipe("impact", "Someday-Faction")).toEqual(recipe("impact", "Neutral"));
  });
});

describe("axis 3: the tier scales volume only", () => {
  it("subtle < normal < spectacle for every kind and voice, with the same shape", () => {
    expect(SFX_TIER_GAIN.subtle).toBeLessThan(SFX_TIER_GAIN.normal);
    expect(SFX_TIER_GAIN.normal).toBeLessThan(SFX_TIER_GAIN.spectacle);
    for (const k of SFX_KINDS) for (const f of FACTIONS) {
      const [s, n, x] = TIERS.map((t) => recipe(k, f, t));
      expect(totalGain(s!)).toBeLessThan(totalGain(n!));
      expect(totalGain(n!)).toBeLessThan(totalGain(x!));
      expect(s!.map((v) => [v.k, v.type, v.f0])).toEqual(n!.map((v) => [v.k, v.type, v.f0]));
    }
  });
});

describe("axis 1: meaning is the same in every voice", () => {
  it("an impact always thumps low and falls; a hit on a player lands lower and longer", () => {
    for (const f of FACTIONS) {
      const thump = recipe("impact", f)[0]!;
      expect(thump).toMatchObject({ k: "tone", type: "sine" });
      expect(thump.f0).toBeLessThanOrEqual(150);
      expect(thump.f1!).toBeLessThan(thump.f0);
      const face = recipe("impact", f, "normal", { targetKind: "player" })[0]!;
      expect(face.f0).toBeLessThan(thump.f0);
      expect(face.dur).toBeGreaterThan(thump.dur);
    }
  });

  it("a heal ends higher than it starts; a buff sweeps up; a debuff falls", () => {
    for (const f of FACTIONS) {
      const heal = tones(recipe("heal", f)).filter((v) => !v.f1);
      const first = heal[0]!, last = [...heal].sort((a, b) => (a.delay ?? 0) - (b.delay ?? 0)).filter((v) => v.g >= 0.02).pop()!;
      expect(last.f0, f).toBeGreaterThan(first.f0);
      const buff = recipe("buff", f)[0]!;
      expect(buff.f1!).toBeGreaterThan(buff.f0);
      const [d1, d2] = recipe("debuff", f);
      expect(d1!.f1!).toBeLessThan(d1!.f0);
      expect(d2!.f1!).toBeLessThan(d2!.f0);
    }
  });

  it("a block always rings; a kill always carries the impact and a deep drop", () => {
    for (const f of FACTIONS) {
      expect(recipe("block", f)[0]).toMatchObject({ k: "tone", type: "triangle", f0: 1760 });
      const kill = recipe("kill", f, "normal", { victim: "Cortex" });
      const impact = recipe("impact", f);
      expect(kill.slice(0, impact.length).map((v) => v.f0)).toEqual(impact.map((v) => v.f0));
      expect(kill.some((v) => v.k === "tone" && v.f0 === 62 && v.f1 === 28)).toBe(true);
      expect(totalGain(kill)).toBeGreaterThan(totalGain(impact));
    }
    // An Aegis victim adds its own metal ring as it breaks.
    expect(recipe("kill", "Null", "normal", { victim: "Aegis" }).length).toBeGreaterThan(recipe("kill", "Null", "normal", { victim: "Swarm" }).length);
  });
});

describe("axis 2: each faction has its own voice", () => {
  it("Cortex blips in square waves", () => {
    for (const k of ["launch", "bolt", "lock"] as const) expect(tones(recipe(k, "Cortex")).every((v) => v.type === "square")).toBe(true);
    expect(recipe("impact", "Cortex").some((v) => v.type === "square")).toBe(true);
  });
  it("Aegis clangs on inharmonic partials", () => {
    const freqs = recipe("impact", "Aegis").map((v) => v.f0);
    for (const p of SFX_BELL) expect(freqs).toContain(330 * p);
    expect(SFX_BELL).toContain(2.76);
  });
  it("Swarm chitters in high-Q noise", () => {
    const n = recipe("launch", "Swarm").filter((v) => v.k === "noise" && (v.q ?? 0) >= 9);
    expect(n.length).toBeGreaterThanOrEqual(6);
  });
  it("Null breaks its pitch", () => {
    expect(recipe("launch", "Null").some((v) => (v.steps ?? 0) > 1)).toBe(true);
    // Its impact blips land on different pitches from different random draws.
    const a = sfxRecipe("impact", "Null", "normal", seeded(1)).map((v) => v.f0);
    const b = sfxRecipe("impact", "Null", "normal", seeded(99)).map((v) => v.f0);
    expect(a).not.toEqual(b);
  });
  it("Neutral rings bells: only sine and triangle tones on top of the shared thump", () => {
    for (const k of ["launch", "bolt", "heal", "buff", "lock", "cast"] as const) expect(tones(recipe(k, "Neutral")).every((v) => v.type === "sine" || v.type === "triangle"), k).toBe(true);
    expect(tones(recipe("impact", "Neutral")).slice(1).every((v) => v.type === "triangle")).toBe(true);
  });
  it("no two factions sound the same for a launch, an impact or a cast", () => {
    for (const k of ["launch", "impact", "cast"] as const) {
      const sigs = FACTIONS.map((f) => JSON.stringify(recipe(k, f).map((v) => [v.k, v.type, v.f0, v.q ?? 0, v.steps ?? 0])));
      expect(new Set(sigs).size, k).toBe(FACTIONS.length);
    }
  });
});

describe("panning", () => {
  it("follows the position, never fully hard, and is centred when unknown", () => {
    expect(sfxPan(0, 1000)).toBe(-0.75);
    expect(sfxPan(1000, 1000)).toBe(0.75);
    expect(sfxPan(500, 1000)).toBe(0);
    expect(sfxPan(250, 1000)).toBeCloseTo(-0.375);
    expect(sfxPan(-400, 1000)).toBe(-0.75);
    expect(sfxPan(NaN, 1000)).toBe(0);
    expect(sfxPan(10, 0)).toBe(0);
  });
});

// ---- the runtime against a recording fake AudioContext -------------------
interface FakeNode { kind: string; to: FakeNode[]; started?: boolean; onended?: (() => void) | null; [k: string]: unknown }
function param(v = 0) {
  return { value: v, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} };
}
function makeFakeWindow(width = 1000) {
  const made: FakeNode[] = [];
  let contexts = 0;
  const node = (kind: string, extra: Record<string, unknown> = {}): FakeNode => {
    const n: FakeNode = { kind, to: [], ...extra, connect(d: FakeNode) { n.to.push(d); return d; } } as FakeNode;
    made.push(n);
    return n;
  };
  class FakeAC {
    currentTime = 0;
    sampleRate = 8000;
    state = "running";
    destination = node("destination");
    constructor() { contexts++; }
    createDynamicsCompressor() { return node("compressor", { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); }
    createGain() { return node("gain", { gain: param(1) }); }
    createStereoPanner() { return node("panner", { pan: param(0) }); }
    createBiquadFilter() { return node("filter", { type: "", frequency: param(), Q: param() }); }
    createBuffer(_c: number, len: number) { const d = new Float32Array(len); return { getChannelData: () => d }; }
    createOscillator() { return node("osc", { type: "", frequency: param(), detune: param(), start() { (this as FakeNode).started = true; }, stop() {} }); }
    createBufferSource() { return node("noise", { buffer: null, loop: false, start() { (this as FakeNode).started = true; }, stop() {} }); }
    resume() { this.state = "running"; }
    suspend() { this.state = "suspended"; }
  }
  let now = 1000;
  const win: Record<string, unknown> = { AudioContext: FakeAC, innerWidth: width };
  const perf = { now: () => now };
  return { win, perf, made, contexts: () => contexts, advance: (ms: number) => { now += ms; } };
}
function bootRuntime(width = 1000, doc: unknown = undefined) {
  const env = makeFakeWindow(width);
  const SND = new Function("window", "performance", "document", `${SOUND_FX_PURE_SOURCE}; ${SOUND_FX_RUNTIME_SOURCE}; return SND;`)(env.win, env.perf, doc) as {
    play: (k: string, f: string, t: string, rect: { left: number; width: number } | null, o?: object) => boolean;
    setOn: (on: boolean) => boolean;
    isOn: () => boolean;
    arm: (pref: unknown) => string;
    unlock: () => boolean;
    setVolume: (v: number) => number;
    volume: () => number;
    setHidden: (h: boolean) => void;
    state: () => "muted" | "armed" | "on";
    mount: (btn: FakeEl, slider: FakeEl | null, store?: { read: () => unknown; write: (v: string) => void }) => { gesture: (ev?: { target?: unknown }) => void };
    stats: () => { on: boolean; state: string; volume: number; ctxState: string | null; ctx: boolean; active: number; played: number; voices: number; capped: number; repeats: number; byKind: Record<string, number> };
  };
  return { SND, ...env };
}
const sources = (made: FakeNode[]) => made.filter((n) => n.kind === "osc" || n.kind === "noise");

describe("the runtime the page embeds", () => {
  it("is silent and makes no AudioContext until switched on", () => {
    const { SND, made, contexts } = bootRuntime();
    expect(SND.isOn()).toBe(false);
    expect(SND.play("impact", "Aegis", "normal", { left: 100, width: 100 })).toBe(false);
    expect(contexts()).toBe(0);
    expect(made).toHaveLength(0);
  });

  it("switched on: master gain -> limiter -> speakers, and one event plays its whole recipe, panned by position", () => {
    const { SND, made, contexts } = bootRuntime(1000);
    expect(SND.setOn(true)).toBe(true);
    expect(contexts()).toBe(1);
    const comp = made.find((n) => n.kind === "compressor")!;
    expect(comp.to.map((n) => n.kind)).toEqual(["destination"]);
    expect((comp.ratio as { value: number }).value).toBeGreaterThanOrEqual(10);
    const master = made.find((n) => n.kind === "gain" && n.to.includes(comp))!;
    expect(master).toBeDefined();
    const before = sources(made).length;
    expect(SND.play("impact", "Aegis", "normal", { left: 0, width: 100 })).toBe(true);
    const played = sources(made).slice(before);
    expect(played).toHaveLength(recipe("impact", "Aegis").length);
    expect(played.every((n) => n.started)).toBe(true);
    // Left of the screen pans left, through the master bus.
    const pans = made.filter((n) => n.kind === "panner");
    expect(pans.length).toBe(played.length);
    expect(pans.every((p) => (p.pan as { value: number }).value < 0 && p.to[0] === master)).toBe(true);
    expect(SND.stats()).toMatchObject({ on: true, played: 1, byKind: { impact: 1 } });
    // Switching off silences it again, without a new context.
    SND.setOn(false);
    expect(SND.play("impact", "Aegis", "normal", null)).toBe(false);
    SND.setOn(true);
    expect(contexts()).toBe(1);
  });

  it("caps the voices alive at once and drops the rest instead of queueing", () => {
    const { SND, made, advance } = bootRuntime();
    SND.setOn(true);
    // Nothing ends in the fake, so voices pile up until the cap.
    for (let i = 0; i < 20; i++) { SND.play("kill", "Swarm", "spectacle", null, { victim: "Aegis" }); advance(SFX_REPEAT_GAP_MS + 1); }
    expect(sources(made).length).toBe(SFX_VOICE_CAP);
    expect(SND.stats().active).toBe(SFX_VOICE_CAP);
    expect(SND.stats().capped).toBeGreaterThan(0);
    // When voices end, room opens again.
    sources(made).forEach((n) => n.onended && n.onended());
    expect(SND.stats().active).toBe(0);
    SND.play("bolt", "Cortex", "normal", null);
    expect(sources(made).length).toBe(SFX_VOICE_CAP + 1);
  });

  it("drops the same sound in the same voice repeated within the gap (a volley reads as one)", () => {
    const { SND, advance } = bootRuntime();
    SND.setOn(true);
    expect(SND.play("bolt", "Swarm", "normal", null)).toBe(true);
    expect(SND.play("bolt", "Swarm", "normal", null)).toBe(false);
    expect(SND.play("bolt", "Cortex", "normal", null)).toBe(true);
    expect(SND.play("impact", "Swarm", "normal", null)).toBe(true);
    advance(SFX_REPEAT_GAP_MS + 1);
    expect(SND.play("bolt", "Swarm", "normal", null)).toBe(true);
    expect(SND.stats().repeats).toBe(1);
  });
});

describe("the replay page", () => {
  const replay: MatchReplay = {
    title: "t", seed: 1, factions: { p1: "Aegis", p2: "Null" }, identities: { p1: { username: "a" }, p2: { username: "b" } },
    cardFactions: {}, movesPlayed: 0, frames: [],
  } as unknown as MatchReplay;
  const html = renderMatchHtml(replay);

  it("embeds the exact sound source the tests run, with sound on by default and a volume slider", () => {
    expect(html).toContain(SOUND_FX_PURE_SOURCE);
    expect(html).toContain(SOUND_FX_RUNTIME_SOURCE);
    expect(html).toContain('<button id="btn-sound" aria-pressed="true"');
    expect(html).toContain('<input type="range" id="sound-vol" min="0" max="100"');
    expect(html).toContain("SND.mount(document.getElementById('btn-sound'), document.getElementById('sound-vol'));");
    expect(html).not.toContain("Sound: off");
  });

  it("fires one sound at each visual moment: launch, impact, counter, effects, kill, block, cast", () => {
    for (const call of [
      "SND.play('launch', f, strikeTier, fromR);",
      "SND.play('impact', f, strikeTier, toR, { targetKind: strike.target.kind });",
      "SND.play('impact', df, cTier === 'spectacle' ? 'normal' : 'subtle', fromR);",
      "if (e.category === 'spell' && !e.self) SND.play('bolt', f, tier, fromR || toR);",
      "if (e.category === 'removal') SND.play('lock', f, tier, toR);",
      "if (kill) SND.play('kill', kill.killer, tier, rect, { victim: kill.victim });",
      "SND.play('block', nv.faction, t, el.getBoundingClientRect());",
      "SND.play('cast', fx.faction, tier, rect);",
    ]) expect(html).toContain(call);
  });
});

// ---- the viewer's sound setting (owner 2026-10-07, call 7) ----------------
describe("the remembered setting", () => {
  it("defaults to sound on at the default volume when nothing (or junk) is stored", () => {
    for (const raw of [null, undefined, "", "not json", "null", "42", "{}", 7]) {
      expect(sfxPrefParse(raw)).toEqual({ muted: false, volume: SFX_DEFAULT_VOLUME });
    }
  });
  it("only an explicit mute is remembered as off; the volume is clamped to 0-1", () => {
    expect(sfxPrefParse('{"muted":true,"volume":0.3}')).toEqual({ muted: true, volume: 0.3 });
    expect(sfxPrefParse('{"muted":"yes"}').muted).toBe(false);
    expect(sfxPrefParse('{"volume":7}').volume).toBe(1);
    expect(sfxPrefParse('{"volume":-1}').volume).toBe(0);
    expect(sfxPrefParse('{"volume":"x"}').volume).toBe(SFX_DEFAULT_VOLUME);
    expect(sfxPrefParse({ muted: true, volume: 0.5 })).toEqual({ muted: true, volume: 0.5 });
  });
  it("round-trips through serialize", () => {
    for (const p of [{ muted: true, volume: 0 }, { muted: false, volume: 0.42 }, { muted: false, volume: 1 }]) {
      expect(sfxPrefParse(sfxPrefSerialize(p))).toEqual(p);
    }
    expect(SFX_PREF_KEY).toBe("ai-tcg.sound");
  });
});

interface FakeEl {
  textContent: string; title: string; value: string; disabled: boolean; attrs: Record<string, string>; classes: Set<string>;
  listeners: Record<string, (() => void)[]>;
  setAttribute(k: string, v: string): void; addEventListener(t: string, f: () => void): void;
  contains(x: unknown): boolean; classList: { toggle(c: string, on: boolean): void }; fire(t: string): void;
}
function fakeEl(): FakeEl {
  const el: FakeEl = {
    textContent: "", title: "", value: "", disabled: false, attrs: {}, classes: new Set(), listeners: {},
    setAttribute(k, v) { el.attrs[k] = v; },
    addEventListener(t, f) { (el.listeners[t] ||= []).push(f); },
    contains(x) { return x === el; },
    classList: { toggle(c, on) { if (on) el.classes.add(c); else el.classes.delete(c); } },
    fire(t) { (el.listeners[t] || []).forEach((f) => f()); },
  };
  return el;
}
function fakeDoc() {
  const ls: Record<string, ((ev: { target?: unknown }) => void)[]> = {};
  const doc = {
    visibilityState: "visible",
    addEventListener(t: string, f: (ev: { target?: unknown }) => void) { (ls[t] ||= []).push(f); },
    fire(t: string, ev: { target?: unknown } = {}) { (ls[t] || []).forEach((f) => f(ev)); },
  };
  return doc;
}
function memStore(initial: string | null = null) {
  const s = { v: initial, writes: 0, read: () => s.v, write: (v: string) => { s.v = v; s.writes++; } };
  return s;
}

describe("sound on by default, armed until a gesture", () => {
  it("arms with no context; the first pointer or key press anywhere starts it", () => {
    const doc = fakeDoc();
    const { SND, contexts } = bootRuntime(1000, doc);
    const btn = fakeEl(), vol = fakeEl();
    SND.mount(btn, vol, memStore());
    expect(SND.state()).toBe("armed");
    expect(contexts()).toBe(0);
    expect(btn.textContent).toContain("Sound on");
    expect(btn.attrs["aria-pressed"]).toBe("true");
    expect(btn.classes.has("armed")).toBe(true);
    expect(SND.play("impact", "Aegis", "normal", null)).toBe(false);
    doc.fire("keydown", { target: {} });
    expect(SND.state()).toBe("on");
    expect(contexts()).toBe(1);
    expect(btn.classes.has("armed")).toBe(false);
    expect(SND.play("impact", "Aegis", "normal", null)).toBe(true);
    doc.fire("pointerdown", { target: {} });
    expect(contexts()).toBe(1);
  });

  it("a press on the mute button mutes without starting sound first, and the mute is remembered", () => {
    const doc = fakeDoc();
    const { SND, contexts } = bootRuntime(1000, doc);
    const btn = fakeEl(), store = memStore();
    SND.mount(btn, null, store);
    doc.fire("pointerdown", { target: btn });
    btn.fire("click");
    expect(SND.state()).toBe("muted");
    expect(contexts()).toBe(0);
    expect(btn.textContent).toContain("Sound off");
    expect(btn.attrs["aria-pressed"]).toBe("false");
    expect(sfxPrefParse(store.v).muted).toBe(true);
    // Later gestures don't wake a muted viewer.
    doc.fire("keydown", { target: {} });
    expect(contexts()).toBe(0);
  });

  it("a remembered mute stays muted on the next page until switched back on", () => {
    const doc = fakeDoc();
    const store = memStore(sfxPrefSerialize({ muted: true, volume: 0.5 }));
    const { SND, contexts } = bootRuntime(1000, doc);
    const btn = fakeEl(), vol = fakeEl();
    SND.mount(btn, vol, store);
    expect(SND.state()).toBe("muted");
    expect(vol.value).toBe("50");
    expect(vol.disabled).toBe(true);
    doc.fire("pointerdown", { target: {} });
    expect(contexts()).toBe(0);
    btn.fire("click");
    expect(SND.state()).toBe("on");
    expect(contexts()).toBe(1);
    expect(vol.disabled).toBe(false);
    expect(sfxPrefParse(store.v)).toEqual({ muted: false, volume: 0.5 });
  });

  it("the volume slider scales the master bus ahead of the limiter and is remembered", () => {
    const doc = fakeDoc();
    const { SND, made } = bootRuntime(1000, doc);
    const btn = fakeEl(), vol = fakeEl(), store = memStore();
    SND.mount(btn, vol, store);
    expect(vol.value).toBe(String(Math.round(SFX_DEFAULT_VOLUME * 100)));
    vol.value = "25"; vol.fire("input");
    doc.fire("pointerdown", { target: vol });
    const master = made.find((n) => n.kind === "gain" && n.to.some((d) => d.kind === "compressor")) as FakeNode & { gain: { value: number } };
    expect(master.gain.value).toBeCloseTo(0.6 * 0.25);
    vol.value = "100"; vol.fire("input");
    expect(master.gain.value).toBeCloseTo(0.6);
    expect(sfxPrefParse(store.v).volume).toBe(1);
  });

  it("the standalone page remembers in browser storage under ai-tcg.sound", () => {
    const doc = fakeDoc();
    const { SND, win } = bootRuntime(1000, doc);
    const data: Record<string, string> = {};
    win.localStorage = { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
    const btn = fakeEl();
    SND.mount(btn, null);
    btn.fire("click");
    expect(sfxPrefParse(data[SFX_PREF_KEY])).toEqual({ muted: true, volume: SFX_DEFAULT_VOLUME });
  });

  it("browser storage that throws (private window, blocked site data) just isn't remembered: sound still arms on", () => {
    const doc = fakeDoc();
    const { SND, win } = bootRuntime(1000, doc);
    win.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const btn = fakeEl();
    expect(() => SND.mount(btn, null)).not.toThrow();
    expect(SND.state()).toBe("armed");
    expect(() => btn.fire("click")).not.toThrow();
    expect(SND.state()).toBe("muted");
  });

  it("a hidden tab suspends the context and the return resumes it", () => {
    const doc = fakeDoc();
    const { SND } = bootRuntime(1000, doc);
    SND.mount(fakeEl(), null, memStore());
    doc.fire("keydown", { target: {} });
    expect(SND.stats().ctxState).toBe("running");
    doc.visibilityState = "hidden"; doc.fire("visibilitychange");
    expect(SND.stats().ctxState).toBe("suspended");
    doc.visibilityState = "visible"; doc.fire("visibilitychange");
    expect(SND.stats().ctxState).toBe("running");
  });
});

// Render session 60 (the pack ceremony, part 2): while a held pack card
// builds, the room's sound drops to near silence (SND.duck), and the
// build's own risers and hit come through on top (o.lift).
describe("the duck and the lift bus (the pack reveal's build)", () => {
  it("duck() drops the master to that share of its volume; a lifted sound goes past it, straight to the limiter at full volume", () => {
    const { SND, made } = bootRuntime(1000);
    const snd = SND as unknown as typeof SND & { duck: (l: number, ms: number) => number; ducked: () => number };
    // Asked before there is a context: remembered, and the master starts there.
    expect(snd.duck(0.5, 0)).toBe(0.5);
    SND.setOn(true);
    const comp = made.find((n) => n.kind === "compressor")!;
    const toComp = made.filter((n) => n.kind === "gain" && n.to.includes(comp)) as (FakeNode & { gain: { value: number; setTargetAtTime: (v: number, t: number, k: number) => void } })[];
    expect(toComp).toHaveLength(2);
    const [master, lift] = toComp as [typeof toComp[0], typeof toComp[0]];
    expect(master.gain.value).toBeCloseTo(0.6 * 0.8 * 0.5);
    expect(lift.gain.value).toBeCloseTo(0.6 * 0.8);
    const targets: number[] = [];
    master.gain.setTargetAtTime = (v: number) => { targets.push(v); };
    snd.duck(0.06, 280);
    snd.duck(1, 600);
    expect(targets.map((v) => Math.round(v * 1000) / 1000)).toEqual([Math.round(0.6 * 0.8 * 0.06 * 1000) / 1000, Math.round(0.6 * 0.8 * 1000) / 1000]);
    expect(snd.ducked()).toBe(1);
    // A plain sound pans into the master; a lifted one into the lift bus.
    const pansBefore = made.filter((n) => n.kind === "panner").length;
    SND.play("flip", "Aegis", "normal", null);
    SND.play("bass", "Aegis", "spectacle", null, { lift: true, weight: 1 });
    const pans = made.filter((n) => n.kind === "panner").slice(pansBefore);
    const plain = recipe("flip", "Aegis").length;
    expect(pans.slice(0, plain).every((p) => p.to[0] === master)).toBe(true);
    expect(pans.slice(plain).length).toBeGreaterThan(0);
    expect(pans.slice(plain).every((p) => p.to[0] === lift)).toBe(true);
    // The volume moves both, the master keeping its duck.
    snd.duck(0.25, 0);
    SND.setVolume(0.5);
    expect(master.gain.value).toBeCloseTo(0.6 * 0.5 * 0.25);
    expect(lift.gain.value).toBeCloseTo(0.6 * 0.5);
  });
});
