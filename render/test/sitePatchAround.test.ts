// `patchAround` (siteTileArena.ts, render session 67): Home's redraw that
// replaces everything on the page except the Watch live tile's arena frame,
// since an iframe removed or moved in the DOM reloads and the arena would
// start over. Session 67 proved it in the browser only (33 s of redraws, the
// same frame); render 69 (a hardening pass) gives it a Node test on a small
// stand-in DOM (the render tests have no DOM library): just the parts of
// Node / Element patchAround and syncAttributes use, with the real DOM's
// rule that inserting a node takes it out of its old parent.

import { describe, expect, it } from "vitest";
import { patchAround, syncAttributes } from "../src/site/siteTileArena.js";

class FakeNode {
  parent: FakeEl | null = null;
  constructor(readonly text: string | null = null) {}
}

class FakeEl extends FakeNode {
  readonly attrs = new Map<string, string>();
  childNodes: FakeNode[] = [];
  constructor(readonly tagName: string, attrs: Record<string, string> = {}, kids: (FakeNode | string)[] = []) {
    super(null);
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
    for (const k of kids) this.appendChild(typeof k === "string" ? new FakeNode(k) : k);
  }
  get id(): string {
    return this.attrs.get("id") ?? "";
  }
  get classList(): string[] {
    return (this.attrs.get("class") ?? "").split(/\s+/).filter(Boolean);
  }
  get attributes(): { name: string; value: string }[] {
    return [...this.attrs].map(([name, value]) => ({ name, value }));
  }
  get children(): FakeEl[] {
    return this.childNodes.filter((n): n is FakeEl => n instanceof FakeEl);
  }
  getAttribute(n: string): string | null {
    return this.attrs.get(n) ?? null;
  }
  hasAttribute(n: string): boolean {
    return this.attrs.has(n);
  }
  setAttribute(n: string, v: string): void {
    this.attrs.set(n, v);
  }
  removeAttribute(n: string): void {
    this.attrs.delete(n);
  }
  contains(n: FakeNode): boolean {
    for (let p: FakeNode | null = n; p; p = p.parent) if (p === this) return true;
    return false;
  }
  removeChild(n: FakeNode): void {
    const i = this.childNodes.indexOf(n);
    if (i < 0) throw new Error("not a child");
    this.childNodes.splice(i, 1);
    n.parent = null;
  }
  appendChild(n: FakeNode): void {
    n.parent?.removeChild(n);
    this.childNodes.push(n);
    n.parent = this;
  }
  insertBefore(n: FakeNode, ref: FakeNode): void {
    n.parent?.removeChild(n);
    const i = this.childNodes.indexOf(ref);
    if (i < 0) throw new Error("ref not a child");
    this.childNodes.splice(i, 0, n);
    n.parent = this;
  }
}

const el = (tag: string, attrs: Record<string, string> = {}, ...kids: (FakeEl | string)[]) => new FakeEl(tag, attrs, kids);
const run = (o: FakeEl, n: FakeEl, keep: FakeEl) => patchAround(o as unknown as Element, n as unknown as Element, keep as unknown as Element);
/** The tree as text, to compare a patched page with its redraw. */
function dump(n: FakeNode, keep?: FakeNode): string {
  if (!(n instanceof FakeEl)) return JSON.stringify(n.text);
  if (n === keep) return "<KEPT>";
  const a = [...n.attrs].map(([k, v]) => ` ${k}="${v}"`).join("");
  return `<${n.tagName}${a}>${n.childNodes.map((c) => dump(c, keep)).join("")}</${n.tagName}>`;
}

/** Home as the page draws it: the header, the board of widgets, the Watch
 * live tile with its arena slot (the frame's parent, which is kept), the
 * scoreboard beside it. `move` and `score` change between draws. */
function home(move: number, score: string, extra = false): { page: FakeEl; slot: FakeEl } {
  const slot = el("div", { class: "wl-frame", "data-match": "m1" });
  const page = el("main", { id: "page", "data-move": String(move) },
    el("header", { class: "hd" }, `Home · move ${move}`),
    el("section", { class: "board" },
      el("div", { class: "widget", "data-id": "daily" }, el("b", {}, score)),
      el("div", { class: "widget wl", "data-id": "watch", "data-size": "L" },
        el("div", { class: "wl-arena on", "data-match": "m1" }, slot, el("button", { class: "fs" }, "Full screen")),
        el("div", { class: "wl-info" }, el("p", { class: "turn" }, `Turn ${move}`), el("p", { class: "score" }, score))),
      ...(extra ? [el("div", { class: "widget", "data-id": "store" }, "Store")] : [])));
  return { page, slot };
}

