// Marketplace groundwork (schema v28, session 84; owner 2026-11-10: "audit
// first; build only what can't be added later"). Every card copy is its own
// row with a permanent id; v28 makes its chain of owners complete (an
// append-only transfer record, and owner_id changes only by applying the
// latest transfer) and makes a copy row and its provenance permanent.
// `copyProvenance` reads where a copy came from and who has held it.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore, cardSet } from "../src/index.js";

const DAY1 = "2026-11-20T10:00:00.000Z";
let clock = new Date(DAY1);
const tmpDirs: string[] = [];
afterEach(() => {
  clock = new Date(DAY1);
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo });
const later = (minutes: number) => (clock = new Date(clock.getTime() + minutes * 60_000));
const S0 = cardSet("S0");
const COMMON = S0.cards.find((c) => c.rarity === "Common")!.cardId;

function credit(s: EconomyStore, ownerId: string, currency: "credits" | "packPoints", amount: number) {
  s.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${ownerId}', '${currency}', ${amount}, 'testGrant', '${clock.toISOString()}')`);
}
function transfer(s: EconomyStore, copyId: string, from: string, to: string, kind = "sale", ref: string | null = null) {
  s.unsafeExec(
    `INSERT INTO copy_transfers (copy_id, from_owner, to_owner, kind, ref, at) VALUES ('${copyId}', '${from}', '${to}', '${kind}', ${ref === null ? "NULL" : `'${ref}'`}, '${clock.toISOString()}')`,
  );
}
const move = (s: EconomyStore, copyId: string, to: string) => s.unsafeExec(`UPDATE card_copies SET owner_id = '${to}' WHERE copy_id = '${copyId}'`);

/** Two owners; Ada has the Cortex starter, one opened bought pack and one
 * crafted copy. */
function world() {
  const s = open();
  const ada = s.createOwner({ name: "Ada" }).ownerId;
  const bram = s.createOwner({ name: "Bram" }).ownerId;
  const cy = s.createOwner({ name: "Cy" }).ownerId;
  const starter = s.grantStarterCollection(ada, "Cortex").copies;
  credit(s, ada, "credits", 1000);
  const pack = s.buyPack(ada, "S0");
  later(5);
  const opening = s.openPack(ada, pack.packId, { seed: 42 });
  credit(s, ada, "packPoints", 100);
  later(5);
  const crafted = s.craftCard(ada, COMMON);
  return { s, ada, bram, cy, starter, pack, opening, crafted };
}

