import type { GameEvent } from "../state/types.js";

/** Renders the engine's structured event log as human-readable lines. This
 * is deliberately separate from the GameEvent data itself — the same log
 * will later feed the spectator client and the commentator agents, who
 * need the structured form, not this prose. */
export function formatEvent(event: GameEvent): string {
  switch (event.type) {
    case "turnStart":
      return `--- Turn ${event.turn} (${event.player}) ---`;
    case "turnEnd":
      return `[end of turn ${event.turn} for ${event.player}]`;
    case "draw":
      return `${event.player} draws ${event.card}`;
    case "fatigue":
      return `${event.player} has no cards left to draw and takes ${event.damage} fatigue damage`;
    case "play":
      return event.instanceId
        ? `${event.player} plays ${event.card} (${event.instanceId})`
        : `${event.player} plays ${event.card}`;
    case "abilityTrigger":
      return `  ability: ${event.source} — ${event.ability} (${event.trigger})`;
    case "damage":
      return `  ${event.source} deals ${event.amount} damage to ${event.target}${event.targetKind === "player" ? "" : " (unit)"}`;
    case "heal":
      return `  ${event.source} restores ${event.amount} health to ${event.target}`;
    case "buff":
      return `  ${event.source} grants ${event.target} +${event.attack}/+${event.health}`;
    case "statusApplied":
      return `  ${event.source} applies ${event.status} to ${event.target}`;
    case "barrierAbsorbed":
      return `  ${event.unit}'s Barrier absorbs the hit from ${event.source}`;
    case "death":
      return `  ${event.unit} (${event.controller}) dies`;
    case "attack":
      return `${event.attacker} attacks ${event.defender}${event.defenderKind === "player" ? " (face)" : ""}`;
    case "gainEnergy":
      return `  ${event.player} gains ${event.amount} energy from ${event.source}`;
    case "cast":
      return `${event.player} casts ${event.card} [${event.speed}] (goes on the stack)`;
    case "priorityPass":
      return `  ${event.player} passes priority`;
    case "stackResolve":
      return `>>> resolving: ${event.description}`;
    case "fizzle":
      return `  ${event.reason}`;
    case "telegraphPlaced":
      return `  ${event.unit} deploys, dormant — arms in ${event.armIn} of its controller's turn(s)`;
    case "telegraphArmed":
      return `  ${event.unit} arms`;
    case "evolve":
      return `  ${event.from} evolves into ${event.to}`;
    case "toolAttached":
      return `  ${event.tool} attaches to ${event.unit}`;
    case "attackRedirected":
      return `  ${event.source} redirects ${event.attacker}'s attack from ${event.from} to ${event.to}`;
    case "directiveDestroyed":
      return `  ${event.source} destroys ${event.directive} (${event.controller})`;
    case "gameOver":
      return `=== GAME OVER: ${event.winner === "draw" ? "draw" : `${event.winner} wins`} (${event.reason}) ===`;
  }
}

export function formatLog(events: GameEvent[]): string {
  return events.map(formatEvent).join("\n");
}
