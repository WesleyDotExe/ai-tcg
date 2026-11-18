// Render session 39: the victory boasts' sounds on the audio clock, driven in
// a real (headless) Chromium. Not a repo dependency: run with node and the
// preinstalled playwright-core:
//   node boast-check-s39.mjs <outDir> <render/output> [old output dir]
// [old output dir] holds the same pages from before this session (sounds
// fired from the frames), for the before/after. The page's own audio is
// recorded as in boot-check-s38.mjs (an AudioWorklet on the limiter, each
// block stamped with its frame on the audio clock).
//
// What "on time" means here: each sound's start on the audio clock, from the
// boast's start, against its planned time. For this page that is the
// sequence's queue (`stats().sched`); for the old page, the audio clock when
// each SND.play was called (a frame-fired sound starts at once). Both are
// measured from the audio clock as BOAST.play was called. Runs:
//   A  the boast sheet, every boast (desktop, full row): all planned sounds
//      queued ahead at their exact times, none late; each HEARD at its
//      planned time where its onset stands out (a rise of at least x1.5 in
//      1 ms windows), against the same kind of sound played alone at a known
//      time (its own attack and the recording path's delay); no clipping.
//   B  the four recorded replays, stepped into the lethal move: the boast
//      plays at the headless browser's real frame rate on a real board.
//      Every sound at its planned time; the old pages the
//      same way, for the before/after.
//   C  the sheet, Boot Sequence, a 150 ms main-thread stall mid-typing:
//      every key click on time; the old sheet under the same stall.
//   D  Escape at about 1 s (Dial-Up Fireworks): the sounds cut once, nothing
//      queued past the lookahead, and silence heard after the cut.
//   E  the boast's own end: no cut; the sting's tail is heard ringing on.
//   F  effects muted: the boast plays and ends; nothing queued, none late.
//   G  reduced motion: the still's one sound, the sting, at 0.
//   H  music on: the music's hold under the sting is queued with the sting
//      (the same audio time), and the music is down at the hold's level
//      while the sting rings; with effects muted no hold (nothing to duck
//      under).
//   I  the loadout picker: the loop's repeats stay silent (no sequence); a
//      pass the viewer asks for (a tap on a tile) queues its sounds on the
//      audio clock at their planned times.
import { chromium, launchOpts } from '../../../render/ci/pw.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
const [outDir, outputArg, oldArg] = process.argv.slice(2);
const OUT = resolve(outputArg || 'render/output');
const OLD = oldArg ? resolve(oldArg) : null;
mkdirSync(outDir, { recursive: true });
const server = createServer((req, res) => {
  try { const body = readFileSync(decodeURIComponent(new URL(req.url, 'http://x').pathname)); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const HOST = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch(launchOpts({ args: ['--disable-gpu', '--autoplay-policy=no-user-gesture-required'] }));
let fails = 0;
const log = (...a) => console.log(...a);
function check(ok, what) { log((ok ? '  PASS ' : '  FAIL ') + what); if (!ok) fails++; }

// ---- the recorder, from boot-check-s38.mjs ----
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

function onset(env, p) {
  const lo = Math.max(0, p - 12), hi = Math.min(env.length, p + 25);
  let mx = 0; for (let j = lo; j < hi; j++) mx = Math.max(mx, env[j]);
  let at = null; for (let j = lo; j < hi; j++) if (env[j] >= mx / 4) { at = j; break; }
  const avg = (a, b2) => { let s = 0, c = 0; for (let j = Math.max(0, a); j < Math.min(env.length, b2); j++) { s += env[j]; c++; } return c ? s / c : 0; };
  const e = at == null ? p : at;
  return { err: at == null ? null : at - p, rise: avg(e - 3, e + 7) / (avg(e - 15, e - 5) + 1e-9) };
}

// Every boast play is noted with the audio clock at that moment (the base
// both pages are measured from), and every frame-fired SND.play (the old
// page's way) with the audio clock as it was called.
const WATCH = () => {
  const B = window.__boast, play = B.play, S = window.__sfx, sp = S.play;
  window.__w = { plays: [], calls: [] };
  B.play = function (id, els, opts) {
    const C = S.core && S.core() ? S.core().ctx : null;
    const rec = { id, perf: performance.now(), audio: C ? C.currentTime : null };
    const plan = play.call(B, id, els, opts);
    rec.sounds = plan ? plan.marks.filter((m) => m.k === 'sound').map((m) => ({ kind: m.kind, t: m.t, tier: m.tier })) : [];
    rec.still = plan ? !!plan.still : null;
    window.__w.plays.push(rec);
    return plan;
  };
  S.play = function (kind) {
    const C = S.core && S.core() ? S.core().ctx : null;
    window.__w.calls.push({ kind, audio: C ? C.currentTime : null, perf: performance.now() });
    return sp.apply(S, arguments);
  };
};
async function open(file, o = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(TAP);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { log('  PAGE ERROR ' + e.message); fails++; });
  await page.goto(HOST + file);
  await page.waitForTimeout(500);
  await page.evaluate(WATCH);
  if (!o.muted) {
    await page.evaluate(() => window.__sfx.unlock());
    await page.waitForFunction(() => window.__tap.ready, null, { timeout: 5000 });
  }
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__tap.on = true; });
  return { ctx, page };
}
const bst = (page) => page.evaluate(() => window.__boast.stats());
const snd = (page) => page.evaluate(() => window.__sfx.stats());
const waitEnd = (page, ms = 20000) => page.waitForFunction(() => !window.__boast.stats().active, null, { timeout: ms });
// Each planned sound's start (ms from the boast's start on the audio clock)
// and its error. New page: the queue. Old page: the frame-fired calls after
// the boast started, matched to the plan in order by kind.
async function timing(page) {
  const w = await page.evaluate(() => window.__w), s = await bst(page);
  const p = w.plays[w.plays.length - 1];
  if (s.sched && s.planned != null) {
    return { mode: 'queued', base: s.audioBase, baseGap: Math.round((s.audioBase - p.audio) * 1000), planned: s.planned, late: s.late,
      // (The queue reports whole ms; a planned time may be fractional.)
      res: s.sched.map((x) => ({ kind: x.kind, t: x.t, at: x.at, err: Math.abs(x.at - x.t) <= 0.5 ? 0 : x.at - x.t, lead: x.lead })) };
  }
  const calls = w.calls.filter((c) => c.perf >= p.perf);
  const res = []; let k = 0;
  for (const m of p.sounds) {
    while (k < calls.length && calls[k].kind !== m.kind) k++;
    if (k >= calls.length) { res.push({ kind: m.kind, t: m.t, at: null, err: null }); continue; }
    const at = Math.round((calls[k].audio - p.audio) * 1000); k++;
    res.push({ kind: m.kind, t: m.t, at, err: at - m.t });
  }
  return { mode: 'frames', base: p.audio, planned: p.sounds.length, late: 0, res };
}
const summ = (r) => { const e = r.res.filter((x) => x.err != null).map((x) => Math.abs(x.err)).sort((a, b) => a - b); return { n: e.length, max: e.length ? e[e.length - 1] : null, med: e.length ? e[Math.floor(e.length / 2)] : null, over20: e.filter((x) => x > 20).length }; };

