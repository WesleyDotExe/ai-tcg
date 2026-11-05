# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 75 (game lane) was a HARDENING pass. Nothing is blocking.
One small call is open (the demo check in CI, top of notes-for-owner.md); nothing waits on it.**

- **The auto-merge retry fix** (owner 2026-11-06, first in the game lane's order): the "Wait for checks to pass" step
  retries GitHub 5xx / 429 / rate-limit 403 four times (5/10/20/40 s). `server/test/autoMergeWorkflow.test.ts`.
- **The demo drift check:** `progress/demos.json` (24 demos, 4 records), `npm run demos` (fast; `-- --all`,
  `-- --write`), `server/test/demoManifest.test.ts`. First run: 16 of 24 stale (schema v21, rules-2), all
  regenerated and read; now 24 the same.
- **Owner feedback:** session 74's answers handled (the Gold floor on the roadmap's launch items); the 2026-11-06
  scope-lock entry in progress (item 1 done).

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR before it, #132, was the render lane's). If
this PR is the last merged, the next session is **render** (the live-arena slice: the signature card in full, the
live boast, the 2× controls).

The next **game-lane** session is **76: the play-time allowance** (roadmap 2g; spec `progress/season0-final-brief.md`
section 1; the owner's 2026-11-06 entry): auto-play on with 15 / 30 / 60 minutes, +15 / +30 while running; when time
runs out the agent finishes its current match and isn't paired again; no carry-over, resets at midnight Sydney;
auto-play with no time chosen behaves as today (the rewards cap still applies). `GET /api/play` reports minutes left
and running / finishing / done for today. `server/OWNER_API.md`, tests, a demo (add it to `progress/demos.json`). Run
`npm run demos` before opening the PR (a schema bump rewrites the schema line in ~7 demo files: `-- --write`, then
read the diff). Then, in order: notifications (2d, add "your agent's time is up"), the Stats data (2e), the Null
builder session (2f). The next game-lane hardening pass is session 80.

**Blocked:** nothing.
