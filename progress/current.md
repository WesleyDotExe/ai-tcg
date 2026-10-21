# Current status

**Build-order stage: Stage 4+ (the living system). Session 54 (game lane): the pre-launch built-deck
ring (the owner's 2026-10-19 firm to-do), measured. Two deck-builder bugs found and fixed. Nothing is
blocking.** The owner's session-53 answers (keep all 3) are handled. One new [OWNER CHECK-IN] in
notes-for-owner.md (does the gate pass; the two old out-of-band edges), with defaults.

- **The ring with built decks** (`progress/built-deck-ring-001.txt`): store builds, forced to the
  starting faction, at four levels (full; 8 owners per faction at 3, 17 and 37 packs). Six edges at
  the ring check's seeds, built against built, real-match and gate modes. Built decks keep the
  ring's shape: every faction averages 46.6-54.5 against the field. In real mode Aegis is not the
  outlier (53.3 from a full collection, 55.5 with shipped decks). Null > Aegis stays OUT (inverted)
  and Cortex > Swarm stays under its band, as with the shipped decks.
- **The builder fixes** (`engine/src/deckbuilder/deckBuilder.ts`): (1) a list that runs out short of
  40 trims removal to 25% of its real size, and either start may stand alone, so a day-one Null owner
  no longer gets "no deck"; (2) the designed start fills only its gaps, up to the designed list's own
  size, so an owner holding Null's whole 36-card list gets it (it was padded to 40 and played 3-4
  points under the list). Only Null builds changed (checked file by file).

## What stands (this session's work; sessions 1-53 otherwise unchanged)

- New: `economy/src/dev/realisticCollections.ts` (starter + live-roller packs, nested levels),
  `engine/src/dev/builtDeckRing.ts` (build / ring / report, sharded), results in
  `progress/built-deck-ring/` (collections.json, builds/, rings/), `DEFAULT_BUILD` exported from the
  deck builder. Re-run: `progress/economy-demo-014.txt` and `-016.txt`, whose Null decks change
  with the fixes.
- Tests: +4 engine deck-builder tests (the short-collection and designed-start fixes; one older test
  rewritten to pass the whole designed list, as real use does), +4 seating tests, +1 driver smoke
  test, +4 collection tests. `npm test`: all six workspaces pass (1,083). Typecheck clean everywhere.
  `ring` and `ring:real`: PASS (no card, rule or agent change). Mutation checks: reverting the short-deck
  fix fails both short-collection tests; padding the designed start to 40 again fails both
  designed-start tests.

## Concrete next step

Check the alternation first. If the last merged PR is this one (game lane), the next session is
**render** (the boast's "<AGENT> WINS" message and Match Boot slice 2, per the owner's 2026-10-21
entry).

The next **game-lane** session (session 55) is a **HARDENING pass** (every 5th session):
1. The owner's word on this check-in, if any. Default: the gate passes, with no card change, and is
   re-run before launch.
2. Hardening candidates: re-run `deckbuilder-report-001` / `deckbuilder-styles-report-002` with the
   fixed builder so no committed report carries the padded Null deck; make `rebuildAgentDeckIfNeeded`
   over-ask less (count only cards the faction lock allows); look for other places that assume a
   40-card deck (grep for MAX_DECK and 40 in the builder and the store).
3. After that: roadmap 2b step 3 (exposing the settings: server endpoints, item 3).

**Blocked:** nothing.
