// The "tap to skip" hint (render session 43; quality-debt "No 'tap to skip'
// hint beyond the Skip button").
//
// A victory boast and the Match Boot intro both end on a tap anywhere (the
// intro: anywhere but the playback controls), on Escape, or on their Skip
// button. Until now only the button said so, and a viewer had no way to
// know the whole board would do. The hint is one small line under the
// Skip button, right-aligned with it:
//   - on a touch screen (pointer: coarse): "or tap anywhere";
//   - with a mouse: "or click anywhere · Esc".
// It is the button's caption, so it comes and goes with the button (the
// loadout picker, which hides the button, hides it too).
//
// Two rules keep it from becoming clutter:
//   - Once the viewer has skipped anything on the page (a boast or the
//     intro), they know; the hint isn't shown again on that page.
//   - It never goes where it doesn't fit: it must sit inside the same box
//     as its button (a boast: the winner's side; the intro: the board) and
//     clear of the boast's name plate. If it can't, it is left out; the
//     button is still there.
//
// Same single-source pattern as the rest: SKIP_HINT_SOURCE is embedded in
// the page verbatim (inside BOAST_PURE_SOURCE, which every page with a
// boast or the intro carries) and evaluated here for the tests.

export const SKIP_HINT_SOURCE = String.raw`
  // The words: a touch screen taps, a desktop clicks or presses Escape.
  var SKIP_HINT_TAP = 'or tap anywhere', SKIP_HINT_KEY = 'or click anywhere · Esc';
  // The gap under the button, and the margin the hint keeps from its box.
  var SKIP_HINT_GAP = 3, SKIP_HINT_PAD = 4;
  // Page state shared by the boast and the intro: has the viewer skipped?
  var SKIP_HINT_STATE = { seen: false, shown: 0, dropped: 0 };
  function skipHintText(coarse) { return coarse ? SKIP_HINT_TAP : SKIP_HINT_KEY; }
  // Where the hint goes: right-aligned under the button sk {l,t,r,b}, w x h.
  // Returns {l,t,r,b}, or null when it would leave inside {l,t,r,b} (less
  // SKIP_HINT_PAD) or touch any rect in avoid.
  function skipHintPlace(sk, w, h, inside, avoid) {
    if (!sk || !inside || !(w > 0) || !(h > 0)) return null;
    var r = { l: sk.r - w, t: sk.b + SKIP_HINT_GAP, r: sk.r, b: sk.b + SKIP_HINT_GAP + h };
    if (r.l < inside.l + SKIP_HINT_PAD || r.r > inside.r - SKIP_HINT_PAD + 0.5 || r.t < inside.t || r.b > inside.b - SKIP_HINT_PAD) return null;
    for (var i = 0; avoid && i < avoid.length; i++) {
      var a = avoid[i];
      if (a && r.l < a.r && r.r > a.l && r.t < a.b && r.b > a.t) return null;
    }
    return r;
  }
  // Puts the hint under the Skip button sk (an element already on the
  // page), inside the box inside, clear of the rects in avoid. Returns the element,
  // or null (the viewer has skipped before, or it doesn't fit). The caller
  // removes it with the button.
  function skipHintShow(sk, inside, avoid) {
    if (SKIP_HINT_STATE.seen || typeof document === 'undefined' || !sk) return null;
    var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var el = document.createElement('div');
    el.className = 'skip-hint'; el.setAttribute('aria-hidden', 'true');
    el.textContent = skipHintText(coarse);
    el.style.left = '0px'; el.style.top = '0px'; el.style.visibility = 'hidden';
    document.body.appendChild(el);
    var sr = sk.getBoundingClientRect(), sx = window.scrollX || 0, sy = window.scrollY || 0;
    var box = { l: sr.left + sx, t: sr.top + sy, r: sr.right + sx, b: sr.bottom + sy };
    var at = skipHintPlace(box, el.offsetWidth, el.offsetHeight, inside, avoid);
    if (!at) { el.remove(); SKIP_HINT_STATE.dropped++; return null; }
    el.style.left = at.l + 'px'; el.style.top = at.t + 'px'; el.style.visibility = '';
    // The button tells screen readers too (the hint itself is decoration).
    sk.setAttribute('aria-label', 'Skip, ' + el.textContent);
    SKIP_HINT_STATE.shown++;
    return el;
  }
  function skipHintSeen() { SKIP_HINT_STATE.seen = true; }
`;

// Below the Skip button, the same ink, quieter; it fades with the button.
export const SKIP_HINT_CSS = `
.skip-hint { position: absolute; z-index: 97; pointer-events: none; white-space: nowrap; font-size: 11px; letter-spacing: 0.05em; line-height: 1.25;
  color: var(--ink, #dfe7ff); opacity: 0.88; padding: 1px 6px; border-radius: 3px; background: rgba(10,12,22,0.86);
  text-shadow: 0 1px 2px #000; transition: opacity 320ms ease; }
.skip-hint.gone { opacity: 0; }
@media (pointer: coarse) { .skip-hint { font-size: 12px; } }
`;

export interface SkipRect { l: number; t: number; r: number; b: number }

const impl = new Function(`${SKIP_HINT_SOURCE}; return { SKIP_HINT_TAP: SKIP_HINT_TAP, SKIP_HINT_KEY: SKIP_HINT_KEY, SKIP_HINT_GAP: SKIP_HINT_GAP, SKIP_HINT_PAD: SKIP_HINT_PAD, skipHintText: skipHintText, skipHintPlace: skipHintPlace };`)() as {
  SKIP_HINT_TAP: string;
  SKIP_HINT_KEY: string;
  SKIP_HINT_GAP: number;
  SKIP_HINT_PAD: number;
  skipHintText(coarse: boolean): string;
  skipHintPlace(sk: SkipRect, w: number, h: number, inside: SkipRect, avoid?: (SkipRect | null)[]): SkipRect | null;
};

export const SKIP_HINT_TAP = impl.SKIP_HINT_TAP;
export const SKIP_HINT_KEY = impl.SKIP_HINT_KEY;
export const SKIP_HINT_GAP = impl.SKIP_HINT_GAP;
export const SKIP_HINT_PAD = impl.SKIP_HINT_PAD;
export const skipHintText = impl.skipHintText;
export const skipHintPlace = impl.skipHintPlace;
