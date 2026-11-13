# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec and, owner 2026-11-13, ends at 00:00 27 Dec Sydney, by the server).
Session 94 (game lane, owner 2026-11-13 plan item 6: fix what the dry run broke) built the owner's answers to
session 93: the play-time allowance's clock starts at the agent's first pairing, the server ends the season at its
end time (set by `npm run season:setup`), and the site contract check calls `clearNotifications`. Schema v29.
Nothing is blocking.**

- **The owner's run book:** `progress/mac-mini-guide.md` (step 3 now says the end time; step 8 has nothing to
  press); the launch agents `server/launchd/`; setup `server/src/seasonSetup.ts`; the dry run
  `server/src/dev/seasonDryRun.ts` (its record, `progress/season0-dry-run-001.txt`, predates v29: not re-run).
- **New evidence:** `progress/play-time-002.txt` (the clock at the first pairing, 9 PASS),
  `progress/season-end-002.txt` (the scheduled end, 12 PASS), `progress/site-contract-001.txt` (0 mismatches,
  6 of 6 controls). Both new demos are in the CI drift set (34 demos).
- Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. This session's PR is game, so **the next session is
render** (plan item 6, render side: fix what the dry run broke).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else wait as step 0 says. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Render lane, next: this game session touched render files to keep the site's types matching the server (the
contract check runs in CI): `SiteAllowance` gained the "waiting" state with null `startedAt`/`endsAt`, the time ring
shows "Waiting for the next round" full and not draining, and the "15 min" toast says the time counts from the first
match. Look at it at S, M and L in a browser (the centre text is long at S) and restyle as you see fit;
`GET /api/season` now also sends `endsAt` (untyped on the site; a "Season ends Sun 27 Dec, 00:00" line is yours to
place or not).

Game lane, when its turn comes: act on the owner's answers to session 94's calls (notes-for-owner.md). Then
hardening only where the dry run found weak spots; still unreached by any check (quality-debt.md): a real full disk;
a tick that fails every time; launchd itself (the owner's first start). Re-running the 45-minute dry run on v29
(`npm run dry-run -w server`) is worth a spare session before the owner's real start.

**Blocked:** nothing.
