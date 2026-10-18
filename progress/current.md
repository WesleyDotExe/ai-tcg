# Current status

**Build-order stage: Stage 4+ (the living system). Session 43 (game lane) investigated the ring's
signature mode for the owner (no card, option or baseline changed) and raised a new [OWNER
CHECK-IN] in notes-for-owner.md.**
- **The finding:** `ringRegression.ts --signature` puts each faction's set Mythic in the zone; real
  matches carry a generated Neutral menu card (store.ts match setup) with the Mythic in the deck.
  In the set-Mythic mode the 71.5% Aegis > Cortex is Prime Aegis's guaranteed access (+33 points
  alone). In a real-match stand-in (Mythic in deck + an approved menu card each side) Aegis >
  Cortex is 54.2%, and the far-out edge is Null > Aegis at 45.2%: a signature card is worth ~2x
  as much to Aegis as to the others.
- **Trials on Prime Aegis** (cost 7, no enemy aura, 4/6): each fixes Null > Aegis a little and costs
  the gate's Aegis > Cortex; 4/6 changes nothing.

## What stands (this session's work; sessions 1-42 otherwise unchanged)

- `engine/src/dev/signatureRingDrivers.ts` (new): the ring in four modes (gate, set Mythic as
  signature, plain stand-in, approved menu lines), the one-side-only splits for the set-Mythic and
  approved modes, key-card use (played, turn, died, win rate when it sticks), Prime Aegis trials.
- `progress/balance-report-030-signature-ring-drivers.txt` (its output at 2,500 seeds, with a reading).
- `progress/roadmap.md` item 8: the owner's art-model decision (Imagen 4 Ultra) and its open points.
- `npm test`: all workspaces pass; `tsc` clean; both ring modes PASS (nothing changed).

## Concrete next step

Check the alternation first: this PR follows render's #70, so the next session is **render**
(slice 3, the first-time flow, with the hold-to-tilt feature as corrected: the card tilts as one
piece).

The next **game-lane** session:
1. The owner's answer to the session-43 check-in. Default A: add a third ring mode to
   `ringRegression.ts` (Mythic in deck + approved lines, drawn as `signatureRingDrivers.ts` does),
   record its baseline, make CI run it in place of `--signature`, and keep the set-Mythic numbers
   as a report. Then measure why Aegis gains ~2x from a signature card (card use with and without
   one, which Aegis cards stack on it), and propose a Null > Aegis fix at a check-in.
2. Then roadmap 2b: the deck-building agent (Zero-Day cards: 1 per deck, the removal share).
3. Quality debt: re-run the signature approved list's 10,000-game check with the new agent.

**Blocked:** nothing.
