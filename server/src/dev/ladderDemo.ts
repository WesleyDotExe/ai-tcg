// Evidence for match running and the ladder (Season 0 game item 1; roadmap
// 6b), session 66.
//
//   npx tsx src/dev/ladderDemo.ts > ../progress/ladder-demo-001.txt
//
// A real season database file and eight house owners, two per starting
// faction, each with its starter collection and one agent in its own play
// style; every owner leaves the deck to its agent. The ladder runs three
// Sydney days of rounds. Each round it rebuilds any agent deck the store
// says needs it, pairs the queue by Glicko-2 rating, and plays and records
// every pair (startMatch -> runMatch -> recordMatch with final health), so
// the store pays credits on the daily win schedule and moves both ratings.
// Between rounds each house owner spends what it has earned on packs (the
// DEMO's house policy, see notes-for-owner.md), which changes its holdings,
// so the next round rebuilds its agent's deck: the whole loop, play -> earn
// -> open packs -> rebuild -> play. Halfway, the ladder and the store are
// closed and reopened on the same file (a server restart). On the last day
// one agent's process breaks mid-match: the match is recorded as abandoned
// by that side (no credits for either, a rating loss for the side that
// walked out). Then the standings, and checks of the run against the
// store: credits against the ledger, ratings replayed from the per-match
// rows, no owner meeting itself, every match log on disk.
//
// Seeds and the clock are fixed and ids are replaced by names, so the
// output is the same every run.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LookaheadAgent, PLAY_STYLES, type DeckFaction, type PlayStyleId } from "@ai-tcg/engine";
import { CLOSE_WIN_HEALTH, EconomyStore, PACK_PRICE_CREDITS, STARTER_BOASTS, PLACEMENT_MATCHES, rateMatch, RATING_START, winProbability, type Glicko2Rating } from "@ai-tcg/economy";
import { Ladder, type AgentSeater, type LadderMatch, type RoundReport } from "../ladder/ladderRunner.js";

const tempDir = mkdtempSync(join(tmpdir(), "ladder-demo-"));
const dbFile = join(tempDir, "season-0.db");
const logDir = join(tempDir, "match-logs");
// 09:00 on Mon 2 Nov in Sydney (AEDT, +11).
let clock = new Date("2026-11-01T22:00:00.000Z");
let store = EconomyStore.open(dbFile, { now: () => clock });
const say = (line = "") => console.log(line);
const sydney = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const BUILD = { games: 4, trials: 8, confirmGames: 8 };
const ROUNDS_PER_DAY = 6;
const DAYS = 3;
const MINUTES_PER_MATCH = 7;

const CAST: { name: string; agent: string; faction: DeckFaction; style: PlayStyleId }[] = [
  { name: "House Cortex A", agent: "Lattice Warden", faction: "Cortex", style: "calculator" },
  { name: "House Cortex B", agent: "Quiet Theorem", faction: "Cortex", style: "controller" },
  { name: "House Swarm A", agent: "Hive Courier", faction: "Swarm", style: "rusher" },
  { name: "House Swarm B", agent: "Brood Cartographer", faction: "Swarm", style: "tempo" },
  { name: "House Aegis A", agent: "Chrome Bastion", faction: "Aegis", style: "fortress" },
  { name: "House Aegis B", agent: "Mirror Sentry", faction: "Aegis", style: "calculator" },
  { name: "House Null A", agent: "Static Widow", faction: "Null", style: "gambler" },
  { name: "House Null B", agent: "Dead Channel", faction: "Null", style: "tempo" },
];

const NEXT: Record<DeckFaction, DeckFaction> = { Cortex: "Swarm", Swarm: "Aegis", Aegis: "Null", Null: "Cortex" };
const ownerName = new Map<string, string>();
const agentOf = new Map<string, string>();
const short = (ownerId: string) => ownerName.get(ownerId) ?? ownerId;
const fmt = (r: Glicko2Rating) => `${r.rating.toFixed(0)}±${r.rd.toFixed(0)}`;

