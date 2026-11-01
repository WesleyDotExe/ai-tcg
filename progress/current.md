# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 64 (game lane): the saved Home board and
the economy endpoints the website waits on, and the daily reset moved to midnight Sydney. Nothing is blocking;
no owner decision is open (one check-in in notes-for-owner.md, defaults built).**

- **The Home board** (owner 2026-11-01): `GET`/`PUT /api/board`, schema v16 (`board_layouts`, one row per
  owner, a JSON list the schema checks too). The rule is `economy/src/boardLayout.ts` (`boardLayoutProblem`):
  the 12 Season 0 widgets, S/M/L, Watch live twice, at most 13; Tournament and the pull feed refused as after
  Season 0. Never saved reads the recommended layout (the mockup's, Tournament slot given to Store).
- **The economy endpoints** (owner 2026-11-01, in the owner's order): the collection (`/api/collection`, binder, card
  viewer), salvage (plan, then do it; 409 with `needsConfirmation` and the decks it leaves short) and crafting,
  the ledger (`/api/ledger`, newest first, paged), packs (`/api/packs`, buy 1-10 all or none, open one, a chosen
  one or ten), the store and cosmetics (`/api/store`, buy, `/api/cosmetics`), loadouts
  (`/api/agents/:id/loadout`), today's earnings (`/api/daily`). All wiring onto rules the store already had;
  new store reads: `collectionSummary`, `recentPulls`, `buyPacks`, `dailyEarnings`, `boardLayout`/`saveBoardLayout`.
- **The daily reset is midnight Sydney** (`economy/src/dailyReset.ts`, `DAILY_RESET_TIME_ZONE`): the owner set
  it on 2026-11-01 but the store still counted UTC days. `dailyTally` (what `recordMatch` pays by) and
  `dailyEarnings` read the same window.
- **Evidence:** `progress/owner-api-demo-004-economy.txt` (real file, real port, a server restart in the
  middle; byte-identical across runs).

## What stands (this session's work; sessions 1-63 otherwise unchanged)

- `economy/src/boardLayout.ts`, `economy/src/dailyReset.ts`; migration 16; `WIN_SCHEDULE` in payouts.ts (one
  table for the payout and the widget). Server routes in `server/src/ownerApi.ts`, written into
  `server/OWNER_API.md`.
- Tests: `economy/test/ownerEndpoints.test.ts` (9), `server/test/ownerApiEconomy.test.ts` (8); two store tests
  reworded for the Sydney day (and one extended across Sydney midnight). Mutation-checked: dropping the API's
  board 400, dropping the pack-opening owner check, counting the day in UTC again, and a buy that stops halfway
  each fail a test.
- `server/src/dev/economyApiDemo.ts` writes the demo.
- `npm test`: all six workspaces pass (engine 349, protocol 7, server 52, agents 17, economy 172, render 716).
  Typecheck clean in all six.

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #110, was the render lane's). If this
PR is the last merged, the next session is **render** (Season 0 render item 3, Home as the widget board: it can
now save the board with `PUT /api/board` and fill the Packs, Collection, Store and Daily rewards widgets).

The next **game-lane** session is **65, a hardening pass** (60 was the last): no new features. Its jobs, in
order: re-run every committed economy demo (005, 006, 008, 012, 013, 014, 015, 016), read each diff, fix
`boastDemo.ts` (demo 012 crashes on main: "no such column: deck_choice", a v10 file meeting a v12 code path),
regenerate; then work down `progress/quality-debt.md` (session 64's list first: the ledger's in-memory paging,
the collection's single response).

Session 66 (game): Season 0 game item 1, **match running and the ladder** (roadmap 6b). A first slice: a
server-side match runner that pairs connected agents (server-assigned opponents), plays the match, records it
through the store with each side's final health (the close-win boast), pays credits on the daily win schedule
(now on the Sydney day), and calls `rebuildAgentDeckIfNeeded` between matches; then Glicko-2 per owner. Read
`economy/src/store.ts` (`startMatch` / `recordMatch`), `server/src/` and ECONOMY.md first. Prove it with a run of
many matches between house agents and a committed log.

**Blocked:** nothing.
