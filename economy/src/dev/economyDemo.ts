// Session 28 evidence: real engine matches, paid and recorded in a real
// database file, read back after the file is closed and reopened.
//
//   npm run demo -w @ai-tcg/economy [-- <db path>]
//
// Four house agents, one per faction, each owning its faction's shipped deck
// as starter copies (a stand-in: the real starter collection is session 29).
// Each agent plays from a deck saved from its own copies. Day 1 is a heavy
// round robin, so the strongest agents run past the 10-win daily cap; day 2
// is a short day plus a cancelled and an abandoned match. Then
// the owner buys packs with what the agents earned, and one purchase the
// balance can't cover is refused. Output is committed as
// progress/economy-demo-001.txt.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LookaheadAgent, runMatch, SHIPPED_DECK_LISTS, type DeckFaction } from "@ai-tcg/engine";
import { EconomyError, EconomyStore, type AgentRecord, type MatchRecord } from "../index.js";

const FACTIONS: DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"];
const DAY1 = Date.parse("2026-10-05T09:00:00.000Z");
const DAY2 = Date.parse("2026-10-06T09:00:00.000Z");
const MINUTES = 60_000;

const argPath = process.argv[2];
const tempDir = argPath ? null : mkdtempSync(join(tmpdir(), "economy-demo-"));
const dbPath = argPath ?? join(tempDir!, "season-0.db");

let clock = new Date(DAY1 - 60 * MINUTES);
const openStore = () => EconomyStore.open(dbPath, { now: () => clock });

const out: string[] = [];
const say = (line = "") => out.push(line);

let store = openStore();
say(`# Economy demo (session 28): persistence + match payouts`);
say(`database: <temp>/season-0.db  schema v${store.schemaVersion}  season ${store.season}`);
say();

// ---- agents, starter copies, decks ----
const agents: AgentRecord[] = [];
const deckOf = new Map<string, string>();
for (const faction of FACTIONS) {
  const agent = store.createAgent({ name: `house-${faction.toLowerCase()}`, faction });
  const copies = store.grantCopies(
    SHIPPED_DECK_LISTS[faction].flatMap(({ cardId, copies: n }) =>
      Array.from({ length: n }, () => ({ ownerId: agent.agentId, cardId, source: "starter" as const })),
    ),
  );
  const deck = store.saveDeck(agent.agentId, `${faction} starter`, copies.map((c) => c.copyId));
  store.setActiveDeck(agent.agentId, deck.deckId);
  deckOf.set(agent.agentId, deck.deckId);
  agents.push(agent);
  say(`agent ${agent.name.padEnd(13)} ${copies.length} owned copies, deck "${deck.name}" (${deck.spec.cards.length} cards) active`);
}
say();

const name = (id: string | null) => agents.find((a) => a.agentId === id)?.name ?? "-";

// ---- play and record ----
async function play(matchNo: number, p1: AgentRecord, p2: AgentRecord, endedAt: number): Promise<MatchRecord> {
  const deck1 = store.loadDeck(deckOf.get(p1.agentId)!);
  const deck2 = store.loadDeck(deckOf.get(p2.agentId)!);
  const seed = 2800 + matchNo;
  const result = await runMatch(
    { ...deck1.spec, id: "p1" },
    { ...deck2.spec, id: "p2" },
    new LookaheadAgent(p1.name, seed * 2),
    new LookaheadAgent(p2.name, seed * 2 + 1),
    seed,
  );
  const w = result.state.winner;
  clock = new Date(endedAt);
  return store.recordMatch({
    matchId: `s0-m${String(matchNo).padStart(3, "0")}`,
    seed,
    p1AgentId: p1.agentId,
    p2AgentId: p2.agentId,
    p1DeckId: deck1.deckId,
    p2DeckId: deck2.deckId,
    outcome: w === "p1" ? { kind: "win", winnerAgentId: p1.agentId } : w === "p2" ? { kind: "win", winnerAgentId: p2.agentId } : { kind: "draw" },
    turns: result.state.turnNumber,
    moves: result.movesPlayed,
    endedAt: new Date(endedAt).toISOString(),
  });
}

function row(m: MatchRecord): string {
  const credit = (agentId: string, c: number) => `${name(agentId)} +${c}`;
  const what =
    m.outcome === "win"
      ? `${name(m.winnerAgentId)} wins`
      : m.outcome === "abandoned"
        ? `abandoned by ${name(m.abandonedBy)}`
        : m.outcome;
  const shape = m.turns === null ? "" : `${m.turns} turns, ${m.moves} moves`;
  return `${m.matchId}  ${m.endedAt.slice(0, 16)}  ${name(m.p1AgentId).padEnd(13)} v ${name(m.p2AgentId).padEnd(13)}  ${what.padEnd(26)} ${shape.padEnd(20)} ${credit(m.p1AgentId, m.p1Credits)}, ${credit(m.p2AgentId, m.p2Credits)}`;
}

