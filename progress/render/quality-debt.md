# Render lane — quality debt

The render lane's own self-audit (RENDER.md guardrail 4: the shared
`progress/quality-debt.md` belongs to the game lane). Started in render
session 19, a hardening pass. It lists where the spectator render falls
short of DESIGN.md's arena bar and principle 2 (a human must enjoy
watching) right now. Most important first. Each session updates it; fixed
items are removed, with the fix in `log.md`.

## The owner website (sessions 44-51)

- **The season's end on the site (sessions 72-73) is checked on the real API through open, ending and ended (60 +
  40 PASS), with thin spots.** Session 73 drew the Store page, the Store, Packs and Daily rewards widgets, the top
  bar's Open and the card viewer closed once the server says "ended" (the page's clock doesn't freeze them: the
  archive only refuses once ended). Still thin: the Daily rewards row still marks the next win slot ("6") as next
  after the end (only the line above it says no more matches pay). The loadout picker's own Buy (inside the dress
  frame) isn't frozen: after the end it is refused with the server's words in the picker. The pack page's summary
  buttons ("Open another") aren't frozen either, but no opening can start after the end, so they can't be reached
  then. There is still no season-end screen (the owner's 2026-11-10 note leaves one open), and the end time shows
  only on Stats. The season is read at sign-in, with the status poll at most once a minute, and at once after any
  refusal that says the season has ended (session 73: measured 2-8 ms from the toast to the closed Store, no
  reload). So a stale page can still offer one press before it closes; that press is refused by the server, as
  before. The Stats line's countdown is drawn when the page draws, not ticked. The browser checks ran the server's
  clock at 8x. Phones emulated only (390 px: the closed Store checked; the closed Home widgets on a phone not).
  `isSeasonEndedRefusal` matches the words "season ... has ended" with a 409: if the server's wording changes, a
  stale page falls back to the minute's read (the unit test pins today's words from the real store).
- **The waiting ring (session 72):** checked at S, M, L and a 390 px phone with the server waiting, then paired. The
  S line is one line at 11 px with an ellipsis and the full caption on hover; a longer server label (another
  language, a renamed state) would be cut at S. Turning auto-play on again with new minutes while waiting replaces
  the minutes (the server's rule); the widget doesn't say so beyond the presets' existing hover. The breathing was
  seen as a class, not watched as motion.
- **Top rated and viewer counts on Watch live (session 71) are built and checked on the real API with the ladder
  playing (39 PASS), with thin spots.** The demo has four owners, so a round has two matches and the browser saw
  only "no Top rated" (houses in placement) and "every match featured"; a mixed round (some featured, the rest under
  "Also live") and a Tournament group are only unit-tested (the server's own demo round, m21-m25). The viewer count
  is as fresh as the list poll (3 s on screen) and the server's 30 s window: a closed arena still counts for up to
  30 s. The count includes the viewer when their own arena (the Home tile at L, a full-screen arena or the match
  page) is reading the feed; the page says so in one line, but "1 watching" can be just you. The arena itself
  (the full-screen view) shows neither the rank nor the count. The phone scoreboard fix (the turn line above the two
  sides at 560 px and under, which had squeezed a side to a few px) touches every scoreboard on a phone: looked at
  on Watch live and its widget only, not on Agent match. Phones emulated only.
- **The notifications bell (session 70) is built and checked against the real API with the ladder playing (60
  PASS), with thin spots.** The badge follows the 15 s status poll (`limit=1`), so a new notification can take up to
  15 s to show (the server has no push; OWNER_API.md says so). A big pull's cards in the panel are only unit-tested:
  the demo's ladder never opened a big pull, so the browser drew match results and the daily pack only. Marking an
  id that was cleared elsewhere meanwhile (a 404) is ignored and the count settles on the next poll: not exercised.
  The "swing" for a new one was seen as the class going on (a MutationObserver), not watched as motion. Today /
  Yesterday / Earlier are the viewer's own calendar days, while the game's day (the daily reset) is Sydney's; near
  midnight they can disagree. A notice links to its page (Agent match, Collection, Store, Home), not to the match or
  the pack itself, as the widget's do. The panel lives after the top bar in the page (outside it, so its blur reaches
  the page), so Tab from the bell into the panel and Shift+Tab back are handled by hand; a screen reader's own
  navigation reads it after the top bar. Phones only emulated (390 and 320 wide), never a real device; at phone
  width the theme button leaves the top bar to make room (Settings has the same choice). There is no old-code
  comparison: the bell didn't exist before.
- **The Stats page (session 68) is built and checked against the real API (44 PASS), with thin spots.** The
  filter's second agent in the demo has no matches, so the check proved an empty agent and "All agents", never two
  agents both with results (the Node test on the real API does: 3 matches of 8). The day columns under the chart are
  thin bars at 30 days and hairlines at 90 (on the demo's one-match days they read as dashes); they carry rated
  matches only. The chart's 7-day view on the demo is one rated day, so it's mostly flat. A Replay needs the match in
  the history's newest 50 (`GET /api/matches?limit=50`): an agent-filtered recent row older than that shows "No
  replay" even if it has one. The page refreshes on its own only when the owner's agent's match ends or starts (the
  15 s status poll) and at the daily reset; another owner's match moving the ladder shows on the next of those or a
  revisit. On a phone the ladder table drops four columns. The ladder shows the public top 100 only (the server's
  limit). Quests and achievements are not on the page (after Season 0, owner 2026-11-06). The main column ends
  shorter than the side column on a wide window when recent results are expanded.
- **Watch live at L embeds the real live arena (session 67), checked against the real API, with thin spots.** The
  frame is laid out 1180 px wide and scaled to the tile (about 0.66 on a 1440 px window), so the arena's own small
  type (HUD numbers, hand chips, card names) is barely legible in the tile: the tile is for following the shape of
  the match, the scoreboard beside it carries the numbers, and Full screen is one click. Each embedded arena is a
  whole arena page (canvases, the FX loop) running while Home is open; only looked at in software rendering, its
  cost on a real GPU and on a slow laptop is unmeasured (it loaded in under 1 s headless). One per board by rule;
  a second Watch live at L shows the compact board. The redraw-around-the-frame (`patchAround`) is proven in the
  browser (33 s of redraws, same frame, never reloaded) and, since session 69, in Node on a small stand-in DOM
  (`sitePatchAround.test.ts`: the kept node never removed or moved, attributes synced and dropped, no twin = nothing
  changed, twins by place among same-key siblings). The stand-in is the test's own, not a real DOM: a browser
  quirk it doesn't model (text nodes merging, a template's content document) would pass it.
  The 20 s hold after a match ends is a guess (the boast fits in it in the demo); a 2x match's end was not seen in
  the tile. The tile's "Watch as" flip was not exercised by the check (the demo's first live match is always the
  viewer's own, which has no switch); it reuses the arena's own switch, which is checked in `pov-check` (s52).
  Reduced motion: the arena inside follows the viewer's setting itself; not checked in the tile.
