import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  buildDeck,
  chooseDeck,
  holdingsOf,
  largestDeck,
  playableHoldings,
  type DeckBuildOptions,
  type BuiltDeck,
  type Holdings,
  CARD_REGISTRY,
  deckFaction,
  agentName as generatedAgentName,
  Rng,
  generateAgentCandidates,
  generateSignatureCandidates,
  getCard,
  isBoosterCard,
  COPY_LIMITS,
  TOP_TIER_COPY_LIMIT,
  SHIPPED_DECK_LISTS,
  signatureCardFor,
  signatureFingerprint,
  DEFAULT_PLAY_STYLE,
  PLAY_STYLES,
  isPlayStyleId,
  type PlayStyleId,
  type AgentCandidate,
  type Card,
  type DeckFaction,
  type DeckSpec,
  type Rarity,
  type SignatureCandidate,
  type SignatureSpec,
  type UnitCard,
  builderRule,
  describeBuilderRule,
} from "@ai-tcg/engine";
import {
  AGENT_RENAME_PACK_POINTS,
  BULK_OPEN_COUNT,
  OWNER_DAILY_PACK_CAP,
  CRAFT_PACK_POINTS,
  LIVE_PACK_ODDS,
  PACK_POINTS_PER_PACK,
  PACK_PRICE_CREDITS,
  PASSWORD_MIN_LENGTH,
  SALVAGE_PACK_POINTS,
  SIGNATURE_ART_POOL_SIZE,
  SESSION_DAYS,
  SIGN_IN_LOCKOUT,
  SECRET_CRAFT_PACK_POINTS,
  STARTER_PACKS,
  LADDER_LIST_SIZE,
  STATS_CHART_DAYS_DEFAULT,
  STATS_CHART_DAYS_MAX,
  STATS_RECENT_DEFAULT,
  STATS_RECENT_MAX,
  LADDER_TIERS,
  PLACEMENT_MATCHES,
  SEASON_RESET_PULL,
  SEASON_RESET_RD,
  AUTO_PLAY_START_MINUTES,
  AUTO_PLAY_ADD_MINUTES,
} from "./config.js";
import { idle, rateMatch, RATING_START, type Glicko2Rating } from "./glicko2.js";

import { customAgentNameProblem, nameKey, tidyAgentName } from "./agentNames.js";
import {
  accountSettingsProblem,
  applyAccountSettingsPatch,
  DEFAULT_ACCOUNT_SETTINGS,
  type AccountSettings,
  type AccountSettingsPatch,
  type Background,
  type Theme,
} from "./accountSettings.js";
import { dummyHash, hashPassword, needsRehash, verifyPassword } from "./passwords.js";
import { CARD_SETS, FULL_ART_OR_BETTER, nextPity, rollPack, seasonSets, secretCardOf, type PackSlot, type PityState } from "./packs.js";
import type { SecretCard } from "./chase.js";
import {
  CLOSE_WIN_HEALTH,
  COSMETICS,
  KIND_LABEL,
  LOADOUT_SLOTS,
  SLOT_KIND,
  STARTER_BOASTS,
  STARTER_COIN,
  SEASON_REWARD_TIERS,
  tierCoinsFor,
  type SeasonRewardTier,
  catalogueProblem,
  onSale,
  type CosmeticItem,
  type CosmeticKind,
  type LoadoutSlot,
} from "./cosmetics.js";
import { matchCredits, MAX_PAID_LOSSES_PER_DAY, WIN_SCHEDULE, type DailyTally, type MatchResultForAgent } from "./payouts.js";
import { resetDayOf } from "./dailyReset.js";
import { ratingChart, tallyMatches, type RatedPoint, type RatingChartDay, type StatsMatchRow, type StatsResult, type StatsTallies } from "./stats.js";
import { dailyPacksWaiting } from "./dailyPack.js";
import {
  NOTIFICATION_KINDS,
  NOTIFICATION_PAGE_MAX,
  NOTIFICATION_SWITCH,
  type MatchResultNotice,
  type Notification,
  type NotificationBody,
  type NotificationKind,
  type NotificationPage,
} from "./notifications.js";
import { boardLayoutProblem, boardWidgets, RECOMMENDED_LAYOUT, type BoardLayout, type Widget } from "./boardLayout.js";
import {
  BOUND_ORIGINS,
  COPY_ORIGINS,
  FINISHES,
  LOCKABLE_FACTIONS,
  MIGRATIONS,
  OWNER_KINDS,
  SECRET_FINISHES,
  PACK_SOURCES,
  SERIES_KINDS,
  SIGNATURE_ORIGIN_REF_PREFIX,
  type CopyOrigin,
  type Currency,
  type Finish,
  type MatchOutcomeKind,
  type OwnerKind,
  type PackSource,
  type SeriesKind,
} from "./schema.js";

/** A signature card's art reference: its slot in its season's pool. Still a
 * placeholder (the image arrives with the late art pass), but it already
 * names the piece the card will show. */
function ledgerEntryOf(r: Row): LedgerEntry {
  return {
    entryId: num(r.entry_id),
    ownerId: str(r.owner_id),
    playedBy: strOrNull(r.played_by),
    currency: str(r.currency) as Currency,
    delta: num(r.delta),
    reason: str(r.reason),
    ref: strOrNull(r.ref),
    createdAt: str(r.created_at),
  };
}

export function signatureArtRef(art: { pool: string; slot: number }): string {
  return `placeholder:signature-pool/${art.pool}/${String(art.slot).padStart(3, "0")}`;
}

/** True for an agent's signature card (schema.ts's SIGNATURE_ORIGIN_REF_PREFIX). */
function isSignatureRef(originRef: string | null | undefined): boolean {
  return originRef?.startsWith(SIGNATURE_ORIGIN_REF_PREFIX) ?? false;
}

// Storage choice (ECONOMY.md, "Storage"): Node's built-in SQLite
// (`node:sqlite`, Node 22). One local file, no server, no native addon, no
// network. It gives real transactions, so a pack purchase debits credits and
// creates the pack together or not at all, and the integrity rules in
// schema.ts hold for any caller. This module is the only one in the repo
// that touches the database (owner 2026-10-05 storage item 1).
//
// Who owns what (schema v2, owner app spec 2026-10-05 section A): the owner,
// the human account, owns copies, credits, pack points, packs, decks and
// match stats, and every daily cap counts per owner. An agent is who played:
// it's kept on matches and on match-payout ledger rows, and it owns nothing
// but its signature card (schema v6): a generated Neutral Mythic, granted to
// its owner as a bound promo copy when the agent is generated.

/** Season 0 is the in-house season (owner 2026-10-04, C.11). A new season is
 * a new database file; the old file is the archive. */
export const DEFAULT_SEASON = "S0";

/** (v29) Each season's end time, as the owner set it (owner 2026-11-13:
 * Season 0 runs 5 to 26 Dec 2026 and ends at midnight Sydney at the end of
 * 26 Dec, 00:00 27 Dec AEDT = 13:00 UTC 26 Dec). `npm run season:setup`
 * writes it into a new season's file; a season not listed has no end time
 * until one is set. */
export const SEASON_END_TIMES: Readonly<Record<string, string>> = {
  S0: "2026-12-26T13:00:00.000Z",
};

export { PACK_PRICE_CREDITS };

export interface OwnerRecord {
  ownerId: string;
  name: string;
  kind: OwnerKind;
  /** Picked when the starter collection is granted; it only decides the
   * starter deck. */
  startingFaction: DeckFaction | null;
  starterGrantedAt: string | null;
  activeDeckId: string | null;
  /** The one agent playing for this owner right now, if any (owner app
   * spec B). Switching it changes only the signature card in play. */
  connectedAgentId: string | null;
  /** The owner's faction lock setting: the connected agent may only play a
   * deck of this faction. Null is the default, free. */
  factionLock: DeckFaction | null;
  /** Who picks the deck (schema v12): "agent", the connected agent plays
   * the deck it built from the owner's cards (`buildAgentDeck`), in the
   * faction lock if one is set; "forced", it plays the deck the owner made
   * active (`setActiveDeck`). New owners start on "agent". */
  deckChoice: DeckChoice;
  createdAt: string;
}

/** The owner's daily pack, for the Store and Packs widgets. */
export interface DailyPackStatus {
  /** The set a claim gives a pack of: the current season's. */
  setCode: string;
  /** Packs waiting to be claimed now, 0 to `cap`. */
  waiting: number;
  cap: number;
  /** Today's reset day and when it ends. */
  day: string;
  timeZone: string;
  resetsAt: string;
  /** When the next pack comes in; null while `cap` are waiting. */
  nextPackAt: string | null;
  claimedToday: number;
  lastClaimedAt: string | null;
}

export type DeckChoice = "agent" | "forced";

/** (v14) What the agent's deck was built from. */
export interface AgentDeckBuiltFrom {
  /** The play style it was measured in. */
  style: PlayStyleId;
  /** The faction lock it was built under (null: none). */
  factionLock: DeckFaction | null;
  /** `playableHoldingsFingerprint` of the cards held under that lock
   * (`holdingsFingerprint` for a deck built before session 55). */
  holdings: string;
  /** (v25) The builder's pick rule (the engine's `builderRule`: "plain" or
   * "keep-designed:<z>"); "plain" for a deck built before v25, when every
   * build used it. */
  rule: string;
}

function fingerprint(counts: Iterable<[string, number]>): string {
  const sorted = [...counts].sort(([a], [b]) => a.localeCompare(b));
  return createHash("sha256").update(sorted.map(([id, n]) => `${id}:${n}`).join(",")).digest("hex").slice(0, 16);
}

/** A fingerprint of the cards an owner holds (copies per card id; finishes
 * and which copy don't matter to the deck builder, and ids the engine
 * doesn't know are left out as the builder leaves them out). What an agent
 * deck built before session 55 recorded. */
export function holdingsFingerprint(cardIds: Iterable<string>): string {
  return fingerprint(holdingsOf(cardIds));
}

/** A fingerprint of only the cards the deck builder can use under a faction
 * lock (null: none): the lock's faction and Neutral cards, each counted up
 * to its deck limit (the engine's `playableHoldings`). A spare copy past a
 * card's limit, or a card of a faction the lock rules out, can't change the
 * agent's deck, so it doesn't ask for a rebuild (session 55). Prefixed "p:"
 * so it is never mistaken for an older `holdingsFingerprint`. */
export function playableHoldingsFingerprint(cardIds: Iterable<string>, factionLock: DeckFaction | null): string {
  return `p:${fingerprint(playableHoldings(holdingsOf(cardIds), factionLock ?? undefined))}`;
}

/** What plays the deck builder's games: the engine's `chooseDeck`, or a
 * caller's stand-in that runs the same function somewhere else (the
 * server's worker thread). */
export type DeckChooser = (holdings: Holdings, options: DeckBuildOptions) => Promise<BuiltDeck>;

/** The name of the deck the agent builds (one per owner, rebuilt in place). */
export const AGENT_DECK_NAME = "Agent's deck";

/** What `buildAgentDeck` did: the saved deck, the faction it picked, and
 * every faction it weighed (with its fresh-seed score when games ran). */
export interface AgentDeckBuild {
  deck: PlayableDeck;
  faction: DeckFaction;
  /** (v14) The play style every measuring game was played in: the
   * connected agent's, Calculator with none connected. */
  style: PlayStyleId;
  /** (v25) The builder's pick rule (the engine's `builderRule`). */
  rule: string;
  factions: {
    faction: DeckFaction;
    infeasible?: string;
    /** Fresh-seed win rate against the shipped decks, when games ran. */
    winRate?: number;
    /** Which deck the faction kept: a start ("rating", "designed") or the search's. */
    chosen?: string;
    starts?: { from: string; winRate?: number }[];
    kept: string[];
  }[];
}

export interface AgentRecord {
  agentId: string;
  ownerId: string;
  name: string;
  /** The generated one-line personality (null for an agent made by hand
   * with createAgent, e.g. before schema v6). */
  persona: string | null;
  /** (v13) How the agent plays: a preset of the engine's PLAY_STYLES,
   * Calculator by default. */
  playStyle: PlayStyleId;
  createdAt: string;
}

/** How an agent got a name (schema v9). */
export type AgentNameKind = "legacy" | "generated" | "custom" | "rename" | "forced";

/** One name an agent held (schema v9's agent_names log). */
export interface AgentNameEntry {
  entryNo: number;
  agentId: string;
  name: string;
  kind: AgentNameKind;
  /** Pack points the owner paid (renames only). */
  packPoints: number;
  /** Who named it: the owner, an admin for a forced rename, or null for a
   * name logged by the migration or the low-level createAgent. */
  byOwnerId: string | null;
  note: string | null;
  namedAt: string;
}

/** An agent's name as match history shows it (owner 2026-10-16: "old names
 * stay visible in match history"). A name an admin forced off is never
 * shown again, but stays reserved. */
export interface AgentNames {
  agentId: string;
  current: string;
  /** Earlier names, most recent first, without the ones forced off. */
  formerly: string[];
  history: AgentNameEntry[];
}

/** An agent's own signature card (schema v6). */
export interface SignatureCardRecord {
  agentId: string;
  cardId: string;
  /** The body + ability combination. Two agents may share one (owner
   * 2026-10-15, schema v7). */
  comboId: string;
  /** Its promo collector number, "PR-001". */
  collectorNumber: string;
  spec: SignatureSpec;
  /** The playable card, built from the menu data as it is now. */
  card: UnitCard;
  /** What the card did when it was approved and granted; `card` differs
   * only after an errata to the menu data. */
  fingerprint: string;
  /** Its piece of the season's art pool (schema v8, owner 2026-10-16),
   * drawn when the card was made and kept forever. The images arrive with
   * the late art pass; until then `card.art` names the slot and the render
   * draws its fallback. */
  art: { pool: string; slot: number } | null;
  createdAt: string;
}

/** "Generate a new agent" in progress (owner app spec B): 3 agents, then,
 * once one is picked, 3 signature cards for it. */
export interface AgentDraft {
  draftId: string;
  ownerId: string;
  agents: AgentCandidate[];
  picked: number | null;
  signatures: SignatureCandidate[] | null;
  createdAt: string;
}

export interface GeneratedAgent {
  agent: AgentRecord;
  signature: SignatureCardRecord;
  /** The bound promo copy now in the owner's collection. */
  copy: CardCopy;
}

export interface LedgerEntry {
  entryId: number;
  ownerId: string;
  /** The agent that played the match this entry pays for; null for owner
   * actions (a pack purchase, a salvage). */
  playedBy: string | null;
  currency: Currency;
  delta: number;
  reason: string;
  ref: string | null;
  createdAt: string;
}

export interface CardCopy {
  copyId: string;
  ownerId: string;
  cardId: string;
  finish: Finish;
  seriesKind: SeriesKind;
  seriesCode: string | null;
  serial: number | null;
  runSize: number | null;
  stamp: string | null;
  origin: CopyOrigin;
  originRef: string | null;
  /** Bound copies are played, never sold or salvaged (crafted and starter
   * copies, and an agent's signature card, always). */
  accountBound: boolean;
  acquiredAt: string;
  /** The secret card a secret or Zero-Day copy is ("S0-SR07", "S0-ZD2");
   * null on every other copy (schema v10). */
  secretCode: string | null;
}

/** (v28) One change of a copy's owner, from copy_transfers. */
export interface CopyTransfer {
  transferId: number;
  copyId: string;
  fromOwnerId: string;
  toOwnerId: string;
  kind: string;
  ref: string | null;
  at: string;
}

/** (v28, marketplace groundwork) Where one copy came from and every owner
 * it has had, read from the records the store keeps: the copy row, the pack
 * and its opening, the pack-points ledger row of a craft, and the transfer
 * record. */
export interface CopyProvenance {
  copy: CardCopy & { disposedAt: string | null; disposedReason: string | null };
  source:
    | { kind: "pack"; packId: string; packSource: PackSource; setCode: string; packAcquiredAt: string; openedAt: string; oddsVersion: string; seed: number }
    | { kind: "crafted"; ledgerEntryId: number; reason: string; packPoints: number }
    | { kind: "starter"; faction: string }
    | { kind: "signature"; agentId: string }
    | { kind: "other"; origin: CopyOrigin; originRef: string | null };
  /** The first owner: the first transfer's from-owner, or the holder now. */
  firstOwnerId: string;
  /** Every owner in order, oldest first; the last is the holder now
   * (`until` null). `via` is the transfer that brought the copy to that
   * owner (null for the first). */
  owners: { ownerId: string; from: string; until: string | null; via: CopyTransfer | null }[];
  /** False for a bound copy: it never changes owner. */
  transferable: boolean;
}

export interface GrantCopyInput {
  ownerId: string;
  cardId: string;
  finish?: Finish;
  seriesKind?: SeriesKind;
  seriesCode?: string | null;
  serial?: number | null;
  runSize?: number | null;
  stamp?: string | null;
  origin: CopyOrigin;
  originRef?: string | null;
  /** Only needed to bind a copy whose origin isn't bound by rule. Crafted
   * and starter copies, and a signature card (originRef "signature:..."),
   * are bound whatever this says. */
  accountBound?: boolean;
  /** Required on a secret or Zero-Day copy, refused on any other. */
  secretCode?: string | null;
}

export interface PackRecord {
  packId: string;
  ownerId: string;
  setCode: string;
  source: PackSource;
  acquiredAt: string;
  openedAt: string | null;
}

/** One card revealed from a pack, as the pack-result screen shows it. */
export interface OpenedCard {
  copyId: string;
  cardId: string;
  name: string;
  rarity: Rarity;
  slot: PackSlot;
  finish: Finish;
  /** "056/096", or a Gold copy's number above the set total. */
  collectorNumber: string;
  /** A Prototype's run and serial ("S0-P07", 12 of 100). */
  prototype: { runCode: string; serial: number; runSize: number } | null;
  /** A secret card's entry: its code, kind, art slot, and whether it moves
   * (Zero-Day). Null on every other card. */
  secret: Pick<SecretCard, "code" | "kind" | "art" | "animated"> | null;
  /** The owner held nothing of this card's collection entry before this
   * pack: for most cards, no copy of the card; for a secret card, no copy
   * of that secret card; for a Glitch card, no Glitch copy of it. */
  isNew: boolean;
  /** Copies of this card the owner holds after this pack ("x4 owned"). */
  ownedAfter: number;
}

/** A logged pack opening (ECONOMY.md "Packs"). The seed is revealed only
 * here, after the pack is open. */
export interface PackOpening {
  packId: string;
  ownerId: string;
  setCode: string;
  oddsVersion: string;
  seed: number;
  openedAt: string;
  jackpot: boolean;
  /** What the pity timers forced in this pack. */
  pity: { fullArt: boolean; mythic: boolean };
  /** A Prototype was due but every run was used up, so the bonus was Gold. */
  prototypeFallbackGold: boolean;
  /** The starter guarantee made this pack's shine slot a hit: it was the
   * owner's last starter pack and the others had none (owner 2026-10-19).
   * Known only once the pack is open; the pack never looks different. */
  starterHit: boolean;
  cards: OpenedCard[];
  packPoints: number;
  /** Gold, a Prototype, a secret card, a Zero-Day card or a Jackpot pack: a
   * bulk open still gives this pack its full reveal (owner 2026-10-05 and
   * 2026-10-16). */
  fullReveal: boolean;
}

/** A 10-pack bulk open: each pack is its own opening, plus the summary the
 * sped-up reveal ends on. */
export interface BulkOpening {
  packs: PackOpening[];
  summary: {
    cards: number;
    newCards: number;
    packPoints: number;
    byRarity: Record<Rarity, number>;
    byFinish: Partial<Record<Finish, number>>;
    /** The packs that keep their full reveal. */
    fullReveals: string[];
  };
}

/** The owner's pity timers, worked out from pack history. */
export interface PityStatus extends PityState {
  /** What the next pack is guaranteed. */
  next: { fullArt: boolean; mythic: boolean };
}

export type RecordedOutcome =
  | { kind: "win"; winnerAgentId: string }
  | { kind: "draw" }
  | { kind: "cancelled" }
  | { kind: "abandoned"; byAgentId: string };

export interface RecordMatchInput {
  matchId: string;
  seed: number;
  /** The agents that played. Each side's owner is read from its agent. */
  p1AgentId: string;
  p2AgentId: string;
  p1DeckId?: string | null;
  p2DeckId?: string | null;
  outcome: RecordedOutcome;
  turns?: number | null;
  moves?: number | null;
  /** ISO time the match ended. The reset day it falls in (midnight to
   * midnight Sydney time, owner 2026-11-01) is the "day" the daily win
   * schedule counts against. Defaults to the store's clock. */
  endedAt?: string;
  /** Each side's health when the match ended (schema v11). For a win it
   * decides the boast: the close-win boast plays when the winner ends on
   * CLOSE_WIN_HEALTH or less. Without it, a win plays the main boast. */
  finalHealth?: { p1: number; p2: number } | null;
}

/** An owned cosmetic (schema v11): account-bound, kept for good. */
export interface OwnedCosmetic {
  ownerId: string;
  itemId: string;
  kind: CosmeticKind;
  source: "starter" | "purchase" | "seasonReward";
  /** The credits payment, for a bought item. */
  ledgerEntryId: number | null;
  /** (v20) For a season reward, which one: "<season>:<tier>", e.g.
   * "S0:Platinum"; null otherwise. */
  rewardRef: string | null;
  acquiredAt: string;
  /** (v27) The season file it was carried over from, first; null for one
   * acquired in this file. */
  carriedFrom: string | null;
  /** The catalogue entry (null only if a later catalogue dropped it). */
  item: CosmeticItem | null;
}

/** What an agent has equipped, by slot: an item id, or null for an empty
 * slot (an empty boast slot plays the deck faction's starter boast). */
export type Loadout = Record<LoadoutSlot, string | null>;

/** Which boast played at the end of a won match (schema v11), so a replay
 * plays the same one. `slot` says why: the winner's main boast, its
 * close-win boast (it ended on CLOSE_WIN_HEALTH or less), or, with the
 * boast slot empty, the starter boast of the faction its deck played. */
export interface MatchBoast {
  agentId: string;
  itemId: string;
  slot: "boast" | "closeWinBoast" | "factionStarter";
  winnerHealth: number | null;
}

export interface MatchRecord {
  matchId: string;
  seed: number;
  p1OwnerId: string;
  p2OwnerId: string;
  p1AgentId: string;
  p2AgentId: string;
  p1DeckId: string | null;
  p2DeckId: string | null;
  outcome: MatchOutcomeKind;
  winnerOwnerId: string | null;
  /** The winning side's agent, derived from the side the winner owns. */
  winnerAgentId: string | null;
  abandonedByOwnerId: string | null;
  turns: number | null;
  moves: number | null;
  p1Credits: number;
  p2Credits: number;
  endedAt: string;
  /** Each side's loadout at match time (schema v11); null for a match
   * recorded before v11. */
  loadouts: { p1: Loadout; p2: Loadout } | null;
  /** The boast that played; null for a draw, a void match, a match from
   * before v11, or a win whose boast slot was empty and whose deck isn't
   * known (the render falls back to the winner's faction starter boast). */
  boast: MatchBoast | null;
  /** Each side's play style as the match started (schema v13); null for a
   * match recorded before v13 or one never started with startMatch. */
  playStyles: { p1: PlayStyleId; p2: PlayStyleId } | null;
  /** (v17) Each side's Glicko-2 change; null for a cancelled match (never
   * rated) or one recorded before v17. */
  ratings: { p1: RatingChange; p2: RatingChange } | null;
  /** (v20) Each side's owner's rating as the match started (a spectator's
   * default point of view is the higher-rated side's; owner 2026-11-02),
   * kept for every outcome, a cancel too; null for a match recorded before
   * v20. */
  ratingsAtStart: { p1: number; p2: number } | null;
  /** (v24) The faction each side's deck played; null on a side recorded
   * before v24 or without a deck. */
  factions: { p1: DeckFaction | null; p2: DeckFaction | null };
}

export interface PlayableDeck {
  deckId: string;
  name: string;
  /** The copy ids in deck order, so the copy played (a gold one, say) is the
   * one a spectator view can show. */
  copyIds: string[];
  /** The engine's deck, legal by the engine's own deck rules. */
  spec: DeckSpec;
}

export interface StarterGrant {
  copies: CardCopy[];
  packs: PackRecord[];
  /** (v11) The four free faction starter boasts. */
  cosmetics: OwnedCosmetic[];
}

/** A saved deck that uses more copies of a card than the owner would hold. */
export interface DeckShortfall {
  deckId: string;
  name: string;
  /** Copies of the card the deck uses. */
  uses: number;
  /** Copies the owner holds (after the salvage, in a salvage plan). */
  owned: number;
  /** True when it is the owner's active deck. */
  active: boolean;
}

/** What the card viewer shows for one card in the owner's collection
 * (owner 2026-10-07): how many are held, how many can be salvaged and for
 * how much, why the rest can't, and which saved decks use it. */
export interface CardHoldings {
  cardId: string;
  rarity: Rarity;
  owned: number;
  salvageable: number;
  packPointsEach: number;
  /** Every copy that can't be salvaged, grouped by the reason shown. */
  notSalvageable: { reason: string; count: number }[];
  decks: { deckId: string; name: string; uses: number; active: boolean }[];
  /** How many copies a deck can play (3 / 3 / 2 / 1 by rarity; a Zero-Day
   * card 1). Null for a signature card: it sits outside the deck and its
   * limits (owner 2026-11-02: the API is the one source, not config.ts). */
  copyLimit: number | null;
  /** Crafting one standard copy with pack points (craftCard): its price,
   * whether it can be crafted now, and if not, why (craftCard's own refusal
   * words). Null for a card never crafted this way: a signature card, and a
   * Zero-Day card (crafted as a secret card, `POST
   * /api/collection/secrets/:code/craft`). */
  craft: { packPoints: number; available: boolean; reason: string | null } | null;
}

export interface SalvagePlan {
  cardId: string;
  quantity: number;
  /** The copies that would go: unbound standard pack copies, those listed in
   * no saved deck first, newest first. */
  copies: CardCopy[];
  packPoints: number;
  ownedAfter: number;
  /** Saved decks that would be left using more copies than the owner holds.
   * The owner must confirm before these are salvaged below. */
  affectedDecks: DeckShortfall[];
}

export interface SalvageResult {
  copies: CardCopy[];
  packPoints: number;
  /** Decks the owner confirmed would become incomplete. */
  incompleteDecks: DeckShortfall[];
}

export interface DeckStatus {
  deckId: string;
  name: string;
  ownerId: string;
  active: boolean;
  /** False when the owner holds fewer copies of some card than the deck
   * uses (after a confirmed salvage, say). An incomplete deck can't be
   * played until the owner holds the copies again or edits the deck. */
  complete: boolean;
  missing: { cardId: string; uses: number; owned: number }[];
  cards: number;
  /** The faction the deck plays (owner 2026-11-02, for the loadout
   * picker): its one non-Neutral faction, or null when it has none or more
   * than one (no legal deck does). */
  faction: DeckFaction | null;
  /** The deck's list: each card id with its copies, in the order first
   * listed. */
  list: { cardId: string; copies: number }[];
}

/** A Season 0 sign-in session. The token is only ever returned here, once;
 * the store keeps its SHA-256. */
export interface SignInResult {
  token: string;
  ownerId: string;
  expiresAt: string;
}

export interface SessionInfo {
  ownerId: string;
  isAdmin: boolean;
  expiresAt: string;
}

/** The signed-in owner, as the website's account button and sidebar need
 * it (owner 2026-11-01, "who am I"). */
export interface WhoAmI {
  ownerId: string;
  /** The owner's display name (the account's name, not the login). */
  name: string;
  /** The login's username and email; null for an owner without a login. */
  username: string | null;
  email: string | null;
  kind: OwnerKind;
  /** The house admin sees Settings -> Admin (owner app spec C.9). */
  isAdmin: boolean;
}

/** The top bar's wallet (owner 2026-11-01): both balances, and the packs
 * waiting to be opened, oldest first (the Open button opens the first). */
export interface Wallet {
  credits: number;
  packPoints: number;
  unopenedPacks: PackRecord[];
}

/** One recent pack opening, as the Collection widget lists it. `held` is
 * false for a pulled copy since salvaged. */
export interface RecentPull {
  packId: string;
  setCode: string;
  openedAt: string;
  jackpot: boolean;
  cards: { copyId: string; cardId: string; name: string; rarity: Rarity; finish: Finish; secretCode: string | null; serial: number | null; held: boolean }[];
}

/** The Collection page's data (owner 2026-11-01). */
export interface CollectionSummary {
  copies: number;
  distinctCards: number;
  /** By card name. Each copy is listed (the owner holds every copy as its
   * own item), without the owner id. */
  cards: { cardId: string; name: string; rarity: Rarity; faction: string | null; owned: number; salvageable: number; copies: Omit<CardCopy, "ownerId">[] }[];
  /** Each set's completion, as `binder` counts it. */
  sets: {
    setCode: string;
    base: { held: number; total: number };
    secrets: { held: number; total: number };
    glitch: { held: number; total: number };
    gold: { held: number; total: number };
    prototypes: { runsHeld: number; runs: number; copiesHeld: number };
  }[];
  recentPulls: RecentPull[];
  /** The Promos tab (owner 2026-11-02): every signature card the owner's
   * agents hold, the connected agent's marked (the page greys out the rest,
   * owner app spec B), and every promo or prize copy earned. */
  promos: {
    signatureCards: {
      agentId: string;
      agentName: string;
      /** The agent playing now: its card is the one in the signature zone. */
      connected: boolean;
      cardId: string;
      name: string;
      collectorNumber: string;
      rarity: Rarity;
      faction: string | null;
      flavor: string | null;
      /** The card's art reference (a slot of the season's pool until the art pass). */
      art: string;
      /** The bound copy held; null only if it isn't in the collection. */
      copyId: string | null;
      createdAt: string;
    }[];
    /** Promo and prize copies other than signature cards, newest first. */
    earned: { copyId: string; cardId: string; name: string; rarity: Rarity; finish: Finish; origin: CopyOrigin; seriesCode: string | null; stamp: string | null; acquiredAt: string }[];
  };
}

/** Today's match earnings (owner 2026-11-01, the Daily rewards widget). */
export interface DailyEarnings {
  /** The reset day's date on the Sydney clock ("2026-11-02"). */
  day: string;
  timeZone: string;
  /** Its start, and the next reset (UTC ISO). */
  startedAt: string;
  resetsAt: string;
  /** The daily win schedule: wins fromWin..toWin (null: and after) pay
   * `credits` each. */
  schedule: { fromWin: number; toWin: number | null; credits: number }[];
  /** Every win today in the order it was recorded and paid (oldest first,
   * unless a clock stepped back), with what it paid (0 past the 10th). */
  wins: { nth: number; matchId: string; endedAt: string; credits: number }[];
  /** The wins that paid something: what the widget lists. */
  rewardedWins: { nth: number; matchId: string; endedAt: string; credits: number }[];
  /** Losses and draws today (a draw pays as a loss). */
  losses: number;
  maxPaidLosses: number;
  creditsFromWins: number;
  creditsFromLosses: number;
  credits: number;
  nextWinPays: number;
  nextLossPays: number;
}

export interface LoginInput {
  username: string;
  email?: string | null;
  password: string;
  isAdmin?: boolean;
}

export interface LiveSide {
  ownerId: string;
  agentId: string;
  deck: PlayableDeck;
  /** (v11) The agent's loadout as the match starts; it can't change until
   * the match is recorded. */
  loadout: Loadout;
  /** (v13) The agent's play style as the match starts. Changing it during
   * the match applies from the next one. */
  playStyle: PlayStyleId;
}

/** Why the server turned an owner's auto-play off: the day's rewards
 * maxed (v18), or its play-time allowance ran out (v22). */
export type AutoPlayStopReason = "dailyRewardsMaxed" | "timeUp";

/** Where a play-time allowance stands (owner 2026-11-06): (v29) waiting
 * for the agent's first pairing, the clock not started (owner 2026-11-13,
 * on session 93's dry run: the clock starts when the agent is first
 * paired); time left; time
 * up while the agent finishes the match it is in; or time's up (no match
 * left to finish: the agent isn't paired again). The wire value stays
 * "done"; what the owner reads is `AUTO_PLAY_ALLOWANCE_LABELS`. */
export type AutoPlayAllowanceState = "waiting" | "running" | "finishing" | "done";

/** What each allowance state reads as on the website (owner 2026-11-06,
 * on session 76: "Done for today" became "Time's up", since the owner can
 * start again the same day). Sent as `allowance.label`. */
export const AUTO_PLAY_ALLOWANCE_LABELS: Readonly<Record<AutoPlayAllowanceState, string>> = {
  waiting: "Waiting for the next round",
  running: "Running",
  finishing: "Finishing match",
  done: "Time's up",
};

