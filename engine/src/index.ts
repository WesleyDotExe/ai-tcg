// Public surface of @ai-tcg/engine, for consumers outside this package
// (currently: @ai-tcg/server, which drives real matches over the network).
// Reference agent *clients* (agents/) deliberately do NOT import this barrel
// — they speak the wire protocol only, proving the process boundary is real.

export type { Card, UnitCard, CommandCard, DirectiveCard, ToolCard, Ability, Speed, Rarity, DeckFaction } from "./cards/types.js";
export type {
  GameState,
  PlayerState,
  PlayerId,
  UnitInstance,
  DirectiveInstance,
  StackItem,
  GameEvent,
  GameOverCause,
  SignatureZone,
  MatchRules,
} from "./state/types.js";
export { otherPlayer, isShippedRules } from "./state/types.js";
export type { DeckSpec } from "./state/init.js";
export { createInitialState, MAX_ENERGY_CAP, STARTING_HEALTH, TURN_CAP, BOARD_SLOTS, SIGNATURE_REPLAY_SURCHARGE } from "./state/init.js";
export { signatureCost, currentAttack, currentHealth, currentMaxHealth } from "./state/queries.js";
export { Rng } from "./state/rng.js";

export type { TargetRef } from "./effects/targeting.js";
export type { Move } from "./engine/moves.js";
export { getLegalMoves } from "./engine/moves.js";
export { applyMove, beginTurn } from "./engine/engine.js";
export { runMatch, replayMatch, type MatchResult, type MatchHooks } from "./engine/match.js";
// The first-seat fixes under measurement (session 68): for the measuring
// instruments (the server's ladder split), not for any match the game plays.
export { SEAT_VARIANTS, seatVariant, type SeatVariant } from "./dev/seatVariants.js";

export type { Agent, PlayerView } from "./agents/agent.js";
export { buildPlayerView } from "./agents/agent.js";
export { RandomAgent } from "./agents/randomAgent.js";
export { AggressiveAgent } from "./agents/aggressiveAgent.js";
export { LookaheadAgent } from "./agents/lookaheadAgent.js";
export {
  PLAY_STYLES,
  PLAY_STYLE_IDS,
  DEFAULT_PLAY_STYLE,
  CALCULATOR_WEIGHTS,
  isPlayStyleId,
  playStyle,
  type PlayStyle,
  type PlayStyleId,
  type PlayStyleWeights,
} from "./agents/playStyles.js";

export {
  buildCortexDeck,
  buildSwarmDeck,
  buildAegisDeck,
  buildNullDeck,
  buildDeck,
  deckFaction,
  MAX_NEUTRAL_COPIES,
  COPY_LIMITS,
  TOP_TIER_COPY_LIMIT,
  withSetMythicSignature,
} from "./data/decks.js";
export { CARD_REGISTRY, SHIPPED_DECK_LISTS, getCard } from "./data/registry.js";
export {
  chooseDeck,
  buildFaction,
  constructDeck,
  deckSpec,
  holdingsOf,
  largestDeck,
  listProblem,
  playableCopies,
  playableHoldings,
  DECK_FACTIONS,
  DEFAULT_BUILD,
  type BuiltDeck,
  type DeckBuildOptions,
  type DeckList,
  type FactionBuild,
  type GauntletScore,
  type Holdings,
} from "./deckbuilder/deckBuilder.js";
export { cardRating } from "./deckbuilder/cardRating.js";
export { NEUTRAL_POOL } from "./data/neutralCards.js";
export {
  buildSignatureCard,
  signatureComboId,
  parseSignatureComboId,
  signatureFingerprint,
  signatureSpecProblem,
  legacySignatureAbilityId,
  upgradeSignatureAbilityId,
  type SignatureSpec,
  type SignatureTier,
} from "./data/signatureMenu.js";
export { APPROVED_SIGNATURE_LINES, type ApprovedSignatureLine } from "./data/signatureApproved.js";
export {
  generateAgentCandidates,
  generateSignatureCandidates,
  signatureCardFor,
  CANDIDATES_PER_PICK,
  type AgentCandidate,
  type SignatureCandidate,
  type TakenNames,
} from "./data/agentGenerator.js";
export {
  signatureCardName,
  drawSignatureCardName,
  agentName,
  drawAgentName,
  agentNameSpace,
  namingProblem,
  blockedWordIn,
  usernameHandle,
  signatureNameSpace,
  USERNAME_HANDLE_ODDS,
  MAX_NAME_LENGTH,
  AGENT_NAME_MAX_LENGTH,
  TEMPLATE_WEIGHTS,
  AGENT_TEMPLATE_WEIGHTS,
  type AgentTemplate,
} from "./data/signatureNames.js";

export { formatEvent, formatLog } from "./log/format.js";

// Versioned replays (session 70): the rules and card versions a match is
// played under, and the frozen cards an ai-tcg-replay/1 file reads.
export {
  RULES_VERSIONS,
  CURRENT_RULES_VERSION,
  rulesVersion,
  rulesOfVersion,
  CARDS_VERSIONS,
  CURRENT_CARDS_VERSION,
  CARDS_1_BY_ID,
  canonicalJson,
  digest,
  cardDigest,
  cardSetDigest,
  registryDigest,
  publishedCardsVersion,
  type RulesVersion,
  type CardsVersion,
} from "./engine/versions.js";
