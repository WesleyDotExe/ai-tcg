// The economy database schema, as numbered migrations. `PRAGMA user_version`
// records how many have run, so opening an older file brings it up to date
// and opening a current one does nothing. Never edit a shipped migration;
// add the next one.
//
// Integrity rules live in the schema itself, not only in store.ts, so a
// future caller (the server, an owner tool, a hand-run sqlite3 shell) can't
// bypass them:
//  - the ledger is append-only (UPDATE and DELETE abort), and no entry may
//    take a balance below zero;
//  - a deck may only hold copies its own agent owns and hasn't disposed of;
//  - a numbered copy (Prototype or tournament serial) exists at most once.

export const FINISHES = ["standard", "foil", "fullArt", "altArt", "gold", "prototype", "tournament"] as const;
export type Finish = (typeof FINISHES)[number];

export const COPY_SOURCES = ["pack", "starter", "promo", "packPoints", "tournament"] as const;
export type CopySource = (typeof COPY_SOURCES)[number];

export const SERIES_KINDS = ["set", "promo", "prototype", "tournament"] as const;
export type SeriesKind = (typeof SERIES_KINDS)[number];

export const PACK_SOURCES = ["purchase", "starter", "weeklyChallenge", "ownerDaily"] as const;
export type PackSource = (typeof PACK_SOURCES)[number];

