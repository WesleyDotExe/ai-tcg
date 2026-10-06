import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { buildDeck, COPY_LIMITS, getCard, SHIPPED_DECK_LISTS, type Card, type DeckFaction, type DeckSpec } from "@ai-tcg/engine";
import { PACK_PRICE_CREDITS, SALVAGE_PACK_POINTS, STARTER_PACKS } from "./config.js";
import { matchCredits, type DailyTally, type MatchResultForAgent } from "./payouts.js";
import {
  BOUND_ORIGINS,
  COPY_ORIGINS,
  FINISHES,
  MIGRATIONS,
  OWNER_KINDS,
  PACK_SOURCES,
  SERIES_KINDS,
  type CopyOrigin,
  type Currency,
  type Finish,
  type MatchOutcomeKind,
  type OwnerKind,
  type PackSource,
  type SeriesKind,
} from "./schema.js";

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
// here (its signature card comes with the unique Mythic session).

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
  createdAt: string;
}

export interface AgentRecord {
  agentId: string;
  ownerId: string;
  name: string;
  createdAt: string;
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
   * copies always; the unique Mythic later). */
  accountBound: boolean;
  acquiredAt: string;
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
   * and starter copies are bound whatever this says. */
  accountBound?: boolean;
}

export interface PackRecord {
  packId: string;
  ownerId: string;
  setCode: string;
  source: PackSource;
  acquiredAt: string;
  openedAt: string | null;
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
}

export interface SalvageResult {
  copies: CardCopy[];
  packPoints: number;
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
}

export class EconomyStore {
  private readonly db: DatabaseSync;
  private readonly now: () => Date;
  private inTransaction = false;

  private constructor(db: DatabaseSync, now: () => Date) {
    this.db = db;
    this.now = now;
  }

