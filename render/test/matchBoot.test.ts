// Match Boot, slice 1 (render session 35): the saying picker, list 1, the
// intro grammar (symmetric and centre-out) on many layouts, the still, the
// two new sounds, and the replay page's wiring. Slice 2 (render session 38):
// its own power-on, the rare flourish, the music mark, the two-row agent
// lines on a phone.
import { describe, expect, it } from "vitest";
import { CARD_REGISTRY } from "@ai-tcg/engine";
import {
  BOOT_LIST_VERSION,
  BOOT_MS,
  BOOT_RARE,
  BOOT_SAYINGS,
  BOOT_STILL_MS,
  BOOT_CH,
  BOOT_FS_MAX,
  BOOT_FS2_MAX,
  BOOT_HEAD,
  bootHash,
  bootLine,
  bootPlan,
  bootPlanProblem,
  bootSaying,
  bootStill,
  type BootGeom,
  type BootPlan,
} from "../src/matchBootFx.js";
import { BOAST_FONT } from "../src/boastFx.js";
import { sfxRecipe } from "../src/soundFx.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import { captureReplay } from "../src/replaySetup.js";

// The replay page's halves on a desktop and a phone (measured in the
// browser check), plus layouts the page could produce.
const DESKTOP: BootGeom = { top: { l: 16, t: 330, r: 1264, b: 520 }, bot: { l: 16, t: 546, r: 1264, b: 736 }, area: { l: 16, t: 330, r: 1264, b: 736 } };
const PHONE: BootGeom = { top: { l: 8, t: 420, r: 382, b: 560 }, bot: { l: 8, t: 584, r: 382, b: 724 }, area: { l: 8, t: 420, r: 382, b: 724 } };
// The replay's phone halves as the browser check measured them (render
// session 38): each half much taller than wide.
const PHONE_TALL: BootGeom = { top: { l: 12, t: 92, r: 378, b: 406 }, bot: { l: 12, t: 438, r: 378, b: 752 }, area: { l: 12, t: 92, r: 378, b: 752 } };
const UNEVEN: BootGeom = { top: { l: 16, t: 329, r: 1264, b: 520 }, bot: { l: 16, t: 546, r: 1265, b: 736.5 }, area: { l: 16, t: 329, r: 1265, b: 736.5 } };
const NO_GAP: BootGeom = { top: { l: 0, t: 0, r: 800, b: 160 }, bot: { l: 0, t: 160, r: 800, b: 320 }, area: { l: 0, t: 0, r: 800, b: 320 } };
const LAYOUTS: [string, BootGeom][] = [["desktop", DESKTOP], ["phone", PHONE], ["phone, tall", PHONE_TALL], ["uneven", UNEVEN], ["no gap", NO_GAP]];
const FACTIONS = ["Cortex", "Aegis", "Swarm", "Null"];
const LONG = "Coiljackal's Croupier of the Ninth Relay";

