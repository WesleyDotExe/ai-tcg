# Render lane — quality debt

The render lane's own self-audit (RENDER.md guardrail 4: the shared
`progress/quality-debt.md` belongs to the game lane). Started in render
session 19, a hardening pass. It lists where the spectator render falls
short of DESIGN.md's arena bar and principle 2 (a human must enjoy
watching) right now. Most important first. Each session updates it; fixed
items are removed, with the fix in `log.md`.

## Victory boasts (slices 1-3, sessions 31-34)

- **Nobody has watched or heard a boast.** All six were judged from stills, recordings and timed
  checks: their 3 s length, whether each feels like a celebration (not a second lethal hit), Null's
  silent beat, and the stings (checked only as data: they rise; their length). The Season 0 sounds
  (the tube, the POST beep, the modem, the rockets) are checked only as recipes: the modem is a
  0.9 s caricature of a handshake (four dial tones, the answer tone, a screech), not a recording.
- **Dial-Up Fireworks' spelled name is busy on a crowded board:** over bright cards and a Mythic
  ward the dot letters compete with the ward's rings and the lock's flare (session 33 raised its veil
  from 0.7 to 0.8 after seeing it). A long name on a phone spells at 3-4 px dots: the plate under it
  stays the legible name, so the name shows twice.
- **Boot Sequence's type is the system monospace** (ui-monospace, Menlo, Consolas, DejaVu Sans
  Mono): it looks different per OS, and a wider font is squeezed to fit the planned width. The text's
  phosphor bleed draws 1 px either side of the box the checker measured (inside its 2 px tolerance).
- **The checker's piece box is the sprite, not its halo:** an atlas piece's soft glow
  (`drawGlow`, radius up to 1.25 x its size) reaches past the box `boastPlanProblem` checks. It has
  never shown up as loser-side light in a browser check, but the code doesn't prove it. (Session 33
  closed the same gap for a flare's bloom and for tilted flat shocks.)
- **The crests are small:** about 100-120 px across on desktop (Shield Slam's hex flower, Hive Burst's
  spore column, Data Cascade's block stack, Null's bloomed star). Readable, not grand; the crest size is
  capped by the side's height (0.19 of it).
- **Data Cascade's columns are faint in their first half second** even with the early wash: thin
  pixels over cyan cards. The later beats read well.
- **The recorded replays come from an in-memory store, not the platform's database** (slice 3,
  session 34): `recordedMatch.ts` plays each match through the real store API (starter collections,
  season boasts earned in 35-37 real recorded matches and bought, loadouts, startMatch, capture,
  recordMatch), but there is no server yet, so nothing reads a record from a live database or over
  the network. The 16 older sample replays have no record and still play the faction starter.
- **A close win is told by one plate line:** "· CLOSE WIN" in place of "· VICTORY". The boast itself
  plays exactly as it does as a main boast; nothing says the winner was on 3 health beyond the HP bar.
- **The final frame's momentum gauge can name the loser "AHEAD":** in `recorded-close-win.html` the
  gauge reads "Quiet Lattice AHEAD ... ahead on board" while Moth Protocol's boast plays (the winner
  ended on 3 health with a smaller board). Older than this slice, but the boast puts it on screen for 3 s.
- **The lethal move's smoke lingers on the loser's side** in the close-win replay's stills (Swarm's
  green plume over the loser's row at 2.5 s). The check's canvas sample doesn't count it, so it is drawn
  somewhere the check doesn't look (a DOM layer, or below the top canvas). Not traced yet.
- **The cosmetics switch hides boasts only** (nothing else cosmetic is drawn), and only the spectator
  rule is wired into a page; the owner-page rule is a tested function with no page yet.
- **The match feed spoils the result:** its last line ("X wins") prints while the boast plays; only the
  turn bar waits (you kept this call).
- **The lethal hit's ground mark sits on the loser's side during the boast** (correct for the hit, and
  it is the attack's mark, not the boast's), and its sparks are still flying on the loser's side for the
  first ~1 s of the boast. The check only asserts "nothing on the loser's side" from 1.25 s on.
- **The browser check's "lit" count includes the veil** (a dark fill is still non-transparent canvas),
  so its winner-side numbers measure the veil plus the pieces, not the pieces alone. With the early
  wash in Hive Burst and Data Cascade that is true from 0.5 s on.
- **Frame rate on Mythic-heavy boards:** the boast costs 2-7 fps under the headless CPU canvas, but the
  baselines on those boards are low (Shield Slam's replay 17 fps after the boast, Hive Burst's 26), set
  by the Mythic wards. Not measured on a real GPU.