- **The pack opening ceremony is built per the brief (sessions 58, 60, 61, 62: parts 1, 2, 3a, 3b), but proven only
  headless.** Open 10 stops on every held card (Auto waits too; Skip never passes one); the debug panel forces each
  kind through real seeded openings; the brief's done-check ran in the headless browser (90 PASS). **Thin:**
  everything was looked at in software rendering only, never on a GPU, so the brief's 60 fps bar is unproven; there
  the Zero-Day's full-screen shader runs the page at 3-4 fps, a foil or glitch shader at 1-10 fps, the room's fade
  back takes 3-6 s of wall time, the Glitch's hit lands up to 1.3 s late (allowance 1.5 s), and the tear still often
  needs a tap after Enter; the Prototype's slam is evidenced by the log, not a still; the sounds were checked by
  recipe, level and count, never by ear; the fanfare plays only for a Prototype (the brief asks one per tier); a row
  stop builds at the row card's size, so a Glitch or Full Art in Open 10 is a smaller moment than in one pack, and
  the Glitch's own corruption, the Full Art expansion and the finish shaders are not played in the row (CSS
  stand-ins only); Open 10 takes 36-62 s by tap (13-17 stops); the ten-pack summary has no fan or set bar; the
  first-time flow's summary has no set bar; the debug panel always forces the same pack per kind and adds 760 KB to
  the demo page; the s62 stills were taken before the Skip button's rename (they read "Skip to summary"); the
  demo's tens hold a stop in every pack, so Skip running past a plain pack is never seen in a browser (source-tested
  only; session 64 fixed Skip during a tear passing a pack's stops, found by `pack-bulk-check-s64.mjs`); the Mythics' own unique wards are not used in the flare; a Gold Mythic's
  doubled ward reaches the screen's edges at 1280 x 800; the ten-pack's mini packs keep the old tear.
- **The store layout (session 63) is built and checked against the real API (36 PASS), with thin spots.** The
  countdown's re-read at zero was never seen in the browser (only the clock, in Node); the Store widget at L fits
  with 1 px to spare at 1440 x 1000 (other font metrics would scroll it inside the tile); the compact pack art in
  the widgets is 52-56 px wide, so its logo is barely legible; the 10 packs tile draws three full plates (three
  SVGs); a buy's confirm is still a dialog; the stepper is gone (owner call 2), so buying 3 takes three
  confirms; the phone layout looked at once. Since session 64 the claimed daily tile ticks on the head's clock, and
  focus returns to the tile's button (or its tile, when the button greys) after a buy or a claim; the focus check
  was only seen passing, never failing on the old code. `site-check-s47.mjs` and `pack-bulk-check-s54.mjs` are
  retired (session 64), replaced by `site-check-s64.mjs` (56 passed) and `pack-bulk-check-s64.mjs` (14 PASS).
