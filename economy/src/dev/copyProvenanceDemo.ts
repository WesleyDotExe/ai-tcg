// Evidence for the marketplace groundwork (schema v28, session 84; owner
// 2026-11-10: "audit first; build only what can't be added later").
//
//   npx tsx src/dev/copyProvenanceDemo.ts > ../progress/copy-provenance-001.txt
//
// In a real database file: three owners get what Season 0 gives (the
// starter collection, a generated agent with its signature card, a daily
// pack, bought packs opened through the store, a craft, one Prototype pull).
// Then every copy in the file is read back with `copyProvenance`: each has
// its own id and resolves to its source with no broken link. A trial chain
// of two transfers is written the way a future marketplace would (raw SQL:
// nothing in Season 0 transfers a copy), the file is closed and reopened,
// and the chain reads back in order. Last, the schema refuses what it
// should. Random ids are shown as short aliases so the output reproduces.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { cardSet, EconomyError, EconomyStore, LIVE_PACK_ODDS, rollPack, type CopyProvenance, type PityState } from "../index.js";

const tempDir = mkdtempSync(join(tmpdir(), "copy-provenance-demo-"));
const dbPath = join(tempDir, "season-0.db");
let clock = new Date("2026-11-20T09:00:00.000Z");
const tick = (minutes: number) => (clock = new Date(clock.getTime() + minutes * 60_000));
const say = (line = "") => console.log(line);
const S0 = cardSet("S0");
const NO_PITY: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
const ALL_RUNS = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));
let passes = 0;
let fails = 0;
const check = (ok: boolean, what: string) => {
  ok ? passes++ : fails++;
  say(`  [${ok ? "PASS" : "FAIL"}] ${what}`);
};

// Short, stable aliases for random ids (owners, packs, copies), in the order first shown.
const aliases = new Map<string, string>();
const counters = new Map<string, number>();
const alias = (id: string, prefix: string) => {
  if (!aliases.has(id)) {
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    aliases.set(id, `${prefix}${n}`);
  }
  return aliases.get(id)!;
};

let store = EconomyStore.open(dbPath, { now: () => clock });
const ownerName = new Map<string, string>();
const owner = (name: string) => {
  const id = store.createOwner({ name }).ownerId;
  ownerName.set(id, name);
  return id;
};
const credit = (ownerId: string, currency: "credits" | "packPoints", amount: number) =>
  store.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${ownerId}', '${currency}', ${amount}, 'demoGrant', '${clock.toISOString()}')`);

say("Marketplace groundwork: every copy's id, source and chain of owners (schema v28)");
say("=".repeat(76));
say();

// ---- 1. A Season 0 file ----
say("1. A Season 0 file, filled the way Season 0 fills it");
say("-".repeat(76));
const ada = owner("Ada");
const bram = owner("Bram");
const cy = owner("Cy");
for (const [o, f] of [[ada, "Cortex"], [bram, "Aegis"], [cy, "Swarm"]] as const) store.grantStarterCollection(o, f);
const draft = store.startAgentDraft(ada, { seed: 7 });
store.pickDraftAgent(ada, draft.draftId, 0, { seed: 8 });
const gen = store.confirmAgentDraft(ada, draft.draftId, 0);
tick(10);
const daily = store.grantPack(ada, "S0", "ownerDaily");
store.openPack(ada, daily.packId, { seed: 101 });
credit(ada, "credits", 1000);
credit(bram, "credits", 1000);
for (let i = 0; i < 3; i++) {
  tick(3);
  const p = store.buyPack(ada, "S0");
  store.openPack(ada, p.packId, { seed: 200 + i });
}
let protoSeed = -1;
for (let seed = 0; seed < 1_000_000 && protoSeed < 0; seed++) if (rollPack(seed, S0, NO_PITY, ALL_RUNS, LIVE_PACK_ODDS).pulls.some((p) => p.finish === "prototype")) protoSeed = seed;
tick(3);
const bramPack = store.buyPack(bram, "S0");
const bramOpening = store.openPack(bram, bramPack.packId, { seed: protoSeed });
credit(bram, "packPoints", 100);
tick(3);
const crafted = store.craftCard(bram, S0.cards.find((c) => c.rarity === "Common")!.cardId);

