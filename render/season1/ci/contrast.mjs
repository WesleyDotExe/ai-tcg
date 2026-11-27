// Text contrast measured from the pixels (render session 88 wrote it in
// agent-states-check, render 89 moved it to tile-states-check.mjs; render 92,
// a hardening pass, shares it so home-grid-check.mjs measures every tile on
// the Home too). Each tile is shot with its text made transparent (the glass
// and whatever shows through it), then each text line's colour is held
// against the mean of that shot inside the line's box: WCAG's ratio.
// The page needs NOTEXT_CSS added once (a style element).

export const NOTEXT_CSS = '.__notext, .__notext * { color: transparent !important; } .__notext .btn:not(.pri) { color: transparent !important; }';

export async function contrast(page, selector) {
  const tiles = await page.$$(selector);
  let worst = 99, who = '';
  const perTile = [];
  for (const t of tiles) {
    const id = await t.evaluate((el) => ({ tile: el.dataset.tile, size: el.dataset.size }));
    let tw = 99, twho = '';
    const leaves = await t.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const out = [];
      for (const e of el.querySelectorAll(':scope > header h3, :scope > .headline *, :scope > .body *, :scope > footer .btn:not(.pri)')) {
        // Artwork hidden from assistive tech (the sealed pack's printed logo
        // and set name, render session 91) is a picture, not text to read.
        if (e.closest('.q, .ava, .pill.pri, .btn.pri, [aria-hidden="true"]')) continue;
        if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const q = e.getBoundingClientRect(); const s = getComputedStyle(e);
        if (q.width <= 1 || s.visibility === 'hidden' || s.display === 'none') continue; // .vh: screen-reader-only
        out.push({ x: q.left - r.left, y: q.top - r.top, w: q.width, h: q.height, color: s.color, text: e.textContent.trim().slice(0, 28), fact: e.closest('[data-fact]')?.dataset.fact ?? 'header' });
      }
      return out;
    });
    await t.evaluate((el) => el.classList.add('__notext'));
    const png = (await t.screenshot({ type: 'png' })).toString('base64');
    await t.evaluate((el) => el.classList.remove('__notext'));
    const res = await page.evaluate(async ({ png, leaves }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const L = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
      return leaves.map((f) => {
        const d = g.getImageData(Math.max(0, Math.floor(f.x)), Math.max(0, Math.floor(f.y)), Math.max(1, Math.floor(f.w)), Math.max(1, Math.floor(f.h))).data;
        let sum = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { sum += L(d[i], d[i + 1], d[i + 2]); n++; }
        const bg = sum / n;
        // rgb(r, g, b) is 0-255; color(srgb r g b) (what color-mix computes to) is 0-1.
        const m = f.color.match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => (f.color.startsWith('color(') ? v * 255 : v));
        const fg = L(m[0], m[1], m[2]);
        return { ...f, cr: (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05) };
      });
    }, { png, leaves });
    for (const r of res) {
      if (r.cr < worst) { worst = r.cr; who = `${r.fact} "${r.text}"`; }
      if (r.cr < tw) { tw = r.cr; twho = `${r.fact} "${r.text}"`; }
    }
    perTile.push({ ...id, worst: tw, who: twho, lines: res.length });
  }
  return { worst, who, perTile };
}

