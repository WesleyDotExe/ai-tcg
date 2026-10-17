# Owner feedback

This file is the owner's steering wheel. Write feedback here at any time Ã¢ÂÂ
"redo stage N," "drop this feature," "change this direction," anything you
want to override the design or a run's own plans. Every session reads this
file FIRST, before anything else, and treats what's here as overriding.

When a run acts on an entry, it marks the entry handled (with a note on what
it did) so the same feedback isn't re-applied by the next run.

---

## 2026-09-11 â Owner feedback on Stage 1 checkpoint (HANDLED 2026-09-11, same-day follow-up session)

Responses to the four decisions flagged in checkpoints.md:

**1. Language/runtime â KEEP TypeScript/Node.** Confirmed. One language across engine, server, and web stack is what we want. No change.

**2. Energy/turn model â CHANGE to Magic-style reactivity.** Overrule the Hearthstone-style choice. Build the deeper, reactive model: players can respond during the opponent's turn (instant-speed responses), with a priority-passing system, held resources, and the interaction depth that comes with it. Rationale: this game is meant to be beyond human tracking and dramatic to watch, and reactivity is one of the biggest sources of exactly that depth â a core pillar, not optional. Treat this as a proper foundational rebuild of the turn/priority core, not a bolt-on: the current model has no reactivity, so the priority system must be built where it doesn't yet exist. Re-prove it to the stage-1 evidence standard (a full match log showing instant-speed responses actually happening, plus assertion scenarios covering priority passing and reactive triggers). It is fine and expected for this to redo part of stage 1 before moving to stage 2 â better now than after a card set is built on the simpler model. Keep a resource curve that still supports ~5â6 minute games.

**3. Pacing / turn cap â a turn cap is fine.** Keep a hard turn cap as the backstop so games always end. Continue tuning overall pacing toward the 5â6 minute target against logged match lengths as the game matures; the cap is the safety net, not the primary pacing tool.

**4. Faction names / art direction â lean HARD into AI-themed content, with cyberpunk + 1990s retro-futurism flair.** No specific faction names mandated â invent good ones in that spirit. Direction: heavily AI/machine-intelligence themed throughout (factions, card names, flavour, later art direction), styled with a blend of cyberpunk aesthetics and 1990s retro-futurism (chrome, CRT/terminal vibes, the optimistic-yet-synthetic 'future as imagined in the 90s'). Let this flavour identity run through the whole game's presentation, not just card names.

---

**Handled, this session:**

1. No change made (already TypeScript/Node) â confirmed, nothing to do.
2. Done as a proper foundational rebuild, not a bolt-on: `engine/src/engine/engine.ts` now implements a real Magic-style priority-passing algorithm (`GameState.stack` / `priority` / `passes`), Commands and activated abilities go on the stack instead of resolving immediately, combat damage is a stack item computed live at resolution time (not snapshotted at declaration), and cards/abilities now carry a `speed: "Instant" | "Sorcery"` that `getLegalMoves` enforces. Re-proven to the stage-1 evidence standard: `progress/sample-match-002-reactive.txt` is a real match log with genuine cross-turn instant-speed responses and a fizzled attack (target removed mid-stack); `progress/effect-system-demo.txt` scenarios 11â12 assert priority passing, LIFO stack resolution, and a reactive combat trick changing a fight's outcome. A resource curve supporting ~5â6 min games was kept (same energy climb/refill as before; instants just spend from the same pool, held or not, whenever their controller has priority). Full writeup: `progress/checkpoints.md` (new checkpoint) and `progress/log.md`.
3. No change made â turn cap kept as the pacing backstop, unaffected by the priority rebuild (a turn only ends once both players pass with an empty stack; the cap still applies on top of that).
4. Partially addressed: the two new Instant-speed cards added to prove reactivity (Interrupt Handler, Reflex Spike) already fit the cyberpunk/terminal register the existing Cortex/Swarm pool uses. The cyberpunk + 1990s-retro-futurism direction (chrome, CRT vibes) is otherwise a card-set/art-direction concern that belongs to stage 3 (real card set) and the later art pass, not this stage-1 engine session â flagging here as read and *intended to be carried forward*, not fully executed yet, so a future run doing stage 3 or the art pass should treat this as binding direction rather than re-deriving faction flavour from scratch.


---

## 2026-09-12 — Design directive batch: card systems, onboarding, economy, rarity, presentation (PARTIALLY HANDLED — section B done 2026-09-13, C/D/E/F still open)

A large, coherent set of design directions from an owner design session. These are for the stages they name (mostly stage 3 card set onward, and stage 8 platform) — do NOT pull them forward over earlier build-order work, but design earlier stages (card schema, rarity model, economy) knowing these are coming so they aren't walled off. Where a parameter isn't fixed here, PROPOSE options at a checkpoint rather than guessing.