async function sheetScene(page, key) {
  await page.evaluate((key) => { document.getElementById(key).scrollIntoView({ block: 'center' }); }, key);
  await page.waitForTimeout(250);
  await page.evaluate((key) => window.playBoastScene(key), key);
}
// Each kind's own onset delay: played alone, scheduled at a known audio
// time, 2.5 s apart (the sting rings for about 2 s), at the boast's tier
// for it, measured the same way as in a boast. Three times each: some
// recipes draw random parts (the tube's crackle), so a kind's own onset
// moves a few ms between plays; a boast's sound is judged against the
// range its kind shows alone. A reading that doesn't rise out of silence
// (x20 over the 10 ms before it) is left out. kinds: [[kind, tier], ...] -> { kind: [lo, hi] }.
async function calib(page, kinds, faction) {
  const runs = [0, 1, 2].flatMap((r) => kinds.map((k) => k));
  const t0 = await page.evaluate(([runs, faction]) => {
    const C = window.__sfx.core().ctx, t0 = C.currentTime + 0.2;
    runs.forEach(([k, tier], i) => window.__sfx.play(k, faction, tier, null, { at: t0 + i * 2.5, pan: 0 }));
    return t0;
  }, [runs, faction]);
  await page.waitForTimeout(runs.length * 2500 + 600);
  const A = await page.evaluate(ANALYSE, [t0 - 0.03, t0 + runs.length * 2.5 + 0.2]);
  const o = {};
  runs.forEach(([k], i) => { const on = onset(k === 'type' ? A.band : A.full, 30 + i * 2500), e = on.err; if (e == null || on.rise < 20) return; o[k] = o[k] ? [Math.min(o[k][0], e), Math.max(o[k][1], e)] : [e, e]; });
  return o;
}
const IDS = ['boast-aegis-shield-slam', 'boast-swarm-hive-burst', 'boast-null-void-collapse', 'boast-cortex-data-cascade', 'boast-s0-boot-sequence', 'boast-s0-dial-up-fireworks'];
const out = { A: {}, B: {}, C: {} };

