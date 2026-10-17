// The spectator feed (render session 21; progress/render/quality-debt.md,
// "the event log is raw engine text").
//
// Until this module, the replay's log pane printed the engine's own
// formatEvent text: a third of its lines were "p1 passes priority", turns
// ended in "[end of turn 13 for p1]", players were p1 / p2, triggers named
// internal ability ids ("diagnostic-loop-turnend (onTurnEnd)"), and every
// attack took two lines ("X attacks Y", then ">>> resolving: X's attack").
// That was a debugging view. Commentary (stage 7) is the real translation
// layer; this is the render's own legible record until then, and it stays
// the reference a spectator can scroll back through once commentary lands.
//
// buildFeed turns each frame's structured events (never the prose) into
// feed entries:
//   - priority passes and turn ends are dropped: they carry no news. A pass
//     only matters as "nobody answered", and the stack panel already shows
//     what is waiting;
//   - each turn opens with a header naming the agent, and the card drawn for
//     that turn sits in the header (the engine logs the draw just before the
//     turn starts);
//   - an attack is one entry: its resolution and its damage nest under the
//     declaration, unless something happened in between (a response), in
//     which case the resolution gets its own line;
//   - a cast while the stack holds something, or by the player whose turn it
//     isn't, is tagged RESPONSE: the reactive play the priority system
//     exists for, which the raw log buried among the passes;
//   - triggers read as "Card · end of turn: <rules text>", from the card's
//     own ability text, not its id. A trigger that changed nothing (an
//     end-of-turn heal on an unhurt unit, a condition that didn't hold) is
//     dropped (render session 22): it is news only in the engine log;
//   - attack fizzles and the game's end are worded from the engine's
//     structured cause (game session 38), not its reason text, and so is a
//     redirect that did nothing (game session 39, worded in render session
//     23): "Intercept Routine fizzles: X's attack was already aimed at Y"
//     takes the place of its "resolves" line;
//   - players are named by their agent names and carried as player parts,
//     so the page can tint them in their faction colour.
// Everything is computed in Node at capture time and embedded per frame, so
// the page only draws entries. The raw engine text stays in the replay
// (Frame.newEvents[].text) behind the page's "engine log" switch.
import type { GameEvent, PlayerId } from "@ai-tcg/engine";
import type { Frame } from "./types.js";

/** One run of text in an entry: plain text, a card name (tinted by its
 * faction on the page) or a player (named and tinted by the page). */
export type FeedPart = string | { card: string } | { player: PlayerId };

export type FeedKind =
  /** A turn opens: side = whose turn. */
  | "turn"
  /** Something a player chose: play, cast, attack, evolve, attach. */
  | "action"
  /** A cast into a non-empty stack or on the other player's turn. */
  | "response"
  /** A card's ability fires on its own (a trigger, an arming unit). */
  | "trigger"
  /** A stack item resolving on its own line. */
  | "resolve"
  /** What happened as a result: damage, deaths, buffs, statuses. */
  | "result"
  /** The game is over. */
  | "end";

export interface FeedEntry {
  kind: FeedKind;
  /** Whose entry it is, for the page's side colour. Absent when no player
   * owns it (a trigger whose controller the event doesn't name). */
  side?: PlayerId;
  parts: FeedPart[];
  /** Second line in smaller type: a trigger's rules text, the header's draw. */
  detail?: FeedPart[];
  /** A short label: RESPONSE, INSTANT, SIGNATURE. */
  tag?: string;
}

export interface FeedContext {
  /** Agent name per seat (the replay's usernames). */
  names: Record<PlayerId, string>;
  /** Ability id -> its rules text (engine Ability.text). Ids are unique
   * since game session 38 (a signature ability's size is in its id), and
   * capture.ts's abilityTextFor refuses a clash. Not keyed by card name: a
   * signature card's name can follow its agent's, and owners rename agents.
   * A missing one falls back to the trigger label alone, never to the id. */
  abilityText: Record<string, string>;
}

