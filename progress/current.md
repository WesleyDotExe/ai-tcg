# Current status

**Build-order stage: Stage 4+ (the living system). Session 60 (game lane): a hardening pass, plus the
one owner-approved change, set A shipped (Null's list and starter 36 -> 40). Nothing is blocking.** One
[OWNER CHECK-IN] in notes-for-owner.md: the results of shipping A (no decision needed; three small calls
listed to overrule if wanted).

- **Set A:** `NULL_CARDS` is 40 (+1 Fork Bomb, +1 Segfault Handler, +2 Rollback Point). Before
  re-baselining, `npm run ring` failed on exactly the predicted edge (gate Swarm > Null 57.1 IN BAND ->
  54.3 UNRESOLVED); both baselines re-recorded, `ring`/`ring:real` PASS. The built-deck ring on the
  shipped list (`progress/built-deck-ring-003.txt`) is byte-identical to session 59's candidate-A run.
- **Evidence:** `progress/balance-report-036-null-forty-shipped.txt`, `progress/null-forty-ship/`,
  `progress/built-deck-ring-003/`, `progress/full-seed-swing/`.

## What stands (this session's work; sessions 1-59 otherwise unchanged)

- **Hardening, raised:**
  - `store.setPlayStyle(ownerId, agentId, style)` checks ownership in the store (was the owner API's
    check only). Test + mutation check.
  - `workerChooser({ maxWorkers })`: at most every core but one build at once, the rest queued first come
    first served; `running`/`queued` counts; `terminateAll` drops the waiting ones. 2 tests + mutation
    check. OWNER_API.md says so.
  - The full-collection build noise measured: `builtDeckRing.ts build --search-seed N`; 4 seeds swing a
    faction's mean 4-6 points and one edge up to 8.7 (`progress/full-seed-swing/report.txt`).
  - `nullFortySearch.ts` measures from the 36 (`base36()` = shipped minus `SET_A`), so balance report 035
    stays reproducible; a test pins that 36 + A is the shipped list.
- **Fallout fixed:** render tests that replay Null matches (a token oracle in boardCost, two coverage
  seeds in sigWardFx, the ward replay seed 8 -> 1, the recorded close-win seed 5 -> 3); six committed Null
  replays and two recorded scenarios regenerated; `progress/built-deck-ring/collections.json` regenerated.
- `npm test`: all six workspaces pass (engine 327, economy 156, render 659). Typecheck clean.

## Concrete next step

Check the alternation first: if the last merged PR is this one (game lane), the next session is
**render**.

The next **game-lane** session (session 61): **the balance session's job 2, test only.** The two old
edges, Null > Aegis (inverted: Aegis wins ~54%) and Cortex > Swarm (under its 55-60 band in real mode).
1. Generalise `progress/null-forty/run-candidate.sh` to patch any faction's list (today it patches only
   `NULL_CARDS`), keeping its stop-check (the economy must see the patched list).
2. One or two candidate card fixes per edge (look at balance reports 030-032 for the known causes:
   Aegis's spare late energy, its signature gain). Measure each on the ring (both modes, ring seeds and a
   fresh block) and on the built-deck ring at every level.
3. Read the full-collection column as one draw (+-3 points, report 036 section 4); if a decision hangs
   on it, build at 2-3 search seeds and average.
4. Results to an owner check-in; no card change without the owner's OK.

Still open from the hardening list: re-run economy-demo-014/016 (the economy demos before option B and
set A).

**Blocked:** nothing.
