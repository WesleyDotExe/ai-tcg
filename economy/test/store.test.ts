import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SHIPPED_DECK_LISTS } from "@ai-tcg/engine";
import { EconomyError, EconomyStore, PACK_PRICE_CREDITS } from "../src/index.js";

const DAY1 = "2026-10-05T10:00:00.000Z";
let clock = new Date(DAY1);
const open = (path = ":memory:") => EconomyStore.open(path, { now: () => clock });
const tmpDirs: string[] = [];
afterEach(() => {
  clock = new Date(DAY1);
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function starter(store: EconomyStore, agentId: string, faction: keyof typeof SHIPPED_DECK_LISTS) {
  return store.grantCopies(
    SHIPPED_DECK_LISTS[faction].flatMap(({ cardId, copies }) =>
      Array.from({ length: copies }, () => ({ ownerId: agentId, cardId, source: "starter" as const })),
    ),
  );
}

function win(store: EconomyStore, matchId: string, winner: string, loser: string, endedAt = DAY1) {
  return store.recordMatch({ matchId, seed: 1, p1AgentId: winner, p2AgentId: loser, outcome: { kind: "win", winnerAgentId: winner }, endedAt });
}

describe("EconomyStore: schema and persistence", () => {
  it("creates the schema at v1 for Season 0, and survives close + reopen from its file", () => {
    const dir = mkdtempSync(join(tmpdir(), "economy-"));
    tmpDirs.push(dir);
    const path = join(dir, "season.db");
    const a = open(path);
    expect(a.schemaVersion).toBe(1);
    expect(a.season).toBe("S0");
    const alpha = a.createAgent({ name: "alpha", faction: "Cortex" });
    const beta = a.createAgent({ name: "beta", faction: "Swarm" });
    const copies = starter(a, alpha.agentId, "Cortex");
    win(a, "m1", alpha.agentId, beta.agentId);
    a.close();

    const b = open(path);
    expect(b.schemaVersion).toBe(1);
    expect(b.listAgents().map((x) => x.name)).toEqual(["alpha", "beta"]);
    expect(b.balance(alpha.agentId)).toBe(40);
    expect(b.balance(beta.agentId)).toBe(2);
    expect(b.collection(alpha.agentId).map((c) => c.copyId)).toEqual(copies.map((c) => c.copyId));
    expect(b.matchHistory()).toHaveLength(1);
    b.close();
  });
});

describe("EconomyStore: the ledger", () => {
  it("is append-only: UPDATE and DELETE are refused by the schema itself", () => {
    const s = open();
    const a = s.createAgent({ name: "a" });
    const b = s.createAgent({ name: "b" });
    win(s, "m1", a.agentId, b.agentId);
    expect(() => s.unsafeExec("UPDATE ledger SET delta = 9999")).toThrow(/append-only/);
    expect(() => s.unsafeExec("DELETE FROM ledger")).toThrow(/append-only/);
    expect(s.balance(a.agentId)).toBe(40);
  });

  it("refuses any entry that would take a balance below zero, even raw SQL", () => {
    const s = open();
    const a = s.createAgent({ name: "a" });
    expect(() =>
      s.unsafeExec(`INSERT INTO ledger (agent_id, currency, delta, reason, created_at) VALUES ('${a.agentId}', 'credits', -1, 'x', '${DAY1}')`),
    ).toThrow(/insufficient balance/);
  });

  it("pays the daily win schedule from match history, and stops paying after the 10th win", () => {
    const s = open();
    const a = s.createAgent({ name: "a" });
    const b = s.createAgent({ name: "b" });
    const paid = Array.from({ length: 12 }, (_, i) => win(s, `m${i}`, a.agentId, b.agentId).p1Credits);
    expect(paid).toEqual([40, 15, 15, 15, 5, 5, 5, 5, 5, 5, 0, 0]);
    expect(s.balance(a.agentId)).toBe(115);
    // b lost 12: losses pay 2 each up to the 10-loss cap.
    expect(s.balance(b.agentId)).toBe(20);
    // A new UTC day resets the schedule.
    expect(win(s, "next-day", a.agentId, b.agentId, "2026-10-06T00:00:01.000Z").p1Credits).toBe(40);
    // Zero-credit matches are in history but write no ledger entry.
    expect(s.ledger(a.agentId).filter((e) => e.reason === "matchWin")).toHaveLength(11);
    expect(s.matchHistory(a.agentId)).toHaveLength(13);
  });

  it("counts the day in UTC whatever offset the end time is written with", () => {
    const s = open();
    const a = s.createAgent({ name: "a" });
    const b = s.createAgent({ name: "b" });
    win(s, "m1", a.agentId, b.agentId, "2026-10-05T23:30:00.000Z");
    // 01:30 on the 6th in +02:00 is 23:30 UTC on the 5th: same day, 2nd win.
    expect(win(s, "m2", a.agentId, b.agentId, "2026-10-06T01:30:00+02:00").p1Credits).toBe(15);
  });

  it("pays nothing to either side for a cancelled or abandoned match, and the schema forbids otherwise", () => {
    const s = open();
    const a = s.createAgent({ name: "a" });
    const b = s.createAgent({ name: "b" });
    const c = s.recordMatch({ matchId: "c", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "cancelled" } });
    const ab = s.recordMatch({ matchId: "ab", seed: 2, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "abandoned", byAgentId: b.agentId } });
    expect([c.p1Credits, c.p2Credits, ab.p1Credits, ab.p2Credits]).toEqual([0, 0, 0, 0]);
    expect(s.balance(a.agentId) + s.balance(b.agentId)).toBe(0);
    expect(() =>
      s.unsafeExec(
        `INSERT INTO matches (match_id, seed, p1_agent, p2_agent, outcome, p1_credits, p2_credits, ended_at)
         VALUES ('bad', 1, '${a.agentId}', '${b.agentId}', 'cancelled', 5, 0, '${DAY1}')`,
      ),
    ).toThrow(/CHECK/);
    // Abandoned/cancelled matches don't use up the daily win schedule either.
    expect(win(s, "w", a.agentId, b.agentId).p1Credits).toBe(40);
  });

  it("pays a draw as a loss to both sides", () => {
    const s = open();
    const a = s.createAgent({ name: "a" });
    const b = s.createAgent({ name: "b" });
    const d = s.recordMatch({ matchId: "d", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "draw" } });
    expect([d.p1Credits, d.p2Credits]).toEqual([2, 2]);
  });

  it("refuses to record the same match twice, and leaves balances untouched", () => {
    const s = open();
    const a = s.createAgent({ name: "a" });
    const b = s.createAgent({ name: "b" });
    win(s, "m1", a.agentId, b.agentId);
    expect(() => win(s, "m1", a.agentId, b.agentId)).toThrow(EconomyError);
    expect(s.balance(a.agentId)).toBe(40);
    expect(s.matchHistory()).toHaveLength(1);
  });

  it("refuses a winner who wasn't in the match", () => {
    const s = open();
    const [a, b, c] = ["a", "b", "c"].map((name) => s.createAgent({ name }));
    expect(() =>
      s.recordMatch({ matchId: "x", seed: 1, p1AgentId: a!.agentId, p2AgentId: b!.agentId, outcome: { kind: "win", winnerAgentId: c!.agentId } }),
    ).toThrow(EconomyError);
    expect(s.balance(c!.agentId)).toBe(0);
  });
});

