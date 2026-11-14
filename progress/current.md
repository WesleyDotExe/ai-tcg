# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec and, owner 2026-11-13, ends at 00:00 27 Dec Sydney, by the server).
Session 100 (game lane) served the API half of the owner's answer (a) to session 99's lock call:
`GET /api/play` (and the faction-lock answer) now carry `lockable`, each lockable faction buildable now or not,
with the cards held and needed, by the engine's `largestDeck` (the rule a rebuild checks against; the store's
`lockableFactions`). The site half was render 76 (PR #179), which reads the field first. Evidence
`progress/lockable-api-001.txt` (13 PASS, CI demo set), `progress/site-contract-002.txt` (0 mismatches, 8 of 8),
`progress/lockable-site-check-001.txt` (render 76's browser check, 14 PASS with the field served). Session 98's
answers: cards-3 stays, nothing to tune; the full-collection column is a Season 1 builder note. Nothing is
blocking.**

- **The owner's run book:** `progress/mac-mini-guide.md`; the launch agents `server/launchd/`; setup
  `server/src/seasonSetup.ts`; the dry run `server/src/dev/seasonDryRun.ts` (its records:
  `progress/season0-dry-run-001.txt`, and `-002.txt` on v29 and cards-3, session 98: 49 of 49 PASS).
- **The booster cards:** `S0_BOOSTER_CARDS` in `engine/src/data/registry.ts` (the cards themselves at the end of
  `engine/src/data/cards.ts`, `aegisCards.ts`, `nullCards.ts`); the set and the legacy set in
  `economy/src/packs.ts` (`seasonZeroSet`, `CardSet.packCards`, `CardSet.legacy`, `rollingSet`); `PACK_ODDS_V3` in
  `economy/src/config.ts`; the lists in `economy/src/chase.ts` (`S0_ILLUSTRATIONS`, `S0_GLITCH_CARDS`, and the old
  `_V2` lists); the Standard-only refusal in the store's `chaseCopyProblem`.
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
with "Render:", this is a game session; otherwise render. The latest PR (render session 77, the faction lock on the
server's `lockable`) is render, so **the next session is game** (101).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else wait as step 0 says (if it merges while you wait, choose the lane again). Check the last merged PR so a slice
isn't built twice. Read owner-feedback.md.

Render lane (78): render 77 ticked the faction-lock item (drawn from the server's `lockable`, fallback kept, the
plan's pack points; `progress/render/evidence/faction-lock-check-s77.txt`) and left two small calls at its
checkpoint. Next: the owner's answers, then the render debt list; render 79 is a hardening pass.

Game lane (101): **a hardening pass** (the every-5th count drifted: 81, 86, 91, 92, then owner work; see
quality-debt.md's session 100 entry), unless the owner's feedback says otherwise. Candidates from quality-debt.md:
the site contract check's dependence on where match ends fall (session 99); the dry run's step 5 checked for the
same cycle effect; a ladder round shown picking up an agent whose lock just became buildable (session 100).

**Blocked:** nothing.
