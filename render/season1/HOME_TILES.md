# Season 1 Home: the tile audit and spec

Render session 82. Phase 1 step 1 of the owner's 2026-11-22 plan: "a tile audit and spec: for every tile, the one
question it answers, what it shows at S / M / L, what a new player sees, its next action; merge the duplicates".

This is a spec, not a build. Nothing in Season 0 changed. The spec's checked form is `src/homeSpec.ts`, and
`test/homeSpec.test.ts` holds it to the rules below. Phase 2 builds the S / M / L framework from that file.
The look (layout, navigation, how a tile is drawn) is for the Home mockups A, B and C (phase 1 steps 2 and 3).
This page only settles **what** each tile is for and what it shows.

## 1. The audit: the real Season 0 Home, read in a browser

`season1/audit/home-audit.mjs` runs the real Season 0 site (the real owner API, a real store, the game lane's
ladder playing) in headless Chromium. It reads the Home as two owners:

- **Nova**: weeks in, 23 matches, 49 of 124 cards, 11 packs waiting, 449 credits.
- **Wren**: a new player, just through sign-up. Wren has a starter, one agent and no match yet.

For each owner it reads the recommended board, all twelve tiles at S, at M and at L, and a phone. It saves a
still of each and the text of every tile. Nothing is mocked. There were no page errors and no outside requests.
The evidence is in `progress/render/evidence/season1-home-audit-s82/`: `home-audit.txt` (readable), `home-audit.json`
(the raw read) and 10 stills.

What it found, measured:

| Finding | Evidence |
|---|---|
| **The same fact in several tiles.** On Nova's recommended board, the rating (1774) is in 4 tiles: My agent, Watch live, Ladder and Rating & form. The agent's name is in 4: My agent, Agent controls, Watch live and Ladder. So are the tier and the W–L record. The sidebar's agent card shows the name and status a fifth time. | `home-audit.txt`, "SAME FACT IN" lines |
| **The free daily pack has four Claim buttons.** It can be claimed from Daily rewards, Store and Notifications, and Packs' top-bar Open counts it too. | all-M stills, "actions:" lines |
| **Two meanings of ±.** "±151" next to a rating is its uncertainty. "±0 this week" is a change. The two sit side by side in Rating & form. | `nova-all-S.jpg` |
| **Labels that need explaining.** "0 since a Full Art" is a pity timer: a Full Art is guaranteed after 10 packs, a Mythic after 40. "Open 10 needs 10 waiting". The ◆ 65 in the top bar is pack points, but the page never says so. "100 credits short". "Placement · 0 rated matches ±350". | `wren-all-M.jpg` |
| **The new player's dead ends.** Collection says "No packs opened yet" while 3 packs wait in Packs. Rating & form at L draws an empty chart with axis labels (Gold, 1520, 24 Oct). My agent at L is a 1132×496 px tile with four lines in it. Match history says "No matches yet" at every size and never says how a match starts. | `wren-all-L.jpg`, `wren-recommended.jpg` |
| **Tiles that overflow.** Match history at M (by 423 px) and at L (by 1039 px), Agent controls at L (173 px), Collection at L (294 px). | "OVERFLOWS" lines |
| **Sizes don't scale evenly.** At M, Match history has 105 words and My agent has 22. Daily rewards at M has 79 words, mostly its ten "Win n, pays x" nodes. | the word counts per tile |
| **A phone has to scroll.** The recommended board is 2898 px tall on a 390 px phone, 3.4 screens of it. There's no sideways scroll. | `*-recommended-phone.jpg` |
| **Each arrow opens something different.** My agent opens "Connect agent". Agent controls and Match history open "Agent match". Daily rewards opens Stats. The sidebar has 9 entries, one of them "Tournament · Soon". | the "open:" field per tile |

## 2. The rules the spec keeps (checked by `test/homeSpec.test.ts`)

