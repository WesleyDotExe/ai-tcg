# Render lane — session log

This is the render lane's own log (RENDER.md, guardrail 4 — kept separate
from the shared `progress/log.md` so the two lanes never merge-conflict).
Newest at bottom, like the shared log's convention.

---

## 2026-09-24 — Session 1: first render slice, the match replay page

Per the new 2026-09-24 owner-feedback entry folding this lane into the main
scheduled task (alternating sessions — the previous session, #18, was a
balance/card slice, so this session does one render slice per RENDER.md),
and this is genuinely the FIRST render session — `render/` and
`progress/render/` didn't exist before this.

**What I built:** RENDER.md's own suggested first slice, done for real: a
new `@ai-tcg/render` workspace package that plays a real match through the
public engine API (`createInitialState`/`getLegalMoves`/`applyMove`/
`beginTurn`/`buildPlayerView`, the same calls `engine/src/engine/match.ts`'s
own `runMatch` makes) and captures a full structured board snapshot after
*every* move — not a text-log parser, the actual `GameState` read through
the engine's own derived-stat query helpers (`currentAttack`/
`currentHealth`/`currentMaxHealth`/`hasKeyword`/`boardSlotsUsed`/
`effectiveCardCost`), so tool bonuses, static auras, and permanent buffs are
reflected correctly rather than showing printed card stats. That capture
(`render/src/capture.ts`) feeds a self-contained HTML replay page
(`render/src/renderHtml.ts`) with turn-by-turn playback: both boards (all 6
shared slots per DESIGN's board-development system), unit stat cards
showing live attack/health, telegraph "ARMING" state with an arm-turn
countdown, evolution tags, attached tools, status tags (Barrier etc.),
directives, the public stack (LIFO, matching what an agent itself sees),
health/energy bars, hand contents, deck/graveyard counts, a full
turn-by-turn event log (reusing the engine's own `formatEvent`, so the
prose matches the committed sample-match-*.txt logs exactly), and a
computed "momentum" gauge — principle 2's "legible who's-ahead-and-why
signal" — with a short named-reason readout (health/board/hand deltas).
Playback: prev/next/first/last/play-pause, a scrubber, adjustable speed,
arrow-key and spacebar shortcuts.

**Placeholder art, not emoji-on-black (DESIGN's art section, explicitly
required at this stage):** every card gets a generative frame — faction
palette (Cortex cyan, Aegis chrome-teal, Swarm acid green, Null magenta,
picking up the cyberpunk/90s-retro-futurism direction from the 2026-09-11
owner feedback), a deterministic per-card pattern (`render/src/
cardVisual.ts` hashes the card's own id into a hue-shift + one of 4
generative background patterns — same card always looks the same, two
different cards in the same faction/rarity still read as visibly distinct),
and rarity-driven framing (Uncommon gets an inset highlight, Rare a
coloured glow, Mythic an animated pulsing glow) — a first, intentionally
modest version of the visual-rarity-ladder DESIGN describes as stage-8
spectacle, not a claim that this IS that ladder.

**Guardrails followed (RENDER.md):** nothing under `engine/src/data/**`,
`decks.ts`, `poolLint.ts`, `balanceReport.ts`, or `agents/` was touched.
Two small gaps in the engine's *public* barrel (`engine/src/index.ts`)
turned up while wiring this — `buildNullDeck` and `LookaheadAgent` aren't
exported from it, and neither are the `Faction`/`Rarity`/`CardType`/
`Keyword` types or the `state/queries.ts` derived-stat helpers — but rather
than edit `index.ts` (an engine file), `render/src/engineInternal.ts` deep-
imports the same underlying engine source files read-only, with a comment
explaining why, and the gap itself is flagged in
`progress/render/notes-for-owner.md` for the balance lane to fix if it ever
wants to (this lane can't touch it). The one repo-wide file this session DID
touch outside `render/` is the root `package.json` (added `"render"` to the
`workspaces` array, so `npm install`/`npm test`/`npm run typecheck` at the
root pick this package up like every other workspace) and the resulting
`package-lock.json` — both outside the guardrail's explicit "never touch"
list (data/cards/balance files) and necessary for this to be a real,
CI-checked workspace rather than an orphaned directory.

**Evidence, not claims:**
- `npm run typecheck --workspaces --if-present` passes clean across all 5
  workspaces (engine/protocol/server/agents/render).
- `npm test --workspaces --if-present`: 81+7+23+17+14 = 142 tests pass,
  including 14 new render-lane tests (`render/test/`): `capture.test.ts`
  (frame count matches moves played, frame 0 is an empty board, the match
  ends in a winner or the turn cap, slot/health/energy bounds hold every
  frame, every frame carries a momentum reading), `momentum.test.ts` (even
  reads even, a clear health/board lead is correctly attributed and named,
  pending/dormant telegraphed units are correctly excluded from board-power
  scoring), `cardVisual.test.ts` (determinism, range bounds, real card ids
  don't collapse onto one visual).
- Two real, unscripted matches captured end to end and committed as
  self-contained HTML: `render/output/aegis-vs-swarm-seed1.html` (182
  moves, 21 turns, P1 wins) and `render/output/aegis-vs-cortex-seed1.html`
  (154 moves, 19 turns, picked via a quick seed scan specifically because it
  exercises the widest mechanic coverage in one game: evolution, tool
  attachment, telegraph arming, directive destruction, attack redirection,
  and base-armor damage reduction all fire for real in this one match).
- Both pages were actually opened and driven in a real headless Chromium
  (the environment's pre-installed Playwright browser, not a project
  dependency) — zero console/page errors, scrubbing to arbitrary moves
  renders correctly, reaching the final move shows the correct GAME OVER
  banner and winner. Caught and fixed one real layout bug this way (a tool
  chip absolutely-positioned over a two-line card name) before committing —
  screenshots aren't committed (the HTML itself, openable in any browser, is
  the evidence), but the verification was real, not assumed.

**What's genuinely thin, named honestly (see quality-debt equivalent in
notes-for-owner.md and here for the next render session):**
- Momentum's weights (health/board/hand/energy) are a first reasoned
  proposal, not tuned against real spectator reaction — there's no
  spectator yet to tune against. Flagged as a taste call for a future
  checkpoint once there's enough render output to judge it against.
- No animation between frames — the board re-renders instantly on each
  step. RENDER.md's guardrails/first-slice scope this session to "turn by
  turn," and DESIGN's arena bar ("animated card plays and attacks") belongs
  to a later render slice building smooth transitions on top of this
  frame-stepping foundation, not this one.
- Only 1v1 matches are captured (`captureMatch` takes exactly two decks).
  DESIGN's 4-player mode is explicitly out of scope for the first stage-6
  slice and wasn't attempted.
- The telegraph-delay-feel question RENDER.md names ("unanswerable twice,
  nothing to watch it in") is now genuinely judgeable — both committed
  matches show a telegraphed unit sitting dormant with a visible arm-turn
  countdown before firing. Flagged in notes-for-owner.md, not force-judged
  by this session.

**Next render-lane slice (thread for whichever future session picks this
lane back up, per the alternation rule — the session after next, unless the
alternation direction changes):** animated transitions between frames (the
biggest gap against DESIGN's "animated card plays and attacks" arena bar),
and/or a momentum-weight pass once there's more output to eyeball it
against. Either is a legitimate next vertical slice; RENDER.md leaves the
choice open.

---

## 2026-09-25 — Session 2: animated per-move transitions (the thread session 1 left)

Per the 2026-09-24 alternation rule: the most recently merged PR before this
session was session 18's balance slice (#20, "ring labels corrected"), so
this session does the render lane's turn. Picked up session 1's own named
leading candidate: animated frame transitions, the biggest gap against
DESIGN's arena bar ("animated card plays and attacks... enough motion and
readability that a human enjoys watching without playing").

**What I built:** the board no longer snaps to the next frame — a full,
diff-driven transition layer in `render/src/renderHtml.ts`'s inline script,
with eight distinct, purpose-built animations, none of them a generic
fade-the-whole-board crossfade (the cheap-out this session deliberately
avoided):
- **Card enter** (fade + rise + scale) when a unit or directive is newly
  played or summoned.
- **Card exit** (a ghost clone that fades, shrinks, and drops, positioned at
  the real DOM rect the dying card occupied a moment before) when a unit
  dies or a directive is destroyed — the ghost is spawned from the *real*
  card-rendering function fed the last-known snapshot, not a placeholder box.
- **Attack lunge** (a directional nudge toward the opponent, up for P1's row,
  down for P2's) on the attacking unit.
- **Hit flash + a floating "-N"** on whatever took damage — a unit or a
  player's own HUD panel.
- **Heal flash + a floating "+N"** the same way, in the opposite colour.
- **A gold "armed" pulse** when a telegraphed unit's dormant window ends and
  it fires for real — this is also the answer to RENDER.md's own parked
  question (below).
- **An evolve pulse** (scale + brightness/saturation pop) the instant a base
  mutates into its evolved form.
- **A buff flash + floating "+N ATK"** when a unit's attack changes without
  a matching health change (tool attach, a static aura shifting).
- The HP/energy bars and the momentum gauge also stopped being
  rebuilt-from-scratch every frame — their DOM nodes are now built once and
  updated in place, so their own width/position changes are real CSS
  transitions, not instant jumps hidden inside a full re-render.

**The harder design decision, and why it matters:** the obvious approach —
parse each frame's `newEvents` (the engine's own formatted event log, e.g.
`{type:"attack", attacker, defender}`) to drive the animations — turns out
to be unsafe to build on. Checked the engine source
(`engine/src/engine/engine.ts`, `engine/src/effects/resolver.ts`) rather
than assuming: `attacker`/`defender`/`target`/`unit` on these events are
**card or player NAMES**, not instance IDs (`attacker: attacker.card.name`,
`target: player.name`, etc.). That's fine for a scrolling text log (which
already carries this limitation) but wrong for an animation engine, which
would then misattribute an effect onto the wrong copy of a card, or the
wrong player's HUD, in the extremely common case of a mirror match (both
committed sample matches, and most of this project's own balance-report
methodology, run the *same agent policy on both sides* — e.g.
Lookahead-vs-Lookahead — so `target: player.name` genuinely cannot tell P1
from P2 by name alone). So this session did NOT parse event text for FX.
Instead, every animation is driven by a diff between the already-precise,
instanceId-keyed board snapshot this lane captures each frame (`collectBoard`
in the new JS) — comparing frame N-1 to frame N by instanceId and by exact
numeric deltas (health, attack, `pending`, `canAttackThisTurn`, `cardId` for
evolution). This is exact regardless of naming collisions, and it's also
simpler: no string parsing, no controller inference, just "did this specific
instance's health drop" / "did this exact unit's `canAttackThisTurn` flip
true-to-false" (the precise, unambiguous signal that it just attacked).
Per RENDER.md's guardrail 2 ("if you need an engine change, STOP, write the
need down"), this is a real per-card-name-collision instance-identity gap in
the event log format — flagged in `progress/render/notes-for-owner.md`
rather than worked around by editing the engine.

**Animation only runs on genuine single-step playback** (Next/spacebar/the
play loop/ArrowRight) — a jump (scrubber drag, First/Last, or any
non-adjacent step) does a plain instant re-render, which is the right call
for a jump: there's no real "in between" to animate through, and trying to
diff a 40-frame jump into one coherent animation would be incoherent, not a
missing feature.

**Proven working, not just wired up:** typecheck clean across all 5
workspaces; the pre-existing 14 render-lane tests still pass unmodified
(they test `capture`/`momentum`/`cardVisual`, none of which this session
touched). Real, unscripted evidence — driven with the environment's
pre-installed headless Chromium via a scratch Playwright script (not a
project dependency, same as session 1), stepping every single move of a
real captured match and recording which FX classes actually got applied to
real DOM nodes (a `MutationObserver`, not a visual guess):
- `render/output/aegis-vs-swarm-seed1.html` (regenerated against the current
  card pool — session 1's original had 182 moves against a card pool that
  has since gone through 5+ balance sessions; this is the same seed,
  current pool, 79 moves/15 turns): `fx-enter` 36×, `fx-attack` 30×,
  `fx-heal` 21×, `fx-hit` 27×, `fx-armed` 6×, `fx-ghost` 2× — zero console
  errors across all 79 single-stepped frames.
- `render/output/aegis-vs-cortex-seed24.html` (session 1's old `-seed1`
  file for this matchup is superseded/removed — regenerating against the
  current pool changed its move count enough that the old seed no longer
  exercised the same mechanics, so a fresh scan of seeds 1-40 via a scratch
  script found seed 24 as a short, real match that fires *every* one of the
  eight FX types, including the two seed1-Swarm didn't reach): `fx-enter`
  36×, `fx-attack` 54×, `fx-hit` 63×, `fx-buff` 24×, `fx-armed` 3×,
  `fx-ghost` 5×, `fx-heal` 23×, `fx-evolve` 5× — zero console errors across
  all 100 single-stepped frames.
- A mid-match screenshot (not committed, just used to verify by eye) caught
  a real in-flight moment: a "-2" floating over the P1 HUD, a "+1 ATK" over
  Recursive Construct, a "-3" over Firewall Sentinel mid-combat, and a
  "-1" over an EVOLVED Aegis Sentinel — all legible, correctly positioned,
  no layout breakage.

**RENDER.md's parked question, now genuinely answerable with motion, not
just a static dormant-state screenshot:** both committed matches show a
telegraphed unit's `pending` state actually SWITCH OFF live — the card
visibly pulses gold the instant it arms, not just "sits there with a
countdown" the way session 1's static frame-stepping showed it. Noted in
`progress/render/notes-for-owner.md`.

**What's genuinely thin, named honestly:**
- The `fx-buff`/`fx-hit`/`fx-heal` box-shadow flashes on the same element in
  the same frame can visually stack/overwrite each other if more than one
  fires on one card in one step (e.g. a unit both takes damage and gets
  buffed the same move) — CSS animation cascade just picks one, not a
  layered effect. Rare in practice (checked: didn't observe it in either
  committed match) and not a crash, just a missed flourish in an edge case.
- No animation for token summons specifically beyond the generic card-enter
  (a "summon" event doesn't get a distinct visual from "played from hand") —
  a reasonable next micro-slice, not attempted this session.
- Still 1v1 only, still frame-by-frame board layout (no persistent per-slot
  DOM identity across a mid-array compaction when a unit dies elsewhere on
  the board) — a card can visually "jump" a slot position on the same step
  its neighbour dies, which reads a little abrupt next to the enter/exit
  animations. A genuinely fixed-slot-identity board layout would fix this
  but is a bigger structural change than this slice's scope.
- Momentum's weights are still session 1's first guess, untouched this
  session — its width/position now animate smoothly, but the *values*
  weren't revisited.

**Next render-lane slice:** either (a) a fixed-slot board layout so units
don't visually reflow when a neighbour dies mid-row, or (b) the momentum-
weight pass session 1 also left open. Both legitimate; left open per
RENDER.md's own practice of not over-prescribing the next session's choice.

---

## 2026-09-26 — Session 3: scale animation magnitude to event magnitude (owner feedback, 2026-09-25)

Per the 2026-09-24 alternation rule: the most recently merged PR before this
session was session 19's balance slice (#22, "Phase 5 slice 1 — grow Aegis
pool"), so this is the render lane's turn. Picked up the owner's own named,
already-scoped directive rather than session 2's open "next slice" menu —
it's a direct, specific ask with a five-point spec, so it takes priority
over the two open-ended candidates (fixed-slot layout, momentum-weight
tuning) session 2 left on the table; both are still open for whichever
session picks this lane back up next.

**The problem, in the owner's own words:** the eight FX classes session 2
built all play at one fixed size/duration regardless of what happened — "a
Mythic entering uses the same modest fade as a common unit." Fix asked for:
subtle stays subtle, big stays big, judged from the effect's own weight
and/or the momentum gauge's delta, and — the part session 2 explicitly
didn't verify — checked at PLAY speed, not just single-step.

**What I built, in two layers:**

1. **A pure, unit-tested magnitude-scoring module**
   (`render/src/fxMagnitude.ts`, 20 new tests in
   `render/test/fxMagnitude.test.ts`, all passing). Every FX class gets a
   0-3ish numeric score, bucketed into three tiers (subtle / normal /
   spectacle):
   - **Enter**: by rarity alone — Common is subtle, Mythic is spectacle
     (session 2's own named gap, tested directly).
   - **Death**: by rarity, plus a bonus when the unit died in a move with no
     `attack` event of its own — i.e. an effect/removal kill (Kernel Panic's
     unconditional destroy is the owner's own example) reads louder than an
     ordinary combat death at the same rarity. A Mythic dying is spectacle
     either way.
   - **Hit** (unit or player): by damage amount, plus a bonus when 3+ units
     took damage in the same move (AOE / board-wide effect) — a 1-damage
     ping alone is subtle; the same 1-2 damage landing on three bodies at
     once is spectacle, per the owner's own "board-wide effect" example.
   - **Player hit**: the same shape, but the killing blow (game just ended,
     this player's health drop caused it) always maxes out to spectacle —
     the owner's named "lethal blow" example.
   - **Heal / buff**: by amount, same subtle-at-1 shape.
   - **Evolve**: always spectacle — an explicit owner example, not
     conditional on anything.
   - **Armed** (telegraph firing): by rarity — a Mythic's telegraph landing
     is spectacle, an ordinary one is normal.
   - **Momentum swing**: the delta between this move's and the last move's
     gauge score, independent of any single card event, feeding pacing (not
     a per-card FX) — the owner's own "or the momentum-delta the gauge
     already computes" alternative signal.
   All of this only reads event *types* and *counts* in aggregate (was there
   an `attack` event this move, how many `damage` events), never
   attacker/target/unit *names* — the render lane's own known identity gap
   (notes-for-owner.md item 4) stays correctly unused; which specific
   instance got which FX is still decided by the exact instanceId diff
   session 2 already built, not by this scoring.

2. **Wiring the tiers into `renderHtml.ts`'s inline JS/CSS** (this part
   necessarily hand-mirrors the module above — the whole file is a
   template-literal `<script>` with no bundler to import a real module into
   the page, the same reason `cardArtStyle` already reimplements
   `cardVisual.ts`'s logic inline; kept in sync by hand, flagged as a
   maintenance note in both files):
   - Every existing FX class (`fx-hit`, `fx-heal`, `fx-buff`, `fx-enter`,
     `fx-armed`, `fx-evolve`, `fx-ghost`, floating numbers) now carries a
     `fx-mag-subtle|normal|spectacle` modifier class. `normal` intentionally
     keeps the exact pre-existing look/duration (the owner's 2026-09-25
     pacing note calls the current rhythm an approved baseline to protect),
     so nothing changes for the common case — only the outliers move.
     Subtle: shorter duration, softer/no glow. Spectacle: longer duration
     (900ms, matched to the floating-number/death/evolve durations that
     were previously overrunning the frame — the "collision" the owner
     named directly), bigger scale/brightness swing, and an added **burst
     ring** (a new, third visual language, not just "bigger fade") spawned
     at the element's screen position for enters, evolves, armings, and
     deaths that land as spectacle.
   - **A dedicated full-screen flash for the lethal blow** (`fx-lethal-overlay`,
     a radial pulse), separate from the per-card hit flash — the single
     most significant event any match has gets a beat no card-level
     animation alone would give it.
   - **Adaptive pacing during autoplay** — the owner's item 4 ("a big
     animation needs a beat... hold or slow the frame") and the literal
     first concrete use of the same day's separate adaptive-pacing design
     note ("pacing must be driven by move SIGNIFICANCE, not a fixed
     clock"). `goTo`'s per-move `runFx` now returns the loudest tier that
     fired during that move (including the momentum-swing and
     game-just-ended checks), and the autoplay loop (rewritten from a fixed
     `setInterval` to a `setTimeout` chain so the delay can vary per tick)
     reads it to pick the NEXT tick's wait: spectacle holds for
     `speed + 900ms` so its animation actually completes before the next
     move starts overwriting it; subtle moves advance at `0.55x` speed (floor
     120ms) so routine moves genuinely flash by; normal moves are unchanged.
     Single-step (arrow keys / Next / Prev / scrubber) is untouched — pacing
     only applies to autoplay, where the owner's own "verify at PLAY speed"
     point actually matters.

**Proven working, not just wired up — this time including the exact check
session 2 admittedly skipped.** Both committed replays were regenerated
against the current card pool first (session 19, merged since session 2's
originals were captured, grew Aegis 18->22 — move counts shifted from
79/100 to 100/133 moves, the same kind of pool-drift regeneration session 2
already documented needing) via `npm run replay -w @ai-tcg/render`, then
driven with the environment's pre-installed headless Chromium through a
scratch Playwright script (not a project dependency) in TWO passes per
file, not one:
- **Single-stepped through every move**, tallying which FX/magnitude
  classes actually landed on real DOM nodes: both files exercised all three
  tiers (subtle/normal/spectacle) and the new burst effect (23 bursts on
  the Swarm match, 62 on the Cortex match, which has more removal/evolve
  traffic). Zero console errors across 101 and 134 frames respectively.
- **Played at the "fast" (250ms) speed preset**, the actual autoplay path,
  polling the frame counter and timing the real gaps between moves: gaps
  ranged 118ms-1158ms (vs a flat 250ms before this session), with the
  >900ms holds landing specifically on the moves the tally marked
  spectacle — the adaptive pacing is real, not just computed and discarded.
  Zero console errors during autoplay either.
- A screenshot at a live spectacle moment (an effect-kill on Retaliation
  Node from Salvage Reflex's damage-redirect, mid-match in the Cortex
  replay) confirms the burst ring, the scaled hit flash, and the
  already-known thin spot from session 2 (stacked floating numbers on a
  card taking two effects the same move) is still present and still just a
  missed flourish, not a bug — not fixed this session, out of scope for a
  magnitude pass specifically.

**Named honestly, not fixed this session:**
- The stacked-floating-number cosmetic overlap session 2 already flagged as
  thin is still there (confirmed again in this session's own screenshot
  evidence) — a layering fix, not a magnitude-scaling one, left for
  whichever session does the general FX-polish pass.
- Attack lunges (`fx-attack`) were deliberately left at a flat `normal`
  tier — the owner's five-point spec names entering/dying/hitting/evolving/
  arming/momentum as the magnitude inputs, not the lunge motion itself, and
  scaling it would have meant guessing at a signal the owner didn't ask for.
- The lethal-blow full-screen flash fires on ANY game-ending move (a draw
  or a turn-cap/move-cap ending included, not only an actual killing hit) —
  reads as "the match just ended," which is still the single most
  significant beat of the whole replay, but isn't literally a "lethal
  blow" red flash in those cases. Not narrowed to true kills only, since a
  turn-cap ending deserves its own beat just as much; flagged in case the
  colour/framing should differ by ending type.
- `render/test/capture.test.ts` fails when run directly inside `render/`
  (a pre-existing workspace-resolution quirk, not caused by this session —
  `@ai-tcg/engine` only resolves via the root's npm workspace symlinks);
  running from the repo root (`npm test` / `npm run test -w @ai-tcg/render`)
  is unaffected and all 34 render tests (14 pre-existing + this session's
  20 new `fxMagnitude` tests) pass.
- `server`'s pre-existing `integration.test.ts` "closes a third connecting
  socket" test fails/flakes on this environment regardless of this
  session's changes (confirmed: this session touched nothing under
  `server/`, `git status` on that directory is clean, and the failure
  reproduces identically re-run in isolation) — named for the record, not
  this lane's file to fix (RENDER.md guardrail 1).

**Result: `npm test` (root, all five workspaces) — engine 86/86, protocol
7/7, agents 17/17, render 34/34 all pass; server 22/23 (the one pre-existing,
unrelated flake above). `npx tsc --noEmit` clean in all five workspaces.**

**Next render-lane slice:** session 2's two open candidates are still both
open — (a) a fixed-slot board layout so units don't visually reflow when a
neighbour dies mid-row, or (b) the momentum-weight pass. This session adds a
third real candidate: the stacked-floating-number layering fix named above.
All three are legitimate; left open per RENDER.md's own practice.

---

## 2026-09-26 — Session 4: defence/shield primitives (EFFECTS.md slice 1)

Per the 2026-09-24 alternation rule: the most recently merged PR before this
session was session 19's balance slice (Phase 5 slice 1, Aegis pool growth) —
the four commits after it in `git log` (EFFECTS.md itself, RENDER.md's
pointer to it, and the player-identity feedback entry) are the owner pushing
directly to `progress/owner-feedback.md`/`RENDER.md`/`render/EFFECTS.md`,
not a session PR, so they don't flip the alternation. This is the render
lane's turn, and `render/EFFECTS.md`'s own build order is explicit: "Next
render session: start slice 1 (defence/shields)." Took that literally rather
than picking from the open candidates session 3 left (fixed-slot layout,
momentum retune, floating-number stacking) — EFFECTS.md is the owner's own
named next step, dated one day after those.

**What EFFECTS.md's slice 1 asked for, verbatim:** "interpose + absorb +
shatter on Barrier; a persistent shield badge on Guard units; a small
deflect on base-armor damage reduction... No pairing dependency — do this
FIRST." Built exactly that, across every faction via one shared mechanism
each (not three separate per-faction builds — Barrier/Guard/baseArmor are
card-level traits any faction's cards can carry, so faction skin (item 5 in
the build order) rides the existing palette variables for free, no
per-faction work needed this slice).

**Two new UnitSnapshot fields, read straight off real engine state**
(`render/src/capture.ts`, `render/src/types.ts`): `baseArmor` (off
`unit.card.baseArmor ?? 0` — the same field `engine/src/effects/
resolver.ts`'s own damage-reduction code reads) and `barrierActive` (off
`unit.statuses.some(s => s.kind === "Barrier")` — the *live* status, not
the static `keywords` list). That second field mattered for a real,
pre-existing minor inaccuracy this session found and fixed in the same
pass: the existing card-tag rendering showed a "BARRIER" text pill whenever
a card's `keywords` included Barrier, which stays true FOREVER after the
card is played even once its shield has already been consumed — misleading
by design, not by bug, since `keywords` only ever meant "this card grants
Barrier on play." Removed Barrier (and Guard, now redundant with its own
badge below) from that generic tag loop and replaced both with the new,
accurate, live-state shield badges.

**Three FX primitives built, each proven with real match evidence, not
just wired up:**

1. **Barrier interpose + absorb + shatter.** The actual gap this closes:
   when Barrier fully absorbs a hit, the unit's health doesn't change at
   all, so session 2/3's existing hit-flash logic (keyed off a health
   delta) produces **zero visual** for a hit that genuinely happened and
   was blocked — confirmed by reading `engine/src/effects/resolver.ts`'s
   `applyDamage` (Barrier returns early before any health change once it
   absorbs). Fixed with a diff check independent of health: `barrierActive`
   true in the previous frame, false in this one, on a unit that's still
   alive, fires a new `fx-shatter` CSS class (a cyan flash distinct from
   the hit-flash's red, since this is a defensive event, not a damage one)
   plus a floating "BLOCKED" label — the first non-numeric floating-text FX
   this lane has built. Tiered by a new `barrierBreakScore(rarity)` in
   `render/src/fxMagnitude.ts` (4 new tests), same shape as the existing
   `armedScore` — a Common's shield breaking is at least `normal`-tier (a
   hit that did nothing still deserves a legible beat), a Mythic's is
   `spectacle`. No pairing/attacker data needed at all, exactly as
   EFFECTS.md predicted for this slice — the instanceId diff alone is
   sufficient.
2. **A persistent shield badge on Guard units**, and a matching one — live,
   not static — for an active Barrier. Small badge icons in each card's
   top-right corner (tags/EVOLVED stay top-left), steel-grey and steady for
   Guard, shield-cyan with a slow idle pulse for Barrier (distinguishing
   "permanent trait" from "temporary, about to be tested" at a glance,
   without any animation timing implications — the pulse is a pure CSS
   loop, independent of the move-driven FX system, so it can't regress the
   owner's protected `normal`-tier baseline pacing).
3. **A small, deliberately un-scaled deflect spark on base-armor damage
   reduction.** Any health-reducing hit on a unit with `baseArmor > 0`
   spawns a small steel-grey ring (`fx-deflect-ring`) alongside the
   ordinary hit flash — "small" is the spec's own word, so unlike the other
   two primitives this one does NOT go through the magnitude-tier system;
   it's a constant, minor flourish layered on top of whatever tier the hit
   itself is. Named limitation, not fixed this session: a hit small enough
   to be *fully* absorbed by armor (a real, printed AG-001/AG-013/NL-*/CT-*
   baseArmor:1 vs. a 1-damage ping) leaves health unchanged and so isn't
   caught by this health-delta-gated check — closing that needs per-hit
   instance-keyed event data the engine doesn't emit yet (the same
   instance-ID gap notes-for-owner.md item 4 already names, still open on
   the balance lane's side).

**A real bug found and fixed before shipping, not shipped and left for
someone else to catch.** The first badge implementation used a shield emoji
(U+1F6E1) as the icon. Screenshotting it in this environment's real headless
Chromium (not assumed, not single-stepped-and-eyeballed only) showed
**nothing at all** — not even the badge's own background pill — at the
card's top-right corner where the DOM inspector confirmed the element was
present and correctly populated. Root-caused by checking computed style
directly rather than guessing: this sandboxed headless Chromium has no
colour-emoji font installed, so the glyph fell back to the ambient inherited
text colour (`.card`'s own near-black `#0a0e18`, meant for text on top of a
bright faction-coloured card) with no icon shape to carry it, rendering
functionally invisible against the badge's own dark translucent background.
Fixed by switching to plain capital-letter glyphs ("G"/"B") in a monospace
badge — not a workaround, a better match for this project's own existing
convention (the rarity badge is already a single capital letter, `c.rarity[0]`)
that also happens to be guaranteed to render everywhere Courier New does.
Re-screenshotted after the fix to confirm the badges are now actually
visible, not just re-run the same blind check that missed it the first time.

**Evidence — both committed replays regenerated against the current pool
and re-verified, not reused from session 3.** Session 3's committed seeds
(`aegis-vs-swarm-seed1.html`, `aegis-vs-cortex-seed24.html`) weren't picked
for this slice's mechanics and didn't reliably exercise all three together,
so this session re-scanned
(`npm run replay -w @ai-tcg/render`, a scratch seed scan over 60 seeds each
matchup, not committed) for seeds hitting `baseArmorReduced` + `barrierAbsorbed`
+ a Guard unit on board in the SAME match, and replaced the committed files:
- `render/output/aegis-vs-swarm-seed16.html` (152 moves, 13 turns) —
  5 base-armor reductions, 3 Barrier absorbs, Guard units present.
- `render/output/aegis-vs-cortex-seed20.html` (136 moves, 15 turns) —
  12 base-armor reductions, 1 Barrier absorb, Guard units present.
Both driven in real headless Chromium (this environment's pre-installed
build, via the globally-installed `playwright` package — not a project
dependency, same as sessions 2/3) in the same two-pass style session 3
established: single-stepped through every move with a MutationObserver
tallying which FX/badges actually landed on real DOM nodes (shield badges:
49-171 renders; `fx-shatter`: 2-6; the deflect ring: 4 in the Cortex match,
where base armor is more active), zero console errors across every frame in
both files; then a separate full-speed ("fast" preset) autoplay pass to the
end of the match, also zero console errors — the "verify at PLAY speed, not
just single-step" bar session 3 first satisfied, re-checked here since this
session's changes plug into the same adaptive-pacing tier system (a
spectacle-tier shatter now also earns an autoplay hold, for free, via the
existing `tiers.push(...)`/`maxTierOf` machinery — nothing new to build
there). Two real screenshots committed as evidence are NOT checked in
(matching this lane's existing practice of not committing screenshots, the
HTML itself being the real evidence) but were taken and inspected: one shows
"BLOCKED" floating in shield-cyan over Latent Ward the exact move its
Barrier absorbs a hit from Corrosive Spitter (matches the event log line
underneath it word for word), the other shows a Guard badge legible on
Barrier Drone's card.

**Tests.** `render/test/fxMagnitude.test.ts`: 4 new tests for
`barrierBreakScore` (clears the subtle floor even at Common, scales
monotonically, Mythic is spectacle). `render/test/defenceSnapshot.test.ts`
(new file): 3 whitebox tests proving `capture.ts` reads the two new fields
off real match state correctly — `baseArmor: 1` shows up on a real Aegis
Cadet (AG-001) across a seed scan, non-base units correctly report 0, and
`barrierActive` flips true the moment a real Barrier Node (SW-008, a Swarm
card with the Barrier keyword) enters play — not synthetic fixtures, real
engine matches via `captureMatch`, the same seed-scan style the balance
lane's own dev-demo scripts use. `npm test` (root, all five workspaces):
engine 86/86, protocol 7/7, server 23/23, agents 17/17, render 40/40 (was
34 + 6 new = 40). `npx tsc --noEmit` clean in all five workspaces.

**Named honestly, not fixed this session:**
- The base-armor-fully-absorbed-with-zero-visible-hit case (above) — needs
  the engine's own instance-ID event-log gap closed first.
- Session 2/3's already-named thin spots (stacked floating numbers
  overlapping when two FX land on one card the same move; no fixed-slot
  board layout; momentum weights untouched) are all still open, untouched
  this session — none were this slice's job.
- The shield badges are a NEW small UI element added to every card that has
  Guard or active Barrier; this session did not re-verify overall card
  layout/legibility at very small viewport sizes with the badge present
  (existing `.tags`/`.arm-count` elements already share the small-card
  layout budget) — no overlap was observed in the screenshots taken, but
  this wasn't stress-tested against, say, a 4/4 evolved Rare with tools,
  tags, AND both badges at once in the same match.
- `render/EFFECTS.md`'s own dependency note ("attack `travel` and defence
  `interpose` need... instance IDs... until it lands, infer pairing from
  the frame diff") didn't end up mattering for this slice specifically —
  Barrier/Guard/baseArmor are all per-instance traits with no
  attacker-pairing question at all, exactly as the build order predicted
  by putting this slice first, before attack travel+impact (slice 4, which
  DOES need the pairing fix).

**Next render-lane slice:** per `render/EFFECTS.md`'s own build order,
slice 2 is next — buff (rise) and penalty (sink) grammar, tier-scaled and
faction-tinted (the fx-buff flash session 2 already built is the raw
material; this would be about the rise/sink MOTION primitive EFFECTS.md
specifies, not just a colour flash). Slice 3 (power/ability cast flourish)
is also open and has no dependency on slice 2. Slice 4 (attack travel +
impact) still explicitly waits on the balance lane's instance-ID event-log
fix (owner-feedback.md, 2026-09-25) — not yet landed as of this session.

---

## 2026-09-26 — Session 5: buff (rise) / penalty (sink) grammar (EFFECTS.md slice 2) + player avatars

**Why this session is a render session:** the most recently merged PR
before this one was #25 (Session 20, a balance/card slice), so per the
owner's 2026-09-24 alternation rule this session does one render slice per
RENDER.md. Per `render/EFFECTS.md`'s build order that's slice 2. The
owner's 2026-09-26 "reserve player identity" entry explicitly allows a
render session to fold the avatar slot into its current slice, so this one
does.

**1. A real legibility bug, measured before fixing.** The pre-existing
"buff" flash keyed off a raw attack delta and the heal flash off a raw
health delta. Scanning 48 real Lookahead-vs-Lookahead matches (12 seeds ×
Null/Aegis, Aegis/Null, Cortex/Swarm, Aegis/Cortex) with the new
classifier showed the old render misread three common cases, every match:
- **debuffs drawn as buffs** — a -1 ATK sap or aura flashed in the same
  gold as a buff (up to 15 times in one match, Aegis-vs-Null seed 8). That
  breaks EFFECTS.md's one invariant (a debuff always reads as a debuff);
- **+HP buffs drawn as heals** (3–14 per match) — maxHealth and health rise
  together, and the old code only saw "health went up";
- **Null's -2/-2 shrink drawn as a hit** (up to 5 per match) — a red
  damage number for something that wasn't damage.

**2. The fix is an exact decomposition, not a heuristic.** The engine's
health model is `currentHealth = currentMaxHealth - damageTaken`
(`engine/src/state/queries.ts`), so a maxHealth change is a stat shift and
whatever health change is left over is precisely damage or heal.
`render/src/statFx.ts` (new, pure) classifies each surviving, non-evolving
unit's frame-to-frame change as `buff` / `penalty` / `expire` / nothing:
- stat deltas net positive → buff; net negative, or any newly applied
  Stasis/Overload status → penalty;
- a temporary (`turnBuff`) buff or debuff wearing off at end of turn is
  its own kind, `expire` — neither a buff nor a penalty, rendered as a
  quiet always-subtle "settle". This needed a new `turnBuff` snapshot
  field (read-only from engine state in `capture.ts`);
- live stats are clamped (attack ≥ 0, maxHealth ≥ 1), so an expiry on a
  clamped unit can't just be subtracted — the test suite caught the
  classifier misreading "a -1 debuff on a 0-attack unit wears off" as a
  fresh -1 penalty; fixed with a clamp guard.

**3. The rise/sink primitives** (`renderHtml.ts`), one function each,
parameterised by direction (meaning), tint (faction skin), tier (size):
- **rise**: card lifts and brightens, faction-tinted glow, triangle motes
  float UP off the card, gold label floats up;
- **sink**: card is pressed down, desaturated and darkened, desaturated
  motes fall DOWN, a slate label sinks;
- **tint** = the source card's faction when the event log names a source
  we know (a new `cardFactions` name→faction map; a name lookup is safe
  despite the name-only event log, since it only has to say which
  *faction*, never which *instance*), else the side that normally causes
  it (buff → own, penalty → opponent);
- **tier** = new `statShiftScore` in `fxMagnitude.ts`: stat size +
  statuses + how many units took the same shift this move.
- **Persistent state** so the viewer isn't relying on catching the
  animation: ATK/HP numbers go gold with ▲ when above printed, slate with
  ▼ when below (HP compares *max* health, so ordinary damage never reads as
  a debuff), and Stasis/Overload get dashed "S"/"O" badges in the badge
  column (a Stasis'd unit's art is also greyed).

**4. Tuning caught at play speed, not in theory.** The first breadth rule
(any shift on 3+ units = spectacle) made nearly every penalty in the
Aegis matches a spectacle hold, because the pool's most common penalty is
Aegis's recurring "-1 ATK to every enemy unit until end of turn" (Feedback
Plating, onDamaged). That's exactly the "busy board shouting" the owner's
2026-09-25 feedback warned against. The breadth bonus is now
magnitude-aware: a -1 across the board is `normal` (visible, no hold); 2+
points per unit on 3+ units (e.g. Cortex's Mainframe Core +1/+1 to every
ally) stays spectacle. After re-tuning, across the three committed replays:
every penalty lands `normal`, 9 buff labels reach spectacle (all from one
Mainframe Core aura move in the Cortex match), expiries all subtle.

**5. Player identity (owner-feedback 2026-09-26).** New `render/src/avatar.ts`:
a deterministic, username-seeded SVG placeholder (5×5 mirrored cell body in
`currentColor` = the faction colour, plus a frame shape — circle / hex /
diamond / square — and an accent-ring hue from the same seed). No glyphs or
emoji (the slice-1 headless-Chromium emoji lesson). Shown in both HUDs
(38px, beside name + faction tag) and the match bar. `MatchReplay` now
carries `identities: { username, avatarUrl?, avatarSvg }` per player —
`avatarUrl` is the drop-in slot for a real image; the page uses it when
present. The CLI now suffixes `-A`/`-B` on mirror matches, since usernames
key the avatar and "Lookahead-Aegis" vs "Lookahead-Aegis" would otherwise
be two identical players (`aegis-vs-aegis-seed1.html` shows the two
visibly different avatars side by side).

**Evidence.**
- Replays regenerated for this slice's mechanics (the session-4 files were
  replaced, as each session has done; both new Aegis files still exercise
  Guard/Barrier/base-armor too):
  `render/output/aegis-vs-null-seed3.html` (136 moves; 15 buffs, 12
  penalties incl. the -2/-2 shrinks),
  `render/output/aegis-vs-cortex-seed6.html` (157 moves; 14 buffs incl. a
  board-wide spectacle, 13 penalties, 3 Stasis/Overload badges live at once),
  `render/output/aegis-vs-aegis-seed1.html` (105 moves; mirror-match
  avatars, 7 expiry settles, 12 penalties).