- **Agent controls' time ring runs on the server's allowance (session 58), ticks once a second (session 59), and says
  the server's words (session 69: `allowance.label`, "Finishing match" and "Time's up", seen from a real 15-minute
  run to its end at 8x, `site-check-s69.txt`).** The label is shown only for the state it came with (a running
  allowance the page's count takes to zero still says the ring's own "Finishing match" until the next read); an
  older server's missing label falls back to the same words. The page's 5 s reads near the end start on the
  page's own count of the time left: a page clock behind the server's (or the demo at 8x, seen in session 69's run
  2) gets "Finishing match" only at the next 15 s read.
  Since 59 the arc, minutes, label and caption are patched in place every second from the last read on the page's
  clock (the arc to a tenth of a percent; whole percents had stepped a 15-minute ring only every 9 s), and the
  status read comes every 5 s in the allowance's last 30 s and while the agent finishes (carried over from closed
  PR #137); both seen in the browser (`site-check-s59.txt`). **Thin:** the 5 s cadence and "Finishing match" were
  seen in the browser on a rewritten `GET /api/play` (20 s left); the real run to the end (session 69) was at 8x on
  the demo's clock, not the real pace; a preset pressed while time runs replaces the time left (the
  server's rule) with no confirm; the tick runs only on Home (the Agent match page shows on/off, not the ring).
- **My agent and Agent controls, thin spots (session 57):** the rating trend is drawn from `GET /api/rating`'s last
  20 rated matches, not the Stats data (game item 2e) the brief names; the dial is a radio group with arrow keys since
  session 59; since session 69 an arrow shows its choice at once and saves once the keys stop for 700 ms (or on
  Enter, Space, a Tab away), so three arrows make one save and one toast (`site-check-s69.txt`). Thin: a status
  poll's redraw inside those 700 ms can draw the saved style back for a moment (the save still goes; the Home redraw
  skips a focused tile, so it was never seen); a screen reader hears each arrow's style before it is saved (a radio
  group's rule) but nothing says when it saved except the toast; the deck switcher is still mouse-checked only; at narrow widths (the one-column board) the L layouts stack but were not looked at; the demo's history
  is mostly `recordMatch` rows with no replay, so the trend's shape there comes from those made-up results, not
  real play (the numbers are still the server's).
- **Most by-hand browser checks are never re-run.** Session 54 (a hardening pass) brought the stale ten-pack
  and loadout checks up to date (`pack-bulk-check-s54.mjs`, `loadout-check-s54.mjs`) and found the older
  ones break the same way: written against the page as it was that session, and against one machine's
  Chromium path. Session 38's boot check still expects the 2.6 s intro (render 53 made it 3.4 s), and other
  pre-41 checks (`boast-check-s3x`, `hardening-check-s40`, `feed-check`, `pack-*-check`) were not re-run
  this pass: assume any of them may be stale until run. Only `render/ci/browser-check.mjs` runs on every PR. Session 59 (a hardening pass) fixed and re-ran
  two more: `site-check-s49.mjs` (it expected five rail slots and counted coins as buyable boasts; 40 passed) and
  `site-check-s51.mjs` (its frame URL pattern missed `#view=`, twice, and it expected face-down live hands, which
  session 54 made whole; 28 passed). Each took 5-10 minutes in software WebGL; still not re-run: s38's boot check,
  `boast-check-s3x`, `hardening-check-s40`, `feed-check`, s45's liquid check. Session 60 re-ran
  `pack-ceremony-check-s58` (127 PASS) and `pack-bulk-check-s54` (12 PASS after one model change); `pack-opening-check`,
  `pack-tap-check` and `pack-tilt-check` don't start here at all (they import Playwright by a path this machine
  doesn't have) and still expect plain Rares to arrive face up.
- **The liquid slows under a full board (measured, unresolved):** with the widget board's nine glass
  tiles the liquid draws 16 fps in software WebGL at its lowest resolution (25 with two panels); the
  tiles' `backdrop-filter` is the whole cost. Session 45's check fails its 20 fps bar on this branch
  (`site-check-s45-rerun-s46.txt`). Never measured on a GPU; options with the owner (notes, session 46).
- **The live arena draws what a replay draws (session 56), with one fallback:** the signature zone and a signature
  unit come from the live view's card in full (`PublicSide.signature`, game session 72); its abilities as data are
  rebuilt from the engine's signature menu by rules text (`signatureCardOf`), tested against every card the menu
  can make at every size (more than 600) and, in six real matches with signature cards, every frame equals the
  captured one, zone, unit, trigger lines and hand costs included. **Thin:** a signature line the menu doesn't have
  (a menu wording change on the game lane without a matching render, or a future non-menu signature) leaves that
  card unknown: the zone is still drawn from the feed, but the unit falls back to live numbers only and the hand's
  costs say "?" while it is in play (`signatureUnknown`, tested; nothing reports it outside the tests). The rebuild
  matches by text, so two menu abilities with the same words but different data would be refused, never guessed
  (none today). Since session 54 the hands are whole from move 0 (`openingHands`) and each side shows its deck's
  faction from the first frame (`LiveSideView.faction`); a feed without them (the real-time safety rule, when
  network agents join) falls back to backs and Neutral, as before (tested in `liveFrames.test.ts`). Statuses and
  this-turn buffs take their duration from the source card's abilities: exact in every tested match, but a future
  card with two different durations for the same status or buff would leave it out (listed in
  `LiveFrameBuilder.unknown`, never shown wrong; nothing reports it outside the tests).
- **The live boast now plays before the result (session 56)**, from the live view's `boast` once the last move is
  out, checked against the board's end as a replay's record is. A host that reads the last move but not the boast
  (an older server) still shows the result first and plays the boast when the record comes (~8 s later). The live
  page's Match Boot saying is seeded by the match id, so the replay of the same match may show a different saying
  (unchanged).
- **The 2× controls (session 56) are words over the server's vote, nothing more:** Agent match, over the live
  arena beside Close, a 2× pill on Watch live's cards, and Settings -> Play's "Ask for 2× in every match". The
  arena steps at half its delay while following live at 2×, so it keeps its distance from the newest move; paused
  or stepped back it plays at the viewer's own speed. Not done: no notification when the other owner asks (the
  game lane's notifications are queued); Agent controls (which replaced the Home Live match widget, session 57) has no
  2× control either, only "Go to match"; the vote wording ("Agree to 2×", "Back to 1×") was picked by this lane (a check-in
  call); a house account sees no Settings switch (its setting is ignored by the server). The control's state is the
  last `GET /api/live` read (every 3 s), so the other owner's ask can take up to 3 s to show.
- **The boast is slow in software WebGL (measured session 56):** in the headless check a ~3 s boast took 33-35 s
  to give way to GAME OVER on the live arena (three runs). The order is right (boast, then the result); the time is
  the canvas in software rendering (session 51's stills of the boast timed out the same way). Never measured on a
  GPU.
- **The live arena is fed by polling** (the website reads `/live-frames` every 3 s, the host reads the API's
  feed only for new moves): up to 3 s behind the server's watch clock, plus the arena's own step pace.
  Each read rebuilds the slots and the spectator feed over the whole match so far (about 120 frames: fine;
  never measured with many viewers). Live pages are kept in the host's memory (8 at most, 10 minutes after
  the last read); a host restart drops them (the viewer reopens).
- **Catching up is a fixed rule** (hurry past 3 behind, skip past 12); in software WebGL at 8x the arena
  can't keep up with every move's effects, so it skips. Never measured on the Mac mini's GPU.
- **A second live arena in the same site page can be slow to start (unexplained):** in the session 51 check,
  after a whole live match had been watched to its end, opening another from Watch live took 28-34 s to
  parse in headless software WebGL (served in 35 ms; on its own the page answers in about 1 s; three opens
  in a row in a fresh site page take 2-5 s). Not caused by Watch live's redraws (stopped under the overlay
  now; no change). Never seen on a GPU; needs a profile.
