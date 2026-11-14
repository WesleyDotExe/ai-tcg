// Season 1 arena prototype (render session 79): the layout model and the page,
// on real matches played through the engine.
import { describe, it, expect, beforeAll } from "vitest";
import {
  ARENA_RADIUS, CARD_W, CARD_H, DISCARD_SCALE, SEATS, otherSeat,
  slotPlace, directivePlace, sigPlace, deckPlace, discardPlace, heldPlace, footprint,
  restYaw, viewerYaw, sceneAt, artRings, hudAt, motionsBetween, beatFrames, beatMs,
  type Seat, type Vec3,
} from "../src/arenaModel.js";
import { captureReplay } from "../../src/replaySetup.js";
import type { MatchReplay } from "../../src/types.js";
import { renderArenaPage, scriptJson } from "../src/arenaPage.js";
import { buildArena, sampleLoadouts } from "../src/build.js";

const onDisc = (pos: Vec3, scale = 1) => footprint(pos, scale).every((c) => Math.hypot(c.x, c.z) <= ARENA_RADIUS - 0.05);
type Rect = { x0: number; x1: number; z0: number; z1: number };
const rect = (pos: Vec3, scale = 1): Rect => ({ x0: pos.x - (CARD_W * scale) / 2, x1: pos.x + (CARD_W * scale) / 2, z0: pos.z - (CARD_H * scale) / 2, z1: pos.z + (CARD_H * scale) / 2 });
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

describe("the round arena's zones", () => {
  it("every zone fits on the disc, for any slot and directive count", () => {
    for (const seat of SEATS) {
      expect(onDisc(sigPlace(seat))).toBe(true);
      expect(onDisc(deckPlace(seat))).toBe(true);
      expect(onDisc(discardPlace(seat), DISCARD_SCALE)).toBe(true);
      for (let n = 1; n <= 9; n++) for (let i = 0; i < n; i++) { const p = slotPlace(seat, i, n); expect(onDisc(p.pos, p.scale), `slot ${i}/${n}`).toBe(true); }
      for (let n = 1; n <= 8; n++) for (let i = 0; i < n; i++) { const p = directivePlace(seat, i, n); expect(onDisc(p.pos, p.scale), `directive ${i}/${n}`).toBe(true); }
    }
  });

  it("no two zones overlap (6 slots, up to 6 directives), on either side or across", () => {
    const all: { name: string; r: Rect }[] = [];
    for (const seat of SEATS) {
      for (let i = 0; i < 6; i++) { const p = slotPlace(seat, i, 6); all.push({ name: `${seat} slot ${i}`, r: rect(p.pos, p.scale) }); }
      for (let i = 0; i < 6; i++) { const p = directivePlace(seat, i, 6); all.push({ name: `${seat} directive ${i}`, r: rect(p.pos, p.scale) }); }
      all.push({ name: `${seat} signature`, r: rect(sigPlace(seat)) });
      all.push({ name: `${seat} deck`, r: rect(deckPlace(seat)) });
      all.push({ name: `${seat} discard`, r: rect(discardPlace(seat), DISCARD_SCALE) });
    }
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
      expect(overlap(all[a]!.r, all[b]!.r), `${all[a]!.name} / ${all[b]!.name}`).toBe(false);
    }
  });

  it("each side's zones sit on its own half; slot 0 on its owner's left, the signature on its right, the piles on its left", () => {
    // p1 sits at +z looking towards -z: its left is -x. p2 is the mirror.
    expect(slotPlace("p1", 0, 6).pos.x).toBeLessThan(0);
    expect(slotPlace("p2", 0, 6).pos.x).toBeGreaterThan(0);
    expect(sigPlace("p1").x).toBeGreaterThan(0);
    expect(sigPlace("p2").x).toBeLessThan(0);
    expect(deckPlace("p1").x).toBeLessThan(0);
    expect(deckPlace("p2").x).toBeGreaterThan(0);
    for (const seat of SEATS) {
      const s = seat === "p1" ? 1 : -1;
      for (const z of [slotPlace(seat, 2, 6).pos.z, sigPlace(seat).z, deckPlace(seat).z, discardPlace(seat).z, directivePlace(seat, 0, 1).pos.z]) expect(z * s).toBeGreaterThan(0);
    }
  });

  it("the far side's held hand is up off the table, behind its own side, and fanned", () => {
    for (const seat of SEATS) {
      const s = seat === "p1" ? 1 : -1;
      const hs = Array.from({ length: 7 }, (_, k) => heldPlace(seat, k, 7));
      for (const h of hs) { expect(h.pos.y).toBeGreaterThan(0.9); expect(h.pos.z * s).toBeGreaterThan(directivePlace(seat, 0, 1).pos.z * s); }
      const xs = hs.map((h) => h.pos.x);
      expect(new Set(xs).size).toBe(7);
    }
  });

  it("a card at rest faces its owner; the viewer's yaw is the POV's", () => {
    expect(restYaw("p1")).toBe(0);
    expect(restYaw("p2")).toBeCloseTo(Math.PI);
    expect(viewerYaw("p2")).toBe(restYaw("p2"));
  });
});

