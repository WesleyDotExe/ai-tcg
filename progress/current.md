# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec and, owner 2026-11-13, ends at 00:00 27 Dec Sydney, by the server).
Session 103 (game lane, hardening and fixes only per the owner's 2026-11-14 point 4) moved the plain
`npm run ladder` CLI onto the season server's ladder lines (`LadderLog`): a round line before each round's matches,
a repeated "sits out" reason printed once, and the auto-play lines it used to drop entirely
(`progress/ladder-cli-log-001.txt`, 9 PASS; the old CLI 5 of 9); the slow demo set re-run. Before that, session 102
measured a locked owner's day on the ladder and summed up the season log's repeated line. Nothing is blocking.**

- **The owner's run book:** `progress/mac-mini-guide.md`; the launch agents `server/launchd/`; setup
  `server/src/seasonSetup.ts`; the dry run `server/src/dev/seasonDryRun.ts` (its records:
  `progress/season0-dry-run-001.txt`, and `-002.txt` on v29 and cards-3, session 98: 49 of 49 PASS).
- **The booster cards:** `S0_BOOSTER_CARDS` in `engine/src/data/registry.ts` (the cards themselves at the end of
  `engine/src/data/cards.ts`, `aegisCards.ts`, `nullCards.ts`); the set and the legacy set in
  `economy/src/packs.ts` (`seasonZeroSet`, `CardSet.packCards`, `CardSet.legacy`, `rollingSet`); `PACK_ODDS_V3` in
  `economy/src/config.ts`; the lists in `economy/src/chase.ts` (`S0_ILLUSTRATIONS`, `S0_GLITCH_CARDS`, and the old
  `_V2` lists); the Standard-only refusal in the store's `chaseCopyProblem`.
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
with "Render:", this is a game session; otherwise render. The latest PR (render session 80, a hardening pass) is
render, so **the next session is game** (104).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else wait as step 0 says (if it merges while you wait, choose the lane again). Check the last merged PR so a slice
isn't built twice. Read owner-feedback.md.

Render lane (81): render 80 was the render hardening pass: the owner's zoom on the Season 1 prototype (the
2026-11-15 entry, handled) and the stale by-hand browser checks (re-run, fixed or retired; `render/ci/pw.mjs`). Next:
the render debt list unless Season 0 has a fix waiting; per the owner's 5 (b), a prototype session (the 3D play and
attack effects) after a few render sessions. Next render hardening pass: 85.

Game lane (104): hardening and fixes only until clean-up (owner 2026-11-14 point 4). Read the owner's answers first
(session 103 has no calls). Candidates from quality-debt.md: the dry run's step 5 passing without a mid-match end
(needs a way to end a window from outside: a feature, ask first); an owner switching auto-play off by hand isn't
printed by the ladder (a one-line event, small); the slow demos (re-run session 103). Hardening count: 101 was one,
103 hardening-only too; the next dedicated pass is due around 106.

**Blocked:** nothing.
