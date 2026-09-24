# Render lane — checkpoints

The render lane's own checkpoint log (RENDER.md guardrail 4 — kept separate
from the shared `progress/checkpoints.md`). Newest at top, same convention
as the shared file. "AWAITING FEEDBACK" per DESIGN.md's non-blocking
checkpoint process: this flags and continues, never blocks.

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
