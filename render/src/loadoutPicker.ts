// The loadout picker (victory boasts, slice 4; render session 36). The owner
// page where an owner dresses one of its agents: the five loadout slots the
// store keeps (victory boast, close-win boast, card back, avatar, arena),
// each owned item with a looping preview, and a locked "in the store" plate
// for an item on sale that the owner doesn't have.
//
// Like the pack page: one self-contained HTML file, the data embedded as
// JSON, one inline script, no network. It moves into the owner website
// when that exists; until then it is built from real store states
// (loadoutDemo.ts).
//
// The page never decides what the store accepts. Every choice it offers was
// put to the real store's `setLoadout` when the page was built, and the
// page carries the store's answer (the slot's new value, or its refusal
// message) for each one. Equipping on the page applies that answer. The
// store's slots are independent (whether one change is accepted never
// depends on another slot), so the answers compose; a test drives random
// sequences of choices through both the page's model and the real store
// and checks they end the same. When the server exposes the loadout call
// (roadmap 2b step 3) the page sends the choice instead; the model is the
// same.
//
// The preview is the replay's own boast player (boastFx.ts, the same
// sources), on a small winning board: the agent's row with its deck's real
// units and its panel. It shows which boast a win would play: the boast
// slot's item, or with that slot empty the starter boast of the faction the
// deck plays; the close-win slot's item with the CLOSE CALL plate, or with
// that slot empty the main boast (the store's own rule, `chooseBoast`, which
// a test checks this against through real recorded matches).
//
// The sixth slot, the coin (render session 55, the second coin slice): its
// tiles show each coin drawn by the same coinDraw Match Boot runs, and its
// preview is the flip itself over the preview board: the coin flicks up,
// spins and lands, once on its design and once on the agent's portrait,
// with the line each landing means (THEY GO FIRST / YOU GO FIRST), the coin's
// own whir and clink on a pass the viewer asked for.

import { CANVAS_FX_PURE_SOURCE, CANVAS_FX_RUNTIME_SOURCE, fxAtlasDataUris } from "./canvasFx.js";
import { SOUND_FX_PURE_SOURCE, SOUND_FX_RUNTIME_SOURCE } from "./soundFx.js";
import { BOAST_PURE_SOURCE, BOAST_RUNTIME_SOURCE } from "./boastFx.js";
import { COIN_PURE_SOURCE, COIN_RUNTIME_SOURCE } from "./coinFx.js";
import { CSS } from "./renderHtml.js";

export type PickerSlot = "boast" | "closeWinBoast" | "cardBack" | "avatar" | "arena" | "coin";

/** One choice in a slot: an item, or the empty slot (itemId null). */
export interface PickerTile {
  itemId: string | null;
  name: string;
  /** The faction it is themed to, or null (neutral, or the empty tile). */
  faction: string | null;
  /** "standard" (the free starters) or a season code. */
  season: string | null;
  owned: boolean;
  /** How the owner came to have it. */
  source: "starter" | "purchase" | "seasonReward" | null;
  /** Unowned and on sale now: the locked "in the store" plate. */
  priceCredits: number | null;
  description: string;
}

export interface PickerSlotView {
  slot: PickerSlot;
  /** "Victory boast", "Close-win boast", ... */
  label: string;
  /** What the slot does, one line. */
  explainer: string;
  /** What an empty slot means. */
  emptyText: string;
  tiles: PickerTile[];
}

/** The store's answer to one choice: the slot's new value, or the refusal. */
export type PickerOutcome = { ok: true; value: string | null } | { ok: false; error: string };

export interface PickerCard {
  name: string;
  cost: number;
  attack: number | null;
  health: number | null;
}

export interface PickerScenario {
  key: string;
  /** The scenario tab's label. */
  label: string;
  /** One line under the header: how the store got to this state. */
  note: string;
  /** deckFaction: the faction the agent's deck plays, which decides what an
   * empty boast slot plays; null when the site can't tell (no built deck,
   * no faction lock). rowFaction: the preview row's colours (the deck's
   * faction, else the owner's starting faction). */
  agent: { name: string; deckFaction: string | null; rowFaction?: string; avatarSvg?: string };
  credits: number;
  /** The live match the owner is in, if any (the store refuses changes). */
  live: { matchId: string; startedAt: string } | null;
  /** What the store has equipped, by slot, when the page was built. */
  loadout: Record<PickerSlot, string | null>;
  slots: PickerSlotView[];
  /** outcomes[slot][itemId, or "" for the empty slot]. */
  outcomes: Record<PickerSlot, Record<string, PickerOutcome>>;
  /** The deck's units shown on the preview board's winning row. */
  cards: PickerCard[];
  /** The other side of the preview board (dimmed, never touched). */
  foeFaction: string;
}

export { loadoutSlotText } from "./loadoutText.js";

/** The server's answer to one Equip on the website (site mode): the agent's
 * whole loadout as the server now has it, or its refusal. */
export type PickerAnswer = { ok: true; loadout: Record<PickerSlot, string | null> } | { ok: false; error: string };

/** What the website hands the page in site mode (window.LOADOUT.show). */
export interface PickerSitePayload {
  scenario: PickerScenario;
  starters: Record<string, string>;
  names: Record<string, string>;
}

export interface LoadoutPageData {
  /** The owner website's full-screen picker (render session 49): the page
   * starts empty and the website hands it one agent's real state
   * (window.LOADOUT.show); Equip and Buy go to the server through
   * window.LOADOUT_SITE_HOST on the website, and the page shows the
   * server's answer. No scenario tabs. */
  site?: boolean;
  title: string;
  closeWinHealth: number;
  /** Each faction's starter boast id, for an empty boast slot. */
  starters: Record<string, string>;
  /** Item names, for the page's messages. */
  names: Record<string, string>;
  scenarios: PickerScenario[];
}

