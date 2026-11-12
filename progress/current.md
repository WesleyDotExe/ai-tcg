# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 87 (game lane) was a spare session (item 7, the
quality-debt list): a ladder round's whole-history read moved into SQL, and the live feed sized. No schema change
(still v28). Nothing is blocking.**

- **The round's read:** `Ladder.startRound` took each owner's last two opponents from its whole match history.
  Measured (`progress/ladder-scale-001.txt`, a record): 1.8 s a round at Season 0's end with the eight house agents,
  4 s at twice that, and refused by SQLite past 32,766 matches for one owner. Now `store.recentOpponents(ownerId, n)`
  (two index-ordered reads, merged): ~5 ms a round. Tests in `economy/test/matchHistoryPage.test.ts` (3, against
  the old read; checked to bite).
- **The live feed** (`progress/live-feed-size-001.txt`, CI demo): ~180 KB median / ~305 KB max for a page opened
  on a match's last move; a poll is one move. No cap for Season 0 (a cap needs the website's first read to loop).
- Session 86's lock, session 85's season-file checks, session 83's next-season file and session 84's v28 transfer
  record stand. Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. This session's PR is game, so **the next session is
render**: as planned in `progress/render/log.md` (the rest of the widgets' S/M/L pass).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else note it and stop. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Game lane, when its turn comes (session 88):
- If the owner answered session 87's one small call (notes-for-owner.md), apply it first.
- Then item 7 again (spare sessions): the quality-debt list, or small asks from the render lane. Feature freeze
  from 9 Nov: only the locked scope. Candidates: `cardId` on `draw` events (ask the render lane first); the
  economy-demo-011 slow set re-run; the rest of session 87's scale gaps (quality-debt.md): `recordPlayed`, `GET
  /api/stats` and the season end's standings timed on a season-size file (`ladderScaleMeasure.ts` builds one).
- The next game hardening pass is session 91 (every 5th: 81, 86, 91).
- Clean-up (2-4 Dec): write the owner's switch steps: end the season (`POST /api/admin/season/end`), wait for the
  matches to finish, stop the server with **Ctrl-C**, `npm run season:next -w server -- <old> <new> S1`, start on
  the new file (`--new` only for a very first start). If a step says "is in use by", a server is still running.
- Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch, not before. When built: carry each copy
  with its id, provenance and transfer rows (v28).

**Blocked:** nothing.
