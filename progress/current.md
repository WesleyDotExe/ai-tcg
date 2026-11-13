# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 93 (game lane, owner 2026-11-13 item 4: start clean-up
early) ran the full Season 0 dry run from the owner's new Mac mini guide (`progress/season0-dry-run-001.txt`, 49
PASS, crossing midnight Sydney) and fixed what it found: a new season file had nobody in it (`npm run season:setup`
now), and the launch agent's plist wouldn't load. Still schema v28. Nothing is blocking.**

- **The owner's run book:** `progress/mac-mini-guide.md`; the launch agents `server/launchd/` (`install.sh`); setup
  `server/src/seasonSetup.ts`; the dry run `server/src/dev/seasonDryRun.ts` (`npm run dry-run -w server`, a record).
- Session 92's unattended-run work, the site contract check and sessions 83-91's season-file, lock, daily-order and
  scale work stand. Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. This session's PR is game, so **the next session is
render**: render 71, Top rated and viewer counts on Watch live (owner 2026-11-13 plan, item 5).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else wait as step 0 says. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Game lane, when its turn comes (plan item 6: fix what the dry run broke; hardening only where it found weak spots):
- Act on the owner's answers to session 93's three calls (notes-for-owner.md): above all call 1 (the allowance's
  clock starting at the first pairing, if chosen: `economy/src/store.ts` autoPlay, the ladder's queue, the
  `allowance` shape and OWNER_API.md, the contract check).
- `clearNotifications` in `server/src/dev/siteContractCheck.ts` (owner 2026-11-13, after the dry run).
- Still unreached by any check (quality-debt.md, sessions 91-93): a real full disk; a tick that fails every time;
  launchd itself (the owner's first start).

**Blocked:** nothing.
