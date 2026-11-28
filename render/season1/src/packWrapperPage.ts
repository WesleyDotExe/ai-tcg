// The pages for the owner (render session 95): the three wrapper designs
// side by side with their light (output/pack-wrappers.html), and the pick
// row in each design (output/pack-pick.html?design=crest|window|bleed).
//
// Pure: HTML strings out. Self-contained: no outside requests. Fenced off in
// render/season1/.

import { esc } from "../../src/site/siteModel.js";
import { DESIGNS, LIGHT_JS, MASCOTS, packCss, packHtml, S1_FIRST, type DesignId } from "./packWrapper.js";
import { PICK_JS, ROW_COUNT, ROW_START } from "./packPick.js";

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
.pickbar { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
.picked-note { text-align: center; min-height: 1.5em; color: var(--ink); }
.designs-nav { display: flex; gap: 8px; flex-wrap: wrap; } .designs-nav a { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); text-decoration: none; } .designs-nav a[aria-current] { background: rgba(143,166,255,.22); }
@media (prefers-reduced-motion: reduce) { .pick.picked .slot:not(.chosen), .slot.chosen { transition: none; } }
`;

/** The pick row in one design. Every slot is the same markup: one pack,
 * cloned; only its place tells it apart. */
export function packPickPage(): string {
  const pack = (id: DesignId) => packHtml({ design: id, mascot: "Cortex", px: PICK_PX });
  const templates = DESIGNS.map((d) => `<template id="tpl-${d.id}">${pack(d.id)}</template>`).join("");
  const body = `<main>
  <div class="kick">Season 1 · the opening's first beat · render session 95</div>
  <h1>Pick a pack</h1>
  <p>Drag, swipe, scroll or use the arrow keys to move along the row; it carries on a little and settles on a pack. Tap a side pack to bring it to the middle; tap the middle one (or press Enter) to pick it. The grip and the tear come next (phase 3).</p>
  <nav class="designs-nav" aria-label="Wrapper design">${DESIGNS.map((d) => `<a href="?design=${d.id}" data-design-link="${d.id}">${esc(d.name)}</a>`).join("")} <a href="pack-wrappers.html">All three designs</a></nav>
  <div class="pick" id="pick" tabindex="0" role="listbox" aria-label="Packs to pick from"><div class="row" id="row"></div></div>
  <div class="pickbar"><button type="button" id="prev" aria-label="Previous pack">←</button><button type="button" id="choose">Pick this pack</button><button type="button" id="next" aria-label="Next pack">→</button><button type="button" id="again" hidden>Back to the row</button></div>
  <p class="picked-note" id="note" aria-live="polite"></p>
  <p class="drive" id="drive"></p><button type="button" id="tilt" hidden>Use the phone's tilt</button>
</main>${templates}`;
  return shell("Season 1 packs: pick a pack", body, LIGHT_DRIVER + PICK_CLIENT);
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
  note.textContent = 'You picked pack ' + (k + 1) + ' of ' + ROW_COUNT + '. Next: hold it to grip, then tear it open (phase 3).';
  document.getElementById('choose').hidden = true; document.getElementById('again').hidden = false;
  // On the site: the page sends only the slot; the server opens that slot's own roll, kept on the server, and sends back its cards.
  dispatchEvent(new CustomEvent('packpick', { detail: { slot: k } }));
}
document.getElementById('again').onclick = () => { const k = S.picked; S.picked = null; pick.classList.remove('picked'); slots[k].classList.remove('chosen'); note.textContent = ''; document.getElementById('choose').hidden = false; document.getElementById('again').hidden = true; layout(); };
document.getElementById('choose').onclick = choose;
document.getElementById('prev').onclick = () => goTo(Math.round(S.target) - 1);
document.getElementById('next').onclick = () => goTo(Math.round(S.target) + 1);
pick.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') { goTo(Math.round(S.target) - 1); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { goTo(Math.round(S.target) + 1); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === ' ') { choose(); e.preventDefault(); }
});
let drag = null;
pick.addEventListener('pointerdown', (e) => { if (S.picked !== null) return; drag = { x0: e.clientX, pos0: S.pos, moved: 0, samples: [{ t: e.timeStamp, x: e.clientX }], slot: e.target.closest('.slot') }; pick.setPointerCapture(e.pointerId); });
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
