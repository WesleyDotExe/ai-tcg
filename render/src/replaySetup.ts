// The match a replay plays: decks, generated signature seats and agents for
// a faction pairing and seed. Shared by cli.ts (the HTML replays) and
// feedTranscript.ts (their feeds as text), so both always capture the same
// match.
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { DeckSpec } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "./engineInternal.js";
import type { DeckFaction } from "./engineInternal.js";
import { captureMatch } from "./capture.js";
import { generatedSeats } from "./generatedSignatures.js";

export const DECK_BUILDERS: Record<DeckFaction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Aegis: buildAegisDeck,
  Swarm: buildSwarmDeck,
  Null: buildNullDeck,
};

/** --signatures gives each side a generated agent and its signature card
 * (generatedSignatures.ts, the engine's own agent generator): the generated
 * agent's name is that side's username, and its card waits in the
 * signature zone. */
export async function captureReplay(factionA: DeckFaction, factionB: DeckFaction, seed: number, signatures: boolean) {
  const seats = signatures ? generatedSeats(seed) : undefined;
  const deckA: DeckSpec = { ...DECK_BUILDERS[factionA]("p1", `${factionA} Deck`), ...(seats ? { signature: seats[0].card } : {}) };
  const deckB: DeckSpec = { ...DECK_BUILDERS[factionB]("p2", `${factionB} Deck`), ...(seats ? { signature: seats[1].card } : {}) };
  // Usernames are the player-identity key (the avatar is seeded from them),
  // so a mirror match must not give both sides the same one. Generated
  // agents never share a name.
  const mirror = factionA === factionB;
  const agentA = new LookaheadAgent(seats ? seats[0].agentName : `Lookahead-${factionA}${mirror ? "-A" : ""}`, seed * 2 + 1);
  const agentB = new LookaheadAgent(seats ? seats[1].agentName : `Lookahead-${factionB}${mirror ? "-B" : ""}`, seed * 2 + 2);
  const replay = await captureMatch({
    title: `${factionA} vs ${factionB} (seed ${seed}${signatures ? ", signature cards" : ""})`,
    seed,
    deckA,
    deckB,
    agentA,
    agentB,
    boardSlots: BOARD_SLOTS,
  });
  return { replay, seats };
}
