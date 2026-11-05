# Season 0 final brief: the Home dashboard, the store, the pack opening

Owner, 2026-11-06. This is the owner's Home dashboard feedback that `progress/owner-feedback.md` (2026-11-05)
said would lock the Season 0 scope. **The scope is now locked.** The owner-feedback entry of 2026-11-06 sets
the order for both lanes; this file is the spec.

## Timeline and freeze

- **This brief is the final feature list for Season 0.** It closes the list. Everything already queued and
  unfinished on the Season 0 checklist (`progress/roadmap.md`) stays in scope and must not be dropped.
- **Feature freeze from Monday 9 November 2026.** From then on, runs may only:
  - build the items in this brief and the items already open on the Season 0 checklist,
  - fix bugs,
  - finish what already exists so Season 0 works end to end.
- **No new features after the freeze**, however small. Any new idea, from the owner or from a run, goes into
  `progress/season-1-ideas.md`, not into the build.
- **All feature work done by Tuesday 1 December 2026.**
- **Wednesday 2 to Friday 4 December: clean-up only** (see "Clean-up days" below).
- **Season 0 starts Saturday 5 December 2026** (in-house: the owner and the house's agents, no external
  services, daily reset at midnight Australia/Sydney).
- **Definition of done for Season 0:** 7 consecutive days unattended with ranked matches, the ladder, daily
  resets, packs opened and a spectator view that's worth watching.

### Workload at the current rate

At about one session per lane per day, there are roughly 20 sessions per lane between 9 November and
1 December, hardening passes included. The order in the owner-feedback entry fits inside that with room to
spare on the game lane; the render lane is the tight one. Hence:

- **Midpoint check, around Sunday 22 November.** Each lane writes a short on-track note at the top of its
  notes-for-owner file: items left, sessions left at the current rate, and anything at risk.
- **If the render lane is behind at the midpoint, cut in this order**, each one moving *whole* to
  `progress/season-1-ideas.md` (never left half-built):
  1. the music play/pause widget,
  2. the strip of last pulls on the Packs widget at L,
  3. the live match embedded in the Watch live widget at L (M stays),
  4. the rating trend on My agent at L.
- **Never cut:** the pack opening ceremony, the agent controls (personality dial and play-time timer), the
  store layout, the S/M/L rework of the other widgets.

### Clean-up days (2-4 December)

No features, both lanes. Work the quality-debt lists, re-run stale checks, then a full Season 0 dry run on the
real server: the ladder running, auto-play with a time allowance running out mid-match, packs bought and opened
(single and ten), the daily reset crossing midnight Sydney, Watch live and the dashboard at every size. Fix what
breaks. Anything that can't be fixed by 4 December is written up in notes-for-owner with the workaround.

## Standing constraints (unchanged)

- Keep the **current AI·TCG visual identity**: colours, type, dark theme, the glass look. Nothing in this brief
  is a restyle.
- **Fully self-contained**: no external runtime calls. The game never calls Replicate at runtime.
- **Procedural (code-generated) sound**, not AI-generated audio.
- Owner interface is a **desktop website** first.
- **Earlier owner decisions still stand** unless this brief changes them (for example the 2026-10-05 app spec,
  the 2026-10-18 pack-opening feel notes, the coin and live-arena decisions). This brief deepens what exists; it
  doesn't replace it.

---

## 1. Dashboard: meaningful S / M / L sizes

**Principle:** sizes must differ in what they show, not just in scale.

- **S** = core status at a glance.
- **M** = the key numbers plus one main action.
- **L** = the full feature.

Make every widget more visual (artwork, rings, bars, portraits) rather than lines of text.

| Widget | S | M | L |
|---|---|---|---|
| **My agent** | Portrait, name, status, rating | + today's W/L, streak, deck faction | + rating trend and recent matches (rating trend uses the Stats data, game item 2e) |
| **Agent controls** (replaces "Live match") | Portrait with time-remaining ring, status, start/stop | + personality dial, time buttons, current deck, "Go to match" | + deck switcher, match history, +15/+30 time buttons |
| **Packs** | Real pack art + unopened count + Open | Bigger pack art, Open / Open 10, pity counters | + strip of the last pulls |
| **Store** | Claim free pack | Product tiles with buy buttons underneath | The full store layout (section 2) + credit balance |
| **Daily rewards** | Progress ring (credits from wins, e.g. 0/90) | + row of rewards with claim buttons underneath | + reset timer, rewarded wins (0/10), next-win payout |
| **Watch live** | Live score | + health bars, "Watch as" | The live match embedded in the tile (reuse the existing arena) |
| **Showcase** | Keep what exists; **cards drawn larger**. No new customisation. | | |
| **Collection / Ladder / the rest** | Apply the S/M/L principle using only data they already show. No new features. | | |

### Agent controls: details

- **Personality dial.** Switches between the play styles that already exist (`playStyles` in `GET /api/play`,
  `PUT /api/agents/:agentId/play-style`). A change applies from the **next match**, never mid-match.
