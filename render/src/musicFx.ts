// EFFECTS.md v2, slice 4 — adaptive procedural music (owner-directed
// 2026-10-03; working reference: the lab's "adaptive procedural music"
// block, MU / playStep / sched, in render/reference/effects-lab.html).
//
// What it is:
//   - A minor, 104 BPM, i–VI–III–VII (Am–F–C–G), one chord a bar, sixteenth
//     steps scheduled a little ahead on the audio clock (so a busy page or a
//     slow frame never makes it stutter). Synthesised live like the effects:
//     no audio files, no samples, no network.
//   - An intensity value I drives the arrangement. Calm (I about 1) is a pad
//     and a pulsing bass; as I rises the kick comes in, then the arpeggio,
//     then a driving bass, hats, off-beat hats, and at the top a snare and
//     four on the floor. Hits, kills and Mythic arrivals push I up
//     (musBump); it relaxes back to its resting level over a few seconds
//     (musRest). A Mythic on the acting side raises the resting level and
//     adds a bell motif every other bar.
//   - The arpeggio plays in the ACTING side's faction voice (Cortex square
//     blips, Aegis low filtered saws, Swarm detuned triangles with dropped
//     notes, Null broken octaves, Neutral bells), the same voices as the
//     effects. The page tells it who is acting and whether that side has a
//     Mythic in play (MUS.setScene).
//   - Effects dip the music only slightly: to 80%, back within ~0.2 s
//     (MUS_DUCK_TO). It never drops out and is never muffled on a kill
//     (owner 2026-10-03: "good theory, but not in practice"), so the lab's
//     muDrop low-pass sweep is deliberately NOT ported.
//   - Its own toggle and volume, on the same pattern as the effects (owner
//     2026-10-07 for sound; extended to music here): on by default, armed
//     until the viewer's first click or key press, one-click mute, the mute
//     and the volume remembered (musPrefParse / musPrefSerialize under
//     MUS_PREF_KEY, through the same { read, write } store seam the owner
//     website will fill from the account's Music setting).
//   - It shares SND's AudioContext and limiter (SND.core()), so music and
//     effects are mixed and limited together; the context runs while either
//     is on and the tab is visible (SND.hold).
//
// Same single-source rule as soundFx.ts: the page embeds MUSIC_PURE_SOURCE
// (the arrangement: which notes and drums play on each step at a given
// intensity, as plain data) and MUSIC_RUNTIME_SOURCE (the scheduler and
// WebAudio player) verbatim, after the sound sources. Node evaluates the
// pure half; the tests run the runtime against a recording fake
// AudioContext.
import { SOUND_FX_PURE_SOURCE } from "./soundFx.js";
import type { FxTier } from "./fxMagnitude.js";

