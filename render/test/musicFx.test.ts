// EFFECTS.md v2 slice 4 (adaptive procedural music). Four layers:
//  1. the arrangement as data: A minor at 104 BPM over Am–F–C–G, every note
//     in the key, layers entering in order as intensity rises, the
//     arpeggio in the acting faction's voice, the Mythic bells;
//  2. intensity: what bumps it (hits by tier, kills, Mythic arrivals; not
//     heals or buffs), the cap, the relaxing back to rest, the higher rest
//     with a Mythic on the acting side;
//  3. the runtime (the exact text the page embeds) against a recording fake
//     AudioContext: it shares SND's context and limiter, schedules sixteenths
//     ahead on the audio clock, follows the match through SND even with
//     effects muted, ducks only to 80% and never muffles or drops out on a
//     kill, keeps the context running while either is on;
//  4. the viewer's setting (same pattern as the effects): on by default and
//     armed until a gesture, one-click mute, the volume, both remembered;
//     and the replay page embeds and wires it.
import { describe, expect, it } from "vitest";
import {
  MUSIC_PURE_SOURCE,
  MUSIC_RUNTIME_SOURCE,
  MUS_AT,
  MUS_BPM,
  MUS_BUMP,
  MUS_DEFAULT_VOLUME,
  MUS_DUCK_TO,
  MUS_BOAST_DUCK_TO,
  MUS_I_MAX,
  MUS_LOOKAHEAD_S,
  MUS_MYTHIC_LIFT,
  MUS_PREF_KEY,
  MUS_PROG,
  MUS_S16,
  musBase,
  musBump,
  musFreq,
  musLayers,
  musMeter,
  musPrefParse,
  musPrefSerialize,
  MUS_FOLLOW,
  musSceneSide,
  musRest,
  musStep,
  type MusVoice,
} from "../src/musicFx.js";
import { SFX_TIER_GAIN, SOUND_FX_PURE_SOURCE, SOUND_FX_RUNTIME_SOURCE } from "../src/soundFx.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import { renderFxSheet } from "../src/fxSheet.js";
import type { MatchReplay } from "../src/types.js";

const FACTIONS = ["Cortex", "Aegis", "Swarm", "Null", "Neutral"] as const;

function seeded(seed = 7): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const toMidi = (f: number) => 69 + 12 * Math.log2(f / 440);
// A natural minor: A B C D E F G.
const A_MINOR = new Set([9, 11, 0, 2, 4, 5, 7]);
function bar(I: number, faction: string, mythic = false, barIdx = 0, rand = seeded()): MusVoice[] {
  const out: MusVoice[] = [];
  for (let p = 0; p < 16; p++) out.push(...musStep(barIdx * 16 + p, I, faction, mythic, rand));
  return out;
}
const isKick = (v: MusVoice) => v.k === "tone" && v.type === "sine" && v.f === 150 && v.f1 === 44;

describe("the arrangement", () => {
  it("is A minor at 104 BPM over i-VI-III-VII (Am, F, C, G)", () => {
    expect(MUS_BPM).toBe(104);
    expect(MUS_S16).toBeCloseTo(60 / 104 / 4);
    expect(musFreq(69)).toBe(440);
    expect(musFreq(57)).toBeCloseTo(220);
    const names = MUS_PROG.map((ch) => ch.map((n) => n % 12));
    expect(names).toEqual([[9, 0, 4], [5, 9, 0], [0, 4, 7], [7, 11, 2]]);
  });

  it("every pitched note in every voice, at every intensity, is in A minor (drums aside)", () => {
    for (const f of FACTIONS) for (const I of [0.5, 1, 1.5, 2, 2.6, 3.2]) for (let b = 0; b < 4; b++) {
      for (const v of bar(I, f, true, b)) {
        if (v.k === "noise" || isKick(v) || (v.type === "triangle" && v.f === 190)) continue;
        // Bell partials (x2.76) are timbre, not notes.
        const m = toMidi(v.f);
        if (Math.abs(m - Math.round(m)) > 0.01) continue;
        expect(A_MINOR.has(((Math.round(m) % 12) + 12) % 12), `${f} I=${I} bar ${b}: midi ${m}`).toBe(true);
      }
    }
  });

  it("every voice is sane: positive frequencies, durations and gains, nothing loud", () => {
    for (const f of FACTIONS) for (const I of [1, 3.2]) for (const v of bar(I, f, true)) {
      expect(v.f).toBeGreaterThan(20);
      expect(v.dur).toBeGreaterThan(0);
      expect(v.g).toBeGreaterThan(0);
      expect(v.g).toBeLessThanOrEqual(0.42);
      if (v.f1 !== undefined) expect(v.f1).toBeGreaterThan(0);
    }
  });

  it("layers enter in order as intensity rises: pad + bass, kick, arpeggio, drive + hats, off-hats, snare + four on the floor", () => {
    expect(musLayers(1)).toEqual({ pad: true, bass: "pulse", kick: 1, arp: 0, hats: false, offHats: false, snare: false });
    expect(musLayers(0.3).kick).toBe(0);
    expect(musLayers(1.25).kick).toBe(2);
    expect(musLayers(1.35).arp).toBe(8);
    expect(musLayers(1.5).bass).toBe("drive");
    expect(musLayers(1.7).hats).toBe(true);
    expect(musLayers(2.25).arp).toBe(16);
    expect(musLayers(2.35).kick).toBe(4);
    expect(musLayers(2.45).offHats).toBe(true);
    expect(musLayers(3.2)).toEqual({ pad: true, bass: "drive", kick: 4, arp: 16, hats: true, offHats: true, snare: true });
    // More intensity never takes a layer away.
    let prev = 0;
    for (let I = 0; I <= MUS_I_MAX; I += 0.05) {
      const L = musLayers(I);
      const score = L.kick + L.arp + (L.hats ? 1 : 0) + (L.offHats ? 1 : 0) + (L.snare ? 1 : 0) + (L.bass === "drive" ? 1 : 0);
      expect(score).toBeGreaterThanOrEqual(prev);
      prev = score;
    }
  });

  it("the steps really play what the layers say", () => {
    const calm = bar(1, "Cortex");
    expect(calm.filter((v) => v.pad)).toHaveLength(6); // 3 chord notes x 2 detuned saws
    expect(calm.filter(isKick)).toHaveLength(1);
    expect(calm.filter((v) => v.send)).toHaveLength(0); // no arpeggio
    expect(calm.filter((v) => v.k === "noise")).toHaveLength(0); // no hats, no snare
    const battle = bar(3, "Cortex");
    expect(battle.filter(isKick)).toHaveLength(4);
    expect(battle.filter((v) => v.k === "noise" && v.type === "highpass").length).toBe(4 + 8);
    expect(battle.filter((v) => v.k === "noise" && v.type === "bandpass")).toHaveLength(2);
    expect(battle.filter((v) => v.send)).toHaveLength(16);
    expect(bar(1.5, "Cortex").filter((v) => v.send)).toHaveLength(8);
    // The pad brightens with intensity.
    expect(battle.find((v) => v.pad)!.ff!).toBeGreaterThan(calm.find((v) => v.pad)!.ff!);
  });

  it("the arpeggio takes the acting faction's voice, and the voices differ", () => {
    const arp = (f: string) => bar(3, f).filter((v) => v.send);
    expect(arp("Cortex").every((v) => v.type === "square" && v.ff === 3200)).toBe(true);
    expect(arp("Aegis").every((v) => v.type === "sawtooth" && v.ff1 === 600)).toBe(true);
    const swarm = arp("Swarm");
    expect(swarm.every((v) => v.type === "triangle" && v.det !== undefined)).toBe(true);
    expect(swarm.length).toBeLessThan(16); // drops notes
    const nul = bar(3, "Null", false, 0, seeded(3)).filter((v) => v.send);
    expect(nul.every((v) => v.type === "square")).toBe(true);
    expect(arp("Neutral").every((v) => v.type === "sine")).toBe(true);
    expect(arp("Someday-Faction")).toEqual(arp("Neutral"));
    const sig = (f: string) => JSON.stringify(arp(f).map((v) => [v.type, Math.round(v.f)]));
    expect(new Set(FACTIONS.map(sig)).size).toBe(5);
  });

  it("a Mythic on the acting side adds a bell motif every other bar, and only then", () => {
    const bells = (mythic: boolean, b: number) => musStep(b * 16, 1, "Aegis", mythic, seeded()).filter((v) => v.send && v.dur >= 1.4);
    expect(bells(true, 0)).toHaveLength(3);
    expect(bells(true, 1)).toHaveLength(0);
    expect(bells(true, 2)).toHaveLength(3);
    expect(bells(false, 0)).toHaveLength(0);
    // The second bell enters a beat later.
    expect(bells(true, 0).some((v) => v.at === MUS_S16 * 4)).toBe(true);
  });
});