// The page's model, shared by the page and the Node tests (no DOM).
export const LOADOUT_PURE_SOURCE = String.raw`
  var LOADOUT_SLOTS_ORDER = ['boast', 'closeWinBoast', 'cardBack', 'avatar', 'arena', 'coin'];
  // The coin preview's loop (render session 55): the flight (Match Boot's,
  // flick to landing), the landed coin with its line, then the next flip,
  // which lands on the other face.
  var LOADOUT_COIN_FLIGHT_MS = 600, LOADOUT_COIN_HOLD_MS = 1500;
  // Which face a pass lands on, and the line it means: the coin's design
  // first (the other agent goes first), then the agent's portrait (this
  // agent goes first), by Match Boot's rule (coinResult, own match).
  function loadoutCoinPass(n) {
    var portraitUp = n % 2 === 1;
    return { portraitUp: portraitUp, halfTurns: portraitUp ? 9 : 8, line: portraitUp ? 'YOU GO FIRST' : 'THEY GO FIRST' };
  }
  // What the coin slot previews: the tile's coin, else the equipped one,
  // else (an empty slot) the Chrome Token, which an empty slot flips.
  function loadoutCoinPreview(state, itemId, explicitTile, fallbackId) {
    var id = explicitTile ? itemId : state.coin;
    return { id: id == null ? fallbackId : id, empty: id == null };
  }
  // How long the preview waits between loops, and after a skip.
  var LOADOUT_LOOP_GAP_MS = 1100;
  var LOADOUT_SCROLL_SETTLE_MS = 380;
  function loadoutKey(itemId) { return itemId == null ? '' : String(itemId); }
  // Applies the store's answer for one choice. Returns the new state (the
  // old one when refused) and the store's message.
  function loadoutApply(state, slot, itemId, outcomes) {
    var o = outcomes && outcomes[slot] ? outcomes[slot][loadoutKey(itemId)] : null;
    if (!o) return { ok: false, state: state, error: 'the page has no store answer for this choice' };
    if (!o.ok) return { ok: false, state: state, error: o.error };
    var next = {};
    for (var k in state) next[k] = state[k];
    next[slot] = o.value;
    return { ok: true, state: next, error: null };
  }
  // Applies the server's answer to an Equip on the website: the loadout it
  // now has, slot for slot (the server's word, not the page's guess), or
  // the old state with the refusal.
  function loadoutAnswerApply(state, answer) {
    if (!answer || !answer.ok || !answer.loadout) return { ok: false, state: state, error: (answer && answer.error) || 'no answer from the server' };
    var next = {};
    for (var i = 0; i < LOADOUT_SLOTS_ORDER.length; i++) { var k = LOADOUT_SLOTS_ORDER[i]; next[k] = answer.loadout[k] == null ? null : answer.loadout[k]; }
    return { ok: true, state: next, error: null };
  }
  // The boast a win would play, by the store's rule: for the close-win slot
  // its item (the CLOSE CALL plate), or with it empty the main boast; for the
  // main slot its item, or with it empty the starter boast of the deck's
  // faction. Null when nothing is known.
  function loadoutPreview(state, slot, deckFaction, starters) {
    var main = state.boast != null ? state.boast : ((deckFaction && starters[deckFaction]) || null);
    if (slot === 'closeWinBoast' && state.closeWinBoast != null) return { id: state.closeWinBoast, close: true };
    return main ? { id: main, close: false } : null;
  }
  // What a tile previews: the state as it would be with that tile equipped.
  function loadoutTilePreview(state, slot, itemId, deckFaction, starters) {
    var s = {};
    for (var k in state) s[k] = state[k];
    if (slot === 'boast' || slot === 'closeWinBoast') s[slot] = itemId;
    return loadoutPreview(s, slot === 'closeWinBoast' ? 'closeWinBoast' : 'boast', deckFaction, starters);
  }
  // The slot rail's line: the equipped item's name, or what empty means.
  function loadoutSlotLine(state, slot, deckFaction, starters, names) {
    var v = state[slot];
    if (v != null) return names[v] || v;
    if (slot === 'boast') return 'Empty: plays ' + ((deckFaction && names[starters[deckFaction]]) || 'the deck\'s starter');
    if (slot === 'closeWinBoast') return 'Empty: plays the main boast';
    if (slot === 'coin') return 'Empty: flips ' + (names['coin-chrome-token'] || 'the Chrome Token');
    return 'Empty';
  }
  // Each boast's emblem on its tile: a small drawing of how it ends (the
  // crest, the column, the frame, the stack, the prompt, the burst), in the
  // tile's colour. An item without one gets the plain hex.
  var LOADOUT_GLYPHS = {
    'boast-aegis-shield-slam': '<path d="M12 3l7 4v8l-7 4-7-4V7z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8l3.5 2v4L12 16l-3.5-2v-4z" fill="currentColor"/>',
    'boast-swarm-hive-burst': '<circle cx="12" cy="19" r="2.2" fill="currentColor"/><circle cx="9" cy="14" r="1.7" fill="currentColor"/><circle cx="14.5" cy="10" r="1.5" fill="currentColor"/><circle cx="10" cy="6" r="1.3" fill="currentColor"/><circle cx="13.5" cy="3" r="1.1" fill="currentColor"/>',
    'boast-null-void-collapse': '<rect x="3" y="5" width="7" height="2" fill="currentColor"/><rect x="14" y="17" width="7" height="2" fill="currentColor"/><rect x="2" y="17" width="4" height="2" fill="currentColor"/><rect x="18" y="5" width="4" height="2" fill="currentColor"/><circle cx="12" cy="12" r="3.6" fill="#05070e" stroke="currentColor" stroke-width="1.6"/>',
    'boast-cortex-data-cascade': '<rect x="5" y="15" width="6" height="5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="13" y="15" width="6" height="5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="8" width="6" height="5" fill="currentColor"/><rect x="11" y="2" width="2" height="2" fill="currentColor"/><rect x="11" y="5" width="2" height="1.5" fill="currentColor" opacity="0.6"/>',
    'boast-s0-boot-sequence': '<rect x="2.5" y="4" width="19" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 9l3 2.5L6 14" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="11" y="13" width="5" height="1.8" fill="currentColor"/>',
    'boast-s0-dial-up-fireworks': '<path d="M12 9V3M12 9l4.2-4.2M12 9l6 0M12 9L7.8 4.8M12 9H6" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="15" width="4" height="6" fill="currentColor" opacity="0.8"/><rect x="8" y="12" width="4" height="9" fill="currentColor"/><rect x="13" y="16" width="3" height="5" fill="currentColor" opacity="0.8"/><rect x="17" y="13" width="4" height="8" fill="currentColor" opacity="0.9"/>'
  };
  function loadoutGlyph(itemId) {
    var g = itemId != null && LOADOUT_GLYPHS[itemId];
    return g ? '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">' + g + '</svg>' : null;
  }
  // The locked tile's action on the website: Buy when the owner can pay,
  // else the price and what the owner has (standalone: always the plate).
  function loadoutLockAction(site, price, credits) {
    if (price == null) return { kind: 'none' };
    if (site && credits >= price) return { kind: 'buy', price: price };
    return { kind: 'plate', price: price, short: credits < price };
  }
  // The message after an equip, in the page's words around the store's.
  function loadoutSavedLine(slotLabel, itemId, names) {
    if (itemId == null) return 'Saved: the ' + slotLabel.toLowerCase() + ' slot is empty.';
    return 'Saved: ' + (names[itemId] || itemId) + ' is this agent\'s ' + slotLabel.toLowerCase() + '.';
  }
`;

