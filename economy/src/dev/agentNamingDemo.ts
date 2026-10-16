// Evidence for owners naming their agents (owner 2026-10-16, session 37).
//
//   npx tsx src/dev/agentNamingDemo.ts > ../progress/economy-demo-007.txt
//
// In a real database file: an owner keeps a generated name, another types
// one at creation (free); the typed-name rules refuse what they should; a
// rename costs pack points earned by opening packs; match history shows
// the current name and "formerly ..."; an admin force-renames a bad name,
// which is never shown again and stays reserved; the file is closed and
// reopened and the schema itself refuses unlogged renames.
// Seeds are fixed so the output reproduces; the store draws them
// server-side otherwise.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENT_NAME_MAX_LENGTH } from "@ai-tcg/engine";
import { AGENT_RENAME_PACK_POINTS, EconomyError, EconomyStore, PACK_POINTS_PER_PACK, type AgentNames } from "../index.js";

const tempDir = mkdtempSync(join(tmpdir(), "agent-naming-demo-"));
const dbPath = join(tempDir, "season-0.db");
let clock = new Date("2026-10-17T09:00:00.000Z");
const tick = (minutes = 1) => (clock = new Date(clock.getTime() + minutes * 60_000));
let store = EconomyStore.open(dbPath, { now: () => clock });
const say = (line = "") => console.log(line);
const PW = "correct horse battery";
const tryIt = (what: string, fn: () => unknown) => {
  try {
    fn();
    say(`  ${what}: accepted`);
  } catch (err) {
    if (!(err instanceof EconomyError)) throw err;
    say(`  ${what}: refused — ${err.message}`);
  }
};
const shown = (n: AgentNames) => (n.formerly.length > 0 ? `${n.current} (formerly ${n.formerly.join(", ")})` : n.current);

say("# Owners name their agents (session 37)");
say(`database: <temp>/season-0.db  schema v${store.schemaVersion}  season ${store.season}`);
say(`rules: ${3}-${AGENT_NAME_MAX_LENGTH} characters; letters, digits, spaces and ' . - _; unique without case; old names reserved;`);
say(`       no staff or game impersonation; never another owner's username; the blocked-word list; a rename costs ${AGENT_RENAME_PACK_POINTS} pack points`);
say();

const admin = store.createAccount({ name: "House admin", username: "house", password: PW, isAdmin: true }).ownerId;
const ada = store.createAccount({ name: "Ada", username: "neon_fan99", password: PW }).ownerId;
const bo = store.createAccount({ name: "Bo", username: "bo-runner", password: PW }).ownerId;

function draft(ownerId: string, seed: number) {
  tick();
  const d = store.startAgentDraft(ownerId, { seed });
  const p = store.pickDraftAgent(ownerId, d.draftId, 0, { seed: seed + 1 });
  return { d, sig: p.signatures![0]! };
}

say("## 1. Naming is free at creation");
const a1 = draft(ada, 100);
say(`  Ada's 3 generated candidates: ${a1.d.agents.map((a) => `"${a.name}"`).join(", ")}`);
const adaAgent = store.confirmAgentDraft(ada, a1.d.draftId, 0).agent;
say(`  Ada keeps the first: "${adaAgent.name}" (logged as ${store.agentNames(adaAgent.agentId).history[0]!.kind})`);
const b1 = draft(bo, 200);
say(`  Bo's candidates: ${b1.d.agents.map((a) => `"${a.name}"`).join(", ")}; Bo types a name instead.`);
tryIt(`"${adaAgent.name.toUpperCase()}" (Ada's agent's name, other case)`, () => store.confirmAgentDraft(bo, b1.d.draftId, 0, { name: adaAgent.name.toUpperCase() }));
tryIt(`"Neon Fan 99" (Ada's username, spaced)`, () => store.confirmAgentDraft(bo, b1.d.draftId, 0, { name: "Neon Fan 99" }));
tryIt(`"AI-TCG Official"`, () => store.confirmAgentDraft(bo, b1.d.draftId, 0, { name: "AI-TCG Official" }));
tryIt(`"TheRealAdmin"`, () => store.confirmAgentDraft(bo, b1.d.draftId, 0, { name: "TheRealAdmin" }));
tryIt(`"Аdmin" (a Cyrillic A)`, () => store.confirmAgentDraft(bo, b1.d.draftId, 0, { name: "Аdmin" }));
tryIt(`"Shitposter"`, () => store.confirmAgentDraft(bo, b1.d.draftId, 0, { name: "Shitposter" }));
tryIt(`"Static Static"`, () => store.confirmAgentDraft(bo, b1.d.draftId, 0, { name: "Static Static" }));
tryIt(`"Hi"`, () => store.confirmAgentDraft(bo, b1.d.draftId, 0, { name: "Hi" }));
tryIt(`"a..b"`, () => store.confirmAgentDraft(bo, b1.d.draftId, 0, { name: "a..b" }));
const boMade = store.confirmAgentDraft(bo, b1.d.draftId, 0, { name: "  Night   Owl " });
const boAgent = boMade.agent;
say(`  "  Night   Owl " is tidied and accepted: "${boAgent.name}" (logged as ${store.agentNames(boAgent.agentId).history[0]!.kind}, free; Bo's ledger has ${store.ledger(bo).length} entries)`);
say(`  its signature card keeps its generated name: "${boMade.signature.card.name}"`);
say(`  the flavour is printed with the name it was created with:`);
say(`    shown in the draft: "${b1.sig.flavor}"`);
say(`    printed:            "${boMade.signature.card.flavor}"`);
say();

