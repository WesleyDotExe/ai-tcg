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
