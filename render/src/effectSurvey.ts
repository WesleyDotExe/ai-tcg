// Dev survey for EFFECTS.md v2 slice 2: plays real matches and counts what
// resolveEffects (effectFx.ts) finds per category, faction and pairing, so
// the spell/heal/buff/debuff/removal travel is shown working on real logs.
//   npm run effect-survey -w @ai-tcg/render [-- seeds]
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { DeckSpec } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "./engineInternal.js";
import type { DeckFaction } from "./engineInternal.js";
import { captureMatch } from "./capture.js";
import { resolveEffects } from "./effectFx.js";

const DECKS: Record<DeckFaction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck, Aegis: buildAegisDeck, Swarm: buildSwarmDeck, Null: buildNullDeck,
};
const FACTIONS = Object.keys(DECKS) as DeckFaction[];

async function main() {
  const seeds = Number(process.argv[2] ?? 2);
  const byCat: Record<string, number> = {};
  const byFaction: Record<string, Record<string, number>> = {};
  const examples: Record<string, string> = {};
  let moves = 0, self = 0, unresolvedTarget = 0, unitRemovals = 0, directiveRemovals = 0;
  for (const a of FACTIONS) for (const b of FACTIONS) for (let seed = 1; seed <= seeds; seed++) {
    const replay = await captureMatch({
      title: `${a} vs ${b}`, seed,
      deckA: DECKS[a]("p1", a), deckB: DECKS[b]("p2", b),
      agentA: new LookaheadAgent(`L-${a}-A`, seed * 2 + 1), agentB: new LookaheadAgent(`L-${b}-B`, seed * 2 + 2),
      boardSlots: BOARD_SLOTS,
    });
    for (let i = 1; i < replay.frames.length; i++) {
      const prev = replay.frames[i - 1]!, next = replay.frames[i]!;
      moves++;
      for (const fx of resolveEffects(prev, next)) {
        byCat[fx.category] = (byCat[fx.category] ?? 0) + 1;
        const f = replay.cardFactions[fx.sourceName] ?? "?";
        (byFaction[f] ??= {})[fx.category] = (byFaction[f]![fx.category] ?? 0) + 1;
        if (fx.self) self++;
        if (fx.category === "removal" && fx.target.kind === "unit") { if (fx.target.instanceId.startsWith("d")) directiveRemovals++; else unitRemovals++; }
        // Every unit end must exist on one of the two boards (or, for a
        // removal / an onDeath source, on the board before the move).
        const ends = [fx.source, fx.target].filter((e) => e.kind === "unit") as { instanceId: string }[];
        for (const e of ends) {
          const onBoard = (fr: typeof prev) => (["p1", "p2"] as const).some((p) => fr.players[p].board.some((u) => u.instanceId === e.instanceId) || fr.players[p].directives.some((d) => d.instanceId === e.instanceId));
          if (!onBoard(prev) && !onBoard(next)) unresolvedTarget++;
        }
        const key = `${f}/${fx.category}`;
        if (!examples[key]) examples[key] = `${replay.title} s${seed} move ${i}: ${fx.sourceName} (${fx.ability}) -> ${JSON.stringify(fx.target)}${fx.amount ? ` amount ${fx.amount}` : ""}${fx.status ? ` ${fx.status}` : ""}${fx.self ? " [self]" : ""}`;
      }
    }
  }
  console.log(`${FACTIONS.length ** 2 * seeds} matches, ${moves} moves`);
  console.log("by category:", JSON.stringify(byCat));
  for (const f of Object.keys(byFaction).sort()) console.log(`  ${f.padEnd(8)} ${JSON.stringify(byFaction[f])}`);
  console.log(`self-targeted (no travel): ${self}; unit ends not found on either board: ${unresolvedTarget}`);
  console.log(`removals: ${unitRemovals} of a unit, ${directiveRemovals} of a Directive`);
  console.log("first example per faction/category:");
  for (const k of Object.keys(examples).sort()) console.log(`  ${k.padEnd(16)} ${examples[k]}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
