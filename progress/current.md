# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 12.

The newest `progress/owner-feedback.md` entry (2026-09-20, "balance is a
systems problem; fix the loop, then expand the pool") lays out six phases
and says explicitly: work in this order, each phase done before the next.
This session did **Phase 1 only** ("fix the instrument before any further
balance change") — both its items, completely, with real evidence — and
stopped there rather than starting Phase 2 half-scoped in the time left.
The entry stays marked PARTIALLY HANDLED; phases 2-6 are unstarted.

## What stands (this session's work — everything from sessions 1-11
## otherwise unchanged, see prior `progress/log.md` entries)

**Phase 1 item 1 — a third reference agent, LookaheadAgent
(`engine/src/agents/lookaheadAgent.ts`).** AggressiveAgent (raw card cost)
and RandomAgent (chance) share a blind spot named in the 2026-09-19 entry:
neither can value a reactive/situational card correctly. LookaheadAgent
scores every legal move by estimating its board-state effect generically
from the same data-driven `EffectSpec`/`StaticEffectSpec`/`TargetSpec`
unions the real resolver interprets — no `if (card.name === ...)`
anywhere. `balanceReport.ts` now runs all three policies; a pairing is
flagged only when **all three agree** (previously two), a strictly higher
bar.

**A real bug this design caught, in itself, before shipping.** A first
300-seed run showed several real Commands — Cascade Purge (AOE damage,
`scope: "all"`), Backup Protocol and Diagnostic Ward (self-heals,
`scope: "self"`), Rally Cry (team buff, `scope: "all"`), Lockdown Field
(mass stun, `scope: "all"`) — played in **zero** of 700+ games where
LookaheadAgent drew them. Root cause: `Move.target` is only populated for
a `"chosen"`-scope ability (see `engine/moves.ts`); scoring off
`move.target` alone silently valued every `"all"`/`"self"` effect at zero,
forever. Fixed by resolving the ability's real target list from its own
`TargetSpec` (`resolveViewTargets`/`enumerateViewTargets`, mirroring
`effects/targeting.ts`'s `resolveTargets`/`enumerateTargets` but reading
public `PlayerView` board state instead of the internal `GameState`), not
by special-casing the five broken cards. Re-measured: all five now show
real, substantial "played" counts (700-1000+ games each). Regression tests
for this specific bug: `engine/test/lookaheadAgent.test.ts`'s "plays an
AOE sweep" and "plays a self-targeting Command" tests. This is exactly the
kind of hollowness DESIGN.md's "no shortcuts" section warns about, caught
by the instrument itself before it ever reached the report — a demonstration
that building the third policy carefully was worth the session on its own,
independent of what it then found about faction balance.

**LookaheadAgent also satisfies the owner's other two requirements, by
construction, not special-casing:** "holds Instants for a target" and
"never plays a reactive card with nothing to react to" fall out of the same
generic scoring — a card whose effect resolves to nothing useful right now
(e.g. Intercept Routine's `redirectAttack` finding no pending combat damage
on `view.stack`) scores at or below `passPriority` (always 0) and loses to
it. Proven with dedicated tests, not just plausible reasoning: two
of `lookaheadAgent.test.ts`'s five tests build a real engine state (via
`getLegalMoves`/`buildPlayerView`, not hand-built fixtures — the fixture-
hand-building gap `aggressiveDecision.test.ts` left as debt is specifically
avoided here) where Intercept Routine is legally castable, and assert the
agent holds it with nothing pending vs. plays it when something real is.

**Phase 1 item 2 — per-card "win rate when drawn / when played"
instrumentation, committed as a standing part of `balanceReport.ts`**
(previously scratch, uncommitted `npx tsx` one-offs per session 10 — named
debt). Tracks, per faction, every card's drawn-games/win-rate and
played-games/win-rate, accumulated across every game a policy plays.
Required a small, additive engine change: `evolve` and `toolAttached`
`GameEvent`s didn't carry a `player` field, so a Tool attach or an
evolution's resulting card couldn't be attributed to whoever played it —
both were harmless to add (nothing destructures the old shape positionally)
and are a real observability improvement beyond this instrumentation too
(a future commentator agent needs the same attribution). One correctness
bug caught and fixed before shipping this too: an activated ability's
`cast` event log its ability's *text*, not the source card's name
(`"${card.name} — ${ability.text}"`), which was leaking into the table as a
phantom pseudo-card — filtered out, with the real mechanism named in a
comment, not silently dropped.

## Evidence committed

- `progress/balance-report-005-instrument.txt` — the full 300-seed, three-
  policy report, including the per-card table for all four factions under
  all three policies.
- `progress/sample-match-012-lookahead.txt` — a real, unscripted
  LookaheadAgent-vs-LookaheadAgent match (found by `engine/src/dev/
  lookaheadMatchDemo.ts`, which searches seeds for one where the fix
  actually fires) where Cascade Purge and Lockdown Field both cast and
  connect for real damage — the exact bug class this session fixed, shown
  working in real play, not just asserted by a unit test. Zero fizzles.
- `engine/test/lookaheadAgent.test.ts` (5 new tests, all using real
  engine-produced `Move`/`PlayerView` values).
- `npm test` (root, all four workspaces): **94/94 tests pass** (47 engine +
  7 protocol + 23 server + 17 agents).
- `npx tsc --noEmit` clean in all four packages.

## Honest read on what Phase 1's report actually found

With the fixed instrument, the triple-policy cross-check flags exactly two
pairings: **Cortex vs Aegis** (a real, if modest, regression named as debt
back in session 11 — now confirmed under all three policies, not just
Aggressive) and **Aegis vs Null** (the long-standing pairing, unchanged in
kind). This is expected and correct per the owner's own framing: Phase 1's
job was to fix the instrument, not to re-tune anything yet. Per the entry's
explicit order ("Phases 1-4 come before any further balance work on
Aegis-vs-Null"), neither pairing was touched this session.

## Decisions made this session the owner might want to overrule

- **LookaheadAgent's approximations are named, not hidden** — most are
  carried over from AggressiveAgent's existing precedent (approximate
  attack/health from visible instance fields, not the full static-aura-
  aware `queries.ts`), but a few are new judgment calls made this session:
  a `conditional` effect's "then" branch is valued at a flat 0.5 discount
  rather than resolving the actual condition (a full `evaluateCondition`
  needs `GameState`-only facts a `PlayerView` doesn't carry); a `"random"`
  scope's expected value is computed exactly via linearity of expectation
  (not a guess) but still assumes every match is otherwise interchangeable;
  a brand-new (non-evolving) unit's own `"self"`-scoped onPlay effect scores
  0 (the unit's instance doesn't exist in the view yet to evaluate against).
  See `progress/quality-debt.md` for the full list.
- **Extended `GameEvent`'s `evolve`/`toolAttached` variants with a `player`
  field** — a small, additive engine schema change made to unblock the
  "played" instrumentation, not requested verbatim by the entry. Named here
  since it's the one piece of this session that touched shared engine types
  rather than purely adding new agent/report code.

## Concrete next step

Phase 2 of the 2026-09-20 owner-feedback entry, in order: item 3 ("Directives
must be removable: add a 'destroy directive' effect kind ... give every
faction one answer"), then item 4 (a "summon"/token effect kind), then item 5
(bases carry a small protection while unevolved — propose the mechanism at a
checkpoint). Read the full entry in `progress/owner-feedback.md` before
starting — it specifies these are engine gaps that create hard counters,
motivated by concrete examples (permanent -1/-0 auras switching off 1-attack
factions with no answer possible; Aegis having no clock or card flow; Swarm
having no way to rebuild after board wipe). Do not resume Aegis-vs-Null
tuning directly — the entry is explicit that Phases 1-4 come first.
