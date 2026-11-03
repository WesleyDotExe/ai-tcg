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

## 2026-10-18 — Owner: answers to session 39's calls (chase cards live) (NOTED 2026-10-17, session 40 — all 7 calls stand as built, nothing to change; the Zero-Day design was left open until the entry below arrived, and is built from that entry)

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


---

## 2026-10-18 — Owner: the 3 Season 0 Zero-Day cards (designs) (BUILT AS A MEASURED PROPOSAL 2026-10-17, session 40 — not live yet. Step 2 first: the generic "choose one" mechanic is in the engine (`engine/src/cards/modes.ts`): each mode is its own legal move, the played copy carries only the chosen mode, the mode is on the play/cast/evolve event and in the log line, and the graveyard gets the printed card. Then the 3 cards, exactly as designed at your starting numbers (`engine/src/data/zeroDayCards.ts`, ids `S0-ZD1`..`S0-ZD3`, Neutral, 1 per deck). They are kept out of the card registry, so the reserved entries and closed crafting stay as they are until you agree the cap. Measured at 10,000 games per pairing against a plain stand-in (`progress/balance-report-027-zero-day.txt`). The cap proposal, the mode-use findings (Kill Switch's Lights Out is almost never picked) and the tuning options are in the new [OWNER CHECK-IN] in notes-for-owner.md. Side task: "Zero-Day" already left the name lists in session 37; it was in them only in sessions 35-36, no recorded or committed agent name used it, and owners' own databases are not reachable from the repo, so no agent is listed)

Owner decision. This follows the 2026-10-18 entry "Zero-Day cards need more design work". It builds on the 2026-10-16 entries (their own cards, slightly stronger, two abilities with the agent choosing one, 1 copy per deck, allowed in ranked and tournaments, animated, about 1 pack in 500).

### The set: three stages of a hack
The three cards tell a small story: infect, take over, shut down. In each card, the two modes pull in different directions, so the agent has to read the board to choose.

- **All three are Neutral,** playable in any deck. Three cards can't cover four factions evenly, and faction cards would tilt the faction balance.
- **Numbering:** Zero-Day 1 to 3 are `226/096` to `228/096`, in the order below.
- **Mode names** are part of the card and appear in the choice, the log, the replay and the feed.

**Zero-Day 1: Patient Zero.** Neutral Unit, 3 energy, 2/4. Choose one when played:
- **Outbreak:** "When this dies, deal 2 damage to all enemy units."
- **Carrier:** "Your other units get +1/+1."

**Zero-Day 2: Root Access.** Neutral Unit, 5 energy, 3/6. Choose one when played:
- **Privilege Escalation:** "This unit's attack equals 1 plus the number of other units in play" (both sides).
- **Lockout:** "Enemy cards cost 1 more to play."

**Zero-Day 3: Kill Switch.** Neutral Command, 7 energy. Choose one when played:
- **Lights Out:** "Stun all enemy units for 2 turns."
- **Wipe:** "Deal 3 damage to all enemy units, then draw a card."

### How to build them
- **Fixed:** the names, the faction (Neutral), the card types, and what each mode does.
- **Tunable:** the numbers (cost, stats, damage, turns) are starting points. Tune them with the signature-card fairness test, and propose the strength cap above the 2-point band with the measurements, as the 2026-10-16 entry asks. If a mode needs a different number to stay in the cap, change the number, not the idea, and say so in the notes.
- **Order:** unchanged. The generic "choose one" mechanic (build-order step 2) comes first, then these 3 cards. Also check that agents use both modes of each card, not always the same one.
- **Reserved entries:** the reserved Zero-Day entries from session 39 become these cards when they're built. Zero-Day crafting opens then.
- **Art and animation:** each needs its own artwork (the art pass is still an open item). The render lane builds the animation in code.

### Small fix: keep "Zero-Day" out of generated agent names
The signature-name word lists (`engine/src/data/signatureNames.ts`) contain "Zero-Day". Remove it, so that no generated agent card is named like the Zero-Day tier. If any existing agent already has it, list them in the notes and don't rename them without asking. The game lane can do this as a small side task in its next session.


---

## 2026-10-18 — Owner: answers to render session 23, and the pack-opening reveal is the render lane's next priority (render lane's own; nothing for the game lane, noted session 41)

### Render session 23: keep all 3, as built
Owner decisions on the 3 calls in `progress/render/checkpoints.md` (2026-10-17, "The board agrees with the feed; labels shrink with a zoomed row").
1. **Keep:** a quiet trigger gets nothing on the board (no faint ring).
2. **Keep:** a redirect fizzle takes the place of its "resolves" line.
3. **Keep:** labels shrink all the way with the card (to about 72%), with no floor.

### Next render priority: the pack-opening reveal
**This goes ahead of the render debt list.** The chase cards are live (game session 39), but the render has no pack-opening surface, so Glitch, secret illustrations and Zero-Day can't be seen in a reveal. The turn-cap ending and the momentum gauge's pending threat wait until after this work.

This builds on the earlier owner decisions, which still stand:
- **Feel like Pocket:** peel or tap to open, cards revealed one at a time, a real rare-reveal moment. A card that simply fades or pops in is a failure. The first packs and the leader reveal are the most polished moments.
- **10-pack opening (2026-10-05):** a fast sequence the owner can speed up, a summary at the end, and single-pack opening always available.
- **Full reveals in a 10-pack open:** Gold, Prototype, Jackpot, secret and Zero-Day packs keep their full reveal (2026-10-18).
- **Runtime:** finishes are code shaders, and nothing calls the network at runtime.

**Where it lives:** there's no owner website yet. Build a self-contained pack-opening page (like the replay pages), driven by real pack results from the economy's `openPack` (seeded, so a run can be reproduced). It must work at phone and desktop widths. It moves into the owner website when that exists. The reveal only shows a result that has already been rolled; it never changes what's in the pack.

**Single pack:**
1. **The pack:** a code-drawn Season 0 pack with an idle shimmer. Drag across the top to tear it open; tap also works.
2. **The cards:** the 5 cards come out as a stack. Swipe or tap through them. Plain cards move quickly, and the shine-slot card is always last.
3. **An honest tell:** if the pack holds a hit (Full Art or better, as counted for pity), the tear throws sparks. Never a fake-out: sparks always mean a hit, and no sparks means no hit.
4. **A reveal for each finish:**
   - **Foil:** a shine shader that follows device tilt or the pointer.
   - **Full Art:** the frame expands to full bleed.
   - **Glitch:** the card corrupts as it flips (RGB split, jumping block tears, scanlines), then settles with a faint glitch loop. This is the look approved in session 38.
   - **Secret illustration:** a slow-motion flip, with its number (for example `193/096`) shown above the set total.
   - **Gold:** a gold shader with sparkle.
   - **Zero-Day:** a full-screen takeover. The screen drops to black, a terminal types "ZERO-DAY DETECTED", a short breach sequence plays, then the animated card arrives. Until the 3 cards are built, show the reserved entry.
   - **Prototype and Jackpot:** keep their full moments.
5. **Summary screen:** the 5 cards with their finishes, NEW badges (per collection entry), and pack points earned, then "Open another" or "Done".

**Ten packs:** fast flips with skip and speed-up controls, a summary grid at the end, and full reveals only for the big pulls listed above.

**Sound:** a tear sound, flip ticks and a rising tone on hits, from the game's own self-contained sound system, following the sound settings.

**Build in three slices, with a checkpoint after each:**
1. Single pack plus every finish reveal.
2. Ten-pack opening plus the summary.
3. The first-time flow: an agent's first packs and the leader (signature card) reveal.

Show each slice with phone and desktop recordings or stills, and a headless check like the replay checks. Propose timings and any open details at the checkpoints.

**Art:** real pack and card artwork depends on the art pass, which is still open (build-time generated assets committed as static files, as decided 2026-10-04). Until then, use code-drawn packs and placeholder card art.

**Game lane:** if the render needs a small data hook from the economy (for example, a seeded demo that returns pack results in the shape the pack-result screen gets), note it in `progress/render/notes-for-owner.md` as an ask for the game lane rather than changing economy files.


---

## 2026-10-18 — Owner: answers to session 40 (Zero-Day strength cap, the measuring agent) and a render side task (GAME LANE HANDLED 2026-10-17, session 41 — 1: option A done: LookaheadAgent values every unit's own statics, death and turn triggers by one path (plain and modal), auras over 3 turns, statuses by kind and duration (a Barrier on your own unit no longer scores below passing); it beats the session-40 agent head to head by 1.5 points over 64,000 games; both ring baselines re-recorded once, with what moved in `progress/balance-report-028-agent-fix-zero-day-tuned.txt` (Aegis > Cortex fell 52.2 -> 49.3; three gate edges slipped IN -> UNRESOLVED). 2: cap applied at 10,000 games per pairing: Kill Switch passes as designed (3.52; Lights Out 44%); Patient Zero (5.37) and Root Access (4.18) were over; proposed numbers: Carrier +1/+0 (2.73), Privilege Escalation "the number of other units" (3.52); every mode 16.7%+ for every faction. 3: the four calls stand. 4: the final numbers are in the new [OWNER CHECK-IN]; the cards are not live yet. The render side task is the render lane's own)

Owner decisions on the [OWNER CHECK-IN] in `progress/notes-for-owner.md` (session 40, "Zero-Day cards: the strength cap, and the agent that measures it").

### Game lane
1. **Question 1: A.** Fix the reference agent first: value auras over several turns and stuns by how long they last, for every card, not only modal ones. Re-record the ring baseline once. Then re-measure the 3 Zero-Day cards, tune them to the cap and propose the final numbers.
2. **Question 2: accept the cap.** At most 4 points on any edge, measured at 10,000 games per pairing with the agent choosing the mode. Every mode must be picked in at least 10% of the games where the card is played. If a card fails, change its numbers, not its idea, and say which numbers in the notes. (Patient Zero may need a trim once Carrier is valued properly.)
3. **Keep all 4 smaller calls:**
   - Kill Switch is Sorcery speed (own turn, nothing on the stack).
   - Zero-Day cards follow their own rules, not the neutral pool's, but still count toward a deck's 10 neutral cards and its 25% removal share.
   - When a Zero-Day card that counts as removal goes into a deck at the removal cap (Null today), a removal card comes out.
   - Only the Lookahead agent is used for balance.
4. **Going live:** after the re-measure, propose the final numbers. The 3 cards go live with the owner's OK.

### Render lane: small side task
Show the chosen mode in the match feed, for example "Patient Zero (Outbreak)" or "casts Kill Switch, choosing Wipe", using the mode id and name the engine now puts on play / cast / evolve events (game session 40). Do this as a small side task alongside the pack-opening work. It doesn't replace the pack-opening priority.


---

## 2026-10-18 — Owner: answers to render session 24 (pack opening, slice 1) (render lane's own; nothing for the game lane, noted session 41)

Owner decisions on the 6 calls in `progress/render/checkpoints.md` (2026-10-17, "Pack opening, slice 1: one pack and every finish reveal").

