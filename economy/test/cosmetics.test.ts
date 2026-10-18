// Cosmetics and victory boasts (schema v11; owner 2026-10-19, the game
// lane's plan approved with all 6 suggested defaults): the catalogue, owned
// cosmetics, per-agent loadouts, purchases, the loadouts and boast saved on
// the match record, and the migration that gives existing owners their
// starter boasts.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DeckFaction } from "@ai-tcg/engine";
import {
  CLOSE_WIN_HEALTH,
  COSMETICS,
  EconomyError,
  EconomyStore,
  LOADOUT_SLOTS,
  SEASON_BOAST_PRICE_CREDITS,
  STARTER_BOASTS,
  catalogueProblem,
  type CosmeticItem,
} from "../src/index.js";

const DAY1 = "2026-10-19T10:00:00.000Z";
let clock = new Date(DAY1);
const tmpDirs: string[] = [];
afterEach(() => {
  clock = new Date(DAY1);
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A test catalogue: the shipped one plus Season 0 items for sale. The
 * shipped catalogue sells nothing yet (which items go on sale is the
 * owner's call). */
const SEASON_BOAST: CosmeticItem = {
  itemId: "boast-s0-test-overclock",
  kind: "boast",
  name: "Test Overclock",
  season: "S0",
  faction: null,
  priceCredits: SEASON_BOAST_PRICE_CREDITS,
  sale: { from: "2026-10-01T00:00:00.000Z", until: "2026-11-01T00:00:00.000Z" },
  artRef: "code:boast/test-overclock",
  description: "A test season boast.",
};
const QUIET_BOAST: CosmeticItem = { ...SEASON_BOAST, itemId: "boast-s0-test-quiet", name: "Test Quiet", sale: null };
const LATE_BACK: CosmeticItem = {
  ...SEASON_BOAST,
  itemId: "back-s0-test-late",
  kind: "cardBack",
  name: "Test Late Back",
  priceCredits: 150,
  sale: { from: "2026-12-01T00:00:00.000Z", until: null },
};
const S1_AVATAR: CosmeticItem = { ...SEASON_BOAST, itemId: "avatar-s1-test", kind: "avatar", name: "Test S1 Avatar", season: "S1", priceCredits: 200, sale: null };
const CATALOGUE: readonly CosmeticItem[] = [...COSMETICS, SEASON_BOAST, QUIET_BOAST, LATE_BACK, S1_AVATAR];

const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo, cosmetics: CATALOGUE });
const tmpFile = () => {
  const dir = mkdtempSync(join(tmpdir(), "cosmetics-"));
  tmpDirs.push(dir);
  return join(dir, "season.db");
};

function credit(s: EconomyStore, ownerId: string, amount: number) {
  s.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${ownerId}', 'credits', ${amount}, 'testGrant', '${clock.toISOString()}')`);
}

/** An owner with its starter collection, an agent, and the starter deck saved and active. */
function seat(s: EconomyStore, name: string, faction: DeckFaction) {
  const owner = s.createOwner({ name });
  const { copies } = s.grantStarterCollection(owner.ownerId, faction);
  const agent = s.createAgent({ ownerId: owner.ownerId, name: `${name}-agent` });
  const deck = s.saveDeck(owner.ownerId, "starter", copies.map((c) => c.copyId));
  s.setActiveDeck(owner.ownerId, deck.deckId);
  s.connectAgent(owner.ownerId, agent.agentId);
  return { ownerId: owner.ownerId, agentId: agent.agentId, deckId: deck.deckId };
}

describe("cosmetics: the catalogue", () => {
  it("ships the four free faction starter boasts and nothing for sale yet", () => {
    expect(catalogueProblem(COSMETICS)).toBeNull();
    expect(COSMETICS.map((c) => c.itemId).sort()).toEqual(Object.values(STARTER_BOASTS).map((b) => b.itemId).sort());
    for (const [faction, boast] of Object.entries(STARTER_BOASTS)) {
      expect(boast).toMatchObject({ kind: "boast", faction, season: "standard", priceCredits: null, sale: null });
      expect(boast.artRef).toMatch(/^code:boast\//);
    }
    const s = EconomyStore.open(":memory:", { now: () => clock });
    const o = s.createOwner({ name: "o" });
    expect(s.cosmeticsOnSale(o.ownerId)).toEqual([]);
    s.close();
  });

  it("refuses a catalogue it can't use", () => {
    const aegis = STARTER_BOASTS.Aegis;
    expect(catalogueProblem([...COSMETICS, { ...SEASON_BOAST, itemId: aegis.itemId }])).toMatch(/listed twice/);
    expect(catalogueProblem(COSMETICS.filter((c) => c !== aegis))).toMatch(/starter boast "boast-aegis-shield-slam"/);
    expect(catalogueProblem([...COSMETICS.filter((c) => c !== aegis), { ...aegis, priceCredits: 50 }])).toMatch(/granted, never sold/);
    expect(catalogueProblem([...COSMETICS, { ...SEASON_BOAST, priceCredits: 0 }])).toMatch(/whole, positive price/);
    expect(catalogueProblem([...COSMETICS, { ...SEASON_BOAST, sale: { from: "2026-11-01T00:00:00Z", until: "2026-10-01T00:00:00Z" } }])).toMatch(/ends before/);
    expect(catalogueProblem([...COSMETICS, { ...SEASON_BOAST, itemId: "Bad Id" }])).toMatch(/lowercase/);
    expect(() => EconomyStore.open(":memory:", { cosmetics: COSMETICS.slice(1) })).toThrow(/bad cosmetics catalogue/);
  });
});

describe("cosmetics: starter boasts and the default loadout", () => {
  it("grants all four starter boasts with the starter collection, account-bound", () => {
    const s = open();
    const o = s.createOwner({ name: "o" });
    expect(s.ownedCosmetics(o.ownerId)).toEqual([]);
    const grant = s.grantStarterCollection(o.ownerId, "Swarm");
    expect(grant.cosmetics.map((c) => c.itemId).sort()).toEqual(Object.values(STARTER_BOASTS).map((b) => b.itemId).sort());
    expect(grant.cosmetics.every((c) => c.source === "starter" && c.ledgerEntryId === null && c.item !== null)).toBe(true);
    // Free: no ledger rows at all.
    expect(s.ledger(o.ownerId)).toEqual([]);
    // Account-bound: never changed, moved or removed, even by raw SQL.
    const other = s.createOwner({ name: "other" });
    expect(() => s.unsafeExec(`UPDATE owned_cosmetics SET owner_id = '${other.ownerId}'`)).toThrow(/account-bound/);
    expect(() => s.unsafeExec(`DELETE FROM owned_cosmetics`)).toThrow(/account-bound/);
    // A second starter grant is still refused, with no second set of boasts.
    expect(() => s.grantStarterCollection(o.ownerId, "Null")).toThrow(/already has/);
    expect(s.ownedCosmetics(o.ownerId)).toHaveLength(4);
  });

  it("starts each agent on its owner's faction boast: lock first, then starting faction", () => {
    const s = open();
    const o = s.createOwner({ name: "o" });
    // An agent made before the starter collection has nothing to wear yet...
    const early = s.createAgent({ ownerId: o.ownerId, name: "early" });
    expect(s.loadout(early.agentId)).toEqual(Object.fromEntries(LOADOUT_SLOTS.map((k) => [k, null])));
    s.grantStarterCollection(o.ownerId, "Aegis");
    // ...and gets the starting faction's boast with it.
    expect(s.loadout(early.agentId).boast).toBe(STARTER_BOASTS.Aegis.itemId);
    const later = s.createAgent({ ownerId: o.ownerId, name: "later" });
    expect(s.loadout(later.agentId).boast).toBe(STARTER_BOASTS.Aegis.itemId);
    s.setFactionLock(o.ownerId, "Null");
    const locked = s.createAgent({ ownerId: o.ownerId, name: "locked" });
    expect(s.loadout(locked.agentId)).toMatchObject({ boast: STARTER_BOASTS.Null.itemId, closeWinBoast: null, cardBack: null, avatar: null, arena: null });
    // An owner without a starter collection: the slot stays empty.
    const bare = s.createOwner({ name: "bare" });
    expect(s.loadout(s.createAgent({ ownerId: bare.ownerId, name: "bare-agent" }).agentId).boast).toBeNull();
  });
});

describe("cosmetics: buying", () => {
  it("buys a season boast for 300 credits: debited and granted together, once", () => {
    const s = open();
    const o = s.createOwner({ name: "o" });
    credit(s, o.ownerId, 299);
    expect(s.cosmeticsOnSale(o.ownerId).map((i) => [i.itemId, i.owned])).toEqual([
      [SEASON_BOAST.itemId, false],
      [QUIET_BOAST.itemId, false],
    ]);
    expect(() => s.buyCosmetic(o.ownerId, SEASON_BOAST.itemId)).toThrow(/costs 300 credits; the owner has 299/);
    expect(s.ownedCosmetics(o.ownerId)).toEqual([]);
    credit(s, o.ownerId, 1);
    const bought = s.buyCosmetic(o.ownerId, SEASON_BOAST.itemId);
    expect(bought).toMatchObject({ itemId: SEASON_BOAST.itemId, kind: "boast", source: "purchase", item: SEASON_BOAST });
    expect(s.balance(o.ownerId)).toBe(0);
    const payment = s.ledger(o.ownerId).at(-1)!;
    expect(payment).toMatchObject({ entryId: bought.ledgerEntryId, delta: -300, reason: "cosmeticPurchase", ref: SEASON_BOAST.itemId, playedBy: null });
    credit(s, o.ownerId, 1000);
    expect(() => s.buyCosmetic(o.ownerId, SEASON_BOAST.itemId)).toThrow(/already has/);
    expect(s.cosmeticsOnSale(o.ownerId).find((i) => i.itemId === SEASON_BOAST.itemId)!.owned).toBe(true);
    expect(s.balance(o.ownerId)).toBe(1000);
  });

  it("sells only this season's items inside their sale window; starter boasts are never sold", () => {
    const s = open();
    const o = s.createOwner({ name: "o" });
    credit(s, o.ownerId, 5000);
    expect(() => s.buyCosmetic(o.ownerId, STARTER_BOASTS.Cortex.itemId)).toThrow(/free with the starter collection/);
    expect(() => s.buyCosmetic(o.ownerId, S1_AVATAR.itemId)).toThrow(/S1 item; it isn't sold in S0/);
    expect(() => s.buyCosmetic(o.ownerId, LATE_BACK.itemId)).toThrow(/isn't on sale now/);
    expect(() => s.buyCosmetic(o.ownerId, "no-such-item")).toThrow(/no cosmetic/);
    // The window opens...
    clock = new Date("2026-12-01T00:00:00.000Z");
    expect(s.cosmeticsOnSale(o.ownerId).map((i) => i.itemId)).toEqual([QUIET_BOAST.itemId, LATE_BACK.itemId]);
    expect(s.buyCosmetic(o.ownerId, LATE_BACK.itemId).kind).toBe("cardBack");
    // ...and the October boast is retired: never sold again, owners keep theirs.
    expect(() => s.buyCosmetic(o.ownerId, SEASON_BOAST.itemId)).toThrow(/isn't on sale now/);
    expect(s.balance(o.ownerId)).toBe(4850);
  });

  it("the schema refuses an owned item without its payment, even by raw SQL", () => {
    const s = open();
    const o = s.createOwner({ name: "o" });
    const raw = (entry: string) =>
      s.unsafeExec(
        `INSERT INTO owned_cosmetics (owner_id, item_id, kind, source, ledger_entry_id, acquired_at) VALUES ('${o.ownerId}', '${QUIET_BOAST.itemId}', 'boast', 'purchase', ${entry}, '${DAY1}')`,
      );
    expect(() => raw("NULL")).toThrow(/credits payment for that item/);
    credit(s, o.ownerId, 1000);
    // A ledger row that is a payment, but not for this item.
    s.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, ref, created_at) VALUES ('${o.ownerId}', 'credits', -100, 'packPurchase', 'p1', '${DAY1}')`);
    const packRow = s.ledger(o.ownerId).at(-1)!.entryId;
    expect(() => raw(String(packRow))).toThrow(/credits payment for that item/);
    // The ledger's once-per-reason-and-ref index stops a second payment for the same item.
    s.buyCosmetic(o.ownerId, QUIET_BOAST.itemId);
    expect(() =>
      s.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, ref, created_at) VALUES ('${o.ownerId}', 'credits', -300, 'cosmeticPurchase', '${QUIET_BOAST.itemId}', '${DAY1}')`),
    ).toThrow(/UNIQUE/);
  });
});

describe("cosmetics: the loadout", () => {
  it("equips only owned items of the slot's kind, on the owner's own agents", () => {
    const s = open();
    const a = seat(s, "a", "Cortex");
    const b = seat(s, "b", "Swarm");
    credit(s, a.ownerId, 1000);
    expect(() => s.setLoadout(a.ownerId, a.agentId, "closeWinBoast", SEASON_BOAST.itemId)).toThrow(/doesn't own "Test Overclock"/);
    s.buyCosmetic(a.ownerId, SEASON_BOAST.itemId);
    s.setLoadout(a.ownerId, a.agentId, "boast", SEASON_BOAST.itemId);
    expect(s.setLoadout(a.ownerId, a.agentId, "closeWinBoast", STARTER_BOASTS.Null.itemId)).toMatchObject({
      boast: SEASON_BOAST.itemId,
      closeWinBoast: STARTER_BOASTS.Null.itemId,
    });
    expect(() => s.setLoadout(a.ownerId, a.agentId, "cardBack", SEASON_BOAST.itemId)).toThrow(/is a victory boast; the cardBack slot takes a card back/);
    expect(() => s.setLoadout(b.ownerId, a.agentId, "boast", STARTER_BOASTS.Swarm.itemId)).toThrow(/its own agents/);
    // b doesn't own a's bought boast.
    expect(() => s.setLoadout(b.ownerId, b.agentId, "boast", SEASON_BOAST.itemId)).toThrow(/doesn't own/);
    // Emptying a slot.
    expect(s.setLoadout(a.ownerId, a.agentId, "closeWinBoast", null).closeWinBoast).toBeNull();
    // The schema holds the same rules for any caller.
    expect(() => s.unsafeExec(`INSERT INTO agent_loadouts (agent_id, slot, item_id, set_at) VALUES ('${b.agentId}', 'closeWinBoast', '${SEASON_BOAST.itemId}', '${DAY1}')`)).toThrow(
      /owner owns/,
    );
    expect(() => s.unsafeExec(`INSERT INTO agent_loadouts (agent_id, slot, item_id, set_at) VALUES ('${b.agentId}', 'arena', '${STARTER_BOASTS.Swarm.itemId}', '${DAY1}')`)).toThrow(
      /slot of its kind/,
    );
    expect(() => s.unsafeExec(`UPDATE agent_loadouts SET item_id = '${SEASON_BOAST.itemId}' WHERE agent_id = '${b.agentId}'`)).toThrow(/owner owns/);
  });

  it("can't change during a live match; the live match carries the loadout it started with", () => {
    const s = open();
    const a = seat(s, "a", "Aegis");
    const b = seat(s, "b", "Null");
    const live = s.startMatch({ matchId: "live-1", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId });
    expect(live.p1.loadout.boast).toBe(STARTER_BOASTS.Aegis.itemId);
    expect(live.p2.loadout.boast).toBe(STARTER_BOASTS.Null.itemId);
    expect(() => s.setLoadout(a.ownerId, a.agentId, "boast", STARTER_BOASTS.Swarm.itemId)).toThrow(/live match/);
    const rec = s.recordMatch({ matchId: "live-1", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, p1DeckId: a.deckId, p2DeckId: b.deckId, outcome: { kind: "win", winnerAgentId: b.agentId }, finalHealth: { p1: 0, p2: 12 } });
    expect(rec.boast).toEqual({ agentId: b.agentId, itemId: STARTER_BOASTS.Null.itemId, slot: "boast", winnerHealth: 12 });
    // Once recorded, the owner is free to change again.
    expect(s.setLoadout(a.ownerId, a.agentId, "boast", STARTER_BOASTS.Swarm.itemId).boast).toBe(STARTER_BOASTS.Swarm.itemId);
  });
});

describe("cosmetics: the match record", () => {
  function setup() {
    const s = open();
    const a = seat(s, "a", "Cortex");
    const b = seat(s, "b", "Aegis");
    credit(s, a.ownerId, 1000);
    s.buyCosmetic(a.ownerId, SEASON_BOAST.itemId);
    s.buyCosmetic(a.ownerId, QUIET_BOAST.itemId);
    s.setLoadout(a.ownerId, a.agentId, "boast", SEASON_BOAST.itemId);
    s.setLoadout(a.ownerId, a.agentId, "closeWinBoast", QUIET_BOAST.itemId);
    let n = 0;
    const play = (winner: "a" | "b" | null, finalHealth?: { p1: number; p2: number } | null, decks = true) =>
      s.recordMatch({
        matchId: `m${++n}`,
        seed: n,
        p1AgentId: a.agentId,
        p2AgentId: b.agentId,
        p1DeckId: decks ? a.deckId : null,
        p2DeckId: decks ? b.deckId : null,
        outcome: winner === null ? { kind: "draw" } : { kind: "win", winnerAgentId: winner === "a" ? a.agentId : b.agentId },
        finalHealth,
      });
    return { s, a, b, play };
  }

  it("saves both sides' loadouts and picks the boast: close win on 5 or less, else the main boast", () => {
    const { s, a, b, play } = setup();
    const big = play("a", { p1: 17, p2: -3 });
    expect(big.loadouts).toEqual({
      p1: { boast: SEASON_BOAST.itemId, closeWinBoast: QUIET_BOAST.itemId, cardBack: null, avatar: null, arena: null },
      p2: { boast: STARTER_BOASTS.Aegis.itemId, closeWinBoast: null, cardBack: null, avatar: null, arena: null },
    });
    expect(big.boast).toEqual({ agentId: a.agentId, itemId: SEASON_BOAST.itemId, slot: "boast", winnerHealth: 17 });
    expect(play("a", { p1: CLOSE_WIN_HEALTH + 1, p2: 0 }).boast!.slot).toBe("boast");
    expect(play("a", { p1: CLOSE_WIN_HEALTH, p2: 0 }).boast).toEqual({ agentId: a.agentId, itemId: QUIET_BOAST.itemId, slot: "closeWinBoast", winnerHealth: 5 });
    // A turn-cap win counts the same way.
    expect(play("a", { p1: 1, p2: 3 }).boast!.itemId).toBe(QUIET_BOAST.itemId);
    // No final health: the main boast.
    expect(play("a").boast).toMatchObject({ itemId: SEASON_BOAST.itemId, slot: "boast", winnerHealth: null });
    // A close win for an agent with no close-win boast plays its main boast.
    expect(play("b", { p1: 0, p2: 2 }).boast).toEqual({ agentId: b.agentId, itemId: STARTER_BOASTS.Aegis.itemId, slot: "boast", winnerHealth: 2 });
    // A draw plays no boast, but still saves the loadouts.
    const draw = play(null, { p1: 4, p2: 4 });
    expect(draw.boast).toBeNull();
    expect(draw.loadouts!.p1.boast).toBe(SEASON_BOAST.itemId);
    expect(() => play("a", { p1: 2.5, p2: 0 })).toThrow(/whole numbers/);
  });

  it("an empty boast slot plays the starter boast of the deck's faction, or none without a deck", () => {
    const { s, b, play } = setup();
    s.setLoadout(b.ownerId, b.agentId, "boast", null);
    expect(play("b", { p1: 0, p2: 9 }).boast).toEqual({ agentId: b.agentId, itemId: STARTER_BOASTS.Aegis.itemId, slot: "factionStarter", winnerHealth: 9 });
    expect(play("b", { p1: 0, p2: 9 }, false).boast).toBeNull();
  });

  it("history replays what the agents had then, after loadouts change; the record is written once", () => {
    const { s, a, b, play } = setup();
    const first = play("a", { p1: 3, p2: 0 });
    s.setLoadout(a.ownerId, a.agentId, "boast", STARTER_BOASTS.Swarm.itemId);
    s.setLoadout(a.ownerId, a.agentId, "closeWinBoast", null);
    const second = play("a", { p1: 3, p2: 0 });
    const history = s.matchHistory({ agentId: a.agentId });
    expect(history.map((m) => m.boast)).toEqual([first.boast, second.boast]);
    expect(history.map((m) => m.loadouts)).toEqual([first.loadouts, second.loadouts]);
    expect(history[0]!.boast!.itemId).toBe(QUIET_BOAST.itemId);
    expect(history[1]!.boast!.itemId).toBe(STARTER_BOASTS.Swarm.itemId);
    for (const sql of [
      `UPDATE match_boasts SET item_id = 'x'`,
      `DELETE FROM match_boasts`,
      `UPDATE match_loadouts SET boast = 'x'`,
      `DELETE FROM match_loadouts`,
    ]) {
      expect(() => s.unsafeExec(sql)).toThrow(/written once/);
    }
    // A boast only for a won match, only by the winner.
    const draw = play(null);
    expect(() => s.unsafeExec(`INSERT INTO match_boasts (match_id, agent_id, item_id, slot) VALUES ('${draw.matchId}', '${a.agentId}', 'x', 'boast')`)).toThrow(/won match/);
    const won = play("b", { p1: 0, p2: 8 });
    s.unsafeExec(`DROP TRIGGER match_boast_no_delete`);
    s.unsafeExec(`DELETE FROM match_boasts WHERE match_id = '${won.matchId}'`);
    expect(() => s.unsafeExec(`INSERT INTO match_boasts (match_id, agent_id, item_id, slot) VALUES ('${won.matchId}', '${a.agentId}', 'x', 'boast')`)).toThrow(/winning side/);
    expect(() =>
      s.unsafeExec(`INSERT INTO match_loadouts (match_id, seat, agent_id) VALUES ('${draw.matchId}', 'p1', '${b.agentId}')`),
    ).toThrow(/agent in that seat|UNIQUE|PRIMARY/);
  });

  it("is cosmetic only: payouts are the same whatever the loadout", () => {
    const { s, a, b, play } = setup();
    const before = s.balance(a.ownerId);
    const m = play("a", { p1: 2, p2: 0 });
    expect(m.p1Credits).toBe(30);
    expect(s.balance(a.ownerId)).toBe(before + 30);
    expect(m.p2Credits).toBe(2);
    expect(s.balance(b.ownerId)).toBe(2);
  });
});

describe("cosmetics: migration v10 -> v11", () => {
  it("gives existing owners their starter boasts once and their agents the faction boast; old matches keep no loadout", () => {
    const path = tmpFile();
    const v10 = open(path, 10);
    expect(v10.schemaVersion).toBe(10);
    const a = v10.createOwner({ name: "a" });
    v10.grantStarterCollection(a.ownerId, "Swarm");
    const aAgent = v10.createAgent({ ownerId: a.ownerId, name: "a-agent" });
    const locked = v10.createOwner({ name: "locked" });
    v10.grantStarterCollection(locked.ownerId, "Cortex");
    v10.setFactionLock(locked.ownerId, "Aegis");
    const lockedAgent = v10.createAgent({ ownerId: locked.ownerId, name: "locked-agent" });
    const bare = v10.createOwner({ name: "bare" });
    const bareAgent = v10.createAgent({ ownerId: bare.ownerId, name: "bare-agent" });
    // v10 code paths: no cosmetics, nothing on the record.
    expect(v10.ownedCosmetics(a.ownerId)).toEqual([]);
    const old = v10.recordMatch({ matchId: "old", seed: 1, p1AgentId: aAgent.agentId, p2AgentId: bareAgent.agentId, outcome: { kind: "win", winnerAgentId: aAgent.agentId } });
    expect(old.loadouts).toBeNull();
    v10.close();

    clock = new Date("2026-10-20T09:00:00.000Z");
    const v11 = open(path);
    expect(v11.schemaVersion).toBe(11);
    for (const o of [a, locked]) {
      const owned = v11.ownedCosmetics(o.ownerId);
      expect(owned.map((c) => c.itemId).sort()).toEqual(Object.values(STARTER_BOASTS).map((b) => b.itemId).sort());
      expect(owned.every((c) => c.source === "starter" && c.acquiredAt === v11.getOwner(o.ownerId).starterGrantedAt)).toBe(true);
    }
    expect(v11.ownedCosmetics(bare.ownerId)).toEqual([]);
    expect(v11.loadout(aAgent.agentId).boast).toBe(STARTER_BOASTS.Swarm.itemId);
    expect(v11.loadout(lockedAgent.agentId).boast).toBe(STARTER_BOASTS.Aegis.itemId);
    expect(v11.loadout(bareAgent.agentId).boast).toBeNull();
    // The old match: no loadouts, no boast (the render falls back).
    expect(v11.matchHistory()).toEqual([expect.objectContaining({ matchId: "old", loadouts: null, boast: null })]);
    // New matches record them.
    const fresh = v11.recordMatch({ matchId: "new", seed: 2, p1AgentId: aAgent.agentId, p2AgentId: bareAgent.agentId, outcome: { kind: "win", winnerAgentId: aAgent.agentId }, finalHealth: { p1: 11, p2: 0 } });
    expect(fresh.boast).toMatchObject({ itemId: STARTER_BOASTS.Swarm.itemId, slot: "boast" });
    // Owners who get their starter collection after the migration get the boasts then.
    v11.grantStarterCollection(bare.ownerId, "Null");
    expect(v11.ownedCosmetics(bare.ownerId)).toHaveLength(4);
    expect(v11.loadout(bareAgent.agentId).boast).toBe(STARTER_BOASTS.Null.itemId);
    v11.close();
  });

  it("refuses to open a catalogue missing a starter boast, before touching the file", () => {
    expect(() => EconomyStore.open(":memory:", { cosmetics: [] })).toThrow(EconomyError);
  });
});
