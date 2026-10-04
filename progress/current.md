# Current status

**Build-order stage: Stage 4+ (the living system), persistence DONE, the economy build is
next.** Session 28 was a game-lane session (the last merged PR, #39, was render). It built
persistence (owner-feedback 2026-10-04 section B) and wrote the economy spec (`ECONOMY.md`). The
stage isn't finished, so there's no checkpoint this session.

## What stands (this session's work; sessions 1-27 otherwise unchanged)

**`economy/` (`@ai-tcg/economy`), a new workspace.** The engine doesn't depend on it; the
server will (roadmap 6b).
- `src/schema.ts`: migration v1. Tables: `meta` (season), `agents`, `ledger`, `packs`,
  `card_copies`, `decks`/`deck_copies`, `matches`. The integrity rules are in the schema as
  triggers and CHECK constraints:
  - the ledger is append-only, and no entry may take a balance below zero;
  - each agent gets at most one payout per reason per reference;
  - a deck can only hold copies its own agent owns;
  - each serial exists once and fits its run;
  - a cancelled or abandoned match pays 0.
- `src/store.ts`: the `EconomyStore` API, backed by `node:sqlite` (one file per season).
  - Agents: `createAgent`, `getAgent`, `listAgents`.
  - Ledger: `balance` (the sum of the ledger, never stored), `ledger`.
  - Copies: `grantCopy`/`grantCopies` (batch, all or nothing; card ids are checked against the
    engine's new `CARD_REGISTRY`), `collection`.
  - Decks: `saveDeck`/`loadDeck` (ownership checks, then the engine's own `buildDeck` rules),
    `setActiveDeck`.
  - Packs: `buyPack` (100 credits; the debit and the pack in one transaction), `grantPack`,
    `unopenedPacks`.
  - Matches: `recordMatch` (the match plus both payouts in one transaction; a duplicate id is
    refused), `matchHistory`, `dailyTally`.
- `src/payouts.ts`: wins pay 40 / 15 x3 / 5 x6 / 0 per UTC day (owner-set). A loss or draw pays
  2 (provisional), first 10 a day, and only while a win would still pay. Cancelled or abandoned
  pays 0.
- The engine gained exports only: `CARD_REGISTRY`, `SHIPPED_DECK_LISTS`, `getCard`,
  `COPY_LIMITS`, `buildNullDeck`, `LookaheadAgent`, and the `Rarity`/`DeckFaction` types. No
  logic changed, and the ring check came out identical.

**`ECONOMY.md`**: the owner's section C, the economy answers and the three amendments as one
spec. Each part is marked BUILT, SPEC (with its session) or OPEN. The only OPEN item is the
unique Mythic's effect menu and power budgets. Four provisional numbers are flagged in
notes-for-owner.md.

## Evidence committed

- `progress/economy-demo-001.txt` (`npm run demo -w @ai-tcg/economy`):
  - four house agents own their faction's shipped deck as copies and play from decks saved from
    those copies;
  - 40 real Lookahead matches over two days, paid and recorded, with the daily caps visibly
    paying 0 (s0-m033, m035, m036) and day 2 resetting to 40;
  - a cancel and an abandon pay 0;
  - a duplicate match and a raw ledger UPDATE are refused;
  - the owner buys packs until each balance runs short, and the next purchase is refused;
  - the file is closed, reopened, and the balances equal the ledger sums.
- `economy/test/` (18 tests): the payout invariant over every tally from 0-15 wins and 0-15
  losses, append-only and no-overdraw through raw SQL, a duplicate match, a foreign winner, UTC
  day counting, cancel/abandon paying 0 (including a raw INSERT), a draw, the pack price and
  refusal, a batch rollback, serial uniqueness and run bounds, promos needing a stamp, deck
  ownership (also through raw SQL), the engine deck rules, a disposed copy, and close/reopen of
  a real file.
- `npm test`: 357 across six workspaces. `tsc --noEmit` clean in all six. The ring regression
  check passes, identical to the baseline.

## Concrete next step

Check the alternation first. If the last merged PR is this one (game lane), the next session is
**render**: apply the 2026-10-05 entry (player-targeted hits land mid-board), then EFFECTS.md v2
slice 3 (procedural sound).

The next **game-lane** session is **session 29, the economy build** (ECONOMY.md, sections marked
"SPEC (session 29)"), in this order:
1. Sets. A Season 0 set definition (`S0`): collector numbers for every ownable card (the
   registry has the cards; pick a stable order), the set total, Gold numbering above the total.
   Store it as data in `economy/`, not in the database.
2. Pack generation as a pure, seeded function (5 slots, the shine-slot finish table, Jackpot,
   the Prototype bonus 6th card at 1 in 1,000 weighted by remaining copies, pity timers derived
   from history). Then `openPack` in the store: mark the pack opened, grant the copies, +5 pack
   points, convert standard-finish duplicates beyond 3/3/2/1. Test the rates with a simulation of
   ~100k packs, not by raising rates.
3. Pack points spending (standard finish only), promo issuing (PR-001 numbering, stamp required).
4. Starter collections (the four shipped decks + 3 packs), and the owner's pack-opening command.
