# Season 1 ideas

The parking lot for ideas that come up after the Season 0 scope was locked (owner, 2026-11-06). Runs and the
owner add here instead of building. Nothing here is approved work: after Season 0 the owner picks what moves
onto `progress/roadmap.md`.

Each entry: the date, who raised it, one or two lines on what it is.

## From the owner's Home dashboard feedback (2026-11-06)

- **Music tools:** music management, a drum machine and a loop creator, with up to 5 save slots for music
  (small, medium and large widget versions).
- **Agent art creation:** an area where the agent spends a few minutes creating an artwork based on its daily
  performance once it has finished its rewards, then goes back to playing. (Note: the game must never call
  Replicate at runtime, so this needs its own design.)
- **Fully customisable card showcase** with larger cards (the existing Showcase gets larger cards in Season 0;
  the customisation waits).
- **Daily challenges and quests** on the Daily rewards widget, with claim buttons.
- **A rotating daily shop** and new store products.
- **New agent personalities**, or fine-tuning sliders for the existing ones.

## Added later

### 2026-11-08 (owner): arena playmats and card backs — design decided, build after Season 0
The loadout's Arena and Card back slots already exist (`economy/src/cosmetics.ts`, the loadout picker); Season 0
sells no items for either and the render can't draw them yet. The owner's design decisions, ready to build:
- **The playmat is a circle under the play area only**, not the whole screen. Outside the circle stays the standard
  arena background. One mat fills the whole circle (not split per side).
- **Whose mat shows:**
  - An owner watching their own agent's match always sees **their own** mat. If both owners watch, each sees their own.
  - A spectator sees the mat of the side chosen in **"Watch as"**: it defaults to the higher-rated side, as
    "Watch as" already does, and switching "Watch as" switches the mat too (one control, no second toggle).
  - A side with no mat equipped: that view shows the standard arena.
