# Current status

**Build-order stage: Stage 4+ (the living system). Session 33 (game lane) did the owner's
2026-10-13 answers: the tuner's size and cost levers, Guard over Bulwark, and the signature card
can't be sold.** Step 2 isn't finished (Guardian and Bulwark need the owner's rework call, and
generating an agent is left), so there's no stage checkpoint. There is an **[OWNER CHECK-IN]** in
notes-for-owner.md with a default (option A).

## What stands (this session's work; sessions 1-32 otherwise unchanged)

**The size lever (`engine/src/data/signatureMenu.ts`).**
- `MenuOption.sizes`: every option except Guardian and Bulwark has smaller and/or larger sizes.
  Each is the same mechanic turned down or up: a number, a narrower target, or an "only while"
  condition. The owner's text stays the standard size.
- `SignatureSpec.size`, `optionAtSize`. A sized card's id carries the size
  (`sig5-3x6-smite.d2`), and `signatureSpecProblem` refuses unknown sizes.
- `allSignatureSpecs` still lists the 303 standard combinations.

**The tuner (`engine/src/dev/signatureFairness.ts`).**
- `leverConfigs` lists every size x tier x extra (the 6-cost keyword, the 7-cost aura).
- `tuneWithLevers` works in three passes:
  1. every table line of every config at 300 seeds;
  2. the stat walk from the 3 best configs at 500 seeds;
  3. the 3 best lines re-measured at 2,500 seeds.
- `MIN_TUNED_ATTACK = 2` (owner rule). New command: `levers`.

**Engine additions, all generic.**
- New Condition kinds:
  - `guardInPlay`, used by Bulwark: `not guardInPlay controller` (Guard takes priority);
  - `attackTargets` (unit or player), used only by the rework probes;
  - `all` and `any`.
- `activeGuards(state, pid)` in `state/queries.ts`, shared by the attack-move rule and the
  condition.
- `getLegalMoves` no longer offers a once-per-turn activated ability already used that turn.

**Economy.**
- Schema migration 5: a signature copy (`origin_ref` `signature:<agentId>`) must be a bound promo.
  The schema also refuses relabelling a copy into or out of being one.
- `grantCopy` binds it whatever the caller says, and refuses any other origin.
- ECONOMY.md updated.

**Measured (`progress/balance-report-024-signature-levers.txt`, raw data in
`progress/signature-fairness/levers-*.jsonl` and `reworks.jsonl`).**
- **6 of 16 options pass** (2 in session 32):
  - Recycle (1 card, 3/6);
  - Supply line (only from a hand of 2 or fewer, 3/6);
  - Rally (+0/+1, 3/6);
  - Restore (one random unit, 3/6);
  - Tax (3/6);
  - Inspire (+0/+1, 3/4, off the table).
- Near misses (worst edge 2.4-2.6): Smite 1 damage, Energy surge, Sweep on 2 random units.
- Failing at every size and tier: Commander's aura, Hunter, Shield wall, Suppress, Dampen,
  Guardian, Bulwark.
- Rework probes (`engine/src/dev/signatureReworkProbe.ts`):
  - Guardian as Barrier only: 2.1, misses by 0.1;
  - Guard only: 8.1;
  - Bulwark "units only": 3.9; "face only": 6.0; "pay 1 to intercept": 4.4.

## Evidence committed

- `progress/balance-report-024-signature-levers.txt`
  (`npx tsx src/dev/signatureLeversReport.ts`, from the committed JSONL; the commands are in
  `progress/signature-fairness/README.md`).
- `progress/sample-match-031-bulwark-guard.txt` (`npx tsx src/dev/bulwarkGuardMatchDemo.ts`): a
  real Cortex vs Aegis (Bulwark) game. On turn 13 the first attack is forced onto Barrier Drone
  (Guard) and Bulwark stands aside. Once the Drone is dead, Bulwark takes the next attack.
- Tests:
  - engine `signatureMenu.test.ts` +8: Guard over Bulwark (3 cases), sizes (3), `attackTargets`,
    once-per-turn gating;
  - economy `store.test.ts` +1, plus the v4 -> v5 migration step.
- Both ring checks (gate and signature mode) reproduce their baselines exactly.
- `npm test`: 533 across six workspaces, all pass (engine 185, protocol 7, server 23, agents 17,
  economy 44, render 257). `tsc --noEmit` is clean in all six.

## Concrete next step

Check the alternation first. If the last merged PR is this one (game lane), the next session is
**render**. Render can show:
- the signature zone (`signatureReturn` / `fromSignatureZone`);
- the ON KILL / INTERCEPT triggers;
- Bulwark's `attackRedirected`.

The next **game-lane** session reads the owner's answer to the check-in. With no answer, it takes
**option A**:
1. Add Barrier-only as Guardian's sizes, and "units only" as Bulwark's, in the menu data.
2. Run a finer tuner pass (more starting points, 1,000-seed walk) on Guardian and the three near
   misses (Smite d1, Energy surge, Sweep r2).
3. Build `generateAgent`: 3 generated agents, then 3 signature candidates drawn only from lines
   that passed at 2,500 seeds, no two agents sharing a combo id. The signature copy is granted
   with `origin: "promo"`, `originRef: "signature:<agentId>"` and the next PR- number.