- **"Give the agent X minutes"** (owner-approved: a small server addition to auto-play, game lane):
  - Preset buttons: **15 / 30 / 60 minutes**. Auto-play with no time chosen behaves as it does today.
  - When time runs out, the agent **finishes its current match, then stops** (no new pairing).
  - Unused time does not carry over. It resets at the midnight Sydney daily reset.
  - "+15 / +30" adds time while it's running.
- **Countdown display, on every size:**
  - **S:** a ring around the agent portrait that drains as time runs down, with minutes left in the centre.
  - **M:** the ring + "42 min left today", plus a note when the agent is finishing its last match.
  - **L:** all of the above + the "+15 / +30" buttons.
  - At zero, the ring shows **"Finishing match"**, then **"Done for today"**.

---

## 2. Store: Fortnite-style layout (layout only, not a visual change)

The store keeps the current AI·TCG look. Borrow only the **product placement and boxes** from the Fortnite
item shop:

- Products shown as **large tiles of different sizes**.
- **One featured tile** larger than the rest (e.g. the 10-pack, or the free daily pack when it's available).
- **Artwork is the hero** of each tile (real pack art; coins drawn as they already are).
- **Price clearly on the tile**, with currency icon, and a **buy button underneath**.
- **Countdown to the daily reset** shown on the store.

Season 0 products are the ones that already exist (the free daily pack, 1 pack, 10 packs, the coins and other
cosmetics already on sale). No rotating daily shop and no new products.

---

## 3. Pack opening ceremony: the big one

**Quality bar:** opening a pack should feel like a small event. A card that just fades or pops in is a failure.
This is the owner's most important moment in the product.

**Upgrade the existing ceremony** (`render/src/packOpening.ts`, `packFx.ts`, the ten-pack slice). Keep every
existing reveal kind and its order; each step up the order gets a longer build-up and a bigger hit than the one
below it. Keep the 2026-10-18 feel notes. Not the 3D pack opening (that stays after Season 0).

### Design principles

- **Anticipation beats reward.** The excitement is in the moment before the flip. Each stage stretches that
  moment slightly longer as rarity rises.
- **Owner agency.** The owner does the important actions (tear, reveal). Nothing important auto-plays.
- **Layered tells.** Hints stack gradually so the owner starts suspecting a hit before they know.
  Occasionally a tell under-promises, so it never becomes fully predictable.
- **Escalation.** A plain card gets a crisp flip. A Prototype gets a full event. The gap between them is what
  makes hits feel like hits.

### Beat by beat

1. **The pack.** Bigger, real pack art, centred on a **deep gradient backdrop** that slowly shifts and pulses.
   The backdrop colour hints at the best card inside (sometimes under-promising). The pack tilts with the
   mouse, with foil catching the light.
2. **The tear.** Drag across the top of the pack. The tear follows the cursor, with a **rip sound scrubbed to
   drag speed** and foil scraps flying. Letting go halfway holds the tear. Finishing it releases a burst of
   light coloured by the best card.
3. **The reveal.** Cards rise out face-down as a stack. Click or drag each away to reveal the next.
   - **Plain Commons and Uncommons:** quick, snappy flips with rising pitch on each.
   - **Rares and Mythics, and the special finishes:** the room dims and the audio drops to near silence. The
     card back glows through stages, each with a small pause where it might stop. Then a slow flip, a flash,
     a screen shake, a bass hit and particles in the **faction colour**. The card's **faction ward sigil
     flares** as it lands (the Rare and Mythic tiered wards already exist).
   - **Prototype (the bonus 6th card) and tournament copies:** a **full-screen takeover**. The gold **serial
     number and "PROTOTYPE · S1" marker are stamped on live**. This must be the biggest moment in the game.
4. **Afterglow.** The hit card is **mouse-tilt interactive** so the owner can admire the foil. Then a summary:
   all cards fanned out, **"NEW" stamps** slamming down, and the **set-completion bar ticking up**
   (e.g. 68/96) with a tick sound per new card.

### Supporting requirements

- **Open 10:** fast-forwards through plain cards but **still stops for every Rare, Mythic, special finish and
  Prototype**.
- **Sound:** fully procedural: rip, flips with rising pitch, risers, impact hits, and a fanfare per tier.
- **Performance:** GPU-friendly animation (transforms and opacity) to hold 60fps. Canvas particle system scaled
  by rarity.
- **Debug panel** (owner-only, demo pages): force the best card of the next pack to any reveal kind, including
  Prototype, to tune each sequence without opening 1,000 packs.

---

## Not in Season 0 (moved to `progress/season-1-ideas.md`)

- Music management, drum machine and loop creator with save slots. (Background music already exists, so a
  small play/pause widget is allowed, first on the cut list.)
- Agent art creation based on daily performance.
- A fully customisable card showcase (the existing Showcase only gets larger cards).
- Daily challenges and quests.
- A rotating daily shop and new store products.
- New personalities, or fine-tuning sliders for personalities.

## Checks before marking this brief done

- Every widget renders correctly at S, M and L, with a clear difference in content between sizes.
- The pack ceremony has been run through every reveal kind using the debug panel, including Prototype and
  Open 10.
- The time-remaining ring counts down correctly, the agent finishes its current match, and the allowance resets
  at midnight Sydney.
- No external runtime calls added.
