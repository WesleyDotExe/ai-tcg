# Render lane — checkpoints

The render lane's own checkpoint log (RENDER.md guardrail 4 — kept separate
from the shared `progress/checkpoints.md`). Newest at top, same convention
as the shared file. "AWAITING FEEDBACK" per DESIGN.md's non-blocking
checkpoint process: this flags and continues, never blocks.

---

## 2026-10-07 — Slice 3 follow-up: your answers built (number at the impact, sound on by default, mute remembered, effects volume) — AWAITING FEEDBACK

**What this delivers** (your 2026-10-07 answers; calls 1, 3, 4, 5 and 6 are unchanged):
- **The damage number appears where the hit lands,** on the board at the impact point. The HP bar still flashes and drops; a spectacle hit still flashes the panel. A health change with no hit landing on that player (a self-cost) keeps its number by the bar, so a number never floats mid-board with nothing there.
- **Sound is on by default.** It's armed when the page loads and starts on the viewer's first click or key press anywhere. Pressing Play counts.
- **A small "🔊 Sound on" indicator mutes in one click** ("🔇 Sound off"). While it's waiting for that first click its border is dashed.
- **An effects volume slider** sits beside it (default 80%).
- **Muting and the volume are remembered** in browser storage for standalone replays. A muted viewer stays muted on the next replay until they switch it back on. The website will plug the account's Sound setting into the same hook when it exists.
- **A hidden tab goes quiet** and picks up again when the viewer comes back.

**Evidence:**
- Any replay in `render/output/`: the control is at the bottom right of the controls.
- Stills: `progress/render/evidence/v2-s3b-number-at-impact-spectacle-aegis-vs-cortex-seed6.png` (−6! on the board), `v2-s3b-number-at-impact-normal-aegis-vs-null-seed3.png`.
- Headless Chromium, all six replays: 93 player health changes, all 93 numbers on the impact point, 0 errors.
- Headless Chromium, sound: no audio before the first click; Play starts it; one click mutes; the mute survives a reload and Play stays silent; volume 30 survives a reload; a key press starts it too; blocked storage still mutes, with no errors.
- 10 new tests; render is at 187.

**Strong:** it's exactly the behaviour you specified, with no audio created before a gesture. A mute is never lost to a reload, and broken storage can't crash the page.

**Thin:** the account Sound setting waits for the website. The volume is checked as a gain value, not by ear.

**Decisions you may want to overrule:**
1. **Default volume 80%,** not 100%. It leaves headroom for music (slice 4) and the limiter.
2. **The number sits where a card's number sits:** near the top of the hit, rising. It can touch the opposing row's gap on a spectacle hit.
3. **The slider is greyed out while muted** rather than unmuting when moved.
4. **The FX sheet uses the same remembered setting** as the replays, so muting one mutes both.

---

## 2026-10-05 — EFFECTS.md v2 slice 3: procedural sound (+ player hits land mid-board, Neutral white-gold) — AWAITING FEEDBACK

**What this delivers:**
- **Sound.** Every visual event now has a synthesised sound in its faction's voice. There are no audio files.
  - The events: a strike leaving and landing, a spell's shots and landing, heal, buff, debuff, a removal locking on and striking, kills, Barrier blocks and cast flourishes.
  - The voices: Cortex square-wave blips, Aegis metal clangs, Swarm chitters and squelches, Null broken pitch, Neutral bells.
  - Bigger moments are louder. Everything goes through a limiter, is panned by where it happens, and has a voice cap.
  - Sound is off until the viewer clicks "Sound: off" in the controls.
- **Hits aimed at a player land in the middle of their side of the board** (your 2026-10-05 entry):
  - the impact lands in the gap between their third and fourth slots, in the attacker's material, with a ground mark;
  - their HP bar flashes and the number rises from the bar, timed to the impact;
  - a spectacle hit also flashes the whole panel and jolts the bar;
  - the same rule covers spells and heals aimed at a player.
- **Neutral is white-gold `#fff0c2`** everywhere the render draws it. Neutral cards have darker text strips so the white text stays readable.

**Evidence:**
- `render/output/fx-sheet.html`, part 3: the sound audition grid. Switch sound on, then click any cell or play a whole row or column. A tier picker sets the volume.
- Any replay in `render/output/`: press "Sound: off" to switch it on, then play. `aegis-vs-null-seed3` has kills, a removal, a debuff and many face hits.
- Stills in `progress/render/evidence/`:
  - `v2-s3-face-hit-spectacle-aegis-vs-cortex-seed6.png`;
  - `v2-s3-face-hit-normal-aegis-vs-null-seed3.png`;
  - `v2-s3-neutral-white-gold-aegis-vs-null-seed3.png`;
  - `v2-s3-sound-grid.png`.
- Headless Chromium on all six replays:
  - 101 player hits, every one exactly at the centre of the defender's row, none on a card, the HP bar reacting each time;
  - with sound on, real signal out of the limiter, peaking at 0.62 (no clipping), with no voices dropped by the cap;
  - 0 errors.
- 20 new tests; render is at 177. The sound runtime is tested against a fake AudioContext.

**Strong:**
- It's the lab's sound, with the same voices you approved. It's timed to the visuals, so a sound never runs ahead of the thing it describes.
- Meaning stays constant in sound too: an impact always thumps, a heal always rises, a debuff always falls, a block always rings.
- It's silent and costs nothing until switched on.

**Thin:**
- No music yet (slice 4) and no ward sounds (slices 5-6).
- No separate effects volume. The limiter keeps the level sane, but you might want a slider.
- I can measure the sound, not hear it: judge the voices on the audition grid.

