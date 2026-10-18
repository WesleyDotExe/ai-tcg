# Current status

**Build-order stage: Stage 4+ (the living system). Session 46 (game lane) built the owner's starter
guarantee: every new owner sees at least one hit (Full Art or better) across the 3 starter packs.
It also proposed the game lane's plan for victory boasts (not built). One [OWNER CHECK-IN] is in
notes-for-owner.md.**
- **The starter guarantee** (option A, the owner's example): the owner's last unopened starter pack
  gets a hit in its shine slot when their opened starter packs had none, drawn like hit pity, worked
  out from pack history at opening. The pack and tear never change; the opening records `starterHit`.
- **Measured** (`progress/pack-sim-003-starter.txt`, 200,000 owners): owners with a starter hit
  45.8% -> 100%; hit copies per new owner 0.555 -> 1.098; packs after the starters move by
  hundredths. Through the store (`progress/economy-demo-011.txt`): 1,000 of 1,000 owners see a hit.
- **Victory boasts:** game-lane plan and 6 decisions with suggested defaults in the check-in.

## What stands (this session's work; sessions 1-45 otherwise unchanged)

- `economy/src/packs.ts`: `rollPack(..., options)` with `RollOptions.starterHit` (the same draws as
  a due hit pity; without it a pack rolls exactly as before, seed pins unchanged);
  `PackRoll.starterHit`.
- `economy/src/store.ts`: `starterHitDue` (private), `PackOpening.starterHit`, `starterHit` in the
  logged `pity_json`.
- `economy/src/dev/starterSimulation.ts` (new): methods none / A (built) / B (comparison).
- `economy/src/dev/starterGuaranteeDemo.ts` (new): the store end to end.
- `economy/test/packs.test.ts`: 6 new tests (the roller, two misses then the hit, an early hit,
  other packs and any order, a 10-pack open, 60 owners).
- ECONOMY.md "Starter collection": the guarantee.
- `npm test`: all six workspaces pass (817 tests); typecheck clean in every workspace.

## Concrete next step

Check the alternation first: this PR follows render's #76, so the next session is **render**.

The next **game-lane** session (session 47):
1. The owner's answers to the session-46 check-in, if any: option B for the guarantee (default:
   keep A), and the 6 boast decisions. If the boast decisions are answered, build the game-lane half
   (cosmetics catalogue, owned cosmetics, the 4 starter boasts, per-agent loadout, the loadout saved
   on the match record; schema v11 with a migration for existing owners), with tests and a demo.
2. Otherwise **a hardening pass** (two sessions overdue): re-run the signature approved list's
   10,000-game check with the session-41 agent; give `signatureRingDrivers.ts` and
   `aegisSignatureGain.ts` a main guard and a smoke test; work down quality-debt.md.
3. Then roadmap 2b: the deck-building agent.

**Blocked:** nothing.
