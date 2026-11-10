// EFFECTS.md v2, slice 3 — procedural sound effects with faction voices
// (owner-directed 2026-10-03; working reference: the lab's SFX, tone() and
// noise() in render/reference/effects-lab.html).
//
// What it is:
//   - Every sound is synthesised with WebAudio at play time: oscillators and
//     filtered noise, no audio files, no samples, no network (owner
//     2026-10-03: the code-made sound beat every AI sound model tested).
//   - One sound per visual event, fired by renderHtml.ts at the moment the
//     visual happens (a strike leaving, its impact, a spell's shot and its
//     landing, a heal, a buff, a debuff, a removal locking on and striking,
//     a kill, a Barrier blocking, a cast flourish). The page decides WHAT and
//     WHEN, exactly as for the canvas; this module only decides how it
//     sounds.
//   - Axis 2 (faction = material) is the VOICE: Cortex clean square-wave
//     blips, Aegis heavy metal clangs (inharmonic partials), Swarm wet
//     chitters and squelches, Null broken pitch and glitch blips, Neutral
//     bells. Axis 3 (magnitude) scales volume and weight (SFX_TIER_GAIN).
//     Axis 1 (meaning) stays constant across voices: a heal always rises, a
//     debuff always falls, an impact always has the same low thump under the
//     faction's colour, a block always rings.
//   - Panned by where it happens on screen, through a limiter (a hard
//     compressor on the master bus), with a voice cap so a big volley can't
//     pile up.
//   - ON by default, armed (owner 2026-10-07, call 7). Browsers only allow
//     audio after a viewer gesture, so the page arms sound at load and the
//     AudioContext starts on the viewer's first click or key press anywhere
//     (pressing Play counts). A small "Sound on" control mutes it in one
//     click, with an effects volume slider beside it. Muting and the volume
//     are remembered (sfxPrefParse / sfxPrefSerialize, under SFX_PREF_KEY):
//     in browser storage for a standalone replay; the owner website will
//     pass its own store holding the account's Sound setting through the
//     same { read, write } seam (SND.mount). A muted viewer stays muted
//     until they switch it back on. Music (slice 4, musicFx.ts) has its own
//     toggle and shares this context and limiter (SND.core / hold / listen).
//
// Same single-source rule as canvasFx.ts: the page embeds
// SOUND_FX_PURE_SOURCE (the voice recipes: which oscillators and noise
// bursts make each sound, as plain data) and SOUND_FX_RUNTIME_SOURCE (the
// WebAudio player) verbatim. Node evaluates the pure half, and the tests run
// the runtime half against a recording fake AudioContext, so they exercise
// exactly what the page runs.
import type { FxTier } from "./fxMagnitude.js";

