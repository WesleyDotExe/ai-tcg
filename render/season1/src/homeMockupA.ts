// Season 1 Home, mockup A: "the question is the label" (render session 83;
// owner 2026-11-22, plan item 18 step 2: "Home mockup A with its
// navigation"). Fenced off in render/season1/: nothing outside imports it.
//
// What makes A itself (B and C, next session, try other answers):
//   - Every tile wears its one question under its name, at every size, so a
//     tile says what it is for before it says anything else (owner point 11:
//     "the tiles don't clearly say what they are").
//   - Each tile ends in one button: its next action (the spec's `next`), and
//     its corner arrow opens the page that answers the same question in full.
//   - Five places, not nine: Home, My agent, Watch, Cards, Ladder. A rail on
//     a desktop, a tab bar on a phone. Settings sits at the rail's foot.
//   - Home has no top bar: on Home the tiles are the wallet and the bell
//     (Store owns the credits, Notifications the alerts: one home per fact).
//     Every other page has a slim top bar with them, since there are no
//     tiles there.
//   - Edit board puts S / M / L and move buttons on every tile (the owner
//     likes customising and moving tiles; this keeps it).
//
// Pure: data in, an HTML string out (the page's own script only places the
// pre-drawn tiles and switches pages). The data is the real Season 0 owner
// API's answers (season1/mockup/data/home-data.json).

import { ICONS, esc, icon } from "../../src/site/siteModel.js";
import { BACKGROUNDS } from "../../src/site/siteLook.js";
import { TILES, type Size } from "./homeSpec.js";
import { homeArt, nextAction, tileFacts, type HomeData, type OwnerData } from "./homeFacts.js";

/** A's five places, and what each holds. `from` lists the tiles whose
 * arrow lands there; the spec's page ids (Season 0's) map onto them. */
export const A_PAGES = [
  { id: "home", name: "Home", icon: "home", holds: ["your tiles"], from: [] as string[] },
  { id: "agent", name: "My agent", icon: "match", holds: ["Start / Stop and play time", "personality and deck", "match history, replays and logs", "connect or add an agent"], from: ["agent", "history"] },
  { id: "watch", name: "Watch", icon: "eye", holds: ["the featured match, full screen", "every live match", "play-by-play and chat"], from: ["watch"] },
  { id: "cards", name: "Cards", icon: "col", holds: ["Packs: open the packs you have", "Store: buy packs and cosmetics", "Collection: the binder, salvage and crafting"], from: ["packs", "store", "collection"] },
  { id: "ladder", name: "Ladder", icon: "trophy", holds: ["the ladder and your place", "your rating, form and stats", "today's earnings"], from: ["ladder", "daily"] },
] as const;
export type APage = (typeof A_PAGES)[number]["id"] | "settings" | "alerts";

/** The spec's page ids (Season 0's) on A's places. */
export const A_OPENS: Record<string, APage> = { match: "agent", stats: "ladder", live: "watch", store: "cards", collection: "cards", bell: "alerts", music: "home" };

