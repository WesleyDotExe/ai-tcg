// Coin skins (schema v20; owner 2026-11-02, "coin skins for the
// first-player coin flip", the game lane's half built as approved with two
// changes: the tier coins are Platinum, Diamond and Mythic, and spectators
// pick a point of view, so the record keeps both coins and both sides'
// starting ratings). The catalogue, the free Chrome Token, the coin slot,
// the store coins, the tier coins granted at season end, the coin and the
// starting ratings on the match record, and the v19 -> v20 migration.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DeckFaction } from "@ai-tcg/engine";
import {
  COSMETICS,
  EconomyStore,
  LOADOUT_SLOTS,
  SEASON_0_COINS,
  SEASON_0_TIER_COINS,
  SEASON_COIN_PRICE_CREDITS,
  SEASON_REWARD_TIERS,
  SLOT_KIND,
  STARTER_BOASTS,
  STARTER_COIN,
  catalogueProblem,
  coinOf,
  onSale,
  tierCoinsFor,
  type CosmeticItem,
} from "../src/index.js";

const DAY1 = "2026-11-02T10:00:00.000Z";
let clock = new Date(DAY1);
const tmpDirs: string[] = [];
afterEach(() => {
  clock = new Date(DAY1);
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmpFile = () => {
  const dir = mkdtempSync(join(tmpdir(), "coins-"));
  tmpDirs.push(dir);
  return join(dir, "season.db");
};

/** The shipped catalogue with the two store coins marked drawn, as the
 * render lane will mark them in its coin slice. */
const DRAWN_COINS: readonly CosmeticItem[] = COSMETICS.map((c) => (SEASON_0_COINS.some((s) => s.itemId === c.itemId) ? { ...c, drawn: true } : c));

const open = (path = ":memory:", opts: { migrateTo?: number; cosmetics?: readonly CosmeticItem[]; season?: string } = {}) =>
  EconomyStore.open(path, { now: () => clock, ...opts });

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

/** Puts an owner's stored rating at `rating`, placed (5 rated matches). */
function rate(s: EconomyStore, ownerId: string, rating: number, matches = 5) {
  s.unsafeExec(
    `INSERT INTO ratings (owner_id, rating, rd, volatility, matches, last_day, updated_at) VALUES ('${ownerId}', ${rating}, 60, 0.06, ${matches}, '2026-11-02', '${DAY1}')
     ON CONFLICT (owner_id) DO UPDATE SET rating = excluded.rating, matches = excluded.matches`,
  );
}

describe("coins: the catalogue", () => {
  it("ships the Chrome Token (free), two Season 0 store coins at 300, and three Season 0 tier coins", () => {
    expect(catalogueProblem(COSMETICS)).toBeNull();
    expect(STARTER_COIN).toMatchObject({ itemId: "coin-chrome-token", kind: "coin", name: "Chrome Token", season: "standard", priceCredits: null, sale: null });
    expect(SEASON_COIN_PRICE_CREDITS).toBe(300);
    expect(SEASON_0_COINS.map((c) => [c.itemId, c.name, c.season, c.priceCredits, c.sale])).toEqual([
      ["coin-s0-dial-up-dime", "Dial-Up Dime", "S0", 300, null],
      ["coin-s0-neon-nickel", "Neon Nickel", "S0", 300, null],
    ]);
    // Owner 2026-11-02 change 4: Platinum, Diamond and Mythic (not Gold).
    expect(SEASON_REWARD_TIERS).toEqual(["Platinum", "Diamond", "Mythic"]);
    expect(Object.values(SEASON_0_TIER_COINS).map((c) => [c.itemId, c.name, c.tierReward, c.priceCredits])).toEqual([
      ["coin-s0-platinum", "Platinum Coin", "Platinum", null],
      ["coin-s0-diamond", "Diamond Coin", "Diamond", null],
      ["coin-s0-mythic", "Mythic Coin", "Mythic", null],
    ]);
    for (const c of COSMETICS.filter((i) => i.kind === "coin")) {
      expect(c.artRef).toBe(`code:coin/${c.itemId.replace(/^coin-/, "")}`);
      // No coin is drawn yet: the render lane's two coin slices draw them.
      expect(c.drawn).toBe(false);
    }
    expect(LOADOUT_SLOTS).toContain("coin");
    expect(SLOT_KIND.coin).toBe("coin");
  });

  it("a higher tier earns the lower coins too; Gold, Bronze and Placement earn none", () => {
    const ids = (tier: string) => tierCoinsFor(tier).map((c) => c.itemId);
    expect(ids("Mythic")).toEqual(["coin-s0-platinum", "coin-s0-diamond", "coin-s0-mythic"]);
    expect(ids("Diamond")).toEqual(["coin-s0-platinum", "coin-s0-diamond"]);
    expect(ids("Platinum")).toEqual(["coin-s0-platinum"]);
    for (const t of ["Gold", "Silver", "Bronze", "Placement"]) expect(ids(t)).toEqual([]);
  });

  it("an empty coin slot, or a record without one, flips the Chrome Token", () => {
    expect(coinOf({ coin: "coin-s0-neon-nickel" })).toBe("coin-s0-neon-nickel");
    expect(coinOf({ coin: null })).toBe(STARTER_COIN.itemId);
    expect(coinOf({})).toBe(STARTER_COIN.itemId);
    expect(coinOf(null)).toBe(STARTER_COIN.itemId);
  });

  it("refuses a catalogue without the starter coin, a sold tier coin, or two coins for one tier", () => {
    expect(catalogueProblem(COSMETICS.filter((c) => c !== STARTER_COIN))).toMatch(/starter coin "coin-chrome-token"/);
    const plat = SEASON_0_TIER_COINS.Platinum;
    const others = COSMETICS.filter((c) => c !== plat);
    expect(catalogueProblem([...others, { ...plat, priceCredits: 500 }])).toMatch(/season reward, so it is granted, never sold/);
    expect(catalogueProblem([...others, { ...plat, season: "standard" }])).toMatch(/belongs to a season/);
    expect(catalogueProblem([...COSMETICS, { ...plat, itemId: "coin-s0-platinum-two" }])).toMatch(/rewards Platinum with two coins/);
    expect(catalogueProblem([...others, { ...plat, tierReward: "Gold" as never }])).toMatch(/unknown tier "Gold"/);
    expect(() => open(":memory:", { cosmetics: COSMETICS.filter((c) => c !== STARTER_COIN) })).toThrow(/bad cosmetics catalogue/);
  });
});

describe("coins: the Chrome Token and the coin slot", () => {
  it("comes free with the starter collection and is equipped on every agent, before and after", () => {
    const s = open();
    const o = s.createOwner({ name: "o" });
    const early = s.createAgent({ ownerId: o.ownerId, name: "early" });
    expect(s.loadout(early.agentId).coin).toBeNull();
    const grant = s.grantStarterCollection(o.ownerId, "Cortex");
    expect(grant.cosmetics.find((c) => c.itemId === STARTER_COIN.itemId)).toMatchObject({ kind: "coin", source: "starter", ledgerEntryId: null, rewardRef: null });
    expect(s.ledger(o.ownerId)).toEqual([]);
    expect(s.loadout(early.agentId).coin).toBe(STARTER_COIN.itemId);
    const later = s.createAgent({ ownerId: o.ownerId, name: "later" });
    expect(s.loadout(later.agentId)).toMatchObject({ boast: STARTER_BOASTS.Cortex.itemId, coin: STARTER_COIN.itemId });
    // An owner without a starter collection has no coin to wear.
    const bare = s.createOwner({ name: "bare" });
    expect(s.loadout(s.createAgent({ ownerId: bare.ownerId, name: "bare-agent" }).agentId).coin).toBeNull();
  });

  it("the coin slot takes only an owned coin; it can be emptied; the schema holds the same rule", () => {
    const s = open(":memory:", { cosmetics: DRAWN_COINS });
    const a = seat(s, "a", "Swarm");
    const b = seat(s, "b", "Null");
    expect(() => s.setLoadout(a.ownerId, a.agentId, "coin", STARTER_BOASTS.Swarm.itemId)).toThrow(/is a victory boast; the coin slot takes a coin/);
    expect(() => s.setLoadout(a.ownerId, a.agentId, "boast", STARTER_COIN.itemId)).toThrow(/is a coin; the boast slot takes a victory boast/);
    expect(() => s.setLoadout(a.ownerId, a.agentId, "coin", "coin-s0-neon-nickel")).toThrow(/doesn't own "Neon Nickel"/);
    credit(s, a.ownerId, 300);
    s.buyCosmetic(a.ownerId, "coin-s0-neon-nickel");
    expect(s.setLoadout(a.ownerId, a.agentId, "coin", "coin-s0-neon-nickel").coin).toBe("coin-s0-neon-nickel");
    expect(s.setLoadout(a.ownerId, a.agentId, "coin", null).coin).toBeNull();
    // Raw SQL: b doesn't own a's coin; a boast can't go in the coin slot.
    expect(() => s.unsafeExec(`INSERT INTO agent_loadouts (agent_id, slot, item_id, set_at) VALUES ('${b.agentId}', 'coin', 'coin-s0-neon-nickel', '${DAY1}') ON CONFLICT DO UPDATE SET item_id = excluded.item_id`)).toThrow(/owner owns/);
    expect(() => s.unsafeExec(`UPDATE agent_loadouts SET item_id = '${STARTER_BOASTS.Null.itemId}' WHERE agent_id = '${b.agentId}' AND slot = 'coin'`)).toThrow(/slot of its kind/);
    // No coin changes in a live match.
    s.startMatch({ matchId: "live", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId });
    expect(() => s.setLoadout(a.ownerId, a.agentId, "coin", STARTER_COIN.itemId)).toThrow(/live match/);
  });
});

describe("coins: the store", () => {
  it("doesn't sell a store coin until the render lane draws it; then 300 credits, Season 0 only", () => {
    const shipped = open();
    const o = shipped.createOwner({ name: "o" });
    credit(shipped, o.ownerId, 1000);
    expect(shipped.cosmeticsOnSale(o.ownerId).filter((i) => i.kind === "coin")).toEqual([]);
    expect(() => shipped.buyCosmetic(o.ownerId, "coin-s0-dial-up-dime")).toThrow(/render lane hasn't drawn it/);
    shipped.close();

    const s = open(":memory:", { cosmetics: DRAWN_COINS });
    const buyer = s.createOwner({ name: "buyer" });
    credit(s, buyer.ownerId, 599);
    expect(s.cosmeticsOnSale(buyer.ownerId).filter((i) => i.kind === "coin").map((i) => [i.itemId, i.priceCredits])).toEqual([
      ["coin-s0-dial-up-dime", 300],
      ["coin-s0-neon-nickel", 300],
    ]);
    expect(s.buyCosmetic(buyer.ownerId, "coin-s0-dial-up-dime")).toMatchObject({ kind: "coin", source: "purchase" });
    expect(() => s.buyCosmetic(buyer.ownerId, "coin-s0-neon-nickel")).toThrow(/costs 300 credits; the owner has 299/);
    // Neither the starter coin nor a tier coin is ever sold.
    expect(() => s.buyCosmetic(buyer.ownerId, STARTER_COIN.itemId)).toThrow(/free with the starter collection/);
    expect(() => s.buyCosmetic(buyer.ownerId, "coin-s0-mythic")).toThrow(/season reward for finishing Mythic or higher; it isn't sold/);
    for (const at of ["2026-11-02T00:00:00.000Z", "2027-03-01T00:00:00.000Z"]) {
      expect(onSale(DRAWN_COINS.find((c) => c.itemId === "coin-s0-neon-nickel")!, "S1", at)).toBe(false);
    }
  });
});

describe("coins: the match record", () => {
  it("keeps each side's coin and starting rating, for a win and a cancel alike, written once", () => {
    const s = open(":memory:", { cosmetics: DRAWN_COINS });
    const a = seat(s, "a", "Aegis");
    const b = seat(s, "b", "Cortex");
    credit(s, b.ownerId, 300);
    s.buyCosmetic(b.ownerId, "coin-s0-neon-nickel");
    s.setLoadout(b.ownerId, b.agentId, "coin", "coin-s0-neon-nickel");
    rate(s, a.ownerId, 1712.5);
    const live = s.startMatch({ matchId: "m1", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId });
    // b has no rating row yet: the start (1500).
    expect(live.ratingsAtStart).toEqual({ p1: 1712.5, p2: 1500 });
    expect(live.p2.loadout.coin).toBe("coin-s0-neon-nickel");
    expect(s.liveMatches()).toEqual([expect.objectContaining({ matchId: "m1", ratingsAtStart: { p1: 1712.5, p2: 1500 } })]);
    const won = s.recordMatch({ matchId: "m1", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, p1DeckId: a.deckId, p2DeckId: b.deckId, outcome: { kind: "win", winnerAgentId: b.agentId }, finalHealth: { p1: 0, p2: 9 } });
    expect(won.loadouts!.p1.coin).toBe(STARTER_COIN.itemId);
    expect(won.loadouts!.p2.coin).toBe("coin-s0-neon-nickel");
    expect(won.ratingsAtStart).toEqual({ p1: 1712.5, p2: 1500 });
    // The ratings moved after the match; the record keeps the start.
    expect(won.ratings!.p1.before.rating).toBe(1712.5);
    expect(s.rating(a.ownerId).rating).toBeLessThan(1712.5);
    expect(s.matchById("m1")).toMatchObject({ ratingsAtStart: { p1: 1712.5, p2: 1500 }, loadouts: won.loadouts });

    // A cancel is never rated, but keeps its starting ratings and coins.
    s.startMatch({ matchId: "m2", p1OwnerId: b.ownerId, p2OwnerId: a.ownerId });
    const cancelled = s.recordMatch({ matchId: "m2", seed: 2, p1AgentId: b.agentId, p2AgentId: a.agentId, outcome: { kind: "cancelled" } });
    expect(cancelled.ratings).toBeNull();
    expect(cancelled.ratingsAtStart).toEqual({ p1: s.rating(b.ownerId).rating, p2: s.rating(a.ownerId).rating });
    expect(cancelled.loadouts!.p1.coin).toBe("coin-s0-neon-nickel");

    // A direct record (no live match) goes in on the ratings it is rated from.
    const before = s.rating(a.ownerId).rating;
    const direct = s.recordMatch({ matchId: "m3", seed: 3, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "draw" } });
    expect(direct.ratingsAtStart!.p1).toBe(before);

    // Changing the coin later doesn't touch the record.
    s.setLoadout(b.ownerId, b.agentId, "coin", null);
    expect(s.matchById("m1")!.loadouts!.p2.coin).toBe("coin-s0-neon-nickel");
    for (const sql of [`UPDATE match_loadouts SET coin = 'x'`, `UPDATE matches SET p1_rating_start = 1 WHERE match_id = 'm1'`]) {
      expect(() => s.unsafeExec(sql)).toThrow(/written once/);
    }
  });

  it("the coin is cosmetic only: payouts and ratings are the same whatever coin a side flips", () => {
    const run = (coin: string | null) => {
      const s = open(":memory:", { cosmetics: DRAWN_COINS });
      const a = seat(s, "a", "Swarm");
      const b = seat(s, "b", "Null");
      credit(s, a.ownerId, 300);
      s.buyCosmetic(a.ownerId, "coin-s0-dial-up-dime");
      s.setLoadout(a.ownerId, a.agentId, "coin", coin);
      s.startMatch({ matchId: "m", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId });
      const m = s.recordMatch({ matchId: "m", seed: 7, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: a.agentId }, finalHealth: { p1: 4, p2: 0 } });
      const side = (r: NonNullable<typeof m.ratings>["p1"]) => ({ score: r.score, before: r.before, after: r.after });
      return { credits: [m.p1Credits, m.p2Credits], ratings: [side(m.ratings!.p1), side(m.ratings!.p2)], boast: m.boast!.itemId };
    };
    expect(run("coin-s0-dial-up-dime")).toEqual(run(null));
    expect(run(STARTER_COIN.itemId)).toEqual(run(null));
  });
});

describe("coins: the tier coins at season end", () => {
  it("grants each owner the coins its tier earns, once, as bound season rewards", () => {
    const s = open();
    const owners = Object.fromEntries(
      (
        [
          ["mythic", 1990],
          ["diamond", 1800],
          ["platinum", 1650],
          ["gold", 1649.9],
          ["bronze", 1200],
        ] as const
      ).map(([name, rating]) => {
        const o = s.createOwner({ name });
        rate(s, o.ownerId, rating);
        return [name, o.ownerId];
      }),
    ) as Record<string, string>;
    // Mythic-rated but still in placement: no tier, so no coin.
    const placing = s.createOwner({ name: "placing" });
    rate(s, placing.ownerId, 2100, 4);
    const fresh = s.createOwner({ name: "fresh" });

    expect(s.seasonTierCoins(owners.diamond!)).toEqual({
      tier: "Diamond",
      coins: [
        { itemId: "coin-s0-platinum", name: "Platinum Coin", tier: "Platinum", owned: false },
        { itemId: "coin-s0-diamond", name: "Diamond Coin", tier: "Diamond", owned: false },
      ],
    });
    expect(s.seasonTierCoins(placing.ownerId)).toEqual({ tier: "Placement", coins: [] });

    const granted = s.grantSeasonTierCoins();
    expect(granted).toEqual([
      { ownerId: owners.mythic, tier: "Mythic", granted: ["coin-s0-platinum", "coin-s0-diamond", "coin-s0-mythic"] },
      { ownerId: owners.diamond, tier: "Diamond", granted: ["coin-s0-platinum", "coin-s0-diamond"] },
      { ownerId: owners.platinum, tier: "Platinum", granted: ["coin-s0-platinum"] },
    ]);
    for (const id of [owners.gold!, owners.bronze!, placing.ownerId, fresh.ownerId]) expect(s.ownedCosmetics(id)).toEqual([]);
    const mythic = s.ownedCosmetics(owners.mythic!);
    expect(mythic.map((c) => [c.itemId, c.source, c.rewardRef, c.ledgerEntryId])).toEqual([
      ["coin-s0-diamond", "seasonReward", "S0:Diamond", null],
      ["coin-s0-mythic", "seasonReward", "S0:Mythic", null],
      ["coin-s0-platinum", "seasonReward", "S0:Platinum", null],
    ]);
    // Free: no ledger rows.
    expect(s.ledger(owners.mythic!)).toEqual([]);
    // Run twice: nothing new.
    expect(s.grantSeasonTierCoins().every((r) => r.granted.length === 0)).toBe(true);
    expect(s.seasonTierCoins(owners.platinum!).coins.every((c) => c.owned)).toBe(true);
    // Bound, like every cosmetic; and a season reward must name its reward.
    expect(() => s.unsafeExec(`DELETE FROM owned_cosmetics`)).toThrow(/account-bound/);
    expect(() =>
      s.unsafeExec(`INSERT INTO owned_cosmetics (owner_id, item_id, kind, source, acquired_at) VALUES ('${owners.gold}', 'coin-s0-mythic', 'coin', 'seasonReward', '${DAY1}')`),
    ).toThrow(/CHECK/);
    expect(() =>
      s.unsafeExec(`INSERT INTO owned_cosmetics (owner_id, item_id, kind, source, reward_ref, acquired_at) VALUES ('${owners.gold}', 'coin-s0-dial-up-dime', 'coin', 'starter', 'S0:Mythic', '${DAY1}')`),
    ).toThrow(/CHECK/);
  });

  it("an owner equips a tier coin like any other; a season with no tier coins grants nothing", () => {
    const s = open();
    const a = seat(s, "a", "Cortex");
    rate(s, a.ownerId, 1700);
    s.grantSeasonTierCoins();
    expect(s.setLoadout(a.ownerId, a.agentId, "coin", "coin-s0-platinum").coin).toBe("coin-s0-platinum");
    expect(() => s.setLoadout(a.ownerId, a.agentId, "coin", "coin-s0-diamond")).toThrow(/doesn't own "Diamond Coin"/);
    s.close();
    // Season 1 has no tier coins in the catalogue yet: nothing to grant.
    const s1 = open(":memory:", { season: "S1" });
    const o = s1.createOwner({ name: "o" });
    rate(s1, o.ownerId, 2000);
    expect(s1.grantSeasonTierCoins()).toEqual([]);
    expect(s1.seasonTierCoins(o.ownerId)).toEqual({ tier: "Mythic", coins: [] });
  });
});

describe("coins: migration v19 -> v20", () => {
  it("gives existing owners the Chrome Token, equips it, keeps every cosmetic and loadout; old matches have no coin or starting ratings", () => {
    const path = tmpFile();
    const v19 = open(path, { migrateTo: 19, cosmetics: DRAWN_COINS.filter((c) => c.kind !== "coin" || c === STARTER_COIN) });
    expect(v19.schemaVersion).toBe(19);
    const a = seat(v19, "a", "Swarm");
    const b = seat(v19, "b", "Aegis");
    const bare = v19.createOwner({ name: "bare" });
    const bareAgent = v19.createAgent({ ownerId: bare.ownerId, name: "bare-agent" });
    v19.setLoadout(a.ownerId, a.agentId, "closeWinBoast", STARTER_BOASTS.Null.itemId);
    // v19: no coin anywhere.
    expect(v19.ownedCosmetics(a.ownerId).map((c) => c.itemId)).not.toContain(STARTER_COIN.itemId);
    v19.startMatch({ matchId: "old", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId });
    const old = v19.recordMatch({ matchId: "old", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: a.agentId }, finalHealth: { p1: 10, p2: 0 } });
    expect(old.loadouts!.p1.coin).toBeNull();
    expect(old.ratingsAtStart).toBeNull();
    const ownedBefore = v19.ownedCosmetics(a.ownerId);
    v19.close();

    clock = new Date("2026-11-03T09:00:00.000Z");
    const v20 = open(path, { cosmetics: DRAWN_COINS });
    expect(v20.schemaVersion).toBe(21);
    for (const o of [a, b]) {
      const owned = v20.ownedCosmetics(o.ownerId);
      const token = owned.find((c) => c.itemId === STARTER_COIN.itemId)!;
      expect(token).toMatchObject({ kind: "coin", source: "starter", acquiredAt: v20.getOwner(o.ownerId).starterGrantedAt });
      expect(v20.loadout(o.agentId).coin).toBe(STARTER_COIN.itemId);
    }
    // Everything owned before is still there, unchanged.
    expect(v20.ownedCosmetics(a.ownerId).filter((c) => c.itemId !== STARTER_COIN.itemId)).toEqual(ownedBefore.map((c) => ({ ...c, rewardRef: null })));
    expect(v20.loadout(a.agentId)).toMatchObject({ boast: STARTER_BOASTS.Swarm.itemId, closeWinBoast: STARTER_BOASTS.Null.itemId, coin: STARTER_COIN.itemId });
    // An owner without a starter collection: nothing, until it gets one.
    expect(v20.ownedCosmetics(bare.ownerId)).toEqual([]);
    expect(v20.loadout(bareAgent.agentId).coin).toBeNull();
    v20.grantStarterCollection(bare.ownerId, "Null");
    expect(v20.loadout(bareAgent.agentId).coin).toBe(STARTER_COIN.itemId);
    // The old match: no coin, no starting ratings; it reads as the Chrome Token.
    const oldNow = v20.matchById("old")!;
    expect(oldNow.loadouts!.p1).toMatchObject({ coin: null, closeWinBoast: STARTER_BOASTS.Null.itemId });
    expect(coinOf(oldNow.loadouts!.p1)).toBe(STARTER_COIN.itemId);
    expect(oldNow.ratingsAtStart).toBeNull();
    // The schema's rules came through the rebuild.
    expect(() => v20.unsafeExec(`DELETE FROM owned_cosmetics`)).toThrow(/account-bound/);
    expect(() => v20.unsafeExec(`INSERT INTO agent_loadouts (agent_id, slot, item_id, set_at) VALUES ('${b.agentId}', 'arena', '${STARTER_COIN.itemId}', '${DAY1}')`)).toThrow(/slot of its kind/);
    expect(() =>
      v20.unsafeExec(`INSERT INTO owned_cosmetics (owner_id, item_id, kind, source, ledger_entry_id, acquired_at) VALUES ('${bare.ownerId}', 'coin-s0-neon-nickel', 'coin', 'purchase', NULL, '${DAY1}')`),
    ).toThrow(/CHECK|credits payment/);
    // New matches record both.
    v20.startMatch({ matchId: "new", p1OwnerId: b.ownerId, p2OwnerId: a.ownerId });
    const fresh = v20.recordMatch({ matchId: "new", seed: 2, p1AgentId: b.agentId, p2AgentId: a.agentId, outcome: { kind: "draw" } });
    expect(fresh.loadouts!.p1.coin).toBe(STARTER_COIN.itemId);
    expect(fresh.ratingsAtStart).toEqual({ p1: expect.any(Number), p2: expect.any(Number) });
    v20.close();
  });
});
