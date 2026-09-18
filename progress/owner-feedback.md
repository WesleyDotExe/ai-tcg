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
