# Current status

**Build-order stage: 1 (Rules engine, headless) — COMPLETE, and REDONE per
owner feedback to add Magic-style reactivity.**

The owner's stage-1 checkpoint feedback (see `progress/owner-feedback.md`,
now marked handled) overruled the original Hearthstone-style turn model:
build a real priority-passing system with instant-speed responses before
moving to stage 2. That's what this session did — a foundational rebuild
of the turn/priority core, not a bolt-on.

## What stands

`engine/` is a TypeScript/Node package with no runtime dependencies:

- `src/cards/types.ts` — the card schema and the data-driven ability/effect
  system: `Card` (Unit/Command/Directive), `Ability`, `EffectSpec`,
  `Condition`, `TargetSpec`, `ScalingAmount`, and now `Speed` ("Instant" |
  "Sorcery") on Commands and on activated abilities. No card is ever
  special-cased by id/name anywhere in the engine — every card's behaviour
  is data these generic types describe.
- `src/state/` — `GameState`/`PlayerState`/`UnitInstance`, a seeded RNG,
  match setup, derived-stat queries, and (new) `GameState.stack` /
  `priority` / `passes` — the state the priority algorithm runs on.
  `StackItem` (in `state/types.ts`) is a command cast, an ability
  activation, or pending combat damage, each carrying what it needs to
  resolve later rather than immediately.
- `src/effects/` — the resolver: targeting, conditions, static auras,
  scaling, and `resolveAbility`/`applyDamage`/`applyHeal`/`processDeaths`.
  Unchanged in *what* it does — it's now invoked from stack resolution
  instead of always inline, but a resolving ability doesn't know or care
  whether it's being called immediately or off the stack.
- `src/engine/` — **the rebuilt core.** `getLegalMoves` now keys legality
  off `state.priority` (whoever is entitled to act next), not always
  `state.activePlayer`: Units/Directives/Sorcery-speed
  Commands/abilities/attacks are only legal at "sorcery timing" (active
  player, empty stack); Instant-speed Commands/abilities are legal for
  whoever holds priority, any time, including the non-active player mid
  opponent's-turn or in response to something already on the stack.
  `applyMove` dispatches on `state.priority` as the actor. Casting a
  Command or activating an ability now pushes a `StackItem` instead of
  resolving it; declaring an attack pushes a `combatDamage` stack item
  computed **live at resolution time** (never snapshotted at declaration),
  so a response that buffs/heals/kills either side before it resolves
  genuinely changes the outcome. `passPriority` (replacing the old
  `endTurn` move) is the whole algorithm: two consecutive passes resolve
  the top of the stack if non-empty, or end the active player's turn if
  the stack is empty — the standard Magic priority rule, including "active
  player gets priority first" after anything resolves. Units/Directives
  still resolve immediately when played (a scoped simplification — see
  quality-debt.md), and turn structure (energy climb/refill, draw,
  summoning sickness, Guard, the 40-turn tiebreak cap) is otherwise
  unchanged from stage 1's original build.
- `src/agents/` — `PlayerView` now exposes `priority` and the full `stack`
  (public information, same as Magic's). `RandomAgent` needed only a
  rename (`endTurn` → `passPriority`) — picking uniformly among legal
  moves already produces genuine, unscripted instant-speed responses.
  `AggressiveAgent` gained one real reactive rule: outside its own main
  phase it looks for a pending lethal combat threat to one of its units
  and prefers an instant that saves it (targets the threatened unit or its
  attacker) over anything else.
- `src/data/cards.ts` + `decks.ts` — the existing 21+20 card Cortex/Swarm
  test pools, now with explicit `speed` on every Command, plus two new
  Instant-speed cards built specifically to exercise reactivity:
  **Interrupt Handler** (Cortex, Instant, 2 damage to an enemy unit) and
  **Reflex Spike** (Swarm, Instant, +0/+3 to a friendly unit this turn).
  Cortex Engineer's activated repair ability is now Instant-speed too.
- `src/dev/effectSystemDemo.ts` — the assertion-based mechanic proof, now
  12 scenarios (was 10). Scenarios 1–10 unchanged in intent (updated only
  to drain the stack where a Command/ability cast now defers resolution).
  New: **scenario 11** proves priority passes correctly between players and
  that the stack resolves last-in-first-out — a unit's own Instant-speed
  repair ability, cast in response to a lethal removal spell already on
  the stack, resolves first and saves it. **Scenario 12** proves an
  Instant-speed combat trick cast in response to a declared attack resolves
  before combat damage and changes who survives the trade.

## Evidence committed

- `progress/sample-match-002-reactive.txt` — **new**, supersedes
  `sample-match-001.txt` as the stage-1 evidence. Seed 48, 28 turns, 421
  moves, resolves to a clean win. Turn 7 shows a real instant-speed kill
  (Interrupt Handler) fired in response to a declared attack, correctly
  fizzling the now-targetless pending attack; later, Cortex Engineer's own
  Instant repair fires mid-exchange. `sample-match-001.txt` is kept for
  history but predates the priority rebuild — its log format (no
  priority-pass/stack lines) reflects the old engine, not the current one.
- `progress/effect-system-demo.txt` — all 12 scenarios passing, including
  the two new priority/reactivity proofs described above.
- Stress-tested 60 seeds via `npx tsx src/cli.ts <seed>` with no crashes.
  Turn lengths: mean 16.2, min 12, max 29 (cap is 40, never hit). Moves per
  match roughly doubled vs. the pre-rebuild numbers (mean ~162 vs. ~100) —
  expected, since every resolution now takes two explicit passPriority
  moves; not a balance signal. Winner split 46 Aggressive-Swarm / 14
  Random-Cortex (still just "greedy beats random," now including
  reactive plays — not a faction-balance signal; see quality-debt.md).
  **16 of the 60 matches (27%) showed a genuine cross-turn instant-speed
  response** — one player acting with priority during the other's turn,
  not scripted, an emergent result of two dummy agents actually using the
  new legal-move surface.

## Concrete next step

Start build-order **stage 2: agent interface**. This was already the plan
before the owner's redo request; nothing about the priority rebuild
changes that direction, but it does change what stage 2's protocol needs
to carry: a real network protocol now has to expose priority windows (not
just "your turn, pick a move"), the public stack, and instant-speed
response opportunities — `PlayerView` already shapes this correctly
in-process (see `agents/agent.ts`), so stage 2's job is still "turn this
exact shape into a real request/response wire format (JSON over HTTP or a
WebSocket — pick one, document it), write a thin server that drives
`runMatch`'s loop but asks a real remote process for each move instead of
calling `agent.decideMove()` in-process, and port `RandomAgent`/
`AggressiveAgent` (or new equivalents) to speak that protocol from a
separate process." Success condition mirrors stage 1's: a full match log,
this time with at least one agent's moves — ideally including an
instant-speed response — genuinely crossing a process boundary.

Do not start stage 3 (a real card set) or stage 6 (spectator render)
before this — see DESIGN.md's build order.