describe("patchAround: Home redrawn around the tile's arena frame", () => {
  it("everything but the kept slot becomes the redraw, and the slot is the same node, never removed or moved", () => {
    const { page, slot } = home(9, "18-20");
    const frame = el("iframe", { src: "/live-page/m1" });
    slot.appendChild(frame);
    const parentBefore = slot.parent;
    const next = home(89, "11-20", true);
    expect(run(page, next.page, next.slot)).toBe(false); // the redraw's own slot isn't on the page's path
    expect(run(page, next.page, slot)).toBe(true);
    // The page now reads as the redraw, with our slot (and its frame) in place
    // of the redraw's. The root's own attributes are the caller's to sync
    // (patchArenaTile does; Home's redraw passes a fragment, which has none).
    const want = dump(home(89, "11-20", true).page).replace(/<div class="wl-frame" data-match="m1"><\/div>/, "<KEPT>").replace('data-move="89"', 'data-move="9"');
    expect(dump(page, slot)).toBe(want);
    expect(slot.parent).toBe(parentBefore);
    expect(slot.childNodes).toEqual([frame]);
    expect(frame.parent).toBe(slot);
    // The path's elements kept their place and took the redraw's attributes.
    expect(page.getAttribute("data-move")).toBe("9");
    const board = page.children[1]!;
    expect(board.children.map((c) => c.getAttribute("data-id"))).toEqual(["daily", "watch", "store"]);
    expect(page.children[0]!.childNodes[0]!.text).toBe("Home · move 89");
  });

  it("an attribute the redraw drops is removed from the path's elements", () => {
    const { page, slot } = home(1, "20-20");
    page.children[1]!.children[1]!.setAttribute("data-busy", "1");
    const next = home(2, "19-20");
    expect(run(page, next.page, slot)).toBe(true);
    expect(page.children[1]!.children[1]!.hasAttribute("data-busy")).toBe(false);
    expect(page.children[1]!.children[1]!.getAttribute("data-size")).toBe("L");
  });

  it("a redraw with no twin on the path changes nothing and says so (the caller redraws the plain way)", () => {
    const { page, slot } = home(5, "15-20");
    const before = dump(page);
    // The tile went from L to the compact board: no .wl-arena in the redraw.
    const next = home(6, "14-20");
    const tile = next.page.children[1]!.children[1]!;
    tile.removeChild(tile.children[0]!);
    expect(run(page, next.page, slot)).toBe(false);
    expect(dump(page)).toBe(before);
    // The widget itself is gone (moved off Home): also no twin.
    const gone = home(6, "14-20");
    gone.page.children[1]!.removeChild(gone.page.children[1]!.children[1]!);
    expect(run(page, gone.page, slot)).toBe(false);
    expect(dump(page)).toBe(before);
  });

  it("twins are matched by place among siblings with the same key, not the first with it (render 69)", () => {
    // Two keyless columns of the same class; the frame sits in the second.
    const mk = (a: string, b: string) => {
      const slot = el("div", { class: "slot" });
      const root = el("div", { id: "root" }, el("div", { class: "col" }, el("i", {}, a)), el("div", { class: "col" }, slot, el("i", {}, b)));
      return { root, slot };
    };
    const { root, slot } = mk("left 1", "right 1");
    const next = mk("left 2", "right 2");
    expect(run(root, next.root, slot)).toBe(true);
    const [c1, c2] = root.children;
    expect(c1!.children[0]!.childNodes[0]!.text).toBe("left 2");
    expect(c2!.children[0]).toBe(slot);
    // The second column's own children came from the redraw's second column
    // (the first-with-the-key rule took them from the first, and lost "right 2").
    expect(c2!.children[1]!.childNodes[0]!.text).toBe("right 2");
    // One column fewer in the redraw: no twin for the second, nothing changed.
    const one = el("div", { id: "root" }, el("div", { class: "col" }, el("i", {}, "only")));
    const before = dump(root);
    expect(run(root, one, slot)).toBe(false);
    expect(dump(root)).toBe(before);
  });

  it("syncAttributes copies, changes and removes", () => {
    const a = el("div", { class: "x", "data-a": "1", title: "old" });
    syncAttributes(a as unknown as Element, el("div", { class: "y", title: "old", "data-b": "2" }) as unknown as Element);
    expect(Object.fromEntries(a.attrs)).toEqual({ class: "y", title: "old", "data-b": "2" });
  });
});
