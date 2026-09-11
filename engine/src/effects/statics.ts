import { resolveAmount } from "../cards/types.js";
import type { Ability } from "../cards/types.js";
import type { GameState, PlayerId, UnitInstance } from "../state/types.js";
import { matchesSide } from "./targeting.js";
import { buildScalingContext } from "./scaling.js";

interface StaticSource {
  controller: PlayerId;
  instanceId?: string;
  abilities: Ability[];
}

export interface StaticModifiers {
  attack: number;
  health: number;
  attackOverride?: number;
  healthOverride?: number;
}

/** Aggregates every currently-in-play "static" ability that applies to
 * `unit`, from both players' boards/directives. Called on demand (not
 * cached) so stats are always derived fresh from live state — there is no
 * separate "recompute" pass to forget to call. */
export function staticModifiersFor(state: GameState, unit: UnitInstance): StaticModifiers {
  const mods: StaticModifiers = { attack: 0, health: 0 };

  for (const pid of ["p1", "p2"] as const) {
    const player = state.players[pid];
    const sources: StaticSource[] = [
      ...player.board.map((u): StaticSource => ({ controller: pid, instanceId: u.instanceId, abilities: u.card.abilities })),
      ...player.directives.map((d): StaticSource => ({ controller: pid, abilities: d.card.abilities })),
    ];

    for (const src of sources) {
      for (const ability of src.abilities) {
        if (ability.trigger !== "static" || !ability.staticEffect) continue;
        const se = ability.staticEffect;
        if (se.kind === "buffAllies") {
          if (matchesSide(se.filter, src.controller, unit.controller)) {
            mods.attack += se.attack;
            mods.health += se.health;
          }
        } else if (se.kind === "selfStatFromScaling") {
          if (src.instanceId === unit.instanceId) {
            const ctx = buildScalingContext(state, src.controller);
            if (se.attack) mods.attackOverride = resolveAmount(se.attack, ctx);
            if (se.health) mods.healthOverride = resolveAmount(se.health, ctx);
          }
        }
      }
    }
  }

  return mods;
}