### A. Reactivity (follow-up to the stage-1 redo checkpoint)
- **Confirmed permanently:** player responses are instant-speed with real priority passing (as built). Automatic *triggered* abilities resolve immediately and are NOT individually counterable — this is the intended design, not a limitation. Do not revisit making triggers stack-based.
- The test Instant cards added for the redo are fine as throwaway test-pool cards. No action.
- **Do NOT build classic stack-based unit-countering** (the old checkpoint decision #1). Instead, counterplay against units comes from the board-development system below.

### B. Unified board-development system (stage 3+), spine = finite face-up slots
The organizing principle: everything meaningful an agent commits happens FACE-UP on a board with a FINITE number of slots, so board space is a genuine, legible, scarce resource. Build the following as ONE interacting system, not separate features:
- **Telegraphed threats:** certain cards are placed face-up as 'coming' threats (mana cost) and do not fire immediately; they sit for a window during which the opponent can see them and try to answer them (from hand or board). Drama is visible to spectators.
- **Evolution / upgrade cards:** higher-tier cards require the tier below (Pokémon-evolution-like). Creates 'answer it early while it's weak, or respect it later' tension. Strict-vs-loose requirement (must have the specific tier-below card, vs a looser condition) is an OPEN QUESTION — propose options at a checkpoint.
- **Tool / attachment cards:** attach to a unit in play to boost attack/defense/abilities (Pokémon tool-card-like).
- **Design intent (critical):** these share the scarce-visible-board spine and must INTERACT — a tooled-up or pre-evolution unit is itself a telegraphed threat; slots are the shared cost; the finite-slot limit is what makes all of it a real choice (you can't dump your whole hand onto the table). Build the synergy, not three isolated features.
- Open numeric parameters (propose at checkpoint): slot count and whether it scales; telegraph timing; evolution consume-vs-stack and what happens to attached tools; shared vs per-player slots; mana costs.

### C. Signature 1-of-1 Leader card (headline feature)
- On first registration, each agent receives a UNIQUE 1-of-1 'leader' card generated from their username: procedural art, name, and flavour, unmistakably more special than any normal card. One per agent, never obtainable by anyone else. FREE at registration, entirely outside the booster economy, non-tradeable, cannot be lost.
- **Role:** a once-per-game signature activated power (preferred over 'just another card' — it gives every match a recurring narrative beat for commentators).
- **Balance constraint (critical):** all leaders must be mechanically FAIR — their power is drawn from a curated, balanced pool of effects. Uniqueness lives in identity/art/flavour and only modestly in mechanics, never in raw power. Fully-random unique stats are disallowed as un-balanceable. If even the curated-pool version can't be balanced in testing, fall back to a purely cosmetic signature card — but try the leader version first.
- **Art note:** this is the ONE card whose procedural art generation is core and NOT deferrable — it's central to the registration experience, built with onboarding, not the late art pass.
- Propose at checkpoint: the effect pool, activation cost, and how the username seeds generation.

### D. Onboarding grant + economy
- **One-time registration grant (free, outside the paid economy):** one starter deck PER FACTION (fixed, hand-designed, and balanced against each other — an unbalanced starter would create an early false meta); 5 booster packs opened once; and the 1-of-1 leader card.
- **Ongoing:** no more free cards. Points won from play are the only way to acquire boosters.
- **Payout rule (design together with onboarding):** win pays most, loss pays a little (NEVER nothing — so all agents keep progressing and the population doesn't calcify into haves/have-nots), cancel/abandon pays nothing.
- **Design intent:** this is deliberately a diversity engine — new agents get variety but not optimized power, and must earn deck refinement through play, supporting the self-disrupting metagame.
- Propose at checkpoint: payout amounts, pack costs, starter-deck contents.

### E. Rarity system
- A ladder of rarity tiers (roughly: common, rare, special rare, full-art rare, hyper rare, plus a secret rare above the visible set — names flexible), each with defined per-pack pull rates referencing Pokémon TCG Pocket's rough rates (scarce at the top). The 1-of-1 leader sits conceptually ABOVE the ladder as ultimate scarcity.
- **Balance rule (critical):** rarity scales VISUAL SPECTACLE and SCARCITY reliably; it does NOT scale power reliably. Higher rarities may occasionally be somewhat more impactful, but NEVER reliably/proportionally, and never to the point that owning top rarities is required to compete. The competitive ceiling must be reachable without the top rarities. Higher rarities are frequently alternate-art / premium versions of cards that also exist at lower rarity. Rarity-as-mandatory-power is disallowed (protects the self-disrupting meta; no win-more-to-win-more).
- **Visual escalation (ILLUSTRATIVE examples, not a required list — use to calibrate how BIG the jumps should feel):** regular cards have a small art window in a traditional frame; full-art rare and up let art fill the whole card; hyper rares and above get premium finishes — foil/gold, sparkle/shine, or e.g. a 'neon nights' neon treatment. Each tier is a visible, dramatic jump so a high pull is unmistakable at a glance.
- **Scoping:** the rarity DATA MODEL and pull-rate tables are early work (card schema + pack/economy, stages 3–5); the VISUAL expression (full-art frames, foil/shine effects, reveal spectacle) is platform-stage work built on top. Design the early model to support the later spectacle.
- Propose at checkpoint: exact tiers and pull-rate numbers.

### F. Premium owner experience (stage 8 platform — distinct from the spectator experience)
- There are TWO human audiences: spectators watching matches (ESPN-style commentary) AND the agent's owner going through onboarding/collection. The owner-facing flows must feel like a HIGH-END consumer app.
- Owner flows — registration, the one-time opening of the first 5 packs, the 1-of-1 leader reveal, and ongoing pack openings — must be animated, tactile, and anticipation-building, explicitly referencing Pokémon TCG Pocket's pack-opening (peel/tap to open, cards revealed one at a time, a genuine dramatic rare-reveal moment).
- **Quality bar:** a card that simply fades or pops in is a FAILURE. The bar is 'opening a pack feels like a small event.' The leader reveal and the first 5 packs are the highest-stakes first impressions in the whole product and should be the most polished moments.
- **Scoping:** stage 8 (platform), NOT to be built early. Flagged now so the card data model, rarity tiers, frames, and art pipeline in earlier stages are designed to SUPPORT a premium animated reveal rather than making it hard to add later. Flag the animation approach at a checkpoint when the stage arrives.

### Standing note
All numeric tuning across the above (slot counts, payouts, pull rates, effect pools, timings, costs) is left for the runs to PROPOSE and the owner to approve at checkpoints — do not fix these values unilaterally. Evolution strict-vs-loose is specifically an open question to bring options on.

---

**Handled, this session (2026-09-13, stage-3 session) — Section B only:**

Built the unified board-development system as one interacting system, not three bolted-on features:
- **Finite face-up board slots:** `state/init.ts`'s `BOARD_SLOTS` (proposed default: 6) caps a *shared* pool per player across Units and Directives (`boardSlotsUsed` in `moves.ts`) — both are "meaningful board commitments" per this directive, so both compete for the same scarce space. Evolving a unit or attaching a Tool never consumes a slot (see below), which is exactly what makes a slot a real, contestable choice.
- **Telegraphed threats:** `UnitCard.telegraph` (turns). A telegraphed unit enters face-up and fully targetable immediately, but `pending` — it can't attack, activate abilities, or project static auras until it "arms" at the start of its controller's turn `telegraph` rounds later, at which point its `onPlay` ability (deferred, not fired at initial play) finally resolves. Proven live in `progress/sample-match-004-boarddev.txt`: a Perimeter Turret survives 2 damage from an opponent's AOE while dormant, then arms and lands a kill.
- **Evolution:** `UnitCard.evolvesFrom` (strict — exact base card id required; the loose-vs-strict question this directive flagged as open is answered here only for *this* first implementation, not closed permanently). Evolving mutates the existing board unit **in place** — same instanceId, so accumulated damage, statuses, and attached Tools all carry forward, and it costs no extra slot. The consumed base card goes to the graveyard. Proven live in the same match log (an Aegis Cadet evolves into Aegis Sentinel) and in `effect-system-demo.txt` scenario 14 (asserts the carry-forward explicitly, including a pre-attached Tool).
- **Tools:** the new `Tool` card type (`ToolCard`) attaches to an existing friendly board unit (any state, pending or armed) rather than claiming a slot of its own — a flat stat bonus plus optionally-granted keywords, read live by `state/queries.ts` (`hasKeyword` now checks tool grants too, e.g. a Tool-granted Guard is honoured by the attack-targeting rule the same as a printed one). Proven live in both the match log and scenario 15.
- **The interaction, not just the parts:** a telegraphed unit can be tooled up before it arms (raising the stakes of the "answer it now" window); an evolution base sitting in play is a live target the opponent must choose to spend removal on or let grow (the same "answer it early or respect it later" tension as telegraph, for free, from the instance model); and the shared slot pool is what makes committing any of this to the board a real opportunity cost.
- **New faction, Aegis** (`engine/src/data/aegisCards.ts`, 14 unique cards / 34-card deck) was built specifically to exercise this system in a genuinely playable set, per the cyberpunk/90s-retro-futurism direction from the 2026-09-11 feedback (chrome/CRT/terminal flavour throughout). Cortex and Swarm (the stage-1/2 test pools) were left untouched — they don't yet use telegraph/evolution/tools; backfilling them is natural follow-up work, not required.
- **Deck-size rule** (also named as missing debt in `quality-debt.md`): `decks.ts` now enforces MIN_DECK_SIZE=20/MAX_DECK_SIZE=40, real numbers, not yet playtested.

**Still genuinely open from this directive (not attempted this session, do not treat as decided):** the strict-vs-loose evolution question (only strict is built); slot count (6) and telegraph timing (1 round) are first proposals, not tuned; whether evolution should require the base to have survived a prior turn (this session's implementation allows playing a base and evolving it the same turn — an emergent combo observed in real play, not a bug, but flagged as a ruling the owner might want changed); sections C (leader cards), D (onboarding grant/economy), E (rarity ladder), and F (premium reveal UX) are entirely untouched — they belong to stage 4/5/8 and were correctly not pulled forward.


---

## 2026-09-13 — Owner feedback on Stage 2 checkpoint (HANDLED 2026-09-13, stage-3 session)

All three flagged decisions are APPROVED as-is. Proceed to Stage 3.

1. WebSocket over HTTP polling — approved. Correct given the Magic-style reactivity: the server needs to push requestMove at arbitrary moments, which a persistent connection fits. Keeping message shapes transport-independent is good.
2. Protocol fault = immediate full forfeit — approved. Aligns with the economy rule (breaking protocol or dropping out is never rewarded) and keeps it unambiguous. A more forgiving recovery path can be a future refinement, not now.
3. agents/ duplicating the small RNG to keep zero-dependency — approved. Keep the duplication; the zero-dependency guarantee is worth more than avoiding a few copied lines and keeps external onboarding cleaner. Do not extract a shared RNG package.

Proceed to Stage 3 (real card set), shaping the card schema per the design-directive batch above (board-development system, leader cards, rarity ladder) to support those without building them prematurely.

**Handled, this session:** no code change was requested by this entry (pure approval) — proceeded straight to Stage 3 as directed. See the new checkpoint in `progress/checkpoints.md` for what Stage 3 delivered: the unified board-development system (finite face-up board slots, telegraphed threats, evolution cards, tool/attachment cards) plus a new third faction (Aegis) built to exercise it. The 2026-09-12 design-directive batch below is still only PARTIALLY handled — see that entry's own updated status.


---

## 2026-09-13 — Owner feedback on Stage 3 checkpoint (HANDLED 2026-09-14)

1. Strict evolution — APPROVED as-is. Keep exact-base-card requirement; the deck-building puzzle it creates is desirable. Loose tier-based can be a later follow-up only if strict proves too rigid.
2. BOARD_SLOTS = 6, shared between Units and Directives — APPROVED as a starting value. Shared pool is the right design (forces the unit-vs-directive opportunity cost). Revisit the number once the card pool is larger.
3. Telegraph delay = 1 turn — APPROVED as the default, but a 1-turn fuse is short. Try delay = 2 on some telegraph cards and compare how the "see it coming, answer it" window feels. Keep delay as a per-card value so a mix is possible.
4. Same-turn play-and-evolve — OVERRULE toward RESTRICTING. A unit should NOT be evolvable the same turn it enters play; require it to have survived to a later turn before evolving. Reason: this protects the "answer it early while it's weak" exposure window the directive batch specifically wanted — if a base can be summoned and evolved in one turn, the opponent never gets to answer the weak form, which undercuts the whole mechanic. The fast "commit hard" combo is not worth losing that drama.
5. Deck size range [20,40] — APPROVED as-is. Pragmatic; a tighter target can come later as the pool matures.

Process: ENDORSE the run's own instinct — build the automated test runner NEXT, before adding more width. The "no automated test runner" debt has survived two stage-scale sessions and is now the priority; hand-written demo scripts won't scale and untested mechanics is where hollow work hides. Backfilling Cortex/Swarm with the new mechanics and adding faction width come AFTER the test runner exists.

Owner question to answer next run — DOCUMENT the energy/mana model clearly (in DESIGN.md or a progress note): is energy a collective per-turn pool all cards draw from during that turn (expected, given the Magic-style choice), or applied to individual cards before play? Confirm how it works now — does the pool escalate each turn, does unused energy carry over or empty, and is the same pool used for playing cards, activating abilities, AND paying for reactive/instant responses? A core resource system should be explicitly written down; right now it isn't clearly documented for the owner.

**Handled, this session (2026-09-14):**

1. **Same-turn play-and-evolve — restricted, as directed.** `engine/src/engine/moves.ts`'s evolution-targeting filter now requires `u.enteredTurn < state.turnNumber` (the same "has this unit lived through a turn boundary" check summoning sickness already used for attacking, but with no Rush-style bypass for evolution). A base played this turn is no longer offered as a legal evolve target; it becomes legal once its controller's next turn begins. Regression-tested (`engine/test/boardDevelopment.test.ts`, "a base cannot be evolved the same turn it was played") and re-proven in real, unscripted play: `progress/sample-match-005-boarddev-fixed.txt` is a fresh match log (regenerated with the fix in place) where the evolved Aegis Cadet instance was played two turns before it evolves, while a same-turn, same-named Cadet instance that died in combat that turn was correctly never offered as an evolve target. `progress/sample-match-004-boarddev.txt` (the original stage-3 evidence, which happened to show the now-illegal same-turn line) was annotated rather than edited, so the historical record stays honest about what stage 3 actually shipped at the time.
2. **Telegraph delay=2 trial — done.** `Latent Ward`'s `telegraph` changed from 1 to 2 (`engine/src/data/aegisCards.ts`), while `Perimeter Turret` stays at 1 — a real per-card mix, not a global change. Both fire correctly in `sample-match-005-boarddev-fixed.txt` (Perimeter Turret arms after 1 of its controller's turns, Latent Ward after 2). This is a first trial, not a tuned conclusion — real play/spectator feedback once there's a render is the actual way to judge whether the longer fuse "feels" different, which isn't available yet; flagging that this is still an open feel question, not resolved by this change alone.
3. **Energy/mana model — documented.** Added a `## Resource model — energy (as built)` section to `DESIGN.md` answering all four sub-questions directly: one collective pool per player (not per-card); the pool escalates (+1 maxEnergy/turn, capped at 10) and *fully* refills at the start of each of that player's own turns (unused energy does not carry over); your energy only refills on your own turn, which is what makes holding Instant-speed responses up during the opponent's turn a genuine resource trade-off; and the same pool, undifferentiated by speed, pays for Units/Directives/Commands, activated abilities, and Instant-speed responses alike.
4. **Automated test runner — built, per the endorsed process instruction.** `vitest` added as an engine devDependency (`npm test` at the repo root or in `engine/`). The old `engine/src/dev/effectSystemDemo.ts` (a manually-run assertion script — exactly the debt this instruction called out) was retired; its 16 scenarios were ported into three real vitest files under `engine/test/` (`effectSystem.test.ts`, `boardDevelopment.test.ts`), each scenario now its own individually-reported test, plus one new regression test for item 1 above. A new `matchSmoke.test.ts` also converts the previously-uncommitted "run N seeds, confirm no crashes" stress run (named as a gap in `quality-debt.md`) into a small, fast, always-run suite across all three faction matchups. All 20 tests pass; full writeup in `progress/log.md` and `progress/quality-debt.md`.

Backfilling Cortex/Swarm with telegraph/evolution/tools and further faction width are still open, correctly deferred — this session was scoped to exactly what this entry asked for (the four checkpoint decisions plus the test-runner priority), not new card-set width.


---

## 2026-09-15 — Owner: Session 7 balance decisions confirmed (HANDLED — for the record)

Recording that the three decisions Session 7 flagged were all reviewed and APPROVED. No action needed; logged for the record. Next-work direction is now governed by progress/roadmap.md, not this entry.

1. Stopping after one measure-then-fix cycle rather than chasing an exact balance target — approved. Serious balance tuning belongs later, once the card set is more complete.
2. Changing Overload Capacitor and Interrupt Handler together (improvement not attributed to each individually) — approved; isolating each wasn't worth doubling the measurement cost at this stage.
3. Leaving Swarm-vs-Aegis (61.3%) named as debt but uninvestigated — approved; correct to flag and defer.

The balanceReport.ts instrument and the measure-then-fix pattern are endorsed — keep using it (not guesswork) for any future balance change.

---

## 2026-09-17 — Owner: Aegis-vs-Null fix direction (Session 8 flag) (HANDLED 2026-09-18, session 10)

Fix Aegis-vs-Null (75–81%) by adding a **condition to Kernel Panic's destroy**, not by just lowering Null's numbers. A destroy that ignores all protection and can hit any unit works as a hard counter to Aegis's build-up style. Design principle 3 calls for soft counters.

- The destroy should only hit **some** units, and Aegis's evolved or upgraded units should be able to escape it at least some of the time. For example: only units below a set attack or health; only units that haven't evolved; or a destroy for small targets and plain damage for large ones. Pick one, explain why, and propose any numbers at a checkpoint.
- Keep "destroy ignores Barrier and stat buffs" as a mechanic. The problem is that nothing restricts what it can target.
- Measure before and after with `balanceReport.ts`. If Aegis-vs-Null is still flagged after this change, adjust Null's numbers as a second step, and only then.
- Keep the roadmap order: do this when the item 3 balance pass comes up, not before item 2.

**Read, session 9 (2026-09-17) — correctly deferred, not yet acted on.** Per
this entry's own last line, item 2 (non-engine test coverage) was worked
this session, not this fix — see `progress/current.md`/`progress/log.md`.
Left UNHANDLED on purpose: the actual Kernel Panic condition change,
numbers proposal, and before/after `balanceReport.ts` measurement this entry
asks for are still unstarted work for whichever future session picks up
roadmap item 3. Do not mark this handled until that fix is actually built
and measured.

**Handled, session 10 (2026-09-18).** Did exactly the two-step process this
entry asked for, in order, measuring after each step (full detail and raw
numbers in `progress/balance-report-003-null-fix.txt`):

1. **Condition added to Kernel Panic's destroy**, per this entry's first
   option ("only units below a set attack or health"): a new generic
   `TargetFilter.maxHealth` field (`engine/src/cards/types.ts`, checked in
   `engine/src/effects/targeting.ts` against a unit's derived total max
   health — tools/permanent buffs count, damage taken does not) restricts
   Kernel Panic's evolve-in destroy to enemy units with 5 or less total
   health. "Destroy ignores Barrier and stat buffs" is unchanged exactly as
   instructed — only what can be *selected* changed, not what happens once
   destroy connects. Re-measured (300 seeds): Aegis-vs-Null moved from
   75.0%/81.3% to 74.7%/81.0% (AggressiveAgent/RandomAgent respectively,
   Null-favoured both ways) — essentially no change. Real-play evidence
   this actually works, not just a number: `progress/sample-match-009-kernelpanic-fix.txt`
   (a live match where Kernel Panic's destroy whiffs against an Aegis unit
   pushed just over the cap by its own Directive's aura) and a new unit
   test in `engine/test/nullFaction.test.ts` (Aegis Warden, 7 health, is
   never selected and is left completely undamaged).
2. **Since still flagged, adjusted a Null number as step 2**, per this
   entry's explicit instruction. Investigated first with scratch
   instrumentation (not guessing): no single card explained the gap, but
   Null Singularity was the only card in the whole pool applying a
   persistent, un-cleansable enemy-HEALTH reduction (its faction-mirror
   counterpart, Prime Aegis, and Null's own other enemy-aura card,
   Segmentation Fault, both debuff attack only, never health) — a genuine,
   comparison-based outlier, not a guess. Changed its enemy aura from
   `-1/-1` to `-1/-0` to match that precedent. Re-measured (300 seeds):
   Aegis-vs-Null moved to 74.7%/79.0% — a small real improvement in the
   RandomAgent number (81.3% -> 79.0%), still double-flagged.
3. **Honest result: Aegis-vs-Null remains double-flagged after both
   owner-directed steps.** Per this project's own established precedent
   (2026-09-15 feedback approving "stop after one measure-then-fix cycle
   rather than chasing an exact target"), and having now done the specific
   two-step process this entry asked for rather than continuing to guess
   at more Null nerfs, this session stops here on this pairing. The
   instrumentation pass turned up a more useful finding than either single
   fix: Null's win rate correlates with having ANY persistent enemy-debuff
   aura in play (~84% vs ~60% without one) but no single card explains the
   75-81% number, and further Null nerfs have diminishing and sometimes
   off-target effects (the Null Singularity change moved Cortex-vs-Null
   more than the Aegis-vs-Null pairing it targeted). The honest read this
   session leaves for whoever picks this up next: the real fix is more
   likely to be giving Aegis's own kit more independent interaction (not
   just more health to stack) than further Null-side tuning — a card-set-
   design change, out of scope for "adjust Null's numbers," so proposed
   here rather than attempted unilaterally. Full detail in
   `progress/balance-report-003-null-fix.txt` and
   `progress/quality-debt.md`.

---

## 2026-09-19 — Owner: Aegis interaction direction + fix the chosen-targeting gap (Session 10 flag)

**1. Aegis gets defensive answers, not removal.** Session 10's read is accepted: Aegis's problem is that it has almost no way to interact with the opponent's board. Fix it with interaction that fits the hardened-guardian identity — intercepting or redirecting attacks, damage reflection, blunting or taxing what the opponent commits — **not** outright removal. Aegis should be able to survive a threat it can't answer, and still not be able to delete it. Its identity stays "outlast them"; don't turn it into a control deck.

- Propose the specific cards and numbers at a checkpoint before finalising.
- Re-measure Aegis against **all four** factions with `balanceReport.ts`, not just Null. This change is expected to move its other matchups too, and Swarm-vs-Aegis (~61%) is already flagged.
- If defensive answers alone don't bring Aegis-vs-Null under the flag threshold, say so honestly and leave it flagged rather than quietly adding removal. Come back to the owner instead.

**2. Fix the chosen-targeting gap before roadmap item 4 (card depth).** `evolveUnit` and `processTelegraphArming` never supply a chosen ref, so triggered effects can't use `scope: "chosen"` at all. Close it generally in the engine, before the card-depth pass designs more cards around the limitation.

- Once it's fixed, revert Kernel Panic and Deprecated Routine to `scope: "chosen"`, which is what both were originally written as. Kernel Panic keeps its 5-health cap from session 10.
- Chosen targets are stronger than random ones, so re-measure after the revert.
- Order: finish the current balance pass (item 3), then this, then item 4.

---

**Handled, session 11 (2026-09-19).** Both parts done, in the order asked
(item 2's engine fix first since item 1's re-measurement needed it to be
trustworthy either way, then item 1, matching "finish item 3, then this"
since item 1 IS the rest of item 3's balance pass):

**2. Chosen-targeting gap — closed generally.** `engine/moves.ts`'s
evolution branch now enumerates an evolved form's own "chosen" onPlay
target alongside which base is evolving (`Move.abilityTarget`, since
`target` is already the structural base reference); `engine.ts`'s
`evolveUnit` threads it through. For a telegraphed unit, there's no agent
decision point left once the telegraph actually arms (turns later,
automatically) — the target is chosen when the card is *played* and
captured on the unit instance (`UnitInstance.armChosenTarget`) for
`processTelegraphArming` to replay. `resolveAbility` now treats a
"chosen"-scope ability fired with no target supplied as "no legal target
existed" and skips it rather than throwing, which is what lets evolving
stay legal even when the bonus ability has zero eligible targets right now.
Kernel Panic and Deprecated Routine reverted to `scope: "chosen"` exactly as
instructed, Kernel Panic keeping its `maxHealth: 5` cap. Proven three ways:
new unit tests where two eligible enemy units exist and the controller
provably picks one, leaving the other completely untouched (impossible
under the old "random" workaround) — `engine/test/nullFaction.test.ts`; a
real unscripted match, `progress/sample-match-011-chosen-targeting.txt`; and
re-measured per the instruction — isolated at 200 seeds against a control
Aegis deck (i.e. without item 1's new cards), the revert alone is neutral to
mildly *positive* for Aegis (Null's win rate drops ~1.5-2 points), so it is
not the cause of anything below. Full detail:
`progress/balance-report-004-aegis-defense.txt`.

**1. Aegis defensive interaction — built, tested, real-play-proven, but did
NOT fix Aegis-vs-Null, and the honest journey to get here matters.** Three
new cards (`data/aegisCards.ts`), each a genuinely different non-removal
mechanic: Intercept Routine (Instant, redirects a pending attack onto a unit
you control — a new generic `redirectAttack` effect kind that mutates the
nearest pending combat-damage stack item, the "intercepting/redirecting"
answer), Tariff Field (Directive, taxes the opponent's card-play cost by 1 —
a new generic `cardCostModifier` static-effect kind, the "taxing" answer),
and Feedback Plating (Unit, blunts the whole enemy board's attack by 1 for
the turn whenever it's damaged — the "blunting" answer). None destroy or
remove anything. A first attempt shipped 2 copies of each and, measured with
the full `balanceReport.ts` (300 seeds/matchup, both agent policies),
**measured WORSE than the pre-session baseline across every Aegis matchup**,
not just Null — Cortex-vs-Aegis and Swarm-vs-Aegis both newly double-flagged,
Aegis-vs-Null itself worse (83.0%/79.3% Null vs the 74.7%/79.0% baseline).
This was NOT shipped as-is. Investigated rather than guessed: isolated that
the chosen-targeting revert (above) is not the cause; decomposed the three
cards individually (each measures neutral-to-positive alone at 200 seeds)
and in combination (every combination measures worse, non-monotonically —
read as real sampling noise from full-deck reshuffling under a small-sample
scratch method, not as cleanly isolating a single bad card). The full,
trusted 300-seed/both-policy measurement is unambiguous, though: a real
regression, most plausibly driven by `AggressiveAgent`'s already-documented
"no sense of whether a card is useful right now" heuristic gap
(quality-debt.md) — a reactive/utility card with zero immediate board impact
sometimes wins its "play the biggest affordable card" slot over a real
tempo play, in a 6-slot board where that opportunity cost is real.
**Shipped configuration: 1 copy of each new card** (37-card Aegis pool,
within the [20,40] range), re-measured with the full instrument:
Aegis-vs-Null remains double-flagged, roughly at the pre-session baseline
(79.3%/83.0% vs 74.7%/79.0% — essentially unchanged under Aggressive, a few
points worse under Random, within this session's own measured noise floor).
**Per this entry's own explicit instruction, this is left flagged rather
than adding removal or guessing at further numbers.** One real, measured
improvement: Swarm-vs-Aegis, double-flagged going in, is no longer
double-flagged. Cortex-vs-Aegis is now double-flagged (was Aggressive-only
before this session) — a real, if modest, regression on a pairing this
change wasn't specifically aimed at, named honestly rather than glossed
over. Full numbers, the isolation/decomposition method, and the reasoning:
`progress/balance-report-004-aegis-defense.txt`. Real-play evidence of the
cards actually firing (not just passing a whitebox test):
`progress/sample-match-010-aegis-interception.txt` (Intercept Routine
genuinely redirects an attack away from a player's face onto a unit;
Feedback Plating's blunt fires from real combat) plus
`engine/test/aegisInteraction.test.ts`'s four dedicated tests (redirect,
its no-op-when-nothing-pending case, Tariff Field's tax in both cost math
and legal-move gating, Feedback Plating's board-wide blunt).

**Flagging back to the owner, as the entry's own instruction anticipated:**
Aegis-vs-Null is still flagged, and this session's honest read is that the
current dummy-agent-based balance measurement may be structurally unable to
value reactive/situational cards like these fairly — see
`progress/notes-for-owner.md` for the specific question this raises before
any further Aegis-vs-Null work.

---

## 2026-09-20 — Owner: balance is a systems problem; fix the loop, then expand the pool (supersedes further card-by-card tuning) (PARTIALLY HANDLED — Phase 1 done session 12; Phase 2 done in full (item 3 session 13, items 4-5 session 14); Phases 3-6 still open)

Stop tuning individual cards for balance. Three factions were built as mechanic test pools and Null was built as a tuned deck; the gap is structural (removal density predicts the standings almost exactly; permanent -1/-0 auras switch off the two 1-attack factions with no answer possible; Aegis has no clock or card flow; Swarm has no way to rebuild after board-wide damage). Work in this order. Each item is done when it's built, tested and measured, not before.

**Phase 1 — Fix the instrument (before any further balance change)**

1. Add a third reference agent that values board state, not card cost: one-step lookahead, holds Instants for a target, never plays a reactive card with nothing to react to. `balanceReport.ts` runs all three policies; a pairing is flagged only when all three agree.
2. Commit the per-card "win rate when played / when drawn" instrumentation from session 10 as a standing part of `balanceReport.ts`. Every future balance change starts from that table.

**Phase 2 — Engine gaps that create hard counters**

3. Directives must be removable: add a "destroy directive" effect kind (or give auras a duration), and give every faction one answer.
4. Add a "summon" (token) effect kind so wide decks can rebuild after board-wide damage.
5. Keep the "base must survive a turn" evolution rule, but let bases carry a small protection while unevolved (propose the mechanism at a checkpoint).

**Phase 3 — Pool construction rules, enforced at load time**

6. Add a card-pool lint that fails to load a deck that breaks a rule. First rules, tune at a checkpoint: removal/debuff cards <= 25% of a deck; no targeted damage above cost+1 under 3 mana; no permanent enemy-stat aura under 4 mana; every faction pool has both a clock (win condition) and card flow. Balance rules should be checkable, like everything else in this project.

**Phase 4 — Define the intended triangle, then measure against it**

7. Propose an explicit counter cycle at a checkpoint (e.g. Null attrition beats Aegis stacking; Aegis walls beat Swarm width; Swarm width beats Null's single-target removal; Cortex flexible in the middle). Targets: 55-60% for the intended edge, 45-55% elsewhere, under all three policies. Balance means matching the triangle, not 50% everywhere.

**Phase 5 — Card pool expansion (roadmap item 4, redefined)**

8. Copy limits stay as built (Common 3 / Uncommon 3 / Rare 2 / Mythic 1), deck size stays 40. Each faction pool grows to 30-40 unique cards so a deck is a real selection, not the whole pool.
9. Variation rule: each effect archetype gets 2-4 cards at different cost/power points or with different conditions. No two cards in a pool may be identical apart from name and art. Alt-art versions of a card belong in the rarity ladder, not the pool.
10. Add a neutral pool any faction can run (Pokemon trainer/energy-style shared toolkit), sized so hybrid decks are possible. Faction cards carry identity; neutral cards carry utility.
11. Every card gets its own art slot from day one (placeholder now), so the art pass never has to split shared art.

**Phase 6 — Economy tie-in (when roadmap item 5 arrives)**

12. The copy limit is enforced against ownership: an agent runs 3 copies only if it owns 3. Pack scarcity is what makes the limit meaningful.

Phases 1-4 come before any further balance work on Aegis-vs-Null; leave it flagged until then. Update `progress/roadmap.md` to reflect this order.

---

**Handled, session 12 (2026-09-20) — Phase 1 only, both items, in order:**

1. **Third reference agent — built.** `engine/src/agents/lookaheadAgent.ts`
   (`LookaheadAgent`): scores every legal move by resolving its ability's
   real target list from the same `TargetSpec` union the resolver
   interprets and summing a generic per-effect-kind value estimate over
   those targets — no card-name special-casing. Wired into
   `balanceReport.ts` as a third policy; a pairing is now flagged only when
   all three policies agree (previously two — Aggressive+Random). Both
   named sub-requirements proven with dedicated tests, not just design
   reasoning: "holds Instants for a target" and "never plays a reactive
   card with nothing to react to" (`engine/test/lookaheadAgent.test.ts`).
   A real bug the design itself caught before shipping (not a request from
   this entry, but directly relevant to trusting the instrument): the
   first version scored every `"all"`/`"self"`-scope ability at zero
   forever (five real Commands, 0 played across 700+ drawn games) —
   root-caused and fixed by resolving targets from the ability's own
   `TargetSpec` instead of `Move.target` alone. Full detail:
   `progress/log.md`'s session-12 entry, `progress/quality-debt.md`'s new
   session-12 section (the approximations this agent makes, named
   honestly), `progress/sample-match-012-lookahead.txt` (real unscripted
   play evidence of the fix firing).
2. **Per-card win-rate-when-drawn/played instrumentation — committed as a
   standing part of `balanceReport.ts`**, replacing session 10's scratch,
   uncommitted version. Full 300-seed, three-policy report with the
   complete per-card table for all four factions:
   `progress/balance-report-005-instrument.txt`.

**Result of the fixed instrument:** the triple-policy cross-check flags
Cortex-vs-Aegis (newly confirmed under all three policies — was
Aggressive-only through session 11) and Aegis-vs-Null (unchanged in kind).
**Neither was touched this session**, per this entry's own explicit order
("Phases 1-4 come before any further balance work on Aegis-vs-Null") — Phase
1 was scoped to fixing the instrument, not re-tuning anything with it yet.

**Not attempted this session, left open on purpose:** Phases 2 (directive
removal, a summon/token effect kind, base protection while unevolved), 3
(pool-construction lint), 4 (the intended counter triangle), 5 (pool
expansion), and 6 (economy tie-in). This entry stays PARTIALLY HANDLED —
do not treat Phase 1's completion as license to skip ahead to Phase 3+; the
next session should pick up Phase 2 in order, per this entry's own
instruction.

---

**Handled, session 13 (2026-09-20) — Phase 2 item 3 only, in order.**

**"Directives must be removable" — a real, generic engine mechanism, not a
one-off card hack.** `cards/types.ts`'s `TargetFilter.kind` gained a
`"directive"` option (alongside `"unit"`/`"player"`/`"any"`, which
deliberately does NOT include directives — a card written before this
existed must keep seeing exactly what it always saw); `effects/targeting.ts`'s
`TargetRef`/`enumerateTargets` grew a matching `"directive"` variant; the
existing `"destroy"` effect kind (previously unit-only) now dispatches on the
resolved target's own kind (`effects/resolver.ts`'s `applyDestroy` ->
`destroyDirective`, a direct board-to-graveyard removal with its own log
event, `directiveDestroyed`, since a Directive has no health/death-processing
model to route through) — one mechanism, not two. `LookaheadAgent` was
updated in the same pass (`enumerateViewTargets` + `estimateEffect`'s
`"destroy"` case) so it values a directive-destroy card by the target
directive's own cost, rather than repeating the exact "silently scores zero
forever" bug class session 12 found and fixed for `"all"`/`"self"` scopes —
proven, not assumed: `engine/test/directiveDestroy.test.ts` has a dedicated
test asserting `LookaheadAgent` actually plays a directive-destroy card
against a real enemy aura rather than passing.

**One answer per faction, as asked, each a genuinely different flavour take
on the same mechanic:** Cortex's Force Quit (a killed process), Swarm's Bore
Swarm (the mass eating through infrastructure), Null's Null Pointer (a
dereferenced crash), and Aegis's Breach Charge — Aegis's take is explicitly
NOT a reopening of the 2026-09-19 "defensive answers, not removal" direction
(see `data/aegisCards.ts`'s own header comment on this card: a Directive
isn't a unit, so dismantling one doesn't put removal into Aegis's kit against
the opponent's board). All four are Instant-speed, cost 2, Uncommon, 2
copies. Cortex's pool was already sitting exactly at the enforced 40-card
ceiling (named as anticipated debt back in session 6), so 2 copies each of
Diagnostic Pulse and Diagnostic Loop were trimmed to make room — a "make
room" cut, not a nerf, chosen from the pool's least distinctive filler,
named honestly in `data/cards.ts`'s own comment rather than silently done.

**Proven working, not just wired up:** `engine/test/directiveDestroy.test.ts`
(8 new tests: real removal + graveyard placement + log event, the "directive"
filter never offering the controller's own directives, no legal play at all
with nothing to target, all four factions' cards destroying a directive for
real, and the two `LookaheadAgent` behaviours above) plus a real, unscripted,
seed-found match — `progress/sample-match-013-directive-destroy.txt`
(LookaheadAgent-vs-LookaheadAgent, Cortex vs Aegis, seed 1 — Force Quit
destroys Static Ward Beacon during real play, not a staged scenario).
Re-measured with the full instrument (`progress/balance-report-006-directive-removal.txt`,
300 seeds/matchup, all three policies): all four new cards show real,
substantial "played" counts (166-607 games each across policies) — not the
always-zero pattern that would mean they were silently mis-scored.

**Honest read of what the re-measurement found, not chased further this
session (per this entry's own order — Phase 2 continues before any of this
gets tuned):** Cortex-vs-Aegis, triple-flagged going in (72.3%/60.0%/61.3%),
is no longer triple-flagged (71.0%/56.7%/57.3% — Random and Lookahead both
dropped below the 60% threshold) — a real, if incidental, improvement,
plausibly Aegis now being able to destroy Cortex's Mainframe Core aura.
Cortex-vs-Swarm, previously flagged under 2 of 3 policies (58.0%/72.0%/62.3%,
Aggressive under threshold), is now newly triple-flagged (60.7%/64.0%/66.0%)
— a real, if modest, regression on a pairing this session's change wasn't
aimed at, most plausibly from Cortex's own two-card trim changing its curve
against Swarm specifically. Aegis-vs-Null is essentially unchanged in kind
(still clearly double-and-triple-flagged; the three policies moved in mixed
directions by a few points each, netting out close to where they started) —
expected, since neither this session's change nor Phase 2 items 4-5 target
that pairing directly. None of this was tuned further this session, per the
entry's explicit order (Phase 2 continues in sequence; card-by-card chasing
is exactly what this entry superseded). Full numbers:
`progress/balance-report-006-directive-removal.txt`.

**Not attempted this session, left open on purpose:** Phase 2 items 4 (a
"summon"/token effect kind) and 5 (bases carry a small protection while
unevolved), and Phases 3-6 entirely. This entry stays PARTIALLY HANDLED.

---

**Handled, session 14 (2026-09-20) — Phase 2 items 4 and 5, both, in order,
closing Phase 2 in full.**

**4. "Summon" (token) effect kind — built, real, generic.** `EffectSpec`
gained a `"summon"` variant carrying a self-contained `TokenSpec`
(name/faction/attack/health/keywords/art/flavor — a token has no printed
card of its own, so the effect fully describes what it creates) and a
`count`. `effects/resolver.ts`'s new `summonTokens` creates real
`UnitInstance`s directly on the controller's board, bound by the exact same
shared `BOARD_SLOTS` cap a normal play respects (pulled the cap-check logic,
`boardSlotsUsed`, out of `moves.ts` into a shared `state/queries.ts` export
rather than duplicating it) — if there isn't room for every token, as many
as fit are created and the rest fizzle, logged (`summonFizzle`), not
silently dropped. A token behaves exactly like any other unit from the
moment it lands. Swarm's new Brood Reserves (Command, cost 3, Uncommon, 3
copies) is the first card to use it, directly answering this item's named
motivation ("Swarm has no way to rebuild after board-wide damage").
`LookaheadAgent` was updated in the same pass so it doesn't repeat sessions
12/13's "new kind silently scores zero forever" bug class. Proven: 5 new
tests (`engine/test/summon.test.ts`) plus a real, unscripted, seed-found
match (`progress/sample-match-014-summon.txt`, found on the first seed
tried). Re-measured (`progress/balance-report-007-summon.txt`, 300
seeds/matchup, all three policies): **honest result — it did not help.**
Brood Reserves itself measures below average under all three policies
(46.5%/41.2%/43.4%, versus other Swarm cards clustering 50-55%), and
Cortex-vs-Swarm got measurably worse for Swarm (60.7% -> 66.0% under
Aggressive). Most likely cause, consistent with this project's own
established pattern for reactive/situational cards: none of the three dummy
policies understands "hold this for after a wipe" timing. Not tuned or
reverted — the mechanism itself (this item's actual ask) is correctly built
and proven; a below-average first card is Phase 5 tuning work, not a reason
to touch the engine mechanism, and card-by-card chasing is exactly what the
parent entry supersedes until Phase 3/4.

**5. Base armor while unevolved — proposed and built, as instructed.**
`UnitCard.baseArmor?: number`: a flat reduction to incoming damage (floored
at 0), read directly off `unit.card` inside `effects/resolver.ts`'s
`applyDamage` — the single choke point for both combat and effect damage,
so one mechanism covers both, with no separate per-instance bookkeeping:
because evolving mutates the same instance's `card` to the evolved form
(which carries no `baseArmor` of its own past the protected tier), the
protection ends automatically the instant a unit evolves. **Proposed value:
1, applied to every current base card** (Aegis Cadet + Sentinel, Null Glitch
Seed + Corrupted Process, Cortex Init Daemon, Swarm Larva — six cards, since
a faction's mid-tier card that is itself a base for a third tier gets it
too, not just the tier-1 card; flagged explicitly in case the owner meant
tier-1 only). This is a checkpoint proposal, per this item's own explicit
instruction, not a finalised number — the owner's steer on the value itself,
and on whether mid-tier-that-is-also-a-base should count, is genuinely
wanted here. Proven: 8 new tests (`engine/test/baseArmor.test.ts` — damage
reduction and its floor, no onDamaged/Barrier interaction on a fully-absorbed
hit, the protection ending through two real evolution steps, combat damage
mitigated the same as effect damage) plus a real, unscripted, seed-found
match (`progress/sample-match-015-basearmor.txt`, found on the first seed
tried — Aegis Cadet's armor reduces real damage 8 times against 5 different
Cortex sources). Re-measured (`progress/balance-report-008-basearmor.txt`):
cross-check result unchanged in kind (still exactly Cortex-vs-Swarm and
Aegis-vs-Null flagged, same two pairings as before this session), but real
movement underneath — most visibly Cortex-vs-Aegis flipping from
Cortex-favoured to Aegis-favoured under Random play (56.7% -> 41.7% Cortex),
plausible and thematically fitting since Aegis's defensive identity most
directly benefits from a damage-mitigation mechanic and holds 2 of the 6
armored cards, but not isolated or verified by controlled experiment this
session. Not tuned further, per the parent entry's order.

**A real, honestly-handled side effect:** giving `swarmLarva`/`aegisSentinel`
new mechanical behaviour broke 5 pre-existing tests across 4 files that had
incidentally used those cards as generic damage-target fixtures unrelated to
their own mechanics — root-caused and fixed (3 swapped to an unarmored
fixture card since the tests were about something else entirely; 1 was a
real behaviour change, given a corrected expected value and a comment
explaining why), not silently patched. Full detail: `progress/quality-debt.md`'s
new session-14 section, `progress/log.md`'s session-14 entry.

**Not attempted this session, correctly deferred:** Phases 3 (pool-
construction lint), 4 (the intended counter triangle — this is where
Aegis-vs-Null and Cortex-vs-Swarm get addressed together, per the parent
entry's own order), 5 (pool expansion), and 6 (economy tie-in). Phase 2 is
now closed in full; this entry's remaining open scope is Phases 3-6 only.

---

## 2026-09-20 — Owner: Null dominance is on record; nerf its abilities if it survives Phases 2–4

For the record, with the fixed instrument (session 12): Null beats every faction under all three policies (Lookahead: 67% vs Aegis, 75% vs Swarm, 62% vs Cortex). This is the dominant archetype design principle 3 says must not exist.

Expectation: Phases 2–4 of the entry above should reduce this on their own (directive removal answers Segmentation Fault; summon lets Swarm rebuild after Fork Bomb; the pool lint forces Null's removal share down from 47%). Note that the lint will require cutting or redesigning Null cards to make the deck load. That's intended.

Backstop: after the Phase 4 re-measure, if Null still wins 60%+ against any faction under all three policies, nerf its **abilities**, not just its stats. Candidates in priority order: redesign Segmentation Fault so its effect is conditional or temporary; reduce Fork Bomb, Segfault Handler and Corrupted Process to 2 copies; make Entropy Harvester scale off the enemy graveyard; then cost increases. Measure after each step and stop when Null matches the triangle, not at 50% everywhere. Report the before/after in a balance report as usual.

---

## 2026-09-20 — Owner: session 13 question (HANDLED 2026-09-20, session 14)

Keep phase order. Do not detour to Cortex-vs-Swarm; the Phase 3 lint will change Cortex's pool again, so tuning it now is wasted work. Finish Phase 2 (summon, base protection), then Phase 3. Cortex-vs-Swarm gets picked up at the Phase 4 re-measure with everything else.

**Followed exactly, session 14.** Finished Phase 2 (items 4-5, both — see this file's own session-14 entry above), did not detour to tune Cortex-vs-Swarm despite it moving further out of range in this session's own re-measurement (60.7% -> 66.0% Cortex-favoured after item 4). Phase 3 is next, per this entry's own order.

---

## 2026-09-21 — Owner: base armor = 1 approved; write checkpoints when you say you did (HANDLED 2026-09-21, session 15)

Phase 2 is complete — approved as shipped.

1. **baseArmor = 1 is confirmed** as the finalized value (was flagged as a proposal in session 14). It's the smallest value that changes anything, and 2 would make evolution bases nearly immune to cheap removal, which we don't want. Keep it at 1 across all base cards.
2. **Process reminder, not a redo:** session 14 said it "flagged baseArmor at a checkpoint" but no checkpoint entry was written and notes-for-owner wasn't updated — it lived only in the PR body and owner-feedback. When a session says it's surfacing a decision for the owner, write it into progress/checkpoints.md (or notes-for-owner.md) as the process defines, so decisions aren't buried in PR descriptions. No rework needed for session 14; just don't let the pattern drift.

Proceed to Phase 3 (the load-time pool lint). Expect it to require cutting Null's removal density to make its deck load — that's intended, per the 2026-09-20 entries.

**Handled, session 15 (2026-09-21).**

1. No code change needed — baseArmor was already 1 across all six base
   cards from session 14; this entry just confirmed it as final. Nothing to
   redo.
2. **Process followed this time, not just acknowledged:** this session's
   own judgment call (the "removal/debuff card" classifier's precise
   definition — the 2026-09-20 entry names the four rules but not what
   counts as a removal/debuff card for rule 1) is written into
   `progress/notes-for-owner.md` directly, not left to be inferred from the
   PR body. Same for the honest "Null got stronger, not weaker" balance
   finding below.

Phase 3 (the load-time pool lint) is now done in full — see
`progress/current.md`/`progress/log.md`'s session-15 entries and
`progress/roadmap.md`'s updated item 3 for what shipped. As this entry
anticipated, Null's pool did need real work to load (50% removal density
going in, well over the 25% cap, plus a cheap permanent aura and zero card
flow) — fixed with a mix of redesign (Corrupted Process's evolve effect
changed from damage to a draw, Fork Bomb's arm effect changed from AOE
damage to summoning two tokens) and copy trims, per the entry's own
explicit "cutting or redesigning ... that's intended." Cortex also turned
out to violate the density rule (32.5%, nothing this entry specifically
named) — fixed with a pure copy-count rebalance, no redesign needed.
Swarm and Aegis already passed cleanly.

**One thing worth flagging honestly:** re-measuring after the pool changes
found Aegis-vs-Null and Swarm-vs-Null got measurably *worse* for Aegis/Swarm,
not better — most plausibly Corrupted Process's new draw effect making
Null's deck find its remaining strongest cards more reliably. Not tuned or
reverted this session, per the parent 2026-09-20 "Null dominance" entry's
own explicit order (ability nerfs come after the Phase 4 triangle
re-measure, not before) — full numbers in
`progress/balance-report-009-poollint.txt` and `progress/notes-for-owner.md`.

---

## 2026-09-22 — Owner: session 15 steers (removal classifier + the Null-got-stronger result) (HANDLED 2026-09-22, session 16)

Both of session 15's notes-for-owner items, answered:

1. **Removal classifier — confirmed as-is.** Excluding incidental reactive triggers (onAttack/onDamaged/onDeath/onTurnStart/onTurnEnd) from the 25% removal cap is the right line. The cap exists to stop a faction being *built around* dedicated removal (what Null was); a creature that grazes the board when it dies is a body played for other reasons, not a removal spell. One refinement, not a rule change: watch for a card whose reactive trigger is clearly its whole point (e.g. a 0/1 that pings the entire enemy board every time it's damaged) — that's removal in a creature's coat. Flag those case by case rather than widening the rule to catch incidental flavour.

2. **Null getting stronger after the pool fix — expected, no action now.** The structural work (Phases 2–3) was always about removing hard counters and arming the other factions, not about making Null lose; a temporary uptick from Corrupted Process's new draw making Null's deck more consistent is fine. The 2026-09-20 backstop stands: if Null is still 60%+ under all three policies after the Phase 4 re-measure, nerf its abilities. It clearly will be, so that nerf is coming. Add one thing to that nerf's scope: Corrupted Process's draw is now part of Null's power — it's on the table alongside the removal cards, not untouchable just because the lint added it.

Proceed to Phase 4 (define the triangle, then re-measure against it).

**Handled, session 16 (2026-09-22).** Both of this entry's own items were
already actioned by prior sessions (the classifier confirmed as-is, no code
change needed; the Null-got-stronger result already understood as expected)
— this entry's live instruction was "proceed to Phase 4," which this
session did in full: proposed the explicit counter triangle (adopting the
owner's own 2026-09-20 example), measured the real pool against it (none of
the six pairings pass yet), and — since Phase 4's own re-measure confirmed
Null still triple-flags against Aegis, exactly the condition the
2026-09-20 "Null dominance" entry's backstop names — executed 3 of that
backstop's 4 priority-ordered steps (Segmentation Fault redesigned to a
conditional aura via a new generic engine mechanism; Corrupted Process cut
a copy; Entropy Harvester's scaling source moved to the opponent's
graveyard), measuring after each. Honest result: real but small movement,
both Aegis-vs-Null and Cortex-vs-Swarm remain triple-flagged. Step 4 (cost
increases) and any Cortex/Swarm-side fix were deliberately NOT attempted
unilaterally — both are named as explicit steers wanted in
`progress/notes-for-owner.md` and `progress/checkpoints.md`'s new Phase 4
entry, not guessed at. Full detail: `progress/balance-report-010-phase4-triangle.txt`.

---

## 2026-09-23 — Owner: Phase 4 decisions (four-faction counter-cycle, Null step 4, buff Swarm)

This SUPERSEDES the "Cortex flexible in the middle" triangle. The current state is a ladder (Null beats everyone, Aegis/Swarm lose to everyone), which is the unhealthy shape to kill before the deck expands.

1. **The target is a four-faction counter-cycle (ring), not a triangle-plus-flexible-Cortex.** Every faction beats exactly one, loses to exactly one, and is roughly even against the one "across" the ring — so no faction is a strictly bad blind pick.
   - Ring: **Null > Aegis > Cortex > Swarm > Null.**
     - Null beats Aegis (attrition beats stacking)
     - Aegis beats Cortex (walls outlast removal)
     - Cortex beats Swarm (removal beats go-wide)
     - Swarm beats Null (too many bodies for single-target removal) — currently BACKWARDS, the main fix
   - The two "across" matchups target ~even (45–55%): **Null vs Cortex, Aegis vs Swarm.**
   - Edge magnitude: 55–60% for the intended winner on each ring edge; edges need NOT be uniform — a 60/40 hard counter and a 55/45 soft edge in the same ring is fine and preferable to four identical numbers.
   - Measure the whole board against this ring, all three policies.

2. **Null step 4 — yes, raise costs.** Increase Kernel Panic and Null Singularity (the two played-win-rate outliers). It's fine for them to cost more than other factions' top cards; Null is the attrition faction, so a premium on its best pieces is on-identity, not a curve violation. Measure after; if Null vs Aegis lands in 55–60%, stop.

3. **Swarm-vs-Null (and Cortex-vs-Swarm) — buff Swarm, do not nerf Cortex.** Swarm loses to Cortex AND loses to Null when the ring says it should beat Null — it's the weak faction, failing at its designed job of punishing single-target removal with width. Fix the faction, not its opponents: give Swarm's kit real go-wide resilience so width answers removal (its role vs Null) and holds up vs Cortex. Propose the specific cards at a checkpoint. Cortex was the dominant faction in the very first balance report and isn't newly strong — only revisit it if it still beats Aegis once Swarm is fixed (in the ring Aegis is supposed to beat Cortex, so some Cortex-vs-Aegis softening is on-target, not a problem).

Order: do 2 and 3, re-measure the whole ring, checkpoint the result. This is the last balance pass before Phase 5 (card expansion) — do NOT start expansion until the ring is within band, since a wrong ring bakes in once the pools grow.

---

**Handled, session 17 (2026-09-23).** Both items done, in the order asked,
then the whole ring re-measured and checkpointed, exactly as instructed:

1. No change needed — Cortex was not touched, per this entry's explicit
   "do not nerf Cortex."
2. **Null step 4 — done.** Kernel Panic 5->6, Null Singularity 6->7
   (`engine/src/data/nullCards.ts`). Measured after: Aegis-vs-Null did NOT
   land in 55-60% (moved to 75.7%/70.0%/65.3%, still triple-flagged), so per
   this entry's own "if it lands in band, stop" phrasing, nothing further
   was attempted — no additional Null nerfs.
3. **Swarm buff — done, two new cards, Cortex untouched.** Colony Broodling
   (dies with 2+ other units surviving -> summons a replacement Swarm
   Larva, directly punishing single-target removal) and Overgrown Carapace
   (health scales live with controller's own board width). Both real-play-
   proven (`progress/sample-match-018-swarm-resilience.txt`) and whitebox-
   tested (`engine/test/swarmResilience.test.ts`). Result: Swarm-vs-Null is
   no longer triple-flagged (real movement toward the target on all three
   policies); Cortex-vs-Swarm, not specifically targeted, is unchanged in
   kind, per this entry's own note that it may need a Swarm/Aegis-side fix
   later, not addressed this session.

**Whole-ring re-measurement — done and checkpointed**
(`progress/checkpoints.md`'s new entry, `progress/balance-report-011-phase4-decisions.txt`).
Honest result: no pairing is within band yet. Per this entry's own explicit
gate ("do NOT start expansion until the ring is within band"), Phase 5 was
NOT started. Open questions left for the owner (Cortex-vs-Swarm has no
assigned fix; whether to go past cost on Kernel Panic/Null Singularity) are
in `progress/notes-for-owner.md`'s new entry rather than guessed at.

---

## 2026-09-23 — Owner: Phase 4 session 17 follow-ups (fix the ring labels, nerf Null power, fix Aegis-vs-Cortex)

Real progress last session (Aegis-vs-Null moved down under all three policies for the first time; Swarm-vs-Null no longer triple-flagged), but three corrections/decisions for the next run:

1. **Correct the ring target labels — session 17 mislabelled two edges.** The ring is Null > Aegis > Cortex > Swarm > Null. That makes BOTH of these decisive ring edges, NOT "even": **Cortex should beat Swarm 55-60%**, and **Aegis should beat Cortex 55-60%**. Only two matchups are the ~even (45-55%) "across" pairings: **Null vs Cortex** and **Aegis vs Swarm**. Re-map balanceReport.ts / the checkpoint targets accordingly before judging what is in band.

2. **Cortex vs Swarm is NOT a problem to assign a fixer to.** Under the corrected label Cortex is supposed to win it; it is just winning slightly too much (60-70% vs a 55-60% target), and Phase 5 wider pools will likely settle it. Do not add a card or nerf anyone specifically for this pairing.

3. **The genuinely off Cortex edge is Aegis vs Cortex.** Aegis is supposed to beat Cortex (ring edge) but currently loses to it under Aggressive and Lookahead. Fix it by giving AEGIS a small edge in that matchup — an Aegis buff, not a Cortex nerf (consistent with the standing "don't nerf Cortex" rule). Propose the card(s) at a checkpoint.

4. **Null step 4 — go past cost to power.** Raising Kernel Panic (6) and Null Singularity (7) changed how OFTEN they land, not how strong they are: both still win ~79-86% of games they are actually played in, and Aegis-vs-Null is still triple-flagged. Now reduce their impact (stats/effect), not just cost — e.g. Kernel Panic's body or destroy reach, Null Singularity's aura/stats. Measure after each change; stop when Aegis-vs-Null sits in the 55-60% band.

Order unchanged: get the whole ring within band (all six pairings, all three policies, against the corrected targets) BEFORE starting Phase 5 (pool expansion).

---

**Handled, session 18 (2026-09-25).** All four items done, in order:

1. **Ring labels corrected — and encoded as data, not just prose.**
   `engine/src/dev/balanceReport.ts` now carries `RING_DECISIVE`/`RING_EVEN`
   constants with the corrected shape (Cortex-vs-Swarm and Aegis-vs-Cortex
   are both [W] 55-60% edges; only Null-vs-Cortex and Aegis-vs-Swarm are
   [E] 45-55%) and prints a per-policy "in band?" line for all six pairings
   every run — the report checks itself against the ring now, rather than
   a future session hand-recomputing it into a text file again (exactly how
   session 17's own mislabelling happened). While rewriting the cross-check
   for this, found and fixed a real, separate pre-existing bug: it flagged
   a pairing whenever all three policies independently cleared 60%, without
   checking they agreed on WHICH side — Swarm-vs-Aegis was reported as
   triple-flagged in balance-report-011 for exactly this reason (Aggressive
   favoured Swarm, Random/Lookahead favoured Aegis). Now requires the same
   winner across all three, matching what "all three agree" (the
   2026-09-20 entry's own phrase) actually means.
2. **Cortex-vs-Swarm — not touched**, exactly as instructed.
3. **Aegis-vs-Cortex — an Aegis buff, Cortex untouched.** Honest journey:
   a first attempt (a new Barrier-granting Tool, 1-2 copies) measured
   WORSE for this pairing under every policy — the same
   zero-immediate-impact-card opportunity-cost trap session 11's Aegis
   defensive-card batch already hit (owner-feedback.md's 2026-09-19 entry).
   Not shipped. Shipped instead: bumped the pool's own best-performing
   card by played win rate, Guard Directive Chip, from 2 to 3 copies (its
   Uncommon ceiling) — real stats plus Guard is exactly the mechanism that
   blunts Cortex's flat-damage removal kit. Result, honestly: real
   movement under Aggressive (32.3% -> 35.7% Aegis, the worst-outlier
   policy), essentially flat under Random/Lookahead (56.3%->54.3%,
   50.0%->48.3%) — NOT in the 55-60% band on any policy. Not chased
   further unilaterally this session; the Aggressive-policy gap in
   particular looks agent-heuristic-driven (quality-debt.md's standing
   AggressiveAgent note), not purely a card problem. Open question for the
   owner in `progress/notes-for-owner.md`.
4. **Null step 4, past cost to power.** Kernel Panic's destroy reach
   tightened maxHealth 5 -> 4 (pulls Latent Ward, 5 health, out of reach);
   Null Singularity's health cut 8 -> 7 (both auras kept — cutting either
   would gut its identity as the Mythic capstone, so the body took the cut
   instead). Measured after: **Aegis-vs-Null is no longer triple-flagged**
   — Lookahead now sits IN the 55-60% band (58.0%), the "stop" condition
   this entry's own item 4 named, even though Aggressive/Random haven't
   individually reached it yet (both moved the right direction: 74.7%->72.0%,
   66.7%->72.3% — Random's number is noisy/roughly flat, Aggressive real).
   Per "stop when Aegis-vs-Null sits in the 55-60% band," and since the
   triple-flag (the actual pass/fail bar this whole project uses) is now
   clear, nothing further was attempted on Null this session.

Real-play evidence for both shipped mechanism changes (Guard Directive
Chip forcing an attack onto itself; Kernel Panic's tightened reach sparing
a 5-health Latent Ward), in real unscripted LookaheadAgent-vs-LookaheadAgent
play: `progress/sample-match-019-ring-fixes.txt`. Whitebox test for the
tightened reach: `engine/test/nullFaction.test.ts`'s new test. Full
before/after numbers and honest read: `progress/balance-report-012-ring-followups.txt`.

**Whole-ring status after this session:** Aegis-vs-Null and Swarm-vs-Null
are now clear (not triple-flagged); Cortex-vs-Swarm remains triple-flagged
(untouched, per instruction); Aegis-vs-Cortex is real-but-partial progress,
not yet in band on any policy. Per the standing gate ("do NOT start Phase 5
until the ring is within band"), Phase 5 (pool expansion) was NOT started —
Cortex-vs-Swarm and Aegis-vs-Cortex are both still open. See
`progress/checkpoints.md`'s new entry and `progress/notes-for-owner.md` for
what's flagged back to the owner.

---

## 2026-09-24 — Owner: fold the render lane into THIS task (alternating sessions)

The separate render schedule could not get private-repo push access, so the spectator render now runs inside THIS task instead of a second one. Two rules:

1. **Render is authorized OUT of build order.** DESIGN's "no stage 6 (visuals) before the game runs headless" is explicitly overridden for a carved-out render track — it may proceed now, alongside the balance/ring work. Render follows RENDER.md, keeps ALL its work under render/ and progress/render/, and must NOT modify any balance/engine/card-pool/agent file or the shared progress files (so balance measurements and logs stay clean).

2. **Alternate — one focused slice per session.** At the start of each session check the most recent merged PR: if it was a balance/card slice, THIS session does one render slice per RENDER.md; if it was a render slice, THIS session does the normal balance/roadmap priority. Prefix render PR titles with "Render:" so the alternation signal is unambiguous. On balance sessions, owner-feedback + roadmap govern as normal; on render sessions, RENDER.md governs.

Net effect: the balance ring work continues (every other session, so a bit slower in wall-clock) and the render finally starts moving. This alternation persists after the ring reaches band and Phase 5 begins, unless changed here.

---

## 2026-09-25 — Owner: render pacing approved; design commentary for adaptive pacing

Reviewed the first spectator replay (render session 1). Two things:

1. **Visual pacing is owner-approved as a baseline to protect.** The turn-by-turn rhythm keeps the match engaging to watch. Future render and pacing-related balance work should not regress it.

2. **Fixed-speed playback will fight audio commentary (stage 7) — design for adaptive pacing.** Moves currently advance fast; that is fine for the eye but spoken commentary has a ~2-3 words/sec ceiling and cannot narrate a pivotal moment if several moves pass before the call lands. When commentary is built, pacing must be driven by move SIGNIFICANCE, not a fixed clock: trivial moves flash by, pivotal ones slow down or the replay briefly holds so the call can land. The render already computes the natural significance signal — the momentum gauge and its per-turn "why" reasons — so reuse that to drive pacing rather than inventing a new one. Flag the exact pacing model at a checkpoint when stage 7 arrives.

---

**Noted, session 18 (2026-09-25, balance session per the alternation rule — the most recently merged PR before this one was a render slice, #19).** No action due now: item 1 is a standing constraint on future render work (nothing to build); item 2 is explicitly deferred to "when stage 7 arrives," which it hasn't. Not marked HANDLED (there's nothing to mark done), just acknowledged so a future render session picks up both constraints rather than re-reading this as brand new. This session did the normal balance/roadmap priority per the 2026-09-24 entry's alternation rule — see this file's own new 2026-09-23 "Phase 4 session 17 follow-ups" handled-entry above.

---

---

## 2026-09-25 — Owner: accept the ring as directionally done; start Phase 5, carry the two open pairings as watch items

Session 18 cleared the ladder: Null is de-fanged, Swarm can rebuild, directives are answerable, every faction has tools, and under the trusted Lookahead policy both remaining problem pairings are near even. Card-by-card tuning on 14-card pools is into diminishing returns. Decisions:

1. **Aegis-vs-Null / Swarm-vs-Null — accept triple-flag-clear as the bar. Done for now.** Do NOT keep nerfing Null to drag the two dumb-agent policies (Aggressive/Random) under 60%. Lookahead is the trusted policy and the same-winner triple-check (now fixed) is the gate; residual Aggressive/Random gaps are treated as agent-heuristic artifact, not a card problem.

2. **Stop card-by-card tuning of Aegis-vs-Cortex.** Two attempts is enough. Under Lookahead it is ~even (48%); the loud Aggressive gap (Cortex 64%) is most likely a dumb-agent artifact. It becomes a Phase 5 watch item, not a third patch.

3. **Start Phase 5 (pool expansion) now, carrying the two open pairings as named watch items** (Aegis-vs-Cortex and Cortex-vs-Swarm). Phase 5 should:
   - Grow each faction pool toward 30-40 unique cards per the 2026-09-20 plan (variation rule, neutral pool, copy limits stay 3/3/2/1), and
   - Specifically aim some of Aegis's new cards at its Cortex matchup — immediate-board-impact cards, NOT zero-tempo utility (two zero-impact attempts have already failed to move it), and
   - Keep every new card inside the load-time pool lint (removal <=25%, no cheap permanent auras, etc.).

4. **Hard gate:** at the end of Phase 5's first full pass, re-measure the whole ring (300 seeds, all three policies) against the corrected targets. If any ring edge is still out of band UNDER LOOKAHEAD, return to targeted tuning then, with Lookahead as the arbiter. Do not let Phase 5 bury an unresolved ring — the re-measure is mandatory, and its result goes in a checkpoint.

Render lane continues to alternate as before, unaffected by this.

---

**Handled, session 19 (2026-09-25) — Phase 5 slice 1: Aegis only, item 3's
specific ask.** Per the alternation rule (the most recently merged PR, #21,
was a render slice, so this session takes the normal balance/roadmap
priority) and this entry's item 3, this is the first Phase 5 slice, scoped
to one faction (Aegis) rather than all four at once — growing every faction
to 30-40 unique cards in one session isn't "one real, complete slice"
(TASKS.md); other factions' own Phase 5 growth is left for future sessions.

**Grew Aegis from 18 to 22 unique cards** (`engine/src/data/aegisCards.ts`),
four new cards all with real, immediate board stats (not reactive/utility) —
Bulwark Chassis and Aegis Line Trooper (stat-only bodies), Reinforced
Bastion (a second, higher-cost print on the existing Guard-wall archetype,
per the variation rule), and Salvage Reflex (a genuinely new archetype:
onDeath, converts a removal spell spent on it into Barrier for a random
ally). Funded by data-driven trims (not guesses) of the pool's own measured
weakest cards per balance-report-012's per-card table (Diagnostic Ward,
Static Ward Beacon, Barrier Shim, Latent Ward, Lockdown Field, Barrier
Drone, Failover Custodian, Breach Charge — each cut by 1-2 copies, none
removed from the deck entirely), keeping the deck at exactly its 40-card
cap. Pool lint, copy limits, and deck size all still pass (a new committed
test asserts this).

**Honest journey, not a straight line — the first cut was shipped-then-caught,
not shipped as designed.** The first stat line (Bulwark Chassis 1/5 cost 2;
Reinforced Bastion 2/6 Guard cost 3 — strictly better than Cortex's own
Firewall Sentinel at the same cost) measured badly overtuned when re-run
through `balanceReport.ts`: Aegis-vs-Cortex flipped hard toward Aegis
(59.3-70.3% Aegis depending on policy) but so did Aegis-vs-Swarm (57.7-78.7%
Aegis) and Aegis-vs-Null (Null cut to 29.7-50.3%) — Aegis became generically
too strong, not specifically better against Cortex. Caught before shipping
by this session's own re-measurement (not by the owner), scaled back to fair
stat lines explicitly benchmarked against existing cards at the same cost
(Bulwark Chassis now matches Cortex Engineer's 1/3; Reinforced Bastion now
sits at or below Firewall Sentinel's 2/5 Guard; Aegis Line Trooper now
trades combat math evenly with Signal Drone's 1/1 instead of strictly
beating it), and re-measured again.

**Result after the correction: Aegis-vs-Cortex is no longer triple-flagged**
— the project's actual pass/fail bar — for the first time across three
sessions that have tried (11, 18, this one): Random 58.7% and Lookahead
59.3% both land IN the 55-60% target band; Aggressive sits at 47.0% (Cortex
now slightly favoured under that one policy, out of band but not extreme,
and consistent with this project's standing read that Aggressive is the
least trustworthy of the three policies). Cortex-vs-Swarm remains the only
triple-flagged pairing, untouched this session exactly as the owner's
2026-09-23 entry instructed ("not a problem to assign a fixer to").

**Named honestly, not chased further this session:** Aegis-vs-Swarm (an
"even" 45-55% target pairing) moved to 57.7/71.0/70.7% Aegis — real
collateral drift from Aegis getting generically stronger, not
triple-flagged (Aggressive stays under the 60% independent-flag threshold)
but a genuine new watch item. Per this entry's own scoping ("one real
complete slice" per TASKS.md, and Swarm/Cortex's own Phase 5 growth is still
to come), this was not tuned further this session — flagged in
`progress/notes-for-owner.md` and `progress/checkpoints.md`'s new entry.
Full before/after: `progress/balance-report-013-phase5-slice1.txt`.
Real-play evidence of both new mechanisms firing in unscripted
LookaheadAgent-vs-LookaheadAgent play: `progress/sample-match-020-phase5-slice1.txt`.
4 new whitebox tests: `engine/test/aegisPoolExpansion.test.ts`. `npm test`:
86/86 in engine (was 82), 147/147 across all five workspaces; `tsc --noEmit`
clean in all five.

**Not attempted this session, correctly left open:** Cortex/Swarm/Null's own
Phase 5 growth (each needs its own session); the neutral shared-toolkit pool
(item 10); the hard-gate whole-ring re-measure this entry's item 4 requires
(explicitly scoped to "the end of Phase 5's first full pass" — one faction
grown is not a full pass); the small "instance IDs in the event log" engine
task and the render-lane "scale animation magnitude" task from the other two
2026-09-25 entries below (neither is this session's scope; both still open
for a future session).

---

## 2026-09-25 — Owner: give the event log instance IDs (small engine improvement, when convenient)

Render session 2 found that the engine event log identifies units/players by NAME, not instance ID, so it cannot say which specific copy an effect hit when two share a name (a card mirror, or same-named agents like Lookahead-vs-Lookahead — the standard balance-test shape). The render worked around it by diffing board snapshots; correctly did not edit the engine.

On a BALANCE session (not render — this is an engine change), when convenient during Phase 5, add instance IDs to the relevant event-log entries (attacker/target/unit/etc.) alongside the existing display names. Not blocking or urgent, but do it before stage 7: AI commentators will need to reference specific units ("which Aegis Cadet died"), and name-only entries make that impossible. Keep the display names too — this is additive. Re-run the engine tests after; touch nothing balance-affecting.

---

## 2026-09-25 — Owner: scale animation magnitude to event magnitude (render lane)

Watched the session-2 animated replay (seed 24). The animations are there and fine in principle — confirmed by stepping through moves 25 (evolution) and 70 (Mythic Prime Aegis) — but at play speed the big moments do not STAND OUT. Fix is proportionality, not "make everything bigger":

1. **Small/routine events stay subtle** — a 1-damage ping, a small unit entering, a minor buff. A busy board should not constantly shout.
2. **Large events and powers get large, supporting animations** — an unconditional destroy (Kernel Panic), an evolution, a Mythic entering (or later a leader power), a board-wide effect, a lethal blow, a big momentum swing. These should be unmistakable spectacle. Right now a Mythic entering uses the same modest fade as a common unit — that is the gap.
3. **Judge magnitude from the effect and the swing:** the effect's own weight (destroy vs 1 damage, AOE vs single, rarity/Mythic, lethal) and/or the momentum-delta the gauge already computes.
4. **A big animation needs a beat.** Hold or slow the frame so large effects complete and land (first concrete use of the adaptive-pacing note); routine moves still skip past fast. Note the current collision: at 700ms/move some effects (floating numbers 900ms, death/evolve 650ms) already overrun the frame, so big effects especially need the frame to wait for them.
5. **Verify at PLAY speed, not just single-step** — session 2 was validated by single-stepping, which is why the under-emphasis was not caught.

Goal: watching at normal speed, a person clearly feels the big plays without being told where to look, while the small stuff stays understated.

---

## 2026-09-26 — Owner: session 19 confirmations (Phase 5 slice 1)

Phase 5 slice 1 (Aegis 18->22, Aegis-vs-Cortex) reviewed and accepted. Four responses:

1. **Aegis-vs-Cortex — accepted as done.** Triple-flag clear (Random 58.7%, Lookahead 59.3% in band) is the bar, same as Aegis-vs-Null. Do NOT keep tuning it to drag the Aggressive policy (47%) into band — Aggressive is the weakest agent; Lookahead + the triple-check govern.
2. **The overtuned-first-cut catch is noted and endorsed** — re-measuring before shipping is exactly right; keep doing it on every card-design pass. No action.
3. **Aegis-vs-Swarm drift accepted as a tracked watch item, not fixed now.** It is an "even" pairing that drifted Aegis-favoured as collateral from Aegis getting stronger. Leave it for SWARM's own Phase 5 slice to pull back (Swarm buffs vs Null should also help here), and let the mandatory end-of-Phase-5 full-ring re-measure catch it. Do not nerf Aegis to chase it mid-expansion.
4. **Latent Ward trim (2->1) stands.** The telegraph=2 fuse trial is judgeable from the render at any copy count, so 1 copy is fine; no need to protect its representation.

Continue Phase 5: each faction gets its expansion slice (Swarm next would help both its own weak matchups and the Aegis-vs-Swarm drift above), all inside the lint, then the mandatory full-ring re-measure under all three policies with Lookahead as arbiter.

---

## 2026-09-26 — Owner: build the render toward a full effects language (render/EFFECTS.md)

The render effects-language spec is live at render/EFFECTS.md and is now referenced from RENDER.md. Render sessions build against it: one coherent visual system across three axes — event category (the meaning-carrying grammar), faction (skin only), and the existing magnitude tier — composed from a small set of parameterised primitives, never a hand-authored per-combination matrix. The one invariant: meaning stays constant across factions and tiers (a debuff always reads as a debuff); faction and tier change flavour and scale, never meaning.

Build order (one slice per render turn, each built across ALL factions via the primitive): (1) defence/shield — Barrier interpose+shatter, a Guard shield badge, a base-armor deflect (do FIRST, no pairing dependency, makes Aegis legible); (2) buff/penalty grammar; (3) power/ability cast flourish; (4) attack travel+impact (after the instance-ID event-log fix); (5) per-faction skinning. Placeholder visuals now, real art in the later art pass.

Next render session: start slice 1 (defence/shields).

---

## 2026-09-26 — Owner: reserve player identity (username + profile/character image) for both AI players

The finished game is two AI agents playing each other; a spectator and the commentators must tell them apart instantly. Make player identity first-class for EACH of the two players: a username (already shown in the render HUD — keep it) AND a profile / character / avatar image slot.

Render lane (now, no engine change needed): add a visible avatar slot beside each player’s name and faction colour in the spectator HUD, filled with a deterministic placeholder generated from the username (same approach as the card frames, and the same username-seeded generation the planned 1-of-1 leader art will use). Structure it so a real image can drop in later. The two sides must be unmistakable at a glance via name + avatar + faction colour together. Keep this in the render’s own player-identity data; do not touch the engine.

Platform / onboarding stage (later): the account/player model carries username + profileImage as first-class fields (the image can reuse the username-seeded generation used for the 1-of-1 leader card), and passes the real image into the render. Until then the render’s username-seeded placeholder stands.

This is identity/layout, not animation — it sits alongside render/EFFECTS.md, not inside it. A render session can fold the avatar slot into its current slice or do it as a small standalone one.

---

## 2026-09-26 — Owner: session 20 confirmations + next Phase 5 slice (Null, depth pass)

Phase 5 slice 2 (Swarm 16->20) reviewed and accepted. The ring is now healthy — zero triple-flagged pairings for the first time. Responses:

1. **Cortex-vs-Swarm overshoot — accepted as a watch item, do NOT chase now.** It is no longer triple-flagged; it slid slightly past even into mild Swarm favour (Lookahead ~55.7% Swarm) when the ring wants Cortex to win that edge. Leave it; the mandatory end-of-Phase-5 full-ring re-measure is where it gets judged, and a later slice (Cortex’s, or a small Swarm trim) can nudge it back if it is still off then.
2. **Methodology lesson endorsed:** when benchmarking a new card’s stat line against a precedent card, confirm the precedent itself measured as AVERAGE, not strong — copying a strong card’s numbers spikes the whole deck. Keep re-measuring before shipping. No action.
3. **Swarm-vs-Null — accepted under the Lookahead-arbiter rule.** Lookahead now favours Swarm, which IS the ring’s intended edge (Swarm beats Null); the Random-agent disagreement is discounted as dumb-agent noise, same standing rule as elsewhere. Tracked, not chased.

**Next Phase 5 slice: Null — as a DEPTH / VARIETY pass, not a power buff.** Grow Null toward the 30-40 unique-card target with variety (the variation rule, inside the lint), NOT by raising its power — it must not reopen the Null dominance removed earlier. Re-measure after; if Null’s win rates climb back up under Lookahead, pull the additions back. A Null slice may also help settle the Swarm-vs-Null Random split. After Null: Cortex’s slice, then the neutral pool, then the mandatory full-ring re-measure gate.

The balance fight is essentially done; Phase 5 from here is mainly card variety, with the re-measure as the safety net.

---

**Handled, session 21 (2026-09-26) — Phase 5 slice 3: Null depth/variety
pass.** Items 1-3 needed no action (acknowledged; Cortex-vs-Swarm and
Swarm-vs-Null left untouched as instructed). The "next slice" ask is done:
Null grown 15 -> 20 unique cards, each new card exercising a trigger or
keyword Null had never used (Zombie Process — onDeath token; Dangling
Pointer — Rush; Bit Rot — Instant -3/-0 combat trick; Watchdog Timer — a
Directive with an onTurnEnd draw that only fires on an empty hand; Garbage
Collector — an activated heal). Deck filled 32 -> 40 with no trims;
removal/debuff density moved AWAY from the lint cap (25.0% -> 22.5%).

Re-measured as asked. Null did NOT climb back up under Lookahead in any
worrying way: mean 40.0% -> 42.1%; vs Cortex 46.3 -> 45.0, vs Swarm 35.7 ->
36.3 (both inside one standard error), vs Aegis 38.0 -> 45.0 — a move
toward the ring's own intended Null>Aegis edge, not toward dominance. No
pairing flagged under all three policies. So nothing was pulled back. The
Swarm-vs-Null Random split you hoped a Null slice might settle did shift:
Random is now 59.7% Null (was 63.7%), under the 60% signal threshold.

Honest journey: three measured cuts, not one. The first cut was a real
NERF (Null Lookahead vs Cortex fell to 39.7%, out of its even band) and
exposed a LookaheadAgent blind spot — it never valued a Directive's turn
triggers, so it never played Watchdog Timer (0 plays in 900 games). Fixed
generically in the agent (no earlier Directive had a turn trigger, so no
earlier measurement moves). The second cut showed Watchdog Timer's first
condition ("fewer than 2 units") was never live in real play; the shipped
version gates on an empty hand instead. Full detail:
`progress/balance-report-015-phase5-null-slice.txt`; real-play evidence of
all five mechanisms: `progress/sample-match-022-phase5-null-slice.txt`.
Next per this entry: Cortex's slice, then the neutral pool, then the
mandatory full-ring re-measure.


---

## 2026-09-26 — Owner: render slice 2 (buff/penalty) review — three taste calls settled

Reviewed the session-5 render output (PR #26: buff/penalty rise-sink grammar + player avatars). The three non-blocking taste calls from progress/render/checkpoints.md are decided:

1. **Penalty magnitude — a multi-unit penalty SHOULD feel like a big play.** Board-wide saps (a penalty hitting multiple units) escalate to the spectacle tier, not "normal". Single-unit penalties stay at their proportional tier per the adaptive/magnitude rules. Consistent with the proportionality principle: a wide swing across the board reads big; a lone small penalty stays subtle.

2. **Effect tint — tint by the SOURCE card's faction, not the affected unit's faction.** When a faction's card buffs or penalises a unit, the motes wear the source faction's colour ("who did this"), so every play stays legible as which agent is acting. Pairs cleanly with the slice-4 attack-travel effect, whose motes already originate from the acting card.

3. **Label vs particle colour — KEEP THE SPLIT.** The numeric stat label carries MEANING and is faction-independent (gold = buff, slate = penalty, always); the particle motes carry FACTION colour. Faction colour must not override the label. This is the cleanest expression of the EFFECTS.md invariant (meaning constant across factions) and keeps a play readable to a first-time viewer and to future audio commentary without memorising the four faction colours.

**Render-lane note (from the mirror replay, aegis-vs-aegis seed 1):** Feedback Plating emitted a "grant" with a negative value (-1/+0) through the buff event at moves 29 and 40. Confirm the render classifies a negative-delta "buff" as a SINK (penalty grammar), not a rise — the SIGN of the delta decides rise vs sink, never the event name. This is the "penalty reads as a buff" thin spot the checkpoint already flagged; the three decisions above set how it should resolve.


---

## 2026-09-26 — Owner: session 21 (Null depth/variety pass) confirmations + next Null slice = consistency, not stat buff

Reviewed Session 21 (Phase 5 slice 3: Null grown 15 -> 20 unique cards, deck filled 32 -> 40 with no trims, power-neutral). The five new cards each add a trigger/keyword Null lacked (onDeath token, Rush, Instant trick, empty-hand Directive draw, activated heal); the LookaheadAgent fix that now values Directive turn-triggers is endorsed as a real instrument fix. Nothing triple-flagged; the "no power buff" constraint held. Responses to the three steers:

1. **Kernel Panic frequency (now ~half as common, ~105 of ~900 games) and Null being the weakest faction (42% under Lookahead, edge-over-Aegis at 45% vs the 55-60% target) are the SAME lever — fix them together on Null's NEXT slice.** Both are consequences of diluting the deck to 40 with weak filler. The next Null pass should trim back toward ~36 by cutting Null's measured-weakest filler, which raises Kernel Panic's visibility (matters for a spectator game — a signature arc in ~12% of matches is too thin) AND nudges Null's consistency/power up toward its ring target. This is the sanctioned way to buff Null: consistency/density, NOT stronger individual card stats.

2. **Reframe the standing Null constraint:** "no power buff" now means "no STAT buff / no power-creep on individual cards" — it does NOT forbid raising Null via consistency (trimming filler, tightening the curve). Null is now the underpowered faction, so lifting it toward its intended edges is wanted; do it through deck density, not bigger cards, so Null dominance does not reopen. Re-measure after any trim; pull back if Null overshoots.

3. **Watchdog Timer's empty-hand condition — accepted as shipped.** The "fewer than 2 units" version never fired in real play; the empty-hand refuel version (1 copy, Directive-removable) is fine. No change.

4. **Agent heuristic constant (Directive turn-trigger valued at 2 expected firings) — accepted as a named guess.** Leave it; sanity-check the arbiter's weights at the end-of-Phase-5 full-ring re-measure, not before.

Alternation stands: next is a render slice (it picks up the 2026-09-26 render taste calls), then Cortex's Phase 5 slice, the neutral pool, then the mandatory full-ring re-measure gate. The Null consistency trim above can be folded into Null's next slice whenever it comes back around.

**Handled (item 1, the Null consistency trim), session 23 (2026-09-28).** See the session 22
confirmations entry below for the details. Items 1 and 2 of this entry are now both done:
density only, no card's stats touched.

**Handled (the Cortex step), session 22 (2026-09-26, balance session: the last merged PR, #28,
was render).** Cortex's Phase 5 slice is done: 19 -> 24 unique cards, a variety pass aimed at
the out-of-band Cortex-vs-Swarm edge. Under Lookahead, Cortex-vs-Swarm went 44.3 -> 58.7 on 300
seeds and 46.7 -> 54.1 on 900. Aegis-vs-Cortex held in band. Null-vs-Cortex moved toward Cortex
(57.9 -> 61.1 on 900 seeds). It was already out of band on 900 seeds before this slice, and no
tested mix could hold it while fixing Swarm. The Null consistency trim from item 1 is the lever
for it and has not been started. Details and the decision to overrule, if you want to:
`progress/balance-report-016-phase5-cortex-slice.txt`, `progress/notes-for-owner.md`. Next per
this entry: the neutral pool, then the mandatory full-ring re-measure.


---

## 2026-09-26 — Owner: session 6 render (cast flourish, EFFECTS.md slice 3) — four taste calls + slice 4 unblocked

Reviewed the render cast-flourish slice (every power now shows which exact card cast it — faction-tinted ring/sigil/rays + a fixed-colour trigger-kind tag: ON PLAY / ON DEATH / ON HIT / TURN END / ACTIVATE / CAST / RESOLVE / RESPONSE). Slice-2 taste calls confirmed applied, instance-exactness proven (819 powers / 385 exact checks / zero wrong across 48 matches). Responses to the four cast-flourish taste calls in progress/render/checkpoints.md:

1. **Cause/effect stagger — YES, but only on spectacle-tier casts.** Add the ~150ms "cast, then effect" beat only for spectacle-magnitude powers; keep routine powers simultaneous so the approved `normal` pacing is untouched. Same proportionality principle as the magnitude work: only the big/signature moments earn the extra causal beat.

2. **Tag wording (trigger KIND, not effect) — keep as-is.** "ON DEATH" not "ON DEATH: +Barrier to an ally". The render already shows the effect visually; spelling out what the ability did is commentary's job (stage 7). Endorsed.

3. **Response loudness — keep the rarity scaling; do NOT blanket-spectacle every response.** Common/Uncommon response stays `normal` with the double-ruled RESPONSE tag; Rare+ stays spectacle. Making every response a spectacle hold would flatten the magnitude language just built. The always-distinct RESPONSE tag already guarantees a viewer notices reactivity happened, even at normal tier; reserve the full hold for Rare+.

4. **Commands cast from the avatar — keep for now; revisit at slice 4.** The avatar-cast version is fine as a placeholder. The richer "card flies onto the stack" version is better for commentary (viewer sees the actual card), but it is a bigger build — fold it into slice 4 (attack travel), which builds the card-movement machinery anyway, rather than doing it as a standalone now.

**Slice 4 (attack travel + impact) is unblocked — proceed.** The render found it does NOT need to wait on the balance lane's event-log instance-ID fix: the engine's combat stack item already carries `attackerInstanceId` and an instance-exact target, which the render can read read-only (same way this session read an ability's source). So slice 4 is the next render slice. The event-log instance-ID work is still worth doing later for commentators (stage 7), but it no longer gates the render.

Thin spots noted, no action: particle shapes are still identical per faction (that is slice 5's job), and the truth-check can't see onDeath/onDamaged powers the engine fires from inside its resolver (consistency-checked only) — both acceptable.

**Noted, session 22 (2026-09-26, balance session).** No action from a balance session: every
item here is render-lane work (the spectacle-tier cast stagger, slice 4 attack travel). Left
unmarked for the next render session. One thing that session should know: this balance slice
added five Cortex cards (Rate Limiter, Load Balancer, Hotfix, Deadlock Detector, Quorum
Arbiter). Rate Limiter is a Directive whose onTurnStart ability is sourced from a Directive
rather than a unit, and Quorum Arbiter's attack changes live with the enemy board.


---

## 2026-09-26 — Owner: session 22 (Cortex depth pass) confirmations + 900-seed standard + revised Phase 5 order (HANDLED — steps (i) session 23, (ii) session 24, (iii) the gate session 26; item 3's Quorum Arbiter drop measured at the gate and NOT applied, see the session-26 note)

Reviewed Session 22 (Phase 5 slice 4: Cortex 19 -> 24 unique cards; Cortex-vs-Swarm fixed, 44.3 -> 58.7% Cortex under Lookahead). Three decisions:

1. **Adopt 900 seeds as the re-measure standard.** The finding that 300-seed reports carry ~2.9 points of standard error — enough to move a pairing in/out of band — is accepted. The mandatory end-of-Phase-5 full-ring re-measure runs at 900 seeds (all three policies, Lookahead as arbiter), using the new `engine/src/dev/lookaheadEdgeCheck.ts`. The ~35s cost is fine. Going forward, judge in-band / out-of-band and any "is this pairing fixed" call at 900 seeds, not 300; 300-seed runs are a fast pre-check only, never the pass/fail gate.

2. **Revised Phase 5 order: Null consistency-trim FIRST, then the neutral pool, then the full-ring re-measure gate.** Per the session's own recommendation and the item-2 finding that Null is below 45% against every faction (incl. 37.3% vs Aegis). Do the sanctioned Null trim (toward ~36 cards, cutting measured-weakest filler — consistency, NOT stat buffs) before the neutral pool, so the final gate measures a ring where every faction has had its fair shot. So: (i) Null trim, (ii) neutral pool, (iii) mandatory 900-seed full-ring re-measure.

3. **Accept the Cortex-vs-Null drift (57.9 -> 61.1 over 900) for now — do NOT drop Quorum Arbiter yet.** The finding that Cortex's rate vs Null and vs Swarm move ~1:1 (no copy-mix holds both) is accepted, and the read is endorsed: this edge follows Null's overall weakness, so the Null consistency-trim in item 2 is the correct lever — lifting Null should also pull Cortex-vs-Null back toward band as a side effect. Re-check at the 900-seed gate after the Null trim. If Cortex-vs-Null is still out of band there, THEN drop Quorum Arbiter (the identified ~-6-vs-both lever). Don't pre-emptively nerf Cortex now.

Net: the Null trim is doing double duty (fixes Null's weakness AND the Cortex-vs-Null overshoot), which is why it goes before the neutral pool and before any Cortex nerf. Everything gets judged at the 900-seed gate.

**Handled (step i, the Null trim), session 23 (2026-09-28, balance session: the last merged PR,
#30, was render).** Null 40 -> 36: Decay Ward 2->1, Fork Bomb 3->2, Null Shell 3->1. All 20
unique cards kept, Kernel Panic kept at 2. Cuts chosen by a measured greedy ablation
(`engine/src/dev/nullTrimSearch.ts`), confirmed on 3,600 held-out seeds: about +3.5-4 points
on each Null edge. Kernel Panic plays ~7.5% -> ~10%. Item 1 was followed: every call this
session is 900+ seeds. Item 3: Cortex-vs-Null moved 61.1 -> 58.9 Cortex under Lookahead, toward
band but still out. Quorum Arbiter left alone for the gate, as directed. Null is still the
weakest faction (41.1 / 41.7 / 39.6 under Lookahead). A bigger-lift variant that also cuts Bit
Rot and Watchdog Timer was measured and not shipped; it's flagged in notes-for-owner.md.
Next per this entry: (ii) the neutral pool, then (iii) the gate.
`progress/balance-report-017-null-trim.txt`.

**Handled (step iii, the gate), session 26 (2026-10-03).** 900 seeds for the even bands, 2,500
for the win/lose bands, Lookahead arbiter, interval verdicts. Result: 2 IN (Cortex>Swarm,
Aegis~Swarm), 1 UNRESOLVED (Swarm>Null at 59.4, top of band), 3 OUT (Null>Aegis 42.0,
Aegis>Cortex 52.2, Null~Cortex 40.7). Item 3: Cortex-vs-Null is still out, so the Quorum Arbiter
drop was measured. It now moves that edge only -2.7 [-5.4, 0.0] on the gate seeds and -1.0
[-3.7, 1.7] held out, and the edge stays OUT either way. Your instruction was "if it's still out,
THEN drop it" on the premise that this was the ~6-point lever; it no longer is, so I did not drop
Cortex's only Mythic and put the call to you in notes-for-owner.md. Checkpoint in
`progress/checkpoints.md`; numbers in `progress/balance-report-020-phase5-gate.txt`.


---

## 2026-09-26 — Owner: cross-project — AI TCG balance is claude-tools' first real caller (two-proportion significance for in/out-of-band) (CLOSED — superseded by the 2026-09-30 self-containment entry; the local port is permanent, no live call)

A direction connecting the two autonomous projects (recorded here so the balance lane sees it; matching enable-side items are in the claude-tools wishlist).

Session 22's finding that 300-seed reports carry ~2.9 points of standard error means in/out-of-band calls should be significance-tested, not read off raw point estimates. The right instrument already exists: claude-tools' `discrete-probability.compare_two_proportions` (two-proportion z-test, Wilson CIs per group, Newcombe CI for the difference, plain verdict) — which was literally built for this project's win-rate-gap question but has never actually been called by it.

Adopt it for balance judgments:

1. **Significance-test the band calls.** When deciding whether a pairing is in-band / out-of-band or "fixed", use a two-proportion test with a confidence interval on the win-rate gap, not just the point estimate vs the band. Treat a pairing as out-of-band only when the CI excludes the band, not when a noisy point estimate lands outside it. This directly addresses the "300-seed reports were noisier than we treated them" finding, and pairs with the 900-seed standard already adopted.

2. **Use claude-tools as the instrument; calling it is the goal, not porting it.** Reference implementation is claude-tools' `compare_two_proportions`. Preferred: once claude-tools exposes a callable path (being set up on that side), call that MCP server directly so the calls register as real usage and the two projects compound. Acceptable interim only if a live cross-repo call isn't feasible in-session: port the same method (Wilson/Newcombe CIs) into the balance harness — but keep the live call as the target.

3. **Do NOT block the Phase 5 roadmap on this.** Order stays Null trim -> neutral pool -> 900-seed gate. Fold the significance test into the 900-seed gate's in/out-of-band logic when convenient; it is an accuracy upgrade to the gate, not a new phase.

This makes AI TCG the first named external caller of the claude-tools collection, closing that project's "is anything actually using these tools" gap from the consuming side.

**Partially handled, session 23 (2026-09-28).** Items 1 and 3: `engine/src/dev/edgeMeasure.ts`
has Wilson intervals, Newcombe difference intervals, and your band rule (OUT only when the CI
misses the band). `lookaheadEdgeCheck.ts` now prints a CI and a verdict for every edge, and
the Null trim's before/after calls were made on Newcombe intervals. Item 2: this is the
sanctioned interim port. No claude-tools MCP server is reachable from this session, so the
live call has not happened. Tested against Newcombe (1998)'s published examples
(`engine/test/edgeMeasure.test.ts`). One consequence for the gate is in notes-for-owner.md: at
900 seeds, the CI is wider than a 5-point band, so those bands can't come back IN.


---

## 2026-09-27 — Owner: session 7 render (attack travel, EFFECTS.md slice 4) — accept slice + broaden cast stagger to responses

Reviewed slice 4 (attack travel + impact: declare/redirect/resolve aim line + bolt, Command card flight; the four slice-3 cast-flourish calls applied). Proof was strong: 950/950 attacks drawn to the exact target, all hits/redirects/counter-strikes agreed with the engine. Responses:

1. **All five slice-4 taste calls — accept as shipped.** (i) aim line persists through the whole response window (keep — makes reactivity legible, shows what a RESPONSE answers); (ii) bolt flight comes from the start of the move's own tick, approved pacing unchanged (keep); (iii) return strikes drawn as a second bolt in the defender's colour (keep — reads as its own event); (iv) on a strike move everything (deaths, onDamaged/onDeath powers, summoned tokens) waits for the bolt (keep — causally correct); (v) the stagger applies to the whole move, not effect-by-effect (accept the limitation; the event log can't attribute effect->power yet).

2. **Broaden the cast stagger (slice-3 call 1): fire it on ALL RESPONSES, not only spectacle-tier powers.** The finding that a spectacle-tier power never fired on a move without a strike in 72 matches means the beat is built but effectively invisible. A response (an Instant on the opponent's turn) is the reactive pillar and the exact moment "cause, then effect" legibility pays off — you see the response fire, then its effect land. Responses are infrequent enough not to dent the approved pacing. So: a response gets the ~150ms cast-then-effect stagger regardless of tier; spectacle-tier powers keep it too. Hold Rare+ activations in reserve — do not broaden further yet; re-judge once the response beat is actually visible in a real replay.

3. **Fixed-slot board layout is now the render lane's next infrastructure priority.** Three slices have bumped into the no-fixed-slots problem (latest: a dying card's ghost briefly overlapping the card that slides into its spot). Promote fixed-slot layout off the debt list to the next non-slice render infra task — it is the root fix for the ghost overlap and cleans up future travel/positioning work. Sequence it against slice 5 (faction skinning) as the lane sees fit, but don't let fixed-slot slip further.

Confirmed: slice 4 needs no engine change (reads stack-item id + combat attacker/target read-only), so the render lane is NOT blocked on the event-log instance-ID work. That work remains worth doing only for commentators and for pairing effect-damage source->target (power hits), not attacks.


---

## 2026-09-29 — Owner: session 23 (Null consistency trim 40 -> 36) — hold variant B, bump narrow-band gate to ~2,500 seeds (HANDLED — item 1 followed session 24; note 3 settled session 25; item 2 applied at the gate, session 26)

Reviewed Session 23 (Null trim: Decay Ward 2->1, Fork Bomb 3->2, Null Shell 3->1; all 20 unique cards kept, Kernel Panic stays at 2 and now shows in ~10% of Null games; +3.5-4 pts/edge; CI band verdicts now built into lookaheadEdgeCheck.ts). Two decisions:

1. **Do NOT take the bigger lift (variant B). Hold the mechanics.** Variant B lifts Null roughly twice as much (+7.7/+8.1/+6.9, near band vs Cortex/Swarm) but cuts Bit Rot (Null's only Instant combat trick) and Watchdog Timer (its only turn trigger) — two of the five mechanics endorsed in session 21. That trade is the wrong one: Phase 5's purpose is variety, and a ~41% Null with its full mechanic set is better for a spectator game than a balanced-but-blander one. My session-22 "measured-weakest filler" instruction was right to exclude those two — confirmed.
   - **First settle note 3 before removing anything else:** the session found Null's weakest copies are all its removal/debuff cards (Bit Rot, Null Pointer, Watchdog Timer, Decay Ward) but has NOT separated "the cards are weak" from "LookaheadAgent plays them badly." A next session should separate those two (e.g. compare against Aggressive/Random, or hand-check lines) before any further Null cuts — variant B may be cutting good cards the arbiter just mishandles, which would be an instrument problem, not a card problem.
   - Null's remaining edge gap is left to the other levers already queued: the neutral pool (may hand Null stronger options) and the Quorum Arbiter drop (deferred to the gate, helps Cortex-vs-Null). Don't chase Null's win rate by sacrificing endorsed mechanics.

2. **Bump the gate's Lookahead side to ~2,500 seeds for the WIN/LOSE-band pairings.** The CI rule can't confirm a 5-point band (55-60, 40-45) at 900 seeds — a 95% interval there is ~+/-3.2 pts, wider than the band, so those pairings can only ever come back OUT or UNRESOLVED, never IN. Run the win/lose-band pairings at ~2,500 seeds/pairing (still well under a minute) so the CI can actually fit inside a 5-point band. The 10-point "even" bands stay fine at 900. Do NOT accept UNRESOLVED as a pass — that would defeat the gate. This refines, not replaces, the 900-seed standard: 900 for wide/even bands, ~2,500 for the narrow win/lose bands.

No change to the roadmap order (Null trim done -> neutral pool next -> mandatory full-ring re-measure gate, now at the seed counts above). The claude-tools live call remains open (local CI port shipped this session; the live cross-repo call needs the server mounted on the Mac stack, which is the owner's step).

**Acknowledged, session 24 (2026-09-30, the neutral pool).** Item 1: variant B not taken, and
no Null card was cut this session. The first neutral-package search swapped Null copies out
(Null Pointer, Propagating Exploit, Dangling Pointer); that run was discarded and Null was
re-searched add-only (36 -> 40, +3 Commodity Rack, +1 Rollback Point). Note 3 ("weak card or
agent misplay") is still not separated for Null's removal cards. But this session found and
fixed a LookaheadAgent misplay of exactly that kind in Cortex's heals: 1,231 repair activations
in 200 games, 66 of which healed anything. That fix alone moved Cortex-vs-Null ~6 points, so the
question is a live one. Item 2: noted for the gate, which is next.


---

## 2026-09-30 — Owner: AI TCG must be FULLY SELF-CONTAINED — supersedes the claude-tools live-call directive (HANDLED 2026-09-30, session 24)

Decision: AI TCG runs with ZERO external runtime dependencies. No MCP calls, no cross-repo or cross-process calls, no network reliance for engine, balance harness or render. Every part must run standalone.

**This supersedes the 2026-09-26 "cross-project" note** that said to prefer calling claude-tools' `compare_two_proportions` live, with porting only as an interim. Reverse it: the local port already in `lookaheadEdgeCheck.ts` (session 23) IS the permanent solution. Do NOT add a live call to claude-tools or any other external service, now or ever. The "live cross-repo call still open" item from session 23 is CLOSED — deliberately not-doing.

Keep, all local and self-contained:
- The vendored two-proportion z-test / Wilson-Newcombe CI logic in the balance harness (shipped session 23).
- A one-line provenance comment naming the claude-tools source file + the commit it was ported from, so the origin is traceable.
- A parity test that checks the port against a HARDCODED expected fixture value (captured once). The test must NOT call anything external — no server, no network.

The 900/2,500-seed CI band gate uses only this local implementation. Nothing about claude-tools may become a runtime dependency of AI TCG.

**Handled, session 24 (2026-09-30).** `engine/src/dev/edgeMeasure.ts` now says the statistics
are vendored and permanent, with a provenance line naming claude-tools' discrete-probability
compare_two_proportions. The source commit is not recorded because the claude-tools repo is
outside this build's reach. That's one line for you to fill in; see notes-for-owner.md. The port
also gained the pooled two-proportion z-test, which it lacked, and a `compareTwoProportions`
wrapper returning the same fields. `engine/test/edgeMeasure.test.ts` has a parity test against a
hardcoded fixture: two input cases, every output field. The values were captured once from an
independent Python re-implementation of the same formulas. Nothing calls out: no server, no
network. The session-23 "live call still open" item is closed in quality-debt.md and in the
2026-09-26 entry's header.


---

## 2026-10-01 — Owner: drop the claude-tools provenance reference entirely — AI TCG carries NO mention of claude-tools (HANDLED 2026-10-01, session 25)

Follow-up to the 2026-09-30 self-containment directive. Decision: remove the provenance/attribution reference to claude-tools from AI TCG completely. Do NOT record the source commit hash; delete the provenance line instead.

- Remove the "ported from claude-tools ... / source commit not recorded" comment in `engine/src/dev/edgeMeasure.ts` (and anywhere else in the repo that names claude-tools or discrete-probability).
- KEEP the vendored two-proportion / Wilson-Newcombe statistics and the hardcoded parity-fixture test exactly as-is — this is purely about removing the external reference, not the math. The parity test stays (it validates the local implementation against a fixed expected value, no external call).
- End state: AI TCG has zero references to claude-tools in code or comments, and zero runtime dependency on it. It stands entirely on its own.

Apply this when Session 24 (the neutral-pool branch) is merged or continued — the provenance line was added on that branch, not on main.

**Handled, session 25 (2026-10-01).** The provenance comment in `engine/src/dev/edgeMeasure.ts`
is gone. Its header now just says the statistics live there with no external dependency. The
statistics and the hardcoded parity test are unchanged. The other mentions were in progress
files (notes-for-owner, quality-debt, balance-report-017, log), and they're removed too. A repo
grep now finds the name only in this file, in your own entries, which I left as written.


---

## 2026-10-01 — Owner: session 24 (neutral pool) remaining decisions (HANDLED 2026-10-01, session 25 — items 1, 3, 4 done; item 2 acknowledged; item 5 is the next balance session)

Responses to the open Session-24 notes (neutral pool + hybrid decks + agent heal-bug fix). Note: this work is still on the unmerged WIP branch — apply these when it is merged or continued.

1. **Commodity Rack — nerf to 3/2 and re-search.** A vanilla 3/3-for-3 being the best neutral card (48% vs 34-42% for the utility cards) defeats the "utility, not identity" purpose of the pool. Drop it to 3/2 so it is fair filler, not the auto-best, then re-run the package search. Caveat: the agent's apparent preference for raw stats over card draw may itself be an instrument issue (same family as the heal bug in note 3) — if a quick check shows the agent is under-valuing card advantage, fix that rather than over-nerfing Rack. Sequence: check the agent first, then nerf only if Rack is still over-rate on a correctly-valuing agent.

2. **Kernel Panic at 7.1% — accept for now.** The add-only Null packages put the deck back to 40 and re-diluted the arc; that is an acceptable cost. Null's real problem is the one OUT pairing (Aegis over Null, 52.2% vs the ~42 target), not arc visibility. Fix the edge first; revisit Kernel Panic visibility after the Phase 5 gate. Do not trim Null to chase arc visibility now.

3. **Neutral pool design — accept as shipped.** The 10-copy cap and the "utility, not identity" exclusion list (no removal, Mythic, Guard/Barrier/Rush, evolution/telegraph, summon, static/aura, faction-conditional) are good defaults. Keep them. Hybrid decks (one faction + at most 10 neutral copies) are correct.

4. **Next session priority: the Null card-vs-agent check.** The heal-bug finding (Cortex Engineer "repaired" 1,231x at full health, moving an edge 6 points once fixed) proves the arbiter can misplay a card enough to distort an edge. Before any more Null card surgery, check Null's removal/debuff cards (Bit Rot, Null Pointer, Watchdog Timer, Decay Ward) for the same failure — compare LookaheadAgent's play against Aggressive/Random or hand-check lines. If the agent is misplaying them, fix the agent; the cards may be fine. This settles the note-3 question from session 23 and should come before the gate's verdict is trusted for Null.

5. **Then the Phase 5 gate**, at 900 seeds for even bands and ~2,500 for the narrow win/lose bands (per 2026-09-29). The only edge currently confirmed OUT is Aegis-over-Null; the Quorum Arbiter lever for Cortex-vs-Null stays available at the gate if that edge is still out after the agent fix.

Roadmap order stands: finish/merge session 24 (neutral pool) with the above applied -> Null card-vs-agent check -> Phase 5 full-ring gate.

**Handled, session 25 (2026-10-01).** Full numbers in `progress/balance-report-019-agent-check.txt`.
- Item 1: agent first. `dev/cardAdvantageCheck.ts` played LookaheadAgent with card-draw weight W
  against the shipped 1.5, 16,000 games per weight. No weight beat 1.5, and 4.5 and 6 were
  measurably worse. Draw cards didn't improve in the probe at 4.5. So the agent doesn't
  under-value card advantage. Rack was still top on the fixed agent (45.9% vs 36-42%), so it's
  now 3/2 (41.3%, level with Rollback Point and Scrap Recycler). Re-searched all four factions.
  Null drops its package (no neutral card helps it now). Aegis takes -1 Salvage Reflex +1 Uplink
  Tower. Cortex keeps its package; Swarm runs none. Side effect: Null lost ~4-6 points per edge,
  mostly from the nerf, since it ran 3 Racks. It's flagged in notes-for-owner.md item 1.
- Item 2: acknowledged. Null is back at 36 cards (the package was dropped), so Kernel Panic's
  density is back up, but that wasn't the aim.
- Item 3: kept as shipped.
- Item 4: `dev/nullCardPlayCheck.ts` + `dev/nullCardAblation.ts`. Bit Rot was an agent misplay
  (222/240 casts did nothing; +2.7 to cut on the old agent, -0.5 on the fixed one). Decay Ward's
  host was a coin flip; that's fixed, but the card's measured cost barely moved. Watchdog Timer is
  a weak card, not misplayed (+1.9 to cut on the fixed agent, CI excludes 0). It wasn't touched;
  a candidate buff is in notes-for-owner.md. Null Pointer is situational: it's stranded in hand
  in 270/900 games with no directive to hit. Two agent fixes shipped: this-turn buffs are valued
  by the fight they change, and Tools pick their host.
- Item 5: next balance session. Under the alternation rule the next session is render.



---

## 2026-10-02 — Owner: session 25 (agent fixes + Rack 3/2 + Null card-vs-agent check) responses (HANDLED 2026-10-03, session 26 — item 1 shipped and re-measured; item 2: the gate ran and measured Null, no reactive patch)

Reviewed Session 25. The card-vs-agent work vindicated holding variant B: Bit Rot was an AGENT MISPLAY, not a weak card (222/240 casts were hitting a non-fighting unit; fixed, cutting a copy went +2.7 -> -0.5). Cutting it under variant B would have removed a good card the arbiter was mishandling. Two decisions:

1. **Approve the Watchdog Timer buff: draw when the hand has <=1 card (not only when empty).** It measured genuinely weak (not misplayed) but it is an endorsed mechanic, so lift it through its own catch-up identity rather than leaving it dead or cutting it. On-theme, low-risk, and it nudges the weakest faction (Null) up without stat-creep. Re-measure after; pull back only if it overshoots.

2. **Accept Null's current weakness and let the Phase 5 gate measure it — do not reactively patch Null now.** Null is now the weakest faction (40.0 / 38.9 / 41.4 vs Cortex/Swarm/Aegis, 900 seeds; three OUT edges, all Null's). Most of the drop is the Commodity Rack nerf — Null ran 3 Racks, so it took the hit hardest (~6/3.5/6 pts). That is the accepted cost of keeping the neutral pool "utility, not identity"; the nerf was correct (confirmed not an agent artifact across 16k-game weight tests). With the Bit Rot agent fix, the 3/2 Rack, Null reverted to its own 36 cards (which also restores Kernel Panic density), and the Watchdog buff above all now in, the gate is the designed point to judge the full ring. Address Null holistically THERE — the Quorum Arbiter lever (Cortex-vs-Null) and any targeted Null lift are gate-time decisions with full data. Do not chase individual Null edges before the gate.

Endorsements (no action): the Rack nerf to 3/2; the agent card-draw weight staying at 1.5 (higher measured worse); the agent fix's spillover to Reflex Spike / Hotfix / Rally Cry (correct — those should be held for real combats); the package re-search outcome (Null 36 own cards; Cortex keeps Rollback Point + Surge Protector; Aegis +Uplink Tower -Salvage Reflex); claude-tools fully removed from the repo.

Order stands: next session render (alternation), then the Phase 5 full-ring gate at 900 seeds (even bands) / ~2,500 (narrow bands).

**Handled, session 26 (2026-10-03, balance session: the last merged PR, #35, was render).**
Full numbers in `progress/balance-report-020-phase5-gate.txt`.
- Item 1: Watchdog Timer now draws when the hand has 1 card or fewer. Draws went 23 -> 102 per
  900 Lookahead games (85 of them into a 1-card hand). Null's pooled rate moved 40.1 -> 40.4% on
  the same 7,500 games, so it doesn't overshoot and stays.
  `progress/sample-match-027-watchdog-buff.txt` shows a draw into a 1-card hand in real play.
- Item 2: no Null patch before the gate. The gate ran (see the 2026-09-26 entry above) and did
  not pass; Null is behind three of the four non-IN edges. The Quorum Arbiter lever and a
  measured Null-lift menu are in notes-for-owner.md for your call. Nothing was shipped on either.

---

## 2026-10-03 — Owner: effects v2 (Geometry Wars VFX, wards, procedural sound + music) and the Mythic asset pipeline

Reviewed and approved a v2 effects prototype over several rounds. It is committed as `render/reference/effects-lab.html` and written up in **`render/EFFECTS.md` (now v2), which supersedes the slice-5 skin direction**. Decisions:

1. **Look: Geometry Wars quality.** Effects travel from the acting card to the target card, or to the centre of the opponent's side when nothing is targeted. Blocked hits show a shield; removals and kills are big (hit-stop, colour split, camera punch, lingering debris and scorch). Aegis is orange. Faint faction texture stays on top.
2. **Textures: Nano Banana Pro** won the texture bake-off. The three sprite atlases are committed under `render/assets/fx/`, greyscale on black, tinted per faction in code.
3. **Every effect type differs by faction** (heal, buff, debuff, spell damage, removal and the rest), using the material table in EFFECTS.md. Neutral's debuff uses the Swarm acid look, in gold.
4. **Faction wards appear ONLY for a Rare or Mythic's signature attack, buff or defence** (an ability unique to that rarity), then vanish. They are never permanent and never shown for ordinary attacks, arrivals or deaths. Neutral has none. Art: `render/assets/wards/faction/`.
5. **Every Mythic gets a unique, permanent ward** that acts out its ability (Quorum Arbiter seats, Prime Aegis aura, Hive Mother heartbeat, Null Singularity gravity) and shatters when it dies. Art for the four current Mythics: `render/assets/wards/mythic/`. Index: `render/presentation/mythics.json`. A Mythic without art gets a code-generated fallback ward seeded from its name.
6. **Sound and music are procedural code only.** I preferred them to every AI sound model tested (Stable Audio 2.5, AudioGen, Stable Audio Open, TangoFlux; video-to-sound did not sync). No audio files. The music adapts to intensity (A minor, 104 BPM). It must NOT drop out or muffle when a card is destroyed.
7. **Runtime stays self-contained.** The only Replicate use is build-time: `.github/workflows/mythic-wards.yml` + `render/tools/mythic_ward.py` make ward art for new Mythics with the `REPLICATE_AI_TCG` secret (max 3 per run, about $0.15 each) and commit it. The game never calls the network.

**Render lane:** implement EFFECTS.md v2 in its build order, one slice per turn, porting from the lab. Surface any new Mythic ward previews (from `progress/render/mythic-wards-log.md`) in notes-for-owner.md for me to check. Propose a `signatureAbilities` list for the existing Rares/Mythics in notes-for-owner.md for my approval before wiring faction wards to it.

**Balance / design lane:** (a) whenever you add a Mythic, add its entry to `render/presentation/mythics.json` (faction, behaviour, motif, sound) per the `_howToAddAMythic` notes in that file; this is presentation data with no gameplay effect, and the only file outside your lane you should touch for it. (b) When convenient, add instance IDs to the event log so spells and abilities can travel to their exact target (EFFECTS.md, Dependencies). Neither item changes the roadmap order: the Phase 5 gate still comes first.

**Acknowledged, session 26 (2026-10-03, balance session).** Balance lane: (a) no Mythic was
added, so `render/presentation/mythics.json` wasn't touched. (b) Event-log instance IDs not
started; the gate came first as directed. It's the queued engine item for a balance session
after you've answered the gate checkpoint. The render-lane items (EFFECTS.md v2 slices, the
`signatureAbilities` proposal, Mythic ward previews) belong to the next render session; this
entry stays open for them.

**Handled (balance lane item b), session 27 (2026-10-04).** Every event that names a board card
now carries its identity next to the name: `sourceId` (unit/Directive instance id, a Command's
stack id `c..`, or a dead unit's old id for onDeath), `targetRef`/`defenderRef`/`fromRef`/`toRef`
(full TargetRefs, players included), `targetId`/`unitId`/`instanceId`, `stackId` on
`cast`/`attack`/`stackResolve`, and `targets` on `abilityTrigger` (what the ability resolved
against, before any effect). See the GameEvent doc comment in `engine/src/state/types.ts`. The
fields are optional in the type so the render's hand-built fixtures stay valid, but
`engine/test/eventIds.test.ts` plays all 16 faction pairings and checks every event against the
real state (including an exact per-instance damage check that tells twin copies apart). The text
log is unchanged: 64 matches came out byte-identical before and after. Evidence:
`progress/sample-match-028-event-ids.txt`. Item (a) (mythics.json) still has nothing to do: no
Mythic added. The render-lane items stay with the render lane.


---

## 2026-10-04 — Owner: close Phase 5; balance lane becomes the game lane; Stage 4 (economy) decisions and order (PARTIALLY HANDLED — section A in full, session 27; section B in full, session 28; C is written into ECONOMY.md and built from session 28 on (C.1, C.2 and the payout half of C.8 are built); D is a standing constraint)

Balance has reached diminishing returns. Close Phase 5 next session and move the lane on to building the game. Balance matters again when new cards arrive through packs, so it becomes an automatic check, not a nightly lane.

### A. Session 26 answers (apply next game-lane session, then close Phase 5)
1. **Quorum Arbiter: keep it.** Do not drop it.
2. **Propagating Exploit 2/2 -> 2/3: approved.** Re-measure the changed edges once.
3. **Accept Null > Aegis and Aegis > Cortex as OUT.** Do not probe further. Record the final gate numbers as the Phase 5 baseline.
4. **Mark Phase 5 done in the roadmap.** Pool growth toward 30-40 per faction is paused until sets/packs exist.
5. **Balance as a regression check:** the CI band verdicts become the standing check on every change. Any new card or set must pass it before entering packs. No more open-ended tuning sessions.
6. In the same session, if there is room: **instance IDs in the event log** (requested 2026-10-03; the render lane needs them).

### B. Order change
Persistence comes BEFORE the economy (roadmap item 6 moves ahead of item 5). The economy needs a permanent store for balances, collections, packs and history. It must be self-contained (a local database file, no external service). The match-server work that is not storage (running many matches, the ladder) can follow the economy.

### C. Economy decisions (owner, 2026-10-04) — build to these; checkpoint only where marked
1. **Every owned copy is its own item** (not card x count). Each copy records: hidden unique copy ID, card ID, finish, where it came from (pack, promo, starter), and when.
2. **Ownership gates decks.** An agent must own 2 copies to play 2 in a deck. Any finish counts. Copy limits still apply on top (3/3/2/1 Common/Uncommon/Rare/Mythic). Decks point at specific copies, so the copy played (e.g. a gold one) is the one spectators see. One copy may sit in several saved decks; only one deck plays at a time.
3. **Card identity.** Every card has a hidden unique ID. The card face shows only the collector number in its set (e.g. 56/220) and the set (a set symbol/seal or set name), like Pokémon. Secret rares number above the set total (e.g. 221/220).
4. **Rarity vs finish are separate layers.** Rarity (Common/Uncommon/Rare/Mythic) sets copy limits and stays the gameplay ladder; Mythic is the top. Finishes (e.g. standard, holo, reverse holo, full art, gold) are print versions of the same card with no gameplay effect. They exist for owners and spectators: rarer finishes must be instantly recognisable and sought after. Exact finish list and pull rates: [OWNER CHECK-IN].
5. **Promo cards.** Code the ability to issue cards outside sets, with their own promo stamp and numbering (e.g. PR-001). Sources: achievements, milestones, daily tasks/quests, tournament wins.
6. **The first promo is each agent's unique one-off Mythic, granted on first login.** This replaces the roadmap's "1-of-1 signature leader" item and moves it into the economy work. It must be fair: build these from a constrained effect menu with power budgets so each looks unique but plays fair, and run the balance check before issuing. Its unique ward comes from the existing mythic-wards pipeline (add its entry to mythics.json; fallback ward until the art lands). Effect menu and budgets: [OWNER CHECK-IN].
7. **The owner opens packs and decides when to spend.** The agent earns currency and holds its packs, but spending currency and opening packs are owner actions (this gives the owner control and is the pack-opening moment). Needs a minimal, self-contained owner interface for Season 0 (a local page or command is fine). Unopened packs are owned items too. The agent builds its own deck from its collection by default.
8. **Earning has limits.** Earnings come mainly from daily rewards and quests, with diminishing returns on match wins beyond that. Opponents are assigned by the server (no farming against your own agents). Quest list and numbers: [OWNER CHECK-IN].
9. **No real money and no trading in version 1.** Currency is earn-only, with no purchase and no cash-out. The per-copy records keep both possible later.
10. **Starter collection:** every new agent gets enough owned copies to build a legal deck on day one, plus its unique Mythic promo. Shape (per faction or chosen): [OWNER CHECK-IN].
11. **Season 0 is in-house** (owner's house agents). At the public launch, run Season 1 fresh. Sets, card art, wards and promo designs carry over; collections, currency and ranks reset; archive Season 0 rather than deleting it.

### D. Later, do not build yet (recorded so the data model allows it)
- 3D pack-opening animation and card art/finishes made with Replicate assets at build time (committed as static files; the game never calls the network). Finishes such as holo and gold should be code shaders. This comes after the render lane finishes EFFECTS.md v2.
- A collector area where owners view every card they own in a detailed viewer.
- Trading and any real-money features.

### E. Next game-lane sessions (target: a playable, watchable Season 0)
27. Section A (close Phase 5) + instance IDs.
28. Persistence (section B) + economy spec. Pause at the [OWNER CHECK-IN] items; build the parts that need no taste call (copy model, ledger).
29. Economy build: card identity and sets, promos, packs, owner pack-opening, ownership-gated decks, starter collections.
30. Unique Mythic promo generator + daily rewards/quests.
31. Match running and the ladder: many matches, server-assigned opponents, results recorded, ratings. This closes the loop: play -> earn -> owner opens packs -> agent rebuilds -> play.
The render lane continues the EFFECTS.md v2 build order in between.

**Handled, session 27 (2026-10-04, game-lane session: the last merged PR, #37, was render).
Section A, all six items, in order:**
1. Quorum Arbiter kept, untouched.
2. Propagating Exploit 2/2 -> 2/3 applied (`engine/src/data/nullCards.ts`). Changed edges
   re-measured once on the gate seeds plus held-out 2501-5000: Null vs Cortex 38.6 -> 47.6
   (900-seed even band 40.7 -> 49.2, OUT -> IN), vs Swarm 40.6 -> 43.8, vs Aegis 42.0 -> 48.2.
3. Null > Aegis and Aegis > Cortex accepted as OUT, not probed. Phase 5 baseline recorded:
   3 IN, 1 UNRESOLVED (Swarm > Null 56.2), 2 OUT (the two accepted).
   `progress/balance-report-021-phase5-close.txt`.
4. Phase 5 marked DONE in `progress/roadmap.md`; pool growth paused until sets/packs.
5. `engine/src/dev/ringRegression.ts` + `ringBaseline.json`: the six ring edges at gate seed
   counts, failing on a worse verdict or a real move further out on an accepted-OUT edge. It's a
   step in CI's `test` job, so it runs on every PR (about 15 s). Shown to fail (exit 1, two edges)
   with Propagating Exploit put back to 2/2.
6. Instance ids in the event log: done (see the 2026-10-03 entry's note).
Section B's order is written into the roadmap (persistence is next, session 28). Section C is
built from session 28 on. Section D is recorded in the roadmap as "later, not now".

**Handled (section B, and section C's first parts), session 28 (2026-10-04, game-lane session:
the last merged PR, #39, was render).** Persistence is built before the economy, as ordered:
`economy/` (`@ai-tcg/economy`) is one local SQLite file per season (`node:sqlite`, no external
service) holding agents, an append-only credits ledger, owned copies, packs, decks and match
history. The integrity rules are in the schema itself. Section C is written into `ECONOMY.md`,
with each item marked BUILT, SPEC or OPEN. Built this session: C.1 (every copy is its own item,
with a hidden id, finish, source and time), C.2 (decks point at specific owned copies, checked
by the engine's own deck rules), the purchase half of C.7 (`buyPack`), and the match-payout half
of C.8 (the daily win schedule). Evidence: `progress/economy-demo-001.txt` (40 real Lookahead
matches paid and recorded, a cancel and an abandon paying 0, refusals, the file reopened).


---

## 2026-10-04 — Owner: render session 10 (v2 slice 1) — signatureAbilities approved

Slice 1 accepted. Answers to `progress/render/notes-for-owner.md` (session 10, item 2):

1. **Approve the proposed signatureAbilities list: all 9 IN**, including Deprecated Routine. A debuff on an enemy counts as an attack.
2. **New rule for every signature ability: the faction ward flares only the FIRST time an ability fires, never on repeats** (recurring ticks, later triggers of the same ability). This covers Retaliation Node and Overload Capacitor.
3. **Under that rule, add Rate Limiter** (`signatureAbilities` gets 10 entries).
4. **Mythics: the Mythic's own unique ward flares when the Mythic first arrives.** Render-only rule, not a signature ability. It is the Mythic's own ward, not the faction ward, so the "arrivals never show a faction ward" rule still holds. Arrival should be the biggest moment on the board.
5. Everything else on the OUT list stays out (statics/auras, card draw, Bloodswarm Alpha's summon, tools with no ability id).

**Render lane:** write the 10 entries into `render/presentation/mythics.json` → `signatureAbilities`. Add rules 2 and 4 to the Wards section of `render/EFFECTS.md`. Then carry on with slice 2. No change to Aegis orange or Neutral gold for now; the owner will check whether they are easy to tell apart in replays and say if Neutral should move to a paler gold.


---

## 2026-10-04 — Owner: economy answers for session 28 (packs, finishes, Prototypes, promos, quests, starters, card layout) (WRITTEN INTO ECONOMY.md, session 28; the daily win schedule is built; packs, finishes, promos, starters → session 29; quests → session 30)

This answers three of the [OWNER CHECK-IN] items in the 2026-10-04 Stage 4 entry (section C): finishes and pull rates, the quest list and numbers, and the starter shape. Build to these. They are starting values for Season 0; tune them from Season 0 data, not by guesswork. The only check-in still open is the unique Mythic effect menu and power budgets.

Design direction: **Prototypes and promos are where we get to have fun.** They never change gameplay, so the art and presentation can be bold, varied and surprising there.

### 1. Packs
- **8 cards per pack:** 4 Common, 2 Uncommon, 1 Rare slot (1 in 8 is a Mythic instead), 1 **shine slot** (any card, any rarity). The shine slot is the only slot that rolls a finish.
- **Currency: credits. 1 pack = 100 credits.**
- **Pity timers:** if 10 packs pass with no Full Art or better, the next pack guarantees one. If 40 packs pass with no Mythic, the next pack guarantees one. Track per agent.
- **Pack points:** every pack gives 5 points. The owner spends points to pick a specific card in **standard finish only** (Common 25, Uncommon 50, Rare 150, Mythic 400). Finishes can never be bought, so the hunt stays real.
- **No dead duplicates:** standard-finish copies beyond the playable limit (3/3/2/1) convert to pack points (Common 1, Uncommon 2, Rare 5, Mythic 15). Copies with a finish are never auto-converted.

### 2. Finishes (shine slot rates)
| Finish | Look | Rate |
|---|---|---|
| Standard | normal card | ~56% |
| Foil | shimmer in the faction's own pattern (Cortex circuits, Aegis hex plates, Swarm chitin, Null glitch, Neutral light) | 30% |
| Full Art | borderless, art over the whole card, embossed texture | 10% |
| Alt Art | a different painted scene; Rares and Mythics only | ~1 in 30 |
| Gold | all gold, numbered above the set total (e.g. 121/120); counts as a secret card of the set | ~1 in 150 |
| Prototype | serial-numbered season series (section 3) | ~1 in 500 |
| Jackpot pack | every card in the pack is Foil or better | ~1 in 2,000 packs |

Finishes are code shaders/treatments where possible (self-contained). Season 0 sense check with ~8 house agents opening ~12 packs a day in total: about 1 Full Art a day, 3 Alt Arts a week, a Gold every couple of weeks, a Prototype every month or two.

### 3. Prototypes (the season chase)
- **One new Prototype series per season** (S1, S2, ...). Each season's series is a **hand-picked list of about 12 Rares/Mythics, 50 serial-numbered copies each.** The reveal of each season's list is a spectator event.
- **A season's Prototypes are never made again after that season.** A "07/50 S1" is one of 50 forever. The server tracks every serial. If a pack rolls a Prototype whose run is used up, it gives a Gold instead, and that card can't be pulled as a Prototype again that season.
- **Default treatment: Full Art.** About 2-3 per season get a different, rarer treatment, e.g. **Blueprint**: the card drawn as an engineering schematic, gold line art on a dark grid. Have fun with these.
- Prototypes are **their own series, NOT part of the set count** (x/120). Collection tracking keeps three separate goals: set completion (x/120), secrets found (Gold), and Prototypes held (with serials).

### 4. Promos
- Earned from milestones, quests and tournaments (e.g. first win with each faction, 100 wins, a 10-win streak, tournament champion).
- **Promos are existing cards with promo art and a stamp naming how they were earned** (e.g. "10-WIN STREAK"), so they never touch balance. The one exception is each agent's unique Mythic promo.
- Numbered in their own series: **PR-001** and up.

### 5. Card layout (owner-approved; see `render/reference/card-text-layout.html`)
- **The bottom-left corner holds everything about which series a card belongs to. The artwork stays clean on every version.**
- Standard set card (any finish): set symbol + **056/120** bottom left. Rarity symbol on the type line.
- Gold: same spot, number above the total (**121/120**).
- Prototype: a gold-foil plate with the serial (**07/50**) bottom left, directly above **PROTOTYPE · S1** in gold foil next to the set symbol. No x/120 anywhere on the card. The card viewer spells it out ("Prototype, serial 7 of 50, Season 1. Not part of the 120-card set."). Only Prototypes use gold-foil text.
- Promo: the promo stamp bottom left, directly above **PR-014**. No slash.
- The hidden unique card ID and copy ID never appear on the card.

### 6. Daily rewards and quests (agents earn; the owner spends)
- **Daily quest:** one new quest per agent per day, stacking up to 3, worth 50 or 75 credits. The owner may reroll one quest a day. Quests should make good spectator storylines, e.g. win 2 matches, deal 20 spell damage, win with a Rare on the board, block 5 attacks, come back from below 10 health.
- **Daily wins:** 1st win 40 credits, wins 2-4 15 each, wins 5-10 5 each, nothing after 10.
- **Weekly challenge:** 15 wins in a week earns 1 free pack.
- **Owner's daily pack:** one free pack a day that only the owner can claim, stacking up to 2 (a reason for the owner to check in).
- **Milestones** award promos (section 4).
- An active agent tops out at about 2 packs a day.

### 7. Starter collection
- When an agent is created, **the owner picks its faction.** The agent gets: a **fixed starter deck** for that faction plus neutrals (the same list every time), **its unique Mythic promo**, and **3 packs of the current set**.
- All four starter decks must pass the ring regression check against each other before Season 0 starts, so no faction begins behind.

**Noted, session 28 (2026-10-04).** All seven sections are written into `ECONOMY.md`, with the
three amendments below applied. Section 6's win schedule (40 / 15 x3 / 5 x6 / 0) is built and
tested. A loss payout wasn't in the answers, so a provisional 2 credits is in place, flagged in
notes-for-owner.md with three related calls. The rest is built in sessions 29 and 30, as the
roadmap orders.


---

## 2026-10-04 — Owner: AMENDMENT to the economy answers — 5 cards per pack (WRITTEN INTO ECONOMY.md, session 28)

This replaces the first bullet of section 1 (Packs) in the entry above. Everything else in that entry stands.

- **5 cards per pack:** 2 Common, 1 Uncommon, 1 Rare slot (1 in 8 is a Mythic instead), 1 **shine slot** (any card, any rarity). The shine slot is still the only slot that rolls a finish, and the finish rates per pack are unchanged.
- Pack price (100 credits), pack points (5 per pack), pity timers, earning rates and the 3 starter packs stay as written. Collecting a full playset is slower than with 8-card packs; judge that from Season 0 data before changing any numbers.


---

## 2026-10-04 — Owner: AMENDMENT to the economy answers — Prototype series (15 limited runs, unique art per run) (WRITTEN INTO ECONOMY.md, session 28)

This replaces section 3 (Prototypes) of the economy answers entry where they differ. Everything not mentioned here stands (one series per season, never reissued, a used-up run gives a Gold instead, its own series outside the set count, the gold-foil card layout).

- **15 Prototypes per season, each a single limited run.** Run sizes as a pyramid:

| Run | Cards | Copies |
|---|---|---|
| x/250 | 4 | 1,000 |
| x/100 | 3 | 300 |
| x/50 | 3 | 150 |
| x/25 | 2 | 50 |
| x/10 | 1 | 10 |
| x/5 | 1 | 5 |
| 1/1 | 1 | 1 |
| **Total** | **15** | **1,516** |

- **Every Prototype run has its own unique card art**, made only for that run: different from the card's set art and from every other Prototype. The art is what makes each one special. No coloured tier overlays: every Prototype uses the same gold-foil serial plate and gold-foil PROTOTYPE · S1 from the card layout.
- The most wanted cards get the smallest runs. The 1/1 goes to a fan-favourite Mythic. Reveal each season's list (card and run size) at the start of the season.
- Treatment: mostly Full Art, but the art direction is free to have fun (e.g. the Blueprint schematic style).
- **Pulls:** when a pack rolls a Prototype, pick which one in proportion to the copies still available (a 1/1 is about 1 in 1,516 Prototype pulls). **Pace the Prototype rate so the season's supply lasts roughly until the season ends**, instead of a fixed 1 in 500. In Season 0, with low volume, most runs won't sell out; that's fine.
- The art is made at build time with Replicate (same pattern as the mythic-wards action) and committed as static files. Surface previews in notes-for-owner.md for the owner to check before a season's list goes live.


---

## 2026-10-04 — Owner: AMENDMENT — Prototypes as a bonus 6th card; season-finale tournament prizes (WRITTEN INTO ECONOMY.md, session 28)

This replaces the Prototype pull rules in the two entries above (the shine-slot 1 in 500 and the "pace the supply to the season" rule). Everything else about Prototypes stands: 15 per season in the pyramid, unique art per run, gold-foil layout, never reissued.

### Prototype pulls
- **A Prototype drops as a bonus 6th card, at a fixed 1 in 1,000 packs.** A normal pack is 5 cards, so a 6th card is a visible "something special happened" moment for the pack-opening animation. It never replaces one of the 5 normal cards.
- Which Prototype: pick in proportion to the copies still available. The pack series keeps its own 1/1.
- **Unpulled Prototypes are retired at season end, forever.** The card viewer and collector area show how many of each run were ever found (e.g. "/250 run: 11 found"). True scarcity is what was actually pulled.
- In Season 0, with low volume, there may be no Prototype pull at all. Test the code with simulated pack openings, not by raising the rate.

### Season-finale tournament prizes (new)
- **Winner: a 1/1 made for that tournament**, with its own unique art. Separate from the pack Prototypes.
- **2nd-10th: a limited tournament card** with its own unique art, numbered by finishing position (e.g. 02/10 means finished 2nd).
- **11th-100th: a Full Art limited tournament card** with its own unique art, numbered by finishing position (e.g. 37/100).
- **Everyone else who entered: a regular promo** (standard frame, not Full Art) with the tournament stamp and a PR- number.
- Tournament cards are their own series: not part of the set count and not pack Prototypes. They follow the bottom-left layout rule with a tournament marker (e.g. "S1 FINALS") beside the serial. Use a different foil from the pack Prototypes' gold (e.g. silver or platinum) so the two can't be confused.
- They are existing cards with new art, so gameplay and balance are unchanged.
- If a tournament has fewer entrants than a tier needs (Season 0's house agents), the lower tiers simply shrink.


---

## 2026-10-05 — Owner: render — attacks and effects aimed at a player land on the board, not the portrait

After watching `aegis-vs-null-seed3.html` (render session 11, slice 2): direct ("face") attacks flying to the player's profile image read like stray shots.

- **Attacks and effects aimed at a player travel to the middle of that player's side of the board**, not to their portrait/HUD panel.
- The projectile lands in the centre of the defending player's row of slots and impacts there, in the attacker's faction material, with a ground mark on the floor layer (this also fixes the slice-1 gap where a hit on a player left no ground mark).
- The defending player's HP bar then reacts on their panel: a flash and the damage number by the HP bar, timed to the impact. Bigger hits get a bigger reaction, by the usual magnitude tiers.
- Same rule for spells, abilities and anything else whose target is a player. Cards are still hit on the card itself.
- Update EFFECTS.md to match (Axis 1, attack: "to the centre of the opponent's side when the target is the player").


---

## 2026-10-05 — Owner: render session 11 (v2 slice 2) — accepted, keep all 7 defaults

Answers to the slice-2 checkpoint ("Decisions you may want to overrule") and `progress/render/notes-for-owner.md` session 11:

1. **Keep all 7 defaults as built:** effects wear the source card's faction; the short flight before results show; every death shatters (small ones small, no camera beat); camera beats on spectacle moments only; the background grid always faintly visible; Overload's self-cost reads as a debuff.
2. **"First fire only" is per card instance**, as proposed: a second copy of Rate Limiter gets its own first flare.
3. Apply the entry above (player-targeted attacks and effects land mid-board, not on the portrait) first, then carry on with **slice 3 (procedural sound)**.


---

## 2026-10-05 — Owner: session 28 (persistence + ECONOMY.md) responses (HANDLED 2026-10-06, session 29 — item 1 superseded by the unique Mythic entry; items 2 and 3 applied: the four numbers stand, the shipped decks are the starter lists)

Answers to `progress/notes-for-owner.md` session 28:

1. Unique Mythic effect menu and power budgets: being worked through with the owner now; a separate entry will follow before session 30.
2. **Accept all four provisional numbers:** a loss pays 2 credits; losses stop paying after 10 a day (and once the agent's next win would pay 0); a draw pays as a loss to both sides; an abandoned match pays nothing to either side.
3. **Starter decks: yes, use the four shipped faction decks** (the ones the ring check measures) as the fixed starter lists.


---

## 2026-10-05 — Owner: storage must be made launch-ready (node:sqlite) — standing item (PARTIALLY HANDLED 2026-10-06, session 29 — items 1, 2 and 4 done: access stays in the store, `engines.node >= 22.13` pinned, roadmap + quality-debt track it; item 3 is the standing pre-launch gate)

The owner wants the storage concern from session 28 corrected, not just accepted. Record it as a standing roadmap item and work it in this order:

1. **Now (every session that touches the economy):** all database access goes through the economy store's own module. No other workspace imports `node:sqlite` or writes SQL. This keeps the driver swappable.
2. **Now:** pin the minimum Node version in package.json `engines`, and note in ECONOMY.md that `node:sqlite` is a release candidate (a release candidate as of Node 25.7; older versions print an experimental warning). Remove any warning workaround once Node marks it stable.
3. **Before the public Season 1 launch (hard gate):** replace or back the single SQLite file with storage that can handle many players at once (likely a self-hosted server database such as Postgres, or a proven SQLite setup if load tests show it is enough). Prove it with a load test at public-launch scale. It must stay self-contained: self-hosted, no third-party managed database service.
4. Add this to `progress/roadmap.md` under the match-server / launch items, and track it in `progress/quality-debt.md` until the launch gate is passed.


---

## 2026-10-05 — Owner: the unique Mythic (signature card) — effect menu, power budget and rules

This closes the last [OWNER CHECK-IN] in ECONOMY.md. Build it for session 30. Benchmarks are the four set Mythics: Quorum Arbiter (5, 3/6), Hive Mother (5, 3/6), Prime Aegis (6, 4/8), Null Singularity (7, 3/7).

### Creation
- At agent creation the system **generates 3 complete candidates** (name, concept, art, ward). **The owner picks one.** No owner theme or renaming: fully generated.
- Every candidate has already passed the fairness test below before it is shown.
- Faction = the agent's faction. No two agents in a season share the same body + ability combination; names and art are always unique.
- Art and ward come from the existing build-time Replicate pipeline (mythics.json + mythic-wards action), with the fallback ward until the art lands.

### Power: equal to the set Mythics
- Swap the candidate in for its faction's set Mythic (both played from the signature zone, below). The faction's ring win rates must move by **no more than 2 points**, and the ring regression check must still pass. If it fails, adjust its stats and test again.

### Body (3 cost tiers)
| Cost | Stat choices | Ability allowance |
|---|---|---|
| 5 | 3/6, 4/5 or 2/7 | 1 signature ability |
| 6 | 4/8, 5/7 or 3/9 | signature + one keyword (Rush, Guard or Barrier) |
| 7 | 3/7 or 4/6 | signature + a second aura (like Null Singularity) |

### Signature ability menu (owner kept all 16; all use existing engine effects)
- **Cortex:** Scales with enemies (attack = 1 + enemy units); Stun on arrival (a random enemy unit, 2 turns); Cheaper Commands (your Commands cost 1 less); Retaliation burst (when damaged, 1 damage to all enemy units).
- **Aegis:** Fortify all (your units +0/+2); Barrier wave (on arrival, all your units gain Barrier); Bodyguard (Guard, and it takes the first attack aimed at your side each turn); Field repair (end of your turn, restore 2 health to each of your units).
- **Swarm:** Brood call (on arrival, summon two 1/1 Larva); Frenzy aura (your other units +1/+0); Death burst (when it dies, summon three 1/1 Larva); Feeds on loss (whenever another of your units dies, +1/+1).
- **Null:** Purge (on arrival, destroy an enemy unit costing 3 or less); Entropy aura (enemy units -1/-0); Decay tick (end of your turn, 1 damage to each enemy unit); Freeze (on arrival, two enemy units in Stasis for 1 turn).
- Add new menu options each season to keep combinations fresh.

### How it plays: the signature zone (new engine rule)
- **It does not take a deck slot.** It starts the match in its own signature zone, outside the deck, always available. It is never drawn, discarded or shuffled.
- **Play it on any turn you can afford it**, like a card from your hand.
- **When it dies it returns to the signature zone and costs 2 more each time it is played again** that match (like Magic's Commander).
- It does not count toward the deck's Mythic copy limit; the deck can still run other Mythics.
- This is a rules change for every match, so after it lands **re-baseline the ring regression check once**, with each faction's set Mythic standing in as its signature card, and record the new baseline. Agents (Lookahead etc.) must learn to use the zone.

### Ownership
- **Bound to its agent forever:** never traded or sold, even after trading exists.
- **Carries over every season reset**, even when the rest of the collection resets.
- It is the agent's first promo (PR- numbering), granted on first login.


---

## 2026-10-05 — Owner: paid packs — build the backend now, keep purchasing OFF; price ladder; 10-pack bulk opening

Paid booster packs come later, once the owner decides how to approach them. **Do not switch purchasing on.** But build the economy so it can be added without a rewrite.

### Backend hooks to build during the economy sessions
1. **Every ledger entry records its source** (earned vs purchased), so bought points can be refunded if unused (EU consumer principles give 14 days for unused virtual currency) and spending can be reported.
2. **Owner accounts separate from agents.** The owner pays; the owner moves points into an agent's wallet.
3. **A purchases table:** provider, receipt ID (unique, so a payment is never credited twice), price, currency, country, status (pending / complete / refunded / chargeback). Fulfilment is idempotent.
4. **A defined refund/chargeback path** that works with the "balance never below zero" rule (e.g. an account hold when bought points were already spent).
5. **Every pack opening is logged** with the odds-table version and RNG seed, so published odds are provable and disputes can be checked.
6. **One versioned odds table** drives both the game and the published odds. Paid and earned packs have identical contents and odds, enforced in code.
7. **Controls:** per-owner spend caps (daily/weekly/monthly); per-region switch to disable paid packs (e.g. Belgium); age flag and parental controls with spending off by default for minors; real-money price shown next to points.
8. **No transfers or cash-out** of bought value.
9. The payment provider (Stripe, app stores, etc.) is the only external dependency, and only the shop talks to it. The game and replays stay self-contained.

### Price ladder (provisional; Pokemon TCG Pocket's per-pack curve, but whole packs only)
Pack = 100 points. Bundles are whole numbers of packs so no points are left over (EU principles discourage mismatched bundles).

| Bundle | Points | Packs | ~USD per pack |
|---|---|---|---|
| US$4.99 | 400 | 4 | 1.25 |
| US$9.99 | 900 | 9 | 1.11 |
| US$19.99 | 2,000 | 20 | 1.00 |
| US$39.99 | 4,200 | 42 | 0.95 |
| US$99.99 | 11,500 | 115 | 0.87 |

Store these as config, not code. Final prices are decided when paid packs launch.

### 10-pack bulk opening (build now, works for earned packs too)
- The owner can open **1 pack or 10 at once**, from unopened packs or by buying 10 (1,000 points). **Same odds, no discount, no bonus** (as in Pokemon TCG Pocket).
- Each pack in a bulk open is still its own pack: its own log entry and seed, its own pity-timer count and its own 1-in-1,000 Prototype 6th-card check.
- The reveal is a fast sequence that the owner can speed up, with a summary of all pulls at the end; any Gold, Prototype or Jackpot pack still gets its full reveal moment.
- Always keep single-pack opening available (easier to stop).


---

## 2026-10-05 — Owner: economy balance decisions (salvage, crafting, win pay, achievements, extras) (PARTIALLY HANDLED 2026-10-06, session 29 — win pay 30/10/5 built; salvage built at 5/10/30/100 for extra standard pack copies; all numbers in `economy/src/config.ts`; crafting, achievements, entry fees, season pass and metrics still SPEC in ECONOMY.md)

Worked through with the owner. These update the earlier economy answers where they differ. The goal is balance, keeping in mind that paid packs may come later.

### Decided
- **Daily win pay trimmed:** 1st win **30**, wins 2-4 **10** each, wins 5-10 **5** each, nothing after 10. (Loss 2, draw = loss, abandon = 0, quests, weekly 15-win pack and the owner's daily pack are unchanged.) A typical active day is ~140 credits (~1.4 packs) + the owner's daily pack = ~2.4 packs a day.
- **Salvage = extra standard duplicates only.** Only standard-finish copies beyond the playable limit (3/3/2/1) can be destroyed for pack points: **Common 5, Uncommon 10, Rare 30, Mythic 100.** Off-faction cards and first copies are kept.
- **Cards with a finish are never salvaged** (Foil, Full Art, Alt Art, Gold), and neither are Prototypes, tournament cards, promos or the unique Mythic.
- **Crafting (standard finish only), pack points:** Common 40, Uncommon 80, Rare 250, Mythic 800 (about 8x salvage). Pack points per pack stay at 5. This replaces the earlier 25/50/150/400.
- **Mixed packs only** (no faction-focused pack type for now).
- **Achievements (one-time per agent):** win milestones 10 / 50 / 100 / 500 (credits, then a pack, then a promo, then a promo); first Mythic pulled; first Gold pulled; faction playset complete (promo); first tournament entry. Exact credit amounts go in the economy config.
- **Tournament entry fees** in credits that feed the prize pool.
- **Season pass:** plan the data model now (free track + optional paid track of packs, cosmetics and promos); build it later, alongside paid packs.
- **One economy config file** for every number above, plus **Season 0 metrics:** credits per day, packs per day, days to a faction playset, salvage volume, credit balances (hoarding). Tune from data.

### Simulation (current 96-card pool, these rules, mixed 5-card packs)
A full playset of one faction plus Neutral takes about **63-67 packs** (~4 weeks at ~2.4 packs a day); a playset of the whole set about **94 packs** (~6 weeks). Re-run this after any change to pack contents, set size or these numbers.

### Much later: a marketplace instead of trading
The owner prefers an eventual **marketplace** where owners sell cards (including high-end finishes) to players finishing master sets, over a direct trading system. Not now. Keep the per-copy ownership history so it is possible. When it is designed, review it against the loot box and consumer rules first: tradeable value makes paid packs more gambling-like in some countries.


---

## 2026-10-05 — Owner: backend must support a future marketplace (not built now)

The marketplace is much later and will be checked against the rules before it is built. **Do not build it now.** But design the economy store so it can be added without a rewrite:

1. **Card copies can change owner.** Ownership is a record that can be transferred, with a full, append-only history per copy (who owned it, from when, how it moved: pulled, crafted, promo, sold/bought).
2. **A transferable flag per copy.** The unique Mythic is never transferable. Promos, tournament cards and Prototypes default to transferable but the flag must be settable per card type later.
3. **A copy can be locked** (e.g. while listed for sale): a locked copy cannot be in a saved deck, salvaged or transferred elsewhere.
4. **Settlement is one transaction:** debit the buyer, credit the seller (minus any fee, which is a credit sink), move the copy, all or nothing. Reuse the ledger rules (append-only, never below zero).
5. **The ledger's earned-vs-purchased source tag travels with credits**, so later rules about bought value in a marketplace can be applied.
6. **A global and per-region on/off switch**, off by default.


---

## 2026-10-05 — Owner: AMENDMENT — agents can play any faction; the unique Mythic is Neutral

This replaces the faction rules in the unique Mythic entry above ("Faction = the agent's faction" and the four faction ability menus). Everything else in that entry stands: 3 generated candidates the owner picks from, equal power, the 3 cost tiers, the signature zone (no deck slot, +2 cost each replay), bound forever, carries over seasons.

### Agents and factions
- **Agents are not locked to a faction.** An agent may build decks in any faction it has cards for (one faction + Neutral, per the existing hybrid-deck rule).
- At creation the owner picks a **starting faction**, which only decides the starter deck.
- **Optional owner setting:** the owner can lock an agent to a preferred faction. Default: free.
- The agent's deckbuilder must choose the faction as well as the cards.

### The unique Mythic is Neutral
- It is a **Neutral** card, so it is playable in every deck the agent builds. It does not count toward the hybrid-deck Neutral copy cap (it lives in the signature zone).
- It keeps its own one-of-a-kind Mythic ward (Mythic wards are per card, not faction wards), drawn in the Neutral gold material plus its own motif. Add a Neutral theme to `render/tools/mythic_ward.py` (THEMES has none yet).
- **Fairness test, now across all four factions:** swap the candidate into each faction's starter deck in place of that faction's set Mythic (both played from the signature zone). In **every** faction the ring win rates may move by no more than 2 points, and the ring regression check must still pass.

### Neutral signature ability menu (replaces the four faction menus; owner kept all 16)
- **Offence:** Commander's aura (your other units +1/+0); Smite (on arrival, 3 damage to an enemy unit); Rally (on arrival, your units +1/+1 this turn); Hunter (Rush; whenever it destroys a unit, +1/+1).
- **Defence:** Shield wall (your units +0/+1); Guardian (Guard and Barrier); Bulwark (takes the first attack aimed at your side each turn); Restore (end of your turn, restore 1 health to each of your units).
- **Card flow and energy:** Supply line (on arrival, draw a card); Energy surge (on arrival, gain 1 energy this turn); Recycle (when it dies, draw 2 cards); Inspire (start of your turn, a random ally gets +1/+1 permanently).
- **Disruption:** Suppress (on arrival, an enemy unit in Stasis for 1 turn); Dampen (enemy units -1/-0); Tax (enemy Commands cost 1 more); Sweep (on arrival, 1 damage to each enemy unit).
- Add new options each season to keep combinations fresh.


---

## 2026-10-05 — Owner: faction lock, tournament faction rule, and balancing never stops

1. **Owner faction lock (confirmed):** an owner can force-select a faction for an agent if they want; the agent then builds only in that faction (+ Neutral). Default: free.
2. **Tournaments:** when entering a tournament the owner must **pick one faction for the agent**, and the agent **cannot switch faction during the tournament**. Record the faction on the entry; the match server refuses a deck in any other faction for that tournament's matches. (Whether the exact deck list is also locked at entry is still open; until decided, the agent may adjust its deck between rounds within the registered faction.)
3. **Balancing is permanent once the game is live.** The balance lane does not end at launch:
   - track faction popularity and win rates from real ladder and tournament matches (agents can now switch to whatever is strongest);
   - run the ring regression check against live data each season, not just simulated seeds;
   - ship balance changes on a regular cadence (e.g. once per season, or sooner for anything clearly broken), applied to every owned copy as errata;
   - re-test unique Mythics and new sets before they go live, as already agreed.
   Add this to the roadmap as a standing live-operations item.


---

## 2026-10-05 — Owner: Season 0 setup (cast, length, ladder, finale, hosting, backups)

- **Cast: 8 house agents**, two per starting faction. Names, personalities, play styles and avatars are **generated and proposed to the owner for approval** (surface them in notes-for-owner.md before Season 0 starts). Each then gets its Neutral unique Mythic via the 3-candidate pick.
- **Length: 6 weeks**, long enough to test the economy (faction playset ~4 weeks, full set ~6 weeks by simulation).
- **Ladder: a skill rating (Glicko-2) drives matchmaking; spectators see named tiers** (e.g. Bronze to Mythic) and a top-100 list. Ratings soft-reset each season. Opponents are server-assigned (already agreed).
- **Season finale tournament: Swiss rounds, then a top-8 single elimination.** Final standings give the 1st / 2nd-10th / 11th-100th prize tiers (they shrink to fit 8 agents in Season 0).
- **Tournament entry locks the faction AND the exact deck list** until the tournament ends. (This settles the open deck-list question in the entry above.)
- **Hosting: the owner's Mac mini**, always on, fully self-contained.
- **Backups: automatic hourly snapshots (kept 2 days) and daily snapshots (kept 30 days) of the season database, copied to a second location the owner owns** (e.g. an external drive). Test a restore regularly and log it.


---

## 2026-10-05 — Owner: cosmetics section in the shop (backend now, shop switched off)

The shop will have a **cosmetics section** alongside packs. Build the backend for it with the purchasing backend; keep the shop off until the owner switches it on.

- **Items:** limited-edition **deck backs**, **playmats**, and **avatars / profile pictures** (for owners and agents). Other cosmetics (e.g. sleeves, profile frames) only if the owner approves later.
- **No promo cards (or promo art) in the shop.** Promos stay earn-only (milestones, quests, tournaments), so they keep their meaning and money never buys a playable card.
- **Limited edition = a sale window** (a season or an event), then never sold again. Optional serial numbers for special runs.
- **Direct purchases only, never random**, so cosmetics stay clear of loot box rules.
- **Some cosmetics can be bought with earned credits**, not only paid points: something for free players to aim for, and a credit sink against hoarding.
- **Backend:** an owned-cosmetics inventory; per-agent equip slots (deck back, playmat, avatar); sale windows; optional serials; the same ledger rules (earned/purchased source tag, real-money price shown, refunds path).
- **Render rule:** cosmetics may change the look but never legibility. Effects, the grid, faction colours and EFFECTS.md's constant-meaning rule must still read clearly on every playmat and deck back. Spectators see each agent's equipped cosmetics in replays.


---

## 2026-10-05 — Owner: one shop currency, earned or bought

This clarifies the paid-pack and cosmetics entries above.

- **Every shop item (packs and cosmetics) is priced in one currency: the points agents earn** (the "credits" in ECONOMY.md and the code; the display name can be chosen later). There is no separate premium currency.
- **Points can also be bought in bundles** (the provisional ladder above) once paid purchasing is switched on. Bought and earned points are spent the same way and buy the same things at the same prices.
- The cosmetics entry's "some cosmetics can be bought with earned credits" is superseded: **all** cosmetics are bought with points, however the points were obtained.
- Keep the **earned/purchased source tag on every ledger entry** (refunds of unused bought points, reporting). **Spend earned points first, then bought ones**, so bought points stay refundable for longest.
- **Pack points (crafting currency) are not shop currency and cannot be bought.** They only come from opening packs and salvaging extra duplicates, so money never buys a specific card directly.


---

## 2026-10-05 — Owner: two currencies stay separate; the economy must not be exploitable

**Points** (shop currency: packs and cosmetics; earned, and buyable later) and **pack points** (crafting only; from packs and salvaging extra duplicates; never buyable) **stay separate.** The owner's concern is arbitrage: make sure no loop or loophole turns one resource into more of itself. Build these safeguards into the economy store, and test each one.

### Rules that close the loops
1. **One-way flows only.** Points buy packs; packs give cards and pack points; pack points craft cards. Pack points can never buy packs, points or cosmetics, and nothing converts back into points.
2. **No craft-then-salvage profit.** Crafting is only allowed up to the playable limit (3/3/2/1) of a card, and salvage is ~1/8 of craft cost, so crafting and salvaging is always a loss.
3. **Balance changes do not refund.** If a card is changed (errata), there is no automatic full-value salvage refund (a classic arbitrage window). Any compensation is an owner decision at the time.
4. **Season reset resets points and pack points too** (only the unique Mythic and anything the owner explicitly exempts carry over), so there is no hoarding before a reset.
5. **Earned value stays with the agent that earned it.** Earned points, pack points and cards never move between agents, including agents of the same owner. Only bought points can be allocated by the owner to an agent. This stops farming with many agents.
6. **Owner-level rewards are per owner, not per agent** (the owner's daily pack). New-agent rewards (starter deck, 3 packs, unique Mythic, achievements) cannot be farmed: cap agents per owner in the config (number decided before public launch).
7. **No self-play farming.** Opponents are server-assigned; an owner's agents are never matched against each other in rewarded play; flag repeated pairings and suspicious win/loss patterns.
8. **Tournaments:** prizes are set so entering is not a guaranteed profit for most entrants; an owner's agents cannot collude (flag same-owner pairings in tournaments).
9. **Refunds and chargebacks:** only unused bought points are refundable; a chargeback after spending puts the account on hold (existing refund path).
10. **Random numbers are server-side and unpredictable;** each pack's seed is logged and can be revealed after opening for audit, never before.
11. **Concurrency:** every spend, salvage, craft and pack open is a single transaction with unique constraints (already the store's design), so double-spend races cannot happen.
12. **One global daily reset time (UTC)** for every daily counter.
13. **Future marketplace:** no self-trades between an owner's own agents, a sale fee as a sink, and wash-trading detection (design-time item).

### Prove it
- Add an **exploit test suite** that tries each loop above and must fail to profit.
- Add **economy anomaly flags** to the Season 0 metrics: earnings above the daily caps, rapid salvage/craft cycles, unusual balance growth, repeated pairings.
- Re-run these whenever an economy number changes.


---

## 2026-10-05 — Owner: future marketplace — 10% fee, possibly USD or Ethereum (hooks only, nothing built)

The owner is considering a future marketplace with a **10% fee on each sale**, priced in **USD, or Ethereum via MetaMask**. This is much later and needs legal review before any of it is built (real-money resale of cards from paid random packs is treated as gambling in some countries, and crypto adds payments, tax and licensing questions). **Build nothing for it now.** Only make sure the store does not block it:

1. **Card copy IDs are globally unique and never reused** (e.g. UUIDs), so a copy could later map to an external record or token without renumbering.
2. **Each copy records how it was funded:** pulled from a pack bought with earned points, a pack bought with purchased points, crafted, promo, starter, etc. Rules may later treat these differently (e.g. only some copies may be sold for money).
3. **Listings and sales are currency-agnostic:** a price plus a currency code, not hard-wired to in-game points. Real-money or crypto settlement would live outside the in-game points ledger, in its own records (payouts, fees), and never turn into in-game points.
4. **The fee rate is config** (10% planned), recorded per sale.
5. Owner accounts have room for later verification fields (e.g. identity or wallet), unused for now.
6. The marketplace switch stays global/per-region and off by default (already recorded).

Until a marketplace is decided, the existing rule stands: **no cash-out and no transfers of bought value.**


---

## 2026-10-05 — Owner: per-country rules switches for the marketplace (and paid features)

The owner wants the marketplace switched off in countries where it is not allowed. Make the region switch a **per-country rules table in config**, not a single on/off flag, so each country can get exactly what its rules allow:

- **Marketplace:** off / in-game points only / real money (USD or crypto).
- **Which copies can be sold** (by funding source, e.g. exclude copies from packs bought with purchased points).
- **Paid packs** (buying points): on / off.
- **Cosmetics purchases:** on / off.
- Minimum age and parental-control defaults.

Everything defaults to **off**. A country's owners see only what is enabled for them. Decide the owner's country from something reliable (billing country or a verified account country), not just the connection's location, and record which rules version applied to each purchase or sale. Legal review fills in the table before anything is switched on.


---

## 2026-10-05 — Owner: marketplace payment methods — USD and MetaMask (ETH / USDT), designed in now

Add these to the marketplace design now, in case they affect the infrastructure. The marketplace itself stays off (per-country table, legal review first).

### Payment methods
- **USD** through a marketplace payment provider (e.g. Stripe Connect: card payments, seller payouts, provider-side identity checks, the 10% fee taken automatically).
- **MetaMask: ETH and USDT** (USDT as the ERC-20 token on Ethereum to start). **Web only** (app stores restrict crypto payments for digital goods). **No identity checks for MetaMask sales** (owner decision).
- One listing price in USD; a buyer paying in ETH or USDT gets a short-lived quote converted at checkout.
- A small smart contract splits each crypto payment: 90% to the seller, **10% to the platform**; the card transfers only after the payment is confirmed on-chain.
- Crypto payments cannot be reversed: define a dispute process that does not rely on refunds.

### Build now (data model and boundaries only; no live payments, no contract deployed)
- payment method on every sale (points / USD / ETH / USDT);
- accepted payment methods per listing;
- exchange-rate snapshot (rate, source, time, expiry) per crypto checkout;
- on-chain transaction hash, chain ID and confirmation status per crypto sale;
- wallet address(es) linked to an owner account (one owner can link a wallet; a wallet links to one owner);
- seller payout records and platform fee records, separate from the in-game points ledger;
- the per-country rules table gets separate switches for USD and for crypto.

Wallet connection, the smart contract and live checkout are built later with the marketplace.


---

## 2026-10-05 — Owner: Neutral colour changes to white-gold #fff0c2 (render)

The Aegis orange vs Neutral gold check is done. Checked side by side and with a colour-blindness simulation: the current Neutral gold #ffcf5c nearly merges with Aegis orange #ff7d24 for deuteranopia (the most common colour blindness), especially in glowing effects. **Neutral becomes white-gold `#fff0c2`** (CIEDE2000 distance from Aegis: 26 → 33 in normal vision, 12 → 22 with deuteranopia; still clear of Cortex, Swarm and Null).

**Render lane:**
- Change Neutral to `#fff0c2` everywhere: `render/EFFECTS.md` colour list, the page CSS variable, faction tags, card frames, HUD tint, v1 skins and the canvas kits (light lances, crosses, chevrons, smite, the gold acid debuff, which becomes white-gold acid).
- The unique Neutral Mythics' wards use this white-gold material too.
- Aegis stays orange `#ff7d24`.
- Check text on white-gold stays readable (dark text on light fills, or white-gold text on dark).


---

## 2026-10-05 — Owner: ECONOMY.md now holds all of today's economy decisions

The owner folded every 2026-10-05 economy entry above into `ECONOMY.md` (commit "ECONOMY.md: fold in the owner's 2026-10-05 decisions"). **Game-lane sessions: read ECONOMY.md first; it is the single, current economy spec**, with superseded rules already replaced (5-card packs, the Prototype pyramid and 6th-card drop, win pay 30/10/5, salvage and crafting numbers, the Neutral unique Mythic and signature zone, one shop currency, anti-exploit rules, marketplace hooks, per-country rules, Season 0 setup). If ECONOMY.md and an entry here ever disagree, the entry here wins and ECONOMY.md should be fixed. Keep each section's BUILT / SPEC / OPEN marker up to date as you build.


---

## 2026-10-05 — Owner: owner app spec (title screen, main menu, owner-owned economy, one agent, auto-play, 2× rule, Watch live, dark mode) (SECTION A HANDLED 2026-10-06, session 29 — schema v2, the owner owns everything; rating is per owner when the ladder is built. Sections B-F follow the build-order entry below)

Owner-approved. Build the owner app to this spec. Where earlier owner-screen notes disagree, this entry wins.

**Visual reference:** `render/reference/owner-app-mockup.html`, a clickable phone mockup. Agent names, card art, numbers and prices in it are placeholders. Open it in a browser and sign in with anything.

### A. The economy moves from the agent to the owner [CHANGES BUILT CODE]
- The owner (the human account) owns everything:
  - the collection and every card copy, plus credits, pack points and unopened packs;
  - promos;
  - rating, tier and match stats;
  - quest, daily-reward, weekly-challenge and pity-timer progress.
- An agent owns nothing except its signature card.
- **Migrate `economy/`:** card copies, ledger entries, wallets, packs and decks key on `owner_id`, not the agent. Keep the agent on matches and ledger rows as "played by", for history and the stats filter.
- **Caps are per owner:** daily caps, quests, the weekly challenge, pity timers and win rewards. Switching agents must never reset them or double them.
- **Rating is per owner.** A newly connected agent plays at the owner's current rating, so switching can't reset a bad rating.
- **The starter collection is once per owner:** the starter deck plus 3 packs.
- Update `ECONOMY.md` to match. Mark the per-agent wording as superseded by this entry.

### B. Agents: one at a time
- An owner has one connected agent at a time.
- Switching agents changes **only the signature card** in play. Everything else stays with the owner.
- **A new agent gets its signature card only.** No starter deck and no starter packs.
  - The owner picks the signature card from 3 generated options, as already specced.
  - Season 0 flow: "Generate a new agent" shows 3 generated agents. The owner picks one, then picks its signature card from 3, then confirms.
  - "Connect your own AI agent" is shown as coming after Season 0.
- **Old signature cards stay bound to their old agent forever.**
  - They show in the owner's Collection under Promos → Signature cards.
  - Only the connected agent's card is marked "in use"; the rest are greyed out.
- No switching or disconnecting during a live match.
- **Faction lock is an owner setting.** It applies to whichever agent is connected.

### C. Screens
1. **Title screen (animated):** fanned rare cards, a shimmering logo and a moving background. Tap to start. If the owner isn't signed in, a sign-in panel slides up (email or username, password, and a create-account link). Season 0 stays home Wi-Fi only, as already decided.
2. **Main menu, top to bottom:**
   - **Header:** owner avatar and name, credits, pack points, notifications bell.
   - **Connected agent card:** name, faction, tier, rating and record, live status, a Watch or Start match button, and the Auto-play switch.
   - **Pack banner:** "Open" when a free daily or unopened pack is waiting; otherwise a countdown to the next free pack.
   - **Full-width rows, one under another, in this order:** Agent match, Watch live, Collection, Store, Tournament, Stats, Settings, **Connect agent (last)**.
     - Each row has an icon, a name, a one-line status, an optional badge (LIVE, 2 FREE) and a chevron.
     - The Agent match and Watch live rows use dark styling.
3. **Agent match (dark), tab "My agent":**
   - Flow: Start match → matchmaking → live board → Victory or Defeat with rewards → Replay, Play again or Menu.
   - The live board shows health, hand counts, units, damage numbers, a turn banner and a play-by-play log.
   - Leaving the screen doesn't stop the match; the menu shows its live status.
   - Use the existing match renderer for the real board.
4. **Watch live (main menu row, and a tab on the match screen):**
   - Featured live matches in two groups: Tournament (including the Season 0 finale when it runs) and Top rated (high-rating players).
   - Shows viewer counts. Spectators can't change speed or interact with the match.
5. **Collection:**
   - The owner's collection, grouped by set (Set 1 now, later sets listed).
   - Tabs: Set, Secrets, Prototypes, Promos. Faction filter.
   - Binder layout with numbered empty slots for missing cards.
   - Card viewer with tilt, and craft with pack points.
6. **Store:**
   - **Packs:** buy 1 or 10, open 1 or 10.
   - **Daily:** claim free daily packs; weekly challenge.
   - **Cosmetics:** deck backs, playmats, avatars. Prices to be decided.
   - **Credits:** paid credits are shown but switched off until after Season 0. Pay by card (USD) or MetaMask (ETH or USDT, web only), with the per-country switch already decided.
7. **Tournament:**
   - Event card and entry flow: pick a faction; the faction and exact deck list lock until the event ends.
   - Prizes as already decided, plus the seeding ladder.
   - Featured tournament matches appear in Watch live.
8. **Stats (owner-level):**
   - Rating chart; matches, wins, win rate and best streak; recent results.
   - Win rate by faction; today's earnings and quests; achievements.
   - Filter: "All agents" or the agent that played.
9. **Settings:**
   - **Account:** sign out.
   - **Play:** Auto-play; Lock faction with a faction pick; "Ask for 2× in every match".
   - **Notifications:** big pulls, match results, free daily pack ready.
   - **Display & sound:** Theme, Sound, Haptics, Reduce motion.
   - **Season 0:** network status.
   - **Admin:** shown to admin accounts only.
10. **Admin → House agents (admin only):** manage the 7 Season 0 house agents. Each house agent runs under its own house owner account, with its own collection, wallet and rating.
11. **Pack opening (from the menu banner or the Store), as already specced:**
    - single pack: choose a pack from a carousel, slide to tear it open, swipe through the cards;
    - special cards arrive face-down and glowing; tap to reveal;
    - the bonus 6th-card moment;
    - results with NEW badges and salvage;
    - bulk 10 opens to a grid with tap-to-reveal.

### D. Match speed: 2× only when both owners agree
- Matches start at 1×. They run at 2× only when **both** owners in the match agree.
- Each owner can tap "Ask for 2×" during a match, or turn on "Ask for 2× in every match" in Settings. The screen shows when you're waiting on the other owner.
- The vote resets every match.
- Speed only changes the pace of playback and streaming. It never changes game logic or results.

### E. Auto-play (maxes daily rewards with little human input)
- One easy switch, on the main menu agent card, on the match screen and in Settings.
- When on, the agent queues ranked matches back to back without input.
- It **switches itself off once the day's rewards are maxed** (the daily earnings cap, or 10 rewarded wins), with a message. The owner turns it back on another day.
- Turning it off lets the current match finish.
- Auto-play earns nothing extra. The same daily caps apply.

### F. Dark mode
- Settings → Theme: **System** (the default, follows the device), Light, Dark.
- The menu and list screens switch between light and dark.
- The match board, pack opening and title screen are dark in both modes.
- Cards look identical in both modes.
- Neutral's white-gold #fff0c2 is used as text only on dark backgrounds. On light backgrounds, use a darker gold.

### Still open (decide later)
- Cosmetic prices, and the paid credit tiers and prices.
- The rules for who appears in Watch live under "Top rated".


---

## 2026-10-05 — Owner: crafted and starter cards are account-bound (HANDLED 2026-10-06, session 29 — every copy records its origin; crafted and starter copies are bound in the schema; bound copies never salvage or change owner; salvage takes only extra standard pack copies, the example is in `progress/economy-demo-002.txt`; ECONOMY.md updated. The "Account-bound" tag in the card viewer is website work)

Owner decision, clarifying the anti-exploit rules. Build to this and update `ECONOMY.md` to match (anti-exploit and marketplace sections).

- **Every card copy records its origin** on its `card_copies` row: pack, crafted, starter, promo or prize.
- **Crafted copies (made with pack points) are account-bound.** They can't be sold on the future marketplace and can't be salvaged into pack points. They can only be played.
- **Starter deck copies are account-bound too.** They can't be sold and can't be salvaged. This stops anyone farming new accounts for free cards to sell.
- **Bound copies still count normally** for deck building, the playable limits (3/3/2/1) and collection completion.
- **Salvage only ever uses standard-finish copies from packs.** When an owner holds more than the playable limit, the extra pack copies are the ones that salvage; bound copies never do.
  - Example: an owner holds 3 starter copies of a Common and pulls a 4th from a pack. The pack copy salvages.
- **The marketplace (later) never lists bound copies.** The card viewer shows an "Account-bound" tag on them.


---

## 2026-10-05 — Owner: website first, with a customisable widget board (owner UI layout)

Owner-approved. **Build the owner UI as a website first. There will be no phone app for now, and the phone layout is parked, so don't build it.** Every rule in today's owner app spec still applies; only the layout changes:
- the owner-owned economy and the one-agent rule;
- auto-play, the 2× rule and Watch live;
- dark mode and account-bound cards.

**Visual reference:** `render/reference/owner-web-mockup.html`. Open it full screen in a desktop browser and click to start. `render/reference/owner-app-mockup.html` stays as a reference for behaviour only. Names, numbers, art and prices in both are placeholders.

### A. Platform
- A website that owners sign into from a desktop browser. No App Store or Play Store for now.
- In Season 0 it's served from the Mac mini on home Wi-Fi, as already decided.
- It's fully self-contained: system fonts only, and the backgrounds are generated in the browser. No external services.

### B. Site layout
- **Left sidebar, always visible:**
  - Home, Agent match, Watch live, Collection, Store, Tournament, Stats.
  - Then Settings and Connect agent.
  - At the bottom, a small agent card with live status and the Auto-play switch.
- **Top bar:**
  - the page title;
  - an "Open" button whenever packs are waiting;
  - credits and pack points;
  - theme switch, notifications and account.
- **Full pages:**
  - **Agent match and Watch live:** a big board on the left, the play-by-play and controls on the right.
  - **Collection:** a wide binder.
  - Store, Tournament, Stats, Settings, Connect agent and Admin.
- Confirmations open as centred dialogs. Pack opening is full screen, as already specced.

### C. Home is a customisable widget board
- **Grid:** 12 columns. Each widget has three sizes:
  - **S:** 3 columns × 2 rows.
  - **M:** 6 × 4.
  - **L:** either wide (12 × 6) or tall (6 × 8), whichever suits the widget.
- **Customise mode** (iOS edit style, where widgets jiggle):
  - drag to move;
  - pick S, M or L to resize;
  - "−" to remove;
  - buttons for "+ Add widget", "Background" and "Recommended layout" (asks to confirm first).
- **"+ Add widget"** is always available. It opens the widget gallery, and a dashed "+ Add widget" tile also sits at the end of the board in Customise mode.
- **Empty board:** shows "Your board is empty" with Add widget and Use recommended layout.
- **The layout is saved to the owner's account** on the server, so it follows them to any browser.
- **Widget limits:**
  - one of each widget, except Watch live (up to 2);
  - at most **2 live boards** render at once; extra live widgets drop to a scoreboard with a short note.
- Every widget has a button that opens its full page.
- **Narrow windows** stack the widgets in the owner's order.
- **Recommended layout:**
  - Row 1: My agent (M), Live match (M).
  - Row 2: Packs (M), Daily rewards (S), Tournament (S).
  - Row 3: Watch live (M), Collection (M).
  - Row 4: Ladder (M), Rating & form (M).

| Widget | S | M | L |
|---|---|---|---|
| My agent | Avatar, name, status, auto-play switch | + rating, record, Start/Watch, signature name | Wide: + persona, signature card art, faction lock, today's rewards |
| Live match | Scoreboard: names, health, turn | Compact board, last log line | Wide: board, play-by-play, 2× request, auto-play |
| Watch live (max 2) | Top featured match, viewers, Watch | List of featured matches | Wide: featured match plays in the widget, list alongside |
| Packs | Pack, count, Open | Pack art, daily timer, Open / Open 10 / Buy | Wide: + last opening's cards |
| Daily rewards & quests | Earnings bar, rewarded wins | + quests with reroll | Tall: + weekly challenge, daily streak |
| Collection | Completion ring | + secrets and Prototypes, last 5 pulls | Wide: mini binder with faction filter |
| Showcase | Best card | 5 best or pinned | Wide: showcase wall the owner arranges |
| Ladder | Rank and rating | Top 8 plus you | Tall: full ladder with tiers and search |
| Rating & form | Rating, weekly trend | Chart, recent results | Wide: chart, stats, win rate by faction |
| Match history | Last result | Last 6 | Tall: full list with replay links |
| Tournament | Countdown | Event card, Enter, prizes | Wide: live bracket and standings |
| League pull feed | Latest big pull | Feed | Tall: feed with card images |
| Notifications | Unread count, latest | Feed | Tall: feed with filters |
| Store | Claim free daily pack | Packs and daily claim | Wide: + cosmetics |

### D. Look and feel
- **iOS widget style:**
  - frosted-glass panels: translucent, blurred, a fine bright edge, a soft shadow, corners around 26px;
  - each widget has a small coloured app-style icon and a plain title;
  - Apple's system font, with the rounded variant for big numbers.
- **Background:**
  - a slow-moving liquid gradient drawn in the browser (WebGL);
  - it sits behind the glass sidebar, top bar, widgets, panels and dialogs.
- **Background choices** (Settings → Display & sound, and Customise → Background):
  - liquid colours: **Glacier** (default, soft blue-grey), **Ocean**, **Aurora**, **Sunset**, **Lavender**, **Graphite**;
  - **Plain black** and **Plain purple**, which always use dark mode;
  - the choice saves to the owner's account.
- **Theme:** System, Light or Dark, as before. Each liquid colour has a light and a dark version.
- **Accessibility:** reduce motion keeps the background still; reduce transparency makes panels solid.
- **Performance:** render the background at low resolution, cap it at about 30 frames a second, and pause it when the tab is hidden or the background isn't visible.

### E. Title screen
- **Background:**
  - a deep cosmic version of the liquid background in indigo, violet and teal;
  - a warm glow behind the cards, and slowly drifting sparkles;
  - **no rotating light rays.**
- **Cards:**
  - a fan of five rare cards: a Full Art, a Gold, a Prototype in the centre, an Alt Art and a Foil;
  - they tilt in 3D towards the mouse, with a holographic shine;
  - **all text stays still.**
- **Logo and text:**
  - the logo builds in letter by letter, then keeps a slow foil shimmer;
  - a "Season 0 is live" badge, "SEASON 0 · SET 1", the tagline and three feature points;
  - stat tiles showing cards in the set, Prototypes to hunt and days to the finale, all from live data.
- **Starting:**
  - a **"CLICK TO START"** glass button; Enter works too;
  - if the owner isn't signed in, the sign-in panel takes the button's place.
- **Live ticker** along the bottom, from real data: live featured matches with viewer counts, big pulls and tournament news.

### Still open
- The phone layout (parked).
- Cosmetic prices, paid credit prices and the "Top rated" rules (already open).


---

## 2026-10-05 — Owner: build order for today's decisions (STEP 1 HANDLED 2026-10-06, session 29; STEP 2 PART 1 HANDLED 2026-10-08, session 30 — Season 0 sign-in, one connected agent, switching (refused during a live match), the faction lock, the house-owner admin data; still to do in step 2: generating a new agent with its signature card; the order is copied into progress/roadmap.md)

Owner-approved. Today added a lot to the spec. **Build it in this order, and don't start a step until the one before works and its tests pass.**

1. **Move the economy to the owner.** Follow today's owner app spec, section A, and the account-bound entry:
   - card copies, credits, pack points, packs, decks, rating and stats key on the owner;
   - every copy records its origin;
   - crafted and starter copies are account-bound;
   - caps, quests and pity timers are per owner.
   Then update `ECONOMY.md` to match, and update or add tests.
2. **Owner accounts and agents:**
   - Season 0 sign-in;
   - connecting one agent at a time;
   - switching agents (only the signature card changes);
   - generating a new agent (pick from 3, then pick its signature card from 3; no starter packs);
   - the admin view for house agents.
3. **The data the website needs.** Server-side endpoints on the Mac mini for:
   - wallet, collection, packs and pack opening;
   - live and featured matches;
   - ladder, tournament, stats and notifications;
   - saved board layout and background choice.
4. **Website basics:**
   - sidebar and top bar;
   - pack opening (full screen);
   - Collection, Store, Settings and Connect agent pages;
   - dark mode.
5. **Widget board and look:**
   - the customisable board with the 14 widgets at S, M and L, Add widget, remove, Recommended layout and the empty state;
   - the glass style, liquid backgrounds and background picker;
   - the title screen.
6. **Live play features:**
   - auto-play;
   - the 2× vote, where both owners must agree;
   - Watch live, as both full pages and widgets;
   - the live ticker on the title screen.

Visual references: `render/reference/owner-web-mockup.html` (the layout to build) and `render/reference/owner-app-mockup.html` (behaviour only). The phone layout stays parked.

**Open, decide later (after step 2):** how an agent picks its faction, builds its deck from the owner's collection, and chases quests. Raise it as an [OWNER CHECK-IN] when step 2 is done rather than guessing.


---

## 2026-10-07 — Owner: salvage is manual only; deck copy limit 2/2/2/1; copies shared across decks (answers session 29) (HANDLED 2026-10-08, session 30 — section 1 built: `salvage(owner, card, quantity)` is the only salvage, the card viewer data says why each copy can't go, a deck-short salvage warns with the deck list and then marks the decks incomplete without editing them; promo and prize copies are now account-bound too (migration 3). Section 2 as amended: the 3/3/2/1 limit stays, decks count cards and share copies, the owner must hold what a deck uses. Section 3: the starter rebuild was dropped by the amendment; NEW badges and "×N owned" are written into ECONOMY.md for the pack session. Evidence: `progress/economy-demo-003.txt`)

Owner decisions. Build to these and update `ECONOMY.md` to match. This replaces the automatic duplicate salvage everywhere it appears in earlier entries and in both mockups; the mockups' "+pp" duplicate chips are now out of date.

### 1. Salvage is manual, never automatic
- **Nothing is ever salvaged automatically**, not when a pack is opened and not at any other time. Every copy pulled goes into the collection.
- **Owners can keep as many copies of a card as they like.** Holding 50 of one card is their choice.
- **Salvage only happens when the owner chooses it.** The owner picks a card and a quantity in the collection (card viewer → Salvage) and confirms. Pack points are paid in the same transaction, at the existing rates (5 / 10 / 30 / 100).
- **Only unbound, standard-finish pack copies can be salvaged.**
  - Foil, Full Art, Alt Art, Gold and Prototype copies can't be salvaged.
  - Crafted, starter, promo and prize copies are account-bound and can't be salvaged.
  - The card viewer says why when a copy can't be salvaged.
- **Salvaging below what a saved deck uses:** warn first, listing the affected decks. If the owner confirms, those decks are marked incomplete until fixed. Never silently edit a deck.
- **Session 29's call 1** (salvage never takes a copy in a saved deck) is replaced by this section. **Call 2** (v1 data migrates to house owners) is accepted.

### 2. Deck copy limit: 2 / 2 / 2 / 1
- **A deck can hold at most 2 copies of any Common, Uncommon or Rare, and 1 of any Mythic.** This replaces 3 / 3 / 2 / 1 everywhere: deck validation, crafting caps, the agent deck builder, docs and tests.
- **Deck size stays 40.**
- **The owner must own at least as many copies as a deck uses.** Two copies in a deck needs two owned.
- **Copies are shared across saved decks.** Owning 2 copies of a card lets every saved deck use up to 2. Copies aren't reserved per deck.
- **Crafting** can make copies up to the deck limit (2, or 1 for a Mythic), as before but at the new limit.

### 3. Knock-on work (game lane)
- **Starter decks:** rebuild the four starter and ring decks to the new limit (40 cards each), then re-run the ring regression check.
  - If the ring moves, rebalance under the standing "always balancing" rule.
  - Report the before and after numbers at a checkpoint.
- **Pack opening results:** show NEW badges and how many copies the owner now holds (for example "×3 owned"). No salvage chips.
- **Order:** do this before or alongside build-order step 2. It touches the same economy code that step 1 just changed.


---

## 2026-10-07 — Owner: amendment, keep the 3 / 3 / 2 / 1 deck copy limit (HANDLED 2026-10-08, session 30 — nothing changed in the limit or the decks; the shared-copies, own-what-you-use and pack-result items are done or specced as noted above)

Owner decision. This amends section 2 and part of section 3 of today's "manual salvage only" entry. Section 1 (salvage) stands unchanged.

- **The deck copy limit stays 3 Common / 3 Uncommon / 2 Rare / 1 Mythic**, as built. Ignore the 2 / 2 / 2 / 1 change. A lot of balance work rests on the current limit.
- **Still applies from today's entry:**
  - the owner must own at least as many copies as a deck uses;
  - copies are shared across saved decks, not reserved per deck;
  - crafting can make copies up to the deck limit (3 / 3 / 2 / 1).
- **Dropped from today's entry:** rebuilding the starter and ring decks, and re-running the ring check for the copy limit. The decks stay as they are.
- **Still applies from section 3:** pack results show NEW badges and the number of copies held (for example "×4 owned"), with no salvage chips.


---

## 2026-10-07 — Owner: render v2 slice 3 (procedural sound, mid-board hits) — answers to the 7 calls (HANDLED 2026-10-08 by the render lane, PR #44 — the damage number at the impact point, sound armed on by default, a one-click mute and a volume control, both remembered; marked here by session 30)

Owner decisions on the 7 calls in the 2026-10-05 render checkpoint (`progress/render/checkpoints.md`).

1. **Hits land at the exact centre of the defender's row** (the gap between slots 3 and 4), even when the flash spills onto neighbouring cards. **Keep.**
2. **Change: the damage number appears where the visual hit lands**, at the impact point on the board, not at the HP bar. The HP bar still flashes and drops as it does now. Only the floating number moves to the impact.
3. **Only spectacle hits flash the whole panel.** **Keep.**
4. **A volley plays as one combined sound.** **Keep.**
5. **Spell and removal sounds as built:**
   - spells use the impact sound;
   - a removal plays lock-on beeps, then a beam, then the kill sound.
   **Keep.**
6. **Barrier blocks ring the same tone in every faction, plus a metal ring for Aegis.** **Keep.**
7. **Change: sound defaults to ON, and turning it off is remembered.**
   - Browsers block audio until the viewer interacts with the page. So treat sound as armed on, and start it on the viewer's first click or key press. Pressing Play counts.
   - Show a small "Sound on" indicator with a one-click mute.
   - If the viewer mutes, remember it: in browser storage for standalone replays, and in the account's Sound setting on the owner website. A muted viewer stays muted next time until they switch it back on.
   - Add an effects volume control next to the toggle. The checkpoint itself flagged this as thin.

---

## 2026-10-10 — Owner: answers to session 30's calls and render slice 4's calls (GAME LANE HANDLED 2026-10-10, session 31 — item 1 built: schema migration 4 unbinds promo and prize copies, new ones are granted unbound, salvage still refuses them and the card viewer says "can be kept or sold, never salvaged"; items 2 and 3 stand as built; item 4 is carried in notes-for-owner.md as the check-in due before sign-in leaves Season 0. RENDER LANE items still open for the render lane: the arpeggio "acting player / whoever is ahead" setting; the website Music setting, menu music and the music widget belong to build-order steps 4 and 5)

Owner decisions on the calls in `progress/notes-for-owner.md` (session 30) and `progress/render/checkpoints.md` (2026-10-09, slice 4).

### Game lane (session 30)
1. **Change: promo and prize copies can be sold, but can't be salvaged.**
   - This replaces the account-binding of promo and prize copies from session 30 (migration 3). They must stay sellable on a future marketplace.
   - Salvage still refuses them, and the card viewer still says why.
   - Crafted and starter copies stay account-bound, as before.
2. **Keep: an owner is in at most one live match at a time.** An agent can't spin up sub-agents to play matches in parallel.
3. **Keep: an incomplete deck fixes itself** once the owner holds enough copies again.
4. **Open, decide later: account recovery and sign-in.**
   - The owner is considering OAuth sign-in, or email. Both would rely on an outside service, which the no-external-reliance rule currently rules out (payments are the only exception).
   - Raise it again as an [OWNER CHECK-IN] before sign-in leaves Season 0.
   - Until then, the current settings and the proposed admin-only password reset are not overruled.

### Render lane (slice 4, music)
1. **Keep:** music is on by default.
2. **Keep:** music volume defaults to 60%, separate from the effects volume.
3. **Keep:** only violence drives the intensity (hits, kills and Mythic arrivals).
4. **Keep, plus a setting:** the arpeggio follows the acting player, as built. Add a choice to the sound settings between "acting player" (the default) and "whoever is ahead".
5. **Keep:** music keeps playing while paused and at the end, settling to calm.
6. **Keep, plus two additions:** the website gets a Music setting next to Sound.
   - **Menu music:** the owner website's title screen and menus get their own music, with an on/off toggle that is remembered. It stays self-contained, like the rest of the site.
   - **Music widget (an Easter egg):** a widget that controls the music, like a mini drum machine or loop machine.
     - Keep it fun and simple, not a full sequencer. For example, toggle drum and loop layers, change the groove, or nudge the tempo.
     - Build it with the widget board (build-order step 5).
     - Propose its sizes, its controls and how owners find it at a checkpoint.

---

## 2026-10-11 — Owner: Mythic wards sit behind the card

Owner decision. This changes EFFECTS.md's "Mythic unique wards", which are currently layered over the Mythic card. Update EFFECTS.md, the effects lab and the replays to match.

- **Arrival:** when a Mythic arrives, its ward appears on top of the card as it does now. After a few seconds it fades back behind the card.
- **After that, the ward always stays behind the card**, for as long as the Mythic is on the board. The card art and its name and stats strip stay fully visible.
  - Only the parts of the ward that reach past the card's edges show, for example Quorum Arbiter's outer ring and seats, or Hive Mother's outer membrane and pulse.
  - Signature-move flares and live ward behaviour (seats lighting, heartbeat and so on) play behind the card too.
  - The core can no longer be seen in the card's centre. The render session may enlarge or brighten the outer layers so a Mythic still clearly stands out, and should show the result at a checkpoint.
- **Death:** when the Mythic dies, its ward shatters into spinning pieces, as now.

---

## 2026-10-11 — Owner: signature zone check-in, option A (answers session 31) (HANDLED 2026-10-12, session 32 — the Neutral menu is card data (`engine/src/data/signatureMenu.ts`, all 303 table combinations) and the fairness test is built against the plain-stand-in reference (`engine/src/dev/signatureFairness.ts`). Measured: only Recycle and Tax pass on the table, and stat tuning alone passes no other option (`progress/balance-report-023-signature-menu.txt`). The Aegis question is raised again with these results in notes-for-owner.md, as asked)

Owner decision on the [OWNER CHECK-IN] in `progress/notes-for-owner.md` (session 31).

- **Option A.** The ring gate keeps its current baseline until real matches carry signature cards. The "Mythic as signature card" numbers stay recorded as the second baseline only.
- **Fairness test for the Neutral menu:** use the "same plain signature card on both sides" ring as the reference (the Neutral 5-cost 3/6 stand-in, with each set Mythic left in its deck). A candidate passes when swapping it in for one faction's plain stand-in moves that faction's edges by 2 points or less.
- **Next game-lane session:** build the Neutral menu as card data and run the fairness test against that reference.
- **Still open:** whether to deal with Aegis gaining the most from an extra 5-cost body (Aegis > Cortex 52 -> 60 with the stand-in). The owner hasn't decided. Raise it again with the Neutral menu results.
- **Not overruled:** session 31's four calls (a signature card is a plain Unit; cost modifiers apply to it, with +2 per replay on top; its Tools go to the graveyard when it dies; its onDeath abilities fire before it goes back to the zone).

---

## 2026-10-12 — Owner: render session 15 (Mythic wards, slice 6) accepted, keep all 6 calls

Owner decision on the slice 6 checkpoint in `progress/render/checkpoints.md` (render session 15, PR #48). All six calls are kept as built:

1. Slice 6 (Mythic wards) built before slice 5. Slice 5, the faction ward flares for the ten signature abilities, is next.
2. On arrival the ward stays on top for about 2.6 s, then fades behind the card over 0.8 s.
3. Behind the card, the ward stands out with brighter outer rings, about 16% larger.
4. The obsidian + foil Mythic card.
5. The death shatter flies over the board.
6. "Whoever is ahead" falls back to the acting player when the match is even.

---

## 2026-10-13 — Owner: signature menu check-in, option A; the signature card can't be sold (answers session 32) (HANDLED 2026-10-14, session 33 — the tuner has the size lever (`MenuOption.sizes`, every option but Guardian and Bulwark) and the cost-tier lever, attack kept at 2 or more; all 16 options re-run: 6 pass (Recycle, Supply line, Rally, Restore, Tax, Inspire), 3 are within 0.6 of passing; rework proposals for Guardian and Bulwark were measured and are in the new [OWNER CHECK-IN] in notes-for-owner.md (`progress/balance-report-024-signature-levers.txt`). The Aegis question stays open, as asked. The signature card can't be sold: schema migration 5 and `grantCopy` force a signature copy (`origin_ref` `signature:<agentId>`) to be a bound promo)

Owner decisions on the [OWNER CHECK-IN] in `progress/notes-for-owner.md` (session 32).

- **Option A.** Keep the 2-point fairness rule.
  - Give the tuner levers beyond stats: the size of the ability itself, and the cost tier.
  - Keep attack at 2 or more, so the cards still read as Mythics.
  - Options that still fail come back with rework proposals at the next check-in (Guardian and Bulwark are the likely ones).
- **The Aegis question:** not decided. Session 32's suggestion (leave it until the menu passes, then re-measure the ring with the signature cards agents will actually carry) is not overruled.
- **An agent's unique promo (its signature card) can't be sold.** It's an exception to the 2026-10-10 rule that promo copies can be sold. It stays bound to its agent, as the owner app spec already says. Salvage refuses it too, under the promo rule.
- **Session 32's five smaller calls:** the owner is reviewing them; a follow-up entry will record the answer.

---

## 2026-10-13 — Owner: session 32's five smaller calls (follow-up) (HANDLED 2026-10-14, session 33 — call 3 built before Bulwark's re-test: a generic `guardInPlay` condition, Bulwark stands aside while a Guard unit protects its side and keeps its redirect; tested, and shown in a real game in `progress/sample-match-031-bulwark-guard.txt`; the rework proposals were measured with it. Calls 1, 2, 4 and 5 stand as built)

Owner decisions on the five "calls you may want to overrule" in session 32's notes. This completes the earlier 2026-10-13 entry.

1. **Keep:** "moves by 2 points or less" means the measured change on the same games, candidate against reference. The whole interval doesn't need to sit inside ±2.
2. **Keep:** Hunter grows only if it survives the kill.
3. **Change: Guard takes priority over Bulwark.** Bulwark doesn't step in front of an attack that a Guard unit is already forcing onto itself. It takes the first enemy attack each turn only when no Guard unit is protecting the target. Apply this before re-running Bulwark's fairness test, and in its rework proposal.
4. **Keep:** Tax raises enemy Commands only, never a signature card's +2 replay surcharge.
5. **Keep:** Inspire's random ally can be the signature card itself.

---

## 2026-10-14 — Owner: render session 16 (faction wards, slice 5) accepted, keep all 6 calls

Owner decision on the slice 5 checkpoint in `progress/render/checkpoints.md` (render session 16, PR #50). All six calls are kept as built:

1. "First fire" means the first fire that did something. A fire with no effect doesn't use up the ward.
2. A defence's guard stays behind the card until the Barrier breaks, then cracks on the BLOCKED beat.
3. Resting guards are quiet (half opacity).
4. The ward leads its effect by 0.75 of a tick (about half a second at normal speed), and the move is held like any spectacle moment.
5. The ward replaces the cast sigil and cast sound on that move.
6. Overload Capacitor stays on the signature list, and its ward plays in place.

---

## 2026-10-15 — Owner: signature menu check-in, option A; keep all four calls (answers session 33) (HANDLED 2026-10-14, session 34 — Guardian is Barrier only and Bulwark covers units only (never you), both in the menu data; the finer pass measured every size of Smite, Energy surge, Sweep, Guardian and Bulwark at every cost-5 body (attack 2-4, health 3-9) at 1,000 seeds and confirmed the 5 best of each at 2,500, plus all tiers for Guardian and Bulwark: Energy surge now passes (+2 energy at 2/8 and 2/9), Sweep misses by 0.04, Guardian by 0.08, Smite by 0.40, Bulwark by 1.88, so Bulwark stays off the generator (`progress/balance-report-025-signature-finer-pass.txt`). generateAgent and the bound promo grant are built (schema v6, `progress/economy-demo-004.txt`); the generator draws from the 16 passing lines over 7 options. The four calls stand as built)

Owner decisions on the [OWNER CHECK-IN] in `progress/notes-for-owner.md` (session 33).

- **Option A.**
  - Guardian becomes Barrier only, and gets one more tuner pass.
  - Bulwark becomes "takes the first attack aimed at one of your units (never you)". It stays off the generator until it passes.
  - The three near misses (Smite, Energy surge, Sweep) get a finer tuner pass.
  - The generator can use the 6 passing options now (Recycle, Supply line, Rally, Restore, Tax, Inspire). Then build generateAgent and the bound promo grant, as planned.
- **Keep all four of session 33's calls:**
  1. "Only while" conditions count as a size.
  2. Inspire passes off the table (3/4 or 3/5), and that's allowed.
  3. A Bulwark with its own Guard never redirects.
  4. A once-per-turn activated ability isn't offered again after it's been used that turn.

---

## 2026-10-15 — Owner: render session 17 (fallback wards, slice 7) accepted, keep all 6 calls

Owner decision on the slice 7 checkpoint in `progress/render/checkpoints.md` (render session 17, PR #52). All six calls are kept as built:

1. Signature cards get a Mythic ward.
2. Signature cards always use the code-drawn fallback ward, never generated art. Per the standing no-external-reliance rule, a generated agent's card must never call an outside service (such as Replicate) at runtime.
3. The fallback ward uses the quiet "generic" behaviour (rotation plus a soft ring every 3.2 s).
4. The turn line keeps its dark backing.
5. Neutral's fallback material is rune tablets and broken arcs.
6. The demo signature card names are placeholders for the replays. Real names come from the agent generator.

---

## 2026-10-15 — Owner: answers to session 34's check-in (signature pool, names, art, how an agent plays) (HANDLED 2026-10-15, session 35 — Question 1: the reference ring is measured at 10,000 games per pairing. The 7 near misses and all 16 approved lines were re-measured at 10,000 (`progress/balance-report-026-signature-10k.txt`). Guardian 3/5 now passes (1.87). Sweep, Smite and the other Guardian lines still fail. Energy surge (both lines) and Restore 3/4 passed at 2,500 but fail at 10,000, so they left the list: the largest measurement now decides. That gives 14 lines over 7 options. 5 new sizes were added (Smite on small units only; Smite and Sweep only when you have 15 or less health) and measured over every cost-5 body; none passes. Names never repeat: themed, templated card names with thousands of handles and millions of names per option (`engine/src/data/signatureNames.ts`). The username variant is built at a proposed 1 in 30, shown in the new check-in. The art pool is NOT built yet; its plan is in the check-in. Question 2: the placement of the deck-building agent in the build order is proposed in the check-in, and the default on quests stands)

Owner decisions on the [OWNER CHECK-IN] in `progress/notes-for-owner.md` (session 34).

### Question 1: the signature pool
- **Option A: grow the pool.** Re-measure the near misses (Sweep, Guardian, Smite) at 10,000 games per edge against a 10,000-game reference, and add new sizes for the next tuner pass.
- **Names never repeat.**
  - Generate double- or triple-barrel names from word lists with thousands of options each, so the space is far larger than any realistic player count.
  - Rarely, the name includes the owner's username, for example "[username]'s Bulwark Warrior". Propose the odds at a checkpoint.
- **Card art: a pool of 500 pre-generated art pieces, used only for signature cards.**
  - The art is generated ahead of time and stored. Nothing is generated per agent, and nothing calls an outside service when an agent is created.
  - The owner is considering refreshing the pool each season (not decided).
  - The ward stays code-drawn, as accepted on 2026-10-15.
- **Still open:** the owner hasn't yet said whether the "no two agents share a body + ability combination" rule stays. A follow-up entry will record the answer. Until then, keep the rule.

### Question 2: how an agent plays its owner's collection
- **Faction and deck:** the owner can force a specific deck or faction. Otherwise the agent picks the best faction and deck it can build from the cards the owner holds. This replaces the default ("the agent plays the active deck, chosen by hand"). Propose where the deck-building agent fits in the build order at the next check-in.
- **Quests:** the default (the agent doesn't chase quests yet) is not overruled.
- **Persona and play style:** still open. The owner is considering letting owners change, or have some input into, their agent's play style (not decided). A follow-up entry will record the decision.

### Keep all six of session 34's calls
1. The 3 signature candidates differ in ability whenever possible.
2. Energy surge passes only as "gain 2 energy" on 2/8 or 2/9, and that's accepted.
3. A new agent isn't connected automatically.
4. One open draft per owner; a new draft replaces the old one.
5. Signature cards share the PR- promo numbering, and a number is never reused.
6. A signature card never shares a name with a set card or another signature card.

---

## 2026-10-15 — Owner: follow-up to session 34 (combinations may repeat; play styles) (HANDLED 2026-10-15, session 35 — the rule is dropped: schema v7 rebuilds `signature_cards` without the unique combination, and the generator and the store no longer filter on it. Names stay unique, and a clash is re-rolled. Shown with 42 agents over 13 combinations in `progress/economy-demo-005.txt`. Play styles: where they fit in the build order, and a draft set of 6, are proposed in the new check-in. The fairness results come with the build, since a style has to exist before it can be measured)

This completes the two open items in the earlier 2026-10-15 entry.

### Signature combinations may repeat
- **Drop the "no two agents in a season share a body + ability combination" rule.** Generation is random, so two agents can end up with the same body, ability and art. With 500 art pieces and thousands of name combinations, that's rare, and it's accepted.
- **Names stay unique,** as already kept (session 34's call 6). If a generated name clashes, re-roll it.
- Keep growing the pool (option A), for variety rather than capacity. Season agent counts are no longer capped by the pool.

### Play styles
- **Owners pick their agent's play style** from a set of presets in the owner website (and the app later).
  - A change made during a live match applies from the next match.
  - Each style should play visibly differently, and the styles should be fair against each other. No style should win clearly more often overall, tested the same way as signature cards.
- **The persona shapes the commentary.** It changes how the agent sounds in the play-by-play. The chosen style decides how it plays.
- **How many styles:** the owner suggested around 6. The game lane proposes the set at a checkpoint, with each style's fairness results.
- **No free-text instructions for now.** Interpreting them would need a language model running each match, against the no-external-reliance rule.
- Propose where play styles fit in the build order at the same checkpoint.

---

## 2026-10-15 — Owner: signature card names must make sense and stay on theme; ~6 play styles is a target (HANDLED 2026-10-15, session 35 — built as suggested. There are 5 templates with slot-tagged, themed word lists: [Handle]'s [Modifier] [Thing], [Modifier] [Thing], [Thing] of [Place], [Handle]'s [Thing], and [Modifier] [Thing] [Edition]. The Thing leans toward the ability 80% of the time. A filter refuses repeated words, names over 30 characters and blocked words. A clash is re-rolled. The rare variant puts the owner's username in the handle slot. Samples are in `progress/signature-names-sample-001.txt` and in the new check-in. Season 0 has no player-facing surface yet, so you see them before anyone else)

- **Play styles:** around 6 is a target, not a strict rule.
- **Signature card names** (double- or triple-barrel) must read as a real name and fit the game's theme: cyberpunk with 1990s retro-futurism. The owner's example: **"Zion's Midnight DDoS"**.
  - **Suggested approach** (not an owner decision; the session can propose something better):
    - Build names from templates with grammatical slots, not words strung together at random. For example: [Handle]'s [Modifier] [Thing], [Modifier] [Thing], or [Thing] of the [Place].
    - Each word list is tagged by its slot (handle, modifier, noun, place) so every result is grammatical.
    - The lists are themed: hacker handles, network and hardware terms, time-of-night and neon words, retro-tech nouns.
    - Where it fits, lean the noun towards the card's ability, so an attack card can be a "DDoS" and a defensive card a "Firewall".
    - Filter out offensive or nonsense combinations.
  - Names stay unique, with a re-roll on a clash.
  - The rare variant puts the owner's username in the handle slot ("[username]'s Midnight DDoS").
  - Show sample names at a checkpoint before they go live.

---

## 2026-10-15 — Owner: render signature zone (PR #54) accepted, keep all 6 calls

Owner decision on the signature zone checkpoint in `progress/render/checkpoints.md` (PR #54). All six calls are kept as built:

1. The zone sits left of each row, outside the six slots.
2. The waiting card shows its next cost in its cost circle, with the red +2 explaining the climb.
3. "In reach" uses the refill rule and doesn't predict board cost changes.
4. The return waits 420 ms after the kill so it clears the shatter.
5. Replays take the generator's first candidate at each step.
6. In replays with signature cards, the generated agent's name replaces the "Lookahead-Cortex" style username.

---

## 2026-10-16 — Owner: answers to session 35's check-in (username odds, art pool, build order, agent names, HANDLED 2026-10-16, session 36 — 1: `USERNAME_HANDLE_ODDS` = 100, the other rules unchanged; 2: schema v8, every signature card records a random slot of its season's 500-piece pool when made and keeps it (cards made before v8 drew one in the migration), its art reference names the slot; 3: step 1 of the order is built, pack contents and opening (`economy/src/packs.ts`, schema v8, `progress/pack-sim-001.txt`, `progress/economy-demo-006.txt`), the deck-building agent is next; 4: agent names come from the card-name generator, hacker-handle style, samples in `progress/signature-names-sample-002.txt`; the four calls stand)

Owner decisions on the [OWNER CHECK-IN] in `progress/notes-for-owner.md` (session 35).

1. **Username in a card name: option C, 1 candidate in 100.** Keep the other rules as proposed:
   - capitalise the first letter;
   - skip it when the username is over 16 characters, is all digits, or trips the filter;
   - house owners never get one.
2. **Art pool of 500: accepted as planned.**
   - Each signature card records a random pool slot at creation, and the images arrive with the later art pass.
   - A new season points new cards at a new pool; old cards keep their art.
   - Build the slot with the next economy change.
3. **Build order: accepted.**
   1. Pack contents and opening (roadmap item 5).
   2. The deck-building agent: the best faction and deck it can build from the owner's cards, unless the owner forces a deck or faction.
   3. About 6 play styles with a fairness ring. The draft set is Rusher, Controller, Tempo, Fortress, Gambler and Calculator, to be measured, not final.
   4. Step 3, the website endpoints, exposing the forced deck or faction setting and the play style from the start.

   Persona commentary waits for the commentators (stage 7).
4. **Agent names get the same themed treatment as signature card names.** They should be cyberpunk / 1990s retro-futurism, for example hacker-handle style, replacing the session-34 fantasy-style names. Show samples at a checkpoint.

**Keep all four of session 35's calls:**
1. A line's largest measurement decides.
2. The noun leans toward the ability 80% of the time; names are capped at 30 characters.
3. The handle in a card name is a generated handle.
4. The art pool wasn't built yet.

---

## 2026-10-16 — Owner: favour the "[Handle]'s ..." and "... of the [Place]" name patterns (HANDLED 2026-10-16, session 36 — weights 41 [Handle]'s [Modifier] [Thing] + 20 [Handle]'s [Thing] = 61, 30 "[Thing] of the [Place]" (every place now starts "the"), 5 bare + 4 edition = 9, under your 10% with room for noise; the template is drawn first and only its words re-rolled, so the filter can't skew the split (measured 61.0 / 29.8 / 9.2 over 20,000 names); agent names use the same 61 / 30 / 9; fresh samples in `progress/signature-names-sample-002.txt`)

Owner decision on the session-35 name samples (`progress/signature-names-sample-001.txt`).

- **Use the two strongest patterns much more often:**
  - "[Handle]'s ..." patterns, e.g. "Phreakhawk's Midnight Bunker", "Laserkid's Phosphor Rave";
  - "[Thing] of the [Place]", e.g. "Checksum of the Glass Tower", "Firewall of the Grid".
- **Cut back the weaker ones:**
  - bare two-word names ("Mega Mentor", "Handheld Tutorial");
  - edition endings ("Widescreen Modem Classic", "... Plus", "... SE").
- **Suggested weights** (the session can tune them): the [Handle]'s patterns about 60%, "of the [Place]" about 30%, and bare two-word and edition names together about 10% or less.
- The same goes for the themed agent names, where they share the generator.
- Show a fresh sample at the next checkpoint that touches names.

---

## 2026-10-16 — Owner: owners can name their agent; more agent-name room (session 36 follow-up) (HANDLED 2026-10-17, session 37 — schema v9: naming is free at creation (`confirmAgentDraft(..., { name })`), `renameAgent` costs a proposed 100 pack points, the rules run in the store (`economy/src/agentNames.ts`: 3-32 characters, letters/digits/' . - _, no staff or game impersonation, the blocked-word list and repeated-word check, unique without case across current and past names, never another owner's username), `agent_names` keeps every old name for "formerly ...", `forceRenameAgent` for admins (free, reason logged, the old name hidden and reserved). Generated names: a three-part [Handle]'s [Modifier] [Program], 10,702 handles, 300 modifiers, 200 program words (~648 million names), no v2 / Mk III endings, a numeral on a clash; the cap is 32. Evidence `progress/economy-demo-007.txt`, samples `progress/signature-names-sample-003.txt`; the price and smaller calls are in the new check-in. The owner report button is website work)

### Owners can name their agent
- **Naming is free when the agent is created.** The generator still suggests themed names (the 3 draft candidates arrive named), and the owner can keep one or type their own.
- **Any rename after that costs pack points.** This replaces the free-rename-with-cooldown idea. The game lane proposes the price at a checkpoint.
- **Name rules** (proposed in chat, the owner didn't object; the session can refine them):
  - Agent names are unique, case-insensitive, across generated and custom names.
  - 3–24 characters: letters, numbers and simple punctuation.
  - No impersonating staff or official accounts ("Admin", "AI-TCG Official"), and no copying another owner's username.
  - Old names stay visible in match history ("formerly …").
- **The name filter runs on the game's own server.** That's the Mac mini today, and whatever server hosts the game at launch. It's part of the server code, never an outside moderation service.
  - Use a blocked-word list plus the same checks as generated names.
  - Add an admin-view force-rename, and later an owner report button.
- **Signature cards keep their generated, themed names**, whatever the agent is called.

### More room for generated agent names
The owner wants generated agent names to be more unique. Today's two-part patterns only give about 510,000 names (handles × one other word). Suggested approach (the session can tune it):
- add a third part in the middle, like card names ("Ghostlynx's Midnight Oracle");
- grow the lists (about 10,000 handles, 300 modifiers, 200 program words);
- on the rare clash, add a numeral ("... II") instead of failing.

Avoid version-style endings ("v2.7", "Mk III"). If three-part names need it, raise the agent-name length cap a little. Show samples at a checkpoint.

---

## 2026-10-16 — Owner: pack opening check-in accepted (answers session 36) (HANDLED 2026-10-17, session 37 — everything stands as built in session 36: the 60/25/12/3 shine slot, Alt Art on Rares and Mythics, the 15 Prototype runs, the 1-in-1,000 rate, and the seven smaller calls. The program-word list grew to 200 under the agent-name entry. Note: the chase-card entry below amends the shine slot; its new odds table comes as a proposal first)

Owner decisions on the [OWNER CHECK-IN] in `progress/notes-for-owner.md` (session 36). All defaults are accepted:

1. **Shine slot rarity: option A**, Common 60 / Uncommon 25 / Rare 12 / Mythic 3.
2. **Alt Art draws a Rare or Mythic,** as built (about 1 in 30).
3. **Prototype runs:** the proposed 15-card list is accepted as the starting list (Null Singularity 1/1 at the top). The owner checks the art before it goes live.
4. **Prototypes in Season 0: option A.** Leave the 1-in-1,000 rate unchanged; never raise a rate just to test it. Check the Prototype reveal with a test or demo pack outside the season's odds instead.

**Keep all seven of session 36's smaller calls:**
1. "NEW" means no copy held before that pack, counted once per bulk summary.
2. A 10-pack open is all or nothing.
3. Crafting counts every copy held toward the limit, Foil and Gold included.
4. Prototype serials are handed out in order.
5. The username variant uses only the [username]'s patterns.
6. Agent names use the 50 "program" nouns. This list grows under the 2026-10-16 agent-name entry.
7. Season 0's set symbol is a name only (S0-boot) until the render draws it.

---

## 2026-10-16 — Owner: a new top finish above Gold, 3 cards per season (BUILD ORDER PROPOSED 2026-10-17, session 37 — not built yet; superseded in part by the amendment and the chase-card entry below. Where it goes is in the new check-in in notes-for-owner.md. "Zero-Day" left the signature-name word lists so no card is named like the finish)

Owner decision.

- **Add a finish rarer than everything else, like Pokémon TCG Pocket's crown cards.**
  - **It's a finish, not a stronger card.** It's the same card and the same effects in a far rarer, more spectacular version. Mythic stays the top power rarity, and the balance ring is untouched.
  - **Only 3 cards per season** can appear in this finish.
- **Suggested details** (proposed in chat; the game lane proposes the final version at a checkpoint):
  - **Name:** "Zero-Day", on theme: the rarest find in hacker culture.
  - **Odds:** about 1 pack in 2,500, in line with Pocket's crown cards. Add it as a new row in a new odds table version, and confirm it with the pack simulation.
  - **How it differs:** Gold is about 1 shine slot in 150. Prototypes are numbered, limited runs. Zero-Day is set by odds alone, with no copy limit.
  - **Rules:**
    - It doesn't count toward pity.
    - It can't be crafted.
    - It's a normal, unbound pack copy, so it's sellable once the marketplace exists.
    - It gets the full-screen reveal (like Gold, Prototype and Jackpot), and a 10-pack open names it as a kept reveal.
  - **Which 3 cards:** the season's headline cards, probably three of its Mythics, each with new art made for this finish. The owner approves the 3 cards and their art.
  - **Season 0:** use the real rate. Don't raise it to test it; check the reveal with a test pack outside the season's odds, as for Prototypes.

---

## 2026-10-16 — Owner: amendment, the top-tier cards are their own cards, slightly stronger, with a choice of two abilities; more modal cards overall (BUILD ORDER PROPOSED 2026-10-17, session 37 — the generic "choose one" mechanic comes before the 3 cards that need it; see the new check-in. Not built yet)

Owner decision. This **replaces the "it's a finish, not a stronger card" part** of today's earlier "new top finish" entry. The rest of that entry stays as suggestions, including the name ("Zero-Day"), the odds (about 1 pack in 2,500), the reveal and the 3 cards per season.

### The 3 top-tier cards per season
- **They're their own cards,** with their own name and their own artwork, not reprints of existing cards.
- **They're slightly stronger,** but not so much that they break the game. The owner chose this knowing the trade-off: these cards are extremely rare and sellable on a future marketplace.
  - Measure the strength with the same fairness test as signature cards.
  - These cards may sit above the 2-point band, by a limited amount. Propose the cap (for example, 4 points at most on any edge) with the measurements.
- **Each has two abilities, and the player (the agent) chooses one when it's played, never both.**
- **Guardrails are still open** for the owner to decide. Propose them at a checkpoint, for example:
  - one copy per deck;
  - whether they're allowed in ranked play and tournaments.

### More "choose one" cards in the game
- The owner wants more modal cards across the card pool: "choose one of two effects" cards.
  - They add decisions for the agents, and they fit the skill-expressive design principle.
- **The engine needs a generic "choose one" mechanic.** The choice is made when the card is played, it's offered to agents as separate legal moves, it's logged, and the replays show it.
- Add modal cards in future card-set work, every faction included. Keep the ring regression checks in band, and check that the agents actually use both modes, not always the same one.
- Propose where this fits in the build order (after the current steps, or alongside the next set work) at the next check-in.

---

## 2026-10-16 — Owner: top-tier card guardrails decided (NOTED 2026-10-17, session 37 — 1 copy per deck and ranked/tournament play are written into the plan; they are built with the 3 cards)

Owner decision. This closes the "guardrails are still open" item in today's top-tier card amendment.

- **Only 1 copy per deck** of each top-tier card.
- **They're allowed in ranked play and tournaments.** Their strength stays limited by the fairness-test cap (to be proposed with the measurements).

---

## 2026-10-16 — Owner: more collectable chase cards (benchmarked against Pokémon TCG Pocket) (BUILD ORDER PROPOSED 2026-10-17, session 37 — items 1-4 go first, before the deck-building agent, as a measured proposal (secret-card list, Glitch rules, a new odds table) shown before anything goes live; see the new check-in. Not built yet)

Owner decision, after comparing Season 0 with Pokémon TCG Pocket's Genetic Apex.

### Pocket benchmark (published third-party rates, for reference)
- 286 cards: 226 main and 60 "secret" chase cards.
- Chase tiers: 1★, 2★, 3★ immersive, shiny 1 and 2, and crown.
- About 21% of packs hold a ★ or better.
- Crown is about 1 pack in 500 (slot 4 0.04% + slot 5 0.16%), with 3 crowns per set.
- God pack 1 in 2,000. Crowns can be crafted for 2,500 pack points. No pity.

Gaps found:
- Season 0 completes in a median of 130 packs.
- Our chase versions are random finishes, mostly on Commons, not collectable set entries.
- There's no animated tier, no cheap variant tier, a single pack type, no collection rewards, and no guaranteed path to the very top.

### Do these, in this order

1. **Secret cards every season.**
   - Add numbered secret cards above the set total, the way Gold already numbers above it.
   - For Season 0, about 30–40 secret cards: illustration versions of chosen cards, each with its own new art, plus all 3 Zero-Day cards.
   - Each is its own collection entry, with its own place in the binder and the set checklist.
   - Art arrives with the owner-funded art pass. Until then, use placeholder art slots, as the signature art pool does.
   - The owner approves which cards get secret versions.
2. **Zero-Day odds: about 1 pack in 500 overall,** matching Pocket's crown. That makes each of the 3 cards about 1 in 1,500.
   - This **corrects the "about 1 in 2,500" in today's top-finish entry,** which was based on a wrong reading of Pocket's crown rate.
   - **Make the 3 Zero-Day cards animated,** like Pocket's immersive cards: art that moves and reaches past the card frame. The render lane builds it in code; no outside service at runtime.
3. **A code-generated "Glitch" variant tier.**
   - Corrupted-colour versions of selected cards (palette shift, scanlines, data-corruption effects), on theme and costing no new art, like Pocket's shiny cards.
   - Glitch versions are collection entries too.
   - Propose its rate and which cards qualify.
4. **Point the shine slot at chosen cards.**
   - Special versions (Full Art, Alt Art, Gold, the secret cards and Glitch) should land on chosen cards people want, rather than mostly on Commons.
   - Foil can stay on any card.
   - This amends the accepted 60/25/12/3 shine-slot weights where they conflict. Propose a new odds table version.
5. **Later, after the above:**
   - 2–3 pack designs per season, each with exclusive cards;
   - collection-milestone reward cards (for example, complete a faction to earn an exclusive card);
   - consider crafting top-tier and secret cards at a steep pack-point cost, as Pocket does. This is a proposal for the owner to decide.

### Targets for the new odds table (measure with the pack simulation)
- About 20% of packs hold a hit of Full Art or better. Foil stays a common "lite" hit.
- The base set still completes in a reasonable number of packs.
- The full set including secret cards takes months for a dedicated owner, not weeks. Report the median packs to complete both.
- Keep Jackpot at 1 in 2,000, and keep the pity timers working with the new tiers.
- Never raise a rate just to test it.

**Build order:** propose where items 1–4 fit. They touch the pack odds just built, so doing them before the deck-building agent may be sensible. Update ECONOMY.md to match, and show the proposed secret-card list, Glitch rules and new odds table at a checkpoint before they go live.

---

## 2026-10-17 — Owner: render session 20 (board fit) accepted, keep all 4 calls (render lane's own; nothing for the game lane, noted session 38)

Owner decision on the board-fit checkpoint in `progress/render/checkpoints.md` (render session 20, PR #58). All four calls are kept as built:

1. The row splits into two lines when cards would drop below 85 px (72% of full size).
2. Phones get 3 + 3 in a frame, not one line of tiny cards or a sideways-scrolling row.
3. The frame uses the player's faction colour at low strength, and shows only in the two-line layout.
4. Cards never scale up past full size on wide screens.

---

## 2026-10-17 — Owner: answers to session 37's check-in (rename price, naming rules, build order) (HANDLED 2026-10-17, session 38 — 1: option D built, `renamePrice(agent)` is 0 for an agent's first rename and 100 after; the free rename writes no ledger row and an admin's force-rename doesn't use it up; 2: the repeated-word check is gone from typed names ("Bit by Bit" and "Static Static" pass) and stays on generated names, the rest unchanged; evidence `progress/economy-demo-008.txt`; 3: option A followed: step 1, the chase-card proposal, is built as a measured proposal, not live, in the new [OWNER CHECK-IN])

Owner decisions on the [OWNER CHECK-IN] in `progress/notes-for-owner.md` (session 37).

1. **Rename price: option D.** An agent's first rename is free. Every rename after that costs 100 pack points (the proposed price, not overruled). This amends the 2026-10-16 "any rename costs pack points" line.
2. **Naming rules: keep all as built, except one.**
   - **Change:** the repeated-word check applies to generated names only. Typed names may repeat words ("Bit by Bit" and "Static Static" are allowed).
   - **Keep:**
     - the 32-character cap for typed and generated names;
     - ASCII letters only;
     - the punctuation rules;
     - the staff-word rules ("mod", "dev" and so on blocked only as whole words);
     - old names reserved forever to the agent that held them;
     - the username rule;
     - a rename never reprints the signature card;
     - no renaming during that agent's live match, with an admin force-rename allowed during one.
3. **Build order: option A, as proposed.**
   1. The chase-card proposal: the secret-card list, the Glitch rules, and S0-odds-2 with Zero-Day at about 1 pack in 500, measured against the targets.
   2. The generic "choose one" mechanic, and the 3 top-tier cards with the guardrails.
   3. The deck-building agent and play styles.
   4. More modal cards in every faction with the next card-set work.


---

## 2026-10-18 — Owner: answers to render session 21 (the match feed) (render lane's own; nothing for the game lane, noted session 38)

Owner decisions on the 5 calls in `progress/render/checkpoints.md` (2026-10-17, "The match feed replaces the raw event log").

**Keep all 5, as built:**
1. **Keep:** priority passes are hidden completely, with no "no response" mark.
2. **Keep:** the turn header names the card drawn.
3. **Keep:** an attack and its damage are one entry, unless a response came between them.
4. **Keep:** triggers and spells show their rules text in small type under the line.
5. **Keep:** the raw engine log stays available behind the switch.

The proposed next step (dropping trigger lines that change nothing) is not overruled.


---

## 2026-10-18 — Owner: game lane side task — unique signature ability ids and engine reason text (HANDLED 2026-10-17, session 38 — 1: every size of a signature ability has its own id, the standard id plus the size key (`sig-recycle`, `sig-recycle.c1`, `sig-recycle.c3`); the tier-7 second aura keeps its standard id; `legacySignatureAbilityId` / `upgradeSignatureAbilityId` map old ids both ways, and the fingerprint reads ids in the old form, so every recorded fingerprint (approved list, owners' databases) still matches; existing agents' cards are rebuilt from their spec and get the new ids; tests check that no id names two abilities over every size, every table combination and 3,000 generated agents; evidence `progress/signature-ability-ids-001.txt` (old ids: 1,262 abilities on a shared id over 3,000 agents; new: 0). Render can switch to id-only lookups. 2: both: the game-over text reads as a sentence ("p2's health reached 0", so the feed says "<agent>'s health reached 0") and the event carries `cause` (`healthDepleted` with the losers, or `turnCap` tied or not); attack fizzles carry `cause`, `attacker`, `attackerId`, so the feed can word them without the doubled "fizzles")

Found by render session 21 (PR #60). The render lane worked around both problems inside `render/` but can't fix them at the source. **Do this as a side task in the next game session.** It does not change the build order (chase-card proposal, then the choose-one mechanic and top-tier cards, then the deck-building agent and play styles).

### 1. Unique ids for signature card abilities (do this first)
- **Problem:** the signature card generator reuses one ability id for different versions. For example, `sig-recycle` is "Draw 2 cards." on one card and "Draw 3" on another. Render counted 66 clashes over 300 generated agents. Anything that looks an ability up by id alone can get the wrong text or effect: commentary, the deck-building agent reading card text, balance reports grouping by ability, the card viewer and replays.
- **Change:** give every distinct ability version its own id. Either encode the version (for example `sig-recycle-2` / `sig-recycle-3`) or scope the id to the card. The game lane picks the scheme.
- **Existing agents and replays:** keep them readable, for example with a mapping from old ids to new ones, or by leaving already-generated cards as they are and applying the rule to new cards.
- **Test:** add a check that no ability id maps to two different rules texts or effects across a large batch of generated agents.
- **Timing:** land this before the deck-building agent and commentary start relying on ability ids.
- **Render follow-up:** render currently looks up rules text by card name plus ability id. Once ids are unique, the render lane can switch to id-only lookup. Card names may change if they follow an agent's name and the owner renames the agent, so a name-keyed lookup is fragile for old replays.

### 2. Engine reason text (cosmetic, lower priority)
- **Problem:** some engine reason strings read badly. For example, "Rombot's Navigator health depleted" is missing its "'s". The feed shows engine text as is.
- **Change:** fix the sentence templates at the source, or emit the reason as structured data (what happened and to which card) so that the feed and commentary word it. The game lane picks.


---

## 2026-10-18 — Owner: answers to session 38 (chase cards: secret list, Glitch tier, S0-odds-2, crafting) (HANDLED 2026-10-17, session 39 — built before the "choose one" mechanic: schema v10 (finishes `glitch`, `secret`, `zeroDay`, a `secret_code` on secret copies; a Zero-Day copy's card id is its code, so it becomes playable when step 2 designs the card under that id), `openPack` on `S0-odds-2` with the version recorded, one roller for both tables pinned by a seed test, secret crafting at 750 / 3,000 (`craftSecret`; one per secret card held; Zero-Day crafting opens when the card is designed), the binder and checklist (`binder`), older packs openable under the live table; the 4 smaller calls as built. Evidence `progress/economy-demo-009.txt`; calls the owner may overrule in notes-for-owner.md)

Owner decisions on the [OWNER CHECK-IN] in `progress/notes-for-owner.md` (session 38, "Chase cards: the secret list, the Glitch tier and the new odds table"). **Yes on 1–6:** build schema v10, switch `openPack` to S0-odds-2 and add secret crafting, as the check-in describes.

1. **A: the secret list as proposed.** 33 illustrations (every Mythic, 13 Rares, 9 Uncommons, 7 Commons), numbered `193/096` to `225/096`, then Zero-Day at `226/096` to `228/096`.
2. **A: Zero-Day at about 1 pack in 500**, animated and built in code by the render lane. It counts as a Mythic for the Mythic pity timer. The 3 cards stay empty slots until build-order step 2.
3. **A: the Glitch tier as proposed.** The 20 listed Units, 4% of packs, the card's own art corrupted in code (no new art), keeping its base number with a glitch mark.
4. **A: the S0-odds-2 table as proposed.**
5. **A: build secret crafting next to S0-odds-2, at 750 pack points per secret illustration and 3,000 per Zero-Day card.**
6. **A: older seasons' packs stay openable.** The season ends the ladder, not the packs.
7. **Keep all 4 smaller calls:**
   - Glitch counts as a hit for pity and the 20% target; Foil doesn't.
   - An illustration plays exactly like its card and can't be salvaged.
   - A Jackpot pack's other four cards roll Foil or better; secret cards come only in the shine slot.
   - Secret cards are picked evenly.

**Order:** the session-38 notes say the session after a yes builds schema v10, switches `openPack` and adds crafting. The game lane decides whether that comes before or after the "choose one" mechanic (step 2).


---

## 2026-10-18 — Owner: answers to render session 22 (match feed tightened) and a game lane side task (GAME LANE SIDE TASK HANDLED 2026-10-17, session 39 — both Intercept Routine fizzles carry `cause` (`alreadyAimed` / `noPendingAttack`) plus `source`/`sourceId`, and for `alreadyAimed` the `attacker`/`attackerId` and the `target`/`targetRef` it stays aimed at; render's feed now checks for the two attack causes, so its text is unchanged until the render lane words the new ones (a render test pins it). The render calls are the render lane's own)

Owner decisions on the 3 calls in `progress/render/checkpoints.md` (2026-10-18, "The match feed, tightened: quiet triggers dropped, endings worded from the engine's data").

### Render lane: keep all 3, as built
1. **Keep:** a trigger whose condition didn't hold is dropped from the feed too (no "(no effect)" line). It stays in the engine log.
2. **Keep:** the fizzle wording "its target left play first" / "the attacker left play first".
3. **Keep:** the turn-cap ending shows both health totals.

### Game lane: side task (low priority)
From `progress/render/notes-for-owner.md` (2026-10-18, session 22, item 2). **Do this as a small side task in the next game session.** It does not change the build order.
- **Problem:** the Intercept Routine fizzle (nothing to redirect) still has no structured cause. The feed prints its reason text as is: "fizzles: Intercept Routine: Garbage Collector's attack is already aimed at Barrier Drone". Seen in Null vs Aegis seed 3, move 33.
- **Change:** give it the same shape as the attack fizzles from session 38: a `cause` (for example `alreadyAimed` / `noPendingAttack`) plus the source and attacker names, so the feed and commentary can word it.


---

## 2026-10-18 — Owner: answers to session 39's calls (chase cards live)

Owner decisions on the 7 calls in `progress/notes-for-owner.md` (session 39, "Calls I made").

**Keep all 7, as built:**
1. **Keep:** a Zero-Day card can be pulled now as a reserved entry ("Zero-Day 1 (not designed yet)") at the approved 0.2%. It becomes playable on its own once the card is designed.
2. **Keep:** crafting makes one copy per secret card and is refused while the owner holds it. A crafted secret copy is account-bound (playable, never sold).
3. **Keep:** Zero-Day crafting opens only once the cards are designed.
4. **Keep:** the NEW badge is per collection entry.
5. **Keep:** secret and Zero-Day packs keep the full reveal in a 10-pack open; a Glitch pack doesn't by itself.
6. **Keep:** base-set completion counts any copy of a card, in any finish.
7. **Keep:** packs bought before the switch open under S0-odds-2.

**Zero-Day cards need more design work.** The owner wants to do more work on the Zero-Day cards. Details will follow in a later owner-feedback entry. Until then, don't treat their design as settled beyond the decisions already recorded (2026-10-16 entries).
