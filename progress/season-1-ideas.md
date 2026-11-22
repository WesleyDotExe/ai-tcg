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

### 2026-11-14 (owner, answer 2 to game session 98): the full-collection column is a deck-builder issue (not now)
- In session 98's balance re-run (`progress/booster-rerun-s98/summary.md`), the decks built from a **full** collection spread 19.1 points across the factions (cards-3; 24.6 before tuning), while the realistic owners at 3 / 17 / 37 packs sat at 1.2 / 5.2 / 9.5.
- The owner reads it as a **deck-builder** issue, not a card one: the column is one build per faction, and the builder's pick there is noisy. The full Null build kept the starter deck with no booster card at all; the full Aegis build played only 5 booster copies, but also two Zero-Day cards and starter cards at full copies (72.5% against the shipped decks).
- No builder change before launch. For Season 1: look again at how the builder picks when it holds every card (more confirm games at the top, several builds per faction, or a check that the booster package is at least tried), and re-measure the full column as a builder test, not a card test.
- Why it can wait: no real owner holds a full collection in a 21-day season (the median owner holds a playable set after 48 packs).

### 2026-11-22 (owner): the January art plan — one look across Home, the arena, cards, packs, cosmetics, boasts and the booth

**[owner]** All the outside art is done together in January, after Season 0, as one plan: the art for every card,
pack and cosmetic, plus the end-of-match boasts and the commentators' animated faces. It must hang together and fit
both the current dashboard look (the owner loves the Season 0 theme) and the new Season 1 arena. Everything is made
at build time and committed as static files: **the game never calls a model while it runs** (the no-outside-services
rule, payments excepted). Nothing below is approved build work yet; the owner moves it onto the roadmap.

#### 1. The look in one line: a cyberpunk virtual world — glass over a neon night, with a 90s broadcast on top

**[owner] The game is a cyberpunk hacker, semi-neo retro-future, virtual world vibe** (2026-11-22). Every asset
below serves that: the arena is a virtual world the agents are running in, not a table in a room.

- **Virtual world:** things are rendered, not built. Cards and units **compile into existence** (wireframe →
  solid → lit), the arena floor is a **simulation grid** that runs to a retro-future horizon, damage is **data
  breaking up**, and a defeated unit **de-rezzes**. Space reads as cyberspace: depth fog, grid lines, holographic
  projections, floating UI.
- **Hacker:** terminal and console motifs (a blinking cursor, monospace readouts, code and hex streams, access
  prompts, "connection" language), used as accents in the art and the HUD details, never as walls of fake text
  over the game.
- **Semi-neo retro-future:** the 80s–90s idea of the future, made new: CRTs and scanlines, VHS and datamosh edges,
  chrome and neon signage, synth-grid horizons, but rendered cleanly at today's quality (the Geometry Wars-level
  glow), not lo-fi.
- **Cyberpunk:** night, neon on dark, hard light and deep shadow, tech-worn surfaces, faction "crews" with their own
  signage and sigils.
- The factions already fit: **Cortex** the network (clean data lanes, grids), **Swarm** the bio-code (living,
  self-replicating code), **Aegis** the firewall (chrome, shields, hard ICE), **Null** the virus (glitch, corruption,
  RGB split, decay).

Three layers, each with one job, built from what already exists:

- **The glass (the UI, code-drawn, no outside art):** Season 0's frosted glass tiles over the liquid background
  (`render/src/site/sitePage.ts`: light `#dfe6f6 → #d4cff2 → #bfdbf7`, dark `#0d1224 → #26244d → #122b57`, accents
  `--accent #4f6bff` and `--accent2 #8b5cff`, system UI type). Home, the Store, HUDs and panels stay this. Art sits
  **inside** glass (a card, a pack, a badge), never replaces it.
- **The neon night (the world, outside art):** the Season 1 arena's dark indigo stage (`#05060d` fog, the
  `#1b2150 → #080a1e` floor grid, the violet `#8a7bff` rim), lit by each side's faction colour. Card illustrations,
  pack art, playmats, card backs and boasts all live in this world: a dark, cool base so the glass reads over it, and
  **faction neon as the light source**, the Geometry Wars-quality glow the effects already use.
- **The broadcast (the booth, outside art):** the commentators and everything "on air" (intro stings, the booth
  graphic, tournament title cards) in the spec's **90s retro-futurist** style, shown on CRT screens. It frames the
  world; it never sits on the board.

