import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { buildDeck, getCard, type Card, type DeckFaction, type DeckSpec } from "@ai-tcg/engine";
import { matchCredits, type DailyTally, type MatchResultForAgent } from "./payouts.js";
import {
  COPY_SOURCES,
  FINISHES,
  MIGRATIONS,
  PACK_SOURCES,
  SERIES_KINDS,
  type CopySource,
  type Currency,
  type Finish,
  type MatchOutcomeKind,
  type PackSource,
  type SeriesKind,
} from "./schema.js";

// Storage choice (ECONOMY.md, "Storage"): Node's built-in SQLite
// (`node:sqlite`, Node 22). One local file, no server, no native addon, no
// network. It gives real transactions, so a pack purchase debits credits and
// creates the pack together or not at all, and the integrity rules in
// schema.ts hold for any caller.

/** Season 0 is the in-house season (owner 2026-10-04, C.11). A new season is
 * a new database file; the old file is the archive. */
export const DEFAULT_SEASON = "S0";

/** Price of one pack in credits (owner 2026-10-04 economy answers, 1). */
export const PACK_PRICE_CREDITS = 100;

export interface AgentRecord {
  agentId: string;
  name: string;
  faction: DeckFaction | null;
  activeDeckId: string | null;
  createdAt: string;
}

export interface LedgerEntry {
  entryId: number;
  agentId: string;
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
  source: CopySource;
  sourceRef: string | null;
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
  source: CopySource;
  sourceRef?: string | null;
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
  p1AgentId: string;
  p2AgentId: string;
  p1DeckId: string | null;
  p2DeckId: string | null;
  outcome: MatchOutcomeKind;
  winnerAgentId: string | null;
  abandonedBy: string | null;
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
}

export class EconomyStore {
  private readonly db: DatabaseSync;
  private readonly now: () => Date;

  private constructor(db: DatabaseSync, now: () => Date) {
    this.db = db;
    this.now = now;
  }

  /** Opens (creating if needed) the database file at `path` and brings its
   * schema up to date. `":memory:"` gives a throwaway store for tests. */
  static open(path: string, options: OpenOptions = {}): EconomyStore {
    const db = new DatabaseSync(path);
    db.exec("PRAGMA foreign_keys = ON;");
    if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
    const store = new EconomyStore(db, options.now ?? (() => new Date()));
    store.migrate(options.season ?? DEFAULT_SEASON);
    return store;
  }

  close(): void {
    this.db.close();
  }

