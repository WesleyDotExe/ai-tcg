import { EconomyStore } from "@ai-tcg/economy";
import { workerChooser } from "./deckBuild/workerChooser.js";
import { Ladder } from "./ladder/ladderRunner.js";

// Thin argv wrapper around the ladder: runs rounds of ranked matches between
// every owner with a connected agent in one season's database file
// (Season 0: the house agents), rebuilding agent decks on worker threads at
// the store's full search, and prints one line per match.
//   npm run ladder -- <database file> [rounds] [match log directory]
// Rounds default to 1. House owners are queued always, player owners while
// their auto-play is on (session 67), and the house owners spend their
// credits on packs before each round. Matches here count at once; the
// watch-speed ladder with Watch live is `npm run season`.
const DB_PATH = process.argv[2];
if (!DB_PATH) {
  console.error("usage: npm run ladder -- <database file> [rounds] [match log directory]");
  process.exit(1);
}
const ROUNDS = Number(process.argv[3] ?? 1);
if (!Number.isInteger(ROUNDS) || ROUNDS < 1) {
  console.error(`rounds must be a whole number of at least 1 (got ${process.argv[3]})`);
  process.exit(1);
}
const store = EconomyStore.open(DB_PATH);
const chooser = workerChooser();
const name = (ownerId: string) => store.getOwner(ownerId).name;
const ladder = new Ladder({
  store,
  chooser: chooser.choose,
  logDir: process.argv[4],
  onEvent: (e) => {
    if (e.kind === "housePacks") console.log(`[ladder] ${name(e.ownerId)} bought ${e.bought}, opened ${e.opened} packs (${e.newCards} new cards)`);
    if (e.kind === "rebuilt") console.log(`[ladder] rebuilt ${name(e.ownerId)}'s deck: ${e.faction}, ${e.cards} cards (${e.reasons.join("; ")})`);
    if (e.kind === "excluded") console.log(`[ladder] ${name(e.ownerId)} sits out: ${e.reason}`);
    if (e.kind === "match") {
      const r = e.result.record;
      const who = r.outcome === "win" ? `${name(r.winnerOwnerId!)} wins` : r.outcome;
      console.log(`[ladder] ${r.matchId} ${name(r.p1OwnerId)} vs ${name(r.p2OwnerId)}: ${who} in ${r.turns ?? "-"} turns, +${r.p1Credits}/+${r.p2Credits}${e.result.note ? ` (${e.result.note})` : ""}`);
    }
  },
});
try {
  for (let i = 0; i < ROUNDS; i++) await ladder.runRound();
  for (const row of store.ladder()) {
    console.log(`${String(row.rank ?? "-").padStart(3)} ${row.ownerName.padEnd(24)} ${row.rating.toFixed(0)}±${row.rd.toFixed(0)} ${row.tier} ${row.wins}-${row.losses}-${row.draws}`);
  }
} finally {
  await chooser.terminateAll();
  store.close();
}