// ---- A: every boast on the sheet, timed and heard -------------------------
{
  log('\n[A] boast-sheet.html: every boast, sound on');
  for (const id of IDS) {
    const { ctx, page } = await open(resolve(OUT, 'boast-sheet.html'));
    await page.click('#mus').catch(() => {});
    await sheetScene(page, id + '-full');
    await waitEnd(page);
    await page.waitForTimeout(700);
    const T = await timing(page), s = await bst(page), sn = await snd(page);
    const sm = summ(T);
    check(T.mode === 'queued' && T.res.length === T.planned && T.late === 0, `A. ${id}: all ${T.planned} sounds queued on the audio clock, none late (${T.res.length} queued)`);
    check(sm.max === 0 && T.res.slice(1).every((x) => x.lead >= 0), `A. ${id}: each queued at its exact planned time, ahead of it (max error ${sm.max} ms; lead ${Math.min(...T.res.slice(1).map((x) => x.lead))}-${Math.max(...T.res.map((x) => x.lead))} ms)`);
    check(Math.abs(T.baseGap) <= 25, `A. ${id}: the audio clock tied to the boast's start (${T.baseGap} ms from the audio clock at play)`);
    check(sn.cuts === 0 && s.last.reason === 'end', `A. ${id}: ended on its own, nothing cut (cuts ${sn.cuts})`);
    // Heard: each onset in the recording at its planned time, less the same
    // kind's own onset delay played alone.
    const A = await page.evaluate(ANALYSE, [T.base - 0.03, T.base + 4]);
    const plan = await page.evaluate(() => window.__w.plays[window.__w.plays.length - 1]);
    const faction = await page.evaluate((k) => document.getElementById(k).dataset.faction, id + '-full');
    const tierOf = {}; plan.sounds.forEach((m) => { if (!tierOf[m.kind]) tierOf[m.kind] = m.tier; });
    const cal = await calib(page, Object.entries(tierOf), faction);
    // The error: how far outside its kind's own range the onset lands (0
    // inside it).
    const hd = T.res.map((x) => { const on = onset(x.kind === 'type' ? A.band : A.full, 30 + x.at), c = cal[x.kind]; return { kind: x.kind, t: x.t, rise: on.rise, err: on.err == null || !c ? null : on.err < c[0] ? on.err - c[0] : on.err > c[1] ? on.err - c[1] : 0 }; });
    const clear = hd.filter((x) => x.err != null && x.rise >= 1.5), devs = clear.map((x) => x.err).sort((a, b) => a - b);
    // (The rocket's whistle swells in over 50 ms, over the modem's tail; it
    // is reported on its own, held to the same 3 ms.)
    const SOFT = { whistle: 1 };
    const bad = clear.filter((x) => Math.abs(x.err) > 3);
    const soft = clear.filter((x) => SOFT[x.kind]);
    check(clear.length >= Math.min(2, hd.length) && bad.length === 0, `A. ${id}: HEARD at the planned times: ${clear.length} of ${hd.length} onsets stand out (the rest start under a louder sound), ${devs.length ? devs[0] : 0} to ${devs.length ? devs[devs.length - 1] : 0} ms outside their kind's own range (onset delays alone, lowest-highest of 3: ${JSON.stringify(cal)})` + (soft.length ? `; the soft whistles ${JSON.stringify(soft.map((x) => x.err))} ms, the sharp sounds ${JSON.stringify(clear.filter((x) => !SOFT[x.kind]).map((x) => x.err))} ms` : '') + (bad.length ? ' BAD ' + JSON.stringify(bad.slice(0, 4)) : ''));
    check(A.peak < 1, `A. ${id}: no clipping (peak ${A.peak.toFixed(3)})`);
    out.A[id] = { planned: T.planned, heard: clear.length, of: hd.length, sched: T.res };
    await ctx.close();
  }
}

