# Season 0 booster cards: the proposal [OWNER CHECK-IN]

**Status (session 97):** approved as proposed (owner 2026-11-14, all 8 calls kept). Built: the cards are in the
faction files and the registry (`cards-2`), the set is 001-124, packs roll S0-odds-3. The balance re-run (build
step 4) is next. The chase lists moved to booster cards (owner 2026-11-14, "starter cards are Standard only"):
`progress/notes-for-owner.md`, session 97.

Game session 96, 2026-11-14. Your 2026-11-14 entry (option B) asked the game lane to propose the card list first,
for your approval, before building it. This is that proposal. **Nothing is built:** the cards are draft data in
`engine/src/dev/boosterDraft.ts`. They are not in the registry, any set, pack or starter deck, and nobody can own
them. The starter decks, the shipped cards, the rules and the packs are unchanged.

The engine has already checked every card:
- All 28 are legal card data. Each starter deck with its booster cards swapped in passes the deck rules and the pool
  lint.
- Every card was played in real matches, and every ability resolved.
- There is a first power read against the starter decks.

Evidence: `progress/booster-proposal-005.txt` (the final list). Files 001 to 004 are the tuning record (below).
The script is `engine/src/dev/boosterProposal.ts`.

## The list: 28 cards, 7 per faction (2 Common, 2 Uncommon, 2 Rare, 1 Mythic)

Every mechanism is one the engine already resolves for a shipped card (the last column names which), so there are
no new mechanics. The numbers are a new range of each faction's ids (CX-101 and up), so they never collide with a
starter or trimmed card.

### Cortex: the cluster. Count your units, ping theirs, keep the energy flowing.

| # | Card | Rarity | Cost | Type | Stats | Text | Borrows from |
|---|---|---|---|---|---|---|---|
| CX-101 | Port Scanner | C | 1 | Unit | 1/1 | When this enters play, if you control 3 or more units, recover 1 energy. | Watchtower Relay (energy), Broodcaller (unit count) |
| CX-102 | Mutex Lock | C | 2 | Unit | 1/3 Guard | (none) | Firewall Sentinel |
| CX-103 | Cluster Node | U | 4 | Unit | 1/3 | Your other units get +1/+0. | Hive Mother's aura |
| CX-104 | Hot Swap | U | 2 | Command, Instant | | Give target friendly unit +2/+2 this turn. If you control 3 or more units, draw a card. | Hotfix, Broodcaller |
| CX-105 | Parity Checker | R | 3 | Unit | 2/4 | Pay 2 energy: deal 1 damage to target enemy unit. Instant speed. Once per turn. | Cortex Engineer, the signature menu's once-per-turn |
| CX-106 | Job Scheduler | R | 3 | Directive | | At the start of your turn, if you control 3 or more units, draw a card. | Uplink Tower |
| CX-107 | Grid Consensus | M | 6 | Unit | 1/6 | Its attack equals 1 plus the number of units you control. When it enters play, deal 1 damage to all enemy units. | Recursive Construct, Force Quit |

### Swarm: go wide, die well, come back.

| # | Card | Rarity | Cost | Type | Stats | Text | Borrows from |
|---|---|---|---|---|---|---|---|
| SW-101 | Egg Courier | C | 2 | Unit | 2/2 | When this dies, summon a 1/1 Swarm Larva. | Colony Broodling |
| SW-102 | Spawning Pulse | C | 1 | Command, Sorcery | | Summon a 1/1 Swarm Larva. Then, if you control 2 or more units, draw a card. | Brood Reserves, Broodcaller |
| SW-103 | Hive Relay | U | 3 | Unit | 3/3 | At the start of your turn, if you control 2 or more units, summon a 1/1 Swarm Larva. | Watchtower Relay's timing, Brood Reserves |
| SW-104 | Acid Drone | U | 2 | Unit | 2/2 | When this dies, deal 2 damage to a random enemy unit. | Spore Cluster, Load Balancer |
| SW-105 | Swarm Surge | R | 2 | Command, Instant | | Choose one: **Overrun**, your units get +2/+1 this turn; or **Brood**, summon two 1/1 Swarm Larvae. | Force Quit (modal), Rally Cry |
| SW-106 | Brood Tyrant | R | 3 | Unit | 0/4 | Its attack equals 1 plus the number of units you control. | Recursive Construct |
| SW-107 | Colony Overmind | M | 6 | Unit | 4/5 | When it enters play, summon two 1/1 Swarm Larvae. At the end of your turn, if you control 4 or more units, your units get +1/+0 permanently. | Bloodswarm Alpha, Propagating Exploit |

### Aegis: walls, Barrier, outlast.

