# Current status

**Build-order stage: Stage 4+ (the living system). Session 51 (game lane): roadmap 2b, the
deck-building agent, built and measured. Nothing is blocking and no check-in is open** (one note for
the owner with 5 calls and a finding, all with defaults).

- **The builder** (`engine/src/deckbuilder/`): `cardRating.ts` (a data-driven prior: stats, keywords,
  triggers, effects, statics, modes, priced in stat points) and `deckBuilder.ts` (`chooseDeck`,
  `buildFaction`, `constructDeck`, `playGauntlet`). Two starts per faction (greedy by rating and the
  shipped curve; the designed list as far as held, topped up), a search of one-copy changes played
  against the four shipped decks, a fresh-seed confirm that keeps the best. Every deck rule held, and
  no evolution without its base; `buildDeck` re-checks the result.
- **The store** (schema v12): `owners.deck_choice` (`agent` default, `forced`), `decks.built_by_agent`
  (one per owner). `buildAgentDeck(owner, options)` builds in the faction lock (the forced faction)
  or the best faction, saves/rebuilds "Agent's deck" and makes it active; `setActiveDeck` forces a
  deck; `setDeckChoice` switches back. `startMatch` says when an agent-choice owner has no deck yet.
- **Measured** (`progress/deckbuilder-report-001.txt`): from a full collection the built deck beats
  its faction's shipped deck in all four (Cortex +5.3, Swarm +7.6, Aegis +14.3, Null +2.2 points,
  2,000 fresh games each). Starter-only: the starter list with up to 2 cuts (+0 to +3.6).
  `progress/economy-demo-014.txt`: real owners, packs opened with the live roller, builds, the lock,
  a forced deck, 12 recorded matches with built decks.

## What stands (this session's work; sessions 1-50 otherwise unchanged)

- New: `engine/src/deckbuilder/cardRating.ts`, `engine/src/deckbuilder/deckBuilder.ts`,
  `engine/src/dev/deckBuilderReport.ts`, `economy/src/dev/agentDeckDemo.ts`; exported from both
  packages' index. Migration 12 in `economy/src/schema.ts`; store methods in `economy/src/store.ts`.
- Tests: `engine/test/deckBuilder.test.ts` (13: complete rating, legal decks in every faction from a
  full collection and from 40 random partial ones, starter-only, the designed start, infeasible with
  a reason, forced faction, determinism and the confirm rule) and `economy/test/agentDeck.test.ts`
  (8: the default, rebuilt in place, the lock, forced and back, refusals, one agent deck per owner in
  the schema, games, the v11 -> v12 migration).
- `npm test`: all six workspaces pass (1,018 tests); typecheck clean everywhere.

## Concrete next step

Check the alternation first: this PR follows render's #86, so the next session is **render** (Match
Boot slice 1 with the two end-of-match fixes, per the owner's render-session-34 answers).

The next **game-lane** session (session 52):
1. The owner's word, if any (the deck-builder note has 5 calls with defaults).
2. Roadmap 2b, part 2: about 6 play styles with a fairness ring (draft set: Rusher, Controller,
   Tempo, Fortress, Gambler, Calculator; presets of the Lookahead brain; owner-picked, applies from
   the next match). The deck builder should take the style into account later (a style plays the
   deck it builds), so pass the agent into `playGauntlet` when styles exist.
3. If a session has room before that: the ring among built decks (each faction's built deck from a
   full collection, the six ring edges), since real agents will play built decks.

**Blocked:** nothing.