describe("intensity", () => {
  it("hits bump by tier, kills more, a Mythic arrival most; heals, buffs and blocks don't", () => {
    expect(musBump(1, "impact", "normal")).toBeCloseTo(1 + MUS_BUMP.impact!);
    expect(musBump(1, "impact", "spectacle")).toBeCloseTo(1 + MUS_BUMP.impact! * SFX_TIER_GAIN.spectacle);
    expect(musBump(1, "impact", "subtle")).toBeLessThan(musBump(1, "impact", "normal"));
    expect(musBump(1, "kill", "normal")).toBeCloseTo(2.1);
    expect(musBump(1, "mythic", "spectacle")).toBeCloseTo(2.3);
    for (const k of ["heal", "buff", "debuff", "block", "cast", "lock", "beam"]) expect(musBump(1, k, "spectacle")).toBe(1);
    // A kill takes calm music straight into the arpeggio and hats.
    const L = musLayers(musBump(1, "kill", "normal"));
    expect(L.arp).toBeGreaterThan(0);
    expect(L.hats).toBe(true);
  });

  it("never passes the cap", () => {
    let I = 1;
    for (let n = 0; n < 20; n++) I = musBump(I, "kill", "spectacle");
    expect(I).toBe(MUS_I_MAX);
  });

  it("relaxes back to rest over a few seconds, and rests higher with a Mythic on the acting side", () => {
    expect(musBase(false)).toBe(1);
    expect(musBase(true)).toBeCloseTo(1 + MUS_MYTHIC_LIFT);
    let I = 3;
    for (let t = 0; t < 6; t += 0.025) I = musRest(I, 1, 0.025);
    expect(I).toBeGreaterThan(1.5); // still elevated after 6 s (one time constant)
    expect(I).toBeLessThan(2);
    for (let t = 0; t < 30; t += 0.025) I = musRest(I, 1, 0.025);
    expect(I).toBeCloseTo(1, 1);
    expect(musRest(2, 1, 0)).toBe(2);
    expect(musRest(1, musBase(true), 60)).toBeCloseTo(1.35, 2);
  });

  it("shows a small meter in half steps", () => {
    expect(musMeter(0)).toBe("···");
    expect(musMeter(1)).toBe("▮··");
    expect(musMeter(1.5)).toBe("▮▯·");
    expect(musMeter(3.2)).toBe("▮▮▮");
  });
});

