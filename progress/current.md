# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 74 (game lane) shipped featured picks and
viewer counts. Nothing is blocking. One [OWNER CHECK-IN] is open (the "Top rated" rule, three calls, top of
notes-for-owner.md); nothing waits on it.**

- **Featured picks** (owner app spec 2026-10-05 C.4; `server/OWNER_API.md`, Watch live):
  - `GET /api/live` sends `featured: { tournament: [], topRated: [matchId...] }`.
  - Top rated (proposed): both sides out of placement; ranked by the weaker side's starting rating; ties by the
    stronger side, the earlier start, the id; at most 3; no floor (`featured.minRating` option built, off).
    Tournament is always empty in Season 0.
  - Logic in `server/src/ladder/featured.ts`; `LiveLadder.featured()`.
- **Viewer counts:** `LiveMatchView.viewers` = signed-in owners who read the match's feed (`GET /api/live/:id`) in
  the last 30 s, once each, players' owners included; reading the list doesn't count. In memory, dropped when the
  match is recorded. `server/src/ladder/viewers.ts`.
- **Evidence:** `progress/featured-viewers-001.txt` (`npm run demo:featured-viewers -w server`): 12 PASS, six real
  ladder rounds, the picks checked against the rule worked by hand, the counts checked every 10 s against who read.
  Tests: `server/test/featuredViewers.test.ts` (10).
- **Also:** OWNER_API.md says the two store coins are on sale (300 credits); notifications and the Stats data queued
  (roadmap 2d, 2e); the rolling queue on the roadmap for after Season 0.

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #130, was the render lane's). If this
PR is the last merged, the next session is **render** (the live arena reads the signature card in full and the live
boast, with the 2× controls, as the owner set; it can also show `featured` and `viewers` in Watch live).

The next **game-lane** session is **75, a HARDENING pass** (the last was 70). No new features: work down
`progress/quality-debt.md` (stale demos re-run, thin spots raised). Read owner-feedback.md first: the "Top rated"
calls may be answered (if so, apply them; a change is a few lines in `featured.ts` plus its tests and the demo).
After 75, the owner's order (2026-11-05):
1. **Notifications** (roadmap 2d): what produces one in Season 0 and how it is read and cleared; propose the list at
   a check-in if the 2026-10-05 spec doesn't settle it.
2. **The Stats page's data** (roadmap 2e).
3. The test-only Null deck-builder session (owner-approved, before the launch-gate re-run; see roadmap 2f and the
   2026-11-03 order: keep the designed list unless a start or search beats it by more than noise on the confirm step,
   measured on `builtDeckRing.ts` at every level in both modes against built-deck-ring-005; results to an owner
   check-in; ship nothing without the owner's OK).

**Blocked:** nothing.
