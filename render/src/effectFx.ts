// EFFECTS.md v2 slice 2: which card's ability did what to which card, for
// one move, so the page can fly each spell / heal / buff / debuff / removal
// from its exact source to its exact target in the source faction's material.
//
// Before game session 27 the event log named cards by NAME only, so the
// render could not pair an effect with its source and target (two Orphaned
// Threads look the same by name). The engine's events now carry instance ids
// (engine/src/state/types.ts, the GameEvent doc comment), and this module
// reads only those ids. It never guesses a pairing from a name.
//
// How an effect is told apart from combat damage: every ability resolution
// begins with an `abilityTrigger` event that carries its sourceId (a unit or
// Directive id, a Command's stack id, or a dead unit's old id for onDeath)
// and the targets it resolved against. The effect events that follow it
// carry the same sourceId. Combat damage carries the attacker's id too, but
// it is never preceded by an abilityTrigger with that id (it follows a
// `stackResolve` of the attack), so the context below is cleared on every
// non-effect event and combat damage is never read as a spell.
//
// Categories (EFFECTS.md axis 1; the meaning, never changed by faction):
//   spell   - damage from an ability or Command (to a unit or a player)
//   heal    - health restored
//   buff    - +attack/+health, or a Barrier (a protective status)
//   debuff  - -attack/-health, or Stasis / Overload
//   removal - a unit the ability targeted died with no damage dealt to it
//             this move (an unconditional destroy), or a Directive destroyed
//
// Events with no sourceId (Overload's end-of-turn tick) are left alone: the
// DOM pass still shows the number on the right card, and there is nothing
// to fly.
//
// Same single-source pattern as attackFx.ts / castFx.ts: EFFECT_FX_SOURCE is
// embedded verbatim in the page AND evaluated here for Node and the tests.
import type { PlayerId } from "@ai-tcg/engine";
import type { Frame } from "./types.js";

export type EffectCategory = "spell" | "heal" | "buff" | "debuff" | "removal";
export type EffectEnd = { kind: "unit"; instanceId: string } | { kind: "player"; playerId: PlayerId } | { kind: "stack"; stackId: string; owner: PlayerId };

export interface EffectFx {
  category: EffectCategory;
  /** Where it leaves from. A unit (live or, for onDeath, where it stood), or
   * a Command's stack entry. */
  source: EffectEnd;
  target: EffectEnd;
  /** Same card instance on both ends (Diagnostic Loop healing itself): no
   * travel, the effect plays in place. */
  self: boolean;
  sourceName: string;
  ability: string;
  /** Damage dealt / health restored / |attack|+|health| shifted. 0 for a
   * status or a removal. */
  amount: number;
  /** For a status: its kind. */
  status?: string;
}

