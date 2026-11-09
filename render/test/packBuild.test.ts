// Render session 60: the pack ceremony, part 2 (the owner's 2026-11-06
// Season 0 brief, section 3, beat 3): the reveal escalation. Pinned in Node
// (the browser run is progress/render/evidence/pack-ceremony-check-s60.mjs):
//  1. the ladder: every step up has a longer build-up and a hit at least as
//     big in every measure and bigger in some; the room dims more and the
//     sound drops further; the glow never has fewer stages; a Mythic in a
//     finish sits above that finish and below the next one;
//  2. the timeline the page plays is the build's own arithmetic;
//  3. over 1,000 real store openings: plain Commons and Uncommons snap,
//     everything else waits face down (every finish, every Rare and Mythic);
//     the glow climbs exactly to the card's own rung (never above it, the
//     backdrop's honesty rule); the ward follows the card (Rare a ring,
//     Mythic doubled, Commons, Uncommons and Neutral none); each snap in a
//     pack sounds higher than the last; the plan is a pure function of the
//     opening;
//  4. the sounds: a stage's riser always rises and each stage starts higher;
//     the bass gets deeper and longer with the step; a snap's pitch raises
//     the whole tick;
//  5. the page ships the build's colours and the ward rings, and reads every
//     beat from the card's build.
import { describe, expect, it } from "vitest";
import { EconomyStore, type PackOpening } from "@ai-tcg/economy";
import { getCard } from "@ai-tcg/engine";
import {
  buildTimeline,
  buildUpMs,
  GLOW_STAGES,
  planReveal,
  REVEAL_LADDER,
  revealBuildOf,
  revealStepOf,
  RUNG_OF,
  SNAP,
  TELL_BACKDROPS,
  TELL_RUNGS,
  type RevealBuild,
  type RevealKind,
} from "../src/packOpening.js";
import { PACK_CSS, PACK_PAGE_RUNTIME_SOURCE, renderPackOpeningHtml } from "../src/packPage.js";
import { packWardRings, PACK_WARD_FACTIONS } from "../src/packWards.js";
import { sfxRecipe } from "../src/soundFx.js";

const T0 = Date.parse("2026-11-09T10:00:00.000Z");

function openMany(n: number): PackOpening[] {
  const s = EconomyStore.open(":memory:", { now: () => new Date(T0) });
  const o = s.createOwner({ name: "build-test" }).ownerId;
  for (let i = 0; i < n; i++) s.grantPack(o, "S0", "weeklyChallenge");
  const out: PackOpening[] = [];
  for (let i = 0; i < n / 10; i++) out.push(...s.openPacks(o, 10, { seeds: Array.from({ length: 10 }, (_, k) => 9001 + i * 10 + k) }).packs);
  s.close();
  return out;
}

/** Every step of the ladder, lowest first, with the Mythic half steps in
 * between (a plain step's rarity is the step itself). */
function ladder(): { name: string; b: RevealBuild }[] {
  const out: { name: string; b: RevealBuild }[] = [];
  for (const step of REVEAL_LADDER) {
    if (step === "snap") { out.push({ name: "snap", b: revealBuildOf("plain", "Common", "Cortex") }); continue; }
    if (step === "rare") { out.push({ name: "rare", b: revealBuildOf("plain", "Rare", "Cortex") }); continue; }
    if (step === "mythic") { out.push({ name: "mythic", b: revealBuildOf("plain", "Mythic", "Cortex") }); continue; }
    out.push({ name: step, b: revealBuildOf(step as RevealKind, "Rare", "Cortex") });
    out.push({ name: `${step} (Mythic)`, b: revealBuildOf(step as RevealKind, "Mythic", "Cortex") });
  }
  return out;
}

