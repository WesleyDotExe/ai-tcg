# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 71 (game lane) shipped the 24-health rule
as `rules-2`. Nothing is blocking. One [OWNER CHECK-IN] is open (the shipped numbers, before the launch-gate
re-run; seven calls with recommendations at the top of notes-for-owner.md); nothing waits on it.**

- **The rule** (owner 2026-11-02): "The player going second starts with 24 health; the player going first starts
  with 20 and skips its first draw." It is the engine's base (`SECOND_SEAT_EXTRA_HEALTH`, `engine/src/state/
  types.ts`), so every match anywhere plays it. `RULES_VERSIONS` (`engine/src/engine/versions.ts`): `rules-1`
  names its 20 and 20 explicitly; `rules-2` is current. Every rules-1 replay (the four golden files) rebuilds byte
  for byte; two rules-2 golden files added (`server/test/fixtures/replays/r2-*`).
- **Session 68's other seat variants are gone** from the engine; `seatVariants.ts` is `shipped` and `rules-1`.
  Measuring replays name every rule field or are refused.
- **The numbers** (owner check-in): first seat 53.6% on the ladder (was 63.8%), 54.4% in mirrors (was 64.4%),
  `progress/first-seat-003-rules-2.txt`. Ring and ring:real PASS; new baselines in all three modes. Built-deck
  ring `progress/built-deck-ring-005.txt`: real mode 3 in / 7 out (was 5 / 5), nearly all from the
  full-collection Null deck the builder now picks (noise check `progress/rules-2-ship/null-noise/README.txt`:
  every search seed's pick is worse than the designed list). Watch time median 6.7 min (was 5.9).

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #124, was the render lane's). If this
PR is the last merged, the next session is **render** (its next slice per its own plan: hands live with the first
coin slice, then its hardening pass).

The next **game-lane** session is **72**. First read the owner's answers to the session-71 check-in. Unless they
say otherwise:
1. If the owner takes call 1's recommendation (or hasn't answered): a test-only builder session for the
   full-collection Null deck: keep the designed list unless a start or search beats it by more than noise on
   the confirm step (say a Wilson interval on the difference), measured on `builtDeckRing.ts` at every level in
   both modes, against built-deck-ring-005. Ship only with the owner's OK.
2. If the owner takes call 2: `WATCH_PACE_MS.action` 6000 -> about 5400 (`server/src/ladder/timeline.ts`), re-run
   `npm run demo:live-ladder -w server` and check the median is back near 6 minutes.
3. Then the queued small asks in order: the 2x vote, featured picks (the "Top rated" rule to a check-in), viewer
   counts, the three render-51 live-feed asks (the signature card in `PublicSide.signature`, `LiveSideView.faction`,
   the boast on the live view).
The launch-gate re-run (the built-deck ring, the last session before launch) comes after the builder answer.

**Blocked:** nothing.
