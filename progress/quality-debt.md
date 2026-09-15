# Quality debt (honest, specific — read before adding anything new)

Written at the end of session 1, updated at the end of the stage-1 redo
session (priority/reactivity rebuild), the stage-2 (agent interface)
session, the stage-3 (real card set / board-development system) session,
the session-5 hardening pass (checkpoint feedback + automated test runner),
session 6 (backfilling Cortex/Swarm with board-development cards), and now
session 7 (first cross-faction balance measurement + a real crash fix).
This is not "no debt, all good" — the product is real and the evidence is
real, but here is where it's thin.

## New debt from session 7

- **The balance measurement is a one-off script, not a standing regression
  gate.** `matchSmoke.test.ts` runs on every `npm test` and would catch a
  future crash-class bug the same way it would have caught this session's
  Retaliation Node stack overflow if it had been running enough seeds to
  hit it (it wasn't — 15 seeds/matchup, alternating agents, never happened
  to put two Retaliation Nodes on opposite boards). `balanceReport.ts` has
  to be run by hand (`npm run balance --workspace=engine`); nothing
  re-runs it in CI or flags a *new* balance regression automatically if a
  future card addition reintroduces a dominant archetype. Worth turning
  into a slow/opt-in CI job once the card pool is bigger and balance
  regressions become a real ongoing risk, not urgent yet with 3 factions.
- **Balance tuning stopped at "no double-flagged pairing," not a specific
  target.** Cortex-vs-Aegis (Aggressive, 70.0%) and Cortex-vs-Swarm
  (Random, 72.0%) still individually exceed the 60% flag threshold after
  this session's fix — see `progress/balance-report-001.txt`'s "honest
  read" section. This is real, partial progress, explicitly not a claim
  that the three factions are balanced now.
- **Swarm-vs-Aegis (61.3% Swarm, both before and after) was measured but
  not investigated or acted on this session** — it wasn't touched by
  either of the two card changes made, and finding its root cause is
  unstarted work, not a false claim of being fixed.
- **The stat-outlier/removal-density root-cause read for Cortex's
  dominance is a plausible, evidence-consistent explanation (the fix that
  followed from it worked, measurably), not a rigorously isolated proof.**
  Overload Capacitor and Interrupt Handler were changed together in one
  pass; a controlled experiment (change one, re-measure, then the other)
  was not run, so the report can't say how much of the improvement came
  from which change.
- **Two other onDamaged-AOE cards exist that weren't audited for the same
  mutual-recursion class of bug** as Retaliation Node: Cascade Purge and
  Diagnostic Pulse deal damage via `onPlay`, not `onDamaged`, so they don't
  self-trigger the same way — but this was reasoned about after the fact,
  not verified by grepping every `onDamaged` ability in the pool for "does
  its effect deal damage to something that could itself have `onDamaged`
  with a damaging effect." Retaliation Node (Cortex) is the only current
  card with that exact shape, but a future card with an `onDamaged` effect
  that deals damage should be checked against this class of bug
  specifically, not just trusted because the engine-level fix (checking
  `isAlive()`) happens to generalize correctly — it does generalize (the
  fix is in the shared `applyDamage` choke point, not per-card), but no
  test proves a *three*-unit or *self-damaging* mutual-retaliation chain
  behaves correctly, only the two-unit case this session found.
- **AggressiveAgent was observed spamming a repeatable Instant-speed
  activated ability (Cortex Engineer's heal) many times in a single
  priority window even near full health**, visible in
  `sample-match-007-retaliation-fix.txt`'s turn 18 (six consecutive
  activations). Harmless (energy-gated, no infinite loop, no crash) but a
  real agent-quality gap: the heuristic has no "is this actually useful
  right now" check for its one reactive rule, just "if any playCard/
  activateAbility move exists here, use it." Not fixed this session
  (agent-quality tuning, out of scope for a balance-measurement session),
  named here so it isn't rediscovered as a surprise.

## Resolved this session (session 6)

- **"Cortex and Swarm don't use telegraph/evolution/tools" — resolved,
  with a caveat.** Both factions now have one evolution line, one
  telegraph card, and one Tool card each (`engine/src/data/cards.ts`),
  proven live in `progress/sample-match-006-backfill.txt` and covered by
  `engine/test/boardDevelopmentBackfill.test.ts`. The caveat: this proves
  the system is genuinely cross-faction, not that Cortex/Swarm now match
  Aegis's *density* of board-development cards (Aegis has two telegraphed
  units and three Tools each) — see "New debt from session 6" below.
