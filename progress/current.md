# Current status

**Build-order stage: Stage 4+ (the living system). Session 41 (game lane) fixed the reference agent
(owner 2026-10-18, option A), re-recorded both ring baselines once, and re-measured and tuned the 3
Zero-Day cards to the owner's cap. The cards are tuned but NOT live; going live waits on the
owner's OK.**
- **LookaheadAgent** (`engine/src/agents/lookaheadAgent.ts`): one path for every unit's own statics,
  onDeath and turn triggers (plain or modal; `estimateModeAbilities` is gone); auras over a 3-turn
  horizon; scaling self-stats count the played unit and only the difference from the printed stat;
  statuses by kind and duration (`statusValue`; Stasis 1.0 x attack per turn held, decaying 0.8;
  Overload as damage; Barrier +1.5, no longer negative on your own unit).
- **Better player:** +1.5 points [0.9, 2.0] head to head against the session-40 agent over 64,000
  games (`dev/agentHeadToHead.ts`).
- **Ring re-baselined once** (both modes). Gate moves: Aegis > Cortex 52.2 -> 49.3 (a real move
  further out), Null ~ Cortex, Aegis ~ Swarm and Cortex > Swarm IN -> UNRESOLVED (within noise).
- **Zero-Day tuned:** Patient Zero's Carrier +1/+0 (was +1/+1), Root Access's Privilege Escalation
  "the number of other units" (was 1 plus), Kill Switch unchanged. Worst edges 2.73 / 3.52 / 3.52;
  every mode picked in 16.7%+ of plays for every faction.

One new **[OWNER CHECK-IN]** in notes-for-owner.md: OK to go live at these numbers (default: yes,
next game session), plus the ring moves the owner may want to act on.

## What stands (this session's work; sessions 1-40 otherwise unchanged)

**Engine.**
- `agents/lookaheadAgent.ts`: `estimateUnitAbilities` (one path), `estimateStaticEffect(view, spec,
  source?)` (aura horizon, scaling with the arriving unit), `statusValue`, constants `AURA_HORIZON`,
  `AURA_SURVIVAL`, `STASIS_TURN_WEIGHT`, `STATUS_DECAY`, `BARRIER_VALUE`.
- `data/zeroDayCards.ts`: Carrier +1/+0; Privilege Escalation base -1 (`allUnitsInPlay` counts this
  unit).
- `dev/agentHeadToHead.ts` (new): the current agent vs any earlier one, loaded by module path.
- `dev/zeroDayFairness.ts`: `--patch` (numbers merged into the card for one run, measured against
  the designed card's stand-in).
- `dev/modalMatchDemo.ts`: optional first seed.
- `dev/ringBaseline.json`, `dev/ringBaselineSignature.json`: re-recorded 2026-10-17.

**Render (tests only, seeds re-picked, no assertion loosened):** `feedModes.test.ts` (seed 5896,
checks both Kill Switch modes' rules text), `sigWardFx.test.ts` (Rate Limiter seed 12, Lockdown
Field seed 3), `sigZone.test.ts` (one more case). The render lane's committed replay pages were
generated with the session-40 agent and no longer regenerate identically; they are not re-made here.

## Evidence committed

- `progress/balance-report-028-agent-fix-zero-day-tuned.txt`: the agent change, the head-to-head,
  the ring before/after, the 3 cards at the designed numbers and 6 tuning trials, all at 10,000
  games per pairing, with the commands.
- `progress/sample-match-034-modal-cards-agent-fix.txt` (`npx tsx src/dev/modalMatchDemo.ts 5896 5
  5896` in engine/): 5 mode choices, both Kill Switch modes, an Outbreak death trigger, Carrier,
  Lockout; tuned numbers. `sample-match-033` no longer reproduces (older agent and numbers).
- Tests: `engine/test/lookaheadValuation.test.ts` (8; 7 fail on the session-40 agent).
- `npm test`: all six workspaces pass; `tsc --noEmit` clean.

## Concrete next step

Check the alternation first: this session's PR follows render's #66, so the next session is
**render** (pack opening slice 2; the committed replay pages may want regenerating with the new
agent).

The next **game-lane** session: the owner's answer to the session-41 check-in; by default:
1. Add `ZERO_DAY_CARDS` to `CARD_REGISTRY` (`data/registry.ts`): pulled copies become playable,
   `craftSecret` opens Zero-Day crafting. Add an economy test for both (a pulled copy plays in a
   deck; crafting a Zero-Day card at 3,000).
2. Check nothing in the economy's reserved-entry path still assumes "not designed yet".
3. Then quality debt: the signature approved list was measured with the session-40 agent; re-run
   its 10,000-game check with the new agent before the next signature change.

**Blocked:** going live waits on the owner's OK; nothing else.
