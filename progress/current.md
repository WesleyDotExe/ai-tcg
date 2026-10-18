# Current status

**Build-order stage: Stage 4+ (the living system). Session 42 (game lane) put the 3 Zero-Day cards
live (owner OK 2026-10-18) and investigated Aegis vs Cortex (no card changed; a fix is proposed at
a new [OWNER CHECK-IN]).**
- **Zero-Day live:** `ZERO_DAY_CARDS` are in `CARD_REGISTRY` (`engine/src/data/registry.ts`). The
  economy's set leaves `topTier` cards out of the base list (still 96 cards, no Gold/plain version);
  the secret entries 226-228/096 take their names from the cards. A pulled copy saves, loads and
  plays; `craftSecret` crafts them at 3,000; `craftCard` refuses them; a Zero-Day card can only be
  recorded in the Zero-Day finish (`chaseCopyProblem`).
- **Aegis vs Cortex:** the 52.2 -> 49.3 move is entirely Cortex's pilot (crossing old/new agents
  per seat); Mainframe Core is played 38.5% -> 45.7% of games. Of three measured trials, only
  Mainframe Core +1/+0 moves the gate edge by a real amount (53.0%), but it moves the signature-mode
  edge further out (71.5 -> 74.8).

## What stands (this session's work; sessions 1-41 otherwise unchanged)

- `engine/src/data/registry.ts`, `zeroDayCards.ts` (header: live).
- `economy/src/packs.ts` (base set filters `topTier`), `chase.ts` (Zero-Day entry names from the
  registry, checked to be a Mythic Zero-Day card), `store.ts` (craftCard refusal, the Zero-Day-only
  finish rule, messages no longer say "build-order step 2").
- `economy/src/dev/zeroDayLiveDemo.ts` (new) -> `progress/economy-demo-010.txt`.
- `engine/src/dev/aegisCortexShift.ts` (new): the 2x2 pilot split with per-card use.
- `engine/src/dev/cortexAuraTrials.ts` (new): Mainframe Core trials on every Cortex edge, both modes.
- Tests: `economy/test/chase.test.ts` (a pulled copy plays in a real match; 1 per deck; crafting at
  3,000; no plain/Gold version; never in a base slot), `packs.test.ts` (96 base cards),
  `engine/test/modalCards.test.ts` (live at the approved numbers), `render/test/packOpening.test.ts`
  (the real card on a Zero-Day pull; the reserved face still tested on a non-existent id).
- `render/output/pack-opening.html` regenerated (its Zero-Day pull shows Patient Zero).
- `npm test`: all six workspaces pass; `tsc` clean in engine, economy, render; both ring modes PASS
  (unchanged: no shipped deck holds a Zero-Day card).

## Concrete next step

Check the alternation first: this PR follows render's #68, so the next session is **render** (slice
3, the first-time flow; also: the Zero-Day card face shows no rules text, since its text is in its
modes).

The next **game-lane** session:
1. The owner's answer to the Aegis vs Cortex check-in. Default A: Mainframe Core +1/+0
   (`engine/src/data/cards.ts` `mainframeCore`, aura `health: 0`, text), re-record both ring
   baselines (`npx tsx src/dev/ringRegression.ts --write-baseline`, and with `--signature`), commit
   a balance report, regenerate nothing else.
2. Then roadmap 2b: the deck-building agent (best faction and deck from an owner's holdings, or the
   forced deck/faction). Zero-Day cards are now ownable, so it must handle 1-per-deck and the
   removal share.
3. Quality debt: re-run the signature approved list's 10,000-game check with the new agent.

**Blocked:** nothing.
