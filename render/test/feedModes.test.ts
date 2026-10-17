// Render session 24 (owner side task 2026-10-18): the feed names a modal
// card's chosen mode, from the mode id and name the engine puts on play /
// cast / evolve events (game session 40). Checked on a real match: Cortex
// vs Swarm, both decks running the 3 Zero-Day cards (one copy each, each in
// place of a spare copy, removal for removal as the engine's own
// modalMatchDemo does), seed 442, the seed of the engine's committed
// sample-match-033-modal-cards.txt.
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS } from "@ai-tcg/engine";
import type { Card } from "@ai-tcg/engine";
import { buildDeck } from "../../engine/src/data/decks.js";
import { CORTEX_CARDS, SWARM_CARDS } from "../../engine/src/data/cards.js";
import { ZERO_DAY_CARDS } from "../../engine/src/data/zeroDayCards.js";
import { isRemovalOrDebuffCard } from "../../engine/src/cards/poolLint.js";
import { LookaheadAgent } from "../src/engineInternal.js";
import { captureMatch } from "../src/capture.js";
import type { FeedPart } from "../src/feed.js";

type Pool = { card: Card; copies: number }[];
function withZeroDays(base: Pool): Pool {
  const pool = base.map((p) => ({ ...p }));
  for (const zd of ZERO_DAY_CARDS) {
    const spare = pool.filter((p) => p.copies > 1 && p.card.rarity !== "Mythic" && !p.card.topTier);
    const cut = spare.find((p) => isRemovalOrDebuffCard(p.card) === isRemovalOrDebuffCard(zd)) ?? spare[0]!;
    cut.copies -= 1;
    pool.push({ card: zd, copies: 1 });
  }
  return pool;
}

describe("the feed names a modal card's chosen mode (real match, seed 442)", async () => {
  const seed = 442;
  const replay = await captureMatch({
    title: "modal",
    seed,
    deckA: buildDeck("p1", "Cortex + Zero-Day", withZeroDays(CORTEX_CARDS)),
    deckB: buildDeck("p2", "Swarm + Zero-Day", withZeroDays(SWARM_CARDS)),
    agentA: new LookaheadAgent("Lookahead-Cortex", seed * 104729 + 31),
    agentB: new LookaheadAgent("Lookahead-Swarm", seed * 104729 + 31),
    boardSlots: BOARD_SLOTS,
  });
  const names = { p1: "Lookahead-Cortex", p2: "Lookahead-Swarm" };
  // The line's own words, players by name (no indent, tag or rules text).
  const flat = (parts: FeedPart[]) => parts.map((p) => (typeof p === "string" ? p : "card" in p ? p.card : names[p.player])).join("");
  const lines = replay.frames.flatMap((f) => f.feed.map((e) => ({ text: flat(e.parts), entry: e })));
  const events = replay.frames.flatMap((f) => f.newEvents.map((e) => e.event));
  const choices = events.filter((e) => (e.type === "play" || e.type === "cast" || e.type === "evolve") && e.modeName);

  it("the match makes mode choices in every kind the engine logs here", () => {
    expect(choices.length).toBeGreaterThanOrEqual(4);
    expect(new Set(choices.map((e) => e.type))).toEqual(new Set(["play", "cast"]));
  });

  it("every play names its mode after the card: 'plays Patient Zero (Outbreak)'", () => {
    const plays = choices.filter((e) => e.type === "play");
    for (const p of plays) {
      if (p.type !== "play") continue;
      expect(lines.some((l) => l.text === `${names[p.player]} plays ${p.card} (${p.modeName})`)).toBe(true);
    }
  });

  it("a cast names its choice ('casts Kill Switch, choosing Wipe'), and its resolve line is the card, not the engine's description", () => {
    const casts = choices.filter((e) => e.type === "cast");
    expect(casts.length).toBeGreaterThan(0);
    for (const c of casts) {
      if (c.type !== "cast") continue;
      expect(lines.some((l) => l.text === `${names[c.player]} casts ${c.card}, choosing ${c.modeName}`)).toBe(true);
      const resolve = lines.find((l) => l.text === `${c.card} (${c.modeName}) resolves`);
      expect(resolve).toBeDefined();
      // The card part is the card's own name, so the chip and the trigger
      // fold work: the mode's rules text joins the resolve line, and no
      // separate "on entry" trigger line is left for it.
      expect(resolve!.entry.parts[0]).toEqual({ card: c.card });
      expect(resolve!.entry.detail).toEqual(["Deal 3 damage to all enemy units, then draw a card."]);
    }
    expect(lines.some((l) => l.text.startsWith("Kill Switch · on entry"))).toBe(false);
    expect(lines.some((l) => l.text.includes("Kill Switch (Wipe) (Wipe)"))).toBe(false);
  });

  it("a mode's own triggers carry its rules text (the text table reads every mode)", () => {
    const outbreak = lines.filter((l) => l.text.startsWith("Patient Zero · on death"));
    expect(outbreak.length).toBeGreaterThan(0);
    for (const l of outbreak) expect(l.entry.detail).toEqual(["When this dies, deal 2 damage to all enemy units."]);
  });

  it("no card part ever carries a mode suffix", () => {
    for (const l of lines) {
      for (const p of [...l.entry.parts, ...(l.entry.detail ?? [])]) {
        if (typeof p === "object" && "card" in p) expect(p.card).not.toMatch(/\((Outbreak|Carrier|Privilege Escalation|Lockout|Lights Out|Wipe)\)$/);
      }
    }
  });
});