// ---- B: the recorded replays at the headless frame rate -------------------
async function stepIntoEnd(page) {
  await page.evaluate(() => { const s = document.getElementById('scrubber'); s.value = String(Number(s.max) - 1); s.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })));
  await page.waitForFunction(() => window.__w.plays.length > 0, null, { timeout: 8000 });
  await page.waitForTimeout(100);
  const fps0 = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n / ((performance.now() - t0) / 1000)); })(); }));
  await waitEnd(page);
  await page.waitForTimeout(600);
  return fps0;
}
const RECORDED = ['recorded-boot-sequence.html', 'recorded-close-win.html', 'recorded-other-starter.html', 'recorded-empty-slot.html'];
{
  log('\n[B] the four recorded replays, stepped into the lethal move (the boast at the real frame rate)');
  for (const f of RECORDED) {
    const { ctx, page } = await open(resolve(OUT, f));
    await page.click('#btn-music').catch(() => {});
    const fps = await stepIntoEnd(page);
    const T = await timing(page), sm = summ(T), id = (await bst(page)).last ? (await page.evaluate(() => window.__w.plays[0].id)) : '?';
    check(T.mode === 'queued' && T.res.length === T.planned && T.late === 0 && sm.max === 0, `B. ${f} (${id}, ${fps.toFixed(1)} fps during the boast): all ${T.planned} sounds at their planned times (max error ${sm.max} ms, ${T.late} late)`);
    out.B[f] = { id, fps: +fps.toFixed(1), now: sm };
    await ctx.close();
    if (OLD) {
      const o = await open(resolve(OLD, f));
      await o.page.click('#btn-music').catch(() => {});
      const fpsO = await stepIntoEnd(o.page);
      const TO = await timing(o.page), so = summ(TO);
      log(`  (before this session, the same page firing from the frames at ${fpsO.toFixed(1)} fps: ${so.n} of ${TO.planned} sounds played, median error ${so.med} ms, max ${so.max} ms, ${so.over20} more than 20 ms off)`);
      check(so.max == null || so.max > sm.max, `B. ${f}: on time where the old page was not (old max ${so.max} ms, now ${sm.max} ms)`);
      out.B[f].old = { fps: +fpsO.toFixed(1), ...so, errs: TO.res.map((x) => x.err) };
      await o.ctx.close();
    }
  }
}

// ---- C: a stalled main thread during Boot Sequence's typing --------------
async function stalled(dir) {
  const { ctx, page } = await open(resolve(dir, 'boast-sheet.html'));
  await page.click('#mus').catch(() => {});
  await sheetScene(page, 'boast-s0-boot-sequence-full');
  // The first BIOS line's clicks are at about 0.45 s; stall at 0.5 s.
  await page.evaluate(() => { setTimeout(() => { const t = performance.now(); while (performance.now() - t < 150) { /* busy */ } }, 500); });
  await waitEnd(page);
  await page.waitForTimeout(600);
  const T = await timing(page);
  await ctx.close();
  return T;
}
{
  log('\n[C] boast-sheet.html, Boot Sequence: a 150 ms main-thread stall during the typing');
  const T = await stalled(OUT), sm = summ(T);
  check(T.late === 0 && T.res.length === T.planned && sm.max === 0, `C. all ${T.planned} sounds (${T.res.filter((x) => x.kind === 'type').length} key clicks) at their planned times through the stall (max error ${sm.max} ms)`);
  out.C.now = sm;
  if (OLD) {
    const TO = await stalled(OLD), so = summ(TO);
    const late = TO.res.filter((x) => x.err != null && x.err > 20).map((x) => `${x.kind}@${x.t}+${x.err}`);
    log(`  (before: median error ${so.med} ms, max ${so.max} ms; ${so.over20} sounds more than 20 ms late: ${late.slice(0, 8).join(', ')}${late.length > 8 ? ' ...' : ''})`);
    check(so.max > 50 && sm.max === 0, `C. the old sheet bunched the clicks behind the stall (max ${so.max} ms late); this one did not`);
    out.C.old = { ...so, errs: TO.res.map((x) => x.err) };
  }
}

