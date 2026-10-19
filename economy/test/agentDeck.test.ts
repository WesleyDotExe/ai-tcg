// The deck-building agent in the store (schema v12; roadmap 2b, owner
// 2026-10-15: "the owner can force a specific deck or faction. Otherwise the
// agent picks the best faction and deck it can build from the cards the
// owner holds"): the deck choice, the agent's deck rebuilt in place, the
// faction lock as the forced faction, and the migration.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SHIPPED_DECK_LISTS, deckFaction } from "@ai-tcg/engine";
import { AGENT_DECK_NAME, EconomyStore } from "../src/index.js";

let clock = new Date("2026-10-19T10:00:00.000Z");
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo });
const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmpFile = () => {
  const d = mkdtempSync(join(tmpdir(), "ai-tcg-agentdeck-"));
  tmpDirs.push(d);
  return join(d, "s0.db");
};
/** No games: the first deck and a rating pick (fast enough for every test). */
const FAST = { games: 0 };

function owner(s: EconomyStore, name: string, faction: "Cortex" | "Swarm" | "Aegis" | "Null") {
  const o = s.createOwner({ name, kind: "house" });
  s.grantStarterCollection(o.ownerId, faction);
  const agent = s.createAgent({ ownerId: o.ownerId, name: `${name}-a` });
  s.connectAgent(o.ownerId, agent.agentId);
  return o.ownerId;
}

/** Grants `ownerId` a pack copy of every card in a faction's shipped list. */
function grantList(s: EconomyStore, ownerId: string, faction: "Cortex" | "Swarm" | "Aegis" | "Null") {
  for (const { cardId, copies } of SHIPPED_DECK_LISTS[faction]) {
    for (let i = 0; i < copies; i++) s.grantCopy({ ownerId, cardId, origin: "pack", originRef: "test" });
  }
}