#### 2. The art bible (the first deliverable; nothing is generated in bulk before the owner approves it)

- **Palette:** the indigo base and the two accents above; the faction neons from the render (Cortex `#35c9ff`,
  Swarm `#8bff5c`, Aegis `#ff7d24`, Null `#d565ff`, Neutral `#fff0c2`); rarity light (Common `#8e9bb8`, Uncommon
  `#cfe0ff`, Rare `#59a8ff`, Mythic gold `#ffcf5c`). Gold stays special: Mythic, Gold finishes and the Prototype
  foil marker.
- **Light:** a cool white key light, the faction colour as the rim light and glow, deep shadows. One rule for every
  asset, so a card, its pack and its boast look lit by the same arena.
- **The vibe test** for every asset: does it look like it belongs in a cyberpunk virtual world (section 1)?
  Fantasy-medieval, cute-cartoon or photographic-real-world art does not, however good.
- **Faction shape language** (from `render/src/factionSkin.ts`, so the art matches the effects): **Cortex** clean,
  networked, precise (square packets, lanes, grids, a square sigil); **Swarm** many small and organic (spores, egg sacs,
  drifting clouds, round forms); **Aegis** chrome, solid, shield-forward (heavy plates, hexagons, thick rings);
  **Null** glitch, corruption, decay (torn bars, stutter, RGB split, broken sigils); **Neutral** plain (the diamond).
- **AI-themed, original:** structure from Pokémon / MTG / One Piece, never their characters, names or art (DESIGN.md).
  No real people.
- **No text in generated art.** Names, numbers, rules text, the set number and the Prototype serial are drawn by
  code, so art never fights legibility and never needs regenerating for a typo.
