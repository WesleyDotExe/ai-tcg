// EFFECTS.md slice 3 — power / ability cast flourish, `cast(source)`.
//
// This module answers "which card just used a power, and where on screen is
// it?" for one move (a prevFrame -> newFrame pair). renderHtml.ts's inline
// JS does the DOM half (sigil, rays, trigger tag).
//
// The engine's abilityTrigger event names its source by card NAME only (the
// instance-ID event-log work is still queued on the balance lane), so a name
// on its own is ambiguous whenever two copies share a board. Rather than
// guess, every trigger is narrowed by what else happened in the same move,
// all of which IS instance-exact:
//   onPlay       -> the `play` event's own instanceId, else the unit that
//                   evolved into this card, else the unit whose telegraph
//                   just armed;
//   onAttack     -> the unit that just spent its attack;
//   onDeath      -> a unit that left the board this move;
//   onDamaged    -> a unit that actually lost health (or died) this move;
//   onTurnStart/
//   onTurnEnd    -> units on the side whose turn is starting/ending (the
//                   engine only fires the turn owner's triggers);
//   activated    -> the exact source instance of the ability item that was
//                   on top of the stack before this move resolved it (the
//                   capture reads it off the engine's StackItem; the event
//                   log itself doesn't carry it);
//   a Command    -> not on the board at all; the flourish plays on the
//                   Command's own stack entry (render session 7: the card
//                   now flies from its caster's hand onto the stack, so the
//                   stack entry is where the viewer's eye already is),
//                   identified by the engine's stack-item id.
// If exactly one instance survives the narrowing, the flourish plays on that
// card. If several do, it is honestly ambiguous: the flourish becomes a
// banner (pinned to a side when every candidate is on the same side), never
// a guess at one specific card.
//
// Why a JS source string and not TypeScript + a hand mirror (the pattern
// statFx.ts / fxMagnitude.ts use): the page's <script> is unbundled, so any
// logic it runs must exist as JS text. Those two modules keep a TS original
// plus a hand-copied JS twin and a parity test to catch drift. This module
// is bigger than both, so instead there is ONE copy: CAST_FX_SOURCE is
// embedded in the page verbatim AND evaluated here for Node callers and
// tests. Drift is impossible by construction; the cost is no type-checking
// inside the string, which the tests in test/castFx.test.ts make up for.
import type { FxTier } from "./fxMagnitude.js";
import type { Faction, Rarity } from "./engineInternal.js";
import type { Frame } from "./types.js";

export type CastKind = "trigger" | "announce";

export interface CastFx {
  /** "announce" = a Command or activated ability was put on the stack
   * (the player committing to it); "trigger" = an ability actually fired. */
  kind: CastKind;
  /** Card name as the event log gives it. */
  source: string;
  /** Engine trigger kind, or "command" for a Command resolving, or "cast" /
   * "response" for an announce. */
  trigger: string;
  /** Short on-screen tag, e.g. "ON PLAY", "RESPONSE". */
  label: string;
  /** Where the flourish plays:
   * - card:   on one exact instance (iid), live or just-departed;
   * - stack:  on a Command's stack entry (`stackId`) — it has no card on
   *           board; `owner` is the caster, the fallback anchor when the
   *           entry can't be found on screen;
   * - banner: honestly ambiguous; shown as a banner, on `owner`'s side when
   *           every candidate is on one side, else centred. */
  anchor: "card" | "stack" | "banner";
  iid?: string;
  /** anchor "stack" only: the Command's engine stack-item id. */
  stackId?: string;
  owner?: "p1" | "p2";
  /** Whether the instance is gone in the new frame (so the DOM half must
   * use the previous frame's rectangle). */
  departed?: boolean;
  faction?: Faction;
  rarity: Rarity;
  tier: FxTier;
  /** How many instances the name matched before narrowing (diagnostics +
   * tests: >1 means the narrowing did real work). */
  candidates: number;
}

