# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 65 (game lane): a hardening pass, plus
the owner's daily pack the owner asked for in the same session. Nothing is blocking; no owner decision is open
(three small calls noted in notes-for-owner.md, defaults built).**

- **Hardening: the eight stale economy demos** (005, 006, 008, 012, 013, 014, 015, 016) re-run, each diff read,
  all regenerated. Two crashed: `boastDemo.ts` (012: a v10 file met `setActiveDeck`'s v12 `deck_choice` write;
  the store now skips that write before v12 and `setDeckChoice` refuses before v12, as its other
  version-gated paths do; regression test added) and `packOpeningDemo.ts` (006: its clock started at 20:00
  Sydney, so its 12 wins crossed Sydney midnight after session 64 and the "can't afford a pack" step didn't hold;
  clock moved to 09:00 Sydney). The other drift is explained: balance changes (Null 40, NA12/CS7), the newer
  agent-name generator, S0-odds-2, the schema version line.
- **The owner's daily pack** (owner 2026-10-04 rule: one a day, owner-claimed, stacks to 2; midnight Sydney):
  `economy/src/dailyPack.ts` (the pure bank), store `dailyPackStatus` / `claimDailyPack` (no schema change: the
  bank is worked out from the owner's `ownerDaily` packs and its creation day), `GET /api/packs/daily`,
  `POST /api/packs/daily/claim`, `dailyPack` in `GET /api/packs` and `GET /api/store`; in `server/OWNER_API.md`
  and ECONOMY.md.
- **The ledger is paged in SQL** (`store.ledgerPage`, `LIMIT`/`before`), the API no longer loads it whole.
- **Evidence:** `progress/owner-api-demo-005-daily-pack.txt` (real file, real port, a restart in the middle,
  byte-identical across runs); the eight regenerated `progress/economy-demo-0NN.txt`.

## What stands (this session's work; sessions 1-64 otherwise unchanged)

- Tests: `economy/test/dailyPack.test.ts` (9), `economy/test/ownerEndpoints.test.ts` +2 (ledger pages, the v10
  deck write), `server/test/ownerApiEconomy.test.ts` +2 (daily pack over HTTP; 401 list now 22 routes).
  Mutation-checked: no cap, no refusal, the claim counted on the UTC day, a bank that owes, the ledger's `<=`
  and `more` off by one, and the v10 write unguarded each fail a test (the UTC-day one first survived; the test
  was tightened until it failed).
- `npm test`: all six workspaces pass (engine 349, protocol 7, server 54, agents 17, economy 183, render 741).
  Typecheck clean in all six. Owner-API demos 003 and 004 still byte-identical.

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #112, was the render lane's). If this
PR is the last merged, the next session is **render** (the Store page with pack opening on the site; it can now
also light "Claim free daily pack" with `POST /api/packs/daily/claim`).

The next **game-lane** session is **66**: Season 0 game item 1, **match running and the ladder** (roadmap 6b).
A first slice: a server-side match runner that pairs connected agents (server-assigned opponents), plays the
match, records it through the store with each side's final health (the close-win boast), pays credits on the
daily win schedule (Sydney day), and calls `rebuildAgentDeckIfNeeded` between matches; then Glicko-2 per owner.
Read `economy/src/store.ts` (`startMatch` / `recordMatch`), `server/src/` and ECONOMY.md first. Prove it with a
run of many matches between house agents and a committed log. Session 70 is the next hardening pass.

**Blocked:** nothing.