describe("the agent's deck", () => {
  it("is the default: a new owner's agent builds its deck from the owner's cards and plays it", async () => {
    const s = open();
    const a = owner(s, "a", "Swarm");
    const b = owner(s, "b", "Null");
    expect(s.getOwner(a).deckChoice).toBe("agent");
    expect(() => s.startMatch({ matchId: "m0", p1OwnerId: a, p2OwnerId: b })).toThrow(/the agent hasn't built one yet/);

    const built = await s.buildAgentDeck(a, FAST);
    expect(built.faction).toBe("Swarm");
    expect(built.factions.filter((f) => f.infeasible).map((f) => f.faction)).toEqual(["Cortex", "Aegis", "Null"]);
    expect(built.deck.name).toBe(AGENT_DECK_NAME);
    expect(s.agentDeckId(a)).toBe(built.deck.deckId);
    expect(s.getOwner(a).activeDeckId).toBe(built.deck.deckId);
    expect(s.deckStatus(built.deck.deckId)).toMatchObject({ complete: true, active: true });
    // Every copy is the owner's own.
    const mine = new Set(s.collection(a).map((c) => c.copyId));
    expect(built.deck.copyIds.every((id) => mine.has(id))).toBe(true);

    await s.buildAgentDeck(b, FAST);
    const live = s.startMatch({ matchId: "m1", p1OwnerId: a, p2OwnerId: b });
    expect(deckFaction(live.p1.deck.spec.cards)).toBe("Swarm");
    expect(deckFaction(live.p2.deck.spec.cards)).toBe("Null");
  });

  it("is rebuilt in place when the holdings change, and may change faction", async () => {
    const s = open();
    const a = owner(s, "a", "Swarm");
    const first = await s.buildAgentDeck(a, FAST);
    grantList(s, a, "Aegis");
    grantList(s, a, "Cortex");
    const again = await s.buildAgentDeck(a, FAST);
    expect(again.deck.deckId).toBe(first.deck.deckId);
    expect(s.listDecks(a)).toHaveLength(1);
    expect(again.factions.filter((f) => !f.infeasible).map((f) => f.faction)).toEqual(["Cortex", "Swarm", "Aegis"]);
    expect(deckFaction(s.loadDeck(again.deck.deckId).spec.cards)).toBe(again.faction);
  });

  it("builds in the faction lock (the owner's forced faction)", async () => {
    const s = open();
    const a = owner(s, "a", "Swarm");
    grantList(s, a, "Aegis");
    s.setFactionLock(a, "Aegis");
    const built = await s.buildAgentDeck(a, FAST);
    expect(built.faction).toBe("Aegis");
    expect(built.factions.map((f) => f.faction)).toEqual(["Aegis"]);
    // A lock it can't build in is refused, saying why.
    s.setFactionLock(a, "Null");
    await expect(s.buildAgentDeck(a, FAST)).rejects.toThrow(/no deck can be built: Null/);
  });

  it("gives way to a forced deck, and comes back when the choice goes back to the agent", async () => {
    const s = open();
    const a = owner(s, "a", "Cortex");
    const built = await s.buildAgentDeck(a, FAST);
    const hand = s.saveDeck(a, "by hand", s.collection(a).map((c) => c.copyId));
    s.setActiveDeck(a, hand.deckId);
    expect(s.getOwner(a)).toMatchObject({ deckChoice: "forced", activeDeckId: hand.deckId });
    await expect(s.buildAgentDeck(a, FAST)).rejects.toThrow(/forces a deck/);

    s.setDeckChoice(a, "agent");
    expect(s.getOwner(a)).toMatchObject({ deckChoice: "agent", activeDeckId: built.deck.deckId });
    s.setDeckChoice(a, "forced");
    expect(s.getOwner(a)).toMatchObject({ deckChoice: "forced", activeDeckId: built.deck.deckId });

    // Back to the agent with a lock its deck doesn't fit: nothing is active
    // until it rebuilds.
    s.setDeckChoice(a, "agent");
    grantList(s, a, "Null");
    s.setFactionLock(a, "Null");
    s.setDeckChoice(a, "agent");
    expect(s.getOwner(a).activeDeckId).toBeNull();
    expect((await s.buildAgentDeck(a, FAST)).faction).toBe("Null");
    expect(s.getOwner(a).activeDeckId).toBe(s.agentDeckId(a));
  });

  it("refuses forcing with no active deck, and an unknown choice", () => {
    const s = open();
    const a = owner(s, "a", "Cortex");
    expect(() => s.setDeckChoice(a, "forced")).toThrow(/no active deck to force/);
    expect(() => s.setDeckChoice(a, "random" as "agent")).toThrow(/unknown deck choice/);
  });

  it("keeps one agent deck per owner in the schema", async () => {
    const s = open();
    const a = owner(s, "a", "Cortex");
    await s.buildAgentDeck(a, FAST);
    const other = s.saveDeck(a, "another", s.collection(a).map((c) => c.copyId));
    expect(() => s.unsafeExec(`UPDATE decks SET built_by_agent = 1 WHERE deck_id = '${other.deckId}'`)).toThrow(/UNIQUE/);
  });

  it("searches with games when asked, and reports each faction's fresh-seed win rate", async () => {
    const s = open();
    const a = owner(s, "a", "Aegis");
    const built = await s.buildAgentDeck(a, { games: 2, trials: 2, confirmGames: 2 });
    const aegis = built.factions.find((f) => f.faction === "Aegis")!;
    expect(aegis.winRate).toBeGreaterThanOrEqual(0);
    expect(aegis.winRate).toBeLessThanOrEqual(1);
    expect(s.deckStatus(built.deck.deckId).complete).toBe(true);
  });
});

describe("migration v11 -> v12", () => {
  it("keeps a hand-picked active deck as forced; everyone else gets the agent", () => {
    const path = tmpFile();
    const v11 = open(path, 11);
    const picked = v11.createOwner({ name: "picked" });
    const { copies } = v11.grantStarterCollection(picked.ownerId, "Swarm");
    const deck = v11.saveDeck(picked.ownerId, "mine", copies.map((c) => c.copyId));
    // v11's setActiveDeck, as SQL (today's also writes the v12 column).
    v11.unsafeExec(`UPDATE owners SET active_deck_id = '${deck.deckId}' WHERE owner_id = '${picked.ownerId}'`);
    const fresh = v11.createOwner({ name: "fresh" });
    v11.close();

    const v12 = open(path);
    expect(v12.schemaVersion).toBe(12);
    expect(v12.getOwner(picked.ownerId)).toMatchObject({ deckChoice: "forced", activeDeckId: deck.deckId });
    expect(v12.getOwner(fresh.ownerId).deckChoice).toBe("agent");
    expect(v12.agentDeckId(picked.ownerId)).toBeNull();
    v12.close();
  });
});
