// Real-play evidence for instance ids in the event log (owner-feedback
// 2026-10-03, balance lane item b; session 27) and for Propagating Exploit at
// 2/3 (owner-approved 2026-10-04).
//
// Plays Null vs Cortex with the shipped decks, both LookaheadAgent, with the
// edge-measure seeding, and prints the first game that shows the things the
// render lane asked ids for:
//   - Propagating Exploit played (its new 2/3 body on the board),
//   - a targeted spell or ability whose damage lands on a unit (the travel
//     the render wants to aim exactly),
//   - two units of the same name on one side at once, with one of them hit
//     (where a name alone can't say which copy),
//   - an onDeath ability firing (sourceId is the dead unit's old id).
// Every line is the ordinary text log (formatEvent, unchanged by ids), with
// the event's id fields appended in braces.
//
// Usage: npx tsx src/dev/eventIdsMatchDemo.ts [maxSeed=400]

import { buildCortexDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import { formatEvent } from "../log/format.js";
import type { GameEvent, GameState } from "../state/types.js";
import type { TargetRef } from "../effects/targeting.js";

const maxSeed = Number(process.argv[2] ?? 400);

const ID_KEYS = [
  "instanceId",
  "sourceId",
  "targetId",
  "unitId",
  "attackerId",
  "stackId",
  "targetRef",
  "defenderRef",
  "fromRef",
  "toRef",
  "targets",
] as const;

function ref(r: TargetRef): string {
  return r.kind === "player" ? r.playerId : r.instanceId;
}

export function idSuffix(e: GameEvent): string {
  const parts: string[] = [];
  const rec = e as unknown as Record<string, unknown>;
  for (const k of ID_KEYS) {
    const v = rec[k];
    if (v === undefined) continue;
    if (k === "targets") parts.push(`targets=[${(v as TargetRef[]).map(ref).join(",")}]`);
    else if (typeof v === "object") parts.push(`${k}=${ref(v as TargetRef)}`);
    else parts.push(`${k}=${v as string}`);
  }
  return parts.length ? `   {${parts.join(" ")}}` : "";
}

/** Which of the four wanted moments a finished game shows. */
function features(state: GameState) {
  const log = state.log;
  const names = new Map<string, string>();
  const side = new Map<string, string>();
  const alive = new Set<string>();
  let twinHit = false;
  for (const e of log) {
    if (e.type === "play" && e.instanceId) {
      names.set(e.instanceId, e.card);
      side.set(e.instanceId, e.player);
      alive.add(e.instanceId);
    }
    if (e.type === "summon") {
      names.set(e.instanceId, e.token);
      side.set(e.instanceId, e.player);
      alive.add(e.instanceId);
    }
    if (e.type === "evolve" && e.instanceId) names.set(e.instanceId, e.to);
    if (e.type === "death" && e.instanceId) alive.delete(e.instanceId);
    if (e.type === "damage" && e.targetRef?.kind === "unit") {
      const id = e.targetRef.instanceId;
      const twins = [...alive].filter((o) => o !== id && names.get(o) === names.get(id) && side.get(o) === side.get(id));
      if (twins.length > 0) twinHit = true;
    }
  }
  const spellOrAbilityHit = log.some(
    (e, i) =>
      e.type === "abilityTrigger" &&
      (e.targets ?? []).some((t) => t.kind === "unit") &&
      log.slice(i + 1, i + 4).some((d) => d.type === "damage" && d.targetKind === "unit" && d.sourceId === e.sourceId),
  );
  return {
    exploit: log.some((e) => e.type === "play" && e.card === "Propagating Exploit"),
    spellOrAbilityHit,
    twinHit,
    onDeath: log.some((e) => e.type === "abilityTrigger" && e.trigger === "onDeath"),
  };
}

async function main(): Promise<void> {
  for (let seed = 1; seed <= maxSeed; seed++) {
    const aGoesFirst = seed % 2 === 1;
    const deckA = buildCortexDeck("p1", "Cortex Deck");
    const deckB = buildNullDeck("p2", "Null Deck");
    const agentA = new LookaheadAgent("Lookahead-Cortex", seed * 104729 + 31);
    const agentB = new LookaheadAgent("Lookahead-Null", seed * 104729 + 31);
    const { state, movesPlayed } = aGoesFirst
      ? await runMatch(deckA, deckB, agentA, agentB, seed)
      : await runMatch(deckB, deckA, agentB, agentA, seed);
    const f = features(state);
    if (!(f.exploit && f.spellOrAbilityHit && f.twinHit && f.onDeath)) continue;

    console.log(`AI-TCG event-id demo: Null vs Cortex, seed ${seed} (first seed in 1-${maxSeed} showing all four moments)`);
    console.log(`p1 = ${state.players.p1.name}, p2 = ${state.players.p2.name}`);
    console.log("Each line: the unchanged text log, then the event's id fields in braces.");
    console.log("");
    for (const e of state.log) console.log(formatEvent(e) + idSuffix(e));
    console.log("");
    console.log("--- Summary ---");
    console.log(`Winner: ${state.winner}  Turns: ${state.turnNumber}  Moves: ${movesPlayed}`);
    console.log(`Final health: p1 ${state.players.p1.health}, p2 ${state.players.p2.health}`);
    const exploitIds = state.log.filter((e) => e.type === "play" && e.card === "Propagating Exploit").map((e) => (e as { instanceId?: string }).instanceId);
    console.log(`Propagating Exploit instances: ${exploitIds.join(", ")}`);
    return;
  }
  console.log(`No seed in 1-${maxSeed} showed all four moments; raise maxSeed.`);
  process.exitCode = 1;
}

await main();
