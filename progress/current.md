# Current status

**Build-order stage: 3 (A real card set), still current, inside Phase 5
(pool expansion).** Session 23 was a balance session. Under the alternation
rule (owner-feedback.md, 2026-09-24), the last merged PR (#30) was a render
slice. The owner's revised Phase 5 order (2026-09-26 "session 22
confirmations", item 2) is: (i) Null consistency trim, (ii) neutral pool,
(iii) mandatory 900-seed full-ring re-measure. Step (i) is what shipped.

## What stands (this session's work; sessions 1-22 otherwise unchanged)

**Null deck trimmed 40 -> 36** (`engine/src/data/nullCards.ts`): Decay
Ward 2->1, Fork Bomb 3->2, Null Shell 3->1. All 20 unique cards kept;
Kernel Panic kept at 2. No card's stats changed. Removal/debuff density is
9/36 = 25.0%, exactly at the lint cap. A further non-removal Null cut now
needs a matching removal cut.

**Measured (LookaheadAgent is the arbiter), Null's win rate:**

| Edge | pre-trim (1-900) | shipped (1-900) | held-out change (901-4500) | band |
|---|---|---|---|---|
| vs Cortex | 38.9 | 41.1 | about +4.0 | 45-55 |
| vs Swarm | 36.6 | 41.7 | about +3.7 | 40-45 |
| vs Aegis | 37.3 | 39.6 | about +3.6 | 55-60 |

Kernel Panic played in ~7.5% -> ~10% of Null's games. Lookahead >=60%
flags on Null pairings 3 -> 1. No triple-flag. New side effect: under Random,
Null beats Swarm 64.3%, which is discounted under the arbiter rule. Null is still
the weakest faction, and Null > Aegis is still inverted.

**Instruments:**
- `engine/src/dev/edgeMeasure.ts`: the shared Lookahead edge loop, plus
  Wilson/Newcombe intervals and the owner's CI band verdict.
  `lookaheadEdgeCheck.ts` now prints a CI and a verdict for each edge.
- `engine/src/dev/nullTrimSearch.ts`: greedy ablation search with held-out
  check. Three variants: the shipped one, singleton cuts allowed, and
  unconstrained.
- `engine/src/dev/nullTrimMatchDemo.ts`: real-play evidence.

**Engine fix:** `effects/resolver.ts` no longer logs `attackRedirected`
for a redirect onto the attack's existing target; it logs a fizzle.
This was a real render test failure the new deck surfaced. There's no
balance effect: the 900-seed report is identical before and after.

## Evidence committed

- `progress/balance-report-017-null-trim.txt`: headline, 900-seed
  three-policy before/after, all three search transcripts, noise findings,
  and the full shipped report.
- `progress/sample-match-024-null-trim.txt`: 36-card Null vs Aegis. Kernel
  Panic evolves in 13/200 games, and the full log of seed 4 is a Kernel Panic
  win.
- Tests: `engine/test/edgeMeasure.test.ts` (4, stats against published
  values), a regression test in `aegisInteraction.test.ts`, and the pool test
  updated to 36 cards. `npm test`: 262/262 across all five workspaces
  (engine 110). `tsc --noEmit` clean in all five.

## Concrete next step

Next session is a **render** slice, per the alternation rule. Its queue is
the owner's 2026-09-27 render entry: broaden the cast stagger to all
responses, and fixed-slot board layout as the next render infrastructure
priority, sequenced against EFFECTS.md slice 5.

The next balance session does step (ii), **the neutral pool** (roadmap item
10). Then comes step (iii), the 900-seed gate. Before the gate, read
notes-for-owner.md items 2 and 4: whether to take the bigger Null lift
(variant B), and whether the gate's Lookahead side should run at ~2,500 seeds
so 5-point bands can come back IN under the CI rule. Measure with
`lookaheadEdgeCheck.ts <Faction> 1 900` (it now prints verdicts), and
`balanceReport.ts 900`.
