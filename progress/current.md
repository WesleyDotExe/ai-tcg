# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 67 (game lane): Season 0 game item 1,
match running and the ladder, the rest of its slice: the long-lived ladder at watch speed, Watch live, auto-play,
match history with replays, and the house pack policy. Nothing is blocking. Owner check-ins open in
notes-for-owner.md: the first seat wins about 65% (pick a fix to measure), and six calls on the live ladder.**

- **The long-lived ladder** (`server/src/ladder/liveLadder.ts`): rounds on the clock; the engine plays each match
  at once with its move-by-move timeline (`timeline.ts`, via the engine's new `onMove` hook), the server releases
  it at watch speed (6 s an action, 1 s a pass, +3 s a new turn, 8 s the result; median 5.9 min), and records it
  only after the last move is shown. 60 s between rounds. A restart cancels what was being shown. `npm run season
  -- <db> [port] [match dir]` runs the owner API and the ladder in one process (smoke-run on a real clock).
- **Replays:** `<matchId>.replay.json` (`ai-tcg-replay/1`: decks, seed, every move) beside each log; the engine's
  new `replayMatch` rebuilds the match exactly (tests check the rebuilt log against the written one).
- **Auto-play** (schema v18, `auto_play`): player owners queue only while it's on; the store turns it off after the
  match that maxes the day, with the reason, until midnight Sydney. House owners always queue.
- **The house pack policy** (owner 2026-11-02 (a)): each round starts with every queued house owner buying packs
  with its credits and opening every waiting pack. Server policy (`Ladder` `housePacks`), player owners untouched.
- **Endpoints:** `PUT /api/play/auto-play` (+ `autoPlay` in `GET /api/play`), `GET /api/live`,
  `GET /api/live/:id?from=N`, `GET /api/matches`, `GET /api/matches/:id`, `.../log`, `.../replay`. In
  `server/OWNER_API.md`; ECONOMY.md's ladder section updated.
- **The first seat, measured** (owner's ask): 64.8% over 2,400 ladder matches, 65.4% in shipped-deck mirrors
  (`progress/first-seat-001.txt`). The game's edge; not changed, at an owner check-in with four options.
  The balance report's mislabelled "first-player-advantage baseline" mirror lines were relabelled.

## What stands (this session's work; sessions 1-66 otherwise unchanged)

- Evidence: `progress/ladder-demo-002-live.txt` (new, byte-identical across runs), `progress/first-seat-001.txt`
  (new), `progress/ladder-demo-001.txt` (regenerated with the server's house policy: the same 72 matches, the
  shopping lines now at round start), economy demos 005, 006, 008, 012 (schema line only, v17 -> v18).
- Tests: `engine/test/matchHooks.test.ts` (2), `economy/test/autoPlay.test.ts` (4), `server/test/liveLadder.test.ts`
  (4), `server/test/ownerApiMatches.test.ts` (4), `server/test/ladder.test.ts` +5 (replay rebuild with a generated
  signature card, the timeline, who queues, auto-play off at the 10th win, the house policy).
- `npm test`: all six workspaces pass; typecheck clean in all six (numbers in log.md).

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #116, was the render lane's). If this
PR is the last merged, the next session is **render** (it can build Watch live, the Live match widget, Match
history and auto-play against the new endpoints; `server/OWNER_API.md` has the shapes).

The next **game-lane** session is **68**:
1. Read owner-feedback.md for the answer on the first seat. If the owner picked options, measure them on the
   shipped-deck mirrors first (`server/src/dev/firstSeatMeasure.ts`'s last section is the instrument), then the
   ring, then the built-deck ring, and bring the numbers.
2. The small asks approved for after session 67 (owner 2026-11-02, render 47 and 48 entries): the craft price and
   playable copy limit in `GET /api/collection/cards/:cardId`; signature cards and earned promos in the
   collection API; `GET /api/packs/:packId/opening` answering the `PackOpening` shape `POST /api/packs/open`
   gives (it exists; check it matches, and test it). All into `server/OWNER_API.md` with tests.
Session 70 is the next hardening pass (include `owner-api-demo-002`'s drift).

**Blocked:** nothing.
