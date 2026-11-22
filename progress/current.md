# Current status

**Season 0 is running (owner 2026-11-22: launched early on Sun 22 Nov 08:09 Sydney on the Mac mini from main at 89abe46; five bots; it ends by itself at 00:00 27 Dec Sydney; the Mac mini is not updated mid-season unless something breaks). The scheduled sessions now run the render lane only, on the owner's Season 1 Home plan, all in `render/season1/`. Render session 82 did phase 1 step 1, the Home tile audit and spec (`render/season1/HOME_TILES.md`, `render/season1/src/homeSpec.ts`; evidence `progress/render/evidence/season1-home-audit-s82/`). Render session 83 did step 2, Home mockup A with its navigation (`render/season1/HOME_MOCKUPS.md`, `render/season1/output/home-mockup-a.html`, drawn by `src/homeFacts.ts` + `src/homeMockupA.ts` from a real owner-API snapshot, `mockup/data/home-data.json`; evidence `progress/render/evidence/season1-home-mockup-a-s83/`, 56 PASS).**

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
as step 0 says. Read owner-feedback.md (answers to render 83's four calls may be there).

Render lane (84): the owner's plan, phase 1 step 3: **Home mockups B and C**, in `render/season1/` (fenced off).
Draw them from the same spec and data as A: `src/homeFacts.ts` (every fact, `data-fact` marked, shared; extend it,
don't fork it) and `mockup/data/home-data.json` (re-read with `npx tsx season1/mockup/snapshot.ts` in `render/`
if needed). Each must be a real alternative to A ("the question is the label", five places, no top bar on Home):
for example B, a headline-number tile with the question behind a tap and a top navigation; C, a Home that orders
tiles by what needs you (a feed). Add `src/homeMockupB.ts` / `C.ts`, their builds, tests like
`test/homeMockupA.test.ts`, and extend `ci/home-mockup-check.mjs` to check all three (its spec checks are generic).
Then put A, B and C side by side for the owner (one comparison page or still sheet) and ask for the direction
("waiting on owner"). Then (85) the pack-opening flash audit / check / storyboard, (86) Watch live 9:16, (87) the
music spec. A call only the owner can make goes in the notes as "waiting on owner" and the session moves on (owner
rule 10a); when the list is done, hardening and fixes only (10b). Next render hardening pass: due around 85.

Game lane (when it resumes; owner 2026-11-22 points 5 and 6): `season:setup` asks for "at least 12 characters" but
the check and the Mac mini guide say 10, so make them match; and add the rehearsal-to-launch switch to
`progress/mac-mini-guide.md` (stop both launch agents, move the rehearsal file and logs aside, `git pull`, `npm ci`,
`season:setup` on the new file, `install.sh` with its path, `bootstrap` both). Earlier candidates stay in
quality-debt.md.

**Blocked:** nothing.
