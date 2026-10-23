// Runs one deck build on a worker thread: the engine's `chooseDeck` on the
// holdings and options the main thread posted, and the result posted back.
// Nothing here touches the store; the main thread saves the deck.

import { parentPort, workerData } from "node:worker_threads";
import { chooseDeck, type DeckBuildOptions } from "@ai-tcg/engine";

const { holdings, options } = workerData as { holdings: [string, number][]; options: DeckBuildOptions };

try {
  const built = await chooseDeck(new Map(holdings), options);
  parentPort!.postMessage({ ok: true, built });
} catch (err) {
  parentPort!.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
}