describe("the reveal ladder: each step up builds longer and hits bigger", () => {
  const steps = ladder();

  it("the steps are in the owner's order: snap, a plain Rare, a plain Mythic, then the finishes as the summary orders them", () => {
    expect(REVEAL_LADDER).toEqual(["snap", "rare", "mythic", "foil", "fullArt", "altArt", "glitch", "gold", "secret", "prototype", "zeroDay"]);
    expect(revealStepOf("plain", "Common")).toBe("snap");
    expect(revealStepOf("plain", "Uncommon")).toBe("snap");
    expect(revealStepOf("plain", "Rare")).toBe("rare");
    expect(revealStepOf("plain", "Mythic")).toBe("mythic");
    expect(revealStepOf("gold", "Common")).toBe("gold");
  });

  it("every adjacent pair: a longer build-up, every hit measure at least as big and one bigger, a darker room, a quieter one", () => {
    for (let i = 1; i < steps.length; i++) {
      const lo = steps[i - 1]!.b, hi = steps[i]!.b, pair = `${steps[i - 1]!.name} -> ${steps[i]!.name}`;
      expect(buildUpMs(hi), pair).toBeGreaterThan(buildUpMs(lo));
      expect(hi.level, pair).toBeGreaterThan(lo.level);
      expect(hi.stages, pair).toBeGreaterThanOrEqual(lo.stages);
      expect(hi.flipMs, pair).toBeGreaterThanOrEqual(lo.flipMs);
      for (const k of ["flash", "shakePx", "shakeMs", "motes", "moteReach", "dim"] as const) expect(hi[k], `${pair} ${k}`).toBeGreaterThanOrEqual(lo[k]);
      expect(hi.flash + hi.motes + hi.shakePx, pair).toBeGreaterThan(lo.flash + lo.motes + lo.shakePx);
      expect(hi.duck, pair).toBeLessThanOrEqual(lo.duck);
      const tier = (b: RevealBuild) => [null, "subtle", "normal", "spectacle"].indexOf(b.bass);
      expect(tier(hi), pair).toBeGreaterThanOrEqual(tier(lo));
    }
  });

  it("a snap is quick and quiet; the top of the ladder drops the sound to near silence; a Mythic in a finish never reaches the next finish", () => {
    const snap = steps[0]!.b;
    expect(snap).toMatchObject({ held: false, stages: 0, flipMs: SNAP.flipMs, dim: 0, duck: 1, flash: 0, bass: null, motes: 0, ward: "none" });
    expect(buildUpMs(snap)).toBeLessThan(200);
    const top = steps[steps.length - 1]!.b;
    expect(top.duck).toBeLessThanOrEqual(0.1);
    expect(top.stages).toBe(4);
    expect(buildUpMs(top)).toBeGreaterThan(4 * buildUpMs(steps[1]!.b));
    for (const s of steps) if (s.b.held) expect(s.b.stages, s.name).toBeGreaterThanOrEqual(1);
    expect(revealBuildOf("foil", "Mythic").level).toBe(3.5);
    expect(revealBuildOf("foil", "Mythic").level).toBeLessThan(revealBuildOf("fullArt", "Common").level);
  });

  it("the timeline is the build's own arithmetic: stages from the tap, a pause after each, the longest last, then the flip", () => {
    for (const { name, b } of steps) {
      const tl = b.timeline;
      expect(tl, name).toEqual(buildTimeline(b));
      expect(tl.stages.length, name).toBe(b.stages);
      expect(tl.landAt, name).toBe(buildUpMs(b));
      expect(tl.landAt - tl.flipAt, name).toBe(b.flipMs);
      tl.stages.forEach((s, i) => {
        expect(s.colour).toBe(GLOW_STAGES[i]);
        if (i > 0) expect(s.at - tl.stages[i - 1]!.at).toBe(b.stageMs + b.pauseMs);
      });
      if (b.stages) {
        expect(b.lastPauseMs).toBeGreaterThanOrEqual(b.pauseMs);
        expect(tl.flipAt - tl.stages[b.stages - 1]!.at).toBe(b.stageMs + b.lastPauseMs);
      }
    }
  });

  it("the glow speaks the backdrop's colours: the tell's rungs above calm, in order", () => {
    expect(GLOW_STAGES).toEqual([TELL_BACKDROPS.shimmer.glow, TELL_BACKDROPS.charged.glow, TELL_BACKDROPS.radiant.glow, TELL_BACKDROPS.overload.glow]);
  });
});