export const MUSIC_PURE_SOURCE = String.raw`
  var MUS_BPM = 104;
  // One sixteenth note, in seconds.
  var MUS_S16 = 60 / MUS_BPM / 4;
  // i–VI–III–VII in A minor as MIDI triads: Am, F, C, G.
  var MUS_PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  // The arpeggio's pattern over the chord (3 = the root an octave up).
  var MUS_ARP = [0, 1, 2, 3, 2, 1, 0, 2];
  // Intensity: rests at 1 (calm), at 1 + MUS_MYTHIC_LIFT with a Mythic on
  // the acting side, never above MUS_I_MAX, and relaxes back to rest with
  // a time constant of MUS_REST_S seconds.
  var MUS_I_MAX = 3.2;
  var MUS_REST_S = 6;
  var MUS_MYTHIC_LIFT = 0.35;
  // What pushes intensity up (the lab's muBump values). An impact is
  // scaled by its magnitude tier, the same weights the effects use.
  var MUS_BUMP = { launch: 0.04, bolt: 0.04, impact: 0.2, kill: 1.1, mythic: 1.3 };
  // The thresholds where each layer enters (the lab's playStep).
  var MUS_AT = { kick1: 0.6, kick3: 1.2, arp: 1.3, drive: 1.45, hats: 1.6, arp16: 2.2, kick4: 2.3, offHats: 2.4, snare: 2.5 };
  // An effect dips the music to this share of its level, then it recovers.
  var MUS_DUCK_TO = 0.8;
  // Scheduling: steps are queued this far ahead of the audio clock, by a
  // timer firing this often.
  var MUS_LOOKAHEAD_S = 0.12;
  var MUS_TICK_MS = 25;
  function musFreq(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function musClampI(I) { I = Number(I); if (I !== I) return 1; return I < 0 ? 0 : I > MUS_I_MAX ? MUS_I_MAX : I; }
  function musBase(mythic) { return 1 + (mythic ? MUS_MYTHIC_LIFT : 0); }
  // musRest(I, base, dt): intensity dt seconds later, relaxing toward base.
  function musRest(I, base, dt) {
    if (!(dt > 0)) return I;
    return I + (base - I) * (1 - Math.exp(-dt / MUS_REST_S));
  }
  // musBump(I, kind, tier): intensity after one event. Unknown kinds (a
  // heal, a buff, a block) leave it alone: the music follows violence.
  function musBump(I, kind, tier) {
    var v = MUS_BUMP[kind];
    if (!v) return I;
    if (kind === 'impact') v *= sfxTierGain(tier);
    return musClampI(I + v);
  }
  // musLayers(I): which parts are playing at this intensity (for the meter,
  // the tests and anyone reading the arrangement).
  function musLayers(I) {
    return {
      pad: true,
      bass: I < MUS_AT.drive ? 'pulse' : 'drive',
      kick: I >= MUS_AT.kick4 ? 4 : I >= MUS_AT.kick3 ? 2 : I >= MUS_AT.kick1 ? 1 : 0,
      arp: I >= MUS_AT.arp16 ? 16 : I >= MUS_AT.arp ? 8 : 0,
      hats: I >= MUS_AT.hats,
      offHats: I >= MUS_AT.offHats,
      snare: I >= MUS_AT.snare,
    };
  }
  // musMeter(I): the small "intensity" readout, in half-steps up to 3.
  function musMeter(I) {
    var lv = Math.round(Math.min(3, Math.max(0, I)) * 2) / 2, full = Math.floor(lv), half = lv - full > 0;
    var s = '';
    for (var a = 0; a < full; a++) s += '▮';
    if (half) s += '▯';
    for (var b = full + (half ? 1 : 0); b < 3; b++) s += '·';
    return s;
  }
  // The viewer's remembered music setting, the same shape and rules as the
  // effects' (only an explicit mute is remembered as off).
  var MUS_PREF_KEY = 'ai-tcg.music';
  var MUS_DEFAULT_VOLUME = 0.6;
  function musClampVolume(v) {
    v = Number(v);
    if (v !== v) return MUS_DEFAULT_VOLUME;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  // Whom the arpeggio follows (owner 2026-10-10, render item 4): the acting
  // player (the default, as built in slice 4) or whoever is ahead.
  var MUS_FOLLOW = ['acting', 'ahead'];
  function musFollowOf(v) { return v === 'ahead' ? 'ahead' : 'acting'; }
  function musPrefParse(raw) {
    var p = null;
    if (typeof raw === 'string') { try { p = JSON.parse(raw); } catch (e) { p = null; } }
    else if (raw && typeof raw === 'object') p = raw;
    if (!p || typeof p !== 'object') return { muted: false, volume: MUS_DEFAULT_VOLUME, follow: 'acting' };
    return { muted: p.muted === true, volume: p.volume === undefined ? MUS_DEFAULT_VOLUME : musClampVolume(p.volume), follow: musFollowOf(p.follow) };
  }
  function musPrefSerialize(pref) {
    return JSON.stringify({ muted: !!(pref && pref.muted), volume: musClampVolume(pref ? pref.volume : MUS_DEFAULT_VOLUME), follow: musFollowOf(pref && pref.follow) });
  }
  // The side the music follows this frame: its faction voices the
  // arpeggio, its Mythic rings the bells. 'ahead' takes the momentum
  // leader; when the match is even it falls back to the acting player, so
  // the voice never goes silent or flips on a draw.
  function musSceneSide(follow, activePlayer, leader) {
    if (musFollowOf(follow) === 'ahead' && (leader === 'p1' || leader === 'p2')) return leader;
    return activePlayer;
  }

  // musStep(step, I, faction, mythic, rand) -> the voices that start on this
  // sixteenth, each
  //   { k: 'tone', type, f, f1?, glide?, dur, g, att?, rel?, pad?, det?, ff?, ff1?, q?, pan?, send?, at? }
  //   { k: 'noise', type, f, q?, dur, g, pan? }
  // with times in seconds from the step's start (at, default 0) and linear
  // gains. send: true routes the voice through the echo (the arpeggio and
  // the bells); everything else goes straight to the music bus. rand() is
  // injected (Math.random on the page, a seeded one in the tests). The lab's
  // playStep, as data.
  function musStep(step, I, faction, mythic, rand) {
    var bar = (step >> 4) % 4, pos = step % 16, ch = MUS_PROG[bar], v = sfxVoiceOf(faction), out = [];
    function T(x) { x.k = 'tone'; out.push(x); }
    function N(x) { x.k = 'noise'; out.push(x); }
    // The pad: the chord an octave down, two detuned saws per note, held
    // for the bar, brightening with intensity.
    if (pos === 0) ch.forEach(function (n, i) {
      [-9, 9].forEach(function (det) { T({ type: 'sawtooth', f: musFreq(n - 12), dur: MUS_S16 * 16 + 0.35, att: 0.6, rel: 0.45, pad: true, g: 0.03, det: det, ff: 520 + I * 450, pan: (i - 1) * 0.35 }); });
    });
    // The bass: two long notes a bar when calm, driving eighths above.
    var root = ch[0] - 24;
    if (I < MUS_AT.drive) { if (pos === 0 || pos === 8) T({ type: 'sawtooth', f: musFreq(root), dur: MUS_S16 * 7.5, att: 0.02, g: 0.15, ff: 240 + I * 120, ff1: 160 }); }
    else if (pos % 2 === 0) T({ type: 'sawtooth', f: musFreq(root + ((pos === 6 || pos === 14) ? 12 : 0)), dur: MUS_S16 * 1.8, att: 0.006, g: 0.13, ff: 300 + I * 200, ff1: 140 });
    // Drums.
    if ((I >= MUS_AT.kick1 && pos === 0) || (I >= MUS_AT.kick3 && pos === 8) || (I >= MUS_AT.kick4 && (pos === 4 || pos === 12)))
      T({ type: 'sine', f: 150, f1: 44, glide: 0.11, dur: 0.32, att: 0.002, g: 0.42 });
    if (I >= MUS_AT.hats && (pos === 2 || pos === 6 || pos === 10 || pos === 14)) N({ type: 'highpass', f: 7500, dur: 0.05, g: 0.045, pan: 0.25 });
    if (I >= MUS_AT.offHats && pos % 2 === 1) N({ type: 'highpass', f: 9000, dur: 0.03, g: 0.022, pan: -0.25 });
    if (I >= MUS_AT.snare && (pos === 4 || pos === 12)) { N({ type: 'bandpass', f: 1900, q: 0.8, dur: 0.17, g: 0.16 }); T({ type: 'triangle', f: 190, f1: 150, dur: 0.08, g: 0.06 }); }
    // The arpeggio, in the acting faction's voice: eighths, then sixteenths.
    if (I >= MUS_AT.arp) {
      var st = I >= MUS_AT.arp16 ? 1 : 2;
      if (pos % st === 0) {
        var a = MUS_ARP[pos % 8], n = (a === 3 ? ch[0] + 12 : ch[a]) + 12, pan = pos % 4 < 2 ? -0.3 : 0.3;
        if (v === 'cortex') T({ type: 'square', f: musFreq(n), dur: MUS_S16 * 0.9, g: 0.026, ff: 3200, pan: pan, send: true });
        else if (v === 'aegis') T({ type: 'sawtooth', f: musFreq(n - 12), dur: MUS_S16 * 1.3, g: 0.04, ff: 1500, ff1: 600, pan: pan, send: true });
        else if (v === 'swarm') { if (rand() > 0.22) T({ type: 'triangle', f: musFreq(n), dur: MUS_S16 * 1.1, g: 0.06, det: -14 + 28 * rand(), pan: pan, send: true }); }
        else if (v === 'null') {
          if (rand() > 0.15) {
            if (rand() < 0.3) n += rand() < 0.5 ? 12 : -12;
            var x = { type: 'square', f: musFreq(n), dur: MUS_S16 * 0.8, g: 0.024, ff: 2600, pan: pan, send: true };
            if (rand() < 0.15) x.f1 = musFreq(n) * 0.5;
            T(x);
          }
        } else {
          T({ type: 'sine', f: musFreq(n + 12), dur: MUS_S16 * 3, g: 0.045, pan: pan, send: true });
          T({ type: 'sine', f: musFreq(n + 12) * SFX_BELL[1], dur: MUS_S16 * 1.5, g: 0.006, pan: pan, send: true });
        }
      }
    }
    // A Mythic on the acting side: a bell motif every other bar.
    if (pos === 0 && bar % 2 === 0 && mythic) {
      var b = ch[2] + 24;
      T({ type: 'sine', f: musFreq(b), dur: 2.6, g: 0.03, send: true });
      T({ type: 'sine', f: musFreq(b) * SFX_BELL[1], dur: 1.4, g: 0.007, send: true });
      T({ type: 'triangle', f: musFreq(b - 12), at: MUS_S16 * 4, dur: 2, g: 0.015, send: true });
    }
    return out;
  }
`;

