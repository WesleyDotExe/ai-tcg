// The Watch live widget at L (render session 67, the Season 0 brief's
// table: "the live match embedded in the tile, reuse the existing arena").
// The tile embeds the same live arena page the full-screen view opens
// (siteHost.ts `POST /live-page/:matchId`, renderHtml.ts in its embed mode)
// and the page keeps that frame alive across Home's redraws. This file holds
// the parts of that which don't need a browser to reason about: which match
// the tile shows, how the frame is scaled into the tile, and the redraw that
// replaces everything on the page except the frame (an iframe that is
// removed or moved in the DOM reloads, and the arena would start over).

/** The width the arena is laid out at inside the tile (its own page caps
 * #app at 1180 px): the frame is this wide and scaled down to the tile, so
 * the tile shows the whole arena, as it looks full screen, not a reflowed
 * narrow one. */
export const TILE_ARENA_W = 1180;
/** After its feed ends, the match stays on the tile this long: the arena
 * plays the winner's boast and shows the result. Then the next live match. */
export const TILE_ARENA_HOLD_END_MS = 20_000;
/** A match gone from the live list whose feed hasn't said it ended (the
 * page polls every 3 s) is kept at most this long. */
export const TILE_ARENA_HOLD_GONE_MS = 30_000;

/** What the page remembers about the embedded match. */
export interface HeldArena {
  matchId: string;
  /** The arena's feed said the match was recorded (its last frame is out). */
  ended: boolean;
  endedAt: number | null;
  /** When the match was first seen missing from `GET /api/live`. */
  goneAt: number | null;
}

/** Which match the tile embeds now: the held one while it is live, or for
 * a short hold after it ends (its result and boast play); else the first
 * live match (the viewer's own first: `GET /api/live`'s order), or none. */
export function arenaPick(held: HeldArena | null, liveIds: readonly string[], now: number): { matchId: string; ended: boolean } | null {
  if (held) {
    if (liveIds.includes(held.matchId)) return { matchId: held.matchId, ended: held.ended };
    const gone = held.goneAt ?? now;
    const keep = held.ended ? now - (held.endedAt ?? now) < TILE_ARENA_HOLD_END_MS : now - gone < TILE_ARENA_HOLD_GONE_MS;
    if (keep) return { matchId: held.matchId, ended: true };
  }
  return liveIds.length ? { matchId: liveIds[0]!, ended: false } : null;
}

/** The frame's size and scale for a tile slot `w` x `h` px: laid out
 * TILE_ARENA_W wide and as tall as the slot's shape asks, then scaled to
 * fit exactly. */
export function arenaFit(w: number, h: number): { width: number; height: number; scale: number } {
  const scale = w > 0 ? w / TILE_ARENA_W : 1;
  return { width: TILE_ARENA_W, height: Math.max(1, Math.round(h / scale)), scale };
}

/** The key an element is matched to its redrawn twin by: its id, its
 * data-id (a widget), else its tag and first class. */
function keyOf(e: Element): string {
  if (e.id) return `#${e.id}`;
  const did = e.getAttribute("data-id");
  if (did !== null) return `@${did}`;
  return `${e.tagName}.${e.classList[0] ?? ""}`;
}

export function syncAttributes(to: Element, from: Element): void {
  for (const a of [...to.attributes]) if (!from.hasAttribute(a.name)) to.removeAttribute(a.name);
  for (const a of [...from.attributes]) if (to.getAttribute(a.name) !== a.value) to.setAttribute(a.name, a.value);
}

/** Makes `oldEl` match `newEl` (a parsed redraw) without removing or moving
 * `keep`, a node inside `oldEl`: along the path down to `keep`, each
 * element keeps its place and takes its twin's attributes, and everything
 * else is replaced by the redraw's nodes, in the redraw's order. `keep`
 * itself is left as it is (its twin is dropped). False, with nothing
 * changed, when the redraw has no twin on that path (the caller then
 * redraws the plain way). */
export function patchAround(oldEl: Element, newEl: Element | DocumentFragment, keep: Element): boolean {
  // The twins along the path, checked before anything is changed.
  const path: [Element, Element | DocumentFragment][] = [];
  let o: Element = oldEl;
  let n: Element | DocumentFragment = newEl;
  while (o !== keep) {
    const oc = [...o.children].find((c) => c.contains(keep));
    if (!oc) return false;
    const k = keyOf(oc);
    const nc = [...n.children].find((c) => keyOf(c) === k);
    if (!nc) return false;
    path.push([o, n]);
    o = oc;
    n = nc;
  }
  for (let i = path.length - 1; i >= 0; i--) {
    const [op, np] = path[i]!;
    const oc = i + 1 < path.length ? path[i + 1]![0] : keep;
    const nc = [...np.children].find((c) => keyOf(c) === keyOf(oc))!;
    if (oc !== keep) syncAttributes(oc, nc);
    for (const node of [...op.childNodes]) if (node !== oc) op.removeChild(node);
    let before = true;
    for (const node of [...np.childNodes]) {
      if (node === nc) {
        before = false;
        continue;
      }
      if (before) op.insertBefore(node, oc);
      else op.appendChild(node);
    }
  }
  return true;
}
