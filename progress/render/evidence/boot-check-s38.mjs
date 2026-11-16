// Render session 38: Match Boot slice 2 (sound and the phone), driven in a
// real (headless) Chromium. Not a repo dependency: run with node and the
// preinstalled playwright-core:
//   node boot-check-s38.mjs <outDir> <render/output> [old replay html]
// The page's own audio is recorded: an init script taps every limiter that
// connects to the speakers (an AudioWorklet on the master bus, each block
// stamped with its frame on the audio clock), so the checks measure what a
// viewer hears, not the page's intentions. Runs, each from a fresh profile:
//   A  desktop replay, Play at move 0: every intro sound queued ahead on the
//      audio clock, none late; each one HEARD at its planned time (an onset
//      in the recording within 5 ms); left and right equal (dead centre); no
//      clipping; the music silent under the intro and starting after it.
//   B  the same with the main thread stalled for 100 ms mid-typing: the
//      clicks still land on time. [old html] gets the same stall for a
//      before/after (slice 1 fired sounds from the frames).
//   C  Escape at about 1 s: the intro's sounds are cut (a 30 ms fade), none
//      queued after; the music starts at once.
//   D  pause during the intro: the same.
//   E  effects muted, music on: no intro sound, the music still waits.
//   F  music muted, then switched on mid-intro: it waits for the intro's end.
//   G  a phone, portrait: the agent lines on two rows, bigger; inside their
//      screens; Skip at least 44 x 88 px; no sideways scroll; stills.
//   H  a phone, landscape: laid out (or the still) without a problem; no
//      sideways scroll; a still.
//   I  the desktop lines stay on one row, at most 15 px.
//   J  reduced motion: the still's two sounds at 0, the music waits 1 s.
//   K  the sheet: the rare saying's flourish heard over the hit; the
//      phone-rows scene breaks its lines.
import { chromium, launchOpts } from '../../../render/ci/pw.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
const [outDir, outputArg, oldHtml] = process.argv.slice(2);
const OUT = resolve(outputArg || 'render/output');
mkdirSync(outDir, { recursive: true });
// The pages are served over local HTTP (the recorder's worklet can't load
// from a file:// page): the path is the file's absolute path.
const server = createServer((req, res) => {
  try { const body = readFileSync(decodeURIComponent(new URL(req.url, 'http://x').pathname)); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const HOST = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch({ args: ['--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
let fails = 0;
const log = (...a) => console.log(...a);
function check(ok, what) { log((ok ? '  PASS ' : '  FAIL ') + what); if (!ok) fails++; }
const TAG = 'v2-s38';

// The tap: every DynamicsCompressor that connects to a context's speakers is
// also fed to a recorder, an AudioWorklet on the audio thread (so a stalled
// main thread can't corrupt the recording), which sends each 128-frame
// block with its exact frame on the audio clock.
const TAP = () => {
  const orig = AudioNode.prototype.connect;
  window.__tap = { blocks: [], on: false, ready: false };
  const SRC = `registerProcessor('tap-rec', class extends AudioWorkletProcessor {
    process(ins) { const i = ins[0]; if (i && i.length) this.port.postMessage({ f: currentFrame, L: i[0].slice(), R: (i[1] || i[0]).slice() }); return true; }
  });`;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = orig.call(this, dest, ...rest);
    if (this instanceof DynamicsCompressorNode && dest === this.context.destination && !this.__tapped) {
      this.__tapped = true;
      const C = this.context, comp = this;
      C.audioWorklet.addModule(URL.createObjectURL(new Blob([SRC], { type: 'application/javascript' }))).then(() => {
        const n = new AudioWorkletNode(C, 'tap-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
        const z = C.createGain(); z.gain.value = 0;
        n.port.onmessage = (e) => { if (window.__tap.on) window.__tap.blocks.push({ t: e.data.f / C.sampleRate, sr: C.sampleRate, L: e.data.L, R: e.data.R }); };
        orig.call(comp, n); orig.call(n, z); orig.call(z, C.destination);
        window.__tap.ready = true;
      });
    }
    return r;
  };
};
// Start the effects' audio before Play (the replay's own unlock, as a first
// gesture would) so the recorder is attached before the intro's first sound.
async function warm(page) {
  await page.evaluate(() => window.__sfx.unlock());
  await page.waitForFunction(() => window.__tap.ready, null, { timeout: 5000 });
  await page.waitForTimeout(200);
}
// In the page: the recording between t0 and t1 (audio clock) as envelopes
// in 1 ms windows: the full level (both channels), the level in a band
// around 2.2 kHz (a band-pass biquad: where the key clicks, the chirp and
// the flourish's blips sit, clear of the hum below and the 7.8 kHz flyback
// whine above), and the peak and left/right energy.
const ANALYSE = ([t0, t1]) => {
  const bl = window.__tap.blocks.filter((k) => k.t + k.L.length / k.sr >= t0 && k.t <= t1);
  if (!bl.length) return null;
  const sr = bl[0].sr, n = Math.ceil((t1 - t0) * 1000);
  // RBJ band-pass, 2200 Hz, Q 1.4 (0 dB peak).
  const w0 = 2 * Math.PI * 2200 / sr, al = Math.sin(w0) / (2 * 1.4), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w0) / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const band = new Float64Array(n), full = new Float64Array(n), cnt = new Float64Array(n);
  let peak = 0, sL = 0, sR = 0;
  for (const k of bl) for (let i = 0; i < k.L.length; i++) {
    const t = k.t + i / sr, j = Math.floor((t - t0) * 1000);
    const x = (k.L[i] + k.R[i]) / 2, y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    if (j < 0 || j >= n) continue;
    band[j] += y * y; full[j] += x * x; cnt[j]++;
    peak = Math.max(peak, Math.abs(k.L[i]), Math.abs(k.R[i])); sL += k.L[i] * k.L[i]; sR += k.R[i] * k.R[i];
  }
  // A window no sample landed in (the blocks' clock stamps jitter by a
  // sample or two) takes its neighbour's level.
  const sq = (a) => { const o = Array.from(a, (v, j) => cnt[j] ? Math.sqrt(v / cnt[j]) : -1); for (let j = 0; j < o.length; j++) if (o[j] < 0) o[j] = j ? o[j - 1] : 0; return o; };
  return { band: sq(band), full: sq(full), peak, balanceDb: 10 * Math.log10((sL + 1e-12) / (sR + 1e-12)) };
};
// The path's own delay (the limiter looks a few ms ahead, and the thump's
// attack takes a moment to pass 5% of its peak): taken from the power-on's
// thump, the intro's first sound, so every other sound is timed against it. What this proves
// is that every sound is heard at its planned time relative to the intro's
// start on the audio clock.
function tapDelay(A, startIdx) {
  let mx = 0; for (let j = startIdx; j < Math.min(A.full.length, startIdx + 200); j++) mx = Math.max(mx, A.full[j]);
  for (let j = startIdx; j < Math.min(A.full.length, startIdx + 200); j++) if (A.full[j] >= mx * 0.05) return j - startIdx;
  return null;
}
// Onset of a sound planned at ms p (envelope index): the first 1 ms window
// from p-12 whose level passes a quarter of the peak in [p-12, p+25], and
// how much louder [e-3, e+7) is than [e-15, e-5) around the onset e found.
function onset(env, p) {
  const lo = Math.max(0, p - 12), hi = Math.min(env.length, p + 25);
  let mx = 0; for (let j = lo; j < hi; j++) mx = Math.max(mx, env[j]);
  let at = null; for (let j = lo; j < hi; j++) if (env[j] >= mx / 4) { at = j; break; }
  const avg = (a, b2) => { let s = 0, c = 0; for (let j = Math.max(0, a); j < Math.min(env.length, b2); j++) { s += env[j]; c++; } return c ? s / c : 0; };
  const e = at == null ? p : at;
  return { err: at == null ? null : at - p, rise: avg(e - 3, e + 7) / (avg(e - 15, e - 5) + 1e-9) };
}
// Click-like onsets anywhere in [a, b) ms, without a plan (for the old page):
// local peaks of the high-passed level at least 15 ms apart.
function clicks(env, a, bb, thr) {
  const out = [];
  for (let j = Math.max(1, a); j < Math.min(env.length - 1, bb); j++) {
    if (env[j] >= thr && env[j] >= env[j - 1] && env[j] >= env[j + 1] && (!out.length || j - out[out.length - 1] >= 15)) out.push(j);
  }
  return out;
}

async function open(file, o = {}) {
  const vp = o.phone ? (o.land ? { width: 844, height: 390 } : { width: 390, height: 844 }) : { width: 1280, height: 900 };
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: !!o.phone, isMobile: !!o.phone, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(TAP);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { log('  PAGE ERROR ' + e.message); fails++; });
  await page.goto(HOST + (file.startsWith('/') ? file : resolve(OUT, file)));
  await page.waitForTimeout(500);
  return { ctx, page };
}
const stats = (page) => page.evaluate(() => window.__boot.stats());
const mus = (page) => page.evaluate(() => window.__music.stats());
const snd = (page) => page.evaluate(() => window.__sfx.stats());
const introT = (page) => page.evaluate(() => window.__boot.stats().t);
const waitIntroT = (page, t) => page.waitForFunction((t) => { const s = window.__boot.stats(); return !s.active || s.t >= t; }, t, { timeout: 15000 });
const waitEnd = (page) => page.waitForFunction(() => !window.__boot.stats().active, null, { timeout: 15000 });
async function playAndTap(page, how = 'click') {
  if (await page.evaluate(() => window.__sfx.state() !== 'muted')) await warm(page);
  await page.evaluate(() => { window.__tap.on = true; });
  if (how === 'click') await page.click('#btn-play'); else await page.keyboard.press(' ');
  await page.waitForFunction(() => window.__boot.stats().active, null, { timeout: 5000 });
}

// ---- A: the sounds as heard, the balance, the music after ----------------
// The power-on's thump gives the recording path's delay only roughly (its
// attack is soft); the delay common to every sound is the median of their
// errors. What is checked is each sound's spread around it: all on one
// clock, at their planned distances from each other.
function spread(res) {
  const ok = res.filter((r) => r.err != null).map((r) => r.err).sort((a, b) => a - b);
  const med = ok.length ? ok[Math.floor(ok.length / 2)] : 0;
  return res.map((r) => ({ ...r, common: med, dev: r.err == null ? null : r.err - med }));
}
// Which envelope shows each sound's start: the thumps in the full level,
// the clicks, the chirp and the blips in the 2.2 kHz band.
const BAND_KINDS = { type: 1, handshake: 1, bootRoot: 1 };
async function heard(page, base) {
  const s = await stats(page);
  const A = await page.evaluate(ANALYSE, [base - 0.03, base + 3.2]);
  const off = 30; // envelope index of intro t=0
  const first = s.sched[0];
  const lag = tapDelay(A, off + first.at) ;
  // The four clicks typed with HANDSHAKE OK sound under its chirp, whose
  // 2.1 kHz tone fills the same band: they can't be told apart in the
  // recording, so they are left out of the timing (they are queued like
  // the rest; see the queue check).
  const hs = s.sched.find((x) => x.kind === 'handshake');
  const underChirp = (x) => x.kind === 'type' && hs && x.t >= hs.t && x.t < hs.t + 200;
  // (Render session 80.) The coin's whir (render session 53, after this
  // check was written) starts 40 ms into the flick's ring, its ticks a
  // third as loud: it has no onset of its own in the recording either, so
  // it is left out of the timing the same way (it is queued like the rest).
  const underFlick = (x) => /^coinWhir/.test(x.kind);
  const res = s.sched.slice(1).filter((x) => !underChirp(x) && !underFlick(x)).map((x) => ({ kind: x.kind, t: x.t, ...onset(BAND_KINDS[x.kind] ? A.band : A.full, off + x.at + lag) }));
  return { s, A, res: spread(res), lag, hidden: s.sched.filter(underChirp).length, masked: s.sched.filter(underFlick).length };
}
{
  log('\n[A] cortex-vs-swarm-seed6.html: Play at move 0, sound and music on');
  const { ctx, page } = await open('cortex-vs-swarm-seed6.html');
  await playAndTap(page);
  await waitIntroT(page, 2350);
  const m1 = await mus(page);
  await waitEnd(page);
  await page.waitForTimeout(900);
  const m2 = await mus(page);
  const s = await stats(page);
  check(s.last.saying === 'ENGAGE', `A. the seed's saying: "${s.last.saying}"`);
  check(s.sched.length === s.planned && s.late === 0, `A. all ${s.planned} intro sounds queued on the audio clock, none dropped (${s.sched.length} queued, ${s.late} late)`);
  const rest = s.sched.slice(1);
  check(rest.every((x) => x.lead >= 0 && x.at === x.t), `A. every sound after the first queued ahead at its exact planned time (lead ${Math.min(...rest.map((x) => x.lead))}-${Math.max(...rest.map((x) => x.lead))} ms)`);
  check(s.sched[0].kind === 'bootOn' && s.sched[0].at <= 5, `A. the power-on at 0 goes out as Play is pressed (${s.sched[0].at} ms in: the audio can't start in the past)`);
  const kinds = {}; s.sched.forEach((x) => { kinds[x.kind] = (kinds[x.kind] || 0) + 1; });
  check(kinds.bootOn === 1 && !kinds.crt && kinds.handshake === 1 && kinds.bootHit === 1 && kinds.type > 10, `A. its own power-on, not the boast's tube: ${JSON.stringify(kinds)}`);
  const { A, res, lag, hidden, masked } = await heard(page, s.audioBase);
  const devs = res.map((r) => r.dev), bad = res.filter((r) => r.dev == null || Math.abs(r.dev) > 3 || r.rise < 1.5);
  check(lag != null && lag + res[0].common < 30, `A. the recording path's own delay: ${lag + res[0].common} ms (the thump's rough ${lag} ms, plus the common ${res[0].common} ms)`);
  check(bad.length === 0 && hidden === 4 && masked === 1, `A. every later sound HEARD at its planned distance from the others: ${res.length} onsets (all but the ${hidden} clicks under the chirp and the coin's whir under its flick), spread ${Math.min(...devs)} to ${Math.max(...devs)} ms (1 ms windows), weakest rise x${Math.min(...res.map((r) => r.rise)).toFixed(1)}` + (bad.length ? ' BAD ' + JSON.stringify(bad.slice(0, 4)) : ''));
  check(Math.abs(A.balanceDb) < 0.2, `A. left and right equal over the intro: ${A.balanceDb.toFixed(3)} dB (dead centre)`);
  check(A.peak < 1, `A. no clipping: peak ${A.peak.toFixed(3)}`);
  check(m1.waiting && m1.steps === 0 && m1.busGain < 0.01, `A. the music silent under the intro (at 2.35 s: ${m1.steps} steps, bus ${m1.busGain.toFixed(4)})`);
  check(!m2.waiting && m2.steps > 0 && m2.busGain > 0.05, `A. and playing after it (0.9 s later: ${m2.steps} steps, bus ${m2.busGain.toFixed(3)})`);
  log(`  (planned ${s.planned}: ${JSON.stringify(s.sched.slice(0, 3))} ...)`);
  await ctx.close();
}

// ---- B: a stalled main thread --------------------------------------------
// The planned key clicks are 36 ms apart (40 characters over 720 ms, one
// click per two). Measured both ways: each planned click's onset in the
// recording (this page knows its plan), and, for the before/after, the
// intervals between click onsets found without a plan.
async function stalled(file) {
  const { ctx, page } = await open(file);
  // The music off on both pages (slice 1 kept it playing under the intro,
  // which would muddy the click count).
  await page.click('#btn-music');
  await warm(page);
  await page.evaluate(() => { window.__tap.on = true; });
  // The stall: 100 ms of busy main thread 760 ms after Play, mid-typing.
  await page.evaluate(() => { document.getElementById('btn-play').addEventListener('click', () => { setTimeout(() => { const t = performance.now(); while (performance.now() - t < 100) { /* busy */ } }, 760); }); });
  await page.click('#btn-play');
  await page.waitForTimeout(3600);
  const t0 = await page.evaluate(() => window.__tap.blocks[0].t);
  const all = await page.evaluate(ANALYSE, [t0, t0 + 4]);
  const start = all.full.findIndex((v) => v > 0.02);
  let mx = 0; for (let j = start + 540; j < start + 1320; j++) mx = Math.max(mx, all.band[j]);
  const cl = clicks(all.band, start + 540, start + 1320, mx * 0.2);
  const iv = cl.slice(1).map((v, k) => v - cl[k]);
  // An interval "on the grid": within 4 ms of 36 ms or a multiple of it.
  const onGrid = iv.filter((d) => { const k = Math.max(1, Math.round(d / 36)); return Math.abs(d - 36 * k) <= 4; }).length;
  const s = await stats(page);
  let res = null;
  if (s.sched) {
    const A = await page.evaluate(ANALYSE, [s.audioBase - 0.03, s.audioBase + 3.2]);
    const lag = tapDelay(A, 30 + s.sched[0].at);
    res = spread(s.sched.filter((x) => x.kind === 'type' && x.t < 1340).map((x) => ({ t: x.t, ...onset(A.band, 30 + x.at + lag) })));
  }
  await ctx.close();
  return { cl, iv, onGrid, s, res };
}
{
  log('\n[B] a 100 ms main-thread stall mid-typing');
  const nw = await stalled('cortex-vs-swarm-seed6.html');
  check(nw.s.late === 0 && nw.s.sched.length === nw.s.planned, `B. none dropped or late through the stall (${nw.s.sched.length}/${nw.s.planned})`);
  const devs = nw.res.map((r) => r.dev), bad = nw.res.filter((r) => r.dev == null || Math.abs(r.dev) > 3 || r.rise < 1.5);
  check(bad.length === 0, `B. all ${nw.res.length} typing clicks HEARD at their planned distances through the stall: spread ${Math.min(...devs)} to ${Math.max(...devs)} ms` + (bad.length ? ' BAD ' + JSON.stringify(bad.slice(0, 4)) : ''));
  log(`  (this page, onsets found without the plan: ${nw.cl.length}, intervals ${JSON.stringify(nw.iv)}; on the 36 ms grid: ${nw.onGrid}/${nw.iv.length})`);
  if (oldHtml) {
    const od = await stalled(resolve(oldHtml));
    log(`  (slice 1's page, same stall: ${od.cl.length} onsets, intervals ${JSON.stringify(od.iv)}; on the 36 ms grid: ${od.onGrid}/${od.iv.length})`);
    check(nw.onGrid / Math.max(1, nw.iv.length) > od.onGrid / Math.max(1, od.iv.length), `B. steadier than slice 1 under the same stall: ${nw.onGrid}/${nw.iv.length} intervals on the grid vs ${od.onGrid}/${od.iv.length}`);
  }
}

// ---- C, D: skip and pause --------------------------------------------------
for (const how of ['escape', 'pause']) {
  log(`\n[${how === 'escape' ? 'C' : 'D'}] aegis-vs-null-seed3.html: ${how} at about 1 s`);
  const { ctx, page } = await open('aegis-vs-null-seed3.html');
  await playAndTap(page);
  await waitIntroT(page, 1000);
  const tSkip = await introT(page);
  if (how === 'escape') await page.keyboard.press('Escape'); else await page.click('#btn-play');
  await page.waitForTimeout(60);
  const m = await mus(page), sn = await snd(page), s = await stats(page);
  check(sn.cuts === 1, `${how}: the intro's sounds cut once (cuts ${sn.cuts})`);
  // Only what was already queued (the 150 ms lookahead plus one 25 ms
  // scheduler tick) can lie past the skip, and the cut silences it.
  const after = s.sched.filter((x) => x.t > tSkip + 175);
  check(after.length === 0, `${how}: nothing of the intro queued past its lookahead (last queued at ${Math.round(Math.max(...s.sched.map((x) => x.t)))} ms, ${how} at ${tSkip} ms)`);
  await page.waitForTimeout(400);
  const m2 = await mus(page);
  check(!m.waiting && m2.steps > 0, `${how}: the music starts at once (waiting ${m.waiting}; ${m2.steps} steps 0.46 s later)`);
  await ctx.close();
}

{
  log('\n[D2] pause at about 1 s with the music off: silence follows (the cut, heard)');
  const { ctx, page } = await open('aegis-vs-null-seed3.html');
  await page.click('#btn-music');
  await playAndTap(page);
  await waitIntroT(page, 1000);
  const tp = await page.evaluate(() => { document.getElementById('btn-play').click(); return window.__sfx.core().ctx.currentTime; });
  await page.waitForTimeout(700);
  const A = await page.evaluate(ANALYSE, [tp - 0.3, tp + 0.6]);
  const rms = (a, i, j) => Math.sqrt(a.slice(i, j).reduce((x, v) => x + v * v, 0) / (j - i));
  const before = rms(A.full, 0, 300), after = rms(A.full, 340, 900);
  check(after < before * 0.01, `D2. the intro's sound gone 40 ms after the pause: level ${after.toExponential(2)} after vs ${before.toExponential(2)} before (${(20 * Math.log10(after / before + 1e-12)).toFixed(0)} dB)`);
  await ctx.close();
}

// ---- E, F: muted ---------------------------------------------------------
{
  log('\n[E] effects muted, music on');
  const { ctx, page } = await open('null-vs-swarm-seed2.html');
  await page.click('#btn-sound');
  await playAndTap(page);
  await waitIntroT(page, 1500);
  const s = await stats(page), m = await mus(page);
  check(s.sched.length === 0 && (await snd(page)).on === false, `E. no intro sound with effects muted (${s.sched.length} queued)`);
  check(m.waiting && m.steps === 0, `E. the music still waits under the intro (${m.steps} steps)`);
  await waitEnd(page); await page.waitForTimeout(600);
  check((await mus(page)).steps > 0, 'E. and starts after it');
  await ctx.close();
}
{
  log('\n[F] music muted, switched on mid-intro');
  const { ctx, page } = await open('null-vs-swarm-seed2.html');
  await page.click('#btn-music');
  await playAndTap(page);
  await waitIntroT(page, 900);
  await page.click('#btn-music');
  const t = await introT(page);
  await waitIntroT(page, 2400);
  const m = await mus(page), s = await stats(page);
  check(m.on && m.steps === 0 && m.waiting, `F. switched on at ${t} ms, it waits: ${m.steps} steps at ${s.t} ms`);
  check(s.active, 'F. and the intro was not skipped by the press (the music button is an audio control)');
  await waitEnd(page); await page.waitForTimeout(600);
  check((await mus(page)).steps > 0, 'F. it starts after the intro');
  await ctx.close();
}

// ---- G, H, I: the phone ----------------------------------------------------
async function layout(page) {
  return page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    skip: (() => { const k = document.querySelector('.boot-skip'); if (!k) return null; const r = k.getBoundingClientRect(); return { w: r.width, h: r.height }; })(),
    top: document.getElementById('side-p2').getBoundingClientRect().toJSON(), bot: document.getElementById('side-p1').getBoundingClientRect().toJSON(),
  }));
}
{
  log('\n[G] a phone, portrait (390 x 844): cortex-vs-swarm-seed6.html');
  const { ctx, page } = await open('cortex-vs-swarm-seed6.html', { phone: true });
  await page.evaluate(() => { window.__tap.on = true; });
  await page.tap('#btn-play');
  await page.waitForFunction(() => window.__boot.stats().active, null, { timeout: 5000 });
  const s = await stats(page), L = await layout(page);
  log(`  (halves: top ${Math.round(L.top.width)} x ${Math.round(L.top.height)}, bottom ${Math.round(L.bot.width)} x ${Math.round(L.bot.height)})`);
  check(s.rows === true && s.fs >= 18, `G. the agent lines on two rows at ${s.fs.toFixed(1)} px (one row would be ${((L.top.width - 8 - 24) / (0.62 * 40)).toFixed(1)} px)`);
  check(s.problem === null && !s.still, 'G. laid out with no grammar problem (lines inside their screens, mirror images)');
  check(L.skip && L.skip.h >= 44 && L.skip.w >= 88, `G. Skip is finger-sized: ${L.skip && Math.round(L.skip.w)} x ${L.skip && Math.round(L.skip.h)} px`);
  check(L.sw <= L.cw, `G. no sideways scroll (${L.sw} <= ${L.cw})`);
  await waitIntroT(page, 1420);
  await page.screenshot({ path: resolve(outDir, `${TAG}-phone-rows.jpg`), quality: 80 });
  await waitIntroT(page, 1900);
  await page.screenshot({ path: resolve(outDir, `${TAG}-phone-saying.jpg`), quality: 80 });
  // (Render session 80.) Since render 53 the saying's hit is at 2.4 s (it
  // was 1.6 s): wait past it before counting what was queued.
  await waitIntroT(page, 2700);
  const s2 = await stats(page);
  check(s2.sched.length === s2.planned && s2.late === 0, `G. the sounds on the phone too: ${s2.sched.length}/${s2.planned} queued, none late`);
  await ctx.close();
}
{
  log('\n[H] a phone, landscape (844 x 390): aegis-vs-cortex-seed1.html');
  const { ctx, page } = await open('aegis-vs-cortex-seed1.html', { phone: true, land: true });
  await page.tap('#btn-play');
  await page.waitForFunction(() => window.__boot.stats().active, null, { timeout: 5000 });
  const s = await stats(page), L = await layout(page);
  log(`  (halves: top ${Math.round(L.top.width)} x ${Math.round(L.top.height)}, bottom ${Math.round(L.bot.width)} x ${Math.round(L.bot.height)}; rows ${s.rows}, ${s.fs.toFixed(1)} px, still ${s.still})`);
  check(s.problem === null, 'H. laid out with no grammar problem');
  check(L.sw <= L.cw, `H. no sideways scroll (${L.sw} <= ${L.cw})`);
  await waitIntroT(page, 1420);
  await page.screenshot({ path: resolve(outDir, `${TAG}-phone-landscape.jpg`), quality: 80 });
  await ctx.close();
}
{
  log('\n[I] desktop: one row');
  const { ctx, page } = await open('swarm-vs-null-seed8.html');
  await page.click('#btn-play');
  await page.waitForFunction(() => window.__boot.stats().active, null, { timeout: 5000 });
  const s = await stats(page);
  check(s.rows === false && s.fs <= 15, `I. the desktop lines stay on one row at ${s.fs.toFixed(1)} px`);
  await waitIntroT(page, 1420);
  await page.screenshot({ path: resolve(outDir, `${TAG}-desktop-lines.jpg`), quality: 80 });
  await ctx.close();
}

// ---- J: reduced motion -----------------------------------------------------
{
  log('\n[J] reduced motion');
  const { ctx, page } = await open('cortex-vs-null-seed5.html', { reduced: true });
  await playAndTap(page);
  await page.waitForTimeout(500);
  const s = await stats(page), m = await mus(page);
  // (Render session 80.) Since render 53 the still sounds the coin's clink
  // with the power-on at 0, and the saying's hit when the saying shows
  // (BOOT_STILL_SAY_AT, 600 ms), not at 0.
  const atOf = (k) => s.sched.filter((x) => x.kind === k).map((x) => x.t).join();
  check(s.still && s.sched.map((x) => x.kind).sort().join() === 'bootHit,bootOn,coinClink' && atOf('bootOn') === '0' && atOf('coinClink') === '0' && atOf('bootHit') === '600', `J. the still: ${s.sched.map((x) => x.kind + '@' + x.t).join(', ')}`);
  check(m.waiting && m.steps === 0, 'J. the music waits under the still');
  await waitEnd(page); await page.waitForTimeout(600);
  check((await mus(page)).steps > 0, 'J. and starts after it');
  await ctx.close();
}

// ---- K: the sheet ----------------------------------------------------------
{
  log('\n[K] match-boot-sheet.html: the rare saying, and the phone-rows scene');
  const { ctx, page } = await open('match-boot-sheet.html');
  await warm(page);
  await page.evaluate(() => { window.__tap.on = true; });
  await page.locator('#say-9').scrollIntoViewIfNeeded();
  await page.click('button.go[data-scene="say-9"]');
  await page.waitForFunction(() => window.__boot.stats().active, null, { timeout: 5000 });
  // (Render session 80.) The hit moved from 1.6 s to 2.4 s in render 53:
  // the times are read from the queue, the flourish expected 60 ms after it.
  await waitIntroT(page, 2900);
  const s = await stats(page);
  const root = s.sched.find((x) => x.kind === 'bootRoot'), hit = s.sched.find((x) => x.kind === 'bootHit');
  check(s.saying === '> SUDO FIGHT' && root && hit && root.t === hit.t + 60, `K. > SUDO FIGHT queues root access granted at ${root && root.t} ms, over the hit at ${hit && hit.t}`);
  // Heard: the flourish's square blips add energy around 2.2 kHz over the
  // hit's chord; the same window of a plain saying (FIGHT, played next) is
  // the comparison. The chord shares the blips' pitches, so their onsets
  // aren't timed one by one.
  const W0 = hit ? hit.t + 60 : 2460, W1 = W0 + 440;
  const bandE = async (st) => { const A = await page.evaluate(ANALYSE, [st.audioBase - 0.03, st.audioBase + W1 / 1000 + 0.3]); const lag = tapDelay(A, 30 + st.sched[0].at); let e = 0; for (let j = 30 + W0 + lag; j < 30 + W1 + lag; j++) e += A.band[j] * A.band[j]; return e; };
  const eRare = await bandE(s);
  await page.screenshot({ path: resolve(outDir, `${TAG}-sheet-rare.jpg`), quality: 80, clip: await page.locator('#say-9').boundingBox() });
  await waitEnd(page);
  await page.waitForTimeout(800);
  await page.locator('#say-1').scrollIntoViewIfNeeded();
  await page.click('button.go[data-scene="say-1"]');
  await page.waitForFunction(() => window.__boot.stats().active, null, { timeout: 5000 });
  await waitIntroT(page, W1 + 100);
  const s1 = await stats(page);
  const ePlain = await bandE(s1);
  check(!s1.sched.some((x) => x.kind === 'bootRoot') && eRare > ePlain * 3, `K. the flourish heard: ${(10 * Math.log10(eRare / ePlain)).toFixed(1)} dB more around 2.2 kHz from ${(W0 / 1000).toFixed(2)} to ${(W1 / 1000).toFixed(2)} s than ${s1.last ? '' : ''}"${s1.saying}", which has none`);
  await waitEnd(page);
  await page.locator('#phone-rows').scrollIntoViewIfNeeded();
  await page.click('button.go[data-scene="phone-rows"]');
  await page.waitForFunction(() => window.__boot.stats().active, null, { timeout: 5000 });
  const s2 = await stats(page);
  check(s2.rows === true && s2.problem === null, `K. the phone-rows scene breaks its lines (${s2.fs.toFixed(1)} px), no grammar problem`);
  await waitIntroT(page, 1420);
  await page.screenshot({ path: resolve(outDir, `${TAG}-sheet-phone-rows.jpg`), quality: 80, clip: await page.locator('#phone-rows').boundingBox() });
  await ctx.close();
}

log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
await b.close();
server.close();
process.exit(fails ? 1 : 0);
