// The agent's deck in the agent's play style (schema v14; owner 2026-10-20,
// call 6: "the deck builder still builds with Calculator; making it use the
// agent's style is the next step"). The deck is measured in the connected
// agent's style, remembers what it was built from (style, faction lock, the
// cards held), and the store names why it needs a rebuild when any of those
// change (owner 2026-10-15: rebuilt when they change, not before every match).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CARD_REGISTRY, SHIPPED_DECK_LISTS, chooseDeck, getCard, holdingsOf, largestDeck, playableCopies } from "@ai-tcg/engine";
import { EconomyStore, holdingsFingerprint, playableHoldingsFingerprint } from "../src/index.js";

let clock = new Date("2026-10-20T10:00:00.000Z");
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo });
const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmpFile = () => {
  const d = mkdtempSync(join(tmpdir(), "ai-tcg-deckstyle-"));
  tmpDirs.push(d);
  return join(d, "s0.db");
};
const FAST = { games: 0 };

function owner(s: EconomyStore, name: string, faction: "Cortex" | "Swarm" | "Aegis" | "Null") {
  const o = s.createOwner({ name, kind: "house" });
  s.grantStarterCollection(o.ownerId, faction);
  const agent = s.createAgent({ ownerId: o.ownerId, name: `${name}-a` });
  s.connectAgent(o.ownerId, agent.agentId);
  return { ownerId: o.ownerId, agentId: agent.agentId };
}

function grantList(s: EconomyStore, ownerId: string, faction: "Cortex" | "Swarm" | "Aegis" | "Null") {
  for (const { cardId, copies } of SHIPPED_DECK_LISTS[faction]) {
    for (let i = 0; i < copies; i++) s.grantCopy({ ownerId, cardId, origin: "pack", originRef: "test" });
  }
}

describe("the agent's deck in the agent's style", () => {
  it("is measured in the connected agent's style: the same games chooseDeck plays in that style", async () => {
    const s = open();
    const { ownerId, agentId } = owner(s, "a", "Swarm");
    s.setPlayStyle(ownerId, agentId, "rusher");
    const opts = { games: 3, trials: 2, confirmGames: 3 };
    const built = await s.buildAgentDeck(ownerId, opts);
    expect(built.style).toBe("rusher");

    const holdings = holdingsOf(s.collection(ownerId).map((c) => c.cardId));
    const rusher = await chooseDeck(holdings, { ...opts, style: "rusher" });
    const calculator = await chooseDeck(holdings, { ...opts, style: "calculator" });
    const swarm = (b: typeof rusher) => b.factions.find((f) => f.faction === "Swarm")!;
    const stored = built.factions.find((f) => f.faction === "Swarm")!;
    expect(stored.winRate).toBe(swarm(rusher).score!.wins / swarm(rusher).score!.games);
    expect(stored.starts).toEqual(swarm(rusher).starts.map((st) => ({ from: st.from, winRate: st.score!.wins / st.score!.games })));
    // And the style reached the games: Calculator's games came out differently.
    const results = (b: typeof rusher) => [swarm(b).score!.wins, ...swarm(b).starts.map((st) => st.score!.wins)];
    expect(results(rusher)).not.toEqual(results(calculator));
  });

  it("remembers what it was built from, and is up to date right after a build", async () => {
    const s = open();
    const { ownerId, agentId } = owner(s, "a", "Cortex");
    s.setPlayStyle(ownerId, agentId, "fortress");
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the agent hasn't built a deck yet"]);
    const built = await s.buildAgentDeck(ownerId, FAST);
    expect(built.style).toBe("fortress");
    expect(s.agentDeckBuiltFrom(ownerId)).toEqual({
      style: "fortress",
      factionLock: null,
      holdings: playableHoldingsFingerprint(s.collection(ownerId).map((c) => c.cardId), null),
    });
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
    expect(await s.rebuildAgentDeckIfNeeded(ownerId, FAST)).toBeNull();
  });

  it("names a style change, rebuilds in the new style, then is up to date", async () => {
    const s = open();
    const { ownerId, agentId } = owner(s, "a", "Null");
    const first = await s.buildAgentDeck(ownerId, FAST);
    expect(first.style).toBe("calculator");
    s.setPlayStyle(ownerId, agentId, "controller");
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the play style changed (Calculator -> Controller)"]);
    const again = await s.rebuildAgentDeckIfNeeded(ownerId, FAST);
    expect(again!.reasons).toEqual(["the play style changed (Calculator -> Controller)"]);
    expect(again!.build.style).toBe("controller");
    expect(again!.build.deck.deckId).toBe(first.deck.deckId);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
  });

  it("follows the connected agent: switching to an agent of another style, or none, is a style change", async () => {
    const s = open();
    const { ownerId } = owner(s, "a", "Aegis");
    const gambler = s.createAgent({ ownerId, name: "a-gambler" });
    s.setPlayStyle(gambler.ownerId, gambler.agentId, "gambler");
    const same = s.createAgent({ ownerId, name: "a-calc" });
    await s.buildAgentDeck(ownerId, FAST);

    s.connectAgent(ownerId, same.agentId);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
    s.connectAgent(ownerId, gambler.agentId);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the play style changed (Calculator -> Gambler)"]);
    expect((await s.buildAgentDeck(ownerId, FAST)).style).toBe("gambler");
    s.disconnectAgent(ownerId);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the play style changed (Gambler -> Calculator)"]);
  });

  it("names a change in the cards held and in the faction lock, together", async () => {
    const s = open();
    const { ownerId } = owner(s, "a", "Swarm");
    await s.buildAgentDeck(ownerId, FAST);
    grantList(s, ownerId, "Aegis");
    s.setFactionLock(ownerId, "Aegis");
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the cards held changed", "the faction lock changed (none -> Aegis)"]);
    const r = await s.rebuildAgentDeckIfNeeded(ownerId, FAST);
    expect(r!.build.faction).toBe("Aegis");
    expect(s.agentDeckBuiltFrom(ownerId)!.factionLock).toBe("Aegis");
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
    // Only the cards' counts matter, not which copy or its finish; and only
    // cards the deck could use (below).
    const { cardId } = SHIPPED_DECK_LISTS.Aegis.find((e) => heldBelowLimit(s, ownerId, e.cardId))!;
    s.grantCopy({ ownerId, cardId, origin: "pack", originRef: "t" });
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the cards held changed"]);
  });

  it("asks nothing while the owner forces a deck; a hand edit forgets what it was built from", async () => {
    const s = open();
    const { ownerId, agentId } = owner(s, "a", "Cortex");
    const built = await s.buildAgentDeck(ownerId, FAST);
    const hand = s.saveDeck(ownerId, "by hand", s.collection(ownerId).map((c) => c.copyId));
    s.setActiveDeck(ownerId, hand.deckId);
    s.setPlayStyle(ownerId, agentId, "tempo");
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
    expect(await s.rebuildAgentDeckIfNeeded(ownerId, FAST)).toBeNull();

    s.setDeckChoice(ownerId, "agent");
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the play style changed (Calculator -> Tempo)"]);
    s.updateDeck(ownerId, built.deck.deckId, built.deck.copyIds.slice(0, 30));
    expect(s.agentDeckBuiltFrom(ownerId)).toBeNull();
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the store doesn't know what the deck was built from (built before v14, or edited by hand)"]);
  });
});

