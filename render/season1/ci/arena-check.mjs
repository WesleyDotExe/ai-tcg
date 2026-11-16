// Season 1 arena prototype (render session 79): the headless browser check.
// Builds two real matches into the prototype page and drives them in Chromium:
// full screen, Watch as, hover to read, a card turning to face the viewer as it
// attacks, every beat to the end, the tabs, a phone, and the Home tile's size.
//   node render/season1/ci/arena-check.mjs [outDir]
// Writes check.txt and the screenshots to outDir
// (default progress/render/evidence/season1-arena-s80/).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const renderDir = resolve(here, "..", "..");
const outDir = resolve(process.argv[2] ?? join(renderDir, "..", "progress", "render", "evidence", "season1-arena-s80"));
mkdirSync(outDir, { recursive: true });

const MATCHES = [
  { args: ["Cortex", "Aegis", "2", "--signatures"], file: "arena-cortex-vs-aegis-sig-seed2.html" },
  { args: ["Swarm", "Null", "4"], file: "arena-swarm-vs-null-seed4.html" },
];
for (const m of MATCHES) execFileSync("npx", ["tsx", "season1/src/build.ts", ...m.args], { cwd: renderDir, stdio: "pipe" });

const lines = [];
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { (ok ? pass++ : fail++); lines.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const say = (s) => lines.push(s);

// The same lookup as Season 0's render/ci/browser-check.mjs (PW_CORE in CI).
async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, "playwright-core", "playwright", "/opt/node-tools/node_modules/playwright-core/index.mjs"].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); if (m.chromium) return m.chromium; } catch { /* next */ }
  }
  throw new Error("playwright-core not found (set PW_CORE to its index.mjs)");
}
const chromium = await loadPlaywright();
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

function dataOf(file) {
  const html = readFileSync(join(renderDir, "season1", "output", file), "utf8");
  return JSON.parse(html.slice(html.indexOf('id="s1data">') + 12, html.indexOf("</script>")));
}

async function open(file, viewport, query = "", extra = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
  const page = await ctx.newPage();
  const errors = [], outside = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) outside.push(r.url()); });
  await page.goto(pathToFileURL(join(renderDir, "season1", "output", file)).href + query);
  await page.waitForFunction(() => !!window.__s1);
  await page.waitForTimeout(600);
  return { ctx, page, errors, outside };
}

/** Distinct colours in the stage canvas: a blank or failed WebGL canvas has 1-2. */
async function canvasColours(page) {
  return page.evaluate(() => {
    const src = document.querySelector("canvas.gl");
    const c = document.createElement("canvas"); c.width = 160; c.height = 100;
    const g = c.getContext("2d"); g.drawImage(src, 0, 0, 160, 100);
    const d = g.getImageData(0, 0, 160, 100).data; const set = new Set();
    for (let i = 0; i < d.length; i += 4) set.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
    return set.size;
  });
}

const expectTable = (f, seat) => {
  const p = f.players[seat];
  return p.board.length + p.directives.length + (p.signature?.inZone ? 1 : 0);
};

async function stateAt(page) { return page.evaluate(() => window.__s1.state()); }
async function gotoBeat(page, b) { await page.evaluate((b) => { const s = document.getElementById("scrub"); s.value = String(b); s.dispatchEvent(new Event("input")); }, b); await page.waitForTimeout(80); }

