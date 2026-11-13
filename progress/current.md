# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec and, owner 2026-11-13, ends at 00:00 27 Dec Sydney, by the server).
Session 95 (game lane) built the owner's yes to render 72's two asks: auto-play on (and +15/+30) is refused, 409,
once the season has ended, as packs are; and the site contract check reads `GET /api/season` in all its states.
Schema v29 (no change). Nothing is blocking.**

- **The owner's run book:** `progress/mac-mini-guide.md`; the launch agents `server/launchd/`; setup
  `server/src/seasonSetup.ts`; the dry run `server/src/dev/seasonDryRun.ts` (its record,
  `progress/season0-dry-run-001.txt`, predates v29: not re-run).
- **New evidence:** `progress/site-contract-001.txt` (re-run: 70 calls, 0 mismatches, 7 of 7 controls, the season's
  four shapes and the three refusals reached). Tests: `server/test/seasonEnd.test.ts` (the 409s over HTTP),
  `economy/test/nextSeason.test.ts` (the store's refusals). 34 demos same.
- Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. The latest PR (game session 95) is game, so **the next
session is render** (73).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else wait as step 0 says. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Render lane (73): the server now answers 409 to auto-play on once the season has ended (render 72 already turns Start
off then); nothing needs changing, but the site could show the server's words if a stale page sends it. Then
whatever the owner's answers to render 72 and the plan item 6 say (hardening where the dry run found weak spots).

Game lane, when its turn comes: act on the owner's answers to session 95's two calls (notes-for-owner.md). Then
re-run the 45-minute dry run on v29 (`npm run dry-run -w server`) before the owner's real start; still unreached by
any check (quality-debt.md): a real full disk; a tick that fails every time; launchd itself.

**Blocked:** nothing.
