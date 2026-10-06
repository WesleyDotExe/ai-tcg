// Economy evidence: real engine matches, paid and recorded in a real database
// file, read back after the file is closed and reopened.
//
//   npm run demo -w @ai-tcg/economy [-- <db path>]
//
// Session 29 (schema v2): the OWNER owns everything. Four house owners, one
// per faction, each get the once-per-owner starter collection (the shipped
// faction deck as account-bound copies, plus 3 packs) and connect one agent,
// which plays from a deck saved from the owner's copies. Day 1 is a heavy
// round robin, so the strongest owners run past the 10-win daily cap; after
// round 1 the Cortex owner switches to a second agent, and the cap carries on
// from where the first agent left it. Day 2 is a short day plus a cancelled
// and an abandoned match. Then the exploit checks (self-play, a second
// starter), a salvage that takes the extra pack copy and leaves the bound
// starter copies alone, and the owners buy packs until each balance runs
// short. Output is committed as progress/economy-demo-002.txt (session 28's
// per-agent run is economy-demo-001.txt).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCard, LookaheadAgent, runMatch, SHIPPED_DECK_LISTS, type DeckFaction } from "@ai-tcg/engine";
import { EconomyError, EconomyStore, type AgentRecord, type MatchRecord, type OwnerRecord } from "../index.js";

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
say(`# Economy demo (session 29): the owner owns everything`);
say(`database: <temp>/season-0.db  schema v${store.schemaVersion}  season ${store.season}`);
say();

// ---- owners, starter collections, agents, decks ----
interface Seat {
  owner: OwnerRecord;
  agent: AgentRecord;
  deckId: string;
}
const seats: Seat[] = [];
const agents: AgentRecord[] = [];
for (const faction of FACTIONS) {
  const owner = store.createOwner({ name: `house-${faction.toLowerCase()}`, kind: "house" });
  const starter = store.grantStarterCollection(owner.ownerId, faction);
  const agent = store.createAgent({ ownerId: owner.ownerId, name: `${faction.toLowerCase()}-a` });
  const deck = store.saveDeck(owner.ownerId, `${faction} starter`, starter.copies.map((c) => c.copyId));
  store.setActiveDeck(owner.ownerId, deck.deckId);
  seats.push({ owner, agent, deckId: deck.deckId });
  agents.push(agent);
  const bound = starter.copies.filter((c) => c.accountBound).length;
  say(
    `owner ${owner.name.padEnd(13)} starter: ${starter.copies.length} copies (${bound} account-bound), ${starter.packs.length} packs; ` +
      `agent ${agent.name} connected; deck "${deck.name}" (${deck.spec.cards.length} cards) active`,
  );
}
say();

const ownerName = (id: string | null) => seats.find((x) => x.owner.ownerId === id)?.owner.name ?? "-";
const name = (id: string | null) => agents.find((a) => a.agentId === id)?.name ?? "-";

// ---- play and record ----
async function play(matchNo: number, s1: Seat, s2: Seat, endedAt: number): Promise<MatchRecord> {
  const [p1, p2] = [s1.agent, s2.agent];
  const deck1 = store.loadDeck(s1.deckId);
  const deck2 = store.loadDeck(s2.deckId);
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
  const credit = (ownerId: string, c: number) => `${ownerName(ownerId)} +${c}`;
  const what =
    m.outcome === "win"
      ? `${name(m.winnerAgentId)} wins`
      : m.outcome === "abandoned"
        ? `abandoned by ${ownerName(m.abandonedByOwnerId)}`
        : m.outcome;
  const shape = m.turns === null ? "" : `${m.turns} turns, ${m.moves} moves`;
  return `${m.matchId}  ${m.endedAt.slice(0, 16)}  ${name(m.p1AgentId).padEnd(9)} v ${name(m.p2AgentId).padEnd(9)}  ${what.padEnd(24)} ${shape.padEnd(20)} ${credit(m.p1OwnerId, m.p1Credits)}, ${credit(m.p2OwnerId, m.p2Credits)}`;
}

