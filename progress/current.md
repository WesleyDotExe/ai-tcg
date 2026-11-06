# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 77 (game lane) shipped the auto-merge test-run guard and
notifications. Nothing is blocking. The notification list is at an [OWNER CHECK-IN] at the top of
notes-for-owner.md (five calls); session 76's five calls and session 75's call are still open. Nothing waits on any
of them.**

- **The auto-merge guard** (owner 2026-11-06, after PR #137): `.github/workflows/auto-merge.yml` merges only when the
  `test` check run exists for the head commit and concluded `success`; missing, it waits the 12-minute timeout and
  fails "no test run for this commit"; skipped / neutral fail at once. Session 75's retries kept.
  `server/test/autoMergeWorkflow.test.ts` (15 tests; the 6 new ones fail on the old workflow).
- **Notifications** (roadmap 2d; schema v23): `notifications` table (one per owner, kind and source; read and
  cleared once; never deleted; player owners only), written by the store in the same transaction as the match
  record, the pack opening (a `fullReveal` pack) and the auto-play stop (rewards cap or time up); the daily pack's
  written on the day's first read with a pack waiting, and read when the last one is claimed. The account settings
  carry `notifications: { bigPulls, matchResults, dailyPack }`. `GET /api/notifications`, `POST
  /api/notifications/read`, `POST /api/notifications/clear`. Tests `economy/test/notifications.test.ts` (13),
  `server/test/notifications.test.ts` (4); evidence `progress/notifications-001.txt` (14 PASS), on
  `progress/demos.json`.
- The render lane can now build the bell, the Notifications widget and Settings -> Notifications.

## Concrete next step

At the start: check for an open PR from your own lane (owner 2026-11-06); if one is open, note it and stop, or fix
it if it has failed checks or conflicts. Check the last merged PR so a slice isn't built twice.

The next **game-lane** session is **78: the Stats page's data** (roadmap 2e; owner 2026-11-05): what the Stats page
(the 2026-10-05 spec, Stats: rating chart; matches, wins, win rate and best streak; recent results; win rate by
faction; today's earnings and quests; the "All agents" / one-agent filter) and the Rating & form widget at L need
beyond `GET /api/ladder` and `GET /api/rating`. `store.ratingHistory` and `store.ownerStats` exist; read them first.
Propose the shape at an [OWNER CHECK-IN] if the spec doesn't settle it, build on the proposal, keep going.
`server/OWNER_API.md`, tests, a demo on `progress/demos.json`; run `npm run demos` before the PR. Then the Null
builder session (2f). The next game-lane hardening pass is session 80. Feature freeze from 9 Nov: only the locked
scope.

**Blocked:** nothing.
