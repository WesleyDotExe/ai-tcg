// Season 1 Home, mockup C: "what needs you first" (render session 84;
// owner 2026-11-22, plan item 18 step 3: "Home mockups B and C"). Fenced off
// in render/season1/: nothing outside imports it.
//
// What makes C itself (A says the question first; B leads with the
// headline):
//   - Home orders itself: the tiles that need you now come first, under
//     "Needs you", each saying why in plain words ("A free pack to claim",
//     "Your agent hasn't started yet"); the rest follow under "All quiet".
//     Every reason is read off the server's answers (`needsOf`), never
//     guessed. The owner still picks each tile's size and the order inside
//     each group (Edit board).
//   - The vibe leads (owner 2026-11-22: "a cyberpunk hacker, semi-neo
//     retro-future, virtual world"): the neon night under the glass (a
//     simulation grid running to a horizon, faint scanlines), tiles as HUD
//     panels with cut corners and a neon edge in their colour, a terminal
//     prompt over Home, monospace kickers. Each tile's question is its
//     subtitle, written as a code comment. Labels stay plain words.
//   - The navigation is a console rail down the left, its glass the page's
//     full height (the owner's note on A's rail stopping short): the five
//     places with their keys (1-5), Settings and the account at its foot,
//     and "Jump to" (or "/"), a command palette that finds any place or
//     tile by name. On a phone, a tab bar.
//   - Tiles take their content's height (masonry, homeShell.ts).
//
// Pure: data in, an HTML string out. The data is the real Season 0 owner
// API's answers (season1/mockup/data/home-data.json).

import { ICONS, esc, icon } from "../../src/site/siteModel.js";
import { TILES, type Size } from "./homeSpec.js";
import { homeArt, nextAction, tileFacts, type HomeData, type OwnerData } from "./homeFacts.js";
import { MASONRY_CSS, MOCK_STRIP_CSS, OPEN_LABEL, PLACES, SHELL_SCRIPT, boardsWith, editControls, mockStrip, opensOf, ownersPayload, payloadJson, type Board } from "./homeShell.js";

/** Each tile's neon (its edge, its icon, its glow): the faction neons and
 * rarity light of the art plan's palette, one per tile. */
