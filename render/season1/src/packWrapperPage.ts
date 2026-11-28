// The pages for the owner (render session 95): the three wrapper designs
// side by side with their light (output/pack-wrappers.html), and the pick
// row in each design (output/pack-pick.html?design=crest|window|bleed).
//
// Pure: HTML strings out. Self-contained: no outside requests. Fenced off in
// render/season1/.

import { esc } from "../../src/site/siteModel.js";
import { DESIGNS, LIGHT_JS, MASCOTS, packCss, packHtml, S1_FIRST, type DesignId } from "./packWrapper.js";
import { PICK_JS, ROW_COUNT, ROW_START } from "./packPick.js";
import { RUNG_OF } from "../../src/packOpening.js";
import { TEAR_JS, tearLight, type BestFinish } from "./packTear.js";

/** The neon night the opening plays in (the storyboard's room), as a page. */
const ROOM_CSS = `
:root { color-scheme: dark; --ink: #eef1ff; --muted: #a9b2d6; --line: rgba(255,255,255,.12); }
* { box-sizing: border-box; }
html, body { margin: 0; }
html { background: #05071a; }
body { min-height: 100vh; color: var(--ink); font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: linear-gradient(rgba(120,140,255,.07) 1px, transparent 1px) 0 0 / 100% 28px, radial-gradient(ellipse 80% 45% at 50% 30%, #1b2366, transparent 70%), linear-gradient(180deg, #05071a, #0b1030 60%, #05071a); }
main { max-width: 1240px; margin: 0 auto; padding: 28px 16px 64px; }
h1 { font-size: 26px; margin: 0 0 6px; } h2 { font-size: 19px; margin: 34px 0 6px; } p { margin: 4px 0 10px; color: var(--muted); max-width: 72ch; }
.kick { font: 700 11px ui-monospace, Menlo, monospace; letter-spacing: .22em; text-transform: uppercase; color: #8fa6ff; }
a { color: #a9bbff; }
.designs { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 26px; margin-top: 18px; }
.design { border: 1px solid var(--line); border-radius: 18px; padding: 22px 18px 18px; background: rgba(10,14,40,.55); display: flex; flex-direction: column; align-items: center; gap: 14px; }
.design h3 { margin: 0; font-size: 17px; align-self: flex-start; } .design p { margin: 0; font-size: 13.5px; align-self: stretch; }
.stage { display: grid; place-items: center; padding: 8px 0 44px; width: 100%; }
.covers { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; padding-bottom: 26px; }
.sizes { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; justify-content: center; padding: 14px; border-radius: 14px; background: linear-gradient(135deg, #eef1fb, #dfe5f6); width: 100%; }
.sizes figure { margin: 0; display: grid; justify-items: center; gap: 6px; } .sizes figcaption { font-size: 11.5px; color: #3e4868; }
.drive { font: 600 12px ui-monospace, Menlo, monospace; color: #9fb0e8; }
button { font: 600 13px system-ui, sans-serif; color: var(--ink); background: rgba(255,255,255,.08); border: 1px solid var(--line); border-radius: 999px; padding: 7px 14px; cursor: pointer; }
button:focus-visible, .slot:focus-visible { outline: 2px solid #8fa6ff; outline-offset: 4px; }
`;

/** The light driver, shared by both pages: the pointer over a live pack
 * (desktop), the device's tilt where the browser gives it (a phone; iOS asks
 * first, behind a button), else the slow sweep; reduced motion holds the
 * still pose and listens to nothing. ?light=still|sweep forces one (the
 * checks use it). */
const LIGHT_DRIVER = `
${LIGHT_JS}
const Q = new URLSearchParams(location.search);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FORCED = Q.get('light');
const driver = { mode: REDUCED ? 'still' : (FORCED || 'sweep'), pointer: null, tilt: null, lastPointer: -1e9 };
function applyLight(el, pose) {
  el.style.setProperty('--ty', pose.turnY + 'deg'); el.style.setProperty('--tx', pose.turnX + 'deg');
  el.style.setProperty('--lx', pose.lx + '%'); el.style.setProperty('--ly', pose.ly + '%'); el.style.setProperty('--lx-n', pose.lx);
  el.style.setProperty('--holo', pose.holo + '%');
}
function liveInput(el, now) {
  if (driver.mode === 'still') return { mode: 'still' };
  if (FORCED === 'sweep') return { mode: 'sweep', t: now };
  if (driver.pointer && now - driver.lastPointer < 2500) {
    const r = el.getBoundingClientRect();
    return { mode: 'pointer', px: (driver.pointer.x - (r.left + r.width / 2)) / (r.width * 1.2), py: (driver.pointer.y - (r.top + r.height / 2)) / (r.height * 1.2) };
  }
  if (driver.tilt) return { mode: 'tilt', beta: driver.tilt.beta, gamma: driver.tilt.gamma };
  return { mode: 'sweep', t: now };
}
function lightLoop() {
  const now = performance.now();
  let shown = 'still';
  for (const el of document.querySelectorAll('.pw[data-live]')) { const inp = liveInput(el, now); shown = inp.mode; applyLight(el, lightAt(inp)); }
  const tag = document.getElementById('drive'); if (tag) tag.textContent = 'Light: ' + ({ still: REDUCED ? 'still (reduced motion)' : 'still', pointer: 'following the pointer', tilt: 'following the tilt', sweep: 'slow sweep' })[shown];
  if (driver.mode !== 'still') requestAnimationFrame(lightLoop);
}
if (driver.mode !== 'still' && FORCED !== 'sweep') {
  addEventListener('pointermove', (e) => { if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && (e.movementX || e.movementY)) { driver.pointer = { x: e.clientX, y: e.clientY }; driver.lastPointer = performance.now(); } }, { passive: true });
  const onTilt = (e) => { if (e.beta != null && e.gamma != null) driver.tilt = { beta: e.beta, gamma: e.gamma }; };
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function' && matchMedia('(pointer: coarse)').matches) {
    const b = document.getElementById('tilt'); if (b) { b.hidden = false; b.onclick = () => DOE.requestPermission().then((s) => { if (s === 'granted') addEventListener('deviceorientation', onTilt); b.hidden = true; }).catch(() => { b.hidden = true; }); }
  } else if (DOE) addEventListener('deviceorientation', onTilt);
}
requestAnimationFrame(lightLoop);
`;