1. **One question per tile.** Each tile answers one question an owner actually asks.
2. **One home per fact.** Each fact (rating, agent name, unopened packs and so on) is shown by exactly one tile. Other
   tiles link to it; they don't repeat it. This fixes observation 17 (the rating in three tiles, the agent in two).
3. **A tile grows with its size.** What S shows, M shows too, and L shows everything M does (owner point 12). S keeps
   to the core: three facts at most.
4. **Something for a new player.** Every tile has words for a player with no matches, no credits and unopened packs,
   at every size. No empty charts, and no "—" without a reason.
5. **One next action** at every size, and the tile's arrow goes to the page that answers the same question in full.
6. **Nothing is dropped silently.** Every Season 0 widget maps to exactly one Season 1 tile.
7. **The owner's calls stay open.** A call only the owner can make is marked "waiting on owner" (rule 10a).

## 3. The tiles

Twelve Season 0 widgets become **nine tiles**, plus a Music tile that waits on its spec. The facts each size shows
are the named facts in `src/homeSpec.ts` (`FACTS`).

### My agent (My agent + Agent controls)
**Question:** Is my agent playing right now, and how do I steer it?

| | Shows | A new player sees | Next |
|---|---|---|---|
| S | name and picture, what it's doing (playing / ready / stopped / out of time), the play style's name, Start/Stop | "Moth Lantern · Ready · Play style: Calculator. [Start]" | Start / Stop |
| M | + today's W–L, the play style with Change, play time and adding time | "Ready, not playing yet. Press Start and it joins the ladder's next round; it plays until you stop it or its time runs out." | Start / Stop, then give it time |
| L | + the deck, and the six play styles as choices | as M, "Your agent builds its own deck from your cards", and the six play styles, each in one line, Calculator marked current: "It changes how your agent plays, from its next match." | Start / Stop, choose a play style, pick a deck |

The rating moves out of this tile, to Ladder. The agent's name appears only here, and in Watch live when it's a
player in the match. The sidebar's agent card is a navigation call for the mockups (see 5).

**On the grid (render session 88):** one glass tile like the rest (owner 2026-11-27). S: the picture and name, the
pill, the button. M: the name and the button on the left; on the right the pill and a short reason, then one line
each for today, the personality (its name) and the play time ("+15 min" when the server allows it). L: the name with
Start / Stop beside it, the pill and the full reason, today and the play time side by side, the deck ("Pick one" /
"Change"), and all six personalities in one line each, the agent's own marked ("Change"). The pill, its reason and
the button come from one function (`agentState` in `src/homeFacts.ts`) on the owner API's auto-play answer: No agent,
Playing now, Waiting for a round, Ready, Finishing match, Time's up, Done for today, Ready not playing yet, Stopped.
Every state at every size: `output/agent-states.html`, checked by `ci/tile-states-check.mjs agent` (or `ci/agent-states-check.mjs`).

**Play style (render session 90, owner 2026-11-27 note 6):** the section is "Play style", personality its subtitle,
with one plain line: "It changes how your agent plays, from its next match." S names the current style (a fourth
fact at S: the owner's word, the only tile over three); M names it with "Change"; L draws all six as choices, the
current one with a check, an accent edge and "Current", the others with a pointer, a hover (lifts, accent edge) and a
press (sinks, deeper tint) and a focus ring. A tap on any style opens My agent with that style ready to confirm
("Confirm Rusher" / "Keep Calculator", one more tap); the current style opens it saying so, with nothing to
confirm; M's Change opens it with the current style selected. The tile never changes the style itself (call 4 of
render 88). On the site the confirm is `PUT /api/agents/:agentId/play-style { style }`; the prototype keeps it in the
page. Checked by `ci/tile-states-check.mjs agent` (the hover and press poses, contrast) and `ci/play-style-check.mjs`
(the flow, the keyboard, a phone).

### Ladder (Ladder + Rating & form)
**Question:** How good is my agent, and is it getting better?

