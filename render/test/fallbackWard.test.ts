// EFFECTS.md v2 slice 7: the fallback ward generator. A Mythic with no ward
// art (an agent's signature card, or a new Mythic the mythic-wards action
// hasn't reached) gets a ward drawn by code from its name and faction.
//  1. the same name always gives the same ward, on any machine, and the
//     faction changes the material, never the layout of the sheet;
//  2. names almost never share a look (measured on every signature menu
//     combination id, the names a measuring run gives signature cards);
//  3. the symbol rules the Replicate prompts follow hold here too;
//  4. the replay page carries the generator, draws every sheet it needs up
//     front, and a Mythic with art still uses its art.
// Drawing itself needs a 2D canvas: progress/render/evidence/v2-s7-*.png.
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck } from "@ai-tcg/engine";
import { LookaheadAgent } from "../src/engineInternal.js";
import { allSignatureSpecs } from "../../engine/src/data/signatureMenu.js";
import { signatureComboId } from "../../engine/src/data/signatureMenu.js";
import { captureMatch } from "../src/capture.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import { generatedSeats } from "../src/generatedSignatures.js";
import {
  FALLBACK_WARD_PURE_SOURCE,
  FALLBACK_WARD_RUNTIME_SOURCE,
  FW_CELL,
  FW_KITS,
  fallbackWardLook,
  fallbackWardPlan,
  fallbackWardsNeeded,
  fwHash,
  fwKitName,
} from "../src/fallbackWard.js";
import { WARD_FX_RUNTIME_SOURCE, mythicSpecs, wardDataFor } from "../src/wardFx.js";
import { sigWardDataFor } from "../src/sigWardFx.js";

const FACTIONS = ["Cortex", "Aegis", "Swarm", "Null", "Neutral"];

describe("same name, same ward", () => {
  it("a plan is a pure function of (name, faction)", () => {
    for (const f of FACTIONS) {
      expect(fallbackWardPlan("Consensus Lantern", f)).toEqual(fallbackWardPlan("Consensus Lantern", f));
    }
    // JSON round trip: the plan is plain data, nothing hidden in closures.
    const p = fallbackWardPlan("Tollgate Daemon", "Neutral");
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });

  it("pins the hash so a ward can't drift between versions unnoticed", () => {
    // FNV-1a 32-bit reference values.
    expect(fwHash("")).toBe(2166136261);
    expect(fwHash("a")).toBe(0xe40c292c);
    expect(fallbackWardPlan("Consensus Lantern", "Neutral").seed).toBe(fwHash("Neutral:Consensus Lantern"));
  });

  it("the faction picks the material kit; an unknown faction draws in the Neutral kit", () => {
    expect(Object.keys(FW_KITS).sort()).toEqual([...FACTIONS].sort());
    for (const f of FACTIONS) expect(fallbackWardPlan("X", f).kit).toEqual(FW_KITS[f]);
    expect(fwKitName("Martian")).toBe("Neutral");
    expect(fallbackWardPlan("X", "Martian")).toEqual(fallbackWardPlan("X", "Neutral"));
    // Only Null tears its rings.
    for (const f of FACTIONS) {
      const p = fallbackWardPlan("Some Mythic", f);
      expect(p.outer.cuts.length > 0, f).toBe(f === "Null");
      expect(FW_KITS[f]!.middles, f).toContain(p.middle.mode);
    }
  });

  it("the sheet has the Replicate layout: 2x2 cells of FW_CELL px, outer / middle / core / ornament", () => {
    expect(FW_CELL).toBe(512);
    expect(FALLBACK_WARD_RUNTIME_SOURCE).toContain("cv.width = cv.height = WT * 2;");
    for (const cell of ["// Cell 0: the outer ring.", "// Cell 1: the middle layer.", "// Cell 2: the core.", "// Cell 3: the ornament."]) {
      expect(FALLBACK_WARD_RUNTIME_SOURCE).toContain(cell);
    }
  });
});

describe("names almost never share a look", () => {
  it("every signature menu combination id gets its own plan, and at least 95% a look of its own", () => {
    const ids = allSignatureSpecs().map(signatureComboId);
    expect(ids.length).toBe(306); // 303 until Guardian became Barrier only (owner 2026-10-15): cost 6 may now add Guard
    const plans = new Set(ids.map((id) => JSON.stringify(fallbackWardPlan(id, "Neutral"))));
    expect(plans.size).toBe(ids.length);
    const looks = new Set(ids.map((id) => fallbackWardLook(fallbackWardPlan(id, "Neutral"))));
    expect(looks.size / ids.length).toBeGreaterThanOrEqual(0.95);
  });

  it("the two generated signature cards of a replay look different from each other", () => {
    const [a, b] = generatedSeats(5).map((d) => fallbackWardLook(fallbackWardPlan(d.card.name, "Neutral")));
    expect(a).not.toBe(b);
  });

  it("uses every middle pattern its kit offers across a few hundred names", () => {
    for (const f of FACTIONS) {
      const modes = new Set(Array.from({ length: 300 }, (_, i) => fallbackWardPlan(`Mythic ${i}`, f).middle.mode));
      expect([...modes].sort(), f).toEqual([...FW_KITS[f]!.middles].sort());
    }
  });
});

