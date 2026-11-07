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