function shell(title: string, body: string, script: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>` +
    `<style>${ROOM_CSS}${packCss()}${PICK_CSS}</style></head><body>${body}<script>${script}</script></body></html>`;
}

/** The three designs, each large with its light, in the four covers, and at
 * the sizes the Home and the Store draw packs. */
export function packWrappersPage(): string {
  const cards = DESIGNS.map((d) => `
  <section class="design" data-design-card="${d.id}">
    <h3>${esc(d.name)}</h3>
    <div class="stage">${packHtml({ design: d.id, mascot: "Cortex", px: 250, attrs: `data-live data-hero` })}</div>
    <p>${esc(d.pitch)}</p>
    <div class="covers">${MASCOTS.map((m) => packHtml({ design: d.id, mascot: m, px: 112, attrs: "data-live data-cover" })).join("")}</div>
    <div class="sizes">${[[128, "Pick row, far"], [96, "Store L"], [62, "Store M"]].map(([px, what]) => `<figure>${packHtml({ design: d.id, mascot: "Aegis", px: px as number, attrs: "data-size" })}<figcaption>${esc(String(what))} · ${px} px</figcaption></figure>`).join("")}</div>
    <a href="pack-pick.html?design=${d.id}">Pick a pack in this design →</a>
  </section>`).join("");
  const body = `<main>
  <div class="kick">Season 1 · phase 2 · render session 95</div>
  <h1>Booster packs: three wrapper designs</h1>
  <p>The sealed pack as an object: crimped seals top and bottom, a pillow curve across the face, light on the edges, a highlight that slides as the pack turns, a holographic sheen, a soft reflection and a glow. Move the pointer over the page (or tilt a phone) and the packs follow it; left alone, the light sweeps slowly. With reduced motion it holds still.</p>
  <p>Every design carries the AI·TCG wordmark, the set's name as its title ("${esc("Set name")}" until the set is named), "Season 1" and the set code ${esc(S1_FIRST.code)} small, and the set symbol. The mascots are placeholder art; January's art pass fills the same space.</p>
  <p><span class="drive" id="drive">Light: …</span> <button type="button" id="tilt" hidden>Use the phone's tilt</button></p>
  <div class="designs">${cards}</div>
</main>`;
  return shell("Season 1 packs: wrapper designs", body, LIGHT_DRIVER);
}

// ---------- the pick row ----------

/** The centre pack's width in the row (px, before the row scales to the screen). */
export const PICK_PX = 270;

const PICK_CSS = `
.pick { position: relative; height: min(620px, 78vh); margin-top: 12px; overflow: hidden; touch-action: pan-y; user-select: none; -webkit-user-select: none; outline: none; }
.pick .row { position: absolute; left: 50%; top: 46%; width: 0; height: 0; perspective: 1400px; }
.slot { position: absolute; left: ${-PICK_PX / 2}px; top: ${-PICK_PX * 0.8}px; transform-origin: 50% 50%; cursor: pointer; will-change: transform, filter; }
.slot .pw { transition: none; }
.pick.picked .slot:not(.chosen) { opacity: 0 !important; transition: opacity .45s ease-out; }
.slot.chosen { transition: transform .5s cubic-bezier(.2,.8,.2,1); }
.picked-note { text-align: center; min-height: 1.5em; color: var(--ink); margin-left: auto; margin-right: auto; }
.designs-nav { display: flex; gap: 8px; flex-wrap: wrap; } .designs-nav a { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); text-decoration: none; } .designs-nav a[aria-current] { background: rgba(143,166,255,.22); }
@media (prefers-reduced-motion: reduce) { .pick.picked .slot:not(.chosen), .slot.chosen { transition: none; } }
.pick.picked { cursor: default; touch-action: none; }
html.tearing, html.tearing body { touch-action: none; } /* until the pack is open, a swipe anywhere near it is a tear, never a scroll */
.slot.chosen .pw { translate: var(--shx, 0px) var(--shy, 0px); rotate: var(--lean, 0deg); }
.ov { position: absolute; left: 0; top: 0; width: ${PICK_PX}px; height: ${PICK_PX * 1.6}px; pointer-events: none; }
.ov svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.tearcue { position: absolute; left: 4%; right: 4%; top: calc(12.5 / 160 * 100% - 7px); height: 14px; transition: opacity .5s ease-out; }
.tearcue::before { content: ""; position: absolute; left: 0; right: 0; top: 6px; height: 2px; border-radius: 2px;
  background: repeating-linear-gradient(90deg, rgba(190,210,255,.85) 0 10px, transparent 10px 18px); background-size: 36px 2px; box-shadow: 0 0 8px rgba(150,180,255,.55); animation: cuedash 1.6s linear infinite; }