| # | Card | Rarity | Cost | Type | Stats | Text | Borrows from |
|---|---|---|---|---|---|---|---|
| AG-101 | Shield Relay | C | 2 | Unit | 1/3 | When this enters play, target friendly unit gains Barrier. | Latent Ward |
| AG-102 | Kinetic Buffer | C | 2 | Tool | +1/+2 | (none) | Plating Module |
| AG-103 | Bastion Array | U | 3 | Unit | 1/4 Guard | Whenever this unit is damaged, restore 1 health to you. | Failover Custodian, Rollback Point |
| AG-104 | Hardlight Shell | U | 2 | Command, Instant | | Target friendly unit gains Barrier. Draw a card. | Latent Ward, Spare Cycles |
| AG-105 | Mirror Bulwark | R | 3 | Unit | 1/5 Guard | Whenever this unit is damaged, deal 1 damage to a random enemy unit. Once per turn. | Retaliation Node |
| AG-106 | Hardening Protocol | R | 3 | Directive | | At the start of your turn, a random friendly unit gets +1/+1 permanently. | Rate Limiter's timing, Propagating Exploit |
| AG-107 | Aegis Overwatch | M | 6 | Unit | 3/5 Guard | When it enters play, your units gain Barrier. At the end of your turn, restore 1 health to each of your units. | Latent Ward, Diagnostic Loop |

### Null: corrupt, shrink, outlast. What dies leaves something behind.

| # | Card | Rarity | Cost | Type | Stats | Text | Borrows from |
|---|---|---|---|---|---|---|---|
| NL-101 | Bad Sector | C | 1 | Unit | 1/1 | When this dies, a random enemy unit gets -1/-0 permanently. | Deprecated Routine |
| NL-102 | Memory Leak | C | 2 | Command, Sorcery | | Target enemy unit gets -1/-1 permanently (not below 1 health). Draw a card. | Null Pointer's Null Out |
| NL-103 | Reaper Thread | U | 3 | Unit | 2/3 | Whenever this destroys a unit, draw a card. | the signature menu's Hunter (onKill) |
| NL-104 | Zombie Fork | U | 2 | Unit | 2/2 | When this dies, create two 1/1 Orphaned Thread tokens. | Zombie Process |
| NL-105 | Heap Spray | R | 4 | Unit | 2/4 | When this enters play, enemy units get -1/-0 permanently. | Deprecated Routine, Cascade Purge's reach |
| NL-106 | Decay Engine | R | 4 | Unit | 2/4 | At the end of your turn, a random enemy unit gets -1/-0 permanently. | Diagnostic Loop's timing |
| NL-107 | Heat Death | M | 6 | Unit | 3/6 | When it enters play, enemy units get -1/-0 permanently. When it dies, create two 1/1 Orphaned Thread tokens. | the two above |

The tokens are the starter cards' own (Swarm Larva, Orphaned Thread), and all the names are new: I searched the
repo for each one. Flavour text is in the draft file.

## What the engine says about it (`progress/booster-proposal-005.txt`)

How it was measured: Lookahead against Lookahead, 500 games against each of the four shipped decks, seats
alternating. The **probe deck** is each starter deck with all 7 of its booster cards in, at the copies an owner
might hold a few weeks in: Commons and Uncommons x2, Rares and the Mythic x1, so 11 copies. Each copy replaces the
lowest-rated starter copy of the same kind (removal for removal, so the deck stays under the 25% removal cap).

| Faction | Starter deck vs the field | Probe deck | Gain | Same cuts, blank bodies instead (the control) | Booster abilities over blank bodies |
|---|---|---|---|---|---|
| Cortex | 50.7 | 61.5 | **+10.8** | 70.3 (+19.6) | -8.8 |
| Swarm | 45.6 | 54.9 | **+9.3** | 54.4 (+8.8) | +0.6 |
| Aegis | 44.6 | 57.3 | **+12.7** | 59.1 (+14.4) | -1.8 |
| Null | 48.5 | 65.5 | **+17.1** | 59.2 (+10.7) | +6.3 |

- **Every card was played and every ability resolved.** Each card was played in 18% to 52% of its probe deck's
  games, and every triggered or activated ability fired at least once (most hundreds of times).
- **Each faction gains about +9 to +13 points, except Null at +17.** No single card dominates, except Aegis
  Overwatch: alone it adds +9.7, and it is +8.3 of Aegis's gain. Null's gain is spread over all seven cards (+2 to
  +5 each).
- **What the control found (the main thing to know).** The "blank" control puts a vanilla body (attack = cost,
  health = cost + 1, no ability) in place of each booster card, with the same cuts. It gains as much as the real
  cards, and for Cortex more. So most of the gain comes from **replacing the weakest starter cards** (mainly spells
  and Directives like Rollback Point, Rate Limiter, Guard Directive Chip, Segfault Handler) with any reasonable
  body, not from the new cards being strong. With these agents, the starter decks hold cards weaker than a plain
  body. Any pack card at or above the vanilla line will therefore feel like a real upgrade. That suits "packs
  matter", but it means the size of the upgrade is set more by the starter decks than by the booster cards.