export const MUSIC_RUNTIME_SOURCE = String.raw`
  var MUS = (function () {
    // want: the viewer wants music (armed, or playing). on: it is playing.
    // vol: the music volume, 0-1. I: intensity. voice/mythic: the scene.
    var MU = { on: false, want: false, vol: MUS_DEFAULT_VOLUME, follow: 'acting', I: 1, faction: 'Neutral', mythic: false,
      bus: null, duck: null, send: null, next: 0, step: 0, lastT: 0, timer: null, lastDuck: -1, meter: null };
    // The music bus at full volume: the lab's 0.84 bus through its 0.6
    // master, so the default volume (0.6) matches the lab's default mix.
    var LEVEL = 0.84 * 0.6;
    var counts = { steps: 0, voices: 0, ducks: 0, bumps: 0, peakI: 1 };
    function core() { return SND.core(); }
    function init() {
      if (MU.bus) return true;
      var A = core();
      if (!A) return false;
      var C = A.ctx;
      // send -> bus (dry) and send -> high-pass -> dotted-eighth echo -> bus;
      // bus -> duck -> the shared limiter. No low-pass: the music is never
      // muffled.
      MU.bus = C.createGain(); MU.bus.gain.value = 0;
      MU.duck = C.createGain(); MU.duck.gain.value = 1;
      MU.send = C.createGain();
      var hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      var dl = C.createDelay(1); dl.delayTime.value = MUS_S16 * 3;
      var fb = C.createGain(); fb.gain.value = 0.3;
      var wet = C.createGain(); wet.gain.value = 0.35;
      MU.send.connect(MU.bus); MU.send.connect(hp); hp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(MU.bus);
      MU.bus.connect(MU.duck); MU.duck.connect(A.comp);
      return true;
    }
    function voice(o, t0) {
      var A = core(), C = A.ctx, t = t0 + (o.at || 0), d = o.dur;
      var e = C.createGain(), n;
      if (o.k === 'noise') {
        var s = C.createBufferSource(); s.buffer = A.noise;
        var f = C.createBiquadFilter(); f.type = o.type; f.frequency.value = o.f; f.Q.value = o.q || 0.7;
        e.gain.setValueAtTime(o.g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + d);
        s.connect(f); f.connect(e); n = e;
        s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
      } else {
        var osc = C.createOscillator(); osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(o.f, t);
        if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || d));
        if (o.det) osc.detune.value = o.det;
        var a = o.att || 0.004;
        e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(o.g, t + a);
        if (o.pad) { var r = o.rel || 0.3; e.gain.setValueAtTime(o.g, t + Math.max(a, d - r)); e.gain.linearRampToValueAtTime(0, t + d); }
        else e.gain.exponentialRampToValueAtTime(0.0001, t + d);
        var src = osc;
        if (o.ff) { var fl = C.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.ff, t); if (o.ff1) fl.frequency.exponentialRampToValueAtTime(o.ff1, t + d); fl.Q.value = o.q || 0.8; osc.connect(fl); src = fl; }
        src.connect(e); n = e;
        osc.start(t); osc.stop(t + d + 0.05);
      }
      if (o.pan && C.createStereoPanner) { var p = C.createStereoPanner(); p.pan.value = o.pan; n.connect(p); n = p; }
      n.connect(o.send ? MU.send : MU.bus);
      counts.voices++;
    }
    function showMeter() {
      if (MU.meter) MU.meter.textContent = 'intensity ' + musMeter(MU.on ? MU.I : 0);
    }
    // tick(): one scheduler pass. Relax intensity for the time passed, then
    // queue every sixteenth that starts within the lookahead.
    function tick() {
      // Check MU.on first: core() would make a context.
      if (!MU.on) return 0;
      var A = core();
      if (!A) return 0;
      var C = A.ctx, now = C.currentTime, dt = Math.max(0, now - (MU.lastT || now)), queued = 0;
      MU.lastT = now;
      MU.I = musRest(MU.I, musBase(MU.mythic), dt);
      // Back from a hidden tab (or a stall): start again just ahead of now
      // rather than firing every missed step at once.
      if (MU.next < now) MU.next = now + 0.05;
      while (MU.next < now + MUS_LOOKAHEAD_S) {
        var vs = musStep(MU.step, MU.I, MU.faction, MU.mythic, Math.random);
        for (var i = 0; i < vs.length; i++) voice(vs[i], MU.next);
        MU.next += MUS_S16; MU.step++; counts.steps++; queued++;
      }
      showMeter();
      return queued;
    }
    function ramp(target, tc) {
      var C = core().ctx, t = C.currentTime, g = MU.bus.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(target, t, tc);
    }
    function setOn(on) {
      MU.want = !!on;
      if (on && !init()) { MU.want = false; return false; }
      MU.on = !!on;
      SND.hold('music', MU.on);
      if (!MU.bus) return MU.on;
      // Fade in over about a second; fade out quickly.
      ramp(MU.on ? LEVEL * MU.vol : 0, MU.on ? 0.6 : 0.15);
      if (MU.on) {
        var t = core().ctx.currentTime;
        MU.next = t + 0.1; MU.step = 0; MU.lastT = t;
        if (!MU.timer) MU.timer = setInterval(tick, MUS_TICK_MS);
      } else if (MU.timer) { clearInterval(MU.timer); MU.timer = null; }
      showMeter();
      return MU.on;
    }
    // event(kind, tier): every sound event, whether or not effects are
    // muted, so the music follows the match even with effects off.
    function event(kind, tier) {
      if (!MU.on) return MU.I;
      var before = MU.I;
      MU.I = musBump(MU.I, kind, tier);
      if (MU.I !== before) counts.bumps++;
      if (MU.I > counts.peakI) counts.peakI = MU.I;
      return MU.I;
    }
    // duck(): an effect is sounding. Dip to MUS_DUCK_TO fast and recover
    // within about 0.2 s; at most once per 60 ms so a volley doesn't pump.
    function duck() {
      if (!MU.on || !MU.duck) return false;
      var C = core().ctx, t = C.currentTime;
      if (MU.lastDuck >= 0 && t - MU.lastDuck < 0.06) return false;
      MU.lastDuck = t;
      var g = MU.duck.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(MUS_DUCK_TO, t, 0.01); g.setTargetAtTime(1, t + 0.1, 0.2);
      counts.ducks++;
      return true;
    }
    // setScene(faction, mythic): who is acting (the arpeggio's voice) and
    // whether that side has a Mythic in play (the bells, a higher rest).
    function setScene(faction, mythic) { MU.faction = faction || 'Neutral'; MU.mythic = !!mythic; }
    function arm(pref) {
      pref = musPrefParse(pref);
      MU.want = !pref.muted;
      MU.follow = pref.follow;
      setVolume(pref.volume);
      return state();
    }
    function unlock() {
      if (!MU.want || MU.on) return MU.on;
      return setOn(true);
    }
    function setVolume(v) {
      MU.vol = musClampVolume(v);
      if (MU.bus && MU.on) ramp(LEVEL * MU.vol, 0.1);
      return MU.vol;
    }
    function state() { return MU.on ? 'on' : MU.want ? 'armed' : 'muted'; }
    function localStore() {
      return {
        read: function () { try { return window.localStorage.getItem(MUS_PREF_KEY); } catch (e) { return null; } },
        write: function (v) { try { window.localStorage.setItem(MUS_PREF_KEY, v); } catch (e) { /* not remembered */ } },
      };
    }
    // mount(btn, slider, meter, store, follow): the page's music control,
    // wired like SND.mount: armed at load, started by the first gesture
    // anywhere (a press on this button just mutes), toggled and volume-set
    // in place, all remembered. follow (optional) is a <select> of
    // MUS_FOLLOW: whom the arpeggio follows.
    function mount(btn, slider, meter, store, follow) {
      store = store || localStore();
      MU.meter = meter || null;
      arm(store.read());
      function save() { store.write(musPrefSerialize({ muted: !MU.want, volume: MU.vol, follow: MU.follow })); }
      if (follow) {
        follow.value = MU.follow;
        follow.addEventListener('change', function () { MU.follow = musFollowOf(follow.value); save(); });
      }
      function show() {
        var st = state();
        btn.textContent = st === 'muted' ? '♪ Music off' : '♫ Music on';
        btn.title = st === 'muted' ? 'Music is off. Click to switch it on.'
          : st === 'armed' ? 'Music is on and starts on your first click or key press. Click to mute.'
          : 'Music is on. Click to mute.';
        btn.setAttribute('aria-pressed', String(st !== 'muted'));
        btn.setAttribute('data-state', st);
        if (btn.classList) { btn.classList.toggle('on', st !== 'muted'); btn.classList.toggle('armed', st === 'armed'); }
        if (slider) slider.disabled = st === 'muted';
        showMeter();
      }
      function gesture(ev) {
        if (ev && ev.target && btn.contains && btn.contains(ev.target)) return;
        // A press on any audio control (marked data-audio-ctl: the effects'
        // or the music's) only does what that control does; muting one
        // never starts the other.
        if (ev && ev.target && ev.target.closest && ev.target.closest('[data-audio-ctl]')) return;
        if (state() === 'armed') { unlock(); show(); }
      }
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('pointerdown', gesture, true);
        document.addEventListener('keydown', gesture, true);
      }
      btn.addEventListener('click', function () { setOn(state() === 'muted'); save(); show(); });
      if (slider) {
        slider.value = String(Math.round(MU.vol * 100));
        slider.addEventListener('input', function () { setVolume(Number(slider.value) / 100); save(); });
      }
      show();
      return { gesture: gesture, show: show };
    }
    // Every effect the page plays reaches the music: it bumps intensity
    // (even with effects muted) and, when it actually sounds, ducks.
    SND.listen(function (kind, faction, tier, played) { event(kind, tier); if (played) duck(); });
    var api = { setOn: setOn, isOn: function () { return MU.on; }, arm: arm, unlock: unlock, setVolume: setVolume,
      volume: function () { return MU.vol; }, follow: function () { return MU.follow; }, state: state, event: event, duck: duck, setScene: setScene, tick: tick,
      localStore: localStore, mount: mount,
      stats: function () { return { on: MU.on, state: state(), volume: MU.vol, I: +MU.I.toFixed(3), faction: MU.faction, mythic: MU.mythic,
        layers: musLayers(MU.I), step: MU.step, steps: counts.steps, voices: counts.voices, ducks: counts.ducks, bumps: counts.bumps,
        peakI: +counts.peakI.toFixed(3), duckGain: MU.duck ? MU.duck.gain.value : null, busGain: MU.bus ? MU.bus.gain.value : null }; } };
    window.__music = api;
    return api;
  })();
`;

