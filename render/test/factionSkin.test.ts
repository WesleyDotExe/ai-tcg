// EFFECTS.md slice 5 (faction skinning). Four layers:
//  1. the meaning invariant: for every skin x tier x direction, a mote moves
//     the caller's way by the same distance, and every bolt particle leaves
//     the attacker and lands on the target;
//  2. the skins are really different (a fingerprint per skin), scale with
//     tier, and are deterministic;
//  3. the page embeds FACTION_SKIN_SOURCE verbatim and has shape rules for
//     every skin;
//  4. real matches: every faction a replay can name (including the neutral
//     pool's cards) has its own skin row, never the fallback.
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "../src/engineInternal.js";
import { captureMatch } from "../src/capture.js";
import { FACTION_SKINS, FACTION_SKIN_SOURCE, boltLayout, castRayAngles, moteLayout, skinOf } from "../src/factionSkin.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import { renderSkinSheet } from "../src/skinSheet.js";
import type { MatchReplay } from "../src/types.js";

const FACTIONS = ["Cortex", "Swarm", "Aegis", "Null", "Neutral"] as const;
const TIERS = ["subtle", "normal", "spectacle"] as const;
const ARC = { a: { x: 100, y: 500 }, c: { x: 180, y: 300 }, b: { x: 420, y: 120 } };

describe("skinOf", () => {
  it("gives each faction its own skin and an unknown faction the plain one", () => {
    const names = FACTIONS.map((f) => skinOf(f).name);
    expect(new Set(names).size).toBe(FACTIONS.length);
    expect(skinOf("Someday-Faction").name).toBe("neutral");
    expect(skinOf(undefined).name).toBe("neutral");
  });
});

describe("the meaning invariant: direction and landing never follow the skin", () => {
  it("motes: every step moves the caller's direction, and the full travel is skin-independent", () => {
    for (const tier of TIERS) {
      const travels = new Set<number>();
      for (const f of FACTIONS) {
        for (const dir of ["up", "down"] as const) {
          const motes = moteLayout(f, dir, tier, 118, 158);
          expect(motes.length).toBeGreaterThanOrEqual(2);
          for (const m of motes) {
            let lastDy = 0;
            for (const p of m.path) {
              expect(Math.sign(p.dy)).toBe(dir === "up" ? -1 : 1);
              // Monotone: a mote never doubles back against its meaning.
              expect(Math.abs(p.dy)).toBeGreaterThan(Math.abs(lastDy));
              lastDy = p.dy;
            }
            travels.add(Math.abs(m.path[m.path.length - 1]!.dy));
            // Starts on the card.
            expect(m.x).toBeGreaterThanOrEqual(-2);
            expect(m.x).toBeLessThanOrEqual(120);
          }
        }
      }
      expect(travels.size).toBe(1);
    }
  });

  it("bolts: every particle of every skin leaves the attacker and lands on the target", () => {
    for (const f of FACTIONS) {
      for (const tier of TIERS) {
        for (const small of [false, true]) {
          const parts = boltLayout(f, tier, small, ARC);
          expect(parts.filter((p) => p.role === "head")).toHaveLength(1);
          for (const p of parts) {
            const first = p.path[0]!, last = p.path[p.path.length - 1]!;
            expect(first.x).toBeCloseTo(ARC.a.x, 6);
            expect(first.y).toBeCloseTo(ARC.a.y, 6);
            expect(last.x).toBeCloseTo(ARC.b.x, 6);
            expect(last.y).toBeCloseTo(ARC.b.y, 6);
            expect(p.lag).toBeGreaterThanOrEqual(0);
            expect(p.lag).toBeLessThanOrEqual(0.35);
          }
        }
      }
    }
  });
});