- **Readability rule (owner's standing cosmetics rule):** a mat changes the look, never legibility. It sits dimmed
  under the grid; effects, faction colours and EFFECTS.md's constant-meaning rule always draw on top.
- **Card backs are visible to everyone** (owners and spectators) on each side's **draw pile** and on face-down
  cards in hand, each side showing its own deck's back whatever the view. Safe: every card in a deck shares one
  back, so it reveals nothing.
- **Add a visible draw pile with a card count** on each side of the mat (today's arena shows hand backs but no pile).

### 2026-11-10 (owner, on game session 83's calls): three for the season switch
Added by game session 85: the owner's entries asked for them here, and they hadn't been written in.
- **A prompt asking owners to switch auto-play back on** at the start of a new season (auto-play starts off in the
  new file; call 2).
- **A "newest sets only" mode**, since new owners start further behind veterans' collections each season.
- **A one-command season switch:** end, wait for the live matches to finish, make the next file, restart on it. In
  Season 0 it stays by hand (the steps go in the owner docs during clean-up, 2-4 Dec). Session 85 made the by-hand
  steps safe: the server refuses the ended file and a missing file unless told (`--archive`, `--new`).

### 2026-11-10 (owner): a marketplace (not specced)
Owners complete their collections, including earlier seasons' cards. The groundwork that had to exist from day one is
built (session 84: every copy's id, provenance and chain of owners, schema v28); listings, prices, fees, the deck
lock, trading screens and payments are for the spec after the Season 0 launch.

### 2026-11-10 (owner, on render session 61's call 7): a set bar on the ten-pack summary
The fan and set bar are for one pack only in Season 0; the ten-pack summary keeps its grid.

### 2026-11-13 (owner): the Season 1 arena redesign (true 3D) and live commentary — spec, build after Season 0

**Status: Season 1 work. Not to be built before the Season 0 launch (5 Dec 2026); the Season 0 scope lock stands.**
Owner decisions are marked **[owner]**. Everything else is a proposal for the session that builds it to confirm at a
checkpoint.

#### 1. Goal

**[owner]** The arena should look and feel like a real card game, not a dashboard. The reference for *layout and
feel* is the Pokémon TCG Pocket battle screen, with our own mechanics on it.

- Use the reference for **conventions only**: the player's side at the bottom, the opponent's at the top, a tilted
  board, compact HUDs, big readable cards, short punchy effects.
- **Original art and UI only.** We don't copy its assets, card frames, icons or trade dress. The look stays ours:
  AI-themed, cyberpunk with 1990s retro-futurism.

#### 2. The board: a player-POV view in true 3D

- **[owner]** An isometric-style view from the player's seat: the near side (your agent) is large at the bottom, and
  the far side (the opponent) recedes towards the top.
- **The POV follows "Watch as"** (built in render session 52). Whoever you watch as sits at the bottom. On your own
  match that is your agent; switching sides swaps the board.
- **[owner] True 3D** (a WebGL scene with a real camera, lights and shadows), chosen by the owner from two test examples
  (a 2.5D tilt and true 3D; layout and feel tests with placeholder art; the chosen one is kept at
  `render/reference/season1-arena-3d-test.html`). Every existing effect is rebuilt in 3D. The owner's modifications (2026-11-13):
  1. **The arena floor is round:** a raised circular platform (the playmat circle from the 2026-11-08 design) with a
     glowing rim, not a rectangular table.
  2. **The far side holds its hand in the scene:** the opponent's cards are held up behind their side of the arena,
     backs to the viewer, as if you are watching them hold the hand (not a strip at the top of the screen). Their
     backs show that side's card back. Hidden information stays hidden.
  3. **Cards on the board face their owner,** as on a real table, so the far side's cards read upside down. To keep
     them readable for spectators: a card turns to face the viewer while it is played or attacks, then settles back;
     hovering or tapping any card shows it full-size and upright; "Watch as" flips the whole view.
  4. **Each side's card back (the existing `cardBack` cosmetic slot) shows on its draw pile and its face-down hand**,
     with the pile's card count, as the 2026-11-08 design says. Both sides show their own back, whatever the view.
- **[owner] Everything the current arena shows carries over into 3D, rebuilt for the new scene.** The test example
  is a layout and feel test with placeholder art only; it doesn't include these yet. A 3D build is done only when
  every one of them works:
  - the faction wards (a Rare's ward ring, a Mythic's doubled ring) and their flares;
  - the card finishes on the board (Foil, Full Art, Alt Art, Glitch, Gold, Secret, Prototype, Zero-Day) with their
    shine and motion;
  - every play, attack, damage, death, status and token effect, keeping EFFECTS.md's constant-meaning rule (an
    effect always means the same thing, whatever the view);
  - the signature card and its zone, the coin flip at the match start (coin skins), and the boasts at the end;
  - "Watch as", the 2x controls, sound and music, replays, and the Watch live tile;
  - the cosmetics the owner has equipped (card back, avatar, arena/playmat, coin, boasts).
  This is the main cost of choosing true 3D: the effects are rebuilt, not reused.
- Zones laid out on the round arena: each side's units in a row, the signature zone, the draw pile (and discard), and
  the near side's hand fanned at the bottom edge (face up where the match allows; the hidden-hands rule for network
  agents still applies).
- Cards are played *onto the table* with motion: they fly from the hand, land with a shadow, and attacks travel
  across the board.

#### 3. The HUDs: stats above and below the board

- **[owner]** The opponent's stats (health, energy/mana and the like) sit **above** the board; your agent's stats sit
  **below** it.
- **[owner] A larger profile picture** in each HUD (about 68 px on desktop, up from 46 px), showing the agent's
  equipped avatar (the existing `avatar` cosmetic slot) or its emblem when none is equipped.
- Each HUD: agent name and owner, the profile picture, health bar with number, energy pips, hand and deck counts, the
  signature card's status, and the equipped boast and coin.
- The turn indicator and the turn number sit between the two halves, at the board's edge.

#### 4. The side panel on the right: Play-by-play | Chat

- **[owner]** The play-by-play moves from **under** the board to a **panel on the right**.
- **[owner]** The panel has **tabs: Play-by-play and Chat**, leaving room for a spectator chat room.
- Play-by-play: the existing move feed, restyled as a broadcast log (turn markers, highlighted big plays). When
  commentary is on, it shows the commentators' lines as captions, with each commentator's avatar and colour.
- On narrow screens (phone, the Home tile) the panel collapses to a drawer or a tab under the board.

#### 5. Spectator chat

- **[owner]** Room for a chat room during spectated matches.
- **[owner] Spectators must create an account to chat; guests can read the chat without one.**
- Proposal: one room per live match, messages kept with the match (readable on the replay), self-hosted on our server
  (no outside chat service).
- Needs before it opens to the public: rate limits, a word filter, mute and report, an admin delete, and a rule for
  how long chat is kept.
- Chat is a full feature (accounts, moderation, storage), so it's its own slice, after the layout.

#### 6. Live commentary: TTS "ESPN-style" commentators

**[owner]**
- The play-by-play is narrated by TTS commentators in a broadcast style, with **up to 6 commentators**, each with
  their own **visual and audio identity**.
- They **change randomly depending on the match**.
- They **call out moves as they happen**, in an authentic, human-sounding voice, **getting excited on big moves**.

##### 6.1 The cast

- **6 commentators**, each with: a name, a portrait/avatar (and a small animated "on air" state), a colour, a voice,
  a personality (e.g. the calm analyst, the hype caller, the veteran, the stats nerd, the deadpan, the rookie), their
  own catchphrases, and an intro sting.
- **[owner] A booth of two per match:** a play-by-play caller plus a colour commentator, drawn at random from the 6
  for each match (the ESPN format, so they can talk to each other).
- Themed to the world: AI personalities in the 90s retro-futurist style, not impersonations of real commentators.

##### 6.2 What they say (the text)

- Built from the match's own event log, with **no outside service**. Proposal: **templated lines per event kind**
  (a unit played, an attack, a counter, a signature card, lethal, a comeback...), many variants per event and per
  commentator, with card and agent names filled in. This keeps it fast, repeatable and offline.
- **An excitement score per event** drives which lines are picked and how hot they're delivered. It comes from the
  size of the swing (damage, board change, health lost), lethal and near-lethal moments, rare cards (Prototype,
  signature), comebacks, and how close the match is.
- Pacing rules so they don't talk over the game: not every move gets a line, big moments always do, a short
  cooldown sits between lines, and the colour commentator fills the quiet stretches.
- Likely advantage: the ladder plays a match first, then releases it at watch speed. If that holds, the commentary
  can be written and voiced **ahead of** what viewers see, so it's never late. *To verify in the game lane.*

##### 6.3 The voices (audio)

- **[owner] A pre-rendered line library (option b below).** The project rule is that the game runs with no outside
  services, payments excepted, so a cloud voice may be used only at build time, never while the game runs. The options
  that were considered:
  - **(a) Local open-source TTS on the Mac mini:** fits the rule and has no running cost. Quality and
    emotional range are lower than the best cloud voices, so "excitement" comes from line choice, delivery settings
    (speed, pitch, volume) and pre-recorded stingers and crowd beds.
  - **(b) A pre-rendered line library:** every stock line voiced once ahead of time (with local TTS, or a cloud
    service used only at build time, not while the game runs), plus short spoken name inserts. Best quality per line,
    less variety.
  - **(c) A cloud TTS service live:** the best voices, but it breaks the no-outside-services rule and adds a cost per
    match.
- Throughput: up to 8 house agents playing at once means several matches voiced in parallel. Measure on the Mac mini
  before building.
- Audio mix: the commentary sits above the music and below the big hit effects, with its own volume slider and mute.
  It's off in the Home tile (the tile is silent, owner 2026-11-12), and on in full screen.
- Captions are always available (the Play-by-play tab), for muted viewers.

#### 7. Assets this needs (with the art pass, after Season 0)

- The round arena's floor and rim, zone frames, card backs (the cosmetic slot's items) and HUD frames.
- The 6 commentator portraits and their "on air" animations, the booth graphic and intro stings.
- Crowd and broadcast sound beds and stingers.
- **Until then, placeholder art**, as in Season 0.

