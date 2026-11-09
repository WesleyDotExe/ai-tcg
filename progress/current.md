# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 82 (game lane) built season end, part 1 (roadmap game
item 3): ending a season. Part 2 (the next season's file) is at an [OWNER CHECK-IN]. Nothing is blocking.**

- **Ending a season (schema v26):** `store.endSeason()` is one transaction: the tier coins first, then the final
  standings (`season_standings`), then every Prototype run of the season's set retired with what it found
  (`retired_prototype_runs`, `CardSet.season`), then `season_end`. After it: no match starts or is recorded, the
  ladder pairs nobody, ratings are final, and a pack's Prototype bonus is a Gold. The schema refuses each of these
  too, and the three tables are write-once.
- **The live ladder drains first:** `LiveLadder.endSeason()` stops new rounds and lets the shown matches finish
  and count. Then it ends the season and emits `seasonEnded`.
- **Endpoints:** `POST /api/admin/season/end` (house admin, body `{ season }`; 202 ending / 200 ended) and
  `GET /api/season` (state, the tier coins the tier would earn now, then the standings, your line, the retired
  runs). In `server/OWNER_API.md`.
- **Evidence:** `progress/season-end-001.txt` (11 PASS: a v25 file migrated, 3 h of ladder, the drain, the archive,
  3 h more with no match, the same pack seed now a Gold). In the CI demo set. 10 demos regenerated (the schema
  line only).

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. **Catch-up (owner 2026-11-08): until two "Render:" PRs have
merged after #143, every session is render.** Render session 59 (#144, catch-up 1 of 2) did the hardening pass and
the #137 comparison; render session 60 (catch-up 2 of 2) built pack ceremony part 2. **Once session 60's "Render:"
PR merges, the catch-up is done and plain alternation resumes: the next session is game** (the steps below).
Render's next move, when its turn comes, is in `progress/render/log.md`'s last entry: pack ceremony part 3.

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else note it and stop. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

- If the owner has answered the session-82 check-in (the next season's file): build part 2 as answered: a store
  call that creates the new season's file from the ended one (accounts, logins, settings, board, agents and names,
  signature cards and their copies, cosmetics and loadouts, the retired runs), with the soft reset and the starter
  grant. Prove it on `season-end-001`'s file.
- If not: game-lane item 7 (spare sessions): the quality-debt list, or small asks from the render lane. Don't
  start part 2 on guesses. Feature freeze from 9 Nov: only the locked scope.
- If this session's PR got a second commit, read both auto-merge jobs: that would be the first live run of the
  `sha` pin.
- The next hardening pass is session 86.

**Blocked:** nothing (part 2 waits on the owner's answers, the rest of the lane doesn't).
