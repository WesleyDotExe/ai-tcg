# Current status

**Build-order stage: Stage 4+ (the living system). Session 44 (game lane) built the owner's option A
for the ring (session 43's check-in) and investigated why a signature card helps Aegis most. No
card or signature option changed. A new [OWNER CHECK-IN] is in notes-for-owner.md.**
- **The ring's real-match check:** `ringRegression.ts --real` (`npm run ring:real`), baseline
  `engine/src/dev/ringBaselineReal.json`. CI runs it in place of `--signature`, which still runs as a
  report. Null > Aegis 45.4% OUT (accepted-OUT in this baseline), Aegis > Cortex 56.1%, Cortex >
  Swarm 53.4%, Swarm > Null 55.8%, Null ~ Cortex 50.7% IN, Aegis ~ Swarm 56.2%.
- **Session 43's draw bug fixed:** `(seed * 7 + seat * 3) % 14` reached 2 of 14 lines per seat. Now
  `edgeMeasure.approvedSignatureFor`: even over the 14 lines, balanced by seat order, pinned by a test.
- **Why Aegis gains most (+9.9 mean vs +0.9 to +3.1):** spare late energy (2.9 unspent per late turn
  vs 1.8-2.2; a heavier-deck ablation cuts the gain ~3 points per edge, about a third), the card
  becoming Aegis's attacker (correlational), not tools (a no-tools rule: +1.4, noise). Six trials;
  none reaches the band; best is Null Singularity cost 6 (+3.8, costs Swarm > Null 3.3).

## What stands (this session's work; sessions 1-43 otherwise unchanged)

- `engine/src/dev/edgeMeasure.ts`: `SignatureMode` ("none" / "setMythic" / "approved"),
  `APPROVED_SIGNATURE_CARDS`, `approvedSignatureFor`.
- `engine/src/dev/ringRegression.ts`: three modes, `DECK_MODES` exported; `engine/package.json`
  `ring:real`; `.github/workflows/test.yml` runs it.
- `engine/src/dev/aegisSignatureGain.ts` (new): the gain table, late-turn spare energy, what happens to
  the signature card, six trials, the heavier-deck cause check.
- `engine/src/dev/signatureRingDrivers.ts` uses the shared draw.
- `engine/test/ringRegression.test.ts`: the real-match baseline's shape; the draw's evenness.
- `progress/balance-report-031-real-ring-aegis-gain.txt`; report 030 carries a correction note.
- `npm test`: all workspaces pass; typecheck clean; gate, `--real` and `--signature` all PASS.

## Concrete next step

Check the alternation first: this PR follows render's #72, so the next session is **render**
(slice 3, the first-time flow, as the owner planned).

The next **game-lane** session (session 45, the 5th: a HARDENING pass unless the owner says
otherwise):
1. The owner's answer to the session-44 check-in. Default A: no card change; Null > Aegis stays the
   real-match check's accepted-OUT edge; note the cause for the next set's design (an Aegis late
   play; a Null answer to a durable attacker) in roadmap.md. B: Null Singularity cost 6, re-record
   both baselines. C: an Aegis deck trial with real Aegis cards.
2. Hardening: re-run the signature approved list's 10,000-game check with the session-41 agent
   (quality debt), and give the dev report drivers a smoke test so their top-level code can't rot.
3. Then roadmap 2b: the deck-building agent (Zero-Day cards: 1 per deck, the removal share).

**Blocked:** nothing.