say("## 2. A rename costs pack points");
tryIt(`Bo renames to "Day Owl" with 0 pack points`, () => store.renameAgent(bo, boAgent.agentId, "Day Owl"));
for (let i = 0; i < 25; i++) store.grantPack(bo, "S0", "weeklyChallenge");
tick();
store.openPacks(bo, 10, { seeds: Array.from({ length: 10 }, (_, i) => i) });
store.openPacks(bo, 10, { seeds: Array.from({ length: 10 }, (_, i) => 10 + i) });
for (let i = 0; i < 5; i++) store.openPack(bo, undefined, { seed: 20 + i });
say(`  Bo opens 25 packs: ${store.balance(bo, "packPoints")} pack points (${PACK_POINTS_PER_PACK} a pack)`);
tick();
let names = store.renameAgent(bo, boAgent.agentId, "Day Owl");
say(`  renamed: ${shown(names)}; pack points left ${store.balance(bo, "packPoints")}`);
const charge = store.ledger(bo).find((e) => e.reason === "agentRename")!;
say(`  ledger: ${charge.delta} ${charge.currency} "${charge.reason}" ref ${charge.ref}`);
tryIt(`a second rename with ${store.balance(bo, "packPoints")} pack points`, () => store.renameAgent(bo, boAgent.agentId, "Dusk Owl"));
tryIt(`Ada renames Bo's agent`, () => store.renameAgent(ada, boAgent.agentId, "Stolen Owl"));
tryIt(`Ada's agent takes the name "night owl" (Bo's old one)`, () => {
  const d = draft(ada, 300);
  store.confirmAgentDraft(ada, d.d.draftId, 0, { name: "night owl" });
});
say();

say("## 3. Match history shows the name and what it was formerly");
for (const [o, faction] of [[ada, "Cortex"], [bo, "Swarm"]] as const) {
  const { copies } = store.grantStarterCollection(o, faction);
  const deck = store.saveDeck(o, `${faction} starter`, copies.map((c) => c.copyId));
  store.setActiveDeck(o, deck.deckId);
}
store.connectAgent(ada, adaAgent.agentId);
store.connectAgent(bo, boAgent.agentId);
tick();
store.startMatch({ matchId: "named-1", p1OwnerId: ada, p2OwnerId: bo });
tryIt(`Bo renames during the live match`, () => store.renameAgent(bo, boAgent.agentId, "Live Owl"));
tick(6);
const rec = store.recordMatch({ matchId: "named-1", seed: 1, p1AgentId: adaAgent.agentId, p2AgentId: boAgent.agentId, outcome: { kind: "win", winnerAgentId: boAgent.agentId }, endedAt: clock.toISOString() });
for (const m of store.matchHistory({ ownerId: bo })) {
  say(`  ${m.matchId}: ${shown(store.agentNames(m.p1AgentId))} vs ${shown(store.agentNames(m.p2AgentId))}, won by ${shown(store.agentNames(m.winnerAgentId!))}; Bo credited ${rec.p2Credits}`);
}
say();

say("## 4. An admin's force-rename");
const c1 = draft(ada, 400);
const rude = store.confirmAgentDraft(ada, c1.d.draftId, 0, { name: "Rude Words" }).agent;
say(`  Ada names a second agent "${rude.name}" (imagine it slipped past the list and was reported)`);
tryIt(`Bo (not an admin) forces a rename`, () => store.forceRenameAgent(bo, rude.agentId, { reason: "x" }));
tick();
names = store.forceRenameAgent(admin, rude.agentId, { reason: "reported: offensive", seed: 9 });
say(`  the admin forces a fresh generated name: "${names.current}"; formerly shown: [${names.formerly.join(", ")}] (never again)`);
say(`  the log keeps it: ${names.history.map((e) => `${e.kind} "${e.name}"${e.note ? ` (${e.note})` : ""}`).join(" -> ")}`);
tryIt(`Bo's agent takes "rude words"`, () => {
  store.grantPack(bo, "S0", "weeklyChallenge");
  store.renameAgent(bo, boAgent.agentId, "rude words");
});
say(`  Ada's ledger has no forced-rename charge: ${store.ledger(ada).filter((e) => e.reason === "agentRename").length} rename entries`);
say();

say("## 5. Reopen the file; the schema refuses what the store would never do");
store.close();
store = EconomyStore.open(dbPath, { now: () => clock });
say(`  reopened at schema v${store.schemaVersion}: ${store.listAgents().map((a) => shown(store.agentNames(a.agentId))).join(" | ")}`);
const raw = (what: string, sql: string) => {
  try {
    store.unsafeExec(sql);
    say(`  raw SQL, ${what}: allowed (!)`);
  } catch (err) {
    say(`  raw SQL, ${what}: refused — ${(err as Error).message}`);
  }
};
raw("rename without a log entry", `UPDATE agents SET name = 'Sneaky' WHERE agent_id = '${boAgent.agentId}'`);
raw("edit the log", `UPDATE agent_names SET name = 'x'`);
raw("delete the log", `DELETE FROM agent_names`);
raw("insert an agent named 'DAY OWL'", `INSERT INTO agents (agent_id, owner_id, name, created_at) VALUES ('raw', '${ada}', 'DAY OWL', '${clock.toISOString()}')`);
raw("log Bo's old name for another agent", `INSERT INTO agent_names (agent_id, name, kind, named_at) VALUES ('${adaAgent.agentId}', 'NIGHT OWL', 'rename', '${clock.toISOString()}')`);
raw("charge pack points on a typed name", `INSERT INTO agent_names (agent_id, name, kind, pack_points, named_at) VALUES ('${adaAgent.agentId}', 'Paid Name', 'custom', 5, '${clock.toISOString()}')`);
store.close();
rmSync(tempDir, { recursive: true, force: true });
