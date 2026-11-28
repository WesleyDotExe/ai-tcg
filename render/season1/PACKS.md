# Season 1 packs: three wrapper designs and the pick row

Render session 95: the owner's Season 1 plan, phase 2 step 3 ("three pack-wrapper designs with placeholder art"),
carrying the owner's 2026-11-28 entries: the pack and its opening at the quality of the reference (the pack as a foil
object, its light and shine, picking a pack from several); every pack in the row the same booster, each with its own
server-held seed, no "same odds" line; and set names on packs. Fenced off like the rest of `render/season1/`: no
Season 0 page changed.

**Look at:** `output/pack-wrappers.html` (the three designs side by side: large, in the four covers, at the Store's
sizes) and `output/pack-pick.html?design=crest|window|bleed` (the row). Stills:
`progress/render/evidence/season1-pack-wrappers-s95/`.

## What every design carries

The owner's point 6 (2026-11-28): the **AI·TCG wordmark**; **the set's name as the title**, "Set name" until the owner
names the set (`S1_FIRST.name` is `null`; `setTitle` never makes a name up); **"Season 1" and the set code `S1-01`
small** (the code scheme proposed in `progress/season-1-ideas.md`, "Set names"); **the set symbol** (a placeholder:
Season 0's hex and dot with a second ring). The **faction mascot is the hero**: placeholder art per faction (shapes
on a circuit field, marked "PLACEHOLDER ART"); January's art pass fills the same region and nothing else moves.

| | A · Crest | B · Window | C · Full bleed |
|---|---|---|---|
| Idea | the classic booster | a HUD window | the art is the pack |
| Wordmark | centred under the top crimp | top left | centred on a glass strip |
| Title | large, under the wordmark | large, in a band below the window | large, on a scrim in the lower third |
| Season line | between the wordmark and title | over the title | under the title |
| Symbol | low right | top right | under the season line |
| The mascot | stands in the middle of the foil | inside a cut-corner window | fills the face edge to edge |

The layout is data (`DESIGNS` in `src/packWrapper.ts`, in pack units of 100 x 160): every piece of print sits inside
the safe area (inside the crimps, clear of the edge light), no two overlap, text over the art only on a scrim. Under
150 px wide (the Store tile's sizes) the season line is dropped: it would draw at 4-6 px. At 62 px the title still
draws at 7.8 px; the wordmark is then a picture (4.5 px), and the Store tile names the pack in text beside it.

## The pack as an object

Built from layers in CSS on one markup (`packHtml`, `packCss`), so the real art drops in:

- **The seal:** a serrated top and bottom edge (`crimpClip`, a polygon of teeth) and crimp strips with ridges and a
  metal sheen, shadowed onto the face.
- **The pillow:** the face darkens toward its sides and toward the crimps, where a real pack pinches, with a soft
  static lobe of light high on the left: it reads as curved, not flat.
- **The foil:** a faction-tinted metal gradient with a fine diagonal grain.
- **The light** (`lightAt`, one function the page and the tests share): the pack turns up to 14° toward the pointer
  (desktop) or with the phone's tilt (where the browser gives it; iOS asks first, behind a button shown only on touch
  screens); left alone, a slow sweep, across and back every 7 s. As it turns, a **specular highlight** and a narrow
  **gloss streak** slide across the face against the turn, the **holographic sheen** shifts its colours, and the
  **edges** catch the light on the side facing it.
- **Under and behind it:** a soft reflection below (fading out) and a glow in the faction's colour behind.
- **Reduced motion:** the still pose (a light high on the left), nothing listens, nothing moves.

**The flash rules** (FLASH.md; owner 2026-11-28 point 4: "the shine is a soft sweep, never a flash"; render 96
raised it under call 3, see below): in render 95 the highlight's and streak's strongest whites were capped
(`LIGHT.specAlpha`, `streakAlpha`: 0.12 each) so that, over the dark foil,
the light crossing a block lifts it by under 0.1 in relative luminance, which is the size of a change the flash check
counts. So the light makes no counted change at any speed: held by a unit test (the highlight drawn as the page draws
it, swept as fast as a pointer, read by `flashScan.ts`: 0 changes) and by the sampler on the built pages (below).

## The pick row

