# Current status

**Build-order stage: 1 (Rules engine, headless) — COMPLETE.**

## What stands

`engine/` is a TypeScript/Node package with no runtime dependencies:

- `src/cards/types.ts` — the card schema and the data-driven ability/effect
  system: `Card` (Unit/Command/Directive), `Ability`, `EffectSpec`,
  `Condition`, `TargetSpec`, `ScalingAmount`. No card is ever special-cased
  by id/name anywhere in the engine — every card's behaviour is data these
  generic types describe.
- `src/state/` — `GameState`/`PlayerState`/`UnitInstance`, a seeded RNG
  (`Rng`, mulberry32, for reproducible matches), match setup
  (`createInitialState`), and derived-stat queries (`currentAttack`,
  `currentHealth`, etc. — always computed live from base stats + buffs +
  live static auras, never cached, so nothing can go stale).
- `src/effects/` — the resolver: targeting (chosen/all/random/self),
  condition evaluation, static-aura aggregation, scaling-amount sampling
  from live board state, and `resolveAbility`/`applyDamage`/`applyHeal`/
  `processDeaths` (which cascades onDeath triggers to a fixed point).
- `src/engine/` — `getLegalMoves` (single source of truth for legality),
  `applyMove` (playCard/attack/activateAbility/endTurn), turn structure
  (energy curve, draw, summoning sickness, Guard-forced targeting, turn-cap
  tiebreak so a match always resolves), and `runMatch`.
- `src/agents/` — the `Agent`/`PlayerView` interface (a redacted view that
  hides the opponent's hand/deck — this shape is what stage 2 turns into an
  actual network protocol) plus two dummy agents: `RandomAgent` (weighted
  random) and `AggressiveAgent` (greedy face-damage heuristic). Both talk
  to the engine only through `getLegalMoves`/`decideMove`, never by reaching
  into `GameState` directly, to keep the seam clean for stage 2.
- `src/data/cards.ts` + `decks.ts` — a 21-card Cortex faction pool and a
  20-card Swarm faction pool (13 + 8 unique cards), with a copy-limit rule
  (`COPY_LIMITS` by rarity) that `buildDeck()` actually enforces (throws on
  violation), not just a convention. This is a test pool for stage 1, not
  the "real card set" of stage 3.
- `src/cli.ts` — runs one full match and prints a human-readable log.
- `src/dev/effectSystemDemo.ts` — a deterministic, assertion-based proof
  (`node:assert`) that every required mechanic category actually resolves:
  keywords (Rush/Guard/Barrier), triggered (onPlay/onDamaged/onDeath),
  activated, static/continuous auras, targeted, AOE, conditional,
  state-mutating (board-scaling) stats, and a cross-card cascade combo
  (onDamaged → AOE → onDeath → draw). All 10 scenarios pass.

## Evidence committed

- `progress/sample-match-001.txt` — a full match (seed 1, Random-Cortex vs
  Aggressive-Swarm), 25 turns / 105 moves, resolved to a win, no crashes,
  no engine bugs hit.
- `progress/effect-system-demo.txt` — the 10 passing mechanic-proof
  scenarios described above.
- Stress-tested 60 seeds via `npx tsx src/cli.ts <seed>` with no crashes;
  turn lengths ranged 12–26 (mean 17.4), no draws, no turn-cap hits (cap is
  40). Winner split was 26 Random-Cortex / 34 Aggressive-Swarm across 60
  games — a real signal that greedy face-damage beats random play, which is
  the expected/sane direction, not proof of balance (there's no attempt at
  balance yet — see quality-debt.md).

## Concrete next step

Start build-order **stage 2: agent interface**. Right now `Agent.decideMove`
is an in-process TypeScript interface call — functionally clean (agents
only see `PlayerView` + `getLegalMoves` output, never `GameState`
directly) but not yet a wire protocol. Stage 2's job: define the actual
request/response shape (JSON over HTTP or a WebSocket — pick one, document
it), write a thin server that drives `runMatch`'s loop but asks a real
remote process for each move instead of calling `agent.decideMove()`
in-process, and port `RandomAgent`/`AggressiveAgent` (or new equivalents)
to speak that protocol from a separate process, so the loopback round-trip
is proven before any second agent language/runtime is attempted. Success
condition should mirror stage 1's: a full match log, but this time with at
least one agent's moves genuinely crossing a process boundary.

Do not start stage 3 (a real card set) or stage 6 (spectator render)
before this — see DESIGN.md's build order.
