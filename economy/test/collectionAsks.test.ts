// Session 68's small collection asks (owner 2026-11-02, render 47, 48 and 49
// entries): an opening kept as POST /api/packs/open answered it ("Watch
// again", schema v19); the craft price and playable copy limit in the card
// viewer's answer; signature cards and earned promos for the Promos tab;
// the deck's faction and list in each deck's status.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COPY_LIMITS } from "@ai-tcg/engine";
import { CRAFT_PACK_POINTS, EconomyStore, PACK_POINTS_PER_PACK, cardSet } from "../src/index.js";

const T0 = Date.parse("2026-11-02T10:00:00.000Z");
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => new Date(T0), migrateTo });
const S0 = cardSet("S0");

function ownerWithPacks(s: EconomyStore, n: number, name = `owner-${Math.random()}`) {
  const o = s.createOwner({ name }).ownerId;
  for (let i = 0; i < n; i++) s.grantPack(o, "S0", "weeklyChallenge");
  return o;
}

function generate(s: EconomyStore, ownerId: string, seed: number) {
  const draft = s.startAgentDraft(ownerId, { seed });
  s.pickDraftAgent(ownerId, draft.draftId, 0, { seed: seed + 1000 });
  return s.confirmAgentDraft(ownerId, draft.draftId, 0);
}