// ---- D: Escape cuts --------------------------------------------------------
{
  log('\n[D] boast-sheet.html, Dial-Up Fireworks: Escape at about 1 s');
  const { ctx, page } = await open(resolve(OUT, 'boast-sheet.html'));
  await page.click('#mus').catch(() => {});
  await sheetScene(page, 'boast-s0-dial-up-fireworks-full');
  await page.waitForFunction(() => window.__boast.stats().t >= 1000, null, { timeout: 8000 });
  const tk = await page.evaluate(() => { const t = window.__boast.stats().t; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return { t, audio: window.__sfx.core().ctx.currentTime }; });
  await page.waitForTimeout(700);
  const s = await bst(page), sn = await snd(page), T = await timing(page);
  check(s.last.reason === 'skip' && sn.cuts === 1, `D. skipped (${s.last.reason}) and the sounds cut once (cuts ${sn.cuts})`);
  const past = T.res.filter((x) => x.t > tk.t + 175);
  check(past.length === 0 && T.res.length < T.planned, `D. nothing queued past the lookahead: ${T.res.length} of ${T.planned} queued, the last at ${Math.max(...T.res.map((x) => x.t))} ms, Escape at ${tk.t} ms`);
  const A = await page.evaluate(ANALYSE, [tk.audio - 0.4, tk.audio + 0.5]);
  const rms = (i, j) => Math.sqrt(A.full.slice(i, j).reduce((x, v) => x + v * v, 0) / (j - i));
  const before = rms(0, 380), after = rms(470, 900);
  check(after < before * 0.05, `D. silence heard after the cut: ${after.toExponential(2)} from 70 ms after Escape vs ${before.toExponential(2)} in the 0.4 s before`);
  await ctx.close();
}

// ---- E: the boast's own end rings out --------------------------------------
{
  log('\n[E] boast-sheet.html, Shield Slam: its own end');
  const { ctx, page } = await open(resolve(OUT, 'boast-sheet.html'));
  await page.click('#mus').catch(() => {});
  await sheetScene(page, 'boast-aegis-shield-slam-full');
  await waitEnd(page);
  const endAudio = await page.evaluate(() => window.__sfx.core().ctx.currentTime);
  await page.waitForTimeout(800);
  const sn = await snd(page), T = await timing(page);
  check(sn.cuts === 0, `E. no cut at the end (cuts ${sn.cuts})`);
  const sting = T.res[T.res.length - 1];
  const A = await page.evaluate(ANALYSE, [T.base + sting.at / 1000, T.base + sting.at / 1000 + 1.2]);
  const endIdx = Math.round((endAudio - T.base) * 1000 - sting.at);
  const rms = (i, j) => Math.sqrt(A.full.slice(Math.max(0, i), j).reduce((x, v) => x + v * v, 0) / (j - Math.max(0, i)));
  check(sting.kind === 'boast' && rms(endIdx, endIdx + 120) > 1e-3, `E. the sting (at ${sting.t} ms) still heard ringing as the boast ends (${endIdx} ms after it: level ${rms(endIdx, endIdx + 120).toExponential(2)})`);
  await ctx.close();
}

// ---- F: effects muted ------------------------------------------------------
{
  log('\n[F] boast-sheet.html, Hive Burst: effects muted');
  const { ctx, page } = await open(resolve(OUT, 'boast-sheet.html'), { muted: true });
  await sheetScene(page, 'boast-swarm-hive-burst-full');
  await waitEnd(page);
  const s = await bst(page), sn = await snd(page);
  check(s.last.reason === 'end' && s.sched.length === 0 && s.late === 0 && sn.played === 0, `F. the boast plays and ends (${s.last.reason}); nothing queued (${s.sched.length}), none late, nothing played`);
  await ctx.close();
}

// ---- G: reduced motion -----------------------------------------------------
{
  log('\n[G] boast-sheet.html, Void Collapse: reduced motion');
  const { ctx, page } = await open(resolve(OUT, 'boast-sheet.html'), { reduced: true });
  await page.click('#mus').catch(() => {});
  await sheetScene(page, 'boast-null-void-collapse-full');
  await waitEnd(page);
  const s = await bst(page);
  check(s.last.still && s.sched.length === 1 && s.sched[0].kind === 'boast' && s.sched[0].t === 0, `G. the still's one sound, the sting at 0 (${JSON.stringify(s.sched.map((x) => [x.kind, x.t]))})`);
  await ctx.close();
}

