# Current status

**Build-order stage: Stage 4+ (the living system). Session 35 (game lane) handled the owner's
2026-10-15 answers to session 34:**
- the signature pool re-measured at 10,000 games per edge;
- combinations may repeat (schema v7);
- themed, templated signature card names, with the rare username variant;
- 5 new sizes measured.

No stage checkpoint (the living system reports through notes-for-owner check-ins). There is an
**[OWNER CHECK-IN]** in notes-for-owner.md with defaults: username odds, the art pool plan, where
the deck builder and play styles go, and agent names.

## What stands (this session's work; sessions 1-34 otherwise unchanged)

**Measuring (`engine/src/dev/signatureFairness.ts`).**
- The cached reference (`signatureReference.json`) holds 10,000 games per ordered pairing. Its
  first 2,500 are exactly the old reference, so every earlier command still reproduces.
- `remeasure --ids ... | --approved`: named lines (any stat line, by combo id) at full results.
- `grid --sizes`: only some sizes.
- `parseSignatureComboId` (the inverse of `signatureComboId`, round-trip checked).

**The approved list (`engine/src/data/signatureApproved.ts`).**
- A line's **largest** measurement now decides (`signatureApprovedList.ts`): 14 lines over 7
  options.
- Guardian (Barrier) 3/5 joins at 1.87.
- Energy surge 2/8 and 2/9 (2.20, 2.22) and Restore r1 3/4 (2.08) leave: they passed at 2,500
  and fail at 10,000.

**New sizes (`engine/src/data/signatureMenu.ts`).**
- Smite: `d2m3` (2 damage to a unit with 3 or less health), `d1hp15` and `d2hp15` (only if you
  have 15 or less health).
- Sweep: `hp15` and `r2hp15`.
- None passes. The best is 4.0 at 1,000 games; the 2 best per option re-measured at 10,000 fail at 3.5-4.6.

**Names (`engine/src/data/signatureNames.ts`).**
- 5 grammatical templates with slot-tagged, themed lists: 1,992 handles (60 plain plus filtered
  compounds), 135 modifiers, 10 ability groups of things plus 40 generic, 56 places, and 15
  editions. About 15 million names per option.
- The filter refuses repeats, names over 30 characters and blocked words (whole-token for short
  roots).
- `USERNAME_HANDLE_ODDS = 30`, and `usernameHandle` checks the username.
- `agentGenerator.ts` uses it, and no longer filters taken combinations. `generateSignatureCandidates`
  takes `{ username, approved }`.

**Economy (schema v7, `economy/src/schema.ts`, `store.ts`).**
- `signature_cards` is rebuilt without `UNIQUE(combo_id)`, and its triggers are made again.
- `pickDraftAgent` passes the owner's login username.
- `confirmAgentDraft` refuses only a name clash.

**Render:** `generatedSignatures.ts` drops the combo set (one-line API follow-up). 290/290 pass.

## Evidence committed

- `progress/balance-report-026-signature-10k.txt` (`npx tsx src/dev/signatureTenThousandReport.ts`
  from the committed JSONL; commands in `progress/signature-fairness/README.md`).
- `progress/signature-names-sample-001.txt` (`npx tsx src/dev/signatureNameSamples.ts`).
- `progress/economy-demo-005.txt` (`npx tsx src/dev/generateAgentDemo.ts` in economy/): v7, two
  recorded matches, and 42 agents over 13 combinations with 42 distinct names.
- Tests:
  - engine: `signatureNames.test.ts` (8) and the new-size tests (2);
  - economy: the v6 -> v7 migration step, combinations repeating, the username variant;
  - updated generator tests.
- Both ring checks reproduce their baselines exactly (PASS).
- `npm test`: 594 across six workspaces, all pass (engine 204, protocol 7, server 23, agents 17,
  economy 53, render 290). `tsc --noEmit` is clean in all six.

## Concrete next step

Check the alternation first. If the last merged PR is this one (game lane), the next session is
**render**. Render can show the themed names (the replays already take them from the generator).

The next **game-lane** session reads the owner's answer to the check-in. With no answer:
1. Roadmap item 5: pack contents and opening (5 cards + the shine slot, pity timers per owner,
   pack points, the Prototype bonus 6th card, NEW and "×N owned", 10-pack bulk opening), tested
   by simulation. Build the art-pool slot on signature cards with the next schema change.
2. Then the deck-building agent (best faction and deck from the owner's holdings; the owner can
   force a deck or faction), then play styles, then build-order step 3.
