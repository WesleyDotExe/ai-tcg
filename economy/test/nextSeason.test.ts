// The next season's file (schema v27; Season 0 game item 3, part 2; owner
// 2026-11-07 answers 1-7 and 2026-11-08 on unopened packs).
// startNextSeason makes a new file from an ended one, in one transaction:
// accounts and logins, settings, the Home board, agents and names,
// signature cards with their bound copies, every cosmetic and loadout and
// the retired Prototype runs carry over; the collection, decks, credits,
// pack points, packs, ratings, history and notifications start empty; the
// ratings soft-reset; every owner gets the starter grant again. An ended
// file is frozen completely (answer 6).

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SHIPPED_DECK_LISTS, type DeckFaction } from "@ai-tcg/engine";
import {
  COSMETICS,
  EconomyStore,
  LIVE_PACK_ODDS,
  SEASON_0_COINS,
  STARTER_BOASTS,
  STARTER_COIN,
  STARTER_PACKS,
  cardSet,
  rollPack,
  type CosmeticItem,
  type PityState,
} from "../src/index.js";

const DAY1 = "2026-12-20T10:00:00.000Z";
let clock = new Date(DAY1);
const tmpDirs: string[] = [];
afterEach(() => {
  clock = new Date(DAY1);
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmpDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "next-season-"));
  tmpDirs.push(dir);
  return dir;
};
const PASSWORD = "a long test password";
const CATALOGUE: readonly CosmeticItem[] = COSMETICS.map((c) => (SEASON_0_COINS.some((s) => s.itemId === c.itemId) ? { ...c, drawn: true } : c));
const open = (path: string, season?: string, migrateTo?: number) => EconomyStore.open(path, { now: () => clock, cosmetics: CATALOGUE, season, migrateTo });
const next = (from: string, to: string, season = "S1") => EconomyStore.startNextSeason(from, to, { season, now: () => clock, cosmetics: CATALOGUE });

const S0 = cardSet("S0");
const NO_PITY: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
const ALL_RUNS = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));
function prototypeSeed(): number {
  for (let seed = 0; seed < 1_000_000; seed++) if (rollPack(seed, S0, NO_PITY, ALL_RUNS, LIVE_PACK_ODDS).pulls[5]?.finish === "prototype") return seed;
  throw new Error("no seed found");
}
function credit(s: EconomyStore, ownerId: string, amount: number) {
  s.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${ownerId}', 'credits', ${amount}, 'testGrant', '${clock.toISOString()}')`);
}
function rate(s: EconomyStore, ownerId: string, rating: number, matches = 5, volatility = 0.06) {
  s.unsafeExec(
    `INSERT INTO ratings (owner_id, rating, rd, volatility, matches, last_day, updated_at) VALUES ('${ownerId}', ${rating}, 60, ${volatility}, ${matches}, '2026-12-20', '${DAY1}')`,
  );
}
/** A player owner with a login, its starter collection, a generated agent
 * (signature card) connected, and the starter deck saved and active. */
function player(s: EconomyStore, name: string, faction: DeckFaction, seed: number) {
  const owner = s.createAccount({ name, username: `${name.toLowerCase()}-login`, password: PASSWORD });
  const { copies } = s.grantStarterCollection(owner.ownerId, faction);
  const draft = s.startAgentDraft(owner.ownerId, { seed });
  s.pickDraftAgent(owner.ownerId, draft.draftId, 0, { seed: seed + 1000 });
  const gen = s.confirmAgentDraft(owner.ownerId, draft.draftId, 0);
  s.connectAgent(owner.ownerId, gen.agent.agentId);
  const deck = s.saveDeck(owner.ownerId, "starter", copies.map((c) => c.copyId));
  s.setActiveDeck(owner.ownerId, deck.deckId);
  return { ownerId: owner.ownerId, agentId: gen.agent.agentId, signatureCopyId: gen.copy.copyId, signatureCardId: gen.signature.cardId };
}

