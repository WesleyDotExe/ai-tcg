// (session 86, hardening) GET /api/matches reads one page by SQL
// (`matchHistoryPage`) and the admin view's `ownerStats` counts four columns,
// instead of loading every match record. Both are checked against the
// whole-history reads they replace, over a history with ties in ended_at
// (several matches recorded at the same instant) and every kind of outcome.

import { describe, expect, it } from "vitest";
import type { DeckFaction } from "@ai-tcg/engine";
import { EconomyStore, type MatchRecord, type OwnerStats } from "../src/index.js";

let clock = new Date("2026-12-05T00:00:00.000Z");
type Side = { ownerId: string; agentId: string; deckId: string };
function owner(store: EconomyStore, name: string, faction: DeckFaction): Side {
  const o = store.createOwner({ name, kind: "player" });
  const { copies } = store.grantStarterCollection(o.ownerId, faction);
  const deck = store.saveDeck(o.ownerId, "starter", copies.map((c) => c.copyId));
  store.setActiveDeck(o.ownerId, deck.deckId);
  const a = store.createAgent({ ownerId: o.ownerId, name: `${name}-agent` });
  store.connectAgent(o.ownerId, a.agentId);
  return { ownerId: o.ownerId, agentId: a.agentId, deckId: deck.deckId };
}

/** Ada plays 3 opponents (and they play each other); every 4th match shares
 * the previous one's ended_at; outcomes cycle through every kind. */
function history(count: number) {
  const store = EconomyStore.open(":memory:", { now: () => clock });
  const [ada, bo, cy, di] = (["Cortex", "Swarm", "Aegis", "Null"] as const).map((f, i) => owner(store, ["Ada", "Bo", "Cy", "Di"][i]!, f));
  const sides = [ada!, bo!, cy!, di!];
  for (let n = 1; n <= count; n++) {
    if (n % 4 !== 0) clock = new Date(clock.getTime() + 60_000);
    const p1 = n % 5 === 0 ? bo! : n % 2 ? ada! : sides[1 + (n % 3)]!;
    const p2 = n % 5 === 0 ? cy! : n % 2 ? sides[1 + (n % 3)]! : ada!;
    const k = n % 6;
    store.recordMatch({
      matchId: `m-${String(n).padStart(4, "0")}`,
      seed: n,
      p1AgentId: p1.agentId,
      p2AgentId: p2.agentId,
      p1DeckId: p1.deckId,
      p2DeckId: p2.deckId,
      turns: 9,
      outcome:
        k < 2
          ? { kind: "win", winnerAgentId: p1.agentId }
          : k < 4
            ? { kind: "win", winnerAgentId: p2.agentId }
            : k === 4
              ? { kind: "draw" }
              : n % 12 === 5
                ? { kind: "abandoned", byAgentId: p1.agentId }
                : { kind: "cancelled" },
    });
  }
  return { store, ada: ada!, bo: bo! };
}

/** The old GET /api/matches: the whole history, reversed, sliced. */
function oldPage(store: EconomyStore, ownerId: string, limit: number, before: string | null) {
  const all = store.matchHistory({ ownerId }).reverse();
  const start = before === null ? 0 : all.findIndex((m) => m.matchId === before) + 1;
  return { matches: all.slice(start, start + limit), total: all.length, more: start + limit < all.length };
}

/** The old ownerStats: counted from whole match records. */
function oldOwnerStats(store: EconomyStore, ownerId: string, agentId?: string): OwnerStats {
  const s: OwnerStats = { matches: 0, wins: 0, losses: 0, draws: 0, void: 0, winRate: 0, bestWinStreak: 0, creditsFromMatches: 0 };
  let streak = 0;
  for (const m of store.matchHistory({ ownerId, agentId })) {
    s.matches++;
    s.creditsFromMatches += m.p1OwnerId === ownerId ? m.p1Credits : m.p2Credits;
    if (m.outcome === "cancelled" || m.outcome === "abandoned") s.void++;
    else if (m.outcome === "draw") (s.draws++, (streak = 0));
    else if (m.winnerOwnerId === ownerId) (s.wins++, streak++, (s.bestWinStreak = Math.max(s.bestWinStreak, streak)));
    else (s.losses++, (streak = 0));
  }
  const decided = s.wins + s.losses + s.draws;
  s.winRate = decided === 0 ? 0 : s.wins / decided;
  return s;
}

