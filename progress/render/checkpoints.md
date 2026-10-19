# Render lane — checkpoints

The render lane's own checkpoint log (RENDER.md guardrail 4 — kept separate
from the shared `progress/checkpoints.md`). Newest at top, same convention
as the shared file. "AWAITING FEEDBACK" per DESIGN.md's non-blocking
checkpoint process: this flags and continues, never blocks.

---

## 2026-10-19 — Victory boasts, slice 3: the replay plays the match record's boast, and the close-win slot — AWAITING FEEDBACK

The replay now plays the boast the economy store recorded for that match, never one it picks. Open the
four new replays in `render/output/` and press `>|` then step back and forward into the last move (or
play them through):
- `recorded-boot-sequence.html`: the Cortex winner bought Boot Sequence (with credits earned in 37
  real recorded matches) and wears it: Boot Sequence plays, not Data Cascade.
- `recorded-close-win.html`: the Swarm winner ends on 3 health; its close-win slot holds Dial-Up
  Fireworks (bought), so that plays instead of its main boast, Hive Burst, and the plate says
  "DIAL-UP FIREWORKS · CLOSE WIN".
- `recorded-other-starter.html`: an Aegis agent wearing Null's free Void Collapse; its close-win boast
  (Hive Burst) stays unused because the win, on 14 health, isn't close.
- `recorded-empty-slot.html`: the Cortex winner's boast slot is empty, so the store records Cortex's
  starter (slot "factionStarter"), from the top seat.
The 16 older replays have no record and still play the winner's faction starter.

**How it's made:** each replay runs through the real store (in memory, fixed clock): starter
collections with the free boasts, an agent each, starter decks, season boasts earned in real matches
and bought, loadouts equipped; then the replayed match is started with `startMatch` (each side plays
the deck the store loaded), captured move by move, and recorded with both sides' final health. The
record read back from the store's history goes into the replay. A record that doesn't match its
replay (seed, winner, winner's health) is refused when the page is built.

**Evidence:**
- `progress/render/evidence/recorded-matches-s34.txt`: each scenario's loadouts, earnings, result and
  the record's boast and slot.
- **Browser check** (`boast-check-s34.mjs`, output `boast-check-s34.txt`): 216 checks, ALL PASS, with
  nothing forced (earlier checks wrapped the page's boast call). The boast is the page's own record's,
  from either seat, on desktop and a phone, in reduced motion; CLOSE WIN only for the close-win slot;
  Escape mid-boast; a replay without a record; the cosmetics switch off.
- **Recordings:** `v2-s34-rec-boot-desktop.webm`, `v2-s34-rec-close-desktop.webm`; stills
  `v2-s34-*.jpg` (the plate on desktop and phone, the reduced-motion still).
- **Tests:** render 557 (+9): the picker (every slot, the fallbacks, never re-deciding a close win from
  health, a draw), the store end to end (the main, close-win and empty slots, the same every run, the
  record on the page), and the refused mismatches.

**Decisions you may want to overrule:**
1. **A close win is shown by the plate line only:** "<BOAST> · CLOSE WIN" instead of "· VICTORY". The
   boast plays the same as it does as a main boast. Alternative: nothing (the close-win boast just
   plays, as any boast), or a louder marker (the plate in the warning colour of a low HP bar).
2. **A record the render can't use falls back to the faction starter:** a record whose boast is the
   other side's, or a boast this render can't draw yet (a future season item on an old page). The
   page never shows "no boast" for a won match. Alternative: no boast in those cases.
3. **The recorded replays are the four above, beside the 16 samples** (the samples stay recordless,
   so the "old match" path stays visible). Alternative: re-make the samples through the store so every
   replay carries a record.

**Thin spots (in the debt list):** nobody has watched any boast at full speed; there is still no server,
so the records come from an in-memory store; at the end of the close-win replay the momentum gauge
calls the loser ahead (on board) and the lethal attack's smoke lingers on the loser's row (both
predate this slice).

**Next:** your calls on the Match Boot plan in `progress/render/notes-for-owner.md` (defaults stand if
there's no answer); then Match Boot slice 1; then the loadout picker (boast slice 4).

---

## 2026-10-19 — Victory boasts, slice 2b: the Season 0 boasts, Boot Sequence and Dial-Up Fireworks — AWAITING FEEDBACK

The two neutral Season 0 boasts you named, drawn, and so on sale in the store (300 credits each, the
whole of Season 0). Open `render/output/boast-sheet.html` and press Play on any of the ten Season 0
scenes (each shows a different faction winning: they are neutral). A replay plays them once slice 3
reads the match record; until then it plays the winner's faction starter.

**What this delivers (each about 3 s, the same grammar: from the winner's side, nothing toward the
loser, ending on the name):**
- **Boot Sequence** (phosphor green):
  - the winner's side powers on like an old CRT: a bright dot widens into a line, the picture opens
    from it, flickers, then a dark screen with scanlines; a tube's thump and whine, then the POST beep;
  - five BIOS lines print and scroll up like a terminal ("AI-TCG ARENA BIOS REV S0", "MEMORY TEST
    65536K OK", "AGENT <the winner's faction> ONLINE", "LOADING VICTORY.SYS", "BOOT >"), each with
    key clicks, then the screen clears;
  - the winner's name types into the plate, a key at a time, in the BIOS type behind a block cursor;
  - SYSTEM READY in chunky dot letters flashes twice and holds, with the sting.
- **Dial-Up Fireworks** (neon):
  - night falls on the winner's side; a modem handshake (dial tones, the answer tone, the screech)
    while a neon skyline rises out of the winner's row, its windows flickering like data;
  - rockets whistle up from the rooftops, left to right, and pop; each burst's pixels fly up and
    spell its letters of the winner's name, in a 5x7 pixel font, one colour per burst;
  - the name lights as one with the sting; the name plate under the skyline.
- Each has a reduced-motion still (Boot: the screen on, SYSTEM READY and the whole name; Dial-Up: the
  skyline and the spelled name), skip by tap, Escape or Skip, and a phone layout (SYSTEM READY and a
  two-word name break onto two lines when that makes them larger).
- **Two fixes to the victory grammar's checker** that these boasts exposed (they apply to all six):
  - a flare is now checked to the edge of its glow, not just its core;
  - a squashed shock ring (a flat flash along a row) stays level instead of turning at random. Tilted,
    it reached into the loser's side. This also levels the existing flat ring under a hit on a
    player's side, as a ring on the floor was always meant to look.

**Evidence:**
- **Recordings:** `progress/render/evidence/v2-s33-boot-desktop-seat1.webm`,
  `v2-s33-dialup-desktop-seat1.webm` (a real replay's last move, the boast forced, as described).
- **Stills** (`v2-s33-*.jpg`): each beat of both on desktop; the name moment from the top side and on
  a phone; reduced motion; after a skip; all ten sheet scenes.
- **Browser check** (`boast-check-s33.mjs`, output `boast-check-s33.txt`): 385 checks, ALL PASS. Each boast in a real replay's last move (forced, as noted) from seat 1 and
  seat 2 on desktop and on a phone, and in reduced motion; Escape during Boot Sequence's typing (the
  typing stops with it); a phone tap during Dial-Up Fireworks; Shield Slam unforced (the starter still
  plays); all 30 sheet scenes, each with nothing lit on the loser's side at 2.5 s. Boasts start 1.2-1.3 s
  after the step; Boot's name types in from 1.55 s and is whole 0.60-0.65 s later; Dial-Up's plate at
  2.35 s; the result at 3.00-3.02 s (1.0 s for the stills). Frame rate (CPU canvas, 1 s): Boot 62 during
  vs 62 after, Dial-Up 55 vs 55, Shield Slam 63 vs 62.
- **Tests:** render 548 (+48): the font (every character an agent name may use, letters and digits
  distinct), the layout (one line or two), each boast's shape (the screen, five lines that only ever
  step up, the typed name within 0.6 s, SYSTEM READY's two flashes; a skyline whose feet stay on the
  floor, every dot of the name landing on its cell, one colour per letter, bursts left to right), the
  grammar on both seats, three row fills, desktop and phone, 300 random layouts, and 120 random
  layouts with names from 2 to 24 characters; the new sounds.

**Decisions you may want to overrule:**
1. **"Types out the winner's name line by line":** I read it as the BIOS printing its lines one at a
   time, ending in the name typed out a key at a time (in the plate, so it stays legible).
   Alternative: the name itself as a big pixel banner printed row by row.
2. **The BIOS lines scroll UP,** as a terminal does (each new line at the bottom pushes the others up),
   rather than printing downward: down is the debuff's direction. The CRT's picture opens up and down
   from its centre line, since that is the screen switching on, inside the winner's side.
3. **Phosphor green** for Boot Sequence (not amber or white BIOS text).
4. **The name shows twice in Dial-Up Fireworks:** spelled in firework pixels and on the plate. On a
   phone a long name's pixels are 3-4 px, so the plate is the legible copy. Alternative: the plate
   shows only "DIAL-UP FIREWORKS · VICTORY" under the spelled name.
5. **The fireworks never fall:** each burst fans up and out and fades, with no falling sparkles (down
   is the debuff's direction). Real fireworks droop; these don't.
6. **A neutral boast keeps the winner's faction** for the lit panel and the sting's voice; the boast's
   own colour is for its pieces and the name plate.
7. **The modem screech is about 0.9 s,** a compressed handshake, with the music held down under it.

**Thin spots (in the debt list):** nobody has watched or heard them at full speed; they show in a
replay only once slice 3 lands; the spelled name is busy over a Mythic ward; the BIOS type is the
system's monospace font.

**Next:** your call on these; then slice 3 (the replay reads the boast from the match record, and the
close-win slot).

---

## 2026-10-19 — Victory boasts, slice 2: Hive Burst, Void Collapse, Data Cascade, and the cosmetics switch — AWAITING FEEDBACK

Slice 2 of the boast plan. Every faction's win now plays its free starter boast. Open
`render/output/boast-sheet.html` and press Play on any scene, or step into the last move of
`swarm-vs-aegis-seed8.html` (Swarm), `null-vs-cortex-seed4.html` (Null) or `cortex-vs-null-seed5.html`
(Cortex).

**What this delivers (each about 3 s, same grammar as Shield Slam: rises from the winner's side, never
touches the loser, ends on the name):**
- **Hive Burst (Swarm):**
  - the winner's row darkens a little, so green reads on green cards;
  - an egg sac swells up in every slot, centre first;
  - each sac bursts in the same order, throwing spores straight up;
  - six spores climb into a zig-zag column over the name, and the rest rise on and fade;
  - a seventh spore crowns the column with the sting.
- **Void Collapse (Null):**
  - a dark star opens over the winner's row (a black core, slowly turning) and the side goes dark;
  - motes of light lift out of every slot and are pulled into it;
  - it collapses to a point and holds a silent beat;
  - then it blooms wider with the sting, tearing glitch bars out sideways;
  - four bars slide in and frame the name.
- **Data Cascade (Cortex):**
  - the row darkens a little;
  - columns of pixels stream up out of every slot, centre first;
  - the row flashes as one;
  - each column's lead pixel climbs and snaps into a wireframe block, stacked three, then two;
  - the top block locks with the sting.
- **Cosmetics: on / off** (your decision 7), a button in the replay's controls, remembered per viewer.
  - Off: a win shows the result at once, as a draw does.
  - Switched off mid-boast: the boast ends and the result lands.
  - A replay is a spectator's view, so the switch hides both sides. The owner-page rule (hide only the
    other side) is written and tested, ready for the owner pages.
  - Today it only hides boasts: no card backs, avatars or arenas are drawn yet.
- The store's catalogue now marks the three new boasts as drawn (they're free starters, so nothing goes
  on sale). Boot Sequence and Dial-Up Fireworks stay undrawn and off sale until the next slice.

**Evidence:**
- **Recordings:** `progress/render/evidence/v2-s32-swarm-desktop-seat1.webm`, `v2-s32-null-desktop-seat1.webm`,
  `v2-s32-cortex-desktop-seat1.webm`.
- **Stills** (`v2-s32-*.jpg`):
  - each beat of each boast on desktop;
  - the name moment from the top side and on a phone;
  - reduced motion;
  - after a skip;
  - cosmetics off;
  - sheet scenes on an empty row and from the top side.
- **Browser check** (`boast-check-s32.mjs`, output `boast-check-s32.txt`): 322 checks, all pass, covering:
  - each boast from both sides on desktop and on a phone;
  - the timings (start about 1.2 s after the step, the name at 2.2 s, the result at 3.0 s);
  - the grammar on every real layout;
  - nothing drawn on the loser's side;
  - skip;
  - reduced motion;
  - the switch (off mid-boast, remembered after a reload, on again).
- **Tests:** render 500 (+60). Every boast keeps the grammar on both seats, full, half and empty rows,
  desktop and phone, and 300 random layouts each. The tests also check each boast's shape:
  - sacs never move;
  - the star holds silent before the bloom;
  - motes never move down;
  - the blocks stack 3, 2, 1;
  - the bars frame the name.
- **A new replay:** `swarm-vs-null-seed4.html`, where Null wins from the top side.

**Decisions you may want to overrule:**
1. **Data Cascade streams UP, not down.** Your plan said "columns of pixels rain onto the winner's row".
   Down is the debuff's direction, so the pixels upload out of the row instead (the same call you kept for
   Shield Slam). Alternative: rain from the top of the winner's side, stopping at the row.
2. **The column of spores is a zig-zag of seven,** standing over the name; it doesn't spell the name out
   (the name is the plate under it). Alternative: spores that gather along the plate's edges.
3. **Null's star is a black hole with a purple corona,** turning slowly. It's the one boast piece drawn as
   darkness, not light. Alternative: a bright star.
4. **The silent beat:** about 0.2 s with nothing moving or sounding between the collapse and the bloom.
   Alternative: a low hum under it.
5. **Hive Burst and Data Cascade darken the winner's row from the start** (Shield Slam darkens it only
   under the crest). Without it, green on green cards and cyan on cyan cards didn't read in the stills.
   Alternative: brighter pieces and no early wash.