- **Session 50's browser check flaked once** (check 37: the 720 px history's Replay button "not visible" to
  the click for 30 s, on this branch; the re-run passed 40 of 40). Watch for it.
- **The Home widgets don't open the arena** (only Agent match and Watch live do).
- **The coins (sessions 53 and 55) are code-drawn placeholders, judged by their author only:** all six
  Season 0 coins are drawn (`coin-sheet.html`), but nobody but this lane has looked at them. Known soft
  spots: the Diamond's facets read pastel rather than brilliant at small sizes; the Mythic's face washes
  out under the shared metal sweep; the coin's edge is a flat band, not a real rim; at a tile's size (about
  30 px across) the faces' detail (the Dime's waveform, the season mark) is mostly lost. The check that
  "the six landed coins differ" measures mean colour and is weak (closest pair 7.7 apart, because landing
  portrait up the faces share the portrait); the sheet's pixel hashes are the real distinctness check.
  The flick, the four whirs and the clink were checked as queued and their recipes tested, never listened to
  by a person (the modem warble especially). The coin's size is set by the gap between the agent lines
  (about 30 px radius on the desktop replay), small on a wide board. A real `avatarUrl` portrait is drawn
  as given. The committed `render/output` pages are rebuilt (session 55, `npm run outputs`), but nothing
  rebuilds them automatically, so they go stale whenever a session forgets.
- **The loadout picker's coin preview is its own small player, not Match Boot:** it reuses `coinDraw`,
  `coinFlight` and the flight's length, but the dimmed board, the result line's type and the landing ring
  are drawn by the picker (`COINPV`), so a later change to Match Boot's landing has to be made twice. `site-check-s49.mjs` was
  brought up to six slots in session 59 and passes.
- **Live hands are rebuilt, not sent (session 53):** exact in every tested match (card for card against the
  engine, and over the real API against the recorded replay), but a future engine change that moves a card in
  or out of a hand without a `playCard` move or a `draw` event (a discard, a bounce) would trip the count
  check and turn that hand to backs for the rest of the match (never a wrong card; nothing reports it outside
  the tests).