/** Copies of a card the owner holds. */
const held = (s: EconomyStore, ownerId: string, cardId: string) => s.collection(ownerId).filter((c) => c.cardId === cardId).length;
/** Whether one more copy could still go in a deck. */
const heldBelowLimit = (s: EconomyStore, ownerId: string, cardId: string) =>
  playableCopies(getCard(cardId)!, held(s, ownerId, cardId) + 1) > held(s, ownerId, cardId);
const pack = (s: EconomyStore, ownerId: string, cardId: string) => s.grantCopy({ ownerId, cardId, origin: "pack", originRef: "t" });

describe("'the cards held changed' counts only cards the deck could use (session 55)", () => {
  it("under a lock: a spare past a card's limit or another faction's card is no reason; a usable copy is", async () => {
    const s = open();
    const { ownerId } = owner(s, "a", "Aegis");
    grantList(s, ownerId, "Aegis");
    s.setFactionLock(ownerId, "Aegis");
    await s.buildAgentDeck(ownerId, FAST);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);

    // A copy past the limit of a card already held to it.
    const full = SHIPPED_DECK_LISTS.Aegis.find((e) => !heldBelowLimit(s, ownerId, e.cardId))!.cardId;
    pack(s, ownerId, full);
    // A card the lock rules out.
    pack(s, ownerId, SHIPPED_DECK_LISTS.Swarm[0]!.cardId);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
    expect(await s.rebuildAgentDeckIfNeeded(ownerId, FAST)).toBeNull();

    // A Neutral card the deck could use.
    const neutral = [...CARD_REGISTRY.values()].find((c) => c.faction === "Neutral" && held(s, ownerId, c.id) === 0)!;
    pack(s, ownerId, neutral.id);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the cards held changed"]);
    await s.rebuildAgentDeckIfNeeded(ownerId, FAST);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);

    // Lifting the lock: every faction is usable again, so the Swarm card
    // counts, but the lock change is the reason named (the cards are read
    // under the lock the deck was built with).
    s.setFactionLock(ownerId, null);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the faction lock changed (Aegis -> none)"]);
  });

  it("with no lock: any faction's card is a reason, a spare past the limit is not", async () => {
    const s = open();
    const { ownerId } = owner(s, "a", "Cortex");
    grantList(s, ownerId, "Cortex");
    await s.buildAgentDeck(ownerId, FAST);
    pack(s, ownerId, SHIPPED_DECK_LISTS.Cortex.find((e) => !heldBelowLimit(s, ownerId, e.cardId))!.cardId);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
    pack(s, ownerId, SHIPPED_DECK_LISTS.Null[0]!.cardId);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the cards held changed"]);
  });

  it("a salvage that leaves the agent's deck short is always a reason", async () => {
    const s = open();
    const { ownerId } = owner(s, "a", "Swarm");
    grantList(s, ownerId, "Swarm");
    s.setFactionLock(ownerId, "Swarm");
    const built = await s.buildAgentDeck(ownerId, FAST);
    // A card the deck plays at its full limit, with salvageable pack copies.
    const inDeck = new Map<string, number>();
    for (const c of s.collection(ownerId)) if (built.deck.copyIds.includes(c.copyId)) inDeck.set(c.cardId, (inDeck.get(c.cardId) ?? 0) + 1);
    const cardId = [...inDeck].find(([id, n]) => n === held(s, ownerId, id) && s.cardHoldings(ownerId, id).salvageable > 0)![0];
    s.salvage(ownerId, cardId, 1, { confirmDeckImpact: true });
    expect(s.deckStatus(built.deck.deckId).complete).toBe(false);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the cards held changed"]);
    await s.rebuildAgentDeckIfNeeded(ownerId, FAST);
    expect(s.deckStatus(built.deck.deckId).complete).toBe(true);
  });

  it("a deck built before session 55 is read with the fingerprint it recorded, every card counted", async () => {
    const s = open();
    const { ownerId } = owner(s, "a", "Aegis");
    grantList(s, ownerId, "Aegis");
    s.setFactionLock(ownerId, "Aegis");
    const built = await s.buildAgentDeck(ownerId, FAST);
    const legacy = holdingsFingerprint(s.collection(ownerId).map((c) => c.cardId));
    s.unsafeExec(`UPDATE decks SET built_holdings = '${legacy}' WHERE deck_id = '${built.deck.deckId}'`);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
    // The old rule asked for a rebuild on any card; it still does, once.
    pack(s, ownerId, SHIPPED_DECK_LISTS.Swarm[0]!.cardId);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the cards held changed"]);
    await s.rebuildAgentDeckIfNeeded(ownerId, FAST);
    expect(s.agentDeckBuiltFrom(ownerId)!.holdings).toMatch(/^p:/);
    pack(s, ownerId, SHIPPED_DECK_LISTS.Swarm[0]!.cardId);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
  });
});