- **Safe areas** per asset (where the frame, text and UI sit), so art is composed for its frame, not cropped into it.
- **Readability (the owner's standing cosmetics rule):** cosmetics change the look, never legibility; mats sit dimmed
  under the grid; effects and faction colours always draw on top.
- **Prompt templates, reference images and seeds** per asset type and faction, kept in the repo, so a monthly set
  drop matches the last one.
- **Style tiles first:** for each faction, one card illustration, one mascot, one card back and one boast frame,
  side by side on a glass tile and in the arena, for the owner to approve before anything else.

#### 3. What gets outside art (grouped; counts come from the set and cosmetics files at the time)

**A. Identity (first, because everything else carries it)**
- The **set logo and set symbol** (on every card, wrapper and Store item), the **AI·TCG wordmark**, the app icon and
  favicon.
- The **faction emblems** (4 + Neutral) and a **mascot per faction**: the hero image for packs, decks, the HUDs and
  Watch live.

**B. Cards**
- **Card illustrations** for the set, in the neon night, each faction in its shape language, composed for the frame's
  safe area. Full Art and Alt Art versions need their own wider compositions.
- **Finishes stay code** (Gold, Glitch, Secret, foil): the code's finish goes over the same illustration.
- **Prototype runs** (15 a season, unique art per run): the chase cards, so the strongest art in the set.
- **Tournament prize art:** the 1/1 and the limited prints.

**C. Packs**
- **[owner]** More Pokémon-like or MTG style: a crimped foil wrapper, the set logo at the top, the faction mascot as
  the hero, the set symbol. The Season 1 visual plan's phase 2 picks the wrapper design with placeholder art; January
  makes the real art for that design.

**D. Cosmetics (the Store's shop window shows them as pictures)**
- **Arenas / playmats:** the default arena's floor, rim and sky (it must look finished too), then the mats for sale,
  as a circle under the play area only (owner 2026-11-08).
- **Card backs:** the default back (every match shows it), then the backs for sale.
- **Avatars:** a pool of good portraits for agents (the avatar slot), in the neon night's light.
- **Coins:** the faces and edges for the coin cosmetic.
- **Boasts:** see E.

**E. Boasts (end-of-match brags)**
- **[owner]** An outside model could bring the boasts to life.
- Proposal: a **trial on one boast**, three ways side by side, in the fenced `render/season1/`: (1) code keeps the
  animation and an image model makes its pieces (a stamp or sticker per boast, faction mascot poses, particle
  textures), as the effect textures were made; (2) a short mascot victory loop from an image-to-video model at build
  time, cleaned into a transparent sprite sheet the code plays; (3) a short sound sting or voiced line per boast.
  The owner picks which way the rest are made. Every way keeps the boast rules: nothing past the winner's side,
  the flash limit, reduced motion.

**F. The commentators' booth**
- **[owner]** Each commentator is a **face with a few animated frames that emote to their commentary**, in a
  **vertical rectangle box next to their commentary box**, with an overlay that makes them look like they are **on a
  CRT**.
- Proposal: about 8 frames per commentator (idle, blink, two mouth shapes, excited, shocked, smug or laughing,
  wincing), so about 48 for the cast of 6. The face is picked from the commentary's own excitement score and event
  kind (a lethal hit → excited, a comeback → shocked); each line carries its expression. The mouth flaps in time with
  the pre-rendered voice line (its timing measured when the line is rendered). Both booth members show: the speaker
  lit, the other idling and blinking. On a phone the boxes shrink to heads above the captions; the Home tile stays
  silent (owner 2026-11-12).
- **The CRT is code** (scanlines, a slight curve, glow, faint colour fringing, the odd rolling bar), within the flash
  limit; reduced motion leaves still scanlines.
- **The hard part is one face across 8 frames:** one base portrait per commentator, the other expressions made from
  it with an image-editing model, all framed identically. Trial one commentator before the six.
- Plus the booth graphic and the intro stings (already in this file's commentary spec, section 7).

**G. Ranks and badges**
- **Tier badges** for every ladder tier (`economy/src/config.ts` `LADDER_TIERS`: Bronze, Silver, Gold, Platinum,
  Diamond, Mythic), today plain hexagons. The next badge is one of the strongest pulls in a ranked game.
- Achievement, milestone, promo and season badges.

**H. The website**
- The landing page hero, share images (what shows when a link is posted), loading art.
- **Empty-state and first-time illustrations** for the Season 1 Home's new-player states (the Home plan's phase 3).

**I. Audio (outside assets, not art)**
- Background music (the owner wants music to go with the code-made sound effects), drum machine samples for the
  music tool, broadcast beds and stingers, and the commentators' pre-rendered voice library (section 6.3 above).

**Stays code (no outside art):** the glass UI and its icons, card frames and finishes, the effects (their textures
are already made), the CRT overlay, the code-made sound effects.

#### 4. Decisions before January's first batch

1. **The art bible and the style tiles:** the owner approves them before anything is made in bulk.
2. **Signature Mythic art vs the runtime rule:** each new agent gets 3 generated candidates for its signature card,
   but the game never calls a model while it runs. Options: a large pre-generated pool to pick from; candidates
   made by a build-time job (a wait for the owner); or a second exception to the rule. Needed before Season 1's
   live launch. (Same question as the "Agent art creation" idea at the top of this file.)
3. **Licences:** check each model's terms allow commercial use, since cosmetics are sold.
4. **A spend cap per batch**, as the mythic-wards action has (`MAX_PER_RUN`), with the per-image cost measured on
   the first pilot batch.

#### 5. How it's made

- The existing pattern: a GitHub Action with the Replicate key in a repo secret makes the assets and commits them as
  static files (as `mythic-wards.yml` does); the game only reads files. A placeholder stays as the fallback for any
  asset not made yet.
- **Every batch lands on a gallery page first** (in the arena's light and on a glass tile, light and dark themes) for
  the owner to approve; only approved art is committed for use.
- **Pilot, then batch:** a small pilot per asset type (for cards, 3 per faction), approve, then the rest in batches.

#### 6. Proposed order (January, after the owner is back)

1. The art bible and the style tiles → owner approves.
2. Identity: the set logo and symbol, faction emblems and mascots, the wordmark and icon.
3. Packs (the wrapper design picked in phase 2) and the default card back.
4. Cards: the pilot, then the set in batches; then Prototypes and prize art.
5. The default arena and the tier badges; the avatar pool.
6. The boast trial → the owner picks → all the boasts.
7. The commentator trial (one face and its CRT box) → the cast of 6 (with the commentary build, steps 2–3 of its
   order above).
8. The cosmetics for sale (mats, backs, coins, boasts), the website art, the empty states, the badges.
9. Audio alongside: music, drum samples, broadcast beds, the voice library.