- **The point of view (session 52) has untested corners:** a switch during Match Boot or a boast waits by
  polling every 120 ms (fine, but a timer, not an event); a switch drops effects still in flight on the move
  shown (the end state is drawn, the flourish is lost). The momentum gauge keeps its old convention (p1 ahead
  fills right of centre, away from p1's HUD on the left) and mirrors with the view: it was never checked
  that viewers read it the intended way (owner call 3). A replay of a match the viewer doesn't own can't be
  opened from the site yet, so the replay page's switch and the record's `defaultView` aren't used there.
  Standalone replays start at p1 (no ratings in the file).
- **The play-by-play is the engine's log text tidied by regexes** (`tidyLine`), not the arena's own feed
  (`feed.ts`, built from frames): an ability shows as "X's ability triggers" with no rules text, and a new
  log line shape from the engine would pass through untidied (a test pins today's shapes).
- **Replays are rebuilt per request** by the site host (about 40 ms and 2 MB each, kept 10 minutes, at most
  6): fine for one house; no cache across restarts. A replay file from before a card or rule change will
  fail to rebuild (422, said plainly) until the game lane versions replays (owner call 6).
- **Match history pages are 20 at a time and read again from the top** after the agent's match ends
  (the older pages already shown are dropped and read again with Show older). The 15 s poll redraws the
  whole Agent match page (focus kept by `focusKey`, the play-by-play's scroll reset to the newest line).
- **The live parts poll every 3 s** (15 s in a hidden tab), not a push: a move can show up to 3 s late
  against the server's watch clock. Never measured with many live tiles open at once.
- **The arena replay inside the site keeps its own dark terminal look** and its own controls; the site's
  sound and music settings aren't handed to it (it uses its own toggles).
- **The demo's ladder is opt-in** (`--ladder`), so sessions 46-49's checks don't see live matches; nothing
  re-checks the Store's loadout lock against a live match in the browser yet.
- **Ladder, Rating & form and Notifications draw the server's data at S, M and L (session 65), with thin
  spots.** Checked against the real API with the ladder playing (`widgets-check-s65.txt`). **Thin:** a big pull's
  cards in the Notifications widget are only unit-tested (the demo's last eight notifications held no big pull, so
  the browser never drew one); the widget marks nothing by showing (only its Mark all read does; the
  bell's panel marks what it shows, session 70); a notification's link goes to its page, not to the match or the pack itself; the
  Rating & form chart's 30 days show long flat stretches where the demo's warm-up skipped days (correct, but dull);
  the tier floors on the chart need the ladder read (without it the chart draws without them); Ladder M fits four
  rows by dropping the owner names at M; the widgets were looked at once on a phone; the ladder's "Around you" at L
  was never seen with the owner off the top 8 in the browser (four owners in the demo; unit-tested). My agent still
  has no persona or signature card.
- **Daily rewards, Showcase and Collection at S, M and L (session 66), with thin spots.** Checked against the real
  API with the ladder playing (`widgets-check-s66.txt`, 36 PASS). **Thin:** the reward row's win nodes have no
  button because wins pay themselves; the free pack is the only claim (no quests in Season 0), so "a row of rewards
  with claim buttons underneath" is one button; the ring's re-read at the reset (the clock reaching zero now
  reloads the daily read too) was never seen at midnight in a browser; the ring's fill and the next node's pulse
  were looked at only in stills; the phone layout hides the "no quests" footnote to fit; Showcase S draws its card
  smaller (62 px, was 78) to fit beside its name, M and L larger (121 and 156 px); Showcase is still a placeholder
  face (no stats or text, the pack page's full face needs fields the collection read doesn't send); Collection L
  scrolls its binder inside the tile (420 px over at 61 cards held; it lists every card held, as before);
  the demo pays wins out of order (see notes-for-owner, s66), so the stills' paid labels read +10 +10 +5 +30.
- **Pages are still missing:** Admin (not in Season 0).
  The Store has no "Watch again", and the Collection no craft price from the API or Promos, though the game
  lane serves all three since its session 68 (render work not done yet).
- **The loadout picker on the site (session 49):** the deck's faction is unknown to the site unless a
  faction is locked or the latest build is the deck being played (asked of the game lane); until then an
  empty victory-boast slot can't be previewed, and the preview row is the owner's units of its starting
  faction, never the deck's actual cards. It is a third frame-around-a-standalone-page (after the pack
  opening): two documents, the frame kept once loaded. The picker's own look is the old dark terminal
  page, not the glass website. The live-match lock is tested over the API, never seen in the browser (the
  demo can't start a live match from the page). Buy refreshes the picker by reading five endpoints again.
  Clicking Change during the Store's redraw after a Close can miss (seen once, in the check).
- **The Collection page (session 48):** Promos only says what it waits on (no signature cards or promos in
  the collection API). Craft prices come from the economy's config file, not the API (asked for). The
  binder draws every place's face at once (96 on the Set tab, 152 on Secrets): fine in Chromium here, never
  measured on the Mac mini with the liquid behind it; no virtualisation. The binder's faces aren't
  text-fitted (unreadable at 124 px anyway; the viewer fits). The viewer's tilt is the pointer's only (no
  touch hold-to-tilt as the pack page has). Salvage's 409 after a plan that named no deck (a race) is
  handled in code, tested over the API, never seen in the browser. The browser check is by hand, not in CI.
- **The site's pack opening is a frame around the standalone page:** two documents, two sound players
  (the site has none of its own yet), and the frame is loaded once and kept. Proven in Chromium only. A
  reload mid-reveal loses the show (the cards are safe: they're in the collection).
- **The site's bundle grew from about 150 KB to 300 KB:** it now carries the engine's card registry, so
  the planner can draw card faces. Fine on home Wi-Fi; never measured on a slow link.
- **By-hand browser checks use fixed waits that a slow machine can outrun.** The check-E flake (session 47)
  was the script's: a 15 s wait for the tear to reach the cards, beaten under load, after which the check
  tapped nothing (session 54 found it with probes and fixed `site-check-s47.mjs`). The other site checks
  (s44-s53) use the same `until(..., 15000)` pattern and were not audited. Not seen on the page side, but
  unproven either way: the pack page's 200 ms hold-to-tilt is a timer, so on a badly stalled main thread a
  quick tap's release could in principle be handled after it and read as a tilt (never observed).
- **The board's drag is HTML5 drag and drop:** proven with a real mouse in Chromium; not tried in Safari
  or with a trackpad. No drop-position preview beyond the outlined target; the mockup has none either.
- **Wide windows pack densely**, so a Small can sit ahead of its place in the owner's order (narrow ones
  keep the order). A screen reader reads the DOM order, which is the owner's order.
- **Widget data refreshes every 15 s** (daily and packs only); the collection is read on entering Home,
  after a purchase and after an opening (session 47).
- **The mini cards are a small placeholder face,** not the full card frame (no cost, stats or text).
- **The liquid's frame rate was only ever measured in software WebGL.** The step-down threshold (20 fps)
  and the steps are first guesses.
- **The title screen has no liquid, card fan, foil logo, stat tiles or ticker** (still the trimmed one).
- **The skip hint isn't remembered on the account** (owner call 2 from session 43): the site has nothing
  to skip yet.
- **Sound and music settings exist on the account but have no controls** (the site plays nothing yet).
- **The site's browser checks are by hand** (`site-check-s44/45/46.mjs`); CI runs only the vitest half.
- **Judged from headless stills only.**
- **The faction colour of the agent** comes from the lock or the last rebuild's result (the API has no
  deck faction); after a reload with no lock and no job in memory, the avatar is the neutral violet.
- **Live state is polled** (15 s, 1.5 s while a rebuild runs); live matches want a push channel.

## The "tap to skip" hint (session 43)

- **Nobody has judged it on a real screen.** Its words, size (11 px on a desktop, 12 px on a touch
  screen) and backing were judged from headless stills (`v2-s43-hint-*.jpg`). On a desktop it sits
  over the top-right card of the winner's row, on a dark chip.
- **"Once skipped, never again" lasts one page load.** The owner chose the account (session 43 call 2);
  it waits on an account-settings endpoint (session 44 notes).
- **It is left out, not moved, when it doesn't fit** (under Skip, inside the winner's side or the
  board, clear of the name plate and the intro's lines). No real layout drops it today (all 30 sheet
  scenes, both replay layouts), but nothing tells the viewer when it is dropped; the page counts it
  (`SKIP_HINT_STATE.dropped`) and nothing reads that count.
- **The plate check in CI uses 4 of the 30 scenes** (Shield Slam full, Boot Sequence above, Hive Burst
  and Void Collapse on a phone); the other 26 are checked for place and words only, before the plate
  shows. The runtime's own rule (it never places the hint over the plate's planned box) covers them by
  construction, tested in vitest.
