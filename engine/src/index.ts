// Public surface of @ai-tcg/engine, for consumers outside this package
// (currently: @ai-tcg/server, which drives real matches over the network).
// Reference agent *clients* (agents/) deliberately do NOT import this barrel
// — they speak the wire protocol only, proving the process boundary is real.

export type { Card, UnitCard, CommandCard, DirectiveCard, ToolCard, Ability, Speed } from "./cards/types.js";
export type {
  GameState,
  PlayerState,
  PlayerId,
  UnitInstance,
  DirectiveInstance,
  StackItem,
  GameEvent,
} from "./state/types.js";
export { otherPlayer } from "./state/types.js";
export type { DeckSpec } from "./state/init.js";
export { createInitialState, MAX_ENERGY_CAP, STARTING_HEALTH, TURN_CAP, BOARD_SLOTS } from "./state/init.js";
export { Rng } from "./state/rng.js";

export type { TargetRef } from "./effects/targeting.js";
export type { Move } from "./engine/moves.js";
export { getLegalMoves } from "./engine/moves.js";
export { applyMove, beginTurn } from "./engine/engine.js";
export { runMatch, type MatchResult, type MatchHooks } from "./engine/match.js";

export type { Agent, PlayerView } from "./agents/agent.js";
export { buildPlayerView } from "./agents/agent.js";
export { RandomAgent } from "./agents/randomAgent.js";
export { AggressiveAgent } from "./agents/aggressiveAgent.js";

export { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildDeck, deckFaction, MAX_NEUTRAL_COPIES } from "./data/decks.js";
export { NEUTRAL_POOL } from "./data/neutralCards.js";

export { formatEvent, formatLog } from "./log/format.js";