/** A Season 0 file with three players, played, then ended. */
function endedSeasonZero(dir: string, migrateTo?: number) {
  const path = join(dir, "season-0.db");
  const s = open(path, undefined, migrateTo);
  const ada = player(s, "Ada", "Cortex", 11);
  const bram = player(s, "Bram", "Aegis", 22);
  const cy = player(s, "Cy", "Swarm", 33);
  const never = s.createAccount({ name: "Dee", username: "dee", password: PASSWORD }); // no faction picked yet
  // Ada: settings, a board, a rename, a bought coin equipped, and 2 packs she never opens.
  s.updateAccountSettings(ada.ownerId, { theme: "dark", background: "aurora" });
  s.saveBoardLayout(ada.ownerId, { widgets: [] });
  s.renameAgent(ada.ownerId, ada.agentId, "Ada Prime");
  credit(s, ada.ownerId, 1000);
  s.buyCosmetic(ada.ownerId, "coin-s0-neon-nickel");
  s.setLoadout(ada.ownerId, ada.agentId, "coin", "coin-s0-neon-nickel");
  s.buyPacks(ada.ownerId, "S0", 2);
  s.recordMatch({ matchId: "m1", seed: 1, p1AgentId: ada.agentId, p2AgentId: bram.agentId, outcome: { kind: "win", winnerAgentId: ada.agentId }, endedAt: DAY1 });
  rate(s, cy.ownerId, 1182, 5, 0.07);
  s.unsafeExec(`UPDATE ratings SET rating = 1827, matches = 9 WHERE owner_id = '${ada.ownerId}'`);
  const signIn = s.signIn("bram-login", PASSWORD);
  s.endSeason();
  const end = s.seasonEnd()!;
  s.close();
  return { path, ada, bram, cy, never, end, bramToken: signIn.token };
}