- Driven in real headless Chromium (pre-installed build, global
  `playwright`, not a project dependency — same as sessions 2–4): every
  move single-stepped with a MutationObserver tallying FX, then a separate
  full-speed ("fast") autoplay to the end. **Zero console errors in all
  three**, and the full-speed pass produced exactly the same FX tally as
  single-stepping in every file. Screenshots inspected (not committed, per
  lane practice): a sink on Null units under Feedback Plating's sap; the
  Mainframe Core board-wide rise; a quiet expiry settle; mirror-match
  avatars. The screenshots caught one real flaw — wide labels ("+1/+1!")
  were left-anchored and spilled onto the neighbouring card — fixed by
  centring stat labels, re-shot to confirm.
- Tests: `render/test/statFx.test.ts` (new) — 16 hand-built classifier
  cases; a **parity test that extracts the hand-mirrored inline-JS block
  from a real generated page and runs it against the TS module** on every
  case, plus the full `statShiftScore` input grid (this lane has mirrored
  logic by hand since session 3 with no drift check — now it has one for
  the new code); and a real-match test using the engine's own event log as
  referee (46 buffs, 23 penalties, 21 status applications, 37 expiries,
  685 plain hits checked across 48 RandomAgent matches — each path must be
  exercised, not vacuously pass). `render/test/avatar.test.ts` (new, 5).
  `fxMagnitude.test.ts`: `buffScore` tests replaced by 8 `statShiftScore`
  tests. `npm test`: engine 89/89, protocol 7/7, server 23/23, agents
  17/17, render 81/81 (was 40). `tsc --noEmit` clean in all five.

