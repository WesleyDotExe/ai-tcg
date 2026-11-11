import { EconomyStore } from "@ai-tcg/economy";
import { workerChooser } from "./deckBuild/workerChooser.js";
import { startOwnerApi } from "./ownerApi.js";
import { seasonFileArgs, seasonFileLine, seasonFileProblem } from "./seasonFile.js";

// Thin argv wrapper around `startOwnerApi`: serves the owner API over one
// season's database file, with "rebuild now" on worker threads.
//   npm run owner-api -- <database file> [port] [--new | --archive]
// (session 85) The same file check as `npm run season` (seasonFile.ts).
const USAGE = "usage: npm run owner-api -- <database file> [port] [--new | --archive]";
const parsed = seasonFileArgs(process.argv.slice(2));
if ("problem" in parsed) {
  console.error(`[owner-api] ${parsed.problem}\n${USAGE}`);
  process.exit(1);
}
const DB_PATH = parsed.args[0];
if (!DB_PATH) {
  console.error(USAGE);
  process.exit(1);
}
const problem = seasonFileProblem(DB_PATH, parsed.flags);
if (problem !== null) {
  console.error(`[owner-api] not starting: ${problem}`);
  process.exit(1);
}
const PORT = Number(parsed.args[1] ?? process.env.PORT ?? 8081);

const store = EconomyStore.open(DB_PATH);
console.log(seasonFileLine(store, DB_PATH));
const api = await startOwnerApi({ store, port: PORT, chooser: workerChooser().choose });
console.log(`[owner-api] listening on http://localhost:${api.port} over ${DB_PATH}`);
