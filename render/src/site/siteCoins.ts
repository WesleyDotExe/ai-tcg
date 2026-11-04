// The coins on the website (render session 55, the second coin slice): the
// Store's cosmetics list shows a coin drawn, not a colour swatch. Like the
// card face (siteFaces.ts), nothing here is a second copy of the coin:
// COIN_SCRIPT runs coinFx.ts's own sources (the looks, COIN_SPECS, and
// coinDraw, the code Match Boot runs) in their own scope and paints every
// `<canvas data-coin="<item id>">` on the page, landed design up, including
// ones the website draws later (a MutationObserver), once each. The
// swatch markup is in siteCoinSwatch.ts (no imports), so the client bundle
// never loads coinFx.ts, whose module evaluates its sources with
// new Function (the site's CSP has no 'unsafe-eval').

import { COIN_PURE_SOURCE, COIN_RUNTIME_SOURCE } from "../coinFx.js";

export const COIN_SCRIPT = `window.SITE_COIN = (function () {
${COIN_PURE_SOURCE}
${COIN_RUNTIME_SOURCE}
  var painted = 0;
  function paintOne(cv) {
    var id = cv.getAttribute('data-coin'), spec = COIN_SPECS[id];
    if (!spec || cv.getAttribute('data-painted') === id) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.width, h = cv.height;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var r = Math.min(w, h) * 0.32;
    coinDraw(ctx, { spec: spec, x: w / 2, y: h / 2 - r * 0.08, r: r, angle: 0, scale: 1, t: 900 });
    cv.setAttribute('data-painted', id);
    painted++;
  }
  function paint(root) { (root || document).querySelectorAll('canvas[data-coin]').forEach(paintOne); }
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(function () { paint(document); }).observe(document.documentElement, { childList: true, subtree: true });
  }
  return { paint: paint, specs: COIN_SPECS, painted: function () { return painted; } };
})();`;
