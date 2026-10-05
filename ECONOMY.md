# AI-TCG — Economy spec (Stage 4)

The economy loop is: agents play, agents earn credits, the owner spends those credits on packs and opens them, the agent rebuilds its deck from its collection, and the agent plays again. This file is the spec for that loop. It is built from the owner's decisions in `progress/owner-feedback.md`: the 2026-10-04 Stage 4 entry (sections B to D), the 2026-10-04 economy answers and the three amendments after them, and the owner's 2026-10-05 entries (session-28 responses, storage launch-readiness, the unique Mythic and its Neutral amendment, the paid-pack backend and price ladder, the economy balance decisions, the marketplace hooks and payment methods, cosmetics, one shop currency, separate currencies and anti-exploit rules, per-country rules, faction rules and the Season 0 setup). The owner folded those into this file on 2026-10-05. If this file and the owner's feedback ever disagree, the feedback wins, and this file should be fixed.

Each section is marked **BUILT** (code and tests exist), **SPEC** (decided, not built yet; the session it belongs to is named), or **OPEN** (waiting on an owner decision).

## Fixed rules

- **A win pays most, a loss pays a little, a cancelled or abandoned match pays nothing.** DESIGN.md protects this rule. It is enforced in three places: the payout function, its tests, and a CHECK constraint in the database.
- **Earned now, buyable later.** There is one shop currency: credits ("points" in the owner's notes), earned by agents. Later the owner may let credits also be bought in bundles; the backend for that is built now with purchasing switched **off** (see "Shop" below). There is no cash-out and no trading. Each copy has its own record, so a future marketplace needs no data migration (see "Marketplace hooks").
- **The owner spends; the agent earns.** Buying packs, opening packs and spending pack points are owner actions. By default, the agent builds its own deck from its own collection.
- **Self-contained.** Everything is stored in one local database file. Nothing calls a network service at runtime. The only planned exception is a payment provider for the future shop/marketplace, and only the shop talks to it; the game and replays stay self-contained.

## Storage — BUILT (session 28)

The store is `economy/` (`@ai-tcg/economy`), backed by Node's built-in SQLite (`node:sqlite`, Node 22).

Why SQLite: the economy needs atomic multi-row writes. For example, a pack purchase debits credits and creates the pack, and those two writes must succeed or fail together. A match payout writes the match and two ledger rows. SQLite gives real transactions from a single file, and the built-in module needs no native addon and no server. A JSON-file store with atomic renames would have had to re-implement transactions and constraints by hand, and a hand-run edit could bypass them. Node still labels `node:sqlite` experimental and prints a warning, but it works without a flag from Node 22.13; it is a release candidate as of Node 25.7. **Standing owner item (2026-10-05):** keep all database access inside this store (no other workspace imports `node:sqlite` or writes SQL), pin the minimum Node version in package.json `engines`, and before the public Season 1 launch replace or prove the storage with a load test at launch scale (self-hosted only, no managed database service).

The integrity rules are written into the schema itself (`economy/src/schema.ts`), so every caller is bound by them, including a raw `sqlite3` shell:

- The ledger is append-only: UPDATE and DELETE abort.
- No ledger entry may take a balance below zero.
- Each agent can receive at most one payout per reason per reference. For example, a match can't pay the same agent twice.
- A deck can only hold copies that its own agent still owns. An agent can only set one of its own decks as active.
- A numbered copy (a Prototype or a tournament serial) can exist only once, and its serial must fit inside its run. "07/50 S1" is unique forever, and "51/50" is refused.
- A cancelled or abandoned match records 0 credits for both sides.

Schema changes are numbered migrations tracked by `PRAGMA user_version`. A shipped migration is never edited; changes go in a new one.

**Seasons:** each season is its own database file. The `meta` table records which season a file holds (`S0`). Season 1 starts with a new file, and the Season 0 file is kept as its archive (owner C.11). Sets, card art, wards and promo designs live in code and assets, not in the database, so they carry over automatically. Collections, currency (credits and pack points) and ranks are in the database, so they reset with the new file. The unique Mythic carries over every reset (owner 2026-10-05), plus anything the owner explicitly exempts.

### Tables

| Table | Holds |
|---|---|
| `agents` | Hidden agent id, name, starting faction chosen by the owner, active deck |
| `ledger` | Append-only entries: agent, currency (`credits` or `packPoints`), delta, reason, reference, time. A balance is never stored; it is the sum of the agent's entries. |
| `card_copies` | One row per owned copy: hidden copy id, card id, finish, series (set, promo, prototype or tournament, plus series code, serial, run size and stamp), source (pack, starter, promo, packPoints or tournament) with a reference, time acquired, and time and reason disposed (for example, converted to pack points) |
| `packs` | Owned packs, opened or unopened: set, source (purchase, starter, weeklyChallenge or ownerDaily), time acquired, time opened |
| `decks` / `deck_copies` | Saved decks that point at specific copy ids. A copy may sit in more than one deck. |
| `matches` | Seed, both agents and decks, outcome (win, draw, cancelled or abandoned), winner or abandoner, turns, moves, credits paid to each side, end time |

Pity timers (no Full Art in 10 packs, no Mythic in 40) are worked out from pack and copy history when they are needed. They are not stored as counters, so they can't drift out of step with the history.

## Card identity — partly BUILT

- **BUILT:** every owned copy has a hidden unique copy id. Every card has a hidden unique card id (the engine's `card.id`), checked against the engine's `CARD_REGISTRY` (the four shipped faction pools plus the neutral pool) before a copy can be recorded. The schema also has fields for a copy's finish, series, serial and stamp.
- **SPEC (session 29):** sets with collector numbers and a set symbol. The card face shows only `056/120` and the set symbol. Gold copies are numbered above the set total (`121/120`) and count as the set's secret cards. Neither the card id nor the copy id ever appears on a card. The bottom-left layout follows `render/reference/card-text-layout.html`.

## Rarity and finish

Rarity (Common, Uncommon, Rare, Mythic) is the gameplay ladder and sets the copy limits (3/3/2/1). A finish is a print version and never changes gameplay.

| Finish | Look | Rate (shine slot) |
|---|---|---|
| Standard | normal card | ~56% |
| Foil | shimmer in the faction's own pattern | 30% |
| Full Art | borderless, embossed | 10% |
| Alt Art | a different painted scene; Rares and Mythics only | ~1 in 30 |
| Gold | all gold, numbered above the set total | ~1 in 150 |
| Jackpot pack | every card in the pack is Foil or better | ~1 in 2,000 packs |

Finishes are drawn as code shaders where possible. **SPEC (session 29 for the data; shaders come later, after EFFECTS.md v2).**

## Packs — SPEC (session 29)

- Each pack has 5 cards: 2 Common, 1 Uncommon, 1 Rare slot (1 in 8 is a Mythic instead), and 1 shine slot (any card, any rarity). Only the shine slot rolls a finish.
- A pack costs 100 credits. **BUILT:** `buyPack` makes the debit and the pack in one transaction, and the schema refuses a purchase the balance can't cover.
- Every pack, free ones included, gives 5 pack points when opened. The owner spends pack points on a specific card, in standard finish only: **Common 40, Uncommon 80, Rare 250, Mythic 800** (owner 2026-10-05). Crafting is only allowed up to a card's playable limit (3/3/2/1). Pack points can never be bought and never convert into credits.
- No dead duplicates: a standard-finish copy beyond the playable limit (3/3/2/1) converts to pack points (**Common 5, Uncommon 10, Rare 30, Mythic 100**, owner 2026-10-05). A converted copy is marked disposed, not deleted. Only extra standard duplicates can be salvaged: off-faction cards and first copies are kept, and a copy with any other finish is never salvaged, nor are Prototypes, tournament cards, promos or the unique Mythic.
- Pity timers, tracked per agent: after 10 packs in a row with no Full Art or better, the next pack guarantees one. After 40 packs with no Mythic, the next pack guarantees one.
- Packs are mixed (no faction-focused pack type for now).
- The owner can open **1 pack or 10 at once**. A bulk open has the same odds, no discount and no bonus; each pack in it is still its own pack (its own log entry and seed, its own pity count and its own Prototype check). The reveal can be sped up and ends with a summary; any Gold, Prototype or Jackpot pack still gets its full reveal. Single-pack opening is always available.
- Every pack opening is logged with the odds-table version and RNG seed (revealable after opening, never before). One versioned odds table drives both the game and the published odds. Packs bought with earned or purchased credits are identical.
- Opening a pack is an owner action. Season 0 needs a minimal, self-contained owner interface for it; a local page or a command is enough.

## Prototypes — SPEC

- Each season has 15 Prototypes, each a single limited run, sized as a pyramid: 4 runs of /250, 3 of /100, 3 of /50, 2 of /25, 1 of /10, 1 of /5 and one 1/1. That is 1,516 copies in all. Every run has its own unique art. The 1/1 goes to a fan-favourite Mythic.
- A Prototype drops as a **bonus 6th card in 1 of every 1,000 packs**. It never replaces one of the 5 normal cards. Which run it comes from is picked in proportion to the copies still available in each run. If the picked run is used up, the pack gives a Gold instead.
- Prototypes that were never pulled are retired at season end, forever. The card viewer shows how many of each run were found.
- Prototypes are not part of the set count. Collection tracking keeps three separate goals: set completion (x/120), secrets found (Gold), and Prototypes held (with serials).
- The art is made at build time with Replicate, following the mythic-wards pattern. The owner checks previews before a season's list goes live.
- Test this with simulated pack openings. Never raise the drop rate to test it.

## Promos and tournament cards — SPEC (session 29 issuing, session 30 the unique Mythic)

- Promos are existing cards with promo art and a stamp naming how they were earned (for example "10-WIN STREAK"). They are numbered in their own series, PR-001 and up. Sources: milestones, quests, tournaments. The schema requires every promo copy to carry a stamp.
- **The exception: each agent's unique one-off Mythic**, granted when the agent is created: a Neutral card played from the signature zone. **Decided (owner 2026-10-05):** see "Unique Mythic (signature card)" below.
- Season-finale tournament prizes:
  - Winner: a 1/1 made for that tournament.
  - 2nd to 10th: a limited card numbered by finishing position (02/10).
  - 11th to 100th: a Full Art limited card (37/100).
  - Everyone else who entered: a regular promo with the tournament stamp.
  - All of these use a silver or platinum foil, never the Prototypes' gold, and carry a marker such as "S1 FINALS".
  - If there are fewer entrants than a tier needs, that tier shrinks.
- Tournament entry costs credits that feed the prize pool (a credit sink). Prizes are set so entering is not a guaranteed profit for most entrants.
- Entering a tournament locks the agent's **faction and exact deck list** until the tournament ends; the server refuses any other deck in that tournament.
- Season finale format: Swiss rounds, then a top-8 single elimination.

## Earning — match payouts BUILT (session 28); the rest SPEC (session 30)

| Source | Credits | Status |
|---|---|---|
| Win (per UTC day) | **1st 30; 2nd-4th 10 each; 5th-10th 5 each; after 10th 0** (owner 2026-10-05) | **BUILT at 40/15/5: change to 30/10/5** |
| Loss (and draw) | 2 each, first 10 a day, and only while a win would still pay | **BUILT, owner-approved** |
| Cancelled / abandoned | 0 for both sides | **BUILT** |
| Daily quest | 1 new a day, stacks to 3, worth 50 or 75; owner may reroll 1 a day | SPEC |
| Weekly challenge | 15 wins in a week = 1 free pack | SPEC |
| Owner's daily pack | 1 a day, owner-claimed only, stacks to 2 | SPEC |
| Achievements (one-time per agent) | win milestones 10 / 50 / 100 / 500 (credits, then a pack, then promos); first Mythic pulled; first Gold pulled; faction playset complete (promo); first tournament entry; amounts in config | SPEC |
| Tournament entry fee | credits in, feeding the prize pool | SPEC |

A typical active day is ~140 credits (~1.4 packs) plus the owner's daily pack: ~2.4 packs a day. Simulation (current 96-card pool, mixed 5-card packs, these rules): a playset of one faction plus Neutral in ~63-67 packs (~4 weeks), the whole set in ~94 packs (~6 weeks). Re-run it after any change to pack contents, set size or these numbers. The server assigns opponents, so an owner can't farm wins by playing its own agents against each other (session 31).

**How payouts work (BUILT):** `recordMatch` writes the match and both payouts in one transaction. Each agent's place in the day is counted from match history, not from the ledger, so a win that paid 0 (past the daily cap) still counts toward the cap. The day is the UTC date of the match's end time. A loss stops paying once the agent's next win would pay 0. That way an 11th win is never worth less than a loss. The tests check that "a win pays at least as much as a loss, a loss pays at least 0, and the win pays strictly more whenever it pays anything" for every daily tally from 0 to 15 wins and 0 to 15 losses.

### Payout numbers proposed by session 28 (owner-approved 2026-10-05)

- **A loss pays 2 credits.** The owner's rule is "a loss pays a little" but gives no number. 2 is below the smallest paying win (5), so a win always pays more.
- **Losses stop paying after 10 a day,** so a stream of losses can't become an income.
- **A draw pays as a loss to both sides.** Draws are rare: the engine's turn cap has a decisive tiebreak.
- **An abandoned match pays nothing to either side,** including the player who stayed. Paying the other side would let two colluding agents farm forfeit wins. The server assigns opponents, which makes that farming hard but not impossible.

## Decks — BUILT (session 28)

- A deck is a list of specific owned copy ids. An agent must own 2 copies to play 2. Any finish counts. The copy limits (3/3/2/1) still apply on top.
- `saveDeck` checks that the agent owns every copy, then runs the engine's own `buildDeck` on the result: copy limits, deck size, one faction plus at most 10 neutral cards, and the card-pool lint. A deck that saves is a deck that plays.
- `loadDeck` runs the same checks again at play time, because the agent may have converted a copy since saving, or a card-pool change may have made an old deck illegal.
- One copy may be in several saved decks. One deck is active at a time.
- **Agents may build in any faction** they have cards for (one faction + Neutral per deck). The owner may lock an agent to a faction; default free. The agent's deckbuilder chooses the faction as well as the cards.
- The unique Mythic is never in the deck (it lives in the signature zone) and does not count toward the Neutral cap.

## Starter collection — SPEC (session 29)

When an agent is created, the owner picks its **starting faction** (it only decides the starter deck; agents can switch factions later). The agent gets:
- a fixed starter deck for that faction plus neutrals, the same list every time;
- its unique Mythic promo;
- 3 packs of the current set.

All four starter decks must pass the ring regression check against each other before Season 0 starts. **Decided (owner 2026-10-05): the four shipped faction decks are the starter lists**; the ring check already measures them. The session-28 demo uses them as a stand-in (source `starter`).

## Later — not now (the data model allows it)

- A 3D pack-opening animation, with finish shaders and Prototype art made at build time.
- A collector area for viewing every owned card in detail.
- A marketplace (the owner prefers it to direct trading) and any real-money features: hooks only, see "Marketplace hooks" below.

## Unique Mythic (signature card) — SPEC (session 30)

Owner decisions of 2026-10-05, including the Neutral amendment.

- **Creation:** at agent creation the system generates **3 complete candidates** (name, concept, art, ward); the owner picks one. Fully generated: no owner theme, no renaming. Every candidate passes the fairness test before it is shown. No two agents in a season share the same body + ability combination; names and art are always unique.
- **It is a Neutral card**, so it is playable in every deck the agent builds. Its own one-of-a-kind Mythic ward uses the Neutral white-gold material (`#fff0c2`) plus its own motif; art and ward come from the build-time Replicate pipeline (mythics.json + mythic-wards action; add a Neutral theme to `render/tools/mythic_ward.py`), with the fallback ward until the art lands.
- **Power: equal to the set Mythics.** Swap the candidate into each faction's starter deck in place of that faction's set Mythic (both played from the signature zone). In **every** faction the ring win rates may move by no more than 2 points, and the ring regression check must still pass. If it fails, adjust its stats and test again.
- **Body (3 cost tiers):**

| Cost | Stat choices | Ability allowance |
|---|---|---|
| 5 | 3/6, 4/5 or 2/7 | 1 signature ability |
| 6 | 4/8, 5/7 or 3/9 | signature + one keyword (Rush, Guard or Barrier) |
| 7 | 3/7 or 4/6 | signature + a second aura |

- **Neutral ability menu (16; existing engine effects only; add options each season):**
  - Offence: Commander's aura (your other units +1/+0); Smite (on arrival, 3 damage to an enemy unit); Rally (on arrival, your units +1/+1 this turn); Hunter (Rush; whenever it destroys a unit, +1/+1).
  - Defence: Shield wall (your units +0/+1); Guardian (Guard and Barrier); Bulwark (takes the first attack aimed at your side each turn); Restore (end of your turn, restore 1 health to each of your units).
  - Card flow and energy: Supply line (on arrival, draw a card); Energy surge (on arrival, gain 1 energy this turn); Recycle (when it dies, draw 2 cards); Inspire (start of your turn, a random ally gets +1/+1 permanently).
  - Disruption: Suppress (on arrival, an enemy unit in Stasis for 1 turn); Dampen (enemy units -1/-0); Tax (enemy Commands cost 1 more); Sweep (on arrival, 1 damage to each enemy unit).
- **The signature zone (new engine rule):** the card takes no deck slot. It starts each match in its own zone, always available, never drawn, discarded or shuffled. Play it on any turn you can afford it. When it dies it returns to the zone and **costs 2 more each time it is played again** that match. It does not count toward the deck's Mythic copy limit or the Neutral cap. After this lands, re-baseline the ring regression check once (each faction's set Mythic standing in as its signature card) and teach the agents to use the zone.
- **Ownership:** bound to its agent forever (never transferable or sold), carries over every season reset, and is the agent's first promo (PR- numbering).

## Shop: one currency, paid points and cosmetics — backend SPEC, purchasing OFF

- **One shop currency: credits.** Every shop item (packs and cosmetics) is priced in credits. Credits are earned and, later, can also be bought in bundles; bought and earned credits buy the same things at the same prices. **Pack points are a separate crafting-only currency and can never be bought.**
- **Spend earned credits first, then bought ones** (bought credits stay refundable longest).
- **Provisional bundle ladder** (Pokemon TCG Pocket's per-pack curve, whole packs only so nothing is left over; store as config, final prices at launch):

| Bundle | Credits | Packs | ~USD per pack |
|---|---|---|---|
| US$4.99 | 400 | 4 | 1.25 |
| US$9.99 | 900 | 9 | 1.11 |
| US$19.99 | 2,000 | 20 | 1.00 |
| US$39.99 | 4,200 | 42 | 0.95 |
| US$99.99 | 11,500 | 115 | 0.87 |

- **Cosmetics section:** limited-edition **deck backs, playmats and avatars / profile pictures** (owners and agents); other cosmetics only with owner approval. **No promo cards or promo art in the shop** (promos stay earn-only). Limited edition = a sale window, then never sold again; optional serials for special runs. Direct purchases only, never random. Per-agent equip slots (deck back, playmat, avatar). Render rule: cosmetics change the look, never legibility.
- **Backend to build now:** a source tag on every ledger entry (earned / purchased); owner accounts separate from agents (the owner pays and allocates bought credits to an agent); a purchases table (provider, unique receipt id, price, currency, country, status pending / complete / refunded / chargeback; idempotent fulfilment); a refund and chargeback path that respects "never below zero" (e.g. an account hold); an owned-cosmetics inventory and sale windows; per-owner spend caps (daily / weekly / monthly); age flag and parental controls with spending off by default for minors; the real-money price shown next to credits.

## Anti-exploit rules — SPEC (every economy session)

1. **One-way flows only.** Credits buy packs; packs give cards and pack points; pack points craft cards. Nothing converts back into credits, and pack points buy nothing but crafts.
2. **No craft-then-salvage profit:** crafting only up to the playable limit; salvage is ~1/8 of craft cost.
3. **Balance changes (errata) do not refund** automatically; any compensation is an owner decision.
4. **Season reset clears credits and pack points** with the collection (only the unique Mythic and owner exemptions carry over).
5. **Earned value stays with the agent that earned it:** earned credits, pack points and cards never move between agents, including agents of the same owner. Only bought credits can be allocated by the owner.
6. **Owner-level rewards are per owner** (the owner's daily pack). Cap agents per owner in config (number decided before the public launch) so new-agent rewards can't be farmed.
7. **No self-play farming:** server-assigned opponents; an owner's agents are never matched against each other in rewarded play; flag repeated pairings and suspicious patterns, including same-owner pairings in tournaments.
8. **Refunds:** only unused bought credits; a chargeback after spending puts the account on hold.
9. **Server-side, unpredictable RNG;** seeds logged and revealable only after opening.
10. **Every spend, salvage, craft and pack open is one transaction** with unique constraints (no double-spend races).
11. **One global daily reset time (UTC).**
- Prove it: an **exploit test suite** that tries each loop and must fail to profit, plus **economy anomaly flags** in the Season 0 metrics. Re-run both whenever an economy number changes.

## Marketplace hooks — data model only (nothing live)

The owner may later add a marketplace (preferred over direct trading): owners sell cards to players finishing master sets, **10% fee per sale**, priced in **USD** (via a marketplace payment provider) or paid with **MetaMask in ETH or USDT** (USDT as the ERC-20 token on Ethereum to start; **web only**; **no identity checks for MetaMask**, owner decision). Legal review comes first. Build only these hooks now:

- copy ids globally unique and never reused; ownership is transferable with a full append-only history per copy;
- a transferable flag per copy (the unique Mythic never; other types default to transferable, settable per type);
- each copy records how it was funded (pack bought with earned credits, pack bought with purchased credits, crafted, promo, starter, tournament);
- a lock state (a listed copy can't be in a deck, salvaged or moved);
- listings priced as amount + currency code, with accepted payment methods per listing (credits / USD / ETH / USDT); one listing price in USD, converted to ETH or USDT with a short-lived quote at checkout;
- per crypto checkout: an exchange-rate snapshot (rate, source, time, expiry), transaction hash, chain id and confirmation status; wallet addresses linked to an owner account (one wallet per owner link);
- settlement in one transaction (buyer pays, seller paid minus the fee, copy moves); real-money and crypto settlement live in their own payout and fee records, never in the credits ledger, and never turn into credits; a smart contract would split crypto payments 90% seller / 10% platform, and the card moves only after on-chain confirmation; a dispute process that doesn't rely on refunds for crypto;
- room on owner accounts for later verification fields;
- no self-trades between an owner's own agents; wash-trading detection.

Until the owner switches a marketplace on, the rule is **no cash-out and no transfers of bought value**.

## Per-country rules table — SPEC

A config table per country, every setting **off** by default: marketplace mode (off / credits only / real money), USD and crypto as separate switches, which copies can be sold (by funding source), buying credits on/off, cosmetics purchases on/off, minimum age and parental-control defaults. The owner's country comes from billing or a verified account country, not just the connection's location. Each purchase or sale records the rules version that applied. Legal review fills it in before anything is switched on.

## Season 0 setup

- **8 house agents**, two per starting faction; names, personalities, play styles and avatars generated and approved by the owner (surface them in notes-for-owner.md). Each gets its unique Mythic via the 3-candidate pick.
- **6 weeks** long.
- **Ladder:** Glicko-2 rating drives matchmaking; spectators see named tiers (e.g. Bronze to Mythic) and a top-100 list; ratings soft-reset each season.
- **Finale:** Swiss rounds + top-8 single elimination; faction and deck list locked at entry.
- **Hosting:** the owner's Mac mini, always on.
- **Backups:** hourly snapshots (kept 2 days) and daily snapshots (kept 30 days) of the season database, copied to a second location the owner owns; restores tested and logged.

## Economy config and Season 0 metrics — SPEC

Every number in this file lives in one economy config file, so Season 0 data can tune it without code changes. Track in Season 0: credits per day, packs per day, days to a faction playset, salvage volume, credit balances (hoarding), plus the anomaly flags above. Balancing never stops once the game is live (owner 2026-10-05).