const TRIGGER_LABEL: Record<string, string> = {
  onPlay: "on entry",
  onAttack: "on attack",
  onDamaged: "when damaged",
  onDeath: "on death",
  onTurnStart: "start of turn",
  onTurnEnd: "end of turn",
  onKill: "on kill",
  onEnemyAttack: "when attacked",
  activated: "activated",
};

export function triggerLabel(trigger: string): string {
  return TRIGGER_LABEL[trigger] ?? trigger;
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Resolves a target name the event gives as text: a player's name becomes
 * a player part, anything else a card. */
function nameOrPlayer(name: string, kind: "unit" | "player" | undefined, ctx: FeedContext): FeedPart {
  if (kind !== "unit") {
    if (name === ctx.names.p1) return { player: "p1" };
    if (name === ctx.names.p2) return { player: "p2" };
  }
  return { card: name };
}

/** The name an instance id had on a frame's board (units and Directives). */
function instanceName(frame: Frame | undefined, id: string): string | undefined {
  if (!frame) return undefined;
  for (const pid of ["p1", "p2"] as const) {
    const p = frame.players[pid];
    const u = p.board.find((x) => x.instanceId === id) ?? p.directives.find((x) => x.instanceId === id);
    if (u) return u.name;
  }
  return undefined;
}

/** Who controls an instance on a frame's board, if it is there. */
function instanceSide(frame: Frame | undefined, id: string | undefined): PlayerId | undefined {
  if (!frame || !id) return undefined;
  for (const pid of ["p1", "p2"] as const) {
    const p = frame.players[pid];
    if (p.board.some((x) => x.instanceId === id) || p.directives.some((x) => x.instanceId === id)) return pid;
  }
  return undefined;
}

/** Who controls a card by name on either frame's board, when the event
 * carries no id. Ambiguous names (a mirror match) give undefined. */
function sideByName(frames: (Frame | undefined)[], name: string): PlayerId | undefined {
  const found = new Set<PlayerId>();
  for (const f of frames) {
    if (!f) continue;
    for (const pid of ["p1", "p2"] as const) {
      if (f.players[pid].board.some((u) => u.name === name) || f.players[pid].directives.some((d) => d.name === name)) found.add(pid);
    }
  }
  return found.size === 1 ? [...found][0] : undefined;
}

type TargetRefLike = { kind: string; instanceId?: string; playerId?: PlayerId };

function targetPart(ref: TargetRefLike | undefined, before: Frame | undefined): FeedPart | undefined {
  if (!ref) return undefined;
  if (ref.kind === "player" && ref.playerId) return { player: ref.playerId };
  if (ref.instanceId) {
    const name = instanceName(before, ref.instanceId);
    if (name) return { card: name };
  }
  return undefined;
}

const RESULT_TYPES = new Set<GameEvent["type"]>([
  "damage",
  "heal",
  "buff",
  "statusApplied",
  "barrierAbsorbed",
  "death",
  "signatureReturn",
  "gainEnergy",
  "telegraphPlaced",
  "attackRedirected",
  "directiveDestroyed",
  "summon",
  "summonFizzle",
  "baseArmorReduced",
  "fatigue",
  "draw",
]);

/** The result line for an event that reports an outcome, or null. */
function resultEntry(ev: GameEvent, ctx: FeedContext, after: Frame): FeedEntry | null {
  switch (ev.type) {
    case "damage":
      return { kind: "result", parts: [{ card: ev.source }, ` deals ${ev.amount} to `, nameOrPlayer(ev.target, ev.targetKind, ctx)] };
    case "heal":
      return { kind: "result", parts: [{ card: ev.source }, ` restores ${ev.amount} to `, nameOrPlayer(ev.target, ev.targetKind, ctx)] };
    case "buff":
      return { kind: "result", parts: [{ card: ev.source }, " gives ", { card: ev.target }, ` ${signed(ev.attack)}/${signed(ev.health)}`] };
    case "statusApplied":
      return { kind: "result", parts: [{ card: ev.source }, ` puts ${ev.status} on `, { card: ev.target }] };
    case "barrierAbsorbed":
      return { kind: "result", parts: [{ card: ev.unit }, "'s Barrier absorbs the hit from ", { card: ev.source }] };
    case "death":
      return { kind: "result", side: ev.controller, parts: [{ card: ev.unit }, " is destroyed"] };
    case "signatureReturn":
      return { kind: "result", side: ev.player, parts: [{ card: ev.card }, ` returns to the signature zone; next play costs ${ev.nextCost}`] };
    case "gainEnergy":
      return { kind: "result", side: ev.player, parts: [{ player: ev.player }, ` gains ${ev.amount} energy from `, { card: ev.source }] };
    case "telegraphPlaced":
      return {
        kind: "result",
        side: instanceSide(after, ev.instanceId),
        parts: [{ card: ev.unit }, ` deploys dormant: arms in ${ev.armIn} turn${ev.armIn === 1 ? "" : "s"}`],
      };
    case "attackRedirected":
      return { kind: "result", parts: [{ card: ev.source }, " pulls ", { card: ev.attacker }, "'s attack from ", nameOrPlayer(ev.from, ev.fromRef?.kind === "unit" ? "unit" : undefined, ctx), " onto ", nameOrPlayer(ev.to, ev.toRef?.kind === "unit" ? "unit" : undefined, ctx)] };
    case "directiveDestroyed":
      return { kind: "result", side: ev.controller, parts: [{ card: ev.source }, " destroys ", { card: ev.directive }] };
    case "summon":
      return { kind: "result", side: ev.player, parts: [{ card: ev.source }, " summons ", { card: ev.token }] };
    case "summonFizzle":
      return { kind: "result", side: ev.player, parts: [{ card: ev.source }, " finds no free slot for ", { card: ev.token }] };
    case "baseArmorReduced":
      return { kind: "result", parts: [{ card: ev.unit }, `'s armor turns ${ev.rawAmount} damage into ${ev.reducedTo}`] };
    case "fatigue":
      return { kind: "result", side: ev.player, parts: [{ player: ev.player }, ` has no cards left and takes ${ev.damage} fatigue`] };
    case "draw":
      return { kind: "result", side: ev.player, parts: [{ player: ev.player }, " draws ", { card: ev.card }] };
    default:
      return null;
  }
}

/** True when the frame has a turnStart for `player` after event index `k`:
 * the draw at `k` is that turn's draw and belongs in its header. */
function turnStartFollows(events: GameEvent[], k: number, player: PlayerId): boolean {
  for (let j = k + 1; j < events.length; j++) {
    const e = events[j]!;
    if (e.type === "turnStart") return e.player === player;
    if (e.type !== "turnEnd" && e.type !== "draw" && e.type !== "fatigue" && e.type !== "abilityTrigger" && !RESULT_TYPES.has(e.type)) return false;
  }
  return false;
}

/** True when the trigger at event index `k` changed nothing. The engine
 * logs what an ability does straight after its abilityTrigger (effects,
 * then the deaths they caused), and every effect that changes the game
 * logs it; a heal on an unhurt unit, energy at the cap or a condition that
 * didn't hold logs nothing. So: nothing before the next event that isn't
 * a result. Another trigger ends the run too, since what follows it is its
 * own. A fizzle counts as news (the ability tried and found nothing).
 * One result isn't the trigger's: after an end-of-turn trigger the engine
 * logs the next turn's draw (or fatigue), straight before its turnStart. */
export function triggerChangedNothing(events: GameEvent[], k: number): boolean {
  const next = events[k + 1];
  if (!next) return true;
  if (next.type === "draw" || next.type === "fatigue") {
    const after = events[k + 2];
    return after?.type === "turnStart" && after.player === next.player;
  }
  return next.type !== "fizzle" && !RESULT_TYPES.has(next.type);
}

/** Builds the feed: one list of entries per frame, in frame order. */
export function buildFeed(frames: Frame[], ctx: FeedContext): FeedEntry[][] {
  return buildFeedWithQuiet(frames, ctx).entries;
}

export interface FeedBuild {
  /** One list of entries per frame, in frame order. */
  entries: FeedEntry[][];
  /** Per frame: the indices into that frame's newEvents of the triggers
   * the feed dropped because they changed nothing (render session 23). The
   * board's cast flourish skips the same ones, so the board and the feed
   * agree on what fired. */
  quiet: number[][];
}

/** buildFeed, plus which triggers it dropped as quiet. */
export function buildFeedWithQuiet(frames: Frame[], ctx: FeedContext): FeedBuild {
  const out: FeedEntry[][] = [];
  const quiet: number[][] = [];
  // The most recent top-level entry, across frames: an attack's resolution
  // nests under its declaration only if that is still the last thing said.
  let lastTopStack: string | undefined;
  // Declared attacks waiting on the stack, by stack id: attacker, side.
  const attacks = new Map<string, { attacker: string; side: PlayerId }>();
  for (let f = 0; f < frames.length; f++) {
    const frame = frames[f]!;
    const before = f > 0 ? frames[f - 1] : undefined;
    const raw = frame.newEvents.map((e) => e.event);
    const events = attackFirst(raw);
    const entries: FeedEntry[] = [];
    const dropped: number[] = [];
    const heldDraws: FeedPart[][] = [];
    // A resolve just emitted for a Command: its onPlay trigger is the same
    // news, so its rules text joins the resolve line.
    let resolvedCommand: { name: string; entry: FeedEntry } | null = null;
    // Set when an attack resolves: dropped if damage (or a block of it)
    // follows, otherwise it becomes a "deals no damage" line.
    let pendingNoDamage: FeedEntry | null = null;
    // An arming unit: its onPlay trigger is the arming, not an entry.
    let armed: { name: string; entry: FeedEntry } | null = null;
    // An attack's resolution on its own line: if the attack then fizzles,
    // that line says so instead of "lands".
    let landed: { attacker: string; entry: FeedEntry } | null = null;
    // A Command's resolve line, kept past the onPlay trigger it absorbs: if
    // the Command then fizzles (Intercept Routine with nothing to redirect),
    // that line says so instead of "resolves".
    let resolvedLine: { name: string; entry: FeedEntry } | null = null;

    const top = (e: FeedEntry, stackId?: string) => {
      entries.push(e);
      lastTopStack = stackId;
    };

    for (let k = 0; k < events.length; k++) {
      const ev = events[k]!;
      // A Command's resolve line and an arming unit absorb only the trigger
      // that comes straight after them.
      if (ev.type !== "abilityTrigger") {
        resolvedCommand = null;
        armed = null;
      }
      const wasLanded = landed;
      landed = null;
      const wasResolved = resolvedLine;
      if (ev.type !== "abilityTrigger") resolvedLine = null;
      if (pendingNoDamage && ev.type !== "damage" && ev.type !== "barrierAbsorbed" && ev.type !== "baseArmorReduced" && ev.type !== "attackRedirected" && !(ev.type === "fizzle" && isAttackFizzle(ev))) {
        entries.push(pendingNoDamage);
        pendingNoDamage = null;
      } else if (pendingNoDamage) {
        pendingNoDamage = null;
      }

      switch (ev.type) {
        case "priorityPass":
        case "turnEnd":
          break;
        case "turnStart": {
          const header: FeedEntry = { kind: "turn", side: ev.player, parts: [`Turn ${ev.turn}`, " · ", { player: ev.player }] };
          if (heldDraws.length) header.detail = heldDraws.flatMap((d, i) => (i ? ["; ", ...d] : d));
          heldDraws.length = 0;
          top(header);
          break;
        }
        case "draw":
        case "fatigue":
          if (turnStartFollows(events, k, ev.player)) {
            heldDraws.push(ev.type === "draw" ? ["draws ", { card: ev.card }] : [`no cards left: ${ev.damage} fatigue`]);
          } else {
            entries.push(resultEntry(ev, ctx, frame)!);
          }
          break;
        case "play": {
          const e: FeedEntry = ev.fromSignatureZone
            ? { kind: "action", side: ev.player, tag: "SIGNATURE", parts: [{ player: ev.player }, " plays ", { card: ev.card }, ` from the signature zone for ${ev.cost}`] }
            : { kind: "action", side: ev.player, parts: [{ player: ev.player }, " plays ", { card: ev.card }] };
          top(e);
          break;
        }
        case "cast": {
          const responding = (before?.stack.length ?? 0) > 0 || ev.player !== (before ?? frame).activePlayer;
          // An activated ability's cast names "Card — rules text".
          const [cardName, abilityText] = splitAbility(ev.card);
          const parts: FeedPart[] = [{ player: ev.player }, ev.sourceId ? " activates " : " casts ", { card: cardName }];
          const tgt = targetPart(ev.targetRef as TargetRefLike | undefined, before);
          if (tgt) parts.push(" at ", tgt);
          const e: FeedEntry = { kind: responding ? "response" : "action", side: ev.player, parts };
          if (abilityText) e.detail = [abilityText];
          if (responding) e.tag = "RESPONSE";
          else if (ev.speed === "Instant") e.tag = "INSTANT";
          top(e, ev.stackId);
          break;
        }
        case "attack": {
          const side = instanceSide(before, ev.attackerId) ?? instanceSide(frame, ev.attackerId) ?? frame.activePlayer;
          const defender = ev.defenderRef ? targetPart(ev.defenderRef as TargetRefLike, before) : undefined;
          top({ kind: "action", side, parts: [{ card: ev.attacker }, " attacks ", defender ?? nameOrPlayer(ev.defender, ev.defenderKind, ctx)] }, ev.stackId);
          if (ev.stackId) attacks.set(ev.stackId, { attacker: ev.attacker, side });
          break;
        }
        case "stackResolve": {
          const atk = ev.stackId ? attacks.get(ev.stackId) : undefined;
          if (atk && ev.stackId) {
            attacks.delete(ev.stackId);
            const noDamage: FeedEntry = { kind: "result", side: atk.side, parts: [{ card: atk.attacker }, " deals no damage"] };
            if (lastTopStack === ev.stackId) {
              // Nested under its own declaration.
              pendingNoDamage = noDamage;
            } else {
              const e: FeedEntry = { kind: "resolve", side: atk.side, parts: [{ card: atk.attacker }, "'s attack lands"] };
              top(e, ev.stackId);
              landed = { attacker: atk.attacker, entry: e };
              pendingNoDamage = noDamage;
            }
            break;
          }
          // A Command or an activated ability: "Name — text" or "Name".
          const name = splitAbility(ev.description)[0];
          const castSide = sideOfCast(frames, f, ev.stackId);
          const e: FeedEntry = { kind: "resolve", parts: [{ card: name }, " resolves"] };
          if (castSide) e.side = castSide;
          top(e, ev.stackId);
          resolvedCommand = { name, entry: e };
          resolvedLine = resolvedCommand;
          break;
        }
        case "abilityTrigger": {
          const text = ctx.abilityText[ev.ability];
          if (resolvedCommand && resolvedCommand.name === ev.source && (ev.trigger === "onPlay" || ev.trigger === "activated")) {
            if (text) resolvedCommand.entry.detail = [text];
            resolvedCommand = null;
            break;
          }
          if (armed && armed.name === ev.source && ev.trigger === "onPlay") {
            if (text) armed.entry.detail = [text];
            armed = null;
            break;
          }
          resolvedCommand = null;
          resolvedLine = null;
          if (triggerChangedNothing(events, k)) {
            dropped.push(raw.indexOf(ev));
            break;
          }
          const side = instanceSide(before, ev.sourceId) ?? instanceSide(frame, ev.sourceId) ?? sideByName([before, frame], ev.source);
          const e: FeedEntry = { kind: "trigger", parts: [{ card: ev.source }, " · ", triggerLabel(ev.trigger)] };
          if (side) e.side = side;
          if (text) e.detail = [text];
          // An attack's own triggers belong to it: the resolution still
          // nests under the declaration.
          if (ev.trigger === "onAttack" || ev.trigger === "onEnemyAttack") entries.push(e);
          else top(e);
          break;
        }
        case "telegraphArmed": {
          const side = instanceSide(frame, ev.instanceId) ?? sideByName([frame], ev.unit);
          const e: FeedEntry = { kind: "trigger", parts: [{ card: ev.unit }, " arms"] };
          if (side) e.side = side;
          top(e);
          armed = { name: ev.unit, entry: e };
          break;
        }
        case "evolve":
          top({ kind: "action", side: ev.player, parts: [{ player: ev.player }, " evolves ", { card: ev.from }, " into ", { card: ev.to }] });
          break;
        case "toolAttached":
          top({ kind: "action", side: ev.player, parts: [{ player: ev.player }, " attaches ", { card: ev.tool }, " to ", { card: ev.unit }] });
          break;
        case "fizzle": {
          if (isAttackFizzle(ev) && ev.attacker) {
            // The attack's resolution said "deals no damage"; this says why.
            pendingNoDamage = null;
            const side = instanceSide(before, ev.attackerId) ?? instanceSide(frame, ev.attackerId);
            const why = ev.cause === "attackerGone" ? "the attacker left play first" : "its target left play first";
            const parts: FeedPart[] = [{ card: ev.attacker }, `'s attack fizzles: ${why}`];
            if (wasLanded && wasLanded.attacker === ev.attacker) wasLanded.entry.parts = parts;
            else entries.push({ kind: "result", ...(side ? { side } : {}), parts });
          } else if (isRedirectFizzle(ev) && ev.source) {
            const parts: FeedPart[] = [{ card: ev.source }, " fizzles: ", ...redirectFizzleWhy(ev, before, ctx)];
            if (wasResolved && wasResolved.name === ev.source) wasResolved.entry.parts = parts;
            else {
              const side = instanceSide(before, ev.sourceId) ?? sideOfCast(frames, f, ev.sourceId);
              entries.push({ kind: "result", ...(side ? { side } : {}), parts });
            }
          } else {
            entries.push({ kind: "result", parts: ["fizzles: ", ...withPlayers(ev.reason)] });
          }
          break;
        }
        case "gameOver":
          top({ kind: "end", ...(ev.winner === "draw" ? {} : { side: ev.winner }), parts: gameOverParts(ev, frame) });
          break;
        default: {
          const r = resultEntry(ev, ctx, frame);
          if (r) entries.push(r);
        }
      }
    }
    if (pendingNoDamage) entries.push(pendingNoDamage);
    // Draws held for a turn that didn't start in this frame (never seen in
    // the engine's order, but never lose a line).
    for (const d of heldDraws) entries.push({ kind: "result", parts: d });
    out.push(entries);
    quiet.push(dropped.sort((a, b) => a - b));
  }
  return { entries: out, quiet };
}

type FizzleEvent = Extract<GameEvent, { type: "fizzle" }>;

/** An attack's own fizzle (its attacker or target left play), as opposed
 * to an Intercept Routine redirect that did nothing (isRedirectFizzle). */
function isAttackFizzle(ev: FizzleEvent): boolean {
  return ev.cause === "attackerGone" || ev.cause === "targetGone";
}

/** A redirect that did nothing (game session 39): the attack was already
 * aimed at the unit chosen, or no attack was waiting. Worded by the feed
 * since render session 23; until then it printed the engine's reason text,
 * "fizzles: Intercept Routine: X's attack is already aimed at Y". */
function isRedirectFizzle(ev: FizzleEvent): boolean {
  return ev.cause === "alreadyAimed" || ev.cause === "noPendingAttack";
}

/** Why a redirect fizzled, after "<card> fizzles: ". */
function redirectFizzleWhy(ev: FizzleEvent, before: Frame | undefined, ctx: FeedContext): FeedPart[] {
  if (ev.cause === "noPendingAttack" || !ev.attacker) return ["no attack was waiting to redirect"];
  const ref = ev.targetRef as TargetRefLike | undefined;
  const target = targetPart(ref, before) ?? (ev.target ? nameOrPlayer(ev.target, ref?.kind === "unit" ? "unit" : undefined, ctx) : undefined);
  return target ? [{ card: ev.attacker }, "'s attack was already aimed at ", target] : [{ card: ev.attacker }, "'s attack was already aimed there"];
}

/** The game's end, from its cause: "X wins: Y's health reached 0", "X
 * wins at the turn cap, 14 health to 9", "Draw: ...". Logs from before game
 * session 38 have no cause and fall back to the reason text. */
function gameOverParts(ev: Extract<GameEvent, { type: "gameOver" }>, frame: Frame): FeedPart[] {
  const c = ev.cause;
  const health = (p: PlayerId) => frame.players[p].health;
  if (c?.kind === "healthDepleted") {
    if (ev.winner === "draw") return ["Draw: both players' health reached 0 at once"];
    const loser = c.losers[0] ?? (ev.winner === "p1" ? "p2" : "p1");
    return [{ player: ev.winner }, " wins: ", { player: loser }, "'s health reached 0"];
  }
  if (c?.kind === "turnCap") {
    if (ev.winner === "draw") return [`Draw at the turn cap, both on ${health("p1")} health`];
    const loser: PlayerId = ev.winner === "p1" ? "p2" : "p1";
    return [{ player: ev.winner }, ` wins at the turn cap, ${health(ev.winner)} health to ${health(loser)}`];
  }
  return ev.winner === "draw" ? ["Draw (", ...withPlayers(ev.reason), ")"] : [{ player: ev.winner }, " wins (", ...withPlayers(ev.reason), ")"];
}

/** "Card — rules text" (an activated ability on the stack) -> [card, text]. */
function splitAbility(s: string): [string, string | undefined] {
  const at = s.indexOf(" \u2014 ");
  return at < 0 ? [s, undefined] : [s.slice(0, at), s.slice(at + 3)];
}

/** The engine's reason text names seats ("p2 health depleted"): the seats
 * become player parts, so the page names the agents. */
export function withPlayers(text: string): FeedPart[] {
  const parts: FeedPart[] = [];
  let last = 0;
  for (const m of text.matchAll(/\bp([12])\b/g)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push({ player: `p${m[1]}` as PlayerId });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** The engine logs an attacker's onAttack trigger (and what it did) just
 * before the attack itself. A spectator reads "X attacks Y" first, then
 * what attacking set off, so the attack moves ahead of that block. */
export function attackFirst(events: GameEvent[]): GameEvent[] {
  const out = events.slice();
  for (let j = 0; j < out.length; j++) {
    const atk = out[j]!;
    if (atk.type !== "attack") continue;
    let i = j;
    let start = -1;
    while (i > 0) {
      const prev = out[i - 1]!;
      if (prev.type === "abilityTrigger" && prev.trigger === "onAttack" && prev.source === atk.attacker) start = i - 1;
      else if (!RESULT_TYPES.has(prev.type) && prev.type !== "abilityTrigger") break;
      i--;
    }
    if (start >= 0) {
      out.splice(j, 1);
      out.splice(start, 0, atk);
    }
  }
  return out;
}

/** Who cast the stack item `stackId`: found on the frame where it was cast. */
function sideOfCast(frames: Frame[], upTo: number, stackId: string | undefined): PlayerId | undefined {
  if (!stackId) return undefined;
  for (let f = upTo; f >= 0; f--) {
    for (const s of frames[f]!.stack) if (s.stackId === stackId) return s.controller;
  }
  return undefined;
}

/** Plain text of an entry, with players by name: for tests and evidence. */
export function feedText(entry: FeedEntry, ctx: Pick<FeedContext, "names">): string {
  const flat = (parts: FeedPart[]) => parts.map((p) => (typeof p === "string" ? p : "card" in p ? p.card : ctx.names[p.player])).join("");
  const indent = entry.kind === "turn" || entry.kind === "end" ? "" : entry.kind === "result" ? "      " : "   ";
  let s = indent + (entry.tag ? `[${entry.tag}] ` : "") + flat(entry.parts);
  if (entry.kind === "turn") s = `== ${s} ==`;
  if (entry.detail) s += ` — ${flat(entry.detail)}`;
  return s;
}
