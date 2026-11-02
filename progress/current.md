# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 70 (game lane) was the hardening pass:
versioned replays (the owner's call 6), and two drifted demos fixed. Nothing is blocking. No owner check-in is
open; five build calls are listed in notes-for-owner.md to keep or change.**

- **Versioned replays** (`server/src/ladder/replayFile.ts`, `engine/src/engine/versions.ts`): the ladder writes
  `ai-tcg-replay/2`: `versions: { rules: "rules-1", cards: "cards-1", cardsDigest }` and every deck card in full,
  so a file plays its own cards and rules, never today's. `/1` files (sessions 67-69) read the frozen `cards-1`
  snapshot (`engine/src/data/cardSnapshots/cards1.ts`) and `rules-1`. `rebuildReplay(file, hooks?)` reads either
  and checks the end as recorded; unknown formats, rules versions and tampered cards are refused with the reason.
- **Guards:** a card change fails `engine/test/versions.test.ts` until it gets a new `CARDS_VERSIONS` entry; four
  golden replays (two real `/1` files from the session-69 writer, two `/2`; `server/test/fixtures/replays/`) are
  rebuilt byte for byte in `server/test/replayGolden.test.ts`, and again against a registry where every unit has
  changed (`replayRegistryChange.test.ts`).
- **Readers moved to it:** the owner-API tests and demos, and the render's match pages (`siteReplay.ts`,
  `siteHost.ts`; `captureMatch` takes `rules`). `server/OWNER_API.md` documents `/2`.
- Evidence: `progress/replay-versions-001.txt` (14 checks PASS, byte-identical across runs), including a simulated
  later set where, read without versions, an old file's moves play on to a different match.
- **Drifted demos fixed:** `owner-api-demo-002` (two shipped card changes it missed, sessions 60 and 62, confirmed
  at each commit), `economy-demo-009` (a stale Zero-Day check).

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #122, was the render lane's). If this
PR is the last merged, the next session is **render** (its first coin slice, or the next live-board slice).

The next **game-lane** session is **71: ship the 24-health rule** (owner 2026-11-02): "The player going second
starts with 24 health; the player going first starts with 20 and skips its first draw."
1. Add `rules-2` to `RULES_VERSIONS` (`{ secondSeatExtraHealth: 4 }`, the text as the owner wrote it) and make it
   current. Decide (and write in versions.ts) whether the ladder passes `rulesOfVersion(CURRENT_RULES_VERSION)` or
   the engine's base changes; if the base changes, give `rules-1` explicit 20/20 fields FIRST. The golden replays
   must stay green either way.
2. Remove the losing test-only variants (a, b, d) from `MatchRules`, `init.ts`, `engine.ts`, `moves.ts`,
   `seatVariants.ts` and the instruments that name them.
3. Re-record the `ring` / `ring:real` baselines under rules-2, re-run the built-deck ring (about 25 minutes on 4
   cores), re-check the live ladder's watch length (`npm run demo:live-ladder -w server`), re-measure the first
   seat (`npm run measure:first-seat -w server`).
4. The shipped numbers to an owner check-in before the launch-gate re-run. Watch the render lane's committed
   samples: if the engine's base changes they drift (flag it for the render lane; don't regenerate theirs).
Then (session 72+): the 2x vote, featured picks (rule to a check-in), viewer counts, the three render-51 live-feed
asks.

**Blocked:** nothing.
