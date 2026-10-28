// Render session 40 (hardening): what the boast draws itself stays on the
// winner's side by construction. A sprite piece's halo (drawGlow, up to
// 1.25 x its size) reaches past the box boastPlanProblem checks; measured
// over the test layouts, up to 70 px past the side's edge (Hive Burst). So
// the runtime clips its own drawing to the winner's side (2 px over, the
// checker's tolerance). These tests run the exact runtime text the page
// embeds against a recording 2D context.
import { describe, expect, it } from "vitest";
import { BOAST_SPECS, boastPieceAt, boastPlan, type BoastPlan } from "../src/boastFx.js";
import { BAND, geom, page } from "./boastPage.js";

// A 2D context that records every call (and every property set) in order.
function recordingCtx() {
  const ops: { op: string; args: unknown[] }[] = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, k: string) {
      if (k === "ops") return ops;
      if (k === "canvas") return { width: 1280, height: 900 };
      return (...args: unknown[]) => { ops.push({ op: k, args }); return k.startsWith("create") ? grad : k === "measureText" ? { width: 10 } : undefined; };
    },
    set(_t, k: string, v) { ops.push({ op: "set " + k, args: [v] }); return true; },
  });
  return { ctx, ops };
}

const DRAWS = new Set(["drawImage", "fill", "fillRect", "stroke", "strokeRect", "fillText", "strokeText"]);

describe("the boast draws only inside the winner's side (render session 40)", () => {
  it("a sprite's halo reaches past the box the plan checker counts (why the clip is needed)", () => {
    // The drawn halo is at.s x (0.75 + glow x 0.5); the checker's box is at.s / 2.
    let worst = 0;
    for (const spec of Object.values(BOAST_SPECS)) {
      const plan: BoastPlan = boastPlan(spec, geom(), 3, { name: "Moth Protocol", faction: "Aegis" });
      for (const pc of plan.pieces) {
        if (pc.shape) continue;
        for (let t = 0; t <= plan.ms; t += 10) {
          const at = boastPieceAt(pc, t);
          if (!at || at.a <= 0.003) continue;
          const r = at.s * 1.25;
          worst = Math.max(worst, BAND.t - (at.y - r), at.y + r - BAND.b, BAND.l - (at.x - r), at.x + r - BAND.r);
        }
      }
    }
    expect(worst).toBeGreaterThan(2);
  });

  for (const [id, spec] of Object.entries(BOAST_SPECS)) {
    it(`${spec.name}: every frame's drawing is clipped to the winner's side, and the clip is undone after`, () => {
      const p = page();
      const plan = p.BOAST.play(id, p.els, { who: "Bastion Relay", faction: "Aegis", seed: 7 });
      expect(plan).not.toBeNull();
      let frames = 0, drawn = 0;
      for (let k = 0; k < 400; k++) {
        p.frame(16);
        const { ctx, ops } = recordingCtx();
        p.plugin().drawTop(ctx);
        if (!ops.length) { if (!p.BOAST.active()) break; continue; }
        frames++;
        const names = ops.map((o) => o.op);
        // save, the side's rect, clip: before anything is drawn.
        expect(names.slice(0, 4)).toEqual(["save", "beginPath", "rect", "clip"]);
        expect(ops[2]!.args).toEqual([BAND.l - 2, BAND.t - 2, BAND.r - BAND.l + 4, BAND.b - BAND.t + 4]);
        // Every save has its restore, and the clip's restore comes last of
        // all the drawing (nothing drawn after the clip is lifted).
        let depth = 0;
        for (const n of names) { if (n === "save") depth++; if (n === "restore") depth--; expect(depth).toBeGreaterThanOrEqual(0); }
        expect(depth).toBe(0);
        const lastRestore = names.lastIndexOf("restore");
        expect(names.slice(lastRestore + 1).filter((n) => DRAWS.has(n))).toEqual([]);
        drawn += names.filter((n) => DRAWS.has(n)).length;
      }
      expect(frames).toBeGreaterThan(20);
      expect(drawn).toBeGreaterThan(0);
    });
  }

  it("a reduced-motion still is clipped the same way", () => {
    const p = page();
    p.BOAST.play("boast-swarm-hive-burst", p.els, { who: "Bastion Relay", faction: "Swarm", seed: 7, reduced: true });
    p.frame(16);
    const { ctx, ops } = recordingCtx();
    p.plugin().drawTop(ctx);
    expect(ops.slice(0, 4).map((o) => o.op)).toEqual(["save", "beginPath", "rect", "clip"]);
  });
});
