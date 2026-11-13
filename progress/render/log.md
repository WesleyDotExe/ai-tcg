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

## 2026-10-13 — Session 16: EFFECTS.md v2 slice 5, faction wards for signature abilities

The last merged PR (#49, game session 32) was the game lane, so this was a
render session. Owner feedback had no new render item: the two 2026-10-13
entries are game-lane (the signature menu and its fairness rules), and the
2026-10-12 entry accepted all six slice-6 calls. RENDER.md and EFFECTS.md
govern, and the v2 build order's next slice is 5.

**Built:**
- **`render/src/sigWardFx.ts`** (slice 5):
  - The pure half:
    - `signatureFires` reads the whole replay. It pairs each
      `abilityTrigger` from `signatureAbilities` with that move's
      `resolveEffects` by `sourceId`.
    - First fire only, per card instance and ability; a Command's stack id
      makes every copy cast its own first fire.
    - A fire that did nothing isn't counted.
    - `sigRole` reads the role from the effects: attack, defence, self or
      buff.
    - `signatureGuards` builds the guard timeline: each unit a signature
      defence shielded, frame by frame, while its Barrier stands.
    - `sigLook` / `sigNextMode` hold the look and the mode machine.
    - `sigLeadMs` is how long the ward leads its effect.
  - The runtime (`FWARDS`) is a second `CFX.plug` plug-in. It has:
    - the flare (open, fire, close);
    - the buff's mini copy;
    - guard copies that fly onto their unit, sink behind the card and rest
      there quietly;
    - the crack, with wedges cut from the tinted ring;
    - the sounds `ward`, `wardPulse` and `wardBreak`.
- **The page** (`renderHtml.ts`):
  - It embeds `#sigward-data`: the table, plus ring sheets only for factions
    whose ward plays.
  - Every frame syncs the guards.
  - In `runFx`, a signature move:
    - opens the ward over the source (`sigT0`: the move's start, or the
      strike's landing);
    - pushes the effects' start back by the lead;
    - fires the ward as they leave, and closes it after they land;
    - flies guards in at the landing;
    - counts as spectacle.
  - A guard whose Barrier went cracks at `unitT(id)`, the same beat as
    BLOCKED or the death.
  - The ward replaces that power's cast sigil, rays and cast sound; its tag
    stays.
  - A Mythic source with its own ward gets `WARDS.pulse` instead (none
    yet).
- **Two fixes found by looking at the stills:**
  - Resting guards were at Mythic-ward brightness. Four of them in a row
    read as a wall of rings, so the resting opacity is now 0.5 with no
    boost.
  - Lockdown Field's ward was sized from its stack entry (R 17 px).
    Wards are now sized from a board card at least.
- EFFECTS.md has "Slice 5 as built". The slice-6 note that nothing calls
  `WARDS.pulse` is updated.

**Ran it:**
- **Surveyed the 9 committed games plus 48 more seeded ones** (Cortex and
  Aegis against each other faction, seeds 1-8) for signature fires.
  - The nine committed replays cover 5 of the 10 abilities.
  - Three new replays cover the rest: `aegis-vs-cortex-seed1` (Rate
    Limiter, Latent Ward with 4 guards, all 4 cracked by Rate Limiter's
    next tick), `aegis-vs-cortex-seed3` (Dormant Exploit, Retaliation Node
    on a strike, Lockdown Field) and `cortex-vs-swarm-seed6` (Dormant
    Exploit and Rate Limiter on one move, then Overload Capacitor).
  - All twelve replays and the FX sheet were regenerated. The match data
    of the old nine is byte-identical; the engine is untouched.
- **Headless Chromium, stepping into each of the ten abilities' moves**
  (scratch `sigShots.mjs`):
  - the runtime's own state showed the flare over the card while drawing in
    and firing, and gone after the effect landed;
  - guards went wait → travel → perm behind the card;
  - Latent Ward's four guards cracked together at move 150 (32 wedges);
  - 0 page errors.
- **Every replay played end to end at fast speed** (`playAll.mjs`):
  - 0 page errors in all twelve;
  - the flare count per replay matched the detector exactly (0, 1, 2 or
    3);
  - Aegis Warden's guard is still standing at the end of
    `aegis-vs-aegis-seed1`, because its Barrier was never broken.
- **Stills:** ten `v2-s5-*.png` in `progress/render/evidence/`.
- **Tests:** render 257 (was 239).
  - The new `test/sigWardFx.test.ts` has 18 tests:
    - the table;
    - Neutral has no sheet;
    - first fire only (Rate Limiter's five ticks, Retaliation Node);
    - a fire with its effects stripped moves the ward to the next tick;
    - the role of every ability, on real captured matches;
    - Command vs unit sources;
    - only the needed sheets are embedded;
    - guards stand exactly while the Barrier stands (Latent Ward's four,
      Aegis Warden's own);
    - the look over time;
    - the page wiring.
  - `wardFx.test.ts`'s embed count grew by one (the Swarm ring for the Egg
    Sac's hatch).
  - `tsc --noEmit` is clean in render.

**Named honestly, not fixed:**
- No approved ability is a buff, so the mini copy has never been seen in a
  replay.
- No FX-sheet section for slice 5; every earlier slice has one.
- A busy move stays busy (move 58 of `cortex-vs-swarm-seed6`).
- The engine doesn't log a Rate Limiter tick whose condition fails, so the
  "a fire that did nothing doesn't count" rule is proven only on a doctored
  copy of a real match.
- Frame rate with guards wasn't measured separately. Four resting guards
  are four floor-canvas draws a frame, cheaper than one Mythic ward, but
  not measured.

**Next render-lane slice:** EFFECTS.md v2 slice 7, the fallback ward
generator (any Mythic without a sheet still gets a unique ward). A slice-5
section for the FX sheet could go with it.

## 2026-10-14 — Session 17: EFFECTS.md v2 slice 7, the fallback ward generator

The last merged PR (#51, game session 33) was the game lane, so this was a
render session. Owner feedback had no new render item: the 2026-10-14 entry
accepted all six slice-5 calls, and the 2026-10-15 entry (signature menu,
option A) is game-lane. RENDER.md and EFFECTS.md govern, and the v2 build
order's last open slice is 7.

**Built:**
- **`render/src/fallbackWard.ts`** (slice 7):
  - The pure half:
    - `fallbackWardPlan(name, faction)` makes every random choice up front
      (FNV-1a of `faction:name`, then mulberry32) and returns plain data.
    - `FW_KITS`: one material per faction, Neutral included (rune tablets,
      arc glyphs, a "runes" middle of notched broken rings). An unknown
      faction draws in the Neutral kit.
    - `fallbackWardLook` is the coarse look (patterns and counts) used to
      measure variety; `fallbackWardsNeeded` lists the Mythics in a replay
      with no sheet.
  - The runtime: `fallbackWardSheet(plan)` draws a 2×2 sheet in the
    Replicate layout, so `WARDS` handles it exactly like art.
- **`wardFx.ts`:**
  - `wardsOnBoard` lists every Mythic unit. One not in `mythics.json`, or
    with a behaviour the runtime doesn't know, is `generic`.
  - New `generic` behaviour: rotation plus a soft ring every 3.2 s.
  - `ensureSheet` / `prepare`: art if the page has it, else the fallback,
    drawn at load; wrapped in try/catch so a failed sheet means no ward,
    never a broken card. `stats()` reports which wards fell back and how
    long each took to draw.
- **The page:** embeds the generator before `WARDS` and calls
  `WARDS.prepare(...)`. The turn line got its own backing, because wards on
  top-row cards were drawing over the turn and phase text (found in the
  four-ward still).
- **Demo signature cards** (`demoSignatures.ts`, CLI `--signatures`):
  Consensus Lantern (Rally +0/+1, 3/6) and Tollgate Daemon (Tax, 3/6), both
  lines that pass the fairness test at 2,500 seeds. Built with the engine's
  own `buildSignatureCard`, read-only through `engineInternal.ts`.
- **FX sheet part 5:** a spinning gallery of 15 fallback wards (three per
  faction).
- EFFECTS.md: "Slice 7 as built", the fallback bullet, build order item 7.

**Ran it:**
- **Scanned 32 games with demo signature cards** (four pairings, seeds
  1-8). Picked:
  - `cortex-vs-aegis-sig-seed5.html`: both signature cards arrive (moves 44,
    47), both die and return to the zone (96, 103) and are played again
    (100, 116); Quorum Arbiter arrives with its art at move 78.
  - `cortex-vs-aegis-sig-seed2.html`: four Mythic wards on the board at
    once (Quorum Arbiter, Prime Aegis and both signature cards).
- **Headless Chromium, stepping into each arrival and death** (scratch
  `s7shots.mjs`): every arrival went manifest (on top) → perm (behind)
  within 4.9 s; both shatters fired at the death; counts arrived 5,
  shattered 2, generic pulses 17; sheets drawn in 3-9 ms; 0 page errors.
- **Played seed 2 end to end at normal speed** (`s7play.mjs`), fps by wards
  on the board (headless, software rendering, so lower than a real GPU):
  0 wards median 51, 1 → 46, 2 → 47, 3 → 42, 4 → 33 (min 25). 0 errors.
- **Variety:** 303 signature menu ids → 303 distinct plans, 299 distinct
  coarse looks. 300 names per faction → 294-299 distinct looks.
- **All 14 replays regenerated** (12 old + 2 new) plus the FX and skin
  sheets. The match data of the old twelve is byte-identical; the engine is
  untouched. (The skin sheet was stale since slice 6; regenerating it only
  added the Mythic CSS.)
- **Stills:** six `v2-s7-*.png` in `progress/render/evidence/`.
- **Tests:** render 272 (was 257). New `test/fallbackWard.test.ts` (14):
  determinism, the pinned hash, kits, sheet layout, variety on all 303 menu
  ids, all middle patterns used, the symbol rules over 2,000 names, which
  Mythics need a fallback, and a real signature-card replay (only the
  signature cards fall back; no extra image shipped; failures caught).
  `wardFx.test.ts`: the Unknown Mythic now gets a generic ward, and an
  unknown behaviour falls back to generic. `tsc --noEmit` clean.

**Named honestly, not fixed:**
- **Every fallback is a ring.** The plans vary (patterns, counts, glyphs),
  but the silhouette is always concentric circles, so two wards of the same
  faction read as siblings. The Replicate art is far more individual.
- **The signature zone isn't drawn.** A signature card that dies just
  leaves the board, and comes back from nowhere; the log says "returns to
  p1's signature zone (next play costs 7)", the board doesn't.
- **Four wards cost frames:** median 33 fps headless with four on the
  board, against 51 with none. Not measured on a real GPU.
- The demo names are mine; the real ones will come from the engine's agent
  generator, which isn't built yet.

**Next render-lane slice:** every EFFECTS.md v2 slice is now built. Next:
the signature zone on the board (a slot or chip per side showing the
signature card, its next cost, `signatureReturn` animating the card back
and `fromSignatureZone` plays leaving from it), then the owner's open
render items (website Music setting and menu music belong to build-order
steps 4-5).

## 2026-10-15 — Session 18: the signature zone on the board, generated agents in the replays

Render session by the alternation rule: the last merged PR (#53) was a game
slice. Owner feedback read first. The one render entry since session 17
(2026-10-15, slice 7 accepted, keep all 6 calls) needs nothing built; its
call 6 ("real names come from the agent generator") is acted on below
because the generator now exists. The three other 2026-10-15 entries are
game-lane work (pool, names, play styles) and are left for that lane.

**Built:**
- **`render/src/sigZoneFx.ts`** (single source, embedded in the page):
  - `signatureZoneMoves(prev, next)`: `leave` (played from the zone, with
    the arriving unit's id and the cost paid), `return` (died and went back,
    with the leaving unit's id and the next cost), `bounce` (played and
    back inside one move, never silently dropped).
  - `signatureZoneView(player, isActive, cap)`: waiting or out, next cost,
    the climb, plays so far, the collector number, and reach: `now` (own
    turn, pool covers it), `next` (the refill, max + 1 capped, covers it).
- **Capture:** `PlayerSnapshot.signature` (card, printed body, rules text,
  `nextCost` from the engine's own `signatureCost`, `timesPlayed`,
  `inZone`), `UnitSnapshot.isSignature`, `MatchReplay.energyCap`.
  `signatureCost` is read through `engineInternal.ts`.
- **The page:** a white-gold socket left of each row (outside the six
  slots). The waiting card at its next cost, or ON BOARD with its name;
  the cost pill, the climb in red, plays so far, the reach line; the socket
  glows when the card is in reach now. Below 1040 px it moves above the
  row and shrinks.
  - **Leave:** the card lifts out and arcs to its slot; the slot's entrance,
    the Mythic music cue and the ward's arrival wait for the landing.
  - **Return:** the socket stays empty through the shatter; 420 ms after
    the kill a card-shaped mote with two echoes arcs home and the socket
    flares as it fills.
- **Generated agents** (`render/src/generatedSignatures.ts`, replaces
  `demoSignatures.ts`): `--signatures` now runs the engine's own generator
  (first agent candidate, then first signature candidate, seat two with
  seat one taken). The generated agent's name is the username; cards are
  `sig-PR-001` / `sig-PR-002`.

**Ran it:**
- **Scanned 32 games** (four pairings, seeds 1-8) with generated agents.
  Every game played at least one signature card; only three had one die
  and return (Cortex-Aegis 5, Aegis-Swarm 5, Null-Cortex 2), and only
  Cortex-Aegis 5 replayed it. That one is the showcase:
  `cortex-vs-aegis-sig-seed5.html`, Wren Mk II (Last Courier) vs Tamsin of
  the Long Queue (Cinder Uplink). Plays at moves 44 and 47 (cost 5);
  Cinder Uplink dies to Quorum Arbiter at move 103 and returns at 7; it is
  played again at 117 for 7, and the zone then reads 9, +4, played ×2.
- **Headless Chromium:**
  - Every one of 130 frames: the zone's DOM agrees with the data (state,
    cost, card present or not). 0 page errors.
  - Stepped into moves 44, 103 and 117, and recorded each as video
    (1280×960, ffmpeg frame strips at 20 fps).
- **Found and fixed in the video:**
  - The return mote launched under the Mythic shatter and couldn't be
    seen: delayed it from 180 to 420 ms, made it a brighter card shape with
    two echoes, on a higher arc.
  - The waiting card flashed for ~160 ms before the socket emptied (an
    opacity transition set off by runFx's layout reads): removed the
    transition.
- **All 14 replays regenerated** plus the FX and skin sheets. The twelve
  without signature cards: match data identical apart from the new fields
  (`signature: null`, `energyCap`). The two with signature cards are new
  matches, because the cards are new.
- **Tests:** render 290 (was 272). New `test/sigZone.test.ts` (18): every
  movement and reach state on hand-built frames; the engine-event oracle on
  five real matches (11 plays from the zone, 3 returns, all matched); the
  cost shown is the cost the engine charges at the next play; the
  showcase's exact cycle; generated seats over 40 seeds; the page embeds
  the module. `fallbackWard.test.ts` moved to the generated cards; two
  string pins moved from `causeT` to `enterT`. `npm test` 583 across six
  workspaces; `tsc --noEmit` clean in all six.
- **Stills:** six `v2-s8-*.png` in `progress/render/evidence/`.

**Named honestly, not fixed:**
- **"In reach now" is almost never seen.** The reference agents play the
  signature card the moment they can afford it, so the glow lasts 3 moves
  or fewer in 25 of the 32 scanned games (the longest: 22). Against real
  agents that hold it back it would matter more.
- **The return mote competes with the Mythic shatter.** The card usually
  dies next to its own zone, so the flight is short (about 200 px) and the
  shatter is still bright. It reads in the video strip, not as clearly as
  the leave flight.
- **`cortex-vs-aegis-sig-seed2.html` no longer shows four wards at once.**
  It now has one signature card played; session 17's four-ward frame-rate
  measurement belongs to the old cards.
- Units on the board still show a 0 in the cost circle (pre-existing).
- Below about 900 px the page still overflows sideways (pre-existing); the
  zone itself fits.

**Next render-lane slice:** the owner's open render items (the website
Music setting and menu music belong to build-order steps 4-5), or, if the
game lane's template names land first, regenerate the two signature
replays so the cards carry them.

## 2026-10-15 — Session 19: hardening pass (cost circle, narrow screens, generated names in the sheets)

Render session by the alternation rule: the last merged PR (#55) was a game
slice. Owner feedback read first. The only render entry since session 18
(2026-10-15, signature zone accepted, keep all 6 calls) needs nothing
built. The other new entries are game-lane work. The game lane's template
names have landed (session 35), so the two signature replays are
regenerated with them, as session 18 said they would be.

**Why a hardening pass.** Eighteen render sessions, none of them a
hardening pass, and every v2 slice is built. The next feature work (the
website Music setting, menu music) belongs to build-order steps 4-5. So
this session adds no new feature. It fixes three defects session 18 named
or that I found looking, and starts a render-lane debt list
(`progress/render/quality-debt.md`), which this lane didn't have.

**Fixed:**
- **The cost circle on board cards always showed 0.** The page had no cost
  to give units and Directives on the board. `UnitSnapshot.printedCost` and
  `DirectiveSnapshot.printedCost` (the card's printed cost) now fill it. A
  signature unit shows its printed cost; its replay surcharge stays in the
  zone, where the climb is explained.
- **The Guard / Barrier / status badges sat on top of the cost circle.**
  Found by zooming into a still once the circle had a real number. They now
  sit under the card head (`top: 22px`).
- **The page scrolled sideways below about 900 px.** Measured first: the
  showcase was 841 px wide at every width from 360 to 768, because a plain
  `1fr` HUD column won't shrink below its content. Now:
  - below 900 px the HUD columns are `minmax(0, 1fr)`, the momentum gauge
    drops under the two players, the match bar and audio controls wrap, and
    the scrubber shrinks;
  - below 560 px the HUDs stack in one column and the event log drops under
    the two hands.
- **The FX sheet's Neutral ward gallery used the old placeholder names**
  (Consensus Lantern, Tollgate Daemon). It now shows three of the generated
  cards the committed replays carry (`galleryNeutralNames()`).

**Ran it:**
- **Regenerated all 14 replays and both sheets.** Before the code changes,
  only the two signature replays changed: new names and new combinations
  from the generator. The match beats are the same moves: seed 5 still
  plays both cards at 44 and 47, and Tamsin of the Long Queue's card, now
  Wireburner's Anthem, dies at 103, returns at 7 and is played again at
  117. Wren Mk II's card is now Proxyviper's Twilight Download. Seed 2 is
  Vesper Zero (Unpatched Encore) vs Zephan of the Long Queue (Data Heist of
  the Recycle Bin).
- **Overflow check in headless Chromium**
  (`progress/render/evidence/narrow-overflow-check.txt`, script alongside):
  all 14 replays, every 3rd move, at 360, 390, 600, 768, 900 and 1280 px.
  84 of 84 runs: 0 px of sideways overflow and 0 page errors.
- **Stills:** `v2-s19-narrow-sig-seed5-390.png` and `-768.png` (move 90),
  `v2-s19-cost-circle-and-guard-badge.png` (the signature unit with its 5
  and its Guard badge apart).
- **Tests:** render 295 (was 290). New `test/boardCost.test.ts` (5):
  - an oracle over four real matches: every unit and Directive on every
    frame carries the engine registry's cost, or the generated card's for
    a signature unit;
  - a replayed signature unit still shows its printed cost;
  - the page passes the cost through, with no literal 0;
  - the narrow-screen rules are pinned;
  - the gallery uses the generated names.
  `npm test`: 599 across six workspaces, all pass. `tsc --noEmit` clean in
  all six.

**Named honestly, not fixed** (all in the new debt list):
- The overflow check runs from a scratch folder, not in CI. The tests only
  pin the CSS rules.
- At 768 px the six slots wrap 5 + 1, so a row stops reading as a row on a
  tablet. The slots don't scale down.
- The FX and skin sheets are still fixed at 1196 px. They're developer
  audition grids, not spectator pages.
- The cost circle is the printed cost. A board cost modifier, or the 7 a
  replayed signature card paid, isn't shown on the card.

**Next render-lane slice:** the top of `progress/render/quality-debt.md`.
Scaling the slots so a row of six fits from 600 px up is the most visible
item.

## 2026-10-16 — Session 20: six slots in one line from 600 px up (render debt, item 1)

Render session by the alternation rule: the last merged PR (#57) was a game
slice. Owner feedback read first. There is no new render entry since
session 19. The 2026-10-16 entries are game-lane work: agent naming, pack
opening, Zero-Day, top-tier cards, guardrails and the chase cards. Two of
them will reach this lane later: the animated Zero-Day cards and the Glitch
variant's look. Both wait for the game lane's checkpoint on their rules.

**Why this slice.** Session 19 named the next render slice: the top of
`progress/render/quality-debt.md`, where the six slots wrap from about
780 px down. That's existing work below bar (a row stops reading as one
side's line), so it comes before any new width.

**Built:**
- **`render/src/boardFit.ts`.** `boardFit(avail, slots, gap)` picks the
  row's layout. It uses one line, zoomed to fit, while the cards stay at
  least 72% of their size (85 px). Below that it uses two lines of three,
  zoomed only if three don't fit. It never scales up. The source is
  embedded in the page (the single-source pattern).
- **The page.** `fitBoards()` runs at load and on every resize. It sets
  each row's CSS `zoom`, and for two lines a max width, the `two-line`
  class and the side's faction class. The two-line row has a faint frame in
  the faction colour.
- **The ghost.** A dying card's ghost is copied into the fixed overlay. On a
  zoomed row it was squeezed: 118 px of layout in a smaller box.
  `ghostPlacement(rect)` now gives it the row's zoom and divides its
  position by it.
- **Every other effect already aims at the cards' on-screen rects**, so
  hits, wards, aim lines and the signature flight follow the zoom unchanged.

**Two bugs found by measuring:**
- **2 + 2 + 2 at 390 px.** The first version left the two-line frame (14
  px) out of the zoom, so the third card wrapped. The frame is now part of
  the sum.
- **2 + 2 + 2 at 360 px.** Zoomed exactly to fit, the row was still a
  pixel short, because a zoomed 1 px border stays 1 device pixel. The
  module now leaves 4 px of slack.

**Ran it:**
- **Regenerated all 14 replays and both sheets.** The two signature replays
  pick up session 36's agent and card names, for example Proxymonk's Ace vs
  Codejinx's Clone at seed 5, and Hexking's Oracle vs Codesmith's Autopilot
  at seed 2. The cards' abilities and the match moves are the same as
  before (seed 2: 92 moves, p1 wins).
- **Board-fit check in headless Chromium**
  (`progress/render/evidence/board-fit-check.txt`, script alongside). It
  covers all 14 replays at 11 widths from 360 to 1280 px, every 4th move.
  All 154 runs passed: one line from 560 px up and two from 540 px down,
  0 px of sideways overflow, no overlap between the sides, no card outside
  its row, and 0 page errors.
- **Ghost check:** at 600, 390 and 1280 px the ghost of the first death
  (move 32) sits 0.0 px off the dead card, and its name strip keeps the
  same share of its width.
- **Stills:** `v2-s20-board-fit-390.png`, `-600.png`, `-768.png`, and
  `v2-s20-ghost-zoomed-600.png`.
- **Tests:** render 303 (was 295), from the new `test/boardFit.test.ts`
  (8). It covers the fit at real widths, the switch point, odd inputs, the
  ghost's placement, and the page's wiring. `npm test`: 630 across six
  workspaces, all pass. `tsc --noEmit` is clean in all six.

**A bug found by measuring:** the first version looked up rules text by
ability id alone. Over 300 generated agents, 66 signature abilities share
an id with a different text ("sig-recycle" is "Draw 2 cards." on one card
and "Draw 3 cards." on another), so a match with two such cards could show
the wrong number. The lookup is now keyed by card name and ability id
(`abilityKey`). The two committed signature replays read the same either
way.

**Named honestly** (in the debt list):
- From 545 to 600 px the cards are 85-91 px wide, and the name text is
  about 7.5 px.
- Floating numbers and trigger labels don't scale with the row.
- The fit relies on CSS `zoom`.
- The browser checks still run from a scratch folder, not in CI.

**Checkpoint:** a small layout check-in in `progress/render/checkpoints.md`
(the 85-px floor, 3 + 3 on phones, the faction-tinted frame).

**Next render-lane slice:** the event log. It shows raw engine text,
priority passes and p1 / p2. Filter the passes and use the agents' names
until commentary (stage 7) replaces it.

## 2026-10-17 — Session 21: the match feed replaces the raw event log (render debt)

Render session by the alternation rule: the last merged PR (#59) was a game
slice. Owner feedback read first. The one new render entry (2026-10-17,
board fit accepted, all 4 calls kept) needs no work. The 2026-10-17 answers
to session 37 are game-lane work (the first rename free, typed names may
repeat words, build order A) and are left for the next game session.

**Why this slice.** Session 20 named it: the event log was the most visible
item on `progress/render/quality-debt.md`. It printed the engine's own
`formatEvent` text: a third of its lines were "p1 passes priority", turns
ended in "[end of turn 13 for p1]", players were p1 / p2, triggers showed
internal ability ids ("diagnostic-loop-turnend (onTurnEnd)"), and every
attack took two lines. That's a debugging view, not something a spectator
reads.

**Built:**
- **`render/src/feed.ts`.** `buildFeed(frames, ctx)` turns each frame's
  structured events (never the prose) into feed entries, at capture time:
  - priority passes and turn ends are dropped;
  - each turn opens with a header naming the agent, and the turn's draw
    sits in the header (the engine logs it just before the turn starts);
  - an attack is one entry with its damage nested under it. Its resolution
    only gets its own line ("X's attack lands") when something happened in
    between, which is a response;
  - a cast into a waiting stack, or on the other player's turn, is tagged
    RESPONSE;
  - triggers read "Card · end of turn", with the card's own rules text
    under them (`abilityTextFor`: every set card, both decks and both
    signature cards). A Command's resolve line and its on-entry trigger are
    one entry; so are an arming unit and its arming effect;
  - an attacker's on-attack trigger is logged by the engine before the
    attack; `attackFirst` puts the attack first;
  - players are carried as player parts, and seats inside engine reason
    text ("p2 health depleted") become player parts too (`withPlayers`).
- **The page.** The log pane is now the MATCH FEED: a turn header band in
  the player's faction colour with their avatar, a faction-coloured left
  rule per entry, card names tinted by faction, players in bold in theirs,
  results indented, rules text in small type. An "engine log" switch in the
  pane's header shows the raw lines again; the choice is remembered per
  viewer (localStorage, wrapped in try/catch).
- **Names everywhere else on the page:** the turn bar (active, priority,
  winner), the stack panel, the momentum gauge's "... AHEAD" and its
  reasons (`momentum.ts` now uses the snapshot's name), and the hand labels.

**Ran it:**
- **Regenerated all 14 replays and both sheets.** The matches are the same
  moves (seed 2 signature: 92 moves, p1 wins; seed 5: 129 moves). The
  signature replays carry session 37's agent names (Cyberburner's Antihero
  vs Rombot's Navigator at seed 5).
- **Length:** across the 14 replays the engine log is 3,321 lines and the
  feed 1,547 entries (47%).
- **Transcripts:** `progress/render/evidence/v2-s21-feed-sig-seed5.txt` and
  `v2-s21-feed-aegis-cortex-seed1.txt`, the whole feed of two replays as
  plain text. Seed 1 has two responses: Hotfix on an attacking Init
  Daemon (move 9) and Force Quit on Tariff Field mid-attack (move 88).
  Intercept Routine pulling an attack onto a Bulwark Chassis is in the
  Aegis vs Cortex seed 6 replay.
- **Browser check** (`progress/render/evidence/feed-check.txt`, script
  alongside): all 14 replays at 1280 and 390 px, every 5th move and the
  last. All 28 runs passed: the feed shows exactly the replay's entries up
  to that move, no seat name or priority pass in the feed, turn bar or
  gauge, the engine-log switch shows one line per engine event and
  switches back, 0 px sideways overflow, 0 page errors.
- **Board fit re-run** on the seed-5 replay at 11 widths: unchanged, all ok.
- **Stills:** `v2-s21-page-1280.png`, `v2-s21-feed-1280.png`,
  `v2-s21-feed-390.png` (move 13 of Aegis vs Cortex seed 1: the Hotfix
  response, its resolve and the attack landing), `v2-s21-raw-1280.png`
  (the same move with the engine-log switch on).
- **Tests:** render 314 (was 303). New `test/feed.test.ts` (11):
  - oracles over seven real matches: every play, cast, attack, damage,
    death, draw, trigger, turn and game end has its entry;
  - no priority passes, no seat names, no ability ids; every triggered
    ability has rules text;
  - a cast into a waiting stack is always tagged RESPONSE;
  - attacks fold unless answered, and every answered attack gets its own
    line;
  - the feed is under 60% of the raw log;
  - rules text comes from the triggering card even when another card
    shares its ability id (the bug below);
  - `withPlayers`, `attackFirst`, and the page's wiring.
  A mutation check (passes left in, the RESPONSE tag removed) fails 3 of
  them. `npm test`: 652 across six workspaces, all pass. `tsc --noEmit` is
  clean in all six.

**A bug found by measuring:** the first version looked up rules text by
ability id alone. Over 300 generated agents, 66 signature abilities share
an id with a different text ("sig-recycle" is "Draw 2 cards." on one card
and "Draw 3 cards." on another), so a match with two such cards could show
the wrong number. The lookup is now keyed by card name and ability id
(`abilityKey`). The two committed signature replays read the same either
way.

**Named honestly** (in the debt list):
- Triggers that change nothing still get a line, e.g. "Diagnostic Loop ·
  end of turn" healing an unhurt unit (5 times in the seed-5 game).
- Engine reason text is used as is: "Rombot's Navigator health depleted"
  lacks its "'s".
- The feed says what happened, not why it mattered. That is commentary
  (stage 7).
- In a mirror match, a trigger whose event has no instance id can lose its
  side colour (the name is on both boards).

**Checkpoint:** a small feed check-in in `progress/render/checkpoints.md`.

**Next render-lane slice:** the next item on the debt list. The empty
trigger lines are the cheapest legibility win (needs only the next frame's
board to tell "did anything change"); the zoomed-row floating labels are
the most visible.

## 2026-10-18 — Session 22: the match feed, tightened (quiet triggers, endings from the engine's cause, id-only rules text)

Render session by the alternation rule: the last merged PR (#61) was a game
slice. Owner feedback read first:
- The 2026-10-18 answers to render session 21 keep all 5 feed calls, and
  leave dropping trigger lines that change nothing as the next step.
- The game lane's side task (#61) landed unique signature ability ids and
  a structured `cause` on game over and attack fizzles. Render can use
  both now.
- The 2026-10-18 answers to session 38 (chase cards) are game-lane work.
  They're left for the next game session.

**Built:**
- **Quiet triggers dropped** (`feed.ts triggerChangedNothing`). The engine
  logs an ability's results straight after its abilityTrigger, so a trigger
  with no result event after it changed nothing. A fizzle counts as news.
  - **Bug found by measuring:** after an end-of-turn trigger, the engine
    logs the next turn's draw, straight before that turn's turnStart. The
    first version took that draw for the trigger's result and kept every
    Diagnostic Loop line. Now a draw or fatigue followed by its player's
    turnStart isn't the trigger's.
- **Game over from `cause`:**
  - "X wins: Y's health reached 0";
  - "Draw: both players' health reached 0 at once";
  - "X wins at the turn cap, 14 health to 9";
  - "Draw at the turn cap, both on N health";
  - logs with no cause fall back to the old wording.
- **Attack fizzles from `cause`:** "X's attack fizzles: its target left play
  first". This line replaces the "lands" line or the "deals no damage"
  line instead of adding to them.
- **Rules text by ability id alone.** `abilityKey` is gone. `abilityTextFor`
  throws if one id has two texts, so a regression can't show one card's
  text on another.
- **`replaySetup.ts`:** cli.ts's match setup, shared with the new
  `feedTranscript.ts` (`npm run feed-transcript`). The transcripts always
  show the same matches as the replays.

**Ran it:**
- Regenerated all 14 replays and both sheets. Same matches as session 21:
  seed 5 is 129 moves and p1 wins; seed 2 is 92 moves.
- Wrote `v2-s22-feed-summary.txt` and the two full feeds.
- 50 quiet triggers were dropped over the 14 replays:
  - Diagnostic Loop ×16, Watchtower Relay ×16 and Uplink Tower ×13;
  - Deadlock Detector, Broodcaller and others make up the rest.
- 3,321 engine lines → 1,497 feed entries (45%; it was 47%).
- No committed replay has a fizzle. A scan of every pairing over seeds 1-12
  found 8. Three are shown in the summary, nested and on their own line.
- Browser check (`feed-check.txt`): 14 replays at 1280 and 390 px, all
  pass.
- Stills: `v2-s22-feed-quiet-1280.png` and `v2-s22-feed-end-1280.png`.
- **Tests:** render 321 (was 314):
  - **`feedQuiet.test.ts`.** It wraps the engine's own `resolveAbility` with
    `vi.mock` (test only; no engine file changes). It snapshots the whole
    state around every trigger in 32 real matches (every pairing, half with
    signature cards). It checks that no trigger the feed drops, judged on
    the frame's full event list, changed the state. In those matches, 208
    triggers were wrapped, and over 90% of the kept ones changed the state.
  - **`feed.test.ts`.** No trigger line in the feed has nothing under it;
    this test fails on the draw bug above. It also covers
    `triggerChangedNothing`, fizzle and ending wording, the id clash
    refusal, and the id-not-name lookup.
  - **Mutation checks:**
    - with the drop turned off, 1 test fails;
    - with the cause wording turned off, 2 fail;
    - with fizzle replacement turned off, 1 fails;
    - with the draw rule turned off, 2 fail.
- `npm test`: 676 across six workspaces, all pass. `tsc --noEmit` is clean
  in all six.

**Named honestly** (in the debt list):
- The board's cast flourish still fires for quiet triggers.
- The Intercept Routine fizzle has no structured cause (asked of the game
  lane).
- The soundness test doesn't see onDeath triggers fired inside the
  resolver's own death pass.
- The turn-cap ending is only seen in tests.

**Checkpoint:** a small one in `progress/render/checkpoints.md` with 3
calls.

**Next render-lane slice:** make the board agree with the feed. Either the
cast flourish skips quiet triggers, or it gets a dimmer "nothing happened"
version. Then the zoomed-row floating labels.

---

## 2026-10-17 — Session 23: the board agrees with the feed; the redirect fizzle worded; labels shrink with a zoomed row

Render session by the alternation rule: the last merged PR (#63) was a game
slice. Owner feedback read first:
- The 2026-10-18 answers to render session 22 keep all 3 calls.
- The game lane's side task (#63) gave the Intercept Routine fizzles a
  `cause` (`alreadyAimed` / `noPendingAttack`) and their names. Render can
  word them now.
- The Zero-Day designs, the "Zero-Day" word in generated names and the
  session-39 answers are game-lane work, left for the next game session.

**Built:**
- **The board skips the flourish of a trigger the feed dropped.**
  `feed.ts buildFeedWithQuiet` returns, per frame, the indices into
  `newEvents` of the triggers it dropped as quiet; `capture.ts` stores them
  as `Frame.quietTriggers`; `castFx.ts resolveCasts` skips those events.
  They still count in the turn-trigger pairing, so the copies that did fire
  stay on the right card. One rule, decided once in Node, read by both.
- **The redirect fizzle is worded from its cause.** It takes the place of
  the Command's "resolves" line (its rules text stays under it), as an
  attack's fizzle takes the place of "lands"; on its own it is a result
  line. A target that is a player is named as the player.
- **Labels shrink with a zoomed row.** `boardFit.ts labelScale(rect)` is
  the card's on-screen width over 118 px, never above 1 (the same measure
  as the ghost), snapped to the nearest board row's zoom. `spawnNumber` takes an `onCard` flag and sets the CSS
  `scale` (origin top centre), with the offset scaled too; the float
  distance scales with it because `scale` applies before the animation's
  transform. The cast tag on a card does the same, including the step
  between stacked tags.

**Ran it:**
- All 14 replays and both sheets regenerated.
- `npm run feed-transcript -w @ai-tcg/render`: only the Null vs Aegis seed 3
  fizzle line changed; the two full feeds are identical to session 22's
  apart from the header. The 50 dropped triggers (by `quietTriggers`) are
  the same 50 session 22 counted.
- Browser check (`progress/render/evidence/board-feed-check.mjs`):
  4 replays (aegis-vs-cortex seed 1, the seed-5 signature replay,
  swarm-vs-null seed 8, and null-vs-aegis seed 3 for the fizzle) at 1280
  and 580 px, all 8 runs pass (`board-feed-check.txt`). Every move's cast
  tags equal the feed's count (38 tags, 14 quiet triggers with none); at
  580 px 137 labels over cards carry the row's 0.737 zoom, and 67 over
  players or the stack stay full size; at 1280 px nothing is scaled.
- Stills: the fizzle line at 1280 px; a hit at 580 px, its number at the
  row's 0.737 scale (an 87 px card).

**Bug found by the browser check:** the first version measured the card's
rect alone. An ON HIT tag spawns while the card's hit flash scales it up a
little, so three tags came out at 0.772 on a 0.737 row. The scale now snaps
to the row's own zoom (a test pins the seen case).

**Tests:** render 327 (+5): the quiet list by index; the redirect fizzle on
its resolve line, on its own line, and aimed at a player; `labelScale`; the
page's call sites; the snap. The real-match cast test (48 matches against the
engine's resolver) now expects no flourish for quiet triggers and, with the
list removed, every trigger back on the right card. Mutation: removing the
skip fails it.

**Named honestly** (in the debt list): `onCard` is a flag each call site
must remember; a replay captured before this session has no quiet list.

**Checkpoint:** a small one in `progress/render/checkpoints.md` with 3
calls.

**Next render-lane slice:** a replay that reaches the turn cap (the ending
is only seen in tests), or the momentum gauge naming a pending threat (an
armed telegraph, a stack item). The chase finishes need a pack-opening
surface first.

---

## 2026-10-17 — Session 24: pack opening, slice 1 (one pack and every finish reveal)

Render session by the alternation rule: the last merged PR (#65) was a game
slice. Owner feedback read first:
- 2026-10-18: render session 23's 3 calls kept; **the pack-opening reveal
  is the render lane's next priority**, ahead of the debt list, in three
  slices with a checkpoint after each. This is slice 1.
- 2026-10-18 (answers to game session 40): a render side task, the chosen
  mode in the match feed. Done alongside.
- The rest (the Zero-Day cap, the measuring agent) is game-lane work.

**Built:**
- `render/src/packOpening.ts`: a real `PackOpening` (economy store) becomes
  a `PackReveal`: the cards in reveal order (slots as rolled, the shine slot
  5th, a bonus card 6th), each with its printed face (`cardFaceOf`, from the
  engine registry; a Zero-Day pull shows its reserved entry), its reveal
  kind, `faceDown` (every finish but Standard) and `hit`; `sparks` = any
  hit. The proposed timings live here.
- `render/src/packFx.ts`: five WebGL fragment shaders (foil, gold, glitch,
  zeroDay, the pack's shimmer) and a small player (`FXGL.layer`) that lays a
  canvas over an element, follows the light (pointer or device tilt), fades
  by one number, and says when it can't run, so the page adds a CSS
  stand-in.
- `render/src/packPage.ts`: the self-contained page: the shelf and picker,
  the sealed pack (drag-tear along the top, tap, Enter/Space), the sparks,
  the Jackpot banner, the stack (tap/swipe, face-down glow, early taps
  ignored), the eight finish reveals, the Zero-Day takeover, the summary,
  and the placeholder art generator (`packArtSvg`: faction palette, seeded
  circuit traces, the pattern axis, a motif by type; an Alt Art composition;
  a painted-scene composition for the secret illustrations).
- `render/src/packDemo.ts` (`npm run pack-opening -w @ai-tcg/render`): one
  owner in an in-memory store opens 10 packs, a seed searched for each
  (no hit, Foil, Full Art, Alt Art, Glitch, Secret, Gold, Zero-Day,
  Prototype, a Jackpot with a hit), and writes the page and a transcript.
- `soundFx.ts`: eight pack sounds in the same recipe table and player
  (`SFX_PACK_KINDS`); the match sounds are unchanged.
- **Side task:** `feed.ts` names a mode on play / evolve ("(Outbreak)") and
  cast (", choosing Wipe"), and the resolve line strips the engine's
  "(Wipe)" from the card name. `capture.ts abilityTextFor` reads every
  mode's abilities (`allAbilities`, via `engineInternal.ts`).

**Ran it:**
- `npm run pack-opening`: the 10 packs in
  `progress/render/evidence/v2-s24-pack-showcase.txt`.
- The browser check (`pack-opening-check.mjs`, output in `.txt`): all
  pass at 1280 x 800 and 390 x 844.
- The modal feed on the engine's own sample seed (442, Cortex vs Swarm
  with the 3 Zero-Day cards): 5 mode choices worded, the Wipe's text folded
  into its resolve line.

**Bugs found while building:**
- The first browser run "failed" every reveal: my log helper let the
  payload's `kind` overwrite the event's own kind, so reveals were logged
  under the finish's name. A logging bug only; renamed the field.
- The stills showed three visual bugs: a focus ring drew a white box round
  the pack; the Gold card's footer was dark text on a dark bar; the secret
  number callout covered the card's name on a phone (now above the card
  when there is room, over the art otherwise). The Prototype plate covered
  the last line of text (the text box is shorter on a Prototype now).
- The feed bugs on modal cards (side task): see notes-for-owner.

**Tests:** render 349 (+22): `packOpening.test.ts` (17: the plan over 400
real openings, the showcase, the page, the pure helpers, the sounds) and
`feedModes.test.ts` (5, a real modal match). Mutation: removing the mode
suffix fails 2; reading `card.abilities` instead of every mode fails 2.

**Named honestly** (in the debt list): no real device, GPU, tilt or ears;
card swipes checked only as taps; the committed page's ids change on every
rebuild.

**Next render-lane slice:** slice 2, the ten-pack opening: fast flips with
skip and speed-up, full reveals only for the big pulls (the store's
`fullReveal`), and the summary grid.

---

## 2026-10-18 — Session 25: pack opening, slice 2 (ten packs at once, and the summary grid)

Render session by the alternation rule: the last merged PR (#67) was a game
slice. Owner feedback read first:
- 2026-10-18 (answers to render session 24): all 6 slice-1 calls kept;
  "carry on with slice 2 (the ten-pack opening and its summary grid)".
  This is slice 2.
- 2026-10-18 (answers to game session 41: Zero-Day cards go live, Aegis vs
  Cortex): game-lane work. The Zero-Day reveal already shows whatever the
  registry has, so it picks the real cards up when they go live.

**Built:**
- `packOpening.ts`: `planBulkReveal(BulkOpening)`. Each pack is planned as
  a single pack would be, and the store's own summary is carried through. It
  also builds the summary grid (`SummaryTile`): copies of one card in one
  finish fold into a tile with a count and the packs they came from; a
  Prototype is always its own tile. The grid runs best first (finish, then
  rarity), with one NEW badge per collection entry the owner lacked
  (`entryKeyOf` copies the store's rule, which it doesn't export).
  `BULK_TIMINGS` and `BULK_SPEEDS` (1×, 2×, 4×) are the proposed timings
  and speeds.
- `packDemo.ts`: `openBulkShowcase()`. There are two real ten-pack opens
  (`EconomyStore.openPacks(owner, 10)`), each a fresh owner's first ten
  packs. The search tries base seeds 1, 11, 21, … and keeps the first open
  that has what the showcase wants: "10 packs" (no big pull, one hit, seeds
  1-10) and "10 packs, big pull" (a secret in pack 6 and two Full Arts,
  seeds 21-30). The transcript gains a ten-pack section.
- `packPage.ts`, the ten-pack flow:
  - **The fan:** ten sealed packs; one tap opens them all.
  - **The fast sequence:** each pack tears by itself, with sparks exactly
    when it holds a hit. Its cards deal into a row: plain cards face up, the
    rest face down, turned one after another. A hit pops, glows and shows
    its finish name; NEW badges show as cards land. The row holds a little
    longer on a hit, then the next pack comes.
  - **Pips:** a strip of ten shows which pack is up. A pip shows gold for a
    big pull and pink for a hit, but only once that pack is open.
  - **Controls:** 1× / 2× / 4× (remembered per viewer) and Skip. A tap on
    the row moves straight on to the next pack.
  - **Big pulls:** a pack the store marks `fullReveal` (Gold, Prototype,
    secret, Zero-Day, Jackpot) leaves the fast sequence. It becomes the
    single-pack flow: the sealed pack under a "BIG PULL" tag, torn by hand,
    the stack, and every reveal at its own full length whatever the speed.
    Its skip button reads "Skip this pack". Then the fast sequence carries on.
  - **Skip** runs ahead to the next big pull, which still gets its full
    reveal. With none left, it goes to the summary.
  - **The summary:** "TEN PACKS OPENED"; cards, new (the store's count),
    hits and big pulls; chips by finish and by rarity; "Best pulls" (the
    hits, larger); then everything else, folded with ×N and the pack
    numbers; pack points. The buttons are "Open 10 more", "Open one pack"
    and "Done".
  - The shelf gains a "Ten at once" row; the picker gains "×10" entries;
    `?bulk=N` opens one directly.
  - Refactor: the reveal code reads the pack from `S.cur`, not
    `DATA.packs[S.pack]`, so one code path reveals a single pack and a big
    pull inside a ten.

**Bugs found and fixed:**
- **The placeholder art shared one gradient id (`id="g"`) across the
  page,** so every card painted the first card's background. This was
  already in slice 1: a single pack's five cards and its summary tiles all
  took one colour. It showed up here as a summary grid tinted entirely in
  the first tile's magenta. Each art now names its gradient by what draws it
  (seed, pattern, variant, hue). Slice 1's committed stills show the old
  bug; they are left as the record.
- **Overlays left behind:** cancelling the timers (skip, or a big pull
  ending) also cancelled the ones that take the wash, the secret number
  and the Jackpot banner off the stage, so the "217/096" callout and a pink
  wash sat over the ten-pack summary. Slice 1's "Skip to summary"
  mid-reveal had the same flaw. `clearTimers` now removes them.
- **Controls that never hid:** `.speed { display: inline-flex }` overrode
  the `hidden` attribute, so the speed buttons stayed on the summary and
  during a big pull.
- Phone layout: the controls covered the pips, and the second row of cards
  sat left. The pips moved down, and the row is now a centred flex wrap.
  The ×2 badges were clipped at the grid's edge.
- Check-script bugs (not page bugs): stepping past the last card, and a
  pack cut short by Skip read as "never dealt".

**Ran it:**
- `npm run pack-opening`: both tens in
  `progress/render/evidence/v2-s25-ten-pack-showcase.txt`.
- The browser check (`pack-bulk-check.mjs`, output in `.txt`) ran at
  1280 × 800 and 390 × 844. Run A: the everyday ten at 4× took about 5 s
  from the tap to the summary. Run B: the big-pull ten at 1× took about
  27 s, including tapping through the big pull. Run C: 2× with Skip, which
  stopped at the big pull and then reached the summary. All pass: packs in
  order; only the store's big pulls left the fast sequence, every one did,
  and Skip included; sparks iff a hit; dealt cards equal the plan; every
  face-down card turned; the big pull's reveals all played; the summary's
  tiles add up to the 50 cards, with the store's new count and pack points;
  no overlays left; controls hidden; speed remembered across a reload; no
  sideways scroll; no page errors.
- Slice 1's own browser check (`pack-opening-check.mjs`), re-run against
  the refactored page: all 10 single packs pass at both widths
  (`pack-opening-check-s25-rerun.txt`).

**Tests:** render 362 (+13), in `packBulk.test.ts`:
- Over 40 real tens (400 packs): the plan holds exactly the store's packs
  and summary. The grid holds every copy once, folded correctly, with the
  pack numbers true. There is one NEW per new entry, and the grid is best
  first.
- The showcase is reproducible and the committed page matches it. The page
  embeds the tens, the timings and the speeds.
- The pure helpers: finish order, pack labels, fast-pack length by speed.
- One art gradient per card.

Mutation: reverting the gradient id fails the art test. Removing the NEW
de-duplication survived the 400-pack tests (a new card pulled plain and
Foil in one pack never happened there), so a targeted test was added from a
real opening with one copy added; it now fails that mutation.

**Named honestly** (in the debt list):
- No real phone, GPU or ears.
- The fast row's finishes are CSS stand-ins, not shaders.
- The showcase is two tens found by search, both a fresh owner's first, so
  most cards are NEW.

**Next render-lane slice:** slice 3, the first-time flow (an agent's first
packs and the leader, the signature card, reveal).

## 2026-10-18 — Session 26: the owner's pack-opening feel notes (full-bleed top finishes, a tap-driven ten-pack) and modal card faces

Render session by the alternation rule: the last merged PR (#69) was a game
slice. Owner feedback read first:
- 2026-10-18 (feel notes on slices 1-2): two changes "before slice 3, or as
  the first part of that session": full-size art for every finish rarer
  than Full Art, and a tap-driven ten-pack with an "Auto" switch. Both done
  here; slice 3 (the first-time flow) is next.
- 2026-10-18 (answers to game session 42), render side task: show both
  modes on a modal card's face. Done here, in the pack page, the summary
  and a new card viewer.
- The game-lane items in that entry (the signature-mode ring) are the game
  lane's own.

**Built:**
- **Modal faces.** `packOpening.ts` `CardFace.modes` carries each mode's
  printed name and rules text from the engine's `CardMode`. The face prints
  "CHOOSE ONE", then each mode as its name in bold and its text, with an
  accent bar. On a full-bleed face the rules box starts higher (the type
  line at 47%), since two modes need the room and the art is behind it
  anyway. All 3 Zero-Day cards fit with their flavor line.
- **The face moved into the page's pure source** (`packFaceHtml`,
  `packRulesHtml`, `packFullBleed`, `packFinishLayerName/Amt`), so Node
  tests and the new face sheet run the same code the page does.
- **Full bleed.** `packFullBleed`: every finish but Standard and Foil. Owner's
  rule: "a finish rarer than Full Art always shows its artwork across the
  whole card". By the live S0-odds-2 shine table, Glitch (4%) and Alt Art
  (3%) are rarer than Full Art (9%) too, so they are full bleed with Gold,
  Prototype, the secret illustrations and Zero-Day. A full face gets its edge
  ring drawn over the art (the face's own inset ring sits under it).
  - **Gold:** the art in gold tones, a gold gradient edge, the name in gold
    lettering, gold-on-brown text panels, a gold cost coin.
  - **Prototype:** full-bleed art with the serial plate stamped on top.
  - **Zero-Day / secret / Glitch:** full bleed, with their own rings.
  - In the reveal, the card still turns over plain and grows to full bleed
    as it lands (Gold, Prototype and Glitch now grow like Full Art does).
- **The tap-driven ten-pack** (replaces slice 2's calls 1 and 6):
  - Nothing plays on its own. The fan tap tears pack 1; after that each tap
    or swipe on the row tears the next pack. Its cards deal into the row;
    a tap on a face-down card turns it, a tap elsewhere turns the first one
    left; once all are turned, a tap or swipe moves on (`packRowTap`, a pure
    helper).
  - A big pull tears in the row like any pack (sparks only when it holds a
    hit), then its full reveal plays right there: no sealed pack, no second
    tear. The "BIG PULL" tag is gone. After it, the next pack waits sealed
    in the row for a tap.
  - "Skip to summary" (the old "Skip", renamed as the owner put it) still
    stops at every big pull.
  - **Auto**, a switch, off by default and remembered per viewer: the old
    automatic sequence, with 1×/2×/4× (the speed buttons only show while it
    is on). In Auto a big pull tears itself and steps through its reveal by
    itself, each step at full length plus a 0.7 s beat. Switching Auto off
    mid-open stops at once; switching it on carries on from where you are.
  - Proposed tap beats (`BULK_TAP_TIMINGS`): the tapped pack shows sealed
    0.14 s; taps wait for the deal to land (about 0.5 s); after a hit turns,
    a tap waits 0.6 s before moving on, so a double tap can't cut its pop.
- **Card viewer.** A tap on any summary tile (single or ten-pack) shows the
  card full size with its finish's shader and the light following the
  pointer: the place to read a card, its modes included. Esc, Close or a tap
  outside closes it.
- **Text fit.** A long card's flavor line was cut off at the bottom or ran
  under the attack/health boxes (seen on Zombie Process and the Prototype
  while building the face sheet; it predates this session). `packFitText`
  steps the rules text down (to 68% at most, as a share of the card size,
  so it holds at every size) until it fits and its last line clears the
  boxes. A MutationObserver fits every face as it is put on the page.
- **Wording fix:** a big pull's last card inside a ten said "Tap for the
  summary" but went back to the packs; it now says "Tap to carry on with the
  packs".
- **Card-face sheet** (`src/faceSheet.ts`, `npm run card-faces`,
  `render/output/card-faces.html`): the 3 Zero-Day cards with their set
  numbers, and one real pull per finish from the showcase, side by side.

**Ran it:**
- `npm run pack-opening` and `npm run card-faces`: the page and the sheet.
  The showcase packs are the same as session 25 (same seeds), so no new
  transcript.
- `pack-tap-check.mjs` (new; output `pack-tap-check.txt`) at 1280 × 800 and
  390 × 844, fresh profile each: all pass.
  - 0: Auto off by default, speeds hidden.
  - A: the everyday ten by hand. Left alone 1.2 s after every deal and after
    every fully-turned row, nothing moved. Every tear and every turn came
    from a tap or swipe.
  - B: the big-pull ten by hand. The big pull (pack 6, a secret) tore like
    the others and its reveal followed with no sealed pack. Then the summary
    and the viewer.
  - C: Auto at 2× with Skip: stopped at the big pull, which stepped itself,
    every card held at least its reveal's full time.
  - D: Auto at 4×, hands off: about 5 s to the summary (as session 25).
  - E: Auto at 1×, switched off in pack 2: nothing moved for 2 s; finished
    by hand.
  - Auto and 4× survived a reload. F: the Zero-Day summary's tile opened the
    viewer with Outbreak / Carrier readable. G: the face sheet's 12 faces all
    fit their box and are full bleed on exactly the 10 rarer finishes.
- Slice 1's `pack-opening-check.mjs` (now takes a still prefix) re-run on the
  new page: all 10 packs pass at both widths (`pack-opening-check-s26.txt`).
- Two check-script bugs fixed on the way, not page bugs: run C's Skip
  landing in a pack's sealed beat (cut before its tear, on purpose), and the
  big pull's first card measured mid-rise.

**Tests:** render 375 (+13), in `packFaces.test.ts`: modal faces match the
engine's modes for every modal card in the registry, escaped; full bleed is
exactly the finishes no commoner than Full Art in the live shine table
(read from `LIVE_PACK_ODDS`, so a new table re-checks it); a settled face is
full bleed on those and an unsettled one never is; the row-tap rules; the
page ships the tap timings, an Auto switch that starts off, and no "BIG
PULL"; the face sheet's entries. Mutations: reverting full bleed to the old
three finishes fails 3 tests; dropping the mode block fails 2.

**Named honestly** (in the debt list): still no real phone, GPU or ears;
the tap flow's feel (the 0.6 s pop guard, flips-before-moving-on) is
untested by a human; the fit shrinks text rather than reflowing the layout.

**Next render-lane slice:** slice 3, the first-time flow (an agent's first
packs and the signature card reveal).

## 2026-10-18 — Session 27: hold to tilt (the owner's new feature, as corrected), before slice 3

Render session by the alternation rule: the last merged PR (#71) was a game
slice. Owner feedback read first. The render-lane entries left are the
2026-10-18 hold-to-tilt feature, its booster-pack addendum, the fan answer
("only the pack being opened") and the correction ("the card moves as one
piece, no art depth"). The owner said to build it "alongside slice 3, or
just before it". This session builds it just before slice 3 and finishes
it. Slice 3 (the first-time flow) is next. The game-lane entries (answers to
game session 43) and the art-model decision belong to the game lane and the
art pass.

**Built** (`render/src/packPage.ts`, `packOpening.ts` `TILT`):
- **Hold to tilt.** Press and hold, then drag. The card leans in 3D
  towards the finger as one solid piece: no art offset and no depth layer,
  per the correction. It leans up to 15° each way, reached at the card's
  edge (`packTiltAngles`). The finish's shader light follows the finger,
  the same way it follows the device's tilt. Letting go springs it back
  flat (560 ms with a small overshoot).
- **Where:** the revealed card on the stack (single pack and big pull),
  the card viewer, the sealed pack, and the ten-pack fan's front pack only.
  The other nine packs stay still. A face-down card never leans, and
  neither does a card mid-flip (it has to have landed).
- **Tap versus hold** (`packHoldState`):
  - A press held still for 200 ms starts the tilt.
  - Where a move means nothing else (the viewer, the pack below its strip,
    the fan), a move of 8 px starts it at once.
  - On the stack, a quick sideways move is still the swipe to the next
    card, so only the hold starts the tilt there.
  - A release after a tilt is never a tap or a swipe. Its trailing click
    is dropped, so it doesn't close the viewer or tear the fan, but a new
    press always goes through.
- **The tear strip vs tilt:** a drag that starts on the strip (the top 32%)
  tears, as before, and never leans. Anywhere else, a hold or drag tilts
  and a tap tears. The strip now reads as the place to drag: a lit band and
  a "TEAR" tab at the start of the cut line. The hint reads "Drag along the
  TEAR strip to open it, or tap / Hold and drag the pack to tilt it".
- **The honest tell:** the tilt code reads nothing about the pack. A test
  checks that its source never names sparks, hits, finishes or the current
  pack, and the browser check leans three packs (no hit, Gold, Zero-Day)
  with the same gesture and gets the same transform at every step.
- **Hover no longer leans a card** with a mouse, since only a hold tilts
  now. It still moves the shine. The device's own tilt still leans the
  card as before. Call 5 at the checkpoint.
- **Reduced motion:** the lean stops at 6°, and the card eases back in
  150 ms with no spring.
- **On a phone:** no long-press menu or text callout on the stage or the
  viewer.
- `.stack` now has a perspective, so the lean (and the flip) reads in 3D.
  Before, the hover lean was flat.

**Ran it:**
- `pack-tilt-check.mjs` (new; output `pack-tilt-check.txt`), each run from
  a fresh profile, all pass:
  - three runs: 1280 × 800 with a mouse; 390 × 844 with real touch events
    (CDP touch, so the page sees `pointerType` touch); and 390 × 844 with
    touch and reduced motion.
  - The pack leans -15/15 toward a finger past its corner. It stays untorn
    when let go and comes back flat. A drag on the strip tears it and never
    leans it.
  - A card leans 15/15 at its corner. The release keeps it on screen, a tap
    still moves on, and a flick still swipes without leaning.
  - On the Foil card, the shader's light ends where the finger ends
    ([0.10, 0.90]).
  - The viewer card leans to the angles predicted from the finger's spot
    (rx 9, ry 13.5). Let go over the backdrop, the viewer stays open; a tap
    on the backdrop closes it.
  - The no-hit, Gold and Zero-Day packs lean the same, step for step.
  - On the fan, the front pack leans and 9 others stay still. The release
    doesn't tear, and a tap 0.12 s later does.
  - With reduced motion: a 6° maximum and a 150 ms ease.
- **Recordings:** `v2-s27-tilt-desktop.webm` and `v2-s27-tilt-phone.webm`
  show the Gold pack tilted in a circle, torn along the strip, the Gold
  card tilted, then the Zero-Day card in the viewer. A dot marks the finger
  (the script draws it; the page doesn't). The input is slower than a
  person's, since the software GPU slows each scripted step. Stills:
  `v2-s27-tilt-{foil,viewer,fan}-{desktop,phone,phone-reduced}.jpg`.
- **Regression:** slice 1's `pack-opening-check` and session 26's
  `pack-tap-check` were re-run on the new page (`pack-opening-check-s27.txt`,
  `pack-tap-check-s27.txt`).

**Two bugs this check found, fixed before committing:**
- **The trailing-click guard was too long.** It lasted 400 ms, so a real
  tap on the fan within 0.4 s of letting go of a tilt was dropped. Now a
  new press clears the guard.
- **Two harness bugs, not page bugs:**
  - Under the software GPU, a scripted 60 ms "tap" arrived as 219 ms,
    longer than a hold. Taps are now sent back to back.
  - The viewer was measured mid-rise. The check now waits for its
    animation to finish.

**Tests:** render 388 (+13, `packTilt.test.ts`): the press rule, the lean
(flat at the centre, toward the finger, capped even far off the card,
smooth), the page ships `TILT`, exactly four things tilt, the tilt code
never reads the pack's contents, no art depth, and the strip is marked.
Mutation checks:
- dropping the clamp fails 1 test;
- letting a hit change the lean fails 2.

**Named honestly** (in the debt list):
- It still hasn't been held by a person on a real phone, and the 200 ms
  hold may feel slow or eat slow taps.
- The tilted card doesn't light differently from its own angle; only the
  shader's light point moves.
- The ten-pack row's cards can't be tilted (the owner listed the reveal,
  big pull and viewer).

**Next render-lane slice:** slice 3, the first-time flow: an agent's first
packs and the signature (leader) card reveal. Hold to tilt is then already
there for the signature card.

## 2026-10-18 — Session 28: slice 3, the first-time flow (the starter packs and the signature card's reveal)

Render session by the alternation rule: the last merged PR (#73) was a game
slice. Owner feedback read first. The render-lane entry left is the answers
to render session 27 (keep all 8 tilt calls, "next render session: slice 3,
the first-time flow, as planned"); nothing in it to change. The answers to
game session 44 (an Aegis deck trial) are the game lane's own.

**Built** (`render/src/firstTime.ts`, `firstTimePage.ts`, `firstTimeDemo.ts`;
`npm run first-time` writes `render/output/first-time.html`):
- **The data is the store's, every branch.** The page plays back the Season
  0 sign-up as the economy store does it: `grantStarterCollection` per
  faction (each in its own store, because NEW depends on the starter deck),
  `openPack` for the 3 starter packs (fixed seeds 101-103, not searched),
  and "Generate a new agent" for all 9 branches (3 agents x 3 cards), each a
  fresh store replaying the same seeded `startAgentDraft`, `pickDraftAgent`
  (agent k uses its own seed, as the site draws one per pick) and
  `confirmAgentDraft`. A branch shown a different draft throws.
- **Eight screens, one rail** (Faction, Packs, Agent, Signature):
  1. Welcome: a fan of card backs, the logo, the three steps.
  2. Four faction plates, each with its starter Mythic's face and one line
     of identity; a tap selects, the button names the pick.
  3. The starter deck: the box drops in (40 on it), its 5 rarest cards fan
     out of it, the 3 packs slide in.
  4. The 3 starter packs through the real pack opening (tear, stack,
     reveals, summary), with a "STARTER PACK n OF 3" badge; the summary's
     buttons lead on, and the last one says what the owner now holds.
  5. Three agents: the replay's avatar for each name, the name typing
     itself, the persona.
  6. That agent's 3 signature cards, full faces, with their art windows
     empty ("ART PIECE · DRAWN WHEN MADE"): the store draws the art-pool
     piece only on confirm. Phones stack them as rows.
  7. **The mint** (the reveal): the other two cards fall away; the chosen
     one turns face down and flies to the middle while the screen goes
     black; a terminal prints what the store recorded (agent, card, the
     fairness line it passed, the art piece, the number); the card's own
     ward (the fallback ward generator, seeded from its name: the same
     ward its matches draw) draws itself in behind it and spins up; the
     card turns face up as the made card, its face burning in from the art
     outward while the art develops; the PR-001 / 1 OF 1 plate slams in
     (shake, stamp, motes); the plate lifts into the card's own number,
     the ward folds into a halo, the new signature light comes on. About
     6.5 s, nothing skips it; then it can be held and tilted.
  8. Ready: the agent, its card (tap for the viewer), and the holdings:
     starter deck + pack cards + 1 signature.
- **The signature face** (`packFaceHtml`, reveal `signature`): full bleed,
  a white-gold edge and lettering, a SIGNATURE mark, "PR-001 · 1 OF 1",
  "Signature · S0". Its placeholder art (`packSignatureArt`): a figure of
  light standing in rings over a horizon grid, in a hue from its art-pool
  piece, so two cards that drew the same piece share the picture, as the
  pool means.
- **A `signature` shader** (`packFx.ts`): white-gold rays, a rune ring
  around the art's centre that brightens under the light, round glints.
  The only finish with rays.
- **The rules text a signature card prints** is the menu option's own
  wording, taken from the generator's concept: the engine's built abilities
  carry a shorter text without the trigger ("Draw a card." for "On arrival,
  if you have 2 or fewer cards in hand, draw a card."). Asked of the game
  lane.
- **Names shrink to fit** on every card face (`packFitName`, down to 66%),
  instead of being cut off with "...". The pack page and the face sheet get
  it too (they share the face).
- **The pack runtime grew two hooks, nothing else changed in it:** a
  summary hook for a flow's own buttons, and `window.PACK` (its opening,
  faces, tilt, viewer, layers, sound) for the flow to drive.

**Ran it:**
- `npm run first-time`; transcript `v2-s28-first-time-transcript.txt`.
- `first-time-check.mjs` (new; output `first-time-check.txt`): desktop with
  a mouse, phone with CDP touch, phone with touch and reduced motion, each
  through the whole flow by hand (a different faction, agent and card each
  run). All pass. See the checkpoint for what it checks.
- A measurement for the owner (2,000 fresh sign-ups through the store, one
  seed per pack): **55.1% of new owners see no hit in their 3 starter
  packs**, and 15.2% see nothing but Standard cards. The demo's fixed seeds
  are such an opening (two Foils, no hit).
- Rebuilt `pack-opening.html` and `card-faces.html` (shared face source).

**Bugs found and fixed while building:**
- The mint overlay covered the page while hidden (`display: grid` beat the
  `hidden` attribute).
- The ward canvas showed as a dark square: the overlay is its own stacking
  context, so the canvas's screen blend only sees the overlay's background,
  which must be opaque.
- The signature shader's glints were 6 px squares; now round and sparser.
- The name fit used `scrollWidth`, which rounds, so a name a fraction of a
  pixel too wide kept its "..."; it now measures the text against its box.
- A mouse drag on the card during the mint selected its text (blue
  highlight in the first recorded stills): the overlay sits outside the
  stage's no-select rule. It has its own now, and the check asserts no
  selection.
- With reduced motion the mint was over before its terminal had typed its
  values (the check caught it); with reduced motion they now print whole.
- Check-script only: Playwright waits for the bobbing pack to stop moving
  (it never does), and a phone's confirm button sits below the fold.

**Tests:** render 402 (+14, `firstTime.test.ts`): the starter data per
faction, NEW counted against each faction's own starter deck, every
branch made what was picked (number, bound promo copy, art piece, flavour,
picture from the art piece), reproducible; the signature face once made and
on the pick screen; the printed rules text over 180 generated candidates;
the mint's terminal against the store's values, its beats in order and its
length (5.5-7.5 s to settled, under 8.5 s to free even at the longest
names); the page ships the flow only on the first-time page.
Mutation checks: printing the engine's bare concept (the cost and stats
left in) fails the rules-text test; showing art on the pick screen fails
the pick-screen test.

**Named honestly** (in the debt list): no real phone, GPU or ears; the
mint's feel and length untried by a person; the placeholder signature art
is a stand-in for the art pass; no name field at creation; no "back" from
the card pick (one pick per draft, as the store).

**Next render-lane slice:** the owner's call on slice 3; then the render
debt list (the turn-cap ending and the momentum gauge's pending threat were
waiting behind the pack-opening work).

## 2026-10-19 — Session 29: name your agent when it's made (the owner's call 5 on slice 3)

**Read first:** owner-feedback.md's answers to render session 28: keep 8, change 2. Call 5 (a name field
at creation) is this lane's. Call 9 (a guaranteed hit across the starter packs) is the game lane's,
next. Game session 45 fixed the signature ability text at the source, so the render can use it.
The alternation rule put this run on the render lane (the last PR, #75, was the game lane's).

**Built:**
- **The name field** (`render/src/firstTimePage.ts`, the agent screen). It shows once an agent is
  picked, a terminal prompt with the generated name as placeholder. Blank keeps the generated name.
  It is checked as you type by the store's own code: `render/src/nameRules.ts` bundles
  `economy/src/agentNames.ts` (`customAgentNameProblem`, `tidyAgentName`) and the engine's
  blocked-word filter (only `signatureNames.ts`, by aliasing the engine package to it) with esbuild,
  plus the replay's `avatar.ts`, into one global `FTN` (11 KB) that the first-time page inlines.
  `ftNameCheck` takes a name the way `confirmAgentDraft` does (tidied; blank or the same name =
  generated), and `ftNamedMint` makes what the store makes under it (the flavour line with the
  generated name replaced). A refused name disables the confirm with the store's reason, and
  "Keep generated" clears it. The picked dossier shows the typed name over the struck-through
  generated one, with the avatar redrawn for it. The name then carries to the signature screen, the
  mint's terminal, the made card's flavour line and the ready screen. `?name=` jumps there for stills.
- **Signature rules text from the card itself:** `printedText` (the concept-derived text) is gone;
  the face is `faceOfCard(sig.card)`. Over 1,200 generated candidates the only difference from the
  concept was keyword-only cards ("Barrier." -> "Barrier", as every set card prints a keyword).
- **The transcript** ends with 12 typed names through `confirmAgentDraft` (`typedNameResults`):
  tidied, repeated words, and each kind of refusal.
- `esbuild` (0.28.2, already in the tree under tsx) is a render devDependency now.

**Bugs found and fixed (all from slice 3):**
- **A pick couldn't be changed:** the plates' `dim` class matched the pack page's full-screen `.dim`
  rule (absolute, inset 0, opacity 0, no pointer events), so unpicked plates left the layout and
  couldn't be tapped. Renamed `ft-dim`. Slice 3's check never re-picked, so it never saw it; the
  check now does (H), and fails 3 x 3 times without the fix (reproduced).
- **On the phone the Make button was untappable** at the bottom of a scrolled pane: the pack page's
  empty `#hint` strip (z-index 5) sat over it. `.hint:empty` takes no pointer events on the flow page.
  Found only once the fixed plates made the pane taller.
- **The flow's screens kept the last pack's footer** after the packs; `screen()` puts the flow's back.
- The "Keep generated" button first rendered as a blank white box (unstyled); seen in a still,
  styled, and the check asserts it reads.

**Ran it:**
- `npm run first-time`; transcript `v2-s29-first-time-transcript.txt`.
- `first-time-check.mjs ... video v2-s29` (output `first-time-check-s29.txt`): desktop types
  "  Night   Shift 99 " (tidied to "Night Shift 99"), phone (CDP touch) "Bit by Bit", reduced motion
  leaves it blank. All pass, including the new G (name) and H (re-pick) checks; slice 3's mode
  (no typing) also passes. Stills and recordings `v2-s29-*`.
- `npm test`: all six workspaces pass (811; render 407, +5); typecheck clean everywhere.

**Tests (+5, `firstTime.test.ts`):** the bundle agrees with the store on tidy and on every name in
a ~50-name corpus (at least 8 kinds of verdict); for every name the store accepts, the page shows
its agent name and flavour line, and for every one it refuses, the same reason; blank or the same
name keeps the made card untouched; the avatar is the replay's; only the first-time page ships the
bundle. The rules-text test now checks the face against the card's abilities. Mutations: the
flavour line left unchanged, and a length-only check, each fail a test.

**Named honestly** (debt list): not typed on a real phone (the on-screen keyboard is untried);
"is the name free" isn't live, and this demo never shows that refusal; the refusal wording is the
store's, a little technical.

**Next render-lane slice:** the owner's call on this check-in; then the render debt list (the
turn-cap ending and the momentum gauge's pending threat). Once the game lane lands the starter-pack
hit guarantee, rebuild `first-time.html` and re-run the check (the starter packs change).


## 2026-10-19 — Session 30: the starter guarantee on the page; the plan for victory boasts

Render session by the alternation rule: the last merged PR (#77) was the game lane's (session 46,
the starter guarantee). Owner feedback read: the 2026-10-19 answers to game session 46 hold a
render side task (a "Starter guarantee" note after the reveal) and approve the game lane's boast
plan; the render lane proposes its own half before building. Render session 29's answers (keep all
5) needed nothing.

**Built: the starter guarantee note.**
- `packOpening.ts`: `PackReveal.starterHit`, from the store's `PackOpening.starterHit`.
- `packPage.ts`: the summary shows "Starter guarantee: this pack was due a hit." when it applied,
  next to the pity notes. Nothing else in the page reads the flag, so the sealed pack, the tear and
  the reveals are unchanged.
- `firstTime.ts`: the transcript marks the upgraded pack.
- Rebuilt `first-time.html` (now with the guarantee: on the demo's seeds every faction's pack 3
  becomes a Full Art Static Ward Beacon; before it, all 3 packs held no hit for every faction) and
  `pack-opening.html` (data only: `starterHit: false`).

**Ran it:**
- `npm run first-time`; transcript `v2-s30-first-time-transcript.txt`.
- `first-time-check.mjs . first-time.html "" v2-s30` (output `first-time-check-s30.txt`): new check
  I (a hit in every faction's packs; no note while sealed, torn or revealing; the note on exactly
  the upgraded pack's summary; the 3 sealed packs' markup identical). Desktop, phone and reduced
  motion all pass, with the session-29 name checks. Stills `v2-s30-4-pack-*`, `v2-s30-4b-last-summary-*`.
- `npm test`: every workspace passes (render 410, +3); typecheck clean everywhere. The two
  committed-page tests failed until `pack-opening.html` was rebuilt (its data gained the flag), as
  they should.

**Tests (+3, `firstTime.test.ts`):** the demo's seeds give every faction a hit, upgraded in pack 3;
40 other Swarm seed sets: a hit every time, the flag only ever on pack 3 and exactly when packs 1-2
had none (and pity hadn't already made it a hit); both upgraded and natural cases occur; the note
text appears once in the page and only the summary reads `.starterHit`.

**Planned, not built: victory boasts, the render half.** An [OWNER CHECK-IN] in
`notes-for-owner.md`: a "victory" event category (rises from the winner's side, never touches the
loser, so a Null collapse can't read as removal), the 4 starter boasts as data over the existing
primitives, the end-of-match order (lethal beat, HP settles, boast about 3 s, then the result line;
skippable), the fallback to the winner's faction starter boast for old matches, the loadout picker
last; four slices and 9 decisions with defaults.

**Next render-lane slice:** the owner's answers on the boast plan, then boast slice 1 (EFFECTS.md
grammar, the spec format, the Aegis boast in the replays). Without answers: the render debt list
(the turn-cap ending and the momentum gauge's pending threat).

## 2026-10-19 — Session 31: victory boasts, slice 1 (the victory grammar, the spec format, Shield Slam)

Render session by the alternation rule: the last merged PR (#79) was the game lane's (session 47, the
cosmetics backend). Owner feedback read: the answers to render session 30 approve the boast plan with
all 9 defaults and name slice 1 as this session's work; the game lane's schema has landed, so slice 3
can read `MatchRecord.loadouts` / `.boast` later. Nothing else for this lane.

**Built:**
- `render/src/boastFx.ts`: the victory grammar as code. Boasts are data (`BOAST_SPECS`, keyed by the
  catalogue's item id) over eight victory primitives (panel, wall, embers, flash, veil, gather, lock,
  name). `boastPlan` lays a spec on the winner's live geometry; `boastPlanProblem` checks the grammar
  on that plan (everything inside the winner's side and off the loser's, no piece moves down, sparks
  only upward and only as far as the side reaches); `boastStill` is the reduced-motion final pose;
  `BOAST` plays a plan as a CFX plug-in with the DOM parts (panel lit, loser dimmed to 0.7, name plate,
  Skip button, tap / Escape / Skip to end it). The page refuses to play a plan that breaks the grammar
  (it plays the still instead).
- **Shield Slam** (Aegis's starter boast, 3.0 s): 12 hex plates slam up out of the winner's slots,
  centre first; embers; the wall flashes as one; a dark veil over the winner's row; the bottom plates
  lift into a hex crest, the top ones rise away; the crest locks with the sting; the name plate under it.
- In the replay (`renderHtml.ts`): stepping into a win holds "GAME OVER: X WINS"; the boast starts
  `BOAST_LEAD_MS` (0.9 s) after the lethal beat and the result lands (class `land`) as it ends. A jump
  to the end and a draw show the result at once. Any navigation cancels a boast. The winner's side is
  scrolled into view first when it isn't (a phone).
- Sound: a `boast` sting recipe in every faction voice (always rises); `MUS.duckHold` holds the music
  at 55% under it (decision 8), the one dip below 80%. `CFX.kit.tex` exposed for plug-ins.
- `render/src/boastSheet.ts` -> `render/output/boast-sheet.html` (`npm run boast-sheet`): full row,
  empty row, winner above, phone width, the still.
- EFFECTS.md: "victory" in axis 1 and "Victory boasts as built".
- Regenerated all 14 replays, both older sheets, and added `cortex-vs-aegis-seed1.html` (Aegis wins
  from seat 2, the top side; none of the 14 had that). **The 14 replays now show different matches
  from session 23's:** the game lane's card and agent changes since then change every match (same
  seeds). The four Aegis wins among them (aegis-vs-aegis 1, aegis-vs-cortex 3 and 6, aegis-vs-null 3)
  all play the boast.

**Bugs found on the way (all caught by the browser check, fixed before committing):**
- The wall never rose in a replay: the boast looked for `.slot` elements, but a replay puts a filled
  slot's `.card` straight in the row. Only the crest showed. The geometry now reads the row's children.
- On a phone the winner's bottom side was scrolled out of view, so the whole boast played off screen
  (lit pixels 0). It now scrolls the side into view first.
- The Skip button stuck out past the side's right edge (fixed offset); now placed by its own width.
- The crest was small and the name sat on busy card art: added the veil primitive, a slightly larger
  crest, and a backing on the name plate (seen in the stills).

**A finding for every later browser check:** the lane's headless runs have used SwiftShader GL
(`--use-angle=swiftshader`), which runs any FX move at about 5 fps (measured: ordinary moves 4-14 fps,
the boast sheet 5 fps). With `--disable-gpu --disable-accelerated-2d-canvas` (Chromium's CPU canvas)
the same pages run at 62 fps. Past notes that "the headless browser's software GPU makes it slower"
were about that flag, not the pages. `boast-check.mjs` uses the CPU canvas.

**Ran it:**
- `node progress/render/evidence/boast-check.mjs progress/render/evidence render/output video`
  (output `boast-check-s31.txt`): 136 checks, ALL PASS. Desktop and phone, seat 1 and seat 2; the
  boast starts 1.21-1.26 s after the step, the name at 2.16-2.17 s, the result at 3.00-3.01 s; the
  page's plan passes the grammar on every live layout; loser side, panel and hand at 0.7 and their
  markup unchanged; on the top canvas, lit samples on the winner's side (up to 13.5k during the wall)
  and 0 on the loser's side from 1.25 s on (the lethal hit's own particles are there before that);
  Escape at 1.0 s and a phone tap at 1.0 s land the result within 18 ms; reduced motion: the still,
  the name at once, the result at 1.0 s; a jump to the end and a Cortex win: the result at once, no
  boast; every sheet scene plays without a grammar problem. Stills `v2-s31-*.jpg`, recordings
  `v2-s31-desktop-seat1.webm` and `v2-s31-desktop-seat2.webm`.
- `npm test`: all six workspaces pass (render 440, +30); typecheck clean everywhere.

**Tests (+30):** `boastFx.test.ts` (29): specs valid and in step with `STARTER_BOASTS` (ids, names,
factions, art refs); `boastIdFor` (record, fallback, none); six broken specs refused; the grammar over
both seats x full / 3 / empty rows x desktop / phone, a narrow one-line layout, and 300 random layouts
and seeds, plan and still; every piece sampled every 10 ms never moves down or leaves the side;
mutations (a sinking piece, a piece crossing to the loser, downward or too-wide sparks, a huge shock,
a veil or name on the loser's side, a late mark, no name, a stray loser rect) are each caught; Shield
Slam's shape (3 s, the name before the end, the sting at the crest with the duck, the panel first,
12 plates centre-first with 6 impacts on full and empty rows, a crest of 7 over the name that fades as
the result lands); deterministic per seed; the still (1 s, 7 still plates, panel / veil / name / sting);
the slam's ease; the sting rises in every voice and isn't a match-event sound; the sheet has every
scene and the replay's sources. `musicFx.test.ts` (+1): `duckHold` holds 55% for its length, effect
dips inside it are skipped, after it they dip to 80% as before.

**Named honestly** (debt list): nobody has watched or heard it; only Aegis has a boast; the crest is a
hex flower, not yet a designed emblem; the match feed still prints "X wins" while the boast plays.

**Next render-lane slice:** the owner's call on this checkpoint; then boast slice 2 (Swarm's Hive
Burst, Null's Void Collapse, Cortex's Data Cascade, and the "Cosmetics: on / off" toggle).

## 2026-10-19 — Session 32: victory boasts, slice 2 (Hive Burst, Void Collapse, Data Cascade; the cosmetics switch)

Render session by the alternation rule: the last merged PR (#81) was the game lane's (session 48, the
Season 0 boasts). Owner feedback read: the answers to render session 31 keep all 7 calls; Season 0's two
boasts (Boot Sequence, Dial-Up Fireworks) are for the render lane to draw "after the 4 starter boasts
(slice 2)". This session is slice 2 itself; the Season 0 boasts are the next slice. The game-lane items
(Guardian 3/5, reading the approved list with today's agent) wait for the next game session.

**Built:**
- `render/src/boastFx.ts`: six new victory primitives (`bloom`, `burst`, `stream`, `star`, `pull`,
  `bars`) and formations (`BOAST_FORMATIONS`: `hexRing`, `sporeColumn`, `pyramid`). A `gather` lifts the
  latest carrier's pieces, can snap each into another sprite as it lands (`into`), and copes with pieces
  still moving when it starts. Pieces can stretch (`sx`), turn (`spin`, which the grammar check counts
  as the square's corners) and carry a dark core (`core`). Easing `in`. The spec check knows the new
  dependencies (a burst needs a bloom, a pull a star, a star grows, collapses, then goes; a gather needs
  a carrier and a known formation). Shield Slam's plan is unchanged.
- **Hive Burst** (Swarm), **Void Collapse** (Null), **Data Cascade** (Cortex), 3.0 s each, as data.
- `boastCosmeticsShown(viewer, side, on)` and the replay's "Cosmetics: on / off" button (remembered per
  viewer; off: no boast, the result at once; off mid-boast: ends it now).
- `economy/src/cosmetics.ts`: `drawn: true` on the three new starter boasts (the catalogue test fails
  otherwise). No other change there.
- Sheet: all four boasts, 20 scenes. EFFECTS.md updated. All 15 replays regenerated (same matches, only
  the embedded sources changed) and one added: `swarm-vs-null-seed4.html` (Null wins from seat 2, the top
  side; none of the 15 had that).

**First pass looked weak, fixed before committing (seen in the stills):** green spores on the winner's
own green cards, cyan pixels on cyan cards and a dark star drawn additively all but vanished. Added an
early dark wash to Hive Burst and Data Cascade, a real dark core and a slow turn to Null's star (it now
reads as a hole in the light), and larger sacs, spores, motes, pixels and blocks; the spore column went
from 4 + crown to 6 + crown.

**Ran it:**
- `node progress/render/evidence/boast-check-s32.mjs <out> render/output video` (output
  `boast-check-s32.txt`): 322 checks, ALL PASS. Each new boast from seat 1 and seat 2 on desktop and on a
  phone, reduced motion for each, Shield Slam again, Escape and a phone tap, a jump to the end, the
  cosmetics switch (off mid-boast lands the result at once; remembered after a reload; off plays no
  boast; on again plays it), and all 20 sheet scenes. Boasts start 1.2-1.5 s after the step, the name at
  2.19-2.21 s, the result at 3.00-3.03 s; nothing lit on the loser's side from 1.25 s on.
- Frame rate (CPU canvas, 1280 x 900): Data Cascade 54 fps during the boast vs 61 after it; Void Collapse
  34 vs 36; Hive Burst 22 vs 26; Shield Slam 15 vs 17. The boast costs a few fps; the low baselines are
  the Mythic wards on those boards under the headless CPU canvas, not the boast.
- `npm test`: all six workspaces pass (930; render 500, +60); typecheck clean everywhere.

**Named honestly** (debt list): still nobody has watched or heard any boast at full speed; the three new
ones were judged from stills, three recordings and timed checks. The crests are about 100-120 px across
on desktop. The switch hides boasts only, since nothing else cosmetic is drawn yet.

**Next render-lane slice:** the owner's call on this checkpoint; then the two Season 0 boasts (Boot
Sequence, Dial-Up Fireworks), flipping each one's `drawn` in the same change.

## 2026-10-19 — Session 33: victory boasts, slice 2b (the Season 0 boasts: Boot Sequence, Dial-Up Fireworks)

Render session by the alternation rule: the last merged PR (#83) was the game lane's (session 49).
Owner feedback read: the newest entry (answers to game session 49) is the game lane's, left for it;
the render answers stand (session 32's six calls kept, done). The open render work from the
owner-approved plan: the two Season 0 boasts the owner named ("draw both after the 4 starter boasts
(slice 2)"; "neither goes on sale until the render lane has drawn it"). This session draws both and
flips their `drawn` in the same change, as the catalogue's test asks.

**Built:**
- `render/src/boastFx.ts`: five primitives (`crt`, `scroll`, `banner`, `skyline`, `rockets`) whose
  pieces are drawn as code, not atlas sprites (`shape`: `text`, `bits`, `dot`, `tower`; `w` fixes a
  piece's width, `rgb` colours it). A 5x7 dot font (`BOAST_FONT`, every character an agent name may
  use) with `boastBits` / `boastBitsFit` (one line, or two split at the middle space when that is
  larger). `lock` can skip its piece; the name plate can be `mono` and `type`d. A neutral spec carries
  its own `col`; `boastPlan` takes the winner (`{ name, faction }`) for the spelled or typed name and
  for the panel and sting of a neutral boast. The runtime draws the CRT (dot, line, raster, flicker,
  scanlines), the text, the dot blocks and the towers (silhouette, neon edge, windows that flicker in
  the data window, a blinking antenna); the plate types behind a block cursor.
- **Boot Sequence** and **Dial-Up Fireworks**, 3.0 s each, as data. `stats()` now reports the plan's
  pieces by group and the winner's name (for the checks).
- `render/src/soundFx.ts`: `crt`, `post`, `modem`, `whistle`, `pop` (outside `SFX_KINDS`, like `boast`).
- `render/src/boastSheet.ts`: 30 scenes; a neutral boast shows a different faction winning per scene.
  The replay passes the winner's faction to `BOAST.play`.
- `economy/src/cosmetics.ts`: `drawn: true` on both (so both are on sale in Season 0). One economy
  test assumed them undrawn; it now marks a copy undrawn for that half, and the store tests' own
  catalogue no longer includes the shipped season items (note for the game lane in notes-for-owner).
- All 16 replays and the boast and FX sheets regenerated (same matches: the embedded match data is
  byte-identical, only the sources changed, checked per file).

**Found in the browser and fixed (both in the grammar checker's blind spots, both now tested):**
- SYSTEM READY's flat shock tilted into the loser's side on the sheet: `CFX.kit.shock` gave every
  shock a random turn, so a squashed ring (sx != sy) could sweep past the axis-aligned box the checker
  measured. A squashed ring now stays level (`render/src/canvasFx.ts`); this also levels the existing
  face-hit ring (sx 1.9, sy 0.55), which was meant to lie on the floor.
- A flare's bloom reaches 0.72 of its size, the checker counted 0.55 (the sprite): now
  `BOAST_FLARE_REACH`, and the planner sizes flares to it. All four starter boasts still pass.
- A grid push close to the top of the side bent the background grid's lines over into the loser's
  side: the banner has no grid push.
- The typed plate measured its width while still scaled by its rise animation (92%), so the cursor
  overflowed; it measures `scrollWidth` now.
- Boot Sequence's text glow by `shadowBlur` cost a third of the frame rate on the CPU canvas (34 fps
  while the lines printed); a 1 px bleed pass either side looks the same and costs nothing measurable.

**Ran it:**
- `node progress/render/evidence/boast-check-s33.mjs <out> render/output video` (output
  `boast-check-s33.txt`): 385 checks, ALL PASS. Each boast in a real replay's last move (forced, as noted) from seat 1 and
  seat 2 on desktop and on a phone, and in reduced motion; Escape during Boot Sequence's typing (the
  typing stops with it); a phone tap during Dial-Up Fireworks; Shield Slam unforced (the starter still
  plays); all 30 sheet scenes, each with nothing lit on the loser's side at 2.5 s. Boasts start 1.2-1.3 s
  after the step; Boot's name types in from 1.55 s and is whole 0.60-0.65 s later; Dial-Up's plate at
  2.35 s; the result at 3.00-3.02 s (1.0 s for the stills). Frame rate (CPU canvas, 1 s): Boot 62 during
  vs 62 after, Dial-Up 55 vs 55, Shield Slam 63 vs 62.
- `npm test`: all six workspaces pass (980: render 548, +48; economy 125); typecheck clean everywhere.

**Named honestly** (debt list): nobody has watched or heard either boast; a replay shows them only
when forced until slice 3; the spelled name is busy over a Mythic ward; the BIOS type is the system
monospace; the checker still doesn't count an atlas sprite's soft glow halo.

**Next render-lane slice:** the owner's call on this checkpoint; then slice 3 (the replay reads each
side's loadout and the boast played from the match record; the close-win slot).


## 2026-10-19 — Session 34: victory boasts, slice 3 (the replay reads the boast from the match record; the close-win slot); the Match Boot plan

Render session by the alternation rule: the last merged PR (#85) was the game lane's (session 50, a
hardening pass). Owner feedback read: the answers to render session 33 keep all 7 calls (nothing to
change); its game-lane side task was done in session 50. The open render work: boast slice 3, then the
owner's new Match Boot feature, which the owner asked the render lane to plan at a checkpoint before
building. This session builds slice 3 and writes the Match Boot plan.

**Built:**
- `render/src/types.ts`: `ReplayRecord` (`matchId`, each seat's `loadouts`, the `boast`) and
  `ReplayBoast` (`side`, `itemId`, `slot`, `winnerHealth`); `MatchReplay.record` (optional).
- `render/src/boastFx.ts`: `boastFromRecord(boast, winner, faction)` returns `{ id, slot, close }`: the
  record's boast when it is the winner's and drawable, else the faction starter as `'fallback'`, else
  null. The runtime's `play` takes `close`, and the plate then says "<BOAST> · CLOSE WIN"; `stats()`
  reports it.
- `render/src/renderHtml.ts`: the replay plays `boastFromRecord(replay.record.boast, ...)` and passes
  `close`. Nothing else in the end-of-match timing changed.
- `render/src/recordedMatch.ts` (new): `captureRecordedReplay(scenario)` plays the whole loop through
  an in-memory `EconomyStore` (fixed clock): starter collections (with the free starter boasts), an
  agent each, starter decks; season items earned in real matches (startMatch -> runMatch ->
  recordMatch, a day at a time) and bought; loadouts set; then the replayed match started with
  startMatch (each side plays the deck the store loaded), captured, and recorded with both final
  health values. `attachRecord(replay, record)` turns agents into seats and refuses a record that
  isn't this replay's (seed, winner, winner's final health).
- `render/src/recordedDemo.ts` (new; `npm run recorded -w @ai-tcg/render`): four scenarios, written
  to `render/output/recorded-*.html`: Boot Sequence bought and worn (Cortex, wins on 11); a close win
  (Swarm wins on 3, its close-win slot holds Dial-Up Fireworks, bought: Dial-Up plays, not Hive Burst);
  another faction's free starter (Aegis wears Void Collapse; its close-win Hive Burst stays unused at
  14 health); an empty slot (the store records Cortex's starter as `factionStarter`, from seat 2).
- No economy or engine file changed: the store is read through its public API.
- The 16 sample replays and the boast sheet regenerated (the embedded match data is byte-identical in
  all 16, checked per file; only the page source changed).

**Ran it:**
- `npm run recorded -w @ai-tcg/render -- ../progress/render/evidence/recorded-matches-s34.txt`: the
  four scenarios with their loadouts, earnings (37 and 35 real matches over 4 days to afford the two
  season boasts), the final health, and the record's boast and slot.
- `node progress/render/evidence/boast-check-s34.mjs <out> render/output video` (output
  `boast-check-s34.txt`): 216 checks, ALL PASS, nothing forced. Each recorded replay plays the boast
  its embedded record names (checked against the page's own match data), from seat 1 and seat 2, on
  desktop and phone, in reduced motion; the plate says CLOSE WIN only for the close-win slot (also
  before an Escape at 2.5 s); a replay without a record still plays Shield Slam; the cosmetics switch
  off on a recorded replay plays no boast and the result lands at once (25 ms). Boasts start 1.2-1.5 s
  after the step; the result lands 3.00-3.05 s in (1.0 s for the still). Recordings
  `v2-s34-rec-boot-desktop.webm`, `v2-s34-rec-close-desktop.webm`; stills `v2-s34-*.jpg`.
- `npm test`: all six workspaces pass (989: render 557, +9 in `recordedMatch.test.ts`); typecheck
  clean everywhere.

**Seen in the stills (debt list, not fixed):** at the end of the close-win replay the momentum gauge
says the loser is ahead (on board), and the lethal attack's green smoke lingers on the loser's row.
Both predate this slice.

**Match Boot:** planned, not built (the owner asked for a plan at a checkpoint first): the [OWNER
CHECK-IN] is in `progress/render/notes-for-owner.md` with 10 calls and suggested defaults. The saying
can come from the match seed; nothing is needed from the game lane unless the owner wants the saying
kept if the list ever changes.

**Next render-lane slice:** the owner's calls on the Match Boot plan (the defaults stand if there is no
answer); then Match Boot slice 1. Boast slice 4 (the loadout picker) after it.


## 2026-10-19 — Session 35: Match Boot, slice 1 (the intro at the start of every match); the two end-of-match fixes

Render session by the alternation rule: the last merged PR (#87) was the game lane's (session 51, the
deck-building agent). Owner feedback read: the answers to render session 34 keep all 3 boast calls and
approve the Match Boot plan with all 10 defaults, and set this session's work: Match Boot slice 1 with
two end-of-match fixes (the gauge calling the loser ahead; the lethal smoke on the loser's row). The
newest entry (answers to game session 51 and a pre-launch balance gate) is the game lane's.

**Built:**
- `render/src/matchBootFx.ts` (new): list 1 of the sayings and `bootSaying(seed)` (a 32-bit hash; 1 in
  100 is `> SUDO FIGHT`, the rest even over eight); `bootPlan` (the intro laid out from distances to the
  centre line between the halves), `bootStill`, `bootPlanProblem` (the "intro" grammar as code); the
  `BOOT` runtime drawing on its own canvas over the board (code-drawn type and the dot font, no atlas),
  its sounds, Skip, Escape, a tap.
- `render/src/renderHtml.ts`: `board-area` has an id; `play()` at move 0 starts the intro and its end
  (or a skip) plays move 1 at once; `goTo` and `stop` cancel it; Play at the end now shows move 0 before
  replaying (it used to set the index without redrawing). The boast start fades the loser's side.
- `render/src/canvasFx.ts`: `CFX.fadeOutIn(rect, ms)` and `CFX.countIn(rect)`.
- `render/src/momentum.ts` / `capture.ts`: the gauge reads the winner at full once the match is won.
- `render/src/soundFx.ts`: `handshake` (a two-tone chirp) and `bootHit` (a hit and a rising chord),
  the same for every faction. `render/src/boastFx.ts`: the dot font's `>`, `BOAST_CLEAR_MS`.
- `render/src/bootSheet.ts` (new; `npm run boot-sheet`): all nine sayings over all four factions and a
  mirror match, two phone scenes, the still. EFFECTS.md: the "intro" category, "Match Boot as built",
  "End-of-match fixes".
- No engine, agent, card or economy file changed.

**Ran it:**
- `npx tsx progress/render/evidence/boot-check-s35.mjs <out> render/output video` (output
  `boot-check-s35.txt`): 53 checks, ALL PASS. Highlights: on `cortex-vs-swarm-seed6` the intro starts at
  the click, shows the seed's saying (ENGAGE) and both agents' lines, ends on its own at 2,601 ms, move 1
  follows at once and playback goes on; Escape, Skip and a phone tap skip at about 1 s with move 1 in
  79-134 ms; pause cancels it on move 0; no intro on open, a step or a resume at move 20; |< and Play,
  and Play at the end, play it again; reduced motion plays the still for 1,015 ms; the Cosmetics switch
  doesn't touch it; on a phone the board is scrolled into view. End of match: 167 (close win, winner
  below) and 183 (`aegis-vs-cortex-seed1`, winner above) particles on the loser's side after the lethal
  hit, 0 from 0.41 s into the boast; the gauge full toward the winner with "<loser> out of health".
  Every sheet scene lays out with no grammar problem.
- The first run of the check (scratch) caught the power-on in its recording; the committed run's
  recording dropped those frames (software rendering), so the power-on strip is from the first run, the
  typing strip from the committed one.
- The 16 sample replays and the 4 recorded ones regenerated: in all 20 the embedded match data changed
  only in the final frame's momentum (checked per file); `recorded-matches-s35.txt` reproduces s34's
  byte for byte. The FX, boast, pack-opening, first-time and skin sheets regenerated (they embed the
  changed canvas and sound sources; some were stale from earlier sessions).
- Saying odds over 200,000 seeds: `> SUDO FIGHT` 1.02%, each of the eight 12.3-12.4%.
- `npm test`: all six workspaces pass (1,035: render 574, +17); typecheck clean everywhere.

**Found on the way:** the close-win replay wasn't the only one ending on the loser "AHEAD":
`aegis-vs-cortex-seed1` did too. Play at the end jumped to move 0 without drawing it, so the first step
animated from the last board.

**Next render-lane slice:** boast slice 4 (the loadout picker), as the owner set; Match Boot slice 2
(sound and the phone) after the owner's notes on slice 1.

## 2026-10-20 — Session 36: victory boasts, slice 4 (the loadout picker)

Render session by the alternation rule: the last merged PR (#90) was the game lane's (session 53, the
agent's deck in the agent's play style). Owner feedback read: the answers to render session 35 keep
all 8 Match Boot calls and set the next render slices: boast slice 4 (the loadout picker), then Match
Boot slice 2. The newest entry (answers to game session 53, keep all 3) is the game lane's.

**Built:**
- `render/src/loadoutPicker.ts` (new): the owner page where an owner dresses one agent. The five slots
  the store keeps (victory boast, close-win boast, card back, avatar, arena) as a rail; each slot's
  tiles: the owner's items (free starter or bought), an item on sale the owner doesn't have as a locked
  "In the store · 300 credits" plate with the owner's balance, and the empty slot (saying what it
  plays). A tap on a boast tile previews it; Equip saves it. A preview board (the agent's deck's real
  units, its panel, a dimmed strip for the other agent) runs the replay's own `BOAST`, looping while in
  view, silent on repeats, sticky so it stays on screen. The close-win slot previews with the CLOSE WIN
  plate and the panel on 3 health. A live match shows a banner, and Equip shows the store's refusal.
  Card back, avatar and arena say plainly that none exist yet. A small SVG emblem per boast.
- The model (`LOADOUT_PURE_SOURCE`, shared by the page and the tests): `loadoutApply` (applies the
  store's answer for a choice), `loadoutPreview` / `loadoutTilePreview` (the store's boast rule),
  `loadoutSlotLine`, `loadoutSavedLine`, `loadoutGlyph`.
- `render/src/loadoutDemo.ts` (new; `npm run loadout -w @ai-tcg/render`): three real store states,
  each its own in-memory store on a fixed clock: a new Null owner (starter only); a Cortex owner that
  earned 303 credits in 34 real Lookahead matches (25 won), bought Boot Sequence and wears it, with Data
  Cascade as its close-win boast; a Swarm owner in a live match. For every choice in every slot the real
  `setLoadout` is called and its answer kept (new value or refusal message), then the slot is put back;
  the page applies those answers and decides none. No server endpoint exists yet (roadmap 2b step 3).

**Ran it:**
- `progress/render/evidence/loadout-picker-s36.txt`: each scenario's state, every tile and every store
  answer (e.g. `refused: the owner doesn't own "Boot Sequence"`, `refused: no loadout changes during a
  live match`). The page regenerates byte for byte.
- Browser check (`loadout-check-s36.mjs`, output `loadout-check-s36.txt`): 48 checks, ALL PASS, run
  three times. The equipped boast previews on open with no grammar problem and loops; the loop's
  repeats make no sound and a pass the viewer asked for does; a tap previews, Equip saves (toast, rail,
  state); a locked item has no Equip, shows its price and "you have 0", and previews marked "not owned";
  the close-win slot shows CLOSE WIN on 3 health, its empty tile the main boast; emptying the boast slot
  plays the deck's faction starter; the three empty kinds; the bought owner; the live owner's refusal
  with nothing changed; Escape ends a pass and the loop returns; on a phone no sideways scroll, the
  board stays at the top, a scroll restarts the pass and the plate lands on the board; reduced motion
  plays the still once, no loop. Stills `v2-s36-loadout-*.jpg`.
- Tests: render 587 (+13): the model; the preview against the store's own choice over 16 real recorded
  matches (main/close-win slot empty or set, health 3/5/6/18); the page data (every choice answered,
  owned/locked/empty, the refusals, every offered boast drawable and with an emblem, the same page
  every run, self-contained); and 300 random choices per scenario through the page's model and the real
  store, ending the same at every step. Mutation checks: treating a refusal as accepted fails 4 tests;
  ignoring the close-win slot in the preview fails 2. `npm test`: all six workspaces pass (1,070);
  typecheck clean.

**Found on the way:** the first browser check muted the sound it was testing (sound starts armed; the
button mutes it), and two plate checks raced a restart caused by Playwright scrolling to the tile; the
check now waits for the plate. The agent's random store id leaked into the page data (unused), so the
page differed run to run; dropped.

**Next render-lane slice:** Match Boot slice 2 (sound and the phone), as the owner set. The picker's
calls are in the checkpoint; it needs the game lane's loadout endpoint to save for real.

## 2026-10-23 — Session 37: the boast's win message ("<AGENT NAME> WINS"; CLOSE CALL first on a close win)

Render session by the alternation rule: the last merged PR (#93) was the game lane's (session 55, a
hardening pass). Owner feedback read: the 2026-10-21 entry asks every boast to end on a clear
"<AGENT NAME> WINS", a close win to show a close-call line first ("CLOSE CALL" or "CLOSE WIN", the
render lane's pick), the reduced-motion still included, "alongside Match Boot slice 2, or as its own
small slice". Built as its own slice. The newest entry (answers to game session 55, keep) is the game
lane's; the arena entry is for when arenas ship.

**Built (`render/src/boastFx.ts`):**
- The plate's main line is "<NAME> WINS" (`BOAST_WINS`): the name (`.boast-wn`) in the boast's colour,
  WINS (`.boast-wins`) in white, stamped 0.16 s after the name. The small line under it is the boast's
  name alone; "· VICTORY" and "· CLOSE WIN" are gone.
- A close win: `boastPlan(spec, geom, seed, { name, faction, close })` adds `close: BOAST_CLOSE_MS`
  (600) to the name mark and ends the plan 600 ms later (`plan.close`). The runtime opens the plate on
  `BOAST_CLOSE_LINE` ("CLOSE CALL", amber) alone and swaps to the winner's line after 600 ms. Every
  other beat keeps its time. The replay already passed `close` from the record; `play()` now hands it
  to the plan.
- Boot Sequence types the whole line ("<NAME> WINS"); its clicks start after CLOSE CALL.
- `boastStill`: the still also swaps (no motion) and holds 600 ms longer on a close win.
- Fit: a long name shrinks the whole line, measured by layout width (see below).
- `render/EFFECTS.md` ("The win message"), the loadout picker's comments.

**Ran it:**
- `progress/render/evidence/boast-check-s37.mjs` (from the s34 harness), output `boast-check-s37.txt`:
  637 checks, ALL PASS, run twice. 21 runs: the four recorded replays (the close win on desktop, a
  phone, reduced motion, and Escape during CLOSE CALL), the recordless sample, all six boasts forced as
  plain and close wins, Boot Sequence close on a phone, and the cosmetics switch. New checks W (the line,
  the space, WINS's colour, no old words) and X (CLOSE CALL first and alone, the swap at about 0.6 s,
  the result at about 3.6 s). 15 stills kept.
- Tests: render 603 (+16). `npm test`: all six workspaces pass (1,105); typecheck clean. Mutation
  checks: 6, 7 and 2 failures for the three mutations named in the checkpoint.
- All 16 sample replays, the 4 recorded replays, the FX, boast, Match Boot and skin sheets and the
  loadout picker regenerated. The embedded match data is unchanged; `npm run recorded` prints the same
  as `recorded-matches-s35.txt`, and the picker's `loadout-picker-s36.txt` is unchanged.

**Found on the way:** the first browser run failed on a phone: WINS's stamp starts at scale 1.5, and
the fit loop's `scrollWidth` counted the scaled box, so names shrank more than needed. Now measured by
layout width plus margins (the first try missed the cursor's margin: Boot Sequence's plate overflowed
by 3 px, also caught by the check). The stills then showed "Lookahead-AegisWINS" with no space: an
inline block drops its leading space. Fixed with `white-space: pre`, and a check now measures the gap.

**Next render-lane slice:** Match Boot slice 2 (sound and the phone), as the owner set.

## 2026-10-24 — Session 38: Match Boot, slice 2 (sound and the phone)

Render session by the alternation rule: the last merged PR (#95) was the game lane's (session 56, the
owner API). Owner feedback read: the 2026-10-23 entry keeps all 8 calls on the win message and sets
the next render slice, Match Boot slice 2 (sound and the phone); the 2026-10-20 entry's call 8 left
"music starts after" to this slice. The newest entry (answers to game session 56, and a question on
the minimum deck size) is the game lane's; the render lane doesn't touch the shared files, so it is
left for game session 57.

**Built:**
- `render/src/soundFx.ts`: `SND.play` takes `{ at, pan, group }` (a start time on the audio clock, a
  fixed pan, a bus); a scheduled sound skips the repeat gap. `SND.group()` makes a bus on the master
  that can be cut in a 30 ms fade. Two recipes: `bootOn` (the intro's own power-on: a deeper thump,
  a 50/100 Hz degauss hum, a crackle, the flyback whine) and `bootRoot` (the rare saying: a glitch and
  three square blips climbing C5-G5-C6). Boot Sequence keeps `crt`.
- `render/src/musicFx.ts`: `MUS.startAfter(sec)`: the bus to silence, nothing queued, the progression
  from step 0 at the end, fading in; `startAfter(0)` starts it now. Switching the music on, or a volume
  change, during the wait waits too. The wait is remembered on the wall clock while the music is off.
- `render/src/matchBootFx.ts`: the plan's sounds are `bootOn`, the clicks, `handshake`, `bootHit`, and
  `bootRoot` 60 ms after the hit for `> SUDO FIGHT`; the `duck` mark became a `music` mark covering the
  whole intro (the checker refuses one that doesn't). The runtime's lookahead scheduler (25 ms tick,
  150 ms ahead) queues each sound at its exact audio time through one group at pan 0; a skip, pause or
  jump cuts the group and starts the music. The agent line breaks after `LOADING AGENT:` into two rows
  when the board's width squeezes one row under 15 px and two rows come out a fifth bigger (up to
  20 px); both halves alike, typed as one line; the checker refuses mismatched rows. Skip is at least
  44 x 88 px on a coarse pointer. Stats gained the queue (`sched`, `late`, `planned`, `audioBase`) and
  the line layout (`rows`, `fs`).
- `render/src/bootSheet.ts`: a phone scene with a long name (two-row lines); slice 2's note.
- `render/EFFECTS.md`: "Slice 2 (render session 38): sound and the phone".

**Ran it:**
- `progress/render/evidence/boot-check-s38.mjs` (new harness: the pages served over local HTTP, the
  page's own output recorded by an AudioWorklet on the limiter, each block stamped with its frame),
  output `boot-check-s38.txt`: 42 checks, ALL PASS, run twice. A: all 27 sounds queued ahead at their
  exact times; 22 onsets heard within 0-3 ms of their planned distance from the others (the 4 clicks
  under the chirp can't be separated); left/right -0.006 dB; peak 0.41; the music 0 steps and bus 0 at
  2.35 s, 7 steps and bus 0.29 after. B: a 100 ms main-thread stall mid-typing: all 20 typing clicks
  still within 1 ms; slice 1's page (from HEAD) under the same stall: 1 of 16 click intervals on the
  36 ms grid, this page 19 of 19. C/D/D2: Escape and pause cut the sounds (silence 40 ms after a pause,
  music off) and start the music at once. E/F: effects muted; music switched on mid-intro waits. G/H/I:
  phone portrait (two rows at 20 px; Skip 88 x 44; no sideways scroll; cold start, all sounds in
  time), landscape (one row, 15 px), desktop (one row). J: the still. K: the rare flourish (+5.8 dB in
  its band against FIGHT) and the sheet's phone-rows scene.
- Stills: `v2-s38-phone-rows.jpg`, `-phone-saying`, `-phone-landscape`, `-desktop-lines`,
  `-sheet-rare`, `-sheet-phone-rows`.
- Tests: render 612 (+9): the music mark and no duck; the rare flourish only for the rare saying; the
  two-row layout (both halves, bigger, typed as one line, desktop never); two new grammar breaks; the
  new recipes (faction-independent; the power-on deeper than `crt`, with a hum `crt` lacks; the blips
  climbing an octave); `MUS.startAfter` (silent, nothing queued, step 0 at the end; a skip; a volume
  change and switching on during the wait; a second intro); `SND.group` (exact start times, pan 0,
  through the group, no repeat drop; the cut's 30 ms ramp). Mutation checks: ignoring `at` fails 1
  test, not holding the music's queue fails 3, never breaking into rows fails 2. `npm test`: all six
  workspaces pass (1,129); typecheck clean everywhere.
- All 16 sample replays, the 4 recorded replays and every sheet/page that embeds the sound runtime
  regenerated. Before the change, regenerating reproduced every committed page byte for byte except
  `first-time.html` and `pack-opening.html`, which carry random ids from the store (already true);
  those two are regenerated here because they embed `SND`.

**Found on the way:** the first measurement used a ScriptProcessor tap, which runs on the main thread:
the stall test corrupted its own recording, and its blocks arrive late against their clock stamps.
Switched to an AudioWorklet (audio thread), which needs the page served over HTTP. The click band had
to move from a first-difference high-pass to a 2.2 kHz band-pass: the power-on's 7.8 kHz flyback whine
swamped the clicks. And the first `bootRoot` was only 1.8 dB above the hit's chord in its band, too
quiet to notice; raised (squares 0.035 -> 0.08) to +5.8 dB.

**Next render-lane slice:** none set by the owner. Suggested: move the boasts' sounds onto the same
audio-clock scheduling (they still fire from the frames), or the next item the owner names.

## 2026-10-26 — Session 39: the victory boasts' sounds on the audio clock

Render session per the alternation (the last merged PR, #97, was the game lane's). The slice the owner
set in the 2026-10-26 entry (answers to render session 38, keep all 8): move the victory boasts' sounds
onto audio-clock scheduling, the on-time fix the intro got.

**Built:**
- `render/src/soundFx.ts`: `SND.sequence(list, o)`, Match Boot's lookahead scheduler moved into `SND`
  so the intro and the boasts share one: every 25 ms it queues each planned sound up to 150 ms ahead at
  its exact audio time, tied to the run's own start; one too late to queue within 120 ms is dropped,
  never played late; all through one group (`cut()` silences ringing and queued; `stop()` only stops
  queueing). Items may be `run(at)` callbacks instead of sounds. The listeners now hear a sound's `at`.
- `render/src/matchBootFx.ts`: its own scheduler replaced by `SND.sequence` (pan 0, same stats: `sched`,
  `late`, `planned`, `audioBase`, `fired['sound:...']`).
- `render/src/boastFx.ts`: `BOAST.play` hands the plan's sound marks, and the music holds (`duck` marks)
  as `run(at)` items, to one sequence in the winner's voice; the frames fire neither any more. A skip or
  a cancel cuts the sounds; the boast's own end ticks once more and lets the sting ring. Stats gained
  `sched`, `late`, `planned`, `audioBase`.
- `render/src/musicFx.ts`: `MUS.duck(at)` and `MUS.duckHold(sec, at)` take an audio time: a sound queued
  ahead dips the music when it plays, the sting's hold starts with the sting, and a dip queued just
  before a hold neither cancels nor lifts it. The immediate path (the match's own sounds) is unchanged.
- `render/src/loadoutPicker.ts`: found on the way, the preview's sound proxy only forwarded `play`, so
  the change would have silenced the picker's previews entirely; it now forwards `sequence` on a pass
  the viewer asked for and returns none on the loop's repeats.
- `render/EFFECTS.md`: the boasts' section, "Sound on the audio clock (render session 39)".

**Ran it:**
- `progress/render/evidence/boast-check-s39.mjs` (new harness; the page's own output recorded as in
  session 38), output `boast-check-s39.txt` (+ `.json`): 65 checks, ALL PASS, run twice with the final
  harness (and twice more before its last calibration fix). A: each of the six boasts on the sheet: all
  planned sounds queued at their exact times, 130-150 ms ahead, none late; 53 of 75 onsets stand out in
  the recording and each lands within 3 ms of the same sound played alone (the rest start under a louder
  sound); no clipping. B: the four recorded replays stepped into the lethal move (about 50 fps): every
  sound at its planned time; the same pages from before this session, firing from the frames: median
  11-19 ms off, up to 49 ms. C: a 150 ms main-thread stall during Boot Sequence's typing: 0 ms off; the
  old sheet, same stall: up to 122 ms late, 11 sounds more than 20 ms. D: Escape cuts once, nothing queued
  past the lookahead, silence heard 70 ms after. E: the boast's own end: no cut, the sting heard ringing
  on. F: effects muted: plays and ends, nothing queued. G: reduced motion: the sting at 0. H: music on:
  each hold queued ahead and starting with its sting (0.0 ms apart on the audio clock), the music at
  0.55 0.3 s into the sting; with effects muted no hold. I: the loadout picker: the loop's repeats queue
  nothing; a tapped pass queues all 8 sounds at their times.
- Match Boot re-checked on the regenerated pages: `boot-check-s38.mjs` against them (and slice 1's page
  for its before/after), output `boot-check-s38-rerun-s39.txt`: 42 checks, ALL PASS, as in session 38.
- Tests: render 645 (+33): `SND.sequence` against the fake AudioContext (exact times within the
  lookahead, a 100 ms stall, the late drop, sound switched on late, pan by x or fixed, cut and stop,
  onQueue); the music's timed dips (a queued sound dips at its time, the immediate path unchanged, a hold
  queued ahead and the dips around it); the boast runtime run against a fake page (every boast's sounds
  and holds go to one sequence, the frames play none, each frame ticks it, skip and cancel cut, the end
  stops without a cut, the still's one sound); no boast plans two sounds of one kind inside the repeat
  gap (every boast, two layouts, three seeds, plain and close win, and the still); the picker's proxy.
  Mutation checks: frame-fired sounds fail 6, always cutting or never cutting fail 1 each, no frame tick
  fails 2, no start time fails 6; in the sequencer, never dropping late fails 2, ignoring `at` 2, no
  lookahead limit 4, a stop that doesn't stop 1; in the music, the listener dropping `at` 1, a dip lifting
  a queued hold 1, a hold ignoring `at` 1. `npm test`: all six workspaces pass (1,175); typecheck clean.
- Before the change every committed page regenerated byte for byte (except `first-time.html` and
  `pack-opening.html`, random store ids, as before). After it, the 26 pages that embed the sound runtime
  regenerated; the embedded match data is identical in every replay.

**Found on the way:** the picker's proxy (above). The music's dip followed every sound as it was
*queued*, so with a 150 ms lookahead it would have come before the sound; fixed by passing `at`. The
harness's first heard-timing check compared onsets to each other, which flagged the rocket's whistle
(a 50 ms swell) as 12 ms late; calibrating each kind alone fixed that, but the first calibration played
them 0.6 s apart and the modem's and the sting's tails ran into the next slot (a range of -12 to 10 ms,
meaning nothing); 2.5 s apart, three times each, readings that don't rise out of silence left out, the
ranges are within 3 ms and the whistle is held to the same 3 ms as the rest.

**Next render-lane slice:** none set by the owner. Candidates: the boasts' Skip finger-sized on touch
screens like the intro's (the owner's slice 2 call 7 named it as able to follow), or the next item the
owner names.

## 2026-10-28 — Session 40: hardening pass (the boast's halo clip, the loser's clear by reach, the boasts' Skip on a touch screen)

Render session per the alternation (the last merged PR, #99, was the game lane's session 58). Owner
feedback read: nothing new for the render lane since the answers to render session 38 (handled in
session 39); the render-39 checkpoint awaits the owner. No slice was set, and the lane had gone twenty
sessions without a hardening pass (the last was session 19) with a long debt list, so this is one: no
new features, three debt items raised to bar, each proven in the browser against the pages from before.

**Built (fixes, not features):**
- `render/src/boastFx.ts`, the halo clip: everything the boast draws itself (`drawTop`: the veil, the
  CRT screen, the shapes, the sprite pieces and their halos) is clipped to the winner's side, 2 px over
  (the checker's tolerance). A sprite piece's halo (`drawGlow`, `at.s x (0.75 + glow x 0.5)`, up to 1.25 x
  its size) reached past the box `boastPlanProblem` counts (the sprite, `at.s / 2`). Measured over the
  test layouts: up to 70 px past the side's edge at a pulse's peak (Hive Burst), 14 px at rest. The debt
  list said it "has never shown up as loser-side light in a browser check"; this session's check found
  it does: on the boast sheet, Shield Slam lit 139-379 pixels on the loser's own side (2,500-4,000 past
  the winner's side), Hive Burst and Void Collapse 90-130 past it. Now 0 for all six.
- `render/src/boastFx.ts`, `boastPlanProblem` caps a plan's length: the spec cap (3.2 s) or the still's
  (1 s), plus the close-call hold (0.6 s) on a close win. Only specs were capped before.
- `render/src/canvasFx.ts`, the loser's clear by reach: `fxParticleReach(p)` (pure, exported) is how far
  a particle lights pixels from its centre over its life, read from `drawP` per kind (a sprite's turned
  square at its larger size and stretch, a spark's 44 px tail, a square's or an ember's 3 x size, a mote's
  4 x, a shard's farthest corner, a bloom's glow at its widest). `fadeOutIn` and `countIn` use it, so a big
  smoke sprite centred just outside the loser's rect is caught; before, only its centre counted.
- `BOAST_CSS`: `@media (pointer: coarse) { .boast-skip { min-height: 44px; min-width: 88px; ... } }`, the
  rule the intro got in session 38, now on the class both Skips share (the intro's moved out of
  `MATCH_BOOT_CSS`). The owner's session-38 call 7 named the boasts' Skip as able to follow.
- Tests: `test/boastPage.ts` (the fake page from `boastSound.test.ts`, shared, its CFX kit now drawing
  nothing and its plugin exposed), `test/boastClip.test.ts` (+8: the halo reaches past the checker's
  box, which is why; for each of the six boasts every frame's `drawTop` opens with save, the side's rect,
  clip, before anything is drawn, and restores after the last; the still too), `canvasFx.test.ts` (+2:
  each kind's reach; every particle kind the runtime makes has one, the drawing lines it was read from
  are pinned, `fadeOutIn` and `countIn` use it), `boastFx.test.ts` (+1: the Skip rule on both Skips; and four new breaks
  the checker must catch: the length cap). Mutation checks: no clip fails 7 of 8, no restore fails 6.

**Ran it:**
- `progress/render/evidence/hardening-check-s40.mjs`, output `hardening-check-s40.txt`: 19 checks, ALL
  PASS, run twice, against the pages from before this session for the before/after. A: each boast on the
  sheet, the effects' top canvas read every third frame for the whole boast: 0 lit pixels past the
  winner's side (before: as above). B: a 160 px sprite centred 70 px outside a cleared rect is cleared
  and nothing is lit inside the rect; a control 300 px out stays (before: not cleared, 8 lit pixels
  inside). C: an emulated phone (coarse pointer): a boast's Skip 88 x 44 px (before 69.9 x 23), the
  intro's still 88 x 44; desktop unchanged at 69.9 x 23.
- The session-39 boast check and the session-38 boot check re-run on the regenerated pages (the clip
  and the reach must not touch the sound or the intro): ALL PASS for both
  (`boast-check-s39-rerun-s40.txt`, `boot-check-s38-rerun-s40.txt`; their before/after parts, which
  need the older pages, were not re-run).
- `npm test`: all six workspaces pass, render 656 (+11); typecheck clean.
- Before the change every committed page regenerated byte for byte (except `first-time.html` and
  `pack-opening.html`, random store ids, as always; not committed). After it, the 25 pages that embed the
  boast or the effects runtime regenerated; the embedded match data is identical.

**Next render-lane slice:** none set by the owner. Candidates: the next item the owner names; or the
next debt item worth a slice (a "tap to skip" hint; the browser checks in CI, which needs Chromium in
the test workflow, an owner call).

## 2026-10-30 — Session 41: the CI browser check

Render session per the alternation (the last merged PR, #101, was the game lane's session 59). Owner
feedback read: the answers to render session 40 (keep all 3) and "yes to the CI browser check", with
the OK to change `.github/workflows/test.yml` and `auto-merge.yml` for this check and the wait only, on
the condition that the auto-merge wait is lengthened in the same change. The game lane's set-A entry
is the game lane's own (its next session ships it); not touched here.

**Built:**
- `render/src/ciPages.ts` (`npm run ci-pages -w @ai-tcg/render -- <dir>`): builds the boast sheet and
  one replay (Cortex vs Swarm, seed 6) from the current source into a directory. Today both are byte for
  byte the committed pages.
- `render/ci/browser-check.mjs` (`npm run browser-check -w @ai-tcg/render`): with no argument it builds
  the pages into a temp dir, serves them over local HTTP and drives them in a headless browser. 23
  checks: A, the six boasts at `full` (winner below) and `top` (winner above), nothing lit past the
  winner's side (the session-40 method: the top canvas every 3rd frame, every 2nd pixel, more than 3 px
  out counts), three pages at a time; B, Skip sizes (boast and intro on a phone at least 88 x 44, the
  boast's on a desktop under 44 tall); C, the intro (plays with no problem and the saying ENGAGE, one row
  on a desktop, the music waiting at 1.5 s, ends by itself; Escape skips and the music starts; a phone's
  two rows and no sideways scroll; reduced motion's still). Any page error fails. Playwright is found by
  `PW_CORE`, then the installed package, then the container's copy; `PW_CHANNEL=chrome` uses Chrome.
  Plain JS on purpose: tsx adds helpers to functions that `page.evaluate` can't carry into the page.
- `.github/workflows/test.yml`: a last step installs playwright-core 1.63.0 into `$RUNNER_TEMP` (no
  repo dependency, no lockfile change) and runs the check on the runner's Chrome (downloads Chromium only
  if the image has no Chrome). `auto-merge.yml`: the wait for checks from 30 polls to 72 (5 to 12 min).
- `render/test/ciPages.test.ts` (+3): the pages are the two the check opens; every scene id and side id
  the check reads exists on the sheet; the replay has the intro's hooks. It deliberately doesn't compare
  with `render/output/`, so a game-lane card change can't fail the render's tests.

**Ran it:**
- `progress/render/evidence/ci-browser-check-s41.txt`: 23 passed, ALL PASS, pages 0.8 s, browser 19.9 s
  (one boast at a time it was 56.7 s). Run three times, with the container's playwright and with
  playwright-core installed the way CI does (`PW_CORE`); same result.
- Mutation: `boastFx.ts` without the session-40 clip and without the coarse-pointer Skip rule, then
  reverted: 8 FAIL (`ci-browser-check-s41-mutant.txt`): Shield Slam, Hive Burst and Void Collapse in
  both positions, both phone Skips (84.8 x 27). Winner above, Shield Slam lit 893 pixels on the loser's
  own side, more than the 148 with the winner below (session 40 only measured below).
- CI baseline from the last 8 PR runs of `test`: 1 min 45 s to 2 min 45 s. The first run with the
  check is this PR's; its time wasn't known when this was written.
- `npm test`: all six workspaces pass, render 659 (+3); typecheck clean.

**Next render-lane slice:** none set by the owner. Candidates: a replay's end (the lethal beat, then
the boast) in the CI check; a "tap to skip" hint; the next item the owner names. Next render session:
read this PR's `test` run and record the step's CI time and Chrome version here.

## 2026-10-30 — Session 42: one replay's end in the CI browser check; a pinned Chromium

Render session per the alternation (the last merged PR, #103, was the game lane's session 60). Owner
feedback read: the answers to render session 41 (keep calls 1, 3, 4; change call 2: download a pinned
Chromium each run, with the OK to change `.github/workflows/test.yml` for that only) and the slice set:
add one replay's end (the lethal beat, then the boast) to the CI check, in the same slice as call 2, and
report the CI step's time and the whole test run's time on that PR's own CI run. The game lane's entries
(S60 keep all 3; balance job 2 next) are the game lane's; not touched.

**Session 41's PR on CI (owed from last session):** run 246 for PR #102, the step "render browser check
(headless Chrome)" 35 s (the check's own report: pages 0.9 s, browser 32.9 s), the whole job 3 min 35 s
(the 8 PR runs before it: 1 min 45 s to 2 min 45 s). The check didn't print the browser's version, so
the runner's Chrome version isn't known; it does now.

**Built:**
- `render/ci/browser-check.mjs`, section D (18 checks), on the same replay (Cortex vs Swarm seed 6, a
  Cortex win, no record). Stepped from the second-last move into the lethal one, on a desktop and a
  phone, everything read on the page's own frames: the lethal flash, then the boast at least half its
  900 ms lead later; the boast is the winner's faction starter (Data Cascade), in full, no layout
  problem, the plate "Lookahead-Cortex WINS"; the loser's side, panel and hand dim to 0.7 (their lowest
  point through the boast), the winner's panel lit, Skip inside the winner's side; the lethal attack's
  smoke is on the top canvas off the winner's side before the loser's clear has run (so the clear is
  shown to have work to do), and from 60 ms after it nothing is lit past the winner's side; the loser's
  side's DOM is unchanged through the boast; the result line is held through it and "GAME OVER:
  Lookahead-Cortex WINS" lands as it ends (0-1 ms after). Plus: Escape at 1 s ends the boast and lands
  the result at once; a jump to the end shows the result at once with no boast. The four runs go at once
  (each its own context). The check prints the browser and its version.
- `.github/workflows/test.yml`: the step is now "render browser check (pinned Chromium)". It installs
  playwright-core 1.63.0 outside the repo as before, then `install --only-shell chromium` into
  `$RUNNER_TEMP/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH`), so every run downloads the build that version
  pins and nothing from the image's caches is used. A one-line launch test; only if it fails,
  `install-deps chromium` (the image's libraries are there for its own Chrome today). `PW_CHANNEL`
  stays in the script for a local run only; CI no longer sets it. Nothing else in the file changed.
- `render/test/ciPages.test.ts` (+3): section D's hooks exist on the replay (scrubber, turnbar,
  match-data, `fx-lethal-overlay`, `GAME OVER: `, `boast-who`, `boast-panel`, the side/hud/hand ids);
  the replay ends in a win with no record (so a game-lane change that makes seed 6 a draw is named in
  vitest, not as a missing boast in CI); the check's starter map equals `STARTER_BOASTS` and
  `boastFromRecord`, and its `LEAD_MS`/`CLEAR_MS` are `BOAST_LEAD_MS`/`BOAST_CLEAR_MS`. The sheet test
  now reads the six boasts from the check's `BOASTS` list (the new quoted ids would have confused it).

**Ran it:**
- `progress/render/evidence/ci-browser-check-s42.txt`: 41 passed, ALL PASS, pages 0.8 s, browser 25.2 s
  (was 20 s with 23 checks). 8 runs in a row, all pass.
- Under load (`ci-browser-check-s42-load.txt`): two whole checks at once on 4 cores, 3 rounds, 6 of 6
  pass. This is what found the first version's three flakes, each fixed before the evidence run: (1) the
  spill count started on the boast's wall clock, but the loser's clear runs on the effects' clock
  (canvasFx caps a frame's step at 50 ms), so under load the lethal smoke was still fading at 300-540 ms
  of boast time; the check now keeps the effects' clock itself; (2) the dim was read once at 400 ms and
  caught the 300 ms CSS fade mid-way (0.72); now its lowest point; (3) the lead bound at 800 ms failed at
  612-774 ms because the lethal flash, on the effects' frame timer, lands late under load while the
  boast's setTimeout doesn't; now half the lead (a boast that doesn't wait measures 0 ms).
- Mutants (`ci-browser-check-s42-mutants.txt`), each on `renderHtml.ts`, reverted after: no loser's
  clear as the boast starts: 2 FAIL (11,300-13,905 pixels lit past the side); no result hold (no boast
  plays): 15 FAIL; no lead after the lethal beat: 4 FAIL (0 ms, and the lethal smoke not yet cleared).
- The pinned download itself couldn't run here (the container can't reach Playwright's download host).
  The session runs used the container's copy, the same build 1.63.0 pins: chromium-headless-shell 1243,
  Chromium 153.0.8010.12. The PR's own CI run is the first real download; its figures go in the PR
  description.
- `npm test`: all six workspaces pass, render 662 (+3); typecheck clean.

**Next render-lane slice:** none set by the owner. First, read this PR's `test` run (the step's time,
the whole run's time, the Chromium version printed) from its description and copy them here.
Candidates: a close win (CLOSE CALL first) on a real board in the CI check, or a recorded loadout boast;
a "tap to skip" hint; the next item the owner names.

## 2026-10-31 — Session 43: the "tap to skip" hint

Render session per the alternation (the last merged PR, #105, was the game lane's session 61). Owner
feedback read: the answers to render session 42 (keep all 4) and the slice set: a "tap to skip" hint.
The two 2026-11-01 entries ("Season 0 is the MVP", and the website as the 2026-10-05 desktop spec,
trimmed) set the render lane's list after this slice: the website, in the order given. Not started
here; it is the next render session's. The game lane's entries (ship NA12 and CS7; the Season 0
endpoints; the Season 0 checklist in the shared roadmap) are the game lane's; not touched (the render
lane doesn't write `progress/roadmap.md`).

**Session 42's PR on CI (owed from last session), from PR #104's description:** test run #250, the step
"render browser check (pinned Chromium)" 36 s (playwright-core install 1 s; Chrome Headless Shell
153.0.8010.12, playwright chromium-headless-shell v1243, about 4 s to download with FFmpeg; the launch
test 2 s and passed, so `install-deps` didn't run; the check: pages 0.9 s, browser 28.9 s, 41 passed).
The whole `test` job 3 min 21 s (session 41's: 35 s and 3 min 35 s). The browser printed
`chromium 153.0.8010.12`.

**Built:**
- `render/src/skipHint.ts`: one small line under the Skip button of a boast and of the intro, right-
  aligned with it: "or tap anywhere" on a touch screen (pointer: coarse), "or click anywhere · Esc" with
  a mouse. Placed by a pure rule (`skipHintPlace`): under the button, inside the button's own box (the
  winner's side for a boast, the board for the intro, less a 4 px margin) and clear of what it must
  avoid (the boast's planned name plate; the intro's two agent lines and its saying); if it can't, it is
  left out and the button stays. Once the viewer skips anything on the page (a boast or the intro, by
  tap, click, Escape or the button), it isn't shown again on that page; a cancel (a jump, a restart)
  or a boast's own end isn't a skip. The button's `aria-label` carries the words; the hint is
  `aria-hidden`. It fades with the button. The source rides inside `BOAST_PURE_SOURCE`, so every page
  with a boast or the intro carries it with no other wiring; the CSS inside `BOAST_CSS`.
- `boastFx.ts` and `matchBootFx.ts`: each shows the hint after placing its Skip, marks it seen on a skip,
  and reports `hint` / `hintSeen` in its stats. `loadoutPicker.ts`: hides the hint with the Skip (its
  preview loops).
- `render/ci/browser-check.mjs`, section E (20 checks, 61 in all): all 30 boast-sheet scenes show the
  hint under Skip, inside the winner's side, with the desktop words (and a cancel doesn't count as a
  skip); four scenes played to their end (Shield Slam full, Boot Sequence above, Hive Burst and Void
  Collapse on a phone): the words for the pointer, the button's label, at least 11 px (12 on a phone),
  clear of the name plate once it shows, gone with Skip at the end; the replay's intro on a desktop and a
  phone: the hint inside the board; Escape (desktop) or a tap (phone) skips it, the hint goes, and the
  boast at the replay's end then shows Skip and no hint.
- Tests (+15, render 677): `render/test/skipHint.test.ts` (the words; the placement rule's edges: too
  wide, too low, touching the plate, just clear, nothing to place; every page's sources carry it; the
  loadout picker hides it; on the boast's fake page: shown under Skip inside the side and clear of the
  plate, the tap words, gone at the end, not again after a tap, Escape counts and a cancel doesn't, the
  still shows it, a side too short drops it). `ciPages.test.ts` (+2): section E's words are the
  render's own; the sheet has the 30 scenes section E counts. The boast's fake page (`boastPage.ts`)
  now places an element it made where its style puts it, removes a removed element, and has a pointer
  query.

**Ran it:**
- `progress/render/evidence/ci-browser-check-s43.txt`: 61 passed, ALL PASS, pages 0.7 s, browser 34.5 s
  (was 25 s with 41 checks).
- Mutants (`ci-browser-check-s43-mutants.txt`), each reverted after: the intro's skip not marking the
  hint seen: 4 FAIL; the boast showing no hint: 9 FAIL; the boast's Skip moved to the bottom of the
  winner's side (the hint then has no room under it and is dropped): 10 FAIL (one of them D's "Skip on
  the winner's side" on a phone). The mutants ran before the hint's type went from 10 to 11 px and its
  backing from 0.62 to 0.86 (the first desktop still read weakly over the card art); the final run is
  the one above.
- Stills: `progress/render/evidence/v2-s43-hint-{boast,intro}-{desktop,phone}.jpg`.
- Before the change every committed page regenerated byte for byte; after it, the 25 pages that embed
  the boast or the intro (16 replays, 4 recorded, the boast, boot, FX and skin sheets, the loadout
  picker) regenerated; the embedded match data is unchanged in every one.
- `npm test`: all six workspaces pass, render 677 (+15); typecheck clean.

**Next render-lane slice:** the owner's Season 0 list, item 1 (the 2026-11-01 entries): the desktop
website to the 2026-10-05 spec and `render/reference/owner-web-mockup.html`, starting with the site
layout (the glass sidebar and top bar) and the full pages, built against `server/OWNER_API.md`. Read
which endpoints exist first; where one is missing, say so in notes-for-owner.md and build a page that
doesn't need it.

## 2026-11-01 — Session 44: the owner website, first slice (sign-in, the shell, Settings -> Play)

Render session per the alternation (the last merged PR, #107, was the game lane's session 62). Owner
feedback read: the answers to render session 43 (keep 1, 3, 5; call 2 "remember on the account in the
website"; call 4 "the intro says click the board"), and the Season 0 list (2026-11-01, both entries): the
render lane's item 1 is the desktop website to the 2026-10-05 spec and `owner-web-mockup.html`. No
CRITICAL item in the render debt list.

**Session 43's PR on CI (owed):** PR #106, the `test` job 3 min 1 s, passed; auto-merge 3 min 14 s.

**Built:**
- **Call 4 (the intro's hint):** `skipHint.ts` has the intro's own words, "or click the board · Esc" with
  a mouse and "or tap the board" on a touch screen (a tap on the playback controls doesn't skip the intro,
  so "anywhere" wasn't true there either). `skipHintShow(..., 'board')` from `matchBootFx.ts`; boasts keep
  "or click anywhere · Esc" / "or tap anywhere". CI check section E and its vitest twin updated.
- **The owner website** (`render/src/site/`):
  - `siteApi.ts`: the client for `server/OWNER_API.md` (every endpoint that exists today: session,
    play settings, deck choice, faction lock, active deck, play style, rebuild and its job). Browser-safe;
    refusals are `SiteApiError(status, the server's words)`, 0 when nothing answered.
  - `siteModel.ts`: pure logic, tested: the sidebar (the spec's order; Tournament greyed "Soon"), hash
    routes (`#/settings`; unknown is Home), System/Light/Dark, the agent's status, "which deck plays",
    the rebuild panel's state, a finished build in words, refusals in words, and `PAGE_WAITS`: what each
    page without an endpoint waits on, in OWNER_API.md's words.
  - `siteClient.ts` (bundled inline by esbuild): sign-in (the cosmic title colours, no card fan yet); the
    glass sidebar with the agent card (avatar from `avatar.ts`, play style, Ready / In a match); the top bar
    (title, theme, account menu with Sign out); Home with My agent and Deck panels; **Settings -> Play,
    complete:** who picks the deck, faction lock (with the API's `activeDeckFits` said in words), saved
    decks (pick one to force it; incomplete decks refused with why), "Rebuild now" (confirm dialog when
    up to date; the job polled every 1.5 s while it runs, then the build summarised), play style per agent,
    and Display -> Theme; Connect agent lists the agents. Collection, Store, Agent match, Watch live and
    Stats say plainly what they wait on. Confirmations are centred dialogs; refusals are toasts in the
    store's words; a 401 anywhere returns to sign-in. The session token lives in sessionStorage (the tab).
  - `sitePage.ts`: the self-contained page (system fonts, inline CSS/JS, no external request; reduce
    transparency/motion rules; narrow windows fold the sidebar to icons). `render/output/site/index.html`.
  - `siteHost.ts`: serves the page at / and passes /api through to the owner API unchanged (one origin,
    as OWNER_API.md assumes; the owner API serves only /api). CSP: own origin only.
  - `siteDemo.ts`: a fresh season database, the game lane's owner API (its code, read-only) and the host:
    `npm run site-demo -w @ai-tcg/render`, sign in as nova / "a long demo password".
- Tests (+19, render 696): `render/test/site.test.ts` (model, page self-containment, host + client over
  the real owner API: sign-in, settings, a rebuild to done, refusals, the API down = 502, no server = 0).

**Ran it:**
- `progress/render/evidence/site-check-s44.txt`: 32 browser checks against the live demo, ALL PASS
  (sign-in incl. a wrong password; the shell; a real rebuild job polled to a 40-card deck; the confirm
  dialog; faction lock's mismatch; forcing a deck and handing it back; a play style change; the theme
  incl. System following the computer; reload stays signed in; sign-out; a revoked token back to sign-in;
  a 700 px window; no page errors; no request leaves the origin). Stills `v2-s44-site-*.jpg`.
- Found on the way: `#/constructor` routed to a non-page (the `in` check saw the prototype): fixed, tested.
  The first browser run caught the "Last build" summary reading a stale job copy: fixed.
- Mutants (reverted): the host not forwarding Authorization (3 FAIL); the "can't reach" wording (1 FAIL).
- `progress/render/evidence/ci-browser-check-s44.txt`: 61 passed, ALL PASS (section E has the intro's new
  words on desktop and phone).
- Pages regenerated: the 25 that embed the boast or the intro (the hint source), plus `pack-opening.html`
  and `first-time.html` (random store ids, and the game lane's session-62 card text), which with
  `fx-sheet.html`/`skin-sheet.html` were owed per the owner's answer 3 to game session 62.
- `npm test`: all six workspaces; typecheck clean.

**Not done (named):** owner call 2 (the hint remembered on the account) needs an account-settings endpoint
that doesn't exist yet: raised in notes-for-owner. No widget board, liquid background, title card fan,
credits/pack points, notifications or auto-play yet: each waits on an endpoint or a later Season 0 item.

**Next render-lane slice:** Season 0 item 2, the look: the liquid WebGL background (Glacier default, the
other colours and the two plain ones, low resolution, about 30 fps, paused when hidden, still under reduce
motion) behind the existing glass, and the background picker in Settings -> Display (kept in the page until
the account endpoint exists). Then the widget board (item 3), as the game lane's endpoints land.

## 2026-11-01 — Session 45: the look (the liquid WebGL background and its picker, saved to the account; who am I; the wallet)

Owner feedback read: the answers to render session 44 keep all 6 calls and set this slice (Season 0 render
item 2, the look). The game lane's session 63 built the endpoints the last log asked for (`GET /api/me`,
`GET`/`PATCH /api/account/settings`, `GET /api/wallet`), so this slice also saves the theme and background to
the account (call 5), shows the display name and Settings -> Admin, and puts the wallet in the top bar. No
CRITICAL item in the render debt list. Not a hardening pass: the owner set the slice.

**Session 44's PR on CI (owed):** PR #108, the `test` job 3 min 52 s, passed; auto-merge 4 min 8 s.

**Built:**
- `render/src/site/siteLook.ts` (pure, tested): the eight backgrounds (the mockup's colours, unchanged; the
  account settings' ids and order), `drawnTheme` (plain always dark), `liquidColours` (light/dark blend),
  `easeDarkness` (time-based), `stillGradient` (swatches; the background before the first frame or with no
  WebGL), the pacing (`LIQUID_SCALE` 0.3, `LIQUID_FRAME_MS` 28, `liquidPause`, `shouldDrawFrame`, and the
  slow-machine step-down `LIQUID_SCALES` 0.3 -> 0.2 -> 0.14 below 20 fps), and the wallet's numbers.
- `render/src/site/liquid.ts`: the WebGL driver around the mockup's shader. No animation frame is even
  requested while paused (sign-in covering it, a hidden tab, a plain background); reduce motion draws one
  frame and redraws only when the colours or size change; the liquid's clock runs only while it draws, so a
  tab coming back carries on rather than jumping; a lost WebGL context falls back to the still gradient.
- `siteApi.ts`: `me`, `accountSettings`, `updateAccountSettings`, `wallet`.
- `siteClient.ts`: settings, who-am-I and wallet loaded with the play settings on entry (only the play
  settings are required; the others degrade); theme and background saved by PATCH (drawn at once, put back
  with the server's words on a refusal); Settings -> Display has the picker (a radio group, arrow keys);
  Settings -> Admin for the house admin (it says what it waits on); the top bar has credits, pack points and
  the Open button with its count (it opens the Store page, which says it waits on pack opening). The wallet
  refreshes with the 15 s poll.
- `siteDemo.ts`: Nova is the house admin, has 150 credits from five recorded wins over Rook, and 3 packs.
- Tests (+20, render 716): `render/test/siteLook.test.ts` (18; the background list equals the economy's),
  `site.test.ts` (+2: the account calls through the host over the real owner API; the canvas in the page).

**Ran it:** `progress/render/evidence/site-check-s45.mjs` -> `site-check-s45.txt`: 39 browser checks, ALL PASS,
in software WebGL (SwiftShader; this machine has no GPU). Stills `v2-s45-site-*.jpg` (Home in each liquid
colour, Glacier and Aurora dark, Plain purple, the picker, a narrow window, no WebGL).

**Found on the way (fixed):**
- At 0.3 scale software WebGL drew only 11.7 fps, and the light/dark fade was per frame, so it took three
  times as long. The fade is now time-based (the same second at 12, 30 or 60 fps), and the liquid measures
  itself and steps down a scale when under 20 fps: in the check it went 0.3 -> 0.2 -> 0.14 in 4 s and then
  drew 23.7 fps. A Mac's GPU should stay at 0.3 and 30 fps; that's unmeasured here.
- A 32 ms frame gate lost about 4% of a 60 Hz screen's frames to 1.5 ms of jitter (unit test); now 28 ms.
- Reduce motion redrew three times on one pick (every refresh drew); now only when the colours change.
- **Mutants:** removing the loop's pause guard alone survives (refresh() cancels the frame anyway: the two
  are a deliberate pair); removing both fails 3 checks (D twice, G). Unit mutants are the tests' own cases.

**Not done (named):** the skip hint remembered on the account (owner call 2 from session 43): the website
shows no boast or intro yet, so there's nothing to skip in it; `skipHintSeen` waits for the first replay in
the site. Sound and music settings: the API has them, but the site plays no sound yet, so no controls.
Customise -> Background (comes with the widget board). The title screen's cosmic liquid and card fan.

**Next render-lane slice:** Season 0 item 3, Home as the widget board (12 columns, S/M/L, Customise, the
empty state) as far as the endpoints allow; the saved board layout needs a game-lane endpoint, which it
doesn't have yet, so the first slice may build the board with its layout held in the page and say so.

## 2026-11-01 — Session 46: Home as the widget board (saved to the account; the twelve Season 0 widgets)

Owner feedback read: the answers to render session 45 keep all 6 calls and name this slice (Season 0
render item 3, Home as the widget board). The game lane's session 64 built the saved board (`GET`/`PUT
/api/board`) and the economy endpoints, so the layout is saved to the account from the start and the
widgets with data draw it. The 2026-11-01 entries after that are the game lane's (its session 65). No
CRITICAL item in the render debt list. Not a hardening pass: the owner set the slice. Alternation: the
last merged PR (#111) was the game lane's.

**Session 45's PR on CI (owed):** PR #110, the `test` job 3 min 51 s, passed; auto-merge 3 min 57 s.

**Built:**
- `render/src/site/siteBoard.ts` (pure, tested): the widget catalogue (names, icons, colours, L wide or
  tall, the page each opens, which are live), sizes and spans, Customise's edits (add at M at the end,
  remove, resize, drag-move, arrow-key move, never reusing an id), the limits applied from the server's
  `rules` (never restated), the two-live-board rule, the grid as CSS packs it (for the tests), and the
  views: Daily rewards (the bar's end from the server's schedule), Collection, Showcase, Packs (the pity
  timers from the server's counters and flags).
- `render/src/site/siteWidgets.ts` (pure): each widget as HTML at S/M/L, editing or not; a widget waiting
  on match running says so; a widget still loading or whose read failed says that; mini placeholder card
  faces and a CSS pack.
- `siteApi.ts`: board, saveBoard, daily, collection, packs, buyPacks, store, buyCosmetic.
- `siteClient.ts`: Home is the board: Customise (held until Done; leaving Home saves), the gallery,
  Background and Recommended layout dialogs, the empty state, drag and drop and the arrow keys and
  Delete, buying packs and cosmetics after a confirm; only the reads the board's widgets need, refreshed
  with the poll. `siteModel.ts`: Collection and Store now say the server serves their data and the page
  comes next.
- `sitePage.ts`: the board's CSS (the mockup's grid, the jiggle, "−", the add tile, narrow stacking
  without dense packing, reduce motion: no jiggle, a dashed outline; a dialog pauses the jiggle).
- `siteDemo.ts`: two wins and a loss today, so Daily rewards has real numbers.
- Tests (+25, render 741): `render/test/siteBoard.test.ts` (the edits checked against the store's own
  `boardLayoutProblem`; the recommended grid; every widget at every size; the client against the real
  owner API: save, read back, a refused third Watch live, buying a pack).

**Ran it:** `progress/render/evidence/site-check-s46.mjs` -> `site-check-s46.txt`: 38 browser checks, ALL
PASS. Stills `v2-s46-board-*.jpg`. Mutants: dropping the save on leaving Home stops the run at check E;
keeping dense packing in narrow windows fails J.

**Found on the way:**
- **Fixed:** the greyed rows of the gallery drew ghosts of the page behind them over Customise mode's
  turned tiles (whole-element opacity over a blurred, rotated layer); greyed by colour now.
- **Fixed:** the pity line read "within false packs": the API sends the timers' counters and "next pack
  is sure" flags, not thresholds; the line uses those.
- **Measured, not changed:** with the full board, session 45's check fails its frame-rate bar here: 15.7
  fps against 25.0 on main the same day (`site-check-s45-rerun-s46.txt`). `board-glass-cost-s46.mjs`
  pins it on the tiles' `backdrop-filter` (off: 24.7 fps; a 16 px blur instead of 30 px: no better).
  Raised with the owner with options; software WebGL only.
- Playwright never finds a jiggling tile "stable", so the check forces its clicks there; the drag uses
  a real mouse in a window tall enough not to scroll mid-drag.

**Not done (named):** the free daily pack's claim (game session 65); pack opening and the Store and
Collection pages; the six widgets waiting on match running; My agent's rating, record, Start/Watch and
signature card; the skip hint on the account (nothing in the site skips yet).

**Next render-lane slice:** the Store page with pack opening on the site (so Open and the Packs widget
open packs, the standalone pack opening brought in), then Collection's wide binder. If the owner answers
the frame-rate note first, that answer goes in the same slice.

## 2026-11-01 — Session 47: the Store page and pack opening on the site

Owner feedback read: the answers to render session 46 keep all 7 calls; fallback (a) for the liquid only
if the owner reports a stutter on the Mac mini (no report yet, so nothing changed); the next slice named
there is this one, "the Store page with pack opening on the site (so Open opens packs)". The game lane's
session 65 built the free daily pack's claim, so call 7's greyed button is now live. The 2026-11-01 entry
after that (answers to game session 65) is the game lane's. No CRITICAL item in the render debt list. Not
a hardening pass: the owner set the slice. Alternation: the last merged PR (#113) was the game lane's.

**Session 46's PR on CI (owed):** PR #112 merged to main (squash commit 4e1f35d); its CI run wasn't read
this session.

**Built:**
- **Pack opening, full screen, on the site.** The standalone pack-opening page (`packPage.ts`) has a site
  mode (`site: true`): empty at load, no picker, a Close button; the website drives it through the
  existing `window.PACK` seam (`setPacks`/`openPack`, now also `setBulks`/`openBulk`, and an
  `onBulkSummary` hook beside `onSummary`). The site host serves it at `/pack-opening`; the website
  frames it (same origin) in a full-screen overlay. The reveal itself is unchanged: every finish's reveal,
  the honest sparks, the ten-pack fan, auto and skip, the viewer.
- **Real openings.** The top bar's Open, the Packs widget's Open / Open 10 and the Store's buttons call
  `POST /api/packs/open` (`{count: 1|10}` or `{packId}`); the client plans the reveal from the answer with
  the same planner the standalone pages use (`siteStore.revealOf` -> `planReveal` / `planBulkReveal`). To
  bundle that planner for the browser, the site's esbuild resolves `@ai-tcg/economy` to the economy's pure
  `packs.ts` (the one value it reads is the store's hit-finish list); any other economy value would fail
  the build loudly.
- **The summary's buttons are the website's** (`siteStore.summaryButtons`): one pack, "Open another" and
  Done; ten, "Open 10 more", "Open one pack" and Done; a button whose packs aren't there is greyed with the
  reason under it. Done, Close or Esc (on the summary only, so a stray key can't cut a reveal short) go
  back; the wallet, Home's widgets and the Store read again; focus goes back to what opened it.
- **The Store page** (`storePage` in `siteClient.ts`, the lines in `siteStore.ts`): the season's pack
  (price, pity, Buy with a 1-10 stepper, the total and how many credits short), the free daily pack (what
  waits, when the next comes in, Claim), the packs waiting grouped by where they came from (each row opens
  its oldest one: `{packId}`), the last six openings' cards, the cosmetics on sale (Buy).
- **Widgets:** Store's "Claim free daily pack" is live (call 7 from session 46 done); Packs says the daily
  pack's state instead of "comes with its claim".
- **Sound:** the reveal's player reads the account's sound setting (on/off, volume) and a change in the
  opening is saved back to the account (`PATCH /api/account/settings`, after 0.5 s). The standalone pages
  keep browser storage.
- **Host:** the site's CSP gains `frame-src 'self'`; `/pack-opening` may be framed only by the site
  (`frame-ancestors 'self'`) and has no `connect-src` (it fetches nothing).
- **Demo:** the demo's extra packs are granted as weekly challenge packs, not owner-daily ones (ten
  owner-daily packs on day one left nothing to claim); ten waiting (three before), one really bought.
- Tests (+17, render 758): `render/test/siteStore.test.ts` (the plan equals the standalone planner's on
  real store openings, single and ten, through JSON; refusals; the summary's buttons; the daily line; the
  stepper; the grouping; recent openings; sound both ways; the site mode's page; the bundle; the host's
  page and headers; opening one, a chosen one and ten, the claim and its 409, over the real owner API).

**Ran it:** `progress/render/evidence/site-check-s47.mjs` -> `site-check-s47.txt`: 50 browser checks
against the real owner API, ALL PASS (stills `v2-s47-store-*.jpg`). Each single pack's reveal is checked
against the copies the server logged for it (`GET /api/packs/:id/opening`) and the slot order. Also
re-run: session 46's board check (38, ALL PASS), the CI browser check (61, ALL PASS), session 24's
standalone pack-opening check (all pass). Session 25's ten-pack check (`pack-bulk-check.mjs`) times out
on the speed buttons on main's committed page too: the script is stale (not this change); the new check
plays a ten-pack open through to its summary instead.

**Mutants:** the ten-pack button enabled with any pack waiting; no guard against a summary with one pack;
no `frame-src`; the account's sound read inverted: each fails a unit test. Before their fixes the browser
check caught two real bugs: focus lost after an opening (every wallet redraw, the 15 s poll included,
dropped focus off the Open button; `drawWallet` now keeps it), and the Store showing packs opened elsewhere
(Home's Open) when you came back to it (stale reads; `afterChange` now re-reads the Store once it has
been read), which made "Open one" on a row ask for an opened pack (404).

**Found, not mine to fix (raised):** "Watch again" for a recent opening was built and taken out: the
logged opening (`GET /api/packs/:id/opening`) returns the copies only, not the opening as the reveal
plays it (slots, NEW badges, "x N owned", pity, pack points). Raised in notes-for-owner as a small
game-lane ask.

**Found from a still (fixed):** the ten-pack summary opened scrolled to its bottom, cards out of sight:
focusing its main button scrolled the summary. Now focused with `preventScroll`; check G asserts the
summary opens at its top.

**Flake seen, not explained:** check E (the second pack's reveal against its logged copies) failed once
in the first four runs, before the check printed what it saw; five runs since, all pass. Likely the
script's own tapping racing a card's leave animation (it taps by position), but unproven. The check now
prints the shown order and slots when it fails.

**Not done (named):** the loadout picker in the Store (owning a cosmetic works; equipping waits for the
next slice); "Watch again"; the Collection page; the ten-pack check script's repair.

**Next render-lane slice:** Collection's wide binder (the server serves it all: copies, finishes, sets,
salvage and crafting), with the loadout picker brought into the Store if it fits.

## 2026-11-02 — Session 48: the Collection page (the wide binder and the card viewer)

Owner feedback read: the answers to render session 47 keep all 6 calls and name this slice ("Collection's
wide binder, and the loadout picker in the Store"); "Watch again" is a game-lane job after its session 67,
so not this lane's. The 2026-11-02 answers to game session 66 are the game lane's. No CRITICAL item in the
render debt list. Not a hardening pass: the owner set the slice. Alternation: the last merged PR (#115) was
the game lane's (session 66).

**Session 47's PR on CI (owed):** PR #114 merged to main (squash commit df9174c); its CI run wasn't read
this session.

**Built:**
- **The Collection page** (`collectionPage` in `siteClient.ts`; the model `render/src/site/siteCollection.ts`
  and the HTML `siteCollectionHtml.ts`, both pure): the owner's spec (2026-10-05, Screens 5). The summary
  (the set's completion ring, Secrets, Glitch, Gold and Prototypes held of each total, copies, pack
  points), the set (S0 · Season 0, "Next set · coming"), the tabs Set, Secrets, Prototypes, Promos, the
  faction filter and All / Owned / Missing. Every place in the server's binder (`GET
  /api/collection/binder/:setCode`) in its order: a held place is the card's printed face in the best
  finish held (the count, and the finish named under it), a missing place a numbered empty slot with the
  card's name and a rarity dot. Secrets holds the secret cards, then Glitch, then Gold (each its own block
  with the server's count); Prototypes the 15 runs (size and how many found); Promos says what it waits on.
- **The card viewer:** the card, which tilts under the pointer (the pack page's own angles; still under
  reduce motion), its text fitted as the pack page fits it; every copy you hold with its finish, origin and
  the Account-bound tag; the saved decks that use it; **Craft** (cost and the playable limit read from the
  economy's config and the engine's copy limits, the store's own constants; greyed with the reason) and
  **Salvage** on base places (a 1 to N stepper, the plan read first, its affected decks put to the owner in
  the confirm, then sent confirmed; a 409 that still finds decks is put to the owner again). ‹ › and the
  arrow keys walk the places as filtered; Escape closes and focus goes back to the place. A missing card
  opens too, greyed, with Craft.
- **One face, not two:** `render/src/site/siteFaces.ts` hands the website the pack page's own face code
  (`PACK_PAGE_PURE_SOURCE` run in its own scope: `window.SITE_FACE`) and its CSS cut to the `.face` rules
  (parsed out of `PACK_CSS`, scoped under `.cface`, with the keyframes they name) and its set symbol read
  out of its page. The binder's finishes stand still; the viewer's shine moves.
- `siteApi.ts`: binder, cardHoldings, salvagePlan, salvage, craftCard, craftSecret; `SiteApiError` keeps the
  refusal's body, and `salvageNeedsConfirmation` reads salvage's 409.
- After a craft, a salvage or any pack opening, the collection and binder are read again (and Home's
  Collection widget).
- `siteDemo.ts`: Nova has one deck saved by hand (the starter with one copy swapped for a pulled pack copy,
  a real `saveDeck`), so salvage can meet a saved deck it would leave short.
- Tests (+21, render 779): `render/test/siteCollection.test.ts`: the slots against real store binders
  (order, counts, filters, tabs, unique keys, the arrows' order, best finish); the face equals the card-face
  sheet's for the same card; craft offered exactly when the real store crafts (60 places, both ways);
  Glitch/Gold/Prototype never craftable; salvage's clamp and reasons; the page's HTML (faces held, numbered
  empty places, counts, Promos waits); the viewer's copies and Account-bound tags; the Prototype caption;
  the face CSS keeps every `.face` rule of the pack page and only scoped ones; the script's exports; over
  the real owner API: the binder and holdings, salvage's 409 naming the deck, then confirmed and paid,
  crafting and the store's refusal words. `site.test.ts`: Collection left the waits list.

**Ran it:** `progress/render/evidence/site-check-s48.mjs` -> `site-check-s48.txt`: 40 browser checks
against the real owner API, ALL PASS. Stills `v2-s48-col-*.jpg` (the binder, Missing, Secrets, the viewer,
crafted, the salvage confirm, narrow, dark). Re-run on this branch (with the demo's saved deck): session 47's
Store check, 50 ALL PASS; session 46's board check, 38 ALL PASS. `npm test -w @ai-tcg/render`: 779 pass;
typecheck clean.

**Mutants:** craft allowed at the playable limit; a Glitch place counting every copy of its card; the
base place showing a secret copy's finish; the face CSS cut dropping rules with several selectors; salvage's
409 read without its needsConfirmation flag: each fails a test (the second and fifth only after this
session tightened the tests).

**Found on the way (fixed):** the ×N count sat on the card's cost gem (moved to the bottom corner). The
demo had no saved deck a salvage could leave short (the agent's deck uses the starter's bound copies), so
the confirm path was unreachable in the browser until the demo saved one by hand.

**Not done (named):** the loadout picker in the Store (the slice's "if it fits": it didn't); Promos (no
signature cards or earned promos in the collection API); "Watch again" (game lane).

**Next render-lane slice:** the loadout picker in the Store (equip what you own: `GET`/`PUT
/api/agents/:agentId/loadout`), then the match pages once the game lane's session 67 serves live state and
match history.

## 2026-11-02 — Session 49: the loadout picker in the Store

Owner feedback read: the answers to render session 48 keep all 6 calls and name this slice ("the loadout
picker in the Store, then the match pages"); the answers to game session 67 and the coin-skin entry put coin
skins on the render list after this slice, plan first at an owner check-in, game lane first to build. No
CRITICAL item in the render debt list. Not a hardening pass: the owner set the slice. Alternation: the last
merged PR (#117) was the game lane's (session 67).

**Built:**
- **The picker's site mode** (`loadoutPicker.ts`, `site: true`): the standalone picker (render session 36,
  owner-approved) starts empty and hidden; the website hands it one agent's state (`window.LOADOUT.show`).
  Equip calls `LOADOUT_SITE_HOST.equip(slot, itemId)` on the website, which sends `PUT
  /api/agents/:id/loadout/:slot`; the page applies the loadout the server answers with
  (`loadoutAnswerApply`, slot for slot) or shows the refusal. Equip and Buy are disabled while a call is
  out. A locked tile has **Buy** when the owner can pay (`loadoutLockAction`): the website's own confirm
  (shown above the picker), the Store's buy, then the page is handed the agent's state read again and stays
  on the slot, previewing what was bought. Close and Escape go back; the sound is the account's (the pack
  opening's store). The standalone page is unchanged in behaviour (its transcript is byte-identical).
- **`site/siteLoadout.ts`** (pure): `loadoutPayload` builds the page's data from the API's answers (the
  agent's loadout, `GET /api/cosmetics`, `GET /api/store`, `GET /api/play`, `GET /api/collection`): owned
  tiles are exactly the server's choices for the slot, items on sale the owner lacks are locked, then the
  empty tile. `deckFactionOf` (the latest build's faction when it is the deck being played, else the
  faction lock, else null: said, not guessed), `previewCards` (the owner's units of the row's faction),
  `agentLoadoutRows` (the Store's rows). The slot words moved to `loadoutText.ts` (no imports) so the
  bundle can share them.
- **The Store:** a new panel, "Your agents' loadouts", stacked under "Waiting to be opened": each agent
  (connected first) with its victory and close-win boasts and **Change**, which opens the picker full screen
  (`#dress`, framed from the host's new `/loadout`, the pack page's headers: framed only by the site, no
  `connect-src`). After Close the Store reads again and focus goes back to the agent's Change. The Cosmetics
  panel no longer says the picker is coming.
- `siteApi.ts`: `cosmetics`, `loadout`, `setLoadout`. `siteDemo.ts`: six earlier winning days for Nova
  (real `recordMatch` calls), so one Season 0 boast (300) can be bought in the demo.
- Tests (+13, render 792): `render/test/siteLoadout.test.ts`, over the real owner API: the tiles against the
  server's choices and what's on sale; the deck's faction unknown, then set by a lock (and an empty boast's
  preview follows it); `deckFactionOf`'s rule; the preview row; a walk of Equips and empties where the
  page's state after each answer equals a fresh read; refusals (not owned, wrong kind, no such slot, another
  owner's agent) leave the page and the server unchanged; a live match locks it (409, the banner's data);
  Buy only when affordable, then owned on every agent and equippable, each agent's loadout its own; the
  Store's rows; the site page and `/loadout`'s headers; the bundle.

**Ran it:** `progress/render/evidence/site-check-s49.mjs` -> `site-check-s49.txt`: 40 browser checks
against the real owner API, ALL PASS (stills `v2-s49-loadout-*.jpg`): the rows equal the server's
loadouts; the picker's tiles equal the server's choices and the store's sale; Equip, the close-win slot, and
emptying it, each checked on the server; Buy (Cancel buys nothing; then 422 -> 122 credits, the top bar and
the picker both show it), then Equip; Escape and Close with focus back; the second agent's own loadout; a
refused Equip after the session ended (nothing saved, the site signs out); 720 px; reduce motion plays the
still; headers; no external requests, no page errors. Re-run on this branch: session 46's board check 38
ALL PASS, session 47's Store check 50 ALL PASS (its panel count updated: six panels now), session 48's
Collection check 40 ALL PASS, the CI browser check 61 ALL PASS. `npm test -w @ai-tcg/render` 792 pass;
typecheck clean.

**Mutants:** Buy offered without the credits; any build's faction taken as the deck's; the page keeping its
own state instead of the server's answer; owned items shown locked; a guessed faction when none is known:
each fails a test.

**Found on the way (fixed):** the client bundle pulled Node-only code through the picker module (the slot
words moved to `loadoutText.ts`); the Store's redraw after Close dropped focus (it now goes back to the
agent's Change after the reads); the new rows first shared the pack rows' class, which session 47's check
read as pack groups (own class now); the panel first sat below the long Recent openings (moved under the
packs waiting). Once, the check clicked Change while the Store was still redrawing after a Close and the
click missed (a race in the check; it now waits and fails loudly if the picker doesn't open). Two clean
runs before the fix, one after.

**Found, not mine to fix (raised):** the API doesn't say which faction the agent's deck plays, or its cards
(game-lane ask in notes-for-owner). Session 36's standalone picker check (`loadout-check-s36.mjs`) fails 5
of 48 on main's committed page too: it predates render 37's win message (stale script, in the debt list).

**Not done (named):** the coin skins (plan only: the render half is at an [OWNER CHECK-IN] in
notes-for-owner, nothing built); the match pages; "Watch again" (game lane).

**Next render-lane slice:** the match pages on the game lane's session 67 endpoints (Watch live, the Live
match widget, Match history, the auto-play switch), unless the owner's answer on the coin plan comes first
and the game lane has built the coin slot.

## 2026-11-02 — Session 50: the match pages (Agent match, Watch live, match history with full replays, auto-play)

Owner feedback read: the answers to render session 49 keep all 6 calls and name this slice ("the match pages
(Watch live, the Live match widget, Match history, auto-play) on the game lane's session 67 endpoints"); the
answers to game session 68 add the spectator point-of-view toggle, to be **proposed at a checkpoint before
building** (done: notes-for-owner, session 50 item 2; nothing built); the coin plan's game half isn't built
yet, so no coin work. No CRITICAL item in the render debt list. Not a hardening pass: the owner set the slice.
Alternation: the last merged PR (#119) was the game lane's (session 68).

**Built:**
- **Replays of recorded matches in the existing arena** (`site/siteReplay.ts`): the server's replay file
  (`ai-tcg-replay/1`) rebuilt through `captureMatch` with two scripted seats that hand back the file's moves
  in order (each checked legal where the file puts it), the decks read by the game lane's own
  `replayDeckSpec`; the end checked against the file (winner, final health) and the record's boast attached
  and checked as `attachRecord` does. A file that doesn't rebuild throws: the site shows the reason, never a
  different match. The owner's 2026-10-05 spec: "use the existing match renderer for the real board".
- **The site host builds it** (`siteHost.ts`): `POST /replay-page/:matchId` with the owner's token reads
  `GET /api/matches/:id` and `/replay` over the API with that same token (the API's rules decide who sees
  what), rebuilds, and keeps the page in memory under a random 24-character key for 10 minutes (at most 6);
  `GET /replay/<key>` serves it with the pack page's headers (framed by the site only, fetches nothing).
  401/404 pass through; a file that won't rebuild is 422 with the reason.
- **Agent match** (`#/match`): the agent, its status and the **auto-play switch** (a real `role="switch"`;
  the server's answer is what shows; the "maxed" message when the server turned it off); **Live now**: the
  agent's live match as a scoreboard (names, owner, rating and tier, health bar, energy, hand and unit
  counts, whose turn), the compact board (each side's units by name and stats, arming ones dashed), and the
  **play-by-play** followed through `GET /api/live/:id?from=N` (only the new moves each read), tidied from the
  engine's log lines (agent names for seats, no instance ids, no priority passes or turn ends); **Match
  history**: every match, newest first, with the result, opponent, when, turns, credits, rating change,
  **Replay** and **Log**, and Show older (20 a page). When the agent's match is recorded it tops the history.
- **Watch live** (`#/live`): every match the ladder is showing, each a dark card with its scoreboard, compact
  board and last three plays. Featured picks and viewers wait on their endpoint (said on the page).
- **The widgets** (`siteWidgets.ts`, `siteMatches.ts`): Live match (S the scoreboard; M + the compact board;
  L + the play-by-play and the switch), Watch live (S the first live match; M + the others one line each; L
  the first on the compact board, the list alongside), Match history (S the last result; M the last 6; L the
  first page with Replay and Log), and the auto-play switch on My agent at every size. Live parts redraw
  every 3 s from `GET /api/live` (15 s in a hidden tab), only the live tiles, never a tile with focus.
- **The viewer's own agent is always on the near (left) side** of a scoreboard and compact board (owners
  keep their own view, owner 2026-11-02); a spectator sees p1 on the left.
- `siteApi.ts`: `setAutoPlay`, `live`, `liveFeed`, `matches`, `match`, `matchLog` (text), `replayPage`, and
  the types from OWNER_API.md. `siteDemo.ts --ladder [--speed N]`: the game lane's `LiveLadder` in the demo
  (two house owners join; both players on auto-play; four of Nova's matches played on a clock two hours
  behind, moved in jumps, then real time). Off by default, so sessions 46-49's checks see their demo.
- Redraws keep focus on the same control (`focusKey`): the 15 s poll redraws the history while a replay is
  open, and Close gives focus back to the row's Replay.

**Tests (+10, render 802):** `render/test/siteMatches.test.ts`: every result in words; signs, times and the
record; the switch in every state; the log tidying; then over the real owner API with the `LiveLadder` on a
clock the test moves: the scoreboard equals the server's board now, the viewer's side first for each owner;
the play-by-play read a feed at a time adds up to the match log line for line; the history row; the replay
page built by the host is the same match (every move, every event line the feed released, the same winner,
the record's boast); refusals (no token 401, no such match 404, no file 404, a file with another seed or cut
short 422, an unknown key 404, wrong methods 405); `replayOfFile` refuses a record that isn't the file's;
auto-play off and on over the API; every match widget at every size from the real answers. Updated: the
waits lists (Agent match and Watch live are pages now; Live match, Watch live and Match history widgets
draw), the Match history widget's page (Agent match), the recommended board's reads (+live).

**Ran it:** `progress/render/evidence/site-check-s50.mjs` -> `site-check-s50.txt`: 40 browser checks
against the real owner API with the ladder playing at 8x, ALL PASS (stills `v2-s50-match-*.jpg`): Home's
Live match (Nova's agent first), Watch live and Match history widgets equal the server's; the switch off and
on, each checked on the server; Agent match: a match of Nova's goes live, her side near, the play-by-play
grows, in names, the scoreboard's health is the answer the page read; the match is recorded and tops the
history; the history equals the server's, Show older reads the rest, rows without a replay say so; the
replay full screen: the same agents, all 120 moves, the record's boast, the same winner, played to GAME
OVER; Close and Escape with focus back; the log; Watch live's cards; 720 px; the replay page's headers; a
replay after the session ended signs out; at most two live boards on Home with real live matches (moved
here from session 46's check); no external requests, no page errors. Re-run on this branch: session 46's
check 38 ALL PASS (two expectations updated to this slice's contract: Live match and Watch live no longer
"wait", and no striped placeholder board), session 47's 50 ALL PASS (its pack-log reader updated: game
session 68 made `GET /api/packs/:id/opening` answer the `PackOpening`; it crashed on main too), 48's 40 and
49's 40 ALL PASS, the CI browser check 61 ALL PASS.

**Found on the way (fixed):** while no move is out yet, every feed read from 0 carries the opening lines
again, and the play-by-play doubled them (a test caught it: taken once now). The arena owns Escape (it skips
the intro and the boast), so Escape inside the replay frame doesn't close it; Close does, and Escape on the
website. The Close button first sat over the arena's seed (moved to the bottom corner). The Watch live tile at
M overflowed with two scoreboards (the others are one line each now). The first check run lost focus after
Close (the history had been redrawn under the replay: fixed with `focusKey`); its health check raced the
page's 3 s poll (it now compares the drawn numbers with the answer the page read).

**Not done (named):** the big live board (the arena playing a live match as it is released: the arena needs
whole frames, the live feed sends public snapshots and engine events with no hands; next slice, see notes);
the 2x vote, featured picks and viewer counts (no endpoints); the spectator point-of-view toggle (proposal
only); coin skins (the game half comes first).

**Next render-lane slice:** the big live board on Agent match and Watch live (the arena fed from the live
feed), unless the owner's answers on the POV proposal or the coin plan come first.

## 2026-11-02 — Session 51: the big live board (the arena fed from the live feed)

Owner feedback read: the answers to render session 50 keep all 6 calls, approve the spectator point of
view as proposed, and name this slice ("the big live board (the arena fed from the live feed) on Agent
match and Watch live"); the point-of-view toggle "follows once the coin slot and the ratings-at-start
field exist" (both exist since game session 69, so it is the next slice, with the first coin slice). No
CRITICAL item in the render debt list. Not a hardening pass: the owner set the slice (the last render
hardening pass was session 40; see quality-debt). Alternation: the last merged PR (#121) was the game
lane's (session 69).

**Built:**
- **`site/liveFrames.ts`: the live feed as arena frames.** `LiveFrameBuilder` takes the feed's board before
  the first move and each released step (the engine's move, its events, the public board after it) and
  makes the same `Frame`s the arena draws a replay from, without the engine state: the public board gives
  health, energy, counts and every unit's live numbers; the card registry (read-only) gives each card's
  faction, rarity, printed stats, keywords, base armor and each tool's bonuses (tokens rebuilt the way the
  engine builds them); the engine's events give the stack (`cast`/`attack` push, `attackRedirected`
  retargets, `stackResolve` pops), Barrier, arm turns, who has attacked this turn, and statuses and
  this-turn buffs with the duration their source card gives (left out, and listed, when the card doesn't
  settle it; it never happened in the tests). Frame 0's opening event is rebuilt and checked against the
  feed's `startLines`. Not invented: hands (card backs, the count only), the signature zone (the feed has
  its name only), the deck's faction before a card shows (Neutral until then); a signature unit is drawn
  as the Neutral Mythic every signature card is, with its live numbers.
- **The arena's live mode** (`renderMatchHtml(replay, { live: true })`): SPECTATOR LIVE, a LIVE badge in
  place of the seed; frames arrive from the website by `postMessage` (only from its parent frame) and the
  page follows the newest move at its own pace; more than 3 behind it hurries (160 ms a move), more than
  12 behind it skips to just before the newest and plays on. Pause or a step back: the badge says "LIVE ·
  N behind", a tap goes live again. Joining mid-match starts at the newest move (scrub back for the rest);
  joining before the first move plays Match Boot. Hands are card backs with "N cards, face down". The
  boast is the record's: the record comes after the last move (the server records the match 8 s after
  showing it), so live the result lands first and the boast plays when the record arrives; ENDED then.
  The page carries every Mythic ward sheet and every faction ring (any may still arrive).
- **The site host** (`siteHost.ts`): `POST /live-page/:matchId` reads the feed from 0 with the caller's
  token, builds the frames and the page, keeps both under a random key (8 at most, 10 minutes after the
  last read); `GET /live/<key>` serves it (framed by the site only, fetches nothing); `GET
  /live-frames/<key>?from=N` reads only the moves released since its last read (one read at a time per
  page), answers the frames from N on, and when the feed says the match has ended reads the record and
  hands over its boast, checked against the last frame as a replay's is (a record that doesn't match shows
  no boast, never a wrong one).
- **The website** (`siteClient.ts`): "Watch on the arena" on Agent match's live panel and on every Watch
  live card opens the live page full screen (the replay's overlay; Close, or Escape on the website, and
  focus goes back to the button); it reads new frames every 3 s (15 s in a hidden tab) and hands them over.
  `siteApi.ts`: `livePage`, `liveFrames`.
- `wardDataFor` and `sigWardDataFor` take `{ all }` for the live page.

**Tests (+21, render 823):** `render/test/liveFrames.test.ts` (17): eight real matches (every faction,
random, aggressive and lookahead agents) played through `captureMatch` with the moves kept, replayed
through the engine with the server's own timeline recorder, converted, and every frame compared with the
captured one field by field: equal everywhere but hands (card backs, the right count), the signature zone
(not drawn) and the faction before it shows; three more with signature cards (equal but a signature
card's Barrier and its ability text); the matches exercise every tracked kind (redirects, Barrier
absorbed, statuses, turn buffs, telegraphs, tools, evolutions, tokens); no duration left unsettled;
frames never change once given; a step out of order is refused; the live page carries every sheet, a
replay page is unchanged. `render/test/siteLiveArena.test.ts` (4): over the real owner API with the
`LiveLadder` on a moved clock: the page starts at the moves released, the frames come a read at a time
with no gap or repeat, the end hands over the record's boast, and the live frames equal, frame for frame,
the replay the host rebuilds from the server's file (the public parts); refusals (no such match 404, an
unknown key 404, wrong methods 405); a match recorded between two reads still ends on its last move (from
the replay file), equal to the replay; the buttons are in the site.

**Ran it:** `progress/render/evidence/site-check-s51.mjs` -> `site-check-s51.txt`: 28 browser checks with
the real ladder at 4x in the demo, ALL PASS (stills `v2-s51-live-*.jpg`): Agent match's "Watch on the arena"
opens Nova's live match full screen within a few moves of the newest; health, energy, hand counts and units
are the server's at the move shown; hands are card backs; new moves play; pause says "LIVE · N behind" and a
tap goes live; it keeps within 12 moves of live at 4x; the header's factions follow the board; ENDED, GAME
OVER on the last of 120 moves (the replay file's 120), the record handed over is the replay's; Close;
Watch live's cards each have the button, one opens that match, Escape closes it, focus back on its button;
the live page's headers (framed by the site only, fetches nothing); no external requests, no page errors.
`v2-s51-live-ended.jpg` (the record's boast, Void Collapse, playing over the final board after GAME OVER,
the badge ENDED) is from an earlier run of the same check, before the header fix (its header still says
"[NEUTRAL]"): in the final run that still timed out three times while the boast's canvas ran.
Re-run on this branch: the CI browser check 61 ALL PASS; session 50's check (replays and the match pages)
40 ALL PASS (its first run on this branch stopped at check 37 of 40: in the 720 px window the history's
Replay button was "not visible" to the click for 30 s; the re-run passed; the same click never failed
before, so it is in quality-debt as a flake to watch). Measured (software WebGL, headless): a live page on its own is 2.2 MB (a replay is about 2 MB)
and answers in about 1 s; in a fresh site page three opens in a row from Watch live take 2-5 s each; in
the check, after a whole live match was watched to its end in the same page, the second open took 28-34 s
to parse (served in 35 ms). Not explained (quality-debt).

**Found on the way (fixed):** **a match recorded between two reads lost its last moves on the arena** (the
feed answers 404 once the match is recorded, and the moves released since the last read are gone from it;
at 4x the check ended on move 117 of 120): the host now finishes the match from the replay file, replayed
in the engine with the server's own timeline recorder (a test opens a page, reads nothing until the match
is recorded, then gets every move, equal to the replay). The header kept the faction it had when the page
was built ("[NEUTRAL]" beside a Cortex HUD): it follows the board now. At 8x in software WebGL the arena
fell 27 moves behind (each step's effects take longer than the moves come out): the hurry and skip rules
above. Live, a Mythic without a sheet that arrives later gets its fallback ward drawn as it arrives. The first check runs asked
`/live-page` without a token (the owner API wants one on every route) and took a still while the boast's
canvas ran (it retries now). **Found, not fixed (the game lane's):** the live feed's `events` include the
engine's `draw` events, which name every card drawn, so the hands the public board leaves out can be
rebuilt from the feed (notes item 3).

**Not done (named):** the spectator point of view (approved; next); the coin flip (the first coin slice);
the signature zone, the faction from the first move, and the boast before the result live (each needs a
small addition from the game lane: notes); the Live match and Watch live widgets on Home keep the
scoreboard (the arena opens from the pages).

**Next render-lane slice:** the spectator point of view (approved: the "Watch as" switch on Watch live, the
Watch live widget and the replay's top bar; the chosen player to the near side, the board flipped; default
`defaultView`; remembered per match in the tab) together with the first coin slice (the flip in Match Boot,
the Chrome Token, reduced motion and sound), on the coins and `defaultView` the game lane serves since
session 69. Both pages (replay and live) take the same switch.

## 2026-11-02 — Session 52: the spectator point of view ("Watch as")

Owner feedback read: the answers to render session 51 keep all 6 calls, approve three live-feed asks for the
game lane, and choose "show hands live" (b), the render lane drawing live hands face up from the feed. The
point of view was approved after session 50 to follow once the coin slot and the ratings-at-start field
existed (both since game session 69), so it is this slice. Alternation: the last merged PR (#123) was the game
lane's (session 70). No CRITICAL item in the render debt list. Not a hardening pass: the owner set the slice
(the overdue pass is still named in quality-debt).

**Built:**
- **The website** (`site/siteMatches.ts`, `siteClient.ts`, `siteWidgets.ts`, `sitePage.ts`): `nearSeat`
  (own seat, else the tab's choice, else `defaultView`, else p1) gives every `Scoreboard` a `near`; the
  scoreboard, compact board and one-line list put `near` first. `watchAsHtml` is the "Watch as: <A> | <B>"
  group (aria-pressed, ids per place so focus survives redraws), on each Watch live card the viewer doesn't
  play in and on the Watch live widget's first match at M and L; none on the viewer's own match, Agent match
  or the Live match widget. The choice is kept per match in `sessionStorage` (`ai-tcg.watchAs`, newest 50).
  The arena opens with `#view=<seat>&switch=<0|1>` (own seat and no switch for Agent match and history
  replays); a switch inside the arena comes back by `postMessage` (`ai-tcg-view`, checked against the frame
  and the origin).
- **The arena** (`renderHtml.ts`): the switch in the top bar, in each player's faction colour; `near` from the
  hash (or, opened on its own, the tab's last choice). `placeSides()` moves the rows, HUDs and hands into
  place; every element keeps its player's id, so code that finds a player's row by id is untouched. The six
  places that assumed p1 at the bottom now ask `near`: the attack lunge's direction, the cast tag's lane and
  anchor, the boast's loser-side clear, Match Boot's top and bottom, the header order, and the momentum
  gauge (mirrored). A switch drops effects still in flight and redraws the move shown; playback continues.
  During Match Boot or a boast it waits and flips when they end. `matchBootFx.ts`: a tap on the switch no
  longer skips the intro (like the playback buttons).

**Tests (+6, render 829):** `render/test/watchAs.test.ts`: `nearSeat`'s order; over the real owner API with
the ladder and a third account that only watches, the spectator's scoreboard, compact board and line follow
`defaultView` and the choice, the owner's own match has no switch whatever was chosen; a server without
`defaultView` gives p1; the Watch live widget at S/M/L with and without a choice; the site script keeps the
choice in the tab only and passes the hash; the arena page carries the switch, keeps every id, and no longer
holds the p1-at-the-bottom lines.

**Ran it:** `progress/render/evidence/pov-check-s52.mjs` -> `pov-check-s52.txt`: 48 browser checks, ALL PASS
(stills `v2-s52-pov-*.jpg`). The first run had 7 FAIL: 5 were the check's own (it compared rows with units
only, Directives sit there too; the boast spill sampler drew too few frames in software WebGL, so the arena
half now launches as the CI check does), 1 was real (a tap on the switch during the intro skipped the intro,
fixed in `matchBootFx.ts`), and the arena's switch cut the names short ("LOOKAHEAD-..."), seen in a still and
fixed (no capitals, wider). The website half passed first time. CI browser check re-run: 61 ALL PASS
(`ci-check-s52.txt`), so the default view is unchanged.

**Not done (named):** hands live face up (the owner's render-51 answer; next); the coin flip (the first coin
slice; next); a replay of a match the viewer doesn't own can't be opened from the site yet, so the replay's
switch is only reachable on standalone pages and the live arena; the render hardening pass (overdue since
session 40).

**Next render-lane slice:** hands live, face up, rebuilt from the feed's draw events, with the first coin
slice (the flip in Match Boot, the Chrome Token, reduced motion and sound), both on the near side the point
of view now gives.


## 2026-11-03 — Session 53: live hands face up; the coin flip in Match Boot (the first coin slice)

Owner feedback read: the answers to render session 52 keep all 6 calls and set the order: this slice (hands
live, face up, with the first coin slice), then a render hardening pass, then the second coin slice. The game
lane's half of coins is built (session 69: the `coin` slot, Chrome Token, `coins` on the record, the replay
file and the live view). Alternation: the last merged PR (#125) was the game lane's (session 71). No CRITICAL
item in the render debt list.

**Built:**
- **Live hands** (`site/liveFrames.ts`): each hand kept in the engine's order. A `playCard` step removes the
  card at its `handIndex` before anything else (the engine's splice comes first in `playCard`); each `draw`
  event appends its card. The hand count is checked against the snapshot after every step; on a mismatch that
  hand becomes backs for good (`handLost`). Each card's cost is the engine's `effectiveCardCost` worked out
  from the public board (non-dormant units' and Directives' `cardCostModifier` statics, a modal card's mode
  from its `play`/`evolve` event); while a signature unit is active its abilities are unknown, so the cost is
  marked `costUnsure`. The opening hands are in no event (dealt before the log starts): those cards are backs
  in place until played. `LiveStart.openingHands` takes them by card id if the feed ever sends them.
- **The arena's hand row** (`renderHtml.ts`): named cards face up in place, backs among them, "N from the
  opening hand, face down" (or "N cards, face down" when all are), a "?" on an unsure cost. A Command played
  from a named hand card should now fly from it live (the cast flight finds the chip by name; not checked
  in the browser).
- **The coin flip** (`coinFx.ts`, new; `matchBootFx.ts`; EFFECTS.md "The coin flip as built"): the plan as
  approved. `BOOT_MS` 2600 -> 3400, the still 1000 -> 1300; HANDSHAKE OK goes at 1.5 s; the coin (centre
  block with its result line, clear of both agent lines even at its 1.3x peak) spins 8 or 9 half turns,
  easing out, lands at 2.1 s on the face that says who goes first, settles, rings; the edge pulse into the
  first player's half (2.12-2.54 s) is the grammar's one exception, checked as such in `bootPlanProblem`; the
  line types at 2.2 s; the saying at 2.4 s; out from 3.0 s. The still: coin and line, then the saying at
  0.6 s. Sounds `coinFlick`, `coinWhir`, `coinClink` (`soundFx.ts`), dead centre, Skip cuts them.
- **Whose coin** (`renderHtml.ts` `coinOpts`): the near player's coin, portrait and faction ring; p1 always
  first; YOU / THEY GO FIRST when the page has no switch (the viewer's own match), else <P1 NAME> GOES FIRST.
  The portrait is the avatar SVG with its `currentColor` cells written in the faction colour (an `<img>` can't
  inherit it: the first still showed a dark square, fixed). `MatchReplay.coins`: from the match record or the
  replay file (`siteReplay.ts`), from the live view's per-side `coin` (`siteHost.ts`).
- **The Chrome Token** look (code-drawn hex, engraved node and traces, a glint, its edge as a band near edge
  on). Every other coin id flips the Chrome Token, flagged `fallback` (none can be owned yet).

**Tests (+14, render 843):** `liveFrames.test.ts`: every face-up card equals the engine's at that position and
cost in all 8 matches and the 3 signature matches; with the opening hands given, every hand is whole and
equal from move 0 (4 matches); backs never come back; a dropped draw turns that hand to backs, never a wrong
card. Sabotage check: without the cost aura, 6 of those tests fail. `siteLiveArena.test.ts` over the real
owner API: every face-up card equals the recorded replay's; the live page and the replay page flip the same
coins as the live view. `matchBoot.test.ts`: the new timings; the grammar with the coin on every layout, both
first players, animated and still, long names; seven new broken-plan cases caught (pulse in the wrong half,
toward the centre, before the landing; wrong face; off centre; too big for the gap; still up as the saying
lands); the line rules; the faces; the fallback; the sounds the same in every faction, the clink inharmonic,
the whir slowing.

**Ran it:** `progress/render/evidence/coin-hands-check-s53.mjs` -> `coin-hands-check-s53.txt`: 29 browser checks,
ALL PASS (stills `v2-s53-*.jpg`). The first run had 1 FAIL, the check's own (it sampled the coin's pixels once,
when the coin happened to be nearly edge on: 723 of 6400 lit; it now takes the most over the spin: 5914 of
6400). The stills showed the portrait face as a dark square (above, fixed). CI browser check 61 ALL PASS
(`ci-check-s53.txt`). `npm test`: all six workspaces pass.

**Not done (named):** the opening hands live (a game-lane ask, notes); the store and tier coins' looks (the
second coin slice); the economy's `drawn` flag for the Chrome Token stays false (its test checks coins against
the boast specs; a game-lane test change, notes); the committed `render/output` pages were not regenerated
(none since session 50; the site builds its pages on demand), so they still show the old 2.6 s intro.

**Next render-lane slice:** the render hardening pass, as the owner set it.

## 2026-11-03 — Session 54: hardening pass (stale checks rewritten, the check-E flake found, pages rebuilt, live hands whole)

Render session per the alternation (the last merged PR, #127, was the game lane's session 72). Owner feedback
read: the 2026-11-03 answers set the render order as "the hardening pass, then the second coin slice", naming
the stale session-25 ten-pack check, the session-36 loadout check and the check-E flake, and allowing the
site's live types to move to the game lane's new live-feed fields along the way. No CRITICAL debt item. No new
features.

**Raised to bar:**
- **The ten-pack check, rewritten** (`progress/render/evidence/pack-bulk-check-s54.mjs`, replacing session
  25's `pack-bulk-check.mjs`, now marked superseded). The old one was written for the first ten-pack design
  (an automatic sequence with speeds); the owner's 2026-10-18 feel notes made the open tap-driven with Auto off
  by default and the speeds only in Auto, so it timed out on hidden speed buttons. The new one drives four runs
  at 1280 x 800 and 390 x 844: T by tap (the default), A Auto 4x hands off, B Auto 1x through a big pull, C Auto
  2x with Skip at once and after the big pull; it checks pack order, the honest tell (sparks iff a hit), every
  face-down card turned by the right hand (tap or Auto), each big pull's reveals by finish, Auto never leaving a
  reveal under 700 ms, the controls (speeds only in Auto, nothing during a big pull), the summary against the
  store's plan, no scroll, no errors, and both choices remembered across a reload.
  Result: `pack-bulk-check-s54.txt`, **12 PASS**. Sabotage: Auto's row step changed to leave a pack's last
  face-down card unturned fails A and B on both screens, T stays green (it taps):
  `pack-bulk-check-s54-sabotage.txt`. Its own first run had one false FAIL (a Skip pressed while a pack sat
  sealed cuts it short on purpose; the old check had the same exemption for "never dealt"): fixed in the check.
- **The loadout check, brought up to date** (`loadout-check-s54.mjs`, from `loadout-check-s36.mjs`, marked
  superseded). Its 5 failures were all stale expectations: render 37 made the plate "<AGENT> WINS" over the
  boast's name (a close win opens on CLOSE CALL, then swaps), and the "bought" owner's balance is earned in real
  matches, so it moved with the rules (now read from the scenario). It also finds playwright wherever it is.
  Result: `loadout-check-s54.txt`, **49 PASS** (two new checks: the close plate's swap, and no close line on a
  plain win).
- **The check-E flake (session 47), found and fixed: it was the check script, not the page.** Clean, it passed
  every time (4 runs here, 5 in session 47). With eight busy loops beside the browser it stalled in 6 of 9 runs,
  always the same way: the second pack sat on its first card, free to leave, with nothing tapped. Probes added
  to the check showed the frame received exactly one press during that reveal (the tear) and the page none, and
  a tap sent by hand afterwards worked at once. Cause: after the tear the script waited 15 s for the `cards`
  phase; under load the tear and the cards rising took longer, so its tap loop saw no `cards` phase and never
  ran. Also found: after the last card left, the loop asked for a box for a card past the end and blocked 30 s.
  Fixed in `site-check-s47.mjs`: the tear gets 60 s, no lookup past the last card, each tap waits for the card to
  be free, a reveal tap is checked against this pack's log (the old wait matched any earlier Zero-Day arrival)
  and re-sent if dropped, and a stall now prints where it stopped and what a tap there lands on. Verified under
  the same load: see "Ran it".
  A wrong turn, named: I first suspected the pack page's hold-to-tilt timer was eating taps on a stalled main
  thread and changed the page to judge taps by event timestamps; a loaded run failed the same way with that
  change in, and the probes then showed no press reached the page at all. The page change was reverted (no
  page behaviour changed this session); the timer race stays in the debt list as an unobserved risk.
- **Every committed page rebuilt** (`npm run outputs -w @ai-tcg/render`, new: `render/tools/regen-output.sh`).
  The pages hadn't been rebuilt since session 50 and still played the 2.6 s intro with no coin. The 16 replay
  pages are played again through the engine, so they now show `rules-2` matches (owner call in notes); the four
  recorded pages still show the boast each was built to show (Boot Sequence in the main slot, a close win on 1
  health, another faction's starter, an empty slot). The loadout demo's transcript
  (`loadout-picker-s36.txt`) moved with the rules too (the bought owner now earned 302 credits, not 308).
- **The live arena reads the game lane's session-72 fields** (owner: "along the way"): the site host passes
  the feed's `openingHands` and each side's `faction` to the frame builder (`LiveStart.factions`, new), so every
  live hand is whole and face up from move 0 and each side wears its deck's faction from the first frame. A
  feed without them falls back as before. Tests: `siteLiveArena.test.ts` over the real owner API now requires
  no back in any hand in any frame, every card the replay's, and the feed's faction on every frame (sabotage:
  dropping either pass-through fails it); `liveFrames.test.ts` +1 (a given faction holds from frame 0; without
  it, Neutral first). The signature card in full and the live boast are not read yet (a slice of their own).

**Ran it:** `pack-bulk-check-s54.txt` 12 PASS (stills `v2-s54-fan-*`, `-big-pull-*`, `-auto-hit-*`,
`-summary-*`); `loadout-check-s54.txt` 49 PASS (stills `v2-s54-loadout-*`); `site-check-s47` 50 PASS clean and
6 of 6 runs under the load that stalled it 6 times in 9 before (`site-check-s47-load-s54.txt`); the CI browser
check 61 PASS (`ci-browser-check-s54.txt`); `npm test`: all six workspaces pass (render 844); typecheck clean.

**Not done (named):** the older by-hand checks (session 38's boot check expects the 2.6 s intro; the pre-41
boast, hardening, feed and pack checks) were not re-run; the other site checks' fixed 15 s waits were not
audited; the liquid's 20 fps bar (session 45) is still an owner question; nothing rebuilds `render/output`
automatically.

**Next render-lane slice:** the second coin slice, as the owner set it (the store and tier coins' looks, the
coin line in the picker and the Store), then reading `PublicSide.signature` and the live boast on the arena.

## 2026-11-04 — Render session 55: the second coin slice (every Season 0 coin drawn; the Coin line in the picker and the Store)

The owner's order after render 54 (owner-feedback 2026-11-03, "the next two render slices", item 1); the
2026-11-04 entry adds the 2× controls to the slice after this one, not this one.

- **The five new coin looks** (`render/src/coinFx.ts`). `coinDraw` generalised: round, hex or octagon
  outlines (the edge band's width follows the outline), a face design per spec (`traces`, `phosphor`, `neon`,
  `platinum`, `prism`, `mythic`), and optional neon/phosphor rim tubes with a breathing halo (`neon`,
  `neonGain`), a milled edge (`milled`), an in-air trail (`trail`), a time-driven sheen (`sheen`, `c.t`), a
  season mark (`mark`) and the spin's own sound (`whir`). Dial-Up Dime, Neon Nickel, Platinum (the approved
  Gold look as platinum), Diamond and Mythic, as approved. Tuned once by eye on the coin sheet (the Diamond's
  facets were washed out, the Mythic's rim blown out).
- **Match Boot** passes the clock and Neon Nickel's trail to `coinDraw`, plays the coin's own whir
  (`coinWhirModem`, `coinWhirNeon`, `coinWhirShimmer` in `soundFx.ts`, each keeping the nine slowing ticks),
  and draws a glowing-rim coin `COIN_NEON_REACH` (1.1) smaller, the checker counting the halo against the
  agent lines.
- **The coin sheet** (`src/coinSheet.ts`, `npm run coin-sheet`, in `npm run outputs`): six rows, each the
  design face, three moments of the spin, the portrait face, the tile size and a live loop; `--boot <dir>`
  also writes one replay page per coin for the browser check.
- **The Coin line in the picker** (`loadoutPicker.ts`, `loadoutText.ts`, `loadoutDemo.ts`,
  `site/siteLoadout.ts`): the sixth slot. Coin tiles show the coin drawn (`canvas.t-coin`); the preview
  (`COINPV`) flips the tile's coin (else the equipped one, else the Chrome Token an empty slot flips) over the
  dimmed preview board, alternating design up / portrait up with THEY / YOU GO FIRST, the agent's generated
  avatar as the portrait (`agent.avatarSvg`, new on the scenario), sound only on a pass the viewer asked for;
  reduced motion draws both landings still (and once more when the portrait image arrives, a defect the
  first check run showed: the still had been drawn on the placeholder silhouette). A fourth demo tab: an
  Aegis owner who earned 316 credits in 41 real matches and bought Neon Nickel.
- **The Store** (`site/siteClient.ts`, `siteWidgets.ts`, `sitePage.ts`, new `siteCoins.ts`,
  `siteCoinSwatch.ts`): each agent row says "Coin: …"; a coin on sale shows the coin drawn by
  `COIN_SCRIPT` (coinFx's own sources, inline, painting `canvas[data-coin]`). The swatch markup lives in an
  import-free file so the client bundle never loads `coinFx.ts`, whose module evaluates with `new Function`
  (the site's CSP has no `unsafe-eval`); a test checks the bundle has no `new Function`.
- **On sale:** `drawn: true` on all six coins in `economy/src/cosmetics.ts`; the catalogue test checks coins
  against `COIN_SPECS`; `economy/test/coins.test.ts` and `server/test/ownerApiEconomy.test.ts` moved with it
  (notes-for-owner, for the game lane).

**Ran it:** `coin-check-s55.txt` **60 PASS** (stills `v2-s55-*`); sabotage (every coin forced to the
fallback) 10 FAIL (`coin-check-s55-sabotage.txt`); `loadout-check-s54` re-run against the new page: 49 PASS
(not committed: unchanged result); CI browser check 61 PASS (`ci-browser-check-s55.txt`); `npm test`: all six
workspaces pass (render 852, +8; economy 222; server 365); typecheck clean. Every committed page rebuilt
(`npm run outputs`).

**Not done (named):** nobody has listened to the new whirs; `site-check-s49.mjs` expects five rail slots and
is stale; `server/OWNER_API.md` still says no coin is drawn (the game lane's doc); the "six landed coins
differ" browser check is weak (mean colour, portrait-dominated).

**Next render-lane slice:** the live arena reads the signature card in full and the live boast from the
session-72 feed, with the 2× controls (Ask for 2× and taking it back, who asks and who is waited on from
`LiveMatchView.speed`, the arena at the agreed rate, the "Ask for 2× in every match" toggle in Settings →
Play).


## 2026-11-05 — Render session 56: the live arena slice (the signature card in full, the boast before the result, the 2× controls)

Owner feedback read first. The 2026-11-03 order (render 54's answers) set this slice after the second coin slice;
the 2026-11-04 entry put the 2× controls into it; the 2026-11-06 entry (the Season 0 scope lock, freeze from 9
November) keeps it first in the render lane's order. Nothing in the slice is outside the locked scope.
Alternation: the last merged PR (#131) was the game lane's (session 74), so this is the render lane. Not a
hardening pass (the last was 54; the next is 59).

**Built:**
- **The signature card live** (`site/liveFrames.ts`). The live view sends the signature card in full since game
  session 72 (`PublicSide.signature`). The signature zone is drawn from it exactly as `capture.ts` draws a
  replay's (name, body, keywords, rules lines, `nextCost`, `timesPlayed`, `inZone`). Its abilities as data
  are rebuilt from the engine's signature menu (`signatureCardOf`): each rules line must name exactly one menu
  ability (every option at every size, indexed by text; a text two different abilities shared would be refused),
  else the card is left unknown and the session-51 fallback stays (live numbers, hand costs "?"). Rebuilt, the
  builder treats it as a card it knows: printed Barrier on arrival, the unit's printed stats, statuses' durations
  from its abilities, its trigger lines' rules text in the feed, and the hands' exact costs while it is in play
  (a Tax aura counts). `engineInternal.ts` re-exports `SIGNATURE_MENU`, read only.
- **The boast before the result** (`siteReplay.ts` `liveRecordOf`, `siteHost.ts`). The host turns the live view's
  `boast` into the arena's record as soon as the last move is out (`nextAt` null, the board at `released`, a
  winner on it), checked as a recorded match's is (the winner's boast, on the winner's health; a mismatch shows no
  boast, never a wrong one), and hands it over with the last move. The arena then plays the boast as it steps into
  the win, before GAME OVER, as a replay does. A page opened during the result's hold carries it from the start.
  When the live view already gave the boast, the host no longer reads `GET /api/matches/:id` at the end.
- **The 2× controls** (the owner's 2026-11-04 list):
  - `siteMatches.ts` `speedControlView` / `speedControlHtml`: the words for every state the server's `SpeedView`
    can be in: "Ask for 2×" (with "2× needs you and Rook to agree", or against the house "your ask alone makes it
    2×"); "You asked for 2×. Waiting on Rook." with Take back; "Nova asks for 2×. It starts when you agree." with
    Agree to 2×; "Playing at 2×: you and Rook agreed" (or "the house agrees to what you ask") with Back to 1×;
    nothing once the last move is out. A spectator sees a 2× pill and no button.
  - Agent match: the control under the scoreboard. The live arena opened on the owner's own match: the same
    control over the arena beside Close (`#rp-speed`). Watch live: a 2× pill on a card playing at 2×.
  - `siteApi.ts` `setLiveSpeed` (`PUT /api/live/:id/speed`), `SiteSpeed`, `ask2xEveryMatch` on the settings.
  - The arena at the agreed rate (`renderHtml.ts`): `live-rate` on the page, `rate` in every `/live-frames`
    answer and sent at once when the owner votes; following live at 2× the arena halves its step delay, so it
    keeps its distance from the newest move; the badge reads "LIVE · 2×". Paused or stepped back it uses the
    viewer's own speed.
  - Settings -> Play: "Ask for 2× in every match", a switch saved to the account (`PATCH /api/account/settings`);
    hidden for a house account (the server ignores the house's setting).
- **The demo** (`siteDemo.ts --ladder`): House Null's agent, Static Widow, is made by the real "Generate a new
  agent" draft (`startAgentDraft`, `pickDraftAgent`, `confirmAgentDraft` with the typed name), so the ladder has a
  signature card to show live (Encore of the Laser Tag Arena).

**Tests (+23, render 875):** `liveFrames.test.ts`: the three signature matches now compare everything (zone, unit,
feed lines, hand costs; before, the zone was required to be absent and the signature unit compared by its live
numbers only), plus three more with lookahead agents, all with the opening hands: every frame equals the captured
one, no cost unsure, a signature card played onto the board; `signatureCardOf` rebuilds every card the menu can
make at every size (over 600), equal to `buildSignatureCard`'s; a card it can't rebuild falls back (zone from the
feed, hand costs unsure while in play). `siteSpeed.test.ts` (17): every vote state's words, the HTML, the page's
rate, `liveRecordOf`'s rules (not before the last move, a draw, never a wrong boast), and over the real owner API
with the ladder on a moved clock: ask, waiting, agree (the arena's frames at rate 2, a page opened then starts at
2), take back, a refusal; the Settings switch saved and read back; the read that brings the last move brings the
boast, before the match is recorded, equal to the replay's record.

**Ran it:** `progress/render/evidence/site-check-s56.mjs` -> `site-check-s56.txt`: **26 PASS, 0 FAIL** against the
real owner API and the game lane's ladder (the demo at 2x): A, Static Widow's zone drawn on the live arena and equal
to the feed's at the move shown in 15 of 15 samples, no hand cost unsure; B, Nova's own match against the house:
the control, her ask makes it 2× (the server's rate), "Playing at 2×", the arena's badge "LIVE · 2×" with the
control beside Close, the arena keeping within 4 moves of the newest, Back to 1× over the arena (the server's rate
1, the badge back to LIVE at once); C, the boast started 33 s before GAME OVER landed (the boast's canvas in
software WebGL, quality-debt), and the read that brought the last move brought the boast, before the match was
recorded, equal to the replay's record; D, the Settings switch saved, read back in a second browser, and Nova's
next match started with her ask (rate 2 against the house); no external requests, no page errors. Earlier runs of
the same check found five faults in the check itself, each fixed and re-run (the frame lookup, too few zone
samples, the 2× test starting too late in a short match, the reload, a match already live before the switch):
the Rook path ("Waiting on Rook", Rook's "Agree to 2×", 2×) passed in full in the second run, when Nova's match was
against Rook. Stills `v2-s56-signature.jpg`, `v2-s56-agent-match-2x.jpg`, `v2-s56-arena-2x.jpg`,
`v2-s56-ended.jpg` (the settings still timed out). CI browser check 61 PASS (`ci-browser-check-s56.txt`).
`npm test`: engine 365, protocol 7, server 139, agents 17, economy 222, render 875, all pass; typecheck clean.
Every committed page rebuilt (`npm run outputs`: the new `live-rate` tag and code only).

**Found on the way:** session 51's check finds the live frame by a URL ending in the key; since session 52 the
arena's URL carries `#view=…`, so that check (and any copy of it) no longer finds the frame: fixed in the new
check, `site-check-s51.mjs` left as it was (stale: quality-debt). In software WebGL the boast took about 35 s to
give way to GAME OVER (a 3 s boast): the boast's canvas is slow there (as session 51's stills timing out showed);
never measured on a GPU.

**Not done (named):** no notification of the other owner's ask (the game lane's notifications are queued); the
vote's state is the last 3 s read; the Home Live match widget has no control (replaced by Agent controls next);
the wording of the buttons is this lane's (a check-in call).

**Next render-lane slice (the owner's 2026-11-06 order, item 2):** My agent and Agent controls (Agent controls
replaces the Live match widget): the S/M/L split in `progress/season0-final-brief.md`, the personality dial (play
styles exist: `PUT /api/agents/:id/play-style`), and the time ring once the game lane's play-time allowance is in
(build the dial first if it isn't).

## 2026-11-05 — Render session 57: My agent and Agent controls (the Season 0 brief, section 1)

Owner feedback read first: no new entry since render session 56's PR; the 2026-11-06 order (the Season 0 scope
lock) puts My agent and Agent controls second in the render lane, after the live-arena slice (#132, merged).
Alternation: the last merged PR (#133) was the game lane's (session 75), so this is the render lane. Not a
hardening pass (the last was 54; the next is 59). The play-time allowance (game item 2g, session 76) isn't on the
server yet, so, as the order says, the dial and the rest are built first and the time ring is ready for it.

**Built (`render/src/site/siteAgent.ts`, new; pure views + HTML, wired into the widget board):**
- **My agent** at three sizes that differ in content (the brief's table): S the portrait, name, status and rating
  (`GET /api/rating`, newly read by the site: `SiteApi.rating`); M + today's W/L (`GET /api/daily`'s wins and
  losses), the streak (from the history: an opponent's abandon counts as a win and your own as a loss, as the
  rating does; cancels skipped; a draw ends it; a streak of one isn't shown) and the deck's faction; L + the rating
  trend (an inline SVG line from `GET /api/rating`'s recent list, oldest first, ending at the rating now, with the
  change over those matches) and the last four matches with Replay.
- **Agent controls** (replaces Live match; the server's widget id stays `live`, so saved boards keep it): S the
  portrait inside the time ring, status, Start / Stop (the auto-play switch as one button; a house agent "Always
  plays"); M + the personality dial, the 15 / 30 / 60 buttons, the deck line, "Go to match" beside Stop while a
  match is live; L + the deck switcher ("Your agent picks", then each deck; an incomplete deck can't be picked),
  the match history, +15 / +30, and the style's summary.
- **The personality dial:** a knob with one notch per play style the server lists (six, 60° apart), each a real
  button named for its style, the pointer turning to the chosen one. A click is `PUT /api/agents/:id/play-style`.
  The note says "Applies from the next match"; with a match live in another style, "This match: Calculator. Rusher
  from the next match." (the ladder seats each agent with its style at the match's start, so it never changes
  mid-match; tested over the real ladder).
- **The time ring:** `timeRingView` covers every state the brief names: minutes left as the lit share of the ring
  (amber under 20%), "Finishing match" and "Done for today" at zero. With no allowance from the server (today) it
  shows auto-play as it is: a full ring "On" ("no time limit set"), an empty grey "Off", or "Always" for a house
  agent. The 15 / 30 / 60 and +15 / +30 buttons are drawn disabled with "Time limits arrive with the server's
  play-time allowance." Only the adapter from `GET /api/play` and the buttons' click remain once the game lane
  ships 2g.
- Live match's old body (scoreboard, compact board, play-by-play) is gone from Home: Agent controls takes no live
  board (Watch live's two-board cap now counts only Watch live), and "Go to match" opens the match page.
- The site reloads the rating with the history and today's earnings when the agent's match ends.

**Tests (+7, render 882):** `test/siteAgent.test.ts`: the rating line (placed and in placement), the trend (points,
change, a flat line still draws), the streak's rules, every ring state and the arc's lit length, the dial (angles,
one pressed, the next-match note, busy), the deck switcher (the agent's own deck not listed twice, an incomplete
deck blocked), each size showing more than the one below; and over the real owner API with the ladder playing:
the rating equals `GET /api/ladder`'s `you`, the trend ends at the rating now, today's W/L adds up with the day's
history, and the dial's change made during a live match leaves that match's style alone and the next match plays
the new one; the deck switcher's two choices saved and read back. Four older tests updated (the "live" widget no
longer draws a board or a switch).

**Ran it:** `progress/render/evidence/site-check-s57.mjs` -> `site-check-s57.txt`: **37 PASS, 0 FAIL** against the
real owner API and the game lane's ladder (the demo at 4×): A, both widgets at S, M and L on Nova's saved board,
the rating the server's (1526, Gold), today's "3W 4L" `GET /api/daily`'s, the content per size as the brief's table;
B, the Rusher notch clicked during Nova's live match: saved, the pointer at 60°, "This match: Calculator. Rusher
from the next match.", the live view still Calculator; C, Stop (auto-play off, the ring Off), Start (on again); D,
"Cortex, my tweak" picked (forced) then "Your agent picks" back; no external requests, no page errors. The first
two runs found three faults: the avatar's own SVG was caught by the ring's `svg` rule and hid the ring (fixed:
`.tring > svg`), Agent controls overflowed at M and L (fixed: the summary only at L, a smaller dial at M, "Go to
match" beside Stop), and the 60 / +15 buttons overlapped at L (fixed); and one fault in the check itself (it tried
to pick the agent's own deck, which the "Your agent picks" row stands for). Stills `v2-s57-size-S.jpg`,
`-size-M.jpg`, `-size-L.jpg`, `-dial-live.jpg`, `-stopped.jpg`, `-deck-forced.jpg`, `-deck-agent.jpg`. CI browser
check 61 PASS (`ci-browser-check-s57.txt`). `npm test`: engine 365, protocol 7, server 151, agents 17, economy 222,
render 882, all pass; typecheck clean.

**Not done (named):** the time allowance itself (waits on game session 76; the ring and buttons are ready, the
adapter isn't written, so nothing guesses the server's field names); no 2× control on Agent controls ("Go to
match" leads to it); the trend reads `GET /api/rating`'s recent list (up to 20 matches), not the Stats data (game
item 2e) the brief names, so it may move to that when it lands; the dial was only clicked with a mouse in the
browser (keyboard: each notch is a button in tab order, not a radio group with arrow keys).

**Next render-lane slice (the owner's 2026-11-06 order, item 3):** the pack opening ceremony, part 1: the bigger pack
art, the gradient backdrop with its tells, the tear and the burst. When game session 76 lands the allowance, a small
follow-up wires the ring and the time buttons (the adapter and `data-act="play-time"`).

## 2026-11-05 — Render session 58: the pack opening ceremony, part 1 (the backdrop tell, the tear, the burst); the time ring on the server's allowance

**Read first:** owner-feedback.md (the 2026-11-06 order: render item 3 is the ceremony part 1; nothing new for this
lane since session 57), `progress/season0-final-brief.md` section 3, the 2026-10-18 pack notes (hold to tilt, the
honest tell), game session 76's allowance in `server/OWNER_API.md`. Not a hardening pass (54 was; 59 is next).

**1. The time ring, live (the follow-up session 57 named):** `SiteAutoPlay` carries `allowance` and `canAddTime`;
`siteApi` sends `minutes` on `PUT /api/play/auto-play` and has `addPlayTime` (`POST /api/play/auto-play/time`).
`allowanceOf` (siteAgent.ts) turns the server's allowance into the ring's, counting down from `endsAt` on the
page's clock between reads (never above the server's own count); the arc is drawn from the seconds left.
`timeButtonsView` decides each button: 15 / 30 / 60 live unless the day's rewards are maxed (a preset while time
runs replaces it, its tooltip says so); +15 / +30 only when the server says `canAddTime`; each refusal says why (no
allowance, no time limit, done for today, the window already runs to midnight). The stop reason is worded by what
stopped it (`timeUp` is no longer called "rewards maxed"). The client's `setAutoPlay` takes the minutes, the
`play-time` buttons call it.

**2. The ceremony, part 1 (the brief's beats 1 and 2):**
- `packOpening.ts`: `PackTell` on every `PackReveal` (`planReveal`, so the site, the first-time flow and the demo all
  get it): the best card (best finish, then rarity, then the later card), its rung on a five-rung ladder (calm,
  shimmer, charged, radiant, overload), the backdrop's rung (one lower on about 1 pack in 4 above plain, from a
  32-bit mix of the opening's seed: nothing rolled), the burst (the best card's colour, its faction's, a size).
  `TELL_BACKDROPS` (colours, pulse period and strength per rung) ship in the page's timings.
- `packPage.ts`: the backdrop (`.bd`, registered colour properties so the colours ease from pack to pack, a drift
  layer and a pulse); the pack bigger (`--pw` up to 300 px) with a code-drawn plate (`packPlateSvg`, the same for
  every pack of a set); a hover lean (`.lean`, 5°, mouse only); the tear as a `--tp` property: the strip's torn
  part is a flap that peels up from the head, the rest clipped, a jagged head under the cursor, light in the
  backdrop's glow leaking through; the head moves 1:1 with the cursor from wherever it was held
  (`packTearStep`); letting go holds it with a hint; a tap finishes it from where it is. One particle loop
  (`PFX`) now draws the sparks, the scraps and the burst's motes. `burst()`: a light bloom and a ring drawn at
  full size and grown into (so the ring's line stays thin), a screen flash, motes, sized by `packBurstPlan`.
  Fixed on the way: the wrapper printed "6 CARDS" on a pack holding a Prototype bonus card (a giveaway); it now
  always says 5.
- `soundFx.ts`: `scrub()`, a continuous rip (a band-passed rasp and a high-passed crackle) whose level and pitch
  follow `sfxScrubLevel(speed)`, smoothed; a `burst` recipe per tier (a whoomp, a swell, a voice-tinted tail).

**Tests (+17, render 899):** `packTell.test.ts` (over 1,000 real store openings: the best card is the best finish,
the backdrop never above it, an under-promise exactly one rung low, the rate within 7 points of 1 in 4, both
"itself" and "an under-promise of the rung above" seen on a rung; the tells pure and from the seed; the rungs in
order; the tear, speed, scraps, burst plan and plate helpers; the rip's level and the burst sound by tier; the page
ships the backdrops and the sealed pack's markup reads nothing from the tell or the card count), `siteTime.test.ts`
(the adapter and buttons pure; then over the real owner API with the ladder: 15 minutes, 9 left after 6, +15 to
24, time up mid-match "Finishing match" with "Go to match", the match finished and "Done for today", nothing
paired after, midnight Sydney clean and "Off"). Two older pins updated (the pack sound list, the committed pages).

**Ran it:** `pack-ceremony-check-s58.mjs` -> **127 PASS, 0 FAIL** (six packs at 1280 x 800 and 390 x 844: the
backdrop on the tell's rung with its colour computed on the page, the pack bigger, the lean the same for every
pack, a real mouse drag to 40% holding at 40% with the flap at the same place, scraps, the rip's scrub voice
running and its level rising, picked up mid-strip carrying on from 40%, the burst in the tell's colour and growing
with the rung, the cards rising; a tap still tearing; no requests, no errors, no sideways scroll). The first runs
found: the scraps never flew on a phone (each move was under 7 px; fixed by carrying the distance over), the
burst's ring drawn as a scaled 10 px circle grew a 130 px-thick line (fixed: drawn at full size, scaled up into),
and the bloom read as a hard disc (softer stops), plus "6 CARDS". `site-check-s58.mjs` -> **18 PASS** (the time
buttons on the real server: 30 min, +15 to 45, the ring draining across a reload, S and M, Stop). CI browser check
61 PASS. `npm test` (render) 899 pass; typecheck clean. Every page under `render/output/` rebuilt (the replays
change only by the sound source they embed).

**Not done (named):** parts 2 and 3 of the ceremony; the ten-pack's mini packs keep the old tear; the site's
Packs and Store widgets still draw the small pack; 60 fps unmeasured (software rendering only: 14-16 fps at
desktop size during the drag); the rip judged by its level, not by ear.

**Next render-lane slice (the owner's order, item 4):** the ceremony part 2: the reveal escalation across the
reveal kinds (dim, the card back's glow stages with pauses, the slow flip, flash, shake, bass hit, faction-colour
particles), the faction ward flare as a card lands, the sound per tier. Session 59 is the render lane's hardening
pass by the every-5th rhythm (54 was the last): do it first if it falls due, then part 2.

## 2026-11-09 — Render session 59: the render hardening pass (the closed-#137 comparison, the ring's tick, the dial by keyboard, two stale checks)

**Lane:** render (TASKS.md step 0: the last merged PR, #143, was game; the owner's 2026-11-08 catch-up, render 1 of
2). No render PR was open. **Read first:** owner-feedback.md (2026-11-06 item 3, 2026-11-08's three entries),
DESIGN.md, this lane's log, debt and notes. A hardening pass by the every-5th rhythm (54, 59), so no new features.

**1. Closed PR #137 against main (the 2026-11-06 owner entry, item 3).** #137's branch is one commit on the base
#136 also started from. Everything it built is in main through #136 (the allowance adapter, the time buttons and
their handler, the `timeUp` wording, the dropped `allowance: null` placeholder), with one exception: its faster
status reads near the end of the allowance. Carried over as `statusPollMs` (`siteAgent.ts`, pure): 1.5 s while a
rebuild runs, **5 s in the allowance's last 30 s and while the agent finishes its match**, else 15 s, used by the
client's `schedulePoll`. Nothing else from #137 was missing.

**2. The ring ticks once a second (debt: "the ring only updates on the page's 15 s poll").** `ringParts` (the
arc's lit length, the label, the centre) is shared by the drawn ring and a once-a-second `tickRings` in the client,
which patches the ring and its caption (`.ac-cap`) in place from the last read on the page's clock (`ringOfPlay`),
only while an allowance runs (`ringTicks`), so nothing the viewer is focused on is redrawn and the two can't
disagree. **Found by the browser check:** the first run showed the arc moving once in 6 s: `timeRingView` rounded
the lit share to whole percents, so a 15-minute ring stepped only every 9 s. Now to a tenth of a percent (one older
pin, 58 -> 58.3, updated).

**3. The personality dial is a radio group (debt: "buttons in tab order, not a radio group with arrow keys").** The
knob is `role="radiogroup"`, each notch `role="radio"` with `aria-checked`, one tab stop (the checked notch).
Right/Down go clockwise, Left/Up back, wrapping, Home/End to the first/last (`dialKeyTarget`, pure); the style it
lands on is chosen and saved like a click (applies from the next match), focus follows.

**4. Two stale browser checks fixed and re-run (debt: "most by-hand checks are never re-run").**
`site-check-s49.mjs` expected five rail slots (the Coin is the sixth since 55) and counted coins as buyable boasts:
**40 passed, 0 failed** (`site-check-s49-rerun-s59.txt`). `site-check-s51.mjs` missed the arena's `#view=` URL (in
two places) and expected face-down live hands (whole since session 54): **28 pass, 0 fail**
(`site-check-s51-rerun-s59.txt`). Both are slow in software WebGL (5-10 minutes each).

**Tests (+4, render 903):** `siteAgent.test.ts`: the tick patches exactly what the widget draws at 9 moments from
0 to past the end, the arc's share, the drain to "Finishing match"; when the tick runs; the status cadence (every
case, including a 31 s read that crosses 30 s on the page's clock); the dial's keys; the dial's radio markup (one
checked, one tab stop). `npm test -w @ai-tcg/render` 903 pass; typecheck clean.

**Ran it:** `site-check-s59.mjs` -> `site-check-s59.txt`: **25 PASS, 0 FAIL** on the real owner API with the ladder
at 1×: T1, 15 min given, over 6 s with no status read the arc shortened 6 times (247.3 -> 245.8 of 251.3) and
only ever shortened, the minutes the server's, reads 15 s apart; T2, with `GET /api/play`'s allowance rewritten in
the browser to 20 s left (everything else the server's), the ring counted to "Finishing match" on the page's
clock, reads came every 5, 5, 5, 5 s, then 15 s again once the rewrite stopped; T3, by keyboard only: one tab stop,
ArrowRight, ArrowLeft, End, Home each saved on the server with focus, `aria-checked` and the tab stop following,
Enter on the checked notch changing nothing; no external requests, no page errors. The first run's 1 FAIL was the
whole-percent finding above. Stills `v2-s59-tick-running.jpg`, `-tick-last-seconds.jpg`, `-tick-finishing.jpg`,
`-dial-keyboard.jpg`. CI browser check **61 passed, 0 failed** (`ci-browser-check-s59.txt`).
`render/output/site/index.html` rebuilt (it bundles the client).

**Not done (named):** "Finishing match" and the 5 s cadence were seen in the browser on a rewritten response, not on
a real allowance run out (the Node test of session 58 covers that path on the real server); an arrow on the dial
saves at once, so arrowing across three styles makes three saves and three toasts; the other stale checks (s38's
boot check, s3x boasts, s40, feed, pack checks, s45 liquid) are still not re-run.

**Next render-lane slice (the owner's order, item 4):** the pack opening ceremony, part 2: the reveal escalation
across the reveal kinds (dim, the card back's glow stages with pauses, the slow flip, flash, shake, bass hit,
faction-colour particles), the faction ward flare as a card lands, the sound per tier. That session is render too
(catch-up 2 of 2), then plain alternation.

## 2026-11-09 — Render session 60: the pack opening ceremony, part 2 (the reveal escalation, the ward flare, the sound per step)

**Lane:** render (TASKS.md step 0: the last merged PR, #144, is "Render:", but the owner's 2026-11-08 catch-up holds
until two "Render:" PRs have merged after #143; #144 was the first, so this is catch-up 2 of 2). No render PR was
open. **Read first:** owner-feedback.md (nothing new for this lane since the 2026-11-08 entries; the season-end
warning is queued as render item 7), DESIGN.md, `progress/season0-final-brief.md` section 3, this lane's log, debt
and notes. Not a hardening pass (59 was).

**1. The ladder (`packOpening.ts`, pure, travels with each card as `RevealCard.build`).** `REVEAL_LADDER`: snap,
plain Rare, plain Mythic, Foil, Full Art, Alt Art, Glitch, Gold, Secret, Prototype, Zero-Day. `revealBuildOf(reveal,
rarity, faction)` turns a card's step into its whole build: held or not, glow stages (the tell's rungs: 1, 2, 3 or
4, never above the card's own), stage, pause and last-pause times, the flip, the room's dim, the sound's duck, the
flash, the shake (px, ms), the bass tier, motes and their reach, the ward (none / ring / double) and its size, the
hold, and `timeline` (`buildTimeline`: when each stage, the flip and the hit play). Every number is a function of
the step (a Mythic in a finish half a step up), so the escalation is monotone by construction; the tests check every
adjacent pair. `planReveal` sets each snap's pitch (+2 semitones per snap in the pack). The site's client plans its
openings with the same code, so the website gets the builds too.

**2. The page (`packPage.ts`).** Every card rises face down. A snap flips by itself in 150 ms at the top with its
pitched tick, and never blocks a tap. A held card waits: on a tap `roomDown` (the dim layer to the build's level,
`SND.duck`), the stages play from the timeline (`--gc`/`--gn` on the card: an aura behind it, the back's rim and
logo in the stage colour, a tremble growing per stage; a `riser` sound per stage), then `flip`, then `hit`: the
flash in the top stage's colour, `bshake` on the stage, the `bass` hit, `PFX.motes` in the faction's colour, and
`wardFlare`: the faction's ring (tinted once per faction at load on a canvas, drawn with `screen`), doubled and
counter-rotating for a Mythic, behind the card, removed when the card leaves. The Zero-Day takeover ends on the same
hit. Only transforms and opacity animate (the back's rim is the one box-shadow). Reduced motion: no shake, the
ward fades in without turning.

**3. Sound (`soundFx.ts`).** `riser` (always rises; each stage a fourth higher), `bass` (a sub drop, deeper and
longer with the step's weight; only its tail takes the faction), `flip` takes `o.pitch`. `SND.duck(level, ms)`
drops the master bus; a sound with `o.lift` goes through a new lift bus straight to the limiter at full volume, so
the build's own risers and hit stay up while the room goes quiet. (The first try put a "bed" gain in front of the
master; the music tests find their duck node by graph shape and broke, so the master itself ducks now.)

**4. The ward rings.** `tools/pack-wards.mjs` crops cell 3 (the single ring) of each faction sheet in headless
Chromium (the machine's PIL is broken) to 320 px WebP: `render/assets/wards/pack/*-ring.webp`, 11-19 KB each.
`packWards.ts` reads them Node-side; the three page builders pass them in, because `packPage.ts` is also bundled
into the website's client and must not touch the file system. Without them the flare is a drawn ring.

**Tests (+15, render 918):** `packBuild.test.ts` (14: the ladder's order; every adjacent pair builds longer and hits
at least as big in every measure and bigger in one, darker and quieter; the snap; the timeline's arithmetic; the
glow's colours; over 1,000 real openings: snaps exactly the plain Commons and Uncommons, every pack holds a build,
the glow exactly the card's rung, the ward by rarity and faction, the snap pitches, purity; the riser, bass and
pitch recipes; the page's data and that the new keyframes animate only transform and opacity), and the duck/lift
test in `soundFx.test.ts`. Pins updated: the pack sound list.

**Ran it:** `pack-ceremony-check-s60.mjs` -> **370 PASS, 0 FAIL** (ten packs on desktop, three on a phone, every
card). It found three real bugs on the way: (a) a card's "room back up" timer, still pending, lit the room halfway
through the next card's build (now `roomUp(k)` only lifts the room card k dimmed); (b) a tap within a snap's 150 ms
flip was swallowed (snaps no longer set `busyUntil`); (c) after the Glitch flip the dim's opacity was set to 0 but
never faded (clearing the inline transition left it stuck; now an explicit transition). Two things it records as
software-rendering only: with a foil or glitch shader running the page drops to 0.8-10 fps and the room's fade
takes 2-5 s of wall time (logged with the measured fps); the Glitch's hit lands up to ~0.9 s late (its ghost layers
cost frames; a named allowance). It also tears by tap when a pack sits in "torn" past 8 s (seen on two packs; the
tear's timers are starved the same way; the tear code is unchanged this session). Session 58's check re-run: 127
PASS (`pack-ceremony-check-s58-rerun-s60.txt`). The ten-pack check s54 needed one model change (inside a big pull a
card is held by its build, not `faceDown`) and then passed 12/12 (`pack-bulk-check-s54-rerun-s60.txt`). CI browser
check 61 passed. `npm test` (render) 918 pass; typecheck clean. Every page under `render/output/` rebuilt (the
replays change only by the sound source they embed).

**Not done (named):** part 3 (the Prototype takeover, the afterglow, NEW stamps, the set bar, Open 10 stopping on
hits, the debug panel); the Mythics' own unique wards are not used in the flare; nothing measured on a GPU; the
sounds judged by their recipes and counts, not by ear; `pack-opening-check`, `pack-tap-check` and
`pack-tilt-check` don't even start on this machine (they import Playwright by a path that isn't here).

**Next render-lane slice:** after this PR the catch-up is done and plain alternation resumes, so the next session
is game. The next render session: the pack opening ceremony, part 3 (the brief's beat 3 Prototype takeover and beat
4 afterglow, Open 10's stops, the debug panel), then the store layout.

## 2026-11-10 — Render session 61: the pack opening ceremony, part 3a (the Prototype takeover, the afterglow, the set bar)

**Lane:** render (TASKS.md step 0: the last merged PR, #146 "Season end, part 2", is not "Render:"; the catch-up
after #143 is done, #144 and #145 merged). No PR from either lane was open. **Read first:** owner-feedback.md (the
2026-11-10 entries: the s60 calls kept, 2 and 5 waiting on the owner's try; the season-end pack warning no longer
wanted, marked dropped on the checklist; the rest is game-lane), DESIGN.md, `progress/season0-final-brief.md`
section 3, this lane's log, debt and notes. Not a hardening pass (59 was).

**Scope:** part 3 of the brief's section 3 is four things; this session built two in full (the Prototype takeover,
the afterglow with NEW stamps and the set bar) and leaves Open 10's stops and the debug panel to part 3b, rather
than ship all four thin.

**1. The takeovers (`packOpening.ts`, pure).** `RevealBuild` gains `takeover` (`prototypeTakeover()` /
`zeroDayTakeover()`: the beats from the takeover's start, `hitAt`, `endAt`, and for a Prototype `count`, its
serial's count up from `serialCountUp`, at most 14 ticks, ending on the serial) and `hitAt` (tap to hit:
`timeline.landAt`, or `flipAt + takeover.hitAt`). Both top steps keep the four-stage build, and the takeover
replaces the flip. The Zero-Day used to skip its build and hit at ~4.0 s, below a Gold (4.4-4.6 s), against the
owner's 2026-11-10 call 6; now Prototype 8.1 s < Zero-Day 8.7 s, monotone to the top.

**2. The Prototype takeover (`packPage.ts`, `protoTakeover`).** A `.pt` layer inside the stage (under the scene, so
the card stays on top): black; the bloom (a turning conic ray field, masked radial, and a gold core; transforms and
opacity only), "PROTOTYPE · RUN <run>", the top bar faded back (`body.takeover`); the card flips over at 1.22x with
the gold layer ramping in; the marker "PROTOTYPE · <set>" stamped on its number line (`.mk`, a new `pendingMarker`
face option); the plate counting up with a `tick` per number; the slam: `hit()` (flash, shake, bass, motes, ward),
a `stamp`, the new `fanfare`, sparks, the core flaring; the field holds 1.1 s, fades, the card settles back. Every
beat from the takeover's own times.

**3. The Zero-Day (`zeroDay`).** Now called at the build's `flipAt`; every beat is scheduled from its start (the
typing used to chain one timer per character). The browser check then showed its hit still 3-8 s late in software
rendering, and the log showed why: `zeroDayArrive` was on time, but `settleFx` compiled the finish shader before
`hit()` ran (3 s in SwiftShader). The hit now lands first: +25 ms. It also lifts the room the build dimmed.

**4. The afterglow.** The hover tilt (`afterglowLean`/`afterglowRest`): a mouse over a landed held card leans it up
to `AFTERGLOW.hoverDeg` (11) with no press; leaving or the card leaving springs it back and logs the peak. The
summary (`summary`, `bindFan`, `afterglow`): the cards fly into a fan (`.pfan`, each tile placed by `--o` with
`--fdeg` and `--fdrop`; the width formula covers the outer cards' swing, checked against the summary's clip box on a
phone); the NEW stamps slam one after another (`newslam`, a `stamp` each) from `reveal.afterglow.stamps`; the set
bar shows `before` and ticks per `afterglow.ticks` (a `tick` each, a semitone higher); the caption line follows the
pointer or keyboard focus. Nothing blocks the buttons.

**5. The set bar (`setBarOf`, `withSetBar`).** `before` = the binder's base count after the open minus the base
places this pack filled; a place is filled when every copy of that card now held came out of this pack
(`ownedAfter` = its count in the pack), and only for cards in the set (`cardSet`). The demo reads
`store.binder(...).base` after each showcase open; the website reads `GET /api/collection/binder/:setCode` after
an open (`withBinderBar` in `siteClient.ts`, `withSiteSetBar` in `siteStore.ts`), and plays without a bar if that
read fails. `PackReveal.afterglow` is the plan (`afterglowPlanOf`), redone when the bar is added.

**6. Sound (`soundFx.ts`).** `tick` (a short bright tick; `o.pitch` raises it) and `fanfare` (a major arpeggio onto
a held chord of filtered saws, a bell in the voice's colour; the tier sets the climb). The pack sound list pin
updated.

**Tests (+12, render 930):** `packAfterglow.test.ts`: only the two top steps take over; the takeover starts at
`flipAt` after four stages; tap-to-hit strictly rises up the whole ladder and the old Zero-Day was below a Gold; the
Prototype's beat order; the serial count; over 300 real one-at-a-time openings, the bar's `before`/`after` equal
the store's binder read before and after each open, one place per card filled, every filled card NEW; the afterglow
plan over the same packs; the page reads the plan; the new keyframes animate only transform and opacity; the two
new sounds.

**Ran it:** `pack-ceremony-check-s61.mjs` (session 60's check, now on `hitAt`, plus the new beats) -> **456 PASS,
0 FAIL**. It found, on the way: the `takeover` log entry's `kind` field overwrote the event's kind (renamed `as`);
the Zero-Day's late hit (above); a six-card fan overflowing the summary's clip box on a phone (the check had
compared with the viewport; now with the summary, and the width formula fixed); the field's fade-in was read
before its 0.45 s transition ended (now waited for). The Glitch's hit came 1.28-1.30 s late in two runs (the s60
allowance was 1.2 s; raised to 1.5 s, named). Re-runs: session 58's check 127 PASS
(`pack-ceremony-check-s58-rerun-s61.txt`), the ten-pack check 12 PASS (`pack-bulk-check-s54-rerun-s61.txt`), the
CI browser check 61 PASS. `npm test` (render) 930 pass; typecheck clean. Every page under `render/output/` rebuilt.

**Not done (named):** part 3b (Open 10's stops, the debug panel); a fan and set bar on the ten-pack summary; a
fanfare per tier (only the Prototype has one); a still of the Prototype's slam (software screenshots land after the
field fades; the log proves the beat); nothing measured on a GPU; sounds judged by recipe, not by ear.

**Next render-lane slice:** after this PR the next session is game. The next render session: the pack opening
ceremony, part 3b (Open 10 stops on every Rare, Mythic, special finish and Prototype; the owner-only debug panel
on the demo pages forcing the next pack's best card to any reveal kind, including Prototype), then the store
layout.

## 2026-11-10 — Render session 62: the pack opening ceremony, part 3b (Open 10's stops, the debug panel)

**Lane:** render (TASKS.md step 0: the last merged PR, #148 "Marketplace groundwork", is not "Render:"; the catch-up
after #143 is long done). No PR from either lane was open. **Read first:** owner-feedback.md (the 2026-11-10 answers:
all eight s61 calls kept, part 3b next; the feel check on 11 Nov is the owner's, nothing changes until then),
DESIGN.md, RENDER.md, `progress/season0-final-brief.md` section 3, this lane's log, debt and notes. Not a hardening
pass (59 was; the next is 64).

**1. The stops (`packOpening.ts`, pure).** `isBulkStop(card)` = the card's build is held: every card above a snap on
the ladder (a plain Rare or Mythic, every finish above Standard, a Prototype, a Zero-Day). `bulkStopsOf(bulk)` lists
them in the order the owner meets them, each with its step, its 1x tap-to-hit and hold, and `big` (its pack is a
store full reveal, so it plays in the one-pack stack). Every pack has at least one (its Rare slot): a ten has 13-17.

**2. Open 10 on the page (`packPage.ts`).** A held card now deals face down in the row (before, only a non-Standard
finish did; a plain Rare or Mythic dealt face up) with an aura, and the row's tap on it plays its own build where
it lies (`rowBuild`): the room dims and ducks, the back climbs its glow stages with their pauses, the slow flip, the
hit (flash, shake, bass, faction motes, ward), the rest of the row stepping back while it builds. At its full 1x
length whatever the Auto speed. **Auto** still tears, deals and moves between packs by itself at its speed, but at
a stop it waits for the owner's tap ("Stop · tap to reveal"), in the row and in a big pull's stack (before, Auto
flipped the row and stepped through a big pull's reveals by itself). **Skip** ("Skip ahead", was "Skip to summary")
runs past packs of plain cards only; at a stop still face down it only nudges it. A big pull inside Open 10 no longer
offers "Skip this pack". The pure `packFastDuration` adds each stop at its 1x time; `packRowHeld` is the page's copy
of the stop rule.

**3. The debug panel.** Demo pages only (`PackPageData.debug`; the website never passes it, and `site: true` never
renders it even with the data): a dashed DEBUG tab bottom left; opened, "FORCE THE NEXT PACK" with the ten kinds
(Rare ... Zero-Day), the armed state, "Open one now", "Open ten now", "Disarm". An armed kind replaces the next
pack opened from anywhere (picker, shelf, summary buttons, the panel), then disarms; `?debug=<step>` arms one at
load. **Nothing is made up:** `packDemo.ts openDebugPacks()` finds, per kind, the first seed from 1 whose roll for a
fresh owner has that kind as its best card (`bestStepOf`, no Jackpot, no bonus but the Prototype's), opens it for real
(`openPack`, with its set bar), and opens the same seed as pack 1 of a real `openPacks(owner, 10)` with the next nine
seeds. Seeds: Rare 2, Mythic 4, Foil 1, Full Art 8, Alt Art 81, Glitch 15, Gold 65, Secret 26, Prototype 551,
Zero-Day 624. The page grows from 515 KB to 1.28 MB (twenty real openings embedded); the footer names a forced pack.

**4. A bug the check found (pre-existing):** `dealStack` didn't reset `S.revealed`, so a big pull in a ten-pack open
inherited the last stack's reveals: its held cards at the same places left without a build (a second big pull in
one ten, or the first after another ten; also on the website). The first full run caught it (87 PASS, 3 FAIL,
kept as `pack-ceremony-check-s62-before-fix.txt`); now reset, and pinned in the Node test.

**Tests (+14, render 944):** `packStops.test.ts`: over 40 real ten-pack opens the stops are exactly the cards above a
snap, every pack has one, `big` iff full reveal, the build's own times; a roll's best step equals the plan's over 300
real openings; the debug packs: every kind, best card that kind, the first such seed, the Prototype's bonus with its
serial and takeover, the ten's pack 1 the same roll, Gold and above big pulls, the same every run; the page: the panel
on the demo only, one-shot arming, the row/Auto/Skip rules, the fresh stack, a stop's time not shrinking with speed,
the nudge keyframe transform-only.

**Ran it:** `pack-ceremony-check-s62.mjs` -> **90 PASS, 0 FAIL** (the panel; one pack and one ten of every kind
through it on desktop, every stop built and hit in order and none on a snap; Auto at 4x waiting untouched 1.5 s at
all 15 and 16 stops of two tens, big-pull stops included, each stop's hit no sooner than its 1x time; Skip at a
stop; a phone with a forced Prototype pack and a forced Gold ten). Measured by tap: a ten in 36-45 s without a big
pull, 50-62 s with one. The first run was 87/3 (the `S.revealed` bug above; kept). Re-runs: session 61's check
**456 PASS** (`pack-ceremony-check-s61-rerun-s62.txt`); the CI browser check 61 PASS; `npm test` (render) 944 pass;
typecheck clean; every page under `render/output/` rebuilt. **Session 54's ten-pack check now fails by design**
(`pack-bulk-check-s54-rerun-s62.txt`): it models the old row (only finishes face down, `bulkFlip` events, Auto
flipping by itself), which the brief replaced; a pointer-tap spot check confirmed taps on the row reveal each stop
and move on. It should be retired or rewritten on the next hardening pass (named in the debt).

**Not done (named):** nothing on a GPU or by ear (the owner's 11 Nov feel check); a row stop is a smaller moment than
a single pack's (row-card size, no finish shader or Glitch corruption in the row); the s62 stills were taken before
the Skip button's rename; the ten-pack summary still has no fan or set bar; a fanfare per tier.

**Next render-lane slice:** after this PR the next session is game. The next render session: the store layout
(Fortnite-style placement, the current look) with the Store and Packs widgets. Render hardening pass due at 64.

## 2026-11-11 — Render session 63: the store layout, with the Store and Packs widgets at S, M and L

**Lane:** render (TASKS.md step 0: the last merged PR, #150 "The season switch made safe", is not "Render:"; the
catch-up after #143 is long done). No PR from either lane was open. **Read first:** owner-feedback.md (the
2026-11-11 answers to session 62: calls 3-6 kept, 1 and 2 decided later and kept as built; next, the store layout),
DESIGN.md, RENDER.md, `progress/season0-final-brief.md` sections 1 and 2, this lane's log, debt and notes. Not a
hardening pass (59 was; **64 is next**).

**1. The pure tiles (`render/src/site/siteShop.ts`, new).** `packTiles` (the free daily pack, 1 pack, 10 packs:
the server's price, ten times it for ten, Claim/Buy greyed with "N credits short" or "Claimed today"),
`cosmeticTiles` (the cosmetics on sale, not-owned first, owned with an OWNED ribbon and no price), `featuredTileId`
(the daily pack while one waits, else the 10 packs), `tileHtml` (art first with its ribbon and the price on it with
the credits icon, the name and line, the button underneath), `clockLeft` / `resetCountdownHtml` (the clock to the
server's `resetsAt`), `sealedPackHtml` / `packPileHtml`, `balanceHtml`. Nothing restated: every number from the
answers; `cosmeticKind` moved here from the client.

**2. The real pack on the website.** The opening's sealed pack, not a second copy: `siteFaces.ts` cuts the pack
page's own wrapper rules out of `PACK_CSS` (`sealedPackRules`: `.pack .wrap|crimp|logo|emb|set|meta|pa` -> `.spk`)
and hands the plate over through `window.SITE_FACE.packPlateSvg` (added to `FACE_EXPORTS`); the client passes it
to the pure strings as `ShopArt` (the site's CSP has no `unsafe-eval`, so the strings can't evaluate the source
themselves). Boast emblems are the loadout picker's `LOADOUT_GLYPHS`, put on the page as `<symbol id="lg-...">`
(`boastGlyphSymbols`). Coins: the coin painter, on a larger canvas (`coinSwatchHtml` takes a size). The old CSS
pack (`packArt`, `.pk*`) and the stepper's rules are gone.

**3. The Store page (`siteClient.ts storePage`).** The head (balance, the countdown), Packs (the pity line, the
three tiles: featured two columns wide, the others one, at 4 columns; 2 below 1100 px, 1 on a phone), Cosmetics
(auto-fill tiles), then the packs waiting (now with the real pack and a big count), the agents' loadouts and recent
openings as before. The 1-to-10 stepper is gone (call 2). `tickClocks` ticks every `[data-until]` each second and,
once one passes, reads the store again (once per reset). Styles in `siteShopCss.ts` (transform/opacity motion only,
still under reduce motion; solid under reduce transparency; light and dark).

**4. The widgets (`siteWidgets.ts`).** Store: S the free pack, Claim and the clock; M the three pack tiles
(compact); L the balance, the clock, the pack tiles and the cosmetics. Packs: S the pack with its count badge, the
number, Open; M a bigger pile, Open, Open 10 and the pity chips (`pityChips`, gold when sure); L plus the last two
openings. Buy and the daily line left the Packs widget (call 5).

**Tests (+15, render 959):** `siteShop.test.ts`: the featured rule (exactly one, every combination), prices
(including a non-100 price), the daily pack's states, cosmetics' order/owned/short, the real store's on-sale items
(every boast has an emblem, every coin a canvas), the markup order (art, price, name, button), escaping, the plate
being `packPlateSvg`'s and the CSS the pack page's own (the wrapper's gradient character for character, no tear
rules), the emblems on the page, keyframes transform/opacity only, the clock (past 24 h, never negative, unreadable
time), and both widgets at S/M/L. `siteBoard.test.ts`: three assertions moved to the new layout.

**Ran it:** `store-check-s63.mjs` -> **36 PASS, 0 FAIL** against the real owner API (claim, buy a pack, buy a
boast, the widgets at every size; numbers checked against the API). The first full run was 34/2: the Packs widget
showed the count in a heading at M/L (made the same big number at every size) and the L widgets overflowed by 29 and
5 px (the compact art made smaller; the Packs L shows two openings, not three); now 1 px and 0. Found by looking
before that: the Packs pile stacked vertically (the back pack wasn't positioned), the Store L cosmetics' art kept
its 150 px minimum, the ×10 badge covered the 10 packs' price, the claimed daily tile said FREE, CLAIMED TODAY and
"comes back at the reset" at once. The CI browser check 61 PASS (`ci-browser-check-s63.txt`); `npm test` (render)
959 pass; typecheck clean; `render/output/site/index.html` rebuilt (the other pages don't read anything changed).
**Session 47's site check is now stale by design** (it drives `#buy-btn` and the stepper, both replaced); its pack
opening parts are still valid. Retire or rewrite it in hardening pass 64 (named in the debt).

**Not done (named):** the countdown reaching zero (the re-read) was not seen in the browser (no clock control in
the demo; the clock itself is unit-tested to zero); the Store L widget fits with 1 px to spare at 1440 x 1000 (a
different font could scroll it); nothing on a GPU; the phone layout looked at once.

**Next render-lane slice:** after this PR the next session is game. The next render session is **64, a hardening
pass** (the stale s47 and s54 checks first), then the rest of the widgets' S/M/L pass.


## 2026-11-12 — Render session 64: hardening pass (the stale s47 and s54 checks rewritten; a Skip bug found and fixed; two store fixes)

**Lane:** render (TASKS.md step 0: the last merged PR, #152 "The season-file lock ...", is not "Render:"; the
catch-up after #143 is long done). No PR from either lane was open. **Read first:** owner-feedback.md (the
2026-11-12 answers to render 63, all 6 kept, nothing for this lane to act on; game 86's answers), DESIGN.md,
RENDER.md, this lane's log, debt and notes. **A hardening pass** (every 5th: 59, 64): no new features.

**1. The ten-pack check, rewritten (`pack-bulk-check-s64.mjs`, replaces `pack-bulk-check-s54.mjs`).** s54 modelled
the row before session 62's stops and failed by design. The new one keeps what only s54 checked, on the stop model:
every pack once and in order; big pulls exactly the store's `fullReveal` packs; the honest tell (sparks iff a hit);
each fast pack dealt exactly its cards, the face-down ones exactly its held ones, each building, revealing as its
own kind and landing in the row; every row stop logged; no plain card ever "flipped"; in Auto every stop (row and
stack) holds still 1.2 s untouched; Auto never cuts a reveal short; no controls in a big pull or on the summary; the
summary's tiles, copies, NEW badges and pack points the store's; the row and stack on screen; no sideways scroll,
page errors or network requests; speed and Auto remembered across a reload. Four runs (by tap; Auto 4x; Auto 1x;
Auto 2x with Skip) at 1280 x 800 and on a phone.

**2. A real bug it found (fixed in `packPage.ts`).** Its first run failed run C: "pack 1: never dealt", 12 stops
met of 14 (`pack-bulk-check-s64-before-fix.txt`). Skip pressed while a pack holding a stop was still tearing (its
row not dealt yet; the 210 ms after the fan at 2x is enough) cleared the deal's timer and ran on to the next pack,
so that pack's stops were never shown, breaking owner call 3 of render 62 ("Skip can't pass a stop"). s62's check
pressed Skip only at a stop already showing, so it never saw this. Now Skip during such a tear lets the pack carry
on and runs past only the plain packs after it (`bulkSkip` logged with `pending: true`). Run C now presses Skip
during every tear of a pack with a stop, deliberately. Source test in `packStops.test.ts`.

**3. The site check, rewritten (`site-check-s64.mjs`, replaces `site-check-s47.mjs`).** s47 drove the stepper and
`#buy-btn` (gone since render 63). A, B, C and L now drive the tiles (the sections, the server's prices on the
tiles, the claim from the featured tile, two buys from the 1 pack tile each with its confirm, the 10 packs tile
greyed with how many credits short, the narrow layout); G taps the ten through every stop (no Skip past them) and
checks each of the ten packs' cards against the server's logged copies. D-F, H-K, M, N are s47's unchanged (the
single open, Open another, Close mid-reveal, Esc, sound saved to the account, CSP, reduce motion, another owner).

**4. Two store debts paid (`siteShop.ts`, `siteClient.ts`).**
- *The same moment twice:* the claimed daily tile said "The next comes in 10 h 12 min" under the head's ticking
  "10:12:22". The tile now says "Claimed today · the next in" with the same ticking clock (`data-until` on the
  server's `nextPackAt`), in the Store and the Store widgets. With no `nextPackAt` it keeps the old words.
- *Focus after a buy:* the confirm dialog now gives focus back to what opened it, and a redraw that greys the
  focused button ("Claimed today", "Owned") puts focus on its tile instead of dropping it to the page.

**Ran it:** `pack-bulk-check-s64.mjs` -> **14 PASS, 0 FAIL** (`pack-bulk-check-s64.txt`; by tap 54-74 s, Auto 4x
49-53 s, Auto 1x 81-103 s, 14-16 stops per ten); `site-check-s64.mjs` -> **56 passed, 0 failed** against the real
owner API (`site-check-s64.txt`; the focus and clock checks included); the CI browser check 61 PASS
(`ci-browser-check-s64.txt`); `npm test` (render) 959 pass (new assertions inside existing tests); typecheck
clean; `render/output/pack-opening.html` and `render/output/site/index.html` rebuilt. A first `npm test` run beside
two headless browsers timed out 4 tests at 5 s (CPU); alone, all pass. The site check's first run died on a
screenshot timeout under the same load: its stills are now best-effort, as s63's were.

**Not done (named):** the demo's tens hold a stop in every pack, so Skip never actually runs past a plain pack in
any check (the rule is source-tested only); the focus fix was not run against the old code to see the check fail
(only that it passes now); still not re-run: s38's boot check, `boast-check-s3x`, `hardening-check-s40`,
`feed-check`, s45's liquid check, `pack-opening-check` / `pack-tap-check` / `pack-tilt-check`.

**Next render-lane slice:** after this PR the next session is game. The next render session: the rest of the
widgets' S/M/L pass (Daily rewards, Watch live embedded at L, Showcase, Collection, and Ladder, Rating & form and
Notifications on their real data), checklist item 7.

## 2026-11-12 — Render session 65: the Ladder, Rating & form and Notifications widgets at S, M and L

**Lane:** render (TASKS.md step 0: the last merged PR, #154 "A ladder round no longer reads every owner's whole
history (session 87)", is not "Render:"; the catch-up after #143 is long done). No PR from either lane was open.
**Read first:** owner-feedback.md (the 2026-11-12 answers to render 64, both calls kept, nothing to change; game
87's answer), DESIGN.md, RENDER.md, `progress/season0-final-brief.md` section 1, this lane's log, debt and notes.
Not a hardening pass (64 was; the next is 69).

**The slice:** of the widget pass's list, the three widgets that still said "waits on the server" though the game
lane serves their data (roadmap render item 3's last gap): Ladder (`GET /api/ladder`, game 66), Rating & form
(`GET /api/stats`, game 78) and Notifications (`GET /api/notifications`, `POST /api/notifications/read`, game 77).
Daily rewards, Watch live at L, Showcase and Collection are left for the next render session.

**1. The pure strings (`render/src/site/siteStanding.ts`, new).** Types as OWNER_API.md documents them (the
notifications' from `@ai-tcg/economy`, type-only).
- *Ladder:* `tierBadge` (a faceted gem in the tier's colour; Placement a dashed outline), `tierProgress` (from the
  tier's floor to the next, from the server's `tiers`; in placement, the rated matches left of `placementMatches`;
  the top tier full), `aroundYou` (n rows with the owner as central as the list allows; off the list, the top n-1
  and the owner last with a gap). S: badge, rank ("#1 of 4", or "Placement 2/5 placed"), rating (none in
  placement, as the ladder shows none), the tier bar. M: + "45 to Diamond", the record and ±RD, four rows around
  you (one line each). L: + the tier column (every tier with its floor, the owner's lit), the top 8, "Around you"
  when not in it, the footnote (owners rated, placed, the placement count).
- *Rating & form:* `weekTrend` (now minus a week ago, whole, signed), `ratingChartSvg` (the 30 reset days as a
  line, a dot on each day with rated matches coloured by that day's wins and losses, the tier floors it crosses as
  dashed lines; a flat month still gets a 40-point window), `formPips` (oldest left; an opponent's abandon a W, a
  cancel a dash). S: badge, rating, the week's change. M: + the chart, ten pips, the streak, W/L, best streak. L:
  + a larger chart with its scale, twenty pips, a win-rate ring, matches, credits from matches, void count, win
  rate per deck faction as bars (the four, zeros as "none"; matches before v24 said, not guessed), the last four.
- *Notifications:* `noticeView` (each kind in the widget's words from its fields: "Won vs Hive", "+30 credits ·
  +12 rating · 14 turns"; "Prototype Alpha Node #7", "S0 pack and 1 more · new to you"; "2 free packs waiting";
  "Your agent's time is up"), a bell with the unread badge (99+), a glyph per kind. S: the bell and the latest.
  M: + "N unread", **Mark all read**, the latest four (unread tinted with a dot). L: + unread by kind as chips,
  the latest eight, each big pull's cards as mini cards (faction from the collection, read at L only).

**2. Wiring.** `siteApi.ts`: `ladder`, `stats`, `notifications`, `markNotificationsRead`. `siteWidgets.ts`: the
sources (`ladder`; `form` S `stats`, M/L + `ladder` for the floors; `notif`, L + `collection`) and the bodies;
`WIDGET_WAITS` is now empty (kept for a later widget), and `waitsBody` no longer throws on a type without one.
`siteClient.ts`: the reads; the notifications re-read on the 15 s status poll and after a buy/claim/open; the
ladder, stats and notifications after the owner's match ends; "Mark all read" posts `{ all: true }`, reads again
and keeps focus in the widget. Showing notifications marks nothing read (OWNER_API.md: the website marks what it
showed; here only when the owner says so). Styles in `sitePage.ts` (keyframes `wg-grow` and `wg-pop`,
transform/opacity only, off under reduce motion; one column for the L layouts on a phone).

**Tests (+13, render 972):** `siteStanding.test.ts`: the tier bar (floors, Bronze's open floor, placement, the
top), around you (middle, both ends, off the list), each widget's S/M/L differences, placement and an empty
ladder, the week's sign, the pips' order and letters, the chart (dots per rated day, the floors it crosses, a flat
month, one day), no decided match, every notification kind's words, the badge's cap, the empty and all-read
states, the keyframes; and one test on the **real owner API** over a real store (seven recorded matches: the
widgets draw the server's rank, rating, record, week change and rated days; seven match notifications; Mark all
read takes the server's unread to 0). `siteBoard.test.ts`: the waits list is empty, the new sources.

**Ran it:** `widgets-check-s65.mjs` against the real owner API with the game lane's ladder playing at 8x. The
first full run was **35 PASS, 3 FAIL** (kept as `widgets-check-s65-first-run.txt`): every number matched the
server's, but three widgets overflowed: Ladder M by 44 px (and its tier bar was squeezed to nothing: an
`overflow: hidden` child of the flex body shrinks), Rating & form L by 35, Notifications L by 49 and M by 4. Fixed:
the bar `flex: none`; Ladder M four rows, one line each; Rating & form L four recent; Notifications L eight, the
items 1 px tighter. Re-run: **38 PASS, 0 FAIL** (`widgets-check-s65.txt`): the three at S/M/L with the server's
numbers (rank #1 of 4, 1756 Platinum, −86 this week, 24 unread), each size's content different, 0 px overflow
everywhere; Mark all read (the server's unread 0, the badge and button gone, focus kept); a match finishing on the
ladder reached the widget without a reload (the 15 s poll: badge 1, "Lost vs Static Widow") and the Ladder followed
(1670, "131 to Diamond"); dark and phone stills; no external requests or page errors. The CI browser check 61 PASS
(`ci-browser-check-s65.txt`); `npm test` (render) 972 pass; typecheck clean; `render/output/site/index.html`
rebuilt (the other pages read nothing changed).

**Not done (named):** a big pull's cards in the Notifications widget never drawn in a browser (none in the demo's
last eight; unit-tested); placement and "around you" off the top 8 never seen in a browser (the demo's warm-up
places Nova, four owners; unit-tested); the bell (item 1) and the Stats and ladder pages; Daily rewards, Watch live
at L, Showcase and Collection.

**Next render-lane slice:** after this PR the next session is game. The next render session: the rest of the
widgets' S/M/L pass (Daily rewards: the ring, reward row, reset timer; Watch live embedded at L; Showcase larger
cards; Collection), then the Stats page, the ladder page and the bell. Render hardening pass due at 69.

## 2026-11-12 — Render session 66: the Daily rewards, Showcase and Collection widgets at S, M and L

**Lane:** render (TASKS.md step 0: the last merged PR, #156 "The season-scale reads measured, the slow demos re-run
(spare session 88)", is not "Render:"; the catch-up after #143 is long done). No PR from either lane was open.
**Read first:** owner-feedback.md (the 2026-11-12 answers to render 65, all four kept, nothing to change; game 88's
answer), DESIGN.md, RENDER.md, `progress/season0-final-brief.md` section 1, this lane's log, debt and notes. Not a
hardening pass (64 was; the next is 69).

**The slice:** three more rows of the brief's S/M/L table: Daily rewards (S ring / M + the row of rewards with
claim buttons underneath / L + reset timer, rewarded wins, next-win payout), Showcase ("cards drawn larger") and
Collection (the S/M/L principle on the data it already shows). Watch live at L (the embedded arena) is left for the
next render session.

**1. Daily rewards (`render/src/site/siteDaily.ts`, new; pure strings from `GET /api/daily` and, at M and L, the
free pack from `GET /api/packs`).** `winSteps` (one node per paying win from the server's schedule: paid / next /
ahead, its band in the schedule; a paid node labelled with what the server paid, sized by its slot);
`dailyRingSvg` (an SVG arc of credits from wins of the schedule's most, grows in, gold when full); `packNodeHtml`
(Claim / Claim (n) on the page's existing `claim-daily` action, else "Claimed" and a ticking clock to the server's
`nextPackAt`; loading while the packs read is out); `rewardRowHtml`; `dailyBody` per size (S the ring and the next
win; M + "n of 10 wins paid" and the row; L + the ticking reset clock on `resetsAt`, rewarded wins as a bar,
today's wins, losses and draws with how many paid and what the next pays, the day's total, the "no quests" line).
Wins have no button: they pay themselves (ECONOMY.md).

**2. Showcase (`siteWidgets.ts`).** `miniCard` takes a `scale`: `.mc.lg` scales the face's insets and type with
`--k` (the same face, not a zoom). `SHOWCASE_SIZES`: S 1 card at 0.8 beside its name, rarity and finish; M 3 at
1.55; L 6 at 2, each with a caption (name; rarity · finish). Lifts on hover; off under reduce motion.

**3. Collection:** checked against the server (61/96, the last five pulls, the six pills); nothing changed.

**4. Wiring.** `sourcesOf`: Daily rewards reads the packs at M and L too. `siteClient.ts`: a reset clock reaching
zero now reloads the daily read as well as the packs and store. Styles in `sitePage.ts` (keyframes `dr-fill`,
`dr-next`; stroke/transform only; off under reduce motion; under 720 px the pack on its own line, the wins a
ten-column grid, the Showcase row a swipeable strip).

**Tests (+11, render 983):** `siteDaily.test.ts`: the steps from the schedule (paid/next/ahead, bands, a paid
figure the server's, out-of-order payouts keeping slot sizes), the ring's arc and its full state, the pack node's
three states, the row (one button, bands, order), each size's differences, a maxed day and a fresh one, the widget
path's sources and loading node, the reduce-motion rule; Showcase's counts, captions, growing scale and order; and
one test on the **real owner API** (three wins and a loss recorded today: the ring, paid nodes, next win, losses,
reset clock and total are the server's; claiming the free pack through the server turns the node to Claimed).
`siteBoard.test.ts`: the old Daily and Showcase assertions rewritten for the new sizes.

**Ran it:** `widgets-check-s66.mjs` against the real owner API with the ladder playing at 8x. The first full run was
**32 PASS, 4 FAIL** (kept as `widgets-check-s66-first-run.txt`): two were the check's own selector (it read the
Collection ring's "63%" for "61/96"); two were real: on a phone the reward row wrapped (Daily rewards L 82 px over)
and Showcase L's six large cards wrapped to three rows (1234 px over). The stills showed one more: the demo's paid
wins read +10 +10 +5 +30 +10 (the server numbers wins by end time, pays by recording order; the demo's clock-jump
warm-up records out of order), so the big node sat at place 4: node size is now the slot, the label the payout.
Fixed (phone grid, strip, hidden footnote), re-run: **36 PASS, 0 FAIL** (`widgets-check-s66.txt`): the ring 65 of
90 (the server's 65 from 5 wins), 10 nodes 5 paid 1 next, Claim while the server had 1 waiting; the reset clock on
`resetsAt` and ticking; Showcase 1/3/6 cards at 62/121/156 px with the rarest finish first; Collection 61/96; a
claim from the widget (waiting 1 -> 0, unopened 11 -> 12, the node "Claimed"); a ladder win reaching the ring with
no reload (65 -> 70); no overflow at S/M/L or on a phone for Daily rewards and Showcase; no external requests or
page errors. CI browser check 61 PASS (`ci-browser-check-s66.txt`); `npm test` (render) 983 pass; typecheck clean;
`render/output/site/index.html` rebuilt.

**Not done (named):** Watch live at L; the reset's reload at midnight never seen in a browser; the ring's animation
judged only in stills; Collection L still scrolls its binder in the tile (420 px at 61 cards); Showcase still the
placeholder face.

**Next render-lane slice:** after this PR the next session is game. The next render session: Watch live at L (the
live match embedded in the tile, reusing the existing arena), which finishes the widgets' S/M/L pass; then the Stats
page, the ladder page and the bell. Render hardening pass due at 69.

## 2026-11-12 — Render session 67: Watch live at L, the live match on the real arena in the tile

**Lane:** render (TASKS.md step 0: the last merged PR, #158 "The day's wins numbered in the order they were paid
(session 89)", is not "Render:"; the catch-up after #143 is long done). No PR from either lane was open.
**Read first:** owner-feedback.md (the 2026-11-12 answers to render 66, all four kept; the answers to game 89, with
the render note to drop session 66's note 2 and the standing rule to check the PR's files against its description),
DESIGN.md, RENDER.md, `progress/season0-final-brief.md` section 1, this lane's log, debt and notes. Not a hardening
pass (64 was; the next is 69).

**The slice:** the last row of the brief's S/M/L table, Watch live: S live score, M + health bars and "Watch as",
L "the live match embedded in the tile (reuse the existing arena)". Before this, L drew the compact board (unit
chips). This finishes the widgets' S/M/L pass.

**1. The arena's embed mode (`render/src/renderHtml.ts`).** The live arena page takes `embed=1` in its hash (framed
only): `body.embed` hides the controls, the match feed, its own point-of-view switch and the brand; sound and music
are never mounted (`SND.mount`/`MUS.mount` skipped), so nothing in the tile can start audio. A new message,
`ai-tcg-set-view`, lets the website set the side near (the arena's own `setView`, which waits for Match Boot or a
boast as its switch does).

**2. Which tile embeds it (`siteBoard.ts`).** `LiveView` gains `"arena"`: the first Watch live at L that gets one of
the two live boards gets the arena; a second one gets the compact board. One arena page per board.

**3. The tile (`siteWidgets.ts` `arenaBody`).** Left: `.wl-arena`, a slot for the frame, the compact board as a
stand-in (until the frame loads, and on a phone), and a Full screen button over the whole arena (the existing
`watch-arena` action). Right (`.wl-info`): the match's scoreboard (stacked: the turn line on top, the sides under
it), "Watch as" (not on the viewer's own match), the other live matches, the Watch live link. A held match that has
left the live list shows "Match over." and stays on the arena, also between rounds when nothing else is live.

**4. The page (`siteClient.ts`, `siteTileArena.ts`).** `mountTileArena` after every Home draw: makes the frame from
the host's live page (`POST /live-page/:id`, as Full screen does) with `#view=…&switch=…&embed=1`, feeds it every 3 s
(15 s hidden) through `feedLive`, now shared with the full-screen arena (`feedArena` is a two-line wrapper), scales it
(`arenaFit`: laid out 1180 px wide, the arena's own width, scaled to the slot; a ResizeObserver refits). An iframe
removed or moved in the DOM reloads, and Home redraws everything every poll, so the redraws now go around the frame:
`patchAround(old, new, keep)` replaces every node except the path down to the frame (each element on the path keeps
its place and takes its twin's attributes); both the page redraw (`keepTileArena`) and the 3 s live redraw
(`patchArenaTile`) use it, and fall back to the plain redraw when the tile now shows another match. `arenaPick`
holds the match after it ends (20 s after its feed ends, 30 s at most with no word) for the result and the boast,
then the next live match. Taken down while customising, while a full-screen arena or replay is open (one arena at a
time; Close brings it back), and on a phone (`max-width: 720px`).

**5. Watch live at S.** It was broken (pre-existing, session 50's): the three-column small scoreboard overlapped in a
3-column tile and its button row ran 92 px out. Now the stacked score and no button row (the header's arrow opens
Watch live).

**Tests (+7, render 990):** `siteTileArena.test.ts` (new: the pick: first match, held while live, held after its end
for the hold then the next, held at most 30 s with no word; the fit; the embed mode in the page's script and CSS).
`siteBoard.test.ts`: `liveViews` gives the first L the arena and the second the board; the tile at L (its slot and
match, the Full screen label, the stacked scoreboard, no "Watch as" on one's own match, another match held with its
"Watch as", "Match over" with Full screen off, between rounds); every widget at every size with the arena view.

**Ran it:** `progress/render/evidence/watch-arena-check-s67.mjs` against the real owner API with the ladder playing
at 8x. Run 1 33 PASS 1 FAIL (S overflow 92 px), and the end-of-match still showed the tile's arena gone; run 2, with
a trail of the tile's states, found why (between rounds `GET /api/live` is briefly empty and the widget drew "No
match is live" before looking at the held match, so the frame went): 33 PASS 3 FAIL. Both kept in
`watch-arena-check-s67-first-runs.txt`. Fixed; the final run **36 PASS, 0 FAIL** (`watch-arena-check-s67.txt`): the
tile's arena is the server's first live match, loaded (0.7 s), scaled exactly to its slot (780 x 430), embed mode on,
sound and music not mounted, the viewer's side near; after 33 s of redraws the same frame and the same arena page,
never reloaded, following the match (move 9 -> 89) while the scoreboard beside it followed the server; Full screen
takes the tile's down and Close brings it back; Customise takes it down and Done brings it back; the match ends and
the tile holds it (the boast plays in the tile, `v2-s67-watch-L-ended.jpg`), then the next match takes the tile 19 s
later and loads; on a phone no frame, the compact board; no sideways scroll, no external requests, no page errors.
Stills `v2-s67-watch-S/M/L.jpg`, `-L-dark`, `-L-ended`, `-fullscreen`, `-phone`. CI browser check 61 PASS; `npm
test` (render) 990 pass; typecheck clean; `render/output/site/index.html` rebuilt. The committed replay pages under
`render/output/` were not rebuilt (they are standalone; the embed mode only matters on the host's live pages, built
fresh).

**Not done (named, in quality-debt):** the tile's "Watch as" flip not exercised in the browser (the demo's first live
match is always the viewer's own); the arena's small type barely legible at the tile's scale; the cost of a running
arena on Home unmeasured on a real GPU; `patchAround` has no Node unit test (no DOM in the render tests).

**Next render-lane slice:** after this PR the next session is game. The next render session: the Stats page, the
ladder page and the notifications bell (roadmap render item 7's last row). Render hardening pass due at 69.

## 2026-11-12 — Render session 68: the Stats page, with the season ladder inside it

**Lane:** render (TASKS.md step 0: the last merged PR, #160 "The site contract check: the website's types against the
served answers (session 90)", is not "Render:"). No PR from either lane was open. **Read first:** owner-feedback.md
(the 2026-11-12 answers to render 67, all four kept; the answers to game 90 with three render items placed: the Stats
page with `today` typed (this session), the bell then Top rated and viewer counts, the allowance label in the
hardening pass 69), DESIGN.md, RENDER.md, this lane's log, debt and notes. Not a hardening pass (64 was; 69 is next).

**The slice:** the Stats page (roadmap render item 1's last page but the bell; item 7's last row) on `GET /api/stats`
(game 78) and `GET /api/ladder` (game 66), with the ladder inside it (item 5, the call at a checkpoint).

**1. `render/src/site/siteStats.ts` (new, pure).** `statsFilterHtml` (All agents and each agent with its matches, as
pressed pills; 7/30/90 days as a segmented control), `ratingHeroHtml` (badge, rating ± and rank, the week, the tier
bar from `tierProgress`, the labelled `ratingChartSvg` at 760 x 190 and `dayColumnsSvg` under it on the same x),
`totalsHtml` (win-rate ring and seven tiles, the void count), `todayHtml` (the stats' `today`: earned, the daily ring,
next win and loss, rewarded wins, losses paid, the ticking reset clock), `factionTableHtml` (all four, % and W-L-D,
the unrecorded apart), `recentHtml` (pips for all, the newest 8 rows, "Show all", Replay only where the history's
`hasReplay` is true), `ladderSectionHtml` (the tier spread bar, `tierLadderHtml`, the top-100 table with the owner's
row lit and added at the foot when off the list), `statsPageHtml` (loading, error with Try again, the ladder's own
failure, a refresh error as a banner over drawn figures).

**2. Types and the client.** `SiteStats.today: SiteDaily` (owner 2026-11-12); `SiteApi.stats` takes `agent`.
`siteClient.ts`: `state.stats`; `loadStats` reads the stats, the ladder and the history's newest 50 at once (a later
filter change wins; a 404 agent falls back to All agents; the all-agents 30-day answer and the ladder feed Home's
widgets too); the route, the pills, the days control, Try again, Show all; a re-read when the agent's live match
changes (the 15 s status poll) and at the daily reset. Stats leaves `PAGE_WAITS`. Styles in `sitePage.ts` (`st-*`,
`dcols`, `ltable`; the columns grow in, transform only, off under reduce motion; one column under 1100 px; the phone
rules).

**Tests (+14, render 1004):** `siteStats.test.ts` (new): the filter's pills and days; the day columns' counts and x
against the chart's; the hero (rank, week, tier bar, the agent note, placement); totals (streak tones, void, an
empty record); today against Season 0's schedule; factions; recent (Replay by `hasReplay`, none before the history
is read, Show all); the ladder (tier counts, the lit row, off the list, empty); the page's states; the motion rule;
and one test on the **real owner API** (two agents of one owner, 8 matches over 7 days: every figure the server's
under All agents and under one agent at 7 days, the rating unchanged by the filter, `today` equal to `GET
/api/daily`). `site.test.ts`: Stats is served. `siteStanding.test.ts`: the fixture carries `today`.

**Ran it:** `progress/render/evidence/stats-check-s68.mjs` against the real owner API with the ladder playing at 8x.
Run 1 **27 PASS, 3 FAIL**: the page never heard Nova's match end (23 matches on the page, 28 on the server: only the
live poll saw a match end, and it doesn't run on Stats), and Replay was offered for `demo-today-2`, which has no
replay (404). Fixed (the status poll's live-match change; `hasReplay` from the history). Run 2 **40 PASS, 3 FAIL**:
the check's own replay count (it still expected a Replay per non-cancelled row), and on a phone the totals squashed
beside the ring and the ladder table ran 172 px past its box. Fixed (phone rules; 8 rows and Show all for the long
side column). Both kept in `stats-check-s68-first-runs.txt`. Final run **44 PASS, 0 FAIL** (`stats-check-s68.txt`):
every figure the server's (totals, streaks, credits, the ring, rating and week, 15 rated days and 15 day columns,
both faction tables, 8 rows with the replays the history has, today's 69 credits / 65 of 90 / 5 of 10 / the reset,
the 4-row ladder with Nova lit at #1); Quill Static's filter asked `agent=` and drew its empty record with the
owner's rating; 7 and 90 days drew the server's days; the clock ticked; a match of Nova's ended and the open page
went 23 -> 24 matches with no reload; Show all 20 / Show fewer; Replay opened `demo-live-009` and Close came back;
no sideways scroll at 1440 or on a phone; no external requests; no page errors. Stills `v2-s68-stats-L.jpg`,
`-L-top`, `-L-dark`, `-90-days`, `-replay`, `-phone`. CI browser check 61 PASS (`ci-browser-check-s68.txt`); the site
contract check 0 mismatches, `GET /api/stats` now `fits` (`site-contract-s68.txt`); `npm test` (render) 1004 pass;
typecheck clean; `render/output/site/index.html` rebuilt.

**Seen, not this lane's:** on the demo's seeded history the chart's last day (1727) and `rating.now` (1755.5)
disagreed until a live match was recorded (the demo's out-of-order warm-up, most likely); noted for the game lane.

**Not done (named, in quality-debt):** two agents both with results never seen in the browser (Node test only); the
day columns are hairlines at 90 days; Replay only within the history's newest 50; the bell.

**Next render-lane slice:** after this PR the next session is game. The next render session (69) is the render
hardening pass (every 5th: 59, 64, 69): work down `progress/render/quality-debt.md`, with Agent controls taking
`autoPlay.allowance.label` ("Time's up", owner 2026-11-12, item 2). Then the notifications bell in the top bar, then
Top rated and the viewer count on Watch live (owner 2026-11-12, item 1).


## 2026-11-13 — Render session 69: the render hardening pass ("Time's up", the dial's one save, `patchAround`'s test)

**Lane:** render (TASKS.md step 0: the last merged PR, #162 "The site contract check reaches the rarer shapes
(hardening pass, session 91)", is not "Render:"). No PR from either lane was open. **Read first:** owner-feedback.md
(the 2026-11-13 answers to render 68, all five kept, nothing to change; the owner's plan to the launch: render 69 the
hardening pass with "Time's up", then game 92, render 70 the bell, game 93 the dry run, render 71 Top rated and
viewers), DESIGN.md, RENDER.md, this lane's log, debt and notes. **A hardening pass** (every 5th: 59, 64, 69): no
new features.

**1. Agent controls take the server's words (owner 2026-11-06 and 2026-11-12).** `SiteAllowance.label` typed
(`siteApi.ts`); `allowanceOf` carries it; `timeRingView` shows it as the ring's centre for the state it came with
("Finishing match", "Time's up"), with the ring's own same words when an older server sends none or when the page's
count reaches zero before the server says finishing. Every "Done for today" on the site is now "Time's up": the done
caption ("Time's up. Give it 15, 30 or 60 minutes to play again; the day resets at midnight (Sydney)."), the +15 /
+30 reason, the off-ring caption with a timeUp stop, the stop's line in `autoPlayView` (it said "done for today",
wrong since the owner can start again the same day). At M and L the stop's line is left out when the ring's caption
already says the same news (it repeated in the first still).

**2. The dial's arrow keys make one save (debt: "arrowing across three styles makes three saves and three
toasts").** `dialChoose` (pure) moves the chosen notch, pointer and name; the page shows each arrow's choice at once
(`previewDial`) and saves once the keys stop for `DIAL_SAVE_MS` (700 ms), or at once on Enter, Space or focus leaving
the dial; an arrow during a save is no longer dropped (the save waits). A click saves at once and takes over a
waiting choice. One save path (`saveStyle`) for both.

**3. `patchAround` (debt: "no Node unit test").** `sitePatchAround.test.ts` on a small stand-in DOM (insert takes a
node out of its old parent, as the real DOM does): the kept slot and its frame are the same nodes, never removed or
moved, and the rest is the redraw's; path attributes synced and dropped; no twin = false with nothing changed (L to
compact, the widget gone); `syncAttributes`. Writing it found a latent flaw: a twin was the first sibling with the
same key, so of two keyless same-class siblings the frame's second would be matched to the redraw's first (and its
contents lost). Now twins are matched by place among same-key siblings (`twinOf`). Not reachable in today's markup
(every element on the path has a unique key); the test fails on the old code.

**4. Stale debt cleared:** "Watch live at L doesn't embed the live arena yet" (done in 67), "Pages are still missing:
Stats" (done in 68) and "the 2× vote has no endpoint" (it has since 56) removed; the ring, dial and `patchAround`
entries rewritten to what stands now.

**Tests (+5, render 1009):** `siteAgent.test.ts` (the
label wins only for its own state; `dialChoose`), `siteTime.test.ts` (the label carried; on the real owner API the
server's "Finishing match" and "Time's up" in the drawn widget, "Time's up" said once in the caption, no "done for
today"), `sitePatchAround.test.ts` (new, 5).

**Ran it:** `progress/render/evidence/site-check-s69.mjs` against the real owner API with the ladder at 8x, nothing
rewritten. Run 1 36 PASS; run 2 (after the stop-line change) **34 PASS, 2 FAIL**: the check's own 8 s wait for
"Finishing match" was too short at 8x (the server's clock outruns the page's count of the time left, so the page's
5 s reads near the end never start and the next 15 s read brings the word); widened to one read (20 s). Both kept in
`site-check-s69-first-runs.txt`. Final run **36 PASS, 0 FAIL** (`site-check-s69.txt`): 15 minutes given, the
server's "Running"; finishing after 112 s with the ring's centre the server's "Finishing match"; done after 147 s, auto-play off with
`timeUp`, the ring's centre, accessible name, caption and +15 / +30 reason all "Time's up", no "Done for today" on the
page, 15 / 30 / 60 open; three quick ArrowRights shown at once on each style (pointer 60 -> 120 -> 180 deg) with no
save while moving, then ONE save about 0.5 s after the last key and one toast; ArrowRight then Tab and ArrowLeft then
Enter saved at once, once, focus kept; a click at once; no external requests, no page errors. **The same check on the
old code** (a worktree at main): **24 PASS, 12 FAIL** (`site-check-s69-old-code.txt`: "Done for today" in five
places, three saves for three keys, the dial not moving before each save). Stills `v2-s69-time-finishing.jpg`,
`v2-s69-time-up.jpg` (from the final run: "Time's up" said once), `v2-s69-dial-one-save.jpg`. CI browser check 61 PASS (`ci-browser-check-s69.txt`); the site contract check 0
mismatches, controls 5 of 5, `allowance.label` no longer untyped (`site-contract-s69.txt`); typecheck clean;
`render/output/site/index.html` rebuilt.

**Not done (named, in quality-debt):** the run to "Time's up" was at 8x, not the real pace; a poll redraw inside the
dial's 700 ms could draw the saved style back for a moment (never seen); the stand-in DOM is the test's own.

**Next render-lane slice:** after this PR the next session is game (92, the hardening pass for the 7-day unattended
run). The next render session (70): the notifications bell in the top bar (owner 2026-11-13, item 3). Then render
71: Top rated and viewer counts on Watch live, which completes the Season 0 feature list.


## 2026-11-13 — Render session 70: the notifications bell

**Lane:** render (TASKS.md step 0: the last merged PR, #165 "Game lane: a second firing found PR #164 open, waited,
it merged; stopped", is not "Render:"; the catch-up after #143 is long done). No PR from either lane was open.
**Read first:** owner-feedback.md (the 2026-11-13 plan: render 70 is the bell; the 2026-11-12 allowance "the bell
may mark what its panel shows when it is opened"; the answers to render 69 and game 92 needed nothing here),
DESIGN.md, RENDER.md, this lane's log, debt and notes, server/OWNER_API.md's notifications section. Not a hardening
pass (69 was; next is 74).

**Built (`render/src/site/siteBell.ts`, new; wired in `siteClient.ts`):**
- **The bell button** in the top bar: the server's unread count ("99+" past 99) and an accessible name that says
  it ("Notifications, 6 unread"). The count is read with `GET /api/notifications?limit=1` on the existing status
  poll (15 s) and kept in step with the Notifications widget's own read either way (`withCounts`). A new unread
  notification since the last read swings the bell once (not with reduced motion).
- **The panel** (`bellPanelHtml`, pure): the newest 20, grouped Today / Yesterday / Earlier (`dayGroup`, local day,
  23-hour days handled); five filter chips with each kind's unread count, the server's `kind`; Show older (the
  server's `before`; pages merged, deduplicated, newest first: `withPage`); a × on each line (`POST
  /api/notifications/clear` by id; focus to the next line); Clear all behind a confirmation; Mark all read (only while
  some unread are past what's shown); loading rows, the empty words per filter, an error with Try again.
- **Marking:** what the panel shows is marked read by id (`unreadShown`, at most 100 per call) as it is shown: on
  opening, on a filter, on Show older, and when a new one arrives while the panel is open (the panel reads its
  newest again). They keep "New" until it closes (`fresh`). The widget's own rule is unchanged (showing marks
  nothing; its Mark all read does).
- **Behaviour:** Escape closes and returns focus to the bell; a click outside, tabbing out or the bell again closes;
  Tab from the bell goes into the panel, Shift+Tab from its heading back. Stale answers are dropped (a read number).
  The Notifications widget's arrow (it had none: no page) opens the panel.
- **The API client:** `notifications(token, limit, { before, kind })`, `clearNotifications`, and
  `markNotificationsRead` typed `{ marked, unread }`.
- **Two layout fixes found on the way:** the panel first sat inside the top bar, whose own backdrop filter meant
  the panel blurred only the bar (the page showed through, sharp) and its `position: fixed` was pinned to the bar;
  it now sits after the top bar with a near-opaque glass of its own. And a phone rule hid every `.nbadge`, the
  Notifications widget's bell count too (meant for the sidebar's "Soon"): scoped to `.navb .nbadge`. At phone width
  the bar's buttons are 34 px and the theme button leaves the bar (in Settings), so the account button stays on a
  390 or 320 px screen (measured: the bar 314/314 and 244/244 wide).

**Tests (+10, render 1019):** `siteBell.test.ts` (new): the badge words and name; the swing only for a new unread
one; pages appended, deduplicated, newest first; read by id lowers only those and the per-kind counts, keeps them
new; clear; closing keeps the counts; a filtered page doesn't move the newest mark; the panel's HTML (day groups,
chips with counts, escaping, every control, loading, empty per filter, error); `dayGroup`; and on the real owner API
over a real store with 25 recorded matches: two pages by `before`, nothing twice, a `kind` filter, read by the shown
ids, clear one, clear all. `siteBoard.test.ts`: the widget arrow rule now includes Notifications' bell arrow.

**Ran it:** `progress/render/evidence/bell-check-s70.mjs` against the real owner API with the ladder at 8x, nothing
rewritten. **First run 49 PASS, 3 FAIL** (`bell-check-s70-first-run.txt`): the check named the heading wrong; the
check looked for Mark all read where nothing unread was left (moved to B, where it is offered); and **a real bug**:
Cancel in the Clear all confirmation closed the panel (the confirmation empties itself before the page's click
listener runs, so its button read as a click outside; now a click on a node no longer in the page is ignored). The
stills of the next run showed the see-through panel and the phone's top bar overflowing (above, fixed), then chips on
two rows on a desktop once counts show (a coloured dot in place of each chip's icon and short names; a line in the
check now). **Final run 60 PASS, 0 FAIL** (`bell-check-s70.txt`): the bell on every page; the badge the server's 25;
opening shows the server's newest 20 in order, grouped by day, focus on the heading, marks exactly the 20 shown ids
(26 -> 6 unread on the server), keeps them New, the badge and the widget follow; Mark all read to 0; filters
(Matches: the server's 20 of that kind; Daily pack: its 1); Show older appends the server's next 6, in order, none
twice; clear one by keyboard (gone on the server, focus to the next one's ×); Escape, click outside, tab out, the bell
again; a new match recorded: the badge rose to the server's count within a poll and the bell swung; another with the
panel open: it read its newest again, marked it, showed it New; the widget's arrow opens it; Clear all: Cancel keeps
them, Clear all empties the server's feed; on a 390 px phone the top bar fits and the panel fits with no sideways
scroll, and the widget's bell count shows; no external requests, no page errors. Stills `v2-s70-bell-open.jpg`,
`-filter`, `-empty`, `-closed`, `-phone`, `-phone-dark`. CI browser check 61 PASS (`ci-browser-check-s70.txt`);
the site contract check 0 mismatches, controls 5 of 5, `markNotificationsRead` fits its new type
(`site-contract-s70.txt`); typecheck clean (all workspaces); `render/output/site/index.html` rebuilt.

**Not done (named, in quality-debt):** a big pull drawn in the panel in the browser (the demo's ladder opens none;
unit-tested); a 404 while marking (cleared elsewhere) not exercised; the swing seen as a class, not watched; the
panel's days are the viewer's, not Sydney's; phones emulated only; no old-code comparison (nothing existed).

**Next render-lane slice:** after this PR the next session is game (93: the Season 0 dry run and the Mac mini
guide). The next render session (71): Top rated and viewer counts on Watch live (`GET /api/live`'s
`featured.topRated` and each match's `viewers`), which completes the Season 0 feature list.

## 2026-11-13 — Render session 71: Top rated and viewer counts on Watch live

**Lane:** render. The last merged PR (#167, "The Season 0 dry run and the owner's Mac mini guide (session 93)") is
game, so this session is render; no render PR was open. Read first: owner-feedback.md (the 2026-11-13 plan, item 5:
"Render 71: Top rated and viewer counts on Watch live. That completes the Season 0 feature list."; the 2026-11-12
placement of item 1: page and widget as fits), DESIGN.md, RENDER.md, this lane's log, debt and notes, OWNER_API.md
"Featured and viewers" and `progress/featured-viewers-001.txt`. Not a hardening pass (the next is 74).

**Built (render/ only; the server unchanged):**
- `siteApi.ts`: `SiteLive.featured: SiteFeatured` (`{ tournament, topRated }`) and `SiteLiveMatch.viewers`, typed so
  the site contract check now covers them.
- `siteMatches.ts` (pure, tested): `liveGroups` (the server's ids to its matches, in its order; tournament first, a
  match in one group only, an id no longer live skipped, a server without `featured` puts everything in the rest),
  `liveOrder`, `topRatedRank`, `topRatedWhy` ("Weaker side 1786 Platinum", the server's rule worded from the two
  sides' ratings and tiers as the match started), `viewersText` / `viewersHtml` (an eye and the number; "No one
  watching", "1 watching"; nothing when the server sent none), `topRatedHtml` (the chip, the rule on hover);
  `liveLineHtml` takes tags.
- Watch live page: groups — Tournament (only when there is one), **Top rated** (count, the rule in one line), then
  "Also live" (or "Live now" when nothing is featured, with "No Top rated match right now: every live match has a
  side still in placement."). Each card: the chip, "Your agent", 2×, why, and the eye on the right; a featured card
  has a gold edge. The page's lead line says what the eye counts (an arena or match page open in the last 30 s; the
  list alone doesn't count), which is the server's rule.
- Watch live widget: Watch live's order (the top pick first) at S, M and L; at M and L the top pick wears its chip
  and eye, the other lines "#k" and their eye; the foot "5 live · 3 top rated" replaces "featured picks come later".
  The L tile's arena takes the top pick when nothing is held (`arenaMatchOf`, `tileArenaPick`).
- Phone: the scoreboard's turn line above the two sides at 560 px and under (the sides had been squeezed to a few px
  on Watch live; pre-existing, seen in the first phone still).
- `siteDemo.ts`: `--warm N` (the browser check uses 4, so the first round has house sides in placement and the next
  is featured).

**Ran it:** `progress/render/evidence/featured-check-s71.mjs`, a headless browser against the real owner API with the
ladder at 8x, Nova and Rook in two browsers: **39 PASS** (`featured-check-s71.txt`). A placement round: no Top rated
group, the reason said, the eye the server's 0. The next round: Top rated first, its cards in `featured.topRated`'s
order, "Top rated #1/#2", the weaker side as the server's numbers (1455 Silver, 1330 Bronze). Viewers: 0 with Rook
only reading the list; Nova opens the arena -> the server counts 1 and Rook's card shows 1 within a poll; Rook opens
it too -> 2; both close -> 0 (here in 4 s: the host's feed reads stop, the server's window is 30 s) and "No one
watching". Home at M, L, S: the top pick leads; at L the tile's arena embeds it and the server counts Nova watching
(1). Phone fits 390 px; no external requests, no page errors. The first run's 3 FAILs were the check's own
(a hash-only goto doesn't reload, so the board stayed at M; `featured-check-s71-first-run.txt`). Stills
`v2-s71-live-top`, `-live-none`, `-live-viewers`, `-widget-M`, `-widget-L`, `-live-phone`, `-live-phone-dark`,
`-live-dark`. Unit tests `render/test/siteFeatured.test.ts` (10, on the server's own demo round m21-m25: mixed
round, a tournament id, a stale id, an old server); render suite 1029 pass; typecheck clean (all workspaces); the
site contract check 0 mismatches, controls 5 of 5, `featured` and `viewers` fit (`site-contract-s71.txt`);
`render/output/site/index.html` rebuilt.

**Not done (named, in quality-debt):** a mixed round in the browser (the demo's 4 owners make 2-match rounds);
the full-screen arena shows neither rank nor count; "1 watching" can be just you; phones emulated only.

**Next render-lane slice:** the Season 0 feature list is complete. Next render session (72, after game 94): per
the owner's plan item 6, fix what the dry run broke on the site side, hardening only where it found weak spots; the
render hardening pass is due at 74.

## 2026-11-13 — Render session 72: the dry run's fixes on the site (the waiting ring, the season's end)

**Lane:** render. The last merged PR (#169, "The dry run's fixes: the allowance clock at the first pairing, the
scheduled season end (session 94)") is game, so this session is render; no render PR was open. Read first:
owner-feedback.md (the 2026-11-13 plan, item 6: "Then both lanes: fix what the dry run broke; more hardening only
where the dry run found weak spots. No new features"; the answers to render 71, all kept, marked handled), DESIGN.md,
RENDER.md, current.md (game 94's note to this lane: look at the waiting ring at S, M and L and restyle; `endsAt` is
yours to place), this lane's log, debt and notes, OWNER_API.md (the allowance, the season's end), game 94's render
diff. Not a hardening pass (the next is 74).

**Looked first:** the waiting ring as game 94 left it, in a browser on the real API. The server's words "Waiting for
the next round" sat in the centre's nowrap pill, which ran out of the M widget on the left and over the Stop button;
the ring was lit full and bright, the same as a fresh running one.

**Built (render/ only; the server unchanged):**
- `siteAgent.ts`: the ring's "wait" tone. The centre keeps the minutes chosen ("15 min"); the server's label is the
  view's `note` (under the name at S, one line; the caption's start at M and L: "Waiting for the next round: the 15 min
  start when your agent is paired.", "+ (this match isn't timed)" mid-match), and part of the ring's accessible name.
  `statusPollMs` reads every 5 s while waiting, so the drain starts within seconds of the pairing. CSS: dashed, dim,
  breathing (still with reduced motion).
- `siteSeason.ts` (new, pure, tested): `SiteSeason` (`GET /api/season`, `endsAt` optional for an older server),
  `sydneyWhen` (a midnight end reads "midnight at the end of Sat 26 Dec", the owner's own wording; three-letter
  months, the zone not a fixed offset), `untilText`, `seasonEndView` (open / no end time / passed on the page's clock /
  ending / ended), `seasonEndHtml`, `seasonClosed`.
- `siteApi.ts`: `season(token)`. `siteStats.ts`: the line under the ladder's title. `siteClient.ts`: the Stats page
  reads the season with its other reads; `readSeason` runs with the status poll at most once a minute (every poll
  once the end time has passed or while ending) and at sign-in.
- **Found by this session's own check (run 1):** after the season ended, Agent controls read "Time's up. Give it 15,
  30 or 60 minutes to play again" with Start live, and the server accepts auto-play on then (200) though no match
  starts. Now `autoPlayView`, `timeRingView`, `timeButtonsView` and `ringTicks` take the season's closed state: the
  ring reads "Ended" ("Ending" while the last matches finish), Start and the time buttons are off with "Season 0 has
  ended: no new match starts.", nothing says "joins the next ladder round"; Stop stays while on. The Agent match page's
  switch and its "no match" line say the same.
- `siteDemo.ts`: sets the season's end time as `season:setup` does (S0's by default); `--ends-in N`, `--no-end`.

**Ran it:** `progress/render/evidence/season-check-s72.mjs`, headless on the real owner API, ladder at 8x, the end time
40 server minutes ahead: **60 PASS** (`season-check-s72.txt`). Waiting at S, M and L and a 390 px phone (the centre
"15min", the pill inside the widget and off Stop, Stop inside the widget, the S line not cut, no countdown in 2.5 s);
paired → the ring ran 1.2 s after the server said running; the Stats line open ("Ends in 39 min", Sydney time) →
ending (the server's own, "the match on screen finishes and counts") → ended ("final standings"); Agent controls at
S/M/L and Agent match after the end. No external requests, no page errors. The first runs are kept
(`season-check-s72-first-run.txt`: run 1 38 PASS but found the after-end invitation; run 2 a check bug; run 3 found
Agent match drawn before the season read, as the redraw after it was Home-only, fixed). A look at S after the fix
showed the new line pushing Stop under the widget's edge; the line is one 11 px line now, and checked. Unit tests:
`render/test/siteSeason.test.ts` (7), `siteAgent.test.ts` and `siteTime.test.ts` updated (the real-API ring test now
expects the minutes in the centre). Render suite 1036 pass; typecheck clean (all workspaces); the site contract
check 0 mismatches, controls 6 of 6 (`site-contract-s72.txt`; `season` not called by it yet);
`render/output/site/index.html` rebuilt.

**Not done (named, in quality-debt):** the Store, Packs and daily pack after the end (the server's refusals show as
toasts; no designed ended state; a season-end screen is the owner's open question); the end time only on Stats; a
phone after the end not looked at; `season` not in the contract check (game lane).

**Next render-lane slice:** after this PR the next session is game (95). The next render session (73) carries on
with plan item 6 if the owner's answers or the game lane's dry-run re-run on v29 find more; else the hardening pass
can come forward from 74.