- **Stale "No CI wiring" claim in the Testing section, below — fixed.**
  Session 5 added `.github/workflows/test.yml` but the debt file was never
  updated to say so, leaving a self-contradicting claim next to
  `progress/current.md`/`progress/log.md`'s session-5 entries, which
  correctly described the workflow as already existing. Confirmed the
  workflow file is real (it runs `npm run typecheck --workspaces
  --if-present` and `npm test` on every push/PR against `main`) before
  correcting the claim.

## New debt from session 6

- **Cortex's deck is now exactly at the enforced 40-card ceiling**
  (`decks.ts`'s `MAX_DECK_SIZE`). Any further Cortex card needs either a
  cut elsewhere in the pool or that constant (itself an untuned first
  proposal from session 4) to move — a real constraint on the "raise
  Cortex/Swarm's board-development density toward Aegis's" option named as
  a next step.
- **Cortex/Swarm board-development density is well below Aegis's.** One
  evolution line / one telegraph / one Tool each, versus Aegis's one
  evolution line (3 cards deep: Cadet→Sentinel→Warden), two telegraphs, and
  three Tools. The mechanic is proven cross-faction now; it is not yet
  *rich* cross-faction. Not a hidden gap — named as the leading option for
  the next session's own next-step note.
- **Molted Stalker evolving from Swarm Larva gives that card two
  competing roles** (a disposable 1-drop played 3x, and evolution fodder a
  deck might want to hold back instead) with zero playtesting or agent
  heuristic awareness of the tension — `RandomAgent`/`AggressiveAgent` have
  no concept of "hold this back to evolve later," so nothing in current
  play actually exercises that decision meaningfully; it's only provable
  mechanically (the whitebox test), not yet observed as a real strategic
  choice in unscripted play.
- **Dormant Exploit's 2-turn Stasis duration and Overclock Shunt's Rush
  grant are both first-guess numbers/interactions, not playtested.** In
  particular, Tool-granted Rush is a new *kind* of interaction (a Tool
  changing legal-move generation, not just live stats/combat) — mechanically
  correct and tested, but its power level (a 1-cost tool turning any unit
  into a same-turn attacker) hasn't been weighed against the rest of the
  Cortex curve.
- **No archetype-level soft-counter analysis exists between the three
  factions** (Cortex/Aegis/Swarm), despite three factions having existed
  since session 4 — design principle 3 names this explicitly and nothing
  has measured or designed for it yet. Not this session's scope, but it's
  aging: every session that adds card-set width without touching this makes
  a future balance pass larger.

## Resolved in session 5 (hardening pass)

- **"No real test runner" — fixed.** `vitest` is now wired up
  (`engine/test/`, `npm test`), replacing `effectSystemDemo.ts` (deleted)
  with 20 individually-reported tests, including a new match-smoke suite.
  See `progress/current.md`/`progress/log.md` for detail. This was the
  single most-repeated item in this file across three sessions — resolved,
  not just re-flagged again.
- **"Nothing stops evolving a unit the same turn it was played" — fixed**
  per the owner's explicit overrule (2026-09-13 stage-3 checkpoint
  feedback, item 4). `moves.ts` now requires `enteredTurn < turnNumber`.
  Regression-tested and re-proven in real play (see
  `progress/sample-match-005-boarddev-fixed.txt`).

## New debt from session 5 (hardening pass)