**Decisions you may want to overrule:**
1. **The exact centre of the row, even beside cards.** A big face hit lands in the gap between slots 3 and 4, and its flash can spill over the cards either side (see the spectacle still). Alternative: land on the empty slot nearest the centre when there is one, and on the gap only on a full board.
2. **Where the number appears:** above the end of the HP bar's fill, where the health is lost, rather than at the panel's centre.
3. **A spectacle face hit also flashes the whole panel**, not just the bar. Smaller hits only flash the bar.
4. **A volley is one sound:** the same sound in the same voice within 28 ms plays once, so a Swarm volley is one chitter cloud rather than 14 clicks.
5. **A spell landing on a card or player uses the impact sound** (thump + voice). A removal gets lock-on beeps, then a beam, then the kill sound.
6. **A Barrier block rings the same bright tone in every voice,** with an extra metal ring for Aegis. A block always reads as a block.
7. **Sound switches on per page and isn't remembered** between replays. Remembering it would still need a click on each new page (browser rule).

---

## 2026-10-04 — EFFECTS.md v2 slice 2: every category's faction material, kills, camera beats, warping grid — AWAITING FEEDBACK

**What this delivers:**
- **Every ability effect flies from the exact card that used it to the exact card it hits,** in the source card's faction material. This uses the event log's instance ids from game session 27. The five categories:
  - spell damage: Cortex lasers, Aegis lobbed shells, Swarm homing spores, Null teleporting packets, Neutral light lances;
  - heal: scanlines / welding sparks / egg-sac bloom / reversed vortex / rising crosses;
  - buff: wireframe cubes / armour plates / tendrils / dark star / chevrons;
  - debuff: lock and falling pixels / cracked plates / acid / glitch bars / gold acid (Neutral);
  - removal: orbital beam / breach charge / devour / vortex / smite.
- **Every death shatters the card,** with lingering debris, a crater and the killer's mark on the table.
- **Big moments get the camera beats:** hit-stop, colour split, camera punch. The background grid warps under every hit.

**Evidence:**
- `render/output/fx-sheet.html` part 2: all 25 faction × category combinations, looping.
- Any replay in `render/output/`; aegis-vs-null-seed3 has a spell kill, a debuff from a Command and a removal.
- Stills in `progress/render/evidence/`:
  - `v2-s2-sheet-spell.png`, `v2-s2-sheet-debuff.png`, `v2-s2-sheet-removal-kill.png`;
  - `v2-s2-replay-spell-kill.png` (Aegis shells shatter a Null unit);
  - `v2-s2-replay-debuff-from-stack.png` (Bit Rot flies from its stack entry);
  - `v2-s2-replay-removal-shatter.png` (Breach Charge destroys a Directive);
  - `v2-s2-effect-survey.txt` (80 matches).
- Headless Chromium on all six replays:
  - every effect and kill drawn, 0 errors;
  - frame rate level with slice 1 on the same machine (median 54 vs 55);
  - reduced motion turns every camera beat off;
  - with the textures missing, the old look takes over.
- 16 new tests; render is at 157.

**Strong:**
- It's the lab's look in the real replay, with real pairings, never guessed from names.
- Meaning stays constant: a debuff always sinks with a slate ring and its slate label, and a spell always leaves its source.
- The damage number never appears before the shot that causes it.

**Thin:**
- The committed replays only contain 25 effects between them; the sheet is where to judge all 25 combinations.
- Shields, cast flourishes, armor deflect and evolve/arrival pulses still use the v1 look.
- No sound yet (slice 3).

**Decisions you may want to overrule:**
1. **Effects wear the source card's faction** (a Neutral Command is gold whoever casts it). This extends your 2026-09-26 tint rule.
2. **Effects now take a short flight before their result shows:** ~210 ms at normal speed, ~300 ms for a removal, after the cast beat. The tick, and so the pacing, is unchanged.
3. **Every death shatters,** even a quiet one (a 1/1 traded, an Overload tick). Subtle deaths shatter small, with no camera beat.
4. **Camera beats are spectacle-only** (a Mythic's death, a Rare's death in a move with no attack, hits of 6+, the lethal blow). A normal kill only gets a small punch and shake.
5. **The background grid is always faintly visible,** as in the lab, and brightens and bends under hits.
6. **Overload (a cost Overload Capacitor puts on itself) reads as a debuff,** a sink in place.
7. **"First fire only" for signature wards is per card instance.** A second Rate Limiter gets its own first flare. Say if you meant once per card name per match. (Not wired until slice 5.)

---

## 2026-10-03 — EFFECTS.md v2 slice 1: canvas layers + sprite travel/impact — AWAITING FEEDBACK

**What this delivers:** the first v2 slice. Attacks are now drawn on canvas with the Nano Banana Pro sprites, in each faction's material:
- **Cortex:** a data-shard head, a pixel trail, arcs on impact, a circuit trace left on the table.
- **Aegis:** a molten head, an ember trail, shrapnel and hex plates, smoke, a scorch mark.
- **Swarm:** spores, chitin and wings, a goo splat.
- **Null:** a dark-star head that stutters, glitch bars, a rift tear.
- **Neutral:** glints and feathers, light rays, a rune ring.

Size scales with the existing magnitude tier. A face hit spreads wide and flat across the HUD. Ground marks and some debris sit on a floor layer under the cards and fade over a few seconds. The timeline and pacing are unchanged, and the head lands exactly when the hit's consequences play. If the canvas or textures fail, the old DOM bolt is drawn instead.

