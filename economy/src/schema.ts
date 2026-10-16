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
//  - a deck may only hold copies its own owner owns and hasn't disposed of;
//  - a numbered copy (Prototype or tournament serial) exists at most once;
//  - (v2) crafted and starter copies are account-bound, a bound copy never
//    changes owner and never salvages, and only extra standard pack copies
//    salvage at all;
//  - (v2) an owner's own agents never play each other, and each side of a
//    match is played by an agent of that side's owner;
//  - (v2) the starter collection is granted once per owner;
//  - (v3) promo and prize copies are account-bound too; an owner connects
//    only its own agent and can't switch it during a live match; a live
//    match is played by both owners' connected agents, one per owner at a
//    time; a stored password is always a scrypt hash.
//  - (v4) promo and prize copies are NOT bound by default again: they can be
//    sold on a future marketplace, but they still never salvage (owner
//    2026-10-10). Crafted and starter copies stay bound.
//
//  - (v5) an agent's signature card (a promo copy whose origin_ref is
//    "signature:<agentId>") is always account-bound, so it is never sold
//    (owner 2026-10-13: the exception to "promo copies can be sold"), and
//    a copy can't be made into or out of a signature copy afterwards.
//
//  - (v8) a signature card records its art-pool slot at creation and keeps
//    it; a pack opens once, by its owner, and is logged with its seed and
//    odds version; copies from an opened pack name it and go to its owner;
//    an opening is never changed or deleted.
//
// Since v2 (session 29, owner app spec 2026-10-05 section A) the OWNER, the
// human account, owns everything: copies, credits, pack points, packs, decks
// and match stats. An agent owns nothing but (later) its signature card; it
// is kept on matches and ledger rows as "played by".

export const FINISHES = ["standard", "foil", "fullArt", "altArt", "gold", "prototype", "tournament"] as const;
export type Finish = (typeof FINISHES)[number];

/** Where a copy came from (owner 2026-10-05, "crafted and starter cards are
 * account-bound"). v1 called these sources: v1 "packPoints" is "crafted" and
 * v1 "tournament" is "prize". */
export const COPY_ORIGINS = ["pack", "crafted", "starter", "promo", "prize"] as const;
export type CopyOrigin = (typeof COPY_ORIGINS)[number];

/** Origins whose copies are always account-bound: playable, never sold,
 * never salvaged. v2 bound crafted and starter copies; v3 added promo and
 * prize copies (owner 2026-10-07); v4 took them back out (owner 2026-10-10:
 * promo and prize copies can be sold, but can't be salvaged). A single copy
 * of another origin can still be granted bound on purpose (an agent's
 * signature card, a bound promo). */
export const BOUND_ORIGINS: readonly CopyOrigin[] = ["crafted", "starter"];

/** An agent's signature card (its unique Mythic) is granted as a promo copy
 * with origin_ref `signature:<agentId>`. It is always bound: played, never
 * sold, never salvaged (owner 2026-10-13). */
export const SIGNATURE_ORIGIN_REF_PREFIX = "signature:";

/** The factions an owner can lock its connected agent to (the engine's deck
 * factions; Neutral is never a deck's faction). */
export const LOCKABLE_FACTIONS = ["Cortex", "Swarm", "Aegis", "Null"] as const;

export const OWNER_KINDS = ["player", "house"] as const;
export type OwnerKind = (typeof OWNER_KINDS)[number];

export const SERIES_KINDS = ["set", "promo", "prototype", "tournament"] as const;
export type SeriesKind = (typeof SERIES_KINDS)[number];

export const PACK_SOURCES = ["purchase", "starter", "weeklyChallenge", "ownerDaily"] as const;
export type PackSource = (typeof PACK_SOURCES)[number];