.tearcue i { position: absolute; top: 0; width: 0; height: 0; border: 7px solid transparent; }
.tearcue i.l { left: -10px; border-left-color: rgba(220,230,255,.9); animation: cuenudge 1.8s ease-in-out infinite; }
.tearcue i.r { right: -10px; border-right-color: rgba(220,230,255,.9); animation: cuenudge 1.8s ease-in-out infinite reverse; }
.tearcue.gone { opacity: 0; }
.tearcue.nudge { animation: cuebob .5s ease-out; }
@keyframes cuedash { to { background-position: 36px 0; } }
@keyframes cuenudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(5px); } }
@keyframes cuebob { 0% { transform: translateY(0); } 35% { transform: translateY(-6px); } 100% { transform: translateY(0); } }
.seam { position: absolute; left: 3%; right: 3%; top: calc(10.5 / 160 * 100%); height: calc(4 / 160 * 100%); border-radius: 50%; opacity: 0; transition: opacity .6s ease-out;
  background: linear-gradient(90deg, transparent, var(--tell) 14%, var(--tell) 86%, transparent); filter: blur(2.5px); box-shadow: 0 0 14px 3px color-mix(in srgb, var(--tell) 60%, transparent); }
.leak { position: absolute; left: -40%; right: -40%; top: -60%; height: 90%; opacity: 0; pointer-events: none;
  background: radial-gradient(48% 44% at 50% 78%, var(--tell), transparent 72%); mix-blend-mode: screen; }
