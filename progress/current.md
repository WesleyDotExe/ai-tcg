# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 17.

The 2026-09-23 owner-feedback entry ("Phase 4 decisions") superseded
session 16's proposed triangle with an explicit four-faction counter-cycle
ring (Null > Aegis > Cortex > Swarm > Null) and ordered two specific
changes: raise Null's two outlier cards' costs (step 4 of the pre-existing
backstop), and buff Swarm's own kit with real go-wide resilience (not nerf
Cortex). This session did both, in order, then re-measured the whole ring
and wrote a checkpoint, exactly as instructed. Per the entry's own words
("this is the last balance pass before Phase 5 — do NOT start expansion
until the ring is within band"), Phase 5 (pool expansion) was NOT started —
the ring is not yet within band on any pairing.

## What stands (this session's work — everything from sessions 1-16
## otherwise unchanged, see prior `progress/log.md` entries)

**1. Null step 4 — done.** Kernel Panic's cost raised 5 -> 6 and Null
Singularity's raised 6 -> 7 (`engine/src/data/nullCards.ts`). These are now
the first cards in the pool costing strictly more than their faction-mirror
equivalents (Aegis Warden 5, Prime Aegis 6) — the owner's own steer
resolves the cross-faction-curve concern session 16 flagged rather than
acted on: "it's fine for them to cost more... a premium on its best pieces
is on-identity." Three whitebox test fixtures in
`engine/test/nullFaction.test.ts` that hardcoded `energy = 5` for Kernel
Panic were updated to 6 to match.

**2. Buff Swarm — two new cards, both proven real, not nerfing Cortex.**
`engine/src/data/cards.ts` gained Colony Broodling (cost 1 Unit: dying with
2+ other units surviving summons a replacement 1/1 Swarm Larva — directly
punishes single-target removal, the exact ring-stated reason Swarm should
beat Null) and Overgrown Carapace (cost 3 Unit: its own health scales live
with the controller's unit count — a body that gets steadily harder for
fixed-damage removal to answer as Swarm's board grows). Both reuse only
already-generic engine mechanisms (`summon`, `Ability.condition`,
`selfStatFromScaling`) — no new engine work was needed, unlike the Phase 2
items that preceded this. 5 copies total (3+2), filling the pool's exact
remaining headroom under the 40-card cap; no existing card, Cortex's or
Swarm's, was touched or cut. Real-play evidence:
`progress/sample-match-018-swarm-resilience.txt` (found on the first seed
searched — a real, unscripted LookaheadAgent-vs-LookaheadAgent Swarm-vs-Null
match where Colony Broodling's death genuinely summons a replacement and
Overgrown Carapace's live health is sampled matching "1 + board count"
across 6 different board sizes; Swarm wins). Whitebox proof:
`engine/test/swarmResilience.test.ts` (4 new tests: the replacement fires
with 2+ other units and is correctly gated off with fewer/zero; the health
scaling tracks the board live, including shrinking after a real ally death
and still taking real combat damage on top).

**3. Whole-ring re-measurement — done, honest result: no pairing is in band
yet, but real, multi-policy movement in both targeted places.**
`progress/balance-report-011-phase4-decisions.txt` (300 seeds/matchup, all
three policies) has the full before/after table and honest read. Headline
findings:
- **Aegis-vs-Null moved down under all three policies** (78.0/72.0/67.7 ->
  75.7/70.0/65.3) — the first Null fix in this project's whole history to
  move all three policies at once rather than mostly just Random. Still
  triple-flagged; did not land in the 55-60% band the entry's "stop"
  condition names.
- **Swarm-vs-Null is no longer triple-flagged** — was triple-flagged going
  in (Null 56.0/79.0/67.3), now only Random remains >=60% (Aggressive is
  dead even, Lookahead down to 56.7% Null). The single most
  structurally-wrong ring edge moved the most, in the right direction, on
  every policy.
- **Cortex-vs-Swarm is unchanged in kind** (still triple-flagged) — neither
  authorized change targeted it, and none was expected to.
- **One honest, unintended side effect:** Cortex-vs-Null is now
  single-flagged under Aggressive only (55.7% -> 60.7%), plausibly Null's
  weaker early game (from the cost increases) mattering more against
  Cortex's efficient curve specifically. Not chased (single-policy, not a
  cross-check flag).
- **Kernel Panic and Null Singularity remain extreme win-rate outliers WHEN
  PLAYED** even after the cost increase (up to 86.4%/78.7% respectively
  under Random) — the cost increase reduced how OFTEN they land, not how
  strong they are once they do. Named as the likely next lever if Aegis-vs-
  Null needs further work, but not attempted this session (out of this
  entry's authorized scope).

Per the entry's own explicit instruction, Phase 5 (pool expansion) was NOT
started — the ring is not within band. See `progress/checkpoints.md`'s new
entry and `progress/notes-for-owner.md` for the specific open questions this
leaves.

## Evidence committed

- `progress/balance-report-011-phase4-decisions.txt` — the ring proposal
  recap, the full before/after table across all 6 pairings x 3 policies, the
  honest read, and the full raw 300-seed/3-policy report with per-card
  instrumentation.
- `progress/sample-match-018-swarm-resilience.txt` — real, unscripted
  LookaheadAgent-vs-LookaheadAgent match (seed 11, Swarm vs Null) proving
  both new Swarm mechanisms fire live.
- `engine/test/swarmResilience.test.ts` — 4 new whitebox tests.
- `engine/src/dev/swarmResilienceMatchDemo.ts` — the seed-search script that
  produced the sample match log (mirrors the existing
  `segfaultConditionMatchDemo.ts` pattern).
- `npm test` (root, all four workspaces): 128/128 passing (81 engine, up
  from 77; 7 protocol; 23 server; 17 agents). Engine/protocol/agents are
  100% deterministic and passed every run. One server integration test
  ("closes a third connecting socket...") flaked on 2 of 4 runs this
  session, including standalone — confirmed pre-existing (server/ was not
  touched by this session at all; this is the exact real-socket timing
  sensitivity named in quality-debt.md since session 9, previously observed
  flaking once in session 16 too) rather than a new problem, but flakier
  than previously observed — worth a closer look in a future hardening
  pass rather than left purely as "worth watching." `npx tsc --noEmit`
  clean in all four packages.

## Decisions made this session the owner might want to overrule

See `progress/checkpoints.md`'s new entry and `progress/notes-for-owner.md`
(short version). In short: Kernel Panic/Null Singularity's exact new costs
(6/7, a first guess at "enough" rather than a measured target); Colony
Broodling/Overgrown Carapace's specific numbers (1-cost 1/1 summon-on-death,
3-cost 1-base scaling-health) and copy counts (3/2); and the decision to
stop at exactly the two authorized changes rather than iterating further
toward the band unilaterally, since neither pairing landed in band and nothing
further was pre-authorized.

## Concrete next step

No single obviously-next action — this is another genuine steering fork,
written up in `checkpoints.md`/`notes-for-owner.md`. If no owner response
arrives before the next session, the roadmap default is: do NOT start Phase
5 (pool expansion) per the entry's own explicit gate ("do NOT start
expansion until the ring is within band"). Instead, the next session should
either (a) get owner steering on the two open, unassigned problems this
report leaves (Cortex-vs-Swarm, which nothing has been authorized to touch;
and whether to go a step further on Aegis-vs-Null, e.g. touching Kernel
Panic/Null Singularity's stats/effects now that cost alone didn't land it in
band), or (b) if no response, read `progress/balance-report-011-phase4-decisions.txt`
in full and pick the most conservative next move consistent with "do not
nerf Cortex" and "do not chase further unilaterally" — most likely a second,
smaller Cortex-vs-Swarm-specific Swarm card, since Swarm is the entry's own
named target faction and that pairing is the only remaining triple-flag with
no assigned owner.
