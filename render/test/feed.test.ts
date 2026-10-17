// The match feed (render session 21): the log pane reads the engine's
// structured events, not its prose. ORACLES over real matches check that
// nothing that happened is lost (every play, cast, attack, damage, death,
// draw and trigger has its entry), that the noise is gone (no priority
// passes, no seat names, no internal ability ids), and that the reactive
// plays the priority system exists for are tagged as responses.
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { DeckSpec, GameEvent } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "../src/engineInternal.js";
import type { DeckFaction } from "../src/engineInternal.js";
import { abilityTextFor, captureMatch } from "../src/capture.js";
import { generatedSeats } from "../src/generatedSignatures.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import { abilityKey, attackFirst, buildFeed, feedText, withPlayers } from "../src/feed.js";
import type { FeedEntry, FeedPart } from "../src/feed.js";

const BUILDERS: Record<DeckFaction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck, Aegis: buildAegisDeck, Swarm: buildSwarmDeck, Null: buildNullDeck,
};

async function replay(a: DeckFaction, b: DeckFaction, seed: number, signatures: boolean) {
  const seats = signatures ? generatedSeats(seed) : undefined;
  const deckA = { ...BUILDERS[a]("p1", a), ...(seats ? { signature: seats[0].card } : {}) };
  const deckB = { ...BUILDERS[b]("p2", b), ...(seats ? { signature: seats[1].card } : {}) };
  const r = await captureMatch({
    title: `${a} vs ${b} seed ${seed}`, seed, deckA, deckB,
    agentA: new LookaheadAgent(seats ? seats[0].agentName : `Kestrel-${a}`, seed * 2 + 1),
    agentB: new LookaheadAgent(seats ? seats[1].agentName : `Mote-${b}`, seed * 2 + 2),
    boardSlots: BOARD_SLOTS,
  });
  return { r, abilityText: abilityTextFor([deckA, deckB]) };
}

const flat = (parts: FeedPart[] | undefined) =>
  (parts ?? []).map((p) => (typeof p === "string" ? p : "card" in p ? p.card : `<${p.player}>`)).join("");
const has = (e: FeedEntry, s: string) => flat(e.parts).includes(s);