describe("matchHistoryPage (GET /api/matches by SQL)", () => {
  it("walks the whole history page by page exactly as the old in-memory slice did, ties included", () => {
    const { store, ada, bo } = history(157);
    for (const side of [ada, bo]) {
      for (const limit of [1, 7, 20, 100]) {
        let before: string | null = null;
        const seen: MatchRecord[] = [];
        for (;;) {
          const page = store.matchHistoryPage(side.ownerId, { limit, before });
          expect(page).toEqual(oldPage(store, side.ownerId, limit, before));
          seen.push(...page.matches);
          if (!page.more) break;
          before = page.matches.at(-1)!.matchId;
        }
        expect(seen.map((m) => m.matchId)).toEqual(store.matchHistory({ ownerId: side.ownerId }).reverse().map((m) => m.matchId));
      }
    }
  });

  it("refuses a `before` that isn't one of the owner's matches, and a page under 1", () => {
    const { store, ada } = history(20);
    const notAdas = store.matchHistory().find((m) => m.p1OwnerId !== ada.ownerId && m.p2OwnerId !== ada.ownerId)!;
    expect(() => store.matchHistoryPage(ada.ownerId, { limit: 5, before: "m-nope" })).toThrow(/isn't one of this owner's matches/);
    expect(() => store.matchHistoryPage(ada.ownerId, { limit: 5, before: notAdas.matchId })).toThrow(/isn't one of this owner's matches/);
    expect(() => store.matchHistoryPage(ada.ownerId, { limit: 0 })).toThrow(/at least 1/);
  });

  it("an owner with no matches gets an empty page", () => {
    const { store } = history(0);
    const nobody = store.createOwner({ name: "Ed", kind: "player" });
    expect(store.matchHistoryPage(nobody.ownerId, { limit: 20 })).toEqual({ matches: [], total: 0, more: false });
  });
});

describe("ownerStats counted from four columns", () => {
  it("is the old whole-record count, for every owner, all agents and one", () => {
    const { store } = history(157);
    for (const o of store.listOwners()) {
      expect(store.ownerStats(o.ownerId)).toEqual(oldOwnerStats(store, o.ownerId));
      for (const a of store.listAgents(o.ownerId)) expect(store.ownerStats(o.ownerId, { agentId: a.agentId })).toEqual(oldOwnerStats(store, o.ownerId, a.agentId));
    }
    expect(store.ownerStats(store.listOwners()[0]!.ownerId).void).toBeGreaterThan(0);
  });
});

// (session 87) The ladder's pairing reads each owner's last two opponents
// every round; it read the whole history for them until this session.
/** The old read (ladderRunner's recentOpponents before session 87). */
function oldRecentOpponents(store: EconomyStore, ownerId: string, count: number): string[] {
  return store
    .matchHistory({ ownerId })
    .slice(-count)
    .reverse()
    .map((m) => (m.p1OwnerId === ownerId ? m.p2OwnerId : m.p1OwnerId));
}

describe("recentOpponents by SQL", () => {
  it("is the old whole-history read, for every owner, after every match, at counts 1-3", () => {
    // Re-read after each match: ties in ended_at (every 4th), either seat,
    // cancels and abandons counted the same as before.
    for (const total of [1, 2, 3, 4, 5, 8, 12, 25, 60]) {
      const { store } = history(total);
      for (const o of store.listOwners()) {
        for (const count of [1, 2, 3]) expect(store.recentOpponents(o.ownerId, count)).toEqual(oldRecentOpponents(store, o.ownerId, count));
      }
    }
  });

  it("is newest first: the match recorded last at a tied ended_at comes first", () => {
    const { store, ada } = history(8); // m-0004 and m-0008 share the previous match's ended_at
    const mine = store.matchHistory({ ownerId: ada.ownerId });
    const other = (m: MatchRecord) => (m.p1OwnerId === ada.ownerId ? m.p2OwnerId : m.p1OwnerId);
    expect(mine[mine.length - 1]!.endedAt).toBe(mine[mine.length - 2]!.endedAt);
    expect(store.recentOpponents(ada.ownerId, 2)).toEqual([other(mine[mine.length - 1]!), other(mine[mine.length - 2]!)]);
  });

  it("an owner with no matches has none; 0 asks for none; a count that isn't whole is refused", () => {
    const { store, ada } = history(5);
    const nobody = store.createOwner({ name: "Ed", kind: "player" });
    expect(store.recentOpponents(nobody.ownerId, 2)).toEqual([]);
    expect(store.recentOpponents(ada.ownerId, 0)).toEqual([]);
    expect(() => store.recentOpponents(ada.ownerId, 1.5)).toThrow(/whole number/);
    expect(() => store.recentOpponents(ada.ownerId, -1)).toThrow(/whole number/);
  });
});
