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
   **Session 24 did the neutral pool** (step ii): 10 neutral utility cards
   (`engine/src/data/neutralCards.ts`), a load-time "utility, not identity"
   lint, and hybrid decks (one faction + at most 10 neutral copies).
   Packages were chosen by a measured search and kept only on held-out
   improvement. Cortex and Null run one, Swarm and Aegis don't. Also a
   LookaheadAgent fix: heals and energy are valued only as far as the
   resolver delivers them. Cortex had been burning energy on no-op
   repairs. Ring after: only Aegis-over-Null is OUT at 900 seeds (52.2%
   Aegis, was 60.4%). `progress/balance-report-018-neutral-pool.txt`.
   **Session 25 did the owner's 2026-10-01 follow-ups:** card advantage
   cleared as an agent issue, Commodity Rack 3/3 -> 3/2, the Null
   card-vs-agent check (Bit Rot was misplayed, Watchdog Timer is weak), two
   LookaheadAgent fixes (this-turn buffs, Tool hosts), and a package
   re-search (Null back to its bare 36, Aegis +1 Uplink Tower). Null is now
   the clear weakest faction (three OUT edges). It's flagged to the owner.
   `progress/balance-report-019-agent-check.txt`.
   **Session 26 ran the hard gate** (900 seeds even bands, 2,500 win/lose,
   Lookahead arbiter, interval verdicts) after the owner's Watchdog Timer
   buff. **It did not pass:** 2 IN, 1 UNRESOLVED, 3 OUT (Null > Aegis,
   Null ~ Cortex, Aegis > Cortex). Quorum Arbiter drop measured (no longer a
   real lever, not applied); a Null lift menu measured (Propagating Exploit
   2/3 recommended, not applied). Checkpoint written.
   `progress/balance-report-020-phase5-gate.txt`.
   **Session 27 closed Phase 5** (owner-feedback 2026-10-04, section A):
   Quorum Arbiter kept; Propagating Exploit 2/2 -> 2/3 applied and
   re-measured (Null ~ Cortex OUT -> IN at 49.2, Swarm > Null 56.2
   UNRESOLVED, Null > Aegis 48.2 still OUT); Null > Aegis and Aegis > Cortex
   accepted as OUT. Final gate = the Phase 5 baseline: 3 IN, 1 UNRESOLVED,
   2 OUT (both accepted). `progress/balance-report-021-phase5-close.txt`.
   **PHASE 5 DONE (2026-10-04). Pool growth toward 30-40 per faction is
   paused until sets/packs exist.** Balance is now a regression check, not
   a lane: `engine/src/dev/ringRegression.ts` runs in CI on every change
   against `engine/src/dev/ringBaseline.json`; any new card or set must
   pass it before entering packs. No more open-ended tuning sessions.
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
4. PAUSED (owner 2026-10-04). Card-pool depth: enough cards per faction
   for genuine deck-building variety. Resumes as new sets/packs, each
   passing the ring regression check before it enters packs.

### Make it a living system (Stage 4+)
Order and decisions per owner-feedback 2026-10-04 (sections B-E): persistence
BEFORE the economy; the economy builds to section C's decisions; the
[OWNER CHECK-IN] items there (finish list + pull rates, the unique-Mythic
effect menu + budgets, quest list + numbers, starter shape) pause for the
owner; everything else is built. Target: a playable, watchable Season 0.

DONE (session 27): event-log instance ids (owner 2026-10-03, render
dependency). Every event naming a board card carries its instance id /
TargetRef / stack id; `engine/test/eventIds.test.ts` enforces it.

6. DONE (session 28). Persistence: `economy/` (`@ai-tcg/economy`), one
   local SQLite file per season (`node:sqlite`), holding agents, an
   append-only credits ledger, per-copy ownership, packs, decks pointing at
   copies, and match history. The integrity rules are in the schema. Match
   payouts follow the owner's daily win schedule. The spec is ECONOMY.md.
   Evidence: `progress/economy-demo-001.txt`, `economy/test/` (18 tests).
