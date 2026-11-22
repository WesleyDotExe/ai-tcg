# Season 1 Home: the mockups

Phase 1 steps 2 and 3 of the owner's 2026-11-22 plan: Home mockups A, B and C, each with its navigation, so the owner
can pick a direction (point 11: "sessions show options for him to pick from"). Each one draws the **same tiles** from the
**same spec** (`src/homeSpec.ts`, `HOME_TILES.md`) and the **same real data**. Only the look and the navigation differ.

- **The data:** `mockup/snapshot.ts` starts the Season 0 site demo with the ladder playing (the real owner API over a
  real store) and reads, through the API, the same two owners the audit used: Nova (weeks in) and Wren (just signed
  up). It writes `mockup/data/home-data.json`. Nothing is invented: every number in a mockup is the server's.
- **The tiles:** `src/homeFacts.ts` turns each spec fact into words and marks for one owner (shared by A, B and C).
  Every fact's fragment carries `data-fact`, so the tests and the browser check hold each drawn tile to the spec.

## Mockup A: the question is the label (render session 83)

`output/home-mockup-a.html` (self-contained; open it in a browser). The strip at the top is the mockup's own
controls, not part of the design: owner (Nova / Wren), board (recommended, all S, all M, all L), theme.

- **Each tile wears its one question under its name, at every size.** A tile says what it's for before it says
  anything else (owner point 11, "the tiles don't clearly say what they are").
- **One button per tile:** its next action (the spec's `next`, made concrete: Start, Open a pack, Open packs for a
  new player, Claim free pack...). The corner arrow opens the page that answers the same question in full.
- **Five places, not nine:** Home, My agent, Watch, Cards, Ladder, plus Settings at the rail's foot. A rail on a
  desktop, a tab bar on a phone. Where Season 0's nine went:
  | Season 0 | A |
  |---|---|
  | Home | Home |
  | Agent match, Connect agent | My agent (controls, match history, connect) |
  | Watch live | Watch |
  | Collection, Store | Cards (Packs, Store, Collection as tabs) |
  | Stats | Ladder (ladder, rating, earnings) |
  | Tournament (Soon) | not shown until it exists |
  | Settings | Settings (rail foot) |
- **Home has no top bar.** On Home the tiles are the wallet and the bell: Store owns the credits and Notifications
  the alerts (one home per fact). Every other page has a slim top bar with the credits, the pack points (named, not a
  bare ◆) and the alerts, since there are no tiles there. The sidebar's agent card is gone (My agent owns it).
- **Sizes:** on a desktop S is one cell, M is 2x2, L the full width (Watch live: M 1x3 and L 2x3, so its arena is
  9:16). On a phone every tile shows its **S face** and Watch live its M (the 9:16 arena fits a phone as it is): the
  recommended board is 2.7 screens for Nova (Season 0's was 3.4).
- **Edit board** keeps the customising the owner likes: S / M / L and move buttons on every tile.
- **Watch live's arena is a stand-in:** a 9:16 board drawn from the live match's real state (units, health, energy,
  whose turn). The Season 1 arena in 9:16 is plan step 5.
- The other pages are stubs that say what they will hold and which tiles open them (mockup A draws Home only).

Build and check:

    npx tsx season1/mockup/snapshot.ts        # (in render/) re-read the demo (about 15 s)
    npx tsx season1/mockup/buildMockupA.ts    # -> season1/output/home-mockup-a.html
    npx vitest run season1                    # the spec, the facts, mockup A
    node render/season1/ci/home-mockup-check.mjs   # headless Chromium: both owners, every size, desktop and phone, the navigation

## Mockups B and C (render session 84)

Not built yet. They try different answers to the same questions (for example: a headline-number tile with the
question behind a tap; a feed-like Home that orders tiles by what needs you), on the same tiles and data.