| | Shows | A new player sees | Next |
|---|---|---|---|
| S | rating, tier, place (#n of N); unplaced, the placement count in the third line | "Unrated · In placement · 0 of 5 placement matches" | Open Stats / How placement works |
| M | + **one bar** (placement n of 5 until placed, then the points to the next tier: never both), this week's change, form dots | "Unrated · In placement · Not ranked yet", the bar "0 of 5 matches", "This week: After placement", "Form: No results yet". No chart and no ±350. | Open Stats / How placement works |
| L | + settled or settling (its "?" says the ±), the streak, win rate by deck (two most played, "+n more"), **the standings** (the top of the ladder and you in it, a gap when you're below) beside the rating chart with tier floors | as M, the top of the ladder with "Wren (you) placing" at its foot, and in place of the chart **the tiers as a ladder** (Mythic to Bronze, each floor, a dot per ranked agent, "start" at Gold, where every agent begins at 1,500) | Open Stats / How placement works |

Render session 89 merged two pairs of facts: placement + next tier became **climb** (only one is ever true), around
you + top of the ladder became **standings** (with few ranked agents they were the same rows twice). Every state at
every size: `output/ladder-states.html`, checked by `ci/tile-states-check.mjs ladder`.

### Watch live
**Question:** What is playing right now, and can I watch it?

| | Shows | A new player sees | Next |
|---|---|---|---|
| S | the featured match: the two names, health, the turn | the same as everyone | Watch |
| M | + **the arena itself, playing, 9:16** (owner point 13) | the arena, and under it "Your agent's matches show here once you press Start." | Full screen |
| L | + the other live matches, the play-by-play | as M | Full screen / switch match |

Ratings and tiers are left off the scoreboard (Ladder owns them). The players' names, factions and health stay.
Phase 1 step 5 prototypes this tile on the Season 1 arena.

### Packs
**Question:** Do I have packs to open?

| | Shows | A new player sees | Next |
|---|---|---|---|
| S | the packs you have and haven't opened | "3 packs waiting · [Open a pack]" | Open a pack |
| M | + how soon a Full Art and a Mythic are guaranteed ("in the next pack" when due) | "3 packs waiting. Open them to add cards your agent can use." | Open a pack |
| L | + the last pulls | "Your pulls appear here after your first pack." and what one pack holds (the live table's five slots) | Open a pack |

**Owner 2026-11-22 (replaces render 82 call 2):** each pack action has one home: **claim** in Daily rewards, **open**
in Packs, **buy** in Store. Packs keeps only the packs you have and haven't opened. With none, its button is "Buy packs
in Store".

### Store
**Question:** What can I spend my credits on?

| | Shows | A new player sees | Next |
|---|---|---|---|
| S | credits, and how many packs they buy ("Enough for 4 packs") | "0 credits · Win matches to earn credits" | Buy a pack (or How to earn credits) |
| M | + the featured pack as the hero: its art, price and Buy | the pack with "100 more credits" in place of Buy | See the whole Store |
| L | + the packs on sale as the hero shelf: 1 pack and 10 of each offer (two offers at most, the rest named in one line), art, price and Buy each | as M, both with how many more credits | See the whole Store |

**Owner 2026-11-28, point 9 (replaces the tile part of 2026-11-22 point 3 and render 86 call 4):** the tile's hero is
the extra packs, not the cosmetics. The cosmetics (arenas, card backs, boasts, coins, avatars, and this month's
collection as one row) stay in the Store page, shown when the owner opens it. Claim stays in Daily rewards, open in
Packs. The art is Season 0's own sealed pack (the one the opening tears). A pack the credits don't cover says how many
more credits it needs instead of a greyed Buy. A Buy never spends credits itself: it opens the Store with that
purchase ready to confirm (`POST /api/packs/buy { setCode, count }`, 1 to 10, all or none). Render session 91.

### Collection (Collection + Showcase)
**Question:** What cards do I have, and what's new?

| | Shows | A new player sees | Next |
|---|---|---|---|
| S | completion (held of total, %) | "20 of 124 · your starter" | Open Collection |
| M | + Secrets and Prototypes found, the best cards drawn large | "20 of 124: your starter deck. 3 packs are waiting in Packs." and the starter's best three | Open Collection, or Open packs when packs wait |
| L | + the binder by faction | as M, and the starter's binder | Filter the binder |

Showcase folds in as the M / L "best cards". The last pulls move to Packs, where they come from.

**Render session 93 (built for the boxes):** the held count is the headline number and "of 124 cards" its label;
the ring beside it is the share, so the bar and "· 40%" show at L only. S: the count (a new player's "your starter
deck" under it). M: the count, Secrets and Prototypes as two short lines, and the best three cards sized to the unit;
a new player's M says "Secrets and Prototypes come in packs." (none can be held before a pack) and its cards are
"Your starter's best". L: the count with its button beside it, the rare finds on one line, the best five in one row,
then the cards by faction. States sheet `output/collection-states.html` (six states).

### Daily rewards
**Question:** How much has my agent earned today, and how much is left?

| | Shows | A new player sees | Next |
|---|---|---|---|
| S | earned today of the day's most, what the next win pays, the free daily pack | "0 of 90 today · first win pays 30 · Free daily pack ready" | Claim free pack (when one waits), else Open Stats |
| M | + the win-by-win pay, when the day resets | "Wins pay credits, the first win most. Up to 90 a day; resets at midnight Sydney." | Claim free pack, else Open Stats |
| L | the same, + today's results | as M; no results yet says how a day's wins start (switch the agent on) | Claim free pack, else Open Stats |

**Render session 93 (built for the boxes):** the day's credits from wins is the headline number ("of 90 today" at
S, "of 90 credits today" at M, the whole line at L) with the next win's pay under it; the ring is the share, the bar
shows at L only. The free pack: "Free pack ready", "2 free packs ready" (at M and L with "Claim one so the next can
come.": nothing comes in while two wait), or "Free pack claimed". Today's pay is one row of steps (a paid step muted
with a tick; the next win's step outlined; none once every paid win is in). The loss line says when losses stop
paying, never "a loss pays 0", and what losses paid today (`creditsFromLosses`). L adds today's results: each paid
win's pay and the time it ended on the day's clock (`rewardedWins`, as OWNER_API.md says the widget lists them),
the unpaid wins as one line, the losses as one. States sheet `output/daily-states.html` (six states).

**Owner 2026-11-22 (replaces render 82 call 2):** the free daily pack is claimed here ("Claim free pack"); a claimed
pack lands in Packs.

### Match history
**Question:** How did my agent's last matches go?

| | Shows | A new player sees | Next |
|---|---|---|---|
| S | the last result | "No matches yet" | Open the last match |
| M | + the last 3, with credits and rating change | "No matches yet. Press Start on My agent; results and replays show here." | Replay |
| L | + replays and logs | as M | Replay / All matches |

M shows 3, not 6, so the tile no longer overflows by 423 px.

**Render session 94 (built for the boxes):** the headline is the last match in words, never a code: "Won", "Lost",
"Drew", and the results Season 0's mockups drew as "Drew" by mistake, "Cancelled", "Your agent left" and "Opponent
left" (every `result` OWNER_API.md sends); then the opponent, what it paid ("paid nothing" for a cancel or an
abandon), the rating change ("not rated" for a cancel) and when it ended on the day's clock. The list under it is the
matches *before* that one (it never repeats the headline): M three, L six, one row each with a column per number
under a header (Paid, Rating, Ended at L), the agent named only when two agents share the history; L gives each row
with a kept replay its Replay link, then the tally of the last seven and how many replays were kept. A new player's
M says what each row will hold; L adds what a match pays: a win most, a loss a little, a cancel or abandon nothing,
and what each does to the rating. States sheet `output/history-states.html` (seven states).

### Notifications
**Question:** What happened while I was away?

| | Shows | A new player sees | Next |
|---|---|---|---|
| S | unread count, the latest | "1 new" | Open the latest |
| M | + the alerts, newest first | the one alert, "Your free daily pack is waiting", which links to Daily rewards | Open an alert / Mark all read |
| L | + by kind | as M | Filter by kind |

Each alert links to the tile or page that owns its subject: a result goes to Match history, the free pack to Daily rewards. It drops
the agent's name when the owner has only one agent.

**Render session 94 (built for the boxes):** the headline is how many are new ("24 new"), or "All caught up", or,
with none ever, "No alerts yet". S names the newest new one ("Latest: Your free pack is waiting"). Each alert is one
link in two lines, kept to one line each: what happened, then when and the detail (what it paid and the rating
change; a big pull's card, finish and rarity from `bigPull.cards`; a stop's reason, "Its 45 minutes of play are up");
a dot in its kind's colour, filled while it is new. M lists the newest three, L five with where each goes ("Match
history →"); a line counts the new ones not shown ("21 more new in Alerts"). L's new-by-kind chips open Alerts on that
kind. A new player's L says what each kind tells and that all but the agent stopping can be switched off in Settings.
States sheet `output/notif-states.html` (six states).

### Music (waiting on owner)
**Question:** What's playing, and can I make my own?

This is the owner's point 14. Its S / M / L split (the track playing; the 5 save slots; the drum machine and loop
creator) is a placeholder for the music spec (phase 1 step 6). Per plan item 24, nothing is built until the owner
approves that spec.

## 4. Labels: what each unclear one becomes

These are listed in `LABELS` in `src/homeSpec.ts`. Each fact behind them is the server's, so none of them guesses a
rule.

| Tile | Season 0 says | The spec says | Why |
|---|---|---|---|
| Ladder | ±109 (next to the rating) | "Settling" or "Settled"; the number only in the explainer | it's the rating's uncertainty (`rd`), and "±0 this week" uses the same sign for a change |
| Ladder | ±0 this week | "No change this week" / "+42 this week" | the same reason |
| Ladder | Placement · 0 rated matches ±350 | "0 of 5 placement matches" | two jargon words and an uncertainty in one line |
| Packs | 0 since a Full Art · 0 since a Mythic | "Full Art guaranteed within 10 packs · Mythic within 40", counting down | they're pity timers (`pity: { fullArtAfter: 10, mythicAfter: 40 }`) |
| Packs | Open 10 needs 10 waiting. | **waiting on owner** | Open 10 calls 1–2 aren't decided (owner point 25) |
| Collection | No packs opened yet (3 waiting) | "3 packs are waiting: open them to add cards" | owner observation 17 |
| Store | 100 credits short | "Win matches to earn credits" at 0, else "100 more credits" | a new player doesn't know where credits come from |
| Top bar | ◆ 65 | "65 pack points" | the still shows an unlabelled diamond |

## 5. Navigation: what the audit found, for mockup A

The navigation is left to the mockups (steps 2 and 3). The audit gives them these facts:

- The sidebar has 9 entries: Home, Agent match, Watch live, Collection, Store, Tournament (Soon), Stats, Settings
  and Connect agent. The top bar has the credits, the pack points, Open N packs, the theme, the bell and the account.
  The sidebar's foot repeats the agent card.
- "Agent match" and "Watch live" are both pages of matches. "Connect agent" is where My agent's arrow goes.
- Several things live in two places: the top bar's Open and the Packs tile; the bell and the Notifications tile;
  the sidebar's agent card and My agent.
- The rule each mockup keeps: **a tile's arrow opens the page that answers the same question in full**. One page per
  question: My agent → the agent page; Ladder → Stats; Watch live → Watch live; Packs and Store → Store; Collection →
  Collection; Daily rewards → Stats (earnings); Match history → the matches list.

## 6. Waiting on owner

- Which Home direction: A, B or C (after steps 2 and 3).
- The music spec (step 6), and so the Music tile.
- Open 10 calls 1–2 (and so its label).
- Whether the merges above are right: My agent + Agent controls, Ladder + Rating & form, and the one this session
  added, **Showcase folded into Collection**. Phase 2 builds from this spec unless the owner says otherwise.
