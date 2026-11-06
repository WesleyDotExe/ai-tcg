import { mkdirSync } from "node:fs";
import { EconomyStore } from "@ai-tcg/economy";
import { workerChooser } from "./deckBuild/workerChooser.js";
import { LiveLadder } from "./ladder/liveLadder.js";
import { startOwnerApi } from "./ownerApi.js";

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
const DB_PATH = process.argv[2];
if (!DB_PATH) {
  console.error("usage: npm run season -- <database file> [port] [match directory]");
  process.exit(1);
}
const PORT = Number(process.argv[3] ?? process.env.PORT ?? 8081);
const MATCH_DIR = process.argv[4] ?? `${DB_PATH}.matches`;
mkdirSync(MATCH_DIR, { recursive: true });

const store = EconomyStore.open(DB_PATH);
const chooser = workerChooser();
const name = (ownerId: string) => store.getOwner(ownerId).name;
const live = new LiveLadder({
  store,
  chooser: chooser.choose,
  logDir: MATCH_DIR,
  onRound: (r) => console.log(`[ladder] round ${r.round}: ${r.pairs.length} match${r.pairs.length === 1 ? "" : "es"}${r.sitOut.length ? `, ${r.sitOut.map(name).join(", ")} sits out` : ""}`),
  onEvent: (e) => {
    if (e.kind === "housePacks") console.log(`[ladder] ${name(e.ownerId)} bought ${e.bought}, opened ${e.opened} packs (${e.newCards} new cards)`);
    if (e.kind === "rebuilt") console.log(`[ladder] rebuilt ${name(e.ownerId)}'s deck: ${e.faction}, ${e.cards} cards (${e.reasons.join("; ")})`);
    if (e.kind === "excluded") console.log(`[ladder] ${name(e.ownerId)} sits out: ${e.reason}`);
    if (e.kind === "autoPlayStopped") console.log(`[ladder] ${name(e.ownerId)}'s auto-play is off: ${e.reason === "timeUp" ? "its play time is up" : "today's rewards are maxed"}`);
    if (e.kind === "seasonEnded") console.log(`[season] season ${e.season} ended at ${e.endedAt}: ${e.standings} owners in the final standings, ${e.retiredCopies} unpulled Prototype copies retired`);
    if (e.kind === "match") {
      const r = e.result.record;
      const who = r.outcome === "win" ? `${name(r.winnerOwnerId!)} wins` : r.outcome;
      console.log(`[ladder] ${r.matchId} ${name(r.p1OwnerId)} vs ${name(r.p2OwnerId)}: ${who} in ${r.turns ?? "-"} turns, +${r.p1Credits}/+${r.p2Credits}${e.result.note ? ` (${e.result.note})` : ""}`);
    }
  },
});
const closed = live.recoverOrphans();
if (closed.length) console.log(`[ladder] cancelled ${closed.length} match(es) left live by the last run: ${closed.join(", ")}`);
const api = await startOwnerApi({ store, port: PORT, chooser: chooser.choose, live, matchFiles: MATCH_DIR });
live.start();
console.log(`[season] owner API on http://localhost:${api.port}, the ladder running over ${DB_PATH} (matches in ${MATCH_DIR})`);

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  console.log("[season] stopping");
  await live.stop();
  await api.close();
  await chooser.terminateAll();
  store.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