**Named honestly, not fixed this session:**
- A unit hit AND buffed/debuffed on the same move only plays ONE of the two
  card animations (both set the CSS `animation` property; the later class
  wins). Both floating labels and the motes still show, so the information
  isn't lost, but the motion is.
- A penalty *lifting* (a Null -1 aura's source dies, so the victims' ATK
  goes back up) renders as a rise tinted in the owner's colour. The
  direction is honest (the stat went up), but it reads as "buffed", not
  "freed". Telling those apart needs aura-source data the snapshot doesn't
  carry.
- Faction tint is palette-only; per-faction particle *character* (Cortex
  packets, Swarm spores, Null glitch) is slice 5's job. Motes are the same
  triangle for everyone right now.
- A buff swallowed entirely by a stat-scaling override (real case found by
  the tests: Reflex Spike's +0/+3 on Overclock Beast, SW-004) gets no
  animation, because the board genuinely doesn't change. That's the
  truthful render, but a viewer reading the event log sees a buff with no
  visual. Noted for the owner as a possible card-interaction question.
- The older fxMagnitude functions (enter/death/hit/…) are still hand-mirrored
  without a parity test; only the new code has one. Extending the
  extraction test to them is cheap and should happen.
- Session 2–4 thin spots still open: overlapping floating numbers on busy
  moves (reduced, not solved, by offsetting stat labels), no fixed-slot
  board layout, momentum weights untouched.

**Next render-lane slice:** EFFECTS.md slice 3 — power/ability cast
flourish (`cast(source)`). No dependency. `abilityTrigger` events carry the
source card NAME only, so pick the source instance the same way this slice
picks tint: by name, falling back to a non-attributed flourish when the
name is ambiguous (a mirror). Slice 4 (attack travel + impact) is still
waiting on the balance lane's instance-ID event-log work — only `play` and
`summon` events carry `instanceId` so far, not attack/damage/buff.

## 2026-09-26 — Session 6 (power/ability cast flourish, EFFECTS.md slice 3; owner's slice-2 taste calls)

Render session under the alternation rule: the last merged PR (#27) was a
balance slice. Owner feedback had two render entries to act on. The first
was the slice-2 review (2026-09-26), with three taste calls and a note on
negative "grants". The second was the standing EFFECTS.md build order,
whose next item is slice 3. Per RENDER.md guardrail 4 this lane doesn't
write to the shared `owner-feedback.md`, so the handling is recorded here.

**Owner's slice-2 taste calls, handled:**
1. *A multi-unit penalty is spectacle.* `statShiftScore` now returns at
   least the spectacle threshold for a penalty on 2+ units, whatever each
   unit's share. A lone small penalty stays proportional, and buff breadth
   is unchanged because the ruling was about penalties. This is changed in
   `fxMagnitude.ts` and in the page's mirror, with tests. In the five
   committed replays it adds 0-3 spectacle holds per match, all from
   Aegis's Feedback Plating sap.
2. *Tint by source faction.* This was already the shipped behaviour, so
   nothing changed. The new cast flourish follows the same rule.
3. *Keep the label/particle colour split.* Also already shipped. The cast
   flourish follows it too: the trigger tag is always the fixed "power"
   lilac (`--cast`), and only the ring, sigil and rays wear faction colour.
4. *The negative-"grant" note (aegis-vs-aegis seed 1, moves 29/40).* I
   confirmed the classifier already decides by the sign of the stat delta,
   never by the event name. Every unit Feedback Plating's `+-1/+0` hits at
   both moves classifies as a penalty (sink), and under ruling 1 it's now a
   spectacle. There's a new regression test in `statFx.test.ts` that
   replays that exact match with the CLI's agents and seeds.

**Slice 3 — `cast(source)`, built.**
- `render/src/castFx.ts` (new) turns one move into a list of "which card
  just used a power, and where is it on screen". The event log names a
  source by card NAME only, so each trigger is narrowed by instance-exact
  facts from the same move:
  - onPlay: the `play` event's instanceId, or the unit that evolved, or
    the unit whose telegraph armed.
  - onAttack: the unit that just spent its attack.
  - onDeath: a unit that left the board.
  - onDamaged: a unit that actually lost health.
  - Turn triggers: the turn owner's side only, with copies paired to
    events in board order when every copy logged.
  - Commands: they come from the controller of the stack item.
  - Activated abilities: the capture now reads the exact source instance
    off the engine's `StackItem.source` (new
    `StackItemSnapshot.sourceInstanceId`, read-only).

  Whatever is still ambiguous after narrowing becomes an honest banner
  beside that side's board, never a guess.
- **One copy of the logic, not a hand mirror.** The module's logic is a JS
  source string that the page embeds verbatim and Node evaluates for tests
  and callers. That rules out drift by construction, unlike the older
  TS-plus-hand-mirror pattern. The trade-off is no type-checking inside
  the string; the tests cover that.
- **Primitive** (`renderHtml.ts`, `spawnCast`): one function for every
  faction and tier. It draws an expanding ring, a spinning diamond sigil
  and rays thrown outward, all in the source card's faction tint. A
  trigger tag in the fixed power colour names the kind of power: ON PLAY,
  ON ATTACK, ON HIT, ON DEATH, TURN START/END, ACTIVATE, CAST, RESOLVE,
  RESPONSE. Anchors:
  - card: on the exact card, or where it stood if the power was its death;
  - Command: the sigil plays on the caster's avatar, and the tag sits in
    the stack row on the caster's side;
  - banner: for the ambiguous cases.
- **RESPONSE.** An Instant cast on the opponent's turn gets a double-ruled
  tag and a louder tier. DESIGN names reactivity as a core pillar, and
  before this slice the render gave it nothing beyond a stack chip.
- **Tier** (`castScore`): the source card's rarity sets the base. An
  activated ability or a Command adds a little, a response adds more, and
  recurring triggers (turn start/end, on hit, on attack) are damped so a
  busy board doesn't shout. The tier thresholds are fxMagnitude's (a test
  pins that).
- **Bug found and fixed on the way:** `spawnNumber` had `return el;`
  *before* its cleanup `setTimeout`, so since session 3 every floating
  number stayed in the DOM for the rest of the replay. After the fix, the
  FX layer drains to 0 elements within 2 s of the last move in all five
  replays.

**Evidence.**
- `render/test/castFx.test.ts` (new, 12 tests):
  - magnitude cases;
  - seven hand-built attribution cases (mirror onPlay, onDeath, paired
    turn triggers, unpairable-so-banner, activated via stack, Command +
    RESPONSE, Command resolve);
  - a check that the page embeds the source verbatim;
  - a **real-match oracle test**. It wraps the engine's `resolveAbility`
    in a test-only `vi.mock` (no engine file touched) to record the true
    source instance of every logged trigger. It then runs 48
    LookaheadAgent matches (all 16 faction pairings × 3 seeds, including
    mirrors): 819 powers, every trigger and cast accounted for, **385
    card attributions checked against the oracle with zero wrong**. 91 of
    them needed narrowing because 2+ same-named copies were on board. 6
    were honest banners.
- `fxMagnitude.test.ts`: every magnitude function now has a parity test
  against the page's inline mirror (was statShiftScore only, named debt
  from session 5). The penalty-breadth tests were rewritten for the
  owner's ruling.
