// Entry point: plays one real match through the engine and writes a
// self-contained HTML replay to render/output/. Usage:
//   npm run replay -w @ai-tcg/render -- <factionA> <factionB> <seed> [outfile] [--signatures]
// factions: Cortex | Aegis | Swarm | Null
// --signatures gives each side a generated agent and its signature card
// (render/src/generatedSignatures.ts, the engine's own agent generator): the
// generated agent's name is that side's username, and its card waits in the
// signature zone.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { DeckSpec } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "./engineInternal.js";
import type { DeckFaction } from "./engineInternal.js";
import { captureMatch } from "./capture.js";
import { generatedSeats } from "./generatedSignatures.js";
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
  const args = process.argv.slice(2);
  const signatures = args.includes("--signatures");
  const [factionAArg, factionBArg, seedArg, outArg] = args.filter((a) => !a.startsWith("--"));
  const factionA = factionAArg && isFaction(factionAArg) ? factionAArg : "Aegis";
  const factionB = factionBArg && isFaction(factionBArg) ? factionBArg : "Swarm";
  const seed = seedArg ? Number(seedArg) : 1;

  const seats = signatures ? generatedSeats(seed) : undefined;
  const deckA: DeckSpec = { ...DECK_BUILDERS[factionA]!("p1", `${factionA} Deck`), ...(seats ? { signature: seats[0].card } : {}) };
  const deckB: DeckSpec = { ...DECK_BUILDERS[factionB]!("p2", `${factionB} Deck`), ...(seats ? { signature: seats[1].card } : {}) };
  // Usernames are the player-identity key (the avatar is seeded from them),
  // so a mirror match must not give both sides the same one. Generated
  // agents never share a name.
  const mirror = factionA === factionB;
  const agentA = new LookaheadAgent(seats ? seats[0].agentName : `Lookahead-${factionA}${mirror ? "-A" : ""}`, seed * 2 + 1);
  const agentB = new LookaheadAgent(seats ? seats[1].agentName : `Lookahead-${factionB}${mirror ? "-B" : ""}`, seed * 2 + 2);
  if (seats) for (const s of seats) console.log(`${s.agentName} (${s.collectorNumber}) — ${s.concept}`);

  const replay = await captureMatch({
    title: `${factionA} vs ${factionB} (seed ${seed}${signatures ? ", signature cards" : ""})`,
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
    : resolve(here, "../output", `${factionA.toLowerCase()}-vs-${factionB.toLowerCase()}-${signatures ? "sig-" : ""}seed${seed}.html`);
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