describe("the skins are real characters, not one shape in five colours", () => {
  function fingerprint(f: string) {
    const motes = moteLayout(f, "up", "normal", 118, 158);
    const bolt = boltLayout(f, "normal", false, ARC);
    const head = bolt.find((p) => p.role === "head")!;
    const lanes = new Set(motes.map((m) => m.x)).size;
    const maxDrift = Math.max(...motes.flatMap((m) => m.path.map((p) => Math.abs(p.dx))));
    const weave = Math.max(
      ...bolt.flatMap((p) =>
        p.path.map((q, k) => {
          // distance from the head's own point at the same step
          const h = head.path[Math.min(k, head.path.length - 1)]!;
          return Math.hypot(q.x - h.x, q.y - h.y);
        }),
      ),
    );
    return JSON.stringify({
      motes: motes.length,
      size: motes[0]!.size,
      lanes,
      drifts: maxDrift > 0.5,
      bolt: bolt.length,
      cloud: bolt.filter((p) => p.role === "cloud").length,
      weaves: weave > 3,
      steps: head.steps,
      stretch: skinOf(f).bolt.stretch,
      rays: castRayAngles(f, "normal").length,
    });
  }

  it("every skin has a distinct fingerprint", () => {
    const prints = FACTIONS.map(fingerprint);
    expect(new Set(prints).size).toBe(FACTIONS.length);
  });

  it("each named character shows up where EFFECTS.md says it should", () => {
    // Cortex: packets in lanes, a longer packet train.
    const cortex = moteLayout("Cortex", "up", "normal", 118, 158);
    expect(new Set(cortex.map((m) => m.x)).size).toBe(FACTION_SKINS.Cortex!.mote.lanes);
    expect(boltLayout("Cortex", "normal", false, ARC).filter((p) => p.role === "trail").length).toBeGreaterThan(
      boltLayout("Neutral", "normal", false, ARC).filter((p) => p.role === "trail").length,
    );
    // Swarm: many small spores that drift; a cloud that weaves off the arc.
    const swarm = moteLayout("Swarm", "up", "normal", 118, 158);
    const plain = moteLayout("Neutral", "up", "normal", 118, 158);
    expect(swarm.length).toBeGreaterThan(plain.length);
    expect(swarm[0]!.size).toBeLessThan(plain[0]!.size);
    expect(swarm.some((m) => m.path.some((p) => Math.abs(p.dx) > 5))).toBe(true);
    expect(boltLayout("Swarm", "normal", false, ARC).filter((p) => p.role === "cloud").length).toBeGreaterThan(0);
    // Aegis: fewer, bigger plates; an elongated slug.
    const aegis = moteLayout("Aegis", "up", "normal", 118, 158);
    expect(aegis.length).toBeLessThan(plain.length);
    expect(aegis[0]!.size).toBeGreaterThan(plain[0]!.size);
    expect(FACTION_SKINS.Aegis!.bolt.stretch).toBeGreaterThan(1.5);
    // Null: stepped motion with sideways tears; a stuttering, jittering bolt.
    const nul = moteLayout("Null", "up", "normal", 118, 158);
    expect(nul.some((m) => m.path.slice(0, -1).some((p) => Math.abs(p.dx) > 0.5))).toBe(true);
    const nullHead = boltLayout("Null", "normal", false, ARC).find((p) => p.role === "head")!;
    const plainHead = boltLayout("Neutral", "normal", false, ARC).find((p) => p.role === "head")!;
    expect(nullHead.steps).toBeGreaterThan(0);
    const off = (path: typeof nullHead.path, k: number) => {
      const t = k / (path.length - 1), u = 1 - t;
      const x = u * u * ARC.a.x + 2 * u * t * ARC.c.x + t * t * ARC.b.x;
      const y = u * u * ARC.a.y + 2 * u * t * ARC.c.y + t * t * ARC.b.y;
      return Math.hypot(path[k]!.x - x, path[k]!.y - y);
    };
    expect(Math.max(...nullHead.path.map((_, k) => off(nullHead.path, k)))).toBeGreaterThan(1);
    expect(Math.max(...plainHead.path.map((_, k) => off(plainHead.path, k)))).toBeLessThan(1e-6);
  });

  it("the plain (Neutral) skin reproduces the pre-slice-5 layout", () => {
    // The approved baseline: 3/6/12 motes evenly spread with the old jitter,
    // a round bolt with 0/2/4 trail particles, 0/6/10 rays.
    for (const [tier, n, trail, rays] of [["subtle", 3, 0, 0], ["normal", 6, 2, 6], ["spectacle", 12, 4, 10]] as const) {
      const motes = moteLayout("Neutral", "up", tier, 118, 158);
      expect(motes).toHaveLength(n);
      motes.forEach((m, k) => expect(Math.abs(m.x - (118 * ((k + 0.5) / n) + ((k * 7) % 5 - 2)))).toBeLessThanOrEqual(0.051));
      const bolt = boltLayout("Neutral", tier, false, ARC);
      expect(bolt.filter((p) => p.role === "trail")).toHaveLength(trail);
      expect(bolt.filter((p) => p.role === "cloud")).toHaveLength(0);
      expect(castRayAngles("Neutral", tier)).toHaveLength(rays);
    }
  });

  it("every skin scales with tier (subtle <= normal <= spectacle) and subtle casts have no rays", () => {
    for (const f of FACTIONS) {
      const motes = TIERS.map((t) => moteLayout(f, "down", t, 118, 158).length);
      const bolts = TIERS.map((t) => boltLayout(f, t, false, ARC).length);
      const heads = TIERS.map((t) => boltLayout(f, t, false, ARC).find((p) => p.role === "head")!.size);
      for (const series of [motes, bolts, heads]) {
        expect(series[0]!).toBeLessThanOrEqual(series[1]!);
        expect(series[1]!).toBeLessThanOrEqual(series[2]!);
      }
      expect(castRayAngles(f, "subtle")).toEqual([]);
      expect(castRayAngles(f, "spectacle").length).toBeGreaterThanOrEqual(castRayAngles(f, "normal").length);
    }
  });

  it("is deterministic: the same move always looks the same", () => {
    for (const f of FACTIONS) {
      expect(moteLayout(f, "up", "spectacle", 118, 158)).toEqual(moteLayout(f, "up", "spectacle", 118, 158));
      expect(boltLayout(f, "spectacle", false, ARC)).toEqual(boltLayout(f, "spectacle", false, ARC));
    }
    expect(FACTION_SKIN_SOURCE).not.toMatch(/Math\.random/);
  });
});