  private migrate(season: string): void {
    const version = num((this.db.prepare("PRAGMA user_version").get() as Row).user_version);
    if (version > MIGRATIONS.length) {
      throw new EconomyError(`database schema v${version} is newer than this code (v${MIGRATIONS.length})`);
    }
    for (let v = version; v < MIGRATIONS.length; v++) {
      this.transaction(() => {
        this.db.exec(MIGRATIONS[v]!);
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

  /** Runs `fn` in one write transaction: everything or nothing. */
  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  // ---- agents ----

  createAgent(input: { name: string; faction?: DeckFaction | null }): AgentRecord {
    const agent: AgentRecord = {
      agentId: randomUUID(),
      name: input.name,
      faction: input.faction ?? null,
      activeDeckId: null,
      createdAt: this.stamp(),
    };
    try {
      this.db
        .prepare("INSERT INTO agents (agent_id, name, faction, created_at) VALUES (?, ?, ?, ?)")
        .run(agent.agentId, agent.name, agent.faction, agent.createdAt);
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

  listAgents(): AgentRecord[] {
    return (this.db.prepare("SELECT * FROM agents ORDER BY created_at, name").all() as Row[]).map((r) => this.agentFromRow(r));
  }

  private agentFromRow(row: Row): AgentRecord {
    return {
      agentId: str(row.agent_id),
      name: str(row.name),
      faction: strOrNull(row.faction) as DeckFaction | null,
      activeDeckId: strOrNull(row.active_deck_id),
      createdAt: str(row.created_at),
    };
  }

  // ---- ledger ----

  /** A balance is never stored: it's the sum of the agent's ledger. */
  balance(agentId: string, currency: Currency = "credits"): number {
    const row = this.db
      .prepare("SELECT COALESCE(SUM(delta), 0) AS total FROM ledger WHERE agent_id = ? AND currency = ?")
      .get(agentId, currency) as Row;
    return num(row.total);
  }

  ledger(agentId: string): LedgerEntry[] {
    return (this.db.prepare("SELECT * FROM ledger WHERE agent_id = ? ORDER BY entry_id").all(agentId) as Row[]).map((r) => ({
      entryId: num(r.entry_id),
      agentId: str(r.agent_id),
      currency: str(r.currency) as Currency,
      delta: num(r.delta),
      reason: str(r.reason),
      ref: strOrNull(r.ref),
      createdAt: str(r.created_at),
    }));
  }

  private appendLedger(agentId: string, currency: Currency, delta: number, reason: string, ref: string | null, at: string): void {
    if (!Number.isInteger(delta) || delta === 0) throw new EconomyError(`a ledger entry needs a non-zero whole delta, got ${delta}`);
    try {
      this.db
        .prepare("INSERT INTO ledger (agent_id, currency, delta, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(agentId, currency, delta, reason, ref, at);
    } catch (err) {
      refused(err);
    }
  }

  // ---- owned copies ----

  /** Records one owned copy. Every copy is its own item with a hidden id
   * (owner 2026-10-04, C.1); the card id must be a real, ownable card. */
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
      source: input.source,
      sourceRef: input.sourceRef ?? null,
      acquiredAt: this.stamp(),
    };
    if (!FINISHES.includes(copy.finish)) throw new EconomyError(`unknown finish "${copy.finish}"`);
    if (!SERIES_KINDS.includes(copy.seriesKind)) throw new EconomyError(`unknown series kind "${copy.seriesKind}"`);
    if (!COPY_SOURCES.includes(copy.source)) throw new EconomyError(`unknown copy source "${copy.source}"`);
    try {
      this.db
        .prepare(
          `INSERT INTO card_copies (copy_id, owner_id, card_id, finish, series_kind, series_code, serial, run_size,
             stamp, source, source_ref, acquired_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          copy.source,
          copy.sourceRef,
          copy.acquiredAt,
        );
    } catch (err) {
      refused(err);
    }
    return copy;
  }

  /** Grants many copies in one transaction (a starter collection, a pack's
   * contents): all of them or none. */
  grantCopies(inputs: readonly GrantCopyInput[]): CardCopy[] {
    return this.transaction(() => inputs.map((i) => this.grantCopy(i)));
  }

  /** The copies an agent owns right now (not converted or otherwise
   * disposed of), oldest first. */
  collection(ownerId: string): CardCopy[] {
    return (
      this.db
        .prepare("SELECT * FROM card_copies WHERE owner_id = ? AND disposed_at IS NULL ORDER BY acquired_at, rowid")
        .all(ownerId) as Row[]
    ).map((r) => this.copyFromRow(r));
  }

  getCopy(copyId: string): CardCopy & { disposedAt: string | null } {
    const row = this.db.prepare("SELECT * FROM card_copies WHERE copy_id = ?").get(copyId) as Row | undefined;
    if (!row) throw new EconomyError(`no copy "${copyId}"`);
    return { ...this.copyFromRow(row), disposedAt: strOrNull(row.disposed_at) };
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
      source: str(r.source) as CopySource,
      sourceRef: strOrNull(r.source_ref),
      acquiredAt: str(r.acquired_at),
    };
  }

  // ---- decks ----

  /** Saves a deck made of specific owned copies (owner 2026-10-04, C.2).
   * Ownership is checked here and again by the schema; the deck must also be
   * legal by the engine's own rules (copy limits, size, one faction plus
   * capped neutrals, the pool lint), so a deck that saves is a deck that
   * plays. One copy may sit in several saved decks. */
  saveDeck(ownerId: string, name: string, copyIds: readonly string[]): PlayableDeck {
    if (new Set(copyIds).size !== copyIds.length) throw new EconomyError(`deck "${name}" lists the same copy twice`);
    const copies = copyIds.map((id) => this.getCopy(id));
    for (const c of copies) {
      if (c.ownerId !== ownerId) throw new EconomyError(`deck "${name}": copy ${c.copyId} belongs to another agent`);
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

  setActiveDeck(agentId: string, deckId: string): void {
    try {
      this.db.prepare("UPDATE agents SET active_deck_id = ? WHERE agent_id = ?").run(deckId, agentId);
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
        throw new EconomyError(`deck "${name}": copy ${c.copyId} is no longer owned by the deck's agent`);
      }
    }
    return { deckId, name, copyIds, spec: this.legalSpec(name, copies) };
  }

  // ---- packs ----

  /** The owner spends an agent's credits on a pack (owner 2026-10-04, C.7):
   * the debit and the new unopened pack happen together or not at all, and
   * the schema refuses a purchase the balance can't cover. */
  buyPack(agentId: string, setCode: string): PackRecord {
    const pack: PackRecord = { packId: randomUUID(), ownerId: agentId, setCode, source: "purchase", acquiredAt: this.stamp(), openedAt: null };
    this.transaction(() => {
      this.appendLedger(agentId, "credits", -PACK_PRICE_CREDITS, "packPurchase", pack.packId, pack.acquiredAt);
      this.insertPack(pack);
    });
    return pack;
  }

  /** A pack that costs nothing (starter, weekly challenge, owner's daily). */
  grantPack(agentId: string, setCode: string, source: Exclude<PackSource, "purchase">): PackRecord {
    if (!PACK_SOURCES.includes(source)) throw new EconomyError(`unknown pack source "${source}"`);
    const pack: PackRecord = { packId: randomUUID(), ownerId: agentId, setCode, source, acquiredAt: this.stamp(), openedAt: null };
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

  unopenedPacks(agentId: string): PackRecord[] {
    return (
      this.db.prepare("SELECT * FROM packs WHERE owner_id = ? AND opened_at IS NULL ORDER BY acquired_at, rowid").all(agentId) as Row[]
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

  /** Wins and losses (draws count as losses) this agent already has on the
   * UTC day of `at`. Counted from match history, so a win that paid 0
   * (past the daily cap) still counts. */
  dailyTally(agentId: string, at: string): DailyTally {
    const day = utcDay(at);
    const row = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN outcome = 'win' AND winner_agent = :a THEN 1 ELSE 0 END), 0) AS wins,
           COALESCE(SUM(CASE WHEN (outcome = 'win' AND winner_agent <> :a) OR outcome = 'draw' THEN 1 ELSE 0 END), 0) AS losses
         FROM matches
         WHERE (p1_agent = :a OR p2_agent = :a) AND substr(ended_at, 1, 10) = :day`,
      )
      .get({ a: agentId, day }) as Row;
    return { winsToday: num(row.wins), lossesToday: num(row.losses) };
  }

  /** Records a finished match and pays both agents for it, in one
   * transaction. Recording the same match id twice is refused (and could not
   * pay twice anyway: the ledger allows one payout per agent per match). */
  recordMatch(input: RecordMatchInput): MatchRecord {
    // Normalised to ISO UTC so the day the tally counts is the string's
    // first ten characters.
    utcDay(input.endedAt ?? this.stamp());
    const endedAt = new Date(input.endedAt ?? this.stamp()).toISOString();
    const { p1AgentId: p1, p2AgentId: p2, outcome } = input;
    if (p1 === p2) throw new EconomyError("an agent cannot play itself");
    const resultFor = (agentId: string): MatchResultForAgent => {
      switch (outcome.kind) {
        case "win":
          return outcome.winnerAgentId === agentId ? "win" : "loss";
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
      const p1Credits = matchCredits(resultFor(p1), this.dailyTally(p1, endedAt));
      const p2Credits = matchCredits(resultFor(p2), this.dailyTally(p2, endedAt));
      const record: MatchRecord = {
        matchId: input.matchId,
        seed: input.seed,
        p1AgentId: p1,
        p2AgentId: p2,
        p1DeckId: input.p1DeckId ?? null,
        p2DeckId: input.p2DeckId ?? null,
        outcome: outcome.kind,
        winnerAgentId: outcome.kind === "win" ? outcome.winnerAgentId : null,
        abandonedBy: outcome.kind === "abandoned" ? outcome.byAgentId : null,
        turns: input.turns ?? null,
        moves: input.moves ?? null,
        p1Credits,
        p2Credits,
        endedAt,
      };
      try {
        this.db
          .prepare(
            `INSERT INTO matches (match_id, seed, p1_agent, p2_agent, p1_deck, p2_deck, outcome, winner_agent,
               abandoned_by, turns, moves, p1_credits, p2_credits, ended_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            record.matchId,
            record.seed,
            p1,
            p2,
            record.p1DeckId,
            record.p2DeckId,
            record.outcome,
            record.winnerAgentId,
            record.abandonedBy,
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
      if (p1Credits > 0) this.appendLedger(p1, "credits", p1Credits, reason(resultFor(p1)), input.matchId, endedAt);
      if (p2Credits > 0) this.appendLedger(p2, "credits", p2Credits, reason(resultFor(p2)), input.matchId, endedAt);
      return record;
    });
  }

  matchHistory(agentId?: string): MatchRecord[] {
    const rows = (
      agentId === undefined
        ? this.db.prepare("SELECT * FROM matches ORDER BY ended_at, rowid").all()
        : this.db.prepare("SELECT * FROM matches WHERE p1_agent = ? OR p2_agent = ? ORDER BY ended_at, rowid").all(agentId, agentId)
    ) as Row[];
    return rows.map((r) => ({
      matchId: str(r.match_id),
      seed: num(r.seed),
      p1AgentId: str(r.p1_agent),
      p2AgentId: str(r.p2_agent),
      p1DeckId: strOrNull(r.p1_deck),
      p2DeckId: strOrNull(r.p2_deck),
      outcome: str(r.outcome) as MatchOutcomeKind,
      winnerAgentId: strOrNull(r.winner_agent),
      abandonedBy: strOrNull(r.abandoned_by),
      turns: numOrNull(r.turns),
      moves: numOrNull(r.moves),
      p1Credits: num(r.p1_credits),
      p2Credits: num(r.p2_credits),
      endedAt: str(r.ended_at),
    }));
  }

  /** Raw SQL access for tests that prove the schema's own guards (e.g. that
   * an UPDATE on the ledger aborts). Not for application code. */
  unsafeExec(sql: string): void {
    this.db.exec(sql);
  }
}
