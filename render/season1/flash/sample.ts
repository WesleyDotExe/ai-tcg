// The automatic flash check's frame sampler (render session 85; the owner's
// 2026-11-22 plan, phase 1 step 4, decision 22). Plays a page in headless
// Chromium on a virtual clock, frame by frame, and measures every frame with
// season1/src/flashScan.ts: it fails if any one second has more than three
// flashes (or red flashes) over more than a quarter of a 10-degree field of
// view (WCAG 2.3.1).
//
// Why a virtual clock: a real-time screenshot loop drops frames whenever the
// machine is busy (and software WebGL is slow), so it would miss exactly the
// short flashes it is looking for. Here Chromium draws only when asked
// (--enable-begin-frame-control, HeadlessExperimental.beginFrame), each frame
// at a set time, and the page's own timers, requestAnimationFrame and
// performance.now run on Playwright's fake clock, advanced by the same step.
// So the CSS animations, the shaders and the page's scheduled beats all see
// the same time, and every frame at the sample rate is captured: the result
// is the same on a fast machine and a slow one.
//
//   npx tsx render/season1/flash/sample.ts [--page FILE] [--runs pack=1,pack=8,bulk=1]
//        [--fps 30] [--reduce] [--out DIR] [--stills] [--max-ms 60000]
//
// --page defaults to Season 0's pack opening (render/output/pack-opening.html,
// read only; nothing about it changes). A run is `pack=N` (the Nth showcase
// pack, opened by ?pack=N and driven to its summary), `bulk=N` (the Nth
// ten-pack open, driven to its summary), `idle=MS` (the page as it loads,
// for MS ms, untouched) or `sweep=MS` (render session 95: the pointer swept
// across the page and back every 600 ms, for MS ms: the fastest a hand moves
// a light that follows the pointer). The driving taps as soon as the page takes a tap,
// which is the fastest an owner can go: the worst case for flashes per
// second. --reduce runs with prefers-reduced-motion: reduce.
//
// Writes, per run, <out>/<run>.txt (the verdict, the worst second, every
// flash big enough to count, a timeline per quarter second) and, with
// --stills, a JPEG of the frame at each counted flash. Exit code 1 if any run
// fails.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { analyse, blocksOf, decodePng, FlashTracker, type FlashReport } from "../src/flashScan.js";

// The render lane's one Playwright lookup (render/ci/pw.mjs).
const pwPath = new URL("../../ci/pw.mjs", import.meta.url).href;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { chromium } = (await import(pwPath)) as { chromium: any };

const ROOT = resolve(new URL("../../..", import.meta.url).pathname);
const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1]! : d; };
const flag = (k: string) => args.includes(k);
const page = resolve(opt("--page", resolve(ROOT, "render/output/pack-opening.html")));
// --repeat N plays each run N times (written as <run>-r<k>): repeat runs of
// one opening differ a little (some of the page's timing follows real time:
// see FLASH.md), so a verdict near the limit needs more than one sample.
const repeat = Math.max(1, Number(opt("--repeat", "1")));
const runs = opt("--runs", "pack=1,pack=2,pack=3,pack=4,pack=5,pack=6,pack=7,pack=8,pack=9,pack=10,bulk=1").split(",").filter(Boolean)
  .flatMap((r) => (repeat > 1 ? Array.from({ length: repeat }, (_, k) => `${r}#${k + 1}`) : [r]));
const fps = Number(opt("--fps", "30"));
const reduce = flag("--reduce");
const out = resolve(opt("--out", resolve(ROOT, "progress/render/evidence/season1-flash-audit-s85")));
const stills = flag("--stills");
const maxMs = Number(opt("--max-ms", "60000"));
// How long an owner waits, once the page will take a tap, before tapping
// (ms): 900 is a quick owner glancing at each card; 0 taps the moment the
// page allows, the fastest anyone can go (a stress figure: rapid card swaps
// read as flashes because the cards themselves change under the finger).
const pace = Number(opt("--pace", "900"));
const jobs = Math.max(1, Number(opt("--jobs", "3")));
const suffix = `${pace === 0 ? "-fastest" : ""}${reduce ? "-reduced" : ""}${repeat > 1 ? "-repeats" : ""}`;
const VIEW = { width: 1024, height: 768 }; // WCAG's own reference screen for the field of view
mkdirSync(out, { recursive: true });

