# Season 1 arena prototype (fenced off)

A head start on the Season 1 arena (owner 2026-11-14). The spec is in `progress/season-1-ideas.md`
("the Season 1 arena redesign (true 3D)"); this folder holds its build-order **step 1, the new layout**, as a
separate prototype page. It is **not** part of Season 0:

- All of its code and its built pages live in this folder. Nothing outside it imports it, and no Season 0 page
  links to it (a test, `test/arenaModel.test.ts`, "is fenced off", fails if a Season 0 file names this folder).
- It reads Season 0's replay shape (`render/src/types.ts` `MatchReplay`) and capture (`render/src/replaySetup.ts`)
  as a fixed upstream. It changes neither.
- When Season 1 is built, it is brought over from here.

## What it draws

From a real match played through the engine, as a replay:

- a true-3D round arena (three.js, bundled into the page: nothing loads from outside): a raised disc with a
  glowing rim, each half tinted by its side's faction; each side's six unit slots in a row, its directives behind
  them, its signature zone on its right and its draw pile and discard on its left, with counts on the piles;
- cards facing their owner, as on a real table; a card turns to face the viewer while it is played or attacks,
  then settles back;
- the far side's hand held up in the scene behind their side, backs to the viewer (the page gets a count, never
  the faces of those cards);
- the near side's hand fanned at the bottom edge;
- hover (or tap) any face-up card to read it upright and full size: rules text, keywords, state, owner;
- the far side's HUD above the board and the near side's below: a 68 px profile picture, name, faction, health
  bar, energy pips, hand / deck / discard counts, the signature card's state, coin and boast, whose turn;
- a right panel with **Play-by-play** (the Season 0 feed, as a broadcast log with turn markers and big plays
  highlighted) and **Chat** (an empty tab, "coming soon");
- "Watch as": the camera moves to the other seat; the cards stay where they are;
- a transport (back, play/pause, forward, 1x/2x, a scrubber);
- a phone layout (the panel drops under the board) and the Home tile's size (`?mode=tile`: no panel, slim HUDs,
  plays on its own).

The camera is fitted to the board's size (render 80, the owner's "zoom in a little, especially the tile"): its
distance and aim together, so the far side's held hand meets the top, the near directive row clears the near hand
(measured in px) and every zone fits across.

