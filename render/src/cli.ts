// Entry point: plays one real match through the engine and writes a
// self-contained HTML replay to render/output/. Usage:
//   npm run replay -w @ai-tcg/render -- <factionA> <factionB> <seed> [outfile]
// factions: Cortex | Aegis | Swarm | Null
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { DeckSpec } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "./engineInternal.js";
import type { DeckFaction } from "./engineInternal.js";
import { captureMatch } from "./capture.js";
import { renderMatchHtml } from "./renderHtml.js";

const DECK_BUILDERS: Record<DeckFaction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Aegis: buildAegisDeck,
  Swarm: buildSwarmDeck,
  Null: buildNullDeck,
};

function isFaction(s: string): s is DeckFaction {
  return s in DECK_BUILDERS;
}

async function main() {
  const [factionAArg, factionBArg, seedArg, outArg] = process.argv.slice(2);
  const factionA = factionAArg && isFaction(factionAArg) ? factionAArg : "Aegis";
  const factionB = factionBArg && isFaction(factionBArg) ? factionBArg : "Swarm";
  const seed = seedArg ? Number(seedArg) : 1;

  const deckA = DECK_BUILDERS[factionA]!("p1", `${factionA} Deck`);
  const deckB = DECK_BUILDERS[factionB]!("p2", `${factionB} Deck`);
  // Usernames are the player-identity key (the avatar is seeded from them),
  // so a mirror match must not give both sides the same one.
  const mirror = factionA === factionB;
  const agentA = new LookaheadAgent(`Lookahead-${factionA}${mirror ? "-A" : ""}`, seed * 2 + 1);
  const agentB = new LookaheadAgent(`Lookahead-${factionB}${mirror ? "-B" : ""}`, seed * 2 + 2);

  const replay = await captureMatch({
    title: `${factionA} vs ${factionB} (seed ${seed})`,
    seed,
    deckA,
    deckB,
    agentA,
    agentB,
    boardSlots: BOARD_SLOTS,
  });

  const html = renderMatchHtml(replay);
  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = outArg
    ? resolve(process.cwd(), outArg)
    : resolve(here, "../output", `${factionA.toLowerCase()}-vs-${factionB.toLowerCase()}-seed${seed}.html`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, "utf8");

  const finalFrame = replay.frames[replay.frames.length - 1]!;
  console.log(`Captured ${replay.movesPlayed} moves over ${finalFrame.turnNumber} turns.`);
  console.log(`Winner: ${finalFrame.winner ?? "(unresolved — turn cap or move-safety limit hit)"}`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