describe("the next season's file (v27)", () => {
  it("is refused from an open season, under the same name, onto an existing file, and leaves no half-made file", () => {
    const dir = tmpDir();
    const openPath = join(dir, "open.db");
    open(openPath).close();
    expect(() => next(openPath, join(dir, "s1.db"))).toThrow(/season S0 hasn't ended: end it first/);
    expect(existsSync(join(dir, "s1.db"))).toBe(false);
    const { path } = endedSeasonZero(dir);
    expect(() => next(path, join(dir, "s1.db"), "S0")).toThrow(/the new season must have a new name/);
    expect(() => next(path, join(dir, "s1.db"), " ")).toThrow(/name the new season/);
    expect(() => next(path, openPath)).toThrow(/already exists/);
    clock = new Date("2026-12-01T00:00:00.000Z"); // before the end
    expect(() => next(path, join(dir, "s1.db"))).toThrow(/the next season can't start before that/);
    expect(existsSync(join(dir, "s1.db"))).toBe(false);
  });

  it("carries accounts, settings, board, agents, signature copies, cosmetics and loadouts; starts the rest empty", () => {
    const dir = tmpDir();
    const { path, ada, bram, cy, never, end, bramToken } = endedSeasonZero(dir);
    const archive = open(path);
    const before = {
      owners: archive.listOwners().map((o) => [o.ownerId, o.name, o.kind, o.startingFaction, o.factionLock, o.connectedAgentId]),
      agents: archive.listAgents().map((a) => [a.agentId, a.ownerId, a.name, a.playStyle]),
      names: archive.agentNames(ada.agentId),
      settings: archive.accountSettings(ada.ownerId),
      board: archive.boardLayout(ada.ownerId),
      cosmetics: archive.ownedCosmetics(ada.ownerId).map((c) => [c.itemId, c.source, c.rewardRef]),
      loadouts: [ada, bram, cy].map((p) => archive.loadout(p.agentId)),
      sig: archive.signatureCard(ada.agentId),
      unopened: archive.unopenedPacks(ada.ownerId).length,
    };
    expect(before.unopened).toBe(STARTER_PACKS + 2);
    archive.close();

    clock = new Date("2027-01-17T00:00:00.000Z");
    const report = next(path, join(dir, "season-1.db"));
    expect(report).toMatchObject({ season: "S1", fromSeason: "S0", fromEndedAt: end.endedAt, startedAt: clock.toISOString(), owners: 4, logins: 4, agents: 3, signatureCopies: 3, retiredPrototypeRuns: 15, ratingSeeds: 3 });
    const deckSize = (f: DeckFaction) => SHIPPED_DECK_LISTS[f]!.reduce((n, l) => n + l.copies, 0);
    expect(report.starterGrants.map((g) => [g.faction, g.copies, g.packs])).toEqual(
      (["Cortex", "Aegis", "Swarm"] as const).map((f) => [f, deckSize(f), STARTER_PACKS]),
    );
    expect(report.leftBehind.unopenedPacks).toBe(3 * STARTER_PACKS + 2);
    expect(report.leftBehind.decks).toBe(3);
    expect(report.leftBehind.matches).toBe(1);

    const s1 = open(join(dir, "season-1.db"));
    expect(s1.season).toBe("S1");
    expect(s1.schemaVersion).toBe(29);
    expect(s1.seasonEnded()).toBe(false);
    expect(s1.currentSetCode).toBe("S0"); // no S1 set yet: the newest set
    expect(s1.seasonStart()).toEqual({ season: "S1", fromSeason: "S0", fromEndedAt: end.endedAt, startedAt: "2027-01-17T00:00:00.000Z" });
    // Answer 2, what carries.
    expect(s1.listOwners().map((o) => [o.ownerId, o.name, o.kind, o.startingFaction, o.factionLock, o.connectedAgentId])).toEqual(before.owners);
    expect(s1.listAgents().map((a) => [a.agentId, a.ownerId, a.name, a.playStyle])).toEqual(before.agents);
    expect(s1.agentNames(ada.agentId)).toEqual(before.names);
    expect(s1.agentNames(ada.agentId).current).toBe("Ada Prime");
    expect(s1.accountSettings(ada.ownerId)).toEqual(before.settings);
    expect(s1.boardLayout(ada.ownerId)).toEqual(before.board);
    expect(s1.signIn("ada-login", PASSWORD).ownerId).toBe(ada.ownerId);
    expect(s1.authenticate(bramToken).ownerId).toBe(bram.ownerId); // still signed in
    expect(s1.isAdmin(ada.ownerId)).toBe(false);
    expect(s1.signatureCard(ada.agentId)).toEqual(before.sig);
    const sigCopy = s1.getCopy(ada.signatureCopyId);
    expect(sigCopy).toMatchObject({ ownerId: ada.ownerId, cardId: ada.signatureCardId, accountBound: true, originRef: `signature:${ada.agentId}` });
    // Answer 1, every cosmetic and loadout, the bought coin too (no payment in the new ledger).
    expect(s1.ownedCosmetics(ada.ownerId).map((c) => [c.itemId, c.source, c.rewardRef])).toEqual(before.cosmetics);
    expect(s1.ownedCosmetics(ada.ownerId).every((c) => c.carriedFrom === "S0" && c.ledgerEntryId === null)).toBe(true);
    expect(s1.ownedCosmetics(ada.ownerId).map((c) => c.itemId)).toEqual(expect.arrayContaining(["coin-s0-neon-nickel", STARTER_COIN.itemId, STARTER_BOASTS.Cortex.itemId]));
    expect([ada, bram, cy].map((p) => s1.loadout(p.agentId))).toEqual(before.loadouts);
    expect(s1.loadout(ada.agentId).coin).toBe("coin-s0-neon-nickel");
    // Answers 2 and 3, what starts empty: nothing but the new starter grant.
    for (const p of [ada, bram, cy]) {
      expect(s1.wallet(p.ownerId)).toMatchObject({ credits: 0, packPoints: 0 });
      expect(s1.ledger(p.ownerId)).toEqual([]);
      expect(s1.listDecks(p.ownerId)).toEqual([]);
      expect(s1.getOwner(p.ownerId)).toMatchObject({ activeDeckId: null, deckChoice: "agent", starterGrantedAt: "2027-01-17T00:00:00.000Z" });
      expect(s1.unopenedPacks(p.ownerId)).toHaveLength(STARTER_PACKS); // the S0 packs are gone
      expect(s1.matchHistory({ ownerId: p.ownerId })).toEqual([]);
      // Only today's daily pack: the bank fills from the season's start, not the S0 sign-up.
      expect(s1.notifications(p.ownerId).notifications.map((n) => n.kind)).toEqual(["dailyPack"]);
      expect(s1.dailyPackStatus(p.ownerId)).toMatchObject({ setCode: "S0", waiting: 1 });
      expect(s1.autoPlay(p.ownerId).on).toBe(false);
    }
    // Answer 5, the starter grant again: the faction's deck, bound, plus the starter packs.
    const adaCards = s1.collection(ada.ownerId).filter((c) => c.origin === "starter");
    expect(adaCards).toHaveLength(SHIPPED_DECK_LISTS.Cortex!.reduce((n, l) => n + l.copies, 0));
    expect(adaCards.every((c) => c.accountBound)).toBe(true);
    expect(s1.collection(ada.ownerId)).toHaveLength(adaCards.length + 1); // + the signature copy
    expect(s1.claimDailyPack(ada.ownerId).pack.setCode).toBe("S0");
    expect(s1.dailyPackStatus(ada.ownerId).waiting).toBe(0);
    // Dee never picked a faction: no grant yet, and she still can.
    expect(s1.getOwner(never.ownerId).starterGrantedAt).toBeNull();
    expect(s1.grantStarterCollection(never.ownerId, "Null").copies.length).toBeGreaterThan(0);
    s1.close();

    // The archive is untouched and still frozen.
    const again = open(path);
    expect(again.season).toBe("S0");
    expect(again.seasonEnd()).toEqual(end);
    expect(again.unopenedPacks(ada.ownerId)).toHaveLength(STARTER_PACKS + 2);
    expect(again.seasonStart()).toBeNull();
    again.close();
  });

  it("answer 4, the soft reset: 1500 + (final - 1500) / 2, RD 250, volatility kept; everyone places again", () => {
    const dir = tmpDir();
    const { path, ada, bram, cy, never, end } = endedSeasonZero(dir);
    const finals = new Map(end.standings.map((r) => [r.ownerId, r]));
    expect(finals.get(ada.ownerId)!.rating).toBeCloseTo(1827, 0);
    next(path, join(dir, "s1.db"));
    const s1 = open(join(dir, "s1.db"));
    for (const p of [ada, bram, cy]) {
      const f = finals.get(p.ownerId)!;
      const r = s1.rating(p.ownerId);
      expect(r.rating).toBeCloseTo(1500 + (f.rating - 1500) / 2, 9);
      expect(r.rd).toBe(250);
      expect(r.volatility).toBe(f.volatility);
      expect(r.ratedMatches).toBe(0);
      expect(r.tier).toBe("Placement");
      expect(s1.ratingSeed(p.ownerId)).toMatchObject({ finalRating: f.rating, finalTier: f.tier });
    }
    expect(s1.rating(ada.ownerId).rating).toBeCloseTo(1663.5, 0); // the check-in's example
    expect(s1.rating(cy.ownerId).rating).toBeCloseTo(1341, 0);
    // An owner with no rated match last season starts at the start.
    expect(s1.ratingSeed(never.ownerId)).toBeNull();
    expect(s1.rating(never.ownerId)).toMatchObject({ rating: 1500, rd: 350, ratedMatches: 0 });
    // The ladder lists nobody until a rated match; the first match plays from the seeds.
    expect(s1.ladder()).toEqual([]);
    const seedA = s1.rating(ada.ownerId);
    const deckOf = (ownerId: string) => {
      const ids = s1.collection(ownerId).filter((c) => c.origin === "starter").map((c) => c.copyId);
      s1.setActiveDeck(ownerId, s1.saveDeck(ownerId, "starter", ids).deckId);
    };
    deckOf(ada.ownerId);
    deckOf(cy.ownerId);
    const m = s1.recordMatch({ matchId: "s1-m1", seed: 1, p1AgentId: ada.agentId, p2AgentId: cy.agentId, outcome: { kind: "win", winnerAgentId: cy.agentId }, endedAt: clock.toISOString() });
    expect(m.ratings!.p1.before).toEqual({ rating: seedA.rating, rd: 250, volatility: seedA.volatility });
    expect(s1.rating(ada.ownerId)).toMatchObject({ ratedMatches: 1, tier: "Placement" });
    expect(s1.ladder().map((r) => [r.ownerId, r.rank])).toEqual([
      [ada.ownerId, null],
      [cy.ownerId, null],
    ].sort((a, b) => s1.rating(b[0]!).rating - s1.rating(a[0]!).rating));
    // The seeds are write-once.
    expect(() => s1.unsafeExec(`UPDATE rating_seeds SET rating = 2500`)).toThrow(/written once/);
    expect(() => s1.unsafeExec(`DELETE FROM rating_seeds`)).toThrow(/written once/);
    expect(() => s1.unsafeExec(`INSERT INTO rating_seeds VALUES ('${never.ownerId}', 2000, 250, 0.06, 2500, 'Mythic')`)).toThrow(/only while the season's file is being made/);
    expect(() => s1.unsafeExec(`UPDATE season_start SET from_season = 'X'`)).toThrow(/written once/);
    s1.close();
  });

  it("carries the retired Prototype runs: the seed that found a Prototype in Season 0 rolls a Gold in Season 1", () => {
    const dir = tmpDir();
    const { path, ada } = endedSeasonZero(dir);
    next(path, join(dir, "s1.db"));
    const s1 = open(join(dir, "s1.db"));
    expect(s1.prototypesFound(S0.prototypes[0]!.code)).toBe(0);
    const opened = s1.openPack(ada.ownerId, undefined, { seed: prototypeSeed() });
    expect(opened.cards[5]!.finish).toBe("gold");
    expect(opened.cards[5]!.prototype).toBeNull();
    // A fresh Season 0 file, by contrast, rolls the Prototype on that seed.
    const fresh = open(":memory:");
    const o = fresh.createOwner({ name: "o" }).ownerId;
    fresh.grantPack(o, "S0", "weeklyChallenge");
    expect(fresh.openPack(o, undefined, { seed: prototypeSeed() }).cards[5]!.finish).toBe("prototype");
    s1.close();
  });

  it("a file made from S1 carries on to S2: cosmetics keep the season they first came from", () => {
    const dir = tmpDir();
    const { path, ada } = endedSeasonZero(dir);
    next(path, join(dir, "s1.db"));
    const s1 = open(join(dir, "s1.db"));
    s1.endSeason();
    s1.close();
    const report = next(join(dir, "s1.db"), join(dir, "s2.db"), "S2");
    expect(report).toMatchObject({ season: "S2", fromSeason: "S1", owners: 4, retiredPrototypeRuns: 15, ratingSeeds: 0 });
    const s2 = open(join(dir, "s2.db"));
    expect(s2.ownedCosmetics(ada.ownerId).every((c) => c.carriedFrom === "S0")).toBe(true);
    expect(s2.loadout(ada.agentId).coin).toBe("coin-s0-neon-nickel");
    s2.close();
  });

  it("answer 6: an ended file is frozen completely, in the store and in the schema", () => {
    const dir = tmpDir();
    const { path, ada, bram } = endedSeasonZero(dir);
    const s = open(path);
    const frozen = /season S0 has ended: .*the file is the season's archive/;
    expect(() => s.buyPack(ada.ownerId, "S0")).toThrow(frozen);
    expect(() => s.buyPacks(ada.ownerId, "S0", 10)).toThrow(frozen);
    expect(() => s.grantPack(ada.ownerId, "S0", "weeklyChallenge")).toThrow(frozen);
    expect(() => s.claimDailyPack(ada.ownerId)).toThrow(frozen);
    expect(() => s.openPack(ada.ownerId)).toThrow(frozen);
    expect(() => s.openPacks(ada.ownerId, 1)).toThrow(frozen);
    expect(() => s.salvage(ada.ownerId, s.collection(ada.ownerId)[0]!.cardId, 1)).toThrow(frozen);
    expect(() => s.craftCard(ada.ownerId, s.collection(ada.ownerId)[0]!.cardId)).toThrow(frozen);
    expect(() => s.buyCosmetic(bram.ownerId, "coin-s0-dial-up-dime")).toThrow(frozen);
    expect(() => s.grantStarterCollection(s.createOwner({ name: "late" }).ownerId, "Null")).toThrow(frozen);
    // The schema refuses the same writes, whatever a hand edit tries.
    expect(() => credit(s, ada.ownerId, 100)).toThrow(/credits and pack points are frozen/);
    expect(() => s.unsafeExec(`INSERT INTO packs (pack_id, owner_id, set_code, source, acquired_at) VALUES ('p', '${ada.ownerId}', 'S0', 'weeklyChallenge', '${DAY1}')`)).toThrow(/no pack is bought or granted/);
    expect(() => s.unsafeExec(`UPDATE card_copies SET disposed_at = '${DAY1}', disposed_reason = 'salvaged' WHERE owner_id = '${ada.ownerId}'`)).toThrow(/the collection is frozen/);
    expect(() => s.grantCopy({ ownerId: ada.ownerId, cardId: s.collection(ada.ownerId)[0]!.cardId, origin: "promo", stamp: "TEST" })).toThrow(/the collection is frozen/);
    // A free rename and the settings still work: they're not the economy.
    expect(s.updateAccountSettings(ada.ownerId, { theme: "light" }).theme).toBe("light");
    s.close();
  });
});

// (session 85) The archive is only ever read. Before this, startNextSeason
// opened the ended file with EconomyStore.open: an older-schema archive was
// migrated in place, and a mistyped path was created as a fresh empty file.
describe("the next season's file never writes to the archive", () => {
  const sha = (path: string) => (existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : "absent");
  const LATEST = EconomyStore.open(":memory:").schemaVersion;

  it("a mistyped ended file is refused and not created", () => {
    const dir = tmpDir();
    const typo = join(dir, "season-O.db");
    expect(() => next(typo, join(dir, "s1.db"))).toThrow(`no season file at "${typo}"`);
    expect(existsSync(typo)).toBe(false);
    expect(existsSync(join(dir, "s1.db"))).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("an archive at an older schema stays at its schema, byte for byte; the new file is made from a migrated copy", () => {
    const dir = tmpDir();
    const older = LATEST - 1; // v27: ended before v28 existed
    const { path, ada } = endedSeasonZero(dir, older);
    const before = sha(path);
    const r = next(path, join(dir, "s1.db"));
    expect(sha(path)).toBe(before);
    // A read-only reader of a WAL file may leave an empty log beside it; it
    // holds nothing.
    expect(existsSync(`${path}-wal`) ? readFileSync(`${path}-wal`).length : 0).toBe(0);
    const probe = new DatabaseSync(path, { readOnly: true });
    const archive = probe.prepare("PRAGMA user_version").get()?.user_version; // the old code migrated it in place
    probe.close();
    expect(archive).toBe(older);
    expect(r.fromSeason).toBe("S0");
    const s1 = open(join(dir, "s1.db"));
    expect(s1.schemaVersion).toBe(LATEST);
    expect(s1.getOwner(ada.ownerId).name).toBe("Ada");
    expect(s1.listAgents().find((a) => a.agentId === ada.agentId)?.name).toBe("Ada Prime");
    s1.close();
  });

  it("an archive whose server stopped before checkpointing: its log is read, and neither file changes", () => {
    const dir = tmpDir();
    const { path, ada } = endedSeasonZero(dir);
    // A settings change after the end (allowed in the archive), copied while
    // the store is still open: the copy's change lives only in its -wal file.
    const s = open(path);
    s.updateAccountSettings(ada.ownerId, { theme: "light" });
    const crashed = join(dir, "crashed.db");
    copyFileSync(path, crashed);
    copyFileSync(`${path}-wal`, `${crashed}-wal`);
    s.close();
    const before = [sha(crashed), sha(`${crashed}-wal`)];
    expect(before[1]).not.toBe("absent");
    next(crashed, join(dir, "s1.db"));
    expect([sha(crashed), sha(`${crashed}-wal`)]).toEqual(before);
    const s1 = open(join(dir, "s1.db"));
    expect(s1.accountSettings(ada.ownerId).theme).toBe("light");
    s1.close();
  });

  it("openReadOnly refuses every write, a missing file, and a file at another schema", () => {
    const dir = tmpDir();
    const { path, ada } = endedSeasonZero(dir);
    const before = sha(path);
    const ro = EconomyStore.openReadOnly(path, { cosmetics: CATALOGUE });
    expect(ro.seasonEnded()).toBe(true);
    expect(ro.getOwner(ada.ownerId).name).toBe("Ada");
    expect(() => ro.updateAccountSettings(ada.ownerId, { theme: "light" })).toThrow(/readonly/i);
    ro.close();
    expect(sha(path)).toBe(before);
    expect(() => EconomyStore.openReadOnly(join(dir, "nope.db"))).toThrow(/no season file/);
    expect(existsSync(join(dir, "nope.db"))).toBe(false);
    const old = join(dir, "old.db");
    EconomyStore.open(old, { migrateTo: LATEST - 1 }).close();
    expect(() => EconomyStore.openReadOnly(old)).toThrow(`is schema v${LATEST - 1}, this code reads v${LATEST} read-only`);
  });
});