export const C_TONE: Record<string, string> = { agent: "#35c9ff", ladder: "#ffcf5c", watch: "#ff4d8d", packs: "#d565ff", store: "#ffb347", collection: "#8b7bff", daily: "#8bff5c", history: "#59a8ff", notif: "#ff7d24", music: "#fff0c2" };
const TILE_ICON: Record<string, string> = { agent: ICONS.match, ladder: ICONS.trophy, watch: ICONS.eye, packs: ICONS.spark, store: ICONS.store, collection: ICONS.col, daily: ICONS.stats, history: ICONS.list, notif: ICONS.bell, music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>' };
const svg = (paths: string, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/** C's recommended board (its order is the order inside each group). */
export const C_RECOMMENDED: Board = [
  { tile: "agent", size: "M" },
  { tile: "daily", size: "S" },
  { tile: "packs", size: "S" },
  { tile: "watch", size: "M" },
  { tile: "notif", size: "M" },
  { tile: "store", size: "M" },
  { tile: "ladder", size: "M" },
  { tile: "history", size: "M" },
  { tile: "collection", size: "S" },
];
export const C_BOARDS = boardsWith(C_RECOMMENDED);

/** A tile that needs the owner now, and why, in plain words. */
export interface Need { tile: string; why: string }

/** What needs the owner now, most urgent first. Each reason is a state the
 * server reported (the tile's own facts say the details); nothing is a
 * guess at what the owner wants. */
export function needsOf(d: OwnerData): Need[] {
  const out: Need[] = [];
  if (d.dailyPack.waiting > 0) out.push({ tile: "daily", why: "A free pack to claim" });
  const ap = d.play.autoPlay;
  if (!ap.on && !d.play.liveMatch) {
    if (d.matches.total === 0) out.push({ tile: "agent", why: "Your agent hasn't started yet" });
    else if (ap.dailyRewardsMaxed) { /* done for today: nothing to do */ }
    else if (ap.stopped) out.push({ tile: "agent", why: "Your agent ran out of play time" });
    else out.push({ tile: "agent", why: "Your agent is stopped" });
  }
  if (d.play.liveMatch) out.push({ tile: "watch", why: "Your agent is playing now" });
  if (d.packs.unopened.length) out.push({ tile: "packs", why: "Packs to open" });
  if (d.notifications.unread) out.push({ tile: "notif", why: "New alerts" });
  const cheapest = Math.min(d.packs.offer[0]?.priceCredits ?? Infinity, ...d.store.cosmetics.filter((c) => !c.owned).map((c) => c.priceCredits));
  if (d.wallet.credits >= cheapest) out.push({ tile: "store", why: "Your credits can buy something" });
  return out;
}

/** One tile, drawn at one size for one owner. */
export function tileHtml(tileId: string, size: Size, d: OwnerData): string {
  const t = TILES.find((x) => x.id === tileId)!;
  const act = nextAction(t, size, d);
  const opens = opensOf(t.id);
  const waiting = t.status === "waiting on owner";
  const facts = tileFacts(t, size, d);
  const isAct = (f: string) => f.startsWith('<div class="fx act"');
  const need = needsOf(d).find((n) => n.tile === t.id);
  const tone = C_TONE[t.id] ?? "#8b7bff";
  return `<article class="tile s-${size}${need ? " need" : ""}${waiting ? " waiting" : ""}" data-tile="${t.id}" data-size="${size}" style="--c:${tone}" aria-labelledby="h-${t.id}">` +
    (need ? `<span class="nd"><i aria-hidden="true">▸</i> <span class="vh">Needs you: </span>${esc(need.why)}</span>` : "") +
    `<header><span class="ic">${svg(TILE_ICON[t.id] ?? ICONS.spark)}</span><div class="hd"><h3 id="h-${t.id}">${esc(t.name)}</h3><p class="q">${esc(t.question)}</p></div>` +
    (waiting ? `<span class="wo">Waiting on owner</span>` : `<a class="open" href="#/${opens}" data-go="${opens}" aria-label="${esc(OPEN_LABEL[t.id] ?? "Open")}">${svg(ICONS.arrow, 16)}</a>`) +
    editControls(t.name, size) + `</header>` +
    `<div class="body">${facts.filter((f) => !isAct(f)).join("")}</div>` +
    `<footer>${facts.some(isAct) ? facts.filter(isAct).join("") : `<button type="button" class="btn ${act.primary ? "pri" : ""}" data-go="${act.to}"${act.disabled ? " disabled" : ""}>${esc(act.label)}</button>`}</footer>` +
    `</article>`;
}

export function mockupCPage(data: HomeData): string {
  const owners = ownersPayload(data, tileHtml, (d) => ({ needs: needsOf(d) }));
  const pages = PLACES.map((p) => ({ ...p, from: [...p.from].map((id) => TILES.find((t) => t.id === id)!.name) }));
  const jump = [...PLACES.map((p) => ({ label: p.name, kind: "Place", go: p.id })), { label: "Settings", kind: "Place", go: "settings" }, ...TILES.filter((t) => t.status === "decided").map((t) => ({ label: t.name, kind: "Tile on Home", go: "tile:" + t.id }))];
  const art = homeArt();
  const payload = payloadJson({ owners, boards: C_BOARDS, pages, takenAt: data.takenAt, theme: "dark", jump });
  const rail = PLACES.map((p, i) => `<a href="#/${p.id}" data-go="${p.id}" class="nav">${icon(p.icon as keyof typeof ICONS, 20)}<span>${p.name}</span><kbd>${i + 1}</kbd></a>`).join("");
  const tabs = PLACES.map((p) => `<a href="#/${p.id}" data-go="${p.id}" class="nav">${icon(p.icon as keyof typeof ICONS, 20)}<span>${p.name}</span></a>`).join("");
  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Season 1 Home, mockup C</title>
<style>
:root { color-scheme: dark; --ink: #e9edff; --muted: #9aa5d4; --line: rgba(160,170,255,.14); --accent: #6f7bff; --accent2: #b45cff; --gap: 16px;
  --base: #05060d; --panel: rgba(13,17,42,.66); --panel-edge: rgba(150,160,255,.16); --soft: rgba(255,255,255,.07); --ok: #6dffa8; --live: #ff5d8f; --warn: #ffb347;
  --grid: rgba(138,123,255,.42); --glow: rgba(138,123,255,.32); --scan: rgba(255,255,255,.018); --rail: rgba(8,10,28,.72); }
:root[data-theme="light"] { color-scheme: light; --ink: #121735; --muted: #4c5680; --line: rgba(60,70,140,.15); --accent: #4f5bff; --accent2: #8b3cff;
  --base: #e6e9f7; --panel: rgba(255,255,255,.66); --panel-edge: rgba(90,100,200,.2); --soft: rgba(60,70,160,.07); --ok: #138a4c; --live: #d8306a; --warn: #a65a00;
  --grid: rgba(90,80,220,.22); --glow: rgba(139,92,255,.18); --scan: rgba(40,40,120,.02); --rail: rgba(255,255,255,.62); }
* { box-sizing: border-box; }
html { background: var(--base); min-height: 100%; }
html, body { margin: 0; }
body { position: relative; font: 14px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif; color: var(--ink); min-height: 100vh; }
.app { display: grid; grid-template-columns: 216px minmax(0, 1fr); min-height: calc(100vh - 31px); }
button { font: inherit; color: inherit; }
/* The neon night: a simulation grid running to a horizon, the horizon's glow, faint scanlines. Static. */
.world { position: absolute; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
.world::before { content: ""; position: absolute; left: -50%; right: -50%; bottom: -8vh; height: min(62vh, 70%); transform: perspective(360px) rotateX(64deg); transform-origin: 50% 100%;
  background: linear-gradient(var(--grid) 1.5px, transparent 1.5px) 0 0 / 64px 64px, linear-gradient(90deg, var(--grid) 1.5px, transparent 1.5px) 0 0 / 64px 64px; mask: linear-gradient(transparent, #000 55%); }
.world::after { content: ""; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 22% at 58% 58%, var(--glow), transparent 70%), radial-gradient(ellipse 40% 30% at 85% 0%, rgba(53,201,255,.12), transparent 70%), repeating-linear-gradient(180deg, var(--scan) 0 1px, transparent 1px 3px); }
${MOCK_STRIP_CSS}
.mono, kbd, .lab, .q, .nd, .prompt { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
/* The console rail: its glass runs the page's full height (the owner's note on A); its contents stay in view. */
.rail { position: relative; z-index: 15; background: var(--rail); border-right: 1px solid var(--panel-edge); backdrop-filter: blur(22px) saturate(160%); -webkit-backdrop-filter: blur(22px) saturate(160%); box-shadow: inset -1px 0 0 rgba(138,123,255,.12); }
.rail-in { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 4px; padding: 18px 12px 16px; }
.logo { display: flex; flex-direction: column; gap: 2px; padding: 0 10px 14px; margin-bottom: 6px; border-bottom: 1px solid var(--line); }
.logo b { font: 900 22px/1 system-ui, sans-serif; letter-spacing: .04em; background: linear-gradient(180deg, #fff 0%, #bfe3ff 45%, #6a8cff 58%, #e6d2ff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 10px rgba(110,140,255,.5)); }
:root[data-theme="light"] .logo b { background-image: linear-gradient(180deg, #23307a, #6a4cff 60%, #2f8fd0); filter: none; }
.logo small { font: 600 11px ui-monospace, Menlo, monospace; color: var(--muted); letter-spacing: .06em; }
.cur { display: inline-block; width: .55em; height: 1em; vertical-align: -.15em; background: currentColor; margin-left: 2px; animation: blink 1.1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.nav { position: relative; display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 10px; color: var(--muted); text-decoration: none; font: 650 14.5px system-ui, sans-serif; }
.nav:hover { color: var(--ink); background: var(--soft); }
.nav kbd { margin-left: auto; font-size: 11px; padding: 0 6px; border-radius: 5px; border: 1px solid var(--line); color: var(--muted); }
.nav[aria-current="page"] { color: var(--ink); background: linear-gradient(90deg, rgba(111,123,255,.26), rgba(180,92,255,.08)); box-shadow: inset 2px 0 0 #8b7bff, 0 0 18px rgba(111,123,255,.18); }
.rail .jumpb { margin: 10px 4px 0; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; border: 1px dashed var(--panel-edge); background: transparent; color: var(--muted); cursor: pointer; font: 600 13px system-ui; }
.rail .jumpb kbd { margin-left: auto; font: 11px ui-monospace, Menlo, monospace; padding: 0 6px; border-radius: 5px; border: 1px solid var(--line); }
.rail-in .foot { margin-top: auto; display: flex; flex-direction: column; gap: 6px; }
.who { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: var(--soft); font-size: 13px; }
.who small { display: block; color: var(--muted); font: 11px ui-monospace, Menlo, monospace; }
.acct { width: 30px; height: 30px; flex: none; border-radius: 8px; display: grid; place-items: center; font-weight: 800; color: #fff; background: linear-gradient(135deg, #35c9ff, #8b5cff); }
.tabs { display: none; }
main { padding: 20px 28px 56px; min-width: 0; max-width: 1400px; }
.top { display: flex; align-items: flex-end; gap: 14px; margin-bottom: 18px; flex-wrap: wrap; }
.prompt { display: block; font-size: 12.5px; color: var(--muted); margin-bottom: 6px; } .prompt b { color: #6dffa8; font-weight: 600; } :root[data-theme="light"] .prompt b { color: #138a4c; }
.top h1 { font: 800 28px/1.05 system-ui, sans-serif; margin: 0; letter-spacing: -.01em; }
.top .sum { color: var(--muted); font-size: 14px; margin-top: 4px; } .top .sum b { color: var(--ink); }
.top .sp { flex: 1; }
.wallet, .bell { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 6px; background: var(--soft); border: 1px solid var(--panel-edge); font: 650 13px ui-monospace, Menlo, monospace; text-decoration: none; color: inherit; white-space: nowrap; }
.bell b { background: var(--live); color: #fff; border-radius: 4px; padding: 0 6px; font-size: 11px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--panel-edge); background: var(--soft); border-radius: 10px; padding: 8px 15px; font: 700 13.5px system-ui, sans-serif; cursor: pointer; white-space: nowrap; color: var(--ink); }
.btn.pri { border-color: transparent; color: #fff; background: linear-gradient(135deg, var(--accent), var(--accent2)); box-shadow: 0 0 18px rgba(130,110,255,.4); }
.btn.sm { padding: 4px 10px; font-size: 12.5px; border-radius: 8px; }
.btn:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }
.sect { display: flex; align-items: center; gap: 10px; margin: 6px 0 12px; font: 700 12px ui-monospace, Menlo, monospace; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); }
.sect::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, var(--line), transparent); }
.sect b { color: var(--ink); } .sect.hot { color: #ffcf5c; } :root[data-theme="light"] .sect.hot { color: #a65a00; }
.quiet { margin-top: 10px; }
${MASONRY_CSS}
.grid { grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: var(--gap); }
/* A tile is a HUD panel: cut corners, a neon edge in its colour. */
.tile { --cut: 14px; position: relative; display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 14px 16px 14px; background: linear-gradient(180deg, color-mix(in srgb, var(--c) 7%, var(--panel)), var(--panel) 40%); backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%);
  clip-path: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut)); }
.tile::before { content: ""; position: absolute; inset: 0; pointer-events: none; padding: 1px; background: linear-gradient(160deg, color-mix(in srgb, var(--c) 60%, transparent), var(--panel-edge) 35%, var(--panel-edge) 70%, color-mix(in srgb, var(--c) 35%, transparent));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; clip-path: inherit; }
.tile.need { background: linear-gradient(180deg, color-mix(in srgb, var(--c) 16%, var(--panel)), var(--panel) 55%); }
.tile.need::before { background: linear-gradient(160deg, var(--c), color-mix(in srgb, var(--c) 40%, transparent) 40%, color-mix(in srgb, var(--c) 55%, transparent)); padding: 1.5px; }
.s-S { grid-column: span 1; } .s-M { grid-column: span 2; } .s-L { grid-column: span 4; }
.tile[data-tile="watch"].s-M { grid-column: span 1; } .tile[data-tile="watch"].s-L { grid-column: span 2; }
.nd { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 8px; font-size: 11.5px; font-weight: 700; letter-spacing: .02em; color: #05060d; background: var(--c); border-radius: 4px; box-shadow: 0 0 14px color-mix(in srgb, var(--c) 55%, transparent); }
.nd i { font-style: normal; }
.tile header { display: flex; align-items: flex-start; gap: 10px; }
.tile .ic { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 8px; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent), 0 0 12px color-mix(in srgb, var(--c) 25%, transparent); }
.hd { flex: 1; min-width: 0; }
.tile h3 { margin: 0; font: 750 15px/1.2 system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.q { margin: 2px 0 0; font-size: 11.5px; line-height: 1.35; color: var(--muted); } .q::before { content: "// "; color: color-mix(in srgb, var(--c) 70%, var(--muted)); }
.open { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 8px; color: var(--muted); }
.open:hover { background: var(--soft); color: var(--ink); }
.wo { font-size: 11px; font-weight: 700; color: var(--warn); border: 1px solid currentColor; border-radius: 4px; padding: 1px 8px; white-space: nowrap; }
.edit { display: inline-flex; gap: 2px; } .edit[hidden] { display: none; } .edit button { border: 1px solid var(--line); background: var(--soft); border-radius: 5px; padding: 1px 6px; font-size: 11px; cursor: pointer; }
.edit button[aria-pressed="true"] { background: var(--accent); color: #fff; }
.editing .tile { outline: 1.5px dashed var(--c); outline-offset: -6px; }
.body { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.s-S .body { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 6px 14px; }
.s-M .body, .s-L .body { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 9px 18px; align-content: start; }
.tile footer { display: flex; justify-content: flex-end; margin-top: auto; }
.fx { min-width: 0; }
.fx.row { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; } .fx.row.wrap { flex-wrap: wrap; }
.fx.kv { display: flex; flex-direction: column; gap: 2px; } .fx.blk { display: flex; flex-direction: column; gap: 5px; }
.fx.act { display: flex; }
.s-M :is([data-fact="recentMatches"], [data-fact="alerts"], [data-fact="winSchedule"], [data-fact="lastPulls"], [data-fact="bestCards"], [data-fact="cosmetics"], [data-fact="buyPacks"], [data-fact="liveArena"]) { grid-column: 1 / -1; }
.s-L :is([data-fact="recentMatches"], [data-fact="alerts"], [data-fact="personality"], [data-fact="lastPulls"], [data-fact="winSchedule"], [data-fact="cosmetics"]) { grid-column: span 2; }
.s-L :is(.al, .styles) { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 16px; }
.al li { flex-wrap: nowrap; } .al li > span { min-width: 0; }
[data-fact="agentStatus"] { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.lab { font-size: 10.5px; text-transform: uppercase; letter-spacing: .12em; color: color-mix(in srgb, var(--c) 55%, var(--muted)); font-weight: 700; }
.big { font: 850 28px/1.05 system-ui, sans-serif; letter-spacing: -.02em; text-shadow: 0 0 18px color-mix(in srgb, var(--c) 45%, transparent); }
.s-S .big { font-size: 24px; line-height: 1.2; }
.sub { color: var(--muted); font-size: 12.5px; }
.ava { width: 40px; height: 40px; flex: none; color: #dfe6ff; filter: drop-shadow(0 0 8px color-mix(in srgb, var(--c) 70%, transparent)); } .ava svg { width: 100%; height: 100%; display: block; }
.s-S .ava { width: 30px; height: 30px; } [data-fact="agentName"] .big { font-size: 22px; } .s-S [data-fact="agentName"] .big { font-size: 17px; }
.pill { display: inline-block; padding: 1px 9px; border-radius: 4px; font: 700 12px ui-monospace, Menlo, monospace; background: var(--soft); }
.pill.live { color: var(--live); box-shadow: inset 0 0 0 1px var(--live), 0 0 10px color-mix(in srgb, var(--live) 30%, transparent); } .pill.ok { color: var(--ok); box-shadow: inset 0 0 0 1px var(--ok); } .pill.warn { color: var(--warn); box-shadow: inset 0 0 0 1px var(--warn); }
.tier { display: inline-block; padding: 1px 9px; border-radius: 4px; font-weight: 750; color: var(--tc); box-shadow: inset 0 0 0 1.5px var(--tc), 0 0 12px color-mix(in srgb, var(--tc) 30%, transparent); }
:root[data-theme="light"] .tier { color: color-mix(in srgb, var(--tc) 60%, #000); }
.tier.sm { font-size: 11px; padding: 0 7px; margin-left: auto; }
.bar { display: block; height: 6px; border-radius: 2px; background: var(--soft); overflow: hidden; flex: 1 1 100%; box-shadow: inset 0 0 0 1px var(--line); }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--c), color-mix(in srgb, var(--c) 40%, #fff)); box-shadow: 0 0 10px var(--c); }
.up { color: var(--ok); font-weight: 700; } .down { color: var(--warn); font-weight: 700; }
.dots { display: flex; gap: 3px; flex-wrap: wrap; }
.dot { width: 18px; height: 18px; border-radius: 3px; display: grid; place-items: center; font: 800 10px ui-monospace, Menlo, monospace; background: var(--soft); }
.dot.win { background: rgba(109,255,168,.18); color: var(--ok); } .dot.loss { background: rgba(255,93,143,.18); color: var(--live); }
.lad, .list, .steps, .bars, .styles { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.lad li { display: flex; gap: 8px; align-items: center; padding: 3px 8px; border-radius: 4px; background: var(--soft); }
.lad li span { margin-left: auto; color: var(--muted); } .lad li.me { box-shadow: inset 0 0 0 1px var(--c); }
.list li { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.mh li { flex-wrap: nowrap; } .mh li > span:nth-child(2) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.res { font-weight: 800; font-family: ui-monospace, Menlo, monospace; } .res.win { color: var(--ok); } .res.loss { color: var(--live); }
.mh .res { width: 20px; }
.al li.new::before { content: ""; width: 7px; height: 7px; border-radius: 1px; background: var(--c); box-shadow: 0 0 6px var(--c); flex: none; align-self: center; }
.to { color: color-mix(in srgb, var(--c) 70%, var(--ink)); font-weight: 650; text-decoration: none; cursor: pointer; font-size: 12.5px; } .to::after { content: " →"; }
.steps { flex-direction: row; flex-wrap: wrap; gap: 4px; } .steps li { padding: 4px 8px; border-radius: 4px; background: var(--soft); display: flex; flex-direction: column; font-size: 12px; }
.steps li.done { opacity: .5; } .steps li.now { box-shadow: inset 0 0 0 1px var(--c), 0 0 10px color-mix(in srgb, var(--c) 30%, transparent); }
.bars li { display: grid; grid-template-columns: 62px 1fr auto; gap: 8px; align-items: center; font-size: 12.5px; }
.styles li { font-size: 12px; color: var(--muted); } .styles li b { color: var(--ink); } .styles li.on b::after { content: " ✓"; color: var(--ok); }
.chips { display: flex; flex-wrap: wrap; gap: 4px; } .chip { padding: 1px 8px; border-radius: 4px; background: var(--soft); font-size: 12px; }
.why { display: inline; } .why summary { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 3px; background: var(--soft); font-size: 10.5px; cursor: pointer; list-style: none; }
.why summary::-webkit-details-marker { display: none; } .why[open] > span { display: block; font-size: 12px; color: var(--muted); margin-top: 3px; }
.chart { width: 100%; height: 90px; display: block; } .chart text { font: 9px ui-monospace, monospace; }
.cards { display: flex; gap: 6px; flex-wrap: wrap; }
.mcard { --fc: #999; position: relative; display: inline-flex; flex-direction: column; justify-content: flex-end; flex: none; width: 46px; aspect-ratio: 5 / 7; border-radius: 5px; overflow: hidden; color: #fff; font-style: normal;
  background: radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--fc) 75%, #fff 10%), transparent 55%), linear-gradient(160deg, color-mix(in srgb, var(--fc) 55%, #0b0f22), #0b0f22 80%); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.18), 0 0 10px color-mix(in srgb, var(--fc) 30%, transparent); }
.mcard.mc-m { width: 76px; border-radius: 7px; }
.mcard.r-uncommon { box-shadow: inset 0 0 0 1.5px #cfe0ff; } .mcard.r-rare { box-shadow: inset 0 0 0 2px #59a8ff, 0 0 10px rgba(89,168,255,.4); } .mcard.r-mythic { box-shadow: inset 0 0 0 2px #ffcf5c, 0 0 14px rgba(255,207,92,.55); }
.mcard.shine::after { content: ""; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.35) 45%, transparent 60%); }
.mcard i { font-style: normal; }
.mcc { position: absolute; top: 3px; left: 3px; width: 15px; height: 15px; border-radius: 50%; background: rgba(0,0,0,.55); font-size: 9.5px; font-weight: 800; display: grid; place-items: center; }
.mca { position: absolute; inset: 22% 12% 38%; border-radius: 3px; background: repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 3px, transparent 3px 7px); }
.mcn { padding: 0 4px 2px; font-size: 7.5px; font-weight: 700; line-height: 1.1; text-shadow: 0 1px 2px #000; } .mc-m .mcn { font-size: 10px; }
.mcs { padding: 0 4px 3px; font-size: 7.5px; opacity: .8; } .mc-m .mcs { font-size: 9.5px; }
.mcf { position: absolute; top: 3px; right: 3px; font-size: 7px; font-weight: 800; background: rgba(0,0,0,.6); padding: 0 3px; border-radius: 3px; }
.vs { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 8px; align-items: center; }
.vs .side { display: flex; flex-direction: column; gap: 2px; min-width: 0; } .vs .side b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--fc); text-shadow: 0 0 10px color-mix(in srgb, var(--fc) 50%, transparent); }
:root[data-theme="light"] .vs .side b { color: color-mix(in srgb, var(--fc) 65%, #000); text-shadow: none; }
.vs .side:last-child { text-align: right; } .vsx { text-align: center; font: 800 12px ui-monospace, Menlo, monospace; color: var(--muted); line-height: 1.1; }
.hp { display: block; height: 5px; border-radius: 1px; background: var(--soft); overflow: hidden; } .hp i { display: block; height: 100%; background: var(--fc); box-shadow: 0 0 8px var(--fc); }
.vs .side:last-child .hp { transform: scaleX(-1); }
.s-S .vs .sub:nth-of-type(1) { display: none; }
[data-fact="liveArena"] { display: flex; flex-direction: column; gap: 6px; }
.arena916 { position: relative; aspect-ratio: 9 / 16; width: 100%; max-width: 360px; margin: 0 auto; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 10px; color: #eef1ff;
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  background: linear-gradient(rgba(138,123,255,.14) 1px, transparent 1px) 0 0 / 100% 24px, linear-gradient(90deg, rgba(138,123,255,.1) 1px, transparent 1px) 0 0 / 24px 100%, radial-gradient(ellipse 70% 30% at 50% 50%, rgba(138,123,255,.4), transparent 70%), linear-gradient(180deg, #05060d, #111545 50%, #05060d); }
.arena916.empty { display: grid; place-items: center; text-align: center; color: #9aa5d4; }
.ahud { display: flex; flex-direction: column; font-size: 10.5px; } .ahud b { font-size: 12px; } .ahud span { opacity: .75; font-family: ui-monospace, Menlo, monospace; }
.arow { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
.unit { width: 48px; aspect-ratio: 5 / 7; border-radius: 4px; padding: 3px; display: flex; flex-direction: column; justify-content: space-between; font-style: normal; font-size: 8px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--fc) 60%, #0b0f22), #0b0f22); box-shadow: inset 0 0 0 1px var(--fc), 0 0 12px color-mix(in srgb, var(--fc) 45%, transparent); }
.unit i { font-style: normal; font-weight: 700; line-height: 1.1; } .unit b { align-self: flex-end; font-size: 10px; } .unit.pend { opacity: .55; }
.none { font-size: 10px; opacity: .5; }
.disc { text-align: center; font: 600 10.5px ui-monospace, Menlo, monospace; padding: 5px; border-radius: 3px; background: rgba(138,123,255,.16); box-shadow: inset 0 0 0 1px rgba(138,123,255,.35); }
.proto { position: absolute; left: 50%; top: 50%; transform: translate(-50%, 18px); white-space: nowrap; font-size: 9.5px; opacity: .55; }
${art.css}
.tile[data-tile="store"]:not(.s-S) .body { display: flex; flex-wrap: wrap; gap: 10px 22px; align-items: flex-start; }
.tile[data-tile="store"]:not(.s-S) [data-fact="affordable"] { flex-basis: 100%; }
.tile[data-tile="store"].s-L [data-fact="cosmetics"] { flex-direction: row; flex-wrap: wrap; gap: 6px 22px; flex: 1; }
.tile[data-tile="store"].s-L [data-fact="cosmetics"] > .sub { flex-basis: 100%; }
.si { border-radius: 6px; } .si-art { border-radius: 4px; } .si-p { border-radius: 4px; }
.flash { animation: flash 1.6s ease-out 1; } @keyframes flash { 0% { filter: drop-shadow(0 0 0 var(--c)) brightness(1.25); } 100% { filter: none; } }
.pg { padding: 20px 22px; background: var(--panel); border: 1px solid var(--panel-edge); backdrop-filter: blur(18px); max-width: 760px; clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px); }
.pg h2 { margin: 0 0 6px; } .pg ul { margin: 6px 0 12px; } .pg .sub { display: block; }
/* The jump palette. */
.palette { position: fixed; inset: 0; z-index: 30; display: grid; place-items: start center; padding-top: 14vh; background: rgba(3,4,12,.55); backdrop-filter: blur(4px); }
.palette[hidden] { display: none; }
.pal { width: min(560px, calc(100vw - 32px)); background: var(--panel); border: 1px solid var(--panel-edge); box-shadow: 0 20px 60px rgba(0,0,0,.5), 0 0 30px rgba(138,123,255,.25); backdrop-filter: blur(24px); clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px); }
.pal label { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--line); font: 600 14px ui-monospace, Menlo, monospace; color: #6dffa8; }
.pal input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); font: 15px ui-monospace, Menlo, monospace; }
.pal ul { list-style: none; margin: 0; padding: 6px; max-height: 50vh; overflow: auto; }
.pal li button { width: 100%; display: flex; gap: 10px; align-items: center; padding: 8px 10px; border: 0; background: transparent; border-radius: 6px; cursor: pointer; text-align: left; }
.pal li button small { margin-left: auto; color: var(--muted); font: 11px ui-monospace, Menlo, monospace; }
.pal li button[aria-selected="true"], .pal li button:hover { background: var(--soft); box-shadow: inset 2px 0 0 #8b7bff; }
@media (max-width: 1180px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .s-L, .tile[data-tile="watch"].s-L { grid-column: span 2; } }
@media (max-width: 720px) {
  body { padding-bottom: 76px; }
  .app { grid-template-columns: minmax(0, 1fr); }
  .rail { display: none; }
  main { padding: 14px 14px 30px; }
  .top h1 { font-size: 22px; }
  .grid { grid-template-columns: minmax(0, 1fr); --gap: 12px; }
  .s-S, .s-M, .s-L, .tile[data-tile="watch"].s-M, .tile[data-tile="watch"].s-L { grid-column: span 1; }
  .tile { padding: 12px 13px; }
  .s-M .body, .s-L .body { grid-template-columns: minmax(0, 1fr); }
  .arena916 { width: min(100%, 300px); }
  .edit button[data-sz] { display: none; }
  .tabs { display: flex; position: fixed; z-index: 15; left: 0; right: 0; bottom: 0; justify-content: space-around; padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); background: var(--rail); border-top: 1px solid var(--panel-edge); backdrop-filter: blur(22px); }
  .tabs .nav { flex: 1; flex-direction: column; gap: 3px; padding: 6px 0 4px; font-size: 10.5px; }
}
@media (prefers-reduced-motion: reduce) { .cur, .flash { animation: none; } }
</style></head><body>
<div class="world" aria-hidden="true"></div>
${mockStrip("Mockup C · what needs you first", owners, data.takenAt, "dark")}
<div class="app">
<nav class="rail" aria-label="Main"><div class="rail-in">
  <div class="logo"><b>AI·TCG</b><small>season_1<span class="cur" aria-hidden="true"></span></small></div>
  ${rail}
  <button type="button" class="jumpb" id="jump">${svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 16)}Jump to<kbd>/</kbd></button>
  <div class="foot"><a href="#/settings" data-go="settings" class="nav">${icon("gear", 20)}<span>Settings</span></a><div class="who"><span class="acct" id="acct"></span><span><b id="who-n"></b><small id="who-l"></small></span></div></div>
</div></nav>
<main id="main"></main>
</div>
<nav class="tabs" aria-label="Main (phone)">${tabs}</nav>
<div class="palette" id="palette" hidden><div class="pal" role="dialog" aria-label="Jump to a place or a tile"><label><span aria-hidden="true">&gt;</span><input id="pal-in" type="text" placeholder="jump to… (a place or a tile)" autocomplete="off" aria-label="Jump to"></label><ul id="pal-list" role="listbox"></ul></div></div>
${art.defs}
<script id="data" type="application/json">${payload}</script>
<script>${art.script}</script>
<script>${SHELL_SCRIPT}</script>
<script>
(() => {
  const S = window.SHELL, D = S.D, st = S.st;
  const main = document.getElementById('main');
  const tileHtml = (o, b) => o.tiles[b.tile][S.sizeOn(b)];
  function draw() {
    const o = D.owners[st.owner];
    const p = S.page();
    document.getElementById('acct').textContent = o.shell.initial;
    document.getElementById('who-n').textContent = o.name;
    document.getElementById('who-l').textContent = '@' + o.login;
    document.querySelectorAll('.nav').forEach((a) => { if (a.dataset.go === p) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const prompt = '<span class="prompt"><b>' + o.login + '@ai-tcg</b>:~/' + p + ' $<span class="cur" aria-hidden="true"></span></span>';
    if (p === 'home') {
      // What needs you first, most urgent first; then the rest in the board's order.
      const rank = new Map(o.extra.needs.map((n, i) => [n.tile, i]));
      const hot = st.board.filter((b) => rank.has(b.tile)).sort((a, b) => rank.get(a.tile) - rank.get(b.tile));
      const calm = st.board.filter((b) => !rank.has(b.tile));
      const n = hot.length;
      main.innerHTML = '<div class="top"><div>' + prompt + '<h1>Home</h1><div class="sum">' + (n ? '<b>' + n + (n === 1 ? ' thing needs' : ' things need') + ' you</b>, the most urgent first.' : 'Nothing needs you right now.') + '</div></div><span class="sp"></span><button type="button" class="btn" id="edit" aria-pressed="' + st.editing + '">' + (st.editing ? 'Done' : 'Edit board') + '</button></div>' +
        (n ? '<h2 class="sect hot" id="s-needs"><span aria-hidden="true">▸</span> Needs you <b>' + n + '</b></h2><section class="grid mgrid' + (st.editing ? ' editing' : '') + '" id="needs" aria-labelledby="s-needs">' + hot.map((b) => tileHtml(o, b)).join('') + '</section>' : '') +
        (calm.length ? '<h2 class="sect quiet" id="s-quiet">All quiet</h2><section class="grid mgrid' + (st.editing ? ' editing' : '') + '" id="grid" aria-labelledby="s-quiet">' + calm.map((b) => tileHtml(o, b)).join('') + '</section>' : '') +
        (S.phone() && st.editing ? '<p class="sub">Sizes apply on a wider screen; here every tile shows its small face.</p>' : '') +
        (st.editing ? '<p class="sub">The groups order themselves by what needs you; the arrows order the tiles inside each group.</p>' : '');
      document.querySelectorAll('.tile .edit').forEach((e) => (e.hidden = !st.editing));
      return;
    }
    const title = S.titleOf(p);
    // Every page but Home has the wallet and the bell (on Home, Store and Notifications are their homes).
    const bar = '<span class="sp"></span><a class="wallet" href="#/cards" data-go="cards"><i class="coin" aria-hidden="true"></i>' + o.shell.credits + ' credits · ' + o.shell.packPoints + ' pack points</a><a class="bell" href="#/alerts" data-go="alerts" aria-label="Alerts, ' + o.shell.unread + ' new">Alerts' + (o.shell.unread ? ' <b>' + o.shell.unread + '</b>' : '') + '</a>';
    main.innerHTML = '<div class="top"><div>' + prompt + '<h1>' + title + '</h1></div>' + bar + '</div>' + S.stub(title, D.pages.find((x) => x.id === p));
  }
  const app = S.start(draw);
  // The jump palette ("/" or the rail's button), and the places' keys 1-5.
  const pal = document.getElementById('palette'), inp = document.getElementById('pal-in'), list = document.getElementById('pal-list');
  let sel = 0, shown = [];
  function fill() {
    const f = inp.value.trim().toLowerCase();
    shown = D.jump.filter((j) => !f || j.label.toLowerCase().includes(f));
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = shown.map((j, i) => '<li><button type="button" role="option" data-j="' + i + '" aria-selected="' + (i === sel) + '">' + j.label + '<small>' + j.kind + '</small></button></li>').join('') || '<li class="sub" style="padding:8px 10px">Nothing by that name.</li>';
  }
  const openPal = () => { pal.hidden = false; inp.value = ''; sel = 0; fill(); inp.focus(); };
  const closePal = () => { pal.hidden = true; };
  function go(j) {
    closePal();
    if (!j) return;
    if (j.go.startsWith('tile:')) {
      const id = j.go.slice(5);
      const show = () => { const el = document.querySelector('.tile[data-tile="' + id + '"]'); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } };
      if (S.page() !== 'home') { location.hash = '#/home'; setTimeout(show, 60); } else show();
    } else location.hash = '#/' + j.go;
  }
  document.getElementById('jump').addEventListener('click', openPal);
  pal.addEventListener('click', (e) => { const b = e.target.closest('[data-j]'); if (b) go(shown[Number(b.dataset.j)]); else if (e.target === pal) closePal(); });
  inp.addEventListener('input', () => { sel = 0; fill(); });
  document.addEventListener('keydown', (e) => {
    if (!pal.hidden) {
      if (e.key === 'Escape') closePal();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % Math.max(1, shown.length); fill(); }
      else if (e.key === 'Enter') { e.preventDefault(); go(shown[sel]); }
      return;
    }
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === '/') { e.preventDefault(); openPal(); return; }
    const i = Number(e.key);
    if (i >= 1 && i <= D.pages.length && !e.metaKey && !e.ctrlKey && !e.altKey) location.hash = '#/' + D.pages[i - 1].id;
  });
  void app;
})();
</script></body></html>`;
}
