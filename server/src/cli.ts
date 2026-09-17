import { startServer } from "./server.js";

// Thin argv-parsing wrapper around `startServer` — see server.ts for the
// actual server logic, factored out so it can be driven directly by an
// automated integration test (real sockets, no process spawning).
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);
const SEED = Number(process.argv[3] ?? Date.now());
const LOG_PATH = process.argv[4];

await startServer({ port: PORT, seed: SEED, logPath: LOG_PATH });
