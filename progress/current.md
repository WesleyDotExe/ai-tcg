# Current status

**Build-order stage: Stage 4+ (the living system). Session 57 (game lane): the owner's deck-size question
answered, test only. Nothing is blocking.** The owner's session-56 answers (keep all 4) are noted. One
[OWNER CHECK-IN] in notes-for-owner.md: deck size (recommend exactly 40; default no change).

- **The deck-size check** (`engine/src/dev/deckSizeCheck.ts`, `economy/src/dev/deckSizeHoldings.ts`,
  report `progress/deck-size-report-001.txt`, data `progress/deck-size/`): the rule is 20-40
  (`engine/src/data/decks.ts`). The demo's 26-card Null deck is the owner's cards running out (27 usable)
  plus one cut by the search. Same cards at the same proportions, 20 cards beat 40 by +2.6 to +5.3 points
  in every faction, because a match ends before a short deck runs out. The builder drifts only 1-5 cards
  under 40 when it could reach 40.
- No card, deck, rule or builder behaviour changed. One helper (`drawsCards`) is newly exported from
  the builder for the study.

## What stands (this session's work; sessions 1-56 otherwise unchanged)

- Tests: +12 engine unit tests (`deckSizeCheck.test.ts`) and a driver smoke test (`devDrivers.test.ts`).
  `npm test`: all six workspaces pass. Typecheck clean.

## Concrete next step

Check the alternation first: if the last merged PR is this one (game lane), the next session is
**render** (whatever the render lane's own notes set after Match Boot slice 2).

The next **game-lane** session (session 58):
1. The owner's word on the deck-size check-in. If A (exactly 40) or B (40 when the owner holds 40
   usable cards): build it (rule in `data/decks.ts` or the store, the builder's size moves, the store's
   checks, tests), re-run `ring`/`ring:real` and the built-deck ring, and bring Null's 36 -> 40
   candidates to the test-only balance session. If no answer: no change.
2. Otherwise roadmap item 3 continued, as session 56 set it: wallet and collection endpoints (balance,
   ledger, copies, the binder), then packs and pack opening. Rules in the store, tests through HTTP, a
   demo.
3. Small debt worth folding in: the play-style ownership check into the store; a cap/queue on
   concurrent rebuild workers.
4. Session 60 is the next hardening pass (every 5th; 55 was the last).

**Blocked:** nothing.
