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
