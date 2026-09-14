# Current status

**Build-order stage: 3 (A real card set) — still current.** This session
was a scheduled HARDENING pass (session 5 — see TASKS.md's every-5th-session
rule), not a new stage. It answered the owner's 2026-09-13 stage-3
checkpoint feedback in full: a rule fix (no more same-turn play-and-evolve),
a per-card telegraph-timing trial, energy-model documentation, and —
the main deliverable — a real automated test runner, replacing the
hand-written demo-script verification that `quality-debt.md` had flagged
as overdue across three prior sessions.

## What stands (changes from this session; stage-3 content otherwise
## unchanged — see the prior entry in `progress/log.md` for that)

- **`engine/src/engine/moves.ts`** — evolution targeting now requires
  `u.enteredTurn < state.turnNumber`: a base must have survived to a turn
  later than the one it was played on before it's a legal evolve target.
  Closes the same-turn "commit hard" line the owner overruled.
- **`engine/src/data/aegisCards.ts`** — `Latent Ward`'s `telegraph` is now
  2 (was 1); `Perimeter Turret` stays at 1 — a real per-card mix, per the
  owner's request to try a longer fuse on some telegraph cards.
- **`DESIGN.md`** — new `## Resource model — energy (as built)` section,
  directly answering the owner's stage-3-checkpoint question about how the
  energy pool works (one collective pool per player, escalates and fully
  refills only on your own turn, no carryover, undifferentiated by speed).
- **`engine/test/`** (new) — the automated test runner. `vitest` is now an
  `engine` devDependency; `npm test` (repo root or `engine/`) runs it.
  - `helpers.ts` — shared whitebox setup (`emptyState`, `putUnit`,
    `drainStack`), factored out of the old demo script.
  - `effectSystem.test.ts` — 12 tests: every mechanic category DESIGN.md's
    "no shortcuts" section names (keywords, triggered, activated, static,
    AOE, conditional, state-mutating stats, cross-card cascade), plus the
    priority/stack algorithm (LIFO resolution, a real cross-turn
    instant-speed response, an instant-speed combat trick).
  - `boardDevelopment.test.ts` — 5 tests: telegraph dormancy+arming,
    evolution carry-forward, **the new same-turn-evolve restriction**
    (regression test for this session's rule fix), Tool attach (stat bonus
    + granted keyword + Barrier-grant), and the board-slot cap.
  - `matchSmoke.test.ts` — 3 tests: 15 seeds × 3 faction matchups
    (Cortex/Swarm/Aegis, all pairings), each asserting the match resolves
    to a winner/draw at or under the turn cap and never hits the engine's
    runaway-loop safety valve. Alternates which side plays Random vs
    Aggressive across seeds. This is the automated, always-run replacement
    for the 300-game manual stress run Session 4 described but never
    committed as a script.
  - `engine/src/dev/effectSystemDemo.ts` **retired** — its 16 scenarios are
    now the vitest tests above, individually reported instead of a
    printout. `engine/src/dev/aegisMatchDemo.ts` (real played-match
    evidence generator, not an assertion script) is unchanged and still
    the tool for that kind of evidence.
- **`progress/sample-match-005-boarddev-fixed.txt`** (new) — a fresh real
  match log (seed 4 of 500 searched, via the unchanged `aegisMatchDemo.ts`)
  regenerated with the same-turn-evolve fix in place: the evolved Aegis
  Cadet instance was played two turns before it evolves, while a
  same-turn, same-named Cadet instance that died in combat was correctly
  never offered as an evolve target. Also exercises both telegraph delays
  (1 and 2) in the same game. `progress/sample-match-004-boarddev.txt`
  (the original stage-3 evidence, which happens to show the now-illegal
  same-turn line) is annotated, not edited, to keep the historical record
  honest about what stage 3 actually shipped at the time.

## Evidence committed

- `npm test`: **20/20 vitest tests pass** (~650ms).
- `npx tsc --noEmit` clean in all four packages after every change.
- `progress/sample-match-005-boarddev-fixed.txt` — see above.
- Manual trace confirming the evolve-restriction regression test actually
  exercises the fix (verified against the pre-fix code path during
  development, not just that the post-fix test happens to pass).

## Decisions made this session the owner might want to overrule

- Same-turn evolve restriction is implemented as a strict turn-boundary
  check (`enteredTurn < turnNumber`), with no Rush-style keyword to bypass
  it (unlike attacking). If a future card wants a "can evolve immediately"
  exception, that would need a new keyword or a per-card flag — not built,
  since nothing asked for it yet.
- Telegraph delay=2 was tried on `Latent Ward` specifically (the bigger,
  board-wide-Barrier payoff of the two telegraphed Aegis units) rather
  than an arbitrary pick — a judgment call, not a coin flip, but still a
  first trial with no real playtesting behind the choice of *which* card.
- The old `effectSystemDemo.ts` was deleted outright rather than kept
  alongside the new vitest tests — judged that keeping both would create
  exactly the "two places to update" duplication-debt the test-runner
  request was trying to eliminate. If the owner specifically wants a
  human-readable narrated run (distinct from `npm test`'s pass/fail
  output) preserved as its own thing, that's recoverable from git history.
- `matchSmoke.test.ts` uses 15 seeds per matchup (45 total games) rather
  than the 300 games Session 4 ran manually, traded off for keeping
  `npm test` fast enough to run on every change rather than being its own
  separate slow step nobody runs. If deeper stress coverage is wanted, it
  should probably be a separate, explicitly-invoked script rather than
  folded into the default test run.

## Concrete next step

The owner-feedback entry this session answers is now fully HANDLED.
Per Session 4's own next-step note (still valid, un-acted-on), the next
non-hardening session should pick between:
1. **Backfill Cortex and/or Swarm** with a few telegraph/evolution/tool
   cards so the board-development system isn't Aegis-exclusive.
2. **Continue stage-3 width/depth** — a fourth faction, or a second
   evolution line / more telegraph-tool interactions within Aegis.

Either is legitimate; both should now come with real vitest coverage for
any new mechanic, not a new hand-written demo script — the infrastructure
exists, use it. Stage 4 (match server hardening) stays blocked until a
richer economy needs it, per DESIGN.md's build order.
