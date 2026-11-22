// Season 1 Home mockups A, B and C side by side (render session 84; owner
// 2026-11-22, plan item 18 step 3, then "Waiting on owner: pick a Home
// direction"). One page for the owner's pick: each mockup live in a frame
// (the built pages, siblings in season1/output/), the same owner and screen
// for all three, and what each one tries in a line. Fenced off in
// render/season1/.
//
// Pure: data in, an HTML string out (the data only names the owners).

import { esc } from "../../src/site/siteModel.js";
import type { HomeData } from "./homeFacts.js";

export const MOCKUPS = [
  { id: "a", file: "home-mockup-a.html", name: "A · the question is the label", idea: "Every tile wears its question under its name; one button each. A plain dark look. A rail on the left.", nav: "Rail (left), tab bar on a phone" },
  { id: "b", file: "home-mockup-b.html", name: "B · the headline first", idea: "Season 0's glass back; each tile leads with its answer, big, with a picture; the question behind a \"?\". Tiles as tall as their content.", nav: "Top bar; the places drop under the logo on a phone" },
  { id: "c", file: "home-mockup-c.html", name: "C · what needs you first", idea: "The neon-night console: Home orders itself, what needs you first, each saying why; the question as a code comment. HUD panels.", nav: "Console rail (full height) with keys 1-5 and a Jump-to palette; tab bar on a phone" },
] as const;

export function comparePage(data: HomeData): string {
  const owners = Object.entries(data.owners).map(([k, o]) => ({ k, name: o.me.name, note: o.matches.total ? "weeks in" : "just signed up" }));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Season 1 Home, A B C</title>
<style>
:root { color-scheme: dark; --ink: #eef1ff; --muted: #a3acd0; --line: rgba(255,255,255,.12); --accent: #6f86ff; }
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); background: #0b0e22; }
header { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--line); }
h1 { margin: 0; font-size: 18px; } .sub { color: var(--muted); }
.seg { display: inline-flex; gap: 2px; } .seg button { font: inherit; color: inherit; border: 1px solid var(--line); background: transparent; border-radius: 7px; padding: 3px 10px; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--accent); color: #fff; border-color: transparent; }
.cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; padding: 14px 20px 24px; }
.col { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.col h2 { margin: 0; font-size: 15px; } .col p { margin: 0; color: var(--muted); font-size: 12.5px; min-height: 3.2em; }
.col .nav { font-size: 12px; color: var(--muted); } .col .nav b { color: var(--ink); font-weight: 600; }
.col a { color: var(--accent); font-size: 12.5px; }
.frame { position: relative; width: 100%; overflow: hidden; border-radius: 10px; box-shadow: 0 0 0 1px var(--line); background: #000; }
.frame iframe { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; }
@media (max-width: 900px) { .cols { grid-template-columns: minmax(0, 1fr); } }
</style></head><body>
<header>
  <h1>Season 1 Home: mockups A, B and C</h1>
  <span>Owner <span class="seg" id="owner">${owners.map((o, i) => `<button type="button" data-owner="${o.k}" aria-pressed="${i === 0}">${esc(o.name)} (${o.note})</button>`).join("")}</span></span>
  <span>Screen <span class="seg" id="screen"><button type="button" data-screen="desktop" aria-pressed="true">Desktop 1440</button><button type="button" data-screen="phone" aria-pressed="false">Phone 390</button></span></span>
  <span class="sub">Same tiles, same spec, same real data (the Season 0 site demo, read ${esc(data.takenAt.slice(0, 10))}); only the look and the navigation differ. Waiting on owner: pick a direction (or parts of two).</span>
</header>
<div class="cols">
${MOCKUPS.map((m) => `  <section class="col" data-m="${m.id}"><h2>${esc(m.name)}</h2><p>${esc(m.idea)}</p><span class="nav"><b>Navigation:</b> ${esc(m.nav)}</span><a href="${m.file}" target="_blank" rel="noopener">Open ${m.id.toUpperCase()} on its own</a><div class="frame"><iframe title="Mockup ${m.id.toUpperCase()}" data-file="${m.file}" loading="eager"></iframe></div></section>`).join("\n")}
</div>
<script>
(() => {
  const st = { owner: ${JSON.stringify(owners[0]?.k ?? "")}, screen: 'desktop' };
  const SIZES = { desktop: { w: 1440, h: 1500 }, phone: { w: 390, h: 1500 } };
  function fit() {
    document.querySelectorAll('.frame').forEach((f) => {
      const ifr = f.querySelector('iframe'), s = SIZES[st.screen];
      const k = Math.min(1, f.clientWidth / s.w);
      ifr.style.width = s.w + 'px'; ifr.style.height = s.h + 'px'; ifr.style.transform = 'scale(' + k + ')';
      f.style.height = Math.round(s.h * k) + 'px';
      if (st.screen === 'phone') { f.style.width = Math.round(s.w * k) + 'px'; f.style.margin = '0 auto'; } else { f.style.width = '100%'; }
    });
  }
  function load() {
    document.querySelectorAll('iframe').forEach((i) => { i.src = i.dataset.file + '?owner=' + st.owner; });
    document.querySelectorAll('.seg').forEach((s) => s.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.owner === st.owner || b.dataset.screen === st.screen))));
    fit();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.owner) { st.owner = b.dataset.owner; load(); }
    if (b.dataset.screen) { st.screen = b.dataset.screen; load(); }
  });
  window.addEventListener('resize', fit);
  load();
})();
</script></body></html>`;
}