// ---- H: the music's hold under the sting -----------------------------------
const HOLDS = () => { const M = window.__music, dh = M.duckHold; window.__holds = []; M.duckHold = function (sec, at) { const C = window.__sfx.core() ? window.__sfx.core().ctx : null; window.__holds.push({ sec, at: at == null ? null : at, now: C ? C.currentTime : null }); return dh.apply(M, arguments); }; };
for (const id of ['boast-aegis-shield-slam', 'boast-s0-dial-up-fireworks']) {
  log(`\n[H] boast-sheet.html, ${id}: music on`);
  const { ctx, page } = await open(resolve(OUT, 'boast-sheet.html'));
  await page.evaluate(() => { if (!window.__music.isOn()) window.__music.setOn(true); });
  await page.evaluate(HOLDS);
  await page.waitForTimeout(300);
  await sheetScene(page, id + '-full');
  const T0 = await timing(page);
  const plan = await page.evaluate(() => window.__w.plays[window.__w.plays.length - 1]);
  const sting = plan.sounds[plan.sounds.length - 1];
  await page.waitForFunction((t) => window.__boast.stats().t >= t, sting.t + 300, { timeout: 10000 });
  const g = await page.evaluate(() => window.__music.stats().duckGain);
  await waitEnd(page);
  const T = await timing(page), holds = await page.evaluate(() => window.__holds);
  const stingAt = T.base + T.res[T.res.length - 1].at / 1000;
  check(holds.length >= 1 && holds.every((h) => h.at != null && h.at > h.now), `H. ${id}: ${holds.length} music hold(s), each queued ahead (lead ${holds.map((h) => Math.round((h.at - h.now) * 1000)).join(', ')} ms)`);
  const last = holds[holds.length - 1];
  check(sting.kind === 'boast' && Math.abs(last.at - stingAt) < 0.0015, `H. ${id}: the hold under the sting starts with it (${((last.at - stingAt) * 1000).toFixed(1)} ms apart on the audio clock)`);
  check(g != null && g < 0.6, `H. ${id}: the music down at the hold's level 0.3 s into the sting (duck gain ${g == null ? null : g.toFixed(3)})`);
  await ctx.close();
}
{
  log('\n[H2] boast-sheet.html, Shield Slam: music on, effects muted');
  const { ctx, page } = await open(resolve(OUT, 'boast-sheet.html'), { muted: true });
  await page.evaluate(() => { window.__music.setOn(true); });
  await page.evaluate(HOLDS);
  await sheetScene(page, 'boast-aegis-shield-slam-full');
  await waitEnd(page);
  const holds = await page.evaluate(() => window.__holds), m = await page.evaluate(() => window.__music.stats());
  check(holds.length === 0 && m.ducks === 0, `H2. no sting heard, so no hold: ${holds.length} holds, ${m.ducks} ducks (the music plays on: ${m.on})`);
  await ctx.close();
}

// ---- I: the loadout picker ---------------------------------------------------
{
  log('\n[I] loadout-picker.html: the loop silent, a tapped pass on the audio clock');
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { log('  PAGE ERROR ' + e.message); fails++; });
  await page.goto(HOST + resolve(OUT, 'loadout-picker.html'));
  await page.waitForFunction(() => window.__loadout && window.__loadout.stats().previews > 0);
  await page.click('.agent-head h1');
  const sn = () => page.evaluate(() => window.__loadout.snd.stats());
  check((await sn()).state === 'on', 'I. sound on after the first press');
  const before = await sn();
  await page.waitForTimeout(5200);
  const loops = await page.evaluate(() => window.__loadout.stats().loops), after = await sn();
  check(loops >= 2 && after.played === before.played && after.scheduled === before.scheduled, `I. the loop's ${loops} repeats queue and play nothing (played ${before.played} -> ${after.played}, queued ${before.scheduled} -> ${after.scheduled})`);
  await page.click('.tile[data-tile="boast-aegis-shield-slam"] .t-name');
  await page.waitForTimeout(150);
  const bs = await page.evaluate(() => window.__loadout.boast.stats());
  await page.waitForTimeout(2600);
  const bs2 = await page.evaluate(() => window.__loadout.boast.stats()), s2 = await sn();
  const errs = bs2.sched.map((x) => Math.abs(x.at - x.t) <= 0.5 ? 0 : x.at - x.t);
  check(bs.id === 'boast-aegis-shield-slam' && s2.scheduled > after.scheduled, `I. a tapped pass sounds: ${s2.scheduled - after.scheduled} sounds queued on the audio clock (played ${after.played} -> ${s2.played})`);
  check(bs2.sched.length === bs2.planned && bs2.late === 0 && errs.every((e) => e === 0), `I. all ${bs2.planned} of the pass's sounds at their planned times (${bs2.sched.length} queued, ${bs2.late} late)`);
  await ctx.close();
}

writeFileSync(resolve(outDir, 'boast-check-s39.json'), JSON.stringify(out, null, 1));
log(fails ? `\n${fails} FAILED` : '\nALL PASS');
await b.close();
server.close();
process.exit(fails ? 1 : 0);
