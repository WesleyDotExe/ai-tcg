// The season's end, part 1 (schema v26; Season 0 game item 3; ECONOMY.md
// "Seasons" and "Prototypes"): endSeason grants the tier coins first, then
// freezes the final standings, then retires every Prototype run of the
// season's set with what it found. After it the file is the season's
// archive: no match starts or is recorded, no rating moves, and a retired
// run mints nothing (a pack's Prototype bonus becomes a Gold), each refused
// by the schema too.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DeckFaction } from "@ai-tcg/engine";
import { EconomyStore, LIVE_PACK_ODDS, cardSet, rollPack, seasonSets, type PityState } from "../src/index.js";

const DAY1 = "2026-11-02T10:00:00.000Z";
let clock = new Date(DAY1);
const tmpDirs: string[] = [];
afterEach(() => {
  clock = new Date(DAY1);
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmpFile = () => {
  const dir = mkdtempSync(join(tmpdir(), "season-end-"));
  tmpDirs.push(dir);
  return join(dir, "season.db");
};
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo });

const S0 = cardSet("S0");
const NO_PITY: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
const ALL_RUNS = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));
/** The first seed whose live-table pack has a Prototype bonus. */
function prototypeSeed(): number {
  for (let seed = 0; seed < 1_000_000; seed++) if (rollPack(seed, S0, NO_PITY, ALL_RUNS, LIVE_PACK_ODDS).pulls[5]?.finish === "prototype") return seed;
  throw new Error("no seed found");
}

/** An owner with its starter collection, an agent, and the starter deck saved and active. */
function seat(s: EconomyStore, name: string, faction: DeckFaction) {
  const owner = s.createOwner({ name });
  const { copies } = s.grantStarterCollection(owner.ownerId, faction);
  const agent = s.createAgent({ ownerId: owner.ownerId, name: `${name}-agent` });
  const deck = s.saveDeck(owner.ownerId, "starter", copies.map((c) => c.copyId));
  s.setActiveDeck(owner.ownerId, deck.deckId);
  s.connectAgent(owner.ownerId, agent.agentId);
  return { ownerId: owner.ownerId, agentId: agent.agentId };
}

/** Puts an owner's stored rating at `rating` (placed with 5 rated matches). */
function rate(s: EconomyStore, ownerId: string, rating: number, matches = 5) {
  s.unsafeExec(
    `INSERT INTO ratings (owner_id, rating, rd, volatility, matches, last_day, updated_at) VALUES ('${ownerId}', ${rating}, 60, 0.06, ${matches}, '2026-11-02', '${DAY1}')
     ON CONFLICT (owner_id) DO UPDATE SET rating = excluded.rating, matches = excluded.matches`,
  );
}

