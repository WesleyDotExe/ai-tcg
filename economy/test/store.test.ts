import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { getCard, SHIPPED_DECK_LISTS } from "@ai-tcg/engine";
import { EconomyError, EconomyStore, PACK_PRICE_CREDITS, SALVAGE_PACK_POINTS, SalvageNeedsConfirmation, STARTER_PACKS } from "../src/index.js";

const DAY1 = "2026-10-05T10:00:00.000Z";
let clock = new Date(DAY1);
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo });
const tmpDirs: string[] = [];
const tmpFile = () => {
  const dir = mkdtempSync(join(tmpdir(), "economy-"));
  tmpDirs.push(dir);
  return join(dir, "season.db");
};
afterEach(() => {
  clock = new Date(DAY1);
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** An owner with one agent: the common case. */
function player(store: EconomyStore, name: string) {
  const owner = store.createOwner({ name });
  const agent = store.createAgent({ ownerId: owner.ownerId, name: `${name}-agent` });
  return { ownerId: owner.ownerId, agentId: agent.agentId };
}

function win(store: EconomyStore, matchId: string, winner: string, loser: string, endedAt = DAY1) {
  return store.recordMatch({ matchId, seed: 1, p1AgentId: winner, p2AgentId: loser, outcome: { kind: "win", winnerAgentId: winner }, endedAt });
}

/** A Common the Aegis starter runs 3 of. */
const AEGIS_COMMON = SHIPPED_DECK_LISTS.Aegis.find((e) => e.copies === 3 && getCard(e.cardId)?.rarity === "Common")!.cardId;
/** An Aegis booster Common (Shield Relay): for the copies only a booster
 * card has (Foil, Gold, Prototype; owner 2026-11-14). */
const BOOSTER_COMMON = "AG-101";

describe("EconomyStore: schema and persistence", () => {
  it("creates the schema at the current version for Season 0, and survives close + reopen from its file", () => {
    const path = tmpFile();
    const a = open(path);
    expect(a.schemaVersion).toBe(29);
    expect(a.season).toBe("S0");
    const alpha = player(a, "alpha");
    const beta = player(a, "beta");
    const { copies } = a.grantStarterCollection(alpha.ownerId, "Cortex");
    win(a, "m1", alpha.agentId, beta.agentId);
    a.close();

    const b = open(path);
    expect(b.schemaVersion).toBe(29);
    expect(b.listOwners().map((x) => x.name)).toEqual(["alpha", "beta"]);
    expect(b.balance(alpha.ownerId)).toBe(30);
    expect(b.balance(beta.ownerId)).toBe(2);
    expect(b.collection(alpha.ownerId).map((c) => c.copyId)).toEqual(copies.map((c) => c.copyId));
    expect(b.matchHistory()).toHaveLength(1);
    b.close();
  });
});

describe("EconomyStore: migration v1 -> v2 (the owner owns everything)", () => {
  it("turns each v1 agent into a house owner with that agent, and carries every row across", () => {
    const path = tmpFile();
    const v1 = open(path, 1);
    expect(v1.schemaVersion).toBe(1);
    const cortex = SHIPPED_DECK_LISTS.Cortex[0]!.cardId;
    const at = DAY1;
    v1.unsafeExec(`
      INSERT INTO agents (agent_id, name, faction, created_at) VALUES ('a1', 'house-a', 'Cortex', '${at}'), ('a2', 'house-b', 'Swarm', '${at}');
      INSERT INTO card_copies (copy_id, owner_id, card_id, finish, series_kind, source, acquired_at)
        VALUES ('c-starter', 'a1', '${cortex}', 'standard', 'set', 'starter', '${at}'),
               ('c-pack', 'a1', '${cortex}', 'standard', 'set', 'pack', '${at}'),
               ('c-crafted', 'a1', '${cortex}', 'standard', 'set', 'packPoints', '${at}');
      INSERT INTO card_copies (copy_id, owner_id, card_id, finish, series_kind, series_code, serial, run_size, source, acquired_at,
                               disposed_at, disposed_reason)
        VALUES ('c-prize', 'a2', '${cortex}', 'tournament', 'tournament', 'S0F', 2, 10, 'tournament', '${at}', NULL, NULL),
               ('c-gone', 'a1', '${cortex}', 'standard', 'set', NULL, NULL, NULL, 'pack', '${at}', '${at}', 'convertedToPackPoints');
      INSERT INTO decks (deck_id, owner_id, name, created_at) VALUES ('d1', 'a1', 'main', '${at}');
      INSERT INTO deck_copies (deck_id, copy_id) VALUES ('d1', 'c-starter'), ('d1', 'c-pack');
      UPDATE agents SET active_deck_id = 'd1' WHERE agent_id = 'a1';
      INSERT INTO matches (match_id, seed, p1_agent, p2_agent, p1_deck, outcome, winner_agent, p1_credits, p2_credits, ended_at)
        VALUES ('m1', 7, 'a1', 'a2', 'd1', 'win', 'a1', 40, 2, '${at}');
      INSERT INTO matches (match_id, seed, p1_agent, p2_agent, outcome, abandoned_by, p1_credits, p2_credits, ended_at)
        VALUES ('m2', 8, 'a1', 'a2', 'abandoned', 'a2', 0, 0, '${at}');
      INSERT INTO ledger (agent_id, currency, delta, reason, ref, created_at)
        VALUES ('a1', 'credits', 40, 'matchWin', 'm1', '${at}'), ('a2', 'credits', 2, 'matchLoss', 'm1', '${at}'),
               ('a1', 'packPoints', 5, 'convert', 'c-gone', '${at}');
    `);
    v1.close();

    const s = open(path, 2);
    expect(s.schemaVersion).toBe(2);
    const owners = s.listOwners();
    expect(owners.map((o) => [o.ownerId, o.name, o.kind, o.startingFaction, o.activeDeckId])).toEqual([
      ["owner-a1", "house-a", "house", "Cortex", "d1"],
      ["owner-a2", "house-b", "house", "Swarm", null],
    ]);
    // a1 had starter copies, so its starter counts as granted; a2 never had one.
    expect(owners[0]!.starterGrantedAt).toBe(DAY1);
    expect(owners[1]!.starterGrantedAt).toBeNull();
    expect(s.getAgent("a1").ownerId).toBe("owner-a1");

    expect(s.balance("owner-a1")).toBe(40);
    expect(s.balance("owner-a1", "packPoints")).toBe(5);
    expect(s.balance("owner-a2")).toBe(2);
    expect(s.ledger("owner-a1").map((e) => [e.reason, e.playedBy])).toEqual([
      ["matchWin", "a1"],
      ["convert", null],
    ]);

    const origin = (id: string) => {
      const c = s.getCopy(id);
      return [c.ownerId, c.origin, c.accountBound, c.disposedReason];
    };
    expect(origin("c-starter")).toEqual(["owner-a1", "starter", true, null]);
    expect(origin("c-pack")).toEqual(["owner-a1", "pack", false, null]);
    expect(origin("c-crafted")).toEqual(["owner-a1", "crafted", true, null]);
    expect(origin("c-prize")).toEqual(["owner-a2", "prize", false, null]);
    expect(origin("c-gone")).toEqual(["owner-a1", "pack", false, "salvaged"]);

    const [m1, m2] = s.matchHistory();
    expect([m1!.p1OwnerId, m1!.p1AgentId, m1!.winnerOwnerId, m1!.winnerAgentId, m1!.p1DeckId]).toEqual(["owner-a1", "a1", "owner-a1", "a1", "d1"]);
    expect([m2!.outcome, m2!.abandonedByOwnerId]).toEqual(["abandoned", "owner-a2"]);
    s.close();

    // v2 -> v3: the prize copy becomes account-bound (owner 2026-10-07), and
    // nothing else about the history changes.
    const v3 = open(path, 3);
    expect(v3.schemaVersion).toBe(3);
    expect(v3.getCopy("c-prize").accountBound).toBe(true);
    expect(v3.getCopy("c-pack").accountBound).toBe(false);
    expect(v3.listOwners().map((o) => [o.connectedAgentId, o.factionLock])).toEqual([
      [null, null],
      [null, null],
    ]);
    // The v1 daily tally carries over per owner: a1's next win that day is its 2nd.
    const c = v3.createOwner({ name: "newcomer" });
    const cAgent = v3.createAgent({ ownerId: c.ownerId, name: "newcomer-agent" });
    expect(win(v3, "m3", "a1", cAgent.agentId).p1Credits).toBe(10);
    expect(v3.balance("owner-a1")).toBe(50);
    // Foreign keys are back on after the migrations.
    expect(() => v3.unsafeExec(`INSERT INTO agents (agent_id, owner_id, name, created_at) VALUES ('x', 'no-such-owner', 'x', '${at}')`)).toThrow(
      /FOREIGN KEY/,
    );
    // (v3 required a promo to be bound; this code no longer binds one by default.)
    const promo = v3.grantCopy({ ownerId: "owner-a1", cardId: cortex, origin: "promo", seriesKind: "promo", seriesCode: "PR-001", stamp: "FIRST WIN", accountBound: true });
    expect(promo.accountBound).toBe(true);
    v3.close();

    // v3 -> v4: promo and prize copies can be sold again (owner 2026-10-10),
    // so the copies v3 bound are unbound. Crafted and starter copies stay
    // bound, and none of them can be salvaged.
    const v4 = open(path, 4);
    expect(v4.schemaVersion).toBe(4);
    expect([v4.getCopy("c-prize").accountBound, v4.getCopy(promo.copyId).accountBound]).toEqual([false, false]);
    expect([v4.getCopy("c-starter").accountBound, v4.getCopy("c-crafted").accountBound]).toEqual([true, true]);
    expect(() => v4.unsafeExec(`UPDATE card_copies SET account_bound = 0 WHERE copy_id = 'c-starter'`)).toThrow(/stays bound/);
    expect(() =>
      v4.unsafeExec(`UPDATE card_copies SET disposed_at = '${at}', disposed_reason = 'salvaged' WHERE copy_id IN ('c-prize', '${promo.copyId}')`),
    ).toThrow(/CHECK/);
    v4.close();

    // v4 -> v5: an agent's signature card can't be sold (owner 2026-10-13).
    // Nothing to convert; from now on a signature copy is inserted bound.
    const v5 = open(path, 5);
    expect(v5.schemaVersion).toBe(5);
    expect(v5.getCopy(promo.copyId).accountBound).toBe(false);
    const v5sig = v5.grantCopy({ ownerId: "owner-a1", cardId: cortex, origin: "promo", originRef: "signature:a1", seriesKind: "promo", seriesCode: "PR-002", stamp: "SIGNATURE" });
    expect(v5sig.accountBound).toBe(true);
    v5.close();

    // v5 -> v6: generated agents and their signature cards (session 34).
    // Nothing converts: the v5 copy above stays as it is, but from now on a
    // signature copy must be a copy of that agent's own signature card, and
    // the next PR- number counts the promo codes already handed out.
    const v6 = open(path, 6);
    expect(v6.schemaVersion).toBe(6);
    expect(v6.getCopy(v5sig.copyId).accountBound).toBe(true);
    expect(v6.getAgent("a1").persona).toBeNull();
    expect(() =>
      v6.grantCopy({ ownerId: "owner-a1", cardId: cortex, origin: "promo", originRef: "signature:a2", seriesKind: "promo", seriesCode: "PR-003", stamp: "SIGNATURE" }),
    ).toThrow(/own signature card/);
    const draft = v6.startAgentDraft("owner-a1", { seed: 1 });
    v6.pickDraftAgent("owner-a1", draft.draftId, 0, { seed: 2 });
    const made = v6.confirmAgentDraft("owner-a1", draft.draftId, 0);
    expect(made.signature.collectorNumber).toBe("PR-003");
    // v6 refuses a second card with the same combination.
    const twin = v6.createAgent({ ownerId: "owner-a1", name: "twin" });
    const rawTwin = (db: EconomyStore, n: number) =>
      db.unsafeExec(
        `INSERT INTO signature_cards (agent_id, card_id, combo_id, name, spec_json, fingerprint, flavor, promo_number, created_at)
         SELECT '${twin.agentId}', 'sig-PR-0${n}', combo_id, 'Twin Card ${n}', spec_json, fingerprint, flavor, ${n}, created_at FROM signature_cards WHERE agent_id = '${made.agent.agentId}'`,
      );
    expect(() => rawTwin(v6, 50)).toThrow(/UNIQUE.*combo_id/);
    v6.close();

    // v6 -> v7: combinations may repeat (owner 2026-10-15). The table is
    // rebuilt with its rows; the rules that name it still hold.
    const v7 = open(path, 7);
    expect(v7.schemaVersion).toBe(7);
    expect(v7.signatureCard(made.agent.agentId)).toMatchObject({ collectorNumber: "PR-003", comboId: made.signature.comboId, fingerprint: made.signature.fingerprint });
    rawTwin(v7, 51);
    expect(v7.signatureCard(twin.agentId)!.comboId).toBe(made.signature.comboId);
    expect(() => v7.unsafeExec(`DELETE FROM signature_cards`)).toThrow(/never deleted/);
    expect(() => v7.unsafeExec(`UPDATE signature_cards SET combo_id = 'x'`)).toThrow(/keeps its agent/);
    expect(() => v7.unsafeExec(`UPDATE signature_cards SET name = 'Twin Card 51' WHERE agent_id = '${made.agent.agentId}'`)).toThrow(/UNIQUE/);
    expect(() =>
      v7.grantCopy({ ownerId: "owner-a1", cardId: cortex, origin: "promo", originRef: `signature:${twin.agentId}`, seriesKind: "promo", seriesCode: "PR-051", stamp: "SIGNATURE" }),
    ).toThrow(/own signature card/);
    v7.close();

    // v7 -> v8: the art pool and pack opening (session 36). Cards made
    // before v8 draw their art slot in the migration, and keep it.
    const v8 = open(path, 8);
    expect(v8.schemaVersion).toBe(8);
    for (const agentId of [made.agent.agentId, twin.agentId]) {
      const art = v8.signatureCard(agentId)!.art!;
      expect(art.pool).toBe("S0");
      expect(art.slot).toBeGreaterThanOrEqual(1);
      expect(art.slot).toBeLessThanOrEqual(500);
    }
    expect(v8.signatureCard(made.agent.agentId)!.card.art).toMatch(/^placeholder:signature-pool\/S0\/\d{3}$/);
    expect(() => v8.unsafeExec(`UPDATE signature_cards SET art_slot = 1`)).toThrow(/keeps its art/);
    v8.close();

    // v8 -> v9: agent names (session 37). Every existing agent's name is
    // logged as legacy; names become unique without case and stay reserved.
    const v9 = open(path, 9);
    expect(v9.schemaVersion).toBe(9);
    for (const a of v9.listAgents()) {
      const names = v9.agentNames(a.agentId);
      expect(names.history).toEqual([expect.objectContaining({ name: a.name, kind: "legacy", packPoints: 0, byOwnerId: null, namedAt: a.createdAt })]);
      expect(names.formerly).toEqual([]);
    }
    expect(() => v9.createAgent({ ownerId: "owner-a1", name: "TWIN" })).toThrow(/taken/);
    expect(() => v9.unsafeExec(`UPDATE agents SET name = 'renamed by hand' WHERE agent_id = '${twin.agentId}'`)).toThrow(/logged name entry/);
    expect(() => v9.unsafeExec(`DELETE FROM agent_names`)).toThrow(/never deleted/);
    // A pack opened under the v9 schema, so v10 carries pack copies too.
    v9.grantPack("owner-a1", "S0", "weeklyChallenge");
    const v9pack = v9.openPack("owner-a1", undefined, { seed: 11 });
    const v9copies = (db: EconomyStore) =>
      ["owner-a1", "owner-a2"].flatMap((o) => db.collection(o)).map((c) => ({ ...c, secretCode: undefined }));
    const beforeV10 = v9copies(v9);
    const disposedBefore = v9.getCopy("c-gone");
    const objectsBefore = schemaObjects(path);
    v9.close();

    // v9 -> v10: the chase finishes (session 39). card_copies is rebuilt
    // with every row, index and trigger; new copies may carry a secret code.
    const v10 = open(path, 10);
    expect(v10.schemaVersion).toBe(10);
    expect(v9copies(v10)).toEqual(beforeV10);
    expect(v10.collection("owner-a1").every((c) => c.secretCode === null)).toBe(true);
    expect({ ...v10.getCopy("c-gone"), secretCode: undefined }).toEqual({ ...disposedBefore, secretCode: undefined });
    expect(v10.packOpening(v9pack.packId).copies.map((c) => c.copyId)).toEqual(v9pack.cards.map((c) => c.copyId));
    expect(v10.deckStatus("d1").complete).toBe(true);
    // Every index and trigger that was there is there again, plus v10's own.
    const objectsAfter = schemaObjects(path);
    expect(objectsAfter.filter((o) => !objectsBefore.includes(o))).toEqual(["index copies_by_secret", "trigger copy_identity_fixed"]);
    expect(objectsBefore.filter((o) => !objectsAfter.includes(o))).toEqual([]);
    // The old rules still hold on the rebuilt table.
    expect(() => v10.unsafeExec(`UPDATE card_copies SET account_bound = 0 WHERE copy_id = 'c-starter'`)).toThrow(/stays bound/);
    expect(() => v10.unsafeExec(`UPDATE card_copies SET owner_id = 'owner-a2' WHERE copy_id = 'c-starter'`)).toThrow(/never change owner/);
    expect(() => v10.unsafeExec(`INSERT INTO deck_copies (deck_id, copy_id) VALUES ('d1', 'c-prize')`)).toThrow(/owner owns/);
    expect(() => v10.unsafeExec(`UPDATE card_copies SET finish = 'gold' WHERE copy_id = 'c-pack'`)).toThrow(/never change/);
    expect(() =>
      v10.unsafeExec(`UPDATE card_copies SET disposed_at = '${at}', disposed_reason = 'salvaged' WHERE copy_id = 'c-starter'`),
    ).toThrow(/CHECK/);
    // Foreign keys are on and still point at the rebuilt table.
    expect(() => v10.unsafeExec(`INSERT INTO deck_copies (deck_id, copy_id) VALUES ('d1', 'no-such-copy')`)).toThrow(/owner owns|FOREIGN KEY/);
    v10.close();
  });
});

/** Every index and trigger in the database file, as "kind name". */
function schemaObjects(path: string): string[] {
  const db = new DatabaseSync(path);
  const rows = db.prepare("SELECT type, name FROM sqlite_master WHERE type IN ('index', 'trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type, name").all() as { type: string; name: string }[];
  db.close();
  return rows.map((r) => `${r.type} ${r.name}`);
}

describe("EconomyStore: the ledger", () => {
  it("is append-only: UPDATE and DELETE are refused by the schema itself", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    win(s, "m1", a.agentId, b.agentId);
    expect(() => s.unsafeExec("UPDATE ledger SET delta = 9999")).toThrow(/append-only/);
    expect(() => s.unsafeExec("DELETE FROM ledger")).toThrow(/append-only/);
    expect(s.balance(a.ownerId)).toBe(30);
  });

  it("refuses any entry that would take a balance below zero, even raw SQL", () => {
    const s = open();
    const a = player(s, "a");
    expect(() =>
      s.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${a.ownerId}', 'credits', -1, 'x', '${DAY1}')`),
    ).toThrow(/insufficient balance/);
  });

  it("pays the daily win schedule (30, 10 x3, 5 x6) from match history, and stops after the 10th win", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    const paid = Array.from({ length: 12 }, (_, i) => win(s, `m${i}`, a.agentId, b.agentId).p1Credits);
    expect(paid).toEqual([30, 10, 10, 10, 5, 5, 5, 5, 5, 5, 0, 0]);
    expect(s.balance(a.ownerId)).toBe(90);
    // b lost 12: losses pay 2 each up to the 10-loss cap.
    expect(s.balance(b.ownerId)).toBe(20);
    // A new day (midnight Sydney; DAY1 is 21:00 there) resets the schedule.
    expect(win(s, "next-day", a.agentId, b.agentId, "2026-10-06T00:00:01.000Z").p1Credits).toBe(30);
    // Zero-credit matches are in history but write no ledger entry.
    expect(s.ledger(a.ownerId).filter((e) => e.reason === "matchWin")).toHaveLength(11);
    expect(s.matchHistory({ ownerId: a.ownerId })).toHaveLength(13);
  });

  it("counts the day on the Sydney clock whatever offset the end time is written with", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    win(s, "m1", a.agentId, b.agentId, "2026-10-05T23:30:00.000Z");
    // 01:30 on the 6th in +02:00 is 23:30 UTC on the 5th, 10:30 on the 6th in
    // Sydney: the same day, so the 2nd win.
    expect(win(s, "m2", a.agentId, b.agentId, "2026-10-06T01:30:00+02:00").p1Credits).toBe(10);
    // 12:59 UTC on the 6th is 23:59 in Sydney (AEDT, +11): still the same day.
    expect(win(s, "m3", a.agentId, b.agentId, "2026-10-06T12:59:00.000Z").p1Credits).toBe(10);
    // 13:00 UTC is Sydney midnight: a new day, the 1st win again.
    expect(win(s, "m4", a.agentId, b.agentId, "2026-10-06T13:00:00.000Z").p1Credits).toBe(30);
  });

  it("pays nothing to either side for a cancelled or abandoned match, and the schema forbids otherwise", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    const c = s.recordMatch({ matchId: "c", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "cancelled" } });
    const ab = s.recordMatch({ matchId: "ab", seed: 2, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "abandoned", byAgentId: b.agentId } });
    expect([c.p1Credits, c.p2Credits, ab.p1Credits, ab.p2Credits]).toEqual([0, 0, 0, 0]);
    expect(ab.abandonedByOwnerId).toBe(b.ownerId);
    expect(s.balance(a.ownerId) + s.balance(b.ownerId)).toBe(0);
    expect(() =>
      s.unsafeExec(
        `INSERT INTO matches (match_id, seed, p1_owner, p2_owner, p1_agent, p2_agent, outcome, p1_credits, p2_credits, ended_at)
         VALUES ('bad', 1, '${a.ownerId}', '${b.ownerId}', '${a.agentId}', '${b.agentId}', 'cancelled', 5, 0, '${DAY1}')`,
      ),
    ).toThrow(/CHECK/);
    // Abandoned/cancelled matches don't use up the daily win schedule either.
    expect(win(s, "w", a.agentId, b.agentId).p1Credits).toBe(30);
  });

  it("pays a draw as a loss to both sides", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    const d = s.recordMatch({ matchId: "d", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "draw" } });
    expect([d.p1Credits, d.p2Credits]).toEqual([2, 2]);
  });

  it("refuses to record the same match twice, and leaves balances untouched", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    win(s, "m1", a.agentId, b.agentId);
    expect(() => win(s, "m1", a.agentId, b.agentId)).toThrow(EconomyError);
    expect(s.balance(a.ownerId)).toBe(30);
    expect(s.matchHistory()).toHaveLength(1);
  });

  it("refuses a winner who wasn't in the match", () => {
    const s = open();
    const [a, b, c] = ["a", "b", "c"].map((name) => player(s, name));
    expect(() =>
      s.recordMatch({ matchId: "x", seed: 1, p1AgentId: a!.agentId, p2AgentId: b!.agentId, outcome: { kind: "win", winnerAgentId: c!.agentId } }),
    ).toThrow(EconomyError);
    expect(s.balance(c!.ownerId)).toBe(0);
    expect(s.matchHistory()).toHaveLength(0);
  });
});

