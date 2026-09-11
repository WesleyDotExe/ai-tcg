# Quality debt (honest, specific — read before adding anything new)

Written at the end of session 1, updated at the end of the stage-1 redo
session (priority/reactivity rebuild). This is not "no debt, all good" —
the product is real and the evidence is real, but here is where it's thin.

## New debt from the priority/reactivity rebuild (this session)

- **Only Commands, activated abilities, and combat damage use the stack.**
  Units and Directives are deliberately still sorcery-speed-only and
  resolve immediately when played, skipping the stack entirely — a
  scoping decision to keep this session's rebuild bounded, not something
  DESIGN.md asked for explicitly. The practical effect: you cannot
  currently respond to a creature/permanent *entering* play, only to
  spells, abilities, and attacks. If the real card set (stage 3) wants
  "counter target creature spell"-style effects, permanents will need to
  start using the stack too — a real (if mechanical) follow-up, not a
  redesign.
- **Triggered abilities (onPlay/onAttack/onDamaged/onDeath/onTurnStart/
  onTurnEnd) still resolve immediately when they fire, not through the
  stack.** Only the *effect a player deliberately casts/activates* — a
  Command, an activated ability, or a declared attack's damage — gets a
  priority window before it resolves. A triggered ability firing off one
  of those (e.g. Watchtower Relay's onTurnStart energy gain) cannot itself
  be responded to. This mirrors a simplification a lot of digital TCGs
  make, but it is a real simplification versus paper Magic, not the full
  model, and should be named as a decision if the owner reviews it.
- **Nothing can target or interact with the stack itself.** There is no
  "counter target spell" effect kind yet — TargetSpec/EffectSpec have no
  way to reference a StackItem. Natural next step once the effect system
  needs it; not attempted this session (would need real design work on
  what "counter" means for abilities/combat damage, not just spells).
- **`fizzle` logging only covers combat damage.** A spell/ability whose
  chosen target vanishes before it resolves off the stack still silently
  no-ops (via the existing `findUnit`-returns-undefined guards in
  effects/resolver.ts) exactly as it did before this rebuild — it just
  couldn't happen pre-rebuild since nothing was deferred. This is
  survivable (no crash, no wrong damage) but not narrated in the log the
  way a genuine fizzle is for combat.
- **AggressiveAgent's reactive heuristic is narrow.** It only recognizes
  one shape of "worth responding to": a pending combat-damage stack item
  that would kill one of its own units, at which point it looks for a
  legal instant that targets either the threatened unit or the attacker.
  It does not evaluate whether a *spell* targeting its board is worth
  responding to (only combat), does not hold instants up proactively for
  value, and — like the original heuristic — has no lookahead. RandomAgent
  needed no changes here: picking uniformly among legal moves already
  produces genuine, unscripted reactive lines (confirmed in the 60-seed
  stress run — see progress/current.md).
- **Move-count roughly doubled** (mean ~162 vs. the pre-rebuild ~100) purely
  from explicit pass-priority bookkeeping — every single resolution now
  takes two passPriority moves. This is expected and not a balance signal,
  but anything that used `movesPlayed` as a rough proxy metric elsewhere
  should be aware the scale changed.
- **New scenarios (11–12) cover the core algorithm but not its edges.**
  Untested: a stack three or more items deep, both players responding
  more than once in the same window, or an Instant cast mid-resolution of
  another Instant on the *same* player's own main phase interacting with
  sorcery-timing legality at the boundary. The core LIFO-resolution and
  cross-turn-response paths are proven; deeper interleavings are not.

## Architectural gaps

- **The agent interface isn't a protocol yet.** `Agent.decideMove(view,
  legalMoves)` is a same-process TypeScript call. `PlayerView` is already
  shaped like a redacted network payload (no opponent hand/deck), and
  agents never touch `GameState` directly, so the seam is real — but until
  stage 2 actually puts a process/network boundary there, "clean seams"
  is a design intention I've followed, not something proven under an
  actual boundary. Don't count stage 2 as partially done because of this.
- **Triggered abilities can't use "chosen" targeting, and nothing enforces
  that.** `resolveAbility` requires a `chosen` target for scope "chosen",
  but onAttack/onDamaged/onDeath/onTurnStart/onTurnEnd fire automatically
  with no agent-decision hook to supply one — it would throw at runtime.
  I avoided this in every card I wrote (using random/all/self instead),
  but there is no type-level or data-validation check stopping a future
  card (or a future me) from writing a triggered ability with
  `targeting: {scope: "chosen"}` and only discovering the crash when that
  trigger actually fires in a game. This needs either a validation pass
  over the card pool at load time, or a real design for opponent-facing
  reactive choices (Magic-style "target player chooses" at trigger time),
  before the card pool grows much further.
- **Directives can never leave play.** There's no destroy/remove path for
  a Directive once played — no card in the pool tries to remove one, and
  the engine has no code for it. A "destroy target directive" effect would
  need new work, not just a new card.
- **No "summon" effect kind.** Can't create token units. Not used by any
  card in the current pool, but it's a common-enough mechanic in the genre
  that its absence is a real gap, not an oversight to leave undocumented.

## Card pool / balance

- The 21-card Cortex / 20-card Swarm pools exist to exercise every
  mechanic category (that's proven — see `effectSystemDemo.ts`), not to
  be balanced. Stats and costs are estimates, not playtested numbers.
- The 60-seed stress run's 34/26 win split (Aggressive-Swarm over
  Random-Cortex) is exactly what you'd expect from "greedy heuristic beats
  blind random" and says nothing about faction balance or metagame health.
  Don't read it as a balance signal.
- Deck construction currently enforces only the copy limit. There's no
  minimum/maximum deck size rule, no format restriction. Fine for a stage-1
  test pool; don't assume "deck construction" is a solved stage-5 problem
  because copy limits work.

## Agent quality

- `AggressiveAgent`'s target-selection heuristic estimates unit health from
  base stats + buffs only (`approximateHealth` in `aggressiveAgent.ts`) —
  it ignores live static auras, so it can occasionally misjudge a trade
  when an aura is in play. This is acceptable for a "dumb" stage-1 agent
  (the whole point is that real agents arrive in stage 2+), but it means
  the agent is *less* accurate than the engine it's playing against, which
  is a slightly odd asymmetry worth knowing about rather than discovering
  later.

## Testing

- All verification is two hand-written scripts (`cli.ts` for a real match,
  `effectSystemDemo.ts` for 10 assertion-based mechanic scenarios), run
  manually. There is no test runner (vitest/etc.), no CI wiring, and no
  regression protection — a future change could silently break a scenario
  that isn't in the current 10 without anyone noticing until a manual
  re-run. This should graduate to real automated tests soon, certainly
  before stage 3's larger card pool makes manual verification impractical.
- Untested paths I know of: simultaneous lethal (both players' health
  reaching 0 on the same resolution → draw) has code
  (`checkGameOver`) but no scenario exercising it; a unit carrying two
  statuses at once (e.g. Overload + Stasis) has no scenario proving they
  don't interfere with each other's duration bookkeeping.

## Pacing

- DESIGN.md's "5–6 minute watchable match" principle is measured here only
  as turn-count/move-count (mean 17.4 turns over 60 games, well under the
  40-turn cap — see `progress/current.md`). That's a legitimate proxy for
  "does the game end in a reasonable number of decisions," but it isn't
  the real target metric, which is wall-clock watch time once there's a
  render with real animation pacing. Don't tune further against turn-count
  alone once stage 6 exists — re-measure against real time then.
