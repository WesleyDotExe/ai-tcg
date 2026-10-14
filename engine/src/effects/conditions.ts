import type { Condition } from "../cards/types.js";
import type { GameState, PlayerId } from "../state/types.js";
import { allDirectives, activeGuards } from "../state/queries.js";
import { sideToPlayerId } from "./targeting.js";

export function evaluateCondition(condition: Condition, state: GameState, controller: PlayerId): boolean {
  switch (condition.kind) {
    case "always":
      return true;
    case "not":
      return !evaluateCondition(condition.condition, state, controller);
    case "all":
      return condition.conditions.every((c) => evaluateCondition(c, state, controller));
    case "any":
      return condition.conditions.some((c) => evaluateCondition(c, state, controller));
    case "healthAtMost": {
      const pid = sideToPlayerId(condition.side, controller);
      return state.players[pid].health <= condition.threshold;
    }
    case "healthAtLeast": {
      const pid = sideToPlayerId(condition.side, controller);
      return state.players[pid].health >= condition.threshold;
    }
    case "unitsInPlayAtLeast": {
      const pid = sideToPlayerId(condition.side, controller);
      return state.players[pid].board.length >= condition.count;
    }
    case "handSizeAtLeast": {
      const pid = sideToPlayerId(condition.side, controller);
      return state.players[pid].hand.length >= condition.count;
    }
    case "controllerFactionInPlay": {
      const player = state.players[controller];
      const inBoard = player.board.some((u) => u.card.faction === condition.faction);
      const inDirectives = allDirectives(state).some(
        (d) => d.controller === controller && d.card.faction === condition.faction,
      );
      return inBoard || inDirectives;
    }
    case "guardInPlay":
      return activeGuards(state, sideToPlayerId(condition.side, controller)).length > 0;
    case "attackTargets": {
      const attack = [...state.stack].reverse().find((item) => item.kind === "combatDamage");
      return attack?.kind === "combatDamage" && attack.target.kind === condition.target;
    }
  }
}