/** The spec's arrow label for each tile, in A's words. */
const OPEN_LABEL: Record<string, string> = { agent: "Open My agent", ladder: "Open Ladder", watch: "Open Watch", packs: "Open Packs in Cards", store: "Open Store in Cards", collection: "Open Collection in Cards", daily: "Open earnings in Ladder", history: "Open match history in My agent", notif: "Open all alerts", music: "Music (waiting on owner)" };
const TILE_ICON: Record<string, string> = { agent: ICONS.match, ladder: ICONS.trophy, watch: ICONS.eye, packs: ICONS.spark, store: ICONS.store, collection: ICONS.col, daily: ICONS.stats, history: ICONS.list, notif: ICONS.bell, music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>' };
const svg = (paths: string, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/** A board: tiles in order, each at a size. */
export type Board = { tile: string; size: Size }[];

/** A's recommended first board (the same for every owner; the words in it
 * change with the owner's state). Nine tiles; Music waits on its spec. */
export const A_RECOMMENDED: Board = [
  { tile: "agent", size: "M" },
  { tile: "watch", size: "M" },
  { tile: "packs", size: "S" },
  { tile: "daily", size: "S" },
  { tile: "ladder", size: "M" },
  { tile: "collection", size: "S" },
  { tile: "history", size: "M" },
  { tile: "store", size: "S" },
  { tile: "notif", size: "S" },
];
export const A_BOARDS: Record<string, Board> = {
  recommended: A_RECOMMENDED,
  S: TILES.map((t) => ({ tile: t.id, size: "S" as Size })),
  M: TILES.map((t) => ({ tile: t.id, size: "M" as Size })),
  L: TILES.map((t) => ({ tile: t.id, size: "L" as Size })),
};

/** One tile, drawn at one size for one owner. */
export function tileHtml(tileId: string, size: Size, d: OwnerData): string {
  const t = TILES.find((x) => x.id === tileId)!;
  const act = nextAction(t, size, d);
  const opens = A_OPENS[t.opens] ?? (t.opens as APage);
  const waiting = t.status === "waiting on owner";
  const facts = tileFacts(t, size, d);
  const isAct = (f: string) => f.startsWith('<div class="fx act"');
  return `<article class="tile t-${size}${waiting ? " waiting" : ""}" data-tile="${t.id}" data-size="${size}" aria-labelledby="h-${t.id}">` +
    `<header><span class="ic">${svg(TILE_ICON[t.id] ?? ICONS.spark)}</span><h3 id="h-${t.id}">${esc(t.name)}</h3>` +
    (waiting ? `<span class="wo">Waiting on owner</span>` : `<a class="open" href="#/${opens}" data-go="${opens}" aria-label="${esc(OPEN_LABEL[t.id] ?? "Open")}">${svg(ICONS.arrow, 16)}</a>`) +
    `<span class="edit" hidden><button type="button" data-mv="-1" aria-label="Move ${esc(t.name)} earlier">↑</button><button type="button" data-mv="1" aria-label="Move ${esc(t.name)} later">↓</button>${(["S", "M", "L"] as Size[]).map((s) => `<button type="button" data-sz="${s}" aria-pressed="${s === size}">${s}</button>`).join("")}</span></header>` +
    `<p class="q">${esc(t.question)}</p>` +
    `<div class="body">${facts.filter((f) => !isAct(f)).join("")}</div>` +
    // The next action: a fact that is itself the action (My agent's Start /
    // Stop) stands in the footer; otherwise the spec's next, as one button.
    `<footer>${facts.some(isAct) ? facts.filter(isAct).join("") : `<button type="button" class="btn ${act.primary ? "pri" : ""}" data-go="${act.to}"${act.disabled ? " disabled" : ""}>${esc(act.label)}</button>`}</footer>` +
    `</article>`;
}

/** Every tile at every size, for one owner (the page places them). */
export function ownerTiles(d: OwnerData): Record<string, Record<Size, string>> {
  const out: Record<string, Record<Size, string>> = {};
  for (const t of TILES) out[t.id] = { S: tileHtml(t.id, "S", d), M: tileHtml(t.id, "M", d), L: tileHtml(t.id, "L", d) };
  return out;
}

const rgb = (c: readonly number[]) => `rgb(${c.map((x) => Math.round(x * 255)).join(",")})`;

export function mockupAPage(data: HomeData): string {
  const owners: Record<string, { name: string; tiles: Record<string, Record<Size, string>>; shell: { credits: number; packPoints: number; unread: number; initial: string } }> = {};
  for (const [login, d] of Object.entries(data.owners)) {
    owners[login] = { name: d.me.name, tiles: ownerTiles(d), shell: { credits: d.wallet.credits, packPoints: d.wallet.packPoints, unread: d.notifications.unread, initial: d.me.name.charAt(0).toUpperCase() } };
  }
  const g = BACKGROUNDS.glacier as unknown as { light: number[][]; dark: number[][] };
  const pages = A_PAGES.map((p) => ({ ...p, from: [...p.from].map((id) => TILES.find((t) => t.id === id)!.name) }));
  const payload = JSON.stringify({ owners, boards: A_BOARDS, pages, takenAt: data.takenAt }).replace(/</g, "\\u003c");
  const art = homeArt();
  const rail = A_PAGES.map((p) => `<a href="#/${p.id}" data-go="${p.id}" class="nav" aria-label="${p.name}">${icon(p.icon as keyof typeof ICONS, 22)}<span>${p.name}</span></a>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Season 1 Home, mockup A</title>
<style>
:root { color-scheme: dark; --ink: #eef1ff; --muted: #a3acd0; --line: rgba(255,255,255,.1); --accent: #6f86ff; --accent2: #8b5cff;
  --glass: rgba(24,28,66,.46); --glass-edge: rgba(255,255,255,.12); --shadow: 0 10px 34px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.14);
  --soft: rgba(255,255,255,.08); --ok: #4fd98a; --live: #ff5d7a; --warn: #f0a54a;
  --bg: radial-gradient(1200px 800px at 15% 10%, ${rgb(g.dark[1]!)}, transparent 60%), radial-gradient(900px 700px at 85% 30%, ${rgb(g.dark[2]!)}, transparent 60%), radial-gradient(1000px 900px at 50% 100%, ${rgb(g.dark[3]!)}, transparent 60%), ${rgb(g.dark[0]!)}; }
:root[data-theme="light"] { color-scheme: light; --ink: #141a33; --muted: #4f5a78; --line: rgba(60,70,120,.14); --accent: #4f6bff;
  --glass: rgba(255,255,255,.5); --glass-edge: rgba(255,255,255,.7); --shadow: 0 10px 34px rgba(50,40,140,.16), inset 0 1px 0 rgba(255,255,255,.75);
  --soft: rgba(255,255,255,.55); --ok: #1f8f50; --live: #d8304f; --warn: #a85f0c;
  --bg: radial-gradient(1200px 800px at 15% 10%, ${rgb(g.light[1]!)}, transparent 60%), radial-gradient(900px 700px at 85% 30%, ${rgb(g.light[2]!)}, transparent 60%), radial-gradient(1000px 900px at 50% 100%, ${rgb(g.light[3]!)}, transparent 60%), ${rgb(g.light[0]!)}; }
* { box-sizing: border-box; }
html { background: var(--bg); min-height: 100%; }
html, body { margin: 0; }
body { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); min-height: 100vh; }
button { font: inherit; color: inherit; }
.mock { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; padding: 6px 16px; font-size: 12px; color: var(--muted); border-bottom: 1px dashed var(--line); background: rgba(0,0,0,.25); }
:root[data-theme="light"] .mock { background: rgba(255,255,255,.35); }
.mock b { color: var(--ink); } .mock .seg { display: inline-flex; gap: 2px; } .mock button { border: 1px solid var(--line); background: transparent; border-radius: 6px; padding: 2px 8px; cursor: pointer; }
.mock button[aria-pressed="true"] { background: var(--accent); color: #fff; border-color: transparent; }
.app { display: grid; grid-template-columns: 92px minmax(0, 1fr); min-height: calc(100vh - 31px); }
/* The rail's glass runs the page's full height (owner 2026-11-22: it stopped short); its contents stay in view. */
.rail { background: var(--glass); border-right: 1px solid var(--glass-edge); backdrop-filter: blur(18px); }
.rail-in { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 0; }
.logo { font-weight: 800; letter-spacing: .04em; font-size: 13px; margin-bottom: 12px; text-align: center; line-height: 1.1; }
.logo i { display: block; font-style: normal; color: var(--accent); font-size: 18px; }
.nav { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 76px; padding: 9px 0 7px; border-radius: 14px; color: var(--muted); text-decoration: none; font-size: 11.5px; font-weight: 600; }
.nav:hover { color: var(--ink); background: var(--soft); }
.nav[aria-current="page"] { color: var(--ink); background: linear-gradient(135deg, rgba(111,134,255,.32), rgba(139,92,255,.26)); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
.rail-in .foot { margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.acct { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; }
main { padding: 22px 26px 40px; min-width: 0; }
.top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; min-height: 40px; }
.top h1 { font-size: 24px; margin: 0; letter-spacing: -.01em; }
.top .sp { flex: 1; }
.wallet, .bell { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; background: var(--glass); border: 1px solid var(--glass-edge); font-weight: 600; text-decoration: none; color: inherit; }
.bell b { background: var(--live); color: #fff; border-radius: 999px; padding: 0 6px; font-size: 11px; }
.btn { border: 1px solid var(--glass-edge); background: var(--soft); border-radius: 10px; padding: 8px 14px; font-weight: 650; cursor: pointer; white-space: nowrap; }
.btn.pri { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; border-color: transparent; }
.btn.sm { padding: 4px 10px; font-size: 12.5px; border-radius: 8px; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 186px; grid-auto-flow: row dense; gap: 14px; }
.tile { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; padding: 12px 14px 12px; border-radius: 18px; background: var(--glass); border: 1px solid var(--glass-edge); box-shadow: var(--shadow); backdrop-filter: blur(18px); overflow: hidden; }
.t-S { grid-column: span 1; grid-row: span 1; } .t-M { grid-column: span 2; grid-row: span 2; } .t-L { grid-column: span 4; grid-row: span 2; }
.tile[data-tile="watch"].t-M { grid-column: span 1; grid-row: span 3; } .tile[data-tile="watch"].t-L { grid-column: span 2; grid-row: span 3; }
.tile header { display: flex; align-items: center; gap: 8px; }
.tile .ic { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 9px; background: var(--soft); color: var(--accent); }
.tile h3 { margin: 0; font-size: 15px; font-weight: 750; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.open { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; color: var(--muted); }
.open:hover { background: var(--soft); color: var(--ink); }
.wo { font-size: 11px; font-weight: 700; color: var(--warn); border: 1px solid currentColor; border-radius: 999px; padding: 1px 8px; }
.edit { display: inline-flex; gap: 2px; } .edit[hidden] { display: none; } .edit button { border: 1px solid var(--line); background: var(--soft); border-radius: 6px; padding: 1px 6px; font-size: 11px; cursor: pointer; }
.edit button[aria-pressed="true"] { background: var(--accent); color: #fff; }
.editing .tile { outline: 1.5px dashed var(--accent); outline-offset: -4px; }
.q { margin: 2px 0 6px 36px; font-size: 12.5px; color: var(--muted); line-height: 1.3; }
.t-S .q { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 7px; }
.t-M .body, .t-L .body { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); align-content: start; gap: 8px 16px; }
.t-L .body { grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 6px 16px; }
.al li { flex-wrap: nowrap; } .al li > span { min-width: 0; }
.tile[data-tile="watch"] .body { display: flex; }
.tile[data-tile="watch"].t-L .body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto 1fr; }
.tile[data-tile="watch"].t-L [data-fact="liveArena"] { grid-row: span 2; }
.t-S .body { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
.tile footer { display: flex; justify-content: flex-end; padding-top: 8px; }
.t-S footer { padding-top: 4px; }
.fx { min-width: 0; }
.fx.row { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
.fx.row.wrap { flex-wrap: wrap; }
.fx.kv { display: flex; flex-direction: column; gap: 2px; } .fx.blk { display: flex; flex-direction: column; gap: 4px; }
/* Lists read across the whole tile at M; at L they take two columns. */
.t-M :is([data-fact="recentMatches"], [data-fact="alerts"], [data-fact="winSchedule"], [data-fact="lastPulls"], [data-fact="bestCards"], [data-fact="cosmetics"]) { grid-column: 1 / -1; }
.t-L :is([data-fact="recentMatches"], [data-fact="alerts"], [data-fact="personality"], [data-fact="cosmetics"], [data-fact="lastPulls"]) { grid-column: span 2; }
.t-L :is(.al, .styles) { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 16px; }
.fx.act { display: flex; }
[data-fact="agentStatus"] { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.lab { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); font-weight: 700; }
.big { font-size: 26px; font-weight: 800; letter-spacing: -.02em; line-height: 1.05; }
.t-S .big { font-size: 22px; }
.sub { color: var(--muted); font-size: 12.5px; }
.ava { width: 34px; height: 34px; flex: none; color: #dfe6ff; } .ava svg { width: 100%; height: 100%; display: block; }
.t-S .ava { width: 28px; height: 28px; } .t-S [data-fact="agentName"] .big { font-size: 17px; }
.pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-weight: 700; font-size: 12.5px; background: var(--soft); }
.pill.live { color: var(--live); box-shadow: inset 0 0 0 1px var(--live); } .pill.ok { color: var(--ok); box-shadow: inset 0 0 0 1px var(--ok); } .pill.warn { color: var(--warn); box-shadow: inset 0 0 0 1px var(--warn); }
.tier { display: inline-block; padding: 2px 10px; border-radius: 999px; font-weight: 750; color: var(--tc); box-shadow: inset 0 0 0 1.5px var(--tc); }
.tier.sm { font-size: 11px; padding: 0 7px; margin-left: auto; }
.bar { display: block; height: 6px; border-radius: 999px; background: var(--soft); overflow: hidden; flex: 1 1 100%; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: inherit; }
.up { color: var(--ok); font-weight: 700; } .down { color: var(--warn); font-weight: 700; }
.dots { display: flex; gap: 3px; flex-wrap: wrap; }
.dot { width: 18px; height: 18px; border-radius: 5px; display: grid; place-items: center; font-style: normal; font-size: 10px; font-weight: 800; background: var(--soft); }
.dot.win { background: rgba(79,217,138,.22); color: var(--ok); } .dot.loss { background: rgba(240,165,74,.2); color: var(--warn); }
.lad, .list, .steps, .bars, .styles { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.lad li { display: flex; gap: 8px; align-items: center; padding: 3px 8px; border-radius: 8px; background: var(--soft); }
.lad li span { margin-left: auto; color: var(--muted); } .lad li.me { box-shadow: inset 0 0 0 1px var(--accent); }
.list li { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.list .price { margin-left: auto; font-weight: 650; }
.mh li { flex-wrap: nowrap; } .mh li > span:nth-child(2) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.res { font-weight: 800; } .res.win { color: var(--ok); } .res.loss { color: var(--warn); }
.mh .res { width: 20px; }
.al li.new::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex: none; align-self: center; }
.to { color: var(--accent); font-weight: 650; text-decoration: none; cursor: pointer; font-size: 12.5px; }
.to::after { content: " →"; }
.steps { flex-direction: row; flex-wrap: wrap; gap: 4px; } .steps li { padding: 4px 8px; border-radius: 8px; background: var(--soft); display: flex; flex-direction: column; font-size: 12px; }
.steps li.done { opacity: .55; } .steps li.now { box-shadow: inset 0 0 0 1.5px var(--accent); }
.bars li { display: grid; grid-template-columns: 62px 1fr auto; gap: 8px; align-items: center; font-size: 12.5px; }
.styles li { font-size: 12px; color: var(--muted); } .styles li b { color: var(--ink); } .styles li.on b::after { content: " ✓"; color: var(--ok); }
.chips { display: flex; flex-wrap: wrap; gap: 4px; } .chip { padding: 2px 8px; border-radius: 999px; background: var(--soft); font-size: 12px; }
.why { display: inline; } .why summary { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; background: var(--soft); font-size: 10.5px; cursor: pointer; list-style: none; }
.why summary::-webkit-details-marker { display: none; } .why[open] > span { display: block; font-size: 12px; color: var(--muted); margin-top: 3px; }
.cards { display: flex; gap: 6px; flex-wrap: wrap; }
.mcard { --fc: #999; position: relative; display: inline-flex; flex-direction: column; justify-content: flex-end; flex: none; width: 46px; aspect-ratio: 5 / 7; border-radius: 6px; overflow: hidden; color: #fff; font-style: normal;
  background: radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--fc) 75%, #fff 10%), transparent 55%), linear-gradient(160deg, color-mix(in srgb, var(--fc) 55%, #0b0f22), #0b0f22 80%); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.18); }
.mcard.mc-m { width: 76px; border-radius: 8px; }
.mcard.r-uncommon { box-shadow: inset 0 0 0 1.5px #b8c3d6; } .mcard.r-rare { box-shadow: inset 0 0 0 2px #f6c445; } .mcard.r-mythic { box-shadow: inset 0 0 0 2px #e57bff, 0 0 10px rgba(229,123,255,.45); }
.mcard.shine::after { content: ""; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.35) 45%, transparent 60%); }
.mcard i { font-style: normal; }
.mcc { position: absolute; top: 3px; left: 3px; width: 15px; height: 15px; border-radius: 50%; background: rgba(0,0,0,.55); font-size: 9.5px; font-weight: 800; display: grid; place-items: center; }
.mca { position: absolute; inset: 22% 12% 38%; border-radius: 4px; background: repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 3px, transparent 3px 7px); }
.mcn { padding: 0 4px 2px; font-size: 7.5px; font-weight: 700; line-height: 1.1; text-shadow: 0 1px 2px #000; } .mc-m .mcn { font-size: 10px; }
.mcs { padding: 0 4px 3px; font-size: 7.5px; opacity: .8; } .mc-m .mcs { font-size: 9.5px; }
.mcf { position: absolute; top: 3px; right: 3px; font-size: 7px; font-weight: 800; background: rgba(0,0,0,.6); padding: 0 3px; border-radius: 3px; }
.vs { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 8px; align-items: center; }
.vs .side { display: flex; flex-direction: column; gap: 2px; min-width: 0; } .vs .side b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--fc); }
.vs .side:last-child { text-align: right; } .vsx { text-align: center; font-weight: 800; color: var(--muted); font-size: 12px; line-height: 1.1; }
.hp { display: block; height: 5px; border-radius: 999px; background: var(--soft); overflow: hidden; } .hp i { display: block; height: 100%; background: var(--fc); }
.vs .side:last-child .hp { transform: scaleX(-1); }
.t-S .vs .sub:nth-of-type(1) { display: none; }
.arena916 { position: relative; aspect-ratio: 9 / 16; height: 100%; max-height: 100%; max-width: 100%; margin: 0 auto; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 8px;
  background: radial-gradient(ellipse 70% 30% at 50% 50%, rgba(111,134,255,.35), transparent 70%), linear-gradient(180deg, #0b1030, #141a44 50%, #0b1030); box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); color: #eef1ff; }
.arena916.empty { display: grid; place-items: center; text-align: center; color: var(--muted); }
[data-fact="liveArena"] { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 4px; }
.ahud { display: flex; flex-direction: column; font-size: 10.5px; } .ahud b { font-size: 12px; } .ahud span { opacity: .75; }
.arow { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
.unit { width: 46px; aspect-ratio: 5 / 7; border-radius: 6px; padding: 3px; display: flex; flex-direction: column; justify-content: space-between; font-style: normal; font-size: 8px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--fc) 60%, #0b0f22), #0b0f22); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fc) 70%, #fff 0%); }
.unit i { font-style: normal; font-weight: 700; line-height: 1.1; } .unit b { align-self: flex-end; font-size: 10px; } .unit.pend { opacity: .55; }
.none { font-size: 10px; opacity: .5; }
.disc { text-align: center; font-size: 10.5px; padding: 6px; border-radius: 999px; background: rgba(255,255,255,.07); }
.proto { position: absolute; left: 50%; top: 50%; transform: translate(-50%, 18px); white-space: nowrap; font-size: 9.5px; opacity: .55; }
.flash { animation: flash 1.6s ease-out 1; } @keyframes flash { 0% { box-shadow: 0 0 0 3px var(--accent), var(--shadow); } 100% { box-shadow: var(--shadow); } }
${art.css}
.tile .si { width: 104px; padding: 5px; } .tile .si-art { height: 74px; } .tile .si-art .sh-emb { width: 48px; height: 48px; }
.tile[data-tile="store"]:not(.t-S) .body { display: grid; grid-template-columns: max-content minmax(0, 1fr); grid-template-rows: auto auto 1fr; gap: 4px 18px; align-content: start; }
.tile[data-tile="store"]:not(.t-S) [data-fact="credits"], .tile[data-tile="store"]:not(.t-S) [data-fact="affordable"] { grid-column: 1; }
.tile[data-tile="store"]:not(.t-S) [data-fact="affordable"] { max-width: 230px; }
.tile[data-tile="store"]:not(.t-S) [data-fact="buyPacks"] { grid-column: 1; grid-row: 3; }
.tile[data-tile="store"]:not(.t-S) [data-fact="cosmetics"] { grid-column: 2; grid-row: 1 / span 3; }
.tile[data-tile="store"].t-L .body { grid-template-columns: max-content max-content minmax(0, 1fr); grid-template-rows: auto 1fr; }
.tile[data-tile="store"].t-L [data-fact="buyPacks"] { grid-column: 2; grid-row: 1 / span 2; }
.tile[data-tile="store"].t-L [data-fact="cosmetics"] { grid-column: 3; grid-row: 1 / span 2; flex-direction: row; flex-wrap: wrap; align-content: flex-start; gap: 4px 18px; }
.tile[data-tile="store"].t-L [data-fact="cosmetics"] > .sub { flex-basis: 100%; }
.pg { padding: 18px 20px; border-radius: 18px; background: var(--glass); border: 1px solid var(--glass-edge); box-shadow: var(--shadow); max-width: 760px; }
.pg h2 { margin: 0 0 6px; } .pg ul { margin: 6px 0 12px; } .pg .sub { display: block; }
.tabs { display: none; }
@media (max-width: 1180px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .t-L { grid-column: span 2; } .tile[data-tile="watch"].t-L { grid-column: span 2; } }
@media (max-width: 720px) {
  .app { grid-template-columns: minmax(0, 1fr); min-height: 0; }
  .rail { display: none; }
  main { padding: 14px 16px 88px; }
  .top h1 { font-size: 21px; }
  .grid { grid-template-columns: minmax(0, 1fr); grid-auto-rows: auto; gap: 10px; }
  .t-S, .t-M, .t-L, .tile[data-tile="watch"].t-M, .tile[data-tile="watch"].t-L { grid-column: span 1; grid-row: auto; }
  .tile { padding: 11px 12px; }
  .t-M .body, .t-L .body, .tile[data-tile="watch"].t-L .body { grid-template-columns: minmax(0, 1fr); }
  .tile[data-tile="watch"]:not(.t-S) .body { display: flex; }
  .arena916 { height: auto; width: min(100%, 300px); }
  .edit button[data-sz] { display: none; }
  .tabs { display: flex; position: fixed; z-index: 5; left: 0; right: 0; bottom: 0; justify-content: space-around; padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); background: var(--glass); border-top: 1px solid var(--glass-edge); backdrop-filter: blur(18px); }
  .tabs .nav { width: auto; flex: 1; font-size: 10.5px; padding: 6px 0 4px; }
}
</style></head><body>
<div class="mock" role="region" aria-label="Mockup controls (not part of the design)">
  <b>Mockup A · the question is the label</b>
  <span>Owner <span class="seg" id="m-owner">${Object.entries(owners).map(([k, o], i) => `<button type="button" data-owner="${k}" aria-pressed="${i === 0}">${esc(o.name)}</button>`).join("")}</span></span>
  <span>Board <span class="seg" id="m-board"><button type="button" data-board="recommended" aria-pressed="true">Recommended</button><button type="button" data-board="S" aria-pressed="false">All S</button><button type="button" data-board="M" aria-pressed="false">All M</button><button type="button" data-board="L" aria-pressed="false">All L</button></span></span>
  <span>Theme <span class="seg" id="m-theme"><button type="button" data-theme="dark" aria-pressed="true">Dark</button><button type="button" data-theme="light" aria-pressed="false">Light</button></span></span>
  <span>Data: the Season 0 site demo's owner API, read ${esc(data.takenAt.slice(0, 10))}</span>
</div>
<div class="app">
  <nav class="rail" aria-label="Main"><div class="rail-in"><div class="logo"><i>◈</i>AI-TCG</div>${rail}<div class="foot"><a href="#/settings" data-go="settings" class="nav" aria-label="Settings">${icon("gear", 20)}<span>Settings</span></a><span class="acct" id="acct"></span></div></div></nav>
  <main id="main"></main>
</div>
<nav class="tabs" aria-label="Main (phone)">${rail}</nav>
${art.defs}
<script id="data" type="application/json">${payload}</script>
<script>${art.script}</script>
<script>
(() => {
  const D = JSON.parse(document.getElementById('data').textContent);
  const q = new URLSearchParams(location.search);
  const st = { owner: q.get('owner') in D.owners ? q.get('owner') : Object.keys(D.owners)[0], boardName: D.boards[q.get('board')] ? q.get('board') : 'recommended', editing: false };
  st.board = D.boards[st.boardName].map((x) => ({ ...x }));
  const main = document.getElementById('main');
  const theme = q.get('theme') === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  const page = () => (location.hash.replace(/^#\\/?/, '') || 'home');
  const press = (sel, attr, v) => document.querySelectorAll(sel + ' button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === v)));
  function topBar(title) {
    const o = D.owners[st.owner];
    if (title === 'Home') return '<div class="top"><h1>Home</h1><span class="sp"></span><button type="button" class="btn" id="edit" aria-pressed="' + st.editing + '">' + (st.editing ? 'Done' : 'Edit board') + '</button></div>';
    return '<div class="top"><h1>' + title + '</h1><span class="sp"></span><a class="wallet" href="#/cards" data-go="cards">' + o.shell.credits + ' credits · ' + o.shell.packPoints + ' pack points</a><a class="bell" href="#/alerts" data-go="alerts" aria-label="Alerts, ' + o.shell.unread + ' new">Alerts' + (o.shell.unread ? ' <b>' + o.shell.unread + '</b>' : '') + '</a></div>';
  }
  function draw() {
    const o = D.owners[st.owner];
    document.getElementById('acct').textContent = o.shell.initial;
    const p = page();
    document.querySelectorAll('.nav').forEach((a) => { if (a.dataset.go === p) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (p === 'home') {
      // On a phone every tile shows its S face (the core facts), except
      // Watch live, whose 9:16 arena fits a phone as it is (its M).
      const phone = matchMedia('(max-width: 720px)').matches;
      const sizeOn = (b) => (!phone ? b.size : b.tile === 'watch' && b.size !== 'S' ? 'M' : 'S');
      main.innerHTML = topBar('Home') + '<section class="grid' + (st.editing ? ' editing' : '') + '" id="grid" aria-label="Your tiles">' + st.board.map((b) => o.tiles[b.tile][sizeOn(b)]).join('') + '</section>' + (phone && st.editing ? '<p class="sub">Sizes apply on a wider screen; here every tile shows its small face.</p>' : '');
      document.querySelectorAll('.tile .edit').forEach((e) => (e.hidden = !st.editing));
      return;
    }
    const pg = D.pages.find((x) => x.id === p);
    const title = pg ? pg.name : p === 'settings' ? 'Settings' : 'Alerts';
    const holds = pg ? pg.holds : p === 'settings' ? ['the account, sign-in and theme', 'sound and music', 'which alerts you get', 'the house admin (when you are)'] : ['every alert, newest first, by kind', 'each links to the page that owns it'];
    const from = pg ? pg.from : p === 'alerts' ? ['Notifications'] : [];
    main.innerHTML = topBar(title) + '<div class="pg"><h2>' + title + '</h2><span class="sub">Mockup A draws Home only; this page is the navigation\\'s promise: what it holds, and which Home tiles open it.</span><ul>' + holds.map((h) => '<li>' + h + '</li>').join('') + '</ul>' + (from.length ? '<span class="sub">Opened from: ' + from.join(', ') + '.</span>' : '') + '</div>';
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.owner) { st.owner = t.dataset.owner; press('#m-owner', 'owner', st.owner); draw(); return; }
    if (t.dataset.board) { st.boardName = t.dataset.board; st.board = D.boards[st.boardName].map((x) => ({ ...x })); press('#m-board', 'board', st.boardName); draw(); return; }
    if (t.dataset.theme) { document.documentElement.dataset.theme = t.dataset.theme; press('#m-theme', 'theme', t.dataset.theme); return; }
    if (t.id === 'edit') { st.editing = !st.editing; draw(); return; }
    const tile = t.closest('.tile');
    if (tile && (t.dataset.sz || t.dataset.mv)) {
      const i = st.board.findIndex((b) => b.tile === tile.dataset.tile);
      if (t.dataset.sz) st.board[i].size = t.dataset.sz;
      else { const j = Math.max(0, Math.min(st.board.length - 1, i + Number(t.dataset.mv))); const [x] = st.board.splice(i, 1); st.board.splice(j, 0, x); }
      draw(); return;
    }
    if (t.dataset.go) { e.preventDefault(); if (t.dataset.go !== page()) location.hash = '#/' + t.dataset.go; else draw(); }
    if (t.dataset.to) {
      e.preventDefault();
      const to = { packs: 'cards', history: 'agent', collection: 'cards', agent: 'agent' }[t.dataset.to] || 'home';
      if (to !== 'home') { location.hash = '#/' + to; return; }
      // A tile on Home (the free pack's alert goes to Daily rewards): show it.
      const el = document.querySelector('.tile[data-tile="' + t.dataset.to + '"]');
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    }
  });
  window.addEventListener('hashchange', draw);
  matchMedia('(max-width: 720px)').addEventListener('change', draw);
  press('#m-owner', 'owner', st.owner); press('#m-board', 'board', st.boardName); press('#m-theme', 'theme', theme);
  draw();
})();
</script></body></html>`;
}