describe("on real matches", () => {
  let sig: MatchReplay, plain: MatchReplay;
  beforeAll(async () => {
    sig = (await captureReplay("Cortex", "Aegis", 2, true)).replay;
    plain = (await captureReplay("Swarm", "Null", 4, false)).replay;
  }, 60_000);

  it("the table holds exactly each side's units (by slot), directives and a waiting signature card", () => {
    for (const r of [sig, plain]) for (const f of r.frames) for (const pov of SEATS) {
      const m = sceneAt(f, pov);
      for (const seat of SEATS) {
        const p = f.players[seat];
        const mine = m.table.filter((c) => c.seat === seat);
        expect(mine.filter((c) => c.zone === "slot").map((c) => c.key).sort()).toEqual(p.board.map((u) => u.instanceId).sort());
        expect(mine.filter((c) => c.zone === "directive").length).toBe(p.directives.length);
        expect(mine.filter((c) => c.zone === "signature").length).toBe(p.signature?.inZone ? 1 : 0);
        for (const c of mine) expect(c.yaw).toBe(restYaw(seat));
        // a unit's slot is the slot capture.ts assigned it
        for (const c of mine.filter((x) => x.zone === "slot")) {
          const i = p.slots!.indexOf(c.key);
          expect(c.pos).toEqual(slotPlace(seat, i, p.slots!.length).pos);
        }
      }
    }
  });

  it("Watch as moves the viewer, not the cards; the held hand is the far side's count and carries no card", () => {
    for (const f of sig.frames) {
      const a = sceneAt(f, "p1"), b = sceneAt(f, "p2");
      expect(b.table).toEqual(a.table);
      expect(a.held).toEqual({ seat: "p2", count: f.players.p2.hand.length });
      expect(b.held).toEqual({ seat: "p1", count: f.players.p1.hand.length });
      expect(Object.keys(a.held).sort()).toEqual(["count", "seat"]);
      expect(a.nearHand.cards.map((c) => c?.name)).toEqual(f.players.p1.hand.map((c) => (c.hidden ? undefined : c.name)));
    }
  });

  it("a hidden hand card has no face", () => {
    const f = structuredClone(sig.frames[3]!);
    f.players.p1.hand = f.players.p1.hand.map((c) => ({ ...c, name: "", hidden: true as const }));
    expect(sceneAt(f, "p1").nearHand.cards.every((c) => c === null)).toBe(true);
  });

  it("the signature zone says waiting, then in play once the card is on the board", () => {
    const states = sig.frames.map((f) => sceneAt(f, "p1").sigZone);
    expect(states[0]).toEqual({ p1: "waiting", p2: "waiting" });
    expect(states.some((s) => s.p1 === "in play" || s.p2 === "in play")).toBe(true);
    expect(sceneAt(plain.frames[0]!, "p1").sigZone).toEqual({ p1: "none", p2: "none" });
  });

  it("the HUDs read the frame: health, energy, counts, signature, whose turn", () => {
    const lo = sampleLoadouts(sig);
    expect(lo.p1.coin).toBe("Chrome Token");
    for (const f of sig.frames) for (const seat of SEATS) {
      const h = hudAt(sig, f, seat, lo[seat]);
      const p = f.players[seat];
      expect([h.health, h.maxHealth, h.energy, h.maxEnergy, h.hand, h.deck, h.discard]).toEqual([p.health, p.maxHealth, p.energy, p.maxEnergy, p.hand.length, p.deckSize, p.graveyardSize]);
      expect(h.active).toBe(f.activePlayer === seat);
      expect(h.signature).toBe(p.signature ? (p.signature.inZone ? `Ready · ${p.signature.nextCost}` : "In play") : null);
      expect(h.name).toBe(sig.agentNames[seat]);
    }
  });

  it("motions: arrivals, departures, attacks and hits agree with the frames, and every kind occurs", () => {
    const seen = new Set<string>();
    for (const r of [sig, plain]) {
      let attacks = 0;
      for (let i = 1; i < r.frames.length; i++) {
        const prev = r.frames[i - 1]!, next = r.frames[i]!;
        const before = new Set(SEATS.flatMap((s) => sceneAt(prev, "p1").table.filter((c) => c.seat === s).map((c) => c.key)));
        const after = new Set(sceneAt(next, "p1").table.map((c) => c.key));
        for (const m of motionsBetween(prev, next)) {
          seen.add(m.kind);
          if (m.kind === "enter") { expect(after.has(m.key)).toBe(true); expect(before.has(m.key)).toBe(false); }
          if (m.kind === "leave") { expect(before.has(m.key)).toBe(true); expect(after.has(m.key)).toBe(false); }
          if (m.kind === "attack") { attacks++; expect(after.has(m.attacker)).toBe(true); if (m.target.kind === "unit") expect(after.has(m.target.key) || before.has(m.target.key)).toBe(true); }
          if (m.kind === "hurt") expect(m.amount).toBeGreaterThan(0);
          if (m.kind === "face") expect(next.players[m.seat].health).toBe(prev.players[m.seat].health - m.amount);
        }
      }
      const pushed = new Set(r.frames.flatMap((f) => f.stack.filter((s) => s.kind === "combatDamage").map((s) => s.stackId)));
      expect(attacks).toBe(pushed.size);
    }
    expect([...seen].sort()).toEqual(["attack", "enter", "face", "hurt", "leave"]);
  });

  it("the beats skip the empty passes but keep every frame something happens on, first and last included", () => {
    for (const r of [sig, plain]) {
      const b = beatFrames(r.frames);
      expect(b[0]).toBe(0);
      expect(b[b.length - 1]).toBe(r.frames.length - 1);
      for (let k = 1; k < b.length; k++) expect(b[k]!).toBeGreaterThan(b[k - 1]!);
      expect(b.length).toBeLessThan(r.frames.length);
      r.frames.forEach((f, i) => { if ((f.feed?.length ?? 0) > 0 || motionsBetween(r.frames[i - 1], f).length > 0) expect(b).toContain(i); });
      const last = r.frames.length - 1;
      expect(beatMs(r.frames[last - 1], r.frames[last]!)).toBeGreaterThan(beatMs(undefined, r.frames[0]!));
    }
  });
});

