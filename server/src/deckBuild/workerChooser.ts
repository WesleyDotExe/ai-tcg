// The store's deck chooser, run on a worker thread (session 56). A build at
// the store's settings plays thousands of games and takes minutes; the
// engine's games are synchronous work, so run on the server's own thread
// they would stall every other request until the build ends. The worker
// runs exactly the engine's `chooseDeck` (same holdings, same options, so
// the same deck), and the store saves its answer as usual.

import { Worker } from "node:worker_threads";
import type { BuiltDeck, DeckBuildOptions, Holdings } from "@ai-tcg/engine";
import type { DeckChooser } from "@ai-tcg/economy";

const ENTRY = new URL("./worker.mjs", import.meta.url);

export interface WorkerChooser {
  choose: DeckChooser;
  /** Builds still running. */
  readonly running: number;
  /** Stops every running build; each one's promise rejects. */
  terminateAll(): Promise<void>;
}

export function workerChooser(): WorkerChooser {
  const workers = new Set<Worker>();
  const choose: DeckChooser = (holdings: Holdings, options: DeckBuildOptions) =>
    new Promise<BuiltDeck>((resolve, reject) => {
      // A narrating `log` function can't cross to the thread; it is dropped.
      const { log: _log, ...rest } = options;
      const worker = new Worker(ENTRY, { workerData: { holdings: [...holdings], options: rest } });
      workers.add(worker);
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        workers.delete(worker);
        fn();
      };
      worker.once("message", (msg: { ok: true; built: BuiltDeck } | { ok: false; error: string }) => {
        settle(() => (msg.ok ? resolve(msg.built) : reject(new Error(msg.error))));
        void worker.terminate();
      });
      worker.once("error", (err) => settle(() => reject(err)));
      worker.once("exit", (code) => settle(() => reject(new Error(`the deck build stopped (worker exit ${code})`))));
    });
  return {
    choose,
    get running() {
      return workers.size;
    },
    async terminateAll() {
      await Promise.all([...workers].map((w) => w.terminate()));
    },
  };
}
