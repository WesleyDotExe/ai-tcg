// The coin sheet (render session 55, the second coin slice's evidence): all
// six Season 0 coins, each drawn by the page's own coinDraw (COIN_RUNTIME_SOURCE
// verbatim, the same text Match Boot and the loadout picker embed). For each
// coin: the design face landed, three moments of the spin (one nearly edge on),
// the portrait face landed, the small size the picker's tiles use, and a live
// loop of the flip (the flick, the spin with Neon Nickel's trail, the landing),
// alternating which face it lands on.
// Usage: npm run coin-sheet -w @ai-tcg/render  -> render/output/coin-sheet.html
//        npm run coin-sheet -w @ai-tcg/render -- --boot <dir>
//          also writes one replay page per coin (Cortex vs Swarm, seed 6, the
//          coin on p1, the near side of a standalone page) for the browser
//          check's Match Boot half: <dir>/boot-<coin id>.html.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COIN_PURE_SOURCE, COIN_RUNTIME_SOURCE, COIN_SPECS } from "./coinFx.js";
import { avatarSvg } from "./avatar.js";
import { CSS, renderMatchHtml } from "./renderHtml.js";
import { captureReplay } from "./replaySetup.js";
import { COSMETICS } from "../../economy/src/cosmetics.js";

export function renderCoinSheetHtml(): string {
  const coins = COSMETICS.filter((c) => c.kind === "coin").map((c) => ({ id: c.itemId, name: c.name, description: c.description, how: c.priceCredits ? `Store, ${c.priceCredits} credits (Season 0)` : c.tierReward ? `Season 0 reward: ${c.tierReward} or higher` : "Free starter (every owner)" }));
  for (const c of coins) if (!COIN_SPECS[c.id]) throw new Error(`coin sheet: ${c.id} has no look`);
  const avatar = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(avatarSvg("Velvet Static").split("currentColor").join("rgb(64,196,255)"));
  const rows = coins
    .map(
      (c) => `<section class="coinrow" data-coin="${c.id}"><div class="cr-head"><b>${c.name}</b><span class="cr-how">${c.how}</span><span class="cr-desc">${c.description}</span></div>
<div class="cr-body"><canvas class="stills" width="760" height="150" data-coin="${c.id}"></canvas><canvas class="live" width="200" height="150" data-coin="${c.id}"></canvas></div></section>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coin sheet</title>
<style>${CSS}
body { padding: 14px 16px 40px; }
h1 { font-size: 1rem; letter-spacing: 0.12em; margin: 0 0 4px; }
.sub { font-size: 0.72rem; color: var(--ink-dim); margin: 0 0 12px; max-width: 980px; line-height: 1.45; }
.coinrow { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin: 0 0 10px; max-width: 1000px; }
.cr-head { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; font-size: 0.78rem; }
.cr-head b { letter-spacing: 0.08em; }
.cr-how { color: var(--ink-dim); font-size: 0.68rem; }
.cr-desc { width: 100%; font-size: 0.68rem; color: var(--ink); opacity: 0.8; }
.cr-body { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
canvas { background: #05070e; border-radius: 6px; max-width: 100%; }
.labels { display: flex; gap: 0; font-size: 0.6rem; color: var(--ink-dim); max-width: 1000px; margin: 0 0 6px; }
</style>
</head>
<body>
<h1>AI·TCG // SEASON 0 COINS</h1>
<p class="sub">Each row: the design face landed; three moments of the spin (the last nearly edge on); the portrait face landed (a sample agent's generated portrait); the tile size the loadout picker uses; then, on the right, the flip on a loop (lands design up, then portrait up). Drawn by the page's own coinDraw, the code Match Boot runs. Placeholders until the art pass.</p>
${rows}
<script>
(function () {
${COIN_PURE_SOURCE}
${COIN_RUNTIME_SOURCE}
  var img = new Image(); img.src = ${JSON.stringify(avatar)};
  var FACE = [64, 196, 255];
  function stills(cv) {
    var spec = COIN_SPECS[cv.getAttribute('data-coin')], ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    var shots = [[0, 1], [0.45, 1.12], [1.2, 1.2], [1.5, 1.05], [Math.PI, 1]];
    shots.forEach(function (s, i) { coinDraw(ctx, { spec: spec, x: 80 + i * 136, y: 70, r: 44, angle: s[0], scale: s[1], img: img, faceRgb: FACE, t: 900 }); });
    coinDraw(ctx, { spec: spec, x: 730, y: 70, r: 18, angle: 0, scale: 1, t: 900 });
  }
  var lives = Array.prototype.slice.call(document.querySelectorAll('canvas.live'));
  var t0 = null, FLIGHT = COIN_LAND_AT - COIN_FLICK_AT, HOLD = 900;
  function frame(now) {
    if (t0 == null) t0 = now;
    var t = now - t0, cycle = FLIGHT + HOLD, n = Math.floor(t / cycle), u = (t % cycle) / FLIGHT, portraitUp = n % 2 === 1;
    var half = coinHalfTurns(portraitUp);
    lives.forEach(function (cv) {
      var spec = COIN_SPECS[cv.getAttribute('data-coin')], ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      var fl = coinFlight(Math.min(1, u), half), trail = null;
      if (spec.trail && u < 1) { trail = []; for (var k = 1; k <= 3; k++) { var uk = u - k * 20 / FLIGHT; if (uk > 0) { var f2 = coinFlight(uk, half); trail.push([f2.angle, f2.scale]); } } }
      coinDraw(ctx, { spec: spec, x: 100, y: 70, r: 40, angle: fl.angle, scale: fl.scale, img: img, faceRgb: FACE, t: t, trail: trail });
    });
    requestAnimationFrame(frame);
  }
  function redrawStills() { document.querySelectorAll('canvas.stills').forEach(stills); }
  img.onload = redrawStills; redrawStills();
  window.__coinSheet = { at: function (ms) { t0 = performance.now() - ms; }, ready: function () { return img.complete; } };
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>
`;
}

/** One replay page per Season 0 coin, the coin on p1 (the near side). */
export async function writeCoinBootPages(dir: string): Promise<string[]> {
  mkdirSync(dir, { recursive: true });
  const { replay } = await captureReplay("Cortex", "Swarm", 6, false);
  const out: string[] = [];
  for (const id of Object.keys(COIN_SPECS)) {
    const file = resolve(dir, `boot-${id}.html`);
    writeFileSync(file, renderMatchHtml({ ...replay, coins: { p1: id, p2: "coin-chrome-token" } }));
    out.push(file);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = resolve(dirname(fileURLToPath(import.meta.url)), "../output/coin-sheet.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderCoinSheetHtml());
  console.log(`wrote ${out}`);
  const k = process.argv.indexOf("--boot"), dir = k > 0 ? process.argv[k + 1] : undefined;
  if (dir) for (const f of await writeCoinBootPages(resolve(dir))) console.log(`wrote ${f}`);
}
