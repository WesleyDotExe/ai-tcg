# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 16.

The 2026-09-20 owner-feedback entry ("balance is a systems problem; fix the
loop, then expand the pool") lays out six phases, explicit order, each done
before the next. Session 12 did Phase 1. Sessions 13-14 did Phase 2 in
full. Session 15 did Phase 3 (the load-time pool lint). **This session did
Phase 4 — propose the intended counter triangle, then measure the real pool
against it — plus 3 of the 4 steps in the pre-authorized Null backstop the
2026-09-20 entry's re-measurement condition unlocked.**

## What stands (this session's work — everything from sessions 1-15
## otherwise unchanged, see prior `progress/log.md` entries)

**The counter triangle, proposed and measured.** Adopted the owner's own
2026-09-20 example (Null attrition beats Aegis stacking; Aegis walls beat
Swarm width; Swarm width beats Null's single-target removal; Cortex
flexible in the middle) and translated its 55-60%/45-55% targets onto each
of the six cross-faction pairings. Measured the real pool (as it stood at
the start of this session, identical to `balance-report-009`) against it:
**none of the six pairings meet the triangle.** Two distinct problems:
Cortex is too strong (triple-flagged vs Swarm, Aggressive-flagged vs
Aegis) rather than flexible; and Null's side of the cycle is backwards on
one edge (Swarm should beat Null, loses to it 55-81%) and overshoots on the
other (should beat Aegis 55-60%, wins by up to 78%). Full table and
reasoning: `progress/balance-report-010-phase4-triangle.txt` Parts 1-2.

**The pre-authorized Null backstop — 3 of 4 steps executed, honestly
small effect.** The 2026-09-20 "Null dominance" entry pre-authorizes
nerfing Null's abilities, in a specific priority order, once it's winning
60%+ against any faction under all three policies — already true for
Aegis-vs-Null going into this session, so this was executed without a new
ask:

1. **Segmentation Fault redesigned from an unconditional permanent aura to
   a conditional one** ("While you control 2 or more units, enemy units get
   -1/-0"). Needed one small, genuinely generic engine addition:
   `effects/statics.ts`'s `staticModifiersFor` now reads `Ability.condition`
   for the `"static"` trigger (it already existed for
   onPlay/activated/etc., just was never wired up for statics). Real,
   unscripted-play evidence the toggle fires both ways:
   `progress/sample-match-017-segfault-condition.txt`.
2. **Corrupted Process cut 3 -> 2 copies** (the card the 2026-09-22
   owner-feedback entry itself named as fair game). Fork Bomb was NOT also
   cut — the pool was sitting exactly at the Phase 3 lint's 25%
   removal/debuff cap, and Null Shell (the only card anywhere in the pool
   under its rarity's copy cap) absorbed the one backfill this required;
   that headroom is now used up.
3. **Entropy Harvester's scaling source changed from the controller's own
   graveyard to the opponent's** (new generic `opponentGraveyardSize`
   `ScalingSource`, added to `cards/types.ts`/`effects/scaling.ts`/
   `agents/lookaheadAgent.ts` — both graveyards are public zones, no new
   redaction work needed).

Measured after each step. Cumulative result: Aegis-vs-Null moved from
78.3%/78.3%/67.7% to 78.0%/72.0%/67.7% (Aggressive/Random/Lookahead) — a
real drop under Random, essentially flat under the other two. **Both
Aegis-vs-Null and Cortex-vs-Swarm remain triple-flagged after this
session.** Step 4 (cost increases) was named but not attempted — the two
outlier cards (Kernel Panic, Null Singularity) already cost exactly what
their faction-mirror equivalents cost, so raising them further is a
cross-faction curve decision flagged to the owner rather than made
unilaterally. Cortex-vs-Swarm has no pre-authorized fix mechanism and was
measured, not touched. See `progress/checkpoints.md`'s new Phase 4 entry
and `progress/notes-for-owner.md` for the specific steers requested.

## Evidence committed

- `progress/balance-report-010-phase4-triangle.txt` — the triangle
  proposal, the before/after measurement through all 3 backstop steps, and
  the full final 300-seed/3-policy raw report.
- `progress/sample-match-017-segfault-condition.txt` — a real, unscripted
  LookaheadAgent-vs-LookaheadAgent match (seed 31, Null vs Cortex) where
  Segmentation Fault's aura is observed toggling INACTIVE (Null at 1 unit)
  then ACTIVE (Null back at 2 units), with the affected enemy unit's live
  attack value moving accordingly both times.
- `engine/test/nullFaction.test.ts` — updated: a dedicated test for
  Segmentation Fault's condition toggle (via the existing whitebox harness)
  and a corrected Entropy Harvester test (now asserts the controller's own
  graveyard does NOT move its attack, only the opponent's does).
- `npm test` (root, all four workspaces): 124/124 passing (77 engine + 7
  protocol + 23 server + 17 agents, same counts as session 15 — this
  session updated existing tests rather than adding new ones, since the
  mechanism it added generic support for, condition-gated statics, was
  proven via the existing test plus the real-match demo rather than a
  wholly new test file). `npx tsc --noEmit` clean in all four packages.

## Decisions made this session the owner might want to overrule

See `progress/checkpoints.md`'s new Phase 4 entry (the full write-up) and
`progress/notes-for-owner.md` (the short version). In short: the specific
per-pairing percentage-band translation of the triangle's targets; which
Null card to cut (Corrupted Process, not Fork Bomb, for lint-headroom
reasons); and the decision NOT to attempt step 4 (cost increases) or any
Cortex/Swarm-side fix unilaterally.

## Concrete next step

No single obviously-next action — this is a genuine steering fork, written
up for the owner in `checkpoints.md`/`notes-for-owner.md`. If no owner
response arrives before the next session, the default (per this session's
own stated instinct, not yet acted on) is: look at Swarm's own kit to fix
the Swarm-vs-Null inversion (currently the single most structurally wrong
result against the triangle — worse than "right direction, too strong"),
rather than continuing to only nerf Null or touching Cortex unilaterally.
Read `progress/balance-report-010-phase4-triangle.txt` in full first.