// Day 1: every ordered pairing three times (36 matches, 18 per owner).
say("## Day 1 (2026-10-05): 36 matches, every ordered pairing x3");
let matchNo = 0;
for (let round = 0; round < 3; round++) {
  if (round === 1) {
    // The Cortex owner switches agents mid-day. Only the agent changes: the
    // collection, deck, wallet and today's caps all stay with the owner.
    const cortex = seats[0]!;
    const before = store.dailyTally(cortex.owner.ownerId, new Date(DAY1 + (matchNo + 1) * 10 * MINUTES).toISOString());
    cortex.agent = store.createAgent({ ownerId: cortex.owner.ownerId, name: "cortex-b" });
    agents.push(cortex.agent);
    say(
      `-- ${cortex.owner.name} switches to agent cortex-b (the owner's tally so far today: ${before.winsToday}W ${before.lossesToday}L; ` +
        `cortex-b's matches count on from there, not from zero)`,
    );
  }
  for (const s1 of seats) {
    for (const s2 of seats) {
      if (s1 === s2) continue;
      matchNo++;
      say(row(await play(matchNo, s1, s2, DAY1 + matchNo * 10 * MINUTES)));
    }
  }
}
say();

// Day 2: a short day, plus a cancel and an abandon (both pay nothing).
say("## Day 2 (2026-10-06): 4 matches, then a cancel and an abandon");
for (let i = 0; i < 4; i++) {
  matchNo++;
  say(row(await play(matchNo, seats[i]!, seats[(i + 1) % 4]!, DAY2 + i * 10 * MINUTES)));
}
clock = new Date(DAY2 + 50 * MINUTES);
say(
  row(
    store.recordMatch({
      matchId: "s0-cancel-1",
      seed: 0,
      p1AgentId: seats[0]!.agent.agentId,
      p2AgentId: seats[2]!.agent.agentId,
      outcome: { kind: "cancelled" },
    }),
  ),
);
clock = new Date(DAY2 + 60 * MINUTES);
say(
  row(
    store.recordMatch({
      matchId: "s0-abandon-1",
      seed: 0,
      p1AgentId: seats[1]!.agent.agentId,
      p2AgentId: seats[3]!.agent.agentId,
      outcome: { kind: "abandoned", byAgentId: seats[3]!.agent.agentId },
      turns: 6,
      moves: 41,
    }),
  ),
);
say();

// Refusals: the same match twice, a raw ledger rewrite, and the owner-level
// exploit checks.
say("## Refusals");
function attempt(what: string, fn: () => unknown) {
  try {
    fn();
    say(`${what}: ACCEPTED (bug)`);
  } catch (e) {
    say(`${what}: refused (${(e as Error).message})`);
  }
}
const [cortexA, cortexB] = store.listAgents(seats[0]!.owner.ownerId);
attempt("recording s0-m001 again", () =>
  store.recordMatch({
    matchId: "s0-m001",
    seed: 2801,
    p1AgentId: cortexA!.agentId,
    p2AgentId: seats[1]!.agent.agentId,
    outcome: { kind: "win", winnerAgentId: cortexA!.agentId },
  }),
);
attempt("raw UPDATE on ledger", () => store.unsafeExec("UPDATE ledger SET delta = delta * 10"));
attempt("house-cortex's own agents playing each other (cortex-a v cortex-b)", () =>
  store.recordMatch({ matchId: "s0-self", seed: 1, p1AgentId: cortexA!.agentId, p2AgentId: cortexB!.agentId, outcome: { kind: "win", winnerAgentId: cortexA!.agentId } }),
);
attempt("a second starter collection for house-swarm (Null this time)", () => store.grantStarterCollection(seats[1]!.owner.ownerId, "Null"));
say();

// ---- balances, then the owners spend ----
function balances(title: string) {
  say(`## ${title}`);
  for (const { owner } of seats) {
    const st = store.ownerStats(owner.ownerId);
    say(
      `${owner.name.padEnd(13)} ${String(store.balance(owner.ownerId)).padStart(4)} credits ${String(store.balance(owner.ownerId, "packPoints")).padStart(3)} pack pts   ` +
        `${st.wins}W ${st.losses}L ${st.void} void  best streak ${st.bestWinStreak}   ` +
        `${store.ledger(owner.ownerId).length} ledger entries   ${store.unopenedPacks(owner.ownerId).length} unopened packs`,
    );
  }
  say();
}
balances("Balances after day 2 (derived from the ledger)");

