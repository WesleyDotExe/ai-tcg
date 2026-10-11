// EFFECTS.md v2 slice 6 (Mythic unique wards), with the owner's 2026-10-11
// rule that the ward sits BEHIND the card. Four layers:
//  1. layering over time: an arrival draws in over the card, holds there a
//     few seconds, then crossfades behind; at rest, while flaring and while
//     acting out its behaviour it is only ever behind;
//  2. geometry: behind the card the core fits inside the card's outline
//     (hidden), the middle and outer layers reach past its corners (shown),
//     and the outer layers are brightened and enlarged to compensate;
//  3. which Mythics get a ward and what each one sees (seats, allies), from
//     mythics.json, never from names in code; only the sheets a replay
//     needs are embedded;
//  4. the replay page embeds the exact sources and cues arrival and shatter
//     on the same beats as the card's own entrance and kill; the ward
//     sounds keep their meaning in every voice.
// The canvas runtime itself needs a browser: progress/render/evidence/.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, buildSwarmDeck } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "../src/engineInternal.js";
import { captureMatch } from "../src/capture.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import { CANVAS_FX_RUNTIME_SOURCE } from "../src/canvasFx.js";
import { sfxRecipe } from "../src/soundFx.js";
import type { MatchReplay } from "../src/types.js";
import {
  WARD_BEHIND,
  WARD_FX_PURE_SOURCE,
  WARD_FX_RUNTIME_SOURCE,
  WARD_LAYERS,
  WARD_T,
  mythicSpecs,
  mythicsInReplay,
  wardBeat,
  wardDataFor,
  wardLayering,
  wardLook,
  wardNextMode,
  wardRadius,
  wardSeatsLit,
  wardsOnBoard,
} from "../src/wardFx.js";

const CARD = { w: 118, h: 158 }; // the replay's .card
const steps = (from: number, to: number, n: number) => Array.from({ length: n + 1 }, (_, k) => from + ((to - from) * k) / n);

describe("over the card on arrival, behind it ever after", () => {
  it("an arriving ward is fully over the card until onTop, then crossfades behind, never both at full", () => {
    for (const mt of steps(0, WARD_T.onTop - 0.01, 20)) expect(wardLayering("manifest", mt)).toEqual({ top: 1, under: 0 });
    let lastUnder = 0;
    for (const mt of steps(WARD_T.onTop, WARD_T.onTop + WARD_T.sink, 40)) {
      const l = wardLayering("manifest", mt);
      expect(l.top + l.under).toBeCloseTo(1, 9);
      expect(l.under).toBeGreaterThanOrEqual(lastUnder);
      lastUnder = l.under;
    }
    expect(wardLayering("manifest", WARD_T.onTop + WARD_T.sink)).toEqual({ top: 0, under: 1 });
  });

  it("sinks after 'a few seconds' and is behind for good within five", () => {
    expect(WARD_T.onTop).toBeGreaterThanOrEqual(2);
    expect(WARD_T.onTop + WARD_T.sink).toBeLessThanOrEqual(5);
    expect(WARD_T.drawIn).toBeLessThan(WARD_T.onTop);
    expect(wardNextMode("manifest", WARD_T.onTop + WARD_T.sink - 0.01)).toBe("manifest");
    expect(wardNextMode("manifest", WARD_T.onTop + WARD_T.sink)).toBe("perm");
  });

  it("at rest, flaring for a signature move and waiting for its cue, nothing is drawn over the card", () => {
    for (const mt of steps(0, 10, 50)) {
      expect(wardLayering("perm", mt).top).toBe(0);
      expect(wardLayering("pulse", mt).top).toBe(0);
      expect(wardLook("perm", mt, mt, "heartbeat").top).toBeNull();
      expect(wardLook("pulse", mt, mt, "seats").top).toBeNull();
    }
    expect(wardLayering("wait", 1)).toEqual({ top: 0, under: 0 });
    expect(wardLook("wait", 1, 1, "aura").reveal).toBe(0);
  });

  it("a flare brightens and swells the ward behind the card, then settles back to rest", () => {
    const rest = wardLook("perm", 0, 0, "seats").under;
    const peak = wardLook("pulse", 0.2, 0, "seats").under;
    expect(peak.a).toBeGreaterThan(rest.a);
    expect(peak.s).toBeGreaterThan(rest.s);
    const end = wardLook("pulse", WARD_T.pulse, 0, "seats").under;
    expect(end.a).toBeCloseTo(rest.a, 6);
    expect(wardNextMode("pulse", WARD_T.pulse)).toBe("perm");
  });

  it("a ward that never gets its arrival cue still shows, behind the card", () => {
    expect(wardNextMode("wait", WARD_T.waitMax - 0.01)).toBe("wait");
    expect(wardNextMode("wait", WARD_T.waitMax)).toBe("perm");
  });

  it("Hive Mother's heartbeat beats in the ward behind the card", () => {
    const vals = steps(0, 1.7, 170).map((t) => wardLook("perm", 5, t, "heartbeat").under.a);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.2);
    expect(wardBeat(0)).toBeGreaterThan(wardBeat(0.6));
    const calm = steps(0, 1.7, 170).map((t) => wardLook("perm", 5, t, "seats").under.a);
    expect(Math.max(...calm) - Math.min(...calm)).toBeLessThan(0.25);
  });
});

