// The pack-opening storyboard as a page for the owner (render session 85):
// one panel per beat (a sketch, what you see, hear and feel, what reduced
// flash does, what Season 0 did as measured) with the beat's light curve,
// normal and reduced, against the line where a change counts. Above them:
// the whole opening's light and the flash check's verdict on it, and the
// Season 0 audit's results. Self-contained: no scripts from outside, no
// fonts from outside.

import { analyse, blocksOf, FlashTracker, LUM_STEP } from "./flashScan.js";
import { BIG_PULL, BUDGET, lightAt, lightFrames, REDUCED_CEILING, ROOM, STORYBOARD, timeline, type Beat } from "./openingStoryboard.js";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The light at the screen's centre (every light covers it), ms from the start of `beats`. */
function centreLight(beats: readonly Beat[], reduced: boolean, t: number): number {
  let v = ROOM;
  for (const { beat, start } of timeline(beats)) for (const l of reduced ? beat.reducedLights : beat.lights) v += lightAt(l, t - start);
  return Math.max(0, v);
}

function curve(beats: readonly Beat[], from: number, to: number, w: number, h: number, yMax: number): { normal: string; reduced: string } {
  const pts = (reduced: boolean) => {
    const out: string[] = [];
    for (let i = 0; i <= 120; i++) { const t = from + ((to - from) * i) / 120; out.push(`${((w * i) / 120).toFixed(1)},${(h - (h * centreLight(beats, reduced, t)) / yMax).toFixed(1)}`); }
    return out.join(" ");
  };
  return { normal: pts(false), reduced: pts(true) };
}

function chart(beats: readonly Beat[], from: number, to: number, opts: { w: number; h: number; marks?: { at: number; label: string }[]; wide?: boolean }): string {
  const { w, h } = opts;
  let top = 0;
  for (let i = 0; i <= 120; i++) for (const r of [false, true]) top = Math.max(top, centreLight(beats, r, from + ((to - from) * i) / 120));
  const yMax = Math.max(0.2, (Math.max(top, centreLight(beats, false, from) + LUM_STEP)) * 1.2);
  const c = curve(beats, from, to, w, h, yMax);
  const yOf = (v: number) => h - (h * v) / yMax;
  const start = centreLight(beats, false, from);
  const marks = (opts.marks ?? []).map((m) => { const x = ((m.at - from) / (to - from)) * w; return `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="0" y2="${h}" class="mk"/><text x="${(x + 3).toFixed(1)}" y="11" class="ml">${esc(m.label)}</text>`; }).join("");
  return `<svg viewBox="0 0 ${w} ${h}" class="chart${opts.wide ? " wide" : ""}" role="img" aria-label="Light over time: normal and reduced flash">
  <line x1="0" x2="${w}" y1="${yOf(start + LUM_STEP).toFixed(1)}" y2="${yOf(start + LUM_STEP).toFixed(1)}" class="line10"/>
  <text x="${w - 4}" y="${(yOf(start + LUM_STEP) + 10).toFixed(1)}" class="ll" text-anchor="end">0.1 above the start: a change this big counts</text>
  ${marks}
  <polyline points="${c.reduced}" class="red"/>
  <polyline points="${c.normal}" class="nor"/>
</svg>`;
}