#### 8. Proposed build order (Season 1)

1. **Render: the new layout.** The 3D round arena (with the held hand, cards facing their owner, hover to read, card backs), the HUDs above and below, the right panel with its tabs (Chat as an
   empty tab "coming soon"), and the POV following "Watch as". Placeholder art. Proved in full screen, the tile, a
   phone and replays.
2. **Game: commentary text.** The excitement score and the templated lines from the event log, served with the live
   view and the replay. The 6 commentators' scripts and the booth draw per match.
3. **Render: commentary on screen.** Captions with avatars in the Play-by-play tab, plus the on-air animations.
4. **Game + render: voices.** The pre-rendered voice line library and its playback, audio timed to the moves, and the
   mix and volume controls.
5. **Game + render: spectator chat**, with its moderation rules.
6. **The art pass** swaps the placeholders for real assets.

#### 9. Owner decisions (2026-11-13)

1. **Q1:** a booth of two (play-by-play + colour), drawn at random from the 6 each match.
2. **Q2:** a pre-rendered line library (a cloud voice only at build time, never while the game runs).
3. **Q3:** an account is needed to chat; guests can read the chat.
4. **Q4:** true 3D, with the four modifications in section 2.

### 2026-11-13 (owner): Season 1 is the live launch, later in Q1 2027
- Season 1 is a live launch, later in Q1 2027, on its own server and website domain. The switch from Season 0 waits until then.
- **Sign-in: not decided.** Hosted accounts, wallet sign-in (such as MetaMask), or both. The owner leans towards wallet sign-in.

### 2026-11-14 (owner): card design rules, a shared mechanics framework, and cross-faction counters (not now)
- Spend real time understanding and developing card actions and systems that can be applied across all factions: attack, defence, effects over time, AOE effects, time-delayed effects, exponential-impact effects, daze effects, bounce-back defence, and more.
- Develop rules for card creation that consider all existing cards up to that point, so a new card is almost balanced out of the box.
- Counters: when a card is developed for a single faction with a unique effect, a card that counters that unique ability is developed for each of the other 3 factions.
- Timing: not now; added to the list (owner 2026-11-14).