**The tuning record** (each file is the same check):
- `001`: first cut. Port Scanner pinged instead; the lint refused that, see call 4. Cortex +16.9, Swarm -1.5,
  Aegis +18.2, Null +19.4. Its "played in 0 games" for Kinetic Buffer is a counting bug in the script: a Tool logs
  `toolAttached`, not `play`. Fixed from 002.
- `002`: 15 small trims and boosts. Cortex +14.3, Swarm +2.1, Aegis +11.6, Null +22.3.
- `003`: Swarm up, Aegis Overwatch without Guard. Cortex +14.3, Swarm +9.3, Aegis +2.1, Null +22.3. Adds the
  leave-one-out read.
- `004`: Cortex and Null trimmed, Overwatch's Guard back. Cortex +10.8, Swarm +9.3, Aegis +10.4, Null +18.4.
- `005`: Null's Rares and Mythic trimmed, Hardening Protocol redesigned (as "a random unit gains Barrier" it made
  Aegis worse at cost 3 and at cost 2). Cortex +10.8, Swarm +9.3, Aegis +12.7, Null +17.1. Adds the control.

## Calls for you

1. **The list.** Approve the 28 cards as above, or name any to change. **Recommended: approve.** The build session
   then tunes numbers only (costs and stats, never a card's job), by the real balance re-run.
2. **How many cards, and the rarity split.** **(a, recommended)** 28: 7 per faction, 2C/2U/2R/1M (8 Commons,
   8 Uncommons, 8 Rares, 4 Mythics). That fills the pack's plain slots (2 Commons, 1 Uncommon, the Rare slot with a
   Mythic 1 time in 8) from the booster cards alone. **(b)** 24: 6 per faction, 2C/2U/1R/1M (drop one Rare from
   each faction: Job Scheduler, Brood Tyrant, Hardening Protocol, Decay Engine, the four weakest here). No neutral
   booster cards in either; your entry said "per faction".
3. **How much a pack upgrade should be worth (the target for the balance re-run).** **Recommended:** a faction's
   whole booster package lifts its starter deck by about **+8 to +12 points** against the field, and the four
   factions land within about 4 points of each other. Now: Cortex +10.8, Swarm +9.3, Aegis +12.7, Null +17.1. So
   at the build, Null's package comes down about 5 points and Aegis's about 1. A bigger or smaller target is your
   call: bigger means packs matter more against a starter-only owner, smaller means the ladder stays closer for
   new owners.
4. **The removal cap held, and it shaped Cortex.** The 25% removal/debuff cap is a deck rule. Every starter deck
   sits near it, so a removal booster card can only go in for a removal starter card. Port Scanner's first version
   (ping a random enemy) broke it, so it now pays energy instead. Keep the cap as it is (recommended), or raise it
   for booster-era decks?
5. **The starter decks hold cards weaker than a plain body.** Your rule keeps them fixed, so nothing changes now.
   It does mean the upgrade from packs is large and comes mostly from replacing those cards. **Recommended:** keep
   the starters fixed for Season 0 (your decision), and note it for Season 1 (`progress/season-1-ideas.md`).
6. **Numbering.** **(a, recommended)** One Season 0 set: the 96 cards keep their order as 001 to 096, and the
   booster cards follow as 097 to 124 (by faction, then rarity, then name). The total becomes /124 and the Gold
   numbers move up to 125 to 248, with the secrets above them. Every printed denominator changes, but nothing real
   is owned before 5 December. **(b)** A separate booster set code (e.g. "S0B", 01/28) beside the starter set.
7. **Packs** (your decision 2, the detail). **Recommended:**
   - The plain slots (2 Commons, the Uncommon, the Rare/Mythic slot) and the shine slot's Standard and Foil roll
     booster cards only.
   - Full Art, Alt Art, Gold, Glitch and the secret illustrations roll from all cards, so starter cards appear only
     in those chase versions.
   - The Zero-Day cards are unchanged.
   - The 15 Prototype runs stay on the cards they are on.
   - The odds become a new version (S0-odds-3); a logged opening still rolls again from its own version.
   Alternatives: starter cards in Foil too; some Prototype runs moved to booster Mythics.
8. **If the balance re-run fails** (your entry left this open). **Recommended:** tune the booster cards only
   (costs and stats, never a starter card), up to two rounds. If it is still outside the target, bring it back to
   you with the numbers rather than ship it. Launch stays 5 December either way: if it comes to that, the fallback
   is packs as they are today.

## The build, once you've answered (the order your entry gave)

1. The cards into the faction files and the registry, with a new `CARDS_VERSIONS` entry. The ring's "set Mythic"
   stand-in takes exactly one Mythic per deck, so it keeps the starter Mythic (a deck may now hold two).
2. The set list and numbering (call 6), and the pack table (call 7) with its pack simulation re-run.
3. The agents' deck builder: it already reads any registry card and rates it from its data. It needs the realistic
   collections re-made with booster pulls.
4. The balance re-run against the starter decks: the built-deck ring with booster collections, to the target in
   call 3, then the ring regression check.
