// Economy evidence: real engine matches, paid and recorded in a real database
// file, read back after the file is closed and reopened.
//
//   npm run demo -w @ai-tcg/economy [-- <db path>]
//
// Session 30 (schema v3): owner accounts and agents. Season 0 sign-in for a
// player account and the admin; four house owners, one per faction, each get
// the once-per-owner starter collection (the shipped faction deck as
// account-bound copies, plus 3 packs) and CONNECT one agent. Every match is
// started with startMatch (each owner's connected agent and active deck) and
// closed by recordMatch. Day 1 is a heavy round robin, so the strongest
// owners run past the 10-win daily cap; at round 1 the Cortex owner tries to
// switch agents mid-match (refused), then switches after it, and the cap
// carries on from where the first agent left it. Day 2 is a short day plus a
// cancelled and an abandoned match. Then the exploit checks, the manual
// salvage (owner 2026-10-07: the owner picks card and quantity; a deck-short
// salvage warns, then marks decks incomplete), the faction lock, the owners
// buying packs, and the admin's house-owner view. Output is committed as
// progress/economy-demo-003.txt (session 29's run is economy-demo-002.txt,
// session 28's economy-demo-001.txt).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCard, LookaheadAgent, runMatch, SHIPPED_DECK_LISTS, type DeckFaction } from "@ai-tcg/engine";
import {
  EconomyError,
  EconomyStore,
  SalvageNeedsConfirmation,
  SIGN_IN_LOCKOUT,
  type AgentRecord,
  type MatchRecord,
  type OwnerRecord,
} from "../index.js";

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
say(`# Economy demo (session 30): owner accounts, connected agents, manual salvage`);
say(`database: <temp>/season-0.db  schema v${store.schemaVersion}  season ${store.season}`);
say();