// ---- the runtime against a recording fake AudioContext -------------------
interface Call { fn: string; args: number[] }
interface FakeNode { kind: string; to: FakeNode[]; started?: number; [k: string]: unknown }
interface FakeParam { value: number; calls: Call[] }
function param(v = 0): FakeParam & Record<string, unknown> {
  const p = { value: v, calls: [] as Call[] } as FakeParam & Record<string, unknown>;
  for (const fn of ["setValueAtTime", "exponentialRampToValueAtTime", "linearRampToValueAtTime", "setTargetAtTime", "cancelScheduledValues"]) {
    p[fn] = (...args: number[]) => { p.calls.push({ fn, args }); };
  }
  return p;
}
function makeEnv() {
  const made: FakeNode[] = [];
  let contexts = 0;
  const node = (kind: string, extra: Record<string, unknown> = {}): FakeNode => {
    const n: FakeNode = { kind, to: [], ...extra, connect(d: FakeNode) { n.to.push(d); return d; } } as FakeNode;
    made.push(n);
    return n;
  };
  const clock = { t: 0 };
  class FakeAC {
    sampleRate = 8000;
    state = "running";
    destination = node("destination");
    constructor() { contexts++; }
    get currentTime() { return clock.t; }
    createDynamicsCompressor() { return node("compressor", { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); }
    createGain() { return node("gain", { gain: param(1) }); }
    createStereoPanner() { return node("panner", { pan: param(0) }); }
    createBiquadFilter() { return node("filter", { type: "", frequency: param(), Q: param() }); }
    createDelay() { return node("delay", { delayTime: param() }); }
    createBuffer(_c: number, len: number) { const d = new Float32Array(len); return { getChannelData: () => d }; }
    createOscillator() { const o = node("osc", { type: "", frequency: param(), detune: param(), stop() {} }); o.start = (t: number) => { o.started = t; }; return o; }
    createBufferSource() { const s = node("noise", { buffer: null, loop: false, stop() {} }); s.start = (t: number) => { s.started = t; }; return s; }
    resume() { this.state = "running"; }
    suspend() { this.state = "suspended"; }
  }
  const timers: (() => void)[] = [];
  const win: Record<string, unknown> = { AudioContext: FakeAC, innerWidth: 1000 };
  let now = 1000;
  const perf = { now: () => now };
  const fakeSetInterval = (fn: () => void) => { timers.push(fn); return timers.length; };
  const fakeClearInterval = (id: number) => { timers[id - 1] = () => {}; };
  return { win, perf, made, clock, timers, fakeSetInterval, fakeClearInterval, contexts: () => contexts, advanceMs: (ms: number) => { now += ms; } };
}
interface SeqItem { t: number; kind: string; tier: string; x?: number; faction?: string }
interface Seq {
  tick: () => void; stop: () => void; cut: () => boolean;
  stats: () => { planned: number; queued: number; sched: { kind: string; t: number; at: number; lead: number }[]; late: number; base: number | null; stopped: boolean };
}
interface Ctl { gesture: (ev?: { target?: unknown }) => void }
function boot(doc: unknown = undefined) {
  const env = makeEnv();
  const out = new Function("window", "performance", "document", "setInterval", "clearInterval",
    `${SOUND_FX_PURE_SOURCE}; ${SOUND_FX_RUNTIME_SOURCE}; ${MUSIC_PURE_SOURCE}; ${MUSIC_RUNTIME_SOURCE}; return { SND: SND, MUS: MUS };`,
  )(env.win, env.perf, doc, env.fakeSetInterval, env.fakeClearInterval) as {
    SND: {
      play: (k: string, f: string, t: string, rect: null, o?: object) => boolean;
      group: () => { node: FakeNode & { gain: FakeParam }; cut: () => boolean; isCut: () => boolean } | null;
      sequence: (list: SeqItem[], o?: { t0?: number; faction?: string; pan?: number; onQueue?: (m: SeqItem, at: number) => void }) => Seq;
      setOn: (on: boolean) => boolean;
      setHidden: (h: boolean) => void;
      mount: (btn: FakeEl, slider: FakeEl | null, store?: object) => Ctl;
      stats: () => { ctxState: string | null; on: boolean; scheduled: number; cuts: number; repeats: number };
    };
    MUS: {
      setOn: (on: boolean) => boolean;
      isOn: () => boolean;
      state: () => "muted" | "armed" | "on";
      event: (k: string, t: string) => number;
      duck: (at?: number) => boolean;
      duckHold: (sec: number, at?: number) => boolean;
      startAfter: (sec: number) => boolean;
      setScene: (f: string, m: boolean) => void;
      tick: () => number;
      setVolume: (v: number) => number;
      mount: (btn: FakeEl, slider: FakeEl | null, meter: FakeEl | null, store?: object) => Ctl;
      stats: () => { on: boolean; I: number; faction: string; mythic: boolean; step: number; steps: number; voices: number; ducks: number; bumps: number; waits: number; waiting: boolean; busGain: number | null; layers: ReturnType<typeof musLayers> };
    };
  };
  return { ...out, ...env };
}
const gains = (made: FakeNode[]) => made.filter((n) => n.kind === "gain") as (FakeNode & { gain: FakeParam })[];
function musicGraph(made: FakeNode[]) {
  const comp = made.find((n) => n.kind === "compressor")!;
  const duck = gains(made).find((g) => g.to.includes(comp) && gains(made).some((b) => b.to.includes(g)))!;
  const bus = gains(made).find((g) => g.to.includes(duck))!;
  return { comp, duck, bus };
}

describe("the music runtime the page embeds", () => {
  it("makes nothing until switched on, then shares SND's one context and limiter", () => {
    const { MUS, made, contexts } = boot();
    expect(MUS.isOn()).toBe(false);
    expect(MUS.tick()).toBe(0);
    expect(contexts()).toBe(0);
    expect(made).toHaveLength(0);
    expect(MUS.setOn(true)).toBe(true);
    expect(contexts()).toBe(1);
    expect(made.filter((n) => n.kind === "compressor")).toHaveLength(1);
    const { comp, duck, bus } = musicGraph(made);
    expect(duck.to).toEqual([comp]);
    expect(bus.to).toEqual([duck]);
    // No low-pass anywhere on the music's way out: it is never muffled.
    expect(made.some((n) => n.kind === "filter" && n.to.includes(bus))).toBe(false);
    expect(made.some((n) => n.kind === "filter" && (n.to.includes(duck) || n.to.includes(comp)))).toBe(false);
    // It fades in to the level for its volume.
    const fade = bus.gain.calls.find((c) => c.fn === "setTargetAtTime")!;
    expect(fade.args[0]).toBeCloseTo(0.84 * 0.6 * MUS_DEFAULT_VOLUME);
  });

  it("schedules sixteenths ahead on the audio clock, one step every 60/104/4 s, without bursting after a stall", () => {
    const { MUS, made, clock, timers } = boot();
    MUS.setOn(true);
    expect(timers).toHaveLength(1);
    const queued = MUS.tick();
    expect(queued).toBeGreaterThan(0);
    const starts = [...new Set(made.filter((n) => n.kind === "osc" && n.started !== undefined).map((n) => +(n.started as number).toFixed(6)))].sort((a, b) => a - b);
    expect(starts[0]).toBeCloseTo(0.1);
    for (let k = 1; k < starts.length; k++) expect(starts[k]! - starts[k - 1]!).toBeGreaterThan(MUS_S16 * 0.99);
    expect(starts[starts.length - 1]!).toBeLessThan(clock.t + MUS_LOOKAHEAD_S + MUS_S16);
    // Ticking again at the same moment queues nothing new.
    expect(MUS.tick()).toBe(0);
    // A long stall (a hidden tab) restarts just ahead of now, not with every missed step at once.
    clock.t = 30;
    const after = MUS.tick();
    expect(after).toBeLessThanOrEqual(Math.ceil((MUS_LOOKAHEAD_S - 0.05) / MUS_S16) + 1);
    // Steps keep counting through the bars.
    for (let s = 0; s < 400; s++) { clock.t += 0.025; MUS.tick(); }
    expect(MUS.stats().step).toBeGreaterThan(64);
  });

  it("follows the match through SND: hits and kills raise intensity even with effects muted, and it relaxes back", () => {
    const { SND, MUS, clock } = boot();
    MUS.setOn(true);
    MUS.tick();
    expect(MUS.stats().I).toBe(1);
    expect(SND.play("impact", "Aegis", "spectacle", null)).toBe(false); // effects are off
    expect(MUS.stats().I).toBeCloseTo(1 + 0.2 * SFX_TIER_GAIN.spectacle, 3);
    SND.play("kill", "Aegis", "normal", null);
    SND.play("heal", "Aegis", "normal", null);
    const peak = MUS.stats().I;
    expect(peak).toBeCloseTo(1 + 0.28 + 1.1, 2);
    expect(MUS.stats().layers.hats).toBe(true);
    for (let s = 0; s < 40 * 40; s++) { clock.t += 0.025; MUS.tick(); }
    expect(MUS.stats().I).toBeLessThan(1.05);
    expect(MUS.stats().layers.hats).toBe(false);
  });

  it("an effect dips it only to 80% and back, never cut or muffled on a kill; a volley dips once", () => {
    const { SND, MUS, made, clock, advanceMs } = boot();
    SND.setOn(true);
    MUS.setOn(true);
    const { duck } = musicGraph(made);
    SND.play("kill", "Null", "spectacle", null, { victim: "Aegis" });
    const targets = duck.gain.calls.filter((c) => c.fn === "setTargetAtTime").map((c) => c.args[0]!);
    expect(targets).toEqual([MUS_DUCK_TO, 1]);
    expect(MUS_DUCK_TO).toBe(0.8);
    expect(duck.gain.calls.filter((c) => c.fn === "setTargetAtTime")[1]!.args[1]!).toBeLessThanOrEqual(0.1);
    // A volley within 60 ms dips once.
    SND.play("bolt", "Cortex", "normal", null);
    SND.play("bolt", "Swarm", "normal", null);
    expect(MUS.stats().ducks).toBe(1);
    clock.t += 0.1; advanceMs(100);
    SND.play("bolt", "Cortex", "normal", null);
    expect(MUS.stats().ducks).toBe(2);
    // Nothing ever sets the duck below 80%, nor the bus to 0, while music is on.
    expect(duck.gain.calls.filter((c) => c.fn === "setTargetAtTime").every((c) => c.args[0]! >= MUS_DUCK_TO)).toBe(true);
  });

  it("a boast's sting holds the music at 55% for its length, then it recovers; effect dips inside the hold don't lift it early", () => {
    const { SND, MUS, made, clock } = boot();
    SND.setOn(true);
    MUS.setOn(true);
    const { duck } = musicGraph(made);
    expect(MUS.duckHold(1.2)).toBe(true);
    const targets = () => duck.gain.calls.filter((c) => c.fn === "setTargetAtTime").map((c) => c.args);
    expect(targets()).toEqual([[MUS_BOAST_DUCK_TO, clock.t, 0.04], [1, clock.t + 1.2, 0.25]]);
    expect(MUS_BOAST_DUCK_TO).toBe(0.55);
    clock.t += 0.5;
    SND.play("impact", "Aegis", "subtle", null);
    expect(targets()).toHaveLength(2);
    clock.t += 1;
    SND.play("bolt", "Cortex", "normal", null);
    expect(targets()).toHaveLength(4);
    expect(targets()[2]![0]).toBe(MUS_DUCK_TO);
    MUS.setOn(false);
    expect(MUS.duckHold(1)).toBe(false);
  });

  it("Match Boot: silent under the intro, then it starts from the top of the progression, fading in (owner call 8)", () => {
    const { SND, MUS, made, clock, advanceMs } = boot();
    SND.setOn(true);
    MUS.setOn(true);
    clock.t = 5; MUS.tick();
    const { bus } = musicGraph(made);
    const before = bus.gain.calls.length;
    expect(MUS.startAfter(2.6)).toBe(true);
    const targets = bus.gain.calls.slice(before).filter((c) => c.fn === "setTargetAtTime").map((c) => c.args);
    // Down to silence at once, back to its level at the intro's end.
    expect(targets[0]![0]).toBe(0);
    expect(targets[0]![1]).toBe(5);
    expect(targets[1]![0]).toBeGreaterThan(0);
    expect(targets[1]![1]).toBe(5 + 2.6);
    expect(MUS.stats().waiting).toBe(true);
    // Nothing is queued under the intro.
    const voicesAt = MUS.stats().voices;
    for (let k = 0; k < 20; k++) { clock.t += 0.12; advanceMs(120); MUS.tick(); }
    expect(clock.t).toBeLessThan(5 + 2.6 - 0.12);
    expect(MUS.stats().voices).toBe(voicesAt);
    expect(MUS.stats().step).toBe(0);
    // After it, the first step queued is step 0 (the top of Am), at or after the end
    // (the steps queued before the intro, at most one lookahead ahead, sound into the fade).
    clock.t = 5 + 2.6; advanceMs(400); MUS.tick();
    expect(MUS.stats().steps).toBeGreaterThan(0);
    const firstNew = made.filter((n) => (n.kind === "osc" || n.kind === "noise") && typeof n.started === "number" && (n.started as number) > 5 + 0.12);
    expect(firstNew.length).toBeGreaterThan(0);
    expect(Math.min(...firstNew.map((n) => n.started as number))).toBeGreaterThanOrEqual(5 + 2.6);
    expect(MUS.stats().waiting).toBe(false);
  });

  it("Match Boot skipped: startAfter(0) brings the music in at once; a volume change or switching it on under the intro waits", () => {
    const { SND, MUS, made, clock, advanceMs } = boot();
    SND.setOn(true);
    MUS.setOn(true);
    clock.t = 2;
    MUS.startAfter(2.6);
    const { bus } = musicGraph(made);
    // A volume change under the intro holds the bus at 0 until the end.
    const n0 = bus.gain.calls.length;
    MUS.setVolume(0.3);
    const vol = bus.gain.calls.slice(n0);
    expect(vol.find((c) => c.fn === "setValueAtTime")!.args[0]).toBe(0);
    expect(vol.find((c) => c.fn === "setTargetAtTime")!.args[1]).toBeCloseTo(4.6);
    // The skip at 1 s.
    clock.t = 3; advanceMs(1000);
    const n1 = bus.gain.calls.length;
    expect(MUS.startAfter(0)).toBe(true);
    const back = bus.gain.calls.slice(n1).filter((c) => c.fn === "setTargetAtTime").map((c) => c.args);
    expect(back).toHaveLength(1);
    expect(back[0]![0]).toBeGreaterThan(0);
    expect(back[0]![1]).toBe(3);
    MUS.tick();
    expect(MUS.stats().steps).toBeGreaterThan(0);
    // Music off when the intro starts, switched on under it: it waits for the end.
    const e2 = boot();
    e2.SND.setOn(true);
    e2.clock.t = 1;
    expect(e2.MUS.startAfter(2.6)).toBe(false);
    e2.clock.t = 2; e2.advanceMs(1000);
    e2.MUS.setOn(true);
    const bus2 = musicGraph(e2.made).bus;
    const up = bus2.gain.calls.filter((c) => c.fn === "setTargetAtTime" && c.args[0]! > 0).map((c) => c.args[1]!);
    expect(Math.max(...up)).toBeCloseTo(2 + 1.6, 5);
    e2.MUS.tick();
    expect(e2.MUS.stats().voices).toBe(0);
  });

  it("Match Boot ends on its own: a second intro later waits again from scratch", () => {
    const { SND, MUS, clock, advanceMs } = boot();
    SND.setOn(true);
    MUS.setOn(true);
    clock.t = 1; MUS.startAfter(2.6);
    clock.t = 3.7; advanceMs(2700);
    for (let k = 0; k < 10; k++) { clock.t += 0.1; MUS.tick(); }
    expect(MUS.stats().step).toBeGreaterThan(0);
    clock.t = 20; advanceMs(16000);
    MUS.startAfter(2.6);
    expect(MUS.stats().step).toBe(0);
    const steps = MUS.stats().steps;
    MUS.tick();
    expect(MUS.stats().steps).toBe(steps);
    expect(MUS.stats().waiting).toBe(true);
  });

  it("with effects muted, nothing ducks the music", () => {
    const { SND, MUS } = boot();
    MUS.setOn(true);
    SND.play("kill", "Null", "spectacle", null);
    expect(MUS.stats().ducks).toBe(0);
  });

  it("plays the acting faction's arpeggio and the Mythic bells from the scene", () => {
    const { MUS, made, clock } = boot();
    MUS.setOn(true);
    MUS.setScene("Cortex", true);
    MUS.event("kill", "spectacle"); MUS.event("kill", "spectacle");
    for (let s = 0; s < 120; s++) { clock.t += 0.025; MUS.tick(); }
    const oscs = made.filter((n) => n.kind === "osc");
    expect(oscs.some((o) => o.type === "square")).toBe(true); // Cortex arpeggio
    expect(MUS.stats()).toMatchObject({ faction: "Cortex", mythic: true });
    // Bell partial (x2.76) only comes from the bells (or a Neutral arpeggio).
    const bellish = oscs.filter((o) => o.type === "sine" && ((o.frequency as FakeParam).calls[0]?.args[0] ?? 0) > 1000);
    expect(bellish.length).toBeGreaterThan(0);
  });

  it("keeps the shared context running while either effects or music is on, and quiet in a hidden tab", () => {
    const { SND, MUS } = boot();
    MUS.setOn(true);
    expect(SND.stats().ctxState).toBe("running");
    // Muting effects must not stop the music.
    SND.setOn(false);
    expect(SND.stats().ctxState).toBe("running");
    SND.setHidden(true);
    expect(SND.stats().ctxState).toBe("suspended");
    SND.setHidden(false);
    expect(SND.stats().ctxState).toBe("running");
    MUS.setOn(false);
    expect(SND.stats().ctxState).toBe("suspended");
    SND.setOn(true);
    expect(SND.stats().ctxState).toBe("running");
  });

  it("switching off fades out and stops the scheduler", () => {
    const { MUS, made, timers } = boot();
    MUS.setOn(true);
    MUS.setOn(false);
    const { bus } = musicGraph(made);
    const last = bus.gain.calls.filter((c) => c.fn === "setTargetAtTime").pop()!;
    expect(last.args[0]).toBe(0);
    const before = made.length;
    timers.forEach((t) => t());
    expect(made.length).toBe(before);
    expect(MUS.tick()).toBe(0);
  });
});

// ---- the viewer's music setting ------------------------------------------
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
  return {
    visibilityState: "visible",
    addEventListener(t: string, f: (ev: { target?: unknown }) => void) { (ls[t] ||= []).push(f); },
    fire(t: string, ev: { target?: unknown } = {}) { (ls[t] || []).forEach((f) => f(ev)); },
  };
}
function memStore(initial: string | null = null) {
  const s = { v: initial, read: () => s.v, write: (v: string) => { s.v = v; } };
  return s;
}