6. **The switch is a button in the replay's controls** ("Cosmetics: on"), next to the sound buttons.
   Alternative: under a settings menu once there is one.

**Thin spots (in the debt list):**
- Nobody has watched or heard any boast at full speed on a real screen.
- The crests are about 100-120 px across on desktop: readable, not grand.
- The switch has only boasts to hide so far.
- The store wording of two starter boasts still describes the drafts (a note for the game lane in
  notes-for-owner.md).

**Next:** your call on these; then the two Season 0 boasts (Boot Sequence, Dial-Up Fireworks).

---

## 2026-10-19 — Victory boasts, slice 1: the victory grammar and Aegis's Shield Slam — AWAITING FEEDBACK

Slice 1 of the boast plan you approved (all 9 defaults). Open `render/output/aegis-vs-null-seed3.html`,
drag the scrubber to the second-last move and press > (or press Play from near the end). Or open
`render/output/boast-sheet.html` and press Play on any scene.

**What this delivers:**
- **The victory grammar, enforced in code.** A boast rises and radiates from the winner's side and ends
  on the winner's name. It never moves toward the loser and never touches the loser's cards or panel.
  Before playing, the page checks the boast's whole layout against the real board:
  - every plate, spark, shockwave and the name stay inside the winner's side;
  - nothing ever moves down (the debuff grammar);
  - sparks only fly up, and only as far as the side reaches.
  
  A boast that would break the grammar plays as its still instead.
