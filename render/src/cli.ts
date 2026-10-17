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
import { DECK_BUILDERS, captureReplay } from "./replaySetup.js";
import type { DeckFaction } from "./engineInternal.js";
import { renderMatchHtml } from "./renderHtml.js";

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

  const { replay, seats } = await captureReplay(factionA, factionB, seed, signatures);
  if (seats) for (const s of seats) console.log(`${s.agentName} (${s.collectorNumber}) — ${s.concept}`);

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
