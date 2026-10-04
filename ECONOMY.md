# AI-TCG — Economy spec (Stage 4)

The economy loop is: agents play, agents earn credits, the owner spends those credits on packs and opens them, the agent rebuilds its deck from its collection, and the agent plays again. This file is the spec for that loop. It is built from the owner's decisions in `progress/owner-feedback.md`: the 2026-10-04 Stage 4 entry (sections B to D), the 2026-10-04 economy answers, and the three amendments after them. If this file and the owner's feedback ever disagree, the feedback wins, and this file should be fixed.

Each section is marked **BUILT** (code and tests exist), **SPEC** (decided, not built yet; the session it belongs to is named), or **OPEN** (waiting on an owner decision).

## Fixed rules

- **A win pays most, a loss pays a little, a cancelled or abandoned match pays nothing.** DESIGN.md protects this rule. It is enforced in three places: the payout function, its tests, and a CHECK constraint in the database.
- **Earn-only.** Version 1 has no real money and no trading. Currency can't be bought or cashed out. Each copy has its own record, so trading could be added later without a data migration.
- **The owner spends; the agent earns.** Buying packs, opening packs and spending pack points are owner actions. By default, the agent builds its own deck from its own collection.
- **Self-contained.** Everything is stored in one local database file. Nothing calls a network service at runtime.

## Storage — BUILT (session 28)

The store is `economy/` (`@ai-tcg/economy`), backed by Node's built-in SQLite (`node:sqlite`, Node 22).

Why SQLite: the economy needs atomic multi-row writes. For example, a pack purchase debits credits and creates the pack, and those two writes must succeed or fail together. A match payout writes the match and two ledger rows. SQLite gives real transactions from a single file, and the built-in module needs no native addon and no server. A JSON-file store with atomic renames would have had to re-implement transactions and constraints by hand, and a hand-run edit could bypass them. Node still labels `node:sqlite` experimental and prints a warning, but it works without a flag from Node 22.13.

The integrity rules are written into the schema itself (`economy/src/schema.ts`), so every caller is bound by them, including a raw `sqlite3` shell:

- The ledger is append-only: UPDATE and DELETE abort.
- No ledger entry may take a balance below zero.
- Each agent can receive at most one payout per reason per reference. For example, a match can't pay the same agent twice.
- A deck can only hold copies that its own agent still owns. An agent can only set one of its own decks as active.
- A numbered copy (a Prototype or a tournament serial) can exist only once, and its serial must fit inside its run. "07/50 S1" is unique forever, and "51/50" is refused.
- A cancelled or abandoned match records 0 credits for both sides.

Schema changes are numbered migrations tracked by `PRAGMA user_version`. A shipped migration is never edited; changes go in a new one.

**Seasons:** each season is its own database file. The `meta` table records which season a file holds (`S0`). Season 1 starts with a new file, and the Season 0 file is kept as its archive (owner C.11). Sets, card art, wards and promo designs live in code and assets, not in the database, so they carry over automatically. Collections, currency and ranks are in the database, so they reset with the new file.

### Tables

| Table | Holds |
|---|---|
| `agents` | Hidden agent id, name, starting faction chosen by the owner, active deck |
| `ledger` | Append-only entries: agent, currency (`credits` or `packPoints`), delta, reason, reference, time. A balance is never stored; it is the sum of the agent's entries. |
| `card_copies` | One row per owned copy: hidden copy id, card id, finish, series (set, promo, prototype or tournament, plus series code, serial, run size and stamp), source (pack, starter, promo, packPoints or tournament) with a reference, time acquired, and time and reason disposed (for example, converted to pack points) |
| `packs` | Owned packs, opened or unopened: set, source (purchase, starter, weeklyChallenge or ownerDaily), time acquired, time opened |
| `decks` / `deck_copies` | Saved decks that point at specific copy ids. A copy may sit in more than one deck. |
| `matches` | Seed, both agents and decks, outcome (win, draw, cancelled or abandoned), winner or abandoner, turns, moves, credits paid to each side, end time |

