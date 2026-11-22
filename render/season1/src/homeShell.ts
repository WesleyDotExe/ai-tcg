// What Season 1 Home mockups B and C share (render session 84): the mockup's
// own control strip, the per-owner payload, and the page script's plumbing
// (owner / board / theme switches, the hash routes, Edit board's size and
// move buttons, the stub pages, and the masonry packing). Mockup A (render
// 83) keeps its own copy as built; B and C differ from it, and from each
// other, only in the look, the tile's anatomy and the navigation.
//
// The masonry packing is the answer to the owner's 2026-11-22 note on A's
// empty space ("a new player's Match history at L, Store and Daily rewards
// at L"): a tile takes its content's height, not a fixed row's, and the
// small tiles fill the holes (grid-auto-flow: dense). Sizes still decide a
// tile's width and which facts it shows (the spec), never a fixed height.
//
// Pure: strings out. Fenced off: nothing outside render/season1/ imports it.

import { esc } from "../../src/site/siteModel.js";
import { TILES, type Size } from "./homeSpec.js";
import type { HomeData, OwnerData } from "./homeFacts.js";

/** A board: tiles in order, each at a size. */
export type Board = { tile: string; size: Size }[];

/** The places every mockup navigates (A's five, kept by the owner's answers
 * to render 83: Cards holds Packs, Store and Collection; Tournament leaves
 * until it exists). `from` lists the tiles whose arrow lands there. */
export const PLACES = [
  { id: "home", name: "Home", icon: "home", holds: ["your tiles"], from: [] as string[] },
  { id: "agent", name: "My agent", icon: "match", holds: ["Start / Stop and play time", "personality and deck", "match history, replays and logs", "connect or add an agent"], from: ["agent", "history"] },
  { id: "watch", name: "Watch", icon: "eye", holds: ["the featured match, full screen", "every live match", "play-by-play and chat"], from: ["watch"] },
  { id: "cards", name: "Cards", icon: "col", holds: ["Packs: open the packs you have", "Store: buy packs and cosmetics", "Collection: the binder, salvage and crafting"], from: ["packs", "store", "collection"] },
  { id: "ladder", name: "Ladder", icon: "trophy", holds: ["the ladder and your place", "your rating, form and stats", "today's earnings"], from: ["ladder", "daily"] },
] as const;
export type Place = (typeof PLACES)[number]["id"] | "settings" | "alerts";

/** The spec's page ids (Season 0's) on the five places. */
export const OPENS: Record<string, Place> = { match: "agent", stats: "ladder", live: "watch", store: "cards", collection: "cards", bell: "alerts", music: "home" };
export const opensOf = (tileId: string): Place => {
  const t = TILES.find((x) => x.id === tileId)!;
  return OPENS[t.opens] ?? (t.opens as Place);
};
/** The arrow's accessible name, per tile. */
export const OPEN_LABEL: Record<string, string> = { agent: "Open My agent", ladder: "Open Ladder", watch: "Open Watch", packs: "Open Packs in Cards", store: "Open Store in Cards", collection: "Open Collection in Cards", daily: "Open earnings in Ladder", history: "Open match history in My agent", notif: "Open all alerts", music: "Music (waiting on owner)" };

/** The "all S / all M / all L" boards, for the mockup strip. */
export function boardsWith(recommended: Board): Record<string, Board> {
  return {
    recommended,
    S: TILES.map((t) => ({ tile: t.id, size: "S" as Size })),
    M: TILES.map((t) => ({ tile: t.id, size: "M" as Size })),
    L: TILES.map((t) => ({ tile: t.id, size: "L" as Size })),
  };
}

export interface OwnerPayload {
  name: string;
  login: string;
  tiles: Record<string, Record<Size, string>>;
  shell: { credits: number; packPoints: number; unread: number; initial: string };
  /** Anything else a mockup's own script needs (C: what needs you). */
  extra?: unknown;
}

/** Every tile at every size for every owner, drawn by a mockup's own tile
 * function. */
