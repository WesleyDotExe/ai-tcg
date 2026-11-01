# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 66 (game lane): Season 0 game item 1,
match running and the ladder, its core slice. Nothing is blocking; an owner check-in is open in
notes-for-owner.md (the tiers, the matchmaker, the abandon rating, the house's pack buying; defaults built).**

- **Glicko-2 ratings per owner** (`economy/src/glicko2.ts`, Glickman's steps 1-8, his worked example pinned by a
  test), stored in schema v17: `ratings` (current) and `match_ratings` (each rated match side's before and
  after, write-once, only on a rated side of a win, draw or abandon). `recordMatch` rates both sides from their
  pre-match ratings in the same transaction as the match and its payouts; an abandon is a loss for the side that
  walked out; a cancel isn't rated. A whole empty Sydney day grows RD (capped at 350). Store: `rating`,
  `ratingHistory`, `ladder` (placed owners ranked, placement after), `tierOf`; `MatchRecord.ratings`.
- **The ladder runner** (`server/src/ladder/ladderRunner.ts`) and **matchmaker** (`pairing.ts`): each round
  rebuilds queued agent decks via `rebuildAgentDeckIfNeeded` (side by side), pairs by rating (sit-out priority,
  rematch penalty, seeded jitter), and plays each pair `startMatch` -> `runMatch` -> `recordMatch` with turns,
  moves, deck ids and final health; writes each match log. A seat that throws, plays an illegal move or can't be
  seated abandons; an engine error cancels. `AgentSeater` is the seam for network agents; `houseSeater` plays the
  LookaheadAgent in the agent's play style. CLI: `npm run ladder -- <db> [rounds] [log dir]` (rebuilds on the
  worker threads).
- **Endpoints:** `GET /api/ladder` (standings, you, tiers, placement count) and `GET /api/rating` (rating and
  recent changes), in `server/OWNER_API.md`. ECONOMY.md has a "Match running and the ladder" section.
- **Evidence:** `progress/ladder-demo-001.txt` (`npm run demo:ladder -w server`): 8 house owners, 3 Sydney days,
  72 matches, 16 rebuilds (8 first builds, 8 after packs bought with earned credits), a restart mid-run, one
  abandoned match; checks against the store all PASS (credits = ledger, ratings replayed from results alone,
  logs on disk, no self-play). Byte-identical across runs.

## What stands (this session's work; sessions 1-65 otherwise unchanged)

- Demos 005, 006, 008 and 012 regenerated: only their schema line changed (v16 -> v17).
- Tests: `economy/test/glicko2.test.ts` (7), `economy/test/ladder.test.ts` (8), `server/test/pairing.test.ts`
  (6), `server/test/ladder.test.ts` (10, incl. the four fault paths), `server/test/ownerApiEconomy.test.ts` +1
  (the ladder and rating over HTTP; the 401 list is now 24 routes). Mutation-checked: an abandon scored the wrong
  way, no idle-day offset, no rematch penalty, no jitter, no illegal-move check, and rating a cancel each fail a
  test.
- `npm test`: all six workspaces pass (engine 349, protocol 7, server 71, agents 17, economy 198, render 758).
  Typecheck clean in all six.

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #114, was the render lane's). If this
PR is the last merged, the next session is **render** (it can build the Ladder page and widget and the Rating &
form widget against `GET /api/ladder` and `GET /api/rating`).

The next **game-lane** session is **67**: the rest of game item 1 and the match endpoints, in this order:
1. **A long-lived ladder** in the server process: rounds on a timer, each match paced to watch speed (the
   engine's moves replayed at 1x, 2x when both owners agree), with live state kept for Watch live
   (`GET /api/live`, the Live match widget).
2. **Auto-play** (owner spec 2026-10-05 E): a per-owner switch on the account; only owners with it on (and the
   house) are queued; it switches itself off once the day's rewards are maxed.
3. **Match history with replays** (`GET /api/matches`, `GET /api/matches/:id/log`), from the logs the ladder
   now writes.
Read `server/src/ladder/` and `progress/ladder-demo-001.txt` first. Session 70 is the next hardening pass.

**Blocked:** nothing.
