// Public surface of @ai-tcg/economy: the persistent store (owners, the
// agents that play for them, the credits and pack-points ledger, owned
// copies, packs, decks, match history), the payout rule and the economy
// config.
// The engine knows nothing about this package; the server will call it to
// record matches (roadmap item 6b).

export {
  EconomyStore,
  EconomyError,
  DEFAULT_SEASON,
  PACK_PRICE_CREDITS,
  type OwnerRecord,
  type AgentRecord,
  type StarterGrant,
  type SalvageResult,
  type OwnerStats,
  type LedgerEntry,
  type CardCopy,
  type GrantCopyInput,
  type PackRecord,
  type RecordedOutcome,
  type RecordMatchInput,
  type MatchRecord,
  type PlayableDeck,
  type OpenOptions,
} from "./store.js";
export { matchCredits, winCredits, type DailyTally, type MatchResultForAgent } from "./payouts.js";
export {
  WIN_CREDITS,
  LOSS_CREDITS,
  MAX_PAID_LOSSES_PER_DAY,
  STARTER_PACKS,
  SALVAGE_PACK_POINTS,
  CRAFT_PACK_POINTS,
} from "./config.js";
export {
  FINISHES,
  COPY_ORIGINS,
  BOUND_ORIGINS,
  OWNER_KINDS,
  SERIES_KINDS,
  PACK_SOURCES,
  CURRENCIES,
  MATCH_OUTCOMES,
  type Finish,
  type CopyOrigin,
  type OwnerKind,
  type SeriesKind,
  type PackSource,
  type Currency,
  type MatchOutcomeKind,
} from "./schema.js";
