// The owner website against a real owner API, for trying it by hand and for
// the session's browser evidence (render sessions 44 and 45).
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
  // Nova is the house admin (Season 0: the owner runs the house), so
  // Settings shows Admin; Rook is a player and doesn't see it.
  const nova = store.createAccount({ name: "Nova", username: DEMO_LOGIN, password: DEMO_PASSWORD, isAdmin: true });
  store.grantStarterCollection(nova.ownerId, "Cortex");
  // Demo-only extra packs, so the collection has some width. Session 47:
  // granted as weekly challenge packs, not "ownerDaily": the store works the
  // free daily pack out from the owner's ownerDaily packs, so ten of those
  // granted on the first day would leave nothing to claim, and the Store's
  // claim would have nothing to show.
  for (let i = 0; i < 10; i++) store.grantPack(nova.ownerId, "S0", "weeklyChallenge");
  let seed = 4400;
  while (store.unopenedPacks(nova.ownerId).length > 0) store.openPack(nova.ownerId, undefined, { seed: seed++ });
  // Session 48: one deck saved by hand, so the Collection page's salvage can
  // meet a saved deck it would leave short (the server's 409, confirmed by
  // the owner): the starter with one copy swapped for a pulled pack copy,
  // the first that makes a legal deck. Not the active deck: the agent still
  // picks its own.
  const starterCopies = store.collection(nova.ownerId).filter((c) => c.origin === "starter");
  for (const p of store.collection(nova.ownerId).filter((c) => c.origin === "pack" && c.finish === "standard" && !c.accountBound)) {
    try {
      store.saveDeck(nova.ownerId, "Cortex, my tweak", [...starterCopies.slice(1).map((c) => c.copyId), p.copyId]);
      break;
    } catch {
      /* not legal with this copy: the next */
    }
  }
  const first = store.createAgent({ ownerId: nova.ownerId, name: "Vector Halcyon" });
  store.createAgent({ ownerId: nova.ownerId, name: "Quill Static" });
  store.connectAgent(nova.ownerId, first.agentId);
  const rook = store.createAccount({ name: "Rook", username: "rook", password: DEMO_PASSWORD });
  store.grantStarterCollection(rook.ownerId, "Aegis");
  const rookAgent = store.createAgent({ ownerId: rook.ownerId, name: "Rook's agent" });
  // The wallet in the top bar, from real store calls: ten days of one win
  // each for Nova's agent over Rook's (the daily win schedule's credits;
  // five days before session 47), enough to buy a pack below and still
  // afford two more on the page, and packs waiting to be opened (the Open
  // button's count).
  for (let i = 0; i < 10; i++) {
    const endedAt = new Date(Date.parse("2026-10-20T10:00:00.000Z") + i * 86_400_000).toISOString();
    store.recordMatch({ matchId: `demo-${i}`, seed: i, p1AgentId: first.agentId, p2AgentId: rookAgent.agentId, outcome: { kind: "win", winnerAgentId: first.agentId }, endedAt });
  }
  // Ten waiting (session 47; three before), so "Open 10" can be tried.
  for (let i = 0; i < 10; i++) store.grantPack(nova.ownerId, "S0", "weeklyChallenge");
  // One bought with those credits (the Store lists it as "Bought").
  store.buyPacks(nova.ownerId, "S0", 1);
  // Today (session 46, the Daily rewards widget): two wins and a loss in the
  // last hours, recorded the same way, so today's earnings are real. (Run
  // within 70 min after a Sydney midnight, some fall on yesterday.)
  const now = Date.now();
  const today = [
    { at: now - 3 * 60_000, win: true },
    { at: now - 40 * 60_000, win: false },
    { at: now - 70 * 60_000, win: true },
  ].sort((a, b) => a.at - b.at);
  today.forEach((m, i) =>
    store.recordMatch({
      matchId: `demo-today-${i}`,
      seed: 100 + i,
      p1AgentId: first.agentId,
      p2AgentId: rookAgent.agentId,
      outcome: { kind: "win", winnerAgentId: m.win ? first.agentId : rookAgent.agentId },
      endedAt: new Date(m.at).toISOString(),
    }),
  );

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