**The owner's 2026-10-05 build order supersedes the numbering below for
what comes next** (owner-feedback "build order for today's decisions"; don't
start a step until the one before works and its tests pass):
  1. DONE (session 29). Move the economy to the owner: schema v2 keys copies,
     credits, pack points, packs, decks and stats on `owner_id` (agents kept
     as "played by"); every copy records its origin; crafted and starter
     copies are account-bound; caps per owner; starter once per owner; no
     self-play; salvage of extra pack copies only. ECONOMY.md updated.
     Evidence: `progress/economy-demo-002.txt`, `economy/test/` (28 tests,
     incl. the v1 -> v2 migration and the exploit checks).
  2. IN PROGRESS. Owner accounts and agents. DONE (session 30): Season 0
     sign-in (scrypt, sessions, lockout, admin flag); one connected agent at
     a time; switching agents (not during a live match: `startMatch` /
     `recordMatch` bracket a live match); the faction lock; the admin view's
     house-owner data. Also session 30, from owner-feedback 2026-10-07:
     manual salvage only, decks count cards and share copies, promo and
     prize copies bound (unbound again session 31, owner 2026-10-10:
     migration 4). Evidence: `progress/economy-demo-003.txt`,
     `economy/test/` (43 tests). DONE (session 31): the engine's signature
     zone, used by all three agents; the ring measured with set Mythics as
     signature cards (balance report 022) but NOT made the gate: it moved
     4 edges 10-24 points, raised as an [OWNER CHECK-IN] in
     notes-for-owner.md (options A/B/C); owner picked A. DONE (session 32):
     the Neutral menu as card data (303 combinations) and the fairness
     test against the plain-3/6 reference; only Recycle and Tax pass, and
     stat tuning alone passes nothing else (balance report 023), raised as
     an [OWNER CHECK-IN]; owner picked A. DONE (session 33): the tuner's
     size and cost-tier levers (attack 2 or more), Guard over Bulwark, the
     signature card unsellable (migration 5); 6 of 16 options pass
     (balance report 024); Guardian and Bulwark rework proposals measured,
     raised as an [OWNER CHECK-IN]; owner picked A. DONE (session 34):
     Barrier-only Guardian and units-only Bulwark; the finer tuner pass
     (every cost-5 body and size of 5 options; Energy surge passes, Sweep
     and Guardian miss by <0.1, Bulwark fails; balance report 025);
     generating a new agent (3 agents, then 3 signature cards from the 16
     approved lines, then confirm; schema v6, the bound promo PR-NNN, the
     card in the connected agent's signature zone; economy-demo-004). Step
     2 is built. Raised as an [OWNER CHECK-IN]; owner answered 2026-10-15
     (grow the pool, combinations may repeat, themed names, play styles).
     DONE (session 35): the 10,000-game reference and re-measure (the
     largest measurement decides: 14 lines over 7 options, Guardian in,
     Energy surge out; balance report 026); 5 new sizes measured (none
     pass); combinations may repeat (schema v7); themed templated card
     names with the rare username variant. Raised as an [OWNER CHECK-IN]:
     username odds, the art pool plan, and the proposed order below.
  2b. ACCEPTED (owner 2026-10-16). DONE (session 36): item 5's pack contents
     and opening (set S0, the odds table, pity, Prototypes, NEW and "x N
     owned", 1- or 10-pack opening, pack points, crafting; schema v8, also
     the signature art-pool slot; pack-sim-001, economy-demo-006). NEXT: the
     deck-building agent (best faction and deck from the
     owner's holdings, or the owner's forced deck/faction); then ~6 play
     styles with a fairness ring (owner-picked preset, applies from the
     next match). Then step 3, exposing both settings.
  2c. DONE (session 37, owner 2026-10-16): owners name their agents (free
     at creation, 100 pack points to rename (proposal), the rules in the
     store, the name log with "formerly", reserved old names, an admin
     force-rename; schema v9) and more agent-name room (three-part names,
     ~648 million). Evidence: economy-demo-007, signature-names-sample-003.
  2d. ORDER ACCEPTED (owner 2026-10-17, option A), before 2b's deck
     builder: (i) DONE: the chase-card proposal, measured (session 38), and
     LIVE (session 39, owner yes 2026-10-18): schema v10, `openPack` on
     `S0-odds-2`, one roller for both tables pinned by a seed test, secret
     crafting at 750 / 3,000, the binder; evidence economy-demo-009,
     pack-sim-002; (ii) DONE (session 40): the generic
     "choose one" engine mechanic; (iii) the 3 Zero-Day top-tier cards
     (2 modes, the fairness test with a cap above the band, 1 per deck,
     ranked and tournaments allowed): built (session 40), the agent fixed
     and the cards tuned to the owner's cap (session 41, balance-report-028);
     LIVE (session 42, owner OK 2026-10-18): in the card registry, a pulled
     copy plays, Zero-Day crafting open at 3,000; evidence economy-demo-010.
     NEXT: 2b (the deck-building agent); then modal cards in every faction
     with the next set work. Side item: the Aegis vs Cortex check-in
     (balance-report-029).
  3. Server endpoints for the website (wallet, collection, packs and pack
     opening, live/featured matches, ladder, tournament, stats,
     notifications, saved board layout). Needs item 5's pack contents and
     opening first.
  4-6. Website basics; the widget board and look; live play features
     (render lane builds the visuals; see owner-feedback 2026-10-05).

5. MOSTLY DONE (session 36). Economy build, to ECONOMY.md (the finish list, pull rates and starter
   shape were answered 2026-10-04): sets with collector numbers, a set
   symbol and Gold secrets; pack contents and opening (5 cards + the shine
   slot, pity timers per owner, pack points, the Prototype bonus 6th card,
   tested by simulation; results show NEW and "×N owned", never salvage
   anything: salvage is manual, built session 30);
   promo issuing (PR-001 numbering, stamps); 10-pack bulk opening.
   Still open: general promo issuing (milestones, quests), retiring unpulled
   Prototype runs at season end, the published-odds page, an owner interface.
   DONE already: ownership-gated decks (session 28), starter collections and
   salvage (session 29).
7. Unique Mythic (signature card), owner-decided 2026-10-05 (Neutral, 3
   generated candidates, 3 cost tiers, 16-option menu, the signature zone,
   ring re-baseline). Built with build-order step 2. Plus daily
   rewards/quests (list and numbers in ECONOMY.md).
6b. Match running and the ladder: many matches, server-assigned opponents,
   results recorded, Glicko-2 ratings per owner. Closes the loop:
   play -> earn -> owner opens packs -> agent rebuilds -> play.

**Standing: storage launch-readiness (owner 2026-10-05).** (1) All database
access stays inside `economy/src/store.ts`; no other workspace imports
`node:sqlite` or writes SQL. (2) DONE session 29: `engines.node >= 22.13`
pinned in the root package.json; ECONOMY.md notes `node:sqlite` is a
release candidate. (3) HARD GATE before the public Season 1 launch: replace
or back the single SQLite file with storage that handles many players at
once (self-hosted, e.g. Postgres, or SQLite proven by a load test at launch
scale), proven by that load test. Tracked in quality-debt.md until passed.

**Standing: live operations, balancing never stops (owner 2026-10-05).**
Once live: track faction popularity and win rates from real ladder and
tournament matches; run the ring regression check against live data each
season; ship balance changes on a regular cadence as errata on every owned
copy (no automatic refunds); re-test unique Mythics and new sets before
they go live.

Later, not now (data model must allow): 3D pack opening, shader finishes,
a collector viewer, trading/real money. Season 0 in-house; Season 1 fresh
at public launch (collections/currency/ranks reset, Season 0 archived).

### The spectacle (correctly deferred — only once the game underneath works)
8. Spectator render (watchable match view), then AI commentators, then the
   public web platform, then monthly set cadence. [OWNER CHECK-IN] on the art
   pipeline when the render stage arrives (real generated art is a late,
   owner-funded pass per DESIGN.md). Art model DECIDED (owner 2026-10-18):
   Google Imagen 4 Ultra (Replicate `google/imagen-4-ultra`, 3:4), with the
   starting prompt template and composition rules in that owner-feedback
   entry, tuned on 10-15 cards first; one flat image per card. Still open:
   when the pass starts, its budget, any cheaper model for some cards, and
   checking the model's terms allow commercial use. No production art is
   generated without the owner's OK.

## Keeping this current
When an item is genuinely done (built, tested, evidenced), mark it done here
and move to the next. If the owner leaves new feedback in owner-feedback.md,
that takes priority over the roadmap for that session.