say("# Match running and the ladder (session 66; the house pack policy moved into the server, session 67)");
say();
say(`Eight house owners, two per faction; every deck is built by the owner's agent (search: ${JSON.stringify(BUILD)}).`);
say(`${DAYS} Sydney days x ${ROUNDS_PER_DAY} rounds; ${MINUTES_PER_MATCH} minutes of clock per match. Ratings start at ${fmt(RATING_START)}.`);
say();
say("## The cast");
say();
for (const c of CAST) {
  const owner = store.createOwner({ name: c.name, kind: "house" });
  const grant = store.grantStarterCollection(owner.ownerId, c.faction);
  const agent = store.createAgent({ ownerId: owner.ownerId, name: c.agent });
  store.setPlayStyle(owner.ownerId, agent.agentId, c.style);
  store.connectAgent(owner.ownerId, agent.agentId);
  // Its close-win boast: the next faction's starter boast (every owner holds
  // all four), so a win on CLOSE_WIN_HEALTH or less shows the other one.
  store.setLoadout(owner.ownerId, agent.agentId, "closeWinBoast", STARTER_BOASTS[NEXT[c.faction]].itemId);
  ownerName.set(owner.ownerId, c.agent);
  agentOf.set(owner.ownerId, agent.agentId);
  say(`${c.agent.padEnd(19)} ${c.name.padEnd(15)} starter ${c.faction.padEnd(6)} ${PLAY_STYLES[c.style].name.padEnd(10)} ${grant.copies.length} starter copies, ${grant.packs.length} packs`);
}
say();

let packSeed = 66_000;

// ---- the run ----
let matchNo = 0;
let brokenSeat: string | null = null;
const seater: AgentSeater = {
  seat: (s) => {
    const agent = new LookaheadAgent(s.agentName, s.seed, { style: s.playStyle });
    if (s.ownerId !== brokenSeat) return agent;
    // The agent's process dies after its 20th move.
    let moves = 0;
    return {
      name: agent.name,
      decideMove: (view, legal) => {
        if (++moves > 20) throw new Error("connection to the agent's process lost");
        return agent.decideMove(view, legal);
      },
    };
  },
};
const advance = () => {
  clock = new Date(clock.getTime() + MINUTES_PER_MATCH * 60_000);
};
function ladder(): Ladder {
  return new Ladder({
    store,
    seater,
    seed: 6600 + matchNo,
    build: BUILD,
    matchId: () => `s0-${String(++matchNo).padStart(3, "0")}`,
    logDir,
    housePacks: { packSeed: () => ++packSeed },
    afterMatch: advance,
  });
}

const all: LadderMatch[] = [];
function printRound(day: number, round: number, r: RoundReport, startedAt: Date): void {
  say(`### Day ${day}, round ${round} (from ${sydney.format(startedAt)} Sydney)`);
  for (const h of r.housePacks) {
    say(`  ${short(h.ownerId).padEnd(19)} ${h.bought ? `bought ${h.bought}, ` : ""}opened ${h.opened} pack${h.opened === 1 ? "" : "s"}: ${h.cards} cards, ${h.newCards} new to the collection`);
  }
  for (const b of r.rebuilt) say(`  rebuilt ${short(b.ownerId)}'s deck: ${b.faction}, ${b.cards} cards (${b.reasons.join("; ")})`);
  for (const x of r.excluded) say(`  ${short(x.ownerId)} sits this round out: ${x.reason}`);
  if (r.sitOut.length) say(`  unpaired (odd queue): ${r.sitOut.map(short).join(", ")}`);
  for (const m of r.matches) {
    const rec = m.record;
    const [r1, r2] = [rec.ratings?.p1, rec.ratings?.p2];
    const result =
      rec.outcome === "win"
        ? `${short(rec.winnerOwnerId!)} wins`
        : rec.outcome === "abandoned"
          ? `abandoned by ${short(rec.abandonedByOwnerId!)}`
          : rec.outcome;
    const delta = (c: typeof r1) => (c ? `${fmt(c.before)} -> ${c.after.rating.toFixed(0)}` : "unrated");
    const p = r1 && r2 ? `p(p1)=${winProbability(r1.before, r2.before).toFixed(2)}` : "";
    const boast = rec.boast ? ` boast:${rec.boast.slot}` : "";
    const hp = rec.turns === null ? "" : ` T${String(rec.turns).padStart(2)}`;
    say(
      `  ${rec.matchId}${hp} ${short(rec.p1OwnerId)} [${delta(r1)}] vs ${short(rec.p2OwnerId)} [${delta(r2)}] ${p}: ${result}, +${rec.p1Credits}/+${rec.p2Credits}${boast}`,
    );
    if (m.note) say(`    note: ${m.note}`);
  }
  all.push(...r.matches);
}