**Evidence:**
- `render/output/fx-sheet.html` (all five factions, looping) and any replay in `render/output/`.
- Stills: `progress/render/evidence/v2-s1-fx-sheet.png`, `v2-s1-cortex-travel.png`, `v2-s1-aegis-kill-floor.png` (a dead unit's empty slot keeps the Aegis scorch and settled debris), `v2-s1-null-swarm-impact.png` (lethal face hit).
- Headless Chromium on all six replays: 0 errors and 58–61 fps under autoplay. The sheet holds 60 fps at ~1,260 particles.
- 14 new tests; render is at 141.

**Strong:** it's the lab's look in the real replay, and the meaning stays constant (it always leaves the attacker and lands on the target). Each faction's material is distinct at a glance. It costs nothing when idle.

**Thin:** only attacks moved. Spells, heals, buffs/debuffs, casts, shields and deaths still use the v1 look until slice 2. Hit-stop, colour split, camera punch and the warping grid aren't there yet either.

**Decisions you may want to overrule:**
1. **Ground marks under a hit card are drawn larger than the card** (1.3× normal, 1.6× spectacle), so they show around it. Under the card itself they'd be invisible.
2. **No ground mark on a face hit.** The HUD panel is opaque.
3. **Subtle (1-damage) hits get a small impact** (sparks, a few debris, a small shockwave) but no ground mark. Before, they had no burst at all.
4. **Aegis is orange on the whole page,** not just in effects (card frames, tags, HUD).
5. **The counter-strike's return bolt also lands a small impact** on the attacker (one tier down).
6. **The atlases are embedded in every replay** (~300 KB each) to keep the single-file offline replay.

**Also waiting on you:** the proposed `signatureAbilities` list (9 abilities in, with reasons for everything out) in `progress/render/notes-for-owner.md`. Slice 5 can't wire faction wards until it's approved.

**Next:** slice 2 (material kits for every effect category + magnitude polish).

---

## 2026-10-02 — Faction skins (EFFECTS.md slice 5) — the effects language is complete — AWAITING FEEDBACK

**What this delivers:** the last of the five EFFECTS.md slices. Every particle the render throws now has its faction's character, not just its colour:
- **Cortex** — packets. Square motes stream in lanes. The bolt is a train of evenly spaced packets. Rings are dashed rounded squares.
- **Swarm** — spores. There are more of them, smaller, drifting sideways. The bolt is a cloud that weaves around the arc and converges on the target. Rings are dotted.
- **Aegis** — chrome. Fewer, heavier hexagonal plates. The bolt is one elongated metal slug that turns along its flight. Rings are thick, with a highlight.
- **Null** — glitch. Torn bars with an RGB split, jumping in discrete steps. The bolt stutters and jitters. Rings flicker.
- **Neutral** — the original plain look, unchanged.

It is built as data. `render/src/factionSkin.ts` holds one table row per faction and one layout function per primitive, plus shared CSS shape rules. A new faction is one row plus its shapes, with no new animation code. The meaning sits outside the skin's reach:
- a mote's direction and a bolt's landing point come from the caller;
- a test checks every skin × tier × direction;
- bursts whose colour is the message stay plain (a kill's red, a shield's cyan, an evolve's green).

**Evidence:**
- **`render/output/skin-sheet.html`** shows all five skins frozen mid-flight side by side. It's the quickest way to judge them.
- **The six regenerated replays.** All were autoplayed to the end at normal and fast speed in headless Chromium. That gave 0 errors and 0 particles wearing the wrong faction's skin. The FX layer drained every time, and the tallies were identical at both speeds.
- **Tests.** `render/test/factionSkin.test.ts` adds 13 tests. Render is at 127 tests (was 114), and all five workspaces are green.

**Decisions you may want to overrule:**
1. **Skinned motes drop the arrow shape.** Only Neutral keeps the ▲/▼ arrows. The other skins carry "buff vs penalty" through:
   - which way the motes move;
   - the card's own rise or sink;
   - the floating label;
   - the penalty's grey drain.

   If you want the arrow back as a constant, one option is a small arrowhead leading each particle. That would add a meaning glyph on top of every skin.
2. **Null moves in discrete steps.** This is the boldest choice. It reads as glitch to me, but it could read as page stutter. The fallback is smooth motion with only the RGB split and the sideways tears.
3. **Only particles are skinned.** Cards entering, dying, being hit and evolving look the same in every faction. The natural next step is a Null unit that glitches out on death and an Aegis unit that enters with a chrome sweep. Say if you want that before the art pass.
4. **Neutral-pool cards wear the plain skin.** Their palette stays the UI gold. EFFECTS.md asks for "a plain, faction-agnostic treatment", and this is the literal reading.
5. **Swarm gets ~1.7× as many motes and Aegis ~0.6×.** That's the "many small vs few solid" contrast. On a board-wide Swarm buff at spectacle tier, that's 20 spores per card.

**What's next:** the build order in EFFECTS.md is complete, so later render work refines it. Recommended next:
- a legibility pass on the two misreads still on record (an aura lifting reads as a penalty; a ghost overlaps the newcomer on a full board);
- then card-level faction skins (item 3), unless you redirect.

---

## 2026-09-29 — Fixed-slot board layout + the cast beat on every response — AWAITING FEEDBACK

**What this delivers:** both of your 2026-09-27 render items.
- **Cards no longer move.** Each card keeps the slot it entered in until it
  leaves. Previously, when a unit died, every card to its right slid one
  slot left. The dying card's ghost then faded over whichever card slid in,
  and a viewer tracking a unit saw it jump for no in-game reason. Across
  the six replays, the old layout moved a surviving card 39 times and
  faded a ghost over a live card 20 times. The new layout does neither,
  0 and 0.
- **Units on the left, Directives on the right.** Standing effects no
  longer interleave with the fighters.
- **Every response now gets the "cast, then effect" beat.** It plays where
  the effect lands, which is the move the response *resolves*. The
  RESOLVE/ACTIVATE sigil fires first, and the effect follows 150ms later
  (measured +149 to +151ms on all four such moves in the replays). A
  redirect counts as an effect: the old aim line holds through the sigil,
  then swings to the new target.
- **A session-7 bug is fixed.** The shield-coloured fade-out of a
  redirected attack's old line was being erased the instant it was drawn
  (it lived 0ms). It now shows for its full 700ms.

**Evidence:** `render/test/slotLayout.test.ts` covers each rule with
hand-built cases, plus two real-match scans over 48 matches:
- 0 slot changes, where packed order would have had 354;
- 10/10 responses tracked from push to their single resolution.

`npm test` passes in all five workspaces (render 114). The six replays
were driven in headless Chromium single-stepped, at normal speed and at
fast speed, with zero errors. The full before/after table is in the
session 8 log.

**Decisions you may want to overrule:**
1. **Directives fill from the right.** The alternative is one shared
   left-to-right fill, which is simpler but mixes Directives in among
   units.
2. **A newcomer avoids the slot that just emptied** when anything else is
   free, even if that leaves an earlier gap open for a move. The ghost
   gets a clean spot to fade in. On a full board it has to take that slot
   (3 times in 48 matches), and the ghost briefly overlaps it.
3. **Gaps stay open.** A long game can end with its units spread out,
   e.g. slots 1, 3 and 5 filled. The next unit fills the leftmost gap.
   Compacting later (say at turn end, with a visible slide) is possible,
   but it would bring back the motion this removes.
4. **Where the response beat plays.** It is on the resolve move, since
   that's where a response's effect lands, and on the announce move too,
   where there is nothing to delay. You asked to re-judge once the beat
   is visible in a real replay. It now is: `aegis-vs-null-seed3` moves 107
   and 123 (two destroys), and `swarm-vs-aegis-seed8` move 40 (a
   redirect). Responses are rare, about 1 in 5 matches, so it stays out of
   the way of the approved pacing.

**What's next:** EFFECTS.md slice 5, the faction skinning pass, in the next
render session.

---

## 2026-09-27 — Attack travel + impact (EFFECTS.md slice 4) + Command card flight — AWAITING FEEDBACK

**What this delivers:** an attack is now something you can watch move.
- **Declare.** A dashed, marching aim line in the attacker's faction colour
  runs from the attacking card to its target (a unit or the player's
  avatar), and a spinning lock-on reticle sits on the target. The line
  stays up for as long as the attack waits on the stack. That is the
  response window, so a viewer can see what a RESPONSE is answering. In
  `aegis-vs-cortex-seed6` the line holds through three stacked Cortex
  Engineer responses (moves 70-81).
- **Redirect.** When Aegis's Intercept Routine moves an attack, the old
  line fades out in shield colour, the new one fades in, and REDIRECTED
  shows on the new target.
- **Resolve.** A bolt flies along the same arc, and the hit lands when the
  bolt does: the flash, the number, an impact burst, deaths, and any
  onDamaged/onDeath powers. A defender with attack sends a smaller return
  bolt in its own colour, and the attacker takes its hit when that lands.
  An attack that fizzles says FIZZLED.
- **Your four cast-flourish calls, applied.** Spectacle-tier powers now
  get the ~150ms "cast, then effect" beat; routine powers stay
  simultaneous. Tag wording and response loudness are unchanged. A
  Command's card flies from its caster's hand onto the stack, holding at
  full size for about 40% of the flight so it can be read, and its sigil
  plays on its stack entry.

**Evidence:** no engine change was needed. The capture copies each stack
item's engine id plus a combat item's exact attacker and target, and the
new `render/src/attackFx.ts` follows each attack by that id. A test
records the exact move every agent submitted across 48 real matches (all
16 pairings, mirrors included, 3 seeds each). It found:
- **950/950 attacks** drawn from the exact attacker to the exact target;
  239 of them had a same-named card on the board, where the name-only
  event log is ambiguous;
- every declaration struck exactly once;
- every hit or fizzle agreed with the engine's own log, including 1 real
  fizzle, 4 redirects and 186 counter-strikes;
- 99/99 Commands flew.

Six replays are in `render/output/`, including a new short one,
`swarm-vs-aegis-seed8` (67 moves), which has a redirect, a counter-kill
and two Command flights. All six were driven in headless Chromium
single-stepped, at normal speed and at fast speed. Measured numbers are in
the session 7 log.

**Decisions you may want to overrule:**
1. **The aim line persists through the whole response window.** That
   makes reactivity legible. The alternative is showing it only on the
   declaring move, which is quieter but hides what responses are aimed
   at.
2. **The bolt's flight comes out of the start of the move's own time.** It
   takes about 30% of the tick (~210ms at normal, ~75ms at fast), so the
   approved pacing is unchanged and the hit lands that much later inside
   the move.
3. **Return strikes are drawn as a second bolt** in the defender's
   colour. You could instead show only both hits landing together.
4. **On a strike move everything waits for the bolt**, including deaths,
   onDamaged/onDeath powers and a token summoned from a death. That's
   causally right, but it means nothing on that move happens before
   impact.
5. **The cast stagger applies to the whole move's effects**, not effect by
   effect. The event log can't say which effect came from which power.

**Worth knowing about your call 1:** the stagger is built and proven in
the browser, but real play almost never triggers it. Across 72 real
matches (every non-mirror pairing, seeds 1-6), **no** power reached
spectacle tier on a move without a strike. The page was checked on a
fixture copy of a replay with one Command raised to Mythic: the effect
lands 150ms after the sigil, and dying cards hold 150ms. On the same moves
at their real (routine) tier, everything is simultaneous. If you want the
beat seen more often, the lever is castScore's thresholds (e.g. let Rare
activations or all responses qualify). That's your call; I didn't change
it.

**Where it's thin:**
- The board has no fixed slots. A dying card's ghost now holds its spot
  until the bolt lands, briefly covering the card that slid into that
  spot.
- Bolts look the same for every faction apart from colour; that's
  slice 5 (faction skinning).
- Effect damage from powers still has no travel. It needs per-hit
  source/target pairing, which is the event-log instance-ID work.

## 2026-09-26 — Power / ability cast flourish (EFFECTS.md slice 3) — AWAITING FEEDBACK

**What this delivers:** every time a card uses a power, the replay now
shows *which card did it*. It draws a faction-tinted ring, spinning sigil
and rays on that exact card (on the caster's avatar for a Command). A tag
in one fixed "power" colour says which kind of power it was: ON PLAY,
ON DEATH, ON HIT, TURN END, ACTIVATE, CAST, RESOLVE, and **RESPONSE** for
an Instant cast on the opponent's turn. Before this, the render showed a
power's *effects* (hits, sinks) but never its *source*, and gave
reactivity nothing beyond a stack chip. Your three slice-2 taste calls are
in too. Multi-unit penalties are now spectacle, which adds 0-3 holds per
match, all from Aegis's Feedback Plating sap. Source-faction tint and the
label/particle colour split were already how it worked, and the new
flourish follows both. Full detail is in `progress/render/log.md`,
session 6.

**Evidence:** the event log names a power's source by card name only, so
two copies on the board are ambiguous. This slice pins each power to the
exact copy using instance-exact facts from the same move. A test checks
that against the engine's own truth, recorded by a test-only wrapper
around the engine's ability resolver. Over 48 real matches (all 16
pairings, mirrors included) there were 819 powers and 385 exact-card
checks, with **zero wrong**. 91 of those needed disambiguating, and 6 were
left as honest "somewhere on this side" banners instead of a guess. There
are five replays in `render/output/`, including two new ones picked for
power variety (`cortex-vs-null-seed5`, `null-vs-swarm-seed2`). Each was
verified in headless Chromium single-stepped and at full speed: zero
console errors and identical FX tallies in both passes. I also found and
fixed a leak where floating numbers were never removed from the page
(since session 3).

**Decisions the owner may want to overrule:**
1. **Cause and effect are simultaneous.** The sigil and the hit/sink it
   caused start together. A ~150ms stagger (cast first, then effect)
   would read more causally but slows every power move a little and
   changes the approved `normal` pacing. Say if you want it.
2. **The tag names the trigger kind, not the effect.** "ON DEATH" rather
   than "ON DEATH: +Barrier to an ally". Full ability text doesn't fit on
   a card, and explaining *what* it did feels like commentary's job.
3. **How loud a response is.** A Common/Uncommon response is `normal`
   with a double-ruled tag, and a Rare+ response is spectacle. You could
   make every response a spectacle hold, since it's the reactive pillar.
4. **Commands cast from the avatar.** The sigil plays on the casting
   player's avatar, and the tag sits in the stack row on their side. The
   alternative is to draw a Command as a card flying onto the stack
   (bigger build).

**Where it's thin:** particle shapes are still the same for every faction
(slice 5). The truth check can't see onDeath/onDamaged powers, which
the engine fires from inside its resolver. Those are checked for
consistency only.

**Next:** slice 4 (attack travel + impact). It may be unblocked now,
because the engine's combat stack item already carries exact attacker
and target instance IDs.

---

## 2026-09-26 — Buff/penalty grammar (EFFECTS.md slice 2) + player avatars — AWAITING FEEDBACK

**What this delivers:** EFFECTS.md slice 2 — buffs **rise** (lift, brighten,
motes float up, gold label) and penalties **sink** (press down, desaturate,
motes fall, slate label), faction-tinted and tier-scaled, plus persistent
state (▲/▼ stat markers vs printed, dashed Stasis/Overload badges). A
temporary buff wearing off gets a quiet "settle" instead of either. Also the
owner's avatar slot: a username-seeded SVG placeholder beside each player's
name in the HUD and match bar, with an `avatarUrl` slot ready for real
images. Full detail: `progress/render/log.md`, session 5.

**Evidence:** it fixes three misreads the old render made in every match
measured — debuffs flashing as gold buffs (up to 15 per match), +HP buffs
drawn as heals (3–14), Null's -2/-2 drawn as a hit (up to 5). The fix is
exact rather than a guess, because it uses the engine's own
health = maxHealth − damage model. Three new replays in `render/output/`.
Verified in real headless Chromium, single-stepped and at full speed: zero
console errors, and both passes gave the same FX tally. Render tests went
from 40 to 81, including a parity test that runs the page's hand-mirrored
inline JS against the TS module. Before this, drift between the two was
only checked by eye.

**Decisions the owner may want to overrule (taste calls):**
1. **What counts as "big".** Every penalty in the committed replays lands
   `normal`, not spectacle. The pool's most common penalty is Aegis's
   recurring -1 ATK sap on the whole enemy board, and treating that as
   spectacle meant several holds per match on a routine -1. Only 2+ points
   per unit across 3+ units (e.g. Mainframe Core's +1/+1 to all) reaches
   spectacle. Say so if you want board-wide saps louder.
2. **Tint source.** A buff/penalty is tinted by the *source card's* faction
   where the event log names it (Feedback Plating's sap on Null units is
   Aegis-tinted), otherwise by the side that usually causes it. The
   alternative is to always tint by the *affected* unit's faction.
3. **Label colours carry meaning; motes carry faction.** Buff labels are
   always gold and penalty labels always slate, whatever the faction, so the
   invariant holds even for a viewer who ignores the particles.
4. **The avatar look.** It's a symmetric 5×5 "circuit face" in faction
   colour with a hue-seeded frame ring, and the same username always gives
   the same avatar. It's a placeholder by design, but it's the seed the
   1-of-1 leader art is meant to reuse, so the look is worth a glance.

**Where it's thin:** a unit hit and debuffed on the same move shows only one
card animation, though both labels still appear. A penalty *lifting* reads
as a buff. Particle character is the same triangle for every faction until
slice 5.

**Next:** slice 3, the power/ability cast flourish.

---

## 2026-09-26 — Defence/shield primitives (EFFECTS.md slice 1) — AWAITING FEEDBACK

**What this delivers:** the first slice of `render/EFFECTS.md`'s build
order — the standing visual-language spec the owner set up two sessions
ago. Three defence/shield primitives, built once and shared across every
faction (no per-faction work needed, since Barrier/Guard/baseArmor are
card-level traits, not faction-specific mechanics): Barrier's interpose +
absorb + shatter (a cyan flash + floating "BLOCKED" label the moment a
unit's Barrier status is consumed — closing a real gap where a
fully-absorbed hit previously got NO visual at all, since health doesn't
change when Barrier eats the whole hit), a persistent shield badge on Guard
units (plus a matching *live* one for an active Barrier, replacing a
pre-existing minor inaccuracy where the old text tag stayed lit forever
after the shield was already spent), and a small, deliberately un-scaled
deflect spark whenever a unit with base armor takes damage. Full detail:
`progress/render/log.md`'s session-4 entry.

**Evidence:** two new `UnitSnapshot` fields (`baseArmor`, `barrierActive`)
read straight off real engine state, proven with 3 new whitebox tests
(`render/test/defenceSnapshot.test.ts`) against real matches via
`captureMatch`, not synthetic fixtures — a real Aegis Cadet reports
`baseArmor: 1`, a real Barrier Node's `barrierActive` flips true the moment
it's played. The tier scoring for Barrier's shatter is a 4th pure, tested
function alongside session 3's existing `fxMagnitude.ts` module. Both
committed replays were re-scanned and regenerated (`aegis-vs-swarm-seed16`,
`aegis-vs-cortex-seed20`) specifically to exercise all three mechanics in
one match, then verified in real headless Chromium both single-stepped
(shield badges rendered dozens of times, the shatter flourish fired
multiple times, zero console errors) and at full autoplay speed (reached
the end, zero console errors) — session 3's own "verify at play speed, not
just single-step" bar, re-checked because this session's new tier
(`barrierBreakScore`) plugs into the same adaptive-pacing machinery.
`npm test`: engine 86/86, protocol 7/7, server 23/23, agents 17/17, render
40/40 (34 + 6 new). `npx tsc --noEmit` clean in all five workspaces.

**Where it's strong:** a real bug was found and fixed before shipping, not
after — the first badge implementation used a shield emoji that rendered
completely invisible in this environment's real headless Chromium (no
colour-emoji font installed), caught by actually screenshotting it rather
than trusting the DOM/mutation-count evidence alone, and fixed by switching
to plain capital-letter badges that match this codebase's own existing
single-letter rarity-badge convention. The Barrier fix specifically closes
a real, named legibility gap (a fully-absorbed hit previously had zero
visual feedback at all), not just a cosmetic addition.

**Where it's thin, named honestly:** a hit small enough to be *fully*
absorbed by base armor (health unchanged) doesn't trigger the deflect spark
— that needs the same instance-keyed event data the balance lane's
still-open instance-ID gap (2026-09-25 owner-feedback) would provide. The
new shield badges weren't stress-tested against a worst-case crowded card
(evolved, tooled, tagged, AND badged all at once). Session 2/3's own
already-named thin spots (floating-number stacking, no fixed-slot board
layout, untuned momentum weights) are all still open, untouched this
session.

**Decisions the owner might want to overrule:**
1. **Barrier's shield badge is LIVE (tracks `barrierActive`, disappears the
   instant it's consumed), not a static "this card can have Barrier"
   indicator** — a deliberate accuracy call, and it also meant removing the
   pre-existing "BARRIER" text tag (which stayed lit forever, inaccurately)
   from the generic keyword-tag list. If the owner would rather a unit's
   Barrier-*capability* stay visible even once spent (e.g. for a
   Tool-granted Barrier that could be re-triggered), that's a different,
   easy-to-build indicator — this session built the "is it live right now"
   read instead, reasoning that's what a spectator actually needs to judge
   an upcoming attack.
2. **The base-armor deflect spark is intentionally NOT tier-scaled** — the
   spec's own word "small" was read as "always small," not "small unless
   the hit is big." Easy to make it participate in the tier system instead
   if that reads as under-selling a big deflected hit.
3. **Guard's persistent badge and Barrier's persistent badge use the SAME
   shield-family visual (steel vs. cyan-pulsing)** rather than two visually
   unrelated icons, reasoning they're both "defence" in the same grammar
   family even though they're mechanically different (taunt vs. one-shot
   absorb). If that reads as conflating two different mechanics rather than
   a coherent shared language, they're easy to differentiate further.

