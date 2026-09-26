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

## 2026-09-26 — Session 3 (scale animation magnitude to event magnitude)

7. **The browser-side magnitude-scoring logic is hand-duplicated, not
   imported, from its tested source.** `render/src/fxMagnitude.ts` is a
   real, unit-tested module (20 tests) — but `renderHtml.ts`'s inline
   `<script>` can't `import` it, since the replay page is a single
   dependency-free HTML file with no bundler in this lane's toolchain. The
   scoring logic (rarity weights, tier thresholds, per-effect formulas) is
   copied by hand into the template-literal JS, with a comment in both
   files pointing at the other. This is the same shape as the pre-existing
   `cardArtStyle`/`cardVisual.ts` split, just a second instance of it now —
   real drift risk if one side changes without the other, flagged rather
   than silently accepted. A bundler step for this lane's inline script
   would remove the risk entirely but is a real toolchain addition, not a
   small one — not taken unilaterally.

8. **The lethal-blow full-screen flash fires on any game-ending move, not
   only an actual killing hit** — a turn-cap or move-cap ending gets the
   same dramatic radial flash as a real lethal blow, since "the match just
   ended" is still arguably the single biggest beat of a replay either way.
   If a turn-cap ending should read differently (a duller "time's up" cue
   instead of the same red "lethal" flash), that's a small, easy follow-up
   — not done this session since the owner's feedback named "a lethal blow"
   specifically and didn't address non-lethal endings.

9. **Session 2's stacked-floating-number thin spot is still open, confirmed
   again.** When two FX land on the same card in the same move (e.g. a hit
   and a buff together), their floating numbers can visually overlap — seen
   again in this session's own screenshot evidence
   (`progress/render/log.md`'s session-3 entry). Not a magnitude-scaling
   problem, so out of scope for this session's slice; a real next
   micro-slice (offset each subsequent number spawned on the same card
   within a move) whenever picked up.

## 2026-09-26 — Session 4 (defence/shield primitives, EFFECTS.md slice 1)

10. **This dev/CI environment's headless Chromium has no colour-emoji font,
    and an unsupported codepoint can render as fully invisible rather than a
    visible "tofu" fallback box.** Found by screenshotting a real shield-emoji
    badge (U+1F6E1) and seeing nothing at all — not even the badge's own
    background — where the DOM inspector confirmed the element was present
    and correctly populated. Root cause: with no colour-emoji glyph
    available, the browser fell back to an ambient inherited text colour
    that happened to be near-black-on-near-black for this specific badge,
    so there was no visible fallback shape at all to notice as "broken." A
    real trap for any FUTURE render session tempted to reach for an emoji
    as a cheap placeholder icon (EFFECTS.md's build order has several
    upcoming slices — buff/penalty, cast flourish — where that's tempting).
    This session's fix: plain ASCII letter glyphs in a small badge (matches
    the existing single-letter rarity badge convention already in
    `renderCardEl`) instead of emoji, which render identically everywhere
    Courier New does. Worth a standing rule in `render/EFFECTS.md` or a
    comment near `renderCardEl` if this keeps coming up — not added
    unilaterally by this session since it's a style-guide-level call, not a
    single-slice one, but the concrete failure mode (screenshot to verify
    ANY new glyph choice; a DOM-presence check alone is not enough) is
    flagged here for whoever hits it next.

---

## 2026-09-26 — Session 5 (buff/penalty grammar, EFFECTS.md slice 2; avatars)

1. **Player avatars are in.** Each player now has a username-seeded
   placeholder avatar (HUD and match bar). `MatchReplay.identities[pid]`
   has an `avatarUrl` slot, and the page uses a real image there when one
   is provided. Nothing for you to do until the platform/onboarding stage
   supplies real profile images. The replay CLI now suffixes `-A`/`-B` on
   mirror matches so the two sides get distinct usernames, and therefore
   distinct avatars.

2. **A card interaction worth knowing about (balance lane's call, not
   this lane's).** Found by this session's real-match tests: Reflex Spike's
   +0/+3 buff on Overclock Beast (SW-004) does nothing visible. Overclock
   Beast's health comes from a stat-scaling override, which swallows the
   buff. The engine logs "grants +0/+3", but the board doesn't change, so
   the render correctly shows nothing. If that's intended, fine. If not,
   it's a wasted card that agents may keep playing.

3. **Small engine log cosmetic:** negative buffs format as "+-1/+0" in the
   event log (e.g. "Feedback Plating grants Aegis Cadet +-1/+0"). That's
   `engine/src/log/format.ts`, so it's off-limits to this lane. Commentators
   (stage 7) will read this text, so it's worth a one-line fix on a balance
   session.

4. **Still open from before:** slice 4 (attack travel + impact) needs
   instance IDs on attack/damage/buff events. As of this session only
   `play` and `summon` carry `instanceId`.


---

## 2026-09-26 — Session 6 (cast flourish, EFFECTS.md slice 3; slice-2 taste calls)

1. **Your three slice-2 taste calls and the negative-"grant" note are all
   done** (this lane records it here, not in owner-feedback.md, per
   RENDER.md guardrail 4). Multi-unit penalties are now spectacle.
   Source-faction tint and the label/particle split were already shipped,
   and the new cast flourish follows both. Feedback Plating's `+-1/+0` at
   aegis-vs-aegis seed 1 moves 29/40 sinks, since the stat delta's sign
   decides, never the event name. There's a regression test on that exact
   match.

2. **Slice 4 (attack travel) may no longer be blocked on the balance
   lane.** The engine's `combatDamage` stack item already carries
   `attackerInstanceId` and an instance-exact `target`, and the render can
   read those read-only, the same way this session reads an activated
   ability's source. The event-log instance-ID work is still worth doing
   for commentators (stage 7), but the render may not need to wait for it.

3. **Four taste calls on the cast flourish** are in
   `progress/render/checkpoints.md`: cause/effect stagger, tag wording,
   response loudness, and where a Command casts from. None of them block
   anything.
