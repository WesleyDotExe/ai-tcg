# Render lane — checkpoints

The render lane's own checkpoint log (RENDER.md guardrail 4 — kept separate
from the shared `progress/checkpoints.md`). Newest at top, same convention
as the shared file. "AWAITING FEEDBACK" per DESIGN.md's non-blocking
checkpoint process: this flags and continues, never blocks.

---

## 2026-09-26 — Defence/shield primitives (EFFECTS.md slice 1) — AWAITING FEEDBACK

**What this delivers:** the first slice of `render/EFFECTS.md`'s build
order — the standing visual-language spec the owner set up two sessions
ago. Three defence/shield primitives, built once and shared across every
faction (no per-faction work needed, since Barrier/Guard/baseArmor are
card-level traits, not faction-specific mechanics): Barrier's interpose +
absorb + shatter (a cyan flash + floating "BLOCKED" label the moment a
unit's Barrier status is consumed — closing a real gap where a
fully-absorbed hit previously got NO visual at all, since health doesn't
change when Barrier eats the whole hit), a persistent shield badge on Guard
units (plus a matching *live* one for an active Barrier, replacing a
pre-existing minor inaccuracy where the old text tag stayed lit forever
after the shield was already spent), and a small, deliberately un-scaled
deflect spark whenever a unit with base armor takes damage. Full detail:
`progress/render/log.md`'s session-4 entry.

**Evidence:** two new `UnitSnapshot` fields (`baseArmor`, `barrierActive`)
read straight off real engine state, proven with 3 new whitebox tests
(`render/test/defenceSnapshot.test.ts`) against real matches via
`captureMatch`, not synthetic fixtures — a real Aegis Cadet reports
`baseArmor: 1`, a real Barrier Node's `barrierActive` flips true the moment
it's played. The tier scoring for Barrier's shatter is a 4th pure, tested
function alongside session 3's existing `fxMagnitude.ts` module. Both
committed replays were re-scanned and regenerated (`aegis-vs-swarm-seed16`,
`aegis-vs-cortex-seed20`) specifically to exercise all three mechanics in
one match, then verified in real headless Chromium both single-stepped
(shield badges rendered dozens of times, the shatter flourish fired
multiple times, zero console errors) and at full autoplay speed (reached
the end, zero console errors) — session 3's own "verify at play speed, not
just single-step" bar, re-checked because this session's new tier
(`barrierBreakScore`) plugs into the same adaptive-pacing machinery.
`npm test`: engine 86/86, protocol 7/7, server 23/23, agents 17/17, render
40/40 (34 + 6 new). `npx tsc --noEmit` clean in all five workspaces.

**Where it's strong:** a real bug was found and fixed before shipping, not
after — the first badge implementation used a shield emoji that rendered
completely invisible in this environment's real headless Chromium (no
colour-emoji font installed), caught by actually screenshotting it rather
than trusting the DOM/mutation-count evidence alone, and fixed by switching
to plain capital-letter badges that match this codebase's own existing
single-letter rarity-badge convention. The Barrier fix specifically closes
a real, named legibility gap (a fully-absorbed hit previously had zero
visual feedback at all), not just a cosmetic addition.

**Where it's thin, named honestly:** a hit small enough to be *fully*
absorbed by base armor (health unchanged) doesn't trigger the deflect spark
— that needs the same instance-keyed event data the balance lane's
still-open instance-ID gap (2026-09-25 owner-feedback) would provide. The
new shield badges weren't stress-tested against a worst-case crowded card
(evolved, tooled, tagged, AND badged all at once). Session 2/3's own
already-named thin spots (floating-number stacking, no fixed-slot board
layout, untuned momentum weights) are all still open, untouched this
session.

**Decisions the owner might want to overrule:**
1. **Barrier's shield badge is LIVE (tracks `barrierActive`, disappears the
   instant it's consumed), not a static "this card can have Barrier"
   indicator** — a deliberate accuracy call, and it also meant removing the
   pre-existing "BARRIER" text tag (which stayed lit forever, inaccurately)
   from the generic keyword-tag list. If the owner would rather a unit's
   Barrier-*capability* stay visible even once spent (e.g. for a
   Tool-granted Barrier that could be re-triggered), that's a different,
   easy-to-build indicator — this session built the "is it live right now"
   read instead, reasoning that's what a spectator actually needs to judge
   an upcoming attack.
2. **The base-armor deflect spark is intentionally NOT tier-scaled** — the
   spec's own word "small" was read as "always small," not "small unless
   the hit is big." Easy to make it participate in the tier system instead
   if that reads as under-selling a big deflected hit.
3. **Guard's persistent badge and Barrier's persistent badge use the SAME
   shield-family visual (steel vs. cyan-pulsing)** rather than two visually
   unrelated icons, reasoning they're both "defence" in the same grammar
   family even though they're mechanically different (taunt vs. one-shot
   absorb). If that reads as conflating two different mechanics rather than
   a coherent shared language, they're easy to differentiate further.

**What's next:** per `render/EFFECTS.md`'s own build order, slice 2 (buff
rise / penalty sink grammar) or slice 3 (power/ability cast flourish) are
both unblocked and open; slice 4 (attack travel + impact) still explicitly
waits on the balance lane's instance-ID event-log fix, not yet landed.