// One browser per job: two pages under begin-frame control in one browser
// wait on each other's frames and stall.
const launchArgs = {
  args: [
    "--deterministic-mode", "--enable-begin-frame-control", "--run-all-compositor-stages-before-draw",
    "--disable-threaded-animation", "--disable-threaded-scrolling", "--disable-checker-imaging",
    "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist",
  ],
};
// A plain browser for turning kept PNG frames into JPEG stills.
const plain = stills ? await chromium.launch() : null;

interface RunResult { run: string; report: FlashReport; ended: string; taps: number; drawn: number; label: string; errors: string[]; secs: { capture: number; measure: number } }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sampleRun(browser: any, run: string): Promise<RunResult> {
  const [kind, nStr] = run.split("#")[0]!.split("=") as [string, string];
  const n = Number(nStr);
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, reducedMotion: reduce ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  const errors: string[] = [];
  p.on("pageerror", (e: Error) => errors.push(String(e)));
  await p.clock.install({ time: new Date("2026-11-23T00:00:00Z") });
  // The page's sparks, jitter and glitches use Math.random: seeded, so a run
  // gives the same frames every time.
  await p.addInitScript(() => { let a = 0x85f1a5; Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
  const cdp = await ctx.newCDPSession(p);
  const url = pathToFileURL(page).href + (kind === "pack" ? `?pack=${n}` : kind === "bulk" ? `?bulk=${n}` : "");
  await p.goto(url, { waitUntil: "load" });
  const label = await p.evaluate(({ kind, n }: { kind: string; n: number }) => {
    const d = JSON.parse(document.getElementById("pack-data")?.textContent || "{}");
    const l = kind === "pack" ? d.packs?.[n - 1]?.label : kind === "bulk" ? d.bulks?.[n - 1]?.label : kind === "sweep" ? "the pointer swept across and back every 600 ms" : "the page at rest";
    return l || "";
  }, { kind, n }).catch(() => "");
  const tracker = new FlashTracker();
  const step = 1000 / fps;
  let ticks = 1_000_000, clockMs = 0, frame = 0, taps = 0, ended = "the time limit", summaryAt = -1, drawn = 0, readyAt = -1;
  let tCapture = 0, tMeasure = 0;
  const kept = new Map<number, Buffer>();
  const busyFrames: number[] = [];
  while (frame * step < maxMs) {
    const target = Math.round((frame + 1) * step);
    await p.clock.runFor(target - clockMs); clockMs = target;
    ticks += step;
    const c0 = Date.now();
    const r = await cdp.send("HeadlessExperimental.beginFrame", { frameTimeTicks: ticks, interval: step, screenshot: { format: "png", optimizeForSpeed: true } });
    tCapture += Date.now() - c0;
    if (r.screenshotData) {
      drawn++;
      const m0 = Date.now();
      const png = Buffer.from(r.screenshotData, "base64");
      const before = tracker.frames;
      tracker.push(blocksOf(decodePng(png)));
      tMeasure += Date.now() - m0;
      const changed = tracker.lumChanges[before]!.length;
      if (stills && changed > 40) { kept.set(before, png); busyFrames.push(before); if (busyFrames.length > 120) kept.delete(busyFrames.shift()!); }
    } else if (tracker.frames) {
      // Nothing new drawn: the same frame again.
      const last = tracker.frames - 1;
      tracker.lumChanges.push(new Int32Array(0)); tracker.redChanges.push(new Int32Array(0)); tracker.meanLum.push(tracker.meanLum[last]!);
    }
    frame++;
    // Synthetic pointer events: a real mouse move waits on a drawn frame,
    // which under begin-frame control never comes until asked (it stalls).
    if (kind === "sweep") await p.evaluate(({ x, y }: { x: number; y: number }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any, last = w.__sweepLast ?? { x, y };
      w.__sweepLast = { x, y };
      document.elementFromPoint(x, y)?.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, movementX: x - last.x || 1, movementY: y - last.y, pointerType: "mouse", bubbles: true }));
    }, { x: Math.round(VIEW.width / 2 + (VIEW.width * 0.45) * Math.sin((2 * Math.PI * clockMs) / 600)), y: Math.round(VIEW.height * 0.55 + 120 * Math.sin((2 * Math.PI * clockMs) / 1300)) });
    if (kind === "idle" || kind === "sweep") { if (clockMs >= n) { ended = "its time"; break; } continue; }
    if (frame % 3 !== 0) continue;
    // The owner's taps (the s62 check's drive), `pace` ms after the page will take one.
    const s = await p.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const S = (window as any).__pack, now = performance.now();
      if (!S) return { phase: "none" };
      const R = S.row;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const downs = R && R.r ? R.r.cards.map((_: unknown, k: number) => k).filter((k: number) => { const c = R.r.cards[k]; return (c.build ? c.build.held : c.faceDown) && !R.flipped[k]; }) : [];
      return { phase: S.phase as string, busy: now < S.busyUntil, building: !!(R && R.building), row: !!R, waiting: !!(R && R.waiting), downs: downs.length as number };
    });
    if (s.phase === "summary") { if (summaryAt < 0) summaryAt = clockMs; if (clockMs - summaryAt >= 1500) { ended = "the summary"; break; } continue; }
    let tap: string | null = null;
    if (s.phase === "pack") tap = "#pack";
    else if (s.phase === "fan") tap = "#fan";
    else if (s.phase === "cards" && !s.busy) tap = "doc";
    else if (s.phase === "bulk" && s.row && !s.building && (!s.busy || s.waiting)) tap = "doc";
    if (!tap) { readyAt = -1; continue; }
    if (readyAt < 0) readyAt = clockMs;
    if (clockMs - readyAt < pace) continue;
    readyAt = -1;
    {
      taps++;
      await p.evaluate((sel: string) => {
        const el = sel === "doc" ? document : document.querySelector(sel);
        el?.dispatchEvent(new KeyboardEvent("keydown", { key: sel === "doc" ? "ArrowRight" : "Enter", bubbles: true, cancelable: true }));
      }, tap);
    }
  }
  const report = analyse(tracker, fps, VIEW.width, VIEW.height);
  if (stills && plain) {
    const sp = await (await plain.newContext({ viewport: VIEW })).newPage();
    for (const [k, bf] of report.bigFlashes.entries()) {
      const f = Math.round((bf.at * fps) / 1000);
      // the kept frame nearest the flash's first change, a little after it (the light at its height)
      const near = [...kept.keys()].filter((x) => x >= f).sort((a, b) => a - b)[0] ?? [...kept.keys()].pop();
      if (near === undefined) continue;
      await sp.setContent(`<style>body{margin:0}</style><img src="data:image/png;base64,${kept.get(near)!.toString("base64")}">`);
      await sp.screenshot({ path: `${out}/${run.replace("=", "-").replace("#", "-r")}${suffix}-flash${k + 1}.jpg`, type: "jpeg", quality: 80 });
    }
    await sp.context().close();
  }
  await ctx.close();
  return { run, report, ended, taps, drawn, label, errors, secs: { capture: Math.round(tCapture / 1000), measure: Math.round(tMeasure / 1000) } };
}