- Replays regenerated (`render/output/`). There are two new ones picked
  for power variety: `cortex-vs-null-seed5.html` (20 cast flourishes:
  activations, a response, deaths, turn ends) and
  `null-vs-swarm-seed2.html` (18: Bit Rot as a RESPONSE, Garbage
  Collector activations with two copies on board). The three older
  replays were regenerated too. `aegis-vs-null-seed3` is now 114 moves,
  because the Null pool changed in session 21.
- Driven in real headless Chromium. Each replay was single-stepped with a
  MutationObserver tallying the cast FX, then autoplayed at full speed
  ("fast"). All five had **zero console errors**, gave **identical cast
  tallies in both passes**, and left 0 FX-layer elements after 2 s.
  Screenshots were inspected (not committed, per lane practice), and they
  caught one real flaw. A Command's tag, placed under the avatar, covered
  the HP bar and clipped at the window edge. I moved it into the stack row
  on the caster's side and re-shot to confirm.
- `npm test`: engine 97, protocol 7, server 23, agents 17, render 97 (was
  81). `tsc --noEmit` is clean in all five.

**Named honestly, not fixed:**
- The oracle can't see triggers the resolver fires internally (onDeath,
  onDamaged), because the mock only wraps calls coming from `engine.ts`.
  For those, the test checks consistency instead (the named unit left the
  board or was hit), not ground truth.
- Cause and effect play at the same instant. The cast sigil and the
  effect it caused (a hit, a sink) start together, so "this caused that"
  relies on proximity and the tag, not sequencing. A short stagger would
  read better but would change the approved `normal` timing, so it's
  flagged for the owner, not done.
- The trigger tag says WHICH kind of power fired, not WHAT it does. The
  ability text exists (on the stack item and in the card data) but
  doesn't fit on a 118px card. That's arguably the commentators' job
  (stage 7).
- Particle character is still the same for every faction (slice 5).
- Still open from sessions 2-5: a hit plus a stat shift on the same move
  shows only one card animation; a penalty *lifting* reads as a buff;
  there's no fixed-slot board layout.

**Next render-lane slice:** EFFECTS.md slice 4, attack travel + impact.
It may not need the balance lane's event-log instance-ID work after all.
The engine's `combatDamage` stack item already carries
`attackerInstanceId` plus an instance-exact `target`. Extending
`StackItemSnapshot` to carry both (read-only, like this session's
`sourceInstanceId`) gives exact attacker→target pairing, including in
mirrors.

## 2026-09-27 — Session 7: attack travel + impact (EFFECTS.md slice 4); the owner's four cast-flourish calls

