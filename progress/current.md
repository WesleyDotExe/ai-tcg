# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 73 (game lane) shipped the 2× vote. Nothing
is blocking. No [OWNER CHECK-IN] is open; four small keep-or-change calls are at the top of notes-for-owner.md, and
nothing waits on them.**

- **The 2× vote** (owner app spec 2026-10-05 D; `server/OWNER_API.md`, Watch live):
  - `PUT /api/live/:matchId/speed { ask: true | false }`: "Ask for 2×", or take it back. Only the match's two owners
    vote (403 otherwise; 409 for a house account; 404 when not live).
  - `LiveMatchView.speed: { rate, asks, house, waitingOn }`; `nextAt` is at the current pace.
  - `ask2xEveryMatch` in the account settings (schema v21) asks as each match starts.
  - 2× only while both sides agree; a house side agrees to its player opponent; house against house stays 1×. The
    vote resets every match. A change mid-hold rescales only what is left of it.
  - Logic in `server/src/ladder/speedVote.ts`, pacing in `LiveLadder` (`release`, `askForSpeed`).
- **Evidence:** `progress/speed-vote-001.txt` (`npm run demo:speed-vote -w server`): 20 PASS; eleven matches at 2×
  against the same seeds at 1×: the same record, log and replay, half the watch time. Tests:
  `server/test/speedVote.test.ts` (13), `economy/test/accountSettings.test.ts` (2 new).

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #128, was the render lane's). If this
PR is the last merged, the next session is **render** (the second coin slice, then the live arena reading the
signature card and the live boast, as the owner set on 2026-11-03; it can also read `speed.rate` to run its
animations at 2× and wire "Ask for 2×").

The next **game-lane** session is **74**. Read owner-feedback.md first (the four 2× calls may be answered). Unless it
says otherwise, the owner's order (2026-11-03, "Game-lane order from here"):
1. The rest of the Season 0 live features: **featured picks** (who is "Top rated" in Watch live: propose the rule
   at an [OWNER CHECK-IN]; the 2026-10-05 spec's open rules) and **viewer counts** (how many are watching each live
   match: needs a notion of "watching", e.g. a feed fetched in the last N seconds per signed-in owner), in
   `server/OWNER_API.md` with tests.
2. The test-only Null deck-builder session (owner-approved): keep the designed list unless a start or search beats
   it by more than noise on the confirm step, measured on `builtDeckRing.ts` at every level in both modes against
   built-deck-ring-005; results to an owner check-in; ship nothing without the owner's OK. It must land before the
   launch-gate re-run.
3. When the render lane's second coin slice lands: `economy/test/cosmetics.test.ts` checks coins against the
   render's `COIN_SPECS`.
Session 75 is the next hardening pass (the last was 70).

**Blocked:** nothing.