**What's next:** per `render/EFFECTS.md`'s own build order, slice 2 (buff
rise / penalty sink grammar) or slice 3 (power/ability cast flourish) are
both unblocked and open; slice 4 (attack travel + impact) still explicitly
waits on the balance lane's instance-ID event-log fix, not yet landed.

---

## 2026-09-26 — Scale animation magnitude to event magnitude — AWAITING FEEDBACK

**What this delivers:** direct response to the owner's 2026-09-25 "scale
animation magnitude to event magnitude" feedback — session 2's eight FX
classes all played at one fixed size regardless of what happened; a
1-damage ping looked as loud as a Mythic entering. Every FX class now
carries a subtle/normal/spectacle tier, scored from the effect's own weight
(rarity, damage amount, AOE/board-wide count, unconditional-destroy vs
combat death) and/or the momentum gauge's swing, per the owner's own
five-point spec. `normal` is deliberately unchanged from session 2's
existing look (the owner's same-day pacing note calls the current rhythm an
approved baseline) — only the outliers move: subtle events are quicker and
quieter, spectacle events are longer, bigger, and get a new "burst ring"
visual plus a dedicated full-screen flash for the lethal blow. Autoplay
pacing is now adaptive too — the loudest tier in a move decides how long the
NEXT move waits (spectacle holds ~900ms extra so its animation actually
completes; subtle moves advance ~45% faster) — the "first concrete use of
the adaptive-pacing note" the owner's other 2026-09-25 entry asked for when
stage 7 arrives; this is earlier than that, scoped narrowly to what this
feedback asked for (magnitude-driven autoplay pacing), not full commentary
pacing. Full detail: `progress/render/log.md`'s session-3 entry.

