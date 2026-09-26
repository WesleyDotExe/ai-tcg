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