describe("only the parts past the card's edges show", () => {
  const R = wardRadius(CARD.h);
  const halfW = CARD.w / 2, halfDiag = Math.hypot(CARD.w / 2, CARD.h / 2);
  const radiusBehind = (k: number) => R * WARD_LAYERS[k]!.r * WARD_BEHIND.scale[k]!;

  it("sizes the ward from the card it belongs to", () => {
    expect(R).toBeGreaterThan(CARD.h * 0.9);
    expect(wardRadius(2 * CARD.h)).toBeCloseTo(2 * R, 9);
  });

  it("the core fits inside the card, so it is hidden behind it", () => {
    expect(radiusBehind(2)).toBeLessThan(halfW);
  });

  it("the middle and outer layers reach past the card's corners, so they show all round", () => {
    expect(radiusBehind(1)).toBeGreaterThan(halfDiag);
    expect(radiusBehind(0)).toBeGreaterThan(halfDiag * 1.5);
  });

  it("behind the card the outer layers are brighter and larger, the core is left alone", () => {
    expect(WARD_BEHIND.alpha).toBeGreaterThan(0.52); // the lab's rest over the card
    expect(WARD_BEHIND.boost[0]).toBeGreaterThanOrEqual(WARD_BEHIND.boost[1]!);
    expect(WARD_BEHIND.boost[1]).toBeGreaterThan(1);
    expect(WARD_BEHIND.scale[0]).toBeGreaterThanOrEqual(WARD_BEHIND.scale[1]!);
    expect(WARD_BEHIND.scale[1]).toBeGreaterThan(1);
    expect(WARD_BEHIND.boost[2]).toBe(1);
    expect(WARD_BEHIND.scale[2]).toBe(1);
  });

  it("keeps the counter-rotation: outer and core one way, middle the other", () => {
    expect(Math.sign(WARD_LAYERS[0]!.spd)).toBe(Math.sign(WARD_LAYERS[2]!.spd));
    expect(Math.sign(WARD_LAYERS[1]!.spd)).toBe(-Math.sign(WARD_LAYERS[0]!.spd));
  });
});

describe("which Mythics, and what their wards see", () => {
  const specs = mythicSpecs();
  const unit = (instanceId: string, name: string, rarity = "Common", faction = "Cortex") => ({ instanceId, name, rarity, faction });

  it("every Mythic in mythics.json has a behaviour the runtime knows and a committed sheet", () => {
    expect(Object.keys(specs).sort()).toEqual(["Hive Mother", "Null Singularity", "Prime Aegis", "Quorum Arbiter"]);
    for (const [name, s] of Object.entries(specs)) {
      expect(["seats", "aura", "heartbeat", "gravity"], name).toContain(s.behaviour);
      expect(s.ward, name).toBeTruthy();
      expect(existsSync(resolve(__dirname, "../..", s.ward!)), name).toBe(true);
    }
  });

  it("gives a ward to Mythic units in mythics.json only, with their enemies and allies", () => {
    const players = {
      p1: { board: [unit("u1", "Quorum Arbiter", "Mythic"), unit("u2", "Signal Drone"), unit("u3", "Some Rare", "Rare")] },
      p2: { board: [unit("u4", "Glitch Seed", "Common", "Null"), unit("u5", "Unknown Mythic", "Mythic", "Null")] },
    };
    expect(wardsOnBoard(players, specs)).toEqual([
      { iid: "u1", name: "Quorum Arbiter", faction: "Cortex", side: "p1", beh: "seats", enemies: 2, allies: ["u2", "u3"] },
    ]);
  });

  it("Quorum Arbiter lights one seat per enemy unit, up to its twelve seats", () => {
    expect(wardSeatsLit(0, 12)).toBe(0);
    expect(wardSeatsLit(5, 12)).toBe(5);
    expect(wardSeatsLit(40, 12)).toBe(12);
    expect(wardSeatsLit(3, 0)).toBe(3);
  });

  it("embeds only the sheets of Mythics that reach the board in this replay", async () => {
    // Swarm vs Null, seed 8: Hive Mother arrives and later dies; no other
    // Mythic reaches the board (the committed replay of the same seed).
    const replay = await captureMatch({
      title: "wards", seed: 8, deckA: buildSwarmDeck("p1", "Swarm"), deckB: buildNullDeck("p2", "Null"),
      agentA: new LookaheadAgent("Lookahead-Swarm", 17), agentB: new LookaheadAgent("Lookahead-Null", 18), boardSlots: BOARD_SLOTS,
    });
    expect(mythicsInReplay(replay)).toEqual(["Hive Mother"]);
    const data = wardDataFor(replay);
    expect(Object.keys(data.atlases)).toEqual(["Hive Mother"]);
    expect(data.atlases["Hive Mother"]!.startsWith("data:image/webp;base64,")).toBe(true);
    expect(Object.keys(data.specs).sort()).toEqual(Object.keys(specs).sort());
    for (const s of Object.values(data.specs)) expect(Object.keys(s).sort()).toEqual(["behaviour", "behaviourParams", "faction"]);
    const html = renderMatchHtml(replay);
    expect(html).toContain('<script type="application/json" id="ward-data">');
    expect(html.match(/data:image\/webp;base64,/g)!.length).toBe(3 + 1); // the three FX atlases + one ward sheet
  }, 60_000);
});