  /** Opens (creating if needed) the database file at `path` and brings its
   * schema up to date. `":memory:"` gives a throwaway store for tests. */
  static open(path: string, options: OpenOptions = {}): EconomyStore {
    const db = new DatabaseSync(path);
    if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
    const store = new EconomyStore(db, options.now ?? (() => new Date()));
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
      return { copies, packs };
    });
  }

  // ---- agents ----

  /** A new agent for an owner. It brings nothing with it: no copies, no
   * credits, no packs (owner app spec B). */
  createAgent(input: { ownerId: string; name: string }): AgentRecord {
    const agent: AgentRecord = { agentId: randomUUID(), ownerId: input.ownerId, name: input.name, createdAt: this.stamp() };
    try {
      this.db
        .prepare("INSERT INTO agents (agent_id, owner_id, name, created_at) VALUES (?, ?, ?, ?)")
        .run(agent.agentId, agent.ownerId, agent.name, agent.createdAt);
    } catch (err) {
      refused(err);
    }
    return agent;
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
    return { agentId: str(row.agent_id), ownerId: str(row.owner_id), name: str(row.name), createdAt: str(row.created_at) };
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
  ): void {
    if (!Number.isInteger(delta) || delta === 0) throw new EconomyError(`a ledger entry needs a non-zero whole delta, got ${delta}`);
    try {
      this.db
        .prepare("INSERT INTO ledger (owner_id, played_by, currency, delta, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(ownerId, playedBy, currency, delta, reason, ref, at);
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
    if (!getCard(input.cardId)) throw new EconomyError(`no ownable card with id "${input.cardId}"`);
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
      accountBound: BOUND_ORIGINS.includes(input.origin) || input.accountBound === true,
      acquiredAt: this.stamp(),
    };
    if (!FINISHES.includes(copy.finish)) throw new EconomyError(`unknown finish "${copy.finish}"`);
    if (!SERIES_KINDS.includes(copy.seriesKind)) throw new EconomyError(`unknown series kind "${copy.seriesKind}"`);
    if (!COPY_ORIGINS.includes(copy.origin)) throw new EconomyError(`unknown copy origin "${copy.origin}"`);
    try {
      this.db
        .prepare(
          `INSERT INTO card_copies (copy_id, owner_id, card_id, finish, series_kind, series_code, serial, run_size,
             stamp, origin, origin_ref, account_bound, acquired_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    };
  }

  // ---- salvage ----

  /** The copies that would salvage right now (owner 2026-10-05): for each
   * card the owner holds more of than its playable limit (3/3/2/1), the
   * extras, taken only from unbound standard-finish pack copies of the set.
   * Every copy counts toward the limit, bound ones included, but bound
   * copies, finishes, promos, prizes and numbered copies are never picked.
   * Copies sitting in a saved deck are skipped, so a salvage never breaks a
   * deck; the newest eligible copies go first. */
  salvageableCopies(ownerId: string): CardCopy[] {
    const inDeck = new Set(
      (this.db
        .prepare("SELECT dc.copy_id FROM deck_copies dc JOIN decks d ON d.deck_id = dc.deck_id WHERE d.owner_id = ?")
        .all(ownerId) as Row[]).map((r) => str(r.copy_id)),
    );
    const byCard = new Map<string, CardCopy[]>();
    for (const c of this.collection(ownerId)) byCard.set(c.cardId, [...(byCard.get(c.cardId) ?? []), c]);
    const picked: CardCopy[] = [];
    for (const [cardId, copies] of byCard) {
      const card = getCard(cardId);
      if (!card) continue;
      const extras = copies.length - COPY_LIMITS[card.rarity];
      if (extras <= 0) continue;
      const eligible = copies
        .filter((c) => !c.accountBound && c.origin === "pack" && c.finish === "standard" && c.seriesKind === "set" && !inDeck.has(c.copyId))
        .reverse();
      picked.push(...eligible.slice(0, extras));
    }
    return picked;
  }

  /** Salvages every extra copy `salvageableCopies` names, in one
   * transaction: each is marked disposed (not deleted) and pays its pack
   * points to the owner. The ledger allows one salvage payout per copy, and
   * the schema refuses to salvage a bound or non-pack copy even by raw SQL. */
  salvageExtras(ownerId: string): SalvageResult {
    return this.transaction(() => {
      const copies = this.salvageableCopies(ownerId);
      const at = this.stamp();
      let packPoints = 0;
      for (const c of copies) {
        const points = SALVAGE_PACK_POINTS[getCard(c.cardId)!.rarity];
        try {
          this.db
            .prepare("UPDATE card_copies SET disposed_at = ?, disposed_reason = 'salvaged' WHERE copy_id = ? AND disposed_at IS NULL")
            .run(at, c.copyId);
        } catch (err) {
          refused(err);
        }
        this.appendLedger(ownerId, null, "packPoints", points, "salvage", c.copyId, at);
        packPoints += points;
      }
      return { copies, packPoints };
    });
  }

  // ---- decks ----

  /** Saves a deck made of specific owned copies (owner 2026-10-04, C.2).
   * Ownership is checked here and again by the schema; the deck must also be
   * legal by the engine's own rules (copy limits, size, one faction plus
   * capped neutrals, the pool lint), so a deck that saves is a deck that
   * plays. One copy may sit in several saved decks. Bound copies play like
   * any other. */
  saveDeck(ownerId: string, name: string, copyIds: readonly string[]): PlayableDeck {
    if (new Set(copyIds).size !== copyIds.length) throw new EconomyError(`deck "${name}" lists the same copy twice`);
    const copies = copyIds.map((id) => this.getCopy(id));
    for (const c of copies) {
      if (c.ownerId !== ownerId) throw new EconomyError(`deck "${name}": copy ${c.copyId} belongs to another owner`);
      if (c.disposedAt !== null) throw new EconomyError(`deck "${name}": copy ${c.copyId} is no longer owned`);
    }
    const spec = this.legalSpec(name, copies);
    const deckId = randomUUID();
    this.transaction(() => {
      try {
        this.db.prepare("INSERT INTO decks (deck_id, owner_id, name, created_at) VALUES (?, ?, ?, ?)").run(deckId, ownerId, name, this.stamp());
        const add = this.db.prepare("INSERT INTO deck_copies (deck_id, copy_id) VALUES (?, ?)");
        for (const id of copyIds) add.run(deckId, id);
      } catch (err) {
        refused(err);
      }
    });
    return { deckId, name, copyIds: [...copyIds], spec };
  }

  /** Groups copies by card and runs the engine's deck builder, which throws
   * on any illegal deck. Any finish counts toward ownership. */
  private legalSpec(name: string, copies: readonly CardCopy[]): DeckSpec {
    const byCard = new Map<string, { card: Card; copies: number }>();
    for (const c of copies) {
      const card = getCard(c.cardId);
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

  /** The owner's active deck: whichever agent is connected plays it. */
  setActiveDeck(ownerId: string, deckId: string): void {
    try {
      this.db.prepare("UPDATE owners SET active_deck_id = ? WHERE owner_id = ?").run(deckId, ownerId);
    } catch (err) {
      refused(err);
    }
  }

  /** Loads a saved deck for play, re-checking that every copy is still owned
   * and the deck is still legal (a card pool change can make an old deck
   * illegal). The returned spec's player slot is set by the caller. */
  loadDeck(deckId: string): PlayableDeck {
    const deck = this.db.prepare("SELECT * FROM decks WHERE deck_id = ?").get(deckId) as Row | undefined;
    if (!deck) throw new EconomyError(`no deck "${deckId}"`);
    const name = str(deck.name);
    const copyIds = (this.db.prepare("SELECT copy_id FROM deck_copies WHERE deck_id = ? ORDER BY rowid").all(deckId) as Row[]).map((r) =>
      str(r.copy_id),
    );
    const copies = copyIds.map((id) => this.getCopy(id));
    for (const c of copies) {
      if (c.ownerId !== str(deck.owner_id) || c.disposedAt !== null) {
        throw new EconomyError(`deck "${name}": copy ${c.copyId} is no longer owned by the deck's owner`);
      }
    }
    return { deckId, name, copyIds, spec: this.legalSpec(name, copies) };
  }

  // ---- packs ----

  /** The owner spends credits on a pack: the debit and the new unopened pack
   * happen together or not at all, and the schema refuses a purchase the
   * balance can't cover. */
  buyPack(ownerId: string, setCode: string): PackRecord {
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
   * agents of the same owner (no self-play farming). */
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
      };
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
      } catch (err) {
        refused(err);
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
    return (this.db.prepare(sql).all(params) as Row[]).map((r) => {
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
