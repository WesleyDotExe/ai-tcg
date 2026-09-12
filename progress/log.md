# Build log

## 2026-09-12 — Session 3 (stage 2: agent interface / real network protocol)

Read `progress/owner-feedback.md` first. The 2026-09-11 checkpoint feedback
is marked handled (no new action needed). A large 2026-09-12 design-directive
batch is present and UNHANDLED, but it explicitly scopes itself to stage 3+
(card systems, onboarding, economy, rarity) and stage 8 (platform) — not
stage 2 — so per its own "do NOT pull forward" instruction this session did
not act on it, beyond reading it so `progress/current.md`'s next-step note
can flag it for the run that starts stage 3. `progress/current.md` said the
concrete next step was stage 2 (agent interface); that's what this session
built.

**What I built, in order:**

1. **`protocol/PROTOCOL.md` first, before any code.** A language-agnostic
   WebSocket/JSON wire spec: `hello` → `matchStart` → repeated
   `requestMove`/`move` → `matchEnd`, plus a named "Faults" section
   (timeout, illegal move, malformed JSON, disconnect → immediate
   forfeit) and an honest "Not yet covered" section (matchmaking,
   reconnection, auth, spectators, 4-player mode — real gaps, not hidden).
   Writing the spec first, then a TypeScript mirror of it
   (`protocol/src/messages.ts`), rather than reverse-documenting whatever
   the code happened to do, was deliberate — PROTOCOL.md is what a future
   external agent implementer (stage 9) actually needs, and it has to be
   the source of truth, not an afterthought.
2. **Turned the repo into an npm workspace monorepo** (root
   `package.json`/`package-lock.json`, `workspaces: [engine, protocol,
   server, agents]`) so the new packages could depend on each other and on
   `@ai-tcg/engine` through real `node_modules` resolution rather than
   relative-path hacks across packages. Gave `engine/` a public barrel
   (`src/index.ts`) and an `exports` field so it's actually importable as
   `@ai-tcg/engine` — this only worked because `tsx` transpiles TypeScript
   on the fly even through workspace-symlinked `node_modules`, which I
   verified by running `npx tsc --noEmit` in all four packages, not just
   assuming it. Removed `engine/package-lock.json` (now redundant —
   confirmed the root lockfile actually contains engine's deps before
   deleting it, not just assuming workspaces would cover it).
3. **The one real behavioural change to the engine itself:**
   `Agent.decideMove` can now return `Move | Promise<Move>`, and
   `engine/src/engine/match.ts`'s `runMatch` is `async` and awaits it —
   because a real remote agent's move now takes an actual network round
   trip. `runMatch` also gained an optional `hooks.onMatchStart(state)`
   callback so a caller (the server) can observe the real initial state
   without reconstructing it separately and risking drift. Re-ran the
   engine's own stage-1 evidence after this change — `effectSystemDemo.ts`
   (all 12 scenarios) and `cli.ts` (seed 48) — to confirm the async change
   didn't regress anything; both matched prior behavior exactly.
