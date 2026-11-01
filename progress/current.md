# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 63 (game lane): the small endpoints the
website waits on, and Null Out's text. Nothing is blocking; no owner decision is open.**

- **Who am I, account settings, the wallet** (owner 2026-11-01, "before match running"): `GET /api/me`,
  `GET`/`PATCH /api/account/settings`, `GET /api/wallet`, in `server/OWNER_API.md`. Settings are schema v15
  (`account_settings`, one row per owner, CHECKs on every column); the rule (`economy/src/accountSettings.ts`,
  `accountSettingsProblem`) is checked by the API (400) and again by the store before it writes.
- **Null Out and Deprecated Routine** read "... permanently (it can't take health below 1)." Text only:
  `npm run ring` PASS, every number +0.0. Five render replays regenerated (text only).
- **Evidence:** `progress/owner-api-demo-003-account.txt` (real file, real port, a server restart in the middle).

## What stands (this session's work; sessions 1-62 otherwise unchanged)

- `economy/src/accountSettings.ts`; store `whoAmI`, `accountSettings`, `updateAccountSettings`, `wallet`;
  migration 15. Tests: `economy/test/accountSettings.test.ts` (7), `server/test/ownerApiAccount.test.ts` (6);
  mutation-checked (dropping the API's 400 check, merging audio from the defaults, a constant isAdmin: each fails).
- `server/src/dev/accountApiDemo.ts` writes the demo.
- `npm test`: all six workspaces pass (engine 349, protocol 7, server 44, agents 17, economy 163, render 696).
  Typecheck clean in all six.

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #108, was the render lane's). If this
PR is the last merged, the next session is **render** (Season 0 render item 2, the look; it can now save the
theme, background and skip hint to the account and show the Admin entry and the wallet).

The next **game-lane** session (64): Season 0 game item 1, **match running and the ladder** (roadmap 6b).
A first slice: a server-side match runner that pairs connected agents (server-assigned opponents), plays the
match, records it through the store with each side's final health (the close-win boast), pays credits on the
daily win schedule (midnight Australia/Sydney), and calls `rebuildAgentDeckIfNeeded` between matches; then
Glicko-2 per owner. Read `economy/src/store.ts` (`startMatch` / `recordMatch`), `server/src/` and ECONOMY.md
first. Prove it with a run of many matches between house agents and a committed log. Session 65 is a hardening
pass (60 was the last); economy demos 014/016 are owed.

**Blocked:** nothing.