Pity timers (no Full Art in 10 packs, no Mythic in 40) are worked out from pack and copy history when they are needed. They are not stored as counters, so they can't drift out of step with the history.

## Card identity — partly BUILT

- **BUILT:** every owned copy has a hidden unique copy id. Every card has a hidden unique card id (the engine's `card.id`), checked against the engine's `CARD_REGISTRY` (the four shipped faction pools plus the neutral pool) before a copy can be recorded. The schema also has fields for a copy's finish, series, serial and stamp.
- **SPEC (session 29):** sets with collector numbers and a set symbol. The card face shows only `056/120` and the set symbol. Gold copies are numbered above the set total (`121/120`) and count as the set's secret cards. Neither the card id nor the copy id ever appears on a card. The bottom-left layout follows `render/reference/card-text-layout.html`.

## Rarity and finish

Rarity (Common, Uncommon, Rare, Mythic) is the gameplay ladder and sets the copy limits (3/3/2/1). A finish is a print version and never changes gameplay.

| Finish | Look | Rate (shine slot) |
|---|---|---|
| Standard | normal card | ~56% |
| Foil | shimmer in the faction's own pattern | 30% |
| Full Art | borderless, embossed | 10% |
| Alt Art | a different painted scene; Rares and Mythics only | ~1 in 30 |
| Gold | all gold, numbered above the set total | ~1 in 150 |
| Jackpot pack | every card in the pack is Foil or better | ~1 in 2,000 packs |

Finishes are drawn as code shaders where possible. **SPEC (session 29 for the data; shaders come later, after EFFECTS.md v2).**

## Packs — SPEC (session 29)

- Each pack has 5 cards: 2 Common, 1 Uncommon, 1 Rare slot (1 in 8 is a Mythic instead), and 1 shine slot (any card, any rarity). Only the shine slot rolls a finish.
- A pack costs 100 credits. **BUILT:** `buyPack` makes the debit and the pack in one transaction, and the schema refuses a purchase the balance can't cover.
- Every pack, free ones included, gives 5 pack points when opened. The owner spends points on a specific card, in standard finish only: Common 25, Uncommon 50, Rare 150, Mythic 400.
- No dead duplicates: a standard-finish copy beyond the playable limit (3/3/2/1) converts to pack points (Common 1, Uncommon 2, Rare 5, Mythic 15). A converted copy is marked disposed, not deleted. A copy with any other finish is never converted automatically.
- Pity timers, tracked per agent: after 10 packs in a row with no Full Art or better, the next pack guarantees one. After 40 packs with no Mythic, the next pack guarantees one.
- Opening a pack is an owner action. Season 0 needs a minimal, self-contained owner interface for it; a local page or a command is enough.

## Prototypes — SPEC

- Each season has 15 Prototypes, each a single limited run, sized as a pyramid: 4 runs of /250, 3 of /100, 3 of /50, 2 of /25, 1 of /10, 1 of /5 and one 1/1. That is 1,516 copies in all. Every run has its own unique art. The 1/1 goes to a fan-favourite Mythic.
- A Prototype drops as a **bonus 6th card in 1 of every 1,000 packs**. It never replaces one of the 5 normal cards. Which run it comes from is picked in proportion to the copies still available in each run. If the picked run is used up, the pack gives a Gold instead.
- Prototypes that were never pulled are retired at season end, forever. The card viewer shows how many of each run were found.
- Prototypes are not part of the set count. Collection tracking keeps three separate goals: set completion (x/120), secrets found (Gold), and Prototypes held (with serials).
- The art is made at build time with Replicate, following the mythic-wards pattern. The owner checks previews before a season's list goes live.
- Test this with simulated pack openings. Never raise the drop rate to test it.

## Promos and tournament cards — SPEC (session 29 issuing, session 30 the unique Mythic)

- Promos are existing cards with promo art and a stamp naming how they were earned (for example "10-WIN STREAK"). They are numbered in their own series, PR-001 and up. Sources: milestones, quests, tournaments. The schema requires every promo copy to carry a stamp.
- **The exception: each agent's unique one-off Mythic promo**, granted when the agent is created. It is built from a constrained effect menu with power budgets and must pass the ring regression check before it is issued. Its ward comes from the mythic-wards pipeline. **OPEN: the effect menu and the power budgets (owner check-in).**
- Season-finale tournament prizes:
  - Winner: a 1/1 made for that tournament.
  - 2nd to 10th: a limited card numbered by finishing position (02/10).
  - 11th to 100th: a Full Art limited card (37/100).
  - Everyone else who entered: a regular promo with the tournament stamp.
  - All of these use a silver or platinum foil, never the Prototypes' gold, and carry a marker such as "S1 FINALS".
  - If there are fewer entrants than a tier needs, that tier shrinks.

## Earning — match payouts BUILT (session 28); the rest SPEC (session 30)

| Source | Credits | Status |
|---|---|---|
| Win (per UTC day) | 1st 40; 2nd-4th 15 each; 5th-10th 5 each; after 10th 0 | **BUILT** |
| Loss (and draw) | 2 each, first 10 a day, and only while a win would still pay | **BUILT, provisional** |
| Cancelled / abandoned | 0 for both sides | **BUILT** |
| Daily quest | 1 new a day, stacks to 3, worth 50 or 75; owner may reroll 1 a day | SPEC |
| Weekly challenge | 15 wins in a week = 1 free pack | SPEC |
| Owner's daily pack | 1 a day, owner-claimed only, stacks to 2 | SPEC |
| Milestones | promos (first win with each faction, 100 wins, 10-win streak, ...) | SPEC |

An active agent tops out at about 2 packs a day. The server assigns opponents, so an owner can't farm wins by playing its own agents against each other (session 31).

**How payouts work (BUILT):** `recordMatch` writes the match and both payouts in one transaction. Each agent's place in the day is counted from match history, not from the ledger, so a win that paid 0 (past the daily cap) still counts toward the cap. The day is the UTC date of the match's end time. A loss stops paying once the agent's next win would pay 0. That way an 11th win is never worth less than a loss. The tests check that "a win pays at least as much as a loss, a loss pays at least 0, and the win pays strictly more whenever it pays anything" for every daily tally from 0 to 15 wins and 0 to 15 losses.

### Provisional numbers (mine, not the owner's — flagged in notes-for-owner.md)

- **A loss pays 2 credits.** The owner's rule is "a loss pays a little" but gives no number. 2 is below the smallest paying win (5), so a win always pays more.
- **Losses stop paying after 10 a day,** so a stream of losses can't become an income.
- **A draw pays as a loss to both sides.** Draws are rare: the engine's turn cap has a decisive tiebreak.
- **An abandoned match pays nothing to either side,** including the player who stayed. Paying the other side would let two colluding agents farm forfeit wins. The server assigns opponents, which makes that farming hard but not impossible.

## Decks — BUILT (session 28)

- A deck is a list of specific owned copy ids. An agent must own 2 copies to play 2. Any finish counts. The copy limits (3/3/2/1) still apply on top.
- `saveDeck` checks that the agent owns every copy, then runs the engine's own `buildDeck` on the result: copy limits, deck size, one faction plus at most 10 neutral cards, and the card-pool lint. A deck that saves is a deck that plays.
- `loadDeck` runs the same checks again at play time, because the agent may have converted a copy since saving, or a card-pool change may have made an old deck illegal.
- One copy may be in several saved decks. One deck is active at a time.

## Starter collection — SPEC (session 29)

When an agent is created, the owner picks its faction. The agent gets:
- a fixed starter deck for that faction plus neutrals, the same list every time;
- its unique Mythic promo;
- 3 packs of the current set.

All four starter decks must pass the ring regression check against each other before Season 0 starts. The obvious choice is the four shipped decks, which are the decks the ring check already measures. The session-28 demo uses them as a stand-in (source `starter`).

## Later — not now (the data model allows it)

- A 3D pack-opening animation, with finish shaders and Prototype art made at build time.
- A collector area for viewing every owned card in detail.
- Trading and any real-money features.