describe("the builds over 1,000 real store openings", () => {
  const openings = openMany(1000);
  const plans = openings.map(planReveal);
  const cards = plans.flatMap((p) => p.cards);

  it("plain Commons and Uncommons snap; every finish and every Rare and Mythic waits face down", () => {
    const seen = new Set<string>();
    for (const c of cards) {
      const plainLow = c.finish === "standard" && (c.face.rarity === "Common" || c.face.rarity === "Uncommon");
      expect(c.build.held, `${c.face.name} ${c.finish} ${c.face.rarity}`).toBe(!plainLow);
      expect(c.build.step).toBe(revealStepOf(c.reveal, c.face.rarity));
      // Every card the old rule held face down is still held.
      if (c.faceDown) expect(c.build.held).toBe(true);
      seen.add(c.build.step);
    }
    // Every pack has a Rare slot, so every pack holds at least one build.
    for (const p of plans) expect(p.cards.some((c) => c.build.held)).toBe(true);
    for (const s of ["snap", "rare", "mythic", "foil", "fullArt"]) expect(seen.has(s), s).toBe(true);
  });

  it("the glow climbs exactly to the card's own rung, never above it", () => {
    for (const c of cards) {
      if (!c.build.held) { expect(c.build.stages).toBe(0); continue; }
      const rung = TELL_RUNGS.indexOf(RUNG_OF[c.reveal]);
      expect(c.build.stages, c.face.name).toBe(Math.max(1, rung));
      expect(c.build.timeline.stages.map((s) => s.colour)).toEqual(GLOW_STAGES.slice(0, c.build.stages));
    }
  });

  it("the ward follows the card: a Rare its faction's ring, a Mythic doubled, none for Commons, Uncommons or Neutral", () => {
    const kinds = new Set<string>();
    for (const c of cards) {
      const faction = getCard(c.cardId)?.faction ?? "Neutral";
      const want = !c.build.held || faction === "Neutral" ? "none" : c.face.rarity === "Mythic" ? "double" : c.face.rarity === "Rare" ? "ring" : "none";
      expect(c.build.ward, `${c.face.name} ${c.face.rarity} ${faction}`).toBe(want);
      if (want !== "none") expect(c.build.wardScale).toBeGreaterThan(1);
      kinds.add(c.build.ward);
    }
    expect([...kinds].sort()).toEqual(["double", "none", "ring"]);
  });

  it("each snap in a pack sounds a little higher than the last; held cards keep pitch 1", () => {
    for (const p of plans) {
      const snaps = p.cards.filter((c) => c.build.step === "snap").map((c) => c.build.pitch);
      snaps.forEach((v, i) => expect(v).toBeCloseTo(Math.pow(2, (i * SNAP.semitones) / 12), 3));
      for (const c of p.cards) if (c.build.held) expect(c.build.pitch).toBe(1);
    }
  });

  it("the plan is a pure function of the opening (planned twice, the same builds)", () => {
    for (const o of openings.slice(0, 200)) expect(planReveal(o).cards.map((c) => c.build)).toEqual(planReveal(o).cards.map((c) => c.build));
  });
});