export const CAST_FX_SOURCE = `
  var CAST_LABELS = { onPlay: 'ON PLAY', onAttack: 'ON ATTACK', onDamaged: 'ON HIT', onDeath: 'ON DEATH', onTurnStart: 'TURN START', onTurnEnd: 'TURN END', onKill: 'ON KILL', onEnemyAttack: 'INTERCEPT', activated: 'ACTIVATE', command: 'RESOLVE', cast: 'CAST', response: 'RESPONSE' };
  var CAST_RARITY_BASE = { Common: 0.7, Uncommon: 1.1, Rare: 1.6, Mythic: 2.5 };
  var CAST_RECURRING = ['onTurnStart', 'onTurnEnd', 'onDamaged', 'onAttack'];

  // Magnitude (EFFECTS.md axis 3). The card's own rarity sets the base; a
  // deliberate choice (an activated ability, a Command) reads a little
  // louder; a trigger that recurs every turn or every hit reads quieter, so
  // a busy board of turn-end pings does not shout; an instant-speed response
  // on the opponent's turn is the reactive play the owner named as a core
  // pillar, so it is lifted to be seen.
  function castScore(rarity, trigger) {
    var s = CAST_RARITY_BASE[rarity] !== undefined ? CAST_RARITY_BASE[rarity] : 0.7;
    if (trigger === 'activated' || trigger === 'command' || trigger === 'cast') s += 0.4;
    if (trigger === 'response') s += 0.9;
    if (CAST_RECURRING.indexOf(trigger) !== -1) s -= 0.4;
    return s;
  }
  function castTier(score) { return score >= 2.4 ? 'spectacle' : score <= 0.9 ? 'subtle' : 'normal'; }

  function castEntries(frame) {
    var out = [];
    ['p1', 'p2'].forEach(function (pid) {
      frame.players[pid].board.forEach(function (u) { out.push({ iid: u.instanceId, owner: pid, v: u, unit: true }); });
      frame.players[pid].directives.forEach(function (d) { out.push({ iid: d.instanceId, owner: pid, v: d, unit: false }); });
    });
    return out;
  }

  function resolveCasts(prevFrame, newFrame, cardFactions, cardRarities) {
    var prevList = castEntries(prevFrame), newList = castEntries(newFrame);
    var prevById = {}, newById = {};
    prevList.forEach(function (e) { prevById[e.iid] = e; });
    newList.forEach(function (e) { newById[e.iid] = e; });
    // Every instance present before or after this move, newest view first.
    var all = newList.slice();
    prevList.forEach(function (e) { if (!newById[e.iid]) all.push(e); });
    var prevStackTop = prevFrame.stack.length ? prevFrame.stack[prevFrame.stack.length - 1] : null;
    var events = newFrame.newEvents.map(function (x) { return x.event; });
    var out = [];

    function rarityOf(name, entry) {
      if (entry) return entry.v.rarity;
      return cardRarities[name] || 'Common';
    }
    function push(kind, source, trigger, anchor, extra) {
      var entry = extra.entry;
      var rarity = rarityOf(source, entry);
      var fx = { kind: kind, source: source, trigger: trigger, label: CAST_LABELS[trigger] || trigger.toUpperCase(), anchor: anchor, faction: cardFactions[source], rarity: rarity, tier: castTier(castScore(rarity, trigger)), candidates: extra.candidates };
      if (entry) { fx.iid = entry.iid; fx.owner = entry.owner; fx.departed = !newById[entry.iid]; }
      else if (extra.owner) fx.owner = extra.owner;
      if (extra.stackId) fx.stackId = extra.stackId;
      out.push(fx);
    }
    function settle(kind, source, trigger, cands, total) {
      if (cands.length === 1) { push(kind, source, trigger, 'card', { entry: cands[0], candidates: total }); return; }
      var owners = {};
      cands.forEach(function (c) { owners[c.owner] = true; });
      var keys = Object.keys(owners);
      push(kind, source, trigger, 'banner', { owner: keys.length === 1 ? keys[0] : undefined, candidates: total });
    }
    function lastBefore(k, type) {
      for (var j = k - 1; j >= 0; j--) if (events[j].type === type) return events[j];
      return null;
    }

    events.forEach(function (ev, k) {
      if (ev.type === 'cast') {
        var sep = ev.card.indexOf(' \\u2014 ');
        var response = ev.speed === 'Instant' && ev.player !== newFrame.activePlayer;
        var trig = response ? 'response' : 'cast';
        if (sep === -1) {
          // A Command: it has no card on the board. It was just pushed, so
          // it is the top of the new stack.
          var cmdTop = newFrame.stack.length ? newFrame.stack[newFrame.stack.length - 1] : null;
          var cmdSid = cmdTop && cmdTop.kind === 'command' && cmdTop.description === ev.card ? cmdTop.stackId : undefined;
          push('announce', ev.card, trig, 'stack', { owner: ev.player, candidates: 0, stackId: cmdSid });
          return;
        }
        var srcName = ev.card.slice(0, sep);
        var own = all.filter(function (e) { return e.v.name === srcName && e.owner === ev.player; });
        // The ability item this cast just pushed (the top of the new stack)
        // names its exact source.
        var top = newFrame.stack.length ? newFrame.stack[newFrame.stack.length - 1] : null;
        var pushedIid = top && top.kind === 'ability' && top.description === ev.card ? top.sourceInstanceId : undefined;
        var exactOwn = own.filter(function (e) { return e.iid === pushedIid; });
        settle('announce', srcName, trig, exactOwn.length === 1 ? exactOwn : own, own.length);
        return;
      }
      if (ev.type !== 'abilityTrigger') return;
      var name = ev.source;
      var cands = all.filter(function (e) { return e.v.name === name; });
      var total = cands.length;

      if (total === 0 && prevStackTop && prevStackTop.kind === 'command' && prevStackTop.description === name) {
        push('trigger', name, 'command', 'stack', { owner: prevStackTop.controller, candidates: 0, stackId: prevStackTop.stackId });
        return;
      }

      var narrowed = cands;
      function keep(pred) { var n = narrowed.filter(pred); if (n.length) narrowed = n; }
      if (ev.trigger === 'onPlay') {
        var played = events.slice(0, k).filter(function (e) { return e.type === 'play' && e.card === name && e.instanceId; }).map(function (e) { return e.instanceId; });
        var exact = narrowed.filter(function (c) { return played.indexOf(c.iid) !== -1; });
        if (exact.length) narrowed = exact;
        else {
          var evolvedOrArmed = narrowed.filter(function (c) {
            var p = prevById[c.iid], n = newById[c.iid];
            if (!p || !n || !c.unit) return false;
            return p.v.cardId !== n.v.cardId || (p.v.pending && !n.v.pending);
          });
          if (evolvedOrArmed.length) narrowed = evolvedOrArmed;
        }
      } else if (ev.trigger === 'onAttack') {
        keep(function (c) { var p = prevById[c.iid], n = newById[c.iid]; return !!(p && c.unit && p.v.canAttackThisTurn && (!n || !n.v.canAttackThisTurn)); });
      } else if (ev.trigger === 'onDeath') {
        keep(function (c) { return !!prevById[c.iid] && !newById[c.iid]; });
      } else if (ev.trigger === 'onDamaged') {
        keep(function (c) {
          var p = prevById[c.iid], n = newById[c.iid];
          if (!p || !c.unit) return false;
          if (!n) return true;
          return (n.v.health - p.v.health) - (n.v.maxHealth - p.v.maxHealth) < 0;
        });
      } else if (ev.trigger === 'onTurnStart' || ev.trigger === 'onTurnEnd') {
        var t = lastBefore(k, ev.trigger === 'onTurnStart' ? 'turnStart' : 'turnEnd');
        if (t) keep(function (c) { return c.owner === t.player; });
      } else if (ev.trigger === 'activated') {
        if (prevStackTop && prevStackTop.kind === 'ability' && prevStackTop.description.indexOf(name + ' \\u2014 ') === 0) {
          var ctl = prevStackTop.controller, srcIid = prevStackTop.sourceInstanceId;
          keep(function (c) { return c.owner === ctl; });
          if (srcIid) keep(function (c) { return c.iid === srcIid; });
        }
      }
      if (narrowed.length > 1 && (ev.trigger === 'onTurnStart' || ev.trigger === 'onTurnEnd' || ev.trigger === 'onPlay')) {
        // Two copies of the same card on one side each fire their own turn
        // trigger — or both arm their telegraph at the same turn start — in
        // board order (engine fireTurnAbilities / processTelegraphArming).
        // When every copy's trigger was logged, the k-th event is the k-th
        // copy; when some were skipped (a failed condition) the pairing is
        // unknowable, so it stays a banner.
        var same = [];
        events.forEach(function (e, j) { if (e.type === 'abilityTrigger' && e.source === name && e.trigger === ev.trigger && e.ability === ev.ability) same.push(j); });
        if (same.length === narrowed.length) narrowed = [narrowed[same.indexOf(k)]];
      }
      settle('trigger', name, ev.trigger, narrowed, total);
    });
    return out;
  }

  // Which stack items were put on the stack as a RESPONSE (an Instant cast
  // on the opponent's turn), by engine stack id, over a whole replay. A
  // response's effect lands on the later move its item resolves, so that is
  // where the "cast, then effect" beat belongs (owner feedback 2026-09-27,
  // item 2). Keyed by the same rule resolveCasts uses to tag RESPONSE.
  function responseStackIds(frames) {
    var ids = {};
    for (var k = 1; k < frames.length; k++) {
      var prevIds = {};
      frames[k - 1].stack.forEach(function (it) { prevIds[it.stackId] = true; });
      var responses = frames[k].newEvents.map(function (x) { return x.event; }).filter(function (ev) {
        return ev.type === 'cast' && ev.speed === 'Instant' && ev.player !== frames[k].activePlayer;
      });
      if (!responses.length) continue;
      frames[k].stack.forEach(function (it) {
        if (prevIds[it.stackId] || it.kind === 'combatDamage') return;
        if (responses.some(function (ev) { return ev.card === it.description && ev.player === it.controller; })) ids[it.stackId] = true;
      });
    }
    return ids;
  }

  // The stack ids that left the stack on this move. The engine's only pop is
  // resolution, so these are the items that just resolved.
  function resolvedStackIds(prevFrame, newFrame) {
    var still = {};
    newFrame.stack.forEach(function (it) { still[it.stackId] = true; });
    return prevFrame.stack.filter(function (it) { return !still[it.stackId]; }).map(function (it) { return it.stackId; });
  }
`;