describe("the match feed", () => {
  // Every committed replay's match-up, signature replays included.
  const cases: [DeckFaction, DeckFaction, number, boolean][] = [
    ["Aegis", "Cortex", 1, false], ["Cortex", "Aegis", 5, true], ["Cortex", "Aegis", 2, true], ["Null", "Cortex", 4, false],
    ["Aegis", "Null", 3, false], ["Swarm", "Null", 8, false], ["Cortex", "Swarm", 6, false],
  ];
  const replaysP = Promise.all(cases.map(([a, b, s, sig]) => replay(a, b, s, sig)));

  it("every frame carries a feed", async () => {
    for (const { r } of await replaysP) for (const f of r.frames) expect(Array.isArray(f.feed), `${r.title} move ${f.index}`).toBe(true);
  });

  it("loses nothing that happened: each event kind has its entries", async () => {
    for (const { r } of await replaysP) {
      const events = r.frames.flatMap((f) => f.newEvents.map((e) => e.event));
      const entries = r.frames.flatMap((f) => f.feed!);
      const count = (t: GameEvent["type"]) => events.filter((e) => e.type === t).length;
      const where = (pred: (e: FeedEntry) => boolean) => entries.filter(pred).length;
      const msg = r.title;
      expect(where((e) => e.kind === "turn"), msg).toBe(count("turnStart"));
      expect(where((e) => e.kind === "action" && has(e, " plays ")), msg).toBe(count("play"));
      expect(where((e) => (e.kind === "action" || e.kind === "response") && (has(e, " casts ") || has(e, " activates "))), msg).toBe(count("cast"));
      expect(where((e) => e.kind === "action" && has(e, " attacks ")), msg).toBe(count("attack"));
      expect(where((e) => e.kind === "result" && / deals \d+ to /.test(flat(e.parts))), msg).toBe(count("damage"));
      expect(where((e) => e.kind === "result" && has(e, " is destroyed")), msg).toBe(count("death"));
      expect(where((e) => e.kind === "end"), msg).toBe(count("gameOver"));
      // Draws: in the turn header (the turn's draw) or a line of their own.
      const headerDraws = entries.filter((e) => e.kind === "turn").reduce((n, e) => n + (flat(e.detail).match(/draws /g)?.length ?? 0), 0);
      expect(headerDraws + where((e) => e.kind === "result" && has(e, " draws ")), msg).toBe(count("draw"));
      // Triggers: a line of their own, or the rules text of the resolve or
      // arming line they belong to.
      const merged = where((e) => (e.kind === "resolve" && !!e.detail) || (e.kind === "trigger" && has(e, " arms") && !!e.detail));
      const ownLine = where((e) => e.kind === "trigger" && !has(e, " arms"));
      expect(ownLine + merged, msg).toBe(count("abilityTrigger"));
      expect(count("abilityTrigger"), msg).toBeGreaterThan(0);
    }
  });

  it("drops the noise: no priority passes, no seats, no internal ability ids", async () => {
    let passes = 0;
    for (const { r, abilityText } of await replaysP) {
      const events = r.frames.flatMap((f) => f.newEvents.map((e) => e.event));
      passes += events.filter((e) => e.type === "priorityPass").length;
      for (const e of events) {
        if (e.type === "abilityTrigger") expect(abilityText[abilityKey(e.source, e.ability)], `${r.title}: rules text for ${e.source} ${e.ability}`).toBeTruthy();
      }
      const ids = new Set(events.flatMap((e) => (e.type === "abilityTrigger" ? [e.ability] : [])));
      for (const f of r.frames) {
        for (const e of f.feed!) {
          const strings = [...e.parts, ...(e.detail ?? [])].filter((p): p is string => typeof p === "string").join("|");
          expect(strings, `${r.title} move ${f.index}`).not.toMatch(/\bp[12]\b/);
          expect(strings).not.toMatch(/passes priority|end of turn \d/);
          for (const id of ids) expect(flat(e.parts) + flat(e.detail)).not.toContain(id);
        }
      }
    }
    expect(passes).toBeGreaterThan(100);
  });

  it("names players by agent name", async () => {
    const { r } = (await replaysP)[1]!;
    const lines = r.frames.flatMap((f) => f.feed!.map((e) => feedText(e, { names: r.agentNames })));
    expect(lines[0]).toBe(`== Turn 1 · ${r.agentNames.p1} ==`);
    expect(lines.some((l) => l.includes(`${r.agentNames.p2} plays `))).toBe(true);
    expect(lines[lines.length - 1]).toMatch(new RegExp(`^${r.agentNames.p1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} wins \\(`));
  });

  it("tags a cast into a waiting stack as a RESPONSE", async () => {
    let responses = 0;
    for (const { r } of await replaysP) {
      for (let k = 1; k < r.frames.length; k++) {
        const f = r.frames[k]!;
        const casts = f.newEvents.filter((e) => e.event.type === "cast");
        if (!casts.length) continue;
        const entry = f.feed!.find((e) => has(e, " casts ") || has(e, " activates "))!;
        if (r.frames[k - 1]!.stack.length > 0) {
          expect(entry.kind, `${r.title} move ${k}`).toBe("response");
          expect(entry.tag).toBe("RESPONSE");
          responses++;
        }
      }
    }
    expect(responses).toBeGreaterThan(2);
  });

  it("folds an attack's resolution into its declaration unless a response came between", async () => {
    let folded = 0, ownLine = 0;
    for (const { r } of await replaysP) {
      // Attack stack ids that had a cast pushed on top of them.
      const answered = new Set<string>();
      const open: string[] = [];
      for (const f of r.frames) {
        for (const { event: e } of f.newEvents) {
          if (e.type === "attack" && e.stackId) open.push(e.stackId);
          if (e.type === "cast") for (const id of open) answered.add(id);
          if (e.type === "stackResolve" && e.stackId && open.includes(e.stackId)) open.splice(open.indexOf(e.stackId), 1);
        }
      }
      const lands = r.frames.flatMap((f) => f.feed!).filter((e) => e.kind === "resolve" && has(e, "'s attack lands")).length;
      const attacks = r.frames.flatMap((f) => f.newEvents).filter((e) => e.event.type === "attack").length;
      expect(lands, r.title).toBeGreaterThanOrEqual(answered.size);
      expect(lands, r.title).toBeLessThan(attacks);
      ownLine += lands;
      folded += attacks - lands;
    }
    expect(folded).toBeGreaterThan(ownLine * 5);
    expect(ownLine).toBeGreaterThan(0);
  });

  it("is at most about half as long as the raw log", async () => {
    for (const { r } of await replaysP) {
      const raw = r.frames.reduce((n, f) => n + f.newEvents.length, 0);
      const feed = r.frames.reduce((n, f) => n + f.feed!.length, 0);
      expect(feed, r.title).toBeLessThan(raw * 0.6);
    }
  });
});

