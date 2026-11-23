# The flash check, Season 0's pack opening measured, and the new opening's storyboard

Render session 85: the owner's 2026-11-22 plan, phase 1 step 4. Decision 22: "pack opening and every effect meet WCAG
2.3.1: no more than three flashes in any one second, no saturated red flashing; an automatic flash check keeps it so,
and a reduced-flash setting is offered." Point 15: "the pack opening is jarring with the flashing lights."

Fenced off like the rest of `render/season1/`: the check reads Season 0's built pack page
(`render/output/pack-opening.html`) as it is; no Season 0 file changed.

## 1. The check

**The measure** (`src/flashScan.ts`, pure): WCAG 2.2's definitions, as Understanding 2.3.1 gives them.

- A **change** is a swing in relative luminance of 0.1 or more (10% of the maximum) where the darker state is below
  0.8, measured per 8 px block with a tracker that counts a swing once it reaches 0.1 from the last extreme, in the
  opposite direction to the last one. A **flash** is two changes. A slow fade is one change; a pulse is two; a strobe
  is every swing.
- A **red change** is a move into or out of saturated red (R / (R + G + B) >= 0.8, linear light) where the two states
  are more than 0.2 apart in CIE u'v'. Near-black blocks (luminance under 0.02) are ignored.
- **Area:** changes only count when, inside one 10-degree field of view (341 x 256 px at 1024 x 768, scaled to the
  frame), the blocks that made them cover more than a quarter of it.
- **Fails** when any one-second window has 7 or more changes (more than three flashes), or 7 or more red changes,
  over that area. The report also lists every **counted flash** (a change and its return within half a second, over
  the area): one is allowed; they are the moments a viewer sees as a flash.

**The sampler** (`flash/sample.ts`): the page in headless Chromium on a **virtual clock**. Chromium draws only when
asked (`--enable-begin-frame-control`, `HeadlessExperimental.beginFrame`), each frame at a set time, while the page's
timers, `requestAnimationFrame` and `performance.now` run on Playwright's fake clock, advanced by the same step, and
`Math.random` is seeded. So every frame at 30 fps is captured, however slow the machine (software WebGL draws at about
3 frames a real second here). It drives the page like an owner: a tap 900 ms after the page will take one (`--pace`;
`--pace 0` taps the moment it can), through each showcase pack (`?pack=N`) and a ten-pack open (`?bulk=1`) to the
summary. `--reduce` sets prefers-reduced-motion. `--repeat N` plays each run N times.

**How sure:** the measure's tests (`test/flashScan.test.ts`, 11) use frames with known answers: a full-screen strobe
at 5 a second fails at exactly 5 flashes (10 changes); at 3 a second it passes at exactly 3; the same 5-a-second
strobe passes on a 32 x 32 px square (under a quarter of the field) and fails on 48 x 48; a fade is 1 change; one
pulse is 1 counted flash; two light states (above 0.8) never count; a saturated red strobe at an even luminance is 5
red flashes and fails, a dark red one doesn't count; the PNG decoder round-trips every filter type. **Not exact:** runs
of one opening differ a little (a tap lands up to 0.1 s apart, a worst second by about 1 change): some of the page's
timing still follows real time (most likely its images decoding and its shaders compiling), so a verdict within a
change or two of the line needs repeat runs (`--repeat`).