// ---------------------------------------------------------------------------
say("== A. Full screen, 1440x900, Cortex vs Aegis (signature cards), as p1");
{
  const data = dataOf(MATCHES[0].file);
  const F = data.replay.frames;
  const { ctx, page, errors, outside } = await open(MATCHES[0].file, { width: 1440, height: 900 });
  const beats = await page.evaluate(() => window.__s1.beats);
  check("A1 the 3D arena draws (WebGL canvas, many colours)", (await canvasColours(page)) > 40, `${await canvasColours(page)} colour buckets`);
  // every beat: table, held hand, near hand, HUD numbers, pile counts agree with the frame
  let bad = [];
  for (let b = 0; b < beats; b++) {
    await gotoBeat(page, b);
    const st = await stateAt(page);
    const f = F[st.frame];
    const got = await page.evaluate(() => ({
      farName: document.querySelector("#hudFar [data-name]").textContent,
      nearName: document.querySelector("#hudNear [data-name]").textContent,
      farHp: +document.querySelector("#hudFar [data-hp]").textContent, nearHp: +document.querySelector("#hudNear [data-hp]").textContent,
      nearEn: +document.querySelector("#hudNear [data-en]").textContent,
      hand: document.querySelectorAll("#hand .hc").length,
      deckLbl: document.querySelector('[data-lbl="deck-p2"] b')?.textContent,
      feed: document.querySelectorAll("#feed .ev").length,
    }));
    const feedWant = F.slice(0, st.frame + 1).reduce((n, fr) => n + (fr.feed?.length ?? 0), 0);
    const want = {
      table: expectTable(f, "p1") + expectTable(f, "p2"), held: f.players.p2.hand.length, hand: f.players.p1.hand.length,
      farHp: f.players.p2.health, nearHp: f.players.p1.health, nearEn: f.players.p1.energy, deck: String(f.players.p2.deckSize),
    };
    const ok = st.table.length === want.table && st.held === want.held && got.hand === want.hand && got.farHp === want.farHp && got.nearHp === want.nearHp
      && got.nearEn === want.nearEn && got.deckLbl === want.deck && got.farName === data.replay.agentNames.p2 && got.nearName === data.replay.agentNames.p1 && got.feed === feedWant;
    if (!ok) bad.push({ b, st: { table: st.table.length, held: st.held }, got, want, feedWant });
  }
  check(`A2 every beat (${beats}) shows its frame: table cards, the far side's held hand, the near hand, HUD health/energy, the deck count, the play-by-play`, bad.length === 0, bad.length ? JSON.stringify(bad[0]).slice(0, 400) : `${beats} beats`);

  // a mid-game beat with units on both sides, for the hover and the screenshot
  let mid = -1;
  for (let b = Math.floor(beats * 0.55); b < beats; b++) { await gotoBeat(page, b); const st = await stateAt(page); if (st.table.some((c) => c.seat === "p1" && c.zone === "slot") && st.table.some((c) => c.seat === "p2" && c.zone === "slot")) { mid = b; break; } }
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(outDir, "full-p1.jpg"), type: "jpeg", quality: 82 });
  const st = await stateAt(page);
  const far = st.table.find((c) => c.seat === "p2" && c.zone === "slot"), near = st.table.find((c) => c.seat === "p1" && c.zone === "slot");
  const stageBox = await page.locator("#stage").boundingBox();
  const hoverRead = async (key) => {
    const [x, y] = await page.evaluate((k) => window.__s1.screenOfCard(k), key);
    await page.mouse.move(stageBox.x + x, stageBox.y + y); await page.waitForTimeout(120);
    return page.evaluate(() => (document.getElementById("reader").hidden ? null : { name: document.getElementById("reader").dataset.card, text: document.getElementById("reader").innerText }));
  };
  const rFar = await hoverRead(far.key), rNear = await hoverRead(near.key);
  check("A3 hover reads a far-side card upright and full size (its name, rules, owner)", rFar?.name === far.name && rFar.text.toUpperCase().includes(data.replay.agentNames.p2.toUpperCase()), `beat ${mid}: ${far.name} -> ${rFar?.name}`);
  check("A4 hover reads a near-side card", rNear?.name === near.name, `${near.name} -> ${rNear?.name}`);
  await page.mouse.move(stageBox.x + stageBox.width / 2 - 200, stageBox.y + stageBox.height / 2 - 30);
  await page.evaluate(() => document.getElementById("reader").hidden = false);
  const hp = await page.evaluate(() => window.__s1.heldScreen(0));
  let heldRead = "no held card";
  if (hp) { await page.mouse.move(stageBox.x + hp[0], stageBox.y + hp[1]); await page.waitForTimeout(120); heldRead = await page.evaluate(() => document.getElementById("reader").hidden ? "hidden" : document.getElementById("reader").dataset.card); }
  check("A5 a held card in the far side's hand can't be read (hidden information)", heldRead === "hidden", heldRead);
  await page.mouse.move(stageBox.x + rNear ? stageBox.x + 5 : 5, stageBox.y + 5);
  // the reader with a card open, for the record
  { const [x, y] = await page.evaluate((k) => window.__s1.screenOfCard(k), far.key); await page.mouse.move(stageBox.x + x, stageBox.y + y); await page.waitForTimeout(150); await page.screenshot({ path: join(outDir, "full-hover.jpg"), type: "jpeg", quality: 82 }); }

  // A6: an attack by the far side: the card turns to face the viewer, then settles facing its owner
  let atk = null;
  for (let b = 1; b < beats && !atk; b++) {
    const fi = await page.evaluate((b) => { const s = document.getElementById("scrub"); s.value = String(b); s.dispatchEvent(new Event("input")); return window.__s1.state().frame; }, b);
    const f = F[fi], prev = F[fi - 1];
    const known = new Set(prev.stack.map((s) => s.stackId));
    const item = f.stack.find((s) => !known.has(s.stackId) && s.kind === "combatDamage" && s.controller === "p2" && s.attackerInstanceId);
    if (item) atk = { b, key: item.attackerInstanceId };
  }
  if (atk) {
    await gotoBeat(page, atk.b - 1); await page.waitForTimeout(200);
    await page.click("#next");
    await page.waitForTimeout(330);
    const midYaw = await page.evaluate((k) => window.__s1.yawOf(k), atk.key);
    await page.screenshot({ path: join(outDir, "full-attack-turns.jpg"), type: "jpeg", quality: 82 });
    await page.waitForTimeout(1400);
    const endYaw = await page.evaluate((k) => window.__s1.yawOf(k), atk.key), rest = await page.evaluate((k) => window.__s1.restOf(k), atk.key);
    // viewer (p1) reads at yaw 0; the far side's card rests at PI
    check("A6 a far-side attacker turns to face the viewer mid-attack, then settles back facing its owner", Math.abs(midYaw) < 1.2 && Math.abs(endYaw - rest) < 1e-6 && Math.abs(rest - Math.PI) < 1e-6,
      `beat ${atk.b}: yaw mid-attack ${midYaw?.toFixed(2)} (viewer 0, rest 3.14), after ${endYaw?.toFixed(2)}`);
  } else check("A6 a far-side attack found", false);

  // A7: Watch as flips the whole view
  await gotoBeat(page, mid); await page.waitForTimeout(200);
  const before = await stateAt(page), camBefore = await page.evaluate(() => window.__s1.cameraZ());
  await page.click("#watchAs"); await page.waitForTimeout(500);
  const after = await stateAt(page), camAfter = await page.evaluate(() => window.__s1.cameraZ());
  const f = F[after.frame];
  const names = await page.evaluate(() => [document.querySelector("#hudFar [data-name]").textContent, document.querySelector("#hudNear [data-name]").textContent, document.getElementById("watchAs").textContent]);
  check("A7 Watch as swaps the seats: camera to the other side, HUDs swap, held hand is now p1's, the table's cards don't move",
    camBefore > 0 && camAfter < 0 && after.pov === "p2" && names[0] === data.replay.agentNames.p1 && names[1] === data.replay.agentNames.p2 && after.held === f.players.p1.hand.length
      && JSON.stringify(after.table.map((c) => c.key).sort()) === JSON.stringify(before.table.map((c) => c.key).sort()),
    `camera z ${camBefore.toFixed(1)} -> ${camAfter.toFixed(1)}; ${names[2]}`);
  await page.screenshot({ path: join(outDir, "full-p2.jpg"), type: "jpeg", quality: 82 });

  // A8: the tabs
  await page.click('.tabs button[data-t="chat"]'); await page.waitForTimeout(100);
  const tab = await page.evaluate(() => ({ feed: document.getElementById("feed").hidden, chat: document.getElementById("chat").innerText }));
  check("A8 the Chat tab: an empty room, coming soon (accounts to post, guests read)", tab.feed && /COMING SOON/.test(tab.chat) && /account/.test(tab.chat), tab.chat.replace(/\s+/g, " "));
  await page.click('.tabs button[data-t="pbp"]');

  // A9: play to the end at 2x from a late beat; the result shows
  await page.click("#watchAs");
  await gotoBeat(page, beats - 6); await page.click("#speed"); await page.click("#play");
  await page.waitForFunction((n) => window.__s1.state().beat === n - 1, beats, { timeout: 30000 });
  await page.waitForTimeout(800);
  const end = await page.evaluate(() => document.getElementById("turnline").textContent);
  const w = F[F.length - 1].winner;
  check("A9 played to the end (2x): the last beat names the winner", end.includes("WINS") && end.includes(data.replay.agentNames[w]), end);
  check("A10 no page errors; nothing loaded from outside", errors.length === 0 && outside.length === 0, [...errors, ...outside].slice(0, 3).join(" | ") || "0 errors, 0 outside requests");
  await ctx.close();
}

