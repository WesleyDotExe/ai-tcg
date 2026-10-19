# Signature-card fairness results (session 32)

Raw output of `engine/src/dev/signatureFairness.ts`, one JSON object per line, read by
`engine/src/dev/signatureMenuReport.ts` to print `progress/balance-report-023-signature-menu.txt`.
The cached reference ring it was measured against is `engine/src/dev/signatureReference.json`
(2,500 seeds per ordered pairing).

| file | command (from `engine/`) |
|---|---|
| `on-table-900.jsonl` | `npx tsx src/dev/signatureFairness.ts candidates --seeds 900 --shard i/4 --out ...` (all 48 cost-5 lines, plus the first 57 cost-6/7 lines before the run was narrowed to cost 5) |
| `on-table-2500.jsonl` | `npx tsx src/dev/signatureFairness.ts candidates --seeds 2500 --ids sig5-3x6-recycle,sig5-3x6-restore --out ...` |
| `tuned-cost5.jsonl` | `npx tsx src/dev/signatureFairness.ts tune --ability K --tier 5 --seeds 500 --confirm 2500 --out ...`, once per option |

Everything is seeded, so each command reproduces its lines exactly.

## Session 33 (the owner's 2026-10-13 levers)

Printed into `progress/balance-report-024-signature-levers.txt` by `engine/src/dev/signatureLeversReport.ts`.