- **The pack opening and the first-time flow have their own skip controls** ("Skip to summary"); this
  hint isn't on them. Only the boast and the intro end on a tap anywhere.

## The CI browser check (sessions 41-43)

- **Only a small part of the browser evidence runs in CI.** `render/ci/browser-check.mjs` (61 checks)
  guards the boasts' spill, the Skip sizes, one replay's intro and that replay's end, and the skip hint. The deeper session
  checks (sound as heard, timing under a stall, the pack opening, the feed, the narrow layouts, the
  loadout picker, the recorded replays' boasts and close wins) are still by-hand scripts under
  `progress/render/evidence/`; a regression there would pass CI.
- **No audio is checked in CI** (owner kept this, session 41 call 1): the boasts' and the intro's sounds
  could break and CI would stay green.
- **The replay's end is one replay, one boast, a plain win.** Cortex vs Swarm seed 6 ends in a Cortex
  win with no record, so CI sees the faction starter Data Cascade on a real board only. The close win
  (CLOSE CALL first), a recorded loadout boast, and the other five boasts on a real board are by-hand
  only (`boast-check-s37.mjs`, `-s39.mjs`).
- **Two of section D's bounds are loosened for slow runners, and they're judgement calls.** The lead
  after the lethal flash is checked at half its 900 ms (the flash fires on the effects' frame timer and
  lands late under load; measured down to about 610 ms with two checks at once); a boast that doesn't
  wait at all (0 ms) still fails. The spill count starts 60 ms after the clear's 280 ms on the effects'
  own clock, which the check keeps itself (the same 50 ms-per-frame cap as canvasFx); if canvasFx's cap
  changes, the check's copy must too (nothing pins it).
- **What section D found about the render under load, not fixed:** on a slow machine the loser's clear
  (280 ms by design) runs on the effects' capped clock, so in wall time the lethal smoke lingers longer
  on the loser's side (up to about 540 ms into the boast with four pages at once). The same for the
  lethal flash, which lands late. Neither is a spill past the winner's side once the clear ends; both
  are "slow-motion when frames drop" as canvasFx was built.
- **The pinned Chromium's download wasn't run in a session.** The session container can't reach the
  Playwright download host; the session runs used the container's copy, which is the same build
  (chromium-headless-shell 1243, Chromium 153.0.8010.12, what playwright-core 1.63.0 pins). The PR's own
  CI run is the first real download. The system-library fallback (`install-deps`, only if the browser
  can't start) has never run.
- **Up to four pages animate at once** (three in section A, four in D), to keep the step short. Each page
  samples its whole boast, but a slower runner samples fewer frames, and a one-frame flash past the side
  could fall between samples.

## Hardening pass (session 40)

- **The boast's clip has a hard edge.** Everything the boast draws itself is clipped to the winner's
  side (2 px over). Where a halo used to fade out past the side it is now cut at the side's edge. The
  halo there is faint (past 55% of its radius it is under 12% opacity), and no still has been looked at by
  a person for a visible line along the midline.
- **The `CFX.kit` marks are still kept in by the checker, not the clip:** a boast's shocks, flares,
  rings and sparks are drawn by the effects layer with everything else, so they can't be clipped to
  one side without clipping the match's own effects. The checker's reach for each is conservative
  (and measured: 0 lit pixels past the side for all six boasts on the sheet), but it's arithmetic,
  not a guarantee.
- **The loser's clear now also catches a few of the winner's particles:** `fadeOutIn` fades any
  particle whose reach touches the loser's rect, so lethal-hit debris on the winner's side within a
  sprite's reach of the midline fades with it. Harmless (it's the lethal attack's debris either way),
  but it is a change in what fades.
- **`fxParticleReach` is read from `drawP` by hand.** A test pins the drawing lines it was read from,
  so a change there fails a test; but a new particle kind with no reach counts as a point (reach 0).
  The test lists today's seven kinds, so a new kind fails it until it's added.

## The boasts' sounds on the audio clock (session 39)

- **Nobody has heard a boast on a real device, before or after.** The check proves when each sound
  starts on the audio clock and that the recording hears it there (within 3 ms of the same sound
  played alone); it doesn't prove the fix is audible. At the frame rates the headless browser gets on
  a recorded replay (about 50 fps) the old frame-fired sounds were 11-19 ms off at the median, which
  few people would hear; the difference shows under a stall (up to 122 ms late before, 0 now) or on
  a slow phone, and nobody has tried one.
- **The audio is still timed against itself, not against the picture.** The sequence ties the audio
  clock to the boast's clock at its first tick; nothing measures a sound against the frame it belongs
  to. On a page whose frames lag (a slow device), the sting now lands on time while the lock's
  flash may come a frame or more later: before, the two were late together.
- **Most of a boast's sounds can't be heard apart in the recording:** a plate's impact under the
  previous plate's ring, a spore under the next sac's swell. Of 75 planned sounds across the six
  boasts, 53 stood out clearly enough to time in the committed run (Boot Sequence's 34 all do; Shield Slam 3-4 of 8, Hive
  Burst 3-4 of 13, Data Cascade 3 of 8, Dial-Up 7 of 10); the rest are checked as queued, not as heard.
- **A skip now cuts the sting** (30 ms fade) where it used to ring on over the result. Consistent with
  the intro, and the owner kept that for the intro, but it is a change in how a skipped boast sounds
  that nobody asked for directly (a checkpoint call).
- **Sound switched on mid-boast drops what's already past** (more than 120 ms), so a viewer who
  unmutes during the boast hears only its rest; frame-fired, they heard each sound from the next
  frame on. Same rule the intro uses.
- **The music is no longer held under a sting with effects muted** (no sting is heard, so nothing to
  duck under). Before, the hold fired from the frames whether or not the sting played.
- **The loadout picker's choice is made per pass:** the proxy gives a pass its sequence or none as
  the pass starts. Today `SOUND_OK` only changes as a pass starts, so it is the same as before; a
  future control that mutes mid-pass would need the sequence cut.

## The win message (session 37)

- **Nobody has seen it at full speed.** Whether 0.6 s is long enough to read CLOSE CALL, and whether
  WINS's stamp (0.16 s after the name) reads as one line or two beats, were judged from stills and
  timed checks in a headless browser that runs at about 5 fps during a boast.
- **The win is said twice, a second apart:** the plate's "<NAME> WINS", then the turn bar's
  "GAME OVER: <NAME> WINS" as the boast ends. Not wrong, but not designed together.
- **A close win's boast is 3.6 s,** past the 3.2 s cap a spec keeps to. Since session 40 the plan
  checker caps a plan too (the spec cap, or the still's, plus the 0.6 s close-call hold), so nothing
  can run longer than that by accident; whether 3.6 s is too long is still unjudged by a person.
- **A very long name on a phone** shrinks the whole line, WINS included, down to 11 px; there is no
  second line for the name. The longest recorded name ("Moth Protocol WINS") fits at 24 px.
- **CLOSE CALL's amber is a new colour** in the boast grammar, the same for every faction; it has
  not been checked against every faction's lit panel side by side.

## The loadout picker (boast slice 4, session 36)

- **It saves nowhere real.** No server endpoint for loadouts exists (game lane roadmap 2b step 3), so
  the page carries the real store's answer to every choice, computed when the page is built, and
  applies those. That is honest for one page view (a test drives 300 random choices per scenario
  through the page's model and the store and they end the same), but a reload forgets every change,
  and an answer that depends on time (a sale window closing, a match starting while the page is open)
  is frozen at build time. The page has to send the choice once the endpoint exists.
- **Card back, avatar and arena are empty slots with a sentence.** Nothing of those kinds exists in the
  catalogue, so three of the five slots have nothing to pick. Their explainers ("the back of this
  agent's cards", "the background behind the board in this agent's matches") are guesses at how
  they'll be drawn; which side's arena a match shows is undecided (asked in notes-for-owner).
- **No buying here.** A locked item says "In the store · 300 credits" but there is no store page to
  send the owner to; the store's purchase flow has no render yet.
- **The tile emblems are small hand-made SVGs,** one per boast (a crest, a spore column, a framed
  star, a block stack, a prompt, a skyline burst). A new boast without one falls back to a plain hex;
  the test only checks today's six have one.
- **The preview board is a sketch of a board,** not the replay's: plain faction-gradient cards with
  name, cost and stats (the sheet's style), no card art placeholder motif, no real HUD (just name and
  HP). On a phone it is about 330 px of an 800 px screen, sticky.
- **A scroll restarts the preview** rather than letting it follow the board, because the effects
  canvas plans in page pixels. Scrolling the list on a phone therefore cuts the boast short each time.
- **Nobody has watched it at full speed or heard it;** judged from stills and the browser check.

## Match Boot (slice 1, session 35; slice 2, sound and the phone, session 38)

- **Nobody has watched or heard it on a real device.** Session 38 measured the sound from the page's
  own output in a headless browser (every sound within 3 ms of its planned distance from the others,
  left and right equal, no clipping, the music silent until the end), but that proves timing and
  levels, not taste: whether the degauss hum reads as "two old monitors", whether the rare flourish is
  noticeable without being cute, and whether the music's fade-in after the saying feels like a start
  or a gap, are all unjudged.
- **The audio is timed against itself, not against the picture.** The scheduler ties the audio clock
  to the intro's clock at its first pass, and the check proves the sounds' spacing; nothing measures
  a sound against the frame it belongs to (the browser's output latency is unknown and varies by
  device; on Bluetooth headphones the sounds will land late against the picture).
- **The four key clicks under HANDSHAKE OK's chirp can't be told apart in the recording** (the chirp's
  2.1 kHz tone fills the same band); they are checked as queued at their times, not as heard.
- **A cold first Play could drop the power-on.** A sound whose time passed more than 120 ms before the
  context was running is dropped, not played late. In the browser the cold start (the phone run, no
  warm-up) queued all 27 sounds in time, but a slow device waking its audio could lose the thump.
- **The headless browser drops frames:** the power-on (a line, then the picture opening) shows in some
  recordings and not others; the stills' times drift by up to 0.25 s from screenshot latency. Timings
  are taken in the page, so the checks hold; the pictures are approximate.
- **The faction colour is faint on the screens:** the haze is 6% and the scanlines darken it; the colour
  reads mostly in the agent lines, the opening flash and the edge glow. Not changed in slice 2: on the
  phone stills the green, cyan, purple and orange screens are told apart, but a dim monitor may not.
- **No autoplay exists,** so "the page starting playback on its own" has nothing to hook yet; the intro
  lives in `play()` at move 0, so an autoplay that calls `play()` gets it.
- **No live match:** the intro plays on replays only; a live broadcast doesn't exist yet.
- **The agent lines use the system monospace** (as Boot Sequence does): a wider font is squeezed to fit.
  On a phone a squeezed line now breaks onto two rows (20 px for a typical name, about 13.5 px on one
  row before); a very long name still shrinks (a 40-character name: about 11 px on two rows in the
  sheet's zoomed phone scene). Landscape phones keep one row (the board is wide enough at 15 px).
- **The saying's backing is a plain dark box,** and the "chrome" is a flat white-to-steel gradient per
  dot, not a lit chrome material.
- **The saying is only stable while list 1 stands:** a test pins the list and eleven seed-to-saying
  picks, but nothing on the match record holds the saying; a list change needs the game lane first.

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
- **The cosmetics switch hides boasts only** (nothing else cosmetic is drawn), and only the spectator
  rule is wired into a page; the owner-page rule is a tested function with no page yet.
- **The match feed spoils the result:** its last line ("X wins") prints while the boast plays; only the
  turn bar waits (you kept this call).
- **The browser check's "lit" count includes the veil** (a dark fill is still non-transparent canvas),
  so its winner-side numbers measure the veil plus the pieces, not the pieces alone. With the early
  wash in Hive Burst and Data Cascade that is true from 0.5 s on.
- **Frame rate on Mythic-heavy boards:** the boast costs 2-7 fps under the headless CPU canvas, but the
  baselines on those boards are low (Shield Slam's replay 17 fps after the boast, Hive Burst's 26), set
  by the Mythic wards. Not measured on a real GPU.
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

- Real card art (the late owner-funded pass) and the 500-piece signature
  art pool (game lane first). The card centre is still a placeholder motif.
- Adaptive pacing driven by significance, for spoken commentary (owner
  2026-09-25), comes with stage 7.
- The website Music setting, menu music and the music widget belong to
  build-order steps 4-5.