// ---------------------------------------------------------------------------
say("== B. A second replay, Swarm vs Null (no signature cards), every beat stepped with Next");
{
  const data = dataOf(MATCHES[1].file);
  const F = data.replay.frames;
  const { ctx, page, errors, outside } = await open(MATCHES[1].file, { width: 1280, height: 800 });
  const beats = await page.evaluate(() => window.__s1.beats);
  let bad = 0;
  for (let b = 1; b < beats; b++) {
    await page.click("#next"); await page.waitForTimeout(30);
    const st = await stateAt(page);
    if (st.beat !== b) bad++;
  }
  await page.waitForTimeout(1500);
  const st = await stateAt(page), f = F[st.frame];
  const sig = await page.evaluate(() => document.querySelector("#hudNear [data-sig]").textContent);
  check("B1 Next steps through every beat to the last frame; the table settles to the last frame's cards", bad === 0 && st.frame === F.length - 1 && st.table.length === expectTable(f, "p1") + expectTable(f, "p2") && st.busy === 0, `${beats} beats, ${st.table.length} cards on the table`);
  check("B2 a match without signature cards says so in the HUD", sig === "NO SIGNATURE", sig);
  check("B3 no page errors; nothing loaded from outside", errors.length === 0 && outside.length === 0, [...errors, ...outside].slice(0, 3).join(" | ") || "0 errors");
  await ctx.close();
}

