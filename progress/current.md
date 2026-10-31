# Current status

**Build-order stage: Stage 4+ (the living system). Session 61 (game lane): the balance session's job 2,
the two old edges, test only. Nothing is blocking.** One [OWNER CHECK-IN] in notes-for-owner.md: ship NA12
(a partial fix for Null > Aegis)? ship CS7 (fixes Cortex > Swarm in real matches, overshoots the gate)? both?

- **Null > Aegis:** not fixed. Best candidate NA12 (Null Pointer becomes "choose one": destroy target enemy
  directive, or target enemy unit gets -3/-3 permanently): real 45.9 -> 50.3 on shipped decks, +3.2 to +4.1 at
  the pack levels, gate 51.6 -> 56.3; Swarm > Null -1.0. Nothing from a full collection (3 search seeds).
- **Cortex > Swarm:** CS7 (Force Quit becomes "choose one": destroy target enemy directive, or deal 1 damage to
  all enemy units): real 53.0 -> 55.0, 56.2-56.8 at 37/17 packs; gate overshoots to 61-63.
- **Why those cards:** a one-copy ablation of all 89 shipped cards. Aegis's cards carry it equally vs Null and
  vs Cortex (no clean Aegis trim exists); Null Pointer and Force Quit are dead cards in exactly the off matchups.
- **Evidence:** `progress/balance-report-037-old-edges.txt`, `progress/old-edges/` (screen, ablation, mode use,
  built-deck runs, full-column seeds).

## What stands (this session's work; sessions 1-60 otherwise unchanged)

- `engine/src/dev/oldEdgesCandidates.ts` (21 candidate errata, `applyCandidate`, "A+B" pairs) and
  `engine/src/dev/oldEdgesScreen.ts` (run / report / ablation / modes / side). Test:
  `engine/test/oldEdgesCandidates.test.ts` (5 tests, mutation-checked).
- `progress/old-edges/run-candidate.sh`: the worktree runner for any erratum on any faction, with a stop-check
  that fails unless the economy sees changed cards; `LEVELS=full BUILD_ARGS="--search-seed N"` for the
  full-column noise check.
- No card, deck, rule or baseline changed. `npm run ring` / `ring:real` PASS unchanged. `npm test`: all six
  workspaces pass (engine 332, economy 156, render 662). Typecheck clean.

## Concrete next step

Check the alternation first: the last merged PR before this one was the render lane's (#104), so this was the
game lane; if this PR is the last merged, the next session is **render** ("tap to skip" hint, as the owner set).

The next **game-lane** session (62):
1. If the owner answered the check-in with "ship": apply the chosen errata to the real card files
   (`nullCards.ts` Null Pointer modes; `cards.ts` Force Quit modes), write tests for the new modes, re-record
   `ringBaseline.json` and `ringBaselineReal.json` with the report as justification, re-run `ring`, `ring:real`
   and the built-deck ring (`builtDeckRing.ts`, the result must match `progress/old-edges/built-<key>/`), and
   regenerate the render replays and recorded scenarios that change (as session 60 did for set A).
2. If no answer: the hardening list. Re-run economy demos 014/016 (still owed since option B and set A);
   `builtDeckRing.ts` averaging several search seeds at full (built twice now by hand).

**Blocked:** nothing.