function describe(r: RunResult): string {
  const R = r.report, L: string[] = [];
  L.push(`${r.run}${r.label ? ` (${r.label})` : ""}${reduce ? ", reduced motion" : ""}, ${pace ? `tapping ${pace} ms after the page is ready` : "tapping as fast as the page allows"}: ${R.pass ? "PASS" : "FAIL"}`);
  L.push(`  ${R.frames} frames at ${R.fps} fps (${(R.ms / 1000).toFixed(1)} s, ${r.drawn} drawn), ${r.taps} taps, ended at ${r.ended}${r.errors.length ? `, page errors: ${r.errors.join(" | ")}` : ""}`);
  L.push(`  field of view: ${R.field.w} x ${R.field.h} blocks (8 px); a flash counts over ${R.field.blocks} blocks (25%)`);
  L.push(`  worst second: ${R.worst.flashes} flashes (${R.worst.changes} changes) from ${(R.worst.at / 1000).toFixed(2)} s (flashed area ${(R.worst.flashArea * 100).toFixed(0)}% of a field); worst red: ${R.worstRed.redFlashes} (${R.worstRed.redChanges} changes) from ${(R.worstRed.at / 1000).toFixed(2)} s`);
  if (R.fails.length) for (const f of R.fails) L.push(`  FAILS: seconds starting ${(f.from / 1000).toFixed(2)}-${(f.to / 1000 - 1).toFixed(2)} s: up to ${f.changes / 2} ${f.red ? "red " : ""}flashes (${f.changes} changes) in one second`);
  L.push(`  biggest whole-screen jump (within 250 ms): mean luminance ${R.biggestScreenJump.from} -> ${R.biggestScreenJump.to} at ${(R.biggestScreenJump.at / 1000).toFixed(2)} s`);
  L.push(`  single flashes big enough to count (over 25% of a field): ${R.bigFlashes.length ? R.bigFlashes.map((b) => `${(b.at / 1000).toFixed(2)} s (${Math.round(b.area * 100)}%)`).join(", ") : "none"}`);
  L.push(`  timeline (each quarter second: changes in the second from there / flashed area; 7 changes = more than 3 flashes):`);
  const row: string[] = [];
  const q = Math.max(1, Math.round(R.fps / 4));
  for (let i = 0; i < R.windows.length; i += q) { const w = R.windows[i]!; row.push(`${(w.at / 1000).toFixed(2)}:${w.changes}${w.redChanges ? `r${w.redChanges}` : ""}/${Math.round(w.flashArea * 100)}%`); }
  for (let i = 0; i < row.length; i += 8) L.push(`    ${row.slice(i, i + 8).join("  ")}`);
  return L.join("\n");
}

