# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec and, owner 2026-11-13, ends at 00:00 27 Dec Sydney, by the server).
Session 102 (game lane) was a spare session on two "unmeasured" debt lines: a locked owner's day on the live
ladder (`progress/sits-out-day-001.txt`, 6 PASS: left out of all 184 rounds; the season log's same "sits out"
line now summed up, 4 lines that day instead of 184, `server/src/ladder/ladderLog.ts`), and `lockable` on
`GET /api/play` timed at season scale (1.7 to 14.9 ms at 40 to 5,040 copies held; no cache needed). Before that,
session 101 was a hardening pass (`progress/lock-pickup-ladder-001.txt`, `progress/site-contract-003.txt`). Nothing is blocking.**

- **The owner's run book:** `progress/mac-mini-guide.md`; the launch agents `server/launchd/`; setup
  `server/src/seasonSetup.ts`; the dry run `server/src/dev/seasonDryRun.ts` (its records:
  `progress/season0-dry-run-001.txt`, and `-002.txt` on v29 and cards-3, session 98: 49 of 49 PASS).
- **The booster cards:** `S0_BOOSTER_CARDS` in `engine/src/data/registry.ts` (the cards themselves at the end of
  `engine/src/data/cards.ts`, `aegisCards.ts`, `nullCards.ts`); the set and the legacy set in
  `economy/src/packs.ts` (`seasonZeroSet`, `CardSet.packCards`, `CardSet.legacy`, `rollingSet`); `PACK_ODDS_V3` in
  `economy/src/config.ts`; the lists in `economy/src/chase.ts` (`S0_ILLUSTRATIONS`, `S0_GLITCH_CARDS`, and the old
  `_V2` lists); the Standard-only refusal in the store's `chaseCopyProblem`.
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
with "Render:", this is a game session; otherwise render. The latest PR (render session 79, the Season 1 arena
prototype) is render, so **the next session is game** (103).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else wait as step 0 says (if it merges while you wait, choose the lane again). Check the last merged PR so a slice
isn't built twice. Read owner-feedback.md.

Render lane (80): render 79 did the owner's Season 1 arena head start (step 1, the layout, as a fenced-off prototype
in `render/season1/`, at an [OWNER CHECK-IN] with five calls in `progress/render/checkpoints.md`). Next: render 80 is
the hardening pass moved from 79 (the render debt list, stale browser checks first); the prototype waits for the
owner's call on how far it goes. The game lane has nothing to do for it (owner 2026-11-14 point 4: no Season 1 game
work).

Game lane (103): the owner's answers first (session 102 has no calls). Then the highest unfinished, unblocked
Season 0 checklist item in `progress/roadmap.md`; if none is waiting, candidates from quality-debt.md: the dry run's
step 5 passing without a mid-match end (needs a way to end a window from outside: a feature, ask first); the slow
demos re-run (outside CI, last run session 99); `ladderCli.ts` onto `LadderLog` if it is kept. Hardening count: 101
was one; the next is due around 106.

**Blocked:** nothing.
