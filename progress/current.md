# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec and, owner 2026-11-13, ends at 00:00 27 Dec Sydney, by the server).
Session 99 (game lane) fixed open PR #177's failed check (session 98's work rides in the same new PR): the site
contract check on cards-3 never reached the allowance "finishing" (each window starts at a pairing, so the same
15-minute retry kept ending in the gap between matches); its retries now go 30, 60, 15 minutes, and it passes
(0 mismatches, 7 of 7 controls, every shape reached). Session 98 ran the booster cards' balance re-run (build step 4): two tuning rounds as call 8 allows,
round 1 kept as `cards-3` (Zombie Fork 1/2, Heap Spray 2/3, Decay Engine 2/3, Aegis Overwatch 2/5), round 2
reverted. The probe is in call 3's target (+10.8 / +9.3 / +9.8 / +12.3, spread 3.0); the built-deck ring is not
within ~4 at 37 packs (9.5) or full (19.1), so it is back with the owner at an [OWNER CHECK-IN]
(`progress/booster-rerun-s98/summary.md`, notes-for-owner.md session 98). Also: a starter card's tournament
finish refused (owner call 6, Standard only); the dry run's step 5 brought up to the v29 allowance rule. Nothing
is blocking.**

- **The owner's run book:** `progress/mac-mini-guide.md`; the launch agents `server/launchd/`; setup
  `server/src/seasonSetup.ts`; the dry run `server/src/dev/seasonDryRun.ts` (its records:
  `progress/season0-dry-run-001.txt`, and `-002.txt` on v29 and cards-3, session 98: 49 of 49 PASS).
- **The booster cards:** `S0_BOOSTER_CARDS` in `engine/src/data/registry.ts` (the cards themselves at the end of
  `engine/src/data/cards.ts`, `aegisCards.ts`, `nullCards.ts`); the set and the legacy set in
  `economy/src/packs.ts` (`seasonZeroSet`, `CardSet.packCards`, `CardSet.legacy`, `rollingSet`); `PACK_ODDS_V3` in
  `economy/src/config.ts`; the lists in `economy/src/chase.ts` (`S0_ILLUSTRATIONS`, `S0_GLITCH_CARDS`, and the old
  `_V2` lists); the Standard-only refusal in the store's `chaseCopyProblem`.
- **Session 98's evidence:** `progress/booster-rerun-s98/` (summary.md, the three probe files, the ring regression
  checks, the ring script), `progress/built-deck-ring-008/009/010.txt`, `progress/season0-dry-run-002.txt`.
- **Session 97's evidence:** `progress/pack-sim-004-booster.txt` (`npx tsx src/dev/packSimulation3.ts` in `economy/`, 16 PASS,
  in the demo set); `progress/built-deck-ring/collections.json` re-made from S0-odds-3. The proposal's check
  (`engine/src/dev/boosterProposal.ts`) now reads the registered cards.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. The latest PR (game session 99, which carries session 98's balance re-run) is
game, so **the next session is render** (76).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else wait as step 0 says. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Render lane (76): the four tuned cards' faces show the new stats already (the face sheet and pack page were
rebuilt from the registry this session; nobody looked at them in a browser). Otherwise the render lane's own
roadmap items.

Game lane (100): **apply the owner's answers to session 98's three calls** (notes-for-owner.md). If (a) on call 1:
nothing to tune (the site contract check and the slow demos were re-run on cards-3 in session 99). If (b): one more round aimed at Null-versus-Aegis at 37 packs, same two instruments
(`progress/booster-rerun-s98/run-built-deck-ring.sh <name>` and `npx tsx src/dev/boosterProposal.ts 500` in
`engine/`), a new `CARDS_VERSIONS` entry. If (c): packs back to the pre-option-B set (a new odds version, the
legacy set). If no answer yet: the roadmap's next unblocked item.

**Blocked:** nothing.
