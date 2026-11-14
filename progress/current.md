# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec and, owner 2026-11-13, ends at 00:00 27 Dec Sydney, by the server).
Session 101 (game lane) was a hardening pass, no new features: the ladder shown picking up an agent whose
faction lock just became buildable (`progress/lock-pickup-ladder-001.txt`, 17 PASS, CI demo set; a test in
`server/test/ladder.test.ts`), and the site contract check's "finishing" made exact (the allowance's end set 5 s into
a live match; `progress/site-contract-003.txt`, 0 mismatches, 8 of 8 controls, every shape reached). The dry run's
step 5 has the same cycle effect (record 002 skipped its mid-match check); recorded as debt. Before that, session
100 served `lockable` on `GET /api/play` (`progress/lockable-api-001.txt`). Nothing is blocking.**

- **The owner's run book:** `progress/mac-mini-guide.md`; the launch agents `server/launchd/`; setup
  `server/src/seasonSetup.ts`; the dry run `server/src/dev/seasonDryRun.ts` (its records:
  `progress/season0-dry-run-001.txt`, and `-002.txt` on v29 and cards-3, session 98: 49 of 49 PASS).
- **The booster cards:** `S0_BOOSTER_CARDS` in `engine/src/data/registry.ts` (the cards themselves at the end of
  `engine/src/data/cards.ts`, `aegisCards.ts`, `nullCards.ts`); the set and the legacy set in
  `economy/src/packs.ts` (`seasonZeroSet`, `CardSet.packCards`, `CardSet.legacy`, `rollingSet`); `PACK_ODDS_V3` in
  `economy/src/config.ts`; the lists in `economy/src/chase.ts` (`S0_ILLUSTRATIONS`, `S0_GLITCH_CARDS`, and the old
  `_V2` lists); the Standard-only refusal in the store's `chaseCopyProblem`.
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
with "Render:", this is a game session; otherwise render. The latest PR (game session 101, the hardening pass) is
game, so **the next session is render** (78).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else wait as step 0 says (if it merges while you wait, choose the lane again). Check the last merged PR so a slice
isn't built twice. Read owner-feedback.md.

Render lane (78): render 77 ticked the faction-lock item (drawn from the server's `lockable`, fallback kept, the
plan's pack points; `progress/render/evidence/faction-lock-check-s77.txt`) and left two small calls at its
checkpoint (both answered keep (a), handled in game 101). Next: the render debt list; render 79 is a hardening pass.

Game lane (102): the owner's answers first (session 101 has no calls). Then the highest unfinished, unblocked
Season 0 checklist item in `progress/roadmap.md`; if none is waiting, candidates from quality-debt.md: `lockable`
measured at season scale (it is computed on every `GET /api/play`); the per-round "left out" line for a locked owner
measured over a day's rounds; the slow demos re-run (outside CI). Hardening count: 101 was one; the next is due
around 106.

**Blocked:** nothing.