/** The play-time allowance (schema v22): "give the agent X minutes". */
export interface AutoPlayAllowance {
  state: AutoPlayAllowanceState;
  /** The state as the owner reads it: "Running", "Finishing match" or
   * "Time's up". */
  label: string;
  /** The window the agent may be paired in: [startedAt, endsAt). (v29)
   * Both null while "waiting": the window opens at the agent's first
   * pairing. */
  startedAt: string | null;
  endsAt: string | null;
  /** The window's length in minutes (for the ring: left / total). Shorter
   * than the minutes chosen when the next midnight Sydney cut it. While
   * "waiting", the minutes chosen (the cut is worked out at the pairing). */
  totalMinutes: number;
  /** Time left, 0 once it is up. `minutesLeft` rounds up ("1 min left"
   * until the last second). */
  secondsLeft: number;
  minutesLeft: number;
  /** The window ends at midnight Sydney, where unused time is dropped: no
   * more time can be added today. */
  endsAtReset: boolean;
}

/** The auto-play switch as the website shows it (schema v18; the
 * allowance v22). */
export interface AutoPlayStatus {
  /** Whether the agent is queued round after round. False once an
   * allowance is done, even before the server has written the stop. */
  on: boolean;
  /** When the switch last changed; null if it never has. */
  changedAt: string | null;
  /** Set when the server turned it off today: why, and the Sydney day. */
  stopped: { reason: AutoPlayStopReason; day: string } | null;
  /** Today's rewards are maxed (the next win would pay nothing). */
  dailyRewardsMaxed: boolean;
  /** Whether the owner may turn it on now (not while maxed). */
  canTurnOn: boolean;
  /** The play-time allowance, or null: auto-play with no time limit (or
   * off). Shown until midnight Sydney once done. */
  allowance: AutoPlayAllowance | null;
  /** Whether +15 / +30 can be added now: an allowance running (and not
   * already ending at midnight) or finishing its last match. */
  canAddTime: boolean;
}

export interface LiveMatch {
  matchId: string;
  startedAt: string;
  p1: LiveSide;
  p2: LiveSide;
  /** (v20) Each side's owner's rating as the match started; null before
   * v20. */
  ratingsAtStart: { p1: number; p2: number } | null;
}

/** One house owner as the admin view shows it (owner app spec C.10). */
export interface HouseOwnerRow {
  owner: OwnerRecord;
  agents: AgentRecord[];
  connectedAgent: AgentRecord | null;
  credits: number;
  packPoints: number;
  copies: number;
  unopenedPacks: number;
  stats: OwnerStats;
  inLiveMatch: boolean;
}

/** The salvage refusal that needs the owner's say-so: it would leave saved
 * decks short. `affectedDecks` lists them for the warning. */
export class SalvageNeedsConfirmation extends Error {
  constructor(readonly affectedDecks: DeckShortfall[]) {
    super(
      `salvaging would leave ${affectedDecks.length} saved deck(s) short: ` +
        affectedDecks.map((d) => `"${d.name}" uses ${d.uses}, ${d.owned} left`).join("; ") +
        ". Confirm to salvage anyway; those decks are then incomplete until fixed",
    );
  }
}

/** Owner-level match stats (owner app spec, Stats page), optionally filtered
 * to the matches one agent played. Cancelled and abandoned matches count as
 * void: they neither win, lose, nor break a streak. */
export interface OwnerStats {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  void: number;
  /** wins / (wins + losses + draws), or 0 before any decided match. */
  winRate: number;
  bestWinStreak: number;
  creditsFromMatches: number;
}

/** One recent result on the Stats page and the Rating & form widget, in
 * the words of GET /api/matches' rows (the same `result` and `rating`), plus
 * both sides' factions. */
export interface StatsRecentResult {
  matchId: string;
  endedAt: string;
  result: "win" | "loss" | "draw" | "cancelled" | "abandonedByYou" | "abandonedByOpponent";
  /** The owner's agent that played, and the faction its deck played. */
  agentId: string;
  agentName: string;
  faction: DeckFaction | null;
  opponent: { ownerId: string; ownerName: string; agentId: string; agentName: string; faction: DeckFaction | null };
  credits: number;
  /** The owner's rating before and after; null when unrated (a cancel). */
  rating: { before: number; after: number; change: number } | null;
  turns: number | null;
}

/** The Stats page (session 78; see stats.ts for the counting rules). */
export interface StatsPage extends StatsTallies {
  ownerId: string;
  /** The agent filter: null is "All agents". */
  agentId: string | null;
  /** The filter's choices: every agent the owner has, oldest first, with
   * how many matches each has played (all time). */
  agents: { agentId: string; name: string; matches: number }[];
  recent: StatsRecentResult[];
  /** The owner's rating (not filtered by agent: the rating is the owner's). */
  rating: {
    now: OwnerRating;
    /** The rating at the end of the reset day 7 days before today; the
     * weekly trend is `now.rating - weekAgo`. */
    weekAgo: number;
    weekChange: number;
    /** One row per reset day, oldest first, ending today. */
    chart: RatingChartDay[];
  };
  /** Today's earnings, as GET /api/daily (the owner's, not filtered). */
  today: DailyEarnings;
}

export class EconomyError extends Error {}

/** A ladder tier name (config LADDER_TIERS), or "Placement" before an owner
 * has PLACEMENT_MATCHES rated matches. */
export type LadderTier = (typeof LADDER_TIERS)[number]["tier"] | "Placement";

/** The tier a rating shows, after placement. */
export function tierOf(rating: number, ratedMatches: number): LadderTier {
  if (ratedMatches < PLACEMENT_MATCHES) return "Placement";
  let tier: LadderTier = LADDER_TIERS[0].tier;
  for (const t of LADDER_TIERS) if (rating >= t.from) tier = t.tier;
  return tier;
}

/** An owner's Glicko-2 rating now (schema v17): the stored one with its RD
 * grown for each empty reset day since its last rated match, or the start
 * (1500 / 350 / 0.06) before any. */
export interface OwnerRating extends Glicko2Rating {
  ownerId: string;
  /** Rated matches: wins, losses, draws and abandons (not cancels). */
  ratedMatches: number;
  tier: LadderTier;
  /** The reset day of the last rated match, or null before one. */
  lastDay: string | null;
}

/** (v26) One owner's line in a season's final standings, frozen when the
 * season ended: the ladder as it stood then, names included (an owner or
 * agent renamed later keeps its season name here). */
export interface SeasonStanding {
  /** 1-based among placed owners; null for an owner still in placement. */
  rank: number | null;
  ownerId: string;
  ownerName: string;
  /** The connected agent's name at the end, or null with none connected. */
  agentName: string | null;
  rating: number;
  rd: number;
  volatility: number;
  ratedMatches: number;
  tier: LadderTier;
  wins: number;
  losses: number;
  draws: number;
  /** The tier coins this season gave the owner (item ids, lowest first). */
  tierCoins: string[];
}

/** (v26) A Prototype run as its season ended: how many copies were found,
 * and how many were never pulled and are retired forever. */
export interface RetiredPrototypeRun {
  runCode: string;
  setCode: string;
  cardId: string;
  runSize: number;
  found: number;
  retired: number;
  retiredAt: string;
}

/** (v29) A season's end time, set before it starts. */
export interface SeasonSchedule {
  endsAt: string;
  /** When it was set. */
  setAt: string;
}

/** (v26) A season's end, as `endSeason` wrote it. */
export interface SeasonEnd {
  season: string;
  endedAt: string;
  /** Placed owners by rank, then owners still in placement. */
  standings: SeasonStanding[];
  retiredPrototypes: RetiredPrototypeRun[];
}

/** (v27) Where a season's file came from, as `startNextSeason` wrote it:
 * null for a first season's file. */
export interface SeasonStart {
  season: string;
  fromSeason: string;
  fromEndedAt: string;
  startedAt: string;
}

/** (v27) What `startNextSeason` carried into the new file, by count. */
export interface NextSeasonReport extends SeasonStart {
  owners: number;
  logins: number;
  sessions: number;
  agents: number;
  signatureCopies: number;
  cosmetics: number;
  loadoutSlots: number;
  retiredPrototypeRuns: number;
  ratingSeeds: number;
  starterGrants: { ownerId: string; faction: DeckFaction; copies: number; packs: number }[];
  /** What the ended file held that starts empty, so it can be read off. */
  leftBehind: { cardCopies: number; unopenedPacks: number; decks: number; credits: number; packPoints: number; matches: number; notifications: number };
}

/** (v27) An owner's soft-reset rating in a new season's file. */
export interface RatingSeed {
  ownerId: string;
  rating: number;
  rd: number;
  volatility: number;
  finalRating: number;
  finalTier: string;
}

/** One side's rating change in a rated match (schema v17). */
export interface RatingChange {
  ownerId: string;
  score: 0 | 0.5 | 1;
  before: Glicko2Rating;
  after: Glicko2Rating;
}

/** One row of the ladder's standings. */
export interface LadderRow {
  /** 1-based, by rating, among placed owners; null while in placement. */
  rank: number | null;
  ownerId: string;
  ownerName: string;
  ownerKind: OwnerKind;
  /** The connected agent, who plays at the owner's rating. */
  agent: { agentId: string; name: string } | null;
  rating: number;
  rd: number;
  tier: LadderTier;
  ratedMatches: number;
  wins: number;
  losses: number;
  draws: number;
  lastDay: string | null;
}

/** One place in a set's binder. */
export interface BinderEntry {
  /** The number printed on the card ("056/096"; a Glitch entry keeps its
   * card's number and the render adds the glitch mark). */
  number: string;
  kind: "card" | "illustration" | "zeroDay" | "glitch" | "gold";
  /** The card a copy plays as (a Zero-Day card's id is its code). */
  cardId: string;
  secretCode: string | null;
  name: string;
  rarity: Rarity;
  /** Copies of this entry the owner holds now. */
  owned: number;
}

export interface BinderSection {
  title: string;
  /** Entries with at least one copy held, of `total` ("x/96"). */
  held: number;
  total: number;
  entries: BinderEntry[];
}

/** A set's binder and checklist for one owner (owner 2026-10-16 item 1). */
export interface Binder {
  setCode: string;
  base: BinderSection;
  secrets: BinderSection;
  glitch: BinderSection;
  gold: BinderSection;
  prototypes: { runCode: string; cardId: string; name: string; runSize: number; found: number; serialsHeld: number[] }[];
}

const FINISH_LABEL: Readonly<Record<Finish, string>> = {
  standard: "Standard",
  foil: "Foil",
  fullArt: "Full Art",
  altArt: "Alt Art",
  gold: "Gold",
  prototype: "Prototype",
  tournament: "Tournament",
  glitch: "Glitch",
  secret: "Secret illustration",
  zeroDay: "Zero-Day",
};

/** Finishes that keep a pack's full reveal in a bulk open: Gold and
 * Prototype (owner 2026-10-05), the secret cards and Zero-Day (owner
 * 2026-10-16: "the full-screen reveal, like Gold, Prototype and Jackpot").
 * Glitch, at about 1 pack in 25, does not. */
const FULL_REVEAL_FINISHES: readonly Finish[] = ["gold", "prototype", "secret", "zeroDay"];

/** The collection entry a copy fills: its secret card, its Glitch version,
 * or its card. */
function collectionEntryKey(copy: Pick<CardCopy, "cardId" | "finish" | "secretCode">): string {
  if (copy.secretCode !== null) return `secret:${copy.secretCode}`;
  if (copy.finish === "glitch") return `glitch:${copy.cardId}`;
  return `card:${copy.cardId}`;
}

/** Why a copy can't be salvaged, in the card viewer's words, or null when it
 * can (owner 2026-10-07: only unbound standard-finish pack copies salvage;
 * owner 2026-10-10: promo and prize copies can be sold, never salvaged). */
export function salvageBlockReason(copy: Pick<CardCopy, "accountBound" | "origin" | "finish" | "seriesKind">): string | null {
  if (copy.accountBound) return `Account-bound (${copy.origin} copy): it can be played, never salvaged`;
  if (copy.origin === "promo" || copy.origin === "prize") return `${copy.origin === "promo" ? "Promo" : "Prize"} copies can be kept or sold, never salvaged`;
  if (copy.finish !== "standard") return `${FINISH_LABEL[copy.finish]} copies are never salvaged`;
  if (copy.seriesKind !== "set" || copy.origin !== "pack") return `Only standard copies pulled from packs can be salvaged`;
  return null;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v !== "string") throw new EconomyError(`expected a string column, got ${typeof v}`);
  return v;
}
function strOrNull(v: unknown): string | null {
  return v === null || v === undefined ? null : str(v);
}
function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  throw new EconomyError(`expected a number column, got ${typeof v}`);
}
function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : num(v);
}

/** The card set a pack belongs to; refused for a set that doesn't exist. */
function knownSet(setCode: string) {
  const set = CARD_SETS.get(setCode);
  if (!set) throw new EconomyError(`no card set "${setCode}"`);
  return set;
}

/** A Zero-Day card's secret entry, by the card id its copies carry (its
 * code, "S0-ZD1"). Season 0's three are designed and live (in the engine's
 * registry, so getCard finds them); an entry whose card isn't designed yet
 * is a collection entry that can't be played or crafted. */
function zeroDayEntry(cardId: string): SecretCard | undefined {
  const s = secretCardOf(cardId);
  return s?.kind === "zeroDay" ? s : undefined;
}

/** A set card's or Zero-Day card's gameplay rarity (a Zero-Day card counts
 * as Mythic, owner 2026-10-18). */
function setCardRarity(cardId: string): Rarity | undefined {
  return getCard(cardId)?.rarity ?? zeroDayEntry(cardId)?.rarity;
}

/** Why a chase copy's card, finish and secret code don't fit together, or
 * null when they do (schema v10's CHECKs hold the rest). */
function chaseCopyProblem(cardId: string, finish: Finish, secretCode: string | null): string | null {
  if (SECRET_FINISHES.includes(finish)) {
    if (secretCode === null) return `a ${FINISH_LABEL[finish]} copy names its secret card`;
    const secret = secretCardOf(secretCode);
    if (!secret) return `no secret card "${secretCode}"`;
    if ((secret.kind === "zeroDay") !== (finish === "zeroDay")) return `"${secretCode}" is not a ${FINISH_LABEL[finish]} card`;
    if (secret.cardId !== cardId) return `"${secretCode}" is a version of ${secret.cardId}, not ${cardId}`;
    return null;
  }
  if (secretCode !== null) return `only secret and Zero-Day copies name a secret card`;
  // A Zero-Day card is in the registry like any card, but it is a secret
  // card: no plain, Foil, Gold or other version of it exists.
  if (zeroDayEntry(cardId)) return `"${cardId}" is a Zero-Day card; its only version is the Zero-Day finish`;
  if (finish === "glitch" && ![...CARD_SETS.values()].some((set) => set.glitch.includes(cardId))) return `"${cardId}" has no Glitch version`;
  // (session 97, owner 2026-11-14) A starter card, one of the 96 numbered
  // 001 to 096, is Standard only: its only copies come in a starter deck or
  // crafted. Every special version belongs to the booster cards.
  if (PACK_ONLY_FINISHES.includes(finish) && isStarterSetCard(cardId)) return `"${getCard(cardId)!.name}" is a starter card; starter cards are Standard only`;
  return null;
}

/** The versions a starter card never has (owner 2026-11-14: "no Foil, Full
 * Art, Glitch, Alt Art, secret illustration, Gold or Prototype copy of a
 * starter card"; and, answering game 97's call 6, "Standard only": a prize's
 * tournament finish on a starter card is not allowed either, so a starter
 * card given as a prize is a Standard copy). */
const PACK_ONLY_FINISHES: readonly Finish[] = ["foil", "fullArt", "glitch", "altArt", "secret", "gold", "prototype", "tournament"];

/** A Season 0 starter card: a base-set card that is not a booster card. */
function isStarterSetCard(cardId: string): boolean {
  const card = getCard(cardId);
  return card !== undefined && !card.topTier && !isBoosterCard(cardId) && [...CARD_SETS.values()].some((set) => set.cards.some((c) => c.cardId === cardId));
}

/** SQLite's own messages for the schema's RAISE(ABORT) rules and constraint
 * failures, rethrown as EconomyError so callers can tell a refused action
 * from a bug. */
function refused(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  throw new EconomyError(message);
}

export interface OpenOptions {
  /** The store's clock. Injected so tests and the demo are reproducible. */
  now?: () => Date;
  season?: string;
  /** Stop migrating at this schema version. Only for the migration tests,
   * which build an old file to upgrade; application code never sets it. */
  migrateTo?: number;
  /** The cosmetics catalogue (default: the shipped COSMETICS). Tests and
   * demos pass one with a season item for sale; it must still list the
   * four starter boasts. */
  cosmetics?: readonly CosmeticItem[];
}

export class EconomyStore {
  private readonly db: DatabaseSync;
  private readonly now: () => Date;
  private readonly catalogue: ReadonlyMap<string, CosmeticItem>;
  private inTransaction = false;

  private constructor(db: DatabaseSync, now: () => Date, catalogue: readonly CosmeticItem[]) {
    this.db = db;
    this.now = now;
    this.catalogue = new Map(catalogue.map((item) => [item.itemId, item]));
  }

  /** Opens (creating if needed) the database file at `path` and brings its
   * schema up to date. `":memory:"` gives a throwaway store for tests. */
  static open(path: string, options: OpenOptions = {}): EconomyStore {
    const catalogue = options.cosmetics ?? COSMETICS;
    const problem = catalogueProblem(catalogue);
    if (problem) throw new EconomyError(`bad cosmetics catalogue: ${problem}`);
    const db = new DatabaseSync(path);
    if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
    const store = new EconomyStore(db, options.now ?? (() => new Date()), catalogue);
    store.migrate(options.season ?? DEFAULT_SEASON, options.migrateTo ?? MIGRATIONS.length);
    db.exec("PRAGMA foreign_keys = ON;");
    return store;
  }

  /** (session 85) Opens an existing file for reading only: no file is
   * created, nothing is migrated, no pragma is written, and SQLite itself
   * refuses any write. The file's schema must be this code's; an older
   * file is read through `withCurrentSchemaCopy`. For an ended season's
   * archive, which must stay byte for byte as it was. */
  static openReadOnly(path: string, options: Pick<OpenOptions, "now" | "cosmetics"> = {}): EconomyStore {
    if (path === ":memory:" || !existsSync(path)) throw new EconomyError(`no season file at "${path}"`);
    const catalogue = options.cosmetics ?? COSMETICS;
    const problem = catalogueProblem(catalogue);
    if (problem) throw new EconomyError(`bad cosmetics catalogue: ${problem}`);
    const db = new DatabaseSync(path, { readOnly: true });
    const store = new EconomyStore(db, options.now ?? (() => new Date()), catalogue);
    const version = store.schemaVersion;
    if (version !== MIGRATIONS.length) {
      db.close();
      throw new EconomyError(`"${path}" is schema v${version}, this code reads v${MIGRATIONS.length} read-only`);
    }
    return store;
  }