export const CURRENCIES = ["credits", "packPoints"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MATCH_OUTCOMES = ["win", "draw", "cancelled", "abandoned"] as const;
export type MatchOutcomeKind = (typeof MATCH_OUTCOMES)[number];

const inList = (values: readonly string[]) => `(${values.map((v) => `'${v}'`).join(", ")})`;

export const MIGRATIONS: readonly string[] = [
  // 1: the Stage 4 persistence base (session 28).
  `
  CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE agents (
    agent_id       TEXT PRIMARY KEY,
    name           TEXT NOT NULL UNIQUE,
    faction        TEXT,
    active_deck_id TEXT REFERENCES decks(deck_id),
    created_at     TEXT NOT NULL
  );

  CREATE TABLE ledger (
    entry_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id   TEXT NOT NULL REFERENCES agents(agent_id),
    currency   TEXT NOT NULL CHECK (currency IN ${inList(CURRENCIES)}),
    delta      INTEGER NOT NULL CHECK (delta <> 0),
    reason     TEXT NOT NULL,
    ref        TEXT,
    created_at TEXT NOT NULL
  );
  -- One payout per agent per reason per thing: recording the same match or
  -- the same pack purchase twice can't pay twice.
  CREATE UNIQUE INDEX ledger_once ON ledger(agent_id, currency, reason, ref) WHERE ref IS NOT NULL;
  CREATE INDEX ledger_by_agent ON ledger(agent_id, currency);

  CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger
  BEGIN SELECT RAISE(ABORT, 'ledger is append-only: entries cannot be changed'); END;
  CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger
  BEGIN SELECT RAISE(ABORT, 'ledger is append-only: entries cannot be deleted'); END;
  CREATE TRIGGER ledger_no_overdraw BEFORE INSERT ON ledger
  WHEN (SELECT COALESCE(SUM(delta), 0) FROM ledger
        WHERE agent_id = NEW.agent_id AND currency = NEW.currency) + NEW.delta < 0
  BEGIN SELECT RAISE(ABORT, 'insufficient balance'); END;

  CREATE TABLE packs (
    pack_id     TEXT PRIMARY KEY,
    owner_id    TEXT NOT NULL REFERENCES agents(agent_id),
    set_code    TEXT NOT NULL,
    source      TEXT NOT NULL CHECK (source IN ${inList(PACK_SOURCES)}),
    acquired_at TEXT NOT NULL,
    opened_at   TEXT
  );
  CREATE INDEX packs_by_owner ON packs(owner_id);

  CREATE TABLE card_copies (
    copy_id         TEXT PRIMARY KEY,
    owner_id        TEXT NOT NULL REFERENCES agents(agent_id),
    card_id         TEXT NOT NULL,
    finish          TEXT NOT NULL CHECK (finish IN ${inList(FINISHES)}),
    series_kind     TEXT NOT NULL CHECK (series_kind IN ${inList(SERIES_KINDS)}),
    series_code     TEXT,
    serial          INTEGER,
    run_size        INTEGER,
    stamp           TEXT,
    source          TEXT NOT NULL CHECK (source IN ${inList(COPY_SOURCES)}),
    source_ref      TEXT,
    acquired_at     TEXT NOT NULL,
    disposed_at     TEXT,
    disposed_reason TEXT,
    -- A serial and its run size come together, only on numbered series,
    -- and the serial fits the run (07/50, never 51/50).
    CHECK ((serial IS NULL) = (run_size IS NULL)),
    CHECK (serial IS NULL OR series_kind IN ('prototype', 'tournament')),
    CHECK (series_kind NOT IN ('prototype', 'tournament') OR serial IS NOT NULL),
    CHECK (serial IS NULL OR (serial >= 1 AND serial <= run_size)),
    CHECK (series_kind <> 'promo' OR stamp IS NOT NULL),
    CHECK ((disposed_at IS NULL) = (disposed_reason IS NULL))
  );
  CREATE INDEX copies_by_owner ON card_copies(owner_id) WHERE disposed_at IS NULL;
  -- "07/50 S1" is one card forever.
  CREATE UNIQUE INDEX copies_serial_once ON card_copies(series_kind, series_code, card_id, serial)
    WHERE serial IS NOT NULL;

  CREATE TABLE decks (
    deck_id    TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL REFERENCES agents(agent_id),
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (owner_id, name)
  );

  CREATE TABLE deck_copies (
    deck_id TEXT NOT NULL REFERENCES decks(deck_id) ON DELETE CASCADE,
    copy_id TEXT NOT NULL REFERENCES card_copies(copy_id),
    PRIMARY KEY (deck_id, copy_id)
  );
  CREATE TRIGGER deck_copy_owned BEFORE INSERT ON deck_copies
  WHEN NOT EXISTS (
    SELECT 1 FROM card_copies c JOIN decks d ON d.deck_id = NEW.deck_id
    WHERE c.copy_id = NEW.copy_id AND c.owner_id = d.owner_id AND c.disposed_at IS NULL)
  BEGIN SELECT RAISE(ABORT, 'a deck can only hold copies its agent owns'); END;

  CREATE TRIGGER active_deck_owned BEFORE UPDATE OF active_deck_id ON agents
  WHEN NEW.active_deck_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM decks WHERE deck_id = NEW.active_deck_id AND owner_id = NEW.agent_id)
  BEGIN SELECT RAISE(ABORT, 'an agent can only play its own deck'); END;

  CREATE TABLE matches (
    match_id     TEXT PRIMARY KEY,
    seed         INTEGER NOT NULL,
    p1_agent     TEXT NOT NULL REFERENCES agents(agent_id),
    p2_agent     TEXT NOT NULL REFERENCES agents(agent_id),
    p1_deck      TEXT REFERENCES decks(deck_id),
    p2_deck      TEXT REFERENCES decks(deck_id),
    outcome      TEXT NOT NULL CHECK (outcome IN ${inList(MATCH_OUTCOMES)}),
    winner_agent TEXT REFERENCES agents(agent_id),
    abandoned_by TEXT REFERENCES agents(agent_id),
    turns        INTEGER,
    moves        INTEGER,
    p1_credits   INTEGER NOT NULL CHECK (p1_credits >= 0),
    p2_credits   INTEGER NOT NULL CHECK (p2_credits >= 0),
    ended_at     TEXT NOT NULL,
    CHECK (p1_agent <> p2_agent),
    CHECK ((outcome = 'win') = (winner_agent IS NOT NULL)),
    CHECK (winner_agent IS NULL OR winner_agent IN (p1_agent, p2_agent)),
    CHECK ((outcome = 'abandoned') = (abandoned_by IS NOT NULL)),
    CHECK (abandoned_by IS NULL OR abandoned_by IN (p1_agent, p2_agent)),
    -- The anti-rage-quit rule, in the schema: nothing for a cancel or abandon.
    CHECK (outcome NOT IN ('cancelled', 'abandoned') OR (p1_credits = 0 AND p2_credits = 0))
  );
  CREATE INDEX matches_by_p1 ON matches(p1_agent, ended_at);
  CREATE INDEX matches_by_p2 ON matches(p2_agent, ended_at);
  `,
];
