# Build log

## 2026-09-17 — Session 9 (non-engine test coverage: server/protocol/agents)

Read `progress/owner-feedback.md` first, per TASKS.md. One entry was
unhandled: 2026-09-17's "Aegis-vs-Null fix direction" (a response to the
Aegis-vs-Null flag left in `progress/notes-for-owner.md`), giving a specific
design for the balance fix — but its own last line says "keep the roadmap
order: do this when the item 3 balance pass comes up, not before item 2."
No CRITICAL quality-debt item was outstanding. Following that instruction
literally: read it in full, annotated it in `owner-feedback.md` as
deliberately deferred (not marked handled — the actual fix is still
unstarted work), and worked `progress/roadmap.md` item 2 instead — the
highest unfinished, unblocked item once item-3 work is correctly held back.
Item 2 was "non-engine test coverage: server / protocol / agents have had
zero automated tests since session 3," a gap named in `quality-debt.md`
across five sessions running (stage 2, session 5, session 6, plus this
session's own re-confirmation).

**What I built, in order:**

1. **`protocol/test/messages.test.ts`** (7 tests) — `isClientMessage`, the
   only real runtime logic in a types-only package, tested against every
   shape it needs to discriminate: valid hello/move, a server-only message
   type sent by a client (must be rejected — a client should never be able
   to claim `matchStart`), unrecognized types, no `type` field, non-object
   values, and the empty object a `JSON.parse` of garbage can produce.

2. **Made `server/src/cli.ts` testable without spawning a process.** It was
   a script with import-time side effects (binds a port from `process.argv`
   the instant it's loaded) — there was no way to drive the real server
   logic from a test at all, which is exactly why the stage-2 protocol
   fault-path verification stayed a manual, uncommitted exercise (per
   `quality-debt.md`'s own explanation of why). Split it into
   `server/src/server.ts` — the actual logic, refactored into an exported
   `startServer(options): Promise<RunningServer>` (returns the actually-bound
   `port`, useful for `port: 0`/OS-assigned-port tests, and a
   `matchEnded: Promise<MatchOutcome>` a test can assert on) — and a
   two-line `cli.ts` that just parses argv and calls it. Behaviour-preserving:
   same console output, same messages sent over the wire, same close timing;
   confirmed by re-running the real `cli.ts` as an actual subprocess against
   two separate `tsx` agent-client processes over real localhost sockets
   after the refactor (p2 wins, 102 moves, 12 turns, log file written
   correctly) — a regression check, not new stage evidence, so not committed
   as a new sample-match file.

3. **Gave `RemoteAgent` a configurable timeout** (`constructor(name, socket,
   { timeoutMs })`, defaulting to the real 15s) — the one source change
   needed to actually test the timeout-fault path without a 15-second-long
   test. `server.ts` never passes the option, so production behaviour is
   byte-for-byte unchanged.

4. **`server/test/remoteAgent.test.ts`** (12 tests) — drives the real
   `RemoteAgent` class against a minimal fake socket (`EventEmitter`
   exposing only `on`/`send`/`close`/`readyState`/`OPEN`, the subset the
   class actually touches), covering every fault path `PROTOCOL.md` names:
   illegal move, malformed JSON, an unrecognized message type, a stale
   `requestId` correctly ignored (not faulted) while the real reply still
   resolves afterward, a late `hello` ignored, socket closed mid-request,
   `decideMove` called while one's already pending (throws synchronously —
   an engine/server bug, not a client fault, per the existing code comment),
   and the reply timeout.

5. **`agents/src/index.ts`** (new barrel) + `main`/`exports` added to
   `agents/package.json`, mirroring the pattern `engine/` and `protocol/`
   already use — so `@ai-tcg/agents`' real reference client
   (`runAgentClient`) and decision policies (`makeRandomDecision`,
   `aggressiveDecision`) are importable as a package, not just runnable as
   standalone CLI scripts. This is what let `server/test/integration.test.ts`
   drive real reference clients instead of a test-only duplicate of the
   client logic — and it's a genuinely useful seam for future work too
   (stage 9's open-agent-onboarding docs can point at this package).

6. **`server/test/integration.test.ts`** (4 tests) — the real gap named
   since stage 2: an automated, repeatable protocol test over real sockets.
   Real `ws` connections, the real (now-importable) `@ai-tcg/agents`
   reference clients, the real `startServer`. Covers: a full match resolving
   end-to-end between two independent client instances (asserts a real
   winner/turns/movesPlayed came back, not just "didn't crash"); `port: 0`
   actually producing a reachable, OS-assigned port; a client that always
   replies with an illegal move getting forfeited over a genuine network
   round trip (the same fault `remoteAgent.test.ts` proves against a fake
   socket, now proven against a real one too); and a third connecting
   socket being closed rather than queued (this server hosts exactly one
   match — `quality-debt.md`'s "no matchmaking queue" entry, now at least
   covered by a test that says what current behaviour actually is).

7. **`protocol/src/messages.ts`** now also re-exports `Card`/`UnitCard` from
   `@ai-tcg/engine` (type-only, erased at compile time — same pattern as the
   pre-existing `Move`/`PlayerView`/etc. re-exports), because
   `agents/test/aggressiveDecision.test.ts` needed to build realistic
   `UnitCard` fixtures by hand without giving `agents/` a real dependency on
   `@ai-tcg/engine`.

8. **`agents/test/rng.test.ts`** (6), **`randomDecision.test.ts`** (4),
   **`aggressiveDecision.test.ts`** (7) — the client-side reference decision
   policies, tested against hand-built `@ai-tcg/protocol`-typed fixtures
   (exactly what a real remote agent receives over the wire — no engine
   dependency in the test either). Seed determinism, "only ever picks a
   move from the supplied legal-move list," the biggest-affordable-card /
   face-over-unit-attack / lowest-health-target heuristics, and the one
   genuine reactive rule (save a unit from a pending lethal combat hit
   outside the main phase).

9. **Root `package.json`'s `test` script changed** from
   `npm run test --workspace=engine` to `npm run test --workspaces
   --if-present`, so `npm test` (and CI, which just calls `npm test`) now
   runs all four packages' suites, not only engine's.

**Did I run it?**

- `npm test` (root): **81/81 tests pass** across all four packages (34
  engine + 7 protocol + 23 server + 17 agents), ~1.8s total.
- `npx tsc --noEmit` clean in all four packages.
- Ran the server suite three times in a row specifically to check for
  flakiness in the real-socket integration tests (timing-sensitive by
  construction, unlike everything else in the suite) — 23/23 passed
  identically every time.
- The manual `cli.ts`-subprocess regression check described in point 2
  above — genuinely run, output inspected, then discarded (not new stage
  evidence, a refactor sanity check).

**What's blocked / next:** nothing structurally. Per `progress/roadmap.md`,
item 3 (the balance pass, starting with Aegis-vs-Null per the owner's
2026-09-17 direction — condition Kernel Panic's `destroy`, measure with
`balanceReport.ts`) is next. See `progress/current.md`'s concrete next step
and the still-unhandled `owner-feedback.md` entry (left unhandled on
purpose — the fix itself is still unstarted work for whoever picks up item
3 next).

## 2026-09-16 — Session 8 (the fourth faction: Null)

Read `progress/owner-feedback.md` first, per TASKS.md — no unhandled
entries (the last one, 2026-09-15's balance-decisions record, was already
marked HANDLED). Not a hardening pass (session 8, not a multiple of 5).
No CRITICAL quality-debt item outstanding, so followed
`progress/roadmap.md`'s standing order and worked item 1: the fourth
faction, Null (reserved in `cards/types.ts`'s `Faction` union since stage
3 but never built) — the highest unfinished, unblocked roadmap item.

**What I built, in order:**

1. **`engine/src/data/nullCards.ts`** — 14 unique cards, 34-card deck
   (`buildNullDeck`), matching Aegis's board-development density exactly
   (1 evolution line, 2 telegraphs, 3 tools) so the fourth faction isn't
   thinner than the third. Faction identity: corruption/deletion/entropy
   — kernel panics, segfaults, fork bombs, bit rot — a distinct register
   from Aegis's chrome-guardian and Cortex's networked-intelligence
   angles, still within the cyberpunk + 1990s-retro-futurism direction.
   Deliberately built to introduce mechanics no earlier card had used:
   the `destroy` effect kind (Kernel Panic's evolve payoff — unconditional
   removal, bypassing Barrier and stat buffs alike), a *negative*
   permanent `buff` (Deprecated Routine's telegraph-arm -2/-2 decay —
   every prior `buff` effect in the pool only ever added stats), and
   `controllerGraveyardSize` as a live scaling source for a unit's own
   stats (Entropy Harvester — "grows stronger from what's already died").
   Propagating Exploit adds a genuinely new shape too: a unit that
   permanently gains +1/+0 every time it attacks, uncapped.

2. **Hit the documented "triggered abilities can't use chosen targeting"
   architectural gap immediately, not eventually.** Kernel Panic's evolve-
   destroy and Deprecated Routine's telegraph-arm decay were both first
   written with `scope: "chosen"` (a natural choice for single-target
   removal/debuff). Before running anything, I traced `evolveUnit` and
   `processTelegraphArming` in `engine/engine.ts` and confirmed neither
   ever supplies a `chosen` ref to `resolveAbility` — exactly the gap
   `quality-debt.md` named after the priority rebuild ("I avoided this in
   every card I wrote... but there is no type-level or data-validation
   check stopping a future card... from only discovering the crash when
   that trigger actually fires in a game"). Caught it by reading the
   engine code rather than by hitting the crash, and changed both
   abilities to `scope: "random"` instead — every existing evolve/
   telegraph-arm effect in the pool already worked around this the same
   way, so this isn't a new pattern, just Null's own instance of it.

3. **`engine/test/nullFaction.test.ts`** (5 new tests) — proves each new
   mechanic actually does what it claims, not just that the generic
   telegraph/evolve/tool plumbing accepts the new cards: `destroy` kills a
   unit despite a +50 permanent health buff AND an active, unconsumed
   Barrier (both must fail to save it); the -2/-2 debuff genuinely lowers
   max health (verified by combining it with pre-existing damage to
   produce a kill that a same-sized flat-damage effect couldn't have, since
   max health is floored at 1 by the engine — a real "sanity" bug I caught
   in my first draft of this test, which wrongly assumed a fresh 1-health
   unit would die outright); Fork Bomb's arm-time AOE kills every enemy
   unit present, not just one; Entropy Harvester's attack recomputes live
   as the graveyard grows (not snapshotted at play time); Propagating
   Exploit's growth persists and stacks across two separate turns' worth of
   attacks.

4. **Ran a real match and searched for a demonstrating seed**, same
   approach as `aegisMatchDemo.ts`, but tightened to search specifically
   for NULL's own telegraph/evolve/tool events firing (by card name),
   not just any faction's — the first, looser check found a seed where
   only Aegis's mechanics fired. `engine/src/dev/nullMatchDemo.ts` found
   seed 3 within the default 500-seed search window: Fork Bomb telegraphs
   and AOE-damages both of Aegis's units on arming, the full evolution
   chain plays out (Glitch Seed -> Corrupted Process -> Kernel Panic), and
   Kernel Panic's evolve-in destroy kills Aegis's own armed Latent Ward
   with no damage log line preceding it — clean, legible evidence in the
   committed log that it's really the unconditional `destroy` effect
   firing, not disguised lethal damage. Committed as
   `progress/sample-match-008-null.txt`.

5. **Measured Null against the existing three factions with
   `balanceReport.ts`** (extended to include Null in its faction list;
   no logic changes needed) — per the roadmap item's own instruction to
   measure before calling it done. First result: Null beat ALL THREE other
   factions under BOTH agent policies (66.3-91.7% win rate) — a stronger,
   broader dominance signal than session 7's Cortex fix (which was 2 of 2
   matchups, not 3 of 3). Root-caused to three specific outliers versus
   the curve precedent Cortex/Swarm/Aegis had already established (not a
   single bad card, closer to a genuine density problem across the pool):
   Fork Bomb's AOE damage (2 to every enemy unit, at the same cost/
   telegraph other factions spend on a single random target), Null Shell's
   health bonus (+4 for 1 mana, versus the established +3-for-1 precedent
   from Aegis's Plating Module and Swarm's Chitin Plating), and Propagating
   Exploit's uncapped permanent growth coming online one turn earlier than
   its power level could bear. Applied all three as one minimal tuning
   pass (Fork Bomb damage 2->1, Null Shell health bonus 4->3, Propagating
   Exploit cost 2->3) and re-measured: Cortex-vs-Null and Swarm-vs-Null
   both dropped out of the double-flag; Aegis-vs-Null did not move
   (75-81%, still double-flagged, still the single worst pairing measured
   across both balance sessions) since none of the three changed cards
   touch anything Aegis-specific. Full before/after, root-cause reasoning,
   and an honest read of what this does and doesn't prove:
   `progress/balance-report-002-null.txt`.

6. **Extended `matchSmoke.test.ts`** with the three new cross-faction
   pairings (Cortex/Swarm/Aegis each vs Null) so the always-run crash-
   safety suite covers all six pairings now that a fourth faction exists,
   not just the original three.

**Verified before calling it done:** `npm test` — 34/34 vitest tests pass
(29 pre-existing + 5 new); `npx tsc --noEmit` clean across all four
workspace packages; the match demo and balance report were both actually
run, not just written (see committed outputs above).

**Stopped after one measure-then-fix cycle**, following the owner's
2026-09-15 approval of session 7 doing the same thing — Aegis-vs-Null is
left open as debt (see `progress/quality-debt.md`) rather than iterated on
further, to keep this session's slice bounded to "ship the fourth faction,
measured and with one real fix," not "achieve full four-faction balance."

Updated `progress/roadmap.md` (item 1 marked done, item 3 updated to name
the specific pairings still open) and `progress/quality-debt.md` (new
debt section below).

## 2026-09-15 — Session 7 (design principle 3: first cross-faction balance measurement, plus a real crash fix)

Read `progress/owner-feedback.md` first, per TASKS.md — no unhandled
entries (the last one, 2026-09-13's stage-3 checkpoint feedback, was
already marked HANDLED by session 6). Not a hardening pass (session 7,
not a multiple of 5; session 5 was the last one). `progress/current.md`
named four legitimate next-step options; picked "start measuring design
principle 3 (archetype-level soft counters)" — three factions have existed
since session 4 with zero balance measurement between them, named as
aging debt across sessions 5 and 6, and unlike option 1 (Cortex/Swarm
density) it wasn't blocked by the 40-card deck ceiling, and unlike option
2 (a fourth faction) it's depth on existing work rather than new width —
the right call per DESIGN.md's "depth before breadth" rule.

**What I built, in order:**

1. **`engine/src/dev/balanceReport.ts`** — a real measurement tool for
   DESIGN.md's design principle 3 ("track whether one archetype dominates
   win rates over time"). Runs N seeded games (default 300) per
   cross-faction pairing (Cortex/Swarm/Aegis) AND per mirror pairing, using
   the SAME agent policy on both sides of each game (AggressiveAgent-vs-
   itself, then a separate pass with RandomAgent-vs-itself) so agent skill
   never confounds a faction-balance signal, and alternating which faction
   plays first by seed so a real first-player-advantage effect (measured
   directly via the mirror matchups) doesn't leak into the cross-faction
   numbers either. A pairing flagged (>=60% win rate for one side) under
   BOTH agent policies is treated as strong evidence of a genuinely
   dominant archetype, not an agent-heuristic quirk. Added as
   `npm run balance --workspace=engine`.

2. **Ran it — and it immediately crashed with a stack overflow**, in the
   very first Cortex-mirror game it reached. Investigated rather than
   working around it: `effects/resolver.ts`'s `applyDamage` fires a unit's
   `onDamaged` trigger every time it takes damage, with no check that the
   unit is still alive first. Two copies of Retaliation Node (CX-013,
   "whenever this unit is damaged, deal 1 damage to all enemy units") on
   opposite sides of the board retaliate against each other forever: A's
   Node takes damage, hits B's Node, which takes damage and hits A's Node
   back, recursing before either unit is ever actually removed from the
   board (removal is deferred to `processDeaths`, which only runs once the
   whole cascade unwinds — see that function's own comment on why). This
   is a real bug a real match could hit, not a synthetic edge case; it's
   exactly the "untested paths" quality-debt.md already flagged in the
   abstract ("a stack three or more items deep... also has no test") made
   concrete by an actual measurement run.
   - **Fix:** `applyDamage` now checks `isAlive(state, unit)` before firing
     `onDamaged`, so a unit that's already dead in substance (health <= 0)
     stops reacting even though it isn't physically removed from the board
     until the cascade's outer call finishes — consistent with the
     existing "deaths resolve to a fixed point after effects complete"
     architecture, not a new model.
   - **Regression test:** `engine/test/mutualRetaliation.test.ts` — calls
     `applyDamage` on two board-placed Retaliation Nodes directly and
     asserts it returns instead of throwing. Confirmed this test actually
     catches the regression: reverted the fix, re-ran the test, watched it
     fail with the real `RangeError: Maximum call stack size exceeded`
     stack trace, then restored the fix and watched it pass.
   - **Real-match evidence, not just whitebox:** `engine/src/dev/
     retaliationMatchDemo.ts` searches real Cortex-mirror games (both
     agents drawing from the actual 40-card Cortex deck) for one where both
     players' Retaliation Node actually fight each other in unscripted
     play. Found on seed 2 (of up to 3000 searched). Committed as
     `progress/sample-match-007-retaliation-fix.txt` — the match resolves
     cleanly to a winner at turn 18 with 4 real Retaliation Node damage
     events logged, instead of hanging/crashing.
   - All 26 vitest tests pass (25 pre-existing + 1 new); `tsc --noEmit`
     clean across all four workspaces.

3. **Used the (now-working) measurement to find and fix a real balance
   bug**, per design principle 3's explicit instruction ("if it does,
   that's a balance bug to fix, and the record should show it being
   fixed"). The initial 300-seed measurement showed Cortex beating BOTH
   other factions under BOTH agent policies (Cortex 63.7%/71.3% vs
   Swarm/Aegis under Aggressive; 74.0%/60.3% under Random) — a real,
   double-confirmed dominant-archetype signal, not noise (the mirror
   matchups sat at 46-52% throughout, ruling out first-player advantage as
   the explanation). Read the Cortex card pool for a cause rather than
   guessing at a fix: Overload Capacitor (CX-011) is a clear stat outlier
   (5/5 for cost 3 versus a ~6-7-combined-stat curve baseline elsewhere at
   that cost), and Interrupt Handler (CX-014) duplicates Diagnostic Pulse's
   exact effect (2 damage to a chosen enemy unit) at the same 1-mana cost,
   giving Cortex 6 copies of "1 mana, 2 damage, precise target" between the
   two cards plus 2 more of a 4-mana AOE — a removal density neither Swarm
   nor Aegis has an equivalent of. Applied two minimal, targeted changes
   (no new mechanic, a tuning pass): Overload Capacitor 5/5 -> 4/4; Interrupt
   Handler cost 1 -> 2. Re-ran the same 300-seed measurement after the
   change: the double-flag (Cortex beating both other factions under both
   policies) is gone — Cortex-vs-Swarm (Aggressive) dropped from 63.7% to
   58.0%, Cortex-vs-Aegis (Random) dropped from 60.3% to 54.7%. Full
   before/after numbers and an honest read of what this does and doesn't
   prove: `progress/balance-report-001.txt`.

**What's still open, named honestly rather than claimed fixed:**
Cortex-vs-Aegis (Aggressive, 70.0%) and Cortex-vs-Swarm (Random, 72.0%)
still individually clear the 60% flag — just not both at once anymore,
which is the weaker single-policy signal the double-check exists to
distinguish from a real dominant archetype. Swarm-vs-Aegis sits at 61.3%
Swarm both before and after (neither changed card is in either deck) and
was not investigated this session. This was one bounded measure-then-fix
cycle, not a claim that the three factions are now balanced — see
`progress/quality-debt.md` for the honest continuation of this.

**Blocked / not attempted:** the other three next-step options from
session 6 (Cortex/Swarm board-development density, a fourth faction,
non-engine test coverage) are untouched — correctly out of scope for a
session that found a crash bug mid-task and followed it to a real fix
rather than treating the balance measurement as a quick, isolated add.

## 2026-09-14 — Session 6 (stage 3: backfill Cortex/Swarm with board-development cards)

Read `progress/owner-feedback.md` first, per TASKS.md. No new entries since
session 5 — the most recent one (2026-09-13 stage-3 checkpoint feedback) was
already marked HANDLED. Checked `progress/quality-debt.md` next, per the
"no shortcuts"/depth-before-breadth rule: the most-repeated remaining
stage-3 item was "Cortex and Swarm don't use telegraph/evolution/tools" —
the board-development system built in session 4 was exercised only by the
purpose-built Aegis faction, a real cross-faction gap named across two
prior sessions' debt lists. This is also exactly option 1 from session 5's
own concrete-next-step note, so that's what this session built. Not a
hardening pass (session 6, not a multiple of 5).

**What I built, in order:**

1. **Four new Cortex cards** (`engine/src/data/cards.ts`): Init Daemon
   (CX-015, 1-cost 1/2 vanilla) evolving into Compiled Daemon (CX-016,
   3-cost 3/3, evolve-in deals 2 damage to a random enemy unit); Dormant
   Exploit (CX-017, 2-cost 1/3, telegraph 1) arming into a 2-turn Stasis
   stun on a random enemy; Overclock Shunt (CX-018, a Tool, +1/+0 and
   grants Rush). Deliberately chose effect combinations Aegis's set didn't
   already cover — a damage evolve-payoff (Aegis's two evolves are
   energy-gain and heal+Barrier), a status-application telegraph-arm effect
   (Aegis's two telegraphs are damage and Barrier-grant), and a
   Tool-granted keyword that changes legal moves (Rush bypasses summoning
   sickness) rather than just combat resolution (Guard/Barrier, Aegis's
   three Tools).
2. **Three new Swarm cards**: Dormant Egg Sac (SW-010, 2-cost 0/4, telegraph
   1, arms for 3 damage to a random enemy — reusing Perimeter Turret's
   shape, scaled up, since a straightforward effect already suited the
   faction rather than forcing artificial novelty); Molted Stalker (SW-011,
   3-cost 4/3, evolve-in draws a card) evolving from **Swarm Larva
   (SW-001)** — an existing stage-1 vanilla card, not a new purpose-built
   base like every other evolution line so far (Aegis Cadet, Init Daemon)
   — specifically to prove the system retrofits onto a card nobody designed
   with evolution in mind; Chitin Plating (SW-012, a Tool, +0/+3, Swarm's
   analogue to Plating Module).
3. **Updated `CORTEX_CARDS`/`SWARM_CARDS`** with copy counts respecting the
   existing rarity copy-limits: Cortex 32 → 40 cards (now exactly at
   `decks.ts`'s 40-card ceiling), Swarm 23 → 30 cards. Both still validate
   against `buildDeck()`'s enforced [20, 40] range without needing to touch
   that constant.
4. **`engine/test/boardDevelopmentBackfill.test.ts`** (new, 5 tests) — real
   vitest coverage for every new mechanic, per the endorsed "new mechanics
   get vitest tests, not a demo script" process from session 5: Compiled
   Daemon's evolve-in damage actually killing a 1-health target;
   Dormant Exploit staying dormant (no premature Stasis, no premature
   damage) then arming into Stasis on schedule; Overclock Shunt's granted
   Rush not just flipping `hasKeyword` but actually appearing in
   `getLegalMoves`' attack list for a unit played that same turn (the thing
   that would matter if the keyword-grant plumbing were subtly wrong);
   Molted Stalker evolving from the pre-existing Swarm Larva instance and
   drawing a card; Dormant Egg Sac's arm damage plus Chitin Plating's stat
   bonus.
5. **`engine/src/dev/backfillMatchDemo.ts`** (new, committed tool, not
   throwaway) — same "search real games for a seed that demonstrates every
   mechanic" approach `aegisMatchDemo.ts` used, but for Cortex vs Swarm and
   requiring BOTH sides' three new mechanics each (six conditions total,
   not three) in one game.

**Did I run it?**

- `npm test`: **25/25 vitest tests pass** (20 pre-existing + 5 new), ~1s.
- `npx tsc --noEmit` clean in all four packages after every change.
- Ran `backfillMatchDemo.ts` (max seed 3000): found a fully-demonstrating
  game on **seed 8** — Dormant Exploit and Dormant Egg Sac both telegraph
  and arm, Compiled Daemon and Molted Stalker both evolve in, Overclock
  Shunt and Chitin Plating both attach, all in one real, unscripted
  Random-Cortex vs Aggressive-Swarm match. Committed as
  `progress/sample-match-006-backfill.txt`.
- That demonstrating game happened to run to the 41-turn cap (health
  tiebreak) rather than the typical ~16-turn resolution, so I checked
  whether enlarging the decks by ~25% (Cortex 32→40, Swarm 23→30) shifted
  pacing before trusting that log as representative: a 200-seed,
  Cortex-vs-Swarm-only stress script (throwaway, not committed) gave mean
  16.3 turns, median 15, only 1/200 (0.5%) hitting the cap — matching the
  pre-backfill baseline reported since session 1. The demo-log game hitting
  the cap is within that same ~0.5% rate, not a sign the new cards slowed
  games down generally.
- Re-ran the plain `npm run match` CLI (Cortex vs Swarm, unrelated seed)
  and the unchanged `aegisMatchDemo.ts` (Aegis vs Cortex) — both still play
  and resolve identically to before, confirming the new cards/tests didn't
  regress the existing pools or the Aegis-specific evidence.

**Housekeeping:** while reading `quality-debt.md` for the depth-before-
breadth check, noticed its Testing section still said "No CI wiring" even
though session 5's own log/current.md say `.github/workflows/test.yml` was
added that same session — confirmed the workflow file is real and correct
(`git log`/`cat`), and fixed the stale claim rather than leaving a
self-contradicting debt file for the next run to trip over.

**What's blocked / next:** nothing structurally. See `progress/current.md`'s
concrete next step for the legitimate options (raising Cortex/Swarm's
board-development density further — now capped by Cortex's deck sitting
exactly at the 40-card ceiling; a fourth faction; starting real
archetype-balance measurement across the three existing factions, which has
had zero attention since Aegis shipped in session 4; or extending the
vitest infrastructure to `server`/`protocol`/`agents`, which still have no
automated tests at all).

## 2026-09-14 — Session 5 (HARDENING pass: stage-3 checkpoint feedback + automated test runner)

Read `progress/owner-feedback.md` first, per TASKS.md. One entry was
UNHANDLED: the owner's 2026-09-13 feedback on the Stage 3 checkpoint, with
four numbered decisions plus an endorsed process instruction (build the
automated test runner next) and an open question (document the energy
model). This is also, by TASKS.md's own rule, the project's 5th session —
a scheduled HARDENING pass, no new features — which lines up exactly with
what this feedback entry actually asked for: a rule fix, test
infrastructure, and documentation, not new card-set width. Checked
`progress/quality-debt.md` per the "no shortcuts" section before doing
anything else, per usual.

**What I did, in order:**

1. **Restricted same-turn play-and-evolve** (owner overrule, item 4).
   `engine/src/engine/moves.ts`'s evolution-targeting filter now also
   requires `u.enteredTurn < state.turnNumber` — a base must have survived
   to a turn later than the one it was played on before it can be
   evolved, closing the "commit hard in one turn" line that skipped the
   "answer it early while it's weak" exposure window the board-development
   directive was designed around. Updated the stale doc comment on
   `UnitCard.evolvesFrom` to match.
2. **Tried telegraph delay=2 on one card** (item 3): `Latent Ward`'s
   `telegraph` is now 2, while `Perimeter Turret` stays at 1 — a real
   per-card mix, not a global change, as asked. This is a first trial, not
   a tuned conclusion; judging whether the longer fuse actually "feels"
   different needs a render/real spectating, which doesn't exist yet.
3. **Documented the energy/mana model** (owner question): a new `##
   Resource model — energy (as built)` section in `DESIGN.md`, answering
   directly: one collective pool per player, not per-card; it escalates
   (+1 maxEnergy/turn, cap 10) and *fully* refills — no carryover — only
   at the start of each of that player's own turns (so holding Instant
   responses up during the opponent's turn is a real trade-off against
   what you'll have left when your own turn returns); and the pool is
   undifferentiated by speed — the same number pays for sorcery-speed
   plays, activated abilities, and Instant-speed responses alike.
4. **Built the automated test runner** (endorsed process instruction, and
   the single most-repeated item in `quality-debt.md` across three
   sessions). Added `vitest` as an `engine` devDependency (`npm test` at
   the repo root or inside `engine/`). Retired
   `engine/src/dev/effectSystemDemo.ts` — the manually-run assertion
   script that debt entry named by example — and ported its 16 scenarios
   into `engine/test/effectSystem.test.ts` (12: keywords, triggered,
   activated, static, AOE, conditional, state-mutating stats, cross-card
   cascade, priority/stack LIFO resolution, an instant-speed combat trick)
   and `engine/test/boardDevelopment.test.ts` (4: telegraph arm/dormancy,
   evolution carry-forward, Tool attach, board-slot cap), each scenario
   now its own individually-reported vitest test instead of a printout.
   Added one new regression test in the latter file for item 1 above.
   Also added `engine/test/matchSmoke.test.ts`, a small (15-seed × 3
   matchup) automated version of the 300-game stress run Session 4
   described running but never committed — asserts every match resolves
   to a winner/draw under the turn cap across all three faction pairings,
   alternating which side plays Random vs Aggressive. **20/20 tests pass.**

**Did I run it?**

- `npm test` (vitest): 20/20 pass, ~650ms.
- `npx tsc --noEmit` clean in all four packages (`engine`, `protocol`,
  `server`, `agents`) — confirms the moves.ts/aegisCards.ts/types.ts
  changes didn't regress anything elsewhere.
- Regenerated `engine/src/dev/aegisMatchDemo.ts`'s real-match evidence
  with the fix in place (it's reusable tooling, unchanged) — seed 4 (out of
  500 searched) exercises telegraph arming at BOTH delays (Perimeter
  Turret at 1, Latent Ward at 2), evolution, and tool attachment, all in
  one real unscripted game. Committed as
  `progress/sample-match-005-boarddev-fixed.txt`. Verified by hand that
  the evolved Aegis Cadet instance (u10) was played two turns before it
  evolves (turn 5 → turn 7), while a different, same-named Cadet instance
  played the same turn (u7) died in combat that turn and was correctly
  never offered as a legal evolve target. Annotated
  `progress/sample-match-004-boarddev.txt` (the original stage-3 evidence,
  which happens to show the now-illegal same-turn line) with a note
  pointing at the new log, rather than editing history.
- `npm run match` (the plain Cortex-vs-Swarm CLI match) still plays
  identically — the rule change and new deck (n/a here) don't touch that
  pool.

**What's blocked / next:** nothing structurally. The owner-feedback entry
this session answers is now fully marked HANDLED (see
`progress/owner-feedback.md`). Per TASKS.md's own build-order guidance and
Session 4's honest next-step note, the next non-hardening session should
pick between: (a) backfilling Cortex/Swarm with a few telegraph/
evolution/tool cards so the board-development system isn't Aegis-exclusive,
or (b) more stage-3 depth/width (a fourth faction, or deepening Aegis).
Either is legitimate. A real automated test runner now exists for whoever
picks either — new mechanics should get a vitest test alongside their card
data from here on, not a new demo script.

## 2026-09-13 — Session 4 (stage 3: real card set + unified board-development system)

Read `progress/owner-feedback.md` first. Two entries needed action: the
2026-09-13 stage-2-checkpoint approval (pure "proceed to stage 3," no code
change required — marked handled) and the 2026-09-12 design-directive
batch, which was UNHANDLED and explicitly scopes its section B (the unified
board-development system) to stage 3 — exactly the stage this session
builds. Read it in full before writing any card schema, per its own
instruction.

**What I built, in order:**

1. **The board-development system in the engine**, as one interacting
   system rather than three separate features, per the directive's
   explicit instruction: finite face-up board slots (`BOARD_SLOTS`,
   shared between Units and Directives, proposed default 6), telegraphed
   threats (`UnitCard.telegraph` — a unit enters `pending`, fully visible
   and targetable but dormant, and arms `telegraph` of its controller's
   turns later, at which point its deferred `onPlay` fires), evolution
   (`UnitCard.evolvesFrom` — strict base-card-id requirement; mutates the
   target unit **in place**, same instanceId, so damage/statuses/attached
   tools all carry forward and no board slot is spent), and Tool cards
   (new `Tool` CardType — attaches to a friendly unit, live stat bonus
   plus optionally-granted keywords, no slot of its own). Full detail in
   `progress/current.md` and `progress/owner-feedback.md`'s updated
   2026-09-12 entry.

2. **A new faction, Aegis** (`engine/src/data/aegisCards.ts`) — 14 unique
   cards, a 34-card deck — built specifically to exercise the new system:
   an evolution line (Aegis Cadet → Aegis Sentinel → Aegis Warden), two
   telegraphed units (Perimeter Turret, Latent Ward), three Tool cards
   (Plating Module, Guard Directive Chip, Barrier Shim — the last granting
   an actual Barrier status on attach, not just a live keyword flag), plus
   enough ordinary variety (Guard keyword, an onDamaged self-heal, a static
   aura Directive, an AOE stun Command, and a conditional draw effect using
   `not` + the previously-unused `handSizeAtLeast` condition kind) that
   it's a real faction, not a mechanics showcase with nothing else in it.
   Themed per the owner's cyberpunk/90s-retro-futurism direction from the
   2026-09-11 feedback. Cortex and Swarm were left as-is.

3. **Deck-size enforcement** (`MIN_DECK_SIZE`=20/`MAX_DECK_SIZE`=40 in
   `decks.ts`) — closing a gap `quality-debt.md` had named since stage 2
   ("no minimum/maximum deck size rule"). Chose numbers that don't force
   churn on the existing Cortex (32 cards) / Swarm (23 cards) test pools.

**Did I run it?**

- `npx tsc --noEmit` clean in all four packages (`engine`, `protocol`,
  `server`, `agents`).
- `effectSystemDemo.ts`: all 16 scenarios pass (12 pre-existing, unchanged
  and still green; 4 new — telegraph dormancy+arming, evolution
  carry-forward, Tool attach+keyword-grant+Barrier-grant, board-slot cap).
  Output re-captured to `progress/effect-system-demo.txt`.
- Wrote `engine/src/dev/aegisMatchDemo.ts` — a committed script (not
  throwaway) that plays real Aegis matches and searches seeds for one that
  exercises telegraph-arming, evolution, and tool-attachment all in the
  same game. Seed 3 (vs Aggressive-Cortex) does: a Perimeter Turret tanks
  2 AOE damage while dormant, arms on turn 9, and immediately kills an
  attacker with its arm-time ability; a Plating Module attaches to Prime
  Aegis on turn 13; an Aegis Cadet is played and evolved into an Aegis
  Sentinel in the same turn (turn 15) — a legitimate emergent combo (the
  rules never required the base to have survived a prior turn), not a bug,
  flagged as a ruling in `quality-debt.md`. Committed as
  `progress/sample-match-004-boarddev.txt`. Match resolves cleanly at 16
  turns.
- Ran a 300-game stress test (Aegis vs Cortex and Aegis vs Swarm, 150
  seeds each, RandomAgent vs AggressiveAgent) via a throwaway script (not
  committed, described here for the record like the stage-2 fault-path
  tests): zero crashes, mean ~17 turns, telegraph armed in ~78% of games,
  evolution in ~34%, a tool attached in ~96% — the new mechanics fire
  routinely in unscripted play, not just in the cherry-picked demo seed.
  Win rates skew hard toward the Aggressive heuristic, exactly the
  "greedy beats blind random" pattern already documented for stage 2 — not
  a faction-balance signal.
- Re-ran the original `cli.ts` (Cortex vs Swarm) after all changes: plays
  identically, confirming the board-slot cap and deck-size rule didn't
  regress the existing test pools.

**What's blocked / what I'd do with more time:** see
`progress/quality-debt.md` (new stage-3 section) and `progress/current.md`'s
next-step note — the honest top pick is that verification is still all
hand-written demo scripts with no real test runner, and that's now overdue
given two stage-scale sessions in a row have added engine surface without
adding regression-test infrastructure to match.

---

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

## 2026-09-18 — Session 10: Aegis-vs-Null fix attempt (roadmap item 3, owner-directed)

Read owner-feedback.md first, per procedure. One unhandled entry existed
(2026-09-17: fix Aegis-vs-Null by conditioning Kernel Panic's destroy, then
adjusting Null's numbers only if still flagged) — its own last line said
"do this when the item 3 balance pass comes up, not before item 2," and
item 2 (non-engine test coverage) was completed in session 9, so this
entry's own condition for action was now satisfied. No CRITICAL
quality-debt item existed. Worked exactly this entry, in the two-step order
it specified.

**Step 1.** Added a new generic targeting constraint, `TargetFilter.
maxHealth` (`engine/src/cards/types.ts`), checked in `engine/src/effects/
targeting.ts` against a unit's derived total max health (base + tools +
permanent buffs, not reduced by damage taken). Applied it to Kernel Panic's
evolve-in destroy (`engine/src/data/nullCards.ts`): `{ side: "opponent",
kind: "unit", maxHealth: 5 }`, chosen so Aegis's two heaviest single-unit
investments (Aegis Warden, 7 health, evolves in already healed to full;
Prime Aegis, 8 health) reliably escape while everything at or under Latent
Ward's 5 remains a real target. Kept "destroy ignores Barrier and stat
buffs" exactly as instructed — verified this is still true by regression-
testing the existing Kernel Panic test (adjusted so its own +50 health
buff, which would now make the victim untargetable, was reduced to +3, a
value that stays under the new cap while still proving buffs can't save a
selected target) and adding a new test proving the opposite case: Aegis
Warden, over the cap, is never selected even as the only enemy unit
present. Measured before/after (300 seeds via `balanceReport.ts`):
75.0%/81.3% -> 74.7%/81.0% — essentially no aggregate change, though the
mechanism itself is proven correct (both by the new unit test and by a
freshly generated real match, `progress/sample-match-009-kernelpanic-fix.txt`,
where Kernel Panic's destroy genuinely whiffs against an Aegis unit pushed
over the cap by its own Directive's aura — a live demonstration, not an
inference from the win-rate number alone).

**Step 2.** Since still double-flagged, spent a short scratch-instrumentation
pass (throwaway `npx tsx` scripts, not committed — tallying which Null
cards/effects correlate with wins across 60-150 seeds of Aegis-vs-Null)
before touching any more numbers. No single card explained the gap on its
own. One real, comparison-based outlier did turn up: Null Singularity was
the only card in the entire pool applying a persistent, un-cleansable
enemy-HEALTH reduction (-1/-1) — its own faction's other enemy-aura card
(Segmentation Fault) and its cross-faction Mythic mirror (Prime Aegis) both
debuff attack only, never health, and there is no way anywhere in the
current card pool to remove a Directive or cleanse a debuff, making a
persistent health-drain a structural hard counter against a health-stacking
archetype specifically. Changed Null Singularity's enemy aura to `-1/-0` to
match that precedent, added a dedicated unit test pinning the fix (attack
drops, health doesn't). Re-measured: 74.7%/81.0% -> 74.7%/79.0% — a small
real improvement (mainly the RandomAgent number), still double-flagged.
Also noticeably improved Cortex-vs-Null in the process (54.7%->52.3%
Aggressive, well clear of the flag threshold) — a useful side effect, not
the target of the change.

**Stopped there, honestly.** Aegis-vs-Null remains double-flagged
(74.7%/79.0%) after doing exactly what the owner's feedback asked, in
order, measuring each step. Per this project's own established precedent
(2026-09-15 feedback approving "stop after one measure-then-fix cycle
rather than chasing an exact target"), and having genuinely run out of
single-card-Null-nerf ideas backed by real evidence (the instrumentation
found the gap doesn't reduce to one or two numbers), this session stops
here rather than guessing at a third change. The instrumentation's most
useful finding is written up as a proposal, not executed: Aegis's own card
pool has very little independent interaction (Perimeter Turret's
telegraphed random 3-damage hit and Lockdown Field's 1-turn stasis are
close to its entire answer suite) — a deck built entirely around stacking
value into a few units with almost no way to interact with what the
opponent does is plausibly the real structural problem, not a Null number.
That's a card-set-design change to Aegis, out of scope for "adjust Null's
numbers," so it's named in `progress/current.md` and
`progress/balance-report-003-null-fix.txt` for a future session/checkpoint
rather than attempted unilaterally.

Marked the 2026-09-17 owner-feedback entry HANDLED with the full writeup.
Ran the complete verification pass before stopping: `npx tsc --noEmit`
clean across all four packages, `npm test --workspaces --if-present`
83/83 passing (36 engine, up from 34 — two new Kernel Panic tests plus the
new Null Singularity aura test).

**What's blocked:** nothing structurally. The rest of roadmap item 3
(Swarm-vs-Aegis, single-flagged Cortex pairings, Null's Random-only edge
over Cortex/Swarm) is unblocked and next per the roadmap, though whoever
picks it up should read this session's honest read on Aegis vs Null first.

**Honest gaps:** see `progress/quality-debt.md`'s new session-10 section —
written before stopping, not as an afterthought.

## 2026-09-19 — Session 11: Aegis defensive interaction + the chosen-targeting gap fix (owner-directed)

Read owner-feedback.md first, per procedure. One unhandled entry (2026-09-19):
give Aegis defensive interaction (intercept/redirect, taxing, blunting — not
removal) and re-measure against all four factions; separately, close the
"chosen-targeting gap" (`evolveUnit`/`processTelegraphArming` never supplied
a `chosen` ref, so triggered abilities couldn't use `scope: "chosen"`) before
the card-depth pass, then revert Kernel Panic and Deprecated Routine to
`chosen` (their original design) and re-measure. No CRITICAL quality-debt
item was outstanding. Worked both parts, in the order the entry specified.

**Chosen-targeting fix.** Extended `Move`'s `playCard` variant with an
`abilityTarget` field, independent of `target` (which stays the structural
reference — an evolution's base unit, a Tool's attach host). `engine/
moves.ts`'s evolution branch now enumerates the evolved form's own "chosen"
onPlay target and cross-products it with which base is evolving; if the
ability needs a chosen target but none is currently eligible, evolving is
still offered (the base's upgrade isn't conditional on the bonus ability
having somewhere to point) with no ability target, and `effects/
resolver.ts`'s `resolveAbility` now treats that as "no legal target
existed" and skips the ability rather than throwing. For a telegraphed
unit, whose deferred arm-time ability fires automatically at a turn
boundary with no agent decision point of its own, the target is chosen when
the card is *played* and captured on a new `UnitInstance.armChosenTarget`
field for `processTelegraphArming` to replay later; if that target is gone
by arm time, the effect no-ops harmlessly (a real consequence of choosing 2
turns in advance, not a bug — regression-tested). Reverted Kernel Panic and
Deprecated Routine to `scope: "chosen"`, Kernel Panic keeping its
`maxHealth: 5` cap from session 10. Rewrote the two `nullFaction.test.ts`
tests that previously relied on hand-crafted moves bypassing
`getLegalMoves` (which no longer reflects real play under `chosen`
targeting) and added two new tests that prove the choice is real: with two
eligible enemy units in play, the controller can pick exactly one and the
other is provably left untouched — impossible to guarantee under the old
"random" workaround. Real-play evidence:
`progress/sample-match-011-chosen-targeting.txt` (Kernel Panic evolves in
and its destroy visibly kills the one eligible enemy unit, unscripted
AggressiveAgent-vs-RandomAgent play). Measured in isolation (200 seeds,
scratch instrumentation, an Aegis deck WITHOUT this session's new cards so
the two changes don't get conflated): the revert alone is neutral to mildly
*positive* for Aegis (Null's win rate drops ~1.5-2 points either way) — not
the cause of the regression described below.

**Aegis defensive interaction.** Three new cards (`data/aegisCards.ts`):
Intercept Routine (Instant, cost 1) redirects a pending attack onto a unit
you control, via a new generic `redirectAttack` effect kind that mutates
the nearest pending combat-damage stack item — the first effect to target
the stack itself, not just units/players. Tariff Field (Directive, cost 3)
taxes the opponent's card-play cost by 1, via a new generic
`cardCostModifier` static-effect kind and `state/queries.ts`'s
`effectiveCardCost`, now the single choke point both legality checking
(`moves.ts`) and energy deduction (`engine.ts`) go through. Feedback Plating
(Unit, 1/4, cost 2) blunts the whole enemy board's attack by 1 for the turn
whenever it's damaged. None destroy or remove — all three fit the
"hardened guardian, outlast them" identity the owner named. Unit-tested
(`engine/test/aegisInteraction.test.ts`, 4 tests) and each proven firing in
real unscripted play
(`progress/sample-match-010-aegis-interception.txt`).

**The first attempt (2 copies of each) measured clearly worse, and was not
shipped.** Run through the full `balanceReport.ts` (300 seeds/matchup, both
agent policies), every Aegis matchup got worse, not just Null — Cortex-vs-
Aegis and Swarm-vs-Aegis both newly double-flagged, Aegis-vs-Null itself
worse (83.0%/79.3% Null vs. 74.7%/79.0% going in). Investigated instead of
reverting blind: isolated that the targeting revert isn't the cause (above);
decomposed the three cards individually and in pairs (200-seed scratch
runs) — each card alone measured neutral-to-positive, every combination
measured worse, non-monotonically, which reads as real sampling noise from
full-deck reshuffling under a small sample rather than a clean single-card
diagnosis. The most plausible real driver, reasoned from the agents' own
code: `AggressiveAgent`'s `pickBiggestCard` heuristic always plays the
highest-cost affordable card with no sense of whether it's useful right
now (an already-named quality-debt gap) — a reactive card with zero
immediate board impact sometimes wins that slot over a real tempo play, in
a 6-slot board where that's a real cost. Shipped a smaller dose (1 copy of
each, 37-card pool) and re-measured with the full instrument:
Aegis-vs-Null remains double-flagged, roughly at the pre-session baseline
(79.3%/83.0% vs. 74.7%/79.0%). **Per the owner's own explicit instruction —
"if defensive answers alone don't bring Aegis-vs-Null under the flag
threshold, say so honestly and leave it flagged rather than quietly adding
removal" — this is left flagged, not force-fixed.** One real improvement:
Swarm-vs-Aegis, double-flagged going in, no longer is. Cortex-vs-Aegis got
mildly worse (now double-flagged, was Aggressive-only). Full numbers and
method: `progress/balance-report-004-aegis-defense.txt`.

Flagged, not acted on unilaterally: the structural question of whether
dummy-agent balance measurement can fairly value reactive/situational
cards at all, given what the regression investigation found —
`progress/notes-for-owner.md`.

Ran the complete verification pass before stopping: `npx tsc --noEmit`
clean across all four packages, `npm test --workspaces --if-present`
89/89 passing (42 engine, up from 36 — 4 new Aegis-interaction tests, 2
new Null chosen-targeting tests, 2 rewritten to reflect real
`getLegalMoves`-driven play).

**What's blocked:** nothing structurally. Roadmap item 3's remaining items
(the single-flagged Cortex-vs-Swarm pairing, Null's Random-only edge over
Cortex/Swarm) and item 4 (card-pool depth) are both unblocked next steps.

**Honest gaps:** see `progress/quality-debt.md`'s new session-11 section —
written before stopping, not as an afterthought.

## 2026-09-20 — Session 12: fix the instrument (Phase 1 of the 2026-09-20 owner-feedback entry)

Read owner-feedback.md first, per procedure. One unhandled entry
(2026-09-20, "balance is a systems problem; fix the loop, then expand the
pool"), explicitly ordered into six phases with the instruction "each item
is done when it's built, tested and measured, not before." Scoped this
session to Phase 1 only — both items, completed fully with real evidence —
rather than starting Phase 2 half-finished. No CRITICAL quality-debt item
was outstanding.

**Item 1: a third reference agent.** Read `engine/src/agents/
aggressiveAgent.ts` and `randomAgent.ts` plus `agent.ts`'s `PlayerView`
contract before writing anything, to keep the same "only ever sees a
redacted view" discipline real agents (and eventually external ones) must
also honour. Built `LookaheadAgent`: scores every legal move by resolving
its ability's real target list from the same `TargetSpec` union the
resolver interprets (`resolveViewTargets`/`enumerateViewTargets`, reading
`PlayerView`'s public board state) and summing a generic per-effect-kind
value estimate (`effectValueOverTargets`/`estimateEffect`) over those
targets — no card-name special-casing anywhere in the file. Wired into
`balanceReport.ts` as a third policy; the cross-check now requires all
three policies to agree before flagging a pairing (previously two).

**A real bug the design itself caught before shipping, not after.** The
first full 300-seed run showed Cascade Purge, Backup Protocol, Rally Cry,
Lockdown Field, and Diagnostic Ward at **exactly zero** "played" games each,
despite being drawn 700-1000+ times. Investigated rather than shipped:
all five share `targeting.scope` of `"all"` or `"self"`, and
`engine/moves.ts` only ever populates `Move.target` for a `"chosen"`-scope
ability — the first version of `estimateEffects` took a single `target:
TargetRef | undefined` parameter and returned 0 whenever it was undefined,
which is every "all"/"self" ability, always. Rewrote the targeting layer
properly instead of patching around the five known cases: `estimateAbility`
now resolves the ability's actual target list from its `TargetSpec` (mirror
of `effects/targeting.ts`'s real `resolveTargets`), handling `"none"`,
`"self"` (using a `selfRef` the caller derives — the controlling player for
a Command/Directive, the unit's own instance for a Unit/activated ability,
correctly `undefined`/scored-0 for a brand-new non-evolving unit's own
onPlay whose instance doesn't exist in the view yet — a named, not silent,
gap), `"chosen"` (unchanged), `"all"`, and `"random"` (scored via linearity
of expectation — sum every match, scale by `min(count, n)/n` — an exact
equivalence, not an approximation). Re-measured: all five cards now show
700-1000+ real played games. Regression-tested directly:
`engine/test/lookaheadAgent.test.ts`'s "plays an AOE sweep" (Cascade Purge)
and "plays a self-targeting Command" (Backup Protocol) tests, plus real
unscripted-play evidence — `engine/src/dev/lookaheadMatchDemo.ts` searches
seeds for one where a fixed card actually casts; seed 1 does, and
`progress/sample-match-012-lookahead.txt` shows both Cascade Purge and
Lockdown Field connecting for real damage in the same match, zero fizzles.

Also proved, with dedicated tests (not just design reasoning), the two
behavioural requirements the owner's entry named explicitly: "holds
Instants for a target" and "never plays a reactive card with nothing to
react to." Both fall out of the same generic scoring (a card whose effect
resolves to nothing useful scores at or below `passPriority`'s flat 0), so
no special-casing was needed — but two of the five tests build a real
engine state via `getLegalMoves`/`buildPlayerView` (not hand-built
fixtures — deliberately avoiding the exact gap `aggressiveDecision.test.ts`
left as debt) proving Intercept Routine is held with nothing pending and
played when something real is on `view.stack`.

**Item 2: per-card win-rate instrumentation, committed as a standing part
of `balanceReport.ts`.** Session 10's version was scratch, uncommitted `npx
tsx` one-offs — named debt for exactly this reason. Built `CardStatsTracker`:
accumulates, per faction, every card's "drawn" (opening hand, captured via
`runMatch`'s existing `onMatchStart` hook, plus every `draw` event) and
"played" (`play`/`cast`/`toolAttached`/`evolve` events) counts and win
rates, printed as a table after each policy's matchups. Needed one small,
additive engine change: `evolve` and `toolAttached` `GameEvent`s didn't
carry a `player` field, so their resulting card couldn't be attributed to
whoever played it — added it to both (nothing destructures the old event
shape positionally, so this is safe; also a real observability improvement
independent of this instrumentation — a future commentator agent needs the
same attribution). Caught and fixed one bug before shipping this too: an
activated ability's `cast` event logs `${card.name} — ${ability.text}`, not
a bare card name (see `engine.ts`'s `activateAbility`) — counting it as a
"played card" was producing a phantom pseudo-card entry in the table (e.g.
"Cortex Engineer — Pay 1 energy: ..." showing up as its own row). Filtered
out with the real mechanism named in a code comment, not silently dropped.

Full 300-seed, three-policy report with the complete per-card table for all
four factions: `progress/balance-report-005-instrument.txt`. The triple-
policy cross-check flags exactly two pairings — Cortex-vs-Aegis (confirmed
under all three policies now, was Aggressive-only through session 11) and
Aegis-vs-Null (unchanged) — expected and correct, since Phase 1's job was
fixing the instrument, not re-tuning anything; per the entry's own explicit
order, neither pairing was touched this session.

Ran the complete verification pass before stopping: `npx tsc --noEmit`
clean across all four packages, `npm test --workspaces --if-present`
94/94 passing (47 engine, up from 45 — 5 new LookaheadAgent tests).

**What's blocked:** nothing structurally. Phase 2 of the 2026-09-20 entry
(directive removal, a summon/token effect kind, base protection while
unevolved) is next per the entry's own explicit order — not Aegis-vs-Null
tuning directly, which the entry says waits for Phases 1-4.

**Honest gaps:** see `progress/quality-debt.md`'s new session-12 section —
written before stopping, not as an afterthought.

## 2026-09-20 — Session 13: Directives must be removable (Phase 2 item 3 of the 2026-09-20 owner-feedback entry)

Read `owner-feedback.md` first, per procedure. The 2026-09-20 "balance is a
systems problem" entry is the only unhandled one, explicitly ordered into
six phases; session 12 completed Phase 1. This session scoped to Phase 2
item 3 only — completed fully, with real evidence — rather than starting
item 4 half-finished. No CRITICAL quality-debt item was outstanding.

**The engine gap, closed generically.** `quality-debt.md`'s own
"Architectural gaps" section had named this since the priority rebuild:
"Directives can never leave play." Read `cards/types.ts`, `effects/
targeting.ts`, and `effects/resolver.ts` before writing anything, to find
the right seam rather than bolting on a special case. The fix: `TargetFilter.kind`
gains a `"directive"` option (deliberately NOT folded into the existing
`"any"`, which stays exactly "unit or player" so no card written before
today changes what it can see); `TargetRef` and `enumerateTargets` grow a
matching `"directive"` variant, enumerating a player's `directives` array
the same way `"unit"` walks `board`; the existing `"destroy"` effect kind
(previously unit-only — Null's Kernel Panic was its only user) now
dispatches on the resolved target's own kind, via a new `applyDestroy` that
calls either the original unit-destroy logic or a new `destroyDirective` —
one mechanism serving both card types, not two parallel ones. A Directive
has no health/damage model to route through (`DirectiveInstance` has no
`damageTaken`, and there's no death-processing pass for it), so
`destroyDirective` is a direct board-to-graveyard removal, logged with its
own new event (`directiveDestroyed`) so a future commentator has something
to narrate — the same gap named for Tariff Field in `quality-debt.md`,
avoided here from the start instead of repeated.

**LookaheadAgent updated in the same pass, not left to rot.** Session 12's
own hard-learned lesson (an "all"/"self"-scope ability with no
`Move.target` silently scored zero forever, until targets were resolved
generically from the ability's own `TargetSpec`) applies exactly the same
way here: without updating `enumerateViewTargets`/`estimateEffect`, a
directive-destroy card's "destroy" effect would hit `target.kind !== "unit"`
and return 0 forever, for every one of the four new cards, in every future
balance report — the identical bug class, just against the new target kind
instead of the new scope. Fixed proactively, before it could reach a
report: `enumerateViewTargets` now also emits `directive` refs per side,
and `estimateEffect`'s `"destroy"` case now branches on `target.kind`,
valuing a directive target by its own `card.cost * 2` (the only signal a
redacted `PlayerView` exposes for something with no attack/health — a
named approximation, not a measured one, see quality-debt.md). Proven, not
assumed: a dedicated test in the new `directiveDestroy.test.ts` builds a
real engine state via `getLegalMoves`/`buildPlayerView` and asserts
LookaheadAgent actually destroys a real enemy Mainframe Core rather than
passing, plus a companion test confirming it never has a fizzled option to
mis-score in the first place (getLegalMoves never offers the card at all
with nothing to target).

**One answer per faction, as the entry explicitly asked, each written to
fit that faction's own identity rather than reusing one card four times
with a reskin:** Force Quit (Cortex — `SIGKILL doesn't ask the process to
finish what it was doing`), Bore Swarm (Swarm — the mass eating through
standing infrastructure), Null Pointer (Null — a dereferenced crash,
matching the faction's terminal-crash naming convention exactly), and
Breach Charge (Aegis — a controlled demolition of a wall, not a strike on
anything that bleeds). All four: Instant speed, cost 2, Uncommon, 2 copies,
`targeting: { scope: "chosen", filter: { side: "opponent", kind: "directive" } }`,
`effects: [{ kind: "destroy" }]`. Aegis's card required a specific piece of
reasoning, written into `aegisCards.ts`'s own comment: the 2026-09-19 "Aegis
gets defensive answers, not removal" direction is about Aegis having no way
to interact with the opponent's *units* — a Directive is not a unit, has no
health or combat presence, so destroying one doesn't reopen that direction
or turn Aegis into a control deck; it's a controlled-demolition flavour on
the same hardened-guardian identity, not a contradiction of last session's
explicit instruction.

**Deck-size mechanics, handled honestly rather than glossed over.** Cortex's
pool has sat exactly at the enforced 40-card ceiling since session 6 (named
then as anticipated future debt). Adding Force Quit (2 copies) required
trimming 2 copies elsewhere: Diagnostic Pulse (3->2) and Diagnostic Loop
(2->1), chosen as the pool's least distinctive removal/filler pieces, not
for any measured weakness — a "make room" cut, not a nerf, and one that
happens to nudge Cortex's removal density down ahead of Phase 3's future
removal-density lint rule. Named explicitly in `data/cards.ts`'s own
comment, not silently done. Aegis (37->39/40), Swarm (30->32/40), and Null
(34->36/40) all had room and needed no trim.

**Evidence, run and shown, not just claimed.** `engine/test/
directiveDestroy.test.ts`: 8 new tests — real removal to the graveyard with
the log event, a filter-side test proving the controller's own directives
are never offered as targets, a "no legal target = no legal play" test
(mirroring the existing convention for any other chosen-target card), a
`test.each` covering all three of the non-Cortex answer cards for real
(Cortex's own card is covered by the first test), and the two LookaheadAgent
tests above. A real, unscripted match was searched for and found (not
staged): `engine/src/dev/directiveDestroyMatchDemo.ts` runs
LookaheadAgent-vs-LookaheadAgent across all four faction matchups, seed by
seed, until a real `directiveDestroyed` event fires from genuine play —
found on the very first seed tried (Cortex vs Aegis, seed 1): Force Quit
destroys Static Ward Beacon mid-match, committed as
`progress/sample-match-013-directive-destroy.txt`. Re-measured with the
full instrument (`progress/balance-report-006-directive-removal.txt`, 300
seeds/matchup, all three policies): all four new cards show real,
substantial "played" counts (166-607 games each across the three policies)
— not the always-zero pattern that would mean the LookaheadAgent fix above
didn't actually take.

**Full verification pass before stopping:** `npx tsc --noEmit` clean across
all four packages; `npm test --workspaces --if-present` **102/102 passing**
(55 engine, up from 47 — 8 new directive-destroy tests; 7 protocol; 23
server; 17 agents — the other three packages untouched by this session).

**Honest read of what the re-measurement found, not chased further.**
Cortex-vs-Aegis, triple-flagged going into this session (72.3%/60.0%/61.3%),
is no longer triple-flagged (71.0%/56.7%/57.3%) — plausibly Aegis now being
able to destroy Cortex's Mainframe Core aura, a real if incidental
improvement. Cortex-vs-Swarm, previously flagged under only 2 of 3 policies
(58.0%/72.0%/62.3%), is now newly triple-flagged (60.7%/64.0%/66.0%) — a
real, modest, unaimed-at regression, most plausibly a side effect of
Cortex's own two-card trim changing its curve specifically against Swarm.
Aegis-vs-Null is essentially unchanged in kind (still clearly flagged; the
three policies moved a few points each way and roughly cancelled out).
Named honestly in `owner-feedback.md`'s new "Handled, session 13" note and
`current.md`, not chased further this session — per the owner's own
explicit order, card-by-card tuning off these numbers is precisely what the
2026-09-20 entry superseded; Phases 2-4 continue in sequence before any of
this gets touched again.

**What's blocked:** nothing structurally. Phase 2 items 4 (a "summon"/token
effect kind) and 5 (bases carry a small protection while unevolved —
propose the mechanism at a checkpoint) are next, per the entry's own
explicit order — not Aegis-vs-Null or Cortex-vs-Swarm tuning directly.

**Honest gaps:** see `progress/quality-debt.md`'s new session-13 section —
written before stopping, not as an afterthought.

## 2026-09-20 — Session 14 (Phase 2 items 4-5: summon/token effect kind, base armor)

Read `progress/owner-feedback.md` first. No unhandled entries — the last
one (2026-09-20, "session 13 question") explicitly says "finish Phase 2
(summon, base protection), then Phase 3," which matches `current.md`'s own
concrete-next-step note from session 13. No CRITICAL quality-debt item was
outstanding. Worked Phase 2 items 4 and 5 of the big 2026-09-20 "balance is
a systems problem" entry, in order, both to completion.

**Item 4 (summon/token effect kind):** added `EffectSpec`'s `"summon"`
variant and a self-contained `TokenSpec` (cards/types.ts), implemented in
`effects/resolver.ts`'s new `summonTokens` — creates real `UnitInstance`s
bound by the same `BOARD_SLOTS` cap a normal play respects, logging a
`summonFizzle` for any that don't fit rather than silently dropping them.
Pulled `boardSlotsUsed` out of `moves.ts` into a shared, exported
`state/queries.ts` helper so the cap logic isn't duplicated between legal-move
gating and the new summon path. Gave Swarm its first card using it: Brood
Reserves (Command, cost 3, Uncommon, 3 copies) summons two 1/1 Swarm Larva
tokens — directly answering the entry's named motivation ("Swarm has no way
to rebuild after board-wide damage"). Updated `LookaheadAgent`'s
`effectValueOverTargets` with a `"summon"` case in the same pass, having
learned from sessions 12/13's repeated "a new effect/target kind silently
scores zero forever until the agent is taught about it" bug class — verified
directly with a dedicated test, not just trusted by inspection.

**Item 5 (base armor while unevolved):** added `UnitCard.baseArmor?: number`
— a flat, per-card damage reduction read straight off `unit.card` inside
`effects/resolver.ts`'s `applyDamage` (the single choke point for both
combat and effect damage, so one mechanism covers both). Because evolving
mutates the same instance's `card` to the evolved form, which carries no
`baseArmor` of its own past the tier this protects, the protection ends
automatically the moment a unit evolves — genuinely "while unevolved," with
no extra per-instance state needed. Applied a first-proposed value of 1 to
every current base card in the pool: Aegis Cadet/Sentinel, Null Glitch
Seed/Corrupted Process, Cortex Init Daemon, Swarm Larva (six cards, one per
evolution-line tier that is itself a base for something else) — explicitly
flagged in `current.md`/`quality-debt.md` as a checkpoint proposal per the
entry's own instruction, not a finalised number.

**A real ripple effect, found and fixed, not glossed over:** giving
`swarmLarva` and `aegisSentinel` new mechanical behaviour broke 5
pre-existing tests across 4 files that had incidentally been using those
cards as generic "cheap 1-health damage target" fixtures, unrelated to
their own evolution-line mechanics. Root-caused each one (not just patched
the assertion blindly): three were swapped to `signalDrone` (a plain,
unarmored 1/1 already imported in most of those files) since the tests were
genuinely about a different mechanic (telegraph arming, AOE reach, targeted
damage) and shouldn't have been coupled to Swarm Larva's own new behaviour
in the first place; one (`aegisInteraction.test.ts`) was a real, correct
behaviour change (an Aegis Sentinel's own baseArmor reducing the return
damage it takes in combat) and got its expected value corrected with a
comment explaining why, not just silently bumped.

**Evidence, run and shown:** `engine/test/summon.test.ts` (5 tests) and
`engine/test/baseArmor.test.ts` (8 tests) are new; `npm test` across all
four workspaces is **115/115 passing** (68 engine, up from 55 — the 13 new
plus zero regressions once the 5 ripple-effect fixes above landed). Real,
unscripted, seed-found `LookaheadAgent`-vs-`LookaheadAgent` matches were
generated for both mechanisms (found on the first seed tried, both times):
`progress/sample-match-014-summon.txt` (Brood Reserves actually summons two
tokens in real play) and `progress/sample-match-015-basearmor.txt` (Aegis
Cadet's armor reduces real damage 8 separate times in one match, against
five different Cortex sources). `npx tsc --noEmit` clean across all four
packages.

**Measured, not just built:** ran the full `balanceReport.ts` (300
seeds/matchup, all three policies) after each item separately, so each
one's own effect on the cross-faction numbers is visible rather than
conflated — `progress/balance-report-007-summon.txt` and
`progress/balance-report-008-basearmor.txt`. Honest results: item 4 (summon)
did not help — Brood Reserves itself measures below average under every
policy and Cortex-vs-Swarm got measurably worse for Swarm, most plausibly
because none of the three dummy policies understands "hold this for after a
wipe" timing (the same category of gap the project has already named for
reactive/situational cards). Item 5 (base armor) shifted several pairings
noticeably — most visibly a real policy flip in Cortex-vs-Aegis under
Random play (Cortex-favoured to Aegis-favoured) — without changing which
two pairings cross-check-flag (still exactly Cortex-vs-Swarm and
Aegis-vs-Null, unchanged in kind). Neither result was chased or tuned
further this session, per the owner's own explicit "Phases 1-4 come before
any further balance work on these pairings" instruction — full honest
write-up in `current.md` and `quality-debt.md`'s new session-14 sections.

**What's blocked:** nothing structurally. Phase 2 is now fully complete
(items 3, 4, 5 all done across sessions 13-14). Phase 3 (a card-pool lint
enforced at load time) is next, per the entry's own explicit order — not
Aegis-vs-Null or Cortex-vs-Swarm tuning directly, which wait for Phase 4's
combined re-measure.

## 2026-09-21 — Session 15 (Phase 3: card-pool lint, enforced at load time)

Read `progress/owner-feedback.md` first. The last entry (2026-09-21)
confirmed baseArmor=1 as final, reminded the process for writing checkpoints
when a session says it's surfacing a decision, and explicitly said "Proceed
to Phase 3 (the load-time pool lint)." No unhandled entries beyond that; no
CRITICAL quality-debt item outstanding. Worked Phase 3 of the 2026-09-20
"balance is a systems problem" entry to completion, in full.

**The lint itself: `engine/src/cards/poolLint.ts`, generic and data-driven
(no card-id special-casing anywhere, per DESIGN.md), wired into
`data/decks.ts`'s `buildDeck`** so it's genuinely enforced every time any
deck is built — a real match, a test, `balanceReport.ts` — not an optional
script someone has to remember to run. Four rules, matching the entry's own
numbers exactly: removal/debuff cards <=25% of a deck; no targeted (chosen/
random-scope) damage above cost+1 under 3 mana; no permanent enemy-stat
aura under 4 mana; every faction pool has a clock and card flow. The
"removal/debuff card" classifier (rule 1 needs one; the entry names the
rule but not its definition) is this session's own first-cut
formalisation — walks `Ability`/`EffectSpec`/`StaticEffectSpec` generically,
counting `destroy`/opponent-targeted `damage`/negative `buff`/opponent
`Stasis`-or-`Overload`/a negative `buffAllies` aura/a `cardCostModifier` tax
on `onPlay`/`static`/`activated` triggers only — reactive triggers
(`onAttack`/`onDamaged`/`onDeath`/`onTurnStart`/`onTurnEnd`) are excluded on
the judgment that a card's secondary "it happens to graze the opponent"
effect isn't the same deck-building commitment as a Command or a standing
aura. Flagged as a checkpoint-style proposal in `notes-for-owner.md`, per
the owner's own 2026-09-21 process reminder about writing these down rather
than letting them live only in a PR body.

**Measured against the real pools before touching anything, per this
project's own established discipline.** Cortex: 32.5% removal density
(13/40 copies), over the cap. Swarm: 11.4% (4/35) — passes cleanly, no
changes needed. Aegis: 23.1% (9/39) — passes cleanly, no changes needed.
Null: 50.0% (18/36) — the exact outcome the 2026-09-20 entry's own
follow-up predicted ("the lint will require cutting or redesigning Null
cards to make the deck load ... that's intended"), plus two more failures
of its own: Segmentation Fault's static enemy aura at cost 3 (rule 3) and
zero `drawCard` anywhere in the whole pool (rule 4).

**Fixed both violating pools, each with an approach suited to how far over
the line it was:**
- **Cortex** — a pure copy-count rebalance, no ability changes needed:
  trimmed Cascade Purge/Interrupt Handler/Dormant Exploit by 1 copy each
  (-3), backfilled the same +3 onto Watchtower Relay/Init Daemon/Overclock
  Shunt (each sitting below their own rarity's copy cap already), keeping
  the pool at exactly 40 cards, the same "make room" pattern session 13
  used for Force Quit. Now 25.0% (10/40).
- **Null** — real card redesigns, per the entry's own explicit sanction of
  "cutting *or* redesigning": Corrupted Process's evolve effect changed
  from "deal 3 damage to a random enemy unit" to "draw a card" (mirrors
  Swarm's existing Molted Stalker) — one change that both removes a
  removal effect from the density count and fixes the card-flow failure at
  the same time, not a coincidence. Fork Bomb's arm effect changed from AOE
  damage to "create two 1/1 Fork Child tokens" — genuinely truer to what a
  fork bomb actually is (a process that spawns copies of itself) than
  damage ever was, and it gives Null a rebuild tool it never had. Segfault
  Handler/Deprecated Routine trimmed to 1 copy each; Segmentation Fault
  trimmed to 1 copy AND its cost raised 3->4 (fixing rule 3 directly, text
  untouched). Kernel Panic (the evolution finisher), Null Singularity (the
  Mythic capstone), and Null Pointer (the structurally-required per-faction
  directive-destroy answer from Phase 2 item 3) were deliberately left at
  their original counts — cutting those specific three further would have
  gutted Null's actual identity, not just its oversaturation. Now 25.0%
  (8/32) exactly, with real card flow and no cheap aura.

**Proven working, not just claimed:** `engine/test/poolLint.test.ts` (9 new
tests) proves each rule fires on a minimal synthetic pool built just for
that rule, that reactive triggers and redirectAttack/heal/draw never
misclassify as removal, that `buildDeck` itself (not just `lintCardPool`
called directly) enforces it, and that all four real faction pools now
build clean. `engine/test/nullFaction.test.ts`'s old Fork Bomb AOE-damage
assertion was replaced (not deleted) with one proving the new summon fires
correctly. A real, unscripted match was searched for and found on the third
seed tried: `progress/sample-match-016-poollint.txt`
(`LookaheadAgent`-vs-`LookaheadAgent`, Null vs Cortex, seed 3) shows *both*
redesigned effects firing for real in the same match — Fork Bomb arms and
creates two Fork Child tokens, and Glitch Seed later evolves into Corrupted
Process and actually draws a card (which itself evolves into Kernel Panic
later in the same match). Full verification: `npx tsc --noEmit` clean
across all four packages; `npm test --workspaces --if-present`
**124/124 passing** (77 engine, up from 68; 7 protocol; 23 server; 17
agents). One server integration test flaked under a full concurrent run but
passed reliably 3/3 alone — pre-existing, named debt (session 9) about that
test's real-socket timing sensitivity, not a regression from this session
(server/ wasn't touched).

**Re-measured with the full instrument, honestly, not cherry-picked:**
`progress/balance-report-009-poollint.txt` (300 seeds/matchup, all three
policies) against `balance-report-008-basearmor.txt`'s baseline. Cross-check
result unchanged in kind — still exactly Cortex-vs-Swarm and Aegis-vs-Null
triple-flagged. The honest surprise: most individual numbers for those two
pairings (and Swarm-vs-Null) moved the WRONG direction — Null got a bit
*stronger*, not weaker, most plausibly because Corrupted Process's new
draw made its deck find its remaining strongest, untouched cards (Kernel
Panic, Null Singularity, Null Pointer, Segmentation Fault) more reliably,
even after cutting several weaker removal copies. Not a universal
regression: Cortex-vs-Null actually improved (Lookahead dropped from 60.7%
Null to 55.0%, no longer flagged there). Not tuned or reverted this
session — the entry's own "Null dominance" follow-up explicitly reserves
ability nerfs for *after* the Phase 4 re-measure, not before, and Phase 3's
own job (the lint itself, real and enforced) is done and correct regardless
of this particular pairing's number. Full detail:
`progress/balance-report-009-poollint.txt`, `progress/current.md`,
`progress/quality-debt.md`'s new session-15 section.

**What's blocked:** nothing structurally. Phase 3 is complete. Phase 4 (the
intended counter triangle, proposed at a checkpoint then measured against)
is next, per the entry's own explicit order — this is where Cortex-vs-Swarm
and Aegis-vs-Null both finally get addressed together, and where the
standing "nerf Null's abilities" backstop becomes live if it's still
winning 60%+ against anyone after that re-measure.

## 2026-09-22 — Session 16 (Phase 4: the counter triangle, proposed and measured; the Null backstop executed)

Read `progress/owner-feedback.md` first, per TASKS.md. The most recent entry
(2026-09-22, "session 15 steers") was already substantively handled by prior
sessions — its own live instruction was "proceed to Phase 4" of the
2026-09-20 "balance is a systems problem" entry (define the intended counter
triangle, measure the real pool against it). No CRITICAL quality-debt item
was outstanding, so this was the correctly-ordered next work.

**Part 1: proposed the triangle.** Adopted the owner's own 2026-09-20 example
as-is (Null attrition beats Aegis stacking; Aegis walls beat Swarm width;
Swarm width beats Null's single-target removal; Cortex flexible in the
middle) rather than inventing a different one, and translated its own
"55-60% for the intended edge, 45-55% elsewhere" rule onto each of the six
cross-faction pairings — the one piece of genuine first-cut judgment in this
part, flagged as such.

**Part 2: measured the real pool against it.** Re-ran `balanceReport.ts`
(300 seeds, 3 policies) — numbers identical to session 15's
`balance-report-009` since nothing had changed yet. Result: none of the six
pairings meet the triangle. Two distinct problems: Cortex measures as the
strongest faction overall (triple-flagged vs Swarm, Aggressive-flagged vs
Aegis) rather than "flexible in the middle"; and Null's side of the
triangle's cycle is backwards on one edge (Swarm is supposed to beat Null,
loses to it 55-81% depending on policy) while overshooting on the other
(should beat Aegis by 55-60%, currently wins by up to 78%).

**Part 3: the pre-authorized Null backstop.** The 2026-09-20 "Null
dominance" entry pre-authorizes a specific, priority-ordered nerf sequence
once Null is winning 60%+ against any faction under all three policies —
already true for Aegis-vs-Null before this session started (it's been
triple-flagged since session 12's instrument fix), so this was executed as
already-authorized work, not a new ask. Three of its four steps, in order,
measuring after each:

1. **Segmentation Fault: unconditional -> conditional.** Needed one small,
   genuinely generic engine addition, not a card-only hack:
   `effects/statics.ts`'s `staticModifiersFor` now reads `Ability.condition`
   for the `"static"` trigger — that field already existed and already
   gated onPlay/activated abilities, it had just never been wired up for
   statics. Segmentation Fault's aura is now "While you control 2 or more
   units, enemy units get -1/-0" instead of unconditional. Proven two ways:
   a dedicated whitebox test in `nullFaction.test.ts`, and real,
   unscripted-play evidence — wrote a new dev script
   (`engine/src/dev/segfaultConditionMatchDemo.ts`, following this
   project's existing search-over-seeds pattern) that steps a real
   LookaheadAgent-vs-LookaheadAgent match move-by-move (re-driving
   `runMatch`'s own loop, since `runMatch` has no per-move hook) and
   samples the aura's live state. Found a seed on the first search (seed
   31, Null vs Cortex, `progress/sample-match-017-segfault-condition.txt`)
   where Null's board genuinely drops to 1 unit (aura observably INACTIVE,
   enemy attack at full base value) and later rebuilds to 2 (aura
   observably ACTIVE, the same enemy unit's live attack reads 1 lower) —
   both transitions, in real unscripted play, not a staged scenario.
   Measured effect: tiny (Aegis-vs-Null 78.3/78.3/67.7 -> 76.7/77.0/67.7).
2. **Corrupted Process: 3 -> 2 copies.** Hit a real constraint and worked
   through it rather than around it: the Null pool was sitting exactly at
   the Phase 3 lint's 25% removal/debuff cap (8/32 copies), so cutting a
   non-removal card's copy without backfilling immediately fails the lint
   (confirmed by actually running the suite and reading the failure before
   fixing it). Null Shell (the only card anywhere in the pool with headroom
   under its rarity's copy cap) absorbed the one backfill needed. That
   headroom is now fully used — Fork Bomb, also named in this step, was
   NOT also cut, honestly left undone rather than force-fit. Measured
   effect (cumulative): Aegis-vs-Null to 76.7/75.7/67.0; Swarm-vs-Null
   (Lookahead) moved from 67.3% to 63.7% Null, the largest single-step
   movement found.
3. **Entropy Harvester: controller's graveyard -> opponent's.** Added a new,
   genuinely generic `ScalingSource` (`opponentGraveyardSize` —
   `cards/types.ts`, `effects/scaling.ts`, and `agents/lookaheadAgent.ts`'s
   own scaling context; both graveyards are public zones, no redaction work
   needed) rather than a one-off card-specific hack. Corrected the existing
   whitebox test rather than deleting it (now asserts the controller's own
   graveyard filling up does NOT move the card's attack, only the
   opponent's does). Measured effect (cumulative): Aegis-vs-Null to
   78.0/72.0/67.7 — the single largest movement toward target this session
   found (Random: 75.7% -> 72.0%), though Aggressive/Lookahead both
   essentially reverted to their pre-step numbers.

**Cumulative, honest result:** Aegis-vs-Null moved from 78.3%/78.3%/67.7% to
78.0%/72.0%/67.7% — real under Random, flat under the other two policies.
Swarm-vs-Null barely moved net (55.3/80.7/67.3 -> 56.0/79.0/67.3). **Both
pairings remain triple-flagged.** This matches the exact pattern sessions
8/10/11 already found for this matchup: individual Null nerfs move
Random-policy numbers but barely touch Aggressive/Lookahead. The per-card
instrumentation (already standing in every balance report) now points more
specifically than before at WHY: Kernel Panic and Null Singularity are
extreme played-win-rate outliers (up to 88.7% and 82.9%) against a pool that
otherwise clusters 45-60%, and neither was touched this session.

**Step 4 (cost increases) and Cortex-vs-Swarm — deliberately not attempted.**
Kernel Panic and Null Singularity already cost exactly what their
faction-mirror equivalents cost (Aegis Warden 5, Prime Aegis 6) — raising
either further makes Null's top end the first in the pool to cost strictly
more than its peers, a cross-faction curve decision flagged to the owner
(`checkpoints.md`, `notes-for-owner.md`) rather than made unilaterally.
Cortex-vs-Swarm was measured (still triple-flagged, unchanged — nothing this
session touched Cortex or Swarm) but has no owner-pre-authorized fix
mechanism the way Null's backstop does, so it's named and flagged, not
guessed at.

**Evidence committed:** `progress/balance-report-010-phase4-triangle.txt`
(the triangle proposal, the full before/after-each-step measurement, and the
final raw 300-seed/3-policy report); `progress/sample-match-017-segfault-condition.txt`;
updated `engine/test/nullFaction.test.ts`. `npm test`: 124/124 passing across
all four workspaces (same count as session 15 — existing tests updated for
the two redesigned cards, no wholly new test file needed since both
mechanisms plugged into already-tested generic systems). `npx tsc --noEmit`
clean in all four packages.

**What's next:** a genuine steering fork, written up in `checkpoints.md` and
`notes-for-owner.md` — step 4 (Null cost increases) vs. looking at
Aegis's/Swarm's own kits instead, and who/what to touch for Cortex-vs-Swarm.
This session's own stated instinct, not yet acted on: the Swarm-vs-Null
inversion (Swarm should win, currently loses) looks like the most
structurally wrong result on the board right now and hasn't been
specifically targeted by anything yet — a future session should consider
Swarm's own kit before further Null-only nerfs.

## 2026-09-23 — Session 17 (Phase 4 decisions: the four-faction ring, Null step 4, buff Swarm)

Read `progress/owner-feedback.md` first, per TASKS.md. The most recent entry
(2026-09-23, "Phase 4 decisions") explicitly superseded session 16's
proposed "Cortex flexible in the middle" triangle with a four-faction
counter-cycle ring and ordered two specific changes, in order: raise Null's
two outlier cards' costs (the pre-authorized backstop's step 4), then buff
Swarm's own kit with real go-wide resilience rather than nerf Cortex. Then
re-measure the whole ring and checkpoint. No CRITICAL quality-debt item was
outstanding, so this was the correctly-ordered next work — this session did
exactly what the entry asked, in the order it asked.

**Step 1: Null cost increases.** `engine/src/data/nullCards.ts`'s Kernel
Panic (5 -> 6) and Null Singularity (6 -> 7) — both commented with the
owner's own reasoning for why this is on-identity rather than a
cross-faction curve violation. Three `engine/test/nullFaction.test.ts`
fixtures that hardcoded `p1.energy = 5` to afford Kernel Panic needed
bumping to 6; all other tests were unaffected. `npm test`/`tsc --noEmit`
clean before moving on.

**Step 2: buff Swarm, two new cards.** Read through Swarm's existing pool
(`engine/src/data/cards.ts`) and the project's own diagnosis of why
Brood Reserves (the prior "rebuild" attempt) measured below average
(quality-debt.md: the dummy policies don't understand "hold this for after
a wipe" timing) before designing these — the goal was mechanisms that help
passively, every turn, with no timing judgment required of the agent
playing them, unlike a reactive summon:

- **Colony Broodling** (cost 1, 1/1): `onDeath`, gated by
  `Ability.condition: unitsInPlayAtLeast side:controller count:2`, summons a
  replacement 1/1 Swarm Larva. Since `processDeaths` removes a dying unit
  from its board *before* firing its onDeath triggers (confirmed by reading
  `effects/resolver.ts` directly, not assumed), the count genuinely reads
  "2+ OTHER units survive you" — this turns single-target removal into a
  wash for the removing player, the exact mechanical shape the ring's own
  stated reasoning wants ("Swarm width beats Null's single-target
  removal").
- **Overgrown Carapace** (cost 3, 2 attack): `selfStatFromScaling` health =
  `1 + controllerUnitsInPlay` (mirrors Overclock Beast's existing shape,
  which already scales off the OPPONENT's board — this is the first card to
  read the CONTROLLER's own board instead). A body that gets steadily
  harder for a fixed-damage removal spell to two-shot as Swarm's board
  grows, on every turn, no card-specific agent heuristic needed to use it
  well.

Both compile only from already-generic engine mechanisms that earlier
sessions built for other cards (`summon`, `Ability.condition` gating,
`selfStatFromScaling`) — confirmed `LookaheadAgent` already values both
kinds generically (grep for the relevant `estimateEffect`/
`estimateStaticEffect` cases) before writing either card, so this needed no
"new kind silently scores zero forever" agent-side fix, unlike several
Phase 2 additions. 3+2 copies exactly fill the pool's remaining headroom
under the 40-card cap (35 -> 40) — no existing card was cut or touched,
Cortex's or Swarm's own. Pool lint passes (enforced automatically at
`buildSwarmDeck` — neither card is removal/debuff, so it doesn't even touch
that rule).

**Real-play evidence, not just whitebox.** Wrote
`engine/src/dev/swarmResilienceMatchDemo.ts` (mirrors the existing
`segfaultConditionMatchDemo.ts` shape: re-drives `runMatch`'s own loop to
sample live state after every move) and ran it against a Swarm-vs-Null
seed search — found both mechanisms firing for real on the very first seed
tried (seed 11): Colony Broodling's death genuinely triggers a logged
summon event, and Overgrown Carapace's live health, sampled at every move
it's in play, matches "1 + board count" exactly across 6 different board
sizes as the game evolves (3 through 6 units). Swarm wins this match.
Committed as `progress/sample-match-018-swarm-resilience.txt`. Also added
`engine/test/swarmResilience.test.ts` (4 tests): the replacement fires
correctly with 2+ other units, is correctly gated off with exactly 1 other
unit and with 0 (dying alone), and Overgrown Carapace's health tracks the
board live including shrinking after a real ally death and still taking
real combat damage on top of the scaled total.

**Step 3: whole-ring re-measurement.** Ran the full `balanceReport.ts` (300
seeds/matchup, all three policies) and wrote up a before/after table against
session 16's own final numbers (`progress/balance-report-011-phase4-decisions.txt`).
Honest result: no pairing is within the ring's band yet, but both authorized
changes produced real, multi-policy movement exactly where aimed —
Aegis-vs-Null moved down under all three policies for the first time in this
project's whole balance history (most prior single-card Null nerfs mostly
moved only the Random-policy number); Swarm-vs-Null stopped being
triple-flagged entirely (Aggressive now dead even, Lookahead down to 56.7%
Null, only Random remains flagged). Cortex-vs-Swarm, untouched by either
change, is unchanged in kind. One honest, unintended side effect named
rather than hidden: Cortex-vs-Null picked up a new single-policy flag under
Aggressive (55.7% -> 60.7%) — not chased, since it's a single-policy signal,
not a cross-check flag, and reverting an just-authorized change over one
number is exactly the card-by-card chasing this project's history warns
against.

Per the entry's own explicit instruction ("this is the last balance pass
before Phase 5 ... do NOT start expansion until the ring is within band"),
Phase 5 (pool expansion) was correctly NOT started this session — the ring
isn't within band on any of the six pairings. Wrote up the genuine steering
fork this leaves (Cortex-vs-Swarm has no assigned faction to fix; whether to
go past cost alone on Kernel Panic/Null Singularity, which remain extreme
win-rate outliers when actually played) in `progress/checkpoints.md` and
`progress/notes-for-owner.md`, per DESIGN.md's checkpoint process, rather
than only in this log or a PR body.

`npm test` (root, all four workspaces): 128/128 passing (81 engine, up from
77; 7 protocol; 23 server; 17 agents). One server integration test flaked
once under a full concurrent run (a pre-existing, already-documented
real-socket timing sensitivity named in quality-debt.md since session 9,
confirmed by re-running it alone 1/1 clean immediately after — server/ was
not touched this session). `npx tsc --noEmit` clean in all four packages.

**Not attempted this session, correctly deferred:** any further Null nerf
beyond cost (the entry's own "stop" condition wasn't met, but nothing past
step 4 was authorized); any Cortex-side change (explicitly forbidden by this
entry); Phase 5 (pool expansion, explicitly gated on the ring being in
band, which it isn't).

## Session 18 (2026-09-25)

Balance session per the alternation rule (owner-feedback.md's 2026-09-24
entry): the most recently merged PR (#19) was a render slice, so this
session did the normal balance/roadmap priority rather than RENDER.md. The
highest-priority unhandled item was owner-feedback.md's 2026-09-23 "Phase 4
session 17 follow-ups" entry, acted on in full — see `progress/current.md`
for the complete writeup; summarized here.

**Item 1: corrected the two mislabelled ring edges, and fixed the
instrument rather than just the prose.** Session 17's own checkpoint/report
called Cortex-vs-Swarm and Aegis-vs-Cortex "even" [E] pairings; the ring
(Null > Aegis > Cortex > Swarm > Null) actually makes both decisive [W]
55-60% edges — only Null-vs-Cortex and Aegis-vs-Swarm are the ~even [E]
45-55% pairings. Rather than just re-writing the labels in a text file
(exactly the process that produced the mislabelling in the first place),
`engine/src/dev/balanceReport.ts` now encodes the ring as real data
(`RING_DECISIVE`/`RING_EVEN` constants) and prints a per-policy "in band?"
line for all six pairings automatically. While doing this, found a second,
independent bug in the existing "flagged under all three policies"
cross-check: it fired whenever each of the three policies independently
cleared the 60% threshold, without checking whether they agreed on WHICH
faction won. balance-report-011 had reported Swarm-vs-Aegis as
triple-flagged for exactly this reason (Aggressive favoured Swarm 64.7%,
Random and Lookahead both favoured Aegis at 56.3%/50.0% — three real
signals pointing two different directions, not one dominant archetype).
Fixed to require the same winner across all three policies; re-running
confirmed Swarm-vs-Aegis correctly drops off the flagged list under the
fix.

**Item 2: Cortex-vs-Swarm left alone**, exactly as instructed.

**Item 3: Aegis-vs-Cortex, an honest two-attempt journey.** First attempt:
a brand-new Aegis Tool, "Redundant Barrier Coil" (0/0 stats, grants
Barrier, same mechanism as the existing Barrier Shim but at Uncommon
rarity for more copies) — reasoned as reusing a proven mechanism (Barrier
already fully absorbs Cortex's flat-damage removal, its main answer suite)
without any new engine work. Measured at 1 and 2 copies: BOTH measured
WORSE for Aegis-vs-Cortex than the pre-session baseline under every single
policy (2 copies: Aggressive 67.7% -> 73.7% Cortex; 1 copy: still 73.7%
under Aggressive, 51.7%->? no material improvement under Random/Lookahead
either). Investigated rather than shipped anyway: this is the exact
"reactive/zero-immediate-impact card has negative opportunity cost under a
heuristic agent" failure mode session 11's original Aegis defensive-card
batch already discovered and documented (owner-feedback.md's 2026-09-19
entry) — a Tool with no visible stat bump reads as worthless to
AggressiveAgent's cost/stat heuristic, so more copies just means more turns
wasted on a weak play instead of real tempo. Reverted entirely, both the
card and its pool-list entry.

Second attempt, evidence-led instead of design-first: read this pool's own
per-card win-rate table (which this project has kept as standing
instrumentation since Phase 1) and found Guard Directive Chip already the
single best-performing Aegis card by played win rate (~53-56% across every
policy, well ahead of the rest of the pool) — a Tool with a real stat bonus
(+1/+1) AND the Guard keyword, which forces the opponent to attack it
first. That's exactly the mechanism that blunts Cortex's kit, which is
almost entirely flat 2-damage removal (Diagnostic Pulse, Interrupt
Handler, Cascade Purge, Compiled Daemon's evolve). Bumped its copies 2 -> 3
(its Uncommon rarity ceiling), using the pool's exact remaining headroom
(39 -> 40 cards) — no new card, no cut, zero new engine work. Result,
measured at 300 seeds/policy: real movement under Aggressive (32.3% ->
35.7% Aegis, the worst-outlier policy going in) and essentially flat under
Random (56.3% -> 54.3%) and Lookahead (50.0% -> 48.3%). **Honest
conclusion: NOT in the 55-60% band on any policy.** The remaining
Aggressive-policy gap (Cortex still wins 64.3%) is large enough, and
Random/Lookahead's near-miss-but-flat numbers different enough in
character, that this reads at least partly as an agent-heuristic artifact
(AggressiveAgent's documented "no sense of whether a card is useful right
now" gap cuts both ways — it may also just play Cortex's removal-heavy kit
more efficiently than it plays Aegis's defensive kit) rather than a single
remaining card-level fix. Not chased with a third attempt this session —
flagged to the owner instead, per this project's "measure, report, don't
guess indefinitely" pattern.

**Item 4: Null step 4, past cost to power.** Per the entry's own two named
candidate axes for each card: Kernel Panic's destroy reach tightened
(`maxHealth: 5` -> `maxHealth: 4` in its ability's targeting filter) —
picked over touching its body stats because "destroy reach" is a more
legible, directly-testable lever, and it specifically closes the exact
boundary case the original 2026-09-17 fix left exposed (Latent Ward, 5
health, sat right on the old cap). Null Singularity's health cut 8 -> 7 —
picked over touching either of its two static auras because both auras are
its entire identity as the pool's Mythic capstone (the enemy-aura's health
component was already removed in an earlier session specifically to
protect Aegis; cutting the ally aura too would gut the design rather than
trim it), so the body took the cut instead. Measured after: **Aegis-vs-Null
is no longer triple-flagged.** Lookahead moved from 67.7% Null down to
58.0% — landing IN the 55-60% band outright, the exact "stop" condition the
2026-09-20 backstop and this entry both name. Aggressive (78.0% -> 72.0%)
and Random (72.0% -> 72.3%, essentially flat) haven't individually reached
band, but the project's actual pass/fail bar has always been the
triple-policy cross-check, and that's now clear — so, per "stop when it
lands in band," nothing further was attempted on Null this session.

**Real-play evidence, not just aggregate numbers.** Wrote
`engine/src/dev/ring2609MatchDemo.ts` (mirrors
`segfaultConditionMatchDemo.ts`'s re-drive-the-move-loop shape) and ran a
seed search for both shipped mechanisms in real, unscripted
LookaheadAgent-vs-LookaheadAgent play: found on the first search range
tried (seeds 1-400) — Guard Directive Chip forcing an attack onto its own
equipped unit (Aegis vs Cortex, seed 1), and Kernel Panic's tightened reach
leaving a 5-health Latent Ward with zero eligible destroy targets, which
then survives (Null vs Aegis, seed 16). Committed as
`progress/sample-match-019-ring-fixes.txt`. Added
`engine/test/nullFaction.test.ts`'s new whitebox test pinning the tightened
reach against a synthetic fixture, alongside the pre-existing "way over
cap" test so both the old and new boundary are covered.

**Whole-ring re-measurement.** 300 seeds/matchup, all three policies,
against the corrected ring:
`progress/balance-report-012-ring-followups.txt` has the full before/after
table (vs balance-report-011) and the honest read. Headline: Aegis-vs-Null
and Swarm-vs-Null are both now clear of the triple-flag; Cortex-vs-Swarm
remains triple-flagged (untouched, per instruction); Aegis-vs-Cortex is
real-but-partial progress, not yet in band on any policy. No pairing newly
regressed into a triple-flag that wasn't one before.

`npm test` (root, all four workspaces): 82/82 in engine (81 previously + 1
new test), unchanged in protocol/server/agents (not touched this session).
`npx tsc --noEmit` clean in engine.

**Not attempted this session, correctly deferred:** a third Aegis-vs-Cortex
lever (flagged to the owner instead, per notes-for-owner.md); any
Cortex-side change (forbidden by this entry); Phase 5 (pool expansion) —
Cortex-vs-Swarm and Aegis-vs-Cortex remain the two open pairings, and
whether to keep chasing them card-by-card or let Phase 5's wider pool
settle them is an open question for the owner, not decided unilaterally
this session.

## Session 19 (2026-09-25) — Phase 5 slice 1: Aegis pool growth (18 -> 22 unique cards)

Balance session per the render/balance alternation rule (most recently
merged PR, #21, was a render slice). Acted on owner-feedback.md's
2026-09-25 "accept the ring as directionally done; start Phase 5" entry —
the highest-priority unhandled feedback, and the first genuinely unhandled
entry since the render-lane items also dated 2026-09-25 (which are out of
scope for a balance session).

Scoped this slice to **one faction** (Aegis), not all four — growing every
faction to the roadmap's 30-40-unique-card target in a single session would
not be "one real, complete slice" (TASKS.md); other factions' own Phase 5
growth is left for future sessions, named explicitly in the concrete-next-
step note.

**What got built.** Four new Aegis cards
(`engine/src/data/aegisCards.ts`), chosen to satisfy this entry's specific
item 3 instruction — "aim some of Aegis's new cards at its Cortex matchup —
immediate-board-impact cards, NOT zero-tempo utility" (after two prior
zero-tempo attempts, sessions 11 and 18, both measured no better or worse):

- Bulwark Chassis (Common, cost 2): a stat-only wall, no ability at all —
  the immediate impact IS the stat line.
- Reinforced Bastion (Uncommon, cost 3, Guard): a second power-point on the
  Guard-wall archetype Barrier Drone started, per the variation rule
  (2026-09-20 entry, Phase 5 item 9 — 2-4 cards per archetype at different
  cost/power points).
- Salvage Reflex (Uncommon, cost 2): a genuinely new archetype for this
  pool — onDeath, converts a removal spell spent on it into Barrier for a
  random ally, directly punishing a removal-heavy opponent rather than just
  surviving longer.
- Aegis Line Trooper (Common, cost 1): the pool's first 1-drop with real
  attack pressure (existing 1-drops, Aegis Cadet and Barrier Drone, are
  both passive/defensive) — a proactive clock so games don't stall out
  while a removal deck assembles its plan.

Funded by trimming the pool's own measured weakest cards
(balance-report-012's per-card win-rate table), not guesses: Diagnostic
Ward (37.2-46.4% played, the pool's worst by a clear margin) 3->1;
Static Ward Beacon, Barrier Shim, Latent Ward, Lockdown Field each 2->1;
Barrier Drone and Failover Custodian each 3->2; Breach Charge 2->1. No
existing card was cut from the deck entirely — every mechanic the pool
already had stays represented at least once. Net: still exactly 40 copies,
the deck-size cap, with 4 more unique cards than before.

**The overtuned first cut — caught and corrected before shipping, not
shipped and left for the owner to catch.** The first stat line (Bulwark
Chassis 1/5; Reinforced Bastion 2/6 Guard — strictly better in health than
Cortex's own Firewall Sentinel, 2/5 Guard, at the same cost) was designed
by "big health survives Cortex's flat 2-damage removal" reasoning alone,
without benchmarking against the existing curve. Re-measuring it with
`balanceReport.ts` (300 seeds, 3 policies) showed why that reasoning wasn't
enough on its own: Aegis-vs-Cortex flipped hard toward Aegis (59.3-70.3%
Aegis across the three policies) but so did Aegis-vs-Swarm (57.7-78.7%
Aegis) and Aegis-vs-Null (Null cut to 29.7-58.3%, badly out of its own
55-60% target band on the LOSING side) — the fix made Aegis generically
stronger, not specifically better against Cortex, which is exactly the kind
of collateral damage this project's "measure, then fix" discipline exists
to catch. Not shipped. Rewrote the two stat lines to explicitly match an
existing card's precedent at the same cost (Bulwark Chassis -> Cortex
Engineer's 1/3; Reinforced Bastion -> at/below Firewall Sentinel's 2/5
Guard; Aegis Line Trooper -> even combat math with Signal Drone's 1/1
rather than a strict upgrade), then re-ran the full report again.

**Result after the correction, measured for real:**
`progress/balance-report-013-phase5-slice1.txt` (300 seeds/matchup, 3
policies). **Aegis-vs-Cortex is no longer triple-flagged** — the project's
actual pass/fail bar, per the 2026-09-25 accept-the-ring entry's own
precedent for Aegis-vs-Null/Swarm-vs-Null. Random (58.7%) and Lookahead
(59.3%) both land IN the 55-60% target band; Aggressive sits at 47.0%
(Cortex slightly favoured, out of band but not extreme — Aggressive is this
project's least-trusted policy per multiple prior sessions' notes).
Cortex-vs-Swarm remains the sole triple-flagged pairing, untouched, exactly
per the owner's standing "not a problem to assign a fixer to" instruction.

**Honestly named, not chased further this session:** Aegis-vs-Swarm (a
45-55% "even" target pairing) moved to 57.7/71.0/70.7% Aegis — real
collateral drift, not triple-flagged (Aggressive's 57.7% stays under the
independent 60% flag threshold so the three policies don't all
independently clear it), but a genuine new watch item. This is the second
faction pairing this slice's own change measurably moved without being
aimed at it (the first being the earlier-caught Aegis-vs-Null wobble, which
the correction brought back close to its pre-session shape: Random 58.3%
IN BAND, Aggressive 49.7% near-band, Lookahead 38.0% — a real remaining
gap on Lookahead specifically, not triple-flagged either way, left as-is
per this session's Aegis-vs-Cortex scope). Flagged in
`progress/notes-for-owner.md` and `progress/checkpoints.md` rather than
unilaterally re-tuned again — this slice's job was Aegis-vs-Cortex
specifically, and a third tuning pass in one session risks the same
whack-a-mole pattern session 11's three-card batch and session 16-17's
triangle work already warned against.

**Real-play evidence, not just the aggregate numbers.**
`engine/src/dev/phase5Slice1MatchDemo.ts` (mirrors ring2609MatchDemo.ts's
seed-search shape) found, in real unscripted LookaheadAgent-vs-LookaheadAgent
Aegis-vs-Cortex play: Salvage Reflex granting Barrier to a random ally on
death (seed 6) and Bulwark Chassis surviving a real Cortex point-removal
spell and staying on the board (seed 8). Both full match logs committed:
`progress/sample-match-020-phase5-slice1.txt`.

**Tests.** `engine/test/aegisPoolExpansion.test.ts`, 4 new tests: Salvage
Reflex grants Barrier with an ally present; no-ops cleanly (no throw, empty
board) dying completely alone; with 2 allies present, exactly one (never
the dying unit itself) gains Barrier — proving the "never targets itself"
property the trigger-ordering comment claims, not just asserting it; and
the pool still builds a legal 40-card deck (lint + copy limits + size) at
its new 22-unique-card count. `npm test` (root, all five workspaces):
86/86 engine (was 82), 147/147 total. `npx tsc --noEmit` clean in all five
packages.

**Not attempted this session, correctly left open:** Cortex/Swarm/Null's
own Phase 5 growth (each is its own future session); the neutral
shared-toolkit pool (roadmap item 10); per-card art slots beyond the
existing placeholder convention (item 11 — already satisfied by the
existing `placeholder:aegis/<slug>` pattern, extended to the 4 new cards,
so no separate work was needed here); the owner's Phase 5 "hard gate"
whole-ring re-measure (item 4 — explicitly scoped to "the end of Phase 5's
first full pass," not after one faction); the small event-log
instance-IDs engine task and the render-lane animation-magnitude task from
the other two 2026-09-25 owner-feedback entries (neither in this session's
scope).

## 2026-09-26 — Session 20 (Phase 5 pool expansion, Swarm slice)

Read `progress/owner-feedback.md` first, per TASKS.md — no unhandled entries
(everything through the 2026-09-26 "reserve player identity" entry is either
HANDLED or a render-lane item, and the most recently merged PR (#24,
"Render: defence/shield primitives") was a render slice, so per the
2026-09-24 alternation rule this session took the normal balance/roadmap
priority instead of a render slice). No CRITICAL quality-debt item exists
(checked `progress/quality-debt.md` for the word explicitly — none found).
Consulted `progress/roadmap.md`: item 3 (the balance pass) is IN PROGRESS,
inside Phase 5 (pool expansion); session 19 grew Aegis and named Swarm as
the natural next pick, since it's the faction named in two open watch items
(Cortex-vs-Swarm pre-existing, Aegis-vs-Swarm newly drifted) — the owner's
own 2026-09-26 "session 19 confirmations" entry endorsed exactly this
("Swarm next would help both its own weak matchups and the Aegis-vs-Swarm
drift"). This session did that: Swarm's Phase 5 slice.

**Baseline, measured before touching anything**
(`npm run balance` from a clean `main`, 300 seeds/matchup, 3 policies):
Cortex-vs-Swarm was the sole triple-flagged pairing (Cortex 60.3-70.0%
across all three policies — clearly out of its 55-60% target band on the
wrong side, too dominant); Aegis-vs-Swarm (an "even" 45-55% target pairing)
sat at 57.7/71.0/70.7% Aegis, real and untouched since session 19; and
Swarm-vs-Null (a decisive [W] edge Swarm should win 55-60%) was wildly
policy-dependent (49.7% Aggressive/even, 24.3% Random/badly Null-favoured,
43.3% Lookahead/Null-favoured) — Swarm was this session's baseline-worst
faction across three of its four matchups, which is why this slice is a
general power-level pass, not a single-pairing aim the way Aegis's was.

**Grew Swarm from 16 to 20 unique cards** (`engine/src/data/cards.ts`).
Four new cards, all real, immediate board stats — per the established
failure pattern (Brood Reserves, session 11's Aegis defensive batch) that
the dummy agent policies undervalue reactive/"hold this for later" cards,
none of the four ask for timing judgment:
- **Brood Skitterer** (Common, cost 1, 1/2, no ability) — Swarm's cheapest
  bodies (Swarm Larva 1/1, Colony Broodling 1/1, Spore Cluster 0/3) were
  all below the cross-faction median for a vanilla 1-drop; this fills that
  specific gap.
- **Carapace Grunt** (Common, cost 2, 2/2, no ability) — Swarm had zero
  plain cost-2 stat body; every existing one carries an ability.
- **Warren Guardian** (Uncommon, cost 3, 2/3, Guard) — Swarm's first Guard
  unit; it had no front-line protection for the rest of a wide board
  (Barrier Node's Barrier keyword is a one-hit self-shield, not a Guard).
  Printed below both established cost-3 Guard benchmarks (Firewall
  Sentinel 2/5, Reinforced Bastion 2/4) on purpose — Swarm's identity is
  numbers, not individual toughness.
- **Bloodswarm Alpha** (Rare, cost 4, 3/3, onPlay: summon a 1/1 Swarm
  Larva) — a real body that ALSO advances the go-wide plan the instant
  it's played, unlike a pure summon spell with no board presence of its
  own (Brood Reserves' own measured weakness).

Funded by data-driven trims of the pool's own measured weakest cards from
this session's baseline report (not guesses): Rally Cry, Barrier Node,
Reflex Spike, Dormant Egg Sac, Chitin Plating, Spore Cluster, and Brood
Reserves each lost 1-2 copies — no existing card removed from the deck
entirely. Deck stays at exactly its 40-card cap (16 unique cards' copies
trimmed by 10 total, 4 new cards added at 10 copies total); pool lint,
copy limits, and deck size all still pass (a new committed test asserts
this).

**Honest journey — the first cut was overtuned, caught by this session's
own re-measurement, and corrected before shipping, same pattern as session
19's Aegis slice.** The first stat line (Brood Skitterer 2/1; Carapace
Grunt 3/1, matching Aegis Line Trooper/Bulwark Chassis's exact stat lines;
Warren Guardian 3/3 Guard; Bloodswarm Alpha 4/4 + summon) measured badly
overtuned: EVERY Swarm card's played win rate jumped uniformly (even
completely untouched cards — Swarm Larva 47.6% -> 63.0%, Corrosive Spitter
45.2% -> 67.0%), and Cortex-vs-Swarm flipped from Cortex dominant (60-70%)
to Swarm dominant (57-66% Swarm across all three policies) — the whole deck
got generically too strong, not specifically better in its weak matchups.
Not shipped. Root cause: this session's benchmark cards (Aegis Line
Trooper, Bulwark Chassis, Reinforced Bastion) were themselves among Aegis's
stronger-testing cards (58-63% drawn win rate in their own pool), not a
neutral baseline — copying their exact stat lines onto a Swarm pool that
started well below 50% average created a much bigger jump than intended.
Scaled every new card back below its original benchmark (Brood Skitterer
-> Init Daemon/Glitch Seed's 1/2; Carapace Grunt -> Fail-safe Unit's 2/2;
Warren Guardian -> below both established Guard benchmarks at 2/3;
Bloodswarm Alpha's body -> 3/3, with the summoned token as the real payoff
rather than a bonus on top of an already-on-curve body), then re-measured.

**Result after the correction: no cross-faction pairing is triple-flagged
at all** — Cortex-vs-Swarm, the project's sole standing triple-flag, is
resolved (Lookahead 44.3% Cortex, i.e. Swarm now slightly favoured — see
the honest "overshot" note below) — and Aegis-vs-Swarm is back in band on
2 of 3 policies (Aggressive 47.7% IN BAND, Lookahead 53.0% IN BAND — the
trusted arbiter policy — Random 56.7%, just outside). Per-card win rates
across the whole Swarm pool now cluster sanely around 48-56% (Hive Mother's
Mythic capstone and Molted Stalker's evolution payoff the expected
outliers), instead of the first cut's uniform 55-65%+ spike. Full
before/after: `progress/balance-report-014-phase5-swarm-slice.txt`.

**Named honestly, not chased further this session — two real, opposite-
direction overshoots from the same broad buff:**
- **Cortex-vs-Swarm swung past even into Swarm-favoured** (Lookahead 55.7%
  Swarm, Random 53.0% Swarm, Aggressive 53.7% Cortex — mixed, not
  triple-flagged either way) rather than landing at the ring's actual
  target (Cortex should win 55-60%). This is squarely inside what the
  owner's 2026-09-23 entry anticipated for this pairing ("Phase 5 wider
  pools will likely settle it... do not add a card or nerf anyone
  specifically for this pairing") — a broad Swarm buff is exactly a
  "wider pool" action, not a pairing-specific one — but the result is a
  new, mild reverse-imbalance rather than a settle-to-band, worth the
  owner's eyes.
- **Swarm-vs-Null remains genuinely unresolved, now in a different shape.**
  The cross-check reports "three independent >=60% signals but NOT the
  same winner" (Aggressive and Lookahead now favour Swarm at 61.3%/64.3%,
  Random still favours Null at 64.0%) — real movement (Random was 75.7%
  Null in the baseline), but policy disagreement, not a resolved pairing.
  Not chased further this session — per this project's own standing
  practice (2026-09-25 "accept the ring as directionally done" entry),
  Lookahead is the trusted arbiter and Lookahead now favours Swarm
  (64.3%, above its own 55-60% target band on the winning side) — but
  Random's persistent Null-favoured read on this specific pairing is a
  genuine, named open question, not silently resolved.

**Real-play evidence, not just the aggregate numbers.**
`engine/src/dev/swarmPoolExpansionMatchDemo.ts` (mirrors
phase5Slice1MatchDemo.ts's seed-search shape) found BOTH new mechanisms in
a single real, unscripted LookaheadAgent-vs-LookaheadAgent Swarm-vs-Null
game on the first seed tried: Bloodswarm Alpha's onPlay summoning a Swarm
Larva token, and Warren Guardian's Guard keyword forcing Null's Fork Bomb
token to attack into it instead of a softer target. Full match log
committed: `progress/sample-match-021-phase5-swarm-slice.txt`.

**Tests.** `engine/test/swarmPoolExpansion.test.ts`, 3 new tests: Warren
Guardian's Guard keyword actually forces every legal attack onto it (same
assertion shape as the existing generic Guard test); Bloodswarm Alpha's
onPlay creates a real, fully-functional 1/1 token alongside itself (not
just a log line); and the pool still builds a legal 40-card deck (lint +
copy limits + size) at its new 20-unique-card count. `npm test` (root, all
five workspaces): 89/89 engine (was 86), 176/176 total. `npx tsc --noEmit`
clean in all five packages.

**Not attempted this session, correctly left open:** Cortex/Null's own
Phase 5 growth (each is its own future session); the neutral shared-toolkit
pool (roadmap item 10); the owner's Phase 5 "hard gate" whole-ring
re-measure (item 4 — Cortex and Null still haven't had a Phase 5 pass, so
this still isn't "the end of Phase 5's first full pass"); the small
event-log instance-IDs engine task and the render-lane items from the
2026-09-25/26 owner-feedback entries (none in this session's scope, though
the instance-IDs task remains a good pickup "when convenient during Phase
5" for a future balance session with spare budget).

## 2026-09-26 — Session 21 (Phase 5 slice 3: Null depth/variety pass, 15 -> 20 unique cards)

Balance session under the alternation rule (the last merged PR, #26, was
render). Owner feedback had one actionable entry: the 2026-09-26 "session 20
confirmations" entry named Null as the next Phase 5 slice, "a DEPTH /
VARIETY pass, not a power buff", with a pull-back clause if Null climbed
under Lookahead. Not a hardening session: quality-debt is long, but the
owner's explicit steer overrides the cadence, and this slice deepens the
card pool rather than adding surface.

**Built:** five Null cards, each using a trigger or keyword Null never had.
They are Zombie Process (onDeath token), Dangling Pointer (Rush), Bit Rot
(Instant -3/-0 trick), Watchdog Timer (Directive, onTurnEnd draw on an empty
hand) and Garbage Collector (activated heal). The deck went 32 -> 40 with no
trims. Removal density fell from 25.0% to 22.5%. I also fixed a LookaheadAgent
blind spot: Directive turn triggers were never valued.

**Ran it, three times.** Baseline and each cut used the full 300-seed,
three-policy balanceReport.
- Cut 1 was a NERF. Null's Lookahead rate vs Cortex fell 46.3 -> 39.7, which
  pushed an in-band even edge out of band. The new cards measured 36-46% when
  played, and Watchdog Timer was played 0 times in 900 Lookahead games. The
  cause was an agent blind spot, not the card.
- Cut 2 fixed the agent and brought three cards up to average precedents:
  Zombie Process to the vanilla 2/2 line, Bit Rot to -3, and Garbage
  Collector to Watchtower Relay's cost 3. Numbers were near neutral. But a
  scratch trace showed Watchdog Timer never drew once. The agent only affords
  it with 2-4 units already on board, so "fewer than 2 units" was never live.
- Cut 3 (shipped) re-gated Watchdog Timer on an empty hand. In this cut the
  Lookahead Null mean is 42.1%, up from 40.0%. Vs Cortex went 45.0, vs Swarm
  36.3 and vs Aegis 45.0, up from 38.0. No pairing is triple-flagged. Every
  non-Null pairing is byte-identical to report 014, which confirms the agent
  fix moved nothing else.
- `nullPoolExpansionMatchDemo.ts` found all five mechanisms in real
  unscripted Lookahead play. Four of them fire in one game (seed 1, Cortex vs
  Null), committed as `sample-match-022`.
- The demo's first Watchdog detector was itself wrong. It looked for a draw
  directly after turnEnd, but an abilityTrigger entry sits between them.
  Fixed before the evidence was committed.

**Worked:** the variety claim is real and proven per card, and the power
constraint held. **Named, not fixed:** filling the deck to 40 dilutes Null's
evolution line. Kernel Panic's Lookahead played-count halved (206 -> 105),
though its played win rate held. Null is still the lowest-winning faction
under Lookahead, and its ring edge over Aegis is still out of band under
Lookahead (45%). Watchdog Timer's 37% played win rate is selection bias: it
only fires when Null is out of cards. **Blocked:** nothing.
`npm test` 225/225, `tsc` clean in all five packages.

## 2026-09-26 — Session 22 (Phase 5 slice 4: Cortex depth/variety pass, 19 -> 24 unique cards)

Balance session under the alternation rule (the last merged PR, #28, was
render). The owner's 2026-09-26 "session 21 confirmations" entry put Cortex's
Phase 5 slice next. That entry also flagged watching Cortex-vs-Swarm, where
Lookahead had Cortex at 44.3% against a 55-60% target. The newest owner entry
(session 6 render review) is render-lane only, so I acknowledged it for the
next render session. Not a hardening session. Quality-debt is long, but no
item is CRITICAL, and the owner's explicit order governs, as in sessions
20-21.

**Built:** five Cortex cards aimed at Swarm's width, each a shape Cortex
never had: Rate Limiter (Directive, onTurnStart sweep when the enemy has 3+
units), Load Balancer (onAttack ping), Hotfix (Instant friendly +1/+2),
Deadlock Detector (onPlay stun when the enemy has 3+ units) and Quorum
Arbiter (Mythic, attack = 1 + enemy units). Funded by trimming one copy each
of the seven weakest Lookahead cards. I also added
`engine/src/dev/lookaheadEdgeCheck.ts`, a Lookahead-only edge check on any
seed range.

**Ran it, many times.**
- Cut 1: Swarm 56.0 (in band), but Aegis-vs-Cortex was just out (60.7
  Aegis) and Null-vs-Cortex went to 60.3 Cortex.
- Cut 2 (shipped): Rate Limiter at threshold 3 x2, fewer Hotfix/Deadlock,
  Watchtower kept. Lookahead 300: Swarm 58.7, Aegis 43.3, Null 63.7.
- Ablation (one card out at a time) showed Rate Limiter is the only truly
  Swarm-selective card. Card-design variants (thresholds, max-health
  filters, Quorum stat lines) all moved within noise.
- A 150-mix copy search on seeds 1-300 never found Swarm >= 55 and Null <= 55
  together. Its best mixes regressed on held-out seeds 301-900, which is a
  seed-fit. Cut 2 held out best.
- The held-out run surfaced the main finding: the BASELINE reads 59.3%
  Cortex-vs-Null on seeds 301-900, against 55.0% on 1-300. Over 900 seeds,
  Null is 42.1 / 36.6 / 37.3% against Cortex / Swarm / Aegis. The
  300-seed reports had been hiding how weak Null is.
- Final over 900 seeds: Cortex-vs-Swarm 46.7 -> 54.1, Aegis-vs-Cortex held
  (Aegis 58.4), Null-vs-Cortex 57.9 -> 61.1 Cortex.
- Demo: all five mechanisms found in real Lookahead play, three in one game.
  Hotfix is almost never cast reactively (2 of 262 casts). Reflex Spike
  shows the same agent blind spot (0 of 150).

**Worked:** the targeted edge moved a lot, the variety claim is real and
tested, and the lint held. **Named, not fixed:** Null-vs-Cortex drifted
further out of band, and I flagged that to the owner as an overrulable call.
Random policy now has Cortex over Swarm at 73%. Hotfix's Instant identity is
invisible to the trusted agent. **Blocked:** nothing. `npm test` 249/249,
`tsc` clean in all five.

## 2026-09-28 — Session 23 (Phase 5: the Null consistency trim, 40 -> 36)

Balance session: the last merged PR (#30) was render. The owner's revised
Phase 5 order puts the Null trim first, so that's what I did. Null 40 -> 36:
Decay Ward 2->1, Fork Bomb 3->2, Null Shell 3->1. No card stats touched; all 20
unique cards kept. I didn't pick the cuts by hand. `nullTrimSearch.ts` runs a
greedy ablation under Lookahead on seeds 1-900 (drop one copy of each card,
re-measure all three edges, cut the best, repeat), then checks on held-out
seeds. On 3,600 held-out seeds (901-4500), Null gained about +4.0 / +3.7 /
+3.6 vs Cortex / Swarm / Aegis. Kernel Panic went from ~7.5% to ~10% of Null's
games.

**What worked and what didn't.** The first unconstrained search cut a Kernel
Panic copy, the opposite of the owner's aim. A second run with Kernel Panic
protected wanted Bit Rot and Watchdog Timer gone entirely. That lifted Null
about twice as much, but it failed the session-21 variety test: those are
Null's only Instant trick and only turn trigger. I shipped the
keep-every-card variant and flagged the other to the owner. Greedy steps
were noisy (one step had every option negative). So I compared five nearby
decks on two held-out ranges. All were within noise; I kept the search's own
pick. Deck list order changes the shuffle, so the search rebuilds the
pre-trim deck in its original order.

**Also built:** `edgeMeasure.ts`, with Wilson/Newcombe intervals and the
owner's CI band rule. It's tested against published values and
wired into `lookaheadEdgeCheck.ts`. Finding: at 900 seeds the CI is wider
than a 5-point band, so those bands can never come back IN. This matters for
the gate design and is flagged to the owner.

**Unplanned fix:** the trimmed deck made `render/test/attackFx.test.ts` fail.
A real game (Null vs Aegis seed 3) had LookaheadAgent cast Intercept Routine
onto the unit already under attack, and the engine logged a redirect from X
to X. `resolver.ts` now logs a fizzle for that; there's a regression test.
Game state is unchanged, and the 900-seed report is byte-identical apart from
whitespace.

**Ran it:** `balanceReport.ts 900` before and after, `lookaheadEdgeCheck.ts`
for all four factions at 900 seeds, all three search variants, and
`nullTrimMatchDemo.ts`. Null finished the Kernel Panic evolution in 13/200
games vs Aegis; the seed-4 log is a Kernel Panic win. `npm test`: 262/262.
`tsc` clean in all five workspaces.

**Not fixed:** Null is still the weakest faction (41.1 / 41.7 / 39.6 under
Lookahead). Null > Aegis is still inverted (Aegis 60.4%). Cortex-vs-Null
moved toward band (61.1 -> 58.9) but is still out. **Blocked:** nothing.
Next is a render slice, then the neutral pool.

## 2026-09-30 — Session 24 (Phase 5 step ii: the neutral pool)

Balance session: the last merged PR (#32) was render. Owner feedback first. The 2026-09-30
self-containment entry is handled. The statistics port is now permanent and gained the z-test,
a provenance line and a hardcoded parity fixture. The 2026-09-29 entry is acknowledged. Its
item 1 governed this session: no Null cuts.

**Built:** 10 neutral utility cards covering draw, health, energy, a vanilla body and a plain
tool. There's a load-time lint for "utility, not identity" and hybrid-deck rules: one faction
plus at most 10 neutral copies, and clock/flow checked on faction cards only. `neutralPackageSearch.ts`
picks each faction's package against a ring-distance objective, with a no-sandbag guard and a
held-out ship rule. `neutralPoolMatchDemo.ts` gives real-play evidence, including a probe mode
for all 10 cards. There were small render compatibility edits.

**Found and fixed on the way:** LookaheadAgent valued heals and energy at their printed amount.
The resolver caps both, so the agent was burning spare energy on no-op repairs: 1,231 Cortex
Engineer activations in 200 games, 66 of which healed. Once capped, it stacked a second repair
on its own pending one. It now nets out pending stack heals, and 93/93 repairs heal. This moved
the ring more than the neutral cards did for Cortex: Cortex vs Null went 58.9 -> 65.7 on the
fixed agent before packages.

**Ran it:** four searches (900 search seeds, 2,500 held-out). The first run was discarded for
three reasons: it cut Null copies, its ablation probe broke Null's removal cap, and it had no
held-out rule. Shipped: Cortex swapped 2 copies for Rollback Point and Surge Protector. Null
added +3 Commodity Rack and +1 Rollback Point, going 36 -> 40. Swarm and Aegis took nothing;
Aegis's best pick got worse on held-out seeds. Final Lookahead ring over 900 seeds: only
Aegis-over-Null is OUT (52.2% Aegis, was 60.4%). The rest are UNRESOLVED. Null's mean went
40.8 -> 44.1. `balanceReport.ts 900`: no triple-flag.

**Named, not fixed:** only 3 of 10 neutral cards made a shipped deck. Commodity Rack (vanilla 3/3)
is the standout, 48% in the probe vs 34-42% for the utility cards. Kernel Panic's share of Null
games fell from 9.9% to 7.1% with the 40-card deck. Power Reserve is weakest (34%); the agent
never holds energy for it to matter. **Blocked:** nothing. `npm test` 285/285, `tsc` clean in
all five. Next: render slice, then the Phase 5 gate.

## 2026-10-01 — Session 25 (owner follow-ups: Rack, the Null card-vs-agent check, claude-tools)

Balance session, by the owner's 2026-10-01 entry ("next session priority: the Null card-vs-agent
check"), even though the last merged PR (#33) was also balance. Owner feedback first. Two
unhandled entries, both now handled.

**claude-tools reference:** removed from `edgeMeasure.ts` and from the progress files. The
statistics and the parity fixture are unchanged. The only remaining mentions are the owner's own
words in owner-feedback.md.

**Commodity Rack, agent first:** `dev/cardAdvantageCheck.ts` plays LookaheadAgent(weight W) vs
LookaheadAgent(1.5) on the shipped decks, every ordered pairing, both seats, 16,000 games per
weight. Nothing beats 1.5; 4.5 (-1.6) and 6 (-2.5) are measurably worse. Draw cards didn't improve
in the probe at 4.5. So the agent doesn't under-value card advantage. Rack was still top on the
fixed agent (45.9% vs 36-42%), so it's now 3/2 (41.3%).

**Null card-vs-agent check:** `dev/nullCardPlayCheck.ts` classifies every cast of Bit Rot,
Decay Ward, Null Pointer and Watchdog Timer by what it could do there. `dev/nullCardAblation.ts`
measures each card's worth to Null at 7,500 games, on the old and fixed agents.
- Bit Rot: 222/240 casts hit a unit that never fought, an agent misplay. Cutting it went from
  +2.7 (old agent) to -0.5 (fixed).
- Decay Ward: host choice was random. Fixed, but the card's cost barely moved.
- Watchdog Timer: weak card (+1.9 to cut on the fixed agent, CI excludes 0). Not touched; it's
  flagged.
- Null Pointer: situational. It's stranded with no target in 270/900 games.

**Agent fixes:** this-turn buffs are valued by the fight they change (pending combat, else the
best attack they improve on your own turn, else 0). Tools pick the best host and don't re-grant
Barrier. Four new tests.

**Re-search** (`--strip-neutral`, new flag): Null ships its bare 36; Aegis takes -1 Salvage
Reflex +1 Uplink Tower; Cortex and Swarm are unchanged. All of these passed the held-out rule, and
all per-edge changes are noise.

**Ran it:** h2h (5 weights x 16,000 games), probes, play checks old/new, ablations old/new, four
searches, `lookaheadEdgeCheck.ts` x4 at 900 (Null also at 2,500), `balanceReport.ts 900`.
Ring: three edges OUT, all Null's (40.0 / 38.9 / 41.4). Most of that is the Rack nerf: about -6 /
-3.5 / -6 on its own. There's no triple-flag. `npm test` 289/289, `tsc` clean in all five. A
render test that pinned move numbers now finds the moves itself.

**Blocked:** nothing. **Flagged:** Null's weakness after the nerf, and a Watchdog Timer buff
candidate. Next: render slice, then the Phase 5 gate.

## 2026-10-03 — Session 26 (the Phase 5 gate)

Balance session: the last merged PR (#35) was render. Owner feedback first. The 2026-10-02 entry
approved a Watchdog Timer buff and said to measure Null at the gate rather than patch it. The
2026-10-03 entry (effects v2) is mostly render-lane; its balance-lane items are acknowledged.

**Watchdog Timer:** now draws when the hand has 1 card or fewer. Measured before/after with
`nullCardPlayCheck.ts` and `nullCardAblation.ts`. Draws went 23 -> 102 per 900 games, Null 40.1 ->
40.4% on the same 7,500 games. No overshoot, so it stays. The play check now records the hand
size behind every Watchdog draw: 17 at 0 cards, 85 at 1.

**The gate:** `lookaheadEdgeCheck.ts` x4 factions at 900 and 2,500 seeds, `balanceReport.ts 900`.
Result: 2 IN, 1 UNRESOLVED, 3 OUT. Null > Aegis 42.0, Null ~ Cortex 40.7 and Aegis > Cortex 52.2
are OUT; Swarm > Null 59.4 is UNRESOLVED on the band's top edge. No triple-flag.

**Levers:** the pre-authorized Quorum Arbiter drop now moves Cortex-vs-Null only -2.7 / -1.0
(gate / held-out seeds), and the edge stays OUT. I didn't drop the Mythic; it's asked in
notes-for-owner.md. `nullLiftProbe.ts` measured +1 atk / +1 hp on all 12 Null units (24 variants
x 7,500 games, leaders confirmed on 2501-5000). Most lifts break Null-vs-Swarm's lose band.
Propagating Exploit 2/3 doesn't: held out it puts Null vs Cortex at 48.0 and vs Swarm at 43.6, both
IN, and vs Aegis at 50.5, still OUT. That's recommended, not shipped; it's the owner's reserved call.

**Ran it:** all of the above (about 4 minutes of compute), `npm test` 302/302, `tsc` clean in all
five workspaces. **Blocked:** nothing. Checkpoint written. Next: render (EFFECTS.md v2 slice 1),
then a balance session applying the owner's gate answers.

## 2026-10-04 — Session 27 (Phase 5 closed; event-log instance ids)

Game-lane session: the last merged PR (#37) was render. Owner feedback first. The 2026-10-04
entry says to close Phase 5 (section A), then persistence before the economy. The 2026-10-03
entry's balance-lane item (b) asked for instance ids in the event log. Both were done.

**Phase 5 closed:** Quorum Arbiter kept. Propagating Exploit 2/2 -> 2/3, re-measured once:
Null vs Cortex / Swarm / Aegis = 47.6 / 43.8 / 48.2 on 2,500 seeds (was 38.6 / 40.6 / 42.0),
and 49.2 on the 900-seed even band (was 40.7, OUT -> IN). Held out (2501-5000), the numbers match
the session-26 probe exactly. Baseline: 3 IN, 1 UNRESOLVED, 2 OUT (both owner-accepted). Roadmap
marks Phase 5 done, pool growth paused, and the Stage 4 order follows the owner's sections B-E.

**Regression check:** `dev/ringRegression.ts` + `ringBaseline.json`, a CI step in the `test` job.
It fails on a worse band verdict, or a real move further out on an accepted-OUT edge. The six
edges take about 15 s. Shown passing on shipped code and failing (2 edges, exit 1) with the 2/2
Exploit. 4 unit tests on the judging rule.

**Instance ids:** source ids, target refs and stack ids on every event that names a board card.
They're optional in the type (render fixtures), enforced by `test/eventIds.test.ts`. That test
plays all 16 pairings with two policies and checks each event against real state, including the
exact damage each instance took. The test caught a real bug on its first run: an `attack` line
printed "attacks u11" when an onAttack had already killed the defender. Fixed by reading the name
first.

**Ran it:** three Null edge checks, the ring check (pass, then the deliberate fail), 64 matches
before/after (byte-identical text logs), the id demo (`sample-match-028-event-ids.txt`),
`npm test` 323/323, `tsc` clean in all five. **Blocked:** nothing. Checkpoint written (Stage 3
closed). Next: render (alternation), then session 28, persistence + economy spec.

## 2026-10-04 — Session 28 (persistence + the economy spec)

Game-lane session: the last merged PR (#39) was render. Owner feedback first. The 2026-10-04
Stage 4 entry orders persistence before the economy (section B). The economy answers and three
amendments settle finishes, packs, Prototypes, promos, quests and starters, and leave one
check-in open (the unique Mythic's effect menu). Two newer entries (2026-10-05) are render-lane.

**Built:** `economy/` (`@ai-tcg/economy`), a new workspace on Node's built-in SQLite. I picked
it over a JSON store because the economy needs real transactions: a pack purchase and a match
payout each write several rows that have to succeed or fail together. The schema (migration v1)
enforces the integrity rules itself:
- the ledger is append-only, and no entry may take a balance below zero;
- a match pays each agent at most once;
- decks hold only their own agent's live copies;
- serials are unique and fit their run;
- a cancel or abandon pays 0.
The store API covers agents, the ledger (balance = sum), per-copy grants, decks checked by the
engine's own `buildDeck`, `buyPack`, and `recordMatch`. `recordMatch` counts the agent's place in
the UTC day from match history, so a win past the cap still counts. The owner's win schedule is
built. The loss payout (2 credits, capped) is my provisional number, flagged. The engine only
gained exports (a card registry, the shipped deck lists).

**Spec:** `ECONOMY.md` gathers section C, the answers and the amendments into one document, with
each part marked BUILT, SPEC (with its session) or OPEN.

**Ran it:** `npm run demo -w @ai-tcg/economy` played 40 real Lookahead matches between four house
agents using decks saved from their own copies. The caps showed up for real: Aegis's 11th loss
and Null's 11th win paid 0. Day 2 reset to 40. A cancel and an abandon paid 0, and a duplicate
match and a raw ledger UPDATE were refused. Each agent bought one pack before the next purchase
was refused, and the balances matched the ledger sums after reopening the file. 18 new tests;
`npm test` 357/357, `tsc` clean in all six workspaces, and the ring check is identical to the
baseline.

**Blocked:** nothing. One open owner call (the Mythic effect menu, needed by session 30) and four
provisional numbers, all in notes-for-owner.md. Next: render (alternation), then session 29, the
economy build.


## 2026-10-06 — Session 29 (build-order step 1: the economy moves to the owner)

Game-lane session: the last merged PR (#41) was render. Owner feedback first. The 2026-10-05
entries add a build order that supersedes the roadmap's next item (sets and packs). Step 1 is
"move the economy to the owner": owner app spec section A plus the account-bound entry. Not a
hardening pass (session 29).

**Built:** schema migration 2 and a store rewritten around owners.
- The owner holds copies, credits, pack points, packs, decks and stats. Agents are "played by" on
  matches and payout rows.
- Copies record their origin. Crafted and starter copies are account-bound. The schema refuses
  unbinding, moving or salvaging a bound copy, and salvaging anything but an extra standard pack
  copy.
- Match caps count per owner, so switching agents can't reset them. The schema refuses an
  owner's own agents playing each other.
- The starter collection is once per owner. A new agent gets nothing.
- Built on the same model: owner stats with an agent filter, salvage (the owner's example), all
  economy numbers in one config file (win pay 30/10/5 as the owner trimmed it), and the pinned
  Node version.
- A v1 file migrates in place, one house owner per old agent. The migration runner now checks
  foreign keys before committing.

**Ran it:** `npm run demo -w @ai-tcg/economy` played 42 real Lookahead matches between four house
owners. After the Cortex owner switched agents mid-day, its next win paid 10, not 30. Self-play
and a second starter were refused. The salvage took the pack copy and left the three bound
starter copies. Balances matched the ledger after reopening the file. Output:
`progress/economy-demo-002.txt`. 28 economy tests (10 new), including a migration test on real
v1 rows. `npm test` 387/387 and `tsc` clean in all six workspaces.

**Blocked:** nothing. Next game-lane session: build-order step 2 (sign-in, one connected agent,
switching, generating an agent with its signature card, the house-agent admin data).
