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