// Every copy row in the file, read straight from the database (not through the store).
const allIds = () => {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const rows = db.prepare("SELECT copy_id FROM card_copies ORDER BY rowid").all() as { copy_id: string }[];
  db.close();
  return rows.map((r) => r.copy_id);
};
const ids = allIds();
say(`  owners: Ada (Cortex starter, agent ${gen.agent.name} with its signature card, 1 daily + 3 bought packs opened),`);
say(`          Bram (Aegis starter, 1 bought pack with a Prototype pull, 1 craft), Cy (Swarm starter)`);
say(`  card copies in the file: ${ids.length}`);
check(new Set(ids).size === ids.length, "every copy is its own row with its own id (no counts per card)");
say();

// ---- 2. One copy of each source ----
say("2. Provenance, one copy of each source");
say("-".repeat(76));
const show = (p: CopyProvenance, label: string) => {
  const c = p.copy;
  const serial = c.serial === null ? "" : ` #${c.serial}/${c.runSize} (${c.seriesCode})`;
  say(`  ${label}: ${alias(c.copyId, "copy-")}  ${c.cardId} ${c.finish}${serial}  bound: ${c.accountBound ? "yes" : "no"}  transferable: ${p.transferable ? "yes" : "no"}`);
  const s = p.source;
  if (s.kind === "pack") say(`      from pack ${alias(s.packId, "pack-")} (${s.packSource}, set ${s.setCode}), bought/granted ${s.packAcquiredAt}, opened ${s.openedAt}, seed ${s.seed}, odds ${s.oddsVersion}`);
  else if (s.kind === "crafted") say(`      crafted: ledger entry ${s.ledgerEntryId} (${s.reason}, ${s.packPoints} pack points)`);
  else if (s.kind === "starter") say(`      starter collection, faction ${s.faction}`);
  else if (s.kind === "signature") say(`      signature card of agent ${gen.agent.agentId === s.agentId ? gen.agent.name : s.agentId}`);
  else say(`      origin ${s.origin}, ref ${s.originRef ?? "none"}`);
  for (const o of p.owners) say(`      owner ${ownerName.get(o.ownerId)} from ${o.from}${o.until ? ` until ${o.until}` : " (holds it now)"}${o.via ? ` via ${o.via.kind}${o.via.ref ? ` ${o.via.ref}` : ""}` : ""}`);
};
const proto = bramOpening.cards.find((c) => c.prototype)!;
const dailyCopy = store.packOpening(daily.packId).copies[0]!;
show(store.copyProvenance(store.collection(ada).find((c) => c.origin === "starter")!.copyId), "starter  ");
show(store.copyProvenance(gen.copy.copyId), "signature");
show(store.copyProvenance(dailyCopy.copyId), "daily    ");
show(store.copyProvenance(store.collection(ada).find((c) => c.originRef?.startsWith("pack:") && c.originRef !== `pack:${daily.packId}`)!.copyId), "bought   ");
show(store.copyProvenance(proto.copyId), "Prototype");
show(store.copyProvenance(crafted.copyId), "crafted  ");
say();