**Evidence:** the scoring logic itself is a pure, unit-tested module
(`render/src/fxMagnitude.ts`, 20 new tests) — not just eyeballed thresholds.
Both committed replays were regenerated against the current card pool
(session 19 grew Aegis's pool since session 2's originals were captured) and
driven in real headless Chromium in TWO passes, closing the exact gap the
owner named ("verify at PLAY speed, not just single-step," item 5 — session
2 only single-stepped): single-step tallied real FX/tier classes landing on
DOM nodes across all 101/134 frames (zero console errors), and a SEPARATE
autoplay pass at the "fast" preset measured the actual gaps between moves
(118-1158ms, versus a flat 250ms before this session), confirming the >900ms
holds land specifically on the moves flagged spectacle — the pacing is
real, not just computed and discarded. A screenshot at a live spectacle
moment (an effect-kill mid-match) confirms the burst ring and scaled flash
render correctly. `npm test`: engine 86/86, protocol 7/7, agents 17/17,
render 34/34 (14 pre-existing + 20 new); the one server test failure is a
pre-existing, unrelated socket-timing flake (this session touched nothing
under `server/`). `npx tsc --noEmit` clean in all five workspaces.

**Where it's strong:** the magnitude model is data-driven and tested, not
just "make some things bigger" — a Mythic entering, an unconditional
destroy, a board-wide effect, and the lethal blow are all independently
provably spectacle-tier by their own scoring rules, matching all five of the
owner's named examples. The "normal" tier is byte-for-byte the same
animations session 2 shipped, so nothing regresses for the common case.