.stack { position: absolute; left: 13%; width: 74%; top: 9%; aspect-ratio: 5 / 7; z-index: -1; }
.stack .back { position: absolute; inset: 0; border-radius: 6%; background:
  radial-gradient(60% 40% at 50% 45%, rgba(143,166,255,.35), transparent 70%),
  repeating-linear-gradient(60deg, rgba(255,255,255,.05) 0 2px, transparent 2px 9px),
  linear-gradient(160deg, #1a2160, #0a0d26 60%, #141a4a);
  box-shadow: inset 0 0 0 3px rgba(200,215,255,.55), inset 0 0 0 7px rgba(10,13,38,.9), inset 0 0 0 8px rgba(200,215,255,.25), 0 6px 18px rgba(0,0,0,.55);
  display: grid; place-items: center; }
.stack .back span { font: 900 22px system-ui, sans-serif; letter-spacing: .08em; color: rgba(230,236,255,.85); text-shadow: 0 0 10px rgba(120,150,255,.8); }
.scrap { position: absolute; width: 9px; height: 6px; background: linear-gradient(135deg, #e6ecff, #7d88aa); clip-path: polygon(0 20%, 70% 0, 100% 60%, 30% 100%); }
.controls { display: flex; gap: 14px; align-items: center; justify-content: center; flex-wrap: wrap; font-size: 13px; color: var(--muted); margin-top: 6px; }
.controls label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .tearcue::before, .tearcue i { animation: none; } .tearcue.nudge { animation: none; } }
`;

/** The pick row in one design. Every slot is the same markup: one pack,
 * cloned; only its place tells it apart. */
export function packPickPage(): string {
  const pack = (id: DesignId) => packHtml({ design: id, mascot: "Cortex", px: PICK_PX });
  const templates = DESIGNS.map((d) => `<template id="tpl-${d.id}">${pack(d.id)}</template>`).join("");
  const lights = Object.fromEntries((Object.keys(RUNG_OF) as BestFinish[]).map((b) => [b, { full: tearLight(b, false), reduced: tearLight(b, true) }]));
  const body = `<main>
  <div class="kick">Season 1 · the opening · render session 96</div>
  <h1>Pick a pack, then tear it open</h1>
  <p>Swipe or scroll along the row; tap a side pack to bring it to the middle, tap the middle one to pick it. Hold your pack to grip it, then drag across its top to tear it open. Keys: arrows move, Enter picks, Enter tears.</p>
  <nav class="designs-nav" aria-label="Wrapper design">${DESIGNS.map((d) => `<a href="?design=${d.id}" data-design-link="${d.id}">${esc(d.name)}</a>`).join("")} <a href="pack-wrappers.html">All three designs</a></nav>
  <div class="pick" id="pick" tabindex="0" role="listbox" aria-label="Packs to pick from"><div class="row" id="row"></div></div>
  <p class="picked-note" id="note" aria-live="polite"></p>
  <div class="controls"><label><input type="checkbox" id="sound" checked> Sound</label><label><input type="checkbox" id="lessflash"> Reduce flashing</label></div>
  <p class="drive" id="drive"></p><button type="button" id="tilt" hidden>Use the phone's tilt</button>
</main>${templates}<script type="application/json" id="tear-lights">${JSON.stringify(lights)}</script>`;
  return shell("Season 1 packs: pick and tear", body, LIGHT_DRIVER + PICK_CLIENT + TEAR_CLIENT);
}

const PICK_CLIENT = `
${PICK_JS}
const START = ${ROW_START};
const design = ['crest','window','bleed'].includes(Q.get('design')) ? Q.get('design') : 'crest';
document.querySelector('[data-design-link="' + design + '"]').setAttribute('aria-current', 'page');
const row = document.getElementById('row'), pick = document.getElementById('pick'), note = document.getElementById('note');
const tpl = document.getElementById('tpl-' + design).content.firstElementChild;
const slots = [];
for (let k = 0; k < ROW_COUNT; k++) {
  const s = document.createElement('div');
  s.className = 'slot'; s.dataset.slot = String(k); s.setAttribute('role', 'option'); s.setAttribute('aria-label', 'Pack ' + (k + 1) + ' of ' + ROW_COUNT);
  s.appendChild(tpl.cloneNode(true));
  row.appendChild(s); slots.push(s);
}
const PX = ${PICK_PX};
// The centre pack's drawn width: the row's own size on a desktop, larger share of a phone's width.
const unitPx = () => Math.min(PX, pick.clientWidth * (pick.clientWidth < 600 ? 0.56 : 0.42));
const S = window.__row = { pos: START, vel: 0, target: START, dragging: false, picked: null, events: [] };
function layout() {
  const unit = unitPx();
  for (let k = 0; k < slots.length; k++) {
    const s = slots[k], p = slotPose(k - S.pos), pw = s.firstElementChild;
    if (S.picked === k) continue;
    s.style.transform = 'translateX(' + (p.x * unit).toFixed(1) + 'px) scale(' + (p.scale * unit / PX).toFixed(4) + ') rotateY(' + p.rotY + 'deg)';
    s.style.zIndex = String(p.z); s.style.opacity = String(p.opacity); s.style.filter = p.light < 1 ? 'brightness(' + p.light + ')' : 'none';
    if (Math.round(S.pos) === k) { pw.setAttribute('data-live', ''); s.setAttribute('aria-selected', 'true'); } else { pw.removeAttribute('data-live'); s.removeAttribute('aria-selected'); applyLight(pw, lightAt({ mode: 'still' })); }
  }
}
let last = performance.now();
function tick(now) {
  const dt = Math.min(64, now - last); last = now;
  if (!S.dragging && S.picked === null && (S.pos !== S.target || S.vel !== 0)) {
    if (REDUCED) { S.pos = S.target; S.vel = 0; } else { const r = ease(S.pos, S.vel, S.target, dt); S.pos = r.pos; S.vel = r.vel; }
  }
  layout();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
function goTo(k) { if (S.picked !== null) return; S.target = Math.max(0, Math.min(ROW_COUNT - 1, k)); }
function choose() {
  if (S.picked !== null) return;
  const k = Math.round(S.target); S.pos = S.target = k; S.vel = 0; layout();
  S.picked = k; S.events.push({ slot: k });
  pick.classList.add('picked');
  const s = slots[k]; s.classList.add('chosen');
  const u = unitPx() / PX; s.style.transform = 'translateY(-5%) scale(' + (1.08 * u).toFixed(4) + ')'; s.style.filter = 'none';
  pick.setAttribute('aria-label', 'Your pack: drag across its top to tear it open, or press Enter');
  // On the site: the page sends only the slot; the server opens that slot's own roll, kept on the server, and sends back its cards.
  dispatchEvent(new CustomEvent('packpick', { detail: { slot: k } }));
}
pick.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') { goTo(Math.round(S.target) - 1); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { goTo(Math.round(S.target) + 1); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === ' ') { if (S.picked === null) choose(); else if (window.__tearKey) window.__tearKey(); e.preventDefault(); }
});
let drag = null;
pick.addEventListener('pointerdown', (e) => { if (S.picked !== null) return; drag = { x0: e.clientX, pos0: S.pos, moved: 0, samples: [{ t: e.timeStamp, x: e.clientX }], slot: e.target.closest('.slot') }; try { pick.setPointerCapture(e.pointerId); } catch (_) {} });
pick.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x0; drag.moved = Math.max(drag.moved, Math.abs(dx));
  if (drag.moved > 6) { S.dragging = true; S.pos = Math.max(-0.4, Math.min(ROW_COUNT - 0.6, drag.pos0 + dragSlots(dx, unitPx()))); }
  drag.samples.push({ t: e.timeStamp, x: e.clientX }); if (drag.samples.length > 6) drag.samples.shift();
});
pick.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const d = drag; drag = null;
  if (!S.dragging) { // a tap
    const k = d.slot ? Number(d.slot.dataset.slot) : null;
    if (k !== null) { if (k === Math.round(S.pos) && Math.abs(S.pos - k) < 0.05) choose(); else goTo(k); }
    return;
  }
  S.dragging = false;
  const a = d.samples[0], b = d.samples[d.samples.length - 1];
  const v = b.t > a.t ? dragSlots(b.x - a.x, unitPx()) / (b.t - a.t) : 0;
  S.vel = REDUCED ? 0 : v; S.target = restingSlot(S.pos, v);
});
let wheelAcc = 0, wheelAt = 0;
pick.addEventListener('wheel', (e) => {
  if (S.picked !== null) return;
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (e.timeStamp - wheelAt > 250) wheelAcc = 0; wheelAt = e.timeStamp; wheelAcc += d;
  if (Math.abs(wheelAcc) >= 60) { goTo(Math.round(S.target) + Math.sign(wheelAcc)); wheelAcc = 0; }
  e.preventDefault();
}, { passive: false });
`;

// ---------- the grip, the tear and the open (render session 96) ----------

/** After the pick: the grip, the tear and the open (packTear.ts; the
 * storyboard's beats 2-4). The page knows nothing of the pack's cards: on
 * the site, the pick goes to the server and it answers with the best card's
 * finish (for the honest tell) and, after the tear, the cards. Here a stand-in
 * answers, with ?best=plain|foil|fullArt|gold|prototype|zeroDay (default
 * plain) to show each tell. */
const TEAR_CLIENT = `
${TEAR_JS}
const LIGHTS = JSON.parse(document.getElementById('tear-lights').textContent);
const lessFlash = document.getElementById('lessflash'), soundBox = document.getElementById('sound');
if (Q.get('flash') === 'reduced') lessFlash.checked = true;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const O = window.__open = { phase: 'row', best: null, progress: 0, cut: 0, dir: 1, tears: 0, events: [], zone: null, heldMs: 0, scraps: 0, how: null };
let ov = null, cue = null, seam = null, leak = null, svgCut = null, stack = null, pwEl = null, slotEl = null;
const light = () => LIGHTS[O.best] ? LIGHTS[O.best][lessFlash.checked ? 'reduced' : 'full'] : LIGHTS.plain.full;

