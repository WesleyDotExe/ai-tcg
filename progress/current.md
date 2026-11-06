# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 78 (game lane) did the owner's three small answers (the
demo check in CI, "Time's up", the notification clean-up rule on the launch list) and the Stats page's data.
Nothing is blocking. The Stats page's shape is at an [OWNER CHECK-IN] at the top of notes-for-owner.md (five
calls); nothing waits on them.**

- **The demo check in CI:** `.github/workflows/test.yml` runs `npm run demos` (the fast set) after the ring check.
  A rule, card or schema change now fails the PR until its demos are regenerated (`npm run demos -- --write`, then
  read the diff). The slow three (`--all`) are still local only.
- **"Time's up":** `autoPlay.allowance.label` ("Running" / "Finishing match" / "Time's up",
  `AUTO_PLAY_ALLOWANCE_LABELS`); `state` stays `done` on the wire.
- **The Stats page (roadmap 2e; schema v24):** each side's deck faction is kept on the match (`p1_faction` /
  `p2_faction`, written once by `recordMatch`; null before v24). `store.stats(ownerId, { agentId, days, recent })`,
  counting in `economy/src/stats.ts` (pure: `tallyMatches`, `ratingChart`). `GET /api/stats?agent&days&recent`.
  Tests `economy/test/stats.test.ts` (10), `server/test/stats.test.ts` (3); evidence `progress/stats-001.txt`
  (13 PASS) on `progress/demos.json`.
- The render lane can now build the Stats page and the Rating & form widget (S: `rating.now` and `weekChange`; M:
  `rating.chart` and `recent`; L: + `totals` and `byFaction`), and My agent's rating trend at L.

## Concrete next step

At the start: check for an open PR from your own lane (owner 2026-11-06); if one is open, note it and stop, or fix
it if it has failed checks or conflicts. Check the last merged PR so a slice isn't built twice. CI now runs the
demos: if a change of yours moves a demo, regenerate it (`npm run demos -- --write`) and read the diff before the PR.

The next **game-lane** session is **79: the test-only Null deck-builder session** (roadmap 2f, = 1d; owner-approved,
the recommendation in notes-for-owner.md's session 71 check-in, call 1): the store's deck builder keeps the designed
Null deck unless another deck beats it by more than noise; then re-run the built-deck ring
(`progress/built-deck-ring-005.txt` is the one to beat; `progress/rules-2-ship/null-noise/README.txt` has the three
builder decks measured so far). Test only; results to an owner check-in, before the launch-gate re-run. Then the
rest of the game lane's open Season 0 items (2-0 onward; season end near the end). The next game-lane hardening
pass is session 80. Feature freeze from 9 Nov: only the locked scope.

**Blocked:** nothing.