- **No "tap to skip" hint** beyond the Skip button; a viewer may not know a tap ends it.
- **Headless runs before session 31 used SwiftShader GL at ~5 fps.** Earlier recordings (sessions
  24-30) look slower than the pages are; their checks were not re-run with the CPU canvas.

## The first-time flow (slice 3, session 28)

- **The mint has not been watched by a person.** Its 6.5 s length, the
  order of its beats and whether it feels like the most special moment in
  the product were all judged from stills and a software-GPU recording.
  It can't be skipped; a person may find it long the second time.
- **The signature art is a placeholder** (a figure of light in rings, its
  hue from the art-pool piece). The real pool images come with the art
  pass; until then the reveal's "art develops" beat develops a stand-in.
- **The page is a fixed demo of live store calls:** 4 factions and 9
  agent-and-card branches, all precomputed. On the site each step is a
  call to the store; nothing here talks to a server.
- **The name field hasn't been typed on a real phone** (session 29).
  Whether the on-screen keyboard covers the field, its message or the
  confirm button is untried; headless Chromium has no on-screen keyboard.
- **"Is the name free" isn't checked as you type** (session 29): only the
  rules are. A name another agent holds or held, or another owner's
  username, is refused by the store at "Make"; this demo's store is empty,
  so the page has never shown that refusal. The site needs to show it on
  the signature screen (or ask the store as you type, a game-lane endpoint).
- **The refusal reasons are the store's wording** ("An agent name never
  runs punctuation together."): correct, a little technical.
- **The starter guarantee note has only been seen on pack 3** (session 30). The demo's seeds
  never hit in packs 1-2, so the page never shows a natural hit with no note; the tests cover that
  case in Node, not in the browser. The Cortex branch isn't walked in the browser (the 3 runs pick
  Swarm, Aegis and Null); its data is tested.
- **The demo's starter packs now always end on the same card** (a Full Art Static Ward Beacon for
  every faction, seeds 101-103). Honest to the store, but a viewer comparing factions sees the same
  pack 3.
- **Reduced motion cuts the mint to about a second.** It keeps every piece
  of information but none of the build-up; nobody using reduced motion has
  said whether that's right.
- **The ward canvas is redrawn every frame** for as long as the mint is
  open (a 900 x 900 canvas, three layers). Fine in headless Chromium; a
  low-end phone may drop frames.

## Pack opening (slices 1-2, sessions 24-26; hold to tilt, session 27)

- **Hold to tilt hasn't been held by a person** (session 27).
  - The 0.2 s hold, the 8 px drag start, the lean direction and the spring
    were all chosen without a human thumb.
  - The check proves the rules with scripted touch events, not the feel.
  - A slow tapper may find taps turning into tilts.
- **The tilt moves the shader's light point, not the lighting of the face
  itself** (session 27). A plain card leans with no change in shading, so a
  plain card tilted reads flatter than a real card held to the light.
- **The ten-pack row's cards and the summary tiles can't be tilted**
  (session 27). Only the stack, the viewer, the sealed pack and the fan's
  front pack can.
- **Headless Chromium draws its focus ring around the sealed pack** in the
  stills and recordings (since session 24). The page asks for no visible
  focus on a pointer, but the headless browser shows it anyway. It probably
  won't appear on a real phone; unconfirmed.
- **The recordings run slower than a person's hand.** The software GPU
  slows each scripted step, so the clips show the motion, not its real
  pace.

- **The tap-driven ten-pack's feel is untested by a person** (session 26).
  The 0.6 s guard after a hit, the 0.5 s wait for a deal to land, and the
  rule that every face-down card is turned before moving on were all chosen
  without a human thumb on a phone. The browser check proves the rules, not
  the feel.
- **The text fit shrinks, it doesn't reflow** (session 26). A long card's
  rules text steps down to as little as 68% of its size to fit its box and
  clear the stat boxes. On a summary tile that is very small text; the
  viewer is where to read it. A real fix is a layout that gives long cards
  more room (or the art pass's own frame).
- **Auto in a big pull steps at fixed beats** (0.7 s after each reveal's
  hold). Nobody has watched a Zero-Day or a secret play out hands-off and
  judged whether it lingers enough.
- **The card viewer opens only from summary tiles.** The ten-pack row and
  the stack have no "look closer"; the binder (website work) will want the
  same viewer.

- **The ten-pack sequence hasn't been timed on a real, slow phone.** Five
  cards of CSS animation per pack were smooth in headless Chromium; a
  low-end phone may drop frames at 4×.
- **The fast row's finishes are the CSS stand-ins** (the summary's), not
  shaders; a Glitch or Full Art in the row reads as "special" but not as
  its own full look. Only a big pull gets the shaders.