describe("the remembered music setting", () => {
  it("defaults to on at the default volume; only an explicit mute is remembered as off", () => {
    for (const raw of [null, undefined, "", "junk", "{}", 3]) expect(musPrefParse(raw)).toEqual({ muted: false, volume: MUS_DEFAULT_VOLUME, follow: "acting" });
    expect(musPrefParse('{"muted":true,"volume":0.25}')).toEqual({ muted: true, volume: 0.25, follow: "acting" });
    expect(musPrefParse('{"muted":1}').muted).toBe(false);
    expect(musPrefParse('{"volume":9}').volume).toBe(1);
    for (const p of [{ muted: true, volume: 0, follow: "acting" as const }, { muted: false, volume: 0.42, follow: "ahead" as const }]) expect(musPrefParse(musPrefSerialize(p))).toEqual(p);
    expect(MUS_PREF_KEY).toBe("ai-tcg.music");
  });

  it("arms at load, starts on the first gesture with the effects, and shows the meter", () => {
    const doc = fakeDoc();
    const { SND, MUS, contexts } = boot(doc);
    const sbtn = fakeEl(), mbtn = fakeEl(), mvol = fakeEl(), meter = fakeEl();
    SND.mount(sbtn, null, memStore());
    MUS.mount(mbtn, mvol, meter, memStore());
    expect(MUS.state()).toBe("armed");
    expect(contexts()).toBe(0);
    expect(mbtn.textContent).toContain("Music on");
    expect(mbtn.classes.has("armed")).toBe(true);
    expect(mvol.value).toBe("60");
    doc.fire("pointerdown", { target: {} });
    expect(MUS.state()).toBe("on");
    expect(SND.stats().on).toBe(true);
    expect(contexts()).toBe(1);
    MUS.tick();
    expect(meter.textContent).toBe("intensity ▮··");
  });

  it("one click mutes without starting it; the mute and volume are remembered; muted music ignores gestures", () => {
    const doc = fakeDoc();
    const { MUS, contexts } = boot(doc);
    const btn = fakeEl(), vol = fakeEl(), store = memStore();
    MUS.mount(btn, vol, null, store);
    vol.value = "30"; vol.fire("input");
    doc.fire("pointerdown", { target: btn });
    btn.fire("click");
    expect(MUS.state()).toBe("muted");
    expect(contexts()).toBe(0);
    expect(btn.textContent).toContain("Music off");
    expect(vol.disabled).toBe(true);
    expect(musPrefParse(store.v)).toEqual({ muted: true, volume: 0.3, follow: "acting" });
    // Next page: still muted until switched back on.
    const doc2 = fakeDoc();
    const second = boot(doc2);
    second.MUS.mount(fakeEl(), fakeEl(), null, store);
    doc2.fire("keydown", { target: {} });
    expect(second.MUS.state()).toBe("muted");
    expect(second.contexts()).toBe(0);
  });

  it("the arpeggio follows the acting player by default, or whoever is ahead, and the choice is remembered", () => {
    expect(MUS_FOLLOW).toEqual(["acting", "ahead"]);
    expect(musSceneSide("acting", "p2", "p1")).toBe("p2");
    expect(musSceneSide(undefined, "p2", "p1")).toBe("p2");
    expect(musSceneSide("ahead", "p2", "p1")).toBe("p1");
    expect(musSceneSide("ahead", "p1", "p2")).toBe("p2");
    // An even match falls back to the acting player, so the voice never flips on a draw.
    expect(musSceneSide("ahead", "p1", "even")).toBe("p1");
    expect(musPrefParse('{"follow":"sideways"}').follow).toBe("acting");
    const doc = fakeDoc();
    const { MUS } = boot(doc);
    const store = memStore(), sel = fakeEl();
    MUS.mount(fakeEl(), fakeEl(), null, store, sel);
    expect(sel.value).toBe("acting");
    expect(MUS.follow()).toBe("acting");
    sel.value = "ahead"; sel.fire("change");
    expect(MUS.follow()).toBe("ahead");
    expect(musPrefParse(store.v).follow).toBe("ahead");
    const second = boot(fakeDoc());
    const sel2 = fakeEl();
    second.MUS.mount(fakeEl(), fakeEl(), null, store, sel2);
    expect(sel2.value).toBe("ahead");
    expect(second.MUS.follow()).toBe("ahead");
  });

  it("muting the effects leaves the music alone, and the other way round", () => {
    const doc = fakeDoc();
    const { SND, MUS } = boot(doc);
    const sbtn = fakeEl(), mbtn = fakeEl();
    SND.mount(sbtn, null, memStore());
    MUS.mount(mbtn, null, null, memStore());
    doc.fire("keydown", { target: {} });
    sbtn.fire("click");
    expect(SND.stats().on).toBe(false);
    expect(MUS.state()).toBe("on");
    expect(SND.stats().ctxState).toBe("running");
    sbtn.fire("click");
    mbtn.fire("click");
    expect(MUS.state()).toBe("muted");
    expect(SND.stats().on).toBe(true);
  });

  it("a press on either audio control never starts the other (muting effects first doesn't start the music)", () => {
    const doc = fakeDoc();
    const { SND, MUS, contexts } = boot(doc);
    const sbtn = fakeEl(), mbtn = fakeEl();
    SND.mount(sbtn, null, memStore());
    MUS.mount(mbtn, null, null, memStore());
    const inAudioCtl = { closest: (sel: string) => (sel === "[data-audio-ctl]" ? {} : null) };
    doc.fire("pointerdown", { target: inAudioCtl });
    sbtn.fire("click");
    expect(SND.stats().on).toBe(false);
    expect(MUS.state()).toBe("armed");
    expect(contexts()).toBe(0);
    // The next press anywhere else starts the music; the effects stay muted.
    doc.fire("pointerdown", { target: { closest: () => null } });
    expect(MUS.state()).toBe("on");
    expect(SND.stats().on).toBe(false);
  });

  it("browser storage that throws just isn't remembered", () => {
    const doc = fakeDoc();
    const { MUS, win } = boot(doc);
    win.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const btn = fakeEl();
    expect(() => MUS.mount(btn, null, null)).not.toThrow();
    expect(MUS.state()).toBe("armed");
    expect(() => btn.fire("click")).not.toThrow();
    expect(MUS.state()).toBe("muted");
  });
});

