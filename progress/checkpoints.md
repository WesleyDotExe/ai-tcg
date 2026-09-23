# Checkpoints

Newest first. Each marks a completed build-order stage — flagged for the
owner's steering, never a block on continuing.

---

## AWAITING FEEDBACK — Stage 3 balance pass: the ring after Null step 4 + Swarm buff (2026-09-23, session 17)

Not a full build-order stage completion — flagged because the 2026-09-23
owner-feedback entry ("Phase 4 decisions") explicitly asked for the whole
ring to be re-measured and the result checkpointed after doing its two
authorized changes, and because this session made several real, unassigned
judgment calls the owner should see before Phase 5 (pool expansion) opens.

**What this session delivered, with evidence:**

1. Raised Kernel Panic (5->6) and Null Singularity (6->7) — the entry's own
   step 4, the two played-win-rate outliers session 16 flagged but declined
   to touch unilaterally. `engine/src/data/nullCards.ts`.
2. Gave Swarm two new cards for real go-wide resilience: Colony Broodling
   (cost 1, dies -> summons a replacement Swarm Larva if 2+ other units
   survive it) and Overgrown Carapace (cost 3, health scales live with the
   controller's own unit count). Both reuse only already-generic engine
   mechanisms. `engine/src/data/cards.ts`.
3. Re-measured the whole ring (300 seeds/matchup, 3 policies):
   `progress/balance-report-011-phase4-decisions.txt`.

**Honest result: no pairing is within the ring's band yet, but both changes
moved the numbers in the places they targeted, not noise.** Aegis-vs-Null
moved down under ALL THREE policies for the first time in this project's
history (78.0/72.0/67.7 -> 75.7/70.0/65.3) — still triple-flagged, did not
reach the entry's own "stop at 55-60%" condition. Swarm-vs-Null stopped
being triple-flagged entirely (was Null 56.0/79.0/67.3, all >=60%; now only
Random remains flagged at 75.7%, Aggressive is dead even, Lookahead is
56.7%) — real, multi-policy movement on the ring's single most
structurally-wrong edge. Cortex-vs-Swarm, untouched by either change, is
unchanged in kind (still triple-flagged). Full before/after table and honest
read: `progress/balance-report-011-phase4-decisions.txt`.

**Real-play evidence, not just aggregate numbers:**
`progress/sample-match-018-swarm-resilience.txt` (a real, unscripted
LookaheadAgent-vs-LookaheadAgent Swarm-vs-Null match, found on the first
seed searched, where Colony Broodling's death genuinely triggers a
replacement summon and Overgrown Carapace's live health matches "1 + board
count" exactly across 6 different board sizes — Swarm wins) plus 4 new
whitebox tests (`engine/test/swarmResilience.test.ts`).

**Decisions this session made that the owner might want to overrule:**

1. **Stopped at exactly the two authorized changes rather than iterating
   further toward the band.** Aegis-vs-Null didn't land in 55-60% (the
   entry's own stated "stop" condition), but nothing beyond step 4 was
   pre-authorized, so nothing further was attempted — consistent with this
   project's established "measure, report, don't chase" pattern, but a real
   choice to stop short of the target rather than guess at a next step
   (e.g. touching Kernel Panic/Null Singularity's stats instead of their
   cost — see below).
2. **Cortex-vs-Swarm remains completely unassigned.** The entry forbids
   touching Cortex and doesn't name a Swarm/Aegis-side fix for this specific
   pairing (unlike Swarm-vs-Null, which it explicitly diagnosed and
   directed). This session did not guess at one. Should Swarm get a THIRD
   card aimed specifically at this pairing, should Aegis be touched instead
   (it's not part of this edge), or is this pairing meant to wait for Phase
   5's wider pool to dilute it? Genuinely open.
3. **Kernel Panic/Null Singularity's played-win-rate is still extreme
   (up to 86.4%/78.7%) even at the new cost.** The cost increase changed how
   OFTEN they land, not how strong they are once they do — if the owner
   wants Aegis-vs-Null actually inside the band rather than just closer to
   it, the per-card table suggests these two cards' raw stats/effects are
   the next lever, not a further cost hike. Not attempted (out of this
   entry's authorized scope) — flagging the lever rather than pulling it.
4. **Colony Broodling/Overgrown Carapace's specific numbers are a first
   proposal.** Cost 1/1-attack/1-health with a 2-other-units summon gate;
   cost 3/2-attack/1-base scaling health; 3 and 2 copies respectively. Not
   playtested beyond this session's own balance report and one real match.
5. **A new, unchased single-policy flag: Cortex-vs-Null under Aggressive
   only (55.7% -> 60.7%)**, plausibly from Null's weaker early game after
   the cost increase. Named, not acted on (single-policy, not a cross-check
   flag).

**Per the entry's own explicit gate, Phase 5 (pool expansion) was NOT
started** — "do NOT start expansion until the ring is within band," and it
isn't, on any of the six pairings. This checkpoint is the flag; the project
continues per `progress/current.md`'s "concrete next step" rather than
waiting.

---

## AWAITING FEEDBACK — Stage 3 balance pass, Phase 4: the counter triangle (2026-09-22, session 16)

Not a full build-order stage completion (roadmap item 3's Phases 5-6 are
still open) — flagged per the owner's own 2026-09-21 process reminder
("when a session says it's surfacing a decision for the owner, write it
into checkpoints.md ... as the process defines") because Phase 4 item 7
explicitly asks to "propose an explicit counter cycle at a checkpoint," and
because this session made one real design decision (Segmentation Fault's
redesign) and left one real gap (Cortex-vs-Swarm) that the owner should see
named plainly rather than buried in a PR body.

**1. The triangle proposal — please confirm or steer.** Adopted the owner's
own 2026-09-20 example as-is: Null attrition beats Aegis stacking; Aegis
walls beat Swarm width; Swarm width beats Null's single-target removal;
Cortex flexible in the middle (no fixed favoured matchup, 45-55% vs
everyone). Targets: 55-60% for the intended edge, 45-55% elsewhere, under
all three agent policies. Full detail and the measured gap against it:
`progress/balance-report-010-phase4-triangle.txt` Parts 1-2. **Nothing here
was invented beyond what the owner already wrote** — this is a
confirmation checkpoint, not a new proposal, but the specific per-pairing
percentage bands (translating "55-60% for the intended edge" onto each of
the six pairings) are this session's own first application of that rule and
worth a look.

**2. What's actually true against that triangle right now, measured, not
guessed:** none of the six pairings meet it yet. Two distinct problems:
Cortex is too strong (against Swarm under all 3 policies, against Aegis
under Aggressive) rather than "flexible"; and the Null side of the cycle is
inverted on one edge (Swarm should beat Null, currently loses to it 55-81%)
and far overshoots on the other (Null should beat Aegis by 55-60%, currently
wins by up to 78%). Full table: `balance-report-010-phase4-triangle.txt`
Part 2.

**3. The pre-authorized Null backstop — executed, 3 of 4 steps, honestly
inconclusive.** The 2026-09-20 "Null dominance" entry's condition
("still wins 60%+ against any faction under all three policies") was
already met for Aegis-vs-Null, so its priority-ordered nerf list was
executed without waiting for further sign-off, exactly as that entry
pre-authorized: (1) Segmentation Fault redesigned from an unconditional
permanent aura to a conditional one (new generic engine mechanism:
`Ability.condition` now gates "static" triggers, not just
onPlay/activated); (2) Corrupted Process cut 3->2 copies (Fork Bomb was
NOT cut — the pool was sitting exactly at the Phase 3 lint's 25% cap, and
only one copy of backfill headroom exists anywhere in the pool, already
spent on this cut); (3) Entropy Harvester's scaling source changed from the
controller's own graveyard to the opponent's (new generic
`opponentGraveyardSize` ScalingSource). Measured after each step. Result:
real but small movement (Aegis-vs-Null's Random-policy number improved
78.3% -> 72.0%; Aggressive and Lookahead barely moved). Both flagged
pairings remain triple-flagged. Full step-by-step numbers and reasoning:
`balance-report-010-phase4-triangle.txt` Part 3.

**4. Decision NOT made, flagged instead — step 4, cost increases.** The
per-card instrumentation (already a standing part of every balance report)
points at Kernel Panic and Null Singularity specifically — both far
outlier played-win-rates (up to 88.7% and 82.9% respectively) against a
pool that otherwise clusters 45-60%. Both already cost exactly what their
faction-mirror equivalents cost (Aegis Warden 5, Prime Aegis 6) — raising
either further would make Null's top end the first in the pool to cost more
than its equivalent-tier peers elsewhere, a cross-faction curve decision
this session did not think it should make unilaterally in the same pass as
an already-authorized nerf. Flagging it as the most concrete, data-backed
next lever rather than guessing at it. **Owner steer wanted:** is a
Null-only cost premium on its top two cards an acceptable way to close this
gap, or should the next attempt look at Aegis's own kit instead (as
sessions 10/11 already tried once) or at Swarm's kit (needed regardless,
to fix the inverted Swarm-vs-Null edge)?

**5. Cortex-vs-Swarm — measured, explicitly NOT fixed this session.**
Triple-flagged, unchanged by anything this session did (nothing here
touched Cortex or Swarm). No owner-pre-authorized mechanism exists for this
pairing the way the Null backstop does. **Owner steer wanted:** should
Cortex be nerfed, or Swarm/Aegis buffed, to bring this in line with
"flexible in the middle"? This session did not decide unilaterally which
faction's identity to touch.

**What's next regardless of the answers above:** the Swarm-vs-Null edge is
currently inverted (Null wins, should lose) — this is arguably the most
structurally wrong result on the board relative to the proposed triangle,
worse than "too extreme in the right direction" (Aegis-vs-Null) or "wrong
faction too strong" (Cortex-vs-Swarm), and hasn't been specifically
targeted by any fix yet. A future session should look at Swarm's own kit
(rebuild tools, board presence against Null's attrition) rather than only
continuing to nerf Null, since Null nerfs this session moved Aegis-vs-Null
more than Swarm-vs-Null.

---

## AWAITING FEEDBACK — Stage 3: A real card set (2026-09-13)

**Milestone:** this is DESIGN.md's "first real card set done" checkpoint.

**What it delivers:** the unified board-development system the owner's
2026-09-12 design-directive batch called for, built directly into the
rules engine as one interacting system, plus a new third faction (Aegis)
built specifically to exercise it:

- **Finite face-up board slots** (`BOARD_SLOTS`, proposed default 6),
  shared between Units and Directives per player — both are "meaningful
  board commitments," so both compete for the same scarce space.
- **Telegraphed threats** (`UnitCard.telegraph`): a unit enters play fully
  visible and targetable but dormant (can't attack, activate abilities, or
  project static auras), then "arms" — its deferred `onPlay` finally
  fires — at the start of its controller's turn N rounds later. The
  opponent gets a real, visible window to answer it before the payoff.
- **Evolution** (`UnitCard.evolvesFrom`, strict base-card-id requirement):
  mutates the target unit **in place** (same instanceId), so damage,
  statuses, and attached Tools all carry forward onto the evolved form,
  and no board slot is spent evolving.
- **Tool/attachment cards** (new `Tool` CardType): attach to any friendly
  board unit, a flat stat bonus plus optionally-granted keywords, no slot
  of their own.
- **The interaction, not three isolated features:** a telegraphed unit can
  be tooled up before it arms; an evolution base sitting in play is
  exactly the same "answer it now or let it grow" tension as a telegraph,
  for free, from the instance model; the shared slot pool is what makes
  any of this a real opportunity cost rather than a free add-on.

**Evidence, not claims:**
- `progress/sample-match-004-boarddev.txt` — a real, unscripted match
  (Random-Aegis vs Aggressive-Cortex, seed 3) where all three new
  mechanics fire: a Perimeter Turret survives 2 AOE damage while dormant,
  arms on turn 9, and immediately kills an attacker; a Plating Module
  attaches to Prime Aegis; an Aegis Cadet evolves into an Aegis Sentinel.
  Resolves cleanly in 16 turns.
- `progress/effect-system-demo.txt` scenarios 13–16 — deterministic,
  assertion-based proof of telegraph dormancy+arming, evolution
  carry-forward (instanceId, damage, a pre-attached tool), Tool
  attachment (stat bonus, granted keyword, granted Barrier applying the
  real status), and the board-slot cap (blocks Units/Directives, never
  Tools).
- A 300-game stress run (not committed, described in `progress/log.md`)
  across two matchups found zero crashes, mean ~17 turns (consistent with
  pre-stage-3 numbers, comfortably under the 40-turn cap), telegraph
  arming in ~78% of games, evolution in ~34%, a Tool attaching in ~96% —
  the mechanics are exercised routinely, not just in a cherry-picked demo.
- All four packages typecheck clean; the pre-existing stage-1/2 evidence
  (12 original effect scenarios, the Cortex-vs-Swarm CLI match) still
  passes/plays identically — this session's changes (the board-slot cap,
  the deck-size rule) did not regress the existing card pool.

**Where it's strong:** the "evolve in place" implementation is simpler and
more powerful than it first looks — because it mutates the same
`UnitInstance` rather than replacing it, damage/statuses/tools carrying
forward and the zero-slot-cost property both fall out of the existing
instance model for free, with no special-case bookkeeping. The three
mechanics are genuinely coupled through the shared slot pool and the
instance model, not three parallel if-branches.

**Where it's thin:** Aegis is 14 unique cards — a real faction, not yet a
rich one; Cortex and Swarm don't use the new system at all yet; Tool cards
have no ability timeline beyond a flat bonus; verification is still
entirely hand-written demo scripts with no automated test runner (now the
most overdue item in `progress/quality-debt.md`, having survived two
stage-scale sessions). Full list in `progress/quality-debt.md`'s new
stage-3 section.

**Decisions made this session the owner might want to overrule:**
1. **Evolution is strict, not loose** — requires the exact base card id,
   not a looser tier-based condition. The design-directive batch named
   this an explicitly open question; this session picked strict for a
   first implementation rather than building both. A loose (tier-number)
   requirement is a real but bounded follow-up if preferred.
2. **`BOARD_SLOTS` = 6, shared between Units and Directives** (not
   separate pools). Both numbers and the shared-vs-separate choice are
   named as open parameters in the directive batch; this is a first
   proposal, not a playtested one.
3. **Telegraph delay = 1 controller-turn** by default (both Aegis
   telegraph cards use it). Untested at other values.
4. **Nothing stops playing a base unit and evolving it the same turn** —
   observed as a real line in the committed match log. This could be seen
   as a legitimate "commit hard, one turn" play, or as undercutting the
   "answer it early while it's weak" drama the directive described (the
   base is never actually exposed to the opponent in that line). Left as
   emergent rather than restricted; flagged rather than decided.
5. **Deck size range set to [20, 40]** — chosen to avoid forcing churn on
   the existing Cortex (32)/Swarm (23) test pools rather than picking a
   single target number (e.g. 30) and rebuilding those pools to match.

**What's next:** per `progress/current.md`, the leading candidate for the
next session is closing out the "no automated test runner" debt (now the
most-repeated item in `quality-debt.md`) before adding further width;
continuing stage 3 (a fourth faction, or backfilling Cortex/Swarm with the
new mechanics) is the alternative and also legitimate. Either way, stage 4
(match-server hardening) stays correctly blocked until there's an economy
that needs it.

---

## AWAITING FEEDBACK — Stage 2: Agent interface (2026-09-12)

**What it delivers:** a real network protocol between the match server and
player agents, replacing the in-process `Agent.decideMove` call stage 1
used. `protocol/PROTOCOL.md` is the language-agnostic wire spec (WebSocket,
JSON, `hello`/`matchStart`/`requestMove`/`move`/`matchEnd`/`error`,
including a named "Faults" section and an honest "Not yet covered"
section). Four workspace packages now exist: `engine` (unchanged game
logic, plus a public barrel and an async-capable `Agent`/`runMatch`),
`protocol` (the wire types), `server` (a real `ws`-based match server that
drives the unmodified engine `runMatch` with a `RemoteAgent` standing in
for `Agent`), and `agents` (reference client processes with **zero runtime
dependency on `@ai-tcg/engine`** — the actual proof the seam is real).

**Evidence, not claims:**
- `progress/sample-match-003-networked.txt` — a full real match (seed 48,
  28 turns, 421 moves) played by three separate OS processes (the server,
  and two agent clients) communicating only over a WebSocket, with a
  genuine cross-player, cross-turn instant-speed response (turn 28)
  actually crossing the process boundary — the stage-1 reactive core,
  now proven over the network, not just in-process.
- Both documented fault paths (illegal move, 15s timeout) were live-tested
  with throwaway clients and confirmed to forfeit the offending agent
  correctly, observed end-to-end from all sides' logs — see
  `progress/log.md` for the specific transcripts.
- All four packages typecheck clean; the engine's existing stage-1
  evidence (12-scenario effect demo, in-process CLI match) was re-run
  after the `Agent`/`runMatch` async change and matched prior behavior
  exactly — the protocol work did not regress stage 1.

**Where it's strong:** `agents/` importing nothing from `@ai-tcg/engine`
is the real test of whether "clean seams" was actually achieved rather
than just claimed — a Python or any other external agent implementing
`PROTOCOL.md` from scratch would be in exactly the same position as
`@ai-tcg/agents` is. The server doesn't reimplement match logic; it's the
same authoritative `runMatch` the in-process version uses, with only the
`Agent` implementation swapped for one that crosses a socket.

**Where it's thin (named, not hidden):** the server hosts exactly one
match then exits — no matchmaking, no concurrent matches, no persistence.
No authentication, reconnection, or spectator feed yet (all explicit in
PROTOCOL.md's "Not yet covered"). Fixed test decks; no deck-selection
protocol yet (correctly deferred to stage 5). The fault-path tests were
real but manual, not a committed automated regression test. Full list:
`progress/quality-debt.md`.

**Decisions the owner might want to overrule:**
1. **WebSocket over raw HTTP request/response.** Chosen because the
   protocol needs the server to *push* a `requestMove` at an arbitrary
   time (whenever priority changes, not on a client-initiated poll) — a
   long-lived connection fits that better than repeated HTTP polling.
   Easy to revisit; PROTOCOL.md's message shapes don't depend on the
   transport being WebSocket specifically.
2. **A protocol fault ends the match immediately (full forfeit)** rather
   than trying to keep the game running (e.g. substituting a
   `passPriority` on the offending agent's behalf and continuing). Chosen
   for simplicity and to keep the economy-rule mirroring unambiguous
   (dropping out or breaking the protocol is never rewarded); a more
   forgiving recovery path is a plausible future refinement, not
   attempted here.
3. **`agents/` deliberately duplicates the engine's small RNG
   implementation** rather than importing it, to keep the zero-dependency
   property real. This is a few lines of duplicated code in exchange for
   an architectural guarantee; flagging it in case the owner would rather
   share a tiny `@ai-tcg/rng`-style package instead.

**What's next:** stage 3, a real card set — see `progress/current.md` for
what the still-unhandled 2026-09-12 owner design-directive batch means for
how that card schema should be shaped (board-development system, leader
cards, rarity ladder) without building any of it prematurely.

---

## AWAITING FEEDBACK — Stage 1 redo: Magic-style priority/reactivity (2026-09-11)

Not a new build-order stage — this is a follow-up to the checkpoint below,
acting on the owner's response to it. Flagging anyway because it reverses
a named decision at real cost (a foundational rebuild of the turn core),
which is exactly the kind of thing worth a fast checkpoint rather than
going quiet until stage 2 lands.

**What changed:** the turn/priority core was rebuilt around a real Magic-
style priority-passing algorithm — `GameState.stack`/`priority`/`passes`,
`Speed: "Instant" | "Sorcery"` on Commands and activated abilities,
combat damage computed live at resolution time instead of snapshotted at
declaration, and `getLegalMoves`/`applyMove` keyed off whoever currently
holds priority rather than always the active player. Full technical
writeup: `progress/current.md` and `progress/log.md`.

**Evidence, not claims:**
- `progress/effect-system-demo.txt` scenarios 11–12: priority passes
  correctly between players, the stack resolves last-in-first-out (a
  unit's own Instant repair, cast in response to a lethal removal spell
  already on the stack, saves it by resolving first), and an Instant
  combat trick cast in response to a declared attack changes who survives
  the trade.
- `progress/sample-match-002-reactive.txt`: a real, unscripted match
  (seed 48) where an Instant kill fired in response to a declared attack,
  correctly fizzling the now-targetless pending attack.
- A 60-seed stress run measured how often this shows up in normal
  (non-scripted) play, not just whether the mechanic can work in a
  controlled test: **16 of 60 matches (27%) had a genuine cross-turn
  instant-speed response.** Zero crashes; turn lengths still comfortably
  under the 40-turn cap (mean 16.2).

**Where it's strong:** the algorithm is the real thing, not an
approximation — two consecutive passes resolve the stack LIFO or end the
turn exactly per the standard Magic rule, and combat damage genuinely
recomputes live (a response can change who dies), not just cosmetically.
Both dummy agents exercise it without being scripted to: RandomAgent
needed only a rename, and it still produces real reactive lines; the one
new heuristic given to AggressiveAgent (save a unit from lethal combat
damage if a legal instant can) is intentionally narrow, not padded out.

**Where it's thin:** two scope cuts, both named honestly in
`quality-debt.md` rather than hidden — (1) Units/Directives still resolve
immediately when played, skipping the stack entirely, so you can respond
to spells/abilities/attacks but not to a creature entering play; (2)
triggered abilities (onPlay/onAttack/onDamaged/onDeath/turn triggers)
still resolve immediately when they fire rather than getting their own
priority window — only the deliberate action that caused them (a cast, an
activation, a declared attack) is responder-facing. Both are real
simplifications of the full Magic model, not bugs, and both are visible
follow-ups if the owner wants the deeper version later.

**Decisions the owner might want to overrule:**
1. **Permanents (Units/Directives) don't use the stack.** Scoped this way
   specifically to keep the rebuild bounded to what the feedback asked for
   (instant-speed *responses*, priority *passing*, held resources) without
   also redesigning how creatures enter play. If stage 3's real card set
   wants "counter target creature" effects, this will need revisiting.
2. **Triggered abilities resolve immediately, not via the stack.** Same
   reasoning — the feedback's examples (instant-speed responses, reactive
   triggers) are satisfied by making the things a *player* does
   responder-facing; making automatic triggers responder-facing too is a
   bigger, separate design question (what does it even mean to "counter"
   an onDeath trigger?) that wasn't asked for here.
3. **Two new Instant cards were added (Interrupt Handler, Reflex Spike),
   plus Cortex Engineer's ability upgraded to Instant**, specifically so
   the dummy agents would have something real to react with. These are
   test-pool cards, same as the rest of the stage-1 pool — not intended to
   survive into stage 3's real set as-is.

**What's next:** stage 2 (agent interface), unchanged in scope from the
previous checkpoint's plan — see `progress/current.md` for what the
priority rebuild adds to that protocol's requirements (it now needs to
carry priority windows and the public stack, not just "your turn, pick a
move").

---

## AWAITING FEEDBACK — Stage 1: Rules engine, headless (2026-09-11)

**What it delivers:** a working headless TCG rules engine in
`engine/` (TypeScript/Node, no runtime deps) — card schema, a genuinely
data-driven ability/effect system (not special-cased per card), game
state, turn structure, energy/health, win/loss detection (including a
turn-cap tiebreak so a match can never run forever), and two dummy agents
that play a full match through a clean `Agent` interface.

**Evidence, not claims:**
- `progress/sample-match-001.txt` — one full real match, 25 turns, 105
  moves, resolves cleanly.
- `progress/effect-system-demo.txt` — 10 deterministic, assertion-based
  scenarios proving every mechanic category DESIGN.md names by name
  (keywords, triggered, activated, static/continuous, targeted, AOE,
  conditional, state-mutating) actually resolves correctly, including a
  genuine cross-card cascade (onDamaged → AOE → onDeath → draw).
- 60-seed stress run, zero crashes; turn-length and win-rate distribution
  recorded in `progress/current.md`.

**Where it's strong:** the effect system is real depth, not three
if-statements — `resolveAbility` is one dispatcher every trigger goes
through, `applyDamage` is a single choke point so Barrier and onDamaged
work for free everywhere, derived (never cached) stats mean auras can't go
stale, and `processDeaths` cascades to a fixed point. The 21+20 card test
pool was built specifically to hit every named mechanic category, and it
does (proven, not asserted).

**Where it's thin:** the card pool exists to prove mechanical range, not
to be balanced or "a real set" — that's explicitly stage 3. The two dummy
agents are intentionally simple (random / greedy-face-damage); don't read
their win-rate split as a balance signal. Testing is two hand-run scripts,
not a real test framework or CI yet. Full list: `progress/quality-debt.md`.

**Decisions the owner might want to overrule:**
1. **Language/runtime: TypeScript on Node**, not e.g. Python or Rust. Picked
   for strong data-modeling (discriminated unions fit the effect-spec tree
   well) and because a JS/TS ecosystem serves the later web platform,
   server, and spectator client stages too, so the same language can carry
   the whole stack if desired. Easy to revisit now; expensive to revisit
   once stages 4–8 exist on top of it.
2. **Energy/turn model**: Hearthstone-style (max energy climbs 1/turn to a
   cap of 10, refills fully each turn, one card drawn per turn, no instant-
   speed responses from the non-active player) rather than Magic-style
   (lands as a resource you choose to play, priority passing, instants).
   This was the simpler starting point and it directly shapes what "chosen"
   targeting can mean on a triggered ability (see quality-debt.md) — if the
   owner wants Magic-style reactivity as a pillar (it would strengthen the
   "no human can track it, but it's fair" tension in principle 1/2), better
   to redirect before stage 3's card set locks in around the simpler model.
3. **Turn cap of 40 (20 per player) with a health-tiebreak**, chosen as a
   placeholder pacing mechanism to satisfy "a match must always resolve."
   It is not yet the real escalating-pressure design principle 4 asks for
   (e.g. a damage clock) — just a safety net. Real pacing tuning needs
   real playtesting volume and, eventually, a render to measure watch-time
   against.
4. **Faction names for the test pool are Cortex and Swarm** (two of the
   four factions the schema names — Aegis and Null are reserved but
   unused). Purely a stage-1 placeholder choice; stage 3's real set doesn't
   need to keep these names or restrict itself to two factions.

**What's next:** stage 2, the agent interface — turning the current
in-process `Agent`/`PlayerView` boundary into an actual protocol (HTTP or
WebSocket, to be decided and documented) with a real process-boundary
round trip proven end to end. See `progress/current.md` for the concrete
next step.