**Where it's thin, named honestly:** the browser-side scoring logic can't be
imported from the tested module (this file has no bundler, it's a
template-literal `<script>`) — it's hand-mirrored, a real (if small)
duplication-drift risk flagged in both files' own comments. Attack lunges
weren't given a magnitude tier (the owner's spec didn't name them as an
input). The lethal-blow full-screen flash fires on any game-ending move,
including a turn-cap/move-cap ending, not literally only a killing hit — it
reads as "the match just ended" rather than strictly "lethal," which may or
may not be the intended framing. Session 2's own already-named thin spot
(floating numbers stacking illegibly when two FX land on one card the same
move) is still present, confirmed again by this session's screenshot, and
still not fixed — it's a layering bug, not a magnitude-scaling one.

**Decisions the owner might want to overrule:**
1. **The tier thresholds and per-effect score weights** (`render/src/
   fxMagnitude.ts`'s constants) are this session's own reasoned first
   proposal, tuned against the five named examples and the two committed
   replays' own real numbers — not owner-set. Easy to retune if a tier feels
   wrong once there's more to eyeball it against.
2. **Adaptive autoplay pacing was scoped to this feedback's own ask**
   (hold on spectacle, speed past subtle) rather than building the full
   momentum/significance-driven commentary pacing the OTHER 2026-09-25 entry
   describes for stage 7 — that entry explicitly said "flag the exact
   pacing model at a checkpoint when stage 7 arrives," so this session did
   not treat this as that checkpoint. If the owner would rather this WAS
   that model, say so and it can be extended rather than redone.
3. **The lethal-blow flash applies to any game-ending move**, not narrowed
   to an actual killing blow only (see "where it's thin" above) — a
   deliberate choice to give every match's ending a beat, open to being
   narrowed if that reads wrong.

**What's next:** per RENDER.md's alternation rule, the next session goes
back to the balance/roadmap track. When the render lane comes back around,
session 2's two open candidates (fixed-slot board layout; a momentum-weight
retune) plus this session's own newly-flagged floating-number stacking fix
are all legitimate next picks — left open per this lane's own practice of
not over-prescribing.

