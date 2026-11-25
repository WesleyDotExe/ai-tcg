# Season 1 Home: B on the uniform grid (phase 2)

Render session 86 began phase 2 of the owner's 2026-11-22 plan (item 19: "the S / M / L tile framework and the
navigation in the chosen direction"). The owner picked **mockup B, "the headline first"** (2026-11-23), **on a uniform
grid**, and set its shapes the same day. Mockups A and C are retired (see `HOME_MOCKUPS.md`; their stills stay in
`progress/render/evidence/season1-home-mockup-a-s83/` and `season1-home-mockups-s84/`).

`output/home.html` is the page (self-contained; open it in a browser). The strip at its top is the prototype's own
switches (owner Nova / Wren, board, theme), not part of the design.

## The grid (`src/homeGrid.ts`)

- **One square unit.** S = 1x1, M = 2x1, L = 2x2. The unit is (board width - gaps) / columns, so every edge lines up.
- **Watch live snaps to the same unit in tall shapes:** S 1x1, M 1x2, and L as many units as its whole 9:16 arena
  needs at the tile's full width: the tile's chrome (padding, header, scoreboard, footer) plus the arena, rounded up to
  whole units. On a desktop that is **2x4** (686 x 1388 px at 1440; the arena 652 x 1159).
- **Columns:** 4 on a desktop (over 1180 px), 2 on a tablet, 1 on a phone (720 px and under). A shape is never wider
  than the board. On two columns Watch live's L is one unit wide (1x3 at 1024), so its arena stays about a screen
  tall; two units wide it would be about three screens.
- **Packing:** first fit, row by row from the top-left, in board order; a later small tile may fill an earlier hole
  (CSS's "dense"). The packer gives every tile its column and row and the page sets them, so the layout the tests
  check is the one the browser draws: the grid's code is one source (`GRID_JS`), inlined in the page and run by the
  tests.
- **The recommended board** packs into four whole rows with no hole on a desktop: My agent M, Watch live M (1x2),
  Daily rewards S; Packs, Notifications and Collection S; Ladder L with Store M and Match history M beside it.

## The tiles (`src/home.ts`, facts in `src/homeFacts.ts`)

A tile's height is the grid's, not its content's, so each shape has its own anatomy and the content is laid out to fill
it (the owner's "each tile's content is designed to fill its size"):

- **S, a square:** the header; the headline (the picture and the answer, big) in the middle; the details under it; the
  one button at the foot.
- **M, a wide band:** the headline in a column on the left, the details in columns on the right, the button bottom right.
- **L, a big square:** the headline across the top, the details in two or three columns, the button.
- The pictures and the headline type scale with the shape; the details' rows spread through the space left.
- Ladder's headline is its rating, tier and place together; Store's is the credits and what they buy.
- The "?" opens the tile's question over the tile (it no longer pushes the content down, so the tile keeps its size).
- **Watch live** (the owner's spec): S the two names in their faction colours, their health, the turn, a Live badge
  and Watch; M the arena, 9:16, with only names and health bars over it (no card text, no hand details) and Full
  screen; L the scoreboard (names, factions, health) above the whole arena, with the turn line and both hands (card
  backs, counted) inside it, and Full screen. The other live matches and the play-by-play move to the Watch page.
  The arena is still the 9:16 stand-in drawn from the live match's real state; the Season 1 arena goes in at plan
  step 5.
- **A phone** shows every tile's S face and Watch live its M (the owner's earlier rule), one column. Two columns of
  175 px squares were tried first and could not hold an S face legibly (Daily rewards' three facts ran over its
  button).
- Light by default (the owner's call 4), dark on the strip.

## Build and check

    npx tsx season1/mockup/snapshot.ts        # (in render/) re-read the demo's owner API (about 15 s), if needed
    npx tsx season1/mockup/buildHome.ts       # -> season1/output/home.html
    npx vitest run season1                    # the spec, the facts, the Home, the grid
    node render/season1/ci/home-check.mjs     # headless Chromium, both owners: every board at 1440, a tablet
                                              # (1024) and a phone (390); evidence in
                                              # progress/render/evidence/season1-home-grid-s86/

The browser check holds every tile to its shape and its place on the grid (to 1 px), no overlaps, no fact spilling
past its tile, under its header or into its button, no region scrolling inside, Watch live's arena whole and 9:16
(to 1%), and **how well each tile fills its shape**: the largest empty band inside it as a share of its height, under
40% (the worst at 1440 is Music L at 36%, a placeholder waiting on its spec; then Match history and Notifications at
L for a new player, 32%).
