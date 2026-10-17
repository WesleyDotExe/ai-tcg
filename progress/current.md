# Current status

**Build-order stage: Stage 4+ (the living system). Session 38 (game lane) handled the owner's
2026-10-17 answers and the 2026-10-18 side task, and built step 1 of the accepted order:**
- **Unique signature ability ids** (side task 1): every size has its own id (`sig-recycle.c3`).
- **Game-over and attack-fizzle causes as data** (side task 2), and a game-over sentence that reads.
- **The first rename is free**, then 100 pack points; **typed names may repeat a word**.
- **The chase-card proposal, measured, NOT live:** 33 secret illustrations + 3 Zero-Day slots,
  the Glitch tier (20 Units, 4%), and `S0-odds-2`. Raised as an [OWNER CHECK-IN] in
  notes-for-owner.md.

No stage checkpoint (the living system reports through notes-for-owner check-ins).

## What stands (this session's work; sessions 1-37 otherwise unchanged)

**Engine.**
- `signatureMenu.ts`: `SIGNATURE_MENU` is the written menu passed through `withSizedIds` (a size's
  ability ids get `.<sizeKey>`); `legacySignatureAbilityId`, `upgradeSignatureAbilityId`;
  `signatureFingerprint` hashes ids in their legacy form, so recorded fingerprints still match.
- `state/types.ts`: `gameOver.cause` (`GameOverCause`: `healthDepleted` with `losers`, or
  `turnCap` with `tied`); attack fizzles carry `cause` (`attackerGone` / `targetGone`),
  `attacker`, `attackerId`. Reasons: "p1's health reached 0", "both players' health reached 0 at
  once".

**Economy.**
- `store.renamePrice(agent)`: 0 for the first owner rename, `AGENT_RENAME_PACK_POINTS` after.
- `customAgentNameProblem` no longer runs the repeated-word check.
- `economy/src/chase.ts` (proposal only, unused by the store): `S0_ILLUSTRATIONS` (33),
  `secretCards` (numbers 193-228/096; Zero-Day at the top, animated, placeholder art),
  `S0_GLITCH_CARDS` (20 Units), `GLITCH_LOOK`, `PACK_ODDS_V2` (`S0-odds-2`), `HIT_FINISHES`,
  `rollPackV2`, `nextPityV2`, `baseHitPercent`.
- `packs.ts` exports `weightedPick` (no behaviour change; S0-odds-1 packs reproduce as before).

## Evidence committed

- `progress/signature-ability-ids-001.txt` (`npx tsx src/dev/signatureAbilityIdReport.ts` in
  engine/): old ids vs new over 300 and 3,000 generated agents, every id with its text, and the
  new game-over reason and cause from 4 real matches.
- `progress/economy-demo-008.txt` (`npx tsx src/dev/agentNamingDemo.ts` in economy/): the free
  first rename, the paid second, repeated words allowed. Reproduces exactly.
- `progress/pack-sim-002.txt` (`npx tsx src/dev/packSimulation2.ts` in economy/, ~2 minutes):
  S0-odds-1 vs S0-odds-2 rates, where special versions land, the 20% target with pity, completion
  medians for every goal, and the crafting options.
- Tests: engine `signatureAbilityIds.test.ts` (5), `eventReasons.test.ts` (2); economy
  `chase.test.ts` (8), `agentNames.test.ts` (rename tests rewritten, +2).
- `npm test`: 669 across six workspaces, all pass (engine 218, protocol 7, server 23, agents 17,
  economy 90, render 314). `tsc --noEmit` is clean in all six.

## Concrete next step

Check the alternation first. This session's PR follows render's #60, so the next session is
**render**. Render can now:
- look up signature rules text by ability id alone (ids are unique);
- word attack fizzles from `cause` / `attacker` (the feed prints "fizzles: X's attack fizzles"),
  and game over from `cause`.

The next **game-lane** session reads the owner's answer to the chase check-in:
- **With a yes (or changes) on items 1-6:** finish build step 1. Schema v10 (finishes `glitch`,
  `secret`, `zeroDay`, a secret code on copies, none salvageable), `openPack` on `S0-odds-2`
  (merge `rollPackV2` and `rollPack` into one roller with the S0-odds-1 path pinned by a seed
  test), binder/checklist entries, and secret crafting if 5A.
- **Without an answer:** go on to step 2, the engine's generic "choose one" mechanic (offered as
  separate legal moves, logged, in the replays), then the 3 Zero-Day cards, then the deck-building
  agent and play styles.

**Blocked:** nothing; the check-in has defaults.
