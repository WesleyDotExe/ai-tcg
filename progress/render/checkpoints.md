# Render lane — checkpoints

The render lane's own checkpoint log (RENDER.md guardrail 4 — kept separate
from the shared `progress/checkpoints.md`). Newest at top, same convention
as the shared file. "AWAITING FEEDBACK" per DESIGN.md's non-blocking
checkpoint process: this flags and continues, never blocks.

---

## 2026-09-25 — Animated per-move transitions — AWAITING FEEDBACK

**What this delivers:** the render's biggest named gap against DESIGN's
arena bar ("animated card plays and attacks... enough motion and
readability") — session 1 shipped a turn-by-turn snapshot viewer with no
motion between frames; this session adds eight distinct, purpose-built
animations (card enter, card exit via a real positioned ghost, attack
lunge, hit/heal flash with floating damage/heal numbers, a telegraph-arming
pulse, an evolution pulse, and a stat-buff flash), plus smooth HP/energy/
momentum-gauge transitions. Full detail: `progress/render/log.md`'s
session-2 entry.

**Evidence:** two real captured matches, regenerated against the current
(post-Phase-4) card pool, single-stepped through every move in real headless
Chromium with a MutationObserver recording which FX actually fired on real
DOM nodes: `render/output/aegis-vs-swarm-seed1.html` (six of eight FX types,
79 moves, zero console errors) and `render/output/aegis-vs-cortex-seed24.html`
(all eight FX types including evolve and buff, 100 moves, zero console
errors) — seed 24 picked via a scratch seed scan specifically because it
exercises evolution, matching session 1's own practice for picking evidence
seeds. A mid-match screenshot (not committed, inspection only) confirmed the
floating damage/buff numbers land correctly positioned and legible. All 14
pre-existing render-lane tests still pass unmodified; typecheck clean across
all 5 workspaces.

**Where it's strong:** the animation is driven by an exact instanceId/
numeric diff between consecutive captured frames, not by parsing the event
log's text fields — which matters because a real bug was found and avoided,
not just a design preference (see "decisions to overrule" below).

**Where it's thin:** box-shadow flashes (hit/heal/buff) can visually
overwrite each other if more than one fires on the same card in the same
step (rare, not observed in either committed match, not a crash). Board
layout is still frame-by-frame with no persistent per-slot identity, so a
surviving unit can visually "jump" position the same step a neighbour dies
elsewhere on the row. Momentum's gauge now animates smoothly but its
underlying weights are untouched. Token summons don't get a distinct visual
from a normal play. Still 1v1 only.

**Decisions the owner might want to overrule:**
1. **Animation intentionally does NOT use the event log's own
   attacker/defender/target/unit fields.** Checked the engine source rather
   than assumed: those fields are card/player *names*, not instance IDs
   (`engine/src/engine/engine.ts`, `engine/src/effects/resolver.ts`) — which
   means they cannot reliably distinguish which specific copy of a card, or
   which of two players, an effect applied to whenever both sides share a
   name (a mirror match on cards, or same-named agents like
   Lookahead-vs-Lookahead, which is this project's own standard balance-test
   shape). This lane can't fix the event log (RENDER.md forbids editing any
   engine file) — flagged as a real gap in `progress/render/notes-for-owner.md`
   for the balance lane, since it also affects the scrolling text event log
   itself (pre-existing, just not previously named as an identity gap).
2. **Animation only plays on single-step playback, not on jumps.** A
   scrubber drag or First/Last does an instant, unanimated re-render. This
   was a deliberate scope call (a jump has no coherent "in between" to
   animate), not an oversight — flagging in case the owner wants jump
   animation too (e.g. always animating toward the target frame).
3. **Session 1's `aegis-vs-cortex-seed1.html` was replaced, not kept
   alongside the new file.** Regenerating it against the current (much
   changed) card pool no longer produced a short match exercising varied
   mechanics, so this session removed it and committed
   `aegis-vs-cortex-seed24.html` instead, keeping the "two current replays"
   convention from session 1's own notes-for-owner flag about not letting
   committed evidence accumulate. If the owner wants prior sessions'
   evidence kept for comparison rather than superseded, say so and future
   sessions will stop replacing.