describe("the replay page and the FX sheet", () => {
  const replay = {
    title: "t", seed: 1, factions: { p1: "Aegis", p2: "Null" }, identities: { p1: { username: "a" }, p2: { username: "b" } },
    cardFactions: {}, movesPlayed: 0, frames: [],
  } as unknown as MatchReplay;
  const html = renderMatchHtml(replay);

  it("embeds the exact music source after the sound source and mounts its own control", () => {
    expect(html).toContain(MUSIC_PURE_SOURCE);
    expect(html).toContain(MUSIC_RUNTIME_SOURCE);
    expect(html.indexOf(MUSIC_RUNTIME_SOURCE)).toBeGreaterThan(html.indexOf(SOUND_FX_RUNTIME_SOURCE));
    expect(html).toContain('<button id="btn-music" aria-pressed="true"');
    expect(html).toContain('<span class="sound-ctl" id="sound-ctl" data-audio-ctl>');
    expect(html).toContain('<span class="sound-ctl" id="music-ctl" data-audio-ctl>');
    expect(html).toContain('<input type="range" id="music-vol" min="0" max="100" step="1" value="60"');
    expect(html).toContain("MUS.mount(document.getElementById('btn-music'), document.getElementById('music-vol'), document.getElementById('music-meter'), null, document.getElementById('music-follow'));");
  });

  it("tells the music who is acting, whether they have a Mythic in play, and when a Mythic arrives", () => {
    expect(html).toContain("const side = frame.players[musSceneSide(MUS.follow(), frame.activePlayer, frame.momentum.leader)];");
    expect(html).toContain("MUS.setScene(side.faction, hasMythic(side));");
    expect(html).toContain("if (newBoard[id].v.rarity === 'Mythic') later(enterT, function () { MUS.event('mythic', tier); });");
  });

  it("the FX sheet has a music desk running the same sources", () => {
    const sheet = renderFxSheet();
    expect(sheet).toContain(MUSIC_RUNTIME_SOURCE);
    expect(sheet).toContain("MUS.mount(document.getElementById('mus')");
  });

  it("offers the arpeggio choice beside the music control and re-voices on change (owner 2026-10-10)", () => {
    expect(html).toContain('<select id="music-follow" aria-label="The arpeggio follows"');
    expect(html).toContain('<option value="acting">arp: acting player</option>');
    expect(html.indexOf('id="music-follow"')).toBeGreaterThan(html.indexOf('<span class="sound-ctl" id="music-ctl" data-audio-ctl>'));
    expect(html.indexOf('id="music-follow"')).toBeLessThan(html.indexOf("</section>", html.indexOf('id="music-ctl"')));
    expect(html).toContain("document.getElementById('music-follow').addEventListener('change', function () { setMusicScene(frames[i]); });");
  });

  it("keeps the layer thresholds in one place", () => {
    expect(Object.keys(MUS_AT)).toEqual(["kick1", "kick3", "arp", "drive", "hats", "arp16", "kick4", "offHats", "snare"]);
  });
});