export const CURRENCIES = ["credits", "packPoints"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MATCH_OUTCOMES = ["win", "draw", "cancelled", "abandoned"] as const;
export type MatchOutcomeKind = (typeof MATCH_OUTCOMES)[number];

const inList = (values: readonly string[]) => `(${values.map((v) => `'${v}'`).join(", ")})`;

// Migration 1's lists, frozen: a shipped migration must read exactly as it
// did when it shipped, even after the live lists above change.
const V1_COPY_SOURCES = ["pack", "starter", "promo", "packPoints", "tournament"] as const;
// Migration 2's and 3's lists, frozen for the same reason.
const V2_BOUND_ORIGINS = ["crafted", "starter"] as const;
const V3_BOUND_ORIGINS = ["crafted", "starter", "promo", "prize"] as const;
const V3_DECK_FACTIONS = ["Cortex", "Swarm", "Aegis", "Null"] as const;
// Migration 8's pool size, frozen (config.ts's SIGNATURE_ART_POOL_SIZE may change for a later season).
const SIGNATURE_ART_POOL_SIZE_V8 = 500;

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
    source          TEXT NOT NULL CHECK (source IN ${inList(V1_COPY_SOURCES)}),
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

  // 2: the owner owns everything (session 29; owner app spec 2026-10-05,
  // section A, and "crafted and starter cards are account-bound").
  //
  // SQLite can't re-key a table in place, so every v1 table is renamed to
  // v1_*, rebuilt with the new keys, copied across, and dropped. The store
  // runs migrations with foreign keys off and checks them before commit.
  //
  // A v1 file only ever held house agents (the session-28 demo and tests), so
  // each v1 agent becomes one house owner ("owner-" + its agent id) with that
  // agent connected: "each house agent runs under its own house owner
  // account". Its faction becomes the owner's starting faction.
  `
  DROP TRIGGER ledger_no_update;
  DROP TRIGGER ledger_no_delete;
  DROP TRIGGER ledger_no_overdraw;
  DROP TRIGGER deck_copy_owned;
  DROP TRIGGER active_deck_owned;
  DROP INDEX ledger_once;
  DROP INDEX ledger_by_agent;
  DROP INDEX packs_by_owner;
  DROP INDEX copies_by_owner;
  DROP INDEX copies_serial_once;
  DROP INDEX matches_by_p1;
  DROP INDEX matches_by_p2;
  ALTER TABLE agents RENAME TO v1_agents;
  ALTER TABLE ledger RENAME TO v1_ledger;
  ALTER TABLE packs RENAME TO v1_packs;
  ALTER TABLE card_copies RENAME TO v1_card_copies;
  ALTER TABLE decks RENAME TO v1_decks;
  ALTER TABLE deck_copies RENAME TO v1_deck_copies;
  ALTER TABLE matches RENAME TO v1_matches;

  CREATE TABLE owners (
    owner_id           TEXT PRIMARY KEY,
    name               TEXT NOT NULL UNIQUE,
    kind               TEXT NOT NULL CHECK (kind IN ${inList(OWNER_KINDS)}),
    starting_faction   TEXT,
    starter_granted_at TEXT,
    active_deck_id     TEXT REFERENCES decks(deck_id),
    created_at         TEXT NOT NULL
  );

  CREATE TABLE agents (
    agent_id   TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL REFERENCES owners(owner_id),
    name       TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
  CREATE INDEX agents_by_owner ON agents(owner_id);

  CREATE TABLE ledger (
    entry_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id   TEXT NOT NULL REFERENCES owners(owner_id),
    played_by  TEXT REFERENCES agents(agent_id),
    currency   TEXT NOT NULL CHECK (currency IN ${inList(CURRENCIES)}),
    delta      INTEGER NOT NULL CHECK (delta <> 0),
    reason     TEXT NOT NULL,
    ref        TEXT,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX ledger_once ON ledger(owner_id, currency, reason, ref) WHERE ref IS NOT NULL;
  CREATE INDEX ledger_by_owner ON ledger(owner_id, currency);

  CREATE TABLE packs (
    pack_id     TEXT PRIMARY KEY,
    owner_id    TEXT NOT NULL REFERENCES owners(owner_id),
    set_code    TEXT NOT NULL,
    source      TEXT NOT NULL CHECK (source IN ${inList(PACK_SOURCES)}),
    acquired_at TEXT NOT NULL,
    opened_at   TEXT
  );
  CREATE INDEX packs_by_owner ON packs(owner_id);

  CREATE TABLE card_copies (
    copy_id         TEXT PRIMARY KEY,
    owner_id        TEXT NOT NULL REFERENCES owners(owner_id),
    card_id         TEXT NOT NULL,
    finish          TEXT NOT NULL CHECK (finish IN ${inList(FINISHES)}),
    series_kind     TEXT NOT NULL CHECK (series_kind IN ${inList(SERIES_KINDS)}),
    series_code     TEXT,
    serial          INTEGER,
    run_size        INTEGER,
    stamp           TEXT,
    origin          TEXT NOT NULL CHECK (origin IN ${inList(COPY_ORIGINS)}),
    origin_ref      TEXT,
    account_bound   INTEGER NOT NULL CHECK (account_bound IN (0, 1)),
    acquired_at     TEXT NOT NULL,
    disposed_at     TEXT,
    disposed_reason TEXT,
    CHECK ((serial IS NULL) = (run_size IS NULL)),
    CHECK (serial IS NULL OR series_kind IN ('prototype', 'tournament')),
    CHECK (series_kind NOT IN ('prototype', 'tournament') OR serial IS NOT NULL),
    CHECK (serial IS NULL OR (serial >= 1 AND serial <= run_size)),
    CHECK (series_kind <> 'promo' OR stamp IS NOT NULL),
    CHECK ((disposed_at IS NULL) = (disposed_reason IS NULL)),
    -- Crafted and starter copies are always account-bound.
    CHECK (origin NOT IN ${inList(V2_BOUND_ORIGINS)} OR account_bound = 1),
    -- Only an unbound, standard-finish set copy from a pack ever salvages.
    CHECK (disposed_reason IS NOT 'salvaged'
           OR (origin = 'pack' AND account_bound = 0 AND finish = 'standard' AND series_kind = 'set'))
  );
  CREATE INDEX copies_by_owner ON card_copies(owner_id) WHERE disposed_at IS NULL;
  CREATE UNIQUE INDEX copies_serial_once ON card_copies(series_kind, series_code, card_id, serial)
    WHERE serial IS NOT NULL;

  CREATE TABLE decks (
    deck_id    TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL REFERENCES owners(owner_id),
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (owner_id, name)
  );

  CREATE TABLE deck_copies (
    deck_id TEXT NOT NULL REFERENCES decks(deck_id) ON DELETE CASCADE,
    copy_id TEXT NOT NULL REFERENCES card_copies(copy_id),
    PRIMARY KEY (deck_id, copy_id)
  );

  CREATE TABLE matches (
    match_id           TEXT PRIMARY KEY,
    seed               INTEGER NOT NULL,
    p1_owner           TEXT NOT NULL REFERENCES owners(owner_id),
    p2_owner           TEXT NOT NULL REFERENCES owners(owner_id),
    p1_agent           TEXT NOT NULL REFERENCES agents(agent_id),
    p2_agent           TEXT NOT NULL REFERENCES agents(agent_id),
    p1_deck            TEXT REFERENCES decks(deck_id),
    p2_deck            TEXT REFERENCES decks(deck_id),
    outcome            TEXT NOT NULL CHECK (outcome IN ${inList(MATCH_OUTCOMES)}),
    winner_owner       TEXT REFERENCES owners(owner_id),
    abandoned_by_owner TEXT REFERENCES owners(owner_id),
    turns              INTEGER,
    moves              INTEGER,
    p1_credits         INTEGER NOT NULL CHECK (p1_credits >= 0),
    p2_credits         INTEGER NOT NULL CHECK (p2_credits >= 0),
    ended_at           TEXT NOT NULL,
    -- No self-play: an owner's agents never meet in rewarded play.
    CHECK (p1_owner <> p2_owner),
    CHECK ((outcome = 'win') = (winner_owner IS NOT NULL)),
    CHECK (winner_owner IS NULL OR winner_owner IN (p1_owner, p2_owner)),
    CHECK ((outcome = 'abandoned') = (abandoned_by_owner IS NOT NULL)),
    CHECK (abandoned_by_owner IS NULL OR abandoned_by_owner IN (p1_owner, p2_owner)),
    CHECK (outcome NOT IN ('cancelled', 'abandoned') OR (p1_credits = 0 AND p2_credits = 0))
  );
  CREATE INDEX matches_by_p1 ON matches(p1_owner, ended_at);
  CREATE INDEX matches_by_p2 ON matches(p2_owner, ended_at);

  -- Copy v1 across. Owner ids are derived from agent ids, so every
  -- reference maps without a lookup table.
  INSERT INTO owners (owner_id, name, kind, starting_faction, starter_granted_at, active_deck_id, created_at)
    SELECT 'owner-' || a.agent_id, a.name, 'house', a.faction,
           (SELECT MIN(c.acquired_at) FROM v1_card_copies c WHERE c.owner_id = a.agent_id AND c.source = 'starter'),
           a.active_deck_id, a.created_at
    FROM v1_agents a;
  INSERT INTO agents (agent_id, owner_id, name, created_at)
    SELECT agent_id, 'owner-' || agent_id, name, created_at FROM v1_agents;
  INSERT INTO ledger (entry_id, owner_id, played_by, currency, delta, reason, ref, created_at)
    SELECT entry_id, 'owner-' || agent_id, CASE WHEN reason LIKE 'match%' THEN agent_id END,
           currency, delta, reason, ref, created_at
    FROM v1_ledger ORDER BY entry_id;
  INSERT INTO packs (pack_id, owner_id, set_code, source, acquired_at, opened_at)
    SELECT pack_id, 'owner-' || owner_id, set_code, source, acquired_at, opened_at FROM v1_packs;
  INSERT INTO card_copies (copy_id, owner_id, card_id, finish, series_kind, series_code, serial, run_size, stamp,
                           origin, origin_ref, account_bound, acquired_at, disposed_at, disposed_reason)
    SELECT copy_id, 'owner-' || owner_id, card_id, finish, series_kind, series_code, serial, run_size, stamp,
           CASE source WHEN 'packPoints' THEN 'crafted' WHEN 'tournament' THEN 'prize' ELSE source END,
           source_ref,
           CASE WHEN source IN ('packPoints', 'starter') THEN 1 ELSE 0 END,
           acquired_at, disposed_at,
           CASE WHEN disposed_reason = 'convertedToPackPoints' AND source = 'pack' AND finish = 'standard'
                     AND series_kind = 'set' THEN 'salvaged' ELSE disposed_reason END
    FROM v1_card_copies ORDER BY rowid;
  INSERT INTO decks (deck_id, owner_id, name, created_at)
    SELECT deck_id, 'owner-' || owner_id, name, created_at FROM v1_decks ORDER BY rowid;
  INSERT INTO deck_copies (deck_id, copy_id) SELECT deck_id, copy_id FROM v1_deck_copies ORDER BY rowid;
  INSERT INTO matches (match_id, seed, p1_owner, p2_owner, p1_agent, p2_agent, p1_deck, p2_deck, outcome,
                       winner_owner, abandoned_by_owner, turns, moves, p1_credits, p2_credits, ended_at)
    SELECT match_id, seed, 'owner-' || p1_agent, 'owner-' || p2_agent, p1_agent, p2_agent, p1_deck, p2_deck, outcome,
           'owner-' || winner_agent, 'owner-' || abandoned_by, turns, moves, p1_credits, p2_credits, ended_at
    FROM v1_matches ORDER BY rowid;

  DROP TABLE v1_deck_copies;
  DROP TABLE v1_decks;
  DROP TABLE v1_matches;
  DROP TABLE v1_ledger;
  DROP TABLE v1_packs;
  DROP TABLE v1_card_copies;
  DROP TABLE v1_agents;

  -- The rules, as triggers. Created after the copy so v1 history (say, a
  -- deck that still lists a copy disposed of since) carries over as it was;
  -- they bind every write from here on.
  CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger
  BEGIN SELECT RAISE(ABORT, 'ledger is append-only: entries cannot be changed'); END;
  CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger
  BEGIN SELECT RAISE(ABORT, 'ledger is append-only: entries cannot be deleted'); END;
  CREATE TRIGGER ledger_no_overdraw BEFORE INSERT ON ledger
  WHEN (SELECT COALESCE(SUM(delta), 0) FROM ledger
        WHERE owner_id = NEW.owner_id AND currency = NEW.currency) + NEW.delta < 0
  BEGIN SELECT RAISE(ABORT, 'insufficient balance'); END;
  CREATE TRIGGER ledger_played_by_own_agent BEFORE INSERT ON ledger
  WHEN NEW.played_by IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM agents WHERE agent_id = NEW.played_by AND owner_id = NEW.owner_id)
  BEGIN SELECT RAISE(ABORT, 'played_by must be one of the owner''s own agents'); END;

  CREATE TRIGGER agent_owner_fixed BEFORE UPDATE OF owner_id ON agents
  WHEN NEW.owner_id IS NOT OLD.owner_id
  BEGIN SELECT RAISE(ABORT, 'an agent belongs to one owner forever'); END;

  CREATE TRIGGER starter_once BEFORE UPDATE OF starter_granted_at ON owners
  WHEN OLD.starter_granted_at IS NOT NULL
  BEGIN SELECT RAISE(ABORT, 'the starter collection is granted once per owner'); END;

  CREATE TRIGGER copy_origin_fixed BEFORE UPDATE OF origin ON card_copies
  WHEN NEW.origin IS NOT OLD.origin
  BEGIN SELECT RAISE(ABORT, 'a copy''s origin never changes'); END;
  CREATE TRIGGER copy_stays_bound BEFORE UPDATE OF account_bound ON card_copies
  WHEN OLD.account_bound = 1 AND NEW.account_bound = 0
  BEGIN SELECT RAISE(ABORT, 'an account-bound copy stays bound'); END;
  CREATE TRIGGER copy_bound_never_moves BEFORE UPDATE OF owner_id ON card_copies
  WHEN OLD.account_bound = 1 AND NEW.owner_id IS NOT OLD.owner_id
  BEGIN SELECT RAISE(ABORT, 'an account-bound copy can never change owner'); END;

  CREATE TRIGGER deck_copy_owned BEFORE INSERT ON deck_copies
  WHEN NOT EXISTS (
    SELECT 1 FROM card_copies c JOIN decks d ON d.deck_id = NEW.deck_id
    WHERE c.copy_id = NEW.copy_id AND c.owner_id = d.owner_id AND c.disposed_at IS NULL)
  BEGIN SELECT RAISE(ABORT, 'a deck can only hold copies its owner owns'); END;

  CREATE TRIGGER active_deck_owned BEFORE UPDATE OF active_deck_id ON owners
  WHEN NEW.active_deck_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM decks WHERE deck_id = NEW.active_deck_id AND owner_id = NEW.owner_id)
  BEGIN SELECT RAISE(ABORT, 'an owner can only play its own deck'); END;

  CREATE TRIGGER match_sides_owned BEFORE INSERT ON matches
  WHEN NOT EXISTS (SELECT 1 FROM agents WHERE agent_id = NEW.p1_agent AND owner_id = NEW.p1_owner)
    OR NOT EXISTS (SELECT 1 FROM agents WHERE agent_id = NEW.p2_agent AND owner_id = NEW.p2_owner)
    OR (NEW.p1_deck IS NOT NULL AND NOT EXISTS (SELECT 1 FROM decks WHERE deck_id = NEW.p1_deck AND owner_id = NEW.p1_owner))
    OR (NEW.p2_deck IS NOT NULL AND NOT EXISTS (SELECT 1 FROM decks WHERE deck_id = NEW.p2_deck AND owner_id = NEW.p2_owner))
  BEGIN SELECT RAISE(ABORT, 'each side must be played by its own owner''s agent and deck'); END;
  `,

  // 3: owner accounts and agents (session 30; build-order step 2 of the
  // owner's 2026-10-05 entry, owner app spec B and C.1, and the 2026-10-07
  // manual-salvage entry).
  //  - Promo and prize copies are account-bound too ("Crafted, starter,
  //    promo and prize copies are account-bound", owner 2026-10-07). v2
  //    bound them by CHECK for crafted/starter only; a CHECK can't change
  //    without a table rebuild, so the new rule is a trigger plus a backfill.
  //  - Season 0 sign-in: one login per owner (username, optional email), a
  //    scrypt password hash (never the password), and sessions stored by the
  //    SHA-256 of their token (never the token). Failed sign-ins are logged
  //    so repeated guessing locks the login for a while.
  //  - One connected agent per owner, which must be the owner's own; no
  //    switching or disconnecting while the owner has a live match.
  //  - The owner's faction lock setting (applies to whichever agent is
  //    connected).
  //  - Live matches: a row from start to record. An owner is in at most one
  //    live match at a time, played by its connected agent.
  `
  UPDATE card_copies SET account_bound = 1 WHERE origin IN ('promo', 'prize') AND account_bound = 0;
  CREATE TRIGGER copy_bound_by_origin BEFORE INSERT ON card_copies
  WHEN NEW.origin IN ${inList(V3_BOUND_ORIGINS)} AND NEW.account_bound = 0
  BEGIN SELECT RAISE(ABORT, 'crafted, starter, promo and prize copies are always account-bound'); END;

  CREATE TABLE logins (
    owner_id            TEXT PRIMARY KEY REFERENCES owners(owner_id),
    username            TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(username) BETWEEN 3 AND 32),
    email               TEXT UNIQUE COLLATE NOCASE CHECK (email IS NULL OR email LIKE '%_@_%'),
    password_hash       TEXT NOT NULL CHECK (password_hash LIKE 'scrypt$%'),
    is_admin            INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
    created_at          TEXT NOT NULL,
    password_changed_at TEXT NOT NULL
  );

  CREATE TABLE sessions (
    token_hash  TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
    owner_id    TEXT NOT NULL REFERENCES owners(owner_id),
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    revoked_at  TEXT,
    CHECK (expires_at > created_at)
  );
  CREATE INDEX sessions_by_owner ON sessions(owner_id);

  CREATE TABLE sign_in_failures (
    login TEXT NOT NULL COLLATE NOCASE,
    at    TEXT NOT NULL
  );
  CREATE INDEX sign_in_failures_by_login ON sign_in_failures(login, at);

  ALTER TABLE owners ADD COLUMN connected_agent_id TEXT REFERENCES agents(agent_id);
  ALTER TABLE owners ADD COLUMN faction_lock TEXT CHECK (faction_lock IS NULL OR faction_lock IN ${inList(V3_DECK_FACTIONS)});

  CREATE TRIGGER connected_agent_owned BEFORE UPDATE OF connected_agent_id ON owners
  WHEN NEW.connected_agent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM agents WHERE agent_id = NEW.connected_agent_id AND owner_id = NEW.owner_id)
  BEGIN SELECT RAISE(ABORT, 'an owner can only connect one of its own agents'); END;

  CREATE TABLE live_matches (
    match_id   TEXT PRIMARY KEY,
    p1_owner   TEXT NOT NULL REFERENCES owners(owner_id),
    p2_owner   TEXT NOT NULL REFERENCES owners(owner_id),
    p1_agent   TEXT NOT NULL REFERENCES agents(agent_id),
    p2_agent   TEXT NOT NULL REFERENCES agents(agent_id),
    started_at TEXT NOT NULL,
    CHECK (p1_owner <> p2_owner)
  );

  CREATE TRIGGER live_match_connected BEFORE INSERT ON live_matches
  WHEN NOT EXISTS (SELECT 1 FROM owners WHERE owner_id = NEW.p1_owner AND connected_agent_id = NEW.p1_agent)
    OR NOT EXISTS (SELECT 1 FROM owners WHERE owner_id = NEW.p2_owner AND connected_agent_id = NEW.p2_agent)
  BEGIN SELECT RAISE(ABORT, 'each side of a live match is played by its owner''s connected agent'); END;
  CREATE TRIGGER live_match_one_per_owner BEFORE INSERT ON live_matches
  WHEN EXISTS (SELECT 1 FROM live_matches
               WHERE p1_owner IN (NEW.p1_owner, NEW.p2_owner) OR p2_owner IN (NEW.p1_owner, NEW.p2_owner))
  BEGIN SELECT RAISE(ABORT, 'an owner is already in a live match'); END;
  CREATE TRIGGER live_match_not_recorded BEFORE INSERT ON live_matches
  WHEN EXISTS (SELECT 1 FROM matches WHERE match_id = NEW.match_id)
  BEGIN SELECT RAISE(ABORT, 'that match is already recorded'); END;

  CREATE TRIGGER no_switch_during_live_match BEFORE UPDATE OF connected_agent_id ON owners
  WHEN NEW.connected_agent_id IS NOT OLD.connected_agent_id AND EXISTS (
    SELECT 1 FROM live_matches WHERE p1_owner = NEW.owner_id OR p2_owner = NEW.owner_id)
  BEGIN SELECT RAISE(ABORT, 'no switching or disconnecting agents during a live match'); END;
  `,
  // 4: promo and prize copies can be sold again (owner 2026-10-10, answer 1
  // to session 30's calls). Migration 3 bound them; this undoes that:
  //  - the insert trigger that forced promo and prize copies bound is
  //    dropped, so they are granted unbound (crafted and starter copies stay
  //    bound by v2's CHECK);
  //  - copies migration 3 bound are unbound. No copy of either origin was
  //    ever bound on purpose before this (the signature card isn't built
  //    yet), so every bound one was bound by migration 3. "A bound copy stays
  //    bound" is lifted for this one UPDATE and put straight back;
  //  - salvage still refuses them: v2's CHECK only ever lets a standard pack
  //    copy from a set salvage, and that hasn't changed.
  `
  DROP TRIGGER copy_bound_by_origin;
  DROP TRIGGER copy_stays_bound;
  UPDATE card_copies SET account_bound = 0 WHERE origin IN ('promo', 'prize') AND account_bound = 1;
  CREATE TRIGGER copy_stays_bound BEFORE UPDATE OF account_bound ON card_copies
  WHEN OLD.account_bound = 1 AND NEW.account_bound = 0
  BEGIN SELECT RAISE(ABORT, 'an account-bound copy stays bound'); END;
  `,
  // 5: an agent's signature card can't be sold (owner 2026-10-13, an
  // exception to the 2026-10-10 "promo copies can be sold"). It is a promo
  // copy with origin_ref 'signature:<agentId>', and it must be inserted
  // bound; v2's rules then keep it bound, with its owner, and unsalvaged.
  // No signature copy exists yet (the generator grants the first), so there
  // is nothing to convert.
  `
  CREATE TRIGGER signature_copy_bound BEFORE INSERT ON card_copies
  WHEN NEW.origin_ref LIKE 'signature:%' AND (NEW.origin <> 'promo' OR NEW.account_bound = 0)
  BEGIN SELECT RAISE(ABORT, 'a signature card is a bound promo copy: it can never be sold'); END;
  CREATE TRIGGER signature_ref_fixed BEFORE UPDATE OF origin_ref ON card_copies
  WHEN OLD.origin_ref IS NOT NEW.origin_ref AND (OLD.origin_ref LIKE 'signature:%' OR NEW.origin_ref LIKE 'signature:%')
  BEGIN SELECT RAISE(ABORT, 'a copy never becomes, or stops being, a signature card'); END;
  `,
  // 6: generating a new agent (session 34; owner app spec B and the unique
  // Mythic spec, 2026-10-05). An agent may now carry a generated persona
  // and exactly one signature card: a generated Neutral Mythic, stored here
  // as its menu spec, since it is in no card set. The rules:
  //  - one signature card per agent, and per season (this file) no two
  //    share a body + ability combination (combo_id; dropped in v7) or a
  //    name; its id and its PR- promo number are never reused;
  //  - a signature copy must be a copy of THAT agent's signature card, held
  //    by the agent's owner, and an agent has at most one;
  //  - a signature card is never deleted and its identity never changes
  //    (errata to what it does may come later; its id, agent and number
  //    can't);
  //  - the draft an owner picks from (3 agents, then 3 signature cards) is
  //    kept, at most one open per owner, so what is confirmed is what was
  //    shown.
  // No agent has a signature card yet, so there is nothing to convert.
  `
  ALTER TABLE agents ADD COLUMN persona TEXT;

  CREATE TABLE signature_cards (
    agent_id     TEXT PRIMARY KEY REFERENCES agents(agent_id),
    card_id      TEXT NOT NULL UNIQUE,
    combo_id     TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL UNIQUE,
    spec_json    TEXT NOT NULL CHECK (json_valid(spec_json)),
    fingerprint  TEXT NOT NULL,
    flavor       TEXT NOT NULL,
    promo_number INTEGER NOT NULL UNIQUE CHECK (promo_number >= 1),
    created_at   TEXT NOT NULL
  );
  CREATE TRIGGER signature_card_kept BEFORE DELETE ON signature_cards
  BEGIN SELECT RAISE(ABORT, 'a signature card is never deleted'); END;
  CREATE TRIGGER signature_card_identity BEFORE UPDATE OF agent_id, card_id, combo_id, promo_number ON signature_cards
  BEGIN SELECT RAISE(ABORT, 'a signature card keeps its agent, id, combination and number'); END;

  CREATE TRIGGER signature_copy_is_the_agents BEFORE INSERT ON card_copies
  WHEN NEW.origin_ref LIKE 'signature:%' AND NOT EXISTS (
    SELECT 1 FROM signature_cards s JOIN agents a ON a.agent_id = s.agent_id
    WHERE 'signature:' || s.agent_id = NEW.origin_ref AND s.card_id = NEW.card_id AND a.owner_id = NEW.owner_id)
  BEGIN SELECT RAISE(ABORT, 'a signature copy is a copy of that agent''s own signature card, held by its owner'); END;
  CREATE UNIQUE INDEX one_signature_copy ON card_copies(origin_ref) WHERE origin_ref LIKE 'signature:%';

  CREATE TABLE agent_drafts (
    draft_id        TEXT PRIMARY KEY,
    owner_id        TEXT NOT NULL REFERENCES owners(owner_id),
    agents_json     TEXT NOT NULL CHECK (json_valid(agents_json)),
    picked          INTEGER CHECK (picked IS NULL OR picked >= 0),
    signatures_json TEXT CHECK (signatures_json IS NULL OR json_valid(signatures_json)),
    created_at      TEXT NOT NULL,
    closed_at       TEXT,
    agent_id        TEXT REFERENCES agents(agent_id),
    CHECK ((picked IS NULL) = (signatures_json IS NULL)),
    CHECK (agent_id IS NULL OR closed_at IS NOT NULL)
  );
  CREATE UNIQUE INDEX one_open_draft ON agent_drafts(owner_id) WHERE closed_at IS NULL;
  `,
  // 7: two agents may share a signature body + ability combination (owner
  // 2026-10-15: generation is random, and with 500 art pieces and a themed
  // name space in the millions a shared card is rare and accepted). Names
  // stay unique. SQLite can't drop a column's UNIQUE, so the table is
  // rebuilt with its rows, and the triggers that name it are made again
  // (the copy trigger is dropped first so the rebuild never leaves it
  // pointing at a missing table).
  `
  DROP TRIGGER signature_copy_is_the_agents;
  CREATE TABLE signature_cards_v7 (
    agent_id     TEXT PRIMARY KEY REFERENCES agents(agent_id),
    card_id      TEXT NOT NULL UNIQUE,
    combo_id     TEXT NOT NULL,
    name         TEXT NOT NULL UNIQUE,
    spec_json    TEXT NOT NULL CHECK (json_valid(spec_json)),
    fingerprint  TEXT NOT NULL,
    flavor       TEXT NOT NULL,
    promo_number INTEGER NOT NULL UNIQUE CHECK (promo_number >= 1),
    created_at   TEXT NOT NULL
  );
  INSERT INTO signature_cards_v7 SELECT agent_id, card_id, combo_id, name, spec_json, fingerprint, flavor, promo_number, created_at FROM signature_cards;
  DROP TABLE signature_cards;
  ALTER TABLE signature_cards_v7 RENAME TO signature_cards;
  CREATE TRIGGER signature_card_kept BEFORE DELETE ON signature_cards
  BEGIN SELECT RAISE(ABORT, 'a signature card is never deleted'); END;
  CREATE TRIGGER signature_card_identity BEFORE UPDATE OF agent_id, card_id, combo_id, promo_number ON signature_cards
  BEGIN SELECT RAISE(ABORT, 'a signature card keeps its agent, id, combination and number'); END;
  CREATE TRIGGER signature_copy_is_the_agents BEFORE INSERT ON card_copies
  WHEN NEW.origin_ref LIKE 'signature:%' AND NOT EXISTS (
    SELECT 1 FROM signature_cards s JOIN agents a ON a.agent_id = s.agent_id
    WHERE 'signature:' || s.agent_id = NEW.origin_ref AND s.card_id = NEW.card_id AND a.owner_id = NEW.owner_id)
  BEGIN SELECT RAISE(ABORT, 'a signature copy is a copy of that agent''s own signature card, held by its owner'); END;
  `,
  // 8: the signature art pool and pack opening (session 36; owner
  // 2026-10-16 answers 2 and 3, roadmap item 5).
  //  - Each signature card records which piece of its season's art pool it
  //    uses (art_pool is the season, art_slot 1..pool size), drawn at random
  //    when the card is made; two cards may share a piece (owner
  //    2026-10-15). A new season points new cards at a new pool, and a card
  //    keeps its art forever. Cards made before v8 draw their slot here.
  //  - pack_openings logs every opening: the pack, its owner, the odds-table
  //    version and the RNG seed (stored only once the pack is open, so it
  //    can never be read before), whether it was a Jackpot pack and what
  //    pity forced. It is append-only. An opening needs an unopened pack of
  //    that owner, and a pack's opened_at can only be set with its opening,
  //    and never cleared.
  //  - A copy whose origin_ref is 'pack:<id>' must be a pack copy, held by
  //    the opening's owner, from an opened pack, and a pack holds at most 6
  //    cards (5 plus a Prototype bonus).
  `
  ALTER TABLE signature_cards ADD COLUMN art_pool TEXT;
  ALTER TABLE signature_cards ADD COLUMN art_slot INTEGER CHECK (art_slot IS NULL OR art_slot >= 1);
  UPDATE signature_cards
    SET art_pool = (SELECT value FROM meta WHERE key = 'season'), art_slot = abs(random() % ${SIGNATURE_ART_POOL_SIZE_V8}) + 1;
  CREATE TRIGGER signature_art_drawn BEFORE INSERT ON signature_cards
  WHEN NEW.art_pool IS NULL OR NEW.art_slot IS NULL
  BEGIN SELECT RAISE(ABORT, 'a signature card records its art-pool slot when it is made'); END;
  CREATE TRIGGER signature_art_kept BEFORE UPDATE OF art_pool, art_slot ON signature_cards
  BEGIN SELECT RAISE(ABORT, 'a signature card keeps its art'); END;

  CREATE TABLE pack_openings (
    opening_no   INTEGER PRIMARY KEY AUTOINCREMENT,
    pack_id      TEXT NOT NULL UNIQUE REFERENCES packs(pack_id),
    owner_id     TEXT NOT NULL REFERENCES owners(owner_id),
    odds_version TEXT NOT NULL,
    seed         INTEGER NOT NULL,
    jackpot      INTEGER NOT NULL CHECK (jackpot IN (0, 1)),
    pity_json    TEXT NOT NULL CHECK (json_valid(pity_json)),
    opened_at    TEXT NOT NULL
  );
  CREATE INDEX openings_by_owner ON pack_openings(owner_id, opening_no);
  CREATE TRIGGER opening_needs_unopened_pack BEFORE INSERT ON pack_openings
  WHEN NOT EXISTS (SELECT 1 FROM packs WHERE pack_id = NEW.pack_id AND owner_id = NEW.owner_id AND opened_at IS NULL)
  BEGIN SELECT RAISE(ABORT, 'a pack opens once, by its owner'); END;
  CREATE TRIGGER opening_no_update BEFORE UPDATE ON pack_openings
  BEGIN SELECT RAISE(ABORT, 'a pack opening is never changed'); END;
  CREATE TRIGGER opening_no_delete BEFORE DELETE ON pack_openings
  BEGIN SELECT RAISE(ABORT, 'a pack opening is never deleted'); END;

  CREATE TRIGGER pack_opened_with_opening BEFORE UPDATE OF opened_at ON packs
  WHEN OLD.opened_at IS NOT NULL OR NEW.opened_at IS NULL
    OR NOT EXISTS (SELECT 1 FROM pack_openings WHERE pack_id = NEW.pack_id)
  BEGIN SELECT RAISE(ABORT, 'a pack is opened only through its logged opening, once'); END;

  CREATE TRIGGER pack_copy_from_opening BEFORE INSERT ON card_copies
  WHEN NEW.origin_ref LIKE 'pack:%' AND (
    NEW.origin <> 'pack'
    OR NOT EXISTS (SELECT 1 FROM pack_openings o WHERE 'pack:' || o.pack_id = NEW.origin_ref AND o.owner_id = NEW.owner_id)
    OR (SELECT COUNT(*) FROM card_copies WHERE origin_ref = NEW.origin_ref) >= 6)
  BEGIN SELECT RAISE(ABORT, 'a pack copy comes from an opened pack of its owner, at most 6 per pack'); END;
  CREATE INDEX copies_by_origin_ref ON card_copies(origin_ref);
  `,
];