- **Shield Slam (Aegis's free starter boast), about 3 s:**
  - the winner's panel lights and the loser's side, panel and hand dim to 70%, with nothing moving on them;
  - 12 hex plates slam up out of the winner's slots, two to a slot, centre first, each with a clang;
  - embers lift off the wall, and the wall flashes as one;
  - the winner's row darkens; the bottom six plates lift into a hex crest and the top six rise away and fade;
  - the crest locks with a sting while the music dips under it;
  - the winner's name rises in under the crest ("SHIELD SLAM · VICTORY");
  - at 3 s "GAME OVER: X WINS" lands in the turn bar and the crest fades.
- **When it plays:** stepping or playing into the end. The lethal hit and its flash play as before, the
  boast starts about 1.2 s after the step, and the result line waits for it. A tap anywhere, Escape or
  the Skip button (top right of the winner's side) ends it at once.
- **Reduced motion:** the final pose (the crest), still, with the name, for 1 s.
- **On a phone,** if the winner's side is scrolled away, it scrolls into view first.
- **Boasts are data:** each one is a list of beats over a few shared "victory" pieces (plates slamming
  up, embers, a flash, a gather into a crest, the lock, the name). The other three starter boasts are
  new data plus a few new pieces, not new drawing code.
- Only Aegis has a boast so far. A win by another faction shows the result as before, until slice 2.

**Evidence:**
- **Recordings:** `progress/render/evidence/v2-s31-desktop-seat1.webm` (Aegis wins from the bottom side)
  and `v2-s31-desktop-seat2.webm` (from the top side).
- **Stills** (`v2-s31-*.jpg`): each beat (the wall rising, the wall locked, the gather, the crest and name,
  the result) on desktop and phone, both seats; reduced motion; after a skip; the sheet's scenes.
- **Browser check** (`boast-check.mjs`; output `boast-check-s31.txt`): 136 checks, all pass. It checks:
  - the timings (start 1.2 s after the step, the name at 2.2 s, the result at 3.0 s);
  - the grammar on every real layout;
  - the loser's side dimmed and unchanged, and nothing drawn on it once the lethal hit's own sparks are gone;
  - skip by Escape and by a phone tap (the result within 18 ms);
  - reduced motion;
  - a jump to the end, and a Cortex win (no boast).
- **Tests:** render 440 (+30). They check the grammar on both seats, full and empty rows, desktop and
  phone, and 300 random layouts. Each kind of break is caught (a sinking plate, a plate crossing to the
  loser, downward sparks, a name on the loser's side, and so on). The ids and names match the store's
  catalogue.
- **All 14 replays were regenerated, and they show different matches now.** The game lane's card
  changes since session 23 changed every match on the same seeds. One replay is new:
  `cortex-vs-aegis-seed1.html`, where Aegis wins from the top side.

**Decisions you may want to overrule:**
1. **Plates slam UP, not down.** Your plan said "hex plates slam down in a wall". But down is the
   debuff's direction in the grammar, so they rise out of the slot floors and stop dead with a clang.
   Alternative: drop them from above onto the row (it would read like Aegis's buff).
2. **A jump to the end plays no boast.** The boast plays when the replay steps or plays into the win,
   every time. Pressing |> or dragging the scrubber to the end shows the result at once.
   Alternative: play it on a jump too.
3. **The winner's own row darkens** under the crest and name, so they read over the cards (it's on the
   winner's side only). Alternative: no darkening, with a smaller name plate.
4. **The crest is a hex ring of six plates around a centre plate.** It's a first take on "locks into a
   crest". Alternative: a shield shape, or the faction's ward.
5. **The match feed still says "X wins" while the boast plays.** Only the turn bar waits for the boast.
   Alternative: hold the feed's last line too.
6. **On a phone the page scrolls to the winner's side** if it's out of view when the boast starts.
   Alternative: never scroll (the boast may play off screen).
7. **The music dips to 55% under the sting.** That's your decision 8; it's the one place the music goes
   below 80%. Alternative: a lighter dip.

**Thin spots (in the debt list):**
- Nobody has watched or heard it at full speed on a real screen.
- Only Aegis has a boast.
- The crest is a first take.
- The skip hint is only the button: there's no "tap to skip" text.

**Next:** your call on these; then slice 2, the other three starter boasts and the "Cosmetics: on / off"
toggle.

---

## 2026-10-19 — The starter guarantee on the page; the plan for victory boasts — AWAITING FEEDBACK

Two things this session: your side task on the starter guarantee (built), and the render half of
victory boasts (a plan, at a check-in, as your entry asks).

**1. The starter guarantee, on the page (built).** Open `render/output/first-time.html` and go
through the 3 starter packs.
- On these seeds, packs 1 and 2 hold no hit for any faction, so the store upgrades pack 3's shine
  slot (a Full Art Static Ward Beacon for every faction). Before the guarantee, the demo's 3 packs
  held no hit at all.
- **After the reveal only**, pack 3's summary reads "Starter guarantee: this pack was due a hit.",
  the same way a pity pack reads "Pity: this pack was due a hit."
- **The pack and the tear never change:** the sealed pack's markup is the same on all 3 packs, and
  pack 3's tear throws sparks like any pack with a hit.
- The ordinary pack page (`render/output/pack-opening.html`) never shows the note (its packs aren't
  starter packs). Rebuilt; only its data changed (`starterHit: false` on each pack).

**Evidence:**
- Browser check (`first-time-check.mjs`, output `first-time-check-s30.txt`): desktop (Swarm), phone
  (Aegis) and phone with reduced motion (Null), all pass. New check I: every faction's packs hold a
  hit; no note while a pack is sealed, torn or revealing; on the summary the note shows exactly on
  the pack the store upgraded; the 3 sealed packs look the same.
- Stills: `v2-s30-4-pack-{desktop,phone}.jpg` (the sealed pack) and
  `v2-s30-4b-last-summary-{desktop,phone}.jpg` (the note).
- Store transcript: `v2-s30-first-time-transcript.txt` (pack 3 marked "starter guarantee" for all 4
  factions).
- Tests: render 410 (+3). Every faction gets a hit on the demo's seeds, upgraded in pack 3; over 40
  other seed sets, the note marks exactly the pack the store upgraded and never one where pack 1 or
  2 already hit (both cases occur); only the summary reads the flag.

**2. Victory boasts, the render half: a plan, not built.** Full plan and 9 decisions with suggested
defaults in `progress/render/notes-for-owner.md` (session 30). In short: a new "victory" event
category in EFFECTS.md that always rises from the winner's side and never touches the loser; the 4
starter boasts as data over the existing primitives; the boast plays after the lethal beat and before
the result line, about 3 s, skippable; the render plays what the match record says and falls back to
the winner's faction starter boast; the loadout picker comes last. Four slices.

**Decisions you may want to overrule (this session's build):**
1. **The note's wording** mirrors the pity note: "Starter guarantee: this pack was due a hit."
   Alternative: "Starter guarantee: every new owner's starter packs hold a hit."
2. **The note is on the summary only**, not on the card's reveal (the pity note is summary-only too).

**Next:** your answers on the boast plan, then slice 1 of it. Otherwise the render debt list (the
turn-cap ending and the momentum gauge's pending threat).

---

## 2026-10-19 — The first-time flow: name your agent when it's made — AWAITING FEEDBACK

Your call 5 on slice 3. Open `render/output/first-time.html`, go through to "Generate your agent", pick one, and type a name.

**What this delivers:**
- **A name field on the agent screen.** It appears once you pick an agent, as a terminal prompt ("> ") under the three dossiers, with the agent's generated name as its placeholder. Leave it blank and the agent keeps its generated name.
- **The store's own rules, checked as you type.** The page doesn't copy the rules. It runs the economy store's actual name-check code, bundled into the page: 3 to 32 characters, letters, digits, spaces and ' . - _, no staff or game names ("TheRealAdmin", "Support Desk"), no blocked words. Repeated words are fine ("Static Static"), as you decided. Extra spaces are tidied the way the store tidies them ("  Night   Shift 99 " becomes "Night Shift 99").
  - A refused name turns the field red, shows the store's own reason ("An agent name can't pose as staff or the game ("admin")."), and the button reads "Name not allowed" and can't be pressed.
  - A good name shows "OK Night Shift 99 follows the name rules. The store checks no other agent has it when the card is made." The button reads "Pick Night Shift 99".
  - "Keep generated" clears it.
- **The name is used everywhere after that.** The picked dossier shows the typed name with the generated one struck through under it, and its avatar is redrawn for the new name. The new name is then on the signature screen ("NIGHT SHIFT 99'S SIGNATURE CARD"), in the mint's terminal, in the made card's flavour line ("Under Night Shift 99's eye, every unit grows."), and on the ready screen. The store prints the flavour line with the name the agent is created with; the page shows exactly what it prints (tested against the store).
- **The signature card prints its own rules text.** The game lane fixed the ability text at the source (session 45), so the face now reads the card's abilities, not the generator's concept. Keyword-only cards now print "Barrier" like every other card, not "Barrier.".
- **Three bugs from slice 3, found by this session's checks and fixed:**
  - **A pick couldn't be changed.** On the faction, agent and card screens, the plates you didn't pick vanished (a clash with the pack page's full-screen dimmer style), so you couldn't change your mind. Now they stay in place, dimmed, and can be picked.
  - **On a phone the confirm button could be untappable** once the page was scrolled to the bottom: the pack page's empty hint strip sat over it and caught the tap.
  - **After the packs, the flow's screens kept the last pack's footer** ("seed 103, odds S0-odds-2"). They now show the sign-up's own footer.

**Evidence:**
- **Recordings:** `progress/render/evidence/v2-s29-first-time-desktop.webm` and `v2-s29-first-time-phone.webm`, the whole flow by hand, with a name typed (by keyboard on desktop, after a tap on the phone).
- **Stills** (`v2-s29-*-{desktop,phone}.jpg`): a refused name, a typed name, the signature screen, the settled mint and the ready screen, all under the typed name.
- **Browser check** (`first-time-check.mjs`; output `first-time-check-s29.txt`): the same 3 runs as slice 3. Desktop and phone now type a name; reduced motion leaves it blank. All pass. New checks:
  - the field appears after a pick, with the generated name;
  - a tap focuses it on the phone;
  - a staff name is refused with the store's reason and can't be confirmed;
  - "Keep generated" is readable and works;
  - a good name renames the dossier and redraws its avatar;
  - the name is on every later screen and in the card's flavour line, and the generated one is gone from the card;
  - on all three pick screens a pick can be changed and the other plates stay visible.
  
  Slice 3's own runs (no name typed) still pass.
- **Store transcript:** `v2-s29-first-time-transcript.txt` ends with 12 typed names played through `confirmAgentDraft`: what the store made, or its refusal.
- **Tests:** render 407 (+5). The page's bundled rules agree with the store's on about 50 names, and every kind of refusal appears among them. For each name the store accepts, the page shows the agent name and flavour line the store made. For each name it refuses, the page refuses with the same reason. The avatar is the replay's own. Two mutation checks fail the tests: leaving the flavour line unchanged, and a check that only looks at length.

**Decisions you may want to overrule:**
1. **The field appears after you pick an agent**, not before, and a name you typed stays if you switch to another agent. Alternative: a field on each dossier.
2. **Only the rules are checked as you type. Whether the name is free is checked when the card is made.** A name another agent has or had, or another owner's username, needs the store's database. On the site the store refuses it at "Make" (and the page would say so). This demo's store is empty, so that never happens here. Alternative: the site asks the store as you type (a small game-lane endpoint).
3. **The avatar follows the typed name.** Avatars are drawn from the agent's name, and its matches will draw it from the new name, so the pick screen shows that one. Alternative: keep the generated name's avatar (but then the matches would look different).
4. **The generated name stays visible, struck through**, under the typed one on the dossier, so you can see what you replaced. Alternative: replace it outright.
5. **The page ships the store's own code for the check**, bundled at build time (a new dev-only tool for the render lane, esbuild, which the repo already had as a sub-dependency). This means the page can't drift from the store's rules. Alternative: a hand copy of the rules (smaller, but it can drift).

**Thin spots (in the debt list):** not typed on a real phone (whether the on-screen keyboard hides the field or the button is untried); the "is it free" check is not live (call 2); the refusal reasons are the store's wording, which is a bit technical.

**Next:** your call on these; then the render debt list (the turn-cap ending and the momentum gauge's pending threat).

---

## 2026-10-18 — Pack opening, slice 3: the first-time flow, and the signature card is made in front of you — AWAITING FEEDBACK

Slice 3 of your pack-opening plan. Open `render/output/first-time.html`, press Begin, and go all the way through: pick a faction, open the 3 starter packs, pick an agent, pick its card, and watch the card being made. Every screen plays back what the economy store returned for that choice; nothing on the page rolls anything.

**What this delivers:**
- **The Season 0 sign-up as one flow**, with a rail at the top (Faction · Packs · Agent · Signature):
  1. **Welcome.**
  2. **Pick a starting faction:** four plates, each with one line about the faction and its starter Mythic.
  3. **Your starter deck:** the deck box drops in, its 5 rarest cards fan out of it, and the 3 starter packs slide in beside it. "Account-bound: yours to play, never to sell."
  4. **The 3 starter packs**, through the real pack opening (tear, swipe, reveals, summary, hold to tilt), one after another. After the last one: "You now hold 55 cards: 40 from the starter deck and 15 from your packs."
  5. **Generate your agent:** three generated agents, each with its avatar (the same one its matches show), its name typing itself, its persona. "Connect your own AI agent: after Season 0" sits under them, as your spec says.
  6. **Its signature card:** three cards to pick from, with their name, cost, stats and rules text. Their art window is empty ("ART PIECE · DRAWN WHEN MADE") because the store draws the card's art-pool piece only when the card is made (call 2).
  7. **The mint, the signature card's reveal** (your "leader reveal"):
     - the other two cards fall away;
     - the chosen card turns face down and flies to the middle while the screen goes black;
     - a terminal prints what the store recorded: the agent, the card, the fairness test it passed, its art piece ("pool S0 · piece 292 of 500"), its number;
     - the card's own ward draws itself in behind it and spins up. It's the same ward the card shows in its matches;
     - the card turns face up as the made card: its face burns in from the middle of the art outward and the art develops;
     - a "PR-001 · 1 OF 1" plate slams in, with a shake, a stamp and a burst of light;
     - the plate lifts away into the card's own number, the ward folds into a halo behind it, and the card's new signature light comes on: "SIGNATURE · 1 OF 1. Made for Coiljackal's Croupier alone."
     - About 6.5 s from the tap to the settled card. Then you can hold and tilt it.
  8. **Ready:** the agent, its card (tap it for the viewer) and what you now hold: starter deck + pack cards + 1 signature card.
- **The signature card's own look:** full bleed, a white-gold edge and white-gold lettering, a SIGNATURE mark, "PR-001 · 1 OF 1" in the corner, and a new white-gold light (rays and a turning ring of light around the art), the only finish with rays.
- **Placeholder signature art:** a figure of light standing in rings over a 90s horizon grid, coloured by its art-pool piece. Two cards that drew the same piece share the picture, as the pool means. It's a stand-in for the art pass.
- **Long names now shrink to fit** on every card, instead of ending in "..." (call 7).
- **Phone and desktop.** On a phone the three signature cards stack as rows (card beside its text) so the text is readable.

**Evidence:**
- **Recordings:** `progress/render/evidence/v2-s28-first-time-desktop.webm` and `v2-s28-first-time-phone.webm`, the whole flow by hand, mint included. As before, the headless browser's software GPU makes it run slower than on a real device.
- **Stills** (`v2-s28-*-{desktop,phone}.jpg`): every screen, plus the mint at three moments (the terminal with the ward spinning up, the plate pressing in, the settled card) and the made card mid-tilt.
- **Browser check** (`first-time-check.mjs` / `.txt`): desktop with a mouse, phone with real touch events, phone with reduced motion, each a different faction, agent and card. All pass. It checks:
  - each starter pack's summary is exactly the store's opening, NEW badges included;
  - the terminal prints the store's values;
  - the made card is the one picked, with its number, its art piece and the agent's name in its flavour line;
  - taps, Escape, Enter and a hold during the mint change nothing, and Continue appears only once the card has settled;
  - the beats run in order, and the ward really draws;
  - the made card leans 15° (6° with reduced motion);
  - no name is cut off;
  - the ready screen's totals add up.
- **Transcript:** `v2-s28-first-time-transcript.txt`, everything the store returned for every choice.
- **Tests:** render 402 (+14).

**Decisions you may want to overrule:**
1. **The order:** faction, starter deck, the 3 packs, then the agent and its card, with the card being made as the finale. The packs warm you up; the card that's yours alone ends it. Alternative: the agent and its card first, then the packs.
2. **No art on the pick screen.** The store draws the card's art-pool piece when you confirm it, not before, so the three cards show an empty art window and the art arrives during the mint. That makes the art part of the reveal. ECONOMY.md's earlier wording says each candidate has its art, though. Alternative: the store draws a piece for each of the 3 candidates when it offers them (a game-lane change), and the pick screen shows them.
3. **The mint takes about 6.5 s and can't be skipped.** You make a signature card once per agent. Proposed beats: gather 0.8 s, terminal about 2.9 s with the ward spinning up under it, forge 1.3 s, plate 0.5 s, settle 0.9 s, then 1.1 s before Continue. Alternative: skippable from a second agent on.
4. **The terminal prints the technical record:** the fairness line's id ("sig5-3x5-inspire.a0") and "passed at 10,000 games". It reads as the machine making the card, and it is honest. Alternative: plain words only ("fairness: passed").
5. **No name field when the agent is created.** The store lets you type a name for free at creation. The page says "You can type it a new name later; the first rename is free", which is also true, but it doesn't offer the field. Alternative: a name field on the agent screen (website work, using the store's own name rules).
6. **No going back from the card pick to the agents.** The store allows one pick per draft; seeing other agents means a new draft. Alternative: a "New draft" button.
7. **Long names shrink to fit on every card** (down to 66% of the size), not only signature cards, instead of being cut off with "...". It changes how long set-card names look on the pack page too.
8. **The signature card prints its ability's full wording** ("At the start of your turn, a random ally gets +0/+1 permanently."), taken from the card generator, because the engine's own ability text leaves out when it happens ("A random unit of yours gets +0/+1."). Asked of the game lane (notes-for-owner).
9. **The starter packs aren't special:** the demo's 3 packs hold two Foils and no hit, and that is typical. Measured over 2,000 fresh sign-ups, **55% of new owners see no hit in their 3 starter packs**, and 15% see only Standard cards. You said the first packs should be the most polished moment; the reveal can't make a pack better than it is. Alternative (a game-lane change): guarantee one hit across the 3 starter packs.
10. **With reduced motion** the mint is over in about a second (the pack page's rule: every beat cut to a flash), with no spin, flight or shake.

**Thin spots (in the debt list):**
- Not yet tried by a person on a real phone, and not heard.
- The placeholder art is a stand-in until the art pass.
- The page plays a fixed set of choices (4 factions, 9 agent-and-card branches); the site will call the store live.

**Next:** your call on these; then back to the render debt list (the turn-cap ending and the momentum gauge's pending threat, which waited behind the pack-opening work).

---

## 2026-10-18 — Hold to tilt: the card and the pack lean as one piece — AWAITING FEEDBACK

Your 2026-10-18 feature, with its addendum (the booster pack), the fan answer and the correction (no art depth), built just before slice 3. Open `render/output/pack-opening.html`. Hold a sealed pack below its TEAR strip and drag. Then tear it, hold a revealed card and drag. Then open the viewer from a summary tile, and try the "×10" fan.

**What this delivers:**
- **Hold, then drag:** the card leans in 3D towards your finger or pointer, up to **15°** each way, reached at the card's edge. It moves as one solid piece: no art shift, no layers. The finish's shine (Foil holo, Gold sheen, Glitch, secret, Zero-Day) follows your finger the same way it follows the device's tilt.
- **Let go:** it springs back flat, with a small overshoot (0.56 s).
- **Where:** the revealed card in a single pack and in a big pull, the card viewer, the sealed pack, and in a ten-pack only the front pack of the fan. A face-down card, or one still flipping, doesn't lean.
- **The sealed pack:** a drag that starts on the TEAR strip tears it, as before, and never leans. A hold or drag anywhere else tilts it. A quick tap anywhere still tears it. The strip is now marked: a lit band and a "TEAR" tab where the cut line starts.
- **The tell stays honest:** the tilt never looks at what is in the pack. A pack with a Zero-Day leans exactly like one with nothing, step for step (checked). Sparks still come only from the tear.
- **Touch and mouse, phone and desktop.** On a phone the long-press menu is suppressed while you hold.
- **Reduced motion:** at most 6°, and a plain 0.15 s ease back with no spring.

**Evidence:**
- **Recordings** (`progress/render/evidence/v2-s27-tilt-desktop.webm`, `v2-s27-tilt-phone.webm`): the Gold pack tilted in a circle, torn along the strip, the Gold card tilted, the Zero-Day card in the viewer. A white dot shows the finger. The scripted drag runs slower than a hand, because the headless browser renders on a software GPU.
- **Stills:** `v2-s27-tilt-foil-*.jpg` (the Foil card mid-tilt, the holo following the finger), `v2-s27-tilt-viewer-*.jpg`, `v2-s27-tilt-fan-*.jpg`, each at desktop, phone and phone with reduced motion.
- **Browser check** (`pack-tilt-check.mjs` / `.txt`): desktop with a mouse, phone with real touch events, and phone with reduced motion. All pass:
  - the leans hit the predicted angles;
  - nothing tears or moves on when a tilt is let go;
  - a tap and a swipe still work;
  - the light follows the finger;
  - the viewer stays open when you let go over its backdrop;
  - three packs lean identically.
- **Re-runs:** slice 1's and session 26's checks, re-run on the new page.
- **Tests:** render 388 (+13).

**Decisions you may want to overrule:**
1. **The threshold:** a press held still for **0.2 s**, or moved **8 px**, starts the tilt. On the card stack a quick sideways move is still the swipe to the next card, so there only the 0.2 s hold starts it. Alternative: a longer hold (0.3 s) if quick taps end up tilting.
2. **The lean direction:** the side under your finger dips away from you, as if you pressed it. Alternative: the side under your finger comes towards you.
3. **15° at the card's edge,** proportional in between. A finger past the edge stays at 15°.
4. **The spring:** 0.56 s with a small overshoot.
5. **A mouse hovering no longer leans the card.** Before, hovering leaned it a little. Now only a hold does, as your spec says. Hovering still moves the shine. The device's tilt on a phone still leans the card as before. Alternative: keep the small hover lean on desktop.
6. **Tear versus tilt on the pack:** told apart by where the press starts. The top strip, about a third of the pack, tears; anywhere else tilts. Marked with the lit band and the TEAR tab.
7. **In a ten-pack, only the fan's front pack tilts,** since each later pack tears on the same tap that brings it up. There is no sealed moment to hold it.
8. **Letting go of a tilt over the viewer's backdrop doesn't close the viewer.** Only a tap there does.

**Thin spots (in the debt list):**
- Not yet held by a person on a real phone.
- The tilt doesn't change how the card's own face is lit, beyond the shader's light point.
- The ten-pack row's cards don't tilt.

**Next:** slice 3, the first-time flow: an agent's first packs and the signature card reveal, with hold to tilt already in place for the signature card.

---

## 2026-10-18 — Pack opening feel notes: full-size art for the top finishes, a tap-driven ten-pack, modal card faces — AWAITING FEEDBACK

Your 2026-10-18 feel notes, plus the render side task from your answers to game session 42. Open `render/output/pack-opening.html` (any "×10" pack, the Gold / Prototype / Zero-Day packs, then tap a summary tile) and `render/output/card-faces.html` (every finish side by side, and all 3 Zero-Day cards).

**What this delivers:**
- **Full-size art above Full Art.** Every finish rarer than Full Art shows its art across the whole card, everywhere a card is drawn (the reveal, the ten-pack row, the summary, the new viewer):
  - **Gold:** full-bleed art in gold tones, a gold edge, gold lettering, gold-on-brown text panels.
  - **Prototype:** full-bleed art with the serial plate (`1/250`, `PROTOTYPE · S0`) on top.
  - **Secret illustrations, Zero-Day:** full bleed.
  - **Glitch and Alt Art too** (call 1 below).
  - In the reveal the card still turns over plain and grows to full bleed as it lands.
- **The ten-pack is tap-driven.** Nothing plays on its own:
  - Tapping the fan tears pack 1. Each later tap or swipe tears the next pack.
  - Its cards deal into the row. Tap a face-down card to turn it, or tap anywhere on the row to turn the next one. Once all are turned, a tap or swipe moves on.
  - **A big pull is torn the same way, and its full reveal plays right there:** no sealed pack to tear again, no pause, no "BIG PULL" tag (removed).
  - **"Skip to summary"** still never skips a big pull.
  - **Auto** (a switch, off by default) plays the old automatic sequence. The 1× / 2× / 4× speeds appear when it is on. Switching it off mid-open stops straight away; switching it on carries on from where you are.
- **Modal card faces.** A "choose one" card's face prints CHOOSE ONE and each mode's name and rules text (Patient Zero: **Outbreak** When this dies, deal 2 damage to all enemy units. / **Carrier** Your other units get +1/+0.). All 3 Zero-Day cards fit, flavor included.
- **A card viewer.** Tap any summary tile to see that card full size with its own shader: the place to read a card, its modes included, after the reveal.
- **Fix found on the way:** long cards' flavor lines were cut off, or ran under the attack/health boxes (it predates this session). Their text now steps down in size until it fits.

**Evidence:**
- **Pages:** `render/output/pack-opening.html` (`npm run pack-opening -w @ai-tcg/render`), `render/output/card-faces.html` (`npm run card-faces -w @ai-tcg/render`).
- **Browser check** (`progress/render/evidence/pack-tap-check.mjs` / `.txt`), at 1280 × 800 and 390 × 844, all pass. It checks:
  - Auto is off by default.
  - By hand, nothing moved in 1.2 s left alone after any deal or any fully turned row. Every tear and turn came from a tap or swipe.
  - The big pull tore like the others, with its reveal straight after.
  - Auto at 2× with Skip stopped at the big pull and played it at full length. Auto at 4× ran hands off in about 5 s.
  - Switching Auto off mid-open stopped it. Auto and the speed are remembered after a reload.
  - The Zero-Day tile opens the viewer with both modes readable.
  - All 12 faces on the sheet fit, and are full bleed on exactly the 10 rarer finishes.
  - Slice 1's check re-run on the new page: all 10 packs pass (`pack-opening-check-s26.txt`).
- **Stills, phone and desktop** (`progress/render/evidence/v2-s26-*.jpg`):
  - the ten-pack fan, the row waiting with a face-down card, the row after a hit turns, Auto switched on, the big pull revealed in the flow, the summary;
  - the viewer (secret, Zero-Day);
  - the Gold, Prototype, Glitch, secret and Zero-Day reveals and summaries;
  - the face sheet.
- **Tests:** render 375 (+13).

**Decisions you may want to overrule:**
1. **Glitch and Alt Art are full bleed too.** Your rule names Gold, Prototype, secret and Zero-Day, but by the live odds Glitch (4% of shine slots) and Alt Art (3%) are rarer than Full Art (9%), and "a rarer card must never look smaller than a Full Art". Alt Art already was. Glitch was the card's own frame, corrupted. Alternative: keep Glitch framed.
2. **The fan tap tears pack 1 straight away.** It does not wait for a second tap. Alternative: the fan opens into pack 1 sealed, which then waits for a tap.
3. **Every face-down card is turned before a tap moves on.** A tap never skips a turn. A tap on the row turns the cards left to right. Alternative: a swipe moves on and turns the rest at once.
4. **Proposed tap timings** (`BULK_TAP_TIMINGS`): the tapped pack shows sealed for 0.14 s; taps wait for the deal to land (about 0.5 s); after a hit turns, a tap waits 0.6 s before moving on, so a double tap can't cut its pop. Turning another card is never held up.
5. **Auto is remembered per viewer**, like the speed. It still starts off for anyone who hasn't switched it on. The speed buttons show only while Auto is on.
6. **In Auto, a big pull plays itself:** it tears, then steps through its reveal at full length with a 0.7 s beat between steps. A tap still moves on as soon as each reveal has had its moment.
7. **The card viewer is new:** tap a summary tile to see the card full size. Alternative: no viewer (the modes are then only readable during the reveal).
8. **Long rules text shrinks** (down to 68%) rather than being cut off. This only changes cards that didn't fit before.
9. **Modal face layout:** CHOOSE ONE, then each mode with its name in bold and an accent bar. On a full-bleed face, the rules box starts higher to make room.

**Thin spots (in the debt list):** headless Chromium with a software GPU only; no real phone, tilt or ears; the tap flow's feel (call 4) is untested by a person; the shrink keeps the layout and only resizes text.

**Next:** slice 3, the first-time flow: an agent's first packs and the signature card reveal.

---

## 2026-10-18 — Pack opening, slice 2: ten packs at once, and the summary grid — AWAITING FEEDBACK

Your 2026-10-18 priority, slice 2 of 3. Open `render/output/pack-opening.html` and pick a "×10" pack (or the "Ten at once" row on the shelf). Both tens are real opens from the economy store: `openPacks(owner, 10)`, each pack its own seeded opening. The page only plays back what was rolled.

**What this delivers:**
- **Ten packs, one tap:** a fan of ten sealed packs; a tap opens them all.
- **A fast sequence:** each pack tears by itself, throwing sparks only when it holds a hit, as in a single pack. Its cards deal into a row: plain cards face up, the rest face down and turned one after another. A hit pops, glows, and shows its finish name under it. NEW badges appear as cards land. A pack with a hit holds a little longer before the next.
- **Pips:** a row of ten shows which pack is up. A pip turns pink for a hit or gold for a big pull, but only after that pack has opened, so nothing is given away early.
- **Speed: 1×, 2×, 4×,** remembered per viewer. A tap on the row moves straight on to the next pack.
- **Big pulls keep their full reveal.** A pack the store marks as a full reveal (Gold, Prototype, secret, Zero-Day, Jackpot) stops the sequence. It comes up as its own sealed pack under a "BIG PULL" tag, you tear it by hand, and every reveal plays at full length at any speed. Then the sequence carries on.
- **Skip** runs ahead to the next big pull, which still gets its full reveal. With none left, it goes to the summary. Inside a big pull, "Skip this pack" is the way out.
- **The summary grid:** "TEN PACKS OPENED", with cards, new cards, hits and big pulls, then chips by finish and by rarity. "Best pulls" (the hits) come first, larger. Then everything else, best first, with copies of the same card in the same finish folded into one tile ("×2", "packs 3, 8"). Pack points, then "Open 10 more", "Open one pack" or "Done".

**Two bugs this found in slice 1 (fixed):**
- **The placeholder art shared one gradient across the page,** so every card on screen painted the first card's background colour. That includes a single pack's five cards and its summary. Each card now has its own. Slice 1's stills show the old look.
- **"Skip to summary" during a reveal could leave the secret number or a colour wash on screen.** That's fixed for both slices.

**Evidence:**
- **The page:** `render/output/pack-opening.html` (`npm run pack-opening -w @ai-tcg/render`). The two tens it opens: `progress/render/evidence/v2-s25-ten-pack-showcase.txt`.
- **Browser check** (`pack-bulk-check.mjs` / `.txt`), at 1280 × 800 and 390 × 844, three runs each, all pass:
  - **A:** the everyday ten at 4×, hands off: about 5 s to the summary.
  - **B:** the big-pull ten at 1×: about 27 s, including tearing and tapping through the big pull.
  - **C:** 2× with Skip pressed straight away: it stopped at the big pull, then reached the summary.
  - Every run checks: packs in order; only the store's big pulls left the fast sequence, and every one of them did; sparks iff a hit; each row equals its pack; every face-down card turned; the summary holds all 50 cards with the store's new count and pack points; nothing left over on screen; speed remembered after a reload; no sideways scroll; no page errors.
- **Stills** (`progress/render/evidence/v2-s25-*.jpg`): the shelf, the fan, a fast row with a hit, the big pull sealed and revealed, and the summary top and bottom, at desktop and phone width.
- **Tests:** render 362 (+13), checked over 400 real packs.

**Decisions you may want to overrule:**
1. **A big pull waits for you to tear it, under a "BIG PULL" tag.** The pause gives it away before the sparks do; it is always honest, never a fake-out. Alternative: tear it automatically like the others, so the sparks are the first tell, then slow down for the reveal.
2. **Skip never skips a big pull.** It runs ahead to the next one. Alternative: Skip goes straight to the summary, and the big pulls are only seen there.
3. **Big pulls play at full length whatever the speed.** Alternative: at 4×, shorten their holds too.
4. **The summary folds duplicates** (same card, same finish) into one tile with ×N and the pack numbers, best first. Alternative: one tile per card, in pack order (50 tiles).
5. **NEW is one badge per collection entry,** as the binder counts. The header shows the store's own count, which is by card. The two differ only when a new card comes out both plain and as a Glitch or secret copy in one open.
6. **Timings** (proposed, in `packOpening.ts` `BULK_TIMINGS`): sealed 0.26 s, tear 0.38 s, 0.07 s between dealt cards, 0.23 s per face-down turn, hold 0.52 s (1.1 s with a hit). An everyday pack takes about 1.7 s at 1×; ten take about 17 s at 1× and about 4-5 s at 4×. The default speed is 1×.
7. **The fast row uses the CSS finish looks** (the summary's), not a shader per card. That keeps ten packs light on a phone; the big pull keeps its shaders.
8. **The showcase tens are each a fresh owner's first ten packs,** so most cards show NEW (38 and 39 of 50).

**Thin spots (in the debt list):** checked only in headless Chromium with a software GPU; no real phone, tilt or ears; the fast sequence has not been timed on a slow phone; only two showcase tens.

**Next:** slice 3, the first-time flow: an agent's first packs and the leader (signature card) reveal.

---

## 2026-10-17 — Pack opening, slice 1: one pack and every finish reveal — AWAITING FEEDBACK

Your 2026-10-18 priority, slice 1 of 3. Open `render/output/pack-opening.html` in a browser (phone or desktop). Every pack on it is a real opening from the economy store (`openPack`, seeded, S0-odds-2); the page only plays back what was rolled.

**What this delivers:**
- **The pack:** a code-drawn Season Zero pack (crimped foil, logo, set emblem) that bobs, leans toward the pointer and has an idle shimmer (a shader). Drag across the top to tear it: a glowing cut line follows your finger, the strip flies off, the pack drops away. A tap tears it too (and Enter or Space).
- **The honest tell:** the tear throws sparks exactly when the pack holds a hit (Full Art or better, as pity counts). A Foil pack gets none. Checked over 400 real openings and in the browser on every pack.
- **The stack:** the cards rise out as a stack. Plain cards are face up and fly off with a tap or a swipe (220 ms). Every other finish arrives face down and glowing; the first tap reveals it, and a second tap during the reveal is ignored, so a hit can't be skipped by accident. The shine slot is always 5th; a Prototype comes 6th, under a "BONUS 6TH CARD" tag. A counter and a "Skip to summary" button are always there.
- **A reveal for each finish:**
  - **Foil:** a holo shader (rainbow bands, glints, glare) that follows the pointer or the phone's tilt.
  - **Full Art:** after the flip, the art window grows to fill the card and the text sits on it.
  - **Alt Art:** the same growth, on its own composition (motif large and off centre, palette turned).
  - **Glitch:** the card turns in jerky steps while red and cyan copies of it split apart and block tears jump (12 a second), scanlines over it; it settles corrupted (palette rotated, magenta frame, split name) with a short glitch burst every 2-3 s.
  - **Secret illustration:** the screen dims, the card turns over slowly (1.9 s) and lifts; it lands as a painted scene, and its number ("217/096") appears large above it under "SECRET ILLUSTRATION".
  - **Gold:** the frame turns gold, a metal-sheen shader with twinkling stars runs over it, and gold sparks burst.
  - **Prototype:** a gold wash, then the serial plate ("1/250") stamps in with a thud and a shake; "PROTOTYPE · S0" in gold foil.
  - **Zero-Day:** the screen drops to black, a terminal types "ZERO-DAY DETECTED", the breach plays (code rain, a red ring pulsing out, four status lines, an alarm), then the card slams in and stays animated, with a red and green glow reaching past its frame. It shows the reserved entry until the 3 cards go live.
  - **Jackpot:** a gold "JACKPOT PACK" banner before the cards rise.
- **The summary:** the cards with finish labels, NEW badges, "x2 owned", Prototype serials, pity notes, and the pack points; then "Open another" (the next showcase pack) or "Done" (the shelf of packs).
- **Sound:** from the game's own sound system (the same player and the same remembered Sound setting): a tear, flip ticks voiced by faction, a rising tone on hits (short for Foil and Full Art, a long climb for Gold, secret, Prototype and Zero-Day), sparkle pings, terminal keys, the breach alarm, the glitch crunch and the plate stamp.
- **No WebGL?** Each shader has a CSS gradient stand-in, so the page still works.
- **Side task:** the match feed names a modal card's mode ("p1 plays Patient Zero (Outbreak)", "casts Kill Switch, choosing Wipe", "Kill Switch (Wipe) resolves").

**Evidence:**
- **The page:** `render/output/pack-opening.html` (`npm run pack-opening -w @ai-tcg/render`). The 10 packs it opens: `progress/render/evidence/v2-s24-pack-showcase.txt`.
- **Browser check** (`pack-opening-check.mjs` / `.txt`): every pack at 1280 x 800 and 390 x 844, torn by drag or tap, stepped through by taps. All pass: sparks iff a hit; the order; each face-down card got its own reveal; early taps ignored; the Zero-Day text typed; the summary equals the pack; every shader compiled and lit pixels; nothing off screen or scrolling sideways; no page errors.
- **Stills** (`progress/render/evidence/v2-s24-*.jpg`): the sealed pack, the sparks, every finish, the Zero-Day terminal, breach and card, and summaries, on desktop and phone.
- **Tests:** render 349 (+22).

**Decisions you may want to overrule:**
1. **Foil arrives face down too** (every finish but Standard). It isn't a hit, so it throws no sparks, but it gets a flip. The other way: Foil face up, shining as it comes off the stack.
2. **A Prototype comes 6th, after the shine slot.** You said the shine slot is always last; I read that as last of the five, with the bonus 6th card as its own moment after it.
3. **Alt Art (your list doesn't name it) gets the Full Art growth on its own composition,** with a pink wash instead of a blue one.
4. **A second tap during a reveal is ignored** until the reveal's hold ends (0.5 s for Foil, about 1.1-1.4 s for the big ones). It protects the moment, but it can feel slow on a fast thumb. Skip to summary is always there.
5. **Timings** (proposed, all in `packOpening.ts`): tap-tear 0.42 s; strip 0.65 s; Jackpot banner 1.5 s; cards rise 0.7 s; a plain card leaves in 0.22 s; flips 0.42 s Foil, 0.48 s Full/Alt Art, 0.95 s Glitch, 1.9 s secret, 0.65 s Gold, 0.9 s Prototype; Zero-Day: 0.45 s black, 55 ms a letter, 1.9 s breach, 0.7 s arrival.
6. **The showcase's packs are chosen by seed search** (the first seed that gives each finish, as the economy's chase demo does). The store opens and records them; nothing is faked. The Jackpot pack is one with a hit in it, so it shows sparks; most Jackpot packs are all Foil.

**Thin spots (named in the debt list):** checked only in headless Chromium with a software GPU; tilt, real phones and sound by ear are untested; the card swipe was checked with taps, not drags; the card art is the placeholder.

**Next:** slice 2, the ten-pack opening and its summary grid.

---

## 2026-10-17 — The board agrees with the feed; labels shrink with a zoomed row — AWAITING FEEDBACK

A small follow-up to the feed check-ins below. Three loose ends, each named in the render debt list.

**What this delivers:**
- **A trigger the feed drops gets no flourish on the board either.** Before, an unhurt Diagnostic Loop's end-of-turn heal still threw its ring and a "TURN END" tag while the feed said nothing. Now the feed records which triggers it dropped (`Frame.quietTriggers`), and the board skips the same ones. Over the 14 replays that is 50 flourishes gone, the same 50 lines the feed dropped in session 22.
- **The Intercept Routine fizzle is worded from the engine's new cause** (game session 39). "Intercept Routine resolves", then "fizzles: Intercept Routine: Garbage Collector's attack is already aimed at Barrier Drone", is now one line: "Intercept Routine fizzles: Garbage Collector's attack was already aimed at Barrier Drone", with the rules text under it. With no attack waiting, it reads "Intercept Routine fizzles: no attack was waiting to redirect".
- **Floating labels over a card shrink with a zoomed row.** At 545-600 px the cards are drawn at about 72-91% size; damage numbers, BLOCKED, FIZZLED, stat labels and the cast tag ("ON PLAY") now use the card's own scale, and float a proportionally shorter distance. Labels over a player (an impact point, the health bar) and a Command's tag on the stack stay full size.

**Evidence:**
- **Feed summary:** `progress/render/evidence/v2-s23-feed-summary.txt`. Only the Null vs Aegis seed 3 fizzle changed; every other line over the 14 replays is identical to session 22.
- **Stills:** `v2-s23-redirect-fizzle-1280.png` (the fizzle line, Null vs Aegis seed 3, move 33) and `v2-s23-zoomed-labels-580.png` (a hit at 580 px, its number at the row's 0.737 scale).
- **Browser check** (`board-feed-check.mjs` / `.txt`): stepping every move with the arrow key, the board's cast tags per move equal the feed's count (casts plus kept triggers); at 580 px every label over a card carries the card's zoom; at 1280 px none is scaled.
- **Tests:** render 327 (+5). The real-match cast test (48 matches, checked against the engine's own resolver) now checks that quiet triggers get no flourish, and that without the list they come back placed on the right card. It fails if the skip is removed.

**Decisions you may want to overrule:**
1. **A quiet trigger gets nothing on the board, not a dimmer "tried, nothing happened" mark.** That matches your session-22 call for the feed (drop it, no "(no effect)" line). The alternative is a faint ring with no tag.
2. **A redirect fizzle takes the place of its "resolves" line,** the way an attack's fizzle takes the place of "lands". The rules text stays under it.
3. **Labels shrink all the way with the card** (to about 72% at the narrowest one-line width) rather than stopping at a floor. The two-line phone layout is usually at full size, so it is unaffected.

**Next:** the turn-cap ending is still only seen in tests, and the momentum gauge doesn't explain a pending threat. Also open: drawing the chase finishes (Glitch, secret illustrations, the animated Zero-Day) in a pack reveal, which needs a pack-opening surface the render doesn't have yet.

---

## 2026-10-18 — The match feed, tightened: quiet triggers dropped, endings worded from the engine's data — AWAITING FEEDBACK

A small follow-up to the match feed check-in below. You accepted that one with all 5 calls and left "drop trigger lines that change nothing" as the next step. This session did that, and used the game lane's new structured data (game session 38).

**What this delivers:**
- **Triggers that changed nothing are gone from the feed.** Examples: an end-of-turn heal on an unhurt unit, energy recovery at the cap, or an entry ability whose condition didn't hold. Over the 14 replays that is 50 lines. They stay in the engine log.
- **The game's end reads as a sentence,** built from the engine's `cause`:
  - "Cyberburner's Antihero wins: Rombot's Navigator's health reached 0";
  - "Draw: both players' health reached 0 at once";
  - at the turn cap, "X wins at the turn cap, 14 health to 9".
- **An attack that fizzles says why,** in place of "lands" / "deals no damage": "Overload Capacitor's attack fizzles: its target left play first".
- **Rules text is looked up by ability id alone.** Ids are unique now, so a renamed agent's signature card keeps its text. If two cards ever share an id with different texts, capture stops with an error instead of showing the wrong text.

**Evidence:**
- **Summary over all 14 replays:** `progress/render/evidence/v2-s22-feed-summary.txt`, from `npm run feed-transcript -w @ai-tcg/render`. It lists each replay's quiet triggers by card and its end line. It also shows the fizzles from 3 real matches (none of the 14 replays has one).
- **Two full feeds:** `v2-s22-feed-cortex-vs-aegis-sig-seed5.txt` and `v2-s22-feed-aegis-vs-cortex-seed1.txt`. Compare them with the session-21 versions.
- **Stills:** `v2-s22-feed-quiet-1280.png` (turns 1-4 of the seed-5 replay; turn 3 now goes straight to turn 4) and `v2-s22-feed-end-1280.png` (the end line).
- **Checked against the engine:** a test wraps the engine's own ability resolver and snapshots the whole game state around every trigger in 32 real matches. Every trigger the feed drops left the state exactly as it was.
- **Browser check** (`feed-check.txt`): 14 replays at 1280 and 390 px, all pass.
- **Length:** over the 14 replays, 3,321 engine lines become 1,497 feed entries (45%; it was 47%).

**Decisions you may want to overrule:**
1. **A trigger whose condition didn't hold is dropped too.** For example, Deadlock Detector entering when the enemy has fewer than 3 units, or Uplink Tower at the start of a turn with a full hand. The alternative is a quiet "(no effect)" line. Dropping it matches "drop lines that change nothing".
2. **The fizzle wording:** "its target left play first" / "the attacker left play first".
3. **The turn-cap ending shows both health totals.** No replay reaches the cap yet, so this is only seen in tests.

---

## 2026-10-17 — The match feed replaces the raw event log — AWAITING FEEDBACK

A small check-in on how the log pane reads. Commentary (stage 7) is still the real translation layer; this is the written record a spectator can scroll back through until then, and after.

**What this delivers:**
- **The log pane is now a match feed.** It used to print the engine's own text: a third of it was "p1 passes priority", players were p1 / p2, and triggers showed internal ids like "diagnostic-loop-turnend (onTurnEnd)".
- **Each turn opens with a header** in the player's faction colour, with their avatar, their agent name and the card they drew.
- **An attack is one entry**, with its damage under it. It only takes a second line ("X's attack lands") when something happened in between, which is a response.
- **Responses are tagged.** A card cast into a waiting stack, or on the other player's turn, shows a RESPONSE tag. This is the reactive play the priority system exists for, and the old log buried it among the passes.
- **Triggers read in plain words,** for example "Diagnostic Loop · end of turn", with the card's own rules text underneath.
- **Agent names everywhere:** the feed, the turn bar, the stack, the momentum gauge and the hand labels. "P1" no longer appears on the page.
- **The raw engine log is one switch away** ("engine log", top right of the pane). The page remembers the choice per viewer.

**Evidence:**
- **Two full feeds as plain text:** `progress/render/evidence/v2-s21-feed-sig-seed5.txt` (the signature replay) and `v2-s21-feed-aegis-cortex-seed1.txt` (two responses, at moves 9 and 88).
- **Stills:** `v2-s21-page-1280.png`, `v2-s21-feed-1280.png` and `v2-s21-feed-390.png` (a Hotfix response to an attack), and `v2-s21-raw-1280.png` (the same move with the engine log on).
- **Length:** over the 14 replays, 3,321 engine lines become 1,547 feed entries (47%).
- **Measured in headless Chromium** (`feed-check.txt`): all 14 replays at 1280 and 390 px. All 28 runs passed: the feed matches the replay's entries move by move, no seat names or passes appear, the switch works both ways, no sideways scroll and no page errors.
- **Tests:** 11 new (`render/test/feed.test.ts`); render at 314. Over seven real matches they check that nothing is lost: every play, cast, attack, damage, death, draw and trigger has its entry.

**Strong:**
- Nothing is lost, only folded, and the tests hold it to the engine's events.
- Responses stand out. Before, finding one meant reading past dozens of passes.

**Thin:**
- **Triggers that change nothing still get a line,** such as an end-of-turn heal on an unhurt unit (5 times in the seed-5 game).
- **It says what happened, not why it mattered.** That's commentary's job.
- **Engine reason text is used as is:** "Rombot's Navigator health depleted" lacks its "'s".

**Decisions you may want to overrule:**
1. **Priority passes are hidden completely.** The alternative is a quiet "no response" mark after an attack or spell that nobody answered.
2. **The turn's draw is named in the turn header.** The hands are already face-up for spectators, so this hides nothing. The alternative is "draws a card".
3. **An attack and its damage are one entry,** unless a response came between them.
4. **Triggers and spells show their rules text** in small type under the line. The alternative is the name only, which is shorter but harder to follow.
5. **The engine log stays available** behind a switch, rather than being removed.

**Next:** the next item on the render debt list. Dropping the trigger lines that change nothing is the cheapest legibility win.

---

## 2026-10-16 — Six slots in one line from 600 px up; two framed lines of three on a phone — AWAITING FEEDBACK

A small layout check-in, from the top of the render debt list. Nothing here changes how a match reads on a desktop.

**What this delivers:**
- **The board row now scales to fit instead of wrapping.** Before, the six slots wrapped 5 + 1 on a tablet (768 px) and 2 + 2 + 2 on a phone, and the two sides' rows ran into each other in the middle.
- **From about 545 px up,** all six slots stay on one line. The row is zoomed down to fit: cards are 117 px wide at 768 px, 91 px at 600 px, and never smaller than 85 px.
- **On a phone,** each side's row splits into two lines of three, in a faint frame in that player's faction colour, so the six read as one side's board. Cards are full size from about 410 px, 112 px at 390 px and 103 px at 360 px.
- **Every effect follows the scaled cards**: hits, wards, aim lines, the signature card's flight. A dying card's ghost now scales with its row. Before, it was squeezed into the smaller box.

**Evidence:**
- **Measured in headless Chromium:** `progress/render/evidence/board-fit-check.txt` covers all 14 replays at 11 widths from 360 to 1280 px, every 4th move. All 154 runs had the right number of lines, no sideways scroll, no overlap between the two sides, no card outside its row and no page errors.
- **Ghost check (same file):** at 600, 390 and 1280 px the ghost sits exactly on the dead card (0.0 px off) and keeps its proportions.
- **Stills:** `v2-s20-board-fit-390.png`, `-600.png` and `-768.png` (move 90 of the seed-5 signature replay), and `v2-s20-ghost-zoomed-600.png` (move 32, a death on a zoomed row).
- **Tests:** 8 new (`render/test/boardFit.test.ts`), render at 303.

**Strong:**
- A row is always one side's line again, at every width measured.
- It's one rule in one place (`render/src/boardFit.ts`). The page runs it on load and on every resize.

**Thin:**
- **At 545-600 px the cards are small** (85-91 px). The name strip is then about 7.5 px text. It reads, but only just.
- **Floating numbers and trigger labels** ("ON PLAY", "+3 HP") are not scaled, so on a zoomed row they look a little larger next to the card.
- **The scaling uses CSS `zoom`.** Current Chrome, Safari and Firefox (since 2024) support it. An older Firefox would show full-size cards that wrap, as before.

**Decisions you may want to overrule:**
1. **The switch to two lines comes at 85 px cards** (72% of full size). A lower floor keeps one line on smaller screens, with smaller text.
2. **Phones get 3 + 3, framed,** not one line of tiny cards or a sideways-scrolling row.
3. **The frame takes the player's faction colour** at low strength. It shows only in the two-line layout.
4. **Cards never scale up** on screens wider than the 1180 px page.

**Next:** the next item on the render debt list. The event log is the most visible one: it shows raw engine text (priority passes, p1 / p2). It could filter passes and use the agents' names until commentary arrives.

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