  /** (session 85) What a season file is, read without opening it as a
   * store (no file created, nothing migrated or written): null when there
   * is no file at `path`. For a server deciding whether to start on it. */
  static peekSeasonFile(path: string): { schemaVersion: number; season: string | null; endedAt: string | null; startedFrom: string | null } | null {
    if (path === ":memory:" || !existsSync(path)) return null;
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      const has = (table: string) => db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !== undefined;
      const meta = (key: string) => (has("meta") ? ((db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as Row | undefined)?.value ?? null) : null);
      const end = has("season_end") ? (db.prepare("SELECT ended_at FROM season_end").get() as Row | undefined) : undefined;
      const from = has("season_start") ? (db.prepare("SELECT from_season FROM season_start").get() as Row | undefined) : undefined;
      return {
        schemaVersion: num((db.prepare("PRAGMA user_version").get() as Row).user_version),
        season: meta("season") === null ? null : str(meta("season")),
        endedAt: end ? str(end.ended_at) : null,
        startedFrom: from ? str(from.from_season) : null,
      };
    } finally {
      db.close();
    }
  }

  /** (session 85) Runs `read` on a path holding `path`'s contents at this
   * code's schema, never writing to `path`. A file already at this schema
   * is read where it is; an older one is copied (with its write-ahead log,
   * if a server was stopped before it checkpointed) into a temporary
   * directory, the copy is migrated, and the copy is removed afterwards. A
   * newer file is refused. */
  static withCurrentSchemaCopy<T>(path: string, read: (path: string) => T): T {
    if (path === ":memory:" || !existsSync(path)) throw new EconomyError(`no season file at "${path}"`);
    const probe = new DatabaseSync(path, { readOnly: true });
    let version: number;
    try {
      version = num((probe.prepare("PRAGMA user_version").get() as Row).user_version);
    } finally {
      probe.close();
    }
    if (version > MIGRATIONS.length) throw new EconomyError(`database schema v${version} is newer than this code (v${MIGRATIONS.length})`);
    if (version === MIGRATIONS.length) return read(path);
    const dir = mkdtempSync(join(tmpdir(), "ai-tcg-archive-"));
    try {
      const copy = join(dir, "archive.db");
      copyFileSync(path, copy);
      if (existsSync(`${path}-wal`)) copyFileSync(`${path}-wal`, `${copy}-wal`);
      EconomyStore.open(copy).close();
      return read(copy);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  close(): void {
    this.db.close();
  }

  /** Runs each pending migration in its own transaction. Foreign keys are
   * off while it runs (a migration that rebuilds a table has to, and SQLite
   * only lets that change outside a transaction) and checked in full before
   * each commit, so a migration that would leave a dangling reference rolls
   * back instead. */
  private migrate(season: string, target: number): void {
    const version = this.schemaVersion;
    if (version > MIGRATIONS.length) {
      throw new EconomyError(`database schema v${version} is newer than this code (v${MIGRATIONS.length})`);
    }
    this.db.exec("PRAGMA foreign_keys = OFF;");
    for (let v = version; v < target; v++) {
      this.transaction(() => {
        this.db.exec(MIGRATIONS[v]!);
        const dangling = this.db.prepare("PRAGMA foreign_key_check").all() as Row[];
        if (dangling.length > 0) {
          throw new EconomyError(`migration ${v + 1} would leave ${dangling.length} dangling reference(s), e.g. in ${String(dangling[0]!.table)}`);
        }
        this.db.exec(`PRAGMA user_version = ${v + 1}`);
      });
    }
    if (version === 0) {
      this.db.prepare("INSERT INTO meta (key, value) VALUES ('season', ?), ('created_at', ?)").run(season, this.stamp());
    }
  }

  get schemaVersion(): number {
    return num((this.db.prepare("PRAGMA user_version").get() as Row).user_version);
  }

  get season(): string {
    return str((this.db.prepare("SELECT value FROM meta WHERE key = 'season'").get() as Row).value);
  }

  /** (v27) The set a season's packs come from (daily packs, starter packs,
   * the house agents' shopping): the season's own set, or the newest set
   * while the season has none of its own yet (a Season 1 file before the
   * Season 1 set ships keeps selling the newest one; owner 6A: every set's
   * packs stay openable). */
  get currentSetCode(): string {
    return seasonSets(this.season)[0]?.code ?? [...CARD_SETS.keys()].at(-1)!;
  }

  private stamp(): string {
    return this.now().toISOString();
  }

  /** Runs `fn` in one write transaction: everything or nothing. Nested calls
   * join the outer transaction. */
  private transaction<T>(fn: () => T): T {
    if (this.inTransaction) return fn();
    this.db.exec("BEGIN IMMEDIATE");
    this.inTransaction = true;
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    } finally {
      this.inTransaction = false;
    }
  }

  // ---- owners ----

  /** A new owner account. It starts with nothing: the starter collection is
   * a separate, once-only grant (`grantStarterCollection`). */
  createOwner(input: { name: string; kind?: OwnerKind }): OwnerRecord {
    const owner: OwnerRecord = {
      ownerId: randomUUID(),
      name: input.name,
      kind: input.kind ?? "player",
      startingFaction: null,
      starterGrantedAt: null,
      activeDeckId: null,
      connectedAgentId: null,
      factionLock: null,
      deckChoice: "agent",
      createdAt: this.stamp(),
    };
    if (!OWNER_KINDS.includes(owner.kind)) throw new EconomyError(`unknown owner kind "${owner.kind}"`);
    try {
      this.db
        .prepare("INSERT INTO owners (owner_id, name, kind, created_at) VALUES (?, ?, ?, ?)")
        .run(owner.ownerId, owner.name, owner.kind, owner.createdAt);
    } catch (err) {
      refused(err);
    }
    return owner;
  }

  getOwner(ownerId: string): OwnerRecord {
    const row = this.db.prepare("SELECT * FROM owners WHERE owner_id = ?").get(ownerId) as Row | undefined;
    if (!row) throw new EconomyError(`no owner "${ownerId}"`);
    return this.ownerFromRow(row);
  }

  listOwners(): OwnerRecord[] {
    return (this.db.prepare("SELECT * FROM owners ORDER BY created_at, name").all() as Row[]).map((r) => this.ownerFromRow(r));
  }

  private ownerFromRow(row: Row): OwnerRecord {
    return {
      ownerId: str(row.owner_id),
      name: str(row.name),
      kind: str(row.kind) as OwnerKind,
      startingFaction: strOrNull(row.starting_faction) as DeckFaction | null,
      starterGrantedAt: strOrNull(row.starter_granted_at),
      activeDeckId: strOrNull(row.active_deck_id),
      connectedAgentId: strOrNull(row.connected_agent_id),
      factionLock: strOrNull(row.faction_lock) as DeckFaction | null,
      // A file older than v12 (only the migration tests open one) has no
      // deck choice: its active deck was always picked by hand.
      deckChoice: (strOrNull(row.deck_choice) ?? "forced") as DeckChoice,
      createdAt: str(row.created_at),
    };
  }

  /** The starter collection, once per owner (owner app spec A): the
   * faction's fixed starter deck (the shipped deck, owner 2026-10-05) as
   * account-bound copies, plus 3 packs. Refused, with nothing granted, if
   * the owner already had it. A new agent gets nothing from this. */
  grantStarterCollection(ownerId: string, faction: DeckFaction, setCode = DEFAULT_SEASON): StarterGrant {
    this.refuseIfEnded("no starter collection is granted");
    const list = SHIPPED_DECK_LISTS[faction];
    if (!list) throw new EconomyError(`no starter deck for faction "${faction}"`);
    return this.transaction(() => {
      const at = this.stamp();
      const changed = this.db
        .prepare("UPDATE owners SET starting_faction = ?, starter_granted_at = ? WHERE owner_id = ? AND starter_granted_at IS NULL")
        .run(faction, at, ownerId);
      if (num(changed.changes) === 0) {
        const owner = this.getOwner(ownerId);
        throw new EconomyError(`owner "${owner.name}" already has its starter collection (${owner.startingFaction}, ${owner.starterGrantedAt})`);
      }
      const copies = list.flatMap(({ cardId, copies: n }) =>
        Array.from({ length: n }, () => this.grantCopy({ ownerId, cardId, origin: "starter", originRef: `starter:${faction}` })),
      );
      const packs = Array.from({ length: STARTER_PACKS }, () => this.grantPack(ownerId, setCode, "starter"));
      return { copies, packs, cosmetics: this.grantStarterCosmetics(ownerId, at) };
    });
  }

  // ---- accounts: Season 0 sign-in (owner app spec C.1) ----
  //
  // Self-contained: scrypt from node:crypto, sessions in this file, no
  // external identity service. Passwords and tokens are never stored, only
  // their hashes. Owner kinds don't matter here: a house owner can have a
  // login too, but needn't.

  /** A new owner account with its login, in one transaction (the title
   * screen's "create account"). */
  createAccount(input: LoginInput & { name: string; kind?: OwnerKind }): OwnerRecord {
    return this.transaction(() => {
      const owner = this.createOwner({ name: input.name, kind: input.kind });
      this.addLogin(owner.ownerId, input);
      return owner;
    });
  }

  /** Gives an existing owner a login. One per owner. */
  addLogin(ownerId: string, input: LoginInput): void {
    const username = input.username.trim();
    const email = input.email?.trim() || null;
    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
      throw new EconomyError("a username is 3 to 32 letters, digits, dots, dashes or underscores");
    }
    if (email !== null && !/^[^@\s]+@[^@\s]+$/.test(email)) throw new EconomyError("that email address doesn't look right");
    this.checkPassword(input.password);
    const at = this.stamp();
    try {
      this.db
        .prepare(
          `INSERT INTO logins (owner_id, username, email, password_hash, is_admin, created_at, password_changed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(ownerId, username, email, hashPassword(input.password), input.isAdmin === true ? 1 : 0, at, at);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/UNIQUE.*logins\.owner_id/.test(message)) throw new EconomyError("this owner already has a login");
      if (/UNIQUE.*logins\.username/.test(message)) throw new EconomyError("that username is taken");
      if (/UNIQUE.*logins\.email/.test(message)) throw new EconomyError("that email address is already in use");
      refused(err);
    }
  }

  private checkPassword(password: string): void {
    if ([...password].length < PASSWORD_MIN_LENGTH) throw new EconomyError(`a password needs at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  /** The login matching a username or an email, either case. */
  private loginRow(login: string): Row | undefined {
    const l = login.trim();
    return this.db.prepare("SELECT * FROM logins WHERE username = ? OR email = ?").get(l, l) as Row | undefined;
  }

  /** Signs in with a username or email and a password, and returns a new
   * session token (shown once; the store keeps only its hash). A wrong
   * password and an unknown login get the same message and cost the same
   * scrypt time. After SIGN_IN_LOCKOUT.failures failures in the window, the
   * login is refused until the window passes, right password or not. */
  signIn(login: string, password: string): SignInResult {
    const row = this.loginRow(login);
    // Failures are counted per account when the login names one, so typing
    // the username one time and the email the next doesn't double the tries.
    const failureKey = row ? `owner:${str(row.owner_id)}` : `login:${login.trim().toLowerCase()}`;
    const now = this.now();
    const windowStart = new Date(now.getTime() - SIGN_IN_LOCKOUT.windowMinutes * 60_000).toISOString();
    const recent = num(
      (this.db.prepare("SELECT COUNT(*) AS n FROM sign_in_failures WHERE login = ? AND at > ?").get(failureKey, windowStart) as Row).n,
    );
    if (recent >= SIGN_IN_LOCKOUT.failures) {
      throw new EconomyError(`too many failed sign-ins; try again in ${SIGN_IN_LOCKOUT.windowMinutes} minutes`);
    }
    const ok = verifyPassword(password, row ? str(row.password_hash) : dummyHash()) && row !== undefined;
    if (!ok) {
      this.db.prepare("INSERT INTO sign_in_failures (login, at) VALUES (?, ?)").run(failureKey, now.toISOString());
      throw new EconomyError("wrong login or password");
    }
    const ownerId = str(row.owner_id);
    return this.transaction(() => {
      this.db.prepare("DELETE FROM sign_in_failures WHERE login = ?").run(failureKey);
      if (needsRehash(str(row.password_hash))) {
        this.db.prepare("UPDATE logins SET password_hash = ? WHERE owner_id = ?").run(hashPassword(password), ownerId);
      }
      return this.openSession(ownerId);
    });
  }

  private openSession(ownerId: string): SignInResult {
    const token = randomBytes(32).toString("base64url");
    const createdAt = this.stamp();
    const expiresAt = new Date(this.now().getTime() + SESSION_DAYS * 86_400_000).toISOString();
    this.db
      .prepare("INSERT INTO sessions (token_hash, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(sha256(token), ownerId, createdAt, expiresAt);
    return { token, ownerId, expiresAt };
  }

  /** The owner a session token belongs to. Refused for an unknown, expired
   * or signed-out token. */
  authenticate(token: string): SessionInfo {
    const row = this.db
      .prepare(
        `SELECT s.owner_id, s.expires_at, s.revoked_at, COALESCE(l.is_admin, 0) AS is_admin
         FROM sessions s LEFT JOIN logins l ON l.owner_id = s.owner_id WHERE s.token_hash = ?`,
      )
      .get(sha256(token)) as Row | undefined;
    if (!row || row.revoked_at !== null || str(row.expires_at) <= this.stamp()) throw new EconomyError("not signed in");
    return { ownerId: str(row.owner_id), isAdmin: num(row.is_admin) === 1, expiresAt: str(row.expires_at) };
  }

  /** Settings → Account → Sign out: ends this session. */
  signOut(token: string): void {
    this.db.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").run(this.stamp(), sha256(token));
  }

  /** Changes the password after checking the current one, and signs out
   * every session the owner has. */
  changePassword(ownerId: string, current: string, next: string): void {
    const row = this.db.prepare("SELECT password_hash FROM logins WHERE owner_id = ?").get(ownerId) as Row | undefined;
    if (!row) throw new EconomyError("this owner has no login");
    if (!verifyPassword(current, str(row.password_hash))) throw new EconomyError("wrong password");
    this.checkPassword(next);
    this.transaction(() => {
      const at = this.stamp();
      this.db.prepare("UPDATE logins SET password_hash = ?, password_changed_at = ? WHERE owner_id = ?").run(hashPassword(next), at, ownerId);
      this.db.prepare("UPDATE sessions SET revoked_at = ? WHERE owner_id = ? AND revoked_at IS NULL").run(at, ownerId);
    });
  }

  /** Admin accounts see Settings → Admin (owner app spec C.9). */
  isAdmin(ownerId: string): boolean {
    const row = this.db.prepare("SELECT is_admin FROM logins WHERE owner_id = ?").get(ownerId) as Row | undefined;
    return row !== undefined && num(row.is_admin) === 1;
  }

  /** The signed-in owner: display name, login and whether they are the
   * admin (owner 2026-11-01, "who am I"). */
  whoAmI(ownerId: string): WhoAmI {
    const owner = this.getOwner(ownerId);
    const login = this.db.prepare("SELECT username, email, is_admin FROM logins WHERE owner_id = ?").get(ownerId) as Row | undefined;
    return {
      ownerId,
      name: owner.name,
      username: login ? str(login.username) : null,
      email: login ? strOrNull(login.email) : null,
      kind: owner.kind,
      isAdmin: login !== undefined && num(login.is_admin) === 1,
    };
  }

  // ---- account settings (schema v15; owner 2026-11-01) ----

  /** The owner's settings: the saved row, or the defaults when the owner
   * has never changed one. */
  accountSettings(ownerId: string): AccountSettings {
    this.getOwner(ownerId);
    const row = this.db.prepare("SELECT * FROM account_settings WHERE owner_id = ?").get(ownerId) as Row | undefined;
    if (!row) {
      const d = DEFAULT_ACCOUNT_SETTINGS;
      return {
        theme: d.theme,
        background: d.background,
        sound: { ...d.sound },
        music: { ...d.music },
        skipHintSeen: d.skipHintSeen,
        ask2xEveryMatch: d.ask2xEveryMatch,
        notifications: { ...d.notifications },
        updatedAt: null,
      };
    }
    return {
      theme: str(row.theme) as Theme,
      background: str(row.background) as Background,
      sound: { on: num(row.sound_on) === 1, volume: num(row.sound_volume) },
      music: { on: num(row.music_on) === 1, volume: num(row.music_volume) },
      skipHintSeen: num(row.skip_hint_seen) === 1,
      // Read before v21 (a store opened with migrateTo below 21) as off.
      ask2xEveryMatch: row.ask_2x_every_match === undefined ? false : num(row.ask_2x_every_match) === 1,
      // Read before v23 as all on (the default).
      notifications: {
        bigPulls: row.notify_big_pulls === undefined ? true : num(row.notify_big_pulls) === 1,
        matchResults: row.notify_match_results === undefined ? true : num(row.notify_match_results) === 1,
        dailyPack: row.notify_daily_pack === undefined ? true : num(row.notify_daily_pack) === 1,
      },
      updatedAt: str(row.updated_at),
    };
  }

  /** Changes some of the owner's settings and returns them all. Refused,
   * changing nothing, when any part of the patch is invalid
   * (`accountSettingsProblem`). An empty patch changes nothing and writes
   * nothing. */
  updateAccountSettings(ownerId: string, patch: AccountSettingsPatch): AccountSettings {
    const problem = accountSettingsProblem(patch);
    if (problem) throw new EconomyError(problem);
    if (Object.keys(patch).length === 0) return this.accountSettings(ownerId);
    return this.transaction(() => {
      const { updatedAt: _, ...current } = this.accountSettings(ownerId);
      const next = applyAccountSettingsPatch(current, patch);
      // A store held below v21 (migrateTo) has no 2× column, below v23 no
      // notification switches: those settings read as their defaults there.
      const v21 = this.schemaVersion >= 21;
      const v23 = this.schemaVersion >= 23;
      if (!v21 && patch.ask2xEveryMatch !== undefined) throw new EconomyError('"ask2xEveryMatch" needs schema v21');
      if (!v23 && patch.notifications !== undefined) throw new EconomyError('"notifications" needs schema v23');
      const cols: [string, number | string][] = [
        ["theme", next.theme],
        ["background", next.background],
        ["sound_on", next.sound.on ? 1 : 0],
        ["sound_volume", next.sound.volume],
        ["music_on", next.music.on ? 1 : 0],
        ["music_volume", next.music.volume],
        ["skip_hint_seen", next.skipHintSeen ? 1 : 0],
        ...(v21 ? ([["ask_2x_every_match", next.ask2xEveryMatch ? 1 : 0]] as [string, number][]) : []),
        ...(v23
          ? ([
              ["notify_big_pulls", next.notifications.bigPulls ? 1 : 0],
              ["notify_match_results", next.notifications.matchResults ? 1 : 0],
              ["notify_daily_pack", next.notifications.dailyPack ? 1 : 0],
            ] as [string, number][])
          : []),
        ["updated_at", this.stamp()],
      ];
      this.db
        .prepare(
          `INSERT INTO account_settings (owner_id, ${cols.map(([c]) => c).join(", ")}) VALUES (?, ${cols.map(() => "?").join(", ")})
           ON CONFLICT (owner_id) DO UPDATE SET ${cols.map(([c]) => `${c} = excluded.${c}`).join(", ")}`,
        )
        .run(ownerId, ...cols.map(([, v]) => v));
      return this.accountSettings(ownerId);
    });
  }

  // ---- notifications (schema v23; owner 2026-11-05 and 2026-11-06) ----

  /** Writes one notification for a player owner, in the caller's
   * transaction: nothing below v23, for a house owner, or when the owner's
   * switch for that kind is off. Writing the same (kind, ref) again does
   * nothing, so a source that fires twice tells the owner once. */
  private notify(ownerId: string, ref: string, body: NotificationBody, at: string): void {
    if (this.schemaVersion < 23) return;
    if (this.getOwner(ownerId).kind !== "player") return;
    const switchName = NOTIFICATION_SWITCH[body.kind];
    if (switchName !== null && !this.accountSettings(ownerId).notifications[switchName]) return;
    const { kind, ...rest } = body;
    this.db
      .prepare(
        `INSERT INTO notifications (owner_id, kind, ref, created_at, body_json) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (owner_id, kind, ref) DO NOTHING`,
      )
      .run(ownerId, kind, ref, at, JSON.stringify(rest));
  }

  /** The daily pack's notification for today, when a pack is waiting and
   * none was written today (nothing happens at midnight, so it is written
   * when the owner next looks). */
  private noteDailyPack(ownerId: string, at: string): void {
    if (this.schemaVersion < 23 || this.getOwner(ownerId).kind !== "player") return;
    const status = this.dailyPackStatus(ownerId, at);
    if (status.waiting < 1) return;
    const day = this.resetDay(at);
    const createdAt = this.getOwner(ownerId).createdAt;
    this.notify(
      ownerId,
      status.day,
      { kind: "dailyPack", dailyPack: { day: status.day, readySince: createdAt > day.startsAt ? createdAt : day.startsAt, waiting: status.waiting, cap: status.cap } },
      at,
    );
  }

  private notificationFromRow(r: Row): Notification {
    const kind = str(r.kind) as NotificationKind;
    return {
      notificationId: num(r.notification_id),
      kind,
      ...(JSON.parse(str(r.body_json)) as object),
      createdAt: str(r.created_at),
      readAt: strOrNull(r.read_at),
    } as Notification;
  }

  /** The owner's notifications, newest first, cleared ones left out: a page
   * of `limit`, older than `before` (a notificationId) when given, of one
   * `kind` when given. Also the unread counts (the bell's badge; per kind
   * for the feed's filters). Reading the page doesn't mark anything read.
   * A house owner, or a store below v23, has none. */
  notifications(ownerId: string, options: { limit?: number; before?: number | null; kind?: NotificationKind | null; at?: string } = {}): NotificationPage {
    this.getOwner(ownerId);
    const limit = options.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > NOTIFICATION_PAGE_MAX) throw new EconomyError(`a notifications page is 1 to ${NOTIFICATION_PAGE_MAX}`);
    const kind = options.kind ?? null;
    if (kind !== null && !(NOTIFICATION_KINDS as readonly string[]).includes(kind)) throw new EconomyError(`no notification kind "${kind}" (kinds: ${NOTIFICATION_KINDS.join(", ")})`);
    const unreadByKind = Object.fromEntries(NOTIFICATION_KINDS.map((k) => [k, 0])) as Record<NotificationKind, number>;
    if (this.schemaVersion < 23) return { notifications: [], more: false, unread: 0, unreadByKind };
    return this.transaction(() => {
      this.noteDailyPack(ownerId, options.at ?? this.stamp());
      const where = ["owner_id = ?", "cleared_at IS NULL"];
      const args: (string | number)[] = [ownerId];
      if (options.before != null) {
        where.push("notification_id < ?");
        args.push(options.before);
      }
      if (kind !== null) {
        where.push("kind = ?");
        args.push(kind);
      }
      const rows = this.db
        .prepare(`SELECT * FROM notifications WHERE ${where.join(" AND ")} ORDER BY notification_id DESC LIMIT ?`)
        .all(...args, limit + 1) as Row[];
      for (const r of this.db
        .prepare("SELECT kind, COUNT(*) AS n FROM notifications WHERE owner_id = ? AND cleared_at IS NULL AND read_at IS NULL GROUP BY kind")
        .all(ownerId) as Row[]) {
        unreadByKind[str(r.kind) as NotificationKind] = num(r.n);
      }
      return {
        notifications: rows.slice(0, limit).map((r) => this.notificationFromRow(r)),
        more: rows.length > limit,
        unread: Object.values(unreadByKind).reduce((a, b) => a + b, 0),
        unreadByKind,
      };
    });
  }

  /** The ids among `ids` that are this owner's and not cleared; refused,
   * changing nothing, when any isn't (another owner's reads as missing). */
  private ownNotifications(ownerId: string, ids: readonly number[]): number[] {
    for (const id of ids) {
      const row = this.db.prepare("SELECT owner_id, cleared_at FROM notifications WHERE notification_id = ?").get(id) as Row | undefined;
      if (!row || str(row.owner_id) !== ownerId || row.cleared_at != null) throw new EconomyError(`no notification ${id}`);
    }
    return [...new Set(ids)];
  }

  /** Marks notifications read: the ones named, or (with "all") every unread
   * one up to now. Already read ones stay as they were. Returns how many
   * were marked and the unread count after. */
  markNotificationsRead(ownerId: string, ids: readonly number[] | "all"): { marked: number; unread: number } {
    this.getOwner(ownerId);
    if (this.schemaVersion < 23) throw new EconomyError("notifications need schema v23");
    const at = this.stamp();
    return this.transaction(() => {
      let marked = 0;
      if (ids === "all") {
        marked = Number(this.db.prepare("UPDATE notifications SET read_at = ? WHERE owner_id = ? AND read_at IS NULL AND cleared_at IS NULL").run(at, ownerId).changes);
      } else {
        const mark = this.db.prepare("UPDATE notifications SET read_at = ? WHERE notification_id = ? AND read_at IS NULL");
        for (const id of this.ownNotifications(ownerId, ids)) marked += Number(mark.run(at, id).changes);
      }
      return { marked, unread: this.unreadNotifications(ownerId) };
    });
  }

  /** Clears notifications (they leave the feed for good, read if they
   * weren't): the ones named, or every one with "all". Returns how many
   * were cleared and the unread count after. */
  clearNotifications(ownerId: string, ids: readonly number[] | "all"): { cleared: number; unread: number } {
    this.getOwner(ownerId);
    if (this.schemaVersion < 23) throw new EconomyError("notifications need schema v23");
    const at = this.stamp();
    return this.transaction(() => {
      let cleared = 0;
      const clear = this.db.prepare("UPDATE notifications SET read_at = COALESCE(read_at, ?), cleared_at = ? WHERE notification_id = ? AND cleared_at IS NULL");
      const targets =
        ids === "all"
          ? (this.db.prepare("SELECT notification_id FROM notifications WHERE owner_id = ? AND cleared_at IS NULL").all(ownerId) as Row[]).map((r) => num(r.notification_id))
          : this.ownNotifications(ownerId, ids);
      for (const id of targets) cleared += Number(clear.run(at, at, id).changes);
      return { cleared, unread: this.unreadNotifications(ownerId) };
    });
  }

  private unreadNotifications(ownerId: string): number {
    return num((this.db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE owner_id = ? AND read_at IS NULL AND cleared_at IS NULL").get(ownerId) as Row).n);
  }

  /** A match's result from one owner's side, as its notification says it. */
  private matchResultNotice(record: MatchRecord, ownerId: string): MatchResultNotice {
    const seat = record.p1OwnerId === ownerId ? "p1" : "p2";
    const other = seat === "p1" ? "p2" : "p1";
    const result: MatchResultNotice["result"] =
      record.outcome === "win"
        ? record.winnerOwnerId === ownerId
          ? "win"
          : "loss"
        : record.outcome === "abandoned"
          ? record.abandonedByOwnerId === ownerId
            ? "abandonedByYou"
            : "abandonedByOpponent"
          : record.outcome;
    const change = record.ratings?.[seat] ?? null;
    const opponentOwner = this.getOwner(seat === "p1" ? record.p2OwnerId : record.p1OwnerId);
    const agentId = seat === "p1" ? record.p1AgentId : record.p2AgentId;
    return {
      matchId: record.matchId,
      result,
      agentId,
      agentName: this.getAgent(agentId).name,
      opponent: { ownerId: opponentOwner.ownerId, ownerName: opponentOwner.name, agentName: this.getAgent(other === "p1" ? record.p1AgentId : record.p2AgentId).name },
      credits: seat === "p1" ? record.p1Credits : record.p2Credits,
      rating: change === null ? null : { before: change.before.rating, after: change.after.rating, change: change.after.rating - change.before.rating },
      turns: record.turns,
    };
  }

  // ---- auto-play (schema v18; owner app spec 2026-10-05 E) ----
  // ---- the play-time allowance (schema v22; owner 2026-11-06) ----

  /** The owner's auto-play switch. Off until the owner turns it on. When
   * the server turned it off (the day's rewards maxed, or the allowance's
   * time up), `stopped` says why and on which Sydney day; for the rewards,
   * `canTurnOn` is false for the rest of that day.
   *
   * The allowance is worked out from the clock on every read: once its
   * time is up the owner is no longer queued (`autoPlayOwners`), the state
   * is "finishing" while a match is still live and "done" after, and the
   * switch reads off from then, whether or not the server has written the
   * stop yet (`stopAutoPlayIfTimeUp`). */
  autoPlay(ownerId: string, at: string = this.stamp()): AutoPlayStatus {
    this.getOwner(ownerId);
    const row = this.db.prepare("SELECT * FROM auto_play WHERE owner_id = ?").get(ownerId) as Row | undefined;
    const today = this.resetDay(at).day;
    const maxed = this.dailyEarnings(ownerId, at).nextWinPays === 0;
    if (!row) return { on: false, changedAt: null, stopped: null, dailyRewardsMaxed: maxed, canTurnOn: !maxed, allowance: null, canAddTime: false };
    let on = num(row.is_on) === 1;
    let stopped = row.stopped_reason == null ? null : { reason: str(row.stopped_reason) as AutoPlayStopReason, day: str(row.stopped_day) };
    let allowance: AutoPlayAllowance | null = null;
    // (v29) Chosen, the clock not started: it starts at the first pairing.
    if (row.allowance_waiting_minutes != null && on) {
      const minutes = num(row.allowance_waiting_minutes);
      allowance = {
        state: "waiting",
        label: AUTO_PLAY_ALLOWANCE_LABELS.waiting,
        startedAt: null,
        endsAt: null,
        totalMinutes: minutes,
        secondsLeft: minutes * 60,
        minutesLeft: minutes,
        endsAtReset: false,
      };
    }
    // Read before v22 (a store opened with migrateTo below 22) as none.
    else if (row.allowance_ends_at != null) {
      const startedAt = str(row.allowance_started_at);
      const endsAt = str(row.allowance_ends_at);
      const endsMs = Date.parse(endsAt);
      const leftMs = Math.max(0, endsMs - Date.parse(at));
      const endDay = this.allowanceDay(endsAt);
      let state: AutoPlayAllowanceState;
      if (!on) state = "done";
      else if (leftMs > 0) state = "running";
      else if (this.liveMatchOf(ownerId) !== null) state = "finishing";
      else {
        // Time up and nothing to finish: off, as the server will write it.
        state = "done";
        on = false;
        stopped = { reason: "timeUp", day: endDay.day };
      }
      // "Time's up" stands only on the day the time ran out; an
      // allowance still finishing its match past midnight shows until then.
      if (state !== "done" || endDay.day === today) {
        allowance = {
          state,
          label: AUTO_PLAY_ALLOWANCE_LABELS[state],
          startedAt,
          endsAt,
          totalMinutes: (endsMs - Date.parse(startedAt)) / 60_000,
          secondsLeft: Math.ceil(leftMs / 1000),
          minutesLeft: Math.ceil(leftMs / 60_000),
          endsAtReset: endsAt === endDay.endsAt,
        };
      }
    }
    const canAddTime =
      allowance !== null &&
      (allowance.state === "waiting" || allowance.state === "finishing" || (allowance.state === "running" && allowance.endsAt! < this.resetDay(at).endsAt));
    return {
      on,
      changedAt: str(row.changed_at),
      // The message stands only on the day it happened.
      stopped: stopped !== null && stopped.day === today ? stopped : null,
      dailyRewardsMaxed: maxed,
      canTurnOn: !maxed,
      allowance,
      canAddTime,
    };
  }

  /** The reset day an allowance's time ran out in: the day of its last
   * instant, so one ending at midnight belongs to the day before. */
  private allowanceDay(endsAt: string) {
    return this.resetDay(new Date(Date.parse(endsAt) - 1).toISOString());
  }

  /** The end of a window of `minutes` from `from`, cut at the next midnight
   * Sydney: unused time doesn't carry over. */
  private allowanceEnd(from: string, minutes: number): string {
    const end = new Date(Date.parse(from) + minutes * 60_000).toISOString();
    const reset = this.resetDay(from).endsAt;
    return end < reset ? end : reset;
  }

  /** Turns the owner's auto-play on or off. Turning it on is refused while
   * today's rewards are maxed (the switch would go off again at once; the
   * owner turns it back on another day). Turning it off never stops a
   * match already running: it only keeps the owner out of the next round.
   *
   * (v22) `minutes` (15, 30 or 60) turns it on with a play-time allowance
   * from now, cut at the next midnight Sydney (v29: from the agent's first
   * pairing, "waiting" until then); without it, auto-play has no
   * time limit, as before. Either way any earlier allowance is replaced, and
   * turning it off drops it. */
  setAutoPlay(ownerId: string, on: boolean, minutes?: number): AutoPlayStatus {
    const at = this.stamp();
    const owner = this.getOwner(ownerId);
    if (owner.kind === "house") throw new EconomyError("house owners always play; auto-play is for player owners");
    // (session 95; owner 2026-11-14, render 72's ask) No round starts once
    // the season has ended, so the switch doesn't go on; off still works.
    if (on) this.refuseIfEnded("auto-play doesn't go on");
    const v22 = this.schemaVersion >= 22;
    if (minutes !== undefined) {
      if (!on) throw new EconomyError("minutes go with turning auto-play on");
      if (!(AUTO_PLAY_START_MINUTES as readonly number[]).includes(minutes)) throw new EconomyError(`auto-play starts with ${AUTO_PLAY_START_MINUTES.join(", ")} minutes, or no time limit`);
      if (!v22) throw new EconomyError("the play-time allowance needs schema v22");
    }
    if (on && this.dailyEarnings(ownerId, at).nextWinPays === 0) {
      throw new EconomyError("today's rewards are maxed; auto-play can go back on after midnight Sydney");
    }
    // (v29) The clock starts at the agent's first pairing (startMatch).
    const v29 = this.schemaVersion >= 29;
    const window = minutes === undefined || v29 ? [null, null] : [at, this.allowanceEnd(at, minutes)];
    this.db
      .prepare(
        v29
          ? `INSERT INTO auto_play (owner_id, is_on, changed_at, stopped_reason, stopped_day, allowance_started_at, allowance_ends_at, allowance_waiting_minutes) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?)
             ON CONFLICT (owner_id) DO UPDATE SET is_on = excluded.is_on, changed_at = excluded.changed_at, stopped_reason = NULL, stopped_day = NULL,
               allowance_started_at = excluded.allowance_started_at, allowance_ends_at = excluded.allowance_ends_at, allowance_waiting_minutes = excluded.allowance_waiting_minutes`
          : v22
          ? `INSERT INTO auto_play (owner_id, is_on, changed_at, stopped_reason, stopped_day, allowance_started_at, allowance_ends_at) VALUES (?, ?, ?, NULL, NULL, ?, ?)
             ON CONFLICT (owner_id) DO UPDATE SET is_on = excluded.is_on, changed_at = excluded.changed_at, stopped_reason = NULL, stopped_day = NULL,
               allowance_started_at = excluded.allowance_started_at, allowance_ends_at = excluded.allowance_ends_at`
          : `INSERT INTO auto_play (owner_id, is_on, changed_at, stopped_reason, stopped_day) VALUES (?, ?, ?, NULL, NULL)
             ON CONFLICT (owner_id) DO UPDATE SET is_on = excluded.is_on, changed_at = excluded.changed_at, stopped_reason = NULL, stopped_day = NULL`,
      )
      .run(ownerId, on ? 1 : 0, at, ...(v22 ? window : []), ...(v29 ? [on && minutes !== undefined ? minutes : null] : []));
    return this.autoPlay(ownerId, at);
  }

  /** "+15 / +30" (v22): adds minutes to a running allowance, still cut at
   * the next midnight Sydney. While the agent finishes its last match
   * (time up), it opens a new window of that many minutes from now, so the
   * agent is paired again. (v29) While waiting for the first pairing, it
   * adds to the minutes chosen. Refused with no allowance (auto-play off, done
   * for today, or on with no time limit), and when the allowance already
   * runs to midnight. */
  addAutoPlayTime(ownerId: string, minutes: number): AutoPlayStatus {
    const at = this.stamp();
    const owner = this.getOwner(ownerId);
    if (owner.kind === "house") throw new EconomyError("house owners always play; auto-play is for player owners");
    if (!(AUTO_PLAY_ADD_MINUTES as readonly number[]).includes(minutes)) throw new EconomyError(`time is added ${AUTO_PLAY_ADD_MINUTES.join(" or ")} minutes at a time`);
    if (this.schemaVersion < 22) throw new EconomyError("the play-time allowance needs schema v22");
    this.refuseIfEnded("no play time is added");
    const status = this.autoPlay(ownerId, at);
    const a = status.allowance;
    if (a === null || a.state === "done") throw new EconomyError("auto-play isn't running on a time allowance; start it with 15, 30 or 60 minutes");
    if (!status.canAddTime) throw new EconomyError("the time already runs to midnight Sydney, when it resets; no more can go on today");
    if (a.state === "waiting") {
      // (v29) Not paired yet: the minutes go on the ones chosen.
      this.db.prepare("UPDATE auto_play SET allowance_waiting_minutes = allowance_waiting_minutes + ? WHERE owner_id = ?").run(minutes, ownerId);
      return this.autoPlay(ownerId, at);
    }
    const [startedAt, endsAt] = a.state === "running" ? [a.startedAt!, this.allowanceEnd(a.endsAt!, minutes)] : [at, this.allowanceEnd(at, minutes)];
    this.db.prepare("UPDATE auto_play SET allowance_started_at = ?, allowance_ends_at = ? WHERE owner_id = ?").run(startedAt, endsAt, ownerId);
    return this.autoPlay(ownerId, at);
  }

  /** The server's check after each of the owner's matches: when auto-play
   * is on and today's rewards are maxed, it goes off with the reason (and
   * any allowance with it). True when it was switched off by this call. */
  stopAutoPlayIfMaxed(ownerId: string): boolean {
    const at = this.stamp();
    const status = this.autoPlay(ownerId, at);
    if (!status.on || !status.dailyRewardsMaxed) return false;
    const day = this.resetDay(at).day;
    this.transaction(() => {
      this.db
        .prepare(
          `UPDATE auto_play SET is_on = 0, changed_at = ?, stopped_reason = 'dailyRewardsMaxed', stopped_day = ?${this.schemaVersion >= 22 ? ", allowance_started_at = NULL, allowance_ends_at = NULL" : ""}${this.schemaVersion >= 29 ? ", allowance_waiting_minutes = NULL" : ""} WHERE owner_id = ?`,
        )
        .run(at, day, ownerId);
      this.notify(ownerId, `dailyRewardsMaxed:${at}`, { kind: "autoPlayStopped", autoPlayStopped: { reason: "dailyRewardsMaxed", day, allowanceMinutes: null } }, at);
    });
    return true;
  }

  /** (v22) The server's check after each match and before each round: when
   * auto-play is on, its allowance's time is up and the owner has no live
   * match left to finish, it goes off with the reason "timeUp" on the day
   * the time ran out (the allowance is kept for "Time's up"). True when
   * it was switched off by this call. */
  stopAutoPlayIfTimeUp(ownerId: string): boolean {
    if (this.schemaVersion < 22) return false;
    const at = this.stamp();
    const row = this.db.prepare("SELECT is_on, allowance_started_at, allowance_ends_at FROM auto_play WHERE owner_id = ?").get(ownerId) as Row | undefined;
    if (!row || num(row.is_on) !== 1 || row.allowance_ends_at == null) return false;
    const endsAt = str(row.allowance_ends_at);
    if (endsAt > at || this.liveMatchOf(ownerId) !== null) return false;
    const day = this.allowanceDay(endsAt).day;
    this.transaction(() => {
      this.db.prepare("UPDATE auto_play SET is_on = 0, changed_at = ?, stopped_reason = 'timeUp', stopped_day = ? WHERE owner_id = ?").run(at, day, ownerId);
      const minutes = (Date.parse(endsAt) - Date.parse(str(row.allowance_started_at))) / 60_000;
      this.notify(ownerId, `timeUp:${endsAt}`, { kind: "autoPlayStopped", autoPlayStopped: { reason: "timeUp", day, allowanceMinutes: minutes } }, at);
    });
    return true;
  }

  /** (v22) `stopAutoPlayIfTimeUp` for every owner whose time is up, oldest
   * owner first: the owners it switched off. */
  stopAutoPlayTimeUp(): string[] {
    if (this.schemaVersion < 22) return [];
    const rows = this.db
      .prepare("SELECT a.owner_id FROM auto_play a JOIN owners o ON o.owner_id = a.owner_id WHERE a.is_on = 1 AND a.allowance_ends_at <= ? ORDER BY o.created_at, o.rowid")
      .all(this.stamp()) as Row[];
    return rows.map((r) => str(r.owner_id)).filter((o) => this.stopAutoPlayIfTimeUp(o));
  }

  /** Owners whose auto-play is on, oldest owner first: the ones the ladder
   * queues. (v22) Not an owner whose allowance's time is up, even while it
   * finishes its last match. */
  autoPlayOwners(): string[] {
    const v22 = this.schemaVersion >= 22;
    return (
      this.db
        .prepare(
          `SELECT a.owner_id FROM auto_play a JOIN owners o ON o.owner_id = a.owner_id WHERE a.is_on = 1${v22 ? " AND (a.allowance_ends_at IS NULL OR a.allowance_ends_at > ?)" : ""} ORDER BY o.created_at, o.rowid`,
        )
        .all(...(v22 ? [this.stamp()] : [])) as Row[]
    ).map((r) => str(r.owner_id));
  }

  // ---- the Home widget board (schema v16; owner 2026-11-01) ----

  /** The owner's saved board, or the recommended layout when the owner has
   * never saved one. */
  boardLayout(ownerId: string): BoardLayout {
    this.getOwner(ownerId);
    const row = this.db.prepare("SELECT * FROM board_layouts WHERE owner_id = ?").get(ownerId) as Row | undefined;
    if (!row) return { widgets: RECOMMENDED_LAYOUT.map((w) => ({ ...w })), recommended: true, updatedAt: null };
    return { widgets: JSON.parse(str(row.widgets)) as Widget[], recommended: false, updatedAt: str(row.updated_at) };
  }

  /** Saves the whole board (`{ widgets }`, in board order) and returns it.
   * Refused, saving nothing, when any part is invalid
   * (`boardLayoutProblem`). An empty list saves an empty board; saving the
   * recommended widgets saves them as the owner's own board. */
  saveBoardLayout(ownerId: string, body: { widgets: readonly Widget[] }): BoardLayout {
    const problem = boardLayoutProblem(body);
    if (problem) throw new EconomyError(problem);
    return this.transaction(() => {
      this.getOwner(ownerId);
      try {
        this.db
          .prepare(
            `INSERT INTO board_layouts (owner_id, widgets, updated_at) VALUES (?, ?, ?)
             ON CONFLICT (owner_id) DO UPDATE SET widgets = excluded.widgets, updated_at = excluded.updated_at`,
          )
          .run(ownerId, JSON.stringify(boardWidgets(body)), this.stamp());
      } catch (err) {
        refused(err);
      }
      return this.boardLayout(ownerId);
    });
  }

  // ---- agents ----

  /** A new agent for an owner. It brings nothing with it: no copies, no
   * credits, no packs (owner app spec B). */
  createAgent(input: { ownerId: string; name: string; persona?: string }): AgentRecord {
    return this.insertAgent(input, "custom", null);
  }

  /** The agent row and (schema v9) its first name entry. createAgent is
   * the low-level path (tests, house setup) and doesn't run the typed-name
   * rules; owners name agents through confirmAgentDraft and renameAgent. */
  private insertAgent(input: { ownerId: string; name: string; persona?: string }, kind: AgentNameKind, byOwnerId: string | null): AgentRecord {
    const agent: AgentRecord = {
      agentId: randomUUID(),
      ownerId: input.ownerId,
      name: input.name,
      persona: input.persona ?? null,
      playStyle: DEFAULT_PLAY_STYLE,
      createdAt: this.stamp(),
    };
    this.transaction(() => {
      try {
        // Without a persona, the pre-v6 column list (the migration tests open
        // old schema versions with this code).
        if (agent.persona === null) {
          this.db
            .prepare("INSERT INTO agents (agent_id, owner_id, name, created_at) VALUES (?, ?, ?, ?)")
            .run(agent.agentId, agent.ownerId, agent.name, agent.createdAt);
        } else {
          this.db
            .prepare("INSERT INTO agents (agent_id, owner_id, name, persona, created_at) VALUES (?, ?, ?, ?, ?)")
            .run(agent.agentId, agent.ownerId, agent.name, agent.persona, agent.createdAt);
        }
        if (this.schemaVersion >= 9) this.logAgentName(agent.agentId, agent.name, kind, 0, byOwnerId, null, agent.createdAt);
        if (this.schemaVersion >= 11) this.equipFactionBoast(agent.ownerId, agent.agentId, agent.createdAt);
        if (this.schemaVersion >= 20) this.equipStarterCoin(agent.ownerId, agent.agentId, agent.createdAt);
      } catch (err) {
        if (/UNIQUE.*agents\.name|agents_name_nocase/.test(err instanceof Error ? err.message : "")) throw new EconomyError(`the agent name "${agent.name}" is taken`);
        refused(err);
      }
    });
    return agent;
  }

  private logAgentName(agentId: string, name: string, kind: AgentNameKind, packPoints: number, byOwnerId: string | null, note: string | null, at: string): number {
    const r = this.db
      .prepare("INSERT INTO agent_names (agent_id, name, kind, pack_points, by_owner_id, note, named_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(agentId, name, kind, packPoints, byOwnerId, note, at);
    return Number(r.lastInsertRowid);
  }

  // ---- naming an agent (owner 2026-10-16; schema v9) ----

  /** Why `name` can't be `ownerId`'s agent's name, or undefined when it can.
   * The typed-name rules (agentNames.ts), then the ones that need the
   * database: free without case (no agent holds it, and no other agent ever
   * held it), and not another owner's login username. `agentId` is the
   * agent being renamed, which may take back a name it held before. */
  agentNameProblem(ownerId: string, name: string, agentId?: string): string | undefined {
    const problem = customAgentNameProblem(name);
    if (problem) return problem;
    const tidy = tidyAgentName(name);
    const holder = this.db.prepare("SELECT agent_id FROM agents WHERE name = ? COLLATE NOCASE").get(tidy) as Row | undefined;
    if (holder && str(holder.agent_id) !== agentId) return `the agent name "${tidy}" is taken`;
    const held = this.db.prepare("SELECT 1 FROM agent_names WHERE name = ? COLLATE NOCASE AND agent_id IS NOT ?").get(tidy, agentId ?? null);
    if (held) return `the agent name "${tidy}" belonged to another agent and stays reserved`;
    const key = nameKey(tidy);
    const logins = this.db.prepare("SELECT owner_id, username FROM logins").all() as Row[];
    if (logins.some((l) => str(l.owner_id) !== ownerId && nameKey(str(l.username)) === key)) return "an agent name can't copy another owner's username";
    return undefined;
  }

  /** What the agent's next rename costs in pack points (owner 2026-10-17,
   * option D: an agent's first rename is free, every one after costs
   * AGENT_RENAME_PACK_POINTS). An admin's forced rename is not the owner's
   * rename, so it never uses up the free one. */
  renamePrice(agentId: string): number {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM agent_names WHERE agent_id = ? AND kind = 'rename'").get(agentId) as Row;
    return num(row.n) === 0 ? 0 : AGENT_RENAME_PACK_POINTS;
  }

  /** Renames an owner's agent: the first rename is free, every later one
   * costs AGENT_RENAME_PACK_POINTS pack points (renamePrice). Refused
   * during the agent's live match, for a name the rules refuse, or without
   * the points. The signature card keeps its name and its printed flavour. */
  renameAgent(ownerId: string, agentId: string, newName: string): AgentNames {
    return this.transaction(() => {
      const agent = this.getAgent(agentId);
      if (agent.ownerId !== ownerId) throw new EconomyError("only the agent's owner can rename it");
      const name = tidyAgentName(newName);
      if (name === agent.name) throw new EconomyError(`the agent is already called "${name}"`);
      if (this.liveMatchOf(ownerId) !== null && this.connectedAgent(ownerId)?.agentId === agentId) {
        throw new EconomyError("no renaming an agent during its live match");
      }
      const problem = this.agentNameProblem(ownerId, name, agentId);
      if (problem) throw new EconomyError(problem);
      const price = this.renamePrice(agentId);
      const have = this.balance(ownerId, "packPoints");
      if (have < price) throw new EconomyError(`this rename costs ${price} pack points (only the first is free); you have ${have}`);
      const at = this.stamp();
      const entry = this.logAgentName(agentId, name, "rename", price, ownerId, null, at);
      // The free rename leaves no ledger entry: the ledger records only
      // balance changes, and the name log keeps the rename itself.
      if (price > 0) this.appendLedger(ownerId, null, "packPoints", -price, "agentRename", `agent-name:${entry}`, at);
      this.db.prepare("UPDATE agents SET name = ? WHERE agent_id = ?").run(name, agentId);
      return this.agentNames(agentId);
    });
  }

  /** An admin's force-rename (owner 2026-10-16: "add an admin-view
   * force-rename"): free, to a fresh generated name (or `name`, checked by
   * the same rules). The old name is never shown again, not even as
   * "formerly", and stays reserved so no one can take it. Allowed during a
   * live match: a bad name shouldn't stay on a broadcast. */
  forceRenameAgent(adminOwnerId: string, agentId: string, options: { reason: string; name?: string; seed?: number }): AgentNames {
    if (!this.isAdmin(adminOwnerId)) throw new EconomyError("only an admin can force a rename");
    const reason = options.reason.trim();
    if (reason.length === 0) throw new EconomyError("a forced rename records its reason");
    return this.transaction(() => {
      const agent = this.getAgent(agentId);
      let name: string;
      if (options.name !== undefined) {
        name = tidyAgentName(options.name);
        const problem = this.agentNameProblem(agent.ownerId, name, agentId);
        if (problem) throw new EconomyError(problem);
      } else {
        name = generatedAgentName(new Rng(options.seed ?? randomInt(2 ** 31)), this.takenNames().agentNames);
      }
      const at = this.stamp();
      this.logAgentName(agentId, name, "forced", 0, adminOwnerId, reason, at);
      this.db.prepare("UPDATE agents SET name = ? WHERE agent_id = ?").run(name, agentId);
      return this.agentNames(agentId);
    });
  }

  /** An agent's current name, what it was formerly called, and the full log. */
  agentNames(agentId: string): AgentNames {
    const agent = this.getAgent(agentId);
    const history = (this.db.prepare("SELECT * FROM agent_names WHERE agent_id = ? ORDER BY entry_no").all(agentId) as Row[]).map(
      (r): AgentNameEntry => ({
        entryNo: num(r.entry_no),
        agentId: str(r.agent_id),
        name: str(r.name),
        kind: str(r.kind) as AgentNameKind,
        packPoints: num(r.pack_points),
        byOwnerId: strOrNull(r.by_owner_id),
        note: strOrNull(r.note),
        namedAt: str(r.named_at),
      }),
    );
    // A name followed by a forced rename was forced off: never shown.
    const shown = history.filter((e, i) => history[i + 1]?.kind !== "forced");
    const formerly: string[] = [];
    for (const e of [...shown].reverse()) {
      if (e.name.toLowerCase() !== agent.name.toLowerCase() && !formerly.some((f) => f.toLowerCase() === e.name.toLowerCase())) formerly.push(e.name);
    }
    return { agentId, current: agent.name, formerly, history };
  }

  getAgent(agentId: string): AgentRecord {
    const row = this.db.prepare("SELECT * FROM agents WHERE agent_id = ?").get(agentId) as Row | undefined;
    if (!row) throw new EconomyError(`no agent "${agentId}"`);
    return this.agentFromRow(row);
  }

  listAgents(ownerId?: string): AgentRecord[] {
    const rows =
      ownerId === undefined
        ? this.db.prepare("SELECT * FROM agents ORDER BY created_at, name").all()
        : this.db.prepare("SELECT * FROM agents WHERE owner_id = ? ORDER BY created_at, name").all(ownerId);
    return (rows as Row[]).map((r) => this.agentFromRow(r));
  }

  private agentFromRow(row: Row): AgentRecord {
    return {
      agentId: str(row.agent_id),
      ownerId: str(row.owner_id),
      name: str(row.name),
      persona: strOrNull(row.persona ?? null),
      playStyle: (strOrNull(row.play_style ?? null) ?? DEFAULT_PLAY_STYLE) as PlayStyleId,
      createdAt: str(row.created_at),
    };
  }

  /** (v13) Sets how an agent plays (owner 2026-10-15). Allowed at any
   * time: a live match keeps the style it started with, so a change made
   * during one applies from the next. Only the agent's owner can set it
   * (session 60: the check was the owner API's alone before). */
  setPlayStyle(ownerId: string, agentId: string, style: string): AgentRecord {
    if (this.schemaVersion < 13) throw new EconomyError("play styles need schema v13");
    if (!isPlayStyleId(style)) throw new EconomyError(`"${style}" is not a play style`);
    const agent = this.getAgent(agentId);
    if (agent.ownerId !== ownerId) throw new EconomyError("only the agent's owner can set its play style");
    this.db.prepare("UPDATE agents SET play_style = ? WHERE agent_id = ?").run(style, agentId);
    return { ...agent, playStyle: style };
  }

  // ---- generating a new agent (owner app spec B; schema v6) ----

  /** Step 1 of "Generate a new agent": 3 generated agents to pick from.
   * Starting a draft closes the owner's earlier open one. The seed is drawn
   * here, server-side (anti-exploit rule 9); `seed` is for tests and the
   * demo only. */
  startAgentDraft(ownerId: string, options: { seed?: number } = {}): AgentDraft {
    this.getOwner(ownerId);
    return this.transaction(() => {
      const at = this.stamp();
      this.db.prepare("UPDATE agent_drafts SET closed_at = ? WHERE owner_id = ? AND closed_at IS NULL").run(at, ownerId);
      const agents = generateAgentCandidates(options.seed ?? randomInt(2 ** 31), { agentNames: this.takenNames().agentNames });
      const draft: AgentDraft = { draftId: randomUUID(), ownerId, agents, picked: null, signatures: null, createdAt: at };
      this.db
        .prepare("INSERT INTO agent_drafts (draft_id, owner_id, agents_json, created_at) VALUES (?, ?, ?, ?)")
        .run(draft.draftId, ownerId, JSON.stringify(agents), at);
      return draft;
    });
  }

  /** Step 2: the owner picks one of the 3 agents and gets 3 signature cards
   * for it, every one a line that passed the fairness test, under a themed
   * name no card has (now and then built on the owner's username). One pick
   * per draft: to see other agents, start a new draft. */
  pickDraftAgent(ownerId: string, draftId: string, index: number, options: { seed?: number } = {}): AgentDraft {
    return this.transaction(() => {
      const draft = this.openDraft(ownerId, draftId);
      if (draft.picked !== null) throw new EconomyError("this draft's agent is already picked; start a new draft to choose again");
      const agent = draft.agents[index];
      if (!Number.isInteger(index) || agent === undefined) throw new EconomyError(`no agent candidate ${index} in this draft`);
      const taken = this.takenNames();
      let signatures: SignatureCandidate[];
      try {
        signatures = generateSignatureCandidates(options.seed ?? randomInt(2 ** 31), agent.name, taken, { username: this.username(ownerId) });
      } catch (err) {
        refused(err);
      }
      this.db.prepare("UPDATE agent_drafts SET picked = ?, signatures_json = ? WHERE draft_id = ?").run(index, JSON.stringify(signatures), draftId);
      return { ...draft, picked: index, signatures };
    });
  }

  /** Step 3: the owner confirms one of the 3 signature cards. In one
   * transaction: the agent is created with its generated name and persona,
   * its signature card is recorded with the next PR- number, and the card is
   * granted to the owner as a bound promo copy. Refused if the agent's or
   * the card's name was taken since the draft was shown (start a new
   * draft); a combination another agent has since taken is fine.
   * The card's art-pool slot is drawn here, server-side; `artSlot` is for
   * tests and the demo only. The new agent is not connected; the owner
   * connects it. */
  confirmAgentDraft(ownerId: string, draftId: string, signatureIndex: number, options: { artSlot?: number; name?: string } = {}): GeneratedAgent {
    const artSlot = options.artSlot ?? randomInt(1, SIGNATURE_ART_POOL_SIZE + 1);
    if (!Number.isInteger(artSlot) || artSlot < 1 || artSlot > SIGNATURE_ART_POOL_SIZE) {
      throw new EconomyError(`an art slot is 1 to ${SIGNATURE_ART_POOL_SIZE}, got ${artSlot}`);
    }
    return this.transaction(() => {
      const draft = this.openDraft(ownerId, draftId);
      if (draft.picked === null || draft.signatures === null) throw new EconomyError("pick an agent before its signature card");
      let chosen = draft.signatures[signatureIndex];
      if (!Number.isInteger(signatureIndex) || chosen === undefined) throw new EconomyError(`no signature candidate ${signatureIndex} in this draft`);
      const candidate = draft.agents[draft.picked]!;
      const taken = this.takenNames();
      // Naming is free here (owner 2026-10-16): keep the generated name, or
      // type one, checked by the typed-name rules. The card's flavour line
      // is printed now, so it uses the name the agent is created with.
      const typed = options.name === undefined ? undefined : tidyAgentName(options.name);
      if (typed !== undefined && typed !== candidate.name) {
        const problem = this.agentNameProblem(ownerId, typed);
        if (problem) throw new EconomyError(problem);
      } else if ([...taken.agentNames].some((n) => n.toLowerCase() === candidate.name.toLowerCase())) {
        throw new EconomyError(`the agent name "${candidate.name}" was taken since this draft was made; start a new draft or type a name`);
      }
      if (taken.cardNames.has(chosen.name)) {
        throw new EconomyError(`the card name "${chosen.name}" was taken since this draft was made; start a new draft`);
      }
      const agentName = typed ?? candidate.name;
      const agent = this.insertAgent({ ownerId, name: agentName, persona: candidate.persona }, agentName === candidate.name ? "generated" : "custom", ownerId);
      if (agentName !== candidate.name) chosen = { ...chosen, flavor: chosen.flavor.replaceAll(candidate.name, agentName) };
      const promoNumber = this.nextPromoNumber();
      const collectorNumber = `PR-${String(promoNumber).padStart(3, "0")}`;
      const cardId = `sig-${collectorNumber}`;
      const card = signatureCardFor(chosen, cardId);
      const at = this.stamp();
      try {
        const values = [agent.agentId, cardId, chosen.comboId, chosen.name, JSON.stringify(chosen.spec), signatureFingerprint(card), chosen.flavor, promoNumber, at];
        if (this.schemaVersion >= 8) {
          // The card's piece of this season's art pool (owner 2026-10-16),
          // drawn server-side; two cards may share one.
          this.db
            .prepare(
              `INSERT INTO signature_cards (agent_id, card_id, combo_id, name, spec_json, fingerprint, flavor, promo_number, created_at, art_pool, art_slot)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(...values, this.season, artSlot);
        } else {
          // The pre-v8 column list (the migration tests open old schema versions with this code).
          this.db
            .prepare(
              `INSERT INTO signature_cards (agent_id, card_id, combo_id, name, spec_json, fingerprint, flavor, promo_number, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(...values);
        }
      } catch (err) {
        refused(err);
      }
      const copy = this.grantCopy({
        ownerId,
        cardId,
        origin: "promo",
        originRef: `${SIGNATURE_ORIGIN_REF_PREFIX}${agent.agentId}`,
        seriesKind: "promo",
        seriesCode: collectorNumber,
        stamp: "SIGNATURE",
      });
      this.db.prepare("UPDATE agent_drafts SET closed_at = ?, agent_id = ? WHERE draft_id = ?").run(at, agent.agentId, draftId);
      return { agent, signature: this.signatureCard(agent.agentId)!, copy };
    });
  }

  /** The owner's open draft, if any. */
  openAgentDraft(ownerId: string): AgentDraft | null {
    const row = this.db.prepare("SELECT * FROM agent_drafts WHERE owner_id = ? AND closed_at IS NULL").get(ownerId) as Row | undefined;
    return row ? this.draftFromRow(row) : null;
  }

  /** An agent's signature card, or null for an agent made without one. */
  signatureCard(agentId: string): SignatureCardRecord | null {
    const row = this.db.prepare("SELECT * FROM signature_cards WHERE agent_id = ?").get(agentId) as Row | undefined;
    return row ? this.signatureFromRow(row) : null;
  }

  /** A signature card by its card id (it is in no card set, so getCard
   * doesn't know it). */
  signatureCardById(cardId: string): SignatureCardRecord | null {
    const row = this.db.prepare("SELECT * FROM signature_cards WHERE card_id = ?").get(cardId) as Row | undefined;
    return row ? this.signatureFromRow(row) : null;
  }

  private signatureFromRow(row: Row): SignatureCardRecord {
    const spec = JSON.parse(str(row.spec_json)) as SignatureSpec;
    const cardId = str(row.card_id);
    const art = row.art_slot === undefined || row.art_slot === null ? null : { pool: str(row.art_pool), slot: num(row.art_slot) };
    const card = signatureCardFor({ spec, name: str(row.name), flavor: str(row.flavor) }, cardId, art ? signatureArtRef(art) : undefined);
    return {
      agentId: str(row.agent_id),
      cardId,
      comboId: str(row.combo_id),
      collectorNumber: `PR-${String(num(row.promo_number)).padStart(3, "0")}`,
      spec,
      card,
      fingerprint: str(row.fingerprint),
      art,
      createdAt: str(row.created_at),
    };
  }

  private openDraft(ownerId: string, draftId: string): AgentDraft {
    const row = this.db.prepare("SELECT * FROM agent_drafts WHERE draft_id = ?").get(draftId) as Row | undefined;
    if (!row || str(row.owner_id) !== ownerId) throw new EconomyError(`no draft "${draftId}" for this owner`);
    if (row.closed_at !== null) throw new EconomyError("this draft is closed (confirmed, or replaced by a newer one)");
    return this.draftFromRow(row);
  }

  private draftFromRow(row: Row): AgentDraft {
    return {
      draftId: str(row.draft_id),
      ownerId: str(row.owner_id),
      agents: JSON.parse(str(row.agents_json)) as AgentCandidate[],
      picked: row.picked === null ? null : num(row.picked),
      signatures: row.signatures_json === null ? null : (JSON.parse(str(row.signatures_json)) as SignatureCandidate[]),
      createdAt: str(row.created_at),
    };
  }

  /** Names this season has used: every agent name, every signature card's
   * name, and every set card's name (a signature card never shares a name
   * with a set card). */
  private takenNames(): { agentNames: Set<string>; cardNames: Set<string> } {
    // Every agent's current name and (v9) every name one ever held: an old
    // name stays reserved. Generated names are compared without case.
    const held = this.schemaVersion >= 9 ? "SELECT name FROM agents UNION SELECT name FROM agent_names" : "SELECT name FROM agents";
    const agentNames = new Set((this.db.prepare(held).all() as Row[]).map((r) => str(r.name)));
    const sigs = this.db.prepare("SELECT name FROM signature_cards").all() as Row[];
    const cardNames = new Set([...sigs.map((r) => str(r.name)), ...[...CARD_REGISTRY.values()].map((c) => c.name)]);
    return { agentNames, cardNames };
  }

  /** The owner's login username, or undefined for an owner without a login
   * (the house owners). */
  private username(ownerId: string): string | undefined {
    const row = this.db.prepare("SELECT username FROM logins WHERE owner_id = ?").get(ownerId) as Row | undefined;
    return row ? str(row.username) : undefined;
  }

  /** The next PR- collector number. Signature cards are the only promos
   * issued so far; any promo copy already carrying a PR- code counts too, so
   * a number is never handed out twice once general promo issuing lands. */
  private nextPromoNumber(): number {
    const sig = num((this.db.prepare("SELECT COALESCE(MAX(promo_number), 0) AS n FROM signature_cards").get() as Row).n);
    const copies = num(
      (
        this.db
          .prepare("SELECT COALESCE(MAX(CAST(substr(series_code, 4) AS INTEGER)), 0) AS n FROM card_copies WHERE series_kind = 'promo' AND series_code LIKE 'PR-%'")
          .get() as Row
      ).n,
    );
    return Math.max(sig, copies) + 1;
  }

  // ---- the connected agent (owner app spec B) ----

  /** Connects one of the owner's own agents, replacing whichever was
   * connected. Only the signature card in play changes: the collection,
   * decks, wallet, caps and stats stay with the owner. Refused during the
   * owner's live match, by the schema as well as here. */
  connectAgent(ownerId: string, agentId: string): void {
    const agent = this.getAgent(agentId);
    if (agent.ownerId !== ownerId) throw new EconomyError("an owner can only connect one of its own agents");
    this.setConnected(ownerId, agentId);
  }

  /** Disconnects the owner's agent (none plays until another connects). */
  disconnectAgent(ownerId: string): void {
    this.setConnected(ownerId, null);
  }

  private setConnected(ownerId: string, agentId: string | null): void {
    if (this.liveMatchOf(ownerId) !== null) throw new EconomyError("no switching or disconnecting agents during a live match");
    try {
      this.db.prepare("UPDATE owners SET connected_agent_id = ? WHERE owner_id = ?").run(agentId, ownerId);
    } catch (err) {
      refused(err);
    }
  }

  connectedAgent(ownerId: string): AgentRecord | null {
    const id = this.getOwner(ownerId).connectedAgentId;
    return id === null ? null : this.getAgent(id);
  }

  /** The owner's faction lock (Settings → Play), or null to free it. It
   * applies to whichever agent is connected: matches start only with an
   * active deck of that faction. Returns whether the current active deck
   * already fits. */
  setFactionLock(ownerId: string, faction: DeckFaction | null): { activeDeckFits: boolean } {
    if (faction !== null && !(LOCKABLE_FACTIONS as readonly string[]).includes(faction)) {
      throw new EconomyError(`can't lock to "${faction}"`);
    }
    try {
      this.db.prepare("UPDATE owners SET faction_lock = ? WHERE owner_id = ?").run(faction, ownerId);
    } catch (err) {
      refused(err);
    }
    const active = this.getOwner(ownerId).activeDeckId;
    return { activeDeckFits: faction === null || (active !== null && this.deckFactionOf(active) === faction) };
  }

  // ---- cosmetics (schema v11; owner 2026-10-19, victory boasts) ----
  //
  // Cosmetic only: none of this reaches the engine, the agents or any
  // balance check. The owner owns cosmetics (account-bound, kept across
  // season resets); each agent wears a loadout of them, one item per slot.

  /** The catalogue this store sells from (cosmetics.ts, or the one passed
   * to `open`). */
  cosmeticsCatalogue(): CosmeticItem[] {
    return [...this.catalogue.values()];
  }

  /** What the store sells right now, in this season's sale windows, each
   * with whether the owner already has it. Retired items never show. */
  cosmeticsOnSale(ownerId: string): (CosmeticItem & { owned: boolean })[] {
    const at = this.stamp();
    const owned = new Set(this.ownedCosmetics(ownerId).map((c) => c.itemId));
    return this.cosmeticsCatalogue()
      .filter((item) => onSale(item, this.season, at))
      .map((item) => ({ ...item, owned: owned.has(item.itemId) }));
  }

  ownedCosmetics(ownerId: string): OwnedCosmetic[] {
    if (this.schemaVersion < 11) return [];
    return (this.db.prepare("SELECT * FROM owned_cosmetics WHERE owner_id = ? ORDER BY acquired_at, item_id").all(ownerId) as Row[]).map((r) => ({
      ownerId: str(r.owner_id),
      itemId: str(r.item_id),
      kind: str(r.kind) as CosmeticKind,
      source: str(r.source) as OwnedCosmetic["source"],
      ledgerEntryId: numOrNull(r.ledger_entry_id),
      rewardRef: this.schemaVersion >= 20 ? strOrNull(r.reward_ref) : null,
      acquiredAt: str(r.acquired_at),
      carriedFrom: this.schemaVersion >= 27 ? strOrNull(r.carried_from) : null,
      item: this.catalogue.get(str(r.item_id)) ?? null,
    }));
  }

  private ownsCosmetic(ownerId: string, itemId: string): boolean {
    return this.db.prepare("SELECT 1 FROM owned_cosmetics WHERE owner_id = ? AND item_id = ?").get(ownerId, itemId) !== undefined;
  }

  /** Buys a cosmetic with credits, the one shop currency: debited and
   * granted together or not at all. Refused: an item that isn't sold (the
   * free starter boasts), one from another season or outside its sale
   * window (retired items are never sold again, owner 2026-10-19 decision
   * 2), one the render lane hasn't drawn yet, one the owner already has,
   * and too few credits. */
  buyCosmetic(ownerId: string, itemId: string): OwnedCosmetic {
    this.refuseIfEnded("no cosmetic is bought");
    const item = this.catalogue.get(itemId);
    if (!item) throw new EconomyError(`no cosmetic "${itemId}"`);
    const at = this.stamp();
    if (!onSale(item, this.season, at)) {
      if (item.tierReward !== undefined) throw new EconomyError(`"${item.name}" is a season reward for finishing ${item.tierReward} or higher; it isn't sold`);
      if (item.priceCredits === null) throw new EconomyError(`"${item.name}" is free with the starter collection; it isn't sold`);
      if (item.season !== this.season) throw new EconomyError(`"${item.name}" is a ${item.season} item; it isn't sold in ${this.season}`);
      if (!item.drawn) throw new EconomyError(`"${item.name}" isn't on sale yet: the render lane hasn't drawn it`);
      throw new EconomyError(`"${item.name}" isn't on sale now`);
    }
    return this.transaction(() => {
      this.getOwner(ownerId);
      if (this.ownsCosmetic(ownerId, itemId)) throw new EconomyError(`the owner already has "${item.name}"`);
      if (this.balance(ownerId, "credits") < item.priceCredits!) {
        throw new EconomyError(`"${item.name}" costs ${item.priceCredits} credits; the owner has ${this.balance(ownerId, "credits")}`);
      }
      const entryId = this.appendLedger(ownerId, null, "credits", -item.priceCredits!, "cosmeticPurchase", itemId, at);
      try {
        this.db
          .prepare("INSERT INTO owned_cosmetics (owner_id, item_id, kind, source, ledger_entry_id, acquired_at) VALUES (?, ?, ?, 'purchase', ?, ?)")
          .run(ownerId, itemId, item.kind, entryId, at);
      } catch (err) {
        refused(err);
      }
      return this.ownedCosmetics(ownerId).find((c) => c.itemId === itemId)!;
    });
  }

  /** The free starter cosmetics, with the starter collection: the four
   * faction starter boasts (all four, since agents can switch factions)
   * and (v20) the Chrome Token coin. The owner's agents made before it
   * start wearing the faction's boast and the Chrome Token. */
  private grantStarterCosmetics(ownerId: string, at: string): OwnedCosmetic[] {
    if (this.schemaVersion < 11) return [];
    // ON CONFLICT: a new season's file already holds the owner's carried
    // cosmetics (v27), the starter ones among them.
    const insert = this.db.prepare("INSERT INTO owned_cosmetics (owner_id, item_id, kind, source, acquired_at) VALUES (?, ?, ?, 'starter', ?) ON CONFLICT DO NOTHING");
    const starters: { itemId: string; kind: CosmeticKind }[] = Object.values(STARTER_BOASTS);
    if (this.schemaVersion >= 20) starters.push(STARTER_COIN);
    for (const item of starters) {
      try {
        insert.run(ownerId, item.itemId, item.kind, at);
      } catch (err) {
        refused(err);
      }
    }
    for (const agent of this.listAgents(ownerId)) {
      this.equipFactionBoast(ownerId, agent.agentId, at);
      if (this.schemaVersion >= 20) this.equipStarterCoin(ownerId, agent.agentId, at);
    }
    return this.ownedCosmetics(ownerId);
  }

  /** (v20) A new agent's coin slot: the Chrome Token, if the owner has it.
   * An agent that already has a coin keeps it. */
  private equipStarterCoin(ownerId: string, agentId: string, at: string): void {
    if (!this.ownsCosmetic(ownerId, STARTER_COIN.itemId)) return;
    this.db.prepare("INSERT INTO agent_loadouts (agent_id, slot, item_id, set_at) VALUES (?, 'coin', ?, ?) ON CONFLICT DO NOTHING").run(agentId, STARTER_COIN.itemId, at);
  }

  /** (v20) The tier coins the owner's ladder tier would earn if the season
   * ended now (owner 2026-11-02: Platinum or higher earns the Platinum
   * coin, Diamond or higher the Diamond coin, Mythic the Mythic coin), each
   * with whether the owner already has it. Placement earns none. */
  seasonTierCoins(ownerId: string, at: string = this.stamp()): { tier: string; coins: { itemId: string; name: string; tier: SeasonRewardTier; owned: boolean }[] } {
    const { tier } = this.rating(ownerId, at);
    return {
      tier,
      coins: this.tierCoinsOfSeason(tier).map((item) => ({ itemId: item.itemId, name: item.name, tier: item.tierReward!, owned: this.ownsCosmetic(ownerId, item.itemId) })),
    };
  }

  /** This season's tier coins (from the catalogue) that `tier` earns,
   * lowest first. */
  private tierCoinsOfSeason(tier: string): CosmeticItem[] {
    const coins = Object.fromEntries(
      this.cosmeticsCatalogue()
        .filter((i) => i.kind === "coin" && i.season === this.season && i.tierReward !== undefined)
        .map((i) => [i.tierReward!, i]),
    ) as Record<SeasonRewardTier, CosmeticItem>;
    if (!SEASON_REWARD_TIERS.every((t) => coins[t] !== undefined)) return [];
    return tierCoinsFor(tier, coins);
  }

  /** (v20) Grants every owner the season's tier coins its end-of-season
   * ladder tier earns, all in one transaction, each once (a second run
   * grants nothing new). For the season-end work (roadmap item 3): nothing
   * calls it before then. A season with no tier coins in the catalogue
   * grants nothing. Returns what each owner was given. */
  grantSeasonTierCoins(at: string = this.stamp()): { ownerId: string; tier: string; granted: string[] }[] {
    if (this.schemaVersion < 20) throw new EconomyError("season reward coins need schema v20");
    return this.transaction(() => {
      const out: { ownerId: string; tier: string; granted: string[] }[] = [];
      const insert = this.db.prepare(
        "INSERT INTO owned_cosmetics (owner_id, item_id, kind, source, reward_ref, acquired_at) VALUES (?, ?, 'coin', 'seasonReward', ?, ?) ON CONFLICT DO NOTHING",
      );
      const owners = this.db.prepare("SELECT owner_id FROM owners ORDER BY created_at, rowid").all() as Row[];
      for (const o of owners) {
        const ownerId = str(o.owner_id);
        const { tier } = this.rating(ownerId, at);
        const granted: string[] = [];
        for (const item of this.tierCoinsOfSeason(tier)) {
          try {
            if (num(insert.run(ownerId, item.itemId, `${this.season}:${item.tierReward}`, at).changes) > 0) granted.push(item.itemId);
          } catch (err) {
            refused(err);
          }
        }
        if (granted.length > 0 || this.tierCoinsOfSeason(tier).length > 0) out.push({ ownerId, tier, granted });
      }
      return out;
    });
  }

  // ---- the season's end (v26; Season 0 game item 3, part 1) ----

  /** (v29) The season's end time, as set before it started, or null: no
   * end time (it ends only by the admin's call). */
  seasonSchedule(): SeasonSchedule | null {
    if (this.schemaVersion < 29) return null;
    const row = this.db.prepare("SELECT ends_at, set_at FROM season_schedule").get() as Row | undefined;
    return row ? { endsAt: str(row.ends_at), setAt: str(row.set_at) } : null;
  }

  /** (v29; owner 2026-11-13, on session 93: "the season's end is decided by
   * the server; its end time is set before the season starts") Sets the
   * season's end time, an ISO instant. From then no match starts; the live
   * ladder lets the matches being shown finish and ends the season.
   * Refused once the season has ended, and for a time that has already
   * passed. Setting it again replaces it (while the season is open). */
  setSeasonEndTime(endsAt: string): SeasonSchedule {
    if (this.schemaVersion < 29) throw new EconomyError("a season end time needs schema v29");
    const ms = Date.parse(endsAt);
    if (!Number.isFinite(ms)) throw new EconomyError(`"${endsAt}" isn't a time (e.g. 2026-12-26T13:00:00Z)`);
    const iso = new Date(ms).toISOString();
    const at = this.stamp();
    this.refuseIfEnded("its end time is fixed");
    if (iso <= at) throw new EconomyError(`the end time ${iso} has already passed (now ${at})`);
    this.db
      .prepare("INSERT INTO season_schedule (one, ends_at, set_at) VALUES (1, ?, ?) ON CONFLICT (one) DO UPDATE SET ends_at = excluded.ends_at, set_at = excluded.set_at")
      .run(iso, at);
    return this.seasonSchedule()!;
  }

  /** (v29) Whether the season's end time has passed (and it hasn't ended
   * yet): the live ladder's signal to end it. */
  seasonEndDue(at: string = this.stamp()): boolean {
    const s = this.seasonSchedule();
    return s !== null && at >= s.endsAt && !this.seasonEnded();
  }

  /** Whether the season has ended (v26). */
  seasonEnded(): boolean {
    return this.schemaVersion >= 26 && this.db.prepare("SELECT 1 FROM season_end").get() !== undefined;
  }

  /** The season's end, or null while the season is open. */
  seasonEnd(): SeasonEnd | null {
    if (!this.seasonEnded()) return null;
    const row = this.db.prepare("SELECT season, ended_at FROM season_end").get() as Row | undefined;
    if (!row) return null;
    const season = str(row.season);
    const coins = new Map<string, string[]>();
    for (const r of this.db
      .prepare("SELECT owner_id, item_id FROM owned_cosmetics WHERE source = 'seasonReward' AND reward_ref LIKE ? ORDER BY acquired_at, rowid")
      .all(`${season}:%`) as Row[]) {
      coins.set(str(r.owner_id), [...(coins.get(str(r.owner_id)) ?? []), str(r.item_id)]);
    }
    const order = (item: string) => SEASON_REWARD_TIERS.indexOf(this.catalogue.get(item)?.tierReward ?? SEASON_REWARD_TIERS[0]!);
    const standings = (this.db.prepare("SELECT * FROM season_standings ORDER BY rank IS NULL, rank, rating DESC, rd, owner_name").all() as Row[]).map(
      (r): SeasonStanding => ({
        rank: r.rank === null ? null : num(r.rank),
        ownerId: str(r.owner_id),
        ownerName: str(r.owner_name),
        agentName: r.agent_name === null ? null : str(r.agent_name),
        rating: num(r.rating),
        rd: num(r.rd),
        volatility: num(r.volatility),
        ratedMatches: num(r.rated_matches),
        tier: str(r.tier) as LadderTier,
        wins: num(r.wins),
        losses: num(r.losses),
        draws: num(r.draws),
        tierCoins: [...(coins.get(str(r.owner_id)) ?? [])].sort((a, b) => order(a) - order(b)),
      }),
    );
    const retiredPrototypes = (this.db.prepare("SELECT * FROM retired_prototype_runs ORDER BY run_code").all() as Row[]).map(
      (r): RetiredPrototypeRun => ({
        runCode: str(r.run_code),
        setCode: str(r.set_code),
        cardId: str(r.card_id),
        runSize: num(r.run_size),
        found: num(r.found),
        retired: num(r.retired),
        retiredAt: str(r.retired_at),
      }),
    );
    return { season, endedAt: str(row.ended_at), standings, retiredPrototypes };
  }

  /** Ends the season, in one transaction (ECONOMY.md "Seasons"; roadmap
   * game item 3): first the tier coins each owner's tier earns at `at`
   * (grantSeasonTierCoins), then the final standings frozen as the ladder
   * stands at `at`, then every Prototype run of the season's set retired
   * with what it found (the copies never pulled are gone forever). After
   * it no match starts, no rating moves and no Prototype copy is minted
   * from a retired run (an opened pack's Prototype bonus is a Gold, as when
   * every run is used up); the schema refuses each too. Refused while any
   * match is live (the ladder lets its matches finish first) and once the
   * season has ended. */
  endSeason(at: string = this.stamp()): SeasonEnd {
    if (this.schemaVersion < 26) throw new EconomyError("ending a season needs schema v26");
    return this.transaction(() => {
      if (this.seasonEnd() !== null) throw new EconomyError(`season ${this.season} has already ended`);
      const live = this.liveMatches().length;
      if (live > 0) throw new EconomyError(`${live} match${live === 1 ? " is" : "es are"} still live: end the season once ${live === 1 ? "it is" : "they are"} recorded`);
      const season = this.season;
      this.grantSeasonTierCoins(at);
      const insertStanding = this.db.prepare(
        `INSERT INTO season_standings (owner_id, rank, owner_name, agent_name, rating, rd, volatility, rated_matches, tier, wins, losses, draws)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const everyone = num((this.db.prepare("SELECT COUNT(*) AS n FROM ratings").get() as Row).n);
      for (const r of everyone === 0 ? [] : this.ladder({ at, limit: everyone })) {
        const { volatility } = this.rating(r.ownerId, at);
        insertStanding.run(r.ownerId, r.rank, r.ownerName, r.agent?.name ?? null, r.rating, r.rd, volatility, r.ratedMatches, r.tier, r.wins, r.losses, r.draws);
      }
      const insertRun = this.db.prepare(
        "INSERT INTO retired_prototype_runs (run_code, set_code, card_id, run_size, found, retired, retired_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      for (const set of seasonSets(season)) {
        for (const run of set.prototypes) {
          const found = this.prototypesFound(run.code);
          insertRun.run(run.code, set.code, run.cardId, run.runSize, found, run.runSize - found, at);
        }
      }
      this.db.prepare("INSERT INTO season_end (season, ended_at) VALUES (?, ?)").run(season, at);
      return this.seasonEnd()!;
    });
  }

  /** (v27) Refuses `what` once the season has ended (owner 2026-11-07,
   * answer 6: an ended file is frozen completely). The schema refuses the
   * same writes; this gives the plain reason first. */
  private refuseIfEnded(what: string): void {
    if (this.seasonEnded()) throw new EconomyError(`season ${this.season} has ended: ${what}; the file is the season's archive`);
  }

  // ---- the next season's file (v27; Season 0 game item 3, part 2) ----

  /** Which ended season this file was made from, or null (a first
   * season's file, or one made before v27). */
  seasonStart(): SeasonStart | null {
    if (this.schemaVersion < 27) return null;
    const row = this.db.prepare("SELECT * FROM season_start").get() as Row | undefined;
    if (!row) return null;
    return { season: str(row.season), fromSeason: str(row.from_season), fromEndedAt: str(row.from_ended_at), startedAt: str(row.started_at) };
  }

  /** The owner's soft-reset rating in a new season's file (null when the
   * owner had no rated match last season, or in a first season's file). It
   * is the owner's rating until the first rated match of this season. */
  ratingSeed(ownerId: string): RatingSeed | null {
    if (this.schemaVersion < 27) return null;
    const r = this.db.prepare("SELECT * FROM rating_seeds WHERE owner_id = ?").get(ownerId) as Row | undefined;
    if (!r) return null;
    return { ownerId, rating: num(r.rating), rd: num(r.rd), volatility: num(r.volatility), finalRating: num(r.final_rating), finalTier: str(r.final_tier) };
  }

  /** Makes the next season's file at `newPath` from the ended season's file
   * at `endedPath` (owner 2026-11-07, answers 1-5; 2026-11-08 on unopened
   * packs), in one transaction; the ended file is only read, and stays the
   * season's archive.
   *
   * Carried: every owner (its name, kind, starting faction and faction
   * lock), logins (password hashes as they are) and live sessions, account
   * settings, the Home board, agents with their names and name history,
   * agent drafts, signature cards with their bound copies (same copy ids),
   * every owned cosmetic (`carried_from` names the season) and every
   * agent's loadout, which agent is connected, and the retired Prototype
   * runs (so a run retired once never mints again in any later file).
   * Starts empty: the collection, decks, credits, pack points, packs
   * (unopened ones are lost), ratings, match history, notifications,
   * auto-play and the daily pack bank. Each ranked owner gets a soft-reset
   * seed, 1500 + (final - 1500) / 2 with RD 250 and its volatility, and
   * places again. Then every owner who had a starter collection gets the
   * starter grant again (its starting faction's deck, bound, and the
   * starter packs, of the new season's set, or the newest set while the
   * new season has none of its own yet).
   *
   * Refused: a season that hasn't ended, a new season code equal to the
   * ended one, a missing ended file (none is created), and a `newPath` that
   * already exists. On any failure the new file is removed, so a half-made
   * season never stays on disk. The ended file is never written (session
   * 85): it is opened read-only, and one at an older schema is migrated as a
   * temporary copy. */
  static startNextSeason(endedPath: string, newPath: string, options: { season: string; now?: () => Date; cosmetics?: readonly CosmeticItem[] }): NextSeasonReport {
    const season = options.season.trim();
    if (season === "") throw new EconomyError("name the new season (e.g. \"S1\")");
    if (newPath === ":memory:" || endedPath === ":memory:") throw new EconomyError("the next season is made from a season file into a new file");
    if (existsSync(newPath)) throw new EconomyError(`"${newPath}" already exists: the next season's file is always a new file`);
    if (!existsSync(endedPath)) throw new EconomyError(`no season file at "${endedPath}"`);
    // (session 85) The archive is only ever read: opened read-only, and an
    // older-schema archive is migrated as a temporary copy, never in place.
    return EconomyStore.withCurrentSchemaCopy(endedPath, (source) => EconomyStore.nextSeasonFrom(source, newPath, season, options));
  }

  private static nextSeasonFrom(endedPath: string, newPath: string, season: string, options: { now?: () => Date; cosmetics?: readonly CosmeticItem[] }): NextSeasonReport {
    const prev = EconomyStore.openReadOnly(endedPath, { now: options.now, cosmetics: options.cosmetics });
    let end: SeasonEnd;
    let leftBehind: NextSeasonReport["leftBehind"];
    try {
      const ended = prev.seasonEnd();
      if (ended === null) throw new EconomyError(`season ${prev.season} hasn't ended: end it first (POST /api/admin/season/end)`);
      if (season === ended.season) throw new EconomyError(`the new season must have a new name, not "${season}"`);
      end = ended;
      leftBehind = prev.archiveCounts();
    } finally {
      prev.close();
    }
    const next = EconomyStore.open(newPath, { now: options.now, season, cosmetics: options.cosmetics });
    try {
      const report = next.carryFrom(endedPath, end, leftBehind);
      next.close();
      return report;
    } catch (err) {
      next.close();
      for (const f of [newPath, `${newPath}-wal`, `${newPath}-shm`]) rmSync(f, { force: true });
      throw err;
    }
  }

  /** What an ended file holds that the next season's file starts without. */
  private archiveCounts(): NextSeasonReport["leftBehind"] {
    const count = (sql: string) => num((this.db.prepare(sql).get() as Row).n);
    return {
      cardCopies: count("SELECT COUNT(*) AS n FROM card_copies WHERE disposed_at IS NULL AND (origin_ref IS NULL OR origin_ref NOT LIKE 'signature:%')"),
      unopenedPacks: count("SELECT COUNT(*) AS n FROM packs WHERE opened_at IS NULL"),
      decks: count("SELECT COUNT(*) AS n FROM decks"),
      credits: count("SELECT COALESCE(SUM(delta), 0) AS n FROM ledger WHERE currency = 'credits'"),
      packPoints: count("SELECT COALESCE(SUM(delta), 0) AS n FROM ledger WHERE currency = 'packPoints'"),
      matches: count("SELECT COUNT(*) AS n FROM matches"),
      notifications: count("SELECT COUNT(*) AS n FROM notifications WHERE cleared_at IS NULL"),
    };
  }

  /** The new file's half of startNextSeason: this store is the new, empty
   * file; the ended one is attached read-only as `prev`. */
  private carryFrom(endedPath: string, end: SeasonEnd, leftBehind: NextSeasonReport["leftBehind"]): NextSeasonReport {
    if (this.listOwners().length > 0 || this.seasonStart() !== null) throw new EconomyError("the next season's file must start empty");
    const at = this.stamp();
    if (at < end.endedAt) throw new EconomyError(`season ${end.season} ended at ${end.endedAt}: the next season can't start before that (now ${at})`);
    const season = this.season;
    this.db.prepare("ATTACH DATABASE ? AS prev").run(`file:${endedPath}?mode=ro`);
    try {
      return this.transaction(() => {
        const cols = (table: string) => (this.db.prepare(`PRAGMA main.table_info(${table})`).all() as Row[]).map((c) => str(c.name)).join(", ");
        const copyAll = (table: string, where = "", order = "rowid", params: (string | number)[] = []) =>
          num(this.db.prepare(`INSERT INTO main.${table} (${cols(table)}) SELECT ${cols(table)} FROM prev.${table} ${where} ORDER BY ${order}`).run(...params).changes);
        const owners = num(
          this.db
            .prepare(
              `INSERT INTO main.owners (owner_id, name, kind, starting_faction, starter_granted_at, active_deck_id, created_at, connected_agent_id, faction_lock, deck_choice)
               SELECT owner_id, name, kind, starting_faction, NULL, NULL, created_at, NULL, faction_lock, 'agent' FROM prev.owners ORDER BY rowid`,
            )
            .run().changes,
        );
        const logins = copyAll("logins");
        const sessions = copyAll("sessions", "WHERE revoked_at IS NULL AND expires_at > ?", "rowid", [at]);
        copyAll("account_settings");
        copyAll("board_layouts");
        const agents = copyAll("agents");
        copyAll("agent_names", "", "entry_no");
        copyAll("agent_drafts");
        copyAll("signature_cards");
        const signatureCopies = copyAll("card_copies", "WHERE origin_ref LIKE 'signature:%' AND disposed_at IS NULL");
        const cosmetics = num(
          this.db
            .prepare(
              `INSERT INTO main.owned_cosmetics (owner_id, item_id, kind, source, ledger_entry_id, reward_ref, acquired_at, carried_from)
               SELECT owner_id, item_id, kind, source, NULL, reward_ref, acquired_at, COALESCE(carried_from, ?) FROM prev.owned_cosmetics ORDER BY rowid`,
            )
            .run(end.season).changes,
        );
        const loadoutSlots = copyAll("agent_loadouts");
        this.db.prepare("UPDATE main.owners SET connected_agent_id = (SELECT p.connected_agent_id FROM prev.owners p WHERE p.owner_id = owners.owner_id)").run();
        const retiredPrototypeRuns = copyAll("retired_prototype_runs");
        const insertSeed = this.db.prepare("INSERT INTO rating_seeds (owner_id, rating, rd, volatility, final_rating, final_tier) VALUES (?, ?, ?, ?, ?, ?)");
        for (const r of end.standings) {
          insertSeed.run(r.ownerId, RATING_START.rating + (r.rating - RATING_START.rating) * SEASON_RESET_PULL, SEASON_RESET_RD, r.volatility, r.rating, r.tier);
        }
        this.db.prepare("INSERT INTO season_start (season, from_season, from_ended_at, started_at) VALUES (?, ?, ?, ?)").run(season, end.season, end.endedAt, at);
        const setCode = this.currentSetCode;
        const starterGrants: NextSeasonReport["starterGrants"] = [];
        for (const o of this.db.prepare("SELECT owner_id, starting_faction FROM prev.owners WHERE starter_granted_at IS NOT NULL ORDER BY rowid").all() as Row[]) {
          const faction = str(o.starting_faction) as DeckFaction;
          const grant = this.grantStarterCollection(str(o.owner_id), faction, setCode);
          starterGrants.push({ ownerId: str(o.owner_id), faction, copies: grant.copies.length, packs: grant.packs.length });
        }
        const dangling = this.db.prepare("PRAGMA main.foreign_key_check").all() as Row[];
        if (dangling.length > 0) throw new EconomyError(`the new season's file would have ${dangling.length} dangling reference(s), e.g. in ${String(dangling[0]!.table)}`);
        return {
          ...this.seasonStart()!,
          owners,
          logins,
          sessions,
          agents,
          signatureCopies,
          cosmetics,
          loadoutSlots,
          retiredPrototypeRuns,
          ratingSeeds: end.standings.length,
          starterGrants,
          leftBehind,
        };
      });
    } finally {
      this.db.exec("DETACH DATABASE prev");
    }
  }

  /** A new agent's boast slot: the starter boast of the owner's faction
   * lock, else its starting faction, if the owner has it. An agent that
   * already wears a boast keeps it. */
  private equipFactionBoast(ownerId: string, agentId: string, at: string): void {
    const owner = this.getOwner(ownerId);
    const faction = owner.factionLock ?? owner.startingFaction;
    if (faction === null) return;
    const itemId = STARTER_BOASTS[faction].itemId;
    if (!this.ownsCosmetic(ownerId, itemId)) return;
    this.db.prepare("INSERT INTO agent_loadouts (agent_id, slot, item_id, set_at) VALUES (?, 'boast', ?, ?) ON CONFLICT DO NOTHING").run(agentId, itemId, at);
  }

  /** What the agent has equipped, by slot (null = empty). */
  loadout(agentId: string): Loadout {
    const loadout = Object.fromEntries(LOADOUT_SLOTS.map((slot) => [slot, null])) as Loadout;
    if (this.schemaVersion < 11) return loadout;
    for (const r of this.db.prepare("SELECT slot, item_id FROM agent_loadouts WHERE agent_id = ?").all(agentId) as Row[]) {
      loadout[str(r.slot) as LoadoutSlot] = str(r.item_id);
    }
    return loadout;
  }

  /** Equips an owned item in one of the agent's slots, or empties the slot
   * (null). Refused: another owner's agent, an item of the wrong kind for
   * the slot, an item the owner doesn't own, and any change while the
   * owner is in a live match (the match records the loadout it started
   * with). */
  setLoadout(ownerId: string, agentId: string, slot: LoadoutSlot, itemId: string | null): Loadout {
    if (!LOADOUT_SLOTS.includes(slot)) throw new EconomyError(`no loadout slot "${slot}"`);
    const agent = this.getAgent(agentId);
    if (agent.ownerId !== ownerId) throw new EconomyError("an owner can only dress its own agents");
    if (this.liveMatchOf(ownerId) !== null) throw new EconomyError("no loadout changes during a live match");
    if (itemId !== null) {
      const item = this.catalogue.get(itemId);
      if (!item) throw new EconomyError(`no cosmetic "${itemId}"`);
      if (item.kind !== SLOT_KIND[slot]) throw new EconomyError(`"${item.name}" is ${KIND_LABEL[item.kind]}; the ${slot} slot takes ${KIND_LABEL[SLOT_KIND[slot]]}`);
      if (!this.ownsCosmetic(ownerId, itemId)) throw new EconomyError(`the owner doesn't own "${item.name}"`);
    }
    this.transaction(() => {
      try {
        if (itemId === null) {
          this.db.prepare("DELETE FROM agent_loadouts WHERE agent_id = ? AND slot = ?").run(agentId, slot);
        } else {
          this.db
            .prepare("INSERT INTO agent_loadouts (agent_id, slot, item_id, set_at) VALUES (?, ?, ?, ?) ON CONFLICT (agent_id, slot) DO UPDATE SET item_id = excluded.item_id, set_at = excluded.set_at")
            .run(agentId, slot, itemId, this.stamp());
        }
      } catch (err) {
        refused(err);
      }
    });
    return this.loadout(agentId);
  }

  /** The boast a won match plays (owner 2026-10-19 decision 5): the
   * close-win boast when the winner ended on CLOSE_WIN_HEALTH or less and
   * has one, else the main boast, else the starter boast of the faction its
   * deck played (render session 30 call 6). Null when none of those is
   * known. The agent never chooses. Public since session 72: the live
   * ladder calls it once a live match's last move is out, with the same
   * loadout and deck the record will use (neither can change while the
   * match is live), so the live view shows the boast the record keeps. */
  matchBoast(agentId: string, loadout: Loadout, deckId: string | null, winnerHealth: number | null): MatchBoast | null {
    if (winnerHealth !== null && winnerHealth <= CLOSE_WIN_HEALTH && loadout.closeWinBoast !== null) {
      return { agentId, itemId: loadout.closeWinBoast, slot: "closeWinBoast", winnerHealth };
    }
    if (loadout.boast !== null) return { agentId, itemId: loadout.boast, slot: "boast", winnerHealth };
    if (deckId === null) return null;
    const faction = this.deckFactionOf(deckId);
    return { agentId, itemId: STARTER_BOASTS[faction].itemId, slot: "factionStarter", winnerHealth };
  }

  // ---- live matches ----

  /** Starts a match between two owners (opponents are server-assigned).
   * Each side is played by the owner's connected agent with the owner's
   * active deck, loaded from the copies held now. Refused: the same owner
   * on both sides, an owner without a connected agent or an active deck, an
   * incomplete or illegal deck, a deck outside the faction lock, and an
   * owner already in a live match. Until `recordMatch` closes it, neither
   * owner can switch or disconnect its agent. */
  startMatch(input: { matchId: string; p1OwnerId: string; p2OwnerId: string }): LiveMatch {
    if (input.p1OwnerId === input.p2OwnerId) throw new EconomyError("an owner's own agents never play each other in rewarded play");
    return this.transaction(() => {
      if (this.seasonEnded()) throw new EconomyError(`season ${this.season} has ended: no match starts`);
      const schedule = this.seasonSchedule();
      if (schedule !== null && this.stamp() >= schedule.endsAt) {
        throw new EconomyError(`season ${this.season}'s end time (${schedule.endsAt}) has passed: no match starts`);
      }
      if (this.db.prepare("SELECT 1 FROM live_matches WHERE match_id = ?").get(input.matchId)) {
        throw new EconomyError(`match "${input.matchId}" is already live`);
      }
      const side = (ownerId: string): LiveSide => {
        const owner = this.getOwner(ownerId);
        if (owner.connectedAgentId === null) throw new EconomyError(`owner "${owner.name}" has no connected agent`);
        if (owner.activeDeckId === null) {
          throw new EconomyError(
            owner.deckChoice === "agent" ? `owner "${owner.name}" has no active deck: the agent hasn't built one yet` : `owner "${owner.name}" has no active deck`,
          );
        }
        if (this.liveMatchOf(ownerId) !== null) throw new EconomyError(`owner "${owner.name}" is already in a live match`);
        const deck = this.loadDeck(owner.activeDeckId);
        if (owner.factionLock !== null && deckFaction(deck.spec.cards) !== owner.factionLock) {
          throw new EconomyError(`owner "${owner.name}" is locked to ${owner.factionLock}; the active deck isn't`);
        }
        // The connected agent's signature card plays from the signature
        // zone: switching agents changes only this (owner app spec B).
        const signature = this.signatureCard(owner.connectedAgentId);
        if (signature) deck.spec.signature = signature.card;
        return {
          ownerId,
          agentId: owner.connectedAgentId,
          deck,
          loadout: this.loadout(owner.connectedAgentId),
          playStyle: this.getAgent(owner.connectedAgentId).playStyle,
        };
      };
      const p1 = side(input.p1OwnerId);
      const p2 = side(input.p2OwnerId);
      const startedAt = this.stamp();
      const ratingsAtStart =
        this.schemaVersion >= 20 ? { p1: this.rating(p1.ownerId, startedAt).rating, p2: this.rating(p2.ownerId, startedAt).rating } : null;
      try {
        if (ratingsAtStart !== null) {
          this.db
            .prepare(
              `INSERT INTO live_matches (match_id, p1_owner, p2_owner, p1_agent, p2_agent, started_at, p1_style, p2_style, p1_rating_start, p2_rating_start)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(input.matchId, p1.ownerId, p2.ownerId, p1.agentId, p2.agentId, startedAt, p1.playStyle, p2.playStyle, ratingsAtStart.p1, ratingsAtStart.p2);
        } else if (this.schemaVersion >= 13) {
          this.db
            .prepare(
              "INSERT INTO live_matches (match_id, p1_owner, p2_owner, p1_agent, p2_agent, started_at, p1_style, p2_style) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(input.matchId, p1.ownerId, p2.ownerId, p1.agentId, p2.agentId, startedAt, p1.playStyle, p2.playStyle);
        } else {
          this.db
            .prepare("INSERT INTO live_matches (match_id, p1_owner, p2_owner, p1_agent, p2_agent, started_at) VALUES (?, ?, ?, ?, ?, ?)")
            .run(input.matchId, p1.ownerId, p2.ownerId, p1.agentId, p2.agentId, startedAt);
        }
      } catch (err) {
        refused(err);
      }
      // (v29) A waiting allowance's clock starts now, at the first pairing.
      if (this.schemaVersion >= 29) {
        for (const ownerId of [p1.ownerId, p2.ownerId]) {
          const row = this.db.prepare("SELECT allowance_waiting_minutes FROM auto_play WHERE owner_id = ? AND is_on = 1").get(ownerId) as Row | undefined;
          if (!row || row.allowance_waiting_minutes == null) continue;
          this.db
            .prepare("UPDATE auto_play SET allowance_started_at = ?, allowance_ends_at = ?, allowance_waiting_minutes = NULL WHERE owner_id = ?")
            .run(startedAt, this.allowanceEnd(startedAt, num(row.allowance_waiting_minutes)), ownerId);
        }
      }
      return { matchId: input.matchId, startedAt, p1, p2, ratingsAtStart };
    });
  }

  /** The live match the owner is in, if any. */
  liveMatchOf(ownerId: string): { matchId: string; startedAt: string } | null {
    const row = this.db.prepare("SELECT match_id, started_at FROM live_matches WHERE p1_owner = ? OR p2_owner = ?").get(ownerId, ownerId) as
      | Row
      | undefined;
    return row ? { matchId: str(row.match_id), startedAt: str(row.started_at) } : null;
  }

  /** Every live match, oldest first (Watch live's source list). */
  liveMatches(): {
    matchId: string;
    p1OwnerId: string;
    p2OwnerId: string;
    p1AgentId: string;
    p2AgentId: string;
    startedAt: string;
    ratingsAtStart: { p1: number; p2: number } | null;
  }[] {
    return (this.db.prepare("SELECT * FROM live_matches ORDER BY started_at, rowid").all() as Row[]).map((r) => ({
      matchId: str(r.match_id),
      p1OwnerId: str(r.p1_owner),
      p2OwnerId: str(r.p2_owner),
      p1AgentId: str(r.p1_agent),
      p2AgentId: str(r.p2_agent),
      startedAt: str(r.started_at),
      ratingsAtStart: r.p1_rating_start != null && r.p2_rating_start != null ? { p1: num(r.p1_rating_start), p2: num(r.p2_rating_start) } : null,
    }));
  }

  // ---- admin: house owners (owner app spec C.10) ----

  /** The admin view's data: every house owner with its agents, connected
   * agent, wallet, collection size, unopened packs, stats and live state.
   * The caller checks `isAdmin` (the store holds the data, the server
   * holds the boundary). */
  houseRoster(): HouseOwnerRow[] {
    return this.listOwners()
      .filter((o) => o.kind === "house")
      .map((owner) => ({
        owner,
        agents: this.listAgents(owner.ownerId),
        connectedAgent: this.connectedAgent(owner.ownerId),
        credits: this.balance(owner.ownerId, "credits"),
        packPoints: this.balance(owner.ownerId, "packPoints"),
        copies: this.collection(owner.ownerId).length,
        unopenedPacks: this.unopenedPacks(owner.ownerId).length,
        stats: this.ownerStats(owner.ownerId),
        inLiveMatch: this.liveMatchOf(owner.ownerId) !== null,
      }));
  }

  // ---- ledger ----

  /** The top bar's wallet: both balances and the unopened packs. */
  wallet(ownerId: string): Wallet {
    this.getOwner(ownerId);
    return { credits: this.balance(ownerId, "credits"), packPoints: this.balance(ownerId, "packPoints"), unopenedPacks: this.unopenedPacks(ownerId) };
  }

  /** A balance is never stored: it's the sum of the owner's ledger. */
  balance(ownerId: string, currency: Currency = "credits"): number {
    const row = this.db
      .prepare("SELECT COALESCE(SUM(delta), 0) AS total FROM ledger WHERE owner_id = ? AND currency = ?")
      .get(ownerId, currency) as Row;
    return num(row.total);
  }

  ledger(ownerId: string): LedgerEntry[] {
    return (this.db.prepare("SELECT * FROM ledger WHERE owner_id = ? ORDER BY entry_id").all(ownerId) as Row[]).map(ledgerEntryOf);
  }

  /** One page of the owner's ledger, newest first: at most `limit` entries
   * older than entry `before` (all of them when it's null), and whether
   * older ones remain. Paged in SQL (session 65; it used to read the whole
   * ledger and slice it in the API). */
  ledgerPage(ownerId: string, options: { limit: number; before?: number | null }): { entries: LedgerEntry[]; more: boolean } {
    const { limit } = options;
    const before = options.before ?? null;
    if (!Number.isInteger(limit) || limit < 1) throw new EconomyError(`a ledger page needs a whole limit of at least 1, got ${limit}`);
    if (before !== null && !Number.isInteger(before)) throw new EconomyError(`"before" must be a whole entry id, got ${before}`);
    const rows = this.db
      .prepare("SELECT * FROM ledger WHERE owner_id = :o AND (:before IS NULL OR entry_id < :before) ORDER BY entry_id DESC LIMIT :n")
      .all({ o: ownerId, before, n: limit + 1 }) as Row[];
    return { entries: rows.slice(0, limit).map(ledgerEntryOf), more: rows.length > limit };
  }

  private appendLedger(
    ownerId: string,
    playedBy: string | null,
    currency: Currency,
    delta: number,
    reason: string,
    ref: string | null,
    at: string,
  ): number {
    if (!Number.isInteger(delta) || delta === 0) throw new EconomyError(`a ledger entry needs a non-zero whole delta, got ${delta}`);
    try {
      const result = this.db
        .prepare("INSERT INTO ledger (owner_id, played_by, currency, delta, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(ownerId, playedBy, currency, delta, reason, ref, at);
      return num(result.lastInsertRowid);
    } catch (err) {
      refused(err);
    }
  }

  // ---- owned copies ----

  /** Records one owned copy. Every copy is its own item with a hidden id
   * (owner 2026-10-04, C.1) and records its origin; crafted and starter
   * copies are account-bound (owner 2026-10-05). The card id must be a real,
   * ownable card. */
  grantCopy(input: GrantCopyInput): CardCopy {
    if (!getCard(input.cardId) && !zeroDayEntry(input.cardId) && !this.signatureCardById(input.cardId)) {
      throw new EconomyError(`no ownable card with id "${input.cardId}"`);
    }
    const copy: CardCopy = {
      copyId: randomUUID(),
      ownerId: input.ownerId,
      cardId: input.cardId,
      finish: input.finish ?? "standard",
      seriesKind: input.seriesKind ?? "set",
      seriesCode: input.seriesCode ?? null,
      serial: input.serial ?? null,
      runSize: input.runSize ?? null,
      stamp: input.stamp ?? null,
      origin: input.origin,
      originRef: input.originRef ?? null,
      accountBound: BOUND_ORIGINS.includes(input.origin) || isSignatureRef(input.originRef) || input.accountBound === true,
      acquiredAt: this.stamp(),
      secretCode: input.secretCode ?? null,
    };
    if (isSignatureRef(copy.originRef) && copy.origin !== "promo") {
      throw new EconomyError(`a signature card is granted as a promo copy, not a ${copy.origin} copy`);
    }
    if (!FINISHES.includes(copy.finish)) throw new EconomyError(`unknown finish "${copy.finish}"`);
    if (!SERIES_KINDS.includes(copy.seriesKind)) throw new EconomyError(`unknown series kind "${copy.seriesKind}"`);
    if (!COPY_ORIGINS.includes(copy.origin)) throw new EconomyError(`unknown copy origin "${copy.origin}"`);
    const chaseProblem = chaseCopyProblem(copy.cardId, copy.finish, copy.secretCode);
    if (chaseProblem !== null) throw new EconomyError(chaseProblem);
    try {
      // secret_code is named only on a copy that has one, so a store opened
      // at an older schema version (the migration tests) still grants
      // ordinary copies.
      const secretColumn = copy.secretCode === null ? "" : ", secret_code";
      const secretValue = copy.secretCode === null ? "" : ", ?";
      this.db
        .prepare(
          `INSERT INTO card_copies (copy_id, owner_id, card_id, finish, series_kind, series_code, serial, run_size,
             stamp, origin, origin_ref, account_bound, acquired_at${secretColumn})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${secretValue})`,
        )
        .run(
          copy.copyId,
          copy.ownerId,
          copy.cardId,
          copy.finish,
          copy.seriesKind,
          copy.seriesCode,
          copy.serial,
          copy.runSize,
          copy.stamp,
          copy.origin,
          copy.originRef,
          copy.accountBound ? 1 : 0,
          copy.acquiredAt,
          ...(copy.secretCode === null ? [] : [copy.secretCode]),
        );
    } catch (err) {
      refused(err);
    }
    return copy;
  }

  /** Grants many copies in one transaction (a pack's contents, a prize
   * batch): all of them or none. */
  grantCopies(inputs: readonly GrantCopyInput[]): CardCopy[] {
    return this.transaction(() => inputs.map((i) => this.grantCopy(i)));
  }

  /** The copies an owner holds right now (not salvaged or otherwise disposed
   * of), oldest first. */
  collection(ownerId: string): CardCopy[] {
    return (
      this.db
        .prepare("SELECT * FROM card_copies WHERE owner_id = ? AND disposed_at IS NULL ORDER BY acquired_at, rowid")
        .all(ownerId) as Row[]
    ).map((r) => this.copyFromRow(r));
  }

  getCopy(copyId: string): CardCopy & { disposedAt: string | null; disposedReason: string | null } {
    const row = this.db.prepare("SELECT * FROM card_copies WHERE copy_id = ?").get(copyId) as Row | undefined;
    if (!row) throw new EconomyError(`no copy "${copyId}"`);
    return { ...this.copyFromRow(row), disposedAt: strOrNull(row.disposed_at), disposedReason: strOrNull(row.disposed_reason) };
  }

  /** (v28) A copy's transfers, oldest first (none before v28). */
  copyTransfers(copyId: string): CopyTransfer[] {
    if (this.schemaVersion < 28) return [];
    return (this.db.prepare("SELECT * FROM copy_transfers WHERE copy_id = ? ORDER BY transfer_id").all(copyId) as Row[]).map((r) => ({
      transferId: num(r.transfer_id),
      copyId: str(r.copy_id),
      fromOwnerId: str(r.from_owner),
      toOwnerId: str(r.to_owner),
      kind: str(r.kind),
      ref: strOrNull(r.ref),
      at: str(r.at),
    }));
  }

  /** (v28, marketplace groundwork, owner 2026-11-10) Where a copy came from
   * and every owner it has had. Throws if a record the copy names is
   * missing, so a broken chain is found, not papered over. */
  copyProvenance(copyId: string): CopyProvenance {
    const copy = this.getCopy(copyId);
    const ref = copy.originRef;
    let source: CopyProvenance["source"];
    if (copy.origin === "pack" && ref?.startsWith("pack:")) {
      const packId = ref.slice("pack:".length);
      const row = this.db
        .prepare(
          `SELECT p.source, p.set_code, p.acquired_at, o.opened_at, o.odds_version, o.seed
           FROM packs p JOIN pack_openings o ON o.pack_id = p.pack_id WHERE p.pack_id = ?`,
        )
        .get(packId) as Row | undefined;
      if (!row) throw new EconomyError(`copy "${copyId}" names pack "${packId}", which has no opening on record`);
      source = {
        kind: "pack",
        packId,
        packSource: str(row.source) as PackSource,
        setCode: str(row.set_code),
        packAcquiredAt: str(row.acquired_at),
        openedAt: str(row.opened_at),
        oddsVersion: str(row.odds_version),
        seed: num(row.seed),
      };
    } else if (copy.origin === "crafted") {
      const row = this.db
        .prepare("SELECT entry_id, reason, delta FROM ledger WHERE owner_id = ? AND currency = 'packPoints' AND reason IN ('craft', 'craftSecret') AND ref = ?")
        .get(copy.ownerId, copyId) as Row | undefined;
      if (!row) throw new EconomyError(`crafted copy "${copyId}" has no pack-points payment on record`);
      source = { kind: "crafted", ledgerEntryId: num(row.entry_id), reason: str(row.reason), packPoints: -num(row.delta) };
    } else if (copy.origin === "starter" && ref?.startsWith("starter:")) {
      source = { kind: "starter", faction: ref.slice("starter:".length) };
    } else if (isSignatureRef(ref)) {
      source = { kind: "signature", agentId: ref!.slice(SIGNATURE_ORIGIN_REF_PREFIX.length) };
    } else {
      source = { kind: "other", origin: copy.origin, originRef: ref };
    }
    const transfers = this.copyTransfers(copyId);
    const firstOwnerId = transfers[0]?.fromOwnerId ?? copy.ownerId;
    const owners: CopyProvenance["owners"] = [{ ownerId: firstOwnerId, from: copy.acquiredAt, until: null, via: null }];
    for (const t of transfers) {
      owners[owners.length - 1]!.until = t.at;
      owners.push({ ownerId: t.toOwnerId, from: t.at, until: null, via: t });
    }
    if (owners[owners.length - 1]!.ownerId !== copy.ownerId) {
      throw new EconomyError(`copy "${copyId}" is held by "${copy.ownerId}", but its transfer record ends with "${owners[owners.length - 1]!.ownerId}"`);
    }
    return { copy, source, firstOwnerId, owners, transferable: !copy.accountBound };
  }

  private copyFromRow(r: Row): CardCopy {
    return {
      copyId: str(r.copy_id),
      ownerId: str(r.owner_id),
      cardId: str(r.card_id),
      finish: str(r.finish) as Finish,
      seriesKind: str(r.series_kind) as SeriesKind,
      seriesCode: strOrNull(r.series_code),
      serial: numOrNull(r.serial),
      runSize: numOrNull(r.run_size),
      stamp: strOrNull(r.stamp),
      origin: str(r.origin) as CopyOrigin,
      originRef: strOrNull(r.origin_ref),
      accountBound: num(r.account_bound) === 1,
      acquiredAt: str(r.acquired_at),
      secretCode: strOrNull(r.secret_code),
    };
  }

  // ---- salvage (manual only, owner 2026-10-07) ----
  //
  // Nothing is ever salvaged automatically. The owner picks a card and a
  // quantity in the card viewer and confirms; pack points are paid in the
  // same transaction. Owners may hold as many copies as they like.

  /** The card viewer's data for one card: copies held, how many salvage and
   * for how much, why the rest can't, and the saved decks that use it. */
  cardHoldings(ownerId: string, cardId: string): CardHoldings {
    // A signature card is in no set, but the card viewer shows it too.
    const card = getCard(cardId) ?? this.signatureCardById(cardId)?.card ?? zeroDayEntry(cardId);
    if (!card) throw new EconomyError(`no ownable card with id "${cardId}"`);
    const copies = this.collection(ownerId).filter((c) => c.cardId === cardId);
    const reasons = new Map<string, number>();
    let salvageable = 0;
    for (const c of copies) {
      const why = salvageBlockReason(c);
      if (why === null) salvageable++;
      else reasons.set(why, (reasons.get(why) ?? 0) + 1);
    }
    const activeDeckId = this.getOwner(ownerId).activeDeckId;
    const decks = this.deckUses(ownerId, cardId).map((d) => ({ ...d, active: d.deckId === activeDeckId }));
    const setCard = getCard(cardId);
    const zeroDay = zeroDayEntry(cardId) !== undefined;
    const copyLimit = !setCard && !zeroDay ? null : setCard?.topTier || zeroDay ? TOP_TIER_COPY_LIMIT : COPY_LIMITS[card.rarity];
    let craft: CardHoldings["craft"] = null;
    if (setCard && !zeroDay) {
      // The same checks as craftCard, in its words.
      const cost = CRAFT_PACK_POINTS[setCard.rarity];
      const limit = COPY_LIMITS[setCard.rarity];
      const have = this.balance(ownerId, "packPoints");
      const reason =
        copies.length >= limit
          ? `you already hold ${copies.length} of "${setCard.name}"; crafting stops at its playable limit of ${limit}`
          : have < cost
            ? `crafting "${setCard.name}" costs ${cost} pack points; you have ${have}`
            : null;
      craft = { packPoints: cost, available: reason === null, reason };
    }
    return {
      cardId,
      rarity: card.rarity,
      owned: copies.length,
      salvageable,
      packPointsEach: SALVAGE_PACK_POINTS[card.rarity],
      notSalvageable: [...reasons].map(([reason, count]) => ({ reason, count })),
      decks,
      copyLimit,
      craft,
    };
  }

  /** How many copies of a card each of the owner's saved decks uses. */
  private deckUses(ownerId: string, cardId: string): { deckId: string; name: string; uses: number }[] {
    return (
      this.db
        .prepare(
          `SELECT d.deck_id, d.name, COUNT(*) AS uses
           FROM decks d JOIN deck_copies dc ON dc.deck_id = d.deck_id JOIN card_copies c ON c.copy_id = dc.copy_id
           WHERE d.owner_id = ? AND c.card_id = ?
           GROUP BY d.deck_id ORDER BY d.created_at, d.rowid`,
        )
        .all(ownerId, cardId) as Row[]
    ).map((r) => ({ deckId: str(r.deck_id), name: str(r.name), uses: num(r.uses) }));
  }

  /** What salvaging `quantity` copies of a card would do, without doing it.
   * Refused when the quantity is more than the owner can salvage, with the
   * reasons the other copies can't go. */
  salvagePlan(ownerId: string, cardId: string, quantity: number): SalvagePlan {
    if (!Number.isInteger(quantity) || quantity < 1) throw new EconomyError(`salvage needs a whole quantity of at least 1, got ${quantity}`);
    const holdings = this.cardHoldings(ownerId, cardId);
    if (quantity > holdings.salvageable) {
      const why = holdings.notSalvageable.map((r) => `${r.count} x ${r.reason}`).join("; ");
      throw new EconomyError(
        `can't salvage ${quantity} of "${cardId}": ${holdings.salvageable} of ${holdings.owned} held can be salvaged${why ? ` (${why})` : ""}`,
      );
    }
    const listed = new Set(
      (this.db
        .prepare("SELECT dc.copy_id FROM deck_copies dc JOIN decks d ON d.deck_id = dc.deck_id WHERE d.owner_id = ?")
        .all(ownerId) as Row[]).map((r) => str(r.copy_id)),
    );
    // Copies are shared across decks, so which copy goes doesn't change any
    // deck's count; copies no deck lists go first so a deck keeps the exact
    // copies it was saved with where it can. Newest first after that.
    const eligible = this.collection(ownerId)
      .filter((c) => c.cardId === cardId && salvageBlockReason(c) === null)
      .reverse()
      .sort((a, b) => Number(listed.has(a.copyId)) - Number(listed.has(b.copyId)));
    const ownedAfter = holdings.owned - quantity;
    return {
      cardId,
      quantity,
      copies: eligible.slice(0, quantity),
      packPoints: quantity * holdings.packPointsEach,
      ownedAfter,
      affectedDecks: holdings.decks
        .filter((d) => d.uses > ownedAfter)
        .map((d) => ({ deckId: d.deckId, name: d.name, uses: d.uses, owned: ownedAfter, active: d.active })),
    };
  }

  /** Salvages `quantity` copies of one card, the owner's own choice. Each
   * copy is marked disposed (not deleted) and pays its pack points in the
   * same transaction. If it would leave saved decks short, it is refused with
   * `SalvageNeedsConfirmation` listing them unless `confirmDeckImpact` is set;
   * a deck is never edited, it is reported incomplete until fixed. The
   * schema refuses salvaging a bound copy or a finish even by raw SQL. */
  salvage(ownerId: string, cardId: string, quantity: number, options: { confirmDeckImpact?: boolean } = {}): SalvageResult {
    this.refuseIfEnded("no card is salvaged");
    return this.transaction(() => {
      const plan = this.salvagePlan(ownerId, cardId, quantity);
      if (plan.affectedDecks.length > 0 && options.confirmDeckImpact !== true) throw new SalvageNeedsConfirmation(plan.affectedDecks);
      const at = this.stamp();
      for (const c of plan.copies) {
        try {
          this.db
            .prepare("UPDATE card_copies SET disposed_at = ?, disposed_reason = 'salvaged' WHERE copy_id = ? AND disposed_at IS NULL")
            .run(at, c.copyId);
        } catch (err) {
          refused(err);
        }
        this.appendLedger(ownerId, null, "packPoints", plan.packPoints / plan.quantity, "salvage", c.copyId, at);
      }
      return { copies: plan.copies, packPoints: plan.packPoints, incompleteDecks: plan.affectedDecks };
    });
  }

  // ---- decks ----

  /** Saves a deck made of specific owned copies (owner 2026-10-04, C.2).
   * Ownership is checked here and again by the schema; the deck must also be
   * legal by the engine's own rules (copy limits, size, one faction plus
   * capped neutrals, the pool lint), so a deck that saves is a deck that
   * plays. Copies are shared across saved decks, not reserved (owner
   * 2026-10-07): owning 2 copies lets every deck use up to 2. Bound copies
   * play like any other. */
  saveDeck(ownerId: string, name: string, copyIds: readonly string[]): PlayableDeck {
    const spec = this.checkDeckCopies(ownerId, name, copyIds);
    const deckId = randomUUID();
    this.transaction(() => {
      try {
        this.db.prepare("INSERT INTO decks (deck_id, owner_id, name, created_at) VALUES (?, ?, ?, ?)").run(deckId, ownerId, name, this.stamp());
        this.writeDeckCopies(deckId, copyIds);
      } catch (err) {
        refused(err);
      }
    });
    return { deckId, name, copyIds: [...copyIds], spec };
  }

  /** Replaces a saved deck's list (how an owner fixes an incomplete deck),
   * under the same checks as saving one. */
  updateDeck(ownerId: string, deckId: string, copyIds: readonly string[]): PlayableDeck {
    const status = this.deckStatus(deckId);
    if (status.ownerId !== ownerId) throw new EconomyError(`deck "${status.name}" belongs to another owner`);
    const spec = this.checkDeckCopies(ownerId, status.name, copyIds);
    this.transaction(() => {
      try {
        this.db.prepare("DELETE FROM deck_copies WHERE deck_id = ?").run(deckId);
        this.writeDeckCopies(deckId, copyIds);
        // An edit forgets what the agent built it from (buildAgentDeck sets
        // it again right after its own edit).
        if (this.schemaVersion >= 14) this.db.prepare(`UPDATE decks SET built_style = NULL, built_lock = NULL, built_holdings = NULL${this.schemaVersion >= 25 ? ", built_rule = NULL" : ""} WHERE deck_id = ?`).run(deckId);
      } catch (err) {
        refused(err);
      }
    });
    return { deckId, name: status.name, copyIds: [...copyIds], spec };
  }

  private checkDeckCopies(ownerId: string, name: string, copyIds: readonly string[]): DeckSpec {
    if (new Set(copyIds).size !== copyIds.length) throw new EconomyError(`deck "${name}" lists the same copy twice`);
    const copies = copyIds.map((id) => this.getCopy(id));
    for (const c of copies) {
      if (c.ownerId !== ownerId) throw new EconomyError(`deck "${name}": copy ${c.copyId} belongs to another owner`);
      if (c.disposedAt !== null) throw new EconomyError(`deck "${name}": copy ${c.copyId} is no longer owned`);
    }
    return this.legalSpec(name, copies);
  }

  private writeDeckCopies(deckId: string, copyIds: readonly string[]): void {
    const add = this.db.prepare("INSERT INTO deck_copies (deck_id, copy_id) VALUES (?, ?)");
    for (const id of copyIds) add.run(deckId, id);
  }

  /** Groups copies by card and runs the engine's deck builder, which throws
   * on any illegal deck. Any finish counts toward ownership. */
  private legalSpec(name: string, copies: readonly CardCopy[]): DeckSpec {
    const byCard = new Map<string, { card: Card; copies: number }>();
    for (const c of copies) {
      const card = getCard(c.cardId);
      if (!card && this.signatureCardById(c.cardId)) {
        throw new EconomyError(`deck "${name}": a signature card plays from its own zone, never from the deck`);
      }
      if (!card && zeroDayEntry(c.cardId)) {
        throw new EconomyError(`deck "${name}": Zero-Day card ${c.cardId} isn't designed yet; it becomes playable when it is`);
      }
      if (!card) throw new EconomyError(`deck "${name}": card "${c.cardId}" is not ownable any more`);
      const entry = byCard.get(c.cardId) ?? { card, copies: 0 };
      entry.copies++;
      byCard.set(c.cardId, entry);
    }
    try {
      return buildDeck("p1", name, [...byCard.values()]);
    } catch (err) {
      throw new EconomyError(err instanceof Error ? err.message : String(err));
    }
  }

  /** The owner forces a deck: whichever agent is connected plays it, and
   * the deck choice becomes "forced" (owner 2026-10-15). With a faction
   * lock set, only a deck of that faction can be made active. */
  setActiveDeck(ownerId: string, deckId: string): void {
    this.transaction(() => {
      this.activateDeck(ownerId, deckId);
      // A file before v12 has no deck choice; migration 12 marks every owner
      // with an active deck "forced", so skipping the write here is the same.
      if (this.schemaVersion >= 12) this.db.prepare("UPDATE owners SET deck_choice = 'forced' WHERE owner_id = ?").run(ownerId);
    });
  }

  private activateDeck(ownerId: string, deckId: string | null): void {
    const lock = this.getOwner(ownerId).factionLock;
    if (lock !== null && deckId !== null) {
      const faction = this.deckFactionOf(deckId);
      if (faction !== lock) throw new EconomyError(`the owner's faction lock is ${lock}; this deck is ${faction}`);
    }
    try {
      this.db.prepare("UPDATE owners SET active_deck_id = ? WHERE owner_id = ?").run(deckId, ownerId);
    } catch (err) {
      refused(err);
    }
  }

  /** Who picks the deck (Settings -> Play). "agent" hands it back to the
   * agent: its built deck becomes active if there is one that fits the
   * faction lock, else none is active until `buildAgentDeck` runs.
   * "forced" keeps the active deck the owner has (refused with none). */
  setDeckChoice(ownerId: string, choice: DeckChoice): void {
    if (choice !== "agent" && choice !== "forced") throw new EconomyError(`unknown deck choice "${choice as string}"`);
    if (this.schemaVersion < 12) throw new EconomyError("the deck choice needs schema v12");
    this.transaction(() => {
      const owner = this.getOwner(ownerId);
      if (choice === "forced") {
        if (owner.activeDeckId === null) throw new EconomyError(`owner "${owner.name}" has no active deck to force; make one active`);
      } else {
        const built = this.agentDeckId(ownerId);
        const fits = built !== null && (owner.factionLock === null || this.deckFactionOf(built) === owner.factionLock);
        this.activateDeck(ownerId, fits ? built : null);
      }
      this.db.prepare("UPDATE owners SET deck_choice = ? WHERE owner_id = ?").run(choice, ownerId);
    });
  }

  /** (v14) What the agent's deck was built from, or null when the store
   * doesn't know (no agent deck, built before v14, or edited by hand). */
  agentDeckBuiltFrom(ownerId: string): AgentDeckBuiltFrom | null {
    if (this.schemaVersion < 14) return null;
    const v25 = this.schemaVersion >= 25;
    const row = this.db.prepare(`SELECT built_style, built_lock, built_holdings${v25 ? ", built_rule" : ""} FROM decks WHERE owner_id = ? AND built_by_agent = 1`).get(ownerId) as Row | undefined;
    if (!row || row.built_style === null) return null;
    const lock = str(row.built_lock);
    const rule = v25 && row.built_rule !== null && row.built_rule !== undefined ? str(row.built_rule) : "plain";
    return { style: str(row.built_style) as PlayStyleId, factionLock: lock === "none" ? null : (lock as DeckFaction), holdings: str(row.built_holdings), rule };
  }

  /** What the agent would build from now: the connected agent's style
   * (Calculator with none connected), the faction lock and the cards held. */
  private agentDeckInputs(ownerId: string): AgentDeckBuiltFrom & { held: CardCopy[] } {
    const owner = this.getOwner(ownerId);
    const held = this.collection(ownerId);
    const style = owner.connectedAgentId === null ? DEFAULT_PLAY_STYLE : this.getAgent(owner.connectedAgentId).playStyle;
    // The rule is the store's (the builder's default): what a rebuild uses.
    return { style, factionLock: owner.factionLock, holdings: playableHoldingsFingerprint(held.map((c) => c.cardId), owner.factionLock), rule: builderRule(), held };
  }

  /**
   * (v14) Why the agent's deck should be rebuilt, or [] when it is up to
   * date (owner 2026-10-15/-20: the agent rebuilds when the owner's cards,
   * the faction lock or its play style change, not before every match).
   * "The cards held" counts only cards the builder could put in the deck
   * (session 55): a spare past a card's deck limit, or a card of a faction
   * the lock rules out, is not a reason.
   * Always [] while the owner forces a deck: the agent's deck isn't played.
   */
  agentDeckRebuildReasons(ownerId: string): string[] {
    if (this.schemaVersion < 14) throw new EconomyError("rebuild tracking needs schema v14");
    if (this.getOwner(ownerId).deckChoice === "forced") return [];
    if (this.agentDeckId(ownerId) === null) return ["the agent hasn't built a deck yet"];
    const was = this.agentDeckBuiltFrom(ownerId);
    if (was === null) return ["the store doesn't know what the deck was built from (built before v14, or edited by hand)"];
    const now = this.agentDeckInputs(ownerId);
    const reasons: string[] = [];
    // The cards are read the way the deck was built: under the lock it was
    // built with (a lock change is its own reason), and in the fingerprint
    // it recorded (a deck built before session 55 counted every card).
    const ids = now.held.map((c) => c.cardId);
    const held = was.holdings.startsWith("p:") ? playableHoldingsFingerprint(ids, was.factionLock) : holdingsFingerprint(ids);
    if (was.holdings !== held) reasons.push("the cards held changed");
    if (was.factionLock !== now.factionLock) reasons.push(`the faction lock changed (${was.factionLock ?? "none"} -> ${now.factionLock ?? "none"})`);
    if (was.style !== now.style) reasons.push(`the play style changed (${PLAY_STYLES[was.style].name} -> ${PLAY_STYLES[now.style].name})`);
    // (v25) A deck built under another pick rule (owner 2026-11-06: the
    // builder's 1-SD rule reaches existing agent decks through the normal
    // rebuild reasons; a deck built before v25 used the plain rule).
    if (this.schemaVersion >= 25 && was.rule !== now.rule) reasons.push(`the builder's rule changed (${describeBuilderRule(was.rule)} -> ${describeBuilderRule(now.rule)})`);
    // A deck built before option B (owner 2026-10-26) may be shorter than
    // the cards held allow; the builder now never cuts one short. Read
    // only when nothing else already asks (any other reason rebuilds it).
    if (reasons.length === 0) {
      const deckId = this.agentDeckId(ownerId)!;
      const listed = this.deckListing(deckId).listed;
      const allow = largestDeck(this.deckFactionOf(deckId), holdingsOf(ids));
      if (listed.length < allow) reasons.push(`the deck has ${listed.length} cards and the cards held allow ${allow} (the agent builds to that since session 58)`);
    }
    return reasons;
  }

  /** (v14) Rebuilds the agent's deck if `agentDeckRebuildReasons` names a
   * reason, else does nothing (null). What a scheduler (the ladder, item
   * 6b) calls between matches. */
  async rebuildAgentDeckIfNeeded(
    ownerId: string,
    options: Omit<DeckBuildOptions, "faction" | "style"> = {},
    choose: DeckChooser = chooseDeck,
  ): Promise<{ reasons: string[]; build: AgentDeckBuild } | null> {
    const reasons = this.agentDeckRebuildReasons(ownerId);
    if (reasons.length === 0) return null;
    return { reasons, build: await this.buildAgentDeck(ownerId, options, choose) };
  }

  /** The id of the deck the agent built for this owner, if any. */
  agentDeckId(ownerId: string): string | null {
    const row = this.db.prepare("SELECT deck_id FROM decks WHERE owner_id = ? AND built_by_agent = 1").get(ownerId) as Row | undefined;
    return row ? str(row.deck_id) : null;
  }

  /**
   * The deck-building agent (roadmap 2b; owner 2026-10-15): builds the best
   * deck it can from the cards the owner holds now, in the faction lock if
   * one is set, else in whichever faction plays best (the engine's
   * `chooseDeck`, measured by games against the shipped decks; `options`
   * sets how many), played in the connected agent's play style (v14;
   * Calculator with none connected or before v14). Saves it as the owner's agent deck (created once, then
   * rebuilt in place) and makes it active. Refused while the owner forces
   * a deck. Run it when the holdings change (packs opened, crafting,
   * salvage) or the faction lock does; a match never waits on it.
   * `choose` is the engine's `chooseDeck` unless the caller runs the same
   * games elsewhere (the server runs them on a worker thread, session 56,
   * so a build that takes minutes never stalls its other requests).
   */
  async buildAgentDeck(ownerId: string, options: Omit<DeckBuildOptions, "faction" | "style"> = {}, choose: DeckChooser = chooseDeck): Promise<AgentDeckBuild> {
    const owner = this.getOwner(ownerId);
    if (owner.deckChoice === "forced") throw new EconomyError(`owner "${owner.name}" forces a deck; set the deck choice to the agent first`);
    const inputs = this.agentDeckInputs(ownerId);
    const held = inputs.held;
    const style = this.schemaVersion >= 14 ? inputs.style : DEFAULT_PLAY_STYLE;
    const holdings = holdingsOf(held.map((c) => c.cardId));
    const built = await (async () => {
      try {
        return await choose(holdings, { ...options, faction: owner.factionLock ?? undefined, style });
      } catch (err) {
        throw new EconomyError(err instanceof Error ? err.message : String(err));
      }
    })();
    // Option B (owner 2026-10-26): the agent's deck is 40 cards when the
    // owner holds 40 usable ones, else every usable card. The engine's
    // builder builds to that; the store checks it, since `choose` may be a
    // stand-in (the server's worker).
    // The rule the build used: the engine's answer, or (a stand-in chooser
    // that doesn't say) the one these options select.
    const rule = built.rule ?? builderRule(options);
    const want = largestDeck(built.faction, holdings);
    const got = [...built.list.values()].reduce((s, n) => s + n, 0);
    if (got !== want) throw new EconomyError(`the agent built ${got} cards; the cards held allow ${want}, and the agent's deck uses that many`);
    const deck = this.transaction(() => {
      // Copies for the list, oldest held first (the collection's order),
      // read again here: the owner may have salvaged a card while the agent
      // built, and a list the cards held now can't fill isn't saved.
      const now = this.collection(ownerId);
      const copyIds: string[] = [];
      const short: string[] = [];
      for (const [cardId, n] of built.list) {
        const copies = now.filter((c) => c.cardId === cardId).slice(0, n);
        if (copies.length < n) short.push(`${getCard(cardId)?.name ?? cardId} (uses ${n}, holds ${copies.length})`);
        copyIds.push(...copies.map((c) => c.copyId));
      }
      if (short.length > 0) throw new EconomyError(`the cards held changed while the agent built (${short.join(", ")}); build again`);
      const existing = this.agentDeckId(ownerId);
      let saved: PlayableDeck;
      if (existing !== null) {
        saved = this.updateDeck(ownerId, existing, copyIds);
      } else {
        saved = this.saveDeck(ownerId, AGENT_DECK_NAME, copyIds);
        this.db.prepare("UPDATE decks SET built_by_agent = 1 WHERE deck_id = ?").run(saved.deckId);
      }
      // What it was built from, as read before the games (a change made
      // while the agent built shows up as a rebuild reason).
      if (this.schemaVersion >= 14) {
        this.db
          .prepare("UPDATE decks SET built_style = ?, built_lock = ?, built_holdings = ? WHERE deck_id = ?")
          .run(style, owner.factionLock ?? "none", inputs.holdings, saved.deckId);
      }
      if (this.schemaVersion >= 25) this.db.prepare("UPDATE decks SET built_rule = ? WHERE deck_id = ?").run(rule, saved.deckId);
      // The owner may have switched to a forced deck while the agent built.
      if (this.getOwner(ownerId).deckChoice === "agent") this.activateDeck(ownerId, saved.deckId);
      return saved;
    });
    return {
      deck,
      faction: built.faction,
      style,
      rule,
      factions: built.factions.map((b) => ({
        faction: b.faction,
        ...(b.infeasible ? { infeasible: b.infeasible } : {}),
        ...(b.score ? { winRate: b.score.wins / b.score.games } : {}),
        ...(b.chosen ? { chosen: b.chosen } : {}),
        ...(b.starts.length ? { starts: b.starts.map((st) => ({ from: st.from, ...(st.score ? { winRate: st.score.wins / st.score.games } : {}) })) } : {}),
        kept: b.kept,
      })),
    };
  }

  /** The faction a recorded match's deck played, or null without a deck (or
   * one that names no single faction, which a played deck never does). */
  private playedFaction(deckId: string | null): DeckFaction | null {
    if (deckId === null) return null;
    try {
      return this.deckFactionOf(deckId);
    } catch {
      return null;
    }
  }

  private deckFactionOf(deckId: string): DeckFaction {
    const cards = this.deckListing(deckId).listed.map((l) => getCard(l.cardId)).filter((c): c is Card => c !== undefined);
    return deckFaction(cards);
  }

  /** A deck's saved list: the copies it was saved with, in order, and each
   * one's card (disposed copies included, so the card counts survive). */
  private deckListing(deckId: string): { name: string; ownerId: string; listed: { copyId: string; cardId: string }[] } {
    const deck = this.db.prepare("SELECT * FROM decks WHERE deck_id = ?").get(deckId) as Row | undefined;
    if (!deck) throw new EconomyError(`no deck "${deckId}"`);
    const listed = (
      this.db
        .prepare("SELECT dc.copy_id, c.card_id FROM deck_copies dc JOIN card_copies c ON c.copy_id = dc.copy_id WHERE dc.deck_id = ? ORDER BY dc.rowid")
        .all(deckId) as Row[]
    ).map((r) => ({ copyId: str(r.copy_id), cardId: str(r.card_id) }));
    return { name: str(deck.name), ownerId: str(deck.owner_id), listed };
  }

  /** Resolves a deck's list against what the owner holds now. A deck
   * counts cards, not particular copies: each slot keeps the copy it was
   * saved with while the owner still holds it, and otherwise takes another
   * held copy of the same card (oldest first). A slot no held copy can fill
   * is missing. */
  private resolveDeck(deckId: string) {
    const { name, ownerId, listed } = this.deckListing(deckId);
    const held = new Map<string, string[]>();
    for (const c of this.collection(ownerId)) held.set(c.cardId, [...(held.get(c.cardId) ?? []), c.copyId]);
    const used = new Set<string>();
    const slots: (string | null)[] = listed.map((l) => {
      if (held.get(l.cardId)?.includes(l.copyId)) {
        used.add(l.copyId);
        return l.copyId;
      }
      return null;
    });
    const missing = new Map<string, { uses: number; owned: number }>();
    listed.forEach((l, i) => {
      if (slots[i] !== null) return;
      const spare = (held.get(l.cardId) ?? []).find((id) => !used.has(id));
      if (spare !== undefined) {
        used.add(spare);
        slots[i] = spare;
        return;
      }
      const uses = listed.filter((x) => x.cardId === l.cardId).length;
      missing.set(l.cardId, { uses, owned: held.get(l.cardId)?.length ?? 0 });
    });
    return { name, ownerId, slots, missing };
  }

  /** Whether a saved deck can be played with what the owner holds now. */
  deckStatus(deckId: string): DeckStatus {
    const { name, ownerId, slots, missing } = this.resolveDeck(deckId);
    const { listed } = this.deckListing(deckId);
    const counts = new Map<string, number>();
    for (const l of listed) counts.set(l.cardId, (counts.get(l.cardId) ?? 0) + 1);
    const factions = new Set<string>();
    for (const cardId of counts.keys()) {
      const f = getCard(cardId)?.faction;
      if (f && f !== "Neutral") factions.add(f);
    }
    return {
      deckId,
      name,
      ownerId,
      active: this.getOwner(ownerId).activeDeckId === deckId,
      complete: missing.size === 0,
      missing: [...missing].map(([cardId, m]) => ({ cardId, ...m })),
      cards: slots.length,
      faction: factions.size === 1 ? ([...factions][0] as DeckFaction) : null,
      list: [...counts].map(([cardId, copies]) => ({ cardId, copies })),
    };
  }

  /** The owner's saved decks, oldest first, each with its status. */
  listDecks(ownerId: string): DeckStatus[] {
    return (this.db.prepare("SELECT deck_id FROM decks WHERE owner_id = ? ORDER BY created_at, rowid").all(ownerId) as Row[]).map((r) =>
      this.deckStatus(str(r.deck_id)),
    );
  }

  /** Loads a saved deck for play from the copies the owner holds now (a
   * deck counts cards; copies are shared across decks), and re-checks it is
   * legal (a card pool change can make an old deck illegal). Refused while
   * the deck is incomplete. The returned spec's player slot is set by the
   * caller. */
  loadDeck(deckId: string): PlayableDeck {
    const { name, slots, missing } = this.resolveDeck(deckId);
    if (missing.size > 0) {
      const what = [...missing].map(([cardId, m]) => `${getCard(cardId)?.name ?? cardId} (uses ${m.uses}, holds ${m.owned})`).join(", ");
      throw new EconomyError(`deck "${name}" is incomplete: ${what}`);
    }
    const copyIds = slots as string[];
    return { deckId, name, copyIds, spec: this.legalSpec(name, copyIds.map((id) => this.getCopy(id))) };
  }

  // ---- packs ----

  /** The owner spends credits on a pack: the debit and the new unopened pack
   * happen together or not at all, and the schema refuses a purchase the
   * balance can't cover. */
  buyPack(ownerId: string, setCode: string): PackRecord {
    this.refuseIfEnded("no pack is bought");
    knownSet(setCode);
    const pack: PackRecord = { packId: randomUUID(), ownerId, setCode, source: "purchase", acquiredAt: this.stamp(), openedAt: null };
    this.transaction(() => {
      this.appendLedger(ownerId, null, "credits", -PACK_PRICE_CREDITS, "packPurchase", pack.packId, pack.acquiredAt);
      this.insertPack(pack);
    });
    return pack;
  }

  /** Buys `count` packs of a set (1 to BULK_OPEN_COUNT) in one go: all of
   * them or none, so a 10-pack buy never stops at 6 for want of credits. */
  buyPacks(ownerId: string, setCode: string, count: number): PackRecord[] {
    this.refuseIfEnded("no pack is bought");
    if (!Number.isInteger(count) || count < 1 || count > BULK_OPEN_COUNT) {
      throw new EconomyError(`buy 1 to ${BULK_OPEN_COUNT} packs at once, not ${count}`);
    }
    knownSet(setCode);
    return this.transaction(() => {
      this.getOwner(ownerId);
      const have = this.balance(ownerId, "credits");
      if (have < count * PACK_PRICE_CREDITS) {
        throw new EconomyError(`${count} pack(s) cost ${count * PACK_PRICE_CREDITS} credits; the owner has ${have}`);
      }
      return Array.from({ length: count }, () => this.buyPack(ownerId, setCode));
    });
  }

  /** A pack that costs nothing (starter, weekly challenge, owner's daily). */
  grantPack(ownerId: string, setCode: string, source: Exclude<PackSource, "purchase">): PackRecord {
    this.refuseIfEnded("no pack is granted");
    if (!PACK_SOURCES.includes(source) || (source as PackSource) === "purchase") throw new EconomyError(`not a free pack source: "${source}"`);
    knownSet(setCode);
    const pack: PackRecord = { packId: randomUUID(), ownerId, setCode, source, acquiredAt: this.stamp(), openedAt: null };
    this.insertPack(pack);
    return pack;
  }

  /** The owner's daily pack (owner 2026-10-04: one free pack a day that
   * only the owner can claim, stacking up to OWNER_DAILY_PACK_CAP; the day
   * resets at midnight Sydney). Worked out from the owner's "ownerDaily"
   * packs and the day it was created (see dailyPack.ts). `nextPackAt` is
   * when the next one comes in: the next reset while the bank has room, null
   * while it is full (claiming one starts it again). */
  dailyPackStatus(ownerId: string, at: string = this.stamp()): DailyPackStatus {
    const owner = this.getOwner(ownerId);
    const today = this.resetDay(at);
    const claimed = (
      this.db.prepare("SELECT acquired_at FROM packs WHERE owner_id = ? AND source = 'ownerDaily' ORDER BY acquired_at, rowid").all(ownerId) as Row[]
    ).map((r) => str(r.acquired_at));
    const claimDays = claimed.map((t) => this.resetDay(t).day);
    // (v27) In a new season's file the bank starts empty: it fills from the
    // season's start, not from when the owner first signed up.
    const start = this.seasonStart();
    const firstDay = this.resetDay(start !== null && start.startedAt > owner.createdAt ? start.startedAt : owner.createdAt).day;
    const waiting = dailyPacksWaiting(firstDay, claimDays, today.day, OWNER_DAILY_PACK_CAP);
    return {
      setCode: this.currentSetCode,
      waiting,
      cap: OWNER_DAILY_PACK_CAP,
      day: today.day,
      timeZone: today.timeZone,
      resetsAt: today.endsAt,
      nextPackAt: waiting < OWNER_DAILY_PACK_CAP ? today.endsAt : null,
      claimedToday: claimDays.filter((d) => d === today.day).length,
      lastClaimedAt: claimed.length ? claimed[claimed.length - 1]! : null,
    };
  }

  /** The owner claims one daily pack of the current set: it joins the
   * unopened packs (source "ownerDaily"). Refused when none is waiting. */
  claimDailyPack(ownerId: string): { pack: PackRecord; status: DailyPackStatus } {
    this.refuseIfEnded("no daily pack is claimed");
    return this.transaction(() => {
      const before = this.dailyPackStatus(ownerId);
      if (before.waiting < 1) {
        throw new EconomyError(`no daily pack to claim; the next one comes in at ${before.resetsAt}`);
      }
      const pack = this.grantPack(ownerId, before.setCode, "ownerDaily");
      const status = this.dailyPackStatus(ownerId);
      // (v23) Nothing left to claim: the daily pack's notifications are read.
      if (status.waiting === 0 && this.schemaVersion >= 23) {
        this.db.prepare("UPDATE notifications SET read_at = ? WHERE owner_id = ? AND kind = 'dailyPack' AND read_at IS NULL").run(this.stamp(), ownerId);
      }
      return { pack, status };
    });
  }

  private insertPack(pack: PackRecord): void {
    try {
      this.db
        .prepare("INSERT INTO packs (pack_id, owner_id, set_code, source, acquired_at) VALUES (?, ?, ?, ?, ?)")
        .run(pack.packId, pack.ownerId, pack.setCode, pack.source, pack.acquiredAt);
    } catch (err) {
      refused(err);
    }
  }

  unopenedPacks(ownerId: string): PackRecord[] {
    return (
      this.db.prepare("SELECT * FROM packs WHERE owner_id = ? AND opened_at IS NULL ORDER BY acquired_at, rowid").all(ownerId) as Row[]
    ).map((r) => ({
      packId: str(r.pack_id),
      ownerId: str(r.owner_id),
      setCode: str(r.set_code),
      source: str(r.source) as PackSource,
      acquiredAt: str(r.acquired_at),
      openedAt: strOrNull(r.opened_at),
    }));
  }

  // ---- opening packs (ECONOMY.md "Packs"; roadmap item 5, session 36) ----
  //
  // Opening is an owner action. Each pack is its own opening: its own seed
  // (drawn here, server-side, and stored only once the pack is open), its
  // own pity count and its own Prototype check, logged with the odds-table
  // version. Pity is worked out from the owner's opening history, never
  // stored as a counter. Every pulled copy goes into the collection; nothing
  // is salvaged automatically (owner 2026-10-07).

  /** Opens one of the owner's unopened packs (`packId`, or the oldest).
   * `seed` is for tests and the demo only. */
  openPack(ownerId: string, packId?: string, options: { seed?: number } = {}): PackOpening {
    this.refuseIfEnded("no pack is opened");
    return this.transaction(() => {
      const pack = packId === undefined ? this.unopenedPacks(ownerId)[0] : this.unopenedPacks(ownerId).find((p) => p.packId === packId);
      if (!pack) {
        throw new EconomyError(packId === undefined ? "no unopened pack to open" : `no unopened pack "${packId}" for this owner`);
      }
      const set = knownSet(pack.setCode);
      const seed = options.seed ?? randomInt(2 ** 31);
      const pityBefore = this.pityStatus(ownerId);
      // Every pack opens under the live table, whenever it was bought and
      // whatever its season (owner 2026-10-18, answer 6A); the opening
      // records which table that was.
      const odds = LIVE_PACK_ODDS;
      const roll = rollPack(seed, set, pityBefore, this.prototypesLeft(set.code), odds, { starterHit: this.starterHitDue(pack) });
      const at = this.stamp();
      try {
        this.db
          .prepare(
            `INSERT INTO pack_openings (pack_id, owner_id, odds_version, seed, jackpot, pity_json, opened_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(pack.packId, ownerId, odds.version, seed, roll.jackpot ? 1 : 0, JSON.stringify({ ...roll.pity, prototypeFallbackGold: roll.prototypeFallbackGold, starterHit: roll.starterHit === true }), at);
        this.db.prepare("UPDATE packs SET opened_at = ? WHERE pack_id = ?").run(at, pack.packId);
      } catch (err) {
        refused(err);
      }
      // Copies held before this pack: by card ("x4 owned") and by
      // collection entry (the NEW badge; a secret or Glitch card is its own
      // entry).
      const heldBefore = new Map<string, number>();
      const entriesBefore = new Set<string>();
      for (const c of this.collection(ownerId)) {
        heldBefore.set(c.cardId, (heldBefore.get(c.cardId) ?? 0) + 1);
        entriesBefore.add(collectionEntryKey(c));
      }
      const found = new Map<string, number>();
      const copies = roll.pulls.map((p) => {
        const run = p.prototypeRun ? set.prototypes.find((r) => r.code === p.prototypeRun)! : undefined;
        const serial = run ? this.prototypesFound(run.code) + 1 : null;
        return this.grantCopy({
          ownerId,
          cardId: p.cardId,
          finish: p.finish,
          seriesKind: run ? "prototype" : "set",
          seriesCode: run ? run.code : set.code,
          serial,
          runSize: run ? run.runSize : null,
          origin: "pack",
          originRef: `pack:${pack.packId}`,
          secretCode: p.secret ?? null,
        });
      });
      for (const p of roll.pulls) found.set(p.cardId, (found.get(p.cardId) ?? 0) + 1);
      this.appendLedger(ownerId, null, "packPoints", PACK_POINTS_PER_PACK, "packOpened", pack.packId, at);
      const cards: OpenedCard[] = roll.pulls.map((p, i) => {
        const secret = p.secret === undefined ? undefined : set.secrets.find((x) => x.code === p.secret)!;
        return {
          copyId: copies[i]!.copyId,
          cardId: p.cardId,
          name: secret ? secret.name : getCard(p.cardId)!.name,
          rarity: p.rarity,
          slot: p.slot,
          finish: p.finish,
          collectorNumber: p.collectorNumber,
          prototype: copies[i]!.serial === null ? null : { runCode: copies[i]!.seriesCode!, serial: copies[i]!.serial!, runSize: copies[i]!.runSize! },
          secret: secret ? { code: secret.code, kind: secret.kind, art: secret.art, animated: secret.animated } : null,
          // A plain card is NEW when no copy of it, in any finish, was held
          // (as the binder's base place counts); a secret or Glitch card when
          // its own entry was empty.
          isNew: collectionEntryKey(copies[i]!).startsWith("card:")
            ? (heldBefore.get(p.cardId) ?? 0) === 0
            : !entriesBefore.has(collectionEntryKey(copies[i]!)),
          ownedAfter: (heldBefore.get(p.cardId) ?? 0) + found.get(p.cardId)!,
        };
      });
      const opening: PackOpening = {
        packId: pack.packId,
        ownerId,
        setCode: set.code,
        oddsVersion: odds.version,
        seed,
        openedAt: at,
        jackpot: roll.jackpot,
        pity: roll.pity,
        prototypeFallbackGold: roll.prototypeFallbackGold,
        starterHit: roll.starterHit === true,
        cards,
        packPoints: PACK_POINTS_PER_PACK,
        fullReveal: roll.jackpot || roll.pulls.some((p) => FULL_REVEAL_FINISHES.includes(p.finish)),
      };
      // Kept as answered, for "Watch again" (schema v19; a file a migration
      // test holds at an older version has no table for it).
      if (this.schemaVersion >= 19) this.db.prepare("INSERT INTO pack_reveals (pack_id, reveal_json) VALUES (?, ?)").run(pack.packId, JSON.stringify(opening));
      // (v23) A big pull: the same rule as the ceremony's full reveal.
      if (opening.fullReveal) {
        const hits = cards.filter((c) => FULL_REVEAL_FINISHES.includes(c.finish));
        this.notify(
          ownerId,
          pack.packId,
          {
            kind: "bigPull",
            bigPull: {
              packId: pack.packId,
              setCode: set.code,
              jackpot: roll.jackpot,
              cards: (hits.length > 0 ? hits : cards).map((c) => ({ copyId: c.copyId, cardId: c.cardId, name: c.name, rarity: c.rarity, finish: c.finish, isNew: c.isNew, prototype: c.prototype })),
            },
          },
          at,
        );
      }
      return opening;
    });
  }

  /** An opening exactly as openPack answered it (schema v19; owner
   * 2026-11-02, "Watch again"): every card's slot, NEW badge and "x N
   * owned" as of the opening, the pity, the starter guarantee, the pack
   * points. Null for a pack opened before v19 (no reveal was kept). Throws
   * for a pack that hasn't been opened. */
  packReveal(packId: string): PackOpening | null {
    const opened = this.db.prepare("SELECT 1 FROM pack_openings WHERE pack_id = ?").get(packId);
    if (!opened) throw new EconomyError(`pack "${packId}" hasn't been opened`);
    if (this.schemaVersion < 19) return null;
    const row = this.db.prepare("SELECT reveal_json FROM pack_reveals WHERE pack_id = ?").get(packId) as Row | undefined;
    return row ? (JSON.parse(str(row.reveal_json)) as PackOpening) : null;
  }

  /** Opens 1 pack, or BULK_OPEN_COUNT (10) at once (owner 2026-10-05): the
   * same odds, no discount and no bonus. The packs open one after another,
   * oldest first, each its own opening, all in one transaction (all open or
   * none). `seeds` is for tests and the demo only. */
  openPacks(ownerId: string, count: number, options: { seeds?: readonly number[] } = {}): BulkOpening {
    this.refuseIfEnded("no pack is opened");
    if (count !== 1 && count !== BULK_OPEN_COUNT) throw new EconomyError(`open 1 pack or ${BULK_OPEN_COUNT} at once, not ${count}`);
    return this.transaction(() => {
      const unopened = this.unopenedPacks(ownerId);
      if (unopened.length < count) throw new EconomyError(`only ${unopened.length} unopened pack(s); can't open ${count}`);
      const packs = unopened.slice(0, count).map((p, i) => this.openPack(ownerId, p.packId, { seed: options.seeds?.[i] }));
      const cards = packs.flatMap((p) => p.cards);
      const byRarity: Record<Rarity, number> = { Common: 0, Uncommon: 0, Rare: 0, Mythic: 0 };
      const byFinish: Partial<Record<Finish, number>> = {};
      for (const c of cards) {
        byRarity[c.rarity]++;
        byFinish[c.finish] = (byFinish[c.finish] ?? 0) + 1;
      }
      // NEW once per card across the whole bulk open (a card new in pack 2
      // is no longer new in pack 5).
      const newCards = new Set(cards.filter((c) => c.isNew).map((c) => c.cardId)).size;
      return {
        packs,
        summary: {
          cards: cards.length,
          newCards,
          packPoints: packs.reduce((t, p) => t + p.packPoints, 0),
          byRarity,
          byFinish,
          fullReveals: packs.filter((p) => p.fullReveal).map((p) => p.packId),
        },
      };
    });
  }

  /** A logged opening, seed and all (revealable after opening, never
   * before: an unopened pack has no seed yet). Card names and NEW badges
   * are as of now, not as of the opening. */
  packOpening(packId: string): { packId: string; ownerId: string; oddsVersion: string; seed: number; jackpot: boolean; openedAt: string; copies: CardCopy[] } {
    const row = this.db.prepare("SELECT * FROM pack_openings WHERE pack_id = ?").get(packId) as Row | undefined;
    if (!row) throw new EconomyError(`pack "${packId}" hasn't been opened`);
    const copies = (this.db.prepare("SELECT * FROM card_copies WHERE origin_ref = ? ORDER BY rowid").all(`pack:${packId}`) as Row[]).map((r) => this.copyFromRow(r));
    return {
      packId,
      ownerId: str(row.owner_id),
      oddsVersion: str(row.odds_version),
      seed: num(row.seed),
      jackpot: num(row.jackpot) === 1,
      openedAt: str(row.opened_at),
      copies,
    };
  }

  /** The owner's last `packs` openings, newest first, with the cards each
   * gave (the Collection widget's recent pulls). Names are as of now. */
  recentPulls(ownerId: string, packs = 3): RecentPull[] {
    if (!Number.isInteger(packs) || packs < 1 || packs > 50) throw new EconomyError(`recent pulls reads 1 to 50 packs, not ${packs}`);
    this.getOwner(ownerId);
    const openings = this.db
      .prepare(
        `SELECT o.pack_id, o.jackpot, o.opened_at, p.set_code FROM pack_openings o JOIN packs p ON p.pack_id = o.pack_id
         WHERE o.owner_id = ? ORDER BY o.opening_no DESC LIMIT ?`,
      )
      .all(ownerId, packs) as Row[];
    return openings.map((o) => ({
      packId: str(o.pack_id),
      setCode: str(o.set_code),
      openedAt: str(o.opened_at),
      jackpot: num(o.jackpot) === 1,
      cards: (this.db.prepare("SELECT * FROM card_copies WHERE origin_ref = ? ORDER BY rowid").all(`pack:${str(o.pack_id)}`) as Row[]).map((r) => {
        const c = this.copyFromRow(r);
        const info = this.cardInfo(c.cardId, c.secretCode);
        return { copyId: c.copyId, cardId: c.cardId, name: info.name, rarity: info.rarity, finish: c.finish, secretCode: c.secretCode, serial: c.serial, held: r.disposed_at === null };
      }),
    }));
  }

  /** A card's name, rarity and faction for the collection's lists: a set
   * card, a Zero-Day card, a signature card, or (with its code) a secret
   * card's own name. */
  private cardInfo(cardId: string, secretCode: string | null = null): { name: string; rarity: Rarity; faction: string | null } {
    const card = getCard(cardId) ?? this.signatureCardById(cardId)?.card;
    const secret = secretCode === null ? undefined : secretCardOf(secretCode);
    if (card) return { name: secret?.name ?? card.name, rarity: card.rarity, faction: card.faction };
    const zd = zeroDayEntry(cardId);
    if (zd) return { name: zd.name, rarity: zd.rarity, faction: null };
    throw new EconomyError(`no ownable card with id "${cardId}"`);
  }

  /** The Collection page's data (owner 2026-11-01): every card the owner
   * holds with each copy (finish, origin, bound or not), how many of it
   * salvage, each set's completion (base, secrets, Glitch, Gold and the
   * Prototype runs, as the binder counts them) and the recent pulls. */
  collectionSummary(ownerId: string, options: { recentPacks?: number } = {}): CollectionSummary {
    const copies = this.collection(ownerId);
    const byCard = new Map<string, CardCopy[]>();
    for (const c of copies) byCard.set(c.cardId, [...(byCard.get(c.cardId) ?? []), c]);
    const cards = [...byCard].map(([cardId, held]) => {
      const info = this.cardInfo(cardId);
      return {
        cardId,
        name: info.name,
        rarity: info.rarity,
        faction: info.faction,
        owned: held.length,
        salvageable: held.filter((c) => salvageBlockReason(c) === null).length,
        copies: held.map(({ ownerId: _, ...c }) => c),
      };
    });
    cards.sort((a, b) => a.name.localeCompare(b.name) || a.cardId.localeCompare(b.cardId));
    const sets = [...CARD_SETS.keys()].map((setCode) => {
      const b = this.binder(ownerId, setCode);
      const part = (x: BinderSection) => ({ held: x.held, total: x.total });
      return {
        setCode,
        base: part(b.base),
        secrets: part(b.secrets),
        glitch: part(b.glitch),
        gold: part(b.gold),
        prototypes: { runsHeld: b.prototypes.filter((r) => r.serialsHeld.length > 0).length, runs: b.prototypes.length, copiesHeld: b.prototypes.reduce((t, r) => t + r.serialsHeld.length, 0) },
      };
    });
    return { copies: copies.length, distinctCards: cards.length, cards, sets, recentPulls: this.recentPulls(ownerId, options.recentPacks ?? 3), promos: this.promos(ownerId, copies) };
  }

  /** The Promos tab's data (collectionSummary's `promos`). */
  private promos(ownerId: string, copies: CardCopy[]): CollectionSummary["promos"] {
    const connected = this.getOwner(ownerId).connectedAgentId;
    const signatureCards = this.listAgents(ownerId).flatMap((agent) => {
      const sig = this.signatureCard(agent.agentId);
      if (!sig) return [];
      const copy = copies.find((c) => c.originRef === `${SIGNATURE_ORIGIN_REF_PREFIX}${agent.agentId}`);
      return [
        {
          agentId: agent.agentId,
          agentName: agent.name,
          connected: agent.agentId === connected,
          cardId: sig.cardId,
          name: sig.card.name,
          collectorNumber: sig.collectorNumber,
          rarity: sig.card.rarity,
          faction: sig.card.faction,
          flavor: sig.card.flavor || null,
          art: sig.card.art,
          copyId: copy?.copyId ?? null,
          createdAt: sig.createdAt,
        },
      ];
    });
    signatureCards.sort((a, b) => a.collectorNumber.localeCompare(b.collectorNumber));
    const earned = copies
      .filter((c) => (c.origin === "promo" || c.origin === "prize") && !isSignatureRef(c.originRef))
      .map((c) => {
        const info = this.cardInfo(c.cardId, c.secretCode);
        return { copyId: c.copyId, cardId: c.cardId, name: info.name, rarity: info.rarity, finish: c.finish, origin: c.origin, seriesCode: c.seriesCode, stamp: c.stamp, acquiredAt: c.acquiredAt };
      })
      .sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt) || a.copyId.localeCompare(b.copyId));
    return { signatureCards, earned };
  }

  /** The owner's pity timers, from opening history: packs in a row (most
   * recent first) with no Full Art or better, and with no Mythic. */
  pityStatus(ownerId: string): PityStatus {
    const { pity } = LIVE_PACK_ODDS;
    const limit = Math.max(pity.fullArtAfter, pity.mythicAfter);
    const rows = this.db
      .prepare(
        `SELECT o.opening_no, c.card_id, c.finish
         FROM (SELECT opening_no, pack_id FROM pack_openings WHERE owner_id = ? ORDER BY opening_no DESC LIMIT ?) o
         LEFT JOIN card_copies c ON c.origin_ref = 'pack:' || o.pack_id
         ORDER BY o.opening_no`,
      )
      .all(ownerId, limit) as Row[];
    const packs = new Map<number, { finish: Finish; rarity: Rarity }[]>();
    for (const r of rows) {
      const pulls = packs.get(num(r.opening_no)) ?? [];
      if (r.card_id !== null) pulls.push({ finish: str(r.finish) as Finish, rarity: setCardRarity(str(r.card_id))! });
      packs.set(num(r.opening_no), pulls);
    }
    // Only the last `limit` openings are read, so a count can't pass it;
    // that is enough, since pity is due at the limit.
    let state: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
    for (const pulls of packs.values()) state = nextPity(state, pulls);
    const next = { fullArt: state.packsSinceFullArt >= pity.fullArtAfter, mythic: state.packsSinceMythic >= pity.mythicAfter };
    return { ...state, next };
  }

  /** The starter guarantee (owner 2026-10-19, render session 28 call 9):
   * every owner sees at least one hit (Full Art or better) across their
   * starter packs. It is due on the owner's last unopened starter pack when
   * none of their opened starter packs had a hit, whatever else they opened
   * in between. Worked out from pack history, like pity. */
  private starterHitDue(pack: PackRecord): boolean {
    if (pack.source !== "starter") return false;
    const unopened = this.db
      .prepare("SELECT COUNT(*) AS n FROM packs WHERE owner_id = ? AND source = 'starter' AND opened_at IS NULL")
      .get(pack.ownerId) as Row;
    if (num(unopened.n) !== 1) return false;
    const hits = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM packs p JOIN card_copies c ON c.origin_ref = 'pack:' || p.pack_id
         WHERE p.owner_id = ? AND p.source = 'starter' AND p.opened_at IS NOT NULL
           AND c.finish IN (${FULL_ART_OR_BETTER.map(() => "?").join(", ")})`,
      )
      .get(pack.ownerId, ...FULL_ART_OR_BETTER) as Row;
    return num(hits.n) === 0;
  }

  /** Copies of a Prototype run found so far (the card viewer shows it). */
  prototypesFound(runCode: string): number {
    return num((this.db.prepare("SELECT COUNT(*) AS n FROM card_copies WHERE series_kind = 'prototype' AND series_code = ?").get(runCode) as Row).n);
  }

  /** Copies each of a set's Prototype runs still has: none for a run its
   * season's end retired (v26). */
  private prototypesLeft(setCode: string): Map<string, number> {
    const retired = new Set(this.retiredRunCodes());
    return new Map(knownSet(setCode).prototypes.map((r) => [r.code, retired.has(r.code) ? 0 : r.runSize - this.prototypesFound(r.code)]));
  }

  private retiredRunCodes(): string[] {
    if (this.schemaVersion < 26) return [];
    return (this.db.prepare("SELECT run_code FROM retired_prototype_runs").all() as Row[]).map((r) => str(r.run_code));
  }

  // ---- crafting with pack points (ECONOMY.md "Packs") ----

  /** The owner spends pack points on one standard-finish copy of a set card
   * (Common 40, Uncommon 80, Rare 250, Mythic 800). The copy is crafted, so
   * account-bound. Refused once the owner holds the card's playable limit
   * (3 / 3 / 2 / 1), counting every copy held, and refused without the
   * points (the schema refuses an overdraw too). */
  craftCard(ownerId: string, cardId: string): CardCopy {
    this.refuseIfEnded("no card is crafted");
    if (zeroDayEntry(cardId)) throw new EconomyError(`"${cardId}" is a Zero-Day card: craft it with craftSecret`);
    const card = getCard(cardId);
    if (!card) throw new EconomyError(`"${cardId}" is not a set card; only set cards can be crafted`);
    return this.transaction(() => {
      const held = this.collection(ownerId).filter((c) => c.cardId === cardId).length;
      const limit = COPY_LIMITS[card.rarity];
      if (held >= limit) throw new EconomyError(`you already hold ${held} of "${card.name}"; crafting stops at its playable limit of ${limit}`);
      const cost = CRAFT_PACK_POINTS[card.rarity];
      const have = this.balance(ownerId, "packPoints");
      if (have < cost) throw new EconomyError(`crafting "${card.name}" costs ${cost} pack points; you have ${have}`);
      const copy = this.grantCopy({ ownerId, cardId, origin: "crafted" });
      this.appendLedger(ownerId, null, "packPoints", -cost, "craft", copy.copyId, copy.acquiredAt);
      return copy;
    });
  }

  /** The owner spends pack points on one secret card (owner 2026-10-18,
   * answer 5A): a secret illustration costs 750, a Zero-Day card 3,000
   * (config.ts SECRET_CRAFT_PACK_POINTS). Crafting completes a collection,
   * it doesn't farm one: refused while the owner holds a copy of that secret
   * card. The copy is crafted, so account-bound like every crafted copy:
   * played, never sold, never salvaged. A Zero-Day card can be crafted once
   * it is designed and live (Season 0's three since session 42); an entry
   * not designed yet can only be pulled. */
  craftSecret(ownerId: string, secretCode: string): CardCopy {
    this.refuseIfEnded("no card is crafted");
    const secret = secretCardOf(secretCode);
    if (!secret) throw new EconomyError(`no secret card "${secretCode}"`);
    if (secret.kind === "zeroDay" && !getCard(secret.cardId)) {
      throw new EconomyError(`${secret.code} isn't designed yet; until it is, it can only be pulled from a pack`);
    }
    return this.transaction(() => {
      if (this.collection(ownerId).some((c) => c.secretCode === secret.code)) {
        throw new EconomyError(`you already hold ${secret.name} (${secret.code}); crafting makes the one copy a collection needs`);
      }
      const cost = SECRET_CRAFT_PACK_POINTS[secret.kind];
      const have = this.balance(ownerId, "packPoints");
      if (have < cost) throw new EconomyError(`crafting ${secret.name} (${secret.code}) costs ${cost} pack points; you have ${have}`);
      const copy = this.grantCopy({
        ownerId,
        cardId: secret.cardId,
        finish: secret.kind === "zeroDay" ? "zeroDay" : "secret",
        secretCode: secret.code,
        origin: "crafted",
      });
      this.appendLedger(ownerId, null, "packPoints", -cost, "craftSecret", copy.copyId, copy.acquiredAt);
      return copy;
    });
  }

  // ---- the binder and the set checklist (owner 2026-10-16 item 1: "each
  // is its own collection entry, with its own place in the binder and the
  // set checklist") ----

  /** One set's binder for an owner: every collection entry in its place,
   * with the copies held, in five sections (ECONOMY.md "Chase cards"):
   * the base set (any copy of the card counts, any finish), the secret
   * cards (illustrations, then Zero-Day), the Glitch versions, the Gold
   * versions, and the Prototype runs (with the serials held). */
  binder(ownerId: string, setCode: string): Binder {
    const set = knownSet(setCode);
    const held = this.collection(ownerId);
    const count = (keep: (c: CardCopy) => boolean) => held.filter(keep).length;
    const section = (title: string, entries: BinderEntry[]): BinderSection => ({
      title,
      held: entries.filter((e) => e.owned > 0).length,
      total: entries.length,
      entries,
    });
    const base = set.cards.map((c) => ({
      number: c.collectorNumber,
      kind: "card" as const,
      cardId: c.cardId,
      secretCode: null,
      name: c.name,
      rarity: c.rarity,
      owned: count((x) => x.cardId === c.cardId),
    }));
    const secrets = set.secrets.map((s) => ({
      number: s.collectorNumber,
      kind: s.kind,
      cardId: s.cardId,
      secretCode: s.code,
      name: s.name,
      rarity: s.rarity,
      owned: count((x) => x.secretCode === s.code),
    }));
    // In the binder's order, the card's own number (the Glitch list is
    // written by faction and role, not by number).
    const glitch = set.cards
      .filter((c) => set.glitch.includes(c.cardId))
      .map((c) => ({
        number: c.collectorNumber,
        kind: "glitch" as const,
        cardId: c.cardId,
        secretCode: null,
        name: c.name,
        rarity: c.rarity,
        owned: count((x) => x.cardId === c.cardId && x.finish === "glitch"),
      }));
    // Only cards with a Gold version (from session 97 the booster cards:
    // a starter card is Standard only).
    const gold = set.cards.flatMap((c) => (c.goldNumber === null ? [] : [{
      number: c.goldNumber,
      kind: "gold" as const,
      cardId: c.cardId,
      secretCode: null,
      name: c.name,
      rarity: c.rarity,
      owned: count((x) => x.cardId === c.cardId && x.finish === "gold"),
    }]));
    return {
      setCode: set.code,
      base: section("Base set", base),
      secrets: section("Secret cards", secrets),
      glitch: section("Glitch", glitch),
      gold: section("Gold", gold),
      prototypes: set.prototypes.map((r) => ({
        runCode: r.code,
        cardId: r.cardId,
        name: getCard(r.cardId)!.name,
        runSize: r.runSize,
        found: this.prototypesFound(r.code),
        serialsHeld: held
          .filter((x) => x.seriesKind === "prototype" && x.seriesCode === r.code)
          .map((x) => x.serial!)
          .sort((a, b) => a - b),
      })),
    };
  }

  // ---- matches ----

  /** Wins and losses (draws count as losses) this owner already has on the
   * reset day of `at` (midnight to midnight Sydney time, owner 2026-11-01),
   * whichever of its agents played them. Counted from match history, so a
   * win that paid 0 (past the daily cap) still counts, and switching agents
   * can neither reset nor double the caps. */
  dailyTally(ownerId: string, at: string): DailyTally {
    const day = this.resetDay(at);
    const row = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN outcome = 'win' AND winner_owner = :o THEN 1 ELSE 0 END), 0) AS wins,
           COALESCE(SUM(CASE WHEN (outcome = 'win' AND winner_owner <> :o) OR outcome = 'draw' THEN 1 ELSE 0 END), 0) AS losses
         FROM matches
         WHERE (p1_owner = :o OR p2_owner = :o) AND ended_at >= :start AND ended_at < :end`,
      )
      .get({ o: ownerId, start: day.startsAt, end: day.endsAt }) as Row;
    return { winsToday: num(row.wins), lossesToday: num(row.losses) };
  }

  /** The reset day `at` falls in; an invalid time is the store's refusal. */
  private resetDay(at: string) {
    try {
      return resetDayOf(at);
    } catch {
      throw new EconomyError(`not a valid time: "${at}"`);
    }
  }

  /** Today's match earnings for the Daily rewards widget (owner
   * 2026-11-01): the reset day now (or at `at`), when it resets, the win
   * schedule, each rewarded win with what it paid, the losses and what they
   * paid, and what the next win and the next loss would pay. Read from
   * match history, the same count `recordMatch` pays by; cancelled and
   * abandoned matches pay nothing and count for neither.
   *
   * One order for the numbering and the payout (owner 2026-11-12): a win's
   * place in the day (`nth`) is the order it was recorded in, because that
   * is the order `recordMatch` paid it in (its tally is the day's matches
   * already recorded). Numbering by end time instead disagreed whenever a
   * match was recorded with an earlier end time than one already recorded
   * (a clock that stepped back): the 30 then sat on a later win. Recording
   * order is the table's rowid; nothing rewrites the season file's rows
   * (no VACUUM runs on it), so it is stable. Each win still carries its own
   * `endedAt`, which in that case reads out of order. */
  dailyEarnings(ownerId: string, at: string = this.stamp()): DailyEarnings {
    this.getOwner(ownerId);
    const day = this.resetDay(at);
    const rows = this.db
      .prepare(
        `SELECT match_id, outcome, winner_owner, p1_owner, p1_credits, p2_credits, ended_at FROM matches
         WHERE (p1_owner = :o OR p2_owner = :o) AND ended_at >= :start AND ended_at < :end
         ORDER BY rowid`,
      )
      .all({ o: ownerId, start: day.startsAt, end: day.endsAt }) as Row[];
    const wins: DailyEarnings["wins"] = [];
    let losses = 0;
    let creditsFromLosses = 0;
    for (const r of rows) {
      const credits = num(str(r.p1_owner) === ownerId ? r.p1_credits : r.p2_credits);
      const outcome = str(r.outcome);
      if (outcome === "win" && str(r.winner_owner) === ownerId) {
        wins.push({ nth: wins.length + 1, matchId: str(r.match_id), endedAt: str(r.ended_at), credits });
      } else if (outcome === "win" || outcome === "draw") {
        losses++;
        creditsFromLosses += credits;
      }
    }
    const tally: DailyTally = { winsToday: wins.length, lossesToday: losses };
    const creditsFromWins = wins.reduce((t, w) => t + w.credits, 0);
    return {
      day: day.day,
      timeZone: day.timeZone,
      startedAt: day.startsAt,
      resetsAt: day.endsAt,
      schedule: WIN_SCHEDULE.map((r) => ({ ...r })),
      wins,
      rewardedWins: wins.filter((w) => w.credits > 0),
      losses,
      maxPaidLosses: MAX_PAID_LOSSES_PER_DAY,
      creditsFromWins,
      creditsFromLosses,
      credits: creditsFromWins + creditsFromLosses,
      nextWinPays: matchCredits("win", tally),
      nextLossPays: matchCredits("loss", tally),
    };
  }

  /** Records a finished match and pays both owners for it, in one
   * transaction, each payout marked with the agent that played. Refused: the
   * same match id twice, a winner or abandoner who didn't play, and two
   * agents of the same owner (no self-play farming). A match begun with
   * `startMatch` ends its live state here (a cancel or abandon included). A
   * match id that was never started is still recorded, for offline history
   * and tests; the server records only matches it started. */
  recordMatch(input: RecordMatchInput): MatchRecord {
    // Normalised to ISO UTC so the tally's day window (also ISO UTC)
    // compares as text.
    const raw = input.endedAt ?? this.stamp();
    this.resetDay(raw);
    const endedAt = new Date(raw).toISOString();
    const { p1AgentId: p1, p2AgentId: p2, outcome } = input;
    if (this.seasonEnded()) throw new EconomyError(`season ${this.season} has ended: no match is recorded`);
    if (p1 === p2) throw new EconomyError("an agent cannot play itself");
    const owner1 = this.getAgent(p1).ownerId;
    const owner2 = this.getAgent(p2).ownerId;
    if (owner1 === owner2) throw new EconomyError("an owner's own agents never play each other in rewarded play");
    const ownerOfSide = (agentId: string): string => {
      if (agentId === p1) return owner1;
      if (agentId === p2) return owner2;
      throw new EconomyError(`agent "${agentId}" did not play match "${input.matchId}"`);
    };
    const winnerOwner = outcome.kind === "win" ? ownerOfSide(outcome.winnerAgentId) : null;
    const health = input.finalHealth ?? null;
    if (health !== null && (!Number.isInteger(health.p1) || !Number.isInteger(health.p2))) {
      throw new EconomyError(`final health is whole numbers, got ${health.p1} / ${health.p2}`);
    }
    const abandonedByOwner = outcome.kind === "abandoned" ? ownerOfSide(outcome.byAgentId) : null;
    const resultFor = (ownerId: string): MatchResultForAgent => {
      switch (outcome.kind) {
        case "win":
          return winnerOwner === ownerId ? "win" : "loss";
        case "draw":
          return "draw";
        case "cancelled":
          return "cancelled";
        case "abandoned":
          return "abandoned";
      }
    };

    return this.transaction(() => {
      // Match ids must be fresh: checked before the tallies so a duplicate
      // gets a clear message rather than a constraint error.
      if (this.db.prepare("SELECT 1 FROM matches WHERE match_id = ?").get(input.matchId)) {
        throw new EconomyError(`match "${input.matchId}" is already recorded`);
      }
      // A match started with startMatch must be recorded with the agents
      // that started it, and recording it ends the live match.
      const live = this.db.prepare("SELECT * FROM live_matches WHERE match_id = ?").get(input.matchId) as Row | undefined;
      if (live) {
        if (str(live.p1_agent) !== p1 || str(live.p2_agent) !== p2) {
          throw new EconomyError(`match "${input.matchId}" was started by other agents`);
        }
        this.db.prepare("DELETE FROM live_matches WHERE match_id = ?").run(input.matchId);
      }
      const p1Credits = matchCredits(resultFor(owner1), this.dailyTally(owner1, endedAt));
      const p2Credits = matchCredits(resultFor(owner2), this.dailyTally(owner2, endedAt));
      const record: MatchRecord = {
        matchId: input.matchId,
        seed: input.seed,
        p1OwnerId: owner1,
        p2OwnerId: owner2,
        p1AgentId: p1,
        p2AgentId: p2,
        p1DeckId: input.p1DeckId ?? null,
        p2DeckId: input.p2DeckId ?? null,
        outcome: outcome.kind,
        winnerOwnerId: winnerOwner,
        winnerAgentId: outcome.kind === "win" ? outcome.winnerAgentId : null,
        abandonedByOwnerId: abandonedByOwner,
        turns: input.turns ?? null,
        moves: input.moves ?? null,
        p1Credits,
        p2Credits,
        endedAt,
        loadouts: null,
        boast: null,
        playStyles: null,
        ratings: null,
        ratingsAtStart: null,
        factions: { p1: null, p2: null },
      };
      // The styles the match started with (v13): kept from the live row.
      const p1Style = strOrNull(live?.p1_style ?? null);
      const p2Style = strOrNull(live?.p2_style ?? null);
      if (p1Style !== null && p2Style !== null) record.playStyles = { p1: p1Style as PlayStyleId, p2: p2Style as PlayStyleId };
      try {
        this.db
          .prepare(
            `INSERT INTO matches (match_id, seed, p1_owner, p2_owner, p1_agent, p2_agent, p1_deck, p2_deck, outcome,
               winner_owner, abandoned_by_owner, turns, moves, p1_credits, p2_credits, ended_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            record.matchId,
            record.seed,
            owner1,
            owner2,
            p1,
            p2,
            record.p1DeckId,
            record.p2DeckId,
            record.outcome,
            winnerOwner,
            abandonedByOwner,
            record.turns,
            record.moves,
            p1Credits,
            p2Credits,
            endedAt,
          );
        if (record.playStyles !== null) {
          this.db
            .prepare("UPDATE matches SET p1_style = ?, p2_style = ? WHERE match_id = ?")
            .run(record.playStyles.p1, record.playStyles.p2, record.matchId);
        }
        if (this.schemaVersion >= 20) {
          // As the live match started; a match recorded without one (the
          // tests' direct records) goes in on the ratings it is rated from,
          // which are the same: a rating moves only when a match ends.
          const start = (seat: "p1" | "p2", ownerId: string) => numOrNull(live?.[`${seat}_rating_start`] ?? null) ?? this.rating(ownerId, endedAt).rating;
          record.ratingsAtStart = { p1: start("p1", owner1), p2: start("p2", owner2) };
          this.db
            .prepare("UPDATE matches SET p1_rating_start = ?, p2_rating_start = ? WHERE match_id = ?")
            .run(record.ratingsAtStart.p1, record.ratingsAtStart.p2, record.matchId);
        }
        if (this.schemaVersion >= 24) {
          // The decks as they played: a live match's deck can't change, so
          // reading it now reads what was played (as the boast does).
          record.factions = { p1: this.playedFaction(record.p1DeckId), p2: this.playedFaction(record.p2DeckId) };
          this.db
            .prepare("UPDATE matches SET p1_faction = ?, p2_faction = ? WHERE match_id = ?")
            .run(record.factions.p1, record.factions.p2, record.matchId);
        }
      } catch (err) {
        refused(err);
      }
      if (this.schemaVersion >= 11) {
        // The loadouts as the match ends: the same as it started, since a
        // live match's owners can't change them.
        record.loadouts = { p1: this.loadout(p1), p2: this.loadout(p2) };
        const insertLoadout = this.db.prepare(
          this.schemaVersion >= 20
            ? `INSERT INTO match_loadouts (match_id, seat, agent_id, boast, close_win_boast, card_back, avatar, arena, coin)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            : `INSERT INTO match_loadouts (match_id, seat, agent_id, boast, close_win_boast, card_back, avatar, arena)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        if (outcome.kind === "win") {
          const seat = outcome.winnerAgentId === p1 ? "p1" : "p2";
          record.boast = this.matchBoast(outcome.winnerAgentId, record.loadouts[seat], seat === "p1" ? record.p1DeckId : record.p2DeckId, health?.[seat] ?? null);
        }
        try {
          for (const seat of ["p1", "p2"] as const) {
            const l = record.loadouts[seat];
            const values = [input.matchId, seat, seat === "p1" ? p1 : p2, l.boast, l.closeWinBoast, l.cardBack, l.avatar, l.arena];
            insertLoadout.run(...(this.schemaVersion >= 20 ? [...values, l.coin] : values));
          }
          if (record.boast !== null) {
            this.db
              .prepare("INSERT INTO match_boasts (match_id, agent_id, item_id, slot, winner_health) VALUES (?, ?, ?, ?, ?)")
              .run(input.matchId, record.boast.agentId, record.boast.itemId, record.boast.slot, record.boast.winnerHealth);
          }
        } catch (err) {
          refused(err);
        }
      }
      if (this.schemaVersion >= 17 && outcome.kind !== "cancelled") {
        // A win, a draw or an abandon is rated (an abandon as a loss for the
        // side that abandoned it: walking out never protects a rating); a
        // cancel isn't. Both sides from their pre-match ratings.
        const score1: 0 | 0.5 | 1 =
          outcome.kind === "draw" ? 0.5 : outcome.kind === "win" ? (winnerOwner === owner1 ? 1 : 0) : abandonedByOwner === owner1 ? 0 : 1;
        const day = resetDayOf(endedAt).day;
        const before1 = this.rating(owner1, endedAt);
        const before2 = this.rating(owner2, endedAt);
        const after = rateMatch(before1, before2, score1);
        const change = (r: OwnerRating, a: Glicko2Rating, score: 0 | 0.5 | 1): RatingChange => ({
          ownerId: r.ownerId,
          score,
          before: { rating: r.rating, rd: r.rd, volatility: r.volatility },
          after: a,
        });
        record.ratings = { p1: change(before1, after.a, score1), p2: change(before2, after.b, (1 - score1) as 0 | 0.5 | 1) };
        const insert = this.db.prepare(
          `INSERT INTO match_ratings (match_id, owner_id, seat, score, rating_before, rd_before, vol_before, rating_after, rd_after, vol_after)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        const upsert = this.db.prepare(
          `INSERT INTO ratings (owner_id, rating, rd, volatility, matches, last_day, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT (owner_id) DO UPDATE SET rating = excluded.rating, rd = excluded.rd, volatility = excluded.volatility,
             matches = ratings.matches + 1, last_day = excluded.last_day, updated_at = excluded.updated_at`,
        );
        try {
          for (const seat of ["p1", "p2"] as const) {
            const c = record.ratings[seat];
            insert.run(input.matchId, c.ownerId, seat, c.score, c.before.rating, c.before.rd, c.before.volatility, c.after.rating, c.after.rd, c.after.volatility);
            // A match recorded out of order (an earlier end time than the
            // owner's last rated one) still rates, but never moves last_day back.
            const lastDay = this.storedRating(c.ownerId)?.lastDay;
            upsert.run(c.ownerId, c.after.rating, c.after.rd, c.after.volatility, lastDay !== undefined && lastDay > day ? lastDay : day, endedAt);
          }
        } catch (err) {
          refused(err);
        }
      }
      const reason = (r: MatchResultForAgent) => (r === "win" ? "matchWin" : r === "draw" ? "matchDraw" : "matchLoss");
      if (p1Credits > 0) this.appendLedger(owner1, p1, "credits", p1Credits, reason(resultFor(owner1)), input.matchId, endedAt);
      if (p2Credits > 0) this.appendLedger(owner2, p2, "credits", p2Credits, reason(resultFor(owner2)), input.matchId, endedAt);
      // (v23) Each player owner is told, from its own side.
      for (const ownerId of [owner1, owner2]) this.notify(ownerId, input.matchId, { kind: "matchResult", matchResult: this.matchResultNotice(record, ownerId) }, endedAt);
      return record;
    });
  }

  /** One recorded match, or null. */
  matchById(matchId: string): MatchRecord | null {
    return this.matchHistory({ matchId })[0] ?? null;
  }

  /** Match history, oldest first: everything, one owner's, or (with an
   * agent) only the matches that agent played. */
  matchHistory(filter: { ownerId?: string; agentId?: string; matchId?: string } = {}): MatchRecord[] {
    const where: string[] = [];
    const params: Record<string, string> = {};
    if (filter.matchId !== undefined) {
      where.push("match_id = :m");
      params.m = filter.matchId;
    }
    if (filter.ownerId !== undefined) {
      where.push("(p1_owner = :o OR p2_owner = :o)");
      params.o = filter.ownerId;
    }
    if (filter.agentId !== undefined) {
      where.push("(p1_agent = :a OR p2_agent = :a)");
      params.a = filter.agentId;
    }
    const sql = `SELECT * FROM matches ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ended_at, rowid`;
    return this.matchRecords(this.db.prepare(sql).all(params) as Row[]);
  }

  /**
   * (session 86) One page of an owner's match history, newest first, read
   * by SQL: GET /api/matches. `before` pages back from one of the owner's
   * match ids. The same order as `matchHistory` reversed (ended_at, then
   * the order recorded), without loading the whole history: at a season's
   * ~2,500 matches the whole-history read took ~70 ms per page
   * (progress/stats-scale-001.txt).
   */
  matchHistoryPage(ownerId: string, options: { limit: number; before?: string | null }): { matches: MatchRecord[]; total: number; more: boolean } {
    const { limit } = options;
    if (!Number.isInteger(limit) || limit < 1) throw new EconomyError(`a page is at least 1 match, got ${limit}`);
    const mine = "(p1_owner = :o OR p2_owner = :o)";
    const total = num((this.db.prepare(`SELECT COUNT(*) AS n FROM matches WHERE ${mine}`).get({ o: ownerId }) as Row).n);
    let after = "";
    const params: Record<string, string | number> = { o: ownerId, limit: limit + 1 };
    if (options.before != null) {
      const at = this.db.prepare(`SELECT ended_at, rowid AS rid FROM matches WHERE match_id = :m AND ${mine}`).get({ m: options.before, o: ownerId }) as Row | undefined;
      if (!at) throw new EconomyError(`"${options.before}" isn't one of this owner's matches`);
      after = "AND (ended_at < :e OR (ended_at = :e AND rowid < :r))";
      params.e = str(at.ended_at);
      params.r = num(at.rid);
    }
    const rows = this.db.prepare(`SELECT * FROM matches WHERE ${mine} ${after} ORDER BY ended_at DESC, rowid DESC LIMIT :limit`).all(params) as Row[];
    const more = rows.length > limit;
    return { matches: this.matchRecords(rows.slice(0, limit)), total, more };
  }

  /**
   * (session 87) The owners an owner last played, most recent first, at
   * most `count`: the ladder's pairing reads it every round ("not the same
   * opponent again"). By SQL on the same order as `matchHistory` (ended_at,
   * then the order recorded), every outcome counted, as before. It used to
   * be the whole history's last two: ~240 ms an owner a round at a season's
   * ~6,300 matches, and refused by SQLite past 32,766 matches
   * (progress/ladder-scale-001.txt).
   */
  recentOpponents(ownerId: string, count: number): string[] {
    if (!Number.isInteger(count) || count < 0) throw new EconomyError(`a count of opponents is a whole number, got ${count}`);
    if (count === 0) return [];
    // Each seat read newest first down its own (owner, ended_at) index and
    // cut to `count`, then merged: a few index steps however long the
    // history is (an OR over both seats scans every match). An owner never
    // sits in both seats of one match (recordMatch refuses it).
    const seat = (col: string) => `SELECT * FROM (SELECT p1_owner, p2_owner, ended_at, rowid AS rid FROM matches WHERE ${col} = :o ORDER BY ended_at DESC, rowid DESC LIMIT :n)`;
    const rows = this.db
      .prepare(`${seat("p1_owner")} UNION ALL ${seat("p2_owner")} ORDER BY ended_at DESC, rid DESC LIMIT :n`)
      .all({ o: ownerId, n: count }) as Row[];
    return rows.map((r) => (str(r.p1_owner) === ownerId ? str(r.p2_owner) : str(r.p1_owner)));
  }

  /** Match rows (SELECT * FROM matches) as records, in the rows' order. */
  private matchRecords(rows: Row[]): MatchRecord[] {
    const loadouts = new Map<string, { p1: Loadout; p2: Loadout }>();
    const boasts = new Map<string, MatchBoast>();
    const ratings = new Map<string, { p1: RatingChange; p2: RatingChange }>();
    if (this.schemaVersion >= 17 && rows.length > 0) {
      const ids = rows.map((r) => str(r.match_id));
      for (const r of this.db.prepare(`SELECT * FROM match_ratings WHERE match_id IN (${ids.map(() => "?").join(", ")})`).all(...ids) as Row[]) {
        const entry = ratings.get(str(r.match_id)) ?? ({} as { p1: RatingChange; p2: RatingChange });
        entry[str(r.seat) as "p1" | "p2"] = {
          ownerId: str(r.owner_id),
          score: num(r.score) as 0 | 0.5 | 1,
          before: { rating: num(r.rating_before), rd: num(r.rd_before), volatility: num(r.vol_before) },
          after: { rating: num(r.rating_after), rd: num(r.rd_after), volatility: num(r.vol_after) },
        };
        ratings.set(str(r.match_id), entry);
      }
    }
    if (this.schemaVersion >= 11 && rows.length > 0) {
      const ids = rows.map((r) => str(r.match_id));
      const marks = ids.map(() => "?").join(", ");
      for (const l of this.db.prepare(`SELECT * FROM match_loadouts WHERE match_id IN (${marks})`).all(...ids) as Row[]) {
        const entry = loadouts.get(str(l.match_id)) ?? ({} as { p1: Loadout; p2: Loadout });
        entry[str(l.seat) as "p1" | "p2"] = {
          boast: strOrNull(l.boast),
          closeWinBoast: strOrNull(l.close_win_boast),
          cardBack: strOrNull(l.card_back),
          avatar: strOrNull(l.avatar),
          arena: strOrNull(l.arena),
          coin: this.schemaVersion >= 20 ? strOrNull(l.coin) : null,
        };
        loadouts.set(str(l.match_id), entry);
      }
      for (const b of this.db.prepare(`SELECT * FROM match_boasts WHERE match_id IN (${marks})`).all(...ids) as Row[]) {
        boasts.set(str(b.match_id), {
          agentId: str(b.agent_id),
          itemId: str(b.item_id),
          slot: str(b.slot) as MatchBoast["slot"],
          winnerHealth: numOrNull(b.winner_health),
        });
      }
    }
    return rows.map((r) => {
      const winnerOwner = strOrNull(r.winner_owner);
      return {
        matchId: str(r.match_id),
        seed: num(r.seed),
        p1OwnerId: str(r.p1_owner),
        p2OwnerId: str(r.p2_owner),
        p1AgentId: str(r.p1_agent),
        p2AgentId: str(r.p2_agent),
        p1DeckId: strOrNull(r.p1_deck),
        p2DeckId: strOrNull(r.p2_deck),
        outcome: str(r.outcome) as MatchOutcomeKind,
        winnerOwnerId: winnerOwner,
        winnerAgentId: winnerOwner === null ? null : winnerOwner === str(r.p1_owner) ? str(r.p1_agent) : str(r.p2_agent),
        abandonedByOwnerId: strOrNull(r.abandoned_by_owner),
        turns: numOrNull(r.turns),
        moves: numOrNull(r.moves),
        p1Credits: num(r.p1_credits),
        p2Credits: num(r.p2_credits),
        endedAt: str(r.ended_at),
        loadouts: loadouts.get(str(r.match_id)) ?? null,
        boast: boasts.get(str(r.match_id)) ?? null,
        playStyles:
          r.p1_style != null && r.p2_style != null ? { p1: str(r.p1_style) as PlayStyleId, p2: str(r.p2_style) as PlayStyleId } : null,
        ratings: ratings.get(str(r.match_id)) ?? null,
        ratingsAtStart:
          r.p1_rating_start != null && r.p2_rating_start != null ? { p1: num(r.p1_rating_start), p2: num(r.p2_rating_start) } : null,
        factions: { p1: (strOrNull(r.p1_faction ?? null) as DeckFaction | null), p2: (strOrNull(r.p2_faction ?? null) as DeckFaction | null) },
      };
    });
  }

  // ---- the ladder (schema v17) ----

  private storedRating(ownerId: string): { rating: Glicko2Rating; matches: number; lastDay: string } | null {
    const row = this.db.prepare("SELECT * FROM ratings WHERE owner_id = ?").get(ownerId) as Row | undefined;
    if (!row) return null;
    return {
      rating: { rating: num(row.rating), rd: num(row.rd), volatility: num(row.volatility) },
      matches: num(row.matches),
      lastDay: str(row.last_day),
    };
  }

  /** The owner's Glicko-2 rating at `at` (default now): the stored rating
   * with its RD grown once for each whole reset day (midnight Sydney)
   * between its last rated match's day and `at`'s day, or the start before
   * any rated match. A newly connected agent plays at this rating. */
  rating(ownerId: string, at: string = this.stamp()): OwnerRating {
    if (this.schemaVersion < 17) throw new EconomyError("ratings need schema v17");
    this.getOwner(ownerId);
    const stored = this.storedRating(ownerId);
    if (stored === null) {
      // (v27) In a new season's file, the soft-reset seed until the first
      // rated match of the season.
      const seed = this.ratingSeed(ownerId);
      const start = seed === null ? RATING_START : { rating: seed.rating, rd: seed.rd, volatility: seed.volatility };
      return { ownerId, ...start, ratedMatches: 0, tier: tierOf(start.rating, 0), lastDay: null };
    }
    const today = this.resetDay(at).day;
    const gap = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${stored.lastDay}T00:00:00Z`)) / 86_400_000);
    const now = idle(stored.rating, Math.max(0, gap - 1));
    return { ownerId, ...now, ratedMatches: stored.matches, tier: tierOf(now.rating, stored.matches), lastDay: stored.lastDay };
  }

  /** The ladder's standings at `at` (default now): every owner with a rated
   * match, by rating (highest first; ties by fewer RD, then name). Placed
   * owners (PLACEMENT_MATCHES rated matches or more) are ranked 1, 2, ...;
   * owners still in placement follow, unranked. `limit` is the public list's
   * length (default LADDER_LIST_SIZE, the top 100). */
  ladder(options: { at?: string; limit?: number } = {}): LadderRow[] {
    if (this.schemaVersion < 17) throw new EconomyError("ratings need schema v17");
    const at = options.at ?? this.stamp();
    const limit = options.limit ?? LADDER_LIST_SIZE;
    if (!Number.isInteger(limit) || limit < 1) throw new EconomyError(`a ladder limit is a whole number of at least 1, got ${limit}`);
    const tallies = new Map<string, { wins: number; losses: number; draws: number }>();
    for (const r of this.db.prepare("SELECT owner_id, score, COUNT(*) AS n FROM match_ratings GROUP BY owner_id, score").all() as Row[]) {
      const t = tallies.get(str(r.owner_id)) ?? { wins: 0, losses: 0, draws: 0 };
      const score = num(r.score);
      if (score === 1) t.wins += num(r.n);
      else if (score === 0) t.losses += num(r.n);
      else t.draws += num(r.n);
      tallies.set(str(r.owner_id), t);
    }
    const rows = (this.db.prepare("SELECT owner_id FROM ratings").all() as Row[]).map((r) => {
      const ownerId = str(r.owner_id);
      const owner = this.getOwner(ownerId);
      const rating = this.rating(ownerId, at);
      const agent = owner.connectedAgentId === null ? null : this.getAgent(owner.connectedAgentId);
      return {
        rank: null as number | null,
        ownerId,
        ownerName: owner.name,
        ownerKind: owner.kind,
        agent: agent === null ? null : { agentId: agent.agentId, name: agent.name },
        rating: rating.rating,
        rd: rating.rd,
        tier: rating.tier,
        ratedMatches: rating.ratedMatches,
        ...(tallies.get(ownerId) ?? { wins: 0, losses: 0, draws: 0 }),
        lastDay: rating.lastDay,
      };
    });
    const placed = (r: LadderRow) => r.ratedMatches >= PLACEMENT_MATCHES;
    rows.sort((a, b) => Number(placed(b)) - Number(placed(a)) || b.rating - a.rating || a.rd - b.rd || a.ownerName.localeCompare(b.ownerName));
    let rank = 0;
    for (const r of rows) if (placed(r)) r.rank = ++rank;
    return rows.slice(0, limit);
  }

  /** The owner's last `limit` rated matches, newest first, each with its
   * rating change (the Rating & form widget). */
  ratingHistory(ownerId: string, limit = 10): (RatingChange & { matchId: string; endedAt: string; opponentOwnerId: string })[] {
    if (this.schemaVersion < 17) throw new EconomyError("ratings need schema v17");
    if (!Number.isInteger(limit) || limit < 1) throw new EconomyError(`a history limit is a whole number of at least 1, got ${limit}`);
    this.getOwner(ownerId);
    const rows = this.db
      .prepare(
        `SELECT r.*, m.ended_at, CASE WHEN r.seat = 'p1' THEN m.p2_owner ELSE m.p1_owner END AS opponent
         FROM match_ratings r JOIN matches m ON m.match_id = r.match_id
         WHERE r.owner_id = ? ORDER BY m.ended_at DESC, m.rowid DESC LIMIT ?`,
      )
      .all(ownerId, limit) as Row[];
    return rows.map((r) => ({
      matchId: str(r.match_id),
      endedAt: str(r.ended_at),
      opponentOwnerId: str(r.opponent),
      ownerId,
      score: num(r.score) as 0 | 0.5 | 1,
      before: { rating: num(r.rating_before), rd: num(r.rd_before), volatility: num(r.vol_before) },
      after: { rating: num(r.rating_after), rd: num(r.rd_after), volatility: num(r.vol_after) },
    }));
  }

  /** The owner's match stats, all agents or one (owner app spec, Stats:
   * "All agents" or the agent that played). */
  ownerStats(ownerId: string, filter: { agentId?: string } = {}): OwnerStats {
    // (session 86) Counted from four columns, not whole match records (the
    // admin view reads this for every house owner on each load).
    const where = filter.agentId === undefined ? "" : "AND (CASE WHEN p1_owner = :o THEN p1_agent ELSE p2_agent END) = :a";
    const rows = this.db
      .prepare(
        `SELECT outcome, winner_owner, CASE WHEN p1_owner = :o THEN p1_credits ELSE p2_credits END AS credits
         FROM matches WHERE (p1_owner = :o OR p2_owner = :o) ${where} ORDER BY ended_at, rowid`,
      )
      .all(filter.agentId === undefined ? { o: ownerId } : { o: ownerId, a: filter.agentId }) as Row[];
    const stats: OwnerStats = { matches: 0, wins: 0, losses: 0, draws: 0, void: 0, winRate: 0, bestWinStreak: 0, creditsFromMatches: 0 };
    let streak = 0;
    for (const m of rows) {
      const outcome = str(m.outcome) as MatchOutcomeKind;
      stats.matches++;
      stats.creditsFromMatches += num(m.credits);
      if (outcome === "cancelled" || outcome === "abandoned") {
        stats.void++;
      } else if (outcome === "draw") {
        stats.draws++;
        streak = 0;
      } else if (strOrNull(m.winner_owner) === ownerId) {
        stats.wins++;
        streak++;
        stats.bestWinStreak = Math.max(stats.bestWinStreak, streak);
      } else {
        stats.losses++;
        streak = 0;
      }
    }
    const decided = stats.wins + stats.losses + stats.draws;
    stats.winRate = decided === 0 ? 0 : stats.wins / decided;
    return stats;
  }

  /** The Stats page's data (session 78): the owner's matches counted (all
   * agents, or the one that played), by faction and by the opponent's
   * faction, the newest `recent` results, the rating chart over the last
   * `days` reset days (ending today) with the weekly trend, and today's
   * earnings. */
  stats(ownerId: string, options: { agentId?: string | null; days?: number; recent?: number; at?: string } = {}): StatsPage {
    if (this.schemaVersion < 17) throw new EconomyError("stats need schema v17");
    const at = options.at ?? this.stamp();
    const days = options.days ?? STATS_CHART_DAYS_DEFAULT;
    const recentCount = options.recent ?? STATS_RECENT_DEFAULT;
    if (!Number.isInteger(days) || days < 7 || days > STATS_CHART_DAYS_MAX) {
      throw new EconomyError(`the chart covers 7 to ${STATS_CHART_DAYS_MAX} days, got ${days}`);
    }
    if (!Number.isInteger(recentCount) || recentCount < 1 || recentCount > STATS_RECENT_MAX) {
      throw new EconomyError(`recent results are 1 to ${STATS_RECENT_MAX}, got ${recentCount}`);
    }
    this.getOwner(ownerId);
    const agentId = options.agentId ?? null;
    const agents = this.listAgents(ownerId);
    if (agentId !== null && !agents.some((a) => a.agentId === agentId)) {
      throw new EconomyError(`agent "${agentId}" isn't one of this owner's agents`);
    }
    const v24 = this.schemaVersion >= 24;
    const rows = this.db
      .prepare(
        `SELECT m.match_id, m.ended_at, m.outcome, m.winner_owner, m.abandoned_by_owner, m.turns,
           CASE WHEN m.p1_owner = :o THEN m.p1_agent ELSE m.p2_agent END AS agent,
           CASE WHEN m.p1_owner = :o THEN m.p2_owner ELSE m.p1_owner END AS opp_owner,
           CASE WHEN m.p1_owner = :o THEN m.p2_agent ELSE m.p1_agent END AS opp_agent,
           CASE WHEN m.p1_owner = :o THEN m.p1_credits ELSE m.p2_credits END AS credits,
           ${v24 ? "CASE WHEN m.p1_owner = :o THEN m.p1_faction ELSE m.p2_faction END" : "NULL"} AS faction,
           ${v24 ? "CASE WHEN m.p1_owner = :o THEN m.p2_faction ELSE m.p1_faction END" : "NULL"} AS opp_faction,
           r.rating_before, r.rating_after
         FROM matches m LEFT JOIN match_ratings r ON r.match_id = m.match_id AND r.owner_id = :o
         WHERE (m.p1_owner = :o OR m.p2_owner = :o) AND m.ended_at <= :at
         ORDER BY m.ended_at, m.rowid`,
      )
      .all({ o: ownerId, at }) as Row[];
    const all: StatsMatchRow[] = rows.map((r) => {
      const outcome = str(r.outcome) as MatchOutcomeKind;
      const result: StatsResult = outcome === "win" ? (str(r.winner_owner) === ownerId ? "win" : "loss") : outcome;
      return {
        matchId: str(r.match_id),
        endedAt: str(r.ended_at),
        result,
        abandonedByYou: outcome === "abandoned" && str(r.abandoned_by_owner) === ownerId,
        agentId: str(r.agent),
        faction: strOrNull(r.faction) as DeckFaction | null,
        opponentOwnerId: str(r.opp_owner),
        opponentAgentId: str(r.opp_agent),
        opponentFaction: strOrNull(r.opp_faction) as DeckFaction | null,
        credits: num(r.credits),
        ratingBefore: numOrNull(r.rating_before),
        ratingAfter: numOrNull(r.rating_after),
        turns: numOrNull(r.turns),
      };
    });
    const played = agentId === null ? all : all.filter((m) => m.agentId === agentId);
    const perAgent = new Map<string, number>();
    for (const m of all) perAgent.set(m.agentId, (perAgent.get(m.agentId) ?? 0) + 1);

    const names = new Map<string, string>();
    const agentName = (id: string) => names.get(id) ?? names.set(id, this.getAgent(id).name).get(id)!;
    const ownerNames = new Map<string, string>();
    const ownerName = (id: string) => ownerNames.get(id) ?? ownerNames.set(id, this.getOwner(id).name).get(id)!;
    const recent: StatsRecentResult[] = played
      .slice(-recentCount)
      .reverse()
      .map((m) => ({
        matchId: m.matchId,
        endedAt: m.endedAt,
        result: m.result === "abandoned" ? (m.abandonedByYou ? "abandonedByYou" : "abandonedByOpponent") : m.result,
        agentId: m.agentId,
        agentName: agentName(m.agentId),
        faction: m.faction,
        opponent: {
          ownerId: m.opponentOwnerId,
          ownerName: ownerName(m.opponentOwnerId),
          agentId: m.opponentAgentId,
          agentName: agentName(m.opponentAgentId),
          faction: m.opponentFaction,
        },
        credits: m.credits,
        rating: m.ratingBefore === null || m.ratingAfter === null ? null : { before: m.ratingBefore, after: m.ratingAfter, change: m.ratingAfter - m.ratingBefore },
        turns: m.turns,
      }));

    // The chart: the last `days` reset days, oldest first, ending today.
    const windows: { day: string; startsAt: string; endsAt: string }[] = [];
    let d = this.resetDay(at);
    for (let k = 0; k < days; k++) {
      windows.unshift({ day: d.day, startsAt: d.startsAt, endsAt: d.endsAt });
      d = this.resetDay(new Date(Date.parse(d.startsAt) - 1).toISOString());
    }
    const scored = this.db
      .prepare(
        `SELECT r.score, r.rating_after, m.ended_at FROM match_ratings r JOIN matches m ON m.match_id = r.match_id
         WHERE r.owner_id = ? AND m.ended_at <= ? ORDER BY m.ended_at, m.rowid`,
      )
      .all(ownerId, at) as Row[];
    const points: RatedPoint[] = scored.map((r) => ({ endedAt: str(r.ended_at), ratingAfter: num(r.rating_after), score: num(r.score) as 0 | 0.5 | 1 }));
    const before = points.filter((p) => p.endedAt < windows[0]!.startsAt);
    const startRating = before.length > 0 ? before[before.length - 1]!.ratingAfter : RATING_START.rating;
    const chart = ratingChart(windows, points, startRating);
    const now = this.rating(ownerId, at);
    // A week ago: the end of the reset day 7 days before today, i.e. just
    // before the day 6 days back starts (the chart has at least 7 days).
    const weekCut = windows[windows.length - 7]!.startsAt;
    let weekAgo: number = RATING_START.rating;
    for (const p of points) if (p.endedAt < weekCut) weekAgo = p.ratingAfter;

    return {
      ownerId,
      agentId,
      agents: agents.map((a) => ({ agentId: a.agentId, name: a.name, matches: perAgent.get(a.agentId) ?? 0 })),
      ...tallyMatches(played),
      recent,
      rating: { now, weekAgo, weekChange: now.rating - weekAgo, chart },
      today: this.dailyEarnings(ownerId, at),
    };
  }

  /** Raw SQL access for tests that prove the schema's own guards (e.g. that
   * an UPDATE on the ledger aborts). Not for application code. */
  unsafeExec(sql: string): void {
    this.db.exec(sql);
  }
}