describe("the saying (list 1)", () => {
  it("is list 1, frozen: a change here must first store the saying on the match record (game lane)", () => {
    expect(BOOT_LIST_VERSION).toBe(1);
    expect(BOOT_SAYINGS).toEqual(["FIGHT", "ENGAGE", "> RUN MATCH.EXE", "EXECUTE", "LINK ESTABLISHED", "ACCESS GRANTED", "OVERCLOCK", "BREACH"]);
    expect(BOOT_RARE).toBe("> SUDO FIGHT");
    // Pinned picks: old replays keep these sayings.
    const picks: Record<number, string> = { 1: "OVERCLOCK", 2: "ACCESS GRANTED", 3: "FIGHT", 4: "BREACH", 5: "FIGHT", 6: "ENGAGE", 7: "LINK ESTABLISHED", 8: "ACCESS GRANTED", 11: "BREACH", 105: BOOT_RARE, 2026: "LINK ESTABLISHED" };
    for (const [seed, saying] of Object.entries(picks)) expect(bootSaying(Number(seed)), `seed ${seed}`).toBe(saying);
  });

  it("is > SUDO FIGHT for 1 seed in 100 and spreads the other eight evenly (100,000 seeds, all within 4 sd)", () => {
    const N = 100_000, count: Record<string, number> = {};
    for (let s = 1; s <= N; s++) { const x = bootSaying(s); count[x] = (count[x] ?? 0) + 1; }
    expect(Object.keys(count).sort()).toEqual([...BOOT_SAYINGS, BOOT_RARE].sort());
    const within = (n: number, p: number) => Math.abs(n - N * p) <= 4 * Math.sqrt(N * p * (1 - p));
    expect(within(count[BOOT_RARE]!, 0.01), `rare ${count[BOOT_RARE]}`).toBe(true);
    for (const s of BOOT_SAYINGS) expect(within(count[s]!, 0.99 / 8), `${s} ${count[s]}`).toBe(true);
  });

  it("comes from the seed alone, for any seed the engine can take", () => {
    for (const s of [0, 1, 4294967295, 4294967296, 2 ** 40 + 7, Number.MAX_SAFE_INTEGER]) {
      expect(bootSaying(s)).toBe(bootSaying(s));
      expect(bootHash(s)).toBeGreaterThanOrEqual(0);
      expect(bootHash(s)).toBeLessThan(2 ** 32);
    }
    expect(bootHash(4294967296)).not.toBe(bootHash(0));
  });

  it("is never a card name, never JACK IN, and every character is in the dot font", () => {
    const names = [...CARD_REGISTRY.values()].map((c) => c.name.toUpperCase());
    for (const s of [...BOOT_SAYINGS, BOOT_RARE]) {
      const bare = s.replace(/^> /, "");
      expect(names, s).not.toContain(bare);
      for (const n of names) expect(bare.includes(n), `${s} holds ${n}`).toBe(false);
      expect(s).not.toMatch(/JACK IN/);
      for (const ch of s) expect(BOAST_FONT[ch], `"${ch}" in ${s}`).toBeDefined();
    }
  });
});

function plans(): [string, BootGeom, BootPlan][] {
  const out: [string, BootGeom, BootPlan][] = [];
  for (const [lk, g] of LAYOUTS) {
    for (const saying of [...BOOT_SAYINGS, BOOT_RARE]) {
      for (const [a, b] of [["Cortex", "Swarm"], ["Null", "Aegis"], ["Aegis", "Aegis"]]) {
        out.push([`${lk} ${saying} ${a}/${b}`, g, bootPlan(g, { top: { name: "Brood Signal", faction: a }, bot: { name: LONG, faction: b } }, 1, { saying })]);
      }
    }
  }
  return out;
}

