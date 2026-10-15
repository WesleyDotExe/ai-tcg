# Render lane — checkpoints

The render lane's own checkpoint log (RENDER.md guardrail 4 — kept separate
from the shared `progress/checkpoints.md`). Newest at top, same convention
as the shared file. "AWAITING FEEDBACK" per DESIGN.md's non-blocking
checkpoint process: this flags and continues, never blocks.

---

## 2026-10-15 — The signature zone on the board, generated agents in the replays — AWAITING FEEDBACK

**What this delivers:**
- **Each signature card now has a home on the board:** a white-gold socket to the left of its side's six slots. It is outside the slots and never takes one.
- **While the card waits,** the socket shows it at what it would cost now. While it is out, the socket says ON BOARD with its name.
- **Under the socket:** the next cost, how far it has climbed (+2 per replay, in red), how many times it has been played, and whether it is within reach:
  - IN REACH: its owner's turn, and the pool covers it. The socket glows.
  - IN REACH NEXT TURN: the next refill covers it.
  - OUT OF REACH, or RETURNS IF IT DIES while it is out.
- **Playing it:** the card lifts out of the socket and arcs into its slot. Its entrance and its ward wait for it to land.
- **Its death:** it shatters like any Mythic. Then a white-gold card shape flies back to the socket, which fills and flares when it lands. Before, it just left the board and came back from nowhere.
- **The replays now use real generated agents** (your slice 7 call 6). Each side is what the engine's own generator gives: the agent's name is the username, and its signature card carries a PR- number.

**Evidence:**
- **Replay:** `render/output/cortex-vs-aegis-sig-seed5.html`, Wren Mk II (Last Courier) vs Tamsin of the Long Queue (Cinder Uplink):
  - move 43: both cards waiting; one IN REACH, one IN REACH NEXT TURN;
  - move 44, then →: Last Courier leaves for the board;
  - move 102, then →: Cinder Uplink dies and goes home; it now costs 7;
  - move 116, then →: it's played again for 7; the zone then reads 9, +4, played ×2.
- **Stills** in `progress/render/evidence/v2-s8-*.png`: the waiting zones, three frame strips from video (leave, return, replay), the replayed card, the narrow layout.
- **Measured in headless Chromium:** the zone matches the data on all 130 frames; 0 page errors.
- **Tests:** 18 new, render at 290. Every zone movement the page shows is checked against the engine's own events over five real matches (11 plays from the zone, 3 returns), and the cost shown is the cost the engine charges at the next play.

**Strong:**
- It's exact. The zone reads the engine's own public zone and cost function, and the tests hold it to the engine's events.
- The climb is legible. A replay at 7, then 9, is right there under the card.
- The other twelve replays' matches are unchanged; they just show no zone.

**Thin:**
- **The glow is rarely seen.** The reference agents play the card the moment they can afford it, so IN REACH lasts 3 moves or fewer in 25 of 32 scanned games.
- **The return competes with the shatter.** The card usually dies right next to its zone, and the Mythic shatter is still bright when the card shape flies home. It reads, but less clearly than the play.
- Only 3 of 32 scanned games had a signature card die, and 1 replayed it. That's the game, not the render.

