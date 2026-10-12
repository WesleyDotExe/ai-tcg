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