describe("migration v13 -> v14", () => {
  it("leaves an agent deck built before v14 unknown (so it is rebuilt), and the schema guards the columns", async () => {
    const path = tmpFile();
    const v13 = open(path, 13);
    const { ownerId } = owner(v13, "a", "Swarm");
    const built = await v13.buildAgentDeck(ownerId, FAST);
    expect(built.style).toBe("calculator");
    expect(v13.agentDeckBuiltFrom(ownerId)).toBeNull();
    expect(() => v13.agentDeckRebuildReasons(ownerId)).toThrow(/needs schema v14/);
    const hand = v13.saveDeck(ownerId, "by hand", v13.collection(ownerId).map((c) => c.copyId));
    v13.close();

    const v14 = open(path, 14);
    expect(v14.schemaVersion).toBe(14);
    expect(v14.agentDeckId(ownerId)).toBe(built.deck.deckId);
    expect(v14.agentDeckRebuildReasons(ownerId)).toEqual(["the store doesn't know what the deck was built from (built before v14, or edited by hand)"]);
    // Only the agent's deck carries a build record, and all three fields go together.
    expect(() => v14.unsafeExec(`UPDATE decks SET built_style = 'rusher', built_lock = 'none', built_holdings = 'x' WHERE deck_id = '${hand.deckId}'`)).toThrow(/CHECK/);
    expect(() => v14.unsafeExec(`UPDATE decks SET built_style = 'rusher' WHERE deck_id = '${built.deck.deckId}'`)).toThrow(/CHECK/);
    expect(() => v14.unsafeExec(`UPDATE decks SET built_style = 'bold', built_lock = 'none', built_holdings = 'x' WHERE deck_id = '${built.deck.deckId}'`)).toThrow(/CHECK/);
    expect(() => v14.unsafeExec(`UPDATE decks SET built_style = 'rusher', built_lock = 'Neutral', built_holdings = 'x' WHERE deck_id = '${built.deck.deckId}'`)).toThrow(/CHECK/);
    await v14.rebuildAgentDeckIfNeeded(ownerId, FAST);
    expect(v14.agentDeckRebuildReasons(ownerId)).toEqual([]);
    v14.close();
  });
});

