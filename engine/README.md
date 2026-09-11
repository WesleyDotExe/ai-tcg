# engine

Headless rules engine for AI-TCG — build-order stage 1. No rendering, no
network, no persistence: card schema, game state, turn structure, and a
data-driven effect/ability system, playable end-to-end by two in-process
dummy agents. See `../DESIGN.md` for the full vision and `../TASKS.md` for
how sessions on this repo work.

## Layout

- `src/cards/` — the card schema and the effect/ability type system
  (`Ability`, `EffectSpec`, `Condition`, `TargetSpec`, `ScalingAmount`).
  Everything a card can do is data these types describe; the engine never
  special-cases a card by name or id.
- `src/state/` — `GameState` and friends, a seeded RNG, match setup, and
  derived-stat queries (current attack/health are always computed live,
  never cached).
- `src/effects/` — targeting, conditions, static-aura aggregation, and the
  resolver (`resolveAbility`, `applyDamage`, `applyHeal`, `processDeaths`).
- `src/engine/` — legal-move enumeration, move application, turn
  structure, and `runMatch`.
- `src/agents/` — the `Agent`/`PlayerView` interface and two dummy agents
  (`RandomAgent`, `AggressiveAgent`). This interface is deliberately shaped
  like a future network protocol boundary (see build-order stage 2).
- `src/data/` — a two-faction test card pool and deck builder, built to
  exercise every mechanic category, not to be a balanced "real" set (stage
  3 is that).
- `src/cli.ts` — runs one full match, prints a readable log.
- `src/dev/effectSystemDemo.ts` — deterministic, assertion-based proof that
  every required mechanic category (keywords, triggered, activated,
  static/continuous, targeted, AOE, conditional, state-mutating, plus a
  cross-card cascade) actually resolves correctly.

## Running it

```sh
npm install
npm run typecheck        # tsc --noEmit
npm run match [seed]     # play one full match, print the log (default seed 1)
npm run demo             # run the effect-system proof scenarios
```
