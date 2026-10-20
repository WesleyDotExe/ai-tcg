# Current status

**Build-order stage: Stage 4+ (the living system). Session 52 (game lane): roadmap 2b part 2, play
styles, built and measured. Nothing is blocking.** One [OWNER CHECK-IN] in notes-for-owner.md (the
presets and the fair-vs-visible trade-off; every call has a default). The owner's built-deck balance
measurement is on the roadmap as a hard gate before the public launch.

- **The styles** (`engine/src/agents/playStyles.ts`): six presets of the LookaheadAgent's weights:
  Calculator (today's agent, move for move: a test replays 16 matches and compares logs), Rusher,
  Controller, Tempo, Fortress, Gambler. The weights: face, cards, energy, trade, risk, removal,
  protect, develop, toughness, reserve (hold energy for an Instant in hand), margin (Gambler's pick
  among near-best moves). `LookaheadAgent(name, seed, { style })` takes a preset id or raw weights;
  `bestMoves(view, legal)` is public (the ring asks what Calculator would have done).
- **The ring** (`engine/src/dev/playStyleRing.ts`): every pair of styles x 16 faction pairings x both
  seats (styles swapped on the same deal), approved signature cards as in a real match; score against
  the field, head to head, by faction, against Calculator, and behaviour (attacks at health, cards,
  units lost, unspent energy, share of decisions off Calculator's best). Sharded (`--shard i/k`) and
  merged by `report`. Proposed rule: each style within 2 points of 50% against the field.
- **Measured** (`progress/play-style-ring-001.txt`, seeds 5001-5300, 48,000 games per style): Calculator
  50.8, Rusher 51.2, Controller 49.2, Tempo 51.0, Fortress 48.5, Gambler 49.3. Off Calculator's best:
  4.9% (Controller) to 10.7% (Rusher). `progress/play-style-demo-001.txt`: the same deal, each style.
- **The store** (schema v13): `agents.play_style` (default calculator), `setPlayStyle` (any time; a
  live match keeps the style it started with: `LiveSide.playStyle`, `live_matches.p1/p2_style`), and
  `MatchRecord.playStyles` (null before v13 or for matches never started live).
  `progress/economy-demo-015.txt`.

## What stands (this session's work; sessions 1-51 otherwise unchanged)

- New: `engine/src/agents/playStyles.ts`, `engine/src/dev/playStyleRing.ts`,
  `engine/src/dev/playStyleDemo.ts`, `economy/src/dev/playStyleDemo.ts`, migration 13. Changed:
  `lookaheadAgent.ts` (weights from the style; `reservePenalty`, `decideWithMargin`, `sideScale`,
  `bestMoves`), `economy/src/store.ts` (agent style, live and recorded styles).
- Tests: `engine/test/playStyles.test.ts` (8: presets, Calculator identical, Rusher, Fortress, reserve,
  Gambler, every style finishes, the ring's sharding and point sum) and `economy/test/playStyle.test.ts`
  (4: default and refusals, mid-match change applies next match, offline matches, v12 -> v13).
- `npm test`: all six workspaces pass (1,047); typecheck clean everywhere. `ring` and `ring:real`
  re-run: PASS, every edge change +0.0 (Calculator is unchanged).

## Concrete next step

Check the alternation first: this PR follows render's #88, so the next session is **render** (boast
slice 4, the loadout picker, per the owner's render-session-35 answers).

The next **game-lane** session (session 53):
1. The owner's word, if any (the play-style check-in has 6 calls and options A/B/C, default A).
2. Roadmap 2b, part 3: the deck builder measures with the owner's style (pass the style into
   `playGauntlet`/`chooseDeck` so a Rusher builds the deck it plays best), and the store's
   `buildAgentDeck` uses the connected agent's style; rebuild when the style changes.
3. Or, if a session has room: the pre-launch built-deck ring (roadmap "Standing: built-deck balance
   before launch"), which needs no new code beyond a driver: `chooseDeck` per faction from full and
   from starter-plus-packs collections, then the six ring edges with built decks on both sides.
4. Session 55 is a hardening pass (every 5th).

**Blocked:** nothing.
