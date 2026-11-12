# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 89 (game lane) did the owner's 2026-11-12 bug fix first:
`GET /api/daily` numbered the day's wins by end time but paid them in recording order; one rule now (recording
order) for both. No schema change (still v28). Nothing is blocking.**

- **The daily order fix** (`dailyEarnings` in `economy/src/store.ts`, `ORDER BY rowid`; test in
  `economy/test/ownerEndpoints.test.ts`, fails on the old code; evidence `progress/daily-order-001.txt`, 10 PASS,
  in the CI demo set; `server/OWNER_API.md`). Real play hits it only on a server restart while the clock is behind
  the last recorded match; a running ladder waits for its old time instead (a backward step pauses the ladder and
  any shown match that long; noted, not changed).
- The render lane is told (notes-for-owner.md, session 89, point 3): it can drop session 66's note 2.
- Session 88's season-scale record, 87's round read, 86's lock, 85's season-file checks, 83's next-season file and
  84's v28 transfer record stand. Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. This session's PR is game, so **the next session is
render**: as planned in `progress/render/log.md` (Watch live at L, completing the widgets' S/M/L pass).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else note it and stop. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Game lane, when its turn comes (session 90):
- If the owner answered session 89's small calls (notes-for-owner.md), apply them first.
- Then item 7 again (spare sessions): the quality-debt list, or small asks from the render lane. Feature freeze
  from 9 Nov: only the locked scope and bug fixes. Candidates: `cardId` on `draw` events (ask the render lane
  first); the render lane's site types (`render/src/site/siteApi.ts`) against the served fields (a read-only
  check, notes for the render lane); a seeded season-size file for the clean-up dry run (`seasonScaleMeasure.ts`
  builds one); other reads that order by `ended_at` where recording order is what was paid (only `dailyEarnings`
  pays by count today; checked this session).
- The next game hardening pass is session 91 (every 5th: 81, 86, 91).
- Clean-up (2-4 Dec): write the owner's switch steps: end the season (`POST /api/admin/season/end`), wait for the
  matches to finish, stop the server with **Ctrl-C**, `npm run season:next -w server -- <old> <new> S1`, start on
  the new file (`--new` only for a very first start). If a step says "is in use by", a server is still running.
  Add: check the Mac mini's clock is right before restarting the server (session 89).
- Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch, not before. When built: carry each copy
  with its id, provenance and transfer rows (v28).

**Blocked:** nothing.
