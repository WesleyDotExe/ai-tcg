// The owner website against a real owner API, for trying it by hand and for
// the session's browser evidence (render session 44).
//
// A fresh season database in a temp folder, one owner made the way sign-up
// will (store calls: a Cortex starter, 10 daily packs opened with the live
// roller, two agents, the first connected), a second owner beside it, the
// game lane's owner API on a port (its own code, unchanged, read from
// server/src), and the site host in front of it. Nothing is mocked: every
// click on the page is an HTTP request to the real API over the real store.
//
//   npm run site-demo -w @ai-tcg/render [-- --port 8080]
//
// "Rebuild now" runs a short build (a few games per opponent, so it ends in
// seconds) on the server's worker threads; pass --full for the store's own
// settings (minutes). Stops on Ctrl-C and removes the temp folder.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EconomyStore } from "@ai-tcg/economy";
// The game lane's server, read-only (RENDER.md: consume it as a fixed upstream).
import { workerChooser } from "../../../server/src/deckBuild/workerChooser.js";
import { startOwnerApi } from "../../../server/src/ownerApi.js";
import { startSiteHost } from "./siteHost.js";

export const DEMO_LOGIN = "nova";
export const DEMO_PASSWORD = "a long demo password";
/** A short build for the demo: a few games per shipped opponent. */
export const DEMO_BUILD = { games: 4, trials: 4, confirmGames: 8 } as const;

export interface RunningDemo {
  url: string;
  apiPort: number;
  store: EconomyStore;
  close(): Promise<void>;
}

export async function startSiteDemo(options: { port?: number; full?: boolean } = {}): Promise<RunningDemo> {
  const dir = mkdtempSync(join(tmpdir(), "site-demo-"));
  const store = EconomyStore.open(join(dir, "season-0.db"));
  const nova = store.createAccount({ name: "Nova", username: DEMO_LOGIN, password: DEMO_PASSWORD });
  store.grantStarterCollection(nova.ownerId, "Cortex");
  for (let i = 0; i < 10; i++) store.grantPack(nova.ownerId, "S0", "ownerDaily");
  let seed = 4400;
  while (store.unopenedPacks(nova.ownerId).length > 0) store.openPack(nova.ownerId, undefined, { seed: seed++ });
  const first = store.createAgent({ ownerId: nova.ownerId, name: "Vector Halcyon" });
  store.createAgent({ ownerId: nova.ownerId, name: "Quill Static" });
  store.connectAgent(nova.ownerId, first.agentId);
  const rook = store.createAccount({ name: "Rook", username: "rook", password: DEMO_PASSWORD });
  store.grantStarterCollection(rook.ownerId, "Aegis");
  store.createAgent({ ownerId: rook.ownerId, name: "Rook's agent" });

  const chooser = workerChooser();
  const api = await startOwnerApi({ store, port: 0, chooser: chooser.choose, ...(options.full ? {} : { build: DEMO_BUILD }) });
  const site = await startSiteHost({ api: `http://localhost:${api.port}`, port: options.port ?? 0 });
  return {
    url: `http://127.0.0.1:${site.port}/`,
    apiPort: api.port,
    store,
    close: async () => {
      await site.close();
      await api.idle();
      await api.close();
      await chooser.terminateAll();
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const i = process.argv.indexOf("--port");
  const demo = await startSiteDemo({ port: i >= 0 ? Number(process.argv[i + 1]) : 8080, full: process.argv.includes("--full") });
  console.log(`[site-demo] ${demo.url}  sign in as "${DEMO_LOGIN}" / "${DEMO_PASSWORD}"  (owner API on port ${demo.apiPort})`);
  const stop = async () => {
    await demo.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