**Why this slice.** Under the alternation rule the most recently merged PR
was balance (#29), so this was a render session. The owner's 2026-09-26
render entry queued two things: the cast-flourish taste calls (the stagger
on spectacle casts only, and a Command's card flying onto the stack folded
into slice 4), then slice 4 itself.

**Built.**
- **Capture** (`capture.ts`, `types.ts`). Every `StackItemSnapshot` now
  carries the engine's own `stackId`. A combatDamage item also carries
  `attackerInstanceId` and `target`. All three are read-only, and no
  engine file was touched.
- **`render/src/attackFx.ts`** (new). It uses the castFx single-source
  pattern: the JS source is embedded in the page verbatim and evaluated
  in Node. It follows each stack item by id:
  - declare: a new combat item;
  - redirect: same item, new target;
  - strike: the item left. The engine's only pop is resolution, so an
    item leaving means it resolved. It records outcome hit /
    fizzle-attacker / fizzle-target using the engine's own two fizzle
    rules against the pre-move board, the attacker's power, and whether
    there's a counter;
  - command: a new Command item.

  `pendingAttacks(frame)` lists the attacks still waiting.
- **Page** (`renderHtml.ts`):
  - *Aim.* An SVG layer redrawn on every render, plus on resize and
    scroll, draws a marching dashed arc and arrowhead in the attacker's
    faction colour, with a spinning reticle on the target unit or avatar.
    It persists through the whole response window and fades in when
    fresh. On a redirect the old arc fades out in shield colour, with a
    REDIRECTED label.
  - *Travel.* `spawnBolt` sends a tier-sized bolt with a trail along the
    same arc, using the Web Animations API. Flight time is 30% of the
    speed setting, clamped to 70-240ms, then scaled by tier (so 168-283ms
    at normal). It never changes the tick.
  - *Impact.* A burst lands with the bolt, sized by tier. A defender with
    attack returns a smaller bolt in its own colour.
  - *Timeline.* `later(ms, fn)` defers FX. Stepping to the next move
    flushes anything still waiting, so move N never paints on move N+1's
    board, and a jump cancels it. On a strike move, every consequence
    waits for the bolt: hits, numbers, shatter, deflect, stat shifts,
    HUD hits, casts, the lethal flash, and ghosts. Ghosts now take a
    delay, holding at full strength via animation-delay with fill
    `both`. The attacker's own hit and ghost wait for the return bolt.
  - *Stagger (owner call 1).* On a non-strike move with a spectacle-tier
    cast, effects wait 150ms. Cause-type FX (enter, evolve, arm) stay
    immediate.
  - *Command flight (owner call 4).* The card is rendered from the
    caster's previous-frame hand entry. It flies from the hand chip up to
    full size, holds for about 40% of the flight, then shrinks into its
    stack entry. The CAST sigil starts as it lands. castFx's Command
    anchor changed from `hud` to `stack` (with `stackId`); RESOLVE plays
    where the entry was.
  - Calls 2 and 3 were kept as-is, per the owner.

**Evidence.**
- `test/attackFx.test.ts` (8 tests): hand-built cases for every phase,
  both fizzle rules, a redirect and strike-before-declare ordering; the
  single-source embed check; and a **real-match oracle**. Agents are
  wrapped to record the exact move they submitted, over 48 Lookahead
  matches (16 pairings × 3 seeds):
  - 950/950 attack moves produce exactly one declaration, from that
    move's `attackerInstanceId` to its exact `target`. 239 of them had a
    same-named card on the board;
  - every declaration strikes exactly once;
  - each strike's hit/fizzle matches the engine's fizzle log (949 hits,
    1 real fizzle, 186 counters);
  - redirects equal `attackRedirected` events (4);
  - 99/99 Command casts produce a flight.
- castFx tests updated for the stack anchor. The real-match scan also
  asserts every Command flourish found its stack id.
- `npm test`: engine 105, protocol 7, server 23, agents 17, render 105
  (was 97). `tsc --noEmit` is clean in all five workspaces.
- Driven in headless Chromium across all six replays in three passes:
  single-step, normal and fast. All passes had zero errors, identical FX
  tallies, and an FX layer that drained to 0.
  - Single-step timing: the first hit number/mote appears **168-285ms
    after the bolt** (n=103 strikes).
  - 162 bolts in total, 13 Command flights, 124 fresh aim lines, 2
    redirects.
  - Screenshots were inspected (not committed): an aim line held through
    three stacked responses (aegis-vs-cortex moves 70-81), a redirect,
    a bolt mid-flight, a counter bolt, and a Command card mid-flight.
    They caught two flaws, both fixed: the reticle sat on the avatar's own
    frame, and the flying card was full-size for only ~65ms, now ~40% of
    the flight.
- **The stagger finding.** No real move qualified: 0 spectacle casts on
  non-strike moves in 72 matches. I proved it on a scratch fixture (a
  replay with four Commands' rarity set to Mythic). The effect lands at
  +149ms after the sigil and ghosts hold 150ms; the unmodified replay has
  the same moves at +0. Flagged to the owner.
- New replay `render/output/swarm-vs-aegis-seed8.html` (67 moves: a
  redirect, a counter-kill, 2 flights). The other five were regenerated.

**Named honestly, not fixed:**
- **No fixed-slot layout.** A ghost held for bolt flight overlaps the
  card that slid into its slot.
- **Tokens summoned by a spectacle Command enter immediately.** They are
  not staggered, because enter is treated as a cause.
- **Effect damage from powers has no travel.** It needs per-hit event
  pairing.
- **Bolts are identical per faction apart from colour.** That's slice 5.
- **Hand chips are matched by name.** Two copies of a Command in hand fly
  from the first chip; both look the same, so it's harmless.

**Next render-lane slice:** EFFECTS.md slice 5, the faction skinning pass.
Give bolt, cast, mote and burst a per-faction particle character: Cortex
packets, Swarm scatter, Aegis chrome, Null glitch. Consider fixed-slot
board layout first if the owner flags the ghost overlap.

## 2026-09-29 — Session 8: fixed-slot board layout + the cast beat on every response (owner, 2026-09-27)

**Why this slice.** Under the alternation rule, the most recently merged PR
was balance (#31), so this was a render session. The owner's 2026-09-27
render entry set two things. Item 2: fire the ~150ms "cast, then effect"
beat on all responses. Item 3: make fixed-slot board layout the next render
infra priority and "don't let it slip further". Both are done here. Slice 5
(faction skinning) moves to the next render session.

**Built.**
- **`render/src/slotLayout.ts`** (new). `assignSlots(frames)` gives every
  board card a slot when it enters and keeps it there until it leaves. It
  runs once over the whole match, in Node, and writes
  `PlayerSnapshot.slots` into each frame. Stepping, playing, scrubbing and
  jumping all show the same layout for a given move. The rules:
  - units fill from the left and Directives from the right;
  - a newcomer on the same move a card left avoids the just-vacated slot
    (the ghost's spot) whenever another slot is free;
  - on a full board it takes the vacated slot, because nothing else is
    free.

  The engine has no positional mechanics (nothing reads board order), so
  this is purely a render decision. `captureMatch` calls it.
  `renderBoard` reads `slots`; a replay captured before slots existed
  falls back to packed order.
- **Response beat.** castFx's single source gains
  `responseStackIds(frames)`, the engine stack ids of items pushed as a
  RESPONSE, using the same rule as the RESPONSE tag. It also gains
  `resolvedStackIds(prev, next)`. A response's effect lands on the later
  move its item *resolves*, not on the move it was announced. The beat
  now fires on that resolve move: the RESOLVE/ACTIVATE sigil plays, then
  the effect lands 150ms later. The announce move also qualifies, which
  is harmless because the announce has no effect to delay. Spectacle-tier
  powers keep the beat, and Rare+ activations are held in reserve as the
  owner asked.
- **Redirects join the beat.** A redirect is the effect of the power that
  caused it (Intercept Routine is itself a response). The old line now
  holds until the sigil has played, then swings.
- **Bug fixed along the way (session 7).** `drawAimLines` cleared the
  whole aim layer, which removed a redirect's fading old line the instant
  `fadeOldAim` added it. The shield-coloured fade-out described in session
  7 never showed. Measured in the old replays, it lived **0ms**; it now
  lives its full 700ms. Redraws now skip fading groups, and a jump clears
  them.

**Evidence.**
- `test/slotLayout.test.ts` (9 tests).
  - Seven hand-built cases, one per rule, plus evolution keeps its slot
    and a refusal to exceed the cap.
  - A real-match scan over 48 Lookahead matches (16 pairings × 3 seeds;
    10,738 player-frames, 666 placements):
    - every frame's slots hold exactly its board;
    - **0 cards ever change slot**, against **354 slides** the old packed
      layout showed on the same frames;
    - 13 moves had an entry and an exit together. In 3 of those, the
      board was full and the newcomer had to take the vacated slot; the
      test asserts no other slot was free.
  - A response scan over the same 48 matches: all 10 response casts push
    exactly one tracked item, and each resolves exactly once, on a move
    whose own log says `resolving: <that item>`.
- `npm test`: engine 110, protocol 7, server 23, agents 17, render 114
  (was 105). `tsc --noEmit` is clean in all five workspaces.
- Headless Chromium. The old committed replays and the new ones were each
  single-stepped with a MutationObserver on the FX and aim layers. Old
  and new are not identical matches, because the balance lane's Null trim
  changed three of them.

  | | old | new |
  |---|---|---|
  | same card changing slot index between moves | 39 | 0 |
  | ghost covering >20% of a live card | 20 | 0 |
  | response-resolve moves, sigil → first effect | +0ms (3 moves) | +150ms (+149, +151, +150, +151 over 4 moves) |
  | redirect fade-out lifetime | 0ms | 700ms |

  The new replays were then autoplayed at normal and fast. All passes had
  zero console errors, FX tallies identical to single-step, and an FX
  layer that drained to 0.
- Screenshots were inspected, not committed.
  - aegis-vs-cortex-seed6 move 148: gaps stay where cards died, and
    Directives sit at the right end of both rows.
  - aegis-vs-null-seed3 move 107 (Null Pointer resolving as a response),
    captured at +70ms and +320ms. First the RESOLVE sigil plays with Static
    Ward Beacon still standing. Then the Beacon's ghost fades in its own
    now-empty slot, and the four Aegis units sink as its aura drops.
- All six replays were regenerated. Three are different matches now,
  because the Null pool changed in session 23: aegis-vs-null-seed3 is 134
  moves, cortex-vs-null-seed5 is 98, and null-vs-swarm-seed2 is 85.

**Named honestly, not fixed:**
- **Full-board replacement still overlaps.** When the board is full, a
  newcomer must take the slot that just emptied, so the ghost fades over
  it. That happened 3 times in 48 matches. The fix would be a short enter
  delay for that one case.
- **Responses are rare.** There were 10 in 48 Lookahead matches, so the
  beat now fires about once every five matches. The owner said to
  re-judge once it's visible in a real replay. It is visible in
  aegis-vs-null-seed3 (moves 107 and 123) and swarm-vs-aegis-seed8
  (move 40, a redirect).
- **An aura dropping reads as a penalty.** When Static Ward Beacon dies,
  its +1 HP aura lifts and the units show "-1 HP" sinks. That is the
  slice-2 "a buff wearing off" gap (the quiet-settle grammar in EFFECTS.md
  is for temporary buffs, not auras), and it is still open.
- Still open from before: effect damage has no travel (needs per-hit
  event pairing), bolts and particles are identical per faction apart
  from colour (slice 5), and hand chips are matched by name.

**Next render-lane slice:** EFFECTS.md slice 5, the faction skinning
pass. Give bolt, cast, mote and burst a per-faction particle character:
Cortex packets, Swarm scatter, Aegis chrome, Null glitch. With fixed slots
in, the aura-lift misread is a good small add-on if there's room.

## 2026-10-02 — Session 9: the faction skinning pass (EFFECTS.md slice 5)

**Why this slice.** Under the alternation rule, the most recently merged PR
was balance (#34), so this was a render session. Session 8's thread named
slice 5 as next, and the owner's 2026-10-02 entry also says "next session
render". That entry's Watchdog Timer buff is a card change, so it belongs
to the balance session that follows. This session didn't touch it, or any
shared progress file (RENDER.md guardrails 1 and 4).

**Built.**
- **`render/src/factionSkin.ts`** (new). One `FACTION_SKINS` table with a
  row per faction (Cortex, Swarm, Aegis, Null, Neutral), and one generic
  layout function per primitive:
  - `moteLayout(faction, dir, tier, w, h)` sets count, size, x placement,
    sideways drift, lanes and stepping for rise/sink motes;
  - `boltLayout(faction, tier, small, arc)` gives the head, trail and
    cloud particles with their own paths along the attack arc;
  - `castRayAngles(faction, tier)` gives the cast flourish's rays.

  An unknown faction gets the plain row. Same single-source pattern as
  castFx.ts: the page embeds `FACTION_SKIN_SOURCE` verbatim and Node
  evaluates the same text.
- **The meaning stays outside the skin.** Direction comes from the caller
  and is applied after the skin's choices. Every bolt path is pinned to the
  attacker's centre at t=0 and the target's at t=1, because the weave and
  jitter envelopes are sin(πt). No table field can flip a mote or move a
  landing point.
- **The characters** (placeholder art):
  - **Cortex** — square packets that snap to 3 lanes and stream in file.
    The bolt is a train of evenly spaced packets. Dashed rounded-square
    rings, an outlined square sigil, thin circuit-line rays.
  - **Swarm** — 1.7× as many spores at 0.7× size, drifting sideways as
    they rise or sink. The bolt is a spore cloud weaving around the arc
    and converging on the target. Dotted rings, a dotted round sigil, dot
    rays.
  - **Aegis** — 0.6× as many plates at 1.5× size, as chrome hexagons. The
    bolt is one elongated chrome slug turned along its flight. Heavy rings
    with an inner highlight, a filled chrome-hex sigil, wide chrome
    shards.
  - **Null** — torn bars with an RGB split, moving in 4 discrete steps
    with sideways tears. The bolt stutters along the arc in 6 steps with
    jitter, carrying an RGB split. Square rings that flicker on steps(5),
    a broken sigil, dashed rays.
  - **Neutral** — the original look: arrow motes, a round bolt, the
    diamond sigil. A test pins it to the pre-slice layout (3/6/12 motes,
    0/2/4 trail, 0/6/10 rays).
- **Page wiring** (`renderHtml.ts`). `spawnMotes`, `spawnBolt`,
  `spawnCast` and `spawnBurst` now take a faction and read the layout.
  Motes and bolts animate from the layout paths with the Web Animations
  API. Stepped skins use per-keyframe `steps(1, end)` over a linear clock.
  Bursts whose colour is the message stay plain: a kill's red, a shield's
  cyan, an evolve's green, an arming's gold. The penalty desaturate on a
  sinking mote is meaning, so it applies to every skin. Tick pacing is
  untouched. A long trail is capped to arrive within 35% of the flight
  after the head, so Cortex's 7-packet spectacle train still lands inside
  the move.
- **`render/src/skinSheet.ts`** (new; `npm run skin-sheet -w
  @ai-tcg/render`) writes `render/output/skin-sheet.html`. It shows every
  primitive frozen mid-flight at spectacle tier, one row per faction,
  using the replay page's own CSS (`CSS` is now exported) and the same
  layout source. A replay shows one strike for a few hundred ms; the sheet
  is the place to compare the five side by side.

**Evidence.**
- `test/factionSkin.test.ts` (13 tests):
  - **The meaning invariant over every skin × tier × direction.** Every
    mote step moves the caller's way, monotonically, by a travel distance
    identical across skins. Every particle of every bolt (both sizes)
    starts on the attacker and lands on the target.
  - **The skins are really different.** A per-skin fingerprint covers
    count, size, lanes, drift, cloud, weave, steps, stretch and rays, and
    all five differ. Each named character is asserted where EFFECTS.md
    puts it.
  - **Other properties.** Every skin scales subtle ≤ normal ≤ spectacle,
    and subtle casts have no rays. Layouts are deterministic, with no
    random source. Neutral reproduces the pre-slice layout. The page and
    the sheet embed the source verbatim, and the page has shape rules for
    every skin on all six particle classes.
  - **Real matches.** Over two captured matches, every faction a replay
    names, including neutral-pool cards, has its own table row.
- `npm test`: engine 128, protocol 7, server 23, agents 17, render 127
  (was 114). `tsc --noEmit` is clean in all five workspaces.
- **Headless Chromium, play speed.** All six regenerated replays were
  autoplayed to the last move at normal (700ms) and fast (250ms), with a
  MutationObserver on the FX layer.
  - 12/12 runs had zero console errors.
  - 0 particles carried a skin from a faction not in that match, and 0 had
    a tint that disagreed with their skin.
  - The FX layer drained to 0 every time, and per-skin tallies were
    identical at both speeds.
  - In cortex-vs-null-seed5: 51 Cortex and 39 Null bolt particles, 11
    Cortex casts, and 2 plain (kill-red) bursts.
- **Screenshots** were inspected, not committed: mid-flight captures from
  live replays, plus the skin sheet. The Null mote count was cut from 1×
  to 0.5× after the first sheet showed 12 overlapping bars merging into
  one solid line at spectacle tier.
- All six replays were regenerated. The balance lane's session-25 card
  changes make some matches differ from session 8's:
  - aegis-vs-aegis-seed1: 122 moves
  - aegis-vs-cortex-seed6: 113
  - aegis-vs-null-seed3: 139
  - cortex-vs-null-seed5: 102
  - null-vs-swarm-seed2: 82
  - swarm-vs-aegis-seed8: 63

**Named honestly, not fixed:**
- **Only particles are skinned.** Card-level animations (enter, exit
  ghost, hit flash, evolve pulse, shatter) are the same for every faction.
  So are the aim line and the cast tag. The aim line and tag are meaning,
  and should stay that way. A Null unit glitching out on death, or an
  Aegis unit entering with a chrome sweep, would be the natural extension.
- **Skinned motes lost the arrow shape.** The direction of motion, the
  card's own rise or sink, the label, and the penalty desaturate still
  carry the meaning. A first-time viewer may miss that on a small mote,
  though. This is an owner taste call; see the checkpoint.
- **Null's stepped motion is the riskiest read.** At play speed it reads
  as glitch to me, but to a casual viewer it could read as the page
  stuttering.
- Still open from before:
  - an aura lifting reads as a penalty;
  - the full-board replacement ghost overlaps the newcomer;
  - effect damage has no travel (needs per-hit event pairing);
  - hand chips are matched by name.

**Next render-lane slice:** the five-slice EFFECTS.md order is done.
Recommended next is a legibility pass on the two known misreads:
- give an aura lifting the quiet "settle" rather than a penalty sink;
- add a short enter delay when a newcomer must take a just-emptied slot
  on a full board.

After that, skin the card-level animations (exit/enter per faction).

## 2026-10-03 — Session 10: EFFECTS.md v2 slice 1 (canvas FX + floor layers, sprite travel/impact)

**Why this slice.** Under the alternation rule, the most recently merged PR
was balance (#36, session 26), so this was a render session. The owner's
2026-10-03 entry says to implement EFFECTS.md v2 in build order, one slice
per turn, porting from `render/reference/effects-lab.html`. Slice 1 is the
canvas layers, the atlas tint cache, and attack travel + impact in sprite
materials. The 2026-10-04 entry (close Phase 5, instance IDs, persistence)
is game-lane work for the next session. No shared progress file or
engine/card/agent file was touched (RENDER.md guardrails 1 and 4).

**Built.**
- **`render/src/canvasFx.ts`** (new). It has two embedded halves, the same
  single-source rule as the other FX modules:
  - `CANVAS_FX_PURE_SOURCE`: the sprite map (48 cells), the faction kits
    (the lab's `K` block cut to travel + impact, in the EFFECTS.md colours
    with Aegis orange), the tint maths, the tier recipes, the flight ease
    and arc. Node evaluates it, so the tests run the page's own code.
  - `CANVAS_FX_RUNTIME_SOURCE`: the two fixed full-viewport canvases.
    `.fx-floor` sits under `#app`. `.fx-top` sits over the cards and the
    aim line, but under the floating numbers. It also has the atlas loader,
    the pre-tinted cache (warmed in 8 ms idle slices), the particle and
    projectile system, and a rAF loop that only runs while something is
    alive.
  - `CFX.travel` / `CFX.impact` / `CFX.clear`.
- **Replay page wiring** (`renderHtml.ts`):
  - A strike's travel and impact (and the counter's return bolt plus a
    small impact on the attacker) go to the canvas.
  - The v1 DOM bolt/burst is the fallback when the canvas or atlases are
    unavailable.
  - A jump clears anything still in flight.
  - The three atlases are embedded as data URIs, so the replay stays one
    offline file.
  - `--aegis` is now `#ff7d24`.
  - **The timeline is untouched:** the head arrives exactly at `strikeT`
    (clocked on `performance.now`, like `later()`), so consequences still
    land with the hit and the approved pacing is unchanged.
- **`render/src/fxSheet.ts`** + `npm run fx-sheet`. It writes
  `render/output/fx-sheet.html`: every faction × tier, plus a face hit,
  looping, drawn by the same runtime.
- **`render/test/canvasFx.test.ts`**, 14 tests:
  - the sprite map vs `assets/manifest.json`, and the embedded atlases
    byte-equal to the committed files;
  - every faction has its own kit and EFFECTS.md colour, and the page CSS
    agrees;
  - tint: black is transparent, alpha is the brightest channel, the hue is
    the faction's, alpha rises monotonically with brightness, and hot
    pixels get a white core;
  - every recipe number grows with the tier, and face hits are wider and
    flatter;
  - the flight ease is exact at 0 and 1 and monotonic, and the arc
    endpoints are exact;
  - the page embeds both halves verbatim, with the fallback wiring
    present.
- **EFFECTS.md:** slice 1 is marked built. There's a new "Canvas layers as
  built" section.

**A bug found in the reference lab, not copied.** The lab's
`layer: o.layer || 1` turns layer 0 into 1, so its "floor" decals draw on
the top canvas. My first port inherited it. The FX sheet showed scorch
marks painted over the cards, and a floor-only screenshot was empty. Fixed
with `!= null`. A floor mark under a 118×158 card would then be invisible,
so marks under a hit card are sized past the card's larger side
(`fxDecalCover`). The card now stands in its scorch, goo, rift, rune or
circuit trace. Settled debris shows through empty slots.

**Ran it.**
- All six replays regenerated, with the same move counts as session 9
  (122 / 113 / 139 / 102 / 82 / 63), since the engine is untouched.
- Headless Chromium, every replay:
  - stepped move by move (142 strikes found by the canvas, clearing
    between moves so each count is exact);
  - 3 strikes per replay captured at mid-flight, impact and after;
  - 12 s of autoplay at normal speed: **58–61 fps** on every replay, peak
    ~230 live particles, **0 page errors**.
- FX sheet (all five factions firing at once): peak ~1,260 particles, still
  60 fps.
- **Fallback:** a copy of a replay with the atlases stripped draws 0 canvas
  projectiles and falls back to the DOM bolts and bursts, with no errors.
- `npm test`: render 141 tests (was 127); all five workspaces green (316). `tsc --noEmit` clean in all five.

**Named honestly, not fixed:**
- **Only attack travel + impact moved to the canvas.** The following are
  still the v1 DOM primitives until slice 2:
  - spell/ability damage;
  - heal, buff/debuff motes;
  - the cast flourish;
  - the shield;
  - the death ghost and its red burst.
  Hit-stop, colour split, camera punch and the warping grid are also
  slice 2.
- **A face hit leaves no ground mark,** because the HUD panel is opaque.
  The flare and the squashed shockwave carry it. On a lethal blow the burst
  also sits over the player's name for ~half a second.
- **Each replay is ~300 KB bigger** (the embedded atlases), about 1.8 MB
  across the six committed replays on every regeneration. A shared
  relative file would avoid that, but it would break "one file, opens
  offline".
- **Rects are snapshotted at launch.** If a layout shift happened
  mid-flight, the head would land on the old spot (same as v1; fixed slots
  make this rare).
- **The fps figures are from headless Chromium on this container,** not a
  real GPU or a phone. The several-Mythic-wards frame-rate check in
  EFFECTS.md can't run until slice 6 exists.
- **No `prefers-reduced-motion` handling,** neither in v1 nor here.
- The very first impacts after load can tint a sprite synchronously (a few
  ms each) if they land before the idle prewarm finishes.

**Next render-lane slice:** EFFECTS.md v2 slice 2. That means the faction
material kits for every category: spell damage (laser / molten shells /
homing spores / blinking packets / light lances), removal, heal, buff and
debuff (Neutral's debuff = Swarm acid in gold). Plus magnitude polish:
hit-stop, colour split, camera punch, lingering debris, the warping grid.
Port from the lab's scene functions into `FX_KITS` rows and `CFX` methods,
then retire the matching v1 DOM paths behind the same fallback.

## 2026-10-04 — Session 11: EFFECTS.md v2 slice 2 (every category's faction material, kills, camera beats, warping grid)

Render session: the last merged PR (#38) was a game-lane slice. Owner feedback
first. The 2026-10-04 render entry approved the `signatureAbilities` list (all 9
plus Rate Limiter) and two ward rules. Both are done before the slice:
- the 10 entries are in `render/presentation/mythics.json` → `signatureAbilities`;
- "first fire only" and "the Mythic's own ward flares on arrival" are in
  EFFECTS.md's Wards section.

EFFECTS.md's Dependencies line saying the event log lacked instance ids was stale
(game session 27 added them), so it now says how slice 2 uses them.

**What I built.**
- **`render/src/effectFx.ts` (new).** `resolveEffects(prev, next)` pairs each
  ability effect with its exact source and target, using only the event log's
  ids, never names.
  - An ability's effects follow its `abilityTrigger` and carry its `sourceId`.
    Combat damage never follows one, so it's never read as a spell.
  - Categories: spell, heal, buff (+stats, Barrier), debuff (−stats, Stasis,
    Overload), removal. A removal is a targeted unit that died this move with no
    damage, or a destroyed Directive.
  - Sources: a unit (or where it stood, for onDeath) or a Command's stack entry.
    Same card on both ends = self, which plays in place.
  - Embedded verbatim in the page, same single-source rule as attackFx/castFx.
- **`render/src/canvasFx.ts`, slice 2.**
  - Every kit row now names its variant per category, per EFFECTS.md's table:
    - Cortex: laser / orbital / scan / cubes / throttle.
    - Aegis: shells / breach / weld / plates / crack.
    - Swarm: swarm / devour / bloom / tendrils / acid.
    - Null: blink / vortex / reverse / darkstar / bitrot.
    - Neutral: lances / smite / crosses / chevrons / acid (Swarm's acid, in gold).
  - `CFX.effect` draws them, ported from the lab's scenes, onto the replay's
    timeline.
  - `fxVolleySchedule` makes the last shot of a volley land exactly when the
    number shows, and nothing after it.
  - `CFX.kill` shatters every dead card into triangles (the lab's
    impactKill): the killer's and victim's debris, a crater and mark on the
    floor.
  - Spectacle kills get hit-stop (120 ms, particles only, the timeline keeps
    real time), the colour split and a strong camera punch. Normal kills get a
    small punch and shake. Big face hits get a short hit-stop and punch.
  - Warping background grid (the lab's spring grid), at the bottom of the floor
    canvas.
  - `prefers-reduced-motion` turns off every camera beat and the grid motion.
- **`renderHtml.ts`.**
  - Effects launch when the cast beat ends (or when the strike lands, on a
    strike move) and fly for a window carved out of the move (a removal ×1.45).
    What they cause waits for them.
  - On a strike move, only the cards an effect reaches wait.
  - The canvas buff/debuff stands the v1 motes down (the flash and the label
    stay). The canvas kill replaces the v1 red burst and hides the ghost as it
    shatters. Both fall back to v1 when the canvas can't draw.
- **FX sheet part 2** (`npm run fx-sheet`): all 5 factions × 5 categories,
  looping. The removal ends in a spectacle kill.
- **`src/effectSurvey.ts`** (`npm run effect-survey -w @ai-tcg/render -- <seeds>`):
  plays all 16 pairings and counts what the resolver finds.

**A frame-rate regression found and fixed before shipping.** The first build gave
the grid its own full-viewport canvas plus `will-change: transform` on `#app`.
Autoplay median fell to ~51 fps against 58–59 for the slice-1 page on the same
machine. Per-frame JS was only ~1 ms (new `stats().msPerFrame`), so the cost was
compositing. Reduced motion (no grid motion, no camera) was still 53. The fix:
- draw the grid on the floor canvas, which is redrawn every frame anyway;
- drop `will-change`.

After the fix: median 54 vs 55 for the slice-1 page back to back, which is noise.

**Ran it.**
- All six replays regenerated with the same move counts as sessions 9–10
  (122 / 113 / 139 / 102 / 82 / 63; engine untouched).
- Headless Chromium, every replay stepped move by move, every call counted:
  - 25 effects: all drawn, 21 with travel, 0 missing ends.
  - 17 kills: all drawn, kill counts equal to death + directiveDestroyed events.
  - 142 strikes; 0 page errors.
- Autoplay, 20 s each, one browser at a time: median 51–54 fps, minimum 33–36
  only at kill moments with ~800 particles alive.
- Reduced motion: every effect drawn, camera max 0, grid never animated.
- Atlases stripped: no canvas effects, the v1 paths run, 0 errors.
- Effect survey, 80 matches / 8,759 moves:
  - 559 effects: 184 spell, 137 debuff, 109 heal, 104 buff, 25 removal (4 of a
    unit, 21 of a Directive).
  - 0 unit ends missing from the boards.
  - Output: `progress/render/evidence/v2-s2-effect-survey.txt`.
- Tests: render 157 (was 141): `test/effectFx.test.ts` (9 tests) and 7 new in
  `canvasFx.test.ts`. All five workspaces green (339); `tsc --noEmit` clean in all
  five.

**Named honestly, not fixed:**
- **The committed replays show few effects** (25 across six matches; the
  Lookahead agent plays few Commands, and null-vs-swarm seed 2 has none, and no
  deaths). The FX sheet is the full view; the survey shows the categories are
  common across many matches.
- **Still v1 DOM:** the shield/Barrier block, the cast flourish, the armor
  deflect, the evolve and arrival pulses.
- **Ward rules are written down but not wired.** That's slice 5, plus slice 6
  for the Mythic arrival flare.
- **The camera punch moves `#app` for ~0.3 s.** A rect read during it (an
  overlapping move's launch) can be off by up to ~3% near the edges. Fixed slots
  and the short punch make it rare.
- **MAXP (1,800) is reached** when the sheet fires 25 effects at once. Never seen
  in a replay (peak ~800).
- **Every death now shatters,** including the quiet ones (Overload ticks, a 1/1
  traded off). Subtle-tier kills are small, but it's a taste call (checkpoint).
- **fps is headless Chromium on this container,** not a GPU or a phone. No sound
  yet (slice 3).

**Next render-lane slice:** EFFECTS.md v2 slice 3, procedural sound effects with
faction voices. Port the lab's `SFX`, `tone()`, `noise()` and the limiter/voice
cap; toggles off by default. Hook it to the same calls (`CFX.travel/impact/effect/
kill` and the v1 shield/cast).

---

## 2026-10-05 — Session 12: player hits land mid-board, Neutral white-gold, EFFECTS.md v2 slice 3 (procedural sound)

The last merged PR (#40, session 28) was the game lane, so this was a render
session. Three owner entries were open for the lane, applied in the order the
owner gave: player-targeted hits first, then slice 3. The Neutral colour
change (also 2026-10-05) went in with them.

**1. Hits aimed at a player land on the board, not the portrait** (owner
2026-10-05).
- `playerLandRect(pid)` in `renderHtml.ts`: the centre of that player's row of
  slots, as a card-sized box. With six fixed slots the centre is the gap
  between the third and fourth, so it never sits on a card.
- Attacks (`targetRect`), ability effects (`effectEndRect`), aim lines,
  REDIRECTED labels and fizzles all use it. `targetEl` is gone.
- `canvasFx.ts`: a player impact now leaves its ground mark on the floor
  there, as a card hit does. It keeps the wider, flatter shock.
- The HP bar reacts, timed to the impact (`reactHp`). The bar flashes by
  tier: subtle brightens, normal glows, spectacle glows bigger, jolts, and
  flashes the whole panel too. The number rises from the end of the fill,
  where the health is lost.
- EFFECTS.md Axis 1 and the "as built" notes are updated.
- **Bug found and fixed while verifying:** the first version measured only
  `.slot` children, but only empty slots carry that class. Impacts landed up
  to 252 px off-centre whenever cards stood in the row. It now measures every
  child of the row; the re-run shows 0 px.

**2. Neutral is white-gold `#fff0c2`** (owner 2026-10-05).
- Changed in the CSS variable (faction tags, frames, HUD tint, the momentum
  "even" colour), the canvas kit, EFFECTS.md and the FX sheet text.
- Neutral cards get darker name/stats strips (0.66 black) so the white text
  stays readable on the light frame.
- `mythic_ward.py` gained a Neutral theme for the Neutral unique Mythics
  (owner's AMENDMENT entry). The prompt stays monochrome; the render tints it.
- A test now reads EFFECTS.md's colour line and checks it against the kits
  and the CSS, so the three can't drift.

**3. EFFECTS.md v2 slice 3: procedural sound** (`render/src/soundFx.ts`).
- The lab's `SFX`, `tone()`, `noise()` and limiter are ported into the
  repo's single-source pattern. `sfxRecipe(kind, faction, tier, rand)`
  returns plain voice data; the `SND` runtime plays it with WebAudio.
- Eleven sounds: launch, impact, bolt, heal, buff, debuff, lock, beam, kill,
  block, cast. Each is fired from the page at the same `later()` moment as
  its visual.
- Five voices, as specced: Cortex square blips, Aegis inharmonic metal,
  Swarm high-Q chitters, Null broken pitch, Neutral bells. The tier scales
  gain (0.55 / 1 / 1.4).
- The mix: a limiter on the master bus, panning by screen position, a
  30-voice cap, and a 28 ms repeat gap per sound and voice, so a volley reads
  as one.
- Off by default: a "Sound: off" button in the replay controls makes the
  AudioContext on click.
- The FX sheet gained an audition grid (5 voices × 11 sounds, plus
  play-a-row / play-a-column and a tier picker).

**Ran it.**
- All six replays regenerated with the same move counts (122 / 113 / 139 /
  102 / 82 / 63). The engine is untouched.
- Headless Chromium, every replay stepped move by move (`face.mjs`):
  - 101 player impacts, 0 off the defender's row, 0 centred on a card, 0 px
    from the row centre;
  - the HP bar flashed on each;
  - 0 page errors.
- Headless Chromium with sound on (`snd.mjs`), the limiter's output tapped
  with an AnalyserNode:
  - the sheet played all 55 cells (11 kinds × 5 voices): 253 voices, peak
    0.43;
  - three full replays played 86 / 29 / 67 sounds: 411 / 175 / 226 voices,
    0 capped;
  - peak 0.62 / 0.54 / 0.62, so the limiter keeps it below clipping;
  - the AudioContext stayed running, with 0 errors;
  - before the click there was no AudioContext and nothing played.
- Stills in `progress/render/evidence/`:
  - `v2-s3-face-hit-normal-aegis-vs-null-seed3.png`;
  - `v2-s3-face-hit-spectacle-aegis-vs-cortex-seed6.png` (−6 by the HP bar,
    panel flash, impact mid-board);
  - `v2-s3-neutral-white-gold-aegis-vs-null-seed3.png` (Uplink Tower next to
    an Aegis card);
  - `v2-s3-sound-grid.png`.
- Tests: render 177 (was 157): `test/soundFx.test.ts` has 19, including the
  runtime against a recording fake AudioContext, and `canvasFx.test.ts` has 1
  new. All six workspaces are green (377). `tsc --noEmit` is clean in render.

**Named honestly, not fixed:**
- **A spectacle face hit is big enough to overlap the cards either side of
  the centre gap** (see the spectacle still). The HP bar reaction says whose
  hit it was, but a viewer might briefly read it as hitting the slot-3 card.
  An alternative is in the checkpoint.
- **Headless audio is measured, not heard.** The analyser proves signal and
  levels, not taste; the audition grid is there for the owner's ears.
- **No ward sounds yet** (slices 5-6) and **no music** (slice 4).
- **No mute on tab hide**, and no volume control for effects yet (the spec
  asks for one for music; slice 4 adds it).
- **FX sheet:** the looping canvas parts keep their screen positions from
  launch, so scrolling while they fly draws them in the wrong place (sheet
  only; not new).

**Next render-lane slice:** EFFECTS.md v2 slice 4, adaptive procedural music.
Port the lab's music block: A minor, 104 BPM, Am–F–C–G, scheduled ahead on the
audio clock, with intensity driven by hits, kills and Mythics. Effects dip it
to ~80% and it never drops out. Add its own toggle and a volume control, and
reuse `SND`'s context and limiter.

---

## 2026-10-07 — Session 13: owner's slice-3 answers (number at the impact, sound on by default, mute remembered, effects volume)

The last merged PR (#42, session 29) was the game lane, so this was a render
session. The owner's 2026-10-07 entry answered the 7 slice-3 calls: keep 1, 3,
4, 5 and 6; change 2 and 7. This session built the two changes and nothing
else. Music (slice 4) stays next.

**1. The damage number appears where the visual hit lands** (call 2).
- `reactHp(..., landR)` in `renderHtml.ts`: when a strike or an effect landed
  on that player this move, the number is placed on the impact point (the
  centre of their row, `prevLandRects[pid]`), the way a hit on a card places
  its number. The HP bar still flashes and drops as before; a spectacle hit
  still flashes the panel.
- A player health change with nothing landing on them (no strike or effect
  aimed at them this move) keeps the number at the end of the bar's fill,
  so a number never appears mid-board with no hit there.
- EFFECTS.md Axis 1 updated.

**2. Sound on by default, armed until the first gesture** (call 7).
- `soundFx.ts`: `SND.arm(pref)` at load (no `AudioContext`), `SND.unlock()`
  on the viewer's first pointer press or key press anywhere (Play counts,
  so does the space bar or an arrow key). `SND.state()` is `muted`, `armed`
  or `on`.
- `SND.mount(button, slider, store)` wires the control: "🔊 Sound on"
  (dashed border while armed), one click mutes ("🔇 Sound off", context
  suspended). A press on the mute button never starts sound first.
- **Effects volume** slider beside it (0-100, default 80): scales the
  master bus (0.6 × volume) ahead of the limiter. Disabled while muted.
- **Remembered:** `{ muted, volume }` through `sfxPrefParse` /
  `sfxPrefSerialize`, saved on each change. The standalone replay uses
  browser storage (`ai-tcg.sound`); the owner website will pass the
  account's Sound setting through the same `{ read, write }` store. Only an
  explicit mute is remembered as off; missing, junk or blocked storage means
  sound on (and a throwing storage is caught).
- **A hidden tab goes quiet** (context suspended on `visibilitychange`,
  resumed on return if sound was on). This was named debt in session 12.
- The FX sheet uses the same control.

**Ran it.**
- All six replays and the FX sheet regenerated; the match data is unchanged
  (same 161-line diff in each replay, code only). The engine is untouched.
- Headless Chromium, sound behaviour on `aegis-vs-null-seed3`
  (scratch `snd2.mjs`):
  1. fresh load: state `armed`, no AudioContext, button "🔊 Sound on";
  2. press Play: context `running`, sounds playing;
  3. one click on the indicator: `muted`, context `suspended`, stored
     `{"muted":true,"volume":0.8}`;
  4. reload: still muted, no context; 5. Play while muted: still no context;
  6. click again: `on`, context running; 7. slider to 30: volume 0.3 stored;
  8. reload: `armed` at volume 30; 9. first key press (ArrowRight) starts it;
  10. with storage blocked (localStorage throws): mute still works, 0 errors.
  0 page errors throughout.
- Headless Chromium, every replay stepped move by move (scratch `num.mjs`),
  each player health change matched to its floating number: 93 player
  health changes across the six replays (16 / 13 / 19 / 20 / 16 / 9), 93
  numbers within 4 px of the centre of that player's row (on the impact),
  0 at the HP bar, 0 elsewhere, 0 missing, 0 page errors. Every health
  change in these replays had a hit landing on the player, so the bar
  fallback (no hit landed) is covered by its code path and tests, not by a
  replay.
- Stills in `progress/render/evidence/`:
  - `v2-s3b-number-at-impact-spectacle-aegis-vs-cortex-seed6.png` (−6! on
    the impact mid-board, the HP bar and panel flashing, the sound control
    and slider at the bottom right);
  - `v2-s3b-number-at-impact-normal-aegis-vs-null-seed3.png` (−2 at the
    impact).
- Tests: render 187 (was 177): `soundFx.test.ts` +10 (the setting's parse /
  serialize / clamp; armed until a gesture; the mute-button press; the
  remembered mute; the volume scaling the master bus; browser storage
  round trip and a throwing storage; the hidden tab), `canvasFx.test.ts`
  checks the number goes to the impact. `tsc --noEmit` clean in render.

**Named honestly, not fixed:**
- **The account's Sound setting doesn't exist yet**: the owner website
  (build-order steps 3-4) will need to pass a store into `SND.mount`. The
  seam is there; the website side isn't.
- **The volume is measured as the master gain, not heard.** The analyser
  tap from session 12 wasn't re-run at different volumes.
- **A move where a player both takes a hit and pays a self-cost shows one
  net number at the impact** (the HP delta is per move, not per cause). Same
  as before, only the place moved.
- **The number sits at the top of the impact box**, like a card's. On a
  spectacle hit it can overlap the bottom edge of the opposing row's gap.
- Still no music (slice 4) and no ward sounds (slices 5-6).

**Next render-lane slice:** EFFECTS.md v2 slice 4, adaptive procedural music
(unchanged from session 12): port the lab's music block (A minor, 104 BPM,
Am–F–C–G, scheduled ahead on the audio clock, intensity driven by hits,
kills and Mythics; effects dip it to ~80%, never drop out). Give it its own
toggle and volume using the same armed / remembered pattern (`SND.mount`'s
store holds both), and reuse `SND`'s context and limiter.

---

## 2026-10-09 — Session 14: EFFECTS.md v2 slice 4, adaptive procedural music

The last merged PR (#45, game session 30) was the game lane, so this was a
render session. Owner feedback had nothing unhandled for this lane. Slice 4
(music) was the standing next step.

**Built:**
- `render/src/musicFx.ts`, ported from the lab's music block:
  - A minor, 104 BPM, Am–F–C–G, scheduled 0.12 s ahead on the audio clock;
  - the arrangement is plain data (`musStep`). Calm is a pad and bass. Rising
    intensity adds the kick, the arpeggio, a driving bass, hats, off-hats,
    then snare and four on the floor;
  - intensity bumps (hits by tier, kills, Mythic arrivals), relaxes back
    over ~6 s, and rests higher with a Mythic in play on the acting side;
  - the arpeggio is in the acting faction's voice; a Mythic on the acting
    side adds a bell motif every other bar.
- **No kill dropout:** the lab's `muDrop` is not ported. There is no filter
  on the music's output, and an effect dips it to 80% at the lowest, back
  within ~0.2 s, at most once per 60 ms.
- **Shared audio:** `SND` gained `core()` (the shared context, limiter and
  noise), `hold()` (the context runs while effects OR music is on and the
  tab is visible) and `listen()` (every `SND.play` reaches the music, played
  or not, so intensity follows the match with effects muted).
- **The control:** "♫ Music on", a music volume (default 60, the lab's
  mix) and an intensity meter. Same armed / one-click mute / remembered
  pattern as the effects, under `ai-tcg.music`.
  - Found while testing: a press on the effects mute started the music.
    Now a press inside any `data-audio-ctl` control only does what that
    control does.
- **Replay wiring:** every frame sets the scene (the acting faction, and
  whether that side has a Mythic unit or Directive in play). A Mythic
  entering bumps the music on its entrance beat.
- **The FX sheet's part 4,** a music desk: voice, Mythic in play, hit / big
  hit / kill / Mythic arrives, and a live layers readout.

**Ran it.**
- All six replays and the FX sheet regenerated (code only; the match data is
  unchanged, the same diff in each replay). The engine is untouched.
- Headless Chromium, every replay played to the end at fast speed (scratch
  `mus.mjs`), with an analyser on the shared limiter:
  - music was armed with no context before the first gesture, and Play
    started it;
  - **0% silent samples** in all six (the music never dropped out, kills
    included);
  - limiter peak 0.49-0.62, so no clipping;
  - every layer reached in five replays. null-vs-swarm-seed2, the quietest
    match, peaked at I = 2.48, so no snare;
  - the arpeggio voice followed the acting faction (both factions seen in
    each replay);
  - Mythic bells active in the four replays with a Mythic in play;
  - 0 page errors.
- Normal speed, the share of time at each intensity (bins 1-1.5 / 1.5-2 /
  2-2.5 / 2.5-3 / 3+):
  - aegis-vs-null-seed3: 25 / 24 / 28 / 19 / 5%;
  - null-vs-swarm-seed2: 61 / 39 / 0 / 0 / 0%.
  So it adapts rather than pinning. At fast speed it sits near the top,
  which is fair: more violence per second.
- Effects muted (scratch `mute.mjs`):
  - the press on the effects mute left the music armed, and Play started it;
  - 26 intensity bumps, 0 ducks;
  - the music volume (35) and its mute survive a reload, with no context
    made before a gesture.
- Frame rate on aegis-vs-null-seed3: median 58 fps with music on, 58-59
  with it off. No measurable cost.
- Stills in `progress/render/evidence/`:
  - `v2-s4-music-controls-aegis-vs-null-seed3.png` (effects muted, music on,
    the meter);
  - `v2-s4-music-desk-fx-sheet.png` (Null voice, Mythic in play, every
    layer).
- Tests: render 216 (was 187). The new `test/musicFx.test.ts` has 29: every
  pitched note is in A minor in every voice and intensity; layers enter in
  order and never leave as I rises; the faction voices differ; the bells;
  bumps, the cap, relaxing back, the Mythic rest; the runtime on the shared
  context with no filter on its output; the 16th-note schedule and stall
  recovery; the duck floor; the context held by either; the mount, mute,
  volume, storage and cross-control press; the page wiring.
  All 441 tests pass across six workspaces; `tsc --noEmit` is clean in
  render.

**Named honestly, not fixed:**
- **Measured, not heard.** The analyser proves signal, level and no
  dropout. Whether it sounds good is for the owner's ears (the desk).
- **Music keeps playing when the replay is paused or ends.** It settles
  back to calm; the viewer can mute it. A pause-aware fade is a small
  follow-up if wanted.
- **Intensity counts sound events, not stakes.** A lethal blow and a big
  mid-game hit of the same tier bump it equally. Momentum (who's winning)
  doesn't drive the music yet.
- **The website's Music setting doesn't exist yet**; the store seam is
  there.
- **Swarm and Null arpeggios use `Math.random`** on the page (as in the
  lab), so two plays of a replay aren't note-identical. The tests use a
  seeded rand.

**Next render-lane slice:** EFFECTS.md v2 slice 5, faction wards for
signature abilities, driven by `signatureAbilities` (the rising chord,
pulse and shatter ward sounds come with them; `MUS_BUMP` gains a ward pulse
at 0.3 as in the lab).


## 2026-10-11 — Session 15: Mythic wards behind the card (owner 2026-10-11), EFFECTS.md v2 slice 6, the arpeggio choice

The last merged PR (#47, game session 31) was the game lane, so this was a
render session. Owner feedback had two render items: **"Mythic wards sit
behind the card"** (2026-10-11, new) and the render half of 2026-10-10
(item 4: the arpeggio follows "acting player" or "whoever is ahead"; item 6's
website Music setting, menu music and widget belong to build-order steps
4-5). The 2026-10-11 signature-zone entry is game-lane. Not a hardening pass.

**Order call:** the v2 build order has slice 5 (faction wards for signature
abilities) before slice 6 (Mythic unique wards). The owner's new entry
changes slice 6's wards and asks to see the result at a checkpoint, and the
replays had no Mythic wards yet to change. So this session built slice 6
with the owner's rule from the start, and slice 5 is next.

**Built:**
- **The owner's rule, everywhere it lives:**
  - EFFECTS.md "Mythic unique wards" now says the ward sits behind the card:
    over it on arrival, then behind it for good, with live behaviour and
    flares behind too, and the shatter over the board.
  - The effects lab:
    - arrival holds on top for 2.6 s, then crossfades behind over 0.8 s;
    - at rest and when flaring, the ward is on the floor canvas with its
      outer layers brightened and enlarged;
    - the seat ring, the pressure ring, the larvae and the pointers moved to
      the floor;
    - its `layer || 1` bug is fixed (layer 0 now really is the floor).
  - The replays, below.
- **`render/src/wardFx.ts`** (slice 6):
  - The pure half: timing (`WARD_T`), the over/behind split (`wardLayering`),
    opacity and scale (`wardLook`), the mode machine, the geometry
    (`WARD_BEHIND`, `wardRadius`), seats, and which units get a ward
    (`wardsOnBoard`, from `mythics.json`, never names in code).
  - The runtime (`WARDS`) is a plug-in on the slice-1 canvases through a new
    `CFX.plug` / `CFX.kit` seam: floor drawing under the cards, top drawing
    over them, its own particles (wedges, larvae, pointers) and floor rings.
  - The four behaviours: Quorum Arbiter's seats (one per enemy unit), Prime
    Aegis's tethers, crests and pressure ring, Hive Mother's heartbeat and
    larvae, and Null Singularity's grid pull and spiralling pointers.
  - Arrival: the ward draws in over the card, with a grid pull, shockwave and
    sparks. Shatter: wedges cut from the ward's own sheet spin out over the
    board. `WARDS.pulse` (a flare behind the card) exists but nothing calls
    it yet: all four Mythics' abilities are statics, and signature-move
    detection comes with slice 5.
- **The replay page:**
  - every frame syncs the wards to the board;
  - stepping one move, a new Mythic's ward waits for the card's own
    entrance beat, and a dying one shatters at the kill (`unitT`, the same
    moment the card's ghost shatters);
  - a jump just places or removes wards;
  - only the sheets of Mythics that reach the board are embedded (about
    110-125 KB each).
- **The Mythic card is obsidian + foil** (EFFECTS.md's card treatment, the
  lab's look): near-black with a faint faction glow, a faction rim and
  header, and a slow light sweep. Before, it was a bright faction card like
  any other, and the ward behind it had nothing to contrast with.
- **Ward sounds:** `ward` (arrival: ticks, the rising faction chord, the
  thump, the deep swell), `wardPulse` and `wardBreak` (glass, then the chord
  falling). These are kinds 12-14 in `SFX_KINDS`, so the FX sheet's
  audition grid has them too.
- **The top canvas is left alone when nothing is over the cards** (`hasTop`).
  A resting ward keeps the loop running, so without this the top canvas was
  cleared and repainted every frame for nothing.
- **Owner 2026-10-10 item 4, the arpeggio choice:**
  - "arp: acting player / whoever is ahead" beside the music control;
  - remembered as `follow` in `ai-tcg.music`;
  - "ahead" follows the momentum leader, and falls back to the acting
    player when the match is even (`musSceneSide`);
  - the Mythic bells follow the same side.

**Ran it:**
- Three new replays, chosen by searching 72 seeded Lookahead games for
  Mythic arrivals and deaths. The six committed replays never play Quorum
  Arbiter or Null Singularity, and no Mythic dies in them.
  - `null-vs-cortex-seed4`: Quorum Arbiter, then Null Singularity.
  - `cortex-vs-swarm-seed11`: Quorum Arbiter, then Hive Mother; Quorum
    Arbiter dies at move 99.
  - `swarm-vs-null-seed8`: Hive Mother arrives at move 45 and dies at
    move 83.
  - All nine replays and the FX sheet were regenerated. The match data of
    the old six is unchanged; the engine is untouched.
- **Headless Chromium, stepping into each Mythic's arrival** (scratch
  `wardShots.mjs`): at 0.25 / 0.9 / 2.3 s after the step the ward is fully
  over the card. By 3.2 s it is fully behind, and it stays there. This held
  for all four Mythics.
  - Quorum Arbiter lit 4 seats with 4 enemy units, and 5 with 5, matching
    its printed ⚔5 / ⚔6.
  - Stepping into a Mythic's death shattered its ward 200 ms after the step
    (the kill beat) into 25 pieces, and the other Mythic's ward stayed.
  - 0 page errors.
- **Every replay played end to end at fast speed** (`playAll.mjs`), with 0
  page errors in all nine:
  - one arrival in each Prime Aegis replay and in `swarm-vs-aegis-seed8`;
  - two arrivals and one shatter in `cortex-vs-swarm-seed11`;
  - one arrival and one shatter in `swarm-vs-null-seed8`;
  - nothing at all in the two replays with no Mythic;
  - each Mythic still on the board at the end still has its ward, behind
    its card.
- **Frame rate** (headless, software-rendered, so a floor, not what a GPU
  browser will show):
  - one ward at normal speed: no measurable cost (52-56 fps with it, 54-56
    with wards off; 56-59 idle);
  - two wards (Quorum Arbiter + Null Singularity) on an idle board: 55-56
    fps, or 58-59 with Singularity's grid pull removed;
  - two wards during normal-speed play: 45-46 fps against 54-57 with wards
    off; at fast speed, about 34 against 43-47.
  - The wards' own JS is under 3 ms a frame. The rest is the browser
    repainting the floor canvas every frame while a ward lives.
- Stills in `progress/render/evidence/`:
  - `v2-s6-<mythic>-arrival-on-top.png` for hive, quorum, singularity and
    prime;
  - `v2-s6-hive-at-rest-behind.png`, `v2-s6-quorum-singularity-at-rest.png`
    and `v2-s6-prime-aegis-at-rest.png`;
  - `v2-s6-hive-death-shatter.png` and `v2-s6-quorum-death-shatter.png`;
  - the lab: `v2-s6-lab-{cortex,aegis}-{arrival-on-top,at-rest-behind}.png`;
  - `v2-s6-arp-follow-control.png`.
- Tests: render 239 (was 216).
  - The new `test/wardFx.test.ts` has 21 tests:
    - over-then-behind timing, never on top at rest or while flaring;
    - the flare and the heartbeat;
    - the geometry: the core is hidden inside the card, while the middle
      and outer reach past its corners, and are brighter and larger
      behind;
    - `mythics.json` coverage and its committed sheets;
    - which units get a ward;
    - only the needed sheets embedded, checked on a real captured match;
    - the page wiring and the ward sounds' rising and falling chords.
  - The music tests cover the arpeggio choice: default, "ahead", the even
    fallback, remembered across pages, and the page's select.
  - `tsc --noEmit` is clean in render.

**Named honestly, not fixed:**
- **Two wards cost frame rate while effects play** (above). Fixes to try if
  it shows on real hardware:
  - redraw the floor at a lower cadence while only wards are moving;
  - a cheaper grid hot path for Singularity's constant pull.
- **Behind the card, a ward is partly hidden by its neighbours,** not just
  its own card: on a full row, Hive Mother shows mostly above, below and in
  the gaps. That's what the owner's rule implies; the brightened and
  enlarged outer layers are my compensation, and a taste call.
- **No flare is wired** (`WARDS.pulse`), and **no fallback ward** (slice 7):
  a future Mythic without a sheet gets the obsidian card but no ward.
- **The signature card** (game session 31's zone) is a plain Unit, so it gets
  no ward and no obsidian look, by design. The "Mythic as signature card"
  stand-in would, but no committed replay uses it.
- The ward's behaviour particles use `Math.random`, so two plays of a replay
  differ slightly, like the Swarm/Null arpeggios.

**Next render-lane slice:** EFFECTS.md v2 slice 5, faction wards for the
ten signature abilities (`signatureAbilities`, first fire only). That brings
the signature-move detection, which can then call `WARDS.pulse` for a
Mythic's own signature move. Then slice 7, the fallback ward.