describe("EconomyStore: owners and agents (exploit checks)", () => {
  it("counts the daily caps per owner: switching agents neither resets nor doubles them", () => {
    const s = open();
    const owner = s.createOwner({ name: "owner" });
    const first = s.createAgent({ ownerId: owner.ownerId, name: "first" });
    const opp = player(s, "opp");
    const firstPaid = Array.from({ length: 6 }, (_, i) => win(s, `a${i}`, first.agentId, opp.agentId).p1Credits);
    // The owner switches agents mid-day: the schedule carries on at win 7.
    const second = s.createAgent({ ownerId: owner.ownerId, name: "second" });
    const secondPaid = Array.from({ length: 6 }, (_, i) => win(s, `b${i}`, second.agentId, opp.agentId).p1Credits);
    expect([...firstPaid, ...secondPaid]).toEqual([30, 10, 10, 10, 5, 5, 5, 5, 5, 5, 0, 0]);
    expect(s.balance(owner.ownerId)).toBe(90);
    // Each payout names the agent that played it.
    const played = s.ledger(owner.ownerId).map((e) => e.playedBy);
    expect(played.filter((p) => p === first.agentId)).toHaveLength(6);
    expect(played.filter((p) => p === second.agentId)).toHaveLength(4);
    // The loss cap is per owner too: opp's 12 losses paid 10 x 2.
    expect(s.balance(opp.ownerId)).toBe(20);
  });

  it("never lets an owner's own agents play each other, even through raw SQL", () => {
    const s = open();
    const owner = s.createOwner({ name: "farmer" });
    const x = s.createAgent({ ownerId: owner.ownerId, name: "x" });
    const y = s.createAgent({ ownerId: owner.ownerId, name: "y" });
    expect(() => win(s, "self", x.agentId, y.agentId)).toThrow(/never play each other/);
    expect(() =>
      s.unsafeExec(
        `INSERT INTO matches (match_id, seed, p1_owner, p2_owner, p1_agent, p2_agent, outcome, winner_owner, p1_credits, p2_credits, ended_at)
         VALUES ('raw', 1, '${owner.ownerId}', '${owner.ownerId}', '${x.agentId}', '${y.agentId}', 'win', '${owner.ownerId}', 30, 2, '${DAY1}')`,
      ),
    ).toThrow(/CHECK/);
    expect(s.balance(owner.ownerId)).toBe(0);
  });

  it("refuses a match side played by another owner's agent, and a payout to someone else's agent", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    const c = player(s, "c");
    expect(() =>
      s.unsafeExec(
        `INSERT INTO matches (match_id, seed, p1_owner, p2_owner, p1_agent, p2_agent, outcome, winner_owner, p1_credits, p2_credits, ended_at)
         VALUES ('raw', 1, '${a.ownerId}', '${b.ownerId}', '${c.agentId}', '${b.agentId}', 'win', '${a.ownerId}', 30, 2, '${DAY1}')`,
      ),
    ).toThrow(/own owner's agent/);
    expect(() =>
      s.unsafeExec(
        `INSERT INTO ledger (owner_id, played_by, currency, delta, reason, ref, created_at)
         VALUES ('${a.ownerId}', '${c.agentId}', 'credits', 30, 'matchWin', 'x', '${DAY1}')`,
      ),
    ).toThrow(/own agents/);
    expect(() => s.unsafeExec(`UPDATE agents SET owner_id = '${a.ownerId}' WHERE agent_id = '${c.agentId}'`)).toThrow(/one owner forever/);
  });

  it("gives a new agent nothing: no copies, credits or packs", () => {
    const s = open();
    const owner = s.createOwner({ name: "o" });
    s.grantStarterCollection(owner.ownerId, "Swarm");
    const before = [s.collection(owner.ownerId).length, s.balance(owner.ownerId), s.unopenedPacks(owner.ownerId).length];
    s.createAgent({ ownerId: owner.ownerId, name: "a1" });
    s.createAgent({ ownerId: owner.ownerId, name: "a2" });
    expect([s.collection(owner.ownerId).length, s.balance(owner.ownerId), s.unopenedPacks(owner.ownerId).length]).toEqual(before);
    expect(s.listAgents(owner.ownerId).map((a) => a.name)).toEqual(["a1", "a2"]);
  });

  it("grants the starter collection once per owner: the faction deck as bound copies plus 3 packs", () => {
    const s = open();
    const owner = s.createOwner({ name: "o" });
    const { copies, packs } = s.grantStarterCollection(owner.ownerId, "Aegis");
    const total = SHIPPED_DECK_LISTS.Aegis.reduce((n, e) => n + e.copies, 0);
    expect(copies).toHaveLength(total);
    expect(copies.every((c) => c.origin === "starter" && c.accountBound)).toBe(true);
    expect(packs).toHaveLength(STARTER_PACKS);
    expect(s.getOwner(owner.ownerId).startingFaction).toBe("Aegis");
    // The starter deck saves and plays.
    s.saveDeck(owner.ownerId, "starter", copies.map((c) => c.copyId));

    // A second starter, any faction, is refused with nothing granted.
    expect(() => s.grantStarterCollection(owner.ownerId, "Null")).toThrow(/already has its starter/);
    expect(s.collection(owner.ownerId)).toHaveLength(total);
    expect(s.unopenedPacks(owner.ownerId)).toHaveLength(STARTER_PACKS);
    expect(() => s.unsafeExec(`UPDATE owners SET starter_granted_at = NULL WHERE owner_id = '${owner.ownerId}'`)).toThrow(/once per owner/);
  });

  it("keeps a player's stats per owner, filterable to the agent that played", () => {
    const s = open();
    const owner = s.createOwner({ name: "o" });
    const x = s.createAgent({ ownerId: owner.ownerId, name: "x" });
    const y = s.createAgent({ ownerId: owner.ownerId, name: "y" });
    const opp = player(s, "opp");
    win(s, "1", x.agentId, opp.agentId);
    win(s, "2", x.agentId, opp.agentId);
    win(s, "3", opp.agentId, x.agentId);
    win(s, "4", y.agentId, opp.agentId);
    s.recordMatch({ matchId: "5", seed: 1, p1AgentId: y.agentId, p2AgentId: opp.agentId, outcome: { kind: "cancelled" } });
    win(s, "6", y.agentId, opp.agentId);
    win(s, "7", y.agentId, opp.agentId);
    const all = s.ownerStats(owner.ownerId);
    expect([all.matches, all.wins, all.losses, all.void, all.bestWinStreak]).toEqual([7, 5, 1, 1, 3]);
    expect(all.winRate).toBeCloseTo(5 / 6);
    expect(all.creditsFromMatches).toBe(s.balance(owner.ownerId));
    const onlyY = s.ownerStats(owner.ownerId, { agentId: y.agentId });
    expect([onlyY.matches, onlyY.wins, onlyY.losses, onlyY.void, onlyY.bestWinStreak]).toEqual([4, 3, 0, 1, 3]);
  });
});