describe("EconomyStore: packs", () => {
  it("debits 100 credits and creates the pack together, and refuses what the balance can't cover", () => {
    const s = open();
    const a = s.createAgent({ name: "a" });
    const b = s.createAgent({ name: "b" });
    for (let i = 0; i < 6; i++) win(s, `m${i}`, a.agentId, b.agentId); // 40+15+15+15+5+5 = 95
    expect(s.balance(a.agentId)).toBe(95);
    expect(() => s.buyPack(a.agentId, "S0")).toThrow(/insufficient balance/);
    expect(s.unopenedPacks(a.agentId)).toHaveLength(0);
    win(s, "m6", a.agentId, b.agentId);
    const pack = s.buyPack(a.agentId, "S0");
    expect(s.balance(a.agentId)).toBe(100 - PACK_PRICE_CREDITS);
    expect(s.unopenedPacks(a.agentId).map((p) => p.packId)).toEqual([pack.packId]);
    s.grantPack(a.agentId, "S0", "starter");
    expect(s.unopenedPacks(a.agentId)).toHaveLength(2);
  });
});

describe("EconomyStore: owned copies and decks", () => {
  it("records every copy as its own item and refuses cards that aren't ownable", () => {
    const s = open();
    const a = s.createAgent({ name: "a" });
    const copies = starter(s, a.agentId, "Null");
    const total = SHIPPED_DECK_LISTS.Null.reduce((n, e) => n + e.copies, 0);
    expect(copies).toHaveLength(total);
    expect(new Set(copies.map((c) => c.copyId)).size).toBe(total);
    expect(() => s.grantCopy({ ownerId: a.agentId, cardId: "not-a-card", source: "pack" })).toThrow(/no ownable card/);
    // A failing grant inside a batch rolls the whole batch back.
    const before = s.collection(a.agentId).length;
    const cardId = SHIPPED_DECK_LISTS.Null[0]!.cardId;
    expect(() =>
      s.grantCopies([
        { ownerId: a.agentId, cardId, source: "pack" },
        { ownerId: a.agentId, cardId: "nope", source: "pack" },
      ]),
    ).toThrow();
    expect(s.collection(a.agentId)).toHaveLength(before);
  });

  it("keeps numbered serials unique and inside their run", () => {
    const s = open();
    const a = s.createAgent({ name: "a" });
    const cardId = SHIPPED_DECK_LISTS.Aegis[0]!.cardId;
    const proto = { ownerId: a.agentId, cardId, finish: "prototype" as const, seriesKind: "prototype" as const, seriesCode: "S1", runSize: 50, source: "pack" as const };
    s.grantCopy({ ...proto, serial: 7 });
    expect(() => s.grantCopy({ ...proto, serial: 7 })).toThrow(EconomyError);
    expect(() => s.grantCopy({ ...proto, serial: 51 })).toThrow(EconomyError);
    expect(() => s.grantCopy({ ...proto, serial: null, runSize: null })).toThrow(EconomyError);
    expect(() => s.grantCopy({ ownerId: a.agentId, cardId, seriesKind: "promo", source: "promo" })).toThrow(EconomyError);
    s.grantCopy({ ownerId: a.agentId, cardId, seriesKind: "promo", seriesCode: "PR-001", stamp: "FIRST WIN", source: "promo" });
  });

  it("saves a deck only from the agent's own copies, legal by the engine's rules, and loads it for play", () => {
    const s = open();
    const a = s.createAgent({ name: "a", faction: "Aegis" });
    const b = s.createAgent({ name: "b", faction: "Swarm" });
    const mine = starter(s, a.agentId, "Aegis").map((c) => c.copyId);
    const theirs = starter(s, b.agentId, "Swarm").map((c) => c.copyId);

    const deck = s.saveDeck(a.agentId, "main", mine);
    s.setActiveDeck(a.agentId, deck.deckId);
    expect(s.getAgent(a.agentId).activeDeckId).toBe(deck.deckId);
    const loaded = s.loadDeck(deck.deckId);
    expect(loaded.copyIds).toEqual(mine);
    expect(loaded.spec.cards).toHaveLength(mine.length);

    // One copy may sit in several decks.
    s.saveDeck(a.agentId, "copy of main", mine);

    expect(() => s.saveDeck(a.agentId, "stolen", [...mine.slice(1), theirs[0]!])).toThrow(/another agent/);
    expect(() => s.saveDeck(a.agentId, "dup", [mine[0]!, mine[0]!, ...mine.slice(2)])).toThrow(/same copy twice/);
    // Five cards: refused by the engine's own deck rules (the pool lint
    // fires before the 20-card size floor does).
    expect(() => s.saveDeck(a.agentId, "tiny", mine.slice(0, 5))).toThrow(/lint failed|deck size/);
    // A fourth copy of a Common needs a fourth owned copy *and* still breaks the 3-copy limit.
    const common = SHIPPED_DECK_LISTS.Aegis.find((e) => e.copies === 3)!.cardId;
    const extra = s.grantCopy({ ownerId: a.agentId, cardId: common, source: "pack" });
    expect(() => s.saveDeck(a.agentId, "four", [...mine, extra.copyId])).toThrow(/3-copy limit/);
    // The schema refuses a cross-owner deck slot or active deck even through raw SQL.
    expect(() => s.unsafeExec(`INSERT INTO deck_copies (deck_id, copy_id) VALUES ('${deck.deckId}', '${theirs[0]}')`)).toThrow(/owns/);
    expect(() => s.setActiveDeck(b.agentId, deck.deckId)).toThrow(/own deck/);
  });

  it("will not load a deck holding a copy the agent no longer owns", () => {
    const s = open();
    const a = s.createAgent({ name: "a" });
    const mine = starter(s, a.agentId, "Cortex").map((c) => c.copyId);
    const deck = s.saveDeck(a.agentId, "main", mine);
    s.unsafeExec(`UPDATE card_copies SET disposed_at = '${DAY1}', disposed_reason = 'convertedToPackPoints' WHERE copy_id = '${mine[0]}'`);
    expect(() => s.loadDeck(deck.deckId)).toThrow(/no longer owned/);
    expect(s.collection(a.agentId)).toHaveLength(mine.length - 1);
  });
});