describe("the intro grammar: symmetric and centre-out", () => {
  it("holds for every saying, faction pair (a mirror match too) and layout, animated and still", () => {
    for (const [k, g, p] of plans()) {
      expect(bootPlanProblem(p, g), k).toBeNull();
      expect(bootPlanProblem(bootStill(p), g), k + " (still)").toBeNull();
    }
  });

  it("runs about 2.6 s: power on, both lines at once, HANDSHAKE OK, the saying at 1.6 s, the board after", () => {
    const p = bootPlan(DESKTOP, { top: { name: "A", faction: "Null" }, bot: { name: "B", faction: "Cortex" } }, 3);
    expect(p.ms).toBe(BOOT_MS);
    expect(BOOT_MS).toBeGreaterThanOrEqual(2000);
    expect(BOOT_MS).toBeLessThanOrEqual(3000);
    const [t, b] = p.halves;
    expect(t!.on).toEqual(b!.on);
    expect(t!.line.t0).toBe(b!.line.t0);
    expect(t!.line.t0 + t!.line.ms).toBeLessThan(p.handshake!.t0);
    expect(p.handshake!.t0 + p.handshake!.ms).toBeLessThan(p.say.t);
    expect(p.say.t).toBe(1600);
    expect(p.handshake!.gone).toBe(p.say.t);
    expect(t!.line.clear!.t).toBe(p.say.t);
    expect(p.say.out[1]).toBe(p.ms);
    expect(p.marks.at(-1)).toEqual({ k: "end", t: BOOT_MS });
  });

  it("each half in its own faction's colour; the agent lines as the owner wrote them, padded to one length", () => {
    const p = bootPlan(DESKTOP, { top: { name: "Hollow Index", faction: "Null" }, bot: { name: LONG, faction: "Swarm" } }, 3);
    expect(p.halves.map((h) => h.faction)).toEqual(["Null", "Swarm"]);
    expect(p.halves[0]!.line.txt.trimEnd()).toBe("LOADING AGENT: Hollow Index [NULL]");
    expect(p.halves[1]!.line.txt).toBe(bootLine(LONG, "Swarm"));
    expect(p.halves[0]!.line.txt.length).toBe(p.halves[1]!.line.txt.length);
  });

  it("the readouts clear away from the centre: the top line up, the bottom line down", () => {
    const p = bootPlan(PHONE, { top: { name: "A", faction: "Aegis" }, bot: { name: "B", faction: "Aegis" } }, 9);
    expect(p.halves[0]!.line.clear!.dy).toBeLessThan(0);
    expect(p.halves[1]!.line.clear!.dy).toBeGreaterThan(0);
  });

  it("every sound sits on the centre, so its pan favours neither side; the music waits for the whole intro", () => {
    const p = bootPlan(DESKTOP, { top: { name: "A", faction: "Aegis" }, bot: { name: "B", faction: "Swarm" } }, 9);
    const sounds = p.marks.filter((m) => m.k === "sound");
    // Its own power-on (session 38), not Boot Sequence's 'crt'.
    expect(new Set(sounds.map((m) => m.kind))).toEqual(new Set(["bootOn", "type", "handshake", "bootHit"]));
    for (const m of sounds) expect(m.x).toBe(p.cx);
    expect(p.marks.filter((m) => m.k === "music")).toEqual([{ k: "music", t: 0, ms: BOOT_MS }]);
    expect(p.marks.some((m) => (m.k as string) === "duck")).toBe(false);
  });

  it("the rare saying, and only the rare saying, adds root access granted over the hit", () => {
    for (const saying of [...BOOT_SAYINGS, BOOT_RARE]) {
      const p = bootPlan(DESKTOP, {}, 1, { saying });
      const root = p.marks.filter((m) => m.kind === "bootRoot");
      expect(root.length, saying).toBe(saying === BOOT_RARE ? 1 : 0);
      if (root.length) {
        expect(root[0]!.t).toBeGreaterThan(p.say.t);
        expect(root[0]!.t).toBeLessThan(p.say.out[0]);
        expect(bootStill(p).marks.filter((m) => m.kind === "bootRoot")).toHaveLength(1);
      }
    }
    expect(bootSaying(105)).toBe(BOOT_RARE);
    expect(bootPlan(DESKTOP, {}, 105).marks.some((m) => m.kind === "bootRoot")).toBe(true);
  });

  it("on a phone a squeezed agent line breaks after LOADING AGENT:, both halves alike, and reads bigger", () => {
    const who = { top: { name: "Lookahead-Swarm", faction: "Swarm" }, bot: { name: LONG, faction: "Null" } };
    const one = bootPlan(DESKTOP, who, 1), two = bootPlan(PHONE, who, 1);
    expect(one.halves[0]!.line.rows).toBeUndefined();
    const [t, b] = two.halves.map((h) => h.line);
    expect(t!.rows![0].trimEnd()).toBe(BOOT_HEAD.trimEnd());
    expect(t!.rows![1].trimEnd()).toBe("Lookahead-Swarm [SWARM]");
    expect(b!.rows![1].trimEnd()).toBe(`${LONG} [NULL]`);
    expect(t!.rows!.map((r) => r.length)).toEqual(b!.rows!.map((r) => r.length));
    // Bigger than one squeezed row would be, within the two-row cap.
    const W = PHONE.top.r - PHONE.top.l, oneRow = (W - 24) / (BOOT_CH * (bootLine(LONG, "Null").length + 1));
    expect(t!.fs).toBeGreaterThanOrEqual(oneRow * 1.2);
    expect(t!.fs).toBeLessThanOrEqual(BOOT_FS2_MAX);
    // Typed as one line: the clicks cover both rows.
    expect(t!.ms).toBe(Math.min(720, (t!.rows![0].length + t!.rows![1].length) * 22));
    expect(bootPlanProblem(two, PHONE)).toBeNull();
    expect(bootPlanProblem(bootStill(two), PHONE)).toBeNull();
    // A typical name on the replay's phone layout breaks too (one row is
    // squeezed under 15 px; the halves there are tall).
    const typical = bootPlan(PHONE_TALL, { top: { name: "Lookahead-Swarm", faction: "Swarm" }, bot: { name: "Lookahead-Null", faction: "Null" } }, 1);
    expect(typical.halves[0]!.line.rows).toBeDefined();
    expect(typical.halves[0]!.line.fs).toBe(BOOT_FS2_MAX);
    // Short names on a wide board never break, and stay at most 15 px.
    for (const [, g, p] of plans()) if (g === DESKTOP || g === UNEVEN || g === NO_GAP) { expect(p.halves[0]!.line.rows).toBeUndefined(); expect(p.halves[0]!.line.fs).toBeLessThanOrEqual(BOOT_FS_MAX); }
  });

  it("a long saying breaks onto two lines on a phone, when that is bigger", () => {
    const desk = bootPlan(DESKTOP, {}, 1, { saying: "LINK ESTABLISHED" }), phone = bootPlan(PHONE, {}, 1, { saying: "LINK ESTABLISHED" });
    expect(desk.say.bits.rows).toBe(7);
    expect(phone.say.bits.rows).toBe(16);
    expect(phone.say.w).toBeLessThanOrEqual((PHONE.top.r - PHONE.top.l) * 0.86 + 0.01);
  });

  it("catches a plan that breaks the grammar", () => {
    const g = DESKTOP, ok = () => bootPlan(g, { top: { name: "A", faction: "Aegis" }, bot: { name: "Bee", faction: "Swarm" } }, 4);
    const cases: [string, (p: BootPlan) => void, RegExp][] = [
      ["one line typed first", (p) => { p.halves[1]!.line.t0 += 50; }, /type at different times/],
      ["one line nearer the centre", (p) => { p.halves[0]!.line.y += 6; }, /not mirror images/],
      ["one half powers on later", (p) => { p.halves[0]!.on.t = 40; }, /power on at different times/],
      ["a line clears toward the centre", (p) => { p.halves[0]!.line.clear!.dy *= -1; p.halves[1]!.line.clear!.dy *= -1; }, /toward the centre/],
      ["the saying off the centre line", (p) => { p.say.y -= 10; }, /off the centre line/],
      ["a sound panned to one side", (p) => { (p.marks.find((m) => m.k === "sound")!).x = 100; }, /panned off centre/],
      ["a saying off the list", (p) => { p.saying = "JACK IN"; }, /not on list 1/],
      ["a screen in the other half", (p) => { p.halves[0]!.screen.b = p.mid + 20; }, /leaves its half/],
      ["too long", (p) => { p.ms = 4000; }, /2-3 s/],
      ["the music back before the end", (p) => { p.marks.find((m) => m.k === "music")!.ms = 1000; }, /music does not wait/],
      ["one line on two rows, the other on one", (p) => { p.halves[0]!.line.rows = ["LOADING AGENT: ", "A [AEGIS]      "]; }, /two rows and the other does not/],
    ];
    expect(bootPlanProblem(ok(), g)).toBeNull();
    for (const [what, breakIt, why] of cases) {
      const p = ok();
      breakIt(p);
      expect(bootPlanProblem(p, g), what).toMatch(why);
    }
  });
});