describe("EconomyStore: copy origins, account-bound copies and salvage", () => {
  it("records every copy's origin, binds crafted and starter copies, and never unbinds or moves a bound copy", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    const crafted = s.grantCopy({ ownerId: a.ownerId, cardId: AEGIS_COMMON, origin: "crafted", accountBound: false });
    const pack = s.grantCopy({ ownerId: a.ownerId, cardId: AEGIS_COMMON, origin: "pack" });
    expect([crafted.origin, crafted.accountBound, pack.origin, pack.accountBound]).toEqual(["crafted", true, "pack", false]);
    expect(() =>
      s.unsafeExec(
        `INSERT INTO card_copies (copy_id, owner_id, card_id, finish, series_kind, origin, account_bound, acquired_at)
         VALUES ('raw', '${a.ownerId}', '${AEGIS_COMMON}', 'standard', 'set', 'starter', 0, '${DAY1}')`,
      ),
    ).toThrow(/CHECK|always account-bound/);
    expect(() => s.unsafeExec(`UPDATE card_copies SET account_bound = 0 WHERE copy_id = '${crafted.copyId}'`)).toThrow(/stays bound/);
    expect(() => s.unsafeExec(`UPDATE card_copies SET owner_id = '${b.ownerId}' WHERE copy_id = '${crafted.copyId}'`)).toThrow(/never change owner/);
    expect(() => s.unsafeExec(`UPDATE card_copies SET origin = 'pack' WHERE copy_id = '${crafted.copyId}'`)).toThrow(/origin never changes/);
  });

  it("grants promo and prize copies unbound so they can be sold, but never salvages them (owner 2026-10-10)", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    const promo = s.grantCopy({ ownerId: a.ownerId, cardId: AEGIS_COMMON, origin: "promo", seriesKind: "promo", seriesCode: "PR-001", stamp: "FIRST WIN" });
    const prize = s.grantCopy({ ownerId: a.ownerId, cardId: AEGIS_COMMON, origin: "prize", finish: "tournament", seriesKind: "tournament", seriesCode: "S0F", serial: 3, runSize: 10 });
    expect([promo.accountBound, prize.accountBound]).toEqual([false, false]);
    // Unbound means it can change owner (the future marketplace's sale),
    // and (v28) only through a transfer record, so its chain of owners is kept.
    expect(() => s.unsafeExec(`UPDATE card_copies SET owner_id = '${b.ownerId}' WHERE copy_id = '${promo.copyId}'`)).toThrow(/latest transfer record/);
    s.unsafeExec(
      `INSERT INTO copy_transfers (copy_id, from_owner, to_owner, kind, at) VALUES ('${promo.copyId}', '${a.ownerId}', '${b.ownerId}', 'sale', '${promo.acquiredAt}')`,
    );
    s.unsafeExec(`UPDATE card_copies SET owner_id = '${b.ownerId}' WHERE copy_id = '${promo.copyId}'`);
    expect(s.getCopy(promo.copyId).ownerId).toBe(b.ownerId);
    expect(s.copyProvenance(promo.copyId).owners.map((o) => o.ownerId)).toEqual([a.ownerId, b.ownerId]);
    // A promo can still be granted bound on purpose (the signature card), and then it stays bound.
    const bound = s.grantCopy({ ownerId: a.ownerId, cardId: AEGIS_COMMON, origin: "promo", seriesKind: "promo", seriesCode: "PR-002", stamp: "SIGNATURE", accountBound: true });
    expect(bound.accountBound).toBe(true);
    expect(() => s.unsafeExec(`UPDATE card_copies SET account_bound = 0 WHERE copy_id = '${bound.copyId}'`)).toThrow(/stays bound/);
    // Neither salvages, through the store or raw SQL.
    expect(() => s.salvage(a.ownerId, AEGIS_COMMON, 1)).toThrow(/0 of 2 held can be salvaged.*Prize copies can be kept or sold, never salvaged/);
    expect(() =>
      s.unsafeExec(`UPDATE card_copies SET disposed_at = '${DAY1}', disposed_reason = 'salvaged' WHERE copy_id = '${prize.copyId}'`),
    ).toThrow(/CHECK/);
  });

  it("never salvages anything on its own: an owner may hold as many copies as they like", () => {
    const s = open();
    const owner = s.createOwner({ name: "o" });
    s.grantStarterCollection(owner.ownerId, "Aegis");
    for (let i = 0; i < 47; i++) s.grantCopy({ ownerId: owner.ownerId, cardId: AEGIS_COMMON, origin: "pack" });
    expect(s.collection(owner.ownerId).filter((c) => c.cardId === AEGIS_COMMON)).toHaveLength(50);
    expect(s.balance(owner.ownerId, "packPoints")).toBe(0);
    expect(s.cardHoldings(owner.ownerId, AEGIS_COMMON)).toMatchObject({ owned: 50, salvageable: 47, packPointsEach: SALVAGE_PACK_POINTS.Common });
  });

  it("salvages the card and quantity the owner picks, from pack copies only (the owner's example)", () => {
    const s = open();
    const owner = s.createOwner({ name: "o" });
    s.grantStarterCollection(owner.ownerId, "Aegis"); // 3 starter copies of AEGIS_COMMON
    expect(() => s.salvage(owner.ownerId, AEGIS_COMMON, 1)).toThrow(/0 of 3 held can be salvaged \(3 x Account-bound \(starter copy\)/);
    const fourth = s.grantCopy({ ownerId: owner.ownerId, cardId: AEGIS_COMMON, origin: "pack" });

    const result = s.salvage(owner.ownerId, AEGIS_COMMON, 1);
    expect(result.copies.map((c) => c.copyId)).toEqual([fourth.copyId]);
    expect(result.packPoints).toBe(SALVAGE_PACK_POINTS.Common);
    expect(result.incompleteDecks).toEqual([]);
    expect(s.balance(owner.ownerId, "packPoints")).toBe(SALVAGE_PACK_POINTS.Common);
    expect(s.getCopy(fourth.copyId).disposedReason).toBe("salvaged");
    expect(s.collection(owner.ownerId).filter((c) => c.cardId === AEGIS_COMMON)).toHaveLength(3);
    expect(() => s.salvage(owner.ownerId, AEGIS_COMMON, 1)).toThrow(/can't salvage 1/);
    expect(() => s.salvage(owner.ownerId, AEGIS_COMMON, 0)).toThrow(/at least 1/);
    expect(() => s.salvage(owner.ownerId, AEGIS_COMMON, 1.5)).toThrow(/whole quantity/);
  });

  it("grants an agent's signature card bound: it can never be sold (owner 2026-10-13)", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    const draft = s.startAgentDraft(a.ownerId, { seed: 3 });
    s.pickDraftAgent(a.ownerId, draft.draftId, 1, { seed: 4 });
    const { agent, signature, copy: sig } = s.confirmAgentDraft(a.ownerId, draft.draftId, 2);
    const ref = `signature:${agent.agentId}`;
    expect(sig.accountBound).toBe(true);
    // Never sold: a bound copy never changes owner, even by raw SQL.
    expect(() => s.unsafeExec(`UPDATE card_copies SET owner_id = '${b.ownerId}' WHERE copy_id = '${sig.copyId}'`)).toThrow();
    expect(s.getCopy(sig.copyId).ownerId).toBe(a.ownerId);
    // Never salvaged.
    expect(() => s.salvage(a.ownerId, signature.cardId, 1)).toThrow(/0 of 1 held can be salvaged/);
    // It is a promo, nothing else.
    expect(() => s.grantCopy({ ownerId: a.ownerId, cardId: signature.cardId, origin: "pack", originRef: ref })).toThrow(/granted as a promo copy/);
    // The schema holds the rule without the store: an unbound signature insert aborts,
    // and a copy can't be relabelled into or out of being a signature card.
    expect(() =>
      s.unsafeExec(
        `INSERT INTO card_copies (copy_id, owner_id, card_id, finish, series_kind, origin, origin_ref, account_bound, acquired_at)
         VALUES ('raw-sig', '${a.ownerId}', '${signature.cardId}', 'standard', 'promo', 'promo', '${ref}', 0, '${DAY1}')`,
      ),
    ).toThrow(/can never be sold/);
    const promo = s.grantCopy({ ownerId: a.ownerId, cardId: AEGIS_COMMON, origin: "promo", seriesKind: "promo", seriesCode: "PR-002", stamp: "FIRST WIN" });
    expect(() => s.unsafeExec(`UPDATE card_copies SET origin_ref = '${ref}' WHERE copy_id = '${promo.copyId}'`)).toThrow(/never becomes/);
    expect(() => s.unsafeExec(`UPDATE card_copies SET origin_ref = NULL WHERE copy_id = '${sig.copyId}'`)).toThrow(/never becomes/);
  });

  it("says why each copy can't be salvaged: bound, finish, promo, prize, Prototype", () => {
    const s = open();
    const owner = s.createOwner({ name: "o" });
    // A booster card (session 97): a starter card has no Foil, Gold or
    // Prototype version. Its three bound copies stand in for starter copies.
    const AEGIS_COMMON = BOOSTER_COMMON;
    for (let i = 0; i < 3; i++) s.grantCopy({ ownerId: owner.ownerId, cardId: AEGIS_COMMON, origin: "starter" });
    s.grantCopy({ ownerId: owner.ownerId, cardId: AEGIS_COMMON, origin: "pack", finish: "foil" });
    s.grantCopy({ ownerId: owner.ownerId, cardId: AEGIS_COMMON, origin: "pack", finish: "gold" });
    s.grantCopy({ ownerId: owner.ownerId, cardId: AEGIS_COMMON, origin: "pack", finish: "prototype", seriesKind: "prototype", seriesCode: "S0", serial: 1, runSize: 5 });
    s.grantCopy({ ownerId: owner.ownerId, cardId: AEGIS_COMMON, origin: "crafted" });
    s.grantCopy({ ownerId: owner.ownerId, cardId: AEGIS_COMMON, origin: "promo", seriesKind: "promo", seriesCode: "PR-001", stamp: "FIRST WIN" });
    const h = s.cardHoldings(owner.ownerId, AEGIS_COMMON);
    expect([h.owned, h.salvageable]).toEqual([8, 0]);
    expect(h.notSalvageable).toEqual([
      { reason: "Account-bound (starter copy): it can be played, never salvaged", count: 3 },
      { reason: "Foil copies are never salvaged", count: 1 },
      { reason: "Gold copies are never salvaged", count: 1 },
      { reason: "Prototype copies are never salvaged", count: 1 },
      { reason: "Account-bound (crafted copy): it can be played, never salvaged", count: 1 },
      { reason: "Promo copies can be kept or sold, never salvaged", count: 1 },
    ]);
    expect(() => s.salvage(owner.ownerId, AEGIS_COMMON, 1)).toThrow(/0 of 8 held can be salvaged/);
    // Raw SQL can't salvage a bound copy or a finish either.
    expect(() => s.unsafeExec(`UPDATE card_copies SET disposed_at = '${DAY1}', disposed_reason = 'salvaged' WHERE origin = 'starter'`)).toThrow(/CHECK/);
    expect(() => s.unsafeExec(`UPDATE card_copies SET disposed_at = '${DAY1}', disposed_reason = 'salvaged' WHERE finish = 'foil'`)).toThrow(/CHECK/);
    expect(s.balance(owner.ownerId, "packPoints")).toBe(0);
  });

  it("warns before salvaging below what saved decks use, then marks them incomplete without editing them", () => {
    const s = open();
    const owner = s.createOwner({ name: "o" });
    const swarm = SHIPPED_DECK_LISTS.Swarm;
    const common = swarm.find((e) => e.copies === 3 && getCard(e.cardId)?.rarity === "Common")!.cardId;
    // Built from pack copies so they can be salvaged at all.
    const copies = swarm.flatMap((e) => Array.from({ length: e.copies }, () => s.grantCopy({ ownerId: owner.ownerId, cardId: e.cardId, origin: "pack" }).copyId));
    const main = s.saveDeck(owner.ownerId, "main", copies);
    const spare = s.saveDeck(owner.ownerId, "spare", copies);
    s.setActiveDeck(owner.ownerId, main.deckId);
    const extra = s.grantCopy({ ownerId: owner.ownerId, cardId: common, origin: "pack" });

    // One copy: 4 held, decks use 3, nothing to warn about; the unlisted copy goes.
    const first = s.salvage(owner.ownerId, common, 1);
    expect(first.copies.map((c) => c.copyId)).toEqual([extra.copyId]);

    // Two more would leave 1 against decks that use 3: refused with the list.
    const plan = s.salvagePlan(owner.ownerId, common, 2);
    expect(plan.affectedDecks).toEqual([
      { deckId: main.deckId, name: "main", uses: 3, owned: 1, active: true },
      { deckId: spare.deckId, name: "spare", uses: 3, owned: 1, active: false },
    ]);
    let warned: unknown;
    try {
      s.salvage(owner.ownerId, common, 2);
    } catch (e) {
      warned = e;
    }
    expect(warned).toBeInstanceOf(SalvageNeedsConfirmation);
    expect((warned as SalvageNeedsConfirmation).affectedDecks).toEqual(plan.affectedDecks);
    expect(s.cardHoldings(owner.ownerId, common).owned).toBe(3);
    expect(s.balance(owner.ownerId, "packPoints")).toBe(SALVAGE_PACK_POINTS.Common);

    // Confirmed: salvaged, both decks incomplete, neither deck edited.
    const done = s.salvage(owner.ownerId, common, 2, { confirmDeckImpact: true });
    expect(done.incompleteDecks.map((d) => d.name)).toEqual(["main", "spare"]);
    expect(s.balance(owner.ownerId, "packPoints")).toBe(3 * SALVAGE_PACK_POINTS.Common);
    const status = s.deckStatus(main.deckId);
    expect([status.complete, status.cards, status.missing]).toEqual([false, copies.length, [{ cardId: common, uses: 3, owned: 1 }]]);
    expect(s.listDecks(owner.ownerId).map((d) => [d.name, d.complete, d.active])).toEqual([
      ["main", false, true],
      ["spare", false, false],
    ]);
    expect(() => s.loadDeck(main.deckId)).toThrow(/incomplete/);

    // Fixed by holding the copies again: any copy of the card fills the slots.
    s.grantCopies([0, 1].map(() => ({ ownerId: owner.ownerId, cardId: common, origin: "pack" as const })));
    expect(s.deckStatus(main.deckId).complete).toBe(true);
    expect(s.deckStatus(spare.deckId).complete).toBe(true);
    expect(s.loadDeck(main.deckId).spec.cards).toHaveLength(copies.length);
  });
});