- **Only two showcase tens, both a fresh owner's first ten packs,** so most
  cards wear NEW. A ten-pack open by a collector with a full binder (few
  NEW, many ×N) has only been seen in the tests.
- **Slice 1's committed stills show the shared-gradient bug** (fixed in
  session 25): every card on a page painted the first card's background.
  They are left as the record; the page itself is fixed.

- **Only checked in headless Chromium with a software GPU (SwiftShader).**
  The shaders compile and light pixels there, but nothing has run on a
  real phone, a real GPU, iOS Safari, or with the device tilt (the
  `deviceorientation` path and its iOS permission prompt are untested).
- **The card swipe was only exercised as taps.** The check tears by a real
  drag, but steps through the stack by tapping; a drag-to-swipe on a card
  is untested in the browser (the gesture rule itself is unit-tested).
- **The sounds were never heard,** only checked as recipes (sane voices,
  the hit's rise always rising).
- **The Glitch "RGB split" is two filtered DOM copies of the card**, not a
  per-pixel channel split (a shader can't read DOM). It reads as a split
  in motion; a still mid-flip mostly shows the card edge-on.
- **The page runtime (about 800 lines with the tap flow and the viewer) is
  one string.** Its pure helpers (now including the card face, the full-
  bleed rule and the row-tap rule) are tested in Node; the rest only by the
  three browser checks.
- **The committed page changes on every rebuild** (the store's random pack
  and copy ids), even with the same packs. Asked of the game lane.
- **The showcase packs are found by seed search**, so the page shows one
  of each finish; it is not a sample of what a typical opening looks like.

## Layout and legibility

- **At 545-600 px the board cards are small** (85-91 px wide, session 20).
  The row is zoomed to keep six on one line, and the name strip's text is
  about 7.5 px. It reads, but only just.
- **Labels over a zoomed card now shrink with it (session 23), but only
  where the call site says "this is a card".** spawnNumber takes an
  `onCard` flag; a new call site that forgets it gets a full-size label.
  The cast tag on a Command's stack entry and the impact number over a
  player stay full size on purpose.
- **The feed says what happened, never why it mattered** (commentary,
  stage 7). Every fizzle is now worded from the engine's cause; a fizzle
  with no cause (an ability with nothing to do, an old log) still prints
  the engine's reason text.
- **The quiet-trigger rule depends on an engine habit:** every effect that
  changes the game logs an event straight after its trigger. The test
  (`feedQuiet.test.ts`) checks that over 32 real matches. But it sees only
  triggers resolved from the turn and stack code: onDeath triggers fired
  inside the resolver's own death pass aren't wrapped. A new effect kind
  that changes state without logging would make its trigger vanish from
  the feed, and now from the board too.
- **The board and the feed agree on quiet triggers only through
  `Frame.quietTriggers`** (session 23). A replay captured before session 23
  has no list, so its page still flourishes every trigger. All 14
  committed replays are regenerated.
- **The turn-cap ending ("X wins at the turn cap, 14 health to 9") is only
  seen in tests;** no replay reaches the cap.
- **In a mirror match a feed trigger can lose its side colour** when its
  event carries no instance id and the card's name is on both boards.
- **The feed is built for a finished match** (`buildFeed` over all frames).
  It only ever looks back, so a live stream (the server, stage 4) could
  build it move by move, but nothing does yet.
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
  (health, board, hand). They now use agent names (session 21). They don't explain a threat that hasn't landed
  yet (a pending stack item, an armed telegraph), which is exactly what a
  spectator can't track.

## Verification

- **The tests never run a browser.** Every visual claim (overflow, the
  zone's DOM, frame strips) is checked by scratch Playwright scripts from a
  folder outside the repo, and only the CSS rules are pinned in vitest. A
  regression in layout would pass CI. The overflow script and the
  board-fit script (session 20) and the feed script (session 21) are
  committed in
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
- **`renderHtml.ts` is one file of about 2,360 lines** holding the CSS, the
  page markup and the page runtime as strings. The FX modules are split out
  and tested; the page glue isn't.

## Deferred by design (not debt, listed so it isn't forgotten)

- **Victory boasts (render half)** are planned, not built (session 30): no "victory" event
  category, no boast animation, no end-of-match moment beyond the lethal beat and the result line,
  no loadout picker. Waiting on the owner's answers to the plan.

- Real card art (the late owner-funded pass) and the 500-piece signature
  art pool (game lane first). The card centre is still a placeholder motif.
- Adaptive pacing driven by significance, for spoken commentary (owner
  2026-09-25), comes with stage 7.
- The website Music setting, menu music and the music widget belong to
  build-order steps 4-5.