// Day 1: every ordered pairing three times (36 matches, 18 per agent).
say("## Day 1 (2026-10-05): 36 matches, every ordered pairing x3");
let matchNo = 0;
for (let round = 0; round < 3; round++) {
  for (const p1 of agents) {
    for (const p2 of agents) {
      if (p1 === p2) continue;
      matchNo++;
      say(row(await play(matchNo, p1, p2, DAY1 + matchNo * 10 * MINUTES)));
    }
  }
}
say();

// Day 2: a short day, plus a cancel and an abandon (both pay nothing).
say("## Day 2 (2026-10-06): 4 matches, then a cancel and an abandon");
for (let i = 0; i < 4; i++) {
  matchNo++;
  say(row(await play(matchNo, agents[i]!, agents[(i + 1) % 4]!, DAY2 + i * 10 * MINUTES)));
}
clock = new Date(DAY2 + 50 * MINUTES);
say(row(store.recordMatch({ matchId: "s0-cancel-1", seed: 0, p1AgentId: agents[0]!.agentId, p2AgentId: agents[2]!.agentId, outcome: { kind: "cancelled" } })));
clock = new Date(DAY2 + 60 * MINUTES);
say(
  row(
    store.recordMatch({
      matchId: "s0-abandon-1",
      seed: 0,
      p1AgentId: agents[1]!.agentId,
      p2AgentId: agents[3]!.agentId,
      outcome: { kind: "abandoned", byAgentId: agents[3]!.agentId },
      turns: 6,
      moves: 41,
    }),
  ),
);
say();

// Refusals: the same match twice, and a raw ledger rewrite.
say("## Refusals");
try {
  store.recordMatch({ matchId: "s0-m001", seed: 2801, p1AgentId: agents[0]!.agentId, p2AgentId: agents[1]!.agentId, outcome: { kind: "win", winnerAgentId: agents[0]!.agentId } });
  say("recording s0-m001 again: ACCEPTED (bug)");
} catch (e) {
  say(`recording s0-m001 again: refused (${(e as Error).message})`);
}
try {
  store.unsafeExec("UPDATE ledger SET delta = delta * 10");
  say("raw UPDATE on ledger: ACCEPTED (bug)");
} catch (e) {
  say(`raw UPDATE on ledger: refused (${(e as Error).message})`);
}
say();

// ---- balances, then the owner spends ----
function balances(title: string) {
  say(`## ${title}`);
  for (const a of agents) {
    const history = store.matchHistory(a.agentId);
    const wins = history.filter((m) => m.winnerAgentId === a.agentId).length;
    const losses = history.filter((m) => m.outcome === "win" && m.winnerAgentId !== a.agentId).length;
    const voided = history.filter((m) => m.outcome === "cancelled" || m.outcome === "abandoned").length;
    say(
      `${a.name.padEnd(13)} ${String(store.balance(a.agentId)).padStart(4)} credits   ${wins}W ${losses}L ${voided} void   ` +
        `${store.ledger(a.agentId).length} ledger entries   ${store.unopenedPacks(a.agentId).length} unopened packs`,
    );
  }
  say();
}
balances("Balances after day 2 (derived from the ledger)");

say("## Owner buys packs (100 credits each) until each agent can't afford another");
clock = new Date(DAY2 + 120 * MINUTES);
for (const a of agents) {
  let bought = 0;
  for (;;) {
    try {
      store.buyPack(a.agentId, "S0");
      bought++;
    } catch (e) {
      if (!(e instanceof EconomyError)) throw e;
      say(`${a.name.padEnd(13)} bought ${bought}; next refused: ${e.message} (balance ${store.balance(a.agentId)})`);
      break;
    }
  }
}
say();
store.close();

// ---- reopen the file and check the ledger is the source of truth ----
store = openStore();
balances("After closing and reopening the database file");
say("## Ledger for house-cortex (first 8 and last 4 entries)");
const cortexLedger = store.ledger(agents[0]!.agentId);
for (const e of [...cortexLedger.slice(0, 8), { skip: true } as const, ...cortexLedger.slice(-4)]) {
  if ("skip" in e) {
    say(`  ... ${cortexLedger.length - 12} more`);
    continue;
  }
  say(`  #${String(e.entryId).padStart(3)} ${e.createdAt.slice(0, 16)} ${String(e.delta).padStart(5)} ${e.currency.padEnd(8)} ${e.reason.padEnd(13)} ${e.ref ?? ""}`);
}
const replay = cortexLedger.reduce((n, e) => n + e.delta, 0);
say(`  sum of entries = ${replay}; balance() = ${store.balance(agents[0]!.agentId)}`);
store.close();

if (tempDir) rmSync(tempDir, { recursive: true, force: true });
console.log(out.join("\n"));