const pure = new Function(`${LOADOUT_PURE_SOURCE}; return { LOADOUT_GLYPHS, loadoutGlyph, LOADOUT_SLOTS_ORDER, LOADOUT_LOOP_GAP_MS, LOADOUT_COIN_FLIGHT_MS, LOADOUT_COIN_HOLD_MS, loadoutCoinPass, loadoutCoinPreview, loadoutKey, loadoutApply, loadoutAnswerApply, loadoutPreview, loadoutTilePreview, loadoutSlotLine, loadoutLockAction, loadoutSavedLine };`)() as {
  LOADOUT_GLYPHS: Record<string, string>;
  loadoutGlyph: (itemId: string | null) => string | null;
  LOADOUT_SLOTS_ORDER: PickerSlot[];
  LOADOUT_LOOP_GAP_MS: number;
  LOADOUT_COIN_FLIGHT_MS: number;
  LOADOUT_COIN_HOLD_MS: number;
  loadoutCoinPass: (n: number) => { portraitUp: boolean; halfTurns: number; line: string };
  loadoutCoinPreview: (state: Record<PickerSlot, string | null>, itemId: string | null, explicitTile: boolean, fallbackId: string) => { id: string; empty: boolean };
  loadoutKey: (itemId: string | null) => string;
  loadoutApply: (
    state: Record<PickerSlot, string | null>,
    slot: PickerSlot,
    itemId: string | null,
    outcomes: PickerScenario["outcomes"],
  ) => { ok: boolean; state: Record<PickerSlot, string | null>; error: string | null };
  loadoutAnswerApply: (state: Record<PickerSlot, string | null>, answer: PickerAnswer | null) => { ok: boolean; state: Record<PickerSlot, string | null>; error: string | null };
  loadoutLockAction: (site: boolean, price: number | null, credits: number) => { kind: "none" } | { kind: "buy"; price: number } | { kind: "plate"; price: number; short: boolean };
  loadoutPreview: (state: Record<PickerSlot, string | null>, slot: PickerSlot, deckFaction: string | null, starters: Record<string, string>) => { id: string; close: boolean } | null;
  loadoutTilePreview: (state: Record<PickerSlot, string | null>, slot: PickerSlot, itemId: string | null, deckFaction: string | null, starters: Record<string, string>) => { id: string; close: boolean } | null;
  loadoutSlotLine: (state: Record<PickerSlot, string | null>, slot: PickerSlot, deckFaction: string | null, starters: Record<string, string>, names: Record<string, string>) => string;
  loadoutSavedLine: (slotLabel: string, itemId: string | null, names: Record<string, string>) => string;
};
export const LOADOUT_GLYPHS = pure.LOADOUT_GLYPHS;
export const loadoutGlyph = pure.loadoutGlyph;
export const LOADOUT_SLOTS_ORDER = pure.LOADOUT_SLOTS_ORDER;
export const LOADOUT_LOOP_GAP_MS = pure.LOADOUT_LOOP_GAP_MS;
export const LOADOUT_COIN_FLIGHT_MS = pure.LOADOUT_COIN_FLIGHT_MS;
export const LOADOUT_COIN_HOLD_MS = pure.LOADOUT_COIN_HOLD_MS;
export const loadoutCoinPass = pure.loadoutCoinPass;
export const loadoutCoinPreview = pure.loadoutCoinPreview;
export const loadoutKey = pure.loadoutKey;
export const loadoutApply = pure.loadoutApply;
export const loadoutAnswerApply = pure.loadoutAnswerApply;
export const loadoutLockAction = pure.loadoutLockAction;
export const loadoutPreview = pure.loadoutPreview;
export const loadoutTilePreview = pure.loadoutTilePreview;
export const loadoutSlotLine = pure.loadoutSlotLine;
export const loadoutSavedLine = pure.loadoutSavedLine;

