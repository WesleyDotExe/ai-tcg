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
as step 0 says. Read owner-feedback.md (answers to render 89's four calls may be there).

Next: **render 90: the owner's 2026-11-27 note 6, the play-style choices on the agent tile** (queued by render 89):
the section called "Play style" (personality as its subtitle) with one plain line (it changes how your agent plays,
from its next match); the six drawn as choices (the current one marked: check, accent edge, "Current"; the others
with hover, press and a pointer); a tap on any style opens My agent with that style ready to confirm; S the current
style's name, M the current style with "Change", L all six. Note: S showing the style makes My agent's S four facts,
and `homeSpec.test.ts` holds S to three; the owner's word wins, so change that rule for this tile and say so. Extend
`agentStates.ts` with the hover / press states if the check needs them, and keep
`ci/tile-states-check.mjs agent` at 4.5:1. Then group 3, Packs and Store (Store L is the worst fit left, 447-526 px
over), then Collection and Daily rewards, until fit.txt is all "fits" and fill.txt has no OPEN line. Every 5th render
session is the hardening pass (render 92 next). Phase 1's step 5 (Watch live 9:16 on the Season 1 arena) and step 6
(the music spec) are still open. A call only the owner can make goes in the notes as "waiting on owner" and the
session moves on.

Game lane (when it resumes; owner 2026-11-22 points 5 and 6): `season:setup` asks for "at least 12 characters" but
the check and the Mac mini guide say 10, so make them match; and add the rehearsal-to-launch switch to
`progress/mac-mini-guide.md` (stop both launch agents, move the rehearsal file and logs aside, `git pull`, `npm ci`,
`season:setup` on the new file, `install.sh` with its path, `bootstrap` both). Earlier candidates stay in
quality-debt.md.

**Blocked:** nothing.
