# Current status

**Build-order stage: 3 (A real card set) — COMPLETE.**

Stage 2 (agent interface / network protocol) was already done. This session
built the unified board-development system the owner's 2026-09-12
design-directive batch called for (finite face-up board slots, telegraphed
threats, evolution cards, tool/attachment cards, built as one interacting
system) directly into the rules engine, then built a genuinely new third
faction — Aegis — to exercise it as a real, playable card set.

## What stands

- **`engine/src/cards/types.ts`** — new `Tool` CardType and `ToolCard`
  interface (flat attack/health bonus + granted keywords), and two new
  optional `UnitCard` fields: `evolvesFrom` (base card id, strict
  requirement) and `telegraph` (arm delay in the controller's own turns).
- **`engine/src/state/types.ts`** — `UnitInstance` gained `pending`/`armTurn`
  (telegraph state) and `tools: ToolCard[]` (always present, empty by
  default). Four new `GameEvent` kinds (`telegraphPlaced`, `telegraphArmed`,
  `evolve`, `toolAttached`) so the log — which the future spectator client
  and commentator agents will consume — narrates the new mechanics as
  first-class events, not side effects of `damage`/`buff`.
- **`engine/src/state/init.ts`** — `BOARD_SLOTS` (proposed default: 6), the
  finite per-player pool Units and Directives share (see below).
- **`engine/src/state/queries.ts`** — `currentAttack`/`currentMaxHealth` now
  fold in attached Tools' bonuses; `hasKeyword` now checks Tool-granted
  keywords too, and every call site that used to read `unit.card.keywords`
  directly (Guard-forces-attack, Rush-bypasses-sickness in `moves.ts`) now
  goes through `hasKeyword` so a Tool-granted keyword is honoured
  everywhere a printed one would be.
- **`engine/src/effects/statics.ts`** — a pending (unarmed) telegraphed
  unit projects no static aura, including its own `selfStatFromScaling`.
- **`engine/src/engine/moves.ts`** — `boardSlotsUsed` (board.length +
  directives.length) gates new Unit/Directive plays against `BOARD_SLOTS`;
  evolution and Tool cards get their own targeting logic (evolution targets
  an armed friendly unit with the required base card id; Tools target any
  friendly unit); pending units are excluded from attack and
  activated-ability legal moves.
- **`engine/src/engine/engine.ts`** — `playCard` branches for Tool
  (`attachTool`) and evolution (`evolveUnit`) before the normal Unit path;
  a telegraphed Unit enters `pending` and defers its `onPlay` instead of
  firing it immediately; `beginTurn` now calls `processTelegraphArming`
  before turn-start triggers, which arms any of the controller's telegraphed
  units whose countdown has elapsed and fires their `onPlay` then.
  `evolveUnit` mutates the target unit **in place** (same instanceId), so
  accumulated damage, statuses, and attached tools all carry forward onto
  the evolved form for free, and evolving never costs a board slot.
- **`engine/src/effects/resolver.ts`** — `processDeaths` now sends a dead
  unit's attached Tools to the graveyard along with its own card.
- **`engine/src/data/decks.ts`** — real, enforced `MIN_DECK_SIZE`/
  `MAX_DECK_SIZE` (20/40), closing a gap `quality-debt.md` had named; plus
  `buildAegisDeck`.
- **`engine/src/data/aegisCards.ts`** — the stage-3 card set: 14 unique
  Aegis cards (34-card deck respecting copy limits), covering the full new
  system (an evolution line Cadet→Sentinel→Warden; two telegraphed units;
  three Tool cards) plus enough ordinary variety (keywords, a triggered
  onDamaged self-heal, a static aura, an AOE stun Command, a
  conditional-and-`not`-composed draw effect using the previously-untested
  `handSizeAtLeast` condition) to be a real, distinct faction rather than a
  showcase of only the new mechanics. Themed per the owner's 2026-09-11
  cyberpunk/90s-retro-futurism direction (chrome plating, CRT diagnostics),
  distinct from Cortex (networked intelligence) and Swarm (biological
  mass) — the game now has three factions, which matters for the
  self-disrupting-metagame principle (archetype variety needs ≥3 to have
  real soft-counter triangles, not just a single mirror axis).
- Cortex and Swarm (the stage-1/2 test pools) are untouched — they don't
  use telegraph/evolution/tools yet. Deliberately not backfilled this
  session; noted as natural, not required, follow-up.

## Evidence committed

- `progress/effect-system-demo.txt` — regenerated; scenarios 13–16 are new,
  deterministic, assertion-based proofs of telegraph arming (a unit is
  dormant, can't attack, projects no aura, then arms and its ability
  fires), evolution (same instanceId, damage and a pre-attached tool carry
  forward, base card graveyarded, the evolved card's own `onPlay` fires),
  Tool attachment (live stat bonus, a granted keyword, and a Tool that
  grants Barrier applying the actual status), and the board-slot cap (blocks
  a new Unit/Directive at capacity, never blocks a Tool). All 16 scenarios
  pass.
- `progress/sample-match-004-boarddev.txt` — **new, this session's stage-3
  evidence.** A full real match (seed 3, `engine/src/dev/aegisMatchDemo.ts`,
  a script that searches seeds for one exercising all three new mechanics
  and is committed as reusable evidence-generation tooling, not a
  throwaway) between Random-Aegis and Aggressive-Cortex. All three new
  mechanics fire in real, unscripted play: a Perimeter Turret survives 2
  AOE damage while dormant, then arms and kills an attacker on the turn it
  wakes up (turn 7→9); an Aegis Cadet evolves into an Aegis Sentinel,
  gaining its evolve-in energy bonus (turn 15); a Plating Module attaches
  to Prime Aegis (turn 13). The match resolves cleanly in 16 turns, well
  under the 40-turn cap.
- A 300-game stress run across two matchups (Aegis vs Cortex, Aegis vs
  Swarm; RandomAgent vs AggressiveAgent, 150 seeds each — not committed as
  a script, described here for the record like the stage-2 fault-path
  tests) produced zero crashes, mean ~17 turns (consistent with the
  stage-2 figures, still comfortably under the cap), telegraph arming in
  ~78% of games, evolution in ~34%, and a Tool attaching in ~96% — real
  variety, not a cherry-picked seed. Win rates skewed heavily toward the
  Aggressive heuristic over Random, as expected (see quality-debt.md — this
  says nothing about faction balance, same caveat as the stage-2 numbers).
- All four packages (`engine`, `protocol`, `server`, `agents`) typecheck
  clean; the stage-1/2 evidence (the original 12 effect scenarios, the
  Cortex-vs-Swarm CLI match) was re-run after this session's changes and
  still passes/plays identically — the board-slot cap and deck-size rule
  did not regress the existing test pools.

## Decisions made this session the owner might want to overrule

Written up in full in the new checkpoint (`progress/checkpoints.md`) and in
`progress/owner-feedback.md`'s 2026-09-12 entry (now marked "section B
done"): board slots default to 6 and are shared between Units and
Directives; evolution requires the *exact* base card id (strict, not
loose); telegraph delay defaults to 1 controller-turn; nothing stops
playing a base unit and evolving it the same turn (an emergent same-turn
combo observed in real play); deck size is enforced at [20, 40].

## Concrete next step

Options for the next session, per DESIGN.md's build order (stage 4 is match
server hardening — matchmaking, persistence — and stays blocked until a
richer economy needs it; do not jump there over stage-3 depth work):
1. **Depth on stage 3:** backfill Cortex and/or Swarm with a few
   telegraph/evolution/tool cards so the new system isn't Aegis-exclusive,
   and/or add a real automated test runner (vitest) — `quality-debt.md`
   has flagged "no test runner, all verification is manual scripts" since
   stage 2; this is now overdue given the card pool and mechanic surface
   have both grown again.
2. **Continue stage 3 width:** a fourth faction, or deepen Aegis with a
   second evolution line / more telegraph-tool interactions, before
   calling the card-set stage fully "done" in the sense of "enough for a
   real metagame" (14 unique cards in one new faction is a real set, not
   yet a rich one).
Either is legitimate; this session leans toward (1) — hardening the
verification story — given this is the second stage-3-scale session in a
row to add real engine surface without adding automated regression
coverage beyond hand-written demo scripts.