say("## house-cortex stats by agent (the Stats page filter)");
for (const a of store.listAgents(seats[0]!.owner.ownerId)) {
  const st = store.ownerStats(seats[0]!.owner.ownerId, { agentId: a.agentId });
  const paid = store
    .ledger(seats[0]!.owner.ownerId)
    .filter((e) => e.playedBy === a.agentId)
    .reduce((n, e) => n + e.delta, 0);
  say(
    `${a.name.padEnd(9)} ${st.matches} matches, ${st.wins}W ${st.losses}L ${st.void} void, win rate ${(st.winRate * 100).toFixed(1)}%, ` +
      `${paid} credits earned for the owner`,
  );
}
say();

say("## Salvage: house-aegis holds 3 bound starter copies of a Common and pulls a 4th from a pack");
clock = new Date(DAY2 + 90 * MINUTES);
const aegis = seats[2]!.owner;
const common = SHIPPED_DECK_LISTS.Aegis.find((e) => e.copies === 3 && getCard(e.cardId)?.rarity === "Common")!.cardId;
// Pack opening is the next session; the pulled copy is granted by hand here.
const pulled = store.grantCopy({ ownerId: aegis.ownerId, cardId: common, origin: "pack", originRef: "hand-granted pull" });
const describeCopies = () =>
  store
    .collection(aegis.ownerId)
    .filter((c) => c.cardId === common)
    .map((c) => `${c.origin}${c.accountBound ? " (bound)" : ""}`)
    .join(", ");
say(`before: ${getCard(common)!.name} x4 = ${describeCopies()}`);
const salvage = store.salvageExtras(aegis.ownerId);
say(
  `salvaged ${salvage.copies.length} copy (${salvage.copies.map((c) => (c.copyId === pulled.copyId ? "the pack copy" : "a DIFFERENT copy (bug)")).join(", ")}) ` +
    `for ${salvage.packPoints} pack points`,
);
say(`after:  ${getCard(common)!.name} x3 = ${describeCopies()}; a second salvage finds ${store.salvageableCopies(aegis.ownerId).length} more`);
say();

say("## Each owner buys packs (100 credits each) until it can't afford another");
clock = new Date(DAY2 + 120 * MINUTES);
for (const { owner } of seats) {
  let bought = 0;
  for (;;) {
    try {
      store.buyPack(owner.ownerId, "S0");
      bought++;
    } catch (e) {
      if (!(e instanceof EconomyError)) throw e;
      say(`${owner.name.padEnd(13)} bought ${bought}; next refused: ${e.message} (balance ${store.balance(owner.ownerId)})`);
      break;
    }
  }
}
say();
store.close();

// ---- reopen the file and check the ledger is the source of truth ----
store = openStore();
balances("After closing and reopening the database file");
say("## Ledger for house-cortex (first 8 and last 4 entries; played-by names the agent)");
const cortexLedger = store.ledger(seats[0]!.owner.ownerId);
for (const e of [...cortexLedger.slice(0, 8), { skip: true } as const, ...cortexLedger.slice(-4)]) {
  if ("skip" in e) {
    say(`  ... ${cortexLedger.length - 12} more`);
    continue;
  }
  say(
    `  #${String(e.entryId).padStart(3)} ${e.createdAt.slice(0, 16)} ${String(e.delta).padStart(5)} ${e.currency.padEnd(8)} ${e.reason.padEnd(13)} ` +
      `${(e.playedBy === null ? "(owner)" : name(e.playedBy)).padEnd(9)} ${e.ref ?? ""}`,
  );
}
const replay = cortexLedger.reduce((n, e) => n + e.delta, 0);
say(`  sum of entries = ${replay}; balance() = ${store.balance(seats[0]!.owner.ownerId)}`);
store.close();

if (tempDir) rmSync(tempDir, { recursive: true, force: true });
console.log(out.join("\n"));