export const SOUND_FX_PURE_SOURCE = String.raw`
  // Axis 3: magnitude scales volume (and so weight: a spectacle impact's
  // thump is the loudest thing in the mix). The limiter keeps the sum sane.
  var SFX_TIER_GAIN = { subtle: 0.55, normal: 1, spectacle: 1.4 };
  // At most this many oscillators/noise sources alive at once (the lab's
  // cap); a voice past it is dropped, never queued.
  var SFX_VOICE_CAP = 30;
  // The same sound for the same faction this soon after the last one is
  // dropped: a Swarm volley is many shots but should read as one chitter
  // cloud, not a wall of identical clicks.
  var SFX_REPEAT_GAP_MS = 28;
  // The pack opening's sounds (render session 24, owner 2026-10-18: "a tear
  // sound, flip ticks and a rising tone on hits"). Same player, same
  // settings; the voice is the card's faction where there is one.
  var SFX_PACK_KINDS = ['tear', 'flip', 'rise', 'sparkle', 'type', 'breach', 'glitch', 'stamp', 'burst', 'riser', 'bass', 'tick', 'fanfare'];
  // The rip scrubbed to the drag (render session 58, the pack ceremony part
  // 1): how loud and how bright the tearing foil sounds at a drag speed (px
  // per ms along the strip). Still is silent; a slow pull is a low, quiet
  // rasp; a fast one a loud bright rip with crackle on top. The level
  // saturates at SFX_SCRUB_FULL px/ms.
  var SFX_SCRUB_FULL = 1.4;
  function sfxScrubLevel(speed) {
    var v = Math.max(0, Math.min(1, (speed || 0) / SFX_SCRUB_FULL));
    var lvl = Math.pow(v, 0.8);
    return { gain: Math.round(lvl * 0.3 * 1000) / 1000, freq: Math.round(1400 + 4600 * v), crackle: Math.round(lvl * lvl * 0.14 * 1000) / 1000 };
  }
  var SFX_KINDS = ['launch', 'impact', 'bolt', 'heal', 'buff', 'debuff', 'lock', 'beam', 'kill', 'block', 'cast', 'ward', 'wardPulse', 'wardBreak'];
  // Ward moments (slice 6, the lab's wardIn / wardPulse / wardBreak): each
  // faction's chord, low to high. Neutral has no ward; it gets Cortex's.
  var SFX_WARD_CHORD = { cortex: [440, 660, 880], aegis: [110, 165, 220], swarm: [262, 277, 392], null: [233, 330, 466], neutral: [440, 660, 880] };
  var SFX_VOICES = { Cortex: 'cortex', Aegis: 'aegis', Swarm: 'swarm', Null: 'null', Neutral: 'neutral' };
  function sfxVoiceOf(faction) { return SFX_VOICES[faction] || 'neutral'; }
  function sfxTierGain(tier) { return SFX_TIER_GAIN[tier] || SFX_TIER_GAIN.normal; }
  // Left of the screen pans left; never fully hard (the lab's 0.75).
  function sfxPan(x, width) {
    if (!(width > 0) || typeof x !== 'number' || x !== x) return 0;
    var p = (x / width * 2 - 1) * 0.75;
    return p < -0.75 ? -0.75 : p > 0.75 ? 0.75 : p;
  }
  // Aegis's metal and Neutral's bells: the inharmonic partials of a struck
  // bar (1, 2.76, 5.4), quieter the higher they go.
  var SFX_BELL = [1, 2.76, 5.4];
  // The viewer's remembered sound setting: muted or not, and the effects
  // volume (0-1). Anything unreadable falls back to the default: sound on
  // at SFX_DEFAULT_VOLUME. Only an explicit mute is ever remembered as off.
  var SFX_PREF_KEY = 'ai-tcg.sound';
  var SFX_DEFAULT_VOLUME = 0.8;
  function sfxClampVolume(v) {
    v = Number(v);
    if (v !== v) return SFX_DEFAULT_VOLUME;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function sfxPrefParse(raw) {
    var p = null;
    if (typeof raw === 'string') { try { p = JSON.parse(raw); } catch (e) { p = null; } }
    else if (raw && typeof raw === 'object') p = raw;
    if (!p || typeof p !== 'object') return { muted: false, volume: SFX_DEFAULT_VOLUME };
    return { muted: p.muted === true, volume: p.volume === undefined ? SFX_DEFAULT_VOLUME : sfxClampVolume(p.volume) };
  }
  function sfxPrefSerialize(pref) {
    return JSON.stringify({ muted: !!(pref && pref.muted), volume: sfxClampVolume(pref ? pref.volume : SFX_DEFAULT_VOLUME) });
  }

  // sfxRecipe(kind, faction, tier, rand, o) -> a list of voices, each
  //   { k: 'tone', type, f0, f1?, dur, g, att?, delay?, steps?, detune?, filt?, ff?, q? }
  //   { k: 'noise', type, f0, f1?, q?, dur, g, att?, delay? }
  // in seconds and linear gain, ready for the runtime to play. rand() is
  // injected (Math.random on the page, a seeded one in the tests). o:
  //   targetKind 'player' (impact): a hit that lands on a player's side of
  //     the board carries a heavier low end;
  //   victim (kill): the victim's faction adds its own breaking sound.
  // The lab's recipes, with every gain scaled by the tier.
  function sfxRecipe(kind, faction, tier, rand, o) {
    o = o || {};
    var v = sfxVoiceOf(faction), m = sfxTierGain(tier), out = [];
    function r(a, b) { return a + (b - a) * rand(); }
    function T(x) { x.k = 'tone'; x.g = x.g * m; out.push(x); }
    function N(x) { x.k = 'noise'; x.g = x.g * m; out.push(x); }
    if (kind === 'launch') {
      if (v === 'cortex') { T({ type: 'square', f0: 1400, f1: 420, dur: 0.14, g: 0.07 }); T({ type: 'square', f0: 2100, dur: 0.04, g: 0.04, delay: 0.03 }); }
      else if (v === 'aegis') { N({ type: 'lowpass', f0: 900, f1: 180, dur: 0.3, g: 0.32 }); T({ type: 'sawtooth', f0: 95, f1: 48, dur: 0.22, g: 0.12, filt: 'lowpass', ff: 500 }); }
      else if (v === 'swarm') { for (var i = 0; i < 6; i++) N({ type: 'bandpass', f0: r(2600, 4200), q: 9, dur: 0.035, g: 0.22, delay: i * 0.035 }); N({ type: 'bandpass', f0: 1300, f1: 350, q: 4, dur: 0.22, g: 0.18 }); }
      else if (v === 'null') { T({ type: 'sawtooth', f0: 420, dur: 0.22, g: 0.06, steps: 7, filt: 'bandpass', ff: 1400, q: 2 }); N({ type: 'highpass', f0: 3000, dur: 0.16, g: 0.09, att: 0.12 }); }
      else { T({ type: 'sine', f0: 660, f1: 990, dur: 0.22, g: 0.09 }); T({ type: 'triangle', f0: 1320, dur: 0.18, g: 0.04, delay: 0.04 }); }
    } else if (kind === 'impact') {
      // The constant part (meaning): a low thump and a noise crack. A hit on
      // a player's side of the board lands lower and longer.
      var face = o.targetKind === 'player';
      T({ type: 'sine', f0: face ? 120 : 150, f1: face ? 34 : 42, dur: face ? 0.4 : 0.28, g: 0.45 });
      N({ type: 'lowpass', f0: 3600, f1: 280, dur: face ? 0.3 : 0.22, g: 0.32 });
      if (v === 'cortex') { T({ type: 'square', f0: 1800, f1: 220, dur: 0.09, g: 0.06 }); T({ type: 'square', f0: 900, dur: 0.05, g: 0.04, delay: 0.05 }); }
      else if (v === 'aegis') { SFX_BELL.forEach(function (p) { T({ type: 'sine', f0: 330 * p, dur: 0.7, g: 0.05 / p }); }); N({ type: 'bandpass', f0: 2400, q: 3, dur: 0.12, g: 0.15 }); }
      else if (v === 'swarm') { N({ type: 'bandpass', f0: 950, f1: 180, q: 5, dur: 0.24, g: 0.3 }); for (var j = 0; j < 4; j++) N({ type: 'bandpass', f0: r(3000, 5000), q: 10, dur: 0.03, g: 0.12, delay: 0.05 + j * 0.03 }); }
      else if (v === 'null') { for (var k = 0; k < 3; k++) T({ type: 'square', f0: r(200, 2400), dur: 0.03, g: 0.06, delay: k * 0.035 }); T({ type: 'sawtooth', f0: 70, f1: 35, dur: 0.35, g: 0.12, filt: 'lowpass', ff: 400 }); }
      else { [880, 1320, 1760].forEach(function (n) { T({ type: 'triangle', f0: n, dur: 0.5, g: 0.035 }); }); }
    } else if (kind === 'bolt') {
      // One shot of a spell volley leaving its source.
      if (v === 'cortex') T({ type: 'square', f0: 2400, f1: 600, dur: 0.08, g: 0.05 });
      else if (v === 'aegis') N({ type: 'lowpass', f0: 1400, f1: 200, dur: 0.18, g: 0.22 });
      else if (v === 'swarm') N({ type: 'bandpass', f0: r(2500, 4500), q: 9, dur: 0.04, g: 0.12 });
      else if (v === 'null') T({ type: 'square', f0: r(300, 2600), dur: 0.05, g: 0.05 });
      else T({ type: 'triangle', f0: 1760, f1: 2640, dur: 0.1, g: 0.05 });
    } else if (kind === 'heal') {
      // Always rises (meaning); the voice picks the notes and the wave.
      var notes = v === 'null' ? [784, 659, 523, 1047] : v === 'aegis' ? [392, 523, 659, 784] : [523, 659, 784, 1047];
      var ht = v === 'cortex' || v === 'null' ? 'square' : v === 'aegis' ? 'triangle' : 'sine';
      notes.forEach(function (n, i) { T({ type: ht, f0: n, dur: 0.4, g: ht === 'square' ? 0.03 : 0.07, delay: i * 0.08 }); });
      if (v === 'swarm') for (var h = 0; h < 5; h++) T({ type: 'sine', f0: r(500, 900), f1: r(1200, 1800), dur: 0.07, g: 0.04, delay: h * 0.06 });
      if (v === 'neutral') T({ type: 'sine', f0: 1047 * SFX_BELL[1], dur: 0.6, g: 0.012, delay: 0.24 });
    } else if (kind === 'buff') {
      // Always a rising sweep and a high note on top.
      T({ type: v === 'cortex' ? 'square' : 'triangle', f0: 220, f1: 880, dur: 0.42, g: v === 'cortex' ? 0.04 : 0.06 });
      T({ type: 'sine', f0: 1047, dur: 0.4, g: 0.05, delay: 0.3 });
      if (v === 'aegis') N({ type: 'bandpass', f0: 2000, q: 4, dur: 0.08, g: 0.2, delay: 0.25 });
      else if (v === 'swarm') N({ type: 'bandpass', f0: 700, f1: 1800, q: 6, dur: 0.3, g: 0.08 });
      else if (v === 'null') T({ type: 'square', f0: 880, dur: 0.2, g: 0.025, steps: 4, delay: 0.1 });
      else if (v === 'neutral') T({ type: 'sine', f0: 1047 * SFX_BELL[1], dur: 0.5, g: 0.012, delay: 0.3 });
    } else if (kind === 'debuff') {
      // Always a falling, detuned pair (meaning: it sinks).
      T({ type: 'sawtooth', f0: 620, f1: 140, dur: 0.55, g: 0.06, filt: 'lowpass', ff: 1600 });
      T({ type: 'sawtooth', f0: 640, f1: 150, dur: 0.55, g: 0.05, filt: 'lowpass', ff: 1600, detune: 30 });
      if (v === 'swarm' || v === 'neutral') N({ type: 'highpass', f0: 5000, dur: 0.6, g: 0.06, att: 0.1 });
      else if (v === 'null') for (var d = 0; d < 3; d++) T({ type: 'square', f0: r(200, 1800), dur: 0.03, g: 0.04, delay: 0.1 + d * 0.05 });
      else if (v === 'aegis') N({ type: 'bandpass', f0: 1800, f1: 600, q: 3, dur: 0.18, g: 0.12, delay: 0.05 });
    } else if (kind === 'lock') {
      // A removal locking on: three beeps.
      for (var b = 0; b < 3; b++) T({ type: v === 'neutral' ? 'triangle' : 'square', f0: v === 'null' ? r(900, 2200) : 1500, dur: 0.05, g: 0.05, delay: b * 0.14 });
    } else if (kind === 'beam') {
      // The removal's strike.
      T({ type: 'sawtooth', f0: 2200, f1: 70, dur: 0.4, g: 0.14 });
      N({ type: 'highpass', f0: 1500, dur: 0.3, g: 0.18 });
      if (v === 'neutral') SFX_BELL.forEach(function (p) { T({ type: 'sine', f0: 440 * p, dur: 0.8, g: 0.04 / p, delay: 0.05 }); });
    } else if (kind === 'kill') {
      // The killer's impact at full weight, then the card breaking: a deep
      // drop, a long noise fall, a spray of tiny glass pings.
      // (the impact is already scaled by the tier; the lab plays it at 1.5x)
      sfxRecipe('impact', faction, tier, rand, {}).forEach(function (x) { x.g *= 1.5; out.push(x); });
      T({ type: 'sine', f0: 62, f1: 28, dur: 0.8, g: 0.6 });
      N({ type: 'lowpass', f0: 1800, f1: 120, dur: 0.9, g: 0.3, delay: 0.05 });
      for (var s = 0; s < 9; s++) T({ type: 'sine', f0: r(2200, 5200), dur: 0.06, g: 0.03, delay: 0.06 + s * 0.03 });
      if (sfxVoiceOf(o.victim) === 'aegis') SFX_BELL.slice(0, 2).forEach(function (p) { T({ type: 'sine', f0: 220 * p, dur: 1, g: 0.05, delay: 0.05 }); });
    } else if (kind === 'block') {
      // A Barrier takes the hit: a bright ring, in every voice.
      T({ type: 'triangle', f0: 1760, dur: 0.45, g: 0.1 });
      T({ type: 'sine', f0: 2640, dur: 0.35, g: 0.06 });
      N({ type: 'bandpass', f0: 4200, q: 2, dur: 0.12, g: 0.14 });
      if (v === 'aegis') T({ type: 'sine', f0: 440 * SFX_BELL[1], dur: 0.6, g: 0.05 });
    } else if (kind === 'ward') {
      // A Mythic arrives: a run of ticks, the ward's rising chord, then the
      // landing thump; under it all, the lab's mythicIn swell.
      var wc = SFX_WARD_CHORD[v], wt = { cortex: 'square', aegis: 'sawtooth', swarm: 'triangle', null: 'sawtooth' }[v] || 'triangle';
      for (var wi = 0; wi < 12; wi++) T({ type: 'square', f0: v === 'null' ? r(1500, 4000) : 2800 + wi * 60, dur: 0.025, g: 0.025, delay: wi * 0.045 });
      wc.forEach(function (n, i) { T({ type: wt, f0: n, dur: 1.3, g: wt === 'square' ? 0.03 : 0.06, att: 0.45, delay: 0.05 + i * 0.06, filt: 'lowpass', ff: 2400 }); });
      T({ type: 'sine', f0: 90, f1: 40, dur: 0.7, g: 0.45, delay: 0.55 });
      N({ type: 'lowpass', f0: 2000, f1: 200, dur: 0.5, g: 0.18, delay: 0.55 });
      T({ type: 'sine', f0: 55, f1: 110, dur: 1.4, g: 0.3, att: 0.7 });
      T({ type: 'triangle', f0: 220, f1: 330, dur: 1.4, g: 0.05, att: 0.8 });
    } else if (kind === 'wardPulse') {
      SFX_WARD_CHORD[v].slice(1).forEach(function (n) { T({ type: 'triangle', f0: n * 2, dur: 0.6, g: 0.07 }); });
      N({ type: 'bandpass', f0: 3000, q: 2, dur: 0.25, g: 0.08, att: 0.08 });
    } else if (kind === 'wardBreak') {
      // Glass pings, then the chord falling apart, high to low.
      for (var wb = 0; wb < 14; wb++) T({ type: 'sine', f0: r(1800, 5200), dur: 0.09, g: 0.035, delay: wb * 0.022 });
      SFX_WARD_CHORD[v].slice().reverse().forEach(function (n, i) { T({ type: 'triangle', f0: n * 2, f1: n * 1.4, dur: 0.7, g: 0.06, delay: 0.08 + i * 0.09 }); });
    } else if (kind === 'boast') {
      // A victory boast's sting (render slice: victory boasts). Meaning,
      // in every voice: it rises. The faction's chord climbs as a fanfare
      // and lands an octave up on a held chord, over a low swell; the voice
      // adds its own colour on the landing. Not one of SFX_KINDS: it plays
      // once, at the end of a match.
      var bc = SFX_WARD_CHORD[v], bt = { cortex: 'square', aegis: 'sawtooth', swarm: 'triangle', null: 'sawtooth' }[v] || 'triangle';
      var bg = bt === 'square' ? 0.03 : 0.055;
      bc.concat([bc[1] * 2]).forEach(function (n, i) { T({ type: bt, f0: n, dur: 0.24, g: bg, delay: i * 0.11, filt: 'lowpass', ff: 3200 }); });
      bc.forEach(function (n) { T({ type: bt, f0: n * 4, dur: 1.2, g: bg * 0.8, att: 0.04, delay: 0.44, filt: 'lowpass', ff: 3600 }); });
      T({ type: 'sine', f0: 55, f1: 110, dur: 1.3, g: 0.3, att: 0.35 });
      T({ type: 'sine', f0: 110, f1: 45, dur: 0.6, g: 0.4, delay: 0.44 });
      if (v === 'aegis') SFX_BELL.forEach(function (p) { T({ type: 'sine', f0: 220 * p, dur: 1.1, g: 0.07 / p, delay: 0.44 }); });
      else if (v === 'cortex') for (var bi = 0; bi < 6; bi++) T({ type: 'square', f0: 1760 + bi * 220, dur: 0.04, g: 0.025, delay: 0.44 + bi * 0.05 });
      else if (v === 'swarm') for (var bs = 0; bs < 8; bs++) N({ type: 'bandpass', f0: r(2600, 4800), q: 9, dur: 0.035, g: 0.12, delay: 0.44 + bs * 0.04 });
      else if (v === 'null') T({ type: 'square', f0: 880, dur: 0.5, g: 0.03, steps: 6, delay: 0.44 });
      else SFX_BELL.forEach(function (p) { T({ type: 'sine', f0: 880 * p, dur: 1.2, g: 0.04 / p, delay: 0.44 }); });
    } else if (kind === 'crt') {
      // The Season 0 boasts' sounds (render session 33), like 'boast' not
      // match-event sounds. An old tube powering on: a low thump, a crackle
      // of static and the faint flyback whine.
      T({ type: 'sine', f0: 90, f1: 40, dur: 0.3, g: 0.35 });
      N({ type: 'highpass', f0: 2500, dur: 0.35, g: 0.12 });
      for (var ci = 0; ci < 5; ci++) N({ type: 'bandpass', f0: r(3000, 6000), q: 6, dur: 0.02, g: 0.12, delay: 0.05 + ci * 0.05 });
      T({ type: 'sine', f0: 7800, dur: 0.9, g: 0.012, att: 0.2, delay: 0.1 });
    } else if (kind === 'post') {
      // The power-on self test passed: one short beep.
      T({ type: 'square', f0: 1000, dur: 0.14, g: 0.05, att: 0.004 });
    } else if (kind === 'modem') {
      // A dial-up handshake in under a second: four dial tones, the answer
      // tone, then the screech (jumping tones over a sweeping hiss).
      [[697, 1209], [770, 1336], [852, 1477], [941, 1336]].forEach(function (p2, i) { p2.forEach(function (f) { T({ type: 'sine', f0: f, dur: 0.06, g: 0.05, att: 0.004, delay: i * 0.075 }); }); });
      T({ type: 'sine', f0: 2100, dur: 0.18, g: 0.05, att: 0.01, delay: 0.32 });
      T({ type: 'square', f0: 980, dur: 0.12, g: 0.025, steps: 4, delay: 0.5, filt: 'bandpass', ff: 1800, q: 1 });
      T({ type: 'sawtooth', f0: 1650, dur: 0.35, g: 0.03, steps: 10, delay: 0.55, filt: 'bandpass', ff: 2200, q: 2 });
      N({ type: 'bandpass', f0: 1800, f1: 3200, q: 3, dur: 0.38, g: 0.14, delay: 0.52 });
      N({ type: 'bandpass', f0: 600, q: 4, dur: 0.12, g: 0.1, delay: 0.75 });
    } else if (kind === 'handshake') {
      // Match Boot (render session 35), like 'crt' not a match-event sound:
      // HANDSHAKE OK, a two-tone modem chirp, far shorter than Dial-Up
      // Fireworks' screech.
      T({ type: 'sine', f0: 1180, dur: 0.07, g: 0.05, att: 0.004 });
      T({ type: 'sine', f0: 2100, dur: 0.1, g: 0.05, att: 0.004, delay: 0.08 });
    } else if (kind === 'bootOn') {
      // Match Boot (render session 38): its own power-on, not Boot
      // Sequence's 'crt', so the 300-credit boast keeps its sound. Two tubes
      // at once: a deeper thump, the degauss hum of a 90s monitor (mains
      // buzz, low and fading) under a crackle of static, and the flyback
      // whine. One voice whatever the factions.
      T({ type: 'sine', f0: 72, f1: 30, dur: 0.42, g: 0.42 });
      T({ type: 'sawtooth', f0: 50, dur: 0.95, g: 0.07, att: 0.03, filt: 'lowpass', ff: 240 });
      T({ type: 'sawtooth', f0: 100, dur: 0.7, g: 0.035, att: 0.03, filt: 'lowpass', ff: 420 });
      N({ type: 'highpass', f0: 3000, dur: 0.28, g: 0.09 });
      for (var oi = 0; oi < 6; oi++) N({ type: 'bandpass', f0: 2800 + oi * 520, q: 6, dur: 0.02, g: 0.1, delay: 0.04 + oi * 0.045 });
      T({ type: 'sine', f0: 7800, dur: 0.8, g: 0.01, att: 0.2, delay: 0.12 });
    } else if (kind === 'bootRoot') {
      // Match Boot, the rare saying (> SUDO FIGHT, 1 match in 100): root
      // access granted. A glitch, then three square blips climbing an
      // octave, under the saying's own hit.
      for (var ri = 0; ri < 4; ri++) T({ type: 'square', f0: [1450, 380, 2600, 720][ri], dur: 0.025, g: 0.05, delay: ri * 0.03 });
      [523.3, 784, 1046.5].forEach(function (n, i) { T({ type: 'square', f0: n, dur: 0.1, g: 0.08, att: 0.004, delay: 0.16 + i * 0.08, filt: 'lowpass', ff: 4200 }); });
    } else if (kind === 'bootHit') {
      // Match Boot: the saying slams in. A hit, then a short chord rising
      // a note at a time. One voice whatever the factions: the intro
      // favours neither side.
      T({ type: 'sine', f0: 150, f1: 42, dur: 0.38, g: 0.42 });
      N({ type: 'lowpass', f0: 2600, f1: 300, dur: 0.16, g: 0.24 });
      [261.6, 329.6, 392, 523.3].forEach(function (n, i) { T({ type: 'triangle', f0: n, dur: 0.62 - i * 0.07, g: 0.05, att: 0.01, delay: 0.06 + i * 0.07, filt: 'lowpass', ff: 3000 }); });
      T({ type: 'sine', f0: 1046.5, dur: 0.5, g: 0.02, att: 0.05, delay: 0.3 });
    } else if (kind === 'coinFlick') {
      // Match Boot's coin flip (render session 53), like 'bootHit' not a
      // match-event sound, one voice whatever the factions: the thumb's
      // flick, a dry click, and the coin's first ring as it leaves.
      N({ type: 'bandpass', f0: 3800, q: 5, dur: 0.03, g: 0.22 });
      T({ type: 'triangle', f0: 2650, dur: 0.18, g: 0.05, att: 0.003 });
      T({ type: 'sine', f0: 2650 * SFX_BELL[1], dur: 0.14, g: 0.02, att: 0.003 });
    } else if (kind === 'coinWhir') {
      // The coin spinning: a run of faint metal ticks, each turn a little
      // slower (the spin eases out), over a soft airy whir.
      var wt0 = 0;
      for (var wi2 = 0; wi2 < 9; wi2++) { T({ type: 'triangle', f0: 3100 - wi2 * 60, dur: 0.035, g: 0.022, att: 0.002, delay: wt0 }); wt0 += 0.03 + wi2 * 0.009; }
      N({ type: 'bandpass', f0: 1800, f1: 900, q: 2, dur: 0.5, g: 0.05, att: 0.05 });
    } else if (kind === 'coinWhirModem') {
      // Dial-Up Dime's spin (render session 55): the same slowing ticks,
      // under a modem's warble (two square tones trading places, then a
      // short burst of hiss), softly, so the clink still lands on top.
      var mt0 = 0;
      for (var mi2 = 0; mi2 < 9; mi2++) { T({ type: 'triangle', f0: 3100 - mi2 * 60, dur: 0.035, g: 0.018, att: 0.002, delay: mt0 }); mt0 += 0.03 + mi2 * 0.009; }
      [1200, 2100, 1200, 2100, 980].forEach(function (f, i) { T({ type: 'square', f0: f, dur: 0.06, g: 0.012, att: 0.004, delay: i * 0.065, filt: 'lowpass', ff: 3200 }); });
      N({ type: 'bandpass', f0: 2400, f1: 1500, q: 3, dur: 0.18, g: 0.03, att: 0.02, delay: 0.34 });
    } else if (kind === 'coinWhirNeon') {
      // Neon Nickel's spin: the ticks over a neon tube's mains buzz, a low
      // sawtooth that swells and fades as it turns.
      var nt0 = 0;
      for (var ni2 = 0; ni2 < 9; ni2++) { T({ type: 'triangle', f0: 3100 - ni2 * 60, dur: 0.035, g: 0.018, att: 0.002, delay: nt0 }); nt0 += 0.03 + ni2 * 0.009; }
      T({ type: 'sawtooth', f0: 120, dur: 0.5, g: 0.02, att: 0.12, filt: 'lowpass', ff: 900 });
      T({ type: 'sawtooth', f0: 240, dur: 0.42, g: 0.01, att: 0.1, filt: 'lowpass', ff: 1400 });
    } else if (kind === 'coinWhirShimmer') {
      // The Diamond and Mythic coins' spin: the ticks over a high shimmer,
      // bell partials climbing as it turns.
      var st0 = 0;
      for (var si2 = 0; si2 < 9; si2++) { T({ type: 'triangle', f0: 3100 - si2 * 60, dur: 0.035, g: 0.018, att: 0.002, delay: st0 }); st0 += 0.03 + si2 * 0.009; }
      [1568, 2093, 2637, 3136].forEach(function (f, i) { T({ type: 'sine', f0: f, dur: 0.22, g: 0.012, att: 0.01, delay: 0.05 + i * 0.09 }); T({ type: 'sine', f0: f * SFX_BELL[1], dur: 0.16, g: 0.006, att: 0.01, delay: 0.05 + i * 0.09 }); });
    } else if (kind === 'coinClink') {
      // The coin lands: a bright clink (two inharmonic partials, a second
      // smaller bounce), over a small low tap.
      T({ type: 'sine', f0: 140, f1: 70, dur: 0.12, g: 0.18 });
      T({ type: 'triangle', f0: 2350, dur: 0.4, g: 0.07, att: 0.002 });
      T({ type: 'sine', f0: 2350 * SFX_BELL[1], dur: 0.3, g: 0.035, att: 0.002 });
      T({ type: 'sine', f0: 2350 * SFX_BELL[2], dur: 0.22, g: 0.02, att: 0.002 });
      T({ type: 'triangle', f0: 2350, dur: 0.2, g: 0.03, att: 0.002, delay: 0.09 });
      N({ type: 'highpass', f0: 4500, dur: 0.04, g: 0.08 });
    } else if (kind === 'whistle') {
      // A rocket going up: a rising whistle over a hiss.
      T({ type: 'sine', f0: 900, f1: 2600, dur: 0.32, g: 0.04, att: 0.05 });
      N({ type: 'highpass', f0: 3000, dur: 0.3, g: 0.06, att: 0.05 });
    } else if (kind === 'pop') {
      // A firework bursting: a soft thump, a pop, then a crackle.
      T({ type: 'sine', f0: 140, f1: 50, dur: 0.25, g: 0.3 });
      N({ type: 'lowpass', f0: 3000, f1: 400, dur: 0.15, g: 0.25 });
      for (var pi = 0; pi < 6; pi++) N({ type: 'highpass', f0: r(3000, 7000), q: 2, dur: 0.02, g: 0.08, delay: 0.12 + pi * r(0.03, 0.06) });
    } else if (kind === 'cast') {
      // A power's cast flourish: a rising whoosh, the voice on top.
      N({ type: 'bandpass', f0: 500, f1: 2400, q: 3, dur: 0.3, g: 0.12, att: 0.15 });
      if (v === 'cortex') T({ type: 'square', f0: 880, f1: 1760, dur: 0.16, g: 0.025, delay: 0.12 });
      else if (v === 'aegis') T({ type: 'sawtooth', f0: 110, f1: 165, dur: 0.3, g: 0.06, filt: 'lowpass', ff: 700 });
      else if (v === 'swarm') for (var c = 0; c < 3; c++) N({ type: 'bandpass', f0: r(2600, 4200), q: 9, dur: 0.03, g: 0.1, delay: 0.1 + c * 0.04 });
      else if (v === 'null') T({ type: 'sawtooth', f0: 330, dur: 0.25, g: 0.04, steps: 5, filt: 'bandpass', ff: 1200, q: 2 });
      else T({ type: 'sine', f0: 1320, dur: 0.45, g: 0.04, delay: 0.1 });
    } else if (kind === 'tear') {
      // Foil ripping: a bright noise sweep with a crackle on top, and a
      // low pop as the strip comes free.
      N({ type: 'bandpass', f0: 5200, f1: 1400, q: 1.4, dur: 0.32, g: 0.28 });
      for (var ti = 0; ti < 7; ti++) N({ type: 'highpass', f0: r(3500, 7000), q: 2, dur: 0.02, g: 0.12, delay: ti * 0.04 });
      T({ type: 'sine', f0: 220, f1: 90, dur: 0.18, g: 0.18, delay: 0.3 });
    } else if (kind === 'burst') {
      // The tear finishing (render session 58): a soft whoomp of light, a
      // noise swell under it; the tier is the best card's (a plain pack's is
      // small, a Prototype's a deep boom with a bright tail). The voice tints
      // the tail.
      var bt = tier === 'spectacle' ? 2 : tier === 'subtle' ? 0 : 1;
      T({ type: 'sine', f0: [140, 120, 96][bt], f1: [70, 52, 38][bt], dur: [0.28, 0.45, 0.8][bt], g: [0.12, 0.2, 0.28][bt], att: 0.01 });
      N({ type: 'lowpass', f0: 600, f1: [1800, 3200, 5200][bt], q: 0.8, dur: [0.3, 0.5, 0.9][bt], g: [0.08, 0.14, 0.2][bt], att: [0.04, 0.06, 0.1][bt] });
      var tailF = v === 'cortex' ? 1760 : v === 'aegis' ? 880 : v === 'swarm' ? 2093 : v === 'null' ? 1245 : 1568;
      if (bt > 0) T({ type: 'triangle', f0: tailF, f1: tailF * (bt === 2 ? 1.5 : 1.25), dur: bt === 2 ? 0.9 : 0.4, g: 0.035, delay: 0.06, att: 0.05 });
      if (bt === 2) T({ type: 'sine', f0: tailF * 2, dur: 0.7, g: 0.025, delay: 0.18, att: 0.08 });
    } else if (kind === 'flip') {
      // One card moving: a short dry tick; the voice tints it. o.pitch
      // (render session 60) raises the whole tick: each plain card of a pack
      // snaps a little higher than the last.
      var fp = o.pitch > 0 ? o.pitch : 1;
      N({ type: 'bandpass', f0: (v === 'aegis' ? 1700 : v === 'swarm' ? 2600 : 3200) * fp, q: 6, dur: 0.035, g: 0.2 });
      T({ type: v === 'cortex' || v === 'null' ? 'square' : 'triangle', f0: (v === 'null' ? r(700, 1400) : 1100) * fp, dur: 0.03, g: 0.025 });
    } else if (kind === 'riser') {
      // One glow stage of a held card climbing in (render session 60): a
      // short swell that always rises, each stage (o.stage, 1-4) starting a
      // fourth above the last, so the climb is heard as well as seen. The
      // voice picks the wave; a breathy noise swell under it.
      var st = Math.max(1, Math.min(4, o.stage || 1)), rb = 220 * Math.pow(4 / 3, st - 1), rd = o.dur > 0 ? o.dur : 0.4;
      T({ type: v === 'cortex' || v === 'null' ? 'square' : v === 'aegis' ? 'sawtooth' : 'triangle', f0: rb, f1: rb * 1.5, dur: rd, g: 0.035 + st * 0.008, att: rd * 0.7, filt: 'lowpass', ff: 1800 + st * 600 });
      T({ type: 'sine', f0: rb * 2, f1: rb * 3, dur: rd, g: 0.03, att: rd * 0.8 });
      N({ type: 'bandpass', f0: 600 + st * 300, f1: 2400 + st * 900, q: 2, dur: rd, g: 0.05 + st * 0.012, att: rd * 0.8 });
    } else if (kind === 'bass') {
      // The hit as a held card lands (render session 60): a sub drop and a
      // thump; o.weight (0-1, the card's step on the reveal ladder) makes it
      // deeper and longer. Same in every voice (meaning): only a short
      // bright tail takes the faction's colour.
      var bw = Math.max(0, Math.min(1, o.weight || 0));
      T({ type: 'sine', f0: 92 - 40 * bw, f1: 30, dur: 0.45 + 0.9 * bw, g: 0.42, att: 0.006 });
      T({ type: 'triangle', f0: 184 - 80 * bw, f1: 60, dur: 0.25 + 0.4 * bw, g: 0.12, att: 0.004 });
      N({ type: 'lowpass', f0: 2200 + 2600 * bw, f1: 160, dur: 0.22 + 0.4 * bw, g: 0.26 });
      var tf = v === 'cortex' ? 1760 : v === 'aegis' ? 880 : v === 'swarm' ? 2093 : v === 'null' ? 1245 : 1568;
      T({ type: 'triangle', f0: tf, f1: tf * (1 + 0.5 * bw), dur: 0.3 + 0.6 * bw, g: 0.02 + 0.03 * bw, delay: 0.04, att: 0.03 });
    } else if (kind === 'rise') {
      // A hit: a rising tone. Always rises (meaning); the tier sets how far
      // and how long (a Foil is a small lift, a Gold or a secret a long climb).
      var big = tier === 'spectacle';
      T({ type: 'sine', f0: 330, f1: big ? 1320 : 880, dur: big ? 1.1 : 0.55, g: 0.12, att: 0.08 });
      T({ type: 'triangle', f0: 495, f1: big ? 1980 : 1320, dur: big ? 1.1 : 0.55, g: 0.05, att: 0.08 });
      if (big) [1, 1.25, 1.5, 2].forEach(function (p, i) { T({ type: 'sine', f0: 1320 * p, dur: 0.7, g: 0.035, delay: 1.0 + i * 0.07 }); });
    } else if (kind === 'sparkle') {
      // Sparks off the tear, or a Gold card's stars: high bell pings.
      for (var si = 0; si < 9; si++) T({ type: 'sine', f0: r(2400, 5200), dur: 0.12, g: 0.03, delay: si * 0.045 + r(0, 0.02) });
    } else if (kind === 'type') {
      // A terminal key: a click with a little body.
      N({ type: 'bandpass', f0: r(1800, 2600), q: 8, dur: 0.025, g: 0.16 });
      T({ type: 'square', f0: r(160, 220), dur: 0.02, g: 0.03 });
    } else if (kind === 'breach') {
      // The Zero-Day breach: a falling alarm over a low drone.
      for (var bi = 0; bi < 3; bi++) T({ type: 'sawtooth', f0: 880, f1: 440, dur: 0.22, g: 0.05, delay: bi * 0.26, filt: 'lowpass', ff: 2400 });
      T({ type: 'sawtooth', f0: 55, f1: 41, dur: 1.4, g: 0.12, filt: 'lowpass', ff: 300, att: 0.1 });
    } else if (kind === 'glitch') {
      // Corruption: broken pitch blips and a crunch.
      for (var gi = 0; gi < 6; gi++) T({ type: 'square', f0: r(150, 3200), dur: 0.03, g: 0.05, delay: gi * 0.05 });
      N({ type: 'bandpass', f0: 900, f1: 3000, q: 3, dur: 0.25, g: 0.18 });
    } else if (kind === 'tick') {
      // One step of a count (render session 61): the set bar's place filled,
      // a Prototype serial's number. A bright, short wooden tick; o.pitch
      // raises it, so a run of ticks climbs.
      var kp = o.pitch > 0 ? o.pitch : 1;
      T({ type: 'triangle', f0: 1568 * kp, dur: 0.05, g: 0.08, att: 0.002 });
      N({ type: 'bandpass', f0: 4200 * kp, q: 9, dur: 0.02, g: 0.09 });
    } else if (kind === 'fanfare') {
      // A Prototype's hit (render session 61; the brief's "a fanfare per
      // tier"): a rising major arpeggio landing on a held chord, brass-ish
      // (filtered saws) over a bell. The tier sets how far it climbs; the
      // voice only tints the bell on top.
      var ft = tier === 'spectacle' ? 2 : tier === 'subtle' ? 0 : 1;
      var root = 262, notes = [1, 1.26, 1.5, 2, 2.52].slice(0, 3 + ft);
      notes.forEach(function (p, i) { T({ type: 'sawtooth', f0: root * p, dur: 0.22, g: 0.05, delay: i * 0.09, att: 0.01, filt: 'lowpass', ff: 2600 }); });
      var land = notes.length * 0.09;
      [1, 1.26, 1.5, 2].forEach(function (p) { T({ type: 'sawtooth', f0: root * p, dur: 0.9 + 0.3 * ft, g: 0.035, delay: land, att: 0.04, filt: 'lowpass', ff: 2200 }); });
      var bf = v === 'cortex' ? 2093 : v === 'aegis' ? 1047 : v === 'swarm' ? 2349 : v === 'null' ? 1661 : 1568;
      T({ type: 'sine', f0: bf, dur: 1.2, g: 0.03, delay: land, att: 0.02 });
    } else if (kind === 'stamp') {
      // A Prototype's serial plate pressing in: a heavy thunk and a ring.
      T({ type: 'sine', f0: 140, f1: 45, dur: 0.35, g: 0.4 });
      N({ type: 'lowpass', f0: 2600, f1: 300, dur: 0.18, g: 0.25 });
      SFX_BELL.forEach(function (p) { T({ type: 'sine', f0: 523 * p, dur: 0.9, g: 0.04 / p, delay: 0.05 }); });
    }
    return out;
  }
`;

