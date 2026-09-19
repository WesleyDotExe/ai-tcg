# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 11.
The one unhandled `progress/owner-feedback.md` entry (2026-09-19: give
Aegis defensive interaction, not removal, and re-measure against all four
factions; close the chosen-targeting gap and revert Kernel Panic/Deprecated
Routine to chosen, re-measure) was worked exactly as directed, in the order
the entry specified. No CRITICAL quality-debt item was outstanding.

## What stands (changes from this session; everything from sessions 1-10
## otherwise unchanged — see prior `progress/log.md` entries for that)

**The chosen-targeting architectural gap is closed, generally, not just for
these two cards.** `engine/moves.ts`'s evolution branch now enumerates an
evolved form's own "chosen" onPlay target alongside which base is evolving
(`Move.abilityTarget`); `engine.ts`'s `evolveUnit` threads it through. A
telegraphed unit's deferred arm-time ability captures its chosen target at
*play* time (there's no agent decision point left once it actually arms,
turns later) on the new `UnitInstance.armChosenTarget` field, which
`processTelegraphArming` replays. `resolveAbility` gracefully skips a
"chosen"-scope ability fired with no target (no legal target existed) rather
than throwing, which is what keeps evolving legal even when the bonus
ability has nothing to hit. Kernel Panic and Deprecated Routine (Null) are
back to `scope: "chosen"`, as both were originally written before this gap
forced them to "random." Proven with dedicated tests where two eligible
targets exist and the controller provably picks one
(`engine/test/nullFaction.test.ts`) and in real unscripted play
(`progress/sample-match-011-chosen-targeting.txt`).

**Three new Aegis defensive-interaction cards** (`data/aegisCards.ts`),
each a different non-removal mechanic per the owner's list: **Intercept
Routine** (Instant Command, cost 1) — a new generic `redirectAttack` effect
kind that retargets the nearest pending combat-damage stack item onto a
unit you control, the "intercepting/redirecting attacks" answer, built
directly on the existing priority/stack system. **Tariff Field** (Directive,
cost 3) — a new generic `cardCostModifier` static-effect kind that taxes
the opponent's card-play cost by 1, the "taxing" answer
(`state/queries.ts`'s `effectiveCardCost`, now the single choke point both
`moves.ts`'s legality check and `engine.ts`'s energy deduction go through).
**Feedback Plating** (Unit, 1/4, cost 2) — onDamaged, blunts the whole
enemy board's attack by 1 until end of turn, the "blunting" answer. None
destroy or remove anything. Unit-tested individually
(`engine/test/aegisInteraction.test.ts`, 4 tests) and each proven firing in
a real unscripted match (`progress/sample-match-010-aegis-interception.txt`).

**Honest result on the actual goal (fixing Aegis-vs-Null): it did NOT
work, and a first attempt made things measurably worse.** A first version
(2 copies of each new card) measured clearly WORSE than the pre-session
baseline across every Aegis matchup when run through the full
`balanceReport.ts` (300 seeds/matchup, both agent policies) — not shipped.
Investigated rather than guessed at a fix: isolated that the
chosen-targeting revert isn't the cause (mildly positive for Aegis on its
own); decomposed the three cards individually (each measures
neutral-to-positive alone) and in combination (every combination measures
worse, non-monotonically — read as small-sample noise from full-deck
reshuffling, not a clean single-card diagnosis). Shipped a smaller dose (1
copy of each) and re-measured with the full instrument: Aegis-vs-Null
remains double-flagged, roughly at the pre-session baseline (79.3%/83.0%
vs. 74.7%/79.0% going in). **Per the owner's own explicit instruction, this
is left flagged rather than adding removal or guessing further.** One real
improvement: Swarm-vs-Aegis, double-flagged going in, is no longer
double-flagged. Cortex-vs-Aegis got mildly worse (now double-flagged, was
Aggressive-only). Full numbers and reasoning:
`progress/balance-report-004-aegis-defense.txt`.

A structural finding worth the owner's attention (flagged in
`progress/notes-for-owner.md`, not acted on unilaterally): the regression in
the first attempt traces most plausibly to `AggressiveAgent`'s
already-documented "no sense of whether a card is useful right now"
heuristic gap — a reactive/utility card with zero immediate board impact
sometimes wins its "play the biggest affordable card" slot over a real
tempo play. This suggests the dummy-agent balance-measurement method may
structurally undervalue exactly the skill-expressive, situational cards
design principle 3 asks for more of.

## Evidence committed

- `progress/balance-report-004-aegis-defense.txt` — the full journey: the
  isolated chosen-targeting-only measurement, the first (unshipped, worse)
  2-copy attempt, the decomposition experiments, and the final shipped
  1-copy measurement, all with real numbers.
- `progress/sample-match-010-aegis-interception.txt` — a real match where
  Intercept Routine redirects an attack away from a player's face onto a
  unit, and Feedback Plating's blunt fires from real combat.
- `progress/sample-match-011-chosen-targeting.txt` — a real match where
  Kernel Panic evolves in and its now-chosen-target destroy kills the
  eligible enemy unit, in unscripted AggressiveAgent-vs-RandomAgent play.
- `engine/test/aegisInteraction.test.ts` (4 new tests) and
  `engine/test/nullFaction.test.ts` (2 new tests, 2 rewritten to route
  through `getLegalMoves` and assert specific chosen targets instead of
  hand-crafted moves that no longer reflect real play).
- `npm test` (root, all four workspaces): **89/89 tests pass** (42 engine +
  7 protocol + 23 server + 17 agents).
- `npx tsc --noEmit` clean in all four packages.

## Decisions made this session the owner might want to overrule

- **Shipped 1 copy each of the three new Aegis cards, not 2** — a
  defensively-chosen number to limit the dilution/misplay exposure found
  in the first attempt, not a playtested target. See quality-debt.md.
- **Left Aegis-vs-Null flagged rather than continuing to iterate**, per the
  owner's own explicit instruction, after three full 300-seed/both-policy
  measurements and a decomposition pass. If the owner wants this pairing
  pursued further immediately, say so in `owner-feedback.md`.
- **Did not attempt to fix `AggressiveAgent`'s heuristic gap this session**,
  even though it's the most likely explanation for the measured regression
  — named as a structural question for the owner rather than treated as
  obviously in-scope for "give Aegis defensive interaction."

## Concrete next step

Per `progress/roadmap.md` item 3, still open: the single-flagged
Cortex-vs-Swarm pairing, and Null's remaining edge over Cortex/Swarm under
Random play. Before picking Aegis-vs-Null back up, read
`progress/balance-report-004-aegis-defense.txt` and
`progress/notes-for-owner.md`'s open question. Roadmap item 4 (card-pool
depth) is the other unblocked option once the owner has had a chance to
weigh in on the structural measurement question, per this project's
"flag, then continue" checkpoint model — nothing here blocks starting it.