// ---------------------------------------------------------------------------
say("== C. A phone (390x844, touch)");
{
  const { ctx, page, errors } = await open(MATCHES[0].file, { width: 390, height: 844 }, "", { isMobile: true, hasTouch: true });
  const beats = await page.evaluate(() => window.__s1.beats);
  await gotoBeat(page, Math.floor(beats * 0.62)); await page.waitForTimeout(500);
  const lay = await page.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    return { sw: document.documentElement.scrollWidth, stage: r("stage"), panel: document.querySelector(".panel").getBoundingClientRect(), far: r("hudFar"), near: r("hudNear") };
  });
  check("C1 no sideways scroll; the HUDs above and below the board; the panel under it", lay.sw <= 390 && lay.far.bottom <= lay.stage.top + 1 && lay.near.top >= lay.stage.bottom - 1 && lay.panel.top >= lay.near.bottom, `scrollWidth ${lay.sw}, stage ${Math.round(lay.stage.height)} px tall, panel at ${Math.round(lay.panel.top)}`);
  const st = await stateAt(page);
  const outOf = [];
  for (const c of st.table) { const [x, y] = await page.evaluate((k) => window.__s1.screenOfCard(k), c.key); if (x < 0 || x > lay.stage.width || y < 0 || y > lay.stage.height) outOf.push(c.name); }
  check("C2 every card on the table is inside the board's view", outOf.length === 0, outOf.join(", ") || `${st.table.length} cards`);
  const card = st.table.find((c) => c.zone === "slot");
  const [x, y] = await page.evaluate((k) => window.__s1.screenOfCard(k), card.key);
  await page.touchscreen.tap(lay.stage.x + x, lay.stage.y + y); await page.waitForTimeout(150);
  const read = await page.evaluate(() => document.getElementById("reader").hidden ? null : document.getElementById("reader").dataset.card);
  const rb = await page.locator("#reader").boundingBox();
  check("C3 tap a card to read it; the reader fits the screen", read === card.name && rb && rb.x >= 0 && rb.x + rb.width <= 390, `${card.name} -> ${read}`);
  await page.screenshot({ path: join(outDir, "phone-read.jpg"), type: "jpeg", quality: 82 });
  await page.touchscreen.tap(lay.stage.x + 10, lay.stage.y + 10); await page.waitForTimeout(100);
  await page.screenshot({ path: join(outDir, "phone.jpg"), type: "jpeg", quality: 82 });
  check("C4 no page errors", errors.length === 0, errors.slice(0, 2).join(" | ") || "0 errors");
  await ctx.close();
}

