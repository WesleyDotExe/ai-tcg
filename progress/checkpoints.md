# Checkpoints

Newest first. Each marks a completed build-order stage — flagged for the
owner's steering, never a block on continuing.

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
