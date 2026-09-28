# Roadmap

The persistent priority order for this project. When there is NO unhandled
owner feedback, work down this list: do the highest unfinished item that is
unblocked. This replaces "pick one of several options" guesswork with a
standing direction, so the owner doesn't have to choose every session.

## Overriding rule
If quality-debt.md has a CRITICAL item (a crash, a broken core system, a
failing/absent test on something load-bearing), FIX THAT FIRST regardless of
roadmap order. The roadmap orders growth; it never overrides fixing what's
broken. Continuation over completion still applies — do one item properly
rather than several half-done.

## Owner check-in items
A few items are marked [OWNER CHECK-IN]. For these, do the design/build work,
but write a checkpoint and PAUSE for owner steering on the taste-heavy
decisions before finalizing — the owner's call genuinely shapes these. Keep
building around them; don't block the whole project waiting.

## The order

### Finish and harden the card game (Stage 3)
1. DONE (session 8). Fourth faction (Null) built: 14 unique cards
   (engine/src/data/nullCards.ts), 34-card deck, full board-development
   coverage (evolution line, 2 telegraphs, 3 tools), cyberpunk/glitch-decay
   flavour. Measured with balanceReport.ts, one real fix cycle applied (see
   progress/balance-report-002-null.txt) — Null still double-flagged
   against Aegis specifically and above-50%-but-under-60% vs Cortex/Swarm
   under Random play; carried into item 3 below rather than re-opening this
   item.
2. DONE (session 9). Non-engine test coverage: `protocol` (7 tests),
   `server` (23 tests: pure `deepEqual`, a fake-socket `RemoteAgent` fault-path
   suite, and a real-socket integration suite driving the actual server
   against real `@ai-tcg/agents` reference clients), and `agents` (17 tests:
   `Rng`, `makeRandomDecision`, `aggressiveDecision`) all now have real
   vitest coverage — 81/81 tests pass across all four packages. See
   `progress/current.md` for what shipped and where it's still thin.