describe("the placeholder art", () => {
  it("every card in the registry draws rings with a positive radius, inside the art window", async () => {
    const { CARD_REGISTRY } = await import("@ai-tcg/engine");
    let n = 0;
    for (const c of CARD_REGISTRY.values()) for (const ring of artRings(c.id)) { n++; expect(ring.r, c.id).toBeGreaterThan(0); expect(Math.abs(ring.dx), c.id).toBeLessThanOrEqual(20); }
    expect(n).toBeGreaterThan(700);
    // one of the 67 of 127 ids whose seed passes 2^31 (the old signed shift gave a negative radius)
    expect(artRings("SW-001").every((r) => r.r > 0)).toBe(true);
  });
});

describe("the page", () => {
  it("is one self-contained file: no outside URL, three.js bundled, the data parses back", async () => {
    const { data, html } = await buildArena("Cortex", "Aegis", 2, true);
    expect(html).not.toMatch(/(src|href)=["']https?:/i);
    expect(html).not.toMatch(/https?:\/\/(cdn|unpkg|cdnjs)/i);
    expect(html.match(/<\/script/gi)!.length).toBe(2);
    const json = html.slice(html.indexOf('id="s1data">') + 'id="s1data">'.length, html.indexOf("</script>"));
    const back = JSON.parse(json);
    expect(back.replay.frames.length).toBe(data.replay.frames.length);
    expect(back.cardText[data.replay.frames[0]!.players.p1.signature!.cardId].length).toBeGreaterThan(0);
    expect(html).toContain("WebGLRenderer");
    // every card the match can show has its rules text
    for (const f of data.replay.frames) for (const s of SEATS) for (const u of f.players[s].board) expect(back.cardText[u.cardId], u.name).toBeDefined();
  }, 60_000);

  it("escapes </script inside the data", () => {
    expect(scriptJson({ a: "</script><b>" })).not.toContain("</");
    expect(JSON.parse(scriptJson({ a: "</script> " })).a).toBe("</script> ");
  });

  it("is fenced off: no Season 0 file imports render/season1", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(import.meta.dirname, "..", "..");
    const bad: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === "node_modules" || n === "season1" || n === "output") continue;
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|mjs|js|html)$/.test(n) && /season1\//.test(readFileSync(p, "utf8").replace(/season1-arena-3d-test/g, ""))) bad.push(p);
      }
    };
    walk(root);
    expect(bad).toEqual([]);
  });

  it("a renamed pov: the other seat", () => {
    expect(otherSeat("p1" as Seat)).toBe("p2");
  });
});