// The page: builds each scenario from the data, runs the preview loop.
export const LOADOUT_RUNTIME_SOURCE = String.raw`
  var DATA = JSON.parse(document.getElementById('loadout-data').textContent);
  var app = document.getElementById('picker');
  var stats = { previews: 0, loops: 0, equips: 0, refused: 0, restarts: 0, last: null };
  var S = null; // the open scenario: { sc, state, slot, preview: {slot, itemId, explicit} }
  // Site mode (render session 49): the website's hooks, same origin, set on
  // the parent before the page loads. Standalone: none.
  function siteHost() {
    try { if (window.parent && window.parent !== window && window.parent.LOADOUT_SITE_HOST) return window.parent.LOADOUT_SITE_HOST; } catch (e) { /* another origin */ }
    return null;
  }
  var SITE = !!DATA.site;
  // A request to the server is out (site mode): Equip and Buy wait for it.
  var busy = false;
  stats.site = { equips: 0, buys: 0, answers: [] };
  var gen = 0, loopTimer = null, scrollTimer = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function slotView(slot) { return S.sc.slots.filter(function (v) { return v.slot === slot; })[0]; }
  function factionClass(f) { return 'faction-' + (f || 'Neutral'); }
  function rowFaction(sc) { return sc.agent.rowFaction || sc.agent.deckFaction || null; }

  // ---- the coin preview (render session 55) ----
  // The flip over the preview board, on its own canvas: the board dims,
  // the coin flicks up from the board's centre, spins and lands (Match
  // Boot's flight and draw), and its line types under it; it holds, then
  // flips again onto the other face. Reduced motion: both landings side by
  // side, still, each with its line. Loops while the board is in view.
  var COINPV = (function () {
    var cv = null, raf = 0, run = null, imgs = {};
    stats.coin = { passes: 0, landed: [], lines: [], frames: 0, still: 0, sounds: 0 };
    function canvas() {
      if (cv && cv.isConnected) return cv;
      cv = document.getElementById('coin-cv');
      return cv;
    }
    function portrait() {
      var sc = S && S.sc, f = sc ? (rowFaction(sc) || 'Neutral') : 'Neutral', key = (sc ? sc.agent.name : '') + ':' + f;
      if (imgs[key]) return imgs[key];
      var svg = sc && sc.agent.avatarSvg, c = fxRgbOf(f), img = null;
      if (svg) { img = new Image(); img.decoding = 'async'; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(String(svg).split('currentColor').join('rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')')); }
      imgs[key] = { img: img, rgb: c };
      return imgs[key];
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (run && run.seq && run.seq.cut) run.seq.cut();
      run = null;
      var c = canvas(); if (c) { c.hidden = true; var x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); }
    }
    function size(c) {
      var board = document.getElementById('stage-board'), r = board.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      c.style.left = board.offsetLeft + 'px'; c.style.top = board.offsetTop + 'px';
      c.style.width = r.width + 'px'; c.style.height = r.height + 'px';
      var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      return { w: r.width, h: r.height, dpr: dpr };
    }
    function typeLine(ctx, txt, k, x, y, fs, a) {
      ctx.font = 'bold ' + fs.toFixed(1) + 'px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var w = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(3,5,10,' + (0.85 * a).toFixed(3) + ')';
      ctx.fillRect(x - w / 2 - 8, y - fs * 0.8, w + 16, fs * 1.6);
      ctx.fillStyle = 'rgba(232,240,255,' + a.toFixed(3) + ')';
      var shown = txt.slice(0, k), sw = ctx.measureText(shown).width;
      ctx.textAlign = 'left'; ctx.fillText(shown, x - w / 2, y);
      if (k < txt.length) ctx.fillRect(x - w / 2 + sw + 1, y - fs * 0.45, fs * 0.5, fs * 0.9);
    }
    // One frame. tt: ms since the run started.
    function frame(now) {
      if (!run) return;
      var c = canvas(); if (!c) return;
      var g = size(c), ctx = c.getContext('2d'), spec = COIN_SPECS[run.id] || COIN_SPECS[COIN_DEFAULT], P = portrait();
      ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0); ctx.clearRect(0, 0, g.w, g.h);
      ctx.fillStyle = 'rgba(3,5,10,0.72)'; ctx.fillRect(0, 0, g.w, g.h);
      var cx = g.w / 2, r = Math.max(16, Math.min(46, g.h * 0.2)), fs = Math.max(10, Math.min(15, g.w / 30));
      var tt = now - run.t0;
      if (REDUCED_PICK) {
        // Both landings, still, each with its line.
        [0, 1].forEach(function (n) {
          var ps = loadoutCoinPass(n), x = g.w * (n ? 0.68 : 0.32);
          coinDraw(ctx, { spec: spec, x: x, y: g.h * 0.44, r: r, angle: coinFlight(1, ps.halfTurns).angle, scale: 1, img: P.img, faceRgb: P.rgb, t: 900 });
          typeLine(ctx, ps.line, ps.line.length, x, g.h * 0.44 + r * (spec.neon ? COIN_NEON_REACH : 1) + fs * 1.3, fs, 1);
        });
        stats.coin.still++; stats.coin.frames++;
        stats.coin.portrait = !!(P.img && P.img.complete && P.img.naturalWidth);
        raf = 0;
        // The portrait may still be loading: draw the still once more when
        // it arrives (never a loop), so the portrait face isn't left on the
        // placeholder.
        if (P.img && !(P.img.complete && P.img.naturalWidth) && !run.waitImg) {
          var mine = run; run.waitImg = true;
          P.img.addEventListener('load', function () { if (run === mine) raf = requestAnimationFrame(frame); }, { once: true });
        }
        return;
      }
      var cycle = LOADOUT_COIN_FLIGHT_MS + LOADOUT_COIN_HOLD_MS, n = Math.floor(tt / cycle), within = tt - n * cycle, ps = loadoutCoinPass(n);
      if (n !== run.n) {
        run.n = n; stats.coin.passes++;
        // The landed face is known as the pass starts (it is the flight's end).
        stats.coin.landed.push(coinFaceAt(coinFlight(1, ps.halfTurns).angle)); stats.coin.lines.push(ps.line);
        if (stats.coin.landed.length > 12) { stats.coin.landed.shift(); stats.coin.lines.shift(); }
        // Sound on the first pass the viewer asked for, never on the loop.
        if (run.sound && n === 0 && typeof SND !== 'undefined' && SND.sequence) {
          run.seq = SND.sequence([{ t: 0, kind: 'coinFlick' }, { t: 40, kind: spec.whir || 'coinWhir' }, { t: LOADOUT_COIN_FLIGHT_MS, kind: 'coinClink' }], { pan: 0 });
          stats.coin.sounds++;
        }
      }
      var u = Math.min(1, within / LOADOUT_COIN_FLIGHT_MS), fl = coinFlight(u, ps.halfTurns), since = within - LOADOUT_COIN_FLIGHT_MS;
      var settle = since >= 0 && since < 160 ? 1 + 0.06 * Math.sin(Math.PI * since / 160) : 1;
      var trail = null;
      if (spec.trail && u < 1) { trail = []; for (var k = 1; k <= 3; k++) { var uk = (within - k * 20) / LOADOUT_COIN_FLIGHT_MS; if (uk > 0) { var fk = coinFlight(uk, ps.halfTurns); trail.push([fk.angle, fk.scale]); } } }
      var cy = g.h * 0.44, fade = within > cycle - 200 ? Math.max(0, (cycle - within) / 200) : 1;
      coinDraw(ctx, { spec: spec, x: cx, y: cy, r: r, angle: fl.angle, scale: fl.scale * settle, img: P.img, faceRgb: P.rgb, a: fade, t: tt, trail: trail });
      if (since >= 0 && since < 300) {
        var uu = since / 300;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(220,232,255,' + (0.5 * (1 - uu)).toFixed(3) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, r * (1.05 + 0.6 * uu), 0, Math.PI * 2); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      if (since >= 100) {
        var kk = Math.min(ps.line.length, Math.ceil(ps.line.length * (since - 100) / 220));
        typeLine(ctx, ps.line, kk, cx, cy + r * (spec.neon ? COIN_NEON_REACH : 1) + fs * 1.3, fs, fade);
      }
      stats.coin.frames++;
      raf = requestAnimationFrame(frame);
    }
    function play(id, explicit) {
      stop();
      var c = canvas(); if (!c) return;
      c.hidden = false;
      run = { id: id, t0: performance.now(), n: -1, sound: !!explicit, seq: null };
      raf = requestAnimationFrame(frame);
    }
    return { play: play, stop: stop, active: function () { return !!run; }, id: function () { return run ? run.id : null; } };
  })();

  // ---- the preview board ----
  function stageHtml(sc) {
    var cards = sc.cards.map(function (c) {
      var stats = c.attack != null ? '<div class="stats"><span class="atk">' + c.attack + '</span><span class="hp">' + c.health + '</span></div>' : '';
      return '<div class="card pickcard ' + factionClass(rowFaction(sc)) + '"><div class="head"><span class="cost">' + c.cost + '</span></div><div class="art"></div><div class="name">' + esc(c.name) + '</div>' + stats + '</div>';
    });
    while (cards.length < 6) cards.push('<div class="slot empty"></div>');
    return '<div class="side st-foe" id="st-side-l"><div class="hud ' + factionClass(sc.foeFaction) + '" id="st-hud-l"><div class="name"><span style="color:var(--fc)">The other agent</span><span class="faction-tag">' + esc(sc.foeFaction) + '</span></div><div class="meta">HP 0 / 30</div></div></div>' +
      '<div class="side" id="st-side-w"><div class="board-row ' + factionClass(rowFaction(sc)) + '" id="st-row-w">' + cards.join('') + '</div></div>' +
      '<div class="hud ' + factionClass(rowFaction(sc)) + '" id="st-hud-w"><div class="name"><span style="color:var(--fc)">' + esc(sc.agent.name) + '</span><span class="faction-tag">' + esc(rowFaction(sc) || 'Neutral') + '</span></div><div class="meta" id="st-hp">HP 18 / 30</div></div>';
  }
  function stageEls() {
    return {
      band: document.getElementById('st-side-w'), panel: document.getElementById('st-hud-w'), row: document.getElementById('st-row-w'),
      loser: [document.getElementById('st-side-l')], dim: [document.getElementById('st-side-l')]
    };
  }
  function inView(e) { var r = e.getBoundingClientRect(); return r.top >= -1 && r.bottom <= (window.innerHeight || 0) + 1 && r.height > 0; }
  // What the preview shows now: the tile being previewed, or the slot's
  // equipped choice.
  function currentPreview() {
    var p = S.preview, slot = p ? p.slot : S.slot, isBoast = slot === 'boast' || slot === 'closeWinBoast';
    if (slot === 'coin') return { slot: 'coin', coin: loadoutCoinPreview(S.state, p ? p.itemId : null, !!p, COIN_DEFAULT) };
    if (!isBoast) slot = 'boast';
    var plan = p && isBoast ? loadoutTilePreview(S.state, slot, p.itemId, S.sc.agent.deckFaction, DATA.starters)
      : loadoutPreview(S.state, slot, S.sc.agent.deckFaction, DATA.starters);
    return { slot: slot, plan: plan };
  }
  function caption(cp, note) {
    var c = document.getElementById('st-cap');
    if (!cp.plan) {
      c.innerHTML = S.sc.agent.deckFaction ? 'Nothing to preview.' : 'A win plays the starter boast of the faction this agent\'s deck plays. <span class="cap-note">No deck is built yet, so it can\'t be shown.</span>';
      return;
    }
    var nm = DATA.names[cp.plan.id] || cp.plan.id;
    var tile = S.preview, owned = true;
    if (tile) { var t = slotView(tile.slot).tiles.filter(function (x) { return loadoutKey(x.itemId) === loadoutKey(tile.itemId); })[0]; owned = !t || t.owned || t.itemId == null; }
    c.innerHTML = '<span class="cap-k">' + (cp.plan.close ? 'A close win (' + DATA.closeWinHealth + ' health or less) plays' : 'A win plays') + '</span> <b>' + esc(nm) + '</b>' +
      (owned ? '' : ' <span class="cap-lock">not owned: preview only</span>') + (note ? ' <span class="cap-note">' + esc(note) + '</span>' : '');
  }
  function coinCaption(pc) {
    var c = document.getElementById('st-cap'), nm = DATA.names[pc.id] || (COIN_SPECS[pc.id] ? COIN_SPECS[pc.id].name : pc.id);
    var tile = S.preview, owned = true;
    if (tile && tile.itemId != null) { var t = slotView('coin').tiles.filter(function (x) { return loadoutKey(x.itemId) === loadoutKey(tile.itemId); })[0]; owned = !t || t.owned; }
    c.innerHTML = '<span class="cap-k">' + (pc.empty ? 'An empty slot flips' : 'Who goes first flips') + '</span> <b>' + esc(nm) + '</b> <span class="cap-k">· portrait up: this agent goes first</span>' +
      (owned ? '' : ' <span class="cap-lock">not owned: preview only</span>');
  }
  function stopPreview() { gen++; if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; } if (BOAST.active()) BOAST.cancel(); COINPV.stop(); }
  // Plays the preview once; loops while the board stays in view (not in
  // reduced motion: the still shows once per choice).
  function playPreview(explicit) {
    stopPreview();
    var my = gen, cp = currentPreview();
    if (cp.slot === 'coin') { coinCaption(cp.coin); COINPV.play(cp.coin.id, !!explicit); stats.previews++; stats.current = { coin: cp.coin.id, empty: cp.coin.empty }; return; }
    var hp = document.getElementById('st-hp');
    if (hp) hp.textContent = cp.plan && cp.plan.close ? 'HP 3 / 30' : 'HP 18 / 30';
    caption(cp, null);
    if (!cp.plan) return;
    if (!BOAST_SPECS[cp.plan.id]) { caption(cp, 'This page can\'t draw it yet.'); return; }
    var stage = document.getElementById('stage');
    if (!explicit && !inView(stage)) { loopTimer = setTimeout(function () { if (my === gen) playPreview(false); }, LOADOUT_LOOP_GAP_MS); return; }
    SOUND_OK = !!explicit;
    stats.previews++;
    if (!explicit) stats.loops++;
    var plan = BOAST.play(cp.plan.id, stageEls(), {
      who: S.sc.agent.name, faction: rowFaction(S.sc) || 'Cortex', close: cp.plan.close, seed: 7,
      onEnd: function (reason) {
        if (my !== gen) return;
        stats.last = { id: cp.plan.id, reason: reason };
        if (REDUCED_PICK) return;
        loopTimer = setTimeout(function () { if (my === gen) playPreview(false); }, LOADOUT_LOOP_GAP_MS);
      }
    });
    stats.current = { id: cp.plan.id, close: cp.plan.close, still: plan ? !!plan.still : null };
  }

  // ---- the slots and the tiles ----
  function railHtml() {
    return S.sc.slots.map(function (v) {
      return '<button type="button" class="rail-slot' + (v.slot === S.slot ? ' on' : '') + '" data-slot="' + v.slot + '" aria-pressed="' + (v.slot === S.slot) + '">' +
        '<span class="rs-label">' + esc(v.label) + '</span><span class="rs-val">' + esc(loadoutSlotLine(S.state, v.slot, S.sc.agent.deckFaction, DATA.starters, DATA.names)) + '</span></button>';
    }).join('');
  }
  function tileHtml(v, t) {
    var key = loadoutKey(t.itemId), equipped = loadoutKey(S.state[v.slot]) === key;
    var previewing = S.preview && S.preview.slot === v.slot && loadoutKey(S.preview.itemId) === key;
    var tag = t.itemId == null ? 'Empty slot' : (t.season === 'standard' ? 'Free starter' : 'Season ' + esc(String(t.season).replace(/^S/, ''))) + (t.faction ? ' · ' + esc(t.faction) : ' · Neutral');
    var src = t.owned && t.source === 'purchase' ? '<span class="t-src">Bought</span>' : '';
    var action;
    if (!t.owned && t.itemId != null) {
      var la = loadoutLockAction(SITE, t.priceCredits, S.sc.credits);
      if (la.kind === 'buy') action = '<button type="button" class="t-equip t-buy" data-buy="' + esc(key) + '"' + (busy ? ' disabled' : '') + '>Buy · ' + la.price + '</button><div class="t-short">you have ' + S.sc.credits + '</div>';
      else action = '<div class="t-lock"><span class="t-price"><span class="lock-ico" aria-hidden="true"></span>In the store · ' + t.priceCredits + ' credits</span>' + (la.short ? '<span class="t-short">you have ' + S.sc.credits + '</span>' : '') + '</div>';
    } else if (equipped) action = '<div class="t-on">Equipped</div>';
    else action = '<button type="button" class="t-equip" data-equip="' + esc(key) + '"' + (busy ? ' disabled' : '') + '>Equip</button>';
    var isBoast = v.slot === 'boast' || v.slot === 'closeWinBoast' || v.slot === 'coin';
    var swatch = v.slot === 'coin' && t.itemId != null ? '<canvas class="t-coin" width="92" height="92" data-coin="' + esc(t.itemId) + '"></canvas>' : (loadoutGlyph(t.itemId) || '<span></span>');
    return '<div class="tile ' + factionClass(t.faction) + (t.owned || t.itemId == null ? '' : ' locked') + (equipped ? ' equipped' : '') + (previewing ? ' previewing' : '') + (t.itemId == null ? ' empty' : '') + '" data-tile="' + esc(key) + '"' + (isBoast ? ' tabindex="0" role="button" aria-label="Preview ' + esc(t.name) + '"' : '') + '>' +
      '<div class="t-swatch' + (v.slot === 'coin' && t.itemId != null ? ' coin' : '') + '" aria-hidden="true">' + swatch + '</div>' +
      '<div class="t-body"><div class="t-name">' + esc(t.name) + src + '</div><div class="t-tag">' + tag + '</div><div class="t-desc">' + esc(t.description) + '</div></div>' +
      '<div class="t-act">' + action + '</div></div>';
  }
  function panelHtml() {
    var v = slotView(S.slot), isBoast = v.slot === 'boast' || v.slot === 'closeWinBoast', isCoin = v.slot === 'coin';
    var tiles = v.tiles.map(function (t) { return tileHtml(v, t); }).join('');
    var none = v.tiles.filter(function (t) { return t.itemId != null; }).length === 0;
    return '<div class="slot-head"><div class="sh-label">' + esc(v.label) + '</div><div class="sh-exp">' + esc(v.explainer) + '</div></div>' +
      '<div class="tiles">' + tiles + '</div>' +
      (none ? '<div class="none-yet">' + esc(v.emptyText) + '</div>' : '') +
      (isBoast ? '<div class="hint">Tap an item to preview it on the board; Equip saves it to this agent.</div>' : '') +
      (isCoin ? '<div class="hint">Tap a coin to see it flip over the board; Equip saves it to this agent. The coin is only how the flip looks: the server\'s flip decides who goes first.</div>' : '');
  }
  function redraw() {
    document.getElementById('rail').innerHTML = railHtml();
    document.getElementById('slotpanel').innerHTML = panelHtml();
    drawCoinSwatches();
  }
  // Each coin tile's swatch: the coin, landed design up, drawn by coinDraw.
  function drawCoinSwatches() {
    document.querySelectorAll('canvas.t-coin').forEach(function (cv) {
      var spec = COIN_SPECS[cv.getAttribute('data-coin')];
      var ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height);
      if (!spec) return;
      coinDraw(ctx, { spec: spec, x: 46, y: 44, r: 30, angle: 0, scale: 1, t: 900 });
    });
    stats.swatches = document.querySelectorAll('canvas.t-coin').length;
  }
  function toast(msg, ok) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast ' + (ok ? 'ok' : 'no') + ' show';
    clearTimeout(t._h); t._h = setTimeout(function () { t.className = 'toast ' + (ok ? 'ok' : 'no'); }, 3200);
  }
  // Keeps keyboard focus on the same button (or its tile) across a redraw.
  function refocus(attr, key) {
    var k = window.CSS && CSS.escape ? CSS.escape(key) : key;
    var b = document.querySelector('[' + attr + '="' + k + '"]') || document.querySelector('.tile[data-tile="' + k + '"]');
    // A tile that isn't focusable (card back, avatar, arena): the slot's rail button.
    if (b && b.tagName !== 'BUTTON' && !b.hasAttribute('tabindex')) b = document.querySelector('.rail-slot.on');
    if (b && b.focus) b.focus({ preventScroll: true });
  }
  function siteEquip(key) {
    var h = siteHost(); if (!h || busy) return;
    var v = slotView(S.slot), slot = S.slot, itemId = key === '' ? null : key, my = S;
    busy = true; stats.equips++; stats.site.equips++; redraw();
    Promise.resolve(h.equip(slot, itemId)).then(function (answer) { return answer; }, function (err) { return { ok: false, error: (err && err.message) || 'the server could not be reached' }; }).then(function (answer) {
      busy = false;
      stats.site.answers.push({ slot: slot, itemId: itemId, ok: !!(answer && answer.ok), error: answer && !answer.ok ? answer.error : null });
      if (S !== my) return;
      var r = loadoutAnswerApply(S.state, answer);
      if (!r.ok) { stats.refused++; toast('Not saved: ' + r.error, false); redraw(); refocus('data-equip', key); return; }
      S.state = r.state; S.preview = null;
      toast(loadoutSavedLine(v.label, itemId, DATA.names), true);
      redraw(); refocus('data-equip', key); playPreview(true);
    });
  }
  function siteBuy(key) {
    var h = siteHost(); if (!h || busy || !h.buy) return;
    var my = S, slot = S.slot, name = DATA.names[key] || key;
    busy = true; stats.site.buys++; redraw();
    Promise.resolve(h.buy(key)).then(function (a) { return a; }, function (err) { return { ok: false, error: (err && err.message) || 'the server could not be reached' }; }).then(function (a) {
      busy = false;
      if (S !== my) return;
      if (!a || !a.ok) { toast('Not bought: ' + ((a && a.error) || 'no answer'), false); redraw(); return; }
      if (a.cancelled) { redraw(); refocus('data-buy', key); return; }
      show(a.payload, { slot: slot, preview: { slot: slot, itemId: key } });
      toast(name + ' is yours. Equip saves it to this agent.', true);
      refocus('data-equip', key);
    });
  }
  function equip(key) {
    if (SITE) return siteEquip(key);
    var v = slotView(S.slot), itemId = key === '' ? null : key;
    var r = loadoutApply(S.state, S.slot, itemId, S.sc.outcomes);
    stats.equips++;
    if (!r.ok) { stats.refused++; toast('Not saved: ' + r.error, false); return; }
    S.state = r.state; S.preview = null;
    toast(loadoutSavedLine(v.label, itemId, DATA.names), true);
    redraw(); playPreview(true);
  }

  // ---- scenarios ----
  function open(key) {
    var sc = DATA.scenarios.filter(function (s) { return s.key === key; })[0] || DATA.scenarios[0];
    openScenario(sc, null);
  }
  // keep: { slot, preview } to stay where the owner was (after a purchase).
  function openScenario(sc, keep) {
    stopPreview();
    var state = {}; LOADOUT_SLOTS_ORDER.forEach(function (k) { state[k] = sc.loadout[k]; });
    S = { sc: sc, state: state, slot: keep && keep.slot ? keep.slot : 'boast', preview: keep && keep.preview ? keep.preview : null };
    document.querySelectorAll('.sc-tab').forEach(function (b) { var on = b.getAttribute('data-sc') === sc.key; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    document.getElementById('ag-name').textContent = sc.agent.name;
    var tag = document.getElementById('ag-faction'); tag.textContent = sc.agent.deckFaction ? sc.agent.deckFaction + ' deck' : 'No deck built yet'; tag.className = 'faction-tag ' + factionClass(sc.agent.deckFaction);
    document.getElementById('ag-credits').textContent = sc.credits + ' credits';
    document.getElementById('ag-balance').firstChild.textContent = SITE ? 'Your balance: ' : 'Owner\'s balance: ';
    document.getElementById('sc-note').textContent = sc.note;
    var lock = document.getElementById('livelock');
    if (sc.live) { lock.hidden = false; lock.innerHTML = '<b>In a live match</b>' + (sc.live.matchId ? ' (' + esc(sc.live.matchId) + (sc.live.startedAt ? ', since ' + esc(sc.live.startedAt.slice(11, 16)) + ' UTC' : '') + ')' : '') + '. The store refuses loadout changes until it ends: the match keeps the loadout it started with.'; }
    else lock.hidden = true;
    app.classList.toggle('is-live', !!sc.live);
    document.getElementById('stage-board').innerHTML = stageHtml(sc);
    redraw();
    // Let the board lay out before measuring it.
    requestAnimationFrame(function () { requestAnimationFrame(function () { playPreview(false); }); });
  }
  // The website hands the page one agent's state (site mode).
  function show(payload, keep) {
    if (!payload || !payload.scenario) return;
    DATA.starters = payload.starters || {}; DATA.names = payload.names || {};
    DATA.scenarios = [payload.scenario];
    busy = false;
    document.getElementById('picker').hidden = false;
    openScenario(payload.scenario, keep || null);
  }
  function siteClose() {
    stopPreview(); busy = false; S = null;
    var h = siteHost(); if (h && h.close) h.close();
  }
  document.getElementById('sc-tabs').innerHTML = DATA.scenarios.map(function (s) { return '<button type="button" class="sc-tab" data-sc="' + esc(s.key) + '">' + esc(s.label) + '</button>'; }).join('');
  document.getElementById('sc-tabs').addEventListener('click', function (e) { var b = e.target.closest('.sc-tab'); if (b) open(b.getAttribute('data-sc')); });
  document.getElementById('rail').addEventListener('click', function (e) {
    var b = e.target.closest('.rail-slot'); if (!b) return;
    S.slot = b.getAttribute('data-slot'); S.preview = null; redraw(); playPreview(true);
  });
  var panel = document.getElementById('slotpanel');
  panel.addEventListener('click', function (e) {
    var by = e.target.closest('[data-buy]');
    if (by) { if (!by.disabled) siteBuy(by.getAttribute('data-buy')); return; }
    var eq = e.target.closest('[data-equip]');
    if (eq && eq.disabled) return;
    if (eq) { equip(eq.getAttribute('data-equip')); return; }
    var t = e.target.closest('.tile[tabindex]');
    if (t) { var k = t.getAttribute('data-tile'); S.preview = { slot: S.slot, itemId: k === '' ? null : k }; redraw(); playPreview(true); }
  });
  panel.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target.closest('.tile[tabindex]'); if (!t || e.target.closest('button')) return;
    e.preventDefault(); var k = t.getAttribute('data-tile'); S.preview = { slot: S.slot, itemId: k === '' ? null : k }; redraw(); playPreview(true);
    var again = document.querySelector('.tile[data-tile="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]'); if (again) again.focus();
  });
  document.getElementById('replay').addEventListener('click', function () { playPreview(true); });
  // The boast is drawn where the board was when it started (the effects
  // canvas works in page coordinates), so a scroll restarts it once the page
  // settles rather than letting it drift off the board.
  window.addEventListener('scroll', function () {
    if (!S) return;
    if (BOAST.active()) { stopPreview(); stats.restarts++; }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { playPreview(false); }, LOADOUT_SCROLL_SETTLE_MS);
  }, { passive: true });
  window.addEventListener('resize', function () { if (S) { clearTimeout(scrollTimer); scrollTimer = setTimeout(function () { playPreview(false); }, LOADOUT_SCROLL_SETTLE_MS); } });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopPreview(); else if (S) playPreview(false); });
  window.__loadout = { snd: SND, coin: COINPV, open: open, state: function () { return S ? { scenario: S.sc.key, slot: S.slot, loadout: S.state, preview: S.preview, busy: busy, credits: S.sc.credits } : null; }, stats: function () { return stats; }, boast: BOAST };
  if (SITE) {
    // Waits, empty, for the website's first show().
    document.getElementById('close').addEventListener('click', siteClose);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S) { e.preventDefault(); siteClose(); } });
    window.LOADOUT = { show: show, close: siteClose, ready: true };
  } else open(DATA.scenarios[0].key);
`;