**Cost:** about 1 minute a pack and 2-3 minutes a ten-pack, 3 at once; the full audit (11 runs) about 5 minutes a
pass. Too slow for every PR (the owner's Actions-minutes rule); it runs by hand on a page that changes its effects,
and the measure's and the storyboard's unit tests run in the suite.

## 2. Season 0's pack opening, measured

Records: `progress/render/evidence/season1-flash-audit-s85/` (`summary*.txt`, one file a run with its quarter-second
timeline, `stills/`). 1024 x 768, 30 fps.

| | An owner's pace | Tapping as fast as the page allows | Reduced motion |
|---|---|---|---|
| Passes | 11 of 11 in the main pass; **Gold failed 1 of 6 runs** | **5 of 11** | **9 of 11** |
| Worst second | Zero-Day 5-6 changes (3 flashes) at the breach; Gold 4-7 at the hit; the rest 4 | Gold 10, No hit 9, Full Art 9 | **Glitch 10-11, Jackpot 11-12** |
| Red | Zero-Day and Jackpot: one red change (the red-to-green ring), never a red flash | the same | none |
| Counted flashes | 2 (No hit) to 8 (Jackpot) a pack; 7 in a ten-pack | up to 15 in a ten-pack | 3-8 a pack |

What makes them:

1. **The page appearing** (every pack, 0-1.3 s): 4 changes over 88-100% of a field: the stage and the pack drawing in
   with the backdrop and the pack's rise. Not a failure, but a quarter of the way to one before anything happens.
2. **The tear's burst** (a hit: the honest tell): `packBurstPlan`: a screen flash at 0.22-0.70 opacity over 620-1300
   ms with a burst disc and a shock ring, all at once. One counted flash.
3. **The hit** (every held card): a screen flash at 0.22-1.0 opacity (0.22 + 0.78 x the ladder's weight), 300-800
   ms, at the same moment as the dim lifting, the ward flaring and the motes. The Gold hit's whole-screen mean jumps
   from 0.02 to 0.14 inside 250 ms (`stills/s0-gold-9.2s-the-hit.jpg`); stacked with the tell backdrop's pulse
   (`bdpulse`) and the gold sheen it is 4-7 changes in one second: on the line.
4. **Zero-Day's breach** (`stills/s0-zero-day-8.8s-breach.jpg`): the Zero-Day shader ramps to full over the whole
   screen behind the terminal, with the terminal shaking three times and a red-to-green conic ring
   (`rgba(255,30,60,0.75)`: saturated red by WCAG's measure) round the card: 5-6 changes, three flashes, exactly the
   limit; one red change.
5. **Card swaps under a fast thumb:** each new card face over the field is a light change; tapping as fast as the
   page allows makes 7-10 changes a second in 6 packs. WCAG counts this (the content changes, whoever asked it to).
6. **Reduced motion makes Glitch strobe** (a bug, `stills/s0-glitch-reduced-motion-7.6s-strobe.jpg`): Season 0's
   `later()` (`render/src/packPage.ts`) runs every scheduled beat after at most 120 ms when reduced motion is on.
   The Glitch card's `glitchLoop` schedules its next burst 2.2-3.4 s ahead and its own fall 160 ms ahead; capped, it
   pulses every 120 ms: 10-11 changes in one second (Glitch), 11-12 (Jackpot, which holds a Glitch). Every run fails.
   The viewers who asked for less motion get the one strobe in the product. Season 0's fix (not made here: the fence,
   and the owner's mid-season rule) is to leave `glitchLoop`'s timers (and any loop's) out of the cap, or to stop the
   loop under reduced motion. In the owner's notes.

So the owner's word holds up in numbers: at a calm pace Season 0 sits **at** the limit at its biggest moments, not
comfortably under it, and the light is the opening's main instrument.

## 3. The storyboard for Season 1's opening

`src/openingStoryboard.ts` (the beats, typed) and `output/pack-opening-storyboard.html` (the page for the owner: a
sketch per beat, what you see, hear and feel, what reduced flash does, what Season 0 did, and the beat's light
curve). Eight beats for a pack (a Gold pull): **the pack arrives, grip, the tear, open, plain cards, the build, the
hit, the summary**; and the big pull's takeover in place of the hit (**the room goes dark, the terminal, the
arrival**).

The owner's direction, as built into it:

- **The build-up is shake, tear and sound, not strobe:** a new grip beat (hold the pack: it trembles harder the
  longer you hold; the foil crinkles); a tear that follows the finger with scraps and a sound whose grain follows its
  speed; the honest tell kept as a seam that glows and holds, never pulses.
- **The reveal and the big pull within the limit:** one bloom per hit (rise 250 ms, fall 900 ms, its height capped)
  instead of Season 0's instant screen flash on top of the dim lifting; the room comes back slowly behind it; the
  size of a pull lives in the build's length, the sound, the shake, the ward and the motes. Zero-Day keeps its
  takeover with no saturated red (green and violet) and a glitch made of motion (text bands slipping), not light.
- **A reduced-flash setting:** every light under 0.08 (a change has to reach 0.1 to count), so nothing flashes at
  all; shakes and spins off with reduced motion. (And no timer cap that turns a loop into a strobe.)
- **The design's own budget**, tighter than WCAG's three: at most one counted flash in any second; big lights at
  least 1 s apart; a bright light rises over at least 250 ms and falls over at least 400 ms.

**Held to it by the same measure:** `test/openingStoryboard.test.ts` draws each opening's light plan as frames and
reads them with `flashScan.ts`: a Gold pull, a Zero-Day pull and a pack with no hit each stay within one flash a
second, no red flash, counted flashes at least 1 s apart; with reduced flash, no counted flash at all; the hit and the
Zero-Day arrival each still make their one counted flash (the moment is kept); and Season 0's style of hit, drawn the
same way, does count (the test isn't blind). When phase 3 builds the opening, the sampler runs on the built page
against the same limits.

**Owner check-in (taste calls; none blocks):** in `progress/render/checkpoints.md`, render 85.
