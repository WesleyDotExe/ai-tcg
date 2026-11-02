# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 68 (game lane): the owner's four
first-seat fixes measured (test only), and the small asks the render lane waits on. Nothing is blocking. Owner
check-ins open in notes-for-owner.md: pick the first-seat fix (my pick: the second seat starts on 24 health),
and the coin skins plan's game half.**

- **The first-seat fixes, measured** (`progress/first-seat-002-fixes.txt`, data in `progress/first-seat-fixes/`):
  (a) +1 opening card, (b) +1 first-turn energy, (c) 22 health, (d) no first-turn attack, plus 24 health,
  +2 cards, +2 energy and three pairs. On the shipped-deck mirrors (1,000 seeds a faction, same deals), the
  2,400-match ladder split, the ring check in both modes, and the leaders through the built-deck ring. (d) does
  nothing; cards and energy fail the ring check; health passes it, and 24 health gets the ladder to 52.3%.
  Engine: `MatchRules` (test-only, `state.rules`, absent in every shipped match; default play byte-identical,
  ring PASS unchanged). Instruments: `engine/src/dev/seatVariants.ts`, `firstSeatFixes.ts`,
  `server/src/dev/firstSeatLadder.ts`, `--rules` on `builtDeckRing.ts ring` and `ringRegression.ts`.
- **"Watch again"** (schema v19 `pack_reveals`): each opening kept as answered; `GET /api/packs/:packId/opening`
  answers the same `PackOpening` (410 before v19).
- **The card viewer** (`GET /api/collection/cards/:cardId`): `copyLimit` and `craft { packPoints, available,
  reason }`.
- **The Promos tab** (`GET /api/collection`): `promos { signatureCards, earned }`.
- **`DeckStatus`**: `faction` and `list` (in `GET /api/play`).
- All in `server/OWNER_API.md`.

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #118, was the render lane's). If this
PR is the last merged, the next session is **render** (the match pages on session 67's endpoints; "Watch again"
and the Promos tab and craft price can now read the API).

The next **game-lane** session is **69**:
1. Read owner-feedback.md for the first-seat pick and the coin plan. If the coin plan is approved, build its
   game half (the `coin` slot and kind, Chrome Token granted and equipped, the two store coins, the coin on the
   match record and the replay; tier coins wait for season end). Do NOT ship the first-seat fix in 69: it waits
   for versioned replays.
2. If nothing is answered: the Stats page's endpoint, or who is featured ("Top rated"), from the roadmap's
   item 2.
Session 70 is the hardening pass: **versioned replays first** (the owner's call 6: replays carry card and rule
versions, old ones stay rebuildable), then the picked first-seat fix (the printed rule, the test-only variants
removed, ring baselines re-recorded, the built-deck ring regenerated), and `owner-api-demo-002`'s drift.

**Blocked:** nothing.