describe("the symbol rules (mythics.json _howToAddAMythic)", () => {
  const plans = FACTIONS.flatMap((f) => Array.from({ length: 400 }, (_, i) => fallbackWardPlan(`Ward ${i}`, f)));

  it("no triangle in the core or the ornament (no hexagram, no eye-in-a-triangle)", () => {
    for (const p of plans) {
      expect(p.core.n).toBeGreaterThanOrEqual(4);
      expect(p.ornament.n).toBeGreaterThanOrEqual(4);
    }
  });

  it("nested polygons share ONE orientation, so they never cross into a star", () => {
    expect(FALLBACK_WARD_RUNTIME_SOURCE).toContain("poly(c.n, 200, c.rot, 2.5 * thick); poly(c.n, 150, c.rot, 1.5);");
    expect(FALLBACK_WARD_RUNTIME_SOURCE).toContain("for (i = 0; i < m.k; i++) poly(m.n, 236 - i * 28, m.rot, 1.6 * thick);");
    // poly() draws a regular polygon edge to edge (i / n steps), never a
    // star's skip-a-vertex path.
    expect(FALLBACK_WARD_RUNTIME_SOURCE).toContain("var a = rot + i / n * 6.283;");
    for (const p of plans) if (p.middle.mode === "polys") expect(p.middle.n).toBeGreaterThanOrEqual(4);
  });

  it("no cross: spokes are many (16+), never four", () => {
    for (const p of plans) if (p.middle.mode === "spokes") expect(p.middle.n).toBeGreaterThanOrEqual(16);
  });
});

describe("which Mythics need a fallback", () => {
  const frame = (board1: { name: string; faction: string; rarity: string }[], board2: typeof board1 = []) => ({ players: { p1: { board: board1 }, p2: { board: board2 } } });

  it("every Mythic unit with no sheet, once each, in order of arrival", () => {
    const frames = [
      frame([{ name: "Signal Drone", faction: "Cortex", rarity: "Common" }]),
      frame([{ name: "Quorum Arbiter", faction: "Cortex", rarity: "Mythic" }], [{ name: "Tollgate Daemon", faction: "Neutral", rarity: "Mythic" }]),
      frame([{ name: "Consensus Lantern", faction: "Neutral", rarity: "Mythic" }], [{ name: "Tollgate Daemon", faction: "Neutral", rarity: "Mythic" }]),
    ];
    expect(fallbackWardsNeeded(frames, { "Quorum Arbiter": "data:" })).toEqual([
      { name: "Tollgate Daemon", faction: "Neutral" },
      { name: "Consensus Lantern", faction: "Neutral" },
    ]);
    // A Mythic in mythics.json whose art hasn't landed yet falls back too.
    expect(fallbackWardsNeeded(frames, {}).map((m) => m.name)).toEqual(["Quorum Arbiter", "Tollgate Daemon", "Consensus Lantern"]);
  });
});

describe("in a real replay with signature cards", () => {
  // Cortex vs Aegis, seed 5, both sides a generated agent carrying its
  // generated signature card: the committed
  // render/output/cortex-vs-aegis-sig-seed5.html. Both signature cards (no
  // art) reach the board.
  const seats = generatedSeats(5);
  const replayP = captureMatch({
    title: "sig", seed: 5,
    deckA: { ...buildCortexDeck("p1", "Cortex"), signature: seats[0].card },
    deckB: { ...buildAegisDeck("p2", "Aegis"), signature: seats[1].card },
    agentA: new LookaheadAgent(seats[0].agentName, 11), agentB: new LookaheadAgent(seats[1].agentName, 12), boardSlots: BOARD_SLOTS,
  });

  it("the signature cards are Neutral Mythics outside mythics.json, so only they fall back", async () => {
    const replay = await replayP;
    const data = wardDataFor(replay);
    expect(Object.keys(data.atlases)).toEqual(["Quorum Arbiter"]);
    for (const d of seats) expect(mythicSpecs()[d.card.name]).toBeUndefined();
    expect(fallbackWardsNeeded(replay.frames, data.atlases)).toEqual(seats.map((d) => ({ name: d.card.name, faction: "Neutral" })));
  }, 60_000);

  it("the page embeds the generator before WARDS and draws every needed sheet up front, carrying no extra image", async () => {
    const replay = await replayP;
    const html = renderMatchHtml(replay);
    expect(html).toContain(FALLBACK_WARD_PURE_SOURCE);
    expect(html).toContain(FALLBACK_WARD_RUNTIME_SOURCE);
    expect(html.indexOf(FALLBACK_WARD_RUNTIME_SOURCE)).toBeLessThan(html.indexOf(WARD_FX_RUNTIME_SOURCE));
    expect(html).toContain("WARDS.prepare(fallbackWardsNeeded(frames,");
    // The three FX atlases + Quorum Arbiter's sheet + the slice-5 faction
    // rings this match fires: the fallbacks are drawn in the browser, not
    // shipped.
    const rings = Object.keys(sigWardDataFor(replay).atlases).length;
    expect(html.match(/data:image\/webp;base64,/g)!.length).toBe(3 + 1 + rings);
  }, 60_000);

  it("a fallback never blocks: generation is caught, and sync skips a Mythic whose sheet failed", () => {
    expect(WARD_FX_RUNTIME_SOURCE).toContain("} catch (e) {\n        failed[name] = true;\n        return false;");
    expect(WARD_FX_RUNTIME_SOURCE).toContain("if (!ensureSheet(it.name, it.faction)) return;");
    // A Mythic with art uses it, never the fallback.
    expect(WARD_FX_RUNTIME_SOURCE).toContain("if (DATA.atlases && DATA.atlases[name]) return true;");
  });
});