// --- sound: made at play time (WebAudio noise and tones, no files), after the first gesture ---
const SND = { ctx: null, tear: null };
function audio() {
  if (!soundBox.checked) return null;
  try { if (!SND.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; SND.ctx = new C(); SND.master = SND.ctx.createDynamicsCompressor(); SND.master.connect(SND.ctx.destination); } if (SND.ctx.state === 'suspended') SND.ctx.resume(); return SND.ctx; } catch (_) { return null; }
}
function noiseBuf(c) { if (SND.buf) return SND.buf; const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (SND.buf = b); }
function crinkle(strength) { // one crackle of foil under the finger
  const c = audio(); if (!c) return;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
  src.buffer = noiseBuf(c); f.type = 'highpass'; f.frequency.value = 2500 + Math.random() * 3500;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.04 + 0.1 * strength, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.03 + Math.random() * 0.04);
  src.connect(f); f.connect(g); g.connect(SND.master); src.start(t, Math.random() * 0.9, 0.09);
}
function tearSound(speed) { // the rip: its pitch and grain follow the finger's speed (px per ms)
  const c = audio(); if (!c) return;
  if (!SND.tear) { const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); src.buffer = noiseBuf(c); src.loop = true; f.type = 'bandpass'; f.Q.value = 1.4; g.gain.value = 0; src.connect(f); f.connect(g); g.connect(SND.master); src.start(); SND.tear = { src, f, g }; }
  const t = c.currentTime, v = Math.min(1, speed / 2.5);
  SND.tear.f.frequency.setTargetAtTime(700 + 3200 * v, t, 0.03); SND.tear.g.gain.setTargetAtTime(0.05 + 0.3 * v, t, 0.02);
}
function tearStop() { if (SND.tear && SND.ctx) { const t = SND.ctx.currentTime; SND.tear.g.gain.setTargetAtTime(0, t, 0.05); const s = SND.tear; setTimeout(() => { try { s.src.stop(); } catch (_) {} }, 400); SND.tear = null; } }
function whump(hit) { // the open: a deep thump (heavier for a hit) and a rising shimmer
  const c = audio(); if (!c) return; const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(hit ? 150 : 120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.45);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(hit ? 0.55 : 0.35, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6); o.connect(g); g.connect(SND.master); o.start(t); o.stop(t + 0.65);
  [880, 1320, 1760, hit ? 2640 : 0].filter(Boolean).forEach((fq, i) => { const s = c.createOscillator(), sg = c.createGain(), at = t + 0.08 + i * 0.07; s.type = 'triangle'; s.frequency.setValueAtTime(fq, at); s.frequency.linearRampToValueAtTime(fq * 1.5, at + 0.5); sg.gain.setValueAtTime(0, at); sg.gain.linearRampToValueAtTime(0.035, at + 0.05); sg.gain.exponentialRampToValueAtTime(0.0008, at + 0.6); s.connect(sg); sg.connect(SND.master); s.start(at); s.stop(at + 0.65); });
}

