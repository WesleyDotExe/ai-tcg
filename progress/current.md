# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 85 (game lane) made the by-hand season switch safe (item 7,
spare sessions: the quality-debt list). No schema change (still v28). Nothing is blocking.**

- **The archive is only read:** `startNextSeason` opens the ended file read-only (`EconomyStore.openReadOnly`); an
  archive at an older schema is migrated as a temporary copy (`withCurrentSchemaCopy`), never in place; a mistyped
  ended file is refused and not created.
- **The servers check their file first** (`server/src/seasonFile.ts`, `EconomyStore.peekSeasonFile`): a missing file
  needs `--new` (the very first start), an ended one `--archive`; unknown `--` options refused. In `npm run season`,
  `owner-api` and `ladder`. The start line says which season and whether it came from an archive.
- **Evidence:** `progress/season-switch-001.txt` (16 PASS, drives the real CLIs, in the CI demo set);
  `economy/test/nextSeason.test.ts` (4 new, all failing on the old store), `server/test/seasonFile.test.ts` (10).
- Owner-requested Season 1 ideas that were never written in are now in `progress/season-1-ideas.md` (the auto-play
  prompt, "newest sets only", the one-command switch, the marketplace, the ten-pack set bar).
- Session 83's next-season file and session 84's v28 transfer record stand. Season end part 3 (the 2026-11-10
  carry-over) is after the 5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. This session's PR is game, so **the next session is
render**: the store layout (owner 2026-11-11, after part 3b).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else note it and stop. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Game lane, when its turn comes:
- **Session 86 is the game lane's hardening pass** (every 5th: 81, 86). Candidates from quality-debt.md: the stats
  read counting the whole history; `cardId` on `draw` events (ask the render lane first); a lock file so
  `season:next` can't run while a server is still on the ended file; the economy-demo-011 slow set re-run.
- If the owner answered anything in notes-for-owner.md (session 85's small calls), apply it first.
- Then item 7 again (spare sessions): the quality-debt list, or small asks from the render lane. Feature freeze from
  9 Nov: only the locked scope.
- Clean-up (2-4 Dec): write the owner's switch steps (end, wait, `season:next`, restart on the new file; `--new` for
  a first start).
- Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch, not before. When built: carry each copy
  with its id, provenance and transfer rows (v28).
- If a PR gets a second commit, read both auto-merge jobs: the first live run of the `sha` pin.

**Blocked:** nothing.
