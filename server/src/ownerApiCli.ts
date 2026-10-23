import { EconomyStore } from "@ai-tcg/economy";
import { workerChooser } from "./deckBuild/workerChooser.js";
import { startOwnerApi } from "./ownerApi.js";

// Thin argv wrapper around `startOwnerApi`: serves the owner API over one
// season's database file, with "rebuild now" on worker threads.
//   npm run owner-api -- <database file> [port]
const DB_PATH = process.argv[2];
if (!DB_PATH) {
  console.error("usage: npm run owner-api -- <database file> [port]");
  process.exit(1);
}
const PORT = Number(process.argv[3] ?? process.env.PORT ?? 8081);

const store = EconomyStore.open(DB_PATH);
const api = await startOwnerApi({ store, port: PORT, chooser: workerChooser().choose });
console.log(`[owner-api] listening on http://localhost:${api.port} over ${DB_PATH}`);