describe("the reduced-motion still", () => {
  it("is everything lit and still for about 1 s, with only the thump and the hit", () => {
    const s = bootStill(bootPlan(DESKTOP, { top: { name: "A", faction: "Cortex" }, bot: { name: "B", faction: "Null" } }, 5));
    expect(s.still).toBe(true);
    expect(s.ms).toBe(BOOT_STILL_MS);
    for (const h of s.halves) { expect(h.on.ms).toBe(0); expect(h.line.ms).toBe(0); expect(h.line.clear).toBeNull(); }
    expect(s.say.t).toBe(0);
    expect(s.say.slam).toBe(0);
    expect(s.handshake!.y).toBeGreaterThan(s.mid + s.say.h / 2);
    expect(s.marks.filter((m) => m.k === "sound").map((m) => m.kind).sort()).toEqual(["bootHit", "bootOn"]);
    expect(s.marks.filter((m) => m.k === "music")).toEqual([{ k: "music", t: 0, ms: BOOT_STILL_MS }]);
    expect(s.marks.every((m) => m.t === 0 || m.k === "end")).toBe(true);
  });

  it("drops HANDSHAKE OK when it would run into the bottom agent's line", () => {
    const tight: BootGeom = { top: { l: 0, t: 0, r: 360, b: 60 }, bot: { l: 0, t: 62, r: 360, b: 122 }, area: { l: 0, t: 0, r: 360, b: 122 } };
    const s = bootStill(bootPlan(tight, {}, 1, { saying: "LINK ESTABLISHED" }));
    expect(s.handshake).toBeNull();
    expect(bootPlanProblem(s, tight)).toBeNull();
  });
});

