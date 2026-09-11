import type { Side, TargetFilter, TargetSpec } from "../cards/types.js";
import type { GameState, PlayerId } from "../state/types.js";
import { otherPlayer } from "../state/types.js";
import type { Rng } from "../state/rng.js";

export type TargetRef =
  | { kind: "unit"; instanceId: string }
  | { kind: "player"; playerId: PlayerId };

export function sideToPlayerId(side: Exclude<Side, "any">, controller: PlayerId): PlayerId {
  return side === "controller" ? controller : otherPlayer(controller);
}

export function matchesSide(filter: TargetFilter, sourceController: PlayerId, playerId: PlayerId): boolean {
  if (filter.side === "any") return true;
  return sideToPlayerId(filter.side, sourceController) === playerId;
}

/** Every currently-legal target matching a filter, from `controller`'s point
 * of view. Used both for AOE resolution and for enumerating choices a
 * "chosen" target presents to the acting agent. */
export function enumerateTargets(filter: TargetFilter, controller: PlayerId, state: GameState): TargetRef[] {
  const refs: TargetRef[] = [];
  const sides: PlayerId[] = filter.side === "any" ? ["p1", "p2"] : [sideToPlayerId(filter.side, controller)];
  for (const pid of sides) {
    if (filter.kind === "unit" || filter.kind === "any") {
      for (const unit of state.players[pid].board) {
        refs.push({ kind: "unit", instanceId: unit.instanceId });
      }
    }
    if (filter.kind === "player" || filter.kind === "any") {
      refs.push({ kind: "player", playerId: pid });
    }
  }
  return refs;
}

export interface ResolveTargetsParams {
  spec: TargetSpec;
  controller: PlayerId;
  state: GameState;
  /** Required when spec.scope === "chosen": the target the acting agent
   * selected, already validated to be legal for this spec. */
  chosen?: TargetRef;
  /** Required when spec.scope === "self": the ability's own source unit. */
  selfRef?: TargetRef;
  rng: Rng;
}

export function resolveTargets(params: ResolveTargetsParams): TargetRef[] {
  const { spec, controller, state, chosen, selfRef, rng } = params;
  switch (spec.scope) {
    case "none":
      return [];
    case "self":
      if (!selfRef) throw new Error("targeting: 'self' scope requires a source unit");
      return [selfRef];
    case "chosen":
      if (!chosen) throw new Error("targeting: 'chosen' scope requires a selected target");
      return [chosen];
    case "all":
      return enumerateTargets(spec.filter, controller, state);
    case "random": {
      const pool = enumerateTargets(spec.filter, controller, state);
      const picked: TargetRef[] = [];
      for (let i = 0; i < spec.count && pool.length > 0; i++) {
        const idx = rng.int(pool.length);
        picked.push(pool.splice(idx, 1)[0]!);
      }
      return picked;
    }
  }
}
