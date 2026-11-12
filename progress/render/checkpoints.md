# Render lane — checkpoints

The render lane's own checkpoint log (RENDER.md guardrail 4 — kept separate
from the shared `progress/checkpoints.md`). Newest at top, same convention
as the shared file. "AWAITING FEEDBACK" per DESIGN.md's non-blocking
checkpoint process: this flags and continues, never blocks.

---

## 2026-11-12 — The Stats page, with the season ladder inside it (session 68) — AWAITING FEEDBACK (five small calls)

The sidebar's Stats no longer says "waiting on the server". Try it: `npm run site-demo -w @ai-tcg/render --
--ladder`, sign in as nova, open Stats.

**What you'll see (top to bottom; on a wide window the left column is your rating and record, the right one today
and your recent results, the ladder across the foot):**
- **The filter:** "All agents", then each of your agents with its match count; and 7 / 30 / 90 days for the chart.
  Picking an agent asks the server for that agent's figures; the rating stays yours (one per owner) and the page
  says so.
- **The rating:** the tier badge, the rating with its ± and your rank ("#1 of 4"), the week's change, the bar to the
  next tier ("131 to Diamond"), and the rating chart over the days with the tier floors crossing it. Under the
  chart, one column per day on the same x: wins up in green, losses down in red, draws in violet on the wins.
- **The totals:** a win-rate ring, then matches, wins, losses, draws, best streak, the streak now, credits from
  matches, and the void ones (cancelled or abandoned) when there are any.
- **Win rate by your deck's faction, and against each faction:** all four, each with its % and W-L-D; older matches
  that kept no faction (before schema v24) counted apart, as the server counts them.
- **Today** (`today` from `GET /api/stats`, owner 2026-11-12): what you've earned today, the ring of credits from
  wins (65 of 90), the next win's and next loss's pay, rewarded wins (5/10), losses paid, the ticking reset clock.
- **Recent results:** the last 20 as pips; the newest 8 as rows (who, which faction, when, turns, credits, the
  rating change) with **Replay** where the match has one; "Show all 20".
- **Season ladder:** how the listed owners spread over the tiers (a stacked bar), the tier column with yours lit,
  and the whole public list (the top 100): rank, agent and owner, tier, rating ±, record, rated matches, last day
  played. Your row is lit; in placement it is added at the foot.

**Evidence:** `progress/render/evidence/stats-check-s68.txt` (**44 PASS, 0 FAIL**, the real owner API with the
ladder playing: every figure against `GET /api/stats` and `GET /api/ladder` read beside the page, under both agents
and 7 / 30 / 90 days; a match of Nova's ending shows on the open page with no reload; Replay opens and Close comes
back; the reset clock ticks; no sideways scroll on a phone). The two earlier runs are kept in
`stats-check-s68-first-runs.txt` (two real bugs found and fixed: the page never heard a match end; Replay was offered
for matches with no replay). Stills `v2-s68-stats-L.jpg`, `-L-top`, `-L-dark`, `-90-days`, `-replay`, `-phone`.
Render tests 1004 (+14); CI browser check 61 PASS; the site contract check: `GET /api/stats` now fits with `today`
typed (`site-contract-s68.txt`).

**Small calls (kept as built unless you say otherwise):**
1. **The ladder lives inside the Stats page** (roadmap render item 5 said "the ladder page, or the ladder inside the
   Stats page, the render lane's call at a checkpoint"): a section at the foot, not its own sidebar page. The
   sidebar stays as it is; the Ladder widget's arrow opens Stats.
2. **Recent results show the newest 8 rows** (all 20 as pips), with "Show all 20". At 20 rows the right column ran
   twice as long as the left.
3. **Replay only where the history says the match has one** (`hasReplay` from `GET /api/matches`, read beside the
   stats). Older matches without a replay say "No replay"; their logs are on Agent match.
4. **The day columns under the chart** count rated matches (the chart's own `wins`/`losses`/`draws`), so a cancel
   doesn't show there; it shows in the totals' void count.
5. **On a phone the ladder table drops** the record, rated matches, last day and the tier's name (the tier's colour
   diamond stays), so it fits without scrolling sideways; the full table is on a wider window.

**Next:** the game lane's turn; then render session 69, the render hardening pass (with Agent controls taking the
server's "Time's up" words, owner 2026-11-12); then the notifications bell, then Top rated and viewer counts on
Watch live.

---

## 2026-11-12 — Watch live at L: the live match on the arena, in the tile (session 67) — AWAITING FEEDBACK (four small calls)

The last widget on the brief's S/M/L table; the widgets' S/M/L pass is finished. Try it: `npm run site-demo -w
@ai-tcg/render -- --ladder`, sign in as nova, Customise on Home, add Watch live and set it to S, M and L.

**What you'll see:**
- **S:** the live score: the turn line on top, both agents with their health under it.
- **M:** + the owner and rating line, health bars, "Watch as" on a match that isn't yours, the other live matches.
- **L:** the live match playing on the real arena inside the tile (the same arena Full screen opens: the boards,
  the HUDs, the hands, every effect), with its score, "Watch as" and the other live matches beside it. Click the
  arena for Full screen. When the match ends the tile keeps it for its result and the winner's boast, says "Match
  over", then the next live match takes the tile. On a phone the tile shows the compact board instead.

**Evidence:** `progress/render/evidence/watch-arena-check-s67.txt` (**36 PASS, 0 FAIL**, the real owner API with the
ladder playing: the tile's arena is the server's live match and follows it; 33 s of Home's redraws without the
arena reloading; Full screen and Customise take it down and bring it back; the end held, then the next match). The
two earlier runs are kept in `watch-arena-check-s67-first-runs.txt` (a real bug found and fixed: the arena vanished
between ladder rounds; and Watch live at S, which overflowed its tile since session 50). Stills
`v2-s67-watch-S/M/L.jpg`, `-L-dark`, `-L-ended` (the boast in the tile), `-fullscreen`, `-phone`. Render tests 990
(+7); CI browser check 61 PASS.

**Small calls (kept as built unless you say otherwise):**
1. **One embedded arena per board.** Each is a whole arena page running; a second Watch live at L shows the compact
   board (it still counts as one of the two live boards).
2. **The tile is silent.** Sound and music never start in the tile, even after you click the page; Full screen has
   them as before.
3. **The end is held 20 seconds** (the result and the boast), then the next live match. Between rounds, when nothing
   else is live, the finished match stays until the hold ends.
4. **Watch live at S is the score alone:** no "Watch live" button (the tile's arrow opens the page); it didn't fit.

**Next:** the game lane's turn; then the Stats page, the ladder page and the notifications bell. Render hardening
pass due at 69.

---

## 2026-11-12 — Daily rewards, Showcase and Collection at S, M and L (session 66) — AWAITING FEEDBACK (four small calls)

Three more widgets on the brief's S/M/L table. Try it: `npm run site-demo -w @ai-tcg/render -- --ladder`, sign in
as nova, Customise on Home, add the three and set each to S, M and L.

**What you'll see:**
- **Daily rewards.** S: a ring filling with today's credits from wins ("65 of 90"; gold when full) and what the next
  win pays. M: + the row of today's rewards: the free daily pack with its **Claim** button underneath (or "Claimed"
  and the clock to the next one), then one node per paying win, sized by what it pays (the big 30, three 10s, six
  5s), ticked once won, the next one pulsing. L: + a ticking "Resets in 09:15:40 · midnight Sydney", rewarded wins
  as a bar (5/10), today's wins with their times and credits, losses and draws (and how many of them paid), the
  day's total.
- **Showcase.** The same cards, larger: S your best card beside its name and finish; M your best three; L your best
  six, each with its name and rarity · finish under it. A card lifts a little on hover.
- **Collection.** Already S/M/L (the ring / + the last pulls / + faction filters and every card held); checked
  against the server's numbers, nothing changed.

**Evidence:** `progress/render/evidence/widgets-check-s66.txt` (**36 PASS, 0 FAIL**, the real owner API with the
ladder playing: every number the server's; a claim from the widget; a ladder win reaching the ring without a
reload). The first run's 4 fails are kept and explained in `widgets-check-s66-first-run.txt` (two real phone
overflows, fixed; one wrong selector in the check). Stills `v2-s66-widgets-S/M/L.jpg`, `-L-dark`, `-phone`,
`v2-s66-daily-claimed.jpg`, `v2-s66-daily-after-win.jpg`. Render tests 983 (+11); CI browser check 61 PASS.

**Small calls (kept as built unless you say otherwise):**
1. **The free pack is the only button in the reward row.** Wins pay themselves when the match is recorded, so their
   nodes show progress, not a claim. Season 0 has no quests to claim (L says so once).
2. **Showcase shows fewer cards so it can draw them larger:** 1, 3 and 6 (was 1, 5 and 10). At S the card is a
   little smaller than before (it sits beside its name to fit the small tile); at M and L it's 1.5x and 2x.
3. **A win node's size is its place in the schedule, its label what the server paid.** They agree in normal play;
   see notes-for-owner (s66) for the one case in the demo where they didn't.
4. **On a phone the reward row puts the free pack on its own line**, the ten wins in one row under it, and the
   "no quests in Season 0" footnote is hidden to fit.

**Next:** the game lane's turn; then Watch live at L (the live match embedded in the tile), which completes the
widgets' S/M/L pass; then the Stats page, the ladder page and the bell. Render hardening pass due at 69.

---

## 2026-11-12 — Ladder, Rating & form and Notifications at S, M and L (session 65) — AWAITING FEEDBACK (four small calls)

The three widgets that still said "waits on the server" now draw the server's data, per the brief's rule for the
rest ("apply the S/M/L principle using only data they already show"). Try it: `npm run site-demo -w @ai-tcg/render
-- --ladder`, sign in as nova, Customise on Home, add the three and set each to S, M and L.

**What you'll see:**
- **Ladder.** S: a tier gem in the tier's colour, your rank ("#1 of 4"), your rating and a bar to the next tier.
  M: + "45 to Diamond", your record and ±RD, and four rows around you (yours highlighted). L: + a column of every
  tier with its floor (yours lit), the top 8, your neighbours when you're not in it, and a footnote on how the
  ladder rates. In placement (your first 5 rated matches) there's no rank or number, only "2/5 placed".
- **Rating & form.** S: the gem, your rating, the week's change ("−86 this week", green up, red down). M: + the
  last 30 days as a line (a dot on each day you played, green for a winning day, red for a losing one; dashed lines
  where it crosses a tier floor), the last ten results as W/L pips, your streak and best streak. L: + a bigger chart
  with its scale, twenty pips, a win-rate ring, credits from matches, win rate per deck faction as bars, the last 4.
- **Notifications.** S: a bell with the unread count and the latest one. M: + "24 unread", **Mark all read**, the
  latest four (unread ones tinted with a dot). L: + unread counts per kind, the latest eight, and a big pull's cards
  shown as cards. Each one links to its page (Store, Collection, Agent match). New ones arrive within 15 s.

**Evidence:** `progress/render/evidence/widgets-check-s65.txt` (**38 PASS, 0 FAIL**, the real owner API with the
ladder playing; the first run's 3 overflow fails kept in `widgets-check-s65-first-run.txt`), stills
`v2-s65-widgets-S/M/L.jpg`, `-L-dark`, `-phone`, `-notif-read`. Render tests 972 (+13); CI browser check 61 PASS.

**Small calls (kept as built unless you say otherwise):**
1. **Showing notifications doesn't mark them read; only Mark all read does.** The server leaves it to the website;
   marking on sight would clear the badge before you'd looked. The bell (item 1, not built yet) could mark what its
   panel shows when opened.
2. **Ladder M shows four rows around you, one line each** (agent name only; the owner names show at L), to fit M
   without scrolling.
3. **A streak of one shows "No streak"**, as My agent already does.
4. **The Rating & form chart reads the ladder too** (for the tier floors it draws); without it, the chart draws
   plain.

**Next:** the game lane's turn; then Daily rewards, Watch live at L, Showcase and Collection.

---

## 2026-11-12 — Render hardening pass (session 64) — AWAITING FEEDBACK (two small calls)

No new features. The two checks that had gone stale by design (the website's Store check from session 47 and the
Open 10 check from session 54) are rewritten for the tiles and the stops, and pass against the real owner API and
the real pack page (`site-check-s64.txt` 56 passed, `pack-bulk-check-s64.txt` 14 PASS).

**A bug the rewrite found, fixed:** in Open 10, pressing **Skip ahead while a pack was still tearing** (in the
moment before its cards were dealt) threw that pack away unseen, its Rares and better included, against your call
that Skip can't pass a stop. Now Skip pressed then lets that pack deal and stop as usual, and runs past only the
plain packs after it.

**Two small store fixes:** the claimed free pack tile now counts down on the same ticking clock as the top of the
Store ("Claimed today · the next in 12:15:14"), not a second "12 h 16 min" for the same moment; and after a buy or a
claim, keyboard focus stays on that tile instead of jumping to the top of the page.

**Small calls (kept as built unless you say otherwise):**
1. Skip pressed during a pack's tear **carries on with that pack** (if it holds a stop), then skips the plain packs
   after it. The alternative would be ignoring that press altogether.
2. The claimed tile's line reads **"Claimed today · the next in hh:mm:ss"** (the head's clock format), dropping the
   "(midnight Sydney)" it used to say, since the head says it once already.

**Next:** the game lane's turn; then the rest of the widgets' S/M/L pass.

---

## 2026-11-11 — The store layout, with the Store and Packs widgets at S, M and L — AWAITING FEEDBACK

The brief's section 2 (the store layout) and section 1's Store and Packs rows. Try it: `npm run site-demo -w
@ai-tcg/render`, sign in as nova, open **Store**; then on Home, Customise, and set the Store and Packs widgets to S,
M and L.

**What you'll see:**
- **The Store page as an item shop, in the current look.** At the top, your balance and **"Daily reset in
  20:36:57 · midnight Sydney"**, a clock that ticks each second to the server's reset time (at zero the store reads
  again, so the new day's free pack shows). Then **Packs**: three large tiles, **one featured** (two columns wide):
  the **free daily pack while one waits**, else the **10 packs**. Then **Cosmetics**: one tile per item on sale.
- **Every tile:** the art is the hero, on a deep plate in the product's colour: the **real pack** (the very pack the
  opening tears: its wrapper, plate, logo and emblem, drawn from the opening's own code and CSS), three fanned for the
  10 packs with a ×10 badge, the coin drawn by the coin painter, a boast's emblem (the loadout picker's) on a lit hex.
  The **price sits on the art with the credits icon** ("Free" for the daily pack); the **button is underneath**
  (Claim / Buy). Can't afford it: the button greys and says how many credits short. Owned: an OWNED ribbon, no
  price, and the owned item moves after the ones still on sale. Claimed today: the daily tile greys, says when the
  next comes in, and the 10 packs take the featured spot.
- Below the shop, unchanged in content: the packs waiting (now with the real pack and a big count), your agents'
  loadouts, recent openings.
- **Store widget:** S = the free pack, Claim and the clock; M = the three pack tiles with their buttons; L = the
  balance, the clock, the pack tiles and the cosmetics (the page's layout, smaller).
- **Packs widget:** S = the real pack with the count on it, the number, Open; M = a bigger pile, Open and Open 10,
  the pity counters as chips (gold when the next pack is sure to hold one); L = M plus your last two openings.

**Evidence:** `progress/render/evidence/store-check-s63.txt` (**36 PASS, 0 FAIL**, against the real owner API over a
real store: one featured tile and it's the daily pack; tiles of three sizes; every price equal to `GET /api/store`'s;
the credits icon on each; a button under every tile's art; the plate on every pack; the countdown equal to the
server's `resetsAt` and ticking; claim from the featured tile (the server counts it, the 10 packs become featured,
no credits spent); buy 1 pack from its tile (422 -> 322, one more waiting) and a coin-priced boast (Owned); every
unaffordable tile greyed with the exact shortfall; both widgets at S, M and L showing different things, the server's
numbers, nothing overflowing; one column on a phone with no sideways scroll; no requests out, no errors). Stills
`v2-s63-*.jpg` (the page light and dark, after the claim, after the buys, phone; the widgets at S, M, L). Tests
`render/test/siteShop.test.ts` (15).

**Calls you may want to overrule:**
1. **The featured tile:** the free daily pack while one waits, else the 10 packs (your brief's two examples). An
   alternative: always the 10 packs, with the daily pack a normal tile.
2. **The 1-to-10 stepper is gone from the Store page.** The brief's products are "1 pack, 10 packs"; buying 3 now
   takes three taps on 1 pack (the server still accepts 1 to 10 in one purchase). Say if you want the stepper back,
   on the 1 pack tile.
3. **10 packs costs exactly ten times one pack** (the store has no bundle price); the tile says "50 cards", not
   "best value".
4. **Owned cosmetics stay on the shelf** with an OWNED ribbon and move to the end, so you see everything on sale.
   The alternative is hiding them.
5. **The Packs widget no longer has Buy or the daily-pack line at M** (the brief's table: Open / Open 10 and the
   pity counters); buying is the Store widget's. Its L shows the last **two** openings (three overflowed the tile).
6. **The pity counters stay counts** ("7 since a Full Art"), not bars: the server sends the counts and whether the
   next pack is sure to hold one, not the thresholds, so a bar to the guarantee would need the game lane to send them.

**Next:** the rest of the widgets' S/M/L pass (Daily rewards, Watch live embedded at L, Showcase larger cards,
Collection, and Ladder, Rating & form and Notifications on their real data).

---

## 2026-11-10 — The pack opening ceremony, part 3b (Open 10's stops, the debug panel) — AWAITING FEEDBACK

The brief's section 3, supporting requirements, and its done-check ("the pack ceremony has been run through every
reveal kind using the debug panel, including Prototype and Open 10"): **met, in the headless browser** (on a GPU and
by ear it is still your feel check). Try it: open `render/output/pack-opening.html`, click **DEBUG** (bottom left),
pick a kind, then **Open one now** or **Open ten now**.

**What you'll see:**
- **The debug panel** (demo pages only; never on the website): "FORCE THE NEXT PACK" with ten kinds, Rare, Mythic,
  Foil, Full Art, Alt Art, Glitch, Gold, Secret, Prototype, Zero-Day. Arm one and the next pack you open, from
  anywhere on the page, has that kind as its best card; then it disarms. "Open ten now" makes it pack 1 of a ten.
  **Nothing is faked:** for each kind the demo found the first seed whose roll has that kind as its best card and
  opened it for real through the store, so the pack, its set bar and the ten around it are all real openings. The
  footer says "DEBUG: forced ..." on such a pack.
- **Open 10 stops.** Plain Commons and Uncommons still deal straight into the row. Every other card (a plain Rare
  or Mythic, every finish, a Prototype) now deals **face down with a glow** and the open waits on it: "Stop · tap to
  reveal". A tap plays that card's own build from the ladder right there in the row (the room dims, the back climbs
  its glow stages, the slow flip, the flash, shake, bass, motes and ward), the other cards stepping back while it
  builds. A big pull (Gold and above) still plays in the full one-pack stack, where its held cards stop the same way.
- **Auto** still tears, deals and moves on by itself at 1x/2x/4x, but **waits at every stop for your tap**, and
  each stop's build plays at its full 1x length at any speed. **Skip ahead** (was "Skip to summary") skips packs of
  plain cards only; pressed at a stop it just nudges the face-down card. A big pull inside Open 10 no longer has
  "Skip this pack".
- **A bug fixed:** a ten-pack open's second big pull (or the first big pull after another ten) skipped its builds:
  the page remembered the last stack's revealed cards. It affected the website's Open 10 too.

**Measured (headless, tapping as soon as the page allows):** a ten takes 36-45 s with no big pull, 50-62 s with one;
13-17 stops per ten (every pack has its Rare slot, so at least ten).

**Evidence:** `progress/render/evidence/pack-ceremony-check-s62.txt` (**90 PASS, 0 FAIL**: the panel; one pack of
every kind and one ten of every kind through the panel on desktop, every stop built and hit in order and none on a
snap; Auto at 4x waiting untouched 1.5 s at all 15 and 16 stops of two tens, big-pull stops included, and each
stop's hit no sooner than its 1x time; Skip at a stop; a phone with a forced Prototype pack and a forced Gold ten;
no requests, no errors, no sideways scroll). The first run, before the bug fix: `pack-ceremony-check-s62-before-fix.txt`
(87 PASS, 3 FAIL). Stills `v2-s62-*.jpg` (the panel armed, a row stop building and landed, Auto waiting at a stop).
Tests `render/test/packStops.test.ts` (14).

**Calls you may want to overrule:**
1. **What "stops" means:** the open halts on the card and waits for your tap, in Auto too; the reveal never plays by
   itself. The alternative is that Auto plays each stop's full build by itself without waiting. I chose the tap
   because the brief's principle is "nothing important auto-plays".
2. **A plain Rare is a stop.** The brief lists "every Rare"; every pack has a Rare slot, so a ten has at least ten
   stops (13-17 seen). If Open 10 feels slow, the cut is to stop from Mythic or Foil up and let a plain Rare deal
   face up with only its ward flare (one rule change: `isBulkStop`).
3. **Skip can't pass a stop.** It now skips only packs of plain cards, which in S0 never happens (every pack has a
   Rare), so in practice it moves you to the next stop. Renamed "Skip ahead". Say if you want a true "skip to the
   summary" for Open 10 anyway (it would break the brief's "still stops").
4. **A row stop builds in place**, at the row card's size (about half a single pack's card), not lifted to the
   centre. Only big pulls (Gold and above, the store's full reveals) get the full-size stack.
5. **The debug panel forces by real seeds, not by editing a card.** The trade-off: the forced pack is always the
   same pack per kind (e.g. the Prototype is always Recursive Construct, serial 1/250), and the page grows from
   515 KB to 1.28 MB with the twenty openings embedded.
6. **The panel is a small dashed tab, bottom left,** shown on the demo page only; there is no secret key or
   password (the demo pages are the owner's; the website never renders it, even if handed the data).

**Next:** the store layout (Fortnite-style placement, the current look) with the Store and Packs widgets. The pack
ceremony is now complete per the brief; what's left on it is your feel check on the Mac mini.

---

## 2026-11-10 — The pack opening ceremony, part 3a (the Prototype takeover, the afterglow, the set bar) — AWAITING FEEDBACK

The brief's section 3, beats 3 and 4. Try it: open `render/output/pack-opening.html` (or
`npm run pack-opening -w @ai-tcg/render`), sound on, open "Prototype" and tap through every card, then "Zero-Day",
then any other pack to see its summary.

**What you'll see:**
- **The Prototype takes the screen over.** The back climbs its four glow stages as before; then the stage goes
  black, the top bar fades back, a gold field blooms with slowly turning rays and "PROTOTYPE · RUN S0-P12" above
  it; the card turns over large in the middle; **"PROTOTYPE · S0" is stamped onto its number line**; the serial
  plate **counts up to its number** (1/250 here: one tick; a serial of 25 counts 1, 3, 5 ... 25 in at most 14
  ticks) and **slams down**: the flash, the shake, the bass, gold motes, the ward, sparks and a **brass fanfare**.
  The field holds a second, fades, and the card settles back into the stack.
- **The Zero-Day now builds first.** It climbs its four glow stages like every other held card, then its
  terminal takeover plays as before. It used to go straight to the terminal and hit at 4.0 s, sooner than a Gold
  (4.6 s); now the ladder is monotone all the way up. Tap to hit, measured on the page: Rare 1.1 s, Mythic 1.3 s,
  Foil 1.5 s, Full Art 2.5 s, Alt Art 3.0 s, Glitch 3.1 s, Gold 4.6 s, Secret 4.8 s, **Prototype 8.1 s, Zero-Day
  8.7 s**.
- **The afterglow tilt:** once a held card has landed, a mouse over it leans it towards the pointer (up to 11
  degrees, the shine following) with no press; moving off springs it back. Touch keeps hold-to-tilt.
- **The summary is a fan:** the pack's cards fly in one after another and fan out in an arc; **NEW stamps slam
  down** on each new card in turn (a stamp sound each); then the **set bar** appears at the count before the pack
  ("S0 base set 30/96") and **ticks up once per card new to the set**, each tick a semitone higher, ending on the
  binder's own count, with "+4 new to the set" (or "Nothing new for the set in this pack"). The card under the
  pointer (or focused by keyboard) lifts and its caption shows below; the best card's caption shows first. A click
  or Enter opens the full card as before. The buttons work at once: nothing in the afterglow blocks the owner.
- **On the website** the set bar is read from the binder right after the open; if that read fails, the opening
  plays without a bar.

**Evidence:** `progress/render/evidence/pack-ceremony-check-s61.txt` (**456 PASS, 0 FAIL**: all ten showcase packs
on desktop, three on a phone; session 60's checks on every card, now timed on each build's tap-to-hit, plus the
Prototype's field, marker, count, plate, fanfare and beat order, the Zero-Day's stages, the hover tilt, and every
summary's fan, stamps, ticks and bar), stills `v2-s61-proto-count-*.jpg` (the field, the card large, the marker
and plate stamped), `v2-s61-summary-*.jpg`; tests `render/test/packAfterglow.test.ts` (12: the takeovers on the
ladder, the beats, the serial count, the set bar over 300 real one-at-a-time openings against the store's binder
read before and after each, the afterglow plan, the page, the two new sounds). Session 58's check re-run 127 PASS,
the ten-pack check 12 PASS, CI browser check 61 PASS, `npm test` (render) 930 pass.

**Calls you may want to overrule:**
1. **Part 3 is split in two.** This is 3a (the takeover and the afterglow). **Open 10 stopping on every hit and
   the debug panel** are part 3b, the next render session. The brief's done-check (every reveal kind through the
   debug panel) waits on 3b.
2. **The Zero-Day keeps the glow build before its terminal** (above). The alternative was to shorten the
   Prototype's build so the Zero-Day's old 4 s still topped it, which would have put both under a Gold.
3. **How long the Prototype is:** 8.1 s from the tap to the slam (the 4.9 s build, then 3.2 s of takeover), plus
   1.8 s of field after. It's the longest moment in the game but the Zero-Day; say if it should be shorter (the
   count and the bloom are the easiest to trim).
4. **The marker reads the pack's own set code** ("PROTOTYPE · S0" now, "S1" next season), and the field's label
   names the run ("RUN S0-P12"), not the card.
5. **Tournament copies** never come out of a pack, so there is nothing to take over yet; a prize copy in the card
   viewer keeps its look. When prizes are granted in a reveal, they'll use the same takeover.
6. **The set bar counts the base set only** (the binder's "Base set", 96 places): secrets, Glitch and Gold have their
   own binder sections and are not on the bar. A Glitch or secret copy of a card never held before fills its base
   place too (the binder counts any finish), so it ticks the bar.
7. **The fan is for one pack only.** The ten-pack summary keeps its grid ("Best pulls" / "Everything else") with
   NEW badges, and has no set bar yet.
8. **The tilt on hover is mouse only** (11 degrees); a finger over a card is a press, so touch keeps hold-to-tilt.

**Next:** part 3b: Open 10 fast-forwards plain cards but stops for every Rare, Mythic, special finish and
Prototype; the owner-only debug panel (force the next pack's best card to any reveal kind). Then the store layout.

---

## 2026-11-09 — The pack opening ceremony, part 2 (the reveal escalation, the ward flare, the sound per step) — AWAITING FEEDBACK

Item 4 of your 2026-11-06 render order (the brief's section 3, beat 3). Try it: open
`render/output/pack-opening.html` (or `npm run pack-opening -w @ai-tcg/render`), sound on, open "No hit", then
"Gold", then "Prototype", and tap through every card.

**What you'll see:**
- **Plain Commons and Uncommons snap.** Every card now rises face down. A plain Common or Uncommon flips over by
  itself in 150 ms as it reaches the top, with a tick that sounds two semitones higher for each one in the pack.
  A tap is never blocked by a snap.
- **Everything else waits face down: every finish, and every plain Rare and Mythic.** On a tap the room dims, the
  rest of the sound drops (the build's own sounds stay up), and the card back climbs its **glow stages** in the
  tell's colours (teal, violet, amber, white-gold), an aura growing behind it and the back trembling harder each
  stage, a rising tone per stage, with a pause after each where it might stop (the last pause the longest). Then the
  flip (slower up the ladder), then the **hit**: a flash in the last stage's colour, the screen shakes, a bass hit,
  motes in the card's faction colour, and the **faction ward flares** behind the card as it lands (the Rare ward
  ring the board already uses; a Mythic gets it doubled, counter-rotating). Then the room comes back.
- **One ladder, each step longer and bigger:** snap < plain Rare < plain Mythic < Foil < Full Art < Alt Art < Glitch
  < Gold < Secret < Prototype < Zero-Day. Measured on the page, tap to hit: Rare 1.1 s, Mythic 1.3 s, Foil 1.5 s,
  Full Art 2.5 s, Glitch 3.1 s, Secret 4.8 s, Prototype 6.4 s. The glow stops on the card's own rung and never above
  it, so the back is honest like the backdrop. Each finish keeps its own reveal on top (the Glitch corruption, the
  Gold stars and sparks, the Secret callout, the Prototype stamp, the Zero-Day takeover, which now ends on the hit).

**Evidence:** `progress/render/evidence/pack-ceremony-check-s60.txt` (370 PASS, 0 FAIL: all ten showcase packs on
desktop, three on a phone, every card: snaps, dims, ducks, stages and their colours on the timeline, flash,
shake, motes, ward, risers and bass, the room coming back), stills `v2-s60-*.jpg` (a Secret's back at stage 3, the
Rare, Mythic, Gold and Prototype hits); tests `render/test/packBuild.test.ts` (the ladder pairwise, the timeline,
1,000 real openings, the sounds, the page) and the duck test in `soundFx.test.ts`; session 58's check re-run (127
PASS) and the ten-pack check (12 PASS) still pass.

**Calls you may want to overrule:**
1. **Where plain Rares and Mythics sit: below Foil.** The brief groups them with the special finishes; I put them at
   the bottom of the build (Rare, then Mythic, then Foil). So a plain Mythic builds a little less than a Foil
   Common. The alternative is rarity first (a plain Mythic above Foil); say if you want that.
2. **Every pack now has one build**, because every pack has a Rare slot. A No-hit pack ends on a short one (1.1 s:
   one teal stage, a small flash, a 2 px shake, a light bass). If that wears thin over many packs, the fix is to
   start the build at Mythic, or to let a plain Rare snap with only a ward flare.
3. **The glow stages are the tell's rungs**: 1 stage for a plain Rare or Mythic or a Foil, 2 for Full Art, Alt Art
   and Glitch, 3 for Gold and Secret, 4 for Prototype and Zero-Day. A Mythic in a finish builds half a step longer
   than the same finish at a lower rarity, never as long as the next finish.
4. **The ward follows the card, not the step:** a Rare flares its faction ring, a Mythic the ring doubled; a Foil
   Common or Uncommon and every Neutral card flare none (Neutral has no ward, as on the board). The Mythics' own
   unique wards (four exist) aren't used here yet; the doubled ring stands in for all Mythics.
5. **The numbers** (all proposed; every one is a function of the step): dim 0.28 to 0.78; the rest of the sound
   ducks to 45% at a Rare, 6% at the top; flash 0.22 to 1; shake 1 to 12 px; 16 to 186 motes; flips 0.38 to 1.5 s.
   A Gold Mythic's doubled ward is very large (it reaches the screen's edges at 1280 x 800); I liked it as the top
   end, but it is the first thing to shrink if it reads as too much.
6. **Old timings replaced:** the per-finish flip times from session 24 (Glitch 950 ms was longer than Gold 650 ms)
   gave way to the ladder's, so no finish ever builds shorter than one below it.

**Next:** part 3: the Prototype full-screen takeover with the serial and "PROTOTYPE · S1" stamped live, the
afterglow (the hit card tiltable, the fanned summary, NEW stamps slamming down, the set bar ticking up), Open 10
stopping on every Rare, Mythic, special finish and Prototype, and the owner-only debug panel.

---

## 2026-11-05 — The pack opening ceremony, part 1 (the backdrop tell, the tear, the burst); the time ring live — AWAITING FEEDBACK

Item 3 of your 2026-11-06 render order, plus the time ring wired to game session 76's allowance. Try it: open
`render/output/pack-opening.html` (or `npm run pack-opening -w @ai-tcg/render`), pick a pack and drag along the TEAR
strip; let go half way, then carry on.

**What you'll see:**
- **The pack:** bigger (up to 300 px wide, was 230), with a code-drawn foil plate behind the logo (a circuit field
  and the four faction marks around the emblem). The mouse over it leans it a little (5°) and the shine follows;
  holding it still tilts it fully, as before.
- **The backdrop:** a deep gradient behind the pack that slowly drifts and pulses. Its colour is the tell, one of
  five rungs: calm blue (plain), teal (Foil), violet (Full Art, Alt Art, Glitch), amber (Secret, Gold), rose-gold
  (Prototype, Zero-Day), each pulsing faster than the one below. On about one pack in four that holds more than a
  plain card it shows one rung **lower** (measured: 110 of 469 over 1,000 real openings). It never shows higher.
- **The tear:** the strip peels back from the cut and follows the cursor, a jagged foil head under it, light in the
  backdrop's colour leaking through the cut, foil scraps flying off. The rip sound is scrubbed to the drag's speed
  (silent when still, louder and brighter when fast). Let go part way and the tear holds ("The tear holds at 40%");
  pick it up anywhere on the strip and it carries on from there. A tap still tears the whole pack.
- **The burst:** when the tear finishes, light bursts from the cut in the **best card's own colour** (never lowered,
  so this is the truer, second tell), its faction's colour in the rim, a ring from Foil up, a screen flash, motes and
  a procedural whoomp, all bigger with the rung. The sparks still come only with a hit.
- **The time ring (Agent controls):** 15 / 30 / 60 start auto-play with that many minutes; +15 / +30 add while it
  runs; the ring drains, then "Finishing match", then "Done for today". Each refused button says why.

**Evidence:** `progress/render/evidence/pack-ceremony-check-s58.txt` (127 PASS: six packs, desktop and phone),
`site-check-s58.txt` (18 PASS, the time buttons on the real server), stills `v2-s58-*.jpg`; tests
`render/test/packTell.test.ts` (1,000 real openings), `render/test/siteTime.test.ts` (the ladder playing).

**Calls you may want to overrule:**
1. **The backdrop now hints at what's inside.** Your 2026-10-18 note said a pack "looks and behaves exactly the
   same whether or not it holds a hit"; the 2026-11-06 brief asks for a backdrop that hints. I read the brief as
   changing that rule for the backdrop only: the pack, its art, its tilt and its lean are still the same for every
   pack; only the backdrop and the light through the cut tell.
2. **Under-promise:** one rung lower on 1 pack in 4 above plain, never more than one rung, never over. Read from
   the opening's seed (so a replayed opening shows the same tell; nothing new is rolled).
3. **The five rungs and their colours** (above). Secret shares amber with Gold, Prototype shares with Zero-Day.
4. **The burst is never lowered** (only the backdrop under-promises), so the burst is where a hit is confirmed
   before the cards rise. Alternative: let the burst under-promise too, leaving the card back's glow (part 2) as
   the only honest tell.
5. **The wrapper always says "5 CARDS".** It used to print "6 CARDS" on a pack with a Prototype bonus card, which
   gave the bonus away before the tear. Fixed as a bug.
6. **Hover lean 5°**, desktop only (none on touch, none with reduced motion).
7. **A time preset pressed while time runs replaces the time left** (the server's rule), with no confirm; the
   button's tooltip says so.

**Next:** part 2: the reveal escalation across the reveal kinds (the room dims, the card back glows through stages
with pauses, the slow flip, flash, shake, bass hit and faction-colour particles), the faction ward flare, the
procedural sound per tier.

---

## 2026-11-05 — My agent and Agent controls (the Season 0 brief, section 1) — AWAITING FEEDBACK

Item 2 of your 2026-11-06 render order. Try it: `npm run site-demo -w @ai-tcg/render -- --ladder --speed 4`, sign
in as `nova` / `a long demo password`, Customise, and set My agent and Agent controls ("Live match" is now Agent
controls) to S, M and L.

**What you'll see:**
- **My agent:** S the portrait, name, status and the rating with its tier; M adds today's W/L, the streak ("3 wins
  in a row") and the deck's faction; L adds the rating trend (a line over the last 20 rated matches, with the
  change) and the last four matches with Replay.
- **Agent controls:** S the portrait inside the time ring, status, and Start / Stop (auto-play); M adds the
  personality dial, 15 / 30 / 60 minute buttons, the deck and "Go to match" (beside Stop while a match is live); L
  adds the deck switcher, the match history and +15 / +30.
- **The dial:** six notches, one per play style, the pointer turning to the chosen one; a click saves it. During a
  match it says "This match: Calculator. Rusher from the next match.", and the match keeps its style.
- **The time ring:** ready for every state in the brief (minutes left draining, "Finishing match", "Done for
  today"), tested, but the server has no allowance yet (game session 76). Until then it shows auto-play: a full
  ring "On", an empty grey "Off". The time buttons are drawn but disabled, with "Time limits arrive with the
  server's play-time allowance."

**Evidence:** `progress/render/evidence/site-check-s57.txt`: 37 browser checks over the real ladder, ALL PASS
(stills `v2-s57-size-S.jpg`, `v2-s57-size-M.jpg`, `v2-s57-size-L.jpg`, `v2-s57-dial-live.jpg`,
`v2-s57-stopped.jpg`). Tests +7 (render 882), including a real-ladder test that a dial change mid-match applies from
the next match. CI browser check 61/61.

**Decisions you may want to overrule:**
1. **Start / Stop is the auto-play switch** drawn as one button (Stop when on, Start when off). Nothing else in
   Season 0 starts an agent, so I didn't add a second control.
2. **The rating trend comes from `GET /api/rating`'s recent list (20 matches)**, which exists now, not the Stats
   data (game item 2e). It can switch when that lands. If you'd rather it wait for 2e, it's one line to hide.
3. **The streak:** wins or losses in a row from the history; an opponent's abandon is a win and yours a loss (as
   the rating counts them), cancels are skipped, a draw ends it, and a streak of one isn't shown ("No streak").
4. **In placement the rating shows "—" and "Placement"** rather than a number (the ladder ranks no one in
   placement either).
5. **The dial at M** shows the style's name and the next-match note; its one-line summary is on the notches'
   hover and shows in full at L (it didn't fit at M).
6. **The time buttons are shown, disabled, before the server has the allowance**, so the layout is the final one.
   I could hide them until then instead.
7. **The widget's id stays `live`** (the server's), so boards saved with Live match now show Agent controls. It no
   longer takes one of the two live boards.

**Next:** the pack opening ceremony, part 1 (your order, item 3). When game session 76 ships the allowance, a small
follow-up wires the ring and the time buttons.

---

## 2026-11-05 — The live arena slice: the signature card in full, the boast before the result, the 2× controls — AWAITING FEEDBACK

The slice you set after the second coin slice, with the 2× controls you added to it (2026-11-04). Try it: `npm
run site-demo -w @ai-tcg/render -- --ladder --speed 2`, sign in as `nova` / `a long demo password` (Rook is `rook`,
same password). Agent match shows the 2× control on Nova's live match; "Watch on the arena" opens it; Watch live
has the match with Static Widow, whose signature card now sits in its zone on the live board.

**What you'll see:**
- **The signature card live, as in a replay:** its zone (the card, "5 unplayed", how far it is out of reach), the
  signature unit with its printed keywords and rules text once played, its trigger lines in the feed, and exact
  hand costs while it is on the board (no more "?").
- **The boast before the result, live:** the winner's boast plays as the last move lands, then GAME OVER, the
  same order as a replay (before, live showed GAME OVER first and the boast about 8 s later, once the match was
  recorded).
- **The 2× vote:** on your own live match, under the scoreboard on Agent match and over the arena beside Close:
  - nobody asks: "2× needs you and Rook to agree." [Ask for 2×] (against the house: "Against the house, your ask
    alone makes it 2×.")
  - you asked: "You asked for 2×. Waiting on Rook." [Take back]
  - Rook asked: "Rook asks for 2×. It starts when you agree." [Agree to 2×]
  - both: "Playing at 2×: you and Rook agreed." [Back to 1×]; the arena's badge reads "LIVE · 2×" and it steps
    twice as fast while following live, so it keeps up instead of hurrying.
  - Watch live shows a small 2× pill on any match playing at 2×. Settings -> Play has "Ask for 2× in every match".

**Evidence:** `progress/render/evidence/site-check-s56.txt`: 26 browser checks over the real ladder, ALL PASS
(stills `v2-s56-signature.jpg`, `v2-s56-agent-match-2x.jpg`, `v2-s56-arena-2x.jpg`, `v2-s56-ended.jpg`). CI
browser check 61/61. Tests: every frame of six real matches with signature cards equals the replay's; every
signature card the menu can make (over 600) is rebuilt exactly; the vote's states over the real owner API; the
boast arrives with the last move, before the match is recorded. `npm test` all pass (render 875).

**Decisions you may want to overrule:**
1. **The buttons' words:** "Ask for 2×", "Take back", "Agree to 2×", "Back to 1×". "Agree to 2×" is the same
   request as "Ask for 2×" (the server counts both as an ask); it is worded for the owner being waited on.
2. **Where the control sits:** under the scoreboard on Agent match, and over the arena beside Close (owner's own
   match only). Spectators get a 2× pill, never a button. The Home Live match widget has none (Agent controls
   replaces it next).
3. **The arena steps twice as fast while following at 2×** (all its animations' holds halved, as the server
   halves its holds). Paused or scrubbing, your own speed setting applies.
4. **A signature card is rebuilt from the engine's menu by its rules text.** If a card ever has a line the menu
   doesn't (a wording change on the game lane), the live board falls back to the old drawing for that card (its
   numbers, hand costs marked "?") rather than guess. The zone itself is always drawn from the feed.
5. **Settings -> Play's switch is hidden for a house account** (the server ignores the house's setting).
6. **The demo's House Null agent is now generated with a signature card** (named Static Widow as before), so the
   demo shows a signature card live.

**Next:** My agent and Agent controls (your 2026-11-06 order, item 2): the S/M/L split, the personality dial, the
time ring once the play-time allowance is in.

---

## 2026-11-04 — The second coin slice: every Season 0 coin drawn, and the Coin line in the picker and the Store — AWAITING FEEDBACK

The slice you set after render 54. Try it: open `render/output/coin-sheet.html` (all six coins, still and
flipping), `render/output/loadout-picker.html` (the "Bought Neon Nickel" tab, then the Coin slot), or the site
demo (`npm run site-demo -w @ai-tcg/render`, `nova` / `a long demo password`, Store).

**The looks, as you approved them** (EFFECTS.md "The rest of Season 0's coins"; code-drawn placeholders):
- **Dial-Up Dime:** a dark round coin, a glowing green CRT-phosphor rim; its face a little screen with
  scanlines, the handshake's waveform turning to noise, a blinking cursor. Its spin warbles like a modem.
- **Neon Nickel:** a chrome octagon in two neon tubes (magenta outside, cyan inside), a neon bolt on its face;
  in the air it trails its neon outline. Its spin buzzes like a neon tube.
- **Platinum Coin** (your Gold look, as platinum): brushed platinum, a milled edge, a four-point star, "S0".
- **Diamond Coin:** an octagonal cut, a brilliant's facets each catching a different colour that runs as it
  spins and settles as it lands; "S0". A shimmering whir.
- **Mythic Coin:** dark violet with a gold rim, a slowly turning ring of ward ticks, a gold seal, "S0", and a
  bright sheen that sweeps across it every 2.4 s, landed or spinning. A shimmering whir.
- All six flip in Match Boot by the same grammar (centre piece, rises toward you, lands on the face it says);
  the coins with a glowing rim are drawn a little smaller so the glow stays clear of the agent lines.

**The Coin line** (the picker's sixth slot, on the website and the standalone page): each coin tile shows the
coin drawn; tapping one flips it over the preview board, landing design up (THEY GO FIRST) then on the agent's
portrait (YOU GO FIRST), in a loop, with its own sounds on a tap. An empty slot says (and previews) "flips
Chrome Token". Buy and Equip work as for boasts; a live match refuses a change. **The Store:** each agent's row
has "Coin: …", and the Cosmetics panel shows Dial-Up Dime and Neon Nickel drawn, at 300.

**On sale now:** the six coins are marked drawn in `economy/src/cosmetics.ts` (as session 33 did for the
boasts), so the game lane's Season 0 sale window opened: both store coins are on sale at 300. The tier coins
stay unsold (season rewards). `economy/test/cosmetics.test.ts` now checks every coin against the render's
`COIN_SPECS` (the check you asked of the game lane; done here because the drawn flag and the check must move
together, notes).

**Evidence:** `progress/render/evidence/coin-check-s55.txt`: 60 browser checks, ALL PASS (each coin flipped in
Match Boot by its own look with its own whir, drawn mid-spin and landed; the coin sheet; the picker's Coin
line on desktop, phone and reduced motion; the website's Store and picker over the real owner API; no errors,
no external requests). Sabotage (every coin forced to the fallback): 10 FAIL
(`coin-check-s55-sabotage.txt`). Stills `v2-s55-coin-sheet.jpg`, `v2-s55-boot-*.jpg` (six),
`v2-s55-picker-coin-slot.jpg`, `v2-s55-picker-dime-preview.jpg`, `v2-s55-picker-reduced.jpg`,
`v2-s55-picker-phone-*.jpg`, `v2-s55-site-store-coins.jpg`, `v2-s55-site-picker-coin.jpg`. CI browser check
61/61 (`ci-browser-check-s55.txt`). `npm test`: all six workspaces pass (render 852, +8); typecheck clean.
Every committed page rebuilt.

**Decisions you may want to overrule:**
1. **The tier coins carry a season mark ("S0") on their face.** You left Season 1's tier coins (a new look, or
   the same look with a season mark) to this lane: I propose the same look with the season's mark, so a
   Platinum coin always reads as Platinum and the seasons tell apart by the mark.
2. **Each coin has its own whir** (Dime: modem warble; Nickel: neon buzz; Diamond and Mythic: a shimmer;
   Chrome and Platinum: the plain metal whir). The flick and the clink are shared.
3. **Glowing rims are drawn about 10% smaller** in Match Boot so their glow keeps the same room from the agent
   lines as the Chrome Token's rim.
4. **The picker's coin preview alternates landings** (design up, then portrait up, each with its line) so an
   owner sees both faces; it flips over a dimmed preview board rather than a full Match Boot.
5. **The Store's agent rows say "Coin: <name>"**, and an empty slot "Empty: flips Chrome Token".
6. **Neon Nickel's trail** is three afterimages of its neon outline, 20 ms apart, only in the air.
7. **The demo picker gained a fourth tab** ("Bought Neon Nickel": an Aegis owner who earned 316 credits in 41
   real matches, bought it for 300 and wears it).

**Next render-lane slice:** the live arena reads the signature card in full and the live boast from the
session-72 feed, with the 2× controls you added to it (Ask for 2× and taking it back, who asks and who is
waited on, the arena at the agreed rate, the "Ask for 2× in every match" toggle in Settings → Play).

---

## 2026-11-03 — Live hands face up, and the coin flip in Match Boot (the first coin slice) — AWAITING FEEDBACK

Both halves of the slice you set after render 52. Try it: `npm run site-demo -w @ai-tcg/render -- --ladder
--speed 4`, sign in as `nova` / `a long demo password`, open Watch live, "Watch on the arena"; and for the
coin, open any replay and press Play from move 0.

**Live hands, face up** (your render-51 answer, option b):
- Each live hand is rebuilt in the engine's own order from the feed: a played card leaves at the position the
  move names (`handIndex`), every drawn card is added from its `draw` event. Each card shows at the cost the
  engine would charge (cost auras on the board included, worked out from the public board).
- **The opening hands can't be rebuilt from the feed:** they are dealt before the engine's log starts, so no
  event names them. Those cards show as card backs **in their places**, labelled "N from the opening hand,
  face down", until each is played (then it appears in the feed as played). Typically all are gone within the
  first few turns. A small game-lane ask would make every hand whole from move 0 (notes).
- If the rebuilt count ever disagreed with the server's count, that hand would go back to backs for the rest
  of the match rather than show a wrong card (tested by dropping a draw).

**The coin flip, as you approved it** (EFFECTS.md "The coin flip as built"):
- Match Boot now runs 3.4 s: HANDSHAKE OK goes at 1.5 s and the coin flicks up there, spinning; it lands at
  2.1 s with a clink and a chrome ring; a short pulse runs into the first player's half; the result line types
  under the coin at 2.2 s; at 2.4 s the coin goes and the saying slams in.
- The coin you see is the near player's: on your own match your agent's (**YOU GO FIRST** / **THEY GO
  FIRST**); as a spectator, the player you watch as (**<NAME> GOES FIRST**, the first player's name). Its faces
  are that player's portrait (their avatar in a ring of their faction colour) and the coin's design; portrait
  up means the near player goes first. "Watch as" changes the coin from the next intro.
- The **Chrome Token**: a polished silver hex, its design face an engraved inner hex with three traces from a
  centre node. Sounds: a flick, a slowing whir of metal ticks, a bell-like clink, dead centre; Skip cuts them.
- Reduced motion: the coin already landed with its line, then the saying (cuts, no motion), 1.3 s.

**Evidence:** `progress/render/evidence/coin-hands-check-s53.txt`: 29 browser checks, ALL PASS (coin drawn and
both faces seen mid-spin, the right face and line for p1 near, p2 near, your own match as p1 and p2; flick,
whir and clink queued once each, none late; ends at 3.4 s; the still at 1.3 s; Skip mid-spin; a phone; live
hands face up over the real ladder, backs only for opening cards and never coming back). Stills
`v2-s53-coin-spin.jpg`, `v2-s53-coin-landed.jpg`, `v2-s53-coin-you-go-first.jpg`, `v2-s53-coin-as-p2-pulse.jpg`,
`v2-s53-coin-still.jpg`, `v2-s53-coin-phone.jpg`, `v2-s53-coin-saying.jpg`, `v2-s53-live-hands.jpg`. CI
browser check 61/61 ALL PASS (`ci-check-s53.txt`). Render tests 843 (+14): every live hand equals the
engine's card for card in 8 real matches when the opening hands are given, and every face-up card equals it
without them (also over the real owner API against the recorded replay).

**Decisions you may want to overrule:**
1. **The coin "flicks up" toward you, not up the screen:** it grows to 1.3x and back while it spins, so it
   stays on the centre line and favours neither half (the intro's grammar). Alternative: a real upward arc
   into the top half and back.
2. **The result line sits under the coin**, the two as one block on the centre line; both go as the saying
   slams in at 2.4 s.
3. **The edge pulse** is a band of the first player's faction colour running from the centre edge of their
   half to its far edge (0.42 s), the half's own edge flaring as it leaves.
4. **Reduced motion is two cuts**: coin and line (0-0.6 s), then the saying (0.6-1.3 s), since both sit on
   the centre line. Alternative: both at once, the saying moved up.
5. **Live opening cards are backs in place**, labelled, until played, rather than waiting on the game lane.
   With the ask in the notes they would be face up from move 0.
6. **A live cost a signature card may change is marked "?"** (its abilities aren't in the live feed); only while
   a signature unit is in play on either side. With the signature-card ask already queued for the game lane it
   would be exact.
7. **A coin not drawn yet flips the Chrome Token** (the store and tier coins are the next coin slice); nobody
   can own one yet.

**Next render-lane slice:** the render hardening pass you set (no new features: the quality-debt list, the stale
session-25 and session-36 checks, the check-E flake). Then the second coin slice (the store and tier coins'
looks, the coin line in the picker and the Store).

---

## 2026-11-02 — The spectator point of view: "Watch as" on the website and the arena — AWAITING FEEDBACK

The point of view you approved after session 50, built as specified. Try it: `npm run site-demo -w
@ai-tcg/render -- --ladder --speed 4`, open http://127.0.0.1:8080/#/live, sign in as `nova` / `a long demo
password`.
- **"Watch as: <A> | <B>"** on every Watch live card for a match you don't play in, on the Watch live widget
  at M and L (its first match), and in the arena's top bar (replay or live). Never on your own agent's match:
  Agent match, the Live match widget, your history's replays and your own Watch live card always put your
  agent near, with no switch.
- **The default is the higher-rated agent** (the server's `defaultView`; p1 on a tie). The choice is kept per
  match for this browser tab only; a new tab or the next match starts from the default again.
- **The chosen player moves to the near side:** on the website, first (left) on the scoreboard and the top
  row of the compact board; on the arena, its units at the bottom, its HUD and hand on the left, its name
  first in the header. The momentum gauge mirrors with it.
- **A switch re-shows nothing:** the board flips on the move shown and playback goes on. If the Match Boot
  intro or a victory boast is playing, the switch waits (it shows that it's waiting) and flips the moment it
  ends; a tap on the switch doesn't skip the intro (it is treated like the playback buttons).
- **"Watch on the arena" opens with your choice**, and switching inside the arena carries back: on Close the
  card shows what you picked there.

**Evidence:** `progress/render/evidence/pov-check-s52.txt`: 48 browser checks, ALL PASS. The arena on its own
(rows, HUDs, hands, header and gauge flip; every row keeps its own player's cards; the boast plays on the
winner's side from either view with nothing lit past it; playback continues; the intro waits; a reload keeps
the choice, a new tab doesn't; a phone fits), and the website with the real ladder at 4x (defaultView
pressed on every other match's card, a tap flips the card, a reload keeps it, the arena opens with it and
hands a switch back, Nova's own match/arena/replay keep Nova near with no switch). Stills
`v2-s52-pov-*.jpg`, e.g. `v2-s52-pov-arena-as-p2.jpg`, `v2-s52-pov-end-as-p2.jpg` (the winner's boast on
the top side) and `v2-s52-pov-watch-live-switched.jpg`. The CI browser check still 61/61
(`ci-check-s52.txt`): the default view is unchanged. Render tests 829 (+6, `render/test/watchAs.test.ts`).

**Decisions you may want to overrule:**
1. **A switch during the intro or a boast waits for it to end**, rather than cutting it short or flipping the
   effects mid-flight (both are drawn on the sides where they started).
2. **A tap on "Watch as" doesn't skip the intro** (every other tap on the board does). It waits, as above.
3. **The momentum gauge mirrors with the view.** Its existing convention is kept for p1 near (p1 ahead fills
   to the right of centre); watching as p2, p2 ahead fills to the right. Alternative: always fill toward the
   leader's HUD (the near one is on the left), which would change how the gauge reads today.
4. **The Watch live widget shows the switch for its first match only** (M and L), not the one-line list of
   other matches under it; S has no switch (no room).
5. **A replay opened on its own (a committed `render/output` page) shows the switch and starts at p1**: the
   file has no ratings to pick the default by. It remembers the choice for the tab.
6. **A replay of a match you don't own isn't reachable from the site yet** (match history is your own), so the
   replay's switch is only seen on standalone pages and the live arena for now; it is built and tested for
   when a featured match can be watched again.

**Next render-lane slice:** hands live, face up (your answer to render 51: rebuild them from the feed's draw
events), together with the first coin slice (the flip in Match Boot, the Chrome Token, reduced motion and
sound), which the point of view now has a place for. A render hardening pass is overdue (last: session 40)
and should be the next session you leave unnamed.

---

## 2026-11-02 — The big live board: a live match on the arena — AWAITING FEEDBACK

The slice you named after session 50. Try it: `npm run site-demo -w @ai-tcg/render -- --ladder --speed 4`,
open http://127.0.0.1:8080/#/match, sign in as `nova` / `a long demo password`, and when Nova's match is
live press **Watch on the arena** (or on any card on Watch live).
- **The live match plays on the real arena, full screen:** the same page every replay uses (the board with
  each unit's live stats, keywords, tools, Barrier, arming, the stack and its aim lines, the effects, the
  feed, sound and music), fed move by move as the server releases them. The header says SPECTATOR LIVE and a
  **LIVE** badge sits where a replay shows its seed.
- **It follows the newest move.** Pause or step back and the badge says "LIVE · 9 behind"; tap it to go back
  to live. A burst of moves (or a tab left in the background) is caught up quickly instead of piling up.
- **Hands are card backs** with the count ("5 cards, face down"): the live feed sends counts, not cards.
- **The end:** GAME OVER on the last move, then the record's victory boast (the same one the replay plays)
  when the server records the match, a few seconds later; the badge says ENDED.

**Evidence:** `progress/render/evidence/site-check-s51.txt` (28 browser checks with the real ladder at 4x,
ALL PASS; stills `v2-s51-live-*.jpg`, e.g. `v2-s51-live-following.jpg`); render tests 823 (+21): eleven real matches converted from the server's own
live timeline equal the engine's own frames field by field, and over the real owner API a whole live match
read a few moves at a time equals the recorded replay of it, frame for frame.

**Decisions you may want to overrule:**
1. **The arena opens full screen from a button** ("Watch on the arena") on Agent match and on each Watch live
   card, as replays do; the scoreboard, compact board and play-by-play stay on the pages and the Home
   widgets. Alternative: the arena inline on Agent match.
2. **Joining mid-match starts at the newest move**, not the first; the scrubber goes back. Joining before the
   first move plays the Match Boot intro.
3. **Live, the result comes before the boast.** In a replay the boast plays, then GAME OVER lands. Live, the
   boast is only known when the server records the match (about 8 s after the last move), so GAME OVER lands
   at once and the boast plays when the record arrives. A small addition from the game lane would restore
   the replay's order (notes item 2).
4. **Catching up:** more than 3 moves behind live, the arena steps quickly (0.16 s a move); more than 12
   behind, it skips to the move before the newest and plays on. At 1x the server releases a move every
   1-9 s, so this only shows after a tab was hidden, or at demo speeds.
5. **Until a side shows a faction card, its colours are Neutral.** The live feed doesn't say the deck's
   faction (notes item 2 asks for it).
6. **The live page's saying (Match Boot) is seeded by the match id**, not the engine's seed: the live feed
   doesn't send the seed (it would let anyone replay the shuffle). Every viewer of that match sees the same
   saying; the replay of the same match may show a different one.

**Next render-lane slice:** the spectator point of view (approved after session 50) together with the first
coin slice (the flip in Match Boot, the Chrome Token, reduced motion and sound): both read `defaultView` and
the coins the game lane now serves.

---

## 2026-11-02 — The match pages: Agent match, Watch live, match history with full replays, auto-play — AWAITING FEEDBACK

The slice you named after session 49. Try it: `npm run site-demo -w @ai-tcg/render -- --ladder`, open
http://127.0.0.1:8080/#/match, sign in as `nova` / `a long demo password`. The demo runs the game lane's
real ladder (two house agents join Nova and Rook); `--speed 8` plays a match in under a minute.
- **Agent match:** your agent with the **auto-play switch**; **Live now**: your agent's match as a
  scoreboard (health, energy, hand and units, whose turn), its board by unit name and stats, and the
  **play-by-play** as moves come out, in agent names; **Match history**: every match with result, opponent,
  credits, rating change, turns, and **Replay** and **Log**.
- **Replay plays the real arena, full screen:** the same replay page as every sample replay (the board,
  the hand, the feed, the effects, the boast the match record says played), rebuilt move for move from the
  server's replay file. Close (or Esc on the website) goes back.
- **Watch live:** every match on show, each with its scoreboard, board and last plays.
- **Home:** Live match, Watch live and Match history widgets at S/M/L, and the switch on My agent.

**Evidence:** `progress/render/evidence/site-check-s50.txt` (40 browser checks with the ladder playing,
ALL PASS) and stills `v2-s50-match-*.jpg` (the arena replay of a real ladder match: `v2-s50-match-replay-end.jpg`);
render tests 802 (+10, over the real owner API and the live ladder: the play-by-play adds up to the match
log; the replay is the same match, every move).

**Decisions you may want to overrule:**
1. **Match history lives on Agent match** (under your agent and its live match), and the Match history
   widget's arrow opens it. It was pointed at Stats, which isn't built. Alternative: its own page, or Stats.
2. **Your agent is always on the near (left) side** of the scoreboard and board; a spectator sees the first
   player on the left. (The arena replay itself keeps the engine's sides for now; see notes item 2.)
3. **The live view is a scoreboard and a compact board, not the arena, this slice.** The arena needs whole
   frames (hands included); the live feed sends the public board and the engine's events. Making the arena
   play from the live feed is the next slice. Recorded matches already play in the arena.
4. **The play-by-play drops the log's bookkeeping** (priority passes, turn ends, instance ids) and says
   "X's ability triggers" where the log names an ability by its id. The full log is one tap away (Log).
5. **Replays are built on demand by the site host** with your token (nothing stored on disk, pages kept 10
   minutes); a replay file this engine can't rebuild says so instead of showing another match. This
   matters once cards change: your call 6 (versioned replays) is the game lane's next hardening pass.
6. **Escape inside a playing replay belongs to the arena** (it skips the intro and the boast, as everywhere
   else); Close leaves.

**Next render-lane slice:** the big live board (the arena fed from the live feed) on Agent match and Watch
live. The spectator point-of-view toggle waits on your answer to the proposal in notes-for-owner.

---

## 2026-11-02 — The loadout picker in the Store — AWAITING FEEDBACK

The slice you named after session 48. Try it: `npm run site-demo -w @ai-tcg/render`, open
http://127.0.0.1:8080/#/store, sign in as `nova` / `a long demo password`.
- **"Your agents' loadouts"** on the Store, under the packs waiting: each of your agents (the connected one
  first) with its victory boast and close-win boast, and **Change**.
- **Change opens the loadout picker you approved in session 36, full screen**, for that agent: the preview
  board, the five slots, every boast you own. **Equip saves to the server at once** and the page shows what
  the server now has; a refusal (a live match, a session that ended) shows the server's reason and saves
  nothing.
- **Buy inside the picker:** a boast on sale that you don't own shows **Buy · 300** when you can pay
  (otherwise the price and what you have). It asks with the website's own confirm, buys, and stays on the
  slot previewing it; Equip is still its own tap. What you buy is on every agent.
- Close or Esc goes back to the Store, which reads again and shows what you saved.

**Evidence:** `progress/render/evidence/site-check-s49.txt` (40 browser checks against the real owner API,
ALL PASS) and stills `v2-s49-loadout-*.jpg`; render tests 792 (+13, over the real API, incl. "the page's
state after each answer equals a fresh read" and the server's refusals).

**Decisions you may want to overrule:**
1. **Full screen over the website** (like pack opening), opened from a row per agent on the Store.
   Alternative: the picker inline on the Store page, or its own page in the sidebar.
2. **Buy inside the picker** (your session-36 call 3 said no Buy until the Store page existed; it exists
   now), with the confirm, then Equip as a second tap. Alternative: one "Buy and equip" button.
3. **When the site can't tell your deck's faction** (no deck built yet, no faction lock), the picker says
   "No deck built yet", and an empty victory-boast slot says what it would play instead of guessing. The
   preview board then wears your starting faction's colours and shows units you hold, not the deck's
   (the API doesn't list the deck's cards; asked of the game lane).
4. **Equip waits for the server** (the buttons grey out for the moment the call takes) and the page shows
   the server's whole loadout from the answer, never its own guess.
5. **Esc closes the picker** at any point (standalone, Esc only ended the preview's current pass).
6. **The picker keeps its dark terminal look** inside the glass website, as the pack opening keeps its own.

**Next render-lane slice:** the match pages (Watch live, the Live match widget, Match history, auto-play) on
the game lane's session 67 endpoints. The coin-skin plan's render half is in notes-for-owner, waiting on
you.

---

## 2026-11-02 — The Collection page: the wide binder and the card viewer — AWAITING FEEDBACK

The slice you named after session 47. Try it: `npm run site-demo -w @ai-tcg/render`, open
http://127.0.0.1:8080/#/collection, sign in as `nova` / `a long demo password`.
- **The binder** (your spec, Screens 5): every place in the set in its number order. A card you hold is its
  printed card face (the same face the pack opening draws, in the best finish you hold, with ×N and the
  finish named under it); a card you're missing is a numbered empty slot with its name. The summary on top:
  the set's completion ring, then Secrets, Glitch, Gold and Prototypes held of each total, copies, and your
  pack points.
- **Tabs Set, Secrets, Prototypes, Promos**, a faction filter, and All / Owned / Missing. Secrets holds the
  secret cards, then the Glitch versions, then the Gold versions. Prototypes shows the 15 runs with each
  run's size and how many were found. Promos says it waits on the server (signature cards and earned promos
  aren't in the collection API yet).
- **The card viewer** (click any place): the card big, tilting under the pointer; every copy you hold with
  its finish, where it came from and the Account-bound tag; the saved decks that use it; **Craft** for pack
  points; **Salvage** for pack points (pick how many, then a confirm that names any saved deck it would
  leave short). Arrow keys walk the cards; Esc closes.

**Evidence:** `progress/render/evidence/site-check-s48.txt` (40 browser checks against the real owner API,
ALL PASS: the server's counts, the filters, the tabs, the viewer and its keys, a missing Common crafted for
40 pp, a salvage that leaves a saved deck short, confirmed, and the server then reporting that deck
incomplete; the binder read again after an opening; 720 px; dark; reduce motion) and stills
`v2-s48-col-*.jpg`; render tests 779 (+21, incl. "Craft is offered exactly when the real store crafts").

**Decisions you may want to overrule:**
1. **Glitch and Gold sit under the Secrets tab** (as three blocks: secret cards, Glitch, Gold), keeping your
   four tabs. Alternative: a fifth "Glitch & Gold" tab.
2. **A held place shows the best finish you hold** (a Gold or Full Art copy shows as Gold or Full Art in the
   base set too, with the finish named under it). Secret illustrations stay in their own places.
3. **Missing places show the number and the card's name** (a checklist). Alternative: the number only.
4. **Salvage is in the viewer of a base-set place only** (the server salvages per card, and takes only
   extra standard pack copies); Glitch, Gold and Prototype places say they can't be crafted.
5. **The binder's finishes stand still; they move in the viewer** (dozens of moving shines next to the
   liquid background cost frames). Reduce motion: no tilt and no shine.
6. **Craft costs shown are read from the economy's config** (the store's own numbers), since the API
   doesn't send a craft price; the store still checks and its refusal is what shows if they ever differ.

**Next render-lane slice:** the loadout picker in the Store (it didn't fit this session), then the match
pages once the game lane serves live state and match history.

---

## 2026-11-01 — The Store page, and pack opening on the site — AWAITING FEEDBACK

The slice you named after session 46. Try it: `npm run site-demo -w @ai-tcg/render`, open
http://127.0.0.1:8080/, sign in as `nova` / `a long demo password`.
- **Open opens packs, full screen.** The top bar's Open, the Packs widget's Open and Open 10, and the
  Store's buttons open real packs on the server and play them with the pack opening you approved
  (sessions 24-30: every finish's reveal, the honest sparks, the ten-pack fan with Auto and Skip, the card
  viewer). It's the same page, in a frame over the whole website.
- **After a pack:** "Open another" and Done; after ten: "Open 10 more", "Open one pack" and Done. A
  button whose packs aren't there is greyed with the reason. Done, Close (top right, any time) or Esc (on
  the summary only) go back to where you were, with your credits, packs and widgets read again.
- **The Store page:** the Season 0 pack (price, pity, Buy 1 to 10 with the total and how many credits
  short), the free daily pack (what waits, when the next comes in, Claim), the packs waiting grouped by
  where they came from (each row opens its oldest), your last six openings' cards, and the cosmetics on
  sale.
- **"Claim free daily pack" works** on the Store page and the Store widget (your call 7 from session 46:
  greyed until the game lane's claim; it landed in session 65).
- **Sound in the opening is your account's Sound setting**, and muting it there saves to your account.

**Evidence:** `progress/render/evidence/site-check-s47.txt` (50 browser checks against the real owner
API, ALL PASS; every revealed card checked against the copies the server logged for that pack) and stills
`v2-s47-store-*.jpg` (the page light and dark, a sealed pack, a pack's summary, a ten-pack summary);
render tests 758 (+17).

**Decisions you may want to overrule:**
1. **The opening happens on the server first, then the show.** The cards are in your collection the moment
   you press Open; the reveal only shows them. So Close works at any time and loses nothing; a closed
   pack's cards are under "Recent openings". Alternative: none safe (the server must roll it).
2. **Esc closes only on the summary** (Close works any time), so a stray key never cuts a reveal short.
3. **Open (one) is the oldest pack waiting; each row in "Waiting to be opened" opens that kind's oldest**
   (a starter, a bought one, a free daily one). No per-pack list: they're all Season 0 packs.
4. **Buying is a 1-10 stepper and one Buy button** with the total, after a confirm (as on Home).
5. **Recent openings show the last six packs' cards**, with no "Watch again": the server's logged opening
   doesn't carry what the reveal needs (see notes-for-owner).
6. **Equipping cosmetics (the loadout picker) isn't on the Store page yet**: buying works; equipping comes
   next with the Collection slice, or its own.

**Next render-lane slice:** Collection's wide binder, and the loadout picker in the Store.

---

## 2026-11-01 — Home as the widget board, saved to your account — AWAITING FEEDBACK

Your Season 0 list, render item 3. Try it: `npm run site-demo -w @ai-tcg/render`, open
http://127.0.0.1:8080/, sign in as `nova` / `a long demo password`.
- **The board** (spec C): the 12-column grid, S (3x2), M (6x4), L wide (12x6) or tall (6x8). A new owner
  sees the recommended layout (the game lane's, with Store in the Tournament slot).
- **Customise:** the tiles jiggle; drag to move (or click a tile and use the arrow keys); S/M/L; "−" (or
  Delete) removes; + Add widget opens the gallery (one of each, Watch live twice, the limits the server
  sends); Background opens the picker; Recommended layout asks first. **Done saves the whole board to your
  account**; a reload or another browser shows it.
- **The empty state:** "Your board is empty" with Add widget and Use recommended layout.
- **At most two live boards**; a third live widget drops to the scoreboard with the note.
- **Narrow windows** stack the widgets in your order (6 columns, then one).
- **The widgets with data draw the server's numbers:** My agent; Packs (unopened count, the pity timers,
  Buy, which really buys after asking; Open goes to the Store page for now); Daily rewards (credits from
  wins against what the schedule can pay, rewarded wins, the reset at midnight Sydney); Collection (set
  completion, secrets, Prototypes, last 5 pulls; at L a binder with a faction filter); Showcase (your
  rarest finishes); Store (Buy 1, Buy 10; at L the cosmetics on sale, buyable). **Live match, Watch live,
  Ladder, Rating & form, Match history and Notifications say what they wait on** (match running) and show
  nothing made up.

**Evidence:** `progress/render/evidence/site-check-s46.txt` (38 browser checks against the real owner API,
ALL PASS; two mutants, each caught) and stills `v2-s46-board-*.jpg` (recommended, customise, gallery,
saved, live cap, empty, background, large in light and dark, narrow 1000 and 700); render tests 741 (+25).

**Decisions you may want to overrule:**
1. **Edits in Customise are held until Done** (as the API intends); leaving Home while customising saves
   too. "+ Add widget" outside Customise and the empty board's buttons save at once. Alternative: save
   every change as it happens.
2. **The Live board placeholder:** a Live match at M or L and a Watch live at L draw a striped "board
   here" panel until live matches are served, so the two-board limit can be seen and checked now.
3. **The cards in the Collection, Showcase and Packs widgets are mini placeholder faces** (faction colour,
   the card's own hue and pattern, a rarity gem, the finish named), not the full card frame.
4. **Showcase picks your rarest finishes first** (Zero-Day, Prototype, secret, Glitch, Gold, Alt Art,
   Full Art...), then rarity. Pinning cards waits for the Collection page.
5. **Wide windows pack densely** (a Small fills a hole, as the mockup does), so on a wide screen a Small
   can sit ahead of where it is in your order; narrow windows keep your order exactly (your spec's words).
6. **Daily rewards' bar ends at what wins can pay in a day** (90 credits on today's schedule, read from the
   server's schedule), not the old mockup's "~cap"; losses are listed beside it.
7. **The free daily pack isn't claimable yet:** Store's "Claim free daily pack" is greyed and Packs says
   it comes with its claim; the game lane builds the claim in session 65.

**One finding, measured, not changed (needs your eye on the Mac mini):** with the full board up, the
liquid background draws 16 fps in software WebGL here, against 25 with session 45's two panels. The cost
is the tiles' frosted glass (`backdrop-filter`): with it off, 24.7 fps; the blur radius makes no
difference. A GPU composites that blur cheaply, so the Mac may be fine; if it isn't smooth there, options
in `progress/render/notes-for-owner.md`. Session 45's own check now fails its 20 fps bar on this machine.

**Next render-lane slice:** the pages these endpoints feed: the Store page with pack opening on the site
(so Open opens packs), then Collection's wide binder.

## 2026-11-01 — The look: the liquid background and its picker, saved to your account — AWAITING FEEDBACK

Your Season 0 list, render item 2. Try it: `npm run site-demo -w @ai-tcg/render`, open
http://127.0.0.1:8080/, sign in as `nova` / `a long demo password`, then Settings -> Display.
- **The liquid background** (the mockup's shader and colours) behind the glass: Glacier by default; Ocean,
  Aurora, Sunset, Lavender, Graphite, each with a light and dark version that fade into each other over
  about a second; Plain black and Plain purple, which always draw dark.
- **The picker** in Settings -> Display: eight swatches. The background **and the theme save to your
  account** (your session-44 call 5): another browser opens with them.
- **The spec's performance and accessibility rules:** low resolution, at most about 30 fps, paused while
  the tab is hidden, while sign-in covers it and on a plain background (no frames drawn at all); reduce
  motion keeps it still; reduce transparency makes panels solid.
- **Also, since the endpoints arrived:** your display name on the account button and menu; Settings ->
  Admin for the house admin; credits, pack points and the Open button with its count in the top bar.

**Evidence:** `progress/render/evidence/site-check-s45.txt` (39 browser checks, ALL PASS) and stills
`v2-s45-site-home-*.jpg` (each colour), `-picker-light.jpg`, `-narrow-picker.jpg`, `-no-webgl-sunset.jpg`;
render tests 716 (+20).

**Decisions you may want to overrule:**
1. **On a slow machine the liquid lowers its own resolution** (0.3 -> 0.2 -> 0.14 of the window when it
   draws under 20 fps; never back up in that page). It's blurred, so the lower steps look nearly the same.
   Alternative: keep 0.3 and accept a slower liquid, or fall back to the still gradient instead.
2. **A plain background keeps your theme choice** (say Light) and draws dark only while it's chosen; going
   back to a liquid brings your Light back. Alternative: picking a plain background sets the theme to Dark.
3. **The Open button opens the Store page** (which says it waits on pack opening) until pack opening comes
   to the site. Alternative: hide the button until then.
4. **Admin is a section at the bottom of Settings**, shown only to the house admin, saying what it waits on.
   Alternative: its own sidebar entry.
5. **No sound or music controls yet:** the account stores them, but the site plays nothing. They come with
   the first page that plays sound (match viewing or pack opening).
6. **Without WebGL the background is a still gradient of the chosen colours**, not an error.

**Thin spots (in the debt list):** frame rate only measured in software WebGL (12 fps at 0.3, 24 at 0.14),
never on a real GPU; the skip hint isn't remembered yet (nothing in the site skips); no Customise ->
Background (comes with the widget board); the title screen still has no liquid or card fan.

**Next render-lane slice:** item 3, Home as the widget board. Its saved layout needs a game-lane endpoint.

## 2026-11-01 — The owner website, first slice — AWAITING FEEDBACK

Your Season 0 list, render item 1, begun. Try it: `npm run site-demo -w @ai-tcg/render`, open
http://127.0.0.1:8080/ and sign in as `nova` / `a long demo password` (a fresh demo database; every click
goes to the game lane's real owner API).
- **Sign-in**, then the **glass sidebar** (Home, Agent match, Watch live, Collection, Store, Tournament,
  Stats; Settings, Connect agent; the agent card at the bottom with its live status) and the **top bar**
  (title, theme, account with Sign out). Light and dark.
- **Settings -> Play works end to end:** who picks the deck, the faction lock, forcing a saved deck,
  each agent's play style, and "Rebuild now" with its job shown while it runs and summarised after.
- **Home** shows My agent and the Deck; **Connect agent** lists your agents.
- **The pages without data yet** (Collection, Store, Agent match, Watch live, Stats) say what they'll hold
  and which endpoint they wait on, rather than showing made-up numbers.
- **Your call 4 from session 43:** the intro's hint now says "or click the board · Esc" (mouse) and "or
  tap the board" (touch); boasts unchanged.

**Evidence:** `progress/render/evidence/site-check-s44.txt` (32 browser checks, ALL PASS) and stills
`v2-s44-site-signin.jpg`, `-home-light.jpg`, `-home-dark.jpg`, `-settings-building.jpg`,
`-settings-built.jpg`, `-settings-dark.jpg`, `-dialog.jpg`, `-narrow.jpg`; `ci-browser-check-s44.txt`
(61, ALL PASS); render tests 696 (+19).

**Decisions you may want to overrule:**
1. **Tournament in the sidebar: shown greyed with a "Soon" badge** (you asked for hidden or coming soon
   to be proposed). Clicking it says "Tournaments come after Season 0". Alternative: hide it until then.
2. **Pages without an endpoint say what they wait on** in plain words, instead of being hidden or showing
   sample data. Alternative: hide them from the sidebar until they work.
3. **A small host in the render lane serves the page and passes /api through** to the owner API, so the
   browser sees one origin. Alternative: the owner API serves the page itself (a game-lane change), and
   the host goes away. Either works on the Mac mini.
4. **Signed in for the life of the tab** (the token in the tab's session storage): a reload stays signed
   in, closing the tab doesn't keep it. Alternative: memory only (every reload signs in again), or longer.
5. **The theme isn't saved anywhere yet** (it resets on reload, System by default), because there's no
   account-settings endpoint; I didn't use browser storage, per your session-43 call 2.
6. **The title screen is trimmed for now:** the badge, logo, tagline and sign-in panel on the cosmic
   colours; the card fan, foil logo, stat tiles and ticker come with the look (item 2) and live data.

**Thin spots (in the debt list):** a still gradient, not the liquid background; no widgets beyond two
panels; no credits, pack points, notifications or auto-play in the bars (no endpoints); only judged in a
headless browser; the site's browser check is by hand, not in CI.

**Next render-lane slice:** item 2, the look: the liquid WebGL backgrounds and the picker.

## 2026-10-31 — The "tap to skip" hint — AWAITING FEEDBACK

The slice you set after render session 42. Open `render/output/boast-sheet.html` and press any Play, or
open a replay and press Play from the start.
- **Under every boast's and the intro's Skip button, one small line:** "or tap anywhere" on a touch
  screen, "or click anywhere · Esc" with a mouse. Right-aligned under the button, on a dark chip, 11 px
  on a desktop and 12 px on a phone. It fades with the button.
- **It never goes where it doesn't belong:** inside the winner's side for a boast (inside the board for
  the intro), clear of the name plate and the intro's lines. If it can't fit, it's left out and the
  button stays. On every real layout today it fits (all 30 sheet scenes, the replay on a desktop and a
  phone).
- **Once the viewer has skipped anything on the page, it isn't shown again** on that page. A jump or a
  restart doesn't count as a skip; neither does a boast that plays to its end.
- **Screen readers:** the button's label carries the words ("Skip, or tap anywhere").
- **The loadout picker** hides it with the Skip button, as before.

**Evidence:** `progress/render/evidence/ci-browser-check-s43.txt` (61 checks, ALL PASS; section E is
the hint's 20), the mutants (`-mutants.txt`: 4, 9 and 10 FAIL), and the stills
`v2-s43-hint-boast-desktop.jpg`, `-boast-phone.jpg`, `-intro-desktop.jpg`, `-intro-phone.jpg`. The CI
check now takes about 35 s locally (was 26 s). `npm test`: all six workspaces pass, render 677 (+15).

**Decisions you may want to overrule:**
1. **The words.** "or tap anywhere" / "or click anywhere · Esc", under the button, in lower case so it
   reads as the button's caption. Alternative: one line for both ("tap anywhere to skip"), or the words
   inside the button ("Skip ▸▸ · tap anywhere").
2. **Shown until the first skip, per page.** Not stored, so a new replay shows it again until the viewer
   skips there. Alternative: remember it in the browser (it would then never show again on that
   device), or, on the website, on the owner's account.
3. **Shown from the start of the boast or intro, for its whole length.** Alternative: fade it in after
   about 0.5 s and out after about 1.5 s, so it's gone by the time the name plate lands.
4. **"Click anywhere" for the intro too,** although a click on the playback controls does the control's
   job (pause, step) rather than skip, as built in session 35. Alternative: "click the board".
5. **Left out, not moved, when it doesn't fit.** Alternative: move it beside the button. Today no layout
   drops it.

**Thin spots (in the debt list):** not seen on a real screen; per-page memory only; the plate check in
CI covers 4 of the 30 scenes (the placement rule covers the rest by construction).

**Next render-lane slice:** your Season 0 list, item 1: the desktop website (the 2026-10-05 spec, as
trimmed), starting with the site layout and the full pages against `server/OWNER_API.md`.

---

## 2026-10-30 — One replay's end in the CI check; a pinned Chromium — AWAITING FEEDBACK

The slice you set after render session 41, with your call 2 change in the same slice.
- **The end of a real replay is now checked on every push (18 new checks, 41 in all).** Cortex vs Swarm
  seed 6, stepped into its lethal move on a desktop and a phone: the lethal flash, then the winner's
  boast (the Cortex starter, as the replay has no record), the result line held; the loser's side dimmed
  and left alone, the winner's panel lit, Skip on the winner's side; the lethal attack's smoke cleared
  off the loser's side as the boast starts, then nothing lit past the winner's side; "GAME OVER:
  Lookahead-Cortex WINS" lands as the boast ends. Escape mid-boast lands the result at once; a jump to the
  end shows it at once, with no boast.
- **It catches what it should:** with the loser's clear removed, the result hold removed or the lead
  after the lethal beat removed, it fails 2, 15 and 4 checks
  (`progress/render/evidence/ci-browser-check-s42-mutants.txt`).
- **A pinned Chromium each run:** the step downloads the Chromium that playwright-core 1.63.0 pins
  (Chromium 153.0.8010.12) into the runner's temp dir, so the image's Chrome or caches are never used.
  Still nothing in the repo's dependencies.
- **Time:** locally the check takes about 26 s (was 21 s). On CI: session 41's PR took 35 s for the step
  and 3 min 35 s for the whole run. This PR's own run (the download included) is written into the PR
  description once it finishes, since the PR merges itself when it goes green.

**Evidence:** `progress/render/evidence/ci-browser-check-s42.txt` (ALL PASS), the mutants above, and
`ci-browser-check-s42-load.txt` (6 of 6 pass with two checks at once). `npm test`: all six workspaces
pass, render 662 (+3).

**Decisions you may want to overrule:**
1. **The boast's lead is checked at half its length.** The boast waits 900 ms after the lethal beat;
   the check asks for at least 450 ms between the flash and the boast. Under load the flash lands late
   (down to about 610 ms measured), and a check at 800 ms failed there with nothing wrong. A boast that
   doesn't wait measures 0. Alternative: 800 ms, with a rare false red on a slow runner.
2. **The check keeps the effects' own clock to know when the loser's clear has finished.** On a slow
   machine the effects slow down rather than skip frames, so the 280 ms clear takes longer in real time
   and the lethal smoke lingers on the loser's side for a moment. I left the render as built (it's the
   effects' slow-motion, not a spill) and measure from when the clear really ends. Alternative: make
   the clear run on the wall clock so it always ends at 280 ms (a render change, its own slice).
3. **The system libraries come from the image, installed only if the browser can't start.** Installing
   them every run (`--with-deps`) adds an apt step that could itself fail on a mirror hiccup.
   Alternative: install them every run.
4. **The four end-of-replay runs go at once** (each its own page), to keep the step near 26 s locally.
   Alternative: one at a time (about 10 s more).

**Thin spots (in the debt list):** one replay, one boast, a plain win; the close win and the recorded
boasts on a real board are still by-hand; no audio in CI (as you kept it).

**Next render-lane slice:** none set. Candidates: a close win on a real board in the CI check; a "tap to
skip" hint; or the next item you name.

---

## 2026-10-30 — The CI browser check — AWAITING FEEDBACK

The slice you set after the session-40 hardening pass. Every push and PR now runs a headless-browser
check of the render, the last step of the `test` workflow.
- **What it checks (23 checks):** each of the six boasts, the winner below and above, draws nothing past
  the winner's side (the effects' top canvas read through the whole boast); a boast's and the intro's
  Skip at least 88 x 44 px on a phone, a boast's small on a desktop; and Cortex vs Swarm seed 6's intro:
  it plays from Play at move 0 with no layout problem, holds the music, ends by itself; Escape skips it
  and starts the music; a phone gets two rows and no sideways scroll; reduced motion gets the still. Any
  page error fails it too.
- **It checks this commit, not the committed pages:** it builds the boast sheet and the replay fresh from
  the source (`render/src/ciPages.ts`), so a source change that wasn't regenerated into `render/output/`
  is still caught.
- **It catches the bug that started this:** with session 40's halo clip and the phone Skip rule taken
  back out, it fails 8 checks (Shield Slam lights up to 893 pixels on the loser's own side with the winner
  above, a position session 40 didn't measure). `progress/render/evidence/ci-browser-check-s41-mutant.txt`.
- **Time:** locally the step takes about 21 s (pages 0.8 s, browser 20 s; three boasts play at once to
  keep it short; one at a time took 57 s). Installing playwright-core adds about 1-2 s. The test run on
  CI was 1 min 45 s to 2 min 45 s over the last 8 PRs; expected after: about 2 min 15 s to 3 min 30 s.
  The first CI run's real figure is read off this PR and goes in the next render session's log.
- **The auto-merge wait:** 5 minutes to 12 (72 polls, 10 s apart). It only waits as long as the checks
  take; the 12 is the ceiling before it gives up.

**Evidence:** `progress/render/evidence/ci-browser-check-s41.txt` (ALL PASS) and the mutant run above.
`render/test/ciPages.test.ts` (+3) pins the ids and hooks the check drives, so a rename fails in vitest
with a clear message instead of a browser timeout. `npm test`: all six workspaces pass, render 659.

**Decisions you may want to overrule:**
1. **No audio in CI.** The sound checks (queued on time, heard on time) stay by-hand session evidence:
   an audio clock on a shared runner is the likeliest source of a flaky red. Alternative: add the
   intro's "every sound queued, none late" check (one line, about 1 s).
2. **The runner's own Chrome, not a downloaded Chromium.** Faster (no download) and nothing added to the
   repo's dependencies; but Chrome updates with GitHub's image, so a Chrome change could turn it red
   with no code change. Alternative: download a pinned Chromium each run (about 20-30 s more).
3. **12 minutes for the auto-merge wait.** Generous against a 3-4 minute run, so a slow runner queue
   doesn't strand a green PR again. Alternative: 8 minutes.
4. **Three boasts at a time** to keep it near 20 s. Alternative: one at a time (about 57 s locally),
   which samples more frames on a slow runner.

**Thin spots (in the debt list):** most of the session checks (sound, the pack opening, the feed, the
narrow layouts) are still by hand; the real end of a replay (lethal hit, then the boast) isn't in it.

**Next render-lane slice:** none set. Candidates: one replay's end (the lethal beat and the boast) in
the CI check; a "tap to skip" hint; or the next item you name.

---

## 2026-10-28 — Hardening pass: the boast stays on the winner's side by construction; Skip on a phone — AWAITING FEEDBACK

No slice was set after session 39, and the lane had gone twenty sessions without a hardening pass, so
this session raised three debt items to bar. No new features. Open `render/output/boast-sheet.html` and
play Shield Slam; on a phone, any boast's Skip.
- **A boast no longer lights anything past the winner's side.** Each piece's soft halo reached past the
  box the grammar checker measured. The debt list said it had never shown on the loser's side; measured
  this session, it did: Shield Slam lit a few hundred pixels on the loser's side of the sheet, and Shield
  Slam, Hive Burst and Void Collapse lit pixels up to 19 px past the winner's side. Everything the boast
  draws itself is now clipped to the winner's side: 0 for all six boasts.
- **The loser's side is cleared by how far each particle reaches,** not only where its centre is, so a
  big smoke puff from the lethal hit centred just outside the loser's side no longer shows its edge
  through the boast.
- **Every boast's Skip is finger-sized on a touch screen** (at least 88 x 44 px, was 70 x 23), the same
  as the intro's (your session-38 call 7). Desktop unchanged.
- The grammar checker also caps a boast's length (3.2 s, plus the 0.6 s close-call hold on a close win).

**Evidence:** `progress/render/evidence/hardening-check-s40.mjs` (output `hardening-check-s40.txt`): 19
checks, ALL PASS, run twice, each against the page from before this session. Render tests 656 (+11), with
mutation checks (no clip fails 7 of 8 clip tests). The session-39 sound check and the session-38 intro
check re-run on the regenerated pages (see the log).

**Decisions you may want to overrule:**
1. **The halo is cut at the edge of the winner's side** rather than each piece being kept further in.
   The cut glow is faint, but along the midline it is a straight edge. Alternative: shrink or move the
   pieces near the edge so their halos fade out inside.
2. **The loser's clear also fades the winner's particles that reach the loser's side** (lethal-hit
   debris near the midline). Alternative: only particles centred on the loser's side, clipped instead.
3. **One Skip size rule for the intro and every boast** (touch screens only).

**Thin spots (in the debt list):** the clip's edge hasn't been looked at by a person; the boast's
shocks, flares and sparks are drawn by the shared effects layer and stay inside by the checker's
arithmetic, not a clip; the browser checks still don't run in CI.

---

## 2026-10-26 — The victory boasts' sounds on the audio clock — AWAITING FEEDBACK

The slice you set after Match Boot slice 2. Open any recorded replay in `render/output/` (for example
`recorded-boot-sequence.html`) with sound on and step into the last move, or play the scenes in
`boast-sheet.html`.
- **Every boast's sounds are queued on the audio clock** at their exact times, a little ahead, instead
  of being fired from the animation frames: the same scheduler the intro uses, now one piece of code for
  both. A slow or busy page no longer makes a plate's impact or a key click late or bunch two together.
- **The music's dip under the sting starts with the sting** on the same clock (it fired on the next
  frame before), and the small dips under other sounds land when the sound plays.
- **A skip cuts the sounds.** Escape, Skip, a tap, a jump or the cosmetics switch fades a boast's sounds
  out in 30 ms, the ringing ones and the queued ones, as the intro does. At its own end the sting still
  rings out over the result.
- Nothing else about how a boast looks or sounds changed: same sounds, same times, same panning by
  where they happen on the winner's side.

**Evidence:**
- **Browser check** (`progress/render/evidence/boast-check-s39.mjs`, output `boast-check-s39.txt`): 65
  checks, ALL PASS, run twice. Measured on the page's real audio output. Every sound of all six boasts
  queued at its planned time; the ones that stand out in the recording heard within 3 ms of the same
  sound played alone. On the four recorded replays, the same pages from before this session were 11-19
  ms off at the median and up to 49 ms; now 0. With the page stalled for 150 ms during Boot Sequence's
  typing, the old page's clicks were up to 122 ms late; now 0. Plus: a skip heard as silence, the sting
  ringing at the end, effects muted, reduced motion, the music's hold, the loadout picker.
- **Match Boot re-checked** after the shared scheduler moved: its 42 checks from session 38 all pass on
  the regenerated pages (`boot-check-s38-rerun-s39.txt`).
- **Tests:** render 645 (+33), with mutation checks (frame-fired sounds, a skip that doesn't cut, an end
  that cuts, a music hold that ignores its time: each caught).
- **Found and fixed on the way:** the loadout picker's previews would have gone silent (the page's
  sound filter didn't pass the new scheduler); and the music's dip would have come 150 ms before each
  sound.

**Decisions you may want to overrule:**
1. **A skip cuts a boast's sounds in 30 ms** (the sting included), the same as the intro. Before, a
   skipped boast's sounds rang on over the result. Alternative: let a skipped boast's last sound ring.
2. **At its own end the sting rings out** over the result line (unchanged).
3. **The boasts keep panning by where each sound happens** on the winner's side. The intro is dead
   centre (your call 5 for the intro). Alternative: boasts dead centre too.
4. **A sound more than 120 ms past its time when it could be queued is dropped**, never played late
   (switching sound on mid-boast, a hidden tab), as in the intro. Before, a boast's sounds played from
   the next frame on whenever sound came on.
5. **With effects muted the music is no longer held under the sting** (there is no sting to make room
   for). Before, the music dipped under a silent sting.

**Thin spots (in the debt list):** nobody has heard a boast on a real device; at the headless browser's
frame rate the old timing errors (about 10-20 ms) were small, so the fix matters most under a stall or on
a slow phone, which nobody has tried; the sound is timed against itself, not against the picture; most
overlapping sounds can't be timed apart in the recording (53 of 75 can), the rest are checked as queued.

---

## 2026-10-24 — Match Boot, slice 2: the sound and the phone — AWAITING FEEDBACK

The polish slice you set after slice 1. Open any replay in `render/output/` with sound on and press Play at
move 0; on a phone, `cortex-vs-swarm-seed6.html` shows the new two-row lines; `match-boot-sheet.html` has
the rare saying (`> SUDO FIGHT`) with its flourish and a long name on a phone.
- **The music starts after the intro** (your call 8 from slice 1). It is silent under the intro, nothing
  is queued, and it starts from the top of its progression as the intro ends, fading in over about a
  second. A skip, a pause or a jump brings it in at once. Music switched on during the intro waits for its
  end too.
- **Every intro sound is queued on the audio clock** at its exact time, a little ahead, instead of being
  fired from the animation frames. A dropped frame or a busy page no longer makes a key click late or
  merges two. Measured from the page's own audio output: every sound lands within 3 ms of its planned
  distance from the others, also with the page stalled for 100 ms mid-typing (slice 1, same stall: the
  clicks bunched and gapped, 1 of 16 intervals on time).
- **Dead centre:** the intro's sounds play at pan 0 (left and right measured equal to 0.01 dB).
- **A skip cuts them:** Escape, Skip, a tap, pause or a jump fades all the intro's sounds out in 30 ms (no
  click). At its own end the last chord rings out into the first move.
- **Its own power-on sound:** two tubes at once, a deeper thump and the low hum of a 90s monitor
  degaussing, under a crackle. Boot Sequence keeps its own tube sound, so the 300-credit boast stays
  distinct.
- **The rare saying is heard too:** `> SUDO FIGHT` adds a short "root access granted" over the hit: a
  glitch, then three blips climbing an octave.
- **The phone:** when one row squeezes an agent's line (under 15 px), it breaks after `LOADING AGENT:`
  onto two rows, both halves alike, typed as one line. On a phone in portrait a typical name now reads at
  20 px instead of about 13.5. Landscape and desktop keep one row. Skip is finger-sized (88 x 44 px) on a
  touch screen.

**Evidence:**
- **Browser check** (`progress/render/evidence/boot-check-s38.mjs`, output `boot-check-s38.txt`): 42
  checks, ALL PASS, run twice. It records the page's real audio (an AudioWorklet on the master bus), so
  it checks what is heard, not what the page meant to play: onsets, left/right balance, no clipping, the
  music silent then playing, silence after a pause, the stall before/after against slice 1's page, the
  rare flourish (+5.8 dB in its band against a plain saying). Plus the phone in portrait and landscape,
  the desktop, reduced motion, muted effects, and music switched on mid-intro.
- **Stills:** `v2-s38-phone-rows.jpg` (the two rows), `v2-s38-phone-saying.jpg`,
  `v2-s38-phone-landscape.jpg`, `v2-s38-desktop-lines.jpg`, `v2-s38-sheet-rare.jpg`,
  `v2-s38-sheet-phone-rows.jpg`.
- **Tests:** render 612 (+9). Mutation checks: ignoring the scheduled time fails 1 test; letting music
  queue under the intro fails 3; never breaking onto two rows fails 2.

**Decisions you may want to overrule:**
1. **The music starts from the top of its progression** when the intro ends, fading in over about a
   second (a 0.3 s time constant). Alternative: a quicker fade, or pick up mid-phrase.
2. **At its own end the intro's last sounds ring out** (the saying's chord tail overlaps the first move);
   only a skip, pause or jump cuts them. Alternative: cut at the end too.
3. **The intro's own power-on (a degauss hum)** instead of Boot Sequence's tube. Alternative: share the
   boast's sound (slice 1 did).
4. **The rare saying gets a sound of its own** (three blips climbing an octave, about 0.4 s). Alternative:
   rare in the words only.
5. **All intro sounds at pan 0,** dead centre, wherever the board sits in the window.
6. **Two rows on a phone** only when the board's width squeezes one row under 15 px and two rows come out
   at least a fifth bigger; up to 20 px. Alternative: always one row (slice 1), or two rows on every phone.
7. **Finger-sized Skip on touch screens only,** for the intro. The boasts' Skip is unchanged (it can
   follow in the same way).
8. **A sound that can't be queued in time is dropped, never played late** (more than 120 ms late: only
   when the audio is still waking up). The cold start on the phone run queued all 27 in time.

**Thin spots (in the debt list):** nobody has heard it on a real device or judged the hum, the flourish or
the music's fade-in by ear; the audio is checked against itself, not against the picture (device output
latency varies); the four clicks under the HANDSHAKE OK chirp can't be told apart in the recording; the
boasts still fire their sounds from the frames.

**Next render-lane slice:** none set. Suggested: move the boasts' sounds onto the same audio-clock
scheduling, or whatever you name.

---

## 2026-10-23 — The boast's win message: "<AGENT NAME> WINS", and CLOSE CALL first on a close win — AWAITING FEEDBACK

Your 2026-10-21 ask, built as its own small slice. Open any replay in `render/output/` and step onto the
last move (`>|`, then `<` and `>`), or `render/output/recorded-close-win.html` for a close win.
- **Every boast ends on "<AGENT NAME> WINS"** on its plate: the name in the boast's colour, then WINS
  in white, stamped in a beat after the name. All six boasts (the four starters, Boot Sequence, Dial-Up
  Fireworks) and any later one: it is the plate, not part of each boast's drawing.
- **The line under it is now just the boast's name** ("SHIELD SLAM"). "· VICTORY" is gone: WINS says it.
- **A close win:** the plate opens on **CLOSE CALL** alone (amber), holds 0.6 s, then swaps to
  "<AGENT NAME> WINS". Every other beat of the boast keeps its time, and the boast ends 0.6 s later
  (3.6 s instead of 3.0 s), so the winner's line stays up as long as in any other win.
- **Boot Sequence** types the whole line, "<NAME> WINS", behind its cursor (after CLOSE CALL on a
  close win).
- **Reduced motion:** the still shows the same thing, words only, no motion: CLOSE CALL, then the
  winner's line; 1.6 s on a close win, 1 s otherwise.
- **The grammar holds:** the plate is the same box as before, on the winner's side; it never touches
  the loser's. The loadout picker's close-win preview shows the new plate too.

**Evidence:**
- **Browser check** (`progress/render/evidence/boast-check-s37.mjs`, output `boast-check-s37.txt`):
  637 checks, ALL PASS, run twice. The four recorded replays (the close win also on a phone, in reduced
  motion, and skipped during CLOSE CALL), and every one of the six boasts forced as a plain win and as a
  close win. Each run: the line reads "<NAME> WINS", the name then WINS inside the plate with a visible
  space, WINS in its own colour; no VICTORY or CLOSE WIN anywhere; on a close win CLOSE CALL shows first
  and alone, the winner's line about 0.6 s later, and the result lands at about 3.6 s.
- **Stills:** `v2-s37-forced-aegis-shield-slam-d-name.jpg` (a plain win),
  `v2-s37-forced-aegis-shield-slam-close-c-close.jpg` then `-close-d-name.jpg` (a close win),
  `v2-s37-forced-boot-sequence-close-c-close.jpg` / `-d-name.jpg`, `v2-s37-rec-close-desktop-*.jpg`,
  `v2-s37-rec-close-phone-d-name.jpg`, `v2-s37-rec-close-reduced-still-close.jpg` / `-still-wins.jpg`,
  and the other boasts' `-d-name.jpg`.
- **Tests:** render 603 (+16): for every boast, a close win is the same boast with the close-call line
  and 0.6 s more (every other mark and piece unchanged), the grammar on every layout, the typed line's
  timing, the still. Mutation checks: not lengthening a close win fails 6 tests; dropping the close-call
  line fails 7; typing over CLOSE CALL fails 2.

**Found on the way (fixed):** the stamped WINS lost its space ("Lookahead-AegisWINS": an inline block
drops a leading space), and a long name on a phone shrank more than needed because WINS's stamp starts
scaled up. Both seen in the browser, fixed, and now checked.

**Decisions you may want to overrule:**
1. **CLOSE CALL, not CLOSE WIN** (your two wordings): "CLOSE WIN" followed by "<NAME> WINS" says win
   twice.
2. **A close win's boast runs 0.6 s longer** (3.6 s) so the winner's line holds as long as in any
   other win. Alternative: keep 3.0 s and show CLOSE CALL earlier, over the boast's own beats.
3. **CLOSE CALL holds 0.6 s alone,** then swaps to the winner's line in the same place. Alternative:
   both lines at once, CLOSE CALL above.
4. **CLOSE CALL is amber** (a warning colour, on the winner's side, the same for every faction).
   Alternative: white-chrome, or the boast's own colour.
5. **WINS is white,** the name keeps the boast's colour, and WINS stamps in 0.16 s after the name.
   Alternative: the whole line in the boast's colour.
6. **"· VICTORY" is dropped;** the small line under the name is just the boast's name. Alternative:
   drop the small line too, or keep "· VICTORY".
7. **A long name shrinks the whole line,** WINS included, to fit the plate (no second line).
8. **The reduced-motion still swaps the words too** (CLOSE CALL, then the winner's line, no motion),
   1.6 s on a close win.

**Thin spots (in the debt list):** nobody has seen it at full speed or judged whether 0.6 s of CLOSE
CALL is long enough to read; the turn bar's own "wins" line still lands after the boast, so the
win is now said twice, a second apart.

**Next render-lane slice:** Match Boot slice 2 (sound and the phone), as you set.

---

## 2026-10-20 — Victory boasts, slice 4: the loadout picker — AWAITING FEEDBACK

Open `render/output/loadout-picker.html`. It is the owner page where an owner dresses one agent, built
from three real store states (tabs at the top): **A new owner** (Null, starter collection only),
**Bought Boot Sequence** (a Cortex owner that earned 303 credits in 34 real matches, bought it and wears
it, with Data Cascade as its close-win boast) and **In a live match** (Swarm).
- **The five slots** the store keeps, as a rail: victory boast, close-win boast, card back, avatar,
  arena. Each says what's equipped, or what an empty slot plays ("Empty: plays Void Collapse").
- **The tiles:** each owned item (free starter, or marked Bought), each item on sale that the owner
  doesn't have as a locked plate ("In the store · 300 credits", and "you have 0" when it's short), and
  the empty slot. Each boast has a small emblem of how it ends.
- **The preview:** a small winning board, the agent's deck's real units and its panel, a dimmed strip
  for the other agent. It plays whichever boast a win would play, with the replay's own boast player,
  and loops. A tap on a tile previews that one; a tap on a locked one previews it marked "not owned:
  preview only". The close-win slot previews with the CLOSE WIN plate and the panel on 3 health.
- **Equip saves at once,** with a line saying what was saved, or the store's refusal. In a live match a
  red banner says changes wait until it ends, and Equip shows "Not saved: no loadout changes during a
  live match".
- **The page never decides what the store accepts.** No server endpoint for loadouts exists yet, so
  when the page is built every choice in every slot is put to the real store's `setLoadout`, the answer
  kept (the new value or the refusal), and the slot put back; Equip applies that answer.

**Evidence:**
- `progress/render/evidence/loadout-picker-s36.txt`: each scenario, every tile and every store answer.
- **Browser check** (`loadout-check-s36.mjs`, output `loadout-check-s36.txt`): 48 checks, ALL PASS:
  preview on open with no grammar problem, loops, silent repeats; tap to preview, Equip to save; the
  locked plate; the close-win plate; emptying a slot; the empty kinds; the bought and live owners;
  Escape; a phone (no sideways scroll, the board stays at the top, the boast on the board after a
  scroll); reduced motion.
- **Stills:** `v2-s36-loadout-desk-new.jpg`, `-equipped`, `-locked-preview`, `-closewin`, `-cardback`,
  `-bought`, `-live`, `v2-s36-loadout-phone-top.jpg`, `-phone-scrolled`, `v2-s36-loadout-reduced-still.jpg`.
- **Tests:** render 587 (+13), incl. the preview against the store's own choice over 16 real recorded
  matches, and 300 random choices per scenario through the page and the real store ending the same.

**Decisions you may want to overrule:**
1. **Equip saves straight away,** one slot at a time (as the store's call works). Alternative: pick
   freely, then one Save button for all slots.
2. **The preview loops silently;** a sting plays only on a pass you asked for (a tap on an item, a slot
   or Replay). Alternative: silent always, or every loop with sound.
3. **An item you don't own can be previewed,** marked "not owned: preview only", and there is no Buy
   button here (the store page isn't built). Alternative: no preview of unowned items; or a Buy button.
4. **Only items on sale show as locked.** A retired season item you don't own isn't shown at all.
   Alternative: show it as "retired" so owners see what they missed.
5. **Card back, avatar and arena are shown, empty,** with a sentence saying none exist yet, rather than
   hidden until the first ships.
6. **The empty tile is offered in both boast slots** (the store allows it): an empty victory boast plays
   the deck's faction starter; an empty close-win boast plays the victory boast.
7. **The preview board sticks to the top** (on a phone and a narrow screen), and a scroll restarts the
   running boast (the effects are drawn in page pixels, so they can't follow a scroll mid-pass).
8. **In a live match Equip stays clickable** and shows the store's refusal, under the banner.
   Alternative: grey every Equip out.

**Thin spots (in the debt list):** a reload forgets changes (nothing saves to a server yet); three of
the five slots have nothing to pick; no buying; the preview board is a sketch, not the replay's board;
nobody has watched or heard it at full speed.

**Next render-lane slice:** Match Boot slice 2 (sound and the phone), as you set.

---

## 2026-10-19 — Match Boot, slice 1: the intro at the start of every match, and the two end-of-match fixes — AWAITING FEEDBACK

Every replay now opens with Match Boot when it plays from its first move. Open any replay in
`render/output/` and press Play (or space) at move 0; `render/output/match-boot-sheet.html` shows all
nine sayings (a Play button on each, or "Play all in turn").
- **The beats, 2.6 s:** the board goes dark; both halves power on together like CRTs, each in its own
  faction's colour (a line along the half's middle, the picture opening from it, a flicker, scanlines),
  one tube thump; each half types `LOADING AGENT: <name> [<FACTION>]` at the same time and speed (the
  shorter line padded so both cursors stop together); `HANDSHAKE OK` types on the centre line in
  white-chrome with a two-tone chirp; at 1.6 s a white line runs out from the centre and the saying slams
  in across it in the dot font, with a hit and a rising chord, while both agent lines lift away from the
  centre and fade; the saying swells and fades as the screens go, and the first move plays at once.
- **The saying** comes from the match's seed: one of eight, equally likely, or `> SUDO FIGHT` for 1 seed
  in 100 (measured: 1.02% of 200,000 seeds). Every viewer and every replay of a match sees the same one.
  The list is frozen as list 1, pinned by a test.
- **When:** Play at move 0, or Play at the end (it replays from the start). Not on page open, a step, a
  jump, the scrubber or a resume mid-match. A tap, Escape or Skip starts the first move at once; pause
  stops it and stays on move 0. The Cosmetics switch doesn't touch it.
- **Reduced motion:** a 1 s still (both screens lit, both lines, the saying, HANDSHAKE OK under it).
- **The grammar is checked in code** (EFFECTS.md's new "intro" category, symmetric and centre-out): the
  two halves mirror images in place, size and time; anything moving in a half moves away from the centre;
  the saying and HANDSHAKE OK centred; every sound panned to the centre. Tested on desktop, phone, uneven
  and gapless layouts for every saying and faction pair; the page checks each plan before it plays it.

**The two end-of-match fixes:**
- The gauge reads the result once the match is won: full toward the winner, "<loser> out of health". It
  had read the loser ahead at the end of the close-win replay, and of `aegis-vs-cortex-seed1` too.
- Whatever the lethal beat leaves on the loser's side (smoke, scorch, sparks) fades out in 0.28 s as the
  boast starts. Measured in the browser: 167-183 particles there after the lethal hit, none from 0.41 s
  into the boast, on a win from below and a win from above.

**Evidence:**
- **Browser check** (`boot-check-s35.mjs`, output `boot-check-s35.txt`): 53 checks, ALL PASS. The seed's
  saying and both agents' lines on a real replay; ends on its own at 2,601 ms and move 1 shows 0-300 ms
  later; Escape, Skip and a phone tap; pause; no intro on open/step/resume; |< and Play; Play at the end;
  the reduced still (1,015 ms); Cosmetics off; a phone (scrolled into view, inside the width); the two
  end-of-match fixes; every sheet scene.
- **Recording** `v2-s35-boot-desktop.webm`; stills `v2-s35-boot-desktop-*.jpg` (the power-on strip, the
  typing strip, the handshake, the saying, the outro), `v2-s35-boot-phone-*.jpg`,
  `v2-s35-boot-reduced-still.jpg`, `v2-s35-sheet-*.jpg` (all nine sayings, the phone scenes, the still),
  `v2-s35-end-*-boast.jpg` (the loser's side clean under the boast, the gauge on the winner).
- **Tests:** render 574 (+17): list 1 and its pinned picks, the 1-in-100 rate within 4 sd over 100,000
  seeds, no saying a card name, the grammar on every layout and the checker catching nine kinds of
  break, the still, the two sounds (the same for every faction), the page's wiring; the gauge at a win.

**Decisions you may want to overrule:**
1. **The saying swells (8%) and fades at the end** rather than fading upward, as my plan said: a centre
   piece moving up would drift into the top half. Alternative: fade upward a few pixels.
2. **The shorter agent line is padded with blanks,** so its cursor runs on through empty space until both
   stop together. Alternative: centre each line in its half (the cursors then stop at different places but
   at the same time).
3. **A tap on the playback controls doesn't skip:** pause stops the intro and stays on move 0; a step or a
   jump goes past it. A tap anywhere else skips. Alternative: any tap skips (as the boasts do).
4. **The still puts HANDSHAKE OK under the saying** (the saying fills the centre line), and drops it when
   it would reach the bottom agent's line (a very short board).
5. **The gauge at a win jumps to full toward the winner** with "<loser> out of health" (or "<winner> won
   the match" for a turn-cap win). Alternative: keep the board read, but never let it favour the loser.
6. **Play at the end now replays from move 0 with the intro.** (Before, it jumped to move 0 without
   redrawing it, so the first step animated from the final board; fixed on the way.)
7. **Three sayings share a word with a card** (OVERCLOCK with Overclock Shunt and Overclock Beast, BREACH
   with Breach Charge, ACCESS GRANTED with Root Access). None is a card name, and they are your list, so
   they stay; the test refuses only a saying that is, or contains, a whole card name.
8. **The music is held down under the intro, not silent:** Play is usually the first gesture, so the
   music starts then, at 55% until the intro ends. A true "music starts after" would wait to start it;
   that fits slice 2 (sound polish).

**Thin spots (in the debt list):** nobody has watched or heard it at full speed; the headless browser
drops frames, so the power-on beat shows in one of the two recordings only; the page has no autoplay
yet, so "the page starting playback on its own" has nothing to hook; the screens' faction haze is faint
(the colour reads mostly in the agent lines and the opening flash).

**Next render-lane slice:** boast slice 4 (the loadout picker), as you set; Match Boot slice 2 (sound and
the phone) after your notes on this one.

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
