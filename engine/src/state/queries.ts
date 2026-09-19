import type { GameState, PlayerId, UnitInstance, DirectiveInstance } from "./types.js";
import { otherPlayer } from "./types.js";
import type { Ability, Card, Keyword } from "../cards/types.js";
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

/** The energy cost `pid` actually pays to play `card`, after every
 * currently-in-play "cardCostModifier" static aura from either player's
 * board/directives — a generic, reusable cost-modifier mechanism (positive
 * = taxed, negative = discounted), not tied to any one card. See Aegis's
 * Tariff Field (data/aegisCards.ts) for the first user: a taxing/blunting
 * aura on what the opponent commits, deliberately not removal. Clamped at 0
 * so a discount can never make a card pay you to play it. Callers (moves.ts's
 * legality check, engine.ts's energy deduction) must both go through this
 * rather than reading `card.cost` directly, or the two would disagree. */
export function effectiveCardCost(state: GameState, pid: PlayerId, card: Card): number {
  let modifier = 0;
  for (const owner of ["p1", "p2"] as const) {
    const player = state.players[owner];
    const sources: Ability[] = [
      ...player.board.filter((u) => !u.pending).flatMap((u) => u.card.abilities),
      ...player.directives.flatMap((d) => d.card.abilities),
    ];
    for (const ability of sources) {
      if (ability.trigger !== "static" || ability.staticEffect?.kind !== "cardCostModifier") continue;
      const se = ability.staticEffect;
      const applies = se.side === "any" || (se.side === "controller" ? owner === pid : otherPlayer(owner) === pid);
      if (applies) modifier += se.amount;
    }
  }
  return Math.max(0, card.cost + modifier);
}

/** A unit has a keyword either printed on its card or granted by an
 * attached Tool (see ToolCard.grantedKeywords) — callers should use this
 * rather than reading `unit.card.keywords` directly so tool-granted
 * keywords (e.g. a Tool that grants Guard) are honoured everywhere a
 * keyword check happens. */
export function hasKeyword(unit: UnitInstance, keyword: Keyword): boolean {
  return unit.card.keywords.includes(keyword) || unit.tools.some((t) => t.grantedKeywords.includes(keyword));
}
