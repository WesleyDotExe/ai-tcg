# AI-TCG — Economy spec (Stage 4)

The economy loop is: the owner's agent plays, the owner earns credits, the owner spends those credits on packs and opens them, the agent rebuilds its deck from the owner's collection, and the agent plays again. This file is the spec for that loop. It is built from the owner's decisions in `progress/owner-feedback.md`: the 2026-10-04 Stage 4 entry (sections B to D), the 2026-10-04 economy answers and the three amendments after them, and the owner's 2026-10-05 entries (session-28 responses, storage launch-readiness, the unique Mythic and its Neutral amendment, the paid-pack backend and price ladder, the economy balance decisions, the marketplace hooks and payment methods, cosmetics, one shop currency, separate currencies and anti-exploit rules, per-country rules, faction rules and the Season 0 setup). The owner folded those into this file on 2026-10-05. Session 29 applied the owner app spec (2026-10-05, section A: the economy moves from the agent to the owner) and the account-bound entry; where older wording here said "agent" for who holds copies, credits, packs, decks, caps or stats, it is superseded by those entries. If this file and the owner's feedback ever disagree, the feedback wins, and this file should be fixed.

Each section is marked **BUILT** (code and tests exist), **SPEC** (decided, not built yet; the session it belongs to is named), or **OPEN** (waiting on an owner decision).

## Fixed rules

