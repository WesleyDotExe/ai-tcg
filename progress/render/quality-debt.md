# Render lane — quality debt

The render lane's own self-audit (RENDER.md guardrail 4: the shared
`progress/quality-debt.md` belongs to the game lane). Started in render
session 19, a hardening pass. It lists where the spectator render falls
short of DESIGN.md's arena bar and principle 2 (a human must enjoy
watching) right now. Most important first. Each session updates it; fixed
items are removed, with the fix in `log.md`.

## Pack opening (slice 1, session 24)

- **Only checked in headless Chromium with a software GPU (SwiftShader).**
  The shaders compile and light pixels there, but nothing has run on a
  real phone, a real GPU, iOS Safari, or with the device tilt (the
  `deviceorientation` path and its iOS permission prompt are untested).
- **The card swipe was only exercised as taps.** The check tears by a real
  drag, but steps through the stack by tapping; a drag-to-swipe on a card
  is untested in the browser (the gesture rule itself is unit-tested).
- **The sounds were never heard,** only checked as recipes (sane voices,
  the hit's rise always rising).
- **The Glitch "RGB split" is two filtered DOM copies of the card**, not a
  per-pixel channel split (a shader can't read DOM). It reads as a split
  in motion; a still mid-flip mostly shows the card edge-on.
- **The page runtime (about 500 lines) is one string.** Its pure helpers
  are tested in Node; the rest only by the browser check.
- **The committed page changes on every rebuild** (the store's random pack
  and copy ids), even with the same packs. Asked of the game lane.
- **The showcase packs are found by seed search**, so the page shows one
  of each finish; it is not a sample of what a typical opening looks like.
- **Single pack only.** The ten-pack opening (slice 2) and the first-time
  flow with the signature reveal (slice 3) don't exist yet.

## Layout and legibility

- **At 545-600 px the board cards are small** (85-91 px wide, session 20).
  The row is zoomed to keep six on one line, and the name strip's text is
  about 7.5 px. It reads, but only just.
- **Labels over a zoomed card now shrink with it (session 23), but only
  where the call site says "this is a card".** spawnNumber takes an
  `onCard` flag; a new call site that forgets it gets a full-size label.
  The cast tag on a Command's stack entry and the impact number over a
  player stay full size on purpose.
- **The feed says what happened, never why it mattered** (commentary,
  stage 7). Every fizzle is now worded from the engine's cause; a fizzle
  with no cause (an ability with nothing to do, an old log) still prints
  the engine's reason text.
- **The quiet-trigger rule depends on an engine habit:** every effect that
  changes the game logs an event straight after its trigger. The test
  (`feedQuiet.test.ts`) checks that over 32 real matches. But it sees only
  triggers resolved from the turn and stack code: onDeath triggers fired
  inside the resolver's own death pass aren't wrapped. A new effect kind
  that changes state without logging would make its trigger vanish from
  the feed, and now from the board too.
- **The board and the feed agree on quiet triggers only through
  `Frame.quietTriggers`** (session 23). A replay captured before session 23
  has no list, so its page still flourishes every trigger. All 14
  committed replays are regenerated.
- **The turn-cap ending ("X wins at the turn cap, 14 health to 9") is only
  seen in tests;** no replay reaches the cap.
- **In a mirror match a feed trigger can lose its side colour** when its
  event carries no instance id and the card's name is on both boards.
- **The feed is built for a finished match** (`buildFeed` over all frames).
  It only ever looks back, so a live stream (the server, stage 4) could
  build it move by move, but nothing does yet.
- **The cost circle shows the printed cost.** A board cost modifier, or the
  7 a replayed signature card paid, isn't on the card. The hand shows the
  effective cost and the zone shows the climb, so nothing is wrong, but the
  card itself can't say "this cost more than printed".
- **The board fit uses CSS `zoom`** (session 20). An older Firefox
  (before 2024) ignores it and shows full-size cards that wrap, as before.
- **Wards on narrow screens run off the edges.** A ward behind an edge card
  is clipped by the viewport (the canvas is fixed, so the page doesn't
  scroll, but you see half a ring).
- **The FX and skin sheets are fixed at 1196 px.** They are developer
  audition grids, not spectator pages, so they scroll sideways on anything
  narrower.

## Signal

- **"In reach now" is almost never seen.** The reference agents play the
  signature card as soon as they can afford it, so the glow lasts 3 moves
  or fewer in most games (session 18 scan: 25 of 32).
- **The signature card's return mote competes with the Mythic shatter.**
  The card usually dies next to its own zone, so the flight is short and
  the shatter is still bright.
- **ON KILL and INTERCEPT triggers have only the generic cast label.** No
  dedicated effect says "it grew because it killed" or "it stepped in
  front". Neither Hunter nor Bulwark is on the generator yet, so no replay
  shows them; build it when one is.
- **The momentum gauge's reasons are a fixed list of comparisons**
  (health, board, hand). They now use agent names (session 21). They don't explain a threat that hasn't landed
  yet (a pending stack item, an armed telegraph), which is exactly what a
  spectator can't track.

## Verification

- **The tests never run a browser.** Every visual claim (overflow, the
  zone's DOM, frame strips) is checked by scratch Playwright scripts from a
  folder outside the repo, and only the CSS rules are pinned in vitest. A
  regression in layout would pass CI. The overflow script and the
  board-fit script (session 20) and the feed script (session 21) are
  committed in
  `progress/render/evidence/`, but nothing runs them.
- **Sound and music were only ever heard in headless runs and through
  stats.** No check on a real device, on mobile browsers' autoplay rules,
  or on low-end hardware.
- **Frame rate with several wards was measured once (session 17) on cards
  that no longer appear.** The current replays have at most two wards at
  once.

## Size and structure

- **Each replay is about 1.1-2.0 MB of self-contained HTML (21 MB for the
  folder).** Every page embeds the same atlases and sources. That's the
  owner's self-contained rule (no network calls), but the website will want
  shared assets.
- **`renderHtml.ts` is one file of about 2,360 lines** holding the CSS, the
  page markup and the page runtime as strings. The FX modules are split out
  and tested; the page glue isn't.

## Deferred by design (not debt, listed so it isn't forgotten)

- Real card art (the late owner-funded pass) and the 500-piece signature
  art pool (game lane first). The card centre is still a placeholder motif.
- Adaptive pacing driven by significance, for spoken commentary (owner
  2026-09-25), comes with stage 7.
- The website Music setting, menu music and the music widget belong to
  build-order steps 4-5.
