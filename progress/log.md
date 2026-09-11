# Build log

## 2026-09-11 — Session 1 (first session ever)

Built the headless rules engine from scratch in `engine/` (TypeScript,
Node, zero runtime dependencies — `typescript`, `tsx`, `@types/node` are
the only devDependencies).

What I built, in order:

1. **Card schema + data-driven ability system** (`src/cards/types.ts`).
   Deliberately went further than "three hardcoded effects" from the
   start, since DESIGN.md calls that out by name as a failure: the type
   system covers keywords, all five entity-triggered timings (onPlay,
   onAttack, onDamaged, onDeath, onTurnStart/onTurnEnd), activated
   abilities with energy costs, static/continuous auras, chosen/all/random
   targeting with side+kind filters, conditions, and a `ScalingAmount`
   type so a stat or an effect amount can read live board state (units in
   play, hand size, graveyard size, turn number) instead of being a flat
   number.
2. **State + derived stats** (`src/state/`). The key design decision: a
   unit's current attack/health are never stored, only *derived* on demand
   from base stats + permanent/turn buffs + live static auras
   (`state/queries.ts`, `effects/statics.ts`). This means there is no
   "recompute" pass to remember to call and no way for a stat to go stale
   after a buff or an aura's source leaves play — the effect-system-demo
   script actually tests this (scenario 8: an aura's bonus disappears the
   instant its source is removed, no extra step needed).
3. **Effect resolver** (`src/effects/resolver.ts`). One dispatcher
   (`resolveAbility`) that every trigger goes through — no separate path
   for "special" cards. `applyDamage` is the single choke point for all
   damage (combat and effects both go through it), which is what makes
   Barrier-absorption and onDamaged-triggering-on-any-damage-source work
   consistently for free. `processDeaths` loops to a fixed point so a
   death trigger that kills something else cascades correctly instead of
   being checked only once.
4. **Turn engine** (`src/engine/`). `getLegalMoves` is the single source
   of truth for legality — agents never invent a move, they only pick from
   what this returns, and `applyMove` only ever applies what was offered.
   Turn structure: energy climbs by 1/turn to a cap of 10 and refills each
   turn, one card drawn per turn (fatigue damage if the deck is empty),
   summoning sickness unless Rush, Guard forces attacks onto the
   guard(s), and a 40-turn cap with a health-based tiebreak so a match is
   *guaranteed* to resolve (DESIGN.md's pacing principle — this is the
   first mechanical piece of that, not the real pacing-curve tuning, which
   needs a render and real playtesting volume to mean anything yet).
5. **Two dummy agents** (`src/agents/`) — `RandomAgent` (seeded, weighted
   away from passing) and `AggressiveAgent` (greedy: biggest affordable
   card, face damage over trades, cheapest-kill trades when Guard blocks
   face). Both go through the same `Agent.decideMove(view, legalMoves)`
   interface, and `PlayerView` already redacts the opponent's hand/deck —
   this is the exact shape stage 2 needs to turn into a real protocol, so
   that work is a network-plumbing change, not a redesign.
6. **A 21-card Cortex pool and 20-card Swarm pool** (`src/data/cards.ts`,
   `decks.ts`) built specifically to exercise every mechanic category, not
   to be balanced or "a real set" (that's stage 3). Copy limits (3/3/2/1
   by rarity) are enforced by `buildDeck()`, which throws if violated —
   real enforcement, not just cards I happened to not overuse by hand.

Then I ran it. Two kinds of evidence, both committed:

- `progress/sample-match-001.txt`: one full real match (seed 1,
  Random-Cortex vs Aggressive-Swarm), 25 turns, 105 moves, resolved
  cleanly to a win.
- `progress/effect-system-demo.txt`: a deterministic, assertion-based
  script (`src/dev/effectSystemDemo.ts`) that builds controlled scenarios
  and asserts real outcomes for every mechanic category DESIGN.md names —
  including a cross-card cascade (onDamaged triggers an AOE, which kills a
  unit, which fires that unit's own onDeath). I did this *in addition to*
  the match log because a single random/heuristic match has no guarantee
  of ever drawing or triggering every mechanic — relying on chance for
  "evidence" would have been exactly the kind of claimed-but-unverified
  work DESIGN.md warns against. Writing it also caught two real bugs in my
  own test setup before I trusted the results (an empty test deck making a
  conditional draw silently fatigue instead, and a state-mutating
  assertion that didn't account for units already on the board) — both
  fixed, not papered over.

I also stress-ran 60 seeds through the CLI with no crashes, and looked at
the resulting turn-length/winner distribution (logged in
`progress/current.md`) — not because pacing tuning is stage-1 work, but
because DESIGN.md asks for matches to be *measured*, not assumed, from the
first moment there's data to measure.

**What's blocked:** nothing structurally. The next run can go straight to
stage 2 (agent interface / real protocol) per `progress/current.md`.

**Honest gaps:** see `progress/quality-debt.md` — written before stopping,
not as an afterthought.