`src/packPick.ts` (pure: the row's geometry and motion; the page runs the same functions as `PICK_JS`) and the page's
client in `src/packWrapperPage.ts`:

- **Seven packs** of one design, one cover. The centre one large and facing the owner; its neighbours turned 40°
  inward, 76% the size and 58% the light; two more behind each side, smaller and dimmer; the row fades out past them.
- **Moving:** drag or swipe (a pack's width of drag is about one pack); a fling carries on a little (up to three packs)
  and **snaps** to a pack with a critically damped spring (no overshoot, settles in about 0.4 s); the wheel or a
  trackpad steps one pack; the arrow keys step one pack. **No buttons** under the row (owner 2026-11-28, point 6,
  render 96): the keyboard works with nothing drawn for it, and the row shows its focus ring.
- **Picking:** a tap on a side pack brings it to the centre; a tap on the centre pack, or Enter, picks it: it
  **lifts** out of the row (higher and 8% larger) and the rest fade. **A pick is final** (point 7, render 96): no
  "Back to the row"; keys, the wheel and taps no longer move the row. The grip and the tear follow (below).
- **Nothing tells packs apart** (owner 2026-11-28): every slot holds a clone of one template; only its place differs
  (`data-slot`). The page holds no seed, no card and no odds line, and the screen doesn't say every pack has the same
  odds. The pick sends only the slot number (`packpick` event, `{ slot }`).
- **Reduced motion:** the row jumps to the next pack and the pick is instant.

**How the seeds work on the site (for phase 3 and the server; nothing of it is in this page):** when the owner starts
an opening, the server makes one seed per slot from its own secret (never sent, not guessable from the opening's id,
the time or the slot), keeps them with the opening, and sends the page only how many packs to draw. The pick sends the
slot; the server rolls that slot's seed and sends that pack's cards. The slots not picked are never rolled or sent.

## The grip and the tear (render session 96)

Phase 3 of the owner's plan, the opening rework's first part (the build-up: shake, tear, sound, no strobe), on Crest
(owner 2026-11-28), with the owner's points 8-9 and FLASH.md's storyboard beats 2-4. `src/packTear.ts` (pure: the
zone, the gesture, the tremble, the torn edge, the light levels; the page runs the same functions as `TEAR_JS`) and
the page's `TEAR_CLIENT` in `src/packWrapperPage.ts`. Look at `output/pack-pick.html?best=gold` (or `plain`, `foil`,
`fullArt`, `prototype`, `zeroDay`).

- **The stand-in server.** On the site the pick goes to the server, which answers with the best card's finish (for
  the honest tell) and, after the tear, the cards. The page has no cards: here a stand-in answers from `?best=`
  (default `plain`). Still nothing in the page tells packs apart before the pick.
- **The grip** (beat 2): press and hold anywhere on the pack: it trembles, 0.5 px growing to 3 px over 1.6 s (at a
  270 px pack, scaled to the pack), 18 times a second with a second, slower wobble so it reads as a hand; it leans up
  to 3° toward the finger; the foil crinkles, faster the longer it is held. For a hit (Full Art or better, Season 0's
  rungs `charged` and up) the seam under the top crimp glows in the tell's colour (Season 0's `TELL_BACKDROPS`, so
  a Gold is gold, a Zero-Day pale gold: never red), rising over 0.6 s and holding, never pulsing; a plain or foil
  pack's seam stays dark. Letting go below the top band doesn't tear.
- **The grab zone** (point 9): the pack's top quarter (the crimp included) plus a margin of 14% of its width (16 px
  at least) above it and past each side; on a touch screen never under 48 px tall. Measured: 373 x 157 px on a
  desktop pack of 292 x 467, 277 x 117 px on a phone pack of 216 x 346. The page listens on the whole document, so
  the margin above the pack works even where it reaches past the stage, and, until the pack is open, a swipe near it
  is a tear, never a scroll (`touch-action: none`).
- **The tear** (beat 3): a drag that starts in the zone tears once it has moved a third of the pack's width, in any
  direction: slanted, crooked or straight down all count (the distance moved, not the line followed). The cut runs
  from the side the drag moves away from and leads the finger a little (`cutLength`); a jagged edge (a seeded
  zigzag just under the crimp) opens dark with a lip of light, light from inside leaking through it in the tell's
  colour; scraps of foil curl off its head; a rip sounds whose pitch and loudness follow the finger's speed. Let go
  early and the cut stays where it got to; the next drag carries on from there. Once torn, the cut runs to the far
  edge in 260 ms. A **tap or click in the zone** tears by itself in 600 ms (from the side tapped), and so does
  **Enter**. A **cue** (a dashed glowing seam with a notch at each end, drifting) shows where to tear until the first
  tear; a tap lower on the pack bobs it once.