// ---------------------------------------------------------------------------
say("== D. The Home tile's size (480x300, ?mode=tile)");
{
  const { ctx, page, errors } = await open(MATCHES[0].file, { width: 480, height: 300 }, "?mode=tile");
  const vis = await page.evaluate(() => ({
    panel: getComputedStyle(document.querySelector(".panel")).display, top: getComputedStyle(document.querySelector(".topbar")).display,
    hud: document.getElementById("hudFar").getBoundingClientRect().height, stage: document.getElementById("stage").getBoundingClientRect().height,
  }));
  check("D1 the tile: no panel, no top bar, slim HUDs, the board takes the rest", vis.panel === "none" && vis.top === "none" && vis.hud < 50 && vis.stage > 200, JSON.stringify(vis));
  const b0 = (await stateAt(page)).beat;
  await page.waitForTimeout(3500);
  const b1 = (await stateAt(page)).beat;
  check("D2 the tile plays on its own", b1 > b0, `beat ${b0} -> ${b1} in 3.5 s`);
  check("D3 the 3D arena draws at tile size", (await canvasColours(page)) > 30, `${await canvasColours(page)} colour buckets`);
  await gotoBeat(page, 40); await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, "tile.jpg"), type: "jpeg", quality: 82 });
  check("D4 no page errors", errors.length === 0, errors.slice(0, 2).join(" | ") || "0 errors");
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Render session 80: the owner's "zoom in a little, especially the tile".
// At each size: the camera's distance, a unit slot's width on screen (the zoom,
// measured), every zone corner inside the board, and the near directive row
// clear of the near hand (the zoom must not slide the board under the hand).
say("== E. The framing (render session 80: zoomed in a little, the tile most)");
const framings = [];
for (const [label, viewport, query, extra] of [
  ["full 1440x900", { width: 1440, height: 900 }, "", {}],
  ["full 1280x720", { width: 1280, height: 720 }, "", {}],
  ["tile 480x300", { width: 480, height: 300 }, "?mode=tile", {}],
  ["phone 390x844", { width: 390, height: 844 }, "", { isMobile: true, hasTouch: true }],
]) {
  const { ctx, page, errors } = await open(MATCHES[0].file, viewport, query, extra);
  await page.evaluate(() => { if (document.body.classList.contains("tile")) document.getElementById("play")?.click(); });
  const beats = await page.evaluate(() => window.__s1.beats);
  // a beat where the near side holds cards, so the hand is drawn
  let b = Math.floor(beats * 0.55), edge = null;
  for (; b < beats; b++) { await gotoBeat(page, b); edge = await page.evaluate(() => window.__s1.nearEdge()); if (edge.handTop !== null) break; }
  await page.waitForTimeout(300);
  const fr = await page.evaluate(() => ({ ...window.__s1.framing(), slot: window.__s1.slotWidth() }));
  const box = await page.locator("#stage").boundingBox();
  const out = fr.zones.filter(([x, y]) => x < 0 || x > box.width || y < 0 || y > box.height);
  framings.push(`${label}: camera ${fr.d.toFixed(2)}, aim ${fr.look.toFixed(2)}, slot ${fr.slot.toFixed(0)} px`);
  check(`E ${label}: every zone corner on the board`, out.length === 0, `${fr.zones.length - out.length} of ${fr.zones.length} corners in a ${Math.round(box.width)}x${Math.round(box.height)} board`);
  check(`E ${label}: the near directive row clear of the near hand`, edge.handTop !== null && edge.dirEdge <= edge.handTop + 1, `directive edge y ${edge.dirEdge.toFixed(0)}, hand top y ${edge.handTop?.toFixed(0)} (beat ${b})`);
  check(`E ${label}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | ") || "0 errors");
  await page.screenshot({ path: join(outDir, `frame-${label.split(" ")[0]}-${viewport.width}.jpg`), type: "jpeg", quality: 82 });
  await ctx.close();
}
for (const f of framings) say(`   ${f}`);

await browser.close();
const out = [`Season 1 arena prototype — browser check (render sessions 79-80)`, `pages: ${MATCHES.map((m) => "render/season1/output/" + m.file).join(", ")}`, "", ...lines, "", `${pass} PASS, ${fail} FAIL`].join("\n");
writeFileSync(join(outDir, "check.txt"), out + "\n");
console.log(out);
process.exitCode = fail ? 1 : 0;