3. Balance pass across all four factions: IN PROGRESS (session 14). The
   2026-09-20 owner-feedback entry supersedes further card-by-card tuning
   with a six-phase plan (fix the instrument; engine gaps that create hard
   counters; pool-construction lint; the intended counter triangle; pool
   expansion; economy tie-in). Session 12 completed Phase 1 (the
   LookaheadAgent reference agent + standing per-card instrumentation).
   Session 13 completed Phase 2 item 3 (directive removal — one answer card
   per faction). **Session 14 completed Phase 2 items 4 and 5, closing Phase
   2 in full:** item 4 is a real "summon" (token) EffectSpec kind
   (effects/resolver.ts's summonTokens, bound by the shared BOARD_SLOTS cap),
   first used by Swarm's new Brood Reserves (summons two 1/1 Swarm Larva
   tokens); item 5 is UnitCard.baseArmor (a flat damage-reduction stat, read
   live off unit.card so evolving past the protected tier ends it
   automatically), applied at a proposed value of 1 to all six current
   evolution-line base cards. See progress/balance-report-007-summon.txt,
   progress/balance-report-008-basearmor.txt, and progress/log.md's
   session-14 entry for full re-measurements. Honest results: summon (item
   4) didn't help — Brood Reserves measures below average under all three
   policies and Cortex-vs-Swarm got measurably worse for Swarm; base armor
   (item 5) shifted several pairings (most visibly a real policy flip in
   Cortex-vs-Aegis under Random play) without changing which two pairings
   cross-check-flag (still exactly Cortex-vs-Swarm and Aegis-vs-Null).
   Neither was tuned further, per the entry's own order. **Session 15
   completed Phase 3:** a real, generic, data-driven card-pool lint
   (engine/src/cards/poolLint.ts), enforced at load time via
   data/decks.ts's buildDeck, covering all four of the entry's rules
   (removal/debuff <=25%, targeted damage <=cost+1 under 3 mana, no
   permanent enemy-stat aura under 4 mana, clock+card flow per pool).
   Measured against the real pools before touching anything: Cortex
   (32.5% removal density) and Null (50%, plus a cheap aura and zero card
   flow) both violated it; Swarm and Aegis already passed. Fixed Cortex
   with a pure copy-count rebalance; fixed Null with real redesigns
   (Corrupted Process's evolve: damage -> draw, fixing card flow too; Fork
   Bomb's arm: AOE damage -> summon two tokens, truer to the card's own
   name) plus copy trims and Segmentation Fault's cost 3->4. Honest
   re-measurement result: the cross-check flags the same two pairings as
   before (Cortex-vs-Swarm, Aegis-vs-Null) — Null actually got a bit
   *stronger* against Aegis/Swarm, not weaker, plausibly from Corrupted
   Process's new card draw making its deck more consistent. See
   progress/balance-report-009-poollint.txt and progress/current.md.
   **Session 16 did Phase 4: proposed the intended counter triangle**
   (adopted the owner's own 2026-09-20 example: Null beats Aegis, Aegis
   beats Swarm, Swarm beats Null, Cortex flexible; targets 55-60%/45-55%),
   **measured the real pool against it (none of the six pairings pass —
   Cortex too strong vs Swarm/Aegis; Null's cycle edge backwards vs Swarm,
   overshooting vs Aegis), and executed 3 of the 4 steps in the
   pre-authorized "Null dominance" backstop** (already triggered going in —
   Segmentation Fault redesigned to a conditional aura via a new generic
   engine mechanism; Corrupted Process cut a copy; Entropy Harvester's
   scaling moved to the opponent's graveyard). Honest result: real but
   small movement, both Aegis-vs-Null and Cortex-vs-Swarm remain
   triple-flagged. Step 4 (cost increases) and any Cortex/Swarm-side fix
   were flagged to the owner rather than done unilaterally — see
   progress/balance-report-010-phase4-triangle.txt,
   progress/checkpoints.md, and progress/notes-for-owner.md.
   **Session 17 executed the owner's Phase 4 decisions** (which superseded
   the triangle above with an explicit four-faction ring: Null > Aegis >
   Cortex > Swarm > Null): raised Kernel Panic (5->6) and Null Singularity
   (6->7) per the pre-authorized Null step 4, then gave Swarm two new
   go-wide-resilience cards (Colony Broodling: dies with 2+ other units
   surviving -> summons a replacement; Overgrown Carapace: health scales
   live with the controller's own board width) — Cortex was not touched, per
   the entry's explicit instruction. Re-measured the whole ring (300
   seeds/matchup, 3 policies): honest result, no pairing is within band yet,
   but real multi-policy movement in both targeted places — Aegis-vs-Null
   moved down on all three policies for the first time in this project's
   history (still triple-flagged, didn't reach the 55-60% "stop" line);
   Swarm-vs-Null is no longer triple-flagged (the ring's most structurally
   wrong edge, now only single-flagged under Random). Cortex-vs-Swarm,
   untouched by either change, remains triple-flagged with no assigned fix.
   See progress/balance-report-011-phase4-decisions.txt,
   progress/checkpoints.md, and progress/notes-for-owner.md.
   **Session 18 acted on the owner's "Phase 4 session 17 follow-ups" entry**
   (correcting two mislabelled ring edges, fixing Aegis-vs-Cortex with an
   Aegis buff, and pushing Null step 4 past cost to power): re-mapped
   `balanceReport.ts` to the corrected ring as real data (`RING_DECISIVE`/
   `RING_EVEN`), found and fixed a real pre-existing cross-check bug in the
   same pass (it didn't check all three policies agreed on the WINNER, just
   that each cleared 60% independently); bumped Guard Directive Chip 2->3
   copies for Aegis-vs-Cortex after a first attempt (a new Barrier Tool)
   measured worse and was reverted; tightened Kernel Panic's destroy reach
   (maxHealth 5->4) and cut Null Singularity's health 8->7. **Result:
   Aegis-vs-Null and Swarm-vs-Null are no longer triple-flagged** (only
   Cortex-vs-Swarm remains, exactly as the entry said to leave it).
   Aegis-vs-Cortex moved real but not into band (worst under Aggressive,
   likely partly agent-heuristic-driven — see quality-debt.md). Full detail:
   `progress/balance-report-012-ring-followups.txt`,
   `progress/checkpoints.md`, `progress/notes-for-owner.md`.
   **Session 19 started Phase 5 (pool expansion), scoped to one faction:**
   the owner's 2026-09-25 "accept the ring as directionally done; start
   Phase 5" entry authorized growth toward each faction's 30-40-unique-card
   target (item 8) while naming Aegis-vs-Cortex as the pairing to aim new
   Aegis cards at specifically (item 3). Grew Aegis from 18 to 22 unique
   cards (Bulwark Chassis, Reinforced Bastion, Salvage Reflex, Aegis Line
   Trooper — all real, immediate-board-stat cards, funded by data-driven
   trims of the pool's own measured weakest cards). A first stat-line
   attempt measured badly overtuned (made Aegis generically too strong, not
   specifically better vs Cortex) and was caught and corrected by this
   session's own re-measurement before shipping. **Result: Aegis-vs-Cortex
   is no longer triple-flagged** — Random and Lookahead both land in the
   55-60% band, Aggressive is close (47.0%). Cortex-vs-Swarm remains the
   sole triple-flagged pairing, untouched per standing instruction.
   Aegis-vs-Swarm newly drifted out of its "even" band as a named,
   untouched side effect. Full detail:
   `progress/balance-report-013-phase5-slice1.txt`, `progress/checkpoints.md`,
   `progress/notes-for-owner.md`. **Session 20 continued Phase 5 with
   Swarm's own slice**, scoped as a general power-level pass rather than
   one pairing (Swarm was the baseline-worst faction across three of its
   four matchups, not just one — the owner's 2026-09-26 "session 19
   confirmations" entry named Swarm next). Grew Swarm from 16 to 20 unique
   cards (Brood Skitterer, Carapace Grunt, Warren Guardian, Bloodswarm
   Alpha — all real, immediate-board-stat cards), funded by data-driven
   trims of the pool's own weakest cards. Same honest
   overtuned-first-cut-then-corrected journey as session 19: a first cut
   benchmarked directly against Aegis's own above-average-testing cards
   spiked the whole Swarm deck's win rates uniformly; caught and scaled
   back before shipping. **Result: no cross-faction pairing is
   triple-flagged at all** — Cortex-vs-Swarm, the sole standing
   triple-flag going in, is resolved (though it overshot past even into
   mild Swarm-favour rather than landing on target — named honestly, not
   chased, per the owner's standing "don't fix this pairing specifically"
   instruction); Aegis-vs-Swarm is back in band on 2 of 3 policies
   including Lookahead. Swarm-vs-Null remains unresolved in a new shape
   (policy disagreement rather than Null-dominant-on-all-three). Full
   detail: `progress/balance-report-014-phase5-swarm-slice.txt`,
   `progress/checkpoints.md`, `progress/notes-for-owner.md`. **Phase 5
   continues — Cortex and Null still need their own growth pass; the
   owner's hard-gate whole-ring re-measure (item 4 below) is due once
   every faction has had at least one Phase 5 pass, not yet.**
   **Session 21 did Null's slice** as the owner's 2026-09-26 entry asked —
   a depth/variety pass, not a power buff. Null 15 -> 20 unique cards
   (Zombie Process, Dangling Pointer, Bit Rot, Watchdog Timer, Garbage
   Collector), each exercising a trigger/keyword Null never had (onDeath,
   Rush, an Instant combat trick, a Directive turn trigger, an activated
   ability); deck 32 -> 40 with no trims. Also fixed a LookaheadAgent blind
   spot (Directive turn triggers were never valued). Measured roughly
   power-neutral (Lookahead Null mean 40.0% -> 42.1%, every Cortex/Swarm
   move inside one standard error) and a move toward the ring's
   Null>Aegis edge. `progress/balance-report-015-phase5-null-slice.txt`.
   **Session 22 did Cortex's slice**, the last per-faction one. Cortex 19 ->
   24 unique cards (Rate Limiter, Load Balancer, Hotfix, Deadlock Detector,
   Quorum Arbiter: a Directive turn trigger, onAttack, an Instant friendly
   trick, opponent-board conditions, opponent-scaled attack, Cortex's first
   Mythic), aimed at Swarm's width. Cortex-vs-Swarm under Lookahead 44.3 ->
   58.7 (300 seeds; 46.7 -> 54.1 over 900). Aegis-vs-Cortex held in band.
   Null-vs-Cortex moved toward Cortex, and it turned out to be already out
   of band over 900 seeds: Null is below 45% against every faction.
   `progress/balance-report-016-phase5-cortex-slice.txt`; new tool
   `engine/src/dev/lookaheadEdgeCheck.ts` for 900-seed checks.
   **Session 23 did the Null consistency trim** (owner's revised order, step
   i): 40 -> 36 (Decay Ward 2->1, Fork Bomb 3->2, Null Shell 3->1), all 20
   unique cards kept, chosen by a measured greedy search and confirmed on
   held-out seeds. That's about +4 points on each Null edge, and Kernel Panic
   plays ~7.5% -> ~10%. Null is still the weakest faction. Also added CI band
   verdicts (`engine/src/dev/edgeMeasure.ts`).
   `progress/balance-report-017-null-trim.txt`.
   **Remaining before the hard gate: the neutral pool (item 10), then the
   mandatory full-ring re-measure at 900+ seeds (see notes-for-owner.md on
   running its Lookahead side at ~2,500 seeds so the CI rule can confirm
   5-point bands).**
3a. Prior sessions, superseded by the above: session 11.
   Session 10 conditioned Kernel Panic's destroy and adjusted a Null
   number per the owner's 2026-09-17 direction (74.7%/79.0%, still
   double-flagged) and named "Aegis's kit lacks independent interaction"
   as the likely real cause. Session 11 acted on that: three new
   non-removal defensive Aegis cards (intercept/redirect, cost tax,
   damage-blunt — data/aegisCards.ts) plus a general engine fix for the
   "chosen-targeting gap" (Kernel Panic/Deprecated Routine reverted to
   their original chosen-target design). Result, honestly: Aegis-vs-Null
   remains double-flagged (79.3%/83.0%, ~the same as going in) — per the
   owner's own explicit instruction, left flagged rather than adding
   removal or guessing further. Swarm-vs-Aegis IS newly resolved (was
   double-flagged, now isn't). Cortex-vs-Aegis got mildly worse (now
   double-flagged, was Aggressive-only). Full journey, including a first
   attempt that measured clearly worse and was not shipped, and the
   structural finding that dummy-agent balance measurement may
   undervalue reactive/situational cards: progress/balance-report-004-aegis-defense.txt
   and progress/owner-feedback.md's 2026-09-19 entry. Still open, none
   touched this session: the single-flagged Cortex-vs-Swarm pairing, and
   Null's remaining edge over Cortex/Swarm under Random play. Next session
   picking this back up should read balance-report-004's full writeup
   first, and progress/notes-for-owner.md for the open question to the
   owner before spending more effort on Aegis-vs-Null specifically.
4. Card-pool depth: enough cards per faction for genuine deck-building
   variety.

### Make it a living system (Stage 4+)
5. [OWNER CHECK-IN] Economy: the currency (win pays most, loss pays a little,
   cancel/abandon pays nothing), booster packs, per-agent collections,
   deck-building from owned cards. Big and design-heavy — checkpoint before
   finalizing payout/pack specifics.
6. Match-server hardening: persistence, reconnection, running many matches,
   results recorded. (Unblocks once there's an economy that needs it.)
7. [OWNER CHECK-IN] The 1-of-1 signature leader cards + the rarity ladder —
   headline features. Balance-fair-but-visually-unique leaders; rarity scales
   spectacle/scarcity, not power. Checkpoint on the effect pool, activation,
   and rarity tiers/pull-rates.

### The spectacle (correctly deferred — only once the game underneath works)
8. Spectator render (watchable match view), then AI commentators, then the
   public web platform, then monthly set cadence. [OWNER CHECK-IN] on the art
   pipeline when the render stage arrives (real generated art is a late,
   owner-funded pass per DESIGN.md).

## Keeping this current
When an item is genuinely done (built, tested, evidenced), mark it done here
and move to the next. If the owner leaves new feedback in owner-feedback.md,
that takes priority over the roadmap for that session.
