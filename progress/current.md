# Current status

**Season 0 is running (owner 2026-11-22: launched early on Sun 22 Nov 08:09 Sydney on the Mac mini from main at 89abe46; five bots; it ends by itself at 00:00 27 Dec Sydney; the Mac mini is not updated mid-season unless something breaks). The scheduled sessions run the render lane only, on the owner's Season 1 plan, all in `render/season1/`. Phase 1: render 82 the Home tile audit and spec; 83 mockup A; 84 mockups B and C; the owner picked **B on a uniform grid** (2026-11-23); 85 the flash check and the pack-opening storyboard (four calls waiting in the render checkpoints). **Render session 86 started phase 2:** the S / M / L framework on one square unit (`render/season1/src/homeGrid.ts`: S 1x1, M 2x1, L 2x2; Watch live S 1x1, M 1x2, L two units by the rows its whole 9:16 arena needs) and B's top bar, light by default (`src/homePage.ts` -> `output/home.html`); the browser check `ci/home-grid-check.mjs` (100 PASS) and its fit table (107 of 166 tile renders fit their fixed box; the rest is phase 2's tiles in groups); mockups A and C retired (stills kept). Five small calls at an owner check-in (`progress/render/checkpoints.md`).**

**Render session 87 (the hardening pass, 2026-11-26):** Watch live's surround is now the dashboard's glass (owner
2026-11-25, point 11); Edit board's buttons sit in a bar over the tile's foot so every header keeps its name; the
dark My agent tile's text is light (5.3:1 lowest); Store M's markup holds only its two cosmetics; PR #196's spill
and empty-band measures in the grid check (`fill.txt`). `progress/render/evidence/season1-home-grid-s87/` 133 PASS,
0 FAIL (main's page: 30 FAIL); fit.txt still 107 of 166.

**Render session 88 (the agent tile, phase 2's tiles in groups, group 1, 2026-11-27):** My agent is glass like the
rest (owner 2026-11-27), no tile on Home is the hero; the tile is designed for its S / M / L boxes and fits 16 of 16
(was 5); its state (pill, reason, button) comes from one function on the owner API's real auto-play shape (the
play-time line read a field the API never sends: fixed); `output/agent-states.html` draws twelve states, checked by
`ci/agent-states-check.mjs` (58 PASS, contrast measured from the pixels). Grid check `season1-home-grid-s88/` 146
PASS, 0 FAIL (main: 21 FAIL); fit.txt 118 of 166. Five small calls at the render checkpoint.

**Render session 89 (the Ladder tile, phase 2's tiles in groups, group 2, 2026-11-27):** Ladder with Rating & form
merged in, designed for its S / M / L boxes: 16 of 16 renders fit (was 3); one bar (`climb`: placement, then the next
tier) and one standings list (`standings`) replace two pairs of facts; a new player's L draws the tiers as a ladder;
the states sheet is shared (`src/statesSheet.ts`; `output/ladder-states.html`, seven states) and the check takes the
tile (`ci/tile-states-check.mjs agent|ladder`, 59 PASS for Ladder, contrast from the pixels). Grid check
`season1-home-grid-s89/` 146 PASS, 0 FAIL, 5 OPEN; fit.txt 131 of 166. Four small calls at the render checkpoint.

**Render session 90 (the play styles, owner 2026-11-27 note 6, 2026-11-27):** on My agent, "Play style" with
personality as its subtitle and one plain line (it changes how your agent plays, from its next match); S the current
style (four facts on this tile only, by the owner's word), M the style with Change, L all six as choices (current:
check, accent edge, "Current"; others: pointer, hover, press, focus ring); a tap opens My agent with that style ready
to confirm, drawn in the Home prototype (`render/season1/src/homePage.ts`). Checks: `ci/tile-states-check.mjs agent`
104 PASS (`season1-agent-tile-s90/`), the new `ci/play-style-check.mjs` 21 PASS (`season1-play-style-s90/`); grid check
`season1-home-grid-s90/` 146 PASS, 0 FAIL, 5 OPEN; fit.txt 131 of 166. Three small calls at the render checkpoint.

**Render session 91 (Packs and Store, phase 2's tiles in groups, group 3, 2026-11-28):** the Store tile's hero is the
packs (owner 2026-11-28, point 9): no cosmetic on the tile (the `cosmetics` fact removed from the spec); S credits and
how many packs they buy, M the featured pack (art, price, Buy), L 1 and 10 of each offer (two at most, the rest
named) and See the whole Store; a pack the credits don't cover says how many more; a Buy opens Cards with the purchase
ready to confirm. Packs fits every size (the fan no longer spills; S keeps to the count; a new player's L shows what
a pack holds from the live odds). States sheets `output/store-states.html` (8) and `packs-states.html` (7), checked by
`ci/tile-states-check.mjs store|packs` (74 and 52 PASS); grid check `season1-home-grid-s91/` 150 PASS, 0 FAIL, 5 OPEN
(the Buy flow clicked through); fit.txt 140 of 166 (Store and Packs 32 of 32). Four small calls at the render
checkpoint.

**Render session 92 (the hardening pass, 2026-11-28):** the owner's point 8, the Ladder's "Rating, 30 days" chart:
the tier names in a gutter left of the plot (never on the line), x by the day, a near-vertical day drawn as a step
with its value ("−68"), placed clear of the line, and the line ends at the tile's rating
(`render/season1/src/ratingChart.ts`, `test/ratingChart.test.ts`; `ci/tile-states-check.mjs ladder` measures it,
`season1-ladder-tile-s92/` 115 PASS, two new chart states). The contrast measure shared (`ci/contrast.mjs`) and run on
every tile of the Home (`season1-home-grid-s92/contrast.txt`): Watch live's names, Match history's W / L and the
alerts' links fixed; grid check 165 PASS, 0 FAIL, 6 OPEN; fit.txt 140 of 166. Three small calls at the render
checkpoint.

**Render session 93 (Collection and Daily rewards, phase 2's tiles in groups, group 4's first half, 2026-11-28):**
both tiles designed for their S / M / L boxes: 36 of 36 renders fit (Collection M was 0 of 6, Daily rewards M 0 of
6). Collection: the count held as the big number beside the ring, rare finds, the best cards sized to the unit (three
at M, five in a row at L), cards by faction. Daily rewards: today's credits and the next win's pay as one headline,
the free pack (two waiting: "Claim one so the next can come."), today's pay as one row of steps, and at L a new fact,
today's results (each paid win's pay and time, from `rewardedWins`); the "A loss pays 0" line fixed. States sheets
`output/collection-states.html` and `daily-states.html` (six each, with what each state must show as `data-expect`),
checked by `ci/tile-states-check.mjs collection|daily` (46 and 58 PASS); grid check `season1-home-grid-s93/` 171
PASS, 0 FAIL, 2 OPEN; fit.txt 160 of 166. Five small calls at the render checkpoint.

**Render session 94 (Notifications and Match history, phase 2's tiles in groups, group 4's second half, 2026-11-28):**
both tiles designed for their S / M / L boxes, which closes the tiles in groups: **every tile on the Home fits its box,
166 of 166 renders** (was 160), contrast.txt has no OPEN line, fill.txt's only OPEN bands are Music L (waiting on
owner). Match history: the last match in words (every API result: a cancel or abandon had been drawn "Drew"), what it
paid, the rating change, when; the matches before it with a column per number; Replay links and a tally at L; a new
player's L says what a match pays. Notifications: the new count, S the newest, M three and L five alerts as links in
two lines, read from the API's own fields (big pulls had read fields it never sends); the kind chips at L; a new
player's L says what each kind tells. States sheets `output/notif-states.html` (6) and `history-states.html` (7),
checked by `ci/tile-states-check.mjs notif|history` (58 and 59 PASS); grid check `season1-home-grid-s94/` 177 PASS, 0
FAIL, 1 OPEN. Five small calls at the render checkpoint.

**Render session 95 (three Season 1 pack-wrapper designs and the pick row, phase 2 step 3, 2026-11-28):** the sealed
booster as a foil object in three designs with placeholder art (A Crest, B Window, C Full bleed; the AI·TCG wordmark,
"Set name", "Season 1 · S1-01", the set symbol), its light following the pointer or tilt, else a slow sweep, still
under reduced motion; and the pick row (seven identical packs, drag / wheel / keys with a fling and snap, a tap picks
and the pack lifts, only the slot is sent). `render/season1/PACKS.md`, `output/pack-wrappers.html`,
`output/pack-pick.html`; `season1-pack-wrappers-s95/check.txt` 70 PASS, 0 FAIL; the flash sampler 0 changes in every
run. The owner picks a design (C recommended) at the render checkpoint, with five small calls.

**Render session 96 (the pack opening's grip and tear on Crest, phase 3's opening rework part one, 2026-11-28):** the
owner's 2026-11-28 points 6-9 and call 3. The pick row has no buttons (keys still work) and a pick is final; the picked
pack waits with a cue along its top; held, it trembles harder the longer it's held, leans to the finger and crinkles,
and for a hit the seam under the crimp glows in the tell's colour; a drag that starts in the grab zone (the top quarter
plus a margin, 48 px or more on a phone) and moves a third of the width, any direction, tears it along the finger
(scraps, light leaking, a rip whose sound follows the speed); a tap or Enter tears it in 600 ms; the strip flies off,
one swell, and five cards rise out backs up (`render/season1/src/packTear.ts`, `output/pack-pick.html?best=gold`). The
shine is brighter (0.26). Checks: `season1-pack-tear-s96/check.txt` 54 PASS (nine drags each on desktop and on a phone
with real touch events), every flash run 0 counted flashes; `season1-pack-wrappers-s96/` 70 PASS. Five small calls at
the render checkpoint.

**Before that — build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec and, owner 2026-11-13, ends at 00:00 27 Dec Sydney, by the server).
Session 104 (game lane, hardening and fixes only per the owner's 2026-11-14 point 4) printed an owner
switching auto-play off on the website in the season log, at the next round's start, once, with the switch's time;
the server's own stops are not counted as the owner's (`progress/auto-play-off-001.txt`, 14 PASS, in the CI demo
set). Before that, session 103 moved the plain `npm run ladder` CLI onto the season server's ladder lines
(`LadderLog`; `progress/ladder-cli-log-001.txt`). Render session 81 (the render debt list) raised the render
suite's time limits to 30 s on a measure (`render/vitest.config.ts`) and retired or re-ran the last stale by-hand
browser checks (no Season 0 page changed). Nothing is blocking.**

- **The owner's run book:** `progress/mac-mini-guide.md`; the launch agents `server/launchd/`; setup
  `server/src/seasonSetup.ts`; the dry run `server/src/dev/seasonDryRun.ts` (its records:
  `progress/season0-dry-run-001.txt`, and `-002.txt` on v29 and cards-3, session 98: 49 of 49 PASS).
- **The booster cards:** `S0_BOOSTER_CARDS` in `engine/src/data/registry.ts` (the cards themselves at the end of
  `engine/src/data/cards.ts`, `aegisCards.ts`, `nullCards.ts`); the set and the legacy set in
  `economy/src/packs.ts` (`seasonZeroSet`, `CardSet.packCards`, `CardSet.legacy`, `rollingSet`); `PACK_ODDS_V3` in
  `economy/src/config.ts`; the lists in `economy/src/chase.ts` (`S0_ILLUSTRATIONS`, `S0_GLITCH_CARDS`, and the old
  `_V2` lists); the Standard-only refusal in the store's `chaseCopyProblem`.
- **Session 104's work:** `Ladder.noteSwitchedOff` and the `autoPlaySwitchedOff` event
  (`server/src/ladder/ladderRunner.ts`), its line in `ladderLog.ts`, the demo `server/src/dev/autoPlayOffDemo.ts`,
  the tests in `server/test/ladder.test.ts` ("(session 104) ...") and `ladderLog.test.ts`.
- **Session 103's work:** `server/src/ladderCli.ts` (on `LadderLog`), `Ladder.runRound`'s `onPaired`
  (`server/src/ladder/ladderRunner.ts`), the record `server/src/dev/ladderCliLogDemo.ts`, the test in
  `server/test/ladder.test.ts`.
- **Session 102's work:** `server/src/ladder/ladderLog.ts` (used by `seasonCli.ts`), its test
  `server/test/ladderLog.test.ts`, the measure `server/src/dev/sitsOutDayMeasure.ts` (a record).
- **Session 101's work:** `server/src/dev/lockPickupLadderDemo.ts`; the ladder test "(session 101) a lock the
  owner can't build..."; the forced mid-match end in `server/src/dev/siteContractCheck.ts` (`forcedEnd`).
- **Session 100's work:** `EconomyStore.lockableFactions` (`economy/src/store.ts`), served in `server/src/ownerApi.ts`'s
  `playSettings`, documented in `server/OWNER_API.md`; the demo `server/src/dev/lockableApiDemo.ts`; the test
  `server/test/lockable.test.ts`; the contract check's new shapes and control in `server/src/dev/siteContractCheck.ts`.
- **Session 98's evidence:** `progress/booster-rerun-s98/` (summary.md, the three probe files, the ring regression
  checks, the ring script), `progress/built-deck-ring-008/009/010.txt`, `progress/season0-dry-run-002.txt`.