let failed = 0;
const results: (RunResult | null)[] = runs.map(() => null);
let next = 0;
await Promise.all(Array.from({ length: Math.min(jobs, runs.length) }, async () => {
  const browser = await chromium.launch(launchArgs);
  while (next < runs.length) {
    const k = next++, run = runs[k]!, t0 = Date.now();
    const r = await sampleRun(browser, run);
    results[k] = r;
    const text = describe(r);
    console.log(text + `\n  (sampled in ${((Date.now() - t0) / 1000).toFixed(0)} s: drawing ${r.secs.capture} s, measuring ${r.secs.measure} s)\n`);
    writeFileSync(`${out}/${run.replace("=", "-").replace("#", "-r")}${suffix}.txt`, text + "\n");
  }
  await browser.close();
}));
const summary: string[] = [];
for (const r of results as RunResult[]) {
  summary.push(`${r.report.pass ? "PASS" : "FAIL"} ${r.run}${r.label ? ` (${r.label})` : ""}: worst ${r.report.worst.flashes} flashes/s (${r.report.worst.changes} changes), red ${r.report.worstRed.redFlashes}/s, ${r.report.bigFlashes.length} counted flash${r.report.bigFlashes.length === 1 ? "" : "es"}, screen jump ${r.report.biggestScreenJump.from}->${r.report.biggestScreenJump.to}, ${(r.report.ms / 1000).toFixed(1)} s, ${r.taps} taps, ended at ${r.ended}${r.errors.length ? ", PAGE ERRORS" : ""}`);
  if (!r.report.pass) failed++;
}
console.log(summary.join("\n"));
writeFileSync(`${out}/summary${suffix}.txt`, `Flash check (WCAG 2.3.1), ${page.replace(ROOT + "/", "")}, ${VIEW.width}x${VIEW.height}, ${fps} fps${reduce ? ", reduced motion" : ""}, ${pace ? `tapping ${pace} ms after the page is ready` : "tapping as fast as the page allows"}\n${summary.join("\n")}\n${failed} of ${runs.length} fail\n`);
if (plain) await plain.close();
process.exit(failed ? 1 : 0);