// --- the overlay on the picked pack ---
const N = (x) => x.toFixed(2);
function buildOverlay(k) {
  slotEl = slots[k]; pwEl = slotEl.querySelector('.pw');
  ov = document.createElement('div'); ov.className = 'ov';
  const L = light();
  ov.style.setProperty('--tell', L.colour);
  ov.innerHTML = '<div class="stack" aria-hidden="true">' + Array.from({ length: OPEN.cards }, (_, i) => '<div class="back" style="transform:translate(' + (i * 1.2) + 'px,' + (-i * 1.6) + 'px) rotate(' + ((i - 2) * 0.8) + 'deg)"><span>AI·TCG</span></div>').join('') + '</div>' +
    '<div class="leak"></div><div class="seam"></div>' +
    '<svg viewBox="0 0 100 160" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="cutglow" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="1.2"/></filter></defs>' +
    '<polyline id="cutleak" fill="none" stroke="var(--tell)" stroke-width="2.6" filter="url(#cutglow)" opacity="0" vector-effect="non-scaling-stroke"/>' +
    '<polyline id="cutgap" fill="none" stroke="#02030a" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<polyline id="cutedge" fill="none" stroke="rgba(235,240,255,.9)" stroke-width=".45" stroke-linejoin="round"/></svg>' +
    '<div class="tearcue" aria-hidden="true"><i class="l"></i><i class="r"></i></div>';
  slotEl.appendChild(ov);
  stack = ov.querySelector('.stack'); seam = ov.querySelector('.seam'); leak = ov.querySelector('.leak'); cue = ov.querySelector('.tearcue');
  slotEl.insertBefore(stack, pwEl); // the stack sits inside the pack, behind its face
  stack.style.transform = 'translateY(24%)';
  svgCut = { leak: ov.querySelector('#cutleak'), gap: ov.querySelector('#cutgap'), edge: ov.querySelector('#cutedge') };
}
function cutPoints(len, dir) { // the torn edge from the side the cut starts, as far as it has run
  const E = TORN.edge, out = [];
  const x1 = dir > 0 ? len * 100 : 100 - len * 100;
  const inRun = (x) => dir > 0 ? x <= x1 : x >= x1;
  const pts = dir > 0 ? E : E.slice().reverse();
  for (let i = 0; i < pts.length; i++) {
    if (inRun(pts[i].x)) { out.push(pts[i]); continue; }
    const a = pts[i - 1]; if (!a) break; const b = pts[i]; const f = (x1 - a.x) / (b.x - a.x);
    out.push({ x: x1, y: a.y + (b.y - a.y) * f }); break;
  }
  return out;
}
function drawCut() {
  const pts = cutPoints(O.cut, O.dir), str = pts.map((p) => N(p.x) + ',' + N(p.y)).join(' ');
  svgCut.gap.setAttribute('points', str); svgCut.edge.setAttribute('points', str); svgCut.leak.setAttribute('points', str);
  svgCut.leak.setAttribute('opacity', String((light().leak * Math.min(1, O.cut * 1.4)).toFixed(3)));
  return pts[pts.length - 1];
}
function scrap(head) { // a curl of foil thrown off the head of the cut (motion only)
  if (REDUCED || !head || O.scraps > 18) return; O.scraps++;
  const el = document.createElement('div'); el.className = 'scrap';
  el.style.left = (head.x * ${PICK_PX} / 100 - 4) + 'px'; el.style.top = (head.y * ${PICK_PX} * 1.6 / 160 - 3) + 'px';
  ov.appendChild(el);
  const dx = (O.dir * (14 + Math.random() * 30)), dy = -(18 + Math.random() * 34), r = (Math.random() - 0.5) * 540;
  const a = el.animate([{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (r / 2) + 'deg)', opacity: 0.9, offset: 0.45 }, { transform: 'translate(' + (dx * 1.4) + 'px,' + (dy * 0.2 + 40) + 'px) rotate(' + r + 'deg)', opacity: 0 }], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.4,1)' });
  a.onfinish = () => el.remove();
}
function packBox() { const r = pwEl.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
function setNote(t) { note.textContent = t; }

addEventListener('packpick', (e) => {
  // On the site this is the server's answer to the pick (PACKS.md): the best card's finish, for the tell. Here, a stand-in.
  const best = Object.prototype.hasOwnProperty.call(LIGHTS, Q.get('best')) ? Q.get('best') : 'plain';
  O.best = best; O.phase = 'held';
  buildOverlay(e.detail.slot);
  O.zone = tearZone(packBox(), TOUCH);
  setNote(TOUCH ? 'Your pack. Hold it, then swipe across the top to tear it open.' : 'Your pack. Hold it, then drag across the top to tear it open.');
  slotEl.style.cursor = 'grab';
  document.documentElement.classList.add('tearing');
});

// --- the grip ---
let g = null;
function gripStart() { if (O.phase === 'held') O.phase = 'grip'; if (seam && light().seam) seam.style.opacity = String(light().seam); }
function gripFrame(now) {
  if (!pwEl || O.phase === 'open' || O.phase === 'opened') { if (pwEl) { pwEl.style.setProperty('--shx', '0px'); pwEl.style.setProperty('--shy', '0px'); pwEl.style.setProperty('--lean', '0deg'); } return; }
  if (g && !REDUCED) {
    const t = now - g.t0; O.heldMs = t;
    const sh = trembleAt(t, ${PICK_PX});
    pwEl.style.setProperty('--shx', sh.x + 'px'); pwEl.style.setProperty('--shy', sh.y + 'px');
    const b = packBox(), lean = Math.max(-1, Math.min(1, (g.x - (b.left + b.width / 2)) / b.width)) * 3;
    pwEl.style.setProperty('--lean', lean.toFixed(2) + 'deg');
    if (now >= g.nextCrinkle) { crinkle(Math.min(1, t / TREMBLE.rampMs)); g.nextCrinkle = now + 140 - 90 * Math.min(1, t / TREMBLE.rampMs) + Math.random() * 40; }
  } else if (pwEl) { pwEl.style.setProperty('--shx', '0px'); pwEl.style.setProperty('--shy', '0px'); pwEl.style.setProperty('--lean', '0deg'); }
  requestAnimationFrame(gripFrame);
}

// --- the tear ---
function tearTo(p, speed) {
  O.progress = Math.max(O.progress, p);
  const before = O.cut; O.cut = Math.max(O.cut, cutLength(O.progress));
  if (O.phase !== 'tearing') { O.phase = 'tearing'; cue.classList.add('gone'); if (seam && light().seam) seam.style.opacity = String(light().seam); }
  const head = drawCut();
  if (O.cut - before > 0.03) scrap(head);
  if (speed != null) tearSound(speed);
  if (O.progress >= 1) finishTear();
}
function finishTear() {
  if (O.phase === 'finishing' || O.phase === 'open' || O.phase === 'opened') return;
  O.phase = 'finishing'; O.tears++; O.events.push({ torn: O.how }); g = null;
  const from = O.cut, t0 = performance.now();
  const run = (now) => {
    const k = Math.min(1, (now - t0) / TEAR.finishMs);
    O.cut = from + (1 - from) * (1 - (1 - k) * (1 - k)); const head = drawCut(); if (Math.random() < 0.5) scrap(head); tearSound(1.2);
    if (k < 1) requestAnimationFrame(run); else { tearStop(); openPack(); }
  };
  requestAnimationFrame(run);
}
function autoTear(dir, how) { // a tap or Enter: the 600 ms tear, by itself
  if (O.phase !== 'held' && O.phase !== 'grip') return;
  O.how = how; O.dir = dir; gripStart(); const t0 = performance.now();
  const run = (now) => { if (O.phase === 'finishing' || O.phase === 'open' || O.phase === 'opened') return; const k = Math.min(1, (now - t0) / TEAR.tapMs); tearTo(k, 0.6 + k); if (k < 1) requestAnimationFrame(run); };
  requestAnimationFrame(run);
}
window.__tearKey = () => autoTear(1, 'key');

// --- the open: the strip flies off, one swell of light, the stack rises ---
function openPack() {
  O.phase = 'open'; O.events.push({ open: true });
  const L = light(), hit = L.seam > 0;
  pwEl.style.clipPath = TORN.clips.body;
  const strip = pwEl.cloneNode(true); strip.removeAttribute('data-live'); strip.classList.add('strip'); strip.style.clipPath = TORN.clips.strip; strip.style.position = 'absolute'; strip.style.left = '0'; strip.style.top = '0';
  slotEl.insertBefore(strip, ov);
  svgCut.gap.setAttribute('points', ''); svgCut.edge.setAttribute('points', ''); svgCut.leak.setAttribute('opacity', '0');
  whump(hit);
  if (REDUCED) { strip.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-30%)', opacity: 0 }], { duration: 400, fill: 'forwards' }); }
  else strip.animate([{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: 'translate(' + (O.dir * 12) + '%,-22%) rotate(' + (O.dir * 9) + 'deg)', opacity: 1, offset: 0.35 }, { transform: 'translate(' + (O.dir * 70) + '%,-55%) rotate(' + (O.dir * 34) + 'deg)', opacity: 0 }], { duration: OPEN.stripMs, easing: 'cubic-bezier(.25,.6,.4,1)', fill: 'forwards' });
  seam.style.transition = 'opacity .3s ease-out'; seam.style.opacity = '0';
  const T = SWELL.riseMs + SWELL.holdMs + SWELL.fallMs;
  leak.animate([{ opacity: 0 }, { opacity: L.swell, offset: SWELL.riseMs / T }, { opacity: L.swell, offset: (SWELL.riseMs + SWELL.holdMs) / T }, { opacity: L.swell * 0.25 }], { duration: T, easing: 'ease-out', fill: 'forwards' });
  // The stack rises out of the cut (it sits behind the pack's face, so only what has cleared the torn edge shows),
  // the body drops away under it, and the stack settles where the pack was.
  const rise = REDUCED ? [{ opacity: 0, transform: 'translateY(16%)' }, { opacity: 1, transform: 'translateY(16%)' }] : [{ transform: 'translateY(24%)' }, { transform: 'translateY(-22%)', offset: 0.55 }, { transform: 'translateY(-14%)', offset: 0.7 }, { transform: 'translateY(16%)' }];
  setTimeout(() => {
    stack.animate(rise, { duration: REDUCED ? 300 : OPEN.stackMs, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    const body = [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(30%)', opacity: 0 }];
    pwEl.animate(body, { duration: REDUCED ? 300 : 420, delay: REDUCED ? 0 : OPEN.stackMs * 0.5, easing: 'ease-in', fill: 'forwards' });
  }, REDUCED ? 0 : OPEN.stackDelayMs);
  setTimeout(() => { O.phase = 'opened'; O.events.push({ opened: true }); document.documentElement.classList.remove('tearing'); slotEl.style.cursor = 'default'; setNote('Torn open: five cards, face down. The reveal comes next (the second part of the opening rework).'); }, (REDUCED ? 300 : OPEN.stackDelayMs + OPEN.stackMs) + 50);
}

// --- the pointer, after the pick (on the whole page: the zone's margin reaches past the stage) ---
document.addEventListener('pointerdown', (e) => {
  if (S.picked === null || !pwEl || (O.phase !== 'held' && O.phase !== 'grip' && O.phase !== 'tearing')) return;
  O.zone = tearZone(packBox(), TOUCH || e.pointerType === 'touch');
  const b = packBox(), onPack = e.clientX >= b.left && e.clientX <= b.left + b.width && e.clientY >= b.top && e.clientY <= b.top + b.height;
  const z = inZone(O.zone, e.clientX, e.clientY);
  if (!z && !onPack) return;
  g = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), zone: z, moved: 0, base: O.progress, last: { t: e.timeStamp, x: e.clientX, y: e.clientY }, nextCrinkle: 0 };
  audio(); gripStart(); slotEl.style.cursor = 'grabbing';
  try { pick.setPointerCapture(e.pointerId); } catch (_) {}
  requestAnimationFrame(gripFrame);
});
document.addEventListener('pointermove', (e) => {
  if (!g || S.picked === null) return;
  g.x = e.clientX; g.y = e.clientY;
  const d = Math.hypot(e.clientX - g.x0, e.clientY - g.y0); g.moved = Math.max(g.moved, d);
  if (!g.zone || d < TEAR.slopPx) return;
  const b = packBox(), tp = tearProgress(g.x0, g.y0, e.clientX, e.clientY, b.width, b.left + b.width / 2);
  if (O.phase !== 'tearing') { O.dir = tp.dir; O.how = 'drag'; }
  const dt = Math.max(1, e.timeStamp - g.last.t), speed = Math.hypot(e.clientX - g.last.x, e.clientY - g.last.y) / dt; g.last = { t: e.timeStamp, x: e.clientX, y: e.clientY };
  tearTo(Math.min(1, g.base + tp.progress), speed);
});
const release = (e) => {
  if (!g || S.picked === null) return;
  const d = g; g = null; if (slotEl) slotEl.style.cursor = 'grab';
  if (O.phase === 'tearing') { tearStop(); return; } // a part-torn pack stays part-torn: the next drag carries on from there
  if (d.moved < TEAR.slopPx) {
    const b = packBox();
    if (d.zone) autoTear(d.x0 <= b.left + b.width / 2 ? 1 : -1, 'tap');
    else if (performance.now() - d.t0 < TEAR.holdMs && !REDUCED) { cue.classList.remove('nudge'); void cue.offsetWidth; cue.classList.add('nudge'); }
  }
  if (O.phase === 'grip') O.phase = 'held';
};
document.addEventListener('pointerup', release);
document.addEventListener('pointercancel', release);
lessFlash.addEventListener('change', () => { if (ov) { ov.style.setProperty('--tell', light().colour); if (O.phase === 'grip' || O.phase === 'tearing') seam.style.opacity = String(light().seam); } });
`;