describe("the build's sounds", () => {
  const voices = ["Cortex", "Aegis", "Swarm", "Null", "Neutral"];
  const half = () => 0.5;
  it("a stage's riser always rises, and each stage starts higher than the one before", () => {
    for (const f of voices) {
      let last = 0;
      for (let st = 1; st <= 4; st++) {
        const vs = sfxRecipe("riser", f, "normal", half, { stage: st, dur: 0.4 });
        expect(vs.length).toBeGreaterThan(0);
        for (const v of vs) if (v.f1) expect(v.f1, `${f} ${st}`).toBeGreaterThan(v.f0);
        const base = vs[0]!.f0;
        expect(base).toBeGreaterThan(last);
        last = base;
      }
    }
  });
  it("the bass is deeper and longer with the step's weight; only its tail takes the faction", () => {
    for (const f of voices) {
      const lo = sfxRecipe("bass", f, "subtle", half, { weight: 0 });
      const hi = sfxRecipe("bass", f, "spectacle", half, { weight: 1 });
      expect(hi[0]!.f0).toBeLessThan(lo[0]!.f0);
      expect(hi[0]!.dur).toBeGreaterThan(lo[0]!.dur);
      expect(hi[0]!.g).toBeGreaterThan(lo[0]!.g);
    }
    const sub = (f: string) => JSON.stringify(sfxRecipe("bass", f, "normal", half, { weight: 0.5 }).slice(0, 3));
    expect(new Set(voices.map(sub)).size).toBe(1);
  });
  it("a snap's pitch raises the whole tick", () => {
    const a = sfxRecipe("flip", "Cortex", "normal", half);
    const b = sfxRecipe("flip", "Cortex", "normal", half, { pitch: 1.5 });
    a.forEach((v, i) => expect(b[i]!.f0).toBeCloseTo(v.f0 * 1.5));
  });
});

describe("the page", () => {
  it("ships the build's colours and the faction ward rings, and plays every beat from the card's build", () => {
    const rings = packWardRings();
    expect(Object.keys(rings).sort()).toEqual(Object.keys(PACK_WARD_FACTIONS).sort());
    for (const v of Object.values(rings)) {
      expect(v.startsWith("data:image/webp;base64,")).toBe(true);
      expect(v.length).toBeLessThan(40_000);
    }
    const page = renderPackOpeningHtml({ title: "t", packs: [], wards: rings });
    const timings = JSON.parse(/<script type="application\/json" id="pack-timings">([\s\S]*?)<\/script>/.exec(page)![1]!);
    expect(timings.build.glow).toEqual(GLOW_STAGES);
    expect(timings.build.factions.Cortex).toBe("#35c9ff");
    const data = JSON.parse(/<script type="application\/json" id="pack-data">([\s\S]*?)<\/script>/.exec(page)![1]!);
    expect(data.wards).toEqual(rings);
    // The runtime reads the build's timeline, never its own timings.
    for (const s of ["b.timeline", "SND.duck", "'riser'", "'bass'", "PFX.motes(x, y, b.motes", "wardFlare(", "lift: true"]) expect(PACK_PAGE_RUNTIME_SOURCE).toContain(s);
    // Only opacity and transforms animate on the stage shake and the ward.
    for (const k of ["bshake", "wflare", "wspin"]) {
      const at = PACK_CSS.indexOf(`@keyframes ${k} {`);
      expect(at, k).toBeGreaterThan(-1);
      let depth = 0, end = at;
      for (let i = PACK_CSS.indexOf("{", at); i < PACK_CSS.length; i++) {
        if (PACK_CSS[i] === "{") depth++;
        if (PACK_CSS[i] === "}" && --depth === 0) { end = i; break; }
      }
      const body = PACK_CSS.slice(PACK_CSS.indexOf("{", at) + 1, end);
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(props.length, k).toBeGreaterThan(0);
      expect(props.every((x) => x === "transform" || x === "opacity"), `${k}: ${props.join(",")}`).toBe(true);
    }
    // No rings: the page still builds (a drawn ring in the faction's colour stands in).
    expect(JSON.parse(/<script type="application\/json" id="pack-data">([\s\S]*?)<\/script>/.exec(renderPackOpeningHtml({ title: "t", packs: [] }))![1]!).wards).toBeUndefined();
  });
});