/** A small drawn sketch of each beat (placeholder shapes in the neon night: the real art comes with the art plan). */
function sketch(id: string): string {
  const bg = `<rect width="240" height="150" fill="url(#night)"/><g class="grid">${[0, 1, 2, 3, 4].map((i) => `<line x1="0" x2="240" y1="${100 + i * i * 3}" y2="${100 + i * i * 3}"/>`).join("")}${[-3, -2, -1, 0, 1, 2, 3].map((i) => `<line x1="${120 + i * 14}" y1="100" x2="${120 + i * 70}" y2="150"/>`).join("")}</g>`;
  const crimp = (x: number, y: number, w: number) => { let d = `M${x} ${y}`; for (let i = 0; i <= 12; i++) d += ` L${x + (w * i) / 12} ${y + (i % 2 ? 4 : 0)}`; return `<path d="${d}" class="crimp"/>`; };
  const pack = (x: number, y: number, tilt = 0, extra = "") => `<g transform="rotate(${tilt} ${x + 30} ${y + 45})"><rect x="${x}" y="${y}" width="60" height="90" rx="3" class="pack"/>${crimp(x, y, 60)}${crimp(x, y + 86, 60)}<rect x="${x + 6}" y="${y + 9}" width="48" height="9" rx="2" class="logo"/><path d="M${x + 30} ${y + 30} l14 8 v16 l-14 8 l-14 -8 v-16z" class="mascot"/><circle cx="${x + 30}" cy="${y + 79}" r="3" class="sym"/>${extra}</g>`;
  const card = (x: number, y: number, cls = "back", w = 40) => `<rect x="${x}" y="${y}" width="${w}" height="${w * 1.4}" rx="3" class="${cls}"/>`;
  switch (id) {
    case "arrive": return bg + pack(90, 28) + `<path d="M120 135 v-10 m-5 5 l5 -5 l5 5" class="arrow"/>`;
    case "grip": return bg + `<line x1="92" y1="27" x2="152" y2="27" class="seam"/>` + pack(90, 28, -3) + `<circle cx="150" cy="70" r="8" class="finger"/>` + `<path d="M80 50 l-6 3 M80 70 l-7 0 M80 90 l-6 -3 M160 50 l6 3 M162 90 l6 -3" class="tremble"/>`;
    case "tear": return bg + pack(90, 32, 0, `<path d="M90 44 L100 40 L108 46 L118 39 L126 45 L134 40" class="cut"/>`) + `<g transform="rotate(-14 125 30)"><rect x="92" y="22" width="44" height="12" rx="2" class="strip"/></g><path d="M140 30 l6 -3 l2 5z M150 22 l5 1 l-2 5z M146 40 l5 -2 l1 4z" class="scrap"/><circle cx="132" cy="18" r="7" class="finger"/>`;
    case "open": return bg + `<circle cx="120" cy="64" r="58" fill="url(#swell)"/>` + `<g transform="rotate(24 170 18)"><rect x="150" y="10" width="44" height="12" rx="2" class="strip"/></g>` + card(100, 22) + card(102, 20) + `<rect x="90" y="88" width="60" height="50" rx="3" class="pack"/>`;
    case "deal": return bg + card(98, 36) + `<rect x="138" y="36" width="6" height="56" rx="2" class="face"/>` + card(172, 30, "face", 36) + `<path d="M160 40 h-12 M162 60 h-16 M160 80 h-12" class="motion"/>`;
    case "build": return bg + `<rect width="240" height="150" class="dimmed"/>` + `<rect x="88" y="22" width="64" height="90" rx="6" class="glow g3"/><rect x="92" y="26" width="56" height="82" rx="5" class="glow g2"/><rect x="95" y="29" width="50" height="76" rx="4" class="glow g1"/>` + card(98, 32, "back", 44);
    case "hit": return bg + `<circle cx="120" cy="68" r="62" fill="url(#bloom)"/><circle cx="120" cy="68" r="52" class="ward"/>` + card(98, 36, "face gold", 44) + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle cx="${120 + Math.cos(i) * 70}" cy="${68 + Math.sin(i * 1.7) * 48}" r="2" class="mote"/>`).join("") + `<path d="M40 20 l-6 4 M200 20 l6 4 M40 120 l-6 -4 M200 120 l6 -4" class="tremble"/>`;
    case "summary": return bg + [0, 1, 2, 3, 4].map((i) => `<g transform="rotate(${(i - 2) * 8} 120 150)">${card(104, 36, i === 4 ? "face gold" : "face", 32)}${i % 2 ? `<rect x="${104}" y="${30}" width="20" height="8" rx="2" class="newb"/>` : ""}</g>`).join("");
    case "blackout": return `<rect width="240" height="150" fill="#010103"/>` + card(98, 32, "ghost", 44);
    case "terminal": return `<rect width="240" height="150" fill="#010103"/><g class="term"><text x="28" y="48">ZERO-DAY DETECTED</text><text x="28" y="72" class="sm">&gt; privilege: ROOT</text><text x="34" y="86" class="sm">&gt; payload: PATIENT ZERO</text><text x="26" y="100" class="sm">&gt; containment: FAILED</text><rect x="168" y="92" width="7" height="10"/></g>`;
    case "arrival": return `<rect width="240" height="150" fill="#030608"/><circle cx="120" cy="70" r="64" fill="url(#zbloom)"/><circle cx="120" cy="70" r="54" class="zring"/>` + card(94, 28, "face zd", 52);
    default: return bg;
  }
}

const DEFS = `<defs>
  <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140f33"/><stop offset="0.66" stop-color="#0b0b22"/><stop offset="1" stop-color="#05060d"/></linearGradient>
  <radialGradient id="swell"><stop offset="0" stop-color="#ffe9a8" stop-opacity="0.7"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>
  <radialGradient id="bloom"><stop offset="0" stop-color="#fff1b8" stop-opacity="0.75"/><stop offset="1" stop-color="#f6d77a" stop-opacity="0"/></radialGradient>
  <radialGradient id="zbloom"><stop offset="0" stop-color="#d8ffe9" stop-opacity="0.7"/><stop offset="1" stop-color="#35ff8a" stop-opacity="0"/></radialGradient>
</defs>`;

export interface AuditLine { run: string; label: string; pass: boolean; text: string }

export function renderStoryboardHtml(audit: { owner: AuditLine[]; fastest: AuditLine[]; reduced: AuditLine[]; repeats?: AuditLine[]; reducedRepeats?: AuditLine[] }): string {
  const measure = (beats: readonly Beat[], reduced: boolean) => {
    const t = new FlashTracker();
    for (const f of lightFrames(beats, { fps: 30, w: 256, h: 192, reduced })) t.push(blocksOf(f));
    return analyse(t, 30, 256, 192);
  };
  const zero = [...STORYBOARD.filter((b) => b.id !== "hit" && b.id !== "summary"), ...BIG_PULL, STORYBOARD.find((b) => b.id === "summary")!];
  const verdicts = ([["A Gold pull", STORYBOARD], ["A Zero-Day pull", zero], ["A pack with no hit", STORYBOARD.filter((b) => b.id !== "build" && b.id !== "hit")]] as const).map(([name, beats]) => {
    const n = measure(beats, false), r = measure(beats, true);
    return `<tr><td>${name}</td><td class="${n.pass ? "ok" : "bad"}">${n.worst.flashes} a second at worst; ${n.bigFlashes.length} counted flash${n.bigFlashes.length === 1 ? "" : "es"} in all</td><td class="ok">${r.bigFlashes.length ? `${r.bigFlashes.length} counted` : "none counted"} (at most ${r.worst.changes} change a second)</td><td>${n.worstRed.redFlashes === 0 ? "none" : n.worstRed.redFlashes}</td></tr>`;
  }).join("");
  const tl = timeline(STORYBOARD), total = tl[tl.length - 1]!.start + tl[tl.length - 1]!.beat.ms;
  const panel = (b: Beat, beats: readonly Beat[]) => {
    const st = timeline(beats).find((x) => x.beat.id === b.id)!.start;
    return `<article class="beat" id="${b.id}">
  <svg viewBox="0 0 240 150" class="sk" role="img" aria-label="${esc(b.name)} (sketch)">${DEFS}${sketch(b.id)}</svg>
  <div class="txt">
    <h3>${esc(b.name)}</h3>
    <p class="trig">${esc(b.trigger)} · about ${(b.ms / 1000).toFixed(1)} s</p>
    <dl><dt>See</dt><dd>${esc(b.see)}</dd><dt>Hear</dt><dd>${esc(b.hear)}</dd><dt>Move</dt><dd>${esc(b.move)}</dd><dt>Reduced flash</dt><dd>${esc(b.reduced)}</dd><dt>Season 0</dt><dd class="before">${esc(b.before)}</dd></dl>
    ${chart(beats, st - 200, st + b.ms + 400, { w: 320, h: 70 })}
  </div>
</article>`;
  };
  const auditTable = (rows: AuditLine[], title: string) => rows.length ? `<h3>${esc(title)}</h3><table class="audit"><tr><th>Pack</th><th>Verdict</th><th>Measured</th></tr>${rows.map((r) => `<tr><td>${esc(r.label ? `${r.label}${r.run.includes("#") ? ` · run ${r.run.split("#")[1]}` : ""}` : r.run)}</td><td class="${r.pass ? "ok" : "bad"}">${r.pass ? "PASS" : "FAIL"}</td><td>${esc(r.text)}</td></tr>`).join("")}</table>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pack Opening Storyboard</title>
<style>
:root { --bg: #070914; --panel: #0e1226; --ink: #e8eeff; --dim: #93a3c8; --line: #263156; --accent: #6ad7ff; --warn: #ffb44d; --ok: #63e6a1; --bad: #ff7a8a; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1080px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: 0.02em; }
h1 small { display: block; font: 600 12px/1.4 ui-monospace, Menlo, monospace; color: var(--accent); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px; }
h2 { font-size: 18px; margin: 36px 0 10px; }
h3 { font-size: 16px; margin: 0 0 2px; }
p { color: var(--dim); margin: 6px 0; }
.lede { color: var(--ink); max-width: 70ch; }
.rules { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin: 14px 0; }
.rules div { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 14px; }
.rules b { color: var(--accent); display: block; font: 600 11px ui-monospace, Menlo, monospace; letter-spacing: 0.1em; text-transform: uppercase; }
table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0 16px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--dim); font-weight: 600; }
td.ok { color: var(--ok); } td.bad { color: var(--bad); font-weight: 700; }
.wrap { overflow-x: auto; }
.beat { display: grid; grid-template-columns: 280px 1fr; gap: 16px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin: 12px 0; }
.sk { width: 100%; border-radius: 8px; display: block; }
.trig { font: 12px ui-monospace, Menlo, monospace; color: var(--accent); margin: 0 0 6px; }
dl { display: grid; grid-template-columns: 110px 1fr; gap: 4px 10px; margin: 0 0 8px; font-size: 14px; }
dt { color: var(--dim); font-weight: 600; } dd { margin: 0; } dd.before { color: var(--warn); }
.chart { width: 100%; max-width: 520px; height: auto; background: #080b18; border-radius: 6px; display: block; }
.chart.wide { max-width: none; margin: 6px 0 0; }
.chart .nor { fill: none; stroke: var(--accent); stroke-width: 2; }
.chart .red { fill: none; stroke: var(--ok); stroke-width: 1.5; stroke-dasharray: 4 3; }
.chart:not(.wide) .ll { font-size: 7px; }
.chart .line10 { stroke: var(--warn); stroke-dasharray: 2 3; } .chart .ll { fill: var(--warn); font: 9px ui-monospace, monospace; }
.chart .mk { stroke: #3a4572; } .chart .ml { fill: var(--dim); font: 9px ui-monospace, monospace; }
.legend { font-size: 13px; color: var(--dim); } .legend i { display: inline-block; width: 18px; height: 0; border-top: 2px solid var(--accent); vertical-align: middle; margin: 0 4px; } .legend i.r { border-top: 2px dashed var(--ok); }
.sk .grid line { stroke: #3b2a7a; stroke-width: 0.6; opacity: 0.7; }
.sk .pack { fill: #23305e; stroke: #9fb3ff; stroke-width: 1.2; } .sk .crimp { fill: none; stroke: #c8d4ff; stroke-width: 1; }
.sk .logo { fill: #c9b6ff; } .sk .mascot { fill: #35c9ff; opacity: 0.85; } .sk .sym { fill: #fff0c2; }
.sk .arrow, .sk .motion, .sk .tremble { fill: none; stroke: #c8d4ff; stroke-width: 1.5; stroke-linecap: round; }
.sk .finger { fill: rgba(255,255,255,0.7); } .sk .seam { stroke: #ffd27a; stroke-width: 4; opacity: 0.8; }
.sk .cut { fill: none; stroke: #ffe9a8; stroke-width: 2; } .sk .strip { fill: #2c3a72; stroke: #c8d4ff; } .sk .scrap { fill: #c8d4ff; }
.sk .back { fill: #1c2350; stroke: #7f95ff; stroke-width: 1.2; } .sk .face { fill: #e8eeff; stroke: #8bff5c; stroke-width: 1.5; }
.sk .face.gold { fill: #f6d77a; stroke: #fff1b8; } .sk .face.zd { fill: #0c1f17; stroke: #35ff8a; stroke-width: 2; } .sk .ghost { fill: #0a0d18; stroke: #1b2340; }
.sk .dimmed { fill: #000; opacity: 0.35; } .sk .glow { fill: none; } .sk .g1 { stroke: #8fd3ff; stroke-width: 3; } .sk .g2 { stroke: #c08bff; stroke-width: 3; opacity: 0.8; } .sk .g3 { stroke: #ffd27a; stroke-width: 3; opacity: 0.6; }
.sk .ward { fill: none; stroke: #ff9a3d; stroke-width: 2; stroke-dasharray: 6 4; } .sk .mote { fill: #ff9a3d; }
.sk .newb { fill: #ff5fa2; } .sk .term text { fill: #35ff8a; font: 700 16px ui-monospace, Menlo, monospace; } .sk .term text.sm { font-size: 10px; font-weight: 500; } .sk .term rect { fill: #35ff8a; }
.sk .zring { fill: none; stroke: #9a7bff; stroke-width: 3; stroke-dasharray: 18 8; }
@media (max-width: 720px) { .beat { grid-template-columns: 1fr; } dl { grid-template-columns: 1fr; } dt { margin-top: 4px; } }
</style>
</head>
<body>
<main>
<h1><small>Season 1 · pack opening · storyboard</small>The new opening: build-up first, light within the limit</h1>
<p class="lede">The owner's direction (2026-11-22): the pack opening is jarring with the flashing lights. The build-up is shake, tear and sound, not strobe; the reveal and the big pulls stay big, within WCAG 2.3.1 (no more than three flashes in any one second, no saturated red flashing), with a reduced-flash setting. This storyboard is what phase 3 builds. Placeholder shapes only: the wrapper, mascots and cards get real art through the art plan.</p>
<div class="rules">
  <div><b>The limit (WCAG 2.3.1)</b>No more than three flashes in any second over more than a quarter of a 10° field of view; no saturated red flashing. Checked automatically.</div>
  <div><b>The design's budget</b>At most ${BUDGET.flashesPerSecond} counted flash in any second; big lights at least ${BUDGET.minGapMs / 1000} s apart; a bright light rises over ${BUDGET.minRiseMs} ms or more and falls over ${BUDGET.minFallMs} ms or more.</div>
  <div><b>Reduced flash</b>Every light stays under ${REDUCED_CEILING} (a change has to reach 0.1 to count), so nothing flashes at all; shakes and spins off with reduced motion.</div>
  <div><b>The moment is kept</b>The size of a pull lives in the build's length, the sound, the shake, the ward and the motes, and in one bloom per hit.</div>
</div>

<h2>The storyboard's light, checked</h2>
<p>The beats' light plans drawn as frames and read by the same measure the frame sampler uses on a real page (<code>season1/src/flashScan.ts</code>).</p>
<div class="wrap"><table><tr><th>Opening</th><th>Normal</th><th>Reduced flash</th><th>Red flashes</th></tr>${verdicts}</table></div>
<p class="legend"><i></i>normal <i class="r"></i>reduced flash · the light at the screen's centre; the dotted line is a change of 0.1 from where it starts, the size that counts.</p>
${chart(STORYBOARD, 0, total + 300, { w: 1000, h: 150, wide: true, marks: tl.map((x) => ({ at: x.start, label: x.beat.name.split(". ")[0]! })) })}

<h2>The beats (a Gold pull)</h2>
${STORYBOARD.map((b) => panel(b, STORYBOARD)).join("\n")}

<h2>The big pull's takeover (Prototype, Zero-Day), in place of beat 7</h2>
${BIG_PULL.map((b) => panel(b, zero)).join("\n")}

<h2>Season 0's opening, as measured</h2>
<p>The frame sampler (<code>render/season1/flash/sample.ts</code>) on Season 0's own pack page, unchanged, in headless Chromium at 1024 x 768 (WCAG's reference screen), 30 frames a second on a virtual clock, every showcase pack and a ten-pack open. Full records: <code>progress/render/evidence/season1-flash-audit-s85/</code>.</p>
<div class="wrap">${auditTable(audit.owner, "An owner's pace (a tap 900 ms after the page takes one)")}${auditTable(audit.fastest, "Tapping as fast as the page allows")}${auditTable(audit.reduced, "With reduced motion on (Season 0 has no reduced-flash setting)")}${auditTable(audit.repeats ?? [], "Repeat runs near the limit (an owner's pace): runs of one opening differ a little, so these were played again")}${auditTable(audit.reducedRepeats ?? [], "Repeat runs, reduced motion")}</div>
<p>Gold also failed once, in this session's first full pass (7 changes in one second at the hit): see <code>gold-first-run-fail.txt</code> in the records. What the numbers mean and why reduced motion makes Glitch worse: <code>render/season1/FLASH.md</code>.</p>
</main>
</body>
</html>
`;
}