describe("feed helpers", () => {
  it("withPlayers turns seats in engine text into player parts", () => {
    expect(withPlayers("p2 health depleted")).toEqual([{ player: "p2" }, " health depleted"]);
    expect(withPlayers("turn cap: p1 ahead of p2")).toEqual(["turn cap: ", { player: "p1" }, " ahead of ", { player: "p2" }]);
    expect(withPlayers("nothing here, not even p12")).toEqual(["nothing here, not even p12"]);
  });

  it("attackFirst puts an attack ahead of the onAttack trigger it set off", () => {
    const trig: GameEvent = { type: "abilityTrigger", source: "Load Balancer", ability: "lb-attack", trigger: "onAttack" };
    const dmg: GameEvent = { type: "damage", target: "Turret", targetKind: "unit", amount: 1, source: "Load Balancer" };
    const atk: GameEvent = { type: "attack", attacker: "Load Balancer", defender: "Turret", defenderKind: "unit" };
    expect(attackFirst([trig, dmg, atk])).toEqual([atk, trig, dmg]);
    // Another unit's trigger is left where it is.
    const other: GameEvent = { ...trig, source: "Someone Else" };
    expect(attackFirst([other, atk])).toEqual([other, atk]);
  });
});

describe("rules text", () => {
  it("comes from the triggering card, even when another card shares its ability id", async () => {
    // Before game session 38 generated signature cards reused ability ids
    // with different numbers ("sig-recycle" was "Draw 2 cards." on one card
    // and "Draw 3 cards." on another). New cards no longer do (the engine's
    // signatureAbilityIds test), but replays recorded before then still
    // can, so the clash is rebuilt here from two real generated cards.
    const seats = Array.from({ length: 50 }, (_, s) => generatedSeats(s + 1)).flat();
    const withAbility = seats.filter((s) => s.card.abilities.length > 0);
    const first = withAbility[0]!;
    const other = withAbility.find((s) => s.card.name !== first.card.name && s.card.abilities[0]!.text !== first.card.abilities[0]!.text)!;
    const id = first.card.abilities[0]!.id;
    const second = { ...other, card: { ...other.card, abilities: [{ ...other.card.abilities[0]!, id }] } };
    const a = { name: first.card.name, text: first.card.abilities[0]!.text };
    const b = { name: second.card.name, text: second.card.abilities[0]!.text };
    const deckOf = (seat: (typeof seats)[number]) => ({ id: "p1" as const, name: "d", cards: [], signature: seat.card });
    const text = abilityTextFor([first, second].map(deckOf));
    const { r } = await replay("Cortex", "Aegis", 5, true);
    const frame = { ...r.frames[1]!, newEvents: [a, b].map((c) => ({ event: { type: "abilityTrigger" as const, source: c.name, ability: id, trigger: "onPlay" }, text: "" })) };
    const [entries] = buildFeed([frame], { names: r.agentNames, abilityText: text });
    expect(entries!.map((e) => e.detail?.[0])).toEqual([a.text, b.text]);
  });
});

describe("the page", () => {
  it("draws the feed, keeps the engine log one switch away, and names players", async () => {
    const { r } = await replay("Cortex", "Aegis", 5, true);
    const html = renderMatchHtml(r);
    expect(html).toContain('id="eventlog-body"');
    expect(html).toContain('id="raw-log"');
    expect(html).toContain("frame.feed.forEach");
    expect(html).not.toContain("'P1 HAND'");
    expect(html).not.toContain("m.leader.toUpperCase()");
    expect(html).not.toContain("frame.activePlayer.toUpperCase()");
  });
});
