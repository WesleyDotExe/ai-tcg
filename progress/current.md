# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 88 (game lane) was a spare session (item 7, the
quality-debt list): session 87's remaining scale gaps measured on a season-size file; the slow demo set re-run.
No code or schema change (still v28). Nothing is blocking.**

- **Season scale** (`progress/season-scale-001.txt`, a record; `server/src/dev/seasonScaleMeasure.ts`): at Season
  0's end (6,300 matches per house owner) recording a real match through the ladder is ~5 ms, `GET /api/stats`
  ~60 ms, `GET /api/ladder` ~30 ms, `GET /api/rating` ~12 ms, notifications ~3 ms; `endSeason` ~30-45 ms and
  `startNextSeason` ~140 ms, once. None is on the website's 15 s poll, so nothing needed fixing for Season 0. An
  owner index on `match_ratings` was tried: no gain at eight owners, not added. Disk: ~37 KB of log and replay per
  real match, ~150 MB over the 7 unattended days.
- **The slow demo set** (economy-demo-011, -014, -016): 014 and 016 reproduce; 011 was stale only on its schema line
  (v27 -> v28, since session 84) and is regenerated.
- Session 87's round read, session 86's lock, session 85's season-file checks, session 83's next-season file and
  session 84's v28 transfer record stand. Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. This session's PR is game, so **the next session is
render**: as planned in `progress/render/log.md` (Daily rewards, Watch live at L, Showcase and Collection).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else note it and stop. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Game lane, when its turn comes (session 89):
- If the owner answered session 88's small call (notes-for-owner.md), apply it first.
- Then item 7 again (spare sessions): the quality-debt list, or small asks from the render lane. Feature freeze
  from 9 Nov: only the locked scope. Candidates: `cardId` on `draw` events (ask the render lane first); the
  render lane's site types (`render/src/site/siteApi.ts`) against the served fields (a read-only check, notes for
  the render lane); a seeded season-size file for the clean-up dry run (`seasonScaleMeasure.ts` builds one).
- The next game hardening pass is session 91 (every 5th: 81, 86, 91).
- Clean-up (2-4 Dec): write the owner's switch steps: end the season (`POST /api/admin/season/end`), wait for the
  matches to finish, stop the server with **Ctrl-C**, `npm run season:next -w server -- <old> <new> S1`, start on
  the new file (`--new` only for a very first start). If a step says "is in use by", a server is still running.
- Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch, not before. When built: carry each copy
  with its id, provenance and transfer rows (v28).

**Blocked:** nothing.
