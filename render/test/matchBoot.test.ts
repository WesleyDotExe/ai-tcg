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
  BOOT_STILL_SAY_AT,
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
import { COIN_DEFAULT, COIN_NEON_REACH, COIN_PEAK, COIN_SPECS, coinFaceAt, coinFlight, coinHalfTurns, coinResult, coinSpecOf, coinWhirOf } from "../src/coinFx.js";
import { SEASON_0_COINS, SEASON_0_TIER_COINS, STARTER_COIN } from "@ai-tcg/economy";
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

  it("runs about 3.4 s: power on, both lines at once, HANDSHAKE OK, the coin from 1.5 s, the saying at 2.4 s, the board after", () => {
    const p = bootPlan(DESKTOP, { top: { name: "A", faction: "Null" }, bot: { name: "B", faction: "Cortex" } }, 3);
    expect(p.ms).toBe(BOOT_MS);
    // Owner-approved 2026-11-02: from about 2.6 s to about 3.4 s with the coin.
    expect(BOOT_MS).toBe(3400);
    const [t, b] = p.halves;
    expect(t!.on).toEqual(b!.on);
    expect(t!.line.t0).toBe(b!.line.t0);
    expect(t!.line.t0 + t!.line.ms).toBeLessThan(p.handshake!.t0);
    expect(p.handshake!.t0 + p.handshake!.ms).toBeLessThan(p.say.t);
    expect(p.say.t).toBe(2400);
    expect(p.handshake!.gone).toBe(p.coin.t0);
    expect([p.coin.t0, p.coin.land, p.result.t0, p.coin.gone]).toEqual([1500, 2100, 2200, 2400]);
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
    expect(new Set(sounds.map((m) => m.kind))).toEqual(new Set(["bootOn", "type", "handshake", "coinFlick", "coinWhir", "coinClink", "bootHit"]));
    expect(sounds.find((m) => m.kind === "coinFlick")!.t).toBe(p.coin.t0);
    expect(sounds.find((m) => m.kind === "coinClink")!.t).toBe(p.coin.land);
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
      ["too long", (p) => { p.ms = 4000; }, /2-3.5 s/],
      ["the pulse in the other half", (p) => { p.pulse.side = "top"; }, /half of the player who goes first/],
      ["the pulse toward the centre", (p) => { const f = p.pulse.from; p.pulse.from = p.pulse.to; p.pulse.to = f; }, /toward the centre/],
      ["the pulse before the landing", (p) => { p.pulse.t = p.coin.land - 100; }, /before the coin lands/],
      ["the coin on the wrong face", (p) => { p.coin.halfTurns += 1; }, /wrong face/],
      ["the coin off the centre line", (p) => { p.coin.y -= 12; }, /not centred on the centre line/],
      ["a coin too big for the gap", (p) => { const d = 90 - p.coin.r; p.coin.r = 90; p.result.y += d; }, /agent line|leaves the board/],
      ["the coin still up as the saying lands", (p) => { p.coin.gone = p.say.t + 200; }, /out of order/],
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
  it("is everything lit and still for about 1.3 s: the landed coin with its line, then the saying; only the thump, the clink and the hit", () => {
    const s = bootStill(bootPlan(DESKTOP, { top: { name: "A", faction: "Cortex" }, bot: { name: "B", faction: "Null" } }, 5));
    expect(BOOT_STILL_MS).toBe(1300);
    expect([s.coin.t0, s.coin.land, s.result.t0, s.result.ms]).toEqual([0, 0, 0, 0]);
    expect(s.coin.gone).toBe(BOOT_STILL_SAY_AT);
    expect(s.pulse.ms).toBe(0);
    expect(s.still).toBe(true);
    expect(s.ms).toBe(BOOT_STILL_MS);
    for (const h of s.halves) { expect(h.on.ms).toBe(0); expect(h.line.ms).toBe(0); expect(h.line.clear).toBeNull(); }
    expect(s.say.t).toBe(BOOT_STILL_SAY_AT);
    expect(s.say.slam).toBe(0);
    expect(s.handshake!.y).toBeGreaterThan(s.mid + s.say.h / 2);
    expect(s.marks.filter((m) => m.k === "sound").map((m) => `${m.kind}@${m.t}`).sort()).toEqual([`bootHit@${BOOT_STILL_SAY_AT}`, "bootOn@0", "coinClink@0"]);
    expect(s.marks.filter((m) => m.k === "music")).toEqual([{ k: "music", t: 0, ms: BOOT_STILL_MS }]);
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

describe("the coin flip (render session 53)", () => {
  const WHO = { top: { name: "Hive Courier", faction: "Swarm" }, bot: { name: "Static Widow", faction: "Null" } };

  it("the line: YOU / THEY GO FIRST on the viewer's own match, <NAME> GOES FIRST for a spectator", () => {
    const names = { p1: "Static Widow", p2: "Hive Courier" };
    expect(coinResult({ near: "p1", own: true, names })).toBe("YOU GO FIRST");
    expect(coinResult({ near: "p2", own: true, names })).toBe("THEY GO FIRST");
    expect(coinResult({ near: "p1", own: false, names })).toBe("STATIC WIDOW GOES FIRST");
    // A spectator watching as the second player still reads the first player's name.
    expect(coinResult({ near: "p2", own: false, names })).toBe("STATIC WIDOW GOES FIRST");
  });

  it("lands portrait up exactly when the near player goes first, and spins at least four turns either way", () => {
    for (const portraitUp of [true, false]) {
      const turns = coinHalfTurns(portraitUp);
      expect(turns).toBeGreaterThanOrEqual(8);
      expect(coinFaceAt(coinFlight(1, turns).angle)).toBe(portraitUp ? "portrait" : "design");
      // It starts design up, and both faces show on the way.
      expect(coinFaceAt(coinFlight(0, turns).angle)).toBe("design");
      const faces = new Set(Array.from({ length: 200 }, (_, k) => coinFaceAt(coinFlight(k / 199, turns).angle)));
      expect(faces).toEqual(new Set(["design", "portrait"]));
      // It rises toward the viewer and comes back: never smaller, at most COIN_PEAK.
      for (let k = 0; k <= 50; k++) {
        const f = coinFlight(k / 50, turns);
        expect(f.scale).toBeGreaterThanOrEqual(1);
        expect(f.scale).toBeLessThanOrEqual(COIN_PEAK + 1e-9);
      }
      expect(coinFlight(0, turns).scale).toBe(1);
      expect(coinFlight(1, turns).scale).toBeCloseTo(1, 9);
    }
  });

  it("the first player's half gets the pulse, on every layout, whichever side the viewer is on, animated and still", () => {
    for (const [name, g] of LAYOUTS) {
      for (const first of ["top", "bot"] as const) {
        const p = bootPlan(g, WHO, 7, { coin: { first, portraitUp: first === "bot", line: "YOU GO FIRST" } });
        expect(bootPlanProblem(p, g), `${name} ${first}`).toBeNull();
        expect(bootPlanProblem(bootStill(p), g), `${name} ${first} (still)`).toBeNull();
        expect(p.pulse.side).toBe(first);
        expect(p.first).toBe(first);
        expect(p.pulse.dir).toBe(first === "top" ? -1 : 1);
      }
    }
  });

  it("a long name's line shrinks to fit the board, never off it", () => {
    for (const [name, g] of LAYOUTS) {
      const p = bootPlan(g, WHO, 7, { coin: { first: "top", portraitUp: false, line: `${LONG.toUpperCase()} GOES FIRST` } });
      expect(bootPlanProblem(p, g), name).toBeNull();
      expect(p.result.txt).toBe(`${LONG.toUpperCase()} GOES FIRST`);
    }
  });

  it("without a coin given, the bottom player goes first on the house coin", () => {
    const p = bootPlan(DESKTOP, WHO, 1);
    expect(p.coin.id).toBe(COIN_DEFAULT);
    expect(p.coin.portraitUp).toBe(true);
    expect(p.first).toBe("bot");
    expect(p.result.txt).toBe("STATIC WIDOW GOES FIRST");
  });

  it("draws every Season 0 coin by its own look (render session 55); a coin it doesn't know flips the Chrome Token and says so", () => {
    const shipped = [STARTER_COIN, ...SEASON_0_COINS, ...Object.values(SEASON_0_TIER_COINS)];
    expect(Object.keys(COIN_SPECS).sort()).toEqual(shipped.map((c) => c.itemId).sort());
    for (const item of shipped) {
      expect(COIN_SPECS[item.itemId]!.name, item.itemId).toBe(item.name);
      expect(coinSpecOf(item.itemId)).toMatchObject({ id: item.itemId, fallback: false });
      expect(bootPlan(DESKTOP, WHO, 1, { coin: { id: item.itemId } }).coin).toMatchObject({ id: item.itemId, fallback: false });
    }
    expect(STARTER_COIN.itemId).toBe(COIN_DEFAULT);
    // Six different looks: no two share a face design and an outline.
    const looks = shipped.map((c) => `${COIN_SPECS[c.itemId]!.face}/${COIN_SPECS[c.itemId]!.sides}`);
    expect(new Set(looks).size).toBe(6);
    // The tier coins carry the season mark; the others don't.
    for (const c of Object.values(SEASON_0_TIER_COINS)) expect(COIN_SPECS[c.itemId]!.mark).toBe("S0");
    for (const c of [STARTER_COIN, ...SEASON_0_COINS]) expect(COIN_SPECS[c.itemId]!.mark).toBeUndefined();
    // Neon Nickel trails light; only it.
    expect(Object.entries(COIN_SPECS).filter(([, s]) => s.trail).map(([id]) => id)).toEqual(["coin-s0-neon-nickel"]);
    expect(coinSpecOf("coin-s1-platinum")).toMatchObject({ id: COIN_DEFAULT, fallback: true });
    expect(coinSpecOf(undefined)).toMatchObject({ id: COIN_DEFAULT, fallback: false });
  });

  it("every coin keeps the grammar on every layout, animated and still, its halo clear of the agent lines", () => {
    for (const id of Object.keys(COIN_SPECS)) {
      for (const [name, g] of LAYOUTS) {
        for (const first of ["top", "bot"] as const) {
          const p = bootPlan(g, WHO, 7, { coin: { id, first, portraitUp: first === "bot", line: "THEY GO FIRST" } });
          expect(bootPlanProblem(p, g), `${id} ${name} ${first}`).toBeNull();
          expect(bootPlanProblem(bootStill(p), g), `${id} ${name} ${first} (still)`).toBeNull();
          expect(p.coin.reach, id).toBe(COIN_SPECS[id]!.neon ? COIN_NEON_REACH : 1);
        }
      }
    }
    // A halo coin is drawn a little smaller, so its light fits where the
    // Chrome Token's rim does (on a layout where the room decides).
    let squeezed = 0;
    const SHORT: BootGeom = { top: { l: 0, t: 0, r: 800, b: 110 }, bot: { l: 0, t: 120, r: 800, b: 230 }, area: { l: 0, t: 0, r: 800, b: 230 } };
    for (const [, g] of [...LAYOUTS, ["short", SHORT] as [string, BootGeom]]) {
      const chrome = bootPlan(g, WHO, 7, { coin: { id: "coin-chrome-token" } }).coin, nickel = bootPlan(g, WHO, 7, { coin: { id: "coin-s0-neon-nickel" } }).coin;
      if (chrome.r >= 40) continue; // the size cap decides here, not the room
      squeezed++;
      expect(nickel.r * nickel.reach).toBeLessThanOrEqual(chrome.r + 1e-9);
    }
    expect(squeezed).toBeGreaterThan(0);
  });

  it("each coin's spin plays its own whir (the plain one without), dead centre, and the still drops it", () => {
    const want: Record<string, string> = {
      "coin-chrome-token": "coinWhir",
      "coin-s0-dial-up-dime": "coinWhirModem",
      "coin-s0-neon-nickel": "coinWhirNeon",
      "coin-s0-platinum": "coinWhir",
      "coin-s0-diamond": "coinWhirShimmer",
      "coin-s0-mythic": "coinWhirShimmer",
    };
    for (const [id, kind] of Object.entries(want)) {
      expect(coinWhirOf(id), id).toBe(kind);
      const p = bootPlan(DESKTOP, WHO, 3, { coin: { id } });
      const whirs = p.marks.filter((m) => m.k === "sound" && String(m.kind).startsWith("coinWhir"));
      expect(whirs.map((m) => [m.kind, m.t]), id).toEqual([[kind, p.coin.t0 + 40]]);
      expect(bootStill(p).marks.some((m) => m.k === "sound" && String(m.kind).startsWith("coinWhir")), id).toBe(false);
    }
    expect(coinWhirOf("coin-unknown")).toBe("coinWhir");
    for (const kind of ["coinWhirModem", "coinWhirNeon", "coinWhirShimmer"]) {
      const a = sfxRecipe(kind, "Cortex", "normal", () => 0.5, {}), b = sfxRecipe(kind, "Swarm", "normal", () => 0.5, {});
      expect(a.length, kind).toBeGreaterThan(9);
      expect(JSON.stringify(a), kind).toBe(JSON.stringify(b));
      // Every variant keeps the spin's slowing ticks, so a coin still sounds like it's spinning.
      const ticks = (a as { type?: string; f0?: number; delay?: number }[]).filter((x) => x.type === "triangle" && (x.f0 ?? 0) > 2500).map((x) => x.delay ?? 0);
      expect(ticks.length, kind).toBe(9);
      for (let k = 2; k < ticks.length; k++) expect(ticks[k]! - ticks[k - 1]!).toBeGreaterThan(ticks[k - 1]! - ticks[k - 2]!);
    }
  });

  it("the coin's sounds sound the same whichever factions are playing, and ring like metal", () => {
    for (const kind of ["coinFlick", "coinWhir", "coinClink"]) {
      const a = sfxRecipe(kind, "Cortex", "normal", () => 0.5, {}), b = sfxRecipe(kind, "Swarm", "normal", () => 0.5, {});
      expect(a.length, kind).toBeGreaterThan(0);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
    // The clink's partials are inharmonic (a bell's ratios), not a chord.
    const clink = sfxRecipe("coinClink", "Neutral", "normal", () => 0.5, {}) as { f0?: number }[];
    const fs = clink.map((x) => x.f0).filter((f): f is number => typeof f === "number" && f > 1000);
    expect(fs.some((f) => Math.abs(f / 2350 - 2.76) < 0.01)).toBe(true);
    // The whir slows down: each tick later than the last by more.
    const whir = sfxRecipe("coinWhir", "Neutral", "normal", () => 0.5, {}) as { delay?: number; type?: string }[];
    const d = whir.filter((x) => x.type === "triangle").map((x) => x.delay ?? 0);
    for (let k = 2; k < d.length; k++) expect(d[k]! - d[k - 1]!).toBeGreaterThan(d[k - 1]! - d[k - 2]!);
  });

  it("the arena passes the near player's coin, portrait and line to Match Boot", async () => {
    const { replay } = await captureReplay("Cortex", "Swarm", 3, false);
    const page = renderMatchHtml({ ...replay, coins: { p1: "coin-chrome-token", p2: "coin-s0-neon-nickel" } });
    expect(page).toContain("function coinDraw(ctx, c)");
    expect(page).toContain("coin: coinOpts(),");
    expect(page).toContain("id: coins[near] || COIN_DEFAULT,");
    expect(page).toContain("own: !CAN_SWITCH");
    expect(page).toContain('"coins":{"p1":"coin-chrome-token","p2":"coin-s0-neon-nickel"}');
  }, 60_000);
});