describe("sounds scheduled on the audio clock (Match Boot, render session 38)", () => {
  it("a group: each sound starts at its given time, dead centre, through the group's bus; the repeat gap doesn't drop them", () => {
    const { SND, made, clock } = boot();
    expect(SND.group()).toBeNull();
    SND.setOn(true);
    clock.t = 10;
    const g = SND.group()!;
    const comp = made.find((n) => n.kind === "compressor")!;
    const master = made.find((n) => n.kind === "gain" && n.to.includes(comp))!;
    expect(g.node.to).toEqual([master]);
    const before = made.length;
    for (let k = 0; k < 6; k++) expect(SND.play("type", "Neutral", "subtle", null, { at: 10.1 + k * 0.01, pan: 0, group: g })).toBe(true);
    const fresh = made.slice(before);
    const srcs = fresh.filter((n) => n.kind === "osc" || n.kind === "noise");
    expect(srcs).toHaveLength(12);
    expect(srcs.map((n) => n.started).sort()).toEqual([10.1, 10.1, 10.11, 10.11, 10.12, 10.12, 10.13, 10.13, 10.14, 10.14, 10.15, 10.15].map((x) => expect.closeTo(x, 9)));
    const pans = fresh.filter((n) => n.kind === "panner") as (FakeNode & { pan: FakeParam })[];
    expect(pans.every((p) => p.pan.value === 0 && p.to[0] === g.node)).toBe(true);
    expect(SND.stats()).toMatchObject({ scheduled: 6, repeats: 0 });
  });

  it("a cut fades the group out in 30 ms (no click), once", () => {
    const { SND, clock } = boot();
    SND.setOn(true);
    clock.t = 4;
    const g = SND.group()!;
    expect(g.cut()).toBe(true);
    expect(g.cut()).toBe(false);
    const ramp = g.node.gain.calls.find((c) => c.fn === "linearRampToValueAtTime")!;
    expect(ramp.args).toEqual([0, 4.03]);
    expect(SND.stats().cuts).toBe(1);
  });
});

