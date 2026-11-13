# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec and, owner 2026-11-13, ends at 00:00 27 Dec Sydney, by the server).
Session 96 (game lane) proposed Season 0's pack-only booster cards (owner 2026-11-14, option B, an approved
exception to the scope lock) at an [OWNER CHECK-IN]: 28 cards, draft data only, checked by the engine. Test only:
schema v29, no product code changed. Nothing is blocking.**

- **The owner's run book:** `progress/mac-mini-guide.md`; the launch agents `server/launchd/`; setup
  `server/src/seasonSetup.ts`; the dry run `server/src/dev/seasonDryRun.ts` (its record,
  `progress/season0-dry-run-001.txt`, predates v29: not re-run).
- **New evidence:** `progress/booster-proposal-s0.md` (the proposal and 8 calls), `progress/booster-proposal-005.txt`
  (the final check: every card legal and resolved; each faction's package +9 to +13 points, Null +17; the blank-body
  control), `-001` to `-004` (the tuning record). Cards: `engine/src/dev/boosterDraft.ts`; check:
  `engine/src/dev/boosterProposal.ts` (`npx tsx src/dev/boosterProposal.ts 500 --leave-one-out --control --singles`
  in `engine/`, about 3.5 minutes).
- Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. The latest PR (game session 96) is game, so **the next
session is render** (74).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else wait as step 0 says. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Render lane (74): whatever the owner's answers to render 73 and the plan say. Nothing from session 96 needs the site
yet. The booster cards will need card faces and set numbers once they are built.

Game lane, when its turn comes: if the owner has answered `progress/booster-proposal-s0.md`, build it in the
proposal's order: (1) the cards into the faction files (literal style) and the registry, with a new `CARDS_VERSIONS`
entry; make the ring's set-Mythic stand-in pick the starter Mythic when a deck holds two; (2) the set numbering
(call 6) and the pack table as S0-odds-3 (call 7), with the pack simulation re-run; (3) the realistic collections
with booster pulls; (4) the built-deck ring to call 3's target, then the ring regression check. If there's no answer
yet, the re-run of the 45-minute dry run on v29 (`npm run dry-run -w server`) is still owed.

**Blocked:** nothing.