- **`matchSmoke.test.ts`'s 15-seeds-per-matchup sample is much smaller than
  the 300-game manual stress run session 4 ran** (traded off deliberately
  for keeping `npm test` fast — see `progress/current.md`'s "decisions the
  owner might want to overrule"). It's real, automated, always-run
  coverage that didn't exist before, but it's a smoke test, not a
  statistically deep balance/crash-rate measurement; a genuine "300+ games,
  measure the distribution" pass is still something that would need to be
  its own explicitly-invoked script (or a much slower CI-only test) if the
  owner wants that rigor as a standing, repeatable artifact rather than a
  one-off manual run.
- **The vitest suite covers only `engine`.** `server`'s protocol layer
  (fault paths: illegal move → forfeit, timeout → forfeit) and `agents`
  still have zero automated tests — the exact gap already named below
  under "New debt from stage 2." The test-runner infrastructure now exists
  to fix this cheaply (vitest could be added to those packages the same
  way), but it wasn't done this session, which stayed scoped to what the
  owner's feedback entry actually asked for (engine-focused: the rule fix,
  the energy docs, and "the" test runner, which in context clearly meant
  the engine's hand-written demo scripts specifically).
- **Telegraph delay=2's card choice (Latent Ward) is a judgment call, not
  a playtested or owner-confirmed one.** The owner asked to "try delay=2
  on some telegraph cards and compare how the window feels" — this session
  changed the data and confirmed it still fires correctly in real play,
  but there's no render or spectator experience yet to actually judge
  "how it feels," so the comparison the owner asked for is only
  mechanically possible right now, not yet meaningfully answered.
- **No exception path for "evolve immediately despite entering this
  turn."** The same-turn-evolve fix has no keyword/flag equivalent to
  Rush's summoning-sickness bypass — if a future card wants that as a
  deliberate payoff, it needs new schema work, not just a data flag on
  the existing field.

## Older debt from stage 3 (board-development system / Aegis card set)

- **Evolution strict-vs-loose was decided unilaterally for this first
  implementation**, even though `owner-feedback.md`'s design-directive
  batch explicitly named it an open question to propose, not resolve.
  Only strict (exact base card id) is built; a looser tier-based
  requirement would need real schema work (a tier number rather than a
  specific id) if the owner prefers it. Flagged at the new checkpoint.
- **Telegraphed units keep full stats and are fully targetable while
  pending, but their `onDamaged`/`onDeath` triggers still fire normally if
  killed while dormant.** A pending unit is meant to be "not yet really
  here," but if a card ever wants "this ability shouldn't fire while
  dormant" (e.g. an onDeath draw effect), there's no gate for that —
  every ability except the deferred `onPlay` behaves as if the unit were
  fully active. No current Aegis card exposes this gap (none of the
  telegraphed units have onDamaged/onDeath abilities), so it's untested
  and unresolved rather than incorrect-and-shipped.
- **Tool cards have no ability timeline of their own** — only a flat stat
  bonus and granted keywords (`ToolCard.attackBonus`/`healthBonus`/
  `grantedKeywords`). A Tool that wants an onPlay-style "when attached,
  also do X" effect, or a triggered ability of its own once attached,
  needs new schema work; this was a deliberate scope cut for the first
  implementation, not an oversight, but it does mean Tools are mechanically
  the shallowest of the three new card types.
- **The evolution/Tool structural target and a card's own "chosen"
  ability-target share nothing** — `playCard`'s single `target` field is
  used for the evolution base / Tool host, so no evolution or Tool card in
  this set can *also* have an onPlay effect that needs a separately-chosen
  target (e.g. "when this evolves in, deal damage to target enemy unit").
  Every Aegis evolution/Tool onPlay effect was deliberately written as
  untargeted or self-targeting to avoid this gap. Extending `Move`/
  `playCard` to carry two independent target refs is the real fix, not
  attempted this session.
- **`BOARD_SLOTS` (6, shared between Units and Directives) and `telegraph`
  timing (1 controller-turn) are first proposals, not playtested
  numbers.** The 300-game stress run (see `progress/current.md`) confirms
  they don't break pacing (mean ~17 turns, well under the 40-turn cap,
  consistent with pre-stage-3 numbers) but says nothing about whether 6
  slots feels right strategically — that needs real play, not a stress
  run of two dummy agents.
- **Aegis (14 unique cards) is a real faction, not yet a rich one.** It
  covers the new system plus baseline variety, but has less internal
  depth than Cortex (14 unique, but built to prove every effect-system
  category individually) or genre norms for "a set." No archetype-level
  soft-counter relationship between Aegis and Cortex/Swarm has been
  designed or measured yet (design principle 3) — three factions now
  exist, which is the minimum for a real rock-paper-scissors triangle, but
  nobody has checked whether one actually forms.
- **Cortex and Swarm don't use telegraph/evolution/tools — RESOLVED,
  session 6.** See this file's "Resolved this session (session 6)" section
  at the top and `progress/current.md`. Left here, struck through in
  spirit rather than deleted, so the historical record of what stage 3
  actually shipped stays intact.

## New debt from stage 2 (agent interface / network protocol)

- **The server hosts exactly one match then exits.** `server/src/cli.ts`
  pairs the first two connections, plays one match, and closes. There is
  no matchmaking queue, no way to host multiple concurrent matches, and no
  persistence of results anywhere — all correctly deferred to stage 4
  (match server), but worth naming so nobody mistakes the current
  `server/` package for more than a stage-2 protocol proof.
