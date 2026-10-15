// Generated agents and their signature cards for render replays.
//
// Owner 2026-10-15 (render slice 7, call 6): the demo signature names were
// placeholders; real names come from the agent generator. The generator is
// built (engine data/agentGenerator.ts, session 34), so a replay with
// signature cards now runs exactly what the Season 0 "Generate a new agent"
// flow runs: 3 agent candidates, then 3 signature candidates for the agent
// picked, then the card built under its own sig-PR-NNN id. The replay takes
// the first candidate at each step (an owner picks by hand on the site).
//
// Seat two is generated with seat one already taken, the way the economy
// store passes a season's taken names: the agents never share a name, and
// the cards never share a name with each other or with a set card. Seeded
// from the replay seed, so the same seed gives the same two agents. Nothing
// calls an outside service. Render-only use of the public engine API;
// nothing here changes play.
import { CARD_REGISTRY, generateAgentCandidates, generateSignatureCandidates, signatureCardFor } from "@ai-tcg/engine";
import type { UnitCard } from "@ai-tcg/engine";

export interface GeneratedSeat {
  /** The generated agent's name: the replay's username for that side. */
  agentName: string;
  persona: string;
  /** "PR-001": the promo collector number the economy store would give. */
  collectorNumber: string;
  /** "Name: cost 5, 3/6. ..." from the generator, for logs and tests. */
  concept: string;
  card: UnitCard;
}

/** Two generated agents with their signature cards, for seats p1 and p2. */
export function generatedSeats(seed: number): [GeneratedSeat, GeneratedSeat] {
  const agentNames = new Set<string>();
  const cardNames = new Set<string>([...CARD_REGISTRY.values()].map((c) => c.name));
  const comboIds = new Set<string>();
  const seats: GeneratedSeat[] = [];
  for (let k = 0; k < 2; k++) {
    // Distinct, deterministic sub-seeds per seat and per step.
    const base = (seed * 7919 + k * 104729) >>> 0;
    const agent = generateAgentCandidates(base + 1, { agentNames })[0]!;
    agentNames.add(agent.name);
    const sig = generateSignatureCandidates(base + 2, agent.name, { cardNames, comboIds })[0]!;
    cardNames.add(sig.name);
    comboIds.add(sig.comboId);
    const collectorNumber = `PR-${String(k + 1).padStart(3, "0")}`;
    seats.push({
      agentName: agent.name,
      persona: agent.persona,
      collectorNumber,
      concept: sig.concept,
      card: signatureCardFor(sig, `sig-${collectorNumber}`),
    });
  }
  return [seats[0]!, seats[1]!];
}