describe("the replay page", () => {
  const empty = {
    title: "t", seed: 1, factions: { p1: "Aegis", p2: "Null" }, identities: { p1: { username: "a" }, p2: { username: "b" } },
    cardFactions: {}, movesPlayed: 0, frames: [],
  } as unknown as MatchReplay;
  const html = renderMatchHtml(empty);

  it("embeds the exact ward sources after the canvas runtime they plug into", () => {
    expect(html).toContain(WARD_FX_PURE_SOURCE);
    expect(html).toContain(WARD_FX_RUNTIME_SOURCE);
    expect(html.indexOf(WARD_FX_RUNTIME_SOURCE)).toBeGreaterThan(html.indexOf(CANVAS_FX_RUNTIME_SOURCE));
    expect(CANVAS_FX_RUNTIME_SOURCE).toContain("for (i = 0; i < plugins.length; i++) plugins[i].drawFloor(flc);");
    expect(WARD_FX_RUNTIME_SOURCE).toContain("CFX.plug({ update: update, drawFloor: drawFloor, drawTop: drawTop,");
  });

  it("draws the resting ward on the floor canvas and only an arrival on the top canvas", () => {
    expect(WARD_FX_RUNTIME_SOURCE).toContain("if (lay.under > 0) drawWard(ctx, w, wardLook(w.mode, w.mt, w.t, w.beh).under, lay.under, true);");
    expect(WARD_FX_RUNTIME_SOURCE).toContain("if (lay.top > 0 && look.top) drawWard(ctx, w, look.top, lay.top, false);");
  });

  it("follows the board every frame and cues arrival and shatter on the card's own beats", () => {
    expect(html).toContain("WARDS.sync(wardsOnBoard(frame.players, wardSpecs), { stepping: stepping });");
    expect(html).toContain("if (WARDS.has(id)) later(causeT, function () { WARDS.arrive(id); });");
    expect(html).toContain("if (WARDS.has(id)) later(unitT(id), function () { WARDS.shatter(id); });");
    // The shatter shares the kill's moment: the ghost dies at unitT(id) too.
    expect(html).toContain("spawnGhost(prevBoard[id], prevRects[id], tier, unitT(id),");
  });

  it("gives the Mythic card its obsidian + foil look", () => {
    expect(html).toContain(".card.rarity-Mythic { background: #05060b;");
    expect(html).toContain(".card.rarity-Mythic:not(.pending)::after");
    expect(html).toContain("@media (prefers-reduced-motion: reduce) { .card.rarity-Mythic::after { animation: none; } }");
  });
});

describe("ward sounds", () => {
  const seeded = () => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

  it("an arrival's chord rises and a shatter's falls, in every faction voice", () => {
    for (const f of ["Cortex", "Aegis", "Swarm", "Null"]) {
      const up = sfxRecipe("ward", f, "normal", seeded(), {}).filter((v) => v.att === 0.45).map((v) => [v.delay ?? 0, v.f0] as const);
      expect(up.length, f).toBe(3);
      for (let k = 1; k < up.length; k++) { expect(up[k]![0]).toBeGreaterThan(up[k - 1]![0]); expect(up[k]![1]).toBeGreaterThan(up[k - 1]![1]); }
      const down = sfxRecipe("wardBreak", f, "normal", seeded(), {}).filter((v) => v.type === "triangle").map((v) => [v.delay ?? 0, v.f0, v.f1] as const);
      expect(down.length, f).toBe(3);
      for (let k = 1; k < down.length; k++) { expect(down[k]![0]).toBeGreaterThan(down[k - 1]![0]); expect(down[k]![1]).toBeLessThan(down[k - 1]![1]); }
      for (const d of down) expect(d[2]!).toBeLessThan(d[1]);
    }
  });

  it("a Mythic arrival carries the deep swell under its chord; a flare does not", () => {
    const swell = (k: "ward" | "wardPulse") => sfxRecipe(k, "Swarm", "normal", seeded(), {}).filter((v) => v.type === "sine" && v.f0 === 55);
    expect(swell("ward").length).toBe(1);
    expect(swell("wardPulse").length).toBe(0);
  });
});