| file | command (from `engine/`) |
|---|---|
| `levers-0.jsonl` … `levers-3.jsonl` | `npx tsx src/dev/signatureFairness.ts levers --shard i/4 --coarse 300 --seeds 500 --confirm 2500 --out ../progress/signature-fairness/levers-i.jsonl` (i = 0..3, run in parallel; option k goes to shard k mod 4) |
| `reworks.jsonl` | `npx tsx src/dev/signatureReworkProbe.ts --out ../progress/signature-fairness/reworks.jsonl` (rework proposals for Guardian and Bulwark: not menu options, measured for the owner's check-in) |

Each `levers` line holds one option: every table line screened at 300 seeds, the stat walks from its three best
lever configs at 500 seeds, and the three best lines over all of it re-measured at 2,500 seeds (only those count
as a pass).

## Session 34 (the owner's 2026-10-15 option A: the finer pass, Barrier-only Guardian, units-only Bulwark)

Printed into `progress/balance-report-025-signature-finer-pass.txt` by `engine/src/dev/signatureFinerPassReport.ts`. The
passing lines over every file here (2,500 seeds only; Guardian and Bulwark only from the session-34 files, since both
changed) are written into `engine/src/data/signatureApproved.ts` by `engine/src/dev/signatureApprovedList.ts`, the
generator's only source of signature cards.

| file | command (from `engine/`) |
|---|---|
| `grid-0.jsonl` … `grid-3.jsonl` | `npx tsx src/dev/signatureFairness.ts grid --abilities smite,energy-surge,sweep,guardian,bulwark --seeds 1000 --shard i/4 --out ../progress/signature-fairness/grid-i.jsonl` (every size x attack 2-4 x health 3-9 at cost 5; compact lines: per-edge change, no intervals) |
| `grid-confirm-0.jsonl` … `grid-confirm-3.jsonl` | `npx tsx src/dev/signatureFairness.ts confirm --in grid-0.jsonl,…,grid-3.jsonl --top 5 --seeds 2500 --shard i/4 --out ../progress/signature-fairness/grid-confirm-i.jsonl` (the 5 best grid lines per option, full results) |
| `levers-s34-guardian.jsonl`, `levers-s34-bulwark.jsonl` | `npx tsx src/dev/signatureFairness.ts levers --ability guardian\|bulwark --coarse 300 --seeds 500 --confirm 2500 --out ../progress/signature-fairness/levers-s34-K.jsonl` (session 33's tuner on the reworked options, all tiers) |

The session-33 `levers-*.jsonl` lines for Guardian and Bulwark measured the old cards (Guard and Barrier; "aimed at your
side") and stay as the record of those; `signatureLeversReport.ts` ignores the `levers-s34-` files so report 024 still
prints as committed.

## Session 35 (the owner's 2026-10-15 answer to session 34: grow the pool)

Printed into `progress/balance-report-026-signature-10k.txt` by `engine/src/dev/signatureTenThousandReport.ts`. The
reference (`engine/src/dev/signatureReference.json`) now holds 10,000 games per ordered pairing; its first 2,500 are
exactly the old 2,500-game reference (same seeds), so every earlier command still reproduces its lines.

`signatureApprovedList.ts` now lets a line's **largest** measurement decide: a pass at 2,500 that fails at 10,000 is
out, a miss at 2,500 that passes at 10,000 is in.

| file | command (from `engine/`) |
|---|---|
| (reference) | `npx tsx src/dev/signatureFairness.ts reference --seeds 10000` (about 2 minutes on one core) |
| `remeasure-10k-0.jsonl` … `remeasure-10k-3.jsonl` | `npx tsx src/dev/signatureFairness.ts remeasure --ids <the 7 near misses, then the 16 session-34 approved lines> --seeds 10000 --shard i/4 --out ../progress/signature-fairness/remeasure-10k-i.jsonl` (full results; the 23 ids are listed in report 026) |
| `s35-grid-0.jsonl` … `s35-grid-3.jsonl` | `npx tsx src/dev/signatureFairness.ts grid --abilities smite,sweep --sizes d2m3,d1hp15,d2hp15,hp15,r2hp15 --seeds 1000 --shard i/4 --out ../progress/signature-fairness/s35-grid-i.jsonl` (the session-35 sizes x every cost-5 body, attack 2-4, health 3-9) |
| `s35-confirm-0.jsonl` … `s35-confirm-3.jsonl` | `npx tsx src/dev/signatureFairness.ts confirm --in s35-grid-0..3.jsonl --top 2 --seeds 10000 --shard i/4 --out ../progress/signature-fairness/s35-confirm-i.jsonl` |

The new files are prefixed `s35-` so report 025's `grid-` reader still prints as committed.

## Session 48 (hardening: the approved list re-checked with session 41's agent)

Printed into `progress/balance-report-033-signature-recheck.txt` by `engine/src/dev/signatureRecheckReport.ts`. These
files are in `agent41/`, a subfolder, so `signatureApprovedList.ts` (which reads only this folder's own `.jsonl` files)
doesn't mix measurements from two agents. The reference these lines pair with is the new
`engine/src/dev/signatureReference.json` (10,000 seeds, today's agent); the session-35 one is kept as
`engine/src/dev/signatureReference-s37.json` for the older reports.

| file | command (from `engine/`) |
|---|---|
| (reference) | `npx tsx src/dev/signatureFairness.ts reference --seeds 10000` |
| `agent41/recheck-10k-0.jsonl` … `agent41/recheck-10k-3.jsonl` | `npx tsx src/dev/signatureFairness.ts remeasure --approved --seeds 10000 --shard i/4 --out ../progress/signature-fairness/agent41/recheck-10k-i.jsonl` (i = 0..3, in parallel) |

## Session 49 (owner 2026-10-19: the approved list from today's agent; a Guardian line)

From this session `signatureApprovedList.ts` reads **only** `agent41/` (owner 2026-10-19, answering
session 48's question 2): the files directly in this folder are the older agent's and count for no
line. When the measuring agent changes again, re-measure into a new subfolder and point the
generator's `AGENT_RESULTS` at it. Printed into `progress/balance-report-034-guardian-search.txt` by
`engine/src/dev/signatureGuardianReport.ts`.

| file | command (from `engine/`) |
|---|---|
| `agent41/guardian-grid-0.jsonl` … `-3.jsonl` | `npx tsx src/dev/signatureFairness.ts grid --abilities guardian --seeds 1000 --shard i/4 --out ../progress/signature-fairness/agent41/guardian-grid-i.jsonl` (every cost-5 body, compact lines) |
| `agent41/guardian-levers.jsonl` | `npx tsx src/dev/signatureFairness.ts levers --ability guardian --coarse 300 --seeds 500 --confirm 2500 --out ../progress/signature-fairness/agent41/guardian-levers.jsonl` |
| `agent41/guardian-confirm-10k-0.jsonl`, `-1.jsonl` | `npx tsx src/dev/signatureFairness.ts remeasure --ids sig5-3x4-guardian,sig5-3x6-guardian --seeds 10000 --shard i/2 --out ../progress/signature-fairness/agent41/guardian-confirm-10k-i.jsonl` |

## Session 50 (hardening: result lines carry their own provenance)

Every full result written from this session on carries `fingerprint` (the card's
`signatureFingerprint`) and `reference` (`referenceStamp` of the reference it was paired with: a
hash of that reference's per-seed results at the line's seed count, so another agent, other decks
or another stand-in give another stamp). Grid lines carry both too. `signatureApprovedList.ts`
picks lines by the rule in `engine/src/dev/signatureApprovedSelect.ts`: a stamped line whose card
or reference isn't today's is set aside as STALE and printed, whatever its seed count. Older,
unstamped lines are checked by the reference win rate every edge records (`refRate`): all twelve
must equal today's reference at that seed count. That check tells the two agents apart exactly:
every line in `agent41/` matches today's reference, every line directly in this folder matches the
session-37 one (`engine/test/signatureApprovedSelect.test.ts` runs both). So the subfolder is a
filing convention now, not something the list has to trust.

| file | command (from `engine/`) |
|---|---|
| `agent41/stamped-s50.jsonl` | `npx tsx src/dev/signatureFairness.ts remeasure --ids sig5-3x6-tax --seeds 2500 --out ../progress/signature-fairness/agent41/stamped-s50.jsonl` (the first stamped line: Tax 3/6 at 2,500, worst 1.2, PASS; its 10,000-game re-check still decides) |