// ---- Season 0 sign-in ----
say("## Season 0 sign-in");
const ADA_PW = "a long sample passphrase";
const admin = store.createAccount({ name: "Season admin", username: "admin", password: "admin sample passphrase", isAdmin: true });
const adaOwner = store.createAccount({ name: "Ada", username: "ada", email: "ada@example.test", password: ADA_PW });
say(`accounts: "${admin.name}" (admin), "${adaOwner.name}" (player)`);
function attemptEarly(what: string, fn: () => unknown) {
  try {
    const r = fn();
    say(`${what}: ok${typeof r === "string" ? ` (${r})` : ""}`);
  } catch (e) {
    say(`${what}: refused (${(e as Error).message})`);
  }
}
attemptEarly("a second account named ADA", () => store.createAccount({ name: "x", username: "ADA", password: ADA_PW }));
attemptEarly("an account with an 8-character password", () => store.createAccount({ name: "x", username: "xyz", password: "12345678" }));
const session = store.signIn("Ada@Example.test", ADA_PW);
attemptEarly("ada signs in by email (any case)", () => `owner ${store.authenticate(session.token).ownerId === adaOwner.ownerId ? "Ada" : "WRONG (bug)"}, session until ${session.expiresAt.slice(0, 10)}`);
attemptEarly("a sign-in with the wrong password", () => store.signIn("ada", "not the passphrase"));
attemptEarly("a sign-in for a login that doesn't exist", () => store.signIn("nobody", ADA_PW));
for (let i = 1; i < SIGN_IN_LOCKOUT.failures; i++) {
  try {
    store.signIn(i % 2 ? "ada" : "ada@example.test", `guess ${i}`);
  } catch {
    // counted
  }
}
attemptEarly(`ada with the RIGHT password after ${SIGN_IN_LOCKOUT.failures} failures`, () => store.signIn("ada", ADA_PW));
clock = new Date(clock.getTime() + (SIGN_IN_LOCKOUT.windowMinutes + 1) * MINUTES);
attemptEarly(`ada again ${SIGN_IN_LOCKOUT.windowMinutes + 1} minutes later`, () => (store.signIn("ada", ADA_PW), "signed in"));
store.signOut(session.token);
attemptEarly("using the signed-out session", () => store.authenticate(session.token));
attemptEarly("the admin signs in", () => (store.authenticate(store.signIn("admin", "admin sample passphrase").token).isAdmin ? "admin view shown" : "no admin (bug)"));
say();
clock = new Date(DAY1 - 30 * MINUTES);

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
  store.connectAgent(owner.ownerId, agent.agentId);
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
// Each match goes live with startMatch (the owners' connected agents and
// active decks, loaded from the copies held now) and ends with recordMatch.
async function play(matchNo: number, s1: Seat, s2: Seat, endedAt: number, duringLive?: () => void): Promise<MatchRecord> {
  const matchId = `s0-m${String(matchNo).padStart(3, "0")}`;
  const live = store.startMatch({ matchId, p1OwnerId: s1.owner.ownerId, p2OwnerId: s2.owner.ownerId });
  const [p1, p2] = [s1.agent, s2.agent];
  if (live.p1.agentId !== p1.agentId || live.p2.agentId !== p2.agentId) throw new Error("live match picked the wrong agents (bug)");
  const deck1 = live.p1.deck;
  const deck2 = live.p2.deck;
  duringLive?.();
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
    matchId,
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
  const cortex = seats[0]!;
  let switchTried = false;
  for (const s1 of seats) {
    for (const s2 of seats) {
      if (s1 === s2) continue;
      matchNo++;
      // At round 1 the Cortex owner tries to switch agents while its match
      // is live (refused), then switches once it's recorded.
      const tryMidMatch =
        round === 1 && !switchTried && s1 === cortex
          ? () => {
              switchTried = true;
              const next = store.createAgent({ ownerId: cortex.owner.ownerId, name: "cortex-b" });
              agents.push(next);
              try {
                store.connectAgent(cortex.owner.ownerId, next.agentId);
                say(`-- ${cortex.owner.name} switched to cortex-b mid-match: ACCEPTED (bug)`);
              } catch (e) {
                say(`-- ${cortex.owner.name} tries to connect cortex-b during the live match: refused (${(e as Error).message})`);
              }
            }
          : undefined;
      say(row(await play(matchNo, s1, s2, DAY1 + matchNo * 10 * MINUTES, tryMidMatch)));
      if (tryMidMatch) {
        // Only the agent changes: the collection, deck, wallet and today's
        // caps all stay with the owner.
        const before = store.dailyTally(cortex.owner.ownerId, new Date(DAY1 + matchNo * 10 * MINUTES).toISOString());
        const next = agents.find((a) => a.name === "cortex-b")!;
        store.connectAgent(cortex.owner.ownerId, next.agentId);
        cortex.agent = next;
        say(
          `-- match recorded; ${cortex.owner.name} connects cortex-b (the owner's tally so far today: ${before.winsToday}W ${before.lossesToday}L; ` +
            `cortex-b's matches count on from there, not from zero)`,
        );
      }
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
store.startMatch({ matchId: "s0-cancel-1", p1OwnerId: seats[0]!.owner.ownerId, p2OwnerId: seats[2]!.owner.ownerId });
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
store.startMatch({ matchId: "s0-abandon-1", p1OwnerId: seats[1]!.owner.ownerId, p2OwnerId: seats[3]!.owner.ownerId });
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
attempt("house-cortex connecting house-swarm's agent", () => store.connectAgent(seats[0]!.owner.ownerId, seats[1]!.agent.agentId));
attempt("starting a match with house-cortex on both sides", () =>
  store.startMatch({ matchId: "s0-self-2", p1OwnerId: seats[0]!.owner.ownerId, p2OwnerId: seats[0]!.owner.ownerId }),
);
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

say("## Salvage is manual: house-aegis holds 3 bound starter copies of a Common, then pulls more");
clock = new Date(DAY2 + 90 * MINUTES);
const aegis = seats[2]!.owner;
const common = SHIPPED_DECK_LISTS.Aegis.find((e) => e.copies === 3 && getCard(e.cardId)?.rarity === "Common")!.cardId;
// Pack opening is a later session; the pulled copies are granted by hand.
store.grantCopy({ ownerId: aegis.ownerId, cardId: common, origin: "pack", originRef: "hand-granted pull" });
store.grantCopy({ ownerId: aegis.ownerId, cardId: common, origin: "pack", originRef: "hand-granted pull" });
store.grantCopy({ ownerId: aegis.ownerId, cardId: common, origin: "pack", finish: "foil", originRef: "hand-granted pull" });
function viewer(ownerId: string, cardId: string) {
  const h = store.cardHoldings(ownerId, cardId);
  say(`card viewer: ${getCard(cardId)!.name} (${h.rarity}) x${h.owned} owned, ${h.salvageable} salvageable at ${h.packPointsEach} pack pts each`);
  for (const r of h.notSalvageable) say(`  can't salvage ${r.count}: ${r.reason}`);
  for (const d of h.decks) say(`  used ${d.uses}x by deck "${d.name}"${d.active ? " (active)" : ""}`);
}
viewer(aegis.ownerId, common);
say(`nothing was salvaged on its own: pack points still ${store.balance(aegis.ownerId, "packPoints")}`);
const one = store.salvage(aegis.ownerId, common, 1);
say(`the owner salvages 1: ${one.copies.map((c) => c.origin + "/" + c.finish).join(", ")} for ${one.packPoints} pack points; decks affected: ${one.incompleteDecks.length}`);
attempt("salvaging 2 more (only 1 salvageable copy is left)", () => store.salvage(aegis.ownerId, common, 2));
viewer(aegis.ownerId, common);
say();

say("## Salvage below a saved deck: warned first, then the decks are incomplete (never edited)");
// A player account whose deck is made of pack copies, so salvaging can bite.
const ada = store.getOwner(store.authenticate(store.signIn("ada", ADA_PW).token).ownerId);
const nullList = SHIPPED_DECK_LISTS.Null;
const nullCopies = nullList.flatMap((e) =>
  Array.from({ length: e.copies }, () => store.grantCopy({ ownerId: ada.ownerId, cardId: e.cardId, origin: "pack", originRef: "hand-granted pull" }).copyId),
);
const adaMain = store.saveDeck(ada.ownerId, "Null main", nullCopies);
store.saveDeck(ada.ownerId, "Null copy", nullCopies);
store.setActiveDeck(ada.ownerId, adaMain.deckId);
const target = nullList.find((e) => e.copies >= 2)!.cardId;
viewer(ada.ownerId, target);
try {
  store.salvage(ada.ownerId, target, 2);
  say("salvage 2 without confirming: ACCEPTED (bug)");
} catch (e) {
  if (!(e instanceof SalvageNeedsConfirmation)) throw e;
  say(`salvage 2 without confirming: warned (${e.message})`);
}
say(`still held: ${store.cardHoldings(ada.ownerId, target).owned}; pack points ${store.balance(ada.ownerId, "packPoints")}`);
const confirmed = store.salvage(ada.ownerId, target, 2, { confirmDeckImpact: true });
say(`confirmed: salvaged ${confirmed.copies.length} for ${confirmed.packPoints} pack points`);
for (const d of store.listDecks(ada.ownerId)) {
  say(`  deck "${d.name}": ${d.cards} cards listed, ${d.complete ? "complete" : "INCOMPLETE"}${d.active ? " (active)" : ""} ${d.missing.map((m) => `- ${getCard(m.cardId)!.name}: uses ${m.uses}, holds ${m.owned}`).join("; ")}`);
}
attempt("loading the incomplete active deck to play", () => store.loadDeck(adaMain.deckId));
store.grantCopies([0, 1].map(() => ({ ownerId: ada.ownerId, cardId: target, origin: "pack" as const, originRef: "hand-granted pull" })));
say(`two more pulled: decks complete again? ${store.listDecks(ada.ownerId).map((d) => `"${d.name}" ${d.complete}`).join(", ")} (any held copy fills a slot; copies are shared across decks)`);
say();

say("## Faction lock (Settings -> Play): applies to whichever agent is connected");
const swarmOwner = seats[1]!.owner;
say(`house-swarm locks to Null: active deck fits? ${store.setFactionLock(swarmOwner.ownerId, "Null").activeDeckFits}`);
attempt("starting house-swarm v house-null under that lock", () =>
  store.startMatch({ matchId: "s0-lock-1", p1OwnerId: swarmOwner.ownerId, p2OwnerId: seats[3]!.owner.ownerId }),
);
say(`house-swarm locks to Swarm: active deck fits? ${store.setFactionLock(swarmOwner.ownerId, "Swarm").activeDeckFits}; lock cleared`);
store.setFactionLock(swarmOwner.ownerId, null);
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
      `${(e.playedBy === null ? "(owner)" : name(e.playedBy)).padEnd(9)} ${e.reason === "packPurchase" ? "<pack id>" : (e.ref ?? "")}`,
  );
}
const replay = cortexLedger.reduce((n, e) => n + e.delta, 0);
say(`  sum of entries = ${replay}; balance() = ${store.balance(seats[0]!.owner.ownerId)}`);
say();

say("## Admin -> House agents (the admin view's data)");
for (const r of store.houseRoster()) {
  say(
    `${r.owner.name.padEnd(13)} agents ${r.agents.map((a) => a.name).join(", ").padEnd(17)} connected ${(r.connectedAgent?.name ?? "-").padEnd(9)} ` +
      `${String(r.credits).padStart(4)} cr ${String(r.packPoints).padStart(3)} pp  ${r.copies} copies  ${r.unopenedPacks} packs  ` +
      `${r.stats.wins}W ${r.stats.losses}L  ${r.inLiveMatch ? "LIVE" : "idle"}`,
  );
}
store.close();

if (tempDir) rmSync(tempDir, { recursive: true, force: true });
console.log(out.join("\n"));