**Keep all 6, as built:**
1. **Keep:** Foil arrives face down too and gets a flip (no sparks, since it isn't a hit).
2. **Keep:** a Prototype comes 6th, after the shine slot, as its own moment.
3. **Keep:** Alt Art gets the Full Art growth on its own composition, with a pink wash.
4. **Keep:** a second tap during a reveal is ignored until the reveal's hold ends. Skip to summary stays available.
5. **Keep:** the proposed timings, as starting points.
6. **Keep:** the showcase packs are chosen by seed search, opened and recorded by the store.

Not yet checked on a real phone, with device tilt or by ear. The owner may come back with feel notes on the pace, tilt and sound after trying the page; until then, carry on with slice 2 (the ten-pack opening and its summary grid).


---

## 2026-10-18 — Owner: answers to session 41 (Zero-Day cards go live; look at Aegis vs Cortex) (HANDLED 2026-10-18, session 42 — 1: the 3 cards are in `CARD_REGISTRY` at the approved numbers; the set leaves them out of the base numbering (still 96) and they stay secret cards 226-228/096 named from the card; a pulled copy plays (saved, loaded and played in a real match) and `craftSecret` crafts them at 3,000; a Zero-Day card has no version but its Zero-Day finish (plain/Foil/Gold refused) and `craftCard` refuses it; economy tests for both; evidence `progress/economy-demo-010.txt`. 2: investigated, no card changed: the whole move is Cortex's pilot (Aegis's pilot changes nothing), led by Mainframe Core being played more; three fixes measured, proposed at the new [OWNER CHECK-IN] in notes-for-owner.md; evidence `progress/balance-report-029-aegis-cortex-shift.txt`. 3: the four calls stand)

Owner decisions on the [OWNER CHECK-IN] in `progress/notes-for-owner.md` (session 41, "The 3 Zero-Day cards: final numbers, and going live").

1. **A: go live at the proposed numbers.**
   - **Patient Zero:** Carrier becomes "Your other units get +1/+0" (was +1/+1). Outbreak and the 2/4 body are unchanged.
   - **Root Access:** Privilege Escalation becomes "This unit's attack equals the number of other units in play" (was 1 plus). Lockout and the 3/6 body are unchanged.
   - **Kill Switch:** as designed.
   - The next game session adds the 3 cards to the card list. A pulled reserved copy becomes the real card, and Zero-Day crafting opens at 3,000 pack points, with an economy test for both.
2. **Aegis vs Cortex: look at it soon, not at the next set.** With the better agent, Aegis no longer beats Cortex (gate 52.2 to 49.3). The ring's soft counters are what keep the metagame self-disrupting. As a side task in the next game session (after the go-live), investigate why the edge moved and propose a fix at a check-in. Don't change any cards for it without the owner's OK.
3. **Keep all 4 calls:**
   - A stun turn is worth the unit's full attack.
   - A trimmed body is measured against the designed body.
   - The 10% rule is checked for each faction separately.
   - Render's replay pages made with the old agent will look slightly different when regenerated.


---

## 2026-10-18 — Owner: answers to render session 25 (pack opening, slice 2) (render lane's own; nothing for the game lane, noted session 42)

Owner decisions on the 8 calls in `progress/render/checkpoints.md` (2026-10-18, "Pack opening, slice 2: ten packs at once, and the summary grid").

**Keep all 8, as built:**
1. **Keep:** a big pull waits for a hand tear under a "BIG PULL" tag.
2. **Keep:** Skip never skips a big pull; it runs ahead to the next one.
3. **Keep:** big pulls play at full length at every speed.
4. **Keep:** the summary folds duplicates (same card, same finish) into one tile with ×N and the pack numbers, best first.
5. **Keep:** NEW is one badge per collection entry, as the binder counts.
6. **Keep:** the proposed timings in `BULK_TIMINGS`, as starting points, with 1× as the default speed.
7. **Keep:** the fast row uses the CSS finish looks; the big pull keeps its shaders.
8. **Keep:** the showcase tens are each a fresh owner's first ten packs.

As with slice 1, this hasn't been tried on a real phone yet. The owner may come back with feel notes (call 1 especially). Until then, carry on with slice 3, the first-time flow.


---

## 2026-10-18 — Owner: feel notes on the pack-opening page (slices 1 and 2): full-size art for the top finishes; a tap-driven ten-pack opening (render lane's own; nothing for the game lane, noted session 43)

The owner tried `render/output/pack-opening.html` (as merged after render session 25). Two changes for the render lane. Do them before slice 3 (the first-time flow), or as the first part of that session.

### 1. Full-size artwork for every finish rarer than Full Art
**Rule:** a finish rarer than Full Art always shows its artwork across the whole card (full bleed, like Full Art). A rarer card must never look smaller than a Full Art.
- **Gold:** full-bleed art in gold tones, with gold edges and gold lettering. Today it's a gold frame with normal-size, sepia-tinted art.
- **Prototype:** full-bleed art (each run's own unique art, as decided 2026-10-04), with the serial plate (`07/50`, `PROTOTYPE · S1`) on top. Today it's the normal frame plus the plate.
- **Secret illustrations:** full-bleed.
- **Zero-Day:** full-bleed.
- This applies everywhere these cards are drawn: the pack reveal, the summary grid and any card viewer. Placeholder art is fine until the art pass.

### 2. The ten-pack opening is tap-driven, with no stop-and-re-tear
This replaces slice 2's calls 1 (a big pull waits for a hand tear under a "BIG PULL" tag) and 6 (the fast sequence plays automatically at 1× by default).
- **Nothing plays on its own.** Each tap or swipe tears the next pack. Its cards deal into the row, and the owner taps to flip the face-down ones, then moves on to the next pack.
- **Big pulls stay in the same flow.** A big-pull pack is torn the same way as any other (it still sparks only when it holds a hit). Its full reveal then plays right there. No pause, and no second tear or swipe.
- **Remove the "BIG PULL" tag**, since there's no pause to explain.
- **Keep "Skip to summary".** It still never skips past a big pull (slice 2's call 2 stands).
- **Add an "Auto" switch, off by default,** for owners who want the old automatic sequence. The 1× / 2× / 4× speeds apply to Auto.
- Every other slice-2 call stands. Propose any new timings at the checkpoint.

Please show both changes with phone and desktop stills or recordings at the next checkpoint.


---

## 2026-10-18 — Owner: answers to session 42 (leave Mainframe Core; investigate the signature-mode ring) and a render side task (GAME LANE HANDLED 2026-10-18, session 43 — 1: left as is, baselines not re-recorded. 2: investigated, no card or option changed: the ring's signature mode puts each SET MYTHIC in the zone, which real matches don't do (they carry a generated Neutral menu card; the Mythic stays a deck card). In that mode the 71.5% is Prime Aegis's guaranteed access (+33 points alone; it dies in 1.4% of games); Null > Aegis 30.5% is Prime Aegis again and Cortex > Swarm 43.9% is Hive Mother. In a real-match stand-in Aegis > Cortex is 54.2% and the far-out edge is Null > Aegis 45.2%, because a signature card is worth twice as much to Aegis. Trials on Prime Aegis and options A/B/C in the new [OWNER CHECK-IN]; evidence `progress/balance-report-030-signature-ring-drivers.txt`. 3: the four calls stand. The render side task is the render lane's own)

Owner decisions on the [OWNER CHECK-IN] in `progress/notes-for-owner.md` (session 42, "Aegis vs Cortex: why it moved, and a proposed fix").

### Game lane
1. **B: leave it.** Mainframe Core stays "Your units get +1/+1". Accept Aegis > Cortex at 49.3% in gate mode for now, and look again with the next set. Don't re-record the baselines for this.
   - **Why:** real matches are played with signature cards in their zone. In that mode Aegis > Cortex is already 71.5%, far over its band, and B would push it to 74.8%. Weakening Cortex to fix the gate-mode number would make the mode owners actually watch more lopsided.
2. **New: investigate the signature-mode ring.** In the next game session, find out why Aegis beats Cortex so heavily (71.5%) once signature cards are in play. Also report any other signature-mode edges that are far outside their bands. Show what drives it (for example, particular signature menu options, Aegis's signature cards, or how the agent plays them), measured the same way as balance-report-029. Then propose fixes at an [OWNER CHECK-IN]. **Don't change any cards or signature options without the owner's OK.**
3. **Keep all 4 calls:**
   - A Zero-Day card exists only in its Zero-Day finish (no plain, Foil or Gold copies).
   - `craftCard` refuses Zero-Day cards and points to `craftSecret` (3,000 pack points).
   - The regenerated pack-opening page and the two updated render tests stand.
   - The note for the render lane about Zero-Day card faces (handled below).

### Render lane: small side task
Show both modes on a modal card's face (Zero-Day cards today, and future "choose one" cards), with each mode's name and rules text. Today a Zero-Day card's face shows no rules text, because the face only reads `abilities`, which is empty on a modal card. Do this alongside the 2026-10-18 pack-opening changes (full-size art, tap-driven ten-pack), in the pack page, the summary and any card viewer.


---

## 2026-10-18 — Owner: answers to render session 26, and a new feature: hold and drag a card to tilt it (parallax) (render lane's own; nothing for the game lane, noted session 43)

### Render session 26: keep all 9, as built
Owner decisions on the 9 calls in `progress/render/checkpoints.md` (2026-10-18, "Pack opening feel notes: full-size art for the top finishes, a tap-driven ten-pack, modal card faces").
1. **Keep:** Glitch and Alt Art are full bleed too.
2. **Keep:** the fan tap tears pack 1 straight away.
3. **Keep:** every face-down card is turned before a tap moves on; a tap on the row turns cards left to right.
4. **Keep:** the proposed tap timings (`BULK_TAP_TIMINGS`), including the 0.6 s hold after a hit.
5. **Keep:** Auto is remembered per viewer and starts off; the speed buttons show only while Auto is on.
6. **Keep:** in Auto, a big pull plays its full reveal by itself.
7. **Keep:** the card viewer (tap a summary tile).
8. **Keep:** long rules text shrinks (down to 68%) rather than being cut off.
9. **Keep:** the modal face layout (CHOOSE ONE, each mode named in bold with an accent bar).

### New feature: hold and drag a card to tilt it (parallax)
Once a card is revealed (in a single-pack reveal, a big pull, and the card viewer), the owner can **press and hold the card, then drag** to tilt it, like holding a real card up to the light (the Pocket-style card handling).
- **The tilt:** while held, the card tilts in 3D towards the finger or pointer, side to side and up and down (propose a maximum, for example about 15°). Letting go springs it back flat smoothly.
- **The parallax:** the layers move at different depths as it tilts. For example, the art shifts slightly inside the frame against the tilt, while the frame, text and serial plate stay on the surface, so the art looks like it sits behind a window. Full-bleed finishes get the strongest effect.
- **The shine follows the tilt:** the finish shaders (Foil holo, Gold sheen, Glitch, secret, Zero-Day) respond to the drag the same way they respond to device tilt today.
- **Tap versus hold:** a quick tap still does what it does now (turn or move on). Only a press-and-hold or a drag tilts the card, and releasing never counts as a tap. Propose the threshold (for example, a hold over about 0.2 s or a move of a few pixels).
- **Input:** works with touch and mouse, at phone and desktop sizes. Respect reduced-motion settings (a smaller tilt, no spring).
- **Art:** with placeholder art, a simple art-behind-the-frame depth is enough. When real art arrives, the art pass can supply layered art (background and foreground) for a deeper effect; note this for the art pass rather than building it now.
- **When:** build this alongside slice 3 (the first-time flow), or just before it. Show it with phone and desktop recordings at the checkpoint.


---

## 2026-10-18 — Owner: addendum, the hold-to-tilt effect works on the booster pack too (render lane's own; nothing for the game lane, noted session 43)

Addition to today's entry "a new feature: hold and drag a card to tilt it (parallax)". Same feature, also on the sealed pack.
- **Before tearing**, the owner can press and hold the sealed Season 0 pack and drag to tilt it in 3D, with the same spring back on release. The pack's shimmer and foil catch the light as it tilts, and the pack art or logo gets the same depth effect.
- **Tilt versus tear:** dragging along the tear strip at the top still tears the pack, as now. A hold or drag anywhere else on the pack tilts it. Make the tear strip clearly visible, and propose how the two are told apart at the checkpoint.
- **Keep the tell honest:** tilting must never hint at what's inside. A pack looks and behaves exactly the same whether or not it holds a hit; sparks come only from the tear, as decided.
- **Ten-pack fan:** propose whether the packs in the fan can be tilted too, or only the pack being opened.
- Same input rules as the card tilt: touch and mouse, phone and desktop, a quick tap still does what it does now, and reduced-motion is respected.


---

## 2026-10-18 — Owner: ten-pack fan tilt answered (render lane's own; nothing for the game lane, noted session 43)

Answers the open point in today's addendum "the hold-to-tilt effect works on the booster pack too": in a ten-pack opening, **only the pack being opened can be tilted.** The other packs in the fan stay still.


---

## 2026-10-18 — Owner: correction to the hold-to-tilt feature, the card moves as one piece (no art depth) (render lane's own; nothing for the game lane, noted session 43)

This corrects today's entry "a new feature: hold and drag a card to tilt it (parallax)" and its booster-pack addendum.
- **The whole card tilts as one solid object.** The artwork must not shift, move or project out inside the frame. Drop the "parallax" layer depth: no art-behind-the-frame offset, and no layered art.
- **Everything else stays:** press-and-hold then drag to tilt in 3D (up to about 15°), the spring back on release, the finish shine following the tilt, tap versus hold, touch and mouse, reduced motion, and the same behaviour on the sealed pack (only the pack being opened, in a ten-pack).
- **For the art pass:** one flat image per card is enough. No foreground/background layers or cut-outs are needed.


---

## 2026-10-18 — Owner: card art model chosen, Imagen 4 Ultra (NOTED 2026-10-18, session 43 — recorded in progress/roadmap.md item 8 with the open points; the art pass has not started and no image is generated without your OK)

The owner ran a two-round art bake-off outside the sessions (Replicate, 18 Oct 2026, under $5 total). Round 1 compared six models. Round 2 re-tested Seedream 4, Imagen 4 Ultra and Recraft V4 Pro with a composition-aware prompt, on Hive Mother, Prime Aegis, Kernel Panic, Cascade Purge and Patient Zero.

### Decision
- **The card art model is Google Imagen 4 Ultra** (on Replicate, `google/imagen-4-ultra`, 3:4 portrait). It was the only model that followed the card layout on all 5 test cards: subject inside the art window, a dark and calm lower third for the text box, no stray text and no added borders.

### Starting prompt template (to be tuned on 10–15 cards before any full run)
Each image uses `[card type, name and subject + faction colours]` followed by this shared style text:

> Trading card game illustration in a vertical card composition. The main subject sits in the upper-middle of the image with its head or key feature about one third of the way down, comfortably inside the central area so it survives a wide crop. The lower third of the image is darker, calmer and low in detail (a simple floor, mist or deep shadow) because rules text sits there. Clear, distinctive silhouette against a contrasting background; the brightest light, strongest contrast and sharpest detail are on the focal point, while the background is soft, suggestive and lower in contrast. One key light plus a coloured rim light. Limited palette of three to five colours led by the faction colours. Painterly digital painting with bold, confident brushwork that reads at small card size. Cyberpunk world with 1990s retro-futurist flair: chunky 90s computer hardware, CRT glow, subtle scanlines. No text, letters, numbers, logos, borders or card frame.

### Composition rules behind it
- **One master image per card works two ways:** the wide framed window (about 13–54% down the card) and full bleed for Full Art, Gold, Prototype, secret, Glitch, Alt Art and Zero-Day. So the subject sits in the upper-middle and the lower third stays dark and calm under the text box (64–87%).
- **Units:** one clear figure is the hero, often from a slightly low angle. **Spells/Commands:** the effect is the hero, not a caster. **Top rarities (Zero-Day and similar):** a cinematic "story moment" scene, like the Patient Zero test.
- One flat image per card, with no layers or cut-outs (see today's tilt correction).

### Notes from the test, for the art pass
- Ultra came out a little muted in places (Cascade Purge was grey-green rather than clean cyan). Try adding "vivid, saturated faction colours" when tuning.
- Imagen 4 does not take style-reference images, so set consistency comes from the shared prompt text.
- Before production, confirm the model's terms allow commercial use of outputs, since cards will be sellable.

### Not decided yet
When the art pass starts, its budget, and whether a cheaper model (such as Imagen 4 Fast) is used for any cards. Propose these at a checkpoint; don't start generating production art without the owner's OK.


---

## 2026-10-18 — Owner: answers to game session 43 (the signature-mode ring) (HANDLED 2026-10-18, session 44 — option A built: `ringRegression.ts --real` (`npm run ring:real`) plays set Mythics in the deck and an approved menu card each side, its baseline `ringBaselineReal.json` is recorded, CI runs it in place of `--signature`, and `--signature` stays runnable as a report. Session 43's draw turned out to reach only 2 of the 14 lines per seat; the new draw is truly even (each line twice per seat per 28 seeds, once going first and once second), pinned by a test; Null > Aegis is 45.4% with it (was 45.2%). Why Aegis gains most: spare late energy (measured, about a third of the gap by an ablation), the body becoming Aegis's attacker (correlational), not tools (a no-tools rule moves it +1.4). Six trials, none reaches the band; the best (Null Singularity cost 6) gives +3.8 and pushes Swarm > Null out. No card changed. Proposal in the new [OWNER CHECK-IN]; evidence `progress/balance-report-031-real-ring-aegis-gain.txt`. The 3 smaller calls stand, with call 1 now true. Render session 27's answers below are the render lane's own)

Answers the [OWNER CHECK-IN] "The signature-mode ring: what drives Aegis > Cortex at 71.5%, and what to do" in `progress/notes-for-owner.md` (PR #71, `progress/balance-report-030-signature-ring-drivers.txt`).

### Decision: option A
- **The ring's second CI check measures real matches:** set Mythics stay in the deck, and each side gets an approved menu card in the signature zone (the "real match stand-in" column). Re-record that check's baseline from the session-43 driver.
- **The set-Mythic signature mode becomes a report only,** not a CI check. Keep it runnable.
- **No card changes now.** Prime Aegis stays as it is.
- **Next game session:** find out why Aegis gains about twice as much from a signature card as the other factions (+10–12 points against 4–6), and propose a fix for Null > Aegis (45.2%, band 55–60) in the real-match mode at a check-in. Change no cards without the owner's OK.

### Smaller calls: keep all 3
1. **Keep:** the real-match stand-in draws each side's signature card evenly from the 14 approved lines.
2. **Keep:** all six edges measured at 2,500 games each.
3. **Keep:** no set Mythic can be a signature card in a real match. If set Mythics ever go in the zone, option B (Prime Aegis at cost 7) is the starting point.


---

## 2026-10-18 — Owner: answers to render session 27 (hold to tilt), keep all 8 (render lane's own; nothing for the game lane, noted session 44)

Owner decisions on the 8 calls in `progress/render/checkpoints.md` (2026-10-18, "Hold to tilt: the card and the pack lean as one piece"; PR #72).
1. **Keep:** a press held still for 0.2 s, or moved 8 px, starts the tilt; on the card stack only the 0.2 s hold starts it, so a quick sideways move is still the swipe.
2. **Keep:** the side under the finger dips away, as if pressed.
3. **Keep:** 15° at the card's edge, proportional in between, capped past the edge.
4. **Keep:** the 0.56 s spring back with a small overshoot.
5. **Keep:** a mouse hover no longer leans the card on desktop (hover still moves the shine; device tilt on a phone still leans it).
6. **Keep:** tear versus tilt on the pack is told apart by where the press starts: the top strip (about a third of the pack) tears, anywhere else tilts, marked with the lit band and the TEAR tab.
7. **Keep:** in a ten-pack only the fan's front pack tilts.
8. **Keep:** letting go of a tilt over the viewer's backdrop doesn't close the viewer; only a tap does.

Next render session: slice 3 (the first-time flow), as planned.


---

## 2026-10-19 — Owner: answers to game session 44 (Null > Aegis in the real-match ring) (HANDLED 2026-10-19, session 45 — option C tested, test only: four lists built only from Aegis cards already in the list (copy changes, linted) plus two neutral comparisons, on all six real-match edges and the gate, 10,000-seed confirmation of the best two. None of the Aegis lists gets Null > Aegis meaningfully closer without pushing another edge out (best C3: +4.8 at 10,000, Aegis > Cortex -3.9 real / -2.9 gate; C4 reaches the band only by gutting Aegis). So fallback A applies: no card changed, Null > Aegis stays accepted-OUT, and the cause is noted in roadmap.md for the next set. New finding: heavier Aegis lists use up the spare energy but don't shrink the signature gain; card draw does (+10.0 -> +5.9). Evidence `progress/balance-report-032-aegis-late-deck.txt`; an optional check-in about the neutral list N1 in notes-for-owner.md. The 3 smaller calls stand)

Answers the [OWNER CHECK-IN] "Why a signature card helps Aegis most, and what to do about Null > Aegis" in `progress/notes-for-owner.md` (PR #73, `progress/balance-report-031-real-ring-aegis-gain.txt`).

### Decision: option C, with A as the fallback
- **Next game session: test the cause directly.** Try an Aegis deck change that adds late-game plays using real Aegis cards (not test stand-ins), so Aegis's late turns aren't empty and a signature card adds less. Measure it on all six edges of the real-match ring, and the gate.
- **Test only.** Don't put any deck or card change in without the owner's OK. Bring the results and a proposal to a check-in.
- **Fallback (option A):** if no deck change built from real Aegis cards gets Null > Aegis meaningfully closer to its band without pushing other edges out, change no cards now. Keep Null > Aegis as the real-match check's one accepted-out-of-band edge, and fix it in the next set's design: give Aegis a real late-game play, and give Null an answer to one durable attacker.
- Not option B: Null Singularity stays at cost 7 for now.

### Smaller calls: keep all 3
1. **Keep:** the real-match check's baseline records Null > Aegis as out of band, and CI accepts it as long as it doesn't get worse.
2. **Keep:** the draw gives each of the 14 approved lines to each side equally, half going first and half second, never the same line on both sides in one game.
3. **Keep:** session 43's report keeps its old numbers, with a correction note at the top.


---

## 2026-10-19 — Owner: answers to render session 28 (slice 3, the first-time flow) (GAME-LANE ASKS: ability text HANDLED 2026-10-19, session 45 — every signature ability prints its option's full wording in `engine/src/data/signatureMenu.ts`, fingerprints unchanged, pinned by tests; ECONOMY.md's candidate wording updated (no art with the candidates). Call 9 HANDLED 2026-10-19, session 46 — the starter guarantee is built as option A, your example: the owner's last unopened starter pack gets a hit in its shine slot when their opened starter packs had none, drawn like hit pity, worked out from pack history at opening; the pack and tear never change, the opening records `starterHit`. Rates and the wider economy at the new [OWNER CHECK-IN] in notes-for-owner.md; evidence `progress/pack-sim-003-starter.txt` (45.8% -> 100% of owners see a hit) and `progress/economy-demo-011.txt`. Calls 5 and the rest are the render lane's own)

Owner decisions on the 10 calls in `progress/render/checkpoints.md` (2026-10-18, "Pack opening, slice 3: the first-time flow, and the signature card is made in front of you"; PR #74), and on the two game-lane asks in `progress/render/notes-for-owner.md` (session 28, items 3 and 4).

### The 10 calls: keep 8, change 2
1. **Keep:** the order is faction, starter deck, the 3 starter packs, then the agent and its signature card, with the mint as the finale.
2. **Keep:** no art on the signature pick screen. The art-pool piece is drawn when the card is made and arrives during the mint.
3. **Keep:** the mint takes about 6.5 s and can't be skipped.
4. **Keep:** the terminal prints the technical record (the fairness line's id, "passed at 10,000 games").
5. **Change: add a name field when the agent is created.** The owner can type the agent's name on the agent screen, using the store's own name rules (free at creation, as the store already allows). Leaving it blank keeps the generated name. Render lane, in the first-time flow.
6. **Keep:** no going back from the card pick to the agents (one pick per draft).
7. **Keep:** long names shrink to fit on every card (down to 66%) instead of "...".
8. **Keep:** the signature card prints its ability's full wording. Also fix it at the source (see the game-lane asks below).
9. **Change: guarantee one hit across the 3 starter packs.** Every new owner sees at least one hit (Full Art or better) in their 3 starter packs. This is a game-lane change in the economy store; the render keeps showing whatever the store rolled. The game lane proposes the method (for example, upgrading the last pack's top slot if packs 1 and 2 had no hit). It also reports the resulting starter-pack rates and any effect on the wider pack economy at its checkpoint. The tell stays honest: a pack's look and the tear never hint at a hit.
10. **Keep:** with reduced motion the mint is over in about a second, with no spin, flight or shake.

### Game-lane asks
- **Yes: fix the signature ability text at the source.** In `engine/src/data/signatureMenu.ts`, each signature ability gets its menu option's full wording, including the trigger (for example, Inspire: "At the start of your turn, a random ally gets +0/+1 permanently."). Replays and anything else that prints `card.abilities[].text` then show the full wording.
- **No: keep drawing the art piece when the card is made, not when the 3 candidates are offered** (matches call 2). Update ECONOMY.md's wording that each candidate comes with its art.
- **Order:** the session-44 option C test (the Aegis deck with real late-game cards) stays the next game session's priority. These two asks (the starter-pack hit and the ability text) come alongside it or in the session after.


---

## 2026-10-19 — Owner: answers to game session 45 (option C results) (NOTED 2026-10-19, session 46 — N1 not shipped, nothing to change; the 3 calls stand; the starter guarantee was this session's first job)

Answers the optional [OWNER CHECK-IN] "N1, the neutral card-draw list" in `progress/notes-for-owner.md` (PR #75, `progress/balance-report-032-aegis-late-deck.txt`).

### Decision: leave N1
- **Don't ship N1.** The Aegis list stays as it is. Fallback A stands: no card change now, Null > Aegis stays the real-match check's one accepted-out-of-band edge.
- Use what N1 shows (card draw roughly halves Aegis's signature gain) in the next set's Aegis design, as in the roadmap note: give Aegis its own card flow or a real late play that refills its hand, and give Null an answer to one durable attacker.

### Smaller calls: keep all 3
1. **Keep:** fallback A applied without waiting, with the roadmap note written.
2. **Keep:** the 10,000-game confirmation run on C3 and N1, not C4.
3. **Keep:** the full signature wording keeps the old text inside the fingerprint, so every stored fingerprint still matches.

Next game session: the starter-pack hit guarantee, as its first job (method, starter rates and the wider pack economy at a check-in).


---

## 2026-10-19 — Owner: answers to render session 29 (name your agent), keep all 5 (render lane's own; nothing for the game lane, noted session 46; the live "is it free" endpoint comes with the real site)

Owner decisions on the 5 calls in `progress/render/checkpoints.md` (2026-10-19, "The first-time flow: name your agent when it's made"; PR #76).
1. **Keep:** the name field appears after an agent is picked, and a typed name stays if the owner switches agents.
2. **Keep:** only the rules are checked as you type; whether the name is free is checked when the card is made. A live "is it free" check (a small game-lane endpoint) can come with the real site.
3. **Keep:** the avatar follows the typed name, so it matches the agent's matches.
4. **Keep:** the generated name stays visible, struck through, under the typed one.
5. **Keep:** the page bundles the store's own name-check code (esbuild, dev-only), so it can't drift from the store's rules.

---

## 2026-10-19 — Owner: new feature, victory boasts (a cosmetic) (GAME-LANE HALF BUILT 2026-10-19, session 47, see the session-46 answers entry below; GAME-LANE PLAN PROPOSED 2026-10-19, session 46 — not built, as asked: catalogue, ownership, the 4 free starter boasts, the per-agent loadout, the loadout saved on the match record, and an optional store-picked "close win" slot, with the 6 open decisions and suggested defaults, in the new [OWNER CHECK-IN] in notes-for-owner.md. The render half is the render lane's own)

A **victory boast** is a short animation that plays when an agent wins a match. A few are standard and free; each season, new ones can be bought in the store, alongside the other cosmetics (arena backgrounds, card backs and avatars).

### Defaults to plan with (propose changes at a checkpoint)
- **Cosmetic only.** A boast never affects play, balance, the ring or any CI check.
- **A per-agent cosmetics loadout,** set by the owner: boast, card back, avatar and arena background. The match record stores the boast equipped at match time, so a replay always plays the boast the agent had then.
- **Four free starter boasts, one per faction** (for example an Aegis shield slam, a Swarm hive burst, a Null void collapse, a Cortex data cascade). New boasts each season are bought in the store, themed to that season.
- **Celebrate the winner, never mock the loser.** About 2–4 s, at the end of the match, skippable by the viewer. A viewer can hide the other side's cosmetics. Reduced motion gets a short still version.
- **Code-drawn and self-contained,** like the pack opening: no video files and no outside services. The art pass can add matching artwork later.
- **Optional extra to propose:** the agent chooses which of its owned boasts to play based on how it won (for example a big one for a blowout, a quieter one for a close win).

### Lanes
- **Render lane:** the boast animations, the end-of-match moment in the replay and match views, and a loadout picker.
- **Game lane:** the boast item type in the store catalogue, ownership, the per-agent loadout slot, and the equipped boast saved on the match record.

### Not decided yet (propose at a checkpoint)
Pricing and which currency; whether a season's boasts stay buyable after that season ends; and whether cosmetics are account-bound or tradeable (the suggested starting point is account-bound, like the starter decks).

### When
Plan it now; build it after the current pack-opening and starter work (including the game lane's starter-pack hit guarantee). Each lane proposes its plan at a checkpoint before building.


---

## 2026-10-19 — Owner: answers to game session 46 (the starter guarantee, and the victory boasts plan) (HANDLED 2026-10-19, session 47 — the starter guarantee: kept as built, all 4 calls, nothing to change; the render note is the render lane's. Victory boasts, the game lane's half, BUILT as approved with all 6 defaults: schema v11 (`owned_cosmetics`, `agent_loadouts`, `match_loadouts`, `match_boasts`, all integrity rules in the schema); the code catalogue with the 4 free starter boasts, granted with the starter collection and once by migration to existing owners; `buyCosmetic` at 300 credits per season boast, only in its season's sale window, then retired; account-bound; per-agent loadout with 5 slots (boast, close-win boast, card back, avatar, arena), refused unless owned or during a live match, a new agent starting on its faction's boast; each side's loadout and the boast played (main, close-win on 5 health or less, or the deck faction's starter for an empty slot) saved on the match record. Evidence `progress/economy-demo-012.txt` (62 real matches, 24 of 24 boasts right); 15 tests. Season 0 sells nothing yet; the open points are in notes-for-owner.md)

Answers the [OWNER CHECK-IN] "The starter guarantee (built), and the plan for victory boasts (not built)" in `progress/notes-for-owner.md` (PR #77, `progress/pack-sim-003-starter.txt`, `progress/economy-demo-011.txt`).

### The starter guarantee: accepted as built, keep all 4 calls
1. **Keep option A:** the last unopened starter pack becomes a hit if none of the opened starter packs had one. Not option B.
2. **Keep:** any hit in a starter pack counts (a Jackpot card or a Prototype bonus included), not only the shine slot.
3. **Keep:** owners who already opened starter packs get it only if they still have one unopened.
4. **Keep:** a Zero-Day card can be the guaranteed hit (about 1.1% of upgrades), as pity allows.

**Render-lane side task:** after the reveal (never before), show a small "Starter guarantee" note on a pack where `starterHit` applied, the same way the pack page already shows "Pity: this pack was due a hit" after the reveal. The pack and the tear still never look different.

### Victory boasts: the game lane's plan is approved, with all 6 suggested defaults
- The plan as proposed: one cosmetics catalogue for all four kinds (boast, card back, avatar, arena background); an owned-cosmetics table per owner; all 4 faction boasts granted free with the starter collection (existing owners get them once by migration); a per-agent loadout with one slot per kind, refused unless owned, a new agent starting with its faction's starter boast; and each side's loadout saved with the match record, so replays show what the agents had then. A boast never reaches the engine, the agents, the ring or any CI check.
1. **Price:** 300 credits per season boast (3 packs' worth).
2. **After its season:** retired, never sold again (the shop spec's "limited edition = a sale window" rule); owners keep theirs.
3. **Account-bound:** yes, like starter decks; never sold or moved.
4. **Season reset:** cosmetics carry over. The reset clears the collection, credits and pack points, but not cosmetics.
5. **The close-win slot:** yes. A second boast slot the store picks when the winner ends on 5 health or less, otherwise the main boast, and records which one played. The agent doesn't choose.
6. **When:** build the game lane's half in the next game session. The render lane proposes its half (the boast animations, the end-of-match moment, the loadout picker) at its own checkpoint before building.


---

## 2026-10-19 — Owner: answers to render session 30 (the starter guarantee note; the render plan for victory boasts) (render lane's own; noted session 47 — the game lane's schema has landed, so the render's slice 3 can read `MatchRecord.loadouts` and `MatchRecord.boast`; boast ids are the `STARTER_BOASTS` item ids in `economy/src/cosmetics.ts`)

Owner decisions on the 2 calls in `progress/render/checkpoints.md` (2026-10-19, "The starter guarantee on the page; the plan for victory boasts"; PR #78), and on the 9 boast decisions in `progress/render/notes-for-owner.md` (session 30).

### The starter guarantee note: keep both calls
1. **Keep:** the wording mirrors the pity note: "Starter guarantee: this pack was due a hit."
2. **Keep:** the note is on the pack summary only, not on the card's reveal.

### Victory boasts, the render half: plan approved, with all 9 suggested defaults
The plan as proposed: a new "victory" event category in EFFECTS.md that always rises and radiates from the winner's side and never moves toward or touches the loser's cards or panel; the 4 starter boasts (Aegis shield slam, Swarm hive burst, Null void collapse, Cortex data cascade) as data over the existing primitives; the render plays whichever boast the match record says played and never picks one itself; the loadout picker comes last. Build order, one slice per render session: (1) the "victory" grammar, a boast spec format and the Aegis boast, with skip and reduced motion, then a checkpoint; (2) the other 3 starter boasts and the cosmetics toggle; (3) reading the loadout from the match record once the game lane's schema lands, and the close-win slot; (4) the loadout picker.
1. **When it plays:** after the lethal beat and the winner's HP bar settle, before the result line, which lands as the boast ends.
2. **Length:** about 3 s; skippable by tap, Escape or a Skip button; it plays every time a replay reaches its end.
3. **Space:** the winner's half of the board and the winner's panel; the loser's side dims to about 70%, but nothing moves on it.
4. **A draw:** no boast; the result line only.
5. **A turn-cap win:** still a win, so the boast plays. A turn-cap win on 5 health or less plays the close-win boast, as the store records.
6. **Old matches and missing loadouts:** the winner's faction starter boast.
7. **The cosmetics toggle:** one "Cosmetics: on / off" switch for spectators that hides both sides' boasts, card backs, avatars and arenas. On the owner's own pages it hides only the other side's.
8. **Sound:** a short sting in the faction's procedural voice, with the music ducked under it; muted when sound is off.
9. **Reduced motion:** the boast's final pose as a still, with the name, for about 1 s.

Next render session: slice 1 of the boast plan.


---

## 2026-10-19 — Owner: answers to render session 31 (boast slice 1, Shield Slam), keep all 7; and the Season 0 boasts (render calls: the render lane's own. GAME-LANE PART HANDLED 2026-10-19, session 48 — Boot Sequence and Dial-Up Fireworks are in the cosmetics catalogue (`SEASON_0_BOASTS` in `economy/src/cosmetics.ts`): neutral, 300 credits, sale window the whole of Season 0, retired after. "Neither goes on sale until the render lane has drawn it" is enforced: every item carries `drawn`, an undrawn item is never on sale and a purchase is refused with "the render lane hasn't drawn it"; a test reads the render's `BOAST_SPECS` and fails if `drawn` and the specs disagree, so the render lane flips `drawn` in the change that adds each spec. No card backs, avatars or arenas. Evidence `progress/economy-demo-013.txt`)

### Render session 31: keep all 7
Owner decisions on the 7 calls in `progress/render/checkpoints.md` (2026-10-19, "Victory boasts, slice 1: the victory grammar and Aegis's Shield Slam"; PR #80).
1. **Keep:** the plates slam up out of the slot floors, not down (down is the debuff direction).
2. **Keep:** a jump to the end (|> or the scrubber) plays no boast; stepping or playing into the win does, every time.
3. **Keep:** the winner's own row darkens under the crest and name.
4. **Keep:** the crest is a hex ring of plates around a centre plate, as a first take.
5. **Keep:** the match feed still says "X wins" while the boast plays; only the turn bar waits.
6. **Keep:** on a phone the page scrolls to the winner's side if it's out of view.
7. **Keep:** the music dips to 55% under the sting.

### What Season 0 sells (answers the game lane's session-47 question 1)
Season 0 sells **two season boasts**, at 300 credits each (the approved price), **on sale for the whole of Season 0**, then retired. Both are neutral (any faction's agent can equip them). No card backs, avatars or arenas go on sale in Season 0 until the render lane can draw them.
- **Boot Sequence:** the screen flickers like an old CRT powering on, a retro BIOS screen types out the winner's name line by line, then a chunky "SYSTEM READY" flash.
- **Dial-Up Fireworks:** a modem handshake screech, then pixel fireworks burst over a neon city skyline and spell out the winner's name.

Both follow the approved victory grammar (rise from the winner's side, never touch the loser) and are code-drawn. **Game lane:** add both to the cosmetics catalogue with the Season 0 sale window. **Render lane:** draw both after the 4 starter boasts (slice 2). Neither goes on sale until the render lane has drawn it.


---

## 2026-10-19 — Owner: answers to game session 48 (Guardian 3/5) and the session-47 boast calls (HANDLED 2026-10-19, session 49 — Guardian 3/5 is off the approved list (it fails its 10,000-game re-check, and the list now reads only today's agent's results); agents that hold one keep it (a stored card is rebuilt from its spec, pinned by a test). The tuner ran with today's agent (every cost-5 body at 1,000 games, the lever tuner over costs 5-7, the nearest two at 10,000): **Guardian 3/4 passes** (worst 2.00, Cortex > Swarm, exactly on the limit), so the list is 14 lines over 7 options again, Guardian kept. Evidence `progress/balance-report-034-guardian-search.txt`; the result and two calls in the new [OWNER CHECK-IN] in notes-for-owner.md. The 5 boast calls stand, nothing to change)

### The approved signature lines re-check: Guardian 3/5, option C
Answers question 1 of the [OWNER CHECK-IN] "The approved signature lines re-checked: 13 of 14 pass; Guardian 3/5 is just over" in `progress/notes-for-owner.md` (PR #81, `progress/balance-report-033-signature-recheck.txt`).
- **Take Guardian 3/5 (`sig5-3x5-guardian`) off the approved list:** new agents draw from the other 13. Agents that already have a Guardian 3/5 card keep it.
- **Have the tuner look for a Guardian line that passes with today's agent** (about an hour of games), so the menu keeps a Guardian option. Report what it finds at a check-in. If none passes, the list stays at 13.
- Question 2 (whether the approved-list generator reads today's agent's results from now on) is not answered in this entry.

### Session 47's 5 boast calls: keep all 5
Answers the "Calls you may want to overrule" in the session-47 check-in "Victory boasts: what Season 0 sells, and 5 calls made while building".
1. **Keep:** a new agent's boast is its owner's faction lock's starter boast, else its starting faction's. Agents made before the starter collection get it then.
2. **Keep:** an empty boast slot is allowed. A win with it plays the starter boast of the faction the deck played, and the record says so (`factionStarter`).
3. **Keep:** no loadout changes during a live match.
4. **Keep:** the close-win rule reads each side's final health, passed in when the match is recorded. The real server passes it once it records matches (roadmap 6b).
5. **Keep:** season reset carry-over stays a written rule until the season reset is built; then owned cosmetics and loadouts go to the new file.


---

## 2026-10-19 — Owner: session 48, question 2 answered (read the approved list with today's agent) (HANDLED 2026-10-19, session 49 — `signatureApprovedList.ts` reads only `progress/signature-fairness/agent41/` (today's agent; a new agent gets a new subfolder) and the list is regenerated from it; a test pins every line's source to that folder. Knock-on: the real-match ring draws from the list, so its seat draw was rewritten to work for any list size (session 44's needed an even one) and its baseline re-recorded, every edge within 1.7 points; see balance report 034, section 5)

Answers question 2 of the [OWNER CHECK-IN] "The approved signature lines re-checked: 13 of 14 pass; Guardian 3/5 is just over" (PR #81), left open in the entry above.
- **Yes: from now on, the approved signature list is read from today's agent's results** (the session-48 re-check, balance report 033), not the session-35 results.
- The next game session regenerates the approved list from the new results. This also applies the Guardian 3/5 answer (option C): Guardian 3/5 comes off, leaving 13, while the tuner looks for a Guardian line that passes with today's agent.


---

## 2026-10-19 — Owner: answers to render session 32 (boast slice 2), keep all 6; store wording fix for the game lane (render calls: the render lane's own. GAME-LANE SIDE TASK HANDLED 2026-10-19, session 49 — wording only: Shield Slam and Data Cascade take the render lane's suggested lines (plates slam up; pixels stream up into a stack of blocks); Hive Burst's also said the spores "spell the name", which your kept call 2 says they don't, so it now says a zig-zag column over the name, and Void Collapse's says the bars frame the name. No other catalogue change; `progress/economy-demo-013.txt` regenerated (the three "drawn: yes" rows))

### Render session 32: keep all 6
Owner decisions on the 6 calls in `progress/render/checkpoints.md` (2026-10-19, "Victory boasts, slice 2: Hive Burst, Void Collapse, Data Cascade, and the cosmetics switch"; PR #82).
1. **Keep:** Data Cascade streams up out of the row, not down (down is the debuff direction).
2. **Keep:** Hive Burst's spores form a zig-zag column of seven over the name; they don't spell the name.
3. **Keep:** Null's star is a black hole with a purple corona, turning slowly.
4. **Keep:** the silent beat of about 0.2 s between the collapse and the bloom.
5. **Keep:** Hive Burst and Data Cascade darken the winner's row from the start.
6. **Keep:** the "Cosmetics: on / off" switch is a button in the replay's controls, next to the sound buttons (it can move under a settings menu once there is one).

### Game-lane side task: update the starter boasts' store wording
The render lane's session-32 note (`progress/render/notes-for-owner.md`) says two starter boasts' descriptions in the cosmetics catalogue (`economy/src/cosmetics.ts`) still describe the first drafts. Update them to describe the boasts as drawn (see the slice 1 and slice 2 checkpoints). Wording only; no other catalogue change.


---

## 2026-10-19 — Owner: answers to game session 49 (Guardian 3/4 and the re-recorded real-match ring), keep all 3 (NOTED 2026-10-19, session 50 — all 3 stand as built, nothing to change)

Answers the [OWNER CHECK-IN] "Guardian 3/4 passes and is on the list; the real-match ring re-recorded" in `progress/notes-for-owner.md` (PR #83, `progress/balance-report-034-guardian-search.txt`).
1. **Keep Guardian 3/4 on the approved list,** as built: 14 lines over 7 options, with Guardian 3/4 in place of 3/5. It passes the same way Supply Line 3/7 does (worst edge exactly 2.00). Agents that already hold a Guardian 3/5 card keep it.
2. **Keep the real-match ring's re-recorded baseline,** as built (every edge within 1.7 points; the gate is unaffected).
3. **Keep the starter boast wording call:** Hive Burst's description now says a zig-zag column over the name, and Void Collapse's says the glitch bars frame the name, alongside the two lines the render lane named. Wording only.


---

## 2026-10-19 — Owner: answers to render session 33 (the Season 0 boasts), keep all 7; and a new feature, Match Boot (render calls and Match Boot: the render lane's own. GAME-LANE SIDE TASK HANDLED 2026-10-19, session 50 — `economy/src/dev/season0BoastsDemo.ts` steps 2-4 open with an undrawn copy of the catalogue (both Season 0 boasts' `drawn` false, as the economy test does), step 3 marks only Boot Sequence drawn, and a new step 5 shows the shipped catalogue selling both; step 1 still prints the shipped catalogue (now "drawn: yes" for both). No store code change; `progress/economy-demo-013.txt` regenerated and reproduces byte for byte. Nothing on the match record is needed for Match Boot unless the render lane names it)

### Render session 33: keep all 7
Owner decisions on the 7 calls in `progress/render/checkpoints.md` (2026-10-19, victory boasts slice 2b, Boot Sequence and Dial-Up Fireworks; PR #84).
1. **Keep:** Boot Sequence prints its BIOS lines one at a time, ending in the name typed out a key at a time in the plate.
2. **Keep:** the BIOS lines scroll up like a terminal; the CRT picture opens from its centre line.
3. **Keep:** phosphor green for Boot Sequence.
4. **Keep:** the name shows twice in Dial-Up Fireworks (spelled in firework pixels and on the plate).
5. **Keep:** the fireworks never fall; bursts fan up and out and fade.
6. **Keep:** a neutral boast keeps the winner's faction for the lit panel and the sting's voice.
7. **Keep:** the modem screech is about 0.9 s, with the music held down under it.

**Game-lane side task (small):** `progress/economy-demo-013.txt` step 2 still says both Season 0 boasts are refused because they aren't drawn. Pin the demo's step 2 to an undrawn copy of the catalogue (as the economy test now does) and regenerate the demo output. No store code change.

### New feature: Match Boot (an intro at the start of every match)
The owner likes Boot Sequence and wants a similar short intro at the start of every match, ending on a word that starts the fight.

**Defaults to plan with (the render lane proposes the details at a checkpoint before building):**
- **About 2–3 s at the start of every match and replay:** both halves of the board power on together like CRTs, each in its own faction's colour; a short terminal readout prints both agents (for example `LOADING AGENT: <name> [<FACTION>]` for each side, then `HANDSHAKE OK`); then the starting saying slams in at the centre with a sound, and the match begins.
- **Standard and free for every match,** part of the game's identity, not a store item. It is not hidden by the "Cosmetics: on / off" switch. (Sayings or intros sold as cosmetics could come later; not now.)
- **Clearly different from the Boot Sequence boast,** so the 300-credit boast stays special: the intro is split-screen, symmetric and shows both agents; the boast is the winner's solo moment with its own "SYSTEM READY" finish.
- **Neutral:** it favours neither side.
- **Like the boasts:** skippable (tap, Escape or Skip); plays when a replay starts from the beginning, not when scrubbing or jumping; a short still with reduced motion; code-drawn and self-contained, in the chunky dot font.

**The starting sayings (a mix; each match picks one):**
1. FIGHT
2. ENGAGE
3. \> RUN MATCH.EXE
4. EXECUTE
5. LINK ESTABLISHED
6. ACCESS GRANTED
7. OVERCLOCK
8. BREACH
9. \> SUDO FIGHT (rare easter egg, about 1 in 100 matches)

Sayings 1–8 have equal odds. The pick comes from the match's own seed, so a replay always shows the same saying the match had, and everyone watching sees the same one. Sayings must never use card names. Not "JACK IN" (the owner left it out).

**When:** after boast slice 3 (the replay reads the boast from the match record, and the close-win slot). Render lane builds it; if the saying needs to be stored on the match record rather than derived from the seed, the render lane names that for the game lane at its checkpoint.


---

## 2026-10-19 — Owner: answers to render session 34 (boast slice 3; the Match Boot plan), keep all 3, all 10 Match Boot defaults, and a small fix (render calls, Match Boot and the side task: the render lane's own. NOTED BY THE GAME LANE 2026-10-19, session 51 — nothing for the game lane: the sayings are frozen as "list 1" and come from the seed, so nothing goes on the match record until the list changes)

### Render session 34, boast slice 3: keep all 3
Owner decisions on the 3 calls in `progress/render/checkpoints.md` (2026-10-19, victory boasts slice 3; PR #86).
1. **Keep:** a close win is shown by the plate line only ("<BOAST> · CLOSE WIN" instead of "· VICTORY"); the boast plays as it does as a main boast.
2. **Keep:** a record the render can't use (the other side's boast, or a boast this page can't draw yet) falls back to the winner's faction starter boast. A won match never shows "no boast".
3. **Keep:** the four recorded replays sit beside the 16 recordless samples, so the "old match" path stays visible.

### Match Boot: the render plan approved, with all 10 suggested defaults
Answers the [OWNER CHECK-IN] "the plan for Match Boot" in `progress/render/notes-for-owner.md` (session 34). The plan as proposed: a new "intro" event category in EFFECTS.md, symmetric and centre-out; the beats (both halves power on together, both agent lines type at the same time, `HANDSHAKE OK` and the saying on the centre line, then the first board); and the build order (slice 1, then a sound and phone polish slice).
1. **Length:** about 2.6 s.
2. **Colour:** `HANDSHAKE OK` and the saying in neutral white-chrome; each half's own agent line in its faction's colour.
3. **Both agents' lines print at the same time,** one in each half, so neither side goes first.
4. **Line format:** `LOADING AGENT: <name> [<FACTION>]`.
5. **When it plays:** Play from move 0, or the page starting playback on its own from the start; not on page open without play, a jump, a scrub or a resume.
6. **Skip:** a tap, Escape or Skip, as the boasts do; the first move starts at once.
7. **The rare saying:** `> SUDO FIGHT` exactly 1 in 100 by the seed's hash; the other eight equally likely.
8. **Sound:** a tube thump, key clicks, a short chirp for `HANDSHAKE OK`, a hit and a rising chord under the saying; music starts after; muted when sound is off.
9. **The sayings are frozen as "list 1".** Any later change to the list asks the game lane to store the saying (or the list's version) on the match record.
10. **Name:** "Match Boot" in the code and notes; viewers never see the name.

### Render side task: two end-of-match glitches
Fix alongside Match Boot slice 1 (both predate slice 3, but they show right as the boast plays):
- At the end of the close-win replay, the momentum gauge says the loser is ahead. At the end of a match the gauge should show the winner ahead, or at least never show the loser ahead once the match is won.
- The lethal attack's smoke lingers on the loser's row. It should clear before (or as) the boast starts, so nothing is drawn on the loser's side during the boast.

Next render session: Match Boot slice 1 with these two fixes; then the loadout picker (boast slice 4).


---

## 2026-10-19 — Owner: answers to game session 51 (the deck-building agent), keep all 5, and a firm to-do (HANDLED 2026-10-20, session 52 — the 5 calls stand as built, nothing to change; the firm to-do is on `progress/roadmap.md` as a HARD GATE before the public launch ("Standing: built-deck balance before launch"): the six ring edges with built decks on both sides, from full and from realistic collections, with today's agent at the ring check's bar, Aegis called out, results and any fixes to an owner check-in, no card or deck change without your OK. Not scheduled for a particular session; tracked in quality-debt.md until done)

Answers "The deck-building agent: built decks beat the shipped decks" in `progress/notes-for-owner.md` (PR #87, `progress/deckbuilder-report-001.txt`, `progress/economy-demo-014.txt`).

### Keep all 5
1. **Keep:** "best" means best against the four shipped decks (mirror included), until there is a ladder.
2. **Keep:** two starting points, the card-rating deck and the designed list as far as the owner holds it.
3. **Keep:** the agent rebuilds when the owner's cards or faction lock change, not before every match.
4. **Keep:** owners who already had an active deck became "forced"; new owners start on "agent".
5. **Keep:** the agent's deck is one saved deck called "Agent's deck", rebuilt in place; the owner's own decks are never touched.

### Firm to-do: measure the balance with built decks before public launch
This is a launch requirement, not an optional later item. Add it to the roadmap as a gate before the public launch.
- Measure the faction ring (all six edges) with **built decks** on both sides, not only the shipped decks: from full collections, and from realistic collections (for example a starter plus a typical number of packs).
- Measure it with today's agent, at the same bar as the ring check (enough games for tight intervals), and report the results against the ring's bands.
- Pay particular attention to Aegis: its built deck is +14.3 points over its shipped deck (62.7% against the field), and Null > Aegis is already the real-match ring's one accepted-out-of-band edge.
- Bring the results and any proposed fixes to an owner check-in. No card or deck changes without the owner's OK.
- Timing: plan it into the roadmap before launch; it does not have to be the very next session.


---

## 2026-10-20 — Owner: answers to render session 35 (Match Boot slice 1; two end-of-match fixes), keep all 8 (render lane's own; nothing for the game lane, noted session 52)

Owner decisions on the 8 calls in `progress/render/checkpoints.md` (Match Boot slice 1 and the two end-of-match fixes; PR #88).
1. **Keep:** the saying swells (8%) and fades at the end, rather than fading upward.
2. **Keep:** the shorter agent line is padded with blanks, so both cursors stop together.
3. **Keep:** a tap on the playback controls doesn't skip (pause stops the intro on move 0; a step or a jump goes past it); a tap anywhere else skips.
4. **Keep:** the reduced-motion still puts HANDSHAKE OK under the saying, and drops it on a very short board.
5. **Keep:** at a win the momentum gauge jumps to full toward the winner, with "<loser> out of health" (or "<winner> won the match" for a turn-cap win).
6. **Keep:** Play at the end replays from move 0 with the intro.
7. **Keep:** OVERCLOCK, BREACH and ACCESS GRANTED stay on list 1; they share a word with a card but are not a card name. The test refuses only a saying that is, or contains, a whole card name.
8. **Keep:** the music is held at 55% under the intro for now; the "music starts after" timing belongs to Match Boot slice 2 (sound polish).

Next render-lane slices, as set: boast slice 4 (the loadout picker), then Match Boot slice 2 (sound and the phone).


---

## 2026-10-20 — Owner: answers to game session 52 (play styles), option C and keep all 6 (HANDLED 2026-10-20, session 53 — option C: the six presets and the 2-point limit stand as built, nothing to change in the engine or store. The commentary part has no owner yet: no commentator exists (build stage 7, after the render), so it is written on `progress/roadmap.md` item 8 as a requirement for whichever lane builds the commentators: propose how the commentary reads `MatchRecord.playStyles` / `LiveSide.playStyle` at a checkpoint before building, presentational only. The 6 calls stand; call 6's next step BUILT this session: the deck builder measures in the agent's style, the store builds the agent's deck in the connected agent's style and names when it needs a rebuild (schema v14); evidence `progress/deckbuilder-styles-report-002.txt` (and -001, the experiment that set the search to Calculator))

Answers the [OWNER CHECK-IN] "Six play styles: fair against each other, but most are subtle" in `progress/notes-for-owner.md` (PR #89, `progress/play-style-ring-001.txt`).

### Decision: option C
- **Keep the six presets as built and keep the fairness limit** (each style within 2 points of 50% against the field). No wider limit (not option B).
- **Give the commentary the style,** so viewers notice the difference even where it is small in the averages: the match commentary names and reflects each agent's play style (for example, noting when Fortress holds back, Rusher goes face, or Controller holds energy for a response). The style is already on the match record, so the commentary can read it.
- Whichever lane owns the commentary proposes how it uses the style at a checkpoint before building. Cosmetic and presentational only: it never changes a move or a balance number.

### Smaller calls: keep all 6
1. **Keep:** the rule is each style's score against the field within 2 points of 50%; head-to-head and per-faction results are reported, not gated (Fortress piloting Swarm and Null is weaker, accepted as flavour).
2. **Keep:** Calculator is the default style for every new and existing agent.
3. **Keep:** the style belongs to the agent, not the owner.
4. **Keep:** Controller's "hold a response" rarely matters yet; it will matter more as sets add Instants.
5. **Keep:** Gambler is randomness among good moves, not a taste for risky cards.
6. **Keep:** the deck builder still builds with Calculator; making it use the agent's style is the next step for 2b.


---

## 2026-10-20 — Owner: answers to game session 53 (the agent's deck in the agent's play style), keep all 3 (HANDLED 2026-10-21, session 54 — the 3 calls stand as built, nothing to change: the search stays Calculator, a style change asks for a rebuild, no stronger search until after the pre-launch built-deck check. That check was run this session with the builder as it is: `progress/built-deck-ring-001.txt`)

Answers the [OWNER CHECK-IN] "The deck builder searches as Calculator, and chooses in the agent's style" in `progress/notes-for-owner.md` (PR #90, `progress/deckbuilder-styles-report-001.txt`, `-002.txt`).
1. **Keep:** the search plays as Calculator and the final choice (the confirm step) plays in the agent's style, rather than every game in the style.
2. **Keep:** a style change, or connecting an agent with another style, counts as a reason to rebuild, the same as new cards or a lock change.
3. **Keep: no stronger search now.** A stronger search (more games per change, or whole packages of cards) for visibly different decks per style comes after the pre-launch built-deck balance check, which needs the builder as it is.


---

## 2026-10-21 — Owner: answers to render session 36 (the loadout picker), keep all 8; and the boast's win message (render lane's own; nothing for the game lane, noted session 54)

### Render session 36: keep all 8
Owner decisions on the 8 calls in `progress/render/checkpoints.md` (victory boasts slice 4, the loadout picker; PR #91).
1. **Keep:** Equip saves straight away, one slot at a time.
2. **Keep:** the preview loops silently; a sting plays only on a pass the owner asked for.
3. **Keep:** an item the owner doesn't own can be previewed ("not owned: preview only"); no Buy button until the store page exists.
4. **Keep:** only items on sale show as locked; a retired season item the owner doesn't own isn't shown.
5. **Keep:** card back, avatar and arena are shown, empty, with a sentence saying none exist yet.
6. **Keep:** the empty tile is offered in both boast slots.
7. **Keep:** the preview board sticks to the top on narrow screens, and a scroll restarts the running boast.
8. **Keep:** in a live match Equip stays clickable and shows the store's refusal under the banner.

### The boast's win message (render lane)
- **Everyone watching sees the boast:** both players' viewers and any spectator see the winner's boast (as built; confirming it).
- **Every boast must say clearly who won:** the boast ends on a clear **"<AGENT NAME> WINS"** message (the agent's name, then WINS), shown as part of the boast itself, not only in the turn bar. Replace or add to the current "<BOAST> · VICTORY" plate line so the win is unmistakable.
- **A close win shows a close-call line first, then the win:** for example **"CLOSE CALL"** (or "CLOSE WIN"), then **"<AGENT NAME> WINS"**. The render lane picks one of the owner's two wordings ("CLOSE CALL" or "CLOSE WIN") and shows it at the checkpoint.
- Applies to every boast (the four starters, Boot Sequence, Dial-Up Fireworks and any later one), and to the reduced-motion still. Keep the existing grammar: the message sits on the winner's side and never touches the loser's.
- Build it alongside Match Boot slice 2, or as its own small slice; show it at a checkpoint.

### Still open
The arena question from session 36's notes (which side's arena a match shows) is not answered yet; it only matters once the first arena ships.


---

## 2026-10-21 — Owner: the arena question answered (each owner sees their own agent's arena) (render lane's own; nothing for the game lane until arenas are sold, noted session 54)

Answers question 1 of the render lane's session-36 notes (`progress/render/notes-for-owner.md`, "which side's arena does a match show?"), left open in the entry above.
- **The arena is a personal view, not a shared one.** Each owner sees the arena background equipped by their own agent when watching that agent's match or its replay. In the same match, the two owners can see different backgrounds behind the same board.
- The arena never changes the board, the cards or anything else both sides see, only the background behind it.
- **Not decided yet:** what a spectator who owns neither agent sees (for example a neutral default, or the arena of the agent they follow). The render lane proposes this at the checkpoint where arenas are first built.
- Nothing to build now: Season 0 sells no arenas. Apply this when the first arena ships. The loadout picker's arena line ("the background behind the board in this agent's matches") can say it is what this owner sees.


---

## 2026-10-22 — Owner: answers to game session 54 (the pre-launch built-deck ring) (HANDLED 2026-10-22, session 55 — 1: the gate is marked PASSED on `progress/roadmap.md` and stays a standing re-run before launch and after any card change (also in quality-debt.md). 2: the test-only balance session is planned on the roadmap beside the gate ("Standing: a test-only balance session before launch"), with your terms: one or two candidates per edge, measured on the ring check in both modes and on the built-deck ring at every level, no change without your OK, both edges stay accepted-out if nothing fixes them cleanly. Not run this session (a hardening pass). 3: the measure keeps the store's own build, nothing to change)

Answers the [OWNER CHECK-IN] "The built-deck ring: built decks keep the ring's shape; no new problem, two old ones" in `progress/notes-for-owner.md` (PR #92, `progress/built-deck-ring-001.txt`).

1. **The built decks pass the launch gate,** as built. The gate stays a standing check: re-run the built-deck ring before launch and after any card change.
2. **The two old edges (Null > Aegis inverted, Cortex > Swarm too even): a test-only balance session before launch.**
   - Before the public launch, run a balance session that tests one or two candidate card fixes per edge, measured on both the ring check (shipped decks, real-match and gate modes) and this built-deck ring, at every collection level.
   - Test only: no card, deck or rule changes without the owner's OK. Bring the candidates and their full results to an owner check-in.
   - If no candidate fixes an edge cleanly (without pushing another edge out or making a faction dominant), both edges stay as the accepted-out edges.
   - It does not have to be the very next game session, but it must happen before launch; plan it on the roadmap alongside the gate.
3. **Keep:** the measure uses the store's own deck build (the one owners get), not the stronger build.


---

## 2026-10-23 — Owner: answers to game session 55 (a rebuild waits for usable cards), keep (NOTED 2026-10-23, session 56 — kept as built, nothing to change: old decks keep the old rule until their next rebuild)

Answers the [OWNER CHECK-IN] "A rebuild now waits for cards the deck could use" in `progress/notes-for-owner.md` (PR #93, `progress/economy-demo-016.txt` section 7).
- **Keep:** a deck saved before session 55 keeps the old rule (any card change is a reason to rebuild) until its next rebuild; nothing is migrated. From its next rebuild on, only cards the deck could use count.


---

## 2026-10-23 — Owner: answers to render session 37 (the boast's win message), keep all 8 (render lane's own; nothing for the game lane, noted session 56)

Owner decisions on the 8 calls in `progress/render/checkpoints.md` (the boast's win message, "<AGENT NAME> WINS" and CLOSE CALL first; PR #94).
1. **Keep:** CLOSE CALL, not CLOSE WIN.
2. **Keep:** a close win's boast runs 0.6 s longer (3.6 s), so the winner's line holds as long as in any other win.
3. **Keep:** CLOSE CALL holds 0.6 s alone, then swaps to the winner's line in the same place.
4. **Keep:** CLOSE CALL is amber, the same for every faction.
5. **Keep:** WINS is white, the name keeps the boast's colour, and WINS stamps in 0.16 s after the name.
6. **Keep:** "· VICTORY" is dropped; the small line under the name is just the boast's name.
7. **Keep:** a long name shrinks the whole line, WINS included, to fit the plate.
8. **Keep:** the reduced-motion still swaps the words too (1.6 s on a close win).

Next render-lane slice, as set: Match Boot slice 2 (sound and the phone).


---

## 2026-10-24 — Owner: answers to game session 56 (the owner API), keep all 4; and a question on the minimum deck size (HANDLED 2026-10-25, session 57 — the 4 calls stand as built, nothing to change. The deck-size question answered test only, no rule change: `progress/deck-size-report-001.txt` (`engine/src/dev/deckSizeCheck.ts`), results and a recommendation in the new [OWNER CHECK-IN] in notes-for-owner.md. In short: the rule is 20-40 cards (`engine/src/data/decks.ts`); the demo's deck was short because that owner holds only 27 usable Null cards; a shorter deck does win more, about +3 to +5 points at 20 cards against the same cards at 40, because matches end before a short deck runs out)

Answers the [OWNER CHECK-IN] "The deck settings over HTTP: four small calls" in `progress/notes-for-owner.md` (PR #95, `progress/owner-api-demo-001.txt`).

### Keep all 4
1. **Keep:** "rebuild now" builds even when nothing asks for it.
2. **Keep:** a faction lock the owner's cards can't build is accepted; the rebuild then fails with the reason, and no match starts until the active deck fits the lock.
3. **Keep:** another owner's deck or agent answers "not found", not "not yours".
4. **Keep:** the latest rebuild job is remembered in memory only; a saved job history can come with the notifications endpoints.

### Game-lane question: confirm the minimum deck size rule
In the owner API demo, a Null-locked owner (starter plus 10 packs, Controller style) got a **26-card** agent deck. Please confirm, at the next owner check-in:
- What the minimum (and maximum) legal deck size is today, where it is defined, and whether a deck under 40 cards is intended (for example only when the owner doesn't hold enough usable cards) or a builder choice the builder can make even when 40 are available.
- Whether a shorter deck gives an advantage (drawing its best cards more often), measured against 40-card decks built from the same holdings, and whether the deck builder prefers short decks when it doesn't have to.
- A recommendation, if anything should change (for example a higher minimum, or building to 40 whenever the owner holds enough usable cards). Test only: no rule change without the owner's OK.

---

## 2026-10-26 — Owner: answers to render session 38 (Match Boot slice 2, sound and the phone), keep all 8

Owner decisions on the 8 calls in `progress/render/checkpoints.md` (Match Boot slice 2; PR #96).
1. **Keep:** the music starts after the intro, from the top of the track, with about a 1 s fade-in.
2. **Keep:** the intro's last sounds ring out at its natural end.
3. **Keep:** the intro has its own power-on sound (the degauss hum), not Boot Sequence's tube.
4. **Keep:** the rare "> SUDO FIGHT" saying gets its own sound (three blips climbing an octave).
5. **Keep:** all intro sounds at pan 0 (centre).
6. **Keep:** on a phone, agent lines break onto two rows only when one row is under 15 px and two rows come out at least a fifth bigger.
7. **Keep:** the finger-sized Skip (at least 88×44 px) on touch screens, intro only.
8. **Keep:** a sound more than 120 ms late is dropped, never played late.

Next render-lane slice, as set: move the victory boasts' sounds onto audio-clock scheduling (the same on-time fix the intro got).
Known gap noted: nobody has listened on a real device yet; the owner will try a match on his phone.

---

## 2026-10-26 — Owner: answers to game session 57 (the deck-size check), option B (HANDLED 2026-10-27, session 58 — built: the builder builds every deck to `largestDeck` (engine `deckbuilder/deckBuilder.ts`): 40 when the owner holds 40 usable cards for it, else every usable card; its search only swaps, so it never cuts a deck short. The legal range stays 20-40 (`data/decks.ts` unchanged). The store refuses an agent deck of any other size and names an older short agent deck as a rebuild reason. Both rings re-run: `ring`/`ring:real` PASS, unchanged (shipped decks); the built-deck ring in `progress/built-deck-ring-002.txt`; results at the owner check-in in notes-for-owner.md. Null's 36 -> 40 stays with the pre-launch balance session, per the next entry)

Answers the [OWNER CHECK-IN] on the minimum deck size in `progress/notes-for-owner.md` (PR #97).
- **Option B:** the builder builds to exactly 40 cards whenever the owner holds 40 usable cards for the deck; otherwise the deck uses every usable card the owner holds (at least 20). The builder no longer cuts a deck short when 40 are available.
- The legal range stays 20–40; only the builder's behaviour changes.
- As the session proposed: the next game session builds this, re-runs both rings (the ring check and the built-deck ring), and reports the results at an owner check-in.
- **Not decided yet:** whether Null's list and starter grow from 36 to 40. The pre-launch balance session may bring candidate cards for it alongside the two old-edge fixes; no card, deck or rule change without the owner's OK.

---

## 2026-10-26 — Owner: every starter deck has the same number of cards (Null's grows to 40) (NOTED 2026-10-27, session 58 — decided, not built: the 4 cards are chosen in the pre-launch test-only balance session, written into that roadmap item; no card added without the owner's OK. Until then the Null starter stays 36 and a Null owner who holds only it builds 36 under option B)

Answers the "Not decided yet" line in the entry above (Null's starter at 36 cards).
- **Decided:** all faction starter decks have the same number of cards. Null's starter grows from 36 to 40 to match the others, with Null's card list growing as needed to make that possible.
- The 4 added Null cards are chosen in the pre-launch balance session: bring the candidates and their full results (ring check and built-deck ring) to an owner check-in. No cards are added without the owner's OK.

---

## 2026-10-29 — Owner: answers to game session 58 (option B built; Null falls behind) (HANDLED 2026-10-29, session 59)

Answers the [OWNER CHECK-IN] "Option B is built; without its short deck, Null falls behind" in `progress/notes-for-owner.md` (PR #99, `progress/built-deck-ring-002.txt`).
- **Keep option B as built.** No 36-card exception for Null (not B2).
- **The pre-launch balance session is the next game session,** with Null's 4 added cards (its 36 → 40 list, so every starter is the same size) as its first job, then the two old edges (Null > Aegis, Cortex > Swarm) as planned.
- Test only: bring the candidate cards and their full results (ring check and built-deck ring, every collection level) to an owner check-in. No card is added without the owner's OK.

**Handled, session 59:** option B kept as built (no change). The balance session started with Null's 4 added cards: a search over every legal add, four sets on the ring check (the ring's own seeds and a fresh block, both modes), three on the built-deck ring at every level, each run on a repo copy where the set really shipped. Results in `progress/balance-report-035-null-forty.txt`; the candidates and a recommendation (set A) are the [OWNER CHECK-IN] in `progress/notes-for-owner.md`. No card changed. The two old edges are the balance session's next job.

---

## 2026-10-29 — Owner: answers to render session 39 (the victory boasts' sounds on the audio clock), keep all 5

Owner decisions on the 5 calls in `progress/render/checkpoints.md` (PR #98).
1. **Keep:** a skip cuts a boast's sounds in 30 ms, the sting included, the same as the intro.
2. **Keep:** at its own end the sting rings out over the result line.
3. **Keep:** the boasts keep panning by where each sound happens on the winner's side; the intro stays dead centre.
4. **Keep:** a sound more than 120 ms past its time when it could be queued is dropped, never played late.
5. **Keep:** with effects muted, the music is no longer held under the sting.

---

## 2026-10-29 — Owner: answers to render session 40 (hardening pass), keep all 3; yes to the CI browser check

Owner decisions on the 3 calls in `progress/render/checkpoints.md` and the question in `progress/render/notes-for-owner.md` (PR #100).
1. **Keep:** the halo is cut at the edge of the winner's side.
2. **Keep:** the loser's clear also fades the winner's particles that reach the loser's side.
3. **Keep:** one Skip size rule for the intro and every boast (touch screens only).

**CI browser check: yes.** Next render-lane slice, as set: build the CI-sized headless-browser check (the six boasts' "nothing past the winner's side", the Skip sizes, one replay's intro) and run it on every push.
- The owner OKs this slice changing the shared workflow files (`.github/workflows/test.yml` and the auto-merge workflow) for this check and the wait below only.
- **Condition:** in the same change, lengthen the auto-merge job's wait for checks so the longer test run can't time it out. Its current 5-minute wait already timed out once (PR #88, tests green). Keep the extra run time as small as practical, and report the new test-run time and the new wait at the checkpoint.

---

## 2026-10-30 — Owner: answers to game session 59 (Null's 4 added cards), set A (HANDLED 2026-10-30, session 60 — shipped: `NULL_CARDS` is 40 (+1 Fork Bomb, +1 Segfault Handler, +2 Rollback Point), so the Null starter is 40 too. Before re-baselining, `npm run ring` failed on exactly the predicted edge (gate Swarm > Null 57.1 IN BAND -> 54.3 UNRESOLVED); both baselines re-recorded, `ring`/`ring:real` PASS. The built-deck ring on the shipped list (`progress/built-deck-ring-003.txt`) is byte-identical to session 59's candidate-A run. Results at the owner check-in in notes-for-owner.md; neutral cards in the starter and the 10/40 removal cap kept as told. Job 2 (Null > Aegis, Cortex > Swarm) is the next game session's)

Answers the [OWNER CHECK-IN] "Null's 4 added cards (36 -> 40): recommend set A" in `progress/notes-for-owner.md` (PR #101, `progress/balance-report-035-null-forty.txt`).
- **Ship set A:** +1 Fork Bomb, +1 Segfault Handler, +2 Rollback Point. Null's starter and shipped list go from 36 to 40.
- As the session proposed: the next game session ships it, re-records both ring baselines (the gate's Swarm > Null moves for any 40-card list), and re-runs both rings and the built-deck ring. Report the results at the next owner check-in.
- **Keep:** A's 2 neutral cards in Null's starter. Neutral cards in a starter are fine: they are genuine tactics a deck can use.
- **Keep:** Null at the 25% removal cap (10 of 40) is fine; it is within the rules.
- Then, as planned: the balance session's second job (Null > Aegis and Cortex > Swarm), test only.

---

## 2026-10-31 — Owner: answers to render session 41 (the CI browser check)

Owner decisions on the 4 calls in `progress/render/checkpoints.md` (PR #102).
1. **Keep:** no audio in CI; the sound checks stay by-hand session evidence.
2. **Change: download a pinned Chromium each run** instead of using the runner's own Chrome. A Chrome update on GitHub's image must not turn the check red with no code change, because a false red strands an overnight PR until the owner steps in. The extra 20-30 s is accepted (well inside the 12-minute wait). Keep it outside the repo's dependencies, as now. The owner OKs this change to `.github/workflows/test.yml` for this purpose only.
3. **Keep:** the auto-merge wait at 12 minutes.
4. **Keep:** three boasts at a time.

Next render-lane slice, as set: add one replay's end (the lethal beat, then the boast) to the CI browser check. Do the pinned-Chromium change (call 2) in the same slice. Report the CI step's time and the whole test run's time on that PR's own CI run.

---

## 2026-10-31 — Owner: answers to game session 60 (set A shipped; hardening pass), keep all 3 (HANDLED 2026-10-31, session 61 — all 3 kept, nothing to change; job 2 run as told, test only: candidates screened on the ring check, the lead ones through the built-deck ring at every level, results in `progress/balance-report-037-old-edges.txt` and the [OWNER CHECK-IN] in notes-for-owner.md; the full-collection column read as noisy, the pack columns weighted. No card changed)

Answers the [OWNER CHECK-IN] "Set A is shipped; both rings re-run" in `progress/notes-for-owner.md` (PR #103, `progress/balance-report-036-null-forty-shipped.txt`).
1. **Keep:** only the gate and real-match ring baselines were re-recorded; the signature-mode ring keeps its old baseline.
2. **Keep:** the render replays with Null in them regenerated, and the close-win scenario's seed moved from 5 to 3.
3. **Keep:** the realistic collections file updated in place (session 54's version stays in git history).

Next game session, as planned: the balance session's job 2 (Null > Aegis and Cortex > Swarm), test only, to an owner check-in. Read the full-collection column as noisy (one deck per faction); weight the pack columns.

---

## 2026-10-31 — Owner: answers to render session 42 (one replay's end in the CI check; a pinned Chromium), keep all 4

Owner decisions on the 4 calls in `progress/render/checkpoints.md` (PR #104).
1. **Keep:** the boast's lead after the lethal beat is checked at half its length (at least 450 ms).
2. **Keep:** the loser's clear stays on the effects' own clock, as built; the check measures from when the clear really ends.
3. **Keep:** the system libraries come from the image, installed only if the browser can't start.
4. **Keep:** the four end-of-replay runs go at once.

Next render-lane slice, as set: a "tap to skip" hint.

---

## 2026-11-01 — Owner: answers to game session 61 (the two old edges), ship NA12 and CS7 (HANDLED 2026-11-01, session 62 — both shipped as measured: `nullCards.ts` Null Pointer and `cards.ts` Force Quit are modal, the registry byte-identical to session 61's measured NA12+CS7 (same hash). Removal cap checked (`engine/src/dev/removalCapCheck.ts`, `progress/old-edges-ship/removal-cap.txt`): both of Null Pointer's modes count as removal, but the card already counted through its printed mode and the lint counts a card once, so Null stays 10/40, exactly at the cap; starter = list; lint passes. Both ring baselines re-recorded; `ring`/`ring:real` PASS; the built-deck ring (`progress/built-deck-ring-004.txt`) byte-identical to session 61's; render replays regenerated. One finding for the owner: the engine floors max health at 1, so Null Out never kills an undamaged unit (it leaves a 3/3 at 0/1); it was measured that way. Results at the owner check-in in notes-for-owner.md)

Answers the [OWNER CHECK-IN] "The two old edges: one partial fix, one fix with a cost" in `progress/notes-for-owner.md` (PR #105, `progress/balance-report-037-old-edges.txt`).
1. **Null > Aegis: ship NA12 as a partial fix.** Null Pointer becomes "choose one": Dereference (destroy target enemy directive), or Null Out (target enemy unit gets -3/-3 permanently). Still 2 energy, instant speed, Uncommon. The full-collection Null > Aegis gap stays open: design the full fix into the next set, as planned.
2. **Cortex > Swarm: ship CS7.** Force Quit becomes "choose one": Terminate (destroy target enemy directive), or Kill All (deal 1 damage to all enemy units). Still 2 energy, instant speed. The gate-mode overshoot (61-63%, no signature cards) is accepted, because real matches always have signature cards and the ring check still passes.
3. **Both ship: OK** with Null slightly ahead of Cortex (55.3% on shipped decks, 51-52% with built decks).

**Keep** the three calls: the fixes are new card modes rather than number changes (fine before launch); no Aegis-side candidate taken further; Null ~ Cortex read as "still even" while it stays inside 45-55.

**Check to add when shipping:** Null is exactly at the 25% removal cap (10 of 40). Confirm whether Null Pointer's new -3/-3 mode changes how it counts against the removal cap, and that Null's list and starter still fit the cap. If it doesn't fit, don't ship NA12; bring the options to an owner check-in.

As the session proposed: the next game session ships them, re-records both ring baselines, re-runs both rings and the built-deck ring, and regenerates the render replays that change. Report the results at the next owner check-in.

---

## 2026-11-01 — Owner: Season 0 is the MVP; both lanes prioritise it (NOTED 2026-11-01, session 62 — standing direction for both lanes; the Season 0 checklist is at the top of `progress/roadmap.md`, kept current each game session; the next game session starts game item 1, match running and the ladder)

The owner's direction for both lanes: **Season 0 (in-house) is the MVP, and it now comes first.** After the work already set (game lane: ship NA12 and CS7; render lane: the "tap to skip" hint), each lane works down its Season 0 list below before any other roadmap growth. Fixing what's broken (a CRITICAL quality-debt item) still comes first, as always.

### Owner decisions for Season 0
- **Who plays:** the owner and the house's own agents only. No public or invited sign-up for Season 0.
- **Where it runs:** on the owner's Mac mini. No external services (the no-external-reliance rule stands).
- **Card art:** placeholder art for Season 0. The Imagen 4 Ultra art pass waits until before the public launch.
- **Daily reset:** midnight Sydney time (Australia/Sydney, following daylight saving), for the daily win schedule and any daily rewards.

### Game lane: Season 0 list, in order
1. **Match running and the ladder** (roadmap 6b): the server runs many matches, assigns opponents, records results, Glicko-2 ratings per owner and credit payouts; agents rebuild their decks between matches when the rebuild reasons say so; the server passes final health when it records a match (for the close-win boast). This closes the loop: play -> earn -> open packs -> rebuild -> play.
2. **The rest of the server endpoints** (roadmap item 3), added to `server/OWNER_API.md` as they are built: wallet and collection (balance, ledger, copies, binder); buying and opening packs; the cosmetics store and loadouts; match history with replays; live and featured matches; ladder standings and stats.
3. **Season end** (when Season 0 nears its end, not before): retiring unpulled Prototype runs and the Season 0 -> Season 1 reset. Whether cosmetics carry over a reset is not decided yet: raise it at an owner check-in when this work starts.

### Render lane: Season 0 list, in order
1. **The website basics** (roadmap 4-6), built on the game lane's endpoints as they land: sign-in; the owner's agent and its settings (deck choice, faction lock, play style, rebuild); the collection and binder; pack opening and the store/loadout picker (reusing the existing pages); match history with replays.
2. **Live viewing:** watch a match as it happens, and a featured-matches feed.
3. **The ladder page.**

`server/OWNER_API.md` is the contract between the lanes: the game lane writes each endpoint into it; the render lane builds against it. If the render lane needs an endpoint that doesn't exist yet, it says so in its notes for owner and builds a different page in the meantime.

### Deferred until after Season 0
Launch-scale storage and its load test (still a hard gate for the public Season 1 launch), payments, the card art pass, AI commentators, tournaments, quests, the published-odds page, the next card set and 3D pack opening.

### Tracking
Add a **Season 0 checklist** near the top of `progress/roadmap.md` with every item above marked done or not, and keep it current each session, so the owner can see how far Season 0 is at a glance.

---

## 2026-11-01 — Owner: the Season 0 website is the 2026-10-05 desktop spec, trimmed (amends the entry above) (NOTED 2026-11-01, session 62 — the checklist in `progress/roadmap.md` follows this list, incl. the extra game-lane endpoints: board layout and background, notifications, the match feed and live state)

This amends the render lane's list in "Season 0 is the MVP" above. That entry's "website basics" means **the desktop website the owner approved on 2026-10-05** ("website first, with a customisable widget board", and its build order steps 3-6). Build to that spec and to `render/reference/owner-web-mockup.html`: a desktop browser, no phone app, the phone layout still parked. Every rule in that entry still applies.

### In the Season 0 MVP (render lane, in this order)
1. **Site layout and the full pages:** the glass sidebar and top bar (credits, pack points, the Open button, theme, notifications, account); full-screen pack opening; Agent match and Watch live (big board left, play-by-play and controls right); Collection (the wide binder); Store (packs and cosmetics, with the existing loadout picker); Stats; Settings; Connect agent; the admin view; dark mode.
2. **The look:** the frosted-glass style, the liquid WebGL backgrounds with the background picker (Glacier default; Ocean, Aurora, Sunset, Lavender, Graphite; Plain black and Plain purple), and the accessibility and performance rules in that entry.
3. **Home as the widget board:** the 12-column grid, S/M/L sizes, Customise mode (move, resize, remove, Add widget, Background, Recommended layout), the empty state, the layout saved to the owner's account, the widget limits and narrow-window stacking. **Season 0 widgets:** My agent, Live match, Watch live, Packs, Collection, Showcase, Ladder, Rating & form, Match history, Notifications and Store, plus Daily rewards showing the earnings bar and rewarded wins only (no quests yet). The Recommended layout swaps the Tournament slot for one of these.
4. **Live play:** auto-play, the 2× vote (both owners must agree) and Watch live, as full pages and widgets.
5. **The ladder** as its full page.

### After Season 0
The Tournament page and widget, quests (and the quest parts of Daily rewards), the League pull feed, the title screen and its live ticker, and the phone layout (still parked). The Tournament entry in the sidebar can be hidden or shown as "coming soon" for Season 0: propose which at a checkpoint.

### Game lane: endpoints the Season 0 website needs
In addition to the endpoints listed in the entry above: the saved board layout and background choice; notifications; the match feed and live state Watch live and the Live match widget need. Tournament endpoints wait until after Season 0.

Update the Season 0 checklist in `progress/roadmap.md` to match.

---

## 2026-11-01 — Owner: answers to render session 43 (the "tap to skip" hint)

Owner decisions on the 5 calls in `progress/render/checkpoints.md` (PR #106).
1. **Keep:** the words, "or tap anywhere" on a touch screen and "or click anywhere · Esc" with a mouse, in lower case under the button (but see call 4 for the intro).
2. **Keep for now, then change on the website:** on standalone pages the hint shows until the first skip on that page, not stored. **Once the owner website exists, remember it on the owner's account:** after the owner's first skip, the hint isn't shown again in the website. Build that with the website's account settings; no browser-storage version.
3. **Keep:** shown from the start of the boast or intro, for its whole length.
4. **Change:** the intro's hint reads **"or click the board · Esc"** with a mouse, because a click on the playback controls does the control's job rather than skip. Touch stays "or tap anywhere" only if a tap anywhere really skips the intro; otherwise use "or tap the board". Boasts keep "or click anywhere · Esc".
5. **Keep:** left out, not moved, when it doesn't fit.

Small follow-ups (calls 2 and 4) go into the next render session alongside its Season 0 work; the next slice stays the owner's Season 0 list, item 1 (the desktop website).

---

## 2026-11-01 — Owner: answers to game session 62 (NA12 and CS7 shipped) (HANDLED 2026-11-01, session 63 — text only, as told: Null Out reads "Target enemy unit gets -3/-3 permanently (it can't take health below 1)." (`nullCards.ts`, the mode and its ability), and Deprecated Routine, the one other -X/-X card, gets the same words ("... gets -2/-2 permanently (it can't take health below 1)."); the measured candidates NA12/NA8 in `oldEdgesCandidates.ts` match. No effect changed: `npm run ring` PASS with every number +0.0. The five replays that print the text regenerated (only the text differs, plus first-time's random pack ids). Calls 2 and 3 kept; the Null ~ Cortex edge stays on watch)

Answers the [OWNER CHECK-IN] "NA12 and CS7 are shipped; both rings re-run" in `progress/notes-for-owner.md` (PR #107, `progress/balance-report-038-old-edges-shipped.txt`).
1. **Keep the health rule:** a stat change never takes a unit's max health below 1; a shrink kills only together with damage. No rule change. **Change the card text** so it says so: Null Out reads "target enemy unit gets -3/-3 permanently (it can't take health below 1)". Text only: the card's behaviour and the measured numbers don't change. Use the same wording on any other -X/-X card the rule affects (for example Deprecated Routine) if its text would otherwise suggest a kill.
2. **Keep:** the recorded "empty boast slot" scenario moved to seed 9 (a non-close Cortex win).
3. **Keep:** the three render pages (fx-sheet, skin-sheet, pack-opening) are left for the render lane to refresh.

**Accepted:** Null ~ Cortex at 57.1% for Null in real matches with shipped decks (above the 55.3% quoted at session 61's check-in, and above the even band's top of 55). With built decks the factions are closer together than before (spread 4.3). Keep watching this edge: flag it at a check-in if it moves further out, or if built decks put it above 55 at any level.

Next game session, as planned: Season 0, game item 1 (match running and the ladder).

---

## 2026-11-01 — Owner: answers to render session 44 (the owner website, first slice), keep all 6; small website endpoints before match running (game-lane part HANDLED 2026-11-01, session 63 — built, tested and written into `server/OWNER_API.md`: `GET /api/me` (display name, login, kind, isAdmin); `GET`/`PATCH /api/account/settings` (theme, background, sound and music on/off + volume, skipHintSeen; schema v15, saved on the account, all-or-nothing patches, 400 with the reason for a bad one); `GET /api/wallet` (credits, pack points, unopened packs oldest first). Evidence `progress/owner-api-demo-003-account.txt`, incl. a server restart on the same file. The Season 0 checklist updated; match running is next. Calls 1-6 are the render lane's)

Owner decisions on the 6 calls in `progress/render/checkpoints.md` and the notes in `progress/render/notes-for-owner.md` (PR #108).
1. **Keep:** Tournament shown greyed in the sidebar with a "Soon" badge; clicking it says tournaments come after Season 0.
2. **Keep:** pages without an endpoint say in plain words what they'll hold and which endpoint they wait on (no sample data, not hidden).
3. **Keep:** the render lane's small host (`render/src/site/siteHost.ts`) serves the page and passes /api through, so the browser sees one origin.
4. **Keep:** signed in for the life of the tab (session storage).
5. **Keep:** the theme isn't saved until the account-settings endpoint exists; then it saves to the owner's account (no browser storage).
6. **Keep:** the trimmed title screen for now; the full title screen and ticker stay after Season 0.

Next render-lane slice, as planned: Season 0 render item 2, the look (the liquid WebGL backgrounds and the background picker).

### Game lane: change to the Season 0 order
**Before match running and the ladder, add the small endpoints the website is waiting on,** written into `server/OWNER_API.md` with tests, so the render lane isn't blocked:
1. **Who am I:** the signed-in owner's display name and whether they are the house admin.
2. **Account settings:** theme, background choice, sound and music, and "the skip hint has been seen" (the owner's session-43 call 2), saved to the owner's account.
3. **Wallet:** credits and pack points, and the packs waiting to be opened (for the top bar's Open button).

Then Season 0 game item 1 (match running and the ladder), then the rest of the endpoints as listed. Update the Season 0 checklist in `progress/roadmap.md` to match.

---

## 2026-11-01 — Owner: answers to render session 45 (the look), keep all 6; board-layout endpoint before match running (game-lane part HANDLED 2026-11-01, session 64 — built with the entry below: `GET`/`PUT /api/board`, schema v16, in `server/OWNER_API.md`; calls 1-6 are the render lane's)

Owner decisions on the 6 calls in `progress/render/checkpoints.md` (PR #110).
1. **Keep:** on a slow machine the liquid lowers its own resolution (0.3 -> 0.2 -> 0.14 under 20 fps).
2. **Keep:** a plain background draws dark but keeps the owner's theme choice for when a liquid is chosen again.
3. **Keep:** the Open button opens the Store page until pack opening comes to the site.
4. **Keep:** Admin is a section at the bottom of Settings, shown only to the house admin.
5. **Keep:** no sound or music controls until the first site page that plays sound.
6. **Keep:** without WebGL, a still gradient of the chosen colours.

Next render-lane slice, as planned: Season 0 render item 3, Home as the widget board.

### Game lane: one more small endpoint before match running
**Before match running and the ladder, add the saved board layout endpoint** (the Home widget board's layout and the widgets' sizes, saved to the owner's account; Customise -> Background uses the account-settings endpoint that already exists). Write it into `server/OWNER_API.md` with tests, as session 63 did for the account settings. Then Season 0 game item 1 (match running and the ladder). Update the Season 0 checklist in `progress/roadmap.md` to match.

---

## 2026-11-01 — Owner: the economy endpoints come with the board layout, before match running (extends the entry above) (HANDLED 2026-11-01, session 64 — all five built in one session, tested and written into `server/OWNER_API.md`: 1. the saved board, `GET`/`PUT /api/board` (schema v16; the 12 Season 0 widgets, S/M/L, Watch live twice, Tournament and the pull feed refused as after Season 0; the recommended layout gives the Tournament slot to Store); 2. the collection (`GET /api/collection`: every copy with finish, origin and bound, counts per card, each set's completion incl. secrets, Glitch, Gold and Prototype runs, the recent pulls), the binder, the card viewer, salvage (plan, then do it; 409 with the decks it would leave short until confirmed) and crafting (cards and secrets), plus the ledger; 3. packs: `GET /api/packs`, buying 1-10 at once (all or none), opening one, a chosen one, or ten, with NEW, "x N owned", pity and pack points as `openPack` gives them; 4. the store and cosmetics (`GET /api/store`, buying a cosmetic, the owned cosmetics) and each agent's loadout, read and set; 5. today's earnings, `GET /api/daily`. For 5 the store's day moved from UTC to midnight Sydney, as you set it on 2026-11-01 (it was still UTC). Evidence `progress/owner-api-demo-004-economy.txt`. The Season 0 checklist updated; match running is next)

To keep the render lane unblocked for its next slices, the game lane's next session builds **all of these endpoints together with the saved board layout**, before match running and the ladder. The economy behind each already exists, so this is wiring: write each into `server/OWNER_API.md` with tests, as session 63 did.
1. **Saved board layout** (from the entry above).
2. **Collection and binder:** the owner's copies (with finish, origin and bound/unbound), counts per card, set completion, secrets and Prototypes, and the last pulls (for Collection, Showcase and the Collection widget). Salvage and crafting as actions, with the rules the store already enforces.
3. **Packs:** buying packs and opening them (one or ten), returning the pulled cards with NEW and "x N owned", pity and pack points, as `openPack` does (for the Packs widget, the pack-opening page and the top bar's Open button).
4. **Store and cosmetics:** what's on sale (packs and the season's cosmetics), buying a cosmetic, the owner's owned cosmetics and each agent's loadout, read and set (for the Store page and widget and the loadout picker).
5. **Daily earnings:** today's credits from wins against the daily win schedule, and when it resets (midnight Sydney, as set), for the Daily rewards widget.

If it doesn't all fit in one session, do them in this order and continue in the next game session before match running. Then Season 0 game item 1 (match running and the ladder), then the match-dependent endpoints (live state, match history and replays, ladder and ratings, notifications). Update the Season 0 checklist in `progress/roadmap.md` to match.

**Render lane:** after the widget board, build the pages these endpoints feed (Collection, Store and pack opening on the site, and the widgets that use this data) as they land, then the match pages once match running exists.

---

## 2026-11-01 — Owner: answers to game session 64 (the board and the economy endpoints), keep calls 1-5; the daily pack in session 65 (HANDLED 2026-11-01, session 65 — calls 1-5 kept, nothing changed. Item 6: the economy already had the daily pack, in your 2026-10-04 spec ("one free pack a day that only the owner can claim, stacking up to 2"), so it is built, not brought to a check-in: `dailyPackStatus` / `claimDailyPack` in the store (`economy/src/dailyPack.ts`, no schema change), `GET /api/packs/daily`, `POST /api/packs/daily/claim`, and `dailyPack` in `GET /api/packs` and `GET /api/store`, written into `server/OWNER_API.md`, tested, evidence `progress/owner-api-demo-005-daily-pack.txt`. The hardening pass in the same session: all eight economy demos re-run and read, `boastDemo.ts` fixed (and `packOpeningDemo.ts`, which also crashed on the Sydney day), all regenerated. The Season 0 checklist updated; match running is session 66)

Answers the [OWNER CHECK-IN] "The board and the economy endpoints: the calls I made (defaults built)" in `progress/notes-for-owner.md` (PR #111, `progress/owner-api-demo-004-economy.txt`).
1. **Keep:** the daily reset is midnight Sydney (Australia/Sydney, with daylight saving) for payouts and daily earnings.
2. **Keep:** the recommended board gives the Tournament slot (Small) to Store.
3. **Keep:** the board is saved as an ordered list with sizes; Tournament and the League pull feed are refused until after Season 0.
4. **Keep:** buying packs is 1 to 10 at once, all or none; opening is 1, 10, or one chosen pack.
5. **Keep:** salvage asks first when it would leave a saved deck short (409 with needsConfirmation and the decks).
6. **Add the daily pack in session 65.** The owner's 2026-10-05 website spec has "Claim free daily pack" in the Store widget and a daily timer on the Packs widget. If the economy already has a free daily pack (per owner, resetting at midnight Sydney), add the endpoints to claim it and to read when the next one is ready, written into `server/OWNER_API.md` with tests. **If the economy has no free daily pack, don't invent one:** bring the question (how many packs, which pack, any streak) to an owner check-in.

**Accepted:** session 65 is the hardening pass (re-run, fix and regenerate the six stale economy demos and the crashing `boastDemo.ts`), with item 6 in the same session. Match running and the ladder follow in session 66. Update the Season 0 checklist in `progress/roadmap.md` to match.

---

## 2026-11-01 — Owner: answers to render session 46 (Home as the widget board), keep all 7; fallback (a) if the liquid stutters

Owner decisions on the 7 calls in `progress/render/checkpoints.md` and the notes in `progress/render/notes-for-owner.md` (PR #112).
1. **Keep:** Customise edits are held until Done; leaving Home while customising saves too; "+ Add widget" outside Customise and the empty board's buttons save at once.
2. **Keep:** the striped "board here" placeholder in Live match (M/L) and Watch live (L) until live matches are served.
3. **Keep:** mini placeholder card faces in the Collection, Showcase and Packs widgets.
4. **Keep:** Showcase picks the rarest finishes first, then rarity; pinning waits for the Collection page.
5. **Keep:** wide windows pack densely; narrow windows keep the owner's order exactly.
6. **Keep:** Daily rewards' bar ends at what wins can pay in a day (read from the server's schedule), with losses listed beside it.
7. **Keep:** "Claim free daily pack" greyed until the game lane's claim lands (session 65).

**The liquid behind a full board (notes item 2):** the owner will check it on the Mac mini. **If it isn't smooth there, use option (a):** the liquid goes still on Home when it can't hold 20 fps at its lowest resolution, and keeps moving on lighter pages. Not (b) or (c). Until the owner reports back, change nothing; if the owner reports it smooth, nothing changes.

Next render-lane slice, as planned: the Store page with pack opening on the site (so Open opens packs), then Collection's wide binder.

---

## 2026-11-01 — Owner: answers to game session 65 (the daily pack), keep all 3 (HANDLED 2026-11-01, session 66 — all 3 kept, nothing changed; session 66 built match running and the ladder as planned)

Answers the three calls under "The daily pack is built (from your 2026-10-04 spec)" in `progress/notes-for-owner.md` (PR #113, `progress/owner-api-demo-005-daily-pack.txt`).
1. **Keep:** a new owner's first day counts (sign up at 11 pm, claim one at once, another at midnight Sydney).
2. **Keep:** the daily pack is the current season's set (S0 now).
3. **Keep:** while 2 wait, nothing more comes in; claiming one starts the timer to the next midnight Sydney again.

Next game session, as planned: 66, Season 0 game item 1 (match running and the ladder).

---

## 2026-11-02 — Owner: answers to game session 66 (match running and the ladder), keep 1-4; house owners buy and open packs (a) (HANDLED 2026-11-02, session 67 — 1, 2 and 4 kept, nothing changed. 3: kept, and the first seat measured over 2,400 ladder matches: 64.8% (95% interval 62.8-66.7%), outside noise, and the game's own edge (65.4% in shipped-deck mirrors without the ladder), `progress/first-seat-001.txt`; reported at a new owner check-in with four fix options, nothing changed in the rules. 5 (a): built as the server's policy, `Ladder`'s `housePacks` (on by default): each round starts with every queued house owner buying packs with its credits and opening every waiting pack; player owners untouched; the session 66 demo re-run on it plays the same 72 matches. Session 67's planned work also built: the long-lived ladder at watch speed with Watch live, auto-play, match history with replays)

Answers the [OWNER CHECK-IN] "Match running and the ladder: the calls I made (defaults built)" in `progress/notes-for-owner.md` (PR #115, `progress/ladder-demo-001.txt`).
1. **Keep:** the tiers (Bronze < 1350, Silver 1350, Gold 1500 start, Platinum 1650, Diamond 1800, Mythic 1950+; 150 points each), and "Placement" (not ranked) until 5 rated matches.
2. **Keep:** an abandon is a rated loss for the side that walked out (a win for the other) and pays nothing; a cancel isn't rated.
3. **Keep:** the matchmaker settings (closest rating, up to 75 points of seeded jitter, rematch penalties 300 and 150, the odd one sits out and goes first next round, a coin flip for the first seat). **Add a check:** the first seat won 56% in the demo (72 matches). Measure the first-seat win rate over a larger ladder run and report it at the next owner check-in, with whether it is inside noise.
4. **Keep:** RD grows for each whole Sydney day without a rated match; the rating itself doesn't decay.
5. **Option (a):** the house owners automatically spend their agents' earned credits on Season 0 packs and open them at once, so their agents rebuild and the house shows the full loop. Make it the server's policy for house owners (not only the demo's), and leave real owners' credits alone: only the owner spends their credits.

Next game session, as planned: 67, rounds on a timer at watch speed with the live state for Watch live, auto-play for owners, and match history with replays.

---

## 2026-11-02 — Owner: answers to render session 47 (the Store page and pack opening on the site), keep all 6; "Watch again" after session 67 (game-lane part HANDLED 2026-11-02, session 68 — schema v19 `pack_reveals`: each opening kept as `POST /api/packs/open` answered it, in the open's own transaction, write-once; `GET /api/packs/:packId/opening` answers that same `PackOpening`, as of the opening (410 for a pack opened before v19). Tests `economy/test/collectionAsks.test.ts`, `server/test/ownerApiEconomy.test.ts`; in `server/OWNER_API.md`. Calls 1-6 are the render lane's)

Owner decisions on the 6 calls in `progress/render/checkpoints.md` (PR #114).
1. **Keep:** the opening happens on the server first, then the reveal; Close at any time loses nothing.
2. **Keep:** Esc closes only on the summary; Close works any time.
3. **Keep:** Open opens the oldest waiting pack; each "Waiting to be opened" row opens that kind's oldest.
4. **Keep:** buying is a 1-10 stepper and one Buy button with the total, after a confirm.
5. **Keep for now:** recent openings show the cards only.
6. **Keep:** the loadout picker comes with the next slice.

**"Watch again" (render notes item 2): yes, as a small game-lane job after session 67's match work** (don't delay the live features). Keep each opening as `POST /api/packs/open` answered it (each card's slot, NEW, "x N owned", pity, the starter guarantee, pack points) and have `GET /api/packs/:packId/opening` answer that same `PackOpening` shape, written into `server/OWNER_API.md`. Then the render lane adds "Watch again" to recent openings, and a reload mid-reveal can pick it up again.

Next render-lane slice, as planned: Collection's wide binder, and the loadout picker in the Store.

---

## 2026-11-02 — Owner: answers to render session 48 (the Collection page), keep all 6; two small game-lane asks after session 67 (game-lane part HANDLED 2026-11-02, session 68 — `GET /api/collection/cards/:cardId` now carries `copyLimit` and `craft: { packPoints, available, reason }` (null for signature and Zero-Day cards); `GET /api/collection` carries `promos: { signatureCards, earned }`. Tested, in `server/OWNER_API.md`. Calls 1-6 are the render lane's)

Owner decisions on the 6 calls in `progress/render/checkpoints.md` and the asks in `progress/render/notes-for-owner.md` (PR #116).
1. **Keep:** Glitch and Gold sit under the Secrets tab (secret cards, then Glitch, then Gold), keeping the four tabs.
2. **Keep:** a held place shows the best finish held, with the finish named under it.
3. **Keep:** missing places show the number and the card's name.
4. **Keep:** Salvage only in a base-set place's viewer; Glitch, Gold and Prototype places say they can't be crafted.
5. **Keep:** the binder's finishes stand still and move in the viewer; reduce motion means no tilt and no shine.
6. **Keep for now:** craft costs read from the economy's config until the API sends them.

**Game lane: two small asks, approved.** Do them together with "Watch again" (the 2026-11-02 entry above), after session 67's match work:
- **A craft price in the card viewer's answer** (`GET /api/collection/cards/:cardId`: the craft cost and the playable copy limit), so the API is the one source. Then the render lane stops reading `economy/src/config.ts` for them.
- **Signature cards and earned promos in the collection API**, for the Collection page's Promos tab.
Write both into `server/OWNER_API.md` with tests.

Next render-lane slice, as planned: the loadout picker in the Store, then the match pages once the game lane serves live state and match history.

---

## 2026-11-02 — Owner: answers to game session 67 (the live ladder), measure all four first-seat fixes; keep 1-5; versioned replays first (HANDLED 2026-11-02, session 68, except call 6 — all four measured, test only, plus five doses and pairs, on the mirrors, the ladder split, the ring check (both modes) and the leaders through the built-deck ring: `progress/first-seat-002-fixes.txt`, at the [OWNER CHECK-IN] in notes-for-owner.md. No rule changed. Calls 1-5 kept, nothing changed. Call 6 (versioned replays) is NOT done yet: it is session 70's hardening pass, before any fix ships. The correction is noted) (call 6 HANDLED 2026-11-02, session 70 — replays are versioned: `ai-tcg-replay/2` carries the rules version (`rules-1`), the card version (`cards-1`, with a digest) and every deck card in full, so it plays its own cards and rules, never today's; `/1` files read the frozen `cards-1` snapshot and still rebuild. Golden replays of both formats rebuilt byte for byte in the tests, also against a registry where every unit changed. Evidence `progress/replay-versions-001.txt`; `server/OWNER_API.md`. The 24-health rule can now ship: session 71)

Answers the two [OWNER CHECK-IN] entries in `progress/notes-for-owner.md` (PR #117, `progress/first-seat-001.txt`, `progress/ladder-demo-002-live.txt`).

### The first seat (about 65%)
- **Measure all four options in session 68, test only:** (a) the second player draws one extra card in its opening hand; (b) the second player gets +1 energy on its first turn only; (c) the second player starts with more health (for example 22 instead of 20); (d) the first player can't attack on its first turn. Measure each on the shipped-deck mirrors (same agent both seats) and on the ladder's seat split; take the leaders through the ring check and the built-deck ring; bring every number to an owner check-in. No rule change ships without the owner's OK.
- Session 68 does this together with the small asks already approved (the craft price and copy limit, signature cards and promos in the collection API, "Watch again"). The chosen fix ships well before the launch-gate re-run.

### Watch live, auto-play and match history
1. **Keep:** the watch pace (6 s per action, 1 s per pass, 3 s more for a new turn, 8 s on the result). The render lane may propose other holds once it times its animations against them.
2. **Keep:** a restart mid-match cancels the matches on screen (no credits, not rated).
3. **Keep:** a round waits for its slowest match, then 60 s. A rolling queue can come later.
4. **Keep:** auto-play goes off after the match that maxes the day's rewards, until midnight Sydney; house owners always play.
5. **Keep:** any signed-in owner can watch any live match and open any recorded match; match history lists only the owner's own matches.
6. **Change: version replays before any card or rule change ships in Season 0.** A replay names cards by id, so the first card or rule change (the first-seat fix is one) would make every replay recorded so far fail to rebuild. Before that fix (or any other card or rule change) ships, make replays carry the card and rule versions they were played under, and keep old replays rebuildable. The session 70 hardening pass is a natural place, as long as it lands before the first-seat fix ships.

### Correction to the 2026-11-02 session 66 entry
That entry's call 3 said the owner who sits out "goes first next round". Per `server/src/ladder/pairing.ts`, sitting out only means the owner **picks its opponent first** in the next round's pairing. **Who goes first in a match is a coin flip for every match.**

---

## 2026-11-02 — Owner: coin skins for the first-player coin flip (new cosmetic, inside Season 0) (game-lane plan WRITTEN 2026-11-02, session 68 — the [OWNER CHECK-IN] in notes-for-owner.md: the coin slot, Chrome Token, store coins and prices, tier coins, the coin on the match record. Not built: it waits for your answer, as asked. Season 0 checklist updated) (game-lane half BUILT 2026-11-02, session 69, as answered in the session 68 entry below; the render lane's two slices are next on its side)

New owner feature. **Who goes first is a coin flip for every match** (`server/src/ladder/pairing.ts`), so make that flip something owners see, and make the coin a cosmetic, the same way as victory boasts, arena backgrounds, card backs and avatars.

### What the owner decided
- **Inside Season 0:** add coin skins to both lanes' Season 0 lists, after the items already set (game lane: session 68's work; render lane: the Store's loadout picker).
- **Each owner sees their own coin** (the same rule as the arena): in a match or its replay, an owner sees their own agent's coin flip; the other owner sees theirs. What a spectator who owns neither agent sees is **not decided yet**: propose it at the plan check-in, together with the arena's open spectator question.
- **Coins come from two places:**
  - **The Store:** coin skins on sale for credits, like the other cosmetics (season items in sale windows, then retired).
  - **Seasonal rewards by end-of-season ladder tier:** a coin for each tier reached by the end of the season (for example Gold, Diamond and Mythic coins). Granted when the season ends, with the season-end work.
- **Proposed, to confirm at the plan check-in:** a free starter coin for every owner, like the starter boasts.

### Rules that stand
- **Cosmetic only:** the coin never changes who goes first or the odds. The server's coin flip decides, and the animation shows the real result. That stays true after the first-seat fix ships.
- Self-contained, like the rest of the site: no external services.

### How to build it
1. **Plan first, as an [OWNER CHECK-IN], before building** (as the boasts were planned in render session 30):
   - **Game lane:** a coin slot in each agent's loadout; the starter coin; the Season 0 store coins and their prices; the tier reward coins (which tiers, bound or not, whether a lower-tier coin is also given); and the coin on the match record.
   - **Render lane:** where the flip shows (proposed: inside the Match Boot intro, without making it much longer), its length, sound and reduced-motion version, how the result reads ("you go first" / "they go first"), the coin designs, and the spectator view.
2. **Then build it**, game lane first (the slot and catalogue), then the render lane (the flip, the coins, and the coin line in the loadout picker and the Store).

Update the Season 0 checklist in `progress/roadmap.md` to include coin skins.

---

## 2026-11-02 — Owner: answers to render session 49 (the loadout picker in the Store), keep all 6; the deck's faction ask; the coin plan's render half approved (game-lane part HANDLED 2026-11-02, session 68 — `DeckStatus` carries `faction` and `list: [{ cardId, copies }]` in `GET /api/play` (`activeDeck`, `agentDeck`, `decks`); tested, in `server/OWNER_API.md`. The coin slot in the loadout and the coin on the match record are in the game-lane plan at the check-in; the rest is the render lane's)

Owner decisions on the 6 calls in `progress/render/checkpoints.md` and the notes in `progress/render/notes-for-owner.md` (PR #118).
1. **Keep:** the picker opens full screen over the website from a row per agent on the Store.
2. **Keep:** Buy inside the picker, with the website's confirm, then Equip as its own tap.
3. **Keep:** when the deck's faction isn't known, the picker says "No deck built yet" rather than guess.
4. **Keep:** Equip waits for the server and the page shows the server's whole loadout from the answer.
5. **Keep:** Esc closes the picker at any point.
6. **Keep:** the picker keeps its dark terminal look inside the glass website.

### Game lane: one more small ask, approved
Add **the faction the agent's deck plays (and its card ids)** to `DeckStatus` in `GET /api/play` (`activeDeck` and `decks`), written into `server/OWNER_API.md` with tests. Queue it with the other small asks (craft price and copy limit, signature cards and promos, "Watch again"), after session 68's work.

### Coin skins: the render lane's half of the plan, approved as proposed (notes item 3)
- **Where and when:** inside the Match Boot intro, on the centre line between HANDSHAKE OK and the saying. The intro goes from about 2.6 s to about 3.4 s: the coin flicks up at 1.5 s and spins, lands at 2.1 s, the result line types at 2.2 s, the saying slams in at 2.4 s, everything is gone by 3.4 s. Skip skips it with the rest.
- **How the result reads:** the viewer's coin has two faces, the viewer's own agent's portrait and the coin's design. Portrait up means "you go first". The line reads **YOU GO FIRST** or **THEY GO FIRST**; for a spectator who owns neither agent, **<NAME> GOES FIRST**.
- **The edge pulse: yes.** After the landing, a short edge pulse runs into the first player's half. Write this one exception to the intro's "favours neither side" grammar into EFFECTS.md.
- **Sound:** a flick, a spin whir and a landing clink, all dead centre on the audio clock; Skip cuts them.
- **Reduced motion:** the coin shown already landed, with the line, in the still (about 1.0 s to 1.3 s).
- **Coin looks** (code-drawn placeholders until the art pass): the free starter **Chrome Token** (a silver hex); Season 0 store coins **Dial-Up Dime** (a green CRT-phosphor rim) and **Neon Nickel** (a magenta and cyan neon edge); tier coins **Gold** (gold foil), **Diamond** (prismatic facets) and **Mythic** (the Mythic ward's moving sheen). Names and prices remain the game lane's half of the plan.
- **The free starter coin is confirmed:** Chrome Token for every owner.
- **Spectators** who own neither agent see the house's neutral **Chrome Token**.
- **The arena's open spectator question is settled the same way:** a spectator who owns neither agent sees a neutral default arena (amends the 2026-10-21 arena entry's "not decided yet").
- **What the render lane needs from the game lane:** the coin slot in `GET /api/agents/:id/loadout` (the picker's sixth slot, "Coin", with the same tiles and Buy), and each agent's equipped coin on the match record and the replay, like the boasts.
- **Order:** the game lane's half first (its [OWNER CHECK-IN] with the slot, catalogue, prices and tier rules, then the build); then two render slices: (1) the flip in Match Boot, the starter coin, reduced motion and sound; (2) the store and tier coins' looks, and the coin line in the picker and the Store.

Next render-lane slice, as planned: the match pages (Watch live, the Live match widget, Match history, auto-play) on the game lane's session 67 endpoints.

---

## 2026-11-02 — Owner: spectators see the higher-rated agent's cosmetics (amends the entry above) (game-lane part HANDLED 2026-11-02, session 69 — schema v20 keeps each side's rating at the start of the match on `live_matches` and `matches`; `GET /api/live`, `/api/live/:id` and `/api/matches/:id` send both coins, both arenas, `ratingAtStart` and `defaultView` (the higher-rated side, p1 on a tie, per the render 50 answer). Replaced by the point-of-view entry below for what the website shows)

This replaces the entry above's spectator answers (the neutral Chrome Token, and a neutral default arena).
- **A spectator who owns neither agent sees the cosmetics of the higher-rated agent** in that match: its coin for the coin flip and its arena background. The owners themselves still each see their own agent's coin and arena, as decided.
- **Higher-rated** means the higher Glicko-2 rating at the start of the match, as recorded on the match, so a replay shows the same cosmetics later.
- **On the coin flip:** the spectator's coin shows that agent's portrait on one face, and the line reads **<NAME> GOES FIRST** as already planned.
- **Not decided, propose at the coin plan check-in:** the tie rule (equal ratings, or both owners still in Placement) and whether the spectator view is the same for featured matches and the Watch live widgets.
- Victory boasts are unchanged: everyone sees the winner's boast.
- This also settles the arena's open spectator question from the 2026-10-21 entry: the higher-rated agent's arena.

---

## 2026-11-02 — Owner: answers to game session 68 (the first-seat fixes; the coin plan's game half); spectators pick a point of view (game-lane part HANDLED 2026-11-02, session 69 — coin skins built, calls 1-6 as answered: the `coin` slot; Chrome Token granted and equipped, existing owners and agents in the v20 migration; Dial-Up Dime and Neon Nickel at 300 credits for Season 0 (on sale once the render lane draws them); change 4: the tier coins are Platinum, Diamond and Mythic, a higher tier gets the lower ones, bound, never sold, granted at season end (`grantSeasonTierCoins`, called by the season-end work); each side's coin on the match record and in the replay (`coins: { p1, p2 }`); change 6: both coins and both arenas sent, with `defaultView`. Tests `economy/test/coins.test.ts`, server tests; `server/OWNER_API.md`; evidence `progress/owner-api-demo-007-coins.txt`. The 24-health rule is NOT shipped: it waits for session 70's versioned replays, as set. The render half is the render lane's. **24-health rule SHIPPED 2026-11-02, session 71** as `rules-2` (the engine's base; `rules-1` kept explicit so every older replay rebuilds), with new ring baselines, a new built-deck ring (`progress/built-deck-ring-005.txt`), the live ladder's watch length re-checked and the first seat re-measured (`progress/first-seat-003-rules-2.txt`); the shipped numbers are at the [OWNER CHECK-IN] at the top of `progress/notes-for-owner.md`, before the launch-gate re-run)

Answers the two [OWNER CHECK-IN] entries in `progress/notes-for-owner.md` (PR #119, `progress/first-seat-002-fixes.txt`).

### The first seat: ship "the second seat starts on 24 health"
- **Rule:** "The player going second starts with 24 health; the player going first starts with 20 and skips its first draw."
- **Order:** versioned replays land first (session 70's hardening pass, the 2026-11-02 call 6). Then ship the rule with new ring baselines (`ring`, `ring:real`), a new built-deck ring, and the live ladder's watch length re-checked (matches run about a turn longer). Report the shipped numbers at the next owner check-in, before the launch-gate re-run.
- Accepted cost: three real-mode built-deck edges that sat just inside their band slip to "unresolved".

### Coin skins: the game lane's half, build as proposed with two changes
1. **Keep:** a sixth loadout slot, `coin`, on each agent; `GET /api/agents/:id/loadout` gains the "Coin" slot with the same tiles and Buy.
2. **Keep:** **Chrome Token**, standard (never sold), granted to every owner and equipped on every agent by default; existing owners and agents get it in the migration.
3. **Keep:** **Dial-Up Dime** and **Neon Nickel**, 300 credits each, in a Season 0 sale window, then retired.
4. **Change: the tier coins are Platinum, Diamond and Mythic** (not Gold), so every tier coin is earned: **Platinum coin** for Platinum or higher, **Diamond coin** for Diamond or higher, **Mythic coin** for Mythic. A higher tier gets the lower coins too. Bound to the owner, never sold, carried over the season reset. **Render lane:** the approved Gold coin look becomes the Platinum coin (a platinum finish); Diamond and Mythic stay as approved.
5. **Keep:** each side's equipped coin on the match record and in the replay (`coins: { p1, p2 }`).
6. **Change (spectators):** see the next section. The API sends both coins (as proposed) and both arenas, so the website can switch.

### Spectators choose whose point of view to watch (amends the spectator entry above)
- **A spectator who owns neither agent can switch between the two players' points of view.** Switching changes that player's cosmetics with it: **the coin in the coin flip and the arena background** follow the chosen player.
- **The default view is the higher-rated agent's** (by rating at the start of the match, as in the entry above).
- **Owners watching their own agent's match** keep their own agent's view (their own coin and arena), as decided.
- Victory boasts are unchanged: everyone sees the winner's boast.
- **Render lane, propose at a checkpoint before building:** where the toggle sits (Watch live, the Live match widget, replays); whether the chosen player also moves to the near side of the board; whether a switch mid-match re-shows anything or just swaps the coin and arena from then on; the tie rule for the default (equal ratings, or both in Placement); and whether the choice is remembered (per match, or on the account).

---

## 2026-11-02 — Owner: answers to render session 50 (the match pages), keep all 6; the spectator point of view approved; live endpoints queued (game-lane part PARTLY HANDLED 2026-11-02, session 69 — built after the coin skins as told: both sides' ratings at the start of the match on the match record (`ratingAtStart` on each side of `GET /api/matches/:id`, kept for a cancel too) and on the live view, with `defaultView` by the tie rule here (p1). Still queued: the 2x vote, featured picks (rule to a check-in), viewer counts, the live board's unit badges. Session 70's versioned replays stay ahead of the 24-health rule)

Owner decisions on the 6 calls in `progress/render/checkpoints.md` and the notes in `progress/render/notes-for-owner.md` (PR #120).
1. **Keep:** match history lives on Agent match; the Match history widget's arrow opens it.
2. **Keep:** the owner's own agent is always on the near side (spectators: see the point-of-view section below).
3. **Keep:** the live view is a scoreboard and compact board this slice; the arena fed from the live feed is the next slice.
4. **Keep:** the play-by-play drops the log's bookkeeping; the full log is one tap away.
5. **Keep:** replays are built on demand by the site host with the owner's token (pages kept 10 minutes); a file that can't rebuild says so.
6. **Keep:** Escape inside a playing replay belongs to the arena; Close leaves.

### The spectator point of view: approved as proposed (notes item 2)
- **Where:** on every view of a match the viewer doesn't own: each Watch live card, the Watch live widget at M and L, and the replay's top bar. Not on the Live match widget or Agent match (always the owner's own view). One two-button switch with the agents' names ("Watch as: <A> | <B>").
- **The chosen player moves to the near side:** on the arena the board flips so the chosen player's units, hand and health bar are at the bottom.
- **A switch mid-match re-shows nothing:** the coin, arena and near side swap from then on; a coin flip already played isn't played again; a replay scrubbed back to the start shows the chosen player's coin.
- **Tie rule for the default** (equal ratings, or both in Placement): the player who goes first (p1).
- **Remembered per match, in the browser tab only** (not on the account); the next match starts from the higher-rated agent again.

### Game lane: queue these endpoints (written into `server/OWNER_API.md` with tests)
- **Both agents' ratings at the start of the match on the match record** (`GET /api/matches/:id`), so a replay picks the same default view later.
- **The Season 0 live features with no endpoint yet:** the **2× vote** (both owners must agree, as in the 2026-10-05 spec), **featured picks** ("Top rated", per the open rules in the spec; propose the rule at a check-in) and **viewer counts**.
- **Any small additions the render lane's live-board slice names** for unit badges (statuses, tool bonuses) in the public board.
Queue them after the coin skins build, and keep session 70's versioned replays ahead of the 24-health rule as already set.

Next render-lane slice, as planned: the big live board (the arena fed from the live feed) on Agent match and Watch live. The point-of-view toggle follows once the coin slot and the ratings-at-start field exist.

---

## 2026-11-03 — Owner: answers to game session 69 (coin skins, the game half), keep all 6 (HANDLED 2026-11-02, session 70 — all 6 kept, nothing changed. Note on 5: the replay format is now versioned (`ai-tcg-replay/2`, session 70) and the coins stay an optional field in it, written whenever the match has them)

Answers the six calls in `progress/notes-for-owner.md` (PR #121, `progress/owner-api-demo-007-coins.txt`).
1. **Keep:** the tier coins belong to a season (`coin-s0-platinum`, `coin-s0-diamond`, `coin-s0-mythic`); each season adds its own three. Whether Season 1's are a new look or the same look with a season mark is the render lane's call.
2. **Keep:** an empty coin slot flips the Chrome Token; matches recorded before the coin slot read as the Chrome Token.
3. **Keep:** the tier is read when the season-end work runs, from the owner's rating then (placement done), before the reset clears ratings.
4. **Keep:** `ratingAtStart` on each side of every match, cancels too, and `defaultView` (the higher one, p1 on a tie).
5. **Keep:** the coins as an optional field in `ai-tcg-replay/1` until session 70's versioned replays give it a version.
6. **Keep:** the small change in the render lane's loadout picker (the coin slot left out until the render lane's coin slice adds the Coin line).

---

## 2026-11-03 — Owner: answers to render session 51 (the big live board), keep all 6; three live-feed asks; show hands live (game-lane part QUEUED 2026-11-02, session 70 — session 70 was the hardening pass (versioned replays), so the three live-feed asks (the signature card in `PublicSide.signature`, `LiveSideView.faction`, the boast once the last move is out) are on the Season 0 checklist (game item 2c) with the 2x vote, featured picks and viewer counts, after the 24-health ship. Hands live: nothing for the game lane to build now (every ladder match is decided before it is shown, and draw events already name the card); the safety rule for real-time network agents is on the checklist with network agents joining the ladder. Calls 1-6 are the render lane's)

Owner decisions on the 6 calls in `progress/render/checkpoints.md` and the notes in `progress/render/notes-for-owner.md` (PR #122).
1. **Keep:** the arena opens full screen from "Watch on the arena" on Agent match and each Watch live card; the scoreboard, compact board and play-by-play stay on the pages and widgets.
2. **Keep:** joining mid-match starts at the newest move; joining before the first move plays the Match Boot intro.
3. **Keep for now:** live, GAME OVER lands before the boast (until the boast ask below lands, then boast-then-result as in replays).
4. **Keep:** the catch-up rules (quick steps beyond 3 moves behind, a skip beyond 12).
5. **Keep for now:** a side shows Neutral until it plays a faction card (until the faction ask below lands).
6. **Keep:** the live page's Match Boot saying is seeded by the match id; the seed is never sent live.

### Game lane: three live-feed asks, approved
Queue them with the 2× vote, featured picks and viewer counts, written into `server/OWNER_API.md` with tests:
1. **The signature card in `PublicSide.signature`:** the card itself (cardId, cost, attack, health, keywords, rules text), `timesPlayed`, `inZone` and `nextCost`, as the engine's SignatureZone has it.
2. **The deck's faction on each side** (`LiveSideView.faction`).
3. **The boast on the live view once the last move is out** (the record's boast, or the loadout's boast and close-win boast with the rule), so the live arena plays boast-then-result as replays do.

### Hands in live matches: show them (option (b))
- **Spectators see both hands live, face up, as replays do.** The draw events keep naming the card. The render lane draws live hands face up, rebuilding them from the feed, or asks the game lane for the hand contents in the live view if that is simpler (a small ask in its notes).
- **Safety rule:** for any match where a seat is a network agent playing in real time (not a match the engine has already decided before it is shown), hands stay hidden in the live feed (counts only, no card in draw events) until the match ends. The game lane builds this rule when network agents join the ladder; until then every ladder match is decided before it is shown, so hands are shown.

---

## 2026-11-03 — Owner: answers to game session 70 (versioned replays), keep all 5; a storage note for later (HANDLED 2026-11-02, session 71 — all 5 kept, nothing changed; the storage note is on the storage gate item in `progress/quality-debt.md` (the launch storage gate). Session 71 shipped the 24-health rule as `rules-2`, as planned)

Answers the five calls in `progress/notes-for-owner.md` (PR #123, `progress/replay-versions-001.txt`).
1. **Keep:** a replay carries every card it uses, in full (`ai-tcg-replay/2`, with `rules` and `cards` versions), and plays its own cards and rules. **Note for later, not now:** at about 25 KB a match, the live ladder's pace adds up to a few hundred MB a month on the Mac mini. That is fine for Season 0. Revisit it with the storage gate before the public launch: a shared card table per card version (or compressing replays) is the option to measure then. Add this to the storage item in `progress/quality-debt.md`.
2. **Keep:** old `/1` replays read the frozen `cards-1` copy under `rules-1`.
3. **Keep:** a card change fails a test until it gets a new card version in `CARDS_VERSIONS`.
4. **Keep:** a replay on unpublished cards names no card version (`cards: null`) but carries and plays its cards (tests and tools only).
5. **Keep:** the small change in the render lane's replay reader (both formats through the server's reader; the file's rules passed through).

Next game session, as planned: 71, the 24-health rule as `rules-2`, with new ring baselines, a new built-deck ring and the live ladder's watch length re-checked; the shipped numbers to the owner before the launch-gate re-run. Then the queued small asks in order: the 2× vote, featured picks (the "Top rated" rule to a check-in), viewer counts, and the three live-feed asks from render 51.

---

## 2026-11-03 — Owner: answers to render session 52 (the spectator point of view), keep all 6; a hardening pass after the hands-and-coins slice (render lane only; game lane: nothing to do, read session 71)

Owner decisions on the 6 calls in `progress/render/checkpoints.md` (PR #124).
1. **Keep:** a switch during the Match Boot intro or a boast waits for it to end, then flips.
2. **Keep:** a tap on "Watch as" doesn't skip the intro.
3. **Keep:** the momentum gauge mirrors with the view (the existing convention: the near player ahead fills to the right of centre), so it reads the same as on the owner's own matches.
4. **Keep:** the Watch live widget shows the switch for its first match only (M and L); S has no switch.
5. **Keep:** a standalone replay page shows the switch and starts at p1 (no ratings in the file); the choice is kept for the tab.
6. **Keep:** the replay's switch is built and tested for when a featured match can be watched again; not reachable from the site yet.

**Render-lane order, as set:**
1. Next slice: hands live, face up (the owner's render-51 answer, rebuilt from the feed's draw events), together with the first coin slice (the flip in Match Boot, the Chrome Token, reduced motion and sound).
2. **Then a render hardening pass** (the last was session 40): no new features; work the quality-debt list, re-run and fix the stale checks named there (for example the session-25 ten-pack check and the session-36 loadout check), and the check-E flake.
3. Then the second coin slice (the store and tier coins' looks, the coin line in the picker and the Store), and the rest of the Season 0 list.

---

## 2026-11-03 — Owner: answers to game session 71 (the 24-health rule shipped) and render session 53 (live hands face up; the coin flip) (game-lane part PARTLY HANDLED 2026-11-03, session 72 — game items 2-7 kept, nothing changed; item 2 taken: `WATCH_PACE_MS` left as it is, 6-7 minutes is the target now (current.md). The game-lane order's step 1 built: the opening hands (`openingHands: { p1, p2 }` beside `start` on `GET /api/live/:id`, by card id in hand order) and the three render-51 asks (the signature card in full in `PublicSide.signature`, `LiveSideView.faction`, the boast on the live view once the last move is out), in `server/OWNER_API.md`, tests `server/test/liveFeedAsks.test.ts`, evidence `progress/live-feed-asks-001.txt`. Still open: step 2 (the 2x vote, featured picks, viewer counts), step 3 (the Null builder session, item 1, before the launch-gate re-run), and the `cosmetics.test.ts` check against `COIN_SPECS` when the render's second coin slice lands. Render calls 1-7 are the render lane's)

### Game session 71 (PR #125, `progress/first-seat-003-rules-2.txt`, `progress/built-deck-ring-005.txt`)
1. **The full-collection Null deck: yes, a test-only builder session before the launch-gate re-run.** The builder keeps the designed deck unless another deck beats it by more than noise; then re-run the built-deck ring and bring the results to an owner check-in. No card, deck or rule change without the owner's OK. It doesn't have to come before the Season 0 items below, but it must land before the launch-gate re-run.
2. **Watch time: accept it, no pace change.** A median of about 6.7 minutes per match is fine: 6-7 minutes is reasonable even though it is over the old 5-6 minute target. Leave `WATCH_PACE_MS` as it is; treat 6-7 minutes as the target from now on. Report it at a check-in if the median moves well past 7 minutes.
3. **Keep:** the rule is the engine's default, so every match anywhere plays it; `rules-1` lists its 20 and 20 explicitly.
4. **Keep:** the other three first-seat variants are removed from the engine; their numbers stay in `progress/first-seat-002-fixes.txt`.
5. **Keep:** a replay played under an older rules version names that version (`rules-1`); only an unpublished variant is "measure".
6. **Keep:** the close-win boast still triggers at 5 health or less for both seats.
7. **Noted:** the signature-mode report's Aegis > Cortex move (72.4% to 75.8%), report only.

### Render session 53 (PR #126), keep all 7
1. **Keep:** the coin "flicks up" toward the viewer (grows and shrinks on the centre line), favouring neither half.
2. **Keep:** the result line sits under the coin, both going as the saying slams in.
3. **Keep:** the edge pulse as a band of the first player's faction colour.
4. **Keep:** reduced motion as two cuts (coin and line, then the saying), 1.3 s.
5. **Keep:** live opening-hand cards show as labelled backs in place until played (until the ask below lands).
6. **Keep:** a live cost a signature card may change is marked "?" until the signature-card ask lands.
7. **Keep:** a coin not drawn yet flips the Chrome Token.

**Game lane: the opening-hands ask, approved.** Send the opening hands, by card id in hand order, on the live view's start (`openingHands: { p1, p2 }` beside `start` in `GET /api/live/:id`), only while the match is decided before it is shown (the safety rule for real-time network agents leaves it out). Also, when the second coin slice lands, let `economy/test/cosmetics.test.ts` check coins against the render's `COIN_SPECS` (render notes item 3).

### Game-lane order from here
1. The live-feed asks: the opening hands, plus the three from render 51 (the signature card in `PublicSide.signature`, each side's faction, the boast on the live view once the last move is out).
2. The Season 0 live features: the 2× vote, featured picks (bring the "Top rated" rule to a check-in) and viewer counts.
3. The test-only Null deck-builder session (item 1 above), before the launch-gate re-run.

Render lane, as set: the hardening pass next, then the second coin slice.

---

## 2026-11-03 — Owner: answers to game session 72 (the live-feed asks), keep all 3; enforce the hands rule before network agents join

Answers the three calls in `progress/notes-for-owner.md` (PR #127, `progress/live-feed-asks-001.txt`).
1. **Keep:** the signature card in the live feed also carries its art reference and flavour text.
2. **Keep:** "rules text" is each ability's printed text, one line each; a keyword-only card sends no lines and the render draws its keywords.
3. **Keep:** the live boast is worked out when the match starts being shown (from the loadouts and deck it started with, by the store's rule) and only sent once the last move is out.

**Note: the hands safety rule must be enforced in code before any network agent plays on the ladder in real time.** Today it is only a comment and a doc (listed in `progress/quality-debt.md`), which is fine while every ladder match is decided before it is shown. When network agents start joining the ladder, the first step of that work is to enforce it: for a match with a real-time seat, the live feed sends hand counts only, no `openingHands`, and no card in `draw` events until the match ends, with a test that fails if any of them leak. Keep it on the roadmap's network-agents item and in the quality-debt list until it is built.

Next game session, as planned: the Season 0 live features (the 2× vote, featured picks with the "Top rated" rule brought to a check-in, and viewer counts). Render lane, as set: the hardening pass, then the second coin slice; the site's live types can move to the new live-feed fields along the way.