- **No automated protocol test.** The fault-path verification (illegal
  move → forfeit, 15s timeout → forfeit) described in `progress/log.md`
  was real and observed end-to-end, but it was a manual, throwaway test
  client, not a committed, repeatable script. Unlike `effectSystemDemo.ts`
  for the engine, there is no `protocolDemo.ts`-equivalent a future run
  can re-run to confirm the fault paths still work after a change. This
  should graduate to a real committed test before the protocol gets more
  complex (e.g. once matchmaking or reconnection are added in stage 4).
- **Fixed test decks, no deck selection in the protocol.** `cli.ts`
  hardcodes Cortex-for-p1/Swarm-for-p2 regardless of which agent connects
  first. `hello` carries only an `agentName`. Real deck submission (an
  agent should be able to say what deck it's playing, or the server should
  look one up from a collection) is stage 5 (economy/boosters) work, named
  in PROTOCOL.md's "Not yet covered" rather than silently assumed away.
- **No authentication, no reconnection, no spectator feed.** All three
  are named explicitly in PROTOCOL.md's "Not yet covered" section. Anyone
  who can reach the server's port can connect as any `agentName`; a
  dropped connection is a hard fault, not a resumable pause; the event log
  the server already produces isn't exposed to anything but the two
  playing agents. None of these block stage 3 (card set), but stage 9
  (open agent onboarding) cannot ship without at least authentication.
- **`RemoteAgent`'s illegal-move detection is structural (deep-equal) but
  only checks against the exact `legalMoves` list from the *matching*
  `requestId`.** A client that replies to a stale/superseded `requestId`
  (from a previous `requestMove` it already answered, or one that was
  never sent) is silently ignored rather than treated as a fault — this
  was a deliberate choice (see `remoteAgent.ts`'s comment: "stale or
  unsolicited reply — ignored, not a fault") on the theory that a
  confused-but-not-malicious client shouldn't be forfeited for a stale
  message, but it also means a client could send garbage on old
  `requestId`s indefinitely without consequence. Not exploitable to affect
  the actual match (the server only ever acts on a reply matching the
  live pending request), but worth flagging as an asymmetry: the "ignore
  vs. fault" line was drawn without owner input.
- **`agents/src/rng.ts` duplicates `engine/src/state/rng.ts` byte-for-byte**
  (same mulberry32 implementation). This was a deliberate architectural
  choice (a real external agent would bring its own RNG, not import ours;
  `agents/` has zero runtime dependency on `@ai-tcg/engine` on purpose) —
  named here so it reads as an intentional decision, not an oversight, if
  the two ever need to change independently and drift.

## Debt from the priority/reactivity rebuild (session 2)

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

- **Updated, session 5:** there is now a real automated test runner
  (`vitest`, `engine/test/`, 20 tests, `npm test`) — the rest of this
  entry is what's still missing, not a restatement of the old "no runner
  at all" gap. `cli.ts` and `aegisMatchDemo.ts`/`backfillMatchDemo.ts`
  remain manual/eyeballed real-match evidence generators (that's their
  job — narrated human-readable logs, not assertions), not a substitute
  for the assertion suite anymore.
- **CI wiring — fixed, session 5** (`.github/workflows/test.yml`, added
  same session as the test runner itself; this line previously and
  incorrectly still said "no CI wiring" — corrected in session 6 after
  confirming the workflow file is real). `npm run typecheck --workspaces
  --if-present` and `npm test` now run on every push/PR against `main`,
  and `auto-merge.yml` waits on it by name.
- **`server`/`protocol`/`agents` have zero automated tests** (see this
  session's new debt section above) — only `engine` was covered.
- Untested paths I know of: simultaneous lethal (both players' health
  reaching 0 on the same resolution → draw) has code
  (`checkGameOver`) but no test exercising it; a unit carrying two
  statuses at once (e.g. Overload + Stasis) has no test proving they
  don't interfere with each other's duration bookkeeping; a stack three or
  more items deep (named below under the priority-rebuild debt) also has
  no test.

## Pacing

- DESIGN.md's "5–6 minute watchable match" principle is measured here only
  as turn-count/move-count (mean 17.4 turns over 60 games, well under the
  40-turn cap — see `progress/current.md`). That's a legitimate proxy for
  "does the game end in a reasonable number of decisions," but it isn't
  the real target metric, which is wall-clock watch time once there's a
  render with real animation pacing. Don't tune further against turn-count
  alone once stage 6 exists — re-measure against real time then.
