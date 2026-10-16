import { chromium } from 'playwright-core';
const [file, shot] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const w of [600, 390, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 1100 } });
  await p.goto('file://' + file); await p.waitForTimeout(300);
  // find a move where a board card dies, using the frames embedded in the page DOM after each step
  const n = await p.evaluate(() => Number(document.getElementById('scrubber').max));
  let found = null;
  for (let k = 1; k <= n && !found; k++) {
    const r = await p.evaluate((k) => {
      const s = document.getElementById('scrubber'); s.value = String(k - 1); s.dispatchEvent(new Event('input'));
      const before = {}; document.querySelectorAll('.board-row .card').forEach(c => { before[c.dataset.iid] = c.getBoundingClientRect().toJSON(); });
      document.getElementById('btn-next').click();
      const after = new Set([...document.querySelectorAll('.board-row .card')].map(c => c.dataset.iid));
      const gone = Object.keys(before).filter(i => !after.has(i));
      if (!gone.length) return null;
      const g = document.querySelector('.fx-layer .fx-ghost');
      if (!g) return { k, gone, ghost: null };
      const gr = g.getBoundingClientRect().toJSON();
      const nm = g.querySelector('.name'); const nr = nm ? nm.getBoundingClientRect().toJSON() : null;
      return { k, gone, was: before[gone[0]], ghost: gr, nameW: nr && nr.width, zoom: g.style.zoom };
    }, k);
    if (r) found = r;
  }
  const d = found && found.ghost ? { dl: (found.ghost.left - found.was.left).toFixed(1), dt: (found.ghost.top - found.was.top).toFixed(1), dw: (found.ghost.width - found.was.width).toFixed(1), dh: (found.ghost.height - found.was.height).toFixed(1), nameVsCard: (found.nameW / found.ghost.width).toFixed(3) } : found;
  console.log(w, 'move', found && found.k, 'ghost zoom', found && found.zoom, JSON.stringify(d));
  if (shot && w === 600) { await p.waitForTimeout(60); await p.screenshot({ path: shot }); }
  await p.close();
}
await b.close();