describe("the deck chooser runs elsewhere (session 56: the server's worker thread)", () => {
  function packOwner(s: EconomyStore) {
    const o = s.createOwner({ name: "p", kind: "house" });
    grantList(s, o.ownerId, "Swarm");
    const agent = s.createAgent({ ownerId: o.ownerId, name: "p-a" });
    s.connectAgent(o.ownerId, agent.agentId);
    return o.ownerId;
  }

  it("builds with the chooser it is given, on the same holdings and options chooseDeck would get", async () => {
    const s = open();
    const ownerId = packOwner(s);
    s.setFactionLock(ownerId, "Swarm");
    const calls: { holdings: [string, number][]; options: object }[] = [];
    const built = await s.buildAgentDeck(ownerId, FAST, async (holdings, options) => {
      calls.push({ holdings: [...holdings], options });
      return chooseDeck(holdings, options);
    });
    expect(calls).toEqual([{ holdings: [...holdingsOf(s.collection(ownerId).map((c) => c.cardId))], options: { games: 0, faction: "Swarm", style: "calculator" } }]);
    expect(built.deck.deckId).toBe(s.agentDeckId(ownerId));
  });

  it("refuses to save when the cards held changed while the agent built, and saves nothing", async () => {
    const s = open();
    const ownerId = packOwner(s);
    const before = s.collection(ownerId).length;
    const salvaging = async (holdings: Parameters<typeof chooseDeck>[0], options: Parameters<typeof chooseDeck>[1]) => {
      const built = await chooseDeck(holdings, options);
      // The owner salvages every copy of one card the deck uses, mid-build.
      const [cardId, n] = [...built.list][0]!;
      s.salvage(ownerId, cardId, n, { confirmDeckImpact: true });
      return built;
    };
    await expect(s.buildAgentDeck(ownerId, FAST, salvaging)).rejects.toThrow(/the cards held changed while the agent built \(.+ \(uses \d, holds 0\)\); build again/);
    expect(s.agentDeckId(ownerId)).toBeNull();
    expect(s.collection(ownerId).length).toBeLessThan(before);
    // Built again from what is held now, it saves.
    await s.buildAgentDeck(ownerId, FAST);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
  });

  it("saves a deck as large as the cards held allow, and refuses a shorter one (owner 2026-10-26, option B)", async () => {
    const s = open();
    const ownerId = packOwner(s);
    const holdings = holdingsOf(s.collection(ownerId).map((c) => c.cardId));
    // A stand-in chooser that cuts the engine's deck by one card.
    const cutting = async (h: Parameters<typeof chooseDeck>[0], options: Parameters<typeof chooseDeck>[1]) => {
      const built = await chooseDeck(h, options);
      const list = new Map(built.list);
      const [cardId, n] = [...list].find(([id]) => getCard(id)!.type !== "Unit")!;
      if (n > 1) list.set(cardId, n - 1);
      else list.delete(cardId);
      return { ...built, list };
    };
    await expect(s.buildAgentDeck(ownerId, FAST, cutting)).rejects.toThrow(/the agent built \d+ cards; the cards held allow \d+/);
    expect(s.agentDeckId(ownerId)).toBeNull();
    const built = await s.buildAgentDeck(ownerId, FAST);
    expect(built.deck.copyIds.length).toBe(largestDeck(built.faction, holdings));
  });

  it("names a deck shorter than the cards held allow (built before option B) as a rebuild reason", async () => {
    const s = open();
    const ownerId = packOwner(s);
    const built = await s.buildAgentDeck(ownerId, FAST);
    const allow = built.deck.copyIds.length;
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
    // Stand in for a deck the builder cut short before session 58: one copy
    // fewer, what it was built from unchanged.
    const db = (s as unknown as { db: { prepare(sql: string): { run(...a: unknown[]): unknown } } }).db;
    db.prepare("DELETE FROM deck_copies WHERE rowid = (SELECT MAX(rowid) FROM deck_copies WHERE deck_id = ?)").run(built.deck.deckId);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([`the deck has ${allow - 1} cards and the cards held allow ${allow} (the agent builds to that since session 58)`]);
    const again = await s.rebuildAgentDeckIfNeeded(ownerId, FAST);
    expect(again!.build.deck.copyIds.length).toBe(allow);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
  });
});
