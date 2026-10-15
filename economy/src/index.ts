// Public surface of @ai-tcg/economy: the persistent store (owners, their
// Season 0 logins and sessions, the agents that play for them and which one
// is connected, live matches, the credits and pack-points ledger, owned
// copies, packs, decks, match history), the payout rule and the economy
// config.
// The engine knows nothing about this package; the server will call it to
// record matches (roadmap item 6b).

export {
  EconomyStore,
  EconomyError,
  SalvageNeedsConfirmation,
  salvageBlockReason,
  DEFAULT_SEASON,
  PACK_PRICE_CREDITS,
  type OwnerRecord,
  type AgentRecord,
  type AgentDraft,
  type GeneratedAgent,
  type SignatureCardRecord,
  type StarterGrant,
  type SalvageResult,
  type SalvagePlan,
  type CardHoldings,
  type DeckShortfall,
  type DeckStatus,
  type SignInResult,
  type SessionInfo,
  type LoginInput,
  type LiveMatch,
  type LiveSide,
  type HouseOwnerRow,
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
  PASSWORD_MIN_LENGTH,
  SCRYPT_COST,
  SESSION_DAYS,
  SIGN_IN_LOCKOUT,
} from "./config.js";
export { hashPassword, verifyPassword, needsRehash } from "./passwords.js";
export {
  FINISHES,
  COPY_ORIGINS,
  BOUND_ORIGINS,
  LOCKABLE_FACTIONS,
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
