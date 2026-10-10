import type { Move, PlayerView, StackItem, TargetRef, UnitInstance } from "@ai-tcg/protocol";

/** Ported from the engine's in-process `AggressiveAgent`: a greedy
 * face-damage heuristic (dump the biggest affordable card, swing everything
 * at the opponent's life total unless Guard forces a trade) plus one
 * genuine reactive rule — outside its own main phase, if a pending combat
 * hit would kill one of its units, prefer an instant that saves it. No
 * lookahead, no opponent modelling; it exists to exercise the protocol with
 * a decision policy that isn't pure random. Operates on `PlayerView` and
 * `Move[]` only — exactly what a real remote agent receives over the wire,
 * nothing more. */
export function aggressiveDecision(view: PlayerView, legalMoves: Move[]): Move {
  const mainPhase = view.self === view.activePlayer && view.stack.length === 0;

  if (!mainPhase) {
    return pickReactiveResponse(view, legalMoves) ?? { type: "passPriority" };
  }

  const playMoves = legalMoves.filter((m): m is PlayMove => m.type === "playCard" || m.type === "playSignature");
  if (playMoves.length > 0) return pickBiggestCard(view, playMoves);

  const attackMoves = legalMoves.filter((m): m is Extract<Move, { type: "attack" }> => m.type === "attack");
  if (attackMoves.length > 0) return pickBestAttack(view, attackMoves);

  const abilityMoves = legalMoves.filter((m): m is Extract<Move, { type: "activateAbility" }> => m.type === "activateAbility");
  if (abilityMoves.length > 0) return abilityMoves[0]!;

  return { type: "passPriority" };
}

function pickReactiveResponse(view: PlayerView, legalMoves: Move[]): Move | undefined {
  const threat = findLethalCombatThreat(view);
  if (threat) {
    const save = legalMoves.find(
      (m) =>
        (m.type === "playCard" || m.type === "activateAbility") &&
        (targetsRef(m, threat.target) || targetsRef(m, { kind: "unit", instanceId: threat.attackerInstanceId })),
    );
    if (save) return save;
  }

  const playMoves = legalMoves.filter((m): m is Extract<Move, { type: "playCard" }> => m.type === "playCard");
  if (playMoves.length > 0) return pickBiggestCard(view, playMoves);

  const abilityMoves = legalMoves.filter((m): m is Extract<Move, { type: "activateAbility" }> => m.type === "activateAbility");
  if (abilityMoves.length > 0) return abilityMoves[0]!;

  return undefined;
}

function findLethalCombatThreat(view: PlayerView): Extract<StackItem, { kind: "combatDamage" }> | undefined {
  for (const item of view.stack) {
    if (item.kind !== "combatDamage") continue;
    const target = item.target;
    if (target.kind !== "unit") continue;
    const myUnit = view.me.board.find((u) => u.instanceId === target.instanceId);
    if (!myUnit) continue;
    const attacker =
      view.me.board.find((u) => u.instanceId === item.attackerInstanceId) ??
      view.opponent.board.find((u) => u.instanceId === item.attackerInstanceId);
    if (!attacker) continue;
    if (approximateAttack(attacker) >= approximateHealth(myUnit)) return item;
  }
  return undefined;
}

function targetsRef(move: Extract<Move, { type: "playCard" | "activateAbility" }>, ref: TargetRef): boolean {
  const target = move.target;
  if (!target) return false;
  if (target.kind === "unit" && ref.kind === "unit") return target.instanceId === ref.instanceId;
  if (target.kind === "player" && ref.kind === "player") return target.playerId === ref.playerId;
  return false;
}

function pickBiggestCard(view: PlayerView, moves: PlayMove[]): Move {
  let best = moves[0]!;
  let bestCost = -1;
  for (const move of moves) {
    const cost = playCost(view, move);
    const targetsFace = move.target?.kind === "player";
    const bestTargetsFace = best.target?.kind === "player";
    if (cost > bestCost || (cost === bestCost && targetsFace && !bestTargetsFace)) {
      best = move;
      bestCost = cost;
    }
  }
  return best;
}

function pickBestAttack(view: PlayerView, moves: Extract<Move, { type: "attack" }>[]): Move {
  const faceAttack = moves.find((m) => m.target.kind === "player");
  if (faceAttack) return faceAttack;

  const opponentBoard = view.opponent.board;
  let best = moves[0]!;
  let bestHealth = Number.POSITIVE_INFINITY;
  for (const move of moves) {
    if (move.target.kind !== "unit") continue;
    const targetId = move.target.instanceId;
    const unit = opponentBoard.find((u) => u.instanceId === targetId);
    const health = unit ? approximateHealth(unit) : Number.POSITIVE_INFINITY;
    if (health < bestHealth) {
      bestHealth = health;
      best = move;
    }
  }
  return best;
}

function approximateHealth(unit: UnitInstance): number {
  const maxHealth = unit.card.health + unit.permanentBuff.health + unit.turnBuff.health;
  return maxHealth - unit.damageTaken;
}

function approximateAttack(unit: UnitInstance): number {
  return unit.card.attack + unit.permanentBuff.attack + unit.turnBuff.attack;
}

/** A card play from the hand or from the signature zone. */
type PlayMove = Extract<Move, { type: "playCard" | "playSignature" }>;

/** What a play costs, by printed cost: the hand card's, or the signature
 * card's plus 2 for each earlier play this match (the engine's replay
 * surcharge, read from the public signature zone). */
function playCost(view: PlayerView, move: PlayMove): number {
  if (move.type === "playCard") return view.me.hand[move.handIndex]?.cost ?? 0;
  const zone = view.me.signature;
  return zone ? zone.card.cost + 2 * zone.timesPlayed : 0;
}