export function ownersPayload(data: HomeData, tileFn: (id: string, size: Size, d: OwnerData) => string, extra?: (d: OwnerData) => unknown): Record<string, OwnerPayload> {
  const out: Record<string, OwnerPayload> = {};
  for (const [login, d] of Object.entries(data.owners)) {
    const tiles: Record<string, Record<Size, string>> = {};
    for (const t of TILES) tiles[t.id] = { S: tileFn(t.id, "S", d), M: tileFn(t.id, "M", d), L: tileFn(t.id, "L", d) };
    out[login] = { name: d.me.name, login: d.me.username, tiles, shell: { credits: d.wallet.credits, packPoints: d.wallet.packPoints, unread: d.notifications.unread, initial: d.me.name.charAt(0).toUpperCase() }, extra: extra?.(d) };
  }
  return out;
}

/** The JSON a page reads back (safe inside a script tag). */
export function payloadJson(x: unknown): string {
  return JSON.stringify(x).replace(/</g, "\\u003c");
}

/** The Edit board controls on a tile (hidden until Edit board). */
export function editControls(name: string, size: Size): string {
  return `<span class="edit" hidden><button type="button" data-mv="-1" aria-label="Move ${esc(name)} earlier">↑</button><button type="button" data-mv="1" aria-label="Move ${esc(name)} later">↓</button>${(["S", "M", "L"] as Size[]).map((s) => `<button type="button" data-sz="${s}" aria-pressed="${s === size}">${s}</button>`).join("")}</span>`;
}

/** The mockup's own control strip (not part of the design). */
export function mockStrip(label: string, owners: Record<string, OwnerPayload>, takenAt: string, theme: "light" | "dark"): string {
  return `<div class="mock" role="region" aria-label="Mockup controls (not part of the design)">
  <b>${esc(label)}</b>
  <span>Owner <span class="seg" id="m-owner">${Object.entries(owners).map(([k, o], i) => `<button type="button" data-owner="${k}" aria-pressed="${i === 0}">${esc(o.name)}</button>`).join("")}</span></span>
  <span>Board <span class="seg" id="m-board"><button type="button" data-board="recommended" aria-pressed="true">Recommended</button><button type="button" data-board="S" aria-pressed="false">All S</button><button type="button" data-board="M" aria-pressed="false">All M</button><button type="button" data-board="L" aria-pressed="false">All L</button></span></span>
  <span>Theme <span class="seg" id="m-theme"><button type="button" data-theme="light" aria-pressed="${theme === "light"}">Light</button><button type="button" data-theme="dark" aria-pressed="${theme === "dark"}">Dark</button></span></span>
  <span>Data: the Season 0 site demo's owner API, read ${esc(takenAt.slice(0, 10))}</span>
</div>`;
}

export const MOCK_STRIP_CSS = `
.mock { position: relative; z-index: 20; display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; padding: 6px 16px; font: 12px/1.4 system-ui, sans-serif; color: var(--muted); border-bottom: 1px dashed var(--line); background: rgba(0,0,0,.28); }
:root[data-theme="light"] .mock { background: rgba(255,255,255,.45); }
.mock b { color: var(--ink); } .mock .seg { display: inline-flex; gap: 2px; } .mock button { font: inherit; color: inherit; border: 1px solid var(--line); background: transparent; border-radius: 6px; padding: 2px 8px; cursor: pointer; }
.mock button[aria-pressed="true"] { background: var(--accent); color: #fff; border-color: transparent; }
`;

/** Masonry: a grid of 2 px rows; the script sets each tile's row span from
 * its own height. */
export const MASONRY_CSS = `
.mgrid { display: grid; grid-auto-rows: 2px; row-gap: 0; grid-auto-flow: row dense; align-items: start; }
.mgrid > .tile { margin-bottom: var(--gap); }
`;

/** The page script's shared plumbing: window.SHELL. A mockup's own script
 * then calls SHELL.start(draw), where draw() renders the current page into
 * <main id="main">. */