export interface MusVoice {
  k: "tone" | "noise";
  type: string;
  f: number;
  f1?: number;
  glide?: number;
  dur: number;
  g: number;
  att?: number;
  rel?: number;
  pad?: boolean;
  det?: number;
  ff?: number;
  ff1?: number;
  q?: number;
  pan?: number;
  send?: boolean;
  at?: number;
}
export interface MusLayers {
  pad: boolean;
  bass: "pulse" | "drive";
  kick: 0 | 1 | 2 | 4;
  arp: 0 | 8 | 16;
  hats: boolean;
  offHats: boolean;
  snare: boolean;
}
export type MusFollow = "acting" | "ahead";
export interface MusPref {
  muted: boolean;
  volume: number;
  follow: MusFollow;
}

const pure = new Function(
  `${SOUND_FX_PURE_SOURCE}; ${MUSIC_PURE_SOURCE}; return { MUS_BPM: MUS_BPM, MUS_S16: MUS_S16, MUS_PROG: MUS_PROG, MUS_ARP: MUS_ARP, MUS_I_MAX: MUS_I_MAX, MUS_REST_S: MUS_REST_S, MUS_MYTHIC_LIFT: MUS_MYTHIC_LIFT, MUS_BUMP: MUS_BUMP, MUS_AT: MUS_AT, MUS_DUCK_TO: MUS_DUCK_TO, MUS_LOOKAHEAD_S: MUS_LOOKAHEAD_S, MUS_PREF_KEY: MUS_PREF_KEY, MUS_DEFAULT_VOLUME: MUS_DEFAULT_VOLUME, musFreq: musFreq, musBase: musBase, musRest: musRest, musBump: musBump, musLayers: musLayers, musMeter: musMeter, musStep: musStep, musPrefParse: musPrefParse, musPrefSerialize: musPrefSerialize, MUS_FOLLOW: MUS_FOLLOW, musSceneSide: musSceneSide };`,
)() as {
  MUS_BPM: number;
  MUS_S16: number;
  MUS_PROG: number[][];
  MUS_ARP: number[];
  MUS_I_MAX: number;
  MUS_REST_S: number;
  MUS_MYTHIC_LIFT: number;
  MUS_BUMP: Record<string, number>;
  MUS_AT: Record<string, number>;
  MUS_DUCK_TO: number;
  MUS_LOOKAHEAD_S: number;
  MUS_PREF_KEY: string;
  MUS_DEFAULT_VOLUME: number;
  musFreq: (midi: number) => number;
  musBase: (mythic: boolean) => number;
  musRest: (I: number, base: number, dt: number) => number;
  musBump: (I: number, kind: string, tier: FxTier) => number;
  musLayers: (I: number) => MusLayers;
  musMeter: (I: number) => string;
  musStep: (step: number, I: number, faction: string | undefined, mythic: boolean, rand: () => number) => MusVoice[];
  musPrefParse: (raw: unknown) => MusPref;
  musPrefSerialize: (pref: Partial<MusPref> | null | undefined) => string;
  MUS_FOLLOW: MusFollow[];
  musSceneSide: (follow: string | undefined, activePlayer: "p1" | "p2", leader: string) => "p1" | "p2";
};

export const {
  MUS_BPM, MUS_S16, MUS_PROG, MUS_ARP, MUS_I_MAX, MUS_REST_S, MUS_MYTHIC_LIFT, MUS_BUMP, MUS_AT, MUS_DUCK_TO, MUS_LOOKAHEAD_S, MUS_PREF_KEY,
  MUS_DEFAULT_VOLUME, musFreq, musBase, musRest, musBump, musLayers, musMeter, musStep, musPrefParse, musPrefSerialize,
  MUS_FOLLOW, musSceneSide,
} = pure;
