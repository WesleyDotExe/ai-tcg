import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  buildDeck,
  chooseDeck,
  holdingsOf,
  type DeckBuildOptions,
  CARD_REGISTRY,
  deckFaction,
  agentName as generatedAgentName,
  Rng,
  generateAgentCandidates,
  generateSignatureCandidates,
  getCard,
  COPY_LIMITS,
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
} from "@ai-tcg/engine";
import {
  AGENT_RENAME_PACK_POINTS,
  BULK_OPEN_COUNT,
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
} from "./config.js";
import { customAgentNameProblem, nameKey, tidyAgentName } from "./agentNames.js";
import { dummyHash, hashPassword, needsRehash, verifyPassword } from "./passwords.js";
import { CARD_SETS, FULL_ART_OR_BETTER, nextPity, rollPack, secretCardOf, type PackSlot, type PityState } from "./packs.js";
import type { SecretCard } from "./chase.js";
import {
  CLOSE_WIN_HEALTH,
  COSMETICS,
  KIND_LABEL,
  LOADOUT_SLOTS,
  SLOT_KIND,
  STARTER_BOASTS,
  catalogueProblem,
  onSale,
  type CosmeticItem,
  type CosmeticKind,
  type LoadoutSlot,
} from "./cosmetics.js";
import { matchCredits, type DailyTally, type MatchResultForAgent } from "./payouts.js";
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

export type DeckChoice = "agent" | "forced";

/** (v14) What the agent's deck was built from. */
export interface AgentDeckBuiltFrom {
  /** The play style it was measured in. */
  style: PlayStyleId;
  /** The faction lock it was built under (null: none). */
  factionLock: DeckFaction | null;
  /** `holdingsFingerprint` of the cards held. */
  holdings: string;
}

/** A fingerprint of the cards an owner holds (copies per card id; finishes
 * and which copy don't matter to the deck builder, and ids the engine
 * doesn't know are left out as the builder leaves them out). */
export function holdingsFingerprint(cardIds: Iterable<string>): string {
  const counts = [...holdingsOf(cardIds)].sort(([a], [b]) => a.localeCompare(b));
  return createHash("sha256").update(counts.map(([id, n]) => `${id}:${n}`).join(",")).digest("hex").slice(0, 16);
}

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
  /** ISO time the match ended. Its UTC date is the "day" the daily win
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
  source: "starter" | "purchase";
  /** The credits payment, for a bought item. */
  ledgerEntryId: number | null;
  acquiredAt: string;
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