describe("the season's end (v26)", () => {
  it("every Season 0 set names its season; S0's runs are the ones its end retires", () => {
    expect(S0.season).toBe("S0");
    expect(seasonSets("S0").map((s) => s.code)).toEqual(["S0"]);
    expect(seasonSets("S1")).toEqual([]);
  });

  it("grants the tier coins, freezes the standings and retires every Prototype run with what it found, in one call", () => {
    const s = open();
    expect(s.seasonEnded()).toBe(false);
    expect(s.seasonEnd()).toBeNull();
    const mythic = seat(s, "mythic", "Cortex");
    const diamond = seat(s, "diamond", "Swarm");
    const gold = seat(s, "gold", "Aegis");
    const placing = seat(s, "placing", "Null");
    seat(s, "unrated", "Cortex");
    rate(s, mythic.ownerId, 1990);
    rate(s, diamond.ownerId, 1800);
    rate(s, gold.ownerId, 1550);
    rate(s, placing.ownerId, 2100, 4);
    // Two real rated matches, so the standings' tallies come from match_ratings.
    s.recordMatch({ matchId: "m1", seed: 1, p1AgentId: mythic.agentId, p2AgentId: gold.agentId, outcome: { kind: "win", winnerAgentId: mythic.agentId }, endedAt: DAY1 });
    s.recordMatch({ matchId: "m2", seed: 2, p1AgentId: diamond.agentId, p2AgentId: gold.agentId, outcome: { kind: "draw" }, endedAt: DAY1 });
    // One Prototype found before the end.
    const o = s.createOwner({ name: "opener" }).ownerId;
    s.grantPack(o, "S0", "weeklyChallenge");
    const pulled = s.openPack(o, undefined, { seed: prototypeSeed() }).cards[5]!.prototype!;
    expect(pulled.serial).toBe(1);

    const before = Object.fromEntries([mythic, diamond, gold, placing].map((p) => [p.ownerId, s.rating(p.ownerId)]));
    clock = new Date("2026-12-14T09:00:00.000Z");
    const end = s.endSeason();
    expect(end.season).toBe("S0");
    expect(end.endedAt).toBe("2026-12-14T09:00:00.000Z");
    expect(s.seasonEnded()).toBe(true);
    expect(s.seasonEnd()).toEqual(end);

    // The standings: placed owners by rank, then placement (rank null);
    // an owner with no rated match isn't on the ladder, so isn't listed.
    expect(end.standings.map((r) => [r.ownerName, r.rank, r.tier])).toEqual([
      ["mythic", 1, s.rating(mythic.ownerId, end.endedAt).tier],
      ["diamond", 2, s.rating(diamond.ownerId, end.endedAt).tier],
      ["gold", 3, s.rating(gold.ownerId, end.endedAt).tier],
      ["placing", null, "Placement"],
    ]);
    for (const r of end.standings) {
      const now = s.rating(r.ownerId, end.endedAt);
      expect([r.rating, r.rd, r.volatility, r.ratedMatches]).toEqual([now.rating, now.rd, now.volatility, now.ratedMatches]);
      expect(r.rd).toBeGreaterThanOrEqual(before[r.ownerId]!.rd); // idle days grow RD up to the end
      expect(r.agentName).toBe(`${r.ownerName}-agent`);
    }
    const line = (name: string) => end.standings.find((r) => r.ownerName === name)!;
    expect([line("mythic").wins, line("mythic").losses, line("mythic").draws]).toEqual([1, 0, 0]);
    expect([line("gold").wins, line("gold").losses, line("gold").draws]).toEqual([0, 1, 1]);
    expect([line("diamond").wins, line("diamond").losses, line("diamond").draws]).toEqual([0, 0, 1]);

    // The tier coins came first, by the tier at the end, lowest first.
    expect(line("mythic").tierCoins).toEqual(s.seasonTierCoins(mythic.ownerId, end.endedAt).coins.map((c) => c.itemId));
    expect(line("mythic").tierCoins.length).toBeGreaterThan(0);
    expect(line("placing").tierCoins).toEqual([]);
    for (const r of end.standings) expect(s.seasonTierCoins(r.ownerId, end.endedAt).coins.every((c) => c.owned)).toBe(true);

    // Every run retired; the one with a find keeps its count.
    expect(end.retiredPrototypes.map((r) => r.runCode)).toEqual(S0.prototypes.map((r) => r.code));
    for (const r of end.retiredPrototypes) {
      const run = S0.prototypes.find((p) => p.code === r.runCode)!;
      const found = r.runCode === pulled.runCode ? 1 : 0;
      expect(r).toEqual({ runCode: run.code, setCode: "S0", cardId: run.cardId, runSize: run.runSize, found, retired: run.runSize - found, retiredAt: end.endedAt });
    }
    expect(end.retiredPrototypes.reduce((n, r) => n + r.retired, 0)).toBe(1516 - 1);
  });

  it("after the end: no match starts or is recorded, ratings are final, and (v27) the file is frozen", () => {
    const s = open();
    const a = seat(s, "a", "Cortex");
    const b = seat(s, "b", "Swarm");
    rate(s, a.ownerId, 1700);
    const o = s.createOwner({ name: "opener" }).ownerId;
    s.grantPack(o, "S0", "weeklyChallenge");
    s.endSeason();

    expect(() => s.startMatch({ matchId: "late", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId })).toThrow(/season S0 has ended: no match starts/);
    expect(() => s.recordMatch({ matchId: "late", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: a.agentId } })).toThrow(
      /season S0 has ended: no match is recorded/,
    );
    expect(() => s.endSeason()).toThrow(/season S0 has already ended/);

    // (v27, owner 2026-11-07 answer 6) The ended file is frozen: the pack
    // granted before the end can't be opened in it (the same seed rolls the
    // fallback Gold in the next season's file: nextSeason.test.ts).
    expect(() => s.openPack(o, undefined, { seed: prototypeSeed() })).toThrow(/season S0 has ended: no pack is opened/);
    expect(s.unopenedPacks(o)).toHaveLength(1);

    // The schema holds it too, whatever a hand-run edit tries.
    expect(() => s.unsafeExec(`UPDATE ratings SET rating = 2500 WHERE owner_id = '${a.ownerId}'`)).toThrow(/ratings are final/);
    expect(() => s.unsafeExec(`INSERT INTO ratings (owner_id, rating, rd, volatility, matches, last_day, updated_at) VALUES ('${b.ownerId}', 1600, 60, 0.06, 5, '2026-11-02', '${DAY1}')`)).toThrow(/ratings are final/);
    expect(() =>
      s.unsafeExec(`INSERT INTO live_matches (match_id, p1_owner, p2_owner, p1_agent, p2_agent, started_at) VALUES ('x', '${a.ownerId}', '${b.ownerId}', '${a.agentId}', '${b.agentId}', '${DAY1}')`),
    ).toThrow(/no match starts/);
    expect(() =>
      s.grantCopy({ ownerId: o, cardId: S0.prototypes[3]!.cardId, origin: "pack", finish: "prototype", seriesKind: "prototype", seriesCode: S0.prototypes[3]!.code, serial: 1, runSize: S0.prototypes[3]!.runSize }),
    ).toThrow(/retired|the collection is frozen/);
    for (const table of ["season_end", "season_standings", "retired_prototype_runs"]) {
      expect(() => s.unsafeExec(`DELETE FROM ${table}`)).toThrow(/written once|retired forever/);
    }
    expect(() => s.unsafeExec(`UPDATE season_end SET ended_at = '2027-01-01T00:00:00.000Z'`)).toThrow(/written once/);
    expect(() => s.unsafeExec(`UPDATE retired_prototype_runs SET retired = 0, found = run_size`)).toThrow(/retired forever/);
    expect(() => s.unsafeExec(`UPDATE season_standings SET rank = 1`)).toThrow(/written once/);
  });

  it("is refused while a match is live, and goes through once it is recorded", () => {
    const s = open();
    const a = seat(s, "a", "Cortex");
    const b = seat(s, "b", "Swarm");
    s.startMatch({ matchId: "live-1", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId });
    expect(() => s.endSeason()).toThrow(/1 match is still live: end the season once it is recorded/);
    expect(s.seasonEnded()).toBe(false);
    // Nothing was written by the refused call (one transaction).
    expect(s.ownedCosmetics(a.ownerId).filter((c) => c.source === "seasonReward")).toEqual([]);
    s.recordMatch({ matchId: "live-1", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: a.agentId } });
    const end = s.endSeason();
    expect(end.standings.map((r) => r.ownerName)).toEqual(["a", "b"]);
    expect(end.standings.every((r) => r.rank === null)).toBe(true); // one match each: still in placement
  });

  it("a season with nobody rated still ends: no standings, every run retired whole", () => {
    const s = open();
    const end = s.endSeason();
    expect(end.standings).toEqual([]);
    expect(end.retiredPrototypes.every((r) => r.found === 0 && r.retired === r.runSize)).toBe(true);
  });

  it("migrates a v25 file to v26 with the season open and every row kept, and ends it", () => {
    const path = tmpFile();
    const v25 = open(path, 25);
    const a = seat(v25, "a", "Cortex");
    rate(v25, a.ownerId, 1700);
    v25.close();
    const v26 = open(path);
    expect(v26.schemaVersion).toBe(28);
    expect(v26.seasonEnded()).toBe(false);
    expect(v26.rating(a.ownerId).rating).toBe(1700);
    v26.endSeason();
    v26.close();
    // Kept on disk: reopening reads the same end.
    const again = open(path);
    expect(again.seasonEnd()!.standings.map((r) => [r.ownerName, r.rank, r.rating])).toEqual([["a", 1, 1700]]);
    again.close();
  });

  it("a store opened at v25 has no season end and refuses to end one", () => {
    const s = open(":memory:", 25);
    expect(s.seasonEnded()).toBe(false);
    expect(s.seasonEnd()).toBeNull();
    expect(() => s.endSeason()).toThrow(/needs schema v26/);
  });
});
