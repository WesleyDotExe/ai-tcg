# Owner feedback

This file is the owner's steering wheel. Write feedback here at any time â
"redo stage N," "drop this feature," "change this direction," anything you
want to override the design or a run's own plans. Every session reads this
file FIRST, before anything else, and treats what's here as overriding.

When a run acts on an entry, it marks the entry handled (with a note on what
it did) so the same feedback isn't re-applied by the next run.

---

## 2026-09-11 — Owner feedback on Stage 1 checkpoint (UNHANDLED)

Responses to the four decisions flagged in checkpoints.md:

**1. Language/runtime — KEEP TypeScript/Node.** Confirmed. One language across engine, server, and web stack is what we want. No change.

**2. Energy/turn model — CHANGE to Magic-style reactivity.** Overrule the Hearthstone-style choice. Build the deeper, reactive model: players can respond during the opponent's turn (instant-speed responses), with a priority-passing system, held resources, and the interaction depth that comes with it. Rationale: this game is meant to be beyond human tracking and dramatic to watch, and reactivity is one of the biggest sources of exactly that depth — a core pillar, not optional. Treat this as a proper foundational rebuild of the turn/priority core, not a bolt-on: the current model has no reactivity, so the priority system must be built where it doesn't yet exist. Re-prove it to the stage-1 evidence standard (a full match log showing instant-speed responses actually happening, plus assertion scenarios covering priority passing and reactive triggers). It is fine and expected for this to redo part of stage 1 before moving to stage 2 — better now than after a card set is built on the simpler model. Keep a resource curve that still supports ~5–6 minute games.

**3. Pacing / turn cap — a turn cap is fine.** Keep a hard turn cap as the backstop so games always end. Continue tuning overall pacing toward the 5–6 minute target against logged match lengths as the game matures; the cap is the safety net, not the primary pacing tool.

**4. Faction names / art direction — lean HARD into AI-themed content, with cyberpunk + 1990s retro-futurism flair.** No specific faction names mandated — invent good ones in that spirit. Direction: heavily AI/machine-intelligence themed throughout (factions, card names, flavour, later art direction), styled with a blend of cyberpunk aesthetics and 1990s retro-futurism (chrome, CRT/terminal vibes, the optimistic-yet-synthetic 'future as imagined in the 90s'). Let this flavour identity run through the whole game's presentation, not just card names.
