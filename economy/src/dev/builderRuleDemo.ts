// Evidence for the builder's rule on the agent's deck (schema v25, session
// 80; owner 2026-11-06: "switch keepDesigned on for the store's deck builder
// at a margin of 1 SD ... rebuild agent decks through the normal rebuild
// reasons, and record it with the builder's settings so a build says which
// rule and margin made it").
//
//   npx tsx src/dev/builderRuleDemo.ts > ../progress/builder-rule-001.txt
//
// A real database file at v24 (before this session): four house owners, one
// per faction, each with its starter collection and starter packs opened,
// whose agents built their decks with the plain rule (the store's rule
// before session 80). The file is reopened at the current schema: the
// migration keeps every deck, each deck reads as built with the plain rule,
// and each names the rule change as a rebuild reason. The rebuild (the
// normal path, `rebuildAgentDeckIfNeeded`) uses the store's rule and records
// it. Smaller build settings than the store's, so it runs in seconds; the
// rule is the store's. Seeds and the clock are fixed so the output
// reproduces.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_BUILD, builderRule, describeBuilderRule, type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore, type AgentDeckBuild } from "../index.js";

const tempDir = mkdtempSync(join(tmpdir(), "builder-rule-demo-"));
const path = join(tempDir, "season-0.db");
const now = () => new Date("2026-11-06T09:00:00.000Z");
const say = (line = "") => console.log(line);
const BUILD = { games: 10, trials: 6, confirmGames: 60 };
const checks: [string, boolean][] = [];
const check = (what: string, ok: boolean) => checks.push([what, ok]);

const FACTIONS: DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"];
const listOf = (s: EconomyStore, deckId: string) =>
  s
    .deckStatus(deckId)
    .list.map((l) => `${l.cardId}x${l.copies}`)
    .sort()
    .join(",");
const picks = (b: AgentDeckBuild) => b.factions.map((f) => `${f.faction} ${f.chosen}${f.winRate !== undefined ? ` ${(f.winRate * 100).toFixed(1)}%` : ""}`).join(", ");

say("# The builder's rule on the agent's deck (schema v25, session 80)");
say(`The store's rule now: ${builderRule()} (${describeBuilderRule(builderRule())}); DEFAULT_BUILD ${JSON.stringify(DEFAULT_BUILD)}.`);
say(`Builds here: ${JSON.stringify(BUILD)} (smaller than the store's, so the demo runs in seconds), forced to each owner's starting faction by its lock.`);
say();

say("## 1. A v24 file: four agents build with the plain rule, as every deck before session 80 was built");
const v24 = EconomyStore.open(path, { now, migrateTo: 24 });
say(`  schema v${v24.schemaVersion}`);
const owners: { name: string; ownerId: string; faction: DeckFaction; before: string }[] = [];
let packSeed = 8000;
for (const faction of FACTIONS) {
  const name = `${faction.toLowerCase()}-house`;
  const o = v24.createOwner({ name, kind: "house" });
  v24.grantStarterCollection(o.ownerId, faction);
  while (v24.unopenedPacks(o.ownerId).length > 0) v24.openPack(o.ownerId, undefined, { seed: packSeed++ });
  const agent = v24.createAgent({ ownerId: o.ownerId, name: `${name}'s agent` });
  v24.connectAgent(o.ownerId, agent.agentId);
  v24.setFactionLock(o.ownerId, faction);
  const built = await v24.buildAgentDeck(o.ownerId, { ...BUILD, keepDesigned: null });
  owners.push({ name, ownerId: o.ownerId, faction, before: listOf(v24, built.deck.deckId) });
  say(`  ${name.padEnd(13)} ${v24.collection(o.ownerId).length} copies; built ${built.faction} (${picks(built)}), rule ${built.rule}`);
  check(`${name}: the v24 store reports no rebuild reason (it keeps no rule)`, v24.agentDeckRebuildReasons(o.ownerId).length === 0);
}
v24.close();
say();

say("## 2. Reopened at the current schema");
const store = EconomyStore.open(path, { now });
say(`  schema v${store.schemaVersion}`);
check("the file migrates to v25 or later", store.schemaVersion >= 25);
for (const o of owners) {
  const from = store.agentDeckBuiltFrom(o.ownerId)!;
  const reasons = store.agentDeckRebuildReasons(o.ownerId);
  say(`  ${o.name.padEnd(13)} recorded rule: ${from.rule}; rebuild reasons: ${reasons.join("; ")}`);
  check(`${o.name}: the deck survives the migration unchanged`, listOf(store, store.agentDeckId(o.ownerId)!) === o.before);
  check(`${o.name}: a pre-v25 deck reads as the plain rule and asks for one rebuild, for the rule`, from.rule === "plain" && reasons.length === 1 && reasons[0]!.startsWith("the builder's rule changed"));
}
say();

say("## 3. The normal rebuild path (rebuildAgentDeckIfNeeded, what the ladder calls between rounds)");
for (const o of owners) {
  const r = (await store.rebuildAgentDeckIfNeeded(o.ownerId, BUILD))!;
  const after = listOf(store, r.build.deck.deckId);
  const f = r.build.factions.find((x) => x.faction === o.faction)!;
  say(`  ${o.name.padEnd(13)} rebuilt: ${f.faction} keeps the ${f.chosen} deck (${(f.winRate! * 100).toFixed(1)}%); rule ${r.build.rule}; list ${after === o.before ? "unchanged" : "changed"}; reasons now: ${store.agentDeckRebuildReasons(o.ownerId).join("; ") || "none"}`);
  check(`${o.name}: rebuilt under the store's rule and recorded`, r.build.rule === builderRule() && store.agentDeckBuiltFrom(o.ownerId)!.rule === builderRule());
  check(`${o.name}: up to date after one rebuild`, store.agentDeckRebuildReasons(o.ownerId).length === 0);
  check(`${o.name}: a second call has nothing to do`, (await store.rebuildAgentDeckIfNeeded(o.ownerId, BUILD)) === null);
}
store.close();
rmSync(tempDir, { recursive: true, force: true });
say();

const failed = checks.filter(([, ok]) => !ok).length;
for (const [what, ok] of checks) say(`${ok ? "PASS" : "FAIL"}  ${what}`);
say(`${checks.length - failed} PASS, ${failed} FAIL`);
if (failed > 0) process.exitCode = 1;
