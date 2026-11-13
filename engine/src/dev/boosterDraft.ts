// The Season 0 booster cards, for the proposal check (dev/boosterProposal.ts).
//
// Session 96 wrote the 28 cards here as draft data, for the owner's
// [OWNER CHECK-IN] (progress/booster-proposal-s0.md). The owner approved the
// list as proposed (2026-11-14, "keep all 8 as recommended"), and session 97
// moved the cards into the faction files and the registry
// (data/registry.ts S0_BOOSTER_CARDS), unchanged: a check that session ran
// found all 28 definitions identical, field for field, to this file's draft.
// So the draft is gone and this file now names the registered cards, so the
// proposal check (and the balance re-run built on it) measures exactly the
// cards that ship, never a copy that could drift.

import { S0_BOOSTER_CARDS } from "../data/registry.js";

export const CORTEX_BOOSTER = S0_BOOSTER_CARDS.Cortex;
export const SWARM_BOOSTER = S0_BOOSTER_CARDS.Swarm;
export const AEGIS_BOOSTER = S0_BOOSTER_CARDS.Aegis;
export const NULL_BOOSTER = S0_BOOSTER_CARDS.Null;

export const BOOSTER_DRAFT = S0_BOOSTER_CARDS;