export interface LiveMatch {
  matchId: string;
  startedAt: string;
  p1: LiveSide;
  p2: LiveSide;
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

export class EconomyError extends Error {}

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

function utcDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new EconomyError(`not a valid time: "${iso}"`);
  return d.toISOString().slice(0, 10);
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
  return null;
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
      return { copies, packs, cosmetics: this.grantStarterBoasts(ownerId, at) };
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
   * during one applies from the next. */
  setPlayStyle(agentId: string, style: string): AgentRecord {
    if (this.schemaVersion < 13) throw new EconomyError("play styles need schema v13");
    if (!isPlayStyleId(style)) throw new EconomyError(`"${style}" is not a play style`);
    const agent = this.getAgent(agentId);
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
      acquiredAt: str(r.acquired_at),
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
    const item = this.catalogue.get(itemId);
    if (!item) throw new EconomyError(`no cosmetic "${itemId}"`);
    const at = this.stamp();
    if (!onSale(item, this.season, at)) {
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

  /** The four faction starter boasts, with the starter collection (all
   * four, since agents can switch factions). The owner's agents made
   * before it start wearing the faction's boast. */
  private grantStarterBoasts(ownerId: string, at: string): OwnedCosmetic[] {
    if (this.schemaVersion < 11) return [];
    const insert = this.db.prepare("INSERT INTO owned_cosmetics (owner_id, item_id, kind, source, acquired_at) VALUES (?, ?, 'boast', 'starter', ?)");
    for (const boast of Object.values(STARTER_BOASTS)) {
      try {
        insert.run(ownerId, boast.itemId, at);
      } catch (err) {
        refused(err);
      }
    }
    for (const agent of this.listAgents(ownerId)) this.equipFactionBoast(ownerId, agent.agentId, at);
    return this.ownedCosmetics(ownerId);
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
   * known. The agent never chooses. */
  private chooseBoast(agentId: string, loadout: Loadout, deckId: string | null, winnerHealth: number | null): MatchBoast | null {
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
      try {
        if (this.schemaVersion >= 13) {
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
      return { matchId: input.matchId, startedAt, p1, p2 };
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
  liveMatches(): { matchId: string; p1OwnerId: string; p2OwnerId: string; p1AgentId: string; p2AgentId: string; startedAt: string }[] {
    return (this.db.prepare("SELECT * FROM live_matches ORDER BY started_at, rowid").all() as Row[]).map((r) => ({
      matchId: str(r.match_id),
      p1OwnerId: str(r.p1_owner),
      p2OwnerId: str(r.p2_owner),
      p1AgentId: str(r.p1_agent),
      p2AgentId: str(r.p2_agent),
      startedAt: str(r.started_at),
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

  /** A balance is never stored: it's the sum of the owner's ledger. */
  balance(ownerId: string, currency: Currency = "credits"): number {
    const row = this.db
      .prepare("SELECT COALESCE(SUM(delta), 0) AS total FROM ledger WHERE owner_id = ? AND currency = ?")
      .get(ownerId, currency) as Row;
    return num(row.total);
  }

  ledger(ownerId: string): LedgerEntry[] {
    return (this.db.prepare("SELECT * FROM ledger WHERE owner_id = ? ORDER BY entry_id").all(ownerId) as Row[]).map((r) => ({
      entryId: num(r.entry_id),
      ownerId: str(r.owner_id),
      playedBy: strOrNull(r.played_by),
      currency: str(r.currency) as Currency,
      delta: num(r.delta),
      reason: str(r.reason),
      ref: strOrNull(r.ref),
      createdAt: str(r.created_at),
    }));
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
    return {
      cardId,
      rarity: card.rarity,
      owned: copies.length,
      salvageable,
      packPointsEach: SALVAGE_PACK_POINTS[card.rarity],
      notSalvageable: [...reasons].map(([reason, count]) => ({ reason, count })),
      decks,
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
        if (this.schemaVersion >= 14) this.db.prepare("UPDATE decks SET built_style = NULL, built_lock = NULL, built_holdings = NULL WHERE deck_id = ?").run(deckId);
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
      this.db.prepare("UPDATE owners SET deck_choice = 'forced' WHERE owner_id = ?").run(ownerId);
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
    const row = this.db.prepare("SELECT built_style, built_lock, built_holdings FROM decks WHERE owner_id = ? AND built_by_agent = 1").get(ownerId) as Row | undefined;
    if (!row || row.built_style === null) return null;
    const lock = str(row.built_lock);
    return { style: str(row.built_style) as PlayStyleId, factionLock: lock === "none" ? null : (lock as DeckFaction), holdings: str(row.built_holdings) };
  }

  /** What the agent would build from now: the connected agent's style
   * (Calculator with none connected), the faction lock and the cards held. */
  private agentDeckInputs(ownerId: string): AgentDeckBuiltFrom & { held: CardCopy[] } {
    const owner = this.getOwner(ownerId);
    const held = this.collection(ownerId);
    const style = owner.connectedAgentId === null ? DEFAULT_PLAY_STYLE : this.getAgent(owner.connectedAgentId).playStyle;
    return { style, factionLock: owner.factionLock, holdings: holdingsFingerprint(held.map((c) => c.cardId)), held };
  }

  /**
   * (v14) Why the agent's deck should be rebuilt, or [] when it is up to
   * date (owner 2026-10-15/-20: the agent rebuilds when the owner's cards,
   * the faction lock or its play style change, not before every match).
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
    if (was.holdings !== now.holdings) reasons.push("the cards held changed");
    if (was.factionLock !== now.factionLock) reasons.push(`the faction lock changed (${was.factionLock ?? "none"} -> ${now.factionLock ?? "none"})`);
    if (was.style !== now.style) reasons.push(`the play style changed (${PLAY_STYLES[was.style].name} -> ${PLAY_STYLES[now.style].name})`);
    return reasons;
  }

  /** (v14) Rebuilds the agent's deck if `agentDeckRebuildReasons` names a
   * reason, else does nothing (null). What a scheduler (the ladder, item
   * 6b) calls between matches. */
  async rebuildAgentDeckIfNeeded(ownerId: string, options: Omit<DeckBuildOptions, "faction" | "style"> = {}): Promise<{ reasons: string[]; build: AgentDeckBuild } | null> {
    const reasons = this.agentDeckRebuildReasons(ownerId);
    if (reasons.length === 0) return null;
    return { reasons, build: await this.buildAgentDeck(ownerId, options) };
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
   */
  async buildAgentDeck(ownerId: string, options: Omit<DeckBuildOptions, "faction" | "style"> = {}): Promise<AgentDeckBuild> {
    const owner = this.getOwner(ownerId);
    if (owner.deckChoice === "forced") throw new EconomyError(`owner "${owner.name}" forces a deck; set the deck choice to the agent first`);
    const inputs = this.agentDeckInputs(ownerId);
    const held = inputs.held;
    const style = this.schemaVersion >= 14 ? inputs.style : DEFAULT_PLAY_STYLE;
    const built = await (async () => {
      try {
        return await chooseDeck(holdingsOf(held.map((c) => c.cardId)), { ...options, faction: owner.factionLock ?? undefined, style });
      } catch (err) {
        throw new EconomyError(err instanceof Error ? err.message : String(err));
      }
    })();
    // Copies for the list, oldest held first (the collection's order).
    const copyIds: string[] = [];
    for (const [cardId, n] of built.list) copyIds.push(...held.filter((c) => c.cardId === cardId).slice(0, n).map((c) => c.copyId));
    const deck = this.transaction(() => {
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
      // The owner may have switched to a forced deck while the agent built.
      if (this.getOwner(ownerId).deckChoice === "agent") this.activateDeck(ownerId, saved.deckId);
      return saved;
    });
    return {
      deck,
      faction: built.faction,
      style,
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
    return {
      deckId,
      name,
      ownerId,
      active: this.getOwner(ownerId).activeDeckId === deckId,
      complete: missing.size === 0,
      missing: [...missing].map(([cardId, m]) => ({ cardId, ...m })),
      cards: slots.length,
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
    knownSet(setCode);
    const pack: PackRecord = { packId: randomUUID(), ownerId, setCode, source: "purchase", acquiredAt: this.stamp(), openedAt: null };
    this.transaction(() => {
      this.appendLedger(ownerId, null, "credits", -PACK_PRICE_CREDITS, "packPurchase", pack.packId, pack.acquiredAt);
      this.insertPack(pack);
    });
    return pack;
  }

  /** A pack that costs nothing (starter, weekly challenge, owner's daily). */
  grantPack(ownerId: string, setCode: string, source: Exclude<PackSource, "purchase">): PackRecord {
    if (!PACK_SOURCES.includes(source) || (source as PackSource) === "purchase") throw new EconomyError(`not a free pack source: "${source}"`);
    knownSet(setCode);
    const pack: PackRecord = { packId: randomUUID(), ownerId, setCode, source, acquiredAt: this.stamp(), openedAt: null };
    this.insertPack(pack);
    return pack;
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
      return {
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
    });
  }

  /** Opens 1 pack, or BULK_OPEN_COUNT (10) at once (owner 2026-10-05): the
   * same odds, no discount and no bonus. The packs open one after another,
   * oldest first, each its own opening, all in one transaction (all open or
   * none). `seeds` is for tests and the demo only. */
  openPacks(ownerId: string, count: number, options: { seeds?: readonly number[] } = {}): BulkOpening {
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

  /** Copies each of a set's Prototype runs still has. */
  private prototypesLeft(setCode: string): Map<string, number> {
    return new Map(knownSet(setCode).prototypes.map((r) => [r.code, r.runSize - this.prototypesFound(r.code)]));
  }

  // ---- crafting with pack points (ECONOMY.md "Packs") ----

  /** The owner spends pack points on one standard-finish copy of a set card
   * (Common 40, Uncommon 80, Rare 250, Mythic 800). The copy is crafted, so
   * account-bound. Refused once the owner holds the card's playable limit
   * (3 / 3 / 2 / 1), counting every copy held, and refused without the
   * points (the schema refuses an overdraw too). */
  craftCard(ownerId: string, cardId: string): CardCopy {
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
    const gold = set.cards.map((c) => ({
      number: c.goldNumber,
      kind: "gold" as const,
      cardId: c.cardId,
      secretCode: null,
      name: c.name,
      rarity: c.rarity,
      owned: count((x) => x.cardId === c.cardId && x.finish === "gold"),
    }));
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
   * UTC day of `at`, whichever of its agents played them. Counted from match
   * history, so a win that paid 0 (past the daily cap) still counts, and
   * switching agents can neither reset nor double the caps. */
  dailyTally(ownerId: string, at: string): DailyTally {
    const day = utcDay(at);
    const row = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN outcome = 'win' AND winner_owner = :o THEN 1 ELSE 0 END), 0) AS wins,
           COALESCE(SUM(CASE WHEN (outcome = 'win' AND winner_owner <> :o) OR outcome = 'draw' THEN 1 ELSE 0 END), 0) AS losses
         FROM matches
         WHERE (p1_owner = :o OR p2_owner = :o) AND substr(ended_at, 1, 10) = :day`,
      )
      .get({ o: ownerId, day }) as Row;
    return { winsToday: num(row.wins), lossesToday: num(row.losses) };
  }

  /** Records a finished match and pays both owners for it, in one
   * transaction, each payout marked with the agent that played. Refused: the
   * same match id twice, a winner or abandoner who didn't play, and two
   * agents of the same owner (no self-play farming). A match begun with
   * `startMatch` ends its live state here (a cancel or abandon included). A
   * match id that was never started is still recorded, for offline history
   * and tests; the server records only matches it started. */
  recordMatch(input: RecordMatchInput): MatchRecord {
    // Normalised to ISO UTC so the day the tally counts is the string's
    // first ten characters.
    const raw = input.endedAt ?? this.stamp();
    utcDay(raw);
    const endedAt = new Date(raw).toISOString();
    const { p1AgentId: p1, p2AgentId: p2, outcome } = input;
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
      } catch (err) {
        refused(err);
      }
      if (this.schemaVersion >= 11) {
        // The loadouts as the match ends: the same as it started, since a
        // live match's owners can't change them.
        record.loadouts = { p1: this.loadout(p1), p2: this.loadout(p2) };
        const insertLoadout = this.db.prepare(
          `INSERT INTO match_loadouts (match_id, seat, agent_id, boast, close_win_boast, card_back, avatar, arena)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        if (outcome.kind === "win") {
          const seat = outcome.winnerAgentId === p1 ? "p1" : "p2";
          record.boast = this.chooseBoast(outcome.winnerAgentId, record.loadouts[seat], seat === "p1" ? record.p1DeckId : record.p2DeckId, health?.[seat] ?? null);
        }
        try {
          for (const seat of ["p1", "p2"] as const) {
            const l = record.loadouts[seat];
            insertLoadout.run(input.matchId, seat, seat === "p1" ? p1 : p2, l.boast, l.closeWinBoast, l.cardBack, l.avatar, l.arena);
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
      const reason = (r: MatchResultForAgent) => (r === "win" ? "matchWin" : r === "draw" ? "matchDraw" : "matchLoss");
      if (p1Credits > 0) this.appendLedger(owner1, p1, "credits", p1Credits, reason(resultFor(owner1)), input.matchId, endedAt);
      if (p2Credits > 0) this.appendLedger(owner2, p2, "credits", p2Credits, reason(resultFor(owner2)), input.matchId, endedAt);
      return record;
    });
  }

  /** Match history, oldest first: everything, one owner's, or (with an
   * agent) only the matches that agent played. */
  matchHistory(filter: { ownerId?: string; agentId?: string } = {}): MatchRecord[] {
    const where: string[] = [];
    const params: Record<string, string> = {};
    if (filter.ownerId !== undefined) {
      where.push("(p1_owner = :o OR p2_owner = :o)");
      params.o = filter.ownerId;
    }
    if (filter.agentId !== undefined) {
      where.push("(p1_agent = :a OR p2_agent = :a)");
      params.a = filter.agentId;
    }
    const sql = `SELECT * FROM matches ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ended_at, rowid`;
    const rows = this.db.prepare(sql).all(params) as Row[];
    const loadouts = new Map<string, { p1: Loadout; p2: Loadout }>();
    const boasts = new Map<string, MatchBoast>();
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
      };
    });
  }

  /** The owner's match stats, all agents or one (owner app spec, Stats:
   * "All agents" or the agent that played). */
  ownerStats(ownerId: string, filter: { agentId?: string } = {}): OwnerStats {
    const stats: OwnerStats = { matches: 0, wins: 0, losses: 0, draws: 0, void: 0, winRate: 0, bestWinStreak: 0, creditsFromMatches: 0 };
    let streak = 0;
    for (const m of this.matchHistory({ ownerId, agentId: filter.agentId })) {
      stats.matches++;
      stats.creditsFromMatches += m.p1OwnerId === ownerId ? m.p1Credits : m.p2Credits;
      if (m.outcome === "cancelled" || m.outcome === "abandoned") {
        stats.void++;
      } else if (m.outcome === "draw") {
        stats.draws++;
        streak = 0;
      } else if (m.winnerOwnerId === ownerId) {
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

  /** Raw SQL access for tests that prove the schema's own guards (e.g. that
   * an UPDATE on the ledger aborts). Not for application code. */
  unsafeExec(sql: string): void {
    this.db.exec(sql);
  }
}
