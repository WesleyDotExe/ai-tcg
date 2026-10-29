# Current status

**Build-order stage: Stage 4+ (the living system). Session 59 (game lane): the pre-launch test-only
balance session, job 1: candidates for Null's 4 added cards (36 -> 40), measured. Nothing is
blocking.** One [OWNER CHECK-IN] in notes-for-owner.md: which 4 cards (recommend set A: +1 Fork Bomb,
+1 Segfault Handler, +2 Rollback Point; alternatives D, C, none yet). No card changed.

- **Tools:** `engine/src/dev/nullFortySearch.ts` (search / heldout / pool / built) and
  `progress/null-forty/run-candidate.sh` (the built-deck ring for one candidate, on a throwaway git
  worktree with `NULL_CARDS` patched, so the starter, the designed start, the shipped opponent and the
  cost curve all see the 40; about 6 minutes on 4 cores).
- **Evidence:** `progress/balance-report-035-null-forty.txt`, `progress/null-forty/`. Shipped ring: 4
  more cards cost Null nothing measurable; every 40 takes gate Swarm > Null out of IN BAND (the ring
  check fails until re-baselined). Built-deck ring: every candidate beats today's rating fill; A brings
  the field spread back to session 54's (real 5.9 vs 6.0; today 13.4).

## What stands (this session's work; sessions 1-58 otherwise unchanged)

- Tests: engine `nullFortySearch.test.ts` (4: candidates are Null/neutral and never Zero-Day; adds are
  exact and don't touch the shipped list; deck rules incl. removal fitting only at 40; the measure step
  plays Null's three edges in both modes). `npm test`: all six workspaces pass. Typecheck clean.

## Concrete next step

Check the alternation first: if the last merged PR is this one (game lane), the next session is
**render** (the CI-sized headless-browser check the owner OK'd on 2026-10-29, with the longer
auto-merge wait).

The next **game-lane** session (session 60) is the **hardening pass** (every 5th; 55 was the last):
1. Read the owner's word on the session-59 check-in. If they OK a set: ship it in that session as the
   one allowed change (it's owner-approved, so it isn't "new width"): `NULL_CARDS` to 40, re-record
   `ringBaseline.json` and `ringBaselineReal.json` with `--write-baseline` (commit beside a short note
   pointing at balance-report-035), run `ring`/`ring:real`, re-run the built-deck ring on the shipped
   list (`builtDeckRing.ts`, collections regenerated since the Null starter changes), update the tests
   that pin Null's size at 36 (`grep -rn "36" engine/test economy/test` for Null).
2. Hardening work from quality-debt.md: the play-style ownership check into the store; a cap/queue on
   concurrent rebuild workers; re-run economy-demo-014/016; measure how much one full-collection build
   swings by search seed alone (the "full" column's noise).
3. Session 61 (game lane): the balance session's second job, the two old edges (Null > Aegis inverted,
   Cortex > Swarm under band): one or two candidate card fixes each, on both rings at every level
   (run-candidate.sh can be generalised to patch any faction's list), results to an owner check-in.

**Blocked:** nothing.
