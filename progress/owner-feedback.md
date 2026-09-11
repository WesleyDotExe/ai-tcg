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

## 2026-09-12 — Design directive batch: card systems, onboarding, economy, rarity, presentation (UNHANDLED)

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
