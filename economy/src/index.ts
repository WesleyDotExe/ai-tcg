// Public surface of @ai-tcg/economy: the persistent store (agents, credits
// ledger, owned copies, packs, decks, match history) and the payout rule.
// The engine knows nothing about this package; the server will call it to
// record matches (roadmap item 6b).

export {
  EconomyStore,
  EconomyError,
  DEFAULT_SEASON,
  PACK_PRICE_CREDITS,
  type AgentRecord,
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
export { matchCredits, winCredits, LOSS_CREDITS, MAX_PAID_LOSSES_PER_DAY, type DailyTally, type MatchResultForAgent } from "./payouts.js";
export {
  FINISHES,
  COPY_SOURCES,
  SERIES_KINDS,
  PACK_SOURCES,
  CURRENCIES,
  MATCH_OUTCOMES,
  type Finish,
  type CopySource,
  type SeriesKind,
  type PackSource,
  type Currency,
  type MatchOutcomeKind,
} from "./schema.js";
