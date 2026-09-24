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

4. **Match replays are fairly large committed files** (`render/output/
   *.html` run 580-640KB each — mostly the embedded per-move JSON snapshot
   for a 150-180-move match). Fine at this scale; worth knowing before this
   lane accumulates dozens of committed sample replays, in case the owner
   would rather this lane keep only 1-2 "current" evidence files and
   regenerate on demand instead of accumulating a growing binary-ish history
   the way `progress/sample-match-*.txt` does. Not changing the convention
   unilaterally — flagging the tradeoff.