**What's next:** per RENDER.md's alternation rule, the next render-lane
session is two sessions away. Leading candidates named in
`progress/render/log.md`: a fixed-slot board layout (fixes the same-step
reflow), or the still-open momentum-weight pass.

---

## 2026-09-24 — First watchable render: a real match, turn by turn — AWAITING FEEDBACK

**What this delivers:** the first working slice of DESIGN.md's stage 6
(spectator render), carved out to run in parallel per RENDER.md/the
2026-09-24 owner-feedback entry that created this lane. A self-contained
HTML page that plays back a real, engine-produced match turn by turn: both
players' boards (all 6 shared slots), live unit stats (tools/auras/buffs
baked in, not printed values), telegraph/evolution/tool/status state, the
public stack, health/energy, hands, a full event log, and a computed
momentum gauge. Not a mockup — every number on the page comes from actually
running the match through the real engine.

**Evidence:** `render/output/aegis-vs-swarm-seed1.html` and
`render/output/aegis-vs-cortex-seed1.html`, two real captured matches (182
and 154 moves), openable in any browser, no external dependencies. Verified
rendering correctly (zero console errors, correct state at arbitrary scrub
positions, correct end-of-game banner) in a real headless-Chromium pass
before committing. 14 new automated tests + a clean typecheck across all 5
workspaces. Full detail in `progress/render/log.md`'s session-1 entry.

**Where it's strong:** the data is real and derived correctly (this was the
main risk — a renderer that quietly shows printed stats instead of live
ones, or drifts from what the engine actually did, would be worse than
useless for a spectator). The event log reuses the engine's own
`formatEvent`, so what a viewer reads matches the committed sample-match
logs word for word. The guardrails held: nothing under `engine/src/data/**`
or the other named balance/card files was touched; the small amount of
"engine internals" this needed (queries.ts's derived-stat helpers,
LookaheadAgent, buildNullDeck) is read-only, isolated in one file
(`render/src/engineInternal.ts`) with a comment explaining exactly why and
what it's not allowed to do.

**Where it's thin (honest, not just for the record):** no motion — frames
snap, they don't animate card plays/attacks the way DESIGN's arena bar
ultimately wants. Placeholder art is generative-but-simple (hue + one of 4
patterns), real per-card distinctness the way real art eventually will be.
Momentum's weighting is a first guess, not tuned against any real viewer
reaction. 1v1 only. All named as the concrete next-slice candidates in
`progress/render/log.md`.

**Decisions the owner might want to overrule (name them explicitly, per
DESIGN's checkpoint process):**
1. **Deep-importing engine internals instead of widening the public
   barrel.** `render/src/engineInternal.ts` reaches past
   `engine/src/index.ts` to import `buildNullDeck`, `LookaheadAgent`, and
   `state/queries.ts`'s derived-stat helpers directly from their source
   files, because RENDER.md forbids this lane from editing any engine file
   including `index.ts`. The alternative — the balance lane (or a future
   session with both lanes' permission) adding these to the public barrel —
   would be cleaner long-term but is out of this lane's authority. Flagged
   in `progress/render/notes-for-owner.md` too.
2. **Momentum's formula and weights** (health ×1.0, live non-pending board
   power ×0.6, hand size ×1.5, energy ×0.5, squashed into a ±100 display
   range) are this session's own reasoned first proposal, not owner-set
   numbers. If the "why" text reads wrong once there's real spectator
   feedback, it should change freely — nothing else depends on the exact
   weights.
3. **Rarity visual escalation was pulled forward slightly.** DESIGN scopes
   the full visual rarity ladder (full-art, foil/shine, "neon nights") to
   stage 8 — this session only added a modest inset-highlight/glow/pulse
   progression by rarity to the placeholder frames, reasoning that "cards
   render as literally identical rectangles regardless of rarity" would
   itself be a small regression against the "genuine visual interest" bar
   this stage is already held to. If this reads as scope creep rather than
   a reasonable placeholder-quality floor, it's easy to flatten back out.

**What's next:** per RENDER.md's alternation rule, the next render-lane
session is two sessions away (this task alternates focused slices — the
next session goes back to the balance/roadmap track). When the render lane
comes back around: animated frame transitions is the most obviously missing
piece against DESIGN's arena bar, named as the leading candidate in
`progress/render/log.md`, but left open for whoever picks it up to judge
against whatever's changed by then.