describe("SND.sequence: a run of planned sounds on the audio clock (Match Boot and the victory boasts, render session 39)", () => {
  // The run's clock (performance.now) and the audio clock move together, as
  // in a page; a stall moves both without a tick in between.
  function run(list: SeqItem[], o: Parameters<ReturnType<typeof boot>["SND"]["sequence"]>[1] = {}) {
    const env = boot();
    env.SND.setOn(true);
    env.clock.t = 5;
    const seq = env.SND.sequence(list, { t0: env.perf.now(), ...o });
    const step = (ms: number, tick = true) => { env.advanceMs(ms); env.clock.t += ms / 1000; if (tick) seq.tick(); };
    // Time passing with the run's own 25 ms ticks.
    const walk = (ms: number) => { for (let k = 0; k < ms / 25; k++) step(25); };
    return { ...env, seq, step, walk };
  }
  const starts = (made: FakeNode[], from = 0) => made.slice(from).filter((n) => n.kind === "osc" || n.kind === "noise").map((n) => n.started as number);
  const evenly = (n: number, every: number, kind = "impact"): SeqItem[] => Array.from({ length: n }, (_, k) => ({ t: k * every, kind, tier: "subtle", x: 500 }));

  it("queues each sound at its exact time, at most 150 ms ahead, on its own 25 ms ticks", () => {
    const { seq, step, made, timers } = run(evenly(10, 100));
    // At the start: 0 and 100 ms (150 ms ahead), not 200.
    expect(seq.stats().sched.map((x) => x.t)).toEqual([0, 100]);
    expect(timers).toHaveLength(1);
    for (let k = 0; k < 40; k++) { step(25, false); timers[0]!(); }
    const st = seq.stats();
    expect(st.sched.map((x) => x.t)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
    expect(st.sched.every((x) => x.at === x.t && x.lead >= 0 && x.lead <= 150)).toBe(true);
    expect(st.late).toBe(0);
    // Each source starts on the audio clock at base + t: 5 s + t. (The fake
    // never frees a voice, so the cap stops the sources after six sounds.)
    const at = [...new Set(starts(made).map((t) => Math.round(t * 1000)))].sort((a, b) => a - b);
    expect(at).toEqual([5000, 5100, 5200, 5300, 5400, 5500]);
  });

  it("a 100 ms stall changes nothing: what falls in it was already queued, on time", () => {
    const { seq, step, walk } = run(evenly(30, 36, "type"));
    walk(400);
    step(100, false); // the stall: no tick for 100 ms
    walk(700);
    const st = seq.stats();
    expect(st.late).toBe(0);
    expect(st.sched).toHaveLength(30);
    expect(st.sched.every((x) => x.at === x.t)).toBe(true);
  });

  it("a sound more than 120 ms past when it could be queued is dropped, never played late; a later one still lands", () => {
    const { seq, step } = run([{ t: 0, kind: "impact", tier: "subtle" }, { t: 200, kind: "beam", tier: "subtle" }, { t: 330, kind: "cast", tier: "subtle" }, { t: 800, kind: "boast", tier: "spectacle" }]);
    step(500, true); // a 500 ms freeze: 200 is 300 ms past (dropped), 330 is 170 ms past (dropped)
    expect(seq.stats().late).toBe(2);
    step(200);
    expect(seq.stats().sched.map((x) => [x.kind, x.at])).toEqual([["impact", 0], ["boast", 800]]);
  });

  it("a suspended context or sound switched off queues nothing; switched on late, only what is still to come plays", () => {
    const env = boot();
    env.clock.t = 2;
    const seq = env.SND.sequence(evenly(6, 100), { t0: env.perf.now() });
    expect(seq.stats().queued).toBe(0);
    env.advanceMs(240); env.clock.t += 0.24;
    env.SND.setOn(true);
    seq.tick();
    // Tied to the run's clock when it first could: 0 and 100 are past the
    // 120 ms limit, 200 is 40 ms late (played now), 300 is ahead, 400 is
    // past the lookahead.
    expect(seq.stats().late).toBe(2);
    expect(seq.stats().sched.map((x) => [x.t, x.at])).toEqual([[200, 240], [300, 300]]);
  });

  it("pans by each sound's x, or a fixed pan; through one group; in the run's voice", () => {
    const a = run([{ t: 0, kind: "impact", tier: "normal", x: 100 }, { t: 10, kind: "impact", tier: "normal", x: 900 }], { faction: "Swarm" });
    const pans = a.made.filter((n) => n.kind === "panner") as (FakeNode & { pan: FakeParam })[];
    const vals = [...new Set(pans.map((p) => p.pan.value))];
    expect(vals).toEqual([expect.closeTo(-0.6, 9), expect.closeTo(0.6, 9)]);
    const grp = a.made.find((n) => n.kind === "gain" && pans.length && pans[0]!.to[0] === n);
    expect(grp).toBeDefined();
    expect(pans.every((p) => p.to[0] === grp)).toBe(true);
    expect(a.SND.stats()).toMatchObject({ scheduled: 2, repeats: 0 });
    const b = run([{ t: 0, kind: "impact", tier: "normal", x: 100 }], { pan: 0 });
    expect((b.made.filter((n) => n.kind === "panner") as (FakeNode & { pan: FakeParam })[]).every((p) => p.pan.value === 0)).toBe(true);
  });

  it("cut() fades the group out and stops queueing; stop() stops queueing and lets what is queued ring", () => {
    const a = run(evenly(10, 100));
    a.step(100);
    expect(a.seq.cut()).toBe(true);
    const g = a.made.find((n) => n.kind === "gain" && (n as FakeNode & { gain: FakeParam }).gain.calls.some((c) => c.fn === "linearRampToValueAtTime")) as FakeNode & { gain: FakeParam };
    expect(g.gain.calls.find((c) => c.fn === "linearRampToValueAtTime")!.args).toEqual([0, expect.closeTo(5.13, 9)]);
    const n = a.seq.stats().queued;
    a.step(500);
    expect(a.seq.stats()).toMatchObject({ queued: n, stopped: true });
    const b = run(evenly(10, 100));
    b.step(100);
    b.seq.stop();
    b.step(500);
    expect(b.seq.stats().queued).toBe(3);
    expect(b.SND.stats().cuts).toBe(0);
  });

  it("onQueue hears each sound as it is queued, with its audio time", () => {
    const got: [string, number][] = [];
    const { walk } = run(evenly(3, 100, "beam"), { onQueue: (m, at) => got.push([m.kind, Math.round(at * 1000)]) });
    walk(300);
    expect(got).toEqual([["beam", 5000], ["beam", 5100], ["beam", 5200]]);
  });
});

describe("the music's dips on the audio clock (the victory boasts, render session 39)", () => {
  function on() {
    const env = boot();
    env.SND.setOn(true);
    env.MUS.setOn(true);
    env.clock.t = 5;
    const { duck } = musicGraph(env.made);
    const calls = () => duck.gain.calls.filter((c) => c.fn !== "cancelScheduledValues").map((c) => [c.fn, ...c.args.map((x) => +x.toFixed(4))]);
    return { ...env, duck, calls };
  }
  it("a sound queued ahead dips the music when it plays, not when it was queued", () => {
    const { SND, duck, calls } = on();
    const g = SND.group()!;
    SND.play("impact", "Aegis", "subtle", null, { at: 5.14, group: g });
    expect(calls()).toEqual([["setTargetAtTime", MUS_DUCK_TO, 5.14, 0.01], ["setTargetAtTime", 1, 5.24, 0.2]]);
    // No jump to the present value at a future time.
    expect(duck.gain.calls.some((c) => c.fn === "setValueAtTime" && c.args[1] === 5.14)).toBe(false);
  });

  it("a sound played now dips at once, as before (the match's own sounds)", () => {
    const { SND, calls } = on();
    SND.play("impact", "Aegis", "subtle", null);
    expect(calls()).toEqual([["setValueAtTime", 1, 5], ["setTargetAtTime", MUS_DUCK_TO, 5, 0.01], ["setTargetAtTime", 1, 5.1, 0.2]]);
  });

  it("a sting's hold queued ahead starts with the sting; a dip queued before it doesn't lift it; dips inside it are skipped", () => {
    const { MUS, calls, duck } = on();
    expect(MUS.duckHold(1.2, 5.15)).toBe(true);
    expect(calls()).toEqual([["setTargetAtTime", MUS_BOAST_DUCK_TO, 5.15, 0.04], ["setTargetAtTime", 1, 6.35, 0.25]]);
    // A dip at 5.1 (ends after the hold begins): it dips, but sets no
    // recovery of its own and cancels nothing of the hold's.
    expect(MUS.duck(5.1)).toBe(true);
    expect(calls()).toHaveLength(3);
    expect(duck.gain.calls.filter((c) => c.fn === "cancelScheduledValues")).toHaveLength(1);
    // A dip well before it recovers before the hold begins.
    expect(MUS.duck(5.01)).toBe(true);
    expect(calls().slice(-2)).toEqual([["setTargetAtTime", MUS_DUCK_TO, 5.01, 0.01], ["setTargetAtTime", 1, 5.11, 0.2]]);
    // Inside the hold: skipped.
    expect(MUS.duck(5.6)).toBe(false);
    expect(MUS.duck(6.4)).toBe(true);
  });

  it("a hold asked for now (no time, or a time already past) starts now, as before", () => {
    const { MUS, calls } = on();
    expect(MUS.duckHold(1, 4.9)).toBe(true);
    expect(calls()).toEqual([["setValueAtTime", 1, 5], ["setTargetAtTime", MUS_BOAST_DUCK_TO, 5, 0.04], ["setTargetAtTime", 1, 6, 0.25]]);
  });
});