describe("the intro's sounds", () => {
  const seeded = () => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; };
  it("the power-on, the chirp, the hit and the rare flourish play, and sound the same whichever factions are playing", () => {
    for (const kind of ["bootOn", "handshake", "bootHit", "bootRoot"] as const) {
      const base = sfxRecipe(kind as never, "Neutral", "normal", seeded());
      expect(base.length, kind).toBeGreaterThan(0);
      for (const f of FACTIONS) expect(sfxRecipe(kind as never, f, "normal", seeded()), `${kind} ${f}`).toEqual(base);
    }
    // The chirp is far shorter than Dial-Up Fireworks' screech.
    const end = (vs: { dur: number; delay?: number }[]) => Math.max(...vs.map((v) => (v.delay ?? 0) + v.dur));
    expect(end(sfxRecipe("handshake" as never, "Neutral", "normal", seeded()))).toBeLessThan(end(sfxRecipe("modem" as never, "Neutral", "normal", seeded())) / 3);
  });

  it("the power-on is its own, not Boot Sequence's tube: deeper, with a degauss hum the boast doesn't have", () => {
    const on = sfxRecipe("bootOn" as never, "Neutral", "normal", seeded()), crt = sfxRecipe("crt" as never, "Neutral", "normal", seeded());
    expect(on).not.toEqual(crt);
    const thump = (vs: typeof on) => vs.find((v) => v.k === "tone" && v.type === "sine" && v.f1 !== undefined && v.f1 < v.f0)!;
    expect(thump(on).f0).toBeLessThan(thump(crt).f0);
    const hum = (vs: typeof on) => vs.filter((v) => v.k === "tone" && v.type === "sawtooth" && v.f0 <= 100);
    expect(hum(on).length).toBeGreaterThan(0);
    expect(hum(crt)).toHaveLength(0);
  });

  it("the rare flourish climbs: three blips, each higher, after a glitch", () => {
    const r = sfxRecipe("bootRoot" as never, "Neutral", "normal", seeded()).filter((v) => (v.delay ?? 0) >= 0.15);
    expect(r).toHaveLength(3);
    expect(r[0]!.f0).toBeLessThan(r[1]!.f0);
    expect(r[1]!.f0).toBeLessThan(r[2]!.f0);
    expect(r[2]!.f0 / r[0]!.f0).toBeCloseTo(2, 1);
  });
});

describe("the replay page", () => {
  it("embeds Match Boot, names the board area and starts it from Play at move 0", async () => {
    const { replay } = await captureReplay("Cortex", "Swarm", 3, false);
    const html = renderMatchHtml(replay);
    expect(html).toContain('id="board-area"');
    expect(html).toContain("window.__boot = BOOT");
    expect(html).toContain("function bootPlanProblem");
    expect(html).toMatch(/if \(i === 0 && startBoot\(\)\) return;/);
    // A jump, a step and a pause cancel it.
    expect(html).toMatch(/function goTo\(n\) \{\s+const target[^\n]+\n\s+BOOT\.cancel\(\);/);
    expect(html).toMatch(/function stop\(\) \{[^\n]*BOOT\.cancel\(\);/);
  });
});
