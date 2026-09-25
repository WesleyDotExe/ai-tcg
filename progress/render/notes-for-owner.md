# Render lane — notes for the owner

The render lane's own notes-for-owner (RENDER.md guardrail 4 — kept
separate from the shared `progress/notes-for-owner.md`).

---

## 2026-09-24 — Session 1

1. **Two small gaps in the engine's public barrel, found while wiring this
   lane, not fixed by it.** `engine/src/index.ts` doesn't export
   `buildNullDeck` (only `buildCortexDeck`/`buildSwarmDeck`/`buildAegisDeck`/
   the generic `buildDeck` are exported, even though `buildNullDeck` exists
   in `decks.ts` right next to them — looks like an oversight from whichever
   session added Null, not a deliberate omission) or the third reference
   agent, `LookaheadAgent` (only `RandomAgent`/`AggressiveAgent` are
   exported). This lane can't fix it — RENDER.md forbids editing any engine
   file, `index.ts` included — so `render/src/engineInternal.ts` deep-imports
   both directly from their source files instead, with a comment explaining
   why. Harmless as-is, but the balance lane (or whoever next touches
   `index.ts`) may want to add both to the barrel — it's a one-line-each,
   zero-risk fix, and would let this lane (and any future consumer) use the
   normal `@ai-tcg/engine` import instead of reaching past it.

2. **The telegraph-delay-feel question RENDER.md flagged as "parked" is now
   answerable.** Both committed replays (`render/output/*.html`) show a
   telegraphed unit sitting dormant on the board with a visible "ARMING /
   T<n>" countdown before it fires — e.g. `aegis-vs-cortex-seed1.html` has
   Latent Ward (telegraph=2) visibly dormant from move ~55 through its arm
   turn. Whoever wants to judge the 1-vs-2-turn fuse question from
   `progress/owner-feedback.md`'s 2026-09-13 entry can now actually watch it
   rather than infer it from a text log. Not judging it myself here — that's
   a taste call for whoever looks at the render, not something this session
   should decide unilaterally.

3. **Two placeholder-art decisions made without a checkpoint gate, flagged
   here for visibility rather than blocking on them:** the per-card
   generative pattern is a simple hash-driven hue-shift + one of 4 CSS
   background patterns (see `render/src/cardVisual.ts`) — distinct per card,
   consistent per faction, but obviously not "real art," and a rarity-driven
   frame treatment (inset highlight -> glow -> pulsing glow for Uncommon ->
   Rare -> Mythic) was added now rather than deferred whole-cloth to stage 8,
   reasoning that flat-identical-regardless-of-rarity cards would themselves
   read as a regression against this stage's own "genuine visual interest"
   bar. Both are cheap to change or remove later; flagged in
   `progress/render/checkpoints.md`'s "decisions to overrule" section too.

4. **The event log's `attacker`/`defender`/`target`/`unit` fields are card or
   player NAMES, not instance IDs — a real identity gap, found while
   building session 2's animations, not fixed (this lane can't touch engine
   files).** `engine/src/engine/engine.ts` (`attacker: attacker.card.name`)
   and `engine/src/effects/resolver.ts` (`target: player.name`,
   `target: unit.card.name`) confirm this directly in the source, not
   inferred. Consequence: whenever two units on the board share a card name,
   or (this project's own standard balance-testing shape) both players run
   the same agent name — e.g. Lookahead-vs-Lookahead, exactly what both
   committed sample replays use — the event log genuinely cannot say WHICH
   copy or WHICH player an effect applied to by name alone. This was already
   true of the plain scrolling text log (session 1 reused `formatEvent`
   as-is), just not previously named as an identity gap; session 2 avoided
   building on it for animation (used the frame snapshots' own instanceId
   diff instead, which is exact) specifically because of this. If the
   balance lane or a future engine session ever wants the log itself to be
   unambiguous (e.g. for a future commentator agent reading the event
   stream, per DESIGN's stage 7 — commentary needs to say WHICH unit, not
   just "a unit"), the fix is adding an optional instanceId alongside the
   existing name fields on the relevant `GameEvent` variants — not a
   breaking change, since `formatEvent` can keep using the name for prose.
   Flagged, not built, since it's an engine-file change this lane cannot
   make.
5. **The telegraph-arming question RENDER.md parked is now watchable in
   motion, not just inferable from a static frame.** Both committed replays
   show a telegraphed unit's dormant state end live — the card pulses gold
   the instant `pending` flips off — rather than session 1's "sits there
   with a countdown, no visual event when it actually arms." Still not
   judging the 1-vs-2-turn fuse question myself; flagging that it's now
   even more directly watchable than session 1 already made it.

6. **Match replays are fairly large committed files** (`render/output/
   *.html` run 580-640KB each — mostly the embedded per-move JSON snapshot
   for a 150-180-move match). Fine at this scale; worth knowing before this
   lane accumulates dozens of committed sample replays, in case the owner
   would rather this lane keep only 1-2 "current" evidence files and
   regenerate on demand instead of accumulating a growing binary-ish history
   the way `progress/sample-match-*.txt` does. Not changing the convention
   unilaterally — flagging the tradeoff.
