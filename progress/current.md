# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 86 (game lane) was the hardening pass: the season-file
lock the owner asked for (2026-11-11, answer 4), and two whole-history reads moved into SQL. No schema change
(still v28). Nothing is blocking.**

- **The lock:** `server/src/seasonLock.ts`. `npm run season`, `owner-api` and `ladder` hold `<file>.lock` while
  they run; `npm run season:next` takes the ended file's lock while it reads it. So `season:next` refuses while a
  server is still on the old file, and a second server on one file is refused. A lock left by a killed process (or
  from before the machine last started) is taken over, with a `[lock] took over a stale lock ...` line.
- **`npm run season` handles Ctrl-C from the moment it holds the lock** (it used to install its handlers only
  once the API was up; the demo under load caught a Ctrl-C leaving the lock behind).
- **`GET /api/matches` pages by SQL** (`store.matchHistoryPage`) and **`ownerStats` counts four columns**: ~70 ms
  -> ~2 ms each at a season's 2,500 matches (`progress/stats-scale-001.txt`, a record).
- **Evidence:** `progress/season-lock-001.txt` (16 PASS, drives the real CLIs, in the CI demo set);
  `server/test/seasonLock.test.ts` (9), `economy/test/matchHistoryPage.test.ts` (4, against the old reads).
- Session 85's season-file checks, session 83's next-season file and session 84's v28 transfer record stand.
  Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. This session's PR is game, so **the next session is
render**: as planned in `progress/render/log.md`.

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else note it and stop. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Game lane, when its turn comes (session 87):
- If the owner answered session 86's three small calls (notes-for-owner.md), apply them first.
- Then item 7 again (spare sessions): the quality-debt list, or small asks from the render lane. Feature freeze
  from 9 Nov: only the locked scope. Candidates: `cardId` on `draw` events (ask the render lane first); the
  economy-demo-011 slow set re-run; `GET /api/live/:id` copying every released step (a size cap).
- The next game hardening pass is session 91 (every 5th: 81, 86, 91).
- Clean-up (2-4 Dec): write the owner's switch steps: end the season (`POST /api/admin/season/end`), wait for the
  matches to finish, stop the server with **Ctrl-C**, `npm run season:next -w server -- <old> <new> S1`, start on
  the new file (`--new` only for a very first start). If a step says "is in use by", a server is still running.
- Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch, not before. When built: carry each copy
  with its id, provenance and transfer rows (v28).

**Blocked:** nothing.
