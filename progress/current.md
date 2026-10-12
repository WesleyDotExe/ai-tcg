# Current status

**Build-order stage: Stage 4+ (the living system). Session 32 (game lane) did the owner's
2026-10-11 answer (option A): the Neutral signature menu as card data and its fairness test.**
Step 2 isn't finished (the menu doesn't pass yet, the bound signature promo and generating an
agent are left), so there's no stage checkpoint. There is an **[OWNER CHECK-IN]** in
notes-for-owner.md: only Recycle and Tax pass the test.

## What stands (this session's work; sessions 1-31 otherwise unchanged)

**The menu (`engine/src/data/signatureMenu.ts`).**
- `SIGNATURE_MENU`: the 16 options with category, rules text, keywords, abilities and an `aura`
  flag (the 7-cost second-aura pool: Commander's aura, Shield wall, Dampen, Tax).
- `SIGNATURE_TIERS` (5: 3/6, 4/5, 2/7; 6: 4/8, 5/7, 3/9 + Rush/Guard/Barrier; 7: 3/7, 4/6 + a
  second aura), `signatureSpecProblem`, `allSignatureSpecs` (303), `signatureComboId`
  (e.g. `sig6-4x8-rally+guard`), `buildSignatureCard` (a Neutral Mythic Unit; `anyStats` lets
  the tuner leave the table), `onTable`.

**Engine additions, all generic (none name a card).**
- `onKill` trigger: a unit's hit took another unit from alive to dead (or its effect destroyed
  it). It's recorded on the victim as `lethalBy` and fired in `processDeaths` after onDeath, if
  the killer is still on the board.
- `onEnemyAttack` trigger: fired on the defending side's units right after an attack goes on the
  stack.
- `Ability.limit: "oncePerTurn"`, counted in `resolveAbility` for any unit-source trigger;
  `UnitInstance.usedThisTurn` is cleared at every turn end.
- `buffAllies.excludeSelf` and `cardCostModifier.cardType`.
- PROTOCOL.md documents the two triggers. The render's cast labels gained ON KILL and INTERCEPT.

**The fairness test (`engine/src/dev/signatureFairness.ts`).**
- `reference` caches the plain-3/6-everywhere ring per seed (`signatureReference.json`).
- `candidates` tests table lines.
- `tune` walks the stat line toward zero net change (attack 0-6, health 1-9), then confirms at
  2,500 seeds.
- `pairedChange` is the per-seed paired difference with its interval.
- `signatureZoneReport.ts` now imports the shared `REFERENCE_SIGNATURE`.

**Measured (`progress/balance-report-023-signature-menu.txt`, raw data in
`progress/signature-fairness/`).**
- On the cost-5 table, 2 of 48 pass: Recycle 3/6 and Tax 3/6.
- The tuner finds no passing line for the other 14 options. One attack point is worth ~5 points
  and health almost nothing, and a net-even line still splits the factions by 3-6 points (Aegis
  loses most).
- Guardian is the strongest option (+40 to +47 worst edge). The 6-cost tier plays far above the
  reference, the 7-cost tier near it.

## Evidence committed

- `progress/balance-report-023-signature-menu.txt` (`npx tsx src/dev/signatureMenuReport.ts`,
  from the committed JSONL; commands in `progress/signature-fairness/README.md`).
- `progress/sample-match-030-signature-menu.txt` (`npx tsx src/dev/signatureMenuMatchDemo.ts`):
  a real Lookahead Cortex (Hunter) vs Aegis (Bulwark) game. Bulwark pulls two of Hunter's attacks
  onto itself, dies, goes back to the zone, and Hunter grows +1/+1 from the kill.
- `engine/test/signatureMenu.test.ts`, 28 tests:
  - the menu and the table, and refusals;
  - Commander's aura, Tax, Hunter (kill, trade, Rush), Bulwark (first attack only, reset, an
    attack already aimed at it), destroy credit;
  - every one of the 16 options firing in real Lookahead games;
  - `pairedChange`.
- Both ring checks (gate and signature mode) reproduce their baselines exactly.
- `npm test`: 506 across six workspaces, all pass (engine 177, protocol 7, server 23,
  agents 17, economy 43, render 239). `tsc --noEmit` is clean in all six.

## Concrete next step

Check the alternation first: if the last merged PR is this one (game lane), the next session is
**render**. Render can show `signatureReturn` / `fromSignatureZone`, plus the new ON KILL /
INTERCEPT triggers and Bulwark's `attackRedirected` in the arena.

The next **game-lane** session reads the owner's answer to the menu check-in. With no answer, it
takes **option A**:
1. Add tuner levers beyond stats: the ability's own magnitude (as data parameters on the menu
   options) and the cost tier, with attack kept at 2 or more.
2. Re-run the 16 options. Write rework proposals for the ones that still fail (Guardian and
   Bulwark first).
3. Then the economy: the signature card as the agent's bound promo (PR- numbering) and
   `generateAgent`.
