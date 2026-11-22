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
    node render/season1/ci/home-mockup-check.mjs a   # (since render 84 it checks A, B or C, or all)

## The owner's 2026-11-22 changes, in all three (render session 84)

- **Pack actions, one home each:** claim the free pack in **Daily rewards** ("Claim free pack"), open in **Packs**
  (only the packs you have), buy in **Store**. The free pack's alert now shows the Daily rewards tile.
- **The Store is a shop window:** credits and what they buy at S; the featured pack and three cosmetics as pictures
  with prices and Buy at M; the full shelf at L (packs in a row, cosmetics by type). Season 0's own art: the sealed
  pack with its plate (`FACE_SCRIPT`'s `packPlateSvg`, run at build time), the coin painter (`COIN_SCRIPT`), the
  boasts' emblems (`boastGlyphSymbols`). All in `src/homeFacts.ts`, so A, B and C draw the same.
- **A's rail** now runs the page's full height (its glass is the column; its contents stick).

## Mockup B: the headline first (render session 84)

`output/home-mockup-b.html`. Light by default (Season 0's), dark on the strip.

- **Season 0's look, back:** frosted glass over the Glacier background, coloured icon chips, My agent and Watch live
  as deep-indigo hero tiles, Season 0's pack and coin art. The vibe as accents: a chrome AI·TCG wordmark, a faint
  circuit grid and a synth horizon behind the glass, monospace kickers, a static scan sheen on the hero tiles.
- **Each tile leads with its answer:** the first fact drawn big beside a picture of it (a ring for today's earnings and
  the set, the fanned sealed packs, the tier's badge, the bell, the last result), the details under it. The tile's
  question sits behind a **"?"** on its header (one tap).
- **A top bar:** the brand, the five places in the middle, Settings and the account on the right. On a phone the
  places drop into a row under the brand. Home has no wallet or bell; other pages carry both in the bar.
- **Tiles take their content's height** (masonry, `src/homeShell.ts`): no empty glass at L for a new player.

## Mockup C: what needs you first (render session 84)

`output/home-mockup-c.html`. Dark (the neon night) by default, light on the strip.

- **Home orders itself:** the tiles that need you now come first under **Needs you**, most urgent first, each with its
  reason on a neon tag ("A free pack to claim", "Your agent hasn't started yet", "Packs to open", "New alerts", "Your
  credits can buy something", "Your agent is playing now"); the rest under **All quiet**. The reasons are read off
  the server's answers (`needsOf` in `src/homeMockupC.ts`, tested), never guessed. Edit board still sets each tile's
  size and the order inside each group.
- **The vibe leads:** a simulation grid running to a glowing horizon, faint scanlines, tiles as HUD panels with cut
  corners and a neon edge in their colour, a terminal prompt over Home (`wren@ai-tcg:~/home $`), the question as a
  code comment under each tile's name (`// Do I have packs to open?`). Labels stay plain words.
- **A console rail**, its glass the page's full height: the five places with their keys (1-5), Settings and the
  account at its foot, and **Jump to** (or "/"): a palette that finds any place or tile by name. A tab bar on a phone.
- Tiles take their content's height (masonry), as B.

## Side by side

`output/home-compare.html`: A, B and C live in three frames, the same owner (Nova / Wren) and screen (desktop / phone)
for all three. Stills: `progress/render/evidence/season1-home-mockups-s84/compare-*.jpg`.

## Build and check (all three)

    npx tsx season1/mockup/buildMockupA.ts    # (in render/) -> output/home-mockup-a.html
    npx tsx season1/mockup/buildMockups.ts    # -> output/home-mockup-b.html, home-mockup-c.html, home-compare.html
    npx vitest run season1                    # the spec, the facts, A, B and C
    node render/season1/ci/home-mockup-check.mjs all   # headless Chromium: each mockup, both owners, every size,
                                                       # desktop and phone, the navigation; evidence in
                                                       # progress/render/evidence/season1-home-mockups-s84/<a|b|c>/
