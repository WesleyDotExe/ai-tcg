# Current status

**Build-order stage: Stage 4+ (the living system). Session 37 (game lane) handled the owner's
2026-10-16 entries:**
- **Owners name their agents** (schema v9): free at creation, a paid rename, the name rules in the
  store, old names kept for "formerly ...", an admin force-rename.
- **More room for generated agent names:** a three-part pattern, ~10,700 handles, 300 modifiers,
  200 program words, no version endings, a numeral on a clash.
- The pack check-in answers: everything stands as built.
- The top finish, top-tier cards, modal cards and chase cards: **a build order is proposed** in an
  [OWNER CHECK-IN] in notes-for-owner.md; nothing of those is built yet.

No stage checkpoint (the living system reports through notes-for-owner check-ins).

## What stands (this session's work; sessions 1-36 otherwise unchanged)

**Names (`engine/src/data/signatureNames.ts`).**
- `AGENT_TEMPLATE_WEIGHTS`: [Handle]'s [Modifier] [Program] 41, [Handle]'s [Program] 20, [Handle]
  of the [Place] 30, [Modifier] [Handle] 5, [Handle] [Edition] 4.
- `HANDLE_PREFIX` / `HANDLE_SUFFIX` ~100 each (10,702 handles after the filter), `MODIFIERS` 300,
  `PROGRAMS` 200 (handles and modifiers are shared with card names).
- `AGENT_NAME_MAX_LENGTH = 32`; `AGENT_EDITIONS` (no v2 / Mk III); `drawAgentName` compares without
  case and adds II..X on a clash; `agentNameSpace()` ~648 million.
- `blockedWordIn` exported; `namingProblem(name, maxLength)`.
- "Zero-Day" replaced by "Backdoor" in the strike things (the proposed finish name).

**Economy (schema v9).**
- `economy/src/agentNames.ts`: `customAgentNameProblem`, `tidyAgentName`, `nameKey`.
- `config.ts`: `AGENT_RENAME_PACK_POINTS = 100` (proposal).
- `agent_names` (append-only log; kinds legacy / generated / custom / rename / forced), the
  case-insensitive unique index on `agents.name`, reserved old names, renames only through a
  logged entry.
- Store: `confirmAgentDraft(..., { name })`, `agentNameProblem`, `renameAgent`,
  `forceRenameAgent`, `agentNames` (current, formerly, history). `takenNames` includes past names.

## Evidence committed

- `progress/economy-demo-007.txt` (`npx tsx src/dev/agentNamingDemo.ts` in economy/): naming,
  every refusal, the paid rename, "formerly" in match history, the force-rename, reopen, raw-SQL
  refusals. Reproduces exactly.
- `progress/signature-names-sample-003.txt` (`npx tsx src/dev/signatureNameSamples.ts` in engine/).
- Tests:
  - economy: `agentNames.test.ts` (8), and the v8 -> v9 migration step;
  - engine: the agent-name tests rewritten (5).
- `npm test`: 641 across six workspaces, all pass (engine 211, protocol 7, server 23, agents 17,
  economy 80, render 303). `tsc --noEmit` is clean in all six.

## Concrete next step

Check the alternation first. The last merged PR before this one (#58) was render, so this session
was game lane, and the next session is **render**. Render can show "formerly ..." from
`agentNames`, and the longer (up to 32-character) agent names need to fit the board.

The next **game-lane** session reads the owner's answer to the check-in. With no answer (option A):
1. **The chase-card proposal** (chase entry items 1-4), measured, NOT live: the secret-card list
   (30-40 illustration versions + 3 Zero-Day slots, placeholder art slots), Glitch rules and rate,
   and `S0-odds-2` (shine slot pointed at chosen cards, Zero-Day ~1 in 500). Extend
   `economy/src/packs.ts` and `src/dev/packSimulation.ts`; report the median packs to complete the
   base set and the full set, the share of packs with Full Art or better (target ~20%), Jackpot
   1 in 2,000 and the pity timers. Update ECONOMY.md; raise it as a check-in.
2. Then the engine's generic "choose one" mechanic, then the 3 Zero-Day cards, then the
   deck-building agent and play styles.
