# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec and, owner 2026-11-13, ends at 00:00 27 Dec Sydney, by the server).
Session 97 (game lane) built Season 0's pack-only booster cards (owner 2026-11-14, option B, all 8 calls kept; and
"starter cards are Standard only"), steps 1 and 2 of 4: the 28 cards in the registry (`cards-2`), the set 001-124,
`S0-odds-3` live (booster cards only), the chase lists re-pointed at an [OWNER CHECK-IN]. No schema change. Nothing
is blocking.**

- **The owner's run book:** `progress/mac-mini-guide.md`; the launch agents `server/launchd/`; setup
  `server/src/seasonSetup.ts`; the dry run `server/src/dev/seasonDryRun.ts` (its record,
  `progress/season0-dry-run-001.txt`, predates v29 and cards-2: not re-run).
- **The booster cards:** `S0_BOOSTER_CARDS` in `engine/src/data/registry.ts` (the cards themselves at the end of
  `engine/src/data/cards.ts`, `aegisCards.ts`, `nullCards.ts`); the set and the legacy set in
  `economy/src/packs.ts` (`seasonZeroSet`, `CardSet.packCards`, `CardSet.legacy`, `rollingSet`); `PACK_ODDS_V3` in
  `economy/src/config.ts`; the lists in `economy/src/chase.ts` (`S0_ILLUSTRATIONS`, `S0_GLITCH_CARDS`, and the old
  `_V2` lists); the Standard-only refusal in the store's `chaseCopyProblem`.
- **New evidence:** `progress/pack-sim-004-booster.txt` (`npx tsx src/dev/packSimulation3.ts` in `economy/`, 16 PASS,
  in the demo set); `progress/built-deck-ring/collections.json` re-made from S0-odds-3. The proposal's check
  (`engine/src/dev/boosterProposal.ts`) now reads the registered cards.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. The latest PR (game session 97, the booster cards built)
is game, so **the next session is render** (75).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else wait as step 0 says. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Render lane (75): the booster cards on the site: their faces and set numbers 097-124, the 124-card binder (19 secret
cards, 16 Glitch, 28 Gold), Gold only on booster cards, and the pack pages (game 97 re-made `pack-opening.html` and
`card-faces.html` with their scripts but nobody has looked at them in a browser). See notes-for-owner.md, session 97.

Game lane (98): **the balance re-run (build step 4)**, first. Run the built-deck ring
(`engine/src/dev/builtDeckRing.ts`) on the re-made collections (`progress/built-deck-ring/collections.json`, with
booster pulls) and with full collections, and read each faction's booster package against call 3's target (+8 to
+12 points, factions within ~4). If it fails: tune booster cards only (costs and stats, never a card's job), up to
two rounds, each a new `CARDS_VERSIONS` entry and a re-pin of the S0-odds-3 hash only if a card's rarity moves; then
back to the owner (call 8). Then the ring regression check, then the 45-minute dry run on cards-2
(`npm run dry-run -w server`). Apply the owner's answers to session 97's calls 1-6 if they have come in.

**Blocked:** nothing.