export const SOUND_FX_RUNTIME_SOURCE = String.raw`
  var SND = (function () {
    // want: the viewer wants sound (armed, or playing). on: the context is
    // running and play() makes sound. vol: the effects volume, 0-1.
    var AU = { ctx: null, on: false, want: false, vol: SFX_DEFAULT_VOLUME, hidden: false, master: null, comp: null, noise: null, active: 0, lift: null, duckTo: 1 };
    // The master bus level at full volume (the lab's 0.6); the effects
    // volume scales it.
    var MASTER = 0.6;
    var counts = { played: 0, voices: 0, capped: 0, repeats: 0, scheduled: 0, cuts: 0 }, byKind = {}, last = {};
    // Who needs the context running besides the effects (the music, slice
    // 4), and who hears about every event (the music's intensity and duck).
    var holds = {}, listeners = [];
    function init() {
      if (AU.ctx) return true;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      var C = new AC();
      AU.ctx = C;
      // The limiter: the lab's hard compressor on the master bus.
      var comp = C.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 10; comp.attack.value = 0.002; comp.release.value = 0.18;
      var m = C.createGain(); m.gain.value = MASTER * AU.vol * AU.duckTo;
      m.connect(comp); comp.connect(C.destination);
      AU.master = m; AU.comp = comp;
      // The lift bus (render session 60): the master's level without its
      // duck. duck() drops the master (every other sound) to near silence
      // while a held pack card builds; the build's own risers and hit ask to
      // be lifted (o.lift) and come through here, on top.
      var lift = C.createGain(); lift.gain.value = MASTER * AU.vol;
      lift.connect(comp);
      AU.lift = lift;
      // One second of white noise, shared by every noise voice.
      var len = C.sampleRate, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      AU.noise = buf;
      return true;
    }
    function bus(pan, dest) {
      var C = AU.ctx, g = C.createGain(), out = dest || AU.master;
      if (C.createStereoPanner) { var p = C.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(out); }
      else g.connect(out);
      return g;
    }
    function env(g, t, peak, att, dur) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + att);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    function done() { AU.active--; }
    // at: when the sound starts on the context's clock (now if not given);
    // dest: the bus it goes to (the master, or a group's).
    function tone(o, pan, at, dest) {
      var C = AU.ctx, t = (at != null ? at : C.currentTime) + (o.delay || 0), dur = o.dur || 0.2;
      var osc = C.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f0 || 440, t);
      if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
      if (o.steps) for (var i = 1; i < o.steps; i++) osc.frequency.setValueAtTime((o.f0 || 440) * Math.pow(2, Math.random() * 2 - 1), t + dur * i / o.steps);
      if (o.detune) osc.detune.value = o.detune;
      var e = C.createGain();
      env(e, t, o.g || 0.2, o.att || 0.005, dur);
      var n = osc;
      if (o.filt) { var f = C.createBiquadFilter(); f.type = o.filt; f.frequency.value = o.ff || 2000; f.Q.value = o.q || 1; osc.connect(f); n = f; }
      n.connect(e); e.connect(bus(pan, dest));
      osc.start(t); osc.stop(t + dur + 0.05);
      AU.active++; osc.onended = done;
    }
    function noise(o, pan, at, dest) {
      var C = AU.ctx, t = (at != null ? at : C.currentTime) + (o.delay || 0), dur = o.dur || 0.2;
      var s = C.createBufferSource();
      s.buffer = AU.noise; s.loop = true;
      var f = C.createBiquadFilter();
      f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
      f.frequency.setValueAtTime(o.f0 || 1200, t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t + dur);
      var e = C.createGain();
      env(e, t, o.g || 0.2, o.att || 0.003, dur);
      s.connect(f); f.connect(e); e.connect(bus(pan, dest));
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
      AU.active++; s.onended = done;
    }
    // play(kind, faction, tier, rect, o): one event's sound, panned by the
    // centre of rect (where it happens). Silent while sound is off. Every
    // call reaches the listeners, played or not (the music follows the
    // match even with effects muted). Besides the recipe's own options, o
    // may carry (render session 38, for Match Boot's scheduled sounds):
    //   at: the start time on the context's clock (a sound scheduled
    //     ahead; the repeat gap doesn't apply, the caller placed it);
    //   pan: a fixed pan instead of one from rect;
    //   group: a group from group(), so it can be cut with the others.
    // The listeners hear o.at too (null for a sound played now), so what
    // follows a sound queued ahead (the music's dip) lands with it.
    function play(kind, faction, tier, rect, o) {
      var played = sound(kind, faction, tier, rect, o);
      var at = o && typeof o.at === 'number' ? o.at : null;
      for (var i = 0; i < listeners.length; i++) listeners[i](kind, faction, tier, played, at);
      return played;
    }
    function sound(kind, faction, tier, rect, o) {
      if (!AU.on || !AU.ctx) return false;
      var now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      var key = kind + ':' + sfxVoiceOf(faction), at = o && typeof o.at === 'number' ? o.at : null;
      if (at === null) {
        if (last[key] !== undefined && now - last[key] < SFX_REPEAT_GAP_MS) { counts.repeats++; return false; }
        last[key] = now;
      }
      var x = rect ? rect.left + rect.width / 2 : (window.innerWidth || 1) / 2;
      var pan = o && typeof o.pan === 'number' ? o.pan : sfxPan(x, window.innerWidth || 1);
      var dest = o && o.group && o.group.node ? o.group.node : o && o.lift && AU.lift ? AU.lift : null;
      var voices = sfxRecipe(kind, faction, tier, Math.random, o);
      counts.played++; byKind[kind] = (byKind[kind] || 0) + 1;
      if (at !== null) counts.scheduled++;
      for (var i = 0; i < voices.length; i++) {
        if (AU.active >= SFX_VOICE_CAP) { counts.capped += voices.length - i; break; }
        if (voices[i].k === 'tone') tone(voices[i], pan, at, dest); else noise(voices[i], pan, at, dest);
        counts.voices++;
      }
      return true;
    }
    // The context runs while the effects or anything holding it (the
    // music) is on and the tab is visible; otherwise it is suspended.
    function refresh() {
      if (!AU.ctx) return;
      var need = AU.on;
      for (var k in holds) if (holds[k]) need = true;
      if (need && !AU.hidden) { if (AU.ctx.resume) AU.ctx.resume(); }
      else if (AU.ctx.suspend) AU.ctx.suspend();
    }
    function setOn(on) {
      AU.want = !!on;
      if (on && !init()) { AU.want = false; return false; }
      AU.on = !!on;
      refresh();
      return AU.on;
    }
    // core(): the shared context, limiter and noise buffer, made on first
    // use (only ever from a gesture), or null without WebAudio.
    function core() { return init() ? { ctx: AU.ctx, comp: AU.comp, noise: AU.noise } : null; }
    function hold(name, on) { holds[name] = !!on; refresh(); }
    // scrub() -> { set(speed), stop() }, or null while sound is off: a
    // continuous voice that follows a drag (the pack's rip, render session
    // 58). Two looped noises, a band (the rasp) and a high pass (the
    // crackle), their levels and the band's pitch following set(speed)
    // (sfxScrubLevel), smoothed so a jittery pointer doesn't zipper. stop()
    // fades it out in 60 ms and frees it.
    function scrub(faction) {
      if (!AU.on || !AU.ctx) return null;
      var C = AU.ctx, t = C.currentTime, out = bus(0, null);
      var band = C.createBiquadFilter(); band.type = 'bandpass'; band.Q.value = 1.3; band.frequency.value = 1400;
      var hi = C.createBiquadFilter(); hi.type = 'highpass'; hi.Q.value = 2; hi.frequency.value = sfxVoiceOf(faction) === 'aegis' ? 3600 : 5200;
      var g1 = C.createGain(), g2 = C.createGain(); g1.gain.value = 0; g2.gain.value = 0;
      var s1 = C.createBufferSource(), s2 = C.createBufferSource();
      s1.buffer = AU.noise; s2.buffer = AU.noise; s1.loop = true; s2.loop = true;
      s1.connect(band); band.connect(g1); g1.connect(out);
      s2.connect(hi); hi.connect(g2); g2.connect(out);
      s1.start(t, Math.random() * 0.5); s2.start(t, Math.random() * 0.5);
      AU.active += 2; counts.played++; byKind.scrub = (byKind.scrub || 0) + 1;
      var done2 = false, peak = 0;
      return {
        set: function (speed) {
          if (done2) return;
          var L = sfxScrubLevel(speed), n = C.currentTime;
          peak = Math.max(peak, L.gain);
          g1.gain.setTargetAtTime(L.gain, n, 0.025);
          g2.gain.setTargetAtTime(L.crackle, n, 0.015);
          band.frequency.setTargetAtTime(L.freq, n, 0.04);
        },
        stop: function () {
          if (done2) return;
          done2 = true;
          var n = C.currentTime;
          g1.gain.setTargetAtTime(0, n, 0.02); g2.gain.setTargetAtTime(0, n, 0.02);
          s1.stop(n + 0.08); s2.stop(n + 0.08);
          s1.onended = done; s2.onended = done;
        },
        peak: function () { return peak; },
      };
    }
    // group() -> { node, ctx, cut() }, or null while sound is off: a bus on
    // the master that a run of scheduled sounds goes through (Match Boot's),
    // so a skip can cut every one of them at once, the ones already ringing
    // and the ones scheduled ahead, in a 30 ms fade (no click).
    function group() {
      if (!AU.on || !AU.ctx) return null;
      var C = AU.ctx, g = C.createGain(), cut = false;
      g.gain.value = 1; g.connect(AU.master);
      return { node: g, ctx: C, cut: function () {
        if (cut) return false;
        cut = true; counts.cuts++;
        var t = C.currentTime;
        g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.03);
        return true;
      }, isCut: function () { return cut; } };
    }
    // sequence(list, o) -> a run of planned sounds on the audio clock
    // (render session 38 wrote this for Match Boot; session 39 shares it
    // with the victory boasts). A lookahead scheduler queues each sound a
    // little ahead at its exact time, so a dropped or late frame can't make
    // one late or merge two. list: [{ t (ms after o.t0), kind, tier, x (the
    // page x it pans by, unless o.pan is given) }], in time order. An item
    // with run(at) instead of a kind is called with its audio time when its
    // turn comes (the boasts' music holds, queued with their stings).
    //   o: { t0 (the run's start on performance.now(); now if not given),
    //     faction (the voice), pan (a fixed pan), onQueue(item, at) }.
    // The audio clock is tied to the run's clock once the context is
    // running; a sound whose time passed more than SEQ_LATE_S before it
    // could be queued (the context still waking, sound switched on late, a
    // hidden tab) is dropped, never played late. All go through one group,
    // so cut() silences them all, ringing or queued; stop() only stops
    // queueing (what is queued plays out). The run ticks itself every
    // SEQ_TICK_MS; tick() lets a frame loop tick it too.
    var SEQ_AHEAD_S = 0.15, SEQ_TICK_MS = 25, SEQ_LATE_S = 0.12;
    function sequence(list, o) {
      o = o || {};
      var q = { next: 0, aud: null, base: null, t0: typeof o.t0 === 'number' ? o.t0 : performance.now(), timer: 0, stopped: false, sched: [], late: 0 };
      function tick() {
        if (q.stopped || q.next >= list.length) return;
        if (!q.aud) {
          if (!AU.on || !AU.ctx) return;
          q.aud = group();
          if (!q.aud) return;
        }
        var C = q.aud.ctx;
        if (C.state && C.state !== 'running') return;
        if (q.base == null) q.base = C.currentTime - (performance.now() - q.t0) / 1000;
        var now = C.currentTime;
        while (q.next < list.length) {
          var m = list[q.next], at = q.base + m.t / 1000;
          if (at > now + SEQ_AHEAD_S) break;
          q.next++;
          if (now - at > SEQ_LATE_S) { q.late++; continue; }
          var go = Math.max(at, now), x = typeof m.x === 'number' ? m.x - (window.scrollX || 0) : null;
          if (m.run) { m.run(go); continue; }
          var po = { at: go, group: q.aud };
          if (typeof o.pan === 'number') po.pan = o.pan;
          play(m.kind, m.faction || o.faction || 'Neutral', m.tier, x == null ? null : { left: x, width: 0 }, po);
          q.sched.push({ kind: m.kind, t: m.t, at: Math.round((go - q.base) * 1000), lead: Math.round((at - now) * 1000) });
          if (o.onQueue) o.onQueue(m, go);
        }
      }
      function stop() { if (q.stopped) return; q.stopped = true; clearInterval(q.timer); }
      q.timer = setInterval(tick, SEQ_TICK_MS);
      tick();
      return { tick: tick, stop: stop,
        cut: function () { stop(); return q.aud ? q.aud.cut() : false; },
        stats: function () { return { planned: list.length, queued: q.next, sched: q.sched.slice(), late: q.late, base: q.base, stopped: q.stopped }; } };
    }
    function listen(fn) { listeners.push(fn); }
    // duck(level, ms): every sound not lifted eases to level (0-1) of its
    // volume over ms; duck(1, ms) brings it back. Remembered while sound is
    // off, so a context made later starts at the right level.
    function duck(level, ms) {
      AU.duckTo = Math.max(0, Math.min(1, Number(level)));
      if (AU.master && AU.ctx) {
        var t = AU.ctx.currentTime, g = AU.master.gain, to = MASTER * AU.vol * AU.duckTo;
        if (g.cancelScheduledValues) g.cancelScheduledValues(t);
        if (g.setTargetAtTime) g.setTargetAtTime(to, t, Math.max(0.005, (ms || 0) / 3000));
        else g.value = to;
      }
      counts.ducks = (counts.ducks || 0) + 1;
      return AU.duckTo;
    }
    // arm(pref): at page load, before any gesture. Remembers what the viewer
    // wants without making a context (browsers refuse audio until a gesture).
    function arm(pref) {
      pref = sfxPrefParse(pref);
      AU.want = !pref.muted;
      setVolume(pref.volume);
      return state();
    }
    // unlock(): called from a viewer gesture. Starts the armed sound; does
    // nothing while muted or already playing.
    function unlock() {
      if (!AU.want || AU.on) return AU.on;
      return setOn(true);
    }
    function setVolume(v) {
      AU.vol = sfxClampVolume(v);
      if (AU.master) AU.master.gain.value = MASTER * AU.vol * AU.duckTo;
      if (AU.lift) AU.lift.gain.value = MASTER * AU.vol;
      return AU.vol;
    }
    // A hidden tab goes quiet (the context is suspended) and picks up again
    // when the viewer comes back, if sound or music was on.
    function setHidden(hidden) {
      AU.hidden = !!hidden;
      refresh();
    }
    // 'muted' (the viewer switched it off), 'armed' (on, waiting for the
    // first gesture) or 'on'.
    function state() { return AU.on ? 'on' : AU.want ? 'armed' : 'muted'; }
    // A store the page reads and writes the setting through: { read() ->
    // anything sfxPrefParse takes, write(serialized) }. The standalone
    // replay uses browser storage; storage can be missing or throw (a
    // private window, blocked site data), and then the setting just isn't
    // remembered.
    function localStore() {
      return {
        read: function () { try { return window.localStorage.getItem(SFX_PREF_KEY); } catch (e) { return null; } },
        write: function (v) { try { window.localStorage.setItem(SFX_PREF_KEY, v); } catch (e) { /* not remembered */ } },
      };
    }
    // mount(btn, slider, store): wires the page's sound control. The first
    // pointer press or key press anywhere starts armed sound (a press on the
    // mute button itself just mutes); the button toggles and remembers;
    // the slider sets and remembers the volume.
    function mount(btn, slider, store) {
      store = store || localStore();
      arm(store.read());
      function save() { store.write(sfxPrefSerialize({ muted: !AU.want, volume: AU.vol })); }
      function show() {
        var st = state();
        btn.textContent = st === 'muted' ? '\u{1F507} Sound off' : '\u{1F50A} Sound on';
        btn.title = st === 'muted' ? 'Sound is off. Click to switch it on.'
          : st === 'armed' ? 'Sound is on and starts on your first click or key press. Click to mute.'
          : 'Sound is on. Click to mute.';
        btn.setAttribute('aria-pressed', String(st !== 'muted'));
        btn.setAttribute('data-state', st);
        if (btn.classList) { btn.classList.toggle('on', st !== 'muted'); btn.classList.toggle('armed', st === 'armed'); }
        if (slider) slider.disabled = st === 'muted';
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
        document.addEventListener('visibilitychange', function () { setHidden(document.visibilityState === 'hidden'); });
      }
      btn.addEventListener('click', function () { setOn(state() === 'muted'); save(); show(); });
      if (slider) {
        slider.value = String(Math.round(AU.vol * 100));
        slider.addEventListener('input', function () { setVolume(Number(slider.value) / 100); save(); });
      }
      show();
      return { gesture: gesture, show: show };
    }
    var api = { play: play, setOn: setOn, isOn: function () { return AU.on; }, arm: arm, unlock: unlock, setVolume: setVolume,
      volume: function () { return AU.vol; }, setHidden: setHidden, state: state, localStore: localStore, mount: mount,
      core: core, hold: hold, listen: listen, group: group, sequence: sequence, scrub: scrub, duck: duck, ducked: function () { return AU.duckTo; },
      stats: function () { var k = {}; for (var n in byKind) k[n] = byKind[n]; return { on: AU.on, state: state(), volume: AU.vol, ctx: !!AU.ctx, ctxState: AU.ctx ? AU.ctx.state : null, active: AU.active, played: counts.played, voices: counts.voices, capped: counts.capped, repeats: counts.repeats, scheduled: counts.scheduled, cuts: counts.cuts, byKind: k }; } };
    window.__sfx = api;
    return api;
  })();
`;

