// The Home widget board's saved layout (owner 2026-11-01: "the Home widget
// board's layout and the widgets' sizes, saved to the owner's account").
// The board is the owner's 2026-10-05 desktop spec as trimmed for Season 0
// (render/reference/owner-web-mockup.html): a 12-column grid the widgets
// flow into in order, each Small, Medium or Large. The layout is an ordered
// list, so "move" is a change of place in the list and the grid packs it;
// the page owns the pixels, the account owns the list.
//
// One row per owner, written the first time the owner saves a board; an
// owner who never has reads the recommended layout. Migration 16 freezes its
// own copy of the widget types, as every migration does.

/** The Season 0 widgets (owner 2026-11-01, the trimmed spec): My agent,
 * Live match, Watch live, Packs, Collection, Showcase, Ladder, Rating &
 * form, Match history, Notifications, Store and Daily rewards. The ids are
 * the mockup's. */
export const WIDGET_TYPES = ["agent", "live", "watch", "packs", "daily", "collection", "showcase", "ladder", "form", "history", "notif", "store"] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

/** Widgets in the spec that come after Season 0 (owner 2026-11-01): refused
 * with that reason rather than as unknown. */
export const LATER_WIDGET_TYPES: Readonly<Record<string, string>> = Object.freeze({
  tournament: "the Tournament widget comes after Season 0",
  feed: "the League pull feed comes after Season 0",
});

export const WIDGET_SIZES = ["S", "M", "L"] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];

/** How many of each widget a board may hold: one, except Watch live, which
 * may be on the board twice (the mockup's `multi: 2`). */
export const WIDGET_LIMITS: Readonly<Record<WidgetType, number>> = Object.freeze(
  Object.fromEntries(WIDGET_TYPES.map((t) => [t, t === "watch" ? 2 : 1])) as Record<WidgetType, number>,
);

/** The most widgets a board can hold: every widget at its limit. */
export const MAX_WIDGETS = WIDGET_TYPES.reduce((t, w) => t + WIDGET_LIMITS[w], 0);

/** A widget's id is the page's (the mockup numbers them "w1", "w2"...):
 * letters, digits, "-" and "_", 1 to 32 of them, unique on the board. */
export const WIDGET_ID = /^[A-Za-z0-9_-]{1,32}$/;

export interface Widget {
  id: string;
  type: WidgetType;
  size: WidgetSize;
}

export interface BoardLayout {
  /** In board order: the grid fills left to right, top to bottom. An empty
   * list is a saved empty board (the page shows its empty state). */
  widgets: Widget[];
  /** True while the owner has never saved a board, so this is the
   * recommended layout. */
  recommended: boolean;
  /** When the owner last saved the board; null: never. */
  updatedAt: string | null;
}

/** The recommended layout: the mockup's, with its Tournament slot (Small)
 * given to the Store widget, since tournaments come after Season 0 (owner
 * 2026-11-01: "The Recommended layout swaps the Tournament slot for one of
 * these"). Which widget takes the slot is this session's call, raised at the
 * check-in. */
export const RECOMMENDED_LAYOUT: readonly Readonly<Widget>[] = Object.freeze(
  (
    [
      ["agent", "M"],
      ["live", "M"],
      ["packs", "M"],
      ["daily", "S"],
      ["store", "S"],
      ["watch", "M"],
      ["collection", "M"],
      ["ladder", "M"],
      ["form", "M"],
    ] as const
  ).map(([type, size], i) => Object.freeze({ id: `w${i + 1}`, type, size })),
);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const WIDGET_FIELDS = ["id", "type", "size"] as const;

/** Why `body` isn't a board to save, or undefined when it is. It takes
 * anything (a parsed request body, `{ widgets: [...] }`) and names the first
 * problem: not an object, an unknown field, a widget that isn't an object, a
 * bad or repeated id, an unknown or later widget, a size not S/M/L, more of
 * a widget than its limit. An empty list is valid (an empty board). */
export function boardLayoutProblem(body: unknown): string | undefined {
  if (!isObject(body)) return "the board must be an object ({ widgets: [...] })";
  for (const key of Object.keys(body)) if (key !== "widgets") return `unknown field "${key}" (the board has only "widgets")`;
  const widgets = body.widgets;
  if (!Array.isArray(widgets)) return `"widgets" must be a list`;
  if (widgets.length > MAX_WIDGETS) return `a board holds at most ${MAX_WIDGETS} widgets, got ${widgets.length}`;
  const ids = new Set<string>();
  const counts = new Map<string, number>();
  for (const [i, w] of widgets.entries()) {
    const at = `widget ${i + 1}`;
    if (!isObject(w)) return `${at} must be an object ({ id, type, size })`;
    for (const key of Object.keys(w)) if (!(WIDGET_FIELDS as readonly string[]).includes(key)) return `${at}: unknown field "${key}" (fields: id, type, size)`;
    if (typeof w.id !== "string" || !WIDGET_ID.test(w.id)) return `${at}: "id" must be 1 to 32 letters, digits, "-" or "_"`;
    if (ids.has(w.id)) return `${at}: the id "${w.id}" is already on the board`;
    ids.add(w.id);
    if (typeof w.type !== "string") return `${at}: "type" must be a widget type`;
    if (Object.hasOwn(LATER_WIDGET_TYPES, w.type)) return `${at}: ${LATER_WIDGET_TYPES[w.type]}`;
    if (!(WIDGET_TYPES as readonly string[]).includes(w.type)) return `${at}: no widget "${w.type}" (widgets: ${WIDGET_TYPES.join(", ")})`;
    if (!(WIDGET_SIZES as readonly unknown[]).includes(w.size)) return `${at}: "size" must be S, M or L`;
    const n = (counts.get(w.type) ?? 0) + 1;
    counts.set(w.type, n);
    const limit = WIDGET_LIMITS[w.type as WidgetType];
    if (n > limit) return `${at}: a board holds ${limit === 1 ? "one" : limit} "${w.type}" widget${limit === 1 ? "" : "s"}`;
  }
  return undefined;
}

/** The widgets of a checked body, keeping only the three fields. */
export function boardWidgets(body: { widgets: readonly Widget[] }): Widget[] {
  return body.widgets.map((w) => ({ id: w.id, type: w.type, size: w.size }));
}
