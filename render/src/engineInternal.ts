// A handful of engine exports the render lane needs that @ai-tcg/engine's
// public barrel (engine/src/index.ts) doesn't (yet) carry: buildNullDeck,
// the third reference agent (LookaheadAgent), and the derived-stat query
// helpers (currentAttack/currentHealth/... — needed to render a unit's
// *live* stats, since tools/static auras/permanent buffs mean the printed
// card.attack/health are frequently wrong to display directly).
//
// RENDER.md's guardrails forbid ever *modifying* an engine file (including
// index.ts) from this lane — so rather than widen the public barrel
// ourselves, this file deep-imports the same engine source files the barrel
// itself imports from, read-only, exactly the way engine/src/index.ts does
// internally. Nothing here changes engine behaviour; it only re-exposes
// existing engine code to this package. See progress/render/notes-for-owner.md
// for the (harmless) note that these should probably join the public barrel
// someday — that's an engine-side change, out of scope for this lane.
export { buildNullDeck } from "../../engine/src/data/decks.js";
export { LookaheadAgent } from "../../engine/src/agents/lookaheadAgent.js";
export {
  currentAttack,
  currentHealth,
  currentMaxHealth,
  boardSlotsUsed,
  hasKeyword,
  effectiveCardCost,
} from "../../engine/src/state/queries.js";
// Faction/Rarity/CardType/Keyword are likewise defined but not re-exported
// by the public barrel — type-only, so re-exporting them here can never
// affect engine runtime behaviour.
export type { Faction, Rarity, CardType, Keyword } from "../../engine/src/cards/types.js";
