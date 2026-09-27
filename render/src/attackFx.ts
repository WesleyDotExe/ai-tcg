// EFFECTS.md slice 4 — attack travel + impact, plus the card-movement half
// of the owner's 2026-09-26 taste call 4 (a Command flies onto the stack).
//
// This module answers, for one move (a prevFrame -> newFrame pair), "what
// just happened on the stack that needs something to MOVE across the
// screen?" renderHtml.ts's inline JS does the DOM half (the aim line, the
// bolt, the impact, the flying card).
//
// Everything here is instance-exact. The engine's `attack` event names the
// attacker and defender by card NAME, which collides in a mirror match, but
// every pending attack is also a combatDamage stack item that carries the
// exact attackerInstanceId and target (captured read-only into
// StackItemSnapshot). And the engine's stack only ever loses an item by
// resolving it (engine.ts resolveTopOfStack is the one pop), so following an
// item by its stackId from frame to frame tells us exactly when an attack
// was declared, retargeted, and struck, with no inference from event text.
//
// Phases, per move:
//   declare  -> a combatDamage item appeared: the attacker commits. The page
//               draws the aim line (it then persists while the item waits
//               on the stack, i.e. through the whole response window).
//   redirect -> the same item's target changed (Aegis's Intercept Routine).
//   strike   -> the item left the stack: it resolved. `outcome` says whether
//               damage actually flew (`hit`), or the attack fizzled because
//               the attacker or its unit target was already gone — the
//               engine's own two fizzle rules (engine.ts
//               resolveCombatDamage), checked against the board BEFORE this
//               move, since the damage resolves against that board.
//   command  -> a Command item appeared: the card flies from its caster's
//               hand onto the stack.
//
// `power` is the attacker's attack on the board the strike resolved
// against; the page turns it into a magnitude tier with the same hitScore /
// playerHitScore it already uses for the damage itself, so the bolt and the
// hit it causes can never disagree about how big the moment is.
// `counter` is whether the defender strikes back (a unit target with
// attack > 0), which the page draws as a smaller return bolt.
//
// Same single-source pattern as castFx.ts: ATTACK_FX_SOURCE is embedded in
// the page verbatim AND evaluated here for Node callers and tests, so the
// two can never drift.
import type { PlayerId } from "@ai-tcg/engine";
import type { AttackTargetSnapshot, Frame } from "./types.js";

export type AttackPhase = "declare" | "redirect" | "strike" | "command";

export interface AttackFx {
  phase: AttackPhase;
  stackId: string;
  owner: PlayerId;
  /** declare/redirect/strike only. */
  attackerIid?: string;
  attackerName?: string;
  target?: AttackTargetSnapshot;
  /** redirect only: where the attack was aimed before. */
  from?: AttackTargetSnapshot;
  /** strike only. */
  outcome?: "hit" | "fizzle-attacker" | "fizzle-target";
  power?: number;
  counter?: boolean;
  counterPower?: number;
  /** command only: the Command's card name. */
  card?: string;
}

export const ATTACK_FX_SOURCE = `
  function attackUnitIndex(frame) {
    var out = {};
    ['p1', 'p2'].forEach(function (pid) {
      frame.players[pid].board.forEach(function (u) { out[u.instanceId] = { owner: pid, v: u }; });
    });
    return out;
  }
  function sameAttackTarget(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    return a.kind === 'unit' ? a.instanceId === b.instanceId : a.playerId === b.playerId;
  }

  function resolveAttacks(prevFrame, newFrame) {
    var prevById = {}, newById = {};
    prevFrame.stack.forEach(function (s) { prevById[s.stackId] = s; });
    newFrame.stack.forEach(function (s) { newById[s.stackId] = s; });
    var prevUnits = attackUnitIndex(prevFrame);
    var out = [];

    // Leaving first: at most one item resolves per move, and it resolves
    // before anything the same move might push.
    prevFrame.stack.forEach(function (s) {
      if (newById[s.stackId] || s.kind !== 'combatDamage') return;
      var fx = { phase: 'strike', stackId: s.stackId, owner: s.controller, attackerIid: s.attackerInstanceId, attackerName: s.description.replace(/'s attack$/, ''), target: s.target };
      var atk = prevUnits[s.attackerInstanceId];
      if (!atk) { fx.outcome = 'fizzle-attacker'; out.push(fx); return; }
      fx.power = atk.v.attack;
      if (s.target.kind === 'unit') {
        var def = prevUnits[s.target.instanceId];
        if (!def) { fx.outcome = 'fizzle-target'; out.push(fx); return; }
        fx.counterPower = def.v.attack;
        fx.counter = def.v.attack > 0;
      } else {
        fx.counter = false;
      }
      fx.outcome = 'hit';
      out.push(fx);
    });

    newFrame.stack.forEach(function (s) {
      var before = prevById[s.stackId];
      if (s.kind === 'combatDamage') {
        if (!before) out.push({ phase: 'declare', stackId: s.stackId, owner: s.controller, attackerIid: s.attackerInstanceId, attackerName: s.description.replace(/'s attack$/, ''), target: s.target });
        else if (!sameAttackTarget(before.target, s.target)) out.push({ phase: 'redirect', stackId: s.stackId, owner: s.controller, attackerIid: s.attackerInstanceId, attackerName: s.description.replace(/'s attack$/, ''), target: s.target, from: before.target });
      } else if (s.kind === 'command' && !before) {
        out.push({ phase: 'command', stackId: s.stackId, owner: s.controller, card: s.description });
      }
    });
    return out;
  }

  // Every attack still waiting on the stack in this frame — what the page
  // draws as persistent aim lines, so a viewer sees what the response window
  // is responding TO.
  function pendingAttacks(frame) {
    return frame.stack.filter(function (s) { return s.kind === 'combatDamage'; }).map(function (s) {
      return { stackId: s.stackId, owner: s.controller, attackerIid: s.attackerInstanceId, target: s.target };
    });
  }
`;

const impl = new Function(`${ATTACK_FX_SOURCE}; return { resolveAttacks: resolveAttacks, pendingAttacks: pendingAttacks };`)() as {
  resolveAttacks: (prev: Frame, next: Frame) => AttackFx[];
  pendingAttacks: (frame: Frame) => { stackId: string; owner: PlayerId; attackerIid: string; target: AttackTargetSnapshot }[];
};

/** Every stack movement one move should show: strikes first, then new
 * declarations / redirects / Commands in stack order. */
export function resolveAttacks(prev: Frame, next: Frame): AttackFx[] {
  return impl.resolveAttacks(prev, next);
}

export const pendingAttacks = impl.pendingAttacks;
