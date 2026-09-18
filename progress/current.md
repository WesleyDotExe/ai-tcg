# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 10.
The one unhandled `progress/owner-feedback.md` entry (2026-09-17,
Aegis-vs-Null fix direction) was worked exactly as directed — its own
two-step process (condition Kernel Panic's destroy, then adjust Null's
numbers only if still flagged), each step measured separately with
`balanceReport.ts` — and is now marked HANDLED in that file. No CRITICAL
quality-debt item was outstanding.

## What stands (changes from this session; everything from sessions 1-9
## otherwise unchanged — see prior `progress/log.md` entries for that)

**Step 1 — Kernel Panic's destroy gained a targeting condition.** Added a
new generic, reusable targeting constraint, `TargetFilter.maxHealth`
(`engine/src/cards/types.ts`), checked in `engine/src/effects/targeting.ts`
against a unit's derived total max health (base stat + tools + permanent
buffs; damage already taken does not count). Kernel Panic's evolve-in
destroy now only considers enemy units with 5 or less total health,
instead of any unit regardless of size. "Destroy ignores Barrier and stat
buffs" is unchanged — this only restricts what can be *selected*, not what
happens once destroy connects, per the owner's explicit instruction.
Re-measured (300 seeds): Aegis-vs-Null moved from 75.0%/81.3% to
74.7%/81.0% — essentially no change on its own.

**Step 2 — since still flagged, adjusted a Null number.** Investigated
first (scratch instrumentation, 60-150 seeds, tallying which Null
effects/cards correlate with wins) rather than guessing: no single card
explained the gap, but a real, comparison-based outlier turned up — Null
Singularity was the only card in the whole pool applying a persistent,
un-cleansable enemy-HEALTH reduction (its own faction's other enemy-aura
card, Segmentation Fault, and its cross-faction mirror, Prime Aegis, both
debuff attack only, never health). Changed Null Singularity's enemy aura
from `-1/-1` to `-1/-0` to match that precedent. Re-measured (300 seeds):
Aegis-vs-Null moved to 74.7%/79.0% — a small real improvement (mainly the
RandomAgent number, 81.3% -> 79.0%), still double-flagged.

**Result, stated honestly: Aegis-vs-Null remains double-flagged (74.7%/
79.0%) after both owner-directed steps.** Both changes are real,
individually-defensible fixes to genuine design problems (an unconditional
hard-counter removal effect; a uniquely uncounterable persistent
health-drain) and are not being reverted just because the aggregate number
barely moved. The instrumentation found the real driver isn't reducible to
one or two Null numbers — Null's win rate correlates with having any
persistent enemy-debuff aura in play (~84% vs ~60% without one), but that
alone doesn't explain a ~60%+ baseline either. The most likely real fix,
named here as a proposal rather than attempted unilaterally, is giving
Aegis's own kit more independent interaction/removal (it currently has
almost none — Perimeter Turret's telegraphed 3-damage-random hit and
Lockdown Field's 1-turn stasis are close to the whole list), not further
Null-side nerfs. Full numbers, method, and reasoning:
`progress/balance-report-003-null-fix.txt`.

## Evidence committed

- `progress/balance-report-003-null-fix.txt` — full before/after numbers
  for both fix steps, the instrumentation findings, and the honest read.
- `progress/sample-match-009-kernelpanic-fix.txt` — a real generated match
  (not a whitebox test) where Kernel Panic's destroy has zero eligible
  targets and does nothing, because the only enemy unit in play (Latent
  Ward) was pushed from 5 to 6 total health by its controller's own
  Static Ward Beacon aura — the fix working exactly as designed, caught in
  real, unscripted play. Annotated header explains exactly which log lines
  to check and contrasts with the pre-fix `sample-match-008-null.txt`
  (same seed, Kernel Panic kills Latent Ward outright there).
- `engine/test/nullFaction.test.ts` — the existing Kernel Panic test was
  adjusted (a +50 health buff that would now make its own victim
  untargetable was reduced to +3, keeping the "destroy ignores buffs"
  assertion meaningful) and two new tests were added: Aegis Warden (7
  health) is never selected as a Kernel Panic target and is left completely
  undamaged; Null Singularity's aura debuffs attack only, health unchanged.
- `npm test` (root, all four workspaces): **83/83 tests pass** (36 engine +
  7 protocol + 23 server + 17 agents).
- `npx tsc --noEmit` clean in all four packages.

## Decisions made this session the owner might want to overrule

- **`maxHealth` is checked against total (derived) max health, not
  remaining health after damage.** A unit already chipped down to near
  death is exactly as immune as a full-health one if its total max health
  is above the cap — a deliberate genre-convention read ("how big was this
  built to be," not "how wounded is it right now"), not owner-confirmed.
  See `progress/quality-debt.md`.
- **Stopped after two fix steps on Aegis-vs-Null rather than continuing to
  nerf Null further**, even though the pairing is still double-flagged.
  This follows the project's own established precedent (2026-09-15 owner
  approval of "stop after one cycle rather than chasing an exact target")
  and the owner's own two-step instruction (condition Kernel Panic, THEN
  adjust Null's numbers) — both steps were taken, both measured, and the
  session stopped there rather than guessing at a third or fourth Null
  change with no more evidence to go on. If the owner wants this pairing
  pursued further immediately rather than via the "fix Aegis's kit"
  proposal, say so in `owner-feedback.md`.
- **Diagnosed but did not act on "Aegis's kit lacks independent
  interaction" as the more likely real cause.** This is a card-set-design
  change (Aegis needs more of its own removal/answers), not "adjust Null's
  numbers" — named as the honest next step rather than attempted
  unilaterally, since it changes Aegis's identity/balance across every
  matchup, not just this one.

## Concrete next step

Per `progress/roadmap.md` item 3, the rest of the balance pass is still
open: Swarm-vs-Aegis (61.3%, named since session 7), the single-flagged
Cortex pairings (Cortex-vs-Aegis 70.0% Aggressive, Cortex-vs-Swarm 72.0%
Random), and Null's remaining edge over Cortex/Swarm under RandomAgent
specifically. Before picking any of those, or before touching Aegis-vs-Null
again, read `progress/balance-report-003-null-fix.txt`'s "honest read"
section — the proposed real fix for Aegis-vs-Null is adding independent
interaction to Aegis's own card pool (a design change, worth a checkpoint
proposal to the owner before building), not another Null nerf.