const impl = new Function(`${CAST_FX_SOURCE}; return { resolveCasts: resolveCasts, castScore: castScore, castTier: castTier, responseStackIds: responseStackIds, resolvedStackIds: resolvedStackIds };`)() as {
  responseStackIds: (frames: Frame[]) => Record<string, true>;
  resolvedStackIds: (prev: Frame, next: Frame) => string[];
  resolveCasts: (prev: Frame, next: Frame, cardFactions: Record<string, Faction>, cardRarities: Record<string, Rarity>) => CastFx[];
  castScore: (rarity: Rarity, trigger: string) => number;
  castTier: (score: number) => FxTier;
};

/** Every power/ability flourish one move should show, in event order. */
export function resolveCasts(
  prev: Frame,
  next: Frame,
  cardFactions: Record<string, Faction>,
  cardRarities: Record<string, Rarity>,
): CastFx[] {
  return impl.resolveCasts(prev, next, cardFactions, cardRarities);
}

export const castScore = impl.castScore;
export const castTier = impl.castTier;

/** Stack ids of every item put on the stack as a RESPONSE, over a replay. */
export const responseStackIds = impl.responseStackIds;
/** Stack ids that resolved (left the stack) on the move prev -> next. */
export const resolvedStackIds = impl.resolvedStackIds;
