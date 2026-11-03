# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 72 (game lane) shipped the live-feed asks
(the opening hands, the signature card in full, each side's faction, the boast on the live view). Nothing is
blocking. No [OWNER CHECK-IN] is open (the session-71 one was answered 2026-11-03); three small keep-or-change calls
are at the top of notes-for-owner.md, and nothing waits on them.**

- **What `GET /api/live` and `GET /api/live/:id` now send** (`server/OWNER_API.md`, Watch live):
  - `openingHands: { p1, p2 }` beside `start` (from=0 only): each side's opening hand by card id in hand order.
    Recorded by the timeline (`Timeline.openingHands`, `server/src/ladder/timeline.ts`), sent by `LiveLadder`
    because every match it shows is decided in the engine first. The safety rule for real-time network agents
    (no hands, no card in draws until the end) is still to build when they join the ladder.
  - `PublicSide.signature` is the card in full (`PublicSignature`: cardId, name, cost, attack, health, keywords,
    rulesText, art, flavor, timesPlayed, inZone, nextCost, played), on every snapshot.
  - `LiveSideView.faction`: the faction of the deck the side plays (`deckFaction` on the dealt deck).
  - `LiveMatchView.boast`: null until the last move is out, then the store's own `matchBoast` (made public from
    `chooseBoast`) on the match's starting loadout and deck: the boast the record keeps.
- **Evidence:** `progress/live-feed-asks-001.txt` (`npm run demo:live-feed-asks -w server`): six matches over three
  rounds watched through the HTTP feed alone; 67 PASS. Hands rebuilt from the feed match the count after every move;
  every signature play cost the feed's `nextCost` (5, then 7 and 9 on replays); every live boast equals the
  recorded match's. Tests: `server/test/liveFeedAsks.test.ts` (6), plus the HTTP check in `ownerApiMatches.test.ts`.
- **Watch time:** the owner accepted a 6-7 minute median (2026-11-03). `WATCH_PACE_MS` stays. Report at a check-in
  if the median moves well past 7 minutes.

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #126, was the render lane's). If this
PR is the last merged, the next session is **render** (its hardening pass, then the second coin slice, as the owner
set on 2026-11-03).

The next **game-lane** session is **73**. Read owner-feedback.md first. Unless it says otherwise, the owner's
order (2026-11-03, "Game-lane order from here"):
1. The Season 0 live features: the 2x vote (both owners agree, for live play), featured picks (bring the "Top
   rated" rule to a check-in) and viewer counts, in `server/OWNER_API.md` with tests. The 2x vote first: it is
   the one with a rule (both owners must agree; speed changes only the pace, never the match, `stepHoldMs`).
2. The test-only Null deck-builder session (owner-approved item 1): keep the designed list unless a start or
   search beats it by more than noise on the confirm step, measured on `builtDeckRing.ts` at every level in both
   modes against built-deck-ring-005; results to an owner check-in; ship nothing without the owner's OK. It must
   land before the launch-gate re-run.
3. When the render lane's second coin slice lands: `economy/test/cosmetics.test.ts` checks coins against the
   render's `COIN_SPECS`.
Session 75 is the next hardening pass (the last was 70).

**Blocked:** nothing.