- **The open** (beat 4): the strip above the torn edge comes away as its own piece (the pack drawn twice, clipped
  along the same edge) and flies off the way the tear ran; a deep thump and a rising shimmer (heavier for a hit);
  one swell of light from the opening (rise 300 ms, hold 100, fall 800), high only for a hit; the stack of five
  rises out of the cut, backs up (it sits behind the pack's face, so only what has cleared the torn edge shows),
  the rest of the pack drops away under it, and the stack settles where the pack was. The reveal is part two.
- **Sound:** made at play time with WebAudio (filtered noise and tones, no files), after the first gesture, with a
  Sound switch under the stage (on by default, as Season 0's). **Reduce flashing** (a switch, or `?flash=reduced`)
  lowers every light (the seam to 0.22, the leak to 0.2, the swell to 0.1 or less).
- **Reduced motion:** no tremble, no lean, no scraps, no cue drift; the strip slides off; the stack fades up.
- **The shine, brighter** (owner call 3): the highlight 0.12 -> 0.26, the streak 0.12 -> 0.22, the sheen 0.2 ->
  0.3. The pointer swept across the pack every 600 ms now makes up to 2 changes a second over a field and no counted
  flash (the budget: at most one counted flash a second); the Crest season line's halo and colour strengthened to
  hold 5.2:1 under it.

**Checks:** `ci/pack-tear-check.mjs` (54 PASS: the row's buttons gone and the keys still working; a pick final;
the zone's size on a desktop and a phone; nine drags each on a desktop (mouse) and a phone (real touch events, so the
browser's own touch rules apply): off-centre, either way, slanted 30° and 45°, from the margin above, left and right,
crooked at the band's lower edge, straight down, all tear; a tap low on the pack, a drag from 45% down and a short
drag don't, and the short drag's cut is carried on by the next; a tap on the crimp and in the margin above tear by
themselves; the tremble's growth, the lean, the tell for a Gold, none for a plain pack, lower with Reduce flashing;
the cut midway with scraps, the strip coming away, five backs settling on screen; reduced motion), `test/packTear.test.ts`
(16), and the flash sampler's new `tear=MS[@best[:reduced]]` run (Enter picks at 0.6 s, a press on the top at 1.5 s
held 0.9 s, then a drag across in 0.4 s): plain, Gold, Zero-Day, Gold with Reduce flashing, and Gold with reduced
motion all **0 counted flashes**, worst 2 flashes' worth of changes a second, no red
(`progress/render/evidence/season1-pack-tear-s96/`).

## Checks

    npx tsx season1/mockup/buildPacks.ts                 # (in render/) -> season1/output/pack-wrappers.html, pack-pick.html
    npx vitest run season1/test/packWrapper.test.ts      # (in render/) 19 tests: layout, set name, light, row motion
    node render/season1/ci/pack-wrapper-check.mjs         # headless Chromium -> progress/render/evidence/season1-pack-wrappers-s96/
    node render/season1/ci/pack-tear-check.mjs            # the grip and the tear -> progress/render/evidence/season1-pack-tear-s96/
    npx tsx render/season1/flash/sample.ts --page render/season1/output/pack-pick.html --runs tear=6000@gold,tear=6000@gold:reduced --out ...
    npx tsx render/season1/flash/sample.ts --page render/season1/output/pack-pick.html --runs idle=10000,sweep=8000 --out ...

`ci/pack-wrapper-check.mjs` measures: print inside the safe area and inside its own region, nothing overlapping, the
wordmark, title, season line and symbol on every pack, text size, **text contrast from the pixels** (glyph cores
against the pixels around them, at three light positions; with a control that a dim grey line fails), the sweep, the
pointer and reduced motion's stillness; and the row: the poses, nothing telling packs apart, keys, wheel, taps, a
fling and a slow drag, the pick and its lift, Back to the row, the phone, reduced motion. `flash/sample.ts` gained a
`sweep=MS` run (the pointer swept across the page and back every 600 ms) for a light that follows the pointer.