function standings(title: string): void {
  say(`## ${title}`);
  say();
  say("rank  agent               faction rating  RD   tier       W-L-D   credits  today (Sydney day)");
  for (const row of store.ladder()) {
    const deck = store.getOwner(row.ownerId).activeDeckId;
    const faction = deck ? store.listDecks(row.ownerId).find((d) => d.deckId === deck)?.name : "-";
    const today = store.dailyEarnings(row.ownerId);
    say(
      `${String(row.rank ?? "-").padStart(4)}  ${row.agent!.name.padEnd(19)} ${String(builtFaction.get(row.ownerId) ?? faction).padEnd(7)} ${row.rating.toFixed(0).padStart(6)} ${row.rd
        .toFixed(0)
        .padStart(4)}  ${row.tier.padEnd(10)} ${`${row.wins}-${row.losses}-${row.draws}`.padEnd(7)} ${String(store.balance(row.ownerId)).padStart(7)}  ${today.wins.length} wins, ${today.losses} losses, +${today.credits}`,
    );
  }
  say();
}

const builtFaction = new Map<string, string>();
const track = (r: RoundReport) => {
  for (const b of r.rebuilt) builtFaction.set(b.ownerId, b.faction);
};

say("## The run");
say();
say("Round 1 starts with each house owner opening its 3 starter packs (the house policy).");
say();

let lad = ladder();
for (let day = 1; day <= DAYS; day++) {
  if (day > 1) {
    // The next morning, 09:00 Sydney.
    clock = new Date(Date.UTC(2026, 10, day, 22, 0));
    say(`[next day: ${sydney.format(clock)} Sydney]`);
    say();
  }
  for (let round = 1; round <= ROUNDS_PER_DAY; round++) {
    if (day === DAYS && round === ROUNDS_PER_DAY) brokenSeat = [...ownerName.keys()][3]!;
    const startedAt = clock;
    const r = await lad.runRound();
    track(r);
    printRound(day, round, r, startedAt);
    brokenSeat = null;
    say();
    if (day === 2 && round === 3) {
      say("[restart: the ladder and the store are closed and reopened on the same file]");
      store.close();
      store = EconomyStore.open(dbFile, { now: () => clock });
      lad = ladder();
      say();
    }
  }
  standings(`Standings after day ${day}`);
}

// ---- checks ----
say("## Checks against the store");
say();
const history = store.matchHistory();
const ok = (label: string, pass: boolean) => say(`${pass ? "PASS" : "FAIL"}  ${label}`);
ok(`${all.length} matches played, ${history.length} recorded`, all.length === history.length);
ok("no owner ever met itself", history.every((m) => m.p1OwnerId !== m.p2OwnerId));
const rated = history.filter((m) => m.ratings !== null).length;
const cancelled = history.filter((m) => m.outcome === "cancelled").length;
ok(`every match but cancels is rated (${rated} rated, ${cancelled} cancelled)`, rated + cancelled === history.length);
let creditsOk = true;
for (const o of store.listOwners()) {
  const fromMatches = history.reduce((s, m) => s + (m.p1OwnerId === o.ownerId ? m.p1Credits : m.p2OwnerId === o.ownerId ? m.p2Credits : 0), 0);
  const ledger = store.ledger(o.ownerId).filter((e) => e.reason === "matchWin" || e.reason === "matchLoss" || e.reason === "matchDraw");
  const fromLedger = ledger.reduce((s, e) => s + e.delta, 0);
  creditsOk &&= fromMatches === fromLedger && fromLedger > 0;
  if (fromMatches !== fromLedger) ok(`${short(o.ownerId)}: match credits ${fromMatches} = ledger ${fromLedger}`, false);
}
ok("each owner's match credits equal its ledger's match payouts", creditsOk);
const abandoned = history.filter((m) => m.outcome === "abandoned");
ok(`the abandoned match (${abandoned.length}) paid nothing to either side`, abandoned.length === 1 && abandoned.every((m) => m.p1Credits + m.p2Credits === 0));
// Replay every rating from the start, match by match, from the recorded
// results alone (idle growth doesn't apply: every owner plays every day).
const replay = new Map<string, Glicko2Rating>();
let replayOk = true;
for (const m of history) {
  if (m.ratings === null) continue;
  const a = replay.get(m.p1OwnerId) ?? { ...RATING_START };
  const b = replay.get(m.p2OwnerId) ?? { ...RATING_START };
  const next = rateMatch(a, b, m.ratings.p1.score);
  replayOk &&= Math.abs(next.a.rating - m.ratings.p1.after.rating) < 1e-9 && Math.abs(next.b.rd - m.ratings.p2.after.rd) < 1e-9;
  replay.set(m.p1OwnerId, next.a);
  replay.set(m.p2OwnerId, next.b);
}
ok("ratings replayed from the results alone match every stored after-rating", replayOk);
ok("every owner's stored rating is its last replayed one", store.listOwners().every((o) => Math.abs(store.rating(o.ownerId).rating - replay.get(o.ownerId)!.rating) < 1e-9));
const logs = all.filter((m) => m.logPath !== null);
ok(`a match log on disk for every played match (${logs.length})`, logs.length === all.filter((m) => m.record.turns !== null).length && logs.every((m) => existsSync(m.logPath!)));
ok(`everyone placed (${PLACEMENT_MATCHES}+ rated matches)`, store.ladder().every((r) => r.rank !== null));
ok("no one is in a live match at the end", store.liveMatches().length === 0);
say();

