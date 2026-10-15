// Evidence for generating a new agent (session 34; owner app spec B, the
// unique Mythic spec, owner 2026-10-15 option A).
//
//   npx tsx src/dev/generateAgentDemo.ts > ../progress/economy-demo-004.txt
//
// In a real database file: an owner with the starter collection runs
// "Generate a new agent" (3 agents, pick one, 3 signature cards, confirm),
// gets the card as its bound promo PR-001, connects the agent and plays a
// recorded match against a house owner, with the generated card played from
// the signature zone. Then a second agent: the season never offers a taken
// combination again, and switching agents changes only the signature card.
// Seeds are fixed here so the output reproduces; the store draws them
// server-side otherwise.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APPROVED_SIGNATURE_LINES, formatEvent, LookaheadAgent, runMatch, type GameEvent } from "@ai-tcg/engine";
import { EconomyError, EconomyStore, type GeneratedAgent } from "../index.js";

const tempDir = mkdtempSync(join(tmpdir(), "generate-agent-demo-"));
const dbPath = join(tempDir, "season-0.db");
let clock = new Date("2026-10-16T09:00:00.000Z");
const tick = (minutes: number) => (clock = new Date(clock.getTime() + minutes * 60_000));
let store = EconomyStore.open(dbPath, { now: () => clock });
const say = (line = "") => console.log(line);
const pct = (x: number) => (x * 100).toFixed(1);

say("# Generate a new agent (session 34)");
say(`database: <temp>/season-0.db  schema v${store.schemaVersion}  season ${store.season}`);
say(`approved signature lines: ${APPROVED_SIGNATURE_LINES.length}, over ${new Set(APPROVED_SIGNATURE_LINES.map((l) => l.spec.ability)).size} menu options (only these are ever shown)`);
say();

// An owner with a deck to play, and a house owner to play against.
function readyOwner(name: string, faction: "Cortex" | "Swarm" | "Aegis" | "Null", kind: "player" | "house") {
  const owner = store.createOwner({ name, kind });
  const { copies } = store.grantStarterCollection(owner.ownerId, faction);
  const deck = store.saveDeck(owner.ownerId, `${faction} starter`, copies.map((c) => c.copyId));
  store.setActiveDeck(owner.ownerId, deck.deckId);
  return owner.ownerId;
}
const ada = readyOwner("Ada", "Aegis", "player");
const house = readyOwner("House Swarm", "Swarm", "house");
const houseAgent = store.createAgent({ ownerId: house, name: "House Swarm agent" });
store.connectAgent(house, houseAgent.agentId);

function runDraft(ownerId: string, seed: number, agentIndex: number, signatureIndex: number): GeneratedAgent {
  say("Generate a new agent: 3 generated agents");
  const draft = store.startAgentDraft(ownerId, { seed });
  draft.agents.forEach((a, i) => say(`  [${i}] ${a.name}: ${a.persona}`));
  say(`  owner picks [${agentIndex}] ${draft.agents[agentIndex]!.name}`);
  const picked = store.pickDraftAgent(ownerId, draft.draftId, agentIndex, { seed: seed + 1 });
  say("Its signature card: 3 candidates, each a line that passed the fairness test");
  picked.signatures!.forEach((c, i) =>
    say(`  [${i}] ${c.concept}  (${c.comboId}; worst edge ${pct(c.measured.worst)} pts at ${c.measured.seeds} seeds)\n        "${c.flavor}"`),
  );
  tick(1);
  const made = store.confirmAgentDraft(ownerId, draft.draftId, signatureIndex);
  const { agent, signature, copy } = made;
  say(`  owner picks [${signatureIndex}] and confirms`);
  say(`Created: agent ${agent.name} ("${agent.persona}")`);
  say(`  signature card ${signature.card.name}, ${signature.collectorNumber} (card id ${signature.cardId}), Neutral Mythic, cost ${signature.card.cost}, ${signature.card.attack}/${signature.card.health}`);
  say(`  granted copy: origin ${copy.origin}, ${copy.seriesKind} ${copy.seriesCode}, stamp ${copy.stamp}, originRef ${copy.originRef === `signature:${agent.agentId}` ? "signature:<agent id>" : copy.originRef}, account-bound ${copy.accountBound}`);
  const h = store.cardHoldings(ownerId, signature.cardId);
  say(`  card viewer: owned ${h.owned}, salvageable ${h.salvageable}${h.notSalvageable.length ? ` (${h.notSalvageable.map((r) => r.reason).join("; ")})` : ""}`);
  return made;
}

say("## 1. Ada generates a first agent");
const first = runDraft(ada, 2026, 1, 0);
say(`  wallet after: ${store.balance(ada)} credits, ${store.unopenedPacks(ada).length} unopened packs from the starter (a new agent brings nothing but its card)`);
say();

