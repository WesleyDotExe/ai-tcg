# Current status

**Build-order stage: Stage 4+ (the living system). Session 55 (game lane): a HARDENING pass (every 5th
session). No new features. Nothing is blocking.** The owner's session-54 answers are handled: the
built-deck gate PASSED and stays a standing re-run; a test-only balance session for the two old
out-of-band edges is planned on `progress/roadmap.md`, before launch. One small [OWNER CHECK-IN] in
notes-for-owner.md (a rebuild waits for usable cards), default keep.

- **Rebuild requests now count only usable cards** (`economy/src/store.ts`
  `agentDeckRebuildReasons`, engine `playableHoldings`): the lock's faction and Neutral cards, each up
  to its deck limit. A locked owner opening 20 packs is asked to rebuild 3 times instead of 20
  (`progress/economy-demo-016.txt`, section 7). A test pins that the builder's decks are identical
  from the playable holdings and the whole holdings; decks saved before session 55 keep the old
  fingerprint ("p:" marks the new one) until their next rebuild.
- **The builder's deck-rule constants come from the engine's rule files** (no copies left).
- **Reports re-run with the fixed builder:** `progress/deckbuilder-report-002.txt`,
  `progress/deckbuilder-styles-report-003.txt` (+ `progress/deckbuilder-styles/s55/`). Only Null
  changed; the built Null deck is level with the padded one within noise.

## What stands (this session's work; sessions 1-54 otherwise unchanged)

- Tests: +2 engine deck-builder tests, +4 economy tests (one older test tightened). `npm test`: all six
  workspaces pass (1,089). Typecheck clean everywhere. `ring` and `ring:real`: PASS. Mutation checks:
  removing the deck-limit cap fails 3 tests; reverting to the old fingerprint fails 4.

## Concrete next step

Check the alternation first: if the last merged PR is this one (game lane), the next session is
**render** (the boast's "<AGENT> WINS" message and Match Boot slice 2, per the owner's 2026-10-21
entry).

The next **game-lane** session (session 56):
1. The owner's word on the rebuild check-in, if any (default: keep).
2. Roadmap 2b step 3: expose the deck settings (deck choice, faction lock, play style, rebuild
   reasons, "rebuild now") as server endpoints, item 3 on the roadmap, with tests through the server.
3. Before launch, not necessarily next: the test-only balance session (roadmap, "Standing: a
   test-only balance session before launch").

**Blocked:** nothing.