describe("copy provenance (v28)", () => {
  it("names every copy's source: the pack and its opening, the craft's payment, the starter faction", () => {
    const { s, ada, starter, pack, opening, crafted } = world();
    const fromPack = s.copyProvenance(opening.cards[0]!.copyId);
    expect(fromPack.source).toEqual({
      kind: "pack",
      packId: pack.packId,
      packSource: "purchase",
      setCode: "S0",
      packAcquiredAt: pack.acquiredAt,
      openedAt: opening.openedAt,
      oddsVersion: opening.oddsVersion,
      seed: 42,
    });
    expect(fromPack.firstOwnerId).toBe(ada);
    expect(fromPack.owners).toEqual([{ ownerId: ada, from: fromPack.copy.acquiredAt, until: null, via: null }]);
    expect(fromPack.transferable).toBe(true);

    const c = s.copyProvenance(crafted.copyId);
    expect(c.source).toMatchObject({ kind: "crafted", reason: "craft", packPoints: 40 });
    expect(s.ledger(ada).find((e) => e.ref === crafted.copyId)?.entryId).toBe((c.source as { ledgerEntryId: number }).ledgerEntryId);
    expect(c.transferable).toBe(false);

    expect(s.copyProvenance(starter[0]!.copyId).source).toEqual({ kind: "starter", faction: "Cortex" });
    expect(s.copyProvenance(starter[0]!.copyId).transferable).toBe(false);
  });

  it("every copy has its own permanent id: a pack's six copies are six rows, never a count", () => {
    const { s, ada, opening } = world();
    const ids = opening.cards.map((c) => c.copyId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(s.getCopy(id).ownerId).toBe(ada);
    expect(() => s.unsafeExec(`UPDATE card_copies SET copy_id = 'other' WHERE copy_id = '${ids[0]}'`)).toThrow(/id and provenance never change/);
    expect(() => s.unsafeExec(`DELETE FROM card_copies WHERE copy_id = '${ids[0]}'`)).toThrow(/never deleted/);
    expect(() => s.unsafeExec(`UPDATE card_copies SET origin_ref = NULL WHERE copy_id = '${ids[0]}'`)).toThrow(/provenance never change/);
    expect(() => s.unsafeExec(`UPDATE card_copies SET acquired_at = '2020-01-01' WHERE copy_id = '${ids[0]}'`)).toThrow(/provenance never change/);
  });

  it("an unbound copy changes owner only through its transfer record, so the chain of owners is complete", () => {
    const { s, ada, bram, cy, opening } = world();
    const id = opening.cards[0]!.copyId;
    // No record, no move; and a transfer starts from the holder.
    expect(() => move(s, id, bram)).toThrow(/latest transfer record/);
    expect(() => transfer(s, id, bram, cy)).toThrow(/still held by its from_owner/);
    later(60);
    transfer(s, id, ada, bram, "sale", "sale-1");
    move(s, id, bram);
    later(60);
    // Ada no longer holds it.
    expect(() => transfer(s, id, ada, cy)).toThrow(/still held by its from_owner|follows the copy's last transfer/);
    transfer(s, id, bram, cy, "trade", "trade-7");
    expect(() => move(s, id, ada)).toThrow(/latest transfer record/);
    move(s, id, cy);
    const p = s.copyProvenance(id);
    expect(p.firstOwnerId).toBe(ada);
    expect(p.owners.map((o) => [o.ownerId, o.via?.kind ?? null, o.via?.ref ?? null])).toEqual([
      [ada, null, null],
      [bram, "sale", "sale-1"],
      [cy, "trade", "trade-7"],
    ]);
    expect(p.owners[0]!.until).toBe(p.owners[1]!.from);
    expect(p.owners[2]!.until).toBeNull();
    // The record is append-only.
    expect(() => s.unsafeExec("UPDATE copy_transfers SET to_owner = from_owner")).toThrow(/append-only/);
    expect(() => s.unsafeExec("DELETE FROM copy_transfers")).toThrow(/append-only/);
  });

  it("a transfer not yet applied blocks the next one, and a copy can't go to an owner the record doesn't name", () => {
    const { s, ada, bram, cy, opening } = world();
    const id = opening.cards[1]!.copyId;
    transfer(s, id, ada, bram);
    // Ada still holds it, but the last transfer (to Bram) isn't applied.
    expect(() => transfer(s, id, ada, cy)).toThrow(/follows the copy's last transfer/);
    expect(() => move(s, id, cy)).toThrow(/latest transfer record/);
    move(s, id, bram);
    expect(s.copyProvenance(id).owners.map((o) => o.ownerId)).toEqual([ada, bram]);
  });

  it("refuses to transfer a bound copy, a copy in a deck, a disposed copy, and to oneself", () => {
    const { s, ada, bram, starter, crafted, opening } = world();
    expect(() => transfer(s, starter[0]!.copyId, ada, bram)).toThrow(/unbound copy/);
    expect(() => transfer(s, crafted.copyId, ada, bram)).toThrow(/unbound copy/);
    expect(() => move(s, crafted.copyId, bram)).toThrow(/never change owner/);
    // In a deck: take it out first.
    // (A pack copy of a starter card, so the deck is the starter list.)
    const pulled = s.grantCopy({ ownerId: ada, cardId: starter[0]!.cardId, origin: "pack" }).copyId;
    s.saveDeck(ada, "with pull", [pulled, ...starter.slice(1).map((c) => c.copyId)]);
    expect(() => transfer(s, pulled, ada, bram)).toThrow(/in a deck/);
    // Disposed (salvaged): gone, never moves, and stays disposed.
    const commons = opening.cards.filter((c) => {
      const copy = s.getCopy(c.copyId);
      return copy.finish === "standard" && copy.copyId !== pulled;
    });
    const victim = commons[0]!.copyId;
    s.unsafeExec(`UPDATE card_copies SET disposed_at = '${clock.toISOString()}', disposed_reason = 'salvaged' WHERE copy_id = '${victim}'`);
    expect(() => transfer(s, victim, ada, bram)).toThrow(/unbound copy still held/);
    expect(() => s.unsafeExec(`UPDATE card_copies SET disposed_at = NULL, disposed_reason = NULL WHERE copy_id = '${victim}'`)).toThrow(/stays disposed/);
    expect(s.copyProvenance(victim).copy.disposedReason).toBe("salvaged");
    expect(() => transfer(s, opening.cards.at(-1)!.copyId, ada, ada)).toThrow(/CHECK/);
  });

  it("a signature card is bound: never transferable", () => {
    const s = open();
    const ada = s.createOwner({ name: "Ada" }).ownerId;
    const bram = s.createOwner({ name: "Bram" }).ownerId;
    const draft = s.startAgentDraft(ada, { seed: 3 });
    s.pickDraftAgent(ada, draft.draftId, 0, { seed: 4 });
    const gen = s.confirmAgentDraft(ada, draft.draftId, 0);
    const p = s.copyProvenance(gen.copy.copyId);
    expect(p.source).toEqual({ kind: "signature", agentId: gen.agent.agentId });
    expect(p.transferable).toBe(false);
    expect(() => transfer(s, gen.copy.copyId, ada, bram)).toThrow(/unbound copy/);
  });

  it("an ended season's file refuses every transfer", () => {
    const { s, ada, bram, opening } = world();
    s.endSeason();
    expect(() => transfer(s, opening.cards[0]!.copyId, ada, bram)).toThrow(/collection is frozen/);
  });

  it("migrates a v27 file with every copy kept, ids unchanged, and no transfers", () => {
    const dir = mkdtempSync(join(tmpdir(), "provenance-"));
    tmpDirs.push(dir);
    const path = join(dir, "v27.db");
    const v27 = open(path, 27);
    const ada = v27.createOwner({ name: "Ada" }).ownerId;
    const before = v27.grantStarterCollection(ada, "Swarm").copies;
    const raw = v27.grantCopy({ ownerId: ada, cardId: COMMON, origin: "pack" });
    v27.close();
    const v28 = open(path);
    expect(v28.schemaVersion).toBe(28);
    expect(v28.collection(ada).map((c) => c.copyId)).toEqual([...before.map((c) => c.copyId), raw.copyId]);
    expect(v28.copyTransfers(raw.copyId)).toEqual([]);
    // A pack copy granted without a pack (tests, pre-v8 data) reads as "other", not an error.
    expect(v28.copyProvenance(raw.copyId).source).toEqual({ kind: "other", origin: "pack", originRef: null });
    expect(v28.copyProvenance(raw.copyId).owners.map((o) => o.ownerId)).toEqual([ada]);
    v28.close();
  });
});