say("## The run in numbers");
say();
const wins = new Map<string, { w: number; n: number }>();
for (const m of history) {
  if (m.outcome !== "win") continue;
  for (const side of ["p1", "p2"] as const) {
    const owner = side === "p1" ? m.p1OwnerId : m.p2OwnerId;
    const f = builtFaction.get(owner) ?? "?";
    const t = wins.get(f) ?? { w: 0, n: 0 };
    t.n++;
    if (m.winnerOwnerId === owner) t.w++;
    wins.set(f, t);
  }
}
const turns = history.filter((m) => m.turns !== null).map((m) => m.turns!);
say(`matches: ${history.length}; turns: median ${[...turns].sort((a, b) => a - b)[Math.floor(turns.length / 2)]}, range ${Math.min(...turns)}-${Math.max(...turns)}`);
say(`first seat won ${history.filter((m) => m.outcome === "win" && m.winnerOwnerId === m.p1OwnerId).length} of ${history.filter((m) => m.outcome === "win").length} decided`);
say(`close wins (winner on ${CLOSE_WIN_HEALTH} health or less): ${history.filter((m) => m.boast?.winnerHealth != null && m.boast.winnerHealth <= CLOSE_WIN_HEALTH).length}`);
say(`close-win boasts: ${history.filter((m) => m.boast?.slot === "closeWinBoast").length}; main boasts: ${history.filter((m) => m.boast?.slot === "boast").length}; faction starter: ${history.filter((m) => m.boast?.slot === "factionStarter").length}`);
say(`win rate by the faction each side's agent built (a small sample, not a balance measure): ${[...wins].map(([f, t]) => `${f} ${t.w}/${t.n}`).join(", ")}`);
const pairs = new Map<string, number>();
for (const m of history) {
  const k = [short(m.p1OwnerId), short(m.p2OwnerId)].sort().join(" v ");
  pairs.set(k, (pairs.get(k) ?? 0) + 1);
}
say(`distinct pairings: ${pairs.size} of 28 possible; most played: ${[...pairs].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} x${v}`).join(", ")}`);
const back = history.filter((m, i) => {
  const prev = history.slice(0, i).reverse();
  const last = (o: string) => prev.find((x) => x.p1OwnerId === o || x.p2OwnerId === o);
  const l = last(m.p1OwnerId);
  return l !== undefined && (l.p1OwnerId === m.p2OwnerId || l.p2OwnerId === m.p2OwnerId);
}).length;
say(`immediate rematches (both sides' previous match was against each other): ${back}`);
say(`one match's log, as written for replays: ${all[0]!.record.matchId}.txt, ${all[0]!.logPath ? "on disk" : "missing"}`);

store.close();
rmSync(tempDir, { recursive: true, force: true });
