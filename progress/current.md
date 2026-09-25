# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 18
(balance session — the alternation rule in owner-feedback.md's 2026-09-24
entry means this session did the normal balance/roadmap priority, since the
most recently merged PR (#19) was a render slice).

This session acted on owner-feedback.md's 2026-09-23 "Phase 4 session 17
follow-ups" entry, the highest-priority unhandled feedback: (1) correct two
mislabelled ring-target edges, (2) leave Cortex-vs-Swarm alone, (3) fix
Aegis-vs-Cortex with an Aegis buff, (4) push Null step 4 past cost to power.
All four are done — see below for what shipped and the honest result.

## What stands (this session's work — everything from sessions 1-17
## otherwise unchanged, see prior `progress/log.md` entries)

**1. Ring labels corrected, and encoded as data, not just prose.**
`engine/src/dev/balanceReport.ts` now carries `RING_DECISIVE`/`RING_EVEN`
constants with the corrected ring shape (Null > Aegis > Cortex > Swarm >
Null; Cortex-vs-Swarm and Aegis-vs-Cortex are BOTH decisive [W] 55-60%
edges, not "even" as session 17 mislabelled them; only Null-vs-Cortex and
Aegis-vs-Swarm are the ~even [E] 45-55% pairings), and prints a per-policy
"in band?" line for all six pairings every run. While rewriting the
cross-check section for this, found and fixed a real, separate bug: the
"flagged under all three policies" check used to fire whenever each policy
independently cleared the 60% threshold, without checking they agreed on
WHICH side won — balance-report-011 reported Swarm-vs-Aegis as
triple-flagged for exactly this reason (Aggressive favoured Swarm,
Random/Lookahead favoured Aegis, three real but disagreeing signals). The
cross-check now requires the same winner across all three policies.

**2. Cortex-vs-Swarm — not touched**, exactly as the entry instructed
("not a problem to assign a fixer to ... Phase 5 wider pools will likely
settle it").

**3. Aegis-vs-Cortex — an Aegis buff, Cortex never touched.** Honest
journey, not a straight line: a first attempt (`engine/src/data/aegisCards.ts`,
a new 0/0-stat Barrier-granting Tool at 1-2 copies) measured WORSE for this
exact pairing under every policy (Aggressive 67.7% -> 73.7% Cortex) — the
same "reactive/zero-immediate-impact card crowds out real tempo plays"
opportunity-cost trap session 11's original Aegis defensive-card batch
already discovered (owner-feedback.md's 2026-09-19 entry). Not shipped.
Shipped instead: Guard Directive Chip — already the pool's single
best-performing card by played win rate (~53-56%, real stats plus the
Guard keyword, which forces removal onto a body built to take it) — bumped
from 2 to 3 copies, its Uncommon rarity ceiling, using the pool's exact
remaining headroom (39 -> 40 cards, no cut needed). Result, honestly: real
movement under Aggressive (the worst-outlier policy, 32.3% -> 35.7%
Aegis), essentially flat under Random (56.3% -> 54.3%) and Lookahead
(50.0% -> 48.3%). **Not in the 55-60% band on any policy.** Not chased
further unilaterally — the Aggressive-policy gap in particular looks at
least partly agent-heuristic-driven (quality-debt.md's standing note on
AggressiveAgent's blind spots), not purely a card-design problem, and
closing a ~25-point gap from one copy-count change was never a realistic
bar for a single session. Open question in `progress/notes-for-owner.md`.

**4. Null step 4, past cost to power (`engine/src/data/nullCards.ts`).**
Kernel Panic's destroy reach tightened from `maxHealth: 5` to `maxHealth: 4`
(pulls Aegis's Latent Ward, 5 health, out of reach — it sat exactly on the
old boundary). Null Singularity's health cut 8 -> 7 (both of its static
auras kept untouched — they're its whole identity as the Mythic capstone,
so the body absorbed the cut instead of an aura). Measured after: **Aegis-vs-Null
is no longer triple-flagged** — Lookahead now sits IN the 55-60% band
(58.0%), the exact "stop" condition the parent 2026-09-20/2026-09-23
entries named, even though Aggressive (72.0%) and Random (72.3%) haven't
individually reached band yet. Since the project's actual pass/fail bar is
the triple-flag cross-check, and that's now clear, nothing further was
attempted on Null this session.

## Evidence committed

- `progress/balance-report-012-ring-followups.txt` — full before/after
  table (vs balance-report-011) across all six pairings x three policies,
  the corrected ring-target report, the fixed cross-check output, and the
  honest read of what moved and what didn't.
- `progress/sample-match-019-ring-fixes.txt` — two real, unscripted
  LookaheadAgent-vs-LookaheadAgent matches: one where Guard Directive Chip
  forces an attack onto the unit it's attached to (Aegis vs Cortex, seed
  1), one where Kernel Panic's tightened destroy reach leaves a 5-health
  Latent Ward with no legal target and it survives (Null vs Aegis, seed
  16). Found via `engine/src/dev/ring2609MatchDemo.ts` (mirrors
  `segfaultConditionMatchDemo.ts`'s seed-search shape).
- `engine/test/nullFaction.test.ts` — 1 new whitebox test pinning the
  tightened destroy-reach behaviour against a synthetic 5-health fixture
  (Latent Ward), alongside the pre-existing test that pins the old
  destroy-reach's still-correct "way over cap" case (Aegis Warden, 7
  health) so both boundaries stay covered.
- `npm test` (root, all four workspaces): 82/82 in engine (up from 81; one
  new test), unchanged elsewhere. `npx tsc --noEmit` clean in engine.

## Decisions made this session the owner might want to overrule

See `progress/checkpoints.md`'s new entry and `progress/notes-for-owner.md`.
In short: Guard Directive Chip's exact new copy count (3, its rarity
ceiling — an untested-beyond-this-report guess at "enough," not a measured
target); Kernel Panic/Null Singularity's exact new numbers (maxHealth 4,
health 7); and the decision to stop at "no longer triple-flagged" for
Aegis-vs-Null rather than chase every individual policy into band, and to
stop at one copy-count change for Aegis-vs-Cortex rather than attempt a
second lever this session.

## Concrete next step

Two open pairings, neither fully in band: **Aegis-vs-Cortex** (real but
partial progress; the Aggressive-policy gap may need either a second,
different Aegis lever or may resolve on its own once Phase 5 widens the
pool) and **Cortex-vs-Swarm** (explicitly left for Phase 5 to settle, per
the owner's own instruction). If owner steering arrives, follow it. If not,
the roadmap default is: since this is the second consecutive session where
a card-level lever alone couldn't fully close a gap (this session's
Aegis-vs-Cortex, following session 17's Aegis-vs-Null needing two
mechanisms), and the two remaining open pairings are both ones the owner
has already pointed at Phase 5 (Cortex-vs-Swarm explicitly, Aegis-vs-Cortex
plausibly), the next balance session should consider whether the ring is
"close enough" to start Phase 5 (pool expansion) with these two named as
carried-forward watch items, rather than a third consecutive session
chasing the same two pairings with diminishing unilateral moves — but this
is a genuine judgment call for the owner or a future session to make
explicitly, not decided here. Per RENDER.md's alternation rule, the next
session should be a render slice (this session's own PR is the "balance"
slice the rule alternates against).