describe("the page", () => {
  const html = renderMatchHtml({
    title: "t", seed: 1, movesPlayed: 0, turnCap: 1, frames: [], factions: { p1: "Cortex", p2: "Null" },
    identities: { p1: { username: "a", avatarSvg: "" }, p2: { username: "b", avatarSvg: "" } }, cardFactions: {}, cardRarities: {},
  } as unknown as MatchReplay);

  it("embeds FACTION_SKIN_SOURCE verbatim (single source, no mirror)", () => {
    expect(html).toContain(FACTION_SKIN_SOURCE);
  });

  it("has shape rules for every skin on every primitive it reshapes", () => {
    for (const name of ["cortex", "swarm", "aegis", "null"]) {
      for (const sel of [`.fx-mote.skin-${name}`, `.fx-bolt.skin-${name}`, `.fx-cast-ring.skin-${name}`, `.fx-burst.skin-${name}`, `.fx-cast-sigil.skin-${name}`, `.fx-cast-ray.skin-${name}`]) {
        expect(html, sel).toContain(sel);
      }
    }
    // Neutral keeps the arrow motes (the original look).
    expect(html).toContain(".fx-mote.skin-neutral.up");
  });

  it("the penalty desaturate applies to every skin (it is meaning, not skin)", () => {
    expect(html).toMatch(/\.fx-mote\.down \{ filter: saturate\(0\.3\)/);
  });
});

describe("the skin sheet", () => {
  it("draws every faction from the same source and CSS the replays use", () => {
    const sheet = renderSkinSheet();
    expect(sheet).toContain(FACTION_SKIN_SOURCE);
    expect(sheet).toContain(".fx-bolt.skin-aegis");
    for (const f of FACTIONS) expect(sheet).toContain(`'${f}'`);
  });
});

describe("real matches", () => {
  it("every faction a replay names (incl. neutral-pool cards) has its own skin row", async () => {
    const builders = { Cortex: buildCortexDeck, Swarm: buildSwarmDeck, Aegis: buildAegisDeck, Null: buildNullDeck } as const;
    const seen = new Set<string>();
    for (const [a, b] of [["Cortex", "Null"], ["Aegis", "Swarm"]] as const) {
      const replay = await captureMatch({
        title: "skin", seed: 3,
        deckA: builders[a]("p1", a), deckB: builders[b]("p2", b),
        agentA: new LookaheadAgent(`L-${a}`, 7), agentB: new LookaheadAgent(`L-${b}`, 8),
        boardSlots: BOARD_SLOTS,
      });
      Object.values(replay.cardFactions).forEach((f) => seen.add(f));
      seen.add(replay.factions.p1);
      seen.add(replay.factions.p2);
    }
    expect(seen.has("Neutral")).toBe(true);
    for (const f of seen) expect(Object.keys(FACTION_SKINS)).toContain(f);
  });
});
