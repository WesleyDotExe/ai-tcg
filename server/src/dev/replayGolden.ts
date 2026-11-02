// The golden replays (session 70, versioned replays): real replay files the
// ladder wrote, each with the match log it wrote beside it, committed under
// server/test/fixtures/replays/. server/test/replayGolden.test.ts rebuilds
// every one and checks the log byte for byte: a change to the engine or the
// cards that would change how a recorded match plays fails there, loudly,
// instead of quietly showing owners a different match than the one they
// watched. (The fix for such a change is a new rules version with the old
// behaviour kept, engine/src/engine/versions.ts, never new golden files.)
//
//   npx tsx src/dev/replayGolden.ts <prefix> <seed>
//
// writes <prefix>-1 and <prefix>-2 (.replay.json, .txt): one round of four
// house owners, one per faction, one of them a generated agent with its own
// signature card. Session 70 ran it once with the session-69 writer in
// place (prefix v1: genuine ai-tcg-replay/1 files) and once with today's
// (prefix v2). Never re-run it over existing files: they are the record.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EconomyStore } from "@ai-tcg/economy";
import type { DeckFaction } from "@ai-tcg/engine";
import { houseSeater, Ladder } from "../ladder/ladderRunner.js";

const [prefix, seedArg] = process.argv.slice(2);
if (!prefix || !seedArg) throw new Error("usage: replayGolden.ts <prefix> <seed>");
const seed = Number(seedArg);
const out = join(import.meta.dirname, "..", "..", "test", "fixtures", "replays");
mkdirSync(out, { recursive: true });
if (existsSync(join(out, `${prefix}-1.replay.json`))) throw new Error(`${prefix} golden replays exist already: they are the record, not regenerated`);

let clock = new Date("2026-11-01T22:00:00.000Z");
const store = EconomyStore.open(":memory:", { now: () => clock });
const factions: DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"];
const owners = factions.map((f, i) => {
  const o = store.createOwner({ name: `golden-${i}`, kind: "house" });
  store.grantStarterCollection(o.ownerId, f);
  const a = store.createAgent({ ownerId: o.ownerId, name: `Golden ${f}` });
  store.connectAgent(o.ownerId, a.agentId);
  return o;
});
// One generated agent: its signature card travels in the replay in full.
const draft = store.startAgentDraft(owners[0]!.ownerId, { seed: seed + 1 });
store.pickDraftAgent(owners[0]!.ownerId, draft.draftId, 0, { seed: seed + 2 });
const { agent } = store.confirmAgentDraft(owners[0]!.ownerId, draft.draftId, 0, { artSlot: 1 });
store.connectAgent(owners[0]!.ownerId, agent.agentId);

const dir = mkdtempSync(join(tmpdir(), "golden-"));
let n = 0;
const ladder = new Ladder({
  store,
  seater: houseSeater,
  seed,
  build: { games: 0 },
  matchId: () => `${prefix}-${++n}`,
  housePacks: false,
  logDir: dir,
  afterMatch: () => {
    clock = new Date(clock.getTime() + 600_000);
  },
});
const round = await ladder.runRound();
for (const m of round.matches) {
  if (!m.replayPath || !m.logPath) throw new Error(`${m.record.matchId} wrote no replay`);
}
for (const f of readdirSync(dir)) writeFileSync(join(out, f), readFileSync(join(dir, f)));
rmSync(dir, { recursive: true, force: true });
for (const m of round.matches) {
  const file = JSON.parse(readFileSync(m.replayPath!.replace(dir, out), "utf8")) as { format: string; moves: unknown[] };
  console.log(`${m.record.matchId}: ${file.format}, ${file.moves.length} moves, ${m.record.turns} turns, ${m.record.outcome}`);
}