Placeholder art throughout: no Season 0 effect, ward or finish is rebuilt in 3D yet (that is the spec's later work).

## Build and check

    npx tsx render/season1/src/build.ts Cortex Aegis 2 --signatures   # -> render/season1/output/arena-cortex-vs-aegis-sig-seed2.html
    npx vitest run season1                                            # (in render/) the model and the page
    node render/season1/ci/arena-check.mjs                            # headless Chromium: desktop, phone, tile, two replays

Query options on a built page: `?pov=p2` (start watching as p2), `?mode=tile`, `?play=1`.

## Files

- `src/arenaModel.ts`: pure (no DOM, no three.js): the zones' world positions, the scene at a frame, the HUDs, the
  motions between two frames, the playback beats.
- `src/arenaClient.ts`: the browser page: the 3D scene, HUDs, panel, reader, transport.
- `src/arenaPage.ts`: the HTML, CSS and the esbuild bundle.
- `src/build.ts`: plays a match and writes the page.
- `test/arenaModel.test.ts`, `ci/arena-check.mjs`.

The Season 1 Home (the tile spec, the mockups and the Home built on the grid) lives alongside: `HOME_TILES.md`,
`HOME_MOCKUPS.md`.

## The Season 1 Home on the grid (render session 86, phase 2)

Mockup B (the owner's pick, 2026-11-23) on a uniform grid: one square unit, S 1x1, M 2x1, L 2x2, Watch live
S 1x1, M 1x2 and L two units wide by as many as its whole 9:16 arena needs; B's top bar; light by default.

- `src/homeGrid.ts`: the columns and unit for a width, the shapes, the placement (first free spot, row by row). One
  plain-JavaScript source (`GRID_JS`) the page embeds and the tests evaluate. Tests: `test/homeGrid.test.ts`.
- `src/homePage.ts`: the page (B's look from `homeMockupB.ts`'s `bCss`, each size's anatomy, Watch live's shapes,
  Edit board's cells). Built by `mockup/buildHome.ts` -> `output/home.html`.
- `ci/home-grid-check.mjs`: headless Chromium, both owners, 1440/1280/1024 and a phone: the grid's geometry, the
  spec's facts, Watch live's arena, the navigation, the theme, Edit board; and **the fit table** (`fit.txt`): which
  tiles' content fits its fixed box yet. The "tiles in groups" sessions drive it to all "fits".

    npx tsx season1/mockup/buildHome.ts          # (in render/) -> season1/output/home.html
    node render/season1/ci/home-grid-check.mjs   # -> progress/render/evidence/season1-home-grid-s91/
    node render/season1/ci/tile-states-check.mjs agent    # My agent in every auto-play state (output/agent-states.html,
                                                          # built by buildHome.ts) -> evidence/season1-agent-tile-s88/
    node render/season1/ci/tile-states-check.mjs ladder   # Ladder in every rating state (output/ladder-states.html)
                                                          # -> evidence/season1-ladder-tile-s89/
    node render/season1/ci/tile-states-check.mjs store    # Store in every credits and pack-offer state
                                                          # (output/store-states.html) -> evidence/season1-store-tile-s91/
    node render/season1/ci/tile-states-check.mjs packs    # Packs in every waiting and pity state
                                                          # (output/packs-states.html) -> evidence/season1-packs-tile-s91/

  The states sheets share `src/statesSheet.ts` (a tile's cases at S, M and L on the grid's three units); the cases
  are in `src/agentStates.ts`, `src/ladderStates.ts`, `src/storeStates.ts` and `src/packsStates.ts`, each a snapshot owner's answer changed only in the fields
  the owner API documents.

## The flash check and the pack-opening storyboard (render session 85)

The owner's plan, phase 1 step 4, and decision 22 (WCAG 2.3.1: no more than three flashes in any one second, no
saturated red flashing, an automatic check, a reduced-flash setting). Written up in `FLASH.md`.

- `src/flashScan.ts`: the measure (pure): PNG frames -> 8 px blocks -> luminance and red-flash changes -> every
  one-second window, over WCAG's field of view (341 x 256 px at 1024 x 768). Tests: `test/flashScan.test.ts`.
- `flash/sample.ts`: the frame sampler: a page in headless Chromium on a virtual clock (begin-frame control plus
  Playwright's fake clock), every frame at 30 fps, driven like an owner; fails over the limit.
- `src/openingStoryboard.ts`: the new opening's beats, each with its light plan; `test/openingStoryboard.test.ts`
  holds the plan to the limit (and the design's tighter budget) with the same measure.
- `src/storyboardPage.ts`, `flash/buildStoryboard.ts` -> `output/pack-opening-storyboard.html`.

    npx tsx render/season1/flash/sample.ts --stills            # Season 0's pack page, every showcase pack and a ten-pack
    npx tsx render/season1/flash/sample.ts --pace 0            # tapping as fast as the page allows
    npx tsx render/season1/flash/sample.ts --reduce            # with prefers-reduced-motion
    npx tsx render/season1/flash/buildStoryboard.ts            # the storyboard page, with the audit's results

## Season 1 packs: the wrapper designs and the pick row (render session 95)

The owner's plan, phase 2 step 3, with the owner's 2026-11-28 pack entries. Written up in `PACKS.md`.

- `src/packWrapper.ts`: the set's identity ("Set name" until named), the three designs' layouts (data, in pack
  units), the placeholder mascots, the pack's markup and CSS (seals, pillow, foil, highlight, streak, sheen, edges,
  reflection, glow) and the light (`lightAt`: pointer, tilt, sweep, still).
- `src/packPick.ts`: the pick row's poses and motion (fling, snap, spring), shared with the page as `PICK_JS`.
- `src/packWrapperPage.ts`, `mockup/buildPacks.ts` -> `output/pack-wrappers.html`, `output/pack-pick.html`.
- `test/packWrapper.test.ts`; `ci/pack-wrapper-check.mjs` (headless Chromium); `flash/sample.ts --runs sweep=MS`.

    npx tsx season1/mockup/buildPacks.ts                 # (in render/)
    node render/season1/ci/pack-wrapper-check.mjs         # -> progress/render/evidence/season1-pack-wrappers-s96/

## Season 1 packs: the grip and the tear (render session 96)

The owner's plan, phase 3, the opening rework's first part, on Crest, with the owner's 2026-11-28 points 6-9.
Written up in `PACKS.md`, "The grip and the tear".

- `src/packTear.ts`: the grab zone, the gesture (any direction), the tremble, the torn edge and its two clips, the
  honest tell's light per finish; shared with the page as `TEAR_JS`.
- `src/packWrapperPage.ts` (`TEAR_CLIENT`) -> `output/pack-pick.html?best=plain|gold|zeroDay|...`: the grip, the tear,
  the open, the sound, Reduce flashing.
- `test/packTear.test.ts`; `ci/pack-tear-check.mjs` (headless Chromium, a mouse and real touch events);
  `flash/sample.ts --runs tear=MS[@best[:reduced]]`.

    node render/season1/ci/pack-tear-check.mjs            # -> progress/render/evidence/season1-pack-tear-s96/
