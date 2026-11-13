# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 92 (game lane, the hardening pass for the 7-day unattended
run, owner 2026-11-13 item 2) crashed and stopped the real server mid-match and restarted it on the real clock
(`progress/unattended-run-001.txt`, 17 PASS): recovery worked. Fixed a real wedge (a match that failed to record
left its owners live forever; now retried), a log write that threw after the record, and untimed output (every
line now carries the local time; clock jumps are said). Still schema v28. Nothing is blocking.**

- **Running unattended** (`server/OWNER_API.md`, "Running unattended"): `server/src/logTime.ts` stamps the season
  server's lines; `LiveLadder` retries a failed record (`RECORD_RETRY_MS`: 30 s doubling to 10 min) and prints
  `clockJumpLine`. The measure: `server/src/dev/unattendedRunMeasure.ts` (a record, ~10 min of real clock).
- **The site contract check** (`npm run check:site-contract -w server`; a CI step) and sessions 83-91's season-file,
  lock, daily-order and scale work stand. Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. This session's PR is game, so **the next session is
render**: render 70, the notifications bell (owner 2026-11-13 plan, item 3).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else note it and stop. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Game lane, when its turn comes (session 93, owner 2026-11-13 item 4: **start clean-up early**):
- If the owner answered session 92's call (how the server comes back after a crash or reboot: a launchd launch
  agent or by hand), follow it in the guide.
- Run the full Season 0 dry run in `progress/season0-final-brief.md` ("Clean-up days") in the session's own
  environment: the ladder running, auto-play with an allowance running out mid-match, packs bought and opened (1
  and 10), the daily reset crossing midnight Sydney, Watch live; report what broke at an [OWNER CHECK-IN].
- Write the owner's step-by-step Mac mini guide: first start (`--new`), running unattended (output to a log file,
  `>> season.log 2>&1`; no sleep; log in after a power cut), stopping (Ctrl-C), a restart, checking the clock
  before a restart, ending the season (`POST /api/admin/season/end`) and the switch (`season:next`). If a step says
  "is in use by", a server is still running.
- Still unreached by any check (quality-debt.md, sessions 91-92): a real full disk; a tick that fails every time.

**Blocked:** nothing.
