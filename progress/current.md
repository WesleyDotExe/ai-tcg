# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 8, a
normal (non-hardening) session. `progress/owner-feedback.md` had no new
unhandled entries. Followed `progress/roadmap.md`: with no CRITICAL
quality-debt item outstanding, worked item 1, the highest unfinished,
unblocked roadmap item — the fourth faction (Null, reserved in the
`Faction` type since stage 3 but never built).

## What stands (changes from this session; everything from sessions 1-7
## otherwise unchanged — see prior `progress/log.md` entries for that)

- **`engine/src/data/nullCards.ts`** (new) — the fourth faction, Null.
  14 unique cards / 34-card deck (`buildNullDeck` in `data/decks.ts`),
  built to the same board-development bar as Aegis: a 3-tier evolution
  line (Glitch Seed -> Corrupted Process -> Kernel Panic), two telegraphed
  threats (Fork Bomb, telegraph 1; Deprecated Routine, telegraph 2), and
  three Tools (Corruption Patch, Null Shell, Decay Ward). Faction identity
  is corruption/deletion/entropy (kernel panics, segfaults, fork bombs —
  cyberpunk + glitch-terminal register, per the standing flavour
  direction), and it introduces three mechanics no earlier card
  exercised: the `destroy` effect kind (unconditional removal, ignoring
  stats/Barrier — Kernel Panic's evolve payoff), a *negative* permanent
  `buff` (Deprecated Routine's -2/-2 decay debuff — every prior `buff`
  effect only ever added stats), and `controllerGraveyardSize` as a live
  scaling source for a unit's own stats (Entropy Harvester). Propagating
  Exploit is also new *shape*: a unit that permanently grows +1/+0 every
  time it attacks, with no existing precedent for uncapped permanent
  self-growth.
- **Architectural constraint discovered and worked around, not hit at
  runtime:** the pre-existing "triggered abilities can't use chosen
  targeting" gap (named in quality-debt.md since the priority rebuild)
  applies to evolve-in and telegraph-arm effects too — `evolveUnit` and
  `processTelegraphArming` never supply a `chosen` ref. Kernel Panic's
  destroy and Deprecated Routine's decay were both originally written
  with `scope: "chosen"` and had to be changed to `scope: "random"`
  before they'd work at all (caught by the whitebox tests below, not
  discovered by a future crash — see `engine/src/data/nullCards.ts`'s
  inline comments on both abilities for the reasoning).
- **`engine/test/nullFaction.test.ts`** (new, 5 tests) — proves each of
  the three new mechanics actually works: `destroy` kills a unit despite
  a +50 permanent health buff AND an active Barrier (bypasses both); the
  -2/-2 decay debuff lowers max health (not a disguised damage effect)
  and can finish off an already-damaged unit once max health drops below
  damage already taken; Fork Bomb's telegraph-arm AOE kills every enemy
  unit, not just one; Entropy Harvester's attack is recomputed live as
  the controller's graveyard grows; Propagating Exploit accumulates
  permanent attack across two separate turns' attacks.
- **`engine/src/dev/nullMatchDemo.ts`** (new) — found a real, unscripted
  match (seed 3) exercising Null's own telegraph-arm, full evolution
  chain (including the destroy effect actually killing an armed Aegis
  Latent Ward with no damage log preceding it — clean evidence it's
  `destroy`, not disguised damage), and tool attachment, committed as
  `progress/sample-match-008-null.txt`.
- **`engine/test/matchSmoke.test.ts`** extended with three more matchups
  (Cortex/Swarm/Aegis each vs Null) so the crash-safety smoke suite covers
  all six cross-faction pairings, not just the original three.
- **`engine/src/dev/balanceReport.ts`** extended to include Null in its
  faction list and deck-builder map — no logic changes, the script already
  generalizes over `FACTIONS`.
- **One real balance measurement + fix cycle**, same pattern session 7
  established: Null as first shipped beat ALL THREE other factions under
  BOTH agent policies (66-91% win rate) — a stronger dominance signal than
  session 7's Cortex fix. Root-caused to three specific stat/cost
  outliers (Fork Bomb's AOE damage, Null Shell's health bonus, Propagating
  Exploit's cost) versus the curve precedent the other three factions had
  already established, applied the fix, re-measured: two of the three
  double-flagged pairings dropped out (Cortex-vs-Null, Swarm-vs-Null).
  Aegis-vs-Null remains double-flagged (75-81%) — the fix didn't touch
  anything Aegis-specific. Full before/after: `progress/balance-report-
  002-null.txt`.

## Evidence committed

- `npm test` (engine): **34/34 vitest tests pass** (29 pre-existing + 5
  new), <1s.
- `npx tsc --noEmit` clean in all four packages (`engine`, `protocol`,
  `server`, `agents`).
- `progress/sample-match-008-null.txt` — a real, unscripted Null-vs-Aegis
  match (seed 3) where Null's telegraph, full evolution chain (with a
  clean `destroy` kill), and tool attachment all fire in genuine play.
- `progress/balance-report-002-null.txt` — the full before/after 300-seed
  measurement (both agent policies, all 3 Null cross-pairings + its
  mirror), with root-cause analysis and an honest read of what the fix
  does and doesn't prove.

## Decisions made this session the owner might want to overrule

- **Kernel Panic's and Deprecated Routine's targeting had to be changed
  from "chosen" to "random"** because of the pre-existing chosen-targeting
  gap on triggered abilities (see above) — this was a mechanical necessity,
  not a design preference; both cards would be more precise/strategic (and
  arguably a bit weaker per-copy, since a random pick isn't always the
  best pick) as "chosen" if that architectural gap is ever closed. Worth
  revisiting if/when that gap gets fixed generally.
- **Stopped after one measure-then-fix cycle again**, following the
  owner's explicit approval of that same choice for session 7
  (2026-09-15 entry in owner-feedback.md). Aegis-vs-Null (75-81%, the
  single worst pairing measured to date across both sessions) is left
  open rather than iterated on further this session.
- **Fork Bomb/Null Shell/Propagating Exploit were changed together in one
  pass**, same as session 7's Overload Capacitor/Interrupt Handler change
  — the report can't isolate which of the three contributed how much to
  the improvement.

## Concrete next step

No unhandled owner feedback remains. Per `progress/roadmap.md`, item 1
(fourth faction) is now done; the highest unfinished, unblocked item is
item 2 (non-engine test coverage: `server`/`protocol`/`agents` have had
zero automated tests since session 3) or item 3 (continue the balance
cycle, starting with Aegis-vs-Null specifically, per the "next step" note
at the end of `progress/balance-report-002-null.txt`). Either is
legitimate; whichever is picked, keep using `balanceReport.ts` for any
future balance change, not guesswork.
