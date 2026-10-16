# Render lane — quality debt

The render lane's own self-audit (RENDER.md guardrail 4: the shared
`progress/quality-debt.md` belongs to the game lane). Started in render
session 19, a hardening pass. It lists where the spectator render falls
short of DESIGN.md's arena bar and principle 2 (a human must enjoy
watching) right now. Most important first. Each session updates it; fixed
items are removed, with the fix in `log.md`.

## Layout and legibility

- **At 545-600 px the board cards are small** (85-91 px wide, session 20).
  The row is zoomed to keep six on one line, and the name strip's text is
  about 7.5 px. It reads, but only just.
- **Floating numbers and trigger labels aren't scaled with a zoomed row.**
  "ON PLAY" and "+3 HP" stay at full size, so next to an 85-px card they
  look a little large.
- **The event log is raw engine text** ("p1 passes priority", "[end of turn
  13 for p1]"). It is dense, full of priority passes, and names players as
  p1 / p2 instead of their usernames. For a spectator it is a debugging
  view, not a feed. Commentary (stage 7) is the real fix; until then it
  could at least filter passes and use names.
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
  (health, board, hand), and they name players P1 / P2. They don't explain a threat that hasn't landed
  yet (a pending stack item, an armed telegraph), which is exactly what a
  spectator can't track.

## Verification

- **The tests never run a browser.** Every visual claim (overflow, the
  zone's DOM, frame strips) is checked by scratch Playwright scripts from a
  folder outside the repo, and only the CSS rules are pinned in vitest. A
  regression in layout would pass CI. The overflow script and the
  board-fit script (session 20) are committed in
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
- **`renderHtml.ts` is one file of about 2,260 lines** holding the CSS, the
  page markup and the page runtime as strings. The FX modules are split out
  and tested; the page glue isn't.

## Deferred by design (not debt, listed so it isn't forgotten)

- Real card art (the late owner-funded pass) and the 500-piece signature
  art pool (game lane first). The card centre is still a placeholder motif.
- Adaptive pacing driven by significance, for spoken commentary (owner
  2026-09-25), comes with stage 7.
- The website Music setting, menu music and the music widget belong to
  build-order steps 4-5.
