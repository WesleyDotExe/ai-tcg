# The Season 0 booster cards' balance re-run (game session 98, build step 4)

The owner's calls (2026-11-14, answers to game 96):
- **Call 3, the target:** a faction's whole booster package lifts its starter deck by about **+8 to +12 points**
  against the field, and the four factions land **within about 4 points** of each other.
- **Call 8, the fallback:** if it fails, tune the booster cards only (costs and stats, never a card's job, never a
  starter card), **up to two rounds**; if it is still outside the target, bring it back to the owner with the
  numbers rather than ship it.

Two instruments, both run on every round, all files in this folder or beside it:
1. **The probe** (`engine/src/dev/boosterProposal.ts 500`): each starter deck with all 7 of its booster cards in
   (Commons and Uncommons x2, Rares and the Mythic x1), 500 games against each of the four shipped decks. This is
   the measurement call 3's numbers were written against.
2. **The built-deck ring** (`progress/booster-rerun-s98/run-built-deck-ring.sh`): the store's own deck builder
   builds each faction's deck from a full collection and from 8 realistic owners per faction at 3, 17 and 37
   packs (session 97's collections from S0-odds-3 packs), then the six ring edges are played built deck against
   built deck (2,500 / 900 seeds). This is how the season's matches will really be played. The table is each
   faction's mean win rate over its three edges, real-match mode (a signature card per side); 50 is even.

## Round 0: the cards as approved (cards-2)

Probe (`probe-r0-cards-2.txt`, identical to session 96's `booster-proposal-005.txt`):
Cortex **+10.8**, Swarm **+9.3**, Aegis **+12.7**, Null **+17.1**. Spread 7.8. **Fails** (Null over, spread over).

Ring (`progress/built-deck-ring-008.txt`; the pre-booster ring, `built-deck-ring-007`, for comparison):

| faction | shipped decks | full | 37 packs | 17 packs | 3 packs |
|---|---|---|---|---|---|
| Cortex | 47.1 | 49.0 | 46.2 | 47.3 | 48.6 |
| Swarm | 47.5 | 41.5 | 46.6 | 46.4 | 49.1 |
| Aegis | 53.2 | 66.1 | 45.4 | 47.7 | 51.2 |
| Null | 52.1 | 43.4 | **61.8** | **58.6** | 51.1 |
| spread | 6.1 | 24.6 | 16.4 | 12.3 | 2.6 |
| (before the booster cards, 007) | | 5.1 | 4.5 | 4.3 | 6.4 |

Null's realistic decks (3x Bad Sector, 3x Reaper Thread, 3x Zombie Fork, 2x Heap Spray, Heat Death) were the
outlier: 62% against the field at 37 packs.

## Round 1, KEPT (cards-3)

Changes (stats only, no cost, rarity or ability): **Zombie Fork 2/2 -> 1/2, Heap Spray 2/4 -> 2/3, Decay Engine
2/4 -> 2/3, Aegis Overwatch 3/5 -> 2/5** (Guard kept).

Probe (`probe-r1-kept.txt`, with leave-one-out, the blank-body control and singles):
Cortex **+10.8**, Swarm **+9.3**, Aegis **+9.8**, Null **+12.3**. Spread **3.0**. **In the target**, Null 0.3
over +12 (inside its 95% interval).

Ring (`progress/built-deck-ring-009.txt`):

| faction | shipped decks | full | 37 packs | 17 packs | 3 packs |
|---|---|---|---|---|---|
| Cortex | 47.1 | 50.5 | 48.9 | 50.0 | 49.5 |
| Swarm | 47.5 | 43.1 | 49.1 | 49.1 | 49.5 |
| Aegis | 53.2 | 62.2 | 46.2 | 47.8 | 50.3 |
| Null | 52.1 | 44.2 | 55.7 | 53.0 | 50.7 |
| spread | 6.1 | 19.1 | **9.5** | **5.2** | **1.2** |

Against the shipped decks (the builds' 400-game confirm), the built decks at 37 packs score Cortex 65.5, Swarm
60.2, Aegis 61.7, Null 62.7 (spread 5.3).

## Round 2, NOT kept

On top of round 1: Reaper Thread 2/3 -> 2/2 (Null), Shield Relay 1/3 -> 2/3 (Aegis, to lift its realistic decks).

Probe (`probe-r2-not-kept.txt`): Cortex +10.8, Swarm +9.3, Aegis **+13.1**, Null +11.3. Spread 3.8; Aegis over.

Ring (`progress/built-deck-ring-010.txt`): spread full 25.5, 37 packs **7.2**, 17 packs **7.3**, 3 packs **4.2**
(Aegis 50.8 / 54.2 / 52.2, Null 54.5 / 51.4 / 50.8).

Round 2 was better at 37 packs and worse at 17 and 3 packs and on the probe, so it was reverted: the registry
holds round 1.

## Verdict

After the two rounds call 8 allows:
- **The probe is in the target** (call 3's numbers, as call 3 was measured).
- **The real ring is not in "within about 4"** at 37 packs (9.5: Null 55.7, Aegis 46.2) or with full
  collections (19.1). At 17 packs it is 5.2, at 3 packs 1.2. Note the ring's own spread before any booster card
  was 4.3 to 6.4 (shipped decks 6.1), so "within 4" on the ring is tighter than the game has ever been.
- **The full-collection column is one build per faction** and the builder's pick is noisy there: the full Null
  build keeps the starter deck with no booster card at all (rounds 0 and 1), and the full Aegis build plays only
  5 booster copies but also two Zero-Day cards and starter cards at full copies (72.5% against the shipped decks;
  61.3% before the booster cards). This is a builder-and-full-collection effect more than a booster-card one; no
  real owner holds a full collection in a 21-day season (the median owner holds a playable set after 48 packs).

So, per call 8: **back to the owner** with these numbers. Nothing further is tuned until the owner answers.
Launch stays 5 December either way.

## Checks on the kept state

- The ring regression check, both modes (`ring-regression-gate.txt`, `ring-regression-real.txt`): **PASS**,
  identical to the baselines (they play the shipped starter decks, which no tuning touched).
- Tests: every workspace passes; 35 demos the same after 6 were rewritten (each diff read: matches that use the
  tuned cards play differently, the card version line, `null-house`'s built deck 63.3% -> 62.1%).
- No rarity moved, so the S0-odds-3 pins are unchanged.