export const LOADOUT_CSS = `
body { padding: 12px 16px 40px; }
#picker { max-width: 1240px; margin: 0 auto; position: relative; z-index: 1; }
.pk-top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 16px; margin: 4px 0 10px; }
.pk-brand { font-size: 0.8rem; letter-spacing: 0.14em; color: var(--ink-dim); }
.sc-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.sc-tab, .rail-slot, .t-equip, #replay, #snd { font: inherit; color: var(--ink); background: var(--panel-2); border: 1px solid var(--line); border-radius: 5px; cursor: pointer; }
.sc-tab { font-size: 0.72rem; padding: 4px 10px; color: var(--ink-dim); }
.sc-tab.on { color: var(--ink); border-color: var(--ink-dim); }
.agent-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 10px 14px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
.agent-head h1 { margin: 0; font-size: 1.15rem; letter-spacing: 0.08em; }
.agent-head .faction-tag { font-size: 0.7rem; padding: 1px 6px; border-radius: 3px; border: 1px solid var(--fc); color: var(--fc); }
.agent-head .credits { margin-left: auto; font-size: 0.78rem; color: var(--ink-dim); }
.agent-head .credits b { color: var(--ink); }
.sc-note { width: 100%; font-size: 0.7rem; color: var(--ink-dim); line-height: 1.4; }
.livelock { margin: 8px 0 0; padding: 8px 12px; border-radius: 6px; font-size: 0.74rem; line-height: 1.4; color: var(--ink); border: 1px solid color-mix(in srgb, var(--bad) 60%, transparent); background: color-mix(in srgb, var(--bad) 10%, transparent); }
.livelock b { color: var(--bad); letter-spacing: 0.05em; }
.pk-grid { display: grid; grid-template-columns: minmax(0, 800px) minmax(0, 1fr); gap: 14px; margin-top: 12px; align-items: start; }
.stage { position: sticky; top: 8px; z-index: 2; border: 1px solid var(--line); border-radius: 8px; padding: 8px; background: var(--bg); box-shadow: 0 10px 18px -12px #000; }
.stage-board .st-foe .hud { padding: 5px 10px; }
.stage-board .st-foe .hud .meta { margin-top: 2px; }
.stage-board #st-side-w { margin: 6px 0; }
.stage-board .board-row { min-height: 0; padding: 4px 0; }
.pickcard { background: linear-gradient(160deg, color-mix(in srgb, var(--fc) 70%, #fff 0%), color-mix(in srgb, var(--fc) 35%, #000)); display: flex; flex-direction: column; }
.pickcard .art { background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.25), rgba(0,0,0,0) 60%); }
.st-capbar { display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 0.74rem; color: var(--ink-dim); min-height: 1.6em; }
#st-cap { flex: 1; min-width: 0; }
#st-cap b { color: var(--ink); letter-spacing: 0.04em; }
.cap-lock { color: var(--neutral); font-size: 0.66rem; letter-spacing: 0.06em; border: 1px solid currentColor; border-radius: 3px; padding: 0 4px; margin-left: 4px; white-space: nowrap; }
.cap-note { color: var(--bad); }
#replay, #snd { font-size: 0.7rem; padding: 3px 9px; }
.side-col { min-width: 0; }
.rail { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 6px; }
.rail-slot { text-align: left; padding: 7px 8px; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.rail-slot .rs-label { font-size: 0.62rem; letter-spacing: 0.1em; color: var(--ink-dim); text-transform: uppercase; }
.rail-slot .rs-val { font-size: 0.72rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rail-slot.on { border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink) inset; }
.slotpanel { margin-top: 10px; border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: var(--panel); }
.slot-head .sh-label { font-size: 0.86rem; letter-spacing: 0.1em; text-transform: uppercase; }
.slot-head .sh-exp { font-size: 0.7rem; color: var(--ink-dim); margin: 3px 0 8px; line-height: 1.4; }
.tiles { display: flex; flex-direction: column; gap: 7px; }
.tile { display: grid; grid-template-columns: 46px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px; border-radius: 7px; border: 1px solid var(--line); background: var(--panel-2); position: relative; }
.tile[tabindex] { cursor: pointer; }
.tile[tabindex]:hover, .tile[tabindex]:focus-visible { border-color: var(--ink-dim); outline: none; }
.tile.previewing { border-color: var(--fc); box-shadow: 0 0 0 1px var(--fc) inset, 0 0 14px -6px var(--fc); }
.tile.equipped::before { content: ""; position: absolute; left: -1px; top: 8px; bottom: 8px; width: 3px; border-radius: 2px; background: var(--fc); }
.t-swatch { width: 46px; height: 46px; border-radius: 8px; position: relative; overflow: hidden;
  background: radial-gradient(circle at 50% 120%, color-mix(in srgb, var(--fc) 55%, transparent), transparent 70%), #05070e; box-shadow: 0 0 0 1px color-mix(in srgb, var(--fc) 60%, transparent) inset; }
.t-swatch span { position: absolute; left: 50%; top: 52%; width: 22px; height: 25px; transform: translate(-50%, -50%);
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); background: linear-gradient(180deg, color-mix(in srgb, var(--fc) 40%, #fff), var(--fc)); box-shadow: 0 0 10px var(--fc); }
.t-swatch svg { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: color-mix(in srgb, var(--fc) 75%, #fff); filter: drop-shadow(0 0 4px var(--fc)); }
.tile.empty .t-swatch { background: repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 5px, transparent 5px 10px), #05070e; box-shadow: 0 0 0 1px var(--line) inset; }
.tile.empty .t-swatch span { background: none; box-shadow: 0 0 0 1px var(--ink-dim) inset; clip-path: none; border: 1px dashed var(--ink-dim); width: 18px; height: 18px; border-radius: 3px; }
.t-name { font-size: 0.82rem; font-weight: bold; letter-spacing: 0.04em; color: var(--fc); display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.tile.empty .t-name { color: var(--ink); }
.t-src { font-size: 0.6rem; font-weight: normal; letter-spacing: 0.08em; color: var(--ink-dim); border: 1px solid var(--line); border-radius: 3px; padding: 0 4px; }
.t-tag { font-size: 0.62rem; letter-spacing: 0.08em; color: var(--ink-dim); margin-top: 1px; }
.t-desc { font-size: 0.68rem; line-height: 1.35; color: var(--ink); opacity: 0.86; margin-top: 3px; }
.t-act { text-align: right; }
.t-equip { font-size: 0.72rem; padding: 5px 12px; }
.t-equip:hover, .t-equip:focus-visible { border-color: var(--ink); }
.is-live .t-equip { color: var(--ink-dim); border-style: dashed; }
.t-on { font-size: 0.66rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--fc); }
.tile.empty .t-on { color: var(--ink); }
.tile.locked { background: repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 8px, transparent 8px 16px), var(--panel-2); }
.tile.locked .t-swatch, .tile.locked .t-body { opacity: 0.62; filter: saturate(0.55); }
.t-lock { font-size: 0.68rem; color: var(--neutral); border: 1px solid color-mix(in srgb, var(--neutral) 50%, transparent); border-radius: 5px; padding: 5px 8px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; max-width: 128px; text-align: right; }
.t-lock .lock-ico { display: inline-block; width: 9px; height: 7px; border: 1.5px solid currentColor; border-radius: 1px; margin-right: 6px; position: relative; top: 1px; }
.t-lock .lock-ico::before { content: ""; position: absolute; left: 0.5px; top: -6px; width: 5px; height: 5px; border: 1.5px solid currentColor; border-bottom: none; border-radius: 4px 4px 0 0; }
.t-short { color: var(--ink-dim); font-size: 0.6rem; }
.none-yet { font-size: 0.72rem; color: var(--ink-dim); line-height: 1.4; margin-top: 8px; padding: 8px 10px; border: 1px dashed var(--line); border-radius: 6px; }
.hint { font-size: 0.64rem; color: var(--ink-dim); margin-top: 8px; }
.toast { position: fixed; left: 50%; bottom: 18px; transform: translate(-50%, 20px); opacity: 0; z-index: 120; pointer-events: none; font-size: 0.76rem; padding: 8px 14px; border-radius: 6px; background: rgba(10,12,22,0.95); border: 1px solid var(--line); max-width: min(560px, calc(100vw - 32px)); transition: opacity 200ms ease, transform 200ms ease; }
.toast.show { opacity: 1; transform: translate(-50%, 0); }
.toast.ok { border-color: color-mix(in srgb, var(--good) 60%, transparent); }
.toast.no { border-color: color-mix(in srgb, var(--bad) 70%, transparent); color: #ffd7de; }
/* The preview loops: a Skip button would only interrupt a loop. Escape and
 * a tap still end the current pass (it starts again). */
.boast-skip, .skip-hint { display: none !important; }
/* The coin preview (render session 55): its canvas over the preview board
 * (the stage is sticky, so it holds the canvas's absolute box). */
.coin-cv { position: absolute; z-index: 3; pointer-events: none; border-radius: 6px; }
.t-swatch.coin { background: radial-gradient(circle at 50% 40%, rgba(255,255,255,0.08), transparent 70%), #05070e; box-shadow: 0 0 0 1px var(--line) inset; }
.t-swatch canvas.t-coin { width: 100%; height: 100%; display: block; }
/* The website's full-screen picker (site mode): a Close button at the end of the top line. */
.pk-close { margin-left: auto; font: inherit; font-size: 0.78rem; color: var(--ink); background: var(--panel-2); border: 1px solid var(--line); border-radius: 5px; padding: 5px 14px; cursor: pointer; }
.pk-close:hover, .pk-close:focus-visible { border-color: var(--ink); }
.t-buy { border-color: color-mix(in srgb, var(--good) 60%, var(--line)); }
.t-equip[disabled] { opacity: 0.55; cursor: progress; }
.t-act .t-short { margin-top: 3px; }
@media (max-width: 1180px) {
  .pk-grid { grid-template-columns: minmax(0, 1fr); }
  .stage { max-width: 800px; }
}
@media (max-width: 640px) {
  body { padding: 8px 10px 40px; }
  .stage { top: 0; border-radius: 0 0 8px 8px; padding: 6px; }
  .stage-board .board-row { zoom: 0.56; max-width: 420px; margin: 0 auto; gap: 6px; }
  .stage-board .hud { padding: 5px 8px; font-size: 0.8rem; }
  .stage-board .st-foe .hud .meta { display: none; }
  .st-capbar { margin-top: 4px; font-size: 0.68rem; flex-wrap: wrap; gap: 4px 10px; }
  #st-cap { flex-basis: 100%; }
  .rail { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tile { grid-template-columns: 38px minmax(0, 1fr); }
  .t-swatch { width: 38px; height: 38px; }
  .t-act { grid-column: 1 / -1; text-align: left; }
  .t-lock { align-items: flex-start; flex-direction: row; gap: 8px; max-width: none; text-align: left; }
  .agent-head .credits { margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) { .toast { transition: none; } }
`;