export const SHELL_SCRIPT = `window.SHELL = (() => {
  const D = JSON.parse(document.getElementById('data').textContent);
  const q = new URLSearchParams(location.search);
  const st = { owner: q.get('owner') in D.owners ? q.get('owner') : Object.keys(D.owners)[0], boardName: D.boards[q.get('board')] ? q.get('board') : 'recommended', editing: false };
  st.board = D.boards[st.boardName].map((x) => ({ ...x }));
  const theme = q.get('theme') === 'light' || q.get('theme') === 'dark' ? q.get('theme') : D.theme;
  document.documentElement.dataset.theme = theme;
  const PHONE = '(max-width: 720px)';
  const phone = () => matchMedia(PHONE).matches;
  const page = () => (location.hash.replace(/^#\\/?/, '') || 'home');
  const press = (sel, attr, v) => document.querySelectorAll(sel + ' button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === v)));
  // On a phone every tile shows its S face, Watch live its 9:16 M (owner's
  // answer to render 83, call 2).
  const sizeOn = (b) => (!phone() ? b.size : b.tile === 'watch' && b.size !== 'S' ? 'M' : 'S');
  function masonry(root) {
    (root || document).querySelectorAll('.mgrid').forEach((g) => {
      const unit = parseFloat(getComputedStyle(g).gridAutoRows) || 2;
      const tiles = [...g.children].filter((t) => t.classList.contains('tile'));
      tiles.forEach((t) => { t.style.gridRowEnd = 'span 1'; });
      tiles.forEach((t) => {
        const gap = parseFloat(getComputedStyle(t).marginBottom) || 0;
        t.style.gridRowEnd = 'span ' + Math.max(1, Math.ceil((t.getBoundingClientRect().height + gap) / unit));
      });
    });
  }
  function stub(title, pg) {
    const holds = pg ? pg.holds : title === 'Settings' ? ['the account, sign-in and theme', 'sound and music', 'which alerts you get', 'the house admin (when you are)'] : ['every alert, newest first, by kind', 'each links to the page that owns it'];
    const from = pg ? pg.from : title === 'Alerts' ? ['Notifications'] : [];
    return '<div class="pg"><h2>' + title + '</h2><span class="sub">This mockup draws Home only; this page is the navigation\\'s promise: what it holds, and which Home tiles open it.</span><ul>' + holds.map((h) => '<li>' + h + '</li>').join('') + '</ul>' + (from.length ? '<span class="sub">Opened from: ' + from.join(', ') + '.</span>' : '') + '</div>';
  }
  const titleOf = (p) => { const pg = D.pages.find((x) => x.id === p); return pg ? pg.name : p === 'settings' ? 'Settings' : 'Alerts'; };
  const TO = { packs: 'cards', history: 'agent', collection: 'cards', agent: 'agent' };
  function start(draw) {
    const redraw = () => { draw(); requestAnimationFrame(() => masonry()); };
    document.addEventListener('click', (e) => {
      const t = e.target.closest('button, a');
      if (!t) return;
      if (t.dataset.owner) { st.owner = t.dataset.owner; press('#m-owner', 'owner', st.owner); redraw(); return; }
      if (t.dataset.board) { st.boardName = t.dataset.board; st.board = D.boards[st.boardName].map((x) => ({ ...x })); press('#m-board', 'board', st.boardName); redraw(); return; }
      if (t.dataset.theme) { document.documentElement.dataset.theme = t.dataset.theme; press('#m-theme', 'theme', t.dataset.theme); return; }
      if (t.id === 'edit') { st.editing = !st.editing; redraw(); return; }
      const tile = t.closest('.tile');
      if (tile && (t.dataset.sz || t.dataset.mv)) {
        const i = st.board.findIndex((b) => b.tile === tile.dataset.tile);
        if (t.dataset.sz) st.board[i].size = t.dataset.sz;
        else { const j = Math.max(0, Math.min(st.board.length - 1, i + Number(t.dataset.mv))); const [x] = st.board.splice(i, 1); st.board.splice(j, 0, x); }
        redraw(); return;
      }
      if (t.dataset.go) { e.preventDefault(); if (t.dataset.go !== page()) location.hash = '#/' + t.dataset.go; else redraw(); return; }
      if (t.dataset.to) {
        e.preventDefault();
        const to = TO[t.dataset.to] || 'home';
        if (to !== 'home') { location.hash = '#/' + to; return; }
        // A tile on Home (the free pack's alert goes to Daily rewards): show it.
        const el = document.querySelector('.tile[data-tile="' + t.dataset.to + '"]');
        if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      }
    });
    window.addEventListener('hashchange', redraw);
    matchMedia(PHONE).addEventListener('change', redraw);
    window.addEventListener('resize', () => masonry());
    press('#m-owner', 'owner', st.owner); press('#m-board', 'board', st.boardName); press('#m-theme', 'theme', theme);
    redraw();
    return { redraw };
  }
  return { D, st, phone, page, sizeOn, masonry, stub, titleOf, start };
})();`;
