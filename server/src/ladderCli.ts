import { EconomyStore } from "@ai-tcg/economy";
import { workerChooser } from "./deckBuild/workerChooser.js";
import { LadderLog } from "./ladder/ladderLog.js";
import { Ladder } from "./ladder/ladderRunner.js";
import { seasonFileArgs, seasonFileProblem } from "./seasonFile.js";
import { acquireSeasonLock, exitOnStopSignals, tookOverLine } from "./seasonLock.js";

// Thin argv wrapper around the ladder: runs rounds of ranked matches between
// every owner with a connected agent in one season's database file
// (Season 0: the house agents), rebuilding agent decks on worker threads at
// the store's full search, and prints the season server's ladder lines.
//   npm run ladder -- <database file> [rounds] [match log directory]
// Rounds default to 1. House owners are queued always, player owners while
// their auto-play is on (session 67), and the house owners spend their
// credits on packs before each round. Matches here count at once; the
// watch-speed ladder with Watch live is `npm run season`.
// (session 85) The same file check as `npm run season` (seasonFile.ts).
// (session 86) And the same lock (seasonLock.ts), released on Ctrl-C.
const USAGE = "usage: npm run ladder -- <database file> [rounds] [match log directory] [--new | --archive]";
const parsed = seasonFileArgs(process.argv.slice(2));
if ("problem" in parsed) {
  console.error(`[ladder] ${parsed.problem}\n${USAGE}`);
  process.exit(1);
}
const DB_PATH = parsed.args[0];
if (!DB_PATH) {
  console.error(USAGE);
  process.exit(1);
}
const problem = seasonFileProblem(DB_PATH, parsed.flags);
if (problem !== null) {
  console.error(`[ladder] not starting: ${problem}`);
  process.exit(1);
}
const ROUNDS = Number(parsed.args[1] ?? 1);
if (!Number.isInteger(ROUNDS) || ROUNDS < 1) {
  console.error(`rounds must be a whole number of at least 1 (got ${parsed.args[1]})`);
  process.exit(1);
}
const lock = acquireSeasonLock(DB_PATH, "npm run ladder");
if ("problem" in lock) {
  console.error(`[ladder] not starting: ${lock.problem}`);
  process.exit(1);
}
const tookOver = tookOverLine(lock);
if (tookOver) console.log(tookOver);
exitOnStopSignals();
const store = EconomyStore.open(DB_PATH);
const chooser = workerChooser();
const name = (ownerId: string) => store.getOwner(ownerId).name;
// (session 103) The same lines as `npm run season` (LadderLog, ladderLog.ts):
// a repeated "sits out" reason summed up, a line per round, and the
// auto-play and season-end lines this CLI used to drop.
const ladderLog = new LadderLog(name);
const ladder = new Ladder({
  store,
  chooser: chooser.choose,
  logDir: parsed.args[2],
  onEvent: (e) => {
    for (const line of ladderLog.event(e)) console.log(line);
  },
});
try {
  for (let i = 0; i < ROUNDS; i++) {
    await ladder.runRound(undefined, (r) => {
      for (const line of ladderLog.round(r)) console.log(line);
    });
  }
  for (const row of store.ladder()) {
    console.log(`${String(row.rank ?? "-").padStart(3)} ${row.ownerName.padEnd(24)} ${row.rating.toFixed(0)}±${row.rd.toFixed(0)} ${row.tier} ${row.wins}-${row.losses}-${row.draws}`);
  }
} finally {
  await chooser.terminateAll();
  store.close();
  lock.release();
}