describe("the reveal kept as answered (schema v19)", () => {
  it("answers each opening exactly as openPack did, after later packs change the collection", () => {
    const s = open();
    const o = ownerWithPacks(s, 12);
    const first = s.openPack(o, undefined, { seed: 3 });
    const bulk = s.openPacks(o, 10, { seeds: Array.from({ length: 10 }, (_, i) => 100 + i) });
    const last = s.openPack(o, undefined, { seed: 4 });
    // The collection moved on: "x N owned" now differs from what the first pack showed.
    expect(first.cards.some((c) => s.cardHoldings(o, c.cardId).owned > c.ownedAfter)).toBe(true);
    expect(s.packReveal(first.packId)).toEqual(first);
    for (const p of bulk.packs) expect(s.packReveal(p.packId)).toEqual(p);
    expect(s.packReveal(last.packId)).toEqual(last);
    // NEW badges are as of the opening, not now.
    expect(first.cards.some((c) => c.isNew)).toBe(true);
    expect(s.packReveal(first.packId)!.cards.map((c) => c.isNew)).toEqual(first.cards.map((c) => c.isNew));
  });

  it("is written once; an unopened pack has none; a pack opened before v19 answers null", () => {
    const dir = mkdtempSync(join(tmpdir(), "reveal-"));
    const path = join(dir, "s.db");
    const v18 = open(path, 18);
    const o = ownerWithPacks(v18, 3, "old");
    const old = v18.openPack(o, undefined, { seed: 1 });
    v18.close();
    const s = open(path);
    expect(s.schemaVersion).toBe(24);
    expect(s.packReveal(old.packId)).toBeNull();
    // The logged opening itself is still there.
    expect(s.packOpening(old.packId).seed).toBe(1);
    const unopened = s.unopenedPacks(o)[0]!;
    expect(() => s.packReveal(unopened.packId)).toThrow(/hasn't been opened/);
    const fresh = s.openPack(o, unopened.packId, { seed: 2 });
    expect(s.packReveal(fresh.packId)).toEqual(fresh);
    expect(() => s.unsafeExec(`UPDATE pack_reveals SET reveal_json = '{}'`)).toThrow(/written once/);
    expect(() => s.unsafeExec(`DELETE FROM pack_reveals`)).toThrow(/written once/);
    expect(() => s.unsafeExec(`INSERT INTO pack_reveals VALUES ('${s.unopenedPacks(o)[0]!.packId}', '{}')`)).toThrow();
    s.close();
  });
});

describe("the card viewer's craft price and copy limit", () => {
  it("gives each rarity's price and limit, and says why crafting is refused, in craftCard's words", () => {
    const s = open();
    const o = ownerWithPacks(s, 20);
    for (const rarity of ["Common", "Uncommon", "Rare", "Mythic"] as const) {
      const id = S0.cards.find((c) => c.rarity === rarity)!.cardId;
      const h = s.cardHoldings(o, id);
      expect(h.copyLimit).toBe(COPY_LIMITS[rarity]);
      expect(h.craft).toEqual({ packPoints: CRAFT_PACK_POINTS[rarity], available: false, reason: expect.stringMatching(/costs \d+ pack points; you have 0/) });
      expect(() => s.craftCard(o, id)).toThrow(h.craft!.reason!);
    }
    s.openPacks(o, 10, { seeds: Array.from({ length: 10 }, (_, i) => i) });
    s.openPacks(o, 10, { seeds: Array.from({ length: 10 }, (_, i) => 10 + i) });
    expect(s.balance(o, "packPoints")).toBe(20 * PACK_POINTS_PER_PACK);
    // A Common the owner holds fewer than 3 of can be crafted now.
    const commons = S0.cards.filter((c) => c.rarity === "Common").map((c) => c.cardId);
    const craftable = commons.find((id) => s.cardHoldings(o, id).owned < COPY_LIMITS.Common)!;
    expect(s.cardHoldings(o, craftable).craft).toEqual({ packPoints: 40, available: true, reason: null });
    // One at its limit is refused with the reason.
    const full = commons.find((id) => s.cardHoldings(o, id).owned >= COPY_LIMITS.Common);
    if (full) {
      const h = s.cardHoldings(o, full);
      expect(h.craft!.available).toBe(false);
      expect(h.craft!.reason).toMatch(/playable limit of 3/);
      expect(() => s.craftCard(o, full)).toThrow(h.craft!.reason!);
    }
  });

  it("a signature card has no copy limit and no craft; a Zero-Day card plays 1 and crafts as a secret card", () => {
    const s = open();
    const o = s.createOwner({ name: "sig" }).ownerId;
    const { signature } = generate(s, o, 5);
    const sig = s.cardHoldings(o, signature.cardId);
    expect(sig.owned).toBe(1);
    expect([sig.copyLimit, sig.craft]).toEqual([null, null]);
    const zd = S0.secrets.find((x) => x.kind === "zeroDay")!;
    const z = s.cardHoldings(o, zd.cardId);
    expect([z.copyLimit, z.craft]).toEqual([1, null]);
  });
});

describe("the Promos tab", () => {
  it("lists every agent's signature card with the connected one marked, and earned promo copies, newest first", () => {
    const s = open();
    const o = s.createOwner({ name: "promos" }).ownerId;
    const a = generate(s, o, 11);
    const b = generate(s, o, 12);
    s.connectAgent(o, b.agent.agentId);
    const base = S0.cards[0]!.cardId;
    const promo = s.grantCopy({ ownerId: o, cardId: base, origin: "promo", stamp: "10-WIN STREAK", seriesKind: "promo", seriesCode: "PR-900" });
    const { promos } = s.collectionSummary(o);
    expect(promos.signatureCards.map((c) => [c.agentId, c.collectorNumber, c.connected])).toEqual([
      [a.agent.agentId, a.signature.collectorNumber, false],
      [b.agent.agentId, b.signature.collectorNumber, true],
    ]);
    expect(promos.signatureCards[0]).toMatchObject({ agentName: a.agent.name, cardId: a.signature.cardId, name: a.signature.card.name, rarity: "Mythic", copyId: a.copy.copyId, art: a.signature.card.art });
    expect(promos.earned).toEqual([
      { copyId: promo.copyId, cardId: base, name: S0.cards[0]!.name, rarity: S0.cards[0]!.rarity, finish: "standard", origin: "promo", seriesCode: "PR-900", stamp: "10-WIN STREAK", acquiredAt: promo.acquiredAt },
    ]);
    // An owner with nothing earned has empty lists.
    expect(s.collectionSummary(s.createOwner({ name: "none" }).ownerId).promos).toEqual({ signatureCards: [], earned: [] });
  });
});

describe("a deck's faction and list", () => {
  it("names the deck's one faction and lists each card with its copies", () => {
    const s = open();
    const o = s.createOwner({ name: "deck" }).ownerId;
    const { copies } = s.grantStarterCollection(o, "Null");
    const deck = s.saveDeck(o, "Null starter", copies.map((c) => c.copyId));
    const status = s.deckStatus(deck.deckId);
    expect(status.faction).toBe("Null");
    expect(status.list.reduce((t, l) => t + l.copies, 0)).toBe(status.cards);
    const counts = new Map<string, number>();
    for (const c of copies) counts.set(c.cardId, (counts.get(c.cardId) ?? 0) + 1);
    expect(new Map(status.list.map((l) => [l.cardId, l.copies]))).toEqual(counts);
    expect(s.listDecks(o)[0]).toEqual(status);
  });
});