// ---- 3. Every copy ----
say("3. Every copy in the file, read back");
say("-".repeat(76));
const bySource = new Map<string, number>();
let broken = 0;
for (const id of ids) {
  try {
    const p = store.copyProvenance(id);
    const key = `${p.source.kind}${p.transferable ? "" : " (bound)"}`;
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  } catch (err) {
    broken++;
    say(`  ${alias(id, "copy-")}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
for (const [k, n] of [...bySource].sort()) say(`  ${k.padEnd(20)} ${n}`);
check(broken === 0, `all ${ids.length} copies resolve to their source, none of them "other"`);
check(!bySource.has("other"), "no copy without a named source");
say();

// ---- 4. A trial chain of transfers ----
say("4. A trial chain of two transfers (as a future marketplace would write it)");
say("-".repeat(76));
const sold = dailyCopy.copyId;
const at = () => clock.toISOString();
tick(60);
store.unsafeExec(`INSERT INTO copy_transfers (copy_id, from_owner, to_owner, kind, ref, at) VALUES ('${sold}', '${ada}', '${bram}', 'sale', 'trial-sale-1', '${at()}')`);
store.unsafeExec(`UPDATE card_copies SET owner_id = '${bram}' WHERE copy_id = '${sold}'`);
tick(60);
store.unsafeExec(`INSERT INTO copy_transfers (copy_id, from_owner, to_owner, kind, ref, at) VALUES ('${sold}', '${bram}', '${cy}', 'trade', 'trial-trade-1', '${at()}')`);
store.unsafeExec(`UPDATE card_copies SET owner_id = '${cy}' WHERE copy_id = '${sold}'`);
store.close();
store = EconomyStore.open(dbPath, { now: () => clock });
say(`  closed and reopened the file (schema v${store.schemaVersion})`);
const chain = store.copyProvenance(sold);
show(chain, "traded   ");
check(chain.firstOwnerId === ada && chain.owners.map((o) => ownerName.get(o.ownerId)).join(" > ") === "Ada > Bram > Cy", "the chain reads Ada > Bram > Cy, first owner Ada");
check(chain.source.kind === "pack" && chain.copy.copyId === sold, "the copy kept its id and its pack");
say();

// ---- 5. Refusals ----
say("5. The schema refuses (raw SQL, as a hand-run sqlite3 shell would try)");
say("-".repeat(76));
const refused = (what: string, sql: string) => {
  try {
    store.unsafeExec(sql);
    check(false, `${what}: ALLOWED`);
  } catch (err) {
    check(true, `${what}: refused (${err instanceof EconomyError || err instanceof Error ? err.message : String(err)})`);
  }
};
const another = store.collection(ada).find((c) => !c.accountBound)!.copyId;
const starter = store.collection(bram).find((c) => c.origin === "starter")!.copyId;
refused("moving a copy with no transfer record", `UPDATE card_copies SET owner_id = '${cy}' WHERE copy_id = '${another}'`);
refused("a transfer from someone who doesn't hold it", `INSERT INTO copy_transfers (copy_id, from_owner, to_owner, kind, at) VALUES ('${another}', '${bram}', '${cy}', 'sale', '${at()}')`);
refused("transferring a starter copy", `INSERT INTO copy_transfers (copy_id, from_owner, to_owner, kind, at) VALUES ('${starter}', '${bram}', '${cy}', 'sale', '${at()}')`);
refused("transferring a crafted copy", `INSERT INTO copy_transfers (copy_id, from_owner, to_owner, kind, at) VALUES ('${crafted.copyId}', '${bram}', '${cy}', 'sale', '${at()}')`);
refused("transferring the signature card", `INSERT INTO copy_transfers (copy_id, from_owner, to_owner, kind, at) VALUES ('${gen.copy.copyId}', '${ada}', '${cy}', 'sale', '${at()}')`);
refused("rewriting a transfer", `UPDATE copy_transfers SET to_owner = '${ada}'`);
refused("deleting a transfer", `DELETE FROM copy_transfers`);
refused("deleting a copy", `DELETE FROM card_copies WHERE copy_id = '${another}'`);
refused("changing a copy's id", `UPDATE card_copies SET copy_id = 'new-id' WHERE copy_id = '${another}'`);
refused("changing where a copy came from", `UPDATE card_copies SET origin_ref = NULL WHERE copy_id = '${another}'`);
refused("renumbering a Prototype serial", `UPDATE card_copies SET serial = serial + 1 WHERE copy_id = '${proto.copyId}'`);
store.endSeason();
refused("a transfer after the season ended", `INSERT INTO copy_transfers (copy_id, from_owner, to_owner, kind, at) VALUES ('${another}', '${ada}', '${cy}', 'sale', '${at()}')`);
say();

say(`Schema v${store.schemaVersion}. ${passes} PASS, ${fails} FAIL.`);
store.close();
rmSync(tempDir, { recursive: true, force: true });
if (fails > 0) process.exit(1);