---

## 2026-09-26 — Scale animation magnitude to event magnitude — AWAITING FEEDBACK

**What this delivers:** direct response to the owner's 2026-09-25 "scale
animation magnitude to event magnitude" feedback — session 2's eight FX
classes all played at one fixed size regardless of what happened; a
1-damage ping looked as loud as a Mythic entering. Every FX class now
carries a subtle/normal/spectacle tier, scored from the effect's own weight
(rarity, damage amount, AOE/board-wide count, unconditional-destroy vs
combat death) and/or the momentum gauge's swing, per the owner's own
five-point spec. `normal` is deliberately unchanged from session 2's
existing look (the owner's same-day pacing note calls the current rhythm an
approved baseline) — only the outliers move: subtle events are quicker and
quieter, spectacle events are longer, bigger, and get a new "burst ring"
visual plus a dedicated full-screen flash for the lethal blow. Autoplay
pacing is now adaptive too — the loudest tier in a move decides how long the
NEXT move waits (spectacle holds ~900ms extra so its animation actually
completes; subtle moves advance ~45% faster) — the "first concrete use of
the adaptive-pacing note" the owner's other 2026-09-25 entry asked for when
stage 7 arrives; this is earlier than that, scoped narrowly to what this
feedback asked for (magnitude-driven autoplay pacing), not full commentary
pacing. Full detail: `progress/render/log.md`'s session-3 entry.

**Evidence:** the scoring logic itself is a pure, unit-tested module
(`render/src/fxMagnitude.ts`, 20 new tests) — not just eyeballed thresholds.
Both committed replays were regenerated against the current card pool
(session 19 grew Aegis's pool since session 2's originals were captured) and
driven in real headless Chromium in TWO passes, closing the exact gap the
owner named ("verify at PLAY speed, not just single-step," item 5 — session
2 only single-stepped): single-step tallied real FX/tier classes landing on
DOM nodes across all 101/134 frames (zero console errors), and a SEPARATE
autoplay pass at the "fast" preset measured the actual gaps between moves
(118-1158ms, versus a flat 250ms before this session), confirming the >900ms
holds land specifically on the moves flagged spectacle — the pacing is
real, not just computed and discarded. A screenshot at a live spectacle
moment (an effect-kill mid-match) confirms the burst ring and scaled flash
render correctly. `npm test`: engine 86/86, protocol 7/7, agents 17/17,
render 34/34 (14 pre-existing + 20 new); the one server test failure is a
pre-existing, unrelated socket-timing flake (this session touched nothing
under `server/`). `npx tsc --noEmit` clean in all five workspaces.

**Where it's strong:** the magnitude model is data-driven and tested, not
just "make some things bigger" — a Mythic entering, an unconditional
destroy, a board-wide effect, and the lethal blow are all independently
provably spectacle-tier by their own scoring rules, matching all five of the
owner's named examples. The "normal" tier is byte-for-byte the same
animations session 2 shipped, so nothing regresses for the common case.

**Where it's thin, named honestly:** the browser-side scoring logic can't be
imported from the tested module (this file has no bundler, it's a
template-literal `<script>`) — it's hand-mirrored, a real (if small)
duplication-drift risk flagged in both files' own comments. Attack lunges
weren't given a magnitude tier (the owner's spec didn't name them as an
input). The lethal-blow full-screen flash fires on any game-ending move,
including a turn-cap/move-cap ending, not literally only a killing hit — it
reads as "the match just ended" rather than strictly "lethal," which may or
may not be the intended framing. Session 2's own already-named thin spot
(floating numbers stacking illegibly when two FX land on one card the same
move) is still present, confirmed again by this session's screenshot, and
still not fixed — it's a layering bug, not a magnitude-scaling one.

**Decisions the owner might want to overrule:**
1. **The tier thresholds and per-effect score weights** (`render/src/
   fxMagnitude.ts`'s constants) are this session's own reasoned first
   proposal, tuned against the five named examples and the two committed
   replays' own real numbers — not owner-set. Easy to retune if a tier feels
   wrong once there's more to eyeball it against.
2. **Adaptive autoplay pacing was scoped to this feedback's own ask**
   (hold on spectacle, speed past subtle) rather than building the full
   momentum/significance-driven commentary pacing the OTHER 2026-09-25 entry
   describes for stage 7 — that entry explicitly said "flag the exact
   pacing model at a checkpoint when stage 7 arrives," so this session did
   not treat this as that checkpoint. If the owner would rather this WAS
   that model, say so and it can be extended rather than redone.
3. **The lethal-blow flash applies to any game-ending move**, not narrowed
   to an actual killing blow only (see "where it's thin" above) — a
   deliberate choice to give every match's ending a beat, open to being
   narrowed if that reads wrong.

**What's next:** per RENDER.md's alternation rule, the next session goes
back to the balance/roadmap track. When the render lane comes back around,
session 2's two open candidates (fixed-slot board layout; a momentum-weight
retune) plus this session's own newly-flagged floating-number stacking fix
are all legitimate next picks — left open per this lane's own practice of
not over-prescribing.

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
