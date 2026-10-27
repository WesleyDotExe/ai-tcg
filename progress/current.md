# Current status

**Build-order stage: Stage 4+ (the living system). Session 58 (game lane): the owner's option B for
deck size, built; both rings re-run. Nothing is blocking.** One [OWNER CHECK-IN] in
notes-for-owner.md: without short decks Null falls behind (default: keep B, run the balance session
next with Null's 4 added cards first).

- **Option B** (`engine/src/deckbuilder/deckBuilder.ts`): `largestDeck(faction, holdings)` is the
  largest legal deck the owned cards allow, capped at 40. Both starts (rating and designed) are built
  to exactly that size, with a neutral-removal swap so the greedy fill can reach it; the search only
  swaps cards. The legal range is unchanged (20-40). The store (`economy/src/store.ts`) refuses an
  agent deck of any other size and names an older short agent deck as a rebuild reason.
- **Evidence:** `progress/built-deck-ring-002.txt` (+ `progress/built-deck-ring-002/`): 0 of 100
  built decks short (was 49); `ring`/`ring:real` PASS unchanged; Null's average against the field drops
  to 37.8-44.7 (was 44.7-48.7), Null ~ Cortex OUT at several levels. `progress/owner-api-demo-002.txt`:
  the Null-locked owner's deck is 27 cards (was 26).

## What stands (this session's work; sessions 1-57 otherwise unchanged)

- Tests: engine `deckBuilder.test.ts` (largestDeck: full/starter/demo sizes, both starts reach it over
  ~600 collections, one more copy always breaks a rule, the search only swaps; the designed-start
  tests rewritten for option B), economy `agentDeckStyle.test.ts` (+2: a short chooser is refused,
  an old short deck asks for a rebuild). `npm test`: all six workspaces pass. Typecheck clean.

## Concrete next step

Check the alternation first: if the last merged PR is this one (game lane), the next session is
**render** (whatever the render lane's own notes set after its session 39).

The next **game-lane** session (session 59):
1. Read the owner's word on the session-58 check-in. Unless they say otherwise (B2: let Null keep its
   36-card designed list for now), start the **pre-launch test-only balance session**
   (`progress/roadmap.md`, "Standing: a test-only balance session before launch"), first job **Null's
   4 added cards**: candidate sets of 4 measured with the shipped Null list at 40 on `ring`/`ring:real`
   AND on the built-deck ring at every level (`builtDeckRing.ts`, about 15 minutes on 4 cores; see
   built-deck-ring-002.txt for the commands' inputs). Then the two old edges. No card change without
   the owner's OK: bring results to a check-in.
2. Session 60 is the next hardening pass (every 5th; 55 was the last). If 59 is the balance session,
   60 hardens.
3. Small debt worth folding in: the play-style ownership check into the store; a cap/queue on
   concurrent rebuild workers; re-run economy-demo-014/016 (built decks changed size).

**Blocked:** nothing.