say("## 2. Ada connects it and plays a recorded match (the card plays from the signature zone)");
store.connectAgent(ada, first.agent.agentId);
async function playRecorded(matchId: string, agentId: string, seed: number) {
  const live = store.startMatch({ matchId, p1OwnerId: ada, p2OwnerId: house });
  say(`  startMatch ${matchId}: p1 deck "${live.p1.deck.name}" (${live.p1.deck.copyIds.length} copies), signature card in the zone: ${live.p1.deck.spec.signature?.name ?? "none"}`);
  const result = await runMatch({ ...live.p1.deck.spec, id: "p1" }, { ...live.p2.deck.spec, id: "p2" }, new LookaheadAgent("Ada's agent", seed * 2), new LookaheadAgent("House", seed * 2 + 1), seed);
  const sigName = live.p1.deck.spec.signature?.name;
  const sigIds = new Set(live.p1.deck.spec.signature?.abilities.map((a) => a.id) ?? []);
  const turnOf = new Map<GameEvent, number>();
  let turn = 0;
  for (const e of result.state.log) {
    if (e.type === "turnStart") turn = e.turn;
    turnOf.set(e, turn);
  }
  const lines = result.state.log
    .filter(
      (e: GameEvent) =>
        (e.type === "play" && e.fromSignatureZone === true) ||
        e.type === "signatureReturn" ||
        (e.type === "abilityTrigger" && sigIds.has(e.ability)) ||
        (e.type === "death" && e.unit === sigName),
    )
    .map((e: GameEvent) => `    turn ${String(turnOf.get(e)).padStart(2)}: ${formatEvent(e).trim()}`);
  say(`  the signature card in the match log (${lines.length} event(s)):`);
  for (const l of lines.slice(0, 12)) say(l);
  if (lines.length > 12) say(`    ... ${lines.length - 12} more`);
  const w = result.state.winner;
  tick(6);
  const rec = store.recordMatch({
    matchId,
    seed,
    p1AgentId: agentId,
    p2AgentId: houseAgent.agentId,
    outcome: w === "draw" ? { kind: "draw" } : { kind: "win", winnerAgentId: w === "p1" ? agentId : houseAgent.agentId },
    endedAt: clock.toISOString(),
  });
  say(`  result: ${w === "draw" ? "draw" : w === "p1" ? "Ada's agent wins" : "House wins"} on turn ${result.state.turnNumber}; Ada credited ${rec.p1Credits}`);
}
await playRecorded("demo-1", first.agent.agentId, 7);
say();

say("## 3. A second agent: the first card's combination is never offered again");
const second = runDraft(ada, 4242, 0, 2);
say(`  first card ${first.signature.comboId}, second ${second.signature.comboId}: ${first.signature.comboId === second.signature.comboId ? "SAME (bug)" : "different"}`);
say();

say("## 4. Switching agents changes only the signature card");
store.connectAgent(ada, second.agent.agentId);
await playRecorded("demo-2", second.agent.agentId, 8);
say();

say("## 5. The rules hold");
const attempt = (what: string, fn: () => unknown) => {
  try {
    fn();
    say(`  ${what}: ALLOWED (bug)`);
  } catch (err) {
    say(`  ${what}: refused (${err instanceof EconomyError ? err.message : String(err)})`);
  }
};
const starters = store.collection(ada).filter((c) => c.origin === "starter").slice(0, 39).map((c) => c.copyId);
attempt("putting the signature card in a deck", () => store.saveDeck(ada, "with signature", [first.copy.copyId, ...starters]));
attempt("salvaging it", () => store.salvage(ada, first.signature.cardId, 1));
attempt("moving it to another owner (raw SQL)", () => store.unsafeExec(`UPDATE card_copies SET owner_id = '${house}' WHERE copy_id = '${first.copy.copyId}'`));
attempt("deleting the card (raw SQL)", () => store.unsafeExec("DELETE FROM signature_cards"));
attempt("a set card dressed up as a signature copy", () =>
  store.grantCopy({ ownerId: ada, cardId: store.collection(ada)[0]!.cardId, origin: "promo", originRef: `signature:${second.agent.agentId}`, seriesKind: "promo", seriesCode: "PR-099", stamp: "SIGNATURE" }),
);
const stale = store.startAgentDraft(ada, { seed: 1 });
store.startAgentDraft(ada, { seed: 2 });
attempt("confirming a draft replaced by a newer one", () => store.pickDraftAgent(ada, stale.draftId, 0));
say();

// Reopen the file: the agents, cards and copies are persistent.
store.close();
store = EconomyStore.open(dbPath, { now: () => clock });
say("## 6. After closing and reopening the database file");
for (const a of store.listAgents(ada)) {
  const sig = store.signatureCard(a.agentId);
  say(`  ${a.name}: ${sig ? `${sig.card.name} (${sig.collectorNumber}, ${sig.comboId})` : "no signature card"}${store.connectedAgent(ada)?.agentId === a.agentId ? "  [connected]" : ""}`);
}
const history = store.matchHistory({ ownerId: ada });
say(`  Ada's recorded matches: ${history.length}`);
const taken = new Set(store.listAgents().map((a) => store.signatureCard(a.agentId)?.comboId).filter(Boolean));
const free = APPROVED_SIGNATURE_LINES.filter((l) => !taken.has(l.id)).length;
say(`  approved lines left untaken this season: ${free} of ${APPROVED_SIGNATURE_LINES.length} (a draft needs 3)`);
store.close();
rmSync(tempDir, { recursive: true, force: true });