4. **`server/` (`@ai-tcg/server`)**: a real `ws`-based WebSocket server.
   `RemoteAgent` implements the engine's `Agent` interface by sending
   `requestMove` over a socket and awaiting a `move` reply, validating it
   with a real structural deep-equal (not string comparison, so reply key
   order can't cause a false-positive fault) against the `legalMoves` list
   it just sent, with a 15s timeout. `cli.ts` pairs the first two
   connecting agents, assigns fixed Cortex/Swarm test decks, and drives
   the match through the engine's own (unmodified-in-logic) `runMatch` —
   the server does not reimplement the match loop.
5. **`agents/` (`@ai-tcg/agents`)** — the package that actually proves the
   seam is real: it has zero dependency on `@ai-tcg/engine`, in
   `package.json` or at runtime. `client.ts` is a generic WS harness;
   `randomAgentClient.ts` and `aggressiveAgentClient.ts` port the engine's
   `RandomAgent`/`AggressiveAgent` decision logic (which already only
   touched `PlayerView`/`Move`, never raw `GameState` — stage 1 built them
   that way on purpose) into standalone functions typed against
   `@ai-tcg/protocol` alone. Each is a runnable CLI — an actual separate
   OS process, not a simulated one.

**Then I proved it, the way TASKS.md requires — ran it, not just built it:**

- Started the server as a background process, then launched
  `randomAgentClient.ts` and `aggressiveAgentClient.ts` as two more
  separate `tsx` processes pointed at `ws://localhost:8080`. Captured
  stdout from all three processes. Result: a full real match, seed 48, 28
  turns, 421 moves, resolving cleanly to a p2 win — and both agent
  processes independently reported the identical winner/turn/move count
  the server did, confirming the wire round trip actually carried the
  real result, not just that the server thought it did.
  Committed as `progress/sample-match-003-networked.txt`.
- Specifically checked for a genuine instant-speed response crossing the
  process boundary (not just "the mechanic exists somewhere in a huge
  log") — found one at turn 28: Aggressive-Client (p2) declares an attack,
  passes priority, and Random-Client (p1), a separate process, receives a
  live `requestMove` mid-opponent's-turn and casts an Instant plus several
  activated abilities in response. This is the stage-1 reactive core,
  now proven over a real network round trip, not just in-process.
- **Live-tested both fault paths**, not just written them: a throwaway
  test client (not committed) that replies to `requestMove` with a
  structurally bogus move correctly triggered an `error` + forfeit, with
  the other client declared the winner; a second test where one client
  never replies correctly triggered the documented 15s timeout fault, same
  forfeit behavior. Watched both end-to-end from all sides' logs before
  concluding the fault-handling code actually works, rather than trusting
  that it compiled.

**What's blocked:** nothing. Stage 3 (a real card set) can start next; see
`progress/current.md` for what the unhandled 2026-09-12 owner feedback
batch means for how that card schema should be designed.

**Honest gaps:** see the new top section of `progress/quality-debt.md`.
The two biggest: the server hosts exactly one match then exits (no
matchmaking, no long-lived multi-match service — correctly deferred to
stage 4), and there is no automated regression test for the protocol layer
(the fault-path verification above was real but manual and not
committed as a repeatable script).

## 2026-09-11 — Session 2 (stage-1 redo: Magic-style priority/reactivity)

Read `progress/owner-feedback.md` first, as required. The owner responded
to the stage-1 checkpoint's four flagged decisions; the one requiring
action was #2: overrule the original Hearthstone-style turn model
(everything resolves instantly, no responses during the opponent's turn)
and rebuild it around Magic-style reactivity — instant-speed responses,
priority passing, held resources — as a foundational rebuild, not a
bolt-on, re-proven to the stage-1 evidence bar before moving to stage 2.
That's the entire scope of this session; per DESIGN.md's build order I did
not start stage 2 or touch anything else.

What I built, in `engine/`:

1. **A real priority algorithm** (`engine/engine.ts`): `GameState` gained
   `stack`, `priority`, and `passes`. `getLegalMoves` now keys legality off
   `state.priority` (who's entitled to act), with two timing tiers —
   "sorcery timing" (active player, empty stack: play a Unit/Directive,
   cast a Sorcery-speed Command/ability, declare an attack) and "any time
   you hold priority" (an Instant-speed Command/ability, or passing).
   `passPriority` replaces `endTurn`: two consecutive passes resolve the
   stack's top item if one exists, or end the turn if the stack is empty —
   the standard Magic rule, active player getting priority back first
   either way.
2. **Commands, activated abilities, and combat damage now use the stack**
   instead of resolving the instant they're played/declared. Combat damage
   in particular is computed *live at resolution time*, never snapshotted
   when the attack is declared — this is what makes a "combat trick"
   meaningful rather than cosmetic. Units and Directives still resolve
   immediately when played (a deliberate scope cut for this session, not
   a design gap I'm pretending doesn't exist — see quality-debt.md).
3. **`Speed: "Instant" | "Sorcery"`** added to Commands and to activated
   abilities, enforced by `getLegalMoves`. Added two new Instant-speed
   cards (Interrupt Handler — Cortex, kill a small threat in response;
   Reflex Spike — Swarm, a defensive combat trick) and made Cortex
   Engineer's repair ability Instant, specifically so both dummy agents
   would have real reactive options to exercise, not just a legal-move
   surface nobody ever uses.
4. **Agent-side changes**: `PlayerView` now exposes `priority` and the
   full (public) `stack`. `RandomAgent` needed only a rename. I gave
   `AggressiveAgent` one genuine reactive rule — outside its own main
   phase, if a pending combat-damage stack item would kill one of its
   units, prefer an instant that saves it — specifically so the stress run
   would show *purposeful* reactive play, not just random agents stumbling
   into instant-speed windows.

Then I proved it, the same way stage 1 required the first time:

- **`progress/effect-system-demo.txt`**: grew from 10 to 12 assertion-based
  scenarios. Scenario 11 drives the priority algorithm directly through
  `applyMove` — hands priority to the non-active player, has them cast a
  lethal removal spell, passes to give the other player a real response
  window, has that player activate their own Instant repair ability in
  response, and asserts the stack resolves **last-in-first-out**: the
  repair heals first, saving the unit from the removal spell that resolves
  after it. Scenario 12 does the same for combat: declares an attack
  (pushing pending combat damage), has the defender cast an Instant combat
  trick in response, and asserts the trick resolves before damage and
  changes who survives the trade. Both scenarios failed on first write (I
  under-counted how many passPriority pairs were needed to drain a
  two-deep stack) — fixed by tracing the actual algorithm, not by loosening
  the assertions.
- **`progress/sample-match-002-reactive.txt`**: a real match (seed 48, 28
  turns, 421 moves, resolves cleanly), hand-picked from a 60-seed stress
  run specifically because it shows the mechanic actually firing in normal
  play, not just in a controlled scenario: turn 7 has p1 declare an attack,
  then kill the defender outright with an Instant before combat damage
  resolves, correctly fizzling the now-targetless attack instead of
  crashing. This supersedes `sample-match-001.txt` as the stage-1 evidence
  file (kept for history; its log format predates the rebuild).
- **60-seed stress run**, zero crashes. Turn lengths mean 16.2 (still well
  under the 40-turn cap). I specifically measured how often the new
  mechanic shows up in unscripted play, not just whether it *can* work: 16
  of 60 matches (27%) had a genuine cross-turn instant-speed response —
  real evidence the reactive surface gets used, not just that it exists.

**What's blocked:** nothing. The next run can go straight to stage 2 per
`progress/current.md` — the protocol shape now needs to carry priority
windows and the public stack, not just "your turn, pick a move," but the
in-process `PlayerView` already models that correctly.

**Owner feedback:** marked handled in `progress/owner-feedback.md`, with
notes on what was (and wasn't yet) done for each of the four points.

**Checkpoint:** this redo doesn't complete a *new* build-order stage (it's
stage 1, still), but it reverses a checkpoint decision the owner flagged as
overrulable, at real cost (a foundational rebuild), so I wrote a follow-up
checkpoint entry in `progress/checkpoints.md` rather than staying silent
until stage 2 completes.

**Honest gaps:** see the new top section of `progress/quality-debt.md` —
written before stopping, not as an afterthought. The two biggest: only
Commands/abilities/combat-damage use the stack (permanents don't), and
triggered abilities still resolve immediately rather than getting their
own priority window.

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
