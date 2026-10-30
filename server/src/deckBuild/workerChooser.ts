// The store's deck chooser, run on a worker thread (session 56). A build at
// the store's settings plays thousands of games and takes minutes; the
// engine's games are synchronous work, so run on the server's own thread
// they would stall every other request until the build ends. The worker
// runs exactly the engine's `chooseDeck` (same holdings, same options, so
// the same deck), and the store saves its answer as usual.
//
// At most `maxWorkers` builds run at once (session 60); the rest wait in
// line, first come first served. Each build is minutes of one core's CPU, so
// without a cap many owners pressing "rebuild now" together would start that
// many threads and slow every one of them (and the server) down. The default
// leaves one core for the server itself.

import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import type { BuiltDeck, DeckBuildOptions, Holdings } from "@ai-tcg/engine";
import type { DeckChooser } from "@ai-tcg/economy";

const ENTRY = new URL("./worker.mjs", import.meta.url);

/** The default cap: every core but one, and at least one. */
export function defaultMaxWorkers(): number {
  return Math.max(1, availableParallelism() - 1);
}

export interface WorkerChooserOptions {
  /** Builds that may run at once (default `defaultMaxWorkers()`). */
  maxWorkers?: number;
}

export interface WorkerChooser {
  choose: DeckChooser;
  /** Builds running on a thread now. */
  readonly running: number;
  /** Builds waiting for a free thread. */
  readonly queued: number;
  /** The cap on running builds. */
  readonly maxWorkers: number;
  /** Stops every running build and drops every waiting one; each one's
   * promise rejects. */
  terminateAll(): Promise<void>;
}

interface Waiting {
  start: () => void;
  reject: (err: Error) => void;
}

export function workerChooser(opts: WorkerChooserOptions = {}): WorkerChooser {
  const maxWorkers = opts.maxWorkers ?? defaultMaxWorkers();
  if (!Number.isInteger(maxWorkers) || maxWorkers < 1) throw new Error(`maxWorkers must be a whole number of at least 1 (got ${maxWorkers})`);
  const workers = new Set<Worker>();
  const line: Waiting[] = [];

  const next = () => {
    while (workers.size < maxWorkers && line.length > 0) line.shift()!.start();
  };

  const run = (holdings: Holdings, options: DeckBuildOptions, resolve: (b: BuiltDeck) => void, reject: (e: Error) => void) => {
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
      next();
    };
    worker.once("message", (msg: { ok: true; built: BuiltDeck } | { ok: false; error: string }) => {
      settle(() => (msg.ok ? resolve(msg.built) : reject(new Error(msg.error))));
      void worker.terminate();
    });
    worker.once("error", (err) => settle(() => reject(err)));
    worker.once("exit", (code) => settle(() => reject(new Error(`the deck build stopped (worker exit ${code})`))));
  };

  const choose: DeckChooser = (holdings: Holdings, options: DeckBuildOptions) =>
    new Promise<BuiltDeck>((resolve, reject) => {
      // The holdings are copied now, so a build that waits builds from what
      // the store read when it asked (the store re-checks the copies at save).
      const held: Holdings = new Map(holdings);
      line.push({ start: () => run(held, options, resolve, reject), reject });
      next();
    });

  return {
    choose,
    get running() {
      return workers.size;
    },
    get queued() {
      return line.length;
    },
    maxWorkers,
    async terminateAll() {
      for (const w of line.splice(0)) w.reject(new Error("the deck build was cancelled before it started"));
      await Promise.all([...workers].map((w) => w.terminate()));
    },
  };
}
