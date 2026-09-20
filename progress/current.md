# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 13.

The 2026-09-20 owner-feedback entry ("balance is a systems problem; fix the
loop, then expand the pool") lays out six phases, explicit order, each done
before the next. Session 12 did Phase 1 (fix the instrument). This session
did **Phase 2 item 3 only** ("Directives must be removable ... give every
faction one answer") — completely, with real evidence — and stopped there
rather than starting item 4 half-scoped. The entry stays PARTIALLY HANDLED;
Phase 2 items 4-5 and Phases 3-6 are unstarted.

## What stands (this session's work — everything from sessions 1-12
## otherwise unchanged, see prior `progress/log.md` entries)

**A real, generic "destroy a Directive" mechanism, not a one-off card
hack.** Before this session, `quality-debt.md`'s "Architectural gaps"
section named this explicitly: "Directives can never leave play." Fixed
generically: `TargetFilter.kind` gained `"directive"`; `TargetRef`/
`enumerateTargets` (`effects/targeting.ts`) grew a matching variant; the
existing `"destroy"` effect kind (previously unit-only) now dispatches on
the resolved target's own kind (`effects/resolver.ts`'s `applyDestroy` ->
`destroyDirective`, a direct board-to-graveyard removal with its own log
event, `directiveDestroyed`, since a Directive has no health/death-
processing model to route through, unlike a unit). `LookaheadAgent` was
updated in the same pass so it values a directive-destroy card by the
target's own cost, deliberately avoiding a repeat of session 12's
"silently scores zero forever" bug class for a new target kind.

**One answer per faction, per the entry's explicit instruction, each a
different flavour take on the same mechanic:** Force Quit (Cortex), Bore
Swarm (Swarm), Null Pointer (Null), Breach Charge (Aegis) — all Instant,
cost 2, Uncommon, 2 copies. Aegis's card is deliberately NOT a reopening of
the 2026-09-19 "defensive answers, not removal" direction: a Directive
isn't a unit, so this doesn't put board-removal into Aegis's kit (see
`data/aegisCards.ts`'s header comment on the reasoning). Cortex's pool was
already at the enforced 40-card ceiling (anticipated debt since session 6),
so 2 copies each of Diagnostic Pulse/Diagnostic Loop were trimmed to make
room — named honestly as a "make room" cut, not a nerf.

## Evidence committed

- `engine/test/directiveDestroy.test.ts` — 8 new tests: real removal +
  graveyard + log event, the filter never offering the controller's own
  directives, no legal play with nothing to target, all four factions'
  cards destroying a directive for real, and both `LookaheadAgent`
  behaviours (plays it when worth it, never offered a fizzle to prefer).
- `progress/sample-match-013-directive-destroy.txt` — a real, unscripted,
  seed-found LookaheadAgent-vs-LookaheadAgent match (Cortex vs Aegis) where
  Force Quit destroys Static Ward Beacon during actual play.
- `progress/balance-report-006-directive-removal.txt` — full 300-seed,
  three-policy re-measurement. All four new cards show real, substantial
  "played" counts (166-607 games each across policies) confirming they're
  genuinely exercised, not silently dead cards.
- `npm test` (root, all four workspaces): **102/102 tests pass** (55 engine
  + 7 protocol + 23 server + 17 agents).
- `npx tsc --noEmit` clean in all four packages.

## Honest read on what the re-measurement found

Cortex-vs-Aegis (triple-flagged going in: 72.3%/60.0%/61.3%) is **no
longer** triple-flagged (71.0%/56.7%/57.3% — Random and Lookahead both
dropped below the 60% threshold), plausibly because Aegis can now destroy
Cortex's Mainframe Core aura. Cortex-vs-Swarm (flagged under 2/3 before:
58.0%/72.0%/62.3%) is **newly** triple-flagged (60.7%/64.0%/66.0%) — a
real, modest, unaimed-at regression, most plausibly from Cortex's own
two-card trim. Aegis-vs-Null is essentially unchanged in kind (still
clearly flagged; the three policies moved a few points each way, netting
out close to where they started) — expected, since neither this change nor
Phase 2 items 4-5 target that pairing. None of this was chased further
this session — per the owner's own explicit order, card-by-card tuning off
these numbers is exactly what the 2026-09-20 entry superseded; Phase 2
continues in sequence before any of it gets touched again.

## Decisions made this session the owner might want to overrule

- **All four new cards were made Instant-speed**, not Sorcery — a judgment
  call (the entry didn't specify), reasoned from "an answer should be
  castable in response," matching the project's existing convention for
  reactive/utility cards (Interrupt Handler, Reflex Spike, Intercept
  Routine). Not playtested against a Sorcery-speed alternative.
- **Cost 2 / Uncommon / 2 copies, uniformly across all four factions** — a
  first proposal for symmetry, not a playtested or owner-confirmed number.
  A Directive's own cost curve varies faction to faction (Cortex/Swarm/Null
  directives sit at cost 3, Aegis's at cost 2-3), so a flat cost-2 answer is
  proportionate but not measured against each faction's actual directive
  density.
- **Cortex's trim picked Diagnostic Pulse and Diagnostic Loop specifically**
  — reasoned as "least distinctive, and nudges removal density down ahead
  of Phase 3's future lint rule," not measured against alternative cuts.

## Concrete next step

Phase 2 items 4 and 5 of the 2026-09-20 owner-feedback entry, in order:
item 4 (a "summon"/token effect kind, so wide decks can rebuild after
board-wide damage — named motivation: Swarm has no way to recover after a
sweep), then item 5 (bases carry a small protection while unevolved —
propose the mechanism at a checkpoint, per the entry's own instruction).
Read the full entry in `progress/owner-feedback.md` before starting. Do
not resume Aegis-vs-Null or Cortex-vs-Swarm tuning directly — Phases 1-4
come first, per the entry's explicit order; both pairings are re-measured
and honestly reported above, not silently dropped.
