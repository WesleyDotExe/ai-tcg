import { mkdirSync } from "node:fs";
import { EconomyStore } from "@ai-tcg/economy";
import { workerChooser } from "./deckBuild/workerChooser.js";
import { LiveLadder } from "./ladder/liveLadder.js";
import { LadderLog } from "./ladder/ladderLog.js";
import { startOwnerApi } from "./ownerApi.js";
import { seasonFileArgs, seasonFileLine, seasonFileProblem } from "./seasonFile.js";
import { acquireSeasonLock, tookOverLine } from "./seasonLock.js";
import { stampConsole } from "./logTime.js";

// The Season 0 server in one process (session 67): the owner API and the
// long-lived ladder over one season's database file. The ladder plays round
// after round (house owners always, player owners while auto-play is on),
// shows each match at watch speed for Watch live, and records it when the
// last move has been shown; each match's log and replay go in the match
// directory, which the API serves as match history.
//   npm run season -- <database file> [port] [match directory]
// The match directory defaults to `<database file>.matches`. Ctrl-C stops
// it; a match being shown then is cancelled on the next start (nobody's
// fault: no credits, no rating).
// (session 85) It starts only on an existing, open season's file: a missing
// file needs --new (the first start), an ended season's file --archive
// (seasonFile.ts), so a mistyped name or the old season's file after a
// season switch is refused before anything is opened.
// (session 86) It holds `<database file>.lock` while it runs (seasonLock.ts):
// a second server on the file, and `npm run season:next` from it, are refused
// until it stops.
// (session 92) Every line it prints starts with the local time (logTime.ts).
stampConsole();
const USAGE = "usage: npm run season -- <database file> [port] [match directory] [--new | --archive]";
const parsed = seasonFileArgs(process.argv.slice(2));
if ("problem" in parsed) {
  console.error(`[season] ${parsed.problem}\n${USAGE}`);
  process.exit(1);
}
const DB_PATH = parsed.args[0];
if (!DB_PATH) {
  console.error(USAGE);
  process.exit(1);
}
const problem = seasonFileProblem(DB_PATH, parsed.flags);
if (problem !== null) {
  console.error(`[season] not starting: ${problem}`);
  process.exit(1);
}
const lock = acquireSeasonLock(DB_PATH, "npm run season");
if ("problem" in lock) {
  console.error(`[season] not starting: ${lock.problem}`);
  process.exit(1);
}
const tookOver = tookOverLine(lock);
if (tookOver) console.log(tookOver);
const PORT = Number(parsed.args[1] ?? process.env.PORT ?? 8081);
const MATCH_DIR = parsed.args[2] ?? `${DB_PATH}.matches`;
mkdirSync(MATCH_DIR, { recursive: true });

const store = EconomyStore.open(DB_PATH);
console.log(seasonFileLine(store, DB_PATH));
const chooser = workerChooser();
const name = (ownerId: string) => store.getOwner(ownerId).name;
// (session 102) The ladder's lines are LadderLog's (ladderLog.ts): the same
// lines as before, except a repeat of the same "sits out" reason is summed up.
const ladderLog = new LadderLog(name);
const live = new LiveLadder({
  store,
  chooser: chooser.choose,
  logDir: MATCH_DIR,
  onRound: (r) => {
    for (const line of ladderLog.round(r)) console.log(line);
  },
  onEvent: (e) => {
    for (const line of ladderLog.event(e)) console.log(line);
  },
});
const closed = live.recoverOrphans();
if (closed.length) console.log(`[ladder] cancelled ${closed.length} match(es) left live by the last run: ${closed.join(", ")}`);
// Ctrl-C is handled from here on, before the one wait in starting up, so a
// stop at any point goes through the shutdown and releases the lock (a
// signal's default action would leave it behind: session 86).
let api: Awaited<ReturnType<typeof startOwnerApi>> | null = null;
let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  console.log("[season] stopping");
  await live.stop();
  await api?.close();
  await chooser.terminateAll();
  store.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

const started = await startOwnerApi({ store, port: PORT, chooser: chooser.choose, live, matchFiles: MATCH_DIR });
api = started;
if (stopping) {
  // Stopped while the API was starting: the shutdown above missed it.
  await started.close();
} else {
  live.start();
  console.log(`[season] owner API on http://localhost:${started.port}, ${store.seasonEnded() ? "the archive (no ladder rounds)" : "the ladder running"} over ${DB_PATH} (matches in ${MATCH_DIR})`);
}