---

## 2026-09-25 — Animated per-move transitions — AWAITING FEEDBACK

**What this delivers:** the render's biggest named gap against DESIGN's
arena bar ("animated card plays and attacks... enough motion and
readability") — session 1 shipped a turn-by-turn snapshot viewer with no
motion between frames; this session adds eight distinct, purpose-built
animations (card enter, card exit via a real positioned ghost, attack
lunge, hit/heal flash with floating damage/heal numbers, a telegraph-arming
pulse, an evolution pulse, and a stat-buff flash), plus smooth HP/energy/
momentum-gauge transitions. Full detail: `progress/render/log.md`'s
session-2 entry.

**Evidence:** two real captured matches, regenerated against the current
(post-Phase-4) card pool, single-stepped through every move in real headless
Chromium with a MutationObserver recording which FX actually fired on real
DOM nodes: `render/output/aegis-vs-swarm-seed1.html` (six of eight FX types,
79 moves, zero console errors) and `render/output/aegis-vs-cortex-seed24.html`
(all eight FX types including evolve and buff, 100 moves, zero console
errors) — seed 24 picked via a scratch seed scan specifically because it
exercises evolution, matching session 1's own practice for picking evidence
seeds. A mid-match screenshot (not committed, inspection only) confirmed the
floating damage/buff numbers land correctly positioned and legible. All 14
pre-existing render-lane tests still pass unmodified; typecheck clean across
all 5 workspaces.

**Where it's strong:** the animation is driven by an exact instanceId/
numeric diff between consecutive captured frames, not by parsing the event
log's text fields — which matters because a real bug was found and avoided,
not just a design preference (see "decisions to overrule" below).

**Where it's thin:** box-shadow flashes (hit/heal/buff) can visually
overwrite each other if more than one fires on the same card in the same
step (rare, not observed in either committed match, not a crash). Board
layout is still frame-by-frame with no persistent per-slot identity, so a
surviving unit can visually "jump" position the same step a neighbour dies
elsewhere on the row. Momentum's gauge now animates smoothly but its
underlying weights are untouched. Token summons don't get a distinct visual
from a normal play. Still 1v1 only.

**Decisions the owner might want to overrule:**
1. **Animation intentionally does NOT use the event log's own
   attacker/defender/target/unit fields.** Checked the engine source rather
   than assumed: those fields are card/player *names*, not instance IDs
   (`engine/src/engine/engine.ts`, `engine/src/effects/resolver.ts`) — which
   means they cannot reliably distinguish which specific copy of a card, or
   which of two players, an effect applied to whenever both sides share a
   name (a mirror match on cards, or same-named agents like
   Lookahead-vs-Lookahead, which is this project's own standard balance-test
   shape). This lane can't fix the event log (RENDER.md forbids editing any
   engine file) — flagged as a real gap in `progress/render/notes-for-owner.md`
   for the balance lane, since it also affects the scrolling text event log
   itself (pre-existing, just not previously named as an identity gap).