export type SfxKind = "launch" | "impact" | "bolt" | "heal" | "buff" | "debuff" | "lock" | "beam" | "kill" | "block" | "cast" | "ward" | "wardPulse" | "wardBreak";
export type SfxPackKind = "tear" | "flip" | "rise" | "sparkle" | "type" | "breach" | "glitch" | "stamp" | "burst" | "riser" | "bass" | "tick" | "fanfare";
export interface SfxVoice {
  k: "tone" | "noise";
  type: string;
  f0: number;
  f1?: number;
  dur: number;
  g: number;
  att?: number;
  delay?: number;
  steps?: number;
  detune?: number;
  filt?: string;
  ff?: number;
  q?: number;
}

const pure = new Function(
  `${SOUND_FX_PURE_SOURCE}; return { SFX_PACK_KINDS: SFX_PACK_KINDS, SFX_TIER_GAIN: SFX_TIER_GAIN, SFX_VOICE_CAP: SFX_VOICE_CAP, SFX_REPEAT_GAP_MS: SFX_REPEAT_GAP_MS, SFX_KINDS: SFX_KINDS, SFX_BELL: SFX_BELL, SFX_PREF_KEY: SFX_PREF_KEY, SFX_DEFAULT_VOLUME: SFX_DEFAULT_VOLUME, sfxVoiceOf: sfxVoiceOf, sfxTierGain: sfxTierGain, sfxPan: sfxPan, sfxRecipe: sfxRecipe, sfxClampVolume: sfxClampVolume, sfxPrefParse: sfxPrefParse, sfxPrefSerialize: sfxPrefSerialize, sfxScrubLevel: sfxScrubLevel, SFX_SCRUB_FULL: SFX_SCRUB_FULL };`,
)() as {
  SFX_PACK_KINDS: SfxPackKind[];
  SFX_TIER_GAIN: Record<FxTier, number>;
  SFX_VOICE_CAP: number;
  SFX_REPEAT_GAP_MS: number;
  SFX_KINDS: SfxKind[];
  SFX_BELL: number[];
  SFX_PREF_KEY: string;
  SFX_DEFAULT_VOLUME: number;
  sfxClampVolume: (v: unknown) => number;
  sfxPrefParse: (raw: unknown) => SfxPref;
  sfxPrefSerialize: (pref: Partial<SfxPref> | null | undefined) => string;
  sfxVoiceOf: (faction: string | undefined) => string;
  sfxTierGain: (tier: FxTier) => number;
  sfxPan: (x: number, width: number) => number;
  sfxScrubLevel: (speed: number) => { gain: number; freq: number; crackle: number };
  SFX_SCRUB_FULL: number;
  sfxRecipe: (kind: SfxKind | SfxPackKind, faction: string | undefined, tier: FxTier, rand: () => number, o?: { targetKind?: "unit" | "player"; victim?: string }) => SfxVoice[];
};

export interface SfxPref {
  muted: boolean;
  volume: number;
}

export const { SFX_PACK_KINDS, SFX_TIER_GAIN, SFX_VOICE_CAP, SFX_REPEAT_GAP_MS, SFX_KINDS, SFX_BELL, SFX_PREF_KEY, SFX_DEFAULT_VOLUME, sfxVoiceOf, sfxTierGain, sfxPan, sfxRecipe, sfxClampVolume, sfxPrefParse, sfxPrefSerialize, sfxScrubLevel, SFX_SCRUB_FULL } = pure;