describe("EconomyStore: packs", () => {
  it("debits 100 credits and creates the pack together, and refuses what the balance can't cover", () => {
    const s = open();
    const a = player(s, "a");
    const b = player(s, "b");
    for (let i = 0; i < 10; i++) win(s, `m${i}`, a.agentId, b.agentId); // 30+10+10+10+5x6 = 90
    expect(s.balance(a.ownerId)).toBe(90);
    expect(() => s.buyPack(a.ownerId, "S0")).toThrow(/insufficient balance/);
    expect(s.unopenedPacks(a.ownerId)).toHaveLength(0);
    win(s, "next-day", a.agentId, b.agentId, "2026-10-06T10:00:00.000Z");
    const pack = s.buyPack(a.ownerId, "S0");
    expect(s.balance(a.ownerId)).toBe(120 - PACK_PRICE_CREDITS);
    expect(s.unopenedPacks(a.ownerId).map((p) => p.packId)).toEqual([pack.packId]);
    // A purchase is an owner action: no agent is named on it.
    expect(s.ledger(a.ownerId).find((e) => e.reason === "packPurchase")!.playedBy).toBeNull();
    s.grantPack(a.ownerId, "S0", "weeklyChallenge");
    expect(s.unopenedPacks(a.ownerId)).toHaveLength(2);
  });
});