- **A win pays most, a loss pays a little, a cancelled or abandoned match pays nothing.** DESIGN.md protects this rule. It is enforced in three places: the payout function, its tests, and a CHECK constraint in the database.
- **Earned now, buyable later.** There is one shop currency: credits ("points" in the owner's notes), earned by agents. Later the owner may let credits also be bought in bundles; the backend for that is built now with purchasing switched **off** (see "Shop" below). There is no cash-out and no trading. Each copy has its own record, so a future marketplace needs no data migration (see "Marketplace hooks").
- **The owner owns everything; the agent plays.** The owner (the human account) holds the collection and every copy, credits, pack points, unopened packs, promos, decks, rating and match stats, and every daily cap, quest, challenge and pity timer counts per owner. An agent owns nothing but its signature card (the unique Mythic). It is recorded on matches and on match-payout ledger rows as "played by". An owner has one connected agent at a time; switching agents changes only the signature card in play. Buying packs, opening packs and spending pack points are owner actions.
- **Self-contained.** Everything is stored in one local database file. Nothing calls a network service at runtime. The only planned exception is a payment provider for the future shop/marketplace, and only the shop talks to it; the game and replays stay self-contained.

## Who owns what — BUILT (session 29)

Schema v2 (`economy/src/schema.ts`, migration 2) keys everything on the owner:

- `owners` is the account: name, kind (`player` or `house`; each Season 0 house agent runs under its own house owner), starting faction, when the starter collection was granted, and the active deck.
- `agents` belong to one owner forever (`agent_owner_fixed`). Creating an agent grants nothing: no copies, credits or packs.
- Card copies, ledger entries, packs and decks key on `owner_id`. Match-payout ledger rows carry `played_by` (the agent), which must be one of that owner's own agents. Owner actions (a purchase, a salvage) have none.
- Matches record both owners and both agents. Each side must be played by its own owner's agent and deck, and **the two owners must differ**: an owner's agents never meet in rewarded play.
- **Daily caps count per owner** from match history (`dailyTally(ownerId)`). Switching agents mid-day carries on from the owner's tally; it can't reset or double the caps (shown in `progress/economy-demo-002.txt`: the Cortex owner's second agent paid 10 for its first win, the owner's 4th that day).
- **Stats are per owner** (`ownerStats`), with the Stats page's agent filter: matches, wins, losses, draws, void, win rate, best win streak, credits from matches. **Rating** (Glicko-2) isn't built yet; when it is, it keys on the owner, and a newly connected agent plays at the owner's rating.
- A session-28 (v1) file migrates in place: each v1 agent becomes a house owner (`owner-<agent id>`) with that agent, its faction becomes the owner's starting faction, `packPoints` copies become `crafted`, `tournament` copies become `prize`, and every row carries across (tested).

## Accounts and agents — BUILT (session 30; build-order step 2, part 1)

Owner app spec B and C.1, and the 2026-10-05 build order step 2.

- **Season 0 sign-in**, self-contained (no external identity service). `createAccount` makes an owner and its login in one transaction; `addLogin` gives an existing owner (a house owner, say) one. A username is 3 to 32 letters, digits, dots, dashes or underscores; an email is optional; both are unique in any case, and either signs in. A password needs at least 10 characters (`PASSWORD_MIN_LENGTH`). Passwords are stored only as scrypt hashes (N = 2^15, r = 8, p = 1, a 16-byte salt; the cost is inside each hash, and a lower-cost hash is redone at the next sign-in).
- `signIn` returns a session token once; the store keeps only its SHA-256. Sessions last 30 days (`SESSION_DAYS`); `signOut` ends one, and `changePassword` ends them all. A wrong password and an unknown login get the same message and cost the same scrypt time. After 10 failed sign-ins in 15 minutes for one account (counted across its username and email), the login is refused until the window passes (`SIGN_IN_LOCKOUT`).
- **Admin accounts** are marked on the login (`isAdmin`, also in `authenticate`'s answer). `houseRoster` is the admin view's data: each house owner's agents, connected agent, wallet, collection size, unopened packs, stats and live state. The store holds the data; the server checks `isAdmin` before serving it.
- **One connected agent per owner** (`connectAgent`, `disconnectAgent`, `connectedAgent`). It must be the owner's own. Switching changes only who plays (and, once built, the signature card in play): collection, decks, wallet, caps and stats stay with the owner. **No switching or disconnecting during a live match**, enforced in the store and the schema.
- **Live matches:** `startMatch` takes two owners (opponents are server-assigned) and starts the match with each owner's connected agent and active deck, loaded from the copies held now. It refuses self-play, an owner with no connected agent or active deck, an incomplete or illegal deck, a deck outside the faction lock, and an owner already in a live match. `recordMatch` ends it (a cancel or abandon included) and must name the agents that started it. A match id that was never started is still recorded (offline history and tests); the server must record only matches it started.
- **Faction lock** (`setFactionLock`): an owner setting, applied to whichever agent is connected.
- **The signature zone is BUILT in the engine (session 31)**, see "Unique Mythic" below. **The Neutral menu as card data and the fairness test are BUILT (session 32)**, the tuner's size and cost levers (session 33). **Generating a new agent is BUILT (session 34)**: 3 generated agents, then 3 signature-card candidates drawn only from lines that passed the fairness test, then confirm; the card is granted as the agent's bound promo (PR- numbering) and plays from the signature zone of whichever agent is connected. **OPEN, raised in session 34 as an [OWNER CHECK-IN]:** how an agent picks its faction, builds its deck from the owner's collection and chases quests; and the size of the season's signature pool.

## Storage — BUILT (session 28)

The store is `economy/` (`@ai-tcg/economy`), backed by Node's built-in SQLite (`node:sqlite`, Node 22).

Why SQLite: the economy needs atomic multi-row writes. For example, a pack purchase debits credits and creates the pack, and those two writes must succeed or fail together. A match payout writes the match and two ledger rows. SQLite gives real transactions from a single file, and the built-in module needs no native addon and no server. A JSON-file store with atomic renames would have had to re-implement transactions and constraints by hand, and a hand-run edit could bypass them. Node still labels `node:sqlite` experimental and prints a warning, but it works without a flag from Node 22.13; it is a release candidate as of Node 25.7. The root `package.json` pins `engines.node` to `>=22.13` (session 29). **Standing owner item (2026-10-05):** keep all database access inside this store (no other workspace imports `node:sqlite` or writes SQL), pin the minimum Node version in package.json `engines`, and before the public Season 1 launch replace or prove the storage with a load test at launch scale (self-hosted only, no managed database service).

The integrity rules are written into the schema itself (`economy/src/schema.ts`), so every caller is bound by them, including a raw `sqlite3` shell:

- The ledger is append-only: UPDATE and DELETE abort.
- No ledger entry may take a balance below zero.
- Each owner can receive at most one payout per reason per reference. For example, a match can't pay the same owner twice, and a copy can't be salvaged twice.
- A deck can only hold copies that its own owner still holds. An owner can only set one of its own decks as active.
- A numbered copy (a Prototype or a tournament serial) can exist only once, and its serial must fit inside its run. "07/50 S1" is unique forever, and "51/50" is refused.
- A cancelled or abandoned match records 0 credits for both sides.
- (v2) Crafted and starter copies are account-bound. A bound copy never becomes unbound and never changes owner, and a copy's origin never changes.
- (v2) Only an unbound, standard-finish set copy from a pack can be salvaged.
- (v2) The starter collection is granted once per owner.
- (v2) An owner's own agents never play each other; each match side is played by its owner's own agent and deck; a payout's `played_by` is the owner's own agent.
- (v3) Promo and prize copies were account-bound too. (v4, owner 2026-10-10) They no longer are: they can be sold on a future marketplace, and they still never salvage. Migration 4 unbound the copies v3 had bound. A single copy can still be granted bound on purpose (the agent's signature card will be).
- (v3) An owner can only connect one of its own agents, and can't switch or disconnect it while in a live match. A live match is played by each owner's connected agent, and an owner is in at most one live match.
- (v3) A stored password is always a scrypt hash.

Schema changes are numbered migrations tracked by `PRAGMA user_version`. A shipped migration is never edited; changes go in a new one.

**Seasons:** each season is its own database file. The `meta` table records which season a file holds (`S0`). Season 1 starts with a new file, and the Season 0 file is kept as its archive (owner C.11). Sets, card art, wards and promo designs live in code and assets, not in the database, so they carry over automatically. Collections, currency (credits and pack points) and ranks are in the database, so they reset with the new file. The unique Mythic carries over every reset (owner 2026-10-05), plus anything the owner explicitly exempts.

### Tables

| Table | Holds |
|---|---|
| `owners` | Hidden owner id, name, kind (player or house), starting faction, starter granted at, active deck, (v3) connected agent, faction lock |
| `agents` | Hidden agent id, its owner (fixed forever), name |
| `ledger` | Append-only entries: owner, played by (the agent, on match payouts), currency (`credits` or `packPoints`), delta, reason, reference, time. A balance is never stored; it is the sum of the owner's entries. |
| `card_copies` | One row per owned copy: hidden copy id, owner, card id, finish, series (set, promo, prototype or tournament, plus series code, serial, run size and stamp), origin (pack, crafted, starter, promo or prize) with a reference, account-bound flag, time acquired, and time and reason disposed (for example, salvaged) |
| `packs` | Owned packs, opened or unopened: set, source (purchase, starter, weeklyChallenge or ownerDaily), time acquired, time opened |
| `pack_openings` | (v8) One per opened pack, append-only: owner, odds-table version, RNG seed, Jackpot, what pity forced, time |
| `decks` / `deck_copies` | Saved decks: the copies each was saved with. A deck counts cards, so any held copy of a card can fill its slot; copies are shared across decks. |
| `logins` | (v3) One per owner: username, optional email (both unique, any case), scrypt password hash, admin flag |
| `sessions` | (v3) Sign-in sessions by the SHA-256 of their token, with expiry and sign-out time |
| `sign_in_failures` | (v3) Failed sign-ins per account (or per unknown login) for the lockout |
| `live_matches` | (v3) Matches started and not yet recorded: both owners and their connected agents |
| `matches` | Seed, both owners, both agents (played by) and decks, outcome (win, draw, cancelled or abandoned), winning or abandoning owner, turns, moves, credits paid to each side, end time |

Pity timers (no Full Art in 10 packs, no Mythic in 40) are worked out from pack and copy history when they are needed (built session 36: `pityStatus`). They are not stored as counters, so they can't drift out of step with the history.

## Card identity — partly BUILT

- **BUILT:** every owned copy has a hidden unique copy id. Every card has a hidden unique card id (the engine's `card.id`), checked against the engine's `CARD_REGISTRY` (the four shipped faction pools plus the neutral pool) before a copy can be recorded. The schema also has fields for a copy's finish, series, serial and stamp.
- **BUILT (session 36, `economy/src/packs.ts` `CARD_SETS`):** Season 0's set `S0` numbers every ownable card (96) by faction, rarity and name, `001/096` to `096/096`, with each card's Gold number above the total (`097/096` up). The set symbol is a name only (`S0-boot`) until the render draws it. The spec was: sets with collector numbers and a set symbol. The card face shows only `056/120` and the set symbol. Gold copies are numbered above the set total (`121/120`) and count as the set's secret cards. Neither the card id nor the copy id ever appears on a card. The bottom-left layout follows `render/reference/card-text-layout.html`.

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

Finishes are drawn as code shaders where possible. **The data is BUILT (session 36):** the rates above are `PACK_ODDS` in `economy/src/config.ts` (version `S0-odds-1`), the finish is on every copy, and a Gold copy carries its number above the set total. **Shaders come later, after EFFECTS.md v2.** Two choices the table didn't make are session 36's proposals for the owner's check-in: the shine slot's rarity weights (Common 60, Uncommon 25, Rare 12, Mythic 3), and that an Alt Art roll draws its card from the Rares and Mythics, so the ~1 in 30 holds.

## Packs — BUILT (session 36; salvage BUILT session 30)

**Built session 36** (`economy/src/packs.ts`, the store's `openPack` / `openPacks` / `pityStatus` / `packOpening` / `craftCard`, schema v8; tests `economy/test/packs.test.ts`; evidence `progress/pack-sim-001.txt`, a simulation of 400,000 packs and a season of Prototypes, and `progress/economy-demo-006.txt`, the store end to end):
- `rollPack(seed, set, pity, prototypesLeft)` is pure: same inputs, same pack. The store draws the seed server-side at opening, works out pity from the owner's opening history, writes the copies (`origin_ref` `pack:<id>`, series code = the set) and pays 5 pack points, all in one transaction.
- `pack_openings` logs each opening: pack, owner, odds version, seed, Jackpot, what pity forced. It is append-only. The schema refuses an opening of a pack that isn't the owner's or is already open, setting or clearing a pack's `opened_at` except through its opening, a `pack:` copy not from that owner's opened pack, and a 7th card in a pack.
- Pity is read from the last 40 openings, never stored as a counter. "Full Art or better" is Full Art, Alt Art, Gold or a Prototype; a due Full Art pity sets the shine slot's finish, a due Mythic pity makes the Rare slot a Mythic.
- `openPacks(owner, 1 | 10)` opens the oldest packs one after another, each its own opening, all in one transaction, and returns a summary (cards, new cards, pack points, by rarity, by finish) and the packs that keep their full reveal (Gold, Prototype or Jackpot). NEW counts once per card across a bulk open.
- `craftCard(owner, card)` spends pack points on a standard, account-bound crafted copy; refused at the card's playable limit (counting every copy held) or without the points.


- Each pack has 5 cards: 2 Common, 1 Uncommon, 1 Rare slot (1 in 8 is a Mythic instead), and 1 shine slot (any card, any rarity). Only the shine slot rolls a finish.
- A pack costs 100 credits. **BUILT:** `buyPack` makes the debit and the pack in one transaction, and the schema refuses a purchase the balance can't cover.
- Every pack, free ones included, gives 5 pack points when opened. The owner spends pack points on a specific card, in standard finish only: **Common 40, Uncommon 80, Rare 250, Mythic 800** (owner 2026-10-05). Crafting is only allowed up to a card's playable limit (3/3/2/1). Pack points can never be bought and never convert into credits.
- **Salvage is manual, never automatic** (owner 2026-10-07; this replaces the automatic duplicate conversion of earlier entries and of both mockups' "+pp" chips). Every pulled copy goes into the collection, and an owner may hold as many copies of a card as they like. The owner picks a card and a quantity in the card viewer and confirms; pack points are paid in the same transaction (**Common 5, Uncommon 10, Rare 30, Mythic 100**, owner 2026-10-05). A salvaged copy is marked disposed, not deleted. Only unbound, standard-finish pack copies can be salvaged: Foil, Full Art, Alt Art, Gold, Prototype and tournament copies never are, crafted and starter copies are account-bound and never are either, and promo and prize copies can be kept or sold but never salvaged (owner 2026-10-10). The card viewer says why a copy can't be salvaged. Salvaging below what a saved deck uses warns first, listing the affected decks; if the owner confirms, those decks are incomplete until fixed, and a deck is never edited silently. **BUILT (session 30):** `cardHoldings` (the viewer's data: held, salvageable, the reason for each copy that isn't, the decks using it), `salvagePlan` and `salvage(owner, card, quantity, {confirmDeckImpact})`, which refuses with `SalvageNeedsConfirmation` (listing the decks) until confirmed. Copies no deck lists go first. Each salvage pays once per copy, and the schema refuses to salvage a bound copy or a finish even through raw SQL. Shown in `progress/economy-demo-003.txt`.
- **Pack results** show a NEW badge on cards the owner didn't hold before and how many copies the owner now holds (for example "×4 owned"). No salvage chips (owner 2026-10-07). **BUILT (session 36):** opening returns, per card, its slot, finish, collector number, `isNew` and `ownedAfter`.
- Pity timers, tracked per owner: after 10 packs in a row with no Full Art or better, the next pack guarantees one. After 40 packs with no Mythic, the next pack guarantees one.
- Packs are mixed (no faction-focused pack type for now).
- The owner can open **1 pack or 10 at once**. A bulk open has the same odds, no discount and no bonus; each pack in it is still its own pack (its own log entry and seed, its own pity count and its own Prototype check). The reveal can be sped up and ends with a summary; any Gold, Prototype or Jackpot pack still gets its full reveal. Single-pack opening is always available.
- Every pack opening is logged with the odds-table version and RNG seed (revealable after opening, never before). One versioned odds table drives both the game and the published odds. Packs bought with earned or purchased credits are identical.
- Opening a pack is an owner action. Season 0 needs a minimal, self-contained owner interface for it; a local page or a command is enough. **Not built yet:** the store has the calls; the interface comes with the website endpoints (build-order step 3).

## Prototypes — BUILT (session 36: the drop, the runs and serials; the art is not made)

**Built:** the bonus 6th card at 1 in 1,000, the run picked in proportion to the copies left, a Gold when every run is used up, the next serial of its run on the copy (`series_kind` prototype, series code `S0-P01`...), never salvaged. `prototypesFound(run)` is the card viewer's "how many found". **Session 36's proposal, for the owner's check-in:** which 15 cards get the runs (the 1/1 is Null Singularity; every faction's Mythic at the top, Rares below, all five pools). **Measured** (`progress/pack-sim-001.txt`): about 223 Prototypes are found per 250,000 packs opened season-wide, so a small in-house Season 0 will likely see none. Not built: retiring unpulled runs at season end (it needs the season roll-over), and the art.


- Each season has 15 Prototypes, each a single limited run, sized as a pyramid: 4 runs of /250, 3 of /100, 3 of /50, 2 of /25, 1 of /10, 1 of /5 and one 1/1. That is 1,516 copies in all. Every run has its own unique art. The 1/1 goes to a fan-favourite Mythic.
- A Prototype drops as a **bonus 6th card in 1 of every 1,000 packs**. It never replaces one of the 5 normal cards. Which run it comes from is picked in proportion to the copies still available in each run. If the picked run is used up, the pack gives a Gold instead.
- Prototypes that were never pulled are retired at season end, forever. The card viewer shows how many of each run were found.
- Prototypes are not part of the set count. Collection tracking keeps three separate goals: set completion (x/120), secrets found (Gold), and Prototypes held (with serials).
- The art is made at build time with Replicate, following the mythic-wards pattern. The owner checks previews before a season's list goes live.
- Test this with simulated pack openings. Never raise the drop rate to test it.

## Promos and tournament cards — SPEC (the pack session issuing; the unique Mythic with step 2 of the build order)

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
| Win (per owner per UTC day) | **1st 30; 2nd-4th 10 each; 5th-10th 5 each; after 10th 0** (owner 2026-10-05) | **BUILT (session 29)** |
| Loss (and draw) | 2 each, first 10 a day per owner, and only while a win would still pay | **BUILT, owner-approved** |
| Cancelled / abandoned | 0 for both sides | **BUILT** |
| Daily quest | 1 new a day, stacks to 3, worth 50 or 75; owner may reroll 1 a day | SPEC |
| Weekly challenge | 15 wins in a week = 1 free pack | SPEC |
| Owner's daily pack | 1 a day, owner-claimed only, stacks to 2 | SPEC |
| Achievements (one-time per owner) | win milestones 10 / 50 / 100 / 500 (credits, then a pack, then promos); first Mythic pulled; first Gold pulled; faction playset complete (promo); first tournament entry; amounts in config | SPEC |
| Tournament entry fee | credits in, feeding the prize pool | SPEC |

A typical active day is ~140 credits (~1.4 packs) plus the owner's daily pack: ~2.4 packs a day. Simulation (current 96-card pool, mixed 5-card packs, these rules): a playset of one faction plus Neutral in ~63-67 packs (~4 weeks), the whole set in ~94 packs (~6 weeks). Re-run it after any change to pack contents, set size or these numbers. The server assigns opponents, so an owner can't farm wins by playing its own agents against each other; the store and the schema already refuse such a match (session 29).

**How payouts work (BUILT):** `recordMatch` writes the match and both payouts in one transaction, each paid to the owner and marked with the agent that played. Each owner's place in the day is counted from match history across all its agents, not from the ledger, so a win that paid 0 (past the daily cap) still counts toward the cap. The day is the UTC date of the match's end time. A loss stops paying once the owner's next win would pay 0. That way an 11th win is never worth less than a loss. The tests check that "a win pays at least as much as a loss, a loss pays at least 0, and the win pays strictly more whenever it pays anything" for every daily tally from 0 to 15 wins and 0 to 15 losses.

### Payout numbers proposed by session 28 (owner-approved 2026-10-05)

- **A loss pays 2 credits.** The owner's rule is "a loss pays a little" but gives no number. 2 is below the smallest paying win (5), so a win always pays more.
- **Losses stop paying after 10 a day,** so a stream of losses can't become an income.
- **A draw pays as a loss to both sides.** Draws are rare: the engine's turn cap has a decisive tiebreak.
- **An abandoned match pays nothing to either side,** including the player who stayed. Paying the other side would let two colluding agents farm forfeit wins. The server assigns opponents, which makes that farming hard but not impossible.

## Decks — BUILT (session 28)

- A deck is saved as a list of copies the owner holds, but it **counts cards, not copies** (owner 2026-10-07): copies are shared across saved decks, never reserved, so owning 2 copies lets every deck use up to 2. The owner must hold at least as many copies as a deck uses. Account-bound copies play like any other. Any finish counts. The copy limits stay **3/3/2/1** (owner amendment 2026-10-07; the 2/2/2/1 change was withdrawn).
- **BUILT (session 30):** at play time each slot keeps the copy it was saved with while the owner still holds it, and otherwise takes another held copy of the same card. A deck the owner holds too few copies for is **incomplete** (`deckStatus`, `listDecks`): it can't be loaded or start a match until the owner holds the copies again or edits it (`updateDeck`).
- `saveDeck` checks that the owner holds every copy, then runs the engine's own `buildDeck` on the result: copy limits, deck size, one faction plus at most 10 neutral cards, and the card-pool lint. A deck that saves is a deck that plays.
- `loadDeck` runs the same checks again at play time, because the owner may have salvaged a copy since saving, or a card-pool change may have made an old deck illegal.
- One deck is active at a time, on the owner, and whichever agent is connected plays it. With a faction lock set, only a deck of that faction can be made active or start a match (**BUILT, session 30**).
- **Agents may build in any faction** the owner has cards for (one faction + Neutral per deck). The owner may lock an agent to a faction; default free. The agent's deckbuilder chooses the faction as well as the cards. **OPEN (owner, after step 2 of the 2026-10-05 build order):** how an agent picks its faction, builds its deck from the owner's collection and chases quests.
- The unique Mythic is never in the deck (it lives in the signature zone) and does not count toward the Neutral cap.

## Starter collection — BUILT (session 29)

**Once per owner** (owner app spec A), not per agent. When the owner signs up and picks a **starting faction** (it only decides the starter deck; agents can switch factions later), the owner gets, from `grantStarterCollection`:
- the fixed starter deck for that faction, the same list every time, as **account-bound** copies (origin `starter`);
- 3 packs of the current set.

A second grant is refused with nothing granted, and the schema refuses resetting it. **A new agent gets its signature card only** (its unique Mythic promo, built with the signature zone): no starter deck, no starter packs.

All four starter decks must pass the ring regression check against each other before Season 0 starts. **Decided (owner 2026-10-05): the four shipped faction decks are the starter lists**; the ring check already measures them. `progress/economy-demo-002.txt` grants them to four house owners and plays 42 recorded matches from decks saved from those copies.

## Later — not now (the data model allows it)

- A 3D pack-opening animation, with finish shaders and Prototype art made at build time.
- A collector area for viewing every owned card in detail.
- A marketplace (the owner prefers it to direct trading) and any real-money features: hooks only, see "Marketplace hooks" below.

## Unique Mythic (signature card) — SPEC (step 2 of the owner's 2026-10-05 build order: generating a new agent)

Owner decisions of 2026-10-05, including the Neutral amendment.

- **Creation:** at agent creation the system generates **3 complete candidates** (name, concept, art, ward); the owner picks one. Fully generated: no owner theme, no renaming. Every candidate passes the fairness test before it is shown. ~~No two agents in a season share the same body + ability combination~~ (dropped by the owner 2026-10-15: generation is random, so two agents may share a body, ability and art; schema v7). Names are always unique (a clash is re-rolled).
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
  - Defence: Shield wall (your units +0/+1); Guardian (Barrier; owner 2026-10-15, was Guard and Barrier); Bulwark (takes the first attack aimed at one of your units each turn, never you; owner 2026-10-15, was "aimed at your side"; owner 2026-10-13: only when no Guard unit is protecting your side, since Guard takes priority; off the generator until it passes); Restore (end of your turn, restore 1 health to each of your units).
  - Card flow and energy: Supply line (on arrival, draw a card); Energy surge (on arrival, gain 1 energy this turn); Recycle (when it dies, draw 2 cards); Inspire (start of your turn, a random ally gets +1/+1 permanently).
  - Disruption: Suppress (on arrival, an enemy unit in Stasis for 1 turn); Dampen (enemy units -1/-0); Tax (enemy Commands cost 1 more); Sweep (on arrival, 1 damage to each enemy unit).
  - **BUILT as card data (session 32):** `engine/src/data/signatureMenu.ts`. All 16 options, the body table, the 6-cost keyword and the 7-cost second aura (Commander's aura, Shield wall, Dampen or Tax), `buildSignatureCard`, `signatureSpecProblem` and `allSignatureSpecs` (303 combinations then; 306 since session 34: 48 at 5, 138 at 6, 120 at 7). Four options needed small engine additions, all generic: Hunter an `onKill` trigger, Bulwark an `onEnemyAttack` trigger with a once-per-turn ability limit, Commander's aura "other units" on `buffAllies`, Tax a card-type filter on `cardCostModifier`. Tests: `engine/test/signatureMenu.test.ts`; real-play evidence: `progress/sample-match-030-signature-menu.txt`. **Sizes (session 33, owner 2026-10-13):** every option but Guardian and Bulwark also has smaller and/or larger sizes (`MenuOption.sizes`: the same mechanic with a number turned up or down, a narrower target, or an "only while" condition), which the fairness tuner may pick; a sized card's id carries the size (`sig5-3x6-smite.d2`). Bulwark's Guard rule is a generic `guardInPlay` condition.
- **Fairness test — BUILT (session 32), owner 2026-10-11 option A:** the reference gives every faction the same plain Neutral 5-cost 3/6 signature card, set Mythics left in their decks. A candidate replaces one faction's plain card and passes when, in every faction, each of that faction's three edges moves 2 points or less (`engine/src/dev/signatureFairness.ts`; read on the paired point estimate, 2,500 seeds per edge). **Measured (`progress/balance-report-023-signature-menu.txt`):** on the table only Recycle 3/6 and Tax 3/6 pass. Tuning the stat line (off the table if need be) passes no other option: one attack point is worth ~5 points, health almost nothing, and an ability paid for with attack helps the factions unevenly (Aegis loses most). Guardian is the strongest option by far (+40 points on its worst edge). The 6-cost tier plays far above the reference, the 7-cost tier near it. **OPEN ([OWNER CHECK-IN], notes-for-owner.md):** how to make the menu pass: more levers than stats, a different limit, or reworking the strong options.
- **The signature zone (new engine rule):** the card takes no deck slot. It starts each match in its own zone, always available, never drawn, discarded or shuffled. Play it on any turn you can afford it. When it dies it returns to the zone and **costs 2 more each time it is played again** that match. It does not count toward the deck's Mythic copy limit or the Neutral cap. After this lands, re-baseline the ring regression check once (each faction's set Mythic standing in as its signature card) and teach the agents to use the zone. **BUILT (session 31):** `DeckSpec.signature`, `PlayerState.signature` (`{ card, timesPlayed, inZone }`, public), the `playSignature` move (Sorcery timing, a free slot, cost + 2 per earlier play), the return to the zone on death (`signatureReturn` event), no evolving a signature unit, and all three agents use it (Lookahead scores it like the same unit from the hand at its current cost). Tests: `engine/test/signatureZone.test.ts`; evidence: `progress/sample-match-029-signature-zone.txt`. **The re-baseline was measured but NOT made the gate:** with each set Mythic in the zone, 4 of the 6 ring edges moved 10 to 24 points (Aegis > Cortex 52% -> 76%), almost all from guaranteed access, not replays (`progress/balance-report-022-signature-zone.txt`). It is recorded as a second baseline (`ringBaselineSignature.json`, run in CI) and the switch is an owner call (notes-for-owner.md).
- **Ownership:** bound to its agent forever (never transferable or sold), carries over every season reset, and is the agent's first promo (PR- numbering). **Owner 2026-10-13:** this is the one exception to "promo copies can be sold"; salvage refuses it too, under the promo rule. **BUILT in the schema (session 33, migration 5):** a signature copy is a promo copy with `origin_ref` `signature:<agentId>`; `grantCopy` binds it whatever the caller says and refuses any other origin, and the schema aborts an unbound signature insert and any relabelling into or out of being a signature copy. **Granting it is BUILT (session 34, schema v6):** see "Generating a new agent" below. The owner's collection shows old agents' signature cards under Promos → Signature cards, greyed out except the connected agent's (owner app spec B).
- **Generating a new agent — BUILT (session 34, schema v6).** The owner app's "Generate a new agent" flow is three store calls: `startAgentDraft` (3 generated agents: a name and a one-line persona), `pickDraftAgent` (3 signature-card candidates for the picked agent) and `confirmAgentDraft` (one transaction: the agent with its name and persona, its card in `signature_cards` with the next PR- number, and the bound promo copy, card id `sig-PR-NNN`, stamp SIGNATURE). The draft is kept in `agent_drafts` (one open per owner; a new draft closes the old), so what is confirmed is what was shown, and the seeds are drawn server-side. The generator (`engine/src/data/agentGenerator.ts`) uses word lists, no outside service; signature candidates come only from `engine/src/data/signatureApproved.ts`, the lines that passed the fairness test at 2,500 seeds or more, the largest measurement deciding since session 35 (each with a fingerprint of the card measured, checked by a test), with 3 different abilities whenever possible. Per season, no two agents share a name, and no signature card shares a name with a set card or another signature card (the schema's unique indexes hold this too). **Since session 35 (schema v7, owner 2026-10-15) two agents may share a combination**, so the pool of approved lines no longer caps a season. **Card names (session 35, owner 2026-10-15)** are themed (cyberpunk with 1990s retro-futurism) and built from grammatical templates with slot-tagged word lists (`engine/src/data/signatureNames.ts`): [Handle]'s [Modifier] [Thing], [Modifier] [Thing], [Thing] of [Place], [Handle]'s [Thing], [Modifier] [Thing] [Edition]; the Thing leans toward the ability; a filter refuses repeated words, names over 30 characters and blocked words. **Owner 2026-10-16:** 1 candidate in 100 puts the owner's login username in the handle slot; the [Handle]'s patterns take 61%, "[Thing] of the [Place]" 30%, the bare and edition names 9% (the template is drawn first and only its words re-rolled, so the split holds); **agent names** come from the same generator in the same split ("Bytewolf's Daemon", "Hexmoth of the Undernet"), replacing session 34's fantasy-style names, and the 3 on a pick screen never share a final word. Samples: `progress/signature-names-sample-001.txt` (session 35), `progress/signature-names-sample-002.txt` (session 36). **Art pool (owner 2026-10-16, schema v8):** each signature card records a slot (1-500) of its season's pool when it is made, and keeps it; the card's art reference names the slot (`placeholder:signature-pool/S0/217`) until the late art pass fills the pool. A new season points new cards at a new pool. A signature copy must be a copy of that agent's own card, held by its owner, one per agent; a signature card is never deleted and keeps its id, agent, combination and number. It never goes in a deck ("plays from its own zone"); `startMatch` puts the connected agent's card in the signature zone, so switching agents changes only that card. A new agent brings nothing else (no credits, no packs). ~~**Limit (an [OWNER CHECK-IN], session 34):** with no shared combinations per season, the pool of approved lines caps how many agents a season can generate.~~ Answered 2026-10-15: combinations may repeat. Evidence: `progress/economy-demo-004.txt`, `progress/economy-demo-005.txt` (session 35); tests: `economy/test/generatedAgents.test.ts`, `engine/test/agentGenerator.test.ts`, `engine/test/signatureNames.test.ts`.

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
5. **Earned value stays with the owner that earned it** (superseded wording "with the agent", owner app spec A): credits, pack points and cards belong to the owner, never to an agent, so switching agents moves nothing. Earned and bound value never moves between owners. **BUILT (session 29).**
6. **Every reward and cap is per owner** (daily caps, quests, the weekly challenge, pity timers, the owner's daily pack, the starter collection). A new agent gets only its signature card, so creating agents farms nothing. **BUILT for match caps and the starter (session 29).** Still cap agents per owner in config (number decided before the public launch).
7. **No self-play farming:** server-assigned opponents; an owner's agents are never matched against each other in rewarded play (**BUILT in the store and schema, session 29**); flag repeated pairings and suspicious patterns, including same-owner pairings in tournaments.
8. **Refunds:** only unused bought credits; a chargeback after spending puts the account on hold.
9. **Server-side, unpredictable RNG;** seeds logged and revealable only after opening.
10. **Every spend, salvage, craft and pack open is one transaction** with unique constraints (no double-spend races).
11. **One global daily reset time (UTC).**
- Account-bound copies (owner 2026-10-05; widened 2026-10-07, narrowed again 2026-10-10): crafted and starter copies, and the agent's signature card (owner 2026-10-13; enforced by migration 5), can only be played: never sold, never salvaged, never moved. Promo and prize copies are NOT bound: they can be sold, but never salvaged. Bound copies count normally for deck building, the playable limits and collection completion. **BUILT** in the schema (crafted and starter session 29; promo and prize bound in session 30 by migration 3, then unbound in session 31 by migration 4).
- Prove it: an **exploit test suite** that tries each loop and must fail to profit (**started session 29:** agent switching vs the caps, self-play, a second starter, bound copies vs salvage and transfer, payouts to another owner's agent), plus **economy anomaly flags** in the Season 0 metrics. Re-run both whenever an economy number changes.

## Marketplace hooks — data model only (nothing live)

The owner may later add a marketplace (preferred over direct trading): owners sell cards to players finishing master sets, **10% fee per sale**, priced in **USD** (via a marketplace payment provider) or paid with **MetaMask in ETH or USDT** (USDT as the ERC-20 token on Ethereum to start; **web only**; **no identity checks for MetaMask**, owner decision). Legal review comes first. Build only these hooks now:

- copy ids globally unique and never reused; ownership is transferable with a full append-only history per copy;
- a transferable flag per copy (the unique Mythic never; other types default to transferable, settable per type). **Partly BUILT (session 29):** the `account_bound` flag; crafted and starter copies are always bound, and a bound copy can't change owner even by raw SQL. The marketplace never lists bound copies, and the card viewer shows an "Account-bound" tag on them;
- each copy records how it was funded (pack bought with earned credits, pack bought with purchased credits, crafted, promo, starter, prize). **Partly BUILT (session 29):** every copy records its origin (pack, crafted, starter, promo or prize); the earned/purchased funding of a pack copy comes with pack opening;
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