2. **Animation only plays on single-step playback, not on jumps.** A
   scrubber drag or First/Last does an instant, unanimated re-render. This
   was a deliberate scope call (a jump has no coherent "in between" to
   animate), not an oversight — flagging in case the owner wants jump
   animation too (e.g. always animating toward the target frame).
3. **Session 1's `aegis-vs-cortex-seed1.html` was replaced, not kept
   alongside the new file.** Regenerating it against the current (much
   changed) card pool no longer produced a short match exercising varied
   mechanics, so this session removed it and committed
   `aegis-vs-cortex-seed24.html` instead, keeping the "two current replays"
   convention from session 1's own notes-for-owner flag about not letting
   committed evidence accumulate. If the owner wants prior sessions'
   evidence kept for comparison rather than superseded, say so and future
   sessions will stop replacing.

**What's next:** per RENDER.md's alternation rule, the next render-lane
session is two sessions away. Leading candidates named in
`progress/render/log.md`: a fixed-slot board layout (fixes the same-step
reflow), or the still-open momentum-weight pass.

---

## 2026-09-24 — First watchable render: a real match, turn by turn — AWAITING FEEDBACK

**What this delivers:** the first working slice of DESIGN.md's stage 6
(spectator render), carved out to run in parallel per RENDER.md/the
2026-09-24 owner-feedback entry that created this lane. A self-contained
HTML page that plays back a real, engine-produced match turn by turn: both
players' boards (all 6 shared slots), live unit stats (tools/auras/buffs
baked in, not printed values), telegraph/evolution/tool/status state, the
public stack, health/energy, hands, a full event log, and a computed
momentum gauge. Not a mockup — every number on the page comes from actually
running the match through the real engine.

**Evidence:** `render/output/aegis-vs-swarm-seed1.html` and
`render/output/aegis-vs-cortex-seed1.html`, two real captured matches (182
and 154 moves), openable in any browser, no external dependencies. Verified
rendering correctly (zero console errors, correct state at arbitrary scrub
positions, correct end-of-game banner) in a real headless-Chromium pass
before committing. 14 new automated tests + a clean typecheck across all 5
workspaces. Full detail in `progress/render/log.md`'s session-1 entry.

**Where it's strong:** the data is real and derived correctly (this was the
main risk — a renderer that quietly shows printed stats instead of live
ones, or drifts from what the engine actually did, would be worse than
useless for a spectator). The event log reuses the engine's own
`formatEvent`, so what a viewer reads matches the committed sample-match
logs word for word. The guardrails held: nothing under `engine/src/data/**`
or the other named balance/card files was touched; the small amount of
"engine internals" this needed (queries.ts's derived-stat helpers,
LookaheadAgent, buildNullDeck) is read-only, isolated in one file
(`render/src/engineInternal.ts`) with a comment explaining exactly why and
what it's not allowed to do.

**Where it's thin (honest, not just for the record):** no motion — frames
snap, they don't animate card plays/attacks the way DESIGN's arena bar
ultimately wants. Placeholder art is generative-but-simple (hue + one of 4
patterns), real per-card distinctness the way real art eventually will be.
Momentum's weighting is a first guess, not tuned against any real viewer
reaction. 1v1 only. All named as the concrete next-slice candidates in
`progress/render/log.md`.

**Decisions the owner might want to overrule (name them explicitly, per
DESIGN's checkpoint process):**
1. **Deep-importing engine internals instead of widening the public
   barrel.** `render/src/engineInternal.ts` reaches past
   `engine/src/index.ts` to import `buildNullDeck`, `LookaheadAgent`, and
   `state/queries.ts`'s derived-stat helpers directly from their source
   files, because RENDER.md forbids this lane from editing any engine file
   including `index.ts`. The alternative — the balance lane (or a future
   session with both lanes' permission) adding these to the public barrel —
   would be cleaner long-term but is out of this lane's authority. Flagged
   in `progress/render/notes-for-owner.md` too.
2. **Momentum's formula and weights** (health ×1.0, live non-pending board
   power ×0.6, hand size ×1.5, energy ×0.5, squashed into a ±100 display
   range) are this session's own reasoned first proposal, not owner-set
   numbers. If the "why" text reads wrong once there's real spectator
   feedback, it should change freely — nothing else depends on the exact
   weights.
3. **Rarity visual escalation was pulled forward slightly.** DESIGN scopes
   the full visual rarity ladder (full-art, foil/shine, "neon nights") to
   stage 8 — this session only added a modest inset-highlight/glow/pulse
   progression by rarity to the placeholder frames, reasoning that "cards
   render as literally identical rectangles regardless of rarity" would
   itself be a small regression against the "genuine visual interest" bar
   this stage is already held to. If this reads as scope creep rather than
   a reasonable placeholder-quality floor, it's easy to flatten back out.

**What's next:** per RENDER.md's alternation rule, the next render-lane
session is two sessions away (this task alternates focused slices — the
next session goes back to the balance/roadmap track). When the render lane
comes back around: animated frame transitions is the most obviously missing
piece against DESIGN's arena bar, named as the leading candidate in
`progress/render/log.md`, but left open for whoever picks it up to judge
against whatever's changed by then.
