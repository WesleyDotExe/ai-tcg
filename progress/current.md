# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 76 (game lane) built the play-time allowance. Nothing is
blocking. Five small calls on it are at the top of notes-for-owner.md; session 75's call (the demo check in CI) is
still open. Nothing waits on either.**

- **The play-time allowance** (owner 2026-11-06, item 2 of the game lane's order; schema v22): `PUT /api/play/auto-play`
  takes `minutes` 15 / 30 / 60; `POST /api/play/auto-play/time` adds 15 / 30; `GET /api/play`'s `autoPlay.allowance`
  is running / finishing / done with seconds and minutes left and the window's length; time up means the owner isn't
  queued, its live match finishes, then auto-play goes off with `timeUp` (ladder event `autoPlayStopped` now carries a
  `reason`); windows are cut at midnight Sydney. Tests `economy/test/playTimeAllowance.test.ts` (9),
  `server/test/playTimeAllowance.test.ts` (4); evidence `progress/play-time-001.txt` (13 PASS), on `progress/demos.json`.
- The render lane's Agent controls time ring can now be built on it (render order item 2).

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR before it, #134, was the render lane's). If
this PR is the last merged, the next session is **render**.

The next **game-lane** session is **77: notifications** (roadmap 2d; the owner's 2026-11-05 and 2026-11-06 entries):
the top bar's bell and the Notifications widget. Read the 2026-10-05 spec's Settings -> Notifications first (big
pulls, match results, the free daily pack), add auto-play switched off at the day's cap and "your agent's time is up"
(the ladder's `autoPlayStopped` with its `reason` is the source for both). Propose the list and the shape at an
[OWNER CHECK-IN] if the spec doesn't settle it, build on the proposal, keep going. `server/OWNER_API.md`, tests, a
demo on `progress/demos.json`; run `npm run demos` before the PR. Then the Stats data (2e), the Null builder session
(2f). The next game-lane hardening pass is session 80.

**Blocked:** nothing.
