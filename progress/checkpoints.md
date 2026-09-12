# Checkpoints

Newest first. Each marks a completed build-order stage — flagged for the
owner's steering, never a block on continuing.

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
