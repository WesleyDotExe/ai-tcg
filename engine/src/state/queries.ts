import type { GameState, PlayerId, UnitInstance, DirectiveInstance } from "./types.js";
import type { Keyword } from "../cards/types.js";
import { staticModifiersFor } from "../effects/statics.js";

export function findUnit(state: GameState, instanceId: string): { unit: UnitInstance; owner: PlayerId } | undefined {
  for (const pid of ["p1", "p2"] as const) {
    const unit = state.players[pid].board.find((u) => u.instanceId === instanceId);
    if (unit) return { unit, owner: pid };
  }
  return undefined;
}

export function allUnits(state: GameState): UnitInstance[] {
  return [...state.players.p1.board, ...state.players.p2.board];
}

export function allDirectives(state: GameState): DirectiveInstance[] {
  return [...state.players.p1.directives, ...state.players.p2.directives];
}

function toolAttackBonus(unit: UnitInstance): number {
  return unit.tools.reduce((sum, t) => sum + t.attackBonus, 0);
}

function toolHealthBonus(unit: UnitInstance): number {
  return unit.tools.reduce((sum, t) => sum + t.healthBonus, 0);
}

export function currentAttack(state: GameState, unit: UnitInstance): number {
  const mod = staticModifiersFor(state, unit);
  if (mod.attackOverride !== undefined) return Math.max(0, mod.attackOverride);
  const base = unit.card.attack + toolAttackBonus(unit) + unit.permanentBuff.attack + unit.turnBuff.attack;
  return Math.max(0, base + mod.attack);
}

export function currentMaxHealth(state: GameState, unit: UnitInstance): number {
  const mod = staticModifiersFor(state, unit);
  if (mod.healthOverride !== undefined) return Math.max(1, mod.healthOverride);
  const base = unit.card.health + toolHealthBonus(unit) + unit.permanentBuff.health + unit.turnBuff.health;
  return Math.max(1, base + mod.health);
}

export function currentHealth(state: GameState, unit: UnitInstance): number {
  return currentMaxHealth(state, unit) - unit.damageTaken;
}

export function isAlive(state: GameState, unit: UnitInstance): boolean {
  return currentHealth(state, unit) > 0;
}

/** A unit has a keyword either printed on its card or granted by an
 * attached Tool (see ToolCard.grantedKeywords) — callers should use this
 * rather than reading `unit.card.keywords` directly so tool-granted
 * keywords (e.g. a Tool that grants Guard) are honoured everywhere a
 * keyword check happens. */
export function hasKeyword(unit: UnitInstance, keyword: Keyword): boolean {
  return unit.card.keywords.includes(keyword) || unit.tools.some((t) => t.grantedKeywords.includes(keyword));
}