- **Session 97's evidence:** `progress/pack-sim-004-booster.txt` (`npx tsx src/dev/packSimulation3.ts` in `economy/`, 16 PASS,
  in the demo set); `progress/built-deck-ring/collections.json` re-made from S0-odds-3. The proposal's check
  (`engine/src/dev/boosterProposal.ts`) now reads the registered cards.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. **But the owner's 2026-11-22 entry (point 7) overrides
the alternation: every scheduled session is a render-lane session until the owner says otherwise** (the game lane
stays off until the owner decides Season 1's server, domain and sign-in). Step 0's open-PR check still applies: one
session at a time.

At the start: check for an open render PR; if one is open, fix it if it has failed checks or conflicts, else wait
as step 0 says. Read owner-feedback.md (answers to render 96's five calls may be there).

Next: **render 97, the render hardening pass** (every 5th session; 92 was the last): no new features. Work down
`progress/render/quality-debt.md`, the Season 1 packs first: re-run `ci/pack-tear-check.mjs`,
`ci/pack-wrapper-check.mjs` and the flash sampler's tear runs; the leak and swell clipped flat by the stage's
`overflow: hidden` when the pack sits near its top; the tear's sound remembered (a stored preference like Season 0's)
or folded into Season 0's sound system's seam; a frantic scrub and a tap tear sampled for flashes; and the Home grid
check re-run on today's pages. Then **render 98: the opening rework, part two, the reveal** (FLASH.md's storyboard
beats 5-8: plain cards with an edge-on flip, the build, one bloom per hit, the summary, and Zero-Day's takeover with
no saturated red; within one counted flash a second; Reduce flashing honoured), from the stack render 96 leaves on
screen, with a stand-in server that sends the picked slot's cards only after the tear. Phase 1's step 5 (Watch live
9:16 on the Season 1 arena) and step 6 (the music spec) are still open. A call only the owner can make goes in the
notes as "waiting on owner" and the session moves on.

Game lane (when it resumes; owner 2026-11-22 points 5 and 6): `season:setup` asks for "at least 12 characters" but
the check and the Mac mini guide say 10, so make them match; and add the rehearsal-to-launch switch to
`progress/mac-mini-guide.md` (stop both launch agents, move the rehearsal file and logs aside, `git pull`, `npm ci`,
`season:setup` on the new file, `install.sh` with its path, `bootstrap` both). Earlier candidates stay in
quality-debt.md.

**Blocked:** nothing.