export const EFFECT_FX_SOURCE = String.raw`
  var EFFECT_PROTECTIVE_STATUSES = { Barrier: true };
  var EFFECT_CONTEXT_ENDERS = { attack: 1, cast: 1, stackResolve: 1, play: 1, turnStart: 1, turnEnd: 1, draw: 1, fatigue: 1, priorityPass: 1, gameOver: 1 };

  function effectEndOf(ref, owner) {
    if (!ref) return null;
    if (ref.kind === 'player') return { kind: 'player', playerId: ref.playerId };
    if (ref.kind === 'unit' || ref.kind === 'directive') return { kind: 'unit', instanceId: ref.instanceId };
    return null;
  }
  // A Command's id is its stack id ('c..'); everything else is a board id.
  function effectSourceEnd(sourceId, prevFrame, newFrame) {
    if (!sourceId) return null;
    var owner = null;
    [prevFrame, newFrame].forEach(function (f) {
      f.stack.forEach(function (s) { if (s.stackId === sourceId) owner = s.controller; });
    });
    if (owner) return { kind: 'stack', stackId: sourceId, owner: owner };
    return { kind: 'unit', instanceId: sourceId };
  }
  function effectSameEnd(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === 'unit') return a.instanceId === b.instanceId;
    if (a.kind === 'player') return a.playerId === b.playerId;
    return a.stackId === b.stackId;
  }

  function resolveEffects(prevFrame, newFrame) {
    var events = newFrame.newEvents.map(function (e) { return e.event; });
    var out = [], byKey = {};
    var ctx = null, contexts = [];
    var damagedUnits = {};
    events.forEach(function (ev) {
      if (ev.type === 'damage' && ev.targetRef && ev.targetRef.kind === 'unit') damagedUnits[ev.targetRef.instanceId] = true;
    });
    function push(category, sourceId, target, amount, extra) {
      if (!ctx || !sourceId || sourceId !== ctx.sourceId || !target) return;
      var source = effectSourceEnd(sourceId, prevFrame, newFrame);
      if (!source) return;
      // One travel per (category, source, target): a buff that is both
      // +attack and a status, or two hits from one ability, is one flight.
      var key = category + '|' + JSON.stringify(source) + '|' + JSON.stringify(target);
      if (byKey[key]) { byKey[key].amount += amount; return; }
      var fx = { category: category, source: source, target: target, self: effectSameEnd(source, target), sourceName: ctx.source, ability: ctx.ability, amount: amount };
      if (extra) for (var k in extra) fx[k] = extra[k];
      byKey[key] = fx;
      out.push(fx);
    }
    events.forEach(function (ev) {
      if (ev.type === 'abilityTrigger') {
        ctx = { sourceId: ev.sourceId, source: ev.source, ability: ev.ability, targets: ev.targets || [] };
        if (ev.sourceId) contexts.push(ctx);
        return;
      }
      if (EFFECT_CONTEXT_ENDERS[ev.type]) { ctx = null; return; }
      if (ev.type === 'damage') push('spell', ev.sourceId, effectEndOf(ev.targetRef), ev.amount);
      else if (ev.type === 'heal') push('heal', ev.sourceId, effectEndOf(ev.targetRef), ev.amount);
      else if (ev.type === 'buff') {
        var net = ev.attack + ev.health;
        var down = net < 0 || (net === 0 && ev.attack < 0);
        push(down ? 'debuff' : 'buff', ev.sourceId, ev.targetId ? { kind: 'unit', instanceId: ev.targetId } : null, Math.abs(ev.attack) + Math.abs(ev.health));
      } else if (ev.type === 'statusApplied') {
        push(EFFECT_PROTECTIVE_STATUSES[ev.status] ? 'buff' : 'debuff', ev.sourceId, ev.targetId ? { kind: 'unit', instanceId: ev.targetId } : null, 0, { status: ev.status });
      } else if (ev.type === 'directiveDestroyed') {
        push('removal', ev.sourceId, ev.instanceId ? { kind: 'unit', instanceId: ev.instanceId } : null, 0);
      }
    });
    // Removal: a unit that died this move without taking damage, and that an
    // ability resolved against. (Its death event can land after a later
    // trigger in the same resolution, so this looks across the whole move.)
    events.forEach(function (ev) {
      if (ev.type !== 'death' || !ev.instanceId || damagedUnits[ev.instanceId]) return;
      for (var i = contexts.length - 1; i >= 0; i--) {
        var c = contexts[i];
        var hit = c.targets.some(function (t) { return t.kind === 'unit' && t.instanceId === ev.instanceId; });
        if (!hit || c.sourceId === ev.instanceId) continue;
        ctx = c;
        push('removal', c.sourceId, { kind: 'unit', instanceId: ev.instanceId }, 0);
        ctx = null;
        break;
      }
    });
    return out;
  }
`;

const impl = new Function(`${EFFECT_FX_SOURCE}; return { resolveEffects: resolveEffects };`)() as {
  resolveEffects: (prev: Frame, next: Frame) => EffectFx[];
};

/** Every ability effect one move produced, with its exact source and target,
 * in event order (removals last). */
export function resolveEffects(prev: Frame, next: Frame): EffectFx[] {
  return impl.resolveEffects(prev, next);
}
