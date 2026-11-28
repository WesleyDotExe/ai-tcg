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

**The flash rules** (FLASH.md; owner 2026-11-28 point 4: "the shine is a soft sweep, never a flash"): the highlight's
and streak's strongest whites are capped (`LIGHT.specAlpha`, `streakAlpha`: 0.12 each) so that, over the dark foil,
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
  trackpad steps one pack; the arrow keys and the ← → buttons step one pack.
- **Picking:** a tap on a side pack brings it to the centre; a tap on the centre pack, Enter, or "Pick this pack"
  picks it: it **lifts** out of the row (higher and 8% larger) and the rest fade. Then a line says the grip and the
  tear come next (phase 3), and "Back to the row" returns.
- **Nothing tells packs apart** (owner 2026-11-28): every slot holds a clone of one template; only its place differs
  (`data-slot`). The page holds no seed, no card and no odds line, and the screen doesn't say every pack has the same
  odds. The pick sends only the slot number (`packpick` event, `{ slot }`).
- **Reduced motion:** the row jumps to the next pack and the pick is instant.

**How the seeds work on the site (for phase 3 and the server; nothing of it is in this page):** when the owner starts
an opening, the server makes one seed per slot from its own secret (never sent, not guessable from the opening's id,
the time or the slot), keeps them with the opening, and sends the page only how many packs to draw. The pick sends the
slot; the server rolls that slot's seed and sends that pack's cards. The slots not picked are never rolled or sent.

## Checks

    npx tsx season1/mockup/buildPacks.ts                 # (in render/) -> season1/output/pack-wrappers.html, pack-pick.html
    npx vitest run season1/test/packWrapper.test.ts      # (in render/) 19 tests: layout, set name, light, row motion
    node render/season1/ci/pack-wrapper-check.mjs         # headless Chromium -> progress/render/evidence/season1-pack-wrappers-s95/
    npx tsx render/season1/flash/sample.ts --page render/season1/output/pack-pick.html --runs idle=10000,sweep=8000 --out ...

`ci/pack-wrapper-check.mjs` measures: print inside the safe area and inside its own region, nothing overlapping, the
wordmark, title, season line and symbol on every pack, text size, **text contrast from the pixels** (glyph cores
against the pixels around them, at three light positions; with a control that a dim grey line fails), the sweep, the
pointer and reduced motion's stillness; and the row: the poses, nothing telling packs apart, keys, wheel, taps, a
fling and a slow drag, the pick and its lift, Back to the row, the phone, reduced motion. `flash/sample.ts` gained a
`sweep=MS` run (the pointer swept across the page and back every 600 ms) for a light that follows the pointer.