**Decisions you may want to overrule:**
1. **The zone sits left of each row, outside the six slots.** Alternative: in each player's panel next to HP and energy (it would be smaller and farther from the board).
2. **The waiting card shows its next cost in its cost circle,** not its printed cost, so 5 becomes 7 after a death. The printed cost isn't shown separately; the red +2 says why.
3. **"In reach" uses the refill rule** (next turn's pool is max + 1, capped at 10). It doesn't count cost changes the board might make by then.
4. **The return waits 420 ms after the kill** so the card shape clears the shatter, which makes a signature death about half a second longer than other Mythic deaths.
5. **The replays take the first candidate** at each step of the generator. An owner picks by hand on the site; the replay can't.
6. **The generated agent's name replaces the "Lookahead-Cortex" style username** in replays with signature cards. Replays without signature cards keep the old usernames.

**Next:** your open render items (the website Music setting and menu music come with build-order steps 4-5). When the game lane's template names land, I'll regenerate the two signature replays so they carry them.

---

## 2026-10-14 — EFFECTS.md v2 slice 7: the fallback ward generator (v2 complete) — AWAITING FEEDBACK

**What this delivers:**
- **Every Mythic on the board now has a ward,** even with no art. The ward is drawn by code from the card's name and faction: the same name always gives the same ward.
- **The main case is the signature card.** Every agent's signature card is a Neutral Mythic with a generated name. It's never in `mythics.json`, so the art pipeline never reaches it. Its ward is always the fallback: white-gold, with Neutral's own material (rune tablets and notched broken rings).
- **The fallback behaves like art.** It draws in over the card on arrival, sinks behind it, counter-rotates, and shatters when the card dies. Its behaviour is "generic": rotation plus a soft ring every 3.2 s.
- **Set Mythics keep their art.** A Mythic only falls back if its art is missing, for example a new Mythic the pipeline hasn't reached yet. It then keeps its own behaviour (seats, aura and so on).
- **Each faction draws in its own material:** Cortex chips, Aegis plates, Swarm eggs and curves, Null torn rings, Neutral rune tablets. The symbol rules from `_howToAddAMythic` (no stars, crosses, eyes and so on) hold, and the tests check them.
- With this, **all seven EFFECTS.md v2 slices are built.**

**Evidence:**
- **Replays:**
  - **New** `render/output/cortex-vs-aegis-sig-seed5.html`, with a signature card on each side. Consensus Lantern arrives at move 44 and Tollgate Daemon at move 47. Both die and come back (deaths at moves 96 and 103, replays at 100 and 116). Quorum Arbiter's art ward is on the board from move 78, next to them.
  - **New** `render/output/cortex-vs-aegis-sig-seed2.html`: four Mythic wards at once (two art, two fallback).
- **FX sheet part 5** (`render/output/fx-sheet.html`): 15 fallback wards spinning, three per faction. Each faction's row starts with what its set Mythic would get without art.
- **Stills** in `progress/render/evidence/v2-s7-*.png`: the gallery, an arrival on top, a ward at rest behind, a shatter, a second arrival, and the four-ward board.
- **Measured in headless Chromium:**
  - Every arrival went from on top to behind; both deaths shattered; 0 page errors.
  - Drawing a fallback sheet takes 3-9 ms, once, at page load.
  - Frame rate by wards on the board (headless software rendering): median 51 fps with none, 33 with four (minimum 25).
- **Variety:** the 303 signature menu ids give 303 different wards. 299 of them also differ in pattern and counts, not just in glyph strokes.
- **Tests:** 15 new, render at 272.

**Strong:**
- Same name, same ward, on any machine. The plan is plain data, and the tests pin the hash.
- Nothing extra is shipped. The fallback is drawn in the browser, so a replay with two signature cards is no bigger than one without.
- A failure can't break a card. Drawing is wrapped in a try/catch, and a sheet that fails means no ward.

**Thin:**
- **Every fallback is a ring.** The patterns, counts and glyphs vary, but two wards from the same faction read as siblings. Real art is much more individual.
- **The signature zone isn't drawn yet.** A signature card that dies just leaves the board, and its replay appears from nowhere. Only the event log says it went back to the zone. This is the next slice.
- **Four wards cost frames** (33 fps median, headless). A real GPU should do better, but I haven't measured one.

**Decisions you may want to overrule:**
1. **The signature card gets a Mythic ward.** Session 16's note said it gets no ward because Neutral has no ward. I read that rule as covering faction wards (for signature abilities). The signature card is a Mythic, and every Mythic carries its own ward. Alternative: signature cards get no ward.
2. **Signature cards always use the fallback, never Replicate art.** Each agent's card is unique, so art would cost about $0.15 per agent, through the existing pipeline. Alternative: add each generated agent's signature card to `mythics.json` and let the action draw it.
3. **"generic" is rotation plus a soft ring every 3.2 s,** the quietest behaviour, so the card's actual ability isn't misread from its ward. Alternative: a behaviour read from the signature option (for example, Rally's ward could send motes to allies).
4. **The turn line now has a dark backing.** Before, a ward behind a top-row card drew over the turn and phase text. With a signature card on each side that would happen in most matches.
5. **Neutral's fallback material is rune tablets and broken arcs.** Neutral had no ward material before, because it has no faction ward.
6. **The demo signature cards' names (Consensus Lantern, Tollgate Daemon) are mine,** for the replays only. Real names will come from the engine's agent generator.

**Next:** the signature zone on the board. That means a place per side showing the signature card and its next cost, with deaths flying the card back to the zone and replays leaving from it.

---

## 2026-10-13 — EFFECTS.md v2 slice 5: faction wards for signature abilities — AWAITING FEEDBACK

**What this delivers:**
- **The first time one of your ten approved signature abilities fires, its faction's ward appears.** It's the Rare single-ring ward from the faction sheets. It draws itself in over the card, and as it spins up the effect leaves from it. Then it folds away. Later fires of the same ability on the same card get no ward (your "first fire only").
- **What the ward does next depends on what the power did,** worked out from the effects themselves, never from card names:
  - **Attack** (damage, a removal, a debuff or a stun on the enemy): the ward flares and the effect flies out of it. That covers Kernel Panic, Dormant Egg Sac, Deprecated Routine, Dormant Exploit, Rate Limiter, Retaliation Node and Lockdown Field.
  - **Defence** (a Barrier): a copy of the ward flies onto each unit it shielded and **stays behind that card for as long as the Barrier stands**. When the Barrier takes its hit, the copy cracks apart on the same beat as the BLOCKED shield. That covers Latent Ward (every ally) and Aegis Warden (itself).
  - **Self** (an effect on its own card only): the ward plays in place. That's Overload Capacitor.
  - **Buff** (helping allies, not a Barrier): a smaller copy settles on each ally. It's built, but none of the ten is a buff, so no replay shows it.
- **A Command's ward plays on its stack entry,** sized like a card. That's Lockdown Field.
- **The ward is the power's flourish.** On that move it replaces the cast sigil and cast sound; the trigger tag ("ON PLAY", "TURN START") still names the power.
- **A Mythic with its own ward flares that ward instead.** None of the ten is a Mythic yet, so nothing shows it.

**Evidence:**
- **Replays:** all ten abilities fire in the committed replays.
  - `null-vs-cortex-seed4.html` move 70: Kernel Panic.
  - `aegis-vs-cortex-seed6.html` move 93: Lockdown Field.
  - `aegis-vs-null-seed3.html` move 89: Deprecated Routine.
  - `swarm-vs-null-seed8.html` move 86: Dormant Egg Sac.
  - `aegis-vs-aegis-seed1.html` move 77: Aegis Warden.
  - **New** `aegis-vs-cortex-seed1.html`: Rate Limiter at move 117. Latent Ward at move 135 guards four units, and all four guards crack at move 150, when Rate Limiter's second tick hits their Barriers.
  - **New** `aegis-vs-cortex-seed3.html`: Dormant Exploit at move 100, Retaliation Node at 110 (on a strike) and Lockdown Field at 130.
  - **New** `cortex-vs-swarm-seed6.html`: Dormant Exploit and Rate Limiter together at move 58, then Overload Capacitor at 59.
- **Stills** in `progress/render/evidence/`, all `v2-s5-*.png`: Kernel Panic, Lockdown Field, Retaliation Node, Egg Sac, the double Cortex flare and Overload Capacitor firing; Latent Ward's guards flying in, resting behind and cracking; Aegis Warden's guard.
- **Measured in headless Chromium:**
  - At every one of these moves the runtime's state matched the detector: the ward is over the card while it draws in and fires, and gone after the effect lands. Guards fly in, then rest behind (fully under the card).
  - All twelve replays played to the end at fast speed with 0 page errors. Each one's ward count matched its detected signature fires.
- **Tests:** 18 new, render at 257.

**Strong:**
- The role comes from the event log, so a new signature ability only needs its line in `mythics.json`.
- Guards follow the real Barrier frame by frame, so a jump with the scrubber always shows the right guards.

**Thin:**
- **The buff copy has never been seen in a replay,** because no approved ability is a buff.
- **A busy move is busy.** Move 58 of `cortex-vs-swarm-seed6` has two Cortex flares, a Stasis, an area hit and three deaths at once (see the still).
- **No FX-sheet audition yet.** The other slices each have a section in the FX sheet; this one is only in the replays.

**Decisions you may want to overrule:**
1. **"First fire" means the first fire that did something.** A fire with no effect (for example, a condition that finds no target) doesn't use up the ward. In practice the engine doesn't log Rate Limiter's ticks that fail their condition, so this hasn't changed any ward in these replays yet.
2. **A defence's guard stays behind the card until the Barrier breaks,** possibly many moves later. That's my reading of "a copy moves onto the ally, takes the hit and cracks apart" in a replay. The alternative is a copy that settles and fades within the same move.
3. **Resting guards are quiet** (half opacity). At full brightness, four guards in a row read as a wall of rings.
4. **The ward leads its effect by about half a second at normal speed** (0.75 × the tick, 200-600 ms), and the move is held like any spectacle moment (+0.9 s). Signature moves are rare (0-3 per match here), so the overall pace barely changes.
5. **The ward replaces the cast sigil and cast sound** on that move, rather than playing on top of them.
6. **Overload Capacitor's signature is its drawback** (it damages itself over three turns). Its ward plays in place. You may want it off the list, or to keep it so the card reads as special when it lands.

---

## 2026-10-11 — Mythic wards behind the card (your 2026-10-11 entry) + EFFECTS.md v2 slice 6 — AWAITING FEEDBACK

**What this delivers:**
- **Every Mythic on the board now carries its own ward in the replays, behind the card** (your rule, built in from the start):
  - **Arrival:** the ward draws itself in on top of the card, the grid bends to it, and it holds there about 2.6 s. Then it fades back behind the card over 0.8 s.
  - **After that it stays behind.** The card's art, name and stats are fully visible, and only the parts of the ward reaching past the card's edges show. The core is hidden inside the card's outline.
  - **To keep a Mythic standing out** (you allowed this), the outer layers are brighter (×1.45) and larger (×1.16) behind the card than the lab had them over it.
  - **Live behaviour plays behind the card too:**
    - Quorum Arbiter lights one seat per enemy unit;
    - Prime Aegis tethers its allies, crests them, and rolls a pressure ring;
    - Hive Mother beats and sends larvae to her brood;
    - Null Singularity pulls the grid in and drags pointers into itself.
  - **Death:** the ward shatters into spinning pieces over the board, on the same beat as the card.
- **The Mythic card is obsidian + foil,** as the lab and EFFECTS.md have it: near-black, rimmed in its faction's colour, with a slow light sweep. Until now it was a bright faction card like any other, and a ward behind a bright card had nothing to stand out against.
- **Ward sounds:** a rising faction chord when a Mythic arrives (with the deep swell), and glass plus a falling chord when its ward breaks.
- **Your 2026-10-10 item 4:** a choice beside the music control, "arp: acting player" (default) or "arp: whoever is ahead". It's remembered with the music setting.
- **EFFECTS.md and the effects lab are updated to match.** The lab's "Mythic arrives" scene shows the sink behind the card.

**Evidence:**
- **Replays:** `render/output/null-vs-cortex-seed4.html` (Quorum Arbiter at move 58, Null Singularity at move 121), `cortex-vs-swarm-seed11.html` (Quorum Arbiter dies at move 99), `swarm-vs-null-seed8.html` (Hive Mother arrives at 45 and dies at 83), and any Prime Aegis replay (`aegis-vs-null-seed3.html`, move 78).
- **Stills** in `progress/render/evidence/`:
  - over the card on arrival: `v2-s6-hive-arrival-on-top.png`, `v2-s6-singularity-arrival-on-top.png`;
  - behind at rest: `v2-s6-hive-at-rest-behind.png`, `v2-s6-quorum-singularity-at-rest.png`, `v2-s6-prime-aegis-at-rest.png`;
  - the shatter: `v2-s6-quorum-death-shatter.png`, `v2-s6-hive-death-shatter.png`;
  - the lab: `v2-s6-lab-cortex-arrival-on-top.png`, `v2-s6-lab-cortex-at-rest-behind.png`.
- **Measured in headless Chromium:**
  - each Mythic's ward was fully over its card for the first ~2.5 s and fully behind by ~3.2 s;
  - Quorum Arbiter's lit seats matched the enemy count and its printed attack;
  - deaths shattered on the kill beat;
  - all nine replays played to the end with 0 errors.
- 23 new tests; render is at 239.

**Strong:**
- The rule is enforced in the maths, not just the drawing: a resting or flaring ward can't be drawn over a card, and the test checks it. The tests also check that the core fits inside the card while the middle and outer rings reach past its corners.
- Everything a ward does is read from `mythics.json`, so a new Mythic only needs its entry and its sheet.

**Thin:**
- **Frame rate:** one ward costs nothing measurable. Two wards during play cost about 10 fps in headless software rendering (45 against 55 at normal speed). A real browser with a GPU should do better, but I haven't measured one.
- **Neighbours hide part of the ward too,** not just its own card. On a full row you see it mostly above, below and in the gaps (see the Hive Mother still).
- **No signature-move flare is wired yet.** The four Mythics' abilities are all passive, and spotting signature moves comes with slice 5.
- **A brand-new Mythic without a sheet gets the obsidian card but no ward** until slice 7 (the fallback ward).

**Decisions you may want to overrule:**
1. **Built slice 6 before slice 5,** because your entry was about these wards and there was nothing in the replays to change yet. Slice 5 (faction wards for the ten signature abilities) is next.
2. **How long it stays on top:** 2.6 s, then a 0.8 s fade behind. Shorter or longer?
3. **How it stands out behind the card:** brighter and about 16% larger outer ring. The alternatives are larger still (it already reaches into the neighbouring slots and the opposing row), or a brighter rim on the card itself.
4. **The obsidian Mythic card.** It's EFFECTS.md's "obsidian + foil" treatment, but it does change how every Mythic card looks in the replays.
5. **The shatter flies over the board,** not behind it: death is the one moment the ward is in front again.
6. **"Whoever is ahead" falls back to the acting player when the match is even,** so the arpeggio never goes silent or flickers on a draw.

---

## 2026-10-09 — EFFECTS.md v2 slice 4: adaptive procedural music — AWAITING FEEDBACK

**What this delivers:**
- **Music in every replay,** generated live like the effects, with no files. It's the lab's piece: A minor, 104 BPM, Am–F–C–G.
- **It follows the match.**
  - It rests calm: a pad and bass.
  - Hits, kills and a Mythic arriving raise the intensity. That brings in the kick, the arpeggio, hats, then the snare and four on the floor.
  - It settles back over a few seconds.
- **The arpeggio plays in the acting side's faction voice,** the same voices as the effects.
- **A Mythic in play on the acting side** adds a bell every other bar and keeps the music a little higher.
- **It never drops out on a kill** (your 2026-10-03 note). Effects only dip it to 80%, back within a fifth of a second.
- **Its own control,** next to the sound control:
  - "♫ Music on", a volume slider (default 60%) and a small intensity meter;
  - on by default, starting on the first click or key press, like the sound;
  - one click mutes it, and the mute and volume are remembered;
  - muting the effects doesn't stop the music, and the other way round.
- **A music desk in the FX sheet** (part 4): pick a voice, push the intensity, and hear each layer come in.

**Evidence:**
- Any replay in `render/output/`; `aegis-vs-null-seed3` has the widest range.
- `render/output/fx-sheet.html`, part 4: the desk.
- Stills: `progress/render/evidence/v2-s4-music-controls-aegis-vs-null-seed3.png` and `v2-s4-music-desk-fx-sheet.png`.
- Headless Chromium, all six replays played through:
  - the music was never silent (kills included);
  - no clipping (peak 0.62);
  - every layer reached in a violent match, while a quiet one stayed in the lower half;
  - no change in frame rate;
  - 0 errors.
- 29 new tests; render is at 216.

**Strong:** it's the lab's music, as you heard it, with your one change (no kill dropout) built in so it can't creep back: there's no filter on the music's output at all. It's tied to the real events and the real acting side, so a Swarm turn sounds like Swarm.

**Thin:**
- I can measure it, not hear it. Judge it on the desk.
- It keeps playing (calming down) when the replay is paused or over.
- The intensity counts violence, not stakes: a lethal blow and a big mid-game hit of the same size lift it equally.

**Decisions you may want to overrule:**
1. **Music is on by default** like the sound, starting on the first click. Say if you'd rather it start off.
2. **Default music volume 60%** (the lab's default mix), separate from the 80% effects volume.
3. **Only violence drives it:** hits, kills and Mythic arrivals. Heals, buffs and blocks don't move it.
4. **The arpeggio follows the ACTING player,** so it changes voice every turn. The alternative is following whoever is ahead.
5. **It keeps playing while paused** and at the end, settling to calm. The alternative is fading out on pause.
6. **The website will need a separate Music setting** next to Sound (the replay remembers them separately).

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
