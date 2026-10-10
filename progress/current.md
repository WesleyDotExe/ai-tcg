# Current status

**Build-order stage: Stage 4+ (the living system). Session 31 (game lane) did the owner's
2026-10-10 game-lane answers and the next piece of build-order step 2: the engine's signature
zone.** Step 2 isn't finished (the Neutral menu, its fairness test, the bound signature promo and
generating an agent are left), so there's no stage checkpoint. There is an **[OWNER CHECK-IN]** in
notes-for-owner.md about the ring re-baseline.

## What stands (this session's work; sessions 1-30 otherwise unchanged)

**Schema v4 (`economy/src/schema.ts`, migration 4; owner 2026-10-10 answer 1).**
- Promo and prize copies are no longer account-bound: they can be sold on a future marketplace.
  Migration 4 drops v3's "always bound" insert trigger and unbinds the copies v3 bound, lifting
  "a bound copy stays bound" for that one UPDATE and putting it straight back.
- Salvage still refuses them (v2's CHECK only salvages standard set copies from packs), and the
  card viewer's reason is "Promo/Prize copies can be kept or sold, never salvaged".
- A copy of any origin can still be granted bound on purpose (`accountBound: true`), which is what
  the signature card will use.

**The signature zone (engine).**
- `DeckSpec.signature?: UnitCard`; `PlayerState.signature: { card, timesPlayed, inZone } | null`,
  public in `PlayerView` for both sides.
- The new move is `{ type: "playSignature", target? }`, offered when all of these hold:
  - Sorcery timing;
  - a free board slot;
  - enough energy for `signatureCost`: the card's effective cost plus `SIGNATURE_REPLAY_SURCHARGE`
    (2) for each earlier play.

  A chosen-target onPlay gets one move per legal target, just like a Unit from the hand.
- Hand and signature plays share `putUnitOnBoard` in `engine.ts`. A signature unit is marked
  `signature: true` and never evolves.
- On death (`processDeaths`):
  - the card goes back to the zone, not the graveyard, and its Tools still go down;
  - a `signatureReturn` event carries `nextCost`;
  - the `play` event of a signature play carries `fromSignatureZone` and `cost`.
- `createInitialState` refuses a signature card that isn't a plain Unit, or that is an evolution.
- Agents:
  - Lookahead scores a signature play like the same Unit from the hand, at its current cost;
  - both Aggressive agents treat it as a card play at its current printed cost.
- `withSetMythicSignature(deck)` moves a deck's one set Mythic into the zone (the ring's stand-in).
- `PROTOCOL.md` documents the move kinds and the zone.

**Ring measurement (`progress/balance-report-022-signature-zone.txt`,
`engine/src/dev/signatureZoneReport.ts`).**
- With the set Mythics as signature cards, 4 of the 6 edges moved 10 to 24 points. Examples:
  Aegis > Cortex 52.2 -> 75.9 and Null > Aegis 48.2 -> 29.4.
- The cause is guaranteed access: Mythics are played in 92-97% of games instead of ~26%, apart
  from Null Singularity at 29%. Replays are rare.
- An identical plain 5-cost 3/6 signature card on both sides moves the ring by up to 8 points,
  with Aegis gaining most.
- **The gate is unchanged** (`ringBaseline.json`, decks as shipped, still passing). The signature
  mode is a second baseline: `ringBaselineSignature.json`, `npm run ring:signature -w @ai-tcg/engine`,
  and a second CI step.

## Evidence committed

- `progress/sample-match-029-signature-zone.txt` (`npx tsx src/dev/signatureZoneMatchDemo.ts`): a
  real Lookahead Cortex-vs-Swarm game. Hive Mother is played for 5, dies, returns to the zone
  ("next play costs 7"), and is replayed for 7. Quorum Arbiter is played for 5.
- `progress/balance-report-022-signature-zone.txt` (`npx tsx src/dev/signatureZoneReport.ts`, ~25 s).
- `engine/test/signatureZone.test.ts` has 13 tests:
  - setup, publicity, refusals, timing, slots, targets, play, return and surcharge;
  - Tools to the graveyard, no evolving, the stand-in helper;
  - 40 real Lookahead games checking conservation of the card and the cost of each replay;
  - Aggressive playing it.

  `ringRegression.test.ts` checks the second baseline file. `economy/test/store.test.ts` covers
  the v3 -> v4 migration, unbound promos and prizes that still can't salvage, and a bound promo
  that stays bound.
- The gate ring check reproduces its baseline exactly after the engine refactor, so a deck
  without a signature card plays byte-identically.
- `npm test`: 455 across six workspaces, all pass (engine 149, protocol 7, server 23, agents 17,
  economy 43, render 216). `tsc --noEmit` is clean in all six.

## Concrete next step

Check the alternation first: if the last merged PR is this one (game lane), the next session is
**render**. Render can pick up the owner's 2026-10-10 render items (the arpeggio setting) and
show `signatureReturn` / `fromSignatureZone` in the arena.

The next **game-lane** session reads the owner's answer to the ring check-in in owner-feedback.md.
With no answer, it takes **option A**:
1. Build the 16-option Neutral ability menu x the 3 cost tiers as card data from existing effect
   kinds (ECONOMY.md "Unique Mythic").
2. Build the fairness test against the "same plain signature card on both sides" reference. A
   candidate swapped in for one faction's plain stand-in may move that faction's edges by 2 points
   at most.
3. Then the economy: the signature card as the agent's bound promo (PR- numbering) and
   `generateAgent` (3 agents, then 3 signature candidates, pick, confirm; no starter packs).

Then raise the step-2 [OWNER CHECK-IN]: faction choice, deck building from the collection, quests.
