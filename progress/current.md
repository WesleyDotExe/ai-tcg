# Current status

**Build-order stage: Stage 4+ (the living system). Session 36 (game lane) handled the owner's
2026-10-16 answers to session 35 and the name-pattern entry, and built step 1 of the accepted
order:**
- the username in a card name 1 candidate in 100;
- name patterns 61 / 30 / 9 ([Handle]'s / "of the [Place]" / the rest), and themed agent names
  from the same generator;
- the signature art-pool slot (schema v8);
- **pack contents and opening** (roadmap item 5): set S0 with collector numbers, the versioned
  odds table, pity per owner, the Prototype bonus, NEW and "×N owned", 1- or 10-pack opening,
  pack points, crafting.

No stage checkpoint (the living system reports through notes-for-owner check-ins). There is an
**[OWNER CHECK-IN]** in notes-for-owner.md with defaults: the shine slot's rarity weights, Alt Art
on Rares and Mythics, which 15 cards get Prototype runs, and Prototypes in Season 0.

## What stands (this session's work; sessions 1-35 otherwise unchanged)

**Names (`engine/src/data/signatureNames.ts`).**
- `USERNAME_HANDLE_ODDS = 100`.
- `TEMPLATE_WEIGHTS` 41 / 20 / 30 / 5 / 4. The template is drawn once and only its words are
  re-rolled, so the filter can't skew the split (`drawSignatureCardName` returns the template).
- Every place starts "the".
- `agentName` and `AGENT_TEMPLATE_WEIGHTS` ([Handle]'s [Program] 61, [Handle] of the [Place] 30,
  [Modifier] [Handle] 5, [Handle] [Edition] 4; 50 program nouns; ~510,000 names).
- `generateAgentCandidates` uses it; the 3 candidates never share a final word.

**Packs (`economy/src/packs.ts`, `economy/src/config.ts` `PACK_ODDS`).**
- `CARD_SETS` / `cardSet("S0")`: 96 cards, collector and Gold numbers, 15 Prototype runs (proposed
  cards).
- `rollPack(seed, set, pity, prototypesLeft)` is pure; `pityDue`, `nextPity`, `FULL_ART_OR_BETTER`.

**Economy (schema v8, `economy/src/schema.ts`, `store.ts`).**
- `signature_cards.art_pool` / `art_slot` (drawn in `confirmAgentDraft`, `artSlot` option for
  tests; kept forever); `SignatureCardRecord.art`; `signatureArtRef`.
- `pack_openings` (append-only), with triggers on packs and pack copies.
- `openPack`, `openPacks(owner, 1 | 10)`, `packOpening`, `pityStatus`, `prototypesFound`,
  `craftCard`. `buyPack` and `grantPack` refuse an unknown set.

## Evidence committed

- `progress/pack-sim-001.txt` (`npx tsx src/dev/packSimulation.ts` in economy/): 400,000 packs
  against the published rates, pity over 2,000 owners, a season of Prototypes, packs to see the set.
- `progress/economy-demo-006.txt` (`npx tsx src/dev/packOpeningDemo.ts` in economy/): the store
  end to end in a real database file, and the schema's refusals. Reproduces exactly.
- `progress/signature-names-sample-002.txt` (`npx tsx src/dev/signatureNameSamples.ts` in engine/).
- Tests:
  - economy: `packs.test.ts` (19), and the v7 -> v8 migration step;
  - engine: 3 new name tests and 1 agent-name test.
- `npm test`: 622 across six workspaces, all pass (engine 208, protocol 7, server 23, agents 17,
  economy 72, render 295). `tsc --noEmit` is clean in all six.

## Concrete next step

Check the alternation first. The last merged PR before this one (#56) was render, so this
session was game lane, and the next session is **render**. Render can show set collector numbers
and finishes on cards, and the new agent names in replays.

The next **game-lane** session reads the owner's answer to the check-in. With no answer:
1. **The deck-building agent** (step 2 of the order): from an owner's collection (`collection`,
   `COPY_LIMITS`), build the best deck it can for each faction, pick the best faction (or the
   owner's forced faction or deck), and measure its decks against the shipped decks with the ring
   tooling.
2. Then about 6 play styles with a fairness ring, then build-order step 3 (website endpoints,
   including the pack-opening calls built here).