export function renderLoadoutHtml(data: LoadoutPageData): string {
  const embed = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en" data-theme="dark"${data.site ? ' class="site"' : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${data.title.replace(/</g, "&lt;")}</title>
<style>${CSS}
${LOADOUT_CSS}</style>
</head>
<body>
<main id="picker"${data.site ? " hidden" : ""}>
<div class="pk-top"><span class="pk-brand">AI·TCG // AGENT LOADOUT</span><div class="sc-tabs" id="sc-tabs" aria-label="Store states"${data.site ? " hidden" : ""}></div>${data.site ? '<button type="button" class="pk-close" id="close" title="Back to the Store. Everything you equipped is already saved.">Close</button>' : ""}</div>
<header class="agent-head"><h1 id="ag-name"></h1><span class="faction-tag" id="ag-faction"></span><span class="credits" id="ag-balance">Owner's balance: <b id="ag-credits"></b></span><div class="sc-note" id="sc-note"></div></header>
<div class="livelock" id="livelock" hidden></div>
<div class="pk-grid">
<section class="stage" id="stage" aria-label="Preview"><div class="stage-board" id="stage-board"></div><canvas class="coin-cv" id="coin-cv" hidden aria-hidden="true"></canvas>
<div class="st-capbar"><span id="st-cap"></span><span data-audio-ctl><button type="button" id="snd">Sound on</button> <input type="range" id="sndvol" min="0" max="100" value="80" aria-label="Effects volume"></span><button type="button" id="replay">Replay</button></div></section>
<section class="side-col"><nav class="rail" id="rail" aria-label="Loadout slots"></nav><div class="slotpanel" id="slotpanel"></div></section>
</div>
</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="fx-atlases">${JSON.stringify(fxAtlasDataUris())}</script>
<script type="application/json" id="loadout-data">${embed(data)}</script>
<script>
(function () {
${CANVAS_FX_PURE_SOURCE}
${CANVAS_FX_RUNTIME_SOURCE}
${SOUND_FX_PURE_SOURCE}
${SOUND_FX_RUNTIME_SOURCE}
${BOAST_PURE_SOURCE}
${COIN_PURE_SOURCE}
${COIN_RUNTIME_SOURCE}
${LOADOUT_PURE_SOURCE}
  // On the owner website the sound setting is the account's (the host's
  // { read, write } store, as the pack opening's); standalone, the browser's.
  var LOADOUT_SITE_SOUND = (function () {
    try { var h = window.parent && window.parent !== window && window.parent.LOADOUT_SITE_HOST; if (h && h.sound) return h.sound; } catch (e) { /* another origin */ }
    return undefined;
  })();
  SND.mount(document.getElementById('snd'), document.getElementById('sndvol'), ${data.site ? "LOADOUT_SITE_SOUND || { read: function () { return null; }, write: function () {} }" : "undefined"});
  // The preview's stings sound only on a pass the viewer asked for (a tap
  // on an item, a slot or Replay), never on the loop's repeats. A pass's
  // sounds are one sequence on the audio clock (render session 39), so the
  // choice is made as the pass starts: a repeat gets no sequence.
  var SOUND_OK = false;
  var REDUCED_PICK = CFX.kit.reduced;
  var BOAST = (function (SND) {
${BOAST_RUNTIME_SOURCE}
    return BOAST;
  })({ play: function () { if (SOUND_OK) return SND.play.apply(SND, arguments); },
    sequence: function (list, o) { return SOUND_OK ? SND.sequence(list, o) : null; } });
${LOADOUT_RUNTIME_SOURCE}
})();
</script>
</body>
</html>
`;
}