describe("EconomyStore: owned copies and decks", () => {
  it("records every copy as its own item and refuses cards that aren't ownable", () => {
    const s = open();
    const owner = s.createOwner({ name: "o" });
    const { copies } = s.grantStarterCollection(owner.ownerId, "Null");
    const total = SHIPPED_DECK_LISTS.Null.reduce((n, e) => n + e.copies, 0);
    expect(new Set(copies.map((c) => c.copyId)).size).toBe(total);
    expect(() => s.grantCopy({ ownerId: owner.ownerId, cardId: "not-a-card", origin: "pack" })).toThrow(/no ownable card/);
    // A failing grant inside a batch rolls the whole batch back.
    const cardId = SHIPPED_DECK_LISTS.Null[0]!.cardId;
    expect(() =>
      s.grantCopies([
        { ownerId: owner.ownerId, cardId, origin: "pack" },
        { ownerId: owner.ownerId, cardId: "nope", origin: "pack" },
      ]),
    ).toThrow();
    expect(s.collection(owner.ownerId)).toHaveLength(total);
  });

  it("keeps numbered serials unique and inside their run", () => {
    const s = open();
    const a = player(s, "a");
    const cardId = BOOSTER_COMMON; // a Prototype is a booster card's (session 97)
    const proto = { ownerId: a.ownerId, cardId, finish: "prototype" as const, seriesKind: "prototype" as const, seriesCode: "S1", runSize: 50, origin: "pack" as const };
    s.grantCopy({ ...proto, serial: 7 });
    expect(() => s.grantCopy({ ...proto, serial: 7 })).toThrow(EconomyError);
    expect(() => s.grantCopy({ ...proto, serial: 51 })).toThrow(EconomyError);
    expect(() => s.grantCopy({ ...proto, serial: null, runSize: null })).toThrow(EconomyError);
    expect(() => s.grantCopy({ ownerId: a.ownerId, cardId, seriesKind: "promo", origin: "promo" })).toThrow(EconomyError);
    s.grantCopy({ ownerId: a.ownerId, cardId, seriesKind: "promo", seriesCode: "PR-001", stamp: "FIRST WIN", origin: "promo" });
  });

  it("saves a deck only from the owner's own copies, legal by the engine's rules, and loads it for play", () => {
    const s = open();
    const a = s.createOwner({ name: "a" });
    const b = s.createOwner({ name: "b" });
    const mine = s.grantStarterCollection(a.ownerId, "Aegis").copies.map((c) => c.copyId);
    const theirs = s.grantStarterCollection(b.ownerId, "Swarm").copies.map((c) => c.copyId);

    const deck = s.saveDeck(a.ownerId, "main", mine);
    s.setActiveDeck(a.ownerId, deck.deckId);
    expect(s.getOwner(a.ownerId).activeDeckId).toBe(deck.deckId);
    const loaded = s.loadDeck(deck.deckId);
    expect(loaded.copyIds).toEqual(mine);
    expect(loaded.spec.cards).toHaveLength(mine.length);

    // One copy may sit in several decks.
    s.saveDeck(a.ownerId, "copy of main", mine);

    expect(() => s.saveDeck(a.ownerId, "stolen", [...mine.slice(1), theirs[0]!])).toThrow(/another owner/);
    expect(() => s.saveDeck(a.ownerId, "dup", [mine[0]!, mine[0]!, ...mine.slice(2)])).toThrow(/same copy twice/);
    // Five cards: refused by the engine's own deck rules (the pool lint
    // fires before the 20-card size floor does).
    expect(() => s.saveDeck(a.ownerId, "tiny", mine.slice(0, 5))).toThrow(/lint failed|deck size/);
    // A fourth copy of a Common needs a fourth owned copy *and* still breaks the 3-copy limit.
    const extra = s.grantCopy({ ownerId: a.ownerId, cardId: AEGIS_COMMON, origin: "pack" });
    expect(() => s.saveDeck(a.ownerId, "four", [...mine, extra.copyId])).toThrow(/3-copy limit/);
    // The schema refuses a cross-owner deck slot or active deck even through raw SQL.
    expect(() => s.unsafeExec(`INSERT INTO deck_copies (deck_id, copy_id) VALUES ('${deck.deckId}', '${theirs[0]}')`)).toThrow(/owns/);
    expect(() => s.setActiveDeck(b.ownerId, deck.deckId)).toThrow(/own deck/);
  });

  it("counts cards, not copies: a gone copy is replaced by another held copy, else the deck is incomplete", () => {
    const s = open();
    const owner = s.createOwner({ name: "o" });
    const mine = s.grantStarterCollection(owner.ownerId, "Cortex").copies.map((c) => c.copyId);
    const deck = s.saveDeck(owner.ownerId, "main", mine);
    const gone = s.getCopy(mine[0]!);
    const spare = s.grantCopy({ ownerId: owner.ownerId, cardId: gone.cardId, origin: "pack" });
    s.unsafeExec(`UPDATE card_copies SET disposed_at = '${DAY1}', disposed_reason = 'retired' WHERE copy_id = '${gone.copyId}'`);
    // The spare (a pack copy; a starter card is Standard only) fills the slot; the rest keep the copies the deck was saved with.
    expect(s.loadDeck(deck.deckId).copyIds).toEqual([spare.copyId, ...mine.slice(1)]);
    s.unsafeExec(`UPDATE card_copies SET disposed_at = '${DAY1}', disposed_reason = 'retired' WHERE copy_id = '${spare.copyId}'`);
    expect(() => s.loadDeck(deck.deckId)).toThrow(/is incomplete/);
    expect(s.deckStatus(deck.deckId).complete).toBe(false);
    // The owner fixes it by editing the deck (here: dropping to the copies held).
    const held = s.collection(owner.ownerId).filter((c) => c.cardId === gone.cardId).map((c) => c.copyId);
    const others = mine.filter((id) => s.getCopy(id).cardId !== gone.cardId);
    const extra = s.grantCopy({ ownerId: owner.ownerId, cardId: gone.cardId, origin: "pack" });
    s.updateDeck(owner.ownerId, deck.deckId, [...others, ...held, extra.copyId]);
    expect(s.deckStatus(deck.deckId).complete).toBe(true);
    expect(s.loadDeck(deck.deckId).copyIds).toHaveLength(mine.length);
    const other = s.createOwner({ name: "x" });
    expect(() => s.updateDeck(other.ownerId, deck.deckId, mine)).toThrow(/another owner/);
  });
});
