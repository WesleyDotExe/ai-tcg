// Victory boasts' sounds on the audio clock (render session 39): the boast
// runtime (the exact text the page embeds) run against a small fake page and
// a recording fake SND. Checks that:
//  1. every planned sound goes to one SND.sequence, in time order, in the
//     winner's voice, from the boast's own start, with the music's holds
//     under the stings queued among them; the frames never play one;
//  2. each frame ticks the sequence before it fires the frame's marks;
//  3. a skip or a cancel cuts the sounds (ringing and queued); the boast's
//     own end lets them ring out (a last tick, then stop);
//  4. no boast plans two sounds of one kind closer than the repeat gap, so
//     queueing them past the gap (as scheduled sounds are) drops none and
//     adds none against the frame-fired version.
import { describe, expect, it } from "vitest";
import { BOAST_SPECS, boastPlan, boastStill, type BoastGeom } from "../src/boastFx.js";
import { SFX_REPEAT_GAP_MS } from "../src/soundFx.js";
import { geom, page } from "./boastPage.js";

describe("the victory boasts' sounds on the audio clock (render session 39)", () => {
  for (const [id, spec] of Object.entries(BOAST_SPECS)) {
    it(`${spec.name}: every planned sound goes to one sequence, in time order, in the winner's voice; the frames play none`, () => {
      const p = page();
      const plan = p.BOAST.play(id, p.els, { who: "Bastion Relay", faction: "Aegis", seed: 7 })!;
      expect(plan).not.toBeNull();
      const want = plan.marks.filter((m) => m.k === "sound");
      expect(want.length).toBeGreaterThan(1);
      expect(p.seqs).toHaveLength(1);
      const { list, o } = p.seqs[0]!;
      const snd = list.filter((m) => !m.run), runs = list.filter((m) => m.run);
      expect(snd).toEqual(want);
      expect(list.map((m) => m.t)).toEqual([...list.map((m) => m.t)].sort((a, b) => a - b));
      expect(snd.every((m) => typeof m.x === "number")).toBe(true);
      // The music's holds: one per duck mark, at its time, calling MUS with
      // its length and the audio time it is queued for.
      const ducks = plan.marks.filter((m) => m.k === "duck") as unknown as { t: number; ms: number }[];
      expect(runs.map((m) => [m.t, m.ms])).toEqual(ducks.map((m) => [m.t, m.ms]));
      expect(ducks.length).toBeGreaterThanOrEqual(1);
      runs.forEach((m, k) => m.run!(10 + k));
      expect(p.holds).toEqual(ducks.map((m, k) => [m.ms / 1000, 10 + k]));
      expect(o).toMatchObject({ t0: 5000, faction: (plan as unknown as { faction: string }).faction });
      expect(o.pan).toBeUndefined();
      for (let k = 0; k < 400 && p.BOAST.active(); k++) p.frame(16);
      expect(p.BOAST.active()).toBe(false);
      expect(p.played).toEqual([]);
      expect(p.holds).toHaveLength(ducks.length); // the frames hold nothing
      expect(p.BOAST.stats().last!.reason).toBe("end");
      expect(p.BOAST.stats().fired.name).toBe(1);
    });
  }

  it("each frame ticks the sequence; the boast's own end ticks once more and stops it, never cuts", () => {
    const p = page();
    p.BOAST.play("boast-aegis-shield-slam", p.els, { who: "Bastion Relay", faction: "Aegis", seed: 7 });
    p.frame(16); p.frame(16);
    expect(p.log).toEqual(["tick", "tick"]);
    for (let k = 0; k < 400 && p.BOAST.active(); k++) p.frame(16);
    expect(p.log.slice(-2)).toEqual(["tick", "stop"]);
    expect(p.log).not.toContain("cut");
  });

  it("a skip (Escape) or a cancel (a jump, a restart) cuts the sounds, ringing and queued", () => {
    const a = page();
    a.BOAST.play("boast-s0-boot-sequence", a.els, { who: "Bastion Relay", faction: "Aegis", seed: 7 });
    for (let k = 0; k < 40; k++) a.frame(16);
    a.key("Escape");
    expect(a.log[a.log.length - 1]).toBe("cut");
    expect(a.BOAST.stats().last!.reason).toBe("skip");
    const b = page();
    b.BOAST.play("boast-s0-dial-up-fireworks", b.els, { who: "Bastion Relay", faction: "Aegis", seed: 7 });
    b.frame(16);
    b.BOAST.cancel();
    expect(b.log).toEqual(["tick", "cut"]);
  });

  it("reduced motion: the still's one sound (the sting at 0) goes the same way", () => {
    const p = page();
    p.BOAST.play("boast-swarm-hive-burst", p.els, { who: "Bastion Relay", faction: "Swarm", seed: 7, reduced: true });
    expect(p.seqs[0]!.list.map((m) => [m.t, m.kind])).toEqual([[0, "boast"]]);
  });
});

describe("queueing boast sounds past the repeat gap changes nothing", () => {
  // Scheduled sounds skip SND's 28 ms repeat gap (the caller placed them).
  // The frame-fired boasts went through it; no boast plans two of one kind
  // closer than the gap, on any layout, so none was ever dropped by it and
  // none is added now.
  const layouts: [string, BoastGeom][] = [["desktop", geom()]];
  const phoneBand: BoastRect = { l: 15, t: 180, r: 375, b: 432 };
  layouts.push(["phone", { band: phoneBand, panel: { l: 15, t: 60, r: 190, b: 130 }, loser: [{ l: 15, t: 480, r: 375, b: 732 }],
    slots: Array.from({ length: 6 }, (_, k) => ({ l: 195 - 131 + (k % 3) * 93, t: 186 + Math.floor(k / 3) * 122, r: 195 - 131 + (k % 3) * 93 + 85, b: 186 + Math.floor(k / 3) * 122 + 114, filled: k < 4 })) }]);
  for (const [lname, g] of layouts) for (const [id, spec] of Object.entries(BOAST_SPECS)) {
    it(`${spec.name}, ${lname}`, () => {
      for (const seed of [1, 7, 42]) for (const close of [false, true]) {
        const plan = boastPlan(spec, g, seed, { name: "Bastion Relay", faction: "Cortex", close });
        for (const pl of [plan, boastStill(plan)]) {
          const last: Record<string, number> = {};
          for (const m of pl.marks.filter((x) => x.k === "sound").sort((a, b) => a.t - b.t)) {
            const k = String(m.kind);
            if (last[k] !== undefined) expect(m.t - last[k]!, `${id} ${k} at ${m.t}`).toBeGreaterThanOrEqual(SFX_REPEAT_GAP_MS);
            last[k] = m.t;
          }
        }
      }
    });
  }
});
